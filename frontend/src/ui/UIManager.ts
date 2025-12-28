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
 * @module UIManager
 * @author Model Railway Workbench
 * @version 2.2.0 - Added embedded scale controls
 */

import { TrackCatalog, type TrackCatalogEntry } from '../systems/track/TrackCatalog';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Callback when track piece is selected */
export type TrackSelectionCallback = (catalogId: string) => void;

/** Callback for toggle state changes */
export type ToggleCallback = (enabled: boolean) => void;

/** Callback for import button */
export type ImportCallback = () => void;

/** Accordion section state */
interface AccordionSection {
    header: HTMLElement;
    content: HTMLElement;
    isExpanded: boolean;
}

// ============================================================================
// DESIGN TOKENS
// ============================================================================

const THEME = {
    // Core colors
    primary: '#2c3e50',
    primaryLight: '#34495e',
    primaryDark: '#1a252f',
    accent: '#3498db',
    accentHover: '#2980b9',
    success: '#27ae60',
    warning: '#f39c12',

    // Background colors
    bgDark: '#1e272e',
    bgMedium: '#2d3436',
    bgLight: '#636e72',
    bgLighter: '#b2bec3',
    bgWhite: '#ffffff',
    bgOffWhite: '#f8f9fa',
    bgHover: '#dfe6e9',

    // Text colors
    textLight: '#ffffff',
    textMuted: '#b2bec3',
    textDark: '#2d3436',
    textMedium: '#636e72',

    // Borders
    borderLight: '#dfe6e9',
    borderMedium: '#b2bec3',
    borderDark: '#636e72',

    // Shadows
    shadowSm: '0 2px 4px rgba(0,0,0,0.1)',
    shadowMd: '0 4px 12px rgba(0,0,0,0.15)',
    shadowLg: '0 8px 24px rgba(0,0,0,0.2)',
    shadowXl: '0 12px 48px rgba(0,0,0,0.3)',

    // Transitions
    transitionFast: '0.15s ease',
    transitionMedium: '0.25s ease',
    transitionSlow: '0.35s ease',

    // Sizing
    sidebarWidth: '320px',
    sidebarCollapsedWidth: '0px',
    toggleButtonWidth: '32px',
    toggleButtonHeight: '80px',
    borderRadius: '8px',
    borderRadiusLg: '12px',
} as const;

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

    constructor(container: HTMLElement) {
        if (!container) {
            throw new Error('[UIManager] Container element is required');
        }
        this.container = container;
        console.log('[UIManager] Created');
    }

    /**
     * Initialize the UI
     */
    initialize(onTrackSelected: TrackSelectionCallback): void {
        try {
            this.onTrackSelected = onTrackSelected;
            this.injectStyles();
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
    // STYLE INJECTION
    // ========================================================================

    private injectStyles(): void {
        const styleId = 'uimanager-styles-v2';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* ============================================
               SIDEBAR BASE
               ============================================ */
            .mrw-sidebar {
                position: fixed;
                top: 0;
                right: 0;
                width: ${THEME.sidebarWidth};
                height: 100vh;
                background: linear-gradient(180deg, ${THEME.bgDark} 0%, ${THEME.primaryDark} 100%);
                box-shadow: ${THEME.shadowXl};
                z-index: 1000;
                display: flex;
                flex-direction: column;
                transform: translateX(0);
                transition: transform ${THEME.transitionMedium};
                font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
            }
            
            .mrw-sidebar.collapsed {
                transform: translateX(100%);
            }
            
            /* ============================================
               TOGGLE BUTTON - Text Label Style
               ============================================ */
            .mrw-toggle-btn {
                position: fixed;
                top: 50%;
                right: ${THEME.sidebarWidth};
                transform: translateY(-50%);
                width: ${THEME.toggleButtonWidth};
                height: ${THEME.toggleButtonHeight};
                background: ${THEME.primary};
                border: none;
                border-radius: ${THEME.borderRadius} 0 0 ${THEME.borderRadius};
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: ${THEME.shadowMd};
                transition: all ${THEME.transitionMedium};
                z-index: 1001;
                padding: 8px 4px;
            }
            
            .mrw-toggle-btn:hover {
                background: ${THEME.primaryLight};
                width: 38px;
            }
            
            .mrw-toggle-btn.sidebar-collapsed {
                right: 0;
            }
            
            .mrw-toggle-btn .toggle-label {
                writing-mode: vertical-rl;
                text-orientation: mixed;
                transform: rotate(180deg);
                font-size: 12px;
                font-weight: 600;
                color: ${THEME.textLight};
                letter-spacing: 1px;
                text-transform: uppercase;
            }
            
            /* ============================================
               OVERLAY
               ============================================ */
            .mrw-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.3);
                opacity: 0;
                visibility: hidden;
                transition: all ${THEME.transitionMedium};
                z-index: 999;
            }
            
            .mrw-overlay.visible {
                opacity: 1;
                visibility: visible;
            }
            
            /* ============================================
               HEADER
               ============================================ */
            .mrw-header {
                padding: 20px;
                background: linear-gradient(135deg, ${THEME.primary} 0%, ${THEME.primaryDark} 100%);
                border-bottom: 1px solid rgba(255,255,255,0.1);
                flex-shrink: 0;
            }
            
            .mrw-header-title {
                display: flex;
                align-items: center;
                gap: 12px;
                color: ${THEME.textLight};
                font-size: 18px;
                font-weight: 600;
                margin: 0;
            }
            
            .mrw-header-title .icon {
                font-size: 24px;
            }
            
            .mrw-header-subtitle {
                color: ${THEME.textMuted};
                font-size: 12px;
                margin-top: 4px;
                margin-left: 36px;
            }
            
            /* ============================================
               SCROLLABLE CONTENT
               ============================================ */
            .mrw-content {
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
            }
            
            .mrw-content::-webkit-scrollbar {
                width: 6px;
            }
            
            .mrw-content::-webkit-scrollbar-track {
                background: transparent;
            }
            
            .mrw-content::-webkit-scrollbar-thumb {
                background: ${THEME.bgLight};
                border-radius: 3px;
            }
            
            .mrw-content::-webkit-scrollbar-thumb:hover {
                background: ${THEME.bgLighter};
            }
            
            /* ============================================
               SECTIONS
               ============================================ */
            .mrw-section {
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }
            
            .mrw-section-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 14px 20px;
                background: rgba(0,0,0,0.2);
                cursor: pointer;
                transition: background ${THEME.transitionFast};
            }
            
            .mrw-section-header:hover {
                background: rgba(0,0,0,0.3);
            }
            
            .mrw-section-title {
                display: flex;
                align-items: center;
                gap: 10px;
                color: ${THEME.textLight};
                font-weight: 600;
                font-size: 13px;
            }
            
            .mrw-section-title .icon {
                font-size: 16px;
                opacity: 0.8;
            }
            
            .mrw-section-arrow {
                color: ${THEME.textMuted};
                font-size: 10px;
                transition: transform ${THEME.transitionFast};
            }
            
            .mrw-section-arrow.collapsed {
                transform: rotate(-90deg);
            }
            
            .mrw-section-content {
                padding: 0 20px;
                overflow: hidden;
                transition: max-height ${THEME.transitionMedium}, padding ${THEME.transitionMedium};
            }
            
            .mrw-section-content.collapsed {
                max-height: 0 !important;
                padding-top: 0;
                padding-bottom: 0;
            }
            
            .mrw-section-content.expanded {
                padding: 16px 20px;
            }
            
            /* ============================================
               IMPORT SECTION
               ============================================ */
            .mrw-import-section {
                padding: 16px 20px;
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }
            
            .mrw-import-btn {
                width: 100%;
                padding: 12px 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                background: linear-gradient(135deg, ${THEME.success} 0%, #219a52 100%);
                border: none;
                border-radius: ${THEME.borderRadius};
                color: white;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all ${THEME.transitionFast};
                box-shadow: 0 2px 8px rgba(39, 174, 96, 0.3);
            }
            
            .mrw-import-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(39, 174, 96, 0.4);
            }
            
            .mrw-import-btn:active {
                transform: translateY(0);
            }
            
            .mrw-import-btn .icon {
                font-size: 18px;
            }
            
            /* ============================================
               TRACK BUTTONS
               ============================================ */
            .mrw-track-btn {
                width: 100%;
                padding: 10px 12px;
                display: flex;
                align-items: center;
                gap: 12px;
                background: rgba(255,255,255,0.05);
                border: 1px solid transparent;
                border-radius: 6px;
                color: ${THEME.textLight};
                font-size: 13px;
                cursor: pointer;
                transition: all ${THEME.transitionFast};
                margin-bottom: 6px;
                text-align: left;
            }
            
            .mrw-track-btn:last-child {
                margin-bottom: 0;
            }
            
            .mrw-track-btn:hover {
                background: rgba(255,255,255,0.1);
                border-color: rgba(255,255,255,0.1);
            }
            
            .mrw-track-btn.selected {
                background: rgba(52, 152, 219, 0.3);
                border-color: ${THEME.accent};
            }
            
            .mrw-track-btn .track-icon {
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0,0,0,0.3);
                border-radius: 6px;
                font-size: 16px;
            }
            
            .mrw-track-btn .track-info {
                flex: 1;
                min-width: 0;
            }
            
            .mrw-track-btn .track-name {
                font-weight: 500;
                margin-bottom: 2px;
            }
            
            .mrw-track-btn .track-id {
                font-size: 10px;
                color: ${THEME.textMuted};
                font-family: 'Monaco', 'Consolas', monospace;
            }
            
            /* ============================================
               TOGGLE SWITCHES
               ============================================ */
            .mrw-toggle-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 0;
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }
            
            .mrw-toggle-row:last-child {
                border-bottom: none;
            }
            
            .mrw-toggle-label {
                display: flex;
                align-items: center;
                gap: 8px;
                color: ${THEME.textLight};
                font-size: 13px;
            }
            
            .mrw-toggle-label .icon {
                font-size: 14px;
                opacity: 0.7;
            }
            
            .mrw-toggle-switch {
                position: relative;
                width: 44px;
                height: 24px;
                background: ${THEME.bgLight};
                border: none;
                border-radius: 12px;
                cursor: pointer;
                transition: background ${THEME.transitionFast};
                padding: 0;
            }
            
            .mrw-toggle-switch:hover {
                background: ${THEME.bgLighter};
            }
            
            .mrw-toggle-switch.active {
                background: ${THEME.success};
            }
            
            .mrw-toggle-switch .knob {
                position: absolute;
                top: 3px;
                left: 3px;
                width: 18px;
                height: 18px;
                background: white;
                border-radius: 50%;
                transition: transform ${THEME.transitionFast};
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            }
            
            .mrw-toggle-switch.active .knob {
                transform: translateX(20px);
            }
            
            /* ============================================
               KEYBOARD SHORTCUTS
               ============================================ */
            .mrw-shortcut-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }
            
            .mrw-shortcut-row:last-child {
                border-bottom: none;
            }
            
            .mrw-shortcut-key {
                display: flex;
                align-items: center;
                gap: 4px;
            }
            
            .mrw-shortcut-key kbd {
                display: inline-block;
                padding: 3px 6px;
                background: ${THEME.bgMedium};
                border: 1px solid ${THEME.bgLight};
                border-radius: 4px;
                font-size: 11px;
                color: ${THEME.textLight};
                box-shadow: 0 2px 0 rgba(0,0,0,0.2);
            }
            
            .mrw-shortcut-desc {
                color: ${THEME.textMuted};
                font-size: 12px;
            }
            
            /* ============================================
               FOOTER
               ============================================ */
            .mrw-footer {
                padding: 16px 20px;
                background: rgba(0,0,0,0.3);
                border-top: 1px solid rgba(255,255,255,0.05);
                flex-shrink: 0;
            }
            
            .mrw-mode-indicator {
                display: flex;
                align-items: center;
                gap: 10px;
                color: ${THEME.textLight};
                font-size: 13px;
            }
            
            .mrw-mode-indicator .icon {
                font-size: 18px;
            }
            
            .mrw-mode-indicator .mode-text {
                font-weight: 600;
            }
            
            .mrw-mode-indicator .mode-hint {
                font-size: 11px;
                color: ${THEME.textMuted};
                margin-top: 2px;
            }
            
            /* ============================================
               RESPONSIVE
               ============================================ */
            @media (max-width: 768px) {
                .mrw-sidebar {
                    width: 100%;
                }
                
                .mrw-toggle-btn {
                    right: 0;
                }
                
                .mrw-toggle-btn:not(.sidebar-collapsed) {
                    right: calc(100% - ${THEME.toggleButtonWidth});
                }
            }
        `;
        document.head.appendChild(style);
    }

    // ========================================================================
    // UI CREATION
    // ========================================================================

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

        const shortcuts = [
            { keys: ['[', ']'], desc: 'Rotate ±5°' },
            { keys: ['Shift', '[', ']'], desc: 'Rotate ±22.5°' },
            { keys: ['S', 'Scroll'], desc: 'Scale model' },
            { keys: ['H', 'Scroll'], desc: 'Adjust height' },
            { keys: ['PgUp', 'PgDn'], desc: 'Height ±5mm' },
            { keys: ['R'], desc: 'Reset scale' },
            { keys: ['L'], desc: 'Lock scale' },
            { keys: ['T'], desc: 'Toggle switch' },
            { keys: ['Del'], desc: 'Delete selected' },
            { keys: ['Esc'], desc: 'Cancel / Deselect' },
            { keys: ['V'], desc: 'Toggle camera mode' },
            { keys: ['Home'], desc: 'Reset camera' },
            { keys: ['Shift', 'S'], desc: 'Toggle auto-snap' },
            { keys: ['Shift', 'I'], desc: 'Toggle indicators' },
            { keys: ['Shift', 'C'], desc: 'Clear all track' },
        ];

        shortcuts.forEach(shortcut => {
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

    toggleSidebar(): void {
        if (this.isOpen) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    }

    openSidebar(): void {
        this.isOpen = true;
        this.sidebar?.classList.remove('collapsed');
        this.toggleButton?.classList.remove('sidebar-collapsed');
        this.overlay?.classList.remove('visible');
    }

    closeSidebar(): void {
        this.isOpen = false;
        this.sidebar?.classList.add('collapsed');
        this.toggleButton?.classList.add('sidebar-collapsed');
        this.overlay?.classList.remove('visible');
    }

    // ========================================================================
    // ACCORDION CONTROLS
    // ========================================================================

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

    expandAllSections(): void {
        this.accordionSections.forEach((_, id) => {
            const section = this.accordionSections.get(id);
            if (section && !section.isExpanded) {
                this.toggleAccordion(id);
            }
        });
    }

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
     */
    registerToggleCallback(id: string, callback: ToggleCallback): void {
        this.setToggleCallback(id, callback);
    }

    getToggleState(id: string): boolean {
        return this.toggleStates.get(id) ?? false;
    }

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

    updateModeIndicator(mode: string, hint: string): void {
        const footer = document.getElementById('mrw-footer');
        if (!footer) return;

        const icons: Record<string, string> = {
            select: '🖱️',
            place: '📍',
            move: '✋',
            rotate: '🔄',
            delete: '🗑️'
        };

        footer.innerHTML = `
            <div class="mrw-mode-indicator">
                <span class="icon">${icons[mode.toLowerCase()] || '▶️'}</span>
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