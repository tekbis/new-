function cleanEnv(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .trim();
}

function firstEnv() {
  for (var i = 0; i < arguments.length; i += 1) {
    const value = cleanEnv(process.env[arguments[i]]);
    if (value) return value;
  }
  return '';
}

function looksLikePlaceholder(value) {
  return /your_|example|placeholder|changeme|dummy/i.test(String(value || ''));
}

function stripeSecretKey() {
  return firstEnv('STRIPE_SECRET_KEY', 'STRIPE_SECRET');
}

function stripePublishableKey() {
  return firstEnv(
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_PUBLIC_KEY',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'
  );
}

function stripeSecretReady() {
  const key = stripeSecretKey();
  return /^(sk|rk)_(test|live)_/.test(key) && !looksLikePlaceholder(key);
}

function stripePublishableReady() {
  const key = stripePublishableKey();
  return (key.startsWith('pk_test_') || key.startsWith('pk_live_')) && !looksLikePlaceholder(key);
}

module.exports = {
  stripeSecretKey: stripeSecretKey,
  stripePublishableKey: stripePublishableKey,
  stripeSecretReady: stripeSecretReady,
  stripePublishableReady: stripePublishableReady
};
