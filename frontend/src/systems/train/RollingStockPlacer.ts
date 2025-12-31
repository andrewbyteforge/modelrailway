/**
 * RollingStockPlacer.ts - Integration between model import and train system
 * 
 * Path: frontend/src/systems/train/RollingStockPlacer.ts
 * 
 * Handles placing rolling stock models on track and registering them
 * with the train system:
 * - Click-to-place workflow for imported rolling stock
 * - Automatic edge detection and positioning
 * - Correct height positioning (model bottom on rail top)
 * - Optional auto-scaling to OO gauge dimensions
 * - Train controller creation and registration
 * - Visual feedback during placement
 * 
 * CRITICAL HEIGHTS (OO Gauge):
 * - Baseboard surface:  0.950m
 * - Rail top surface:   0.958m (8mm above baseboard)
 * - Model bottom:       Should touch rail top (0.958m)
 * 
 * @module RollingStockPlacer
 * @author Model Railway Workbench
 * @version 2.0.0 - Fixed rail height positioning
 */

import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { Observable } from '@babylonjs/core/Misc/observable';

import { TrainSystem } from './TrainSystem';
import { TrackEdgeFinder, type EdgeFindResult } from './TrackEdgeFinder';
import {
    TrainPositionHelper,
    getTrainPositionHelper,
    TRACK_HEIGHTS,
    type PositionOptions,
    type AutoScaleResult
} from './TrainPositionHelper';
import type { TrainController } from './TrainController';
import type { TrackSystem } from '../track/TrackSystem';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[RollingStockPlacer]';

/** Maximum distance from track to allow placement */
const MAX_PLACEMENT_DISTANCE = 0.05; // 50mm

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Model pending placement
 */
export interface PendingModel {
    /** Root transform node */
    rootNode: TransformNode;

    /** All meshes in the model */
    meshes: AbstractMesh[];

    /** Model name */
    name: string;

    /** Model category */
    category: string;

    /** Library entry ID (optional) */
    libraryEntryId?: string;

    /** Rolling stock type hint for auto-scaling */
    typeHint?: 'locomotive' | 'coach' | 'wagon';

    /** Whether to auto-scale to OO gauge */
    autoScale?: boolean;
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

    /** Scale result if auto-scaling was applied */
    scaleResult?: AutoScaleResult;
}

/**
 * Placement end event data
 */
export interface PlacementEndEvent {
    /** Whether placement was successful */
    success: boolean;

    /** Placement result if successful */
    result?: PlacementResult;
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
 * v2.0.0 Changes:
 * - Fixed rail height positioning (was 5mm, now correct 8mm)
 * - Added model bounding box calculation for proper bottom placement
 * - Added optional auto-scaling to OO gauge dimensions
 * - Integrated TrainPositionHelper for consistent positioning
 * 
 * @example
 * ```typescript
 * const placer = new RollingStockPlacer(scene, trainSystem, trackSystem);
 * await placer.initialize();
 * 
 * // Queue a model for placement with auto-scaling
 * placer.queueForPlacement(rootNode, meshes, 'Class 66', 'locomotive', {
 *     autoScale: true,
 *     typeHint: 'locomotive'
 * });
 * 
 * // Listen for placement completion
 * placer.onPlacementEnded.add((event) => {
 *     if (event.success) {
 *         console.log('Train placed:', event.result.controller.info.name);
 *     }
 * });
 * ```
 */
export class RollingStockPlacer {
    // ========================================================================
    // PRIVATE PROPERTIES
    // ========================================================================

    /** Babylon.js scene */
    private scene: Scene;

    /** Reference to train system */
    private trainSystem: TrainSystem;

    /** Track edge finder for locating edges */
    private edgeFinder: TrackEdgeFinder;

    /** Position helper for correct height placement */
    private positionHelper: TrainPositionHelper;

    /** Whether currently in placement mode */
    private isPlacementMode: boolean = false;

    /** Model pending placement */
    private pendingModel: PendingModel | null = null;

    /** Current preview result */
    private previewResult: EdgeFindResult | null = null;

    /** Pointer observer reference */
    private pointerObserver: any = null;

    /** Whether auto-scale is enabled by default */
    private defaultAutoScale: boolean = false;

    // ========================================================================
    // OBSERVABLES
    // ========================================================================

    /** Fired when placement mode starts */
    public onPlacementStarted: Observable<PendingModel> = new Observable();

    /** Fired when placement mode ends (success or cancel) */
    public onPlacementEnded: Observable<PlacementEndEvent> = new Observable();

    /** Fired when preview position updates */
    public onPreviewUpdate: Observable<EdgeFindResult | null> = new Observable();

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new RollingStockPlacer
     * 
     * @param scene - Babylon.js scene
     * @param trainSystem - Train system for registration
     * @param trackSystem - Track system for edge finding
     */
    constructor(
        scene: Scene,
        trainSystem: TrainSystem,
        trackSystem: TrackSystem
    ) {
        this.scene = scene;
        this.trainSystem = trainSystem;

        // Create edge finder from track graph
        const graph = trackSystem.getGraph();
        if (!graph) {
            throw new Error(`${LOG_PREFIX} TrackSystem must have a valid graph`);
        }
        this.edgeFinder = new TrackEdgeFinder(graph);

        // Get position helper
        this.positionHelper = getTrainPositionHelper();

        console.log(`${LOG_PREFIX} Created`);
        console.log(`${LOG_PREFIX} Rail top height: ${TRACK_HEIGHTS.RAIL_TOP_Y.toFixed(4)}m`);
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the placer
     */
    async initialize(): Promise<void> {
        // Setup pointer events
        this.setupPointerEvents();

        console.log(`${LOG_PREFIX} Initialized`);
    }

    /**
     * Setup pointer event handling
     */
    private setupPointerEvents(): void {
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

    // ========================================================================
    // CONFIGURATION
    // ========================================================================

    /**
     * Enable or disable auto-scaling by default
     * 
     * @param enabled - Whether to auto-scale new models
     */
    setDefaultAutoScale(enabled: boolean): void {
        this.defaultAutoScale = enabled;
        console.log(`${LOG_PREFIX} Default auto-scale: ${enabled}`);
    }

    // ========================================================================
    // PLACEMENT WORKFLOW
    // ========================================================================

    /**
     * Queue a model for placement on track
     * 
     * @param rootNode - Root transform node of the model
     * @param meshes - All meshes in the model (for bounds calculation)
     * @param name - Display name
     * @param category - Category (locomotive, coach, wagon)
     * @param options - Optional placement options
     */
    queueForPlacement(
        rootNode: TransformNode,
        meshes: AbstractMesh[],
        name: string,
        category: string,
        options?: {
            libraryEntryId?: string;
            typeHint?: 'locomotive' | 'coach' | 'wagon';
            autoScale?: boolean;
        }
    ): void {
        // Cancel any existing placement
        if (this.pendingModel) {
            this.cancelPlacement();
        }

        // Determine type hint from category if not provided
        let typeHint = options?.typeHint;
        if (!typeHint) {
            const lowerCategory = category.toLowerCase();
            if (lowerCategory.includes('loco') || lowerCategory.includes('engine')) {
                typeHint = 'locomotive';
            } else if (lowerCategory.includes('coach') || lowerCategory.includes('carriage')) {
                typeHint = 'coach';
            } else if (lowerCategory.includes('wagon') || lowerCategory.includes('freight')) {
                typeHint = 'wagon';
            }
        }

        this.pendingModel = {
            rootNode,
            meshes,
            name,
            category,
            libraryEntryId: options?.libraryEntryId,
            typeHint,
            autoScale: options?.autoScale ?? this.defaultAutoScale
        };

        this.isPlacementMode = true;

        // Hide the model initially until we have a valid preview
        rootNode.setEnabled(false);

        // Log model info
        const bounds = this.positionHelper.calculateModelBounds(rootNode, meshes);
        console.log(`${LOG_PREFIX} Queued "${name}" for placement`);
        console.log(`${LOG_PREFIX}   Category: ${category}`);
        console.log(`${LOG_PREFIX}   Type hint: ${typeHint || 'auto-detect'}`);
        console.log(`${LOG_PREFIX}   Auto-scale: ${this.pendingModel.autoScale}`);
        console.log(`${LOG_PREFIX}   Model size: ${(bounds.width * 1000).toFixed(1)}mm × ${(bounds.height * 1000).toFixed(1)}mm × ${(bounds.depth * 1000).toFixed(1)}mm`);

        // Notify observers
        this.onPlacementStarted.notifyObservers(this.pendingModel);

        // Show instructions
        this.showPlacementInstructions();
    }

    /**
     * Queue for placement (simplified overload without meshes array)
     * Will collect meshes from the rootNode
     */
    queueForPlacementSimple(
        rootNode: TransformNode,
        name: string,
        category: string,
        libraryEntryId?: string
    ): void {
        // Collect meshes from the node hierarchy
        const meshes = this.collectMeshes(rootNode);

        this.queueForPlacement(rootNode, meshes, name, category, { libraryEntryId });
    }

    /**
     * Collect all meshes from a node hierarchy
     */
    private collectMeshes(node: TransformNode): AbstractMesh[] {
        const meshes: AbstractMesh[] = [];

        const traverse = (n: TransformNode) => {
            if (n instanceof AbstractMesh) {
                meshes.push(n);
            }
            for (const child of n.getChildren()) {
                if (child instanceof TransformNode) {
                    traverse(child);
                }
            }
        };

        traverse(node);
        return meshes;
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
        const model = this.pendingModel;
        const rootNode = model.rootNode;

        // Enable and position the model for preview
        rootNode.setEnabled(true);

        // ----------------------------------------------------------------
        // CORRECT POSITIONING: Use TrainPositionHelper
        // ----------------------------------------------------------------

        // Build track position (X/Z from edge, Y will be calculated)
        const trackPosition = new Vector3(
            result.position.x,
            0, // Will be recalculated
            result.position.z
        );

        // Position the model correctly on the rails
        this.positionHelper.positionOnTrack(
            rootNode,
            model.meshes,
            trackPosition,
            {
                // Don't auto-scale during preview, just position
                autoScale: false
            }
        );

        // Rotate to face along track
        const angle = Math.atan2(result.forward.x, result.forward.z);
        rootNode.rotation.y = angle;

        // Apply preview transparency
        this.applyPreviewMaterial(rootNode);

        // Notify observers
        this.onPreviewUpdate.notifyObservers(result);
    }

    /**
     * Hide preview
     */
    private hidePreview(): void {
        if (this.pendingModel) {
            this.pendingModel.rootNode.setEnabled(false);
        }
        this.previewResult = null;
        this.onPreviewUpdate.notifyObservers(null);
    }

    /**
     * Apply preview visual effect
     */
    private applyPreviewMaterial(node: TransformNode): void {
        // For now, just ensure the model is visible
        // Could add transparency or glow effect here
        // TODO: Add semi-transparent preview effect
    }

    /**
     * Remove preview visual effect
     */
    private removePreviewMaterial(node: TransformNode): void {
        // Restore original materials
        // TODO: Restore from preview effect
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

        console.log(`${LOG_PREFIX} Placing "${model.name}" on track...`);

        // Remove preview effect
        this.removePreviewMaterial(rootNode);

        // Enable the model
        rootNode.setEnabled(true);

        // ----------------------------------------------------------------
        // FINAL POSITIONING WITH OPTIONAL AUTO-SCALE
        // ----------------------------------------------------------------

        const trackPosition = new Vector3(
            result.position.x,
            0,
            result.position.z
        );

        let scaleResult: AutoScaleResult | undefined;

        if (model.autoScale) {
            // Auto-scale and position
            const combined = this.positionHelper.autoScaleAndPosition(
                rootNode,
                model.meshes,
                trackPosition,
                {
                    autoScale: true,
                    typeHint: model.typeHint
                }
            );
            scaleResult = combined.scale;

            console.log(`${LOG_PREFIX} Auto-scaled to ${scaleResult.scaleFactor.toFixed(4)}`);
            console.log(`${LOG_PREFIX}   Detected type: ${scaleResult.detectedType}`);
            console.log(`${LOG_PREFIX}   Original length: ${(scaleResult.originalLength * 1000).toFixed(1)}mm`);
            console.log(`${LOG_PREFIX}   Target length: ${(scaleResult.targetLength * 1000).toFixed(1)}mm`);
        } else {
            // Just position without scaling
            this.positionHelper.positionOnTrack(
                rootNode,
                model.meshes,
                trackPosition
            );
        }

        // Rotate to face along track
        const angle = Math.atan2(result.forward.x, result.forward.z);
        rootNode.rotation.y = angle;

        // Log final position
        console.log(`${LOG_PREFIX} Final position: (${rootNode.position.x.toFixed(4)}, ${rootNode.position.y.toFixed(4)}, ${rootNode.position.z.toFixed(4)})`);
        console.log(`${LOG_PREFIX} Rail top Y: ${TRACK_HEIGHTS.RAIL_TOP_Y.toFixed(4)}m`);

        // Debug: verify positioning
        const debugInfo = this.positionHelper.getDebugInfo(rootNode, model.meshes);
        console.log(debugInfo);

        // ----------------------------------------------------------------
        // REGISTER WITH TRAIN SYSTEM
        // ----------------------------------------------------------------

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

        // Build placement result
        const placementResult: PlacementResult = {
            controller,
            edgeId: result.edge.id,
            t: result.t,
            position: rootNode.position.clone(),
            scaleResult
        };

        // Clear placement state
        this.pendingModel = null;
        this.previewResult = null;
        this.isPlacementMode = false;

        // Hide instructions
        this.hidePlacementInstructions();

        // Notify observers
        this.onPlacementEnded.notifyObservers({
            success: true,
            result: placementResult
        });

        console.log(`${LOG_PREFIX} ✓ "${model.name}" placed successfully on edge ${result.edge.id}`);
    }

    // ========================================================================
    // UI HELPERS
    // ========================================================================

    /**
     * Show placement instructions overlay
     */
    private showPlacementInstructions(): void {
        // Check if instructions already exist
        let overlay = document.getElementById('rolling-stock-placement-instructions');
        if (overlay) return;

        overlay = document.createElement('div');
        overlay.id = 'rolling-stock-placement-instructions';
        overlay.innerHTML = `
            <div style="
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 12px 24px;
                border-radius: 8px;
                font-family: system-ui, sans-serif;
                font-size: 14px;
                z-index: 10000;
                text-align: center;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            ">
                <div style="font-weight: 600; margin-bottom: 4px;">🚂 Place Rolling Stock</div>
                <div style="opacity: 0.9;">Click on a track piece to place the train</div>
                <div style="opacity: 0.7; font-size: 12px; margin-top: 4px;">Press Escape to cancel</div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Add escape key listener
        this.setupEscapeKeyHandler();
    }

    /**
     * Hide placement instructions
     */
    private hidePlacementInstructions(): void {
        const overlay = document.getElementById('rolling-stock-placement-instructions');
        if (overlay) {
            overlay.remove();
        }
        this.removeEscapeKeyHandler();
    }

    /** Escape key handler reference */
    private escapeHandler: ((e: KeyboardEvent) => void) | null = null;

    /**
     * Setup escape key to cancel placement
     */
    private setupEscapeKeyHandler(): void {
        this.escapeHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && this.isPlacementMode) {
                this.cancelPlacement();
            }
        };
        document.addEventListener('keydown', this.escapeHandler);
    }

    /**
     * Remove escape key handler
     */
    private removeEscapeKeyHandler(): void {
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
            this.escapeHandler = null;
        }
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Dispose a model node and all children
     */
    private disposeModelNode(node: TransformNode): void {
        try {
            node.dispose(false, true);
        } catch (e) {
            console.warn(`${LOG_PREFIX} Error disposing model:`, e);
        }
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
            this.pointerObserver = null;
        }

        // Clear observables
        this.onPlacementStarted.clear();
        this.onPlacementEnded.clear();
        this.onPreviewUpdate.clear();

        // Remove UI
        this.hidePlacementInstructions();

        console.log(`${LOG_PREFIX} Disposed`);
    }
}