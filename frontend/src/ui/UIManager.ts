/**
 * UIManager.ts - Manages UI elements (track palette, toolbar)
 */

import { TrackCatalog } from '../systems/track/TrackCatalog';

export type TrackSelectionCallback = (catalogId: string) => void;

export class UIManager {
    private container: HTMLElement;
    private palette: HTMLElement | null = null;
    private selectedCatalogId: string | null = null;
    private onTrackSelected: TrackSelectionCallback | null = null;

    constructor(container: HTMLElement) {
        if (!container) {
            throw new Error('[UIManager] Container element is required');
        }
        this.container = container;
        console.log('[UIManager] Created');
    }

    /**
     * Initialize UI
     */
    initialize(onTrackSelected: TrackSelectionCallback): void {
        try {
            this.onTrackSelected = onTrackSelected;
            this.createTrackPalette();
            console.log('[UIManager] Initialized');
        } catch (error) {
            console.error('[UIManager] Error initializing:', error);
        }
    }

    /**
     * Create track palette sidebar
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
        width: 220px;
        background: rgba(255, 255, 255, 0.95);
        border: 2px solid #333;
        border-radius: 8px;
        padding: 15px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        z-index: 1000;
      `;

            // Title
            const title = document.createElement('h3');
            title.textContent = 'Track Pieces';
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
            const curves = allPieces.filter(p => p.type === 'curve');
            const switches = allPieces.filter(p => p.type === 'switch');

            // Create sections
            this.createSection(this.palette, 'Straight Track', straights);
            this.createSection(this.palette, 'Curved Track', curves);
            this.createSection(this.palette, 'Switches', switches);

            // Add mode indicator
            const modeInfo = document.createElement('div');
            modeInfo.id = 'mode-info';
            modeInfo.style.cssText = `
        margin-top: 15px;
        padding: 10px;
        background: #f0f0f0;
        border-radius: 4px;
        font-size: 12px;
        color: #666;
      `;
            modeInfo.innerHTML = `
        <strong>Mode:</strong> Select<br>
        <small>Click track to select</small>
      `;
            this.palette.appendChild(modeInfo);

            // Add to page
            this.container.appendChild(this.palette);

            console.log('[UIManager] Track palette created');
        } catch (error) {
            console.error('[UIManager] Error creating track palette:', error);
        }
    }

    /**
     * Create a section in the palette
     */
    private createSection(parent: HTMLElement, title: string, pieces: any[]): void {
        if (pieces.length === 0) return;

        const section = document.createElement('div');
        section.style.cssText = `
      margin-bottom: 15px;
    `;

        const sectionTitle = document.createElement('div');
        sectionTitle.textContent = title;
        sectionTitle.style.cssText = `
      font-size: 13px;
      font-weight: 600;
      color: #555;
      margin-bottom: 8px;
    `;
        section.appendChild(sectionTitle);

        pieces.forEach(piece => {
            const button = document.createElement('button');
            button.textContent = piece.name;
            button.dataset.catalogId = piece.id;
            button.style.cssText = `
        display: block;
        width: 100%;
        padding: 8px 10px;
        margin-bottom: 5px;
        background: white;
        border: 2px solid #ccc;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        text-align: left;
        transition: all 0.2s;
      `;

            button.addEventListener('mouseenter', () => {
                if (button.dataset.catalogId !== this.selectedCatalogId) {
                    button.style.background = '#f5f5f5';
                    button.style.borderColor = '#999';
                }
            });

            button.addEventListener('mouseleave', () => {
                if (button.dataset.catalogId !== this.selectedCatalogId) {
                    button.style.background = 'white';
                    button.style.borderColor = '#ccc';
                }
            });

            button.addEventListener('click', () => {
                this.selectTrack(piece.id);
            });

            section.appendChild(button);
        });

        parent.appendChild(section);
    }

    /**
     * Select a track piece
     */
    private selectTrack(catalogId: string): void {
        try {
            // Update selection
            this.selectedCatalogId = catalogId;

            // Update button styles
            const buttons = this.palette?.querySelectorAll('button');
            buttons?.forEach(btn => {
                const button = btn as HTMLButtonElement;
                if (button.dataset.catalogId === catalogId) {
                    button.style.background = '#4CAF50';
                    button.style.borderColor = '#2E7D32';
                    button.style.color = 'white';
                    button.style.fontWeight = 'bold';
                } else {
                    button.style.background = 'white';
                    button.style.borderColor = '#ccc';
                    button.style.color = 'black';
                    button.style.fontWeight = 'normal';
                }
            });

            // Update mode info
            const modeInfo = document.getElementById('mode-info');
            if (modeInfo) {
                const entry = TrackCatalog.get(catalogId);
                modeInfo.innerHTML = `
          <strong>Mode:</strong> Place<br>
          <small>Click board to place:<br>${entry?.name || catalogId}</small>
        `;
            }

            // Notify callback
            if (this.onTrackSelected) {
                this.onTrackSelected(catalogId);
            }

            console.log(`[UIManager] Selected track: ${catalogId}`);
        } catch (error) {
            console.error('[UIManager] Error selecting track:', error);
        }
    }

    /**
     * Clear selection
     */
    clearSelection(): void {
        this.selectedCatalogId = null;

        // Update button styles
        const buttons = this.palette?.querySelectorAll('button');
        buttons?.forEach(btn => {
            const button = btn as HTMLButtonElement;
            button.style.background = 'white';
            button.style.borderColor = '#ccc';
            button.style.color = 'black';
            button.style.fontWeight = 'normal';
        });

        // Update mode info
        const modeInfo = document.getElementById('mode-info');
        if (modeInfo) {
            modeInfo.innerHTML = `
        <strong>Mode:</strong> Select<br>
        <small>Click track to select</small>
      `;
        }

        console.log('[UIManager] Selection cleared');
    }

    /**
     * Get currently selected catalog ID
     */
    getSelectedCatalogId(): string | null {
        return this.selectedCatalogId;
    }

    /**
     * Dispose UI
     */
    dispose(): void {
        try {
            if (this.palette) {
                this.palette.remove();
                this.palette = null;
            }
            console.log('[UIManager] Disposed');
        } catch (error) {
            console.error('[UIManager] Error disposing:', error);
        }
    }
}