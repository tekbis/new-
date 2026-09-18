const { loadCatalog } = require('./catalog-store');

const MAX_QTY = 20;
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
    throw new Error('Invalid shipping method.');
  }
  return SHIPPING_CENTS[key];
}

function quoteOrder(cart, shippingValue, couponCode) {
  return loadCatalog().then(function (products) {
    const byId = new Map(products.map(function (product) {
      return [Number(product.id), product];
    }));

    if (!Array.isArray(cart) || !cart.length) {
      throw new Error('Your cart is empty.');
    }

    const merged = new Map();
    cart.forEach(function (item) {
      const id = Number(item && item.id);
      if (!Number.isFinite(id)) {
        throw new Error('One or more items are unavailable.');
      }
      const qty = Math.min(MAX_QTY, Math.max(1, parseInt(item.qty, 10) || 1));
      merged.set(id, Math.min(MAX_QTY, (merged.get(id) || 0) + qty));
    });

    const lines = [];
    merged.forEach(function (qty, id) {
      const product = byId.get(id);
      if (!product || !product.stock || product.price == null) {
        throw new Error('One or more items are unavailable.');
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
      throw new Error('Order total is too small to charge.');
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

function customerFromBody(body) {
  const firstName = String((body && body.firstName) || '').trim();
  const lastName = String((body && body.lastName) || '').trim();
  const email = String((body && body.email) || '').trim();
  const phone = String((body && body.phone) || '').trim();
  const address = String((body && body.address) || '').trim();
  const city = String((body && body.city) || '').trim();
  const state = String((body && body.state) || '').trim();
  const zip = String((body && body.zip) || '').trim();
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
