/**
 * RollingStockImporter.ts - Simplified rolling stock import and placement
 * 
 * Path: frontend/src/systems/train/RollingStockImporter.ts
 * 
 * A SIMPLE approach to importing and placing locomotives:
 * 
 * 1. Import model → Auto-scale to OO gauge (230mm for locomotive)
 * 2. Show popup: "Click on track to place your locomotive"
 * 3. User clicks on track → Model placed at that position
 * 4. Model registered as controllable train
 * 
 * NO complex scanning, NO browser freezing, just simple click-to-place.
 * 
 * @module RollingStockImporter
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { Observable } from '@babylonjs/core/Misc/observable';
import type { TrackSystem } from '../track/TrackSystem';
import type { TrainSystem } from './TrainSystem';
import type { TrainController } from './TrainController';
import { notify } from '../../ui/NotificationSystem';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[RollingStockImporter]';

/** OO gauge target lengths in meters */
const OO_TARGET_LENGTHS = {
    locomotive: 0.230,      // 230mm - standard diesel/electric
    steam: 0.200,           // 200mm - steam locomotive
    coach: 0.275,           // 275mm - passenger coach
    wagon: 0.120,           // 120mm - freight wagon
    default: 0.230          // Default to locomotive size
};

/** Rail surface height above baseboard */
const RAIL_HEIGHT = 0.006;  // 6mm

/** Maximum click distance from track centerline */
const MAX_TRACK_DISTANCE = 0.05;  // 50mm

// ============================================================================
// TYPES
// ============================================================================

/** Rolling stock type for scaling */
export type RollingStockType = 'locomotive' | 'steam' | 'coach' | 'wagon';

/** Pending placement data */
interface PendingPlacement {
    /** Root node of the model */
    rootNode: TransformNode;
    /** Display name */
    name: string;
    /** Type for train registration */
    type: RollingStockType;
    /** Original scale before placement preview */
    originalScale: Vector3;
    /** Notification ID to dismiss */
    notificationId: string;
}

/** Placement result */
export interface PlacementResult {
    /** Whether placement succeeded */
    success: boolean;
    /** Train controller if successful */
    controller?: TrainController;
    /** Error message if failed */
    error?: string;
}

// ============================================================================
// ROLLING STOCK IMPORTER CLASS
// ============================================================================

/**
 * RollingStockImporter - Simple import and click-to-place for trains
 * 
 * @example
 * ```typescript
 * const importer = new RollingStockImporter(scene, trackSystem, trainSystem);
 * 
 * // After importing a model, queue it for placement:
 * importer.queueForPlacement(modelRoot, 'Class 66', 'locomotive');
 * 
 * // User clicks on track → model is placed and registered
 * importer.onPlaced.add((result) => {
 *     if (result.success) {
 *         console.log('Train placed!', result.controller);
 *     }
 * });
 * ```
 */
export class RollingStockImporter {
    // ========================================================================
    // PRIVATE STATE
    // ========================================================================

    /** Babylon scene */
    private scene: Scene;

    /** Track system for finding track positions */
    private trackSystem: TrackSystem;

    /** Train system for registering trains */
    private trainSystem: TrainSystem;

    /** Currently pending placement */
    private pending: PendingPlacement | null = null;

    /** Pointer observer */
    private pointerObserver: any = null;

    /** Keyboard observer for escape */
    private keyHandler: ((e: KeyboardEvent) => void) | null = null;

    // ========================================================================
    // OBSERVABLES
    // ========================================================================

    /** Fired when placement completes (success or failure) */
    public onPlaced: Observable<PlacementResult> = new Observable();

    /** Fired when placement is cancelled */
    public onCancelled: Observable<TransformNode> = new Observable();

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new RollingStockImporter
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

        console.log(`${LOG_PREFIX} ✓ Created`);
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /**
     * Queue a model for placement on track
     * 
     * This will:
     * 1. Auto-scale the model to correct OO gauge size
     * 2. Show a notification asking user to click on track
     * 3. Enable click-to-place mode
     * 
     * @param rootNode - Root transform node of the imported model
     * @param name - Display name for the model
     * @param type - Type of rolling stock (affects target size)
     */
    queueForPlacement(
        rootNode: TransformNode,
        name: string,
        type: RollingStockType = 'locomotive'
    ): void {
        // Cancel any existing placement
        if (this.pending) {
            this.cancelPlacement();
        }

        console.log(`${LOG_PREFIX} Queueing for placement: "${name}" (${type})`);

        // ====================================================================
        // Step 1: Calculate and apply correct scale
        // ====================================================================
        const scaleFactor = this.calculateScale(rootNode, type);
        const originalScale = rootNode.scaling.clone();

        rootNode.scaling = new Vector3(scaleFactor, scaleFactor, scaleFactor);
        console.log(`${LOG_PREFIX}   Applied scale: ${scaleFactor.toFixed(4)} (${(scaleFactor * 100).toFixed(1)}%)`);

        // ====================================================================
        // Step 2: Hide model until placed
        // ====================================================================
        rootNode.setEnabled(false);

        // ====================================================================
        // Step 3: Show notification
        // ====================================================================
        const notificationId = notify.placement(
            `🚂 Click on track to place "${name}"`,
            () => this.cancelPlacement()
        );

        // ====================================================================
        // Step 4: Store pending and enable click mode
        // ====================================================================
        this.pending = {
            rootNode,
            name,
            type,
            originalScale,
            notificationId
        };

        this.enableClickMode();
    }

    /**
     * Cancel the current placement
     */
    cancelPlacement(): void {
        if (!this.pending) return;

        console.log(`${LOG_PREFIX} Placement cancelled for "${this.pending.name}"`);

        // Dismiss notification
        notify.dismiss(this.pending.notificationId);

        // Restore original scale and re-enable
        this.pending.rootNode.scaling = this.pending.originalScale;
        this.pending.rootNode.setEnabled(true);

        // Fire event
        this.onCancelled.notifyObservers(this.pending.rootNode);

        // Clear state
        this.pending = null;
        this.disableClickMode();
    }

    /**
     * Check if placement mode is active
     */
    isPlacementActive(): boolean {
        return this.pending !== null;
    }

    // ========================================================================
    // SCALE CALCULATION
    // ========================================================================

    /**
     * Calculate the scale factor to resize model to OO gauge
     * @param rootNode - Model root node
     * @param type - Rolling stock type
     * @returns Scale factor to apply
     */
    private calculateScale(rootNode: TransformNode, type: RollingStockType): number {
        // Get current bounding info
        const meshes = rootNode.getChildMeshes(false);
        if (meshes.length === 0) {
            console.warn(`${LOG_PREFIX} No meshes found in model`);
            return 1;
        }

        // Calculate combined bounds
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        for (const mesh of meshes) {
            mesh.computeWorldMatrix(true);
            const bounds = mesh.getBoundingInfo();
            if (!bounds) continue;

            const min = bounds.boundingBox.minimumWorld;
            const max = bounds.boundingBox.maximumWorld;

            minX = Math.min(minX, min.x);
            minY = Math.min(minY, min.y);
            minZ = Math.min(minZ, min.z);
            maxX = Math.max(maxX, max.x);
            maxY = Math.max(maxY, max.y);
            maxZ = Math.max(maxZ, max.z);
        }

        // Calculate dimensions
        const width = maxX - minX;
        const height = maxY - minY;
        const depth = maxZ - minZ;
        const maxDimension = Math.max(width, height, depth);

        console.log(`${LOG_PREFIX} Model dimensions: ${(width * 1000).toFixed(1)}mm × ${(height * 1000).toFixed(1)}mm × ${(depth * 1000).toFixed(1)}mm`);
        console.log(`${LOG_PREFIX} Max dimension: ${(maxDimension * 1000).toFixed(1)}mm`);

        // Get target length
        const targetLength = OO_TARGET_LENGTHS[type] || OO_TARGET_LENGTHS.default;
        console.log(`${LOG_PREFIX} Target length for ${type}: ${(targetLength * 1000).toFixed(0)}mm`);

        // Calculate scale: target / current
        if (maxDimension <= 0) {
            console.warn(`${LOG_PREFIX} Invalid model dimension`);
            return 1;
        }

        const scaleFactor = targetLength / maxDimension;
        const resultLength = maxDimension * scaleFactor;

        console.log(`${LOG_PREFIX} Scale factor: ${scaleFactor.toFixed(6)}`);
        console.log(`${LOG_PREFIX} Result length: ${(resultLength * 1000).toFixed(1)}mm`);

        return scaleFactor;
    }

    // ========================================================================
    // CLICK MODE HANDLING
    // ========================================================================

    /**
     * Enable click-to-place mode
     */
    private enableClickMode(): void {
        // Pointer handler for clicks
        this.pointerObserver = this.scene.onPointerObservable.add((info) => {
            if (info.type === PointerEventTypes.POINTERDOWN) {
                if (info.event.button === 0) {  // Left click
                    this.handleClick(info);
                }
            } else if (info.type === PointerEventTypes.POINTERMOVE) {
                this.handleMove(info);
            }
        });

        // Escape key to cancel
        this.keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.cancelPlacement();
            }
        };
        window.addEventListener('keydown', this.keyHandler);

        console.log(`${LOG_PREFIX} Click mode enabled (click on track or press ESC to cancel)`);
    }

    /**
     * Disable click-to-place mode
     */
    private disableClickMode(): void {
        if (this.pointerObserver) {
            this.scene.onPointerObservable.remove(this.pointerObserver);
            this.pointerObserver = null;
        }

        if (this.keyHandler) {
            window.removeEventListener('keydown', this.keyHandler);
            this.keyHandler = null;
        }
    }

    /**
     * Handle pointer move for preview
     */
    private handleMove(info: any): void {
        if (!this.pending) return;

        const pickResult = info.pickInfo;
        if (!pickResult?.hit || !pickResult.pickedPoint) {
            this.pending.rootNode.setEnabled(false);
            return;
        }

        // Find track position
        const trackPos = this.findTrackPosition(pickResult.pickedPoint);

        if (trackPos) {
            // Show preview at track position
            this.pending.rootNode.setEnabled(true);
            this.pending.rootNode.position.copyFrom(trackPos.position);
            this.pending.rootNode.position.y = trackPos.position.y + RAIL_HEIGHT;

            // Rotate to face along track
            const angle = Math.atan2(trackPos.forward.x, trackPos.forward.z);
            this.pending.rootNode.rotation.y = angle;
        } else {
            // Hide if not near track
            this.pending.rootNode.setEnabled(false);
        }
    }

    /**
     * Handle click to place
     */
    private handleClick(info: any): void {
        if (!this.pending) return;

        const pickResult = info.pickInfo;
        if (!pickResult?.hit || !pickResult.pickedPoint) {
            notify.warning('Click on the track to place your locomotive');
            return;
        }

        // Find track position
        const trackPos = this.findTrackPosition(pickResult.pickedPoint);

        if (!trackPos) {
            notify.warning('Please click directly on a track piece');
            return;
        }

        // Place the model!
        this.placeModel(trackPos);
    }

    // ========================================================================
    // TRACK FINDING
    // ========================================================================

    /**
     * Find the nearest track position to a world point
     * @param worldPoint - World position from pick
     * @returns Track position info or null if not near track
     */
    private findTrackPosition(worldPoint: Vector3): {
        position: Vector3;
        forward: Vector3;
        edgeId: string;
        t: number;
    } | null {
        try {
            const graph = this.trackSystem.getGraph();
            if (!graph) return null;

            const edges = graph.getAllEdges();
            if (!edges || edges.length === 0) return null;

            let bestResult: {
                position: Vector3;
                forward: Vector3;
                edgeId: string;
                t: number;
                distance: number;
            } | null = null;

            // Simple search - check each edge
            for (const edge of edges) {
                if (!edge) continue;

                const fromNode = graph.getNode(edge.fromNodeId);
                const toNode = graph.getNode(edge.toNodeId);

                if (!fromNode?.pos || !toNode?.pos) continue;

                // Sample along edge
                for (let i = 0; i <= 10; i++) {
                    const t = i / 10;
                    const pos = Vector3.Lerp(fromNode.pos, toNode.pos, t);
                    const dist = Vector3.Distance(
                        new Vector3(worldPoint.x, 0, worldPoint.z),
                        new Vector3(pos.x, 0, pos.z)
                    );

                    if (dist < MAX_TRACK_DISTANCE && (!bestResult || dist < bestResult.distance)) {
                        const forward = toNode.pos.subtract(fromNode.pos).normalize();
                        bestResult = {
                            position: pos.clone(),
                            forward,
                            edgeId: edge.id,
                            t,
                            distance: dist
                        };
                    }
                }
            }

            if (bestResult) {
                return {
                    position: bestResult.position,
                    forward: bestResult.forward,
                    edgeId: bestResult.edgeId,
                    t: bestResult.t
                };
            }

        } catch (error) {
            console.error(`${LOG_PREFIX} Error finding track:`, error);
        }

        return null;
    }

    // ========================================================================
    // PLACEMENT
    // ========================================================================

    /**
     * Place the model at the track position
     */
    private placeModel(trackPos: {
        position: Vector3;
        forward: Vector3;
        edgeId: string;
        t: number;
    }): void {
        if (!this.pending) return;

        const { rootNode, name, type } = this.pending;

        console.log(`${LOG_PREFIX} Placing "${name}" on track edge ${trackPos.edgeId} at t=${trackPos.t.toFixed(2)}`);

        try {
            // ================================================================
            // Step 1: Position the model
            // ================================================================
            rootNode.position.copyFrom(trackPos.position);
            rootNode.position.y = trackPos.position.y + RAIL_HEIGHT;

            // Rotate to face along track
            const angle = Math.atan2(trackPos.forward.x, trackPos.forward.z);
            rootNode.rotation.y = angle;

            // Enable the model
            rootNode.setEnabled(true);

            // ================================================================
            // Step 2: Register with train system
            // ================================================================
            const controller = this.trainSystem.registerExistingModel(
                rootNode,
                name,
                trackPos.edgeId,
                trackPos.t
            );

            // ================================================================
            // Step 3: Clean up and notify
            // ================================================================
            notify.dismiss(this.pending.notificationId);
            notify.success(`✓ "${name}" placed on track!`, 3000);

            // Fire success event
            this.onPlaced.notifyObservers({
                success: true,
                controller
            });

            // Clear state
            this.pending = null;
            this.disableClickMode();

            console.log(`${LOG_PREFIX} ✓ Successfully placed and registered "${name}"`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error placing model:`, error);

            notify.error(`Failed to place "${name}": ${error}`);

            this.onPlaced.notifyObservers({
                success: false,
                error: String(error)
            });
        }
    }

    // ========================================================================
    // DISPOSAL
    // ========================================================================

    /**
     * Clean up resources
     */
    dispose(): void {
        this.cancelPlacement();
        this.disableClickMode();

        this.onPlaced.clear();
        this.onCancelled.clear();

        console.log(`${LOG_PREFIX} Disposed`);
    }
}