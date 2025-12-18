const express = require("express");
const cors = require("cors");

const app = express();

// 1. CORS Configuration - Explicitly allow your Shopify stores
const allowedOrigins = [
  'https://6v0cms-qy.myshopify.com',
  'https://printrooom.myshopify.com'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('Origin not allowed by CORS policy'), false);
    }
    return callback(null, true);
  }
}));

app.use(express.json());

// 2. Access Environment Variables
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

app.post('/create-draft-order', async (req, res) => {
  // CRITICAL CHECK: Ensure variables are loaded
  if (!SHOPIFY_STORE || !ACCESS_TOKEN) {
    console.error("Missing Environment Variables: SHOPIFY_STORE or ACCESS_TOKEN");
    return res.status(500).json({ success: false, error: "Server Configuration Missing" });
  }

  // CLEAN THE STORE URL: 
  // This removes "https://", "http://", and any trailing "/"
  // This prevents the "ENOTFOUND https" error.
  const cleanShop = SHOPIFY_STORE.replace(/^https?:\/\//, '').replace(/\/$/, '');

  try {
    const { calculatedPrice, properties, customer, shipping_address } = req.body;

    // Safety: Ensure price is a clean numeric string for Shopify
    const cleanPrice = String(calculatedPrice || "0").replace(/[^0-9.]/g, '');

    const propertiesArray = Object.entries(properties || {}).map(([key, value]) => ({
      name: key,
      value: String(value)
    }));

    const delivery = properties?.['Delivery'] || '';
    const requiresShipping = delivery !== '30 mins Instant Pickup';

    // Construct the Shopify Draft Order Payload
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
          address1: "Custom Print Order",
          city: "Customer City", 
          country: "Sri Lanka"
        },
        use_customer_default_address: true
      }
    };

    // 3. Shopify Admin API Call
    // We use the 'cleanShop' variable here
    const shopifyUrl = `https://${cleanShop}/admin/api/2024-01/draft_orders.json`;
    
    const response = await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': ACCESS_TOKEN
      },
      body: JSON.stringify(draftOrderPayload)
    });

    const data = await response.json();

    if (response.ok && data.draft_order) {
      // Return the invoice_url which takes user directly to checkout
      res.json({ success: true, checkout_url: data.draft_order.invoice_url });
    } else {
      console.error('Shopify API Error Response:', JSON.stringify(data));
      res.status(400).json({ success: false, error: data });
    }

  } catch (err) {
    console.error('Internal Server Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// IMPORTANT FOR VERCEL: Export the app module
module.exports = app;

// Local Development Server
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Local Server running on port ${PORT}`));
}