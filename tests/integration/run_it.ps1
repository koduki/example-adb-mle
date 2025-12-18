$ErrorActionPreference = "Stop"

$INFRA_DIR = Resolve-Path "../../infra"
$COMPOSE_FILE = Join-Path $INFRA_DIR "docker-compose.yml"
$DEPLOY_SCRIPT = Resolve-Path "../../scripts/deploy_local.ps1"
$TEST_SQL = Resolve-Path "integration_test.sql"

Write-Host "`n=== [Step 1] Starting Oracle Container (Fresh State) ===" -ForegroundColor Cyan
# Using --wait to ensure healthy status before proceeding
docker-compose -f $COMPOSE_FILE down -v --remove-orphans
docker-compose -f $COMPOSE_FILE up -d --wait

Write-Host "`n=== [Step 2] Deploying Application Scheme & Logic ===" -ForegroundColor Cyan
# Run the deployment helper
& $DEPLOY_SCRIPT

Write-Host "`n=== [Step 3] Running Integration Tests (SQL Logic) ===" -ForegroundColor Cyan
$DB_CONN = "sneakerheadz/Welcome12345@localhost:1521/freepdb1"

# Using sqlcl to run the test script
# Ensure 'sql' is in your PATH
try {
    sql -L $DB_CONN "@$TEST_SQL"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n>>> INTEGRATION TEST PASSED <<<" -ForegroundColor Green
    } else {
        throw "SQL Test script returned error code: $LASTEXITCODE"
    }
} catch {
    Write-Host "`n>>> INTEGRATION TEST FAILED <<<" -ForegroundColor Red
    Write-Host $_
    # Keep container up for debugging
    exit 1
}

Write-Host "`n=== [Step 4] Cleanup ===" -ForegroundColor Cyan
docker-compose -f $COMPOSE_FILE down

Write-Host "Done."
