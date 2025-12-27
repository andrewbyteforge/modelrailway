/**
 * ModelLibrary.ts - Storage and management of imported 3D models
 * 
 * Path: frontend/src/systems/models/ModelLibrary.ts
 * 
 * Manages:
 * - Imported model metadata and registration
 * - Model categorization and tagging
 * - Scale presets and saved configurations
 * - Model search and filtering
 * - Persistence to library.json
 * 
 * @module ModelLibrary
 * @author Model Railway Workbench
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Model category for organization
 */
export type ModelCategory =
    | 'buildings'       // Stations, houses, factories, shops
    | 'rolling_stock'   // Locomotives, coaches, wagons
    | 'scenery'         // Trees, bushes, rocks, grass
    | 'infrastructure'  // Platforms, bridges, signals, fences
    | 'vehicles'        // Cars, trucks, buses
    | 'figures'         // People, animals
    | 'accessories'     // Benches, lamps, bins
    | 'custom';         // User-defined

/**
 * Scale preset information saved with the model
 */
export interface ModelScalePreset {
    /** Descriptive name for this preset */
    name: string;
    /** Scale factor to apply */
    scaleFactor: number;
    /** Real-world height this represents (meters) */
    realWorldHeightM?: number;
    /** Real-world width this represents (meters) */
    realWorldWidthM?: number;
    /** Real-world depth this represents (meters) */
    realWorldDepthM?: number;
    /** Whether this is the default preset */
    isDefault: boolean;
}

/**
 * Original dimensions of the imported model
 */
export interface OriginalDimensions {
    /** Width in original model units */
    width: number;
    /** Height in original model units */
    height: number;
    /** Depth in original model units */
    depth: number;
    /** Unit of measurement (if known) */
    unit?: 'meters' | 'millimeters' | 'centimeters' | 'inches' | 'unknown';
}

/**
 * Import metadata
 */
export interface ImportMetadata {
    /** Original filename */
    originalFilename: string;
    /** File size in bytes */
    fileSizeBytes: number;
    /** Import date/time (ISO string) */
    importedAt: string;
    /** File format */
    format: 'glb' | 'gltf';
    /** Source URL if downloaded */
    sourceUrl?: string;
    /** Attribution/license info */
    attribution?: string;
}

/**
 * Complete library entry for an imported model
 */
export interface ModelLibraryEntry {
    /** Unique identifier */
    id: string;
    /** Display name */
    name: string;
    /** Description */
    description: string;
    /** Category */
    category: ModelCategory;
    /** Tags for searching */
    tags: string[];
    /** Path to the model file (relative to project) */
    filePath: string;
    /** Path to thumbnail image (if generated) */
    thumbnailPath?: string;
    /** Original dimensions from import */
    originalDimensions: OriginalDimensions;
    /** Scale presets */
    scalePresets: ModelScalePreset[];
    /** Currently active scale preset name */
    activePresetName: string;
    /** Import metadata */
    importMetadata: ImportMetadata;
    /** Whether model is marked as favorite */
    isFavorite: boolean;
    /** Usage count (how many times placed) */
    usageCount: number;
    /** Last used date (ISO string) */
    lastUsedAt?: string;
}

/**
 * Library statistics
 */
export interface LibraryStats {
    totalModels: number;
    byCategory: Record<ModelCategory, number>;
    totalSizeBytes: number;
    favoritesCount: number;
}

/**
 * Filter options for querying the library
 */
export interface LibraryFilter {
    category?: ModelCategory;
    tags?: string[];
    searchText?: string;
    favoritesOnly?: boolean;
    sortBy?: 'name' | 'dateImported' | 'lastUsed' | 'usageCount';
    sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// MODEL LIBRARY CLASS
// ============================================================================

/**
 * ModelLibrary - Manages imported model storage and metadata
 * 
 * @example
 * ```typescript
 * const library = ModelLibrary.getInstance();
 * library.addModel(entry);
 * const buildings = library.getByCategory('buildings');
 * ```
 */
export class ModelLibrary {
    // ========================================================================
    // SINGLETON PATTERN
    // ========================================================================

    /** Singleton instance */
    private static instance: ModelLibrary | null = null;

    /** Model entries indexed by ID */
    private models: Map<string, ModelLibraryEntry> = new Map();

    /** Counter for generating unique IDs */
    private nextId: number = 1;

    /** Callbacks for library changes */
    private changeListeners: Array<() => void> = [];

    /**
     * Get the singleton instance
     */
    static getInstance(): ModelLibrary {
        if (!ModelLibrary.instance) {
            ModelLibrary.instance = new ModelLibrary();
        }
        return ModelLibrary.instance;
    }

    /**
     * Private constructor for singleton
     */
    private constructor() {
        console.log('[ModelLibrary] Initialized');
    }

    // ========================================================================
    // MODEL MANAGEMENT
    // ========================================================================

    /**
     * Generate a unique model ID
     * @returns Unique ID string
     */
    generateId(): string {
        const id = `model_${Date.now()}_${this.nextId++}`;
        return id;
    }

    /**
     * Add a new model to the library
     * @param entry - Model entry to add
     * @returns The added entry with generated ID if not provided
     */
    addModel(entry: Partial<ModelLibraryEntry> & {
        name: string;
        filePath: string;
        originalDimensions: OriginalDimensions;
        importMetadata: ImportMetadata;
    }): ModelLibraryEntry {
        try {
            // Generate ID if not provided
            const id = entry.id || this.generateId();

            // Create complete entry with defaults
            const completeEntry: ModelLibraryEntry = {
                id,
                name: entry.name,
                description: entry.description || '',
                category: entry.category || 'custom',
                tags: entry.tags || [],
                filePath: entry.filePath,
                thumbnailPath: entry.thumbnailPath,
                originalDimensions: entry.originalDimensions,
                scalePresets: entry.scalePresets || [{
                    name: 'Default',
                    scaleFactor: 1,
                    isDefault: true
                }],
                activePresetName: entry.activePresetName || 'Default',
                importMetadata: entry.importMetadata,
                isFavorite: entry.isFavorite || false,
                usageCount: entry.usageCount || 0,
                lastUsedAt: entry.lastUsedAt
            };

            // Store in map
            this.models.set(id, completeEntry);

            console.log(`[ModelLibrary] Added model: ${completeEntry.name} (${id})`);
            console.log(`  Category: ${completeEntry.category}`);
            console.log(`  Dimensions: ${completeEntry.originalDimensions.width.toFixed(3)} x ${completeEntry.originalDimensions.height.toFixed(3)} x ${completeEntry.originalDimensions.depth.toFixed(3)}`);

            // Notify listeners
            this.notifyChange();

            return completeEntry;

        } catch (error) {
            console.error('[ModelLibrary] Error adding model:', error);
            throw error;
        }
    }

    /**
     * Get a model by ID
     * @param id - Model ID
     * @returns Model entry or undefined
     */
    getModel(id: string): ModelLibraryEntry | undefined {
        return this.models.get(id);
    }

    /**
     * Update an existing model
     * @param id - Model ID
     * @param updates - Partial updates to apply
     * @returns Updated entry
     */
    updateModel(id: string, updates: Partial<ModelLibraryEntry>): ModelLibraryEntry | undefined {
        try {
            const existing = this.models.get(id);
            if (!existing) {
                console.warn(`[ModelLibrary] Model not found: ${id}`);
                return undefined;
            }

            const updated: ModelLibraryEntry = {
                ...existing,
                ...updates,
                id // Preserve ID
            };

            this.models.set(id, updated);
            console.log(`[ModelLibrary] Updated model: ${updated.name}`);

            this.notifyChange();

            return updated;

        } catch (error) {
            console.error('[ModelLibrary] Error updating model:', error);
            return undefined;
        }
    }

    /**
     * Remove a model from the library
     * @param id - Model ID
     * @returns True if removed
     */
    removeModel(id: string): boolean {
        const model = this.models.get(id);
        if (model) {
            this.models.delete(id);
            console.log(`[ModelLibrary] Removed model: ${model.name}`);
            this.notifyChange();
            return true;
        }
        return false;
    }

    /**
     * Mark a model as used (increments counter, updates timestamp)
     * @param id - Model ID
     */
    markAsUsed(id: string): void {
        const model = this.models.get(id);
        if (model) {
            model.usageCount++;
            model.lastUsedAt = new Date().toISOString();
            this.notifyChange();
        }
    }

    /**
     * Toggle favorite status
     * @param id - Model ID
     * @returns New favorite status
     */
    toggleFavorite(id: string): boolean {
        const model = this.models.get(id);
        if (model) {
            model.isFavorite = !model.isFavorite;
            console.log(`[ModelLibrary] ${model.name} favorite: ${model.isFavorite}`);
            this.notifyChange();
            return model.isFavorite;
        }
        return false;
    }

    // ========================================================================
    // SCALE PRESET MANAGEMENT
    // ========================================================================

    /**
     * Add a scale preset to a model
     * @param modelId - Model ID
     * @param preset - Scale preset to add
     */
    addScalePreset(modelId: string, preset: ModelScalePreset): void {
        const model = this.models.get(modelId);
        if (!model) return;

        // Remove existing preset with same name
        model.scalePresets = model.scalePresets.filter(p => p.name !== preset.name);

        // If this is default, remove default from others
        if (preset.isDefault) {
            model.scalePresets.forEach(p => p.isDefault = false);
        }

        model.scalePresets.push(preset);
        console.log(`[ModelLibrary] Added scale preset "${preset.name}" to ${model.name}`);

        this.notifyChange();
    }

    /**
     * Set the active scale preset for a model
     * @param modelId - Model ID
     * @param presetName - Name of preset to activate
     */
    setActivePreset(modelId: string, presetName: string): void {
        const model = this.models.get(modelId);
        if (!model) return;

        const preset = model.scalePresets.find(p => p.name === presetName);
        if (preset) {
            model.activePresetName = presetName;
            console.log(`[ModelLibrary] Active preset for ${model.name}: ${presetName}`);
            this.notifyChange();
        }
    }

    /**
     * Get the active scale preset for a model
     * @param modelId - Model ID
     * @returns Active preset or undefined
     */
    getActivePreset(modelId: string): ModelScalePreset | undefined {
        const model = this.models.get(modelId);
        if (!model) return undefined;

        return model.scalePresets.find(p => p.name === model.activePresetName) ||
            model.scalePresets.find(p => p.isDefault) ||
            model.scalePresets[0];
    }

    // ========================================================================
    // QUERYING
    // ========================================================================

    /**
     * Get all models
     * @returns Array of all model entries
     */
    getAllModels(): ModelLibraryEntry[] {
        return Array.from(this.models.values());
    }

    /**
     * Get models by category
     * @param category - Category to filter by
     * @returns Array of matching entries
     */
    getByCategory(category: ModelCategory): ModelLibraryEntry[] {
        return this.getAllModels().filter(m => m.category === category);
    }

    /**
     * Get models matching a filter
     * @param filter - Filter options
     * @returns Array of matching entries
     */
    query(filter: LibraryFilter): ModelLibraryEntry[] {
        let results = this.getAllModels();

        // Filter by category
        if (filter.category) {
            results = results.filter(m => m.category === filter.category);
        }

        // Filter by favorites
        if (filter.favoritesOnly) {
            results = results.filter(m => m.isFavorite);
        }

        // Filter by tags
        if (filter.tags && filter.tags.length > 0) {
            results = results.filter(m =>
                filter.tags!.some(tag => m.tags.includes(tag))
            );
        }

        // Filter by search text
        if (filter.searchText) {
            const searchLower = filter.searchText.toLowerCase();
            results = results.filter(m =>
                m.name.toLowerCase().includes(searchLower) ||
                m.description.toLowerCase().includes(searchLower) ||
                m.tags.some(t => t.toLowerCase().includes(searchLower))
            );
        }

        // Sort results
        const sortBy = filter.sortBy || 'name';
        const sortOrder = filter.sortOrder || 'asc';
        const multiplier = sortOrder === 'asc' ? 1 : -1;

        results.sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return multiplier * a.name.localeCompare(b.name);
                case 'dateImported':
                    return multiplier * a.importMetadata.importedAt.localeCompare(b.importMetadata.importedAt);
                case 'lastUsed':
                    return multiplier * (a.lastUsedAt || '').localeCompare(b.lastUsedAt || '');
                case 'usageCount':
                    return multiplier * (a.usageCount - b.usageCount);
                default:
                    return 0;
            }
        });

        return results;
    }

    /**
     * Get all unique tags in the library
     * @returns Array of unique tags
     */
    getAllTags(): string[] {
        const tags = new Set<string>();
        for (const model of this.models.values()) {
            model.tags.forEach(t => tags.add(t));
        }
        return Array.from(tags).sort();
    }

    /**
     * Get library statistics
     * @returns Library stats
     */
    getStats(): LibraryStats {
        const stats: LibraryStats = {
            totalModels: this.models.size,
            byCategory: {
                buildings: 0,
                rolling_stock: 0,
                scenery: 0,
                infrastructure: 0,
                vehicles: 0,
                figures: 0,
                accessories: 0,
                custom: 0
            },
            totalSizeBytes: 0,
            favoritesCount: 0
        };

        for (const model of this.models.values()) {
            stats.byCategory[model.category]++;
            stats.totalSizeBytes += model.importMetadata.fileSizeBytes;
            if (model.isFavorite) stats.favoritesCount++;
        }

        return stats;
    }

    // ========================================================================
    // PERSISTENCE
    // ========================================================================

    /**
     * Export library to JSON for saving
     * @returns JSON-serializable object
     */
    exportToJSON(): object {
        const entries: ModelLibraryEntry[] = this.getAllModels();

        return {
            schemaVersion: '1.0.0',
            exportedAt: new Date().toISOString(),
            modelCount: entries.length,
            models: entries
        };
    }

    /**
     * Import library from JSON
     * @param json - Previously exported JSON
     * @param merge - If true, merge with existing; if false, replace
     */
    importFromJSON(json: { models: ModelLibraryEntry[] }, merge: boolean = false): void {
        try {
            if (!merge) {
                this.models.clear();
            }

            for (const entry of json.models) {
                // Ensure valid entry
                if (entry.id && entry.name && entry.filePath) {
                    this.models.set(entry.id, entry);
                }
            }

            // Update next ID counter
            const maxId = Array.from(this.models.keys())
                .map(id => {
                    const match = id.match(/_(\d+)$/);
                    return match ? parseInt(match[1]) : 0;
                })
                .reduce((max, n) => Math.max(max, n), 0);
            this.nextId = maxId + 1;

            console.log(`[ModelLibrary] Imported ${json.models.length} models`);
            this.notifyChange();

        } catch (error) {
            console.error('[ModelLibrary] Error importing JSON:', error);
        }
    }

    // ========================================================================
    // CHANGE NOTIFICATION
    // ========================================================================

    /**
     * Register a callback for library changes
     * @param callback - Function to call on changes
     * @returns Unsubscribe function
     */
    onChange(callback: () => void): () => void {
        this.changeListeners.push(callback);
        return () => {
            const index = this.changeListeners.indexOf(callback);
            if (index >= 0) {
                this.changeListeners.splice(index, 1);
            }
        };
    }

    /**
     * Notify all listeners of a change
     */
    private notifyChange(): void {
        this.changeListeners.forEach(cb => {
            try {
                cb();
            } catch (error) {
                console.error('[ModelLibrary] Error in change listener:', error);
            }
        });
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Clear all models from the library
     */
    clear(): void {
        this.models.clear();
        this.nextId = 1;
        console.log('[ModelLibrary] Cleared');
        this.notifyChange();
    }

    /**
     * Dispose the library
     */
    dispose(): void {
        this.clear();
        this.changeListeners = [];
        ModelLibrary.instance = null;
        console.log('[ModelLibrary] Disposed');
    }
}