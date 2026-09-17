const { paypalConfigured, paypalEnv } = require('./_lib/paypal');

function looksLikePlaceholder(value) {
  return /your_|example|placeholder|changeme|dummy/i.test(String(value || ''));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const publishableKey = String(process.env.STRIPE_PUBLISHABLE_KEY || '').trim();
  const secretKey = String(process.env.STRIPE_SECRET_KEY || '').trim();
  const secretTest = secretKey.startsWith('sk_test_');
  const secretLive = secretKey.startsWith('sk_live_');
  const pubTest = publishableKey.startsWith('pk_test_');
  const pubLive = publishableKey.startsWith('pk_live_');
  const configured = ((secretTest && pubTest) || (secretLive && pubLive)) &&
    !looksLikePlaceholder(secretKey) &&
    !looksLikePlaceholder(publishableKey);
  const paypal = paypalConfigured();
  const paypalClientId = paypal ? paypalEnv().clientId : '';

  return res.status(200).json({
    configured: configured,
    publishableKey: configured ? publishableKey : '',
    paypal: {
      configured: paypal,
      clientId: paypalClientId
    }
  });
};
