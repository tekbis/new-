const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');

const ROOT = __dirname;
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
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
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
    const value = trimmed.slice(split + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  });
}

function wrapRes(res) {
  const headers = {};
  return {
    setHeader: function (key, value) { headers[key] = value; },
    status: function (code) {
      return {
        json: function (payload) {
          const body = Buffer.from(JSON.stringify(payload));
          headers['Content-Type'] = 'application/json; charset=utf-8';
          headers['Content-Length'] = String(body.length);
          res.writeHead(code, headers);
          res.end(body);
        }
      };
    }
  };
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, function (error, data) {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function safeFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const relative = clean === '/' ? 'index.html' : clean.replace(/^\//, '');
  const resolved = path.normalize(path.join(ROOT, relative));
  if (resolved.indexOf(ROOT) !== 0) return null;
  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
  if (fs.existsSync(resolved + '.html') && fs.statSync(resolved + '.html').isFile()) return resolved + '.html';
  return null;
}

loadEnv();

const server = http.createServer(async function (req, res) {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  req.query = Object.fromEntries(url.searchParams.entries());

  if (url.pathname.indexOf('/api/') === 0) {
    const name = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
    if (!/^[a-z0-9-]+$/i.test(name)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }
    const file = path.join(ROOT, 'api', name + '.js');
    if (!fs.existsSync(file)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }
    try {
      const handler = require(file);
      await handler(req, wrapRes(res));
    } catch (error) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Server error' }));
      }
    }
    return;
  }

  if (url.pathname === '/index.html') {
    res.writeHead(302, { Location: '/' + url.search });
    res.end();
    return;
  }

  if (url.pathname === '/admin') {
    sendFile(res, path.join(ROOT, 'admin.html'));
    return;
  }

  const filePath = safeFile(url.pathname);
  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
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
