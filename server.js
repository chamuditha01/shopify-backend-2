require('dotenv').config();

const express = require("express");
const cors = require("cors");

const app = express();

// 1. Updated CORS: Allow both your old and new Shopify store
const allowedOrigins = [
  'https://6v0cms-qy.myshopify.com',
  'https://printrooom.myshopify.com' // Your new store
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));

app.use(express.json());

const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

app.post('/create-draft-order', async (req, res) => {
  // Destructure the new customer and shipping_address fields from the request
  const { calculatedPrice, properties, customer, shipping_address } = req.body;

  const delivery = properties['Delivery'];
  
  const propertiesArray = Object.entries(properties).map(([key, value]) => ({
    name: key,
    value: value
  }));

  const requiresShipping = delivery !== '30 mins Instant Pickup';

  // 2. Updated Payload to include Customer and Shipping details
  const draftOrderPayload = {
    draft_order: {
      line_items: [
        {
          title: 'Custom Print Order',
          price: calculatedPrice.replace(/[^0-9.]/g, ''), // Ensure it's a clean number string
          quantity: 1,
          properties: propertiesArray,
          requires_shipping: requiresShipping,
        }
      ],
      // This attaches the order to a customer profile
      customer: {
        first_name: customer?.first_name || '',
        last_name: customer?.last_name || '',
        email: customer?.email || '',
        phone: customer?.phone || ''
      },
      // This is vital for tracking apps to see where the item is going
      shipping_address: {
        first_name: shipping_address?.first_name || '',
        last_name: shipping_address?.last_name || '',
        phone: shipping_address?.phone || '',
        address1: "Will be updated at checkout", // Placeholder
        city: "Customer City" // Placeholder
      },
      use_customer_default_address: true
    }
  };

  try {
    const shop = SHOPIFY_STORE;
    const token = ACCESS_TOKEN;

    const response = await fetch(`https://${shop}/admin/api/2024-01/draft_orders.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token
      },
      body: JSON.stringify(draftOrderPayload)
    });

    const data = await response.json();

    if (data.draft_order && data.draft_order.invoice_url) {
      return res.json({ success: true, checkout_url: data.draft_order.invoice_url });
    } else {
      console.error('Draft Order Error:', JSON.stringify(data));
      return res.status(500).json({ success: false, error: data });
    }

  } catch (err) {
    console.error('Server Error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));