require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(cors());
app.use(express.json());

// ─── Rate limiting ────────────────────────────────────────────────────────────
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// ─── Mock data for local dev without Google Sheets ───────────────────────────
const MOCK_MENU = [
  {
    section: 'Wafers',
    packageInfo: 'Pkg. 200gm',
    items: [
      { name: 'Tikhi Wafers', description: 'Spicy crispy banana wafer chips', price: 100 },
      { name: 'Mari Wafers', description: 'Pepper-flavoured crispy wafer chips', price: 100 },
      { name: 'Yellow Wafers', description: 'Lightly salted yellow wafer chips', price: 120 },
    ],
  },
  {
    section: 'Namkeen',
    packageInfo: 'Pkg. 250gm',
    items: [
      { name: 'Bhavnagari', description: 'Thick crispy sev from Bhavnagar', price: 90 },
      { name: 'Papadi', description: 'Crispy fried flat crackers', price: 90 },
      { name: 'Makhaniya Gathiya', description: 'Butter-smooth soft gathiya', price: 90 },
      { name: 'Sev Bundi', description: 'Fine sev with crispy boondi mix', price: 90 },
      { name: 'Ratlami Sev', description: 'Spicy sev from Ratlam', price: 90 },
      { name: 'Nadiyadi Bhusu', description: 'Light crunchy Nadiyad-style namkeen', price: 90 },
      { name: 'Medium Sev', description: 'Classic medium-thick golden sev', price: 90 },
      { name: 'Barik Sev', description: 'Fine thin crispy sev', price: 90 },
      { name: 'Moong Dal', description: 'Crispy fried whole moong dal', price: 90 },
      { name: 'Chana Dal', description: 'Crunchy fried chana dal with spices', price: 90 },
      { name: 'Farsi Puri', description: 'Crispy spiced Gujarati farsi puri', price: 90 },
    ],
  },
  {
    section: 'Sweet',
    packageInfo: 'Pkg. 250gm',
    items: [
      { name: 'Sukhdi (Gol Papdi)', description: 'Traditional wheat flour & jaggery sweet', price: 125 },
      { name: 'Mithi Bundi', description: 'Sweet boondi in light sugar syrup', price: 125 },
      { name: 'Mohanthal', description: 'Rich besan fudge with saffron & cardamom', price: 130 },
      { name: 'Churma Laddu', description: 'Classic Gujarati coarse wheat flour laddu', price: 130 },
      { name: 'Besan Laddu', description: 'Soft roasted gram flour balls with ghee', price: 130 },
    ],
  },
];

let MOCK_ORDERS = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Safely parse JSON, returning a fallback value on failure */
function parseJsonSafe(str, fallback = []) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/** Validate that each order item has the required shape */
function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) return false;
  return items.every(
    item =>
      typeof item.name === 'string' && item.name.trim().length > 0 &&
      typeof item.section === 'string' && item.section.trim().length > 0 &&
      typeof item.price === 'number' && item.price >= 0 &&
      Number.isInteger(item.quantity) && item.quantity > 0
  );
}

// ─── Google Sheets helper ─────────────────────────────────────────────────────
function getSheetsClient() {
  const credentials = {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const USE_MOCK = process.env.USE_MOCK_DATA === 'true';

// Validate required config at startup
if (!USE_MOCK && !SPREADSHEET_ID) {
  console.error('ERROR: SPREADSHEET_ID is not set. Set USE_MOCK_DATA=true or provide SPREADSHEET_ID.');
  process.exit(1);
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/menu
app.get('/api/menu', async (req, res) => {
  if (USE_MOCK) {
    return res.json({ menu: MOCK_MENU });
  }
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Menu!A2:D',
    });

    const rows = response.data.values || [];
    const sectionsMap = {};

    rows.forEach(row => {
      // Column E (index 4) is optional packageInfo per section
      const [section, name, description, price, packageInfo] = row;
      if (!section || !name) return;
      if (!sectionsMap[section]) sectionsMap[section] = { items: [], packageInfo: (packageInfo || '').trim() };
      sectionsMap[section].items.push({
        name: name.trim(),
        description: (description || '').trim(),
        price: parseFloat(price) || 0,
      });
    });

    const menu = Object.entries(sectionsMap).map(([section, { items, packageInfo }]) => ({
      section,
      packageInfo: packageInfo || '',
      items,
    }));

    res.json({ menu });
  } catch (err) {
    console.error('Error fetching menu:', err.message);
    res.status(500).json({ error: 'Failed to fetch menu. Check Google Sheets configuration.' });
  }
});

// POST /api/orders
app.post('/api/orders', orderLimiter, async (req, res) => {
  const { customer, items, total } = req.body;

  // Validate required top-level fields
  if (!customer || !items || total == null) {
    return res.status(400).json({ error: 'Missing required fields: customer, items, total' });
  }

  // Validate customer fields
  const requiredCustomerFields = ['name', 'phone', 'wingFlat', 'building', 'street', 'locality', 'pincode'];
  for (const field of requiredCustomerFields) {
    if (!customer[field] || typeof customer[field] !== 'string' || !customer[field].trim()) {
      return res.status(400).json({ error: `Missing or invalid customer field: ${field}` });
    }
  }

  // Validate items structure
  if (!validateItems(items)) {
    return res.status(400).json({
      error: 'Invalid items: each item must have name (string), section (string), price (number ≥ 0), quantity (positive integer)',
    });
  }

  // Validate total is a positive number
  const parsedTotal = parseFloat(total);
  if (isNaN(parsedTotal) || parsedTotal <= 0) {
    return res.status(400).json({ error: 'Invalid total amount' });
  }

  const orderId = uuidv4().slice(0, 8).toUpperCase();
  const now = new Date();
  const date = now.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  if (USE_MOCK) {
    MOCK_ORDERS.push({
      rowIndex: MOCK_ORDERS.length + 2,
      orderId,
      date,
      time,
      name: customer.name.trim(),
      phone: customer.phone.trim(),
      wingFlat: customer.wingFlat.trim(),
      building: customer.building.trim(),
      street: customer.street.trim(),
      landmark: (customer.landmark || '').trim(),
      locality: customer.locality.trim(),
      pincode: customer.pincode.trim(),
      items,
      total: parsedTotal,
      status: 'Pending',
    });
    return res.json({ success: true, orderId });
  }

  try {
    const sheets = getSheetsClient();
    const row = [
      orderId,
      date,
      time,
      customer.name.trim(),
      customer.phone.trim(),
      customer.wingFlat.trim(),
      customer.building.trim(),
      customer.street.trim(),
      (customer.landmark || '').trim(),
      customer.locality.trim(),
      customer.pincode.trim(),
      JSON.stringify(items),
      parsedTotal,
      'Pending',
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Orders!A:N',
      valueInputOption: 'USER_ENTERED',
      resource: { values: [row] },
    });

    res.json({ success: true, orderId });
  } catch (err) {
    console.error('Error placing order:', err.message);
    res.status(500).json({ error: 'Failed to place order. Please try again.' });
  }
});

// GET /api/admin/orders
app.get('/api/admin/orders', adminLimiter, (req, res) => {
  const adminPass = req.headers['x-admin-password'];
  if (!adminPass || adminPass !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { date, status } = req.query;

  if (USE_MOCK) {
    let orders = [...MOCK_ORDERS];
    if (date) orders = orders.filter(o => o.date === date);
    if (status) orders = orders.filter(o => o.status === status);
    return res.json({ orders });
  }

  (async () => {
    try {
      const sheets = getSheetsClient();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Orders!A2:N',
      });

      const rows = response.data.values || [];
      let orders = rows.map((row, index) => ({
        rowIndex: index + 2,
        orderId: row[0] || '',
        date: row[1] || '',
        time: row[2] || '',
        name: row[3] || '',
        phone: row[4] || '',
        wingFlat: row[5] || '',
        building: row[6] || '',
        street: row[7] || '',
        landmark: row[8] || '',
        locality: row[9] || '',
        pincode: row[10] || '',
        items: parseJsonSafe(row[11]),
        total: parseFloat(row[12]) || 0,
        status: row[13] || 'Pending',
      }));

      if (date) orders = orders.filter(o => o.date === date);
      if (status) orders = orders.filter(o => o.status === status);

      res.json({ orders });
    } catch (err) {
      console.error('Error fetching admin orders:', err.message);
      res.status(500).json({ error: 'Failed to fetch orders.' });
    }
  })();
});

// PUT /api/admin/orders/status  (bulk update)
app.put('/api/admin/orders/status', adminLimiter, async (req, res) => {
  const adminPass = req.headers['x-admin-password'];
  if (!adminPass || adminPass !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { rowIndices, status } = req.body;

  const VALID_STATUSES = ['Pending', 'Dispatched', 'Delivered'];
  if (!rowIndices?.length || !status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Missing or invalid rowIndices / status' });
  }

  if (!rowIndices.every(idx => Number.isInteger(idx) && idx >= 2)) {
    return res.status(400).json({ error: 'Invalid rowIndices: must be integers ≥ 2' });
  }

  if (USE_MOCK) {
    rowIndices.forEach(idx => {
      const order = MOCK_ORDERS.find(o => o.rowIndex === idx);
      if (order) order.status = status;
    });
    return res.json({ success: true });
  }

  try {
    const sheets = getSheetsClient();
    const data = rowIndices.map(rowIndex => ({
      range: `Orders!N${rowIndex}`,
      values: [[status]],
    }));

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: { valueInputOption: 'USER_ENTERED', data },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating order status:', err.message);
    res.status(500).json({ error: 'Failed to update status.' });
  }
});

// ─── Serve React build in production ─────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const staticLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });

  const buildPath = path.join(__dirname, 'client', 'build');
  app.use(express.static(buildPath));
  app.get('*', staticLimiter, (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`JTS Ordering App server running on port ${PORT} [mock=${USE_MOCK}]`);
});
