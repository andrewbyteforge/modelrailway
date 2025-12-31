/**
 * Shared Types Index
 * 
 * Path: shared/types/index.ts
 * 
 * Re-exports all shared type definitions for easy importing.
 * 
 * @example
 * ```typescript
 * import { 
 *     RollingStockCategory, 
 *     AssetCategory,
 *     ModelDimensions 
 * } from '../../shared/types';
 * ```
 * 
 * @module SharedTypes
 * @version 1.0.0
 */

// ============================================================================
// RAILWAY TYPES (Core unified types)
// ============================================================================

export {
    // Rolling stock categories
    RollingStockCategory,
    ROLLING_STOCK_LABELS,
    ROLLING_STOCK_ICONS,

    // Scenery categories
    SceneryCategory,
    SCENERY_LABELS,
    SCENERY_ICONS,

    // Asset categories (top-level)
    AssetCategory,
    ASSET_CATEGORY_LABELS,
    ASSET_CATEGORY_ICONS,

    // Outliner node types
    OutlinerNodeType,
    DefaultOutlinerCategory,
    NODE_TYPE_TO_CATEGORY,
    NODE_TYPE_ICONS,
    OUTLINER_CATEGORY_ICONS,

    // Scaling modes
    ScalingMode,
    SCALING_MODE_LABELS,
    SCALING_MODE_DESCRIPTIONS,

    // Dimensions
    ModelDimensions,
    createModelDimensions,

    // Scale presets
    ScalePreset,
    CategoryPresets,
    ScalePivotPoint,
    ScaleConstraints,
    DEFAULT_SCALE_CONSTRAINTS,
    DEFAULT_CATEGORY_PRESETS,

    // Asset metadata
    AssetScalingConfig,
    AssetMetadata,

    // Transform
    Transform3D,
    IDENTITY_TRANSFORM,

    // Scale result
    ScaleResult,

    // Category mapping
    MODEL_CATEGORY_MAP,
    getAssetCategory,
    getOutlinerNodeType,
    isRollingStockCategory,

    // Type guards
    isValidRollingStockCategory,
    isValidAssetCategory,
    isValidScalingMode,
} from './railway.types';

// Type exports
export type {
    RollingStockCategory,
    SceneryCategory,
    AssetCategory,
    OutlinerNodeType,
    DefaultOutlinerCategory,
    ScalingMode,
    ScalePivotPoint,
} from './railway.types';

// ============================================================================
// ASSET LIBRARY TYPES
// ============================================================================

export {
    // Library structure
    AssetLibrary,
    DEFAULT_ASSET_LIBRARY,

    // Import/export
    AssetImportOptions,
    AssetImportResult,

    // Storage
    AssetStorageConfig,
    DEFAULT_STORAGE_CONFIG,

    // UI
    AssetDisplayItem,
    AssetSelectionCallback,
    AssetRemovalCallback,

    // Filter & stats
    AssetLibraryFilter,
    AssetLibraryStats,
} from './assetLibrary.types';