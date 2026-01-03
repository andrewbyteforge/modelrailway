/**
 * =============================================================================
 * CAMERA SYSTEM MODULE
 * =============================================================================
 *
 * Path: frontend/src/systems/camera/index.ts
 *
 * Barrel export file for the camera system module.
 * Import from this file for clean, consolidated imports.
 *
 * @module Camera
 * @author Model Railway Workbench
 * @version 1.0.0
 *
 * @example
 * ```typescript
 * // Import main class and types
 * import { CameraSystem, CameraMode, CAMERA_CONFIG } from './systems/camera';
 *
 * // Or import specific items
 * import { CameraMovementController } from './systems/camera';
 * ```
 */

// =============================================================================
// MAIN EXPORTS
// =============================================================================

/**
 * Main camera system class
 */
export { CameraSystem } from './CameraSystem';

/**
 * Movement controller for WASD/QE input
 */
export { CameraMovementController } from './CameraMovement';

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type {
    CameraMode,
    CameraPresetId,
    CameraPreset,
    MovementKeyCode,
    ModifierKeyCode,
    CameraKeyCode,
    BoundEventHandlers,
    CameraConfigType
} from './CameraTypes';

// =============================================================================
// CONSTANT EXPORTS
// =============================================================================

export {
    CAMERA_CONFIG,
    CAMERA_LOG_PREFIX,
    isMovementKey,
    isShiftKey,
    isCameraKey
} from './CameraTypes';