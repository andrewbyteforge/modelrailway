/**
 * Train System Index
 *
 * Path: frontend/src/systems/train/index.ts
 *
 * Re-exports all train system modules for easy importing.
 *
 * @module TrainSystem
 * @author Model Railway Workbench
 * @version 3.0.0 - Reorganised into subfolders
 */

// ============================================================================
// CORE TRAIN SYSTEM
// ============================================================================

/**
 * TrainSystem - Main train management system
 * Handles train registration, selection, keyboard controls
 */
export { TrainSystem } from './core/TrainSystem';
export type {
    TrainSystemConfig,
    TrainRepositionRequest
} from './core/TrainSystem';

/**
 * TrainController - Individual train controller
 * Manages physics, movement, and state for a single train
 */
export { TrainController } from './core/TrainController';
export type { TrainInfo } from './core/TrainController';

/**
 * TrainSystemTypes - Shared type definitions
 */
export {
    INPUT_LOG_PREFIX,
    DEFAULT_KEYBOARD_CONTROLS
} from './core/TrainSystemTypes';
export type {
    TrainInputDelegate,
    TrainInputConfig,
    TrainKeyboardControls
} from './core/TrainSystemTypes';

/**
 * TrainIntegration - Integrates train system with app
 */
export { TrainIntegration, createGlobalHelpers } from './core/TrainIntegration';

// ============================================================================
// PHYSICS & MOVEMENT
// ============================================================================

/**
 * TrainPhysics - Physics simulation for trains
 */
export { TrainPhysics } from './physics/TrainPhysics';
export type {
    TrainPhysicsState,
    TrainPhysicsConfig,
    TrainDirection
} from './physics/TrainPhysics';

/**
 * TrainPathFollower - Path following for trains
 */
export { TrainPathFollower } from './physics/TrainPathFollower';

/**
 * TrainPositionHelper - Helps position trains correctly on track
 */
export { TrainPositionHelper, getTrainPositionHelper, TRACK_HEIGHTS } from './physics/TrainPositionHelper';
export type {
    PositionOptions,
    AutoScaleResult
} from './physics/TrainPositionHelper';

// ============================================================================
// INPUT & CONTROLS
// ============================================================================

/**
 * TrainInputHandler - Handles keyboard and pointer input
 */
export { TrainInputHandler } from './input/TrainInputHandler';

/**
 * TrainRepositionHandler - Handles lift & move functionality
 * Activated when user chooses "Move" from selection modal
 */
export {
    TrainRepositionHandler,
    createTrainRepositionHandler
} from './input/TrainRepositionHandler';
export type { RepositionResult } from './input/TrainRepositionHandler';

// ============================================================================
// TRACK INTEGRATION
// ============================================================================

/**
 * TrackEdgeFinder - Finds track edges for train placement
 */
export { TrackEdgeFinder } from './track/TrackEdgeFinder';
export type {
    EdgeFindResult,
    EdgeFindOptions
} from './track/TrackEdgeFinder';

/**
 * TrackPathHelper - Track path utilities
 */
export { TrackPathHelper, getTrackPathHelper } from './track/TrackPathHelper';
export type {
    TrackPose,
    TrackPoint,
    ClosestPointResult,
    TrackPath
} from './track/TrackPathHelper';

/**
 * PointsManager - Manages track points/switches
 */
export { PointsManager } from './track/PointsManager';
export type {
    PointData,
    PointState,
    PointChangeEvent
} from './track/PointsManager';

/**
 * PointsIndicator - Visual indicators for points
 */
export { PointsIndicator } from './track/PointsIndicator';

// ============================================================================
// ROLLING STOCK
// ============================================================================

/**
 * RollingStockImporter - Handles importing rolling stock models
 */
export { RollingStockImporter } from './rolling-stock/RollingStockImporter';

/**
 * RollingStockPositioner - Positions rolling stock on track
 */
export { RollingStockPositioner, OO_GAUGE, PLACEMENT_CONFIG } from './rolling-stock/RollingStockPositioner';
export type {
    RollingStockInfo,
    RollingStockCategory,
    ModelForwardAxis,
    EdgeDetectionResult,
    VehiclePlacement,
    ConsistPlacement,
    PendingVehicle,
    PlacementCompleteEvent,
    PlacementCancelledEvent
} from './rolling-stock/RollingStockPositioner';

/**
 * RollingStockPlacer - Places rolling stock with preview
 */
export { RollingStockPlacer } from './rolling-stock/RollingStockPlacer';

/**
 * ModelAxisDetector - Detects model forward axis
 */
export { ModelAxisDetector, getModelAxisDetector, detectModelForwardAxis } from './rolling-stock/ModelAxisDetector';
export type {
    ForwardAxis,
    ModelAnalysis
} from './rolling-stock/ModelAxisDetector';

/**
 * RollingStockPlacement.integration - Integration helpers
 */
export {
    setupRollingStockPositioning,
    interactivePlacement,
    directPlacementAtPosition,
    directPlacementOnEdge,
    handleModelImport,
    createOperableTrain,
    restoreSavedRollingStock,
    debugVisualiseTrackPath,
    debugModelAxisDetection,
    debugListAllEdges,
    detectCategoryFromFilename,
    extractDisplayName
} from './rolling-stock/RollingStockPlacement.integration';

// ============================================================================
// UTILITIES
// ============================================================================

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
} from './utilities/TrainMeshDetector';
export type { TrainClickBehavior } from './utilities/TrainMeshDetector';

/**
 * TrainModelLoader - Loads train models with OO gauge scaling
 */
export { TrainModelLoader, TRACK_GEOMETRY, MODEL_SCALE_PRESETS, OO_SCALE } from './utilities/TrainModelLoader';
export type {
    TrainModelConfig,
    LoadedTrainModel,
    ModelLoadStats,
    ModelOrigin
} from './utilities/TrainModelLoader';

/**
 * TrainSoundManager - Manages train sound effects
 */
export { TrainSoundManager } from './utilities/TrainSoundManager';
export type {
    SoundCategory,
    SoundConfig
} from './utilities/TrainSoundManager';

/**
 * TrainDebugUtils - Console debugging utilities
 */
export { TrainDebugUtils } from './utilities/TrainDebugUtils';
export type { TrainDebugAPI } from './utilities/TrainDebugUtils';
