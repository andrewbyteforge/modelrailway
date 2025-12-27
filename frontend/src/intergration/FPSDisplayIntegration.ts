/**
 * FPSDisplayIntegration.ts - Integration guide for FPS Display and Properties Panel
 * 
 * Path: frontend/src/integration/FPSDisplayIntegration.ts
 * 
 * This file demonstrates how to integrate the FPS Display system
 * with the RightSidebar and Properties Panel. Copy the relevant
 * sections into your actual App.ts implementation.
 * 
 * @module FPSDisplayIntegration
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Scene } from '@babylonjs/core/scene';

// Import outliner system
import { WorldOutliner } from '../systems/outliner/WorldOutliner';
import { RightSidebar } from '../ui/panels/RightSidebar';
import { FPSDisplay } from '../systems/performance/FPSDisplay';

// ============================================================================
// INTEGRATION EXAMPLE
// ============================================================================

/**
 * Example class showing FPS Display integration with World Outliner
 * 
 * Add these properties and methods to your existing App class
 */
export class FPSDisplayIntegrationExample {
    // ========================================================================
    // PROPERTIES TO ADD TO YOUR APP CLASS
    // ========================================================================

    /** Babylon.js scene reference */
    private scene!: Scene;

    /** World Outliner system */
    private worldOutliner: WorldOutliner | null = null;

    /** Right sidebar containing outliner and properties */
    private rightSidebar: RightSidebar | null = null;

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the World Outliner and Right Sidebar with FPS Display
     * 
     * Call this in your App.initialize() method after scene creation
     */
    private initializeWorldOutliner(): void {
        try {
            console.log('[App] Initializing World Outliner with FPS Display...');

            // Create the WorldOutliner system
            this.worldOutliner = new WorldOutliner(this.scene);
            this.worldOutliner.initialize();

            // Create the right sidebar - now requires scene for FPS monitoring
            // The RightSidebar automatically creates and manages the FPSDisplay
            this.rightSidebar = new RightSidebar(
                this.worldOutliner,
                this.scene,  // Pass scene for FPS monitoring
                {
                    width: 300,
                    defaultCollapsed: true,
                    outlinerHeightRatio: 0.6,  // 60% outliner, 40% properties
                }
            );
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

            console.log('[App] ✓ World Outliner with FPS Display initialized');
        } catch (error) {
            console.error('[App] Failed to initialize World Outliner:', error);
        }
    }

    /**
     * Handle selection changes from the outliner
     * @param nodeIds - Array of selected node IDs
     */
    private onOutlinerSelectionChanged(nodeIds: string[]): void {
        console.log('[App] Outliner selection changed:', nodeIds);

        // Sync with 3D view selection if needed
        // this.selectMeshesById(nodeIds);
    }

    // ========================================================================
    // PROGRAMMATIC FPS CONTROL
    // ========================================================================

    /**
     * Enable FPS display programmatically
     */
    enableFPSDisplay(): void {
        const fpsDisplay = this.rightSidebar?.getFPSDisplay();
        if (fpsDisplay) {
            fpsDisplay.enable();
            console.log('[App] FPS display enabled');
        }
    }

    /**
     * Disable FPS display programmatically
     */
    disableFPSDisplay(): void {
        const fpsDisplay = this.rightSidebar?.getFPSDisplay();
        if (fpsDisplay) {
            fpsDisplay.disable();
            console.log('[App] FPS display disabled');
        }
    }

    /**
     * Toggle FPS overlay programmatically
     */
    toggleFPSOverlay(): void {
        const fpsDisplay = this.rightSidebar?.getFPSDisplay();
        if (fpsDisplay) {
            fpsDisplay.toggleOverlay();
            console.log('[App] FPS overlay toggled');
        }
    }

    /**
     * Get current FPS value
     * @returns Current smoothed FPS or 0 if not available
     */
    getCurrentFPS(): number {
        const fpsDisplay = this.rightSidebar?.getFPSDisplay();
        return fpsDisplay?.fps ?? 0;
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

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
// USAGE GUIDE
// ============================================================================

/*
╔══════════════════════════════════════════════════════════════════════════════╗
║                      FPS DISPLAY INTEGRATION GUIDE                           ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  To integrate the FPS Display into your existing App.ts:                     ║
║                                                                              ║
║  1. ADD IMPORTS at the top:                                                  ║
║     ─────────────────────────────────────────────────────────────────────    ║
║                                                                              ║
║     import { WorldOutliner } from './systems/outliner/WorldOutliner';        ║
║     import { RightSidebar } from './ui/panels/RightSidebar';                 ║
║                                                                              ║
║  2. ADD PROPERTIES to your App class:                                        ║
║     ─────────────────────────────────────────────────────────────────────    ║
║                                                                              ║
║     private worldOutliner: WorldOutliner | null = null;                      ║
║     private rightSidebar: RightSidebar | null = null;                        ║
║                                                                              ║
║  3. IN YOUR initialize() METHOD, after scene setup:                          ║
║     ─────────────────────────────────────────────────────────────────────    ║
║                                                                              ║
║     // Initialize World Outliner                                             ║
║     this.worldOutliner = new WorldOutliner(this.scene);                      ║
║     this.worldOutliner.initialize();                                         ║
║                                                                              ║
║     // Create sidebar with FPS display (pass scene!)                         ║
║     this.rightSidebar = new RightSidebar(                                    ║
║         this.worldOutliner,                                                  ║
║         this.scene  // Required for FPS monitoring                           ║
║     );                                                                       ║
║     this.rightSidebar.initialize();                                          ║
║     document.body.appendChild(this.rightSidebar.getElement()!);              ║
║                                                                              ║
║  4. FPS DISPLAY FEATURES:                                                    ║
║     ─────────────────────────────────────────────────────────────────────    ║
║                                                                              ║
║     • Toggle in Properties Panel (bottom of right sidebar)                   ║
║     • Real-time FPS value with color-coded state                             ║
║     • Optional on-screen overlay                                             ║
║     • Performance states: Good (green), Warning (yellow), Critical (red)     ║
║                                                                              ║
║  5. KEYBOARD SHORTCUTS:                                                      ║
║     ─────────────────────────────────────────────────────────────────────    ║
║                                                                              ║
║     Alt + O: Toggle World Outliner sidebar                                   ║
║                                                                              ║
║  6. PROGRAMMATIC CONTROL:                                                    ║
║     ─────────────────────────────────────────────────────────────────────    ║
║                                                                              ║
║     // Get FPS display instance                                              ║
║     const fps = this.rightSidebar?.getFPSDisplay();                          ║
║                                                                              ║
║     // Enable/disable FPS monitoring                                         ║
║     fps?.enable();                                                           ║
║     fps?.disable();                                                          ║
║                                                                              ║
║     // Toggle on-screen overlay                                              ║
║     fps?.toggleOverlay();                                                    ║
║                                                                              ║
║     // Get current FPS value                                                 ║
║     const currentFps = fps?.fps ?? 0;                                        ║
║                                                                              ║
║     // Subscribe to FPS updates                                              ║
║     fps?.onUpdate((data) => {                                                ║
║         console.log(`FPS: ${data.smoothed}, State: ${data.state}`);          ║
║     });                                                                      ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
*/