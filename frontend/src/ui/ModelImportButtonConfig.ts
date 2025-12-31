/**
 * ModelImportButtonConfig.ts - Imports, constants, types, and configuration
 * 
 * Path: frontend/src/ui/ModelImportButtonConfig.ts
 * 
 * Contains:
 * - Type definitions for model import and placement
 * - Constants for surface heights, rotation angles
 * - Category to outliner type mapping
 * - Utility functions for placement calculations
 * 
 * Updated to use centralized ModelCategory types.
 * 
 * @module ModelImportButtonConfig
 * @author Model Railway Workbench
 * @version 2.1.0 - Updated with centralized category types
 */

import type { OutlinerNodeType } from '../types/outliner.types';
import {
    type ModelCategory,
    ROLLING_STOCK_CATEGORIES,
    isRollingStock
} from '../types/ModelCategory.types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix for console output */
export const LOG_PREFIX = '[ModelImportButton]';

/**
 * Categories that require track placement
 * Now uses the centralized rolling stock categories
 */
export const TRACK_PLACEMENT_CATEGORIES: string[] = [...ROLLING_STOCK_CATEGORIES];

/** Small rotation angle in degrees */
export const SMALL_ROTATION_DEG = 5;

/** Large rotation angle in degrees (with Shift) */
export const LARGE_ROTATION_DEG = 22.5;

/**
 * Surface heights for model placement (in metres)
 * These MUST match the values in BaseboardSystem.ts and TrackRenderer.ts
 * 
 * FIX: This constant ensures all placement code uses consistent heights
 */
export const SURFACE_HEIGHTS = {
    /** Height of baseboard surface from world origin (matches BaseboardSystem) */
    BASEBOARD_TOP: 0.950,

    /** Height offset for ballast/sleepers/rails above baseboard */
    RAIL_TOP_OFFSET: 0.008,

    /** Total height of rail surface from world origin */
    get RAIL_TOP_Y(): number {
        return this.BASEBOARD_TOP + this.RAIL_TOP_OFFSET;
    }
} as const;

/**
 * Map model categories to outliner node types
 * Updated to include all rolling stock subcategories
 */
export const CATEGORY_TO_OUTLINER_TYPE: Record<string, OutlinerNodeType> = {
    // Rolling Stock - all map to 'rolling_stock' outliner type
    'locomotive': 'rolling_stock',
    'coach': 'rolling_stock',
    'wagon': 'rolling_stock',
    'multiple_unit': 'rolling_stock',
    // Legacy category name (backward compatibility)
    'rolling_stock': 'rolling_stock',
    // General categories
    'buildings': 'scenery',
    'scenery': 'scenery',
    'infrastructure': 'scenery',
    'vehicles': 'scenery',
    'figures': 'scenery',
    'accessories': 'scenery',
    'custom': 'model',
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Model forward axis options (for train orientation)
 * Used to fix trains facing wrong direction on track
 */
export type ModelForwardAxis = 'POS_X' | 'NEG_X' | 'POS_Y' | 'NEG_Y' | 'POS_Z' | 'NEG_Z';

/**
 * Valid model forward axes list
 */
export const VALID_FORWARD_AXES: ModelForwardAxis[] = [
    'POS_X', 'NEG_X', 'POS_Y', 'NEG_Y', 'POS_Z', 'NEG_Z'
];

// ============================================================================
// SCALE MANAGER CONFIGURATION
// ============================================================================

/**
 * Default configuration for ScaleManager
 */
export const SCALE_MANAGER_CONFIG = {
    scaleKey: 's',           // Hold S + scroll to scale
    resetKey: 'r',           // Press R to reset scale
    lockKey: 'l',            // Press L to toggle lock
    scrollSensitivity: 5,    // 5% per scroll notch
    fineMultiplier: 0.2      // Shift = 20% of normal speed
} as const;

// ============================================================================
// DRAG CONFIGURATION
// ============================================================================

/**
 * Drag threshold in pixels for model drag detection
 */
export const MODEL_DRAG_THRESHOLD = 5;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a category requires track placement
 * Now uses the centralized isRollingStock function
 * @param category - The model category to check
 * @returns True if the category requires track placement
 */
export function requiresTrackPlacement(category: string | ModelCategory): boolean {
    return isRollingStock(category as ModelCategory);
}

/**
 * Get the outliner node type for a model category
 * @param category - The model category
 * @returns The corresponding outliner node type
 */
export function getOutlinerNodeType(category: string): OutlinerNodeType {
    return CATEGORY_TO_OUTLINER_TYPE[category.toLowerCase()] || 'model';
}

/**
 * Get the base Y position for a model based on its category
 * @param category - The model category
 * @returns Base Y position in meters
 */
export function getModelBaseY(category: string): number {
    if (requiresTrackPlacement(category)) {
        // Rolling stock sits on rail surface
        return SURFACE_HEIGHTS.RAIL_TOP_Y;
    } else {
        // Other models sit on baseboard surface
        return SURFACE_HEIGHTS.BASEBOARD_TOP;
    }
}

// ============================================================================
// CONSOLE LOGGING UTILITIES
// ============================================================================

/**
 * Log available controls to the console
 */
export function logControls(): void {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║              MODEL & TRANSFORM CONTROLS                    ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║  Click model        → Select it                            ║');
    console.log('║  Drag model         → Move it (XZ plane)                   ║');
    console.log('║  Drag gizmo corner  → Scale uniformly                      ║');
    console.log('║  S + Scroll         → Scale selected object                ║');
    console.log('║  Shift+S + Scroll   → Fine scale adjustment                ║');
    console.log('║  H + Scroll         → Adjust height (lift/lower)           ║');
    console.log('║  PageUp / PageDown  → Height ±5mm                          ║');
    console.log('║  Shift+PgUp/PgDn    → Height ±1mm (fine)                   ║');
    console.log('║  R                  → Reset to original scale              ║');
    console.log('║  L                  → Lock/unlock scaling                  ║');
    console.log('║  [ / ]              → Rotate ±5°                           ║');
    console.log('║  Shift + [ / ]      → Rotate ±22.5°                        ║');
    console.log('║  Delete             → Remove selected model                ║');
    console.log('║  Escape             → Deselect                             ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║  Transform controls in Models sidebar → Settings section   ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`${LOG_PREFIX} === TRAIN ORIENTATION HELP ===`);
    console.log(`${LOG_PREFIX} If trains face wrong way on track, try in console:`);
    console.log(`${LOG_PREFIX}   window.setTrainOrientation('NEG_Y')  // For Blender exports`);
    console.log(`${LOG_PREFIX}   window.setTrainOrientation('POS_X')  // For some exports`);
    console.log(`${LOG_PREFIX}   window.trainOrientationHelp()        // Show all options`);
    console.log('');
}

/**
 * Log keyboard shortcuts to the console
 */
export function logKeyboardShortcuts(): void {
    console.log(`${LOG_PREFIX} Keyboard shortcuts configured:`);
    console.log(`${LOG_PREFIX}   [ / ] = Rotate ±5°`);
    console.log(`${LOG_PREFIX}   Shift + [ / ] = Rotate ±22.5°`);
    console.log(`${LOG_PREFIX}   H + Scroll = Adjust height`);
    console.log(`${LOG_PREFIX}   PageUp/PageDown = Height ±5mm`);
    console.log(`${LOG_PREFIX}   Shift + PgUp/PgDn = Height ±1mm`);
    console.log(`${LOG_PREFIX}   Delete = Remove selected`);
    console.log(`${LOG_PREFIX}   Escape = Deselect`);
    console.log(`${LOG_PREFIX}   S + Scroll = Scale (handled by ScaleManager)`);
    console.log(`${LOG_PREFIX}   R = Reset scale (handled by ScaleManager)`);
    console.log(`${LOG_PREFIX}   L = Lock scale (handled by ScaleManager)`);
}

/**
 * Display train orientation help in the console
 * @param currentAxis - Current orientation axis
 */
export function displayOrientationHelp(currentAxis: string): void {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║              TRAIN ORIENTATION HELP                        ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║                                                            ║');
    console.log('║  If your train model faces SIDEWAYS (across the track)     ║');
    console.log('║  instead of ALONG the track, the model uses a different    ║');
    console.log('║  "forward" axis than expected.                             ║');
    console.log('║                                                            ║');
    console.log('║  Try these commands to fix it:                             ║');
    console.log('║                                                            ║');
    console.log('║    window.setTrainOrientation("POS_Z")  // Default         ║');
    console.log('║    window.setTrainOrientation("NEG_Y")  // Blender         ║');
    console.log('║    window.setTrainOrientation("POS_X")  // Some CAD        ║');
    console.log('║    window.setTrainOrientation("NEG_X")                     ║');
    console.log('║    window.setTrainOrientation("POS_Y")  // 3ds Max         ║');
    console.log('║    window.setTrainOrientation("NEG_Z")                     ║');
    console.log('║                                                            ║');
    console.log('║  After setting, place a NEW train on the track to test.   ║');
    console.log('║  The setting persists until you refresh the page.         ║');
    console.log('║                                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Current setting: ${currentAxis}`);
    console.log('');
}

// ============================================================================
// NO TRACK DIALOG HTML
// ============================================================================

/**
 * Build the "No Track Available" modal HTML
 * @returns Modal container element
 */
export function createNoTrackModal(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
        background: #2a2a2a;
        border-radius: 8px;
        padding: 24px;
        max-width: 400px;
        text-align: center;
        color: #fff;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    `;

    modal.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">🚂</div>
        <h3 style="margin: 0 0 12px 0; color: #ffa726;">No Track Available</h3>
        <p style="margin: 0 0 20px 0; color: #aaa;">
            Rolling stock (locomotives, coaches, wagons) must be placed on track pieces.<br>
            Please place some track first, then import your train.
        </p>
        <button id="no-track-ok-btn" style="
            background: #4CAF50;
            color: white;
            border: none;
            padding: 10px 24px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        ">OK</button>
    `;

    overlay.appendChild(modal);
    return overlay;
}