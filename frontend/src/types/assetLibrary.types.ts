/**
 * assetLibrary.types.ts - Type definitions for persistent asset library
 * 
 * Path: shared/types/assetLibrary.types.ts
 * 
 * Defines types for:
 * - Rolling stock categories (Trains, Carriages, Freight)
 * - Asset metadata and storage
 * - Import/export operations
 * 
 * @module AssetLibraryTypes
 * @version 1.0.0
 */

// ============================================================================
// ROLLING STOCK CATEGORIES
// ============================================================================

/**
 * Categories for rolling stock assets
 * 
 * @description
 * - trains: Locomotives/engines that provide motive power
 * - carriages: Passenger coaches and carriages
 * - freight: Freight wagons, tankers, hoppers, etc.
 */
export type RollingStockCategory = 'trains' | 'carriages' | 'freight';

/**
 * Human-readable labels for rolling stock categories
 */
export const ROLLING_STOCK_CATEGORY_LABELS: Record<RollingStockCategory, string> = {
    trains: 'Locomotives',
    carriages: 'Passenger Carriages',
    freight: 'Freight Wagons'
};

/**
 * Icons for rolling stock categories (emoji)
 */
export const ROLLING_STOCK_CATEGORY_ICONS: Record<RollingStockCategory, string> = {
    trains: '🚂',
    carriages: '🚃',
    freight: '🚛'
};

// ============================================================================
// ASSET METADATA
// ============================================================================

/**
 * Scaling mode for imported assets
 */
export type AssetScalingMode =
    | 'real-world'      // Scale based on real-world dimensions
    | 'reference'       // Scale based on reference dimensions provided
    | 'direct-scale'    // Apply direct scale factor
    | 'as-is';          // Use model as-is

/**
 * Metadata for an imported asset
 */
export interface AssetMetadata {
    /** Unique identifier for the asset */
    id: string;

    /** Display name (user-provided or derived from filename) */
    name: string;

    /** Original filename */
    originalFilename: string;

    /** Category this asset belongs to */
    category: RollingStockCategory;

    /** Relative path to the asset file in storage */
    filePath: string;

    /** Relative path to thumbnail image (if generated) */
    thumbnailPath?: string;

    /** Scaling configuration */
    scaling: {
        mode: AssetScalingMode;
        /** Scale factor applied (for direct-scale mode) */
        scaleFactor?: number;
        /** Reference length in mm (for reference mode) */
        referenceLengthMm?: number;
        /** Computed uniform scale */
        computedScale?: number;
    };

    /** Original file size in bytes */
    fileSize: number;

    /** Bounding box dimensions in meters after scaling */
    boundingBox?: {
        width: number;
        height: number;
        depth: number;
    };

    /** Timestamp when asset was imported */
    importedAt: string;

    /** Timestamp when asset was last used */
    lastUsedAt?: string;

    /** Number of times this asset has been placed */
    usageCount: number;

    /** User-provided tags for organization */
    tags?: string[];

    /** User-provided description */
    description?: string;
}

// ============================================================================
// ASSET LIBRARY
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

    /** Quick lookup by category */
    categoryIndex: Record<RollingStockCategory, string[]>;
}

/**
 * Default empty asset library
 */
export const DEFAULT_ASSET_LIBRARY: AssetLibrary = {
    schemaVersion: '1.0.0',
    lastModified: new Date().toISOString(),
    assets: {},
    categoryIndex: {
        trains: [],
        carriages: [],
        freight: []
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

    /** Category to import into */
    category: RollingStockCategory;

    /** Display name (optional, defaults to filename) */
    name?: string;

    /** Scaling configuration */
    scaling: {
        mode: AssetScalingMode;
        scaleFactor?: number;
        referenceLengthMm?: number;
    };

    /** Optional description */
    description?: string;

    /** Optional tags */
    tags?: string[];
}

/**
 * Result of an import operation
 */
export interface AssetImportResult {
    success: boolean;
    assetId?: string;
    error?: string;
}

// ============================================================================
// STORAGE PATHS
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
    basePath: 'assets/rolling-stock',
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
    id: string;
    name: string;
    category: RollingStockCategory;
    thumbnailUrl?: string;
    isLoading?: boolean;
}

/**
 * Callback when an asset is selected for placement
 */
export type AssetSelectionCallback = (assetId: string, category: RollingStockCategory) => void;

/**
 * Callback for asset removal confirmation
 */
export type AssetRemovalCallback = (assetId: string) => Promise<boolean>;