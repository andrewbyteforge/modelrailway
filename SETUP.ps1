# ModelRailway Complete Setup Script
# Run with: powershell -ExecutionPolicy Bypass -File .\SETUP.ps1

Write-Host '=====================================' -ForegroundColor Cyan
Write-Host 'Model Railway Workbench Setup' -ForegroundColor Cyan
Write-Host '=====================================' -ForegroundColor Cyan
Write-Host ''

# Create all directories
Write-Host 'Creating folder structure...' -ForegroundColor Yellow

$folders = @(
    'app\src', 'app\icons',
    'frontend\src\core',
    'frontend\src\systems\baseboard', 'frontend\src\systems\camera',
    'frontend\src\systems\track', 'frontend\src\systems\train',
    'frontend\src\systems\coupling', 'frontend\src\systems\scenery',
    'frontend\src\systems\audio', 'frontend\src\systems\input',
    'frontend\src\systems\assets', 'frontend\src\systems\undo',
    'frontend\src\systems\weathering', 'frontend\src\commands', 'frontend\src\ui',
    'frontend\assets\models', 'frontend\assets\textures', 'frontend\assets\audio',
    'frontend\public',
    'shared\schemas', 'shared\types',
    'docs\schemas',
    'examples\demo-layout\assets\models',
    'examples\demo-layout\assets\textures',
    'examples\demo-layout\assets\audio',
    'tools\scripts'
)

foreach ($folder in $folders) {
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
}
Write-Host 'Folders created' -ForegroundColor Green

# Create package.json files
Write-Host 'Creating configuration files...' -ForegroundColor Yellow

# Root package.json
'{"name":"modelrailway-workspace","version":"0.1.0","private":true,"workspaces":["app","frontend","shared"],"scripts":{"setup":"npm install","dev":"npm run dev --workspace=frontend"},"devDependencies":{"typescript":"^5.3.3"}}' | Out-File -FilePath 'package.json' -Encoding utf8

# App package.json
'{"name":"modelrailway-app","version":"0.1.0","private":true,"dependencies":{"@tauri-apps/api":"^1.5.3"},"devDependencies":{"@tauri-apps/cli":"^1.5.9"}}' | Out-File -FilePath 'app\package.json' -Encoding utf8

# Frontend package.json
'{"name":"modelrailway-frontend","version":"0.1.0","private":true,"type":"module","scripts":{"dev":"vite","build":"vite build"},"dependencies":{"@babylonjs/core":"^6.38.0","@babylonjs/loaders":"^6.38.0"},"devDependencies":{"typescript":"^5.3.3","vite":"^5.0.10"}}' | Out-File -FilePath 'frontend\package.json' -Encoding utf8

# Shared package.json
'{"name":"modelrailway-shared","version":"0.1.0","private":true,"main":"./types/index.ts"}' | Out-File -FilePath 'shared\package.json' -Encoding utf8

# Frontend index.html
$html = @'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Model Railway Workbench</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html { width: 100%; height: 100%; overflow: hidden; }
    #renderCanvas { width: 100%; height: 100%; display: block; }
  </style>
</head>
<body>
  <canvas id="renderCanvas"></canvas>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
'@
$html | Out-File -FilePath 'frontend\index.html' -Encoding utf8

# Frontend main.ts
$mainTs = @'
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const engine = new Engine(canvas, true);
const scene = new Scene(engine);

console.log('Model Railway Workbench initialized');

engine.runRenderLoop(() => {
  scene.render();
});

window.addEventListener('resize', () => {
  engine.resize();
});
'@
$mainTs | Out-File -FilePath 'frontend\src\main.ts' -Encoding utf8

# Frontend tsconfig.json
'{"compilerOptions":{"target":"ES2020","module":"ESNext","lib":["ES2020","DOM"],"moduleResolution":"bundler","skipLibCheck":true,"strict":true},"include":["src"]}' | Out-File -FilePath 'frontend\tsconfig.json' -Encoding utf8

# Frontend vite.config.ts
'import { defineConfig } from ''vite''; export default defineConfig({ server: { port: 3000 } });' | Out-File -FilePath 'frontend\vite.config.ts' -Encoding utf8

Write-Host 'Configuration files created' -ForegroundColor Green

# Create schemas
Write-Host 'Creating schemas...' -ForegroundColor Yellow

$projectSchema = @'
{
  "schemaVersion": "1.0.0",
  "projectId": "project_demo_001",
  "name": "Demo Project",
  "units": {
    "worldUnit": "meter",
    "scale": { "standard": "OO", "ratio": 76.2 }
  },
  "board": {
    "widthM": 1.2,
    "depthM": 0.6,
    "thicknessM": 0.025,
    "heightFromFloorM": 0.9
  },
  "table": { "enabled": true, "style": "simpleWood" }
}
'@
$projectSchema | Out-File -FilePath 'shared\schemas\project.schema.json' -Encoding utf8

$layoutSchema = @'
{
  "schemaVersion": "1.0.0",
  "layoutId": "layout_demo_001",
  "projectId": "project_demo_001",
  "graph": {
    "nodes": [
      { "id": "n0", "pos": { "x": -0.168, "y": 0.0, "z": 0.0 } },
      { "id": "n1", "pos": { "x": 0.0, "y": 0.0, "z": 0.0 } }
    ],
    "edges": []
  },
  "pieces": [],
  "switches": [],
  "blocks": [],
  "rollingStock": [],
  "trains": [],
  "scenery": [],
  "weathering": { "enabled": true, "intensity": 0.25 }
}
'@
$layoutSchema | Out-File -FilePath 'shared\schemas\layout.schema.json' -Encoding utf8

$exampleProject = @'
{
  "schemaVersion": "1.0.0",
  "projectId": "project_demo_001",
  "name": "Demo Layout"
}
'@
$exampleProject | Out-File -FilePath 'examples\demo-layout\project.json' -Encoding utf8

Write-Host 'Schemas created' -ForegroundColor Green

# Create TypeScript types
Write-Host 'Creating TypeScript types...' -ForegroundColor Yellow

$types = @'
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Train {
  id: string;
  name: string;
  position: {
    edgeId: string;
    sM: number;
    dir: 1 | -1;
  };
}
'@
$types | Out-File -FilePath 'shared\types\index.ts' -Encoding utf8

Write-Host 'TypeScript types created' -ForegroundColor Green

# Create placeholder files
'// App.ts - Application lifecycle' | Out-File -FilePath 'frontend\src\core\App.ts' -Encoding utf8
'// Project.ts - Project management' | Out-File -FilePath 'frontend\src\core\Project.ts' -Encoding utf8
'// Persistence.ts - Save and load' | Out-File -FilePath 'frontend\src\core\Persistence.ts' -Encoding utf8

# System files
'// BaseboardSystem.ts' | Out-File -FilePath 'frontend\src\systems\baseboard\BaseboardSystem.ts' -Encoding utf8
'// CameraSystem.ts' | Out-File -FilePath 'frontend\src\systems\camera\CameraSystem.ts' -Encoding utf8
'// TrackGraph.ts' | Out-File -FilePath 'frontend\src\systems\track\TrackGraph.ts' -Encoding utf8
'// TrainSystem.ts' | Out-File -FilePath 'frontend\src\systems\train\TrainSystem.ts' -Encoding utf8

# .gitignore
$gitignore = @'
node_modules/
dist/
*.log
.DS_Store
'@
$gitignore | Out-File -FilePath '.gitignore' -Encoding utf8

# README
$readme = @'
# Model Railway Workbench

Desktop application for designing model railway layouts.

## Setup

npm run setup
npm run dev
'@
$readme | Out-File -FilePath 'README.md' -Encoding utf8

Write-Host ''
Write-Host '=====================================' -ForegroundColor Green
Write-Host 'Setup Complete!' -ForegroundColor Green
Write-Host '=====================================' -ForegroundColor Green
Write-Host ''
Write-Host 'Next steps:' -ForegroundColor Yellow
Write-Host '  1. npm run setup' -ForegroundColor White
Write-Host '  2. npm run dev' -ForegroundColor White
Write-Host ''
