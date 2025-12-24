/**
 * TrackRenderer.ts - Renders track pieces with accurate geometry
 * 
 * Creates visual representation of track including:
 * - Rails (following true circular arcs for curves)
 * - Sleepers/ties (perpendicular to track direction)
 * - Ballast (gravel bed beneath track)
 * 
 * Key features:
 * - Proper circular arc mathematics for curved track
 * - Accurate Hornby OO gauge dimensions
 * - Smooth curve rendering with configurable segment count
 * 
 * @module TrackRenderer
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

    // Rendering quality
    CURVE_SEGMENTS_PER_45_DEG: 8,  // Number of segments per 45° of curve
    MIN_CURVE_SEGMENTS: 4,          // Minimum segments for any curve
} as const;

/**
 * Material colors for track components
 */
const TRACK_COLORS = {
    RAIL: new Color3(0.05, 0.05, 0.05),         // Black rails
    RAIL_SPECULAR: new Color3(0.15, 0.15, 0.15), // Subtle metallic shine
    SLEEPER: new Color3(0.35, 0.25, 0.18),      // Dark brown wood
    BALLAST: new Color3(0.45, 0.45, 0.48),      // Grey gravel
} as const;

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

// ============================================================================
// TRACK RENDERER CLASS
// ============================================================================

/**
 * TrackRenderer - Creates visual meshes for track pieces
 * 
 * Handles both straight and curved track with proper geometry:
 * - Straight track: Simple linear extrusion
 * - Curved track: True circular arc mathematics
 * 
 * @example
 * ```typescript
 * const renderer = new TrackRenderer(scene);
 * renderer.renderPiece(trackPiece, edges);
 * ```
 */
export class TrackRenderer {
    /** Babylon.js scene reference */
    private scene: Scene;

    /** Map of piece ID to rendered meshes */
    private meshes: Map<string, Mesh[]> = new Map();

    /** Cached materials for reuse */
    private materials: {
        rail: StandardMaterial | null;
        sleeper: StandardMaterial | null;
        ballast: StandardMaterial | null;
    } = { rail: null, sleeper: null, ballast: null };

    // ========================================================================
    // CONSTRUCTOR & INITIALIZATION
    // ========================================================================

    /**
     * Create a new TrackRenderer
     * @param scene - Babylon.js scene to render into
     * @throws Error if scene is not provided
     */
    constructor(scene: Scene) {
        if (!scene) {
            throw new Error('[TrackRenderer] Scene is required');
        }
        this.scene = scene;
        this.initializeMaterials();
        console.log('[TrackRenderer] Created with OO gauge specifications');
    }

    /**
     * Initialize reusable materials for track components
     */
    private initializeMaterials(): void {
        try {
            // Rail material - black metal
            this.materials.rail = new StandardMaterial('trackRailMat', this.scene);
            this.materials.rail.diffuseColor = TRACK_COLORS.RAIL;
            this.materials.rail.specularColor = TRACK_COLORS.RAIL_SPECULAR;
            this.materials.rail.ambientColor = new Color3(0, 0, 0);    // No ambient
            this.materials.rail.emissiveColor = new Color3(0, 0, 0);   // No glow
            this.materials.rail.roughness = 0.8;
            this.materials.rail.specularPower = 32;

            // Sleeper material - matte wood
            this.materials.sleeper = new StandardMaterial('trackSleeperMat', this.scene);
            this.materials.sleeper.diffuseColor = TRACK_COLORS.SLEEPER;
            this.materials.sleeper.specularColor = new Color3(0.05, 0.05, 0.05);
            this.materials.sleeper.ambientColor = new Color3(0, 0, 0);
            this.materials.sleeper.emissiveColor = new Color3(0, 0, 0);
            this.materials.sleeper.roughness = 0.95;

            // Ballast material - rough gravel
            this.materials.ballast = new StandardMaterial('trackBallastMat', this.scene);
            this.materials.ballast.diffuseColor = TRACK_COLORS.BALLAST;
            this.materials.ballast.specularColor = new Color3(0.02, 0.02, 0.02);
            this.materials.ballast.ambientColor = new Color3(0, 0, 0);
            this.materials.ballast.emissiveColor = new Color3(0, 0, 0);
            this.materials.ballast.roughness = 1.0;

            console.log('[TrackRenderer] Materials initialized');
        } catch (error) {
            console.error('[TrackRenderer] Error initializing materials:', error);
        }
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /**
     * Render a track piece with all its edges
     * @param piece - Track piece to render
     * @param edges - Graph edges belonging to this piece
     */
    renderPiece(piece: TrackPiece, edges: GraphEdge[]): void {
        try {
            if (!piece) {
                console.error('[TrackRenderer] renderPiece: piece is null');
                return;
            }

            if (!edges || edges.length === 0) {
                console.warn(`[TrackRenderer] No edges to render for piece ${piece.id}`);
                return;
            }

            // Remove existing meshes for this piece
            this.removePiece(piece.id);

            const pieceMeshes: Mesh[] = [];

            // Create invisible hitbox for easier selection
            const hitbox = this.createHitbox(piece, edges);
            if (hitbox) {
                pieceMeshes.push(hitbox);
            }

            // Render each edge
            for (const edge of edges) {
                try {
                    const edgeMeshes = this.renderEdge(edge, piece);
                    pieceMeshes.push(...edgeMeshes);
                } catch (error) {
                    console.error(`[TrackRenderer] Error rendering edge ${edge.id}:`, error);
                }
            }

            // Store meshes
            if (pieceMeshes.length > 0) {
                this.meshes.set(piece.id, pieceMeshes);
                console.log(`[TrackRenderer] Rendered piece ${piece.id}: ${pieceMeshes.length} meshes`);
            }
        } catch (error) {
            console.error('[TrackRenderer] Error in renderPiece:', error);
        }
    }

    /**
     * Create an invisible hitbox mesh for easier piece selection
     * The hitbox is a flat box that covers the entire track piece area
     * For curves, it also considers the arc bulge
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
                    const startConnector = piece.connectors.find(c => c.nodeId === edge.fromNodeId);
                    const endConnector = piece.connectors.find(c => c.nodeId === edge.toNodeId);

                    if (startConnector?.worldPos && startConnector?.worldForward &&
                        endConnector?.worldPos) {
                        // Sample a few points along the curve
                        const numSamples = 5;
                        const angleDeg = edge.curve.arcAngleDeg;
                        const radius = edge.curve.arcRadiusM;

                        // Determine curve direction from catalog entry
                        const curveDir = piece.catalogEntry.curveDirection || 1;

                        // Calculate arc center
                        const perpendicular = new Vector3(
                            startConnector.worldForward.z * curveDir,
                            0,
                            -startConnector.worldForward.x * curveDir
                        );
                        const arcCenter = startConnector.worldPos.add(perpendicular.scale(radius));

                        // Sample points along arc
                        for (let i = 1; i < numSamples; i++) {
                            const t = i / numSamples;
                            const angle = (angleDeg * t * Math.PI / 180) * -curveDir;

                            // Calculate point on arc
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
                    }
                }
            }

            // Add padding for easier clicking (30mm each side)
            const padding = 0.030;
            minX -= padding;
            maxX += padding;
            minZ -= padding;
            maxZ += padding;

            // Ensure minimum size (for straight tracks that are thin)
            const width = Math.max(maxX - minX, 0.050);  // At least 50mm
            const depth = Math.max(maxZ - minZ, 0.050);  // At least 50mm

            const centerX = (minX + maxX) / 2;
            const centerZ = (minZ + maxZ) / 2;

            // Create hitbox mesh
            const hitbox = MeshBuilder.CreateBox(
                `hitbox_${piece.id}`,
                {
                    width: width,
                    height: 0.015,  // 15mm tall - enough to catch clicks
                    depth: depth
                },
                this.scene
            );

            // Position at piece center, slightly above track
            hitbox.position = new Vector3(centerX, centerY + 0.005, centerZ);

            // Make invisible but pickable
            hitbox.visibility = 0;  // Completely invisible
            hitbox.isPickable = true;

            // Ensure bounding info is computed
            hitbox.refreshBoundingInfo();

            return hitbox;
        } catch (error) {
            console.error('[TrackRenderer] Error creating hitbox:', error);
            return null;
        }
    }

    /**
     * Remove rendered meshes for a piece
     * @param pieceId - ID of piece to remove
     */
    removePiece(pieceId: string): void {
        try {
            const pieceMeshes = this.meshes.get(pieceId);
            if (pieceMeshes) {
                pieceMeshes.forEach(mesh => {
                    try {
                        mesh.dispose();
                    } catch (error) {
                        console.error('[TrackRenderer] Error disposing mesh:', error);
                    }
                });
                this.meshes.delete(pieceId);
                console.log(`[TrackRenderer] Removed piece ${pieceId}`);
            }
        } catch (error) {
            console.error('[TrackRenderer] Error in removePiece:', error);
        }
    }

    /**
     * Clear all rendered track
     */
    clear(): void {
        try {
            for (const [pieceId, meshes] of this.meshes) {
                meshes.forEach(mesh => {
                    try {
                        mesh.dispose();
                    } catch (error) {
                        console.error('[TrackRenderer] Error disposing mesh:', error);
                    }
                });
            }
            this.meshes.clear();
            console.log('[TrackRenderer] Cleared all track meshes');
        } catch (error) {
            console.error('[TrackRenderer] Error in clear:', error);
        }
    }

    /**
     * Get total mesh count (for debugging)
     * @returns Number of meshes currently rendered
     */
    getMeshCount(): number {
        let count = 0;
        for (const meshes of this.meshes.values()) {
            count += meshes.length;
        }
        return count;
    }

    // ========================================================================
    // EDGE RENDERING
    // ========================================================================

    /**
     * Render a single graph edge (straight or curved)
     * @param edge - Edge to render
     * @param piece - Parent track piece
     * @returns Array of created meshes
     */
    private renderEdge(edge: GraphEdge, piece: TrackPiece): Mesh[] {
        const meshes: Mesh[] = [];

        try {
            // Get connector positions
            const connectorA = piece.connectors.find(c => c.nodeId === edge.fromNodeId);
            const connectorB = piece.connectors.find(c => c.nodeId === edge.toNodeId);

            if (!connectorA?.worldPos || !connectorB?.worldPos) {
                console.warn(`[TrackRenderer] Edge ${edge.id} missing connector positions`);
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
                    console.warn(`[TrackRenderer] Arc edge ${edge.id} missing radius/angle`);
                    return meshes;
                }
                // Get direction from edge curve definition, fallback to catalog, then default to left (1)
                const direction = edge.curve.arcDirection || piece.catalogEntry.curveDirection || 1;
                trackPoints = this.generateArcPoints(
                    startPos,
                    endPos,
                    edge.curve.arcRadiusM,
                    edge.curve.arcAngleDeg,
                    direction
                );
            } else {
                console.warn(`[TrackRenderer] Unknown curve type for edge ${edge.id}`);
                return meshes;
            }

            // Render track components using the generated points
            if (trackPoints.length >= 2) {
                // Render rails
                const railMeshes = this.renderRails(trackPoints, edge.id, piece.id);
                meshes.push(...railMeshes);

                // Render sleepers
                const sleeperMeshes = this.renderSleepers(trackPoints, edge.id, piece.id);
                meshes.push(...sleeperMeshes);

                // Render ballast
                const ballastMesh = this.renderBallast(trackPoints, edge.id, piece.id);
                if (ballastMesh) meshes.push(ballastMesh);
            }

        } catch (error) {
            console.error(`[TrackRenderer] Error rendering edge ${edge.id}:`, error);
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
        const direction = end.subtract(start);
        const length = direction.length();
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

        return points;
    }

    /**
     * Generate track points along a circular arc
     * 
     * This is the key function for accurate curved track rendering.
     * Uses proper circular arc mathematics instead of linear interpolation.
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
            // Calculate the arc definition
            const arc = this.calculateArcFromEndpoints(start, end, radius, angleDeg, direction);

            if (!arc) {
                console.error('[TrackRenderer] Failed to calculate arc');
                return this.generateStraightPoints(start, end); // Fallback
            }

            // Determine number of segments for smooth curve
            const numSegments = Math.max(
                TRACK_VISUALS.MIN_CURVE_SEGMENTS,
                Math.ceil(angleDeg / 45 * TRACK_VISUALS.CURVE_SEGMENTS_PER_45_DEG)
            );

            const totalAngle = (arc.endAngle - arc.startAngle);
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
                // For CCW: tangent = (-sin(angle), 0, cos(angle))
                // For CW: tangent = (sin(angle), 0, -cos(angle))
                const forward = new Vector3(
                    -direction * Math.sin(angle),
                    0,
                    direction * Math.cos(angle)
                ).normalize();

                // Right direction points toward/away from center
                const right = Vector3.Cross(Vector3.Up(), forward).normalize();

                points.push({ position, forward, right, distance });
            }

            console.log(`[TrackRenderer] Generated ${points.length} arc points for ${angleDeg}° curve`);

        } catch (error) {
            console.error('[TrackRenderer] Error generating arc points:', error);
            return this.generateStraightPoints(start, end); // Fallback
        }

        return points;
    }

    /**
     * Calculate arc center and angles from start/end points
     * 
     * Given two endpoints, radius, and curve direction, calculate
     * the center point and start/end angles for the arc.
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

            // For a circular arc, the chord length relates to radius and angle by:
            // chord = 2 * radius * sin(angle/2)
            // We can verify this matches, but we'll use the geometric approach

            // Direction from start toward chord midpoint
            const chordDir = chord.normalize();
            const chordMidpoint = Vector3.Lerp(start, end, 0.5);

            // Perpendicular to chord in XZ plane (pointing toward arc center)
            // For left curve (CCW), center is to the left of the chord direction
            // For right curve (CW), center is to the right of the chord direction
            const perpToChord = new Vector3(
                -direction * chordDir.z,
                0,
                direction * chordDir.x
            ).normalize();

            // Distance from chord midpoint to arc center
            // Using: d = radius * cos(angle/2) for the sagitta relationship
            // Actually: distance from midpoint to center = radius * cos(angle/2) when angle < 180
            // For angle > 180, the center is on the opposite side

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
            console.error('[TrackRenderer] Error calculating arc:', error);
            return null;
        }
    }

    // ========================================================================
    // RAIL RENDERING
    // ========================================================================

    /**
     * Render both rails along the track points
     * @param points - Track points to follow
     * @param edgeId - Edge identifier for naming
     * @param pieceId - Piece identifier for naming
     * @returns Array of rail meshes
     */
    private renderRails(points: TrackPoint[], edgeId: string, pieceId: string): Mesh[] {
        const meshes: Mesh[] = [];

        if (points.length < 2) return meshes;

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
            if (leftRail) meshes.push(leftRail);

            // Create right rail
            const rightRail = this.createRailMesh(
                rightRailPath,
                `rail_R_${pieceId}_${edgeId}`
            );
            if (rightRail) meshes.push(rightRail);

        } catch (error) {
            console.error('[TrackRenderer] Error rendering rails:', error);
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
            if (path.length < 2) return null;

            // Create rail as a tube/ribbon following the path
            // For better performance, use ExtrudeShape with a rail profile
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
            console.error(`[TrackRenderer] Error creating rail mesh ${name}:`, error);
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

        if (points.length < 2) return meshes;

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
                    if (sleeper) meshes.push(sleeper);
                }
            }

        } catch (error) {
            console.error('[TrackRenderer] Error rendering sleepers:', error);
        }

        return meshes;
    }

    /**
     * Create a single sleeper mesh
     * @param point - Track point with position and orientation
     * @param name - Mesh name
     * @returns Sleeper mesh or null if creation fails
     */
    private createSleeperMesh(point: TrackPoint, name: string): Mesh | null {
        try {
            const sleeper = MeshBuilder.CreateBox(name, {
                width: TRACK_VISUALS.SLEEPER_LENGTH,   // Perpendicular to track
                height: TRACK_VISUALS.SLEEPER_HEIGHT,  // Vertical thickness
                depth: TRACK_VISUALS.SLEEPER_WIDTH     // Along track direction
            }, this.scene);

            if (!sleeper) return null;

            // Position slightly below rail level
            sleeper.position = point.position.clone();
            sleeper.position.y -= TRACK_VISUALS.RAIL_HEIGHT / 2;

            // Rotate to align with track direction
            // The sleeper's "depth" (local Z) should align with track forward
            // The sleeper's "width" (local X) should align with track right
            const angle = Math.atan2(point.forward.x, point.forward.z);
            sleeper.rotation.y = angle;

            if (this.materials.sleeper) {
                sleeper.material = this.materials.sleeper;
            }

            sleeper.isPickable = true;
            return sleeper;

        } catch (error) {
            console.error(`[TrackRenderer] Error creating sleeper ${name}:`, error);
            return null;
        }
    }

    /**
     * Interpolate a track point at a given parameter t (0-1)
     * @param points - Array of track points
     * @param t - Interpolation parameter (0 = start, 1 = end)
     * @returns Interpolated track point
     */
    private interpolateTrackPoint(points: TrackPoint[], t: number): TrackPoint | null {
        if (points.length < 2) return null;
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
        if (points.length < 2) return null;

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
            }

            return ballast;

        } catch (error) {
            console.error('[TrackRenderer] Error rendering ballast:', error);
            return null;
        }
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

            // Dispose materials
            this.materials.rail?.dispose();
            this.materials.sleeper?.dispose();
            this.materials.ballast?.dispose();

            console.log('[TrackRenderer] Disposed');
        } catch (error) {
            console.error('[TrackRenderer] Error disposing:', error);
        }
    }
}