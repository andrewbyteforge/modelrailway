/**
 * StateManager.ts - Outliner State Management
 * 
 * Path: frontend/src/systems/outliner/StateManager.ts
 * 
 * Provides all state management operations:
 * - Selection (single, multi, toggle, clear)
 * - Visibility (show, hide, toggle, recursive)
 * - Lock state (prevent modifications)
 * - Expand/collapse (folders)
 * - Transform parenting (world position/rotation/scale)
 * - Serialization (export/import state)
 * 
 * @module StateManager
 */

import { Vector3, Quaternion } from '@babylonjs/core/Maths/math';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';

import { OutlinerNode } from './OutlinerNode';
import { NodeOperations } from './NodeOperations';
import { SCHEMA_VERSION } from './WorldOutlinerCore';
import type { OutlinerState, OutlinerNodeData, DefaultCategory } from '../../types/outliner.types';

// ============================================================================
// STATE MANAGER CLASS
// ============================================================================

/**
 * Extends NodeOperations with state management capabilities.
 * 
 * Provides methods for managing selection, visibility, lock state,
 * expand/collapse, transform parenting, and serialization.
 * 
 * @example
 * ```typescript
 * const outliner = new StateManager(scene);
 * outliner.initialize();
 * 
 * // Select a node
 * outliner.select(nodeId);
 * 
 * // Toggle visibility
 * outliner.toggleVisibility(nodeId, true);
 * 
 * // Export state
 * const state = outliner.exportState();
 * ```
 */
export class StateManager extends NodeOperations {
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
    // VISIBILITY
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

    // ========================================================================
    // LOCK STATE
    // ========================================================================

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
    // TRANSFORM PARENTING
    // ========================================================================

    /**
     * Update world transform for a node based on parent chain
     * @param nodeId - Node ID to update
     */
    updateWorldTransform(nodeId: string): void {
        const node = this.nodes.get(nodeId);
        if (!node?.sceneObjectId) return;

        const sceneNode = this.findSceneNodeByUniqueId(node.sceneObjectId);
        if (!sceneNode || !(sceneNode instanceof TransformNode || sceneNode instanceof AbstractMesh)) return;

        // Calculate world transform from parent chain
        const worldPosition = this.calculateWorldPosition(nodeId);
        const worldRotation = this.calculateWorldRotation(nodeId);
        const worldScale = this.calculateWorldScale(nodeId);

        // Apply to mesh/transform node
        sceneNode.position = worldPosition;
        sceneNode.rotationQuaternion = worldRotation;
        sceneNode.scaling = worldScale;

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
            console.log('[StateManager] Importing state...');

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

            console.log('[StateManager] ✓ State imported:', this.nodes.size, 'nodes');

        } catch (error) {
            console.error('[StateManager] Error importing state:', error);
            throw error;
        }
    }
}