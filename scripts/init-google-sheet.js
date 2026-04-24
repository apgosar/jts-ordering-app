require('dotenv').config();
const { google } = require('googleapis');

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

function fail(msg) {
  console.error(`\nERROR: ${msg}\n`);
  process.exit(1);
}

function getEnvOrFail(key) {
  const value = process.env[key];
  if (!value || value.includes('your-')) {
    fail(`${key} is missing or still using placeholder value in .env`);
  }
  return value;
}

function normalizeSpreadsheetId(rawValue) {
  if (!rawValue) return '';

  const value = rawValue.trim();

  const fromUrl = value.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (fromUrl) return fromUrl[1];

  const fromPrefix = value.match(/^d\/([a-zA-Z0-9-_]+)$/);
  if (fromPrefix) return fromPrefix[1];

  const cleanValue = value.split('/')[0].split('?')[0];
  return cleanValue;
}

async function main() {
  const clientEmail = getEnvOrFail('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const privateKey = getEnvOrFail('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n');

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  const providedSheetId = process.env.SPREADSHEET_ID && !process.env.SPREADSHEET_ID.includes('your_')
    ? normalizeSpreadsheetId(process.env.SPREADSHEET_ID)
    : '';

  const title = `JTS Ordering Data ${new Date().toISOString().slice(0, 10)}`;

  let spreadsheetId;
  let spreadsheetUrl;
  let createdNewSheet = false;

  if (providedSheetId) {
    spreadsheetId = providedSheetId;
    const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
    spreadsheetUrl = sheetMeta.data.spreadsheetUrl;

    const existingTitles = new Set((sheetMeta.data.sheets || []).map(s => s.properties.title));
    const addRequests = [];
    if (!existingTitles.has('Menu')) {
      addRequests.push({ addSheet: { properties: { title: 'Menu' } } });
    }
    if (!existingTitles.has('Orders')) {
      addRequests.push({ addSheet: { properties: { title: 'Orders' } } });
    }

    if (addRequests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: { requests: addRequests },
      });
    }
  } else {
    const createRes = await sheets.spreadsheets.create({
      resource: {
        properties: { title },
        sheets: [
          { properties: { title: 'Menu' } },
          { properties: { title: 'Orders' } },
        ],
      },
      fields: 'spreadsheetId,spreadsheetUrl',
    });

    spreadsheetId = createRes.data.spreadsheetId;
    spreadsheetUrl = createRes.data.spreadsheetUrl;
    createdNewSheet = true;
  }

  const menuRows = [];
  for (const section of MOCK_MENU) {
    section.items.forEach((item, index) => {
      menuRows.push([
        section.section,
        item.name,
        item.description,
        item.price,
        index === 0 ? (section.packageInfo || '') : '',
        'No',
      ]);
    });
  }

  const menuHeader = [['Section', 'Item Name', 'Description', 'Price', 'Package Info', 'Out of Stock']];
  const orderHeader = [[
    'Order ID',
    'Date',
    'Time',
    'Name',
    'Phone',
    'Wing/Flat',
    'Building',
    'Street',
    'Landmark',
    'Locality',
    'PINCODE',
    'Items',
    'Total',
    'Status',
  ]];

  await sheets.spreadsheets.values.batchClear({
    spreadsheetId,
    resource: {
      ranges: ['Menu!A:Z', 'Orders!A:Z'],
    },
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    resource: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: 'Menu!A1:F1', values: menuHeader },
        { range: 'Menu!A2:F', values: menuRows },
        { range: 'Orders!A1:N1', values: orderHeader },
      ],
    },
  });

  const shareEmail = process.env.SHEET_SHARE_EMAIL;
  if (shareEmail && createdNewSheet) {
    await drive.permissions.create({
      fileId: spreadsheetId,
      sendNotificationEmail: true,
      requestBody: {
        type: 'user',
        role: 'writer',
        emailAddress: shareEmail,
      },
    });
  }

  console.log('\nSpreadsheet created successfully.');
  console.log(`SPREADSHEET_ID=${spreadsheetId}`);
  console.log(`URL=${spreadsheetUrl}`);

  if (!createdNewSheet) {
    console.log('Used existing SPREADSHEET_ID from .env and initialized required tabs/data.');
  }

  if (shareEmail && createdNewSheet) {
    console.log(`Shared with: ${shareEmail}`);
  } else if (shareEmail && !createdNewSheet) {
    console.log('NOTE: SHEET_SHARE_EMAIL is ignored when using an existing SPREADSHEET_ID.');
  } else {
    console.log('NOTE: Set SHEET_SHARE_EMAIL in .env and rerun if you want this sheet shared to your account.');
  }
}

main().catch((err) => {
  console.error('\nFailed to create spreadsheet.');
  console.error(err.message);
  process.exit(1);
});
