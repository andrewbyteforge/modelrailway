# ModelRailway - Complete Setup
# This runs all setup scripts in the correct order

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Model Railway Workbench Setup" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Create folder structure
Write-Host "[1/3] Creating folder structure..." -ForegroundColor Yellow
& .\setup-modelrailway.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed at step 1" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Create schemas and examples
Write-Host "[2/3] Creating schemas and examples..." -ForegroundColor Yellow
& .\setup-schemas.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed at step 2" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 3: Create TypeScript types
Write-Host "[3/3] Creating TypeScript types..." -ForegroundColor Yellow
& .\setup-types.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed at step 3" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "✓ Setup Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Project structure created at:" -ForegroundColor White
Write-Host "  $(Get-Location)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Install dependencies:" -ForegroundColor White
Write-Host "     npm run setup" -ForegroundColor Cyan
Write-Host ""
Write-Host "  2. Install Rust (for Tauri):" -ForegroundColor White
Write-Host "     Visit: https://rustup.rs/" -ForegroundColor Cyan
Write-Host ""
Write-Host "  3. Install Tauri CLI:" -ForegroundColor White
Write-Host "     cargo install tauri-cli" -ForegroundColor Cyan
Write-Host ""
Write-Host "  4. Start development:" -ForegroundColor White
Write-Host "     npm run dev          # Frontend only" -ForegroundColor Cyan
Write-Host "     npm run tauri:dev    # With desktop wrapper" -ForegroundColor Cyan
Write-Host ""
