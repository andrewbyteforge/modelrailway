/**
 * ModelSelectionHandler.ts - Handles model selection, dragging, and keyboard shortcuts
 * 
 * Path: frontend/src/ui/ModelSelectionHandler.ts
 * 
 * This module manages all user input for interacting with placed models:
 * - Click-to-select models
 * - Drag-to-move models with fine positioning modes
 * - Keyboard shortcuts for rotation, nudging, scaling, and deletion
 * - Train detection and TrainSystem coordination
 * 
 * UPDATED: Train Selection Mode
 * - Click on train = Defers to TrainSystem for DRIVING controls
 * - Shift+Click on train = Selects for REPOSITIONING (drag, rotate, etc.)
 * 
 * @module ModelSelectionHandler
 * @author Model Railway Workbench
 * @version 1.0.0
 */

// ============================================================================
// IMPORTS
// ============================================================================

import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { ModelSystem, PlacedModel } from '../systems/models/ModelSystem';
import type { TrackModelPlacer } from '../systems/models/TrackModelPlacer';
import type { ScaleManager } from '../systems/scaling/ScaleManager';
import type { SidebarScaleControls } from './components/SidebarScaleControls';
import { getTrainClickBehavior } from '../systems/train/TrainMeshDetector';
import { setCameraControlsEnabled } from '../utils/CameraControlHelper';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix for this module */
const LOG_PREFIX = '[ModelSelectionHandler]';

/** 
 * Surface heights for consistent model placement
 * These match the BaseboardSystem constants
 */
const SURFACE_HEIGHTS = {
    /** Top surface of baseboard */
    BASEBOARD_TOP: 0.95,
    /** Rail top height (above baseboard) */
    RAIL_TOP: 0.97
} as const;

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Configuration for the ModelSelectionHandler
 */
export interface ModelSelectionHandlerConfig {
    /** Babylon.js scene reference */
    scene: Scene;

    /** Model system for accessing placed models */
    modelSystem: ModelSystem;

    /** Track placer to check placement mode */
    trackPlacer: TrackModelPlacer | null;

    /** Scale manager for gizmo and scale operations */
    scaleManager: ScaleManager | null;

    /** Sidebar scale controls for UI updates */
    sidebarScaleControls: SidebarScaleControls | null;

    /** Callback for height offset changes */
    onHeightOffsetChange?: (modelId: string, heightOffset: number) => void;

    /** Callback to get model height offset */
    getModelHeightOffset?: (modelId: string) => number;

    /** Callback to check if model has scalable adapter */
    hasScalableAdapter?: (modelId: string) => boolean;

    /** Callback to get scalable adapter info */
    getScalableAdapterInfo?: (modelId: string) => { currentScale: number; scaleLocked: boolean } | null;

    /** Callback for model deletion */
    onDeleteModel?: (modelId: string) => void;
}

// ============================================================================
// MODEL SELECTION HANDLER CLASS
// ============================================================================

/**
 * ModelSelectionHandler - Manages model selection, dragging, and keyboard shortcuts
 * 
 * @example
 * ```typescript
 * const handler = new ModelSelectionHandler({
 *     scene,
 *     modelSystem,
 *     trackPlacer,
 *     scaleManager,
 *     sidebarScaleControls
 * });
 * handler.initialize();
 * 
 * // Later...
 * handler.dispose();
 * ```
 */
export class ModelSelectionHandler {
    // ========================================================================
    // CORE PROPERTIES
    // ========================================================================

    /** Configuration object */
    private config: ModelSelectionHandlerConfig;

    /** Babylon scene reference */
    private scene: Scene;

    // ========================================================================
    // SELECTION/DRAG STATE
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

    // ========================================================================
    // BOUND EVENT HANDLERS
    // ========================================================================

    /** Bound pointer down handler */
    private boundPointerDown: ((event: PointerEvent) => void) | null = null;

    /** Bound pointer up handler */
    private boundPointerUp: ((event: PointerEvent) => void) | null = null;

    /** Bound pointer move handler */
    private boundPointerMove: ((event: PointerEvent) => void) | null = null;

    /** Bound keyboard handler */
    private boundKeyboardHandler: ((event: KeyboardEvent) => void) | null = null;

    /** Bound wheel handler */
    private boundWheelHandler: ((event: WheelEvent) => void) | null = null;

    // ========================================================================
    // KEY TRACKING
    // ========================================================================

    /** Track which keys are currently held */
    private heldKeys: Set<string> = new Set();

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new ModelSelectionHandler
     * @param config - Configuration options
     */
    constructor(config: ModelSelectionHandlerConfig) {
        if (!config.scene) {
            throw new Error(`${LOG_PREFIX} Scene is required`);
        }
        if (!config.modelSystem) {
            throw new Error(`${LOG_PREFIX} ModelSystem is required`);
        }

        this.config = config;
        this.scene = config.scene;

        console.log(`${LOG_PREFIX} Created`);
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the selection handler
     * Sets up all event listeners for model interaction
     */
    initialize(): void {
        console.log(`${LOG_PREFIX} Initializing...`);

        try {
            // ----------------------------------------------------------------
            // Setup key tracking
            // ----------------------------------------------------------------
            this.setupKeyTracking();

            // ----------------------------------------------------------------
            // Setup model selection and dragging
            // ----------------------------------------------------------------
            this.setupModelSelection();

            // ----------------------------------------------------------------
            // Setup keyboard shortcuts
            // ----------------------------------------------------------------
            this.setupKeyboardShortcuts();

            console.log(`${LOG_PREFIX} ✓ Initialized successfully`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Initialization failed:`, error);
            throw error;
        }
    }

    // ========================================================================
    // KEY TRACKING
    // ========================================================================

    /**
     * Setup key tracking for held keys detection
     */
    private setupKeyTracking(): void {
        window.addEventListener('keydown', (e) => {
            this.heldKeys.add(e.key.toLowerCase());
        });

        window.addEventListener('keyup', (e) => {
            this.heldKeys.delete(e.key.toLowerCase());
        });

        window.addEventListener('blur', () => {
            this.heldKeys.clear();
        });

        console.log(`${LOG_PREFIX} ✓ Key tracking configured`);
    }

    /**
     * Check if a key is currently held
     * @param key - Key to check (case-insensitive)
     * @returns True if key is held
     */
    private isKeyHeld(key: string): boolean {
        return this.heldKeys.has(key.toLowerCase());
    }

    // ========================================================================
    // MODEL SELECTION & DRAGGING SETUP
    // ========================================================================

    /**
     * Setup click-to-select and drag-to-move for placed models
     * 
     * UPDATED: Now checks for train meshes and defers to TrainSystem
     * when appropriate (regular click for driving, Shift+click for repositioning)
     */
    private setupModelSelection(): void {
        const canvas = this.scene.getEngine().getRenderingCanvas();
        if (!canvas) {
            console.warn(`${LOG_PREFIX} No canvas found for model selection`);
            return;
        }

        // ----------------------------------------------------------------
        // Pointer Down - Start selection or drag
        // ----------------------------------------------------------------
        this.boundPointerDown = (event: PointerEvent) => {
            this.handlePointerDown(event, canvas);
        };

        // ----------------------------------------------------------------
        // Pointer Move - Handle dragging
        // ----------------------------------------------------------------
        this.boundPointerMove = (event: PointerEvent) => {
            this.handlePointerMove(event, canvas);
        };

        // ----------------------------------------------------------------
        // Pointer Up - End drag or handle click
        // ----------------------------------------------------------------
        this.boundPointerUp = (event: PointerEvent) => {
            this.handlePointerUp(event, canvas);
        };

        // ----------------------------------------------------------------
        // Register handlers
        // ----------------------------------------------------------------
        canvas.addEventListener('pointerdown', this.boundPointerDown);
        canvas.addEventListener('pointermove', this.boundPointerMove);
        canvas.addEventListener('pointerup', this.boundPointerUp);

        // Handle pointer leaving canvas
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

        console.log(`${LOG_PREFIX} ✓ Model selection configured`);
    }

    // ========================================================================
    // POINTER EVENT HANDLERS
    // ========================================================================

    /**
     * Handle pointer down event
     * @param event - Pointer event
     * @param canvas - Canvas element
     */
    private handlePointerDown(event: PointerEvent, canvas: HTMLCanvasElement): void {
        // Only handle left clicks
        if (event.button !== 0) return;

        // Skip if in track placement mode
        if (this.config.trackPlacer?.isInPlacementMode()) return;

        // Skip if track is selected (window flag set by InputManager)
        const trackSelected = (window as any).__trackPieceSelected === true;
        if (trackSelected) return;

        // Skip if a train was just selected by TrainSystem (for driving)
        if ((window as any).__trainSelected === true) {
            console.log(`${LOG_PREFIX} Train already selected for driving - skipping`);
            return;
        }

        // Store pointer down position for drag detection
        this.pointerDownPos = { x: event.clientX, y: event.clientY };

        // ----------------------------------------------------------------
        // Check if clicking on a registered train using window.trainSystem
        // ----------------------------------------------------------------
        const pickedMesh = this.pickMeshAtScreenPosition(event.clientX, event.clientY);

        if (pickedMesh) {
            const trainSystem = (window as any).trainSystem;

            if (trainSystem) {
                const trainController = trainSystem.findTrainByMesh?.(pickedMesh);

                if (trainController) {
                    // This is a registered train!
                    if (!event.shiftKey) {
                        // Regular click (no Shift) = DRIVE mode
                        console.log(`${LOG_PREFIX} Train clicked - deferring to TrainSystem for DRIVING`);
                        console.log(`${LOG_PREFIX}   Tip: Use Shift+Click to reposition train instead`);
                        this.pointerDownPos = null;
                        trainController.select();
                        return;
                    } else {
                        // Shift+Click = REPOSITION mode
                        console.log(`${LOG_PREFIX} Shift+Click on train - entering REPOSITION mode`);
                        trainSystem.deselectTrain?.();
                        // Continue with normal model selection below
                    }
                }
            }

            // Fallback: Check using getTrainClickBehavior for non-registered trains
            const trainBehavior = getTrainClickBehavior(pickedMesh, event);
            if (trainBehavior.isTrain && trainBehavior.shouldDrive) {
                console.log(`${LOG_PREFIX} Unregistered train mesh clicked - check if train is on track`);
                this.pointerDownPos = null;
                return;
            }
        }

        // ----------------------------------------------------------------
        // Check if clicking on a placed model
        // ----------------------------------------------------------------
        const pickedModelId = this.pickModelAtPosition(event.clientX, event.clientY);

        if (pickedModelId && this.config.modelSystem) {
            // If clicking on already selected model, prepare for drag
            const selectedModel = this.config.modelSystem.getSelectedModel();
            if (selectedModel && selectedModel.id === pickedModelId) {
                // Calculate offset from model center to click point
                const worldPos = this.getWorldPositionFromScreen(event.clientX, event.clientY);
                if (worldPos) {
                    this.dragOffset = {
                        x: worldPos.x - selectedModel.position.x,
                        z: worldPos.z - selectedModel.position.z
                    };
                    console.log(`${LOG_PREFIX} Ready to drag model`);
                }
            }
        }
    }

    /**
     * Handle pointer move event
     * @param event - Pointer event
     * @param canvas - Canvas element
     */
    private handlePointerMove(event: PointerEvent, canvas: HTMLCanvasElement): void {
        if (!this.pointerDownPos) return;
        if (!this.config.modelSystem) return;

        // Skip if in track placement mode
        if (this.config.trackPlacer?.isInPlacementMode()) return;

        // Skip if track is selected
        const trackSelected = (window as any).__trackPieceSelected === true;
        if (trackSelected) return;

        // Don't start model drag if ScaleManager is dragging gizmo
        if (this.config.scaleManager?.isDragging()) return;

        const selectedModel = this.config.modelSystem.getSelectedModel();
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

                // Disable camera controls while dragging
                this.disableCameraControls();

                console.log(`${LOG_PREFIX} Started dragging model:`, selectedModel.id);
            }

            // If dragging, move the model
            if (this.isDraggingModel && this.draggedModelId) {
                this.handleModelDrag(event);
            }
        }
    }

    /**
     * Handle pointer up event
     * @param event - Pointer event
     * @param canvas - Canvas element
     */
    private handlePointerUp(event: PointerEvent, canvas: HTMLCanvasElement): void {
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

            console.log(`${LOG_PREFIX} Stopped dragging model`);
        }

        // If we weren't dragging, handle as click (for selection)
        if (!wasDragging && this.pointerDownPos) {
            const dx = event.clientX - this.pointerDownPos.x;
            const dy = event.clientY - this.pointerDownPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Only count as click if we didn't move much
            if (distance < this.MODEL_DRAG_THRESHOLD) {
                this.handleModelClick(event);
            }
        }

        // Reset pointer tracking
        this.pointerDownPos = null;
        this.dragOffset = null;
    }

    // ========================================================================
    // MODEL DRAG HANDLING
    // ========================================================================

    /**
     * Handle dragging a model
     * 
     * Supports fine positioning modes:
     * - Normal drag: 1:1 movement
     * - Shift + drag: 20% speed (fine positioning)
     * - Ctrl + drag: 5% speed (ultra-fine positioning)
     * 
     * @param event - Pointer event
     */
    private handleModelDrag(event: PointerEvent): void {
        if (!this.config.modelSystem || !this.draggedModelId || !this.dragOffset) return;

        const model = this.config.modelSystem.getPlacedModel(this.draggedModelId);
        if (!model) return;

        // Get world position under pointer
        const worldPos = this.getWorldPositionFromScreen(event.clientX, event.clientY);
        if (!worldPos) return;

        // Calculate raw new position (apply offset)
        let newX = worldPos.x - this.dragOffset.x;
        let newZ = worldPos.z - this.dragOffset.z;

        // ================================================================
        // FINE POSITIONING MODES
        // ================================================================
        // Apply drag speed multiplier for precise positioning
        // - Shift: 20% speed (fine)
        // - Ctrl: 5% speed (ultra-fine)

        if (event.ctrlKey || event.shiftKey) {
            // Calculate delta from current position
            const deltaX = newX - model.position.x;
            const deltaZ = newZ - model.position.z;

            // Apply speed multiplier
            const speedMultiplier = event.ctrlKey ? 0.05 : 0.20;

            // Apply reduced delta
            newX = model.position.x + (deltaX * speedMultiplier);
            newZ = model.position.z + (deltaZ * speedMultiplier);
        }

        // Move the model (keep same Y - preserves correct placement height)
        this.config.modelSystem.moveModel(
            this.draggedModelId,
            new Vector3(newX, model.position.y, newZ)
        );
    }

    // ========================================================================
    // MODEL CLICK HANDLING
    // ========================================================================

    /**
     * Handle click on models for selection
     * Extended to check for trains and also select/deselect in ScaleManager
     * 
     * Click behavior:
     * - Click on train (no Shift) = Select for DRIVING (TrainSystem)
     * - Shift+Click on train = Select for REPOSITIONING (here)
     * - Click on other model = Select for manipulation (here)
     * 
     * @param event - Pointer event
     */
    private handleModelClick(event: PointerEvent): void {
        if (!this.config.modelSystem) return;

        // Skip if track is selected
        const trackSelected = (window as any).__trackPieceSelected === true;
        if (trackSelected) return;

        // Check what we clicked on
        const pickResult = this.scene.pick(event.clientX, event.clientY);

        if (pickResult?.hit && pickResult.pickedMesh) {
            // ----------------------------------------------------------------
            // Check if this is a registered train using window.trainSystem
            // ----------------------------------------------------------------
            const trainSystem = (window as any).trainSystem;

            if (trainSystem) {
                const trainController = trainSystem.findTrainByMesh?.(pickResult.pickedMesh);

                if (trainController) {
                    if (!event.shiftKey) {
                        // Normal click on train = DRIVE mode
                        console.log(`${LOG_PREFIX} Train click (no Shift) - selecting for DRIVING`);
                        trainController.select();
                        return;
                    }
                    // Shift+Click = REPOSITION mode
                    console.log(`${LOG_PREFIX} Shift+Click on train - selecting for REPOSITIONING`);
                    trainSystem.deselectTrain?.();
                    // Continue to select for repositioning below
                }
            }

            // Fallback check using getTrainClickBehavior
            const trainBehavior = getTrainClickBehavior(pickResult.pickedMesh, event);
            if (trainBehavior.isTrain && !event.shiftKey) {
                console.log(`${LOG_PREFIX} Unregistered train click - ignoring`);
                return;
            }

            // ----------------------------------------------------------------
            // Check if this mesh belongs to a placed model
            // ----------------------------------------------------------------
            const placedModelId = this.config.modelSystem.getPlacedModelIdFromMesh(pickResult.pickedMesh);

            if (placedModelId) {
                this.selectModel(placedModelId);
            } else {
                this.deselectModel();
            }
        } else {
            // Clicked on nothing - deselect
            this.deselectModel();
        }
    }

    // ========================================================================
    // SELECTION HELPERS
    // ========================================================================

    /**
     * Select a model by ID
     * Updates ModelSystem, ScaleManager, and SidebarScaleControls
     * 
     * @param modelId - ID of model to select
     */
    private selectModel(modelId: string): void {
        if (!this.config.modelSystem) return;

        // Select this model in ModelSystem (visual highlight)
        this.config.modelSystem.selectModel(modelId);
        (window as any).__modelSelected = true;

        // Select in ScaleManager (shows gizmo)
        const hasAdapter = this.config.hasScalableAdapter?.(modelId) ?? false;
        if (this.config.scaleManager && hasAdapter) {
            this.config.scaleManager.selectObject(modelId);

            // Notify SidebarScaleControls with height offset
            const adapterInfo = this.config.getScalableAdapterInfo?.(modelId);
            const heightOffset = this.config.getModelHeightOffset?.(modelId) ?? 0;

            if (this.config.sidebarScaleControls && adapterInfo) {
                this.config.sidebarScaleControls.onObjectSelected(
                    modelId,
                    adapterInfo.currentScale,
                    adapterInfo.scaleLocked,
                    heightOffset
                );
            }
        }

        // Log selection
        const model = this.config.modelSystem.getPlacedModel(modelId);
        console.log(`${LOG_PREFIX} Selected model: ${modelId}`, model ? '' : '(not found)');
    }

    /**
     * Deselect the current model
     * Updates ModelSystem, ScaleManager, and SidebarScaleControls
     */
    private deselectModel(): void {
        if (this.config.modelSystem) {
            this.config.modelSystem.deselectModel();
        }
        (window as any).__modelSelected = false;

        // Deselect from ScaleManager (hides gizmo)
        if (this.config.scaleManager) {
            this.config.scaleManager.deselectObject();
        }

        // Notify SidebarScaleControls
        this.config.sidebarScaleControls?.onObjectDeselected();
    }

    // ========================================================================
    // KEYBOARD SHORTCUTS
    // ========================================================================

    /**
     * Setup keyboard shortcuts for model manipulation
     */
    private setupKeyboardShortcuts(): void {
        this.boundKeyboardHandler = (event: KeyboardEvent) => {
            this.handleKeyDown(event);
        };

        this.boundWheelHandler = (event: WheelEvent) => {
            this.handleWheel(event);
        };

        window.addEventListener('keydown', this.boundKeyboardHandler);
        window.addEventListener('wheel', this.boundWheelHandler, { passive: false });

        console.log(`${LOG_PREFIX} ✓ Keyboard shortcuts configured`);
    }

    /**
     * Handle keydown events for model manipulation
     * @param event - Keyboard event
     */
    private handleKeyDown(event: KeyboardEvent): void {
        // Skip if typing in an input field
        if (event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLTextAreaElement ||
            event.target instanceof HTMLSelectElement) {
            return;
        }

        // Skip if model system not ready
        if (!this.config.modelSystem) return;

        // Skip if in track placement mode
        if (this.config.trackPlacer?.isInPlacementMode()) return;

        // Skip if track piece is selected
        const trackSelected = (window as any).__trackPieceSelected === true;

        // Get selected model
        const selectedModel = this.config.modelSystem.getSelectedModel();

        switch (event.key) {
            // ============================================================
            // ROTATION - [ and ] keys
            // Ctrl = 1°, Normal = 5°, Shift = 22.5°
            // ============================================================
            case '[':
                if (selectedModel && !trackSelected) {
                    event.preventDefault();
                    const angle = event.ctrlKey ? -1 : (event.shiftKey ? -22.5 : -5);
                    this.config.modelSystem.rotateModel(selectedModel.id, angle);
                }
                break;

            case ']':
                if (selectedModel && !trackSelected) {
                    event.preventDefault();
                    const angle = event.ctrlKey ? 1 : (event.shiftKey ? 22.5 : 5);
                    this.config.modelSystem.rotateModel(selectedModel.id, angle);
                }
                break;

            // ============================================================
            // ARROW KEY NUDGING - Precise positioning
            // Normal: 5mm, Shift: 1mm, Ctrl: 0.5mm
            // ============================================================
            case 'ArrowUp':
                if (selectedModel && !trackSelected) {
                    event.preventDefault();
                    const nudge = event.ctrlKey ? 0.0005 : (event.shiftKey ? 0.001 : 0.005);
                    const pos = selectedModel.position;
                    this.config.modelSystem.moveModel(
                        selectedModel.id,
                        new Vector3(pos.x, pos.y, pos.z - nudge)
                    );
                }
                break;

            case 'ArrowDown':
                if (selectedModel && !trackSelected) {
                    event.preventDefault();
                    const nudge = event.ctrlKey ? 0.0005 : (event.shiftKey ? 0.001 : 0.005);
                    const pos = selectedModel.position;
                    this.config.modelSystem.moveModel(
                        selectedModel.id,
                        new Vector3(pos.x, pos.y, pos.z + nudge)
                    );
                }
                break;

            case 'ArrowLeft':
                if (selectedModel && !trackSelected) {
                    event.preventDefault();
                    const nudge = event.ctrlKey ? 0.0005 : (event.shiftKey ? 0.001 : 0.005);
                    const pos = selectedModel.position;
                    this.config.modelSystem.moveModel(
                        selectedModel.id,
                        new Vector3(pos.x - nudge, pos.y, pos.z)
                    );
                }
                break;

            case 'ArrowRight':
                if (selectedModel && !trackSelected) {
                    event.preventDefault();
                    const nudge = event.ctrlKey ? 0.0005 : (event.shiftKey ? 0.001 : 0.005);
                    const pos = selectedModel.position;
                    this.config.modelSystem.moveModel(
                        selectedModel.id,
                        new Vector3(pos.x + nudge, pos.y, pos.z)
                    );
                }
                break;

            // ============================================================
            // DELETE - Remove selected model
            // ============================================================
            case 'Delete':
            case 'Backspace':
                if (selectedModel && !trackSelected) {
                    event.preventDefault();
                    this.config.onDeleteModel?.(selectedModel.id);
                }
                break;

            // ============================================================
            // ESCAPE - Deselect
            // ============================================================
            case 'Escape':
                if (selectedModel) {
                    event.preventDefault();
                    this.deselectModel();
                }
                break;

            // ============================================================
            // HEIGHT ADJUSTMENT - Page Up/Down
            // Normal: 5mm, Shift: 1mm
            // ============================================================
            case 'PageUp':
                if (selectedModel && !trackSelected) {
                    event.preventDefault();
                    const step = event.shiftKey ? 1 : 5;
                    this.config.sidebarScaleControls?.adjustHeight(step);
                }
                break;

            case 'PageDown':
                if (selectedModel && !trackSelected) {
                    event.preventDefault();
                    const step = event.shiftKey ? -1 : -5;
                    this.config.sidebarScaleControls?.adjustHeight(step);
                }
                break;

            // ============================================================
            // RESET SCALE - R key
            // ============================================================
            case 'r':
            case 'R':
                // Don't reset if train is selected (R = reverse for trains)
                if ((window as any).__trainSelected) {
                    return;
                }
                if (selectedModel && !trackSelected && this.config.scaleManager) {
                    event.preventDefault();
                    this.config.scaleManager.resetScale(selectedModel.id);
                }
                break;

            // ============================================================
            // LOCK/UNLOCK SCALE - L key
            // ============================================================
            case 'l':
            case 'L':
                if (selectedModel && !trackSelected && this.config.scaleManager) {
                    event.preventDefault();
                    this.config.scaleManager.toggleScaleLock(selectedModel.id);
                }
                break;
        }
    }

    /**
     * Handle scroll wheel for scaling and height adjustment
     * @param event - Wheel event
     */
    private handleWheel(event: WheelEvent): void {
        const selectedModel = this.config.modelSystem?.getSelectedModel();
        if (!selectedModel) return;

        const trackSelected = (window as any).__trackPieceSelected === true;
        if (trackSelected) return;

        // S + Scroll = Scale (multiplicative ~1% per notch)
        if (!event.shiftKey && this.isKeyHeld('s')) {
            event.preventDefault();
            const factor = event.deltaY < 0 ? 1.01 : (1 / 1.01);
            this.config.scaleManager?.multiplyScale(selectedModel.id, factor);
            return;
        }

        // Shift + S + Scroll = Fine scale (multiplicative ~0.1% per notch)
        if (event.shiftKey && this.isKeyHeld('s')) {
            event.preventDefault();
            const factor = event.deltaY < 0 ? 1.001 : (1 / 1.001);
            this.config.scaleManager?.multiplyScale(selectedModel.id, factor);
            return;
        }

        // H + Scroll = Height adjustment
        if (this.isKeyHeld('h')) {
            event.preventDefault();
            const sensitivity = event.shiftKey ? 1 : 5;
            const delta = event.deltaY < 0 ? sensitivity : -sensitivity;
            this.config.sidebarScaleControls?.adjustHeight(delta);
        }
    }

    // ========================================================================
    // MESH PICKING HELPERS
    // ========================================================================

    /**
     * Pick a mesh at screen coordinates
     * Used for train detection before model detection
     * 
     * @param x - Screen X coordinate
     * @param y - Screen Y coordinate
     * @returns The picked mesh or null
     */
    private pickMeshAtScreenPosition(x: number, y: number): AbstractMesh | null {
        try {
            const camera = this.scene.activeCamera;
            if (!camera) return null;

            const ray = this.scene.createPickingRay(x, y, null, camera);
            if (!ray) return null;

            const pickResult = this.scene.pickWithRay(ray);
            return pickResult?.pickedMesh || null;

        } catch (error) {
            console.error(`${LOG_PREFIX} Error picking mesh:`, error);
            return null;
        }
    }

    /**
     * Pick a model at screen position
     * Returns the placed model ID if a model was clicked
     * 
     * @param x - Screen X coordinate
     * @param y - Screen Y coordinate
     * @returns Placed model ID or null
     */
    private pickModelAtPosition(x: number, y: number): string | null {
        if (!this.config.modelSystem) return null;

        const pickResult = this.scene.pick(x, y);
        if (pickResult?.hit && pickResult.pickedMesh) {
            return this.config.modelSystem.getPlacedModelIdFromMesh(pickResult.pickedMesh);
        }
        return null;
    }

    /**
     * Get world position from screen coordinates
     * Projects onto the baseboard plane
     * 
     * @param screenX - Screen X coordinate
     * @param screenY - Screen Y coordinate
     * @returns World position or null
     */
    private getWorldPositionFromScreen(screenX: number, screenY: number): Vector3 | null {
        const camera = this.scene.activeCamera;
        if (!camera) return null;

        // Create a ray from the camera through the screen point
        const ray = this.scene.createPickingRay(screenX, screenY, null, camera);

        // Intersect with baseboard plane (Y = BASEBOARD_TOP)
        const planeY = SURFACE_HEIGHTS.BASEBOARD_TOP;

        if (Math.abs(ray.direction.y) < 0.0001) {
            return null; // Ray parallel to plane
        }

        const t = (planeY - ray.origin.y) / ray.direction.y;
        if (t < 0) {
            return null; // Intersection behind camera
        }

        return ray.origin.add(ray.direction.scale(t));
    }

    // ========================================================================
    // CAMERA CONTROL HELPERS
    // ========================================================================

    /**
     * Disable camera controls during drag
     * Uses centralized helper to prevent conflicts with other systems
     */
    private disableCameraControls(): void {
        setCameraControlsEnabled(this.scene, false, undefined, 'ModelDrag');
    }

    /**
     * Enable camera controls after drag
     * Uses centralized helper to prevent conflicts with other systems
     */
    private enableCameraControls(): void {
        const canvas = this.scene.getEngine().getRenderingCanvas();
        setCameraControlsEnabled(this.scene, true, canvas, 'ModelDrag');
    }

    // ========================================================================
    // PUBLIC METHODS
    // ========================================================================

    /**
     * Check if currently dragging a model
     * @returns True if dragging
     */
    isDragging(): boolean {
        return this.isDraggingModel;
    }

    /**
     * Get the currently dragged model ID
     * @returns Model ID or null
     */
    getDraggedModelId(): string | null {
        return this.draggedModelId;
    }

    // ========================================================================
    // DISPOSAL
    // ========================================================================

    /**
     * Clean up all resources and event listeners
     */
    dispose(): void {
        console.log(`${LOG_PREFIX} Disposing...`);

        // Get canvas for removing event listeners
        const canvas = this.scene.getEngine().getRenderingCanvas();

        // Remove pointer event listeners
        if (canvas) {
            if (this.boundPointerDown) {
                canvas.removeEventListener('pointerdown', this.boundPointerDown);
            }
            if (this.boundPointerMove) {
                canvas.removeEventListener('pointermove', this.boundPointerMove);
            }
            if (this.boundPointerUp) {
                canvas.removeEventListener('pointerup', this.boundPointerUp);
            }
        }

        // Remove keyboard/wheel listeners
        if (this.boundKeyboardHandler) {
            window.removeEventListener('keydown', this.boundKeyboardHandler);
        }
        if (this.boundWheelHandler) {
            window.removeEventListener('wheel', this.boundWheelHandler);
        }

        // Clear references
        this.boundPointerDown = null;
        this.boundPointerMove = null;
        this.boundPointerUp = null;
        this.boundKeyboardHandler = null;
        this.boundWheelHandler = null;

        // Clear state
        this.isDraggingModel = false;
        this.draggedModelId = null;
        this.dragOffset = null;
        this.pointerDownPos = null;
        this.heldKeys.clear();

        console.log(`${LOG_PREFIX} ✓ Disposed`);
    }
}