/**
 * App.ts - Application with UI sidebar and mouse interaction
 * 
 * Path: frontend/src/core/App.ts
 * 
 * Main application controller that initializes all systems
 * and coordinates track placement testing.
 * 
 * @module App
 */

import { Scene } from '@babylonjs/core/scene';
import { Engine } from '@babylonjs/core/Engines/engine';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
// Note: Ray is imported via side-effect in main.ts

import { Project } from './Project';
import { BaseboardSystem } from '../systems/baseboard/BaseboardSystem';
import { CameraSystem } from '../systems/camera/CameraSystem';
import { TrackSystem } from '../systems/track/TrackSystem';
import { TrackCatalog } from '../systems/track/TrackCatalog';
import { UIManager } from '../ui/UIManager';
import { InputManager } from '../ui/InputManager';

// ============================================================================
// APP CLASS
// ============================================================================

/**
 * Main application class
 */
export class App {
    private engine: Engine;
    private scene: Scene;
    private canvas: HTMLCanvasElement;

    private project: Project;
    private baseboardSystem: BaseboardSystem | null = null;
    private cameraSystem: CameraSystem | null = null;
    private trackSystem: TrackSystem | null = null;
    private uiManager: UIManager | null = null;
    private inputManager: InputManager | null = null;

    private placementMode: string | null = null;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    constructor(canvas: HTMLCanvasElement) {
        if (!canvas) {
            throw new Error('[App] Canvas element is required');
        }

        this.canvas = canvas;

        try {
            this.engine = new Engine(canvas, true, {
                preserveDrawingBuffer: true,
                stencil: true
            });

            if (!this.engine) {
                throw new Error('[App] Failed to create Babylon engine');
            }

            this.scene = new Scene(this.engine);
            if (!this.scene) {
                throw new Error('[App] Failed to create scene');
            }

            // Scene colors - neutral to prevent color tinting on materials
            this.scene.clearColor = new Color4(0.7, 0.7, 0.7, 1.0);  // Neutral grey background
            this.scene.ambientColor = new Color3(0, 0, 0);           // No ambient tinting

            this.project = new Project();

            console.log('Model Railway Workbench - Initializing...');
        } catch (error) {
            console.error('[App] Constructor error:', error);
            throw error;
        }
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    async initialize(): Promise<void> {
        try {
            console.log('[App] Starting initialization...');

            // Load project configuration
            await this.project.load();

            // Setup scene lighting
            this.setupLighting();

            // Initialize baseboard system
            console.log('[App] Initializing baseboard system...');
            this.baseboardSystem = new BaseboardSystem(this.scene, this.project);
            this.baseboardSystem.initialize();

            // Initialize camera system
            console.log('[App] Initializing camera system...');
            this.cameraSystem = new CameraSystem(this.scene, this.project, this.canvas);
            this.cameraSystem.initialize();

            // Initialize track system
            console.log('[App] Initializing track system...');
            this.trackSystem = new TrackSystem(this.scene, this.project);
            this.trackSystem.initialize();

            // Log available track pieces
            this.logAvailableTrackPieces();

            // Initialize UI manager
            console.log('[App] Initializing UI manager...');
            this.uiManager = new UIManager(document.body);
            this.uiManager.initialize((catalogId) => {
                this.onTrackSelected(catalogId);
            });

            // Register toggle callbacks
            this.setupUIToggles();

            // Initialize input manager
            console.log('[App] Initializing input manager...');
            this.inputManager = new InputManager(
                this.scene,
                this.canvas,
                this.trackSystem,
                this.baseboardSystem
            );
            this.inputManager.initialize();

            // Setup keyboard shortcuts
            this.setupKeyboardShortcuts();

            // Setup pointer events for track placement
            this.setupPointerEvents();

            // Place test tracks to verify rendering
            this.placeTestTracks();

            console.log('[App] ✓ Initialization complete');
            console.log('');
            console.log('=== Controls ===');
            console.log('  Click palette → Select track type');
            console.log('  Click board → Place track (auto-snaps!)');
            console.log('  Click track → Select track');
            console.log('  Q/E → Rotate selected ±5°');
            console.log('  Shift+Q/E → Rotate ±22.5°');
            console.log('  Delete → Remove selected');
            console.log('  ESC → Deselect / Cancel placement');
            console.log('  V → Toggle camera mode');
            console.log('  Home → Reset camera');
            console.log('  Shift+S → Toggle auto-snap');
            console.log('  Shift+I → Toggle connection indicators');
            console.log('  Shift+C → Clear all track');
            console.log('  T → Place test tracks');
            console.log('================');
            console.log('');
            console.log('Connection indicators:');
            console.log('  🟠 Orange = Available connector');
            console.log('  🟢 Green = Connected');
            console.log('  🔵 Blue = Snap preview');

        } catch (error) {
            console.error('[App] Initialization error:', error);
            throw error;
        }
    }

    /**
     * Setup UI toggle button callbacks
     */
    private setupUIToggles(): void {
        if (!this.uiManager || !this.trackSystem) return;

        // Connection Indicators toggle
        this.uiManager.registerToggleCallback('connectionIndicators', (enabled) => {
            if (this.trackSystem) {
                this.trackSystem.setConnectionIndicators(enabled);
            }
        });

        // Auto-Snap toggle
        this.uiManager.registerToggleCallback('autoSnap', (enabled) => {
            if (this.trackSystem) {
                this.trackSystem.setAutoSnap(enabled);
            }
        });

        console.log('[App] UI toggle callbacks registered');
    }

    /**
     * Log all available track pieces from catalog
     */
    private logAvailableTrackPieces(): void {
        console.log('[App] Available track pieces:');
        const allPieces = TrackCatalog.getAll();
        allPieces.forEach(piece => {
            console.log(`  - ${piece.id}: ${piece.name} (${piece.lengthM.toFixed(3)}m)`);
        });
    }

    /**
     * Place test tracks to verify rendering is working
     */
    private placeTestTracks(): void {
        if (!this.trackSystem || !this.baseboardSystem) {
            console.error('[App] Cannot place test tracks - systems not initialized');
            return;
        }

        const boardY = this.baseboardSystem.getBoardTopY();

        console.log('[App] ========================================');
        console.log('[App] Placing test tracks (end-to-end)...');
        console.log('[App] ========================================');

        // Test 1: First straight track - centered at X=-0.084 so connector B is at X=0
        console.log('[App] Test 1: Placing straight track #1...');
        const straight1 = this.trackSystem.placePiece(
            'track.straight_168mm',
            new Vector3(-0.084, boardY, 0),
            Quaternion.Identity()
        );
        if (straight1) {
            console.log(`[App] ✓ Straight #1 placed: ${straight1.id}`);
            console.log(`[App]   Connector A at X=${(-0.084 - 0.084).toFixed(3)}, Connector B at X=${(-0.084 + 0.084).toFixed(3)}`);
        } else {
            console.error('[App] ✗ Failed to place straight track #1');
        }

        // Test 2: Second straight track - centered at X=+0.084 so connector A is at X=0
        // This should connect to straight1's connector B!
        console.log('[App] Test 2: Placing straight track #2 (should connect to #1)...');
        const straight2 = this.trackSystem.placePiece(
            'track.straight_168mm',
            new Vector3(0.084, boardY, 0),
            Quaternion.Identity()
        );
        if (straight2) {
            console.log(`[App] ✓ Straight #2 placed: ${straight2.id}`);
            console.log(`[App]   Connector A at X=${(0.084 - 0.084).toFixed(3)}, Connector B at X=${(0.084 + 0.084).toFixed(3)}`);
        } else {
            console.error('[App] ✗ Failed to place straight track #2');
        }

        // Test 3: Third straight at different Z position (not connected)
        console.log('[App] Test 3: Placing separate straight track...');
        const straight3 = this.trackSystem.placePiece(
            'track.straight_168mm',
            new Vector3(0, boardY, 0.15),
            Quaternion.Identity()
        );
        if (straight3) {
            console.log(`[App] ✓ Straight #3 placed: ${straight3.id} (separate)`);
        } else {
            console.error('[App] ✗ Failed to place straight track #3');
        }

        // Test 4: R1 45° curve
        console.log('[App] Test 4: Placing R1 45° curve...');
        const curve = this.trackSystem.placePiece(
            'track.curve_r1_45deg_left',
            new Vector3(-0.3, boardY, -0.15),
            Quaternion.Identity()
        );
        if (curve) {
            console.log(`[App] ✓ Curve placed: ${curve.id}`);
        } else {
            console.error('[App] ✗ Failed to place curve');
        }

        // Log results
        const stats = this.trackSystem.getStats();
        console.log('[App] ========================================');
        console.log(`[App] Test complete: ${stats.pieceCount} pieces, ${stats.meshCount} meshes`);
        console.log(`[App] Total track length: ${(stats.totalLengthM * 1000).toFixed(1)}mm`);
        console.log('[App] ========================================');
    }

    // ========================================================================
    // LIGHTING SETUP
    // ========================================================================

    private setupLighting(): void {
        try {
            console.log('[App] Setting up scene lighting...');

            const light = new HemisphericLight(
                'hemisphericLight',
                new Vector3(0, 1, 0),
                this.scene
            );

            if (!light) {
                throw new Error('[App] Failed to create light');
            }

            light.intensity = 0.8;
            light.diffuse = new Color3(1.0, 0.98, 0.95);      // Warm white
            light.groundColor = new Color3(0.3, 0.3, 0.3);    // Neutral grey (no blue tint)

            console.log('[App] ✓ Lighting configured');
        } catch (error) {
            console.error('[App] Error setting up lighting:', error);
            throw error;
        }
    }

    // ========================================================================
    // TRACK SELECTION
    // ========================================================================

    private onTrackSelected(catalogId: string): void {
        try {
            this.placementMode = catalogId;
            console.log(`[App] Placement mode: ${catalogId}`);

            if (this.inputManager) {
                this.inputManager.clearSelection();
                this.inputManager.setPlacementMode(true);  // Disable hover/selection
            }
        } catch (error) {
            console.error('[App] Error in onTrackSelected:', error);
        }
    }

    // ========================================================================
    // POINTER EVENTS
    // ========================================================================

    /** Track mouse position for click vs drag detection */
    private pointerDownPos: { x: number; y: number } | null = null;
    private readonly DRAG_THRESHOLD = 5; // pixels - movement beyond this is a drag

    private setupPointerEvents(): void {
        try {
            // Track mousedown position
            this.canvas.addEventListener('pointerdown', (event: PointerEvent) => {
                if (event.button === 0) { // Left button only
                    this.pointerDownPos = { x: event.clientX, y: event.clientY };
                }
            });

            // On pointerup, check if it was a click or drag
            this.canvas.addEventListener('pointerup', (event: PointerEvent) => {
                if (event.button !== 0 || !this.pointerDownPos) return;

                // Calculate distance moved
                const dx = event.clientX - this.pointerDownPos.x;
                const dy = event.clientY - this.pointerDownPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Clear the stored position
                this.pointerDownPos = null;

                // If moved too much, it was a drag (camera movement), not a click
                if (distance > this.DRAG_THRESHOLD) {
                    // Don't log on every drag - too noisy
                    return;
                }

                // It was a click - handle track placement
                this.handleCanvasClick(event);
            });

            // Mousemove for snap preview during placement mode
            this.canvas.addEventListener('pointermove', (event: PointerEvent) => {
                this.handlePointerMove(event);
            });

            // Right-click to cancel placement mode
            this.canvas.addEventListener('contextmenu', (event: MouseEvent) => {
                if (this.placementMode) {
                    event.preventDefault(); // Prevent context menu
                    this.cancelPlacementMode();
                }
            });

            console.log('[App] Pointer events configured');
        } catch (error) {
            console.error('[App] Error setting up pointer events:', error);
        }
    }

    /**
     * Handle pointer move for snap preview during placement mode
     */
    private handlePointerMove(event: PointerEvent): void {
        // Only handle in placement mode
        if (!this.placementMode || !this.trackSystem || !this.baseboardSystem) {
            return;
        }

        try {
            // Get board intersection point
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            const camera = this.scene.activeCamera;
            if (!camera) return;

            const ray = this.scene.createPickingRay(x, y, null, camera);
            const baseboard = this.baseboardSystem.getBaseboard();
            if (!baseboard) return;

            const intersection = ray.intersectsMesh(baseboard);

            if (intersection.hit && intersection.pickedPoint) {
                const boardY = this.baseboardSystem.getBoardTopY();
                const position = new Vector3(
                    intersection.pickedPoint.x,
                    boardY,
                    intersection.pickedPoint.z
                );

                // Check for snap preview
                const snapPreview = this.trackSystem.getSnapPreview(
                    this.placementMode,
                    position,
                    Quaternion.Identity()
                );

                if (snapPreview) {
                    // Show snap preview indicator
                    this.trackSystem.showSnapPreview(snapPreview.connectorPos);
                } else {
                    // Hide snap preview
                    this.trackSystem.hideSnapPreview();
                }
            } else {
                // Not over board, hide preview
                this.trackSystem.hideSnapPreview();
            }
        } catch (error) {
            // Don't log errors on every mouse move
        }
    }

    /**
     * Cancel placement mode and re-enable selection
     */
    private cancelPlacementMode(): void {
        this.placementMode = null;

        if (this.uiManager) {
            this.uiManager.clearSelection();
        }
        if (this.inputManager) {
            this.inputManager.clearSelection();
            this.inputManager.setPlacementMode(false);
        }
        if (this.trackSystem) {
            this.trackSystem.hideSnapPreview();
        }

        console.log('[App] Placement mode cancelled');
    }

    /**
     * Rotate the currently selected track piece with smooth animation
     * @param angleDeg - Angle to rotate in degrees (positive = clockwise)
     */
    private rotateSelectedPiece(angleDeg: number): void {
        try {
            if (!this.inputManager || !this.trackSystem) {
                return;
            }

            const selected = this.inputManager.getSelectedPiece();

            if (!selected) {
                return;
            }

            // Get current rotation
            const currentRotation = selected.transform.rotation.clone();

            // Create rotation around Y axis (up)
            const additionalRotation = Quaternion.RotationAxis(
                Vector3.Up(),
                angleDeg * Math.PI / 180
            );

            // Calculate target rotation
            const targetRotation = currentRotation.multiply(additionalRotation);

            // Animate the rotation smoothly
            this.animateRotation(selected.id, currentRotation, targetRotation);

        } catch (error) {
            console.error('[App] Error rotating piece:', error);
        }
    }

    /**
     * Animate rotation smoothly from current to target
     */
    private animateRotation(pieceId: string, fromRotation: Quaternion, toRotation: Quaternion): void {
        const duration = 150; // milliseconds
        const startTime = performance.now();

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Use smooth easing (ease-out)
            const eased = 1 - Math.pow(1 - progress, 3);

            // Interpolate rotation
            const currentRotation = Quaternion.Slerp(fromRotation, toRotation, eased);

            // Apply rotation
            this.trackSystem?.rotatePiece(pieceId, currentRotation);

            // Continue animation if not complete
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    /**
     * Handle canvas click for track placement
     * Only called for actual clicks (not drags)
     */
    private handleCanvasClick(event: PointerEvent): void {
        try {
            // Only handle left click
            if (event.button !== 0) return;

            console.log(`[App] Canvas click at (${event.clientX}, ${event.clientY})`);
            console.log(`[App] Placement mode: ${this.placementMode || 'none'}`);

            // If not in placement mode, ignore
            if (!this.placementMode) {
                console.log('[App] Not in placement mode, ignoring click');
                return;
            }

            if (!this.trackSystem || !this.baseboardSystem) {
                console.error('[App] Systems not initialized');
                return;
            }

            // Get the baseboard mesh
            const baseboard = this.baseboardSystem.getBaseboard();
            if (!baseboard) {
                console.error('[App] No baseboard mesh');
                return;
            }

            // Create picking ray from camera through mouse position
            const camera = this.scene.activeCamera;
            if (!camera) {
                console.error('[App] No active camera');
                return;
            }

            // Get canvas-relative coordinates  
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            console.log(`[App] Canvas coords: (${x.toFixed(0)}, ${y.toFixed(0)})`);
            console.log(`[App] Canvas size: ${this.canvas.width} x ${this.canvas.height}`);

            // Create a picking ray from camera through click point
            const ray = this.scene.createPickingRay(
                x,
                y,
                null,
                camera
            );

            console.log(`[App] Ray origin: (${ray.origin.x.toFixed(2)}, ${ray.origin.y.toFixed(2)}, ${ray.origin.z.toFixed(2)})`);
            console.log(`[App] Ray direction: (${ray.direction.x.toFixed(2)}, ${ray.direction.y.toFixed(2)}, ${ray.direction.z.toFixed(2)})`);

            // Try picking with the ray
            const pickResult = this.scene.pickWithRay(ray);

            console.log(`[App] Pick result - hit: ${pickResult?.hit}, mesh: ${pickResult?.pickedMesh?.name || 'none'}`);

            if (pickResult?.hit && pickResult.pickedPoint) {
                console.log(`[App] Pick point: (${pickResult.pickedPoint.x.toFixed(3)}, ${pickResult.pickedPoint.y.toFixed(3)}, ${pickResult.pickedPoint.z.toFixed(3)})`);

                const boardY = this.baseboardSystem.getBoardTopY();
                const position = new Vector3(
                    pickResult.pickedPoint.x,
                    boardY,
                    pickResult.pickedPoint.z
                );

                console.log(`[App] Placing ${this.placementMode} at (${position.x.toFixed(3)}, ${position.z.toFixed(3)})`);

                const piece = this.trackSystem.placePiece(
                    this.placementMode,
                    position,
                    Quaternion.Identity()
                );

                if (piece) {
                    console.log(`[App] ✓ Placed ${piece.catalogEntry.name}`);
                } else {
                    console.warn('[App] Failed to place piece');
                }
            } else {
                console.log('[App] No valid pick point');

                // Debug: Try to intersect with baseboard directly
                const intersection = ray.intersectsMesh(baseboard);
                console.log(`[App] Direct baseboard intersection: hit=${intersection.hit}`);
                if (intersection.hit && intersection.pickedPoint) {
                    console.log(`[App] Direct intersection point: (${intersection.pickedPoint.x.toFixed(3)}, ${intersection.pickedPoint.y.toFixed(3)}, ${intersection.pickedPoint.z.toFixed(3)})`);

                    // Use this intersection!
                    const boardY = this.baseboardSystem.getBoardTopY();
                    const position = new Vector3(
                        intersection.pickedPoint.x,
                        boardY,
                        intersection.pickedPoint.z
                    );

                    console.log(`[App] Placing via direct intersection at (${position.x.toFixed(3)}, ${position.z.toFixed(3)})`);

                    const piece = this.trackSystem.placePiece(
                        this.placementMode,
                        position,
                        Quaternion.Identity()
                    );

                    if (piece) {
                        console.log(`[App] ✓ Placed ${piece.catalogEntry.name}`);
                    }
                }
            }
        } catch (error) {
            console.error('[App] Error in handleCanvasClick:', error);
        }
    }

    // ========================================================================
    // KEYBOARD SHORTCUTS
    // ========================================================================

    private setupKeyboardShortcuts(): void {
        try {
            this.scene.onKeyboardObservable.add((kbInfo) => {
                // Only handle key down events
                if (kbInfo.type !== 1) return;

                try {
                    const key = kbInfo.event.key.toLowerCase();
                    const shiftKey = kbInfo.event.shiftKey;

                    switch (key) {
                        case 'v':
                            // Toggle camera mode
                            if (this.cameraSystem) {
                                this.cameraSystem.toggleMode();
                            }
                            break;

                        case 'r':
                            // Rotate selected track piece
                            if (this.inputManager && this.trackSystem) {
                                const selected = this.inputManager.getSelectedPiece();
                                if (selected) {
                                    // Rotate 5° per key press (Shift for larger 22.5° jumps)
                                    const angle = shiftKey ? 22.5 : 5;
                                    this.rotateSelectedPiece(angle);
                                } else {
                                    // No selection - reset camera instead
                                    if (this.cameraSystem) {
                                        this.cameraSystem.resetOrbitCamera();
                                        console.log('[App] Camera reset');
                                    }
                                }
                            }
                            break;

                        case 'q':
                            // Rotate counter-clockwise (Shift for larger jump)
                            if (this.inputManager?.getSelectedPiece()) {
                                const angle = shiftKey ? -22.5 : -5;
                                this.rotateSelectedPiece(angle);
                            }
                            break;

                        case 'e':
                            // Rotate clockwise (Shift for larger jump)
                            if (this.inputManager?.getSelectedPiece()) {
                                const angle = shiftKey ? 22.5 : 5;
                                this.rotateSelectedPiece(angle);
                            }
                            break;

                        case 'c':
                            // Clear all track (with Shift to prevent accidents)
                            if (shiftKey && this.trackSystem) {
                                this.trackSystem.clear();
                                console.log('[App] Track cleared');
                            }
                            break;

                        case 'escape':
                            // First priority: deselect any selected track
                            if (this.inputManager?.getSelectedPiece()) {
                                this.inputManager.clearSelection();
                                console.log('[App] Track deselected');
                            }
                            // Second priority: cancel placement mode
                            else if (this.placementMode) {
                                this.cancelPlacementMode();
                            }
                            break;

                        case 'delete':
                        case 'backspace':
                            // Delete selected piece
                            if (this.inputManager && this.trackSystem) {
                                const selected = this.inputManager.getSelectedPiece();
                                if (selected) {
                                    this.trackSystem.removePiece(selected.id);
                                    this.inputManager.clearSelection();
                                    console.log(`[App] Deleted ${selected.id}`);
                                }
                            }
                            break;

                        case 't':
                            // Place test tracks again
                            this.placeTestTracks();
                            break;

                        case 'home':
                            // Reset camera
                            if (this.cameraSystem) {
                                this.cameraSystem.resetOrbitCamera();
                                console.log('[App] Camera reset');
                            }
                            break;

                        case 's':
                            // Toggle auto-snap (with Shift)
                            if (shiftKey && this.trackSystem) {
                                const enabled = this.trackSystem.toggleConnectionIndicators();
                                // Also update UI toggle to stay in sync
                                if (this.uiManager) {
                                    // For auto-snap, we need different logic
                                    const autoSnapEnabled = !this.trackSystem.isAutoSnapEnabled();
                                    this.trackSystem.setAutoSnap(autoSnapEnabled);
                                    this.uiManager.setToggleState('autoSnap', autoSnapEnabled);
                                }
                            }
                            break;

                        case 'i':
                            // Toggle connection indicators (with Shift)
                            if (shiftKey && this.trackSystem) {
                                const enabled = this.trackSystem.toggleConnectionIndicators();
                                // Update UI toggle to stay in sync
                                if (this.uiManager) {
                                    this.uiManager.setToggleState('connectionIndicators', enabled);
                                }
                            }
                            break;
                    }
                } catch (error) {
                    console.error('[App] Error handling keyboard:', error);
                }
            });

            console.log('[App] Keyboard shortcuts configured');
        } catch (error) {
            console.error('[App] Error setting up keyboard:', error);
        }
    }

    // ========================================================================
    // RENDER LOOP
    // ========================================================================

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

            window.addEventListener('resize', () => {
                try {
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
    // ACCESSORS
    // ========================================================================

    getScene(): Scene {
        return this.scene;
    }

    getCameraSystem(): CameraSystem | null {
        return this.cameraSystem;
    }

    getTrackSystem(): TrackSystem | null {
        return this.trackSystem;
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    dispose(): void {
        try {
            console.log('[App] Disposing...');

            // Remove canvas click handler
            this.canvas.removeEventListener('click', this.handleCanvasClick.bind(this));

            if (this.uiManager) this.uiManager.dispose();
            if (this.inputManager) this.inputManager.dispose();
            if (this.trackSystem) this.trackSystem.dispose();
            if (this.baseboardSystem) this.baseboardSystem.dispose();
            if (this.cameraSystem) this.cameraSystem.dispose();

            this.scene.dispose();
            this.engine.dispose();

            console.log('[App] Disposed');
        } catch (error) {
            console.error('[App] Error disposing:', error);
        }
    }
}