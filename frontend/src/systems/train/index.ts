/**
 * Train System Index
 * 
 * Path: frontend/src/systems/train/index.ts
 * 
 * Exports all train-related modules for convenient importing.
 * 
 * @module TrainSystem
 * @author Model Railway Workbench
 * @version 1.0.0
 */

// ============================================================================
// MODEL LOADING
// ============================================================================

export {
    TrainModelLoader,
    TRACK_GEOMETRY,
    MODEL_SCALE_PRESETS,
    OO_SCALE,
    calculateRequiredScale,
    realMMToOOMeters,
    ooMetersToRealMM
} from './TrainModelLoader';

export type {
    TrainModelConfig,
    LoadedTrainModel,
    ModelLoadStats,
    ModelOrigin
} from './TrainModelLoader';

// ============================================================================
// DEBUG UTILITIES
// ============================================================================

export { TrainDebugUtils } from './TrainDebugUtils';

export type { TrainDebugAPI } from './TrainDebugUtils';