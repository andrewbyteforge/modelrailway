/**
 * ModelImportButton.ts - Simple floating import button with track placement
 * 
 * Path: frontend/src/ui/ModelImportButton.ts
 * 
 * A standalone floating button that opens the model import dialog.
 * For rolling stock, requires placement on track.
 * 
 * Usage in App.ts:
 *   import { ModelImportButton } from '../ui/ModelImportButton';
 *   
 *   // In initialize():
 *   const importButton = new ModelImportButton(this.scene);
 *   importButton.initialize();
 * 
 * @module ModelImportButton
 * @author Model Railway Workbench
 * @version 1.1.0
 */

import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ModelSystem } from '../systems/models/ModelSystem';
import { ModelLibrary, type ModelLibraryEntry } from '../systems/models/ModelLibrary';
import { TrackModelPlacer } from '../systems/models/TrackModelPlacer';
import { ModelImportDialog } from './ModelImportDialog';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Categories that require track placement */
const TRACK_PLACEMENT_CATEGORIES = ['rolling_stock'];

// ============================================================================
// MODEL IMPORT BUTTON CLASS
// ============================================================================

/**
 * ModelImportButton - Floating button to trigger model import
 * 
 * Creates a visible "Import Model" button in the corner of the screen
 * that opens the ModelImportDialog when clicked.
 * 
 * For rolling stock models, requires placement on existing track pieces.
 */
export class ModelImportButton {
    // ========================================================================
    // PRIVATE PROPERTIES
    // ========================================================================

    /** Babylon.js scene reference */
    private scene: Scene;

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
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new ModelImportButton
     * @param scene - Babylon.js scene
     */
    constructor(scene: Scene) {
        if (!scene) {
            throw new Error('[ModelImportButton] Scene is required');
        }
        this.scene = scene;
        this.library = ModelLibrary.getInstance();

        console.log('[ModelImportButton] Created');
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the button and model system
     * Call this after scene is ready
     */
    initialize(): void {
        console.log('[ModelImportButton] Initializing...');

        try {
            // ------------------------------------------------------------
            // Initialize Model System
            // ------------------------------------------------------------
            this.modelSystem = new ModelSystem(this.scene, null);
            this.modelSystem.initialize();
            console.log('[ModelImportButton] ✓ ModelSystem initialized');

            // ------------------------------------------------------------
            // Initialize Track Model Placer
            // ------------------------------------------------------------
            this.trackPlacer = new TrackModelPlacer(this.scene);
            this.trackPlacer.initialize();
            console.log('[ModelImportButton] ✓ TrackModelPlacer initialized');

            // ------------------------------------------------------------
            // Create UI Elements
            // ------------------------------------------------------------
            // this.createButton();
            // this.createStatusDisplay();

            // ------------------------------------------------------------
            // Subscribe to library changes
            // ------------------------------------------------------------
            this.library.onChange(() => {
                this.updateStatusDisplay();
            });

            // ------------------------------------------------------------
            // Setup keyboard shortcuts for model rotation
            // ------------------------------------------------------------
            this.setupKeyboardShortcuts();

            // ------------------------------------------------------------
            // Setup click-to-select for placed models
            // ------------------------------------------------------------
            this.setupModelSelection();

            console.log('[ModelImportButton] ✓ Initialized successfully');
            console.log('[ModelImportButton] Click the green "📦 Import Model" button to import GLB/GLTF files');
            console.log('[ModelImportButton] Rolling stock will require placement on track');
            console.log('[ModelImportButton] Use [ and ] to rotate selected models');
            console.log('[ModelImportButton] Click on placed models to select them (turns red)');

        } catch (error) {
            console.error('[ModelImportButton] Initialization failed:', error);
            throw error;
        }
    }

    // ========================================================================
    // KEYBOARD SHORTCUTS
    // ========================================================================

    /**
     * Setup keyboard shortcuts for model manipulation
     * 
     * [ = Rotate left -5°
     * ] = Rotate right +5°
     * Shift + [ = Rotate left -22.5°
     * Shift + ] = Rotate right +22.5°
     * Delete = Remove selected model
     * 
     * Note: Track rotation has priority - if a track piece is selected,
     * App.ts handles the rotation instead.
     */
    private setupKeyboardShortcuts(): void {
        window.addEventListener('keydown', (event: KeyboardEvent) => {
            // Skip if typing in an input field
            if (event.target instanceof HTMLInputElement ||
                event.target instanceof HTMLTextAreaElement ||
                event.target instanceof HTMLSelectElement) {
                return;
            }

            // Skip if no model system or in track placement mode
            if (!this.modelSystem) return;
            if (this.trackPlacer?.isInPlacementMode()) return;

            // Check if a track piece is selected - if so, let App.ts handle rotation
            // This is done by checking for the 'trackPieceSelected' custom property
            // or by checking if the InputManager has a selected piece
            const trackSelected = (window as any).__trackPieceSelected === true;

            const selectedModel = this.modelSystem.getSelectedModel();

            switch (event.key) {
                case '[':
                    // Rotate left - only if model selected AND no track selected
                    if (selectedModel && !trackSelected) {
                        event.preventDefault();
                        const angle = event.shiftKey ? -22.5 : -5;
                        this.modelSystem.rotateModel(selectedModel.id, angle);
                        console.log(`[ModelImportButton] Rotated model ${angle}°`);
                    }
                    break;

                case ']':
                    // Rotate right - only if model selected AND no track selected
                    if (selectedModel && !trackSelected) {
                        event.preventDefault();
                        const angle = event.shiftKey ? 22.5 : 5;
                        this.modelSystem.rotateModel(selectedModel.id, angle);
                        console.log(`[ModelImportButton] Rotated model ${angle}°`);
                    }
                    break;

                case 'Delete':
                case 'Backspace':
                    // Delete selected model (Backspace as alternative for Mac)
                    // Only if no track is selected
                    if (selectedModel && !trackSelected && !event.metaKey && !event.ctrlKey) {
                        event.preventDefault();
                        const modelName = this.library.getModel(selectedModel.libraryId)?.name || selectedModel.id;
                        this.modelSystem.removeModel(selectedModel.id);
                        console.log(`[ModelImportButton] Deleted model: ${modelName}`);
                    }
                    break;

                case 'Escape':
                    // Deselect model
                    if (selectedModel) {
                        event.preventDefault();
                        this.modelSystem.deselectModel();
                        console.log('[ModelImportButton] Deselected model');
                    }
                    break;
            }
        });

        console.log('[ModelImportButton] Keyboard shortcuts configured:');
        console.log('[ModelImportButton]   [ / ] = Rotate ±5°');
        console.log('[ModelImportButton]   Shift + [ / ] = Rotate ±22.5°');
        console.log('[ModelImportButton]   Delete = Remove selected');
        console.log('[ModelImportButton]   Escape = Deselect');
    }

    // ========================================================================
    // MODEL SELECTION & DRAGGING
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

    /** Bound pointer down handler */
    private boundPointerDown: ((event: PointerEvent) => void) | null = null;

    /** Bound pointer up handler */
    private boundPointerUp: ((event: PointerEvent) => void) | null = null;

    /** Bound pointer move handler */
    private boundPointerMove: ((event: PointerEvent) => void) | null = null;

    /**
     * Setup click-to-select and drag-to-move for placed models
     * 
     * - Click on a model to select it (highlighted red)
     * - Click and drag a selected model to move it
     * - Click elsewhere to deselect
     */
    private setupModelSelection(): void {
        // Get the canvas from the scene's engine
        const canvas = this.scene.getEngine().getRenderingCanvas();
        if (!canvas) {
            console.warn('[ModelImportButton] No canvas found for model selection');
            return;
        }

        // ----------------------------------------------------------------
        // Pointer Down - Start selection or drag
        // ----------------------------------------------------------------
        this.boundPointerDown = (event: PointerEvent) => {
            if (event.button !== 0) return;

            // Skip if in track placement mode
            if (this.trackPlacer?.isInPlacementMode()) return;

            // Skip if track is selected
            const trackSelected = (window as any).__trackPieceSelected === true;
            if (trackSelected) return;

            this.pointerDownPos = { x: event.clientX, y: event.clientY };

            // Check if clicking on a model
            const pickedModelId = this.pickModelAtPosition(event.clientX, event.clientY);

            if (pickedModelId && this.modelSystem) {
                // If clicking on already selected model, prepare for drag
                const selectedModel = this.modelSystem.getSelectedModel();
                if (selectedModel && selectedModel.id === pickedModelId) {
                    // Calculate offset from model center to click point
                    const worldPos = this.getWorldPositionFromScreen(event.clientX, event.clientY);
                    if (worldPos) {
                        this.dragOffset = {
                            x: worldPos.x - selectedModel.position.x,
                            z: worldPos.z - selectedModel.position.z
                        };
                        console.log('[ModelImportButton] Ready to drag model');
                    }
                }
            }
        };

        // ----------------------------------------------------------------
        // Pointer Move - Handle dragging
        // ----------------------------------------------------------------
        this.boundPointerMove = (event: PointerEvent) => {
            if (!this.pointerDownPos) return;
            if (!this.modelSystem) return;

            // Skip if in track placement mode
            if (this.trackPlacer?.isInPlacementMode()) return;

            // Skip if track is selected
            const trackSelected = (window as any).__trackPieceSelected === true;
            if (trackSelected) return;

            const selectedModel = this.modelSystem.getSelectedModel();
            if (!selectedModel) return;

            // Check if we've moved enough to start dragging
            const dx = event.clientX - this.pointerDownPos.x;
            const dy = event.clientY - this.pointerDownPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > this.MODEL_DRAG_THRESHOLD) {
                // Check if we clicked on the selected model to start drag
                if (!this.isDraggingModel && this.dragOffset) {
                    // We have a drag offset, which means we clicked on the selected model
                    this.isDraggingModel = true;
                    this.draggedModelId = selectedModel.id;
                    canvas.style.cursor = 'grabbing';

                    // IMPORTANT: Disable camera controls while dragging
                    this.disableCameraControls();

                    console.log('[ModelImportButton] Started dragging model:', selectedModel.id);
                }

                // If dragging, move the model
                if (this.isDraggingModel && this.draggedModelId) {
                    this.handleModelDrag(event);
                }
            }
        };

        // ----------------------------------------------------------------
        // Pointer Up - End drag or handle click
        // ----------------------------------------------------------------
        this.boundPointerUp = (event: PointerEvent) => {
            if (event.button !== 0) return;

            const wasDragging = this.isDraggingModel;

            // End drag
            if (this.isDraggingModel) {
                this.isDraggingModel = false;
                this.draggedModelId = null;
                this.dragOffset = null;
                canvas.style.cursor = 'default';

                // Re-enable camera controls
                this.enableCameraControls();

                console.log('[ModelImportButton] Stopped dragging model');
            }

            // If we weren't dragging, handle as click (for selection)
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

        // Also stop dragging if pointer leaves canvas
        canvas.addEventListener('pointerleave', () => {
            if (this.isDraggingModel) {
                this.isDraggingModel = false;
                this.draggedModelId = null;
                this.dragOffset = null;
                canvas.style.cursor = 'default';
                this.enableCameraControls();
                console.log('[ModelImportButton] Drag cancelled (left canvas)');
            }
            this.pointerDownPos = null;
        });

        console.log('[ModelImportButton] Model click-to-select and drag-to-move configured');
    }

    /**
     * Disable camera controls during model drag
     */
    private disableCameraControls(): void {
        const camera = this.scene.activeCamera;
        if (camera) {
            camera.detachControl();
            console.log('[ModelImportButton] Camera controls disabled for drag');
        }
    }

    /**
     * Re-enable camera controls after model drag
     */
    private enableCameraControls(): void {
        const camera = this.scene.activeCamera;
        const canvas = this.scene.getEngine().getRenderingCanvas();
        if (camera && canvas) {
            camera.attachControl(canvas, true);
            console.log('[ModelImportButton] Camera controls re-enabled');
        }
    }

    /**
     * Pick a model at screen position
     * @returns Model instance ID or null
     */
    private pickModelAtPosition(screenX: number, screenY: number): string | null {
        if (!this.modelSystem) return null;

        const canvas = this.scene.getEngine().getRenderingCanvas();
        if (!canvas) return null;

        const rect = canvas.getBoundingClientRect();
        const x = screenX - rect.left;
        const y = screenY - rect.top;

        const camera = this.scene.activeCamera;
        if (!camera) return null;

        const ray = this.scene.createPickingRay(x, y, null, camera);
        const pickResult = this.scene.pickWithRay(ray);

        if (pickResult?.hit && pickResult.pickedMesh) {
            return this.modelSystem.getPlacedModelIdFromMesh(pickResult.pickedMesh);
        }

        return null;
    }

    /**
     * Get world position from screen coordinates
     * Uses baseboard picking or falls back to Y=0 plane intersection
     */
    private getWorldPositionFromScreen(screenX: number, screenY: number): { x: number; z: number } | null {
        const canvas = this.scene.getEngine().getRenderingCanvas();
        if (!canvas) return null;

        const rect = canvas.getBoundingClientRect();
        const x = screenX - rect.left;
        const y = screenY - rect.top;

        const camera = this.scene.activeCamera;
        if (!camera) return null;

        // Create ray from camera through screen point
        const ray = this.scene.createPickingRay(x, y, null, camera);

        // Try to pick the baseboard/ground first
        const pickResult = this.scene.pickWithRay(ray, (mesh) => {
            // Pick any mesh that could be ground/baseboard
            const name = mesh.name.toLowerCase();
            return name.includes('baseboard') ||
                name.includes('ground') ||
                name.includes('board') ||
                name.includes('floor');
        });

        if (pickResult?.hit && pickResult.pickedPoint) {
            return { x: pickResult.pickedPoint.x, z: pickResult.pickedPoint.z };
        }

        // Fallback: intersect with Y=0 plane (horizontal ground plane)
        if (Math.abs(ray.direction.y) > 0.001) {
            const t = -ray.origin.y / ray.direction.y;
            if (t > 0) {
                return {
                    x: ray.origin.x + ray.direction.x * t,
                    z: ray.origin.z + ray.direction.z * t
                };
            }
        }

        return null;
    }

    /**
     * Handle model dragging - move model to follow mouse
     */
    private handleModelDrag(event: PointerEvent): void {
        if (!this.modelSystem || !this.draggedModelId) return;

        const worldPos = this.getWorldPositionFromScreen(event.clientX, event.clientY);
        if (!worldPos) {
            console.warn('[ModelImportButton] Could not get world position for drag');
            return;
        }

        // Apply offset so model doesn't jump to cursor center
        let newX = worldPos.x;
        let newZ = worldPos.z;

        if (this.dragOffset) {
            newX -= this.dragOffset.x;
            newZ -= this.dragOffset.z;
        }

        // Get current model to preserve Y position
        const model = this.modelSystem.getPlacedModel(this.draggedModelId);
        if (!model) return;

        // Move the model
        const newPosition = new Vector3(newX, model.position.y, newZ);
        this.modelSystem.moveModel(this.draggedModelId, newPosition);
    }

    /**
     * Handle click for model selection
     */
    private handleModelClick(event: PointerEvent): void {
        // Skip if no model system
        if (!this.modelSystem) return;

        // Skip if in track placement mode
        if (this.trackPlacer?.isInPlacementMode()) return;

        // Skip if track piece is selected (let InputManager handle it)
        const trackSelected = (window as any).__trackPieceSelected === true;
        if (trackSelected) return;

        try {
            // Get canvas-relative coordinates
            const canvas = this.scene.getEngine().getRenderingCanvas();
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            // Create picking ray
            const camera = this.scene.activeCamera;
            if (!camera) return;

            const ray = this.scene.createPickingRay(x, y, null, camera);
            const pickResult = this.scene.pickWithRay(ray);

            if (pickResult?.hit && pickResult.pickedMesh) {
                // Check if the picked mesh belongs to a placed model
                const placedModelId = this.modelSystem.getPlacedModelIdFromMesh(pickResult.pickedMesh);

                if (placedModelId) {
                    // Select this model
                    this.modelSystem.selectModel(placedModelId);

                    // Set global flag so track system knows a model is selected
                    (window as any).__modelSelected = true;

                    const model = this.modelSystem.getPlacedModel(placedModelId);
                    const entry = model ? this.library.getModel(model.libraryId) : null;
                    console.log(`[ModelImportButton] Selected model: ${entry?.name || placedModelId}`);
                    return;
                }
            }

            // Clicked on nothing or non-model - deselect current model
            const currentSelected = this.modelSystem.getSelectedModel();
            if (currentSelected) {
                this.modelSystem.deselectModel();
                (window as any).__modelSelected = false;
                console.log('[ModelImportButton] Deselected model (clicked elsewhere)');
            }

        } catch (error) {
            console.error('[ModelImportButton] Error handling model click:', error);
        }
    }

    // ========================================================================
    // UI CREATION
    // ========================================================================

    /**
     * Create the floating import button
     */
    private createButton(): void {
        this.button = document.createElement('button');
        this.button.id = 'model-import-button';
        this.button.innerHTML = '📦 Import Model';

        // Style the button
        this.button.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            font-size: 16px;
            font-weight: bold;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: white;
            background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
            border: none;
            border-radius: 8px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);
            z-index: 1000;
            transition: all 0.2s ease;
        `;

        // Hover effects
        this.button.addEventListener('mouseenter', () => {
            if (this.button) {
                this.button.style.transform = 'scale(1.05)';
                this.button.style.boxShadow = '0 6px 16px rgba(76, 175, 80, 0.5)';
            }
        });

        this.button.addEventListener('mouseleave', () => {
            if (this.button) {
                this.button.style.transform = 'scale(1)';
                this.button.style.boxShadow = '0 4px 12px rgba(76, 175, 80, 0.4)';
            }
        });

        // Click handler
        this.button.addEventListener('click', () => {
            this.showImportDialog();
        });

        // Add to DOM
        document.body.appendChild(this.button);
        console.log('[ModelImportButton] Button added to DOM');
    }

    /**
     * Create status display showing imported model count
     */
    private createStatusDisplay(): void {
        this.statusDisplay = document.createElement('div');
        this.statusDisplay.id = 'model-import-status';

        this.statusDisplay.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            padding: 8px 16px;
            font-size: 13px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #666;
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid #ddd;
            border-radius: 6px;
            z-index: 999;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            max-width: 280px;
        `;

        document.body.appendChild(this.statusDisplay);
        this.updateStatusDisplay();
    }

    /**
     * Update the status display with current library info
     */
    private updateStatusDisplay(): void {
        if (!this.statusDisplay) return;

        const stats = this.library.getStats();
        const models = this.library.getAllModels();

        if (models.length === 0) {
            this.statusDisplay.innerHTML = `
                <div style="color: #888;">No models imported yet</div>
                <div style="font-size: 11px; color: #aaa; margin-top: 4px;">
                    Click button above to import GLB/GLTF
                </div>
            `;
        } else {
            // Show recent models
            const recentModels = models
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 3);

            this.statusDisplay.innerHTML = `
                <div style="font-weight: bold; color: #333; margin-bottom: 6px;">
                    📦 ${stats.totalModels} model${stats.totalModels !== 1 ? 's' : ''} imported
                </div>
                ${recentModels.map(m => `
                    <div style="
                        font-size: 12px; 
                        padding: 4px 0; 
                        border-top: 1px solid #eee;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    ">
                        <span>${this.getCategoryIcon(m.category)} ${m.name}</span>
                        <button 
                            onclick="window.dispatchEvent(new CustomEvent('placeModel', {detail: '${m.id}'}))"
                            style="
                                padding: 2px 8px;
                                font-size: 10px;
                                border: 1px solid #4CAF50;
                                border-radius: 3px;
                                background: white;
                                color: #4CAF50;
                                cursor: pointer;
                            "
                        >Place</button>
                    </div>
                `).join('')}
                ${models.length > 3 ? `
                    <div style="font-size: 11px; color: #888; margin-top: 4px;">
                        +${models.length - 3} more...
                    </div>
                ` : ''}
            `;

            // Add place model listener if not already added
            this.setupPlaceModelListener();
        }
    }

    /**
     * Get category icon
     */
    private getCategoryIcon(category: string): string {
        const icons: Record<string, string> = {
            buildings: '🏠',
            rolling_stock: '🚃',
            scenery: '🌳',
            infrastructure: '🌉',
            vehicles: '🚗',
            figures: '👤',
            accessories: '🪑',
            custom: '📦'
        };
        return icons[category] || '📦';
    }

    /**
     * Setup listener for place model events
     */
    private placeListenerSetup = false;
    private setupPlaceModelListener(): void {
        if (this.placeListenerSetup) return;
        this.placeListenerSetup = true;

        window.addEventListener('placeModel', ((event: CustomEvent) => {
            const libraryId = event.detail;
            this.placeModel(libraryId);
        }) as EventListener);
    }

    // ========================================================================
    // IMPORT DIALOG
    // ========================================================================

    /**
     * Show the import dialog
     */
    private showImportDialog(): void {
        if (!this.modelSystem) {
            console.error('[ModelImportButton] Model system not initialized');
            return;
        }

        console.log('[ModelImportButton] Opening import dialog...');

        const dialog = new ModelImportDialog(this.scene, this.modelSystem);
        dialog.show((entry) => {
            if (entry) {
                console.log(`[ModelImportButton] ✓ Imported: "${entry.name}"`);
                console.log(`[ModelImportButton]   Category: ${entry.category}`);
                console.log(`[ModelImportButton]   ID: ${entry.id}`);

                // Place the model (with appropriate method based on category)
                this.placeModel(entry.id);
            } else {
                console.log('[ModelImportButton] Import cancelled');
            }
        });
    }

    // ========================================================================
    // MODEL PLACEMENT
    // ========================================================================

    /**
     * Check if a category requires track placement
     */
    private requiresTrackPlacement(category: string): boolean {
        return TRACK_PLACEMENT_CATEGORIES.includes(category);
    }

    /**
     * Place a model from the library
     * Uses track placement for rolling stock, baseboard for others
     */
    private async placeModel(libraryId: string): Promise<void> {
        if (!this.modelSystem) return;

        const entry = this.library.getModel(libraryId);
        if (!entry) {
            console.error('[ModelImportButton] Model not found:', libraryId);
            return;
        }

        console.log(`[ModelImportButton] Placing model: "${entry.name}" (${entry.category})`);

        // Check if this model requires track placement
        if (this.requiresTrackPlacement(entry.category)) {
            await this.placeOnTrack(entry);
        } else {
            await this.placeOnBaseboard(entry);
        }
    }

    /**
     * Place a model on track (for rolling stock)
     */
    private async placeOnTrack(entry: ModelLibraryEntry): Promise<void> {
        if (!this.modelSystem || !this.trackPlacer) return;

        // Check if there are any track pieces
        if (!this.trackPlacer.hasTrackPieces()) {
            this.showNoTrackWarning();
            return;
        }

        console.log('[ModelImportButton] Starting track placement mode for rolling stock');

        // Start track placement mode
        this.trackPlacer.startPlacement(async (result) => {
            if (result && result.isValid) {
                // Place the model at the calculated position
                const placed = await this.modelSystem!.placeModel(entry, {
                    position: result.position,
                    rotationDeg: result.rotationDegrees
                });

                if (placed) {
                    console.log(`[ModelImportButton] ✓ Placed rolling stock "${entry.name}" on track`);
                    console.log(`[ModelImportButton]   Position: (${result.position.x.toFixed(3)}, ${result.position.z.toFixed(3)})`);
                    console.log(`[ModelImportButton]   Rotation: ${result.rotationDegrees.toFixed(1)}°`);

                    // Select it
                    this.modelSystem!.selectModel(placed.id);

                    // Mark as used
                    this.library.markAsUsed(entry.id);
                }
            } else {
                console.log('[ModelImportButton] Track placement cancelled');
            }
        });
    }

    /**
     * Place a model on baseboard (for non-rolling stock)
     */
    private async placeOnBaseboard(entry: ModelLibraryEntry): Promise<void> {
        if (!this.modelSystem) return;

        console.log('[ModelImportButton] Placing model on baseboard');

        // Create the model at origin initially
        const placed = await this.modelSystem.placeModel(entry, {
            position: new Vector3(0, 0, 0)
        });

        if (placed) {
            console.log(`[ModelImportButton] ✓ Model placed at origin`);
            console.log('[ModelImportButton] Use mouse to drag, Q/E to rotate');

            // Select it
            this.modelSystem.selectModel(placed.id);

            // Mark as used
            this.library.markAsUsed(entry.id);
        }
    }

    /**
     * Show warning when no track is available for rolling stock
     */
    private showNoTrackWarning(): void {
        // Create warning modal
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 3000;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            padding: 24px;
            border-radius: 12px;
            max-width: 400px;
            text-align: center;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        `;

        modal.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 16px;">🚂</div>
            <h3 style="margin: 0 0 12px 0; color: #333;">No Track Available</h3>
            <p style="margin: 0 0 20px 0; color: #666; line-height: 1.5;">
                Rolling stock must be placed on track. 
                Please place some track pieces first, then import your rolling stock.
            </p>
            <button id="noTrackOkBtn" style="
                padding: 10px 24px;
                font-size: 14px;
                font-weight: bold;
                color: white;
                background: #4CAF50;
                border: none;
                border-radius: 6px;
                cursor: pointer;
            ">OK, Got It</button>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Close on button click
        modal.querySelector('#noTrackOkBtn')?.addEventListener('click', () => {
            overlay.remove();
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }

    // ========================================================================
    // PUBLIC METHODS
    // ========================================================================

    /**
     * Get the model system instance
     */
    getModelSystem(): ModelSystem | null {
        return this.modelSystem;
    }

    /**
     * Get the track placer instance
     */
    getTrackPlacer(): TrackModelPlacer | null {
        return this.trackPlacer;
    }

    /**
     * Show/hide the button
     */
    setVisible(visible: boolean): void {
        if (this.button) {
            this.button.style.display = 'none';
        }
        if (this.statusDisplay) {
            this.statusDisplay.style.display = visible ? 'block' : 'none';
        }
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        console.log('[ModelImportButton] Disposing...');

        // Remove event listeners for model selection and dragging
        const canvas = this.scene.getEngine().getRenderingCanvas();
        if (canvas) {
            if (this.boundPointerDown) {
                canvas.removeEventListener('pointerdown', this.boundPointerDown);
                this.boundPointerDown = null;
            }
            if (this.boundPointerMove) {
                canvas.removeEventListener('pointermove', this.boundPointerMove);
                this.boundPointerMove = null;
            }
            if (this.boundPointerUp) {
                canvas.removeEventListener('pointerup', this.boundPointerUp);
                this.boundPointerUp = null;
            }
        }

        // Clear drag state
        this.isDraggingModel = false;
        this.draggedModelId = null;
        this.dragOffset = null;

        // Clear global flags
        (window as any).__modelSelected = false;

        if (this.button) {
            this.button.remove();
            this.button = null;
        }

        if (this.statusDisplay) {
            this.statusDisplay.remove();
            this.statusDisplay = null;
        }

        if (this.trackPlacer) {
            this.trackPlacer.dispose();
            this.trackPlacer = null;
        }

        if (this.modelSystem) {
            this.modelSystem.dispose();
            this.modelSystem = null;
        }

        console.log('[ModelImportButton] Disposed');
    }
}