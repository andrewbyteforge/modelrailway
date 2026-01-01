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
import { HighlightLayer } from '@babylonjs/core/Layers/highlightLayer';
import '@babylonjs/core/Layers/effectLayerSceneComponent'; // Required side-effect for HighlightLayer
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
// Note: Ray is imported via side-effect in main.ts

import { Project } from './Project';
import { BaseboardSystem } from '../systems/baseboard/BaseboardSystem';
import { CameraSystem } from '../systems/camera/CameraSystem';
import { TrackSystem } from '../systems/track/TrackSystem';
import { TrackCatalog } from '../systems/track/TrackCatalog';
import { UIManager } from '../ui/UIManager';
import { InputManager } from '../ui/InputManager';
import { ModelImportButton } from '../ui/ModelImportButton';

// ============================================================================
// WORLD OUTLINER IMPORTS
// ============================================================================
import { WorldOutliner } from '../systems/outliner/WorldOutliner';
import { RightSidebar } from '../ui/panels/RightSidebar';

// ============================================================================
// TRAIN SYSTEM IMPORTS
// ============================================================================
import { TrainSystem } from '../systems/train/TrainSystem';
import { TrainControlPanel } from '../ui/TrainControlPanel';
import { TrainIntegration, createGlobalHelpers } from '../systems/train/TrainIntegration';

// ============================================================================
// TRAIN MESH DETECTOR - For cross-system train detection
// Enables: Click = DRIVING, Shift+Click = REPOSITIONING
// ============================================================================
import {
    registerTrainSystem,
    unregisterTrainSystem
} from '../systems/train/TrainMeshDetector';

// ============================================================================
// TRANSFORM CONTROLS IMPORT
// ============================================================================
import { SidebarTransformControls } from '../ui/components/SidebarTransformControls';

// ============================================================================
// PERSISTENCE SYSTEM IMPORTS
// ============================================================================
import {
    PersistenceIntegration,
    createPersistenceIntegration
} from './persistence';
import { FileMenu, createFileMenu } from '../ui/panels/FileMenu';

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
    private modelImportButton: ModelImportButton | null = null;

    // ========================================================================
    // WORLD OUTLINER PROPERTIES
    // ========================================================================
    private worldOutliner: WorldOutliner | null = null;
    private rightSidebar: RightSidebar | null = null;

    /** Highlight layer for selection visualization */
    private highlightLayer: HighlightLayer | null = null;

    /** Currently highlighted meshes */
    private highlightedMeshes: AbstractMesh[] = [];

    private placementMode: string | null = null;

    // ========================================================================
    // TRAIN SYSTEM PROPERTIES
    // ========================================================================
    private trainSystem: TrainSystem | null = null;
    private trainControlPanel: TrainControlPanel | null = null;
    private trainIntegration: TrainIntegration | null = null;

    // ========================================================================
    // TRANSFORM CONTROLS PROPERTY
    // ========================================================================
    private transformControls: SidebarTransformControls | null = null;

    // ========================================================================
    // PERSISTENCE SYSTEM PROPERTIES
    // ========================================================================
    /** Persistence integration for save/load functionality */
    private persistence: PersistenceIntegration | null = null;

    /** File menu UI component */
    private fileMenu: FileMenu | null = null;

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

            // ================================================================
            // INITIALIZE TRAIN SYSTEM
            // ================================================================
            console.log('[App] Initializing train system...');
            this.trainSystem = new TrainSystem(this.scene, this.trackSystem, {
                enableSound: true,
                enableKeyboardControls: true,
                enablePointerControls: true,
                throttleStep: 0.1
            });
            this.trainSystem.initialize();

            this.connectCameraAndTrainSystems();



            // ================================================================
            // REGISTER TRAIN SYSTEM WITH MESH DETECTOR
            // This enables ModelImportButton to detect train clicks and
            // differentiate between:
            //   - Click = Select for DRIVING (keyboard controls)
            //   - Shift+Click = Select for REPOSITIONING (drag to move)
            // ================================================================
            registerTrainSystem(this.trainSystem);
            console.log('[App] ✓ TrainSystem registered with TrainMeshDetector');

            // Create control panel UI
            this.trainControlPanel = new TrainControlPanel(this.trainSystem);
            this.trainControlPanel.initialize();

            // ================================================================
            // INITIALIZE TRAIN INTEGRATION (auto-registers trains when placed)
            // ================================================================
            this.trainIntegration = new TrainIntegration(
                this.scene,
                this.trainSystem,
                this.trackSystem.getGraph()
            );

            // Expose to window for debugging (can be removed in production)
            // Expose to window for debugging (can be removed in production)
            (window as any).trainSystem = this.trainSystem;
            (window as any).trainIntegration = this.trainIntegration;
            (window as any).trackSystem = this.trackSystem;  // ← ADD THIS LINE
            (window as any).scene = this.scene;

            // Install global helper functions for console debugging
            createGlobalHelpers(this.scene, this.trainSystem, this.trackSystem.getGraph());

            console.log('[App] ✓ Train system initialized');

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

            // Wire up sidebar import button to model import dialog
            // Click the existing floating import button programmatically
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
                    console.warn('[App] Could not find import button');
                }
            });

            // ================================================================
            // INITIALIZE WORLD OUTLINER
            // ================================================================
            console.log('[App] Initializing World Outliner...');
            this.initializeWorldOutliner();

            // Initialize input manager
            console.log('[App] Initializing input manager...');
            this.inputManager = new InputManager(
                this.scene,
                this.canvas,
                this.trackSystem,
                this.baseboardSystem
            );
            this.inputManager.initialize();

            // ================================================================
            // SYNC 3D SELECTION TO WORLD OUTLINER
            // When user clicks a track piece in 3D view, highlight it in outliner
            // ================================================================
            this.inputManager.setOnSelectionChange((piece) => {
                if (!this.worldOutliner) return;

                if (piece) {
                    // Find the outliner node for this piece
                    const node = this.worldOutliner.findBySceneObjectId(piece.id);
                    if (node) {
                        // Select in outliner (this will also trigger highlighting)
                        this.worldOutliner.select(node.id, false);
                        console.log(`[App] Synced selection to outliner: ${node.name}`);
                    }
                } else {
                    // Deselected - clear outliner selection
                    this.worldOutliner.clearSelection();
                }
            });

            // Initialize model import button and system
            // Initialize model import button and system
            console.log('[App] Initializing model import system...');
            this.modelImportButton = new ModelImportButton(
                this.scene,
                this.baseboardSystem
            );
            await this.modelImportButton.initialize();

            // Add scale controls to sidebar settings
            const scaleElement = this.modelImportButton.getScaleControlsElement();
            if (scaleElement && this.uiManager) {
                this.uiManager.addScaleControls(scaleElement);
                console.log('[App] ✓ Scale controls added to sidebar');
            }

            // ================================================================
            // INITIALIZE TRANSFORM CONTROLS (Position sliders)
            // ================================================================
            // Baseboard is at Y=0.95, rail top at Y=0.958
            // Allow positioning from baseboard surface to well above
            this.transformControls = new SidebarTransformControls({
                positionRangeXZ: 0.6,  // ±600mm range for X/Z
                positionMinY: 0.94,    // Slightly below baseboard surface
                positionMaxY: 1.1,     // Well above baseboard  
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
                console.log('[App] ✓ Transform controls added to sidebar');
            }

            // Listen for model selection changes to update transform controls
            if (this.modelImportButton) {
                const modelSystem = this.modelImportButton.getModelSystem();
                if (modelSystem) {
                    // Create selection change observer
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

            // Connect WorldOutliner to ModelImportButton for bidirectional sync
            // This enables:
            // - Models appearing in outliner when placed
            // - Deleting from outliner removes the 3D model
            // - Deleting the 3D model removes from outliner
            if (this.worldOutliner && this.modelImportButton) {
                this.modelImportButton.setWorldOutliner(this.worldOutliner);
                console.log('[App] ✓ Connected WorldOutliner to ModelImportButton');
            }

            // ================================================================
            // INITIALIZE PERSISTENCE SYSTEM (Save/Load)
            // ================================================================
            console.log('[App] Initializing persistence system...');
            this.persistence = createPersistenceIntegration(this.scene);
            this.persistence.configure({
                project: this.project,
                trackSystem: this.trackSystem,
                // trackCatalog is internal to trackSystem, not needed separately
                worldOutliner: this.worldOutliner ?? undefined,
                // modelLibrary: this.modelLibrary,  // Add when available
                // placedItemManager: PlacedItemManager.getInstance()  // Add when available
            });

            // Enable keyboard shortcuts (Ctrl+S, Ctrl+O, Ctrl+N)
            this.persistence.setupKeyboardShortcuts();

            // Enable "unsaved changes" warning when closing browser/app
            this.persistence.setupBeforeUnloadWarning();

            // Create and mount the File menu button
            this.fileMenu = createFileMenu(this.persistence.getLayoutManager());
            this.fileMenu.mount(document.body);

            // Optional: Log status messages
            this.fileMenu.setStatusCallback((message) => {
                console.log('[File]', message);
            });

            console.log('[App] ✓ Persistence system initialized');
            console.log('[App]   File menu added (top-left corner)');
            console.log('[App]   Keyboard shortcuts: Ctrl+S (Save), Ctrl+O (Open), Ctrl+N (New)');

            // Setup keyboard shortcuts
            this.setupKeyboardShortcuts();

            // Setup pointer events for track placement
            this.setupPointerEvents();

            // Place test tracks to verify rendering
            // this.placeTestTracks();

            console.log('[App] ✓ Initialization complete');
            console.log('');
            console.log('=== Controls ===');
            console.log('  Click palette → Select track type');
            console.log('  Click board → Place track (auto-snaps!)');
            console.log('  Click track → Select track');
            console.log('  [ / ] → Rotate selected ±5°');
            console.log('  Shift+[ / ] → Rotate ±22.5°');
            console.log('  Delete → Remove selected');
            console.log('  ESC → Deselect / Cancel placement');
            console.log('  V → Toggle camera mode');
            console.log('  Home → Reset camera');
            console.log('  Shift+S → Toggle auto-snap');
            console.log('  Shift+I → Toggle connection indicators');
            console.log('  Shift+C → Clear all track');
            console.log('  T → Place test tracks');
            console.log('');
            console.log('=== Train Controls ===');
            console.log('  Shift+T → Register train models');
            console.log('  Click train → Select for DRIVING');
            console.log('  Shift+Click train → Select for REPOSITIONING');
            console.log('  ↑/W → Increase throttle');
            console.log('  ↓/S → Decrease throttle');
            console.log('  R → Toggle direction (when train selected)');
            console.log('  Space → Brake (hold)');
            console.log('  H → Horn');
            console.log('  Click points → Toggle switch');
            console.log('');
            console.log('=== Model Import ===');
            console.log('  📦 Import Model button → Import GLB/GLTF files');
            console.log('  Rolling stock auto-placed on track');
            console.log('  Imported models appear in World Outliner');
            console.log('  Delete from outliner removes 3D model');
            console.log('  [ / ] → Rotate models too');
            console.log('');
            console.log('=== Save/Load (File Menu) ===');
            console.log('  Ctrl+S → Save layout');
            console.log('  Ctrl+Shift+S → Save As...');
            console.log('  Ctrl+O → Open layout');
            console.log('  Ctrl+N → New layout');
            console.log('  📄 File button (top-left) → File menu');
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





    private connectCameraAndTrainSystems(): void {
        if (!this.cameraSystem || !this.trainSystem) {
            console.warn('[App] Cannot connect camera/train - one or both systems not initialized');
            return;
        }

        // Tell camera system to check if a train is selected before processing WASD
        this.cameraSystem.setShouldBlockMovement(() => {
            // Block camera WASD when a train is selected
            const hasSelectedTrain = this.trainSystem?.hasSelectedTrain() ?? false;

            if (hasSelectedTrain) {
                // Train is selected - WASD controls throttle, not camera
                return true;
            }

            // No train selected - camera can use WASD
            return false;
        });

        console.log('[App] ✓ Camera/Train input coordination connected');
        console.log('  → WASD controls camera when no train selected');
        console.log('  → WASD controls throttle when train selected');
    }

    // ========================================================================
    // WORLD OUTLINER INITIALIZATION
    // ========================================================================

    /**
     * Initialize the World Outliner system and right sidebar
     */
    private initializeWorldOutliner(): void {
        try {
            // Create highlight layer for selection visualization
            this.highlightLayer = new HighlightLayer('selectionHighlight', this.scene);
            this.highlightLayer.outerGlow = true;
            this.highlightLayer.innerGlow = false;
            this.highlightLayer.blurHorizontalSize = 1.0;
            this.highlightLayer.blurVerticalSize = 1.0;

            // Create the WorldOutliner system
            this.worldOutliner = new WorldOutliner(this.scene);
            this.worldOutliner.initialize();

            // ================================================================
            // SETUP OUTLINER EVENT LISTENERS
            // ================================================================
            this.setupOutlinerEventListeners();

            // Create the right sidebar with outliner panel
            this.rightSidebar = new RightSidebar(this.worldOutliner);
            this.rightSidebar.initialize();

            // Add to DOM
            const sidebarElement = this.rightSidebar.getElement();
            if (sidebarElement) {
                document.body.appendChild(sidebarElement);
            }

            // Setup selection callback to sync with 3D view
            this.rightSidebar.setSelectionCallback((nodeIds) => {
                this.onOutlinerSelectionChanged(nodeIds);
            });

            // Register the baseboard with the outliner
            if (this.baseboardSystem) {
                const boardMesh = this.scene.getMeshByName('baseboard');
                if (boardMesh) {
                    this.worldOutliner.createItem({
                        name: 'Main Baseboard',
                        type: 'baseboard',
                        sceneObjectId: boardMesh.uniqueId.toString(),
                    });
                }
            }

            console.log('[App] ✓ World Outliner initialized');
        } catch (error) {
            console.error('[App] Failed to initialize World Outliner:', error);
        }
    }

    /**
     * Setup event listeners for the World Outliner
     * Handles deletions, visibility changes, etc.
     */
    private setupOutlinerEventListeners(): void {
        if (!this.worldOutliner) return;

        // ================================================================
        // TRACK DELETION FIX:
        // The WorldOutliner's deleteNode doesn't know how to delete track
        // because track pieces have multiple meshes. We need to intercept
        // the delete button click and handle track specially.
        // ================================================================

        // Store reference to original method
        const outliner = this.worldOutliner;
        const originalDeleteNode = outliner.deleteNode.bind(outliner);

        // Create our custom delete handler
        outliner.deleteNode = (nodeId: string, force: boolean = false): boolean => {
            const node = outliner.getNode(nodeId);

            if (!node) {
                console.warn(`[App] Cannot delete - node not found: ${nodeId}`);
                return false;
            }

            console.log(`[App] Deleting node: ${node.name} (type: ${node.type})`);

            // ============================================================
            // TRACK PIECES - Must go through TrackSystem
            // ============================================================
            if (node.type === 'track') {
                const pieceId = (node.metadata?.pieceId as string) || node.sceneObjectId;

                if (pieceId && this.trackSystem) {
                    console.log(`[App] Deleting track piece: ${pieceId}`);

                    // Remove via TrackSystem (handles meshes, graph, indicators)
                    const removed = this.trackSystem.removePiece(pieceId);

                    if (removed) {
                        // Now remove from outliner's internal data structures
                        // Access internal properties directly
                        try {
                            const nodesMap = (outliner as any).nodes as Map<string, any>;
                            const rootIds = (outliner as any).rootIds as string[];
                            const selectedIds = (outliner as any).selectedIds as Set<string>;

                            if (nodesMap?.has(nodeId)) {
                                const deletedNode = nodesMap.get(nodeId);

                                // Remove from parent
                                if (deletedNode.parentId && nodesMap.has(deletedNode.parentId)) {
                                    const parent = nodesMap.get(deletedNode.parentId);
                                    if (parent.childIds) {
                                        const idx = parent.childIds.indexOf(nodeId);
                                        if (idx !== -1) parent.childIds.splice(idx, 1);
                                    }
                                    if (typeof parent.removeChildId === 'function') {
                                        parent.removeChildId(nodeId);
                                    }
                                } else if (rootIds) {
                                    const idx = rootIds.indexOf(nodeId);
                                    if (idx !== -1) rootIds.splice(idx, 1);
                                }

                                // Remove from selection
                                selectedIds?.delete(nodeId);

                                // Delete the node itself
                                nodesMap.delete(nodeId);

                                // Emit event
                                outliner.events?.emitNodeDeleted?.(
                                    nodeId,
                                    node.type,
                                    node.parentId ?? null,
                                    []
                                );
                            }
                        } catch (e) {
                            console.error('[App] Error cleaning up outliner node:', e);
                        }

                        console.log(`[App] ✓ Track piece deleted: ${pieceId}`);
                        return true;
                    } else {
                        console.warn(`[App] TrackSystem failed to remove: ${pieceId}`);
                        return false;
                    }
                }

                console.warn(`[App] Track piece has no pieceId: ${nodeId}`);
                return false;
            }

            // ============================================================
            // OTHER TYPES - Use original method
            // ============================================================
            return originalDeleteNode(nodeId, force);
        };

        // Listen for visibility changes
        this.worldOutliner.events.on('node:visibility_changed', (event: {
            nodeId: string;
            visible: boolean;
        }) => {
            const node = this.worldOutliner?.getNode(event.nodeId);
            if (!node) return;

            console.log(`[App] Visibility changed: ${node.name} = ${event.visible}`);

            // For track pieces, toggle visibility of all associated meshes
            if (node.type === 'track' && node.metadata?.pieceId) {
                const pieceId = node.metadata.pieceId as string;
                this.setTrackPieceVisibility(pieceId, event.visible);
            }
        });

        console.log('[App] ✓ Outliner event listeners configured (with track deletion fix)');
    }

    /**
     * Set visibility of a track piece's meshes
     * @param pieceId - Track piece ID
     * @param visible - Whether to show or hide
     */
    private setTrackPieceVisibility(pieceId: string, visible: boolean): void {
        for (const mesh of this.scene.meshes) {
            if (mesh.name.includes(pieceId) ||
                mesh.metadata?.pieceId === pieceId ||
                mesh.parent?.name === pieceId) {
                mesh.setEnabled(visible);
            }
        }
    }

    /**
     * Delete a track piece properly through the TrackSystem
     * This ensures the graph is updated correctly
     * @param pieceId - Track piece ID to delete
     */
    private deleteTrackPiece(pieceId: string): void {
        if (!this.trackSystem) return;

        console.log(`[App] Deleting track piece: ${pieceId}`);
        this.trackSystem.removePiece(pieceId);

        // Also remove from outliner if not already done
        if (this.worldOutliner) {
            const node = this.worldOutliner.findBySceneObjectId(pieceId);
            if (node) {
                this.worldOutliner.deleteNode(node.id, true);
            }
        }
    }

    /**
     * Handle selection changes from the outliner
     * Highlights selected meshes in the 3D view with a red outline
     * @param nodeIds - Selected node IDs
     */
    private onOutlinerSelectionChanged(nodeIds: string[]): void {
        if (!this.worldOutliner || !this.highlightLayer) return;

        // Clear existing highlights
        this.clearHighlights();

        // Log selection for debugging
        console.log('[App] Outliner selection:', nodeIds);

        // Highlight meshes for each selected node
        for (const nodeId of nodeIds) {
            const node = this.worldOutliner.getNode(nodeId);
            if (!node) continue;

            // Skip folders - they don't have meshes
            if (node.type === 'folder') continue;

            // Handle track pieces specially - they have multiple meshes
            if (node.type === 'track') {
                const pieceId = (node.metadata?.pieceId as string) || node.sceneObjectId;
                if (pieceId) {
                    this.highlightTrackPiece(pieceId);
                }
                continue;
            }

            // For other types (baseboard, scenery, rolling stock), find by uniqueId
            if (node.sceneObjectId) {
                // Try to find mesh by uniqueId (stored as string)
                const uniqueId = parseInt(node.sceneObjectId, 10);
                let mesh: AbstractMesh | null = null;

                // Search through all meshes to find by uniqueId
                if (!isNaN(uniqueId)) {
                    for (const m of this.scene.meshes) {
                        if (m.uniqueId === uniqueId) {
                            mesh = m;
                            break;
                        }
                    }
                }

                // If not found by uniqueId, try by name
                if (!mesh) {
                    mesh = this.scene.getMeshByName(node.sceneObjectId);
                }

                // If still not found, try searching for partial name match
                if (!mesh) {
                    for (const m of this.scene.meshes) {
                        if (m.name.includes(node.sceneObjectId)) {
                            mesh = m;
                            break;
                        }
                    }
                }

                if (mesh) {
                    this.highlightMesh(mesh);

                    // Also highlight child meshes (for imported models)
                    const children = mesh.getChildMeshes();
                    for (const child of children) {
                        this.highlightMesh(child);
                    }
                } else {
                    console.warn(`[App] Could not find mesh for node: ${node.name} (${node.sceneObjectId})`);
                }
            }
        }
    }

    /**
     * Highlight a single mesh with red outline
     * @param mesh - Mesh to highlight
     */
    private highlightMesh(mesh: AbstractMesh): void {
        if (!this.highlightLayer) return;

        try {
            // Add to highlight layer with red color
            this.highlightLayer.addMesh(mesh, Color3.Red());
            this.highlightedMeshes.push(mesh);
            console.log(`[App] Highlighted mesh: ${mesh.name}`);
        } catch (error) {
            console.warn(`[App] Could not highlight mesh ${mesh.name}:`, error);
        }
    }

    /**
     * Highlight all meshes belonging to a track piece
     * Track pieces consist of multiple meshes (rails, sleepers, ballast)
     * @param pieceId - Track piece ID
     */
    private highlightTrackPiece(pieceId: string): void {
        if (!this.highlightLayer) return;

        let meshesFound = 0;

        // Find all meshes that belong to this track piece
        // Track meshes are typically named with patterns like:
        // - pieceId_rail, pieceId_sleeper, pieceId_ballast
        // - or contain the pieceId in their name
        for (const mesh of this.scene.meshes) {
            // Skip non-pickable utility meshes
            if (!mesh.isPickable && !mesh.name.includes('rail') && !mesh.name.includes('sleeper') && !mesh.name.includes('ballast')) {
                continue;
            }

            // Check if mesh name starts with or contains piece ID
            if (mesh.name.startsWith(pieceId) || mesh.name.includes(pieceId)) {
                this.highlightMesh(mesh);
                meshesFound++;
                continue;
            }

            // Check mesh metadata
            if (mesh.metadata?.pieceId === pieceId || mesh.metadata?.trackPieceId === pieceId) {
                this.highlightMesh(mesh);
                meshesFound++;
                continue;
            }

            // Check parent - track pieces may be grouped under a transform node
            if (mesh.parent) {
                const parentName = mesh.parent.name;
                if (parentName === pieceId || parentName.includes(pieceId)) {
                    this.highlightMesh(mesh);
                    meshesFound++;
                }
            }
        }

        if (meshesFound > 0) {
            console.log(`[App] Highlighted ${meshesFound} meshes for track piece: ${pieceId}`);
        } else {
            console.warn(`[App] No meshes found for track piece: ${pieceId}`);
        }
    }

    /**
     * Clear all highlighted meshes
     */
    private clearHighlights(): void {
        if (!this.highlightLayer) return;

        // Remove all meshes from highlight layer
        for (const mesh of this.highlightedMeshes) {
            try {
                this.highlightLayer.removeMesh(mesh);
            } catch (error) {
                // Mesh may have been disposed
            }
        }

        this.highlightedMeshes = [];
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

            // Register with World Outliner
            this.registerTrackWithOutliner(straight1);
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

            // Register with World Outliner
            this.registerTrackWithOutliner(straight2);
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

            // Register with World Outliner
            this.registerTrackWithOutliner(straight3);
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

            // Register with World Outliner
            this.registerTrackWithOutliner(curve);
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

    /**
     * Register a track piece with the World Outliner
     * @param piece - The track piece to register
     */
    private registerTrackWithOutliner(piece: any): void {
        if (!this.worldOutliner || !piece) return;

        try {
            // Track pieces have multiple meshes - find the parent/group
            // Look for meshes that contain the piece ID in their name
            let primaryMesh: AbstractMesh | null = null;
            const pieceMeshes: AbstractMesh[] = [];

            for (const mesh of this.scene.meshes) {
                if (mesh.name.includes(piece.id)) {
                    pieceMeshes.push(mesh);
                    if (!primaryMesh) {
                        primaryMesh = mesh;
                    }
                }
            }

            // Use the piece ID as the scene object identifier
            // We'll search by piece ID when highlighting
            const sceneObjectId = piece.id;

            this.worldOutliner.createItem({
                name: piece.catalogEntry?.name || piece.id,
                type: 'track',
                sceneObjectId: sceneObjectId,
                metadata: {
                    catalogId: piece.catalogId,
                    pieceId: piece.id,
                    meshCount: pieceMeshes.length,
                },
            });

            console.log(`[App] Registered track with outliner: ${piece.id} (${pieceMeshes.length} meshes)`);
        } catch (error) {
            console.warn('[App] Could not register track with outliner:', error);
        }
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
     * 
     * IMPORTANT: InputManager.setPlacementMode(false) MUST be called
     * to re-enable track selection. Any errors from other systems
     * should not prevent this.
     */
    private cancelPlacementMode(): void {
        try {
            this.placementMode = null;

            // ================================================================
            // CRITICAL: Reset InputManager placement mode FIRST
            // This re-enables track piece selection/hovering
            // Must be done before any potentially-failing calls
            // ================================================================
            if (this.inputManager) {
                this.inputManager.clearSelection();
                this.inputManager.setPlacementMode(false);
                console.log('[App] InputManager placement mode disabled');
            }

            // ================================================================
            // Clear UI selection state
            // UIManager uses deselectTrack(), not clearSelection()
            // ================================================================
            if (this.uiManager) {
                try {
                    // Try deselectTrack which is the actual method name
                    if (typeof (this.uiManager as any).deselectTrack === 'function') {
                        (this.uiManager as any).deselectTrack();
                    }
                } catch (uiError) {
                    console.warn('[App] Could not clear UI selection:', uiError);
                }
            }

            // ================================================================
            // Hide snap preview indicator
            // ================================================================
            if (this.trackSystem) {
                this.trackSystem.hideSnapPreview();
            }

            console.log('[App] Placement mode cancelled');
        } catch (error) {
            console.error('[App] Error in cancelPlacementMode:', error);

            // ================================================================
            // FAILSAFE: Even if something fails, ensure InputManager is reset
            // ================================================================
            if (this.inputManager) {
                try {
                    this.inputManager.setPlacementMode(false);
                } catch (e) {
                    console.error('[App] Critical: Could not reset InputManager:', e);
                }
            }
        }
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

                    // Register with World Outliner
                    this.registerTrackWithOutliner(piece);

                    // Mark layout as having unsaved changes
                    this.persistence?.markDirty();
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

                        // Register with World Outliner
                        this.registerTrackWithOutliner(piece);

                        // Mark layout as having unsaved changes
                        this.persistence?.markDirty();
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
            // ================================================================
            // BABYLON.JS KEYBOARD OBSERVABLE
            // Handles most keys but may miss Delete/Backspace in some browsers
            // ================================================================
            this.scene.onKeyboardObservable.add((kbInfo) => {
                // Only handle key down events
                if (kbInfo.type !== 1) return;

                try {
                    const key = kbInfo.event.key;  // Don't lowercase - [ and ] are symbols
                    const shiftKey = kbInfo.event.shiftKey;

                    switch (key) {
                        case 'v':
                        case 'V':
                            // Toggle camera mode
                            if (this.cameraSystem) {
                                this.cameraSystem.toggleMode();
                            }
                            break;

                        case 'r':
                        case 'R':
                            // Reset camera (no longer used for rotation)
                            // Note: R is also used for train direction when a train is selected
                            // The train system handles this via its own keyboard listener
                            if (this.cameraSystem && !this.trainSystem?.getSelectedTrain()) {
                                this.cameraSystem.resetOrbitCamera();
                                console.log('[App] Camera reset');
                            }
                            break;

                        case '[':
                            // Rotate counter-clockwise (Shift for larger jump)
                            if (this.inputManager?.getSelectedPiece()) {
                                const angle = shiftKey ? -22.5 : -5;
                                this.rotateSelectedPiece(angle);
                            }
                            break;

                        case ']':
                            // Rotate clockwise (Shift for larger jump)
                            if (this.inputManager?.getSelectedPiece()) {
                                const angle = shiftKey ? 22.5 : 5;
                                this.rotateSelectedPiece(angle);
                            }
                            break;

                        case 'c':
                        case 'C':
                            // Clear all track (with Shift to prevent accidents)
                            if (shiftKey && this.trackSystem) {
                                this.trackSystem.clear();
                                console.log('[App] Track cleared');
                            }
                            break;

                        case 'Escape':
                            // First priority: deselect any selected train
                            if (this.trainSystem?.getSelectedTrain()) {
                                // FIXED: was deselectAll() which doesn't exist
                                this.trainSystem.deselectTrain();
                                console.log('[App] Train deselected');
                            }
                            // Second priority: deselect any selected track
                            else if (this.inputManager?.getSelectedPiece()) {
                                this.inputManager.clearSelection();
                                console.log('[App] Track deselected');
                            }
                            // Third priority: cancel placement mode
                            else if (this.placementMode) {
                                this.cancelPlacementMode();
                            }
                            break;

                        case 'Delete':
                        case 'Backspace':
                            // Delete selected piece (track or model)
                            if (this.inputManager && this.trackSystem) {
                                const selected = this.inputManager.getSelectedPiece();
                                if (selected) {
                                    console.log(`[App] Delete key pressed - removing: ${selected.id}`);

                                    // Remove from track system (handles meshes, graph, indicators)
                                    const removed = this.trackSystem.removePiece(selected.id);

                                    if (removed) {
                                        // Remove from world outliner if present
                                        if (this.worldOutliner) {
                                            // Find the node by sceneObjectId (which is the pieceId)
                                            const node = this.worldOutliner.findBySceneObjectId(selected.id);
                                            if (node) {
                                                // Access internal nodes map directly to remove
                                                const nodesMap = (this.worldOutliner as any).nodes as Map<string, any>;
                                                const rootIds = (this.worldOutliner as any).rootIds as string[];

                                                if (nodesMap?.has(node.id)) {
                                                    const deletedNode = nodesMap.get(node.id);
                                                    if (deletedNode.parentId && nodesMap.has(deletedNode.parentId)) {
                                                        const parent = nodesMap.get(deletedNode.parentId);
                                                        if (parent.childIds) {
                                                            const idx = parent.childIds.indexOf(node.id);
                                                            if (idx !== -1) parent.childIds.splice(idx, 1);
                                                        }
                                                    } else if (rootIds) {
                                                        const idx = rootIds.indexOf(node.id);
                                                        if (idx !== -1) rootIds.splice(idx, 1);
                                                    }
                                                    nodesMap.delete(node.id);
                                                }
                                                console.log(`[App] Removed from outliner: ${node.name}`);
                                            }
                                        }

                                        // Clear selection
                                        this.inputManager.clearSelection();
                                        console.log(`[App] ✓ Deleted ${selected.id}`);
                                    } else {
                                        console.warn(`[App] Failed to delete ${selected.id}`);
                                    }
                                } else {
                                    console.log('[App] Delete pressed but no track selected');
                                }
                            }
                            break;

                        case 't':
                        case 'T':
                            // Shift+T = Register train models
                            // T alone = Place test tracks
                            if (shiftKey && this.trainSystem) {
                                console.log('[App] Scanning for train models...');

                                // First, try the train system's built-in scan
                                const count = this.trainSystem.scanAndRegisterTrains();

                                if (count === 0) {
                                    console.log('[App] No trains found via keyword scan.');

                                    // Show potential candidates
                                    if (this.trainIntegration) {
                                        this.trainIntegration.debugListPotentialTrains();
                                    }

                                    console.log('[App] Tips:');
                                    console.log('  1. Model names should contain: train, loco, class, coach, wagon, etc.');
                                    console.log('  2. Models must be near track (within 150mm)');
                                    console.log('  3. Use console: registerTrain("meshName", "Display Name")');
                                    console.log('  4. Or: trainIntegration.autoRegister(meshNode, { forceRegister: true })');
                                } else {
                                    console.log(`[App] ✓ Registered ${count} train(s). Click to select, use controls to move.`);
                                }
                            } else if (!shiftKey) {
                                // this.placeTestTracks();
                            }
                            break;

                        case 'Home':
                            // Reset camera
                            if (this.cameraSystem) {
                                this.cameraSystem.resetOrbitCamera();
                                console.log('[App] Camera reset');
                            }
                            break;

                        case 's':
                        case 'S':
                            // Toggle auto-snap (with Shift)
                            // Note: S without shift is handled by train system for throttle
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
                        case 'I':
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

            // ================================================================
            // FALLBACK: Window event listener for Delete/Backspace
            // Some browsers don't pass these to Babylon's keyboard observable
            // ================================================================
            window.addEventListener('keydown', (event: KeyboardEvent) => {
                // Only handle Delete and Backspace
                if (event.key !== 'Delete' && event.key !== 'Backspace') return;

                // Skip if typing in an input field
                if (event.target instanceof HTMLInputElement ||
                    event.target instanceof HTMLTextAreaElement ||
                    event.target instanceof HTMLSelectElement) {
                    return;
                }

                console.log(`[App] Delete key detected via window listener: "${event.key}"`);

                // Delete selected track piece
                if (this.inputManager && this.trackSystem) {
                    const selected = this.inputManager.getSelectedPiece();
                    if (selected) {
                        event.preventDefault();
                        console.log(`[App] Delete key pressed - removing: ${selected.id}`);

                        // Remove from track system (handles meshes, graph, indicators)
                        const removed = this.trackSystem.removePiece(selected.id);

                        if (removed) {
                            // Remove from world outliner if present
                            if (this.worldOutliner) {
                                const node = this.worldOutliner.findBySceneObjectId(selected.id);
                                if (node) {
                                    // Access internal nodes map directly to remove
                                    const nodesMap = (this.worldOutliner as any).nodes as Map<string, any>;
                                    const rootIds = (this.worldOutliner as any).rootIds as string[];

                                    if (nodesMap?.has(node.id)) {
                                        const deletedNode = nodesMap.get(node.id);
                                        if (deletedNode.parentId && nodesMap.has(deletedNode.parentId)) {
                                            const parent = nodesMap.get(deletedNode.parentId);
                                            if (parent.childIds) {
                                                const idx = parent.childIds.indexOf(node.id);
                                                if (idx !== -1) parent.childIds.splice(idx, 1);
                                            }
                                        } else if (rootIds) {
                                            const idx = rootIds.indexOf(node.id);
                                            if (idx !== -1) rootIds.splice(idx, 1);
                                        }
                                        nodesMap.delete(node.id);
                                    }
                                    console.log(`[App] Removed from outliner: ${node.name}`);
                                }
                            }

                            // Clear selection
                            this.inputManager.clearSelection();
                            console.log(`[App] ✓ Deleted ${selected.id}`);

                            // Mark layout as having unsaved changes
                            this.persistence?.markDirty();
                        } else {
                            console.warn(`[App] Failed to delete ${selected.id}`);
                        }
                    } else {
                        console.log('[App] Delete pressed but no track selected');
                    }
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

    getWorldOutliner(): WorldOutliner | null {
        return this.worldOutliner;
    }

    getTrainSystem(): TrainSystem | null {
        return this.trainSystem;
    }

    getTrainIntegration(): TrainIntegration | null {
        return this.trainIntegration;
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    dispose(): void {
        try {
            console.log('[App] Disposing...');

            // Remove canvas click handler
            this.canvas.removeEventListener('click', this.handleCanvasClick.bind(this));

            // Clear highlights and dispose layer
            this.clearHighlights();
            if (this.highlightLayer) {
                this.highlightLayer.dispose();
                this.highlightLayer = null;
            }

            // ================================================================
            // UNREGISTER TRAIN SYSTEM FROM MESH DETECTOR
            // Must be done before disposing train system
            // ================================================================
            unregisterTrainSystem();

            // Clear window flags for train selection
            (window as any).__trainSelected = false;
            (window as any).__selectedTrainId = null;

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

            // Dispose World Outliner
            if (this.rightSidebar) this.rightSidebar.dispose();
            if (this.worldOutliner) this.worldOutliner.dispose();

            // ================================================================
            // DISPOSE PERSISTENCE SYSTEM
            // ================================================================
            if (this.fileMenu) {
                this.fileMenu.dispose();
                this.fileMenu = null;
            }
            if (this.persistence) {
                this.persistence.dispose();
                this.persistence = null;
            }

            if (this.uiManager) this.uiManager.dispose();
            if (this.inputManager) this.inputManager.dispose();
            if (this.modelImportButton) this.modelImportButton.dispose();
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