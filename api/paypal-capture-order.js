const { capturePaypalOrder, getPaypalOrder, orderPaid } = require('./_lib/paypal');
const { readJsonBody, json } = require('./_lib/http');

function readOrderId(req, body) {
  const fromBody = body && (body.orderID || body.orderId || body.token);
  const fromQuery = req.query && (req.query.orderID || req.query.orderId || req.query.token);
  let fromUrl = '';
  try {
    fromUrl = new URL(req.url, 'http://localhost').searchParams.get('orderID') ||
      new URL(req.url, 'http://localhost').searchParams.get('token') || '';
  } catch (error) {
    fromUrl = '';
  }
  return String(fromBody || fromQuery || fromUrl || '').trim();
}

function validOrderId(orderID) {
  return Boolean(orderID && orderID.length >= 8 && orderID.length <= 64 && /^[A-Za-z0-9-]+$/.test(orderID));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const body = req.method === 'POST' ? await readJsonBody(req) : {};
    const orderID = readOrderId(req, body);
    if (!validOrderId(orderID)) {
      return json(res, 400, { error: 'Missing PayPal order.' });
    }

    const order = req.method === 'GET'
      ? await getPaypalOrder(orderID)
      : await capturePaypalOrder(orderID);

    if (!orderPaid(order)) {
      return json(res, 402, { error: 'PayPal payment was not completed.', success: false, status: order && order.status });
    }

    return json(res, 200, {
      success: true,
      id: order.id,
      status: order.status
    });
  } catch (error) {
    const message = error && error.message ? error.message : 'Unable to complete PayPal payment.';
    const status = error.statusCode || (/Invalid/i.test(message) ? 400 : 500);
    return json(res, status, { error: message, success: false });
  }
};
