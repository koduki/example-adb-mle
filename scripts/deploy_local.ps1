$ErrorActionPreference = "Stop"

Write-Host "Deploying to Local Oracle 23ai Free..."

$DB_USER = "sneakerheadz"
$DB_PASS = "Welcome12345"
$DB_URL = "localhost:1521/freepdb1"
$CONN_STR = "$DB_USER/$DB_PASS@$DB_URL"

# Check if npm dependencies are installed (optional but good)
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..."
    npm install
}

# Run deployment script
Write-Host "Running: node scripts/deploy_db.js LOCAL $CONN_STR"
node scripts/deploy_db.js LOCAL $CONN_STR

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deployment Completed Successfully!" -ForegroundColor Green
} else {
    Write-Host "Deployment Failed." -ForegroundColor Red
    exit $LASTEXITCODE
}
