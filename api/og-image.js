const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../assets/og-share.jpg');

function sendJpeg(res, buf) {
  if (typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', String(buf.length));
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
  }
  if (typeof res.status === 'function') {
    const reply = res.status(200);
    if (reply && typeof reply.send === 'function') return reply.send(buf);
  }
  if (typeof res.end === 'function') {
    res.statusCode = 200;
    return res.end(buf);
  }
}

async function handler(req, res) {
  if (req.method !== 'HEAD' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, HEAD');
    if (typeof res.status === 'function') return res.status(405).json({ error: 'Method not allowed' });
    res.statusCode = 405;
    return res.end('Method not allowed');
  }
  const buf = fs.readFileSync(FILE);
  if (req.method === 'HEAD') {
    if (typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Length', String(buf.length));
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Disposition', 'inline');
    }
    if (typeof res.status === 'function') {
      const reply = res.status(200);
      if (reply && typeof reply.send === 'function') return reply.send(Buffer.alloc(0));
    }
    if (typeof res.end === 'function') {
      res.statusCode = 200;
      return res.end();
    }
    return;
  }
  return sendJpeg(res, buf);
}

module.exports = handler;
