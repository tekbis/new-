const Stripe = require('stripe');
const { applySecurityHeaders, readRawBody, json } = require('./_lib/http');

function stripeClient() {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key || (!key.startsWith('sk_test_') && !key.startsWith('sk_live_'))) return null;
  return new Stripe(key);
}

async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  const stripe = stripeClient();
  if (!stripe || !webhookSecret || !webhookSecret.startsWith('whsec_')) {
    return json(res, 503, { error: 'Webhook is not configured.' });
  }

  const signature = String((req.headers && req.headers['stripe-signature']) || '');
  if (!signature) {
    return json(res, 400, { error: 'Missing webhook signature.' });
  }

  let event;
  try {
    const raw = await readRawBody(req, 1024 * 1024);
    event = stripe.webhooks.constructEvent(raw.toString('utf8'), signature, webhookSecret);
  } catch (error) {
    return json(res, 400, { error: 'Webhook signature verification failed.' });
  }

  if (event && event.type === 'payment_intent.succeeded') {
    const intent = event.data && event.data.object ? event.data.object : {};
    console.log('Stripe payment succeeded', intent.id, intent.amount);
  }

  return json(res, 200, { received: true });
}

handler.config = { api: { bodyParser: false } };
module.exports = handler;
