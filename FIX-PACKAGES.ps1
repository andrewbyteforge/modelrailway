# Fix corrupted JSON files

Write-Host "Fixing package.json files..." -ForegroundColor Yellow

# Root package.json
$rootPkg = @{
    name = "modelrailway-workspace"
    version = "0.1.0"
    private = $true
    workspaces = @("app", "frontend", "shared")
    scripts = @{
        setup = "npm install"
        dev = "npm run dev --workspace=frontend"
    }
    devDependencies = @{
        typescript = "^5.3.3"
    }
}
$rootPkg | ConvertTo-Json -Depth 10 | Set-Content "package.json" -Encoding UTF8

# Frontend package.json
$frontendPkg = @{
    name = "modelrailway-frontend"
    version = "0.1.0"
    private = $true
    type = "module"
    scripts = @{
        dev = "vite"
        build = "vite build"
    }
    dependencies = @{
        "@babylonjs/core" = "^6.38.0"
        "@babylonjs/loaders" = "^6.38.0"
    }
    devDependencies = @{
        typescript = "^5.3.3"
        vite = "^5.0.10"
    }
}
$frontendPkg | ConvertTo-Json -Depth 10 | Set-Content "frontend\package.json" -Encoding UTF8

# App package.json
$appPkg = @{
    name = "modelrailway-app"
    version = "0.1.0"
    private = $true
    dependencies = @{
        "@tauri-apps/api" = "^1.5.3"
    }
    devDependencies = @{
        "@tauri-apps/cli" = "^1.5.9"
        typescript = "^5.3.3"
    }
}
$appPkg | ConvertTo-Json -Depth 10 | Set-Content "app\package.json" -Encoding UTF8

# Shared package.json
$sharedPkg = @{
    name = "modelrailway-shared"
    version = "0.1.0"
    private = $true
    main = "./types/index.ts"
}
$sharedPkg | ConvertTo-Json -Depth 10 | Set-Content "shared\package.json" -Encoding UTF8

Write-Host "Fixed!" -ForegroundColor Green
Write-Host "Now run: npm run setup" -ForegroundColor Yellow
