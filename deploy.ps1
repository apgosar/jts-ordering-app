# =============================================================================
# deploy.ps1 - Build & deploy JTS Ordering App to Google Cloud Run
# Usage: .\deploy.ps1
# =============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# -- Config -------------------------------------------------------------------
$SERVICE_NAME  = "jts-ordering-app"
$PROJECT       = "jts-ordering-app"
$REGION        = "asia-south1"        # Mumbai - closest to India
$PLATFORM      = "managed"
$MEMORY        = "512Mi"
$ENV_FILE      = ".env"

# -- 1. Confirm project -------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " JTS Ordering App - Cloud Run Deploy"    -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Project : $PROJECT"
Write-Host "  Service : $SERVICE_NAME"
Write-Host "  Region  : $REGION"
Write-Host ""

# -- 2. Parse .env and build --set-env-vars string ----------------------------
if (-not (Test-Path $ENV_FILE)) {
    Write-Error ".env file not found at $ENV_FILE"
    exit 1
}

$envPairs = @()
Get-Content $ENV_FILE | ForEach-Object {
    $line = $_.Trim()

    # Skip blank lines and comments
    if ($line -eq "" -or $line.StartsWith("#")) { return }

    # Split only on the FIRST '='
    $eqIndex = $line.IndexOf('=')
    if ($eqIndex -lt 1) { return }

    $key   = $line.Substring(0, $eqIndex).Trim()
    $value = $line.Substring($eqIndex + 1).Trim()

    # Strip surrounding double-quotes if present
    if ($value.StartsWith('"') -and $value.EndsWith('"')) {
        $value = $value.Substring(1, $value.Length - 2)
    }

    # Override NODE_ENV for production
    if ($key -eq "NODE_ENV") { $value = "production" }

    # Skip PORT - Cloud Run injects its own $PORT
    if ($key -eq "PORT") { return }

    # Escape commas in the value (Cloud Run uses comma as delimiter)
    $value = $value -replace ',', '\,'

    $envPairs += "${key}=${value}"
}

if ($envPairs.Count -eq 0) {
    Write-Warning "No environment variables parsed from $ENV_FILE - deploying without --set-env-vars."
    $envVarsArg = @()
} else {
    $envVarsString = $envPairs -join ","
    $envVarsArg    = @("--set-env-vars", $envVarsString)
    Write-Host "Parsed $($envPairs.Count) env var(s) from $ENV_FILE" -ForegroundColor Green
}

# -- 3. Build React client ----------------------------------------------------
Write-Host ""
Write-Host "Building React client..." -ForegroundColor Yellow
Push-Location client
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "React build failed (exit $LASTEXITCODE)" }
} finally {
    Pop-Location
}
Write-Host "React build complete." -ForegroundColor Green

# -- 4. Deploy to Cloud Run ---------------------------------------------------
Write-Host ""
Write-Host "Deploying to Cloud Run..." -ForegroundColor Yellow

$deployArgs = @(
    "run", "deploy", $SERVICE_NAME,
    "--source", ".",
    "--project", $PROJECT,
    "--region", $REGION,
    "--platform", $PLATFORM,
    "--memory", $MEMORY,
    "--allow-unauthenticated"
) + $envVarsArg

Write-Host "Running: gcloud $($deployArgs -join ' ')" -ForegroundColor DarkGray
Write-Host ""

& gcloud @deployArgs

if ($LASTEXITCODE -ne 0) {
    Write-Error "Cloud Run deployment failed (exit $LASTEXITCODE)"
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Deployment complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Print the service URL
$serviceUrl = (gcloud run services describe $SERVICE_NAME --project $PROJECT --region $REGION --format "value(status.url)" 2>$null).Trim()
if ($serviceUrl) {
    Write-Host "  URL: $serviceUrl" -ForegroundColor Cyan
}
