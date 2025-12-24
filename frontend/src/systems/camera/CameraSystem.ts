/**
 * CameraSystem.ts - Camera management for orbit and walk modes
 * 
 * Orbit mode: for building/editing (ArcRotateCamera)
 * Walk mode: for viewing from eye-level (UniversalCamera)
 */

import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { Project } from '../core/Project';

export type CameraMode = 'orbit' | 'walk';

export class CameraSystem {
    private scene: Scene;
    private project: Project;
    private canvas: HTMLCanvasElement;

    private orbitCamera: ArcRotateCamera | null = null;
    private walkCamera: UniversalCamera | null = null;
    private currentMode: CameraMode = 'orbit';

    constructor(scene: Scene, project: Project, canvas: HTMLCanvasElement) {
        this.scene = scene;
        this.project = project;
        this.canvas = canvas;
    }

    /**
     * Initialize cameras
     */
    initialize(): void {
        this.createOrbitCamera();
        this.createWalkCamera();

        // Set initial mode from project config
        const cameraConfig = this.project.getCameraConfig();
        const initialMode = cameraConfig?.defaultMode || 'orbit';
        this.setMode(initialMode);

        console.log('✓ Camera system initialized');
    }

    /**
     * Create orbit camera for build mode
     */
    /**
     * Create orbit camera for build mode
     */
    private createOrbitCamera(): void {
        const dims = this.project.getBoardDimensions();
        const cameraConfig = this.project.getCameraConfig();

        // Target the center of the board
        const targetY = dims.heightFromFloor;
        const target = new Vector3(0, targetY, 0);

        // Create camera
        this.orbitCamera = new ArcRotateCamera(
            'orbitCamera',
            Math.PI / 4,        // alpha (horizontal rotation)
            Math.PI / 3,        // beta (vertical angle)
            2.5,                // radius (distance from target)
            target,
            this.scene
        );

        // Configure limits
        const orbitConfig = cameraConfig?.orbit;
        if (orbitConfig) {
            this.orbitCamera.lowerRadiusLimit = orbitConfig.minRadiusM || 1.0;
            this.orbitCamera.upperRadiusLimit = orbitConfig.maxRadiusM || 8.0;
        }

        // Prevent camera from going below ground
        this.orbitCamera.lowerBetaLimit = 0.1;
        this.orbitCamera.upperBetaLimit = Math.PI / 2 - 0.1;

        // Smooth controls
        this.orbitCamera.wheelPrecision = 50;
        this.orbitCamera.panningSensibility = 100;
        this.orbitCamera.pinchPrecision = 50;

        // CRITICAL: Attach controls WITHOUT preventing default events
        // This allows pointer events to work for placement
        this.orbitCamera.attachControl(this.canvas, false); // ← CHANGED FROM true TO false

        console.log('  Orbit camera created');
    }

    /**
     * Create walk camera for view mode
     */
    private createWalkCamera(): void {
        const dims = this.project.getBoardDimensions();
        const cameraConfig = this.project.getCameraConfig();

        // Start position: in front of the table at eye height
        const eyeHeight = cameraConfig?.walk?.eyeHeightM || 0.16;
        const startPosition = new Vector3(0, eyeHeight, -1.0);

        this.walkCamera = new UniversalCamera(
            'walkCamera',
            startPosition,
            this.scene
        );

        // Look at the board
        this.walkCamera.setTarget(new Vector3(0, dims.heightFromFloor, 0));

        // Configure movement
        this.walkCamera.speed = 0.1;
        this.walkCamera.angularSensibility = 2000;

        // Standard WASD + mouse controls
        this.walkCamera.keysUp = [87];    // W
        this.walkCamera.keysDown = [83];  // S
        this.walkCamera.keysLeft = [65];  // A
        this.walkCamera.keysRight = [68]; // D

        // Attach controls (but don't activate yet)
        this.walkCamera.attachControl(this.canvas, true);

        console.log('  Walk camera created');
    }

    /**
     * Switch camera mode
     */
    setMode(mode: CameraMode): void {
        if (!this.orbitCamera || !this.walkCamera) {
            throw new Error('Cameras not initialized');
        }

        this.currentMode = mode;

        if (mode === 'orbit') {
            this.scene.activeCamera = this.orbitCamera;
            console.log('→ Camera mode: ORBIT (build mode)');
        } else {
            this.scene.activeCamera = this.walkCamera;
            console.log('→ Camera mode: WALK (view mode)');
        }
    }

    /**
     * Toggle between orbit and walk modes
     */
    toggleMode(): void {
        const newMode = this.currentMode === 'orbit' ? 'walk' : 'orbit';
        this.setMode(newMode);
    }

    /**
     * Get current camera mode
     */
    getCurrentMode(): CameraMode {
        return this.currentMode;
    }

    /**
     * Get active camera
     */
    getActiveCamera(): Camera {
        if (!this.scene.activeCamera) {
            throw new Error('No active camera');
        }
        return this.scene.activeCamera;
    }

    /**
     * Reset orbit camera to default view
     */
    resetOrbitCamera(): void {
        if (!this.orbitCamera) return;

        const dims = this.project.getBoardDimensions();
        const targetY = dims.heightFromFloor;

        this.orbitCamera.alpha = Math.PI / 4;
        this.orbitCamera.beta = Math.PI / 3;
        this.orbitCamera.radius = 2.5;
        this.orbitCamera.target = new Vector3(0, targetY, 0);
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        this.orbitCamera?.dispose();
        this.walkCamera?.dispose();
    }
}