/**
 * =============================================================================
 * CAMERA SYSTEM
 * =============================================================================
 *
 * Path: frontend/src/systems/camera/CameraSystem.ts
 *
 * Blender-like orbit controls + WASD/QE translation.
 *
 * Key change:
 * - Translation moves BOTH camera.position and camera.target together.
 * - Forward/right vectors are derived from the camera’s real forward direction
 *   projected onto XZ (not just alpha), so W is always “screen forward”.
 */

import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { Project } from '../../core/Project';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type CameraMode = 'orbit' | 'walk';

const CAMERA_CONFIG = {
    NEAR_CLIP_M: 0.001,
    FAR_CLIP_M: 100.0,

    MIN_ZOOM_M: 0.02,
    MAX_ZOOM_M: 8.0,

    WHEEL_PRECISION: 50,
    PAN_SENSIBILITY: 500,
    INERTIA: 0.5,
    PINCH_PRECISION: 50,

    // Movement (WASD/QE)
    STRAFE_SPEED: 0.02,
    VERTICAL_SPEED: 0.015,
    FAST_SPEED_MULTIPLIER: 3.0,

    MIN_TARGET_HEIGHT: 0.0,
    MAX_TARGET_HEIGHT: 5.0,
    MAX_HORIZONTAL_DISTANCE: 5.0,

    DEBUG_MOVEMENT: true
} as const;

// =============================================================================
// CAMERA SYSTEM CLASS
// =============================================================================

export class CameraSystem {
    private readonly scene: Scene;
    private readonly project: Project;
    private readonly canvas: HTMLCanvasElement;

    private orbitCamera: ArcRotateCamera | null = null;
    private walkCamera: UniversalCamera | null = null;

    private currentMode: CameraMode = 'orbit';

    private pressedKeys: Set<string> = new Set();
    private movementAnimationId: number | null = null;

    private boundHandlers: {
        keyDown: (e: KeyboardEvent) => void;
        keyUp: (e: KeyboardEvent) => void;
        blur: () => void;
    } | null = null;

    constructor(scene: Scene, project: Project, canvas: HTMLCanvasElement) {
        this.scene = scene;
        this.project = project;
        this.canvas = canvas;

        console.log('[CameraSystem] Instance created');
        console.log(`  Near clip: ${CAMERA_CONFIG.NEAR_CLIP_M}m (${CAMERA_CONFIG.NEAR_CLIP_M * 1000}mm)`);
        console.log(`  Min zoom: ${CAMERA_CONFIG.MIN_ZOOM_M}m (${CAMERA_CONFIG.MIN_ZOOM_M * 1000}mm)`);
    }

    initialize(): void {
        console.log('[CameraSystem] Initializing cameras...');

        try {
            this.createOrbitCamera();
            this.createWalkCamera();
            this.setupMovementControls();

            const cameraConfig = this.project.getCameraConfig();
            const initialMode = cameraConfig?.defaultMode || 'orbit';
            this.setMode(initialMode);

            console.log('✓ Camera system initialized');
            console.log('  Keyboard Movement (Orbit):');
            console.log('    W/S = Move forward/backward (camera forward projected onto XZ)');
            console.log('    A/D = Strafe left/right');
            console.log('    Q/E = Move down/up (world Y)');
            console.log('    Shift = Faster movement (3x)');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('[CameraSystem] Failed to initialize cameras:', message);
            throw new Error(`Camera initialization failed: ${message}`);
        }
    }

    // =========================================================================
    // MOVEMENT CONTROLS
    // =========================================================================

    private setupMovementControls(): void {
        console.log('  Setting up movement controls...');

        this.boundHandlers = {
            keyDown: this.handleKeyDown.bind(this),
            keyUp: this.handleKeyUp.bind(this),
            blur: this.handleWindowBlur.bind(this)
        };

        document.addEventListener('keydown', this.boundHandlers.keyDown);
        document.addEventListener('keyup', this.boundHandlers.keyUp);
        window.addEventListener('blur', this.boundHandlers.blur);

        console.log('  ✓ Movement controls configured (WASD/QE)');
    }

    private hasMovementKeyPressed(): boolean {
        return this.pressedKeys.has('KeyW') ||
            this.pressedKeys.has('KeyS') ||
            this.pressedKeys.has('KeyA') ||
            this.pressedKeys.has('KeyD') ||
            this.pressedKeys.has('KeyQ') ||
            this.pressedKeys.has('KeyE');
    }

    private handleKeyDown(event: KeyboardEvent): void {
        const code = event.code;

        const isMovementKey = code === 'KeyW' || code === 'KeyS' ||
            code === 'KeyA' || code === 'KeyD' ||
            code === 'KeyQ' || code === 'KeyE';
        const isShiftKey = code === 'ShiftLeft' || code === 'ShiftRight';

        if (!isMovementKey && !isShiftKey) {
            return;
        }

        if (event.repeat) {
            return;
        }

        this.pressedKeys.add(code);

        if (CAMERA_CONFIG.DEBUG_MOVEMENT && isMovementKey) {
            console.log(`[CameraSystem] Key DOWN: ${code}`);
            console.log('  Pressed keys:', Array.from(this.pressedKeys));
        }

        if (isMovementKey) {
            this.startMovementLoop();
        }
    }

    private handleKeyUp(event: KeyboardEvent): void {
        const code = event.code;
        this.pressedKeys.delete(code);

        if (CAMERA_CONFIG.DEBUG_MOVEMENT) {
            const isMovementKey = code === 'KeyW' || code === 'KeyS' ||
                code === 'KeyA' || code === 'KeyD' ||
                code === 'KeyQ' || code === 'KeyE';
            if (isMovementKey) {
                console.log(`[CameraSystem] Key UP: ${code}`);
            }
        }
    }

    private handleWindowBlur(): void {
        if (CAMERA_CONFIG.DEBUG_MOVEMENT) {
            console.log('[CameraSystem] Window blur - resetting input state');
        }

        this.pressedKeys.clear();
        this.stopMovementLoop();
    }

    private startMovementLoop(): void {
        if (this.movementAnimationId !== null) {
            return;
        }

        if (CAMERA_CONFIG.DEBUG_MOVEMENT) {
            console.log('[CameraSystem] Movement loop STARTED');
        }

        const movementLoop = (): void => {
            const shouldContinue = this.hasMovementKeyPressed() && this.currentMode === 'orbit';

            if (shouldContinue) {
                this.processMovement();
                this.movementAnimationId = requestAnimationFrame(movementLoop);
            } else {
                if (CAMERA_CONFIG.DEBUG_MOVEMENT) {
                    console.log('[CameraSystem] Movement loop STOPPED');
                }
                this.movementAnimationId = null;
            }
        };

        this.movementAnimationId = requestAnimationFrame(movementLoop);
    }

    private stopMovementLoop(): void {
        if (this.movementAnimationId !== null) {
            cancelAnimationFrame(this.movementAnimationId);
            this.movementAnimationId = null;
        }
    }

    /**
     * Blender-like translation:
     * - Compute camera forward direction, project to XZ plane
     * - Build right vector from cross product
     * - Move BOTH camera.position and camera.target by the same delta
     */
    private processMovement(): void {
        if (!this.orbitCamera) {
            return;
        }

        const fast = this.pressedKeys.has('ShiftLeft') || this.pressedKeys.has('ShiftRight');
        const speedMul = fast ? CAMERA_CONFIG.FAST_SPEED_MULTIPLIER : 1.0;

        const strafeSpeed = CAMERA_CONFIG.STRAFE_SPEED * speedMul;
        const verticalSpeed = CAMERA_CONFIG.VERTICAL_SPEED * speedMul;

        // Get the real forward direction and flatten it onto XZ
        const f3 = this.orbitCamera.getForwardRay().direction;
        const forward = new Vector3(f3.x, 0, f3.z);

        // If camera is looking almost straight up/down, forward length can be ~0
        if (forward.lengthSquared() < 1e-8) {
            return;
        }

        forward.normalize();

        // Right vector (camera-right on the ground plane)
        const right = Vector3.Cross(Vector3.Up(), forward).normalize();

        let delta = Vector3.Zero();

        if (this.pressedKeys.has('KeyW')) {
            delta = delta.add(forward.scale(strafeSpeed));
        }
        if (this.pressedKeys.has('KeyS')) {
            delta = delta.add(forward.scale(-strafeSpeed));
        }
        if (this.pressedKeys.has('KeyD')) delta = delta.add(right.scale(strafeSpeed));
        if (this.pressedKeys.has('KeyA')) delta = delta.add(right.scale(-strafeSpeed));
        if (this.pressedKeys.has('KeyE')) {
            delta = delta.add(new Vector3(0, verticalSpeed, 0));
        }
        if (this.pressedKeys.has('KeyQ')) {
            delta = delta.add(new Vector3(0, -verticalSpeed, 0));
        }

        if (delta.lengthSquared() < 1e-12) {
            return;
        }

        // Apply translation to BOTH position and target
        this.orbitCamera.position.addInPlace(delta);
        this.orbitCamera.target.addInPlace(delta);

        // Clamp target height (optional but keeps things sane)
        const t = this.orbitCamera.target;
        t.y = Math.min(Math.max(t.y, CAMERA_CONFIG.MIN_TARGET_HEIGHT), CAMERA_CONFIG.MAX_TARGET_HEIGHT);

        // Optional: clamp horizontal drift
        const flat = new Vector3(t.x, 0, t.z);
        const maxD = CAMERA_CONFIG.MAX_HORIZONTAL_DISTANCE;
        if (flat.length() > maxD) {
            flat.normalize().scaleInPlace(maxD);
            this.orbitCamera.target.x = flat.x;
            this.orbitCamera.target.z = flat.z;
        }

        if (CAMERA_CONFIG.DEBUG_MOVEMENT) {
            console.log('[CameraSystem] Move delta:', delta);
            console.log('[CameraSystem] New target:', this.orbitCamera.target);
        }
    }

    // =========================================================================
    // ORBIT CAMERA
    // =========================================================================

    private createOrbitCamera(): void {
        console.log('  Creating orbit camera...');

        const dims = this.project.getBoardDimensions();
        const cameraConfig = this.project.getCameraConfig();

        const targetY = dims.heightFromFloor;
        const target = new Vector3(0, targetY, 0);

        this.orbitCamera = new ArcRotateCamera(
            'orbitCamera',
            Math.PI / 4,
            Math.PI / 3,
            2.0,
            target,
            this.scene
        );

        this.orbitCamera.minZ = CAMERA_CONFIG.NEAR_CLIP_M;
        this.orbitCamera.maxZ = CAMERA_CONFIG.FAR_CLIP_M;

        const configMinRadius = cameraConfig?.orbit?.minRadiusM;
        const configMaxRadius = cameraConfig?.orbit?.maxRadiusM;

        this.orbitCamera.lowerRadiusLimit = configMinRadius ?? CAMERA_CONFIG.MIN_ZOOM_M;
        this.orbitCamera.upperRadiusLimit = configMaxRadius ?? CAMERA_CONFIG.MAX_ZOOM_M;

        this.orbitCamera.lowerBetaLimit = 0.1;
        this.orbitCamera.upperBetaLimit = Math.PI / 2 - 0.05;

        this.orbitCamera.wheelPrecision = CAMERA_CONFIG.WHEEL_PRECISION;
        this.orbitCamera.panningSensibility = CAMERA_CONFIG.PAN_SENSIBILITY;
        this.orbitCamera.pinchPrecision = CAMERA_CONFIG.PINCH_PRECISION;

        this.orbitCamera.inertia = CAMERA_CONFIG.INERTIA;
        this.orbitCamera.panningInertia = CAMERA_CONFIG.INERTIA;

        this.orbitCamera.zoomToMouseLocation = true;
        this.orbitCamera.useNaturalPinchZoom = true;

        this.orbitCamera.attachControl(this.canvas, false);

        console.log('  ✓ Orbit camera created');
    }

    // =========================================================================
    // WALK CAMERA
    // =========================================================================

    private createWalkCamera(): void {
        console.log('  Creating walk camera...');

        const dims = this.project.getBoardDimensions();
        const cameraConfig = this.project.getCameraConfig();

        const eyeHeight = cameraConfig?.walk?.eyeHeightM ?? 0.16;
        const startPosition = new Vector3(0, eyeHeight, -1.0);

        this.walkCamera = new UniversalCamera('walkCamera', startPosition, this.scene);

        this.walkCamera.minZ = CAMERA_CONFIG.NEAR_CLIP_M;
        this.walkCamera.maxZ = CAMERA_CONFIG.FAR_CLIP_M;

        this.walkCamera.setTarget(new Vector3(0, dims.heightFromFloor, 0));

        this.walkCamera.speed = 0.1;
        this.walkCamera.angularSensibility = 2000;

        this.walkCamera.keysUp = [87];
        this.walkCamera.keysDown = [83];
        this.walkCamera.keysLeft = [65];
        this.walkCamera.keysRight = [68];

        this.walkCamera.attachControl(this.canvas, true);

        console.log('  ✓ Walk camera created');
    }

    // =========================================================================
    // MODE SWITCHING
    // =========================================================================

    setMode(mode: CameraMode): void {
        if (!this.orbitCamera || !this.walkCamera) {
            throw new Error('Cameras not initialized - call initialize() first');
        }

        this.currentMode = mode;

        this.pressedKeys.clear();
        this.stopMovementLoop();

        if (mode === 'orbit') {
            this.scene.activeCamera = this.orbitCamera;
            console.log('→ Camera mode: ORBIT (build mode)');
        } else {
            this.scene.activeCamera = this.walkCamera;
            console.log('→ Camera mode: WALK (view mode)');
        }
    }

    toggleMode(): CameraMode {
        const newMode = this.currentMode === 'orbit' ? 'walk' : 'orbit';
        this.setMode(newMode);
        return newMode;
    }

    getCurrentMode(): CameraMode {
        return this.currentMode;
    }

    // =========================================================================
    // CAMERA ACCESS
    // =========================================================================

    getActiveCamera(): Camera {
        if (!this.scene.activeCamera) {
            throw new Error('No active camera - ensure initialize() was called');
        }
        return this.scene.activeCamera;
    }

    getOrbitCamera(): ArcRotateCamera | null {
        return this.orbitCamera;
    }

    getWalkCamera(): UniversalCamera | null {
        return this.walkCamera;
    }

    // =========================================================================
    // CAMERA CONTROLS
    // =========================================================================

    resetOrbitCamera(): void {
        if (!this.orbitCamera) {
            console.warn('[CameraSystem] Cannot reset - orbit camera not initialized');
            return;
        }

        const dims = this.project.getBoardDimensions();
        const targetY = dims.heightFromFloor;

        this.orbitCamera.alpha = Math.PI / 4;
        this.orbitCamera.beta = Math.PI / 3;
        this.orbitCamera.radius = 2.0;

        // IMPORTANT: keep the existing Vector3 and mutate it (safer)
        this.orbitCamera.target.copyFromFloats(0, targetY, 0);

        console.log('[CameraSystem] Orbit camera reset to default view');
    }

    focusOn(position: Vector3, distance: number = 0.3): void {
        if (!this.orbitCamera) {
            console.warn('[CameraSystem] Cannot focus - orbit camera not initialized');
            return;
        }

        if (this.currentMode !== 'orbit') {
            this.setMode('orbit');
        }

        const clampedDistance = Math.max(
            CAMERA_CONFIG.MIN_ZOOM_M,
            Math.min(distance, CAMERA_CONFIG.MAX_ZOOM_M)
        );

        this.orbitCamera.target.copyFrom(position);
        this.orbitCamera.radius = clampedDistance;

        console.log(
            `[CameraSystem] Focused on (${position.x.toFixed(3)}, ${position.y.toFixed(3)}, ${position.z.toFixed(3)}) at ${clampedDistance}m`
        );
    }

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

    getZoomDistance(): number {
        return this.orbitCamera?.radius ?? 0;
    }

    // =========================================================================
    // CLEANUP
    // =========================================================================

    dispose(): void {
        console.log('[CameraSystem] Disposing cameras...');

        this.stopMovementLoop();

        if (this.boundHandlers) {
            document.removeEventListener('keydown', this.boundHandlers.keyDown);
            document.removeEventListener('keyup', this.boundHandlers.keyUp);
            window.removeEventListener('blur', this.boundHandlers.blur);
            this.boundHandlers = null;
        }

        this.pressedKeys.clear();

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

        console.log('[CameraSystem] Cameras disposed');
    }
}
