/**
 * outliner.types.ts - Type definitions for the World Outliner system
 * 
 * Path: frontend/src/types/outliner.types.ts
 * 
 * Defines all interfaces and types used by the World Outliner.
 * Core types are imported from railway.types.ts for consistency.
 * 
 * @module OutlinerTypes
 * @version 2.0.0 - Refactored to use unified types
 */

// ============================================================================
// IMPORTS FROM UNIFIED TYPES
// ============================================================================

// Type-only imports (erased at runtime)
import type {
    OutlinerNodeType,
    DefaultOutlinerCategory,
    AssetCategory,
    Transform3D,
} from './railway.types';

// Value imports (exist at runtime)
import {
    NODE_TYPE_TO_CATEGORY,
    NODE_TYPE_ICONS,
    OUTLINER_CATEGORY_ICONS,
    getOutlinerNodeType,
    IDENTITY_TRANSFORM,
} from './railway.types';

// ============================================================================
// RE-EXPORTS FOR BACKWARDS COMPATIBILITY
// ============================================================================

// Re-export types
export type {
    OutlinerNodeType,
};

// Re-export values
export {
    NODE_TYPE_TO_CATEGORY,
    NODE_TYPE_ICONS,
    getOutlinerNodeType,
};

// Legacy aliases
export type DefaultCategory = DefaultOutlinerCategory;
export const CATEGORY_ICONS = OUTLINER_CATEGORY_ICONS;

// Legacy helper function (now uses unified version)
export function getNodeTypeForCategory(category: string): OutlinerNodeType {
    return getOutlinerNodeType(category);
}

// Legacy mapping (now uses unified version)
export const MODEL_CATEGORY_TO_NODE_TYPE: Record<string, OutlinerNodeType> = {
    'rolling_stock': 'rolling_stock',
    'locomotive': 'rolling_stock',
    'coach': 'rolling_stock',
    'wagon': 'rolling_stock',
    'scenery': 'scenery',
    'building': 'scenery',
    'buildings': 'scenery',
    'structure': 'scenery',
    'vegetation': 'scenery',
    'accessory': 'scenery',
    'accessories': 'scenery',
    'infrastructure': 'scenery',
    'vehicles': 'scenery',
    'figures': 'scenery',
    'custom': 'model',
};

// ============================================================================
// OUTLINER TRANSFORM (uses unified Transform3D)
// ============================================================================

/**
 * Transform data for outliner nodes
 * Alias for unified Transform3D
 */
export type OutlinerTransform = Transform3D;

/**
 * Default transform
 */
export const DEFAULT_OUTLINER_TRANSFORM: OutlinerTransform = IDENTITY_TRANSFORM;

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

    /** Local transform relative to parent */
    localTransform: OutlinerTransform;

    /** Metadata for additional properties */
    metadata: Record<string, unknown>;

    /** Creation timestamp */
    createdAt: number;

    /** Last modified timestamp */
    updatedAt: number;
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

/**
 * Default empty outliner state
 */
export const DEFAULT_OUTLINER_STATE: OutlinerState = {
    schemaVersion: '2.0.0',
    nodes: [],
    selectedIds: [],
    rootIds: [],
    updatedAt: Date.now()
};

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
    additive: boolean;
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
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a new outliner node with defaults
 */
export function createOutlinerNode(
    partial: Partial<OutlinerNodeData> & { id: string; name: string; type: OutlinerNodeType }
): OutlinerNodeData {
    const now = Date.now();
    return {
        id: partial.id,
        name: partial.name,
        type: partial.type,
        parentId: partial.parentId ?? null,
        childIds: partial.childIds ?? [],
        sortOrder: partial.sortOrder ?? 0,
        visible: partial.visible ?? true,
        locked: partial.locked ?? false,
        expanded: partial.expanded ?? true,
        sceneObjectId: partial.sceneObjectId ?? null,
        localTransform: partial.localTransform ?? { ...IDENTITY_TRANSFORM },
        metadata: partial.metadata ?? {},
        createdAt: partial.createdAt ?? now,
        updatedAt: partial.updatedAt ?? now,
    };
}

/**
 * Get icon for a node
 */
export function getNodeIcon(type: OutlinerNodeType): string {
    return NODE_TYPE_ICONS[type] || '📦';
}

/**
 * Get icon for a category folder
 */
export function getCategoryIcon(category: DefaultOutlinerCategory): string {
    return OUTLINER_CATEGORY_ICONS[category] || '📁';
}