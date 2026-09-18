const { readJsonBody, json } = require('./_lib/http');
const { requireAdmin } = require('./_lib/admin-auth');
const {
  loadState,
  saveCatalog,
  normalizeProduct,
  catalogStats
} = require('./_lib/catalog-store');

function requestId(req, body) {
  const query = Number(req.query && (req.query.id || req.query.productId));
  if (Number.isInteger(query) && query > 0) return query;
  const fromBody = Number(body && body.id);
  if (Number.isInteger(fromBody) && fromBody > 0) return fromBody;
  return 0;
}

function payload(products, extra) {
  const categories = (extra && extra.categories) || catalogStats(products).categoryList;
  const stats = catalogStats(products, categories);
  return Object.assign({
    products: products,
    stats: stats,
    categories: stats.categoryList
  }, extra || {});
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!requireAdmin(req, res)) return;

  try {
    const state = await loadState();
    const products = state.products;

    if (req.method === 'GET') {
      return json(res, 200, payload(products, { categories: state.categories }));
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const nextId = catalogStats(products).nextId;
      const product = normalizeProduct(body, body && body.id ? body.id : nextId);
      if (products.some(function (item) { return Number(item.id) === product.id; })) {
        return json(res, 409, { error: 'A product with this id already exists.' });
      }
      products.push(product);
      const saved = await saveCatalog(products);
      return json(res, 201, payload(saved.products, { product: product, persisted: saved.persisted, categories: saved.categories }));
    }

    if (req.method === 'PUT') {
      const body = await readJsonBody(req);
      const id = requestId(req, body);
      const index = products.findIndex(function (item) { return Number(item.id) === id; });
      if (index < 0) return json(res, 404, { error: 'Product not found.' });
      const product = normalizeProduct(Object.assign({}, products[index], body, { id: id }), id);
      products[index] = product;
      const saved = await saveCatalog(products);
      return json(res, 200, payload(saved.products, { product: product, persisted: saved.persisted, categories: saved.categories }));
    }

    if (req.method === 'DELETE') {
      const body = req.headers['content-type'] && String(req.headers['content-type']).indexOf('json') !== -1
        ? await readJsonBody(req)
        : {};
      const id = requestId(req, body);
      const next = products.filter(function (item) { return Number(item.id) !== id; });
      if (next.length === products.length) return json(res, 404, { error: 'Product not found.' });
      if (!next.length) return json(res, 400, { error: 'Catalog cannot be empty.' });
      const saved = await saveCatalog(next);
      return json(res, 200, payload(saved.products, { persisted: saved.persisted, categories: saved.categories }));
    }

    res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    const status = error.statusCode || 500;
    return json(res, status, { error: error.message || 'Unable to update the catalog.' });
  }
};
