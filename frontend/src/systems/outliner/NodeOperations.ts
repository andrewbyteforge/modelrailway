/**
 * NodeOperations.ts - Node CRUD Operations
 * 
 * Path: frontend/src/systems/outliner/NodeOperations.ts
 * 
 * Provides all node manipulation operations:
 * - Creation (folders, items)
 * - Deletion (with descendant cleanup)
 * - Retrieval (get, find, ancestors, descendants)
 * - Modification (rename, move, reparent)
 * - Duplication (with hierarchy preservation)
 * 
 * @module NodeOperations
 */

import { OutlinerNode } from './OutlinerNode';
import { WorldOutlinerCore } from './WorldOutlinerCore';
import type {
    OutlinerNodeType,
    OutlinerTransform,
    DefaultCategory,
} from '../../types/outliner.types';
import { NODE_TYPE_TO_CATEGORY } from '../../types/outliner.types';

// ============================================================================
// NODE OPERATIONS CLASS
// ============================================================================

/**
 * Extends WorldOutlinerCore with node CRUD operations.
 * 
 * Provides methods for creating, deleting, retrieving, modifying,
 * and duplicating nodes within the outliner hierarchy.
 * 
 * @example
 * ```typescript
 * const outliner = new NodeOperations(scene);
 * outliner.initialize();
 * 
 * // Create a folder
 * const folderId = outliner.createFolder('My Station', 'Scenery');
 * 
 * // Create an item
 * const itemId = outliner.createItem({
 *     name: 'Station Building',
 *     type: 'scenery',
 *     sceneObjectId: mesh.uniqueId.toString(),
 *     parentId: folderId,
 * });
 * ```
 */
export class NodeOperations extends WorldOutlinerCore {
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
                const categoryId = this.getCategoryFolderId(parentId as DefaultCategory);
                if (categoryId) {
                    resolvedParentId = categoryId;
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

            console.log(`[NodeOperations] Created folder: ${name}`);
            return node.id;

        } catch (error) {
            console.error('[NodeOperations] Error creating folder:', error);
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
                if (category) {
                    const categoryId = this.getCategoryFolderId(category);
                    if (categoryId) {
                        parentId = categoryId;
                    }
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

            console.log(`[NodeOperations] Created item: ${options.name} (${options.type})`);
            return node.id;

        } catch (error) {
            console.error('[NodeOperations] Error creating item:', error);
            throw error;
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
                console.warn(`[NodeOperations] Node not found: ${nodeId}`);
                return false;
            }

            // Prevent deletion of default categories unless forced
            if (!force && node.metadata.isDefaultCategory) {
                console.warn(`[NodeOperations] Cannot delete default category: ${node.name}`);
                return false;
            }

            // Check if locked
            if (node.locked && !force) {
                console.warn(`[NodeOperations] Cannot delete locked node: ${node.name}`);
                return false;
            }

            // Get all descendant IDs before deletion
            const descendantIds = this.getDescendantIds(nodeId);

            // Remove from selection
            this.selectedIds.delete(nodeId);
            descendantIds.forEach(id => this.selectedIds.delete(id));

            // Delete all descendants first (depth-first)
            for (const descId of descendantIds.reverse()) {
                const descNode = this.nodes.get(descId);
                if (descNode) {
                    // Notify external systems before deletion
                    this.notifyDeleteCallbacks(descId, descNode.sceneObjectId, descNode.metadata);
                    // Remove from scene
                    this.removeNodeFromScene(descId);
                }
                this.nodes.delete(descId);
            }

            // Remove from parent's children
            if (node.parentId) {
                const parent = this.nodes.get(node.parentId);
                parent?.removeChildId(nodeId);
            } else if (this.rootIds) {
                // Remove from root
                const rootIndex = this.rootIds.indexOf(nodeId);
                if (rootIndex !== -1) {
                    this.rootIds.splice(rootIndex, 1);
                }
            }

            // Notify external systems before deletion
            this.notifyDeleteCallbacks(nodeId, node.sceneObjectId, node.metadata);

            // Remove from scene
            this.removeNodeFromScene(nodeId);

            // Delete the node
            this.nodes.delete(nodeId);

            // Emit event
            this.events.emitNodeDeleted(nodeId, node.type, node.parentId, descendantIds);

            console.log(`[NodeOperations] Deleted: ${node.name} (and ${descendantIds.length} descendants)`);
            return true;

        } catch (error) {
            console.error('[NodeOperations] Error deleting node:', error);
            throw error;
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
        // Safety guard - rootIds may be undefined during state import
        if (!this.rootIds || !Array.isArray(this.rootIds)) {
            console.warn('[NodeOperations] rootIds not initialized, returning empty array');
            return [];
        }
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
        const folderId = this.getCategoryFolderId(category);
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
            console.warn(`[NodeOperations] Node not found: ${nodeId}`);
            return;
        }

        if (node.locked) {
            console.warn(`[NodeOperations] Cannot rename locked node: ${node.name}`);
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
                console.warn(`[NodeOperations] Node not found: ${nodeId}`);
                return;
            }

            if (node.locked) {
                console.warn(`[NodeOperations] Cannot move locked node: ${node.name}`);
                return;
            }

            // Prevent moving into self or descendant
            if (newParentId) {
                if (newParentId === nodeId) {
                    console.warn('[NodeOperations] Cannot move node into itself');
                    return;
                }

                const descendants = this.getDescendantIds(nodeId);
                if (descendants.includes(newParentId)) {
                    console.warn('[NodeOperations] Cannot move node into its descendant');
                    return;
                }
            }

            const oldParentId = node.parentId;
            const oldSortOrder = node.sortOrder;

            // Remove from old parent
            if (oldParentId) {
                const oldParent = this.nodes.get(oldParentId);
                oldParent?.removeChildId(nodeId);
            } else if (this.rootIds) {
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
            } else if (this.rootIds) {
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

            // Emit event
            this.events.emitNodeMoved(nodeId, oldParentId, newParentId, oldSortOrder, node.sortOrder);

            console.log(`[NodeOperations] Moved ${node.name} to ${newParentId ?? 'root'}`);

        } catch (error) {
            console.error('[NodeOperations] Error moving node:', error);
            throw error;
        }
    }

    /**
     * Recalculate sort orders for children of a parent
     * @param parentId - Parent ID (null for root)
     */
    protected recalculateSortOrders(parentId: string | null): void {
        const childIds = parentId
            ? this.nodes.get(parentId)?.childIds ?? []
            : (this.rootIds ?? []);

        childIds.forEach((id, index) => {
            const node = this.nodes.get(id);
            node?.setSortOrder(index);
        });
    }

    // ========================================================================
    // NODE DUPLICATION
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
                console.warn(`[NodeOperations] Node not found: ${nodeId}`);
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

            console.log(`[NodeOperations] Duplicated ${node.name} → ${newNode.name}`);
            return newNode.id;

        } catch (error) {
            console.error('[NodeOperations] Error duplicating node:', error);
            return null;
        }
    }
}