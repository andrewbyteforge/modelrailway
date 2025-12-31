/**
 * AppCore.ts - Core Application Infrastructure
 * 
 * Path: frontend/src/core/AppCore.ts
 * 
 * Handles the foundational Babylon.js setup including:
 * - Engine and Scene creation
 * - Lighting configuration
 * - Render loop management
 * - System initialization coordination
 * - Resource disposal
 * 
 * @module AppCore
 */

import { Scene } from '@babylonjs/core/scene';
import { Engine } from '@babylonjs/core/Engines/engine';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';

import { Project } from './Project';
import { BaseboardSystem } from '../systems/baseboard/BaseboardSystem';
import { CameraSystem } from '../systems/camera/CameraSystem';
import { TrackSystem } from '../systems/track/TrackSystem';
import { TrackCatalog } from '../systems/track/TrackCatalog';
import { UIManager } from '../ui/UIManager';
import { InputManager } from '../ui/InputManager';
import { ModelImportButton } from '../ui/ModelImportButton';
import { TrainSystem } from '../systems/train/TrainSystem';
import { TrainControlPanel } from '../ui/TrainControlPanel';
import { TrainIntegration, createGlobalHelpers } from '../systems/train/TrainIntegration';
import { SidebarTransformControls } from '../ui/components/SidebarTransformControls';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Configuration options for AppCore
 */
export interface AppCoreConfig {
    /** Enable sound effects for trains */
    enableTrainSound?: boolean;
    /** Enable keyboard controls for trains */
    enableTrainKeyboard?: boolean;
    /** Enable pointer controls for trains */
    enableTrainPointer?: boolean;
    /** Throttle step increment */
    throttleStep?: number;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: AppCoreConfig = {
    enableTrainSound: true,
    enableTrainKeyboard: true,
    enableTrainPointer: true,
    throttleStep: 0.1
};

// ============================================================================
// APP CORE CLASS
// ============================================================================

/**
 * Core application class handling Babylon.js engine, scene, and system initialization.
 * 
 * This class provides the foundational infrastructure for the Model Railway Workbench,
 * managing the render loop, lighting, and coordinating all subsystems.
 * 
 * @example
 * ```typescript
 * const appCore = new AppCore(canvas);
 * await appCore.initialize();
 * appCore.start();
 * ```
 */
export class AppCore {
    // ========================================================================
    // BABYLON.JS CORE PROPERTIES
    // ========================================================================

    /** Babylon.js rendering engine */
    protected engine: Engine;

    /** Babylon.js scene containing all objects */
    protected scene: Scene;

    /** HTML canvas element for rendering */
    protected canvas: HTMLCanvasElement;

    // ========================================================================
    // PROJECT & CONFIGURATION
    // ========================================================================

    /** Project configuration and settings */
    protected project: Project;

    /** Application configuration */
    protected config: AppCoreConfig;

    // ========================================================================
    // CORE SYSTEMS
    // ========================================================================

    /** Baseboard (table surface) management system */
    protected baseboardSystem: BaseboardSystem | null = null;

    /** Camera control system */
    protected cameraSystem: CameraSystem | null = null;

    /** Track placement and management system */
    protected trackSystem: TrackSystem | null = null;

    /** UI sidebar and panel management */
    protected uiManager: UIManager | null = null;

    /** Input/selection management */
    protected inputManager: InputManager | null = null;

    /** Model import functionality */
    protected modelImportButton: ModelImportButton | null = null;

    // ========================================================================
    // TRAIN SYSTEM
    // ========================================================================

    /** Train physics and control system */
    protected trainSystem: TrainSystem | null = null;

    /** Train control panel UI */
    protected trainControlPanel: TrainControlPanel | null = null;

    /** Train-track integration handler */
    protected trainIntegration: TrainIntegration | null = null;

    // ========================================================================
    // TRANSFORM CONTROLS
    // ========================================================================

    /** Sidebar transform controls for model positioning */
    protected transformControls: SidebarTransformControls | null = null;

    // ========================================================================
    // TRACK PLACEMENT STATE
    // ========================================================================

    /** Currently selected track catalog ID for placement */
    protected placementMode: string | null = null;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Creates a new AppCore instance.
     * 
     * @param canvas - HTML canvas element for Babylon.js rendering
     * @param config - Optional configuration overrides
     * @throws Error if canvas is null or engine creation fails
     */
    constructor(canvas: HTMLCanvasElement, config: AppCoreConfig = {}) {
        // Validate canvas
        if (!canvas) {
            throw new Error('[AppCore] Canvas element is required');
        }

        this.canvas = canvas;
        this.config = { ...DEFAULT_CONFIG, ...config };

        try {
            // Create Babylon.js engine with required settings
            this.engine = new Engine(canvas, true, {
                preserveDrawingBuffer: true,
                stencil: true  // Required for HighlightLayer
            });

            if (!this.engine) {
                throw new Error('[AppCore] Failed to create Babylon engine');
            }

            // Create scene
            this.scene = new Scene(this.engine);
            if (!this.scene) {
                throw new Error('[AppCore] Failed to create scene');
            }

            // Configure scene colors - neutral to prevent color tinting on materials
            this.scene.clearColor = new Color4(0.7, 0.7, 0.7, 1.0);  // Neutral grey background
            this.scene.ambientColor = new Color3(0, 0, 0);           // No ambient tinting

            // Create project configuration handler
            this.project = new Project();

            console.log('[AppCore] Model Railway Workbench - Initializing...');

        } catch (error) {
            console.error('[AppCore] Constructor error:', error);
            throw error;
        }
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize all application systems.
     * 
     * This method must be called after construction and before start().
     * Initializes systems in dependency order:
     * 1. Project configuration
     * 2. Lighting
     * 3. Baseboard (surface)
     * 4. Camera
     * 5. Track system
     * 6. Train system
     * 7. UI components
     * 
     * @returns Promise that resolves when initialization is complete
     * @throws Error if any critical system fails to initialize
     */
    async initialize(): Promise<void> {
        try {
            console.log('[AppCore] Starting initialization...');

            // Load project configuration
            await this.project.load();

            // Setup scene lighting
            this.setupLighting();

            // Initialize baseboard system
            console.log('[AppCore] Initializing baseboard system...');
            this.baseboardSystem = new BaseboardSystem(this.scene, this.project);
            this.baseboardSystem.initialize();

            // Initialize camera system
            console.log('[AppCore] Initializing camera system...');
            this.cameraSystem = new CameraSystem(this.scene, this.project, this.canvas);
            this.cameraSystem.initialize();

            // Initialize track system
            console.log('[AppCore] Initializing track system...');
            this.trackSystem = new TrackSystem(this.scene, this.project);
            this.trackSystem.initialize();

            // ================================================================
            // TRAIN SYSTEM INITIALIZATION
            // ================================================================
            console.log('[AppCore] Initializing train system...');
            this.trainSystem = new TrainSystem(this.scene, this.trackSystem, {
                enableSound: this.config.enableTrainSound,
                enableKeyboardControls: this.config.enableTrainKeyboard,
                enablePointerControls: this.config.enableTrainPointer,
                throttleStep: this.config.throttleStep
            });
            this.trainSystem.initialize();

            // Create train control panel UI
            this.trainControlPanel = new TrainControlPanel(this.trainSystem);
            this.trainControlPanel.initialize();

            // Initialize train-track integration (auto-registers trains when placed)
            this.trainIntegration = new TrainIntegration(
                this.scene,
                this.trainSystem,
                this.trackSystem.getGraph()
            );

            // Expose systems to window for debugging (can be removed in production)
            this.exposeDebugGlobals();

            // Install global helper functions for console debugging
            createGlobalHelpers(this.scene, this.trainSystem, this.trackSystem.getGraph());

            console.log('[AppCore] ✓ Train system initialized');

            // Log available track pieces
            this.logAvailableTrackPieces();

            // ================================================================
            // UI MANAGER INITIALIZATION
            // ================================================================
            console.log('[AppCore] Initializing UI manager...');
            this.uiManager = new UIManager(document.body);
            this.uiManager.initialize((catalogId) => {
                this.onTrackSelected(catalogId);
            });

            // Wire up sidebar import button callback
            this.setupImportCallback();

            // Initialize input manager
            console.log('[AppCore] Initializing input manager...');
            this.inputManager = new InputManager(
                this.scene,
                this.canvas,
                this.trackSystem,
                this.baseboardSystem
            );
            this.inputManager.initialize();

            // ================================================================
            // MODEL IMPORT SYSTEM INITIALIZATION
            // ================================================================
            console.log('[AppCore] Initializing model import system...');
            this.modelImportButton = new ModelImportButton(
                this.scene,
                this.baseboardSystem
            );
            await this.modelImportButton.initialize();

            // ================================================================
            // CONNECT TRAIN INTEGRATION TO MODEL IMPORT
            // This enables automatic train registration when locomotives
            // are placed on track - the key connection that was missing!
            // ================================================================
            if (this.trainIntegration) {
                this.modelImportButton.setTrainIntegration(this.trainIntegration);
                console.log('[AppCore] ✓ Connected TrainIntegration to ModelImportButton');
                console.log('[AppCore]   Locomotives will auto-register when placed on track');
            }

            // Add scale controls to sidebar settings
            const scaleElement = this.modelImportButton.getScaleControlsElement();
            if (scaleElement && this.uiManager) {
                this.uiManager.addScaleControls(scaleElement);
                console.log('[AppCore] ✓ Scale controls added to sidebar');
            }

            // Initialize transform controls (position sliders)
            this.initializeTransformControls();

            console.log('[AppCore] ✓ Core initialization complete');

        } catch (error) {
            console.error('[AppCore] Initialization error:', error);
            throw error;
        }
    }

    // ========================================================================
    // LIGHTING SETUP
    // ========================================================================

    /**
     * Configure scene lighting for optimal material rendering.
     * 
     * Uses a hemispheric light with warm white diffuse and neutral grey ground
     * to prevent unwanted color tinting on imported models.
     */
    protected setupLighting(): void {
        try {
            console.log('[AppCore] Setting up scene lighting...');

            const light = new HemisphericLight(
                'hemisphericLight',
                new Vector3(0, 1, 0),  // Light direction from above
                this.scene
            );

            if (!light) {
                throw new Error('[AppCore] Failed to create light');
            }

            // Configure light properties
            light.intensity = 0.8;
            light.diffuse = new Color3(1.0, 0.98, 0.95);      // Warm white
            light.groundColor = new Color3(0.3, 0.3, 0.3);    // Neutral grey (no blue tint)

            console.log('[AppCore] ✓ Lighting configured');

        } catch (error) {
            console.error('[AppCore] Error setting up lighting:', error);
            throw error;
        }
    }

    // ========================================================================
    // TRANSFORM CONTROLS INITIALIZATION
    // ========================================================================

    /**
     * Initialize sidebar transform controls for model positioning.
     * 
     * Creates position sliders with appropriate ranges for the baseboard:
     * - Y range: 0.94 to 1.1 (baseboard at 0.95, rail top at 0.958)
     * - X/Z range: ±600mm
     */
    protected initializeTransformControls(): void {
        // Baseboard is at Y=0.95, rail top at Y=0.958
        // Allow positioning from baseboard surface to well above
        this.transformControls = new SidebarTransformControls({
            positionRangeXZ: 0.6,   // ±600mm range for X/Z
            positionMinY: 0.94,     // Slightly below baseboard surface
            positionMaxY: 1.1,      // Well above baseboard  
            showRotation: true,
            showReset: true
        });

        // Connect to model system for direct manipulation
        if (this.modelImportButton) {
            const modelSystem = this.modelImportButton.getModelSystem();
            if (modelSystem) {
                this.transformControls.connectToModelSystem(modelSystem);
            }
        }

        // Add transform controls to sidebar settings (after scale controls)
        if (this.uiManager) {
            const transformElement = this.transformControls.getElement();
            this.uiManager.addTransformControls(transformElement);
            console.log('[AppCore] ✓ Transform controls added to sidebar');
        }

        // Create selection change observer for model selection
        if (this.modelImportButton) {
            const modelSystem = this.modelImportButton.getModelSystem();
            if (modelSystem) {
                this.scene.onBeforeRenderObservable.add(() => {
                    const selected = modelSystem.getSelectedModel();
                    const selectedId = selected?.id ?? null;

                    // Only update if selection changed
                    if (this.transformControls) {
                        const currentId = (this.transformControls as any).currentModelId;
                        if (currentId !== selectedId) {
                            this.transformControls.setSelectedModel(selectedId);
                        }
                    }
                });
            }
        }
    }

    // ========================================================================
    // IMPORT CALLBACK SETUP
    // ========================================================================

    /**
     * Setup the import button callback for the UI sidebar.
     * Finds and triggers the existing model import dialog.
     */
    protected setupImportCallback(): void {
        if (!this.uiManager) return;

        this.uiManager.setImportCallback(() => {
            // Find the existing import button by its ID or text
            const existingButton = document.getElementById('model-import-button') ||
                document.querySelector('button[title*="Import"]') ||
                Array.from(document.querySelectorAll('button')).find(
                    btn => btn.textContent?.includes('Import Model')
                );

            if (existingButton) {
                (existingButton as HTMLButtonElement).click();
            } else if (this.modelImportButton) {
                // Fallback: try calling openDialog if it exists
                (this.modelImportButton as any).showImportDialog?.() ||
                    (this.modelImportButton as any).openDialog?.();
            } else {
                console.warn('[AppCore] Could not find import button');
            }
        });
    }

    // ========================================================================
    // DEBUG GLOBALS
    // ========================================================================

    /**
     * Expose systems to window object for console debugging.
     * Can be disabled in production builds.
     */
    protected exposeDebugGlobals(): void {
        (window as any).trainSystem = this.trainSystem;
        (window as any).trainIntegration = this.trainIntegration;
        (window as any).trackSystem = this.trackSystem;
        (window as any).scene = this.scene;
    }

    // ========================================================================
    // TRACK CATALOG LOGGING
    // ========================================================================

    /**
     * Log all available track pieces from the catalog.
     * Useful for debugging and development.
     */
    protected logAvailableTrackPieces(): void {
        console.log('[AppCore] Available track pieces:');
        const allPieces = TrackCatalog.getAll();
        allPieces.forEach(piece => {
            console.log(`  - ${piece.id}: ${piece.name} (${piece.lengthM.toFixed(3)}m)`);
        });
    }

    // ========================================================================
    // TRACK SELECTION HANDLER
    // ========================================================================

    /**
     * Handle track piece selection from the UI palette.
     * 
     * @param catalogId - Catalog ID of the selected track piece
     */
    protected onTrackSelected(catalogId: string): void {
        try {
            this.placementMode = catalogId;
            console.log(`[AppCore] Placement mode: ${catalogId}`);

            if (this.inputManager) {
                this.inputManager.clearSelection();
                this.inputManager.setPlacementMode(true);  // Disable hover/selection
            }
        } catch (error) {
            console.error('[AppCore] Error in onTrackSelected:', error);
        }
    }

    // ========================================================================
    // RENDER LOOP
    // ========================================================================

    /**
     * Start the render loop and begin rendering.
     * 
     * Sets up:
     * - Main render loop with delta time calculation
     * - Train system updates
     * - Window resize handler
     */
    start(): void {
        try {
            console.log('[AppCore] Starting render loop...');

            // Track time for delta calculation
            let lastTime = performance.now();

            this.engine.runRenderLoop(() => {
                try {
                    // Calculate delta time in seconds
                    const currentTime = performance.now();
                    const deltaTime = (currentTime - lastTime) / 1000;
                    lastTime = currentTime;

                    // Update train system (physics, movement, etc.)
                    if (this.trainSystem) {
                        this.trainSystem.update(deltaTime);
                    }

                    // Render scene
                    this.scene.render();

                } catch (error) {
                    console.error('[AppCore] Render error:', error);
                }
            });

            // Handle window resize
            window.addEventListener('resize', () => {
                try {
                    this.engine.resize();
                } catch (error) {
                    console.error('[AppCore] Resize error:', error);
                }
            });

            console.log('[AppCore] ✓ Render loop started');

        } catch (error) {
            console.error('[AppCore] Error starting render loop:', error);
            throw error;
        }
    }

    // ========================================================================
    // ACCESSORS
    // ========================================================================

    /**
     * Get the Babylon.js scene.
     * @returns The active Scene instance
     */
    getScene(): Scene {
        return this.scene;
    }

    /**
     * Get the Babylon.js engine.
     * @returns The active Engine instance
     */
    getEngine(): Engine {
        return this.engine;
    }

    /**
     * Get the canvas element.
     * @returns The HTML canvas element
     */
    getCanvas(): HTMLCanvasElement {
        return this.canvas;
    }

    /**
     * Get the project configuration.
     * @returns The Project instance
     */
    getProject(): Project {
        return this.project;
    }

    /**
     * Get the camera system.
     * @returns CameraSystem or null if not initialized
     */
    getCameraSystem(): CameraSystem | null {
        return this.cameraSystem;
    }

    /**
     * Get the baseboard system.
     * @returns BaseboardSystem or null if not initialized
     */
    getBaseboardSystem(): BaseboardSystem | null {
        return this.baseboardSystem;
    }

    /**
     * Get the track system.
     * @returns TrackSystem or null if not initialized
     */
    getTrackSystem(): TrackSystem | null {
        return this.trackSystem;
    }

    /**
     * Get the train system.
     * @returns TrainSystem or null if not initialized
     */
    getTrainSystem(): TrainSystem | null {
        return this.trainSystem;
    }

    /**
     * Get the train integration handler.
     * @returns TrainIntegration or null if not initialized
     */
    getTrainIntegration(): TrainIntegration | null {
        return this.trainIntegration;
    }

    /**
     * Get the UI manager.
     * @returns UIManager or null if not initialized
     */
    getUIManager(): UIManager | null {
        return this.uiManager;
    }

    /**
     * Get the input manager.
     * @returns InputManager or null if not initialized
     */
    getInputManager(): InputManager | null {
        return this.inputManager;
    }

    /**
     * Get the model import button system.
     * @returns ModelImportButton or null if not initialized
     */
    getModelImportButton(): ModelImportButton | null {
        return this.modelImportButton;
    }

    /**
     * Get the current placement mode catalog ID.
     * @returns Catalog ID or null if not in placement mode
     */
    getPlacementMode(): string | null {
        return this.placementMode;
    }

    /**
     * Set the placement mode.
     * @param mode - Catalog ID or null to exit placement mode
     */
    setPlacementMode(mode: string | null): void {
        this.placementMode = mode;
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Dispose of all resources and clean up.
     * 
     * Should be called when the application is being destroyed.
     * Disposes systems in reverse initialization order.
     */
    dispose(): void {
        try {
            console.log('[AppCore] Disposing...');

            // Dispose Train System
            if (this.trainControlPanel) {
                this.trainControlPanel.dispose();
                this.trainControlPanel = null;
            }
            if (this.trainSystem) {
                this.trainSystem.dispose();
                this.trainSystem = null;
            }
            this.trainIntegration = null;

            // Dispose UI systems
            if (this.uiManager) this.uiManager.dispose();
            if (this.inputManager) this.inputManager.dispose();
            if (this.modelImportButton) this.modelImportButton.dispose();

            // Dispose core systems
            if (this.trackSystem) this.trackSystem.dispose();
            if (this.baseboardSystem) this.baseboardSystem.dispose();
            if (this.cameraSystem) this.cameraSystem.dispose();

            // Dispose Babylon.js
            this.scene.dispose();
            this.engine.dispose();

            console.log('[AppCore] ✓ Disposed');

        } catch (error) {
            console.error('[AppCore] Error disposing:', error);
        }
    }
}