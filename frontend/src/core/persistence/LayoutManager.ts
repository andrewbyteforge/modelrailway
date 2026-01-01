/**
 * LayoutManager.ts - Orchestrates layout save/load operations
 * 
 * Path: frontend/src/core/persistence/LayoutManager.ts
 * 
 * High-level manager for layout persistence:
 * - Coordinates serialization/deserialization
 * - Uses browser download/upload for file operations
 * - Manages recent files list
 * - Provides auto-save functionality
 * - Handles dirty state tracking
 * 
 * @module LayoutManager
 * @author Model Railway Workbench
 * @version 1.2.0 - Browser-only mode
 */

import { Scene } from '@babylonjs/core/scene';

import {
    LayoutSerializer,
    createLayoutSerializer
} from './LayoutSerializer';

import {
    LayoutDeserializer,
    createLayoutDeserializer,
    type DeserializationProgressCallback
} from './LayoutDeserializer';

import type {
    LayoutFile,
    LayoutSaveResult,
    LayoutLoadResult
} from '../../../../shared/types/layout.types';

import type { TrackSystem } from '../../systems/track/TrackSystem';
import type { TrackCatalog } from '../../systems/track/TrackCatalog';
import type { WorldOutliner } from '../../systems/outliner/WorldOutliner';
import type { ModelLibrary } from '../../systems/models/ModelLibrary';
import type { PlacedItemManager } from '../../systems/assets/PlacedItemManager';
import type { Project } from '../Project';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[LayoutManager]';

/** Layout file extension */
const FILE_EXTENSION = '.mrlayout';

/** Recent files storage key */
const RECENT_FILES_KEY = 'mrw_recent_files';

/** Maximum recent files to store */
const MAX_RECENT_FILES = 10;

/** Auto-save interval in milliseconds (5 minutes) */
const AUTO_SAVE_INTERVAL_MS = 5 * 60 * 1000;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Recent file entry
 */
export interface RecentFile {
    /** Full file path */
    path: string;
    /** Layout name */
    name: string;
    /** Last opened timestamp */
    lastOpened: string;
}

/**
 * Layout manager event types
 */
export type LayoutManagerEventType =
    | 'layout-saved'
    | 'layout-loaded'
    | 'layout-cleared'
    | 'dirty-changed'
    | 'save-error'
    | 'load-error';

/**
 * Layout manager event
 */
export interface LayoutManagerEvent {
    type: LayoutManagerEventType;
    filePath?: string;
    layoutName?: string;
    error?: string;
    isDirty?: boolean;
}

/**
 * Event listener callback
 */
export type LayoutManagerEventListener = (event: LayoutManagerEvent) => void;

// ============================================================================
// LAYOUT MANAGER CLASS
// ============================================================================

/**
 * LayoutManager - High-level layout persistence orchestration
 * 
 * Manages the complete save/load workflow including:
 * - Browser-based file dialogs (download/upload)
 * - Serialization coordination
 * - Recent files tracking
 * - Auto-save functionality
 * - Dirty state management
 * 
 * @example
 * ```typescript
 * const manager = new LayoutManager(scene);
 * manager.setTrackSystem(trackSystem);
 * 
 * // Save current layout
 * await manager.saveAs();
 * 
 * // Open existing layout
 * await manager.open();
 * 
 * // Quick save (if path known)
 * await manager.save();
 * ```
 */
export class LayoutManager {
    // ========================================================================
    // PRIVATE PROPERTIES
    // ========================================================================

    /** Babylon.js scene */
    private scene: Scene;

    /** Layout serializer */
    private serializer: LayoutSerializer;

    /** Layout deserializer */
    private deserializer: LayoutDeserializer;

    /** Current file path (null if new/unsaved) */
    private currentFilePath: string | null = null;

    /** Current layout name */
    private currentLayoutName: string = 'Untitled Layout';

    /** Whether layout has unsaved changes */
    private isDirty: boolean = false;

    /** Auto-save timer ID */
    private autoSaveTimer: number | null = null;

    /** Auto-save enabled */
    private autoSaveEnabled: boolean = false;

    /** Event listeners */
    private eventListeners: Map<LayoutManagerEventType, Set<LayoutManagerEventListener>> = new Map();

    /** Recent files list */
    private recentFiles: RecentFile[] = [];

    /** Project reference */
    private project: Project | null = null;

    /** Track system reference */
    private trackSystem: TrackSystem | null = null;

    /** Track catalog reference */
    private trackCatalog: TrackCatalog | null = null;

    /** World Outliner reference */
    private worldOutliner: WorldOutliner | null = null;

    /** Model library reference */
    private modelLibrary: ModelLibrary | null = null;

    /** Placed item manager reference */
    private placedItemManager: PlacedItemManager | null = null;

    /** Pending file for browser open */
    private pendingFile: File | null = null;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new LayoutManager
     * @param scene - Babylon.js scene
     */
    constructor(scene: Scene) {
        this.scene = scene;
        this.serializer = createLayoutSerializer(scene);
        this.deserializer = createLayoutDeserializer(scene);

        // Load recent files from storage
        this.loadRecentFiles();

        console.log(`${LOG_PREFIX} LayoutManager initialized (browser mode)`);
    }

    // ========================================================================
    // SYSTEM SETTERS
    // ========================================================================

    /**
     * Set the project reference
     */
    setProject(project: Project): void {
        this.project = project;
        this.serializer.setProject(project);
    }

    /**
     * Set the track system reference
     */
    setTrackSystem(trackSystem: TrackSystem): void {
        this.trackSystem = trackSystem;
        this.serializer.setTrackSystem(trackSystem);
        this.deserializer.setTrackSystem(trackSystem);
    }

    /**
     * Set the track catalog reference
     */
    setTrackCatalog(catalog: TrackCatalog): void {
        this.trackCatalog = catalog;
        this.deserializer.setTrackCatalog(catalog);
    }

    /**
     * Set the World Outliner reference
     */
    setWorldOutliner(outliner: WorldOutliner): void {
        this.worldOutliner = outliner;
        this.serializer.setWorldOutliner(outliner);
        this.deserializer.setWorldOutliner(outliner);
    }

    /**
     * Set the model library reference
     */
    setModelLibrary(library: ModelLibrary): void {
        this.modelLibrary = library;
        this.serializer.setModelLibrary(library);
        this.deserializer.setModelLibrary(library);
    }

    /**
     * Set the placed item manager reference
     */
    setPlacedItemManager(manager: PlacedItemManager): void {
        this.placedItemManager = manager;
        this.serializer.setPlacedItemManager(manager);
        this.deserializer.setPlacedItemManager(manager);
    }

    // ========================================================================
    // SAVE OPERATIONS
    // ========================================================================

    /**
     * Save layout to current file path (or prompt for path)
     * @returns Save result
     */
    async save(): Promise<LayoutSaveResult> {
        if (this.currentFilePath) {
            return this.saveToPath(this.currentFilePath);
        }
        return this.saveAs();
    }

    /**
     * Save layout with file dialog prompt
     * @returns Save result
     */
    async saveAs(): Promise<LayoutSaveResult> {
        try {
            console.log(`${LOG_PREFIX} Opening save dialog...`);

            // Get file name from user
            const fileName = await this.showSaveDialog();

            if (!fileName) {
                return {
                    success: false,
                    error: 'Save cancelled by user',
                    filePath: ''
                };
            }

            return this.saveToPath(fileName);

        } catch (error) {
            console.error(`${LOG_PREFIX} Save dialog error:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                filePath: ''
            };
        }
    }

    /**
     * Save layout to a specific path
     * @param filePath - Path to save to
     * @returns Save result
     */
    async saveToPath(filePath: string): Promise<LayoutSaveResult> {
        try {
            console.log(`${LOG_PREFIX} Saving to: ${filePath}`);

            // Ensure file extension
            const normalizedPath = this.ensureExtension(filePath);

            // Extract layout name from path
            const layoutName = this.extractLayoutName(normalizedPath);

            // Serialize the layout
            const layoutData = this.serializer.serialize(layoutName);

            // Convert to JSON
            const json = JSON.stringify(layoutData, null, 2);

            // Download file
            this.downloadFile(normalizedPath, json);

            // Update state
            this.currentFilePath = normalizedPath;
            this.currentLayoutName = layoutName;
            this.setDirty(false);

            // Update recent files
            this.addRecentFile(normalizedPath, layoutName);

            // Emit event
            this.emitEvent({
                type: 'layout-saved',
                filePath: normalizedPath,
                layoutName
            });

            console.log(`${LOG_PREFIX} Layout saved successfully: ${normalizedPath}`);

            return {
                success: true,
                filePath: normalizedPath,
                fileSizeBytes: json.length
            };

        } catch (error) {
            console.error(`${LOG_PREFIX} Save error:`, error);

            this.emitEvent({
                type: 'save-error',
                filePath,
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                filePath
            };
        }
    }

    // ========================================================================
    // LOAD OPERATIONS
    // ========================================================================

    /**
     * Open layout with file dialog
     * @param onProgress - Optional progress callback
     * @returns Load result
     */
    async open(onProgress?: DeserializationProgressCallback): Promise<LayoutLoadResult> {
        try {
            console.log(`${LOG_PREFIX} Opening load dialog...`);

            // Check for unsaved changes
            if (this.isDirty) {
                const confirmed = await this.confirmDiscardChanges();
                if (!confirmed) {
                    return {
                        success: false,
                        error: 'Load cancelled - unsaved changes',
                        filePath: '',
                        warnings: []
                    };
                }
            }

            // Show file picker and get file
            const file = await this.showOpenDialog();

            if (!file) {
                return {
                    success: false,
                    error: 'Load cancelled by user',
                    filePath: '',
                    warnings: []
                };
            }

            // Read and load the file
            const json = await file.text();
            return this.loadFromJson(json, file.name, onProgress);

        } catch (error) {
            console.error(`${LOG_PREFIX} Open dialog error:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                filePath: '',
                warnings: []
            };
        }
    }

    /**
     * Load layout from JSON string
     * @param json - JSON content
     * @param filePath - File name/path for reference
     * @param onProgress - Optional progress callback
     * @returns Load result
     */
    async loadFromJson(
        json: string,
        filePath: string,
        onProgress?: DeserializationProgressCallback
    ): Promise<LayoutLoadResult> {
        try {
            console.log(`${LOG_PREFIX} Loading: ${filePath}`);

            // Parse JSON
            let layoutData: LayoutFile;
            try {
                layoutData = JSON.parse(json);
            } catch (parseError) {
                return {
                    success: false,
                    error: 'Invalid layout file: JSON parse error',
                    filePath,
                    warnings: []
                };
            }

            // Validate
            const validation = this.deserializer.validate(layoutData);
            if (!validation.isValid) {
                return {
                    success: false,
                    error: `Validation failed: ${validation.errors.join(', ')}`,
                    filePath,
                    warnings: validation.warnings
                };
            }

            // Deserialize
            const result = await this.deserializer.deserialize(layoutData, onProgress);

            if (!result.success) {
                this.emitEvent({
                    type: 'load-error',
                    filePath,
                    error: result.error
                });

                return {
                    success: false,
                    error: result.error,
                    filePath,
                    warnings: result.warnings
                };
            }

            // Update state
            this.currentFilePath = filePath;
            this.currentLayoutName = layoutData.project.name;
            this.setDirty(false);

            // Update recent files
            this.addRecentFile(filePath, layoutData.project.name);

            // Emit event
            this.emitEvent({
                type: 'layout-loaded',
                filePath,
                layoutName: layoutData.project.name
            });

            console.log(`${LOG_PREFIX} Layout loaded successfully: ${filePath}`);

            return {
                success: true,
                layout: layoutData,
                filePath,
                warnings: result.warnings
            };

        } catch (error) {
            console.error(`${LOG_PREFIX} Load error:`, error);

            this.emitEvent({
                type: 'load-error',
                filePath,
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                filePath,
                warnings: []
            };
        }
    }

    /**
     * Load layout from a specific path (for recent files)
     * Note: In browser mode, this shows a file picker pre-filtered
     * @param filePath - Path hint (used for name matching)
     * @param onProgress - Optional progress callback
     * @returns Load result
     */
    async loadFromPath(
        filePath: string,
        onProgress?: DeserializationProgressCallback
    ): Promise<LayoutLoadResult> {
        // In browser mode, we can't access files by path
        // Show the open dialog instead
        console.log(`${LOG_PREFIX} loadFromPath called - showing file picker for: ${filePath}`);
        return this.open(onProgress);
    }

    /**
     * Load a recent file
     * @param recentFile - Recent file entry to load
     * @param onProgress - Optional progress callback
     * @returns Load result
     */
    async loadRecent(
        recentFile: RecentFile,
        onProgress?: DeserializationProgressCallback
    ): Promise<LayoutLoadResult> {
        // Show message about browser limitation
        console.log(`${LOG_PREFIX} Opening recent: ${recentFile.name}`);
        alert(`Please select "${recentFile.name}" from the file picker.\n\n(Browser security prevents automatic file access)`);
        return this.open(onProgress);
    }

    // ========================================================================
    // NEW LAYOUT
    // ========================================================================

    /**
     * Create a new empty layout
     * @returns Whether new layout was created
     */
    async newLayout(): Promise<boolean> {
        try {
            // Check for unsaved changes
            if (this.isDirty) {
                const confirmed = await this.confirmDiscardChanges();
                if (!confirmed) {
                    return false;
                }
            }

            console.log(`${LOG_PREFIX} Creating new layout...`);

            // Clear existing layout
            if (this.trackSystem) {
                (this.trackSystem as any).clearAll?.();
            }

            if (this.placedItemManager) {
                (this.placedItemManager as any).clear?.();
            }

            if (this.worldOutliner) {
                (this.worldOutliner as any).clearItems?.();
            }

            // Reset state
            this.currentFilePath = null;
            this.currentLayoutName = 'Untitled Layout';
            this.setDirty(false);

            // Emit event
            this.emitEvent({
                type: 'layout-cleared'
            });

            console.log(`${LOG_PREFIX} New layout created`);

            return true;

        } catch (error) {
            console.error(`${LOG_PREFIX} Error creating new layout:`, error);
            return false;
        }
    }

    // ========================================================================
    // FILE DIALOG METHODS (Browser-based)
    // ========================================================================

    /**
     * Show save file dialog (browser prompt)
     * @returns File name or null if cancelled
     */
    private async showSaveDialog(): Promise<string | null> {
        const name = prompt('Enter layout name:', this.currentLayoutName);
        if (!name || name.trim() === '') {
            return null;
        }
        return name.trim() + FILE_EXTENSION;
    }

    /**
     * Show open file dialog (browser file input)
     * @returns Selected File or null if cancelled
     */
    private showOpenDialog(): Promise<File | null> {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.mrlayout,.json';
            input.style.display = 'none';

            input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                document.body.removeChild(input);
                resolve(file || null);
            };

            // Handle cancel - use a timeout since there's no reliable cancel event
            input.addEventListener('cancel', () => {
                document.body.removeChild(input);
                resolve(null);
            });

            // Fallback for browsers that don't fire cancel
            const checkClosed = () => {
                setTimeout(() => {
                    if (!input.files?.length && document.body.contains(input)) {
                        // User likely cancelled
                    }
                }, 500);
            };

            document.body.appendChild(input);
            input.click();
            checkClosed();
        });
    }

    // ========================================================================
    // FILE I/O METHODS (Browser-based)
    // ========================================================================

    /**
     * Download content as file
     * @param fileName - File name
     * @param content - Content to save
     */
    private downloadFile(fileName: string, content: string): void {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.style.display = 'none';

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Clean up blob URL after a short delay
        setTimeout(() => URL.revokeObjectURL(url), 100);

        console.log(`${LOG_PREFIX} File downloaded: ${fileName}`);
    }

    // ========================================================================
    // DIRTY STATE MANAGEMENT
    // ========================================================================

    /**
     * Mark the layout as having unsaved changes
     */
    markDirty(): void {
        this.setDirty(true);
    }

    /**
     * Check if layout has unsaved changes
     */
    getIsDirty(): boolean {
        return this.isDirty;
    }

    /**
     * Set dirty state and emit event
     */
    private setDirty(dirty: boolean): void {
        if (this.isDirty !== dirty) {
            this.isDirty = dirty;
            this.emitEvent({
                type: 'dirty-changed',
                isDirty: dirty
            });
        }
    }

    /**
     * Confirm discarding unsaved changes
     */
    private async confirmDiscardChanges(): Promise<boolean> {
        return confirm('You have unsaved changes. Do you want to discard them?');
    }

    // ========================================================================
    // AUTO-SAVE
    // ========================================================================

    /**
     * Enable auto-save functionality
     * Note: In browser mode, auto-save triggers download
     * @param intervalMs - Save interval in milliseconds (default: 5 minutes)
     */
    enableAutoSave(intervalMs: number = AUTO_SAVE_INTERVAL_MS): void {
        this.disableAutoSave();
        this.autoSaveEnabled = true;

        this.autoSaveTimer = window.setInterval(() => {
            if (this.isDirty && this.currentFilePath) {
                console.log(`${LOG_PREFIX} Auto-saving...`);
                this.save();
            }
        }, intervalMs);

        console.log(`${LOG_PREFIX} Auto-save enabled (${intervalMs}ms interval)`);
    }

    /**
     * Disable auto-save functionality
     */
    disableAutoSave(): void {
        if (this.autoSaveTimer !== null) {
            window.clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
        this.autoSaveEnabled = false;
        console.log(`${LOG_PREFIX} Auto-save disabled`);
    }

    /**
     * Check if auto-save is enabled
     */
    isAutoSaveEnabled(): boolean {
        return this.autoSaveEnabled;
    }

    // ========================================================================
    // RECENT FILES
    // ========================================================================

    /**
     * Get list of recent files
     */
    getRecentFiles(): RecentFile[] {
        return [...this.recentFiles];
    }

    /**
     * Clear recent files list
     */
    clearRecentFiles(): void {
        this.recentFiles = [];
        this.saveRecentFiles();
    }

    /**
     * Add file to recent files list
     */
    private addRecentFile(path: string, name: string): void {
        // Remove existing entry for this path
        this.recentFiles = this.recentFiles.filter(f => f.path !== path);

        // Add to front of list
        this.recentFiles.unshift({
            path,
            name,
            lastOpened: new Date().toISOString()
        });

        // Trim to max size
        if (this.recentFiles.length > MAX_RECENT_FILES) {
            this.recentFiles = this.recentFiles.slice(0, MAX_RECENT_FILES);
        }

        // Persist
        this.saveRecentFiles();
    }

    /**
     * Load recent files from storage
     */
    private loadRecentFiles(): void {
        try {
            const stored = localStorage.getItem(RECENT_FILES_KEY);
            if (stored) {
                this.recentFiles = JSON.parse(stored);
            }
        } catch (error) {
            console.warn(`${LOG_PREFIX} Error loading recent files:`, error);
            this.recentFiles = [];
        }
    }

    /**
     * Save recent files to storage
     */
    private saveRecentFiles(): void {
        try {
            localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(this.recentFiles));
        } catch (error) {
            console.warn(`${LOG_PREFIX} Error saving recent files:`, error);
        }
    }

    // ========================================================================
    // EVENT HANDLING
    // ========================================================================

    /**
     * Add event listener
     */
    addEventListener(type: LayoutManagerEventType, listener: LayoutManagerEventListener): void {
        if (!this.eventListeners.has(type)) {
            this.eventListeners.set(type, new Set());
        }
        this.eventListeners.get(type)!.add(listener);
    }

    /**
     * Remove event listener
     */
    removeEventListener(type: LayoutManagerEventType, listener: LayoutManagerEventListener): void {
        this.eventListeners.get(type)?.delete(listener);
    }

    /**
     * Emit event to listeners
     */
    private emitEvent(event: LayoutManagerEvent): void {
        const listeners = this.eventListeners.get(event.type);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(event);
                } catch (error) {
                    console.error(`${LOG_PREFIX} Event listener error:`, error);
                }
            });
        }
    }

    // ========================================================================
    // GETTERS
    // ========================================================================

    /**
     * Get current file path
     */
    getCurrentFilePath(): string | null {
        return this.currentFilePath;
    }

    /**
     * Get current layout name
     */
    getCurrentLayoutName(): string {
        return this.currentLayoutName;
    }

    /**
     * Get display title for window (includes dirty indicator)
     */
    getWindowTitle(): string {
        const dirtyIndicator = this.isDirty ? '• ' : '';
        const fileName = this.currentFilePath ?
            this.extractFileName(this.currentFilePath) :
            'Untitled';
        return `${dirtyIndicator}${fileName} - Model Railway Workbench`;
    }

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

    /**
     * Ensure file path has correct extension
     */
    private ensureExtension(path: string): string {
        if (!path.toLowerCase().endsWith(FILE_EXTENSION)) {
            return path + FILE_EXTENSION;
        }
        return path;
    }

    /**
     * Extract layout name from file path
     */
    private extractLayoutName(path: string): string {
        const fileName = this.extractFileName(path);
        return fileName.replace(FILE_EXTENSION, '');
    }

    /**
     * Extract file name from path
     */
    private extractFileName(path: string): string {
        // Handle both forward and back slashes
        const parts = path.replace(/\\/g, '/').split('/');
        return parts[parts.length - 1] || 'Untitled';
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Dispose of the layout manager
     */
    dispose(): void {
        this.disableAutoSave();
        this.eventListeners.clear();
        console.log(`${LOG_PREFIX} LayoutManager disposed`);
    }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new LayoutManager instance
 * @param scene - Babylon.js scene
 * @returns LayoutManager instance
 */
export function createLayoutManager(scene: Scene): LayoutManager {
    return new LayoutManager(scene);
}