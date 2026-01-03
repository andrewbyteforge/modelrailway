/**
 * TrainRepositionHandler.ts - Handles train repositioning
 * 
 * Path: frontend/src/systems/train/TrainRepositionHandler.ts
 * 
 * Manages the "Lift & Move" functionality for trains.
 * When user selects "move" from the train selection modal,
 * this handler enables drag-to-reposition for that train.
 * 
 * Features:
 * - Visual feedback during repositioning (highlight, cursor)
 * - Snaps train to nearest track when released
 * - Cancellation with Escape key
 * - Integration with TrainSystem for re-registration
 * 
 * @module TrainRepositionHandler
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Scene } from '@babylonjs/core/scene';
import { Vector3, Color3 } from '@babylonjs/core/Maths/math';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { Observable } from '@babylonjs/core/Misc/observable';

import { TrainController } from './TrainController';
import { TrainSystem, type TrainRepositionRequest } from './TrainSystem';
import { TrackEdgeFinder, type EdgeFindResult } from './TrackEdgeFinder';
import { notify } from '../../ui/NotificationSystem';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Log prefix for console messages */
const LOG_PREFIX = '[TrainRepositionHandler]';

/** Highlight color for train being moved */
const MOVE_HIGHLIGHT_COLOR = new Color3(0.2, 0.6, 1.0); // Blue

/** Maximum distance from track for valid placement (meters) */
const MAX_PLACEMENT_DISTANCE = 0.1; // 100mm

/** Rail height above track surface */
const RAIL_HEIGHT = 0.00254; // 2.54mm in meters

// ============================================================================
// TYPES
// ============================================================================

/**
 * State of the repositioning operation
 */
interface RepositionState {
    /** Train being repositioned */
    trainId: string;
    /** Train controller */
    controller: TrainController;
    /** Original root node */
    rootNode: TransformNode;
    /** Original position (for cancellation) */
    originalPosition: Vector3;
    /** Original rotation Y */
    originalRotationY: number;
    /** Whether we're currently dragging */
    isDragging: boolean;
    /** Last valid track position found */
    lastValidPosition: EdgeFindResult | null;
}

/**
 * Result of repositioning operation
 */
export interface RepositionResult {
    /** Whether repositioning was successful */
    success: boolean;
    /** Train ID */
    trainId: string;
    /** New position if successful */
    newPosition?: Vector3;
    /** Error message if failed */
    error?: string;
}

// ============================================================================
// TRAIN REPOSITION HANDLER CLASS
// ============================================================================

/**
 * TrainRepositionHandler - Manages train drag-to-reposition
 * 
 * Usage:
 * 1. Subscribe to TrainSystem.onRepositionRequested
 * 2. Call startReposition() when triggered
 * 3. User drags train to new location
 * 4. Release to place, Escape to cancel
 * 
 * @example
 * ```typescript
 * const handler = new TrainRepositionHandler(scene, trainSystem);
 * 
 * trainSystem.onRepositionRequested.add((request) => {
 *     handler.startReposition(request);
 * });
 * ```
 */
export class TrainRepositionHandler {
    // ========================================================================
    // PRIVATE PROPERTIES
    // ========================================================================

    /** Babylon scene */
    private scene: Scene;

    /** Train system reference */
    private trainSystem: TrainSystem;

    /** Edge finder for track snapping */
    private edgeFinder: TrackEdgeFinder;

    /** Current reposition state */
    private state: RepositionState | null = null;

    /** Pointer observer */
    private pointerObserver: any = null;

    /** Keyboard handler */
    private keyHandler: ((e: KeyboardEvent) => void) | null = null;

    /** Original materials for restoration */
    private originalEmissiveColors: Map<AbstractMesh, Color3> = new Map();

    // ========================================================================
    // OBSERVABLES
    // ========================================================================

    /** Emitted when repositioning starts */
    public onRepositionStart: Observable<string> = new Observable();

    /** Emitted when repositioning completes */
    public onRepositionComplete: Observable<RepositionResult> = new Observable();

    /** Emitted when repositioning is cancelled */
    public onRepositionCancel: Observable<string> = new Observable();

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new TrainRepositionHandler
     * @param scene - Babylon scene
     * @param trainSystem - Train system instance
     */
    constructor(scene: Scene, trainSystem: TrainSystem) {
        this.scene = scene;
        this.trainSystem = trainSystem;
        this.edgeFinder = new TrackEdgeFinder(trainSystem.getGraph());

        console.log(`${LOG_PREFIX} Initialized`);
    }

    // ========================================================================
    // PUBLIC METHODS
    // ========================================================================

    /**
     * Start repositioning a train
     * @param request - Reposition request from TrainSystem
     */
    public startReposition(request: TrainRepositionRequest): void {
        // Cancel any existing operation
        if (this.state) {
            this.cancelReposition();
        }

        try {
            const { trainId, trainName, controller } = request;
            const rootNode = controller.getRootNode();

            if (!rootNode) {
                console.error(`${LOG_PREFIX} Train has no root node`);
                return;
            }

            // Store original position for cancellation
            const originalPosition = rootNode.position.clone();
            const originalRotationY = rootNode.rotation.y;

            // Create state
            this.state = {
                trainId,
                controller,
                rootNode,
                originalPosition,
                originalRotationY,
                isDragging: true,
                lastValidPosition: null
            };

            // Apply highlight
            this.applyMoveHighlight(controller);

            // Setup event handlers
            this.setupEventHandlers();

            // Deselect from train system (we're moving, not driving)
            this.trainSystem.deselectTrain();

            // Show notification
            notify.info(`Moving "${trainName}" - drag to new position, ESC to cancel`);

            console.log(`${LOG_PREFIX} Started repositioning: ${trainName}`);

            // Notify observers
            this.onRepositionStart.notifyObservers(trainId);

        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to start repositioning:`, error);
        }
    }

    /**
     * Check if currently repositioning
     * @returns True if in reposition mode
     */
    public isRepositioning(): boolean {
        return this.state !== null;
    }

    /**
     * Cancel the current repositioning operation
     */
    public cancelReposition(): void {
        if (!this.state) return;

        const { trainId, rootNode, originalPosition, originalRotationY, controller } = this.state;

        // Restore original position
        rootNode.position.copyFrom(originalPosition);
        rootNode.rotation.y = originalRotationY;

        // Remove highlight
        this.removeMoveHighlight(controller);

        // Cleanup
        this.cleanup();

        notify.info('Repositioning cancelled');
        console.log(`${LOG_PREFIX} Repositioning cancelled`);

        // Notify observers
        this.onRepositionCancel.notifyObservers(trainId);
    }

    /**
     * Dispose of the handler
     */
    public dispose(): void {
        if (this.state) {
            this.cancelReposition();
        }

        this.onRepositionStart.clear();
        this.onRepositionComplete.clear();
        this.onRepositionCancel.clear();

        console.log(`${LOG_PREFIX} Disposed`);
    }

    // ========================================================================
    // PRIVATE - EVENT HANDLING
    // ========================================================================

    /**
     * Setup pointer and keyboard event handlers
     */
    private setupEventHandlers(): void {
        // Pointer events
        this.pointerObserver = this.scene.onPointerObservable.add((pointerInfo) => {
            if (!this.state) return;

            switch (pointerInfo.type) {
                case PointerEventTypes.POINTERMOVE:
                    this.handlePointerMove(pointerInfo);
                    break;

                case PointerEventTypes.POINTERUP:
                    if (pointerInfo.event.button === 0) { // Left click
                        this.handlePointerUp(pointerInfo);
                    }
                    break;
            }
        });

        // Keyboard events
        this.keyHandler = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                this.cancelReposition();
            }
        };
        window.addEventListener('keydown', this.keyHandler);

        // Change cursor
        const canvas = this.scene.getEngine().getRenderingCanvas();
        if (canvas) {
            canvas.style.cursor = 'grabbing';
        }
    }

    /**
     * Remove event handlers
     */
    private removeEventHandlers(): void {
        if (this.pointerObserver) {
            this.scene.onPointerObservable.remove(this.pointerObserver);
            this.pointerObserver = null;
        }

        if (this.keyHandler) {
            window.removeEventListener('keydown', this.keyHandler);
            this.keyHandler = null;
        }

        // Reset cursor
        const canvas = this.scene.getEngine().getRenderingCanvas();
        if (canvas) {
            canvas.style.cursor = 'default';
        }
    }

    /**
     * Handle pointer move during repositioning
     */
    private handlePointerMove(pointerInfo: any): void {
        if (!this.state) return;

        const pickResult = pointerInfo.pickInfo;
        if (!pickResult?.hit || !pickResult.pickedPoint) return;

        // Find nearest track position
        const worldPos = pickResult.pickedPoint;
        const result = this.edgeFinder.findNearestEdge(worldPos, {
            maxDistance: MAX_PLACEMENT_DISTANCE
        });

        const { rootNode } = this.state;

        if (result) {
            // Snap to track
            this.state.lastValidPosition = result;

            // Position on track
            rootNode.position.x = result.position.x;
            rootNode.position.z = result.position.z;
            rootNode.position.y = result.position.y + RAIL_HEIGHT;

            // Rotate to face along track
            const angle = Math.atan2(result.forward.x, result.forward.z);
            rootNode.rotation.y = angle;

        } else {
            // Follow cursor but indicate invalid placement
            this.state.lastValidPosition = null;
            rootNode.position.x = worldPos.x;
            rootNode.position.z = worldPos.z;
            // Keep current Y height
        }
    }

    /**
     * Handle pointer up - complete repositioning
     */
    private handlePointerUp(pointerInfo: any): void {
        if (!this.state) return;

        const { trainId, controller, lastValidPosition } = this.state;

        if (lastValidPosition) {
            // Valid placement - complete repositioning
            this.completeReposition(lastValidPosition);
        } else {
            // No valid position - cancel
            notify.warning('No track nearby - repositioning cancelled');
            this.cancelReposition();
        }
    }

    // ========================================================================
    // PRIVATE - REPOSITION COMPLETION
    // ========================================================================

    /**
     * Complete the repositioning operation
     */
    private completeReposition(trackPosition: EdgeFindResult): void {
        if (!this.state) return;

        const { trainId, controller, rootNode } = this.state;

        try {
            // Re-place on the edge
            controller.placeOnEdge(trackPosition.edge.id, trackPosition.t, 1);

            // Remove highlight
            this.removeMoveHighlight(controller);

            // Get final position for result
            const newPosition = rootNode.position.clone();

            // Cleanup
            this.cleanup();

            notify.success('Train repositioned');
            console.log(`${LOG_PREFIX} Repositioning complete: ${trainId}`);

            // Notify observers
            this.onRepositionComplete.notifyObservers({
                success: true,
                trainId,
                newPosition
            });

        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to complete repositioning:`, error);

            this.onRepositionComplete.notifyObservers({
                success: false,
                trainId,
                error: String(error)
            });

            this.cancelReposition();
        }
    }

    // ========================================================================
    // PRIVATE - VISUAL FEEDBACK
    // ========================================================================

    /**
     * Apply move highlight to train meshes
     */
    private applyMoveHighlight(controller: TrainController): void {
        const meshes = controller.getMeshes();

        for (const mesh of meshes) {
            if (mesh.material && 'emissiveColor' in mesh.material) {
                // Store original
                const mat = mesh.material as any;
                this.originalEmissiveColors.set(mesh, mat.emissiveColor.clone());

                // Apply highlight
                mat.emissiveColor = MOVE_HIGHLIGHT_COLOR;
            }
        }
    }

    /**
     * Remove move highlight from train meshes
     */
    private removeMoveHighlight(controller: TrainController): void {
        const meshes = controller.getMeshes();

        for (const mesh of meshes) {
            if (mesh.material && 'emissiveColor' in mesh.material) {
                const original = this.originalEmissiveColors.get(mesh);
                if (original) {
                    (mesh.material as any).emissiveColor = original;
                } else {
                    (mesh.material as any).emissiveColor = Color3.Black();
                }
            }
        }

        this.originalEmissiveColors.clear();
    }

    // ========================================================================
    // PRIVATE - CLEANUP
    // ========================================================================

    /**
     * Cleanup state and handlers
     */
    private cleanup(): void {
        this.removeEventHandlers();
        this.state = null;
    }
}

// ============================================================================
// CONVENIENCE FUNCTION
// ============================================================================

/**
 * Create and wire up a TrainRepositionHandler
 * Automatically subscribes to TrainSystem.onRepositionRequested
 * 
 * @param scene - Babylon scene
 * @param trainSystem - Train system instance
 * @returns Configured handler
 */
export function createTrainRepositionHandler(
    scene: Scene,
    trainSystem: TrainSystem
): TrainRepositionHandler {
    const handler = new TrainRepositionHandler(scene, trainSystem);

    // Auto-subscribe to reposition requests
    trainSystem.onRepositionRequested.add((request) => {
        handler.startReposition(request);
    });

    return handler;
}