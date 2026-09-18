const { json } = require('./_lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const { loadState } = require('./_lib/catalog-store');
    const state = await loadState();
    res.setHeader('Cache-Control', 'no-store');
    return json(res, 200, { products: state.products, categories: state.categories });
  } catch (error) {
    return json(res, 500, { error: 'Catalog is unavailable.' });
  }
};
