const crypto = require('crypto');

const COOKIE = 'z88_admin';
const MAX_AGE = 60 * 60 * 24 * 7;

function looksLikePlaceholder(value) {
  return /your_|example|placeholder|changeme|dummy|change_this|^admin$|^password$/i.test(String(value || ''));
}

function adminPassword() {
  return String(process.env.ADMIN_PASSWORD || '').trim();
}

function adminConfigured() {
  const password = adminPassword();
  return password.length >= 8 && !looksLikePlaceholder(password);
}

function signingSecret() {
  return adminPassword() + '|zander88-admin';
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  if (a.length !== b.length) {
    crypto.timingSafeEqual(a, Buffer.alloc(a.length));
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function cookieValue(req) {
  const header = String((req && req.headers && req.headers.cookie) || '');
  const parts = header.split(';');
  for (let i = 0; i < parts.length; i += 1) {
    const piece = parts[i].trim();
    if (piece.indexOf(COOKIE + '=') === 0) {
      return decodeURIComponent(piece.slice(COOKIE.length + 1));
    }
  }
  return '';
}

function signToken() {
  const payload = Buffer.from(JSON.stringify({
    t: Date.now(),
    v: 1
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', signingSecret()).update(payload).digest('base64url');
  return payload + '.' + sig;
}

function tokenValid(token) {
  const raw = String(token || '');
  const split = raw.split('.');
  if (split.length !== 2) return false;
  const expected = crypto.createHmac('sha256', signingSecret()).update(split[0]).digest('base64url');
  if (!safeEqual(split[1], expected)) return false;
  try {
    const payload = JSON.parse(Buffer.from(split[0], 'base64url').toString('utf8'));
    return Number(payload.t) > Date.now() - (MAX_AGE * 1000);
  } catch (error) {
    return false;
  }
}

function isAuthed(req) {
  return adminConfigured() && tokenValid(cookieValue(req));
}

function sameOrigin(req) {
  const host = String((req.headers && req.headers.host) || '');
  const origin = String((req.headers && req.headers.origin) || '');
  const referer = String((req.headers && req.headers.referer) || '');
  if (!host) return false;
  const allowed = ['https://' + host, 'http://' + host];
  if (origin) return allowed.indexOf(origin) !== -1;
  if (referer) return allowed.some(function (item) { return referer.indexOf(item + '/') === 0 || referer === item; });
  return true;
}

function cookieHeader(token, clear, req) {
  const proto = String((req && req.headers && req.headers['x-forwarded-proto']) || '');
  const secure = proto === 'https' ? '; Secure' : '';
  if (clear) {
    return COOKIE + '=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax' + secure;
  }
  return COOKIE + '=' + encodeURIComponent(token) + '; HttpOnly; Path=/; Max-Age=' + MAX_AGE + '; SameSite=Lax' + secure;
}

function requireAdmin(req, res) {
  if (!adminConfigured()) {
    res.status(503).json({
      error: 'Add an admin password to open the dashboard.',
      configured: false
    });
    return false;
  }
  if (!isAuthed(req)) {
    res.status(401).json({ error: 'Please sign in.', configured: true });
    return false;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD' && !sameOrigin(req)) {
    res.status(403).json({ error: 'This request is not allowed.' });
    return false;
  }
  return true;
}

module.exports = {
  adminConfigured: adminConfigured,
  adminPassword: adminPassword,
  safeEqual: safeEqual,
  isAuthed: isAuthed,
  requireAdmin: requireAdmin,
  signToken: signToken,
  cookieHeader: cookieHeader,
  sameOrigin: sameOrigin
};
