/**
 * LayoutDeserializer.ts - Reconstructs layout from saved data
 * 
 * Path: frontend/src/core/persistence/LayoutDeserializer.ts
 * 
 * Reconstructs the complete scene from a LayoutFile:
 * - Validates and migrates schema versions
 * - Reconstructs track pieces and graph
 * - Places rolling stock models
 * - Places scenery items
 * - Restores camera position
 * - Rebuilds World Outliner hierarchy
 * 
 * @module LayoutDeserializer
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Scene } from '@babylonjs/core/scene';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';

import type {
    LayoutFile,
    SerializedTrackPiece,
    SerializedRollingStock,
    SerializedScenery,
    SerializedCameraState,
    SerializedVector3,
    SerializedQuaternion,
    LayoutValidationResult,
    LAYOUT_SCHEMA_VERSION
} from '../../../../shared/types/layout.types';

import type { TrackSystem } from '../../systems/track/TrackSystem';
import type { TrackCatalog } from '../../systems/track/TrackCatalog';
import type { WorldOutliner } from '../../systems/outliner/WorldOutliner';
import type { ModelLibrary } from '../../systems/models/ModelLibrary';
import type { PlacedItemManager } from '../../systems/assets/PlacedItemManager';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[LayoutDeserializer]';

/** Supported schema versions for migration */
const SUPPORTED_VERSIONS = ['1.0.0'];

/** Current schema version */
const CURRENT_VERSION = '1.0.0';

// ============================================================================
// DESERIALIZATION RESULT TYPES
// ============================================================================

/**
 * Result of layout deserialization
 */
export interface DeserializationResult {
    /** Whether deserialization succeeded */
    success: boolean;
    /** Error message if failed */
    error?: string;
    /** Warnings generated during deserialization */
    warnings: string[];
    /** Statistics about what was loaded */
    stats: {
        trackPiecesLoaded: number;
        trackPiecesFailed: number;
        rollingStockLoaded: number;
        rollingStockFailed: number;
        sceneryLoaded: number;
        sceneryFailed: number;
        assetsLoaded: number;
        assetsFailed: number;
    };
}

/**
 * Progress callback for UI updates
 */
export type DeserializationProgressCallback = (
    stage: string,
    progress: number,
    message: string
) => void;

// ============================================================================
// LAYOUT DESERIALIZER CLASS
// ============================================================================

/**
 * LayoutDeserializer - Reconstructs scene from saved layout data
 * 
 * @example
 * ```typescript
 * const deserializer = new LayoutDeserializer(scene);
 * deserializer.setTrackSystem(trackSystem);
 * deserializer.setWorldOutliner(worldOutliner);
 * 
 * const result = await deserializer.deserialize(layoutData, (stage, progress, msg) => {
 *     console.log(`${stage}: ${progress}% - ${msg}`);
 * });
 * ```
 */
export class LayoutDeserializer {
    // ========================================================================
    // PRIVATE PROPERTIES
    // ========================================================================

    /** Babylon.js scene reference */
    private scene: Scene;

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

    /** Mapping of old IDs to new IDs (for ID conflicts) */
    private idMapping: Map<string, string> = new Map();

    /** Warnings collected during deserialization */
    private warnings: string[] = [];

    /** Statistics */
    private stats = {
        trackPiecesLoaded: 0,
        trackPiecesFailed: 0,
        rollingStockLoaded: 0,
        rollingStockFailed: 0,
        sceneryLoaded: 0,
        sceneryFailed: 0,
        assetsLoaded: 0,
        assetsFailed: 0
    };

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new LayoutDeserializer
     * @param scene - Babylon.js scene to reconstruct into
     */
    constructor(scene: Scene) {
        this.scene = scene;
        console.log(`${LOG_PREFIX} LayoutDeserializer created`);
    }

    // ========================================================================
    // SYSTEM SETTERS
    // ========================================================================

    /**
     * Set the track system reference
     */
    setTrackSystem(trackSystem: TrackSystem): void {
        this.trackSystem = trackSystem;
    }

    /**
     * Set the track catalog reference
     */
    setTrackCatalog(catalog: TrackCatalog): void {
        this.trackCatalog = catalog;
    }

    /**
     * Set the World Outliner reference
     */
    setWorldOutliner(outliner: WorldOutliner): void {
        this.worldOutliner = outliner;
    }

    /**
     * Set the model library reference
     */
    setModelLibrary(library: ModelLibrary): void {
        this.modelLibrary = library;
    }

    /**
     * Set the placed item manager reference
     */
    setPlacedItemManager(manager: PlacedItemManager): void {
        this.placedItemManager = manager;
    }

    // ========================================================================
    // VALIDATION
    // ========================================================================

    /**
     * Validate a layout file before loading
     * @param data - Raw layout data (possibly from JSON.parse)
     * @returns Validation result
     */
    validate(data: unknown): LayoutValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check basic structure
        if (!data || typeof data !== 'object') {
            return {
                isValid: false,
                errors: ['Layout data is not an object'],
                warnings: [],
                needsMigration: false
            };
        }

        const layout = data as Partial<LayoutFile>;

        // Check schema version
        if (!layout.schemaVersion) {
            errors.push('Missing schemaVersion field');
        } else if (!SUPPORTED_VERSIONS.includes(layout.schemaVersion)) {
            errors.push(`Unsupported schema version: ${layout.schemaVersion}`);
        }

        // Check required sections
        if (!layout.project) {
            errors.push('Missing project section');
        }

        if (!layout.baseboard) {
            errors.push('Missing baseboard section');
        }

        if (!layout.track) {
            warnings.push('Missing track section (will use empty track)');
        }

        // Validate track pieces reference valid catalog IDs
        if (layout.track?.pieces && this.trackCatalog) {
            for (const piece of layout.track.pieces) {
                if (!this.trackCatalog.getEntry(piece.catalogId)) {
                    warnings.push(`Track piece ${piece.id} references unknown catalog ID: ${piece.catalogId}`);
                }
            }
        }

        // Check for ID conflicts
        const pieceIds = new Set<string>();
        if (layout.track?.pieces) {
            for (const piece of layout.track.pieces) {
                if (pieceIds.has(piece.id)) {
                    errors.push(`Duplicate track piece ID: ${piece.id}`);
                }
                pieceIds.add(piece.id);
            }
        }

        // Determine if migration is needed
        const needsMigration = layout.schemaVersion !== CURRENT_VERSION &&
            SUPPORTED_VERSIONS.includes(layout.schemaVersion || '');

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            detectedVersion: layout.schemaVersion,
            needsMigration,
            targetVersion: needsMigration ? CURRENT_VERSION : undefined
        };
    }

    // ========================================================================
    // MAIN DESERIALIZATION
    // ========================================================================

    /**
     * Deserialize a layout file and reconstruct the scene
     * @param layout - The layout data to load
     * @param onProgress - Optional progress callback
     * @returns Deserialization result
     */
    async deserialize(
        layout: LayoutFile,
        onProgress?: DeserializationProgressCallback
    ): Promise<DeserializationResult> {
        console.log(`${LOG_PREFIX} Starting deserialization...`);

        // Reset state
        this.warnings = [];
        this.idMapping.clear();
        this.stats = {
            trackPiecesLoaded: 0,
            trackPiecesFailed: 0,
            rollingStockLoaded: 0,
            rollingStockFailed: 0,
            sceneryLoaded: 0,
            sceneryFailed: 0,
            assetsLoaded: 0,
            assetsFailed: 0
        };

        try {
            // Validate first
            const validation = this.validate(layout);
            if (!validation.isValid) {
                return {
                    success: false,
                    error: `Validation failed: ${validation.errors.join(', ')}`,
                    warnings: validation.warnings,
                    stats: this.stats
                };
            }

            this.warnings.push(...validation.warnings);

            // Stage 1: Clear existing scene (10%)
            onProgress?.('clear', 10, 'Clearing existing layout...');
            await this.clearExistingLayout();

            // Stage 2: Load track pieces (40%)
            onProgress?.('track', 20, 'Loading track pieces...');
            await this.deserializeTrackPieces(layout.track.pieces, onProgress);

            // Stage 3: Load rolling stock (60%)
            onProgress?.('rollingStock', 50, 'Loading rolling stock...');
            await this.deserializeRollingStock(layout.rollingStock, onProgress);

            // Stage 4: Load scenery (80%)
            onProgress?.('scenery', 70, 'Loading scenery...');
            await this.deserializeScenery(layout.scenery, onProgress);

            // Stage 5: Restore camera (90%)
            onProgress?.('camera', 85, 'Restoring camera...');
            this.deserializeCameraState(layout.camera);

            // Stage 6: Restore outliner (95%)
            onProgress?.('outliner', 90, 'Restoring hierarchy...');
            this.deserializeOutlinerState(layout.outliner);

            // Stage 7: Complete (100%)
            onProgress?.('complete', 100, 'Layout loaded successfully');

            console.log(`${LOG_PREFIX} Deserialization complete:`, this.stats);

            return {
                success: true,
                warnings: this.warnings,
                stats: this.stats
            };

        } catch (error) {
            console.error(`${LOG_PREFIX} Deserialization error:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                warnings: this.warnings,
                stats: this.stats
            };
        }
    }

    // ========================================================================
    // CLEAR EXISTING LAYOUT
    // ========================================================================

    /**
     * Clear existing layout before loading
     */
    private async clearExistingLayout(): Promise<void> {
        console.log(`${LOG_PREFIX} Clearing existing layout...`);

        try {
            // Clear track system
            if (this.trackSystem) {
                // Try clearAll first, then fall back to clear
                if (typeof (this.trackSystem as any).clearAll === 'function') {
                    (this.trackSystem as any).clearAll();
                    console.log(`${LOG_PREFIX} ✓ Track cleared via clearAll()`);
                } else if (typeof (this.trackSystem as any).clear === 'function') {
                    (this.trackSystem as any).clear();
                    console.log(`${LOG_PREFIX} ✓ Track cleared via clear()`);
                } else {
                    console.warn(`${LOG_PREFIX} TrackSystem has no clear/clearAll method`);
                }
            }

            // Clear placed items
            if (this.placedItemManager) {
                this.placedItemManager.clear?.();
            }

            // Clear outliner (but keep category folders)
            if (this.worldOutliner) {
                // Try clearItems first, then fall back to clearAllItems
                if (typeof (this.worldOutliner as any).clearItems === 'function') {
                    (this.worldOutliner as any).clearItems();
                } else if (typeof (this.worldOutliner as any).clearAllItems === 'function') {
                    (this.worldOutliner as any).clearAllItems();
                }
            }

            // Give scene time to process
            await this.delay(50);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error clearing layout:`, error);
            this.warnings.push('Error clearing existing layout, some items may remain');
        }
    }

    // ========================================================================
    // TRACK DESERIALIZATION
    // ========================================================================

    /**
     * Deserialize and place all track pieces
     */
    private async deserializeTrackPieces(
        pieces: SerializedTrackPiece[],
        onProgress?: DeserializationProgressCallback
    ): Promise<void> {
        if (!this.trackSystem || !pieces || pieces.length === 0) {
            console.log(`${LOG_PREFIX} No track pieces to load`);
            return;
        }

        console.log(`${LOG_PREFIX} Loading ${pieces.length} track pieces...`);

        const total = pieces.length;

        for (let i = 0; i < pieces.length; i++) {
            const piece = pieces[i];

            try {
                // Calculate progress within track stage (20-50%)
                const progress = 20 + Math.floor((i / total) * 30);
                onProgress?.('track', progress, `Loading track piece ${i + 1}/${total}`);

                // Convert serialized transform
                const position = this.deserializeVector3(piece.transform.position);
                const rotation = this.deserializeQuaternion(piece.transform.rotation);

                console.log(`${LOG_PREFIX} Placing piece ${piece.id}:`, {
                    catalogId: piece.catalogId,
                    pos: `(${position.x.toFixed(3)}, ${position.y.toFixed(3)}, ${position.z.toFixed(3)})`,
                    hasTrackSystem: !!this.trackSystem,
                    hasPlacePiece: typeof (this.trackSystem as any)?.placePiece === 'function',
                    hasPlacePieceById: typeof (this.trackSystem as any)?.placePieceById === 'function'
                });

                // Place the piece using track system
                // Try placePieceById first, then fall back to placePiece
                let placedPiece = null;

                if (typeof (this.trackSystem as any).placePieceById === 'function') {
                    placedPiece = (this.trackSystem as any).placePieceById(
                        piece.catalogId,
                        position,
                        rotation,
                        false // Skip auto-snap during load, we have exact positions
                    );
                } else if (typeof (this.trackSystem as any).placePiece === 'function') {
                    // Use placePiece which takes catalogId, position, rotation
                    placedPiece = (this.trackSystem as any).placePiece(
                        piece.catalogId,
                        position,
                        rotation
                    );
                } else {
                    console.error(`${LOG_PREFIX} TrackSystem has no placePiece or placePieceById method`);
                }

                if (placedPiece) {
                    // Store ID mapping if needed
                    if (placedPiece.id !== piece.id) {
                        this.idMapping.set(piece.id, placedPiece.id);
                    }

                    // Restore switch state
                    if (piece.switchState && placedPiece.isSwitch) {
                        placedPiece.switchState = piece.switchState;
                    }

                    this.stats.trackPiecesLoaded++;
                    console.log(`${LOG_PREFIX} ✓ Loaded track piece: ${piece.id} (${piece.catalogId})`);
                } else {
                    console.warn(`${LOG_PREFIX} ✗ Failed to place track piece: ${piece.id}`, {
                        catalogId: piece.catalogId,
                        position: { x: position.x, y: position.y, z: position.z },
                        rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w }
                    });
                    this.warnings.push(`Failed to place track piece: ${piece.id} (${piece.catalogId})`);
                    this.stats.trackPiecesFailed++;
                }

                // Small delay to prevent UI freeze
                if (i % 10 === 0) {
                    await this.delay(1);
                }

            } catch (error) {
                console.error(`${LOG_PREFIX} Error loading track piece ${piece.id}:`, error);
                this.warnings.push(`Error loading track piece ${piece.id}: ${error}`);
                this.stats.trackPiecesFailed++;
            }
        }
    }

    // ========================================================================
    // ROLLING STOCK DESERIALIZATION
    // ========================================================================

    /**
     * Deserialize and place all rolling stock
     */
    private async deserializeRollingStock(
        items: SerializedRollingStock[],
        onProgress?: DeserializationProgressCallback
    ): Promise<void> {
        if (!items || items.length === 0) {
            console.log(`${LOG_PREFIX} No rolling stock to load`);
            return;
        }

        console.log(`${LOG_PREFIX} Loading ${items.length} rolling stock items...`);

        const total = items.length;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            try {
                // Calculate progress within rolling stock stage (50-70%)
                const progress = 50 + Math.floor((i / total) * 20);
                onProgress?.('rollingStock', progress, `Loading rolling stock ${i + 1}/${total}`);

                // Check if asset exists in library
                if (this.modelLibrary && item.assetId) {
                    const asset = this.modelLibrary.getModel(item.assetId);

                    if (!asset) {
                        this.warnings.push(`Missing asset for rolling stock: ${item.name} (${item.assetId})`);
                        this.stats.rollingStockFailed++;
                        continue;
                    }
                }

                // Convert transform
                const position = this.deserializeVector3(item.transform.position);
                const rotation = this.deserializeQuaternion(item.transform.rotation);

                // Place the rolling stock
                // This would typically call into your model placement system
                // For now, we'll add to placed item manager if available
                if (this.placedItemManager) {
                    this.placedItemManager.addRollingStock?.({
                        id: item.id,
                        assetId: item.assetId,
                        name: item.name,
                        category: item.category as any,
                        position: {
                            x: position.x,
                            y: position.y,
                            z: position.z
                        },
                        scale: item.scaleFactor,
                        trackPieceId: item.trackPlacement?.trackPieceId,
                        trackPosition: item.trackPlacement?.trackPosition,
                        trackDirection: item.trackPlacement?.trackDirection
                    });

                    this.stats.rollingStockLoaded++;
                }

                // Small delay
                if (i % 5 === 0) {
                    await this.delay(1);
                }

            } catch (error) {
                console.error(`${LOG_PREFIX} Error loading rolling stock ${item.id}:`, error);
                this.warnings.push(`Error loading rolling stock ${item.name}: ${error}`);
                this.stats.rollingStockFailed++;
            }
        }
    }

    // ========================================================================
    // SCENERY DESERIALIZATION
    // ========================================================================

    /**
     * Deserialize and place all scenery items
     */
    private async deserializeScenery(
        items: SerializedScenery[],
        onProgress?: DeserializationProgressCallback
    ): Promise<void> {
        if (!items || items.length === 0) {
            console.log(`${LOG_PREFIX} No scenery to load`);
            return;
        }

        console.log(`${LOG_PREFIX} Loading ${items.length} scenery items...`);

        const total = items.length;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            try {
                // Calculate progress within scenery stage (70-85%)
                const progress = 70 + Math.floor((i / total) * 15);
                onProgress?.('scenery', progress, `Loading scenery ${i + 1}/${total}`);

                // Convert transform
                const position = this.deserializeVector3(item.transform.position);

                // Add to placed item manager
                if (this.placedItemManager) {
                    this.placedItemManager.addScenery?.({
                        id: item.id,
                        assetId: item.assetId,
                        catalogId: item.catalogId,
                        name: item.name,
                        position: {
                            x: position.x,
                            y: position.y,
                            z: position.z
                        },
                        scale: item.scaleFactor
                    });

                    this.stats.sceneryLoaded++;
                }

            } catch (error) {
                console.error(`${LOG_PREFIX} Error loading scenery ${item.id}:`, error);
                this.warnings.push(`Error loading scenery ${item.name}: ${error}`);
                this.stats.sceneryFailed++;
            }
        }
    }

    // ========================================================================
    // CAMERA DESERIALIZATION
    // ========================================================================

    /**
     * Restore camera state
     */
    private deserializeCameraState(state: SerializedCameraState): void {
        try {
            const camera = this.scene.activeCamera;

            if (!camera) {
                this.warnings.push('No active camera to restore');
                return;
            }

            // Handle ArcRotateCamera (orbit camera)
            if (camera instanceof ArcRotateCamera && state.mode === 'orbit') {
                if (state.orbitAlpha !== undefined) {
                    camera.alpha = state.orbitAlpha;
                }
                if (state.orbitBeta !== undefined) {
                    camera.beta = state.orbitBeta;
                }
                if (state.orbitRadius !== undefined) {
                    camera.radius = state.orbitRadius;
                }
                if (state.target) {
                    camera.target = this.deserializeVector3(state.target);
                }

                console.log(`${LOG_PREFIX} Camera state restored (orbit mode)`);
                return;
            }

            // Generic camera restore
            if (state.position) {
                camera.position = this.deserializeVector3(state.position);
            }

            if (state.target && camera.setTarget) {
                camera.setTarget(this.deserializeVector3(state.target));
            }

            console.log(`${LOG_PREFIX} Camera state restored`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error restoring camera:`, error);
            this.warnings.push('Error restoring camera state');
        }
    }

    // ========================================================================
    // OUTLINER DESERIALIZATION
    // ========================================================================

    /**
     * Restore World Outliner state
     */
    private deserializeOutlinerState(state: any): void {
        if (!this.worldOutliner || !state) {
            return;
        }

        try {
            // Use outliner's built-in import
            this.worldOutliner.importState?.(state);
            console.log(`${LOG_PREFIX} Outliner state restored`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error restoring outliner:`, error);
            this.warnings.push('Error restoring outliner hierarchy');
        }
    }

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

    /**
     * Deserialize Vector3 from plain object
     */
    private deserializeVector3(obj: SerializedVector3): Vector3 {
        return new Vector3(obj.x, obj.y, obj.z);
    }

    /**
     * Deserialize Quaternion from plain object
     */
    private deserializeQuaternion(obj: SerializedQuaternion): Quaternion {
        return new Quaternion(obj.x, obj.y, obj.z, obj.w);
    }

    /**
     * Async delay helper
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get a mapped ID (handles ID conflicts during load)
     */
    getMappedId(originalId: string): string {
        return this.idMapping.get(originalId) || originalId;
    }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new LayoutDeserializer instance
 * @param scene - Babylon.js scene
 * @returns LayoutDeserializer instance
 */
export function createLayoutDeserializer(scene: Scene): LayoutDeserializer {
    return new LayoutDeserializer(scene);
}