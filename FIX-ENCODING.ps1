# Manual JSON fix - writes proper UTF-8 without BOM

Write-Host "Manually fixing JSON files..." -ForegroundColor Yellow

# Delete corrupted files first
Remove-Item "package.json" -ErrorAction SilentlyContinue
Remove-Item "frontend\package.json" -ErrorAction SilentlyContinue
Remove-Item "app\package.json" -ErrorAction SilentlyContinue
Remove-Item "shared\package.json" -ErrorAction SilentlyContinue

# Root package.json
$content = @'
{
  "name": "modelrailway-workspace",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "app",
    "frontend",
    "shared"
  ],
  "scripts": {
    "setup": "npm install",
    "dev": "npm run dev --workspace=frontend"
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  }
}
'@
[System.IO.File]::WriteAllText("$PWD\package.json", $content, [System.Text.UTF8Encoding]::new($false))

# Frontend package.json
$content = @'
{
  "name": "modelrailway-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "@babylonjs/core": "^6.38.0",
    "@babylonjs/loaders": "^6.38.0"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "vite": "^5.0.10"
  }
}
'@
[System.IO.File]::WriteAllText("$PWD\frontend\package.json", $content, [System.Text.UTF8Encoding]::new($false))

# App package.json
$content = @'
{
  "name": "modelrailway-app",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "@tauri-apps/api": "^1.5.3"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^1.5.9",
    "typescript": "^5.3.3"
  }
}
'@
[System.IO.File]::WriteAllText("$PWD\app\package.json", $content, [System.Text.UTF8Encoding]::new($false))

# Shared package.json
$content = @'
{
  "name": "modelrailway-shared",
  "version": "0.1.0",
  "private": true,
  "main": "./types/index.ts"
}
'@
[System.IO.File]::WriteAllText("$PWD\shared\package.json", $content, [System.Text.UTF8Encoding]::new($false))

# Frontend tsconfig.json
$content = @'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "moduleResolution": "bundler",
    "skipLibCheck": true,
    "strict": true
  },
  "include": ["src"]
}
'@
[System.IO.File]::WriteAllText("$PWD\frontend\tsconfig.json", $content, [System.Text.UTF8Encoding]::new($false))

Write-Host "All JSON files recreated with proper UTF-8 encoding" -ForegroundColor Green
Write-Host ""
Write-Host "Now run:" -ForegroundColor Yellow
Write-Host "  npm run setup" -ForegroundColor White
Write-Host "  npm run dev" -ForegroundColor White
