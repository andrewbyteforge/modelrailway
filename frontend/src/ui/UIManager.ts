/**
 * UIManager.ts - Unified Slide-Out Sidebar UI
 * 
 * Path: frontend/src/ui/UIManager.ts
 * 
 * A professional slide-out sidebar containing:
 * - Import 3D Model button
 * - Track piece catalog (accordion sections)
 * - Settings toggles (including Model Scale controls)
 * - Keyboard shortcuts reference
 * 
 * Styles and types are imported from UIManagerStyles.ts
 * 
 * @module UIManager
 * @author Model Railway Workbench
 * @version 2.2.0 - Refactored with separate styles module
 */

import { TrackCatalog, type TrackCatalogEntry } from '../systems/track/TrackCatalog';
import {
    type TrackSelectionCallback,
    type ToggleCallback,
    type ImportCallback,
    type AccordionSection,
    THEME,
    injectUIManagerStyles,
    KEYBOARD_SHORTCUTS,
    MODE_ICONS
} from './UIManagerStyles';

// Re-export types for external use
export type { TrackSelectionCallback, ToggleCallback, ImportCallback };

// ============================================================================
// UI MANAGER CLASS
// ============================================================================

/**
 * UIManager - Unified slide-out sidebar interface
 * 
 * @example
 * ```typescript
 * const uiManager = new UIManager(document.body);
 * uiManager.initialize((catalogId) => console.log('Selected:', catalogId));
 * uiManager.setToggleCallback('autoSnap', (enabled) => trackSystem.setAutoSnap(enabled));
 * ```
 */
export class UIManager {
    // ========================================================================
    // PRIVATE PROPERTIES
    // ========================================================================

    /** Container element for the UI */
    private container: HTMLElement;

    // Main UI elements
    private sidebar: HTMLElement | null = null;
    private toggleButton: HTMLElement | null = null;
    private overlay: HTMLElement | null = null;

    // State
    private isOpen: boolean = true;
    private selectedCatalogId: string | null = null;

    // Callbacks
    private onTrackSelected: TrackSelectionCallback | null = null;
    private onImportClicked: ImportCallback | null = null;

    // Toggle buttons
    private toggleButtons: Map<string, HTMLButtonElement> = new Map();
    private toggleCallbacks: Map<string, ToggleCallback> = new Map();
    private toggleStates: Map<string, boolean> = new Map();

    // Accordion sections
    private accordionSections: Map<string, AccordionSection> = new Map();

    // Track buttons
    private trackButtons: Map<string, HTMLButtonElement> = new Map();

    // ========================================================================
    // SCALE CONTROLS PROPERTIES
    // ========================================================================

    /** Container for scale controls in settings */
    private scaleControlsContainer: HTMLElement | null = null;

    // ========================================================================
    // CONSTRUCTOR & INITIALIZATION
    // ========================================================================

    /**
     * Create a new UIManager
     * @param container - Container element for the UI
     * @throws Error if container is not provided
     */
    constructor(container: HTMLElement) {
        if (!container) {
            throw new Error('[UIManager] Container element is required');
        }
        this.container = container;
        console.log('[UIManager] Created');
    }

    /**
     * Initialize the UI
     * @param onTrackSelected - Callback when a track piece is selected
     */
    initialize(onTrackSelected: TrackSelectionCallback): void {
        try {
            this.onTrackSelected = onTrackSelected;
            injectUIManagerStyles();
            this.createOverlay();
            this.createSidebar();
            this.createToggleButton();
            console.log('[UIManager] ✓ Initialized');
        } catch (error) {
            console.error('[UIManager] Initialization error:', error);
        }
    }

    /**
     * Set import button callback
     * @param callback - Function to call when import button is clicked
     */
    setImportCallback(callback: ImportCallback): void {
        this.onImportClicked = callback;
    }

    // ========================================================================
    // SCALE CONTROLS PUBLIC API
    // ========================================================================

    /**
     * Add scale controls element to the settings section
     * Call this from App.ts after both UIManager and ModelImportButton are initialized
     * 
     * @param scaleElement - Element from ModelImportButton.getScaleControlsElement()
     * 
     * @example
     * ```typescript
     * const scaleElement = modelImportButton.getScaleControlsElement();
     * if (scaleElement) {
     *     uiManager.addScaleControls(scaleElement);
     * }
     * ```
     */
    addScaleControls(scaleElement: HTMLElement): void {
        if (!this.scaleControlsContainer) {
            console.warn('[UIManager] Scale controls container not ready');
            return;
        }

        // Clear any existing content
        this.scaleControlsContainer.innerHTML = '';

        // Add the scale controls
        this.scaleControlsContainer.appendChild(scaleElement);

        console.log('[UIManager] ✓ Scale controls added to settings');
    }

    /**
     * Add transform controls element to the Settings section
     * @param element - The transform controls HTML element
     */
    addTransformControls(element: HTMLElement): void {
        const settingsSection = this.accordionSections.get('settings');
        if (settingsSection && settingsSection.content) {
            // Add a divider
            const divider = document.createElement('div');
            divider.style.cssText = `
                height: 1px;
                background: rgba(255,255,255,0.1);
                margin: 12px 0;
            `;
            settingsSection.content.appendChild(divider);

            // Add the transform controls
            settingsSection.content.appendChild(element);

            // Update max-height to accommodate new content
            settingsSection.content.style.maxHeight = '1500px';

            console.log('[UIManager] ✓ Transform controls added to settings');
        } else {
            console.warn('[UIManager] Settings section not found, cannot add transform controls');
        }
    }

    // ========================================================================
    // UI CREATION - OVERLAY & TOGGLE
    // ========================================================================

    /**
     * Create the overlay element for mobile/tablet sidebar backdrop
     */
    private createOverlay(): void {
        this.overlay = document.createElement('div');
        this.overlay.className = 'mrw-overlay';
        this.overlay.onclick = () => this.closeSidebar();
        this.container.appendChild(this.overlay);
    }

    /**
     * Create the toggle button with "Models" text label
     */
    private createToggleButton(): void {
        this.toggleButton = document.createElement('button');
        this.toggleButton.className = 'mrw-toggle-btn';
        this.toggleButton.title = 'Toggle Models Sidebar';

        // Simple text label only
        this.toggleButton.innerHTML = `
            <span class="toggle-label">Models</span>
        `;

        this.toggleButton.onclick = () => this.toggleSidebar();
        this.container.appendChild(this.toggleButton);
    }

    // ========================================================================
    // UI CREATION - SIDEBAR
    // ========================================================================

    /**
     * Create the main sidebar structure
     */
    private createSidebar(): void {
        this.sidebar = document.createElement('div');
        this.sidebar.className = 'mrw-sidebar';

        // Build sidebar content
        this.sidebar.innerHTML = '';

        // Header
        this.sidebar.appendChild(this.createHeader());

        // Scrollable content
        const content = document.createElement('div');
        content.className = 'mrw-content';

        // Import section
        content.appendChild(this.createImportSection());

        // Track sections
        this.createTrackSections(content);

        // Settings section
        content.appendChild(this.createSettingsSection());

        // Shortcuts section
        content.appendChild(this.createShortcutsSection());

        this.sidebar.appendChild(content);

        // Footer
        this.sidebar.appendChild(this.createFooter());

        this.container.appendChild(this.sidebar);
    }

    /**
     * Create the header element
     * @returns Header HTML element
     */
    private createHeader(): HTMLElement {
        const header = document.createElement('div');
        header.className = 'mrw-header';
        header.innerHTML = `
            <h1 class="mrw-header-title">
                <span class="icon">🚂</span>
                <span>Model Railway</span>
            </h1>
            <p class="mrw-header-subtitle">Workbench Control Panel</p>
        `;
        return header;
    }

    /**
     * Create the import button section
     * @returns Import section HTML element
     */
    private createImportSection(): HTMLElement {
        const section = document.createElement('div');
        section.className = 'mrw-import-section';

        const button = document.createElement('button');
        button.className = 'mrw-import-btn';
        button.innerHTML = `
            <span class="icon">📦</span>
            <span>Import 3D Model</span>
        `;

        button.onclick = () => {
            if (this.onImportClicked) {
                this.onImportClicked();
            }
        };

        section.appendChild(button);
        return section;
    }

    // ========================================================================
    // UI CREATION - TRACK SECTIONS
    // ========================================================================

    /**
     * Create all track category sections
     * @param container - Container to append sections to
     */
    private createTrackSections(container: HTMLElement): void {
        // Group tracks by category
        const categories = [
            { id: 'straights', name: 'Straight Tracks', icon: '━', filter: (e: TrackCatalogEntry) => e.type === 'straight' },
            { id: 'curves', name: 'Curves', icon: '↪', filter: (e: TrackCatalogEntry) => e.type === 'curve' },
            { id: 'switches', name: 'Points & Switches', icon: '⑂', filter: (e: TrackCatalogEntry) => e.type === 'switch' || e.type === 'curved_switch' },
            { id: 'crossings', name: 'Crossings', icon: '╳', filter: (e: TrackCatalogEntry) => e.type === 'crossing' }
        ];

        const allPieces = TrackCatalog.getAll();

        categories.forEach((cat, index) => {
            const pieces = allPieces.filter(cat.filter);
            if (pieces.length > 0) {
                container.appendChild(
                    this.createTrackSection(cat.id, cat.name, cat.icon, pieces, index === 0)
                );
            }
        });
    }

    /**
     * Create a single track category section
     * @param id - Section ID
     * @param title - Section title
     * @param icon - Section icon
     * @param pieces - Track pieces in this category
     * @param startExpanded - Whether section starts expanded
     * @returns Section HTML element
     */
    private createTrackSection(
        id: string,
        title: string,
        icon: string,
        pieces: TrackCatalogEntry[],
        startExpanded: boolean = false
    ): HTMLElement {
        const section = document.createElement('div');
        section.className = 'mrw-section';

        // Header
        const header = document.createElement('div');
        header.className = 'mrw-section-header';
        header.innerHTML = `
            <div class="mrw-section-title">
                <span class="icon">${icon}</span>
                <span>${title}</span>
                <span style="opacity: 0.5; font-size: 11px;">(${pieces.length})</span>
            </div>
            <span class="mrw-section-arrow ${startExpanded ? '' : 'collapsed'}">▼</span>
        `;

        // Content
        const content = document.createElement('div');
        content.className = `mrw-section-content ${startExpanded ? 'expanded' : 'collapsed'}`;
        if (startExpanded) {
            content.style.maxHeight = '2000px';
        }

        // Track buttons
        pieces.forEach(piece => {
            content.appendChild(this.createTrackButton(piece));
        });

        // Store reference
        this.accordionSections.set(id, { header, content, isExpanded: startExpanded });

        // Click handler
        header.onclick = () => this.toggleAccordion(id);

        section.appendChild(header);
        section.appendChild(content);

        return section;
    }

    /**
     * Create a track piece button
     * @param piece - Track catalog entry
     * @returns Button HTML element
     */
    private createTrackButton(piece: TrackCatalogEntry): HTMLButtonElement {
        const button = document.createElement('button');
        button.className = 'mrw-track-btn';
        button.dataset.catalogId = piece.id;

        const icon = this.getTrackIcon(piece.type);
        button.innerHTML = `
            <div class="track-icon">${icon}</div>
            <div class="track-info">
                <div class="track-name">${piece.name}</div>
                <div class="track-id">${piece.id}</div>
            </div>
        `;

        this.trackButtons.set(piece.id, button);

        button.onclick = () => this.selectTrack(piece.id);

        return button;
    }

    /**
     * Get icon for track type
     * @param type - Track type string
     * @returns Icon character
     */
    private getTrackIcon(type: string): string {
        const icons: Record<string, string> = {
            straight: '━',
            curve: '↪',
            switch: '⑂',
            curved_switch: '↯',
            crossing: '╳'
        };
        return icons[type] || '•';
    }

    // ========================================================================
    // UI CREATION - SETTINGS SECTION
    // ========================================================================

    /**
     * Create the settings section with toggles
     * @returns Settings section HTML element
     */
    private createSettingsSection(): HTMLElement {
        const section = document.createElement('div');
        section.className = 'mrw-section';

        // Header
        const header = document.createElement('div');
        header.className = 'mrw-section-header';
        header.innerHTML = `
            <div class="mrw-section-title">
                <span class="icon">⚙️</span>
                <span>Settings</span>
            </div>
            <span class="mrw-section-arrow">▼</span>
        `;

        // Content
        const content = document.createElement('div');
        content.className = 'mrw-section-content expanded';
        content.style.maxHeight = '600px';

        // Toggles
        content.appendChild(this.createToggle('connectionIndicators', '🔴', 'Connection Indicators', true));
        content.appendChild(this.createToggle('autoSnap', '🧲', 'Auto-Snap', true));

        // ================================================================
        // SCALE CONTROLS CONTAINER
        // This is where scale controls get injected via addScaleControls()
        // ================================================================
        this.scaleControlsContainer = document.createElement('div');
        this.scaleControlsContainer.id = 'scale-controls-container';
        content.appendChild(this.scaleControlsContainer);

        // Store reference
        this.accordionSections.set('settings', { header, content, isExpanded: true });
        header.onclick = () => this.toggleAccordion('settings');

        section.appendChild(header);
        section.appendChild(content);

        return section;
    }

    /**
     * Create a toggle switch row
     * @param id - Toggle ID
     * @param icon - Toggle icon
     * @param label - Toggle label text
     * @param defaultState - Default toggle state
     * @returns Toggle row HTML element
     */
    private createToggle(id: string, icon: string, label: string, defaultState: boolean): HTMLElement {
        const row = document.createElement('div');
        row.className = 'mrw-toggle-row';

        const labelEl = document.createElement('div');
        labelEl.className = 'mrw-toggle-label';
        labelEl.innerHTML = `<span class="icon">${icon}</span><span>${label}</span>`;

        const toggle = document.createElement('button');
        toggle.className = `mrw-toggle-switch ${defaultState ? 'active' : ''}`;
        toggle.innerHTML = '<span class="knob"></span>';

        this.toggleButtons.set(id, toggle);
        this.toggleStates.set(id, defaultState);

        toggle.onclick = () => {
            const newState = !this.toggleStates.get(id);
            this.toggleStates.set(id, newState);
            toggle.classList.toggle('active', newState);

            const callback = this.toggleCallbacks.get(id);
            if (callback) callback(newState);
        };

        row.appendChild(labelEl);
        row.appendChild(toggle);

        return row;
    }

    // ========================================================================
    // UI CREATION - SHORTCUTS SECTION
    // ========================================================================

    /**
     * Create the keyboard shortcuts section
     * @returns Shortcuts section HTML element
     */
    private createShortcutsSection(): HTMLElement {
        const section = document.createElement('div');
        section.className = 'mrw-section';

        // Header
        const header = document.createElement('div');
        header.className = 'mrw-section-header';
        header.innerHTML = `
            <div class="mrw-section-title">
                <span class="icon">⌨️</span>
                <span>Keyboard Shortcuts</span>
            </div>
            <span class="mrw-section-arrow collapsed">▼</span>
        `;

        // Content
        const content = document.createElement('div');
        content.className = 'mrw-section-content collapsed';

        // Add each shortcut row
        KEYBOARD_SHORTCUTS.forEach(shortcut => {
            const row = document.createElement('div');
            row.className = 'mrw-shortcut-row';

            const keyHtml = shortcut.keys.map(k => `<kbd>${k}</kbd>`).join(' + ');
            row.innerHTML = `
                <div class="mrw-shortcut-key">${keyHtml}</div>
                <div class="mrw-shortcut-desc">${shortcut.desc}</div>
            `;

            content.appendChild(row);
        });

        // Store reference
        this.accordionSections.set('shortcuts', { header, content, isExpanded: false });
        header.onclick = () => this.toggleAccordion('shortcuts');

        section.appendChild(header);
        section.appendChild(content);

        return section;
    }

    /**
     * Create the footer element
     * @returns Footer HTML element
     */
    private createFooter(): HTMLElement {
        const footer = document.createElement('div');
        footer.className = 'mrw-footer';
        footer.id = 'mrw-footer';
        footer.innerHTML = `
            <div class="mrw-mode-indicator">
                <span class="icon">🖱️</span>
                <div>
                    <div class="mode-text">Mode: Select</div>
                    <div class="mode-hint">Click track piece to select</div>
                </div>
            </div>
        `;
        return footer;
    }

    // ========================================================================
    // SIDEBAR CONTROLS
    // ========================================================================

    /**
     * Toggle sidebar open/closed state
     */
    toggleSidebar(): void {
        if (this.isOpen) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    }

    /**
     * Open the sidebar
     */
    openSidebar(): void {
        this.isOpen = true;
        this.sidebar?.classList.remove('collapsed');
        this.toggleButton?.classList.remove('sidebar-collapsed');
        this.overlay?.classList.remove('visible');
    }

    /**
     * Close the sidebar
     */
    closeSidebar(): void {
        this.isOpen = false;
        this.sidebar?.classList.add('collapsed');
        this.toggleButton?.classList.add('sidebar-collapsed');
        this.overlay?.classList.remove('visible');
    }

    // ========================================================================
    // ACCORDION CONTROLS
    // ========================================================================

    /**
     * Toggle an accordion section
     * @param id - Section ID to toggle
     */
    private toggleAccordion(id: string): void {
        const section = this.accordionSections.get(id);
        if (!section) return;

        const { header, content, isExpanded } = section;
        const arrow = header.querySelector('.mrw-section-arrow');

        if (isExpanded) {
            content.classList.remove('expanded');
            content.classList.add('collapsed');
            content.style.maxHeight = '0';
            arrow?.classList.add('collapsed');
        } else {
            content.classList.remove('collapsed');
            content.classList.add('expanded');
            content.style.maxHeight = content.scrollHeight + 'px';
            arrow?.classList.remove('collapsed');
        }

        section.isExpanded = !isExpanded;
    }

    /**
     * Expand all accordion sections
     */
    expandAllSections(): void {
        this.accordionSections.forEach((_, id) => {
            const section = this.accordionSections.get(id);
            if (section && !section.isExpanded) {
                this.toggleAccordion(id);
            }
        });
    }

    /**
     * Collapse all accordion sections
     */
    collapseAllSections(): void {
        this.accordionSections.forEach((_, id) => {
            const section = this.accordionSections.get(id);
            if (section && section.isExpanded) {
                this.toggleAccordion(id);
            }
        });
    }

    // ========================================================================
    // TRACK SELECTION
    // ========================================================================

    /**
     * Select a track piece
     * @param catalogId - Catalog ID of the track piece to select
     */
    private selectTrack(catalogId: string): void {
        // Deselect previous
        if (this.selectedCatalogId) {
            const prevBtn = this.trackButtons.get(this.selectedCatalogId);
            prevBtn?.classList.remove('selected');
        }

        // Select new
        this.selectedCatalogId = catalogId;
        const btn = this.trackButtons.get(catalogId);
        btn?.classList.add('selected');

        // Notify callback
        if (this.onTrackSelected) {
            this.onTrackSelected(catalogId);
        }
    }

    /**
     * Deselect the current track piece
     */
    deselectTrack(): void {
        if (this.selectedCatalogId) {
            const btn = this.trackButtons.get(this.selectedCatalogId);
            btn?.classList.remove('selected');
            this.selectedCatalogId = null;
        }
    }

    // ========================================================================
    // TOGGLE CALLBACKS
    // ========================================================================

    /**
     * Register a callback for toggle state changes
     * @param id - Toggle identifier ('connectionIndicators', 'autoSnap', etc.)
     * @param callback - Function called when toggle state changes
     */
    setToggleCallback(id: string, callback: ToggleCallback): void {
        this.toggleCallbacks.set(id, callback);
    }

    /**
     * Alias for setToggleCallback (backward compatibility)
     * @param id - Toggle identifier
     * @param callback - Toggle callback function
     */
    registerToggleCallback(id: string, callback: ToggleCallback): void {
        this.setToggleCallback(id, callback);
    }

    /**
     * Get the current state of a toggle
     * @param id - Toggle identifier
     * @returns Current toggle state
     */
    getToggleState(id: string): boolean {
        return this.toggleStates.get(id) ?? false;
    }

    /**
     * Set the state of a toggle
     * @param id - Toggle identifier
     * @param state - New toggle state
     */
    setToggleState(id: string, state: boolean): void {
        const toggle = this.toggleButtons.get(id);
        if (toggle) {
            this.toggleStates.set(id, state);
            toggle.classList.toggle('active', state);
        }
    }

    // ========================================================================
    // MODE INDICATOR
    // ========================================================================

    /**
     * Update the mode indicator in the footer
     * @param mode - Current mode name
     * @param hint - Help text for the current mode
     */
    updateModeIndicator(mode: string, hint: string): void {
        const footer = document.getElementById('mrw-footer');
        if (!footer) return;

        const icon = MODE_ICONS[mode.toLowerCase()] || '▶️';

        footer.innerHTML = `
            <div class="mrw-mode-indicator">
                <span class="icon">${icon}</span>
                <div>
                    <div class="mode-text">Mode: ${mode}</div>
                    <div class="mode-hint">${hint}</div>
                </div>
            </div>
        `;
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Dispose of the UIManager and clean up resources
     */
    dispose(): void {
        this.sidebar?.remove();
        this.toggleButton?.remove();
        this.overlay?.remove();

        this.sidebar = null;
        this.toggleButton = null;
        this.overlay = null;
        this.scaleControlsContainer = null;

        this.accordionSections.clear();
        this.trackButtons.clear();
        this.toggleButtons.clear();
        this.toggleCallbacks.clear();
        this.toggleStates.clear();

        console.log('[UIManager] Disposed');
    }
}