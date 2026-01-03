/**
 * =============================================================================
 * CAMERA MOVEMENT CONTROLLER
 * =============================================================================
 *
 * Path: frontend/src/systems/camera/CameraMovement.ts
 *
 * Handles WASD/QE keyboard movement controls for the orbit camera.
 * Provides Blender-like translation where both camera position and
 * target move together, keeping the view angle constant.
 *
 * Features:
 * - WASD for horizontal movement (forward/backward/strafe)
 * - Q/E for vertical movement (up/down)
 * - Shift modifier for fast movement
 * - Smooth animation loop using requestAnimationFrame
 * - Automatic cleanup on window blur
 *
 * @module CameraMovement
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';

import {
    CAMERA_CONFIG,
    CAMERA_LOG_PREFIX,
    isMovementKey,
    isShiftKey,
    isCameraKey,
    type BoundEventHandlers,
    type CameraMode
} from './CameraTypes';

// =============================================================================
// CAMERA MOVEMENT CONTROLLER CLASS
// =============================================================================

/**
 * CameraMovementController - Manages WASD/QE keyboard movement
 *
 * This class handles all keyboard-based camera movement, including:
 * - Key event registration and cleanup
 * - Movement loop management
 * - Vector calculations for Blender-style translation
 * - Target position clamping
 *
 * @example
 * ```typescript
 * const movement = new CameraMovementController(orbitCamera, () => currentMode);
 * movement.initialize();
 *
 * // Later, when disposing:
 * movement.dispose();
 * ```
 */
export class CameraMovementController {
    // =========================================================================
    // PRIVATE PROPERTIES
    // =========================================================================

    /** Reference to the orbit camera to control */
    private readonly orbitCamera: ArcRotateCamera;

    /** Function to get current camera mode (movement only works in orbit mode) */
    private readonly getModeCallback: () => CameraMode;

    /** Callback when user moves camera (to clear preset state) */
    private readonly onMovementCallback?: () => void;

    /** Set of currently pressed movement keys */
    private pressedKeys: Set<string> = new Set();

    /** Animation frame ID for the movement loop */
    private movementAnimationId: number | null = null;

    /** Bound event handlers for cleanup */
    private boundHandlers: BoundEventHandlers | null = null;

    /** Flag indicating if the controller is initialized */
    private isInitialized: boolean = false;

    /** 
     * Callback to check if movement should be blocked
     * Used when train is selected and W/S should control throttle instead
     */
    private shouldBlockMovementCallback: (() => boolean) | null = null;

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    /**
     * Create a new CameraMovementController
     *
     * @param orbitCamera - The ArcRotateCamera to control
     * @param getModeCallback - Function that returns current camera mode
     * @param onMovementCallback - Optional callback when movement occurs
     */
    constructor(
        orbitCamera: ArcRotateCamera,
        getModeCallback: () => CameraMode,
        onMovementCallback?: () => void
    ) {
        this.orbitCamera = orbitCamera;
        this.getModeCallback = getModeCallback;
        this.onMovementCallback = onMovementCallback;

        console.log(`${CAMERA_LOG_PREFIX} Movement controller created`);
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    /**
     * Initialize the movement controller
     *
     * Registers keyboard event listeners for WASD/QE movement.
     * Must be called before movement will work.
     */
    public initialize(): void {
        if (this.isInitialized) {
            console.warn(`${CAMERA_LOG_PREFIX} Movement controller already initialized`);
            return;
        }

        console.log(`${CAMERA_LOG_PREFIX}   Setting up movement controls...`);

        // Create bound handlers for cleanup
        this.boundHandlers = {
            keyDown: this.handleKeyDown.bind(this),
            keyUp: this.handleKeyUp.bind(this),
            blur: this.handleWindowBlur.bind(this)
        };

        // Register event listeners
        document.addEventListener('keydown', this.boundHandlers.keyDown);
        document.addEventListener('keyup', this.boundHandlers.keyUp);
        window.addEventListener('blur', this.boundHandlers.blur);

        this.isInitialized = true;

        console.log(`${CAMERA_LOG_PREFIX}   ✓ Movement controls configured (WASD/QE)`);
    }

    // =========================================================================
    // KEY STATE QUERIES
    // =========================================================================

    /**
     * Check if any movement key is currently pressed
     *
     * @returns True if W, A, S, D, Q, or E is held down
     */
    public hasMovementKeyPressed(): boolean {
        return this.pressedKeys.has('KeyW') ||
            this.pressedKeys.has('KeyS') ||
            this.pressedKeys.has('KeyA') ||
            this.pressedKeys.has('KeyD') ||
            this.pressedKeys.has('KeyQ') ||
            this.pressedKeys.has('KeyE');
    }

    /**
     * Check if shift modifier is held
     *
     * @returns True if either shift key is pressed
     */
    public isShiftHeld(): boolean {
        return this.pressedKeys.has('ShiftLeft') || this.pressedKeys.has('ShiftRight');
    }

    /**
     * Get the set of currently pressed keys
     *
     * @returns Read-only set of pressed key codes
     */
    public getPressedKeys(): ReadonlySet<string> {
        return this.pressedKeys;
    }

    // =========================================================================
    // KEY EVENT HANDLERS
    // =========================================================================

    /**
     * Handle keydown events
     *
     * Adds the key to the pressed set and starts the movement loop
     * if a movement key was pressed.
     *
     * @param event - The keyboard event
     */
    private handleKeyDown(event: KeyboardEvent): void {
        const code = event.code;

        // Only process camera-relevant keys
        if (!isCameraKey(code)) {
            return;
        }

        // Ignore key repeats (held keys fire multiple keydown events)
        if (event.repeat) {
            return;
        }

        // Add to pressed keys
        this.pressedKeys.add(code);

        // Debug logging
        if (CAMERA_CONFIG.DEBUG_MOVEMENT && isMovementKey(code)) {
            console.log(`${CAMERA_LOG_PREFIX} Key DOWN: ${code}`);
            console.log('  Pressed keys:', Array.from(this.pressedKeys));
        }

        // Start movement loop if a movement key was pressed (and not blocked)
        if (isMovementKey(code) && !this.isMovementBlocked()) {
            // Notify that user is manually moving (clears preset state)
            if (this.onMovementCallback) {
                this.onMovementCallback();
            }
            this.startMovementLoop();
        }
    }

    /**
     * Handle keyup events
     *
     * Removes the key from the pressed set.
     * The movement loop will automatically stop when no movement keys are pressed.
     *
     * @param event - The keyboard event
     */
    private handleKeyUp(event: KeyboardEvent): void {
        const code = event.code;

        // Remove from pressed keys
        this.pressedKeys.delete(code);

        // Debug logging
        if (CAMERA_CONFIG.DEBUG_MOVEMENT && isMovementKey(code)) {
            console.log(`${CAMERA_LOG_PREFIX} Key UP: ${code}`);
        }
    }

    /**
     * Handle window blur events
     *
     * Clears all pressed keys when the window loses focus.
     * This prevents "stuck" movement when the user tabs away
     * while holding a movement key.
     */
    private handleWindowBlur(): void {
        if (CAMERA_CONFIG.DEBUG_MOVEMENT) {
            console.log(`${CAMERA_LOG_PREFIX} Window blur - resetting input state`);
        }

        this.pressedKeys.clear();
        this.stopMovementLoop();
    }

    // =========================================================================
    // MOVEMENT LOOP
    // =========================================================================

    /**
     * Start the movement animation loop
     *
     * Uses requestAnimationFrame for smooth, frame-rate independent movement.
     * The loop continues as long as a movement key is pressed and the
     * camera is in orbit mode.
     */
    private startMovementLoop(): void {
        // Don't start multiple loops
        if (this.movementAnimationId !== null) {
            return;
        }

        if (CAMERA_CONFIG.DEBUG_MOVEMENT) {
            console.log(`${CAMERA_LOG_PREFIX} Movement loop STARTED`);
        }

        const movementLoop = (): void => {
            // Continue if movement keys are pressed AND we're in orbit mode AND not blocked
            const shouldContinue = this.hasMovementKeyPressed() &&
                this.getModeCallback() === 'orbit' &&
                !this.isMovementBlocked();

            if (shouldContinue) {
                this.processMovement();
                this.movementAnimationId = requestAnimationFrame(movementLoop);
            } else {
                if (CAMERA_CONFIG.DEBUG_MOVEMENT) {
                    console.log(`${CAMERA_LOG_PREFIX} Movement loop STOPPED`);
                }
                this.movementAnimationId = null;
            }
        };

        this.movementAnimationId = requestAnimationFrame(movementLoop);
    }

    /**
     * Stop the movement animation loop
     *
     * Cancels any pending animation frame request.
     */
    public stopMovementLoop(): void {
        if (this.movementAnimationId !== null) {
            cancelAnimationFrame(this.movementAnimationId);
            this.movementAnimationId = null;
        }
    }

    /**
     * Clear all pressed keys and stop movement
     *
     * Called when switching camera modes or during cleanup.
     */
    public clearState(): void {
        this.pressedKeys.clear();
        this.stopMovementLoop();
    }

    /**
     * Set a callback to check if movement should be blocked
     * 
     * This is used when a train is selected, so that W/S keys
     * control the train throttle instead of camera movement.
     * 
     * @param callback - Function that returns true if movement should be blocked
     */
    public setShouldBlockMovement(callback: (() => boolean) | null): void {
        this.shouldBlockMovementCallback = callback;

        if (CAMERA_CONFIG.DEBUG_MOVEMENT) {
            console.log(`${CAMERA_LOG_PREFIX} Movement block callback ${callback ? 'set' : 'cleared'}`);
        }
    }

    /**
     * Check if movement is currently blocked
     * 
     * @returns True if movement should be blocked
     */
    private isMovementBlocked(): boolean {
        if (this.shouldBlockMovementCallback) {
            return this.shouldBlockMovementCallback();
        }
        return false;
    }

    // =========================================================================
    // MOVEMENT PROCESSING
    // =========================================================================

    /**
     * Process movement based on currently pressed keys
     *
     * Implements Blender-like translation:
     * 1. Compute camera forward direction projected onto XZ plane
     * 2. Build right vector from cross product with world up
     * 3. Calculate movement delta from pressed keys
     * 4. Move BOTH camera position and target by the same delta
     *
     * This keeps the view angle constant while moving through space.
     */
    private processMovement(): void {
        // Calculate speed multiplier (3x when shift held)
        const speedMul = this.isShiftHeld()
            ? CAMERA_CONFIG.FAST_SPEED_MULTIPLIER
            : 1.0;

        const strafeSpeed = CAMERA_CONFIG.STRAFE_SPEED * speedMul;
        const verticalSpeed = CAMERA_CONFIG.VERTICAL_SPEED * speedMul;

        // =====================================================================
        // CALCULATE MOVEMENT VECTORS
        // =====================================================================

        // Get the camera's forward direction from its view ray
        const forwardRay = this.orbitCamera.getForwardRay().direction;

        // Project forward onto XZ plane (remove Y component)
        const forward = new Vector3(forwardRay.x, 0, forwardRay.z);

        // Handle edge case: camera looking straight up/down
        if (forward.lengthSquared() < 1e-8) {
            // Can't determine forward direction, skip this frame
            return;
        }

        // Normalize the forward vector
        forward.normalize();

        // Calculate right vector (perpendicular to forward on ground plane)
        // Cross product of world up × forward gives right
        const right = Vector3.Cross(Vector3.Up(), forward).normalize();

        // =====================================================================
        // CALCULATE MOVEMENT DELTA
        // =====================================================================

        let delta = Vector3.Zero();

        // Forward/Backward (W/S)
        if (this.pressedKeys.has('KeyW')) {
            delta = delta.add(forward.scale(strafeSpeed));
        }
        if (this.pressedKeys.has('KeyS')) {
            delta = delta.add(forward.scale(-strafeSpeed));
        }

        // Strafe Left/Right (A/D)
        if (this.pressedKeys.has('KeyA')) {
            delta = delta.add(right.scale(-strafeSpeed));
        }
        if (this.pressedKeys.has('KeyD')) {
            delta = delta.add(right.scale(strafeSpeed));
        }

        // Vertical Up/Down (E/Q)
        if (this.pressedKeys.has('KeyE')) {
            delta = delta.add(new Vector3(0, verticalSpeed, 0));
        }
        if (this.pressedKeys.has('KeyQ')) {
            delta = delta.add(new Vector3(0, -verticalSpeed, 0));
        }

        // =====================================================================
        // APPLY MOVEMENT
        // =====================================================================

        // Skip if no movement
        if (delta.lengthSquared() < 1e-12) {
            return;
        }

        // Move both position and target (Blender-style translation)
        this.orbitCamera.position.addInPlace(delta);
        this.orbitCamera.target.addInPlace(delta);

        // =====================================================================
        // CLAMP TARGET POSITION
        // =====================================================================

        const target = this.orbitCamera.target;

        // Clamp vertical position
        target.y = Math.min(
            Math.max(target.y, CAMERA_CONFIG.MIN_TARGET_HEIGHT),
            CAMERA_CONFIG.MAX_TARGET_HEIGHT
        );

        // Clamp horizontal distance from origin
        const horizontalDistance = new Vector3(target.x, 0, target.z);
        const maxDistance = CAMERA_CONFIG.MAX_HORIZONTAL_DISTANCE;

        if (horizontalDistance.length() > maxDistance) {
            horizontalDistance.normalize().scaleInPlace(maxDistance);
            this.orbitCamera.target.x = horizontalDistance.x;
            this.orbitCamera.target.z = horizontalDistance.z;
        }

        // =====================================================================
        // DEBUG LOGGING
        // =====================================================================

        if (CAMERA_CONFIG.DEBUG_MOVEMENT) {
            console.log(`${CAMERA_LOG_PREFIX} Move delta:`, delta);
            console.log(`${CAMERA_LOG_PREFIX} New target:`, this.orbitCamera.target);
        }
    }

    // =========================================================================
    // CLEANUP
    // =========================================================================

    /**
     * Dispose of the movement controller
     *
     * Removes all event listeners and stops any active movement.
     * Call this when disposing the camera system.
     */
    public dispose(): void {
        console.log(`${CAMERA_LOG_PREFIX} Disposing movement controller...`);

        // Stop movement loop
        this.stopMovementLoop();

        // Remove event listeners
        if (this.boundHandlers) {
            document.removeEventListener('keydown', this.boundHandlers.keyDown);
            document.removeEventListener('keyup', this.boundHandlers.keyUp);
            window.removeEventListener('blur', this.boundHandlers.blur);
            this.boundHandlers = null;
        }

        // Clear state
        this.pressedKeys.clear();
        this.isInitialized = false;

        console.log(`${CAMERA_LOG_PREFIX} ✓ Movement controller disposed`);
    }
}