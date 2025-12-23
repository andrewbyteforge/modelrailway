# ModelRailway - Create TypeScript Type Definitions
# Run this AFTER setup-schemas.ps1

Write-Host "Creating TypeScript type definitions..." -ForegroundColor Cyan

# Create shared/types/index.ts (main export)
$indexTs = @'
/**
 * Shared TypeScript Types for Model Railway Workbench
 * Auto-generated type definitions matching JSON schemas
 */

export * from './project.types';
export * from './layout.types';
export * from './common.types';
'@
Set-Content -Path "shared\types\index.ts" -Value $indexTs
Write-Host "✓ Created shared/types/index.ts" -ForegroundColor Green

# Create common.types.ts
$commonTypes = @'
/**
 * Common types used across the project
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Transform {
  pos: Vec3;
  rot: Quaternion;
  scale?: number;
}

export type SwitchState = 'A' | 'B';
export type TrainDirection = 1 | -1;
export type RollingStockType = 'loco' | 'car';
export type AssetSource = 'builtin' | 'imported';
'@
Set-Content -Path "shared\types\common.types.ts" -Value $commonTypes
Write-Host "✓ Created shared/types/common.types.ts" -ForegroundColor Green

# Create project.types.ts
$projectTypes = @'
/**
 * Project configuration types
 */

export interface Project {
  schemaVersion: string;
  projectId: string;
  name: string;
  description?: string;
  units: ProjectUnits;
  board: BoardConfig;
  table: TableConfig;
  camera?: CameraConfig;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectUnits {
  worldUnit: 'meter';
  lengthUnit: 'meter' | 'centimeter' | 'millimeter';
  scale: ScaleConfig;
}

export interface ScaleConfig {
  standard: 'OO';
  ratio: 76.2;
}

export interface BoardConfig {
  widthM: number;
  depthM: number;
  thicknessM: number;
  heightFromFloorM: number;
  origin?: 'center' | 'frontLeftCorner';
}

export interface TableConfig {
  enabled: boolean;
  style: 'simpleWood' | 'modern' | 'trestle';
  legInsetM?: number;
}

export interface CameraConfig {
  defaultMode?: 'orbit' | 'walk';
  orbit?: OrbitCameraConfig;
  walk?: WalkCameraConfig;
}

export interface OrbitCameraConfig {
  minRadiusM?: number;
  maxRadiusM?: number;
}

export interface WalkCameraConfig {
  eyeHeightM?: number;
}
'@
Set-Content -Path "shared\types\project.types.ts" -Value $projectTypes
Write-Host "✓ Created shared/types/project.types.ts" -ForegroundColor Green

# Create layout.types.ts
$layoutTypes = @'
/**
 * Layout state types
 */

import { Vec3, Quaternion, Transform, SwitchState, TrainDirection, RollingStockType, AssetSource } from './common.types';

export interface Layout {
  schemaVersion: string;
  layoutId: string;
  projectId: string;
  graph: TrackGraph;
  pieces: TrackPiece[];
  switches: SwitchState[];
  blocks: Block[];
  rollingStock: RollingStock[];
  trains: Train[];
  scenery: SceneryItem[];
  weathering: WeatheringConfig;
  createdAt: string;
  updatedAt: string;
}

export interface TrackGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  pos: Vec3;
}

export interface GraphEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  lengthM: number;
  curve: CurveDefinition;
  pieceId: string;
}

export type CurveDefinition = 
  | { type: 'straight' }
  | { type: 'arc'; arcRadiusM: number; arcAngleDeg: number };

export interface TrackPiece {
  id: string;
  catalogId: string;
  transform: Transform;
  connectors: Connector[];
  generatedEdgeIds: string[];
  isSwitch: boolean;
  switchDefinition?: SwitchDefinition;
}

export interface Connector {
  id: string;
  localPos: Vec3;
  localForward: Vec3;
  nodeId: string;
}

export interface SwitchDefinition {
  commonNodeId: string;
  stateAEdgeId: string;
  stateBEdgeId: string;
}

export interface SwitchStateEntry {
  pieceId: string;
  state: SwitchState;
}

export interface Block {
  id: string;
  edgeIds: string[];
  occupiedByTrainId: string | null;
}

export interface RollingStock {
  id: string;
  type: RollingStockType;
  name: string;
  asset: AssetReference;
  locoProps?: LocoProperties;
  couplers: CouplerDefinition;
}

export interface AssetReference {
  source: AssetSource;
  uri: string;
}

export interface LocoProperties {
  maxSpeedMps: number;
  accelMps2: number;
  brakeMps2: number;
}

export interface CouplerDefinition {
  front: { nodeName: string };
  rear: { nodeName: string };
}

export interface Train {
  id: string;
  name: string;
  cars: TrainCar[];
  motion: TrainMotion;
  position: TrainPosition;
  occupiedBlockIds: string[];
}

export interface TrainCar {
  rollingStockId: string;
}

export interface TrainMotion {
  throttle: number;
  targetSpeedMps: number;
  currentSpeedMps: number;
}

export interface TrainPosition {
  edgeId: string;
  sM: number;
  dir: TrainDirection;
}

export interface SceneryItem {
  id: string;
  catalogId: string;
  transform: Transform;
  tags?: string[];
}

export interface WeatheringConfig {
  enabled: boolean;
  intensity: number;
}
'@
Set-Content -Path "shared\types\layout.types.ts" -Value $layoutTypes
Write-Host "✓ Created shared/types/layout.types.ts" -ForegroundColor Green

# Create a basic catalog.types.ts for track piece definitions
$catalogTypes = @'
/**
 * Track and asset catalog types
 */

import { Vec3, Quaternion } from './common.types';

export interface TrackCatalogEntry {
  id: string;
  name: string;
  lengthM: number;
  type: 'straight' | 'curve' | 'switch';
  connectorTemplates: ConnectorTemplate[];
  visualProps?: TrackVisualProperties;
}

export interface ConnectorTemplate {
  id: string;
  localPos: Vec3;
  localForward: Vec3;
}

export interface TrackVisualProperties {
  railColor?: string;
  sleeperColor?: string;
  ballastColor?: string;
}

export interface AssetCatalogEntry {
  id: string;
  name: string;
  category: 'scenery' | 'structure' | 'vehicle';
  source: string;
  thumbnailUrl?: string;
  tags?: string[];
  bounds?: {
    width: number;
    height: number;
    depth: number;
  };
}
'@
Set-Content -Path "shared\types\catalog.types.ts" -Value $catalogTypes
Write-Host "✓ Created shared/types/catalog.types.ts" -ForegroundColor Green

Write-Host "`n✓ All TypeScript type definitions created!" -ForegroundColor Green
