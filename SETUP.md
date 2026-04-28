# JTS – Jain Tiffin Service Ordering App

## Setup Guide

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/apgosar/jts-ordering-app.git
cd jts-ordering-app
npm run install-all
```

---

### 2. Google Sheets Setup

#### A. Create the Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet.
2. Rename the first sheet tab to **`Menu`** and add the following headers in row 1:

   | A        | B         | C           | D     |
   |----------|-----------|-------------|-------|
   | Section  | Item Name | Description | Price |

   Add your menu items below. Example:

   | Section   | Item Name    | Description                            | Price |
   |-----------|--------------|----------------------------------------|-------|
   | Breakfast | Poha         | Traditional flattened rice             | 50    |
   | Breakfast | Idli Sambar  | 3 idlis with sambar & chutney          | 60    |
   | Lunch     | Dal Rice     | Yellow dal with steamed rice           | 90    |
   | Lunch     | Thali        | Full Jain thali                        | 130   |
   | Dinner    | Khichdi      | Moong dal khichdi with ghee            | 80    |

3. Create a second sheet tab and rename it **`Orders`**. Add these headers in row 1:

   | A        | B    | C    | D    | E     | F         | G        | H      | I        | J        | K       | L     | M     | N      |
   |----------|------|------|------|-------|-----------|----------|--------|----------|----------|---------|-------|-------|--------|
   | Order ID | Date | Time | Name | Phone | Wing/Flat | Building | Street | Landmark | Locality | PINCODE | Items | Total | Status |

4. Create a third sheet tab and rename it **`Combos`**. Add these headers in row 1:

   | A        | B           | C      | D          | E       | F         | G         | H               | I         |
   |----------|-------------|--------|------------|---------|-----------|-----------|-----------------|-----------|
   | Combo ID | Combo Title | Active | Fixed Price| Slot ID | Slot Label| Slot Type | Option Item Key | Sort Order|

   Notes:
   - `Slot Type` should be `required` for the first 5 pair slots and `free` for the free-pair slot.
   - `Option Item Key` must match existing menu entries in this format: `Section::Item Name`.
   - Example `Option Item Key`: `Wafers::Tikhi Wafers`.

   Example rows for one combo (add multiple rows per slot):

   | Combo ID            | Combo Title                 | Active | Fixed Price | Slot ID  | Slot Label | Slot Type | Option Item Key       | Sort Order |
   |---------------------|-----------------------------|--------|-------------|----------|------------|-----------|-----------------------|------------|
   | combo_5plus1_offer  | 5 Pair Combo + 1 Free Pair | TRUE   | 499         | pair1    | Pair 1     | required  | Wafers::Tikhi Wafers  | 1          |
   | combo_5plus1_offer  | 5 Pair Combo + 1 Free Pair | TRUE   | 499         | pair1    | Pair 1     | required  | Wafers::Mari Wafers   | 2          |
   | combo_5plus1_offer  | 5 Pair Combo + 1 Free Pair | TRUE   | 499         | freepair | Free Pair  | free      | Sweet::Mithi Bundi    | 1          |

5. Copy the **Spreadsheet ID** from the URL:
   `https://docs.google.com/spreadsheets/d/**YOUR_SPREADSHEET_ID**/edit`

---

#### B. Create a Google Service Account

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or select an existing one).
3. Enable the **Google Sheets API**:
   - Navigate to _APIs & Services → Library_
   - Search for "Google Sheets API" and click **Enable**.
4. Create a Service Account:
   - Navigate to _APIs & Services → Credentials_
   - Click **Create Credentials → Service Account**
   - Fill in the name and click **Create and Continue**
   - Click **Done**
5. Generate a JSON Key:
   - Click on the service account you just created
   - Go to the **Keys** tab → **Add Key → Create new key → JSON**
   - Download the JSON file
6. From the downloaded JSON file, you need two values:
   - `client_email` → becomes `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → becomes `GOOGLE_PRIVATE_KEY`

---

#### C. Share the Spreadsheet

Open your Google Sheet and click **Share**. Add the service account email (`client_email` from the JSON key) with **Editor** permission.

---

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-sa@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
SPREADSHEET_ID=your_spreadsheet_id_here
ADMIN_PASSWORD=your_secure_admin_password
PORT=5000
NODE_ENV=development
USE_MOCK_DATA=false
```

> **Tip:** To test the UI without Google Sheets, set `USE_MOCK_DATA=true`. The app will use built-in sample menu data and store orders in memory.

#### Safe Combos tab bootstrap (non-destructive)

If you only want to create the `Combos` tab and headers without touching any existing `Menu` / `Orders` data, run:

```bash
npm run sheet:ensure-combos
```

This command:
- Creates `Combos` tab only if missing
- Writes `Combos!A1:I1` headers only if row 1 is empty
- Never clears any ranges or overwrites existing combo data

---

### 4. Run Locally (Development)

```bash
# Terminal 1 – Backend
npm run dev

# Or run both together
npm run dev
```

- Customer app: http://localhost:3000
- Admin panel: http://localhost:3000/admin
- API: http://localhost:5000

---

### 5. Build for Production

```bash
npm run build
NODE_ENV=production npm start
```

The Express server will serve the built React app.

---

### 6. Deploy to Google Cloud Run

No Docker or container configuration needed — Cloud Run builds from source using buildpacks.

#### Prerequisites
- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed and authenticated
- A GCP project with Cloud Run and Cloud Build APIs enabled

#### Deployment command used

This is the exact flow used to deploy from source while reading production env values from `.env` and forcing Google Sheets mode (`USE_MOCK_DATA=false`).

1) Generate env vars file from `.env` (PowerShell):

```powershell
$envMap=@{}; Get-Content .env | ForEach-Object { $line=$_.Trim(); if($line -and -not $line.StartsWith('#') -and $line.Contains('=')){ $idx=$line.IndexOf('='); $k=$line.Substring(0,$idx).Trim(); $v=$line.Substring($idx+1).Trim(); if($v.StartsWith('"') -and $v.EndsWith('"')){ $v=$v.Substring(1,$v.Length-2) }; $envMap[$k]=$v } }; $sid=$envMap['SPREADSHEET_ID']; if($sid -match '/d/([a-zA-Z0-9-_]+)'){ $sid=$Matches[1] } elseif($sid -match '^d/([a-zA-Z0-9-_]+)$'){ $sid=$Matches[1] }; $envMap['SPREADSHEET_ID']=$sid; $envMap['USE_MOCK_DATA']='false'; $envMap['NODE_ENV']='production'; if(-not $envMap.ContainsKey('ADMIN_PASSWORD') -or [string]::IsNullOrWhiteSpace($envMap['ADMIN_PASSWORD'])){ $envMap['ADMIN_PASSWORD']='admin' }; $target = Join-Path $env:TEMP 'jts-ordering-cloudrun-env.yaml'; $keys = @('NODE_ENV','USE_MOCK_DATA','ADMIN_PASSWORD','SPREADSHEET_ID','GOOGLE_SERVICE_ACCOUNT_EMAIL','GOOGLE_PRIVATE_KEY'); $lines = @(); foreach($k in $keys){ $value = if($envMap.ContainsKey($k)) { [string]$envMap[$k] } else { '' }; $safe = $value -replace "'","''"; $lines += "${k}: '$safe'" }; Set-Content -Path $target -Value ($lines -join "`n") -NoNewline; Write-Output "ENV_FILE=$target"
```

2) Deploy to Cloud Run using the generated env file:

```powershell
gcloud run deploy jts-ordering-app --source . --allow-unauthenticated --region asia-south1 --memory 512Mi --cpu 1 --project jts-ordering-app --env-vars-file "$target"
```

On the first run, Cloud Run may prompt to create an Artifact Registry repository. Confirm with `Y`.

#### Subsequent deploys

Same command — Cloud Run creates a new revision and routes 100% of traffic to it automatically.

---

## App Overview

### Customer Flow
1. Browse the menu (organized by section)
2. Add items with `+` / `−` quantity controls
3. Tap **View Order** to see cart summary
4. Fill in delivery details
5. Tap **Place Order** to confirm

### Admin Panel (`/admin`)
- Password-protected login
- View all orders with status
- Filter by **date** or **status**
- Sort by date, amount, name, or status
- Select multiple orders → **Mark Dispatched** / **Mark Delivered**
- **Share with Vendor** – copies formatted order details to clipboard (or opens WhatsApp)

---

## Tech Stack

| Layer    | Technology                      |
|----------|---------------------------------|
| Frontend | React 18, React Router 6        |
| Styling  | Tailwind CSS (Play CDN)         |
| Backend  | Node.js, Express                |
| Data     | Google Sheets API v4            |
| Auth     | Google Service Account (OAuth2) |
