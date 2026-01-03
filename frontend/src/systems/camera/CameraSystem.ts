/**
 * =============================================================================
 * CAMERA SYSTEM
 * =============================================================================
 *
 * Path: frontend/src/systems/camera/CameraSystem.ts
 *
 * Main camera system for the Model Railway Workbench.
 * Provides orbit and walk cameras with Blender-like controls.
 *
 * Features:
 * - Orbit camera with arc rotation and zoom
 * - Walk camera for first-person perspective
 * - WASD/QE translation (via CameraMovementController)
 * - Mode switching between orbit and walk
 * - Focus and zoom controls
 *
 * Key behaviour:
 * - Translation moves BOTH camera.position and camera.target together
 * - Forward/right vectors derived from camera's real forward direction
 *   projected onto XZ plane, so W is always "screen forward"
 *
 * @module CameraSystem
 * @author Model Railway Workbench
 * @version 2.0.0
 */

import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Animation } from '@babylonjs/core/Animations/animation';
import { CubicEase, EasingFunction } from '@babylonjs/core/Animations/easing';
import '@babylonjs/core/Animations/animatable'; // Required side-effect for scene.beginAnimation
import type { Camera } from '@babylonjs/core/Cameras/camera';

import type { Project } from '../../core/Project';

import {
    CAMERA_CONFIG,
    CAMERA_LOG_PREFIX,
    type CameraMode,
    type CameraPresetId,
    type CameraPreset
} from './CameraTypes';

import { CameraMovementController } from './CameraMovement';

// =============================================================================
// RE-EXPORT TYPES FOR CONVENIENCE
// =============================================================================

export type { CameraMode, CameraPresetId, CameraPreset } from './CameraTypes';

// =============================================================================
// CAMERA SYSTEM CLASS
// =============================================================================

/**
 * CameraSystem - Main camera management class
 *
 * Provides comprehensive camera functionality including:
 * - Dual camera modes (orbit for building, walk for viewing)
 * - WASD/QE keyboard movement in orbit mode
 * - Smooth zoom and focus controls
 * - Camera reset functionality
 *
 * @example
 * ```typescript
 * const cameraSystem = new CameraSystem(scene, project, canvas);
 * cameraSystem.initialize();
 *
 * // Switch camera modes
 * cameraSystem.setMode('walk');
 * cameraSystem.toggleMode();
 *
 * // Focus on a specific point
 * cameraSystem.focusOn(new Vector3(0.5, 0.9, 0.3), 0.5);
 *
 * // Reset to default view
 * cameraSystem.resetOrbitCamera();
 * ```
 */
export class CameraSystem {
    // =========================================================================
    // PRIVATE PROPERTIES
    // =========================================================================

    /** Babylon.js scene reference */
    private readonly scene: Scene;

    /** Project configuration reference */
    private readonly project: Project;

    /** Canvas element for input attachment */
    private readonly canvas: HTMLCanvasElement;

    /** Orbit (arc rotate) camera instance */
    private orbitCamera: ArcRotateCamera | null = null;

    /** Walk (first person) camera instance */
    private walkCamera: UniversalCamera | null = null;

    /** Currently active camera mode */
    private currentMode: CameraMode = 'orbit';

    /** Movement controller for WASD/QE input */
    private movementController: CameraMovementController | null = null;

    /** Map of available camera presets */
    private presets: Map<CameraPresetId, CameraPreset> = new Map();

    /** Currently active preset (if any) */
    private currentPreset: CameraPresetId | null = null;

    /** Flag indicating if a transition animation is in progress */
    private isTransitioning: boolean = false;

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    /**
     * Create a new CameraSystem instance
     *
     * @param scene - Babylon.js scene to add cameras to
     * @param project - Project configuration for board dimensions
     * @param canvas - Canvas element for input attachment
     */
    constructor(scene: Scene, project: Project, canvas: HTMLCanvasElement) {
        this.scene = scene;
        this.project = project;
        this.canvas = canvas;

        console.log(`${CAMERA_LOG_PREFIX} Instance created`);
        console.log(`  Near clip: ${CAMERA_CONFIG.NEAR_CLIP_M}m (${CAMERA_CONFIG.NEAR_CLIP_M * 1000}mm)`);
        console.log(`  Min zoom: ${CAMERA_CONFIG.MIN_ZOOM_M}m (${CAMERA_CONFIG.MIN_ZOOM_M * 1000}mm)`);
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    /**
     * Initialize the camera system
     *
     * Creates orbit and walk cameras, sets up movement controls,
     * and activates the initial camera mode from project config.
     *
     * @throws Error if camera creation fails
     */
    public initialize(): void {
        console.log(`${CAMERA_LOG_PREFIX} Initializing cameras...`);

        try {
            // Create both camera types
            this.createOrbitCamera();
            this.createWalkCamera();

            // Create and initialize movement controller
            this.setupMovementControls();

            // Initialize camera presets
            this.initializePresets();

            // Set initial camera mode from project config
            const cameraConfig = this.project.getCameraConfig();
            const initialMode = cameraConfig?.defaultMode || 'orbit';
            this.setMode(initialMode);

            // Log success and controls info
            console.log(`${CAMERA_LOG_PREFIX} ✓ Camera system initialized`);
            console.log('  Keyboard Movement (Orbit):');
            console.log('    W/S = Move forward/backward (camera forward projected onto XZ)');
            console.log('    A/D = Strafe left/right');
            console.log('    Q/E = Move down/up (world Y)');
            console.log('    Shift = Faster movement (3x)');

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`${CAMERA_LOG_PREFIX} Failed to initialize cameras:`, message);
            throw new Error(`Camera initialization failed: ${message}`);
        }
    }

    // =========================================================================
    // MOVEMENT CONTROLS SETUP
    // =========================================================================

    /**
     * Set up the movement controller for WASD/QE input
     */
    private setupMovementControls(): void {
        if (!this.orbitCamera) {
            console.error(`${CAMERA_LOG_PREFIX} Cannot setup movement - orbit camera not created`);
            return;
        }

        // Create movement controller with callback to get current mode
        this.movementController = new CameraMovementController(
            this.orbitCamera,
            () => this.currentMode
        );

        // Initialize the controller (registers event listeners)
        this.movementController.initialize();
    }

    // =========================================================================
    // ORBIT CAMERA CREATION
    // =========================================================================

    /**
     * Create and configure the orbit (arc rotate) camera
     *
     * The orbit camera provides:
     * - 360° rotation around a target point
     * - Zoom in/out with mouse wheel
     * - Pan with right mouse button
     * - Touch support with pinch zoom
     */
    private createOrbitCamera(): void {
        console.log(`${CAMERA_LOG_PREFIX}   Creating orbit camera...`);

        // Get configuration from project
        const dims = this.project.getBoardDimensions();
        const cameraConfig = this.project.getCameraConfig();

        // Target the centre of the board at table height
        const targetY = dims.heightFromFloor;
        const target = new Vector3(0, targetY, 0);

        // Create the arc rotate camera
        this.orbitCamera = new ArcRotateCamera(
            'orbitCamera',
            Math.PI / 4,      // Alpha: 45° horizontal rotation
            Math.PI / 3,      // Beta: 60° from vertical (looking down)
            2.0,              // Radius: 2 meters from target
            target,
            this.scene
        );

        // ---------------------------------------------------------------------
        // CLIPPING PLANES
        // ---------------------------------------------------------------------
        this.orbitCamera.minZ = CAMERA_CONFIG.NEAR_CLIP_M;
        this.orbitCamera.maxZ = CAMERA_CONFIG.FAR_CLIP_M;

        // ---------------------------------------------------------------------
        // ZOOM LIMITS
        // ---------------------------------------------------------------------
        const configMinRadius = cameraConfig?.orbit?.minRadiusM;
        const configMaxRadius = cameraConfig?.orbit?.maxRadiusM;

        this.orbitCamera.lowerRadiusLimit = configMinRadius ?? CAMERA_CONFIG.MIN_ZOOM_M;
        this.orbitCamera.upperRadiusLimit = configMaxRadius ?? CAMERA_CONFIG.MAX_ZOOM_M;

        // ---------------------------------------------------------------------
        // ROTATION LIMITS
        // ---------------------------------------------------------------------
        // Prevent flipping below horizon or completely overhead
        this.orbitCamera.lowerBetaLimit = 0.1;                    // Min 5.7° from vertical
        this.orbitCamera.upperBetaLimit = Math.PI / 2 - 0.05;     // Max ~87° (near horizontal)

        // ---------------------------------------------------------------------
        // CONTROL SENSITIVITY
        // ---------------------------------------------------------------------
        this.orbitCamera.wheelPrecision = CAMERA_CONFIG.WHEEL_PRECISION;
        this.orbitCamera.panningSensibility = CAMERA_CONFIG.PAN_SENSIBILITY;
        this.orbitCamera.pinchPrecision = CAMERA_CONFIG.PINCH_PRECISION;

        // ---------------------------------------------------------------------
        // INERTIA (SMOOTH MOVEMENT)
        // ---------------------------------------------------------------------
        this.orbitCamera.inertia = CAMERA_CONFIG.INERTIA;
        this.orbitCamera.panningInertia = CAMERA_CONFIG.INERTIA;

        // ---------------------------------------------------------------------
        // ZOOM BEHAVIOUR
        // ---------------------------------------------------------------------
        this.orbitCamera.zoomToMouseLocation = true;
        this.orbitCamera.useNaturalPinchZoom = true;

        // ---------------------------------------------------------------------
        // ATTACH TO CANVAS
        // ---------------------------------------------------------------------
        this.orbitCamera.attachControl(this.canvas, false);

        console.log(`${CAMERA_LOG_PREFIX}   ✓ Orbit camera created`);
    }

    // =========================================================================
    // WALK CAMERA CREATION
    // =========================================================================

    /**
     * Create and configure the walk (first person) camera
     *
     * The walk camera provides:
     * - First person perspective at scaled eye height
     * - WASD movement controls
     * - Mouse look for rotation
     */
    private createWalkCamera(): void {
        console.log(`${CAMERA_LOG_PREFIX}   Creating walk camera...`);

        // Get configuration from project
        const dims = this.project.getBoardDimensions();
        const cameraConfig = this.project.getCameraConfig();

        // Eye height based on OO gauge scale
        // Default 160mm = ~12m real height in 1:76.2 scale
        const eyeHeight = cameraConfig?.walk?.eyeHeightM ?? 0.16;

        // Start position: edge of board at eye height
        const startPosition = new Vector3(0, eyeHeight, -1.0);

        // Create the universal (first person) camera
        this.walkCamera = new UniversalCamera('walkCamera', startPosition, this.scene);

        // ---------------------------------------------------------------------
        // CLIPPING PLANES
        // ---------------------------------------------------------------------
        this.walkCamera.minZ = CAMERA_CONFIG.NEAR_CLIP_M;
        this.walkCamera.maxZ = CAMERA_CONFIG.FAR_CLIP_M;

        // ---------------------------------------------------------------------
        // INITIAL LOOK TARGET
        // ---------------------------------------------------------------------
        this.walkCamera.setTarget(new Vector3(0, dims.heightFromFloor, 0));

        // ---------------------------------------------------------------------
        // MOVEMENT SETTINGS
        // ---------------------------------------------------------------------
        this.walkCamera.speed = 0.1;
        this.walkCamera.angularSensibility = 2000;

        // ---------------------------------------------------------------------
        // WASD KEY BINDINGS
        // ---------------------------------------------------------------------
        this.walkCamera.keysUp = [87];      // W
        this.walkCamera.keysDown = [83];    // S
        this.walkCamera.keysLeft = [65];    // A
        this.walkCamera.keysRight = [68];   // D

        // Attach to canvas (will be detached when switching to orbit)
        this.walkCamera.attachControl(this.canvas, true);

        console.log(`${CAMERA_LOG_PREFIX}   ✓ Walk camera created (eye height: ${eyeHeight}m)`);
    }

    // =========================================================================
    // MODE SWITCHING
    // =========================================================================

    /**
     * Set the active camera mode
     *
     * Switches between orbit (building) and walk (viewing) modes.
     * Handles input attachment/detachment for each camera.
     *
     * @param mode - The camera mode to activate
     */
    public setMode(mode: CameraMode): void {
        // Validate cameras exist
        if (!this.orbitCamera || !this.walkCamera) {
            throw new Error('Cameras not initialized - call initialize() first');
        }

        // Skip if already in this mode
        if (mode === this.currentMode) {
            return;
        }

        // Update mode
        this.currentMode = mode;

        // Clear movement state when switching
        if (this.movementController) {
            this.movementController.clearState();
        }

        // Switch active camera
        if (mode === 'orbit') {
            // Detach walk camera, attach orbit camera
            this.walkCamera.detachControl();
            this.scene.activeCamera = this.orbitCamera;
            this.orbitCamera.attachControl(this.canvas, false);
            console.log(`${CAMERA_LOG_PREFIX} → Camera mode: ORBIT (build mode)`);
        } else {
            // Detach orbit camera, attach walk camera
            this.orbitCamera.detachControl();
            this.scene.activeCamera = this.walkCamera;
            this.walkCamera.attachControl(this.canvas, true);
            console.log(`${CAMERA_LOG_PREFIX} → Camera mode: WALK (view mode)`);
        }
    }

    /**
     * Toggle between orbit and walk camera modes
     *
     * @returns The new camera mode after toggling
     */
    public toggleMode(): CameraMode {
        const newMode = this.currentMode === 'orbit' ? 'walk' : 'orbit';
        this.setMode(newMode);
        return newMode;
    }

    /**
     * Get the current camera mode
     *
     * @returns The currently active camera mode
     */
    public getCurrentMode(): CameraMode {
        return this.currentMode;
    }

    // =========================================================================
    // CAMERA ACCESS
    // =========================================================================

    /**
     * Get the currently active camera
     *
     * @returns The active camera
     * @throws Error if no camera is active
     */
    public getActiveCamera(): Camera {
        if (!this.scene.activeCamera) {
            throw new Error('No active camera - ensure initialize() was called');
        }
        return this.scene.activeCamera;
    }

    /**
     * Get the orbit camera instance
     *
     * @returns The orbit camera or null if not created
     */
    public getOrbitCamera(): ArcRotateCamera | null {
        return this.orbitCamera;
    }

    /**
     * Get the walk camera instance
     *
     * @returns The walk camera or null if not created
     */
    public getWalkCamera(): UniversalCamera | null {
        return this.walkCamera;
    }

    // =========================================================================
    // CAMERA CONTROLS
    // =========================================================================

    /**
     * Reset the orbit camera to its default position
     *
     * Returns to:
     * - 45° horizontal angle
     * - 60° vertical angle
     * - 2 meters distance
     * - Centred on the board
     */
    public resetOrbitCamera(): void {
        if (!this.orbitCamera) {
            console.warn(`${CAMERA_LOG_PREFIX} Cannot reset - orbit camera not initialized`);
            return;
        }

        // Get board dimensions for target height
        const dims = this.project.getBoardDimensions();
        const targetY = dims.heightFromFloor;

        // Reset rotation and zoom
        this.orbitCamera.alpha = Math.PI / 4;      // 45°
        this.orbitCamera.beta = Math.PI / 3;       // 60°
        this.orbitCamera.radius = 2.0;             // 2m

        // Reset target position (mutate existing Vector3)
        this.orbitCamera.target.copyFromFloats(0, targetY, 0);

        console.log(`${CAMERA_LOG_PREFIX} Orbit camera reset to default view`);
    }

    /**
     * Focus the camera on a specific position
     *
     * Moves the camera target to the specified position and
     * adjusts zoom distance. Switches to orbit mode if not already.
     *
     * @param position - World position to focus on
     * @param distance - Distance from target in meters (default: 0.3m)
     */
    public focusOn(position: Vector3, distance: number = 0.3): void {
        if (!this.orbitCamera) {
            console.warn(`${CAMERA_LOG_PREFIX} Cannot focus - orbit camera not initialized`);
            return;
        }

        // Switch to orbit mode if needed
        if (this.currentMode !== 'orbit') {
            this.setMode('orbit');
        }

        // Clamp distance to valid range
        const clampedDistance = Math.max(
            CAMERA_CONFIG.MIN_ZOOM_M,
            Math.min(distance, CAMERA_CONFIG.MAX_ZOOM_M)
        );

        // Move target and set zoom
        this.orbitCamera.target.copyFrom(position);
        this.orbitCamera.radius = clampedDistance;

        console.log(
            `${CAMERA_LOG_PREFIX} Focused on (${position.x.toFixed(3)}, ${position.y.toFixed(3)}, ${position.z.toFixed(3)}) at ${clampedDistance}m`
        );
    }

    /**
     * Set the zoom distance (radius) for the orbit camera
     *
     * @param distance - Distance from target in meters
     */
    public setZoomDistance(distance: number): void {
        if (!this.orbitCamera) {
            console.warn(`${CAMERA_LOG_PREFIX} Cannot zoom - orbit camera not initialized`);
            return;
        }

        // Clamp to valid range
        const clampedDistance = Math.max(
            CAMERA_CONFIG.MIN_ZOOM_M,
            Math.min(distance, CAMERA_CONFIG.MAX_ZOOM_M)
        );

        this.orbitCamera.radius = clampedDistance;
    }

    /**
     * Get the current zoom distance (radius) of the orbit camera
     *
     * @returns Current distance in meters, or 0 if camera not available
     */
    public getZoomDistance(): number {
        return this.orbitCamera?.radius ?? 0;
    }

    // =========================================================================
    // CAMERA PRESETS
    // =========================================================================

    /**
     * Initialize all camera presets
     * 
     * Creates preset views based on board dimensions.
     */
    private initializePresets(): void {
        console.log(`${CAMERA_LOG_PREFIX} Initializing camera presets...`);

        try {
            // Get board dimensions for calculating view positions
            const dims = this.project.getBoardDimensions();
            const boardTopY = dims.heightFromFloor + dims.thickness;

            // Calculate overhead view height (enough to see entire board)
            const maxDimension = Math.max(dims.width, dims.depth);
            const overheadHeight = maxDimension * 1.2; // 20% margin

            // ----------------------------------------------------------------
            // OVERHEAD VIEW (F1) - Top-down planning view
            // ----------------------------------------------------------------
            const overheadPreset: CameraPreset = {
                id: 'overhead',
                name: 'Overhead View',
                description: 'Top-down planning view for layout design',
                shortcut: 'F1',
                alpha: Math.PI / 2,           // Looking from +X direction
                beta: 0.01,                   // Nearly straight down (avoid gimbal lock)
                radius: overheadHeight,       // Height above board
                target: new Vector3(0, boardTopY, 0)
            };
            this.presets.set('overhead', overheadPreset);

            // ----------------------------------------------------------------
            // DEFAULT VIEW - Standard isometric starting position
            // ----------------------------------------------------------------
            const defaultPreset: CameraPreset = {
                id: 'default',
                name: 'Default View',
                description: 'Standard starting camera position',
                shortcut: 'Home',
                alpha: Math.PI / 4,           // 45 degrees
                beta: Math.PI / 3,            // 60 degrees from vertical
                radius: 2.0,                  // 2 meters out
                target: new Vector3(0, boardTopY, 0)
            };
            this.presets.set('default', defaultPreset);

            // ----------------------------------------------------------------
            // FRONT VIEW (F2) - Horizontal view at baseboard level
            // Perfect for viewing trains and track from eye level
            // ----------------------------------------------------------------
            const frontPreset: CameraPreset = {
                id: 'front',
                name: 'Front View',
                description: 'Horizontal view at baseboard level',
                shortcut: 'F2',
                alpha: Math.PI,               // Looking from -Z toward +Z (front of board)
                beta: Math.PI / 2,            // Exactly horizontal (90° from vertical)
                radius: dims.depth + 0.5,     // Distance: board depth + 0.5m clearance
                target: new Vector3(0, boardTopY, 0)
            };
            this.presets.set('front', frontPreset);

            // ----------------------------------------------------------------
            // SIDE VIEW (F3) - Horizontal view from the side
            // Perfect for viewing the length of the layout
            // ----------------------------------------------------------------
            const sidePreset: CameraPreset = {
                id: 'side',
                name: 'Side View',
                description: 'Horizontal view from the side',
                shortcut: 'F3',
                alpha: Math.PI / 2,           // Looking from +X toward -X (side of board)
                beta: Math.PI / 2,            // Exactly horizontal (90° from vertical)
                radius: dims.width + 0.5,     // Distance: board width + 0.5m clearance
                target: new Vector3(0, boardTopY, 0)
            };
            this.presets.set('side', sidePreset);

            // ----------------------------------------------------------------
            // CORNER VIEW (F4)
            // ----------------------------------------------------------------
            const cornerPreset: CameraPreset = {
                id: 'corner',
                name: 'Corner View',
                description: 'Isometric corner perspective',
                shortcut: 'F4',
                alpha: Math.PI / 4,           // 45 degree corner
                beta: Math.PI / 4,            // 45 degrees from vertical
                radius: maxDimension * 1.5,   // Distance to see whole layout
                target: new Vector3(0, boardTopY, 0)
            };
            this.presets.set('corner', cornerPreset);

            console.log(`${CAMERA_LOG_PREFIX}   ✓ ${this.presets.size} camera presets initialized`);
            console.log(`${CAMERA_LOG_PREFIX}     F1 = Overhead, F2 = Front, F3 = Side, F4 = Corner`);

        } catch (error) {
            console.error(`${CAMERA_LOG_PREFIX} Error initializing presets:`, error);
        }
    }

    /**
     * Set camera to a pre-programmed view preset
     * 
     * Animates the camera smoothly from current position to the
     * preset view configuration.
     * 
     * @param presetId - The preset view to activate
     * @param animate - Whether to animate the transition (default: true)
     * @returns True if preset was found and applied
     * 
     * @example
     * ```typescript
     * // Switch to overhead view with animation
     * cameraSystem.setPresetView('overhead');
     * 
     * // Instantly switch to default view
     * cameraSystem.setPresetView('default', false);
     * ```
     */
    public setPresetView(presetId: CameraPresetId, animate: boolean = true): boolean {
        const preset = this.presets.get(presetId);

        if (!preset) {
            console.warn(`${CAMERA_LOG_PREFIX} Unknown preset: ${presetId}`);
            return false;
        }

        // Ensure we're in orbit mode for presets
        if (this.currentMode !== 'orbit') {
            console.log(`${CAMERA_LOG_PREFIX} Switching to orbit mode for preset view`);
            this.setMode('orbit');
        }

        if (!this.orbitCamera) {
            console.error(`${CAMERA_LOG_PREFIX} Orbit camera not available`);
            return false;
        }

        console.log(`${CAMERA_LOG_PREFIX} Activating preset: ${preset.name}`);

        if (animate && !this.isTransitioning) {
            this.animateToPreset(preset);
        } else {
            this.applyPresetInstant(preset);
        }

        this.currentPreset = presetId;
        return true;
    }

    /**
     * Apply preset view instantly without animation
     */
    private applyPresetInstant(preset: CameraPreset): void {
        if (!this.orbitCamera) return;

        this.orbitCamera.alpha = preset.alpha;
        this.orbitCamera.beta = preset.beta;
        this.orbitCamera.radius = preset.radius;
        this.orbitCamera.target.copyFrom(preset.target);

        console.log(`${CAMERA_LOG_PREFIX} ✓ Applied preset: ${preset.name} (instant)`);
    }

    /**
     * Animate camera transition to a preset view
     */
    private animateToPreset(preset: CameraPreset): void {
        if (!this.orbitCamera) return;

        this.isTransitioning = true;

        const frameRate = CAMERA_CONFIG.TRANSITION_FRAME_RATE;
        const totalFrames = CAMERA_CONFIG.TRANSITION_DURATION_FRAMES;

        // Create animations for each camera parameter
        const alphaAnim = new Animation(
            'presetAlpha', 'alpha', frameRate,
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        alphaAnim.setKeys([
            { frame: 0, value: this.orbitCamera.alpha },
            { frame: totalFrames, value: preset.alpha }
        ]);

        const betaAnim = new Animation(
            'presetBeta', 'beta', frameRate,
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        betaAnim.setKeys([
            { frame: 0, value: this.orbitCamera.beta },
            { frame: totalFrames, value: preset.beta }
        ]);

        const radiusAnim = new Animation(
            'presetRadius', 'radius', frameRate,
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        radiusAnim.setKeys([
            { frame: 0, value: this.orbitCamera.radius },
            { frame: totalFrames, value: preset.radius }
        ]);

        const targetAnim = new Animation(
            'presetTarget', 'target', frameRate,
            Animation.ANIMATIONTYPE_VECTOR3,
            Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        targetAnim.setKeys([
            { frame: 0, value: this.orbitCamera.target.clone() },
            { frame: totalFrames, value: preset.target.clone() }
        ]);

        // Apply easing for smooth deceleration
        const easingFunction = new CubicEase();
        easingFunction.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);

        alphaAnim.setEasingFunction(easingFunction);
        betaAnim.setEasingFunction(easingFunction);
        radiusAnim.setEasingFunction(easingFunction);
        targetAnim.setEasingFunction(easingFunction);

        // Attach and run animations
        this.orbitCamera.animations = [alphaAnim, betaAnim, radiusAnim, targetAnim];

        this.scene.beginAnimation(
            this.orbitCamera,
            0,
            totalFrames,
            false,
            1.0,
            () => {
                this.isTransitioning = false;
                console.log(`${CAMERA_LOG_PREFIX} ✓ Transition to ${preset.name} complete`);
            }
        );
    }

    /**
     * Get all available camera presets
     * 
     * @returns Array of all preset configurations
     */
    public getAllPresets(): CameraPreset[] {
        return Array.from(this.presets.values());
    }

    /**
     * Get the currently active preset
     * 
     * @returns The current preset ID or null if camera was moved manually
     */
    public getCurrentPreset(): CameraPresetId | null {
        return this.currentPreset;
    }

    /**
     * Clear the current preset flag
     * 
     * Called when user manually moves the camera.
     */
    public clearCurrentPreset(): void {
        if (this.currentPreset !== null) {
            this.currentPreset = null;
        }
    }

    // =========================================================================
    // MOVEMENT BLOCKING (Train System Integration)
    // =========================================================================

    /**
     * Set a callback to check if camera movement should be blocked
     * 
     * This is used to integrate with the train system - when a train is selected,
     * the W/S keys should control the train throttle rather than moving the camera.
     * 
     * @param callback - Function that returns true if movement should be blocked,
     *                   or null to clear the callback
     * 
     * @example
     * ```typescript
     * // Block camera movement when a train is selected
     * cameraSystem.setShouldBlockMovement(() => {
     *     return trainSystem.getSelectedTrain() !== null;
     * });
     * 
     * // Clear the block
     * cameraSystem.setShouldBlockMovement(null);
     * ```
     */
    public setShouldBlockMovement(callback: (() => boolean) | null): void {
        if (this.movementController) {
            this.movementController.setShouldBlockMovement(callback);
        } else {
            console.warn(`${CAMERA_LOG_PREFIX} Cannot set movement block - controller not initialized`);
        }
    }

    // =========================================================================
    // CLEANUP
    // =========================================================================

    /**
     * Dispose of all camera system resources
     *
     * Removes event listeners, disposes cameras, and cleans up references.
     * Call this when destroying the application.
     */
    public dispose(): void {
        console.log(`${CAMERA_LOG_PREFIX} Disposing cameras...`);

        // Dispose movement controller
        if (this.movementController) {
            this.movementController.dispose();
            this.movementController = null;
        }

        // Clear presets
        this.presets.clear();
        this.currentPreset = null;

        // Dispose orbit camera
        if (this.orbitCamera) {
            this.orbitCamera.detachControl();
            this.orbitCamera.dispose();
            this.orbitCamera = null;
        }

        // Dispose walk camera
        if (this.walkCamera) {
            this.walkCamera.detachControl();
            this.walkCamera.dispose();
            this.walkCamera = null;
        }

        console.log(`${CAMERA_LOG_PREFIX} ✓ Cameras disposed`);
    }
}