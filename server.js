const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');
const { applySecurityHeaders } = require('./api/_lib/http');

const ROOT = path.resolve(__dirname);
const PORT = Number(process.env.PORT || 8087);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach(function (line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.charAt(0) === '#') return;
    const split = trimmed.indexOf('=');
    if (split < 1) return;
    const key = trimmed.slice(0, split).trim();
    if (!/^[A-Z0-9_]+$/.test(key)) return;
    const value = trimmed.slice(split + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  });
}

function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  };
}

function wrapRes(res) {
  const headers = securityHeaders();
  const write = function (code, payload, contentType) {
    const body = Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload));
    headers['Content-Type'] = contentType || 'application/json; charset=utf-8';
    headers['Content-Length'] = String(body.length);
    if (!res.headersSent) res.writeHead(code, headers);
    res.end(body);
  };
  return {
    setHeader: function (key, value) { headers[key] = value; },
    status: function (code) {
      return {
        json: function (payload) { write(code, payload, 'application/json; charset=utf-8'); },
        send: function (payload) {
          const type = headers['Content-Type'] || (typeof payload === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8');
          write(code, payload, type);
        }
      };
    }
  };
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, function (error, data) {
    if (error) {
      res.writeHead(404, Object.assign(securityHeaders(), { 'Content-Type': 'text/plain; charset=utf-8' }));
      res.end('Not found');
      return;
    }
    const headers = Object.assign(securityHeaders(), {
      'Content-Type': TYPES[ext] || 'application/octet-stream'
    });
    if (path.basename(filePath) === 'admin.html') headers['X-Frame-Options'] = 'DENY';
    res.writeHead(200, headers);
    res.end(data);
  });
}

function isPublicPath(rel) {
  const name = String(rel || '').replace(/\\/g, '/');
  if (!name || name.indexOf('\0') !== -1 || name.startsWith('.') || name.indexOf('/.') !== -1) return false;
  if (name === 'robots.txt' || name === 'favicon.ico') return true;
  if (/^[a-z0-9._-]+\.html$/i.test(name)) return true;
  if (name.indexOf('assets/') === 0) {
    return /\.(css|js|png|jpe?g|webp|gif|svg|ico|woff2?|ttf)$/i.test(name);
  }
  return false;
}

function safeFile(urlPath) {
  let clean;
  try {
    clean = decodeURIComponent(String(urlPath || '').split('?')[0]);
  } catch (error) {
    return null;
  }
  const relative = clean === '/' ? 'index.html' : clean.replace(/^\/+/, '');
  const resolved = path.resolve(ROOT, relative);
  if (resolved !== ROOT && resolved.indexOf(ROOT + path.sep) !== 0) return null;
  const rel = path.relative(ROOT, resolved);
  if (!isPublicPath(rel)) return null;
  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
  if (fs.existsSync(resolved + '.html') && isPublicPath(rel + '.html') && fs.statSync(resolved + '.html').isFile()) {
    return resolved + '.html';
  }
  return null;
}

loadEnv();

const server = http.createServer(async function (req, res) {
  applySecurityHeaders(res);
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  req.query = Object.fromEntries(url.searchParams.entries());

  if (url.pathname.indexOf('/api/') === 0) {
    const name = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
    if (!/^[a-z0-9-]+$/i.test(name)) {
      res.writeHead(404, Object.assign(securityHeaders(), { 'Content-Type': 'application/json' }));
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }
    const file = path.join(ROOT, 'api', name + '.js');
    if (!fs.existsSync(file) || path.dirname(file) !== path.join(ROOT, 'api')) {
      res.writeHead(404, Object.assign(securityHeaders(), { 'Content-Type': 'application/json' }));
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }
    try {
      const handler = require(file);
      await handler(req, wrapRes(res));
    } catch (error) {
      if (!res.headersSent) {
        res.writeHead(500, Object.assign(securityHeaders(), { 'Content-Type': 'application/json' }));
        res.end(JSON.stringify({ error: 'Server error' }));
      }
    }
    return;
  }

  if (url.pathname === '/index.html') {
    res.writeHead(302, Object.assign(securityHeaders(), { Location: '/' + url.search }));
    res.end();
    return;
  }

  if (url.pathname === '/checkout.html') {
    res.writeHead(302, Object.assign(securityHeaders(), { Location: '/checkout' + url.search }));
    res.end();
    return;
  }

  if (url.pathname === '/about.html') {
    res.writeHead(302, Object.assign(securityHeaders(), { Location: '/about' + url.search }));
    res.end();
    return;
  }

  if (url.pathname === '/admin') {
    sendFile(res, path.join(ROOT, 'admin.html'));
    return;
  }

  if (url.pathname === '/checkout') {
    sendFile(res, path.join(ROOT, 'checkout.html'));
    return;
  }

  if (url.pathname === '/about') {
    sendFile(res, path.join(ROOT, 'about.html'));
    return;
  }

  if (url.pathname === '/product.html' || url.pathname.indexOf('/product-page/') === 0) {
    if (url.pathname.indexOf('/product-page/') === 0) {
      req.query.slug = decodeURIComponent(url.pathname.slice('/product-page/'.length).replace(/\/+$/, ''));
    }
    try {
      const handler = require('./api/share-product');
      await handler(req, wrapRes(res));
    } catch (error) {
      if (!res.headersSent) {
        res.writeHead(500, Object.assign(securityHeaders(), { 'Content-Type': 'text/plain; charset=utf-8' }));
        res.end('Server error');
      }
    }
    return;
  }

  const filePath = safeFile(url.pathname);
  if (!filePath) {
    res.writeHead(404, Object.assign(securityHeaders(), { 'Content-Type': 'text/plain; charset=utf-8' }));
    res.end('Not found');
    return;
  }
  sendFile(res, filePath);
});

const { adminConfigured } = require('./api/_lib/admin-auth');

server.on('error', function (error) {
  if (error && error.code === 'EADDRINUSE') {
    console.error('Port ' + PORT + ' is already in use.');
    console.error('The server is already running. Open http://localhost:' + PORT + '/admin.html');
    console.error('Or close the old terminal and run: node server.js');
    process.exit(1);
  }
  throw error;
});

server.listen(PORT, function () {
  console.log('Zander88LLC local server: http://localhost:' + PORT);
  console.log('Admin dashboard: http://localhost:' + PORT + '/admin.html');
  if (adminConfigured()) {
    console.log('Admin password loaded from .env');
  } else {
    console.log('Admin password missing. Put ADMIN_PASSWORD in the .env file, not .env.example');
  }
});
