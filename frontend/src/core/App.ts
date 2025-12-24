/**
 * App.ts - Application with UI sidebar and mouse interaction
 * 
 * Main application controller that initializes and manages all subsystems:
 * - Scene and rendering
 * - Baseboard and table
 * - Camera system (orbit/walk modes)
 * - Track system
 * - UI and input handling
 * 
 * This file includes extensive error handling, logging, and debugging utilities
 * to ensure robust operation and easy troubleshooting.
 */

import { Scene } from '@babylonjs/core/scene';
import { Engine } from '@babylonjs/core/Engines/engine';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Vector3, Quaternion, Matrix } from '@babylonjs/core/Maths/math';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import '@babylonjs/core/Culling/ray';
import { Project } from './Project';
import { BaseboardSystem } from '../systems/baseboard/BaseboardSystem';
import { CameraSystem } from '../systems/camera/CameraSystem';
import { TrackSystem } from '../systems/track/TrackSystem';
import { UIManager } from '../ui/UIManager';
import { InputManager } from '../ui/InputManager';

// ============================================================================
// Main Application Class
// ============================================================================

export class App {
    // Core Babylon.js objects
    private engine: Engine;
    private scene: Scene;
    private canvas: HTMLCanvasElement;

    // Project and subsystems
    private project: Project;
    private baseboardSystem: BaseboardSystem | null = null;
    private cameraSystem: CameraSystem | null = null;
    private trackSystem: TrackSystem | null = null;
    private uiManager: UIManager | null = null;
    private inputManager: InputManager | null = null;

    // Interaction state
    private placementMode: string | null = null;

    // ========================================================================
    // Constructor
    // ========================================================================

    constructor(canvas: HTMLCanvasElement) {
        if (!canvas) {
            const error = '[App] Canvas element is required';
            console.error(error);
            throw new Error(error);
        }

        this.canvas = canvas;

        try {
            console.log('[App] Initializing Babylon.js engine...');

            // Create Babylon.js engine
            this.engine = new Engine(canvas, true, {
                preserveDrawingBuffer: true,
                stencil: true
            });

            if (!this.engine) {
                throw new Error('[App] Failed to create Babylon engine');
            }
            console.log('[App] Engine created successfully');

            // Create scene
            this.scene = new Scene(this.engine);
            if (!this.scene) {
                throw new Error('[App] Failed to create scene');
            }
            console.log('[App] Scene created successfully');

            // Configure scene
            this.scene.clearColor = new Color4(0.85, 0.9, 0.95, 1.0);
            console.log('[App] Scene background color set');

            // Create project manager
            this.project = new Project();
            console.log('[App] Project manager created');

            console.log('Model Railway Workbench - Initializing...');
        } catch (error) {
            console.error('[App] Constructor error:', error);
            throw error;
        }
    }

    // ========================================================================
    // Initialization
    // ========================================================================

    /**
     * Initialize all application subsystems
     * This is an async operation that loads project config and sets up all systems
     */
    async initialize(): Promise<void> {
        try {
            console.log('[App] Starting initialization sequence...');

            // Load project configuration
            console.log('[App] Loading project configuration...');
            await this.project.load();
            console.log('[App] Project configuration loaded');

            // Setup lighting
            console.log('[App] Setting up scene lighting...');
            this.setupLighting();

            // Initialize baseboard system
            console.log('[App] Initializing baseboard system...');
            this.baseboardSystem = new BaseboardSystem(this.scene, this.project);
            if (!this.baseboardSystem) {
                throw new Error('[App] Failed to create BaseboardSystem');
            }
            this.baseboardSystem.initialize();

            // Initialize camera system
            console.log('[App] Initializing camera system...');
            this.cameraSystem = new CameraSystem(this.scene, this.project, this.canvas);
            if (!this.cameraSystem) {
                throw new Error('[App] Failed to create CameraSystem');
            }
            this.cameraSystem.initialize();

            // Initialize track system
            console.log('[App] Initializing track system...');
            this.trackSystem = new TrackSystem(this.scene, this.project);
            if (!this.trackSystem) {
                throw new Error('[App] Failed to create TrackSystem');
            }
            this.trackSystem.initialize();

            // Initialize UI manager
            console.log('[App] Initializing UI manager...');
            this.uiManager = new UIManager(document.body);
            if (!this.uiManager) {
                throw new Error('[App] Failed to create UIManager');
            }
            this.uiManager.initialize((catalogId) => {
                this.onTrackSelected(catalogId);
            });

            // Initialize input manager
            console.log('[App] Initializing input manager...');
            this.inputManager = new InputManager(
                this.scene,
                this.canvas,
                this.trackSystem,
                this.baseboardSystem
            );
            if (!this.inputManager) {
                throw new Error('[App] Failed to create InputManager');
            }
            this.inputManager.initialize();

            // Setup keyboard shortcuts
            console.log('[App] Setting up keyboard shortcuts...');
            this.setupKeyboardShortcuts();

            // Setup pointer events for track placement
            console.log('[App] Setting up pointer events...');
            this.setupPointerEvents();

            // Display controls
            console.log('✓ Application initialized');
            console.log('');
            console.log('Controls:');
            console.log('  [V] - Toggle camera mode');
            console.log('  [R] - Reset camera');
            console.log('  [C] - Clear all track');
            console.log('  [ESC] - Cancel placement');
            console.log('  [DELETE] - Delete selected piece');
            console.log('  Click sidebar to select track type');
            console.log('  Click board to place track');

            // Debug: List all pickable meshes
            this.debugListPickableMeshes();

            // Debug: Check camera setup
            this.debugCameraSetup();

            console.log('[App] Initialization complete');

        } catch (error) {
            console.error('[App] Initialization error:', error);
            console.error('[App] Stack trace:', (error as Error).stack);
            throw error;
        }
    }

    // ========================================================================
    // Scene Setup
    // ========================================================================

    /**
     * Setup scene lighting
     * Creates a hemispheric light to illuminate the scene
     */
    private setupLighting(): void {
        try {
            console.log('[App] Creating hemispheric light...');

            const light = new HemisphericLight(
                'hemisphericLight',
                new Vector3(0, 1, 0),
                this.scene
            );

            if (!light) {
                throw new Error('[App] Failed to create hemispheric light');
            }

            light.intensity = 0.8;
            light.diffuse = new Color3(1.0, 0.98, 0.95);
            light.groundColor = new Color3(0.3, 0.3, 0.35);

            console.log('[App] Lighting configured successfully');
            console.log('[App] Light intensity:', light.intensity);
            console.log('[App] Light diffuse:', light.diffuse);
            // ============================================================
            // DEBUG: Direct mesh test - can we even see the baseboard?
            // ============================================================
            console.log('[App] --- Direct Mesh Test ---');
            const baseboard = this.scene.getMeshByName('baseboard');
            if (baseboard) {
                console.log('[App] Baseboard found:', {
                    name: baseboard.name,
                    isPickable: baseboard.isPickable,
                    isVisible: baseboard.isVisible,
                    isEnabled: baseboard.isEnabled(),
                    position: baseboard.position,
                    scaling: baseboard.scaling,
                    hasGeometry: !!baseboard.getTotalVertices()
                });

                // Try to manually check if ray intersects baseboard
                try {
                    const ray = this.scene.createPickingRay(
                        this.scene.pointerX,
                        this.scene.pointerY,
                        Matrix.Identity(),
                        this.scene.activeCamera!
                    );
                    const hit = ray.intersectsMesh(baseboard);
                    console.log('[App] Manual baseboard intersection test:', {
                        hit: hit.hit,
                        distance: hit.distance,
                        pickedPoint: hit.pickedPoint
                    });
                } catch (err) {
                    console.error('[App] Direct intersection test failed:', err);
                }
            } else {
                console.error('[App] Baseboard mesh not found in scene!');
            }
        } catch (error) {
            console.error('[App] Error setting up lighting:', error);
            throw error;
        }
    }

    // ========================================================================
    // User Interaction Handlers
    // ========================================================================

    /**
     * Handle track selection from UI
     * Called when user selects a track piece type from the sidebar
     * 
     * @param catalogId - The catalog ID of the selected track piece
     */
    private onTrackSelected(catalogId: string): void {
        try {
            if (!catalogId) {
                console.warn('[App] onTrackSelected called with empty catalogId');
                return;
            }

            this.placementMode = catalogId;
            console.log(`[App] Placement mode: ${catalogId}`);

            // Clear any existing selection
            if (this.inputManager) {
                this.inputManager.clearSelection();
            } else {
                console.warn('[App] InputManager not available in onTrackSelected');
            }

        } catch (error) {
            console.error('[App] Error in onTrackSelected:', error);
            console.error('[App] catalogId was:', catalogId);
        }
    }

    /**
     * Setup pointer events for track placement
     * Handles click detection and distinguishes between clicks and camera drags
     */
    private setupPointerEvents(): void {
        try {
            let pointerDownTime = 0;
            let pointerDownPos: { x: number; y: number } | null = null;

            console.log('[App] Attaching pointer observable...');

            this.scene.onPointerObservable.add((pointerInfo) => {
                try {
                    // ============================================================
                    // Track pointer down for click detection
                    // ============================================================
                    if (pointerInfo.type === 1) { // POINTERDOWN
                        pointerDownTime = Date.now();
                        pointerDownPos = {
                            x: this.scene.pointerX,
                            y: this.scene.pointerY
                        };
                        console.log('[App] Pointer down at:', pointerDownPos);
                        return;
                    }

                    // ============================================================
                    // Handle pointer up - this is where we place track
                    // ============================================================
                    if (pointerInfo.type !== 2) return; // POINTERUP = 2
                    if (pointerInfo.event.button !== 0) return; // Left button only

                    console.log('[App] Pointer up detected');

                    // Check if this was a quick click (not a drag)
                    const timeDiff = Date.now() - pointerDownTime;
                    const wasQuickClick = timeDiff < 300; // Less than 300ms
                    console.log('[App] Time since pointer down:', timeDiff, 'ms');

                    // Check if pointer moved during click
                    let pointerMoved = false;
                    if (pointerDownPos) {
                        const dx = Math.abs(this.scene.pointerX - pointerDownPos.x);
                        const dy = Math.abs(this.scene.pointerY - pointerDownPos.y);
                        pointerMoved = dx > 5 || dy > 5; // More than 5 pixels
                        console.log('[App] Pointer movement:', { dx, dy, moved: pointerMoved });
                    }

                    if (!wasQuickClick || pointerMoved) {
                        console.log('[App] Ignoring - was camera drag or slow click');
                        return;
                    }

                    console.log('[App] ======================================');
                    console.log('[App] CLICK DETECTED - Starting pick tests');
                    console.log('[App] ======================================');
                    console.log('[App] Pointer position:', this.scene.pointerX, this.scene.pointerY);
                    console.log('[App] Canvas size:', this.canvas.width, 'x', this.canvas.height);
                    console.log('[App] Engine render size:', this.engine.getRenderWidth(), 'x', this.engine.getRenderHeight());
                    console.log('[App] Active camera:', this.scene.activeCamera?.name || 'NONE');

                    // ============================================================
                    // DEBUG: Try multiple pick methods
                    // ============================================================

                    // Method 1: Standard pick (no filter)
                    console.log('[App] --- Pick Method 1: Standard pick ---');
                    try {
                        const pick1 = this.scene.pick(
                            this.scene.pointerX,
                            this.scene.pointerY
                        );
                        console.log('[App] Pick 1 result:', {
                            hit: pick1?.hit,
                            mesh: pick1?.pickedMesh?.name,
                            distance: pick1?.distance,
                            hasPickedPoint: !!pick1?.pickedPoint
                        });
                    } catch (error) {
                        console.error('[App] Pick method 1 failed:', error);
                    }

                    // Method 2: Pick with isPickable filter
                    console.log('[App] --- Pick Method 2: With pickable filter ---');
                    let pick2 = null;
                    try {
                        pick2 = this.scene.pick(
                            this.scene.pointerX,
                            this.scene.pointerY,
                            (mesh) => {
                                const isPickable = mesh.isPickable;
                                if (isPickable) {
                                    console.log('[App] Filter checking mesh:', mesh.name, '- pickable:', isPickable);
                                }
                                return isPickable;
                            }
                        );
                        console.log('[App] Pick 2 result:', {
                            hit: pick2?.hit,
                            mesh: pick2?.pickedMesh?.name,
                            distance: pick2?.distance,
                            hasPickedPoint: !!pick2?.pickedPoint
                        });
                    } catch (error) {
                        console.error('[App] Pick method 2 failed:', error);
                    }

                    // Method 3: Manual ray casting
                    console.log('[App] --- Pick Method 3: Manual ray casting ---');
                    try {
                        if (this.scene.activeCamera) {
                            const ray = this.scene.createPickingRay(
                                this.scene.pointerX,
                                this.scene.pointerY,
                                Matrix.Identity(),
                                this.scene.activeCamera
                            );
                            console.log('[App] Ray origin:', ray.origin);
                            console.log('[App] Ray direction:', ray.direction);
                            console.log('[App] Ray length:', ray.length);

                            const pick3 = this.scene.pickWithRay(ray, (mesh) => mesh.isPickable);
                            console.log('[App] Pick 3 result:', {
                                hit: pick3?.hit,
                                mesh: pick3?.pickedMesh?.name,
                                distance: pick3?.distance,
                                hasPickedPoint: !!pick3?.pickedPoint
                            });

                            // If this worked, use it
                            if (pick3?.hit && !pick2?.hit) {
                                pick2 = pick3;
                                console.log('[App] Using manual ray result');
                            }
                        } else {
                            console.error('[App] No active camera for ray casting!');
                        }
                    } catch (error) {
                        console.error('[App] Pick method 3 failed:', error);
                    }

                    console.log('[App] ======================================');

                    // Use the best pick result
                    const pickResult = pick2;

                    // ============================================================
                    // TRACK SELECTION MODE - Check if clicked existing track
                    // ============================================================
                    if (pickResult?.hit && pickResult.pickedMesh) {
                        console.log(`[App] Hit mesh: ${pickResult.pickedMesh.name}`);

                        const allPieces = this.trackSystem?.getAllPieces() || [];
                        let isTrackPiece = false;

                        for (const piece of allPieces) {
                            if (pickResult.pickedMesh.name.includes(piece.id)) {
                                isTrackPiece = true;
                                console.log('[App] Identified as track piece:', piece.id);
                                break;
                            }
                        }

                        if (isTrackPiece) {
                            console.log('[App] Clicked on track piece - passing to InputManager');
                            return;
                        }
                    }

                    // ============================================================
                    // PLACEMENT MODE - Place new track piece
                    // ============================================================
                    if (this.placementMode && this.trackSystem && this.baseboardSystem) {
                        console.log('[App] In placement mode for:', this.placementMode);

                        if (!pickResult?.hit || !pickResult.pickedPoint) {
                            console.log('[App] Click did not hit any mesh');
                            console.log('[App] Pick result was:', pickResult);
                            return;
                        }

                        console.log(`[App] ✓ Picked mesh: ${pickResult.pickedMesh?.name || 'NONE'}`);
                        console.log(`[App] ✓ Pick point: (${pickResult.pickedPoint.x.toFixed(3)}, ${pickResult.pickedPoint.y.toFixed(3)}, ${pickResult.pickedPoint.z.toFixed(3)})`);

                        // Calculate position on board top surface
                        const boardY = this.baseboardSystem.getBoardTopY();
                        const position = new Vector3(
                            pickResult.pickedPoint.x,
                            boardY,
                            pickResult.pickedPoint.z
                        );

                        console.log(`[App] Placing track at: (${position.x.toFixed(3)}, ${position.y.toFixed(3)}, ${position.z.toFixed(3)})`);

                        try {
                            // Place the track piece
                            const piece = this.trackSystem.placePiece(
                                this.placementMode,
                                position,
                                Quaternion.Identity()
                            );

                            if (piece) {
                                console.log(`[App] ✓✓✓ Successfully placed ${piece.catalogEntry.name}`);
                            } else {
                                console.warn('[App] ✗✗✗ Failed to place piece - placePiece returned null');
                            }
                        } catch (placeError) {
                            console.error('[App] Error placing track piece:', placeError);
                        }
                    } else {
                        if (!this.placementMode) {
                            console.log('[App] Not in placement mode');
                        }
                        if (!this.trackSystem) {
                            console.error('[App] TrackSystem not available!');
                        }
                        if (!this.baseboardSystem) {
                            console.error('[App] BaseboardSystem not available!');
                        }
                    }

                } catch (error) {
                    console.error('[App] Error in pointer observable handler:', error);
                    console.error('[App] Stack trace:', (error as Error).stack);
                }
            });

            console.log('[App] Pointer events configured successfully');

        } catch (error) {
            console.error('[App] Error setting up pointer events:', error);
            throw error;
        }
    }

    /**
     * Setup keyboard shortcuts
     * Handles key presses for camera control, track manipulation, etc.
     */
    private setupKeyboardShortcuts(): void {
        try {
            console.log('[App] Attaching keyboard observable...');

            this.scene.onKeyboardObservable.add((kbInfo) => {
                try {
                    const key = kbInfo.event.key.toLowerCase();
                    console.log('[App] Key pressed:', key);

                    switch (key) {
                        case 'v':
                            // Toggle camera mode
                            console.log('[App] Toggling camera mode...');
                            if (this.cameraSystem) {
                                this.cameraSystem.toggleMode();
                            } else {
                                console.warn('[App] CameraSystem not available');
                            }
                            break;

                        case 'r':
                            // Reset orbit camera
                            console.log('[App] Resetting camera...');
                            if (this.cameraSystem) {
                                this.cameraSystem.resetOrbitCamera();
                                console.log('Camera reset');
                            } else {
                                console.warn('[App] CameraSystem not available');
                            }
                            break;

                        case 'c':
                            // Clear all track
                            console.log('[App] Clearing all track...');
                            if (this.trackSystem) {
                                this.trackSystem.clear();
                                console.log('Track cleared');
                            } else {
                                console.warn('[App] TrackSystem not available');
                            }
                            break;

                        case 'escape':
                            // Cancel placement mode
                            console.log('[App] Cancelling placement mode...');
                            this.placementMode = null;
                            if (this.uiManager) {
                                this.uiManager.clearSelection();
                            }
                            if (this.inputManager) {
                                this.inputManager.clearSelection();
                            }
                            console.log('[App] Cancelled');
                            break;

                        case 'delete':
                        case 'backspace':
                            // Delete selected piece
                            console.log('[App] Attempting to delete selected piece...');
                            if (this.inputManager && this.trackSystem) {
                                const selected = this.inputManager.getSelectedPiece();
                                if (selected) {
                                    console.log('[App] Deleting piece:', selected.id);
                                    this.trackSystem.removePiece(selected.id);
                                    this.inputManager.clearSelection();
                                    console.log(`[App] Deleted ${selected.id}`);
                                } else {
                                    console.log('[App] No piece selected');
                                }
                            } else {
                                if (!this.inputManager) {
                                    console.warn('[App] InputManager not available');
                                }
                                if (!this.trackSystem) {
                                    console.warn('[App] TrackSystem not available');
                                }
                            }
                            break;

                        default:
                            // Ignore other keys
                            break;
                    }
                } catch (error) {
                    console.error('[App] Error handling keyboard event:', error);
                    console.error('[App] Key was:', kbInfo.event.key);
                }
            });

            console.log('[App] Keyboard shortcuts configured successfully');

        } catch (error) {
            console.error('[App] Error setting up keyboard shortcuts:', error);
            throw error;
        }
    }

    // ========================================================================
    // Render Loop
    // ========================================================================

    /**
     * Start the render loop
     * Begins continuous rendering and sets up window resize handling
     */
    start(): void {
        try {
            console.log('[App] Starting render loop...');

            this.engine.runRenderLoop(() => {
                try {
                    this.scene.render();
                } catch (error) {
                    console.error('[App] Render error:', error);
                }
            });

            console.log('[App] Setting up window resize handler...');
            window.addEventListener('resize', () => {
                try {
                    console.log('[App] Window resized - updating engine');
                    this.engine.resize();
                } catch (error) {
                    console.error('[App] Resize error:', error);
                }
            });

            console.log('✓ Render loop started');

        } catch (error) {
            console.error('[App] Error starting render loop:', error);
            throw error;
        }
    }

    // ========================================================================
    // Debug Utilities
    // ========================================================================

    /**
     * Debug: List all pickable meshes in the scene
     * Useful for diagnosing picking issues
     */
    private debugListPickableMeshes(): void {
        try {
            console.log('\n=== PICKABLE MESHES ===');
            let pickableCount = 0;
            let notPickableCount = 0;

            this.scene.meshes.forEach(mesh => {
                if (mesh.isPickable) {
                    console.log(`  ✓ ${mesh.name} (pickable, id: ${mesh.uniqueId})`);
                    pickableCount++;
                } else {
                    console.log(`  ✗ ${mesh.name} (NOT pickable, id: ${mesh.uniqueId})`);
                    notPickableCount++;
                }
            });

            console.log(`\nPickable: ${pickableCount}`);
            console.log(`Not pickable: ${notPickableCount}`);
            console.log(`Total meshes: ${this.scene.meshes.length}`);
            console.log('========================\n');

        } catch (error) {
            console.error('[App] Error in debugListPickableMeshes:', error);
        }
    }

    /**
     * Debug: Check camera and viewport setup
     * Verifies camera is properly configured for picking
     */
    private debugCameraSetup(): void {
        try {
            console.log('\n=== CAMERA DEBUG ===');

            const camera = this.scene.activeCamera;
            if (camera) {
                console.log('Active camera:', camera.name);
                console.log('Camera type:', camera.getClassName());
                console.log('Camera position:', camera.position);

                const target = (camera as any).target;
                if (target) {
                    console.log('Camera target:', target);
                }

                console.log('Camera viewport:', {
                    x: camera.viewport.x,
                    y: camera.viewport.y,
                    width: camera.viewport.width,
                    height: camera.viewport.height
                });

                console.log('Camera mode:', (camera as any).mode);

            } else {
                console.error('ERROR: No active camera!');
            }

            console.log('\nCanvas:');
            console.log('  Client size:', this.canvas.clientWidth, 'x', this.canvas.clientHeight);
            console.log('  Actual size:', this.canvas.width, 'x', this.canvas.height);

            console.log('\nEngine:');
            console.log('  Render size:', this.engine.getRenderWidth(), 'x', this.engine.getRenderHeight());
            console.log('  Hardware scaling:', this.engine.getHardwareScalingLevel());

            console.log('=====================\n');

        } catch (error) {
            console.error('[App] Error in debugCameraSetup:', error);
        }
    }

    // ========================================================================
    // Getters
    // ========================================================================

    /**
     * Get the Babylon.js scene
     */
    getScene(): Scene {
        return this.scene;
    }

    /**
     * Get the camera system
     */
    getCameraSystem(): CameraSystem | null {
        return this.cameraSystem;
    }

    /**
     * Get the track system
     */
    getTrackSystem(): TrackSystem | null {
        return this.trackSystem;
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    /**
     * Dispose of all resources
     * Cleans up all subsystems, scene, and engine
     */
    dispose(): void {
        try {
            console.log('[App] Disposing application...');

            if (this.uiManager) {
                console.log('[App] Disposing UI manager...');
                this.uiManager.dispose();
            }

            if (this.inputManager) {
                console.log('[App] Disposing input manager...');
                this.inputManager.dispose();
            }

            if (this.baseboardSystem) {
                console.log('[App] Disposing baseboard system...');
                this.baseboardSystem.dispose();
            }

            if (this.cameraSystem) {
                console.log('[App] Disposing camera system...');
                this.cameraSystem.dispose();
            }

            console.log('[App] Disposing scene...');
            this.scene.dispose();

            console.log('[App] Disposing engine...');
            this.engine.dispose();

            console.log('[App] Disposed successfully');

        } catch (error) {
            console.error('[App] Error disposing:', error);
        }
    }
}