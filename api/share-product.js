const fs = require('fs');
const path = require('path');
const { html } = require('./_lib/http');
const { loadState } = require('./_lib/catalog-store');
const { SITE, DEFAULT_IMAGE, injectShareMeta } = require('./_lib/og');

const PAGE_PATH = path.join(__dirname, '../views/product.html');

function requestUrl(req) {
  const host = String((req.headers && req.headers.host) || 'www.zander88llc.net');
  const proto = String((req.headers && (req.headers['x-forwarded-proto'] || req.headers['x-forwarded-protocol'])) || '').split(',')[0].trim();
  const protocol = proto === 'http' ? 'http' : 'https';
  try {
    return new URL(req.url, protocol + '://' + host);
  } catch (error) {
    return new URL(SITE + '/product.html');
  }
}

function slugFrom(req, url) {
  const fromQuery = String((req.query && req.query.slug) || url.searchParams.get('slug') || '').trim();
  if (fromQuery) return decodeURIComponent(fromQuery.replace(/^\/+|\/+$/g, ''));
  const marker = '/product-page/';
  const at = url.pathname.indexOf(marker);
  if (at !== -1) return decodeURIComponent(url.pathname.slice(at + marker.length).replace(/\/+$/, ''));
  return '';
}

function findProduct(products, req, url) {
  const id = Number((req.query && req.query.id) || url.searchParams.get('id'));
  if (Number.isInteger(id) && id > 0) {
    const match = products.find(function (item) { return Number(item.id) === id; });
    if (match) return match;
  }
  const slug = slugFrom(req, url).toLowerCase();
  if (!slug) return null;
  return products.find(function (item) {
    const itemUrl = String(item.url || '').toLowerCase();
    return itemUrl.indexOf('/product-page/' + slug) !== -1 || itemUrl.split('/').pop() === slug;
  }) || null;
}

function priceText(product) {
  if (product && product.price != null && Number.isFinite(Number(product.price))) {
    return '$' + Number(product.price).toFixed(2);
  }
  return '';
}

module.exports = async function handler(req, res) {
  const page = fs.readFileSync(PAGE_PATH, 'utf8');
  let meta = {
    title: 'Zander88LLC Product',
    description: 'Shop curated products from Zander88LLC.',
    url: SITE + '/product.html',
    image: DEFAULT_IMAGE,
    type: 'website'
  };

  try {
    const url = requestUrl(req);
    const state = await loadState();
    const product = findProduct(state.products || [], req, url);
    if (product) {
      const price = priceText(product);
      meta = {
        title: product.name + ' | Zander88LLC',
        description: price
          ? ('Shop ' + product.name + ' from Zander88LLC for ' + price + '.')
          : ('Shop ' + product.name + ' from Zander88LLC.'),
        url: SITE + '/product.html?id=' + product.id,
        image: product.image || DEFAULT_IMAGE,
        type: 'product'
      };
    }
  } catch (error) { /* Keep the default share image if the catalog is unavailable. */ }

  return html(res, 200, injectShareMeta(page, meta));
};
