/**
 * RollingStockPositioner.ts - Unified system for positioning rolling stock on track
 * 
 * Path: frontend/src/systems/train/RollingStockPositioner.ts
 * 
 * This is the central system that ensures all rolling stock (locomotives,
 * coaches, wagons) are correctly positioned on track:
 * 
 * 1. POSITION: Centered on track rails at correct height
 * 2. ORIENTATION: Facing along track direction (not across it)
 * 3. ALIGNMENT: Wheels aligned with rails
 * 
 * Key Features:
 * - Automatic edge detection from click/drop position
 * - Model axis detection and correction
 * - Support for consists (multiple coupled vehicles)
 * - Visual preview during placement
 * - Integration with TrainSystem for physics
 * 
 * @module RollingStockPositioner
 * @author Model Railway Workbench
 * @version 2.0.0
 */

import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Vector3, Quaternion, Matrix } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Observable } from '@babylonjs/core/Misc/observable';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import type { TrackGraph, GraphEdge, GraphNode, CurveDefinition } from '../../track/TrackGraph';
import type { TrainSystem } from '../core/TrainSystem';
import type { TrainController } from '../core/TrainController';

// ============================================================================
// CONSTANTS - OO Gauge Specifications
// ============================================================================

/** Logging prefix for console output */
const LOG_PREFIX = '[RollingStockPositioner]';

/**
 * OO Gauge track specifications (all in metres)
 * These MUST match values in TrackRenderer.ts and BaseboardSystem.ts
 */
const OO_GAUGE = {
    /** Track gauge - distance between rails */
    GAUGE_M: 0.0165,            // 16.5mm

    /** Rail head width */
    RAIL_WIDTH_M: 0.002,        // 2mm

    /** Rail height above sleeper */
    RAIL_HEIGHT_M: 0.003,       // 3mm

    /** Sleeper height */
    SLEEPER_HEIGHT_M: 0.002,    // 2mm

    /** Ballast height */
    BALLAST_HEIGHT_M: 0.003,    // 3mm

    /** Baseboard surface height from world origin */
    BASEBOARD_TOP_M: 0.950,

    /** Total height offset for track surface above baseboard */
    TRACK_SURFACE_OFFSET_M: 0.008,

    /** Height of rail top from world origin */
    get RAIL_TOP_Y(): number {
        return this.BASEBOARD_TOP_M + this.TRACK_SURFACE_OFFSET_M;
    },

    /** Wheel flange depth (how far wheel sits below rail top) */
    WHEEL_FLANGE_DEPTH_M: 0.001, // 1mm

    /** Model bottom height (rail top minus flange depth) */
    get MODEL_BOTTOM_Y(): number {
        return this.RAIL_TOP_Y - this.WHEEL_FLANGE_DEPTH_M;
    }
} as const;

/**
 * Placement configuration
 */
const PLACEMENT_CONFIG = {
    /** Maximum distance from track to allow snap placement */
    MAX_SNAP_DISTANCE_M: 0.05,    // 50mm

    /** Number of samples for edge distance calculation */
    EDGE_SAMPLES: 20,

    /** Preview update throttle (ms) */
    PREVIEW_THROTTLE_MS: 16,      // ~60fps

    /** Default parametric position for new placements */
    DEFAULT_T: 0.5,               // Middle of edge

    /** Minimum vehicle length for consist spacing */
    MIN_VEHICLE_LENGTH_M: 0.100   // 100mm minimum
} as const;

/**
 * Model forward axis options
 * Different 3D modelling tools export models facing different directions
 */
export type ModelForwardAxis =
    | 'POS_X'   // Model faces +X (right)
    | 'NEG_X'   // Model faces -X (left)
    | 'POS_Y'   // Model faces +Y (up) - unusual
    | 'NEG_Y'   // Model faces -Y (down) - unusual
    | 'POS_Z'   // Model faces +Z (forward) - common default
    | 'NEG_Z';  // Model faces -Z (backward)

/**
 * Rotation offsets for each forward axis (radians)
 * Applied to align model with track direction
 */
const FORWARD_AXIS_OFFSETS: Record<ModelForwardAxis, number> = {
    'POS_X': -Math.PI / 2,  // -90°: rotate to face +Z
    'NEG_X': Math.PI / 2,   // +90°: rotate to face +Z
    'POS_Y': 0,             // Model faces up - needs special handling
    'NEG_Y': Math.PI,       // Model faces down - needs special handling
    'POS_Z': 0,             // Already facing +Z, no rotation needed
    'NEG_Z': Math.PI        // 180°: flip to face +Z
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Rolling stock category for determining placement behaviour
 */
export type RollingStockCategory =
    | 'locomotive'    // Powered unit - primary placement target
    | 'coach'         // Passenger carriage - typically coupled
    | 'wagon'         // Freight wagon - typically coupled
    | 'multiple_unit' // Self-propelled passenger unit
    | 'railcar';      // Single self-propelled unit

/**
 * Information about the rolling stock model
 */
export interface RollingStockInfo {
    /** Unique identifier for this model */
    id: string;

    /** Display name */
    name: string;

    /** Category of rolling stock */
    category: RollingStockCategory;

    /** Model length in metres (auto-detected if not specified) */
    lengthM?: number;

    /** Which axis the model faces as "forward" */
    forwardAxis?: ModelForwardAxis;

    /** Library entry ID (if from asset library) */
    libraryEntryId?: string;

    /** DCC address (for locomotives) */
    dccAddress?: number;
}

/**
 * Result of edge detection
 */
export interface EdgeDetectionResult {
    /** Track edge that was found */
    edge: GraphEdge;

    /** Parametric position on edge (0 = start, 1 = end) */
    t: number;

    /** World position on the track centreline */
    position: Vector3;

    /** Forward direction along track (tangent) */
    forward: Vector3;

    /** Right direction (perpendicular to track, horizontal) */
    right: Vector3;

    /** Distance from search point to edge */
    distance: number;
}

/**
 * Calculated placement for a single vehicle
 */
export interface VehiclePlacement {
    /** World position for model centre */
    position: Vector3;

    /** Rotation quaternion to orient model along track */
    rotation: Quaternion;

    /** Edge ID the vehicle is on */
    edgeId: string;

    /** Parametric position on edge */
    t: number;

    /** Forward direction on track */
    trackForward: Vector3;

    /** Is placement valid (within snap distance of track) */
    isValid: boolean;
}

/**
 * Consist placement for multiple coupled vehicles
 */
export interface ConsistPlacement {
    /** Placements for each vehicle in order (front to back) */
    vehicles: VehiclePlacement[];

    /** Total consist length in metres */
    totalLengthM: number;

    /** Are all vehicles validly placed on track */
    allValid: boolean;
}

/**
 * Vehicle pending placement
 */
export interface PendingVehicle {
    /** Root transform node of the model */
    rootNode: TransformNode;

    /** Vehicle information */
    info: RollingStockInfo;

    /** Preview mesh (if showing placement preview) */
    previewMesh?: Mesh;
}

/**
 * Placement completion event data
 */
export interface PlacementCompleteEvent {
    /** Created train controller */
    controller: TrainController;

    /** Final placement data */
    placement: VehiclePlacement;

    /** Vehicle info */
    info: RollingStockInfo;
}

/**
 * Placement cancelled event data
 */
export interface PlacementCancelledEvent {
    /** Why placement was cancelled */
    reason: 'user_cancelled' | 'no_track_found' | 'invalid_position' | 'error';

    /** Original vehicle info */
    info: RollingStockInfo;
}

// ============================================================================
// ROLLING STOCK POSITIONER CLASS
// ============================================================================

/**
 * RollingStockPositioner - Places and positions rolling stock on track
 * 
 * This class provides a complete workflow for placing rolling stock:
 * 
 * 1. User imports a model or selects from library
 * 2. Model enters "placement mode" - follows mouse over track
 * 3. Preview shows where model will be placed with correct orientation
 * 4. User clicks to confirm placement
 * 5. Model is positioned exactly on rails, facing along track
 * 6. Model is registered with TrainSystem for physics/control
 * 
 * @example
 * ```typescript
 * const positioner = new RollingStockPositioner(scene, graph, trainSystem);
 * 
 * // Start placement mode
 * positioner.startPlacement(modelNode, {
 *     id: 'loco_1',
 *     name: 'Class 66',
 *     category: 'locomotive'
 * });
 * 
 * // Or place directly at a specific position
 * const result = positioner.placeOnTrack(modelNode, worldPosition, info);
 * ```
 */
export class RollingStockPositioner {

    // ========================================================================
    // PRIVATE STATE
    // ========================================================================

    /** Babylon.js scene reference */
    private readonly scene: Scene;

    /** Track graph for edge/node queries */
    private readonly graph: TrackGraph;

    /** Train system for registration */
    private readonly trainSystem: TrainSystem;

    /** Currently pending vehicle for placement */
    private pendingVehicle: PendingVehicle | null = null;

    /** Is placement mode active */
    private isPlacementActive: boolean = false;

    /** Current preview placement result */
    private currentPreview: VehiclePlacement | null = null;

    /** Pointer event observer reference */
    private pointerObserver: any = null;

    /** Preview material for ghost effect */
    private previewMaterial: StandardMaterial | null = null;

    /** Status message element */
    private statusMessage: HTMLDivElement | null = null;

    /** Last pointer position for throttling */
    private lastPointerUpdate: number = 0;

    // ========================================================================
    // OBSERVABLES (EVENTS)
    // ========================================================================

    /** Fired when placement completes successfully */
    public readonly onPlacementComplete = new Observable<PlacementCompleteEvent>();

    /** Fired when placement is cancelled */
    public readonly onPlacementCancelled = new Observable<PlacementCancelledEvent>();

    /** Fired when preview updates (for UI feedback) */
    public readonly onPreviewUpdate = new Observable<VehiclePlacement | null>();

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new RollingStockPositioner
     * 
     * @param scene - Babylon.js scene
     * @param graph - Track graph for queries
     * @param trainSystem - Train system for registration
     */
    constructor(
        scene: Scene,
        graph: TrackGraph,
        trainSystem: TrainSystem
    ) {
        this.scene = scene;
        this.graph = graph;
        this.trainSystem = trainSystem;

        // Create preview material
        this.createPreviewMaterial();

        console.log(`${LOG_PREFIX} Initialized`);
    }

    // ========================================================================
    // PUBLIC API - PLACEMENT MODE
    // ========================================================================

    /**
     * Start interactive placement mode for a vehicle
     * 
     * The model will follow the mouse cursor, snapping to track with
     * correct orientation. User clicks to confirm placement.
     * 
     * @param rootNode - Root transform node of the model
     * @param info - Vehicle information
     * @returns true if placement mode started successfully
     */
    startPlacement(rootNode: TransformNode, info: RollingStockInfo): boolean {
        try {
            // Cancel any existing placement
            if (this.isPlacementActive) {
                this.cancelPlacement('user_cancelled');
            }

            console.log(`${LOG_PREFIX} Starting placement for "${info.name}"`);

            // Detect model dimensions if not provided
            const detectedInfo = this.detectModelDimensions(rootNode, info);

            // Store pending vehicle
            this.pendingVehicle = {
                rootNode,
                info: detectedInfo
            };

            // Hide the actual model while placing
            this.setModelVisibility(rootNode, false);

            // Create preview mesh
            this.createPreviewMesh(rootNode, detectedInfo);

            // Start listening for pointer events
            this.setupPointerEvents();

            // Show status message
            this.showStatusMessage(
                `Click on track to place ${info.name}. Press Escape to cancel.`
            );

            this.isPlacementActive = true;

            return true;

        } catch (error) {
            console.error(`${LOG_PREFIX} Error starting placement:`, error);
            return false;
        }
    }

    /**
     * Cancel current placement operation
     * 
     * @param reason - Why placement was cancelled
     */
    cancelPlacement(reason: PlacementCancelledEvent['reason'] = 'user_cancelled'): void {
        if (!this.pendingVehicle) {
            return;
        }

        console.log(`${LOG_PREFIX} Cancelling placement: ${reason}`);

        const info = this.pendingVehicle.info;

        // Show the original model again
        this.setModelVisibility(this.pendingVehicle.rootNode, true);

        // Remove preview mesh
        this.removePreviewMesh();

        // Remove pointer events
        this.removePointerEvents();

        // Hide status message
        this.hideStatusMessage();

        // Clear state
        this.pendingVehicle = null;
        this.currentPreview = null;
        this.isPlacementActive = false;

        // Notify listeners
        this.onPlacementCancelled.notifyObservers({ reason, info });
    }

    /**
     * Check if placement mode is active
     */
    isPlacing(): boolean {
        return this.isPlacementActive;
    }

    // ========================================================================
    // PUBLIC API - DIRECT PLACEMENT
    // ========================================================================

    /**
     * Place a vehicle directly at a world position
     * 
     * This method bypasses interactive placement mode and places
     * the vehicle immediately at the nearest track position.
     * 
     * @param rootNode - Root transform node of the model
     * @param worldPosition - World position to place near
     * @param info - Vehicle information
     * @returns Created TrainController or null if placement failed
     */
    placeOnTrack(
        rootNode: TransformNode,
        worldPosition: Vector3,
        info: RollingStockInfo
    ): TrainController | null {
        try {
            console.log(`${LOG_PREFIX} Direct placement at (${worldPosition.x.toFixed(3)}, ${worldPosition.y.toFixed(3)}, ${worldPosition.z.toFixed(3)})`);

            // Detect model dimensions if needed
            const detectedInfo = this.detectModelDimensions(rootNode, info);

            // Find nearest track edge
            const edgeResult = this.findNearestEdge(worldPosition);

            if (!edgeResult) {
                console.warn(`${LOG_PREFIX} No track found near position`);
                return null;
            }

            if (edgeResult.distance > PLACEMENT_CONFIG.MAX_SNAP_DISTANCE_M) {
                console.warn(`${LOG_PREFIX} Nearest track too far: ${(edgeResult.distance * 1000).toFixed(1)}mm`);
                return null;
            }

            // Calculate placement
            const placement = this.calculatePlacement(edgeResult, detectedInfo);

            if (!placement.isValid) {
                console.warn(`${LOG_PREFIX} Invalid placement calculated`);
                return null;
            }

            // Apply placement to model
            this.applyPlacement(rootNode, placement, detectedInfo);

            // Register with train system
            const controller = this.registerWithTrainSystem(rootNode, placement, detectedInfo);

            return controller;

        } catch (error) {
            console.error(`${LOG_PREFIX} Error in direct placement:`, error);
            return null;
        }
    }

    /**
     * Place a vehicle at a specific edge and parametric position
     * 
     * @param rootNode - Root transform node of the model
     * @param edgeId - Edge ID to place on
     * @param t - Parametric position (0-1)
     * @param info - Vehicle information
     * @param direction - Direction to face (1 = toward toNode, -1 = toward fromNode)
     * @returns Created TrainController or null if placement failed
     */
    placeOnEdge(
        rootNode: TransformNode,
        edgeId: string,
        t: number,
        info: RollingStockInfo,
        direction: 1 | -1 = 1
    ): TrainController | null {
        try {
            console.log(`${LOG_PREFIX} Placing on edge ${edgeId} at t=${t.toFixed(3)}`);

            // Get edge from graph
            const edge = this.graph.getEdge(edgeId);
            if (!edge) {
                console.error(`${LOG_PREFIX} Edge not found: ${edgeId}`);
                return null;
            }

            // Detect model dimensions
            const detectedInfo = this.detectModelDimensions(rootNode, info);

            // Get position and direction on edge
            const poseData = this.getPositionOnEdge(edge, t);
            if (!poseData) {
                console.error(`${LOG_PREFIX} Failed to get position on edge`);
                return null;
            }

            // Create edge detection result
            const edgeResult: EdgeDetectionResult = {
                edge,
                t,
                position: poseData.position,
                forward: direction === 1 ? poseData.forward : poseData.forward.negate(),
                right: poseData.right,
                distance: 0
            };

            // Calculate placement
            const placement = this.calculatePlacement(edgeResult, detectedInfo);

            // Apply placement
            this.applyPlacement(rootNode, placement, detectedInfo);

            // Register with train system
            const controller = this.registerWithTrainSystem(rootNode, placement, detectedInfo);

            return controller;

        } catch (error) {
            console.error(`${LOG_PREFIX} Error placing on edge:`, error);
            return null;
        }
    }

    // ========================================================================
    // PUBLIC API - CONSIST PLACEMENT
    // ========================================================================

    /**
     * Calculate placement for a consist (multiple coupled vehicles)
     * 
     * Places the lead vehicle at the specified position, then calculates
     * positions for following vehicles based on their lengths.
     * 
     * @param leadPosition - World position for lead vehicle
     * @param vehicleInfos - Array of vehicle info (front to back)
     * @returns Consist placement or null if failed
     */
    calculateConsistPlacement(
        leadPosition: Vector3,
        vehicleInfos: Array<{ rootNode: TransformNode; info: RollingStockInfo }>
    ): ConsistPlacement | null {
        try {
            if (vehicleInfos.length === 0) {
                return null;
            }

            // Find edge for lead vehicle
            const leadEdge = this.findNearestEdge(leadPosition);
            if (!leadEdge) {
                return null;
            }

            const placements: VehiclePlacement[] = [];
            let currentEdgeId = leadEdge.edge.id;
            let currentT = leadEdge.t;
            let totalLength = 0;
            let allValid = true;

            // Place each vehicle
            for (let i = 0; i < vehicleInfos.length; i++) {
                const { rootNode, info } = vehicleInfos[i];
                const detectedInfo = this.detectModelDimensions(rootNode, info);
                const vehicleLength = detectedInfo.lengthM || PLACEMENT_CONFIG.MIN_VEHICLE_LENGTH_M;

                // Find position for this vehicle
                const edge = this.graph.getEdge(currentEdgeId);
                if (!edge) {
                    allValid = false;
                    break;
                }

                const poseData = this.getPositionOnEdge(edge, currentT);
                if (!poseData) {
                    allValid = false;
                    break;
                }

                const edgeResult: EdgeDetectionResult = {
                    edge,
                    t: currentT,
                    position: poseData.position,
                    forward: poseData.forward.negate(), // Following vehicles face backward
                    right: poseData.right,
                    distance: 0
                };

                const placement = this.calculatePlacement(edgeResult, detectedInfo);
                placements.push(placement);

                totalLength += vehicleLength;

                // Move position back for next vehicle
                // (This is simplified - real implementation would follow track path)
                if (i < vehicleInfos.length - 1) {
                    const nextLength = this.detectModelDimensions(
                        vehicleInfos[i + 1].rootNode,
                        vehicleInfos[i + 1].info
                    ).lengthM || PLACEMENT_CONFIG.MIN_VEHICLE_LENGTH_M;

                    // Calculate distance to move back
                    const spacing = (vehicleLength / 2) + (nextLength / 2) + 0.002; // 2mm coupling gap

                    // Move along track (simplified - moves t value)
                    const edgeLength = edge.lengthM;
                    const tDelta = spacing / edgeLength;
                    currentT -= tDelta;

                    // Handle edge transitions
                    if (currentT < 0) {
                        // Would need to find previous edge - simplified here
                        currentT = 0;
                    }
                }
            }

            return {
                vehicles: placements,
                totalLengthM: totalLength,
                allValid
            };

        } catch (error) {
            console.error(`${LOG_PREFIX} Error calculating consist placement:`, error);
            return null;
        }
    }

    // ========================================================================
    // PRIVATE - EDGE DETECTION
    // ========================================================================

    /**
     * Find the nearest track edge to a world position
     * 
     * Searches all edges in the graph and returns the closest one
     * within the snap distance.
     * 
     * @param position - World position to search from
     * @returns Edge detection result or null if none found
     */
    private findNearestEdge(position: Vector3): EdgeDetectionResult | null {
        let bestResult: EdgeDetectionResult | null = null;
        let bestDistance = PLACEMENT_CONFIG.MAX_SNAP_DISTANCE_M;

        const allEdges = this.graph.getAllEdges();

        for (const edge of allEdges) {
            const result = this.findClosestPointOnEdge(edge, position);

            if (result && result.distance < bestDistance) {
                bestDistance = result.distance;
                bestResult = result;
            }
        }

        return bestResult;
    }

    /**
     * Find the closest point on a specific edge to a position
     * 
     * @param edge - Edge to search
     * @param position - World position
     * @returns Detection result or null if edge is invalid
     */
    private findClosestPointOnEdge(
        edge: GraphEdge,
        position: Vector3
    ): EdgeDetectionResult | null {
        const fromNode = this.graph.getNode(edge.fromNodeId);
        const toNode = this.graph.getNode(edge.toNodeId);

        if (!fromNode || !toNode) {
            return null;
        }

        // Sample points along the edge to find closest
        let bestT = 0;
        let bestDistance = Infinity;
        let bestPosition = fromNode.pos.clone();
        let bestForward = toNode.pos.subtract(fromNode.pos).normalize();

        for (let i = 0; i <= PLACEMENT_CONFIG.EDGE_SAMPLES; i++) {
            const t = i / PLACEMENT_CONFIG.EDGE_SAMPLES;
            const poseData = this.getPositionOnEdge(edge, t);

            if (!poseData) continue;

            const dist = Vector3.Distance(position, poseData.position);

            if (dist < bestDistance) {
                bestDistance = dist;
                bestT = t;
                bestPosition = poseData.position.clone();
                bestForward = poseData.forward.clone();
            }
        }

        // Calculate right vector
        const right = Vector3.Cross(Vector3.Up(), bestForward).normalize();

        return {
            edge,
            t: bestT,
            position: bestPosition,
            forward: bestForward,
            right,
            distance: bestDistance
        };
    }

    /**
     * Get position and direction at a parametric position on an edge
     * 
     * Handles both straight and curved track segments.
     * 
     * @param edge - Edge to query
     * @param t - Parametric position (0-1)
     * @returns Position and direction data
     */
    private getPositionOnEdge(
        edge: GraphEdge,
        t: number
    ): { position: Vector3; forward: Vector3; right: Vector3 } | null {
        const fromNode = this.graph.getNode(edge.fromNodeId);
        const toNode = this.graph.getNode(edge.toNodeId);

        if (!fromNode || !toNode) {
            return null;
        }

        let position: Vector3;
        let forward: Vector3;

        if (edge.curve.type === 'straight') {
            // Straight track - linear interpolation
            position = Vector3.Lerp(fromNode.pos, toNode.pos, t);
            forward = toNode.pos.subtract(fromNode.pos).normalize();

        } else if (edge.curve.type === 'arc') {
            // Curved track - arc mathematics
            const arcData = this.calculateArcPosition(edge, fromNode, toNode, t);
            position = arcData.position;
            forward = arcData.forward;

        } else {
            // Unknown type - fall back to linear
            position = Vector3.Lerp(fromNode.pos, toNode.pos, t);
            forward = toNode.pos.subtract(fromNode.pos).normalize();
        }

        // Ensure forward is horizontal
        forward.y = 0;
        forward.normalize();

        // Calculate right vector
        const right = Vector3.Cross(Vector3.Up(), forward).normalize();

        return { position, forward, right };
    }

    /**
     * Calculate position on a curved arc
     * 
     * @param edge - Edge with arc curve definition
     * @param fromNode - Start node
     * @param toNode - End node
     * @param t - Parametric position
     * @returns Position and forward direction
     */
    private calculateArcPosition(
        edge: GraphEdge,
        fromNode: GraphNode,
        toNode: GraphNode,
        t: number
    ): { position: Vector3; forward: Vector3 } {
        const curve = edge.curve;
        const radius = curve.arcRadiusM || 0.371; // Default to R1
        const angleDeg = curve.arcAngleDeg || 45;
        const direction = curve.arcDirection || 1; // 1 = left/CCW, -1 = right/CW

        // Get start position and direction
        const startPos = fromNode.pos.clone();
        const endPos = toNode.pos.clone();

        // Calculate chord direction
        const chordDir = endPos.subtract(startPos).normalize();

        // Perpendicular to chord (toward arc center)
        const perpendicular = new Vector3(
            -chordDir.z * direction,
            0,
            chordDir.x * direction
        );

        // Calculate arc center
        // For a circular arc, the center is perpendicular to the chord
        const angleRad = (angleDeg * Math.PI) / 180;
        const halfAngle = angleRad / 2;
        const chordLength = Vector3.Distance(startPos, endPos);

        // Distance from chord midpoint to arc center
        const sagitta = radius * (1 - Math.cos(halfAngle));
        const midToCenter = radius * Math.cos(halfAngle);

        // Arc center position
        const chordMid = Vector3.Lerp(startPos, endPos, 0.5);
        const center = chordMid.add(perpendicular.scale(midToCenter - sagitta));

        // Calculate position at t
        const startAngle = Math.atan2(
            startPos.z - center.z,
            startPos.x - center.x
        );

        const currentAngle = startAngle + (t * angleRad * direction);

        const position = new Vector3(
            center.x + radius * Math.cos(currentAngle),
            startPos.y, // Keep Y level
            center.z + radius * Math.sin(currentAngle)
        );

        // Forward is tangent to arc (perpendicular to radius, in direction of travel)
        const radiusVec = position.subtract(center).normalize();
        const forward = new Vector3(
            -radiusVec.z * direction,
            0,
            radiusVec.x * direction
        );

        return { position, forward: forward.normalize() };
    }

    // ========================================================================
    // PRIVATE - PLACEMENT CALCULATION
    // ========================================================================

    /**
     * Calculate final placement from edge detection result
     * 
     * @param edgeResult - Edge detection result
     * @param info - Vehicle info (with detected dimensions)
     * @returns Vehicle placement
     */
    private calculatePlacement(
        edgeResult: EdgeDetectionResult,
        info: RollingStockInfo
    ): VehiclePlacement {
        // Position on track centreline at correct height
        const position = new Vector3(
            edgeResult.position.x,
            OO_GAUGE.MODEL_BOTTOM_Y, // Rail top minus wheel flange
            edgeResult.position.z
        );

        // Calculate rotation to face along track
        const rotation = this.calculateTrackAlignedRotation(
            edgeResult.forward,
            info.forwardAxis || 'NEG_Z'
        );

        // Check if placement is valid
        const isValid = edgeResult.distance <= PLACEMENT_CONFIG.MAX_SNAP_DISTANCE_M;

        console.log(`${LOG_PREFIX} Placement calculated:`);
        console.log(`${LOG_PREFIX}   Position: (${position.x.toFixed(3)}, ${position.y.toFixed(3)}, ${position.z.toFixed(3)})`);
        console.log(`${LOG_PREFIX}   Track forward: (${edgeResult.forward.x.toFixed(3)}, ${edgeResult.forward.z.toFixed(3)})`);
        console.log(`${LOG_PREFIX}   Distance to track: ${(edgeResult.distance * 1000).toFixed(1)}mm`);
        console.log(`${LOG_PREFIX}   Valid: ${isValid}`);

        return {
            position,
            rotation,
            edgeId: edgeResult.edge.id,
            t: edgeResult.t,
            trackForward: edgeResult.forward.clone(),
            isValid
        };
    }

    /**
     * Calculate rotation quaternion to align model with track direction
     * 
     * @param trackForward - Track direction vector
     * @param modelForwardAxis - Which axis the model faces
     * @returns Rotation quaternion
     */
    private calculateTrackAlignedRotation(
        trackForward: Vector3,
        modelForwardAxis: ModelForwardAxis
    ): Quaternion {
        // Get the angle of track direction in world space
        // atan2(x, z) gives angle from +Z axis
        const trackAngle = Math.atan2(trackForward.x, trackForward.z);

        // Get the offset for the model's forward axis
        const modelOffset = FORWARD_AXIS_OFFSETS[modelForwardAxis];

        // Final rotation = track angle + model offset
        const finalAngle = trackAngle + modelOffset;

        console.log(`${LOG_PREFIX}   Track angle: ${(trackAngle * 180 / Math.PI).toFixed(1)}°`);
        console.log(`${LOG_PREFIX}   Model offset (${modelForwardAxis}): ${(modelOffset * 180 / Math.PI).toFixed(1)}°`);
        console.log(`${LOG_PREFIX}   Final rotation: ${(finalAngle * 180 / Math.PI).toFixed(1)}°`);

        // Create Y-axis rotation quaternion
        return Quaternion.FromEulerAngles(0, finalAngle, 0);
    }

    // ========================================================================
    // PRIVATE - MODEL OPERATIONS
    // ========================================================================

    /**
     * Detect model dimensions from its bounding box
     * 
     * @param rootNode - Model root node
     * @param info - Provided info
     * @returns Info with detected dimensions filled in
     */
    private detectModelDimensions(
        rootNode: TransformNode,
        info: RollingStockInfo
    ): RollingStockInfo {
        const result = { ...info };

        try {
            // Get all child meshes
            const meshes = rootNode.getChildMeshes(false);

            if (meshes.length === 0) {
                console.warn(`${LOG_PREFIX} No meshes found in model`);
                return result;
            }

            // Calculate combined bounding box
            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;
            let minZ = Infinity, maxZ = -Infinity;

            for (const mesh of meshes) {
                const bounds = mesh.getBoundingInfo();
                const min = bounds.boundingBox.minimumWorld;
                const max = bounds.boundingBox.maximumWorld;

                minX = Math.min(minX, min.x);
                maxX = Math.max(maxX, max.x);
                minY = Math.min(minY, min.y);
                maxY = Math.max(maxY, max.y);
                minZ = Math.min(minZ, min.z);
                maxZ = Math.max(maxZ, max.z);
            }

            const sizeX = maxX - minX;
            const sizeY = maxY - minY;
            const sizeZ = maxZ - minZ;

            console.log(`${LOG_PREFIX} Model dimensions: ${(sizeX * 1000).toFixed(0)}mm x ${(sizeY * 1000).toFixed(0)}mm x ${(sizeZ * 1000).toFixed(0)}mm`);

            // Determine length (longest horizontal dimension)
            if (!result.lengthM) {
                result.lengthM = Math.max(sizeX, sizeZ);
            }

            // Try to detect forward axis if not provided
            if (!result.forwardAxis) {
                result.forwardAxis = this.detectForwardAxis(sizeX, sizeY, sizeZ, rootNode);
            }

        } catch (error) {
            console.error(`${LOG_PREFIX} Error detecting model dimensions:`, error);
        }

        return result;
    }

    /**
     * Attempt to detect which axis the model faces as "forward"
     * 
     * Uses heuristics based on model dimensions:
     * - Trains are typically longer than wide
     * - The long axis is usually the forward axis
     * 
     * @param sizeX - Model X dimension
     * @param sizeY - Model Y dimension
     * @param sizeZ - Model Z dimension
     * @param rootNode - Model root for additional analysis
     * @returns Detected forward axis
     */
    private detectForwardAxis(
        sizeX: number,
        sizeY: number,
        sizeZ: number,
        rootNode: TransformNode
    ): ModelForwardAxis {
        // Most railway models have length > width
        // The longest horizontal axis is typically the forward direction

        if (sizeX > sizeZ * 1.5) {
            // Model is longer in X - check if it faces +X or -X
            // Default to -X (facing left in model space)
            console.log(`${LOG_PREFIX} Detected forward axis: NEG_X (model longer in X)`);
            return 'NEG_X';

        } else if (sizeZ > sizeX * 1.5) {
            // Model is longer in Z - check if it faces +Z or -Z
            // Default to -Z (common for many tools)
            console.log(`${LOG_PREFIX} Detected forward axis: NEG_Z (model longer in Z)`);
            return 'NEG_Z';

        } else {
            // Similar dimensions - default to -Z
            console.log(`${LOG_PREFIX} Detected forward axis: NEG_Z (default)`);
            return 'NEG_Z';
        }
    }

    /**
     * Apply calculated placement to a model
     * 
     * @param rootNode - Model root node
     * @param placement - Calculated placement
     * @param info - Vehicle info
     */
    private applyPlacement(
        rootNode: TransformNode,
        placement: VehiclePlacement,
        info: RollingStockInfo
    ): void {
        console.log(`${LOG_PREFIX} Applying placement to "${info.name}"`);

        // Set position
        rootNode.position = placement.position.clone();

        // Set rotation
        rootNode.rotationQuaternion = placement.rotation.clone();

        // Ensure model is visible
        this.setModelVisibility(rootNode, true);

        console.log(`${LOG_PREFIX}   Final position: (${rootNode.position.x.toFixed(3)}, ${rootNode.position.y.toFixed(3)}, ${rootNode.position.z.toFixed(3)})`);
    }

    /**
     * Set visibility of all meshes in a model
     * 
     * @param rootNode - Model root node
     * @param visible - Whether to show or hide
     */
    private setModelVisibility(rootNode: TransformNode, visible: boolean): void {
        const meshes = rootNode.getChildMeshes(false);

        for (const mesh of meshes) {
            mesh.isVisible = visible;
        }

        // Also handle if root is a mesh
        if (rootNode instanceof AbstractMesh) {
            rootNode.isVisible = visible;
        }
    }

    /**
     * Register placed vehicle with train system
     * 
     * @param rootNode - Model root node
     * @param placement - Applied placement
     * @param info - Vehicle info
     * @returns Created train controller
     */
    private registerWithTrainSystem(
        rootNode: TransformNode,
        placement: VehiclePlacement,
        info: RollingStockInfo
    ): TrainController {
        console.log(`${LOG_PREFIX} Registering "${info.name}" with train system`);

        // Use train system to create controller
        const controller = this.trainSystem.registerExistingModel(
            rootNode,
            info.name,
            placement.edgeId,
            placement.t
        );

        return controller;
    }

    // ========================================================================
    // PRIVATE - PREVIEW SYSTEM
    // ========================================================================

    /**
     * Create the preview material for ghost effect
     */
    private createPreviewMaterial(): void {
        this.previewMaterial = new StandardMaterial('preview_material', this.scene);
        this.previewMaterial.diffuseColor = new Color3(0.2, 0.8, 0.2); // Green tint
        this.previewMaterial.alpha = 0.5;
        this.previewMaterial.emissiveColor = new Color3(0.1, 0.4, 0.1);
    }

    /**
     * Create preview mesh that follows pointer
     * 
     * @param sourceNode - Source model to preview
     * @param info - Vehicle info
     */
    private createPreviewMesh(sourceNode: TransformNode, info: RollingStockInfo): void {
        if (!this.pendingVehicle) return;

        try {
            // Get model dimensions for preview box
            const lengthM = info.lengthM || 0.200; // Default 200mm
            const widthM = 0.030; // 30mm typical width
            const heightM = 0.040; // 40mm typical height

            // Create a simple box as preview
            const preview = MeshBuilder.CreateBox('placement_preview', {
                width: widthM,
                height: heightM,
                depth: lengthM
            }, this.scene);

            preview.material = this.previewMaterial;
            preview.isPickable = false;
            preview.visibility = 0.5;

            // Position off-screen initially
            preview.position = new Vector3(0, -100, 0);

            this.pendingVehicle.previewMesh = preview;

            console.log(`${LOG_PREFIX} Preview mesh created`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error creating preview mesh:`, error);
        }
    }

    /**
     * Remove preview mesh
     */
    private removePreviewMesh(): void {
        if (this.pendingVehicle?.previewMesh) {
            this.pendingVehicle.previewMesh.dispose();
            this.pendingVehicle.previewMesh = undefined;
        }
    }

    /**
     * Update preview mesh position from pointer
     * 
     * @param pointerX - Pointer X position
     * @param pointerY - Pointer Y position
     */
    private updatePreview(pointerX: number, pointerY: number): void {
        if (!this.pendingVehicle?.previewMesh) return;

        // Throttle updates
        const now = performance.now();
        if (now - this.lastPointerUpdate < PLACEMENT_CONFIG.PREVIEW_THROTTLE_MS) {
            return;
        }
        this.lastPointerUpdate = now;

        try {
            // Ray cast to find world position
            const ray = this.scene.createPickingRay(
                pointerX,
                pointerY,
                null,
                this.scene.activeCamera
            );

            if (!ray) return;

            // Pick against a virtual ground plane at track height
            const groundY = OO_GAUGE.RAIL_TOP_Y;

            // Calculate intersection with horizontal plane
            if (Math.abs(ray.direction.y) < 0.001) return;

            const t = (groundY - ray.origin.y) / ray.direction.y;
            if (t < 0) return;

            const worldPoint = ray.origin.add(ray.direction.scale(t));

            // Find nearest edge
            const edgeResult = this.findNearestEdge(worldPoint);

            if (edgeResult && edgeResult.distance <= PLACEMENT_CONFIG.MAX_SNAP_DISTANCE_M) {
                // Valid track position - update preview
                const placement = this.calculatePlacement(edgeResult, this.pendingVehicle.info);

                this.pendingVehicle.previewMesh.position = placement.position;
                this.pendingVehicle.previewMesh.rotationQuaternion = placement.rotation;
                this.pendingVehicle.previewMesh.visibility = 0.7;

                // Update material to green (valid)
                if (this.previewMaterial) {
                    this.previewMaterial.diffuseColor = new Color3(0.2, 0.8, 0.2);
                    this.previewMaterial.emissiveColor = new Color3(0.1, 0.4, 0.1);
                }

                this.currentPreview = placement;

            } else {
                // No valid track - show at pointer position
                this.pendingVehicle.previewMesh.position = worldPoint;
                this.pendingVehicle.previewMesh.visibility = 0.3;

                // Update material to red (invalid)
                if (this.previewMaterial) {
                    this.previewMaterial.diffuseColor = new Color3(0.8, 0.2, 0.2);
                    this.previewMaterial.emissiveColor = new Color3(0.4, 0.1, 0.1);
                }

                this.currentPreview = null;
            }

            // Notify listeners
            this.onPreviewUpdate.notifyObservers(this.currentPreview);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error updating preview:`, error);
        }
    }

    // ========================================================================
    // PRIVATE - EVENT HANDLING
    // ========================================================================

    /**
     * Setup pointer event handling for placement mode
     */
    private setupPointerEvents(): void {
        this.pointerObserver = this.scene.onPointerObservable.add((pointerInfo) => {
            switch (pointerInfo.type) {
                case PointerEventTypes.POINTERMOVE:
                    if (pointerInfo.event) {
                        this.updatePreview(
                            pointerInfo.event.clientX,
                            pointerInfo.event.clientY
                        );
                    }
                    break;

                case PointerEventTypes.POINTERDOWN:
                    if (pointerInfo.event?.button === 0) { // Left click
                        this.handlePlacementClick();
                    }
                    break;
            }
        });

        // Also listen for Escape key
        this.setupKeyboardEvents();
    }

    /**
     * Remove pointer event handling
     */
    private removePointerEvents(): void {
        if (this.pointerObserver) {
            this.scene.onPointerObservable.remove(this.pointerObserver);
            this.pointerObserver = null;
        }

        this.removeKeyboardEvents();
    }

    /** Keyboard event handler reference */
    private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;

    /**
     * Setup keyboard event handling
     */
    private setupKeyboardEvents(): void {
        this.keyboardHandler = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                this.cancelPlacement('user_cancelled');
            }
        };

        window.addEventListener('keydown', this.keyboardHandler);
    }

    /**
     * Remove keyboard event handling
     */
    private removeKeyboardEvents(): void {
        if (this.keyboardHandler) {
            window.removeEventListener('keydown', this.keyboardHandler);
            this.keyboardHandler = null;
        }
    }

    /**
     * Handle click during placement mode
     */
    private handlePlacementClick(): void {
        if (!this.pendingVehicle || !this.currentPreview) {
            console.warn(`${LOG_PREFIX} Click ignored - no valid preview`);
            return;
        }

        if (!this.currentPreview.isValid) {
            console.warn(`${LOG_PREFIX} Click ignored - invalid placement`);
            return;
        }

        console.log(`${LOG_PREFIX} Placement confirmed`);

        const { rootNode, info } = this.pendingVehicle;
        const placement = this.currentPreview;

        // Apply placement to actual model
        this.applyPlacement(rootNode, placement, info);

        // Register with train system
        const controller = this.registerWithTrainSystem(rootNode, placement, info);

        // Clean up
        this.removePreviewMesh();
        this.removePointerEvents();
        this.hideStatusMessage();

        this.pendingVehicle = null;
        this.currentPreview = null;
        this.isPlacementActive = false;

        // Notify listeners
        this.onPlacementComplete.notifyObservers({
            controller,
            placement,
            info
        });
    }

    // ========================================================================
    // PRIVATE - UI HELPERS
    // ========================================================================

    /**
     * Show status message to user
     * 
     * @param message - Message to display
     */
    private showStatusMessage(message: string): void {
        // Remove existing message
        this.hideStatusMessage();

        // Create message element
        this.statusMessage = document.createElement('div');
        this.statusMessage.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            z-index: 10000;
            pointer-events: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        this.statusMessage.textContent = message;

        document.body.appendChild(this.statusMessage);
    }

    /**
     * Hide status message
     */
    private hideStatusMessage(): void {
        if (this.statusMessage && this.statusMessage.parentNode) {
            this.statusMessage.parentNode.removeChild(this.statusMessage);
            this.statusMessage = null;
        }
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Dispose of positioner resources
     */
    dispose(): void {
        console.log(`${LOG_PREFIX} Disposing`);

        // Cancel any active placement
        if (this.isPlacementActive) {
            this.cancelPlacement('error');
        }

        // Dispose preview material
        if (this.previewMaterial) {
            this.previewMaterial.dispose();
            this.previewMaterial = null;
        }

        // Clear observables
        this.onPlacementComplete.clear();
        this.onPlacementCancelled.clear();
        this.onPreviewUpdate.clear();
    }
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export { OO_GAUGE, PLACEMENT_CONFIG };