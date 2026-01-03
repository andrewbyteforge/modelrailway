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
 * REFACTORED: Split into three modules
 * - ModelImportButton.ts (this file) - Main class, initialization, public API
 * - ModelSelectionHandler.ts - Pointer/keyboard interaction
 * - ModelRegistrationHelper.ts - System registration utilities
 * 
 * @module ModelImportButton
 * @author Model Railway Workbench
 * @version 3.0.0 - Refactored into modular architecture
 */

// ============================================================================
// IMPORTS
// ============================================================================

import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ModelSystem, type PlacedModel } from '../systems/models/ModelSystem';
import { ModelLibrary, type ModelLibraryEntry } from '../systems/models/ModelLibrary';
import { TrackModelPlacer, registerOrientationTester } from '../systems/models/TrackModelPlacer';
import { ModelImportDialog } from './ModelImportDialog';
import type { WorldOutliner } from '../systems/outliner/WorldOutliner';

// ============================================================================
// SCALING SYSTEM IMPORTS
// ============================================================================

import { ScaleManager } from '../systems/scaling/ScaleManager';
import { SidebarScaleControls } from './components/SidebarScaleControls';
import { registerGaugeCalculatorConsoleUtils } from '../systems/scaling/GaugeScaleCalculator';

// ============================================================================
// MODULAR COMPONENT IMPORTS
// ============================================================================

import { ModelSelectionHandler } from './ModelSelectionHandler';
import { ModelRegistrationHelper } from './ModelRegistrationHelper';

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

// ============================================================================
// MODEL IMPORT BUTTON CLASS
// ============================================================================

/**
 * ModelImportButton - Floating button for model import with track placement
 * 
 * This is the main orchestrating class that coordinates:
 * - Model system initialization
 * - Track placer for rolling stock
 * - Scale manager for model scaling
 * - Selection handler for user interaction
 * - Registration helper for system integration
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

    // ========================================================================
    // MODULAR COMPONENTS
    // ========================================================================

    /** Selection handler for pointer/keyboard interaction */
    private selectionHandler: ModelSelectionHandler | null = null;

    /** Registration helper for system integration */
    private registrationHelper: ModelRegistrationHelper | null = null;

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
                this.registrationHelper?.setModelHeightOffset(objectId, heightOffset);
            });
            console.log(`${LOG_PREFIX} ✓ SidebarScaleControls initialized`);

            // ----------------------------------------------------------------
            // Initialize Registration Helper
            // ----------------------------------------------------------------
            this.registrationHelper = new ModelRegistrationHelper({
                scene: this.scene,
                modelSystem: this.modelSystem,
                scaleManager: this.scaleManager,
                sidebarScaleControls: this.sidebarScaleControls,
                worldOutliner: this.worldOutliner
            });
            console.log(`${LOG_PREFIX} ✓ ModelRegistrationHelper initialized`);

            // ----------------------------------------------------------------
            // Initialize Selection Handler
            // ----------------------------------------------------------------
            this.selectionHandler = new ModelSelectionHandler({
                scene: this.scene,
                modelSystem: this.modelSystem,
                trackPlacer: this.trackPlacer,
                scaleManager: this.scaleManager,
                sidebarScaleControls: this.sidebarScaleControls,
                onHeightOffsetChange: (modelId, heightOffset) => {
                    this.registrationHelper?.setModelHeightOffset(modelId, heightOffset);
                },
                getModelHeightOffset: (modelId) => {
                    return this.registrationHelper?.getModelHeightOffset(modelId) ?? 0;
                },
                hasScalableAdapter: (modelId) => {
                    return this.registrationHelper?.hasScalableAdapter(modelId) ?? false;
                },
                getScalableAdapterInfo: (modelId) => {
                    return this.registrationHelper?.getScalableAdapterInfo(modelId) ?? null;
                },
                onDeleteModel: (modelId) => {
                    this.deleteModel(modelId);
                }
            });
            this.selectionHandler.initialize();
            console.log(`${LOG_PREFIX} ✓ ModelSelectionHandler initialized`);

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
        console.log('║  TRAIN CONTROLS:                                           ║');
        console.log('║  Click train        → Select for DRIVING                   ║');
        console.log('║  Shift+Click train  → Select for REPOSITIONING             ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log('║  When DRIVING (train selected):                            ║');
        console.log('║    ↑ / W            → Increase throttle                    ║');
        console.log('║    ↓ / S            → Decrease throttle                    ║');
        console.log('║    R                → Toggle direction (fwd/rev)           ║');
        console.log('║    Space (hold)     → Apply brake                          ║');
        console.log('║    H                → Sound horn                           ║');
        console.log('║    Escape           → Deselect / Emergency brake           ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log('║  OTHER MODELS:                                             ║');
        console.log('║  Click model        → Select it                            ║');
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
    // MODEL DELETION
    // ========================================================================

    /**
     * Delete a model and clean up all associated resources
     * @param modelId - ID of model to delete
     */
    private deleteModel(modelId: string): void {
        console.log(`${LOG_PREFIX} Deleting model: ${modelId}`);

        // Delegate to registration helper
        this.registrationHelper?.deleteModel(modelId);

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
                                // ============================================================
                                // CRITICAL: Apply the track rotation to the model
                                // ModelSystem.placeModel doesn't apply rotationDeg, so we
                                // must call setModelRotation explicitly after placement
                                // ============================================================
                                this.modelSystem.setModelRotation(placedModel.id, result.rotationDegrees);

                                console.log(`${LOG_PREFIX} ✓ Placed on track: ${entry.name}`);
                                console.log(`${LOG_PREFIX}   Position: ${result.position.toString()}`);
                                console.log(`${LOG_PREFIX}   Rotation: ${result.rotationDegrees.toFixed(1)}°`);

                                // Register with all systems
                                this.registrationHelper?.registerModel(placedModel, entry);

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

                        // Register with all systems
                        this.registrationHelper?.registerModel(placedModel, entry);

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
    // WORLD OUTLINER INTEGRATION
    // ========================================================================

    /**
     * Set the WorldOutliner for bidirectional sync
     * @param outliner - WorldOutliner instance
     */
    setWorldOutliner(outliner: WorldOutliner): void {
        this.worldOutliner = outliner;
        this.registrationHelper?.setWorldOutliner(outliner);
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
     * Get the selection handler instance
     */
    getSelectionHandler(): ModelSelectionHandler | null {
        return this.selectionHandler;
    }

    /**
     * Get the registration helper instance
     */
    getRegistrationHelper(): ModelRegistrationHelper | null {
        return this.registrationHelper;
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
        // Clear global flags
        // ----------------------------------------------------------------
        (window as any).__modelSelected = false;

        // ----------------------------------------------------------------
        // Dispose modular components
        // ----------------------------------------------------------------
        if (this.selectionHandler) {
            this.selectionHandler.dispose();
            this.selectionHandler = null;
        }

        if (this.registrationHelper) {
            this.registrationHelper.dispose();
            this.registrationHelper = null;
        }

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