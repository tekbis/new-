const { loadCatalog } = require('./catalog-store');

const MAX_QTY = 20;
const MAX_CART_LINES = 40;
const SHIPPING_CENTS = {
  '6.95': 695,
  '14.95': 1495,
  standard: 695,
  priority: 1495
};
const STATE_BY_NAME = {
  arizona: 'AZ',
  california: 'CA',
  florida: 'FL',
  georgia: 'GA',
  illinois: 'IL',
  'new mexico': 'NM',
  'new york': 'NY',
  texas: 'TX',
  washington: 'WA'
};

function normalizeState(value) {
  const raw = String(value || '').trim();
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  return STATE_BY_NAME[raw.toLowerCase()] || raw;
}

function shippingCents(value) {
  if (value == null || value === '') return SHIPPING_CENTS.standard;
  const key = String(value);
  if (!Object.prototype.hasOwnProperty.call(SHIPPING_CENTS, key)) {
    const err = new Error('Invalid shipping method.');
    err.statusCode = 400;
    throw err;
  }
  return SHIPPING_CENTS[key];
}

function quoteOrder(cart, shippingValue, couponCode) {
  return loadCatalog().then(function (products) {
    const byId = new Map(products.map(function (product) {
      return [Number(product.id), product];
    }));

    if (!Array.isArray(cart) || !cart.length) {
      const err = new Error('Your cart is empty.');
      err.statusCode = 400;
      throw err;
    }
    if (cart.length > MAX_CART_LINES) {
      const err = new Error('Too many items in the cart.');
      err.statusCode = 400;
      throw err;
    }

    const merged = new Map();
    cart.forEach(function (item) {
      const id = Number(item && item.id);
    if (!Number.isFinite(id)) {
      const err = new Error('One or more items are unavailable.');
      err.statusCode = 400;
      throw err;
    }
      const qty = Math.min(MAX_QTY, Math.max(1, parseInt(item.qty, 10) || 1));
      merged.set(id, Math.min(MAX_QTY, (merged.get(id) || 0) + qty));
    });

    const lines = [];
    merged.forEach(function (qty, id) {
      const product = byId.get(id);
    if (!product || !product.stock || product.price == null) {
      const err = new Error('One or more items are unavailable.');
      err.statusCode = 400;
      throw err;
    }
      lines.push({
        id: product.id,
        name: product.name,
        unitAmount: Math.round(Number(product.price) * 100),
        qty: qty
      });
    });

    const subtotal = lines.reduce(function (sum, line) {
      return sum + line.unitAmount * line.qty;
    }, 0);
    const coupon = String(couponCode || '').trim().toUpperCase();
    const discount = coupon === 'SAVE10' ? Math.round(subtotal * 0.10) : 0;
    const shipping = shippingCents(shippingValue);
    const amount = Math.max(0, subtotal - discount + shipping);

    if (amount < 50) {
      const err = new Error('Order total is too small to charge.');
      err.statusCode = 400;
      throw err;
    }

    return {
      lines: lines,
      subtotal: subtotal,
      discount: discount,
      shipping: shipping,
      amount: amount,
      coupon: discount ? 'SAVE10' : ''
    };
  });
}

function clip(value, max) {
  return String(value || '').trim().slice(0, max);
}

function customerFromBody(body) {
  const firstName = clip(body && body.firstName, 80);
  const lastName = clip(body && body.lastName, 80);
  const email = clip(body && body.email, 254);
  const phone = clip(body && body.phone, 32);
  const address = clip(body && body.address, 200);
  const city = clip(body && body.city, 80);
  const state = clip(body && body.state, 40);
  const zip = clip(body && body.zip, 20);
  const name = (firstName + ' ' + lastName).trim();
  const shipping = name && address && city && state && zip ? {
    name: name,
    address: {
      line1: address,
      city: city,
      state: normalizeState(state),
      postal_code: zip,
      country: 'US'
    }
  } : undefined;
  if (shipping && phone) shipping.phone = phone;

  return {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '',
    shipping: shipping
  };
}

function centsToAmount(cents) {
  return (Math.round(Number(cents) || 0) / 100).toFixed(2);
}

function metadataFromQuote(quote) {
  return {
    coupon: quote.coupon || '',
    items: quote.lines.map(function (line) {
      return line.id + ':' + line.qty;
    }).join(',').slice(0, 500)
  };
}

module.exports = {
  quoteOrder: quoteOrder,
  customerFromBody: customerFromBody,
  metadataFromQuote: metadataFromQuote,
  centsToAmount: centsToAmount
};
