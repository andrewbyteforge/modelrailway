/**
 * TrackRenderer.ts - Renders track pieces with accurate geometry
 * 
 * Path: frontend/src/systems/track/TrackRenderer.ts
 * 
 * Creates visual representation of track including:
 * - Rails (following true circular arcs for curves)
 * - Sleepers/ties (perpendicular to track direction)
 * - Ballast (gravel bed beneath track)
 * - Switch/turnout geometry with frog points
 * - Diamond crossing geometry
 * 
 * Key features:
 * - Proper circular arc mathematics for curved track
 * - Accurate Hornby OO gauge dimensions
 * - Smooth curve rendering with configurable segment count
 * - Special handling for switches with V-shaped frog geometry
 * - Diamond crossing support
 * 
 * @module TrackRenderer
 * @author Model Railway Workbench
 * @version 2.0.0
 */

import { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3, Matrix, Quaternion } from '@babylonjs/core/Maths/math.vector';
import type { TrackPiece } from './TrackPiece';
import type { GraphEdge } from './TrackGraph';

// ============================================================================
// CONSTANTS - Hornby OO Gauge Visual Parameters
// ============================================================================

/**
 * Visual dimensions for track rendering (all in meters)
 * Based on OO gauge (1:76.2 scale) specifications
 */
const TRACK_VISUALS = {
    // Rail dimensions
    RAIL_WIDTH: 0.002,          // 2mm rail head width
    RAIL_HEIGHT: 0.003,         // 3mm rail height
    GAUGE: 0.0165,              // 16.5mm track gauge (OO standard)

    // Sleeper dimensions (wooden ties)
    SLEEPER_LENGTH: 0.025,      // 25mm sleeper length (perpendicular to rails)
    SLEEPER_WIDTH: 0.004,       // 4mm sleeper width (along track)
    SLEEPER_HEIGHT: 0.002,      // 2mm sleeper thickness
    SLEEPER_SPACING: 0.010,     // 10mm between sleeper centers

    // Ballast dimensions
    BALLAST_WIDTH: 0.035,       // 35mm ballast bed width
    BALLAST_HEIGHT: 0.003,      // 3mm ballast depth

    // Switch-specific dimensions
    SWITCH_FROG_LENGTH: 0.025,  // 25mm frog point length
    SWITCH_BLADE_LENGTH: 0.030, // 30mm point blade length
    SWITCH_BLADE_GAP: 0.001,    // 1mm gap between blade and stock rail

    // Rendering quality
    CURVE_SEGMENTS_PER_45_DEG: 8,  // Number of segments per 45° of curve
    MIN_CURVE_SEGMENTS: 4,          // Minimum segments for any curve
    SWITCH_FROG_SEGMENTS: 6,        // Segments for frog point rendering
} as const;

/**
 * Material colors for track components
 */
const TRACK_COLORS = {
    RAIL: new Color3(0.05, 0.05, 0.05),           // Black rails
    RAIL_SPECULAR: new Color3(0.15, 0.15, 0.15),  // Subtle metallic shine
    SLEEPER: new Color3(0.35, 0.25, 0.18),        // Dark brown wood
    BALLAST: new Color3(0.45, 0.45, 0.48),        // Grey gravel
    FROG: new Color3(0.08, 0.08, 0.08),           // Slightly lighter for frog
} as const;

/**
 * Logging prefix for consistent log formatting
 */
const LOG_PREFIX = '[TrackRenderer]';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Point along a track path with position and direction
 */
interface TrackPoint {
    /** Position in world space */
    position: Vector3;
    /** Forward direction (tangent to track) */
    forward: Vector3;
    /** Right direction (perpendicular to track, horizontal) */
    right: Vector3;
    /** Distance along track from start */
    distance: number;
}

/**
 * Arc definition for curved track rendering
 */
interface ArcDefinition {
    /** Center point of the arc */
    center: Vector3;
    /** Radius in meters */
    radius: number;
    /** Start angle in radians */
    startAngle: number;
    /** End angle in radians */
    endAngle: number;
    /** Direction: 1 = CCW (left), -1 = CW (right) */
    direction: 1 | -1;
}

/**
 * Switch route definition for rendering
 */
interface SwitchRoute {
    /** Route identifier ('straight' or 'diverging') */
    id: 'straight' | 'diverging';
    /** Track points along this route */
    points: TrackPoint[];
    /** Associated graph edge */
    edge: GraphEdge;
}

/**
 * Render statistics for debugging
 */
interface RenderStats {
    railMeshes: number;
    sleeperMeshes: number;
    ballastMeshes: number;
    hitboxMeshes: number;
    totalVertices: number;
}

// ============================================================================
// TRACK RENDERER CLASS
// ============================================================================

/**
 * TrackRenderer - Creates visual meshes for track pieces
 * 
 * Handles both straight and curved track with proper geometry:
 * - Straight track: Simple linear extrusion
 * - Curved track: True circular arc mathematics
 * - Switches: V-shaped frog with separate rail paths
 * - Crossings: Intersecting track geometry
 * 
 * @example
 * ```typescript
 * const renderer = new TrackRenderer(scene);
 * renderer.renderPiece(trackPiece, edges);
 * ```
 */
export class TrackRenderer {
    // ========================================================================
    // PRIVATE PROPERTIES
    // ========================================================================

    /** Babylon.js scene reference */
    private scene: Scene;

    /** Map of piece ID to rendered meshes */
    private meshes: Map<string, Mesh[]> = new Map();

    /** Cached materials for reuse */
    private materials: {
        rail: StandardMaterial | null;
        sleeper: StandardMaterial | null;
        ballast: StandardMaterial | null;
        frog: StandardMaterial | null;
    } = { rail: null, sleeper: null, ballast: null, frog: null };

    /** Render statistics for debugging */
    private stats: RenderStats = {
        railMeshes: 0,
        sleeperMeshes: 0,
        ballastMeshes: 0,
        hitboxMeshes: 0,
        totalVertices: 0
    };

    /** Enable verbose logging for debugging */
    private verboseLogging: boolean = false;

    // ========================================================================
    // CONSTRUCTOR & INITIALIZATION
    // ========================================================================

    /**
     * Create a new TrackRenderer
     * @param scene - Babylon.js scene to render into
     * @param verbose - Enable verbose logging (default: false)
     * @throws Error if scene is not provided
     */
    constructor(scene: Scene, verbose: boolean = false) {
        // Validate input
        if (!scene) {
            const error = new Error(`${LOG_PREFIX} Scene is required`);
            console.error(error.message);
            throw error;
        }

        this.scene = scene;
        this.verboseLogging = verbose;

        // Initialize materials
        this.initializeMaterials();

        console.log(`${LOG_PREFIX} Created with OO gauge specifications`);
        console.log(`${LOG_PREFIX}   Track gauge: ${TRACK_VISUALS.GAUGE * 1000}mm`);
        console.log(`${LOG_PREFIX}   Rail height: ${TRACK_VISUALS.RAIL_HEIGHT * 1000}mm`);
        console.log(`${LOG_PREFIX}   Sleeper spacing: ${TRACK_VISUALS.SLEEPER_SPACING * 1000}mm`);
    }

    /**
     * Initialize reusable materials for track components
     * Creates materials once for performance optimization
     */
    private initializeMaterials(): void {
        try {
            this.log('Initializing materials...');

            // Rail material - black metal with subtle shine
            this.materials.rail = new StandardMaterial('trackRailMat', this.scene);
            this.materials.rail.diffuseColor = TRACK_COLORS.RAIL;
            this.materials.rail.specularColor = TRACK_COLORS.RAIL_SPECULAR;
            this.materials.rail.ambientColor = new Color3(0, 0, 0);
            this.materials.rail.emissiveColor = new Color3(0, 0, 0);
            this.materials.rail.roughness = 0.8;
            this.materials.rail.specularPower = 32;
            this.materials.rail.backFaceCulling = false;

            // Sleeper material - matte wood
            this.materials.sleeper = new StandardMaterial('trackSleeperMat', this.scene);
            this.materials.sleeper.diffuseColor = TRACK_COLORS.SLEEPER;
            this.materials.sleeper.specularColor = new Color3(0.05, 0.05, 0.05);
            this.materials.sleeper.ambientColor = new Color3(0, 0, 0);
            this.materials.sleeper.emissiveColor = new Color3(0, 0, 0);
            this.materials.sleeper.roughness = 0.95;
            this.materials.sleeper.backFaceCulling = false;

            // Ballast material - rough gravel
            this.materials.ballast = new StandardMaterial('trackBallastMat', this.scene);
            this.materials.ballast.diffuseColor = TRACK_COLORS.BALLAST;
            this.materials.ballast.specularColor = new Color3(0.02, 0.02, 0.02);
            this.materials.ballast.ambientColor = new Color3(0, 0, 0);
            this.materials.ballast.emissiveColor = new Color3(0, 0, 0);
            this.materials.ballast.roughness = 1.0;
            this.materials.ballast.backFaceCulling = false;

            // Frog material - slightly different shade for visual distinction
            this.materials.frog = new StandardMaterial('trackFrogMat', this.scene);
            this.materials.frog.diffuseColor = TRACK_COLORS.FROG;
            this.materials.frog.specularColor = new Color3(0.2, 0.2, 0.2);
            this.materials.frog.ambientColor = new Color3(0, 0, 0);
            this.materials.frog.emissiveColor = new Color3(0, 0, 0);
            this.materials.frog.roughness = 0.7;
            this.materials.frog.backFaceCulling = false;

            this.log('Materials initialized successfully');

        } catch (error) {
            console.error(`${LOG_PREFIX} Error initializing materials:`, error);
            throw error;
        }
    }

    // ========================================================================
    // PUBLIC API - PIECE RENDERING
    // ========================================================================

    /**
     * Render a track piece with all its edges
     * Main entry point for rendering track pieces
     * 
     * @param piece - Track piece to render
     * @param edges - Graph edges belonging to this piece
     */
    public renderPiece(piece: TrackPiece, edges: GraphEdge[]): void {
        try {
            // Validate inputs
            if (!piece) {
                console.error(`${LOG_PREFIX} renderPiece: piece is null`);
                return;
            }

            if (!edges || edges.length === 0) {
                console.warn(`${LOG_PREFIX} No edges to render for piece ${piece.id}`);
                return;
            }

            this.log(`Rendering piece ${piece.id} (${piece.catalogEntry.name}) with ${edges.length} edge(s)`);

            // Remove existing meshes for this piece (re-render case)
            this.removePiece(piece.id);

            const pieceMeshes: Mesh[] = [];

            // Create invisible hitbox for easier selection
            const hitbox = this.createHitbox(piece, edges);
            if (hitbox) {
                pieceMeshes.push(hitbox);
                this.stats.hitboxMeshes++;
            }

            // Render based on piece type
            const pieceType = piece.catalogEntry.type;

            switch (pieceType) {
                case 'straight':
                case 'curve':
                    // Standard track rendering
                    for (const edge of edges) {
                        try {
                            const edgeMeshes = this.renderStandardEdge(edge, piece);
                            pieceMeshes.push(...edgeMeshes);
                        } catch (error) {
                            console.error(`${LOG_PREFIX} Error rendering edge ${edge.id}:`, error);
                        }
                    }
                    break;

                case 'switch':
                    // Switch/turnout rendering with frog geometry
                    try {
                        const switchMeshes = this.renderSwitch(piece, edges);
                        pieceMeshes.push(...switchMeshes);
                    } catch (error) {
                        console.error(`${LOG_PREFIX} Error rendering switch ${piece.id}:`, error);
                        // Fallback to standard rendering
                        for (const edge of edges) {
                            const edgeMeshes = this.renderStandardEdge(edge, piece);
                            pieceMeshes.push(...edgeMeshes);
                        }
                    }
                    break;

                case 'curved_switch':
                    // Curved switch rendering
                    try {
                        const curvedSwitchMeshes = this.renderCurvedSwitch(piece, edges);
                        pieceMeshes.push(...curvedSwitchMeshes);
                    } catch (error) {
                        console.error(`${LOG_PREFIX} Error rendering curved switch ${piece.id}:`, error);
                        // Fallback to standard rendering
                        for (const edge of edges) {
                            const edgeMeshes = this.renderStandardEdge(edge, piece);
                            pieceMeshes.push(...edgeMeshes);
                        }
                    }
                    break;

                case 'crossing':
                    // Diamond crossing rendering
                    try {
                        const crossingMeshes = this.renderCrossing(piece, edges);
                        pieceMeshes.push(...crossingMeshes);
                    } catch (error) {
                        console.error(`${LOG_PREFIX} Error rendering crossing ${piece.id}:`, error);
                        // Fallback to standard rendering
                        for (const edge of edges) {
                            const edgeMeshes = this.renderStandardEdge(edge, piece);
                            pieceMeshes.push(...edgeMeshes);
                        }
                    }
                    break;

                default:
                    console.warn(`${LOG_PREFIX} Unknown piece type: ${pieceType}, using standard rendering`);
                    for (const edge of edges) {
                        const edgeMeshes = this.renderStandardEdge(edge, piece);
                        pieceMeshes.push(...edgeMeshes);
                    }
            }

            // Store meshes for later management
            if (pieceMeshes.length > 0) {
                this.meshes.set(piece.id, pieceMeshes);
                this.log(`Rendered piece ${piece.id}: ${pieceMeshes.length} meshes`);
            }

        } catch (error) {
            console.error(`${LOG_PREFIX} Error in renderPiece for ${piece?.id}:`, error);
        }
    }

    /**
     * Remove rendered meshes for a piece
     * @param pieceId - ID of piece to remove
     */
    public removePiece(pieceId: string): void {
        try {
            if (!pieceId) {
                console.error(`${LOG_PREFIX} removePiece: pieceId is required`);
                return;
            }

            const pieceMeshes = this.meshes.get(pieceId);
            if (pieceMeshes) {
                let disposedCount = 0;
                for (const mesh of pieceMeshes) {
                    try {
                        if (mesh && !mesh.isDisposed()) {
                            mesh.dispose();
                            disposedCount++;
                        }
                    } catch (error) {
                        console.error(`${LOG_PREFIX} Error disposing mesh:`, error);
                    }
                }
                this.meshes.delete(pieceId);
                this.log(`Removed piece ${pieceId}: disposed ${disposedCount} meshes`);
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error in removePiece:`, error);
        }
    }

    /**
     * Clear all rendered track
     */
    public clear(): void {
        try {
            let totalDisposed = 0;
            for (const [pieceId, meshes] of this.meshes) {
                for (const mesh of meshes) {
                    try {
                        if (mesh && !mesh.isDisposed()) {
                            mesh.dispose();
                            totalDisposed++;
                        }
                    } catch (error) {
                        console.error(`${LOG_PREFIX} Error disposing mesh for ${pieceId}:`, error);
                    }
                }
            }
            this.meshes.clear();
            this.resetStats();
            console.log(`${LOG_PREFIX} Cleared all track meshes (${totalDisposed} disposed)`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error in clear:`, error);
        }
    }

    /**
     * Get total mesh count (for debugging)
     * @returns Number of meshes currently rendered
     */
    public getMeshCount(): number {
        let count = 0;
        for (const meshes of this.meshes.values()) {
            count += meshes.length;
        }
        return count;
    }

    /**
     * Get render statistics
     * @returns Current render statistics
     */
    public getStats(): RenderStats {
        return { ...this.stats };
    }

    /**
     * Enable or disable verbose logging
     * @param enabled - Whether verbose logging should be enabled
     */
    public setVerboseLogging(enabled: boolean): void {
        this.verboseLogging = enabled;
        console.log(`${LOG_PREFIX} Verbose logging ${enabled ? 'enabled' : 'disabled'}`);
    }

    // ========================================================================
    // HITBOX CREATION
    // ========================================================================

    /**
     * Create an invisible hitbox mesh for easier piece selection
     * The hitbox covers the entire track piece area including curve bulge
     * 
     * @param piece - Track piece to create hitbox for
     * @param edges - Edges of the piece
     * @returns Hitbox mesh or null if creation fails
     */
    private createHitbox(piece: TrackPiece, edges: GraphEdge[]): Mesh | null {
        try {
            // Calculate bounding box from all connector positions
            let minX = Infinity, maxX = -Infinity;
            let minZ = Infinity, maxZ = -Infinity;
            let centerY = 0;

            // Get bounds from connectors
            for (const connector of piece.connectors) {
                if (connector.worldPos) {
                    minX = Math.min(minX, connector.worldPos.x);
                    maxX = Math.max(maxX, connector.worldPos.x);
                    minZ = Math.min(minZ, connector.worldPos.z);
                    maxZ = Math.max(maxZ, connector.worldPos.z);
                    centerY = connector.worldPos.y;
                }
            }

            // For curved edges, sample points along the arc to get true bounds
            for (const edge of edges) {
                if (edge.curve.type === 'arc' && edge.curve.arcRadiusM && edge.curve.arcAngleDeg) {
                    const arcBounds = this.calculateArcBounds(piece, edge);
                    if (arcBounds) {
                        minX = Math.min(minX, arcBounds.minX);
                        maxX = Math.max(maxX, arcBounds.maxX);
                        minZ = Math.min(minZ, arcBounds.minZ);
                        maxZ = Math.max(maxZ, arcBounds.maxZ);
                    }
                }
            }

            // Validate bounds
            if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minZ) || !isFinite(maxZ)) {
                console.warn(`${LOG_PREFIX} Invalid bounds for hitbox, using defaults`);
                return null;
            }

            // Add padding for easier clicking (30mm each side)
            const padding = 0.030;
            minX -= padding;
            maxX += padding;
            minZ -= padding;
            maxZ += padding;

            // Ensure minimum size
            const width = Math.max(maxX - minX, 0.050);
            const depth = Math.max(maxZ - minZ, 0.050);

            const centerX = (minX + maxX) / 2;
            const centerZ = (minZ + maxZ) / 2;

            // Create hitbox mesh
            const hitbox = MeshBuilder.CreateBox(
                `hitbox_${piece.id}`,
                {
                    width: width,
                    height: 0.015,  // 15mm tall
                    depth: depth
                },
                this.scene
            );

            if (!hitbox) {
                console.error(`${LOG_PREFIX} Failed to create hitbox mesh`);
                return null;
            }

            // Position at piece center, slightly above track
            hitbox.position = new Vector3(centerX, centerY + 0.005, centerZ);

            // Make invisible but pickable
            hitbox.visibility = 0;
            hitbox.isPickable = true;

            // Ensure bounding info is computed
            hitbox.refreshBoundingInfo();

            this.log(`Created hitbox for ${piece.id}: ${(width * 1000).toFixed(0)}mm x ${(depth * 1000).toFixed(0)}mm`);

            return hitbox;

        } catch (error) {
            console.error(`${LOG_PREFIX} Error creating hitbox:`, error);
            return null;
        }
    }

    /**
     * Calculate the bounding box of a curved edge
     * @param piece - Parent track piece
     * @param edge - The curved edge
     * @returns Bounding box or null if calculation fails
     */
    private calculateArcBounds(
        piece: TrackPiece,
        edge: GraphEdge
    ): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
        try {
            const startConnector = piece.connectors.find(c => c.nodeId === edge.fromNodeId);
            const endConnector = piece.connectors.find(c => c.nodeId === edge.toNodeId);

            if (!startConnector?.worldPos || !startConnector?.worldForward || !endConnector?.worldPos) {
                return null;
            }

            const radius = edge.curve.arcRadiusM!;
            const angleDeg = edge.curve.arcAngleDeg!;
            const curveDir = edge.curve.arcDirection || piece.catalogEntry.curveDirection || 1;

            // Calculate arc center
            const perpendicular = new Vector3(
                startConnector.worldForward.z * curveDir,
                0,
                -startConnector.worldForward.x * curveDir
            );
            const arcCenter = startConnector.worldPos.add(perpendicular.scale(radius));

            let minX = Math.min(startConnector.worldPos.x, endConnector.worldPos.x);
            let maxX = Math.max(startConnector.worldPos.x, endConnector.worldPos.x);
            let minZ = Math.min(startConnector.worldPos.z, endConnector.worldPos.z);
            let maxZ = Math.max(startConnector.worldPos.z, endConnector.worldPos.z);

            // Sample points along arc
            const numSamples = 5;
            for (let i = 1; i < numSamples; i++) {
                const t = i / numSamples;
                const angle = (angleDeg * t * Math.PI / 180) * -curveDir;

                const startToCenter = startConnector.worldPos.subtract(arcCenter);
                const cosA = Math.cos(angle);
                const sinA = Math.sin(angle);
                const rotatedX = startToCenter.x * cosA - startToCenter.z * sinA;
                const rotatedZ = startToCenter.x * sinA + startToCenter.z * cosA;

                const pointX = arcCenter.x + rotatedX;
                const pointZ = arcCenter.z + rotatedZ;

                minX = Math.min(minX, pointX);
                maxX = Math.max(maxX, pointX);
                minZ = Math.min(minZ, pointZ);
                maxZ = Math.max(maxZ, pointZ);
            }

            return { minX, maxX, minZ, maxZ };

        } catch (error) {
            console.error(`${LOG_PREFIX} Error calculating arc bounds:`, error);
            return null;
        }
    }

    // ========================================================================
    // STANDARD EDGE RENDERING (Straight & Curve)
    // ========================================================================

    /**
     * Render a standard graph edge (straight or curved)
     * @param edge - Edge to render
     * @param piece - Parent track piece
     * @returns Array of created meshes
     */
    private renderStandardEdge(edge: GraphEdge, piece: TrackPiece): Mesh[] {
        const meshes: Mesh[] = [];

        try {
            // Get connector positions
            const connectorA = piece.connectors.find(c => c.nodeId === edge.fromNodeId);
            const connectorB = piece.connectors.find(c => c.nodeId === edge.toNodeId);

            if (!connectorA?.worldPos || !connectorB?.worldPos) {
                console.warn(`${LOG_PREFIX} Edge ${edge.id} missing connector positions`);
                return meshes;
            }

            const startPos = connectorA.worldPos;
            const endPos = connectorB.worldPos;

            // Generate track points based on curve type
            let trackPoints: TrackPoint[];

            if (edge.curve.type === 'straight') {
                trackPoints = this.generateStraightPoints(startPos, endPos);
            } else if (edge.curve.type === 'arc') {
                if (!edge.curve.arcRadiusM || !edge.curve.arcAngleDeg) {
                    console.warn(`${LOG_PREFIX} Arc edge ${edge.id} missing radius/angle`);
                    return meshes;
                }
                const direction = edge.curve.arcDirection || piece.catalogEntry.curveDirection || 1;
                trackPoints = this.generateArcPoints(
                    startPos,
                    endPos,
                    edge.curve.arcRadiusM,
                    edge.curve.arcAngleDeg,
                    direction
                );
            } else {
                console.warn(`${LOG_PREFIX} Unknown curve type for edge ${edge.id}`);
                return meshes;
            }

            // Render track components
            if (trackPoints.length >= 2) {
                // Render rails (parallel pair)
                const railMeshes = this.renderRailPair(trackPoints, edge.id, piece.id);
                meshes.push(...railMeshes);

                // Render sleepers
                const sleeperMeshes = this.renderSleepers(trackPoints, edge.id, piece.id);
                meshes.push(...sleeperMeshes);

                // Render ballast
                const ballastMesh = this.renderBallast(trackPoints, edge.id, piece.id);
                if (ballastMesh) meshes.push(ballastMesh);
            }

        } catch (error) {
            console.error(`${LOG_PREFIX} Error rendering standard edge ${edge.id}:`, error);
        }

        return meshes;
    }

    // ========================================================================
    // SWITCH RENDERING
    // ========================================================================

    /**
     * Render a switch/turnout with proper frog geometry
     * Creates V-shaped frog point where rails split
     * 
     * @param piece - Switch track piece
     * @param edges - The two edges (straight and diverging routes)
     * @returns Array of created meshes
     */
    private renderSwitch(piece: TrackPiece, edges: GraphEdge[]): Mesh[] {
        const meshes: Mesh[] = [];

        try {
            this.log(`Rendering switch ${piece.id}`);

            // Get connectors
            const commonConnector = piece.getConnector('COMMON');
            const straightConnector = piece.getConnector('STRAIGHT');
            const divergingConnector = piece.getConnector('DIVERGING');

            if (!commonConnector?.worldPos || !straightConnector?.worldPos || !divergingConnector?.worldPos) {
                console.error(`${LOG_PREFIX} Switch ${piece.id} missing connector positions`);
                return this.renderSwitchFallback(piece, edges);
            }

            // Find the straight and diverging edges
            const straightEdge = edges.find(e =>
                (e.fromNodeId === commonConnector.nodeId && e.toNodeId === straightConnector.nodeId) ||
                (e.toNodeId === commonConnector.nodeId && e.fromNodeId === straightConnector.nodeId)
            );
            const divergingEdge = edges.find(e =>
                (e.fromNodeId === commonConnector.nodeId && e.toNodeId === divergingConnector.nodeId) ||
                (e.toNodeId === commonConnector.nodeId && e.fromNodeId === divergingConnector.nodeId)
            );

            if (!straightEdge || !divergingEdge) {
                console.error(`${LOG_PREFIX} Switch ${piece.id} missing edges`);
                return this.renderSwitchFallback(piece, edges);
            }

            // Generate track points for both routes
            const straightPoints = this.generateStraightPoints(
                commonConnector.worldPos,
                straightConnector.worldPos
            );

            const divergingPoints = this.generateSwitchDivergingPoints(
                piece,
                commonConnector.worldPos,
                divergingConnector.worldPos,
                divergingEdge
            );

            // ================================================================
            // RENDER INDIVIDUAL RAILS (NOT PAIRS) FOR SWITCH
            // ================================================================

            // The switch has 4 distinct rails:
            // 1. Left stock rail (from common to straight, left side)
            // 2. Right stock rail (from common to straight, right side) - splits at frog
            // 3. Left closure rail (diverging route, left side) - splits from frog
            // 4. Right closure rail (diverging route, right side)

            const halfGauge = TRACK_VISUALS.GAUGE / 2;

            // Calculate frog point location (where rails split)
            // Frog is typically about 1/3 into the switch from common end
            const frogPointIndex = Math.floor(straightPoints.length * 0.35);
            const frogPoint = straightPoints[frogPointIndex];

            // === LEFT RAIL (continuous from common through to straight) ===
            const leftRailPath = straightPoints.map(p =>
                p.position.add(p.right.scale(-halfGauge))
            );
            const leftRail = this.createRailMesh(leftRailPath, `rail_L_${piece.id}_straight`);
            if (leftRail) meshes.push(leftRail);

            // === RIGHT RAIL (common to frog point) ===
            const rightStockPath = straightPoints.slice(0, frogPointIndex + 1).map(p =>
                p.position.add(p.right.scale(halfGauge))
            );
            const rightStockRail = this.createRailMesh(rightStockPath, `rail_R_stock_${piece.id}`);
            if (rightStockRail) meshes.push(rightStockRail);

            // === STRAIGHT ROUTE RAIL (frog to straight end, right side) ===
            const straightClosurePath = straightPoints.slice(frogPointIndex).map(p =>
                p.position.add(p.right.scale(halfGauge))
            );
            const straightClosureRail = this.createRailMesh(straightClosurePath, `rail_R_straight_${piece.id}`);
            if (straightClosureRail) meshes.push(straightClosureRail);

            // === DIVERGING ROUTE RAILS ===
            // Find the diverging point that corresponds to the frog location
            const divergeFrogIndex = Math.floor(divergingPoints.length * 0.35);

            // Diverging left rail (from frog onwards)
            const divergeLeftPath = divergingPoints.slice(divergeFrogIndex).map(p =>
                p.position.add(p.right.scale(-halfGauge))
            );
            const divergeLeftRail = this.createRailMesh(divergeLeftPath, `rail_L_diverge_${piece.id}`);
            if (divergeLeftRail) meshes.push(divergeLeftRail);

            // Diverging right rail (full length)
            const divergeRightPath = divergingPoints.map(p =>
                p.position.add(p.right.scale(halfGauge))
            );
            const divergeRightRail = this.createRailMesh(divergeRightPath, `rail_R_diverge_${piece.id}`);
            if (divergeRightRail) meshes.push(divergeRightRail);

            // === FROG POINT MESH ===
            const frogMesh = this.createFrogPoint(frogPoint, piece.id);
            if (frogMesh) meshes.push(frogMesh);

            // ================================================================
            // RENDER SHARED SLEEPERS AND BALLAST
            // ================================================================

            // Create combined sleeper positions (avoiding duplicates)
            const sleeperMeshes = this.renderSwitchSleepers(
                straightPoints,
                divergingPoints,
                piece.id
            );
            meshes.push(...sleeperMeshes);

            // Create combined ballast
            const ballastMesh = this.renderSwitchBallast(
                straightPoints,
                divergingPoints,
                piece.id
            );
            if (ballastMesh) meshes.push(ballastMesh);

            this.log(`Switch ${piece.id} rendered with ${meshes.length} meshes`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error rendering switch:`, error);
            return this.renderSwitchFallback(piece, edges);
        }

        return meshes;
    }

    /**
     * Fallback rendering for switch when detailed rendering fails
     */
    private renderSwitchFallback(piece: TrackPiece, edges: GraphEdge[]): Mesh[] {
        console.warn(`${LOG_PREFIX} Using fallback rendering for switch ${piece.id}`);
        const meshes: Mesh[] = [];
        for (const edge of edges) {
            const edgeMeshes = this.renderStandardEdge(edge, piece);
            meshes.push(...edgeMeshes);
        }
        return meshes;
    }

    /**
     * Generate track points for the diverging route of a switch
     */
    private generateSwitchDivergingPoints(
        piece: TrackPiece,
        startPos: Vector3,
        endPos: Vector3,
        edge: GraphEdge
    ): TrackPoint[] {
        try {
            if (edge.curve.type === 'arc' && edge.curve.arcRadiusM && edge.curve.arcAngleDeg) {
                const direction = edge.curve.arcDirection || piece.catalogEntry.curveDirection || 1;
                return this.generateArcPoints(
                    startPos,
                    endPos,
                    edge.curve.arcRadiusM,
                    edge.curve.arcAngleDeg,
                    direction
                );
            } else {
                return this.generateStraightPoints(startPos, endPos);
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error generating diverging points:`, error);
            return this.generateStraightPoints(startPos, endPos);
        }
    }

    /**
     * Create the V-shaped frog point mesh
     */
    private createFrogPoint(frogPoint: TrackPoint, pieceId: string): Mesh | null {
        try {
            // Create a small V-shaped mesh at the frog point
            const frogLength = TRACK_VISUALS.SWITCH_FROG_LENGTH;
            const frogWidth = TRACK_VISUALS.GAUGE * 0.6;

            const frog = MeshBuilder.CreateBox(
                `frog_${pieceId}`,
                {
                    width: frogWidth,
                    height: TRACK_VISUALS.RAIL_HEIGHT,
                    depth: frogLength
                },
                this.scene
            );

            if (!frog) return null;

            frog.position = frogPoint.position.clone();
            frog.position.y += TRACK_VISUALS.RAIL_HEIGHT / 2;

            // Rotate to align with track
            const angle = Math.atan2(frogPoint.forward.z, frogPoint.forward.x);
            frog.rotation.y = -angle + Math.PI / 2;

            if (this.materials.frog) {
                frog.material = this.materials.frog;
            }

            frog.isPickable = true;
            return frog;

        } catch (error) {
            console.error(`${LOG_PREFIX} Error creating frog point:`, error);
            return null;
        }
    }

    /**
     * Render sleepers for a switch (avoiding duplicates in shared area)
     */
    private renderSwitchSleepers(
        straightPoints: TrackPoint[],
        divergingPoints: TrackPoint[],
        pieceId: string
    ): Mesh[] {
        const meshes: Mesh[] = [];

        try {
            // Use the straight route for sleeper positions (they're shared)
            // But make sleepers wider to cover both routes where they diverge
            const totalLength = straightPoints[straightPoints.length - 1]?.distance || 0;
            const numSleepers = Math.max(2, Math.floor(totalLength / TRACK_VISUALS.SLEEPER_SPACING));

            for (let i = 0; i <= numSleepers; i++) {
                const t = i / numSleepers;
                const straightPoint = this.interpolateTrackPoint(straightPoints, t);
                const divergePoint = this.interpolateTrackPoint(divergingPoints, t);

                if (!straightPoint) continue;

                // Calculate sleeper width based on how far apart the routes are
                let sleeperLength = TRACK_VISUALS.SLEEPER_LENGTH;
                if (divergePoint) {
                    const separation = Vector3.Distance(straightPoint.position, divergePoint.position);
                    if (separation > 0.005) { // More than 5mm apart
                        sleeperLength = Math.max(sleeperLength, separation + TRACK_VISUALS.GAUGE + 0.010);
                    }
                }

                // Position sleeper between the two routes if they've diverged
                let sleeperPos = straightPoint.position.clone();
                if (divergePoint && t > 0.3) {
                    sleeperPos = Vector3.Lerp(straightPoint.position, divergePoint.position, 0.5);
                }

                const sleeper = this.createSleeperMeshAtPosition(
                    sleeperPos,
                    straightPoint.forward,
                    sleeperLength,
                    `sleeper_${pieceId}_${i}`
                );

                if (sleeper) {
                    meshes.push(sleeper);
                    this.stats.sleeperMeshes++;
                }
            }

        } catch (error) {
            console.error(`${LOG_PREFIX} Error rendering switch sleepers:`, error);
        }

        return meshes;
    }

    /**
     * Render ballast for a switch (covers both routes)
     */
    private renderSwitchBallast(
        straightPoints: TrackPoint[],
        divergingPoints: TrackPoint[],
        pieceId: string
    ): Mesh | null {
        try {
            // Create a wider ballast bed that covers both routes
            const halfWidth = TRACK_VISUALS.BALLAST_WIDTH / 2;

            // Build path arrays for outer edges
            const leftPath: Vector3[] = [];
            const rightPath: Vector3[] = [];

            const numPoints = Math.max(straightPoints.length, divergingPoints.length);

            for (let i = 0; i < numPoints; i++) {
                const t = i / (numPoints - 1);
                const straightPt = this.interpolateTrackPoint(straightPoints, t);
                const divergePt = this.interpolateTrackPoint(divergingPoints, t);

                if (!straightPt) continue;

                // Left edge follows straight route's left side
                const leftPos = straightPt.position.add(straightPt.right.scale(-halfWidth));
                leftPos.y -= TRACK_VISUALS.SLEEPER_HEIGHT + TRACK_VISUALS.BALLAST_HEIGHT / 2;
                leftPath.push(leftPos);

                // Right edge follows whichever route is further right
                let rightPos: Vector3;
                if (divergePt && t > 0.2) {
                    // Use diverging route's right side
                    rightPos = divergePt.position.add(divergePt.right.scale(halfWidth));
                } else {
                    // Use straight route's right side
                    rightPos = straightPt.position.add(straightPt.right.scale(halfWidth));
                }
                rightPos.y -= TRACK_VISUALS.SLEEPER_HEIGHT + TRACK_VISUALS.BALLAST_HEIGHT / 2;
                rightPath.push(rightPos);
            }

            if (leftPath.length < 2 || rightPath.length < 2) {
                return null;
            }

            const ballast = MeshBuilder.CreateRibbon(
                `ballast_${pieceId}`,
                {
                    pathArray: [leftPath, rightPath],
                    closePath: false,
                    closeArray: false,
                    sideOrientation: Mesh.DOUBLESIDE,
                    updatable: false
                },
                this.scene
            );

            if (ballast && this.materials.ballast) {
                ballast.material = this.materials.ballast;
                ballast.isPickable = true;
                this.stats.ballastMeshes++;
            }

            return ballast;

        } catch (error) {
            console.error(`${LOG_PREFIX} Error rendering switch ballast:`, error);
            return null;
        }
    }

    // ========================================================================
    // CURVED SWITCH RENDERING
    // ========================================================================

    /**
     * Render a curved switch (both routes are curved)
     * @param piece - Curved switch piece
     * @param edges - The two curved edges (inner and outer routes)
     * @returns Array of created meshes
     */
    private renderCurvedSwitch(piece: TrackPiece, edges: GraphEdge[]): Mesh[] {
        const meshes: Mesh[] = [];

        try {
            this.log(`Rendering curved switch ${piece.id}`);

            // Get connectors
            const commonConnector = piece.getConnector('COMMON');
            const innerConnector = piece.getConnector('INNER');
            const outerConnector = piece.getConnector('OUTER');

            if (!commonConnector?.worldPos || !innerConnector?.worldPos || !outerConnector?.worldPos) {
                console.error(`${LOG_PREFIX} Curved switch ${piece.id} missing connector positions`);
                return this.renderCurvedSwitchFallback(piece, edges);
            }

            // Find inner and outer edges
            const innerEdge = edges.find(e =>
                (e.fromNodeId === commonConnector.nodeId && e.toNodeId === innerConnector.nodeId) ||
                (e.toNodeId === commonConnector.nodeId && e.fromNodeId === innerConnector.nodeId)
            );
            const outerEdge = edges.find(e =>
                (e.fromNodeId === commonConnector.nodeId && e.toNodeId === outerConnector.nodeId) ||
                (e.toNodeId === commonConnector.nodeId && e.fromNodeId === outerConnector.nodeId)
            );

            if (!innerEdge || !outerEdge) {
                console.error(`${LOG_PREFIX} Curved switch ${piece.id} missing edges`);
                return this.renderCurvedSwitchFallback(piece, edges);
            }

            // Generate arc points for both routes
            const direction = piece.catalogEntry.curveDirection || 1;
            const radius = piece.catalogEntry.curveRadiusM || 0.438;

            const innerAngle = piece.catalogEntry.innerAngleDeg || 22.5;
            const outerAngle = piece.catalogEntry.outerAngleDeg || 33.75;

            const innerPoints = this.generateArcPoints(
                commonConnector.worldPos,
                innerConnector.worldPos,
                radius,
                innerAngle,
                direction
            );

            const outerPoints = this.generateArcPoints(
                commonConnector.worldPos,
                outerConnector.worldPos,
                radius,
                outerAngle,
                direction
            );

            // Render similar to regular switch but with curved paths
            const halfGauge = TRACK_VISUALS.GAUGE / 2;

            // Inner route rails
            const innerLeftPath = innerPoints.map(p => p.position.add(p.right.scale(-halfGauge)));
            const innerRightPath = innerPoints.map(p => p.position.add(p.right.scale(halfGauge)));

            const innerLeftRail = this.createRailMesh(innerLeftPath, `rail_L_inner_${piece.id}`);
            if (innerLeftRail) meshes.push(innerLeftRail);

            const innerRightRail = this.createRailMesh(innerRightPath, `rail_R_inner_${piece.id}`);
            if (innerRightRail) meshes.push(innerRightRail);

            // Outer route rails (only the portion beyond the split)
            const splitIndex = Math.floor(outerPoints.length * 0.4);

            const outerLeftPath = outerPoints.slice(splitIndex).map(p => p.position.add(p.right.scale(-halfGauge)));
            const outerRightPath = outerPoints.map(p => p.position.add(p.right.scale(halfGauge)));

            const outerLeftRail = this.createRailMesh(outerLeftPath, `rail_L_outer_${piece.id}`);
            if (outerLeftRail) meshes.push(outerLeftRail);

            const outerRightRail = this.createRailMesh(outerRightPath, `rail_R_outer_${piece.id}`);
            if (outerRightRail) meshes.push(outerRightRail);

            // Sleepers and ballast
            const sleeperMeshes = this.renderSwitchSleepers(innerPoints, outerPoints, piece.id);
            meshes.push(...sleeperMeshes);

            const ballastMesh = this.renderSwitchBallast(innerPoints, outerPoints, piece.id);
            if (ballastMesh) meshes.push(ballastMesh);

            this.log(`Curved switch ${piece.id} rendered with ${meshes.length} meshes`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error rendering curved switch:`, error);
            return this.renderCurvedSwitchFallback(piece, edges);
        }

        return meshes;
    }

    /**
     * Fallback rendering for curved switch
     */
    private renderCurvedSwitchFallback(piece: TrackPiece, edges: GraphEdge[]): Mesh[] {
        console.warn(`${LOG_PREFIX} Using fallback rendering for curved switch ${piece.id}`);
        const meshes: Mesh[] = [];
        for (const edge of edges) {
            const edgeMeshes = this.renderStandardEdge(edge, piece);
            meshes.push(...edgeMeshes);
        }
        return meshes;
    }

    // ========================================================================
    // CROSSING RENDERING
    // ========================================================================

    /**
     * Render a diamond crossing (two tracks crossing)
     * @param piece - Crossing track piece
     * @param edges - The two crossing edges
     * @returns Array of created meshes
     */
    private renderCrossing(piece: TrackPiece, edges: GraphEdge[]): Mesh[] {
        const meshes: Mesh[] = [];

        try {
            this.log(`Rendering crossing ${piece.id}`);

            // Get connectors for both tracks
            const a1 = piece.getConnector('A1');
            const a2 = piece.getConnector('A2');
            const b1 = piece.getConnector('B1');
            const b2 = piece.getConnector('B2');

            if (!a1?.worldPos || !a2?.worldPos || !b1?.worldPos || !b2?.worldPos) {
                console.error(`${LOG_PREFIX} Crossing ${piece.id} missing connector positions`);
                return this.renderCrossingFallback(piece, edges);
            }

            // Generate points for both tracks
            const trackAPoints = this.generateStraightPoints(a1.worldPos, a2.worldPos);
            const trackBPoints = this.generateStraightPoints(b1.worldPos, b2.worldPos);

            // Find intersection point
            const intersection = this.findTrackIntersection(
                a1.worldPos, a2.worldPos,
                b1.worldPos, b2.worldPos
            );

            const halfGauge = TRACK_VISUALS.GAUGE / 2;

            // Render Track A rails
            const trackALeft = trackAPoints.map(p => p.position.add(p.right.scale(-halfGauge)));
            const trackARight = trackAPoints.map(p => p.position.add(p.right.scale(halfGauge)));

            const railALeft = this.createRailMesh(trackALeft, `rail_A_L_${piece.id}`);
            if (railALeft) meshes.push(railALeft);

            const railARight = this.createRailMesh(trackARight, `rail_A_R_${piece.id}`);
            if (railARight) meshes.push(railARight);

            // Render Track B rails
            const trackBLeft = trackBPoints.map(p => p.position.add(p.right.scale(-halfGauge)));
            const trackBRight = trackBPoints.map(p => p.position.add(p.right.scale(halfGauge)));

            const railBLeft = this.createRailMesh(trackBLeft, `rail_B_L_${piece.id}`);
            if (railBLeft) meshes.push(railBLeft);

            const railBRight = this.createRailMesh(trackBRight, `rail_B_R_${piece.id}`);
            if (railBRight) meshes.push(railBRight);

            // Create crossing center piece
            if (intersection) {
                const crossingCenter = this.createCrossingCenter(intersection, piece.id);
                if (crossingCenter) meshes.push(crossingCenter);
            }

            // Sleepers (combined for both tracks)
            const sleeperMeshes = this.renderCrossingSleepers(trackAPoints, trackBPoints, piece.id);
            meshes.push(...sleeperMeshes);

            // Ballast (combined area)
            const ballastMesh = this.renderCrossingBallast(trackAPoints, trackBPoints, piece.id);
            if (ballastMesh) meshes.push(ballastMesh);

            this.log(`Crossing ${piece.id} rendered with ${meshes.length} meshes`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error rendering crossing:`, error);
            return this.renderCrossingFallback(piece, edges);
        }

        return meshes;
    }

    /**
     * Find intersection point of two track lines
     */
    private findTrackIntersection(
        a1: Vector3, a2: Vector3,
        b1: Vector3, b2: Vector3
    ): Vector3 | null {
        try {
            // 2D line intersection (in XZ plane)
            const x1 = a1.x, z1 = a1.z;
            const x2 = a2.x, z2 = a2.z;
            const x3 = b1.x, z3 = b1.z;
            const x4 = b2.x, z4 = b2.z;

            const denom = (x1 - x2) * (z3 - z4) - (z1 - z2) * (x3 - x4);
            if (Math.abs(denom) < 0.0001) {
                // Lines are parallel
                return null;
            }

            const t = ((x1 - x3) * (z3 - z4) - (z1 - z3) * (x3 - x4)) / denom;

            const x = x1 + t * (x2 - x1);
            const z = z1 + t * (z2 - z1);
            const y = (a1.y + a2.y) / 2;

            return new Vector3(x, y, z);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error finding intersection:`, error);
            return null;
        }
    }

    /**
     * Create the center piece of a diamond crossing
     */
    private createCrossingCenter(intersection: Vector3, pieceId: string): Mesh | null {
        try {
            const centerSize = TRACK_VISUALS.GAUGE * 1.5;

            const center = MeshBuilder.CreateBox(
                `crossing_center_${pieceId}`,
                {
                    width: centerSize,
                    height: TRACK_VISUALS.RAIL_HEIGHT,
                    depth: centerSize
                },
                this.scene
            );

            if (!center) return null;

            center.position = intersection.clone();
            center.position.y += TRACK_VISUALS.RAIL_HEIGHT / 2;

            if (this.materials.frog) {
                center.material = this.materials.frog;
            }

            center.isPickable = true;
            return center;

        } catch (error) {
            console.error(`${LOG_PREFIX} Error creating crossing center:`, error);
            return null;
        }
    }

    /**
     * Render sleepers for a crossing
     */
    private renderCrossingSleepers(
        trackAPoints: TrackPoint[],
        trackBPoints: TrackPoint[],
        pieceId: string
    ): Mesh[] {
        const meshes: Mesh[] = [];

        try {
            // Use track A for primary sleeper positions
            const totalLength = trackAPoints[trackAPoints.length - 1]?.distance || 0;
            const numSleepers = Math.max(2, Math.floor(totalLength / TRACK_VISUALS.SLEEPER_SPACING));

            for (let i = 0; i <= numSleepers; i++) {
                const t = i / numSleepers;
                const point = this.interpolateTrackPoint(trackAPoints, t);

                if (point) {
                    // Make sleepers extra long to cover crossing area
                    const sleeperLength = TRACK_VISUALS.SLEEPER_LENGTH * 1.5;

                    const sleeper = this.createSleeperMeshAtPosition(
                        point.position,
                        point.forward,
                        sleeperLength,
                        `sleeper_${pieceId}_${i}`
                    );

                    if (sleeper) {
                        meshes.push(sleeper);
                        this.stats.sleeperMeshes++;
                    }
                }
            }

        } catch (error) {
            console.error(`${LOG_PREFIX} Error rendering crossing sleepers:`, error);
        }

        return meshes;
    }

    /**
     * Render ballast for a crossing
     */
    private renderCrossingBallast(
        trackAPoints: TrackPoint[],
        trackBPoints: TrackPoint[],
        pieceId: string
    ): Mesh | null {
        try {
            // Create a square-ish ballast area covering both tracks
            const halfWidth = TRACK_VISUALS.BALLAST_WIDTH * 0.75;

            const leftPath = trackAPoints.map(p => {
                const pos = p.position.add(p.right.scale(-halfWidth));
                pos.y -= TRACK_VISUALS.SLEEPER_HEIGHT + TRACK_VISUALS.BALLAST_HEIGHT / 2;
                return pos;
            });

            const rightPath = trackAPoints.map(p => {
                const pos = p.position.add(p.right.scale(halfWidth));
                pos.y -= TRACK_VISUALS.SLEEPER_HEIGHT + TRACK_VISUALS.BALLAST_HEIGHT / 2;
                return pos;
            });

            if (leftPath.length < 2 || rightPath.length < 2) {
                return null;
            }

            const ballast = MeshBuilder.CreateRibbon(
                `ballast_${pieceId}`,
                {
                    pathArray: [leftPath, rightPath],
                    closePath: false,
                    closeArray: false,
                    sideOrientation: Mesh.DOUBLESIDE,
                    updatable: false
                },
                this.scene
            );

            if (ballast && this.materials.ballast) {
                ballast.material = this.materials.ballast;
                ballast.isPickable = true;
                this.stats.ballastMeshes++;
            }

            return ballast;

        } catch (error) {
            console.error(`${LOG_PREFIX} Error rendering crossing ballast:`, error);
            return null;
        }
    }

    /**
     * Fallback rendering for crossing
     */
    private renderCrossingFallback(piece: TrackPiece, edges: GraphEdge[]): Mesh[] {
        console.warn(`${LOG_PREFIX} Using fallback rendering for crossing ${piece.id}`);
        const meshes: Mesh[] = [];
        for (const edge of edges) {
            const edgeMeshes = this.renderStandardEdge(edge, piece);
            meshes.push(...edgeMeshes);
        }
        return meshes;
    }

    // ========================================================================
    // TRACK POINT GENERATION
    // ========================================================================

    /**
     * Generate track points for a straight section
     * @param start - Start position
     * @param end - End position
     * @returns Array of track points
     */
    private generateStraightPoints(start: Vector3, end: Vector3): TrackPoint[] {
        const points: TrackPoint[] = [];

        try {
            if (!start || !end) {
                console.error(`${LOG_PREFIX} generateStraightPoints: Invalid start/end`);
                return points;
            }

            const direction = end.subtract(start);
            const length = direction.length();

            if (length < 0.001) {
                console.warn(`${LOG_PREFIX} generateStraightPoints: Track too short`);
                return points;
            }

            const forward = direction.normalize();
            const right = Vector3.Cross(Vector3.Up(), forward).normalize();

            // Generate points at sleeper spacing intervals
            const numPoints = Math.max(2, Math.ceil(length / TRACK_VISUALS.SLEEPER_SPACING) + 1);

            for (let i = 0; i < numPoints; i++) {
                const t = i / (numPoints - 1);
                const distance = t * length;
                const position = Vector3.Lerp(start, end, t);

                points.push({
                    position,
                    forward: forward.clone(),
                    right: right.clone(),
                    distance
                });
            }

            this.log(`Generated ${points.length} straight points over ${(length * 1000).toFixed(0)}mm`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error generating straight points:`, error);
        }

        return points;
    }

    /**
     * Generate track points along a circular arc
     * Uses proper circular arc mathematics
     * 
     * @param start - Start position of arc
     * @param end - End position of arc
     * @param radius - Arc radius in meters
     * @param angleDeg - Arc angle in degrees
     * @param direction - 1 = left (CCW), -1 = right (CW)
     * @returns Array of track points along the arc
     */
    private generateArcPoints(
        start: Vector3,
        end: Vector3,
        radius: number,
        angleDeg: number,
        direction: 1 | -1
    ): TrackPoint[] {
        const points: TrackPoint[] = [];

        try {
            if (!start || !end) {
                console.error(`${LOG_PREFIX} generateArcPoints: Invalid start/end`);
                return this.generateStraightPoints(start, end);
            }

            if (radius <= 0 || angleDeg <= 0) {
                console.error(`${LOG_PREFIX} generateArcPoints: Invalid radius/angle`);
                return this.generateStraightPoints(start, end);
            }

            // Calculate the arc definition
            const arc = this.calculateArcFromEndpoints(start, end, radius, angleDeg, direction);

            if (!arc) {
                console.error(`${LOG_PREFIX} Failed to calculate arc definition`);
                return this.generateStraightPoints(start, end);
            }

            // Determine number of segments for smooth curve
            const numSegments = Math.max(
                TRACK_VISUALS.MIN_CURVE_SEGMENTS,
                Math.ceil(angleDeg / 45 * TRACK_VISUALS.CURVE_SEGMENTS_PER_45_DEG)
            );

            const totalAngle = arc.endAngle - arc.startAngle;
            const arcLength = Math.abs(radius * totalAngle);

            // Generate points along the arc
            for (let i = 0; i <= numSegments; i++) {
                const t = i / numSegments;
                const angle = arc.startAngle + t * totalAngle;
                const distance = t * arcLength;

                // Position on arc: center + radius * (cos(angle), 0, sin(angle))
                const position = new Vector3(
                    arc.center.x + radius * Math.cos(angle),
                    arc.center.y,
                    arc.center.z + radius * Math.sin(angle)
                );

                // Forward direction is tangent to circle (perpendicular to radius)
                const forward = new Vector3(
                    -direction * Math.sin(angle),
                    0,
                    direction * Math.cos(angle)
                ).normalize();

                // Right direction points toward/away from center
                const right = Vector3.Cross(Vector3.Up(), forward).normalize();

                points.push({ position, forward, right, distance });
            }

            this.log(`Generated ${points.length} arc points for ${angleDeg}° curve (R=${(radius * 1000).toFixed(0)}mm)`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error generating arc points:`, error);
            return this.generateStraightPoints(start, end);
        }

        return points;
    }

    /**
     * Calculate arc center and angles from start/end points
     * 
     * @param start - Arc start position
     * @param end - Arc end position
     * @param radius - Arc radius
     * @param angleDeg - Arc angle in degrees
     * @param direction - Curve direction (1=left/CCW, -1=right/CW)
     * @returns Arc definition or null if calculation fails
     */
    private calculateArcFromEndpoints(
        start: Vector3,
        end: Vector3,
        radius: number,
        angleDeg: number,
        direction: 1 | -1
    ): ArcDefinition | null {
        try {
            const angleRad = angleDeg * Math.PI / 180;

            // The chord vector from start to end
            const chord = end.subtract(start);
            const chordLength = chord.length();

            // Direction from start toward chord midpoint
            const chordDir = chord.normalize();
            const chordMidpoint = Vector3.Lerp(start, end, 0.5);

            // Perpendicular to chord in XZ plane (pointing toward arc center)
            const perpToChord = new Vector3(
                -direction * chordDir.z,
                0,
                direction * chordDir.x
            ).normalize();

            // Distance from chord midpoint to arc center
            const halfAngle = angleRad / 2;
            const distToCenter = radius * Math.cos(halfAngle);

            // Arc center position
            const center = chordMidpoint.add(perpToChord.scale(distToCenter));

            // Calculate start and end angles relative to center
            const startVec = start.subtract(center);
            const endVec = end.subtract(center);

            const startAngle = Math.atan2(startVec.z, startVec.x);
            let endAngle = Math.atan2(endVec.z, endVec.x);

            // Ensure angles are in correct order for the direction
            if (direction === 1) { // CCW - angle should increase
                while (endAngle < startAngle) endAngle += 2 * Math.PI;
            } else { // CW - angle should decrease
                while (endAngle > startAngle) endAngle -= 2 * Math.PI;
            }

            return {
                center,
                radius,
                startAngle,
                endAngle,
                direction
            };

        } catch (error) {
            console.error(`${LOG_PREFIX} Error calculating arc:`, error);
            return null;
        }
    }

    // ========================================================================
    // RAIL RENDERING
    // ========================================================================

    /**
     * Render a pair of rails along track points
     * @param points - Track points to follow
     * @param edgeId - Edge identifier for naming
     * @param pieceId - Piece identifier for naming
     * @returns Array of rail meshes
     */
    private renderRailPair(points: TrackPoint[], edgeId: string, pieceId: string): Mesh[] {
        const meshes: Mesh[] = [];

        if (points.length < 2) {
            console.warn(`${LOG_PREFIX} renderRailPair: Not enough points`);
            return meshes;
        }

        try {
            const halfGauge = TRACK_VISUALS.GAUGE / 2;

            // Generate left rail path (offset to the left)
            const leftRailPath = points.map(p =>
                p.position.add(p.right.scale(-halfGauge))
            );

            // Generate right rail path (offset to the right)
            const rightRailPath = points.map(p =>
                p.position.add(p.right.scale(halfGauge))
            );

            // Create left rail
            const leftRail = this.createRailMesh(
                leftRailPath,
                `rail_L_${pieceId}_${edgeId}`
            );
            if (leftRail) {
                meshes.push(leftRail);
                this.stats.railMeshes++;
            }

            // Create right rail
            const rightRail = this.createRailMesh(
                rightRailPath,
                `rail_R_${pieceId}_${edgeId}`
            );
            if (rightRail) {
                meshes.push(rightRail);
                this.stats.railMeshes++;
            }

        } catch (error) {
            console.error(`${LOG_PREFIX} Error rendering rail pair:`, error);
        }

        return meshes;
    }

    /**
     * Create a single rail mesh along a path
     * @param path - Array of positions for rail centerline
     * @param name - Mesh name
     * @returns Rail mesh or null if creation fails
     */
    private createRailMesh(path: Vector3[], name: string): Mesh | null {
        try {
            if (!path || path.length < 2) {
                console.warn(`${LOG_PREFIX} createRailMesh: Invalid path`);
                return null;
            }

            // Create rail as an extruded shape following the path
            const railProfile = this.createRailProfile();

            const rail = MeshBuilder.ExtrudeShape(name, {
                shape: railProfile,
                path: path,
                sideOrientation: Mesh.DOUBLESIDE,
                cap: Mesh.CAP_ALL,
                updatable: false
            }, this.scene);

            if (rail && this.materials.rail) {
                rail.material = this.materials.rail;
                rail.isPickable = true;
            }

            return rail;

        } catch (error) {
            console.error(`${LOG_PREFIX} Error creating rail mesh ${name}:`, error);
            return null;
        }
    }

    /**
     * Create the cross-section profile for rail extrusion
     * @returns Array of Vector3 points defining rail profile
     */
    private createRailProfile(): Vector3[] {
        const w = TRACK_VISUALS.RAIL_WIDTH / 2;
        const h = TRACK_VISUALS.RAIL_HEIGHT;

        // Simple rectangular profile for rail cross-section
        // Profile is in local YZ plane, extruded along X (path direction)
        return [
            new Vector3(0, 0, -w),
            new Vector3(0, h, -w),
            new Vector3(0, h, w),
            new Vector3(0, 0, w)
        ];
    }

    // ========================================================================
    // SLEEPER RENDERING
    // ========================================================================

    /**
     * Render sleepers along the track
     * @param points - Track points to place sleepers at
     * @param edgeId - Edge identifier for naming
     * @param pieceId - Piece identifier for naming
     * @returns Array of sleeper meshes
     */
    private renderSleepers(points: TrackPoint[], edgeId: string, pieceId: string): Mesh[] {
        const meshes: Mesh[] = [];

        if (points.length < 2) {
            console.warn(`${LOG_PREFIX} renderSleepers: Not enough points`);
            return meshes;
        }

        try {
            // Calculate total track length
            const totalLength = points[points.length - 1].distance;

            // Calculate number of sleepers
            const numSleepers = Math.max(2, Math.floor(totalLength / TRACK_VISUALS.SLEEPER_SPACING));

            for (let i = 0; i <= numSleepers; i++) {
                const t = i / numSleepers;

                // Interpolate position and direction from track points
                const point = this.interpolateTrackPoint(points, t);

                if (point) {
                    const sleeper = this.createSleeperMesh(
                        point,
                        `sleeper_${pieceId}_${edgeId}_${i}`
                    );
                    if (sleeper) {
                        meshes.push(sleeper);
                        this.stats.sleeperMeshes++;
                    }
                }
            }

        } catch (error) {
            console.error(`${LOG_PREFIX} Error rendering sleepers:`, error);
        }

        return meshes;
    }

    /**
     * Create a single sleeper mesh from a TrackPoint
     * @param point - Track point with position and orientation
     * @param name - Mesh name
     * @returns Sleeper mesh or null if creation fails
     */
    private createSleeperMesh(point: TrackPoint, name: string): Mesh | null {
        return this.createSleeperMeshAtPosition(
            point.position,
            point.forward,
            TRACK_VISUALS.SLEEPER_LENGTH,
            name
        );
    }

    /**
     * Create a sleeper mesh at a specific position with custom length
     * @param position - World position for sleeper center
     * @param forward - Track forward direction
     * @param length - Sleeper length (perpendicular to track)
     * @param name - Mesh name
     * @returns Sleeper mesh or null if creation fails
     */
    private createSleeperMeshAtPosition(
        position: Vector3,
        forward: Vector3,
        length: number,
        name: string
    ): Mesh | null {
        try {
            if (!position || !forward) {
                console.warn(`${LOG_PREFIX} createSleeperMeshAtPosition: Invalid inputs`);
                return null;
            }

            const sleeper = MeshBuilder.CreateBox(name, {
                width: length,                          // Perpendicular to track
                height: TRACK_VISUALS.SLEEPER_HEIGHT,   // Vertical thickness
                depth: TRACK_VISUALS.SLEEPER_WIDTH      // Along track direction
            }, this.scene);

            if (!sleeper) {
                console.error(`${LOG_PREFIX} Failed to create sleeper mesh`);
                return null;
            }

            // Position slightly below rail level
            sleeper.position = position.clone();
            sleeper.position.y -= TRACK_VISUALS.RAIL_HEIGHT / 2;

            // Rotate to align PERPENDICULAR to track direction
            // The sleeper's "depth" (local Z) should align with track forward
            // Use atan2(z, x) for Y-axis rotation in Babylon.js
            const angle = Math.atan2(forward.z, forward.x);
            sleeper.rotation.y = -angle + Math.PI / 2;  // +90° to make perpendicular

            if (this.materials.sleeper) {
                sleeper.material = this.materials.sleeper;
            }

            sleeper.isPickable = true;
            return sleeper;

        } catch (error) {
            console.error(`${LOG_PREFIX} Error creating sleeper ${name}:`, error);
            return null;
        }
    }

    /**
     * Interpolate a track point at a given parameter t (0-1)
     * @param points - Array of track points
     * @param t - Interpolation parameter (0 = start, 1 = end)
     * @returns Interpolated track point or null
     */
    private interpolateTrackPoint(points: TrackPoint[], t: number): TrackPoint | null {
        try {
            if (!points || points.length < 2) return null;
            if (t <= 0) return points[0];
            if (t >= 1) return points[points.length - 1];

            const totalDistance = points[points.length - 1].distance;
            const targetDistance = t * totalDistance;

            // Find the two points to interpolate between
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];

                if (targetDistance >= p1.distance && targetDistance <= p2.distance) {
                    const segmentLength = p2.distance - p1.distance;
                    const localT = segmentLength > 0
                        ? (targetDistance - p1.distance) / segmentLength
                        : 0;

                    return {
                        position: Vector3.Lerp(p1.position, p2.position, localT),
                        forward: Vector3.Lerp(p1.forward, p2.forward, localT).normalize(),
                        right: Vector3.Lerp(p1.right, p2.right, localT).normalize(),
                        distance: targetDistance
                    };
                }
            }

            return points[points.length - 1];

        } catch (error) {
            console.error(`${LOG_PREFIX} Error interpolating track point:`, error);
            return null;
        }
    }

    // ========================================================================
    // BALLAST RENDERING
    // ========================================================================

    /**
     * Render ballast bed along the track
     * @param points - Track points to follow
     * @param edgeId - Edge identifier for naming
     * @param pieceId - Piece identifier for naming
     * @returns Ballast mesh or null if creation fails
     */
    private renderBallast(points: TrackPoint[], edgeId: string, pieceId: string): Mesh | null {
        if (points.length < 2) {
            console.warn(`${LOG_PREFIX} renderBallast: Not enough points`);
            return null;
        }

        try {
            const halfWidth = TRACK_VISUALS.BALLAST_WIDTH / 2;

            // Create ballast as a ribbon following the track
            const leftPath = points.map(p => {
                const pos = p.position.add(p.right.scale(-halfWidth));
                pos.y -= TRACK_VISUALS.SLEEPER_HEIGHT + TRACK_VISUALS.BALLAST_HEIGHT / 2;
                return pos;
            });

            const rightPath = points.map(p => {
                const pos = p.position.add(p.right.scale(halfWidth));
                pos.y -= TRACK_VISUALS.SLEEPER_HEIGHT + TRACK_VISUALS.BALLAST_HEIGHT / 2;
                return pos;
            });

            const ballast = MeshBuilder.CreateRibbon(
                `ballast_${pieceId}_${edgeId}`,
                {
                    pathArray: [leftPath, rightPath],
                    closePath: false,
                    closeArray: false,
                    sideOrientation: Mesh.DOUBLESIDE,
                    updatable: false
                },
                this.scene
            );

            if (ballast && this.materials.ballast) {
                ballast.material = this.materials.ballast;
                ballast.isPickable = true;
                this.stats.ballastMeshes++;
            }

            return ballast;

        } catch (error) {
            console.error(`${LOG_PREFIX} Error rendering ballast:`, error);
            return null;
        }
    }

    // ========================================================================
    // UTILITY METHODS
    // ========================================================================

    /**
     * Log message if verbose logging is enabled
     * @param message - Message to log
     */
    private log(message: string): void {
        if (this.verboseLogging) {
            console.log(`${LOG_PREFIX} ${message}`);
        }
    }

    /**
     * Reset render statistics
     */
    private resetStats(): void {
        this.stats = {
            railMeshes: 0,
            sleeperMeshes: 0,
            ballastMeshes: 0,
            hitboxMeshes: 0,
            totalVertices: 0
        };
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Dispose all resources
     */
    public dispose(): void {
        try {
            console.log(`${LOG_PREFIX} Disposing...`);

            // Clear all meshes
            this.clear();

            // Dispose materials
            if (this.materials.rail) {
                this.materials.rail.dispose();
                this.materials.rail = null;
            }
            if (this.materials.sleeper) {
                this.materials.sleeper.dispose();
                this.materials.sleeper = null;
            }
            if (this.materials.ballast) {
                this.materials.ballast.dispose();
                this.materials.ballast = null;
            }
            if (this.materials.frog) {
                this.materials.frog.dispose();
                this.materials.frog = null;
            }

            console.log(`${LOG_PREFIX} Disposed successfully`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error disposing:`, error);
        }
    }
}