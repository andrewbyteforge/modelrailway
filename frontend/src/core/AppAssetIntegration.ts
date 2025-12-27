/**
 * AppAssetIntegration.ts - Integration code for asset and outliner systems
 * 
 * Path: frontend/src/core/AppAssetIntegration.ts
 * 
 * This file contains the code needed to integrate:
 * - AssetLibraryManager (persistent storage)
 * - PlacedItemManager (scene tracking)
 * - RollingStockPanel (sidebar)
 * - SceneOutliner (scene hierarchy)
 * 
 * Copy relevant sections into your App.ts file.
 * 
 * @module AppAssetIntegration
 * @version 1.0.0
 */

import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';

// Import the asset systems
import { AssetLibraryManager } from '../systems/assets/AssetLibraryManager';
import { PlacedItemManager } from '../systems/assets/PlacedItemManager';
import type { RollingStockCategory, AssetMetadata } from '@shared/types/assetLibrary.types';
import type { PlacedItem, PlacedRollingStockItem } from '@shared/types/placedItem.types';

// Import UI components
import { RollingStockPanel } from '../ui/RollingStockPanel';
import { SceneOutliner } from '../ui/SceneOutliner';

// ============================================================================
// INTEGRATION EXAMPLE CLASS
// ============================================================================

/**
 * Example showing how to integrate the asset and outliner systems
 * 
 * Copy the relevant methods and properties into your actual App class
 */
export class AppAssetIntegration {
    // ========================================================================
    // PROPERTIES TO ADD TO YOUR APP CLASS
    // ========================================================================

    /** Asset library manager (persistent storage) */
    private assetLibrary: AssetLibraryManager;

    /** Placed item manager (scene tracking) */
    private placedItemManager: PlacedItemManager;

    /** Rolling stock panel (sidebar) */
    private rollingStockPanel: RollingStockPanel | null = null;

    /** Scene outliner */
    private sceneOutliner: SceneOutliner | null = null;

    /** Currently selected asset for placement */
    private selectedAssetId: string | null = null;
    private selectedAssetCategory: RollingStockCategory | null = null;

    /** Next mesh ID counter */
    private nextMeshId: number = 0;

    /** Reference to Babylon scene */
    private scene: Scene;

    /** Board Y position */
    private boardY: number = 0.01;

    // ========================================================================
    // CONSTRUCTOR ADDITIONS
    // ========================================================================

    constructor(scene: Scene) {
        this.scene = scene;

        // Get singleton instances
        this.assetLibrary = AssetLibraryManager.getInstance();
        this.placedItemManager = PlacedItemManager.getInstance();
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize asset systems - call this in your App.init() method
     */
    public async initializeAssetSystems(): Promise<void> {
        try {
            console.log('[App] Initializing asset systems...');

            // Initialize the asset library (loads from IndexedDB)
            await this.assetLibrary.initialize();

            console.log('[App] Asset library initialized with',
                this.assetLibrary.getAssetCount(), 'stored assets');

            // Log storage info
            const storageInfo = this.assetLibrary.getStorageInfo();
            console.log('[App] Storage info:', storageInfo);

        } catch (error) {
            console.error('[App] Failed to initialize asset systems:', error);
        }
    }

    // ========================================================================
    // UI SETUP
    // ========================================================================

    /**
     * Create the sidebar with rolling stock panel
     * Call this when setting up your UI
     */
    public createAssetSidebar(container: HTMLElement): void {
        // Create rolling stock panel
        this.rollingStockPanel = new RollingStockPanel();
        const rollingStockElement = this.rollingStockPanel.createElement(
            (assetId, category) => this.handleAssetSelected(assetId, category)
        );

        // Add to your sidebar container
        container.appendChild(rollingStockElement);

        console.log('[App] Rolling stock panel created');
    }

    /**
     * Create the scene outliner
     * Call this when setting up your UI (typically in left sidebar)
     */
    public createSceneOutliner(container: HTMLElement): void {
        this.sceneOutliner = new SceneOutliner();
        const outlinerElement = this.sceneOutliner.createElement({
            onSelect: (item) => this.handleOutlinerSelect(item),
            onVisibilityChange: (item, visible) => this.handleOutlinerVisibility(item, visible),
            onDelete: (item) => this.handleOutlinerDelete(item)
        });

        container.appendChild(outlinerElement);

        console.log('[App] Scene outliner created');
    }

    // ========================================================================
    // ASSET SELECTION FROM SIDEBAR
    // ========================================================================

    /**
     * Handle asset selection from the rolling stock panel
     */
    private handleAssetSelected(assetId: string, category: RollingStockCategory): void {
        console.log('[App] Asset selected for placement:', assetId, category);

        this.selectedAssetId = assetId;
        this.selectedAssetCategory = category;

        // Get the asset metadata
        const metadata = this.assetLibrary.getAssetMetadata(assetId);
        if (metadata) {
            console.log('[App] Ready to place:', metadata.name);
            // You could show a placement preview here
        }
    }

    // ========================================================================
    // ASSET PLACEMENT
    // ========================================================================

    /**
     * Place the currently selected asset at a position
     * Call this from your click handler when in placement mode
     */
    public async placeSelectedAsset(position: Vector3): Promise<void> {
        if (!this.selectedAssetId || !this.selectedAssetCategory) {
            console.warn('[App] No asset selected for placement');
            return;
        }

        const metadata = this.assetLibrary.getAssetMetadata(this.selectedAssetId);
        if (!metadata) {
            console.error('[App] Asset metadata not found:', this.selectedAssetId);
            return;
        }

        try {
            console.log('[App] Placing asset:', metadata.name, 'at', position);

            // Get the asset blob URL
            const blobUrl = await this.assetLibrary.getAssetBlobUrl(this.selectedAssetId);
            if (!blobUrl) {
                throw new Error('Failed to get asset data');
            }

            // Generate unique mesh name
            const meshName = `rollingstock_${this.nextMeshId++}`;

            // Load the GLB model
            const result = await SceneLoader.ImportMeshAsync(
                '',
                '',
                blobUrl,
                this.scene,
                undefined,
                '.glb'
            );

            // Cleanup blob URL
            URL.revokeObjectURL(blobUrl);

            if (result.meshes.length === 0) {
                throw new Error('No meshes loaded from asset');
            }

            // Get the root mesh
            const rootMesh = result.meshes[0];
            rootMesh.name = meshName;

            // Apply scaling based on metadata
            const scale = this.calculateScale(metadata);
            rootMesh.scaling.setAll(scale);

            // Position the model
            rootMesh.position = position.clone();
            rootMesh.position.y = this.boardY + 0.005; // Slightly above board

            // Record the placement in PlacedItemManager
            const placedItem = this.placedItemManager.addRollingStock({
                assetId: this.selectedAssetId,
                name: metadata.name,
                category: this.selectedAssetCategory,
                meshName: meshName,
                position: {
                    x: position.x,
                    y: position.y,
                    z: position.z
                },
                scale: scale,
                onTrack: false
            });

            // Record usage in asset library
            await this.assetLibrary.recordAssetUsage(this.selectedAssetId);

            console.log('[App] Asset placed successfully:', placedItem.id);

            // Optionally clear selection after placement
            // this.clearAssetSelection();

        } catch (error) {
            console.error('[App] Failed to place asset:', error);
        }
    }

    /**
     * Calculate scale factor based on asset metadata
     */
    private calculateScale(metadata: AssetMetadata): number {
        switch (metadata.scaling.mode) {
            case 'reference':
                // Scale based on reference length in mm
                if (metadata.scaling.referenceLengthMm) {
                    // Convert mm to meters and apply OO gauge scale
                    return (metadata.scaling.referenceLengthMm / 1000) / 76.2;
                }
                return 1.0;

            case 'direct-scale':
                return metadata.scaling.scaleFactor ?? 1.0;

            case 'real-world':
                // Model is 1:1 real world, apply OO scale
                return 1 / 76.2;

            case 'as-is':
            default:
                return 1.0;
        }
    }

    /**
     * Clear the current asset selection
     */
    public clearAssetSelection(): void {
        this.selectedAssetId = null;
        this.selectedAssetCategory = null;

        if (this.rollingStockPanel) {
            this.rollingStockPanel.clearSelection();
        }
    }

    // ========================================================================
    // OUTLINER CALLBACKS
    // ========================================================================

    /**
     * Handle selection from the outliner
     */
    private handleOutlinerSelect(item: PlacedItem): void {
        console.log('[App] Outliner selected:', item.name);

        // Find and select the mesh in the scene
        if ('meshName' in item) {
            const mesh = this.scene.getMeshByName(item.meshName);
            if (mesh) {
                // You could highlight the mesh or focus the camera on it
                console.log('[App] Found mesh:', mesh.name);
            }
        }
    }

    /**
     * Handle visibility toggle from the outliner
     */
    private handleOutlinerVisibility(item: PlacedItem, visible: boolean): void {
        console.log('[App] Visibility changed:', item.name, visible);

        // Find and toggle the mesh visibility
        if ('meshName' in item) {
            const mesh = this.scene.getMeshByName(item.meshName);
            if (mesh) {
                mesh.setEnabled(visible);
            }
        }
    }

    /**
     * Handle delete from the outliner
     */
    private handleOutlinerDelete(item: PlacedItem): void {
        console.log('[App] Deleting:', item.name);

        // Remove the mesh from the scene
        if ('meshName' in item) {
            const mesh = this.scene.getMeshByName(item.meshName);
            if (mesh) {
                mesh.dispose();
            }
        }

        // Note: The PlacedItemManager.removeItem() is called by the outliner
    }

    // ========================================================================
    // TRACK INTEGRATION
    // ========================================================================

    /**
     * Register a placed track piece with the outliner
     * Call this from your TrackSystem.placePiece() method
     */
    public registerTrackPiece(
        pieceId: string,
        catalogId: string,
        name: string,
        trackType: 'straight' | 'curve' | 'switch' | 'curved_switch' | 'crossing',
        position: Vector3
    ): void {
        this.placedItemManager.addTrackPiece({
            pieceId,
            catalogId,
            name,
            trackType,
            position: {
                x: position.x,
                y: position.y,
                z: position.z
            }
        });
    }

    /**
     * Unregister a track piece from the outliner
     * Call this when a track piece is deleted
     */
    public unregisterTrackPiece(pieceId: string): void {
        // Find the placed item by pieceId
        const trackItems = this.placedItemManager.getTrackPieces();
        const item = trackItems.find(t => t.pieceId === pieceId);
        if (item) {
            this.placedItemManager.removeItem(item.id);
        }
    }

    // ========================================================================
    // SERIALIZATION
    // ========================================================================

    /**
     * Get placed items for saving
     */
    public getPlacedItemsJSON(): object {
        return this.placedItemManager.toJSON();
    }

    /**
     * Load placed items from save data
     */
    public loadPlacedItems(data: any): void {
        this.placedItemManager.fromJSON(data);
    }
}

// ============================================================================
// EXAMPLE USAGE IN App.ts
// ============================================================================

/*
In your actual App.ts, integrate like this:

// 1. Add imports at the top:
import { AssetLibraryManager } from '../systems/assets/AssetLibraryManager';
import { PlacedItemManager } from '../systems/assets/PlacedItemManager';
import { RollingStockPanel } from '../ui/RollingStockPanel';
import { SceneOutliner } from '../ui/SceneOutliner';

// 2. Add properties to App class:
private assetLibrary: AssetLibraryManager;
private placedItemManager: PlacedItemManager;
private rollingStockPanel: RollingStockPanel | null = null;
private sceneOutliner: SceneOutliner | null = null;

// 3. In constructor:
this.assetLibrary = AssetLibraryManager.getInstance();
this.placedItemManager = PlacedItemManager.getInstance();

// 4. In init():
await this.assetLibrary.initialize();

// 5. In setupUI():
// Create left sidebar container for outliner
const leftSidebar = document.createElement('div');
leftSidebar.style.cssText = `
    position: fixed;
    top: 20px;
    left: 20px;
    width: 260px;
    max-height: calc(100vh - 40px);
    overflow-y: auto;
    z-index: 1000;
`;
document.body.appendChild(leftSidebar);

// Add scene outliner to left sidebar
this.sceneOutliner = new SceneOutliner();
leftSidebar.appendChild(this.sceneOutliner.createElement({
    onSelect: (item) => this.handleOutlinerSelect(item),
    onVisibilityChange: (item, visible) => this.handleOutlinerVisibility(item, visible),
    onDelete: (item) => this.handleOutlinerDelete(item)
}));

// Add rolling stock panel to right sidebar (existing palette)
this.rollingStockPanel = new RollingStockPanel();
yourPaletteElement.appendChild(this.rollingStockPanel.createElement(
    (assetId, category) => this.handleAssetSelected(assetId, category)
));

// 6. In TrackSystem.placePiece(), after successfully placing:
this.placedItemManager.addTrackPiece({
    pieceId: piece.id,
    catalogId: catalogEntry.id,
    name: catalogEntry.name,
    trackType: catalogEntry.type,
    position: { x: position.x, y: position.y, z: position.z }
});

// 7. In TrackSystem.removePiece(), before removing:
// Find and remove from placed item manager
const trackItems = this.placedItemManager.getTrackPieces();
const item = trackItems.find(t => t.pieceId === pieceId);
if (item) {
    this.placedItemManager.removeItem(item.id);
}
*/

export default AppAssetIntegration;