const { loadCatalog } = require('./catalog-store');

const MAX_QTY = 20;
const MAX_CART_LINES = 40;
// Percent-off discount codes. Z88WELCOME is the code advertised in the storefront top bar.
const COUPONS = {
  SAVE10: 10,
  Z88WELCOME: 10
};
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
      const size = String((item && item.size) || '').trim().slice(0, 40);
      const key = id + '|' + size;
      const qty = Math.min(MAX_QTY, Math.max(1, parseInt(item.qty, 10) || 1));
      const current = merged.get(key);
      merged.set(key, {
        id: id,
        size: size,
        qty: Math.min(MAX_QTY, (current ? current.qty : 0) + qty)
      });
    });

    const lines = [];
    merged.forEach(function (entry) {
      const product = byId.get(entry.id);
      if (!product || !product.stock || product.price == null) {
        const err = new Error('One or more items are unavailable.');
        err.statusCode = 400;
        throw err;
      }
      const sizes = Array.isArray(product.sizes) ? product.sizes : [];
      let price = Number(product.price);
      let name = product.name;
      if (sizes.length) {
        const soldOut = Array.isArray(product.soldOutSizes) ? product.soldOutSizes : [];
        if (!entry.size || sizes.indexOf(entry.size) === -1) {
          const err = new Error('Please choose a size for ' + product.name + '.');
          err.statusCode = 400;
          throw err;
        }
        if (soldOut.indexOf(entry.size) !== -1) {
          const err = new Error(product.name + ' is sold out in size ' + entry.size + '.');
          err.statusCode = 400;
          throw err;
        }
        const sizePrice = product.sizePrices && product.sizePrices[entry.size];
        if (sizePrice != null && Number.isFinite(Number(sizePrice))) price = Number(sizePrice);
        name = product.name + ' (Size ' + entry.size + ')';
      }
      lines.push({
        id: product.id,
        size: sizes.length ? entry.size : '',
        name: name,
        unitAmount: Math.round(price * 100),
        qty: entry.qty
      });
    });

    const subtotal = lines.reduce(function (sum, line) {
      return sum + line.unitAmount * line.qty;
    }, 0);
    const coupon = String(couponCode || '').trim().toUpperCase();
    const percentOff = Object.prototype.hasOwnProperty.call(COUPONS, coupon) ? COUPONS[coupon] : 0;
    const discount = percentOff ? Math.round(subtotal * percentOff / 100) : 0;
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
      coupon: discount ? coupon : ''
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
  const address2 = clip(body && body.address2, 200);
  const city = clip(body && body.city, 80);
  const state = clip(body && body.state, 40);
  const zip = clip(body && body.zip, 20);
  const name = (firstName + ' ' + lastName).trim();
  const shipping = name && address && city && state && zip ? {
    name: name,
    address: {
      line1: address,
      line2: address2 || undefined,
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
      return line.id + (line.size ? '[' + line.size + ']' : '') + ':' + line.qty;
    }).join(',').slice(0, 500)
  };
}

module.exports = {
  quoteOrder: quoteOrder,
  customerFromBody: customerFromBody,
  metadataFromQuote: metadataFromQuote,
  centsToAmount: centsToAmount
};
