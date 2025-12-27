/**
 * Shared Types - Index
 * 
 * Path: shared/types/index.ts
 * 
 * Re-exports all type definitions for easy importing
 * 
 * @module SharedTypes
 */

// ============================================================================
// EXISTING TYPE EXPORTS
// ============================================================================

// Uncomment and add your existing type exports here
// export * from './common.types';
// export * from './project.types';
// export * from './layout.types';

// ============================================================================
// ASSET LIBRARY TYPES
// ============================================================================

export * from './assetLibrary.types';

// ============================================================================
// PLACED ITEM TYPES
// ============================================================================

export * from './placedItem.types';

// ============================================================================
// ASSET LIBRARY TYPE RE-EXPORTS
// ============================================================================

export type {
    RollingStockCategory,
    AssetMetadata,
    AssetLibrary,
    AssetImportOptions,
    AssetImportResult,
    AssetScalingMode,
    AssetStorageConfig,
    AssetDisplayItem,
    AssetSelectionCallback,
    AssetRemovalCallback
} from './assetLibrary.types';

export {
    ROLLING_STOCK_CATEGORY_LABELS,
    ROLLING_STOCK_CATEGORY_ICONS,
    DEFAULT_ASSET_LIBRARY,
    DEFAULT_STORAGE_CONFIG
} from './assetLibrary.types';

// ============================================================================
// PLACED ITEM TYPE RE-EXPORTS
// ============================================================================

export type {
    PlacedItemType,
    PlacedItemBase,
    PlacedTrackItem,
    PlacedRollingStockItem,
    PlacedSceneryItem,
    PlacedItem,
    OutlinerCategory,
    OutlinerSelectCallback,
    OutlinerVisibilityCallback,
    OutlinerDeleteCallback
} from './placedItem.types';

export {
    DEFAULT_OUTLINER_CATEGORIES,
    TRACK_TYPE_ICONS,
    ROLLING_STOCK_ICONS
} from './placedItem.types';