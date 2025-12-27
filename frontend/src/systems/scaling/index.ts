/**
 * Scaling System - Index
 * 
 * Path: frontend/src/systems/scaling/index.ts
 * 
 * Re-exports all scaling system components for easy importing.
 * 
 * Usage:
 * ```typescript
 * import { ScaleManager, ScaleGizmo, ScaleConstraintsHandler } from '../systems/scaling';
 * ```
 * 
 * @module ScalingSystem
 * @author Model Railway Workbench
 * @version 1.0.0
 */

// ============================================================================
// CORE COMPONENTS
// ============================================================================

// Scale Manager - Central coordinator
export { ScaleManager } from './ScaleManager';

// Scale Gizmo - 3D visual handles
export { ScaleGizmo } from './ScaleGizmo';

// Scale Constraints - Validation and clamping
export {
    ScaleConstraintsHandler,
    getGlobalConstraintsHandler,
    resetGlobalConstraintsHandler
} from './ScaleConstraints';

// Scale Presets - Per-asset-type presets
export {
    ScalePresetsManager,
    getGlobalPresetsManager,
    resetGlobalPresetsManager
} from './ScalePresets';

// Scalable Model Adapter - Wraps PlacedModel for scaling
export {
    ScalableModelAdapter,
    createScalableAdapter,
    createScalableAdapters
} from './ScalableModelAdapter';

export type { ScaleState } from './ScalableModelAdapter';

// ============================================================================
// TYPE RE-EXPORTS
// ============================================================================

export type {
    // Asset categories
    ScalableAssetCategory,
    ScalePivotPoint,
    GizmoInteractionState,

    // Constraints
    ScaleConstraints,

    // Presets
    ScalePreset,
    CategoryPresets,

    // Scalable interface
    IScalable,

    // Events
    ScaleChangeEvent,
    ScaleEventType,
    ScaleEvent,
    ScaleEventListener,

    // Gizmo config
    ScaleGizmoConfig,

    // Panel config
    TransformPanelConfig,

    // Hotkey config
    ScaleHotkeyConfig,

    // State
    ScaleManagerState,

    // Results
    ScaleOperationResult,
    ObjectDimensions,
    ObjectScaleInfo
} from '../../types/scaling.types';

// ============================================================================
// CONSTANT RE-EXPORTS
// ============================================================================

export {
    // Default constraints per category
    DEFAULT_SCALE_CONSTRAINTS,

    // Default presets per category
    DEFAULT_CATEGORY_PRESETS,

    // Default gizmo config
    DEFAULT_GIZMO_CONFIG,

    // Default panel config
    DEFAULT_TRANSFORM_PANEL_CONFIG,

    // Default hotkey config
    DEFAULT_HOTKEY_CONFIG,

    // Initial state
    INITIAL_SCALE_MANAGER_STATE
} from '../../types/scaling.types';