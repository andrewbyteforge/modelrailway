/**
 * OutlinerNode.ts - Individual node in the World Outliner hierarchy
 * 
 * Path: frontend/src/systems/outliner/OutlinerNode.ts
 * 
 * Represents a single item in the outliner tree - either a folder
 * for organisation or a reference to a scene object.
 * 
 * @module OutlinerNode
 */

import { Vector3, Quaternion } from '@babylonjs/core/Maths/math';
import type {
    OutlinerNodeData,
    OutlinerNodeType,
    OutlinerTransform
} from '../../types/outliner.types';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a unique ID for outliner nodes
 * @returns Unique string ID
 */
export function generateNodeId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a default identity transform
 * @returns Identity transform object
 */
export function createIdentityTransform(): OutlinerTransform {
    return {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 }, // Identity quaternion
        scale: { x: 1, y: 1, z: 1 },
    };
}

// ============================================================================
// OUTLINER NODE CLASS
// ============================================================================

/**
 * OutlinerNode - Represents a single node in the outliner tree
 * 
 * Can be either:
 * - A folder (container for other nodes)
 * - An item (reference to a scene object)
 * 
 * Supports:
 * - Hierarchical parent-child relationships
 * - Transform parenting (moving parent moves children)
 * - Visibility and lock states
 * - Metadata storage
 * 
 * @example
 * ```typescript
 * // Create a folder
 * const folder = new OutlinerNode({
 *     name: 'My Buildings',
 *     type: 'folder',
 * });
 * 
 * // Create an item
 * const building = new OutlinerNode({
 *     name: 'Station',
 *     type: 'scenery',
 *     sceneObjectId: 'mesh_station_001',
 * });
 * ```
 */
export class OutlinerNode {
    // ========================================================================
    // PROPERTIES
    // ========================================================================

    /** Unique identifier */
    private _id: string;

    /** Display name */
    private _name: string;

    /** Type of node */
    private _type: OutlinerNodeType;

    /** Parent node ID */
    private _parentId: string | null;

    /** Child node IDs */
    private _childIds: string[];

    /** Sort order within parent */
    private _sortOrder: number;

    /** Visibility state */
    private _visible: boolean;

    /** Lock state */
    private _locked: boolean;

    /** Expanded state (for folders) */
    private _expanded: boolean;

    /** Reference to scene object */
    private _sceneObjectId: string | null;

    /** Local transform */
    private _localTransform: OutlinerTransform;

    /** Additional metadata */
    private _metadata: Record<string, unknown>;

    /** Creation timestamp */
    private _createdAt: number;

    /** Last modified timestamp */
    private _updatedAt: number;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new OutlinerNode
     * @param options - Node configuration options
     */
    constructor(options: {
        id?: string;
        name: string;
        type: OutlinerNodeType;
        parentId?: string | null;
        childIds?: string[];
        sortOrder?: number;
        visible?: boolean;
        locked?: boolean;
        expanded?: boolean;
        sceneObjectId?: string | null;
        localTransform?: OutlinerTransform;
        metadata?: Record<string, unknown>;
        createdAt?: number;
        updatedAt?: number;
    }) {
        const now = Date.now();

        this._id = options.id ?? generateNodeId();
        this._name = options.name;
        this._type = options.type;
        this._parentId = options.parentId ?? null;
        this._childIds = options.childIds ?? [];
        this._sortOrder = options.sortOrder ?? 0;
        this._visible = options.visible ?? true;
        this._locked = options.locked ?? false;
        this._expanded = options.expanded ?? true;
        this._sceneObjectId = options.sceneObjectId ?? null;
        this._localTransform = options.localTransform ?? createIdentityTransform();
        this._metadata = options.metadata ?? {};
        this._createdAt = options.createdAt ?? now;
        this._updatedAt = options.updatedAt ?? now;

        console.log(`[OutlinerNode] Created: ${this._name} (${this._type})`);
    }

    // ========================================================================
    // GETTERS
    // ========================================================================

    /** Get unique ID */
    get id(): string {
        return this._id;
    }

    /** Get display name */
    get name(): string {
        return this._name;
    }

    /** Get node type */
    get type(): OutlinerNodeType {
        return this._type;
    }

    /** Get parent ID */
    get parentId(): string | null {
        return this._parentId;
    }

    /** Get child IDs */
    get childIds(): string[] {
        return [...this._childIds]; // Return copy to prevent external mutation
    }

    /** Get sort order */
    get sortOrder(): number {
        return this._sortOrder;
    }

    /** Get visibility state */
    get visible(): boolean {
        return this._visible;
    }

    /** Get lock state */
    get locked(): boolean {
        return this._locked;
    }

    /** Get expanded state */
    get expanded(): boolean {
        return this._expanded;
    }

    /** Get scene object ID */
    get sceneObjectId(): string | null {
        return this._sceneObjectId;
    }

    /** Get local transform (copy) */
    get localTransform(): OutlinerTransform {
        return {
            position: { ...this._localTransform.position },
            rotation: { ...this._localTransform.rotation },
            scale: { ...this._localTransform.scale },
        };
    }

    /** Get metadata (copy) */
    get metadata(): Record<string, unknown> {
        return { ...this._metadata };
    }

    /** Get creation timestamp */
    get createdAt(): number {
        return this._createdAt;
    }

    /** Get last modified timestamp */
    get updatedAt(): number {
        return this._updatedAt;
    }

    /** Check if this is a folder */
    get isFolder(): boolean {
        return this._type === 'folder';
    }

    /** Check if this node has children */
    get hasChildren(): boolean {
        return this._childIds.length > 0;
    }

    /** Get number of direct children */
    get childCount(): number {
        return this._childIds.length;
    }

    /** Check if this is a root node (no parent) */
    get isRoot(): boolean {
        return this._parentId === null;
    }

    // ========================================================================
    // SETTERS (with timestamp update)
    // ========================================================================

    /**
     * Set the display name
     * @param value - New name
     */
    setName(value: string): void {
        if (value !== this._name) {
            console.log(`[OutlinerNode] Rename: "${this._name}" → "${value}"`);
            this._name = value;
            this._updatedAt = Date.now();
        }
    }

    /**
     * Set the parent ID
     * @param value - New parent ID or null for root
     */
    setParentId(value: string | null): void {
        if (value !== this._parentId) {
            console.log(`[OutlinerNode] ${this._name}: parent changed to ${value ?? 'root'}`);
            this._parentId = value;
            this._updatedAt = Date.now();
        }
    }

    /**
     * Set the sort order
     * @param value - New sort order
     */
    setSortOrder(value: number): void {
        if (value !== this._sortOrder) {
            this._sortOrder = value;
            this._updatedAt = Date.now();
        }
    }

    /**
     * Set visibility state
     * @param value - New visibility
     */
    setVisible(value: boolean): void {
        if (value !== this._visible) {
            console.log(`[OutlinerNode] ${this._name}: visibility = ${value}`);
            this._visible = value;
            this._updatedAt = Date.now();
        }
    }

    /**
     * Set lock state
     * @param value - New lock state
     */
    setLocked(value: boolean): void {
        if (value !== this._locked) {
            console.log(`[OutlinerNode] ${this._name}: locked = ${value}`);
            this._locked = value;
            this._updatedAt = Date.now();
        }
    }

    /**
     * Set expanded state
     * @param value - New expanded state
     */
    setExpanded(value: boolean): void {
        if (value !== this._expanded) {
            this._expanded = value;
            this._updatedAt = Date.now();
        }
    }

    /**
     * Set scene object ID
     * @param value - New scene object ID
     */
    setSceneObjectId(value: string | null): void {
        if (value !== this._sceneObjectId) {
            this._sceneObjectId = value;
            this._updatedAt = Date.now();
        }
    }

    /**
     * Set local transform
     * @param transform - New transform
     */
    setLocalTransform(transform: OutlinerTransform): void {
        this._localTransform = {
            position: { ...transform.position },
            rotation: { ...transform.rotation },
            scale: { ...transform.scale },
        };
        this._updatedAt = Date.now();
    }

    /**
     * Set a metadata value
     * @param key - Metadata key
     * @param value - Metadata value
     */
    setMetadata(key: string, value: unknown): void {
        this._metadata[key] = value;
        this._updatedAt = Date.now();
    }

    /**
     * Remove a metadata value
     * @param key - Metadata key to remove
     */
    removeMetadata(key: string): void {
        if (key in this._metadata) {
            delete this._metadata[key];
            this._updatedAt = Date.now();
        }
    }

    // ========================================================================
    // CHILD MANAGEMENT
    // ========================================================================

    /**
     * Add a child node ID
     * @param childId - Child node ID to add
     * @param index - Optional insertion index
     */
    addChildId(childId: string, index?: number): void {
        if (this._childIds.includes(childId)) {
            console.warn(`[OutlinerNode] Child ${childId} already exists in ${this._name}`);
            return;
        }

        if (index !== undefined && index >= 0 && index <= this._childIds.length) {
            this._childIds.splice(index, 0, childId);
        } else {
            this._childIds.push(childId);
        }

        this._updatedAt = Date.now();
        console.log(`[OutlinerNode] ${this._name}: added child ${childId}`);
    }

    /**
     * Remove a child node ID
     * @param childId - Child node ID to remove
     * @returns True if removed, false if not found
     */
    removeChildId(childId: string): boolean {
        const index = this._childIds.indexOf(childId);
        if (index === -1) {
            return false;
        }

        this._childIds.splice(index, 1);
        this._updatedAt = Date.now();
        console.log(`[OutlinerNode] ${this._name}: removed child ${childId}`);
        return true;
    }

    /**
     * Move a child to a new index
     * @param childId - Child node ID
     * @param newIndex - New index position
     * @returns True if moved, false if not found
     */
    moveChildTo(childId: string, newIndex: number): boolean {
        const currentIndex = this._childIds.indexOf(childId);
        if (currentIndex === -1) {
            return false;
        }

        // Remove from current position
        this._childIds.splice(currentIndex, 1);

        // Insert at new position
        const clampedIndex = Math.max(0, Math.min(newIndex, this._childIds.length));
        this._childIds.splice(clampedIndex, 0, childId);

        this._updatedAt = Date.now();
        return true;
    }

    /**
     * Get the index of a child
     * @param childId - Child node ID
     * @returns Index or -1 if not found
     */
    getChildIndex(childId: string): number {
        return this._childIds.indexOf(childId);
    }

    /**
     * Clear all children
     */
    clearChildren(): void {
        this._childIds = [];
        this._updatedAt = Date.now();
    }

    // ========================================================================
    // TRANSFORM HELPERS
    // ========================================================================

    /**
     * Set position component of transform
     * @param x - X coordinate
     * @param y - Y coordinate  
     * @param z - Z coordinate
     */
    setPosition(x: number, y: number, z: number): void {
        this._localTransform.position = { x, y, z };
        this._updatedAt = Date.now();
    }

    /**
     * Set rotation component of transform (quaternion)
     * @param x - X component
     * @param y - Y component
     * @param z - Z component
     * @param w - W component
     */
    setRotation(x: number, y: number, z: number, w: number): void {
        this._localTransform.rotation = { x, y, z, w };
        this._updatedAt = Date.now();
    }

    /**
     * Set scale component of transform
     * @param x - X scale
     * @param y - Y scale
     * @param z - Z scale
     */
    setScale(x: number, y: number, z: number): void {
        this._localTransform.scale = { x, y, z };
        this._updatedAt = Date.now();
    }

    /**
     * Get position as Babylon.js Vector3
     * @returns Vector3 position
     */
    getPositionVector(): Vector3 {
        const { x, y, z } = this._localTransform.position;
        return new Vector3(x, y, z);
    }

    /**
     * Get rotation as Babylon.js Quaternion
     * @returns Quaternion rotation
     */
    getRotationQuaternion(): Quaternion {
        const { x, y, z, w } = this._localTransform.rotation;
        return new Quaternion(x, y, z, w);
    }

    /**
     * Get scale as Babylon.js Vector3
     * @returns Vector3 scale
     */
    getScaleVector(): Vector3 {
        const { x, y, z } = this._localTransform.scale;
        return new Vector3(x, y, z);
    }

    // ========================================================================
    // SERIALIZATION
    // ========================================================================

    /**
     * Convert node to serializable data object
     * @returns Plain data object
     */
    toData(): OutlinerNodeData {
        return {
            id: this._id,
            name: this._name,
            type: this._type,
            parentId: this._parentId,
            childIds: [...this._childIds],
            sortOrder: this._sortOrder,
            visible: this._visible,
            locked: this._locked,
            expanded: this._expanded,
            sceneObjectId: this._sceneObjectId,
            localTransform: this.localTransform,
            metadata: { ...this._metadata },
            createdAt: this._createdAt,
            updatedAt: this._updatedAt,
        };
    }

    /**
     * Create a node from serialized data
     * @param data - Serialized node data
     * @returns New OutlinerNode instance
     */
    static fromData(data: OutlinerNodeData): OutlinerNode {
        return new OutlinerNode({
            id: data.id,
            name: data.name,
            type: data.type,
            parentId: data.parentId,
            childIds: data.childIds,
            sortOrder: data.sortOrder,
            visible: data.visible,
            locked: data.locked,
            expanded: data.expanded,
            sceneObjectId: data.sceneObjectId,
            localTransform: data.localTransform,
            metadata: data.metadata,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
        });
    }

    /**
     * Create a deep clone of this node
     * @param newId - Optional new ID (generates new if not provided)
     * @returns Cloned node
     */
    clone(newId?: string): OutlinerNode {
        const now = Date.now();
        return new OutlinerNode({
            id: newId ?? generateNodeId(),
            name: `${this._name} (Copy)`,
            type: this._type,
            parentId: this._parentId,
            childIds: [], // Children are not cloned - must be handled separately
            sortOrder: this._sortOrder + 1,
            visible: this._visible,
            locked: false, // Clones start unlocked
            expanded: this._expanded,
            sceneObjectId: null, // Scene object must be duplicated separately
            localTransform: this.localTransform,
            metadata: { ...this._metadata },
            createdAt: now,
            updatedAt: now,
        });
    }

    // ========================================================================
    // DEBUG
    // ========================================================================

    /**
     * Get a string representation for debugging
     * @returns Debug string
     */
    toString(): string {
        const parts = [
            `OutlinerNode[${this._id}]`,
            `name="${this._name}"`,
            `type=${this._type}`,
            `children=${this._childIds.length}`,
        ];

        if (this._parentId) {
            parts.push(`parent=${this._parentId}`);
        }

        if (!this._visible) {
            parts.push('(hidden)');
        }

        if (this._locked) {
            parts.push('(locked)');
        }

        return parts.join(' ');
    }
}