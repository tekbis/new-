const fs = require('fs');
const os = require('os');
const path = require('path');

const JSON_PATH = path.join(__dirname, '../../data/catalog.json');
const JS_PATH = path.join(__dirname, '../../assets/catalog-data.js');
const TMP_PATH = path.join(os.tmpdir(), 'zander88-catalog.json');

let memoryState = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function seedCatalog() {
  const seed = require('../../assets/catalog-data.js');
  if (Array.isArray(seed)) return clone(seed);
  if (seed && Array.isArray(seed.default)) return clone(seed.default);
  throw new Error('Catalog could not be loaded.');
}

const DEFAULT_CATEGORY_IMAGES = {
  Clothing: 'assets/category-hi/tile-00.webp',
  Electronics: 'assets/category-hi/tile-01.webp',
  FRAGRANCE: 'assets/category-hi/tile-02.webp',
  'HANDBAG/PURSES': 'assets/category-hi/tile-03.webp',
  'TRAVEL/LUGGAGE': 'assets/category-hi/tile-14.webp',
  HOUSEHOLD: 'assets/category-hi/tile-04.webp',
  JEWELRY: 'assets/category-hi/tile-05.webp',
  'KIDS/BABIES': 'assets/category-hi/tile-06.webp',
  'LAWN/GARDEN': 'assets/category-hi/tile-07.webp',
  "MEN'CLOTHING": 'assets/category-hi/tile-08.webp',
  SHOES: 'assets/category-hi/tile-09.webp',
  'TOOLS/HARDWARE': 'assets/category-hi/tile-10.webp',
  TOYS: 'assets/category-hi/tile-11.webp',
  'WATCHES MAN/WOMAN': 'assets/category-hi/tile-12.webp',
  "WOMEN'SCLOTHING": 'assets/category-hi/tile-13.webp'
};

function categoryName(item) {
  if (typeof item === 'string') return String(item || '').trim();
  return String((item && item.name) || '').trim();
}

function categoryImage(item) {
  if (typeof item === 'string') return DEFAULT_CATEGORY_IMAGES[item] || '';
  return String((item && item.image) || '').trim() || DEFAULT_CATEGORY_IMAGES[categoryName(item)] || '';
}

function serializeCategory(item) {
  const name = categoryName(item);
  if (!name) return null;
  const image = categoryImage(item);
  return image ? { name: name, image: image } : { name: name };
}

function categoriesFromProducts(products) {
  return Array.from(new Set((products || []).map(function (item) {
    return String((item && item.cat) || '').trim();
  }).filter(Boolean)));
}

function mergeCategories(extra, products) {
  const map = {};
  function add(item) {
    const record = serializeCategory(item);
    if (!record) return;
    if (!map[record.name]) {
      map[record.name] = record;
      return;
    }
    if (record.image && !map[record.name].image) map[record.name].image = record.image;
  }
  (extra || []).forEach(add);
  categoriesFromProducts(products).forEach(add);
  return Object.keys(map).sort(function (a, b) {
    return a.localeCompare(b);
  }).map(function (name) {
    return map[name];
  });
}

function normalizeCategoryName(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 40) {
    const err = new Error('Enter a category name between 2 and 40 characters.');
    err.statusCode = 400;
    throw err;
  }
  return name;
}

function normalizeCategoryImage(value, required) {
  const src = String(value || '').trim();
  if (!src) {
    if (required) {
      const err = new Error('Add a category image.');
      err.statusCode = 400;
      throw err;
    }
    return '';
  }
  if (src.length > 2000 || /[\s<>'"]/.test(src) || /^(javascript|data):/i.test(src) || !/^(assets\/|https?:\/\/)/i.test(src)) {
    const err = new Error('Use a valid category image.');
    err.statusCode = 400;
    throw err;
  }
  return src;
}

function readCatalogDocument(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (Array.isArray(parsed) && parsed.length) {
      return { products: parsed, categories: categoriesFromProducts(parsed) };
    }
    if (parsed && Array.isArray(parsed.products) && parsed.products.length) {
      return {
        products: parsed.products,
        categories: mergeCategories(parsed.categories, parsed.products)
      };
    }
  } catch (error) { /* Ignore unreadable overlay files. */ }
  return null;
}

function writeCatalogDocument(filePath, products, categories) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({
    products: products,
    categories: categories
  }, null, 2) + '\n', 'utf8');
}

function writeCatalogJs(products) {
  const stamp = new Date().toISOString().slice(0, 10);
  const body = [
    '/* Snapshot of Zander88LLC public catalog, ' + stamp + '. Images are served by the source store\'s Wix CDN. */',
    'var ZanderCatalog = ' + JSON.stringify(products, null, 2) + ';',
    'if (typeof window !== \'undefined\') window.ZanderCatalog = ZanderCatalog;',
    'if (typeof module !== \'undefined\' && module.exports) module.exports = ZanderCatalog;',
    ''
  ].join('\n');
  fs.writeFileSync(JS_PATH, body, 'utf8');
}

function optionalText(value, max) {
  const text = String(value == null ? '' : value).trim();
  if (!text) return '';
  return text.slice(0, max || 4000);
}

function normalizeImages(input, name) {
  let list = [];
  if (Array.isArray(input && input.images)) {
    list = input.images.map(function (image) {
      const src = String((typeof image === 'string' ? image : image && image.src) || '').trim();
      if (!src || src.length > 2000) return null;
      return {
        src: src,
        alt: optionalText((image && image.alt) || name, 180) || name
      };
    }).filter(Boolean);
  }
  const fallback = String((input && input.image) || '').trim();
  if (!list.length && fallback) {
    list = [{ src: fallback, alt: name }];
  }
  if (!list.length) {
    const err = new Error('Add at least one product image.');
    err.statusCode = 400;
    throw err;
  }
  return list.slice(0, 8);
}

function normalizeHighlights(value) {
  if (Array.isArray(value)) {
    return value.map(function (item) { return String(item || '').trim(); }).filter(Boolean).slice(0, 8);
  }
  return String(value || '').split(/\r?\n/).map(function (item) { return item.trim(); }).filter(Boolean).slice(0, 8);
}

function normalizeSpecs(value) {
  if (Array.isArray(value)) {
    return value.map(function (row) {
      if (Array.isArray(row)) return [String(row[0] || '').trim(), String(row[1] || '').trim()];
      return [String((row && row[0]) || (row && row.label) || '').trim(), String((row && row[1]) || (row && row.value) || '').trim()];
    }).filter(function (row) { return row[0] && row[1]; }).slice(0, 8);
  }
  return String(value || '').split(/\r?\n/).map(function (line) {
    const parts = line.split('|');
    return [String(parts[0] || '').trim(), String(parts.slice(1).join('|') || '').trim()];
  }).filter(function (row) { return row[0] && row[1]; }).slice(0, 8);
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'product';
}

function normalizeProduct(input, fallbackId) {
  const name = String((input && input.name) || '').trim();
  if (name.length < 2 || name.length > 180) {
    const err = new Error('Enter a product name.');
    err.statusCode = 400;
    throw err;
  }

  const rawPrice = input && input.price;
  const hasPrice = rawPrice !== '' && rawPrice != null;
  const price = hasPrice ? Number(rawPrice) : null;
  if (hasPrice && (!Number.isFinite(price) || price < 0 || price > 100000)) {
    const err = new Error('Enter a valid price.');
    err.statusCode = 400;
    throw err;
  }

  const images = normalizeImages(input, name);
  const image = images[0].src;

  const cat = String((input && input.cat) || '').trim();
  if (!cat) {
    const err = new Error('Choose a category.');
    err.statusCode = 400;
    throw err;
  }

  let extraCats = [];
  if (Array.isArray(input && input.cats)) {
    extraCats = input.cats.map(function (item) { return String(item || '').trim(); }).filter(Boolean);
  } else {
    extraCats = String((input && input.cats) || '')
      .split(/[|,]/)
      .map(function (item) { return item.trim(); })
      .filter(Boolean);
  }
  const cats = extraCats.length ? extraCats : [cat];
  if (cats.indexOf(cat) === -1) cats.unshift(cat);

  const stock = Boolean(input && input.stock) && price != null;
  const id = Number((input && input.id) || fallbackId);
  if (!Number.isInteger(id) || id < 1) {
    const err = new Error('Invalid product id.');
    err.statusCode = 400;
    throw err;
  }

  const url = String((input && input.url) || '').trim() ||
    ('https://www.zander88llc.net/product-page/' + slugify(name));
  const ratingRaw = Number(input && input.rating);
  const reviewsRaw = parseInt(input && input.reviews, 10);
  const product = {
    cat: cat,
    cats: cats,
    id: id,
    image: image,
    name: name,
    price: stock ? price : (price == null ? null : price),
    stock: stock,
    url: url
  };
  if (Array.isArray(input && input.images) && input.images.length) product.images = images;
  const shortName = optionalText(input && input.shortName, 80);
  const collection = optionalText(input && input.collection, 80);
  const itemCode = optionalText(input && input.itemCode, 40);
  const intro = optionalText(input && input.intro, 600);
  const description = optionalText(input && input.description, 4000);
  const highlights = normalizeHighlights(input && input.highlights);
  const specs = normalizeSpecs(input && input.specs);
  if (shortName) product.shortName = shortName;
  if (collection) product.collection = collection;
  if (itemCode) product.itemCode = itemCode;
  if (intro) product.intro = intro;
  if (description) product.description = description;
  if (highlights.length) product.highlights = highlights;
  if (specs.length) product.specs = specs;
  if (Number.isFinite(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5) {
    product.rating = ratingRaw.toFixed(1);
  }
  if (Number.isInteger(reviewsRaw) && reviewsRaw >= 0 && reviewsRaw <= 9999) {
    product.reviews = String(reviewsRaw);
  }
  return product;
}

function catalogStats(products, categories) {
  const inStock = products.filter(function (item) {
    return item.stock && item.price != null;
  });
  const categoryList = mergeCategories(categories, products);
  const inventoryValue = inStock.reduce(function (sum, item) {
    return sum + Number(item.price || 0);
  }, 0);
  const nextId = products.reduce(function (max, item) {
    return Math.max(max, Number(item.id) || 0);
  }, 1000) + 1;

  return {
    total: products.length,
    inStock: inStock.length,
    outOfStock: products.length - inStock.length,
    categories: categoryList.length,
    categoryList: categoryList,
    inventoryValue: Math.round(inventoryValue * 100) / 100,
    nextId: nextId
  };
}

async function loadState() {
  if (memoryState && Array.isArray(memoryState.products) && memoryState.products.length) {
    return clone(memoryState);
  }
  const overlay = readCatalogDocument(JSON_PATH) || readCatalogDocument(TMP_PATH);
  const products = overlay && overlay.products && overlay.products.length ? overlay.products : seedCatalog();
  const categories = mergeCategories(overlay && overlay.categories, products);
  memoryState = { products: clone(products), categories: categories };
  return clone(memoryState);
}

async function loadCatalog() {
  const state = await loadState();
  return clone(state.products);
}

async function saveState(products, categories) {
  if (!Array.isArray(products) || !products.length) {
    const err = new Error('Catalog cannot be empty.');
    err.statusCode = 400;
    throw err;
  }

  const normalized = products.map(function (item, index) {
    return normalizeProduct(item, item && item.id ? item.id : 1001 + index);
  });
  const ids = new Set();
  normalized.forEach(function (item) {
    if (ids.has(item.id)) {
      const err = new Error('Duplicate product id.');
      err.statusCode = 400;
      throw err;
    }
    ids.add(item.id);
  });
  const nextCategories = mergeCategories(categories, normalized);
  memoryState = { products: clone(normalized), categories: nextCategories };

  let persisted = 'memory';
  try {
    writeCatalogDocument(TMP_PATH, normalized, nextCategories);
    persisted = 'session';
  } catch (error) { /* Temp storage can be unavailable. */ }

  try {
    writeCatalogDocument(JSON_PATH, normalized, nextCategories);
    writeCatalogJs(normalized);
    try { delete require.cache[require.resolve('../../assets/catalog-data.js')]; } catch (error) {}
    persisted = 'file';
  } catch (error) { /* Production file systems can be read-only. */ }

  return {
    products: clone(normalized),
    categories: nextCategories,
    persisted: persisted
  };
}

async function saveCatalog(products) {
  const current = await loadState();
  return saveState(products, current.categories);
}

async function addCategory(name, image) {
  const state = await loadState();
  const category = normalizeCategoryName(name);
  const src = normalizeCategoryImage(image, true);
  const exists = state.categories.some(function (item) {
    return categoryName(item).toLowerCase() === category.toLowerCase();
  });
  if (exists) {
    const err = new Error('That category already exists.');
    err.statusCode = 409;
    throw err;
  }
  return saveState(state.products, state.categories.concat([{ name: category, image: src }]));
}

async function deleteCategory(name) {
  const state = await loadState();
  const category = String(name || '').trim();
  const inUse = state.products.some(function (item) {
    return item.cat === category || (Array.isArray(item.cats) && item.cats.indexOf(category) !== -1);
  });
  if (inUse) {
    const err = new Error('Move or delete products in this category first.');
    err.statusCode = 400;
    throw err;
  }
  const next = state.categories.filter(function (item) { return categoryName(item) !== category; });
  if (next.length === state.categories.length) {
    const err = new Error('Category not found.');
    err.statusCode = 404;
    throw err;
  }
  return saveState(state.products, next);
}

module.exports = {
  loadCatalog: loadCatalog,
  loadState: loadState,
  saveCatalog: saveCatalog,
  saveState: saveState,
  addCategory: addCategory,
  deleteCategory: deleteCategory,
  categoryName: categoryName,
  normalizeProduct: normalizeProduct,
  catalogStats: catalogStats,
  slugify: slugify
};
