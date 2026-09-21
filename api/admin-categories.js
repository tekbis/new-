const { readJsonBody, json } = require('./_lib/http');
const { requireAdmin } = require('./_lib/admin-auth');
const { addCategory, deleteCategory, catalogStats } = require('./_lib/catalog-store');

function payload(saved) {
  const stats = catalogStats(saved.products, saved.categories);
  return {
    products: saved.products,
    stats: stats,
    categories: stats.categoryList,
    persisted: saved.persisted
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!requireAdmin(req, res)) return;

  try {
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const saved = await addCategory(body && body.name, body && body.image);
      return json(res, 201, payload(saved));
    }

    if (req.method === 'DELETE') {
      const body = req.headers['content-type'] && String(req.headers['content-type']).indexOf('json') !== -1
        ? await readJsonBody(req)
        : {};
      const name = String((req.query && req.query.name) || (body && body.name) || '');
      const saved = await deleteCategory(name);
      return json(res, 200, payload(saved));
    }

    res.setHeader('Allow', 'POST, DELETE');
    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    return json(res, error.statusCode || 500, { error: error.message || 'Unable to update categories.' });
  }
};
