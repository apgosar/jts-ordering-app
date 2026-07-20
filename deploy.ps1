# =============================================================================
# deploy.ps1 - Build & deploy JTS Ordering App to Google Cloud Run
# Usage: .\deploy.ps1
# =============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# -- Config -------------------------------------------------------------------
$SERVICE_NAME = "jts-ordering-app"
$PROJECT_ID   = "jts-ordering-app"
$REGION       = "asia-south1"        # Mumbai - closest to India
$MEMORY       = "256Mi"              # 256Mi is sufficient for Express + static files
$CPU          = "1"                  # 1 vCPU (required when concurrency > 1)
$CONCURRENCY  = "80"                 # Max concurrent requests per instance
$ENV_FILE     = ".env"
$ENV_YAML     = "env.yaml"           # Temp file; deleted after deploy

# -- Banner -------------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  JTS Ordering App - Cloud Run Deploy"   -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Project : $PROJECT_ID"
Write-Host "  Service : $SERVICE_NAME"
Write-Host "  Region  : $REGION"
Write-Host ""

# -- 1. Check gcloud is installed ---------------------------------------------
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Error "gcloud CLI not found. Install it from https://cloud.google.com/sdk/docs/install"
    exit 1
}

# -- 2. Check gcloud authentication -------------------------------------------
$activeAccount = (gcloud auth list --filter="status:ACTIVE" --format="value(account)" 2>$null).Trim()
if (-not $activeAccount) {
    Write-Error "Not authenticated with gcloud. Run: gcloud auth login"
    exit 1
}
Write-Host "Authenticated as: $activeAccount" -ForegroundColor Green

# -- 3. Set project -----------------------------------------------------------
gcloud config set project $PROJECT_ID --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to set gcloud project to $PROJECT_ID"
    exit 1
}

# -- 4. Read and validate .env ------------------------------------------------
if (-not (Test-Path $ENV_FILE)) {
    Write-Error ".env file not found. Copy .env.example to .env and fill in values."
    exit 1
}

$envMap = @{}
Get-Content $ENV_FILE | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $eqIndex = $line.IndexOf('=')
    if ($eqIndex -lt 1) { return }
    $key   = $line.Substring(0, $eqIndex).Trim()
    $value = $line.Substring($eqIndex + 1).Trim()
    if ($value.StartsWith('"') -and $value.EndsWith('"')) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    $envMap[$key] = $value
}

# -- 5. Validate required secrets ---------------------------------------------
$required = @("GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_PRIVATE_KEY", "SPREADSHEET_ID", "ADMIN_PASSWORD")
foreach ($key in $required) {
    if (-not $envMap.ContainsKey($key) -or $envMap[$key] -eq "") {
        Write-Error "Required env var '$key' is missing or empty in $ENV_FILE"
        exit 1
    }
}

if ($envMap["ADMIN_PASSWORD"] -eq "changeme") {
    Write-Error "ADMIN_PASSWORD is still 'changeme'. Set a real password before deploying."
    exit 1
}

Write-Host "All required env vars validated." -ForegroundColor Green

# -- 6. Build env.yaml (handles multiline GOOGLE_PRIVATE_KEY safely) ----------
$yamlLines = @()
foreach ($key in $envMap.Keys) {
    if ($key -eq "PORT") { continue }            # Cloud Run injects its own PORT
    $val = $envMap[$key]
    if ($key -eq "NODE_ENV") { $val = "production" }

    # Expand literal \n sequences in private key to real newlines for YAML
    if ($key -eq "GOOGLE_PRIVATE_KEY") {
        $val = $val -replace '\\n', "`n"
    }

    # YAML block scalar for multiline values (private key)
    if ($val -match "`n") {
        $yamlLines += "${key}: |"
        $val -split "`n" | ForEach-Object { $yamlLines += "  $_" }
    } else {
        # Quote the value to handle special characters
        $escaped = $val -replace '"', '\"'
        $yamlLines += "${key}: `"$escaped`""
    }
}
$yamlLines | Set-Content $ENV_YAML -Encoding UTF8
Write-Host "env.yaml written with $($envMap.Count) var(s)." -ForegroundColor Green

# -- 7. Enable required Cloud APIs --------------------------------------------
Write-Host "Ensuring required Cloud APIs are enabled..." -ForegroundColor Yellow
gcloud services enable run.googleapis.com cloudbuild.googleapis.com --project $PROJECT_ID --quiet

# -- 8. Deploy to Cloud Run ---------------------------------------------------
Write-Host ""
Write-Host "Deploying to Cloud Run..." -ForegroundColor Yellow
Write-Host ""

try {
    gcloud run deploy $SERVICE_NAME `
        --source . `
        --project $PROJECT_ID `
        --region $REGION `
        --platform managed `
        --allow-unauthenticated `
        --port 8080 `
        --cpu $CPU `
        --memory $MEMORY `
        --concurrency $CONCURRENCY `
        --min-instances 0 `
        --max-instances 3 `
        --cpu-throttling `
        --no-cpu-boost `
        --env-vars-file $ENV_YAML `
        --clear-base-image `
        --quiet

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Cloud Run deployment failed (exit $LASTEXITCODE)"
        exit $LASTEXITCODE
    }
} finally {
    # Always clean up env.yaml so secrets are not left on disk
    if (Test-Path $ENV_YAML) {
        Remove-Item $ENV_YAML -Force
        Write-Host "env.yaml cleaned up." -ForegroundColor DarkGray
    }
}

# -- 9. Fetch deployed URL ----------------------------------------------------
Write-Host ""
$serviceUrl = (gcloud run services describe $SERVICE_NAME `
    --project $PROJECT_ID `
    --region $REGION `
    --format "value(status.url)" 2>$null).Trim()

Write-Host "========================================" -ForegroundColor Green
Write-Host "  Deployment complete!" -ForegroundColor Green
if ($serviceUrl) {
    Write-Host "  URL: $serviceUrl" -ForegroundColor Cyan
}
Write-Host "========================================" -ForegroundColor Green

# -- 10. Auto-update PRODUCTION_DOMAIN env var on Cloud Run (for CORS) --------
if ($serviceUrl) {
    Write-Host ""
    Write-Host "Updating PRODUCTION_DOMAIN on Cloud Run for CORS..." -ForegroundColor Yellow
    $domain = $serviceUrl -replace 'https://', ''
    gcloud run services update $SERVICE_NAME `
        --project $PROJECT_ID `
        --region $REGION `
        --update-env-vars "PRODUCTION_DOMAIN=$domain" `
        --quiet 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "PRODUCTION_DOMAIN set to: $domain" -ForegroundColor Green
    } else {
        Write-Warning "Could not auto-update PRODUCTION_DOMAIN. Set it manually if CORS issues arise."
    }
}
