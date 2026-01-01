/**
 * =============================================================================
 * CAMERA SYSTEM
 * =============================================================================
 *
 * Path: frontend/src/systems/camera/CameraSystem.ts
 *
 * Professional camera controls for the Model Railway Workbench application.
 * Provides intuitive 3D navigation for designing model railway layouts.
 *
 * CONTROL SCHEME:
 * ---------------
 * - WASD        : Pan camera position (move around the scene)
 * - Q/E         : Move camera up/down (vertical movement)
 * - Scroll      : Zoom in/out
 * - Right Click : Hold and drag for freelook (rotate camera view)
 * - Middle Click: Pan camera (drag to move view)
 * - Left Click  : Reserved for selection (no camera action)
 * - Shift       : Hold for faster movement (3x speed)
 *
 * ARCHITECTURE:
 * -------------
 * Uses Babylon.js ArcRotateCamera for orbit mode with custom input handling
 * to provide smooth, responsive controls. The camera orbits around a target
 * point, with WASD moving both the camera position and target together.
 *
 * INTEGRATION:
 * ------------
 * Supports movement blocking via callback for external systems (e.g., train
 * controls) that need to capture WASD keys when active.
 *
 * @module CameraSystem
 * @author Model Railway Workbench
 * @version 3.1.0
 */

import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { Project } from '../../core/Project';

// Import centralized camera control helper
import { configureOrbitCameraButtons } from '../../utils/CameraControlHelper';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Camera operating mode
 * - 'orbit': Standard 3D view for building and editing layouts
 * - 'walk': First-person view for experiencing the layout at eye level
 */
export type CameraMode = 'orbit' | 'walk';

/**
 * Camera configuration constants
 * All distances are in meters (scene units)
 */
const CAMERA_CONFIG = {
    // -------------------------------------------------------------------------
    // Clipping Planes
    // -------------------------------------------------------------------------

    /** Near clipping plane in meters (1mm - allows very close inspection) */
    NEAR_CLIP_M: 0.001,

    /** Far clipping plane in meters (100m - covers entire scene) */
    FAR_CLIP_M: 100.0,

    // -------------------------------------------------------------------------
    // Zoom Limits
    // -------------------------------------------------------------------------

    /** Minimum zoom distance in meters (20mm - close-up detail work) */
    MIN_ZOOM_M: 0.02,

    /** Maximum zoom distance in meters (8m - full layout overview) */
    MAX_ZOOM_M: 8.0,

    // -------------------------------------------------------------------------
    // Mouse Controls
    // -------------------------------------------------------------------------

    /** 
     * Scroll wheel sensitivity for zoom
     * Higher values = slower zoom (more precise control)
     */
    WHEEL_PRECISION: 50,

    /** 
     * Middle-mouse panning sensitivity
     * Higher values = slower panning
     */
    PAN_SENSIBILITY: 500,

    /** 
     * Camera inertia (momentum after input stops)
     * 0 = no inertia, 1 = maximum inertia
     */
    INERTIA: 0.5,

    /** Touch pinch-to-zoom sensitivity */
    PINCH_PRECISION: 50,

    /** 
     * Rotation sensitivity for freelook
     * Higher values = slower rotation (more precise)
     */
    ANGULAR_SENSIBILITY: 1000,

    // -------------------------------------------------------------------------
    // WASD Movement
    // -------------------------------------------------------------------------

    /** Base horizontal movement speed in meters per frame */
    MOVE_SPEED: 0.025,

    /** Base vertical movement speed in meters per frame */
    VERTICAL_SPEED: 0.02,

    /** Speed multiplier when holding Shift */
    FAST_MULTIPLIER: 3.0,

    // -------------------------------------------------------------------------
    // Movement Bounds
    // -------------------------------------------------------------------------

    /** Minimum camera target height (table surface level) */
    MIN_TARGET_HEIGHT: 0.0,

    /** Maximum camera target height */
    MAX_TARGET_HEIGHT: 5.0,

    /** Maximum horizontal distance from scene origin */
    MAX_HORIZONTAL_DISTANCE: 10.0,

    // -------------------------------------------------------------------------
    // Beta (Vertical Angle) Limits
    // -------------------------------------------------------------------------

    /** Minimum beta angle (prevent looking from below) */
    LOWER_BETA_LIMIT: 0.1,

    /** Maximum beta angle (prevent flipping over the top) */
    UPPER_BETA_LIMIT: Math.PI / 2 - 0.05,

    // -------------------------------------------------------------------------
    // Walk Camera
    // -------------------------------------------------------------------------

    /** Default eye height in walk mode (meters) */
    DEFAULT_EYE_HEIGHT: 0.16,

    /** Walk camera movement speed */
    WALK_SPEED: 0.1,

    // -------------------------------------------------------------------------
    // Debug
    // -------------------------------------------------------------------------

    /** Enable verbose logging for debugging */
    DEBUG_ENABLED: false

} as const;

// =============================================================================
// DEBUG WINDOW INTERFACE
// =============================================================================

/**
 * Window extension for camera debug utilities
 */
declare global {
    interface Window {
        cameraDebug?: {
            getState: () => object;
            resetCamera: () => void;
            setDebug: (enabled: boolean) => void;
            logConfig: () => void;
            forceEnable: () => void;
            disable: () => void;
            enable: () => void;
        };
    }
}

// =============================================================================
// CAMERA SYSTEM CLASS
// =============================================================================

/**
 * CameraSystem
 *
 * Manages camera creation, input handling, and mode switching for the
 * Model Railway Workbench. Provides smooth, intuitive controls for
 * navigating 3D model railway layouts.
 *
 * @example
 * ```typescript
 * const cameraSystem = new CameraSystem(scene, project, canvas);
 * cameraSystem.initialize();
 *
 * // Block movement when train is selected
 * cameraSystem.setShouldBlockMovement(() => trainSystem.hasSelectedTrain());
 * ```
 */
export class CameraSystem {

    // =========================================================================
    // PRIVATE PROPERTIES
    // =========================================================================

    // -------------------------------------------------------------------------
    // Core References
    // -------------------------------------------------------------------------

    /** Babylon.js scene reference */
    private readonly scene: Scene;

    /** Project configuration reference */
    private readonly project: Project;

    /** Canvas element for input attachment */
    private readonly canvas: HTMLCanvasElement;

    // -------------------------------------------------------------------------
    // Camera Instances
    // -------------------------------------------------------------------------

    /** Orbit camera for standard 3D viewing */
    private orbitCamera: ArcRotateCamera | null = null;

    /** Walk camera for first-person viewing */
    private walkCamera: UniversalCamera | null = null;

    /** Current camera mode */
    private currentMode: CameraMode = 'orbit';

    // -------------------------------------------------------------------------
    // Input State
    // -------------------------------------------------------------------------

    /** Set of currently pressed key codes */
    private pressedKeys: Set<string> = new Set();

    /** Whether right mouse button is held (for freelook) */
    private isRightMouseDown: boolean = false;

    /** Animation frame ID for movement loop */
    private movementAnimationId: number | null = null;

    // -------------------------------------------------------------------------
    // Event Handlers
    // -------------------------------------------------------------------------

    /** Bound event handler references for cleanup */
    private boundHandlers: {
        keyDown: (e: KeyboardEvent) => void;
        keyUp: (e: KeyboardEvent) => void;
        windowBlur: () => void;
        windowFocus: () => void;
        mouseDown: (e: MouseEvent) => void;
        mouseUp: (e: MouseEvent) => void;
        visibilityChange: () => void;
    } | null = null;

    // -------------------------------------------------------------------------
    // External Integration
    // -------------------------------------------------------------------------

    /** 
     * Callback to check if camera movement should be blocked
     * Returns true when external system (e.g., train controls) needs WASD keys
     */
    private shouldBlockMovementCallback: (() => boolean) | null = null;

    /** Whether controls are currently disabled by external system */
    private controlsDisabled: boolean = false;

    /** Count of disable requests (for nested disable/enable calls) */
    private disableCount: number = 0;

    // -------------------------------------------------------------------------
    // Debug State
    // -------------------------------------------------------------------------

    /** Debug logging enabled flag */
    private debugEnabled: boolean = CAMERA_CONFIG.DEBUG_ENABLED;

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    /**
     * Create a new CameraSystem instance
     *
     * @param scene - Babylon.js scene to add cameras to
     * @param project - Project configuration for board dimensions
     * @param canvas - HTML canvas for input attachment
     */
    constructor(scene: Scene, project: Project, canvas: HTMLCanvasElement) {
        this.scene = scene;
        this.project = project;
        this.canvas = canvas;

        this.log('[CameraSystem] Instance created');
        this.log(`  Near clip: ${CAMERA_CONFIG.NEAR_CLIP_M}m (${CAMERA_CONFIG.NEAR_CLIP_M * 1000}mm)`);
        this.log(`  Min zoom: ${CAMERA_CONFIG.MIN_ZOOM_M}m (${CAMERA_CONFIG.MIN_ZOOM_M * 1000}mm)`);
    }

    // =========================================================================
    // PUBLIC API - INITIALIZATION
    // =========================================================================

    /**
     * Initialize the camera system
     *
     * Creates orbit and walk cameras, sets up input handlers, and
     * registers debug utilities on the window object.
     *
     * @throws Error if initialization fails
     */
    initialize(): void {
        console.log('[CameraSystem] Initializing...');

        try {
            // Create camera instances
            this.createOrbitCamera();
            this.createWalkCamera();

            // Setup input handling
            this.setupInputHandlers();

            // Set initial mode
            const cameraConfig = this.project.getCameraConfig();
            const initialMode = cameraConfig?.defaultMode || 'orbit';
            this.setMode(initialMode);

            // Register debug utilities
            this.registerDebugUtilities();

            // Log controls guide
            this.logControlsGuide();

            console.log('✓ Camera system initialized');

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('[CameraSystem] Initialization failed:', message);
            throw new Error(`Camera initialization failed: ${message}`);
        }
    }

    // =========================================================================
    // PUBLIC API - MODE SWITCHING
    // =========================================================================

    /**
     * Set the camera mode
     *
     * @param mode - 'orbit' for 3D building view, 'walk' for first-person
     */
    setMode(mode: CameraMode): void {
        if (!this.orbitCamera || !this.walkCamera) {
            throw new Error('Cameras not initialized - call initialize() first');
        }

        this.currentMode = mode;

        // Clear input state when switching modes
        this.pressedKeys.clear();
        this.isRightMouseDown = false;
        this.stopMovementLoop();

        if (mode === 'orbit') {
            this.walkCamera.detachControl();
            this.orbitCamera.attachControl(this.canvas, false);
            this.configureOrbitCameraButtons(); // Re-apply button config after attach
            this.scene.activeCamera = this.orbitCamera;
            console.log('→ Camera mode: ORBIT (building view)');
        } else {
            this.orbitCamera.detachControl();
            this.walkCamera.attachControl(this.canvas, true);
            this.scene.activeCamera = this.walkCamera;
            console.log('→ Camera mode: WALK (first-person view)');
        }
    }

    /**
     * Toggle between orbit and walk camera modes
     *
     * @returns The new camera mode
     */
    toggleMode(): CameraMode {
        const newMode = this.currentMode === 'orbit' ? 'walk' : 'orbit';
        this.setMode(newMode);
        return newMode;
    }

    /**
     * Get the current camera mode
     *
     * @returns Current mode ('orbit' or 'walk')
     */
    getCurrentMode(): CameraMode {
        return this.currentMode;
    }

    // =========================================================================
    // PUBLIC API - CAMERA ACCESS
    // =========================================================================

    /**
     * Get the currently active camera
     *
     * @returns The active Babylon.js camera
     * @throws Error if no camera is active
     */
    getActiveCamera(): Camera {
        if (!this.scene.activeCamera) {
            throw new Error('No active camera - ensure initialize() was called');
        }
        return this.scene.activeCamera;
    }

    /**
     * Get the orbit camera instance
     *
     * @returns ArcRotateCamera or null if not initialized
     */
    getOrbitCamera(): ArcRotateCamera | null {
        return this.orbitCamera;
    }

    /**
     * Get the walk camera instance
     *
     * @returns UniversalCamera or null if not initialized
     */
    getWalkCamera(): UniversalCamera | null {
        return this.walkCamera;
    }

    // =========================================================================
    // PUBLIC API - CAMERA MANIPULATION
    // =========================================================================

    /**
     * Reset orbit camera to default position
     *
     * Centers on the baseboard with a good overview angle
     */
    resetOrbitCamera(): void {
        if (!this.orbitCamera) {
            console.warn('[CameraSystem] Cannot reset - orbit camera not initialized');
            return;
        }

        const dims = this.project.getBoardDimensions();
        const targetY = dims.heightFromFloor;

        // Reset to default viewing angles
        this.orbitCamera.alpha = Math.PI / 4;      // 45° horizontal
        this.orbitCamera.beta = Math.PI / 3;       // 60° vertical
        this.orbitCamera.radius = 2.0;             // 2m distance

        // Center on baseboard
        this.orbitCamera.target.copyFromFloats(0, targetY, 0);

        console.log('[CameraSystem] Orbit camera reset to default view');
    }

    /**
     * Focus camera on a specific position
     *
     * @param position - World position to focus on
     * @param distance - Distance from target (meters), clamped to zoom limits
     */
    focusOn(position: Vector3, distance: number = 0.3): void {
        if (!this.orbitCamera) {
            console.warn('[CameraSystem] Cannot focus - orbit camera not initialized');
            return;
        }

        // Ensure we're in orbit mode
        if (this.currentMode !== 'orbit') {
            this.setMode('orbit');
        }

        // Clamp distance to zoom limits
        const clampedDistance = Math.max(
            CAMERA_CONFIG.MIN_ZOOM_M,
            Math.min(distance, CAMERA_CONFIG.MAX_ZOOM_M)
        );

        this.orbitCamera.target.copyFrom(position);
        this.orbitCamera.radius = clampedDistance;

        this.log(`[CameraSystem] Focused on (${position.x.toFixed(3)}, ${position.y.toFixed(3)}, ${position.z.toFixed(3)}) at ${clampedDistance}m`);
    }

    /**
     * Set zoom distance directly
     *
     * @param distance - Distance in meters, will be clamped to zoom limits
     */
    setZoomDistance(distance: number): void {
        if (!this.orbitCamera) {
            console.warn('[CameraSystem] Cannot zoom - orbit camera not initialized');
            return;
        }

        const clampedDistance = Math.max(
            CAMERA_CONFIG.MIN_ZOOM_M,
            Math.min(distance, CAMERA_CONFIG.MAX_ZOOM_M)
        );

        this.orbitCamera.radius = clampedDistance;
    }

    /**
     * Get current zoom distance
     *
     * @returns Distance in meters, or 1.0 if camera not initialized
     */
    getZoomDistance(): number {
        return this.orbitCamera?.radius ?? 1.0;
    }

    // =========================================================================
    // PUBLIC API - EXTERNAL INTEGRATION
    // =========================================================================

    /**
     * Set callback to check if camera movement should be blocked
     *
     * Used by external systems (e.g., train controls) to temporarily
     * capture WASD keys when they need them.
     *
     * @param callback - Function returning true to block camera movement
     *
     * @example
     * ```typescript
     * cameraSystem.setShouldBlockMovement(() => {
     *     return trainController.hasSelectedTrain();
     * });
     * ```
     */
    setShouldBlockMovement(callback: (() => boolean) | null): void {
        this.shouldBlockMovementCallback = callback;
        this.log('[CameraSystem] Movement block callback ' + (callback ? 'registered' : 'cleared'));
    }

    /**
     * Check if camera movement is currently blocked
     *
     * @returns true if movement should be blocked
     */
    isMovementBlocked(): boolean {
        return this.shouldBlockMovementCallback?.() ?? false;
    }

    // =========================================================================
    // PUBLIC API - CONTROL ENABLE/DISABLE
    // =========================================================================

    /**
     * Temporarily disable camera controls
     *
     * Supports nested calls - each disable() requires a matching enable().
     * Useful when modal dialogs or other UI elements need focus.
     */
    disableControls(): void {
        this.disableCount++;

        if (!this.controlsDisabled) {
            this.controlsDisabled = true;

            // Detach camera from input
            if (this.currentMode === 'orbit' && this.orbitCamera) {
                this.orbitCamera.detachControl();
            } else if (this.currentMode === 'walk' && this.walkCamera) {
                this.walkCamera.detachControl();
            }

            // Clear any pressed keys
            this.clearInputState();

            console.log(`[CameraSystem] Controls disabled (count: ${this.disableCount})`);
        }
    }

    /**
     * Re-enable camera controls
     *
     * Only actually enables when all disable() calls have been matched
     */
    enableControls(): void {
        if (this.disableCount > 0) {
            this.disableCount--;
        }

        if (this.disableCount === 0 && this.controlsDisabled) {
            this.controlsDisabled = false;

            // Reattach camera to input
            if (this.currentMode === 'orbit' && this.orbitCamera) {
                this.orbitCamera.attachControl(this.canvas, false);
                this.configureOrbitCameraButtons(); // Re-apply button config
            } else if (this.currentMode === 'walk' && this.walkCamera) {
                this.walkCamera.attachControl(this.canvas, true);
            }

            console.log('[CameraSystem] Controls enabled');
        } else if (this.disableCount > 0) {
            this.log(`[CameraSystem] Controls still disabled (count: ${this.disableCount})`);
        }
    }

    /**
     * Force-enable camera controls
     *
     * Bypasses the nested disable count - use as emergency recovery.
     * Also resets all input state.
     */
    forceEnableControls(): void {
        this.controlsDisabled = false;
        this.disableCount = 0;
        this.clearInputState();

        // Reattach camera
        if (this.currentMode === 'orbit' && this.orbitCamera) {
            this.orbitCamera.attachControl(this.canvas, false);
            this.configureOrbitCameraButtons(); // Re-apply button config
        } else if (this.currentMode === 'walk' && this.walkCamera) {
            this.walkCamera.attachControl(this.canvas, true);
        }

        console.log('[CameraSystem] Controls FORCE enabled');
    }

    /**
     * Check if controls are currently disabled
     */
    areControlsDisabled(): boolean {
        return this.controlsDisabled;
    }

    // =========================================================================
    // PRIVATE - CAMERA CREATION
    // =========================================================================

    /**
     * Create the orbit camera for standard 3D viewing
     *
     * Configured for model railway work with:
     * - Very close minimum zoom for detail inspection
     * - Smooth zoom and panning
     * - RIGHT-click freelook rotation (left-click reserved for selection)
     */
    private createOrbitCamera(): void {
        this.log('  Creating orbit camera...');

        const dims = this.project.getBoardDimensions();
        const cameraConfig = this.project.getCameraConfig();

        // Initial target at baseboard surface
        const targetY = dims.heightFromFloor;
        const target = new Vector3(0, targetY, 0);

        // Create ArcRotateCamera
        this.orbitCamera = new ArcRotateCamera(
            'orbitCamera',
            Math.PI / 4,           // Alpha: 45° horizontal angle
            Math.PI / 3,           // Beta: 60° vertical angle
            2.0,                   // Radius: 2m distance
            target,
            this.scene
        );

        // -------------------------------------------------------------------------
        // Clipping Planes
        // -------------------------------------------------------------------------
        this.orbitCamera.minZ = CAMERA_CONFIG.NEAR_CLIP_M;
        this.orbitCamera.maxZ = CAMERA_CONFIG.FAR_CLIP_M;

        // -------------------------------------------------------------------------
        // Zoom Limits
        // -------------------------------------------------------------------------
        const configMinRadius = cameraConfig?.orbit?.minRadiusM;
        const configMaxRadius = cameraConfig?.orbit?.maxRadiusM;

        this.orbitCamera.lowerRadiusLimit = configMinRadius ?? CAMERA_CONFIG.MIN_ZOOM_M;
        this.orbitCamera.upperRadiusLimit = configMaxRadius ?? CAMERA_CONFIG.MAX_ZOOM_M;

        // -------------------------------------------------------------------------
        // Vertical Angle Limits
        // -------------------------------------------------------------------------
        this.orbitCamera.lowerBetaLimit = CAMERA_CONFIG.LOWER_BETA_LIMIT;
        this.orbitCamera.upperBetaLimit = CAMERA_CONFIG.UPPER_BETA_LIMIT;

        // -------------------------------------------------------------------------
        // Input Sensitivity
        // -------------------------------------------------------------------------
        this.orbitCamera.wheelPrecision = CAMERA_CONFIG.WHEEL_PRECISION;
        this.orbitCamera.panningSensibility = CAMERA_CONFIG.PAN_SENSIBILITY;
        this.orbitCamera.pinchPrecision = CAMERA_CONFIG.PINCH_PRECISION;
        this.orbitCamera.angularSensibilityX = CAMERA_CONFIG.ANGULAR_SENSIBILITY;
        this.orbitCamera.angularSensibilityY = CAMERA_CONFIG.ANGULAR_SENSIBILITY;

        // -------------------------------------------------------------------------
        // Smooth Movement
        // -------------------------------------------------------------------------
        this.orbitCamera.inertia = CAMERA_CONFIG.INERTIA;
        this.orbitCamera.panningInertia = CAMERA_CONFIG.INERTIA;

        // -------------------------------------------------------------------------
        // Advanced Features
        // -------------------------------------------------------------------------

        // Zoom towards cursor position for precise work
        this.orbitCamera.zoomToMouseLocation = true;

        // Natural pinch zoom on touch devices
        this.orbitCamera.useNaturalPinchZoom = true;

        // -------------------------------------------------------------------------
        // Input Configuration
        // -------------------------------------------------------------------------

        // Attach with noPreventDefault=false to capture events properly
        this.orbitCamera.attachControl(this.canvas, false);

        // Configure mouse buttons: RIGHT-click for rotation, MIDDLE for pan
        this.configureOrbitCameraButtons();

        this.log('  ✓ Orbit camera created');
        this.log(`    Zoom range: ${this.orbitCamera.lowerRadiusLimit}m - ${this.orbitCamera.upperRadiusLimit}m`);
        this.log('    Mouse: Right-click=Rotate, Middle=Pan, Left=Selection');
    }

    /**
     * Configure orbit camera mouse button mapping
     * 
     * Uses the centralized CameraControlHelper to set up:
     * - Button 0 (Left): NO ACTION (reserved for selection)
     * - Button 1 (Middle): Pan camera
     * - Button 2 (Right): Rotate/orbit camera
     */
    private configureOrbitCameraButtons(): void {
        if (!this.orbitCamera) {
            return;
        }

        // Use centralized helper to configure buttons
        configureOrbitCameraButtons(this.orbitCamera);

        this.log('  ✓ Mouse buttons configured: Left=None, Middle=Pan, Right=Rotate');
    }

    /**
     * Create the walk camera for first-person viewing
     *
     * Positioned at realistic eye height for experiencing
     * the layout from a human perspective
     */
    private createWalkCamera(): void {
        this.log('  Creating walk camera...');

        const dims = this.project.getBoardDimensions();
        const cameraConfig = this.project.getCameraConfig();

        // Eye height from config or default
        const eyeHeight = cameraConfig?.walk?.eyeHeightM ?? CAMERA_CONFIG.DEFAULT_EYE_HEIGHT;
        const startPosition = new Vector3(0, eyeHeight, -1.0);

        // Create UniversalCamera
        this.walkCamera = new UniversalCamera(
            'walkCamera',
            startPosition,
            this.scene
        );

        // -------------------------------------------------------------------------
        // Clipping Planes
        // -------------------------------------------------------------------------
        this.walkCamera.minZ = CAMERA_CONFIG.NEAR_CLIP_M;
        this.walkCamera.maxZ = CAMERA_CONFIG.FAR_CLIP_M;

        // -------------------------------------------------------------------------
        // Initial Target
        // -------------------------------------------------------------------------
        this.walkCamera.setTarget(new Vector3(0, dims.heightFromFloor, 0));

        // -------------------------------------------------------------------------
        // Movement Settings
        // -------------------------------------------------------------------------
        this.walkCamera.speed = CAMERA_CONFIG.WALK_SPEED;
        this.walkCamera.angularSensibility = CAMERA_CONFIG.ANGULAR_SENSIBILITY;

        // WASD keys for walk camera (codes for W, S, A, D)
        this.walkCamera.keysUp = [87];     // W
        this.walkCamera.keysDown = [83];   // S
        this.walkCamera.keysLeft = [65];   // A
        this.walkCamera.keysRight = [68];  // D

        this.log('  ✓ Walk camera created');
        this.log(`    Eye height: ${eyeHeight}m`);
    }

    // =========================================================================
    // PRIVATE - INPUT HANDLING
    // =========================================================================

    /**
     * Setup all input event handlers
     *
     * Registers listeners for keyboard, mouse, and window focus events
     */
    private setupInputHandlers(): void {
        this.log('  Setting up input handlers...');

        // Create bound handler references for cleanup
        this.boundHandlers = {
            keyDown: this.handleKeyDown.bind(this),
            keyUp: this.handleKeyUp.bind(this),
            windowBlur: this.handleWindowBlur.bind(this),
            windowFocus: this.handleWindowFocus.bind(this),
            mouseDown: this.handleMouseDown.bind(this),
            mouseUp: this.handleMouseUp.bind(this),
            visibilityChange: this.handleVisibilityChange.bind(this)
        };

        // -------------------------------------------------------------------------
        // Keyboard Events
        // -------------------------------------------------------------------------
        document.addEventListener('keydown', this.boundHandlers.keyDown);
        document.addEventListener('keyup', this.boundHandlers.keyUp);

        // -------------------------------------------------------------------------
        // Mouse Events (for freelook state tracking)
        // -------------------------------------------------------------------------
        this.canvas.addEventListener('mousedown', this.boundHandlers.mouseDown);
        document.addEventListener('mouseup', this.boundHandlers.mouseUp);

        // -------------------------------------------------------------------------
        // Window Focus Events
        // -------------------------------------------------------------------------
        window.addEventListener('blur', this.boundHandlers.windowBlur);
        window.addEventListener('focus', this.boundHandlers.windowFocus);
        document.addEventListener('visibilitychange', this.boundHandlers.visibilityChange);

        this.log('  ✓ Input handlers configured');
    }

    /**
     * Handle keydown events
     *
     * Processes WASD/QE movement keys and Shift modifier
     */
    private handleKeyDown(event: KeyboardEvent): void {
        const code = event.code;

        // Identify movement and modifier keys
        const isMovementKey = this.isMovementKey(code);
        const isShiftKey = code === 'ShiftLeft' || code === 'ShiftRight';

        // Only handle movement-related keys
        if (!isMovementKey && !isShiftKey) {
            return;
        }

        // Ignore key repeat events
        if (event.repeat) {
            return;
        }

        // Check if movement is blocked by external system
        if (isMovementKey && this.shouldBlockMovementCallback?.()) {
            this.log(`[CameraSystem] Movement blocked - key ${code} ignored`);
            return;
        }

        // Track pressed key
        this.pressedKeys.add(code);

        this.log(`[CameraSystem] Key DOWN: ${code}`);

        // Start movement loop if movement key pressed
        if (isMovementKey && this.currentMode === 'orbit') {
            this.startMovementLoop();
        }
    }

    /**
     * Handle keyup events
     *
     * Removes keys from pressed state
     */
    private handleKeyUp(event: KeyboardEvent): void {
        const code = event.code;

        // Remove from pressed keys
        this.pressedKeys.delete(code);

        this.log(`[CameraSystem] Key UP: ${code}`);
    }

    /**
     * Handle mouse down events
     *
     * Tracks right mouse button state for freelook
     */
    private handleMouseDown(event: MouseEvent): void {
        // Track right mouse button (button 2) for freelook state
        if (event.button === 2) {
            this.isRightMouseDown = true;
            this.log('[CameraSystem] Right mouse DOWN - freelook active');
        }
    }

    /**
     * Handle mouse up events
     *
     * Clears right mouse button state and checks if controls need restoration
     */
    private handleMouseUp(event: MouseEvent): void {
        if (event.button === 2) {
            this.isRightMouseDown = false;
            this.log('[CameraSystem] Right mouse UP - freelook ended');

            // Check if controls need restoration after drag ends
            if (this.controlsDisabled && this.disableCount === 0) {
                this.enableControls();
            }
        }
    }

    /**
     * Handle window blur (losing focus)
     *
     * Clears all input state to prevent stuck keys
     */
    private handleWindowBlur(): void {
        this.clearInputState();
        this.log('[CameraSystem] Window lost focus - input state cleared');
    }

    /**
     * Handle window focus (gaining focus)
     *
     * Ensures clean input state when returning to window
     */
    private handleWindowFocus(): void {
        this.clearInputState();
        this.log('[CameraSystem] Window gained focus');
    }

    /**
     * Handle visibility change (tab switch, minimize)
     *
     * Clears input state when tab becomes hidden
     */
    private handleVisibilityChange(): void {
        if (document.hidden) {
            this.clearInputState();
            this.log('[CameraSystem] Tab hidden - input state cleared');
        }
    }

    /**
     * Clear all input state
     *
     * Resets pressed keys, mouse state, and stops movement
     */
    private clearInputState(): void {
        this.pressedKeys.clear();
        this.isRightMouseDown = false;
        this.stopMovementLoop();
    }

    /**
     * Check if a key code is a movement key (WASD/QE)
     */
    private isMovementKey(code: string): boolean {
        return code === 'KeyW' ||
            code === 'KeyS' ||
            code === 'KeyA' ||
            code === 'KeyD' ||
            code === 'KeyQ' ||
            code === 'KeyE';
    }

    /**
     * Check if any movement keys are currently pressed
     */
    private hasMovementKeyPressed(): boolean {
        return this.pressedKeys.has('KeyW') ||
            this.pressedKeys.has('KeyS') ||
            this.pressedKeys.has('KeyA') ||
            this.pressedKeys.has('KeyD') ||
            this.pressedKeys.has('KeyQ') ||
            this.pressedKeys.has('KeyE');
    }

    // =========================================================================
    // PRIVATE - MOVEMENT LOOP
    // =========================================================================

    /**
     * Start the movement animation loop
     *
     * Runs every frame to apply smooth camera movement
     */
    private startMovementLoop(): void {
        // Already running?
        if (this.movementAnimationId !== null) {
            return;
        }

        // Don't start if controls disabled
        if (this.controlsDisabled) {
            return;
        }

        this.log('[CameraSystem] Starting movement loop');

        const loop = (): void => {
            // Stop if controls disabled or no keys pressed
            if (this.controlsDisabled || !this.hasMovementKeyPressed()) {
                this.stopMovementLoop();
                return;
            }

            // Check if movement blocked
            if (this.shouldBlockMovementCallback?.()) {
                this.log('[CameraSystem] Movement blocked during loop');
                this.stopMovementLoop();
                return;
            }

            // Apply movement
            this.applyMovement();

            // Continue loop
            this.movementAnimationId = requestAnimationFrame(loop);
        };

        // Start the loop
        this.movementAnimationId = requestAnimationFrame(loop);
    }

    /**
     * Stop the movement animation loop
     */
    private stopMovementLoop(): void {
        if (this.movementAnimationId !== null) {
            cancelAnimationFrame(this.movementAnimationId);
            this.movementAnimationId = null;
            this.log('[CameraSystem] Movement loop stopped');
        }
    }

    /**
     * Apply movement based on currently pressed keys
     *
     * Moves both camera position and target together to maintain
     * the orbit relationship while translating through space.
     */
    private applyMovement(): void {
        if (!this.orbitCamera) {
            return;
        }

        // Calculate speed with Shift modifier
        const isShiftHeld = this.pressedKeys.has('ShiftLeft') || this.pressedKeys.has('ShiftRight');
        const speedMultiplier = isShiftHeld ? CAMERA_CONFIG.FAST_MULTIPLIER : 1.0;
        const moveSpeed = CAMERA_CONFIG.MOVE_SPEED * speedMultiplier;
        const verticalSpeed = CAMERA_CONFIG.VERTICAL_SPEED * speedMultiplier;

        // -------------------------------------------------------------------------
        // Calculate Movement Vectors
        // -------------------------------------------------------------------------

        // Get camera's forward direction projected onto XZ plane
        const cameraForward = this.orbitCamera.getForwardRay().direction;
        const forward = new Vector3(cameraForward.x, 0, cameraForward.z);

        // Handle edge case: looking straight up/down
        if (forward.lengthSquared() < 1e-8) {
            // Fall back to alpha-based forward
            forward.set(
                Math.sin(this.orbitCamera.alpha),
                0,
                Math.cos(this.orbitCamera.alpha)
            );
        }
        forward.normalize();

        // Calculate right vector (perpendicular to forward on XZ plane)
        const right = Vector3.Cross(Vector3.Up(), forward).normalize();

        // -------------------------------------------------------------------------
        // Accumulate Movement Delta
        // -------------------------------------------------------------------------
        const delta = Vector3.Zero();

        // W/S - Forward/Backward
        if (this.pressedKeys.has('KeyW')) {
            delta.addInPlace(forward.scale(moveSpeed));
        }
        if (this.pressedKeys.has('KeyS')) {
            delta.addInPlace(forward.scale(-moveSpeed));
        }

        // A/D - Strafe Left/Right
        if (this.pressedKeys.has('KeyA')) {
            delta.addInPlace(right.scale(-moveSpeed));
        }
        if (this.pressedKeys.has('KeyD')) {
            delta.addInPlace(right.scale(moveSpeed));
        }

        // Q/E - Down/Up (vertical)
        if (this.pressedKeys.has('KeyQ')) {
            delta.addInPlace(new Vector3(0, -verticalSpeed, 0));
        }
        if (this.pressedKeys.has('KeyE')) {
            delta.addInPlace(new Vector3(0, verticalSpeed, 0));
        }

        // Skip if no movement
        if (delta.lengthSquared() < 1e-12) {
            return;
        }

        // -------------------------------------------------------------------------
        // Apply Movement
        // -------------------------------------------------------------------------

        // Move both position and target together (maintains orbit relationship)
        this.orbitCamera.position.addInPlace(delta);
        this.orbitCamera.target.addInPlace(delta);

        // -------------------------------------------------------------------------
        // Apply Bounds
        // -------------------------------------------------------------------------
        this.applyTargetBounds();

        this.log(`[CameraSystem] Moved: (${delta.x.toFixed(4)}, ${delta.y.toFixed(4)}, ${delta.z.toFixed(4)})`);
    }

    /**
     * Apply position bounds to camera target
     *
     * Keeps camera within reasonable scene bounds
     */
    private applyTargetBounds(): void {
        if (!this.orbitCamera) {
            return;
        }

        const target = this.orbitCamera.target;

        // Clamp vertical position
        target.y = Math.max(
            CAMERA_CONFIG.MIN_TARGET_HEIGHT,
            Math.min(target.y, CAMERA_CONFIG.MAX_TARGET_HEIGHT)
        );

        // Clamp horizontal distance from origin
        const horizontalDistance = Math.sqrt(target.x * target.x + target.z * target.z);

        if (horizontalDistance > CAMERA_CONFIG.MAX_HORIZONTAL_DISTANCE) {
            const scale = CAMERA_CONFIG.MAX_HORIZONTAL_DISTANCE / horizontalDistance;
            target.x *= scale;
            target.z *= scale;
        }
    }

    // =========================================================================
    // PRIVATE - DEBUG UTILITIES
    // =========================================================================

    /**
     * Register debug utilities on window object
     */
    private registerDebugUtilities(): void {
        window.cameraDebug = {
            getState: () => ({
                mode: this.currentMode,
                pressedKeys: Array.from(this.pressedKeys),
                isRightMouseDown: this.isRightMouseDown,
                isMovementBlocked: this.isMovementBlocked(),
                controlsDisabled: this.controlsDisabled,
                disableCount: this.disableCount,
                orbitTarget: this.orbitCamera?.target.toString(),
                orbitRadius: this.orbitCamera?.radius,
                orbitAlpha: this.orbitCamera?.alpha,
                orbitBeta: this.orbitCamera?.beta
            }),
            resetCamera: () => this.resetOrbitCamera(),
            setDebug: (enabled: boolean) => {
                this.debugEnabled = enabled;
                console.log(`[CameraSystem] Debug logging ${enabled ? 'enabled' : 'disabled'}`);
            },
            logConfig: () => {
                console.log('[CameraSystem] Configuration:', CAMERA_CONFIG);
            },
            forceEnable: () => {
                this.forceEnableControls();
                console.log('[CameraSystem] Camera controls force-enabled via debug');
            },
            disable: () => {
                this.disableControls();
            },
            enable: () => {
                this.enableControls();
            }
        };

        this.log('[CameraSystem] Debug utilities registered (window.cameraDebug)');
    }

    /**
     * Log controls guide to console
     */
    private logControlsGuide(): void {
        console.log('');
        console.log('=== Camera Controls ===');
        console.log('  WASD         : Pan camera (move around scene)');
        console.log('  Q/E          : Move camera down/up');
        console.log('  Scroll       : Zoom in/out');
        console.log('  Right Click  : Hold and drag to rotate view');
        console.log('  Middle Click : Pan (drag to move view)');
        console.log('  Left Click   : Selection (no camera action)');
        console.log('  Shift        : Hold for faster movement');
        console.log('  V            : Toggle camera mode (orbit/walk)');
        console.log('  Home         : Reset camera to default view');
        console.log('');
        console.log('  Debug: window.cameraDebug.forceEnable() if camera stuck');
        console.log('=======================');
        console.log('');
    }

    /**
     * Conditional logging (only when debug enabled)
     */
    private log(message: string): void {
        if (this.debugEnabled) {
            console.log(message);
        }
    }

    // =========================================================================
    // CLEANUP
    // =========================================================================

    /**
     * Dispose of all resources and event listeners
     *
     * Call this when the camera system is no longer needed
     */
    dispose(): void {
        console.log('[CameraSystem] Disposing...');

        // Stop movement
        this.stopMovementLoop();
        this.clearInputState();

        // Reset control state
        this.controlsDisabled = false;
        this.disableCount = 0;

        // Remove event listeners
        if (this.boundHandlers) {
            document.removeEventListener('keydown', this.boundHandlers.keyDown);
            document.removeEventListener('keyup', this.boundHandlers.keyUp);
            this.canvas.removeEventListener('mousedown', this.boundHandlers.mouseDown);
            document.removeEventListener('mouseup', this.boundHandlers.mouseUp);
            window.removeEventListener('blur', this.boundHandlers.windowBlur);
            window.removeEventListener('focus', this.boundHandlers.windowFocus);
            document.removeEventListener('visibilitychange', this.boundHandlers.visibilityChange);
            this.boundHandlers = null;
        }

        // Clear callback
        this.shouldBlockMovementCallback = null;

        // Remove debug utilities
        if (window.cameraDebug) {
            delete window.cameraDebug;
        }

        // Dispose cameras
        if (this.orbitCamera) {
            this.orbitCamera.detachControl();
            this.orbitCamera.dispose();
            this.orbitCamera = null;
        }

        if (this.walkCamera) {
            this.walkCamera.detachControl();
            this.walkCamera.dispose();
            this.walkCamera = null;
        }

        console.log('[CameraSystem] Disposed');
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { CAMERA_CONFIG };