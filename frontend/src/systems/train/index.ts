/**
 * Train System - Index
 * 
 * Path: frontend/src/systems/train/index.ts
 * 
 * Exports all train-related modules for easy importing.
 * 
 * @module train
 * @author Model Railway Workbench
 * @version 1.0.0
 * 
 * @example
 * ```typescript
 * import { TrainSystem, TrainController, PointsManager } from '../systems/train';
 * 
 * const trainSystem = new TrainSystem(scene, trackSystem);
 * trainSystem.initialize();
 * ```
 */

// ============================================================================
// CORE SYSTEMS
// ============================================================================

export { TrainSystem } from './TrainSystem';
export type { TrainSystemConfig } from './TrainSystem';

export { TrainController } from './TrainController';
export type {
    TrainInfo,
    TrainState,
    TrainControllerConfig,
    TrainEvents
} from './TrainController';

// ============================================================================
// PHYSICS
// ============================================================================

export { TrainPhysics, DEFAULT_PHYSICS_CONFIG } from './TrainPhysics';
export type {
    TrainDirection,
    BrakeState,
    TrainPhysicsConfig,
    TrainPhysicsState
} from './TrainPhysics';

// ============================================================================
// PATH FOLLOWING
// ============================================================================

export { TrainPathFollower } from './TrainPathFollower';
export type {
    TrackPosition,
    WorldPose,
    MovementResult,
    PathFollowerConfig
} from './TrainPathFollower';

// ============================================================================
// POINTS/SWITCHES
// ============================================================================

export { PointsManager } from './PointsManager';
export type {
    PointState,
    PointRoutes,
    PointData,
    PointChangeEvent
} from './PointsManager';

// ============================================================================
// AUDIO
// ============================================================================

export { TrainSoundManager } from './TrainSoundManager';
export type {
    SoundCategory,
    SoundConfig
} from './TrainSoundManager';

// ============================================================================
// VISUAL INDICATORS
// ============================================================================

export { PointsIndicator } from './PointsIndicator';
export type { PointsIndicatorConfig } from './PointsIndicator';

// ============================================================================
// UTILITIES
// ============================================================================

export { TrackEdgeFinder } from './TrackEdgeFinder';
export type {
    EdgeFindResult,
    EdgeFindOptions
} from './TrackEdgeFinder';

export { RollingStockPlacer } from './RollingStockPlacer';
export type {
    PendingModel,
    PlacementResult
} from './RollingStockPlacer';