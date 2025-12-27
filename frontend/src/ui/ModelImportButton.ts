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
 * Train Orientation Fix:
 * - If trains face sideways on track, use browser console:
 *   window.setTrainOrientation('NEG_Y')  // For Blender exports
 *   window.setTrainOrientation('POS_X')  // For some CAD exports
 *   window.trainOrientationHelp()        // Show all options
 * 
 * FIX APPLIED (v1.4.0):
 * - Models now correctly place ON the baseboard surface (Y=0.95)
 * - Previously, non-rolling stock was placed at Y=0 (below baseboard)
 * - Added SURFACE_HEIGHTS constant for consistent height references
 * 
 * Usage in App.ts:
 *   import { ModelImportButton } from '../ui/ModelImportButton';
 *   
 *   // In initialize():
 *   const importButton = new ModelImportButton(this.scene);
 *   await importButton.initialize();  // NOTE: Now async!
 *   
 *   // Connect WorldOutliner after both are initialized:
 *   importButton.setWorldOutliner(worldOutliner);
 *   
 *   // Add scale controls to UIManager settings:
 *   const scaleElement = importButton.getScaleControlsElement();
 *   // Then append scaleElement to your settings section
 * 
 * @module ModelImportButton
 * @author Model Railway Workbench
 * @version 2.1.0 - Moved scale controls to sidebar settings
 */

// ============================================================================
// IMPORTS
// ============================================================================

import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
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
import { SidebarScaleControls } from './components/SidebarScaleControls';
import { ScalableModelAdapter } from '../systems/scaling/ScalableModelAdapter';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix for console output */
const LOG_PREFIX = '[ModelImportButton]';

/** Categories that require track placement */
const TRACK_PLACEMENT_CATEGORIES = ['rolling_stock'];

/** Small rotation angle in degrees */
const SMALL_ROTATION_DEG = 5;

/** Large rotation angle in degrees (with Shift) */
const LARGE_ROTATION_DEG = 22.5;

/**
 * Surface heights for model placement (in metres)
 * These MUST match the values in BaseboardSystem.ts and TrackRenderer.ts
 * 
 * FIX: This constant ensures all placement code uses consistent heights
 */
const SURFACE_HEIGHTS = {
    /** Height of baseboard surface from world origin (matches BaseboardSystem) */
    BASEBOARD_TOP: 0.950,

    /** Height offset for ballast/sleepers/rails above baseboard */
    RAIL_TOP_OFFSET: 0.008,

    /** Total height of rail surface from world origin */
    get RAIL_TOP_Y(): number {
        return this.BASEBOARD_TOP + this.RAIL_TOP_OFFSET;
    }
} as const;

/**
 * Map model categories to outliner node types
 */
const CATEGORY_TO_OUTLINER_TYPE: Record<string, OutlinerNodeType> = {
    'rolling_stock': 'rolling_stock',
    'locomotive': 'rolling_stock',
    'coach': 'rolling_stock',
    'wagon': 'rolling_stock',
    'scenery': 'scenery',
    'building': 'scenery',
    'buildings': 'scenery',
    'structure': 'scenery',
    'vegetation': 'scenery',
    'accessory': 'scenery',
    'accessories': 'scenery',
    'infrastructure': 'scenery',
    'vehicles': 'scenery',
    'figures': 'scenery',
    'custom': 'model',
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Model forward axis options (for train orientation)
 * Used to fix trains facing wrong direction on track
 */
type ModelForwardAxis = 'POS_X' | 'NEG_X' | 'POS_Y' | 'NEG_Y' | 'POS_Z' | 'NEG_Z';

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
 * 
 * Now includes full UE5-style scaling system with:
 * - Visual gizmo handles for drag-to-scale
 * - Numeric transform panel
 * - Hotkey + scroll scaling
 * - Per-asset-type presets and constraints
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

    /** World Outliner reference for scene hierarchy */
    private worldOutliner: WorldOutliner | null = null;

    /** Bound delete callback for cleanup */
    private boundDeleteCallback: ((nodeId: string, sceneObjectId: string | null, metadata: Record<string, unknown>) => void) | null = null;

    // ========================================================================
    // SCALING SYSTEM PROPERTIES
    // ========================================================================

    /** Scale manager - central coordinator for all scaling operations */
    private scaleManager: ScaleManager | null = null;

    /** Sidebar scale controls for UIManager integration */
    private sidebarScaleControls: SidebarScaleControls | null = null;

    /** Map of model IDs to their scalable adapters */
    private scalableAdapters: Map<string, ScalableModelAdapter> = new Map();

    /** Map of model IDs to their height offsets (in meters) */
    private modelHeightOffsets: Map<string, number> = new Map();

    /** Whether H key is held for height adjustment */
    private heightKeyHeld: boolean = false;

    // ========================================================================
    // SELECTION & DRAG PROPERTIES
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

        console.log(`${LOG_PREFIX} Created`);
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the button, model system, and scaling system
     * Call this after scene is ready
     * 
     * NOTE: This method is now async due to ScaleManager initialization
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
            this.scaleManager = new ScaleManager(this.scene, {
                scaleKey: 's',           // Hold S + scroll to scale
                resetKey: 'r',           // Press R to reset scale
                lockKey: 'l',            // Press L to toggle lock
                scrollSensitivity: 5,    // 5% per scroll notch
                fineMultiplier: 0.2      // Shift = 20% of normal speed
            });
            await this.scaleManager.initialize();
            console.log(`${LOG_PREFIX} ✓ ScaleManager initialized`);

            // ----------------------------------------------------------------
            // Create Sidebar Scale Controls (for UIManager settings integration)
            // Call getScaleControlsElement() to add to sidebar settings
            // ----------------------------------------------------------------
            this.sidebarScaleControls = new SidebarScaleControls();
            this.sidebarScaleControls.setScaleManager(this.scaleManager);

            // Connect height change callback
            this.sidebarScaleControls.setHeightChangeCallback((objectId, heightOffset) => {
                this.handleHeightChange(objectId, heightOffset);
            });

            console.log(`${LOG_PREFIX} ✓ SidebarScaleControls created`);

            // ----------------------------------------------------------------
            // Setup scale event listeners
            // ----------------------------------------------------------------
            this.setupScaleEventListeners();

            // ----------------------------------------------------------------
            // Register train orientation utilities on window object
            // ----------------------------------------------------------------
            this.registerOrientationUtilities();

            // ----------------------------------------------------------------
            // Subscribe to library changes
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
        console.log('║  Drag model         → Move it (XZ plane)                   ║');
        console.log('║  Drag gizmo corner  → Scale uniformly                      ║');
        console.log('║  S + Scroll         → Scale selected object                ║');
        console.log('║  Shift+S + Scroll   → Fine scale adjustment                ║');
        console.log('║  H + Scroll         → Adjust height (lift/lower)           ║');
        console.log('║  PageUp / PageDown  → Height ±5mm                          ║');
        console.log('║  Shift+PgUp/PgDn    → Height ±1mm (fine)                   ║');
        console.log('║  R                  → Reset to original scale              ║');
        console.log('║  L                  → Lock/unlock scaling                  ║');
        console.log('║  [ / ]              → Rotate ±5°                           ║');
        console.log('║  Shift + [ / ]      → Rotate ±22.5°                        ║');
        console.log('║  Delete             → Remove selected model                ║');
        console.log('║  Escape             → Deselect                             ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log('║  Transform controls in Models sidebar → Settings section   ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log('');
        console.log(`${LOG_PREFIX} === TRAIN ORIENTATION HELP ===`);
        console.log(`${LOG_PREFIX} If trains face wrong way on track, try in console:`);
        console.log(`${LOG_PREFIX}   window.setTrainOrientation('NEG_Y')  // For Blender exports`);
        console.log(`${LOG_PREFIX}   window.setTrainOrientation('POS_X')  // For some exports`);
        console.log(`${LOG_PREFIX}   window.trainOrientationHelp()        // Show all options`);
        console.log('');
    }

    // ========================================================================
    // SCALING SYSTEM METHODS
    // ========================================================================

    /**
     * Setup listeners for scale system events
     * Handles scale commits, resets, and lock changes
     */
    private setupScaleEventListeners(): void {
        if (!this.scaleManager) return;

        this.scaleManager.addEventListener((event) => {
            switch (event.type) {
                case 'scale-commit':
                    // Update the adapter's internal scale when committed
                    if (event.objectId && event.scale !== undefined) {
                        const adapter = this.scalableAdapters.get(event.objectId);
                        if (adapter) {
                            adapter.setScale(event.scale);
                            console.log(`${LOG_PREFIX} Scale committed: ${event.objectId} → ${(event.scale * 100).toFixed(1)}%`);
                        }
                    }
                    break;

                case 'scale-reset':
                    console.log(`${LOG_PREFIX} Scale reset: ${event.objectId}`);
                    break;

                case 'lock-changed':
                    console.log(`${LOG_PREFIX} Scale lock: ${event.objectId} → ${event.data?.locked ? 'LOCKED' : 'unlocked'}`);
                    break;
            }
        });

        console.log(`${LOG_PREFIX} ✓ Scale event listeners configured`);
    }

    /**
     * Register a placed model with the scaling system
     * Creates a ScalableModelAdapter and registers it with ScaleManager
     * 
     * @param placedModel - The placed model instance
     * @param category - Model category from library
     */
    private registerModelForScaling(placedModel: PlacedModel, category: string): void {
        if (!this.scaleManager) {
            console.warn(`${LOG_PREFIX} ScaleManager not ready - cannot register for scaling`);
            return;
        }

        try {
            // Create adapter that wraps PlacedModel with IScalable interface
            const adapter = new ScalableModelAdapter(
                placedModel,
                category as ModelCategory
            );

            // Store adapter for later reference
            this.scalableAdapters.set(placedModel.id, adapter);

            // Register with scale manager
            this.scaleManager.registerScalable(
                adapter,
                adapter.getTransformNode(),
                adapter.getMeshes(),
                adapter.getBoundingRadius()
            );

            console.log(`${LOG_PREFIX} ✓ Registered for scaling: ${placedModel.id} (${category})`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error registering for scaling:`, error);
        }
    }

    /**
     * Unregister a model from the scaling system
     * Called before deleting a model
     * 
     * @param modelId - The model ID to unregister
     */
    private unregisterModelFromScaling(modelId: string): void {
        if (!this.scaleManager) return;

        try {
            this.scaleManager.unregisterScalable(modelId);
            this.scalableAdapters.delete(modelId);
            console.log(`${LOG_PREFIX} Unregistered from scaling: ${modelId}`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error unregistering from scaling:`, error);
        }
    }

    // ========================================================================
    // HEIGHT ADJUSTMENT
    // ========================================================================

    /**
     * Handle height change from sidebar controls
     * Moves the model up or down along the Y axis
     * 
     * @param objectId - ID of the model to adjust
     * @param heightOffset - Height offset in meters (positive = up)
     */
    private handleHeightChange(objectId: string, heightOffset: number): void {
        if (!this.modelSystem) return;

        try {
            // Get the placed model
            const placedModel = this.modelSystem.getPlacedModel(objectId);
            if (!placedModel || !placedModel.rootNode) {
                console.warn(`${LOG_PREFIX} Model not found for height adjustment: ${objectId}`);
                return;
            }

            // Get the model's base Y position (where it was originally placed)
            const baseY = this.getModelBaseY(placedModel);

            // Calculate new Y position
            const newY = baseY + heightOffset;

            // Update the model's Y position
            placedModel.rootNode.position.y = newY;

            // Store the height offset
            this.modelHeightOffsets.set(objectId, heightOffset);

            // Log the change
            const heightMM = Math.round(heightOffset * 1000);
            console.log(`${LOG_PREFIX} Height adjusted: ${objectId} → ${heightMM}mm offset (Y=${newY.toFixed(4)})`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error adjusting height:`, error);
        }
    }

    /**
     * Get the base Y position for a model (where it should sit at height offset 0)
     * 
     * @param placedModel - The placed model
     * @returns Base Y position in meters
     */
    private getModelBaseY(placedModel: PlacedModel): number {
        // Check if this is a rolling stock model (placed on track)
        const libraryEntry = this.library.getModel(placedModel.libraryId);
        const category = libraryEntry?.category || 'scenery';

        if (TRACK_PLACEMENT_CATEGORIES.includes(category)) {
            // Rolling stock sits on rail surface
            return SURFACE_HEIGHTS.RAIL_TOP_Y;
        } else {
            // Other models sit on baseboard surface
            return SURFACE_HEIGHTS.BASEBOARD_TOP;
        }
    }

    /**
     * Get the current height offset for a model
     * 
     * @param modelId - ID of the model
     * @returns Height offset in meters
     */
    private getModelHeightOffset(modelId: string): number {
        return this.modelHeightOffsets.get(modelId) || 0;
    }

    // ========================================================================
    // TRAIN ORIENTATION UTILITIES
    // ========================================================================

    /**
     * Register orientation testing utilities on the window object
     * 
     * Allows users to fix train orientation from the browser console
     * when trains face sideways on the track instead of along it.
     * 
     * Available commands:
     *   window.setTrainOrientation('NEG_Y')  - Set forward axis
     *   window.getTrainOrientation()         - Get current setting
     *   window.trainOrientationHelp()        - Show help
     */
    private registerOrientationUtilities(): void {
        if (!this.trackPlacer) return;

        // Register the basic tester from TrackModelPlacer
        registerOrientationTester(this.trackPlacer);

        // Store reference for closures
        const placer = this.trackPlacer;

        // ----------------------------------------------------------------
        // window.setTrainOrientation(axis) - Set the model forward axis
        // ----------------------------------------------------------------
        (window as any).setTrainOrientation = (axis: ModelForwardAxis) => {
            const validAxes: ModelForwardAxis[] = ['POS_X', 'NEG_X', 'POS_Y', 'NEG_Y', 'POS_Z', 'NEG_Z'];

            if (!validAxes.includes(axis)) {
                console.error(`${LOG_PREFIX} Invalid axis: ${axis}`);
                console.log(`${LOG_PREFIX} Valid options: ${validAxes.join(', ')}`);
                return;
            }

            placer.setModelForwardAxis(axis);
            console.log(`${LOG_PREFIX} ✓ Train orientation set to: ${axis}`);
            console.log(`${LOG_PREFIX} Now place a train on the track to test.`);

            // Suggest next axis to try if this doesn't work
            const currentIndex = validAxes.indexOf(axis);
            const nextToTry = validAxes[(currentIndex + 1) % validAxes.length];
            console.log(`${LOG_PREFIX} If still wrong, try: window.setTrainOrientation('${nextToTry}')`);
        };

        // ----------------------------------------------------------------
        // window.getTrainOrientation() - Get current orientation setting
        // ----------------------------------------------------------------
        (window as any).getTrainOrientation = () => {
            const current = placer.getModelForwardAxis();
            console.log(`${LOG_PREFIX} Current train orientation: ${current}`);
            return current;
        };

        // ----------------------------------------------------------------
        // window.trainOrientationHelp() - Display help information
        // ----------------------------------------------------------------
        (window as any).trainOrientationHelp = () => {
            console.log('');
            console.log('╔════════════════════════════════════════════════════════════╗');
            console.log('║              TRAIN ORIENTATION HELP                        ║');
            console.log('╠════════════════════════════════════════════════════════════╣');
            console.log('║                                                            ║');
            console.log('║  If your train model faces SIDEWAYS (across the track)     ║');
            console.log('║  instead of ALONG the track, the model uses a different    ║');
            console.log('║  "forward" axis than expected.                             ║');
            console.log('║                                                            ║');
            console.log('║  Try these commands to fix it:                             ║');
            console.log('║                                                            ║');
            console.log('║    window.setTrainOrientation("POS_Z")  // Default         ║');
            console.log('║    window.setTrainOrientation("NEG_Y")  // Blender         ║');
            console.log('║    window.setTrainOrientation("POS_X")  // Some CAD        ║');
            console.log('║    window.setTrainOrientation("NEG_X")                     ║');
            console.log('║    window.setTrainOrientation("POS_Y")  // 3ds Max         ║');
            console.log('║    window.setTrainOrientation("NEG_Z")                     ║');
            console.log('║                                                            ║');
            console.log('║  After setting, place a NEW train on the track to test.   ║');
            console.log('║  The setting persists until you refresh the page.         ║');
            console.log('║                                                            ║');
            console.log('╚════════════════════════════════════════════════════════════╝');
            console.log('');
            console.log(`Current setting: ${placer.getModelForwardAxis()}`);
            console.log('');
        };

        console.log(`${LOG_PREFIX} ✓ Orientation utilities registered`);
        console.log(`${LOG_PREFIX}   Type window.trainOrientationHelp() for help`);
    }

    // ========================================================================
    // WORLD OUTLINER INTEGRATION
    // ========================================================================

    /**
     * Connect to the WorldOutliner for scene hierarchy integration
     * 
     * This enables:
     * - Models appearing in the outliner when placed
     * - Deleting from outliner removes the 3D model
     * - Two-way synchronization
     * 
     * @param outliner - WorldOutliner instance
     */
    setWorldOutliner(outliner: WorldOutliner): void {
        if (this.worldOutliner) {
            // Remove previous callback if any
            if (this.boundDeleteCallback) {
                this.worldOutliner.removeOnNodeDelete(this.boundDeleteCallback);
            }
        }

        this.worldOutliner = outliner;

        // Setup callback for when nodes are deleted from the outliner
        this.setupOutlinerDeleteCallback();

        console.log(`${LOG_PREFIX} ✓ WorldOutliner connected - models will appear in outliner`);
    }

    /**
     * Setup callback to handle deletion from the WorldOutliner
     * When a model is deleted in the outliner, we need to remove it from ModelSystem too
     */
    private setupOutlinerDeleteCallback(): void {
        if (!this.worldOutliner) return;

        this.boundDeleteCallback = (nodeId: string, sceneObjectId: string | null, metadata: Record<string, unknown>) => {
            // Check if this is a model we're tracking
            const placedModelId = metadata.placedModelId as string | undefined;

            if (placedModelId && this.modelSystem) {
                console.log(`${LOG_PREFIX} Outliner deleted node, removing model: ${placedModelId}`);

                // Unregister from scaling system first
                this.unregisterModelFromScaling(placedModelId);

                // Remove from ModelSystem (this disposes the 3D meshes)
                // Note: The WorldOutliner already disposed the scene objects, 
                // so we just need to clean up our internal tracking
                try {
                    // Check if the model still exists in our system
                    const model = this.modelSystem.getPlacedModel(placedModelId);
                    if (model) {
                        // The WorldOutliner has already disposed the meshes,
                        // so we just need to remove from our tracking
                        this.modelSystem.removeModelFromTracking(placedModelId);
                        console.log(`${LOG_PREFIX} ✓ Cleaned up model tracking: ${placedModelId}`);
                    }
                } catch (error) {
                    console.warn(`${LOG_PREFIX} Error cleaning up model: ${error}`);
                }
            }
        };

        this.worldOutliner.onNodeDelete(this.boundDeleteCallback);
        console.log(`${LOG_PREFIX} ✓ Outliner delete callback registered`);
    }

    /**
     * Register a placed model with the WorldOutliner
     * 
     * @param placedModel - The placed model instance
     * @param libraryEntry - Library entry for the model
     * @param category - Model category
     */
    private registerWithOutliner(
        placedModel: PlacedModel,
        libraryEntry: ModelLibraryEntry,
        category: string
    ): void {
        if (!this.worldOutliner) {
            console.warn(`${LOG_PREFIX} WorldOutliner not connected - model not registered`);
            return;
        }

        try {
            // Determine the outliner node type
            const nodeType = CATEGORY_TO_OUTLINER_TYPE[category.toLowerCase()] || 'scenery';

            // Get the scene object ID from the root node
            const sceneObjectId = placedModel.rootNode.uniqueId.toString();

            // Create the outliner item
            const nodeId = this.worldOutliner.createItem({
                name: libraryEntry.name,
                type: nodeType as Exclude<OutlinerNodeType, 'folder'>,
                sceneObjectId: sceneObjectId,
                parentId: null, // Auto-group to category folder
                transform: {
                    position: {
                        x: placedModel.position.x,
                        y: placedModel.position.y,
                        z: placedModel.position.z
                    },
                    rotation: { x: 0, y: 0, z: 0, w: 1 },
                    scale: {
                        x: placedModel.scale,
                        y: placedModel.scale,
                        z: placedModel.scale
                    }
                },
                metadata: {
                    libraryId: libraryEntry.id,
                    placedModelId: placedModel.id,
                    category: category,
                    fileName: libraryEntry.fileName,
                    scaleFactor: placedModel.scale,
                    scalePreset: placedModel.scalePreset
                }
            });

            // Store the outliner node ID in the model's root node metadata for later retrieval
            if (placedModel.rootNode.metadata) {
                placedModel.rootNode.metadata.outlinerNodeId = nodeId;
            } else {
                placedModel.rootNode.metadata = { outlinerNodeId: nodeId };
            }

            console.log(`${LOG_PREFIX} ✓ Registered "${libraryEntry.name}" with outliner (node: ${nodeId})`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error registering with outliner:`, error);
        }
    }

    /**
     * Remove a placed model from the WorldOutliner
     * Called when a model is deleted via keyboard shortcut
     * 
     * @param placedModel - The placed model to remove
     */
    private unregisterFromOutliner(placedModel: PlacedModel): void {
        if (!this.worldOutliner) return;

        try {
            // Get the outliner node ID from the model's metadata
            const nodeId = placedModel.rootNode.metadata?.outlinerNodeId as string | undefined;

            if (nodeId) {
                // Delete from outliner (this will NOT trigger our delete callback since we're removing it)
                // We need to prevent the callback from firing to avoid double-deletion
                this.worldOutliner.deleteNode(nodeId);
                console.log(`${LOG_PREFIX} Unregistered model from outliner: ${nodeId}`);
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error unregistering from outliner:`, error);
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
     * Escape = Deselect model
     * 
     * Note: Scale controls (S, R, L) are handled by ScaleManager
     * Note: Track rotation has priority - if a track piece is selected,
     * App.ts handles the rotation instead.
     */
    private setupKeyboardShortcuts(): void {
        // ----------------------------------------------------------------
        // Keydown handler
        // ----------------------------------------------------------------
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
                case 'h':
                case 'H':
                    // Track H key for height adjustment via scroll
                    if (!event.repeat) {
                        this.heightKeyHeld = true;
                    }
                    break;

                case 'PageUp':
                    // Raise model height
                    if (selectedModel && !trackSelected) {
                        event.preventDefault();
                        const step = event.shiftKey ? 1 : 5; // 1mm fine, 5mm normal
                        this.sidebarScaleControls?.adjustHeight(step);
                        console.log(`${LOG_PREFIX} Height +${step}mm`);
                    }
                    break;

                case 'PageDown':
                    // Lower model height
                    if (selectedModel && !trackSelected) {
                        event.preventDefault();
                        const step = event.shiftKey ? -1 : -5; // 1mm fine, 5mm normal
                        this.sidebarScaleControls?.adjustHeight(step);
                        console.log(`${LOG_PREFIX} Height ${step}mm`);
                    }
                    break;

                case '[':
                    // Rotate left - only if model selected AND no track selected
                    if (selectedModel && !trackSelected) {
                        event.preventDefault();
                        const angle = event.shiftKey ? -LARGE_ROTATION_DEG : -SMALL_ROTATION_DEG;
                        this.modelSystem.rotateModel(selectedModel.id, angle);
                        console.log(`${LOG_PREFIX} Rotated model ${angle}°`);
                    }
                    break;

                case ']':
                    // Rotate right - only if model selected AND no track selected
                    if (selectedModel && !trackSelected) {
                        event.preventDefault();
                        const angle = event.shiftKey ? LARGE_ROTATION_DEG : SMALL_ROTATION_DEG;
                        this.modelSystem.rotateModel(selectedModel.id, angle);
                        console.log(`${LOG_PREFIX} Rotated model ${angle}°`);
                    }
                    break;

                case 'Delete':
                case 'Backspace':
                    // Delete selected model (Backspace as alternative for Mac)
                    // Only if no track is selected
                    if (selectedModel && !trackSelected && !event.metaKey && !event.ctrlKey) {
                        event.preventDefault();
                        const modelName = this.library.getModel(selectedModel.libraryId)?.name || selectedModel.id;

                        // Unregister from scaling system first
                        this.unregisterModelFromScaling(selectedModel.id);

                        // Remove height offset
                        this.modelHeightOffsets.delete(selectedModel.id);

                        // Unregister from outliner
                        this.unregisterFromOutliner(selectedModel);

                        // Deselect from scale manager (hides gizmo)
                        this.scaleManager?.deselectObject();

                        // Notify SidebarScaleControls
                        this.sidebarScaleControls?.onObjectDeselected();

                        // Then remove the model
                        this.modelSystem.removeModel(selectedModel.id);
                        console.log(`${LOG_PREFIX} Deleted model: ${modelName}`);
                    }
                    break;

                case 'Escape':
                    // Deselect model
                    if (selectedModel) {
                        event.preventDefault();
                        this.modelSystem.deselectModel();

                        // Also deselect from scale manager (hides gizmo)
                        this.scaleManager?.deselectObject();

                        // Notify SidebarScaleControls
                        this.sidebarScaleControls?.onObjectDeselected();

                        (window as any).__modelSelected = false;
                        console.log(`${LOG_PREFIX} Deselected model`);
                    }
                    break;
            }
        });

        // ----------------------------------------------------------------
        // Keyup handler - for tracking H key release
        // ----------------------------------------------------------------
        window.addEventListener('keyup', (event: KeyboardEvent) => {
            if (event.key === 'h' || event.key === 'H') {
                this.heightKeyHeld = false;
            }
        });

        // ----------------------------------------------------------------
        // Wheel handler - for H+scroll height adjustment
        // ----------------------------------------------------------------
        window.addEventListener('wheel', (event: WheelEvent) => {
            // Only handle if H key is held and we have a selected model
            if (!this.heightKeyHeld) return;
            if (!this.modelSystem) return;

            const selectedModel = this.modelSystem.getSelectedModel();
            if (!selectedModel) return;

            // Prevent default scrolling
            event.preventDefault();

            // Calculate height delta (5mm per scroll notch, 1mm with Shift)
            const sensitivity = event.shiftKey ? 1 : 5;
            const delta = event.deltaY < 0 ? sensitivity : -sensitivity;

            // Adjust height via sidebar controls
            this.sidebarScaleControls?.adjustHeight(delta);

        }, { passive: false });

        console.log(`${LOG_PREFIX} Keyboard shortcuts configured:`);
        console.log(`${LOG_PREFIX}   [ / ] = Rotate ±5°`);
        console.log(`${LOG_PREFIX}   Shift + [ / ] = Rotate ±22.5°`);
        console.log(`${LOG_PREFIX}   H + Scroll = Adjust height`);
        console.log(`${LOG_PREFIX}   PageUp/PageDown = Height ±5mm`);
        console.log(`${LOG_PREFIX}   Shift + PgUp/PgDn = Height ±1mm`);
        console.log(`${LOG_PREFIX}   Delete = Remove selected`);
        console.log(`${LOG_PREFIX}   Escape = Deselect`);
        console.log(`${LOG_PREFIX}   S + Scroll = Scale (handled by ScaleManager)`);
        console.log(`${LOG_PREFIX}   R = Reset scale (handled by ScaleManager)`);
        console.log(`${LOG_PREFIX}   L = Lock scale (handled by ScaleManager)`);
    }

    // ========================================================================
    // MODEL SELECTION & DRAGGING
    // ========================================================================

    /**
     * Setup click-to-select and drag-to-move for placed models
     * 
     * - Click on a model to select it (highlighted red, gizmo appears)
     * - Click and drag a selected model to move it
     * - Click elsewhere to deselect
     */
    private setupModelSelection(): void {
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

            // === IMPORTANT: Don't start model drag if ScaleManager is dragging gizmo ===
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

                    // IMPORTANT: Disable camera controls while dragging
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

            this.pointerDownPos = null;
            this.dragOffset = null;
        };

        // Attach listeners
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
                console.log(`${LOG_PREFIX} Drag cancelled (left canvas)`);
            }
            this.pointerDownPos = null;
        });

        console.log(`${LOG_PREFIX} Model click-to-select and drag-to-move configured`);
    }

    /**
     * Disable camera controls during model drag
     */
    private disableCameraControls(): void {
        const camera = this.scene.activeCamera;
        if (camera) {
            camera.detachControl();
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
        }
    }

    /**
     * Handle model dragging
     * 
     * FIX: Now uses SURFACE_HEIGHTS.BASEBOARD_TOP for consistent Y positioning
     */
    private handleModelDrag(event: PointerEvent): void {
        if (!this.modelSystem || !this.draggedModelId || !this.dragOffset) return;

        const model = this.modelSystem.getPlacedModel(this.draggedModelId);
        if (!model) return;

        // Get world position from screen
        const worldPos = this.getWorldPositionFromScreen(event.clientX, event.clientY);
        if (!worldPos) return;

        // Calculate new position (subtract the offset to keep cursor at pick point)
        const newX = worldPos.x - this.dragOffset.x;
        const newZ = worldPos.z - this.dragOffset.z;

        // Move the model (keep same Y - this preserves the correct placement height)
        this.modelSystem.moveModel(this.draggedModelId, new Vector3(newX, model.position.y, newZ));
    }

    /**
     * Handle click on models for selection
     * Extended to also select/deselect in ScaleManager (shows/hides gizmo)
     */
    private handleModelClick(event: PointerEvent): void {
        if (!this.modelSystem) return;

        // Skip if track is selected
        const trackSelected = (window as any).__trackPieceSelected === true;
        if (trackSelected) return;

        // Check what we clicked on
        const pickResult = this.scene.pick(event.clientX, event.clientY);

        if (pickResult?.hit && pickResult.pickedMesh) {
            // Check if this mesh belongs to a placed model
            const placedModelId = this.modelSystem.getPlacedModelIdFromMesh(pickResult.pickedMesh);

            if (placedModelId) {
                // Select this model in ModelSystem (visual highlight)
                this.modelSystem.selectModel(placedModelId);
                (window as any).__modelSelected = true;

                // === Select in ScaleManager (shows gizmo) ===
                if (this.scaleManager && this.scalableAdapters.has(placedModelId)) {
                    this.scaleManager.selectObject(placedModelId);

                    // === Notify SidebarScaleControls with height offset ===
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

                // === Deselect from ScaleManager (hides gizmo) ===
                if (this.scaleManager) {
                    this.scaleManager.deselectObject();
                }

                // === Notify SidebarScaleControls ===
                this.sidebarScaleControls?.onObjectDeselected();
            }
        } else {
            // Clicked on nothing - deselect
            this.modelSystem.deselectModel();
            (window as any).__modelSelected = false;

            // === Deselect from ScaleManager (hides gizmo) ===
            if (this.scaleManager) {
                this.scaleManager.deselectObject();
            }

            // === Notify SidebarScaleControls ===
            this.sidebarScaleControls?.onObjectDeselected();
        }
    }

    /**
     * Pick a model at screen position
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
     * Projects onto the baseboard plane (Y = SURFACE_HEIGHTS.BASEBOARD_TOP)
     * 
     * FIX: Now uses SURFACE_HEIGHTS constant for consistent height
     */
    private getWorldPositionFromScreen(screenX: number, screenY: number): Vector3 | null {
        const camera = this.scene.activeCamera;
        if (!camera) return null;

        // Create a ray from the camera through the screen point
        const ray = this.scene.createPickingRay(screenX, screenY, null, camera);

        // ====================================================================
        // FIX: Use SURFACE_HEIGHTS.BASEBOARD_TOP instead of hardcoded value
        // This ensures consistent height across all placement operations
        // ====================================================================
        const boardTopY = SURFACE_HEIGHTS.BASEBOARD_TOP;
        const t = (boardTopY - ray.origin.y) / ray.direction.y;

        if (t > 0) {
            return new Vector3(
                ray.origin.x + ray.direction.x * t,
                boardTopY,
                ray.origin.z + ray.direction.z * t
            );
        }

        return null;
    }

    // ========================================================================
    // STATUS DISPLAY (UI)
    // ========================================================================

    /**
     * Update the status display with current model count
     */
    private updateStatusDisplay(): void {
        if (!this.statusDisplay) return;

        const count = this.library.getAll().length;
        const used = this.library.getAll().filter(m => m.isUsed).length;

        if (count > 0) {
            this.statusDisplay.textContent = `Models: ${used}/${count} placed`;
            this.statusDisplay.style.display = 'block';
        } else {
            this.statusDisplay.style.display = 'none';
        }
    }

    // ========================================================================
    // IMPORT DIALOG
    // ========================================================================

    /**
     * Show the import dialog
     * Called when the import button is clicked (from sidebar or floating button)
     */
    showImportDialog(): void {
        // Guard: Ensure ModelSystem is initialized
        if (!this.modelSystem) {
            console.error(`${LOG_PREFIX} Cannot open import dialog - ModelSystem not initialized`);
            return;
        }

        console.log(`${LOG_PREFIX} Opening import dialog...`);

        // Create and show the dialog with scene and modelSystem
        const dialog = new ModelImportDialog(this.scene, this.modelSystem);

        dialog.show((result) => {
            if (result) {
                console.log(`${LOG_PREFIX} ✓ Imported: "${result.name}"`);
                console.log(`${LOG_PREFIX}   Category: ${result.category}`);
                console.log(`${LOG_PREFIX}   ID: ${result.id}`);

                // Place the model
                this.placeModel(result.id);
            } else {
                console.log(`${LOG_PREFIX} Import cancelled`);
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
     * Automatically registers with scaling system
     */
    private async placeModel(libraryId: string): Promise<void> {
        if (!this.modelSystem) return;

        const entry = this.library.getModel(libraryId);
        if (!entry) {
            console.error(`${LOG_PREFIX} Model not found:`, libraryId);
            return;
        }

        console.log(`${LOG_PREFIX} Placing model: "${entry.name}" (${entry.category})`);

        // Check if this model requires track placement
        if (this.requiresTrackPlacement(entry.category)) {
            await this.placeOnTrack(entry);
        } else {
            await this.placeOnBaseboard(entry);
        }
    }

    /**
     * Place a model on track (for rolling stock)
     * Automatically places the model centered on the first available track piece
     */
    private async placeOnTrack(entry: ModelLibraryEntry): Promise<void> {
        if (!this.modelSystem || !this.trackPlacer) return;

        // Check if there are any track pieces
        if (!this.trackPlacer.hasTrackPieces()) {
            this.showNoTrackWarning();
            return;
        }

        console.log(`${LOG_PREFIX} Auto-placing rolling stock on track`);

        // Get default placement (centered on first available track)
        const result = this.trackPlacer.getDefaultPlacement();

        if (result && result.isValid) {
            // Place the model at the calculated position
            const placed = await this.modelSystem!.placeModel(entry, {
                position: result.position,
                rotationDeg: result.rotationDegrees
            });

            if (placed) {
                console.log(`${LOG_PREFIX} ✓ Placed rolling stock "${entry.name}" on track`);
                console.log(`${LOG_PREFIX}   Position: (${result.position.x.toFixed(3)}, ${result.position.y.toFixed(3)}, ${result.position.z.toFixed(3)})`);
                console.log(`${LOG_PREFIX}   Rotation: ${result.rotationDegrees.toFixed(1)}°`);

                // Register with scaling system
                this.registerModelForScaling(placed, entry.category);

                // Register with WorldOutliner
                this.registerWithOutliner(placed, entry, entry.category);

                // Select it in ModelSystem
                this.modelSystem!.selectModel(placed.id);

                // Select in ScaleManager (shows gizmo)
                if (this.scaleManager) {
                    this.scaleManager.selectObject(placed.id);
                }

                // Notify SidebarScaleControls (height offset = 0 for new placement)
                const adapter = this.scalableAdapters.get(placed.id);
                if (this.sidebarScaleControls && adapter) {
                    this.sidebarScaleControls.onObjectSelected(
                        placed.id,
                        adapter.currentScale,
                        adapter.scaleLocked,
                        0 // New placement, no height offset
                    );
                }

                // Mark as used
                this.library.markAsUsed(entry.id);
            }
        } else {
            console.warn(`${LOG_PREFIX} Could not calculate default placement`);
            // Fall back to manual placement mode
            this.startManualTrackPlacement(entry);
        }
    }

    /**
     * Start manual track placement mode (fallback if auto-placement fails)
     */
    private startManualTrackPlacement(entry: ModelLibraryEntry): void {
        if (!this.modelSystem || !this.trackPlacer) return;

        console.log(`${LOG_PREFIX} Starting manual track placement mode for rolling stock`);

        // Start track placement mode
        this.trackPlacer.startPlacement(async (result) => {
            if (result && result.isValid) {
                // Place the model at the calculated position
                const placed = await this.modelSystem!.placeModel(entry, {
                    position: result.position,
                    rotationDeg: result.rotationDegrees
                });

                if (placed) {
                    console.log(`${LOG_PREFIX} ✓ Placed rolling stock "${entry.name}" on track`);
                    console.log(`${LOG_PREFIX}   Position: (${result.position.x.toFixed(3)}, ${result.position.z.toFixed(3)})`);
                    console.log(`${LOG_PREFIX}   Rotation: ${result.rotationDegrees.toFixed(1)}°`);

                    // Register with scaling system
                    this.registerModelForScaling(placed, entry.category);

                    // Register with WorldOutliner
                    this.registerWithOutliner(placed, entry, entry.category);

                    // Select it in ModelSystem
                    this.modelSystem!.selectModel(placed.id);

                    // Select in ScaleManager (shows gizmo)
                    if (this.scaleManager) {
                        this.scaleManager.selectObject(placed.id);
                    }

                    // Notify SidebarScaleControls (height offset = 0 for new placement)
                    const adapter = this.scalableAdapters.get(placed.id);
                    if (this.sidebarScaleControls && adapter) {
                        this.sidebarScaleControls.onObjectSelected(
                            placed.id,
                            adapter.currentScale,
                            adapter.scaleLocked,
                            0 // New placement, no height offset
                        );
                    }

                    // Mark as used
                    this.library.markAsUsed(entry.id);
                }
            } else {
                console.log(`${LOG_PREFIX} Track placement cancelled`);
            }
        });
    }

    /**
     * Place a model on baseboard (for non-rolling stock like buildings, scenery)
     * 
     * FIX: Now places at SURFACE_HEIGHTS.BASEBOARD_TOP instead of Y=0
     * This ensures models appear ON the baseboard, not 95cm below it!
     */
    private async placeOnBaseboard(entry: ModelLibraryEntry): Promise<void> {
        if (!this.modelSystem) return;

        console.log(`${LOG_PREFIX} Placing model on baseboard at Y=${SURFACE_HEIGHTS.BASEBOARD_TOP}m`);

        // ====================================================================
        // FIX: Use SURFACE_HEIGHTS.BASEBOARD_TOP for Y position
        // Previously this was Vector3(0, 0, 0) which placed models at Y=0,
        // but the baseboard surface is at Y=0.95m!
        // ====================================================================
        const placed = await this.modelSystem.placeModel(entry, {
            position: new Vector3(0, SURFACE_HEIGHTS.BASEBOARD_TOP, 0)
        });

        if (placed) {
            console.log(`${LOG_PREFIX} ✓ Model placed on baseboard`);
            console.log(`${LOG_PREFIX}   Position: (0, ${SURFACE_HEIGHTS.BASEBOARD_TOP}, 0)`);
            console.log(`${LOG_PREFIX}   Use mouse to drag, [ / ] to rotate`);
            console.log(`${LOG_PREFIX}   Use gizmo handles or S+scroll to scale`);

            // Register with scaling system
            this.registerModelForScaling(placed, entry.category);

            // Register with WorldOutliner
            this.registerWithOutliner(placed, entry, entry.category);

            // Select it in ModelSystem
            this.modelSystem.selectModel(placed.id);

            // Select in ScaleManager (shows gizmo)
            if (this.scaleManager) {
                this.scaleManager.selectObject(placed.id);
            }

            // Notify SidebarScaleControls (height offset = 0 for new placement)
            const adapter = this.scalableAdapters.get(placed.id);
            if (this.sidebarScaleControls && adapter) {
                this.sidebarScaleControls.onObjectSelected(
                    placed.id,
                    adapter.currentScale,
                    adapter.scaleLocked,
                    0 // New placement, no height offset
                );
            }

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
            z-index: 10000;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background: #2a2a2a;
            border-radius: 8px;
            padding: 24px;
            max-width: 400px;
            text-align: center;
            color: #fff;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        `;

        modal.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 16px;">🚂</div>
            <h3 style="margin: 0 0 12px 0; color: #ffa726;">No Track Available</h3>
            <p style="margin: 0 0 20px 0; color: #aaa;">
                Rolling stock (trains) must be placed on track pieces.<br>
                Please place some track first, then import your train.
            </p>
            <button id="no-track-ok-btn" style="
                background: #4CAF50;
                color: white;
                border: none;
                padding: 10px 24px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            ">OK</button>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Close handlers
        const close = () => overlay.remove();

        modal.querySelector('#no-track-ok-btn')?.addEventListener('click', close);

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
     * Get the scale manager instance
     */
    getScaleManager(): ScaleManager | null {
        return this.scaleManager;
    }

    /**
     * Get the sidebar scale controls element for UIManager integration
     * 
     * Add this element to UIManager settings section:
     * @example
     * ```typescript
     * const scaleElement = modelImportButton.getScaleControlsElement();
     * if (scaleElement) {
     *     settingsContent.appendChild(scaleElement);
     * }
     * ```
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
            this.button.style.display = 'none';
        }
        if (this.statusDisplay) {
            this.statusDisplay.style.display = visible ? 'block' : 'none';
        }
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Dispose of resources
     */
    dispose(): void {
        console.log(`${LOG_PREFIX} Disposing...`);

        // ----------------------------------------------------------------
        // Clean up window orientation utilities
        // ----------------------------------------------------------------
        delete (window as any).setTrainOrientation;
        delete (window as any).getTrainOrientation;
        delete (window as any).trainOrientationHelp;
        delete (window as any).testTrainOrientation;

        // ----------------------------------------------------------------
        // Remove outliner delete callback
        // ----------------------------------------------------------------
        if (this.worldOutliner && this.boundDeleteCallback) {
            this.worldOutliner.removeOnNodeDelete(this.boundDeleteCallback);
            this.boundDeleteCallback = null;
        }
        this.worldOutliner = null;

        // ----------------------------------------------------------------
        // Dispose Sidebar Scale Controls
        // ----------------------------------------------------------------
        if (this.sidebarScaleControls) {
            this.sidebarScaleControls.dispose();
            this.sidebarScaleControls = null;
        }

        // ----------------------------------------------------------------
        // Dispose Scale Manager
        // ----------------------------------------------------------------
        if (this.scaleManager) {
            this.scaleManager.dispose();
            this.scaleManager = null;
        }

        // ----------------------------------------------------------------
        // Clear scalable adapters
        // ----------------------------------------------------------------
        this.scalableAdapters.clear();

        // ----------------------------------------------------------------
        // Remove event listeners for model selection and dragging
        // ----------------------------------------------------------------
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