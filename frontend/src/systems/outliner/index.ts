/**
 * index.ts - Outliner Module Exports
 * 
 * Path: frontend/src/systems/outliner/index.ts
 * 
 * Re-exports all outliner classes for convenient importing.
 * 
 * @module Outliner
 * 
 * @example
 * ```typescript
 * // Import the main WorldOutliner class
 * import { WorldOutliner } from './systems/outliner';
 * 
 * // Or import specific components
 * import { 
 *     WorldOutlinerCore, 
 *     NodeOperations, 
 *     StateManager 
 * } from './systems/outliner';
 * ```
 */

// ============================================================================
// MAIN OUTLINER CLASS
// ============================================================================

/**
 * Main WorldOutliner class - use this for complete outliner functionality
 */
export { WorldOutliner } from './WorldOutliner';
export type { OnNodeDeleteCallback } from './WorldOutlinerCore';

// ============================================================================
// COMPONENT CLASSES
// ============================================================================

/**
 * Core infrastructure - initialization, scene utilities, statistics
 * Can be extended for custom implementations
 */
export { WorldOutlinerCore, SCHEMA_VERSION, DEFAULT_CATEGORIES } from './WorldOutlinerCore';

/**
 * Node CRUD operations - create, delete, retrieve, modify, duplicate
 */
export { NodeOperations } from './NodeOperations';

/**
 * State management - selection, visibility, lock, expand/collapse, transforms, serialization
 */
export { StateManager } from './StateManager';

// ============================================================================
// EXISTING EXPORTS (unchanged from original structure)
// ============================================================================

/**
 * OutlinerNode - Individual node class
 */
export { OutlinerNode, generateNodeId } from './OutlinerNode';

/**
 * OutlinerEventEmitter - Event handling
 */
export { OutlinerEventEmitter } from './OutlinerEvents';