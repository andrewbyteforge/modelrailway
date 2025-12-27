/**
 * ModelAppIntegration.ts - Copy these sections into your App.ts
 * 
 * Path: frontend/src/core/ModelAppIntegration.ts
 * 
 * This file contains all the code you need to add to your existing App.ts
 * to enable model import, scaling, and placement functionality.
 * 
 * INTEGRATION STEPS:
 * 1. Copy the imports to the top of your App.ts
 * 2. Add the private properties to your App class
 * 3. Copy the methods into your App class
 * 4. Call initModelSystem() in your initialize() method
 * 5. Update your pointer event handlers
 * 6. Update your keyboard handler
 * 
 * @module ModelAppIntegration
 * @author Model Railway Workbench
 * @version 1.0.0
 */

// ============================================================================
// STEP 1: ADD THESE IMPORTS TO TOP OF App.ts
// ============================================================================

/*
// Add these imports at the top of your App.ts:

import { ModelSystem, ModelLibrary, type PlacedModel } from '../systems/models';
import { ModelImportDialog } from '../ui/ModelImportDialog';
import { ModelLibraryPanel } from '../ui/ModelLibraryPanel';
*/

// ============================================================================
// STEP 2: ADD THESE PROPERTIES TO YOUR APP CLASS
// ============================================================================

/*
// Add these to your App class private properties:

private modelSystem: ModelSystem | null = null;
private modelLibraryPanel: ModelLibraryPanel | null = null;
private modelPlacementMode: string | null = null;
private modelPreview: PlacedModel | null = null;
*/

// ============================================================================
// STEP 3: COPY THESE METHODS INTO YOUR APP CLASS
// ============================================================================

import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PickingInfo } from '@babylonjs/core/Collisions/pickingInfo';

import { ModelSystem, ModelLibrary, type PlacedModel } from '../systems/models';
import { ModelImportDialog } from '../ui/ModelImportDialog';
import { ModelLibraryPanel } from '../ui/ModelLibraryPanel';

/**
 * Model integration methods to copy into your App class
 * These handle model import, placement, and interaction
 */
export class ModelAppMethods {
    // These would be your existing App properties
    private scene!: Scene;
    private modelSystem: ModelSystem | null = null;
    private modelLibraryPanel: ModelLibraryPanel | null = null;
    private modelPlacementMode: string | null = null;
    private modelPreview: PlacedModel | null = null;

    // ========================================================================
    // INITIALIZATION - Call this from your initialize() method
    // ========================================================================

    /**
     * Initialize the model import system
     * Call this in your App.initialize() after scene setup
     */
    protected initModelSystem(): void {
        console.log('[App] Initializing model import system...');

        try {
            // ------------------------------------------------------------
            // Create ModelSystem - handles loading and placing models
            // ------------------------------------------------------------
            this.modelSystem = new ModelSystem(this.scene, null);
            this.modelSystem.initialize();
            console.log('[App] ✓ ModelSystem created');

            // ------------------------------------------------------------
            // Create Model Library Panel - sidebar for browsing models
            // ------------------------------------------------------------
            this.modelLibraryPanel = new ModelLibraryPanel(document.body);
            this.modelLibraryPanel.initialize(
                // Callback when user clicks a model in the library
                (libraryId: string) => this.enterModelPlacementMode(libraryId),
                // Callback when user clicks "Import" button
                () => this.showModelImportDialog()
            );
            console.log('[App] ✓ ModelLibraryPanel created');

            // ------------------------------------------------------------
            // Log help information
            // ------------------------------------------------------------
            console.log('');
            console.log('=== Model Import Controls ===');
            console.log('  Click "Import" in Model Library panel to add .glb/.gltf models');
            console.log('  Click model in library → Click baseboard to place');
            console.log('  Click placed model → Select it');
            console.log('  Q/E         → Rotate selected model ±5°');
            console.log('  Shift+Q/E   → Rotate ±22.5°');
            console.log('  Delete      → Remove selected model');
            console.log('  ESC         → Exit placement mode / Deselect');
            console.log('  Shift+M     → Toggle model library panel');
            console.log('=============================');
            console.log('');

        } catch (error) {
            console.error('[App] Failed to initialize model system:', error);
            throw error;
        }
    }

    // ========================================================================
    // IMPORT DIALOG
    // ========================================================================

    /**
     * Show the model import dialog
     * Called when user clicks "Import" button in the library panel
     */
    protected showModelImportDialog(): void {
        if (!this.modelSystem) {
            console.error('[App] Cannot show import dialog - model system not initialized');
            return;
        }

        console.log('[App] Opening model import dialog...');

        // Create and show the import dialog
        const dialog = new ModelImportDialog(this.scene, this.modelSystem);
        dialog.show((entry) => {
            if (entry) {
                // Model was successfully imported
                console.log(`[App] Model imported: "${entry.name}" (${entry.id})`);

                // Auto-select it for placement
                this.enterModelPlacementMode(entry.id);
            } else {
                console.log('[App] Import dialog cancelled');
            }
        });
    }

    // ========================================================================
    // PLACEMENT MODE - Entering and exiting
    // ========================================================================

    /**
     * Enter model placement mode
     * Creates a preview model that follows the mouse
     * @param libraryId - The library entry ID to place
     */
    protected async enterModelPlacementMode(libraryId: string): Promise<void> {
        if (!this.modelSystem) return;

        console.log(`[App] Entering model placement mode: ${libraryId}`);

        // Clear any existing preview
        this.exitModelPlacementMode();

        // Set placement mode
        this.modelPlacementMode = libraryId;

        // Create preview model (semi-transparent)
        try {
            this.modelPreview = await this.modelSystem.createPreviewModel(libraryId);
            if (this.modelPreview) {
                console.log('[App] ✓ Preview model created');
            }
        } catch (error) {
            console.error('[App] Failed to create preview model:', error);
            this.modelPlacementMode = null;
        }
    }

    /**
     * Exit model placement mode
     * Cleans up preview model and clears selection
     */
    protected exitModelPlacementMode(): void {
        // Remove preview model
        if (this.modelPreview && this.modelSystem) {
            this.modelSystem.removeModel(this.modelPreview.id);
            this.modelPreview = null;
        }

        // Clear placement mode
        if (this.modelPlacementMode) {
            this.modelPlacementMode = null;
            this.modelLibraryPanel?.clearSelection();
            console.log('[App] Exited model placement mode');
        }
    }

    /**
     * Check if currently in model placement mode
     */
    protected isInModelPlacementMode(): boolean {
        return this.modelPlacementMode !== null;
    }

    // ========================================================================
    // POINTER EVENT HANDLERS - Integrate with your existing handlers
    // ========================================================================

    /**
     * Handle pointer move for model system
     * Call this from your existing pointer move handler
     * 
     * @param pickInfo - Pick result from scene.pick()
     */
    protected handleModelPointerMove(pickInfo: PickingInfo): void {
        // Move preview model if in placement mode
        if (this.modelPreview && this.modelSystem && pickInfo.hit && pickInfo.pickedPoint) {
            const hitMesh = pickInfo.pickedMesh;

            // Check if we hit the baseboard surface
            if (hitMesh && (hitMesh.name.includes('baseboard') ||
                hitMesh.name.includes('Board') ||
                hitMesh.name.includes('table') ||
                hitMesh.name.includes('Table'))) {

                // Position preview at hit point
                const position = new Vector3(
                    pickInfo.pickedPoint.x,
                    0, // Keep on baseboard surface
                    pickInfo.pickedPoint.z
                );
                this.modelSystem.moveModel(this.modelPreview.id, position);
            }
        }

        // Update hover highlight when not in placement mode
        if (!this.modelPlacementMode && this.modelSystem && pickInfo.hit && pickInfo.pickedMesh) {
            const modelId = this.modelSystem.getPlacedModelIdFromMesh(pickInfo.pickedMesh);
            this.modelSystem.setHoveredModel(modelId ?? undefined);
        } else if (!this.modelPlacementMode && this.modelSystem) {
            this.modelSystem.setHoveredModel(undefined);
        }
    }

    /**
     * Handle pointer down for model system
     * Call this from your existing pointer down handler
     * 
     * @param pickInfo - Pick result from scene.pick()
     * @param shiftKey - Whether shift key is held
     * @returns true if the event was handled (don't process further)
     */
    protected handleModelPointerDown(pickInfo: PickingInfo, shiftKey: boolean = false): boolean {
        // ----------------------------------------------------------------
        // Handle model placement
        // ----------------------------------------------------------------
        if (this.modelPlacementMode && pickInfo.hit && pickInfo.pickedPoint) {
            const hitMesh = pickInfo.pickedMesh;

            // Check if we hit the baseboard
            if (hitMesh && (hitMesh.name.includes('baseboard') ||
                hitMesh.name.includes('Board') ||
                hitMesh.name.includes('table') ||
                hitMesh.name.includes('Table'))) {

                // Place the model
                this.placeModelAt(pickInfo.pickedPoint, shiftKey);
                return true; // Event handled
            }
        }

        // ----------------------------------------------------------------
        // Handle model selection (when not in placement mode)
        // ----------------------------------------------------------------
        if (!this.modelPlacementMode && this.modelSystem && pickInfo.hit && pickInfo.pickedMesh) {
            const modelId = this.modelSystem.getPlacedModelIdFromMesh(pickInfo.pickedMesh);

            if (modelId) {
                // Select this model
                this.modelSystem.selectModel(modelId);
                console.log(`[App] Selected model: ${modelId}`);
                return true; // Event handled
            }
        }

        return false; // Event not handled
    }

    /**
     * Place a model at the specified position
     * @param position - World position to place at
     * @param keepPlacing - If true, stay in placement mode for multiple placements
     */
    private async placeModelAt(position: Vector3, keepPlacing: boolean = false): Promise<void> {
        if (!this.modelPlacementMode || !this.modelSystem) return;

        // Get the library entry
        const library = ModelLibrary.getInstance();
        const entry = library.getModel(this.modelPlacementMode);

        if (!entry) {
            console.error('[App] Model not found in library:', this.modelPlacementMode);
            return;
        }

        // Place the model at this position
        const placedModel = await this.modelSystem.placeModel(entry, {
            position: new Vector3(position.x, 0, position.z)
        });

        if (placedModel) {
            console.log(`[App] Placed model "${entry.name}" at (${position.x.toFixed(2)}, ${position.z.toFixed(2)})`);

            // Mark as used in library
            library.markAsUsed(entry.id);

            // If not holding shift, exit placement mode
            if (!keepPlacing) {
                this.exitModelPlacementMode();
            }
        }
    }

    // ========================================================================
    // KEYBOARD HANDLERS - Integrate with your existing keyboard handler
    // ========================================================================

    /**
     * Handle keyboard input for model system
     * Call this from your existing keyboard handler
     * 
     * @param key - The key that was pressed
     * @param shiftKey - Whether shift key is held
     * @returns true if the event was handled
     */
    protected handleModelKeyboard(key: string, shiftKey: boolean): boolean {
        // ----------------------------------------------------------------
        // ESC - Exit placement mode or deselect
        // ----------------------------------------------------------------
        if (key === 'Escape') {
            if (this.modelPlacementMode) {
                this.exitModelPlacementMode();
                return true;
            }

            if (this.modelSystem?.getSelectedModel()) {
                this.modelSystem.deselectModel();
                console.log('[App] Deselected model');
                return true;
            }
        }

        // ----------------------------------------------------------------
        // Delete - Remove selected model
        // ----------------------------------------------------------------
        if (key === 'Delete' || key === 'Backspace') {
            const selected = this.modelSystem?.getSelectedModel();
            if (selected) {
                this.modelSystem?.removeModel(selected.id);
                console.log('[App] Deleted selected model');
                return true;
            }
        }

        // ----------------------------------------------------------------
        // Q/E - Rotate selected or preview model
        // ----------------------------------------------------------------
        if (key.toLowerCase() === 'q' || key.toLowerCase() === 'e') {
            const rotationAmount = shiftKey ? 22.5 : 5;
            const direction = key.toLowerCase() === 'q' ? -1 : 1;
            const delta = rotationAmount * direction;

            // Rotate selected model
            const selected = this.modelSystem?.getSelectedModel();
            if (selected) {
                this.modelSystem?.rotateModel(selected.id, delta);
                return true;
            }

            // Rotate preview model
            if (this.modelPreview) {
                this.modelSystem?.rotateModel(this.modelPreview.id, delta);
                return true;
            }
        }

        // ----------------------------------------------------------------
        // Shift+M - Toggle model library panel
        // ----------------------------------------------------------------
        if (key.toLowerCase() === 'm' && shiftKey) {
            if (this.modelLibraryPanel) {
                const visible = this.modelLibraryPanel.isVisible();
                this.modelLibraryPanel.setVisible(!visible);
                console.log(`[App] Model library panel ${!visible ? 'shown' : 'hidden'}`);
                return true;
            }
        }

        return false; // Event not handled
    }

    // ========================================================================
    // CLEANUP - Call from your dispose() method
    // ========================================================================

    /**
     * Dispose model system resources
     * Call this from your App.dispose() method
     */
    protected disposeModelSystem(): void {
        console.log('[App] Disposing model system...');

        // Clean up preview
        this.exitModelPlacementMode();

        // Dispose UI panel
        this.modelLibraryPanel?.dispose();
        this.modelLibraryPanel = null;

        // Dispose model system
        this.modelSystem?.dispose();
        this.modelSystem = null;

        console.log('[App] ✓ Model system disposed');
    }
}

// ============================================================================
// EXAMPLE: UPDATED POINTER EVENTS SETUP
// ============================================================================

/*
// Example showing how to integrate with your existing setupPointerEvents():

private setupPointerEvents(): void {
    // Track pointer state
    let isPointerDown = false;

    // Pointer move handler
    this.scene.onPointerMove = (evt, pickInfo) => {
        // Handle model system first
        if (this.modelPlacementMode || this.modelSystem) {
            this.handleModelPointerMove(pickInfo);
        }

        // If in model placement mode, don't do anything else
        if (this.modelPlacementMode) {
            return;
        }

        // ... your existing track hover/preview code ...
    };

    // Pointer down handler
    this.scene.onPointerDown = (evt, pickInfo) => {
        isPointerDown = true;

        // Let model system handle it first
        if (this.handleModelPointerDown(pickInfo, evt.shiftKey)) {
            return; // Model system handled it
        }

        // ... your existing track placement/selection code ...
    };

    // Pointer up handler
    this.scene.onPointerUp = (evt) => {
        isPointerDown = false;
        // ... your existing code ...
    };
}
*/

// ============================================================================
// EXAMPLE: UPDATED KEYBOARD HANDLER
// ============================================================================

/*
// Example showing how to integrate with your keyboard handler:

private setupKeyboardShortcuts(): void {
    window.addEventListener('keydown', (evt) => {
        // Let model system handle keyboard first
        if (this.handleModelKeyboard(evt.key, evt.shiftKey)) {
            evt.preventDefault();
            return;
        }

        // ... your existing keyboard shortcuts ...
    });
}
*/

// ============================================================================
// EXAMPLE: INITIALIZATION IN YOUR INITIALIZE() METHOD
// ============================================================================

/*
// In your App.initialize() method, after setting up the scene:

async initialize(): Promise<void> {
    // ... your existing setup code (engine, scene, camera, etc.) ...

    // Initialize model import system
    this.initModelSystem();

    // ... rest of your initialization ...
}
*/