const MAX_JSON_BYTES = 256 * 1024;

function applySecurityHeaders(res) {
  if (!res || typeof res.setHeader !== 'function') return;
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function tooLarge() {
  const err = new Error('Request is too large.');
  err.statusCode = 413;
  throw err;
}

function bufferFromBody(body) {
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === 'string') return Buffer.from(body);
  if (body && body.type === 'Buffer' && Array.isArray(body.data)) return Buffer.from(body.data);
  return null;
}

async function readRawBody(req, maxBytes) {
  const limit = Number(maxBytes) > 0 ? Number(maxBytes) : MAX_JSON_BYTES;
  const contentLength = Number(req && req.headers && req.headers['content-length']);
  if (Number.isFinite(contentLength) && contentLength > limit) tooLarge();

  if (req && req.body != null) {
    const buffer = bufferFromBody(req.body);
    if (buffer) {
      if (buffer.length > limit) tooLarge();
      return buffer;
    }
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk);
    if (size > limit) tooLarge();
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function readJsonBody(req) {
  try {
    if (req.body != null && typeof req.body === 'object' && !Buffer.isBuffer(req.body) && !(req.body.type === 'Buffer')) {
      const encoded = Buffer.byteLength(JSON.stringify(req.body));
      if (encoded > MAX_JSON_BYTES) tooLarge();
      return req.body;
    }
    const raw = (await readRawBody(req, MAX_JSON_BYTES)).toString('utf8');
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    if (error && error.statusCode) throw error;
    const err = new Error('Invalid request.');
    err.statusCode = 400;
    throw err;
  }
}

function json(res, status, payload) {
  applySecurityHeaders(res);
  if (typeof res.setHeader === 'function') res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(payload);
}

function clientMessage(error, fallback) {
  const message = error && error.message ? String(error.message) : '';
  const status = Number(error && error.statusCode) || 0;
  if (status >= 400 && status < 500 && message && message.length <= 180) return message;
  if (/^(Your cart|One or more items|Invalid shipping|Order total|Too many|Enter |Add |Choose |Use |Wrong |Please |This request|Missing |PayPal payment)/i.test(message)) {
    return message;
  }
  return fallback || 'Request failed.';
}

module.exports = {
  MAX_JSON_BYTES: MAX_JSON_BYTES,
  applySecurityHeaders: applySecurityHeaders,
  readJsonBody: readJsonBody,
  readRawBody: readRawBody,
  json: json,
  clientMessage: clientMessage
};
