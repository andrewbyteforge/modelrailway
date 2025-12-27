/**
 * RollingStockPanel.ts - Sidebar panel for rolling stock asset management
 * 
 * Path: frontend/src/ui/RollingStockPanel.ts
 * 
 * Provides:
 * - Categorized display of rolling stock (Trains, Carriages, Freight)
 * - Accordion-style collapsible categories
 * - Asset selection for placement
 * - Asset removal with confirmation
 * - Import button integration
 * 
 * @module RollingStockPanel
 * @version 1.0.0
 */

import type {
    RollingStockCategory,
    AssetMetadata,
    AssetSelectionCallback
} from '@shared/types/assetLibrary.types';
import {
    ROLLING_STOCK_CATEGORY_LABELS,
    ROLLING_STOCK_CATEGORY_ICONS
} from '@shared/types/assetLibrary.types';
import { AssetLibraryManager } from '../systems/assets/AssetLibraryManager';
import { AssetImportDialog } from './AssetImportDialog';

// ============================================================================
// STYLE CONSTANTS
// ============================================================================

const PANEL_STYLES = {
    SECTION: `
        margin-bottom: 15px;
        border: 1px solid #ddd;
        border-radius: 8px;
        overflow: hidden;
    `,
    HEADER: `
        background: linear-gradient(135deg, #607D8B 0%, #455A64 100%);
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
    HEADER_ICON: `
        transition: transform 0.3s ease;
    `,
    CATEGORY_CONTAINER: `
        background: #f9f9f9;
    `,
    CATEGORY_HEADER: `
        background: white;
        padding: 10px 15px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #eee;
        transition: background 0.2s;
        user-select: none;
    `,
    CATEGORY_HEADER_EXPANDED: `
        background: #e3f2fd;
        border-left: 3px solid #2196F3;
    `,
    CATEGORY_TITLE: `
        font-weight: 500;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
    `,
    CATEGORY_COUNT: `
        font-size: 12px;
        color: #888;
        background: #eee;
        padding: 2px 8px;
        border-radius: 10px;
    `,
    CATEGORY_CONTENT: `
        padding: 10px;
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease, padding 0.3s ease;
    `,
    CATEGORY_CONTENT_EXPANDED: `
        max-height: 400px;
        padding: 10px;
        overflow-y: auto;
    `,
    ASSET_ITEM: `
        background: white;
        border: 1px solid #ddd;
        border-radius: 6px;
        padding: 10px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `,
    ASSET_ITEM_HOVER: `
        background: #e3f2fd;
        border-color: #2196F3;
    `,
    ASSET_ITEM_SELECTED: `
        background: #c8e6c9;
        border-color: #4CAF50;
    `,
    ASSET_INFO: `
        flex: 1;
        overflow: hidden;
    `,
    ASSET_NAME: `
        font-weight: 500;
        font-size: 13px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 2px;
    `,
    ASSET_META: `
        font-size: 11px;
        color: #888;
    `,
    REMOVE_BTN: `
        background: #ffebee;
        border: none;
        color: #e53935;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 14px;
        display: flex;
        justify-content: center;
        align-items: center;
        margin-left: 8px;
        transition: all 0.2s;
        flex-shrink: 0;
    `,
    REMOVE_BTN_HOVER: `
        background: #e53935;
        color: white;
    `,
    EMPTY_MESSAGE: `
        color: #888;
        font-size: 13px;
        text-align: center;
        padding: 15px;
        font-style: italic;
    `,
    IMPORT_BTN: `
        background: #4CAF50;
        color: white;
        border: none;
        padding: 8px 15px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: background 0.2s;
    `,
    IMPORT_BTN_HOVER: `
        background: #388E3C;
    `,
    FOOTER: `
        padding: 10px 15px;
        background: #f5f5f5;
        border-top: 1px solid #ddd;
        display: flex;
        justify-content: center;
    `
} as const;

// ============================================================================
// ROLLING STOCK PANEL CLASS
// ============================================================================

/**
 * RollingStockPanel - UI component for managing rolling stock assets
 * 
 * @example
 * ```typescript
 * const panel = new RollingStockPanel();
 * const element = panel.createElement((assetId, category) => {
 *     console.log('Selected:', assetId);
 * });
 * sidebar.appendChild(element);
 * ```
 */
export class RollingStockPanel {
    // ========================================================================
    // PRIVATE MEMBERS
    // ========================================================================

    /** Asset library manager reference */
    private libraryManager: AssetLibraryManager;

    /** Import dialog instance */
    private importDialog: AssetImportDialog;

    /** Main container element */
    private container: HTMLElement | null = null;

    /** Currently selected asset ID */
    private selectedAssetId: string | null = null;

    /** Callback when asset is selected */
    private onAssetSelected: AssetSelectionCallback | null = null;

    /** Expanded category states */
    private expandedCategories: Set<RollingStockCategory> = new Set(['trains']);

    /** Whether the main section is expanded */
    private isExpanded: boolean = true;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    constructor() {
        this.libraryManager = AssetLibraryManager.getInstance();
        this.importDialog = new AssetImportDialog();

        // Listen for library changes
        this.libraryManager.addEventListener((event) => {
            if (event.type === 'asset-added' || event.type === 'asset-removed' || event.type === 'library-cleared') {
                this.refresh();
            }
        });

        console.log('[RollingStockPanel] Created');
    }

    // ========================================================================
    // PUBLIC METHODS
    // ========================================================================

    /**
     * Create the panel element
     * 
     * @param onAssetSelected - Callback when an asset is selected for placement
     * @returns The panel HTML element
     */
    public createElement(onAssetSelected: AssetSelectionCallback): HTMLElement {
        this.onAssetSelected = onAssetSelected;

        // Create main container
        this.container = document.createElement('div');
        this.container.id = 'rolling-stock-panel';
        this.container.style.cssText = PANEL_STYLES.SECTION;

        // Create header
        const header = this.createHeader();
        this.container.appendChild(header);

        // Create category container
        const categoryContainer = document.createElement('div');
        categoryContainer.id = 'rolling-stock-categories';
        categoryContainer.style.cssText = PANEL_STYLES.CATEGORY_CONTAINER;

        // Create categories
        const categories: RollingStockCategory[] = ['trains', 'carriages', 'freight'];
        categories.forEach(category => {
            const categoryElement = this.createCategorySection(category);
            categoryContainer.appendChild(categoryElement);
        });

        this.container.appendChild(categoryContainer);

        // Create footer with import button
        const footer = this.createFooter();
        this.container.appendChild(footer);

        // Set initial expanded state
        this.updateExpandedState();

        return this.container;
    }

    /**
     * Refresh the panel to reflect current library state
     */
    public refresh(): void {
        if (!this.container) return;

        console.log('[RollingStockPanel] Refreshing...');

        const categories: RollingStockCategory[] = ['trains', 'carriages', 'freight'];
        categories.forEach(category => {
            this.refreshCategory(category);
        });
    }

    /**
     * Clear the current selection
     */
    public clearSelection(): void {
        this.selectedAssetId = null;
        this.refresh();
    }

    /**
     * Get the currently selected asset ID
     */
    public getSelectedAssetId(): string | null {
        return this.selectedAssetId;
    }

    // ========================================================================
    // PRIVATE METHODS - ELEMENT CREATION
    // ========================================================================

    /**
     * Create the panel header
     */
    private createHeader(): HTMLElement {
        const header = document.createElement('div');
        header.style.cssText = PANEL_STYLES.HEADER;

        const title = document.createElement('span');
        title.textContent = '🚃 Rolling Stock';

        const icon = document.createElement('span');
        icon.id = 'rolling-stock-expand-icon';
        icon.style.cssText = PANEL_STYLES.HEADER_ICON;
        icon.textContent = '▼';

        header.appendChild(title);
        header.appendChild(icon);

        // Toggle expand/collapse
        header.onclick = () => this.toggleExpanded();

        return header;
    }

    /**
     * Create a category section
     */
    private createCategorySection(category: RollingStockCategory): HTMLElement {
        const section = document.createElement('div');
        section.id = `rolling-stock-category-${category}`;

        // Category header
        const header = document.createElement('div');
        header.id = `rolling-stock-header-${category}`;
        header.style.cssText = PANEL_STYLES.CATEGORY_HEADER;

        const titleContainer = document.createElement('div');
        titleContainer.style.cssText = PANEL_STYLES.CATEGORY_TITLE;

        const icon = document.createElement('span');
        icon.textContent = ROLLING_STOCK_CATEGORY_ICONS[category];

        const title = document.createElement('span');
        title.textContent = ROLLING_STOCK_CATEGORY_LABELS[category];

        const count = document.createElement('span');
        count.id = `rolling-stock-count-${category}`;
        count.style.cssText = PANEL_STYLES.CATEGORY_COUNT;
        count.textContent = '0';

        titleContainer.appendChild(icon);
        titleContainer.appendChild(title);

        const rightSide = document.createElement('div');
        rightSide.style.cssText = 'display: flex; align-items: center; gap: 8px;';

        const expandIcon = document.createElement('span');
        expandIcon.id = `rolling-stock-expand-${category}`;
        expandIcon.style.cssText = 'transition: transform 0.3s; font-size: 12px;';
        expandIcon.textContent = '▶';

        rightSide.appendChild(count);
        rightSide.appendChild(expandIcon);

        header.appendChild(titleContainer);
        header.appendChild(rightSide);

        header.onclick = () => this.toggleCategory(category);

        // Category content
        const content = document.createElement('div');
        content.id = `rolling-stock-content-${category}`;
        content.style.cssText = PANEL_STYLES.CATEGORY_CONTENT;

        section.appendChild(header);
        section.appendChild(content);

        // Populate with current assets
        this.populateCategory(category, content);

        // Update expanded state
        if (this.expandedCategories.has(category)) {
            this.expandCategory(category);
        }

        return section;
    }

    /**
     * Populate a category with assets
     */
    private populateCategory(category: RollingStockCategory, content: HTMLElement): void {
        const assets = this.libraryManager.getAssetsByCategory(category);

        // Update count
        const countElement = document.getElementById(`rolling-stock-count-${category}`);
        if (countElement) {
            countElement.textContent = assets.length.toString();
        }

        // Clear existing content
        content.innerHTML = '';

        if (assets.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.style.cssText = PANEL_STYLES.EMPTY_MESSAGE;
            emptyMsg.textContent = `No ${ROLLING_STOCK_CATEGORY_LABELS[category].toLowerCase()} imported yet`;
            content.appendChild(emptyMsg);
            return;
        }

        // Add asset items
        assets.forEach(asset => {
            const item = this.createAssetItem(asset);
            content.appendChild(item);
        });
    }

    /**
     * Create an asset item element
     */
    private createAssetItem(asset: AssetMetadata): HTMLElement {
        const item = document.createElement('div');
        item.style.cssText = PANEL_STYLES.ASSET_ITEM;
        item.setAttribute('data-asset-id', asset.id);

        // Apply selected state
        if (asset.id === this.selectedAssetId) {
            item.style.cssText = PANEL_STYLES.ASSET_ITEM + PANEL_STYLES.ASSET_ITEM_SELECTED;
        }

        // Asset info
        const info = document.createElement('div');
        info.style.cssText = PANEL_STYLES.ASSET_INFO;

        const name = document.createElement('div');
        name.style.cssText = PANEL_STYLES.ASSET_NAME;
        name.textContent = asset.name;
        name.title = asset.name;

        const meta = document.createElement('div');
        meta.style.cssText = PANEL_STYLES.ASSET_META;
        meta.textContent = this.formatFileSize(asset.fileSize);

        info.appendChild(name);
        info.appendChild(meta);

        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.style.cssText = PANEL_STYLES.REMOVE_BTN;
        removeBtn.innerHTML = '×';
        removeBtn.title = 'Remove asset';

        removeBtn.onmouseover = () => removeBtn.style.cssText = PANEL_STYLES.REMOVE_BTN + PANEL_STYLES.REMOVE_BTN_HOVER;
        removeBtn.onmouseout = () => removeBtn.style.cssText = PANEL_STYLES.REMOVE_BTN;

        removeBtn.onclick = (e) => {
            e.stopPropagation();
            this.confirmRemoveAsset(asset);
        };

        item.appendChild(info);
        item.appendChild(removeBtn);

        // Selection handling
        item.onclick = () => this.selectAsset(asset);

        item.onmouseover = () => {
            if (asset.id !== this.selectedAssetId) {
                item.style.cssText = PANEL_STYLES.ASSET_ITEM + PANEL_STYLES.ASSET_ITEM_HOVER;
            }
        };

        item.onmouseout = () => {
            if (asset.id !== this.selectedAssetId) {
                item.style.cssText = PANEL_STYLES.ASSET_ITEM;
            }
        };

        return item;
    }

    /**
     * Create footer with import button
     */
    private createFooter(): HTMLElement {
        const footer = document.createElement('div');
        footer.style.cssText = PANEL_STYLES.FOOTER;

        const importBtn = document.createElement('button');
        importBtn.style.cssText = PANEL_STYLES.IMPORT_BTN;
        importBtn.innerHTML = '➕ Import Asset';

        importBtn.onmouseover = () => importBtn.style.cssText = PANEL_STYLES.IMPORT_BTN + PANEL_STYLES.IMPORT_BTN_HOVER;
        importBtn.onmouseout = () => importBtn.style.cssText = PANEL_STYLES.IMPORT_BTN;

        importBtn.onclick = () => this.openImportDialog();

        footer.appendChild(importBtn);

        return footer;
    }

    // ========================================================================
    // PRIVATE METHODS - INTERACTIONS
    // ========================================================================

    /**
     * Toggle main section expanded state
     */
    private toggleExpanded(): void {
        this.isExpanded = !this.isExpanded;
        this.updateExpandedState();
    }

    /**
     * Update the expanded state of the main section
     */
    private updateExpandedState(): void {
        const categories = document.getElementById('rolling-stock-categories');
        const footer = this.container?.querySelector('div:last-child');
        const icon = document.getElementById('rolling-stock-expand-icon');

        if (categories) {
            categories.style.display = this.isExpanded ? 'block' : 'none';
        }

        if (footer) {
            (footer as HTMLElement).style.display = this.isExpanded ? 'flex' : 'none';
        }

        if (icon) {
            icon.style.transform = this.isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';
        }
    }

    /**
     * Toggle a category's expanded state
     */
    private toggleCategory(category: RollingStockCategory): void {
        if (this.expandedCategories.has(category)) {
            this.collapseCategory(category);
        } else {
            this.expandCategory(category);
        }
    }

    /**
     * Expand a category
     */
    private expandCategory(category: RollingStockCategory): void {
        this.expandedCategories.add(category);

        const header = document.getElementById(`rolling-stock-header-${category}`);
        const content = document.getElementById(`rolling-stock-content-${category}`);
        const expandIcon = document.getElementById(`rolling-stock-expand-${category}`);

        if (header) {
            header.style.cssText = PANEL_STYLES.CATEGORY_HEADER + PANEL_STYLES.CATEGORY_HEADER_EXPANDED;
        }

        if (content) {
            content.style.cssText = PANEL_STYLES.CATEGORY_CONTENT + PANEL_STYLES.CATEGORY_CONTENT_EXPANDED;
        }

        if (expandIcon) {
            expandIcon.style.transform = 'rotate(90deg)';
        }
    }

    /**
     * Collapse a category
     */
    private collapseCategory(category: RollingStockCategory): void {
        this.expandedCategories.delete(category);

        const header = document.getElementById(`rolling-stock-header-${category}`);
        const content = document.getElementById(`rolling-stock-content-${category}`);
        const expandIcon = document.getElementById(`rolling-stock-expand-${category}`);

        if (header) {
            header.style.cssText = PANEL_STYLES.CATEGORY_HEADER;
        }

        if (content) {
            content.style.cssText = PANEL_STYLES.CATEGORY_CONTENT;
        }

        if (expandIcon) {
            expandIcon.style.transform = 'rotate(0deg)';
        }
    }

    /**
     * Refresh a specific category
     */
    private refreshCategory(category: RollingStockCategory): void {
        const content = document.getElementById(`rolling-stock-content-${category}`);
        if (content) {
            this.populateCategory(category, content);
        }
    }

    /**
     * Select an asset for placement
     */
    private selectAsset(asset: AssetMetadata): void {
        // Deselect if clicking same asset
        if (this.selectedAssetId === asset.id) {
            this.selectedAssetId = null;
        } else {
            this.selectedAssetId = asset.id;
        }

        // Update visual state
        this.refresh();

        // Notify callback
        if (this.onAssetSelected && this.selectedAssetId) {
            this.onAssetSelected(asset.id, asset.category);
        }

        console.log('[RollingStockPanel] Selected asset:', this.selectedAssetId);
    }

    /**
     * Confirm and remove an asset
     */
    private confirmRemoveAsset(asset: AssetMetadata): void {
        const confirmed = window.confirm(
            `Remove "${asset.name}" from your library?\n\n` +
            `This will permanently delete the asset and cannot be undone.`
        );

        if (confirmed) {
            this.removeAsset(asset.id);
        }
    }

    /**
     * Remove an asset from the library
     */
    private async removeAsset(assetId: string): Promise<void> {
        console.log('[RollingStockPanel] Removing asset:', assetId);

        // Clear selection if removing selected asset
        if (this.selectedAssetId === assetId) {
            this.selectedAssetId = null;
        }

        const success = await this.libraryManager.removeAsset(assetId);

        if (success) {
            console.log('[RollingStockPanel] Asset removed successfully');
            // Refresh will be triggered by the library event listener
        } else {
            console.error('[RollingStockPanel] Failed to remove asset');
            alert('Failed to remove the asset. Please try again.');
        }
    }

    /**
     * Open the import dialog
     */
    private openImportDialog(): void {
        console.log('[RollingStockPanel] Opening import dialog');

        this.importDialog.show(
            async (options) => {
                console.log('[RollingStockPanel] Import confirmed:', options);

                const result = await this.libraryManager.importAsset(options);

                if (result.success) {
                    console.log('[RollingStockPanel] Import successful:', result.assetId);

                    // Expand the category the asset was imported to
                    this.expandCategory(options.category);

                    // Select the newly imported asset
                    if (result.assetId) {
                        this.selectedAssetId = result.assetId;
                        const metadata = this.libraryManager.getAssetMetadata(result.assetId);
                        if (metadata && this.onAssetSelected) {
                            this.onAssetSelected(result.assetId, metadata.category);
                        }
                    }
                } else {
                    console.error('[RollingStockPanel] Import failed:', result.error);
                    alert(`Import failed: ${result.error}`);
                }
            },
            () => {
                console.log('[RollingStockPanel] Import cancelled');
            }
        );
    }

    // ========================================================================
    // UTILITY METHODS
    // ========================================================================

    /**
     * Format file size for display
     */
    private formatFileSize(bytes: number): string {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
}