const Stripe = require('stripe');

function stripeClient() {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key) return null;
  return new Stripe(key);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = stripeClient();
  const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  let event = req.body;

  if (stripe && webhookSecret && req.headers['stripe-signature'] && typeof req.body === 'string') {
    try {
      event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], webhookSecret);
    } catch (error) {
      return res.status(400).send('Webhook signature verification failed.');
    }
  }

  if (event && event.type === 'payment_intent.succeeded') {
    const intent = event.data && event.data.object ? event.data.object : {};
    console.log('Stripe payment succeeded', intent.id, intent.amount);
  }

  return res.status(200).json({ received: true });
};
