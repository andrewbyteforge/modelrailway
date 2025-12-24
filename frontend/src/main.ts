/**
 * Model Railway Workbench - Entry Point
 * 
 * CRITICAL: Babylon.js side-effect imports must come FIRST
 * before any other Babylon imports to enable features like Ray picking.
 * 
 * @module main
 */

// ============================================================================
// BABYLON.JS SIDE-EFFECT IMPORTS (MUST BE FIRST!)
// ============================================================================
// These imports enable features that require side-effects to be registered
// with the Babylon.js engine before other modules load.

import '@babylonjs/core/Culling/ray';
import '@babylonjs/core/Collisions/pickingInfo';

// ============================================================================
// APPLICATION IMPORTS
// ============================================================================

import { App } from './core/App';

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize and start the application
 */
async function main(): Promise<void> {
    console.log('Model Railway Workbench starting...');

    // Get canvas element
    const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
    if (!canvas) {
        throw new Error('Canvas element #renderCanvas not found');
    }

    try {
        // Create and initialize application
        const app = new App(canvas);
        await app.initialize();
        app.start();

        // Expose app for debugging in browser console
        (window as any).app = app;

        console.log('✓ Application ready');
    } catch (error) {
        console.error('Failed to initialize application:', error);
        throw error;
    }
}

// Start the application
main().catch(console.error);