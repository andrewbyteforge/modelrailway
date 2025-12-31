/**
 * assetLibrary.types.ts - Type definitions for persistent asset library
 * 
 * Path: frontend/src/types/assetLibrary.types.ts
 * 
 * Defines types for asset library operations.
 * Core types are imported from railway.types.ts for consistency.
 * 
 * @module AssetLibraryTypes
 * @version 2.0.0 - Refactored to use unified types
 */

// ============================================================================
// IMPORTS FROM UNIFIED TYPES
// ============================================================================

// Type-only imports (erased at runtime)
import type {
    RollingStockCategory,
    AssetCategory,
    SceneryCategory,
    ScalingMode,
    AssetScalingConfig,
    ModelDimensions,
    AssetMetadata,
} from './railway.types';

// Value imports (exist at runtime)
import {
    ROLLING_STOCK_LABELS,
    ROLLING_STOCK_ICONS,
    ASSET_CATEGORY_LABELS,
    ASSET_CATEGORY_ICONS,
} from './railway.types';

// ============================================================================
// RE-EXPORTS FOR BACKWARDS COMPATIBILITY
// ============================================================================

// Re-export types
export type {
    RollingStockCategory,
    AssetCategory,
    SceneryCategory,
    ScalingMode,
    AssetScalingConfig,
    ModelDimensions,
    AssetMetadata,
};

// Re-export values
export {
    ROLLING_STOCK_LABELS,
    ROLLING_STOCK_ICONS,
    ASSET_CATEGORY_LABELS,
    ASSET_CATEGORY_ICONS,
};

// Legacy alias for backwards compatibility
export type AssetScalingMode = ScalingMode;

// Legacy labels (map old names to new)
export const ROLLING_STOCK_CATEGORY_LABELS = ROLLING_STOCK_LABELS;
export const ROLLING_STOCK_CATEGORY_ICONS = ROLLING_STOCK_ICONS;

// ============================================================================
// ASSET LIBRARY STRUCTURE
// ============================================================================

/**
 * Complete asset library manifest
 */
export interface AssetLibrary {
    /** Schema version for future compatibility */
    schemaVersion: string;

    /** Timestamp when library was last modified */
    lastModified: string;

    /** Map of asset ID to metadata */
    assets: Record<string, AssetMetadata>;

    /** Quick lookup: asset IDs by top-level category */
    categoryIndex: Record<AssetCategory, string[]>;

    /** Quick lookup: rolling stock IDs by sub-category */
    rollingStockIndex: Record<RollingStockCategory, string[]>;

    /** Quick lookup: scenery IDs by sub-category */
    sceneryIndex: Record<SceneryCategory, string[]>;
}

/**
 * Default empty asset library
 */
export const DEFAULT_ASSET_LIBRARY: AssetLibrary = {
    schemaVersion: '2.0.0',
    lastModified: new Date().toISOString(),
    assets: {},
    categoryIndex: {
        rolling_stock: [],
        scenery: [],
        track: [],
        baseboard: [],
        light: [],
        custom: []
    },
    rollingStockIndex: {
        locomotive: [],
        coach: [],
        wagon: [],
        other: []
    },
    sceneryIndex: {
        building: [],
        vegetation: [],
        infrastructure: [],
        vehicle: [],
        figure: [],
        accessory: [],
        other: []
    }
};

// ============================================================================
// IMPORT OPTIONS
// ============================================================================

/**
 * Options for importing a new asset
 */
export interface AssetImportOptions {
    /** File to import (File object from browser) */
    file: File;

    /** Top-level category */
    category: AssetCategory;

    /** Sub-category for rolling stock */
    rollingStockCategory?: RollingStockCategory;

    /** Sub-category for scenery */
    sceneryCategory?: SceneryCategory;

    /** Display name (optional, defaults to filename) */
    name?: string;

    /** Scaling configuration */
    scaling: AssetScalingConfig;

    /** Optional description */
    description?: string;

    /** Optional tags */
    tags?: string[];
}

/**
 * Result of an import operation
 */
export interface AssetImportResult {
    /** Whether import succeeded */
    success: boolean;

    /** Asset ID if successful */
    assetId?: string;

    /** Full metadata if successful */
    metadata?: AssetMetadata;

    /** Error message if failed */
    error?: string;
}

// ============================================================================
// STORAGE CONFIGURATION
// ============================================================================

/**
 * Storage configuration for asset library
 */
export interface AssetStorageConfig {
    /** Base directory for asset storage */
    basePath: string;

    /** Subdirectory for model files */
    modelsDir: string;

    /** Subdirectory for thumbnails */
    thumbnailsDir: string;

    /** Filename for library manifest */
    manifestFilename: string;
}

/**
 * Default storage configuration
 */
export const DEFAULT_STORAGE_CONFIG: AssetStorageConfig = {
    basePath: 'assets/library',
    modelsDir: 'models',
    thumbnailsDir: 'thumbnails',
    manifestFilename: 'library.json'
};

// ============================================================================
// UI TYPES
// ============================================================================

/**
 * Asset item for display in sidebar
 */
export interface AssetDisplayItem {
    /** Asset ID */
    id: string;

    /** Display name */
    name: string;

    /** Top-level category */
    category: AssetCategory;

    /** Rolling stock sub-category (if applicable) */
    rollingStockCategory?: RollingStockCategory;

    /** Scenery sub-category (if applicable) */
    sceneryCategory?: SceneryCategory;

    /** Thumbnail URL */
    thumbnailUrl?: string;

    /** Whether asset is currently loading */
    isLoading?: boolean;

    /** Whether asset is currently selected */
    isSelected?: boolean;
}

/**
 * Callback when an asset is selected for placement
 */
export type AssetSelectionCallback = (
    assetId: string,
    category: AssetCategory,
    subCategory?: RollingStockCategory | SceneryCategory
) => void;

/**
 * Callback for asset removal confirmation
 */
export type AssetRemovalCallback = (assetId: string) => Promise<boolean>;

// ============================================================================
// FILTER & SEARCH
// ============================================================================

/**
 * Filter options for asset library queries
 */
export interface AssetLibraryFilter {
    /** Filter by top-level category */
    category?: AssetCategory;

    /** Filter by rolling stock sub-category */
    rollingStockCategory?: RollingStockCategory;

    /** Filter by scenery sub-category */
    sceneryCategory?: SceneryCategory;

    /** Filter by tags (any match) */
    tags?: string[];

    /** Search text (matches name, description) */
    searchText?: string;

    /** Sort field */
    sortBy?: 'name' | 'importedAt' | 'lastUsedAt' | 'usageCount';

    /** Sort direction */
    sortOrder?: 'asc' | 'desc';

    /** Maximum results */
    limit?: number;
}

/**
 * Statistics for the asset library
 */
export interface AssetLibraryStats {
    /** Total number of assets */
    totalAssets: number;

    /** Count by top-level category */
    byCategory: Record<AssetCategory, number>;

    /** Count by rolling stock sub-category */
    byRollingStock: Record<RollingStockCategory, number>;

    /** Count by scenery sub-category */
    byScenery: Record<SceneryCategory, number>;

    /** Total storage used in bytes */
    totalStorageBytes: number;

    /** Most recently imported asset */
    lastImported?: AssetMetadata;

    /** Most frequently used asset */
    mostUsed?: AssetMetadata;
}