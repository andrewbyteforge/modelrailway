/**
 * PersistenceIntegration.ts - Integration guide for layout save/load
 * 
 * Path: frontend/src/core/persistence/PersistenceIntegration.ts
 * 
 * This file provides a complete example of how to integrate the 
 * LayoutManager into your existing App.ts to enable save/load functionality.
 * 
 * @module PersistenceIntegration
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Scene } from '@babylonjs/core/scene';

import {
    LayoutManager,
    createLayoutManager,
    type LayoutManagerEvent
} from './index';

import type { TrackSystem } from '../../systems/track/TrackSystem';
import type { TrackCatalog } from '../../systems/track/TrackCatalog';
import type { WorldOutliner } from '../../systems/outliner/WorldOutliner';
import type { ModelLibrary } from '../../systems/models/ModelLibrary';
import type { PlacedItemManager } from '../../systems/assets/PlacedItemManager';
import type { Project } from '../Project';

// ============================================================================
// INTEGRATION HELPER CLASS
// ============================================================================

/**
 * PersistenceIntegration - Helper class for integrating save/load into App
 * 
 * This class encapsulates all the setup needed to integrate the persistence
 * system with your existing application. You can either use this class directly
 * or copy the patterns into your App.ts.
 * 
 * @example
 * ```typescript
 * // In your App.ts constructor or initialize method:
 * 
 * import { PersistenceIntegration } from './core/persistence/PersistenceIntegration';
 * 
 * class App {
 *     private persistence: PersistenceIntegration;
 *     
 *     async initialize() {
 *         // ... existing initialization ...
 *         
 *         // Initialize persistence
 *         this.persistence = new PersistenceIntegration(this.scene);
 *         this.persistence.configure({
 *             project: this.project,
 *             trackSystem: this.trackSystem,
 *             trackCatalog: this.trackCatalog,
 *             worldOutliner: this.worldOutliner,
 *             modelLibrary: this.modelLibrary,
 *             placedItemManager: this.placedItemManager
 *         });
 *         
 *         // Setup keyboard shortcuts
 *         this.persistence.setupKeyboardShortcuts();
 *         
 *         // Setup menu items (if you have a menu system)
 *         this.setupFileMenu();
 *     }
 * }
 * ```
 */
export class PersistenceIntegration {
    // ========================================================================
    // PRIVATE PROPERTIES
    // ========================================================================

    /** Layout manager instance */
    private layoutManager: LayoutManager;

    /** Babylon.js scene */
    private scene: Scene;

    /** Status callback for UI updates */
    private onStatusChange?: (status: string) => void;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create persistence integration
     * @param scene - Babylon.js scene
     */
    constructor(scene: Scene) {
        this.scene = scene;
        this.layoutManager = createLayoutManager(scene);

        // Setup event listeners
        this.setupEventListeners();

        console.log('[PersistenceIntegration] Initialized');
    }

    // ========================================================================
    // CONFIGURATION
    // ========================================================================

    /**
     * Configure persistence with application systems
     * @param options - Configuration options
     */
    configure(options: {
        project?: Project;
        trackSystem?: TrackSystem;
        trackCatalog?: TrackCatalog;
        worldOutliner?: WorldOutliner;
        modelLibrary?: ModelLibrary;
        placedItemManager?: PlacedItemManager;
        autoSaveEnabled?: boolean;
        autoSaveIntervalMs?: number;
    }): void {
        // Connect all systems
        if (options.project) {
            this.layoutManager.setProject(options.project);
        }

        if (options.trackSystem) {
            this.layoutManager.setTrackSystem(options.trackSystem);
        }

        if (options.trackCatalog) {
            this.layoutManager.setTrackCatalog(options.trackCatalog);
        }

        if (options.worldOutliner) {
            this.layoutManager.setWorldOutliner(options.worldOutliner);
        }

        if (options.modelLibrary) {
            this.layoutManager.setModelLibrary(options.modelLibrary);
        }

        if (options.placedItemManager) {
            this.layoutManager.setPlacedItemManager(options.placedItemManager);
        }

        // Enable auto-save if requested
        if (options.autoSaveEnabled) {
            this.layoutManager.enableAutoSave(options.autoSaveIntervalMs);
        }

        console.log('[PersistenceIntegration] Configured');
    }

    // ========================================================================
    // PUBLIC METHODS
    // ========================================================================

    /**
     * Get the layout manager instance
     */
    getLayoutManager(): LayoutManager {
        return this.layoutManager;
    }

    /**
     * Create a new layout
     */
    async newLayout(): Promise<boolean> {
        return this.layoutManager.newLayout();
    }

    /**
     * Save current layout (or save as if no path)
     */
    async save(): Promise<boolean> {
        const result = await this.layoutManager.save();
        return result.success;
    }

    /**
     * Save layout with file dialog
     */
    async saveAs(): Promise<boolean> {
        const result = await this.layoutManager.saveAs();
        return result.success;
    }

    /**
     * Open layout with file dialog
     */
    async open(): Promise<boolean> {
        const result = await this.layoutManager.open((stage, progress, message) => {
            console.log(`[Load] ${stage}: ${progress}% - ${message}`);
            this.onStatusChange?.(`Loading: ${message}`);
        });

        if (result.warnings.length > 0) {
            console.warn('[PersistenceIntegration] Load warnings:', result.warnings);
        }

        return result.success;
    }

    /**
     * Mark layout as having unsaved changes
     * Call this when the user makes any change to the layout
     */
    markDirty(): void {
        this.layoutManager.markDirty();
    }

    /**
     * Check if there are unsaved changes
     */
    hasUnsavedChanges(): boolean {
        return this.layoutManager.getIsDirty();
    }

    /**
     * Get window title (with dirty indicator)
     */
    getWindowTitle(): string {
        return this.layoutManager.getWindowTitle();
    }

    /**
     * Get recent files list
     */
    getRecentFiles() {
        return this.layoutManager.getRecentFiles();
    }

    /**
     * Set status change callback
     */
    setStatusCallback(callback: (status: string) => void): void {
        this.onStatusChange = callback;
    }

    // ========================================================================
    // KEYBOARD SHORTCUTS
    // ========================================================================

    /**
     * Setup standard keyboard shortcuts for save/load
     * 
     * Ctrl+S - Save
     * Ctrl+Shift+S - Save As
     * Ctrl+O - Open
     * Ctrl+N - New
     */
    setupKeyboardShortcuts(): void {
        window.addEventListener('keydown', async (event) => {
            // Check for Ctrl/Cmd modifier
            const isCtrlOrCmd = event.ctrlKey || event.metaKey;

            if (!isCtrlOrCmd) return;

            switch (event.key.toLowerCase()) {
                case 's':
                    event.preventDefault();
                    if (event.shiftKey) {
                        await this.saveAs();
                    } else {
                        await this.save();
                    }
                    break;

                case 'o':
                    event.preventDefault();
                    await this.open();
                    break;

                case 'n':
                    event.preventDefault();
                    await this.newLayout();
                    break;
            }
        });

        console.log('[PersistenceIntegration] Keyboard shortcuts enabled:');
        console.log('  Ctrl+S - Save');
        console.log('  Ctrl+Shift+S - Save As');
        console.log('  Ctrl+O - Open');
        console.log('  Ctrl+N - New');
    }

    // ========================================================================
    // BEFORE UNLOAD WARNING
    // ========================================================================

    /**
     * Setup browser/app close warning for unsaved changes
     */
    setupBeforeUnloadWarning(): void {
        window.addEventListener('beforeunload', (event) => {
            if (this.layoutManager.getIsDirty()) {
                // Standard way to trigger browser's "unsaved changes" dialog
                event.preventDefault();
                event.returnValue = '';
                return '';
            }
        });

        console.log('[PersistenceIntegration] Before unload warning enabled');
    }

    // ========================================================================
    // EVENT LISTENERS
    // ========================================================================

    /**
     * Setup internal event listeners
     */
    private setupEventListeners(): void {
        // Listen for dirty state changes
        this.layoutManager.addEventListener('dirty-changed', (event) => {
            if (typeof window !== 'undefined' && document) {
                document.title = this.layoutManager.getWindowTitle();
            }
        });

        // Listen for save events
        this.layoutManager.addEventListener('layout-saved', (event) => {
            this.onStatusChange?.(`Saved: ${event.layoutName}`);
        });

        // Listen for load events
        this.layoutManager.addEventListener('layout-loaded', (event) => {
            this.onStatusChange?.(`Loaded: ${event.layoutName}`);
        });

        // Listen for errors
        this.layoutManager.addEventListener('save-error', (event) => {
            this.onStatusChange?.(`Save error: ${event.error}`);
        });

        this.layoutManager.addEventListener('load-error', (event) => {
            this.onStatusChange?.(`Load error: ${event.error}`);
        });
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Dispose of persistence integration
     */
    dispose(): void {
        this.layoutManager.dispose();
        console.log('[PersistenceIntegration] Disposed');
    }
}

// ============================================================================
// EXAMPLE: Adding to existing App.ts
// ============================================================================

/*
Here's how to add save/load functionality to your existing App.ts:

1. IMPORT THE MODULE
   Add this import near the top of App.ts:
   
   ```typescript
   import { PersistenceIntegration } from './core/persistence/PersistenceIntegration';
   // Or import components directly:
   import { LayoutManager, createLayoutManager } from './core/persistence';
   ```

2. ADD PROPERTY
   Add a property to your App class:
   
   ```typescript
   private persistence: PersistenceIntegration | null = null;
   ```

3. INITIALIZE IN YOUR SETUP METHOD
   After your scene and systems are initialized:
   
   ```typescript
   async initialize() {
       // ... existing initialization code ...
       
       // Initialize persistence AFTER all other systems are ready
       this.persistence = new PersistenceIntegration(this.scene);
       this.persistence.configure({
           project: this.project,
           trackSystem: this.trackSystem,
           trackCatalog: this.trackCatalog,
           worldOutliner: this.worldOutliner,
           modelLibrary: this.modelLibrary,
           placedItemManager: PlacedItemManager.getInstance()
       });
       
       // Enable keyboard shortcuts (Ctrl+S, Ctrl+O, etc.)
       this.persistence.setupKeyboardShortcuts();
       
       // Enable "unsaved changes" warning when closing
       this.persistence.setupBeforeUnloadWarning();
   }
   ```

4. MARK DIRTY WHEN CHANGES OCCUR
   In your track placement, model placement, etc. handlers:
   
   ```typescript
   // After placing a track piece
   const piece = this.trackSystem.placeTrack(catalogId, position);
   if (piece) {
       this.persistence?.markDirty();
   }
   
   // After deleting something
   this.trackSystem.deleteTrack(pieceId);
   this.persistence?.markDirty();
   ```

5. ADD FILE MENU (Optional)
   If you have a menu system, add these options:
   
   ```typescript
   setupFileMenu() {
       const fileMenu = [
           { label: 'New', shortcut: 'Ctrl+N', action: () => this.persistence?.newLayout() },
           { label: 'Open...', shortcut: 'Ctrl+O', action: () => this.persistence?.open() },
           { label: 'Save', shortcut: 'Ctrl+S', action: () => this.persistence?.save() },
           { label: 'Save As...', shortcut: 'Ctrl+Shift+S', action: () => this.persistence?.saveAs() },
           { type: 'separator' },
           { label: 'Recent Files', submenu: this.buildRecentFilesMenu() }
       ];
   }
   ```

6. CLEANUP
   In your dispose method:
   
   ```typescript
   dispose() {
       this.persistence?.dispose();
       // ... other cleanup ...
   }
   ```
*/

// ============================================================================
// EXAMPLE: Direct usage without helper class
// ============================================================================

/*
If you prefer to use the LayoutManager directly without the helper:

```typescript
import { createLayoutManager, LayoutManager } from './core/persistence';

class App {
    private layoutManager: LayoutManager;
    
    async initialize() {
        // Create layout manager
        this.layoutManager = createLayoutManager(this.scene);
        
        // Connect systems
        this.layoutManager.setTrackSystem(this.trackSystem);
        this.layoutManager.setWorldOutliner(this.worldOutliner);
        // ... etc
        
        // Listen for events
        this.layoutManager.addEventListener('layout-saved', (event) => {
            console.log('Saved:', event.filePath);
        });
        
        // Save
        await this.layoutManager.save();
        
        // Open
        await this.layoutManager.open();
    }
}
```
*/

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create persistence integration instance
 * @param scene - Babylon.js scene
 * @returns PersistenceIntegration instance
 */
export function createPersistenceIntegration(scene: Scene): PersistenceIntegration {
    return new PersistenceIntegration(scene);
}