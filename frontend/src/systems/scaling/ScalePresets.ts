/**
 * ScalePresets.ts - Per-asset-type scale preset management
 * 
 * Path: frontend/src/systems/scaling/ScalePresets.ts
 * 
 * Manages scale presets for different asset categories:
 * - Default presets for each category
 * - User-defined custom presets
 * - Preset application and quick selection
 * - Persistence to localStorage/IndexedDB
 * 
 * @module ScalePresets
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import {
    ScalePreset,
    CategoryPresets,
    ScalableAssetCategory,
    DEFAULT_CATEGORY_PRESETS
} from '../../types/scaling.types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix for console output */
const LOG_PREFIX = '[ScalePresets]';

/** Storage key for persisted presets */
const STORAGE_KEY = 'modelrailway_scale_presets';

/** Maximum custom presets per category */
const MAX_CUSTOM_PRESETS = 10;

// ============================================================================
// SCALE PRESETS MANAGER CLASS
// ============================================================================

/**
 * ScalePresetsManager - Manages scale presets for all asset categories
 * 
 * Features:
 * - Default presets per category
 * - Custom user-defined presets
 * - Quick preset application
 * - Persistence across sessions
 * 
 * @example
 * ```typescript
 * const presets = new ScalePresetsManager();
 * await presets.initialize();
 * 
 * const buildingPresets = presets.getPresetsForCategory('building');
 * presets.applyPreset('building-background'); // Returns 0.75
 * ```
 */
export class ScalePresetsManager {
    // ========================================================================
    // PROPERTIES
    // ========================================================================

    /** Custom presets per category */
    private customPresets: Map<ScalableAssetCategory, ScalePreset[]> = new Map();

    /** Recently used preset IDs (for quick access) */
    private recentPresets: string[] = [];

    /** Maximum recent presets to track */
    private maxRecentPresets: number = 5;

    /** Whether presets have been loaded */
    private initialized: boolean = false;

    /** Event listeners for preset changes */
    private listeners: Array<(event: PresetEvent) => void> = [];

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new ScalePresetsManager
     */
    constructor() {
        console.log(`${LOG_PREFIX} Created`);
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the presets manager
     * Loads persisted custom presets from storage
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            console.warn(`${LOG_PREFIX} Already initialized`);
            return;
        }

        try {
            console.log(`${LOG_PREFIX} Initializing...`);

            // Load custom presets from storage
            await this.loadFromStorage();

            this.initialized = true;
            console.log(`${LOG_PREFIX} ✓ Initialized`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Initialization failed:`, error);
            // Continue with defaults even if loading fails
            this.initialized = true;
        }
    }

    // ========================================================================
    // PRESET RETRIEVAL
    // ========================================================================

    /**
     * Get all presets for a category (defaults + custom)
     * 
     * @param category - Asset category
     * @returns Array of presets
     */
    getPresetsForCategory(category: ScalableAssetCategory): ScalePreset[] {
        const defaults = DEFAULT_CATEGORY_PRESETS[category]?.presets || [];
        const custom = this.customPresets.get(category) || [];
        return [...defaults, ...custom];
    }

    /**
     * Get category presets with full metadata
     * 
     * @param category - Asset category
     * @returns CategoryPresets object
     */
    getCategoryPresets(category: ScalableAssetCategory): CategoryPresets {
        const defaults = DEFAULT_CATEGORY_PRESETS[category];
        const customList = this.customPresets.get(category) || [];

        return {
            category,
            defaultScale: defaults?.defaultScale || 1.0,
            defaultPivot: defaults?.defaultPivot || 'base-center',
            presets: [...(defaults?.presets || []), ...customList]
        };
    }

    /**
     * Get a specific preset by ID
     * 
     * @param presetId - Preset identifier
     * @returns Preset or undefined if not found
     */
    getPreset(presetId: string): ScalePreset | undefined {
        // Search all categories
        for (const category of Object.keys(DEFAULT_CATEGORY_PRESETS) as ScalableAssetCategory[]) {
            // Check defaults
            const defaultPreset = DEFAULT_CATEGORY_PRESETS[category]?.presets.find(
                p => p.id === presetId
            );
            if (defaultPreset) return defaultPreset;

            // Check custom
            const customPreset = this.customPresets.get(category)?.find(
                p => p.id === presetId
            );
            if (customPreset) return customPreset;
        }

        return undefined;
    }

    /**
     * Get the default scale for a category
     * 
     * @param category - Asset category
     * @returns Default scale factor
     */
    getDefaultScale(category: ScalableAssetCategory): number {
        return DEFAULT_CATEGORY_PRESETS[category]?.defaultScale || 1.0;
    }

    /**
     * Get recently used presets
     * 
     * @returns Array of recent preset IDs
     */
    getRecentPresets(): string[] {
        return [...this.recentPresets];
    }

    /**
     * Get recently used presets as full objects
     * 
     * @returns Array of recent ScalePreset objects
     */
    getRecentPresetsDetails(): ScalePreset[] {
        return this.recentPresets
            .map(id => this.getPreset(id))
            .filter((p): p is ScalePreset => p !== undefined);
    }

    // ========================================================================
    // PRESET APPLICATION
    // ========================================================================

    /**
     * Get the scale value for a preset
     * Also records it as recently used
     * 
     * @param presetId - Preset identifier
     * @returns Scale factor or undefined if preset not found
     */
    applyPreset(presetId: string): number | undefined {
        const preset = this.getPreset(presetId);
        if (!preset) {
            console.warn(`${LOG_PREFIX} Preset not found: ${presetId}`);
            return undefined;
        }

        // Record as recently used
        this.recordRecentPreset(presetId);

        // Emit event
        this.emit({
            type: 'preset-applied',
            presetId,
            scaleFactor: preset.scaleFactor
        });

        console.log(`${LOG_PREFIX} Applied preset '${preset.name}': ${preset.scaleFactor}`);
        return preset.scaleFactor;
    }

    /**
     * Record a preset as recently used
     * 
     * @param presetId - Preset identifier
     */
    private recordRecentPreset(presetId: string): void {
        // Remove if already in list
        const index = this.recentPresets.indexOf(presetId);
        if (index !== -1) {
            this.recentPresets.splice(index, 1);
        }

        // Add to front
        this.recentPresets.unshift(presetId);

        // Trim to max length
        if (this.recentPresets.length > this.maxRecentPresets) {
            this.recentPresets = this.recentPresets.slice(0, this.maxRecentPresets);
        }
    }

    // ========================================================================
    // CUSTOM PRESET MANAGEMENT
    // ========================================================================

    /**
     * Add a custom preset to a category
     * 
     * @param category - Asset category
     * @param preset - Preset to add
     * @returns Whether the preset was added
     */
    addCustomPreset(category: ScalableAssetCategory, preset: Omit<ScalePreset, 'id'>): boolean {
        try {
            // Validate
            if (!preset.name || preset.scaleFactor <= 0) {
                console.error(`${LOG_PREFIX} Invalid preset data`);
                return false;
            }

            // Check limit
            const existing = this.customPresets.get(category) || [];
            if (existing.length >= MAX_CUSTOM_PRESETS) {
                console.error(`${LOG_PREFIX} Maximum custom presets reached for ${category}`);
                return false;
            }

            // Check for duplicate name
            if (existing.some(p => p.name === preset.name)) {
                console.error(`${LOG_PREFIX} Preset name already exists: ${preset.name}`);
                return false;
            }

            // Generate ID
            const id = `custom_${category}_${Date.now()}`;

            const newPreset: ScalePreset = {
                id,
                ...preset
            };

            // Add to category
            if (!this.customPresets.has(category)) {
                this.customPresets.set(category, []);
            }
            this.customPresets.get(category)!.push(newPreset);

            // Persist
            this.saveToStorage();

            // Emit event
            this.emit({
                type: 'preset-added',
                presetId: id,
                category
            });

            console.log(`${LOG_PREFIX} Added custom preset '${preset.name}' to ${category}`);
            return true;

        } catch (error) {
            console.error(`${LOG_PREFIX} Error adding preset:`, error);
            return false;
        }
    }

    /**
     * Update an existing custom preset
     * 
     * @param presetId - Preset identifier
     * @param updates - Properties to update
     * @returns Whether the preset was updated
     */
    updateCustomPreset(presetId: string, updates: Partial<Omit<ScalePreset, 'id'>>): boolean {
        try {
            // Find the preset
            for (const [category, presets] of this.customPresets) {
                const index = presets.findIndex(p => p.id === presetId);
                if (index !== -1) {
                    // Update properties
                    presets[index] = {
                        ...presets[index],
                        ...updates
                    };

                    // Persist
                    this.saveToStorage();

                    // Emit event
                    this.emit({
                        type: 'preset-updated',
                        presetId,
                        category
                    });

                    console.log(`${LOG_PREFIX} Updated preset: ${presetId}`);
                    return true;
                }
            }

            console.warn(`${LOG_PREFIX} Custom preset not found: ${presetId}`);
            return false;

        } catch (error) {
            console.error(`${LOG_PREFIX} Error updating preset:`, error);
            return false;
        }
    }

    /**
     * Remove a custom preset
     * 
     * @param presetId - Preset identifier
     * @returns Whether the preset was removed
     */
    removeCustomPreset(presetId: string): boolean {
        try {
            // Cannot remove default presets
            for (const category of Object.keys(DEFAULT_CATEGORY_PRESETS) as ScalableAssetCategory[]) {
                if (DEFAULT_CATEGORY_PRESETS[category]?.presets.some(p => p.id === presetId)) {
                    console.error(`${LOG_PREFIX} Cannot remove default preset: ${presetId}`);
                    return false;
                }
            }

            // Find and remove from custom presets
            for (const [category, presets] of this.customPresets) {
                const index = presets.findIndex(p => p.id === presetId);
                if (index !== -1) {
                    presets.splice(index, 1);

                    // Persist
                    this.saveToStorage();

                    // Remove from recent
                    const recentIndex = this.recentPresets.indexOf(presetId);
                    if (recentIndex !== -1) {
                        this.recentPresets.splice(recentIndex, 1);
                    }

                    // Emit event
                    this.emit({
                        type: 'preset-removed',
                        presetId,
                        category
                    });

                    console.log(`${LOG_PREFIX} Removed preset: ${presetId}`);
                    return true;
                }
            }

            console.warn(`${LOG_PREFIX} Preset not found: ${presetId}`);
            return false;

        } catch (error) {
            console.error(`${LOG_PREFIX} Error removing preset:`, error);
            return false;
        }
    }

    /**
     * Check if a preset is a custom (user-defined) preset
     * 
     * @param presetId - Preset identifier
     * @returns Whether it's a custom preset
     */
    isCustomPreset(presetId: string): boolean {
        for (const presets of this.customPresets.values()) {
            if (presets.some(p => p.id === presetId)) {
                return true;
            }
        }
        return false;
    }

    // ========================================================================
    // PERSISTENCE
    // ========================================================================

    /**
     * Save custom presets to storage
     */
    private async saveToStorage(): Promise<void> {
        try {
            const data: StoredPresets = {
                version: '1.0.0',
                customPresets: {},
                recentPresets: this.recentPresets
            };

            // Convert Map to object
            for (const [category, presets] of this.customPresets) {
                data.customPresets[category] = presets;
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            console.log(`${LOG_PREFIX} Saved presets to storage`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error saving presets:`, error);
        }
    }

    /**
     * Load custom presets from storage
     */
    private async loadFromStorage(): Promise<void> {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) {
                console.log(`${LOG_PREFIX} No stored presets found`);
                return;
            }

            const data: StoredPresets = JSON.parse(stored);

            // Validate version
            if (!data.version || !data.customPresets) {
                console.warn(`${LOG_PREFIX} Invalid stored preset data`);
                return;
            }

            // Load custom presets
            for (const [category, presets] of Object.entries(data.customPresets)) {
                if (Array.isArray(presets)) {
                    this.customPresets.set(category as ScalableAssetCategory, presets);
                }
            }

            // Load recent presets
            if (Array.isArray(data.recentPresets)) {
                this.recentPresets = data.recentPresets.slice(0, this.maxRecentPresets);
            }

            console.log(`${LOG_PREFIX} Loaded presets from storage`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error loading presets:`, error);
        }
    }

    /**
     * Export all presets (for backup)
     * 
     * @returns JSON string of all presets
     */
    exportPresets(): string {
        const data: StoredPresets = {
            version: '1.0.0',
            customPresets: {},
            recentPresets: this.recentPresets
        };

        for (const [category, presets] of this.customPresets) {
            data.customPresets[category] = presets;
        }

        return JSON.stringify(data, null, 2);
    }

    /**
     * Import presets from JSON
     * 
     * @param json - JSON string of presets
     * @param merge - Whether to merge with existing (true) or replace (false)
     * @returns Whether import was successful
     */
    importPresets(json: string, merge: boolean = true): boolean {
        try {
            const data: StoredPresets = JSON.parse(json);

            if (!data.version || !data.customPresets) {
                console.error(`${LOG_PREFIX} Invalid preset import data`);
                return false;
            }

            if (!merge) {
                this.customPresets.clear();
            }

            for (const [category, presets] of Object.entries(data.customPresets)) {
                if (!Array.isArray(presets)) continue;

                const existing = this.customPresets.get(category as ScalableAssetCategory) || [];

                for (const preset of presets) {
                    // Skip duplicates
                    if (existing.some(p => p.id === preset.id || p.name === preset.name)) {
                        continue;
                    }

                    // Check limit
                    if (existing.length >= MAX_CUSTOM_PRESETS) {
                        console.warn(`${LOG_PREFIX} Skipping preset - limit reached for ${category}`);
                        continue;
                    }

                    existing.push(preset);
                }

                this.customPresets.set(category as ScalableAssetCategory, existing);
            }

            // Save
            this.saveToStorage();

            console.log(`${LOG_PREFIX} Imported presets successfully`);
            return true;

        } catch (error) {
            console.error(`${LOG_PREFIX} Error importing presets:`, error);
            return false;
        }
    }

    // ========================================================================
    // EVENTS
    // ========================================================================

    /**
     * Add an event listener
     * 
     * @param listener - Callback function
     */
    addEventListener(listener: (event: PresetEvent) => void): void {
        this.listeners.push(listener);
    }

    /**
     * Remove an event listener
     * 
     * @param listener - Callback function
     */
    removeEventListener(listener: (event: PresetEvent) => void): void {
        const index = this.listeners.indexOf(listener);
        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
    }

    /**
     * Emit an event to all listeners
     * 
     * @param event - Event to emit
     */
    private emit(event: PresetEvent): void {
        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (error) {
                console.error(`${LOG_PREFIX} Error in event listener:`, error);
            }
        }
    }

    // ========================================================================
    // DISPOSAL
    // ========================================================================

    /**
     * Clean up resources
     */
    dispose(): void {
        this.customPresets.clear();
        this.recentPresets = [];
        this.listeners = [];
        this.initialized = false;
        console.log(`${LOG_PREFIX} Disposed`);
    }
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Preset event types
 */
interface PresetEvent {
    type: 'preset-applied' | 'preset-added' | 'preset-updated' | 'preset-removed';
    presetId: string;
    category?: ScalableAssetCategory;
    scaleFactor?: number;
}

/**
 * Storage format for persisted presets
 */
interface StoredPresets {
    version: string;
    customPresets: Partial<Record<ScalableAssetCategory, ScalePreset[]>>;
    recentPresets: string[];
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/** Global presets manager instance */
let globalPresetsManager: ScalePresetsManager | null = null;

/**
 * Get the global presets manager instance
 * 
 * @returns Global ScalePresetsManager
 */
export function getGlobalPresetsManager(): ScalePresetsManager {
    if (!globalPresetsManager) {
        globalPresetsManager = new ScalePresetsManager();
    }
    return globalPresetsManager;
}

/**
 * Reset the global presets manager
 * Primarily for testing
 */
export function resetGlobalPresetsManager(): void {
    if (globalPresetsManager) {
        globalPresetsManager.dispose();
        globalPresetsManager = null;
    }
}