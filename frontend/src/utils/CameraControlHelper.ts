/**
 * CameraControlHelper.ts - Centralized camera control management
 * 
 * Path: frontend/src/utils/CameraControlHelper.ts
 * 
 * Provides a single, consistent way to enable/disable camera controls
 * across all systems. This prevents conflicts between:
 * - InputManager (track piece dragging)
 * - ModelImportButton (model dragging)
 * - ScaleGizmo (scale manipulation)
 * - TrainSystem (train selection)
 * 
 * IMPORTANT: All systems should use this helper instead of directly
 * calling camera.attachControl() or camera.detachControl().
 * 
 * @module CameraControlHelper
 * @author Model Railway Workbench
 * @version 1.1.0 - Added lock count for nested disable calls
 */

import type { Scene } from '@babylonjs/core/scene';
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[CameraControl]';

/** Debug mode - set to true to see camera control state changes */
const DEBUG_MODE = false;

// ============================================================================
// STATE TRACKING
// ============================================================================

/**
 * Track how many systems have requested camera disable.
 * Camera is only re-enabled when all systems release their locks.
 * This prevents race conditions when multiple systems disable/enable.
 */
let disableLockCount = 0;

/**
 * Track which system currently holds a lock (for debugging)
 */
const lockHolders: Set<string> = new Set();

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Enable or disable camera controls
 * 
 * This is the PRIMARY function all systems should use to control camera.
 * It properly handles:
 * - ArcRotateCamera pointer inputs
 * - Attach/detach control
 * - Preserving camera button configuration
 * 
 * @param scene - Babylon.js scene
 * @param enabled - Whether to enable (true) or disable (false) controls
 * @param canvas - Canvas element (required when enabling to re-attach)
 * @param systemId - Optional identifier for the calling system (for debugging)
 * 
 * @example
 * ```typescript
 * // When starting a drag operation:
 * setCameraControlsEnabled(scene, false, undefined, 'ModelDrag');
 * 
 * // When ending the drag operation:
 * setCameraControlsEnabled(scene, true, canvas, 'ModelDrag');
 * ```
 */
export function setCameraControlsEnabled(
    scene: Scene,
    enabled: boolean,
    canvas?: HTMLCanvasElement | null,
    systemId?: string
): void {
    try {
        const camera = scene.activeCamera as ArcRotateCamera;
        if (!camera) {
            if (DEBUG_MODE) {
                console.warn(`${LOG_PREFIX} No active camera found`);
            }
            return;
        }

        // Get canvas from engine if not provided
        const targetCanvas = canvas || scene.getEngine().getRenderingCanvas();
        if (!targetCanvas && enabled) {
            console.warn(`${LOG_PREFIX} Cannot enable controls - no canvas available`);
            return;
        }

        // ----------------------------------------------------------------
        // LOCK COUNT TRACKING (prevents race conditions)
        // ----------------------------------------------------------------
        if (!enabled) {
            // Disabling - increment lock count
            disableLockCount++;
            if (systemId) {
                lockHolders.add(systemId);
            }

            if (DEBUG_MODE) {
                console.log(`${LOG_PREFIX} DISABLE requested by ${systemId || 'unknown'}, lock count: ${disableLockCount}`);
            }
        } else {
            // Enabling - decrement lock count
            disableLockCount = Math.max(0, disableLockCount - 1);
            if (systemId) {
                lockHolders.delete(systemId);
            }

            if (DEBUG_MODE) {
                console.log(`${LOG_PREFIX} ENABLE requested by ${systemId || 'unknown'}, lock count: ${disableLockCount}`);
            }

            // Only actually enable if all locks are released
            if (disableLockCount > 0) {
                if (DEBUG_MODE) {
                    console.log(`${LOG_PREFIX} Still locked by: ${Array.from(lockHolders).join(', ')}`);
                }
                return;
            }
        }

        // ----------------------------------------------------------------
        // ACTUALLY ENABLE/DISABLE CAMERA
        // ----------------------------------------------------------------
        if (enabled && disableLockCount === 0) {
            // Re-enable camera controls
            enableCameraControls(camera, targetCanvas!);
        } else if (!enabled && disableLockCount === 1) {
            // Only disable on first lock (prevent multiple detaches)
            disableCameraControls(camera);
        }

    } catch (error) {
        console.error(`${LOG_PREFIX} Error setting camera controls:`, error);
    }
}

/**
 * Force enable camera controls, clearing all locks.
 * Use this as a safety reset if camera gets stuck.
 * 
 * @param scene - Babylon.js scene
 * @param canvas - Canvas element
 */
export function forceEnableCameraControls(
    scene: Scene,
    canvas?: HTMLCanvasElement | null
): void {
    try {
        const camera = scene.activeCamera as ArcRotateCamera;
        if (!camera) return;

        const targetCanvas = canvas || scene.getEngine().getRenderingCanvas();
        if (!targetCanvas) return;

        // Clear all locks
        disableLockCount = 0;
        lockHolders.clear();

        // Force enable
        enableCameraControls(camera, targetCanvas);

        console.log(`${LOG_PREFIX} Force enabled camera controls (all locks cleared)`);

    } catch (error) {
        console.error(`${LOG_PREFIX} Error force-enabling camera:`, error);
    }
}

/**
 * Check if camera controls are currently enabled
 * 
 * @param scene - Babylon.js scene
 * @returns true if controls are enabled (no locks held)
 */
export function areCameraControlsEnabled(scene: Scene): boolean {
    return disableLockCount === 0;
}

/**
 * Get current lock count (for debugging)
 */
export function getCameraLockCount(): number {
    return disableLockCount;
}

/**
 * Get which systems are holding locks (for debugging)
 */
export function getCameraLockHolders(): string[] {
    return Array.from(lockHolders);
}

// ============================================================================
// INTERNAL FUNCTIONS
// ============================================================================

/**
 * Internal function to actually disable camera controls
 */
function disableCameraControls(camera: ArcRotateCamera): void {
    // Detach all camera control inputs
    camera.detachControl();

    if (DEBUG_MODE) {
        console.log(`${LOG_PREFIX} Camera controls DISABLED`);
    }
}

/**
 * Internal function to actually enable camera controls
 */
function enableCameraControls(camera: ArcRotateCamera, canvas: HTMLCanvasElement): void {
    // Re-attach camera controls with proper configuration
    // The second parameter (true) enables interaction
    camera.attachControl(canvas, true);

    // For ArcRotateCamera, ensure pointer inputs are properly attached
    // This handles cases where inputs were explicitly detached
    if (camera.inputs?.attached?.pointers) {
        const pointerInput = camera.inputs.attached.pointers;

        // Check if pointers need to be re-attached
        // The internal _observer check tells us if it's currently attached
        if (!(pointerInput as any)._observer) {
            try {
                pointerInput.attachControl(true);
            } catch (e) {
                // Some camera types don't support this - that's OK
                if (DEBUG_MODE) {
                    console.log(`${LOG_PREFIX} Could not attach pointer input:`, e);
                }
            }
        }
    }

    if (DEBUG_MODE) {
        console.log(`${LOG_PREFIX} Camera controls ENABLED`);
    }
}

// ============================================================================
// BROWSER CONSOLE UTILITY
// ============================================================================

/**
 * Configure orbit camera mouse button bindings
 * 
 * This function configures which mouse buttons control rotation vs panning.
 * Kept for backwards compatibility with existing code.
 * 
 * @param camera - ArcRotateCamera to configure
 * @param config - Button configuration (optional, uses defaults)
 */
export function configureOrbitCameraButtons(
    camera: ArcRotateCamera,
    config?: {
        rotateButton?: number;
        panButton?: number;
    }
): void {
    if (!camera) return;

    // Default: Left-click rotates, Right-click pans
    const rotateButton = config?.rotateButton ?? 0; // Left
    const panButton = config?.panButton ?? 2;       // Right

    // Configure through the pointer input
    if (camera.inputs?.attached?.pointers) {
        const pointerInput = camera.inputs.attached.pointers as any;
        pointerInput.buttons = [rotateButton, -1, panButton]; // [rotate, zoom, pan]
    }

    console.log(`[CameraControl] Orbit camera buttons configured: rotate=${rotateButton}, pan=${panButton}`);
}

/**
 * Install a global helper function for debugging camera issues
 * Call this during app initialization
 */
export function installCameraDebugHelper(scene: Scene): void {
    // Add to window for console access
    (window as any).fixCamera = () => {
        const canvas = scene.getEngine().getRenderingCanvas();
        forceEnableCameraControls(scene, canvas);
        console.log('Camera controls force-enabled. Try moving the camera now.');
    };

    (window as any).cameraStatus = () => {
        console.log('Camera Control Status:');
        console.log(`  Lock count: ${disableLockCount}`);
        console.log(`  Lock holders: ${lockHolders.size > 0 ? Array.from(lockHolders).join(', ') : '(none)'}`);
        console.log(`  Controls enabled: ${disableLockCount === 0 ? 'YES' : 'NO'}`);
    };

    console.log(`${LOG_PREFIX} Debug helpers installed:`);
    console.log('  window.fixCamera() - Force enable camera controls');
    console.log('  window.cameraStatus() - Show camera lock status');
}