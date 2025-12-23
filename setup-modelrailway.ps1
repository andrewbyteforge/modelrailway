# ModelRailway Project Setup Script
# Run this in PowerShell from D:\ModelRailway
# Usage: .\setup-modelrailway.ps1

Write-Host "Setting up ModelRailway project structure..." -ForegroundColor Cyan

# Create main directories
$folders = @(
    "app\src",
    "app\icons",
    "frontend\src\core",
    "frontend\src\systems\baseboard",
    "frontend\src\systems\camera",
    "frontend\src\systems\track",
    "frontend\src\systems\train",
    "frontend\src\systems\coupling",
    "frontend\src\systems\scenery",
    "frontend\src\systems\audio",
    "frontend\src\systems\input",
    "frontend\src\systems\assets",
    "frontend\src\systems\undo",
    "frontend\src\systems\weathering",
    "frontend\src\commands",
    "frontend\src\ui",
    "frontend\assets\models",
    "frontend\assets\textures",
    "frontend\assets\audio",
    "frontend\public",
    "shared\schemas",
    "shared\types",
    "docs\schemas",
    "examples\demo-layout\assets\models",
    "examples\demo-layout\assets\textures",
    "examples\demo-layout\assets\audio",
    "tools\scripts"
)

foreach ($folder in $folders) {
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
    Write-Host "✓ Created $folder" -ForegroundColor Green
}

# Root package.json (monorepo workspace)
$rootPackageJson = @'
{
  "name": "modelrailway-workspace",
  "version": "0.1.0",
  "private": true,
  "description": "Digital Model Railway Workbench - Monorepo",
  "workspaces": [
    "app",
    "frontend",
    "shared"
  ],
  "scripts": {
    "setup": "npm install",
    "dev": "npm run dev --workspace=frontend",
    "build": "npm run build --workspace=frontend",
    "tauri:dev": "npm run tauri dev --workspace=app",
    "tauri:build": "npm run tauri build --workspace=app"
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
'@
Set-Content -Path "package.json" -Value $rootPackageJson

# App (Tauri) package.json
$appPackageJson = @'
{
  "name": "modelrailway-app",
  "version": "0.1.0",
  "private": true,
  "description": "Model Railway Desktop App (Tauri)",
  "scripts": {
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  },
  "dependencies": {
    "@tauri-apps/api": "^1.5.3"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^1.5.9",
    "typescript": "^5.3.3"
  }
}
'@
Set-Content -Path "app\package.json" -Value $appPackageJson

# Frontend package.json
$frontendPackageJson = @'
{
  "name": "modelrailway-frontend",
  "version": "0.1.0",
  "private": true,
  "description": "Model Railway Frontend (Babylon.js)",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
  },
  "dependencies": {
    "@babylonjs/core": "^6.38.0",
    "@babylonjs/loaders": "^6.38.0",
    "@babylonjs/materials": "^6.38.0",
    "modelrailway-shared": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^20.10.6",
    "typescript": "^5.3.3",
    "vite": "^5.0.10"
  }
}
'@
Set-Content -Path "frontend\package.json" -Value $frontendPackageJson

# Shared package.json
$sharedPackageJson = @'
{
  "name": "modelrailway-shared",
  "version": "0.1.0",
  "private": true,
  "description": "Shared types and schemas",
  "main": "./types/index.ts",
  "types": "./types/index.ts",
  "exports": {
    ".": "./types/index.ts",
    "./schemas/*": "./schemas/*.json"
  },
  "files": [
    "types",
    "schemas"
  ]
}
'@
Set-Content -Path "shared\package.json" -Value $sharedPackageJson

# Frontend tsconfig.json
$frontendTsConfig = @'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@shared/*": ["../shared/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
'@
Set-Content -Path "frontend\tsconfig.json" -Value $frontendTsConfig

# Frontend tsconfig.node.json
$frontendTsConfigNode = @'
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
'@
Set-Content -Path "frontend\tsconfig.node.json" -Value $frontendTsConfigNode

# Frontend vite.config.ts
$frontendViteConfig = @'
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared')
    }
  },
  server: {
    port: 3000,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
'@
Set-Content -Path "frontend\vite.config.ts" -Value $frontendViteConfig

# Frontend index.html
$frontendIndexHtml = @'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Model Railway Workbench</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html { width: 100%; height: 100%; overflow: hidden; font-family: system-ui, -apple-system, sans-serif; }
    #renderCanvas { width: 100%; height: 100%; touch-action: none; display: block; }
  </style>
</head>
<body>
  <canvas id="renderCanvas"></canvas>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
'@
Set-Content -Path "frontend\index.html" -Value $frontendIndexHtml

# Frontend main.ts placeholder
$frontendMainTs = @'
/**
 * Model Railway Workbench - Entry Point
 */

import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import '@babylonjs/core/Loading/loadingScreen';

console.log('Model Railway Workbench starting...');

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
if (!canvas) {
  throw new Error('Canvas element not found');
}

// Create Babylon engine
const engine = new Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: true,
  disableWebGL2Support: false
});

// Create scene
const scene = new Scene(engine);

console.log('Engine and scene initialized');
console.log('Babylon.js version:', Engine.Version);

// Render loop
engine.runRenderLoop(() => {
  scene.render();
});

// Handle window resize
window.addEventListener('resize', () => {
  engine.resize();
});

console.log('✓ Model Railway Workbench initialized');
'@
Set-Content -Path "frontend\src\main.ts" -Value $frontendMainTs

# Core placeholder files
$coreFiles = @{
    "frontend\src\core\App.ts" = "// App.ts - Application lifecycle manager"
    "frontend\src\core\Project.ts" = "// Project.ts - Project state manager"
    "frontend\src\core\Persistence.ts" = "// Persistence.ts - Save/load operations"
}

foreach ($file in $coreFiles.GetEnumerator()) {
    Set-Content -Path $file.Key -Value $file.Value
}

# System placeholder files
$systemFiles = @{
    "frontend\src\systems\baseboard\BaseboardSystem.ts" = "// BaseboardSystem.ts - Table and board rendering"
    "frontend\src\systems\camera\CameraSystem.ts" = "// CameraSystem.ts - Orbit and walk cameras"
    "frontend\src\systems\track\TrackGraph.ts" = "// TrackGraph.ts - Track graph data structure"
    "frontend\src\systems\track\TrackRenderer.ts" = "// TrackRenderer.ts - Visual track generation"
    "frontend\src\systems\train\TrainSystem.ts" = "// TrainSystem.ts - Train movement and physics"
    "frontend\src\systems\coupling\CouplingSystem.ts" = "// CouplingSystem.ts - Coupling logic"
    "frontend\src\systems\scenery\ScenerySystem.ts" = "// ScenerySystem.ts - Scenery placement"
    "frontend\src\systems\audio\AudioSystem.ts" = "// AudioSystem.ts - Audio playback"
    "frontend\src\systems\undo\CommandStack.ts" = "// CommandStack.ts - Undo/redo implementation"
}

foreach ($file in $systemFiles.GetEnumerator()) {
    Set-Content -Path $file.Key -Value $file.Value
}

# .gitignore
$gitignore = @'
# Dependencies
node_modules/
.pnp/
.pnp.js

# Build outputs
dist/
build/
out/

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Editor
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local

# Tauri
app/target/
app/src-tauri/target/

# TypeScript
*.tsbuildinfo

# Testing
coverage/

# Temp
*.tmp
temp/
cache/
'@
Set-Content -Path ".gitignore" -Value $gitignore

# README.md
$readme = @'
# Model Railway Workbench

A single-player, offline desktop application for designing and operating miniature model railway layouts.

## Technology Stack

- **Rendering**: Babylon.js (WebGL)
- **Language**: TypeScript
- **Desktop Wrapper**: Tauri
- **Scale**: OO (1:76.2)

## Project Structure

```
├── app/           Desktop wrapper (Tauri)
├── frontend/      Babylon.js UI and systems
├── shared/        Schemas and TypeScript types
├── docs/          Documentation
├── examples/      Example layouts
└── tools/         Build scripts
```

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Rust (for Tauri)

### Installation

```bash
npm run setup
```

### Development

```bash
# Run frontend only (browser)
npm run dev

# Run with Tauri wrapper
npm run tauri:dev
```

### Build

```bash
npm run tauri:build
```

## Documentation

See `docs/` folder for detailed documentation.

## License

Private project - All rights reserved
'@
Set-Content -Path "README.md" -Value $readme

Write-Host "`n✓ Project structure created successfully!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Run: npm run setup" -ForegroundColor White
Write-Host "2. Install Rust from https://rustup.rs/ (for Tauri)" -ForegroundColor White
Write-Host "3. Run: cargo install tauri-cli" -ForegroundColor White
Write-Host "4. Run: npm run dev (to start frontend)" -ForegroundColor White
