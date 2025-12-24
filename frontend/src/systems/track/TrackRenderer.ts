/**
 * TrackRenderer.ts - Renders track pieces visually
 * 
 * Creates:
 * - Rails (extruded along track edges)
 * - Sleepers/ties (instanced cross pieces)
 * - Ballast (gravel bed)
 */

import { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TrackPiece } from './TrackPiece';
import type { GraphEdge } from './TrackGraph';

export class TrackRenderer {
    private scene: Scene;
    private meshes: Map<string, Mesh[]> = new Map();

    // Visual parameters
    private readonly RAIL_WIDTH = 0.003;      // 3mm rail width (OO scale)
    private readonly RAIL_HEIGHT = 0.004;     // 4mm rail height
    private readonly GAUGE = 0.0165;          // 16.5mm track gauge (OO scale)
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
    private renderEdge(edge: GraphEdge, piece: TrackPiece): Mesh[] {
        const meshes: Mesh[] = [];

        try {
            // Get start and end positions from graph nodes
            const connectorA = piece.connectors.find(c => c.nodeId === edge.fromNodeId);
            const connectorB = piece.connectors.find(c => c.nodeId === edge.toNodeId);

            if (!connectorA?.worldPos || !connectorB?.worldPos) {
                console.warn(`[TrackRenderer] Edge ${edge.id} missing connector positions`);
                return meshes;
            }

            const startPos = connectorA.worldPos;
            const endPos = connectorB.worldPos;

            if (edge.curve.type === 'straight') {
                // Render straight track
                meshes.push(...this.renderStraightTrack(startPos, endPos, edge.id));
            } else if (edge.curve.type === 'arc') {
                // Render curved track using Hermite spline between actual connector positions
                // Get travel directions (opposite of connector's outward-facing forward)
                const startTangent = connectorA.worldForward
                    ? connectorA.worldForward.negate()
                    : endPos.subtract(startPos).normalize();
                const endTangent = connectorB.worldForward
                    ? connectorB.worldForward.clone()
                    : endPos.subtract(startPos).normalize();

                meshes.push(...this.renderCurvedTrack(
                    startPos,
                    endPos,
                    startTangent,
                    endTangent,
                    edge.id
                ));
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
     * Render curved track section using Hermite spline interpolation.
     * This ensures the curve passes through the actual start/end positions
     * with correct tangent directions, regardless of catalog geometry.
     */
    private renderCurvedTrack(
        start: Vector3,
        end: Vector3,
        startTangent: Vector3,
        endTangent: Vector3,
        edgeId: string
    ): Mesh[] {
        const meshes: Mesh[] = [];

        try {
            // Calculate chord length to scale tangents appropriately
            const chordLength = Vector3.Distance(start, end);

            // Scale tangents by chord length for smooth interpolation
            const scaledStartTangent = startTangent.normalize().scale(chordLength);
            const scaledEndTangent = endTangent.normalize().scale(chordLength);

            // Use enough segments for smooth curve (more for longer tracks)
            const segments = Math.max(8, Math.ceil(chordLength / 0.01)); // ~1 segment per cm

            for (let i = 0; i < segments; i++) {
                const t1 = i / segments;
                const t2 = (i + 1) / segments;

                // Hermite interpolation for each point
                const p1 = this.hermiteInterpolate(start, end, scaledStartTangent, scaledEndTangent, t1);
                const p2 = this.hermiteInterpolate(start, end, scaledStartTangent, scaledEndTangent, t2);

                const segmentMeshes = this.renderStraightTrack(p1, p2, `${edgeId}_seg${i}`);
                meshes.push(...segmentMeshes);
            }

            console.log(`[TrackRenderer] Rendered curved track with ${segments} segments`);
        } catch (error) {
            console.error('[TrackRenderer] Error in renderCurvedTrack:', error);
        }

        return meshes;
    }

    /**
     * Hermite spline interpolation between two points with tangent directions.
     * Returns position at parameter t (0 to 1).
     */
    private hermiteInterpolate(
        p0: Vector3,
        p1: Vector3,
        m0: Vector3,
        m1: Vector3,
        t: number
    ): Vector3 {
        // Hermite basis functions
        const t2 = t * t;
        const t3 = t2 * t;

        const h00 = 2 * t3 - 3 * t2 + 1;  // position at p0
        const h10 = t3 - 2 * t2 + t;       // tangent at p0
        const h01 = -2 * t3 + 3 * t2;      // position at p1
        const h11 = t3 - t2;               // tangent at p1

        return new Vector3(
            h00 * p0.x + h10 * m0.x + h01 * p1.x + h11 * m1.x,
            h00 * p0.y + h10 * m0.y + h01 * p1.y + h11 * m1.y,
            h00 * p0.z + h10 * m0.z + h01 * p1.z + h11 * m1.z
        );
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