/**
 * index.ts - Core Module Exports
 * 
 * Path: frontend/src/core/index.ts
 * 
 * Re-exports all core classes for convenient importing.
 * 
 * @module Core
 * 
 * @example
 * ```typescript
 * // Import the main App class
 * import { App } from './core';
 * 
 * // Or import specific managers
 * import { AppCore, OutlinerManager, InputHandler } from './core';
 * ```
 */
// Missing from index.ts:
export { Project } from './Project';
// ============================================================================
// MAIN APPLICATION
// ============================================================================

/**
 * Main application class - use this to create and run the application
 */
export { App } from './App';

// ============================================================================
// CORE INFRASTRUCTURE
// ============================================================================

/**
 * Core application infrastructure (engine, scene, lighting, render loop)
 * Can be extended for custom implementations
 */
export { AppCore } from './AppCore';
export type { AppCoreConfig } from './AppCore';

// ============================================================================
// WORLD OUTLINER
// ============================================================================

/**
 * World Outliner integration manager
 * Handles outliner UI, highlighting, and selection sync
 */
export { OutlinerManager } from './OutlinerManager';
export type { OutlinerDependencies, TrackPieceData } from './OutlinerManager';

// ============================================================================
// INPUT HANDLING
// ============================================================================

/**
 * Input handling manager
 * Handles pointer events, keyboard shortcuts, track placement
 */
export { InputHandler } from './InputHandler';
export type { InputHandlerDependencies, TestTracksCallback } from './InputHandler';