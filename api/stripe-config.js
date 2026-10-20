const { paypalConfigured, paypalEnv } = require('./_lib/paypal');
const { stripeSecretReady, stripePublishableReady, stripePublishableKey } = require('./_lib/stripe-env');
const { json } = require('./_lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Method not allowed' });
  }

  const configured = stripeSecretReady();
  const paypal = paypalConfigured();
  const paypalClientId = paypal ? paypalEnv().clientId : '';

  return json(res, 200, {
    configured: configured,
    publishableKey: configured && stripePublishableReady() ? stripePublishableKey() : '',
    paypal: {
      configured: paypal,
      clientId: paypalClientId
    }
  });
};
