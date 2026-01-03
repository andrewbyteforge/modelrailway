/**
 * =============================================================================
 * CAMERA TYPES AND CONFIGURATION
 * =============================================================================
 *
 * Path: frontend/src/systems/camera/CameraTypes.ts
 *
 * Contains all type definitions, interfaces, and configuration constants
 * for the camera system. Extracted for maintainability and reuse.
 *
 * @module CameraTypes
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';

// =============================================================================
// CAMERA MODE TYPES
// =============================================================================

/**
 * Available camera modes
 * - orbit: Arc rotate camera for building/planning (default)
 * - walk: First person camera for viewing the layout at eye level
 */
export type CameraMode = 'orbit' | 'walk';

// =============================================================================
// CAMERA PRESET TYPES
// =============================================================================

/**
 * Pre-programmed camera view preset identifiers
 * 
 * - overhead: Top-down planning view (F1)
 * - front: Front elevation view (F2)
 * - side: Side elevation view (F3)
 * - corner: Isometric corner view (F4)
 * - default: Standard starting position (Home)
 */
export type CameraPresetId = 'overhead' | 'front' | 'side' | 'corner' | 'default';

/**
 * Camera preset configuration
 * 
 * Defines the complete camera state for a preset view including
 * position, orientation, and target point.
 */
export interface CameraPreset {
    /** Unique identifier for this preset */
    id: CameraPresetId;

    /** Human-readable name for UI display */
    name: string;

    /** Description of the view purpose */
    description: string;

    /** Keyboard shortcut (e.g., 'F1') */
    shortcut: string;

    /** Alpha angle (horizontal rotation around Y axis) in radians */
    alpha: number;

    /** Beta angle (vertical rotation from Y axis) in radians */
    beta: number;

    /** Distance from target point in meters */
    radius: number;

    /** Target point the camera looks at */
    target: Vector3;
}

// =============================================================================
// CAMERA PRESET TYPES
// =============================================================================

/**
 * Pre-programmed camera view preset identifiers
 * 
 * - overhead: Top-down planning view (F1)
 * - front: Front elevation view (F2)
 * - side: Side elevation view (F3)
 * - corner: Isometric corner view (F4)
 * - default: Standard starting position (Home)
 */
export type CameraPresetId = 'overhead' | 'front' | 'side' | 'corner' | 'default';

/**
 * Camera preset configuration
 * 
 * Defines the complete camera state for a preset view including
 * position, orientation, and target point.
 */
export interface CameraPreset {
    /** Unique identifier for this preset */
    id: CameraPresetId;

    /** Human-readable name for UI display */
    name: string;

    /** Description of the view purpose */
    description: string;

    /** Keyboard shortcut (e.g., 'F1') */
    shortcut: string;

    /** Alpha angle (horizontal rotation around Y axis) in radians */
    alpha: number;

    /** Beta angle (vertical rotation from Y axis) in radians */
    beta: number;

    /** Distance from target point in meters */
    radius: number;

    /** Target point the camera looks at */
    target: Vector3;
}

// =============================================================================
// MOVEMENT KEY TYPES
// =============================================================================

/**
 * Valid movement key codes for WASD/QE controls
 */
export type MovementKeyCode =
    | 'KeyW'
    | 'KeyS'
    | 'KeyA'
    | 'KeyD'
    | 'KeyQ'
    | 'KeyE';

/**
 * Modifier key codes
 */
export type ModifierKeyCode =
    | 'ShiftLeft'
    | 'ShiftRight';

/**
 * All key codes the camera system responds to
 */
export type CameraKeyCode = MovementKeyCode | ModifierKeyCode;

// =============================================================================
// BOUND HANDLERS INTERFACE
// =============================================================================

/**
 * Interface for bound event handlers
 * 
 * Stored for cleanup during dispose()
 */
export interface BoundEventHandlers {
    /** Keydown event handler */
    keyDown: (e: KeyboardEvent) => void;

    /** Keyup event handler */
    keyUp: (e: KeyboardEvent) => void;

    /** Window blur event handler */
    blur: () => void;
}

// =============================================================================
// CAMERA CONFIGURATION CONSTANTS
// =============================================================================

/**
 * Camera system configuration constants
 * 
 * All measurements are in meters unless otherwise specified.
 * These values have been tuned for OO gauge model railway viewing.
 */
export const CAMERA_CONFIG = {
    // =========================================================================
    // CLIPPING PLANES
    // =========================================================================

    /**
     * Near clipping plane distance in meters
     * Set very close (1mm) to allow detailed inspection of models
     */
    NEAR_CLIP_M: 0.001,

    /**
     * Far clipping plane distance in meters
     * Set to 100m to allow viewing entire large layouts
     */
    FAR_CLIP_M: 100.0,

    // =========================================================================
    // ZOOM LIMITS
    // =========================================================================

    /**
     * Minimum zoom distance (closest the camera can get) in meters
     * 20mm allows very close inspection of details
     */
    MIN_ZOOM_M: 0.02,

    /**
     * Maximum zoom distance (furthest the camera can go) in meters
     * 8m provides good overview of large layouts
     */
    MAX_ZOOM_M: 8.0,

    // =========================================================================
    // CONTROL SENSITIVITY
    // =========================================================================

    /**
     * Mouse wheel zoom precision
     * Higher values = slower zoom per wheel click
     */
    WHEEL_PRECISION: 50,

    /**
     * Right-click panning sensitivity
     * Higher values = slower panning
     */
    PAN_SENSIBILITY: 500,

    /**
     * Camera movement inertia (0-1)
     * Higher values = more "drift" after releasing controls
     */
    INERTIA: 0.5,

    /**
     * Touch pinch zoom precision
     */
    PINCH_PRECISION: 50,

    // =========================================================================
    // MOVEMENT SPEEDS (WASD/QE)
    // =========================================================================

    /**
     * Horizontal movement speed (W/A/S/D) in meters per frame
     * ~20mm per frame at 60fps = ~1.2m/s
     */
    STRAFE_SPEED: 0.02,

    /**
     * Vertical movement speed (Q/E) in meters per frame
     * Slightly slower than horizontal for precision
     */
    VERTICAL_SPEED: 0.015,

    /**
     * Speed multiplier when holding Shift
     */
    FAST_SPEED_MULTIPLIER: 3.0,

    // =========================================================================
    // TARGET CONSTRAINTS
    // =========================================================================

    /**
     * Minimum height for camera target point in meters
     * Prevents looking below the floor
     */
    MIN_TARGET_HEIGHT: 0.0,

    /**
     * Maximum height for camera target point in meters
     * 5m allows viewing tall scenery
     */
    MAX_TARGET_HEIGHT: 5.0,

    /**
     * Maximum horizontal distance from origin for target point
     * Prevents camera drifting too far from the layout
     */
    MAX_HORIZONTAL_DISTANCE: 5.0,

    // =========================================================================
    // ANIMATION SETTINGS
    // =========================================================================

    /**
     * Duration of preset transition animations in frames
     * 30 frames at 60fps = 0.5 seconds
     */
    TRANSITION_DURATION_FRAMES: 30,

    /**
     * Frame rate for animations
     */
    TRANSITION_FRAME_RATE: 60,

    // =========================================================================
    // DEBUG FLAGS
    // =========================================================================

    /**
     * Enable verbose logging for movement controls
     * Set to true when debugging WASD/QE issues
     */
    DEBUG_MOVEMENT: false,

    /**
     * Enable verbose logging for camera presets
     */
    DEBUG_PRESETS: true

} as const;

/**
 * Type for the camera configuration object
 */
export type CameraConfigType = typeof CAMERA_CONFIG;

// =============================================================================
// LOGGING PREFIX
// =============================================================================

/**
 * Console logging prefix for camera system messages
 */
export const CAMERA_LOG_PREFIX = '[CameraSystem]';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a key code is a movement key (WASD/QE)
 * 
 * @param code - The keyboard event code to check
 * @returns True if the code is a movement key
 */
export function isMovementKey(code: string): code is MovementKeyCode {
    return code === 'KeyW' ||
        code === 'KeyS' ||
        code === 'KeyA' ||
        code === 'KeyD' ||
        code === 'KeyQ' ||
        code === 'KeyE';
}

/**
 * Check if a key code is a shift modifier
 * 
 * @param code - The keyboard event code to check
 * @returns True if the code is a shift key
 */
export function isShiftKey(code: string): code is ModifierKeyCode {
    return code === 'ShiftLeft' || code === 'ShiftRight';
}

/**
 * Check if a key code is relevant to the camera system
 * 
 * @param code - The keyboard event code to check
 * @returns True if the camera system should handle this key
 */
export function isCameraKey(code: string): code is CameraKeyCode {
    return isMovementKey(code) || isShiftKey(code);
}