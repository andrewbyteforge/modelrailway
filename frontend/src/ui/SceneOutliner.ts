/**
 * SceneOutliner.ts - Hierarchical view of all placed scene items
 * 
 * Path: frontend/src/ui/SceneOutliner.ts
 * 
 * Displays a tree view of all items placed in the scene:
 * - Track pieces
 * - Rolling stock (Locomotives, Carriages, Freight)
 * - Scenery items
 * 
 * Features:
 * - Categorized display with collapsible sections
 * - Item selection (synced with scene selection)
 * - Visibility toggle per item
 * - Delete functionality
 * - Rename support
 * - Real-time updates when items are added/removed
 * 
 * @module SceneOutliner
 * @version 1.0.0
 */

import type {
    PlacedItem,
    PlacedItemType,
    PlacedTrackItem,
    PlacedRollingStockItem,
    PlacedSceneryItem,
    OutlinerSelectCallback,
    OutlinerVisibilityCallback,
    OutlinerDeleteCallback
} from '@shared/types/placedItem.types';
import {
    TRACK_TYPE_ICONS,
    ROLLING_STOCK_ICONS
} from '@shared/types/placedItem.types';
import { PlacedItemManager } from '../systems/assets/PlacedItemManager';

// ============================================================================
// STYLE CONSTANTS
// ============================================================================

const OUTLINER_STYLES = {
    CONTAINER: `
        margin-bottom: 15px;
        border: 1px solid #ddd;
        border-radius: 8px;
        overflow: hidden;
        background: white;
    `,
    HEADER: `
        background: linear-gradient(135deg, #673AB7 0%, #512DA8 100%);
        color: white;
        padding: 12px 15px;
        font-size: 16px;
        font-weight: bold;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        user-select: none;
    `,
    CONTENT: `
        max-height: 350px;
        overflow-y: auto;
        background: #f9f9f9;
    `,
    CATEGORY: `
        border-bottom: 1px solid #eee;
    `,
    CATEGORY_HEADER: `
        background: white;
        padding: 10px 15px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: background 0.2s;
        user-select: none;
        font-size: 13px;
        font-weight: 500;
    `,
    CATEGORY_HEADER_EXPANDED: `
        background: #ede7f6;
        border-left: 3px solid #673AB7;
    `,
    CATEGORY_TITLE: `
        display: flex;
        align-items: center;
        gap: 8px;
    `,
    CATEGORY_COUNT: `
        font-size: 11px;
        color: #888;
        background: #eee;
        padding: 2px 8px;
        border-radius: 10px;
    `,
    ITEMS_CONTAINER: `
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease;
        background: #fafafa;
    `,
    ITEMS_CONTAINER_EXPANDED: `
        max-height: 500px;
        overflow-y: auto;
    `,
    ITEM: `
        padding: 8px 15px 8px 30px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        transition: background 0.15s;
        border-bottom: 1px solid #f0f0f0;
        font-size: 12px;
    `,
    ITEM_HOVER: `
        background: #e8eaf6;
    `,
    ITEM_SELECTED: `
        background: #c5cae9;
        border-left: 3px solid #3F51B5;
    `,
    ITEM_INFO: `
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        overflow: hidden;
    `,
    ITEM_ICON: `
        font-size: 14px;
        flex-shrink: 0;
    `,
    ITEM_NAME: `
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    `,
    ITEM_ACTIONS: `
        display: flex;
        gap: 4px;
        opacity: 0;
        transition: opacity 0.15s;
    `,
    ACTION_BTN: `
        background: none;
        border: none;
        cursor: pointer;
        font-size: 14px;
        padding: 2px 4px;
        border-radius: 3px;
        transition: background 0.15s;
    `,
    ACTION_BTN_HOVER: `
        background: rgba(0,0,0,0.1);
    `,
    VISIBILITY_ON: `
        color: #4CAF50;
    `,
    VISIBILITY_OFF: `
        color: #ccc;
    `,
    DELETE_BTN: `
        color: #e53935;
    `,
    EMPTY_MESSAGE: `
        padding: 20px;
        text-align: center;
        color: #888;
        font-style: italic;
        font-size: 13px;
    `,
    FOOTER: `
        padding: 8px 12px;
        background: #f5f5f5;
        border-top: 1px solid #eee;
        font-size: 11px;
        color: #666;
        display: flex;
        justify-content: space-between;
    `
} as const;

// ============================================================================
// SCENE OUTLINER CLASS
// ============================================================================

/**
 * SceneOutliner - Hierarchical view of all placed scene items
 * 
 * @example
 * ```typescript
 * const outliner = new SceneOutliner();
 * const element = outliner.createElement({
 *     onSelect: (item) => console.log('Selected:', item.name),
 *     onVisibilityChange: (item, visible) => mesh.setEnabled(visible),
 *     onDelete: (item) => removeFromScene(item)
 * });
 * sidebar.appendChild(element);
 * ```
 */
export class SceneOutliner {
    // ========================================================================
    // PRIVATE MEMBERS
    // ========================================================================

    /** Placed item manager reference */
    private itemManager: PlacedItemManager;

    /** Main container element */
    private container: HTMLElement | null = null;

    /** Content area */
    private contentArea: HTMLElement | null = null;

    /** Whether the outliner is expanded */
    private isExpanded: boolean = true;

    /** Expanded categories */
    private expandedCategories: Set<string> = new Set(['track', 'rolling-stock', 'scenery']);

    /** Callbacks */
    private onSelect: OutlinerSelectCallback | null = null;
    private onVisibilityChange: OutlinerVisibilityCallback | null = null;
    private onDelete: OutlinerDeleteCallback | null = null;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    constructor() {
        this.itemManager = PlacedItemManager.getInstance();

        // Listen for item changes
        this.itemManager.addEventListener((event) => {
            this.handleItemEvent(event);
        });

        console.log('[SceneOutliner] Created');
    }

    // ========================================================================
    // PUBLIC METHODS
    // ========================================================================

    /**
     * Create the outliner element
     */
    public createElement(callbacks: {
        onSelect?: OutlinerSelectCallback;
        onVisibilityChange?: OutlinerVisibilityCallback;
        onDelete?: OutlinerDeleteCallback;
    }): HTMLElement {
        this.onSelect = callbacks.onSelect || null;
        this.onVisibilityChange = callbacks.onVisibilityChange || null;
        this.onDelete = callbacks.onDelete || null;

        // Create main container
        this.container = document.createElement('div');
        this.container.id = 'scene-outliner';
        this.container.style.cssText = OUTLINER_STYLES.CONTAINER;

        // Header
        const header = this.createHeader();
        this.container.appendChild(header);

        // Content area
        this.contentArea = document.createElement('div');
        this.contentArea.id = 'outliner-content';
        this.contentArea.style.cssText = OUTLINER_STYLES.CONTENT;
        this.container.appendChild(this.contentArea);

        // Footer with stats
        const footer = this.createFooter();
        this.container.appendChild(footer);

        // Initial render
        this.refresh();

        return this.container;
    }

    /**
     * Refresh the outliner display
     */
    public refresh(): void {
        if (!this.contentArea) return;

        console.log('[SceneOutliner] Refreshing...');

        // Clear content
        this.contentArea.innerHTML = '';

        // Get all items
        const allItems = this.itemManager.getAllItems();

        if (allItems.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.style.cssText = OUTLINER_STYLES.EMPTY_MESSAGE;
            emptyMsg.textContent = 'No items placed yet';
            this.contentArea.appendChild(emptyMsg);
        } else {
            // Create categories
            this.createCategory('track', '🛤️ Track', this.itemManager.getTrackPieces());
            this.createCategory('rolling-stock', '🚂 Rolling Stock', this.itemManager.getRollingStock());
            this.createCategory('scenery', '🌲 Scenery', this.itemManager.getScenery());
        }

        // Update footer stats
        this.updateFooter();
    }

    // ========================================================================
    // PRIVATE METHODS - ELEMENT CREATION
    // ========================================================================

    /**
     * Create the outliner header
     */
    private createHeader(): HTMLElement {
        const header = document.createElement('div');
        header.style.cssText = OUTLINER_STYLES.HEADER;

        const title = document.createElement('span');
        title.textContent = '📋 Scene Outliner';

        const expandIcon = document.createElement('span');
        expandIcon.id = 'outliner-expand-icon';
        expandIcon.style.cssText = 'transition: transform 0.3s;';
        expandIcon.textContent = '▼';

        header.appendChild(title);
        header.appendChild(expandIcon);

        // Toggle expand/collapse
        header.onclick = () => this.toggleExpanded();

        return header;
    }

    /**
     * Create the footer with stats
     */
    private createFooter(): HTMLElement {
        const footer = document.createElement('div');
        footer.id = 'outliner-footer';
        footer.style.cssText = OUTLINER_STYLES.FOOTER;
        return footer;
    }

    /**
     * Update footer stats
     */
    private updateFooter(): void {
        const footer = document.getElementById('outliner-footer');
        if (!footer) return;

        const total = this.itemManager.getTotalCount();
        const selected = this.itemManager.getSelectedItems().length;

        footer.innerHTML = `
            <span>Total: ${total} item${total !== 1 ? 's' : ''}</span>
            <span>${selected > 0 ? `Selected: ${selected}` : ''}</span>
        `;
    }

    /**
     * Create a category section
     */
    private createCategory(id: string, title: string, items: PlacedItem[]): void {
        if (!this.contentArea) return;

        const category = document.createElement('div');
        category.id = `outliner-category-${id}`;
        category.style.cssText = OUTLINER_STYLES.CATEGORY;

        // Category header
        const header = document.createElement('div');
        header.id = `outliner-header-${id}`;
        header.style.cssText = OUTLINER_STYLES.CATEGORY_HEADER;

        const titleContainer = document.createElement('div');
        titleContainer.style.cssText = OUTLINER_STYLES.CATEGORY_TITLE;
        titleContainer.innerHTML = `
            <span>${title}</span>
        `;

        const rightSide = document.createElement('div');
        rightSide.style.cssText = 'display: flex; align-items: center; gap: 8px;';

        const count = document.createElement('span');
        count.id = `outliner-count-${id}`;
        count.style.cssText = OUTLINER_STYLES.CATEGORY_COUNT;
        count.textContent = items.length.toString();

        const expandIcon = document.createElement('span');
        expandIcon.id = `outliner-expand-${id}`;
        expandIcon.style.cssText = 'transition: transform 0.3s; font-size: 10px;';
        expandIcon.textContent = this.expandedCategories.has(id) ? '▼' : '▶';

        rightSide.appendChild(count);
        rightSide.appendChild(expandIcon);

        header.appendChild(titleContainer);
        header.appendChild(rightSide);

        header.onclick = () => this.toggleCategory(id);

        // Items container
        const itemsContainer = document.createElement('div');
        itemsContainer.id = `outliner-items-${id}`;
        itemsContainer.style.cssText = OUTLINER_STYLES.ITEMS_CONTAINER;

        if (this.expandedCategories.has(id)) {
            itemsContainer.style.cssText += OUTLINER_STYLES.ITEMS_CONTAINER_EXPANDED;
            header.style.cssText += OUTLINER_STYLES.CATEGORY_HEADER_EXPANDED;
        }

        // Add items
        if (items.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding: 10px 15px; color: #aaa; font-size: 11px; font-style: italic;';
            empty.textContent = 'No items';
            itemsContainer.appendChild(empty);
        } else {
            items.forEach(item => {
                const itemElement = this.createItemElement(item);
                itemsContainer.appendChild(itemElement);
            });
        }

        category.appendChild(header);
        category.appendChild(itemsContainer);
        this.contentArea.appendChild(category);
    }

    /**
     * Create an item element
     */
    private createItemElement(item: PlacedItem): HTMLElement {
        const element = document.createElement('div');
        element.id = `outliner-item-${item.id}`;
        element.style.cssText = OUTLINER_STYLES.ITEM;
        element.setAttribute('data-item-id', item.id);

        if (item.selected) {
            element.style.cssText = OUTLINER_STYLES.ITEM + OUTLINER_STYLES.ITEM_SELECTED;
        }

        // Item info
        const info = document.createElement('div');
        info.style.cssText = OUTLINER_STYLES.ITEM_INFO;

        const icon = document.createElement('span');
        icon.style.cssText = OUTLINER_STYLES.ITEM_ICON;
        icon.textContent = this.getItemIcon(item);

        const name = document.createElement('span');
        name.style.cssText = OUTLINER_STYLES.ITEM_NAME;
        name.textContent = item.name;
        name.title = item.name;

        info.appendChild(icon);
        info.appendChild(name);

        // Actions
        const actions = document.createElement('div');
        actions.style.cssText = OUTLINER_STYLES.ITEM_ACTIONS;
        actions.className = 'outliner-item-actions';

        // Visibility toggle
        const visBtn = document.createElement('button');
        visBtn.style.cssText = OUTLINER_STYLES.ACTION_BTN +
            (item.visible ? OUTLINER_STYLES.VISIBILITY_ON : OUTLINER_STYLES.VISIBILITY_OFF);
        visBtn.innerHTML = item.visible ? '👁️' : '👁️‍🗨️';
        visBtn.title = item.visible ? 'Hide' : 'Show';
        visBtn.onclick = (e) => {
            e.stopPropagation();
            this.toggleItemVisibility(item);
        };

        // Delete button
        const delBtn = document.createElement('button');
        delBtn.style.cssText = OUTLINER_STYLES.ACTION_BTN + OUTLINER_STYLES.DELETE_BTN;
        delBtn.innerHTML = '🗑️';
        delBtn.title = 'Delete';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            this.deleteItem(item);
        };

        actions.appendChild(visBtn);
        actions.appendChild(delBtn);

        element.appendChild(info);
        element.appendChild(actions);

        // Click to select
        element.onclick = () => this.selectItem(item);

        // Hover effects
        element.onmouseover = () => {
            if (!item.selected) {
                element.style.cssText = OUTLINER_STYLES.ITEM + OUTLINER_STYLES.ITEM_HOVER;
            }
            actions.style.opacity = '1';
        };

        element.onmouseout = () => {
            if (!item.selected) {
                element.style.cssText = OUTLINER_STYLES.ITEM;
            } else {
                element.style.cssText = OUTLINER_STYLES.ITEM + OUTLINER_STYLES.ITEM_SELECTED;
            }
            actions.style.opacity = '0';
        };

        return element;
    }

    /**
     * Get icon for an item
     */
    private getItemIcon(item: PlacedItem): string {
        switch (item.type) {
            case 'track':
                return TRACK_TYPE_ICONS[(item as PlacedTrackItem).trackType] || '🛤️';
            case 'rolling-stock':
                return ROLLING_STOCK_ICONS[(item as PlacedRollingStockItem).category] || '🚂';
            case 'scenery':
                return '🌲';
            default:
                return '📦';
        }
    }

    // ========================================================================
    // PRIVATE METHODS - INTERACTIONS
    // ========================================================================

    /**
     * Toggle main outliner expanded state
     */
    private toggleExpanded(): void {
        this.isExpanded = !this.isExpanded;

        if (this.contentArea) {
            this.contentArea.style.display = this.isExpanded ? 'block' : 'none';
        }

        const footer = document.getElementById('outliner-footer');
        if (footer) {
            footer.style.display = this.isExpanded ? 'flex' : 'none';
        }

        const icon = document.getElementById('outliner-expand-icon');
        if (icon) {
            icon.style.transform = this.isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';
        }
    }

    /**
     * Toggle a category's expanded state
     */
    private toggleCategory(id: string): void {
        const isExpanded = this.expandedCategories.has(id);

        if (isExpanded) {
            this.expandedCategories.delete(id);
        } else {
            this.expandedCategories.add(id);
        }

        const header = document.getElementById(`outliner-header-${id}`);
        const items = document.getElementById(`outliner-items-${id}`);
        const icon = document.getElementById(`outliner-expand-${id}`);

        if (header) {
            header.style.cssText = OUTLINER_STYLES.CATEGORY_HEADER +
                (!isExpanded ? OUTLINER_STYLES.CATEGORY_HEADER_EXPANDED : '');
        }

        if (items) {
            items.style.cssText = OUTLINER_STYLES.ITEMS_CONTAINER +
                (!isExpanded ? OUTLINER_STYLES.ITEMS_CONTAINER_EXPANDED : '');
        }

        if (icon) {
            icon.textContent = !isExpanded ? '▼' : '▶';
        }
    }

    /**
     * Select an item
     */
    private selectItem(item: PlacedItem): void {
        // Clear previous selection
        this.itemManager.clearSelection();

        // Select new item
        this.itemManager.selectItem(item.id);

        // Update UI
        this.refresh();

        // Notify callback
        if (this.onSelect) {
            this.onSelect(item);
        }
    }

    /**
     * Toggle item visibility
     */
    private toggleItemVisibility(item: PlacedItem): void {
        const newVisibility = this.itemManager.toggleVisibility(item.id);

        // Notify callback
        if (this.onVisibilityChange) {
            this.onVisibilityChange(item, newVisibility);
        }

        // Refresh to update icon
        this.refresh();
    }

    /**
     * Delete an item
     */
    private deleteItem(item: PlacedItem): void {
        const confirmed = window.confirm(`Delete "${item.name}"?`);
        if (!confirmed) return;

        // Notify callback first (to remove from scene)
        if (this.onDelete) {
            this.onDelete(item);
        }

        // Remove from manager
        this.itemManager.removeItem(item.id);

        // Refresh will happen via event listener
    }

    /**
     * Handle item manager events
     */
    private handleItemEvent(event: { type: string; item?: PlacedItem }): void {
        // Refresh on any change
        this.refresh();
    }
}