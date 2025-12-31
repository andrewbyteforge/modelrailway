/**
 * ModelCategory.types.ts - Unified model category type definitions
 * 
 * Path: frontend/src/types/ModelCategory.types.ts
 * 
 * Provides:
 * - ModelCategory type with rolling stock subcategories
 * - Category metadata (icons, labels, groups)
 * - Helper functions for category operations
 * 
 * This replaces the separate assetLibrary.types.ts and consolidates
 * all category definitions into one source of truth.
 * 
 * @module ModelCategoryTypes
 * @author Model Railway Workbench
 * @version 2.0.0 - Consolidated from Model Library and Asset Library systems
 */

// ============================================================================
// PRIMARY CATEGORY TYPE
// ============================================================================

/**
 * All available model categories
 * 
 * Rolling stock is broken into subcategories for better organization:
 * - locomotive: Steam, diesel, electric engines
 * - coach: Passenger carriages
 * - wagon: Freight wagons, tankers, hoppers
 * - multiple_unit: DMUs, EMUs, HSTs
 * 
 * General categories cover everything else:
 * - buildings: Houses, stations, factories
 * - scenery: Trees, bushes, rocks, grass
 * - infrastructure: Bridges, tunnels, signals
 * - vehicles: Cars, trucks, buses (road vehicles)
 * - figures: People, animals
 * - accessories: Benches, lamps, fences
 * - custom: User-defined/uncategorized
 */
export type ModelCategory =
    // Rolling Stock (track-placed)
    | 'locomotive'
    | 'coach'
    | 'wagon'
    | 'multiple_unit'
    // General Categories (baseboard-placed)
    | 'buildings'
    | 'scenery'
    | 'infrastructure'
    | 'vehicles'
    | 'figures'
    | 'accessories'
    | 'custom';

// ============================================================================
// CATEGORY GROUPS
// ============================================================================

/**
 * Rolling stock categories - models that must be placed on track
 */
export const ROLLING_STOCK_CATEGORIES: ModelCategory[] = [
    'locomotive',
    'coach',
    'wagon',
    'multiple_unit'
];

/**
 * General categories - models placed on baseboard
 */
export const GENERAL_CATEGORIES: ModelCategory[] = [
    'buildings',
    'scenery',
    'infrastructure',
    'vehicles',
    'figures',
    'accessories',
    'custom'
];

/**
 * All categories in display order
 */
export const ALL_CATEGORIES: ModelCategory[] = [
    ...ROLLING_STOCK_CATEGORIES,
    ...GENERAL_CATEGORIES
];

// ============================================================================
// CATEGORY METADATA
// ============================================================================

/**
 * Display labels for each category
 */
export const CATEGORY_LABELS: Record<ModelCategory, string> = {
    // Rolling Stock
    locomotive: 'Locomotives',
    coach: 'Coaches & Carriages',
    wagon: 'Wagons & Freight',
    multiple_unit: 'Multiple Units',
    // General
    buildings: 'Buildings',
    scenery: 'Scenery',
    infrastructure: 'Infrastructure',
    vehicles: 'Road Vehicles',
    figures: 'Figures',
    accessories: 'Accessories',
    custom: 'Custom'
};

/**
 * Icons for each category (emoji)
 */
export const CATEGORY_ICONS: Record<ModelCategory, string> = {
    // Rolling Stock
    locomotive: '🚂',
    coach: '🚃',
    wagon: '🚋',
    multiple_unit: '🚄',
    // General
    buildings: '🏠',
    scenery: '🌳',
    infrastructure: '🌉',
    vehicles: '🚗',
    figures: '👤',
    accessories: '🪑',
    custom: '📦'
};

/**
 * Short descriptions for each category
 */
export const CATEGORY_DESCRIPTIONS: Record<ModelCategory, string> = {
    // Rolling Stock
    locomotive: 'Steam, diesel, and electric locomotives',
    coach: 'Passenger carriages and coaches',
    wagon: 'Freight wagons, tankers, hoppers, and vans',
    multiple_unit: 'DMUs, EMUs, HSTs, and railcars',
    // General
    buildings: 'Houses, stations, factories, and structures',
    scenery: 'Trees, bushes, rocks, and natural features',
    infrastructure: 'Bridges, tunnels, signals, and track-side items',
    vehicles: 'Cars, trucks, buses, and road vehicles',
    figures: 'People and animals',
    accessories: 'Benches, lamps, fences, and small details',
    custom: 'User-defined and uncategorized models'
};

// ============================================================================
// CATEGORY GROUPS FOR UI
// ============================================================================

/**
 * Category group definition for UI organization
 */
export interface CategoryGroup {
    id: string;
    label: string;
    icon: string;
    categories: ModelCategory[];
    defaultExpanded: boolean;
}

/**
 * Grouped categories for sidebar/panel display
 */
export const CATEGORY_GROUPS: CategoryGroup[] = [
    {
        id: 'rolling-stock',
        label: 'Rolling Stock',
        icon: '🚂',
        categories: ['locomotive', 'coach', 'wagon', 'multiple_unit'],
        defaultExpanded: true
    },
    {
        id: 'structures',
        label: 'Buildings & Structures',
        icon: '🏗️',
        categories: ['buildings', 'infrastructure'],
        defaultExpanded: false
    },
    {
        id: 'scenery',
        label: 'Scenery & Details',
        icon: '🌳',
        categories: ['scenery', 'vehicles', 'figures', 'accessories'],
        defaultExpanded: false
    },
    {
        id: 'other',
        label: 'Other',
        icon: '📦',
        categories: ['custom'],
        defaultExpanded: false
    }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a category is rolling stock (requires track placement)
 * @param category - Category to check
 * @returns True if rolling stock
 */
export function isRollingStock(category: ModelCategory): boolean {
    return ROLLING_STOCK_CATEGORIES.includes(category);
}

/**
 * Check if a category requires track placement
 * Alias for isRollingStock for clarity
 * @param category - Category to check
 * @returns True if requires track placement
 */
export function requiresTrackPlacement(category: ModelCategory): boolean {
    return isRollingStock(category);
}

/**
 * Get the display label for a category
 * @param category - Category
 * @returns Display label
 */
export function getCategoryLabel(category: ModelCategory): string {
    return CATEGORY_LABELS[category] || 'Unknown';
}

/**
 * Get the icon for a category
 * @param category - Category
 * @returns Icon emoji
 */
export function getCategoryIcon(category: ModelCategory): string {
    return CATEGORY_ICONS[category] || '📦';
}

/**
 * Get the group a category belongs to
 * @param category - Category
 * @returns Category group or undefined
 */
export function getCategoryGroup(category: ModelCategory): CategoryGroup | undefined {
    return CATEGORY_GROUPS.find(group => group.categories.includes(category));
}

/**
 * Get formatted label with icon
 * @param category - Category
 * @returns Formatted string like "🚂 Locomotives"
 */
export function getFormattedCategoryLabel(category: ModelCategory): string {
    return `${getCategoryIcon(category)} ${getCategoryLabel(category)}`;
}

// ============================================================================
// DETECTION HELPERS (for auto-categorization)
// ============================================================================

/**
 * Keywords that suggest locomotive
 */
const LOCOMOTIVE_KEYWORDS = [
    'loco', 'locomotive', 'engine', 'class_', 'br_', 'gwr_', 'lner_', 'lms_', 'sr_',
    'diesel', 'steam', 'electric', 'shunter', 'tender'
];

/**
 * Keywords that suggest coach
 */
const COACH_KEYWORDS = [
    'coach', 'carriage', 'passenger', 'pullman', 'sleeper', 'dining',
    'mk1', 'mk2', 'mk3', 'mk4', 'intercity'
];

/**
 * Keywords that suggest wagon
 */
const WAGON_KEYWORDS = [
    'wagon', 'freight', 'goods', 'tanker', 'hopper', 'van', 'boxcar',
    'flatcar', 'gondola', 'container', 'brake'
];

/**
 * Keywords that suggest multiple unit
 */
const MULTIPLE_UNIT_KEYWORDS = [
    'dmu', 'emu', 'hst', 'unit', 'railcar', 'sprinter', 'turbostar',
    'electrostar', 'desiro', 'voyager', 'pendolino'
];

/**
 * Detect category from filename
 * @param fileName - File name to analyze
 * @returns Detected category or 'custom' if unknown
 */
export function detectCategoryFromFilename(fileName: string): ModelCategory {
    const lower = fileName.toLowerCase();

    // Check rolling stock first (more specific)
    if (LOCOMOTIVE_KEYWORDS.some(kw => lower.includes(kw))) {
        return 'locomotive';
    }
    if (COACH_KEYWORDS.some(kw => lower.includes(kw))) {
        return 'coach';
    }
    if (WAGON_KEYWORDS.some(kw => lower.includes(kw))) {
        return 'wagon';
    }
    if (MULTIPLE_UNIT_KEYWORDS.some(kw => lower.includes(kw))) {
        return 'multiple_unit';
    }

    // Check general categories
    if (lower.includes('building') || lower.includes('house') || lower.includes('station')) {
        return 'buildings';
    }
    if (lower.includes('tree') || lower.includes('bush') || lower.includes('rock')) {
        return 'scenery';
    }
    if (lower.includes('bridge') || lower.includes('tunnel') || lower.includes('signal')) {
        return 'infrastructure';
    }
    if (lower.includes('car') || lower.includes('truck') || lower.includes('bus')) {
        return 'vehicles';
    }
    if (lower.includes('person') || lower.includes('figure') || lower.includes('people')) {
        return 'figures';
    }

    return 'custom';
}

/**
 * Detect rolling stock subtype for more specific categorization
 * @param fileName - File name to analyze
 * @returns Rolling stock type or null if not rolling stock
 */
export function detectRollingStockType(
    fileName: string
): 'locomotive' | 'steam_locomotive' | 'coach' | 'wagon' | 'multiple_unit' | null {
    const lower = fileName.toLowerCase();

    // Check for steam specifically
    if (lower.includes('steam') && LOCOMOTIVE_KEYWORDS.some(kw => lower.includes(kw))) {
        return 'steam_locomotive';
    }

    // Check other rolling stock types
    if (LOCOMOTIVE_KEYWORDS.some(kw => lower.includes(kw))) {
        return 'locomotive';
    }
    if (COACH_KEYWORDS.some(kw => lower.includes(kw))) {
        return 'coach';
    }
    if (WAGON_KEYWORDS.some(kw => lower.includes(kw))) {
        return 'wagon';
    }
    if (MULTIPLE_UNIT_KEYWORDS.some(kw => lower.includes(kw))) {
        return 'multiple_unit';
    }

    return null;
}