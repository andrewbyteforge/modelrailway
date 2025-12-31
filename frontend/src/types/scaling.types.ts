/**
 * Scaling System Type Definitions
 * 
 * Path: frontend/src/types/scaling.types.ts
 * 
 * Type definitions for the UE5-style uniform scaling system.
 * Core types are imported from railway.types.ts for consistency.
 * 
 * @module ScalingTypes
 * @author Model Railway Workbench
 * @version 2.0.0 - Refactored to use unified types
 */

// ============================================================================
// IMPORTS FROM UNIFIED TYPES
// ============================================================================

// Type-only imports (erased at runtime)
import type {
    AssetCategory,
    RollingStockCategory,
    ScalingMode,
    ScalePreset,
    CategoryPresets,
    ScalePivotPoint,
    ScaleConstraints,
    ScaleResult,
    ModelDimensions,
} from './railway.types';

// Value imports (exist at runtime)
import {
    DEFAULT_SCALE_CONSTRAINTS,
    DEFAULT_CATEGORY_PRESETS,
    createModelDimensions,
} from './railway.types';

// ============================================================================
// RE-EXPORTS FOR BACKWARDS COMPATIBILITY
// ============================================================================

// Re-export types
export type {
    AssetCategory,
    RollingStockCategory,
    ScalingMode,
    ScalePreset,
    CategoryPresets,
    ScalePivotPoint,
    ScaleConstraints,
    ScaleResult,
    ModelDimensions,
};

// Re-export values
export {
    DEFAULT_SCALE_CONSTRAINTS,
    DEFAULT_CATEGORY_PRESETS,
    createModelDimensions,
};

// Legacy aliases - maps old type names to new
export type ScalableAssetCategory = AssetCategory;
export type ObjectDimensions = ModelDimensions;

// ============================================================================
// GIZMO INTERACTION
// ============================================================================

/**
 * Scale gizmo interaction state
 */
export type GizmoInteractionState =
    | 'idle'            // No interaction
    | 'hovering'        // Mouse over gizmo handle
    | 'dragging'        // Actively scaling
    | 'preview';        // Showing preview of scale change

// ============================================================================
// SCALABLE OBJECT INTERFACE
// ============================================================================

/**
 * Interface for objects that can be scaled
 * Implemented by PlacedModel, PlacedScenery, etc.
 */
export interface IScalable {
    /** Unique identifier for the object */
    id: string;

    /** Asset category for determining defaults */
    category: AssetCategory;

    /** Current scale factor (1.0 = original size) */
    currentScale: number;

    /** Original scale when first placed (for reset functionality) */
    originalScale: number;

    /** Current pivot point setting */
    pivotPoint: ScalePivotPoint;

    /** Custom pivot position (if pivotPoint is 'custom') */
    customPivotOffset?: { x: number; y: number; z: number };

    /** Whether this object's scale is locked */
    scaleLocked: boolean;

    /** Original dimensions before any scaling */
    originalDimensions: ModelDimensions;

    /** Apply a new scale factor */
    setScale(scale: number): void;

    /** Reset to original scale */
    resetScale(): void;

    /** Lock/unlock scaling */
    setScaleLock(locked: boolean): void;

    /** Get current scaled dimensions */
    getScaledDimensions(): ModelDimensions;
}

// ============================================================================
// GIZMO CONFIGURATION
// ============================================================================

/**
 * Configuration for the scale gizmo appearance
 */
export interface ScaleGizmoConfig {
    /** Size of the gizmo in world units */
    gizmoSize: number;

    /** Color when idle (hex) */
    idleColor: string;

    /** Color when hovered (hex) */
    hoverColor: string;

    /** Color when dragging (hex) */
    activeColor: string;

    /** Opacity when idle (0-1) */
    idleOpacity: number;

    /** Opacity when active (0-1) */
    activeOpacity: number;

    /** Show axis indicators */
    showAxes: boolean;

    /** Show scale value tooltip */
    showTooltip: boolean;

    /** Minimum visible distance (camera units) */
    minVisibleDistance: number;

    /** Maximum visible distance (camera units) */
    maxVisibleDistance: number;
}

/**
 * Default gizmo configuration
 */
export const DEFAULT_GIZMO_CONFIG: ScaleGizmoConfig = {
    gizmoSize: 0.1,
    idleColor: '#ffcc00',
    hoverColor: '#ffff00',
    activeColor: '#ff9900',
    idleOpacity: 0.6,
    activeOpacity: 1.0,
    showAxes: false,
    showTooltip: true,
    minVisibleDistance: 0.1,
    maxVisibleDistance: 5.0
};

// ============================================================================
// TRANSFORM PANEL CONFIGURATION
// ============================================================================

/**
 * Configuration for the numeric transform panel UI
 */
export interface TransformPanelConfig {
    /** Panel position on screen */
    position: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left' | 'floating';

    /** Panel width in pixels */
    width: number;

    /** Whether panel is collapsible */
    collapsible: boolean;

    /** Whether panel starts collapsed */
    startCollapsed: boolean;

    /** Whether to show percentage or decimal scale */
    showPercentage: boolean;

    /** Decimal places for scale display */
    decimalPlaces: number;

    /** Whether to show preset buttons */
    showPresets: boolean;

    /** Whether to show dimension readout */
    showDimensions: boolean;

    /** Whether to show reset button */
    showReset: boolean;

    /** Whether to show lock toggle */
    showLock: boolean;
}

/**
 * Default transform panel configuration
 */
export const DEFAULT_TRANSFORM_PANEL_CONFIG: TransformPanelConfig = {
    position: 'top-right',
    width: 280,
    collapsible: true,
    startCollapsed: false,
    showPercentage: true,
    decimalPlaces: 1,
    showPresets: true,
    showDimensions: true,
    showReset: true,
    showLock: true
};

// ============================================================================
// HOTKEY CONFIGURATION
// ============================================================================

/**
 * Hotkey bindings for scaling operations
 */
export interface ScaleHotkeyConfig {
    /** Key to hold for scroll-to-scale (default: 'S') */
    scaleKey: string;

    /** Modifier for fine adjustment */
    fineModifier: 'shift' | 'ctrl' | 'alt';

    /** Fine adjustment multiplier (e.g., 0.2 = 20% of normal) */
    fineMultiplier: number;

    /** Scale amount per scroll notch (percentage) */
    scrollSensitivity: number;

    /** Key to reset scale to original */
    resetKey: string;

    /** Key to toggle scale lock */
    lockKey: string;
}

/**
 * Default hotkey configuration
 */
export const DEFAULT_HOTKEY_CONFIG: ScaleHotkeyConfig = {
    scaleKey: 's',
    fineModifier: 'shift',
    fineMultiplier: 0.2,
    scrollSensitivity: 5,
    resetKey: 'r',
    lockKey: 'l'
};

// ============================================================================
// SCALE MANAGER STATE
// ============================================================================

/**
 * Current state of the scale manager
 */
export interface ScaleManagerState {
    /** Currently selected scalable object (if any) */
    selectedObjectId: string | null;

    /** Whether scale mode is active */
    scaleModeActive: boolean;

    /** Current gizmo interaction state */
    gizmoState: GizmoInteractionState;

    /** Scale value being previewed (before commit) */
    previewScale: number | null;

    /** Whether S key is currently held */
    scaleKeyHeld: boolean;

    /** Whether shift modifier is held */
    shiftHeld: boolean;

    /** Whether constraints are currently bypassed */
    constraintsBypassed: boolean;

    /** Last committed scale for undo */
    lastCommittedScale: number | null;
}

/**
 * Initial state for scale manager
 */
export const INITIAL_SCALE_MANAGER_STATE: ScaleManagerState = {
    selectedObjectId: null,
    scaleModeActive: false,
    gizmoState: 'idle',
    previewScale: null,
    scaleKeyHeld: false,
    shiftHeld: false,
    constraintsBypassed: false,
    lastCommittedScale: null
};

// ============================================================================
// SCALE EVENTS
// ============================================================================

/**
 * Scale system event types
 */
export type ScaleEventType =
    | 'scale-start'
    | 'scale-preview'
    | 'scale-commit'
    | 'scale-cancel'
    | 'scale-reset'
    | 'lock-changed'
    | 'mode-changed'
    | 'gizmo-hover'
    | 'gizmo-drag-start'
    | 'gizmo-drag-end';

/**
 * Scale system event
 */
export interface ScaleEvent {
    /** Event type */
    type: ScaleEventType;

    /** Target object ID */
    objectId?: string;

    /** Scale value (if applicable) */
    scale?: number;

    /** Previous scale (if applicable) */
    previousScale?: number;

    /** Event timestamp */
    timestamp: number;

    /** Additional event data */
    data?: Record<string, unknown>;
}

/**
 * Scale event listener function
 */
export type ScaleEventListener = (event: ScaleEvent) => void;

// ============================================================================
// SCALE OPERATION
// ============================================================================

/**
 * Result of a scale operation
 */
export interface ScaleOperationResult {
    /** Whether the operation succeeded */
    success: boolean;

    /** Final scale factor applied */
    finalScale?: number;

    /** Error message if failed */
    error?: string;

    /** Whether the scale was clamped by constraints */
    wasClamped?: boolean;

    /** Whether the scale was snapped to increment */
    wasSnapped?: boolean;
}

/**
 * Complete scale info for an object
 */
export interface ObjectScaleInfo {
    /** Object ID */
    objectId: string;

    /** Current scale factor */
    currentScale: number;

    /** Original scale when placed */
    originalScale: number;

    /** Current dimensions (after scaling) */
    currentDimensions: ModelDimensions;

    /** Original dimensions (before any scaling) */
    originalDimensions: ModelDimensions;

    /** Asset category */
    category: AssetCategory;

    /** Whether scale is locked */
    isLocked: boolean;

    /** Active constraints */
    constraints: ScaleConstraints;

    /** Available presets */
    presets: ScalePreset[];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Apply constraints to a scale value
 */
export function applyScaleConstraints(
    scale: number,
    constraints: ScaleConstraints,
    bypassConstraints: boolean = false
): { scale: number; wasClamped: boolean; wasSnapped: boolean } {
    let result = scale;
    let wasClamped = false;
    let wasSnapped = false;

    // Skip constraints if bypassed
    if (bypassConstraints && constraints.allowBypass) {
        return { scale: result, wasClamped, wasSnapped };
    }

    // Clamp to min/max
    if (result < constraints.minScale) {
        result = constraints.minScale;
        wasClamped = true;
    } else if (result > constraints.maxScale) {
        result = constraints.maxScale;
        wasClamped = true;
    }

    // Snap to increment
    if (constraints.snapEnabled && constraints.snapIncrement > 0) {
        const snapped = Math.round(result / constraints.snapIncrement) * constraints.snapIncrement;
        if (snapped !== result) {
            result = snapped;
            wasSnapped = true;
        }
    }

    return { scale: result, wasClamped, wasSnapped };
}

/**
 * Get constraints for an asset category
 */
export function getConstraintsForCategory(category: AssetCategory): ScaleConstraints {
    return DEFAULT_SCALE_CONSTRAINTS[category] || DEFAULT_SCALE_CONSTRAINTS.custom;
}

/**
 * Get presets for an asset category
 */
export function getPresetsForCategory(category: AssetCategory): CategoryPresets {
    return DEFAULT_CATEGORY_PRESETS[category] || DEFAULT_CATEGORY_PRESETS.custom;
}

/**
 * Find a preset by ID within a category
 */
export function findPresetById(category: AssetCategory, presetId: string): ScalePreset | undefined {
    const categoryPresets = getPresetsForCategory(category);
    return categoryPresets.presets.find(p => p.id === presetId);
}

/**
 * Get the default preset for a category
 */
export function getDefaultPreset(category: AssetCategory): ScalePreset | undefined {
    const categoryPresets = getPresetsForCategory(category);
    return categoryPresets.presets.find(p => p.isDefault) || categoryPresets.presets[0];
}

/**
 * Scale dimensions by a factor
 */
export function scaleDimensions(dimensions: ModelDimensions, scaleFactor: number): ModelDimensions {
    return createModelDimensions(
        dimensions.width * scaleFactor,
        dimensions.height * scaleFactor,
        dimensions.depth * scaleFactor
    );
}