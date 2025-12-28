/**
 * TrainPathFollower.ts - Track-following movement for trains
 * 
 * Path: frontend/src/systems/train/TrainPathFollower.ts
 * 
 * Handles the positioning of trains along track edges:
 * - Maintains position as edge reference + parametric t value (0-1)
 * - Calculates world position and rotation from track geometry
 * - Handles transitions between track edges at nodes
 * - Supports both straight and curved track with proper arc mathematics
 * - Integrates with PointsManager for route selection at switches
 * 
 * The path follower doesn't know about physics - it just positions
 * based on a given distance to travel along the track.
 * 
 * @module TrainPathFollower
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector';
import type { GraphEdge, GraphNode, CurveDefinition } from '../track/TrackGraph';
import type { TrackGraph } from '../track/TrackGraph';
import type { PointsManager } from './PointsManager';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[TrainPathFollower]';

/** Height of rail surface in meters (for positioning trains on top of track) */
const RAIL_SURFACE_HEIGHT = 0.005; // 5mm above track base

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Position on the track network
 */
export interface TrackPosition {
    /** Current edge the train is on */
    edgeId: string;

    /** Parametric position along edge (0 = fromNode, 1 = toNode) */
    t: number;

    /** Direction of travel along this edge (1 = toward toNode, -1 = toward fromNode) */
    edgeDirection: 1 | -1;
}

/**
 * World-space position and orientation
 */
export interface WorldPose {
    /** World position */
    position: Vector3;

    /** Forward direction (tangent to track) */
    forward: Vector3;

    /** Rotation quaternion for orienting the model */
    rotation: Quaternion;

    /** Right vector (perpendicular to track, horizontal) */
    right: Vector3;
}

/**
 * Result of a movement operation
 */
export interface MovementResult {
    /** New track position */
    trackPosition: TrackPosition;

    /** New world pose */
    worldPose: WorldPose;

    /** Did we cross into a new edge? */
    edgeChanged: boolean;

    /** Did we reach a dead end? */
    reachedDeadEnd: boolean;

    /** List of edges traversed during this move */
    traversedEdges: string[];
}

/**
 * Configuration for path following
 */
export interface PathFollowerConfig {
    /** Height offset for train model (added to rail surface) */
    heightOffset: number;

    /** Whether to reverse model orientation when traveling backward on edge */
    flipOnReverse: boolean;
}

// ============================================================================
// PATH FOLLOWER CLASS
// ============================================================================

/**
 * TrainPathFollower - Handles train positioning along track
 * 
 * Tracks position as (edge, t, direction) and calculates world-space
 * position and rotation based on track geometry.
 * 
 * @example
 * ```typescript
 * const follower = new TrainPathFollower(trackGraph, pointsManager);
 * follower.placeOnEdge(edgeId, 0.5, 1); // Middle of edge, facing toNode
 * 
 * // Move 10cm along track:
 * const result = follower.move(0.1);
 * model.position = result.worldPose.position;
 * model.rotationQuaternion = result.worldPose.rotation;
 * ```
 */
export class TrainPathFollower {
    // ========================================================================
    // PRIVATE STATE
    // ========================================================================

    /** Reference to track graph */
    private graph: TrackGraph;

    /** Reference to points manager for route decisions */
    private pointsManager: PointsManager;

    /** Current track position */
    private trackPosition: TrackPosition | null = null;

    /** Cached world pose (updated on move) */
    private worldPose: WorldPose | null = null;

    /** Configuration */
    private config: PathFollowerConfig;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new TrainPathFollower
     * @param graph - Track graph for network information
     * @param pointsManager - Points manager for route selection
     * @param config - Optional configuration
     */
    constructor(
        graph: TrackGraph,
        pointsManager: PointsManager,
        config?: Partial<PathFollowerConfig>
    ) {
        this.graph = graph;
        this.pointsManager = pointsManager;
        this.config = {
            heightOffset: 0,
            flipOnReverse: true,
            ...config
        };

        console.log(`${LOG_PREFIX} Path follower created`);
    }

    // ========================================================================
    // PLACEMENT METHODS
    // ========================================================================

    /**
     * Place train on a specific edge at a parametric position
     * @param edgeId - Edge to place on
     * @param t - Parametric position (0-1)
     * @param edgeDirection - Direction of travel (1 = toward toNode)
     * @returns true if placement successful
     */
    placeOnEdge(edgeId: string, t: number = 0.5, edgeDirection: 1 | -1 = 1): boolean {
        const edge = this.graph.getEdge(edgeId);
        if (!edge) {
            console.error(`${LOG_PREFIX} Cannot place on edge ${edgeId} - not found`);
            return false;
        }

        // Clamp t to valid range
        const clampedT = Math.max(0, Math.min(1, t));

        this.trackPosition = {
            edgeId,
            t: clampedT,
            edgeDirection
        };

        // Calculate initial world pose
        this.worldPose = this.calculateWorldPose(edge, clampedT, edgeDirection);

        console.log(`${LOG_PREFIX} Placed on edge ${edgeId} at t=${clampedT.toFixed(3)}, dir=${edgeDirection}`);
        return true;
    }

    /**
     * Place train at a node, on one of its connected edges
     * @param nodeId - Node to place at
     * @param preferredEdgeId - Preferred edge to start on (optional)
     * @returns true if placement successful
     */
    placeAtNode(nodeId: string, preferredEdgeId?: string): boolean {
        const node = this.graph.getNode(nodeId);
        if (!node) {
            console.error(`${LOG_PREFIX} Cannot place at node ${nodeId} - not found`);
            return false;
        }

        // Get edges connected to this node
        const edges = this.graph.getEdgesConnectedToNode(nodeId);
        if (edges.length === 0) {
            console.error(`${LOG_PREFIX} Node ${nodeId} has no connected edges`);
            return false;
        }

        // Use preferred edge if specified and valid
        let edge = edges[0];
        if (preferredEdgeId) {
            const preferred = edges.find(e => e.id === preferredEdgeId);
            if (preferred) {
                edge = preferred;
            }
        }

        // Determine t and direction based on which end of edge this node is
        let t: number;
        let edgeDirection: 1 | -1;

        if (edge.fromNodeId === nodeId) {
            t = 0;
            edgeDirection = 1; // Will travel toward toNode
        } else {
            t = 1;
            edgeDirection = -1; // Will travel toward fromNode
        }

        return this.placeOnEdge(edge.id, t, edgeDirection);
    }

    // ========================================================================
    // MOVEMENT
    // ========================================================================

    /**
     * Move along the track by a given distance
     * @param distanceM - Distance to move in meters (positive = forward, negative = backward)
     * @returns Movement result with new position and traversal info
     */
    move(distanceM: number): MovementResult {
        // Default result for error cases
        const errorResult: MovementResult = {
            trackPosition: this.trackPosition || { edgeId: '', t: 0, edgeDirection: 1 },
            worldPose: this.worldPose || this.createDefaultPose(),
            edgeChanged: false,
            reachedDeadEnd: true,
            traversedEdges: []
        };

        if (!this.trackPosition) {
            console.warn(`${LOG_PREFIX} Cannot move - not placed on track`);
            return errorResult;
        }

        const traversedEdges: string[] = [];
        let currentEdgeId = this.trackPosition.edgeId;
        let currentT = this.trackPosition.t;
        let currentDirection = this.trackPosition.edgeDirection;
        let remainingDistance = Math.abs(distanceM);
        const movingForward = distanceM >= 0;

        // Determine actual edge direction based on movement direction
        let effectiveDirection = currentDirection;
        if (!movingForward) {
            effectiveDirection = (currentDirection * -1) as 1 | -1;
        }

        let edgeChanged = false;
        let reachedDeadEnd = false;
        let iterations = 0;
        const maxIterations = 100; // Safety limit

        while (remainingDistance > 0.0001 && iterations < maxIterations) {
            iterations++;

            const edge = this.graph.getEdge(currentEdgeId);
            if (!edge) {
                console.error(`${LOG_PREFIX} Edge ${currentEdgeId} not found during move`);
                reachedDeadEnd = true;
                break;
            }

            // Calculate how far we can go on this edge
            const edgeLength = edge.lengthM;
            const currentDistanceAlongEdge = currentT * edgeLength;

            let distanceToEnd: number;
            let targetT: number;

            if (effectiveDirection === 1) {
                // Moving toward toNode (t increasing)
                distanceToEnd = edgeLength - currentDistanceAlongEdge;
                targetT = 1;
            } else {
                // Moving toward fromNode (t decreasing)
                distanceToEnd = currentDistanceAlongEdge;
                targetT = 0;
            }

            if (remainingDistance <= distanceToEnd) {
                // We can complete the move on this edge
                const deltaT = remainingDistance / edgeLength;
                if (effectiveDirection === 1) {
                    currentT = currentT + deltaT;
                } else {
                    currentT = currentT - deltaT;
                }
                currentT = Math.max(0, Math.min(1, currentT));
                remainingDistance = 0;
            } else {
                // We need to transition to next edge
                remainingDistance -= distanceToEnd;
                currentT = targetT;

                // Find next edge
                const exitNodeId = effectiveDirection === 1 ? edge.toNodeId : edge.fromNodeId;
                const nextEdgeInfo = this.findNextEdge(currentEdgeId, exitNodeId, effectiveDirection);

                if (!nextEdgeInfo) {
                    // Dead end
                    console.log(`${LOG_PREFIX} Reached dead end at node ${exitNodeId}`);
                    reachedDeadEnd = true;
                    break;
                }

                // Transition to next edge
                traversedEdges.push(currentEdgeId);
                currentEdgeId = nextEdgeInfo.edgeId;
                currentT = nextEdgeInfo.entryT;
                effectiveDirection = nextEdgeInfo.direction;
                edgeChanged = true;

                // Update the stored direction based on movement
                if (movingForward) {
                    currentDirection = effectiveDirection;
                } else {
                    currentDirection = (effectiveDirection * -1) as 1 | -1;
                }
            }
        }

        if (iterations >= maxIterations) {
            console.warn(`${LOG_PREFIX} Move exceeded max iterations`);
        }

        // Update stored position
        this.trackPosition = {
            edgeId: currentEdgeId,
            t: currentT,
            edgeDirection: currentDirection
        };

        // Calculate new world pose
        const currentEdge = this.graph.getEdge(currentEdgeId);
        if (currentEdge) {
            this.worldPose = this.calculateWorldPose(currentEdge, currentT, currentDirection);
        }

        return {
            trackPosition: { ...this.trackPosition },
            worldPose: this.worldPose || this.createDefaultPose(),
            edgeChanged,
            reachedDeadEnd,
            traversedEdges
        };
    }

    // ========================================================================
    // EDGE TRANSITIONS
    // ========================================================================

    /**
     * Find the next edge when leaving a node
     * Uses PointsManager to determine route at switches
     * @param fromEdgeId - Edge we're leaving
     * @param nodeId - Node we're passing through
     * @param travelDirection - Direction of travel on current edge
     * @returns Next edge info or null if dead end
     */
    private findNextEdge(
        fromEdgeId: string,
        nodeId: string,
        travelDirection: 1 | -1
    ): { edgeId: string; entryT: number; direction: 1 | -1 } | null {
        // Get all edges connected to this node
        const connectedEdges = this.graph.getEdgesConnectedToNode(nodeId);

        // Filter out the edge we came from
        const candidates = connectedEdges.filter(e => e.id !== fromEdgeId);

        if (candidates.length === 0) {
            // Dead end
            return null;
        }

        let selectedEdge: GraphEdge;

        if (candidates.length === 1) {
            // Simple continuation - only one option
            selectedEdge = candidates[0];
        } else {
            // Multiple options - this is a switch/junction
            // Use PointsManager to determine route
            const fromEdge = this.graph.getEdge(fromEdgeId);
            if (!fromEdge) {
                selectedEdge = candidates[0];
            } else {
                const pieceId = fromEdge.pieceId;
                const selectedEdgeId = this.pointsManager.getRouteForPiece(pieceId, fromEdgeId, nodeId);

                if (selectedEdgeId) {
                    const found = candidates.find(e => e.id === selectedEdgeId);
                    selectedEdge = found || candidates[0];
                } else {
                    // Default to first candidate
                    selectedEdge = candidates[0];
                }
            }
        }

        // Determine entry point and direction on new edge
        let entryT: number;
        let direction: 1 | -1;

        if (selectedEdge.fromNodeId === nodeId) {
            // Entering at fromNode, will travel toward toNode
            entryT = 0;
            direction = 1;
        } else {
            // Entering at toNode, will travel toward fromNode
            entryT = 1;
            direction = -1;
        }

        return {
            edgeId: selectedEdge.id,
            entryT,
            direction
        };
    }

    // ========================================================================
    // WORLD POSITION CALCULATION
    // ========================================================================

    /**
     * Calculate world-space pose for a position on an edge
     * @param edge - The edge
     * @param t - Parametric position (0-1)
     * @param direction - Travel direction for orientation
     * @returns World pose
     */
    private calculateWorldPose(edge: GraphEdge, t: number, direction: 1 | -1): WorldPose {
        const fromNode = this.graph.getNode(edge.fromNodeId);
        const toNode = this.graph.getNode(edge.toNodeId);

        if (!fromNode || !toNode) {
            console.error(`${LOG_PREFIX} Cannot calculate pose - nodes not found`);
            return this.createDefaultPose();
        }

        let position: Vector3;
        let forward: Vector3;

        if (edge.curve.type === 'straight') {
            // Straight track - simple linear interpolation
            position = Vector3.Lerp(fromNode.pos, toNode.pos, t);
            forward = toNode.pos.subtract(fromNode.pos).normalize();
        } else {
            // Curved track - use arc mathematics
            const result = this.calculateArcPosition(
                fromNode.pos,
                toNode.pos,
                edge.curve,
                t
            );
            position = result.position;
            forward = result.tangent;
        }

        // Add height offset for rail surface
        position.y += RAIL_SURFACE_HEIGHT + this.config.heightOffset;

        // Flip forward if traveling in reverse direction on edge
        if (direction === -1) {
            forward = forward.scale(-1);
        }

        // Additionally flip if configured and we're reversing
        // (This handles the train model facing backward when going in reverse)

        // Calculate right vector (perpendicular, horizontal)
        const right = Vector3.Cross(Vector3.Up(), forward).normalize();

        // Calculate rotation quaternion
        const rotation = Quaternion.FromLookDirectionLH(forward, Vector3.Up());

        return {
            position,
            forward,
            rotation,
            right
        };
    }

    /**
     * Calculate position and tangent on a curved track segment
     * @param startPos - Start node position
     * @param endPos - End node position
     * @param curve - Curve definition
     * @param t - Parametric position (0-1)
     * @returns Position and tangent vector
     */
    private calculateArcPosition(
        startPos: Vector3,
        endPos: Vector3,
        curve: CurveDefinition,
        t: number
    ): { position: Vector3; tangent: Vector3 } {
        if (!curve.arcRadiusM || !curve.arcAngleDeg) {
            // Fallback to straight
            const position = Vector3.Lerp(startPos, endPos, t);
            const tangent = endPos.subtract(startPos).normalize();
            return { position, tangent };
        }

        const radius = curve.arcRadiusM;
        const angleDeg = curve.arcAngleDeg;
        const direction = curve.arcDirection || 1;

        // Calculate arc center
        // The center is perpendicular to the start direction at distance = radius
        const startToEnd = endPos.subtract(startPos);
        const startDir = startToEnd.normalize();

        // Perpendicular direction (left or right based on curve direction)
        const perpendicular = new Vector3(
            -startDir.z * direction,
            0,
            startDir.x * direction
        );

        // Arc center
        const center = startPos.add(perpendicular.scale(radius));

        // Calculate angle for this t value
        const totalAngleRad = (angleDeg * Math.PI) / 180;
        const currentAngle = t * totalAngleRad * -direction; // Negative for correct rotation

        // Starting vector from center to start position
        const startVec = startPos.subtract(center);

        // Rotate around Y axis
        const cosA = Math.cos(currentAngle);
        const sinA = Math.sin(currentAngle);

        const rotatedX = startVec.x * cosA - startVec.z * sinA;
        const rotatedZ = startVec.x * sinA + startVec.z * cosA;

        // Calculate position
        const position = new Vector3(
            center.x + rotatedX,
            startPos.y, // Keep Y level
            center.z + rotatedZ
        );

        // Calculate tangent (perpendicular to radius, in direction of travel)
        const radiusVec = position.subtract(center).normalize();
        const tangent = new Vector3(
            -radiusVec.z * direction,
            0,
            radiusVec.x * direction
        );

        return { position, tangent: tangent.normalize() };
    }

    /**
     * Create a default pose at origin
     * @returns Default world pose
     */
    private createDefaultPose(): WorldPose {
        return {
            position: Vector3.Zero(),
            forward: new Vector3(1, 0, 0),
            rotation: Quaternion.Identity(),
            right: new Vector3(0, 0, 1)
        };
    }

    // ========================================================================
    // GETTERS
    // ========================================================================

    /**
     * Get current track position
     * @returns Current track position or null if not placed
     */
    getTrackPosition(): TrackPosition | null {
        return this.trackPosition ? { ...this.trackPosition } : null;
    }

    /**
     * Get current world pose
     * @returns Current world pose or null if not placed
     */
    getWorldPose(): WorldPose | null {
        return this.worldPose ? { ...this.worldPose } : null;
    }

    /**
     * Check if train is placed on track
     * @returns true if train has a valid track position
     */
    isOnTrack(): boolean {
        return this.trackPosition !== null;
    }

    /**
     * Get the current edge
     * @returns Current edge or null
     */
    getCurrentEdge(): GraphEdge | null {
        if (!this.trackPosition) return null;
        return this.graph.getEdge(this.trackPosition.edgeId) || null;
    }

    /**
     * Get distance to next node (in current travel direction)
     * @returns Distance in meters, or null if not on track
     */
    getDistanceToNextNode(): number | null {
        if (!this.trackPosition) return null;

        const edge = this.graph.getEdge(this.trackPosition.edgeId);
        if (!edge) return null;

        if (this.trackPosition.edgeDirection === 1) {
            // Traveling toward toNode
            return edge.lengthM * (1 - this.trackPosition.t);
        } else {
            // Traveling toward fromNode
            return edge.lengthM * this.trackPosition.t;
        }
    }
}