/**
 * TrackGraph.ts - Graph data structure for track layout
 * 
 * Manages:
 * - Nodes (connection points in 3D space)
 * - Edges (directed track segments between nodes)
 * - Graph queries and validation
 * - Serialization for save/load
 * 
 * The graph represents the logical connectivity of track pieces,
 * separate from their visual representation.
 * 
 * @module TrackGraph
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * A node in the track graph representing a connection point
 */
export interface GraphNode {
    /** Unique node identifier */
    id: string;
    /** World position of this node */
    pos: Vector3;
}

/**
 * Definition of curve geometry for an edge
 */
export interface CurveDefinition {
    /** Type of curve */
    type: 'straight' | 'arc';
    /** Arc radius in meters (for arc type) */
    arcRadiusM?: number;
    /** Arc angle in degrees (for arc type) */
    arcAngleDeg?: number;
    /** Arc direction: 1 = left/CCW, -1 = right/CW (for arc type) */
    arcDirection?: 1 | -1;
}

/**
 * An edge in the track graph representing a track segment
 */
export interface GraphEdge {
    /** Unique edge identifier */
    id: string;
    /** Starting node ID */
    fromNodeId: string;
    /** Ending node ID */
    toNodeId: string;
    /** Length of track in meters */
    lengthM: number;
    /** Curve geometry definition */
    curve: CurveDefinition;
    /** ID of track piece that generated this edge */
    pieceId: string;
}

/**
 * Statistics about the graph
 */
export interface GraphStats {
    nodeCount: number;
    edgeCount: number;
    totalLengthM: number;
}

// ============================================================================
// TRACK GRAPH CLASS
// ============================================================================

/**
 * TrackGraph - Manages the network of track connections
 * 
 * Provides a graph data structure for representing track layout:
 * - Nodes are placed at connector positions
 * - Edges connect nodes along track pieces
 * - Supports both straight and curved track segments
 * 
 * @example
 * ```typescript
 * const graph = new TrackGraph();
 * const node1 = graph.addNode(new Vector3(0, 0, 0));
 * const node2 = graph.addNode(new Vector3(0.168, 0, 0));
 * const edge = graph.addEdge(node1.id, node2.id, 0.168, { type: 'straight' }, 'piece1');
 * ```
 */
export class TrackGraph {
    /** Map of node ID to GraphNode */
    private nodes: Map<string, GraphNode> = new Map();

    /** Map of edge ID to GraphEdge */
    private edges: Map<string, GraphEdge> = new Map();

    /** Counter for generating unique node IDs */
    private nextNodeId = 0;

    /** Counter for generating unique edge IDs */
    private nextEdgeId = 0;

    // ========================================================================
    // NODE OPERATIONS
    // ========================================================================

    /**
     * Add a node to the graph
     * @param pos - World position for the node
     * @param id - Optional specific ID (auto-generated if not provided)
     * @returns The created node
     */
    addNode(pos: Vector3, id?: string): GraphNode {
        const nodeId = id || `node_${this.nextNodeId++}`;
        const node: GraphNode = {
            id: nodeId,
            pos: pos.clone()
        };
        this.nodes.set(nodeId, node);
        return node;
    }

    /**
     * Remove a node from the graph
     * Also removes all edges connected to this node
     * @param nodeId - ID of node to remove
     */
    removeNode(nodeId: string): void {
        // Remove all edges connected to this node first
        const connectedEdges = this.getEdgesConnectedToNode(nodeId);
        connectedEdges.forEach(edge => this.removeEdge(edge.id));

        this.nodes.delete(nodeId);
    }

    /**
     * Get a node by ID
     * @param nodeId - ID to look up
     * @returns GraphNode or undefined
     */
    getNode(nodeId: string): GraphNode | undefined {
        return this.nodes.get(nodeId);
    }

    /**
     * Find a node at or near a position
     * @param pos - Position to search near
     * @param toleranceM - Distance tolerance in meters (default: 1mm)
     * @returns GraphNode if found, undefined otherwise
     */
    findNodeAt(pos: Vector3, toleranceM: number = 0.001): GraphNode | undefined {
        for (const node of this.nodes.values()) {
            if (Vector3.Distance(node.pos, pos) < toleranceM) {
                return node;
            }
        }
        return undefined;
    }

    /**
     * Get all nodes in the graph
     * @returns Array of all nodes
     */
    getAllNodes(): GraphNode[] {
        return Array.from(this.nodes.values());
    }

    // ========================================================================
    // EDGE OPERATIONS
    // ========================================================================

    /**
     * Add an edge to the graph
     * @param fromNodeId - Starting node ID
     * @param toNodeId - Ending node ID
     * @param lengthM - Track length in meters
     * @param curve - Curve definition
     * @param pieceId - ID of piece that created this edge
     * @param id - Optional specific ID
     * @returns The created edge
     */
    addEdge(
        fromNodeId: string,
        toNodeId: string,
        lengthM: number,
        curve: CurveDefinition,
        pieceId: string,
        id?: string
    ): GraphEdge {
        const edgeId = id || `edge_${this.nextEdgeId++}`;
        const edge: GraphEdge = {
            id: edgeId,
            fromNodeId,
            toNodeId,
            lengthM,
            curve,
            pieceId
        };
        this.edges.set(edgeId, edge);
        return edge;
    }

    /**
     * Remove an edge from the graph
     * @param edgeId - ID of edge to remove
     */
    removeEdge(edgeId: string): void {
        this.edges.delete(edgeId);
    }

    /**
     * Get an edge by ID
     * @param edgeId - ID to look up
     * @returns GraphEdge or undefined
     */
    getEdge(edgeId: string): GraphEdge | undefined {
        return this.edges.get(edgeId);
    }

    /**
     * Get all edges in the graph
     * @returns Array of all edges
     */
    getAllEdges(): GraphEdge[] {
        return Array.from(this.edges.values());
    }

    /**
     * Get all edges connected to a node (either direction)
     * @param nodeId - Node ID to check
     * @returns Array of connected edges
     */
    getEdgesConnectedToNode(nodeId: string): GraphEdge[] {
        return this.getAllEdges().filter(
            edge => edge.fromNodeId === nodeId || edge.toNodeId === nodeId
        );
    }

    /**
     * Get edges generated by a specific piece
     * @param pieceId - Piece ID to filter by
     * @returns Array of edges from this piece
     */
    getEdgesByPiece(pieceId: string): GraphEdge[] {
        return this.getAllEdges().filter(edge => edge.pieceId === pieceId);
    }

    /**
     * Get outgoing edges from a node
     * @param nodeId - Node ID
     * @returns Array of edges leaving this node
     */
    getOutgoingEdges(nodeId: string): GraphEdge[] {
        return this.getAllEdges().filter(edge => edge.fromNodeId === nodeId);
    }

    /**
     * Get incoming edges to a node
     * @param nodeId - Node ID
     * @returns Array of edges entering this node
     */
    getIncomingEdges(nodeId: string): GraphEdge[] {
        return this.getAllEdges().filter(edge => edge.toNodeId === nodeId);
    }

    /**
     * Check if two nodes are directly connected
     * @param fromNodeId - First node ID
     * @param toNodeId - Second node ID
     * @returns True if an edge exists between them (either direction)
     */
    areNodesConnected(fromNodeId: string, toNodeId: string): boolean {
        return this.getAllEdges().some(edge =>
            (edge.fromNodeId === fromNodeId && edge.toNodeId === toNodeId) ||
            (edge.fromNodeId === toNodeId && edge.toNodeId === fromNodeId)
        );
    }

    // ========================================================================
    // GRAPH QUERIES
    // ========================================================================

    /**
     * Get statistics about the graph
     * @returns Graph statistics
     */
    getStats(): GraphStats {
        const totalLength = this.getAllEdges().reduce(
            (sum, edge) => sum + edge.lengthM,
            0
        );
        return {
            nodeCount: this.nodes.size,
            edgeCount: this.edges.size,
            totalLengthM: totalLength
        };
    }

    /**
     * Find the shortest path between two nodes (simple BFS)
     * @param startNodeId - Starting node ID
     * @param endNodeId - Ending node ID
     * @returns Array of edge IDs forming path, or empty array if no path
     */
    findPath(startNodeId: string, endNodeId: string): string[] {
        if (startNodeId === endNodeId) return [];

        const visited = new Set<string>();
        const queue: { nodeId: string; path: string[] }[] = [
            { nodeId: startNodeId, path: [] }
        ];

        while (queue.length > 0) {
            const current = queue.shift()!;

            if (visited.has(current.nodeId)) continue;
            visited.add(current.nodeId);

            const edges = this.getEdgesConnectedToNode(current.nodeId);

            for (const edge of edges) {
                const nextNodeId = edge.fromNodeId === current.nodeId
                    ? edge.toNodeId
                    : edge.fromNodeId;

                const newPath = [...current.path, edge.id];

                if (nextNodeId === endNodeId) {
                    return newPath;
                }

                if (!visited.has(nextNodeId)) {
                    queue.push({ nodeId: nextNodeId, path: newPath });
                }
            }
        }

        return []; // No path found
    }

    // ========================================================================
    // GRAPH MANAGEMENT
    // ========================================================================

    /**
     * Clear the entire graph
     */
    clear(): void {
        this.nodes.clear();
        this.edges.clear();
        this.nextNodeId = 0;
        this.nextEdgeId = 0;
    }

    // ========================================================================
    // SERIALIZATION
    // ========================================================================

    /**
     * Export graph to JSON format for saving
     * @returns JSON-serializable object
     */
    toJSON(): object {
        return {
            nodes: this.getAllNodes().map(node => ({
                id: node.id,
                pos: {
                    x: node.pos.x,
                    y: node.pos.y,
                    z: node.pos.z
                }
            })),
            edges: this.getAllEdges().map(edge => ({
                id: edge.id,
                fromNodeId: edge.fromNodeId,
                toNodeId: edge.toNodeId,
                lengthM: edge.lengthM,
                curve: edge.curve,
                pieceId: edge.pieceId
            }))
        };
    }

    /**
     * Import graph from JSON format
     * @param data - Previously saved graph data
     */
    fromJSON(data: any): void {
        this.clear();

        // Import nodes
        if (data.nodes && Array.isArray(data.nodes)) {
            data.nodes.forEach((nodeData: any) => {
                const pos = new Vector3(
                    nodeData.pos.x,
                    nodeData.pos.y,
                    nodeData.pos.z
                );
                this.addNode(pos, nodeData.id);
            });
        }

        // Import edges
        if (data.edges && Array.isArray(data.edges)) {
            data.edges.forEach((edgeData: any) => {
                this.addEdge(
                    edgeData.fromNodeId,
                    edgeData.toNodeId,
                    edgeData.lengthM,
                    edgeData.curve,
                    edgeData.pieceId,
                    edgeData.id
                );
            });
        }

        // Update ID counters to avoid conflicts
        let maxNodeId = 0;
        let maxEdgeId = 0;

        this.nodes.forEach((_, id) => {
            const match = id.match(/node_(\d+)/);
            if (match) {
                maxNodeId = Math.max(maxNodeId, parseInt(match[1]) + 1);
            }
        });

        this.edges.forEach((_, id) => {
            const match = id.match(/edge_(\d+)/);
            if (match) {
                maxEdgeId = Math.max(maxEdgeId, parseInt(match[1]) + 1);
            }
        });

        this.nextNodeId = maxNodeId;
        this.nextEdgeId = maxEdgeId;
    }

    // ========================================================================
    // DEBUG
    // ========================================================================

    /**
     * Get debug string representation
     * @returns Debug string
     */
    toString(): string {
        const stats = this.getStats();
        return `TrackGraph[${stats.nodeCount} nodes, ${stats.edgeCount} edges, ${stats.totalLengthM.toFixed(3)}m total]`;
    }
}