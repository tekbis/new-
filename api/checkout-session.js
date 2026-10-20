const Stripe = require('stripe');
const { json } = require('./_lib/http');

function stripeClient() {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key || (!key.startsWith('sk_test_') && !key.startsWith('sk_live_'))) return null;
  if (/your_|example|placeholder|changeme|dummy/i.test(key)) return null;
  return new Stripe(key);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Method not allowed' });
  }

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
};
