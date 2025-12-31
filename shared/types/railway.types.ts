/**
 * Unified Type Definitions for Model Railway Workbench
 * 
 * Path: shared/types/railway.types.ts
 * 
 * This file consolidates all shared type definitions that were previously
 * duplicated across multiple files. Import from here to ensure consistency.
 * 
 * CONSOLIDATES TYPES FROM:
 * - assetLibrary.types.ts (RollingStockCategory, AssetScalingMode)
 * - outliner.types.ts (OutlinerNodeType, icons)
 * - scaling.types.ts (ScalableAssetCategory, ScalePreset, ObjectDimensions)
 * - ModelScaleHelper.ts (ModelDimensions, ScalingMode)
 * 
 * @module RailwayTypes
 * @author Model Railway Workbench
 * @version 1.0.0
 */

// ============================================================================
// ROLLING STOCK CATEGORIES
// ============================================================================

/**
 * Rolling stock categories - SINGLE SOURCE OF TRUTH
 * 
 * Matches the detection in constants/index.ts detectRollingStockCategory()
 * 
 * @description
 * - locomotive: Engines that provide motive power (diesel, steam, electric)
 * - coach: Passenger carriages and coaches
 * - wagon: Freight wagons, tankers, hoppers, vans, etc.
 * - other: Unclassified rolling stock
 */
export type RollingStockCategory = 'locomotive' | 'coach' | 'wagon' | 'other';

/**
 * Human-readable labels for rolling stock categories
 */
export const ROLLING_STOCK_LABELS: Record<RollingStockCategory, string> = {
    locomotive: 'Locomotives',
    coach: 'Passenger Coaches',
    wagon: 'Freight Wagons',
    other: 'Other Rolling Stock'
};

/**
 * Icons for rolling stock categories
 */
export const ROLLING_STOCK_ICONS: Record<RollingStockCategory, string> = {
    locomotive: '🚂',
    coach: '🚃',
    wagon: '🚋',
    other: '🚞'
};


// ============================================================================
// SCENERY & ASSET CATEGORIES
// ============================================================================

/**
 * Scenery sub-categories for organization
 */
export type SceneryCategory =
    | 'building'        // Structures, stations, houses
    | 'vegetation'      // Trees, bushes, grass
    | 'infrastructure'  // Signals, posts, bridges, platforms
    | 'vehicle'         // Road vehicles, boats
    | 'figure'          // People, animals
    | 'accessory'       // Small details, clutter
    | 'other';          // Unclassified scenery

/**
 * Human-readable labels for scenery categories
 */
export const SCENERY_LABELS: Record<SceneryCategory, string> = {
    building: 'Buildings',
    vegetation: 'Vegetation',
    infrastructure: 'Infrastructure',
    vehicle: 'Vehicles',
    figure: 'Figures',
    accessory: 'Accessories',
    other: 'Other Scenery'
};

/**
 * Icons for scenery categories
 */
export const SCENERY_ICONS: Record<SceneryCategory, string> = {
    building: '🏠',
    vegetation: '🌳',
    infrastructure: '🚦',
    vehicle: '🚗',
    figure: '🧍',
    accessory: '📦',
    other: '🎨'
};


// ============================================================================
// UNIFIED ASSET CATEGORY (Top-level)
// ============================================================================

/**
 * Top-level asset categories for the entire application
 * 
 * Used by:
 * - Asset Library sidebar
 * - World Outliner
 * - Scale constraints
 * - Model placement
 */
export type AssetCategory =
    | 'rolling_stock'   // All trains (locomotives, coaches, wagons)
    | 'scenery'         // All scenery items
    | 'track'           // Track pieces (usually not user-scalable)
    | 'baseboard'       // Baseboards
    | 'light'           // Light sources
    | 'custom';         // User-defined / uncategorized

/**
 * Human-readable labels for asset categories
 */
export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
    rolling_stock: 'Rolling Stock',
    scenery: 'Scenery',
    track: 'Track',
    baseboard: 'Baseboards',
    light: 'Lights',
    custom: 'Custom'
};

/**
 * Icons for asset categories
 */
export const ASSET_CATEGORY_ICONS: Record<AssetCategory, string> = {
    rolling_stock: '🚂',
    scenery: '🏠',
    track: '🛤️',
    baseboard: '🟫',
    light: '💡',
    custom: '📦'
};


// ============================================================================
// OUTLINER NODE TYPES
// ============================================================================

/**
 * Node types for the World Outliner tree
 * 
 * Maps to AssetCategory but includes 'folder' for organization
 */
export type OutlinerNodeType =
    | 'folder'          // Organizational folder (can contain children)
    | 'baseboard'       // Baseboard item
    | 'track'           // Track piece
    | 'rolling_stock'   // Trains, wagons, etc.
    | 'scenery'         // Buildings, trees, etc.
    | 'light'           // Light sources
    | 'model';          // Generic imported 3D model

/**
 * Default category folder names
 */
export type DefaultOutlinerCategory =
    | 'Baseboards'
    | 'Track'
    | 'Rolling Stock'
    | 'Scenery'
    | 'Lights';

/**
 * Map node types to their default parent category folder
 */
export const NODE_TYPE_TO_CATEGORY: Record<Exclude<OutlinerNodeType, 'folder'>, DefaultOutlinerCategory> = {
    baseboard: 'Baseboards',
    track: 'Track',
    rolling_stock: 'Rolling Stock',
    scenery: 'Scenery',
    light: 'Lights',
    model: 'Scenery',
};

/**
 * Icons for outliner node types
 */
export const NODE_TYPE_ICONS: Record<OutlinerNodeType, string> = {
    folder: '📁',
    baseboard: '🟫',
    track: '🛤️',
    rolling_stock: '🚂',
    scenery: '🏠',
    light: '💡',
    model: '📦',
};

/**
 * Icons for default category folders
 */
export const OUTLINER_CATEGORY_ICONS: Record<DefaultOutlinerCategory, string> = {
    'Baseboards': '🟫',
    'Track': '🛤️',
    'Rolling Stock': '🚂',
    'Scenery': '🏠',
    'Lights': '💡',
};


// ============================================================================
// SCALING MODES
// ============================================================================

/**
 * Scaling mode for model import - SINGLE SOURCE OF TRUTH
 * 
 * Consolidates:
 * - AssetScalingMode from assetLibrary.types.ts
 * - ScalingMode from ModelScaleHelper.ts
 */
export type ScalingMode =
    | 'rolling_stock'   // Scale to target OO gauge rolling stock dimensions
    | 'real_world'      // Model is 1:1 real-world scale, convert to OO
    | 'reference'       // Scale based on reference dimension provided
    | 'direct'          // Apply direct scale factor
    | 'auto'            // Auto-detect best scaling method
    | 'as_is';          // Use model as-is, no scaling

/**
 * Human-readable labels for scaling modes
 */
export const SCALING_MODE_LABELS: Record<ScalingMode, string> = {
    rolling_stock: 'Rolling Stock (OO Gauge)',
    real_world: 'Real-World Scale (1:1)',
    reference: 'Reference Dimension',
    direct: 'Direct Scale Factor',
    auto: 'Auto-Detect',
    as_is: 'As-Is (No Scaling)'
};

/**
 * Descriptions for scaling modes
 */
export const SCALING_MODE_DESCRIPTIONS: Record<ScalingMode, string> = {
    rolling_stock: 'Scale to standard OO gauge dimensions based on rolling stock type',
    real_world: 'Model represents real-world 1:1 scale, will be converted to 1:76.2',
    reference: 'Scale based on a known reference dimension you provide',
    direct: 'Apply a specific scale factor directly',
    auto: 'Automatically detect the best scaling method based on model size',
    as_is: 'Import without any scaling adjustments'
};


// ============================================================================
// MODEL DIMENSIONS - UNIFIED INTERFACE
// ============================================================================

/**
 * Complete model dimensions interface - SINGLE SOURCE OF TRUTH
 * 
 * Consolidates:
 * - ModelDimensions from ModelScaleHelper.ts
 * - ObjectDimensions from scaling.types.ts
 * - boundingBox from assetLibrary.types.ts
 */
export interface ModelDimensions {
    /** Width in meters (X axis) */
    width: number;

    /** Height in meters (Y axis) */
    height: number;

    /** Depth in meters (Z axis) */
    depth: number;

    /** Maximum dimension (longest axis) */
    maxDimension: number;

    /** Minimum dimension (shortest axis) */
    minDimension: number;

    /** Bounding sphere radius (for culling, selection) */
    boundingRadius?: number;

    /** Center point of bounding box */
    center?: {
        x: number;
        y: number;
        z: number;
    };

    /** Minimum bounds corner (bottom-left-back) */
    boundsMin?: {
        x: number;
        y: number;
        z: number;
    };

    /** Maximum bounds corner (top-right-front) */
    boundsMax?: {
        x: number;
        y: number;
        z: number;
    };
}

/**
 * Create ModelDimensions from width/height/depth only
 * Computes derived values automatically
 */
export function createModelDimensions(
    width: number,
    height: number,
    depth: number
): ModelDimensions {
    return {
        width,
        height,
        depth,
        maxDimension: Math.max(width, height, depth),
        minDimension: Math.min(width, height, depth),
        boundingRadius: Math.sqrt(width * width + height * height + depth * depth) / 2,
        center: { x: 0, y: height / 2, z: 0 },
        boundsMin: { x: -width / 2, y: 0, z: -depth / 2 },
        boundsMax: { x: width / 2, y: height, z: depth / 2 }
    };
}


// ============================================================================
// SCALE PRESETS - UNIFIED INTERFACE
// ============================================================================

/**
 * A named scale preset - SINGLE SOURCE OF TRUTH
 * 
 * Consolidates:
 * - ScalePreset from scaling.types.ts
 * - ModelScalePreset from ModelLibrary.ts
 */
export interface ScalePreset {
    /** Unique identifier */
    id: string;

    /** Display name */
    name: string;

    /** Scale factor to apply (1.0 = 100%) */
    scaleFactor: number;

    /** Optional description */
    description?: string;

    /** Icon (emoji or icon class) */
    icon?: string;

    /** Whether this is the default preset */
    isDefault?: boolean;
}

/**
 * Collection of presets for an asset category
 */
export interface CategoryPresets {
    /** Asset category these presets apply to */
    category: AssetCategory;

    /** Default scale for new items of this category */
    defaultScale: number;

    /** Default pivot point for scaling */
    defaultPivot: ScalePivotPoint;

    /** Available presets */
    presets: ScalePreset[];
}


// ============================================================================
// SCALE CONSTRAINTS
// ============================================================================

/**
 * Pivot point options for scaling operations
 */
export type ScalePivotPoint =
    | 'base_center'     // Bottom center (buildings, trees)
    | 'center'          // Volumetric center (rolling stock)
    | 'top_center'      // Top center (hanging items)
    | 'custom';         // User-defined position

/**
 * Constraints applied to scaling operations
 */
export interface ScaleConstraints {
    /** Minimum allowed scale factor (e.g., 0.1 = 10%) */
    minScale: number;

    /** Maximum allowed scale factor (e.g., 5.0 = 500%) */
    maxScale: number;

    /** Snap increment when snapping is enabled (e.g., 0.05 = 5% steps) */
    snapIncrement: number;

    /** Whether snap-to-increment is enabled */
    snapEnabled: boolean;

    /** Whether constraints can be bypassed (e.g., with Shift key) */
    allowBypass: boolean;

    /** Key modifier that bypasses constraints */
    bypassModifier: 'shift' | 'ctrl' | 'alt';
}

/**
 * Default scale constraints per asset category
 */
export const DEFAULT_SCALE_CONSTRAINTS: Record<AssetCategory, ScaleConstraints> = {
    rolling_stock: {
        minScale: 0.5,
        maxScale: 2.0,
        snapIncrement: 0.05,
        snapEnabled: true,
        allowBypass: true,
        bypassModifier: 'shift'
    },
    scenery: {
        minScale: 0.06,
        maxScale: 5.0,
        snapIncrement: 0.05,
        snapEnabled: false,
        allowBypass: true,
        bypassModifier: 'shift'
    },
    track: {
        minScale: 1.0,
        maxScale: 1.0,
        snapIncrement: 0.0,
        snapEnabled: false,
        allowBypass: false,
        bypassModifier: 'shift'
    },
    baseboard: {
        minScale: 1.0,
        maxScale: 1.0,
        snapIncrement: 0.0,
        snapEnabled: false,
        allowBypass: false,
        bypassModifier: 'shift'
    },
    light: {
        minScale: 0.1,
        maxScale: 3.0,
        snapIncrement: 0.1,
        snapEnabled: true,
        allowBypass: true,
        bypassModifier: 'shift'
    },
    custom: {
        minScale: 0.06,
        maxScale: 10.0,
        snapIncrement: 0.05,
        snapEnabled: true,
        allowBypass: true,
        bypassModifier: 'shift'
    }
};

/**
 * Default presets per asset category
 */
export const DEFAULT_CATEGORY_PRESETS: Record<AssetCategory, CategoryPresets> = {
    rolling_stock: {
        category: 'rolling_stock',
        defaultScale: 1.0,
        defaultPivot: 'center',
        presets: [
            { id: 'oo-standard', name: 'OO Standard', scaleFactor: 1.0, icon: '🚂', description: 'Standard OO gauge (1:76.2)', isDefault: true },
            { id: 'oo-small', name: 'Narrow Gauge', scaleFactor: 0.75, icon: '🚃', description: 'Smaller narrow gauge stock' },
            { id: 'oo-large', name: 'Large', scaleFactor: 1.25, icon: '🚄', description: 'Larger continental stock' }
        ]
    },
    scenery: {
        category: 'scenery',
        defaultScale: 1.0,
        defaultPivot: 'base_center',
        presets: [
            { id: 'scenery-small', name: 'Small', scaleFactor: 0.5, icon: '🌱', description: 'Small plants/details' },
            { id: 'scenery-medium', name: 'Medium', scaleFactor: 1.0, icon: '🌳', description: 'Standard size', isDefault: true },
            { id: 'scenery-large', name: 'Large', scaleFactor: 1.5, icon: '🌲', description: 'Larger trees/features' },
            { id: 'scenery-background', name: 'Background', scaleFactor: 0.75, icon: '🏘️', description: 'Forced perspective for distance' }
        ]
    },
    track: {
        category: 'track',
        defaultScale: 1.0,
        defaultPivot: 'base_center',
        presets: [
            { id: 'track-standard', name: 'Standard', scaleFactor: 1.0, icon: '🛤️', description: 'Track cannot be scaled', isDefault: true }
        ]
    },
    baseboard: {
        category: 'baseboard',
        defaultScale: 1.0,
        defaultPivot: 'base_center',
        presets: [
            { id: 'baseboard-standard', name: 'Standard', scaleFactor: 1.0, icon: '🟫', description: 'Baseboards cannot be scaled', isDefault: true }
        ]
    },
    light: {
        category: 'light',
        defaultScale: 1.0,
        defaultPivot: 'base_center',
        presets: [
            { id: 'light-dim', name: 'Dim', scaleFactor: 0.5, icon: '🔅', description: 'Reduced intensity' },
            { id: 'light-standard', name: 'Standard', scaleFactor: 1.0, icon: '💡', description: 'Normal intensity', isDefault: true },
            { id: 'light-bright', name: 'Bright', scaleFactor: 1.5, icon: '☀️', description: 'Increased intensity' }
        ]
    },
    custom: {
        category: 'custom',
        defaultScale: 1.0,
        defaultPivot: 'base_center',
        presets: []
    }
};


// ============================================================================
// ASSET METADATA
// ============================================================================

/**
 * Scaling configuration stored with an asset
 */
export interface AssetScalingConfig {
    /** Scaling mode used */
    mode: ScalingMode;

    /** Scale factor applied (for direct mode) */
    scaleFactor?: number;

    /** Reference length in mm (for reference mode) */
    referenceLengthMm?: number;

    /** Computed final scale */
    computedScale?: number;

    /** Rolling stock type (if mode is rolling_stock) */
    rollingStockType?: RollingStockCategory;
}

/**
 * Complete metadata for an imported asset
 */
export interface AssetMetadata {
    /** Unique identifier */
    id: string;

    /** Display name */
    name: string;

    /** Original filename */
    originalFilename: string;

    /** Top-level category */
    category: AssetCategory;

    /** Sub-category for rolling stock */
    rollingStockCategory?: RollingStockCategory;

    /** Sub-category for scenery */
    sceneryCategory?: SceneryCategory;

    /** Relative path to asset file */
    filePath: string;

    /** Relative path to thumbnail */
    thumbnailPath?: string;

    /** Scaling configuration */
    scaling: AssetScalingConfig;

    /** Original file size in bytes */
    fileSize: number;

    /** Bounding box dimensions after scaling */
    boundingBox?: ModelDimensions;

    /** Import timestamp */
    importedAt: string;

    /** Last used timestamp */
    lastUsedAt?: string;

    /** Usage count */
    usageCount: number;

    /** User tags */
    tags?: string[];

    /** User description */
    description?: string;
}


// ============================================================================
// TRANSFORM DATA
// ============================================================================

/**
 * Transform data for position, rotation, scale
 */
export interface Transform3D {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number }; // Quaternion
    scale: { x: number; y: number; z: number };
}

/**
 * Default identity transform
 */
export const IDENTITY_TRANSFORM: Transform3D = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 }
};


// ============================================================================
// SCALE OPERATION RESULT
// ============================================================================

/**
 * Result of a scale calculation or operation
 */
export interface ScaleResult {
    /** Calculated scale factor */
    scaleFactor: number;

    /** Resulting dimensions after scaling (OO scale size) */
    resultDimensions: {
        widthM: number;
        heightM: number;
        depthM: number;
    };

    /** Real-world equivalent dimensions */
    realWorldDimensions?: {
        widthM: number;
        heightM: number;
        depthM: number;
    };

    /** Description of scaling method used */
    description: string;

    /** Confidence level */
    confidence: 'high' | 'medium' | 'low';

    /** Whether scale was clamped by constraints */
    wasClamped?: boolean;

    /** Whether scale was snapped to increment */
    wasSnapped?: boolean;
}


// ============================================================================
// CATEGORY MAPPING HELPERS
// ============================================================================

/**
 * Map model import category strings to AssetCategory
 */
export const MODEL_CATEGORY_MAP: Record<string, AssetCategory> = {
    // Rolling stock mappings
    'rolling_stock': 'rolling_stock',
    'locomotive': 'rolling_stock',
    'coach': 'rolling_stock',
    'wagon': 'rolling_stock',
    'train': 'rolling_stock',
    'carriage': 'rolling_stock',
    'freight': 'rolling_stock',

    // Scenery mappings
    'scenery': 'scenery',
    'building': 'scenery',
    'buildings': 'scenery',
    'structure': 'scenery',
    'vegetation': 'scenery',
    'accessory': 'scenery',
    'accessories': 'scenery',
    'infrastructure': 'scenery',
    'vehicles': 'scenery',
    'figures': 'scenery',

    // Other mappings
    'track': 'track',
    'baseboard': 'baseboard',
    'light': 'light',
    'custom': 'custom',
};

/**
 * Get AssetCategory from a category string
 */
export function getAssetCategory(categoryStr: string): AssetCategory {
    const normalized = categoryStr.toLowerCase().replace(/-/g, '_');
    return MODEL_CATEGORY_MAP[normalized] || 'custom';
}

/**
 * Get OutlinerNodeType for a category string
 */
export function getOutlinerNodeType(categoryStr: string): OutlinerNodeType {
    const assetCat = getAssetCategory(categoryStr);

    // Map AssetCategory to OutlinerNodeType
    switch (assetCat) {
        case 'rolling_stock': return 'rolling_stock';
        case 'scenery': return 'scenery';
        case 'track': return 'track';
        case 'baseboard': return 'baseboard';
        case 'light': return 'light';
        default: return 'model';
    }
}

/**
 * Check if a category is rolling stock
 */
export function isRollingStockCategory(category: string): boolean {
    return getAssetCategory(category) === 'rolling_stock';
}


// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for RollingStockCategory
 */
export function isValidRollingStockCategory(value: string): value is RollingStockCategory {
    return ['locomotive', 'coach', 'wagon', 'other'].includes(value);
}

/**
 * Type guard for AssetCategory
 */
export function isValidAssetCategory(value: string): value is AssetCategory {
    return ['rolling_stock', 'scenery', 'track', 'baseboard', 'light', 'custom'].includes(value);
}

/**
 * Type guard for ScalingMode
 */
export function isValidScalingMode(value: string): value is ScalingMode {
    return ['rolling_stock', 'real_world', 'reference', 'direct', 'auto', 'as_is'].includes(value);
}