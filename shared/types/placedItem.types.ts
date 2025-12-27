/**
 * placedItem.types.ts - Type definitions for placed scene items
 * 
 * Path: shared/types/placedItem.types.ts
 * 
 * Defines types for:
 * - Placed rolling stock instances
 * - Placed scenery items
 * - Track pieces (for outliner display)
 * - Scene hierarchy
 * 
 * @module PlacedItemTypes
 * @version 1.0.0
 */

import type { RollingStockCategory } from './assetLibrary.types';

// ============================================================================
// PLACED ITEM TYPES
// ============================================================================

/**
 * Types of items that can be placed in the scene
 */
export type PlacedItemType =
    | 'track'           // Track piece
    | 'rolling-stock'   // Locomotive, carriage, or freight wagon
    | 'scenery'         // Scenery item (trees, buildings, etc.)
    | 'structure';      // Structures (stations, bridges, etc.)

/**
 * Base interface for all placed items
 */
export interface PlacedItemBase {
    /** Unique instance ID */
    id: string;

    /** Item type */
    type: PlacedItemType;

    /** Display name for the outliner */
    name: string;

    /** Whether this item is currently visible */
    visible: boolean;

    /** Whether this item is currently selected */
    selected: boolean;

    /** Whether this item is locked (cannot be moved/deleted) */
    locked: boolean;

    /** Position in world space */
    position: {
        x: number;
        y: number;
        z: number;
    };

    /** Timestamp when placed */
    placedAt: string;
}

// ============================================================================
// TRACK PIECES
// ============================================================================

/**
 * Placed track piece for outliner display
 */
export interface PlacedTrackItem extends PlacedItemBase {
    type: 'track';

    /** Reference to track catalog entry */
    catalogId: string;

    /** Track piece ID in TrackSystem */
    pieceId: string;

    /** Track type for icon display */
    trackType: 'straight' | 'curve' | 'switch' | 'curved_switch' | 'crossing';
}

// ============================================================================
// ROLLING STOCK
// ============================================================================

/**
 * Placed rolling stock instance
 */
export interface PlacedRollingStockItem extends PlacedItemBase {
    type: 'rolling-stock';

    /** Reference to asset library entry */
    assetId: string;

    /** Rolling stock category */
    category: RollingStockCategory;

    /** Babylon.js mesh/transform node name */
    meshName: string;

    /** Whether placed on track (snapped to rails) */
    onTrack: boolean;

    /** Track edge ID if on track */
    trackEdgeId?: string;

    /** Position along track edge (0-1) */
    trackPosition?: number;

    /** Orientation on track (1 or -1) */
    trackDirection?: number;

    /** Scale applied to the model */
    scale: number;
}

// ============================================================================
// SCENERY
// ============================================================================

/**
 * Placed scenery item
 */
export interface PlacedSceneryItem extends PlacedItemBase {
    type: 'scenery';

    /** Reference to asset catalog entry (if from catalog) */
    catalogId?: string;

    /** Reference to imported asset (if custom) */
    assetId?: string;

    /** Babylon.js mesh name */
    meshName: string;

    /** Scale applied */
    scale: number;

    /** Rotation in degrees */
    rotation: {
        x: number;
        y: number;
        z: number;
    };
}

// ============================================================================
// UNION TYPE
// ============================================================================

/**
 * Any placed item type
 */
export type PlacedItem =
    | PlacedTrackItem
    | PlacedRollingStockItem
    | PlacedSceneryItem;

// ============================================================================
// OUTLINER DISPLAY
// ============================================================================

/**
 * Outliner category configuration
 */
export interface OutlinerCategory {
    id: string;
    name: string;
    icon: string;
    itemType: PlacedItemType | PlacedItemType[];
    expanded: boolean;
    count: number;
}

/**
 * Default outliner categories
 */
export const DEFAULT_OUTLINER_CATEGORIES: OutlinerCategory[] = [
    {
        id: 'track',
        name: 'Track',
        icon: '🛤️',
        itemType: 'track',
        expanded: true,
        count: 0
    },
    {
        id: 'rolling-stock',
        name: 'Rolling Stock',
        icon: '🚂',
        itemType: 'rolling-stock',
        expanded: true,
        count: 0
    },
    {
        id: 'scenery',
        name: 'Scenery',
        icon: '🌲',
        itemType: ['scenery', 'structure'],
        expanded: true,
        count: 0
    }
];

// ============================================================================
// ICONS FOR ITEM TYPES
// ============================================================================

/**
 * Icons for track types
 */
export const TRACK_TYPE_ICONS: Record<string, string> = {
    'straight': '📏',
    'curve': '↩️',
    'switch': '🔀',
    'curved_switch': '🌀',
    'crossing': '✖️'
};

/**
 * Icons for rolling stock categories
 */
export const ROLLING_STOCK_ICONS: Record<RollingStockCategory, string> = {
    'trains': '🚂',
    'carriages': '🚃',
    'freight': '🚛'
};

// ============================================================================
// CALLBACKS
// ============================================================================

/**
 * Callback when an outliner item is selected
 */
export type OutlinerSelectCallback = (item: PlacedItem) => void;

/**
 * Callback when an outliner item visibility is toggled
 */
export type OutlinerVisibilityCallback = (item: PlacedItem, visible: boolean) => void;

/**
 * Callback when an outliner item is deleted
 */
export type OutlinerDeleteCallback = (item: PlacedItem) => void;

/**
 * Callback when an outliner item is renamed
 */
export type OutlinerRenameCallback = (item: PlacedItem, newName: string) => void;