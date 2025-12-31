/**
 * Model System - Index
 * 
 * Path: frontend/src/systems/models/index.ts
 * 
 * Exports all model-related modules for easy importing.
 * 
 * v1.1.0 - Added re-exports from centralized constants
 * v1.0.0 - Original release
 * 
 * @module models
 * @author Model Railway Workbench
 * @version 1.1.0
 */

// ============================================================================
// CORE MODEL SYSTEM
// ============================================================================

export { ModelSystem } from './ModelSystem';
export type {
    PlacedModel,
    ModelLoadResult,
    PlacementOptions
} from './ModelSystem';

// ============================================================================
// MODEL LIBRARY
// ============================================================================

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

// ============================================================================
// SCALE HELPER
// ============================================================================

export { ModelScaleHelper } from './ModelScaleHelper';
export type {
    ModelDimensions,
    ScaleResult,
    ScalingMode
} from './ModelScaleHelper';

// ============================================================================
// TRACK MODEL PLACER
// ============================================================================

export { TrackModelPlacer } from './TrackModelPlacer';
export type {
    TrackSegmentInfo,
    TrackPlacementResult,
    PlacementCallback
} from './TrackModelPlacer';

// ============================================================================
// DEBUG UTILITIES
// ============================================================================

export { setupModelScaleDebug } from './ModelScaleDebug';
export type { ModelDebugInterface } from './ModelScaleDebug';

// ============================================================================
// RE-EXPORTS FROM CENTRALIZED CONSTANTS
// ============================================================================
// These are re-exported for backwards compatibility with existing imports
// New code should import directly from '../../constants'

export {
    OO_GAUGE,
    OO_ROLLING_STOCK_TARGETS,
    REFERENCE_DIMENSIONS,
    TRACK_GEOMETRY
} from '../../constants';

export type {
    RollingStockType,
    ReferenceDimensionKey
} from '../../constants';