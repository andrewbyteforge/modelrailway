/**
 * InputManager.ts - Handles mouse interaction with track pieces
 * 
 * Features:
 * - Hover detection and highlighting
 * - Click to select pieces
 * - Drag to move pieces
 * - Integration with TrackSystem and BaseboardSystem
 * 
 * Note: Ray is imported via side-effect in main.ts
 * 
 * @module InputManager
 */

import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Material } from '@babylonjs/core/Materials/material';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { TrackSystem } from '../systems/track/TrackSystem';
import type { TrackPiece } from '../systems/track/TrackPiece';
import type { BaseboardSystem } from '../systems/baseboard/BaseboardSystem';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Stored original material reference for unhighlighting
 */
interface OriginalMaterialInfo {
    material: Material;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Highlight colors for different states
 */
const HIGHLIGHT_COLORS = {
    HOVER: new Color3(0.3, 0.6, 1.0),      // Light blue
    SELECTED: new Color3(1.0, 0.2, 0.2),   // Red
} as const;

// ============================================================================
// INPUT MANAGER CLASS
// ============================================================================

/**
 * InputManager - Handles user input for track manipulation
 * 
 * Provides hover highlighting, selection, and drag-to-move functionality
 * for track pieces.
 * 
 * @example
 * ```typescript
 * const input = new InputManager(scene, canvas, trackSystem, baseboardSystem);
 * input.initialize();
 * ```
 */
export class InputManager {
    /** Babylon.js scene */
    private scene: Scene;

    /** Canvas element for events */
    private canvas: HTMLCanvasElement;

    /** Track system for piece operations */
    private trackSystem: TrackSystem;

    /** Baseboard system for position queries */
    private baseboardSystem: BaseboardSystem;

    /** Currently hovered piece */
    private hoveredPiece: TrackPiece | null = null;

    /** Currently selected piece */
    private selectedPiece: TrackPiece | null = null;

    /** Piece currently being dragged */
    private draggedPiece: TrackPiece | null = null;

    /** Whether user is currently dragging */
    private isDragging = false;

    /** Position where drag started (for offset calculation) */
    private dragStartPos: Vector3 | null = null;

    /** Offset from piece center to pick point */
    private dragOffset: Vector3 | null = null;

    /** Original materials stored for highlight restoration */
    private originalMaterials: Map<string, OriginalMaterialInfo> = new Map();

    /** Currently highlighted meshes */
    private highlightedMeshes: Mesh[] = [];

    /** Whether placement mode is active (disables hover/selection) */
    private placementModeActive = false;

    // Bound event handlers for cleanup
    private boundMouseMove: (e: PointerEvent) => void;
    private boundMouseDown: (e: PointerEvent) => void;
    private boundMouseUp: (e: PointerEvent) => void;

    // ========================================================================
    // CONSTRUCTOR & INITIALIZATION
    // ========================================================================

    /**
     * Create a new InputManager
     * @param scene - Babylon.js scene
     * @param canvas - Canvas element
     * @param trackSystem - Track system instance
     * @param baseboardSystem - Baseboard system instance
     */
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

        // Bind event handlers
        this.boundMouseMove = this.onMouseMove.bind(this);
        this.boundMouseDown = this.onMouseDown.bind(this);
        this.boundMouseUp = this.onMouseUp.bind(this);

        console.log('[InputManager] Created');
    }

    /**
     * Initialize input handling
     * Uses capture phase to intercept events before camera controls
     */
    initialize(): void {
        try {
            this.canvas.addEventListener('pointermove', this.boundMouseMove);
            this.canvas.addEventListener('pointerdown', this.boundMouseDown, { capture: true });
            this.canvas.addEventListener('pointerup', this.boundMouseUp);

            // Also listen for pointer leaving canvas to stop drag
            this.canvas.addEventListener('pointerleave', () => {
                if (this.isDragging) {
                    this.stopDragging();
                }
            });

            console.log('[InputManager] Initialized');
        } catch (error) {
            console.error('[InputManager] Error initializing:', error);
        }
    }

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    /**
     * Handle mouse move events
     */
    private onMouseMove(event: PointerEvent): void {
        try {
            // Skip if in placement mode
            if (this.placementModeActive) return;

            // Create picking ray
            const camera = this.scene.activeCamera;
            if (!camera) return;

            const ray = this.scene.createPickingRay(
                event.clientX,
                event.clientY,
                null,
                camera
            );

            const pickResult = this.scene.pickWithRay(ray);

            if (this.isDragging && this.draggedPiece) {
                this.handleDrag(event);
            } else {
                this.handleHover(pickResult);
            }
        } catch (error) {
            console.error('[InputManager] Error in onMouseMove:', error);
        }
    }

    /**
     * Handle mouse down events
     */
    private onMouseDown(event: PointerEvent): void {
        try {
            // Left click only
            if (event.button !== 0) return;

            // Skip if in placement mode
            if (this.placementModeActive) return;

            // Create picking ray
            const camera = this.scene.activeCamera;
            if (!camera) return;

            const ray = this.scene.createPickingRay(
                event.clientX,
                event.clientY,
                null,
                camera
            );

            const pickResult = this.scene.pickWithRay(ray);

            if (pickResult?.hit && pickResult.pickedMesh) {
                const piece = this.findPieceByMesh(pickResult.pickedMesh as Mesh);

                if (piece) {
                    // Prevent event from reaching camera controls
                    event.preventDefault();
                    event.stopPropagation();

                    // Select and start dragging this piece
                    this.selectPiece(piece);
                    this.startDragging(piece, pickResult.pickedPoint);
                }
            } else {
                // Clicked on empty space - deselect
                this.clearSelection();
            }
        } catch (error) {
            console.error('[InputManager] Error in onMouseDown:', error);
        }
    }

    /**
     * Handle mouse up events
     */
    private onMouseUp(event: PointerEvent): void {
        try {
            if (this.isDragging) {
                this.stopDragging();
            }
        } catch (error) {
            console.error('[InputManager] Error in onMouseUp:', error);
        }
    }

    // ========================================================================
    // HOVER HANDLING
    // ========================================================================

    /**
     * Handle hover highlighting
     */
    private handleHover(pickResult: any): void {
        try {
            // Skip hover highlighting when in placement mode
            if (this.placementModeActive) {
                this.clearHover();
                return;
            }

            if (pickResult?.hit && pickResult.pickedMesh) {
                const piece = this.findPieceByMesh(pickResult.pickedMesh as Mesh);

                if (piece && piece !== this.hoveredPiece) {
                    this.clearHover();
                    this.hoveredPiece = piece;

                    // Don't re-highlight if already selected
                    if (piece !== this.selectedPiece) {
                        this.highlightPiece(piece, HIGHLIGHT_COLORS.HOVER);
                    }
                    this.canvas.style.cursor = 'pointer';
                }
            } else {
                this.clearHover();
            }
        } catch (error) {
            console.error('[InputManager] Error in handleHover:', error);
        }
    }

    /**
     * Clear hover state
     */
    private clearHover(): void {
        try {
            if (this.hoveredPiece && this.hoveredPiece !== this.selectedPiece) {
                this.unhighlightPiece(this.hoveredPiece);
            }
            this.hoveredPiece = null;

            if (!this.isDragging) {
                this.canvas.style.cursor = 'default';
            }
        } catch (error) {
            console.error('[InputManager] Error in clearHover:', error);
        }
    }

    // ========================================================================
    // SELECTION
    // ========================================================================

    /**
     * Select a piece
     */
    private selectPiece(piece: TrackPiece): void {
        try {
            // Clear previous selection if different piece
            if (this.selectedPiece && this.selectedPiece !== piece) {
                this.unhighlightPiece(this.selectedPiece);
            }

            this.selectedPiece = piece;
            this.highlightPiece(piece, HIGHLIGHT_COLORS.SELECTED);

            console.log(`[InputManager] Selected: ${piece.id}`);
        } catch (error) {
            console.error('[InputManager] Error in selectPiece:', error);
        }
    }

    /**
     * Clear current selection
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
     * Get currently selected piece
     */
    getSelectedPiece(): TrackPiece | null {
        return this.selectedPiece;
    }

    /**
     * Set whether placement mode is active
     * When active, hover highlighting and selection are disabled
     */
    setPlacementMode(active: boolean): void {
        this.placementModeActive = active;

        // Clear any existing hover when entering placement mode
        if (active) {
            this.clearHover();
            this.clearSelection();
        }
    }

    // ========================================================================
    // DRAGGING
    // ========================================================================

    /**
     * Start dragging a piece
     */
    private startDragging(piece: TrackPiece, pickPoint: Vector3 | null): void {
        this.isDragging = true;
        this.draggedPiece = piece;
        this.dragStartPos = pickPoint?.clone() || null;

        // Calculate offset from piece center to pick point
        if (pickPoint && piece.transform) {
            this.dragOffset = new Vector3(
                pickPoint.x - piece.transform.position.x,
                0,
                pickPoint.z - piece.transform.position.z
            );
        } else {
            this.dragOffset = null;
        }

        // Disable camera controls during drag
        this.setCameraControlsEnabled(false);

        this.canvas.style.cursor = 'grabbing';
        console.log(`[InputManager] Started dragging ${piece.id}`);
    }

    /**
     * Stop dragging and drop the piece
     */
    private stopDragging(): void {
        if (this.draggedPiece) {
            console.log(`[InputManager] Dropped ${this.draggedPiece.id}`);
        }

        this.isDragging = false;
        this.draggedPiece = null;
        this.dragStartPos = null;
        this.dragOffset = null;

        // Re-enable camera controls
        this.setCameraControlsEnabled(true);

        this.canvas.style.cursor = this.hoveredPiece ? 'pointer' : 'default';
    }

    /**
     * Enable or disable camera controls
     */
    private setCameraControlsEnabled(enabled: boolean): void {
        try {
            const camera = this.scene.activeCamera;
            if (!camera) return;

            if (enabled) {
                camera.attachControl(this.canvas, true);
            } else {
                camera.detachControl();
            }
        } catch (error) {
            console.error('[InputManager] Error toggling camera controls:', error);
        }
    }

    /**
     * Handle drag movement - move piece to follow mouse
     */
    private handleDrag(event: PointerEvent): void {
        try {
            if (!this.draggedPiece) return;

            // Create picking ray
            const camera = this.scene.activeCamera;
            if (!camera) return;

            const baseboard = this.baseboardSystem.getBaseboard();
            if (!baseboard) return;

            const ray = this.scene.createPickingRay(
                event.clientX,
                event.clientY,
                null,
                camera
            );

            // Direct intersection with baseboard
            const intersection = ray.intersectsMesh(baseboard);

            if (intersection.hit && intersection.pickedPoint) {
                const boardY = this.baseboardSystem.getBoardTopY();

                // Apply offset so piece doesn't jump to cursor center
                let newX = intersection.pickedPoint.x;
                let newZ = intersection.pickedPoint.z;

                if (this.dragOffset) {
                    newX -= this.dragOffset.x;
                    newZ -= this.dragOffset.z;
                }

                const newPos = new Vector3(newX, boardY, newZ);
                this.trackSystem.movePiece(this.draggedPiece.id, newPos);
            }
        } catch (error) {
            console.error('[InputManager] Error in handleDrag:', error);
        }
    }

    // ========================================================================
    // HIGHLIGHTING
    // ========================================================================

    /**
     * Highlight a piece with a color
     */
    private highlightPiece(piece: TrackPiece, color: Color3): void {
        try {
            const meshes = this.getMeshesForPiece(piece);

            meshes.forEach(mesh => {
                if (!mesh?.material) return;

                const meshId = mesh.uniqueId.toString();

                // Store original material reference if not already stored
                if (!this.originalMaterials.has(meshId)) {
                    this.originalMaterials.set(meshId, {
                        material: mesh.material  // Store reference to original shared material
                    });

                    // Clone the material so we don't affect other meshes
                    const originalMat = mesh.material as StandardMaterial;
                    const clonedMat = originalMat.clone(`${originalMat.name}_highlight_${meshId}`);
                    mesh.material = clonedMat;
                }

                // Apply highlight to the cloned material
                const mat = mesh.material as StandardMaterial;
                if (mat.emissiveColor !== undefined) {
                    mat.emissiveColor = color;
                }

                this.highlightedMeshes.push(mesh);
            });
        } catch (error) {
            console.error('[InputManager] Error highlighting piece:', error);
        }
    }

    /**
     * Remove highlight from a piece
     */
    private unhighlightPiece(piece: TrackPiece): void {
        try {
            const meshes = this.getMeshesForPiece(piece);

            meshes.forEach(mesh => {
                if (!mesh?.material) return;

                const meshId = mesh.uniqueId.toString();
                const original = this.originalMaterials.get(meshId);

                if (original) {
                    // Dispose the cloned highlight material
                    const clonedMat = mesh.material;

                    // Restore original shared material
                    mesh.material = original.material;

                    // Dispose the cloned material to free memory
                    if (clonedMat && clonedMat !== original.material) {
                        clonedMat.dispose();
                    }

                    this.originalMaterials.delete(meshId);
                }

                // Remove from highlighted list
                const idx = this.highlightedMeshes.indexOf(mesh);
                if (idx > -1) {
                    this.highlightedMeshes.splice(idx, 1);
                }
            });
        } catch (error) {
            console.error('[InputManager] Error unhighlighting piece:', error);
        }
    }

    // ========================================================================
    // PIECE/MESH LOOKUP
    // ========================================================================

    /**
     * Find which piece a mesh belongs to
     */
    private findPieceByMesh(mesh: Mesh): TrackPiece | null {
        try {
            const allPieces = this.trackSystem.getAllPieces();

            for (const piece of allPieces) {
                // Match piece ID with underscore boundaries
                // Mesh names: rail_L_piece_0_edge_0, hitbox_piece_0, sleeper_piece_0_edge_0_5
                // Need to match "_piece_0_" or "_piece_0" at end, not "_piece_0" in "_piece_00_"
                if (this.meshBelongsToPiece(mesh.name, piece.id)) {
                    return piece;
                }
            }

            return null;
        } catch (error) {
            console.error('[InputManager] Error finding piece by mesh:', error);
            return null;
        }
    }

    /**
     * Check if a mesh name belongs to a specific piece ID
     * Uses strict matching to avoid piece_1 matching piece_10
     */
    private meshBelongsToPiece(meshName: string, pieceId: string): boolean {
        // Check for "_pieceId_" in the middle
        if (meshName.includes(`_${pieceId}_`)) return true;

        // Check for "_pieceId" at the end (like hitbox_piece_0)
        if (meshName.endsWith(`_${pieceId}`)) return true;

        // Check for "pieceId_" at the start (unlikely but safe)
        if (meshName.startsWith(`${pieceId}_`)) return true;

        // Check for exact match (unlikely but safe)
        if (meshName === pieceId) return true;

        return false;
    }

    /**
     * Get all meshes belonging to a piece (excluding hitbox)
     * Used for highlighting - hitbox is invisible so shouldn't be highlighted
     */
    private getMeshesForPiece(piece: TrackPiece): Mesh[] {
        const meshes: Mesh[] = [];

        try {
            this.scene.meshes.forEach(mesh => {
                // Skip hitbox - it's invisible
                if (mesh.name.startsWith('hitbox_')) {
                    return;
                }

                // Check if this mesh belongs to the piece
                if (this.meshBelongsToPiece(mesh.name, piece.id)) {
                    meshes.push(mesh as Mesh);
                }
            });
        } catch (error) {
            console.error('[InputManager] Error getting meshes for piece:', error);
        }

        return meshes;
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Dispose all resources
     */
    dispose(): void {
        try {
            this.canvas.removeEventListener('pointermove', this.boundMouseMove);
            this.canvas.removeEventListener('pointerdown', this.boundMouseDown, { capture: true });
            this.canvas.removeEventListener('pointerup', this.boundMouseUp);

            // Stop any active drag
            if (this.isDragging) {
                this.stopDragging();
            }

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