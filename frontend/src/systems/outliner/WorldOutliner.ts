/**
 * WorldOutliner.ts - Core World Outliner system
 * 
 * Path: frontend/src/systems/outliner/WorldOutliner.ts
 * 
 * Manages the complete scene hierarchy with support for:
 * - Folders and nested organisation
 * - Auto-grouping by asset type
 * - Transform parenting (moving parent moves children)
 * - Selection management
 * - Visibility and lock states
 * - Serialization for save/load
 * 
 * @module WorldOutliner
 */

import { Vector3, Quaternion } from '@babylonjs/core/Maths/math';
import { Scene } from '@babylonjs/core/scene';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';

import { OutlinerNode, generateNodeId } from './OutlinerNode';
import { OutlinerEventEmitter } from './OutlinerEvents';
import type {
    OutlinerNodeData,
    OutlinerNodeType,
    OutlinerState,
    OutlinerTransform,
    DefaultCategory,
} from '../../types/outliner.types';
import { NODE_TYPE_TO_CATEGORY, CATEGORY_ICONS } from '../../types/outliner.types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Current schema version for saved state */
const SCHEMA_VERSION = '1.0.0';

/** Default category folder names */
const DEFAULT_CATEGORIES: DefaultCategory[] = [
    'Baseboards',
    'Track',
    'Rolling Stock',
    'Scenery',
    'Lights',
];

// ============================================================================
// WORLD OUTLINER CLASS
// ============================================================================

/**
 * WorldOutliner - Main system for managing scene hierarchy
 * 
 * Provides a tree structure for organising all scene objects with support
 * for folders, selection, visibility, and transform parenting.
 * 
 * @example
 * ```typescript
 * const outliner = new WorldOutliner(scene);
 * outliner.initialize();
 * 
 * // Create a folder
 * const folderId = outliner.createFolder('My Station', 'Scenery');
 * 
 * // Add an item
 * const stationId = outliner.createItem({
 *     name: 'Station Building',
 *     type: 'scenery',
 *     sceneObjectId: mesh.uniqueId.toString(),
 *     parentId: folderId,
 * });
 * 
 * // Select it
 * outliner.select(stationId);
 * ```
 */
export class WorldOutliner {
    // ========================================================================
    // PROPERTIES
    // ========================================================================

    /** Babylon.js scene reference */
    private scene: Scene;

    /** Map of all nodes by ID */
    private nodes: Map<string, OutlinerNode>;

    /** Root node IDs (nodes with no parent) */
    private rootIds: string[];

    /** Currently selected node IDs */
    private selectedIds: Set<string>;

    /** Map of category names to their folder IDs */
    private categoryFolderIds: Map<DefaultCategory, string>;

    /** Event emitter for outliner events */
    public readonly events: OutlinerEventEmitter;

    /** Whether the system is initialized */
    private initialized: boolean;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new WorldOutliner
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

        console.log('[WorldOutliner] Created');
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the outliner with default category folders
     */
    initialize(): void {
        if (this.initialized) {
            console.warn('[WorldOutliner] Already initialized');
            return;
        }

        try {
            console.log('[WorldOutliner] Initializing...');

            // Create default category folders
            this.createDefaultCategories();

            this.initialized = true;
            console.log('[WorldOutliner] ✓ Initialized with', DEFAULT_CATEGORIES.length, 'category folders');
        } catch (error) {
            console.error('[WorldOutliner] Initialization error:', error);
            throw error;
        }
    }

    /**
     * Create the default category folders
     */
    private createDefaultCategories(): void {
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

            console.log(`[WorldOutliner] Created category folder: ${category}`);
        }
    }

    /**
     * Check if the system is initialized
     */
    isInitialized(): boolean {
        return this.initialized;
    }

    // ========================================================================
    // NODE CREATION
    // ========================================================================

    /**
     * Create a new folder
     * @param name - Folder name
     * @param parentId - Parent folder ID or category name (null for root)
     * @returns New folder ID
     */
    createFolder(name: string, parentId?: string | DefaultCategory | null): string {
        try {
            // Resolve parent ID
            let resolvedParentId: string | null = null;

            if (typeof parentId === 'string') {
                // Check if it's a category name
                if (this.categoryFolderIds.has(parentId as DefaultCategory)) {
                    resolvedParentId = this.categoryFolderIds.get(parentId as DefaultCategory)!;
                } else if (this.nodes.has(parentId)) {
                    resolvedParentId = parentId;
                }
            }

            // Create the folder node
            const node = new OutlinerNode({
                name,
                type: 'folder',
                parentId: resolvedParentId,
                expanded: true,
            });

            // Add to collection
            this.addNode(node);

            // Emit event
            this.events.emitNodeCreated(node.id, 'folder', resolvedParentId);

            console.log(`[WorldOutliner] Created folder: ${name}`);
            return node.id;
        } catch (error) {
            console.error('[WorldOutliner] Error creating folder:', error);
            throw error;
        }
    }

    /**
     * Create a new item node
     * @param options - Item configuration
     * @returns New item ID
     */
    createItem(options: {
        name: string;
        type: Exclude<OutlinerNodeType, 'folder'>;
        sceneObjectId?: string;
        parentId?: string | null;
        transform?: OutlinerTransform;
        metadata?: Record<string, unknown>;
    }): string {
        try {
            // Determine parent - use auto-grouping if no parent specified
            let parentId = options.parentId ?? null;

            if (parentId === null) {
                // Auto-group by type
                const category = NODE_TYPE_TO_CATEGORY[options.type];
                if (category && this.categoryFolderIds.has(category)) {
                    parentId = this.categoryFolderIds.get(category)!;
                }
            }

            // Create the item node
            const node = new OutlinerNode({
                name: options.name,
                type: options.type,
                parentId,
                sceneObjectId: options.sceneObjectId ?? null,
                localTransform: options.transform,
                metadata: options.metadata ?? {},
            });

            // Add to collection
            this.addNode(node);

            // Emit event
            this.events.emitNodeCreated(node.id, options.type, parentId);

            console.log(`[WorldOutliner] Created item: ${options.name} (${options.type})`);
            return node.id;
        } catch (error) {
            console.error('[WorldOutliner] Error creating item:', error);
            throw error;
        }
    }

    /**
     * Add a node to the collection and update parent references
     * @param node - Node to add
     */
    private addNode(node: OutlinerNode): void {
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

    // ========================================================================
    // NODE DELETION
    // ========================================================================

    /**
     * Delete a node and all its descendants
     * @param nodeId - ID of node to delete
     * @param force - If true, delete even default category folders
     * @returns True if deleted
     */
    deleteNode(nodeId: string, force: boolean = false): boolean {
        try {
            const node = this.nodes.get(nodeId);
            if (!node) {
                console.warn(`[WorldOutliner] Node not found: ${nodeId}`);
                return false;
            }

            // Prevent deletion of default categories unless forced
            if (!force && node.metadata.isDefaultCategory) {
                console.warn(`[WorldOutliner] Cannot delete default category: ${node.name}`);
                return false;
            }

            // Check if locked
            if (node.locked && !force) {
                console.warn(`[WorldOutliner] Cannot delete locked node: ${node.name}`);
                return false;
            }

            // Get all descendant IDs before deletion
            const descendantIds = this.getDescendantIds(nodeId);

            // Remove from selection
            this.selectedIds.delete(nodeId);
            descendantIds.forEach(id => this.selectedIds.delete(id));

            // Delete all descendants first (depth-first)
            for (const descId of descendantIds.reverse()) {
                this.removeNodeFromScene(descId);
                this.nodes.delete(descId);
            }

            // Remove from parent's children
            if (node.parentId) {
                const parent = this.nodes.get(node.parentId);
                parent?.removeChildId(nodeId);
            } else {
                // Remove from root
                const rootIndex = this.rootIds.indexOf(nodeId);
                if (rootIndex !== -1) {
                    this.rootIds.splice(rootIndex, 1);
                }
            }

            // Remove from scene
            this.removeNodeFromScene(nodeId);

            // Delete the node
            this.nodes.delete(nodeId);

            // Emit event
            this.events.emitNodeDeleted(nodeId, node.type, node.parentId, descendantIds);

            console.log(`[WorldOutliner] Deleted: ${node.name} (and ${descendantIds.length} descendants)`);
            return true;
        } catch (error) {
            console.error('[WorldOutliner] Error deleting node:', error);
            throw error;
        }
    }

    /**
     * Remove a node's scene object
     * @param nodeId - Node ID
     */
    private removeNodeFromScene(nodeId: string): void {
        const node = this.nodes.get(nodeId);
        if (!node?.sceneObjectId) return;

        // Find and dispose the scene object
        const mesh = this.scene.getMeshById(node.sceneObjectId);
        if (mesh) {
            mesh.dispose();
            console.log(`[WorldOutliner] Disposed scene object for ${node.name}`);
        }
    }

    // ========================================================================
    // NODE RETRIEVAL
    // ========================================================================

    /**
     * Get a node by ID
     * @param nodeId - Node ID
     * @returns Node or undefined
     */
    getNode(nodeId: string): OutlinerNode | undefined {
        return this.nodes.get(nodeId);
    }

    /**
     * Get all nodes
     * @returns Array of all nodes
     */
    getAllNodes(): OutlinerNode[] {
        return Array.from(this.nodes.values());
    }

    /**
     * Get root nodes
     * @returns Array of root nodes
     */
    getRootNodes(): OutlinerNode[] {
        return this.rootIds.map(id => this.nodes.get(id)!).filter(Boolean);
    }

    /**
     * Get children of a node
     * @param nodeId - Parent node ID
     * @returns Array of child nodes
     */
    getChildren(nodeId: string): OutlinerNode[] {
        const node = this.nodes.get(nodeId);
        if (!node) return [];

        return node.childIds
            .map(id => this.nodes.get(id))
            .filter((n): n is OutlinerNode => n !== undefined);
    }

    /**
     * Get all descendant IDs of a node (recursive)
     * @param nodeId - Node ID
     * @returns Array of descendant IDs
     */
    getDescendantIds(nodeId: string): string[] {
        const result: string[] = [];
        const node = this.nodes.get(nodeId);
        if (!node) return result;

        const collect = (id: string) => {
            const n = this.nodes.get(id);
            if (!n) return;

            for (const childId of n.childIds) {
                result.push(childId);
                collect(childId);
            }
        };

        collect(nodeId);
        return result;
    }

    /**
     * Get the parent chain from a node to root
     * @param nodeId - Node ID
     * @returns Array of ancestor nodes (immediate parent first)
     */
    getAncestors(nodeId: string): OutlinerNode[] {
        const ancestors: OutlinerNode[] = [];
        let current = this.nodes.get(nodeId);

        while (current?.parentId) {
            const parent = this.nodes.get(current.parentId);
            if (parent) {
                ancestors.push(parent);
                current = parent;
            } else {
                break;
            }
        }

        return ancestors;
    }

    /**
     * Get the category folder for a node type
     * @param type - Node type
     * @returns Category folder node or undefined
     */
    getCategoryFolder(type: Exclude<OutlinerNodeType, 'folder'>): OutlinerNode | undefined {
        const category = NODE_TYPE_TO_CATEGORY[type];
        const folderId = this.categoryFolderIds.get(category);
        return folderId ? this.nodes.get(folderId) : undefined;
    }

    /**
     * Find nodes by name (partial match)
     * @param name - Name to search for
     * @returns Matching nodes
     */
    findByName(name: string): OutlinerNode[] {
        const lowerName = name.toLowerCase();
        return Array.from(this.nodes.values()).filter(node =>
            node.name.toLowerCase().includes(lowerName)
        );
    }

    /**
     * Find nodes by type
     * @param type - Node type to find
     * @returns Matching nodes
     */
    findByType(type: OutlinerNodeType): OutlinerNode[] {
        return Array.from(this.nodes.values()).filter(node => node.type === type);
    }

    /**
     * Find node by scene object ID
     * @param sceneObjectId - Scene object ID
     * @returns Node or undefined
     */
    findBySceneObjectId(sceneObjectId: string): OutlinerNode | undefined {
        return Array.from(this.nodes.values()).find(
            node => node.sceneObjectId === sceneObjectId
        );
    }

    // ========================================================================
    // NODE MODIFICATION
    // ========================================================================

    /**
     * Rename a node
     * @param nodeId - Node ID
     * @param newName - New name
     */
    renameNode(nodeId: string, newName: string): void {
        const node = this.nodes.get(nodeId);
        if (!node) {
            console.warn(`[WorldOutliner] Node not found: ${nodeId}`);
            return;
        }

        if (node.locked) {
            console.warn(`[WorldOutliner] Cannot rename locked node: ${node.name}`);
            return;
        }

        const oldName = node.name;
        node.setName(newName);

        this.events.emitNodeRenamed(nodeId, oldName, newName);
    }

    /**
     * Move a node to a new parent
     * @param nodeId - Node ID to move
     * @param newParentId - New parent ID (null for root)
     * @param insertIndex - Optional insertion index
     */
    moveNode(nodeId: string, newParentId: string | null, insertIndex?: number): void {
        try {
            const node = this.nodes.get(nodeId);
            if (!node) {
                console.warn(`[WorldOutliner] Node not found: ${nodeId}`);
                return;
            }

            if (node.locked) {
                console.warn(`[WorldOutliner] Cannot move locked node: ${node.name}`);
                return;
            }

            // Prevent moving into self or descendant
            if (newParentId) {
                if (newParentId === nodeId) {
                    console.warn('[WorldOutliner] Cannot move node into itself');
                    return;
                }

                const descendants = this.getDescendantIds(nodeId);
                if (descendants.includes(newParentId)) {
                    console.warn('[WorldOutliner] Cannot move node into its descendant');
                    return;
                }
            }

            const oldParentId = node.parentId;
            const oldSortOrder = node.sortOrder;

            // Remove from old parent
            if (oldParentId) {
                const oldParent = this.nodes.get(oldParentId);
                oldParent?.removeChildId(nodeId);
            } else {
                const rootIndex = this.rootIds.indexOf(nodeId);
                if (rootIndex !== -1) {
                    this.rootIds.splice(rootIndex, 1);
                }
            }

            // Add to new parent
            if (newParentId) {
                const newParent = this.nodes.get(newParentId);
                if (newParent) {
                    newParent.addChildId(nodeId, insertIndex);
                    node.setParentId(newParentId);
                }
            } else {
                // Move to root
                if (insertIndex !== undefined) {
                    this.rootIds.splice(insertIndex, 0, nodeId);
                } else {
                    this.rootIds.push(nodeId);
                }
                node.setParentId(null);
            }

            // Update sort orders
            this.recalculateSortOrders(newParentId);

            // Update transform if needed (transform parenting)
            this.updateWorldTransform(nodeId);

            // Emit event
            this.events.emitNodeMoved(nodeId, oldParentId, newParentId, oldSortOrder, node.sortOrder);

            console.log(`[WorldOutliner] Moved ${node.name} to ${newParentId ?? 'root'}`);
        } catch (error) {
            console.error('[WorldOutliner] Error moving node:', error);
            throw error;
        }
    }

    /**
     * Recalculate sort orders for children of a parent
     * @param parentId - Parent ID (null for root)
     */
    private recalculateSortOrders(parentId: string | null): void {
        const childIds = parentId
            ? this.nodes.get(parentId)?.childIds ?? []
            : this.rootIds;

        childIds.forEach((id, index) => {
            const node = this.nodes.get(id);
            node?.setSortOrder(index);
        });
    }

    // ========================================================================
    // VISIBILITY & LOCK
    // ========================================================================

    /**
     * Set visibility of a node and optionally its descendants
     * @param nodeId - Node ID
     * @param visible - Visibility state
     * @param recursive - Apply to descendants
     */
    setVisibility(nodeId: string, visible: boolean, recursive: boolean = false): void {
        const node = this.nodes.get(nodeId);
        if (!node) return;

        node.setVisible(visible);
        this.applyVisibilityToScene(nodeId, visible);

        const affectedDescendants: string[] = [];

        if (recursive) {
            const descendants = this.getDescendantIds(nodeId);
            for (const descId of descendants) {
                const desc = this.nodes.get(descId);
                if (desc) {
                    desc.setVisible(visible);
                    this.applyVisibilityToScene(descId, visible);
                    affectedDescendants.push(descId);
                }
            }
        }

        this.events.emitNodeVisibilityChanged(nodeId, visible, affectedDescendants);
    }

    /**
     * Toggle visibility of a node
     * @param nodeId - Node ID
     * @param recursive - Apply to descendants
     */
    toggleVisibility(nodeId: string, recursive: boolean = false): void {
        const node = this.nodes.get(nodeId);
        if (!node) return;

        this.setVisibility(nodeId, !node.visible, recursive);
    }

    /**
     * Apply visibility to scene object
     * @param nodeId - Node ID
     * @param visible - Visibility state
     */
    private applyVisibilityToScene(nodeId: string, visible: boolean): void {
        const node = this.nodes.get(nodeId);
        if (!node?.sceneObjectId) return;

        const mesh = this.scene.getMeshById(node.sceneObjectId);
        if (mesh) {
            mesh.setEnabled(visible);
        }
    }

    /**
     * Set lock state of a node
     * @param nodeId - Node ID
     * @param locked - Lock state
     */
    setLocked(nodeId: string, locked: boolean): void {
        const node = this.nodes.get(nodeId);
        if (!node) return;

        node.setLocked(locked);
        this.events.emitNodeLockChanged(nodeId, locked);
    }

    /**
     * Toggle lock state of a node
     * @param nodeId - Node ID
     */
    toggleLocked(nodeId: string): void {
        const node = this.nodes.get(nodeId);
        if (!node) return;

        this.setLocked(nodeId, !node.locked);
    }

    // ========================================================================
    // EXPAND / COLLAPSE
    // ========================================================================

    /**
     * Set expanded state of a folder
     * @param nodeId - Folder node ID
     * @param expanded - Expanded state
     */
    setExpanded(nodeId: string, expanded: boolean): void {
        const node = this.nodes.get(nodeId);
        if (!node || node.type !== 'folder') return;

        node.setExpanded(expanded);
        this.events.emitNodeExpandedChanged(nodeId, expanded);
    }

    /**
     * Toggle expanded state of a folder
     * @param nodeId - Folder node ID
     */
    toggleExpanded(nodeId: string): void {
        const node = this.nodes.get(nodeId);
        if (!node || node.type !== 'folder') return;

        this.setExpanded(nodeId, !node.expanded);
    }

    /**
     * Expand all folders
     */
    expandAll(): void {
        for (const node of this.nodes.values()) {
            if (node.type === 'folder') {
                node.setExpanded(true);
            }
        }
        this.events.emitHierarchyChanged(Array.from(this.nodes.keys()));
    }

    /**
     * Collapse all folders
     */
    collapseAll(): void {
        for (const node of this.nodes.values()) {
            if (node.type === 'folder') {
                node.setExpanded(false);
            }
        }
        this.events.emitHierarchyChanged(Array.from(this.nodes.keys()));
    }

    // ========================================================================
    // SELECTION
    // ========================================================================

    /**
     * Select a node (toggle behavior - clicking selected item deselects it)
     * @param nodeId - Node ID
     * @param additive - Add to selection (vs replace)
     */
    select(nodeId: string, additive: boolean = false): void {
        const previousSelected = Array.from(this.selectedIds);
        const wasAlreadySelected = this.selectedIds.has(nodeId);

        if (!additive) {
            // Non-additive: if clicking the same item, toggle it off
            if (wasAlreadySelected && this.selectedIds.size === 1) {
                // Only this item was selected, deselect it
                this.selectedIds.clear();
                this.events.emitNodeDeselected(nodeId);
                this.events.emitSelectionChanged(
                    Array.from(this.selectedIds),
                    previousSelected
                );
                return;
            }
            // Otherwise clear and select the new item
            this.selectedIds.clear();
        } else {
            // Additive mode: toggle the item
            if (wasAlreadySelected) {
                this.selectedIds.delete(nodeId);
                this.events.emitNodeDeselected(nodeId);
                this.events.emitSelectionChanged(
                    Array.from(this.selectedIds),
                    previousSelected
                );
                return;
            }
        }

        this.selectedIds.add(nodeId);

        this.events.emitNodeSelected(nodeId, additive);
        this.events.emitSelectionChanged(
            Array.from(this.selectedIds),
            previousSelected
        );
    }

    /**
     * Deselect a node
     * @param nodeId - Node ID
     */
    deselect(nodeId: string): void {
        if (!this.selectedIds.has(nodeId)) return;

        const previousSelected = Array.from(this.selectedIds);
        this.selectedIds.delete(nodeId);

        this.events.emitNodeDeselected(nodeId);
        this.events.emitSelectionChanged(
            Array.from(this.selectedIds),
            previousSelected
        );
    }

    /**
     * Clear all selection
     */
    clearSelection(): void {
        if (this.selectedIds.size === 0) return;

        const previousSelected = Array.from(this.selectedIds);
        this.selectedIds.clear();

        this.events.emitSelectionChanged([], previousSelected);
    }

    /**
     * Select multiple nodes
     * @param nodeIds - Array of node IDs
     * @param additive - Add to selection (vs replace)
     */
    selectMultiple(nodeIds: string[], additive: boolean = false): void {
        const previousSelected = Array.from(this.selectedIds);

        if (!additive) {
            this.selectedIds.clear();
        }

        for (const nodeId of nodeIds) {
            if (this.nodes.has(nodeId)) {
                this.selectedIds.add(nodeId);
            }
        }

        this.events.emitSelectionChanged(
            Array.from(this.selectedIds),
            previousSelected
        );
    }

    /**
     * Get selected nodes
     * @returns Array of selected nodes
     */
    getSelectedNodes(): OutlinerNode[] {
        return Array.from(this.selectedIds)
            .map(id => this.nodes.get(id))
            .filter((n): n is OutlinerNode => n !== undefined);
    }

    /**
     * Get selected node IDs
     * @returns Array of selected node IDs
     */
    getSelectedIds(): string[] {
        return Array.from(this.selectedIds);
    }

    /**
     * Check if a node is selected
     * @param nodeId - Node ID
     * @returns True if selected
     */
    isSelected(nodeId: string): boolean {
        return this.selectedIds.has(nodeId);
    }

    // ========================================================================
    // DUPLICATION
    // ========================================================================

    /**
     * Duplicate a node and its descendants
     * @param nodeId - Node ID to duplicate
     * @returns New node ID
     */
    duplicate(nodeId: string): string | null {
        try {
            const node = this.nodes.get(nodeId);
            if (!node) {
                console.warn(`[WorldOutliner] Node not found: ${nodeId}`);
                return null;
            }

            // Clone the node
            const newNode = node.clone();
            const idMap: Record<string, string> = { [nodeId]: newNode.id };

            // Add the cloned node
            this.addNode(newNode);

            // Clone all descendants
            const descendants = this.getDescendantIds(nodeId);
            for (const descId of descendants) {
                const descNode = this.nodes.get(descId);
                if (!descNode) continue;

                const newDescNode = descNode.clone();
                idMap[descId] = newDescNode.id;

                // Update parent reference to cloned parent
                const oldParentId = descNode.parentId!;
                newDescNode.setParentId(idMap[oldParentId]);

                this.addNode(newDescNode);
            }

            // Emit event
            this.events.emitNodeDuplicated(nodeId, newNode.id, idMap);

            console.log(`[WorldOutliner] Duplicated ${node.name} → ${newNode.name}`);
            return newNode.id;
        } catch (error) {
            console.error('[WorldOutliner] Error duplicating node:', error);
            return null;
        }
    }

    // ========================================================================
    // TRANSFORM PARENTING
    // ========================================================================

    /**
     * Update world transform for a node based on parent chain
     * @param nodeId - Node ID to update
     */
    updateWorldTransform(nodeId: string): void {
        const node = this.nodes.get(nodeId);
        if (!node?.sceneObjectId) return;

        const mesh = this.scene.getMeshById(node.sceneObjectId);
        if (!mesh) return;

        // Calculate world transform from parent chain
        const worldPosition = this.calculateWorldPosition(nodeId);
        const worldRotation = this.calculateWorldRotation(nodeId);
        const worldScale = this.calculateWorldScale(nodeId);

        // Apply to mesh
        mesh.position = worldPosition;
        mesh.rotationQuaternion = worldRotation;
        mesh.scaling = worldScale;

        // Update children recursively
        for (const childId of node.childIds) {
            this.updateWorldTransform(childId);
        }
    }

    /**
     * Calculate world position from parent chain
     * @param nodeId - Node ID
     * @returns World position
     */
    private calculateWorldPosition(nodeId: string): Vector3 {
        const node = this.nodes.get(nodeId);
        if (!node) return Vector3.Zero();

        let position = node.getPositionVector();

        if (node.parentId) {
            const parentPos = this.calculateWorldPosition(node.parentId);
            const parentRot = this.calculateWorldRotation(node.parentId);
            const parentScale = this.calculateWorldScale(node.parentId);

            // Transform local position by parent
            position = position.multiply(parentScale);
            position = position.rotateByQuaternionToRef(parentRot, position);
            position = position.add(parentPos);
        }

        return position;
    }

    /**
     * Calculate world rotation from parent chain
     * @param nodeId - Node ID
     * @returns World rotation
     */
    private calculateWorldRotation(nodeId: string): Quaternion {
        const node = this.nodes.get(nodeId);
        if (!node) return Quaternion.Identity();

        let rotation = node.getRotationQuaternion();

        if (node.parentId) {
            const parentRot = this.calculateWorldRotation(node.parentId);
            rotation = parentRot.multiply(rotation);
        }

        return rotation;
    }

    /**
     * Calculate world scale from parent chain
     * @param nodeId - Node ID
     * @returns World scale
     */
    private calculateWorldScale(nodeId: string): Vector3 {
        const node = this.nodes.get(nodeId);
        if (!node) return Vector3.One();

        let scale = node.getScaleVector();

        if (node.parentId) {
            const parentScale = this.calculateWorldScale(node.parentId);
            scale = scale.multiply(parentScale);
        }

        return scale;
    }

    // ========================================================================
    // SERIALIZATION
    // ========================================================================

    /**
     * Export the current state for saving
     * @returns Serializable state object
     */
    exportState(): OutlinerState {
        return {
            schemaVersion: SCHEMA_VERSION,
            nodes: Array.from(this.nodes.values()).map(n => n.toData()),
            selectedIds: Array.from(this.selectedIds),
            rootIds: [...this.rootIds],
            updatedAt: Date.now(),
        };
    }

    /**
     * Import state from saved data
     * @param state - Saved state object
     */
    importState(state: OutlinerState): void {
        try {
            console.log('[WorldOutliner] Importing state...');

            // Clear current state
            this.nodes.clear();
            this.rootIds = [];
            this.selectedIds.clear();
            this.categoryFolderIds.clear();

            // Recreate nodes
            for (const nodeData of state.nodes) {
                const node = OutlinerNode.fromData(nodeData);
                this.nodes.set(node.id, node);

                // Track category folders
                if (node.metadata.isDefaultCategory) {
                    const category = node.metadata.categoryType as DefaultCategory;
                    this.categoryFolderIds.set(category, node.id);
                }
            }

            // Restore root IDs
            this.rootIds = state.rootIds;

            // Restore selection
            for (const id of state.selectedIds) {
                if (this.nodes.has(id)) {
                    this.selectedIds.add(id);
                }
            }

            // Emit hierarchy changed
            this.events.emitHierarchyChanged(Array.from(this.nodes.keys()));

            console.log('[WorldOutliner] ✓ State imported:', this.nodes.size, 'nodes');
        } catch (error) {
            console.error('[WorldOutliner] Error importing state:', error);
            throw error;
        }
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
        this.initialized = false;

        console.log('[WorldOutliner] Disposed');
    }
}