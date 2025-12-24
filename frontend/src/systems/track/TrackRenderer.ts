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
                // Render curved track
                if (edge.curve.arcRadiusM && edge.curve.arcAngleDeg) {
                    // Get the travel direction at start (opposite of connector's outward-facing forward)
                    const startDirection = connectorA.worldForward
                        ? connectorA.worldForward.negate()
                        : endPos.subtract(startPos).normalize();

                    meshes.push(...this.renderCurvedTrack(
                        startPos,
                        endPos,
                        startDirection,
                        edge.curve.arcRadiusM,
                        edge.curve.arcAngleDeg,
                        edge.id
                    ));
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
     * Render curved track section using proper arc geometry
     */
    private renderCurvedTrack(
        start: Vector3,
        end: Vector3,
        startDirection: Vector3,
        radius: number,
        angleDeg: number,
        edgeId: string
    ): Mesh[] {
        const meshes: Mesh[] = [];

        try {
            const angleRad = (angleDeg * Math.PI) / 180;

            // Calculate perpendicular directions (left and right of travel direction)
            // In XZ plane: left is (-z, 0, x), right is (z, 0, -x)
            const perpLeft = new Vector3(-startDirection.z, 0, startDirection.x).normalize();
            const perpRight = new Vector3(startDirection.z, 0, -startDirection.x).normalize();

            // Determine if this is a left or right curve by checking which side the end point is on
            const toEnd = end.subtract(start);
            const dotLeft = Vector3.Dot(toEnd, perpLeft);
            const isLeftCurve = dotLeft > 0;

            // Arc center is perpendicular to start direction at distance = radius
            const perpDirection = isLeftCurve ? perpLeft : perpRight;
            const center = start.add(perpDirection.scale(radius));

            // Calculate the start angle (angle from center to start point)
            const toStart = start.subtract(center);
            const startAngle = Math.atan2(toStart.z, toStart.x);

            // Sweep direction: left curve sweeps counter-clockwise (+), right curve sweeps clockwise (-)
            const sweepDirection = isLeftCurve ? 1 : -1;

            // Use more segments for smoother curves (at least 1 segment per 5 degrees)
            const segments = Math.max(4, Math.ceil(angleDeg / 5));

            for (let i = 0; i < segments; i++) {
                const t1 = i / segments;
                const t2 = (i + 1) / segments;

                // Calculate angles for this segment
                const angle1 = startAngle + sweepDirection * angleRad * t1;
                const angle2 = startAngle + sweepDirection * angleRad * t2;

                // Calculate positions on the arc
                const p1 = new Vector3(
                    center.x + Math.cos(angle1) * radius,
                    start.y, // Maintain height
                    center.z + Math.sin(angle1) * radius
                );
                const p2 = new Vector3(
                    center.x + Math.cos(angle2) * radius,
                    start.y,
                    center.z + Math.sin(angle2) * radius
                );

                const segmentMeshes = this.renderStraightTrack(p1, p2, `${edgeId}_seg${i}`);
                meshes.push(...segmentMeshes);
            }

            console.log(`[TrackRenderer] Rendered curved track with ${segments} segments (radius=${radius.toFixed(3)}m, angle=${angleDeg}°)`);
        } catch (error) {
            console.error('[TrackRenderer] Error in renderCurvedTrack:', error);
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