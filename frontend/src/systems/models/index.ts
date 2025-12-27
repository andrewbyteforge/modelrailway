/**
 * Model System - Index
 * 
 * Path: frontend/src/systems/models/index.ts
 * 
 * Exports all model-related modules for easy importing.
 * 
 * @module models
 */

// Core model system
export { ModelSystem } from './ModelSystem';
export type {
    PlacedModel,
    ModelLoadResult,
    PlacementOptions
} from './ModelSystem';

// Model library
export { ModelLibrary } from './ModelLibrary';
export type {
    ModelLibraryEntry,
    ModelCategory,
    ModelScalePreset,
    OriginalDimensions,
    ImportMetadata,
    LibraryStats,
    LibraryFilter
} from './ModelLibrary';

// Scale helper
export { ModelScaleHelper, OO_GAUGE, REFERENCE_DIMENSIONS } from './ModelScaleHelper';
export type {
    ModelDimensions,
    ScaleResult,
    ScalingMode
} from './ModelScaleHelper';

// Track model placer for rolling stock
export { TrackModelPlacer } from './TrackModelPlacer';
export type {
    TrackSegmentInfo,
    TrackPlacementResult,
    PlacementCallback
} from './TrackModelPlacer';