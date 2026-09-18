const { readJsonBody, json } = require('./_lib/http');
const {
  adminConfigured,
  adminPassword,
  safeEqual,
  isAuthed,
  signToken,
  cookieHeader,
  sameOrigin
} = require('./_lib/admin-auth');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    return json(res, 200, {
      configured: adminConfigured(),
      authenticated: isAuthed(req)
    });
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', cookieHeader('', true, req));
    return json(res, 200, { ok: true });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!adminConfigured()) {
    return json(res, 503, {
      error: 'Add an admin password to open the dashboard.',
      configured: false
    });
  }

  if (!sameOrigin(req)) {
    return json(res, 403, { error: 'This request is not allowed.' });
  }

  try {
    const body = await readJsonBody(req);
    const password = String((body && body.password) || '');
    if (!safeEqual(password, adminPassword())) {
      return json(res, 401, { error: 'Wrong password.' });
    }
    res.setHeader('Set-Cookie', cookieHeader(signToken(), false, req));
    return json(res, 200, { ok: true, authenticated: true });
  } catch (error) {
    return json(res, error.statusCode || 400, { error: error.message || 'Unable to sign in.' });
  }
};
