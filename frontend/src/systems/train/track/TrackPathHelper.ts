/**
 * TrackPathHelper.ts - Comprehensive track geometry query utilities
 * 
 * Path: frontend/src/systems/train/TrackPathHelper.ts
 * 
 * Provides utilities for querying track geometry:
 * - Get position/direction at any point along track
 * - Find closest point on track to world position
 * - Calculate path length between two points
 * - Support for straight and curved track
 * - Arc mathematics for accurate curve following
 * 
 * This is a pure utility class with no state - all methods are
 * based on the track graph data.
 * 
 * @module TrackPathHelper
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Vector3, Quaternion, Matrix } from '@babylonjs/core/Maths/math.vector';
import type { TrackGraph, GraphEdge, GraphNode, CurveDefinition } from '../../track/TrackGraph';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[TrackPathHelper]';

/** Number of samples for closest point search */
const SEARCH_SAMPLES = 30;

/** Tolerance for point comparison */
const POSITION_TOLERANCE = 0.0001; // 0.1mm

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Position and orientation on track
 */
export interface TrackPose {
    /** World position on track centreline */
    position: Vector3;

    /** Forward direction (tangent to track) */
    forward: Vector3;

    /** Right direction (perpendicular, horizontal) */
    right: Vector3;

    /** Up direction (perpendicular, vertical) */
    up: Vector3;

    /** Rotation quaternion to orient objects along track */
    rotation: Quaternion;
}

/**
 * Point on track with edge reference
 */
export interface TrackPoint {
    /** Edge this point is on */
    edgeId: string;

    /** Parametric position on edge (0-1) */
    t: number;

    /** Track pose at this point */
    pose: TrackPose;

    /** Distance along edge from start */
    distanceAlongEdge: number;
}

/**
 * Result of finding closest point on track
 */
export interface ClosestPointResult {
    /** Closest point on track */
    trackPoint: TrackPoint;

    /** Distance from query point to track point */
    distance: number;

    /** Query point projected onto track plane */
    projectedPoint: Vector3;
}

/**
 * Path between two points on track
 */
export interface TrackPath {
    /** Starting point */
    start: TrackPoint;

    /** Ending point */
    end: TrackPoint;

    /** Total path length in metres */
    lengthM: number;

    /** Sequence of edges traversed */
    edges: string[];

    /** Is the path continuous (no gaps) */
    isContinuous: boolean;
}

// ============================================================================
// TRACK PATH HELPER CLASS
// ============================================================================

/**
 * TrackPathHelper - Utilities for querying track geometry
 * 
 * @example
 * ```typescript
 * const helper = new TrackPathHelper(trackGraph);
 * 
 * // Get pose at position on edge
 * const pose = helper.getPoseOnEdge('edge_1', 0.5);
 * model.position = pose.position;
 * model.rotationQuaternion = pose.rotation;
 * 
 * // Find closest track point to world position
 * const result = helper.findClosestPoint(worldPosition);
 * console.log(`Distance to track: ${result.distance * 1000}mm`);
 * ```
 */
export class TrackPathHelper {

    // ========================================================================
    // PRIVATE STATE
    // ========================================================================

    /** Track graph reference */
    private readonly graph: TrackGraph;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new TrackPathHelper
     * 
     * @param graph - Track graph to query
     */
    constructor(graph: TrackGraph) {
        this.graph = graph;
    }

    // ========================================================================
    // PUBLIC API - POSE QUERIES
    // ========================================================================

    /**
     * Get track pose at a position on an edge
     * 
     * @param edgeId - Edge ID
     * @param t - Parametric position (0 = start, 1 = end)
     * @returns Track pose or null if edge not found
     */
    getPoseOnEdge(edgeId: string, t: number): TrackPose | null {
        const edge = this.graph.getEdge(edgeId);
        if (!edge) {
            console.warn(`${LOG_PREFIX} Edge not found: ${edgeId}`);
            return null;
        }

        const fromNode = this.graph.getNode(edge.fromNodeId);
        const toNode = this.graph.getNode(edge.toNodeId);

        if (!fromNode || !toNode) {
            console.warn(`${LOG_PREFIX} Nodes not found for edge: ${edgeId}`);
            return null;
        }

        return this.calculatePose(edge, fromNode, toNode, t);
    }

    /**
     * Get track point at a position on an edge
     * 
     * @param edgeId - Edge ID
     * @param t - Parametric position (0-1)
     * @returns Track point or null if edge not found
     */
    getPointOnEdge(edgeId: string, t: number): TrackPoint | null {
        const edge = this.graph.getEdge(edgeId);
        if (!edge) return null;

        const pose = this.getPoseOnEdge(edgeId, t);
        if (!pose) return null;

        return {
            edgeId,
            t: Math.max(0, Math.min(1, t)),
            pose,
            distanceAlongEdge: t * edge.lengthM
        };
    }

    /**
     * Get pose at a distance along an edge
     * 
     * @param edgeId - Edge ID
     * @param distanceM - Distance from start of edge in metres
     * @returns Track pose or null if invalid
     */
    getPoseAtDistance(edgeId: string, distanceM: number): TrackPose | null {
        const edge = this.graph.getEdge(edgeId);
        if (!edge) return null;

        // Convert distance to parametric t
        const t = Math.max(0, Math.min(1, distanceM / edge.lengthM));

        return this.getPoseOnEdge(edgeId, t);
    }

    /**
     * Sample poses along an edge at regular intervals
     * 
     * @param edgeId - Edge ID
     * @param numSamples - Number of samples (minimum 2)
     * @returns Array of track poses
     */
    samplePosesOnEdge(edgeId: string, numSamples: number): TrackPose[] {
        const poses: TrackPose[] = [];
        const samples = Math.max(2, numSamples);

        for (let i = 0; i < samples; i++) {
            const t = i / (samples - 1);
            const pose = this.getPoseOnEdge(edgeId, t);
            if (pose) {
                poses.push(pose);
            }
        }

        return poses;
    }

    // ========================================================================
    // PUBLIC API - CLOSEST POINT
    // ========================================================================

    /**
     * Find the closest point on any track to a world position
     * 
     * @param worldPosition - World position to search from
     * @param maxDistance - Maximum search distance (default: unlimited)
     * @param excludeEdges - Edge IDs to exclude from search
     * @returns Closest point result or null if no track found
     */
    findClosestPoint(
        worldPosition: Vector3,
        maxDistance?: number,
        excludeEdges?: Set<string>
    ): ClosestPointResult | null {
        let bestResult: ClosestPointResult | null = null;
        let bestDistance = maxDistance ?? Infinity;

        const allEdges = this.graph.getAllEdges();

        for (const edge of allEdges) {
            if (excludeEdges?.has(edge.id)) continue;

            const result = this.findClosestPointOnEdge(edge.id, worldPosition);

            if (result && result.distance < bestDistance) {
                bestDistance = result.distance;
                bestResult = result;
            }
        }

        return bestResult;
    }

    /**
     * Find the closest point on a specific edge to a world position
     * 
     * @param edgeId - Edge to search
     * @param worldPosition - World position
     * @returns Closest point result or null
     */
    findClosestPointOnEdge(
        edgeId: string,
        worldPosition: Vector3
    ): ClosestPointResult | null {
        const edge = this.graph.getEdge(edgeId);
        if (!edge) return null;

        const fromNode = this.graph.getNode(edge.fromNodeId);
        const toNode = this.graph.getNode(edge.toNodeId);
        if (!fromNode || !toNode) return null;

        // Use iterative refinement for accuracy
        let bestT = 0;
        let bestDistance = Infinity;
        let bestPose: TrackPose | null = null;

        // First pass: coarse search
        for (let i = 0; i <= SEARCH_SAMPLES; i++) {
            const t = i / SEARCH_SAMPLES;
            const pose = this.calculatePose(edge, fromNode, toNode, t);

            const dist = Vector3.Distance(worldPosition, pose.position);

            if (dist < bestDistance) {
                bestDistance = dist;
                bestT = t;
                bestPose = pose;
            }
        }

        // Second pass: refine around best t
        const refinementRange = 1 / SEARCH_SAMPLES;
        const refinementSteps = 10;

        for (let i = 0; i <= refinementSteps; i++) {
            const t = bestT - refinementRange + (2 * refinementRange * i / refinementSteps);
            if (t < 0 || t > 1) continue;

            const pose = this.calculatePose(edge, fromNode, toNode, t);
            const dist = Vector3.Distance(worldPosition, pose.position);

            if (dist < bestDistance) {
                bestDistance = dist;
                bestT = t;
                bestPose = pose;
            }
        }

        if (!bestPose) return null;

        // Create track point
        const trackPoint: TrackPoint = {
            edgeId,
            t: bestT,
            pose: bestPose,
            distanceAlongEdge: bestT * edge.lengthM
        };

        // Calculate projected point (on track plane at same height)
        const projectedPoint = new Vector3(
            bestPose.position.x,
            worldPosition.y,
            bestPose.position.z
        );

        return {
            trackPoint,
            distance: bestDistance,
            projectedPoint
        };
    }

    /**
     * Check if a world position is on or near track
     * 
     * @param worldPosition - Position to check
     * @param tolerance - Distance tolerance in metres
     * @returns true if position is on track
     */
    isOnTrack(worldPosition: Vector3, tolerance: number = 0.02): boolean {
        const result = this.findClosestPoint(worldPosition, tolerance);
        return result !== null;
    }

    // ========================================================================
    // PUBLIC API - PATH QUERIES
    // ========================================================================

    /**
     * Get the length of an edge
     * 
     * @param edgeId - Edge ID
     * @returns Length in metres, or 0 if not found
     */
    getEdgeLength(edgeId: string): number {
        const edge = this.graph.getEdge(edgeId);
        return edge?.lengthM ?? 0;
    }

    /**
     * Calculate distance along track between two points on the same edge
     * 
     * @param edgeId - Edge ID
     * @param t1 - First parametric position
     * @param t2 - Second parametric position
     * @returns Distance in metres
     */
    getDistanceOnEdge(edgeId: string, t1: number, t2: number): number {
        const length = this.getEdgeLength(edgeId);
        return Math.abs(t2 - t1) * length;
    }

    /**
     * Move a distance along an edge from a starting position
     * 
     * Returns the new t value, handling edge boundaries.
     * If distance exceeds edge length, returns null with remaining distance.
     * 
     * @param edgeId - Edge ID
     * @param startT - Starting parametric position
     * @param distanceM - Distance to move (positive = toward t=1)
     * @returns Result with new t and any remaining distance
     */
    moveAlongEdge(
        edgeId: string,
        startT: number,
        distanceM: number
    ): { newT: number; remainingM: number; reachedEnd: boolean } {
        const edge = this.graph.getEdge(edgeId);
        if (!edge) {
            return { newT: startT, remainingM: distanceM, reachedEnd: false };
        }

        const tDelta = distanceM / edge.lengthM;
        let newT = startT + tDelta;
        let remainingM = 0;
        let reachedEnd = false;

        if (newT > 1) {
            remainingM = (newT - 1) * edge.lengthM;
            newT = 1;
            reachedEnd = true;
        } else if (newT < 0) {
            remainingM = -newT * edge.lengthM;
            newT = 0;
            reachedEnd = true;
        }

        return { newT, remainingM, reachedEnd };
    }

    // ========================================================================
    // PUBLIC API - GEOMETRY UTILITIES
    // ========================================================================

    /**
     * Create a rotation quaternion to align an object with track direction
     * 
     * @param forward - Track forward direction
     * @param modelForwardAxis - Which axis the model uses as forward
     * @returns Rotation quaternion
     */
    createTrackAlignedRotation(
        forward: Vector3,
        modelForwardAxis: 'POS_X' | 'NEG_X' | 'POS_Z' | 'NEG_Z' = 'NEG_Z'
    ): Quaternion {
        // Get track angle in world space
        const trackAngle = Math.atan2(forward.x, forward.z);

        // Model axis offsets
        const offsets: Record<string, number> = {
            'POS_X': -Math.PI / 2,
            'NEG_X': Math.PI / 2,
            'POS_Z': 0,
            'NEG_Z': Math.PI
        };

        const modelOffset = offsets[modelForwardAxis] ?? 0;
        const finalAngle = trackAngle + modelOffset;

        return Quaternion.FromEulerAngles(0, finalAngle, 0);
    }

    /**
     * Calculate a world position offset from track
     * 
     * Useful for placing things next to the track (e.g. signals).
     * 
     * @param edgeId - Edge ID
     * @param t - Parametric position
     * @param rightOffset - Offset to the right of track (metres)
     * @param upOffset - Offset above track (metres)
     * @param forwardOffset - Offset along track (metres)
     * @returns World position or null
     */
    getOffsetPosition(
        edgeId: string,
        t: number,
        rightOffset: number = 0,
        upOffset: number = 0,
        forwardOffset: number = 0
    ): Vector3 | null {
        const pose = this.getPoseOnEdge(edgeId, t);
        if (!pose) return null;

        return pose.position
            .add(pose.right.scale(rightOffset))
            .add(pose.up.scale(upOffset))
            .add(pose.forward.scale(forwardOffset));
    }

    // ========================================================================
    // PRIVATE - POSE CALCULATION
    // ========================================================================

    /**
     * Calculate track pose for an edge at parametric position
     */
    private calculatePose(
        edge: GraphEdge,
        fromNode: GraphNode,
        toNode: GraphNode,
        t: number
    ): TrackPose {
        let position: Vector3;
        let forward: Vector3;

        if (edge.curve.type === 'straight') {
            // Straight track: linear interpolation
            const result = this.calculateStraightPose(fromNode.pos, toNode.pos, t);
            position = result.position;
            forward = result.forward;

        } else if (edge.curve.type === 'arc') {
            // Curved track: arc mathematics
            const result = this.calculateArcPose(edge, fromNode, toNode, t);
            position = result.position;
            forward = result.forward;

        } else {
            // Unknown type: fall back to linear
            const result = this.calculateStraightPose(fromNode.pos, toNode.pos, t);
            position = result.position;
            forward = result.forward;
        }

        // Ensure forward is horizontal and normalised
        forward.y = 0;
        forward.normalize();

        // Calculate right (perpendicular to forward, horizontal)
        const right = Vector3.Cross(Vector3.Up(), forward).normalize();

        // Up is always world up
        const up = Vector3.Up();

        // Create rotation quaternion
        const rotation = this.createRotationFromAxes(forward, up, right);

        return { position, forward, right, up, rotation };
    }

    /**
     * Calculate pose for straight track
     */
    private calculateStraightPose(
        start: Vector3,
        end: Vector3,
        t: number
    ): { position: Vector3; forward: Vector3 } {
        const position = Vector3.Lerp(start, end, t);
        const forward = end.subtract(start).normalize();

        return { position, forward };
    }

    /**
     * Calculate pose for curved arc track
     */
    private calculateArcPose(
        edge: GraphEdge,
        fromNode: GraphNode,
        toNode: GraphNode,
        t: number
    ): { position: Vector3; forward: Vector3 } {
        const curve = edge.curve;
        const radius = curve.arcRadiusM ?? 0.371; // Default R1
        const angleDeg = curve.arcAngleDeg ?? 45;
        const direction = curve.arcDirection ?? 1; // 1 = left/CCW, -1 = right/CW

        const startPos = fromNode.pos;
        const endPos = toNode.pos;

        // Calculate arc geometry
        const angleRad = (angleDeg * Math.PI) / 180;

        // Direction from start to end (chord)
        const chordDir = endPos.subtract(startPos).normalize();

        // Perpendicular direction (toward arc center)
        const perpendicular = new Vector3(
            -chordDir.z * direction,
            0,
            chordDir.x * direction
        );

        // Calculate arc center
        const halfAngle = angleRad / 2;
        const chordLength = Vector3.Distance(startPos, endPos);

        // Using geometry: center is perpendicular to chord at specific distance
        const midToCenter = radius * Math.cos(halfAngle);
        const sagitta = radius * (1 - Math.cos(halfAngle));

        const chordMid = Vector3.Lerp(startPos, endPos, 0.5);
        const center = chordMid.add(perpendicular.scale(midToCenter - sagitta));

        // Calculate start angle
        const startAngle = Math.atan2(
            startPos.z - center.z,
            startPos.x - center.x
        );

        // Current angle at t
        const currentAngle = startAngle + (t * angleRad * direction);

        // Calculate position
        const position = new Vector3(
            center.x + radius * Math.cos(currentAngle),
            startPos.y, // Keep Y level
            center.z + radius * Math.sin(currentAngle)
        );

        // Forward is tangent to arc
        const radiusVec = position.subtract(center).normalize();
        const forward = new Vector3(
            -radiusVec.z * direction,
            0,
            radiusVec.x * direction
        );

        return { position, forward: forward.normalize() };
    }

    /**
     * Create rotation quaternion from axis vectors
     */
    private createRotationFromAxes(
        forward: Vector3,
        up: Vector3,
        right: Vector3
    ): Quaternion {
        // Create rotation matrix from axes
        const matrix = Matrix.FromValues(
            right.x, right.y, right.z, 0,
            up.x, up.y, up.z, 0,
            forward.x, forward.y, forward.z, 0,
            0, 0, 0, 1
        );

        // Extract quaternion from matrix
        return Quaternion.FromRotationMatrix(matrix);
    }
}

// ============================================================================
// SINGLETON HELPER
// ============================================================================

/** Cached helper instance */
let cachedHelper: TrackPathHelper | null = null;

/**
 * Get or create TrackPathHelper for a graph
 * 
 * @param graph - Track graph
 * @returns TrackPathHelper instance
 */
export function getTrackPathHelper(graph: TrackGraph): TrackPathHelper {
    // Note: This doesn't cache across different graphs
    // For production, you might want a WeakMap cache
    return new TrackPathHelper(graph);
}