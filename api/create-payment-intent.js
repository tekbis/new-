const Stripe = require('stripe');
const { quoteOrder, customerFromBody, metadataFromQuote } = require('./_lib/order');
const { readJsonBody, json } = require('./_lib/http');

function stripeClient() {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key || (!key.startsWith('sk_test_') && !key.startsWith('sk_live_'))) return null;
  if (/your_|example|placeholder|changeme|dummy/i.test(key)) return null;
  return new Stripe(key);
}

function intentFields(params) {
  const fields = {
    amount: params.amount,
    metadata: params.metadata
  };
  if (params.receipt_email) fields.receipt_email = params.receipt_email;
  if (params.shipping) fields.shipping = params.shipping;
  return fields;
}

async function upsertPaymentIntent(stripe, existingId, params) {
  const fields = intentFields(params);
  if (existingId) {
    try {
      const current = await stripe.paymentIntents.retrieve(existingId);
      const updatable = current.status === 'requires_payment_method' ||
        current.status === 'requires_confirmation' ||
        current.status === 'requires_action';
      if (updatable) {
        return stripe.paymentIntents.update(existingId, fields);
      }
    } catch (error) {
      /* Create a new intent if the previous one cannot be updated. */
    }
  }

  return stripe.paymentIntents.create(Object.assign({
    currency: 'usd',
    automatic_payment_methods: { enabled: true }
  }, fields));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
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
    const existingId = typeof body.paymentIntentId === 'string' && /^pi_[A-Za-z0-9]+$/.test(body.paymentIntentId)
      ? body.paymentIntentId
      : undefined;
    const intent = await upsertPaymentIntent(stripe, existingId, {
      amount: quote.amount,
      metadata: metadataFromQuote(quote),
      receipt_email: customer.email,
      shipping: customer.shipping
    });

    return json(res, 200, {
      configured: true,
      id: intent.id,
      clientSecret: intent.client_secret,
      amount: quote.amount
    });
  } catch (error) {
    const message = error && error.message ? error.message : 'Unable to start payment.';
    const status = error.statusCode || (/cart|unavailable|shipping|small|Invalid/i.test(message) ? 400 : 500);
    return json(res, status, { error: message });
  }
};
