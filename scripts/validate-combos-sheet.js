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

function rowHasAnyValue(row) {
  return Array.isArray(row) && row.some((cell) => `${cell || ''}`.trim() !== '');
}

function isTruthy(value) {
  const normalized = `${value || ''}`.toString().trim().toLowerCase();
  return normalized === 'true' || normalized === 'yes' || normalized === '1' || normalized === 'y';
}

function buildMenuIndex(menuRows) {
  const index = new Map();

  menuRows.forEach((row) => {
    const [section, name] = row;
    if (!section || !name) return;
    const key = `${(section || '').trim()}::${(name || '').trim()}`.toLowerCase();
    index.set(key, {
      section: (section || '').trim(),
      name: (name || '').trim(),
      outOfStock: row[5] ? `${row[5]}`.trim().toLowerCase() === 'yes' : false,
    });
  });

  return index;
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

  console.log('\nValidating Combos sheet...');
  console.log(`SPREADSHEET_ID=${spreadsheetId}\n`);

  const [menuRes, combosRes] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Menu!A2:F',
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Combos!A1:I',
    }).catch((err) => {
      if (err?.response?.status === 400) {
        return { data: { values: [] } };
      }
      throw err;
    }),
  ]);

  const menuRows = menuRes.data.values || [];
  const comboRows = combosRes.data.values || [];
  const menuIndex = buildMenuIndex(menuRows);

  console.log(`Menu items loaded: ${menuRows.length}`);
  console.log(`Combos sheet rows: ${comboRows.length}\n`);

  if (comboRows.length === 0) {
    console.log('⚠️  Combos sheet is empty.');
    return;
  }

  const headerRow = comboRows[0] || [];
  const expectedHeader = COMBO_HEADER.map((h) => h.toLowerCase());
  const actualHeader = (headerRow || []).map((h) => `${h || ''}`.toLowerCase());

  let headerValid = true;
  if (!rowHasAnyValue(headerRow)) {
    console.log('❌ Row 1 is empty. Expected headers.');
    headerValid = false;
  } else {
    for (let i = 0; i < expectedHeader.length; i += 1) {
      if (expectedHeader[i] !== actualHeader[i]) {
        console.log(`❌ Column ${String.fromCharCode(65 + i)} header mismatch.`);
        console.log(`   Expected: "${COMBO_HEADER[i]}"`);
        console.log(`   Actual:   "${headerRow[i] || ''}"\n`);
        headerValid = false;
      }
    }
  }

  if (headerValid) {
    console.log('✓ Header row is correct.\n');
  }

  let dataRowCount = 0;
  let issueCount = 0;
  const combosMap = new Map();

  for (let rowIdx = 1; rowIdx < comboRows.length; rowIdx += 1) {
    const row = comboRows[rowIdx] || [];
    if (!rowHasAnyValue(row)) {
      continue;
    }

    dataRowCount += 1;
    const lineNum = rowIdx + 1;

    const [comboIdRaw, comboTitleRaw, activeRaw, fixedPriceRaw, slotIdRaw, slotLabelRaw, slotTypeRaw, optionItemKeyRaw, sortOrderRaw] = row;

    const comboId = `${comboIdRaw || ''}`.trim();
    const comboTitle = `${comboTitleRaw || ''}`.trim();
    const slotId = `${slotIdRaw || ''}`.trim();
    const optionItemKey = `${optionItemKeyRaw || ''}`.trim();
    const slotType = `${slotTypeRaw || ''}`.trim().toLowerCase();
    const active = activeRaw === undefined || activeRaw === '' ? true : isTruthy(activeRaw);
    const fixedPrice = parseFloat(fixedPriceRaw) || 0;
    const sortOrder = parseInt(sortOrderRaw, 10) || 0;

    if (!comboId || !comboTitle || !slotId || !optionItemKey) {
      console.log(`❌ Row ${lineNum}: Missing required field(s).`);
      console.log(`   Combo ID: "${comboId}" | Combo Title: "${comboTitle}" | Slot ID: "${slotId}" | Option Item Key: "${optionItemKey}"\n`);
      issueCount += 1;
      continue;
    }

    if (slotType !== 'free' && slotType !== 'required') {
      console.log(`❌ Row ${lineNum}: Invalid Slot Type "${slotType}". Must be "required" or "free".\n`);
      issueCount += 1;
      continue;
    }

    if (fixedPrice < 0) {
      console.log(`❌ Row ${lineNum}: Fixed Price is negative (${fixedPrice}).\n`);
      issueCount += 1;
      continue;
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      console.log(`❌ Row ${lineNum}: Sort Order must be a non-negative integer (got "${sortOrderRaw}").\n`);
      issueCount += 1;
      continue;
    }

    const menuItemKey = optionItemKey.toLowerCase();
    const menuItem = menuIndex.get(menuItemKey);

    if (!menuItem) {
      console.log(`❌ Row ${lineNum}: Option Item Key "${optionItemKey}" not found in Menu tab.`);
      console.log(`   Available items in Menu: ${Array.from(menuIndex.keys())
        .slice(0, 5)
        .map((k) => `"${k}"`)
        .join(', ')}${menuIndex.size > 5 ? '...' : ''}\n`);
      issueCount += 1;
      continue;
    }

    if (menuItem.outOfStock) {
      console.log(`⚠️  Row ${lineNum}: Option Item Key "${optionItemKey}" is marked Out of Stock in Menu tab.`);
      console.log(`   This option will not appear in the combo until it's back in stock.\n`);
    }

    const comboKey = comboId.toLowerCase();
    if (!combosMap.has(comboKey)) {
      combosMap.set(comboKey, { title: comboTitle, active, fixedPrice, slots: new Map() });
    }

    const combo = combosMap.get(comboKey);
    if (!combo.slots.has(slotId.toLowerCase())) {
      combo.slots.set(slotId.toLowerCase(), []);
    }

    combo.slots.get(slotId.toLowerCase()).push({
      rowIdx: lineNum,
      optionItemKey,
      active,
    });
  }

  console.log(`Data rows processed: ${dataRowCount}`);
  console.log(`Issues found: ${issueCount}\n`);

  if (issueCount === 0 && dataRowCount > 0) {
    console.log('Combo structure analysis:');

    combosMap.forEach((combo, comboId) => {
      const requiredSlots = Array.from(combo.slots.values()).filter((options) =>
        options.some((opt) => !opt.rowIdx)
      );

      console.log(`\n  Combo: ${combo.title} (${comboId})`);
      console.log(`    Active: ${combo.active}`);
      console.log(`    Fixed Price: ₹${combo.fixedPrice}`);
      console.log(`    Slots: ${combo.slots.size}`);

      combo.slots.forEach((options, slotId) => {
        console.log(`      ${slotId}: ${options.length} option(s)`);
      });
    });

    console.log('\n✓ All rows are valid. Combos should be visible in the app.');
  }
}

main().catch((err) => {
  console.error('\nFailed to validate Combos sheet.');
  console.error(err.message);
  process.exit(1);
});
