/**
 * UIManagerIntegration.ts - Integration guide for Rolling Stock Panel
 * 
 * Path: frontend/src/ui/UIManagerIntegration.ts
 * 
 * This file contains the code additions needed to integrate the 
 * RollingStockPanel into the existing UIManager.
 * 
 * INSTRUCTIONS:
 * 1. Import the RollingStockPanel and AssetLibraryManager in UIManager.ts
 * 2. Add the panel reference as a class member
 * 3. Update the createTrackPalette method to include the rolling stock section
 * 4. Initialize the asset library in the main App.ts
 * 
 * @module UIManagerIntegration
 * @version 1.0.0
 */

// ============================================================================
// STEP 1: ADD IMPORTS TO UIManager.ts (at the top of the file)
// ============================================================================

/*
Add these imports at the top of UIManager.ts:

import { RollingStockPanel } from './RollingStockPanel';
import { AssetLibraryManager } from '../systems/assets/AssetLibraryManager';
import type { RollingStockCategory } from '@shared/types/assetLibrary.types';
*/

// ============================================================================
// STEP 2: ADD CLASS MEMBER TO UIManager (in the class definition)
// ============================================================================

/*
Add this member variable in the UIManager class:

    /** Rolling stock panel reference * /
    private rollingStockPanel: RollingStockPanel | null = null;

    /** Callback for rolling stock selection * /
    private onRollingStockSelected: ((assetId: string, category: RollingStockCategory) => void) | null = null;
*/

// ============================================================================
// STEP 3: UPDATE initialize() METHOD
// ============================================================================

/*
Update the initialize method signature and add rolling stock callback:

    /**
     * Initialize all UI components
     * @param onTrackSelected - Callback when track piece is selected
     * @param onRollingStockSelected - Callback when rolling stock is selected
     * /
    initialize(
        onTrackSelected: TrackSelectionCallback,
        onRollingStockSelected?: (assetId: string, category: RollingStockCategory) => void
    ): void {
        try {
            this.onTrackSelected = onTrackSelected;
            this.onRollingStockSelected = onRollingStockSelected || null;
            this.createSettingsPanel();
            this.createTrackPalette();
            this.createHelpPanel();
            console.log('[UIManager] Initialized');
        } catch (error) {
            console.error('[UIManager] Error initializing:', error);
        }
    }
*/

// ============================================================================
// STEP 4: UPDATED createTrackPalette() METHOD
// ============================================================================

// This is the complete updated method that includes the Rolling Stock section
// Replace the existing createTrackPalette method with this version

import { TrackCatalog, type TrackCatalogEntry } from '../systems/track/TrackCatalog';
import { RollingStockPanel } from './RollingStockPanel';
import type { RollingStockCategory } from '@shared/types/assetLibrary.types';

/**
 * Example of how to create the track palette with rolling stock section
 * 
 * Copy the relevant sections into your existing UIManager.ts
 */
export class UIManagerIntegrationExample {
    private palette: HTMLElement | null = null;
    private rollingStockPanel: RollingStockPanel | null = null;
    private container: HTMLElement;
    private onTrackSelected: ((catalogId: string) => void) | null = null;
    private onRollingStockSelected: ((assetId: string, category: RollingStockCategory) => void) | null = null;

    constructor(container: HTMLElement) {
        this.container = container;
    }

    /**
     * Create the track selection palette sidebar
     * UPDATED VERSION - includes Rolling Stock section
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
                width: 260px;
                max-height: calc(100vh - 40px);
                overflow-y: auto;
                background: rgba(255, 255, 255, 0.98);
                border: 2px solid #333;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                z-index: 1000;
            `;

            // ================================================================
            // TITLE HEADER
            // ================================================================
            const title = document.createElement('div');
            title.style.cssText = `
                background: linear-gradient(135deg, #333 0%, #555 100%);
                color: white;
                padding: 12px 15px;
                font-size: 16px;
                font-weight: bold;
                border-radius: 6px 6px 0 0;
                display: flex;
                align-items: center;
                gap: 8px;
            `;
            title.innerHTML = '🚂 Model Railway Workbench';
            this.palette.appendChild(title);

            // Main content area with padding
            const content = document.createElement('div');
            content.style.cssText = 'padding: 15px;';

            // ================================================================
            // TRACK PIECES SECTION
            // ================================================================
            const trackSection = this.createTrackSection();
            content.appendChild(trackSection);

            // ================================================================
            // ROLLING STOCK SECTION (NEW!)
            // ================================================================
            this.rollingStockPanel = new RollingStockPanel();
            const rollingStockElement = this.rollingStockPanel.createElement(
                (assetId, category) => {
                    console.log('[UIManager] Rolling stock selected:', assetId, category);
                    if (this.onRollingStockSelected) {
                        this.onRollingStockSelected(assetId, category);
                    }
                }
            );
            content.appendChild(rollingStockElement);

            // ================================================================
            // MODE INDICATOR
            // ================================================================
            const modeInfo = document.createElement('div');
            modeInfo.style.cssText = `
                margin-top: 15px;
                padding: 10px;
                background: #e3f2fd;
                border-radius: 6px;
                font-size: 12px;
                color: #1565c0;
            `;
            modeInfo.innerHTML = `
                <strong>💡 Tip:</strong> Select a track piece or rolling stock,
                then click on the baseboard to place it.
            `;
            content.appendChild(modeInfo);

            this.palette.appendChild(content);
            this.container.appendChild(this.palette);

            console.log('[UIManager] Track palette created with rolling stock section');

        } catch (error) {
            console.error('[UIManager] Error creating track palette:', error);
        }
    }

    /**
     * Create the track pieces section (accordion-style)
     */
    private createTrackSection(): HTMLElement {
        const section = document.createElement('div');
        section.style.cssText = `
            margin-bottom: 15px;
            border: 1px solid #ddd;
            border-radius: 8px;
            overflow: hidden;
        `;

        // Section header (collapsible)
        const header = document.createElement('div');
        header.style.cssText = `
            background: linear-gradient(135deg, #795548 0%, #5D4037 100%);
            color: white;
            padding: 12px 15px;
            font-size: 16px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            user-select: none;
        `;
        header.innerHTML = `
            <span>🛤️ Track Pieces</span>
            <span id="track-expand-icon" style="transition: transform 0.3s;">▼</span>
        `;

        // Track content container
        const trackContent = document.createElement('div');
        trackContent.id = 'track-pieces-content';
        trackContent.style.cssText = `
            background: #f9f9f9;
            max-height: 400px;
            overflow-y: auto;
            transition: max-height 0.3s ease;
        `;

        // Toggle expand/collapse
        let isExpanded = true;
        header.onclick = () => {
            isExpanded = !isExpanded;
            trackContent.style.maxHeight = isExpanded ? '400px' : '0';
            trackContent.style.overflow = isExpanded ? 'auto' : 'hidden';
            const icon = document.getElementById('track-expand-icon');
            if (icon) {
                icon.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';
            }
        };

        // Get all track pieces from catalog
        const allPieces = TrackCatalog.getAll();

        // Group by type
        const groups = {
            'Straight Track': allPieces.filter(p => p.type === 'straight'),
            'R1 Curves (371mm)': allPieces.filter(p => p.type === 'curve' && p.id.includes('_r1_')),
            'R2 Curves (438mm)': allPieces.filter(p => p.type === 'curve' && p.id.includes('_r2_')),
            'R4 Curves (572mm)': allPieces.filter(p => p.type === 'curve' && p.id.includes('_r4_')),
            'Standard Points': allPieces.filter(p => p.type === 'switch' && p.id.includes('switch_')),
            'Express Points': allPieces.filter(p => p.type === 'switch' && p.id.includes('express_')),
            'Curved Points': allPieces.filter(p => p.type === 'curved_switch'),
            'Crossings': allPieces.filter(p => p.type === 'crossing')
        };

        // Create sub-sections for each group
        Object.entries(groups).forEach(([groupName, pieces]) => {
            if (pieces.length > 0) {
                const groupSection = this.createTrackGroup(groupName, pieces);
                trackContent.appendChild(groupSection);
            }
        });

        section.appendChild(header);
        section.appendChild(trackContent);

        return section;
    }

    /**
     * Create a track group (sub-section with collapsible list)
     */
    private createTrackGroup(name: string, pieces: TrackCatalogEntry[]): HTMLElement {
        const group = document.createElement('div');
        group.style.cssText = 'border-bottom: 1px solid #eee;';

        // Group header
        const header = document.createElement('div');
        header.style.cssText = `
            background: white;
            padding: 8px 12px;
            font-weight: 500;
            font-size: 13px;
            color: #333;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background 0.2s;
        `;
        header.innerHTML = `
            <span>${name}</span>
            <span style="color: #888; font-size: 12px;">${pieces.length}</span>
        `;

        // Pieces container
        const piecesContainer = document.createElement('div');
        piecesContainer.style.cssText = `
            background: #fafafa;
            padding: 8px;
            display: none;
        `;

        // Toggle visibility
        header.onclick = () => {
            const isVisible = piecesContainer.style.display !== 'none';
            piecesContainer.style.display = isVisible ? 'none' : 'block';
            header.style.background = isVisible ? 'white' : '#e3f2fd';
        };

        header.onmouseover = () => {
            if (piecesContainer.style.display === 'none') {
                header.style.background = '#f5f5f5';
            }
        };
        header.onmouseout = () => {
            if (piecesContainer.style.display === 'none') {
                header.style.background = 'white';
            }
        };

        // Add piece buttons
        pieces.forEach(piece => {
            const btn = this.createTrackButton(piece);
            piecesContainer.appendChild(btn);
        });

        group.appendChild(header);
        group.appendChild(piecesContainer);

        return group;
    }

    /**
     * Create a track piece button
     */
    private createTrackButton(piece: TrackCatalogEntry): HTMLElement {
        const btn = document.createElement('button');
        btn.style.cssText = `
            width: 100%;
            padding: 8px 10px;
            margin-bottom: 4px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: white;
            cursor: pointer;
            text-align: left;
            font-size: 12px;
            transition: all 0.2s;
        `;
        btn.textContent = piece.name;
        btn.title = `${piece.name}\nLength: ${piece.totalLength}mm`;

        btn.onmouseover = () => {
            btn.style.background = '#e3f2fd';
            btn.style.borderColor = '#2196F3';
        };

        btn.onmouseout = () => {
            btn.style.background = 'white';
            btn.style.borderColor = '#ddd';
        };

        btn.onclick = () => {
            if (this.onTrackSelected) {
                this.onTrackSelected(piece.id);
            }
        };

        return btn;
    }
}

// ============================================================================
// STEP 5: UPDATE App.ts TO INITIALIZE ASSET LIBRARY
// ============================================================================

/*
Add this to App.ts in the initialization sequence:

import { AssetLibraryManager } from '../systems/assets/AssetLibraryManager';

// In the App class constructor or init method:
private async initializeAssetLibrary(): Promise<void> {
    try {
        const assetLibrary = AssetLibraryManager.getInstance();
        await assetLibrary.initialize();
        console.log('[App] Asset library initialized');
    } catch (error) {
        console.error('[App] Failed to initialize asset library:', error);
    }
}

// Call this in your main initialization:
await this.initializeAssetLibrary();

// Update UIManager initialization to include rolling stock callback:
this.uiManager.initialize(
    (catalogId) => this.handleTrackSelection(catalogId),
    (assetId, category) => this.handleRollingStockSelection(assetId, category)
);

// Add handler method:
private async handleRollingStockSelection(assetId: string, category: RollingStockCategory): Promise<void> {
    console.log('[App] Rolling stock selected:', assetId, category);
    
    const assetLibrary = AssetLibraryManager.getInstance();
    const metadata = assetLibrary.getAssetMetadata(assetId);
    
    if (metadata) {
        // Get blob URL for the asset
        const blobUrl = await assetLibrary.getAssetBlobUrl(assetId);
        if (blobUrl) {
            // Load and place the model using your existing model loading system
            // This depends on how your ModelImportSystem is implemented
            console.log('[App] Loading model from:', blobUrl);
            
            // Record usage
            await assetLibrary.recordAssetUsage(assetId);
        }
    }
}
*/

// ============================================================================
// EXPORTS FOR TYPE REFERENCE
// ============================================================================

export { UIManagerIntegrationExample };