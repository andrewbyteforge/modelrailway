/**
 * PlacedItemManager.ts - Manages all placed items in the scene
 * 
 * Path: frontend/src/systems/assets/PlacedItemManager.ts
 * 
 * Central registry for tracking all placed items:
 * - Track pieces
 * - Rolling stock instances
 * - Scenery items
 * 
 * Provides:
 * - Add/remove/update placed items
 * - Query by type/category
 * - Selection management
 * - Event notifications for UI updates
 * - Serialization for save/load
 * 
 * @module PlacedItemManager
 * @version 1.0.0
 */

import type {
    PlacedItem,
    PlacedItemType,
    PlacedTrackItem,
    PlacedRollingStockItem,
    PlacedSceneryItem
} from '@shared/types/placedItem.types';
import type { RollingStockCategory } from '@shared/types/assetLibrary.types';

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Event types for placed item changes
 */
export type PlacedItemEventType =
    | 'item-added'
    | 'item-removed'
    | 'item-updated'
    | 'item-selected'
    | 'item-deselected'
    | 'items-cleared'
    | 'visibility-changed';

/**
 * Placed item change event
 */
export interface PlacedItemEvent {
    type: PlacedItemEventType;
    item?: PlacedItem;
    items?: PlacedItem[];
}

/**
 * Event listener callback
 */
export type PlacedItemEventListener = (event: PlacedItemEvent) => void;

// ============================================================================
// PLACED ITEM MANAGER CLASS
// ============================================================================

/**
 * PlacedItemManager - Singleton manager for tracking placed scene items
 * 
 * @example
 * ```typescript
 * const manager = PlacedItemManager.getInstance();
 * 
 * // Add a placed rolling stock
 * manager.addRollingStock({
 *     assetId: 'asset_123',
 *     name: 'BR Class 66',
 *     category: 'trains',
 *     meshName: 'rollingstock_0',
 *     position: { x: 0, y: 0.01, z: 0 }
 * });
 * 
 * // Get all placed items
 * const allItems = manager.getAllItems();
 * ```
 */
export class PlacedItemManager {
    // ========================================================================
    // SINGLETON PATTERN
    // ========================================================================

    private static instance: PlacedItemManager | null = null;

    /**
     * Get the singleton instance
     */
    public static getInstance(): PlacedItemManager {
        if (!PlacedItemManager.instance) {
            PlacedItemManager.instance = new PlacedItemManager();
        }
        return PlacedItemManager.instance;
    }

    // ========================================================================
    // PRIVATE MEMBERS
    // ========================================================================

    /** All placed items indexed by ID */
    private items: Map<string, PlacedItem> = new Map();

    /** Currently selected item IDs */
    private selectedIds: Set<string> = new Set();

    /** Next ID counters by type */
    private nextIds: Record<PlacedItemType, number> = {
        'track': 0,
        'rolling-stock': 0,
        'scenery': 0,
        'structure': 0
    };

    /** Event listeners */
    private listeners: Set<PlacedItemEventListener> = new Set();

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    private constructor() {
        console.log('[PlacedItemManager] Instance created');
    }

    // ========================================================================
    // ID GENERATION
    // ========================================================================

    /**
     * Generate a unique ID for a placed item
     */
    private generateId(type: PlacedItemType): string {
        const id = this.nextIds[type]++;
        const prefix = type.replace('-', '');
        return `placed_${prefix}_${id}`;
    }

    // ========================================================================
    // ADD ITEMS
    // ========================================================================

    /**
     * Add a placed track piece
     */
    public addTrackPiece(data: {
        pieceId: string;
        catalogId: string;
        name: string;
        trackType: PlacedTrackItem['trackType'];
        position: { x: number; y: number; z: number };
    }): PlacedTrackItem {
        const item: PlacedTrackItem = {
            id: this.generateId('track'),
            type: 'track',
            name: data.name,
            visible: true,
            selected: false,
            locked: false,
            position: { ...data.position },
            placedAt: new Date().toISOString(),
            catalogId: data.catalogId,
            pieceId: data.pieceId,
            trackType: data.trackType
        };

        this.items.set(item.id, item);
        this.emit({ type: 'item-added', item });

        console.log('[PlacedItemManager] Added track piece:', item.id, item.name);
        return item;
    }

    /**
     * Add a placed rolling stock instance
     */
    public addRollingStock(data: {
        assetId: string;
        name: string;
        category: RollingStockCategory;
        meshName: string;
        position: { x: number; y: number; z: number };
        scale?: number;
        onTrack?: boolean;
        trackEdgeId?: string;
        trackPosition?: number;
        trackDirection?: number;
    }): PlacedRollingStockItem {
        const item: PlacedRollingStockItem = {
            id: this.generateId('rolling-stock'),
            type: 'rolling-stock',
            name: data.name,
            visible: true,
            selected: false,
            locked: false,
            position: { ...data.position },
            placedAt: new Date().toISOString(),
            assetId: data.assetId,
            category: data.category,
            meshName: data.meshName,
            onTrack: data.onTrack ?? false,
            trackEdgeId: data.trackEdgeId,
            trackPosition: data.trackPosition,
            trackDirection: data.trackDirection,
            scale: data.scale ?? 1.0
        };

        this.items.set(item.id, item);
        this.emit({ type: 'item-added', item });

        console.log('[PlacedItemManager] Added rolling stock:', item.id, item.name);
        return item;
    }

    /**
     * Add a placed scenery item
     */
    public addScenery(data: {
        name: string;
        meshName: string;
        position: { x: number; y: number; z: number };
        catalogId?: string;
        assetId?: string;
        scale?: number;
        rotation?: { x: number; y: number; z: number };
    }): PlacedSceneryItem {
        const item: PlacedSceneryItem = {
            id: this.generateId('scenery'),
            type: 'scenery',
            name: data.name,
            visible: true,
            selected: false,
            locked: false,
            position: { ...data.position },
            placedAt: new Date().toISOString(),
            catalogId: data.catalogId,
            assetId: data.assetId,
            meshName: data.meshName,
            scale: data.scale ?? 1.0,
            rotation: data.rotation ?? { x: 0, y: 0, z: 0 }
        };

        this.items.set(item.id, item);
        this.emit({ type: 'item-added', item });

        console.log('[PlacedItemManager] Added scenery:', item.id, item.name);
        return item;
    }

    // ========================================================================
    // REMOVE ITEMS
    // ========================================================================

    /**
     * Remove a placed item by ID
     */
    public removeItem(id: string): boolean {
        const item = this.items.get(id);
        if (!item) {
            console.warn('[PlacedItemManager] Item not found:', id);
            return false;
        }

        // Deselect if selected
        this.selectedIds.delete(id);

        // Remove from collection
        this.items.delete(id);
        this.emit({ type: 'item-removed', item });

        console.log('[PlacedItemManager] Removed item:', id);
        return true;
    }

    /**
     * Remove item by mesh name (useful when deleting from scene)
     */
    public removeByMeshName(meshName: string): boolean {
        for (const [id, item] of this.items) {
            if ('meshName' in item && item.meshName === meshName) {
                return this.removeItem(id);
            }
            if ('pieceId' in item && item.pieceId === meshName) {
                return this.removeItem(id);
            }
        }
        return false;
    }

    /**
     * Remove all items of a specific type
     */
    public removeByType(type: PlacedItemType): number {
        let count = 0;
        const idsToRemove: string[] = [];

        for (const [id, item] of this.items) {
            if (item.type === type) {
                idsToRemove.push(id);
            }
        }

        for (const id of idsToRemove) {
            if (this.removeItem(id)) {
                count++;
            }
        }

        console.log('[PlacedItemManager] Removed', count, 'items of type:', type);
        return count;
    }

    /**
     * Clear all placed items
     */
    public clear(): void {
        const items = Array.from(this.items.values());
        this.items.clear();
        this.selectedIds.clear();

        // Reset ID counters
        this.nextIds = {
            'track': 0,
            'rolling-stock': 0,
            'scenery': 0,
            'structure': 0
        };

        this.emit({ type: 'items-cleared', items });
        console.log('[PlacedItemManager] Cleared all items');
    }

    // ========================================================================
    // QUERY ITEMS
    // ========================================================================

    /**
     * Get all placed items
     */
    public getAllItems(): PlacedItem[] {
        return Array.from(this.items.values());
    }

    /**
     * Get item by ID
     */
    public getItem(id: string): PlacedItem | undefined {
        return this.items.get(id);
    }

    /**
     * Get items by type
     */
    public getItemsByType(type: PlacedItemType): PlacedItem[] {
        return Array.from(this.items.values()).filter(item => item.type === type);
    }

    /**
     * Get rolling stock items
     */
    public getRollingStock(): PlacedRollingStockItem[] {
        return this.getItemsByType('rolling-stock') as PlacedRollingStockItem[];
    }

    /**
     * Get rolling stock by category
     */
    public getRollingStockByCategory(category: RollingStockCategory): PlacedRollingStockItem[] {
        return this.getRollingStock().filter(item => item.category === category);
    }

    /**
     * Get track pieces
     */
    public getTrackPieces(): PlacedTrackItem[] {
        return this.getItemsByType('track') as PlacedTrackItem[];
    }

    /**
     * Get scenery items
     */
    public getScenery(): PlacedSceneryItem[] {
        return this.getItemsByType('scenery') as PlacedSceneryItem[];
    }

    /**
     * Get item count by type
     */
    public getCountByType(type: PlacedItemType): number {
        return this.getItemsByType(type).length;
    }

    /**
     * Get total item count
     */
    public getTotalCount(): number {
        return this.items.size;
    }

    // ========================================================================
    // SELECTION
    // ========================================================================

    /**
     * Select an item
     */
    public selectItem(id: string): void {
        const item = this.items.get(id);
        if (item) {
            item.selected = true;
            this.selectedIds.add(id);
            this.emit({ type: 'item-selected', item });
        }
    }

    /**
     * Deselect an item
     */
    public deselectItem(id: string): void {
        const item = this.items.get(id);
        if (item) {
            item.selected = false;
            this.selectedIds.delete(id);
            this.emit({ type: 'item-deselected', item });
        }
    }

    /**
     * Clear all selection
     */
    public clearSelection(): void {
        for (const id of this.selectedIds) {
            const item = this.items.get(id);
            if (item) {
                item.selected = false;
            }
        }
        this.selectedIds.clear();
        this.emit({ type: 'item-deselected' });
    }

    /**
     * Get selected items
     */
    public getSelectedItems(): PlacedItem[] {
        return Array.from(this.selectedIds)
            .map(id => this.items.get(id))
            .filter(Boolean) as PlacedItem[];
    }

    // ========================================================================
    // VISIBILITY
    // ========================================================================

    /**
     * Set item visibility
     */
    public setVisibility(id: string, visible: boolean): void {
        const item = this.items.get(id);
        if (item) {
            item.visible = visible;
            this.emit({ type: 'visibility-changed', item });
        }
    }

    /**
     * Toggle item visibility
     */
    public toggleVisibility(id: string): boolean {
        const item = this.items.get(id);
        if (item) {
            item.visible = !item.visible;
            this.emit({ type: 'visibility-changed', item });
            return item.visible;
        }
        return false;
    }

    // ========================================================================
    // UPDATE ITEMS
    // ========================================================================

    /**
     * Update item properties
     */
    public updateItem(id: string, updates: Partial<PlacedItem>): void {
        const item = this.items.get(id);
        if (item) {
            Object.assign(item, updates);
            this.emit({ type: 'item-updated', item });
        }
    }

    /**
     * Update item position
     */
    public updatePosition(id: string, position: { x: number; y: number; z: number }): void {
        const item = this.items.get(id);
        if (item) {
            item.position = { ...position };
            this.emit({ type: 'item-updated', item });
        }
    }

    /**
     * Rename an item
     */
    public renameItem(id: string, name: string): void {
        const item = this.items.get(id);
        if (item) {
            item.name = name;
            this.emit({ type: 'item-updated', item });
        }
    }

    // ========================================================================
    // EVENT SYSTEM
    // ========================================================================

    /**
     * Add an event listener
     */
    public addEventListener(listener: PlacedItemEventListener): void {
        this.listeners.add(listener);
    }

    /**
     * Remove an event listener
     */
    public removeEventListener(listener: PlacedItemEventListener): void {
        this.listeners.delete(listener);
    }

    /**
     * Emit an event to all listeners
     */
    private emit(event: PlacedItemEvent): void {
        this.listeners.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.error('[PlacedItemManager] Error in event listener:', error);
            }
        });
    }

    // ========================================================================
    // SERIALIZATION
    // ========================================================================

    /**
     * Export all placed items to JSON
     */
    public toJSON(): object {
        return {
            items: Array.from(this.items.values()),
            nextIds: { ...this.nextIds }
        };
    }

    /**
     * Import placed items from JSON
     */
    public fromJSON(data: { items: PlacedItem[]; nextIds?: Record<PlacedItemType, number> }): void {
        this.clear();

        if (data.nextIds) {
            this.nextIds = { ...data.nextIds };
        }

        for (const item of data.items) {
            this.items.set(item.id, item);
        }

        this.emit({ type: 'items-cleared', items: data.items });
        console.log('[PlacedItemManager] Imported', data.items.length, 'items');
    }
}