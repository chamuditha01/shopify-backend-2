const express = require("express");
const cors = require("cors");

const app = express();

// 1. CORS Configuration
const allowedOrigins = [
  'https://6v0cms-qy.myshopify.com',
  'https://printrooom.myshopify.com'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('Origin not allowed by CORS'), false);
    }
    return callback(null, true);
  }
}));

app.use(express.json());

// 2. Access Environment Variables
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

app.post('/create-draft-order', async (req, res) => {
  // CRITICAL CHECK: Prevent ENOTFOUND error
  if (!SHOPIFY_STORE || !ACCESS_TOKEN) {
    console.error("Missing Environment Variables");
    return res.status(500).json({ success: false, error: "Server Configuration Missing" });
  }

  try {
    const { calculatedPrice, properties, customer, shipping_address } = req.body;

    // Safety: Convert price to string before using .replace
    const cleanPrice = String(calculatedPrice || "0").replace(/[^0-9.]/g, '');

    const propertiesArray = Object.entries(properties || {}).map(([key, value]) => ({
      name: key,
      value: String(value)
    }));

    const delivery = properties?.['Delivery'] || '';
    const requiresShipping = delivery !== '30 mins Instant Pickup';

    const draftOrderPayload = {
      draft_order: {
        line_items: [
          {
            title: 'Custom Print Order',
            price: cleanPrice,
            quantity: 1,
            properties: propertiesArray,
            requires_shipping: requiresShipping,
          }
        ],
        customer: {
          first_name: customer?.first_name || '',
          last_name: customer?.last_name || '',
          email: customer?.email || '',
          phone: customer?.phone || ''
        },
        shipping_address: {
          first_name: shipping_address?.first_name || customer?.first_name || '',
          last_name: shipping_address?.last_name || customer?.last_name || '',
          phone: shipping_address?.phone || customer?.phone || '',
          address1: "Pickup/Digital",
          city: "Colombo", 
          country: "Sri Lanka"
        },
        use_customer_default_address: true
      }
    };

    // 3. Shopify API Call
    const response = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/draft_orders.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': ACCESS_TOKEN
      },
      body: JSON.stringify(draftOrderPayload)
    });

    const data = await response.json();

    if (response.ok && data.draft_order) {
      res.json({ success: true, checkout_url: data.draft_order.invoice_url });
    } else {
      console.error('Shopify API Error:', data);
      res.status(400).json({ success: false, error: data });
    }

  } catch (err) {
    console.error('Internal Server Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// IMPORTANT FOR VERCEL: Export the app
module.exports = app;

// Keep this for local testing only
if (process.env.NODE_ENV !== 'production') {
  app.listen(3000, () => console.log("Local Server running on port 3000"));
}