/**
 * Train System Index
 * 
 * Path: frontend/src/systems/train/index.ts
 * 
 * Re-exports all train system modules for easy importing.
 * 
 * @module TrainSystem
 * @author Model Railway Workbench
 * @version 2.0.0 - Added modal-based selection and reposition handler
 */

// ============================================================================
// CORE TRAIN SYSTEM
// ============================================================================

/**
 * TrainSystem - Main train management system
 * Handles train registration, selection, keyboard controls
 */
export { TrainSystem } from './TrainSystem';
export type {
    TrainSystemConfig,
    TrainRepositionRequest
} from './TrainSystem';

/**
 * TrainController - Individual train controller
 * Manages physics, movement, and state for a single train
 */
export { TrainController } from './TrainController';
export type { TrainInfo } from './TrainController';

// ============================================================================
// TRAIN SELECTION & REPOSITIONING
// ============================================================================

/**
 * TrainRepositionHandler - Handles lift & move functionality
 * Activated when user chooses "Move" from selection modal
 */
export {
    TrainRepositionHandler,
    createTrainRepositionHandler
} from './TrainRepositionHandler';
export type { RepositionResult } from './TrainRepositionHandler';

/**
 * TrainMeshDetector - Utility for detecting train meshes
 * Used by other systems to check if a mesh belongs to a train
 */
export {
    registerTrainSystem,
    unregisterTrainSystem,
    getTrainSystem,
    isTrainMesh,
    getTrainIdFromMesh,
    getTrainClickBehavior
} from './TrainMeshDetector';
export type { TrainClickBehavior } from './TrainMeshDetector';

// ============================================================================
// TRACK INTEGRATION
// ============================================================================

/**
 * TrackEdgeFinder - Finds track edges for train placement
 */
export { TrackEdgeFinder } from './TrackEdgeFinder';
export type {
    EdgeFindResult,
    EdgeFindOptions
} from './TrackEdgeFinder';

/**
 * PointsManager - Manages track points/switches
 */
export { PointsManager } from './PointsManager';
export type {
    PointData,
    PointState,
    PointChangeEvent
} from './PointsManager';

// ============================================================================
// SOUND
// ============================================================================

/**
 * TrainSoundManager - Manages train sound effects
 */
export { TrainSoundManager } from './TrainSoundManager';

// ============================================================================
// ROLLING STOCK IMPORT
// ============================================================================

/**
 * RollingStockImporter - Handles importing rolling stock models
 */
export { RollingStockImporter } from './RollingStockImporter';

/**
 * RollingStockPositioner - Positions rolling stock on track
 */
export { RollingStockPositioner } from './RollingStockPositioner';

/**
 * RollingStockPlacer - Places rolling stock with preview
 */
export { RollingStockPlacer } from './RollingStockPlacer';

// ============================================================================
// TRAIN INTEGRATION
// ============================================================================

/**
 * TrainIntegration - Integrates train system with app
 */
export { TrainIntegration } from './TrainIntegration';

// ============================================================================
// POSITION HELPER
// ============================================================================

/**
 * TrainPositionHelper - Helps position trains correctly on track
 */
export { TrainPositionHelper } from './TrainPositionHelper';