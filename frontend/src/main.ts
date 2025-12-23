/**
 * Model Railway Workbench - Entry Point
 */

import { App } from './core/App';

// Get canvas element
const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
if (!canvas) {
    throw new Error('Canvas element #renderCanvas not found');
}

// Create and initialize application
const app = new App(canvas);

app.initialize().then(() => {
    app.start();
}).catch((error) => {
    console.error('Failed to initialize application:', error);
});

// Expose app for debugging in browser console
(window as any).app = app;