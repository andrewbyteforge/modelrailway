/**
 * ScaleSystemIntegration.ts - Integration guide for the scaling system
 * 
 * Path: frontend/src/integration/ScaleSystemIntegration.ts
 * 
 * This file demonstrates how to integrate the UE5-style scaling system
 * with your existing App.ts. Copy the relevant sections into your
 * actual App.ts implementation.
 * 
 * INTEGRATION STEPS:
 * 1. Add imports to your App.ts
 * 2. Add properties to your App class
 * 3. Call initScaleSystem() in initialize()
 * 4. Register objects when they are placed
 * 5. Connect to selection system
 * 
 * @module ScaleSystemIntegration
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

// ============================================================================
// STEP 1: ADD THESE IMPORTS TO YOUR App.ts
// ============================================================================

import {
    ScaleManager,
    ScaleGizmo,
    type IScalable,
    type ScalableAssetCategory,
    type ScalePivotPoint
} from '../systems/scaling';

import { TransformPanel } from '../ui/panels/TransformPanel';

// ============================================================================
// STEP 2: ADD THESE PROPERTIES TO YOUR APP CLASS
// ============================================================================

/**
 * Example integration class showing all required properties and methods
 */
export class ScaleSystemIntegrationExample {
    // Existing properties (already in your App)
    private scene!: Scene;

    // New properties for scaling system
    private scaleManager: ScaleManager | null = null;
    private transformPanel: TransformPanel | null = null;

    // ========================================================================
    // STEP 3: INITIALIZATION METHOD
    // Call this in your App.initialize() after scene setup
    // ========================================================================

    /**
     * Initialize the scaling system
     * Call this after scene, camera, and other systems are ready
     */
    protected async initScaleSystem(): Promise<void> {
        try {
            console.log('[App] Initializing scale system...');

            // ----------------------------------------------------------------
            // Create ScaleManager - handles all scale operations
            // ----------------------------------------------------------------
            this.scaleManager = new ScaleManager(this.scene, {
                // Optional: customize hotkeys
                scaleKey: 's',           // Hold S + scroll to scale
                resetKey: 'r',           // Press R to reset scale
                lockKey: 'l',            // Press L to toggle lock
                scrollSensitivity: 5,    // 5% per scroll notch
                fineMultiplier: 0.2      // Shift = 20% of normal speed
            });

            await this.scaleManager.initialize();
            console.log('[App] ✓ ScaleManager initialized');

            // ----------------------------------------------------------------
            // Create TransformPanel - UI for numeric input
            // ----------------------------------------------------------------
            this.transformPanel = new TransformPanel(this.scaleManager, {
                position: 'top-right',
                width: 280,
                showPresets: true,
                showDimensions: true,
                showReset: true,
                showLock: true,
                showPercentage: true
            });

            this.transformPanel.initialize();
            this.transformPanel.show();
            console.log('[App] ✓ TransformPanel initialized');

            // ----------------------------------------------------------------
            // Setup event listeners for scale changes
            // ----------------------------------------------------------------
            this.setupScaleEventListeners();

            // ----------------------------------------------------------------
            // Log controls
            // ----------------------------------------------------------------
            console.log('');
            console.log('=== Scale System Controls ===');
            console.log('  Select object     → Click on it');
            console.log('  Gizmo drag        → Drag corner handles');
            console.log('  S + Scroll        → Scale selected object');
            console.log('  Shift + S + Scroll→ Fine adjustment');
            console.log('  R                 → Reset to original scale');
            console.log('  L                 → Toggle scale lock');
            console.log('  Panel             → Numeric input & presets');
            console.log('=============================');
            console.log('');

        } catch (error) {
            console.error('[App] Failed to initialize scale system:', error);
            throw error;
        }
    }

    /**
     * Setup event listeners for scale system events
     */
    private setupScaleEventListeners(): void {
        if (!this.scaleManager) return;

        this.scaleManager.addEventListener((event) => {
            switch (event.type) {
                case 'scale-commit':
                    console.log(`[App] Scale committed: ${event.objectId} → ${event.scale?.toFixed(2)}`);
                    // Update any dependent systems here
                    break;

                case 'scale-reset':
                    console.log(`[App] Scale reset: ${event.objectId}`);
                    break;

                case 'lock-changed':
                    console.log(`[App] Lock changed: ${event.objectId} → ${event.data?.locked}`);
                    break;
            }
        });
    }

    // ========================================================================
    // STEP 4: REGISTER OBJECTS FOR SCALING
    // Call these when placing or loading objects
    // ========================================================================

    /**
     * Register a placed model for scaling
     * Call this whenever you place a new model in the scene
     * 
     * @param placedModel - The placed model data from ModelSystem
     */
    protected registerModelForScaling(
        id: string,
        transformNode: TransformNode,
        meshes: AbstractMesh[],
        category: ScalableAssetCategory,
        initialScale: number = 1.0
    ): void {
        if (!this.scaleManager) {
            console.warn('[App] ScaleManager not initialized');
            return;
        }

        // Calculate bounding radius from meshes
        const boundingRadius = this.calculateBoundingRadius(meshes);

        // Create scalable interface object
        const scalable: IScalable = {
            id: id,
            category: category,
            currentScale: initialScale,
            originalScale: initialScale,
            pivotPoint: this.getPivotForCategory(category),
            scaleLocked: false
        };

        // Register with scale manager
        this.scaleManager.registerScalable(
            scalable,
            transformNode,
            meshes,
            boundingRadius
        );

        console.log(`[App] Registered for scaling: ${id} (${category})`);
    }

    /**
     * Unregister an object from scaling (when deleted)
     */
    protected unregisterModelFromScaling(id: string): void {
        if (!this.scaleManager) return;
        this.scaleManager.unregisterScalable(id);
    }

    /**
     * Calculate bounding radius for an array of meshes
     */
    private calculateBoundingRadius(meshes: AbstractMesh[]): number {
        let maxRadius = 0;

        for (const mesh of meshes) {
            if (mesh.getBoundingInfo) {
                const bounds = mesh.getBoundingInfo().boundingSphere;
                if (bounds.radius > maxRadius) {
                    maxRadius = bounds.radius;
                }
            }
        }

        return maxRadius || 0.1; // Default to 0.1m if no bounds
    }

    /**
     * Get appropriate pivot point for asset category
     */
    private getPivotForCategory(category: ScalableAssetCategory): ScalePivotPoint {
        switch (category) {
            case 'rolling-stock':
                return 'center';        // Trains pivot at centre
            case 'building':
            case 'scenery':
            case 'infrastructure':
                return 'base-center';   // Buildings stay grounded
            default:
                return 'base-center';
        }
    }

    // ========================================================================
    // STEP 5: CONNECT TO SELECTION SYSTEM
    // Update these based on your existing selection handling
    // ========================================================================

    /**
     * Handle object selection
     * Call this when user clicks on a model
     */
    protected onModelSelected(modelId: string): void {
        if (!this.scaleManager) return;

        // Select in scale manager (shows gizmo)
        this.scaleManager.selectObject(modelId);
    }

    /**
     * Handle object deselection
     * Call this when user clicks away or presses Escape
     */
    protected onModelDeselected(): void {
        if (!this.scaleManager) return;

        // Deselect (hides gizmo)
        this.scaleManager.deselectObject();
    }

    // ========================================================================
    // EXAMPLE: INTEGRATION WITH EXISTING MODEL PLACEMENT
    // ========================================================================

    /**
     * Example: Modified model placement that registers for scaling
     * 
     * This shows how to modify your existing placeModel logic
     */
    protected async examplePlaceModel(
        libraryId: string,
        position: Vector3
    ): Promise<void> {
        // Your existing model placement code...
        // const placedModel = await this.modelSystem.placeModel(entry, { position });

        // After successful placement, register for scaling:
        /*
        if (placedModel) {
            this.registerModelForScaling(
                placedModel.id,
                placedModel.rootNode,
                placedModel.meshes,
                'scenery',  // or determine from model category
                placedModel.scaleFactor
            );
        }
        */
    }

    // ========================================================================
    // EXAMPLE: KEYBOARD HANDLER INTEGRATION
    // ========================================================================

    /**
     * Example: Extended keyboard handler
     * 
     * Add scale-related keyboard shortcuts to your existing handler
     */
    protected handleKeyboardWithScaling(key: string, shiftKey: boolean): boolean {
        // Scale system handles its own keyboard events via ScaleManager
        // But you might want to add Escape handling:

        if (key === 'Escape') {
            // Deselect from scale system
            this.scaleManager?.deselectObject();
            return true;
        }

        return false;
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Dispose of scale system resources
     * Call this in your App.dispose() method
     */
    protected disposeScaleSystem(): void {
        if (this.transformPanel) {
            this.transformPanel.dispose();
            this.transformPanel = null;
        }

        if (this.scaleManager) {
            this.scaleManager.dispose();
            this.scaleManager = null;
        }

        console.log('[App] Scale system disposed');
    }
}

// ============================================================================
// QUICK INTEGRATION CHECKLIST
// ============================================================================

/**
 * INTEGRATION CHECKLIST:
 * 
 * □ 1. Add imports to App.ts:
 *      - ScaleManager, TransformPanel from systems/scaling
 *      - IScalable, ScalableAssetCategory types
 * 
 * □ 2. Add properties to App class:
 *      - private scaleManager: ScaleManager | null = null;
 *      - private transformPanel: TransformPanel | null = null;
 * 
 * □ 3. In App.initialize():
 *      - Call initScaleSystem() after scene setup
 * 
 * □ 4. When placing models:
 *      - Call registerModelForScaling() after successful placement
 * 
 * □ 5. When deleting models:
 *      - Call unregisterModelFromScaling()
 * 
 * □ 6. When selecting models (click):
 *      - Call scaleManager.selectObject(id)
 * 
 * □ 7. When deselecting (Escape/click away):
 *      - Call scaleManager.deselectObject()
 * 
 * □ 8. In App.dispose():
 *      - Call disposeScaleSystem()
 * 
 * That's it! The scale system handles all the rest automatically.
 */