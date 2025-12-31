/**
 * WorldOutliner.ts - Complete World Outliner System
 * 
 * Path: frontend/src/systems/outliner/WorldOutliner.ts
 * 
 * Main entry point for the World Outliner system.
 * Extends StateManager to provide the complete API for managing scene hierarchy.
 * 
 * Features:
 * - Folders and nested organisation
 * - Auto-grouping by asset type
 * - Transform parenting (moving parent moves children)
 * - Selection management
 * - Visibility and lock states
 * - Serialization for save/load
 * - Proper scene object disposal for imported models
 * 
 * @module WorldOutliner
 */

import { Scene } from '@babylonjs/core/scene';

import { StateManager } from './StateManager';

// Re-export types for convenience
export type { OnNodeDeleteCallback } from './WorldOutlinerCore';

// ============================================================================
// WORLD OUTLINER CLASS
// ============================================================================

/**
 * WorldOutliner - Main system for managing scene hierarchy.
 * 
 * Provides a tree structure for organising all scene objects with support
 * for folders, selection, visibility, and transform parenting.
 * 
 * This class combines all functionality from:
 * - WorldOutlinerCore: Core infrastructure, initialization, scene utilities
 * - NodeOperations: CRUD operations for nodes
 * - StateManager: Selection, visibility, lock, transforms, serialization
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
 * 
 * // Toggle visibility
 * outliner.toggleVisibility(stationId);
 * 
 * // Export state for saving
 * const state = outliner.exportState();
 * ```
 */
export class WorldOutliner extends StateManager {
    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new WorldOutliner
     * @param scene - Babylon.js scene
     */
    constructor(scene: Scene) {
        super(scene);
        console.log('[WorldOutliner] Created');
    }

    // ========================================================================
    // INITIALIZATION OVERRIDE
    // ========================================================================

    /**
     * Initialize the outliner with default category folders.
     * Overrides parent to provide WorldOutliner-specific logging.
     */
    initialize(): void {
        console.log('[WorldOutliner] Initializing...');
        super.initialize();
        console.log('[WorldOutliner] ✓ Ready');
    }

    // ========================================================================
    // DISPOSAL OVERRIDE
    // ========================================================================

    /**
     * Dispose of the outliner and clean up resources.
     * Overrides parent to provide WorldOutliner-specific logging.
     */
    dispose(): void {
        console.log('[WorldOutliner] Disposing...');
        super.dispose();
        console.log('[WorldOutliner] ✓ Disposed');
    }
}