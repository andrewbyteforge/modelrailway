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
 * FIX APPLIED (v1.1.0):
 * - Added proper null checks for graph nodes and their positions
 * - Added safety limits to prevent browser freeze
 * - Better error handling throughout
 * 
 * @module TrackEdgeFinder
 * @author Model Railway Workbench
 * @version 1.1.0
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

/** Maximum edges to search (safety limit) */
const MAX_EDGES_TO_SEARCH = 500;

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
     * 
     * SAFETY: Limited to MAX_EDGES_TO_SEARCH to prevent browser freeze
     * 
     * @param position - World position to search from
     * @param options - Search options
     * @returns Edge find result or null if none found
     */
    findNearestEdge(position: Vector3, options?: EdgeFindOptions): EdgeFindResult | null {
        // ====================================================================
        // GUARD: Validate position
        // ====================================================================
        if (!position || position.x === undefined || position.y === undefined || position.z === undefined) {
            console.warn(`${LOG_PREFIX} findNearestEdge: Invalid position`);
            return null;
        }

        // ====================================================================
        // GUARD: Check graph exists
        // ====================================================================
        if (!this.graph) {
            console.warn(`${LOG_PREFIX} findNearestEdge: No graph available`);
            return null;
        }

        const maxDist = options?.maxDistance ?? MAX_SEARCH_DISTANCE;
        const excludeEdges = new Set(options?.excludeEdges || []);
        const filterPieces = options?.filterByPieces ? new Set(options.filterByPieces) : null;

        let bestResult: EdgeFindResult | null = null;
        let bestDistance = maxDist;

        // ====================================================================
        // Get edges with safety limit
        // ====================================================================
        let allEdges: GraphEdge[];
        try {
            allEdges = this.graph.getAllEdges();
        } catch (error) {
            console.error(`${LOG_PREFIX} findNearestEdge: Error getting edges:`, error);
            return null;
        }

        if (!allEdges || allEdges.length === 0) {
            return null;
        }

        // SAFETY: Limit edges to search
        const edgesToSearch = allEdges.slice(0, MAX_EDGES_TO_SEARCH);

        // ====================================================================
        // Search edges
        // ====================================================================
        for (const edge of edgesToSearch) {
            try {
                // Skip excluded edges
                if (!edge || excludeEdges.has(edge.id)) continue;

                // Filter by piece if specified
                if (filterPieces && !filterPieces.has(edge.pieceId)) continue;

                // Find closest point on this edge
                const result = this.findClosestPointOnEdge(edge, position);

                if (result && result.distance < bestDistance) {
                    bestDistance = result.distance;
                    bestResult = result;
                }
            } catch (error) {
                // Skip this edge on error, don't crash
                continue;
            }
        }

        return bestResult;
    }

    /**
     * Find closest point on a specific edge to a position
     * 
     * @param edge - Edge to search
     * @param position - World position
     * @returns Result or null if edge is invalid
     */
    findClosestPointOnEdge(edge: GraphEdge, position: Vector3): EdgeFindResult | null {
        // ====================================================================
        // GUARD: Validate edge
        // ====================================================================
        if (!edge || !edge.fromNodeId || !edge.toNodeId) {
            return null;
        }

        // ====================================================================
        // Get and validate nodes
        // ====================================================================
        let fromNode: GraphNode | undefined;
        let toNode: GraphNode | undefined;

        try {
            fromNode = this.graph.getNode(edge.fromNodeId);
            toNode = this.graph.getNode(edge.toNodeId);
        } catch (error) {
            return null;
        }

        // CRITICAL: Validate nodes exist
        if (!fromNode || !toNode) {
            return null;
        }

        // CRITICAL: Validate node positions exist
        if (!fromNode.pos || !toNode.pos) {
            return null;
        }

        // CRITICAL: Validate position coordinates
        if (fromNode.pos.x === undefined || fromNode.pos.y === undefined || fromNode.pos.z === undefined) {
            return null;
        }

        if (toNode.pos.x === undefined || toNode.pos.y === undefined || toNode.pos.z === undefined) {
            return null;
        }

        // ====================================================================
        // Sample points along the edge and find closest
        // ====================================================================
        try {
            let bestT = 0;
            let bestDistance = Infinity;
            let bestPosition = fromNode.pos.clone();

            // Calculate forward direction with zero-length check
            let bestForward = toNode.pos.subtract(fromNode.pos);
            if (bestForward.length() < 0.0001) {
                // Zero-length edge
                return null;
            }
            bestForward = bestForward.normalize();

            for (let i = 0; i <= SAMPLES_PER_EDGE; i++) {
                const t = i / SAMPLES_PER_EDGE;
                const sample = this.getPositionOnEdge(edge, fromNode, toNode, t);

                if (!sample || !sample.position) {
                    continue;
                }

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

        } catch (error) {
            console.warn(`${LOG_PREFIX} findClosestPointOnEdge error:`, error);
            return null;
        }
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

        // Binary search iterations (limited for safety)
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
        // GUARD: Validate node positions
        if (!fromNode.pos || !toNode.pos) {
            return {
                position: new Vector3(0, 0, 0),
                forward: new Vector3(0, 0, 1)
            };
        }

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
        // GUARD: Validate inputs
        if (!start || !end) {
            return {
                position: new Vector3(0, 0, 0),
                forward: new Vector3(0, 0, 1)
            };
        }

        const position = Vector3.Lerp(start, end, t);
        let forward = end.subtract(start);

        // Handle zero-length
        if (forward.length() < 0.0001) {
            forward = new Vector3(0, 0, 1);
        } else {
            forward = forward.normalize();
        }

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
        // Fallback to straight if curve data incomplete
        if (!curve.arcRadiusM || !curve.arcAngleDeg) {
            return this.getStraightPosition(start, end, t);
        }

        // GUARD: Validate inputs
        if (!start || !end) {
            return {
                position: new Vector3(0, 0, 0),
                forward: new Vector3(0, 0, 1)
            };
        }

        try {
            const radius = curve.arcRadiusM;
            const angleDeg = curve.arcAngleDeg;
            const direction = curve.arcDirection || 1;

            // Calculate arc center
            const startToEnd = end.subtract(start);

            // Handle zero-length
            if (startToEnd.length() < 0.0001) {
                return {
                    position: start.clone(),
                    forward: new Vector3(0, 0, 1)
                };
            }

            const startDir = startToEnd.normalize();

            // Perpendicular direction (left or right based on curve direction)
            const perpendicular = new Vector3(
                -startDir.z * direction,
                0,
                startDir.x * direction
            );

            const center = start.add(perpendicular.scale(radius));

            // Calculate position on arc
            const startAngle = Math.atan2(
                start.x - center.x,
                start.z - center.z
            );

            const angleRad = (angleDeg * Math.PI / 180) * direction;
            const currentAngle = startAngle + angleRad * t;

            const position = new Vector3(
                center.x + radius * Math.sin(currentAngle),
                start.y + (end.y - start.y) * t, // Linear height interpolation
                center.z + radius * Math.cos(currentAngle)
            );

            // Calculate tangent (forward direction)
            const tangentAngle = currentAngle + (Math.PI / 2) * direction;
            const forward = new Vector3(
                Math.sin(tangentAngle),
                0,
                Math.cos(tangentAngle)
            ).normalize();

            return { position, forward };

        } catch (error) {
            // Fallback on any error
            return this.getStraightPosition(start, end, t);
        }
    }

    // ========================================================================
    // PUBLIC UTILITY METHODS
    // ========================================================================

    /**
     * Get position on edge by edge ID
     * @param edgeId - Edge ID
     * @param t - Parametric position (0-1)
     * @returns Position and forward, or null if edge not found
     */
    getPositionOnEdgeById(edgeId: string, t: number): { position: Vector3; forward: Vector3 } | null {
        try {
            const edge = this.graph.getEdge(edgeId);
            if (!edge) return null;

            const fromNode = this.graph.getNode(edge.fromNodeId);
            const toNode = this.graph.getNode(edge.toNodeId);
            if (!fromNode || !toNode) return null;
            if (!fromNode.pos || !toNode.pos) return null;

            return this.getPositionOnEdge(edge, fromNode, toNode, t);
        } catch (error) {
            return null;
        }
    }

    /**
     * Find all edges within a radius of a position
     * 
     * SAFETY: Limited to MAX_EDGES_TO_SEARCH
     * 
     * @param position - World position
     * @param radius - Search radius
     * @returns Array of edge find results, sorted by distance
     */
    findEdgesInRadius(position: Vector3, radius: number): EdgeFindResult[] {
        const results: EdgeFindResult[] = [];

        // GUARD: Validate position
        if (!position) return results;

        try {
            const allEdges = this.graph.getAllEdges();
            const edgesToSearch = allEdges.slice(0, MAX_EDGES_TO_SEARCH);

            for (const edge of edgesToSearch) {
                try {
                    const result = this.findClosestPointOnEdge(edge, position);
                    if (result && result.distance <= radius) {
                        results.push(result);
                    }
                } catch (error) {
                    continue;
                }
            }

            // Sort by distance
            results.sort((a, b) => a.distance - b.distance);

        } catch (error) {
            console.error(`${LOG_PREFIX} findEdgesInRadius error:`, error);
        }

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
        try {
            const edge = this.graph.getEdge(edgeId);
            return edge?.lengthM || 0;
        } catch (error) {
            return 0;
        }
    }
}