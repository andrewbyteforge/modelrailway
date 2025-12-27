/**
 * ModelLibraryPanel.ts - UI panel for the model library
 * 
 * Path: frontend/src/ui/ModelLibraryPanel.ts
 * 
 * Provides:
 * - List of imported models organized by category
 * - Model selection for placement
 * - Import button to add new models
 * - Search and filter functionality
 * - Model management (delete, favorite, edit scale)
 * 
 * @module ModelLibraryPanel
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { ModelLibrary, type ModelLibraryEntry, type ModelCategory } from '../systems/models/ModelLibrary';
import { ModelScaleHelper } from '../systems/models/ModelScaleHelper';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Panel width */
const PANEL_WIDTH = 260;

/** Category icons */
const CATEGORY_ICONS: Record<ModelCategory, string> = {
    buildings: '🏠',
    rolling_stock: '🚃',
    scenery: '🌳',
    infrastructure: '🌉',
    vehicles: '🚗',
    figures: '👤',
    accessories: '🪑',
    custom: '📦'
};

/** Category display names */
const CATEGORY_NAMES: Record<ModelCategory, string> = {
    buildings: 'Buildings',
    rolling_stock: 'Rolling Stock',
    scenery: 'Scenery',
    infrastructure: 'Infrastructure',
    vehicles: 'Vehicles',
    figures: 'Figures',
    accessories: 'Accessories',
    custom: 'Custom'
};

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
 * ModelLibraryPanel - Sidebar panel for model library
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

    /** Current filter */
    private currentFilter: {
        category: ModelCategory | 'all';
        searchText: string;
        favoritesOnly: boolean;
    } = {
            category: 'all',
            searchText: '',
            favoritesOnly: false
        };

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
            throw new Error('[ModelLibraryPanel] Container element is required');
        }
        this.container = container;
        this.library = ModelLibrary.getInstance();
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
            this.renderModelList();
        });

        console.log('[ModelLibraryPanel] Initialized');
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
        this.panel.style.cssText = `
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
        `;

        // Build panel content
        this.panel.innerHTML = this.buildPanelHTML();

        // Add to DOM
        this.container.appendChild(this.panel);

        // Attach event handlers
        this.attachEventHandlers();

        // Initial render
        this.renderModelList();
    }

    /**
     * Build panel HTML structure
     */
    private buildPanelHTML(): string {
        return `
            <!-- Header -->
            <div style="
                padding: 12px;
                background: #333;
                color: white;
                border-radius: 6px 6px 0 0;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 14px;">📦 Model Library</h3>
                    <button id="importModelBtn" style="
                        padding: 6px 12px;
                        border: none;
                        border-radius: 4px;
                        background: #4CAF50;
                        color: white;
                        font-size: 12px;
                        font-weight: bold;
                        cursor: pointer;
                        transition: background 0.2s;
                    ">
                        + Import
                    </button>
                </div>
            </div>
            
            <!-- Search and Filter -->
            <div style="padding: 10px; border-bottom: 1px solid #ddd;">
                <!-- Search -->
                <input type="text" 
                       id="modelSearch" 
                       placeholder="🔍 Search models..."
                       style="
                           width: 100%;
                           padding: 8px;
                           border: 1px solid #ddd;
                           border-radius: 4px;
                           font-size: 13px;
                           box-sizing: border-box;
                           margin-bottom: 8px;
                       ">
                
                <!-- Category Filter -->
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    <select id="categoryFilter" style="
                        flex: 1;
                        padding: 6px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        font-size: 12px;
                        background: white;
                    ">
                        <option value="all">All Categories</option>
                        ${Object.entries(CATEGORY_NAMES).map(([key, name]) =>
            `<option value="${key}">${CATEGORY_ICONS[key as ModelCategory]} ${name}</option>`
        ).join('')}
                    </select>
                    <button id="favoritesFilterBtn" title="Show favorites only" style="
                        padding: 6px 10px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        background: white;
                        cursor: pointer;
                        font-size: 14px;
                    ">⭐</button>
                </div>
            </div>
            
            <!-- Model List -->
            <div id="modelListContainer" style="
                flex: 1;
                overflow-y: auto;
                padding: 8px;
            ">
                <!-- Models will be rendered here -->
            </div>
            
            <!-- Stats Footer -->
            <div id="libraryStats" style="
                padding: 8px 12px;
                background: #f5f5f5;
                border-top: 1px solid #ddd;
                font-size: 11px;
                color: #666;
            ">
                <!-- Stats will be rendered here -->
            </div>
            
            <!-- Help -->
            <div style="
                padding: 8px 12px;
                background: #e8f5e9;
                border-top: 1px solid #c8e6c9;
                font-size: 11px;
                color: #2E7D32;
            ">
                💡 Click model to select, then click baseboard to place
            </div>
        `;
    }

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    /**
     * Attach event handlers
     */
    private attachEventHandlers(): void {
        if (!this.panel) return;

        // Import button
        const importBtn = this.panel.querySelector('#importModelBtn') as HTMLButtonElement;
        importBtn?.addEventListener('click', () => {
            if (this.onImportRequest) {
                this.onImportRequest();
            }
        });
        importBtn?.addEventListener('mouseover', () => {
            importBtn.style.background = '#45a049';
        });
        importBtn?.addEventListener('mouseout', () => {
            importBtn.style.background = '#4CAF50';
        });

        // Search input
        const searchInput = this.panel.querySelector('#modelSearch') as HTMLInputElement;
        searchInput?.addEventListener('input', () => {
            this.currentFilter.searchText = searchInput.value;
            this.renderModelList();
        });

        // Category filter
        const categorySelect = this.panel.querySelector('#categoryFilter') as HTMLSelectElement;
        categorySelect?.addEventListener('change', () => {
            this.currentFilter.category = categorySelect.value as ModelCategory | 'all';
            this.renderModelList();
        });

        // Favorites filter
        const favoritesBtn = this.panel.querySelector('#favoritesFilterBtn') as HTMLButtonElement;
        favoritesBtn?.addEventListener('click', () => {
            this.currentFilter.favoritesOnly = !this.currentFilter.favoritesOnly;
            favoritesBtn.style.background = this.currentFilter.favoritesOnly ? '#FFD700' : 'white';
            favoritesBtn.style.borderColor = this.currentFilter.favoritesOnly ? '#FFD700' : '#ddd';
            this.renderModelList();
        });
    }

    // ========================================================================
    // MODEL LIST RENDERING
    // ========================================================================

    /**
     * Render the model list based on current filter
     */
    private renderModelList(): void {
        const container = this.panel?.querySelector('#modelListContainer') as HTMLElement;
        if (!container) return;

        // Query models with current filter
        const models = this.library.query({
            category: this.currentFilter.category === 'all' ? undefined : this.currentFilter.category,
            searchText: this.currentFilter.searchText || undefined,
            favoritesOnly: this.currentFilter.favoritesOnly,
            sortBy: 'name',
            sortOrder: 'asc'
        });

        if (models.length === 0) {
            container.innerHTML = `
                <div style="
                    text-align: center;
                    padding: 30px 20px;
                    color: #888;
                ">
                    <div style="font-size: 40px; margin-bottom: 10px;">📭</div>
                    <p style="margin: 0;">
                        ${this.library.getAllModels().length === 0
                    ? 'No models imported yet.<br>Click "Import" to add models!'
                    : 'No models match your filter.'
                }
                    </p>
                </div>
            `;
        } else {
            // Group by category if showing all
            if (this.currentFilter.category === 'all') {
                container.innerHTML = this.renderGroupedModels(models);
            } else {
                container.innerHTML = models.map(m => this.renderModelCard(m)).join('');
            }
        }

        // Attach card event handlers
        this.attachCardHandlers();

        // Update stats
        this.updateStats();
    }

    /**
     * Render models grouped by category
     * @param models - Models to render
     */
    private renderGroupedModels(models: ModelLibraryEntry[]): string {
        // Group by category
        const groups = new Map<ModelCategory, ModelLibraryEntry[]>();
        for (const model of models) {
            const existing = groups.get(model.category) || [];
            existing.push(model);
            groups.set(model.category, existing);
        }

        // Render each group
        let html = '';
        for (const [category, categoryModels] of groups) {
            html += `
                <div style="margin-bottom: 12px;">
                    <div style="
                        font-size: 12px;
                        font-weight: bold;
                        color: #666;
                        margin-bottom: 6px;
                        padding-bottom: 4px;
                        border-bottom: 1px solid #eee;
                    ">
                        ${CATEGORY_ICONS[category]} ${CATEGORY_NAMES[category]} (${categoryModels.length})
                    </div>
                    ${categoryModels.map(m => this.renderModelCard(m)).join('')}
                </div>
            `;
        }

        return html;
    }

    /**
     * Render a single model card
     * @param model - Model entry
     */
    private renderModelCard(model: ModelLibraryEntry): string {
        const isSelected = model.id === this.selectedModelId;
        const activePreset = this.library.getActivePreset(model.id);
        const scaledHeight = activePreset
            ? (model.originalDimensions.height * activePreset.scaleFactor * 1000).toFixed(1)
            : 'N/A';

        return `
            <div class="model-card" 
                 data-model-id="${model.id}"
                 style="
                     padding: 10px;
                     margin-bottom: 6px;
                     background: ${isSelected ? '#e3f2fd' : 'white'};
                     border: 2px solid ${isSelected ? '#2196F3' : '#ddd'};
                     border-radius: 6px;
                     cursor: pointer;
                     transition: all 0.2s;
                 ">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1; min-width: 0;">
                        <div style="
                            font-size: 13px;
                            font-weight: bold;
                            color: #333;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                        ">
                            ${model.name}
                        </div>
                        <div style="font-size: 11px; color: #888; margin-top: 2px;">
                            ${CATEGORY_ICONS[model.category]} ${scaledHeight}mm tall
                        </div>
                        ${model.tags.length > 0 ? `
                            <div style="margin-top: 4px;">
                                ${model.tags.slice(0, 3).map(tag => `
                                    <span style="
                                        display: inline-block;
                                        padding: 2px 6px;
                                        background: #f0f0f0;
                                        border-radius: 3px;
                                        font-size: 10px;
                                        color: #666;
                                        margin-right: 3px;
                                    ">${tag}</span>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <button class="favorite-btn" 
                                data-model-id="${model.id}"
                                title="${model.isFavorite ? 'Remove from favorites' : 'Add to favorites'}"
                                style="
                                    padding: 4px 6px;
                                    border: none;
                                    background: transparent;
                                    cursor: pointer;
                                    font-size: 14px;
                                    opacity: ${model.isFavorite ? '1' : '0.3'};
                                ">⭐</button>
                        <button class="delete-btn"
                                data-model-id="${model.id}"
                                title="Remove from library"
                                style="
                                    padding: 4px 6px;
                                    border: none;
                                    background: transparent;
                                    cursor: pointer;
                                    font-size: 14px;
                                    opacity: 0.3;
                                ">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Attach event handlers to model cards
     */
    private attachCardHandlers(): void {
        if (!this.panel) return;

        // Card click - select model
        const cards = this.panel.querySelectorAll('.model-card');
        cards.forEach(card => {
            const cardEl = card as HTMLElement;
            const modelId = cardEl.dataset.modelId;

            cardEl.addEventListener('click', (e) => {
                // Ignore if clicking on buttons
                if ((e.target as HTMLElement).closest('button')) return;

                if (modelId) {
                    this.selectModel(modelId);
                }
            });

            // Hover effect
            cardEl.addEventListener('mouseenter', () => {
                if (modelId !== this.selectedModelId) {
                    cardEl.style.borderColor = '#999';
                    cardEl.style.background = '#f9f9f9';
                }
            });
            cardEl.addEventListener('mouseleave', () => {
                if (modelId !== this.selectedModelId) {
                    cardEl.style.borderColor = '#ddd';
                    cardEl.style.background = 'white';
                }
            });
        });

        // Favorite buttons
        const favoriteBtns = this.panel.querySelectorAll('.favorite-btn');
        favoriteBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const modelId = (btn as HTMLElement).dataset.modelId;
                if (modelId) {
                    this.library.toggleFavorite(modelId);
                }
            });
        });

        // Delete buttons
        const deleteBtns = this.panel.querySelectorAll('.delete-btn');
        deleteBtns.forEach(btn => {
            const btnEl = btn as HTMLElement;

            btnEl.addEventListener('mouseenter', () => {
                btnEl.style.opacity = '1';
            });
            btnEl.addEventListener('mouseleave', () => {
                btnEl.style.opacity = '0.3';
            });

            btnEl.addEventListener('click', (e) => {
                e.stopPropagation();
                const modelId = btnEl.dataset.modelId;
                if (modelId) {
                    const model = this.library.getModel(modelId);
                    if (model && confirm(`Remove "${model.name}" from library?`)) {
                        this.library.removeModel(modelId);
                        if (this.selectedModelId === modelId) {
                            this.clearSelection();
                        }
                    }
                }
            });
        });
    }

    /**
     * Update stats footer
     */
    private updateStats(): void {
        const statsEl = this.panel?.querySelector('#libraryStats') as HTMLElement;
        if (!statsEl) return;

        const stats = this.library.getStats();

        statsEl.innerHTML = `
            <div style="display: flex; justify-content: space-between;">
                <span>📦 ${stats.totalModels} models</span>
                <span>⭐ ${stats.favoritesCount} favorites</span>
                <span>💾 ${(stats.totalSizeBytes / 1024 / 1024).toFixed(1)} MB</span>
            </div>
        `;
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
        this.renderModelList();

        const model = this.library.getModel(modelId);
        console.log(`[ModelLibraryPanel] Selected: ${model?.name || modelId}`);
    }

    /**
     * Clear current selection
     */
    clearSelection(): void {
        this.selectedModelId = null;
        this.renderModelList();
        console.log('[ModelLibraryPanel] Selection cleared');
    }

    /**
     * Get currently selected model ID
     */
    getSelectedModelId(): string | null {
        return this.selectedModelId;
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /**
     * Refresh the model list
     */
    refresh(): void {
        this.renderModelList();
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

        console.log('[ModelLibraryPanel] Disposed');
    }
}