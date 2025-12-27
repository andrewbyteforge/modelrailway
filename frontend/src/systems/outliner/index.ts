/**
 * Outliner System - Index file
 * 
 * Path: frontend/src/systems/outliner/index.ts
 * 
 * Re-exports all outliner system components for convenient importing.
 * 
 * @module OutlinerSystem
 */

// Core classes
export { OutlinerNode, generateNodeId, createIdentityTransform } from './OutlinerNode';
export { WorldOutliner } from './WorldOutliner';
export {
    OutlinerEventEmitter,
    getSharedOutlinerEvents,
    resetSharedOutlinerEvents
} from './OutlinerEvents';

// Re-export types
export type {
    OutlinerNodeType,
    DefaultCategory,
    OutlinerNodeData,
    OutlinerTransform,
    OutlinerState,
    OutlinerEventType,
    OutlinerEvent,
    OutlinerEventListener,
    OutlinerUIConfig,
    NodeCreatedEvent,
    NodeDeletedEvent,
    NodeRenamedEvent,
    NodeMovedEvent,
    NodeVisibilityChangedEvent,
    NodeLockChangedEvent,
    NodeExpandedChangedEvent,
    NodeSelectedEvent,
    NodeDeselectedEvent,
    SelectionChangedEvent,
    NodeDuplicatedEvent,
    HierarchyChangedEvent,
} from '../../types/outliner.types';

// Re-export constants
export {
    NODE_TYPE_TO_CATEGORY,
    NODE_TYPE_ICONS,
    CATEGORY_ICONS,
    DEFAULT_OUTLINER_UI_CONFIG,
} from '../../types/outliner.types';