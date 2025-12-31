/**
 * UI Components - Index
 * 
 * Path: frontend/src/ui/index.ts
 * 
 * Re-exports all UI components for easy importing.
 * 
 * This is the consolidated UI module after merging the Model Library
 * and Asset Library systems.
 * 
 * @module UI
 * @author Model Railway Workbench
 * @version 2.0.0 - Consolidated UI exports
 */

// ============================================================================
// CORE UI COMPONENTS
// ============================================================================

/**
 * UIManager - Main sidebar control panel
 * Contains track palette, settings, keyboard shortcuts
 */
export { UIManager } from './UIManager';
export type {
    TrackSelectionCallback,
    ToggleCallback,
    ImportCallback
} from './UIManager';

/**
 * UIManagerStyles - Theme tokens and style injection
 */
export {
    THEME,
    injectUIManagerStyles,
    KEYBOARD_SHORTCUTS,
    MODE_ICONS
} from './UIManagerStyles';
export type { AccordionSection } from './UIManagerStyles';

/**
 * InputManager - Mouse/keyboard input handling for track manipulation
 */
export { InputManager } from './InputManager';

// ============================================================================
// MODEL IMPORT SYSTEM
// ============================================================================

/**
 * ModelImportButton - Floating button that triggers model import
 * Includes scaling system, WorldOutliner integration, and placement handling
 */
export { ModelImportButton } from './ModelImportButton';

/**
 * ModelImportButtonConfig - Configuration and constants
 */
export {
    LOG_PREFIX,
    TRACK_PLACEMENT_CATEGORIES,
    SMALL_ROTATION_DEG,
    LARGE_ROTATION_DEG,
    SURFACE_HEIGHTS,
    CATEGORY_TO_OUTLINER_TYPE,
    VALID_FORWARD_AXES,
    SCALE_MANAGER_CONFIG,
    MODEL_DRAG_THRESHOLD,
    requiresTrackPlacement,
    getOutlinerNodeType,
    getModelBaseY,
    logControls,
    logKeyboardShortcuts,
    displayOrientationHelp,
    createNoTrackModal
} from './ModelImportButtonConfig';
export type { ModelForwardAxis } from './ModelImportButtonConfig';

/**
 * ModelImportDialog - Modal dialog for importing 3D models
 */
export { ModelImportDialog } from './ModelImportDialog';

/**
 * ModelImportDialogTemplate - HTML templates and utilities for import dialog
 */
export {
    DIALOG_Z_INDEX,
    CATEGORY_OPTIONS,
    ROLLING_STOCK_KEYWORDS,
    buildDialogHTML,
    getOverlayStyles,
    getContainerStyles,
    createDefaultFormState,
    detectRollingStock,
    detectCategoryFromFilename,
    detectRollingStockType,
    getCategoryInfoMessage,
    getSuggestedDimensions
} from './ModelImportDialogTemplate';
export type {
    ScaleMode,
    ImportFormState
} from './ModelImportDialogTemplate';

// ============================================================================
// MODEL LIBRARY PANEL
// ============================================================================

/**
 * ModelLibraryPanel - Unified sidebar panel for model library
 * Displays all models organized by category with rolling stock subcategories
 */
export { ModelLibraryPanel } from './ModelLibraryPanel';
export type {
    ModelSelectCallback,
    ImportRequestCallback
} from './ModelLibraryPanel';

// ============================================================================
// TRAIN CONTROL
// ============================================================================

/**
 * TrainControlPanel - DCC-style floating control panel for trains
 * Shows throttle, direction, brake, and status when a train is selected
 */
export { TrainControlPanel } from './TrainControlPanel';
export type { TrainControlPanelConfig } from './TrainControlPanel';

// ============================================================================
// TYPE RE-EXPORTS
// ============================================================================

/**
 * Re-export category types for convenience
 */
export type {
    ModelCategory,
    CategoryGroup
} from '../types/ModelCategory.types';

export {
    ROLLING_STOCK_CATEGORIES,
    GENERAL_CATEGORIES,
    ALL_CATEGORIES,
    CATEGORY_LABELS,
    CATEGORY_ICONS,
    CATEGORY_DESCRIPTIONS,
    CATEGORY_GROUPS,
    isRollingStock,
    getCategoryLabel,
    getCategoryIcon,
    getCategoryGroup,
    getFormattedCategoryLabel
} from '../types/ModelCategory.types';