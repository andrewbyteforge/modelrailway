/**
 * outliner.types.ts - Type definitions for the World Outliner system
 * 
 * Path: frontend/src/types/outliner.types.ts
 * 
 * Defines all interfaces and types used by the World Outliner,
 * including nodes, folders, items, and event payloads.
 * 
 * @module OutlinerTypes
 */

import { Vector3, Quaternion } from '@babylonjs/core/Maths/math';

// ============================================================================
// NODE TYPES
// ============================================================================

/**
 * Types of nodes that can exist in the outliner
 */
export type OutlinerNodeType =
    | 'folder'          // Organisational folder (can contain children)
    | 'baseboard'       // Baseboard item
    | 'track'           // Track piece
    | 'rolling_stock'   // Trains, wagons, etc.
    | 'scenery'         // Buildings, trees, etc.
    | 'light'           // Light sources
    | 'model';          // Generic imported 3D model

/**
 * Default category folders that are auto-created
 */
export type DefaultCategory =
    | 'Baseboards'
    | 'Track'
    | 'Rolling Stock'
    | 'Scenery'
    | 'Lights';

/**
 * Map of node types to their default parent category
 */
export const NODE_TYPE_TO_CATEGORY: Record<Exclude<OutlinerNodeType, 'folder'>, DefaultCategory> = {
    baseboard: 'Baseboards',
    track: 'Track',
    rolling_stock: 'Rolling Stock',
    scenery: 'Scenery',
    light: 'Lights',
    model: 'Scenery', // Models default to Scenery
};

// ============================================================================
// NODE DATA INTERFACES
// ============================================================================

/**
 * Base interface for all outliner nodes
 */
export interface OutlinerNodeData {
    /** Unique identifier */
    id: string;

    /** Display name */
    name: string;

    /** Type of node */
    type: OutlinerNodeType;

    /** Parent node ID (null for root items) */
    parentId: string | null;

    /** Child node IDs (for folders) */
    childIds: string[];

    /** Sort order within parent */
    sortOrder: number;

    /** Whether the node is visible in 3D view */
    visible: boolean;

    /** Whether the node is locked (prevents modification) */
    locked: boolean;

    /** Whether folder is expanded in UI */
    expanded: boolean;

    /** Reference to scene object ID (for non-folder nodes) */
    sceneObjectId: string | null;

    /** Local transform relative to parent (for transform parenting) */
    localTransform: OutlinerTransform;

    /** Metadata for additional properties */
    metadata: Record<string, unknown>;

    /** Creation timestamp */
    createdAt: number;

    /** Last modified timestamp */
    updatedAt: number;
}

/**
 * Transform data for position, rotation, scale
 */
export interface OutlinerTransform {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number }; // Quaternion
    scale: { x: number; y: number; z: number };
}

/**
 * Serializable outliner state for saving/loading
 */
export interface OutlinerState {
    /** Schema version for migrations */
    schemaVersion: string;

    /** All nodes in flat structure */
    nodes: OutlinerNodeData[];

    /** Currently selected node IDs */
    selectedIds: string[];

    /** Root node IDs (nodes with no parent) */
    rootIds: string[];

    /** Last modified timestamp */
    updatedAt: number;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Event types emitted by the World Outliner
 */
export type OutlinerEventType =
    | 'node:created'
    | 'node:deleted'
    | 'node:renamed'
    | 'node:moved'
    | 'node:visibility_changed'
    | 'node:lock_changed'
    | 'node:expanded_changed'
    | 'node:selected'
    | 'node:deselected'
    | 'node:duplicated'
    | 'selection:changed'
    | 'hierarchy:changed';

/**
 * Base event payload
 */
export interface OutlinerEventBase {
    type: OutlinerEventType;
    timestamp: number;
}

/**
 * Node created event
 */
export interface NodeCreatedEvent extends OutlinerEventBase {
    type: 'node:created';
    nodeId: string;
    nodeType: OutlinerNodeType;
    parentId: string | null;
}

/**
 * Node deleted event
 */
export interface NodeDeletedEvent extends OutlinerEventBase {
    type: 'node:deleted';
    nodeId: string;
    nodeType: OutlinerNodeType;
    parentId: string | null;
    /** IDs of all descendants that were also deleted */
    deletedDescendantIds: string[];
}

/**
 * Node renamed event
 */
export interface NodeRenamedEvent extends OutlinerEventBase {
    type: 'node:renamed';
    nodeId: string;
    oldName: string;
    newName: string;
}

/**
 * Node moved event (reparented or reordered)
 */
export interface NodeMovedEvent extends OutlinerEventBase {
    type: 'node:moved';
    nodeId: string;
    oldParentId: string | null;
    newParentId: string | null;
    oldSortOrder: number;
    newSortOrder: number;
}

/**
 * Node visibility changed event
 */
export interface NodeVisibilityChangedEvent extends OutlinerEventBase {
    type: 'node:visibility_changed';
    nodeId: string;
    visible: boolean;
    /** IDs of descendants also affected */
    affectedDescendantIds: string[];
}

/**
 * Node lock changed event
 */
export interface NodeLockChangedEvent extends OutlinerEventBase {
    type: 'node:lock_changed';
    nodeId: string;
    locked: boolean;
}

/**
 * Node expanded/collapsed event
 */
export interface NodeExpandedChangedEvent extends OutlinerEventBase {
    type: 'node:expanded_changed';
    nodeId: string;
    expanded: boolean;
}

/**
 * Node selected event
 */
export interface NodeSelectedEvent extends OutlinerEventBase {
    type: 'node:selected';
    nodeId: string;
    additive: boolean; // Was shift/ctrl held
}

/**
 * Node deselected event
 */
export interface NodeDeselectedEvent extends OutlinerEventBase {
    type: 'node:deselected';
    nodeId: string;
}

/**
 * Selection changed event (aggregate)
 */
export interface SelectionChangedEvent extends OutlinerEventBase {
    type: 'selection:changed';
    selectedIds: string[];
    previousSelectedIds: string[];
}

/**
 * Node duplicated event
 */
export interface NodeDuplicatedEvent extends OutlinerEventBase {
    type: 'node:duplicated';
    sourceNodeId: string;
    newNodeId: string;
    /** Map of original descendant IDs to new IDs */
    descendantIdMap: Record<string, string>;
}

/**
 * Hierarchy changed event (for bulk operations)
 */
export interface HierarchyChangedEvent extends OutlinerEventBase {
    type: 'hierarchy:changed';
    affectedNodeIds: string[];
}

/**
 * Union of all event types
 */
export type OutlinerEvent =
    | NodeCreatedEvent
    | NodeDeletedEvent
    | NodeRenamedEvent
    | NodeMovedEvent
    | NodeVisibilityChangedEvent
    | NodeLockChangedEvent
    | NodeExpandedChangedEvent
    | NodeSelectedEvent
    | NodeDeselectedEvent
    | SelectionChangedEvent
    | NodeDuplicatedEvent
    | HierarchyChangedEvent;

/**
 * Event listener callback type
 */
export type OutlinerEventListener<T extends OutlinerEvent = OutlinerEvent> = (event: T) => void;

// ============================================================================
// UI CONFIGURATION
// ============================================================================

/**
 * Configuration for outliner UI appearance
 */
export interface OutlinerUIConfig {
    /** Indentation per nesting level in pixels */
    indentSize: number;

    /** Row height in pixels */
    rowHeight: number;

    /** Show icons for node types */
    showIcons: boolean;

    /** Enable drag and drop */
    enableDragDrop: boolean;

    /** Enable multi-selection */
    enableMultiSelect: boolean;

    /** Enable inline renaming */
    enableInlineRename: boolean;

    /** Default expanded state for new folders */
    defaultExpanded: boolean;
}

/**
 * Default UI configuration
 */
export const DEFAULT_OUTLINER_UI_CONFIG: OutlinerUIConfig = {
    indentSize: 16,
    rowHeight: 28,
    showIcons: true,
    enableDragDrop: true,
    enableMultiSelect: true,
    enableInlineRename: true,
    defaultExpanded: true,
};

// ============================================================================
// ICON DEFINITIONS
// ============================================================================

/**
 * Icons for each node type (using emoji for simplicity)
 */
export const NODE_TYPE_ICONS: Record<OutlinerNodeType, string> = {
    folder: '📁',
    baseboard: '🟫',
    track: '🛤️',
    rolling_stock: '🚂',
    scenery: '🏠',
    light: '💡',
    model: '📦',
};

/**
 * Icons for default category folders
 */
export const CATEGORY_ICONS: Record<DefaultCategory, string> = {
    'Baseboards': '🟫',
    'Track': '🛤️',
    'Rolling Stock': '🚂',
    'Scenery': '🏠',
    'Lights': '💡',
};