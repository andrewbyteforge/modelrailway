/**
 * App.ts - Application with UI sidebar and mouse interaction (SIMPLE PICKING)
 */

import { Scene } from '@babylonjs/core/scene';
import { Engine } from '@babylonjs/core/Engines/engine';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Ray } from '@babylonjs/core/Culling/ray';

import { Project } from './Project';
import { BaseboardSystem } from '../systems/baseboard/BaseboardSystem';
import { CameraSystem } from '../systems/camera/CameraSystem';
import { TrackSystem } from '../systems/track/TrackSystem';
import { UIManager } from '../ui/UIManager';
import { InputManager } from '../ui/InputManager';

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

            this.scene.clearColor = new Color4(0.85, 0.9, 0.95, 1.0);
            this.project = new Project();

            console.log('Model Railway Workbench - Initializing...');
        } catch (error) {
            console.error('[App] Constructor error:', error);
            throw error;
        }
    }

    async initialize(): Promise<void> {
        try {
            await this.project.load();
            this.setupLighting();

            console.log('[App] Initializing baseboard system...');
            this.baseboardSystem = new BaseboardSystem(this.scene, this.project);
            this.baseboardSystem.initialize();

            console.log('[App] Initializing camera system...');
            this.cameraSystem = new CameraSystem(this.scene, this.project, this.canvas);
            this.cameraSystem.initialize();

            console.log('[App] Initializing track system...');
            this.trackSystem = new TrackSystem(this.scene, this.project);
            this.trackSystem.initialize();

            console.log('[App] Initializing UI manager...');
            this.uiManager = new UIManager(document.body);
            this.uiManager.initialize((catalogId) => {
                this.onTrackSelected(catalogId);
            });

            console.log('[App] Initializing input manager...');
            this.inputManager = new InputManager(
                this.scene,
                this.canvas,
                this.trackSystem,
                this.baseboardSystem
            );
            this.inputManager.initialize();

            this.setupKeyboardShortcuts();
            this.setupPointerEvents();

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
        } catch (error) {
            console.error('[App] Initialization error:', error);
            throw error;
        }
    }

    private setupLighting(): void {
        try {
            const light = new HemisphericLight('hemisphericLight', new Vector3(0, 1, 0), this.scene);
            if (!light) {
                throw new Error('[App] Failed to create light');
            }
            light.intensity = 0.8;
            light.diffuse = new Color3(1.0, 0.98, 0.95);
            light.groundColor = new Color3(0.3, 0.3, 0.35);
            console.log('[App] Lighting configured');
        } catch (error) {
            console.error('[App] Error setting up lighting:', error);
            throw error;
        }
    }

    private onTrackSelected(catalogId: string): void {
        try {
            this.placementMode = catalogId;
            console.log(`[App] Placement mode: ${catalogId}`);
            if (this.inputManager) {
                this.inputManager.clearSelection();
            }
        } catch (error) {
            console.error('[App] Error in onTrackSelected:', error);
        }
    }

    private setupPointerEvents(): void {
        try {
            this.scene.onPointerObservable.add((pointerInfo) => {
                try {
                    if (pointerInfo.type !== 1) return; // POINTERDOWN only
                    if (pointerInfo.event.button !== 0) return; // Left click only

                    const pickResult = pointerInfo.pickInfo;
                    if (pickResult?.hit && pickResult.pickedMesh) {
                        const allPieces = this.trackSystem?.getAllPieces() || [];
                        let isTrackPiece = false;

                        for (const piece of allPieces) {
                            if (pickResult.pickedMesh.name.includes(piece.id)) {
                                isTrackPiece = true;
                                break;
                            }
                        }

                        if (isTrackPiece) {
                            return; // Let InputManager handle track selection
                        }
                    }

                    // Placement mode - pick ANY mesh, no filter
                    if (this.placementMode && this.trackSystem && this.baseboardSystem) {
                        const simplePick = this.scene.pick(this.scene.pointerX, this.scene.pointerY);

                        console.log(`[App] Picked mesh: ${simplePick?.pickedMesh?.name || 'NONE'}`);
                        console.log(`[App] Pick hit: ${simplePick?.hit}`);
                        console.log(`[App] Pick point:`, simplePick?.pickedPoint);

                        if (simplePick?.hit && simplePick.pickedPoint) {
                            const boardY = this.baseboardSystem.getBoardTopY();
                            const position = new Vector3(
                                simplePick.pickedPoint.x,
                                boardY,
                                simplePick.pickedPoint.z
                            );

                            console.log(`[App] Placing at:`, position);

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
                            console.log('[App] No mesh hit!');
                        }
                    }
                } catch (error) {
                    console.error('[App] Error in pointer handler:', error);
                }
            });

            console.log('[App] Pointer events configured');
        } catch (error) {
            console.error('[App] Error setting up pointer events:', error);
        }
    }

    private setupKeyboardShortcuts(): void {
        try {
            this.scene.onKeyboardObservable.add((kbInfo) => {
                try {
                    switch (kbInfo.event.key.toLowerCase()) {
                        case 'v':
                            if (this.cameraSystem) {
                                this.cameraSystem.toggleMode();
                            }
                            break;

                        case 'r':
                            if (this.cameraSystem) {
                                this.cameraSystem.resetOrbitCamera();
                                console.log('Camera reset');
                            }
                            break;

                        case 'c':
                            if (this.trackSystem) {
                                this.trackSystem.clear();
                                console.log('Track cleared');
                            }
                            break;

                        case 'escape':
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
                            if (this.inputManager && this.trackSystem) {
                                const selected = this.inputManager.getSelectedPiece();
                                if (selected) {
                                    this.trackSystem.removePiece(selected.id);
                                    this.inputManager.clearSelection();
                                    console.log(`[App] Deleted ${selected.id}`);
                                }
                            }
                            break;
                    }
                } catch (error) {
                    console.error('[App] Error handling keyboard:', error);
                }
            });

            console.log('[App] Keyboard configured');
        } catch (error) {
            console.error('[App] Error setting up keyboard:', error);
        }
    }

    start(): void {
        try {
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

    getScene(): Scene {
        return this.scene;
    }

    getCameraSystem(): CameraSystem | null {
        return this.cameraSystem;
    }

    getTrackSystem(): TrackSystem | null {
        return this.trackSystem;
    }

    dispose(): void {
        try {
            console.log('[App] Disposing...');
            if (this.uiManager) this.uiManager.dispose();
            if (this.inputManager) this.inputManager.dispose();
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