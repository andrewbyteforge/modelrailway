/**
 * AssetLibraryManager.ts - Manages persistent storage of rolling stock assets
 * 
 * Path: frontend/src/systems/assets/AssetLibraryManager.ts
 * 
 * Provides:
 * - Persistent storage using IndexedDB (browser) with localStorage fallback
 * - Asset import with automatic file storage
 * - Category-based organization
 * - Thumbnail generation
 * - Asset removal with cleanup
 * 
 * Storage Strategy:
 * - IndexedDB for binary asset data (GLB files)
 * - JSON manifest for metadata
 * - Automatic migration between storage versions
 * 
 * @module AssetLibraryManager
 * @version 1.0.0
 */

import type {
    AssetLibrary,
    AssetMetadata,
    AssetImportOptions,
    AssetImportResult,
    RollingStockCategory,
    DEFAULT_ASSET_LIBRARY
} from '@shared/types/assetLibrary.types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** IndexedDB database name */
const DB_NAME = 'ModelRailwayAssets';

/** IndexedDB database version */
const DB_VERSION = 1;

/** Object store names */
const STORES = {
    ASSETS: 'assets',
    METADATA: 'metadata',
    THUMBNAILS: 'thumbnails'
} as const;

/** Local storage key for manifest (fallback) */
const MANIFEST_KEY = 'modelrailway_asset_library';

/** Thumbnail generation settings */
const THUMBNAIL_CONFIG = {
    WIDTH: 128,
    HEIGHT: 128,
    FORMAT: 'image/png'
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Stored asset record in IndexedDB
 */
interface StoredAsset {
    id: string;
    data: ArrayBuffer;
    mimeType: string;
}

/**
 * Event types for library changes
 */
export type LibraryEventType =
    | 'asset-added'
    | 'asset-removed'
    | 'library-loaded'
    | 'library-cleared';

/**
 * Library change event
 */
export interface LibraryEvent {
    type: LibraryEventType;
    assetId?: string;
    category?: RollingStockCategory;
}

/**
 * Library event listener callback
 */
export type LibraryEventListener = (event: LibraryEvent) => void;

// ============================================================================
// ASSET LIBRARY MANAGER CLASS
// ============================================================================

/**
 * AssetLibraryManager - Singleton manager for persistent asset storage
 * 
 * @example
 * ```typescript
 * const manager = AssetLibraryManager.getInstance();
 * await manager.initialize();
 * 
 * // Import a new asset
 * const result = await manager.importAsset({
 *     file: glbFile,
 *     category: 'trains',
 *     name: 'BR Class 66',
 *     scaling: { mode: 'reference', referenceLengthMm: 230 }
 * });
 * 
 * // Get assets by category
 * const trains = manager.getAssetsByCategory('trains');
 * ```
 */
export class AssetLibraryManager {
    // ========================================================================
    // SINGLETON PATTERN
    // ========================================================================

    private static instance: AssetLibraryManager | null = null;

    /**
     * Get the singleton instance
     */
    public static getInstance(): AssetLibraryManager {
        if (!AssetLibraryManager.instance) {
            AssetLibraryManager.instance = new AssetLibraryManager();
        }
        return AssetLibraryManager.instance;
    }

    // ========================================================================
    // PRIVATE MEMBERS
    // ========================================================================

    /** IndexedDB database reference */
    private db: IDBDatabase | null = null;

    /** In-memory library manifest */
    private library: AssetLibrary;

    /** Whether the manager has been initialized */
    private initialized: boolean = false;

    /** Event listeners */
    private listeners: Set<LibraryEventListener> = new Set();

    /** Whether IndexedDB is available */
    private useIndexedDB: boolean = true;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    private constructor() {
        // Initialize with default empty library
        this.library = {
            schemaVersion: '1.0.0',
            lastModified: new Date().toISOString(),
            assets: {},
            categoryIndex: {
                trains: [],
                carriages: [],
                freight: []
            }
        };
        console.log('[AssetLibraryManager] Instance created');
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the asset library manager
     * Opens IndexedDB and loads existing library data
     * 
     * @returns Promise that resolves when initialization is complete
     */
    public async initialize(): Promise<void> {
        if (this.initialized) {
            console.log('[AssetLibraryManager] Already initialized');
            return;
        }

        console.log('[AssetLibraryManager] Initializing...');

        try {
            // Try to open IndexedDB
            await this.openDatabase();
            console.log('[AssetLibraryManager] IndexedDB opened successfully');
        } catch (error) {
            console.warn('[AssetLibraryManager] IndexedDB not available, using localStorage fallback:', error);
            this.useIndexedDB = false;
        }

        // Load existing library manifest
        await this.loadLibrary();

        this.initialized = true;
        this.emit({ type: 'library-loaded' });
        console.log('[AssetLibraryManager] Initialized with', Object.keys(this.library.assets).length, 'assets');
    }

    /**
     * Open IndexedDB database
     */
    private openDatabase(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Check if IndexedDB is available
            if (!window.indexedDB) {
                reject(new Error('IndexedDB not supported'));
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('[AssetLibraryManager] Failed to open database:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('[AssetLibraryManager] Database opened');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                console.log('[AssetLibraryManager] Database upgrade needed');
                const db = (event.target as IDBOpenDBRequest).result;

                // Create object stores
                if (!db.objectStoreNames.contains(STORES.ASSETS)) {
                    db.createObjectStore(STORES.ASSETS, { keyPath: 'id' });
                    console.log('[AssetLibraryManager] Created assets store');
                }

                if (!db.objectStoreNames.contains(STORES.METADATA)) {
                    db.createObjectStore(STORES.METADATA, { keyPath: 'key' });
                    console.log('[AssetLibraryManager] Created metadata store');
                }

                if (!db.objectStoreNames.contains(STORES.THUMBNAILS)) {
                    db.createObjectStore(STORES.THUMBNAILS, { keyPath: 'id' });
                    console.log('[AssetLibraryManager] Created thumbnails store');
                }
            };
        });
    }

    /**
     * Load library manifest from storage
     */
    private async loadLibrary(): Promise<void> {
        try {
            if (this.useIndexedDB && this.db) {
                // Load from IndexedDB
                const manifest = await this.getFromStore<{ key: string; value: AssetLibrary }>(
                    STORES.METADATA,
                    'library_manifest'
                );
                if (manifest) {
                    this.library = manifest.value;
                    console.log('[AssetLibraryManager] Loaded library from IndexedDB');
                }
            } else {
                // Fallback to localStorage
                const stored = localStorage.getItem(MANIFEST_KEY);
                if (stored) {
                    this.library = JSON.parse(stored);
                    console.log('[AssetLibraryManager] Loaded library from localStorage');
                }
            }
        } catch (error) {
            console.error('[AssetLibraryManager] Error loading library:', error);
            // Keep default empty library
        }
    }

    /**
     * Save library manifest to storage
     */
    private async saveLibrary(): Promise<void> {
        this.library.lastModified = new Date().toISOString();

        try {
            if (this.useIndexedDB && this.db) {
                // Save to IndexedDB
                await this.putToStore(STORES.METADATA, {
                    key: 'library_manifest',
                    value: this.library
                });
                console.log('[AssetLibraryManager] Saved library to IndexedDB');
            } else {
                // Fallback to localStorage
                localStorage.setItem(MANIFEST_KEY, JSON.stringify(this.library));
                console.log('[AssetLibraryManager] Saved library to localStorage');
            }
        } catch (error) {
            console.error('[AssetLibraryManager] Error saving library:', error);
            throw error;
        }
    }

    // ========================================================================
    // INDEXEDDB HELPERS
    // ========================================================================

    /**
     * Get a record from an object store
     */
    private getFromStore<T>(storeName: string, key: string): Promise<T | undefined> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not open'));
                return;
            }

            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result as T | undefined);
        });
    }

    /**
     * Put a record into an object store
     */
    private putToStore<T>(storeName: string, data: T): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not open'));
                return;
            }

            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    /**
     * Delete a record from an object store
     */
    private deleteFromStore(storeName: string, key: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not open'));
                return;
            }

            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    // ========================================================================
    // ASSET IMPORT
    // ========================================================================

    /**
     * Import a new asset into the library
     * 
     * @param options - Import options including file, category, and scaling
     * @returns Promise with import result
     */
    public async importAsset(options: AssetImportOptions): Promise<AssetImportResult> {
        console.log('[AssetLibraryManager] Importing asset:', options.file.name);

        try {
            // Validate file type
            const validExtensions = ['.glb', '.gltf'];
            const extension = options.file.name.toLowerCase().slice(options.file.name.lastIndexOf('.'));
            if (!validExtensions.includes(extension)) {
                return {
                    success: false,
                    error: `Invalid file type. Supported formats: ${validExtensions.join(', ')}`
                };
            }

            // Generate unique ID
            const assetId = this.generateAssetId();

            // Read file data
            const fileData = await this.readFileAsArrayBuffer(options.file);

            // Create metadata
            const metadata: AssetMetadata = {
                id: assetId,
                name: options.name || this.cleanFilename(options.file.name),
                originalFilename: options.file.name,
                category: options.category,
                filePath: `${options.category}/${assetId}${extension}`,
                scaling: {
                    mode: options.scaling.mode,
                    scaleFactor: options.scaling.scaleFactor,
                    referenceLengthMm: options.scaling.referenceLengthMm
                },
                fileSize: options.file.size,
                importedAt: new Date().toISOString(),
                usageCount: 0,
                description: options.description,
                tags: options.tags
            };

            // Store asset data
            if (this.useIndexedDB && this.db) {
                await this.putToStore(STORES.ASSETS, {
                    id: assetId,
                    data: fileData,
                    mimeType: options.file.type || 'model/gltf-binary'
                });
            } else {
                // For localStorage fallback, store as base64
                // Note: This has size limitations
                const base64 = this.arrayBufferToBase64(fileData);
                localStorage.setItem(`asset_${assetId}`, base64);
            }

            // Update library manifest
            this.library.assets[assetId] = metadata;
            this.library.categoryIndex[options.category].push(assetId);

            // Save manifest
            await this.saveLibrary();

            // Emit event
            this.emit({
                type: 'asset-added',
                assetId,
                category: options.category
            });

            console.log('[AssetLibraryManager] Asset imported successfully:', assetId);

            return {
                success: true,
                assetId
            };

        } catch (error) {
            console.error('[AssetLibraryManager] Import failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error during import'
            };
        }
    }

    /**
     * Read a File object as ArrayBuffer
     */
    private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Convert ArrayBuffer to Base64 string
     */
    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Convert Base64 string to ArrayBuffer
     */
    private base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * Generate a unique asset ID
     */
    private generateAssetId(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `asset_${timestamp}_${random}`;
    }

    /**
     * Clean filename to use as display name
     */
    private cleanFilename(filename: string): string {
        // Remove extension
        const withoutExt = filename.replace(/\.[^/.]+$/, '');
        // Replace underscores and hyphens with spaces
        const cleaned = withoutExt.replace(/[_-]/g, ' ');
        // Capitalize first letter of each word
        return cleaned.replace(/\b\w/g, l => l.toUpperCase());
    }

    // ========================================================================
    // ASSET RETRIEVAL
    // ========================================================================

    /**
     * Get all assets in a category
     * 
     * @param category - Rolling stock category
     * @returns Array of asset metadata
     */
    public getAssetsByCategory(category: RollingStockCategory): AssetMetadata[] {
        const assetIds = this.library.categoryIndex[category] || [];
        return assetIds
            .map(id => this.library.assets[id])
            .filter(Boolean);
    }

    /**
     * Get asset metadata by ID
     * 
     * @param assetId - Asset ID
     * @returns Asset metadata or undefined
     */
    public getAssetMetadata(assetId: string): AssetMetadata | undefined {
        return this.library.assets[assetId];
    }

    /**
     * Get asset binary data by ID
     * 
     * @param assetId - Asset ID
     * @returns ArrayBuffer containing asset data
     */
    public async getAssetData(assetId: string): Promise<ArrayBuffer | undefined> {
        try {
            if (this.useIndexedDB && this.db) {
                const stored = await this.getFromStore<StoredAsset>(STORES.ASSETS, assetId);
                return stored?.data;
            } else {
                const base64 = localStorage.getItem(`asset_${assetId}`);
                if (base64) {
                    return this.base64ToArrayBuffer(base64);
                }
            }
        } catch (error) {
            console.error('[AssetLibraryManager] Error getting asset data:', error);
        }
        return undefined;
    }

    /**
     * Get asset data as a Blob URL for loading
     * 
     * @param assetId - Asset ID
     * @returns Blob URL string or undefined
     */
    public async getAssetBlobUrl(assetId: string): Promise<string | undefined> {
        const data = await this.getAssetData(assetId);
        if (data) {
            const blob = new Blob([data], { type: 'model/gltf-binary' });
            return URL.createObjectURL(blob);
        }
        return undefined;
    }

    /**
     * Get all assets
     */
    public getAllAssets(): AssetMetadata[] {
        return Object.values(this.library.assets);
    }

    /**
     * Get total asset count
     */
    public getAssetCount(): number {
        return Object.keys(this.library.assets).length;
    }

    /**
     * Get asset count by category
     */
    public getAssetCountByCategory(category: RollingStockCategory): number {
        return this.library.categoryIndex[category]?.length || 0;
    }

    // ========================================================================
    // ASSET REMOVAL
    // ========================================================================

    /**
     * Remove an asset from the library
     * 
     * @param assetId - Asset ID to remove
     * @returns Promise that resolves to true if successful
     */
    public async removeAsset(assetId: string): Promise<boolean> {
        console.log('[AssetLibraryManager] Removing asset:', assetId);

        const metadata = this.library.assets[assetId];
        if (!metadata) {
            console.warn('[AssetLibraryManager] Asset not found:', assetId);
            return false;
        }

        try {
            // Remove binary data
            if (this.useIndexedDB && this.db) {
                await this.deleteFromStore(STORES.ASSETS, assetId);
                await this.deleteFromStore(STORES.THUMBNAILS, assetId);
            } else {
                localStorage.removeItem(`asset_${assetId}`);
                localStorage.removeItem(`thumbnail_${assetId}`);
            }

            // Update manifest
            const category = metadata.category;
            delete this.library.assets[assetId];
            this.library.categoryIndex[category] = this.library.categoryIndex[category]
                .filter(id => id !== assetId);

            // Save manifest
            await this.saveLibrary();

            // Emit event
            this.emit({
                type: 'asset-removed',
                assetId,
                category
            });

            console.log('[AssetLibraryManager] Asset removed successfully');
            return true;

        } catch (error) {
            console.error('[AssetLibraryManager] Error removing asset:', error);
            return false;
        }
    }

    /**
     * Clear all assets from the library
     * 
     * @returns Promise that resolves when complete
     */
    public async clearLibrary(): Promise<void> {
        console.log('[AssetLibraryManager] Clearing all assets...');

        try {
            if (this.useIndexedDB && this.db) {
                // Clear all stores
                await this.clearStore(STORES.ASSETS);
                await this.clearStore(STORES.THUMBNAILS);
            } else {
                // Clear localStorage assets
                const keysToRemove: string[] = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key?.startsWith('asset_') || key?.startsWith('thumbnail_')) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(key => localStorage.removeItem(key));
            }

            // Reset manifest
            this.library = {
                schemaVersion: '1.0.0',
                lastModified: new Date().toISOString(),
                assets: {},
                categoryIndex: {
                    trains: [],
                    carriages: [],
                    freight: []
                }
            };

            await this.saveLibrary();
            this.emit({ type: 'library-cleared' });

            console.log('[AssetLibraryManager] Library cleared');

        } catch (error) {
            console.error('[AssetLibraryManager] Error clearing library:', error);
            throw error;
        }
    }

    /**
     * Clear an IndexedDB object store
     */
    private clearStore(storeName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not open'));
                return;
            }

            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    // ========================================================================
    // ASSET UPDATE
    // ========================================================================

    /**
     * Update asset metadata
     * 
     * @param assetId - Asset ID
     * @param updates - Partial metadata updates
     */
    public async updateAssetMetadata(
        assetId: string,
        updates: Partial<Pick<AssetMetadata, 'name' | 'description' | 'tags'>>
    ): Promise<boolean> {
        const metadata = this.library.assets[assetId];
        if (!metadata) {
            return false;
        }

        Object.assign(metadata, updates);
        await this.saveLibrary();
        return true;
    }

    /**
     * Record asset usage (increment usage count, update last used)
     */
    public async recordAssetUsage(assetId: string): Promise<void> {
        const metadata = this.library.assets[assetId];
        if (metadata) {
            metadata.usageCount++;
            metadata.lastUsedAt = new Date().toISOString();
            await this.saveLibrary();
        }
    }

    // ========================================================================
    // EVENT SYSTEM
    // ========================================================================

    /**
     * Add an event listener
     */
    public addEventListener(listener: LibraryEventListener): void {
        this.listeners.add(listener);
    }

    /**
     * Remove an event listener
     */
    public removeEventListener(listener: LibraryEventListener): void {
        this.listeners.delete(listener);
    }

    /**
     * Emit an event to all listeners
     */
    private emit(event: LibraryEvent): void {
        this.listeners.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.error('[AssetLibraryManager] Error in event listener:', error);
            }
        });
    }

    // ========================================================================
    // UTILITY
    // ========================================================================

    /**
     * Check if manager is initialized
     */
    public isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Export library manifest as JSON string
     */
    public exportManifest(): string {
        return JSON.stringify(this.library, null, 2);
    }

    /**
     * Get storage info for debugging
     */
    public getStorageInfo(): { useIndexedDB: boolean; assetCount: number; categories: Record<RollingStockCategory, number> } {
        return {
            useIndexedDB: this.useIndexedDB,
            assetCount: Object.keys(this.library.assets).length,
            categories: {
                trains: this.library.categoryIndex.trains.length,
                carriages: this.library.categoryIndex.carriages.length,
                freight: this.library.categoryIndex.freight.length
            }
        };
    }
}