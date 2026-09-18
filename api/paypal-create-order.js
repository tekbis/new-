const { quoteOrder, customerFromBody, centsToAmount } = require('./_lib/order');
const { paypalRequest } = require('./_lib/paypal');
const { readJsonBody, json } = require('./_lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const body = await readJsonBody(req);
    const quote = await quoteOrder(body.cart, body.shipping, body.coupon);
    const customer = customerFromBody(body);
    const breakdown = {
      item_total: {
        currency_code: 'USD',
        value: centsToAmount(quote.subtotal)
      },
      shipping: {
        currency_code: 'USD',
        value: centsToAmount(quote.shipping)
      }
    };
    if (quote.discount) {
      breakdown.discount = {
        currency_code: 'USD',
        value: centsToAmount(quote.discount)
      };
    }

    const order = {
      intent: 'CAPTURE',
      purchase_units: [{
        description: 'Zander88LLC order',
        custom_id: (quote.coupon || 'none').slice(0, 127),
        amount: {
          currency_code: 'USD',
          value: centsToAmount(quote.amount),
          breakdown: breakdown
        },
        items: quote.lines.map(function (line) {
          return {
            name: (String(line.name || 'Item').trim() || 'Item').slice(0, 127),
            quantity: String(line.qty),
            unit_amount: {
              currency_code: 'USD',
              value: centsToAmount(line.unitAmount)
            },
            category: 'PHYSICAL_GOODS'
          };
        })
      }],
      application_context: {
        brand_name: 'Zander88LLC',
        user_action: 'PAY_NOW',
        shipping_preference: customer.shipping ? 'SET_PROVIDED_ADDRESS' : 'NO_SHIPPING'
      }
    };

    if (customer.email) {
      order.payer = { email_address: customer.email };
    }

    if (customer.shipping) {
      order.purchase_units[0].shipping = {
        name: { full_name: String(customer.shipping.name).slice(0, 300) },
        address: {
          address_line_1: String(customer.shipping.address.line1).slice(0, 300),
          admin_area_2: String(customer.shipping.address.city).slice(0, 120),
          admin_area_1: customer.shipping.address.state,
          postal_code: String(customer.shipping.address.postal_code).slice(0, 20),
          country_code: 'US'
        }
      };
    }

    const created = await paypalRequest('POST', '/v2/checkout/orders', order);
    if (!created || !created.id) {
      return json(res, 502, { error: 'PayPal did not return an order.' });
    }
    return json(res, 200, { id: created.id });
  } catch (error) {
    const message = error && error.message ? error.message : 'Unable to start PayPal payment.';
    const status = error.statusCode || (/cart|unavailable|shipping|small|Invalid/i.test(message) ? 400 : 500);
    return json(res, status, { error: message });
  }
};
