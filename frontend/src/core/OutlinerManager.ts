/**
 * OutlinerManager.ts - World Outliner Integration Manager
 * 
 * Path: frontend/src/core/OutlinerManager.ts
 * 
 * Handles all World Outliner functionality including:
 * - Outliner initialization and sidebar setup
 * - Selection highlighting with HighlightLayer
 * - Bidirectional selection synchronization (3D view ↔ outliner)
 * - Track piece registration and deletion
 * - Visibility toggling
 * 
 * @module OutlinerManager
 */

import { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { HighlightLayer } from '@babylonjs/core/Layers/highlightLayer';
import '@babylonjs/core/Layers/effectLayerSceneComponent'; // Required side-effect for HighlightLayer
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';

import { WorldOutliner } from '../systems/outliner/WorldOutliner';
import { RightSidebar } from '../ui/panels/RightSidebar';
import { TrackSystem } from '../systems/track/TrackSystem';
import { BaseboardSystem } from '../systems/baseboard/BaseboardSystem';
import { InputManager } from '../ui/InputManager';
import { ModelImportButton } from '../ui/ModelImportButton';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Dependencies required by OutlinerManager
 */
export interface OutlinerDependencies {
    /** Babylon.js scene */
    scene: Scene;
    /** Track system for track deletion */
    trackSystem: TrackSystem | null;
    /** Baseboard system for registering the baseboard */
    baseboardSystem: BaseboardSystem | null;
    /** Input manager for selection synchronization */
    inputManager: InputManager | null;
    /** Model import button for bidirectional sync */
    modelImportButton: ModelImportButton | null;
}

/**
 * Track piece data structure for outliner registration
 */
export interface TrackPieceData {
    /** Unique piece ID */
    id: string;
    /** Catalog ID (e.g., 'track.straight_168mm') */
    catalogId: string;
    /** Catalog entry with display name */
    catalogEntry?: {
        name: string;
    };
}

// ============================================================================
// OUTLINER MANAGER CLASS
// ============================================================================

/**
 * Manages the World Outliner system and selection highlighting.
 * 
 * Provides centralized handling of:
 * - Outliner initialization with right sidebar
 * - Selection highlighting using Babylon.js HighlightLayer
 * - Bidirectional selection sync between 3D view and outliner panel
 * - Track and model registration/deletion
 * 
 * @example
 * ```typescript
 * const outlinerManager = new OutlinerManager(dependencies);
 * outlinerManager.initialize();
 * outlinerManager.registerTrack(trackPiece);
 * ```
 */
export class OutlinerManager {
    // ========================================================================
    // DEPENDENCIES
    // ========================================================================

    /** Babylon.js scene */
    private scene: Scene;

    /** Track system reference */
    private trackSystem: TrackSystem | null;

    /** Baseboard system reference */
    private baseboardSystem: BaseboardSystem | null;

    /** Input manager reference */
    private inputManager: InputManager | null;

    /** Model import button reference */
    private modelImportButton: ModelImportButton | null;

    // ========================================================================
    // OUTLINER COMPONENTS
    // ========================================================================

    /** World Outliner data structure and logic */
    private worldOutliner: WorldOutliner | null = null;

    /** Right sidebar UI panel containing the outliner */
    private rightSidebar: RightSidebar | null = null;

    // ========================================================================
    // HIGHLIGHT LAYER
    // ========================================================================

    /** Babylon.js highlight layer for selection visualization */
    private highlightLayer: HighlightLayer | null = null;

    /** Currently highlighted meshes */
    private highlightedMeshes: AbstractMesh[] = [];

    /** Highlight color for selected objects */
    private readonly HIGHLIGHT_COLOR = Color3.Red();

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Creates a new OutlinerManager instance.
     * 
     * @param dependencies - Required dependencies for outliner functionality
     */
    constructor(dependencies: OutlinerDependencies) {
        this.scene = dependencies.scene;
        this.trackSystem = dependencies.trackSystem;
        this.baseboardSystem = dependencies.baseboardSystem;
        this.inputManager = dependencies.inputManager;
        this.modelImportButton = dependencies.modelImportButton;
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the World Outliner system.
     * 
     * Creates:
     * - HighlightLayer for selection visualization
     * - WorldOutliner data structure
     * - RightSidebar UI panel
     * - Event listeners for selection/deletion
     */
    initialize(): void {
        try {
            console.log('[OutlinerManager] Initializing World Outliner...');

            // Create highlight layer for selection visualization
            this.highlightLayer = new HighlightLayer('selectionHighlight', this.scene);
            this.highlightLayer.outerGlow = true;
            this.highlightLayer.innerGlow = false;
            this.highlightLayer.blurHorizontalSize = 1.0;
            this.highlightLayer.blurVerticalSize = 1.0;

            // Create the WorldOutliner system
            this.worldOutliner = new WorldOutliner(this.scene);
            this.worldOutliner.initialize();

            // Setup outliner event listeners (deletion, visibility)
            this.setupOutlinerEventListeners();

            // Create the right sidebar with outliner panel
            this.rightSidebar = new RightSidebar(this.worldOutliner);
            this.rightSidebar.initialize();

            // Add to DOM
            const sidebarElement = this.rightSidebar.getElement();
            if (sidebarElement) {
                document.body.appendChild(sidebarElement);
            }

            // Setup selection callback to sync with 3D view
            this.rightSidebar.setSelectionCallback((nodeIds) => {
                this.onOutlinerSelectionChanged(nodeIds);
            });

            // Register the baseboard with the outliner
            this.registerBaseboard();

            // Setup bidirectional model sync
            this.setupModelSync();

            // Setup 3D selection to outliner sync
            this.setupSelectionSync();

            console.log('[OutlinerManager] ✓ World Outliner initialized');

        } catch (error) {
            console.error('[OutlinerManager] Failed to initialize World Outliner:', error);
        }
    }

    // ========================================================================
    // BASEBOARD REGISTRATION
    // ========================================================================

    /**
     * Register the baseboard mesh with the outliner.
     */
    private registerBaseboard(): void {
        if (!this.worldOutliner || !this.baseboardSystem) return;

        const boardMesh = this.scene.getMeshByName('baseboard');
        if (boardMesh) {
            this.worldOutliner.createItem({
                name: 'Main Baseboard',
                type: 'baseboard',
                sceneObjectId: boardMesh.uniqueId.toString(),
            });
            console.log('[OutlinerManager] ✓ Baseboard registered');
        }
    }

    // ========================================================================
    // MODEL SYNC SETUP
    // ========================================================================

    /**
     * Connect WorldOutliner to ModelImportButton for bidirectional sync.
     * 
     * Enables:
     * - Models appearing in outliner when placed
     * - Deleting from outliner removes the 3D model
     * - Deleting the 3D model removes from outliner
     */
    private setupModelSync(): void {
        if (!this.worldOutliner || !this.modelImportButton) return;

        this.modelImportButton.setWorldOutliner(this.worldOutliner);
        console.log('[OutlinerManager] ✓ Connected WorldOutliner to ModelImportButton');
    }

    // ========================================================================
    // SELECTION SYNC SETUP
    // ========================================================================

    /**
     * Setup 3D selection to outliner synchronization.
     * 
     * When user clicks a track piece in 3D view, highlights it in outliner.
     */
    private setupSelectionSync(): void {
        if (!this.inputManager || !this.worldOutliner) return;

        this.inputManager.setOnSelectionChange((piece) => {
            if (!this.worldOutliner) return;

            if (piece) {
                // Find the outliner node for this piece
                const node = this.worldOutliner.findBySceneObjectId(piece.id);
                if (node) {
                    // Select in outliner (this will also trigger highlighting)
                    this.worldOutliner.select(node.id, false);
                    console.log(`[OutlinerManager] Synced selection to outliner: ${node.name}`);
                }
            } else {
                // Deselected - clear outliner selection
                this.worldOutliner.clearSelection();
            }
        });
    }

    // ========================================================================
    // EVENT LISTENERS
    // ========================================================================

    /**
     * Setup event listeners for the World Outliner.
     * Handles deletions, visibility changes, etc.
     */
    private setupOutlinerEventListeners(): void {
        if (!this.worldOutliner) return;

        // Store reference to original method
        const outliner = this.worldOutliner;
        const originalDeleteNode = outliner.deleteNode.bind(outliner);

        // Create custom delete handler for track pieces
        outliner.deleteNode = (nodeId: string, force: boolean = false): boolean => {
            const node = outliner.getNode(nodeId);

            if (!node) {
                console.warn(`[OutlinerManager] Cannot delete - node not found: ${nodeId}`);
                return false;
            }

            console.log(`[OutlinerManager] Deleting node: ${node.name} (type: ${node.type})`);

            // ============================================================
            // TRACK PIECES - Must go through TrackSystem
            // ============================================================
            if (node.type === 'track') {
                const pieceId = (node.metadata?.pieceId as string) || node.sceneObjectId;

                if (pieceId && this.trackSystem) {
                    console.log(`[OutlinerManager] Deleting track piece: ${pieceId}`);

                    // Remove via TrackSystem (handles meshes, graph, indicators)
                    const removed = this.trackSystem.removePiece(pieceId);

                    if (removed) {
                        // Remove from outliner's internal data structures
                        this.removeNodeFromOutliner(outliner, nodeId, node);
                        console.log(`[OutlinerManager] ✓ Track piece deleted: ${pieceId}`);
                        return true;
                    } else {
                        console.warn(`[OutlinerManager] TrackSystem failed to remove: ${pieceId}`);
                        return false;
                    }
                }

                console.warn(`[OutlinerManager] Track piece has no pieceId: ${nodeId}`);
                return false;
            }

            // ============================================================
            // OTHER TYPES - Use original method
            // ============================================================
            return originalDeleteNode(nodeId, force);
        };

        // Listen for visibility changes
        this.worldOutliner.events.on('node:visibility_changed', (event: {
            nodeId: string;
            visible: boolean;
        }) => {
            const node = this.worldOutliner?.getNode(event.nodeId);
            if (!node) return;

            console.log(`[OutlinerManager] Visibility changed: ${node.name} = ${event.visible}`);

            // For track pieces, toggle visibility of all associated meshes
            if (node.type === 'track' && node.metadata?.pieceId) {
                const pieceId = node.metadata.pieceId as string;
                this.setTrackPieceVisibility(pieceId, event.visible);
            }
        });

        console.log('[OutlinerManager] ✓ Outliner event listeners configured');
    }

    // ========================================================================
    // NODE REMOVAL HELPER
    // ========================================================================

    /**
     * Remove a node from the outliner's internal data structures.
     * 
     * @param outliner - WorldOutliner instance
     * @param nodeId - Node ID to remove
     * @param node - Node data for event emission
     */
    private removeNodeFromOutliner(outliner: WorldOutliner, nodeId: string, node: any): void {
        try {
            const nodesMap = (outliner as any).nodes as Map<string, any>;
            const rootIds = (outliner as any).rootIds as string[];
            const selectedIds = (outliner as any).selectedIds as Set<string>;

            if (nodesMap?.has(nodeId)) {
                const deletedNode = nodesMap.get(nodeId);

                // Remove from parent
                if (deletedNode.parentId && nodesMap.has(deletedNode.parentId)) {
                    const parent = nodesMap.get(deletedNode.parentId);
                    if (parent.childIds) {
                        const idx = parent.childIds.indexOf(nodeId);
                        if (idx !== -1) parent.childIds.splice(idx, 1);
                    }
                    if (typeof parent.removeChildId === 'function') {
                        parent.removeChildId(nodeId);
                    }
                } else if (rootIds) {
                    const idx = rootIds.indexOf(nodeId);
                    if (idx !== -1) rootIds.splice(idx, 1);
                }

                // Remove from selection
                selectedIds?.delete(nodeId);

                // Delete the node itself
                nodesMap.delete(nodeId);

                // Emit event
                outliner.events?.emitNodeDeleted?.(
                    nodeId,
                    node.type,
                    node.parentId ?? null,
                    []
                );
            }
        } catch (e) {
            console.error('[OutlinerManager] Error cleaning up outliner node:', e);
        }
    }

    // ========================================================================
    // VISIBILITY MANAGEMENT
    // ========================================================================

    /**
     * Set visibility of a track piece's meshes.
     * 
     * @param pieceId - Track piece ID
     * @param visible - Whether to show or hide
     */
    private setTrackPieceVisibility(pieceId: string, visible: boolean): void {
        for (const mesh of this.scene.meshes) {
            if (mesh.name.includes(pieceId) ||
                mesh.metadata?.pieceId === pieceId ||
                mesh.parent?.name === pieceId) {
                mesh.setEnabled(visible);
            }
        }
    }

    // ========================================================================
    // SELECTION HANDLING
    // ========================================================================

    /**
     * Handle selection changes from the outliner.
     * Highlights selected meshes in the 3D view with a red outline.
     * 
     * @param nodeIds - Selected node IDs
     */
    private onOutlinerSelectionChanged(nodeIds: string[]): void {
        if (!this.worldOutliner || !this.highlightLayer) return;

        // Clear existing highlights
        this.clearHighlights();

        // Log selection for debugging
        console.log('[OutlinerManager] Outliner selection:', nodeIds);

        // Highlight meshes for each selected node
        for (const nodeId of nodeIds) {
            const node = this.worldOutliner.getNode(nodeId);
            if (!node) continue;

            // Skip folders - they don't have meshes
            if (node.type === 'folder') continue;

            // Handle track pieces specially - they have multiple meshes
            if (node.type === 'track') {
                const pieceId = (node.metadata?.pieceId as string) || node.sceneObjectId;
                if (pieceId) {
                    this.highlightTrackPiece(pieceId);
                }
                continue;
            }

            // For other types (baseboard, scenery, rolling stock), find by uniqueId
            if (node.sceneObjectId) {
                this.highlightNodeMeshes(node);
            }
        }
    }

    /**
     * Find and highlight meshes for a node (non-track types).
     * 
     * @param node - Outliner node data
     */
    private highlightNodeMeshes(node: any): void {
        // Try to find mesh by uniqueId (stored as string)
        const uniqueId = parseInt(node.sceneObjectId, 10);
        let mesh: AbstractMesh | null = null;

        // Search through all meshes to find by uniqueId
        if (!isNaN(uniqueId)) {
            for (const m of this.scene.meshes) {
                if (m.uniqueId === uniqueId) {
                    mesh = m;
                    break;
                }
            }
        }

        // If not found by uniqueId, try by name
        if (!mesh) {
            mesh = this.scene.getMeshByName(node.sceneObjectId);
        }

        // If still not found, try searching for partial name match
        if (!mesh) {
            for (const m of this.scene.meshes) {
                if (m.name.includes(node.sceneObjectId)) {
                    mesh = m;
                    break;
                }
            }
        }

        if (mesh) {
            this.highlightMesh(mesh);

            // Also highlight child meshes (for imported models)
            const children = mesh.getChildMeshes();
            for (const child of children) {
                this.highlightMesh(child);
            }
        } else {
            console.warn(`[OutlinerManager] Could not find mesh for node: ${node.name} (${node.sceneObjectId})`);
        }
    }

    // ========================================================================
    // HIGHLIGHT MANAGEMENT
    // ========================================================================

    /**
     * Highlight a single mesh with red outline.
     * 
     * @param mesh - Mesh to highlight
     */
    private highlightMesh(mesh: AbstractMesh): void {
        if (!this.highlightLayer) return;

        try {
            // Add to highlight layer with red color
            this.highlightLayer.addMesh(mesh, this.HIGHLIGHT_COLOR);
            this.highlightedMeshes.push(mesh);
            console.log(`[OutlinerManager] Highlighted mesh: ${mesh.name}`);
        } catch (error) {
            console.warn(`[OutlinerManager] Could not highlight mesh ${mesh.name}:`, error);
        }
    }

    /**
     * Highlight all meshes belonging to a track piece.
     * Track pieces consist of multiple meshes (rails, sleepers, ballast).
     * 
     * @param pieceId - Track piece ID
     */
    private highlightTrackPiece(pieceId: string): void {
        if (!this.highlightLayer) return;

        let meshesFound = 0;

        // Find all meshes that belong to this track piece
        for (const mesh of this.scene.meshes) {
            // Skip non-pickable utility meshes (unless they're track components)
            if (!mesh.isPickable &&
                !mesh.name.includes('rail') &&
                !mesh.name.includes('sleeper') &&
                !mesh.name.includes('ballast')) {
                continue;
            }

            // Check if mesh name starts with or contains piece ID
            if (mesh.name.startsWith(pieceId) || mesh.name.includes(pieceId)) {
                this.highlightMesh(mesh);
                meshesFound++;
                continue;
            }

            // Check mesh metadata
            if (mesh.metadata?.pieceId === pieceId || mesh.metadata?.trackPieceId === pieceId) {
                this.highlightMesh(mesh);
                meshesFound++;
                continue;
            }

            // Check parent - track pieces may be grouped under a transform node
            if (mesh.parent) {
                const parentName = mesh.parent.name;
                if (parentName === pieceId || parentName.includes(pieceId)) {
                    this.highlightMesh(mesh);
                    meshesFound++;
                }
            }
        }

        if (meshesFound > 0) {
            console.log(`[OutlinerManager] Highlighted ${meshesFound} meshes for track piece: ${pieceId}`);
        } else {
            console.warn(`[OutlinerManager] No meshes found for track piece: ${pieceId}`);
        }
    }

    /**
     * Clear all highlighted meshes.
     */
    clearHighlights(): void {
        if (!this.highlightLayer) return;

        // Remove all meshes from highlight layer
        for (const mesh of this.highlightedMeshes) {
            try {
                this.highlightLayer.removeMesh(mesh);
            } catch (error) {
                // Mesh may have been disposed
            }
        }

        this.highlightedMeshes = [];
    }

    // ========================================================================
    // TRACK REGISTRATION
    // ========================================================================

    /**
     * Register a track piece with the World Outliner.
     * 
     * @param piece - The track piece data to register
     */
    registerTrack(piece: TrackPieceData): void {
        if (!this.worldOutliner || !piece) return;

        try {
            // Track pieces have multiple meshes - find them all
            const pieceMeshes: AbstractMesh[] = [];

            for (const mesh of this.scene.meshes) {
                if (mesh.name.includes(piece.id)) {
                    pieceMeshes.push(mesh);
                }
            }

            // Use the piece ID as the scene object identifier
            const sceneObjectId = piece.id;

            this.worldOutliner.createItem({
                name: piece.catalogEntry?.name || piece.id,
                type: 'track',
                sceneObjectId: sceneObjectId,
                metadata: {
                    catalogId: piece.catalogId,
                    pieceId: piece.id,
                    meshCount: pieceMeshes.length,
                },
            });

            console.log(`[OutlinerManager] Registered track with outliner: ${piece.id} (${pieceMeshes.length} meshes)`);

        } catch (error) {
            console.warn('[OutlinerManager] Could not register track with outliner:', error);
        }
    }

    /**
     * Delete a track piece properly through the TrackSystem.
     * Ensures the graph is updated correctly.
     * 
     * @param pieceId - Track piece ID to delete
     */
    deleteTrack(pieceId: string): void {
        if (!this.trackSystem) return;

        console.log(`[OutlinerManager] Deleting track piece: ${pieceId}`);
        this.trackSystem.removePiece(pieceId);

        // Also remove from outliner if not already done
        if (this.worldOutliner) {
            const node = this.worldOutliner.findBySceneObjectId(pieceId);
            if (node) {
                this.worldOutliner.deleteNode(node.id, true);
            }
        }
    }

    /**
     * Remove a track piece from the outliner only (no 3D deletion).
     * Used when track is deleted via other means (e.g., Delete key).
     * 
     * @param pieceId - Track piece ID to remove from outliner
     */
    removeTrackFromOutliner(pieceId: string): void {
        if (!this.worldOutliner) return;

        const node = this.worldOutliner.findBySceneObjectId(pieceId);
        if (!node) return;

        try {
            const outliner = this.worldOutliner;
            const nodesMap = (outliner as any).nodes as Map<string, any>;
            const rootIds = (outliner as any).rootIds as string[];

            if (nodesMap?.has(node.id)) {
                const deletedNode = nodesMap.get(node.id);

                // Remove from parent
                if (deletedNode.parentId && nodesMap.has(deletedNode.parentId)) {
                    const parent = nodesMap.get(deletedNode.parentId);
                    if (parent.childIds) {
                        const idx = parent.childIds.indexOf(node.id);
                        if (idx !== -1) parent.childIds.splice(idx, 1);
                    }
                } else if (rootIds) {
                    const idx = rootIds.indexOf(node.id);
                    if (idx !== -1) rootIds.splice(idx, 1);
                }

                nodesMap.delete(node.id);
            }

            console.log(`[OutlinerManager] Removed from outliner: ${node.name}`);

        } catch (error) {
            console.warn('[OutlinerManager] Error removing from outliner:', error);
        }
    }

    // ========================================================================
    // ACCESSORS
    // ========================================================================

    /**
     * Get the WorldOutliner instance.
     * @returns WorldOutliner or null if not initialized
     */
    getWorldOutliner(): WorldOutliner | null {
        return this.worldOutliner;
    }

    /**
     * Get the RightSidebar instance.
     * @returns RightSidebar or null if not initialized
     */
    getRightSidebar(): RightSidebar | null {
        return this.rightSidebar;
    }

    /**
     * Get the HighlightLayer instance.
     * @returns HighlightLayer or null if not initialized
     */
    getHighlightLayer(): HighlightLayer | null {
        return this.highlightLayer;
    }

    // ========================================================================
    // DEPENDENCY UPDATES
    // ========================================================================

    /**
     * Update the input manager reference.
     * Used when input manager is initialized after outliner.
     * 
     * @param inputManager - InputManager instance
     */
    setInputManager(inputManager: InputManager): void {
        this.inputManager = inputManager;
        this.setupSelectionSync();
    }

    /**
     * Update the model import button reference.
     * Used when model import is initialized after outliner.
     * 
     * @param modelImportButton - ModelImportButton instance
     */
    setModelImportButton(modelImportButton: ModelImportButton): void {
        this.modelImportButton = modelImportButton;
        this.setupModelSync();
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Dispose of all resources and clean up.
     */
    dispose(): void {
        try {
            console.log('[OutlinerManager] Disposing...');

            // Clear highlights and dispose layer
            this.clearHighlights();
            if (this.highlightLayer) {
                this.highlightLayer.dispose();
                this.highlightLayer = null;
            }

            // Dispose sidebar and outliner
            if (this.rightSidebar) {
                this.rightSidebar.dispose();
                this.rightSidebar = null;
            }
            if (this.worldOutliner) {
                this.worldOutliner.dispose();
                this.worldOutliner = null;
            }

            console.log('[OutlinerManager] ✓ Disposed');

        } catch (error) {
            console.error('[OutlinerManager] Error disposing:', error);
        }
    }
}