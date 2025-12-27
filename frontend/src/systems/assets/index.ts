/**
 * Assets System - Index
 * 
 * Path: frontend/src/systems/assets/index.ts
 * 
 * Re-exports all asset system components for easy importing
 * 
 * @module AssetsSystem
 */

// ============================================================================
// ASSET LIBRARY MANAGER
// ============================================================================

export { AssetLibraryManager } from './AssetLibraryManager';

// Re-export types from AssetLibraryManager
export type {
    LibraryEventType,
    LibraryEvent,
    LibraryEventListener
} from './AssetLibraryManager';

// ============================================================================
// PLACED ITEM MANAGER
// ============================================================================

export { PlacedItemManager } from './PlacedItemManager';

// Re-export types from PlacedItemManager
export type {
    PlacedItemEventType,
    PlacedItemEvent,
    PlacedItemEventListener
} from './PlacedItemManager';

// ============================================================================
// TYPE RE-EXPORTS FROM SHARED
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
    AssetRemovalCallback,
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
} from '@shared/types';

export {
    ROLLING_STOCK_CATEGORY_LABELS,
    ROLLING_STOCK_CATEGORY_ICONS,
    DEFAULT_ASSET_LIBRARY,
    DEFAULT_STORAGE_CONFIG,
    DEFAULT_OUTLINER_CATEGORIES,
    TRACK_TYPE_ICONS,
    ROLLING_STOCK_ICONS
} from '@shared/types';