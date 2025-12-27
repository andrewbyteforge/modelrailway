/**
 * ModelImportButtonWithScaling.ts - Extended ModelImportButton with scaling support
 * 
 * Path: frontend/src/ui/ModelImportButtonWithScaling.ts
 * 
 * This extends your existing ModelImportButton to add UE5-style scaling.
 * 
 * OPTION 1: Replace your ModelImportButton import in App.ts with this file
 * OPTION 2: Copy the scaling-related code into your existing ModelImportButton.ts
 * 
 * @module ModelImportButtonWithScaling
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';

import { ModelSystem, type PlacedModel } from '../systems/models/ModelSystem';
import { ModelLibrary, type ModelLibraryEntry, type ModelCategory } from '../systems/models/ModelLibrary';
import { TrackModelPlacer } from '../systems/models/TrackModelPlacer';
import { ModelImportDialog } from './ModelImportDialog';
import type { BaseboardSystem } from '../systems/baseboard/BaseboardSystem';

// ============================================================================
// SCALING SYSTEM IMPORTS
// ============================================================================

import { ScaleManager } from '../systems/scaling/ScaleManager';
import { TransformPanel } from './panels/TransformPanel';
import { ScalableModelAdapter } from '../systems/scaling/ScalableModelAdapter';
import type { IScalable, ScalableAssetCategory } from '../types/scaling.types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Categories that require track placement */
const TRACK_PLACEMENT_CATEGORIES = ['rolling_stock'];

/** Map ModelCategory to ScalableAssetCategory */
const CATEGORY_MAP: Record<string, ScalableAssetCategory> = {
    'locomotive': 'rolling-stock',
    'coach': 'rolling-stock',
    'wagon': 'rolling-stock',
    'building': 'building',
    'scenery': 'scenery',
    'infrastructure': 'infrastructure',
    'figure': 'scenery',
    'vehicle': 'scenery',
    'rolling_stock': 'rolling-stock',
    'buildings': 'building',
    'other': 'custom'
};

// ============================================================================
// MODEL IMPORT BUTTON WITH SCALING
// ============================================================================

/**
 * ModelImportButtonWithScaling - Extended version with UE5-style scaling
 * 
 * Adds:
 * - ScaleManager integration
 * - TransformPanel UI
 * - Automatic registration of placed models for scaling
 * - Scale gizmo when models are selected
 * - Hotkey + scroll scaling (S + scroll)
 */
export class ModelImportButtonWithScaling {
    // ========================================================================
    // EXISTING PROPERTIES (from ModelImportButton)
    // ========================================================================

    /** Babylon.js scene reference */
    private scene: Scene;

    /** Baseboard system reference */
    private baseboardSystem: BaseboardSystem | null = null;

    /** Model system instance */
    private modelSystem: ModelSystem | null = null;

    /** Track model placer for rolling stock */
    private trackPlacer: TrackModelPlacer | null = null;

    /** Button element */
    private button: HTMLButtonElement | null = null;

    /** Status display element */
    private statusDisplay: HTMLDivElement | null = null;

    /** Library reference */
    private library: ModelLibrary;

    // ========================================================================
    // NEW SCALING PROPERTIES
    // ========================================================================

    /** Scale manager - central coordinator for scaling */
    private scaleManager: ScaleManager | null = null;

    /** Transform panel UI */
    private transformPanel: TransformPanel | null = null;

    /** Map of model IDs to their scalable adapters */
    private scalableAdapters: Map<string, ScalableModelAdapter> = new Map();

    // ========================================================================
    // SELECTION/DRAG PROPERTIES
    // ========================================================================

    /** Pointer down position for click detection */
    private pointerDownPos: { x: number; y: number } | null = null;

    /** Drag threshold in pixels */
    private readonly MODEL_DRAG_THRESHOLD = 5;

    /** Whether currently dragging a model */
    private isDraggingModel = false;

    /** Model being dragged */
    private draggedModelId: string | null = null;

    /** Offset from model center to pick point */
    private dragOffset: { x: number; z: number } | null = null;

    /** Bound pointer handlers */
    private boundPointerDown: ((event: PointerEvent) => void) | null = null;
    private boundPointerUp: ((event: PointerEvent) => void) | null = null;
    private boundPointerMove: ((event: PointerEvent) => void) | null = null;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new ModelImportButtonWithScaling
     * @param scene - Babylon.js scene
     * @param baseboardSystem - Optional baseboard system for Y position
     */
    constructor(scene: Scene, baseboardSystem?: BaseboardSystem) {
        if (!scene) {
            throw new Error('[ModelImportButtonWithScaling] Scene is required');
        }
        this.scene = scene;
        this.baseboardSystem = baseboardSystem || null;
        this.library = ModelLibrary.getInstance();

        console.log('[ModelImportButtonWithScaling] Created');
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the button, model system, AND scaling system
     */
    async initialize(): Promise<void> {
        console.log('[ModelImportButtonWithScaling] Initializing...');

        try {
            // ----------------------------------------------------------------
            // Initialize Model System
            // ----------------------------------------------------------------
            this.modelSystem = new ModelSystem(this.scene, null);
            this.modelSystem.initialize();
            console.log('[ModelImportButtonWithScaling] ✓ ModelSystem initialized');

            // ----------------------------------------------------------------
            // Initialize Track Model Placer
            // ----------------------------------------------------------------
            this.trackPlacer = new TrackModelPlacer(this.scene);
            this.trackPlacer.initialize();
            console.log('[ModelImportButtonWithScaling] ✓ TrackModelPlacer initialized');

            // ----------------------------------------------------------------
            // Initialize Scale Manager (NEW)
            // ----------------------------------------------------------------
            this.scaleManager = new ScaleManager(this.scene, {
                scaleKey: 's',
                resetKey: 'r',
                lockKey: 'l',
                scrollSensitivity: 5,
                fineMultiplier: 0.2
            });
            await this.scaleManager.initialize();
            console.log('[ModelImportButtonWithScaling] ✓ ScaleManager initialized');

            // ----------------------------------------------------------------
            // Initialize Transform Panel UI (NEW)
            // ----------------------------------------------------------------
            this.transformPanel = new TransformPanel(this.scaleManager, {
                position: 'top-right',
                width: 280,
                showPresets: true,
                showDimensions: true,
                showReset: true,
                showLock: true
            });
            this.transformPanel.initialize();
            this.transformPanel.show();
            console.log('[ModelImportButtonWithScaling] ✓ TransformPanel initialized');

            // ----------------------------------------------------------------
            // Setup scale event listeners (NEW)
            // ----------------------------------------------------------------
            this.setupScaleEventListeners();

            // ----------------------------------------------------------------
            // Subscribe to library changes
            // ----------------------------------------------------------------
            this.library.onChange(() => {
                this.updateStatusDisplay();
            });

            // ----------------------------------------------------------------
            // Setup keyboard shortcuts (extended with scaling)
            // ----------------------------------------------------------------
            this.setupKeyboardShortcuts();

            // ----------------------------------------------------------------
            // Setup click-to-select for placed models
            // ----------------------------------------------------------------
            this.setupModelSelection();

            console.log('[ModelImportButtonWithScaling] ✓ Initialized successfully');
            this.logControls();

        } catch (error) {
            console.error('[ModelImportButtonWithScaling] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Log all available controls
     */
    private logControls(): void {
        console.log('');
        console.log('=== Model & Scale Controls ===');
        console.log('  Click model       → Select it');
        console.log('  Drag model        → Move it');
        console.log('  Drag gizmo        → Scale uniformly');
        console.log('  S + Scroll        → Scale selected');
        console.log('  Shift + S + Scroll→ Fine scale');
        console.log('  R                 → Reset scale');
        console.log('  L                 → Lock/unlock scale');
        console.log('  [ / ]             → Rotate ±5°');
        console.log('  Shift + [ / ]     → Rotate ±22.5°');
        console.log('  Delete            → Remove model');
        console.log('  Escape            → Deselect');
        console.log('==============================');
        console.log('');
    }

    // ========================================================================
    // SCALE EVENT LISTENERS (NEW)
    // ========================================================================

    /**
     * Setup listeners for scale system events
     */
    private setupScaleEventListeners(): void {
        if (!this.scaleManager) return;

        this.scaleManager.addEventListener((event) => {
            switch (event.type) {
                case 'scale-commit':
                    // Update the PlacedModel's scale factor when committed
                    if (event.objectId && event.scale !== undefined) {
                        this.updateModelScale(event.objectId, event.scale);
                    }
                    break;

                case 'scale-reset':
                    console.log(`[ModelImportButtonWithScaling] Scale reset: ${event.objectId}`);
                    break;

                case 'lock-changed':
                    console.log(`[ModelImportButtonWithScaling] Lock: ${event.objectId} → ${event.data?.locked}`);
                    break;
            }
        });
    }

    /**
     * Update a PlacedModel's internal scale when scaling is committed
     */
    private updateModelScale(modelId: string, newScale: number): void {
        if (!this.modelSystem) return;

        // The ScaleManager already handles the visual scaling via the transform node
        // This updates any internal tracking if needed
        const adapter = this.scalableAdapters.get(modelId);
        if (adapter) {
            adapter.setScale(newScale);
            console.log(`[ModelImportButtonWithScaling] Updated scale for ${modelId}: ${(newScale * 100).toFixed(1)}%`);
        }
    }

    // ========================================================================
    // MODEL REGISTRATION FOR SCALING (NEW)
    // ========================================================================

    /**
     * Register a placed model with the scaling system
     * Call this after a model is placed
     */
    private registerModelForScaling(placedModel: PlacedModel, category: ModelCategory | string): void {
        if (!this.scaleManager) {
            console.warn('[ModelImportButtonWithScaling] ScaleManager not ready');
            return;
        }

        // Create adapter
        const adapter = new ScalableModelAdapter(
            placedModel,
            category as ModelCategory
        );

        // Store adapter
        this.scalableAdapters.set(placedModel.id, adapter);

        // Register with scale manager
        this.scaleManager.registerScalable(
            adapter,
            adapter.getTransformNode(),
            adapter.getMeshes(),
            adapter.getBoundingRadius()
        );

        console.log(`[ModelImportButtonWithScaling] Registered for scaling: ${placedModel.id}`);
    }

    /**
     * Unregister a model from the scaling system
     */
    private unregisterModelFromScaling(modelId: string): void {
        if (!this.scaleManager) return;

        this.scaleManager.unregisterScalable(modelId);
        this.scalableAdapters.delete(modelId);

        console.log(`[ModelImportButtonWithScaling] Unregistered from scaling: ${modelId}`);
    }

    // ========================================================================
    // MODEL SELECTION (EXTENDED WITH SCALING)
    // ========================================================================

    /**
     * Handle model click - extended to also select in ScaleManager
     */
    private handleModelClick(event: PointerEvent): void {
        if (!this.modelSystem) return;

        try {
            const pickedModelId = this.pickModelAtPosition(event.clientX, event.clientY);

            if (pickedModelId) {
                // Get the placed model
                const placedModels = (this.modelSystem as any).placedModels as Map<string, PlacedModel>;
                const model = placedModels?.get(pickedModelId);

                if (model) {
                    // Select in ModelSystem (visual highlight)
                    this.modelSystem.selectModel(pickedModelId);
                    (window as any).__modelSelected = true;

                    // === NEW: Select in ScaleManager (shows gizmo) ===
                    if (this.scaleManager && this.scalableAdapters.has(pickedModelId)) {
                        this.scaleManager.selectObject(pickedModelId);
                    }

                    const entry = this.library.getModel(model.libraryId);
                    console.log(`[ModelImportButtonWithScaling] Selected: ${entry?.name || pickedModelId}`);
                    return;
                }
            }

            // Clicked on nothing - deselect
            const currentSelected = this.modelSystem.getSelectedModel();
            if (currentSelected) {
                this.modelSystem.deselectModel();
                (window as any).__modelSelected = false;

                // === NEW: Deselect in ScaleManager (hides gizmo) ===
                if (this.scaleManager) {
                    this.scaleManager.deselectObject();
                }

                console.log('[ModelImportButtonWithScaling] Deselected');
            }

        } catch (error) {
            console.error('[ModelImportButtonWithScaling] Error in handleModelClick:', error);
        }
    }

    /**
     * Setup model selection with pointer events
     */
    private setupModelSelection(): void {
        const canvas = this.scene.getEngine().getRenderingCanvas();
        if (!canvas) {
            console.warn('[ModelImportButtonWithScaling] No canvas found');
            return;
        }

        // ----------------------------------------------------------------
        // Pointer Down
        // ----------------------------------------------------------------
        this.boundPointerDown = (event: PointerEvent) => {
            if (event.button !== 0) return;
            if (this.trackPlacer?.isInPlacementMode()) return;

            const trackSelected = (window as any).__trackPieceSelected === true;
            if (trackSelected) return;

            this.pointerDownPos = { x: event.clientX, y: event.clientY };

            // Check if clicking on already selected model for drag
            const pickedModelId = this.pickModelAtPosition(event.clientX, event.clientY);
            if (pickedModelId && this.modelSystem) {
                const selectedModel = this.modelSystem.getSelectedModel();
                if (selectedModel && selectedModel.id === pickedModelId) {
                    const worldPos = this.getWorldPositionFromScreen(event.clientX, event.clientY);
                    if (worldPos) {
                        this.dragOffset = {
                            x: worldPos.x - selectedModel.position.x,
                            z: worldPos.z - selectedModel.position.z
                        };
                    }
                }
            }
        };

        // ----------------------------------------------------------------
        // Pointer Move (drag)
        // ----------------------------------------------------------------
        this.boundPointerMove = (event: PointerEvent) => {
            if (!this.pointerDownPos) return;
            if (!this.modelSystem) return;
            if (this.trackPlacer?.isInPlacementMode()) return;

            const trackSelected = (window as any).__trackPieceSelected === true;
            if (trackSelected) return;

            // Don't start drag if ScaleManager is dragging gizmo
            if (this.scaleManager?.isDragging()) return;

            const selectedModel = this.modelSystem.getSelectedModel();
            if (!selectedModel) return;

            const dx = event.clientX - this.pointerDownPos.x;
            const dy = event.clientY - this.pointerDownPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > this.MODEL_DRAG_THRESHOLD) {
                if (!this.isDraggingModel && this.dragOffset) {
                    this.isDraggingModel = true;
                    this.draggedModelId = selectedModel.id;
                    canvas.style.cursor = 'grabbing';
                    this.disableCameraControls();
                }

                if (this.isDraggingModel && this.draggedModelId) {
                    this.handleModelDrag(event);
                }
            }
        };

        // ----------------------------------------------------------------
        // Pointer Up
        // ----------------------------------------------------------------
        this.boundPointerUp = (event: PointerEvent) => {
            if (event.button !== 0) return;

            const wasDragging = this.isDraggingModel;

            if (this.isDraggingModel) {
                this.isDraggingModel = false;
                this.draggedModelId = null;
                this.dragOffset = null;
                canvas.style.cursor = 'default';
                this.enableCameraControls();
            }

            // If not dragging, handle as click
            if (!wasDragging && this.pointerDownPos) {
                const dx = event.clientX - this.pointerDownPos.x;
                const dy = event.clientY - this.pointerDownPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance <= this.MODEL_DRAG_THRESHOLD) {
                    this.handleModelClick(event);
                }
            }

            this.pointerDownPos = null;
            this.dragOffset = null;
        };

        canvas.addEventListener('pointerdown', this.boundPointerDown);
        canvas.addEventListener('pointermove', this.boundPointerMove);
        canvas.addEventListener('pointerup', this.boundPointerUp);

        canvas.addEventListener('pointerleave', () => {
            if (this.isDraggingModel) {
                this.isDraggingModel = false;
                this.draggedModelId = null;
                this.dragOffset = null;
                canvas.style.cursor = 'default';
                this.enableCameraControls();
            }
            this.pointerDownPos = null;
        });

        console.log('[ModelImportButtonWithScaling] Model selection configured');
    }

    // ========================================================================
    // KEYBOARD SHORTCUTS (EXTENDED)
    // ========================================================================

    /**
     * Setup keyboard shortcuts including scaling
     */
    private setupKeyboardShortcuts(): void {
        window.addEventListener('keydown', (event: KeyboardEvent) => {
            // Skip if typing in input
            if (event.target instanceof HTMLInputElement ||
                event.target instanceof HTMLTextAreaElement ||
                event.target instanceof HTMLSelectElement) {
                return;
            }

            if (!this.modelSystem) return;
            if (this.trackPlacer?.isInPlacementMode()) return;

            const trackSelected = (window as any).__trackPieceSelected === true;
            const selectedModel = this.modelSystem.getSelectedModel();

            switch (event.key) {
                case '[':
                    if (selectedModel && !trackSelected) {
                        event.preventDefault();
                        const angle = event.shiftKey ? -22.5 : -5;
                        this.modelSystem.rotateModel(selectedModel.id, angle);
                    }
                    break;

                case ']':
                    if (selectedModel && !trackSelected) {
                        event.preventDefault();
                        const angle = event.shiftKey ? 22.5 : 5;
                        this.modelSystem.rotateModel(selectedModel.id, angle);
                    }
                    break;

                case 'Delete':
                case 'Backspace':
                    if (selectedModel && !trackSelected && !event.metaKey && !event.ctrlKey) {
                        event.preventDefault();
                        // Unregister from scaling first
                        this.unregisterModelFromScaling(selectedModel.id);
                        // Then remove
                        this.modelSystem.removeModel(selectedModel.id);
                        // Deselect in scale manager
                        this.scaleManager?.deselectObject();
                    }
                    break;

                case 'Escape':
                    if (selectedModel) {
                        event.preventDefault();
                        this.modelSystem.deselectModel();
                        this.scaleManager?.deselectObject();
                        (window as any).__modelSelected = false;
                    }
                    break;
            }
        });
    }

    // ========================================================================
    // MODEL PLACEMENT (EXTENDED TO REGISTER FOR SCALING)
    // ========================================================================

    /**
     * Place a model from the library
     * Extended to register with scaling system
     */
    private async placeModel(libraryId: string): Promise<void> {
        if (!this.modelSystem) return;

        const entry = this.library.getModel(libraryId);
        if (!entry) {
            console.error('[ModelImportButtonWithScaling] Model not found:', libraryId);
            return;
        }

        console.log(`[ModelImportButtonWithScaling] Placing: ${entry.name}`);

        // Check if rolling stock (needs track)
        if (TRACK_PLACEMENT_CATEGORIES.includes(entry.category)) {
            this.placeRollingStock(libraryId);
            return;
        }

        // Place on baseboard
        const boardY = this.baseboardSystem?.getBoardTopY() || 0;
        const position = new Vector3(0, boardY, 0);

        try {
            const placedModel = await this.modelSystem.placeModel(entry, { position });

            if (placedModel) {
                console.log(`[ModelImportButtonWithScaling] ✓ Placed: ${entry.name}`);

                // === NEW: Register for scaling ===
                this.registerModelForScaling(placedModel, entry.category);

                // Select it
                this.modelSystem.selectModel(placedModel.id);
                if (this.scaleManager) {
                    this.scaleManager.selectObject(placedModel.id);
                }
            }
        } catch (error) {
            console.error('[ModelImportButtonWithScaling] Failed to place:', error);
        }
    }

    /**
     * Place rolling stock on track
     */
    private placeRollingStock(libraryId: string): void {
        if (!this.trackPlacer) {
            console.error('[ModelImportButtonWithScaling] TrackPlacer not available');
            return;
        }

        console.log('[ModelImportButtonWithScaling] Click on track to place rolling stock');

        this.trackPlacer.startPlacement(libraryId, async (position, trackInfo) => {
            if (!this.modelSystem) return;

            const entry = this.library.getModel(libraryId);
            if (!entry) return;

            try {
                const placedModel = await this.modelSystem.placeModel(entry, {
                    position,
                    rotationDeg: trackInfo.angle * (180 / Math.PI)
                });

                if (placedModel) {
                    console.log(`[ModelImportButtonWithScaling] ✓ Placed on track: ${entry.name}`);

                    // === NEW: Register for scaling ===
                    this.registerModelForScaling(placedModel, entry.category);
                }
            } catch (error) {
                console.error('[ModelImportButtonWithScaling] Track placement failed:', error);
            }
        });
    }

    // ========================================================================
    // IMPORT DIALOG
    // ========================================================================

    /**
     * Show the import dialog
     */
    public showImportDialog(): void {
        if (!this.modelSystem) {
            console.error('[ModelImportButtonWithScaling] Model system not ready');
            return;
        }

        const dialog = new ModelImportDialog(this.scene, this.modelSystem);
        dialog.show((entry) => {
            if (entry) {
                console.log(`[ModelImportButtonWithScaling] Imported: ${entry.name}`);
                this.updateStatusDisplay();

                // Dispatch event to trigger placement
                window.dispatchEvent(new CustomEvent('placeModel', { detail: entry.id }));
            }
        });
    }

    /**
     * Open dialog - alias for external access
     */
    public openDialog(): void {
        this.showImportDialog();
    }

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

    /**
     * Pick a model at screen position
     */
    private pickModelAtPosition(screenX: number, screenY: number): string | null {
        if (!this.modelSystem) return null;

        const canvas = this.scene.getEngine().getRenderingCanvas();
        if (!canvas) return null;

        const camera = this.scene.activeCamera;
        if (!camera) return null;

        const ray = this.scene.createPickingRay(screenX, screenY, null, camera);
        const hit = this.scene.pickWithRay(ray, (mesh) => {
            return mesh.metadata?.placedModelId !== undefined;
        });

        if (hit?.hit && hit.pickedMesh?.metadata?.placedModelId) {
            return hit.pickedMesh.metadata.placedModelId;
        }

        return null;
    }

    /**
     * Get world position from screen coordinates
     */
    private getWorldPositionFromScreen(screenX: number, screenY: number): Vector3 | null {
        const camera = this.scene.activeCamera;
        if (!camera) return null;

        const ray = this.scene.createPickingRay(screenX, screenY, null, camera);

        // Pick against baseboard or ground plane
        const boardY = this.baseboardSystem?.getBoardTopY() || 0;

        // Calculate intersection with Y plane
        if (Math.abs(ray.direction.y) > 0.001) {
            const t = (boardY - ray.origin.y) / ray.direction.y;
            if (t > 0) {
                return ray.origin.add(ray.direction.scale(t));
            }
        }

        return null;
    }

    /**
     * Handle model dragging
     */
    private handleModelDrag(event: PointerEvent): void {
        if (!this.modelSystem || !this.draggedModelId) return;

        const worldPos = this.getWorldPositionFromScreen(event.clientX, event.clientY);
        if (!worldPos) return;

        // Apply offset
        let newX = worldPos.x;
        let newZ = worldPos.z;

        if (this.dragOffset) {
            newX -= this.dragOffset.x;
            newZ -= this.dragOffset.z;
        }

        const boardY = this.baseboardSystem?.getBoardTopY() || 0;
        const newPos = new Vector3(newX, boardY, newZ);

        this.modelSystem.moveModel(this.draggedModelId, newPos);

        // Update gizmo position
        if (this.scaleManager) {
            const adapter = this.scalableAdapters.get(this.draggedModelId);
            if (adapter) {
                // The gizmo auto-updates based on transform node position
            }
        }
    }

    /**
     * Disable camera controls
     */
    private disableCameraControls(): void {
        const camera = this.scene.activeCamera;
        if (camera) {
            camera.detachControl();
        }
    }

    /**
     * Enable camera controls
     */
    private enableCameraControls(): void {
        const camera = this.scene.activeCamera;
        const canvas = this.scene.getEngine().getRenderingCanvas();
        if (camera && canvas) {
            camera.attachControl(canvas, true);
        }
    }

    /**
     * Update status display
     */
    private updateStatusDisplay(): void {
        // Optional: update any status UI
    }

    // ========================================================================
    // PUBLIC ACCESSORS
    // ========================================================================

    /**
     * Get the model system
     */
    public getModelSystem(): ModelSystem | null {
        return this.modelSystem;
    }

    /**
     * Get the scale manager
     */
    public getScaleManager(): ScaleManager | null {
        return this.scaleManager;
    }

    /**
     * Get the transform panel
     */
    public getTransformPanel(): TransformPanel | null {
        return this.transformPanel;
    }

    // ========================================================================
    // DISPOSAL
    // ========================================================================

    /**
     * Clean up all resources
     */
    dispose(): void {
        // Remove event listeners
        const canvas = this.scene.getEngine().getRenderingCanvas();
        if (canvas) {
            if (this.boundPointerDown) canvas.removeEventListener('pointerdown', this.boundPointerDown);
            if (this.boundPointerMove) canvas.removeEventListener('pointermove', this.boundPointerMove);
            if (this.boundPointerUp) canvas.removeEventListener('pointerup', this.boundPointerUp);
        }

        // Dispose transform panel
        if (this.transformPanel) {
            this.transformPanel.dispose();
            this.transformPanel = null;
        }

        // Dispose scale manager
        if (this.scaleManager) {
            this.scaleManager.dispose();
            this.scaleManager = null;
        }

        // Clear adapters
        this.scalableAdapters.clear();

        // Remove button
        if (this.button) {
            this.button.remove();
            this.button = null;
        }

        console.log('[ModelImportButtonWithScaling] Disposed');
    }
}