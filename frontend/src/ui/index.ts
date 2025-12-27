/**
 * UI Components - Index
 * 
 * Path: frontend/src/ui/index.ts
 * 
 * Re-exports all UI components for easy importing
 * 
 * @module UI
 */

// ============================================================================
// CORE UI COMPONENTS
// ============================================================================

// Uncomment when these files exist in your project:
// export { UIManager } from './UIManager';
// export { InputManager } from './InputManager';

// ============================================================================
// ROLLING STOCK UI
// ============================================================================

export { RollingStockPanel } from './RollingStockPanel';
export { AssetImportDialog } from './AssetImportDialog';

// ============================================================================
// SCENE OUTLINER
// ============================================================================

export { SceneOutliner } from './SceneOutliner';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
    ImportConfirmCallback,
    ImportCancelCallback
} from './AssetImportDialog';