/**
 * Scaling System Type Definitions
 * 
 * Path: frontend/src/types/scaling.types.ts
 * 
 * Comprehensive type definitions for the UE5-style uniform scaling system.
 * Supports gizmo handles, numeric input, hotkey+scroll, constraints,
 * and per-asset-type presets.
 * 
 * @module ScalingTypes
 * @author Model Railway Workbench
 * @version 1.0.0
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

/**
 * Asset categories that determine default scale behaviour
 * Each category has different pivot point and constraint defaults
 */
export type ScalableAssetCategory =
    | 'rolling-stock'   // Trains, carriages, wagons - pivot at centre
    | 'building'        // Structures - pivot at base
    | 'scenery'         // Trees, bushes, rocks - pivot at base
    | 'infrastructure'  // Signals, posts, bridges - pivot at base
    | 'track'           // Track pieces (usually not scaled)
    | 'custom';         // User-defined pivot

/**
 * Pivot point options for scaling operations
 * Determines which point stays fixed while scaling
 */
export type ScalePivotPoint =
    | 'base-center'     // Bottom centre (buildings, trees)
    | 'center'          // Volumetric centre (rolling stock)
    | 'top-center'      // Top centre (hanging items)
    | 'custom';         // User-defined position

/**
 * Scale gizmo interaction state
 */
export type GizmoInteractionState =
    | 'idle'            // No interaction
    | 'hovering'        // Mouse over gizmo handle
    | 'dragging'        // Actively scaling
    | 'preview';        // Showing preview of scale change

// ============================================================================
// SCALE CONSTRAINTS
// ============================================================================

/**
 * Constraints applied to scaling operations
 * Prevents accidental extreme scaling
 */
export interface ScaleConstraints {
    /** Minimum allowed scale factor (e.g., 0.1 = 10%) */
    minScale: number;

    /** Maximum allowed scale factor (e.g., 5.0 = 500%) */
    maxScale: number;

    /** Snap increment when snapping is enabled (e.g., 0.05 = 5% steps) */
    snapIncrement: number;

    /** Whether snap-to-increment is enabled */
    snapEnabled: boolean;

    /** Whether constraints can be bypassed (e.g., with Shift key) */
    allowBypass: boolean;

    /** Key modifier that bypasses constraints */
    bypassModifier: 'shift' | 'ctrl' | 'alt';
}

/**
 * Default constraints for different asset categories
 * 
 * Note: Minimum scale is 6% (0.06) for most categories to allow small details
 * while preventing objects from becoming invisible
 */
export const DEFAULT_SCALE_CONSTRAINTS: Record<ScalableAssetCategory, ScaleConstraints> = {
    'rolling-stock': {
        minScale: 0.5,          // 50% minimum (prevent tiny trains - keeps realism)
        maxScale: 2.0,          // 200% maximum (maintain realism)
        snapIncrement: 0.05,    // 5% steps
        snapEnabled: true,
        allowBypass: true,
        bypassModifier: 'shift'
    },
    'building': {
        minScale: 0.06,         // 6% minimum (allows small distant buildings)
        maxScale: 5.0,          // 500% maximum
        snapIncrement: 0.05,    // 5% steps
        snapEnabled: true,
        allowBypass: true,
        bypassModifier: 'shift'
    },
    'scenery': {
        minScale: 0.06,         // 6% minimum (allows tiny details)
        maxScale: 5.0,          // 500% maximum
        snapIncrement: 0.05,    // 5% steps
        snapEnabled: false,     // Free scaling for organic items
        allowBypass: true,
        bypassModifier: 'shift'
    },
    'infrastructure': {
        minScale: 0.06,         // 6% minimum (allows small details)
        maxScale: 2.0,          // 200% maximum
        snapIncrement: 0.1,     // 10% steps
        snapEnabled: true,
        allowBypass: true,
        bypassModifier: 'shift'
    },
    'track': {
        minScale: 1.0,          // No scaling allowed
        maxScale: 1.0,
        snapIncrement: 0.0,
        snapEnabled: false,
        allowBypass: false,     // Never allow track scaling
        bypassModifier: 'shift'
    },
    'custom': {
        minScale: 0.06,         // 6% minimum
        maxScale: 10.0,         // 1000% maximum
        snapIncrement: 0.05,    // 5% steps
        snapEnabled: true,
        allowBypass: true,
        bypassModifier: 'shift'
    }
};

// ============================================================================
// SCALE PRESETS
// ============================================================================

/**
 * A named scale preset for quick application
 */
export interface ScalePreset {
    /** Unique identifier */
    id: string;

    /** Display name */
    name: string;

    /** Scale factor to apply */
    scaleFactor: number;

    /** Optional description */
    description?: string;

    /** Icon identifier (emoji or icon class) */
    icon?: string;
}

/**
 * Collection of presets for an asset category
 */
export interface CategoryPresets {
    /** Asset category these presets apply to */
    category: ScalableAssetCategory;

    /** Default scale for new items of this category */
    defaultScale: number;

    /** Default pivot point for this category */
    defaultPivot: ScalePivotPoint;

    /** Available presets for this category */
    presets: ScalePreset[];
}

/**
 * Default presets for common asset categories
 */
export const DEFAULT_CATEGORY_PRESETS: Record<ScalableAssetCategory, CategoryPresets> = {
    'rolling-stock': {
        category: 'rolling-stock',
        defaultScale: 1.0,
        defaultPivot: 'center',
        presets: [
            { id: 'oo-standard', name: 'OO Standard', scaleFactor: 1.0, icon: '🚂', description: 'Standard OO gauge (1:76.2)' },
            { id: 'oo-small', name: 'Narrow Gauge', scaleFactor: 0.75, icon: '🚃', description: 'Smaller narrow gauge stock' },
            { id: 'oo-large', name: 'Large', scaleFactor: 1.25, icon: '🚄', description: 'Larger continental stock' }
        ]
    },
    'building': {
        category: 'building',
        defaultScale: 1.0,
        defaultPivot: 'base-center',
        presets: [
            { id: 'building-standard', name: 'Standard', scaleFactor: 1.0, icon: '🏠', description: 'Standard OO scale building' },
            { id: 'building-background', name: 'Background', scaleFactor: 0.75, icon: '🏘️', description: 'Forced perspective for distance' },
            { id: 'building-foreground', name: 'Prominent', scaleFactor: 1.15, icon: '🏛️', description: 'Slightly larger for emphasis' }
        ]
    },
    'scenery': {
        category: 'scenery',
        defaultScale: 1.0,
        defaultPivot: 'base-center',
        presets: [
            { id: 'scenery-small', name: 'Small', scaleFactor: 0.5, icon: '🌱', description: 'Small plants/details' },
            { id: 'scenery-medium', name: 'Medium', scaleFactor: 1.0, icon: '🌳', description: 'Standard size' },
            { id: 'scenery-large', name: 'Large', scaleFactor: 1.5, icon: '🌲', description: 'Larger trees/features' }
        ]
    },
    'infrastructure': {
        category: 'infrastructure',
        defaultScale: 1.0,
        defaultPivot: 'base-center',
        presets: [
            { id: 'infra-standard', name: 'Standard', scaleFactor: 1.0, icon: '🚦', description: 'Standard OO scale' },
            { id: 'infra-compact', name: 'Compact', scaleFactor: 0.85, icon: '📍', description: 'Slightly smaller' }
        ]
    },
    'track': {
        category: 'track',
        defaultScale: 1.0,
        defaultPivot: 'base-center',
        presets: [
            { id: 'track-standard', name: 'Standard', scaleFactor: 1.0, icon: '🛤️', description: 'Track cannot be scaled' }
        ]
    },
    'custom': {
        category: 'custom',
        defaultScale: 1.0,
        defaultPivot: 'base-center',
        presets: []
    }
};

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
    category: ScalableAssetCategory;

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
}

/**
 * Scale change event data
 */
export interface ScaleChangeEvent {
    /** Object being scaled */
    objectId: string;

    /** Previous scale factor */
    previousScale: number;

    /** New scale factor */
    newScale: number;

    /** Source of the scale change */
    source: 'gizmo' | 'panel' | 'hotkey' | 'preset' | 'api';

    /** Whether this is a preview (not committed) */
    isPreview: boolean;

    /** Timestamp of the change */
    timestamp: number;
}

// ============================================================================
// GIZMO CONFIGURATION
// ============================================================================

/**
 * Visual configuration for the scale gizmo
 */
export interface ScaleGizmoConfig {
    /** Size of the gizmo handles in world units */
    handleSize: number;

    /** Color of handles in idle state */
    idleColor: { r: number; g: number; b: number };

    /** Color of handles when hovered */
    hoverColor: { r: number; g: number; b: number };

    /** Color of handles when actively dragging */
    activeColor: { r: number; g: number; b: number };

    /** Opacity of gizmo (0-1) */
    opacity: number;

    /** Whether to show dimension labels on handles */
    showLabels: boolean;

    /** Distance from object centre to handles */
    handleOffset: number;

    /** Whether gizmo auto-scales based on camera distance */
    autoScale: boolean;

    /** Minimum visible size for auto-scale */
    minVisibleSize: number;

    /** Maximum visible size for auto-scale */
    maxVisibleSize: number;
}

/**
 * Default gizmo configuration
 */
export const DEFAULT_GIZMO_CONFIG: ScaleGizmoConfig = {
    handleSize: 0.015,          // 15mm handles
    idleColor: { r: 1, g: 0.8, b: 0 },      // Yellow
    hoverColor: { r: 1, g: 1, b: 0 },       // Bright yellow
    activeColor: { r: 1, g: 0.5, b: 0 },    // Orange
    opacity: 0.9,
    showLabels: true,
    handleOffset: 0.02,         // 20mm from object bounds
    autoScale: true,
    minVisibleSize: 0.01,       // Minimum handle size
    maxVisibleSize: 0.05        // Maximum handle size
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
    scrollSensitivity: 5,       // 5% per scroll notch
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
// EVENT TYPES
// ============================================================================

/**
 * Scale system event types
 */
export type ScaleEventType =
    | 'scale-start'         // Scaling operation started
    | 'scale-preview'       // Scale preview updated
    | 'scale-commit'        // Scale change committed
    | 'scale-cancel'        // Scale operation cancelled
    | 'scale-reset'         // Scale reset to original
    | 'lock-changed'        // Scale lock toggled
    | 'mode-changed'        // Scale mode toggled
    | 'gizmo-hover'         // Gizmo handle hovered
    | 'gizmo-drag-start'    // Gizmo drag started
    | 'gizmo-drag-end';     // Gizmo drag ended

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
// UTILITY TYPES
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
 * Dimensions of a scalable object
 */
export interface ObjectDimensions {
    /** Width in meters (X axis) */
    width: number;

    /** Height in meters (Y axis) */
    height: number;

    /** Depth in meters (Z axis) */
    depth: number;

    /** Bounding sphere radius */
    boundingRadius: number;
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
    currentDimensions: ObjectDimensions;

    /** Original dimensions (before any scaling) */
    originalDimensions: ObjectDimensions;

    /** Asset category */
    category: ScalableAssetCategory;

    /** Whether scale is locked */
    isLocked: boolean;

    /** Active constraints */
    constraints: ScaleConstraints;

    /** Available presets */
    presets: ScalePreset[];
}