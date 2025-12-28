/**
 * TrackEdgeFinder.ts - Utility for finding track edges from positions
 * 
 * Path: frontend/src/systems/train/TrackEdgeFinder.ts
 * 
 * Provides utilities for:
 * - Finding the nearest edge to a world position
 * - Finding the parametric t value on an edge for a position
 * - Getting world position from edge + t
 * - Supporting train placement on track
 * 
 * @module TrackEdgeFinder
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TrackGraph, GraphEdge, GraphNode, CurveDefinition } from '../track/TrackGraph';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[TrackEdgeFinder]';

/** Maximum search distance for finding edges */
const MAX_SEARCH_DISTANCE = 0.5; // 500mm

/** Number of samples per edge for distance calculation */
const SAMPLES_PER_EDGE = 20;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Result of finding nearest edge
 */
export interface EdgeFindResult {
    /** Edge that was found */
    edge: GraphEdge;

    /** Parametric position on edge (0-1) */
    t: number;

    /** Distance from search position to edge point */
    distance: number;

    /** World position on the edge */
    position: Vector3;

    /** Forward direction at this point */
    forward: Vector3;
}

/**
 * Options for edge finding
 */
export interface EdgeFindOptions {
    /** Maximum distance to search */
    maxDistance?: number;

    /** Exclude these edge IDs from search */
    excludeEdges?: string[];

    /** Only search edges from these piece IDs */
    filterByPieces?: string[];
}

// ============================================================================
// TRACK EDGE FINDER CLASS
// ============================================================================

/**
 * TrackEdgeFinder - Finds track edges from world positions
 * 
 * Useful for placing trains on track at specific locations.
 * 
 * @example
 * ```typescript
 * const finder = new TrackEdgeFinder(graph);
 * const result = finder.findNearestEdge(clickPosition);
 * if (result) {
 *     trainController.placeOnEdge(result.edge.id, result.t, 1);
 * }
 * ```
 */
export class TrackEdgeFinder {
    // ========================================================================
    // PRIVATE STATE
    // ========================================================================

    /** Track graph reference */
    private graph: TrackGraph;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new TrackEdgeFinder
     * @param graph - Track graph to search
     */
    constructor(graph: TrackGraph) {
        this.graph = graph;
    }

    // ========================================================================
    // EDGE FINDING
    // ========================================================================

    /**
     * Find the nearest edge to a world position
     * @param position - World position to search from
     * @param options - Search options
     * @returns Edge find result or null if none found
     */
    findNearestEdge(position: Vector3, options?: EdgeFindOptions): EdgeFindResult | null {
        const maxDist = options?.maxDistance ?? MAX_SEARCH_DISTANCE;
        const excludeEdges = new Set(options?.excludeEdges || []);
        const filterPieces = options?.filterByPieces ? new Set(options.filterByPieces) : null;

        let bestResult: EdgeFindResult | null = null;
        let bestDistance = maxDist;

        const allEdges = this.graph.getAllEdges();

        for (const edge of allEdges) {
            // Skip excluded edges
            if (excludeEdges.has(edge.id)) continue;

            // Filter by piece if specified
            if (filterPieces && !filterPieces.has(edge.pieceId)) continue;

            // Find closest point on this edge
            const result = this.findClosestPointOnEdge(edge, position);

            if (result && result.distance < bestDistance) {
                bestDistance = result.distance;
                bestResult = result;
            }
        }

        return bestResult;
    }

    /**
     * Find closest point on a specific edge to a position
     * @param edge - Edge to search
     * @param position - World position
     * @returns Result or null if edge is invalid
     */
    findClosestPointOnEdge(edge: GraphEdge, position: Vector3): EdgeFindResult | null {
        const fromNode = this.graph.getNode(edge.fromNodeId);
        const toNode = this.graph.getNode(edge.toNodeId);

        if (!fromNode || !toNode) {
            return null;
        }

        // Sample points along the edge and find closest
        let bestT = 0;
        let bestDistance = Infinity;
        let bestPosition = fromNode.pos.clone();
        let bestForward = toNode.pos.subtract(fromNode.pos).normalize();

        for (let i = 0; i <= SAMPLES_PER_EDGE; i++) {
            const t = i / SAMPLES_PER_EDGE;
            const sample = this.getPositionOnEdge(edge, fromNode, toNode, t);

            const dist = Vector3.Distance(position, sample.position);

            if (dist < bestDistance) {
                bestDistance = dist;
                bestT = t;
                bestPosition = sample.position;
                bestForward = sample.forward;
            }
        }

        // Refine with binary search for more precision
        const refined = this.refineTValue(edge, fromNode, toNode, position, bestT);

        return {
            edge,
            t: refined.t,
            distance: refined.distance,
            position: refined.position,
            forward: refined.forward
        };
    }

    /**
     * Refine t value using binary search for better precision
     */
    private refineTValue(
        edge: GraphEdge,
        fromNode: GraphNode,
        toNode: GraphNode,
        targetPos: Vector3,
        initialT: number
    ): { t: number; distance: number; position: Vector3; forward: Vector3 } {
        let low = Math.max(0, initialT - 0.1);
        let high = Math.min(1, initialT + 0.1);
        let bestT = initialT;
        let bestResult = this.getPositionOnEdge(edge, fromNode, toNode, initialT);
        let bestDist = Vector3.Distance(targetPos, bestResult.position);

        // Binary search iterations
        for (let iter = 0; iter < 8; iter++) {
            const midLow = (low + bestT) / 2;
            const midHigh = (bestT + high) / 2;

            const resultLow = this.getPositionOnEdge(edge, fromNode, toNode, midLow);
            const resultHigh = this.getPositionOnEdge(edge, fromNode, toNode, midHigh);

            const distLow = Vector3.Distance(targetPos, resultLow.position);
            const distHigh = Vector3.Distance(targetPos, resultHigh.position);

            if (distLow < bestDist && distLow <= distHigh) {
                high = bestT;
                bestT = midLow;
                bestDist = distLow;
                bestResult = resultLow;
            } else if (distHigh < bestDist) {
                low = bestT;
                bestT = midHigh;
                bestDist = distHigh;
                bestResult = resultHigh;
            } else {
                low = midLow;
                high = midHigh;
            }
        }

        return {
            t: bestT,
            distance: bestDist,
            position: bestResult.position,
            forward: bestResult.forward
        };
    }

    // ========================================================================
    // POSITION CALCULATION
    // ========================================================================

    /**
     * Get world position and direction at a point on an edge
     * @param edge - The edge
     * @param fromNode - From node
     * @param toNode - To node
     * @param t - Parametric position (0-1)
     * @returns Position and forward direction
     */
    private getPositionOnEdge(
        edge: GraphEdge,
        fromNode: GraphNode,
        toNode: GraphNode,
        t: number
    ): { position: Vector3; forward: Vector3 } {
        if (edge.curve.type === 'straight') {
            return this.getStraightPosition(fromNode.pos, toNode.pos, t);
        } else {
            return this.getArcPosition(fromNode.pos, toNode.pos, edge.curve, t);
        }
    }

    /**
     * Get position on a straight edge
     */
    private getStraightPosition(
        start: Vector3,
        end: Vector3,
        t: number
    ): { position: Vector3; forward: Vector3 } {
        const position = Vector3.Lerp(start, end, t);
        const forward = end.subtract(start).normalize();
        return { position, forward };
    }

    /**
     * Get position on a curved edge
     */
    private getArcPosition(
        start: Vector3,
        end: Vector3,
        curve: CurveDefinition,
        t: number
    ): { position: Vector3; forward: Vector3 } {
        if (!curve.arcRadiusM || !curve.arcAngleDeg) {
            return this.getStraightPosition(start, end, t);
        }

        const radius = curve.arcRadiusM;
        const angleDeg = curve.arcAngleDeg;
        const direction = curve.arcDirection || 1;

        // Calculate arc center
        const startToEnd = end.subtract(start);
        const startDir = startToEnd.normalize();

        // Perpendicular direction for center offset
        const perpendicular = new Vector3(
            -startDir.z * direction,
            0,
            startDir.x * direction
        );

        // Arc center
        const center = start.add(perpendicular.scale(radius));

        // Calculate current angle
        const totalAngleRad = (angleDeg * Math.PI) / 180;
        const currentAngle = t * totalAngleRad * -direction;

        // Rotate start point around center
        const startVec = start.subtract(center);
        const cosA = Math.cos(currentAngle);
        const sinA = Math.sin(currentAngle);

        const rotatedX = startVec.x * cosA - startVec.z * sinA;
        const rotatedZ = startVec.x * sinA + startVec.z * cosA;

        const position = new Vector3(
            center.x + rotatedX,
            start.y,
            center.z + rotatedZ
        );

        // Calculate tangent direction
        const radiusVec = position.subtract(center).normalize();
        const forward = new Vector3(
            -radiusVec.z * direction,
            0,
            radiusVec.x * direction
        ).normalize();

        return { position, forward };
    }

    // ========================================================================
    // UTILITY METHODS
    // ========================================================================

    /**
     * Get world position for an edge and t value
     * @param edgeId - Edge ID
     * @param t - Parametric position (0-1)
     * @returns Position and forward, or null if edge not found
     */
    getPositionOnEdgeById(edgeId: string, t: number): { position: Vector3; forward: Vector3 } | null {
        const edge = this.graph.getEdge(edgeId);
        if (!edge) return null;

        const fromNode = this.graph.getNode(edge.fromNodeId);
        const toNode = this.graph.getNode(edge.toNodeId);
        if (!fromNode || !toNode) return null;

        return this.getPositionOnEdge(edge, fromNode, toNode, t);
    }

    /**
     * Find all edges within a radius of a position
     * @param position - World position
     * @param radius - Search radius
     * @returns Array of edge find results, sorted by distance
     */
    findEdgesInRadius(position: Vector3, radius: number): EdgeFindResult[] {
        const results: EdgeFindResult[] = [];
        const allEdges = this.graph.getAllEdges();

        for (const edge of allEdges) {
            const result = this.findClosestPointOnEdge(edge, position);
            if (result && result.distance <= radius) {
                results.push(result);
            }
        }

        // Sort by distance
        results.sort((a, b) => a.distance - b.distance);

        return results;
    }

    /**
     * Check if a position is on or near any track
     * @param position - World position
     * @param tolerance - Distance tolerance
     * @returns true if position is near track
     */
    isOnTrack(position: Vector3, tolerance: number = 0.02): boolean {
        const result = this.findNearestEdge(position, { maxDistance: tolerance });
        return result !== null;
    }

    /**
     * Get edge length
     * @param edgeId - Edge ID
     * @returns Length in meters, or 0 if not found
     */
    getEdgeLength(edgeId: string): number {
        const edge = this.graph.getEdge(edgeId);
        return edge?.lengthM || 0;
    }
}