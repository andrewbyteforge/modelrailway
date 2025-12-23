/**
 * TrackSystem.ts - Main track subsystem coordinator (with movePiece support)
 * 
 * Manages:
 * - Track catalog
 * - Track graph
 * - Placed track pieces
 * - Switch states
 * - Track rendering
 * - Moving pieces
 */

import { Scene } from '@babylonjs/core/scene';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math';
import { TrackCatalog, type TrackCatalogEntry } from './TrackCatalog';
import { TrackGraph } from './TrackGraph';
import { TrackPiece } from './TrackPiece';
import { SnapHelper, type SnapResult } from './SnapHelper';
import { TrackRenderer } from './TrackRenderer';
import type { Project } from '../../core/Project';

/**
 * TrackSystem - manages all track-related data and operations
 */
export class TrackSystem {
    private scene: Scene;
    private project: Project;
    private graph: TrackGraph;
    private pieces: Map<string, TrackPiece> = new Map();
    private renderer: TrackRenderer;
    private nextPieceId = 0;

    constructor(scene: Scene, project: Project) {
        if (!scene) {
            throw new Error('[TrackSystem] Scene is required');
        }
        if (!project) {
            throw new Error('[TrackSystem] Project is required');
        }

        this.scene = scene;
        this.project = project;
        this.graph = new TrackGraph();
        this.renderer = new TrackRenderer(scene);

        console.log('[TrackSystem] Created');
    }

    /**
     * Initialize the track system
     */
    initialize(): void {
        try {
            // Initialize track catalog
            TrackCatalog.initialize();

            console.log('✓ Track system initialized');
        } catch (error) {
            console.error('[TrackSystem] Failed to initialize:', error);
            throw error;
        }
    }

    /**
     * Place a new track piece at a position
     * Returns the piece if successful, null if validation fails
     */
    placePiece(
        catalogId: string,
        position: Vector3,
        rotation: Quaternion = Quaternion.Identity()
    ): TrackPiece | null {
        try {
            if (!catalogId) {
                console.error('[TrackSystem] placePiece: catalogId is required');
                return null;
            }

            if (!position) {
                console.error('[TrackSystem] placePiece: position is required');
                return null;
            }

            // Get catalog entry
            const catalogEntry = TrackCatalog.get(catalogId);
            if (!catalogEntry) {
                console.error(`[TrackSystem] placePiece: Unknown catalog ID: ${catalogId}`);
                return null;
            }

            // Check bounds
            if (!this.isPositionInBounds(position)) {
                console.warn(`[TrackSystem] placePiece: Position (${position.x.toFixed(2)}, ${position.z.toFixed(2)}) is outside board bounds`);
                return null;
            }

            // Create piece
            const pieceId = `p${this.nextPieceId++}`;
            const piece = new TrackPiece(pieceId, catalogEntry, position, rotation);

            if (!piece) {
                console.error('[TrackSystem] placePiece: Failed to create TrackPiece');
                return null;
            }

            // Add to collection
            this.pieces.set(pieceId, piece);

            // Create graph nodes and edges for this piece
            this.connectPieceToGraph(piece);

            // Render the piece visually
            const edges = this.graph.getEdgesByPiece(pieceId);
            this.renderer.renderPiece(piece, edges);

            console.log(`✓ Placed ${catalogEntry.name} (${pieceId}) at (${position.x.toFixed(2)}, ${position.z.toFixed(2)})`);

            return piece;
        } catch (error) {
            console.error('[TrackSystem] Error in placePiece:', error);
            return null;
        }
    }

    /**
     * Move a track piece to a new position
     */
    movePiece(pieceId: string, newPosition: Vector3): boolean {
        try {
            if (!pieceId) {
                console.error('[TrackSystem] movePiece: pieceId is required');
                return false;
            }

            if (!newPosition) {
                console.error('[TrackSystem] movePiece: newPosition is required');
                return false;
            }

            const piece = this.pieces.get(pieceId);
            if (!piece) {
                console.warn(`[TrackSystem] movePiece: Piece ${pieceId} not found`);
                return false;
            }

            // Check bounds
            if (!this.isPositionInBounds(newPosition)) {
                console.warn(`[TrackSystem] movePiece: Position (${newPosition.x.toFixed(2)}, ${newPosition.z.toFixed(2)}) is outside board bounds`);
                return false;
            }

            // Update piece position
            piece.setPosition(newPosition);

            // Update graph nodes
            this.updateGraphNodes(piece);

            // Re-render the piece
            const edges = this.graph.getEdgesByPiece(pieceId);
            this.renderer.removePiece(pieceId);
            this.renderer.renderPiece(piece, edges);

            return true;
        } catch (error) {
            console.error('[TrackSystem] Error in movePiece:', error);
            return false;
        }
    }

    /**
     * Update graph nodes for a moved piece
     */
    private updateGraphNodes(piece: TrackPiece): void {
        try {
            piece.connectors.forEach(connector => {
                if (connector.nodeId && connector.worldPos) {
                    const node = this.graph.getNode(connector.nodeId);
                    if (node) {
                        node.pos = connector.worldPos.clone();
                    }
                }
            });
        } catch (error) {
            console.error('[TrackSystem] Error updating graph nodes:', error);
        }
    }

    /**
     * Remove a track piece
     */
    removePiece(pieceId: string): boolean {
        try {
            if (!pieceId) {
                console.error('[TrackSystem] removePiece: pieceId is required');
                return false;
            }

            const piece = this.pieces.get(pieceId);
            if (!piece) {
                console.warn(`[TrackSystem] removePiece: Piece ${pieceId} not found`);
                return false;
            }

            // Remove visual representation
            this.renderer.removePiece(pieceId);

            // Remove associated graph elements
            if (piece.generatedEdgeIds && Array.isArray(piece.generatedEdgeIds)) {
                piece.generatedEdgeIds.forEach(edgeId => {
                    try {
                        this.graph.removeEdge(edgeId);
                    } catch (error) {
                        console.error(`[TrackSystem] Error removing edge ${edgeId}:`, error);
                    }
                });
            }

            if (piece.connectors && Array.isArray(piece.connectors)) {
                piece.connectors.forEach(connector => {
                    if (connector && connector.nodeId) {
                        try {
                            this.graph.removeNode(connector.nodeId);
                        } catch (error) {
                            console.error(`[TrackSystem] Error removing node ${connector.nodeId}:`, error);
                        }
                    }
                });
            }

            // Remove from collection
            this.pieces.delete(pieceId);

            console.log(`✓ Removed piece ${pieceId}`);
            return true;
        } catch (error) {
            console.error('[TrackSystem] Error in removePiece:', error);
            return false;
        }
    }

    /**
     * Connect a piece to the track graph
     * Creates nodes at connector positions and edges between them
     */
    private connectPieceToGraph(piece: TrackPiece): void {
        try {
            if (!piece) {
                console.error('[TrackSystem] connectPieceToGraph: piece is null');
                return;
            }

            if (!piece.connectors || !Array.isArray(piece.connectors)) {
                console.error(`[TrackSystem] Piece ${piece.id} has no connectors array`);
                return;
            }

            // Create nodes for each connector
            piece.connectors.forEach(connector => {
                if (!connector) {
                    console.warn(`[TrackSystem] Null connector on piece ${piece.id}`);
                    return;
                }

                if (!connector.worldPos) {
                    console.warn(`[TrackSystem] Connector ${connector.id} on piece ${piece.id} has no worldPos`);
                    return;
                }

                try {
                    // Check if a node already exists at this position
                    let node = this.graph.findNodeAt(connector.worldPos, 0.001);

                    if (!node) {
                        // Create new node
                        node = this.graph.addNode(connector.worldPos);
                    }

                    connector.nodeId = node.id;
                } catch (error) {
                    console.error(`[TrackSystem] Error creating node for connector ${connector.id}:`, error);
                }
            });

            // Create edges based on piece type
            if (piece.catalogEntry.type === 'straight' || piece.catalogEntry.type === 'curve') {
                // Simple piece: one edge connecting two connectors
                if (piece.connectors.length < 2) {
                    console.error(`[TrackSystem] Piece ${piece.id} doesn't have 2 connectors`);
                    return;
                }

                const connectorA = piece.connectors[0];
                const connectorB = piece.connectors[1];

                if (connectorA.nodeId && connectorB.nodeId) {
                    try {
                        const edge = this.graph.addEdge(
                            connectorA.nodeId,
                            connectorB.nodeId,
                            piece.catalogEntry.lengthM,
                            piece.catalogEntry.type === 'straight'
                                ? { type: 'straight' }
                                : {
                                    type: 'arc',
                                    arcRadiusM: piece.catalogEntry.curveRadiusM!,
                                    arcAngleDeg: piece.catalogEntry.curveAngleDeg!
                                },
                            piece.id
                        );
                        piece.generatedEdgeIds.push(edge.id);
                        console.log(`[TrackSystem] Created edge ${edge.id} for piece ${piece.id}`);
                    } catch (error) {
                        console.error(`[TrackSystem] Error creating edge for piece ${piece.id}:`, error);
                    }
                }
            } else if (piece.catalogEntry.type === 'switch') {
                // Switch: create two edges from COMMON to STRAIGHT and DIVERGING
                const common = piece.getConnector('COMMON');
                const straight = piece.getConnector('STRAIGHT');
                const diverging = piece.getConnector('DIVERGING');

                if (!common || !straight || !diverging) {
                    console.error(`[TrackSystem] Switch ${piece.id} missing required connectors`);
                    return;
                }

                if (common.nodeId && straight.nodeId) {
                    try {
                        const edgeStraight = this.graph.addEdge(
                            common.nodeId,
                            straight.nodeId,
                            piece.catalogEntry.lengthM,
                            { type: 'straight' },
                            piece.id
                        );
                        piece.generatedEdgeIds.push(edgeStraight.id);
                        console.log(`[TrackSystem] Created straight edge ${edgeStraight.id} for switch ${piece.id}`);
                    } catch (error) {
                        console.error(`[TrackSystem] Error creating straight edge for switch ${piece.id}:`, error);
                    }
                }

                if (common.nodeId && diverging.nodeId) {
                    try {
                        const edgeDiverging = this.graph.addEdge(
                            common.nodeId,
                            diverging.nodeId,
                            piece.catalogEntry.lengthM,
                            {
                                type: 'arc',
                                arcRadiusM: piece.catalogEntry.curveRadiusM!,
                                arcAngleDeg: piece.catalogEntry.curveAngleDeg!
                            },
                            piece.id
                        );
                        piece.generatedEdgeIds.push(edgeDiverging.id);
                        console.log(`[TrackSystem] Created diverging edge ${edgeDiverging.id} for switch ${piece.id}`);
                    } catch (error) {
                        console.error(`[TrackSystem] Error creating diverging edge for switch ${piece.id}:`, error);
                    }
                }
            }
        } catch (error) {
            console.error('[TrackSystem] Error in connectPieceToGraph:', error);
        }
    }

    /**
     * Find nearby connectors for snapping
     */
    findSnapCandidates(position: Vector3, excludePiece?: TrackPiece) {
        try {
            return SnapHelper.findNearbyConnectors(
                position,
                Array.from(this.pieces.values()),
                excludePiece
            );
        } catch (error) {
            console.error('[TrackSystem] Error in findSnapCandidates:', error);
            return [];
        }
    }

    /**
     * Validate if a position is within board bounds
     */
    isPositionInBounds(position: Vector3): boolean {
        try {
            const dims = this.project.getBoardDimensions();
            return SnapHelper.isPositionInBounds(position, dims.width, dims.depth);
        } catch (error) {
            console.error('[TrackSystem] Error in isPositionInBounds:', error);
            return false;
        }
    }

    /**
     * Get all placed pieces
     */
    getAllPieces(): TrackPiece[] {
        return Array.from(this.pieces.values());
    }

    /**
     * Get piece by ID
     */
    getPiece(pieceId: string): TrackPiece | undefined {
        return this.pieces.get(pieceId);
    }

    /**
     * Toggle switch state
     */
    toggleSwitch(pieceId: string): boolean {
        try {
            if (!pieceId) {
                console.error('[TrackSystem] toggleSwitch: pieceId is required');
                return false;
            }

            const piece = this.pieces.get(pieceId);
            if (!piece) {
                console.warn(`[TrackSystem] toggleSwitch: Piece ${pieceId} not found`);
                return false;
            }

            if (!piece.isSwitch) {
                console.warn(`[TrackSystem] toggleSwitch: Piece ${pieceId} is not a switch`);
                return false;
            }

            piece.toggleSwitch();
            console.log(`✓ Switch ${pieceId} → ${piece.switchState}`);
            return true;
        } catch (error) {
            console.error('[TrackSystem] Error in toggleSwitch:', error);
            return false;
        }
    }

    /**
     * Get track graph
     */
    getGraph(): TrackGraph {
        return this.graph;
    }

    /**
     * Get statistics
     */
    getStats() {
        try {
            const graphStats = this.graph.getStats();
            return {
                pieceCount: this.pieces.size,
                meshCount: this.renderer.getMeshCount(),
                ...graphStats
            };
        } catch (error) {
            console.error('[TrackSystem] Error in getStats:', error);
            return {
                pieceCount: 0,
                meshCount: 0,
                nodeCount: 0,
                edgeCount: 0,
                totalLengthM: 0
            };
        }
    }

    /**
     * Clear all track
     */
    clear(): void {
        try {
            this.renderer.clear();
            this.pieces.clear();
            this.graph.clear();
            this.nextPieceId = 0;
            console.log('✓ Track cleared');
        } catch (error) {
            console.error('[TrackSystem] Error in clear:', error);
        }
    }

    /**
     * Export track data to JSON (for saving)
     */
    toJSON() {
        try {
            return {
                pieces: Array.from(this.pieces.values()).map(piece => piece.toJSON()),
                graph: this.graph.toJSON()
            };
        } catch (error) {
            console.error('[TrackSystem] Error in toJSON:', error);
            return { pieces: [], graph: { nodes: [], edges: [] } };
        }
    }

    /**
     * Import track data from JSON (for loading)
     */
    fromJSON(data: any): void {
        try {
            if (!data) {
                console.error('[TrackSystem] fromJSON: data is null');
                return;
            }

            this.clear();

            // Import graph
            if (data.graph) {
                this.graph.fromJSON(data.graph);
            } else {
                console.warn('[TrackSystem] fromJSON: No graph data');
            }

            // Import pieces
            if (data.pieces && Array.isArray(data.pieces)) {
                data.pieces.forEach((pieceData: any) => {
                    try {
                        if (!pieceData || !pieceData.catalogId) {
                            console.warn('[TrackSystem] fromJSON: Invalid piece data');
                            return;
                        }

                        const catalogEntry = TrackCatalog.get(pieceData.catalogId);
                        if (!catalogEntry) {
                            console.warn(`[TrackSystem] fromJSON: Unknown catalog ID: ${pieceData.catalogId}`);
                            return;
                        }

                        const position = new Vector3(
                            pieceData.transform?.pos?.x || 0,
                            pieceData.transform?.pos?.y || 0,
                            pieceData.transform?.pos?.z || 0
                        );

                        const rotation = new Quaternion(
                            pieceData.transform?.rot?.x || 0,
                            pieceData.transform?.rot?.y || 0,
                            pieceData.transform?.rot?.z || 0,
                            pieceData.transform?.rot?.w || 1
                        );

                        const piece = new TrackPiece(pieceData.id, catalogEntry, position, rotation);
                        piece.generatedEdgeIds = pieceData.generatedEdgeIds || [];
                        piece.switchState = pieceData.switchState;

                        // Restore connector node associations
                        if (pieceData.connectors && Array.isArray(pieceData.connectors)) {
                            pieceData.connectors.forEach((connectorData: any, index: number) => {
                                if (piece.connectors[index] && connectorData) {
                                    piece.connectors[index].nodeId = connectorData.nodeId;
                                }
                            });
                        }

                        this.pieces.set(piece.id, piece);

                        // Render the piece
                        const edges = this.graph.getEdgesByPiece(piece.id);
                        this.renderer.renderPiece(piece, edges);
                    } catch (error) {
                        console.error('[TrackSystem] Error loading piece:', error);
                    }
                });

                console.log(`✓ Loaded ${this.pieces.size} track pieces`);
            } else {
                console.warn('[TrackSystem] fromJSON: No pieces data');
            }
        } catch (error) {
            console.error('[TrackSystem] Error in fromJSON:', error);
        }
    }
}