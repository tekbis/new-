const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { requireAdmin } = require('./_lib/admin-auth');
const { readRawBody, json } = require('./_lib/http');

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
};

function extensionFor(buffer, mime) {
  let magic = '';
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) magic = '.jpg';
  else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) magic = '.png';
  else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) magic = '.gif';
  else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45) magic = '.webp';
  if (!magic) return '';
  if (mime && TYPES[mime] && TYPES[mime] !== magic) return '';
  return magic;
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!requireAdmin(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const mime = String((req.headers && req.headers['content-type']) || '').split(';')[0].trim().toLowerCase();
    const buffer = await readRawBody(req, MAX_BYTES);
    if (!buffer.length) {
      return json(res, 400, { error: 'Choose an image to upload.' });
    }
    const ext = extensionFor(buffer, mime);
    if (!ext) {
      return json(res, 400, { error: 'Use a JPG, PNG, WEBP, or GIF image.' });
    }

    const folder = path.join(__dirname, '../assets/images/products');
    fs.mkdirSync(folder, { recursive: true });
    const filename = Date.now() + '-' + crypto.randomBytes(8).toString('hex') + ext;
    fs.writeFileSync(path.join(folder, filename), buffer);
    return json(res, 201, { src: 'assets/images/products/' + filename });
  } catch (error) {
    const status = error.statusCode || 500;
    return json(res, status, { error: status === 413 ? 'Image must be 5MB or smaller.' : (status < 500 ? error.message : 'Unable to upload image.') });
  }
}

handler.config = { api: { bodyParser: false } };
module.exports = handler;
