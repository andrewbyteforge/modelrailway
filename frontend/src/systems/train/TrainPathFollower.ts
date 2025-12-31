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
 * IMPORTANT: Trains are kept at a fixed Y height (rail surface) and only
 * rotate around the Y axis to stay level on the track.
 * 
 * @module TrainPathFollower
 * @author Model Railway Workbench
 * @version 1.1.0
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

/** 
 * Rail surface height above baseboard in meters
 * Baseboard top is at 0.95m, rail top is ~8mm above that = 0.958m
 */
const RAIL_TOP_HEIGHT = 0.958;

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

    /** Fixed rail top height in meters (if 0, will use node Y positions) */
    railTopHeight: number;
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
            railTopHeight: RAIL_TOP_HEIGHT,
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
        console.log(`${LOG_PREFIX}   Position: (${this.worldPose.position.x.toFixed(3)}, ${this.worldPose.position.y.toFixed(3)}, ${this.worldPose.position.z.toFixed(3)})`);
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
     * Move the train along the track by a given distance
     * @param distanceM - Distance to move in meters (negative = backward)
     * @returns Movement result with new position/pose
     */
    move(distanceM: number): MovementResult {
        // Default result for when not on track
        if (!this.trackPosition) {
            return {
                trackPosition: { edgeId: '', t: 0, edgeDirection: 1 },
                worldPose: this.createDefaultPose(),
                edgeChanged: false,
                reachedDeadEnd: false,
                traversedEdges: []
            };
        }

        const traversedEdges: string[] = [];
        let edgeChanged = false;
        let reachedDeadEnd = false;
        let remainingDistance = distanceM;

        // Get current edge
        let currentEdge = this.graph.getEdge(this.trackPosition.edgeId);
        if (!currentEdge) {
            return {
                trackPosition: this.trackPosition,
                worldPose: this.worldPose || this.createDefaultPose(),
                edgeChanged: false,
                reachedDeadEnd: true,
                traversedEdges: []
            };
        }

        // Copy current position for modification
        let currentT = this.trackPosition.t;
        let currentDirection = this.trackPosition.edgeDirection;
        let currentEdgeId = this.trackPosition.edgeId;

        // Move along track, handling edge transitions
        while (Math.abs(remainingDistance) > 0.0001) {
            // Calculate distance to edge end in current direction
            const edgeLength = currentEdge.lengthM;
            let distanceToEnd: number;

            if (currentDirection === 1) {
                // Traveling toward toNode (t=1)
                distanceToEnd = (1 - currentT) * edgeLength;
            } else {
                // Traveling toward fromNode (t=0)
                distanceToEnd = currentT * edgeLength;
            }

            // Determine actual movement distance on this edge
            const moveDirection = Math.sign(remainingDistance);
            const actualMove = Math.min(Math.abs(remainingDistance), distanceToEnd);

            // Update t based on movement
            const deltaT = (actualMove / edgeLength) * currentDirection * moveDirection;
            currentT += deltaT;

            // Reduce remaining distance
            remainingDistance -= actualMove * moveDirection;

            // Check if we've reached edge end
            if (currentT <= 0 || currentT >= 1) {
                // Clamp t
                currentT = Math.max(0, Math.min(1, currentT));

                // Try to transition to next edge
                const nodeId = currentDirection === 1 ? currentEdge.toNodeId : currentEdge.fromNodeId;
                const nextEdgeInfo = this.getNextEdge(currentEdgeId, nodeId);

                if (nextEdgeInfo) {
                    // Transition to next edge
                    traversedEdges.push(currentEdgeId);
                    currentEdgeId = nextEdgeInfo.edgeId;
                    currentT = nextEdgeInfo.entryT;
                    currentDirection = nextEdgeInfo.direction;
                    edgeChanged = true;

                    const nextEdge = this.graph.getEdge(currentEdgeId);
                    if (!nextEdge) {
                        reachedDeadEnd = true;
                        break;
                    }
                    currentEdge = nextEdge;
                } else {
                    // Dead end - stop here
                    reachedDeadEnd = true;
                    break;
                }
            }
        }

        // Update stored position
        this.trackPosition = {
            edgeId: currentEdgeId,
            t: currentT,
            edgeDirection: currentDirection
        };

        // Calculate new world pose
        this.worldPose = this.calculateWorldPose(currentEdge, currentT, currentDirection);

        return {
            trackPosition: { ...this.trackPosition },
            worldPose: { ...this.worldPose },
            edgeChanged,
            reachedDeadEnd,
            traversedEdges
        };
    }

    /**
     * Reverse the direction of travel
     */
    reverseDirection(): void {
        if (!this.trackPosition) return;

        this.trackPosition.edgeDirection *= -1;

        // Recalculate pose with new direction
        const edge = this.graph.getEdge(this.trackPosition.edgeId);
        if (edge) {
            this.worldPose = this.calculateWorldPose(
                edge,
                this.trackPosition.t,
                this.trackPosition.edgeDirection
            );
        }
    }

    // ========================================================================
    // EDGE TRANSITION LOGIC
    // ========================================================================

    /**
     * Get next edge when transitioning at a node
     * @param fromEdgeId - Edge we're leaving
     * @param nodeId - Node we're arriving at
     * @returns Next edge info or null if dead end
     */
    private getNextEdge(
        fromEdgeId: string,
        nodeId: string
    ): { edgeId: string; entryT: number; direction: 1 | -1 } | null {
        const node = this.graph.getNode(nodeId);
        if (!node) return null;

        const fromEdge = this.graph.getEdge(fromEdgeId);
        if (!fromEdge) return null;

        // Get all edges at this node except the one we came from
        const connectedEdges = this.graph.getEdgesConnectedToNode(nodeId);
        const candidates = connectedEdges.filter(e => e.id !== fromEdgeId);

        if (candidates.length === 0) {
            // Dead end
            return null;
        }

        // Select next edge
        let selectedEdge: GraphEdge;

        if (candidates.length === 1) {
            // Only one option
            selectedEdge = candidates[0];
        } else {
            // Multiple options - check points manager for route
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
     * 
     * IMPORTANT: This ensures:
     * 1. Y position is fixed at rail top height (train stays level)
     * 2. Forward vector has Y=0 (rotation is only around Y axis)
     * 3. No pitch or roll is applied to the train
     * 
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

        let positionXZ: { x: number; z: number };
        let forwardXZ: { x: number; z: number };

        if (edge.curve.type === 'straight') {
            // Straight track - simple linear interpolation (XZ only)
            positionXZ = {
                x: fromNode.pos.x + (toNode.pos.x - fromNode.pos.x) * t,
                z: fromNode.pos.z + (toNode.pos.z - fromNode.pos.z) * t
            };

            // Forward direction (XZ only, normalized)
            const dx = toNode.pos.x - fromNode.pos.x;
            const dz = toNode.pos.z - fromNode.pos.z;
            const len = Math.sqrt(dx * dx + dz * dz);
            forwardXZ = {
                x: len > 0 ? dx / len : 1,
                z: len > 0 ? dz / len : 0
            };
        } else {
            // Curved track - use arc mathematics
            const result = this.calculateArcPositionXZ(
                { x: fromNode.pos.x, z: fromNode.pos.z },
                { x: toNode.pos.x, z: toNode.pos.z },
                edge.curve,
                t
            );
            positionXZ = result.position;
            forwardXZ = result.tangent;
        }

        // Create position with FIXED Y at rail top height
        const position = new Vector3(
            positionXZ.x,
            this.config.railTopHeight + this.config.heightOffset,
            positionXZ.z
        );

        // Create forward vector with Y=0 (horizontal only)
        let forward = new Vector3(forwardXZ.x, 0, forwardXZ.z).normalize();

        // Flip forward if traveling in reverse direction on edge
        if (direction === -1) {
            forward = forward.scale(-1);
        }

        // Calculate right vector (perpendicular, horizontal)
        const right = Vector3.Cross(Vector3.Up(), forward).normalize();

        // Calculate rotation quaternion - ONLY around Y axis
        // Using atan2 to get yaw angle from forward direction
        const yawAngle = Math.atan2(forward.x, forward.z);
        const rotation = Quaternion.RotationAxis(Vector3.Up(), yawAngle);

        return {
            position,
            forward,
            rotation,
            right
        };
    }

    /**
     * Calculate position and tangent on a curved track segment (XZ plane only)
     * @param startPos - Start node position (x, z)
     * @param endPos - End node position (x, z)
     * @param curve - Curve definition
     * @param t - Parametric position (0-1)
     * @returns Position and tangent in XZ plane
     */
    private calculateArcPositionXZ(
        startPos: { x: number; z: number },
        endPos: { x: number; z: number },
        curve: CurveDefinition,
        t: number
    ): { position: { x: number; z: number }; tangent: { x: number; z: number } } {
        if (!curve.arcRadiusM || !curve.arcAngleDeg) {
            // Fallback to straight
            const position = {
                x: startPos.x + (endPos.x - startPos.x) * t,
                z: startPos.z + (endPos.z - startPos.z) * t
            };
            const dx = endPos.x - startPos.x;
            const dz = endPos.z - startPos.z;
            const len = Math.sqrt(dx * dx + dz * dz);
            const tangent = {
                x: len > 0 ? dx / len : 1,
                z: len > 0 ? dz / len : 0
            };
            return { position, tangent };
        }

        const radius = curve.arcRadiusM;
        const angleDeg = curve.arcAngleDeg;
        const direction = curve.arcDirection || 1;

        // Calculate arc center
        const dx = endPos.x - startPos.x;
        const dz = endPos.z - startPos.z;
        const len = Math.sqrt(dx * dx + dz * dz);
        const startDirX = len > 0 ? dx / len : 1;
        const startDirZ = len > 0 ? dz / len : 0;

        // Perpendicular direction (left or right based on curve direction)
        const perpX = -startDirZ * direction;
        const perpZ = startDirX * direction;

        // Arc center
        const centerX = startPos.x + perpX * radius;
        const centerZ = startPos.z + perpZ * radius;

        // Calculate angle for this t value
        const totalAngleRad = (angleDeg * Math.PI) / 180;
        const currentAngle = t * totalAngleRad * -direction;

        // Starting vector from center to start position
        const startVecX = startPos.x - centerX;
        const startVecZ = startPos.z - centerZ;

        // Rotate around Y axis
        const cosA = Math.cos(currentAngle);
        const sinA = Math.sin(currentAngle);

        const rotatedX = startVecX * cosA - startVecZ * sinA;
        const rotatedZ = startVecX * sinA + startVecZ * cosA;

        // Calculate position
        const position = {
            x: centerX + rotatedX,
            z: centerZ + rotatedZ
        };

        // Calculate tangent (perpendicular to radius, in direction of travel)
        const radiusVecX = position.x - centerX;
        const radiusVecZ = position.z - centerZ;
        const radiusLen = Math.sqrt(radiusVecX * radiusVecX + radiusVecZ * radiusVecZ);
        const radiusNormX = radiusLen > 0 ? radiusVecX / radiusLen : 0;
        const radiusNormZ = radiusLen > 0 ? radiusVecZ / radiusLen : 1;

        const tangent = {
            x: -radiusNormZ * direction,
            z: radiusNormX * direction
        };

        // Normalize tangent
        const tangentLen = Math.sqrt(tangent.x * tangent.x + tangent.z * tangent.z);
        if (tangentLen > 0) {
            tangent.x /= tangentLen;
            tangent.z /= tangentLen;
        }

        return { position, tangent };
    }

    /**
     * Create a default pose at origin
     * @returns Default world pose
     */
    private createDefaultPose(): WorldPose {
        return {
            position: new Vector3(0, this.config.railTopHeight, 0),
            forward: new Vector3(0, 0, 1),
            rotation: Quaternion.Identity(),
            right: new Vector3(1, 0, 0)
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

    // ========================================================================
    // CONFIGURATION
    // ========================================================================

    /**
     * Set the rail top height
     * @param height - Height in meters
     */
    setRailTopHeight(height: number): void {
        this.config.railTopHeight = height;
        console.log(`${LOG_PREFIX} Rail top height set to ${height.toFixed(4)}m`);
    }

    /**
     * Set height offset above rail
     * @param offset - Offset in meters
     */
    setHeightOffset(offset: number): void {
        this.config.heightOffset = offset;
    }
}