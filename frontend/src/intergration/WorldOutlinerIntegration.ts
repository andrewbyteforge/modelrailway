/**
 * WorldOutlinerIntegration.ts - Example integration for World Outliner
 * 
 * Path: frontend/src/integration/WorldOutlinerIntegration.ts
 * 
 * This file demonstrates how to integrate the World Outliner system
 * with your existing App.ts. Copy the relevant sections into your
 * actual App.ts implementation.
 * 
 * @module WorldOutlinerIntegration
 */

import { Scene } from '@babylonjs/core/scene';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';

// Import outliner system
import { WorldOutliner } from '../systems/outliner/WorldOutliner';
import { RightSidebar } from '../ui/panels/RightSidebar';
import type { OutlinerNodeType } from '../types/outliner.types';

// ============================================================================
// INTEGRATION EXAMPLE
// ============================================================================

/**
 * Example class showing World Outliner integration
 * 
 * Add these properties and methods to your existing App class
 */
export class WorldOutlinerIntegrationExample {
    // Add these properties to your App class
    private scene!: Scene;
    private worldOutliner: WorldOutliner | null = null;
    private rightSidebar: RightSidebar | null = null;

    /**
     * Initialize the World Outliner system
     * Call this in your App.initialize() method after scene creation
     */
    private initializeWorldOutliner(): void {
        try {
            console.log('[App] Initializing World Outliner...');

            // Create the WorldOutliner system
            this.worldOutliner = new WorldOutliner(this.scene);
            this.worldOutliner.initialize();

            // Create the right sidebar with outliner panel
            this.rightSidebar = new RightSidebar(this.worldOutliner);
            this.rightSidebar.initialize();

            // Add to DOM
            const sidebarElement = this.rightSidebar.getElement();
            if (sidebarElement) {
                document.body.appendChild(sidebarElement);
            }

            // Setup selection callback to sync with 3D view
            this.rightSidebar.setSelectionCallback((nodeIds) => {
                this.onOutlinerSelectionChanged(nodeIds);
            });

            // Listen for outliner events
            this.setupOutlinerEventListeners();

            console.log('[App] ✓ World Outliner initialized');
        } catch (error) {
            console.error('[App] Failed to initialize World Outliner:', error);
        }
    }

    /**
     * Setup event listeners for outliner events
     */
    private setupOutlinerEventListeners(): void {
        if (!this.worldOutliner) return;

        // When visibility changes, update scene objects
        this.worldOutliner.events.on('node:visibility_changed', (event) => {
            console.log(`[App] Visibility changed: ${event.nodeId} = ${event.visible}`);
            // Scene object visibility is handled automatically by WorldOutliner
        });

        // When nodes are deleted, cleanup can happen here
        this.worldOutliner.events.on('node:deleted', (event) => {
            console.log(`[App] Node deleted: ${event.nodeId}`);
            // Additional cleanup if needed
        });

        // When selection changes
        this.worldOutliner.events.on('selection:changed', (event) => {
            console.log(`[App] Selection: ${event.selectedIds.join(', ') || 'none'}`);
        });
    }

    /**
     * Handle selection changes from the outliner
     * @param nodeIds - Selected node IDs
     */
    private onOutlinerSelectionChanged(nodeIds: string[]): void {
        if (!this.worldOutliner) return;

        // Highlight selected meshes in 3D view
        for (const nodeId of nodeIds) {
            const node = this.worldOutliner.getNode(nodeId);
            if (node?.sceneObjectId) {
                const mesh = this.scene.getMeshById(node.sceneObjectId);
                if (mesh) {
                    // Add highlight effect (implement your own highlight system)
                    console.log(`[App] Highlighting mesh: ${mesh.name}`);
                }
            }
        }
    }

    /**
     * Register a track piece with the World Outliner
     * Call this when placing a new track piece
     * 
     * @param mesh - The track mesh
     * @param trackName - Display name for the track
     * @param catalogId - Track catalog ID
     */
    registerTrackPiece(
        mesh: AbstractMesh,
        trackName: string,
        catalogId: string
    ): string | null {
        if (!this.worldOutliner) return null;

        const nodeId = this.worldOutliner.createItem({
            name: trackName,
            type: 'track',
            sceneObjectId: mesh.uniqueId.toString(),
            metadata: {
                catalogId,
                meshName: mesh.name,
            },
        });

        console.log(`[App] Registered track: ${trackName} → ${nodeId}`);
        return nodeId;
    }

    /**
     * Register a rolling stock item with the World Outliner
     * Call this when placing a locomotive or wagon
     * 
     * @param mesh - The rolling stock mesh
     * @param name - Display name
     * @param modelPath - Path to the model file
     */
    registerRollingStock(
        mesh: AbstractMesh,
        name: string,
        modelPath: string
    ): string | null {
        if (!this.worldOutliner) return null;

        const nodeId = this.worldOutliner.createItem({
            name,
            type: 'rolling_stock',
            sceneObjectId: mesh.uniqueId.toString(),
            metadata: {
                modelPath,
                meshName: mesh.name,
            },
        });

        console.log(`[App] Registered rolling stock: ${name} → ${nodeId}`);
        return nodeId;
    }

    /**
     * Register a scenery item with the World Outliner
     * 
     * @param mesh - The scenery mesh
     * @param name - Display name
     * @param modelPath - Path to the model file
     */
    registerScenery(
        mesh: AbstractMesh,
        name: string,
        modelPath: string
    ): string | null {
        if (!this.worldOutliner) return null;

        const nodeId = this.worldOutliner.createItem({
            name,
            type: 'scenery',
            sceneObjectId: mesh.uniqueId.toString(),
            metadata: {
                modelPath,
                meshName: mesh.name,
            },
        });

        console.log(`[App] Registered scenery: ${name} → ${nodeId}`);
        return nodeId;
    }

    /**
     * Register a baseboard with the World Outliner
     * 
     * @param mesh - The baseboard mesh
     * @param name - Display name
     */
    registerBaseboard(
        mesh: AbstractMesh,
        name: string
    ): string | null {
        if (!this.worldOutliner) return null;

        const nodeId = this.worldOutliner.createItem({
            name,
            type: 'baseboard',
            sceneObjectId: mesh.uniqueId.toString(),
        });

        console.log(`[App] Registered baseboard: ${name} → ${nodeId}`);
        return nodeId;
    }

    /**
     * Remove an item from the World Outliner
     * Call this when deleting track, scenery, etc.
     * 
     * @param sceneObjectId - The mesh's unique ID
     */
    unregisterSceneObject(sceneObjectId: string): void {
        if (!this.worldOutliner) return;

        const node = this.worldOutliner.findBySceneObjectId(sceneObjectId);
        if (node) {
            this.worldOutliner.deleteNode(node.id);
            console.log(`[App] Unregistered: ${node.name}`);
        }
    }

    /**
     * Select an item in the outliner when clicked in 3D view
     * Call this from your InputManager when a mesh is clicked
     * 
     * @param mesh - The clicked mesh
     * @param additive - Whether to add to selection (Ctrl/Shift held)
     */
    selectInOutliner(mesh: AbstractMesh, additive: boolean = false): void {
        if (!this.worldOutliner) return;

        const node = this.worldOutliner.findBySceneObjectId(mesh.uniqueId.toString());
        if (node) {
            this.worldOutliner.select(node.id, additive);
        }
    }

    /**
     * Clear outliner selection when clicking empty space
     */
    clearOutlinerSelection(): void {
        this.worldOutliner?.clearSelection();
    }

    /**
     * Get the current outliner state for saving
     * @returns Serializable state object
     */
    getOutlinerState(): object | null {
        return this.worldOutliner?.exportState() ?? null;
    }

    /**
     * Restore outliner state from saved data
     * @param state - Previously saved state
     */
    restoreOutlinerState(state: any): void {
        this.worldOutliner?.importState(state);
    }

    /**
     * Cleanup when app is disposed
     */
    disposeWorldOutliner(): void {
        this.rightSidebar?.dispose();
        this.worldOutliner?.dispose();
        this.rightSidebar = null;
        this.worldOutliner = null;
    }
}

// ============================================================================
// USAGE IN YOUR APP.TS
// ============================================================================

/*
To integrate the World Outliner into your existing App.ts:

1. Add imports at the top:
   
   import { WorldOutliner } from './systems/outliner/WorldOutliner';
   import { RightSidebar } from './ui/panels/RightSidebar';

2. Add properties:
   
   private worldOutliner: WorldOutliner | null = null;
   private rightSidebar: RightSidebar | null = null;

3. In your initialize() method, after scene setup:
   
   // Initialize World Outliner
   this.worldOutliner = new WorldOutliner(this.scene);
   this.worldOutliner.initialize();
   
   this.rightSidebar = new RightSidebar(this.worldOutliner);
   this.rightSidebar.initialize();
   document.body.appendChild(this.rightSidebar.getElement()!);

4. When placing track pieces, register them:
   
   // After creating track mesh
   this.worldOutliner?.createItem({
       name: piece.name,
       type: 'track',
       sceneObjectId: mesh.uniqueId.toString(),
   });

5. When deleting track, unregister:
   
   const node = this.worldOutliner?.findBySceneObjectId(mesh.uniqueId.toString());
   if (node) {
       this.worldOutliner?.deleteNode(node.id);
   }

6. When clicking meshes in 3D view:
   
   const node = this.worldOutliner?.findBySceneObjectId(pickedMesh.uniqueId.toString());
   if (node) {
       this.worldOutliner?.select(node.id);
   }

7. For saving/loading projects:
   
   // Save
   const outlinerState = this.worldOutliner?.exportState();
   // Include in your project save data
   
   // Load
   this.worldOutliner?.importState(savedOutlinerState);
*/