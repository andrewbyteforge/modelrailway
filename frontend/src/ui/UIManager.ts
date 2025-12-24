/**
 * UIManager.ts - Manages UI elements (track palette, toolbar, mode indicators)
 * 
 * Provides:
 * - Track piece selection palette organized by type
 * - Visual feedback for selected pieces
 * - Mode and status indicators
 * - Keyboard shortcut hints
 * 
 * @module UIManager
 */

import { TrackCatalog, type TrackCatalogEntry } from '../systems/track/TrackCatalog';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Callback function when a track piece is selected
 */
export type TrackSelectionCallback = (catalogId: string) => void;

/**
 * UI color scheme
 */
const UI_COLORS = {
    SELECTED_BG: '#4CAF50',
    SELECTED_BORDER: '#2E7D32',
    HOVER_BG: '#f5f5f5',
    HOVER_BORDER: '#999',
    DEFAULT_BG: 'white',
    DEFAULT_BORDER: '#ccc',
    HEADER_BG: '#333',
    SECTION_TITLE: '#555',
} as const;

// ============================================================================
// UI MANAGER CLASS
// ============================================================================

/**
 * UIManager - Handles all UI elements for the application
 * 
 * @example
 * ```typescript
 * const ui = new UIManager(document.body);
 * ui.initialize((catalogId) => {
 *     console.log('Selected:', catalogId);
 * });
 * ```
 */
export class UIManager {
    /** Container element for UI */
    private container: HTMLElement;

    /** Track palette panel */
    private palette: HTMLElement | null = null;

    /** Help panel */
    private helpPanel: HTMLElement | null = null;

    /** Currently selected catalog ID */
    private selectedCatalogId: string | null = null;

    /** Callback for track selection */
    private onTrackSelected: TrackSelectionCallback | null = null;

    // ========================================================================
    // CONSTRUCTOR & INITIALIZATION
    // ========================================================================

    /**
     * Create a new UIManager
     * @param container - Parent element for UI components
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
     * Initialize all UI components
     * @param onTrackSelected - Callback when track piece is selected
     */
    initialize(onTrackSelected: TrackSelectionCallback): void {
        try {
            this.onTrackSelected = onTrackSelected;
            this.createTrackPalette();
            this.createHelpPanel();
            console.log('[UIManager] Initialized');
        } catch (error) {
            console.error('[UIManager] Error initializing:', error);
        }
    }

    // ========================================================================
    // TRACK PALETTE
    // ========================================================================

    /**
     * Create the track selection palette sidebar
     */
    private createTrackPalette(): void {
        try {
            // Create sidebar container
            this.palette = document.createElement('div');
            this.palette.id = 'track-palette';
            this.palette.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                width: 240px;
                max-height: calc(100vh - 40px);
                overflow-y: auto;
                background: rgba(255, 255, 255, 0.98);
                border: 2px solid #333;
                border-radius: 8px;
                padding: 15px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                z-index: 1000;
            `;

            // Title header
            const title = document.createElement('h3');
            title.textContent = '🚂 Track Pieces';
            title.style.cssText = `
                margin: 0 0 15px 0;
                font-size: 16px;
                font-weight: bold;
                color: #333;
                border-bottom: 2px solid #666;
                padding-bottom: 8px;
            `;
            this.palette.appendChild(title);

            // Get all track pieces from catalog
            const allPieces = TrackCatalog.getAll();

            // Group by type
            const straights = allPieces.filter(p => p.type === 'straight');
            const curvesR1 = allPieces.filter(p =>
                p.type === 'curve' && p.id.includes('_r1_')
            );
            const curvesR2 = allPieces.filter(p =>
                p.type === 'curve' && p.id.includes('_r2_')
            );
            const curvesR4 = allPieces.filter(p =>
                p.type === 'curve' && p.id.includes('_r4_')
            );
            const standardSwitches = allPieces.filter(p =>
                p.type === 'switch' && p.id.includes('switch_')
            );
            const expressSwitches = allPieces.filter(p =>
                p.type === 'switch' && p.id.includes('express_')
            );
            const curvedSwitches = allPieces.filter(p => p.type === 'curved_switch');
            const crossings = allPieces.filter(p => p.type === 'crossing');

            // Create sections
            this.createSection(this.palette, '📏 Straight Track', straights);
            this.createSection(this.palette, '↩️ R1 Curves (371mm)', curvesR1);
            this.createSection(this.palette, '↪️ R2 Curves (438mm)', curvesR2);
            this.createSection(this.palette, '🔄 R4 Curves (572mm)', curvesR4);
            this.createSection(this.palette, '🔀 Standard Points', standardSwitches);
            this.createSection(this.palette, '🚄 Express Points', expressSwitches);
            this.createSection(this.palette, '🌀 Curved Points', curvedSwitches);
            this.createSection(this.palette, '✖️ Crossings', crossings);

            // Add mode indicator
            const modeInfo = document.createElement('div');
            modeInfo.id = 'mode-info';
            modeInfo.style.cssText = `
                margin-top: 15px;
                padding: 12px;
                background: linear-gradient(135deg, #f0f0f0, #e8e8e8);
                border-radius: 6px;
                font-size: 12px;
                color: #666;
                border: 1px solid #ddd;
            `;
            modeInfo.innerHTML = `
                <strong style="color: #333;">Mode:</strong> Select<br>
                <small>Click track piece to select</small>
            `;
            this.palette.appendChild(modeInfo);

            // Add to page
            this.container.appendChild(this.palette);

            console.log('[UIManager] Track palette created with', allPieces.length, 'pieces');
        } catch (error) {
            console.error('[UIManager] Error creating track palette:', error);
        }
    }

    /**
     * Create a section in the palette with track buttons
     * @param parent - Parent element
     * @param title - Section title
     * @param pieces - Track pieces for this section
     */
    private createSection(
        parent: HTMLElement,
        title: string,
        pieces: TrackCatalogEntry[]
    ): void {
        if (pieces.length === 0) return;

        const section = document.createElement('div');
        section.style.cssText = `margin-bottom: 15px;`;

        // Section title
        const sectionTitle = document.createElement('div');
        sectionTitle.textContent = title;
        sectionTitle.style.cssText = `
            font-size: 13px;
            font-weight: 600;
            color: ${UI_COLORS.SECTION_TITLE};
            margin-bottom: 8px;
            padding-bottom: 4px;
            border-bottom: 1px solid #ddd;
        `;
        section.appendChild(sectionTitle);

        // Create button for each piece
        pieces.forEach(piece => {
            const button = this.createTrackButton(piece);
            section.appendChild(button);
        });

        parent.appendChild(section);
    }

    /**
     * Create a button for selecting a track piece
     * @param piece - Track catalog entry
     * @returns Button element
     */
    private createTrackButton(piece: TrackCatalogEntry): HTMLButtonElement {
        const button = document.createElement('button');
        button.textContent = piece.name;
        button.dataset.catalogId = piece.id;
        button.style.cssText = `
            display: block;
            width: 100%;
            padding: 10px 12px;
            margin-bottom: 4px;
            background: ${UI_COLORS.DEFAULT_BG};
            border: 2px solid ${UI_COLORS.DEFAULT_BORDER};
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            text-align: left;
            transition: all 0.15s ease;
            color: #333;
        `;

        // Hover effects
        button.addEventListener('mouseenter', () => {
            if (button.dataset.catalogId !== this.selectedCatalogId) {
                button.style.background = UI_COLORS.HOVER_BG;
                button.style.borderColor = UI_COLORS.HOVER_BORDER;
            }
        });

        button.addEventListener('mouseleave', () => {
            if (button.dataset.catalogId !== this.selectedCatalogId) {
                button.style.background = UI_COLORS.DEFAULT_BG;
                button.style.borderColor = UI_COLORS.DEFAULT_BORDER;
            }
        });

        // Click handler
        button.addEventListener('click', () => {
            this.selectTrack(piece.id);
        });

        return button;
    }

    /**
     * Select a track piece for placement
     * @param catalogId - ID of the catalog entry to select
     */
    private selectTrack(catalogId: string): void {
        try {
            // Update selection
            this.selectedCatalogId = catalogId;

            // Update all button styles
            const buttons = this.palette?.querySelectorAll('button');
            buttons?.forEach(btn => {
                const button = btn as HTMLButtonElement;
                if (button.dataset.catalogId === catalogId) {
                    // Selected state
                    button.style.background = UI_COLORS.SELECTED_BG;
                    button.style.borderColor = UI_COLORS.SELECTED_BORDER;
                    button.style.color = 'white';
                    button.style.fontWeight = 'bold';
                } else {
                    // Default state
                    button.style.background = UI_COLORS.DEFAULT_BG;
                    button.style.borderColor = UI_COLORS.DEFAULT_BORDER;
                    button.style.color = '#333';
                    button.style.fontWeight = 'normal';
                }
            });

            // Update mode info
            const modeInfo = document.getElementById('mode-info');
            if (modeInfo) {
                const entry = TrackCatalog.get(catalogId);
                const typeBadge = this.getTypeBadge(entry?.type || 'straight');
                modeInfo.innerHTML = `
                    <strong style="color: #333;">Mode:</strong> Place ${typeBadge}<br>
                    <small style="color: #4CAF50; font-weight: bold;">
                        ${entry?.name || catalogId}
                    </small><br>
                    <small style="color: #888;">Click board to place</small>
                `;
            }

            // Notify callback
            if (this.onTrackSelected) {
                this.onTrackSelected(catalogId);
            }

            console.log(`[UIManager] Selected: ${catalogId}`);
        } catch (error) {
            console.error('[UIManager] Error selecting track:', error);
        }
    }

    /**
     * Get emoji badge for track type
     * @param type - Track type
     * @returns Emoji string
     */
    private getTypeBadge(type: string): string {
        switch (type) {
            case 'straight': return '📏';
            case 'curve': return '↩️';
            case 'switch': return '🔀';
            default: return '🛤️';
        }
    }

    // ========================================================================
    // HELP PANEL
    // ========================================================================

    /**
     * Create the keyboard shortcuts help panel
     */
    private createHelpPanel(): void {
        try {
            this.helpPanel = document.createElement('div');
            this.helpPanel.id = 'help-panel';
            this.helpPanel.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 20px;
                width: 220px;
                background: rgba(0, 0, 0, 0.85);
                border-radius: 8px;
                padding: 12px;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 11px;
                color: #fff;
                z-index: 1000;
            `;

            this.helpPanel.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 8px; color: #4CAF50;">
                    ⌨️ Keyboard Shortcuts
                </div>
                <div style="line-height: 1.8;">
                    <span style="color: #aaa;">[Q/E]</span> Rotate selected 5°<br>
                    <span style="color: #aaa;">[Shift+Q/E]</span> Rotate 22.5°<br>
                    <span style="color: #aaa;">[DEL]</span> Delete selected<br>
                    <span style="color: #aaa;">[ESC]</span> Cancel placement<br>
                    <span style="color: #aaa;">[V]</span> Toggle camera<br>
                    <span style="color: #aaa;">[Shift+C]</span> Clear all track
                </div>
                <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #444;">
                    <span style="color: #888;">Hornby OO Gauge</span><br>
                    <span style="color: #666; font-size: 10px;">R1=371mm R2=438mm</span>
                </div>
            `;

            this.container.appendChild(this.helpPanel);
            console.log('[UIManager] Help panel created');
        } catch (error) {
            console.error('[UIManager] Error creating help panel:', error);
        }
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /**
     * Clear the current track selection
     */
    clearSelection(): void {
        this.selectedCatalogId = null;

        // Reset all button styles
        const buttons = this.palette?.querySelectorAll('button');
        buttons?.forEach(btn => {
            const button = btn as HTMLButtonElement;
            button.style.background = UI_COLORS.DEFAULT_BG;
            button.style.borderColor = UI_COLORS.DEFAULT_BORDER;
            button.style.color = '#333';
            button.style.fontWeight = 'normal';
        });

        // Reset mode info
        const modeInfo = document.getElementById('mode-info');
        if (modeInfo) {
            modeInfo.innerHTML = `
                <strong style="color: #333;">Mode:</strong> Select<br>
                <small>Click track piece to select</small>
            `;
        }

        console.log('[UIManager] Selection cleared');
    }

    /**
     * Get the currently selected catalog ID
     * @returns Selected catalog ID or null
     */
    getSelectedCatalogId(): string | null {
        return this.selectedCatalogId;
    }

    /**
     * Update status message
     * @param message - Status message to display
     * @param type - Message type for styling
     */
    showStatus(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
        // Could add a status bar implementation here
        console.log(`[UIManager] Status (${type}): ${message}`);
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Dispose all UI elements
     */
    dispose(): void {
        try {
            if (this.palette) {
                this.palette.remove();
                this.palette = null;
            }
            if (this.helpPanel) {
                this.helpPanel.remove();
                this.helpPanel = null;
            }
            console.log('[UIManager] Disposed');
        } catch (error) {
            console.error('[UIManager] Error disposing:', error);
        }
    }
}