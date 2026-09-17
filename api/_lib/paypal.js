function looksLikePlaceholder(value) {
  return /your_|example|placeholder|changeme|dummy/i.test(String(value || ''));
}

function paypalEnv() {
  const mode = String(process.env.PAYPAL_ENV || process.env.PAYPAL_MODE || 'sandbox').trim().toLowerCase();
  const live = mode === 'live' || mode === 'production';
  return {
    live: live,
    base: live ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com',
    clientId: String(process.env.PAYPAL_CLIENT_ID || '').trim(),
    secret: String(process.env.PAYPAL_CLIENT_SECRET || '').trim()
  };
}

function paypalConfigured() {
  const env = paypalEnv();
  return Boolean(
    env.clientId &&
    env.secret &&
    env.clientId.length > 8 &&
    env.secret.length > 8 &&
    !looksLikePlaceholder(env.clientId) &&
    !looksLikePlaceholder(env.secret)
  );
}

let tokenCache = { accessToken: '', expiresAt: 0, base: '' };

async function paypalAccessToken() {
  const env = paypalEnv();
  if (!paypalConfigured()) {
    const err = new Error('PayPal is not configured yet. Add PayPal keys to complete payment.');
    err.statusCode = 503;
    throw err;
  }
  if (tokenCache.accessToken && tokenCache.base === env.base && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  const response = await fetch(env.base + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(env.clientId + ':' + env.secret).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const data = await response.json().catch(function () { return {}; });
  if (!response.ok || !data.access_token) {
    const err = new Error(data.error_description || 'PayPal authentication failed.');
    err.statusCode = 502;
    throw err;
  }
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + Math.max(30, Number(data.expires_in) || 300) * 1000 - 20000,
    base: env.base
  };
  return tokenCache.accessToken;
}

async function paypalRequest(method, path, body, extraHeaders) {
  const env = paypalEnv();
  const token = await paypalAccessToken();
  const headers = Object.assign({
    Authorization: 'Bearer ' + token
  }, extraHeaders || {});
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(env.base + path, {
    method: method,
    headers: headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(function () { return {}; });
  if (!response.ok) {
    const detail = data.message || (data.details && data.details[0] && data.details[0].description) || 'PayPal request failed.';
    const err = new Error(detail);
    err.statusCode = response.status >= 400 && response.status < 500 ? 400 : 502;
    err.issue = data.details && data.details[0] && data.details[0].issue;
    throw err;
  }
  return data;
}

function orderPaid(order) {
  const unit = order && order.purchase_units && order.purchase_units[0];
  const captured = unit && unit.payments && unit.payments.captures && unit.payments.captures[0];
  return Boolean(
    (order && order.status === 'COMPLETED') ||
    (captured && (captured.status === 'COMPLETED' || captured.status === 'PENDING'))
  );
}

async function capturePaypalOrder(orderID) {
  const path = '/v2/checkout/orders/' + encodeURIComponent(orderID);
  try {
    return await paypalRequest('POST', path + '/capture', undefined, {
      'PayPal-Request-Id': 'capture-' + orderID
    });
  } catch (error) {
    const already = error.issue === 'ORDER_ALREADY_CAPTURED' || /already been captured/i.test(error.message || '');
    if (!already) throw error;
    const existing = await paypalRequest('GET', path);
    if (orderPaid(existing)) return existing;
    throw error;
  }
}

async function getPaypalOrder(orderID) {
  return paypalRequest('GET', '/v2/checkout/orders/' + encodeURIComponent(orderID));
}

module.exports = {
  paypalEnv: paypalEnv,
  paypalConfigured: paypalConfigured,
  paypalRequest: paypalRequest,
  capturePaypalOrder: capturePaypalOrder,
  getPaypalOrder: getPaypalOrder,
  orderPaid: orderPaid
};
