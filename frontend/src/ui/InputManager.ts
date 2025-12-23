/**
 * InputManager.ts - Handles mouse interaction with track pieces
 * 
 * Features:
 * - Hover detection and highlighting
 * - Click to select pieces
 * - Drag to move pieces
 */

import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { TrackSystem } from '../systems/track/TrackSystem';
import type { TrackPiece } from '../systems/track/TrackPiece';
import type { BaseboardSystem } from '../systems/baseboard/BaseboardSystem';

export class InputManager {
    private scene: Scene;
    private canvas: HTMLCanvasElement;
    private trackSystem: TrackSystem;
    private baseboardSystem: BaseboardSystem;

    private hoveredPiece: TrackPiece | null = null;
    private selectedPiece: TrackPiece | null = null;
    private isDragging = false;
    private dragStartPos: Vector3 | null = null;

    // Store original materials for highlighting
    private originalMaterials: Map<string, any> = new Map();
    private highlightedMeshes: Mesh[] = [];

    constructor(
        scene: Scene,
        canvas: HTMLCanvasElement,
        trackSystem: TrackSystem,
        baseboardSystem: BaseboardSystem
    ) {
        if (!scene || !canvas || !trackSystem || !baseboardSystem) {
            throw new Error('[InputManager] All parameters are required');
        }

        this.scene = scene;
        this.canvas = canvas;
        this.trackSystem = trackSystem;
        this.baseboardSystem = baseboardSystem;

        console.log('[InputManager] Created');
    }

    /**
     * Initialize input handling
     */
    initialize(): void {
        try {
            // Mouse move for hover detection
            this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));

            // Mouse down for selection and drag start
            this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));

            // Mouse up for drag end
            this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));

            console.log('[InputManager] Initialized');
        } catch (error) {
            console.error('[InputManager] Error initializing:', error);
        }
    }

    /**
     * Handle mouse move
     */
    private onMouseMove(event: MouseEvent): void {
        try {
            const pickResult = this.scene.pick(event.clientX, event.clientY);

            if (this.isDragging && this.selectedPiece) {
                // Dragging mode - move the selected piece
                this.handleDrag(event);
            } else {
                // Hover mode - highlight pieces under mouse
                this.handleHover(pickResult);
            }
        } catch (error) {
            console.error('[InputManager] Error in onMouseMove:', error);
        }
    }

    /**
     * Handle mouse down
     */
    private onMouseDown(event: MouseEvent): void {
        try {
            // Left click only
            if (event.button !== 0) return;

            const pickResult = this.scene.pick(event.clientX, event.clientY);

            if (pickResult?.hit && pickResult.pickedMesh) {
                // Find which piece this mesh belongs to
                const piece = this.findPieceByMesh(pickResult.pickedMesh as Mesh);

                if (piece) {
                    // Select this piece and start dragging
                    this.selectPiece(piece);
                    this.startDragging(pickResult.pickedPoint);
                    console.log(`[InputManager] Started dragging piece ${piece.id}`);
                }
            }
        } catch (error) {
            console.error('[InputManager] Error in onMouseDown:', error);
        }
    }

    /**
     * Handle mouse up
     */
    private onMouseUp(event: MouseEvent): void {
        try {
            if (this.isDragging) {
                this.stopDragging();
            }
        } catch (error) {
            console.error('[InputManager] Error in onMouseUp:', error);
        }
    }

    /**
     * Handle hover highlighting
     */
    private handleHover(pickResult: any): void {
        try {
            if (pickResult?.hit && pickResult.pickedMesh) {
                const piece = this.findPieceByMesh(pickResult.pickedMesh as Mesh);

                if (piece && piece !== this.hoveredPiece) {
                    // Clear previous hover
                    this.clearHover();

                    // Set new hover
                    this.hoveredPiece = piece;
                    this.highlightPiece(piece, new Color3(0.3, 0.6, 1.0)); // Light blue
                    this.canvas.style.cursor = 'pointer';
                }
            } else {
                // No piece under mouse
                this.clearHover();
            }
        } catch (error) {
            console.error('[InputManager] Error in handleHover:', error);
        }
    }

    /**
     * Handle dragging
     */
    private handleDrag(event: MouseEvent): void {
        try {
            if (!this.selectedPiece || !this.dragStartPos) return;

            // Raycast to baseboard to get new position
            const pickResult = this.scene.pick(event.clientX, event.clientY, (mesh) => {
                return mesh.name === 'baseboard';
            });

            if (pickResult?.hit && pickResult.pickedPoint) {
                // Calculate new position (keep Y constant at board top)
                const boardY = this.baseboardSystem.getBoardTopY();
                const newPos = new Vector3(pickResult.pickedPoint.x, boardY, pickResult.pickedPoint.z);

                // Move the piece
                this.trackSystem.movePiece(this.selectedPiece.id, newPos);
            }
        } catch (error) {
            console.error('[InputManager] Error in handleDrag:', error);
        }
    }

    /**
     * Start dragging a piece
     */
    private startDragging(startPoint: Vector3 | null): void {
        this.isDragging = true;
        this.dragStartPos = startPoint;
        this.canvas.style.cursor = 'grabbing';
    }

    /**
     * Stop dragging
     */
    private stopDragging(): void {
        this.isDragging = false;
        this.dragStartPos = null;
        this.canvas.style.cursor = this.hoveredPiece ? 'pointer' : 'default';
        console.log('[InputManager] Stopped dragging');
    }

    /**
     * Select a piece
     */
    private selectPiece(piece: TrackPiece): void {
        try {
            // Clear previous selection
            if (this.selectedPiece && this.selectedPiece !== piece) {
                this.clearSelection();
            }

            this.selectedPiece = piece;
            this.highlightPiece(piece, new Color3(0.2, 1.0, 0.3)); // Green
            console.log(`[InputManager] Selected piece ${piece.id}`);
        } catch (error) {
            console.error('[InputManager] Error in selectPiece:', error);
        }
    }

    /**
     * Clear selection
     */
    clearSelection(): void {
        try {
            if (this.selectedPiece) {
                this.unhighlightPiece(this.selectedPiece);
                this.selectedPiece = null;
            }
        } catch (error) {
            console.error('[InputManager] Error in clearSelection:', error);
        }
    }

    /**
     * Clear hover
     */
    private clearHover(): void {
        try {
            if (this.hoveredPiece && this.hoveredPiece !== this.selectedPiece) {
                this.unhighlightPiece(this.hoveredPiece);
                this.hoveredPiece = null;
                this.canvas.style.cursor = 'default';
            }
        } catch (error) {
            console.error('[InputManager] Error in clearHover:', error);
        }
    }

    /**
     * Highlight a piece
     */
    private highlightPiece(piece: TrackPiece, color: Color3): void {
        try {
            const meshes = this.getMeshesForPiece(piece);

            meshes.forEach(mesh => {
                if (!mesh || !mesh.material) return;

                // Store original material if not already stored
                const meshId = mesh.uniqueId.toString();
                if (!this.originalMaterials.has(meshId)) {
                    const mat = mesh.material as StandardMaterial;
                    this.originalMaterials.set(meshId, {
                        emissiveColor: mat.emissiveColor?.clone(),
                        diffuseColor: mat.diffuseColor?.clone()
                    });
                }

                // Apply highlight
                const mat = mesh.material as StandardMaterial;
                if (mat.emissiveColor) {
                    mat.emissiveColor = color;
                }

                this.highlightedMeshes.push(mesh);
            });
        } catch (error) {
            console.error('[InputManager] Error in highlightPiece:', error);
        }
    }

    /**
     * Remove highlight from a piece
     */
    private unhighlightPiece(piece: TrackPiece): void {
        try {
            const meshes = this.getMeshesForPiece(piece);

            meshes.forEach(mesh => {
                if (!mesh || !mesh.material) return;

                // Restore original material
                const meshId = mesh.uniqueId.toString();
                const original = this.originalMaterials.get(meshId);

                if (original) {
                    const mat = mesh.material as StandardMaterial;
                    if (mat.emissiveColor && original.emissiveColor) {
                        mat.emissiveColor = original.emissiveColor;
                    }
                    if (mat.diffuseColor && original.diffuseColor) {
                        mat.diffuseColor = original.diffuseColor;
                    }
                    this.originalMaterials.delete(meshId);
                }

                // Remove from highlighted list
                const index = this.highlightedMeshes.indexOf(mesh);
                if (index > -1) {
                    this.highlightedMeshes.splice(index, 1);
                }
            });
        } catch (error) {
            console.error('[InputManager] Error in unhighlightPiece:', error);
        }
    }

    /**
     * Find which piece a mesh belongs to
     */
    private findPieceByMesh(mesh: Mesh): TrackPiece | null {
        try {
            const allPieces = this.trackSystem.getAllPieces();

            for (const piece of allPieces) {
                const pieceMeshes = this.getMeshesForPiece(piece);
                if (pieceMeshes.includes(mesh)) {
                    return piece;
                }
            }

            return null;
        } catch (error) {
            console.error('[InputManager] Error in findPieceByMesh:', error);
            return null;
        }
    }

    /**
     * Get all meshes belonging to a piece
     */
    private getMeshesForPiece(piece: TrackPiece): Mesh[] {
        try {
            const meshes: Mesh[] = [];

            // Find meshes by name pattern (contains piece ID)
            this.scene.meshes.forEach(mesh => {
                if (mesh.name.includes(piece.id)) {
                    meshes.push(mesh as Mesh);
                }
            });

            return meshes;
        } catch (error) {
            console.error('[InputManager] Error in getMeshesForPiece:', error);
            return [];
        }
    }

    /**
     * Get selected piece
     */
    getSelectedPiece(): TrackPiece | null {
        return this.selectedPiece;
    }

    /**
     * Dispose input manager
     */
    dispose(): void {
        try {
            this.canvas.removeEventListener('mousemove', this.onMouseMove.bind(this));
            this.canvas.removeEventListener('mousedown', this.onMouseDown.bind(this));
            this.canvas.removeEventListener('mouseup', this.onMouseUp.bind(this));

            this.clearSelection();
            this.clearHover();
            this.originalMaterials.clear();
            this.highlightedMeshes = [];

            console.log('[InputManager] Disposed');
        } catch (error) {
            console.error('[InputManager] Error disposing:', error);
        }
    }
}