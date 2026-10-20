const Stripe = require('stripe');
const { quoteOrder, customerFromBody, metadataFromQuote } = require('./_lib/order');
const { readJsonBody, json, clientMessage } = require('./_lib/http');

function stripeClient() {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key || (!key.startsWith('sk_test_') && !key.startsWith('sk_live_'))) return null;
  if (/your_|example|placeholder|changeme|dummy/i.test(key)) return null;
  return new Stripe(key);
}

function checkoutOrigin(req) {
  const raw = String((req.headers && (req.headers.origin || req.headers.referer)) || '').trim();
  try {
    const origin = new URL(raw).origin;
    if (/^https:\/\/(www\.)?zander88llc\.net$/i.test(origin)) return origin;
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return origin;
  } catch (error) { /* Use the live store URL when the request origin is unknown. */ }
  return 'https://www.zander88llc.net';
}

function shippingLabel(value) {
  const key = String(value || '');
  if (key === '14.95' || key === 'priority') return 'Priority delivery';
  return 'Standard delivery';
}

function clipName(value) {
  return String(value || 'Item').trim().slice(0, 120) || 'Item';
}

async function retrieveSession(req, res) {
  const stripe = stripeClient();
  if (!stripe) {
    return json(res, 503, { error: 'Stripe is not configured yet.', paid: false });
  }

  const sessionId = String((req.query && req.query.session_id) || '').trim();
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    return json(res, 400, { error: 'Missing checkout session.', paid: false });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = session && (session.payment_status === 'paid' || session.status === 'complete');
    return json(res, 200, { paid: Boolean(paid), status: session && session.status });
  } catch (error) {
    return json(res, 400, { error: 'Checkout session could not be confirmed.', paid: false });
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return retrieveSession(req, res);
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  const stripe = stripeClient();
  if (!stripe) {
    return json(res, 503, {
      error: 'Stripe is not configured yet. Add Stripe keys to complete payment.',
      configured: false
    });
  }

  try {
    const body = await readJsonBody(req);
    const quote = await quoteOrder(body.cart, body.shipping, body.coupon);
    const customer = customerFromBody(body);
    const origin = checkoutOrigin(req);
    const metadata = metadataFromQuote(quote);
    const lineItems = quote.lines.map(function (line) {
      return {
        quantity: line.qty,
        price_data: {
          currency: 'usd',
          unit_amount: line.unitAmount,
          product_data: { name: clipName(line.name) }
        }
      };
    });
    if (quote.shipping > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: quote.shipping,
          product_data: { name: shippingLabel(body.shipping) }
        }
      });
    }

    const sessionParams = {
      mode: 'payment',
      line_items: lineItems,
      success_url: origin + '/order-confirmation.html?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: origin + '/checkout',
      metadata: metadata,
      payment_intent_data: {
        metadata: metadata
      }
    };
    if (customer.email) {
      sessionParams.customer_email = customer.email;
      sessionParams.payment_intent_data.receipt_email = customer.email;
    }
    if (customer.shipping) sessionParams.payment_intent_data.shipping = customer.shipping;
    if (quote.discount > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: quote.discount,
        currency: 'usd',
        duration: 'once',
        max_redemptions: 1,
        name: quote.coupon || 'Discount'
      });
      sessionParams.discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    if (!session || !session.url) {
      return json(res, 500, { error: 'Unable to start Stripe Checkout.' });
    }

    return json(res, 200, {
      configured: true,
      id: session.id,
      url: session.url
    });
  } catch (error) {
    const status = error.statusCode || (/cart|unavailable|shipping|small|Invalid|Too many/i.test(error && error.message ? error.message : '') ? 400 : 500);
    return json(res, status, { error: clientMessage(error, 'Unable to start payment.') });
  }
};
