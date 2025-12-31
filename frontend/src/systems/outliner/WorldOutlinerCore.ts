/**
 * WorldOutlinerCore.ts - Core World Outliner Infrastructure
 * 
 * Path: frontend/src/systems/outliner/WorldOutlinerCore.ts
 * 
 * Provides the foundational infrastructure for the World Outliner:
 * - Initialization and category folder setup
 * - Node storage (Map-based)
 * - Scene object utilities (find by uniqueId, dispose)
 * - Event emitter access
 * - External delete callback registration
 * - Statistics and disposal
 * 
 * @module WorldOutlinerCore
 */

import { Scene } from '@babylonjs/core/scene';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Node } from '@babylonjs/core/node';

import { OutlinerNode } from './OutlinerNode';
import { OutlinerEventEmitter } from './OutlinerEvents';
import type {
    OutlinerNodeType,
    DefaultCategory,
} from '../../types/outliner.types';
import { CATEGORY_ICONS } from '../../types/outliner.types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Current schema version for saved state */
export const SCHEMA_VERSION = '1.0.0';

/** Default category folder names */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
    'Baseboards',
    'Track',
    'Rolling Stock',
    'Scenery',
    'Lights',
];

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Callback type for external cleanup when nodes are deleted
 * @param nodeId - Outliner node ID being deleted
 * @param sceneObjectId - Scene object ID (uniqueId as string)
 * @param metadata - Node metadata for additional context
 */
export type OnNodeDeleteCallback = (
    nodeId: string,
    sceneObjectId: string | null,
    metadata: Record<string, unknown>
) => void;

// ============================================================================
// WORLD OUTLINER CORE CLASS
// ============================================================================

/**
 * Core infrastructure for the World Outliner system.
 * 
 * Provides node storage, scene utilities, and initialization.
 * Extended by WorldOutliner to add node operations and state management.
 * 
 * @example
 * ```typescript
 * class WorldOutliner extends WorldOutlinerCore {
 *     // Add node operations and state management
 * }
 * ```
 */
export class WorldOutlinerCore {
    // ========================================================================
    // PROPERTIES
    // ========================================================================

    /** Babylon.js scene reference */
    protected scene: Scene;

    /** Map of all nodes by ID */
    protected nodes: Map<string, OutlinerNode>;

    /** Root node IDs (nodes with no parent) */
    protected rootIds: string[];

    /** Currently selected node IDs */
    protected selectedIds: Set<string>;

    /** Map of category names to their folder IDs */
    protected categoryFolderIds: Map<DefaultCategory, string>;

    /** Event emitter for outliner events */
    public readonly events: OutlinerEventEmitter;

    /** Whether the system is initialized */
    protected initialized: boolean;

    /** Callbacks to notify external systems when nodes are deleted */
    protected onDeleteCallbacks: OnNodeDeleteCallback[];

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new WorldOutlinerCore
     * @param scene - Babylon.js scene
     */
    constructor(scene: Scene) {
        this.scene = scene;
        this.nodes = new Map();
        this.rootIds = [];
        this.selectedIds = new Set();
        this.categoryFolderIds = new Map();
        this.events = new OutlinerEventEmitter();
        this.initialized = false;
        this.onDeleteCallbacks = [];

        console.log('[WorldOutlinerCore] Created');
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the outliner with default category folders
     */
    initialize(): void {
        if (this.initialized) {
            console.warn('[WorldOutlinerCore] Already initialized');
            return;
        }

        try {
            console.log('[WorldOutlinerCore] Initializing...');

            // Create default category folders
            this.createDefaultCategories();

            this.initialized = true;
            console.log('[WorldOutlinerCore] ✓ Initialized with', DEFAULT_CATEGORIES.length, 'category folders');

        } catch (error) {
            console.error('[WorldOutlinerCore] Initialization error:', error);
            throw error;
        }
    }

    /**
     * Create the default category folders
     */
    protected createDefaultCategories(): void {
        for (const category of DEFAULT_CATEGORIES) {
            const node = new OutlinerNode({
                name: category,
                type: 'folder',
                parentId: null,
                expanded: true,
                metadata: {
                    isDefaultCategory: true,
                    categoryType: category,
                    icon: CATEGORY_ICONS[category],
                },
            });

            this.nodes.set(node.id, node);
            this.rootIds.push(node.id);
            this.categoryFolderIds.set(category, node.id);

            console.log(`[WorldOutlinerCore] Created category folder: ${category}`);
        }
    }

    /**
     * Check if the system is initialized
     */
    isInitialized(): boolean {
        return this.initialized;
    }

    // ========================================================================
    // EXTERNAL CLEANUP CALLBACKS
    // ========================================================================

    /**
     * Register a callback to be notified when nodes are deleted.
     * Used by external systems (like ModelImportButton) to clean up their internal tracking.
     * 
     * @param callback - Function to call when a node is deleted
     */
    onNodeDelete(callback: OnNodeDeleteCallback): void {
        this.onDeleteCallbacks.push(callback);
        console.log('[WorldOutlinerCore] Registered node delete callback');
    }

    /**
     * Remove a previously registered delete callback
     * @param callback - The callback to remove
     */
    removeOnNodeDelete(callback: OnNodeDeleteCallback): void {
        const index = this.onDeleteCallbacks.indexOf(callback);
        if (index !== -1) {
            this.onDeleteCallbacks.splice(index, 1);
            console.log('[WorldOutlinerCore] Removed node delete callback');
        }
    }

    /**
     * Notify all registered callbacks that a node is being deleted
     * @param nodeId - Outliner node ID
     * @param sceneObjectId - Scene object ID
     * @param metadata - Node metadata
     */
    protected notifyDeleteCallbacks(
        nodeId: string,
        sceneObjectId: string | null,
        metadata: Record<string, unknown>
    ): void {
        for (const callback of this.onDeleteCallbacks) {
            try {
                callback(nodeId, sceneObjectId, metadata);
            } catch (error) {
                console.error('[WorldOutlinerCore] Error in delete callback:', error);
            }
        }
    }

    // ========================================================================
    // SCENE UTILITIES
    // ========================================================================

    /**
     * Find a scene node (Mesh or TransformNode) by its uniqueId
     * @param uniqueIdString - The uniqueId as a string
     * @returns The found node or null
     */
    protected findSceneNodeByUniqueId(uniqueIdString: string): Node | null {
        const uniqueId = parseInt(uniqueIdString, 10);
        if (isNaN(uniqueId)) {
            console.warn(`[WorldOutlinerCore] Invalid uniqueId: ${uniqueIdString}`);
            return null;
        }

        // Try to find as a mesh first
        const mesh = this.scene.getMeshByUniqueId(uniqueId);
        if (mesh) {
            return mesh;
        }

        // Try to find as a transform node
        const transformNode = this.scene.getTransformNodeByUniqueId(uniqueId);
        if (transformNode) {
            return transformNode;
        }

        // Try to find in all nodes (fallback)
        for (const node of this.scene.getNodes()) {
            if (node.uniqueId === uniqueId) {
                return node;
            }
        }

        return null;
    }

    /**
     * Remove a node's scene object and all its children.
     * Properly handles both Meshes and TransformNodes (used for imported models).
     * 
     * @param nodeId - Node ID
     */
    protected removeNodeFromScene(nodeId: string): void {
        const node = this.nodes.get(nodeId);
        if (!node?.sceneObjectId) {
            return;
        }

        try {
            // Find the scene object by uniqueId
            const sceneNode = this.findSceneNodeByUniqueId(node.sceneObjectId);

            if (!sceneNode) {
                console.warn(`[WorldOutlinerCore] Scene object not found for ${node.name} (uniqueId: ${node.sceneObjectId})`);
                return;
            }

            // Get all descendants before disposing
            const childMeshes: AbstractMesh[] = [];
            const childTransformNodes: TransformNode[] = [];

            // Collect all child meshes and transform nodes
            if (sceneNode instanceof TransformNode || sceneNode instanceof AbstractMesh) {
                const descendants = sceneNode.getDescendants(false);
                for (const desc of descendants) {
                    if (desc instanceof AbstractMesh) {
                        childMeshes.push(desc);
                    } else if (desc instanceof TransformNode) {
                        childTransformNodes.push(desc);
                    }
                }
            }

            // Dispose all child meshes first (depth-first order)
            for (const mesh of childMeshes) {
                try {
                    mesh.dispose(false, true); // Don't dispose materials, but dispose child meshes
                } catch (e) {
                    console.warn(`[WorldOutlinerCore] Error disposing child mesh: ${mesh.name}`, e);
                }
            }

            // Dispose child transform nodes
            for (const tn of childTransformNodes) {
                try {
                    tn.dispose(false, true);
                } catch (e) {
                    console.warn(`[WorldOutlinerCore] Error disposing child transform node: ${tn.name}`, e);
                }
            }

            // Finally dispose the root node
            if (sceneNode instanceof AbstractMesh) {
                sceneNode.dispose(false, true);
            } else if (sceneNode instanceof TransformNode) {
                sceneNode.dispose(false, true);
            } else {
                // Generic node disposal
                sceneNode.dispose();
            }

            console.log(`[WorldOutlinerCore] ✓ Disposed scene object for ${node.name} (${childMeshes.length} meshes, ${childTransformNodes.length} transform nodes)`);

        } catch (error) {
            console.error(`[WorldOutlinerCore] Error removing scene object for ${node.name}:`, error);
        }
    }

    /**
     * Apply visibility to a scene object.
     * Handles both Meshes and TransformNodes.
     * 
     * @param nodeId - Node ID
     * @param visible - Visibility state
     */
    protected applyVisibilityToScene(nodeId: string, visible: boolean): void {
        const node = this.nodes.get(nodeId);
        if (!node?.sceneObjectId) return;

        const sceneNode = this.findSceneNodeByUniqueId(node.sceneObjectId);
        if (!sceneNode) return;

        // Apply visibility to the node and all its descendants
        if (sceneNode instanceof AbstractMesh) {
            sceneNode.setEnabled(visible);
        } else if (sceneNode instanceof TransformNode) {
            sceneNode.setEnabled(visible);
            // Also apply to all child meshes
            const descendants = sceneNode.getDescendants(false);
            for (const desc of descendants) {
                if (desc instanceof AbstractMesh || desc instanceof TransformNode) {
                    desc.setEnabled(visible);
                }
            }
        }
    }

    // ========================================================================
    // NODE ACCESS UTILITIES
    // ========================================================================

    /**
     * Add a node to the collection and update parent references.
     * @param node - Node to add
     */
    protected addNode(node: OutlinerNode): void {
        // Add to map
        this.nodes.set(node.id, node);

        // Update parent's child list
        if (node.parentId) {
            const parent = this.nodes.get(node.parentId);
            if (parent) {
                parent.addChildId(node.id);
            }
        } else {
            // Add to root if no parent
            if (!this.rootIds.includes(node.id)) {
                this.rootIds.push(node.id);
            }
        }
    }

    /**
     * Get the category folder ID for a given category name.
     * @param category - Category name
     * @returns Folder ID or undefined
     */
    protected getCategoryFolderId(category: DefaultCategory): string | undefined {
        return this.categoryFolderIds.get(category);
    }

    /**
     * Get the scene reference.
     * @returns Babylon.js scene
     */
    getScene(): Scene {
        return this.scene;
    }

    // ========================================================================
    // STATISTICS
    // ========================================================================

    /**
     * Get statistics about the outliner
     * @returns Statistics object
     */
    getStats(): {
        totalNodes: number;
        folders: number;
        items: number;
        selectedCount: number;
        maxDepth: number;
    } {
        let folders = 0;
        let items = 0;
        let maxDepth = 0;

        const calculateDepth = (nodeId: string, depth: number): void => {
            maxDepth = Math.max(maxDepth, depth);
            const node = this.nodes.get(nodeId);
            if (node) {
                for (const childId of node.childIds) {
                    calculateDepth(childId, depth + 1);
                }
            }
        };

        for (const node of this.nodes.values()) {
            if (node.type === 'folder') {
                folders++;
            } else {
                items++;
            }
        }

        for (const rootId of this.rootIds) {
            calculateDepth(rootId, 0);
        }

        return {
            totalNodes: this.nodes.size,
            folders,
            items,
            selectedCount: this.selectedIds.size,
            maxDepth,
        };
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Dispose of the outliner and clean up resources
     */
    dispose(): void {
        this.nodes.clear();
        this.rootIds = [];
        this.selectedIds.clear();
        this.categoryFolderIds.clear();
        this.events.clear();
        this.onDeleteCallbacks = [];
        this.initialized = false;

        console.log('[WorldOutlinerCore] Disposed');
    }
}