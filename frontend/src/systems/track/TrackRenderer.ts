/**
 * TrackRenderer.ts - Renders track pieces visually
 * 
 * Creates:
 * - Rails (extruded along track edges, following curves)
 * - Sleepers/ties (instanced cross pieces, radial on curves)
 * - Ballast (gravel bed)
 * 
 * Based on OO gauge specifications (1:76.2 scale, 16.5mm gauge)
 */

import { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TrackPiece } from './TrackPiece';
import type { GraphEdge } from './TrackGraph';
import { ArcMath, type ArcDefinition } from './ArcMath';

export class TrackRenderer {
    private scene: Scene;
    private meshes: Map<string, Mesh[]> = new Map();

    // Visual parameters (OO gauge scale)
    private readonly RAIL_WIDTH = 0.003;      // 3mm rail width
    private readonly RAIL_HEIGHT = 0.004;     // 4mm rail height
    private readonly GAUGE = 0.0165;          // 16.5mm track gauge (OO standard)
    private readonly SLEEPER_WIDTH = 0.025;   // 25mm sleeper width
    private readonly SLEEPER_DEPTH = 0.003;   // 3mm sleeper depth
    private readonly SLEEPER_THICKNESS = 0.002; // 2mm sleeper thickness
    private readonly SLEEPER_SPACING = 0.012; // 12mm between sleepers

    constructor(scene: Scene) {
        if (!scene) {
            throw new Error('[TrackRenderer] Scene is required');
        }
        this.scene = scene;
        console.log('[TrackRenderer] Created');
    }

    /**
     * Render a track piece
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
                console.log(`[TrackRenderer] Rendered piece ${piece.id} with ${pieceMeshes.length} meshes`);
            }
        } catch (error) {
            console.error('[TrackRenderer] Error in renderPiece:', error);
        }
    }

    /**
     * Render a single edge (straight or curved)
     */
    /**
    * Render a single edge (straight or curved)
    */
    private renderEdge(edge: GraphEdge, piece: TrackPiece): Mesh[] {
        const meshes: Mesh[] = [];

        try {
            // Get start and end positions from connectors
            const connectorA = piece.connectors.find(c => c.nodeId === edge.fromNodeId);
            const connectorB = piece.connectors.find(c => c.nodeId === edge.toNodeId);

            if (!connectorA?.worldPos || !connectorB?.worldPos) {
                console.warn(`[TrackRenderer] Edge ${edge.id} missing connector positions`);
                return meshes;
            }

            if (!connectorA?.worldForward || !connectorB?.worldForward) {
                console.warn(`[TrackRenderer] Edge ${edge.id} missing connector forward vectors`);
                return meshes;
            }

            const startPos = connectorA.worldPos;
            const endPos = connectorB.worldPos;
            const startForward = connectorA.worldForward;
            const endForward = connectorB.worldForward;

            if (edge.curve.type === 'straight') {
                // Render straight track
                meshes.push(...this.renderStraightTrack(startPos, endPos, edge.id));
            } else if (edge.curve.type === 'arc') {
                // FOR SWITCHES: Use simplified straight rendering
                if (piece.isSwitch) {
                    console.log(`[TrackRenderer] Rendering switch diverging route as straight segments`);
                    meshes.push(...this.renderStraightTrack(startPos, endPos, edge.id));
                } else {
                    // For CURVES: Use proper arc rendering
                    if (edge.curve.arcRadiusM && edge.curve.arcAngleDeg) {
                        meshes.push(...this.renderCurvedTrack(
                            startPos,
                            startForward,
                            endPos,
                            endForward,
                            edge.curve.arcRadiusM,
                            edge.curve.arcAngleDeg,
                            edge.id
                        ));
                    }
                }
            }
        } catch (error) {
            console.error(`[TrackRenderer] Error rendering edge ${edge.id}:`, error);
        }

        return meshes;
    }

    /**
     * Render straight track section
     */
    private renderStraightTrack(start: Vector3, end: Vector3, edgeId: string): Mesh[] {
        const meshes: Mesh[] = [];

        try {
            const direction = end.subtract(start);
            const length = direction.length();
            const center = Vector3.Lerp(start, end, 0.5);

            // Calculate perpendicular for gauge offset
            const forward = direction.normalize();
            const perpendicular = Vector3.Cross(Vector3.Up(), forward).normalize();

            // Create two rails
            const rail1Offset = perpendicular.scale(this.GAUGE / 2);
            const rail2Offset = perpendicular.scale(-this.GAUGE / 2);

            // Left rail
            const rail1 = this.createRailMesh(
                start.add(rail1Offset),
                end.add(rail1Offset),
                `rail1_${edgeId}`
            );
            if (rail1) meshes.push(rail1);

            // Right rail
            const rail2 = this.createRailMesh(
                start.add(rail2Offset),
                end.add(rail2Offset),
                `rail2_${edgeId}`
            );
            if (rail2) meshes.push(rail2);

            // Create sleepers
            const sleeperCount = Math.floor(length / this.SLEEPER_SPACING);
            for (let i = 0; i <= sleeperCount; i++) {
                const t = i / sleeperCount;
                const sleeperPos = Vector3.Lerp(start, end, t);
                const sleeper = this.createSleeperMesh(sleeperPos, forward, `sleeper_${edgeId}_${i}`);
                if (sleeper) meshes.push(sleeper);
            }

            // Create ballast
            const ballast = this.createBallastMesh(start, end, forward, `ballast_${edgeId}`);
            if (ballast) meshes.push(ballast);

        } catch (error) {
            console.error('[TrackRenderer] Error in renderStraightTrack:', error);
        }

        return meshes;
    }

    /**
     * Render curved track section with PROPER CIRCULAR ARC
     */
    private renderCurvedTrack(
        start: Vector3,
        startForward: Vector3,
        end: Vector3,
        endForward: Vector3,
        radius: number,
        angleDeg: number,
        edgeId: string
    ): Mesh[] {
        const meshes: Mesh[] = [];

        try {
            console.log(`[TrackRenderer] Rendering curved track:`);
            console.log(`  Start: (${start.x.toFixed(3)}, ${start.z.toFixed(3)})`);
            console.log(`  End: (${end.x.toFixed(3)}, ${end.z.toFixed(3)})`);
            console.log(`  Radius: ${radius.toFixed(3)}m, Angle: ${angleDeg}°`);

            // Calculate arc center using tangent vectors
            const arc = ArcMath.calculateArcCenter(
                start,
                startForward,
                end,
                endForward,
                radius
            );

            if (!arc) {
                console.error('[TrackRenderer] Failed to calculate arc center, using straight approximation');
                return this.renderStraightTrack(start, end, edgeId);
            }

            // Generate points along the arc
            const numSegments = Math.max(8, Math.ceil(angleDeg / 3)); // ~3° per segment
            const centerlinePoints = ArcMath.generateArcPoints(arc, numSegments);

            if (centerlinePoints.length < 2) {
                console.error('[TrackRenderer] Not enough arc points generated');
                return meshes;
            }

            console.log(`[TrackRenderer] Generated ${centerlinePoints.length} points along arc`);

            // Render rails along the arc
            meshes.push(...this.renderCurvedRails(centerlinePoints, arc, edgeId));

            // Render sleepers (radial, pointing toward center)
            meshes.push(...this.renderCurvedSleepers(centerlinePoints, arc, edgeId));

            // Render ballast
            meshes.push(...this.renderCurvedBallast(centerlinePoints, arc, edgeId));

        } catch (error) {
            console.error('[TrackRenderer] Error in renderCurvedTrack:', error);
        }

        return meshes;
    }

    /**
     * Render rails along a curved path
     */
    private renderCurvedRails(centerlinePoints: Vector3[], arc: ArcDefinition, edgeId: string): Mesh[] {
        const meshes: Mesh[] = [];

        try {
            // For each segment, create rail pieces offset from centerline
            for (let i = 0; i < centerlinePoints.length - 1; i++) {
                const p1 = centerlinePoints[i];
                const p2 = centerlinePoints[i + 1];

                // Tangent at this segment
                const tangent = p2.subtract(p1).normalize();

                // Perpendicular (for gauge offset)
                const perpendicular = ArcMath.getPerpendicular(tangent, true);

                // Left and right rail positions
                const rail1Start = p1.add(perpendicular.scale(this.GAUGE / 2));
                const rail1End = p2.add(perpendicular.scale(this.GAUGE / 2));
                const rail2Start = p1.add(perpendicular.scale(-this.GAUGE / 2));
                const rail2End = p2.add(perpendicular.scale(-this.GAUGE / 2));

                // Create rail segments
                const rail1 = this.createRailMesh(rail1Start, rail1End, `rail1_${edgeId}_${i}`);
                const rail2 = this.createRailMesh(rail2Start, rail2End, `rail2_${edgeId}_${i}`);

                if (rail1) meshes.push(rail1);
                if (rail2) meshes.push(rail2);
            }
        } catch (error) {
            console.error('[TrackRenderer] Error rendering curved rails:', error);
        }

        return meshes;
    }

    /**
     * Render sleepers along a curved path (radial - pointing toward center)
     */
    private renderCurvedSleepers(centerlinePoints: Vector3[], arc: ArcDefinition, edgeId: string): Mesh[] {
        const meshes: Mesh[] = [];

        try {
            // Calculate total arc length
            let arcLength = 0;
            for (let i = 0; i < centerlinePoints.length - 1; i++) {
                arcLength += Vector3.Distance(centerlinePoints[i], centerlinePoints[i + 1]);
            }

            const sleeperCount = Math.floor(arcLength / this.SLEEPER_SPACING);

            // Place sleepers along arc
            for (let i = 0; i <= sleeperCount; i++) {
                const t = i / sleeperCount;
                const pointIndex = Math.floor(t * (centerlinePoints.length - 1));
                const sleeperPos = centerlinePoints[pointIndex];

                // Direction from center to sleeper (radial direction)
                const radialDir = sleeperPos.subtract(arc.center).normalize();

                // Sleeper is perpendicular to radial direction
                // So it's tangent to the arc
                const sleeperDir = ArcMath.getPerpendicular(radialDir, false);

                const sleeper = this.createSleeperMesh(sleeperPos, sleeperDir, `sleeper_${edgeId}_${i}`);
                if (sleeper) meshes.push(sleeper);
            }
        } catch (error) {
            console.error('[TrackRenderer] Error rendering curved sleepers:', error);
        }

        return meshes;
    }

    /**
     * Render ballast along a curved path
     */
    private renderCurvedBallast(centerlinePoints: Vector3[], arc: ArcDefinition, edgeId: string): Mesh[] {
        const meshes: Mesh[] = [];

        try {
            // Create ballast segments between points
            for (let i = 0; i < centerlinePoints.length - 1; i++) {
                const p1 = centerlinePoints[i];
                const p2 = centerlinePoints[i + 1];
                const tangent = p2.subtract(p1).normalize();

                const ballast = this.createBallastMesh(p1, p2, tangent, `ballast_${edgeId}_${i}`);
                if (ballast) meshes.push(ballast);
            }
        } catch (error) {
            console.error('[TrackRenderer] Error rendering curved ballast:', error);
        }

        return meshes;
    }

    /**
         * Create a single rail mesh
         */
    private createRailMesh(start: Vector3, end: Vector3, name: string): Mesh | null {
        try {
            const direction = end.subtract(start);
            const length = direction.length();
            const center = Vector3.Lerp(start, end, 0.5);

            // Create rail as a thin box
            const rail = MeshBuilder.CreateBox(name, {
                width: this.RAIL_WIDTH,
                height: this.RAIL_HEIGHT,
                depth: length
            }, this.scene);

            // Position and orient
            rail.position = center;
            const forward = direction.normalize();
            const angle = Math.atan2(forward.x, forward.z);
            rail.rotation.y = -angle;

            // Material: dark metallic steel
            const material = new StandardMaterial(`${name}_mat`, this.scene);
            material.diffuseColor = new Color3(0.2, 0.2, 0.22);
            material.specularColor = new Color3(0.3, 0.3, 0.3);
            material.roughness = 0.7;
            rail.material = material;

            return rail;
        } catch (error) {
            console.error(`[TrackRenderer] Error creating rail ${name}:`, error);
            return null;
        }
    }

    /**
     * Create a sleeper (cross tie) mesh
     */
    private createSleeperMesh(position: Vector3, forward: Vector3, name: string): Mesh | null {
        try {
            const sleeper = MeshBuilder.CreateBox(name, {
                width: this.SLEEPER_WIDTH,
                height: this.SLEEPER_THICKNESS,
                depth: this.SLEEPER_DEPTH
            }, this.scene);

            sleeper.position = position;

            // Orient perpendicular to track
            const angle = Math.atan2(forward.x, forward.z);
            sleeper.rotation.y = -angle;

            // Material: dark brown wood
            const material = new StandardMaterial(`${name}_mat`, this.scene);
            material.diffuseColor = new Color3(0.3, 0.2, 0.15);
            material.specularColor = new Color3(0.05, 0.05, 0.05);
            material.roughness = 0.95;
            sleeper.material = material;

            return sleeper;
        } catch (error) {
            console.error(`[TrackRenderer] Error creating sleeper ${name}:`, error);
            return null;
        }
    }

    /**
     * Create ballast (gravel bed) mesh
     */
    private createBallastMesh(start: Vector3, end: Vector3, forward: Vector3, name: string): Mesh | null {
        try {
            const direction = end.subtract(start);
            const length = direction.length();
            const center = Vector3.Lerp(start, end, 0.5);

            const ballastWidth = this.GAUGE * 2.5; // Wider than track
            const ballastHeight = 0.005; // 5mm ballast depth

            const ballast = MeshBuilder.CreateBox(name, {
                width: ballastWidth,
                height: ballastHeight,
                depth: length
            }, this.scene);

            // Position slightly below rails
            ballast.position = center.add(new Vector3(0, -ballastHeight / 2 - 0.001, 0));

            const angle = Math.atan2(forward.x, forward.z);
            ballast.rotation.y = -angle;

            // Material: grey gravel
            const material = new StandardMaterial(`${name}_mat`, this.scene);
            material.diffuseColor = new Color3(0.5, 0.5, 0.52);
            material.specularColor = new Color3(0.05, 0.05, 0.05);
            material.roughness = 0.95;
            ballast.material = material;

            return ballast;
        } catch (error) {
            console.error(`[TrackRenderer] Error creating ballast ${name}:`, error);
            return null;
        }
    }

    /**
     * Remove rendered meshes for a piece
     */
    removePiece(pieceId: string): void {
        try {
            const pieceMeshes = this.meshes.get(pieceId);
            if (pieceMeshes) {
                pieceMeshes.forEach(mesh => {
                    try {
                        mesh.dispose();
                    } catch (error) {
                        console.error(`[TrackRenderer] Error disposing mesh:`, error);
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
     * Get mesh count (for debugging)
     */
    getMeshCount(): number {
        let count = 0;
        for (const meshes of this.meshes.values()) {
            count += meshes.length;
        }
        return count;
    }
}