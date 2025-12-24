/**
 * TrackSystem.ts - Main track subsystem coordinator
 * 
 * Path: frontend/src/systems/track/TrackSystem.ts
 * 
 * Manages:
 * - Track catalog initialization
 * - Track graph (nodes and edges)
 * - Placed track pieces
 * - Switch states
 * - Track rendering coordination
 * - Piece movement and manipulation
 * - Auto-snap connections
 * - Connection visual feedback
 * 
 * @module TrackSystem
 */

import { Scene } from '@babylonjs/core/scene';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { TrackCatalog, type TrackCatalogEntry } from './TrackCatalog';
import { TrackGraph, type GraphEdge, type CurveDefinition } from './TrackGraph';
import { TrackPiece, type Connector } from './TrackPiece';
import { SnapHelper } from './SnapHelper';
import { TrackRenderer } from './TrackRenderer';
import { ConnectionIndicator } from './ConnectionIndicator';
import type { Project } from '../../core/Project';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Statistics about the current track layout
 */
export interface TrackStats {
    pieceCount: number;
    meshCount: number;
    nodeCount: number;
    edgeCount: number;
    totalLengthM: number;
}

/**
 * Result of a snap operation
 */
export interface PlacementResult {
    /** The placed piece (null if placement failed) */
    piece: TrackPiece | null;
    /** Whether the piece was snapped to an existing connector */
    snapped: boolean;
    /** IDs of connectors that were connected */
    connectedConnectorIds: string[];
}

// ============================================================================
// TRACK SYSTEM CLASS
// ============================================================================

/**
 * TrackSystem - Central coordinator for all track operations
 * 
 * Provides a high-level API for:
 * - Placing new track pieces
 * - Moving existing pieces
 * - Removing pieces
 * - Managing switch states
 * - Querying track layout
 * 
 * @example
 * ```typescript
 * const trackSystem = new TrackSystem(scene, project);
 * trackSystem.initialize();
 * const piece = trackSystem.placePiece('track.straight_168mm', position, rotation);
 * ```
 */
export class TrackSystem {
    /** Babylon.js scene reference */
    private scene: Scene;

    /** Project configuration */
    private project: Project;

    /** Track graph data structure */
    private graph: TrackGraph;

    /** Map of piece ID to TrackPiece */
    private pieces: Map<string, TrackPiece> = new Map();

    /** Track renderer for visual representation */
    private renderer: TrackRenderer;

    /** Connection indicator for visual feedback */
    private connectionIndicator: ConnectionIndicator;

    /** Counter for generating unique piece IDs */
    private nextPieceId = 0;

    /** Auto-snap enabled flag */
    private autoSnapEnabled: boolean = true;

    /** Connection indicators enabled flag */
    private connectionIndicatorsEnabled: boolean = true;

    // ========================================================================
    // CONSTRUCTOR & INITIALIZATION
    // ========================================================================

    /**
     * Create a new TrackSystem
     * @param scene - Babylon.js scene
     * @param project - Project configuration
     * @throws Error if scene or project is not provided
     */
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
        this.connectionIndicator = new ConnectionIndicator(scene);

        console.log('[TrackSystem] Created');
    }

    /**
     * Initialize the track system
     * Must be called before using other methods
     */
    initialize(): void {
        try {
            // Initialize track catalog with Hornby specifications
            TrackCatalog.initialize();

            // Initialize connection indicator system
            this.connectionIndicator.initialize();

            const specs = TrackCatalog.getHornbySpecs();
            console.log('✓ Track system initialized');
            console.log(`  Hornby OO Gauge: R1=${specs.R1_MM}mm, R2=${specs.R2_MM}mm`);
            console.log(`  Track gauge: ${specs.GAUGE_MM}mm`);
            console.log(`  Auto-snap: ${this.autoSnapEnabled ? 'enabled' : 'disabled'}`);
            console.log(`  Connection indicators: ${this.connectionIndicatorsEnabled ? 'enabled' : 'disabled'}`);

        } catch (error) {
            console.error('[TrackSystem] Failed to initialize:', error);
            throw error;
        }
    }

    // ========================================================================
    // TOGGLE SETTINGS
    // ========================================================================

    /**
     * Enable or disable auto-snap functionality
     * @param enabled - Whether auto-snap should be active
     */
    setAutoSnap(enabled: boolean): void {
        this.autoSnapEnabled = enabled;
        console.log(`[TrackSystem] Auto-snap ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Check if auto-snap is enabled
     */
    isAutoSnapEnabled(): boolean {
        return this.autoSnapEnabled;
    }

    /**
     * Enable or disable connection indicators (the colored balls at connectors)
     * @param enabled - Whether indicators should be visible
     */
    setConnectionIndicators(enabled: boolean): void {
        this.connectionIndicatorsEnabled = enabled;
        this.connectionIndicator.setEnabled(enabled);
        console.log(`[TrackSystem] Connection indicators ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Toggle connection indicators on/off
     * @returns The new enabled state
     */
    toggleConnectionIndicators(): boolean {
        this.connectionIndicatorsEnabled = !this.connectionIndicatorsEnabled;
        this.connectionIndicator.setEnabled(this.connectionIndicatorsEnabled);
        console.log(`[TrackSystem] Connection indicators ${this.connectionIndicatorsEnabled ? 'enabled' : 'disabled'}`);
        return this.connectionIndicatorsEnabled;
    }

    /**
     * Check if connection indicators are enabled
     */
    areConnectionIndicatorsEnabled(): boolean {
        return this.connectionIndicatorsEnabled;
    }

    // ========================================================================
    // PIECE PLACEMENT
    // ========================================================================

    /**
     * Place a new track piece at a position with auto-snap
     * @param catalogId - ID of catalog entry to place
     * @param position - World position for piece center
     * @param rotation - World rotation (default: identity)
     * @returns Placed piece or null if placement failed
     */
    placePiece(
        catalogId: string,
        position: Vector3,
        rotation: Quaternion = Quaternion.Identity()
    ): TrackPiece | null {
        try {
            // Validate inputs
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
                console.error(`[TrackSystem] Unknown catalog ID: ${catalogId}`);
                return null;
            }

            // Store original position/rotation for potential snap
            let finalPosition = position.clone();
            let finalRotation = rotation.clone();
            let snappedTo: { pieceId: string; connectorId: string } | null = null;

            // ================================================================
            // AUTO-SNAP LOGIC
            // ================================================================
            if (this.autoSnapEnabled && this.pieces.size > 0) {
                const snapResult = this.findBestSnapPosition(
                    catalogEntry,
                    position,
                    rotation
                );

                if (snapResult) {
                    finalPosition = snapResult.position;
                    finalRotation = snapResult.rotation;
                    snappedTo = {
                        pieceId: snapResult.targetPiece.id,
                        connectorId: snapResult.targetConnector.id
                    };
                    console.log(`[TrackSystem] Auto-snapping to ${snappedTo.pieceId}:${snappedTo.connectorId}`);
                }
            }

            // Check bounds with final position
            if (!this.isPositionInBounds(finalPosition)) {
                console.warn(`[TrackSystem] Position out of bounds: (${finalPosition.x.toFixed(3)}, ${finalPosition.z.toFixed(3)})`);
                return null;
            }

            // Generate unique piece ID
            const pieceId = `piece_${this.nextPieceId++}`;

            // Create piece instance with potentially snapped position/rotation
            const piece = new TrackPiece(pieceId, catalogEntry, finalPosition, finalRotation);

            // Add to collection
            this.pieces.set(pieceId, piece);

            // Connect piece to graph (creates nodes and edges)
            this.connectPieceToGraph(piece);

            // Render the piece
            const edges = this.graph.getEdgesByPiece(pieceId);
            this.renderer.renderPiece(piece, edges);

            // ================================================================
            // CONNECTION FEEDBACK
            // ================================================================
            // Check for new connections and provide visual feedback
            const connections = this.detectNewConnections(piece);

            if (connections.length > 0) {
                // Play connection animation for each new connection
                for (const conn of connections) {
                    if (conn.worldPos) {
                        this.connectionIndicator.playConnectionAnimation(conn.worldPos);
                    }
                }
                console.log(`✓ Placed ${catalogEntry.name} (${pieceId}) - Connected ${connections.length} point(s)!`);
            } else {
                console.log(`✓ Placed ${catalogEntry.name} (${pieceId}) at (${finalPosition.x.toFixed(3)}, ${finalPosition.z.toFixed(3)})`);
            }

            // Update all connection indicators
            this.connectionIndicator.updateIndicators(Array.from(this.pieces.values()));

            return piece;

        } catch (error) {
            console.error('[TrackSystem] Error placing piece:', error);
            return null;
        }
    }

    /**
     * Find the best snap position for a new piece
     * Checks all connectors on the new piece against existing unconnected connectors
     * @param catalogEntry - Catalog entry for the piece to place
     * @param position - Intended position
     * @param rotation - Intended rotation
     * @returns Snap transform or null if no snap found
     */
    private findBestSnapPosition(
        catalogEntry: TrackCatalogEntry,
        position: Vector3,
        rotation: Quaternion
    ): { position: Vector3; rotation: Quaternion; targetPiece: TrackPiece; targetConnector: Connector; newConnector: Connector } | null {
        try {
            // Create a temporary piece to get connector positions
            const tempPiece = new TrackPiece('temp', catalogEntry, position, rotation);

            let bestSnap: {
                position: Vector3;
                rotation: Quaternion;
                targetPiece: TrackPiece;
                targetConnector: Connector;
                newConnector: Connector;
                distance: number;
            } | null = null;

            console.log(`[TrackSystem] Checking snap for ${catalogEntry.name} at (${position.x.toFixed(3)}, ${position.z.toFixed(3)})`);

            // Check each connector on the new piece
            for (const newConnector of tempPiece.connectors) {
                if (!newConnector.worldPos) continue;

                // Find nearby unconnected connectors on existing pieces
                const candidates = SnapHelper.findNearbyConnectors(
                    newConnector.worldPos,
                    Array.from(this.pieces.values())
                );

                if (candidates.length > 0) {
                    console.log(`  Connector ${newConnector.id}: found ${candidates.length} snap candidate(s)`);
                }

                for (const candidate of candidates) {
                    // Compute snap transform
                    const snapTransform = SnapHelper.computeSnapTransform(
                        newConnector,
                        candidate.existingConnector
                    );

                    if (snapTransform) {
                        // Validate the connection would be valid
                        const validation = this.validateSnapTransform(
                            catalogEntry,
                            snapTransform.position,
                            snapTransform.rotation,
                            newConnector,
                            candidate.existingConnector
                        );

                        console.log(`    → ${candidate.existingPiece.id}:${candidate.existingConnector.id} dist=${(candidate.distance * 1000).toFixed(1)}mm valid=${validation.valid} ${validation.reason || ''}`);

                        if (validation.valid) {
                            // Keep track of the best (closest) snap
                            if (!bestSnap || candidate.distance < bestSnap.distance) {
                                bestSnap = {
                                    position: snapTransform.position,
                                    rotation: snapTransform.rotation,
                                    targetPiece: candidate.existingPiece,
                                    targetConnector: candidate.existingConnector,
                                    newConnector: newConnector,
                                    distance: candidate.distance
                                };
                            }
                        }
                    }
                }
            }

            return bestSnap;

        } catch (error) {
            console.error('[TrackSystem] Error finding snap position:', error);
            return null;
        }
    }

    /**
     * Validate that a snap transform would result in a valid placement
     */
    private validateSnapTransform(
        catalogEntry: TrackCatalogEntry,
        position: Vector3,
        rotation: Quaternion,
        newConnector: Connector,
        targetConnector: Connector
    ): { valid: boolean; reason?: string } {
        try {
            // Check if position is in bounds
            if (!this.isPositionInBounds(position)) {
                return { valid: false, reason: 'Position out of bounds' };
            }

            // Create temp piece at snap position to verify alignment
            const tempPiece = new TrackPiece('validation', catalogEntry, position, rotation);

            // Find the corresponding connector on the snapped piece
            const snappedConnector = tempPiece.connectors.find(c => c.id === newConnector.id);
            if (!snappedConnector?.worldPos || !snappedConnector?.worldForward) {
                return { valid: false, reason: 'Could not compute snapped connector position' };
            }

            // Validate the actual connection
            return SnapHelper.validateConnection(snappedConnector, targetConnector);

        } catch (error) {
            console.error('[TrackSystem] Error validating snap:', error);
            return { valid: false, reason: 'Validation error' };
        }
    }

    /**
     * Detect which connectors on a new piece are now connected to existing pieces
     * Two connectors are connected if they share the same graph node
     */
    private detectNewConnections(piece: TrackPiece): Connector[] {
        const connections: Connector[] = [];

        try {
            console.log(`[TrackSystem] Checking connections for piece ${piece.id}...`);

            for (const connector of piece.connectors) {
                if (!connector.nodeId) {
                    console.log(`  Connector ${connector.id}: no nodeId`);
                    continue;
                }

                // Check if any other piece has a connector at the same node
                for (const [otherId, otherPiece] of this.pieces) {
                    if (otherId === piece.id) continue;

                    for (const otherConnector of otherPiece.connectors) {
                        if (otherConnector.nodeId === connector.nodeId) {
                            console.log(`  ✓ Connector ${connector.id} shares node ${connector.nodeId} with ${otherId}:${otherConnector.id}`);
                            connections.push(connector);
                            break;
                        }
                    }
                }
            }

            console.log(`[TrackSystem] Found ${connections.length} connection(s)`);

        } catch (error) {
            console.error('[TrackSystem] Error detecting connections:', error);
        }

        return connections;
    }

    // ========================================================================
    // PIECE MOVEMENT
    // ========================================================================

    /**
     * Move a track piece to a new position
     * @param pieceId - ID of piece to move
     * @param newPosition - New world position
     * @returns True if move succeeded
     */
    movePiece(pieceId: string, newPosition: Vector3): boolean {
        try {
            if (!pieceId || !newPosition) {
                console.error('[TrackSystem] movePiece: pieceId and newPosition required');
                return false;
            }

            const piece = this.pieces.get(pieceId);
            if (!piece) {
                console.warn(`[TrackSystem] Piece not found: ${pieceId}`);
                return false;
            }

            // Check bounds
            if (!this.isPositionInBounds(newPosition)) {
                console.warn(`[TrackSystem] New position out of bounds`);
                return false;
            }

            // Update piece position
            piece.setPosition(newPosition);

            // Update graph node positions
            this.updateGraphNodesForPiece(piece);

            // Check for nodes that need to be unmerged (piece moved away)
            this.unmergeDistantNodes(piece);

            // Check for nodes that can be merged (piece moved close)
            this.mergeOverlappingNodes(piece);

            // Re-render the piece
            const edges = this.graph.getEdgesByPiece(pieceId);
            this.renderer.removePiece(pieceId);
            this.renderer.renderPiece(piece, edges);

            // Update connection indicators
            this.connectionIndicator.updateIndicators(Array.from(this.pieces.values()));

            return true;

        } catch (error) {
            console.error('[TrackSystem] Error moving piece:', error);
            return false;
        }
    }

    /**
     * Rotate a track piece
     * @param pieceId - ID of piece to rotate
     * @param rotation - New world rotation
     * @returns True if rotation succeeded
     */
    rotatePiece(pieceId: string, rotation: Quaternion): boolean {
        try {
            const piece = this.pieces.get(pieceId);
            if (!piece) {
                console.warn(`[TrackSystem] Piece not found: ${pieceId}`);
                return false;
            }

            // Update piece rotation
            piece.setRotation(rotation);

            // Update graph node positions
            this.updateGraphNodesForPiece(piece);

            // Check for nodes that need to be unmerged (piece rotated away)
            this.unmergeDistantNodes(piece);

            // Check for nodes that can be merged (piece rotated close)
            this.mergeOverlappingNodes(piece);

            // Re-render
            const edges = this.graph.getEdgesByPiece(pieceId);
            this.renderer.removePiece(pieceId);
            this.renderer.renderPiece(piece, edges);

            // Update connection indicators
            this.connectionIndicator.updateIndicators(Array.from(this.pieces.values()));

            return true;

        } catch (error) {
            console.error('[TrackSystem] Error rotating piece:', error);
            return false;
        }
    }

    // ========================================================================
    // PIECE REMOVAL
    // ========================================================================

    /**
     * Remove a track piece from the layout
     * @param pieceId - ID of piece to remove
     * @returns True if removal succeeded
     */
    removePiece(pieceId: string): boolean {
        try {
            if (!pieceId) {
                console.error('[TrackSystem] removePiece: pieceId required');
                return false;
            }

            const piece = this.pieces.get(pieceId);
            if (!piece) {
                console.warn(`[TrackSystem] Piece not found: ${pieceId}`);
                return false;
            }

            // Remove visual representation
            this.renderer.removePiece(pieceId);

            // Remove connection indicators for this piece
            this.connectionIndicator.removePieceIndicators(pieceId);

            // Remove graph edges
            piece.generatedEdgeIds.forEach(edgeId => {
                try {
                    this.graph.removeEdge(edgeId);
                } catch (e) {
                    console.error(`[TrackSystem] Error removing edge ${edgeId}:`, e);
                }
            });

            // Remove graph nodes (if not shared with other pieces)
            piece.connectors.forEach(connector => {
                if (connector.nodeId) {
                    // Check if node is used by other pieces
                    const connectedEdges = this.graph.getEdgesConnectedToNode(connector.nodeId);
                    if (connectedEdges.length === 0) {
                        try {
                            this.graph.removeNode(connector.nodeId);
                        } catch (e) {
                            console.error(`[TrackSystem] Error removing node ${connector.nodeId}:`, e);
                        }
                    }
                }
            });

            // Remove from collection
            this.pieces.delete(pieceId);

            // Update remaining indicators (may have changed from connected to available)
            this.connectionIndicator.updateIndicators(Array.from(this.pieces.values()));

            console.log(`✓ Removed piece ${pieceId}`);
            return true;

        } catch (error) {
            console.error('[TrackSystem] Error removing piece:', error);
            return false;
        }
    }

    // ========================================================================
    // GRAPH MANAGEMENT
    // ========================================================================

    /**
     * Connect a piece to the track graph
     * Creates nodes at connector positions and edges between them
     * @param piece - Piece to connect
     */
    private connectPieceToGraph(piece: TrackPiece): void {
        try {
            console.log(`[TrackSystem] Connecting piece ${piece.id} to graph...`);

            // Create or find nodes for each connector
            piece.connectors.forEach(connector => {
                if (!connector.worldPos) {
                    console.warn(`[TrackSystem] Connector ${connector.id} missing worldPos`);
                    return;
                }

                console.log(`[TrackSystem]   Connector ${connector.id} worldPos: (${connector.worldPos.x.toFixed(4)}, ${connector.worldPos.y.toFixed(4)}, ${connector.worldPos.z.toFixed(4)})`);

                // Check all existing nodes for debug
                const allNodes = this.graph.getAllNodes();
                if (allNodes.length > 0) {
                    console.log(`[TrackSystem]   Existing ${allNodes.length} nodes:`);
                    for (const existingNode of allNodes) {
                        const dist = Vector3.Distance(connector.worldPos, existingNode.pos);
                        console.log(`[TrackSystem]     ${existingNode.id}: (${existingNode.pos.x.toFixed(4)}, ${existingNode.pos.y.toFixed(4)}, ${existingNode.pos.z.toFixed(4)}) dist=${(dist * 1000).toFixed(1)}mm`);
                    }
                }

                // Check for existing node at this position (for snapping)
                // Use 10mm tolerance to account for snap alignment
                let node = this.graph.findNodeAt(connector.worldPos, 0.015); // Increased to 15mm

                if (node) {
                    // Found existing node - this connector is now connected!
                    console.log(`[TrackSystem] 🔗 Connector ${connector.id} connects to existing node ${node.id}`);
                } else {
                    // Create new node
                    node = this.graph.addNode(connector.worldPos);
                    console.log(`[TrackSystem] Created new node ${node.id} for connector ${connector.id}`);
                }

                connector.nodeId = node.id;
            });

            // Create edges based on piece type
            if (piece.catalogEntry.type === 'straight') {
                this.createStraightEdges(piece);
            } else if (piece.catalogEntry.type === 'curve') {
                this.createCurveEdges(piece);
            } else if (piece.catalogEntry.type === 'switch') {
                this.createSwitchEdges(piece);
            } else if (piece.catalogEntry.type === 'curved_switch') {
                this.createCurvedSwitchEdges(piece);
            } else if (piece.catalogEntry.type === 'crossing') {
                this.createCrossingEdges(piece);
            }

        } catch (error) {
            console.error(`[TrackSystem] Error connecting piece ${piece.id}:`, error);
        }
    }

    /**
     * Create edges for a straight track piece
     */
    private createStraightEdges(piece: TrackPiece): void {
        const connA = piece.getConnector('A');
        const connB = piece.getConnector('B');

        if (!connA?.nodeId || !connB?.nodeId) {
            console.error(`[TrackSystem] Straight piece ${piece.id} missing connectors`);
            return;
        }

        const edge = this.graph.addEdge(
            connA.nodeId,
            connB.nodeId,
            piece.catalogEntry.lengthM,
            { type: 'straight' },
            piece.id
        );
        piece.generatedEdgeIds.push(edge.id);

        console.log(`[TrackSystem] Created straight edge ${edge.id}`);
    }

    /**
     * Create edges for a curved track piece
     */
    private createCurveEdges(piece: TrackPiece): void {
        const connA = piece.getConnector('A');
        const connB = piece.getConnector('B');

        if (!connA?.nodeId || !connB?.nodeId) {
            console.error(`[TrackSystem] Curve piece ${piece.id} missing connectors`);
            return;
        }

        const catalog = piece.catalogEntry;
        if (!catalog.curveRadiusM || !catalog.curveAngleDeg) {
            console.error(`[TrackSystem] Curve piece ${piece.id} missing curve parameters`);
            return;
        }

        // Create curve definition with direction
        const curveDef: CurveDefinition = {
            type: 'arc',
            arcRadiusM: catalog.curveRadiusM,
            arcAngleDeg: catalog.curveAngleDeg,
            arcDirection: catalog.curveDirection || 1
        };

        const edge = this.graph.addEdge(
            connA.nodeId,
            connB.nodeId,
            catalog.lengthM,
            curveDef,
            piece.id
        );
        piece.generatedEdgeIds.push(edge.id);

        console.log(`[TrackSystem] Created curve edge ${edge.id} (R=${catalog.curveRadiusM}m, ${catalog.curveAngleDeg}°, dir=${catalog.curveDirection})`);
    }

    /**
     * Create edges for a switch/turnout piece
     */
    private createSwitchEdges(piece: TrackPiece): void {
        const common = piece.getConnector('COMMON');
        const straight = piece.getConnector('STRAIGHT');
        const diverging = piece.getConnector('DIVERGING');

        if (!common?.nodeId || !straight?.nodeId || !diverging?.nodeId) {
            console.error(`[TrackSystem] Switch piece ${piece.id} missing connectors`);
            return;
        }

        const catalog = piece.catalogEntry;

        // Straight route edge
        const straightEdge = this.graph.addEdge(
            common.nodeId,
            straight.nodeId,
            catalog.lengthM,
            { type: 'straight' },
            piece.id
        );
        piece.generatedEdgeIds.push(straightEdge.id);

        // Diverging route edge (curved)
        const divergingCurve: CurveDefinition = {
            type: 'arc',
            arcRadiusM: catalog.curveRadiusM || 0.371,
            arcAngleDeg: catalog.curveAngleDeg || 22.5,
            arcDirection: catalog.curveDirection || 1
        };

        const divergingEdge = this.graph.addEdge(
            common.nodeId,
            diverging.nodeId,
            catalog.lengthM,
            divergingCurve,
            piece.id
        );
        piece.generatedEdgeIds.push(divergingEdge.id);

        console.log(`[TrackSystem] Created switch edges: straight=${straightEdge.id}, diverging=${divergingEdge.id}`);
    }

    /**
     * Create edges for a curved switch/point piece
     * Both routes are curved (inner and outer arcs)
     */
    private createCurvedSwitchEdges(piece: TrackPiece): void {
        const common = piece.getConnector('COMMON');
        const inner = piece.getConnector('INNER');
        const outer = piece.getConnector('OUTER');

        if (!common?.nodeId || !inner?.nodeId || !outer?.nodeId) {
            console.error(`[TrackSystem] Curved switch ${piece.id} missing connectors`);
            return;
        }

        const catalog = piece.catalogEntry;
        const radius = catalog.curveRadiusM || 0.438;
        const direction = catalog.curveDirection || 1;

        // Inner route edge (smaller angle, e.g., 22.5°)
        const innerAngle = catalog.innerAngleDeg || 22.5;
        const innerCurve: CurveDefinition = {
            type: 'arc',
            arcRadiusM: radius,
            arcAngleDeg: innerAngle,
            arcDirection: direction
        };

        // Calculate arc length for inner route
        const innerArcLength = radius * (innerAngle * Math.PI / 180);

        const innerEdge = this.graph.addEdge(
            common.nodeId,
            inner.nodeId,
            innerArcLength,
            innerCurve,
            piece.id
        );
        piece.generatedEdgeIds.push(innerEdge.id);

        // Outer route edge (larger angle, e.g., 33.75°)
        const outerAngle = catalog.outerAngleDeg || 33.75;
        const outerCurve: CurveDefinition = {
            type: 'arc',
            arcRadiusM: radius,
            arcAngleDeg: outerAngle,
            arcDirection: direction
        };

        // Calculate arc length for outer route
        const outerArcLength = radius * (outerAngle * Math.PI / 180);

        const outerEdge = this.graph.addEdge(
            common.nodeId,
            outer.nodeId,
            outerArcLength,
            outerCurve,
            piece.id
        );
        piece.generatedEdgeIds.push(outerEdge.id);

        console.log(`[TrackSystem] Created curved switch edges: inner=${innerEdge.id} (${innerAngle}°), outer=${outerEdge.id} (${outerAngle}°)`);
    }

    /**
     * Create edges for a diamond crossing piece
     * Two tracks cross without connecting
     */
    private createCrossingEdges(piece: TrackPiece): void {
        // Crossing has 4 connectors: A1, A2 (main track) and B1, B2 (crossing track)
        const a1 = piece.getConnector('A1');
        const a2 = piece.getConnector('A2');
        const b1 = piece.getConnector('B1');
        const b2 = piece.getConnector('B2');

        if (!a1?.nodeId || !a2?.nodeId || !b1?.nodeId || !b2?.nodeId) {
            console.error(`[TrackSystem] Crossing ${piece.id} missing connectors`);
            return;
        }

        const catalog = piece.catalogEntry;

        // Main track edge (A1 to A2) - straight
        const mainEdge = this.graph.addEdge(
            a1.nodeId,
            a2.nodeId,
            catalog.lengthM,
            { type: 'straight' },
            piece.id
        );
        piece.generatedEdgeIds.push(mainEdge.id);

        // Crossing track edge (B1 to B2) - straight at an angle
        const crossEdge = this.graph.addEdge(
            b1.nodeId,
            b2.nodeId,
            catalog.lengthM,
            { type: 'straight' },
            piece.id
        );
        piece.generatedEdgeIds.push(crossEdge.id);

        console.log(`[TrackSystem] Created crossing edges: main=${mainEdge.id}, cross=${crossEdge.id}`);
    }

    /**
     * Update graph node positions for a moved piece
     */
    private updateGraphNodesForPiece(piece: TrackPiece): void {
        piece.connectors.forEach(connector => {
            if (connector.nodeId && connector.worldPos) {
                const node = this.graph.getNode(connector.nodeId);
                if (node) {
                    node.pos = connector.worldPos.clone();
                }
            }
        });
    }

    /**
     * Merge nodes when connectors from different pieces are close together
     * This is what creates "connections" between pieces
     * @param piece - The piece that was just moved/placed
     * @returns Number of connections made
     */
    private mergeOverlappingNodes(piece: TrackPiece): number {
        const MERGE_TOLERANCE = 0.015; // 15mm tolerance for node merging
        let connectionsMade = 0;

        console.log(`[TrackSystem] Checking for node merges for piece ${piece.id}...`);

        for (const connector of piece.connectors) {
            if (!connector.worldPos || !connector.nodeId) continue;

            // Check against all other pieces' connectors
            for (const [otherId, otherPiece] of this.pieces) {
                if (otherId === piece.id) continue;

                for (const otherConnector of otherPiece.connectors) {
                    if (!otherConnector.worldPos || !otherConnector.nodeId) continue;

                    // Already merged?
                    if (connector.nodeId === otherConnector.nodeId) continue;

                    // Check distance
                    const distance = Vector3.Distance(connector.worldPos, otherConnector.worldPos);

                    if (distance <= MERGE_TOLERANCE) {
                        console.log(`[TrackSystem] 🔗 Merging nodes: ${connector.id} (${connector.nodeId}) ↔ ${otherConnector.id} (${otherConnector.nodeId}) dist=${(distance * 1000).toFixed(1)}mm`);

                        // Merge: give this connector the other connector's nodeId
                        const oldNodeId = connector.nodeId;
                        const newNodeId = otherConnector.nodeId;

                        // Update all edges that reference the old node
                        this.graph.getAllEdges().forEach(edge => {
                            if (edge.fromNodeId === oldNodeId) {
                                edge.fromNodeId = newNodeId;
                            }
                            if (edge.toNodeId === oldNodeId) {
                                edge.toNodeId = newNodeId;
                            }
                        });

                        // Update connector
                        connector.nodeId = newNodeId;

                        // Remove orphaned node
                        this.graph.removeNode(oldNodeId);

                        connectionsMade++;

                        // Play connection animation
                        if (connector.worldPos) {
                            this.connectionIndicator.playConnectionAnimation(connector.worldPos);
                        }
                    }
                }
            }
        }

        if (connectionsMade > 0) {
            console.log(`[TrackSystem] ✓ Made ${connectionsMade} connection(s)`);
        }

        return connectionsMade;
    }

    /**
     * Unmerge nodes when a piece is moved away from another
     * Creates new nodes for connectors that are no longer close to others
     * @param piece - The piece that was just moved
     */
    private unmergeDistantNodes(piece: TrackPiece): void {
        const UNMERGE_THRESHOLD = 0.020; // 20mm - unmerge if farther than this

        for (const connector of piece.connectors) {
            if (!connector.worldPos || !connector.nodeId) continue;

            // Check if this connector's node is shared with another piece
            let isShared = false;
            let closestDistance = Infinity;

            for (const [otherId, otherPiece] of this.pieces) {
                if (otherId === piece.id) continue;

                for (const otherConnector of otherPiece.connectors) {
                    if (otherConnector.nodeId === connector.nodeId) {
                        isShared = true;
                        if (otherConnector.worldPos) {
                            const dist = Vector3.Distance(connector.worldPos, otherConnector.worldPos);
                            closestDistance = Math.min(closestDistance, dist);
                        }
                    }
                }
            }

            // If shared but now too far apart, create a new node for this connector
            if (isShared && closestDistance > UNMERGE_THRESHOLD) {
                console.log(`[TrackSystem] Unmerging ${connector.id}: distance ${(closestDistance * 1000).toFixed(1)}mm > threshold`);

                const oldNodeId = connector.nodeId;
                const newNode = this.graph.addNode(connector.worldPos);
                connector.nodeId = newNode.id;

                // Update edges for this piece to use new node
                piece.generatedEdgeIds.forEach(edgeId => {
                    const edge = this.graph.getEdge(edgeId);
                    if (edge) {
                        if (edge.fromNodeId === oldNodeId) {
                            edge.fromNodeId = newNode.id;
                        }
                        if (edge.toNodeId === oldNodeId) {
                            edge.toNodeId = newNode.id;
                        }
                    }
                });
            }
        }
    }

    // ========================================================================
    // SWITCH OPERATIONS
    // ========================================================================

    /**
     * Toggle a switch's state
     * @param pieceId - ID of switch piece
     * @returns True if toggle succeeded
     */
    toggleSwitch(pieceId: string): boolean {
        try {
            const piece = this.pieces.get(pieceId);
            if (!piece) {
                console.warn(`[TrackSystem] Piece not found: ${pieceId}`);
                return false;
            }

            if (!piece.isSwitch) {
                console.warn(`[TrackSystem] Piece ${pieceId} is not a switch`);
                return false;
            }

            piece.toggleSwitch();
            console.log(`✓ Switch ${pieceId} → ${piece.switchState}`);

            return true;

        } catch (error) {
            console.error('[TrackSystem] Error toggling switch:', error);
            return false;
        }
    }

    // ========================================================================
    // QUERIES
    // ========================================================================

    /**
     * Get all placed pieces
     * @returns Array of all track pieces
     */
    getAllPieces(): TrackPiece[] {
        return Array.from(this.pieces.values());
    }

    /**
     * Get piece by ID
     * @param pieceId - ID to look up
     * @returns TrackPiece or undefined
     */
    getPiece(pieceId: string): TrackPiece | undefined {
        return this.pieces.get(pieceId);
    }

    /**
     * Get the track graph
     * @returns TrackGraph instance
     */
    getGraph(): TrackGraph {
        return this.graph;
    }

    /**
     * Find snap candidates near a position
     * @param position - World position to check
     * @param excludePiece - Optional piece to exclude from results
     * @returns Array of snap candidates
     */
    findSnapCandidates(position: Vector3, excludePiece?: TrackPiece) {
        return SnapHelper.findNearbyConnectors(
            position,
            this.getAllPieces(),
            excludePiece
        );
    }

    /**
     * Check if a position is within board bounds
     * @param position - World position to check
     * @returns True if in bounds
     */
    isPositionInBounds(position: Vector3): boolean {
        const dims = this.project.getBoardDimensions();
        return SnapHelper.isPositionInBounds(position, dims.width, dims.depth);
    }

    /**
     * Get statistics about the current layout
     * @returns Track statistics
     */
    getStats(): TrackStats {
        const graphStats = this.graph.getStats();
        return {
            pieceCount: this.pieces.size,
            meshCount: this.renderer.getMeshCount(),
            ...graphStats
        };
    }

    // ========================================================================
    // CLEAR & SERIALIZATION
    // ========================================================================

    /**
     * Clear all track from the layout
     */
    clear(): void {
        try {
            this.renderer.clear();
            this.connectionIndicator.clear();
            this.pieces.clear();
            this.graph.clear();
            this.nextPieceId = 0;
            console.log('✓ Track cleared');
        } catch (error) {
            console.error('[TrackSystem] Error clearing:', error);
        }
    }

    /**
     * Export layout to JSON for saving
     * @returns JSON-serializable object
     */
    toJSON(): object {
        return {
            pieces: this.getAllPieces().map(p => p.toJSON()),
            graph: this.graph.toJSON()
        };
    }

    /**
     * Import layout from JSON
     * @param data - Previously saved layout data
     */
    fromJSON(data: any): void {
        try {
            this.clear();

            if (!data) {
                console.error('[TrackSystem] fromJSON: No data provided');
                return;
            }

            // Import graph first
            if (data.graph) {
                this.graph.fromJSON(data.graph);
            }

            // Import pieces
            if (data.pieces && Array.isArray(data.pieces)) {
                data.pieces.forEach((pieceData: any) => {
                    const catalogEntry = TrackCatalog.get(pieceData.catalogId);
                    if (!catalogEntry) {
                        console.warn(`[TrackSystem] Unknown catalog ID: ${pieceData.catalogId}`);
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

                    const piece = new TrackPiece(
                        pieceData.id,
                        catalogEntry,
                        position,
                        rotation
                    );

                    piece.generatedEdgeIds = pieceData.generatedEdgeIds || [];
                    piece.switchState = pieceData.switchState;

                    // Restore connector node associations
                    if (pieceData.connectors) {
                        pieceData.connectors.forEach((connData: any, idx: number) => {
                            if (piece.connectors[idx]) {
                                piece.connectors[idx].nodeId = connData.nodeId;
                            }
                        });
                    }

                    this.pieces.set(piece.id, piece);

                    // Render
                    const edges = this.graph.getEdgesByPiece(piece.id);
                    this.renderer.renderPiece(piece, edges);
                });

                // Update connection indicators for all loaded pieces
                this.connectionIndicator.updateIndicators(Array.from(this.pieces.values()));

                console.log(`✓ Loaded ${this.pieces.size} track pieces`);
            }

        } catch (error) {
            console.error('[TrackSystem] Error loading from JSON:', error);
        }
    }

    // ========================================================================
    // SNAP PREVIEW (for UI feedback during placement)
    // ========================================================================

    /**
     * Get snap preview position for a catalog entry at a given position
     * Used to show where a piece would snap to during placement mode
     * @param catalogId - Catalog entry to preview
     * @param position - Current cursor position
     * @param rotation - Current rotation
     * @returns Snap preview info or null if no snap available
     */
    getSnapPreview(
        catalogId: string,
        position: Vector3,
        rotation: Quaternion
    ): { position: Vector3; rotation: Quaternion; connectorPos: Vector3 } | null {
        if (!this.autoSnapEnabled || this.pieces.size === 0) {
            return null;
        }

        try {
            const catalogEntry = TrackCatalog.get(catalogId);
            if (!catalogEntry) return null;

            const snapResult = this.findBestSnapPosition(catalogEntry, position, rotation);

            if (snapResult && snapResult.targetConnector.worldPos) {
                return {
                    position: snapResult.position,
                    rotation: snapResult.rotation,
                    connectorPos: snapResult.targetConnector.worldPos
                };
            }
        } catch (error) {
            console.error('[TrackSystem] Error getting snap preview:', error);
        }

        return null;
    }

    /**
     * Show snap preview indicator at a position
     * @param position - World position for indicator
     */
    showSnapPreview(position: Vector3): void {
        this.connectionIndicator.showSnapPreview(position);
    }

    /**
     * Hide snap preview indicator
     */
    hideSnapPreview(): void {
        this.connectionIndicator.hideSnapPreview();
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Dispose all resources
     */
    dispose(): void {
        try {
            this.clear();
            this.renderer.dispose();
            this.connectionIndicator.dispose();
            console.log('[TrackSystem] Disposed');
        } catch (error) {
            console.error('[TrackSystem] Error disposing:', error);
        }
    }
}