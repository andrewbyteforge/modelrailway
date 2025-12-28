/**
 * RollingStockPlacer.ts - Integration between model import and train system
 * 
 * Path: frontend/src/systems/train/RollingStockPlacer.ts
 * 
 * Handles placing rolling stock models on track and registering them
 * with the train system:
 * - Click-to-place workflow for imported rolling stock
 * - Automatic edge detection and positioning
 * - Train controller creation and registration
 * - Visual feedback during placement
 * 
 * This bridges the gap between ModelImportButton/TrackModelPlacer and TrainSystem.
 * 
 * @module RollingStockPlacer
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { Observable } from '@babylonjs/core/Misc/observable';
import { TrainSystem } from './TrainSystem';
import { TrackEdgeFinder, type EdgeFindResult } from './TrackEdgeFinder';
import type { TrainController } from './TrainController';
import type { TrackSystem } from '../track/TrackSystem';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[RollingStockPlacer]';

/** Maximum distance from track to allow placement */
const MAX_PLACEMENT_DISTANCE = 0.05; // 50mm

/** Rail surface height offset */
const RAIL_HEIGHT = 0.005; // 5mm

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Model pending placement
 */
export interface PendingModel {
    /** Root transform node */
    rootNode: TransformNode;

    /** Model name */
    name: string;

    /** Model category */
    category: string;

    /** Library entry ID (optional) */
    libraryEntryId?: string;
}

/**
 * Placement result
 */
export interface PlacementResult {
    /** Created train controller */
    controller: TrainController;

    /** Edge the train was placed on */
    edgeId: string;

    /** Parametric position on edge */
    t: number;

    /** World position */
    position: Vector3;
}

// ============================================================================
// ROLLING STOCK PLACER CLASS
// ============================================================================

/**
 * RollingStockPlacer - Places rolling stock models on track
 * 
 * Provides a click-to-place workflow for imported rolling stock models.
 * When a model is queued for placement, clicking on track places it
 * at that location and registers it with the train system.
 * 
 * @example
 * ```typescript
 * const placer = new RollingStockPlacer(scene, trackSystem, trainSystem);
 * placer.initialize();
 * 
 * // Queue a model for placement
 * placer.queueForPlacement(modelRoot, 'Class 66', 'locomotive');
 * // User clicks on track -> model is placed and registered
 * ```
 */
export class RollingStockPlacer {
    // ========================================================================
    // PRIVATE STATE
    // ========================================================================

    /** Babylon scene */
    private scene: Scene;

    /** Track system reference */
    private trackSystem: TrackSystem;

    /** Train system reference */
    private trainSystem: TrainSystem;

    /** Edge finder utility */
    private edgeFinder: TrackEdgeFinder;

    /** Currently pending model for placement */
    private pendingModel: PendingModel | null = null;

    /** Preview result during hover */
    private previewResult: EdgeFindResult | null = null;

    /** Pointer observer reference */
    private pointerObserver: any = null;

    /** Is placement mode active */
    private isPlacementMode: boolean = false;

    // ========================================================================
    // OBSERVABLES
    // ========================================================================

    /** Emitted when placement mode starts */
    public onPlacementStarted: Observable<PendingModel> = new Observable();

    /** Emitted when placement mode ends (success or cancel) */
    public onPlacementEnded: Observable<{ success: boolean; result?: PlacementResult }> = new Observable();

    /** Emitted when placement is successful */
    public onPlaced: Observable<PlacementResult> = new Observable();

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new RollingStockPlacer
     * @param scene - Babylon scene
     * @param trackSystem - Track system reference
     * @param trainSystem - Train system reference
     */
    constructor(
        scene: Scene,
        trackSystem: TrackSystem,
        trainSystem: TrainSystem
    ) {
        this.scene = scene;
        this.trackSystem = trackSystem;
        this.trainSystem = trainSystem;

        // Create edge finder
        this.edgeFinder = new TrackEdgeFinder(trackSystem.getGraph());

        console.log(`${LOG_PREFIX} Rolling stock placer created`);
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the placer
     */
    initialize(): void {
        this.setupPointerHandling();
        this.setupKeyboardHandling();

        console.log(`${LOG_PREFIX} ✓ Initialized`);
    }

    /**
     * Setup pointer event handling
     */
    private setupPointerHandling(): void {
        this.pointerObserver = this.scene.onPointerObservable.add((pointerInfo) => {
            if (!this.isPlacementMode) return;

            switch (pointerInfo.type) {
                case PointerEventTypes.POINTERMOVE:
                    this.handlePointerMove(pointerInfo);
                    break;
                case PointerEventTypes.POINTERDOWN:
                    this.handlePointerDown(pointerInfo);
                    break;
            }
        });
    }

    /**
     * Setup keyboard handling
     */
    private setupKeyboardHandling(): void {
        window.addEventListener('keydown', (event) => {
            if (!this.isPlacementMode) return;

            if (event.key === 'Escape') {
                event.preventDefault();
                this.cancelPlacement();
            }
        });
    }

    // ========================================================================
    // PLACEMENT WORKFLOW
    // ========================================================================

    /**
     * Queue a model for placement on track
     * @param rootNode - Root transform node of the model
     * @param name - Model name
     * @param category - Model category (locomotive, coach, wagon, etc.)
     * @param libraryEntryId - Optional library entry ID
     */
    queueForPlacement(
        rootNode: TransformNode,
        name: string,
        category: string,
        libraryEntryId?: string
    ): void {
        // Cancel any existing placement
        if (this.pendingModel) {
            this.cancelPlacement();
        }

        this.pendingModel = {
            rootNode,
            name,
            category,
            libraryEntryId
        };

        this.isPlacementMode = true;

        // Hide the model initially until we have a valid preview
        rootNode.setEnabled(false);

        // Notify observers
        this.onPlacementStarted.notifyObservers(this.pendingModel);

        // Show instructions
        this.showPlacementInstructions();

        console.log(`${LOG_PREFIX} Queued "${name}" for placement - click on track to place`);
    }

    /**
     * Cancel current placement
     */
    cancelPlacement(): void {
        if (!this.pendingModel) return;

        const model = this.pendingModel;

        // Dispose the model (it was never placed)
        this.disposeModelNode(model.rootNode);

        this.pendingModel = null;
        this.previewResult = null;
        this.isPlacementMode = false;

        // Hide instructions
        this.hidePlacementInstructions();

        // Notify observers
        this.onPlacementEnded.notifyObservers({ success: false });

        console.log(`${LOG_PREFIX} Placement cancelled`);
    }

    /**
     * Check if placement mode is active
     * @returns true if in placement mode
     */
    isInPlacementMode(): boolean {
        return this.isPlacementMode;
    }

    // ========================================================================
    // POINTER HANDLING
    // ========================================================================

    /**
     * Handle pointer move during placement
     */
    private handlePointerMove(pointerInfo: any): void {
        if (!this.pendingModel) return;

        const pickResult = pointerInfo.pickInfo;
        if (!pickResult?.hit) {
            this.hidePreview();
            return;
        }

        // Get world position from pick
        const worldPos = pickResult.pickedPoint;
        if (!worldPos) {
            this.hidePreview();
            return;
        }

        // Find nearest edge
        const result = this.edgeFinder.findNearestEdge(worldPos, {
            maxDistance: MAX_PLACEMENT_DISTANCE
        });

        if (!result) {
            this.hidePreview();
            return;
        }

        // Show preview
        this.showPreview(result);
    }

    /**
     * Handle pointer down during placement
     */
    private handlePointerDown(pointerInfo: any): void {
        if (!this.pendingModel || !this.previewResult) return;

        // Only handle left click
        if (pointerInfo.event.button !== 0) return;

        // Place the model
        this.placeModel(this.previewResult);
    }

    // ========================================================================
    // PREVIEW
    // ========================================================================

    /**
     * Show preview of model at track position
     */
    private showPreview(result: EdgeFindResult): void {
        if (!this.pendingModel) return;

        this.previewResult = result;
        const model = this.pendingModel.rootNode;

        // Enable and position
        model.setEnabled(true);

        // Set position (with rail height offset)
        model.position.copyFrom(result.position);
        model.position.y += RAIL_HEIGHT;

        // Rotate to face along track
        const angle = Math.atan2(result.forward.x, result.forward.z);
        model.rotation.y = angle;

        // Optional: Add a slight transparency or highlight to indicate preview
        this.applyPreviewMaterial(model);
    }

    /**
     * Hide preview
     */
    private hidePreview(): void {
        if (this.pendingModel) {
            this.pendingModel.rootNode.setEnabled(false);
        }
        this.previewResult = null;
    }

    /**
     * Apply preview visual effect
     */
    private applyPreviewMaterial(node: TransformNode): void {
        // For now, just ensure the model is visible
        // Could add transparency or glow effect here
    }

    /**
     * Remove preview visual effect
     */
    private removePreviewMaterial(node: TransformNode): void {
        // Restore original materials
    }

    // ========================================================================
    // MODEL PLACEMENT
    // ========================================================================

    /**
     * Place the model at the given edge position
     */
    private placeModel(result: EdgeFindResult): void {
        if (!this.pendingModel) return;

        const model = this.pendingModel;
        const rootNode = model.rootNode;

        // Remove preview effect
        this.removePreviewMaterial(rootNode);

        // Enable the model
        rootNode.setEnabled(true);

        // Final positioning (same as preview but permanent)
        rootNode.position.copyFrom(result.position);
        rootNode.position.y += RAIL_HEIGHT;

        const angle = Math.atan2(result.forward.x, result.forward.z);
        rootNode.rotation.y = angle;

        // Register with train system
        const controller = this.trainSystem.addTrain(
            rootNode,
            {
                name: model.name,
                category: model.category,
                libraryEntryId: model.libraryEntryId
            }
        );

        // Place on track edge
        controller.placeOnEdge(result.edge.id, result.t, 1);

        // Auto-select the newly placed train
        controller.select();

        // Create result
        const placementResult: PlacementResult = {
            controller,
            edgeId: result.edge.id,
            t: result.t,
            position: result.position.clone()
        };

        // Clear pending state
        this.pendingModel = null;
        this.previewResult = null;
        this.isPlacementMode = false;

        // Hide instructions
        this.hidePlacementInstructions();

        // Notify observers
        this.onPlaced.notifyObservers(placementResult);
        this.onPlacementEnded.notifyObservers({ success: true, result: placementResult });

        console.log(`${LOG_PREFIX} ✓ Placed "${model.name}" on edge ${result.edge.id} at t=${result.t.toFixed(3)}`);
    }

    // ========================================================================
    // UI HELPERS
    // ========================================================================

    /**
     * Show placement instructions overlay
     */
    private showPlacementInstructions(): void {
        // Remove any existing instructions
        this.hidePlacementInstructions();

        const overlay = document.createElement('div');
        overlay.id = 'rolling-stock-placement-instructions';
        overlay.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 14px;
            z-index: 2000;
            display: flex;
            align-items: center;
            gap: 12px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        `;

        overlay.innerHTML = `
            <span style="font-size: 24px;">🚂</span>
            <div>
                <strong>Place Rolling Stock</strong><br>
                <span style="color: #aaa; font-size: 12px;">Click on track to place · Escape to cancel</span>
            </div>
        `;

        document.body.appendChild(overlay);
    }

    /**
     * Hide placement instructions overlay
     */
    private hidePlacementInstructions(): void {
        const existing = document.getElementById('rolling-stock-placement-instructions');
        if (existing) {
            existing.remove();
        }
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Dispose a model node and its children
     */
    private disposeModelNode(node: TransformNode): void {
        // Dispose all descendant meshes
        const descendants = node.getDescendants(false);
        for (const child of descendants) {
            if (child instanceof AbstractMesh) {
                child.dispose();
            }
        }

        // Dispose the node itself
        node.dispose();
    }

    /**
     * Dispose the placer
     */
    dispose(): void {
        // Cancel any pending placement
        if (this.pendingModel) {
            this.cancelPlacement();
        }

        // Remove pointer observer
        if (this.pointerObserver) {
            this.scene.onPointerObservable.remove(this.pointerObserver);
        }

        // Clear observables
        this.onPlacementStarted.clear();
        this.onPlacementEnded.clear();
        this.onPlaced.clear();

        // Hide instructions
        this.hidePlacementInstructions();

        console.log(`${LOG_PREFIX} Disposed`);
    }
}