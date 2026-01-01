/**
 * ModelImportButton.ts - Simple floating import button with track placement
 * 
 * Path: frontend/src/ui/ModelImportButton.ts
 * 
 * A standalone floating button that opens the model import dialog.
 * For rolling stock, requires placement on track.
 * 
 * Now includes WorldOutliner integration:
 * - Models automatically appear in the outliner when placed
 * - Deleting from outliner removes the 3D model
 * - Deleting the 3D model removes from outliner
 * 
 * Now includes UE5-style Scaling System:
 * - Drag gizmo corners to scale uniformly
 * - Hold S + scroll mouse wheel to scale
 * - Shift+S + scroll for fine adjustment
 * - R to reset scale to original
 * - L to lock/unlock scale
 * - TransformPanel for numeric input and presets
 * 
 * UPDATED: Train Selection Mode
 * - Click on train = Defers to TrainSystem for DRIVING controls
 * - Shift+Click on train = Selects for REPOSITIONING (drag, rotate, etc.)
 * 
 * UPDATED: TrainSystem Registration
 * - Rolling stock is now automatically registered with TrainSystem after placement
 * - Enables driving controls (throttle, direction, brake, horn)
 * 
 * Train Orientation Fix:
 * - If trains face sideways on track, use browser console:
 *   window.setTrainOrientation('NEG_Y')  // For Blender exports
 *   window.setTrainOrientation('POS_X')  // For some CAD exports
 *   window.trainOrientationHelp()        // Show all options
 * 
 * @module ModelImportButton
 * @author Model Railway Workbench
 * @version 2.3.0 - Added automatic TrainSystem registration
 */

// ============================================================================
// IMPORTS
// ============================================================================

import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { ModelSystem, type PlacedModel } from '../systems/models/ModelSystem';
import { ModelLibrary, type ModelLibraryEntry, type ModelCategory } from '../systems/models/ModelLibrary';
import { TrackModelPlacer, registerOrientationTester } from '../systems/models/TrackModelPlacer';
import { ModelImportDialog } from './ModelImportDialog';
import type { WorldOutliner } from '../systems/outliner/WorldOutliner';
import type { OutlinerNodeType } from '../types/outliner.types';

// ============================================================================
// SCALING SYSTEM IMPORTS
// ============================================================================

import { ScaleManager } from '../systems/scaling/ScaleManager';
import { ScalableModelAdapter } from '../systems/scaling/ScalableModelAdapter';
import { SidebarScaleControls } from './components/SidebarScaleControls';
import type { IScalable, ScalableAssetCategory } from '../types/scaling.types';
import {
    GaugeScaleCalculator,
    getGlobalGaugeCalculator,
    registerGaugeCalculatorConsoleUtils
} from '../systems/scaling/GaugeScaleCalculator';

// ============================================================================
// TRAIN DETECTION IMPORT
// ============================================================================

import {
    isTrainMesh,
    getTrainClickBehavior,
    type TrainClickBehavior
} from '../systems/train/TrainMeshDetector';

// ============================================================================
// CAMERA CONTROL HELPER IMPORT
// ============================================================================

import { setCameraControlsEnabled } from '../utils/CameraControlHelper';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[ModelImportButton]';

/** Categories that require track placement */
const TRACK_PLACEMENT_CATEGORIES = ['rolling_stock'];

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

/** Map ModelCategory to ScalableAssetCategory */
const CATEGORY_MAP: Record<string, ScalableAssetCategory> = {
    'locomotive': 'rolling-stock',
    'coach': 'rolling-stock',
    'wagon': 'rolling-stock',
    'rolling_stock': 'rolling-stock',
    'building': 'building',
    'scenery': 'scenery',
    'figure': 'figure',
    'vehicle': 'vehicle',
    'accessory': 'accessory',
    'other': 'other'
};

// ============================================================================
// MODEL IMPORT BUTTON CLASS
// ============================================================================

/**
 * ModelImportButton - Floating button for model import with track placement
 * 
 * @example
 * ```typescript
 * const button = new ModelImportButton(scene);
 * await button.initialize();
 * 
 * // Connect outliner
 * button.setWorldOutliner(worldOutliner);
 * ```
 */
export class ModelImportButton {
    // ========================================================================
    // CORE PROPERTIES
    // ========================================================================

    /** Babylon scene reference */
    private scene: Scene;

    /** Model library singleton */
    private library: ModelLibrary;

    /** Model system for placing models */
    private modelSystem: ModelSystem | null = null;

    /** Track placer for rolling stock */
    private trackPlacer: TrackModelPlacer | null = null;

    /** WorldOutliner reference for bidirectional sync */
    private worldOutliner: WorldOutliner | null = null;

    // ========================================================================
    // UI ELEMENTS
    // ========================================================================

    /** Floating button element */
    private button: HTMLButtonElement | null = null;

    /** Status display element */
    private statusDisplay: HTMLElement | null = null;

    // ========================================================================
    // SCALING SYSTEM PROPERTIES
    // ========================================================================

    /** Scale manager - central coordinator */
    private scaleManager: ScaleManager | null = null;

    /** Sidebar scale controls element */
    private sidebarScaleControls: SidebarScaleControls | null = null;

    /** Map of model IDs to their scalable adapters */
    private scalableAdapters: Map<string, ScalableModelAdapter> = new Map();

    /** Height offsets for each model (for lifting above baseboard) */
    private modelHeightOffsets: Map<string, number> = new Map();

    /** Gauge calculator for automatic rolling stock scaling */
    private gaugeCalculator: GaugeScaleCalculator;

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

    /** Bound pointer down handler */
    private boundPointerDown: ((event: PointerEvent) => void) | null = null;

    /** Bound pointer up handler */
    private boundPointerUp: ((event: PointerEvent) => void) | null = null;

    /** Bound pointer move handler */
    private boundPointerMove: ((event: PointerEvent) => void) | null = null;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new ModelImportButton
     * @param scene - Babylon.js scene
     */
    constructor(scene: Scene) {
        if (!scene) {
            throw new Error(`${LOG_PREFIX} Scene is required`);
        }
        this.scene = scene;
        this.library = ModelLibrary.getInstance();

        // Initialize gauge calculator for automatic rolling stock scaling
        this.gaugeCalculator = getGlobalGaugeCalculator();

        console.log(`${LOG_PREFIX} Created`);
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the button, model system, and scaling system
     * Call this after scene is ready
     * 
     * NOTE: This method is async due to ScaleManager initialization
     */
    async initialize(): Promise<void> {
        console.log(`${LOG_PREFIX} Initializing...`);

        try {
            // ----------------------------------------------------------------
            // Initialize Model System
            // ----------------------------------------------------------------
            this.modelSystem = new ModelSystem(this.scene, null);
            this.modelSystem.initialize();
            console.log(`${LOG_PREFIX} ✓ ModelSystem initialized`);

            // ----------------------------------------------------------------
            // Initialize Track Model Placer
            // ----------------------------------------------------------------
            this.trackPlacer = new TrackModelPlacer(this.scene);
            this.trackPlacer.initialize();
            console.log(`${LOG_PREFIX} ✓ TrackModelPlacer initialized`);

            // ----------------------------------------------------------------
            // Initialize Scale Manager
            // ----------------------------------------------------------------
            this.scaleManager = new ScaleManager(this.scene);
            await this.scaleManager.initialize();
            console.log(`${LOG_PREFIX} ✓ ScaleManager initialized`);

            // ----------------------------------------------------------------
            // Initialize Sidebar Scale Controls
            // ----------------------------------------------------------------
            this.sidebarScaleControls = new SidebarScaleControls();
            this.sidebarScaleControls.setScaleManager(this.scaleManager);
            this.sidebarScaleControls.setHeightChangeCallback((objectId, heightOffset) => {
                this.setModelHeightOffset(objectId, heightOffset);
            });
            console.log(`${LOG_PREFIX} ✓ SidebarScaleControls initialized`);

            // ----------------------------------------------------------------
            // Create UI Elements (hidden button, status display)
            // ----------------------------------------------------------------
            this.createButton();
            this.createStatusDisplay();

            // ----------------------------------------------------------------
            // Register orientation test utility (for debugging train orientation)
            // ----------------------------------------------------------------
            if (this.trackPlacer) {
                registerOrientationTester(this.trackPlacer);
            }

            // ----------------------------------------------------------------
            // Register gauge calculator console utilities
            // ----------------------------------------------------------------
            registerGaugeCalculatorConsoleUtils();
            console.log(`${LOG_PREFIX} ✓ Gauge calculator console utils registered`);

            // ----------------------------------------------------------------
            // Listen for library changes to update status
            // ----------------------------------------------------------------
            this.library.onChange(() => {
                this.updateStatusDisplay();
            });

            // ----------------------------------------------------------------
            // Setup keyboard shortcuts for model rotation
            // ----------------------------------------------------------------
            this.setupKeyboardShortcuts();

            // ----------------------------------------------------------------
            // Setup click-to-select for placed models
            // ----------------------------------------------------------------
            this.setupModelSelection();

            console.log(`${LOG_PREFIX} ✓ Initialized successfully`);
            this.logControls();

        } catch (error) {
            console.error(`${LOG_PREFIX} Initialization failed:`, error);
            throw error;
        }
    }

    /**
     * Log all available controls to the console
     */
    private logControls(): void {
        console.log('');
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║              MODEL & TRANSFORM CONTROLS                    ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log('║  Click model        → Select it                            ║');
        console.log('║  Click train        → Select for DRIVING (TrainSystem)     ║');
        console.log('║  Shift+Click train  → Select for REPOSITIONING             ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log('║  POSITIONING:                                              ║');
        console.log('║  Drag model         → Move it (XZ plane)                   ║');
        console.log('║  Shift + Drag       → Fine positioning (20% speed)         ║');
        console.log('║  Ctrl + Drag        → Ultra-fine positioning (5% speed)    ║');
        console.log('║  Arrow keys         → Nudge ±5mm                           ║');
        console.log('║  Shift + Arrows     → Fine nudge ±1mm                      ║');
        console.log('║  Ctrl + Arrows      → Ultra-fine nudge ±0.5mm              ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log('║  SCALING (multiplicative - precise percentage control):    ║');
        console.log('║  S + Scroll         → Scale ×1.01 / ÷1.01 (~1%)            ║');
        console.log('║  Shift+S + Scroll   → Fine ×1.001 / ÷1.001 (~0.1%)         ║');
        console.log('║  Drag gizmo corner  → Scale uniformly                      ║');
        console.log('║  R                  → Reset to original scale              ║');
        console.log('║  L                  → Lock/unlock scaling                  ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log('║  HEIGHT:                                                   ║');
        console.log('║  H + Scroll         → Adjust height ±5mm                   ║');
        console.log('║  Shift+H + Scroll   → Fine height ±1mm                     ║');
        console.log('║  PageUp / PageDown  → Height ±5mm                          ║');
        console.log('║  Shift+PgUp/PgDn    → Height ±1mm (fine)                   ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log('║  ROTATION:                                                 ║');
        console.log('║  [ / ]              → Rotate ±5°                           ║');
        console.log('║  Ctrl + [ / ]       → Fine rotate ±1°                      ║');
        console.log('║  Shift + [ / ]      → Rotate ±22.5°                        ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log('║  Delete             → Remove selected model                ║');
        console.log('║  Escape             → Deselect                             ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log('║  🚂 ROLLING STOCK: Auto-scaled to OO gauge (16.5mm)        ║');
        console.log('║     Use S+Scroll to fine-tune after placement              ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log('║  Console: showOOSpecs() → Show OO gauge specifications     ║');
        console.log('║  Console: calculateOOScale(widthMm) → Calculate scale      ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log('');
    }

    // ========================================================================
    // UI CREATION
    // ========================================================================

    /**
     * Create the floating import button (hidden by default)
     */
    private createButton(): void {
        this.button = document.createElement('button');
        this.button.id = 'model-import-button';
        this.button.textContent = '📦 Import Model';
        this.button.title = 'Import 3D Model (GLB/GLTF)';

        // Style the button
        Object.assign(this.button.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: 'bold',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            zIndex: '1000',
            display: 'none' // Hidden - use sidebar instead
        });

        // Hover effect
        this.button.addEventListener('mouseenter', () => {
            if (this.button) {
                this.button.style.backgroundColor = '#45a049';
            }
        });

        this.button.addEventListener('mouseleave', () => {
            if (this.button) {
                this.button.style.backgroundColor = '#4CAF50';
            }
        });

        // Click handler
        this.button.addEventListener('click', () => {
            this.showImportDialog();
        });

        document.body.appendChild(this.button);
    }

    /**
     * Create status display showing library count
     */
    private createStatusDisplay(): void {
        this.statusDisplay = document.createElement('div');
        this.statusDisplay.id = 'model-status-display';

        Object.assign(this.statusDisplay.style, {
            position: 'fixed',
            bottom: '70px',
            right: '20px',
            padding: '8px 12px',
            fontSize: '12px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: '#aaa',
            borderRadius: '4px',
            zIndex: '999',
            display: 'none' // Hidden by default
        });

        document.body.appendChild(this.statusDisplay);
        this.updateStatusDisplay();
    }

    /**
     * Update the status display with current counts
     */
    private updateStatusDisplay(): void {
        if (!this.statusDisplay) return;

        const libraryCount = this.library.getAllModels().length;
        const placedCount = this.modelSystem?.getPlacedModelCount() || 0;

        this.statusDisplay.textContent = `Library: ${libraryCount} | Placed: ${placedCount}`;
    }

    // ========================================================================
    // KEYBOARD SHORTCUTS
    // ========================================================================

    /**
     * Setup keyboard shortcuts for model manipulation
     */
    private setupKeyboardShortcuts(): void {
        window.addEventListener('keydown', (event: KeyboardEvent) => {
            // Skip if typing in an input field
            if (event.target instanceof HTMLInputElement ||
                event.target instanceof HTMLTextAreaElement ||
                event.target instanceof HTMLSelectElement) {
                return;
            }

            // Skip if model system not ready
            if (!this.modelSystem) return;

            // Skip if in track placement mode
            if (this.trackPlacer?.isInPlacementMode()) return;

            // Skip if track piece is selected
            const trackSelected = (window as any).__trackPieceSelected === true;

            // Get selected model
            const selectedModel = this.modelSystem.getSelectedModel();

            switch (event.key) {
                // Rotate left
                // Ctrl = 1°, Normal = 5°, Shift = 22.5°
                case '[':
                    if (selectedModel && !trackSelected) {
                        event.preventDefault();
                        const angle = event.ctrlKey ? -1 : (event.shiftKey ? -22.5 : -5);
                        this.modelSystem.rotateModel(selectedModel.id, angle);
                    }
                    break;

                // Rotate right
                // Ctrl = 1°, Normal = 5°, Shift = 22.5°
                case ']':
                    if (selectedModel && !trackSelected) {
                        event.preventDefault();
                        const angle = event.ctrlKey ? 1 : (event.shiftKey ? 22.5 : 5);
                        this.modelSystem.rotateModel(selectedModel.id, angle);
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
                        this.modelSystem.moveModel(selectedModel.id, new Vector3(pos.x, pos.y, pos.z - nudge));
                    }
                    break;

                case 'ArrowDown':
                    if (selectedModel && !trackSelected) {
                        event.preventDefault();
                        const nudge = event.ctrlKey ? 0.0005 : (event.shiftKey ? 0.001 : 0.005);
                        const pos = selectedModel.position;
                        this.modelSystem.moveModel(selectedModel.id, new Vector3(pos.x, pos.y, pos.z + nudge));
                    }
                    break;

                case 'ArrowLeft':
                    if (selectedModel && !trackSelected) {
                        event.preventDefault();
                        const nudge = event.ctrlKey ? 0.0005 : (event.shiftKey ? 0.001 : 0.005);
                        const pos = selectedModel.position;
                        this.modelSystem.moveModel(selectedModel.id, new Vector3(pos.x - nudge, pos.y, pos.z));
                    }
                    break;

                case 'ArrowRight':
                    if (selectedModel && !trackSelected) {
                        event.preventDefault();
                        const nudge = event.ctrlKey ? 0.0005 : (event.shiftKey ? 0.001 : 0.005);
                        const pos = selectedModel.position;
                        this.modelSystem.moveModel(selectedModel.id, new Vector3(pos.x + nudge, pos.y, pos.z));
                    }
                    break;

                // Delete selected model
                case 'Delete':
                case 'Backspace':
                    if (selectedModel && !trackSelected) {
                        event.preventDefault();
                        this.deleteModel(selectedModel.id);
                    }
                    break;

                // Deselect
                case 'Escape':
                    if (selectedModel) {
                        event.preventDefault();
                        this.modelSystem.deselectModel();
                        (window as any).__modelSelected = false;

                        // Deselect from ScaleManager (hides gizmo)
                        if (this.scaleManager) {
                            this.scaleManager.deselectObject();
                        }

                        // Notify SidebarScaleControls
                        this.sidebarScaleControls?.onObjectDeselected();
                    }
                    break;

                // Height adjustment - Page Up
                case 'PageUp':
                    if (selectedModel && !trackSelected) {
                        event.preventDefault();
                        const step = event.shiftKey ? 1 : 5;
                        this.sidebarScaleControls?.adjustHeight(step);
                    }
                    break;

                // Height adjustment - Page Down
                case 'PageDown':
                    if (selectedModel && !trackSelected) {
                        event.preventDefault();
                        const step = event.shiftKey ? -1 : -5;
                        this.sidebarScaleControls?.adjustHeight(step);
                    }
                    break;

                // Reset scale
                case 'r':
                case 'R':
                    // Only reset if not a shortcut conflict (e.g., train reverse)
                    // Check if a train is selected for driving
                    if ((window as any).__trainSelected) {
                        // Let TrainSystem handle 'R' for reverse
                        return;
                    }
                    if (selectedModel && !trackSelected && this.scaleManager) {
                        event.preventDefault();
                        this.scaleManager.resetScale(selectedModel.id);
                    }
                    break;

                // Lock/unlock scale
                case 'l':
                case 'L':
                    if (selectedModel && !trackSelected && this.scaleManager) {
                        event.preventDefault();
                        this.scaleManager.toggleScaleLock(selectedModel.id);
                    }
                    break;
            }
        });

        // Handle scroll wheel for scaling and height when S or H is held
        window.addEventListener('wheel', (event: WheelEvent) => {
            const selectedModel = this.modelSystem?.getSelectedModel();
            if (!selectedModel) return;

            const trackSelected = (window as any).__trackPieceSelected === true;
            if (trackSelected) return;

            // S + Scroll = Scale (multiplicative ~1% per notch)
            if (event.shiftKey === false && this.isKeyHeld('s')) {
                event.preventDefault();
                const factor = event.deltaY < 0 ? 1.01 : (1 / 1.01); // ~1% up or down
                this.scaleManager?.multiplyScale(selectedModel.id, factor);
                return;
            }

            // Shift + S + Scroll = Fine scale (multiplicative ~0.1% per notch)
            if (event.shiftKey && this.isKeyHeld('s')) {
                event.preventDefault();
                const factor = event.deltaY < 0 ? 1.001 : (1 / 1.001); // ~0.1% up or down
                this.scaleManager?.multiplyScale(selectedModel.id, factor);
                return;
            }

            // H + Scroll = Height adjustment
            if (this.isKeyHeld('h')) {
                event.preventDefault();
                const sensitivity = event.shiftKey ? 1 : 5;
                const delta = event.deltaY < 0 ? sensitivity : -sensitivity;
                this.sidebarScaleControls?.adjustHeight(delta);
            }
        }, { passive: false });

        console.log(`${LOG_PREFIX} Keyboard shortcuts configured`);
    }

    /** Track which keys are currently held */
    private heldKeys: Set<string> = new Set();

    /**
     * Check if a key is currently held
     */
    private isKeyHeld(key: string): boolean {
        return this.heldKeys.has(key.toLowerCase());
    }

    // Setup key tracking
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
    }

    // ========================================================================
    // MODEL SELECTION & DRAGGING
    // ========================================================================

    /**
     * Setup click-to-select and drag-to-move for placed models
     * 
     * UPDATED: Now checks for train meshes and defers to TrainSystem
     * when appropriate (regular click for driving, Shift+click for repositioning)
     */
    private setupModelSelection(): void {
        // Setup key tracking for held keys
        this.setupKeyTracking();

        // Get the canvas from the scene's engine
        const canvas = this.scene.getEngine().getRenderingCanvas();
        if (!canvas) {
            console.warn(`${LOG_PREFIX} No canvas found for model selection`);
            return;
        }

        // ----------------------------------------------------------------
        // Pointer Down - Start selection or drag
        // ----------------------------------------------------------------
        this.boundPointerDown = (event: PointerEvent) => {
            // Only handle left clicks
            if (event.button !== 0) return;

            // Skip if in track placement mode
            if (this.trackPlacer?.isInPlacementMode()) return;

            // Skip if track is selected (window flag set by InputManager)
            const trackSelected = (window as any).__trackPieceSelected === true;
            if (trackSelected) return;

            // Skip if a train was just selected by TrainSystem (for driving)
            // This flag is set by TrainSystem's handlePointerDown
            if ((window as any).__trainSelected === true) {
                console.log(`${LOG_PREFIX} Train selected for driving - skipping model selection`);
                return;
            }

            // Store pointer down position for drag detection
            this.pointerDownPos = { x: event.clientX, y: event.clientY };

            // ----------------------------------------------------------------
            // NEW: Check if clicking on a train mesh
            // ----------------------------------------------------------------
            const pickedMesh = this.pickMeshAtScreenPosition(event.clientX, event.clientY);

            if (pickedMesh) {
                // Check if this is a train mesh
                const trainBehavior = getTrainClickBehavior(pickedMesh, event);

                if (trainBehavior.isTrain) {
                    if (trainBehavior.shouldDrive) {
                        // Regular click (no Shift) on train
                        // TrainSystem should have already handled this via scene.onPointerObservable
                        // But if we somehow got here, defer anyway
                        console.log(`${LOG_PREFIX} Train clicked (no modifier) - deferring to TrainSystem for driving`);
                        this.pointerDownPos = null; // Cancel any pending interaction
                        return;
                    }

                    // Shift+Click on train - allow repositioning
                    console.log(`${LOG_PREFIX} Shift+Click on train - entering reposition mode`);
                    // Continue with normal model selection below
                }
            }

            // ----------------------------------------------------------------
            // Check if clicking on a placed model
            // ----------------------------------------------------------------
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
                        console.log(`${LOG_PREFIX} Ready to drag model`);
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

            // Don't start model drag if ScaleManager is dragging gizmo
            if (this.scaleManager?.isDragging()) return;

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

                    // Disable camera controls while dragging
                    this.disableCameraControls();

                    console.log(`${LOG_PREFIX} Started dragging model:`, selectedModel.id);
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

        console.log(`${LOG_PREFIX} Model selection configured`);
    }

    /**
     * Handle dragging a model
     * 
     * Supports fine positioning modes:
     * - Normal drag: 1:1 movement
     * - Shift + drag: 20% speed (fine positioning)
     * - Ctrl + drag: 5% speed (ultra-fine positioning)
     */
    private handleModelDrag(event: PointerEvent): void {
        if (!this.modelSystem || !this.draggedModelId || !this.dragOffset) return;

        const model = this.modelSystem.getPlacedModel(this.draggedModelId);
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
        this.modelSystem.moveModel(this.draggedModelId, new Vector3(newX, model.position.y, newZ));
    }

    /**
     * Handle click on models for selection
     * Extended to check for trains and also select/deselect in ScaleManager
     */
    private handleModelClick(event: PointerEvent): void {
        if (!this.modelSystem) return;

        // Skip if track is selected
        const trackSelected = (window as any).__trackPieceSelected === true;
        if (trackSelected) return;

        // Check what we clicked on
        const pickResult = this.scene.pick(event.clientX, event.clientY);

        if (pickResult?.hit && pickResult.pickedMesh) {
            // ----------------------------------------------------------------
            // NEW: Check if this is a train mesh
            // ----------------------------------------------------------------
            const trainBehavior = getTrainClickBehavior(pickResult.pickedMesh, event);

            if (trainBehavior.isTrain) {
                if (!event.shiftKey) {
                    // Normal click on train - should be handled by TrainSystem
                    console.log(`${LOG_PREFIX} Train click without Shift - ignoring (TrainSystem handles)`);
                    return;
                }
                // Shift+Click - continue to select for repositioning
                console.log(`${LOG_PREFIX} Shift+Click on train - selecting for repositioning`);
            }

            // ----------------------------------------------------------------
            // Check if this mesh belongs to a placed model
            // ----------------------------------------------------------------
            const placedModelId = this.modelSystem.getPlacedModelIdFromMesh(pickResult.pickedMesh);

            if (placedModelId) {
                // Select this model in ModelSystem (visual highlight)
                this.modelSystem.selectModel(placedModelId);
                (window as any).__modelSelected = true;

                // Select in ScaleManager (shows gizmo)
                if (this.scaleManager && this.scalableAdapters.has(placedModelId)) {
                    this.scaleManager.selectObject(placedModelId);

                    // Notify SidebarScaleControls with height offset
                    const adapter = this.scalableAdapters.get(placedModelId);
                    const heightOffset = this.getModelHeightOffset(placedModelId);
                    if (this.sidebarScaleControls && adapter) {
                        this.sidebarScaleControls.onObjectSelected(
                            placedModelId,
                            adapter.currentScale,
                            adapter.scaleLocked,
                            heightOffset
                        );
                    }
                }

                // Get model info for logging
                const model = this.modelSystem.getPlacedModel(placedModelId);
                const entry = model ? this.library.getModel(model.libraryId) : null;
                console.log(`${LOG_PREFIX} Selected model: ${entry?.name || placedModelId}`);
            } else {
                // Clicked on something else - deselect model
                this.modelSystem.deselectModel();
                (window as any).__modelSelected = false;

                // Deselect from ScaleManager (hides gizmo)
                if (this.scaleManager) {
                    this.scaleManager.deselectObject();
                }

                // Notify SidebarScaleControls
                this.sidebarScaleControls?.onObjectDeselected();
            }
        } else {
            // Clicked on nothing - deselect
            this.modelSystem.deselectModel();
            (window as any).__modelSelected = false;

            // Deselect from ScaleManager (hides gizmo)
            if (this.scaleManager) {
                this.scaleManager.deselectObject();
            }

            // Notify SidebarScaleControls
            this.sidebarScaleControls?.onObjectDeselected();
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
     */
    private pickModelAtPosition(x: number, y: number): string | null {
        if (!this.modelSystem) return null;

        const pickResult = this.scene.pick(x, y);
        if (pickResult?.hit && pickResult.pickedMesh) {
            return this.modelSystem.getPlacedModelIdFromMesh(pickResult.pickedMesh);
        }
        return null;
    }

    /**
     * Get world position from screen coordinates
     * Projects onto the baseboard plane
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
     * (InputManager, ScaleGizmo, TrainSystem all coordinate through the helper)
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
    // MODEL HEIGHT OFFSET
    // ========================================================================

    /**
     * Get the height offset for a model
     */
    private getModelHeightOffset(modelId: string): number {
        return this.modelHeightOffsets.get(modelId) || 0;
    }

    /**
     * Set the height offset for a model
     */
    private setModelHeightOffset(modelId: string, heightOffset: number): void {
        this.modelHeightOffsets.set(modelId, heightOffset);

        // Apply to the model
        const model = this.modelSystem?.getPlacedModel(modelId);
        if (model && this.modelSystem) {
            const baseY = SURFACE_HEIGHTS.BASEBOARD_TOP;
            const newY = baseY + (heightOffset / 1000); // Convert mm to meters
            this.modelSystem.moveModel(modelId, new Vector3(model.position.x, newY, model.position.z));
        }
    }

    // ========================================================================
    // MODEL DELETION
    // ========================================================================

    /**
     * Delete a model and clean up all associated resources
     */
    private deleteModel(modelId: string): void {
        console.log(`${LOG_PREFIX} Deleting model: ${modelId}`);

        // Remove from ScaleManager
        if (this.scaleManager) {
            this.scaleManager.deselectObject();
            this.scaleManager.unregisterObject(modelId);
        }

        // Remove adapter
        this.scalableAdapters.delete(modelId);

        // Remove height offset
        this.modelHeightOffsets.delete(modelId);

        // Remove from outliner
        if (this.worldOutliner) {
            this.worldOutliner.removeNode(modelId);
        }

        // Remove from model system
        if (this.modelSystem) {
            this.modelSystem.removeModel(modelId);
        }

        // Notify SidebarScaleControls
        this.sidebarScaleControls?.onObjectDeselected();

        // Update status display
        this.updateStatusDisplay();
    }

    // ========================================================================
    // IMPORT DIALOG
    // ========================================================================

    /**
     * Show the import dialog
     * 
     * After import, the model is:
     * - Rolling stock → User clicks on track to place (TrackModelPlacer)
     * - Other categories → Placed directly on baseboard centre
     */
    public showImportDialog(): void {
        if (!this.modelSystem) {
            console.error(`${LOG_PREFIX} Model system not ready`);
            return;
        }

        const dialog = new ModelImportDialog(this.scene, this.modelSystem);
        dialog.show(async (entry) => {
            if (entry) {
                console.log(`${LOG_PREFIX} Imported: ${entry.name}`);
                console.log(`${LOG_PREFIX}   Category: ${entry.category}`);
                this.updateStatusDisplay();

                // ============================================================
                // ROLLING STOCK: Click-to-place on track
                // ============================================================
                if (entry.category === 'rolling_stock' && this.trackPlacer) {
                    console.log(`${LOG_PREFIX} 🚂 Rolling stock - click on track to place`);

                    // Start track placement mode - user clicks on track
                    this.trackPlacer.startPlacement(async (result) => {
                        if (!result || !this.modelSystem) {
                            console.log(`${LOG_PREFIX} Placement cancelled`);
                            return;
                        }

                        try {
                            // Place the model on the track
                            const placedModel = await this.modelSystem.placeModel(entry, {
                                position: result.position,
                                rotationDeg: result.rotationDegrees
                            });

                            if (placedModel) {
                                console.log(`${LOG_PREFIX} ✓ Placed on track: ${entry.name}`);
                                console.log(`${LOG_PREFIX}   Position: ${result.position.toString()}`);
                                console.log(`${LOG_PREFIX}   Rotation: ${result.rotationDegrees.toFixed(1)}°`);

                                // Register with scaling system
                                this.registerModelForScaling(placedModel, entry.category);

                                // Register with WorldOutliner
                                this.registerModelWithOutliner(placedModel, entry);

                                // ============================================================
                                // REGISTER WITH TRAIN SYSTEM FOR DRIVING CONTROLS
                                // ============================================================
                                // Rolling stock needs to be registered with TrainSystem
                                // to enable driving controls (throttle, direction, brake, horn)
                                this.registerWithTrainSystem(placedModel, entry);

                                // Select it
                                this.modelSystem.selectModel(placedModel.id);
                                if (this.scaleManager) {
                                    this.scaleManager.selectObject(placedModel.id);
                                }
                            }
                        } catch (error) {
                            console.error(`${LOG_PREFIX} Track placement failed:`, error);
                        }
                    });
                    return;
                }

                // ============================================================
                // OTHER CATEGORIES: Place directly on baseboard
                // ============================================================
                console.log(`${LOG_PREFIX} 📦 Placing model on baseboard...`);

                try {
                    // Get baseboard surface position
                    const boardY = SURFACE_HEIGHTS.BASEBOARD_TOP;
                    const position = new Vector3(0, boardY, 0);

                    // Place the model
                    const placedModel = await this.modelSystem.placeModel(entry, { position });

                    if (placedModel) {
                        console.log(`${LOG_PREFIX} ✓ Placed: ${entry.name}`);
                        console.log(`${LOG_PREFIX}   Position: ${position.toString()}`);

                        // Register with scaling system
                        this.registerModelForScaling(placedModel, entry.category);

                        // Register with WorldOutliner
                        this.registerModelWithOutliner(placedModel, entry);

                        // Select it
                        this.modelSystem.selectModel(placedModel.id);
                        if (this.scaleManager) {
                            this.scaleManager.selectObject(placedModel.id);
                        }
                    }
                } catch (error) {
                    console.error(`${LOG_PREFIX} Failed to place model:`, error);
                }
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
    // MODEL REGISTRATION HELPERS
    // ========================================================================

    /**
     * Register a placed model with the scaling system
     * Creates a ScalableModelAdapter and registers with ScaleManager
     * 
     * For rolling stock, automatically calculates and applies gauge-correct scaling
     * 
     * @param placedModel - The placed model from ModelSystem
     * @param category - Model category for scale constraints
     */
    private registerModelForScaling(placedModel: PlacedModel, category: string): void {
        try {
            if (!this.scaleManager) {
                console.warn(`${LOG_PREFIX} ScaleManager not available for scaling registration`);
                return;
            }

            // Map category to scalable asset category
            const assetCategory = CATEGORY_MAP[category] || 'other';

            // Create adapter for the model with correct constructor parameters
            // ScalableModelAdapter expects (placedModel, modelCategory)
            const adapter = new ScalableModelAdapter(
                placedModel,
                category as ModelCategory
            );

            // Store adapter reference
            this.scalableAdapters.set(placedModel.id, adapter);

            // Calculate bounding radius from meshes for gizmo sizing
            const boundingRadius = this.calculateBoundingRadius(placedModel.meshes);

            // Register with scale manager - requires all 4 parameters:
            // (scalable, transformNode, meshes, boundingRadius)
            this.scaleManager.registerScalable(
                adapter,
                placedModel.rootNode,
                placedModel.meshes,
                boundingRadius
            );

            console.log(`${LOG_PREFIX} ✓ Registered for scaling: ${placedModel.id} (${assetCategory}, radius: ${boundingRadius.toFixed(2)})`);

            // ================================================================
            // AUTO GAUGE SCALING FOR ROLLING STOCK
            // ================================================================
            // Automatically calculate and apply correct scale for rolling stock
            // so all trains/coaches/wagons fit the OO gauge track correctly

            const isRollingStock = this.isRollingStockCategory(category);

            if (isRollingStock) {
                this.applyAutoGaugeScale(placedModel, adapter);
            }

        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to register for scaling:`, error);
        }
    }

    /**
     * Check if a category is rolling stock (needs gauge scaling)
     * 
     * @param category - Model category string
     * @returns True if this is rolling stock
     */
    private isRollingStockCategory(category: string): boolean {
        const rollingStockCategories = [
            'rolling_stock',
            'locomotive',
            'coach',
            'wagon',
            'carriage',
            'multiple_unit',
            'dmu',
            'emu'
        ];
        return rollingStockCategories.includes(category.toLowerCase());
    }

    /**
     * Apply automatic gauge-based scaling to rolling stock
     * 
     * Analyzes the model geometry and calculates the correct scale factor
     * to make it fit OO gauge track properly.
     * 
     * @param placedModel - The placed model
     * @param adapter - The scalable adapter for the model
     */
    private applyAutoGaugeScale(placedModel: PlacedModel, adapter: ScalableModelAdapter): void {
        try {
            console.log(`${LOG_PREFIX} 🚂 Auto gauge scaling for: ${placedModel.id}`);

            // Analyze the model and calculate correct scale
            const analysis = this.gaugeCalculator.analyzeAndCalculateScale(
                placedModel.meshes,
                placedModel.rootNode
            );

            if (!analysis.success) {
                console.warn(`${LOG_PREFIX} Gauge analysis failed: ${analysis.explanation}`);
                console.warn(`${LOG_PREFIX} Using default scale (1.0)`);
                return;
            }

            // Log the analysis results
            console.log(`${LOG_PREFIX} Gauge Analysis Results:`);
            console.log(`${LOG_PREFIX}   Measured width: ${(analysis.measuredWidthM * 1000).toFixed(2)}mm`);
            console.log(`${LOG_PREFIX}   Target width: ${(analysis.targetWidthM * 1000).toFixed(2)}mm`);
            console.log(`${LOG_PREFIX}   Scale factor: ${(analysis.scaleFactor * 100).toFixed(1)}% (${analysis.scaleFactor.toFixed(4)})`);
            console.log(`${LOG_PREFIX}   Confidence: ${(analysis.confidence * 100).toFixed(0)}%`);
            console.log(`${LOG_PREFIX}   Type: ${analysis.details.estimatedType}`);

            if (analysis.warnings.length > 0) {
                console.warn(`${LOG_PREFIX}   Warnings:`, analysis.warnings);
            }

            // Apply the calculated scale
            if (this.scaleManager && analysis.scaleFactor !== 1.0) {
                const result = this.scaleManager.setScale(placedModel.id, analysis.scaleFactor);

                if (result.success) {
                    console.log(`${LOG_PREFIX} ✓ Auto gauge scale applied: ${(analysis.scaleFactor * 100).toFixed(1)}%`);

                    // Show user feedback
                    this.showScaleNotification(
                        placedModel.id,
                        analysis.scaleFactor,
                        analysis.confidence,
                        analysis.details.estimatedType
                    );
                } else {
                    console.error(`${LOG_PREFIX} Failed to apply gauge scale:`, result.error);
                }
            }

        } catch (error) {
            console.error(`${LOG_PREFIX} Error in auto gauge scaling:`, error);
        }
    }

    /**
     * Show a brief notification about the auto-applied scale
     * 
     * @param modelId - ID of the scaled model
     * @param scaleFactor - Applied scale factor
     * @param confidence - Confidence of the calculation
     * @param modelType - Detected model type
     */
    private showScaleNotification(
        modelId: string,
        scaleFactor: number,
        confidence: number,
        modelType: string
    ): void {
        try {
            // Create notification element
            const notification = document.createElement('div');
            notification.id = 'gaugeScaleNotification';
            notification.style.cssText = `
                position: fixed;
                bottom: 80px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 100, 0, 0.9);
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                font-family: 'Segoe UI', Arial, sans-serif;
                font-size: 14px;
                z-index: 10000;
                pointer-events: none;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.2);
                transition: opacity 0.3s ease;
            `;

            const scalePercent = (scaleFactor * 100).toFixed(1);
            const confPercent = (confidence * 100).toFixed(0);

            notification.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 20px;">🚂</span>
                    <div>
                        <div style="font-weight: bold;">Auto-scaled to ${scalePercent}%</div>
                        <div style="font-size: 12px; opacity: 0.8;">
                            ${modelType} • ${confPercent}% confidence • Use S+Scroll to adjust
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(notification);

            // Fade out and remove after 4 seconds
            setTimeout(() => {
                notification.style.opacity = '0';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, 4000);

        } catch (error) {
            console.warn(`${LOG_PREFIX} Could not show scale notification:`, error);
        }
    }

    /**
     * Calculate bounding radius from an array of meshes
     * Used for scale gizmo sizing
     * 
     * @param meshes - Array of meshes to calculate bounds from
     * @returns Bounding radius (half of largest dimension)
     */
    private calculateBoundingRadius(meshes: AbstractMesh[]): number {
        if (!meshes || meshes.length === 0) {
            return 1.0; // Default fallback
        }

        try {
            let minX = Infinity, minY = Infinity, minZ = Infinity;
            let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

            for (const mesh of meshes) {
                if (mesh.getBoundingInfo) {
                    const bounds = mesh.getBoundingInfo().boundingBox;
                    minX = Math.min(minX, bounds.minimumWorld.x);
                    minY = Math.min(minY, bounds.minimumWorld.y);
                    minZ = Math.min(minZ, bounds.minimumWorld.z);
                    maxX = Math.max(maxX, bounds.maximumWorld.x);
                    maxY = Math.max(maxY, bounds.maximumWorld.y);
                    maxZ = Math.max(maxZ, bounds.maximumWorld.z);
                }
            }

            // Calculate dimensions
            const width = maxX - minX;
            const height = maxY - minY;
            const depth = maxZ - minZ;

            // Return half of the largest dimension as radius
            const maxDimension = Math.max(width, height, depth);
            return Math.max(maxDimension / 2, 0.1); // Minimum 0.1

        } catch (error) {
            console.warn(`${LOG_PREFIX} Error calculating bounding radius:`, error);
            return 1.0; // Fallback
        }
    }

    /**
     * Register a placed model with the WorldOutliner
     * Creates an outliner node for the model in the appropriate category folder
     * 
     * @param placedModel - The placed model from ModelSystem
     * @param entry - Library entry with model metadata
     */
    private registerModelWithOutliner(placedModel: PlacedModel, entry: ModelLibraryEntry): void {
        try {
            if (!this.worldOutliner) {
                console.warn(`${LOG_PREFIX} WorldOutliner not available for registration`);
                return;
            }

            // Determine outliner node type based on category
            let nodeType: OutlinerNodeType = 'model';
            if (entry.category === 'rolling_stock') {
                nodeType = 'rolling_stock';
            } else if (['scenery', 'buildings', 'vegetation', 'infrastructure'].includes(entry.category)) {
                nodeType = 'scenery';
            }

            // Create outliner node
            this.worldOutliner.createItem(
                entry.name,
                nodeType,
                placedModel.id,  // Scene object ID for bidirectional sync
                {
                    libraryId: entry.id,
                    category: entry.category
                }
            );

            console.log(`${LOG_PREFIX} ✓ Registered with outliner: ${entry.name} (${nodeType})`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to register with outliner:`, error);
        }
    }

    // ========================================================================
    // TRAIN SYSTEM REGISTRATION
    // ========================================================================

    /**
     * Register a placed rolling stock model with the TrainSystem
     * This enables driving controls (throttle, direction, brake, horn)
     * 
     * @param placedModel - The placed model instance
     * @param entry - Library entry with model info
     */
    private registerWithTrainSystem(placedModel: PlacedModel, entry: ModelLibraryEntry): void {
        // Only register rolling stock
        if (entry.category !== 'rolling_stock') {
            return;
        }

        // Use a small delay to ensure the model is fully in the scene
        setTimeout(() => {
            try {
                // Get the global trainSystem reference (set by App.ts)
                const trainSystem = (window as any).trainSystem;

                if (!trainSystem) {
                    console.warn(`${LOG_PREFIX} TrainSystem not available - train won't be driveable`);
                    console.warn(`${LOG_PREFIX}   Tip: Use Shift+T to manually register trains`);
                    return;
                }

                console.log(`${LOG_PREFIX} 🚂 Registering with TrainSystem...`);

                // Use registerExistingModel directly with the placed model's root node
                // This is safer and faster than scanAndRegisterTrains
                const controller = trainSystem.registerExistingModel(
                    placedModel.rootNode,
                    entry.name,
                    undefined,  // Let it auto-find the edge
                    0.5         // Middle of edge
                );

                if (controller) {
                    console.log(`${LOG_PREFIX} ✓ Registered as driveable train`);
                    console.log(`${LOG_PREFIX}   Click to select, use Arrow keys/WASD to drive`);
                } else {
                    console.warn(`${LOG_PREFIX} TrainSystem returned no controller`);
                    console.log(`${LOG_PREFIX}   Tip: Use Shift+T to manually register trains`);
                }

            } catch (error) {
                console.warn(`${LOG_PREFIX} Train registration failed:`, error);
                console.log(`${LOG_PREFIX}   Tip: Use Shift+T to manually register trains`);
            }
        }, 100);
    }

    // ========================================================================
    // WORLD OUTLINER INTEGRATION
    // ========================================================================

    /**
     * Set the WorldOutliner for bidirectional sync
     */
    setWorldOutliner(outliner: WorldOutliner): void {
        this.worldOutliner = outliner;
        console.log(`${LOG_PREFIX} WorldOutliner connected`);
    }

    // ========================================================================
    // PUBLIC ACCESSORS
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
     * Get the scale manager instance
     */
    getScaleManager(): ScaleManager | null {
        return this.scaleManager;
    }

    /**
     * Get the sidebar scale controls element for UIManager integration
     */
    getScaleControlsElement(): HTMLElement | null {
        return this.sidebarScaleControls?.getElement() || null;
    }

    /**
     * Get the sidebar scale controls instance
     */
    getSidebarScaleControls(): SidebarScaleControls | null {
        return this.sidebarScaleControls;
    }

    /**
     * Show/hide the button
     */
    setVisible(visible: boolean): void {
        if (this.button) {
            this.button.style.display = 'none'; // Always hidden - use sidebar
        }
        if (this.statusDisplay) {
            this.statusDisplay.style.display = visible ? 'block' : 'none';
        }
    }

    // ========================================================================
    // DISPOSAL
    // ========================================================================

    /**
     * Clean up all resources
     */
    dispose(): void {
        console.log(`${LOG_PREFIX} Disposing...`);

        // ----------------------------------------------------------------
        // Clear drag state
        // ----------------------------------------------------------------
        this.isDraggingModel = false;
        this.draggedModelId = null;
        this.dragOffset = null;

        // ----------------------------------------------------------------
        // Clear global flags
        // ----------------------------------------------------------------
        (window as any).__modelSelected = false;

        // ----------------------------------------------------------------
        // Remove UI elements
        // ----------------------------------------------------------------
        if (this.button) {
            this.button.remove();
            this.button = null;
        }

        if (this.statusDisplay) {
            this.statusDisplay.remove();
            this.statusDisplay = null;
        }

        // ----------------------------------------------------------------
        // Dispose sub-systems
        // ----------------------------------------------------------------
        if (this.trackPlacer) {
            this.trackPlacer.dispose();
            this.trackPlacer = null;
        }

        if (this.modelSystem) {
            this.modelSystem.dispose();
            this.modelSystem = null;
        }

        console.log(`${LOG_PREFIX} ✓ Disposed`);
    }
}