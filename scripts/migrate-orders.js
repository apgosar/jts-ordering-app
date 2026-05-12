require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// Re-use formatting logic
function groupComboSelections(comboSelections = []) {
  return comboSelections.reduce((groups, selection) => {
    const normalizedLabel = (selection.slotLabel || selection.slotId || 'Selection').trim();
    const groupKey = `${selection.slotType}::${normalizedLabel.toLowerCase()}`;
    const existingGroup = groups.find(group => group.key === groupKey);

    if (existingGroup) {
      existingGroup.optionNames.push(selection.optionName);
      return groups;
    }

    groups.push({
      key: groupKey,
      slotType: selection.slotType,
      label: normalizedLabel,
      optionNames: [selection.optionName],
    });
    return groups;
  }, []);
}

function formatComboSelectionsForShare(comboSelections = []) {
  return groupComboSelections(comboSelections)
    .map((group) => {
      const heading = group.slotType === 'free' ? 'Free Pick' : group.label;
      const suffix = group.slotType === 'free' ? ' [FREE]' : '';
      const lines = group.optionNames.map(name => `      - ${name}`).join('\n');
      return `    ${heading}${suffix}\n${lines}`;
    })
    .join('\n');
}

function formatItemsForSheet(canonicalItems) {
  if (!Array.isArray(canonicalItems)) return '';
  const sectionMap = new Map();
  canonicalItems.forEach(i => {
    const sectionName = i.section || 'Other';
    if (!sectionMap.has(sectionName)) {
      sectionMap.set(sectionName, new Map());
    }
    
    const itemMap = sectionMap.get(sectionName);
    const comboDetails = i.isCombo && Array.isArray(i.comboSelections) && i.comboSelections.length > 0
      ? `\n${formatComboSelectionsForShare(i.comboSelections)}`
      : '';
    
    const key = `${i.name}|${comboDetails}`;
    if (!itemMap.has(key)) {
      itemMap.set(key, { name: i.name, comboDetails, quantity: 0 });
    }
    itemMap.get(key).quantity += i.quantity;
  });

  const sectionBlocks = Array.from(sectionMap.entries()).map(([sectionName, itemMap]) => {
    const items = Array.from(itemMap.values()).map(item => {
      return `- ${item.name} ×${item.quantity}${item.comboDetails}`;
    });
    return `${sectionName}:\n${items.join('\n')}`;
  });

  return sectionBlocks.join('\n\n');
}

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

function parseJsonSafe(str, fallback = []) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

async function run() {
  console.log('Starting migration to 10 columns...');
  if (!SPREADSHEET_ID) {
    console.error('SPREADSHEET_ID is missing.');
    return;
  }

  const sheets = getSheetsClient();
  
  try {
    console.log('Fetching existing data from Orders!A:N...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Orders!A:N',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('No data found in Orders sheet.');
      return;
    }

    // Identify header row
    const headers = rows[0];
    const isHeaderRow = headers[0] === 'OrderID' || headers[0] === 'Order ID';
    const dataRows = isHeaderRow ? rows.slice(1) : rows;

    console.log(`Found ${dataRows.length} order(s) to migrate.`);

    const newValues = [];
    
    // Create new headers
    if (isHeaderRow) {
      newValues.push([
        'OrderID',
        'Date',
        'Time',
        'Order Status',
        'Name',
        'Phone Number',
        'Address',
        'Items',
        'Total Amount',
        'HiddenItemsJSON'
      ]);
    }

    dataRows.forEach((row, idx) => {
      // Old structure:
      // 0: OrderID, 1: Date, 2: Time, 3: Name, 4: Phone, 5: Wing/Flat, 6: Building, 7: Street, 8: Landmark, 9: Locality, 10: Pincode, 11: Items (JSON), 12: Total, 13: Status
      
      const orderId = row[0] || '';
      const date = row[1] || '';
      const time = row[2] || '';
      const name = row[3] || '';
      const phone = row[4] || '';
      const wingFlat = row[5] || '';
      const building = row[6] || '';
      const street = row[7] || '';
      const landmark = row[8] || '';
      const locality = row[9] || '';
      const pincode = row[10] || '';
      const itemsJsonStr = row[11] || '[]';
      const total = row[12] || '0';
      const status = row[13] || 'Pending';

      const itemsObj = parseJsonSafe(itemsJsonStr, []);
      const formattedItems = formatItemsForSheet(itemsObj);
      
      const formattedAddress = `${wingFlat.trim()}, ${building.trim()}, ${street.trim()}${landmark.trim() ? ', ' + landmark.trim() : ''}, ${locality.trim()} - ${pincode.trim()}`;

      // New structure:
      // 0: OrderID, 1: Date, 2: Time, 3: Status, 4: Name, 5: Phone Number, 6: Address, 7: Items (formatted string), 8: Total Amount, 9: Hidden Items JSON
      newValues.push([
        orderId,
        date,
        time,
        status,
        name,
        phone,
        formattedAddress,
        formattedItems,
        total,
        itemsJsonStr
      ]);
    });

    console.log('Writing new structure to Orders!A:J...');
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Orders!A1:J${newValues.length}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: newValues },
    });

    console.log('Clearing old columns K:N...');
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `Orders!K1:N`,
    });

    console.log('Migration complete.');
  } catch (err) {
    console.error('Error during migration:', err);
  }
}

run();
