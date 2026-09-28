const crypto = require('crypto');
const { json } = require('./http');

const COOKIE = 'z88_admin';
const MAX_AGE = 60 * 60 * 24 * 7;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX = 8;
const loginAttempts = new Map();

function looksLikePlaceholder(value) {
  return /your_|example|placeholder|changeme|dummy|change_this|^admin$|^password$|^asdf1234$|^12345678$|^password123$/i.test(String(value || ''));
}

function adminPassword() {
  return String(process.env.ADMIN_PASSWORD || '').trim();
}

function adminConfigured() {
  const password = adminPassword();
  return password.length >= 8 && !looksLikePlaceholder(password);
}

function signingSecret() {
  const extra = String(process.env.ADMIN_SESSION_SECRET || '').trim();
  return (extra || adminPassword()) + '|zander88-admin';
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
      try {
        return decodeURIComponent(piece.slice(COOKIE.length + 1));
      } catch (error) {
        return '';
      }
    }
  }
  return '';
}

function signToken() {
  const payload = Buffer.from(JSON.stringify({
    t: Date.now(),
    n: crypto.randomBytes(8).toString('hex'),
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
    return Number(payload.v) === 1 && Number(payload.t) > Date.now() - (MAX_AGE * 1000);
  } catch (error) {
    return false;
  }
}

function isAuthed(req) {
  return adminConfigured() && tokenValid(cookieValue(req));
}

function requestHost(req) {
  return String((req.headers && req.headers.host) || '').split(',')[0].trim().toLowerCase();
}

function originAllowed(value, host) {
  if (!value || !host) return false;
  try {
    const parsed = new URL(value);
    return parsed.origin === 'https://' + host || parsed.origin === 'http://' + host;
  } catch (error) {
    return false;
  }
}

function sameOrigin(req) {
  const host = requestHost(req);
  const origin = String((req.headers && req.headers.origin) || '').trim();
  const referer = String((req.headers && req.headers.referer) || '').trim();
  if (!host) return false;
  if (origin) return originAllowed(origin, host);
  if (referer) return originAllowed(referer, host);
  return false;
}

function isHttps(req) {
  const proto = String((req && req.headers && req.headers['x-forwarded-proto']) || '').split(',')[0].trim().toLowerCase();
  return proto === 'https';
}

function cookieHeader(token, clear, req) {
  const secure = isHttps(req) ? '; Secure' : '';
  if (clear) {
    return COOKIE + '=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict' + secure;
  }
  return COOKIE + '=' + encodeURIComponent(token) + '; HttpOnly; Path=/; Max-Age=' + MAX_AGE + '; SameSite=Strict' + secure;
}

function clientIp(req) {
  const forwarded = String((req.headers && req.headers['x-forwarded-for']) || '').split(',')[0].trim();
  return forwarded || String((req.headers && req.headers['x-real-ip']) || '') || 'local';
}

function pruneLogins(now) {
  if (loginAttempts.size < 200) return;
  loginAttempts.forEach(function (record, ip) {
    if (now - record.start > LOGIN_WINDOW_MS) loginAttempts.delete(ip);
  });
}

function loginAllowed(req) {
  const now = Date.now();
  pruneLogins(now);
  const ip = clientIp(req);
  const rec = loginAttempts.get(ip);
  if (!rec || now - rec.start > LOGIN_WINDOW_MS) return true;
  return rec.count < LOGIN_MAX;
}

function loginFailed(req) {
  const now = Date.now();
  const ip = clientIp(req);
  const rec = loginAttempts.get(ip);
  if (!rec || now - rec.start > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, start: now });
    return;
  }
  rec.count += 1;
  loginAttempts.set(ip, rec);
}

function loginSucceeded(req) {
  loginAttempts.delete(clientIp(req));
}

function requireAdmin(req, res) {
  if (!adminConfigured()) {
    json(res, 503, {
      error: 'Add an admin password to open the dashboard.',
      configured: false
    });
    return false;
  }
  if (!isAuthed(req)) {
    json(res, 401, { error: 'Please sign in.', configured: true });
    return false;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD' && !sameOrigin(req)) {
    json(res, 403, { error: 'This request is not allowed.' });
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
  sameOrigin: sameOrigin,
  loginAllowed: loginAllowed,
  loginFailed: loginFailed,
  loginSucceeded: loginSucceeded
};
