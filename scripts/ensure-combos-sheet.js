require('dotenv').config();
const { google } = require('googleapis');

const COMBOS_TAB_NAME = 'Combos';
const COMBO_HEADER = [
  'Combo ID',
  'Combo Title',
  'Active',
  'Fixed Price',
  'Slot ID',
  'Slot Label',
  'Slot Type',
  'Option Item Key',
  'Sort Order',
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

  return value.split('/')[0].split('?')[0];
}

async function ensureCombosSheetExists(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTitles = new Set((meta.data.sheets || []).map((s) => s.properties.title));

  if (existingTitles.has(COMBOS_TAB_NAME)) {
    return false;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    resource: {
      requests: [{ addSheet: { properties: { title: COMBOS_TAB_NAME } } }],
    },
  });

  return true;
}

function rowHasAnyValue(row) {
  return Array.isArray(row) && row.some((cell) => `${cell || ''}`.trim() !== '');
}

function rowMatchesHeader(row) {
  if (!Array.isArray(row)) return false;
  for (let i = 0; i < COMBO_HEADER.length; i += 1) {
    const current = `${row[i] || ''}`.trim();
    if (current !== COMBO_HEADER[i]) return false;
  }
  return true;
}

async function ensureCombosHeader(sheets, spreadsheetId) {
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${COMBOS_TAB_NAME}!A1:I1`,
  });

  const firstRow = headerRes.data.values?.[0] || [];

  if (!rowHasAnyValue(firstRow)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${COMBOS_TAB_NAME}!A1:I1`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [COMBO_HEADER] },
    });
    return 'written';
  }

  if (rowMatchesHeader(firstRow)) {
    return 'already-correct';
  }

  return 'not-overwritten';
}

async function main() {
  const clientEmail = getEnvOrFail('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const privateKey = getEnvOrFail('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n');
  const spreadsheetId = normalizeSpreadsheetId(getEnvOrFail('SPREADSHEET_ID'));

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  const createdTab = await ensureCombosSheetExists(sheets, spreadsheetId);
  const headerStatus = await ensureCombosHeader(sheets, spreadsheetId);

  console.log('\nCombos sheet safety check complete.');
  console.log(`SPREADSHEET_ID=${spreadsheetId}`);
  console.log(`Combos tab created: ${createdTab ? 'yes' : 'no'}`);

  if (headerStatus === 'written') {
    console.log('Header row written to Combos!A1:I1 (sheet was empty).');
  } else if (headerStatus === 'already-correct') {
    console.log('Header row already present and correct. No changes made.');
  } else {
    console.log('Header row already has data but does not match expected schema. Left unchanged (non-destructive).');
    console.log(`Expected headers: ${COMBO_HEADER.join(' | ')}`);
  }
}

main().catch((err) => {
  console.error('\nFailed to ensure Combos sheet/header.');
  console.error(err.message);
  process.exit(1);
});
