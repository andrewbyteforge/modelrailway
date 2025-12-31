/**
 * ModelLibraryPanel.ts - Unified UI panel for the model library
 * 
 * Path: frontend/src/ui/ModelLibraryPanel.ts
 * 
 * Provides:
 * - Grouped display of all models by category
 * - Rolling stock section with subcategories (locomotives, coaches, wagons)
 * - General models section (buildings, scenery, etc.)
 * - Model selection for placement
 * - Import button integration
 * - Search and filter functionality
 * - Model management (delete, favorite, edit scale)
 * 
 * This is the unified panel replacing both the old ModelLibraryPanel
 * and the separate RollingStockPanel.
 * 
 * @module ModelLibraryPanel
 * @author Model Railway Workbench
 * @version 2.0.0 - Consolidated with rolling stock subcategories
 */

import { ModelLibrary, type ModelLibraryEntry } from '../systems/models/ModelLibrary';
import { ModelScaleHelper } from '../systems/models/ModelScaleHelper';
import {
    type ModelCategory,
    CATEGORY_GROUPS,
    CATEGORY_LABELS,
    CATEGORY_ICONS,
    ROLLING_STOCK_CATEGORIES,
    isRollingStock,
    getCategoryLabel,
    getCategoryIcon,
    type CategoryGroup
} from '../types/ModelCategory.types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[ModelLibraryPanel]';

/** Panel width in pixels */
const PANEL_WIDTH = 280;

// ============================================================================
// STYLE CONSTANTS
// ============================================================================

const PANEL_STYLES = {
    // ------------------------------------------------------------------------
    // Container
    // ------------------------------------------------------------------------
    CONTAINER: `
        position: fixed;
        top: 200px;
        left: 20px;
        width: ${PANEL_WIDTH}px;
        max-height: calc(100vh - 220px);
        background: rgba(255, 255, 255, 0.98);
        border: 2px solid #333;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    `,

    // ------------------------------------------------------------------------
    // Header
    // ------------------------------------------------------------------------
    HEADER: `
        padding: 12px;
        background: linear-gradient(135deg, #2c3e50 0%, #1a252f 100%);
        color: white;
        border-radius: 6px 6px 0 0;
        flex-shrink: 0;
    `,
    HEADER_ROW: `
        display: flex;
        justify-content: space-between;
        align-items: center;
    `,
    HEADER_TITLE: `
        margin: 0;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
    `,
    IMPORT_BTN: `
        padding: 6px 12px;
        border: none;
        border-radius: 4px;
        background: #4CAF50;
        color: white;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
        transition: background 0.2s;
    `,

    // ------------------------------------------------------------------------
    // Search
    // ------------------------------------------------------------------------
    SEARCH_CONTAINER: `
        padding: 10px 12px;
        border-bottom: 1px solid #ddd;
        background: #f9f9f9;
        flex-shrink: 0;
    `,
    SEARCH_INPUT: `
        width: 100%;
        padding: 8px 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 13px;
        box-sizing: border-box;
    `,

    // ------------------------------------------------------------------------
    // Content Area
    // ------------------------------------------------------------------------
    CONTENT: `
        flex: 1;
        overflow-y: auto;
        padding: 8px;
    `,

    // ------------------------------------------------------------------------
    // Category Groups
    // ------------------------------------------------------------------------
    GROUP: `
        margin-bottom: 8px;
        border: 1px solid #ddd;
        border-radius: 6px;
        overflow: hidden;
        background: white;
    `,
    GROUP_HEADER: `
        padding: 10px 12px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: background 0.2s;
        user-select: none;
        font-size: 13px;
        font-weight: 600;
    `,
    GROUP_HEADER_ROLLING_STOCK: `
        background: linear-gradient(135deg, #607D8B 0%, #455A64 100%);
        color: white;
    `,
    GROUP_HEADER_STRUCTURES: `
        background: linear-gradient(135deg, #795548 0%, #5D4037 100%);
        color: white;
    `,
    GROUP_HEADER_SCENERY: `
        background: linear-gradient(135deg, #4CAF50 0%, #388E3C 100%);
        color: white;
    `,
    GROUP_HEADER_OTHER: `
        background: linear-gradient(135deg, #9E9E9E 0%, #757575 100%);
        color: white;
    `,
    GROUP_TITLE: `
        display: flex;
        align-items: center;
        gap: 8px;
    `,
    GROUP_COUNT: `
        font-size: 11px;
        opacity: 0.8;
        background: rgba(255,255,255,0.2);
        padding: 2px 8px;
        border-radius: 10px;
    `,
    GROUP_CONTENT: `
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease;
        background: #fafafa;
    `,
    GROUP_CONTENT_EXPANDED: `
        max-height: 600px;
        overflow-y: auto;
    `,

    // ------------------------------------------------------------------------
    // Subcategories (within groups)
    // ------------------------------------------------------------------------
    SUBCATEGORY: `
        border-bottom: 1px solid #eee;
    `,
    SUBCATEGORY_HEADER: `
        padding: 8px 12px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: white;
        transition: background 0.15s;
        font-size: 12px;
    `,
    SUBCATEGORY_HEADER_EXPANDED: `
        background: #e8f5e9;
        border-left: 3px solid #4CAF50;
    `,
    SUBCATEGORY_TITLE: `
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 500;
    `,
    SUBCATEGORY_COUNT: `
        font-size: 10px;
        color: #888;
        background: #eee;
        padding: 1px 6px;
        border-radius: 8px;
    `,
    SUBCATEGORY_CONTENT: `
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.25s ease;
        padding: 0 8px;
    `,
    SUBCATEGORY_CONTENT_EXPANDED: `
        max-height: 400px;
        overflow-y: auto;
        padding: 8px;
    `,

    // ------------------------------------------------------------------------
    // Model Cards
    // ------------------------------------------------------------------------
    MODEL_CARD: `
        background: white;
        border: 1px solid #ddd;
        border-radius: 6px;
        padding: 10px;
        margin-bottom: 6px;
        cursor: pointer;
        transition: all 0.15s;
        display: flex;
        align-items: center;
        gap: 10px;
    `,
    MODEL_CARD_HOVER: `
        border-color: #999;
        background: #f5f5f5;
    `,
    MODEL_CARD_SELECTED: `
        border-color: #4CAF50;
        background: #e8f5e9;
        box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
    `,
    MODEL_ICON: `
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f0f0f0;
        border-radius: 6px;
        font-size: 18px;
        flex-shrink: 0;
    `,
    MODEL_INFO: `
        flex: 1;
        min-width: 0;
        overflow: hidden;
    `,
    MODEL_NAME: `
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 2px;
    `,
    MODEL_META: `
        font-size: 10px;
        color: #888;
    `,
    MODEL_ACTIONS: `
        display: flex;
        flex-direction: column;
        gap: 2px;
        opacity: 0;
        transition: opacity 0.15s;
    `,
    ACTION_BTN: `
        padding: 4px 6px;
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 12px;
        opacity: 0.4;
        transition: opacity 0.15s;
    `,

    // ------------------------------------------------------------------------
    // Footer
    // ------------------------------------------------------------------------
    FOOTER: `
        padding: 8px 12px;
        background: #f5f5f5;
        border-top: 1px solid #ddd;
        font-size: 11px;
        color: #666;
        flex-shrink: 0;
    `,

    // ------------------------------------------------------------------------
    // Empty State
    // ------------------------------------------------------------------------
    EMPTY_MESSAGE: `
        padding: 20px;
        text-align: center;
        color: #888;
        font-style: italic;
        font-size: 12px;
    `
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Callback when a model is selected for placement
 */
export type ModelSelectCallback = (libraryId: string) => void;

/**
 * Callback when import button is clicked
 */
export type ImportRequestCallback = () => void;

// ============================================================================
// MODEL LIBRARY PANEL CLASS
// ============================================================================

/**
 * ModelLibraryPanel - Unified sidebar panel for model library
 * 
 * Displays all imported models organized by category groups:
 * - Rolling Stock (locomotives, coaches, wagons, multiple units)
 * - Buildings & Structures
 * - Scenery & Details
 * - Other
 * 
 * @example
 * ```typescript
 * const panel = new ModelLibraryPanel(document.body);
 * panel.initialize(
 *     (libraryId) => console.log('Selected:', libraryId),
 *     () => console.log('Import requested')
 * );
 * ```
 */
export class ModelLibraryPanel {
    // ========================================================================
    // PRIVATE PROPERTIES
    // ========================================================================

    /** Container element */
    private container: HTMLElement;

    /** Panel element */
    private panel: HTMLElement | null = null;

    /** Model library reference */
    private library: ModelLibrary;

    /** Currently selected model ID */
    private selectedModelId: string | null = null;

    /** Current search text */
    private searchText: string = '';

    /** Expanded groups */
    private expandedGroups: Set<string> = new Set(['rolling-stock']);

    /** Expanded subcategories */
    private expandedSubcategories: Set<ModelCategory> = new Set(['locomotive']);

    /** Model selection callback */
    private onModelSelect: ModelSelectCallback | null = null;

    /** Import request callback */
    private onImportRequest: ImportRequestCallback | null = null;

    /** Unsubscribe function for library changes */
    private unsubscribeLibrary: (() => void) | null = null;

    // ========================================================================
    // CONSTRUCTOR & INITIALIZATION
    // ========================================================================

    /**
     * Create a new ModelLibraryPanel
     * @param container - Parent element
     */
    constructor(container: HTMLElement) {
        if (!container) {
            throw new Error(`${LOG_PREFIX} Container element is required`);
        }
        this.container = container;
        this.library = ModelLibrary.getInstance();
        console.log(`${LOG_PREFIX} Created`);
    }

    /**
     * Initialize the panel
     * @param onModelSelect - Called when model is selected
     * @param onImportRequest - Called when import is requested
     */
    initialize(
        onModelSelect: ModelSelectCallback,
        onImportRequest: ImportRequestCallback
    ): void {
        this.onModelSelect = onModelSelect;
        this.onImportRequest = onImportRequest;

        this.createPanel();

        // Subscribe to library changes
        this.unsubscribeLibrary = this.library.onChange(() => {
            this.renderContent();
        });

        console.log(`${LOG_PREFIX} ✓ Initialized`);
    }

    // ========================================================================
    // PANEL CREATION
    // ========================================================================

    /**
     * Create the panel DOM structure
     */
    private createPanel(): void {
        this.panel = document.createElement('div');
        this.panel.id = 'model-library-panel';
        this.panel.style.cssText = PANEL_STYLES.CONTAINER;

        // Header
        this.panel.appendChild(this.createHeader());

        // Search
        this.panel.appendChild(this.createSearchBar());

        // Content area
        const content = document.createElement('div');
        content.id = 'library-content';
        content.style.cssText = PANEL_STYLES.CONTENT;
        this.panel.appendChild(content);

        // Footer
        this.panel.appendChild(this.createFooter());

        // Add to DOM
        this.container.appendChild(this.panel);

        // Initial render
        this.renderContent();
    }

    /**
     * Create the header with title and import button
     */
    private createHeader(): HTMLElement {
        const header = document.createElement('div');
        header.style.cssText = PANEL_STYLES.HEADER;

        const row = document.createElement('div');
        row.style.cssText = PANEL_STYLES.HEADER_ROW;

        const title = document.createElement('h3');
        title.style.cssText = PANEL_STYLES.HEADER_TITLE;
        title.innerHTML = '📦 Model Library';

        const importBtn = document.createElement('button');
        importBtn.id = 'import-model-btn';
        importBtn.style.cssText = PANEL_STYLES.IMPORT_BTN;
        importBtn.textContent = '+ Import';
        importBtn.title = 'Import a new 3D model';

        importBtn.onmouseover = () => importBtn.style.background = '#388E3C';
        importBtn.onmouseout = () => importBtn.style.background = '#4CAF50';
        importBtn.onclick = () => {
            if (this.onImportRequest) {
                this.onImportRequest();
            }
        };

        row.appendChild(title);
        row.appendChild(importBtn);
        header.appendChild(row);

        return header;
    }

    /**
     * Create the search bar
     */
    private createSearchBar(): HTMLElement {
        const container = document.createElement('div');
        container.style.cssText = PANEL_STYLES.SEARCH_CONTAINER;

        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'model-search';
        input.placeholder = '🔍 Search models...';
        input.style.cssText = PANEL_STYLES.SEARCH_INPUT;

        input.oninput = () => {
            this.searchText = input.value.toLowerCase();
            this.renderContent();
        };

        container.appendChild(input);
        return container;
    }

    /**
     * Create the footer with stats
     */
    private createFooter(): HTMLElement {
        const footer = document.createElement('div');
        footer.id = 'library-footer';
        footer.style.cssText = PANEL_STYLES.FOOTER;
        return footer;
    }

    // ========================================================================
    // CONTENT RENDERING
    // ========================================================================

    /**
     * Render the content area with category groups
     */
    private renderContent(): void {
        const content = document.getElementById('library-content');
        if (!content) return;

        content.innerHTML = '';

        const allModels = this.getFilteredModels();

        // Render each category group
        CATEGORY_GROUPS.forEach(group => {
            const groupModels = allModels.filter(m =>
                group.categories.includes(m.category as ModelCategory)
            );

            // Only show groups that have models or are rolling stock (always show)
            if (groupModels.length > 0 || group.id === 'rolling-stock') {
                content.appendChild(this.createGroupSection(group, groupModels));
            }
        });

        // Update footer stats
        this.updateFooterStats();
    }

    /**
     * Get filtered models based on search text
     */
    private getFilteredModels(): ModelLibraryEntry[] {
        const allModels = this.library.getAll();

        if (!this.searchText) {
            return allModels;
        }

        return allModels.filter(model =>
            model.name.toLowerCase().includes(this.searchText) ||
            model.category.toLowerCase().includes(this.searchText) ||
            model.tags.some(tag => tag.toLowerCase().includes(this.searchText))
        );
    }

    /**
     * Create a category group section
     */
    private createGroupSection(group: CategoryGroup, models: ModelLibraryEntry[]): HTMLElement {
        const section = document.createElement('div');
        section.className = 'library-group';
        section.style.cssText = PANEL_STYLES.GROUP;

        // Determine header style based on group
        let headerStyle = PANEL_STYLES.GROUP_HEADER;
        switch (group.id) {
            case 'rolling-stock':
                headerStyle += PANEL_STYLES.GROUP_HEADER_ROLLING_STOCK;
                break;
            case 'structures':
                headerStyle += PANEL_STYLES.GROUP_HEADER_STRUCTURES;
                break;
            case 'scenery':
                headerStyle += PANEL_STYLES.GROUP_HEADER_SCENERY;
                break;
            default:
                headerStyle += PANEL_STYLES.GROUP_HEADER_OTHER;
        }

        // Header
        const header = document.createElement('div');
        header.id = `group-header-${group.id}`;
        header.style.cssText = headerStyle;

        const titleContainer = document.createElement('div');
        titleContainer.style.cssText = PANEL_STYLES.GROUP_TITLE;
        titleContainer.innerHTML = `
            <span>${group.icon}</span>
            <span>${group.label}</span>
        `;

        const rightSide = document.createElement('div');
        rightSide.style.cssText = 'display: flex; align-items: center; gap: 8px;';

        const count = document.createElement('span');
        count.style.cssText = PANEL_STYLES.GROUP_COUNT;
        count.textContent = `${models.length}`;

        const expandIcon = document.createElement('span');
        expandIcon.id = `group-expand-${group.id}`;
        expandIcon.style.cssText = 'font-size: 10px; transition: transform 0.2s;';
        expandIcon.textContent = this.expandedGroups.has(group.id) ? '▼' : '▶';

        rightSide.appendChild(count);
        rightSide.appendChild(expandIcon);

        header.appendChild(titleContainer);
        header.appendChild(rightSide);

        // Content
        const content = document.createElement('div');
        content.id = `group-content-${group.id}`;
        content.style.cssText = PANEL_STYLES.GROUP_CONTENT +
            (this.expandedGroups.has(group.id) ? PANEL_STYLES.GROUP_CONTENT_EXPANDED : '');

        // Add subcategories
        group.categories.forEach(category => {
            const categoryModels = models.filter(m => m.category === category);
            content.appendChild(this.createSubcategorySection(category, categoryModels));
        });

        // Click to expand/collapse
        header.onclick = () => this.toggleGroup(group.id);

        section.appendChild(header);
        section.appendChild(content);

        return section;
    }

    /**
     * Create a subcategory section within a group
     */
    private createSubcategorySection(
        category: ModelCategory,
        models: ModelLibraryEntry[]
    ): HTMLElement {
        const section = document.createElement('div');
        section.className = 'library-subcategory';
        section.style.cssText = PANEL_STYLES.SUBCATEGORY;

        const isExpanded = this.expandedSubcategories.has(category);

        // Header
        const header = document.createElement('div');
        header.id = `subcat-header-${category}`;
        header.style.cssText = PANEL_STYLES.SUBCATEGORY_HEADER +
            (isExpanded ? PANEL_STYLES.SUBCATEGORY_HEADER_EXPANDED : '');

        const titleContainer = document.createElement('div');
        titleContainer.style.cssText = PANEL_STYLES.SUBCATEGORY_TITLE;
        titleContainer.innerHTML = `
            <span>${getCategoryIcon(category)}</span>
            <span>${getCategoryLabel(category)}</span>
        `;

        const rightSide = document.createElement('div');
        rightSide.style.cssText = 'display: flex; align-items: center; gap: 6px;';

        const count = document.createElement('span');
        count.style.cssText = PANEL_STYLES.SUBCATEGORY_COUNT;
        count.textContent = `${models.length}`;

        const expandIcon = document.createElement('span');
        expandIcon.id = `subcat-expand-${category}`;
        expandIcon.style.cssText = 'font-size: 9px; color: #888;';
        expandIcon.textContent = isExpanded ? '▼' : '▶';

        rightSide.appendChild(count);
        rightSide.appendChild(expandIcon);

        header.appendChild(titleContainer);
        header.appendChild(rightSide);

        // Hover effect
        header.onmouseover = () => {
            if (!isExpanded) header.style.background = '#f5f5f5';
        };
        header.onmouseout = () => {
            if (!isExpanded) header.style.background = 'white';
        };

        // Content
        const content = document.createElement('div');
        content.id = `subcat-content-${category}`;
        content.style.cssText = PANEL_STYLES.SUBCATEGORY_CONTENT +
            (isExpanded ? PANEL_STYLES.SUBCATEGORY_CONTENT_EXPANDED : '');

        if (models.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = PANEL_STYLES.EMPTY_MESSAGE;
            empty.textContent = 'No models imported';
            content.appendChild(empty);
        } else {
            models.forEach(model => {
                content.appendChild(this.createModelCard(model));
            });
        }

        // Click to expand/collapse
        header.onclick = () => this.toggleSubcategory(category);

        section.appendChild(header);
        section.appendChild(content);

        return section;
    }

    /**
     * Create a model card
     */
    private createModelCard(model: ModelLibraryEntry): HTMLElement {
        const card = document.createElement('div');
        card.className = 'model-card';
        card.dataset.modelId = model.id;

        const isSelected = model.id === this.selectedModelId;
        card.style.cssText = PANEL_STYLES.MODEL_CARD +
            (isSelected ? PANEL_STYLES.MODEL_CARD_SELECTED : '');

        // Icon
        const icon = document.createElement('div');
        icon.style.cssText = PANEL_STYLES.MODEL_ICON;
        icon.textContent = getCategoryIcon(model.category as ModelCategory);

        // Info
        const info = document.createElement('div');
        info.style.cssText = PANEL_STYLES.MODEL_INFO;

        const name = document.createElement('div');
        name.style.cssText = PANEL_STYLES.MODEL_NAME;
        name.textContent = model.name;
        name.title = model.name;

        const meta = document.createElement('div');
        meta.style.cssText = PANEL_STYLES.MODEL_META;

        // Calculate display height
        const activePreset = model.scalePresets.find(p => p.name === model.activePresetName);
        const heightMM = activePreset
            ? Math.round(activePreset.realWorldHeightM * 1000 / 76.2)
            : 0;
        meta.textContent = `${heightMM}mm tall`;

        info.appendChild(name);
        info.appendChild(meta);

        // Actions
        const actions = document.createElement('div');
        actions.className = 'model-actions';
        actions.style.cssText = PANEL_STYLES.MODEL_ACTIONS;

        const favBtn = document.createElement('button');
        favBtn.style.cssText = PANEL_STYLES.ACTION_BTN;
        favBtn.style.opacity = model.isFavorite ? '1' : '0.4';
        favBtn.textContent = '⭐';
        favBtn.title = model.isFavorite ? 'Remove from favorites' : 'Add to favorites';
        favBtn.onclick = (e) => {
            e.stopPropagation();
            this.library.toggleFavorite(model.id);
        };

        const delBtn = document.createElement('button');
        delBtn.style.cssText = PANEL_STYLES.ACTION_BTN;
        delBtn.textContent = '🗑️';
        delBtn.title = 'Remove from library';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`Remove "${model.name}" from library?`)) {
                this.library.removeModel(model.id);
                if (this.selectedModelId === model.id) {
                    this.selectedModelId = null;
                }
            }
        };

        actions.appendChild(favBtn);
        actions.appendChild(delBtn);

        // Assemble card
        card.appendChild(icon);
        card.appendChild(info);
        card.appendChild(actions);

        // Hover effects
        card.onmouseover = () => {
            if (!isSelected) {
                card.style.cssText = PANEL_STYLES.MODEL_CARD + PANEL_STYLES.MODEL_CARD_HOVER;
            }
            actions.style.opacity = '1';
        };

        card.onmouseout = () => {
            if (!isSelected) {
                card.style.cssText = PANEL_STYLES.MODEL_CARD;
            } else {
                card.style.cssText = PANEL_STYLES.MODEL_CARD + PANEL_STYLES.MODEL_CARD_SELECTED;
            }
            actions.style.opacity = '0';
        };

        // Click to select
        card.onclick = () => this.selectModel(model.id);

        return card;
    }

    // ========================================================================
    // EXPAND/COLLAPSE
    // ========================================================================

    /**
     * Toggle a category group
     */
    private toggleGroup(groupId: string): void {
        const isExpanded = this.expandedGroups.has(groupId);

        if (isExpanded) {
            this.expandedGroups.delete(groupId);
        } else {
            this.expandedGroups.add(groupId);
        }

        // Update UI
        const content = document.getElementById(`group-content-${groupId}`);
        const icon = document.getElementById(`group-expand-${groupId}`);

        if (content) {
            content.style.cssText = PANEL_STYLES.GROUP_CONTENT +
                (!isExpanded ? PANEL_STYLES.GROUP_CONTENT_EXPANDED : '');
        }

        if (icon) {
            icon.textContent = !isExpanded ? '▼' : '▶';
        }
    }

    /**
     * Toggle a subcategory
     */
    private toggleSubcategory(category: ModelCategory): void {
        const isExpanded = this.expandedSubcategories.has(category);

        if (isExpanded) {
            this.expandedSubcategories.delete(category);
        } else {
            this.expandedSubcategories.add(category);
        }

        // Update UI
        const header = document.getElementById(`subcat-header-${category}`);
        const content = document.getElementById(`subcat-content-${category}`);
        const icon = document.getElementById(`subcat-expand-${category}`);

        if (header) {
            header.style.cssText = PANEL_STYLES.SUBCATEGORY_HEADER +
                (!isExpanded ? PANEL_STYLES.SUBCATEGORY_HEADER_EXPANDED : '');
        }

        if (content) {
            content.style.cssText = PANEL_STYLES.SUBCATEGORY_CONTENT +
                (!isExpanded ? PANEL_STYLES.SUBCATEGORY_CONTENT_EXPANDED : '');
        }

        if (icon) {
            icon.textContent = !isExpanded ? '▼' : '▶';
        }
    }

    // ========================================================================
    // SELECTION
    // ========================================================================

    /**
     * Select a model for placement
     * @param modelId - Library model ID
     */
    selectModel(modelId: string): void {
        // Toggle if already selected
        if (this.selectedModelId === modelId) {
            this.clearSelection();
            return;
        }

        this.selectedModelId = modelId;

        // Notify callback
        if (this.onModelSelect) {
            this.onModelSelect(modelId);
        }

        // Re-render to update selection styling
        this.renderContent();

        const model = this.library.getModel(modelId);
        console.log(`${LOG_PREFIX} Selected: ${model?.name || modelId}`);
    }

    /**
     * Clear current selection
     */
    clearSelection(): void {
        this.selectedModelId = null;
        this.renderContent();
        console.log(`${LOG_PREFIX} Selection cleared`);
    }

    /**
     * Get currently selected model ID
     */
    getSelectedModelId(): string | null {
        return this.selectedModelId;
    }

    // ========================================================================
    // FOOTER STATS
    // ========================================================================

    /**
     * Update footer statistics
     */
    private updateFooterStats(): void {
        const footer = document.getElementById('library-footer');
        if (!footer) return;

        const stats = this.library.getStats();
        const rollingStockCount = this.library.getAll()
            .filter(m => isRollingStock(m.category as ModelCategory)).length;

        footer.innerHTML = `
            <div style="display: flex; justify-content: space-between;">
                <span>📦 ${stats.totalModels} models</span>
                <span>🚂 ${rollingStockCount} rolling stock</span>
                <span>⭐ ${stats.favoritesCount}</span>
            </div>
        `;
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /**
     * Refresh the model list
     */
    refresh(): void {
        this.renderContent();
    }

    /**
     * Set panel visibility
     * @param visible - Whether to show the panel
     */
    setVisible(visible: boolean): void {
        if (this.panel) {
            this.panel.style.display = visible ? 'flex' : 'none';
        }
    }

    /**
     * Check if panel is visible
     */
    isVisible(): boolean {
        return this.panel?.style.display !== 'none';
    }

    /**
     * Expand a specific category group
     */
    expandGroup(groupId: string): void {
        if (!this.expandedGroups.has(groupId)) {
            this.toggleGroup(groupId);
        }
    }

    /**
     * Expand a specific subcategory
     */
    expandSubcategory(category: ModelCategory): void {
        // First expand the parent group
        const group = CATEGORY_GROUPS.find(g => g.categories.includes(category));
        if (group) {
            this.expandGroup(group.id);
        }

        // Then expand the subcategory
        if (!this.expandedSubcategories.has(category)) {
            this.toggleSubcategory(category);
        }
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Dispose the panel
     */
    dispose(): void {
        if (this.unsubscribeLibrary) {
            this.unsubscribeLibrary();
            this.unsubscribeLibrary = null;
        }

        if (this.panel) {
            this.panel.remove();
            this.panel = null;
        }

        console.log(`${LOG_PREFIX} Disposed`);
    }
}