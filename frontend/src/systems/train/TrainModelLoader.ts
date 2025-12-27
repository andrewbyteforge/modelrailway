/**
 * TrainModelLoader.ts - Loads and positions train models correctly for OO gauge
 * 
 * Path: frontend/src/systems/train/TrainModelLoader.ts
 * 
 * This system handles loading GLB train models with proper:
 * - Scale adjustment for OO gauge (1:76.2)
 * - Y-axis positioning to sit on rails (not between them)
 * - Model origin correction for different model conventions
 * - Wheel height detection for accurate rail contact
 * 
 * The train should rest ON TOP of the rails, with wheels making contact
 * at the rail head surface, not down on the sleepers or ballast.
 * 
 * Track geometry reference (from TrackRenderer.ts):
 * - BALLAST_HEIGHT: 0.003m (3mm)
 * - SLEEPER_HEIGHT: 0.002m (2mm)
 * - RAIL_HEIGHT: 0.003m (3mm)
 * - Rail top surface = 0.008m above baseboard
 * 
 * @module TrainModelLoader
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Scene } from '@babylonjs/core/scene';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { BoundingInfo } from '@babylonjs/core/Culling/boundingInfo';

// Import GLB loader as side-effect
import '@babylonjs/loaders/glTF';

// ============================================================================
// CONSTANTS - OO Gauge and Track Dimensions
// ============================================================================

/** Logging prefix for console messages */
const LOG_PREFIX = '[TrainModelLoader]';

/**
 * OO Gauge scale factor (1:76.2)
 * Real world dimensions are divided by this to get model dimensions
 */
const OO_SCALE = 76.2;

/**
 * Track geometry constants (must match TrackRenderer.ts)
 * All values in meters
 */
const TRACK_GEOMETRY = {
    /** Height of ballast bed from baseboard surface */
    BALLAST_HEIGHT: 0.003,      // 3mm

    /** Height of sleepers/ties */
    SLEEPER_HEIGHT: 0.002,      // 2mm

    /** Height of rail head from sleeper surface */
    RAIL_HEIGHT: 0.003,         // 3mm

    /** Track gauge (distance between rail inner edges) */
    GAUGE: 0.0165,              // 16.5mm

    /**
     * Total height from baseboard to rail top surface
     * This is where wheels should make contact
     */
    get RAIL_TOP_HEIGHT(): number {
        return this.BALLAST_HEIGHT + this.SLEEPER_HEIGHT + this.RAIL_HEIGHT;
    }
} as const;

/**
 * Default scale factors for common model sources
 * These can be adjusted based on where models originate
 */
const MODEL_SCALE_PRESETS = {
    /** Standard OO gauge models (already correctly scaled) */
    OO_GAUGE: 1.0,

    /** Models created at 1:1 real world scale (need scaling down) */
    REAL_WORLD: 1 / OO_SCALE,

    /** HO scale models (1:87) - need slight upscale for OO */
    HO_SCALE: 87 / OO_SCALE,  // ≈ 1.142

    /** N scale models (1:148/1:160) - need significant upscale */
    N_SCALE_UK: 148 / OO_SCALE,
    N_SCALE_US: 160 / OO_SCALE,

    /** O gauge models (1:43.5 or 1:48) - need downscale */
    O_GAUGE_UK: 43.5 / OO_SCALE,
    O_GAUGE_US: 48 / OO_SCALE,
} as const;

/**
 * Model origin conventions - where the origin point is located
 */
export type ModelOrigin =
    | 'bottom-center'     // Origin at bottom center (wheels touching Y=0)
    | 'geometric-center'  // Origin at geometric center of bounding box
    | 'wheel-axle'        // Origin at wheel axle height
    | 'custom';           // Custom origin with manual offset

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

/**
 * Configuration options for loading a train model
 */
export interface TrainModelConfig {
    /** Path to the GLB file (relative or absolute) */
    modelPath: string;

    /** Unique identifier for this rolling stock */
    id: string;

    /** Display name for the train */
    name?: string;

    /**
     * Scale multiplier applied AFTER base scale
     * Use this to fine-tune if model is slightly too big/small
     * Default: 1.0
     */
    scaleMultiplier?: number;

    /**
     * Base scale preset to use
     * Default: 'OO_GAUGE' (assumes model is already OO scale)
     */
    scalePreset?: keyof typeof MODEL_SCALE_PRESETS;

    /**
     * Custom scale factor (overrides scalePreset if provided)
     * Applied uniformly to X, Y, Z
     */
    customScale?: number;

    /**
     * Where the model's origin is located
     * This affects how Y offset is calculated
     * Default: 'bottom-center'
     */
    modelOrigin?: ModelOrigin;

    /**
     * Manual Y offset in meters (added after auto-calculation)
     * Positive = raise model, Negative = lower model
     * Use this for fine-tuning if auto-positioning isn't perfect
     */
    yOffsetOverride?: number;

    /**
     * If true, automatically detect wheel height from mesh bounds
     * Default: true
     */
    autoDetectWheelHeight?: boolean;

    /**
     * Manual wheel radius in meters (OO scale)
     * Only used if autoDetectWheelHeight is false
     * Typical OO loco wheel: ~0.005m (5mm)
     */
    wheelRadius?: number;
}

/**
 * Result of loading a train model
 */
export interface LoadedTrainModel {
    /** The root transform node containing all meshes */
    rootNode: TransformNode;

    /** All meshes in the loaded model */
    meshes: AbstractMesh[];

    /** The applied scale factor */
    appliedScale: number;

    /** The calculated Y offset (rail contact height) */
    appliedYOffset: number;

    /** Bounding information after scaling */
    bounds: {
        min: Vector3;
        max: Vector3;
        width: number;   // X dimension
        height: number;  // Y dimension
        length: number;  // Z dimension (along track)
    };

    /** Configuration used to load this model */
    config: TrainModelConfig;
}

/**
 * Statistics for debugging model loading
 */
export interface ModelLoadStats {
    meshCount: number;
    vertexCount: number;
    originalBounds: { min: Vector3; max: Vector3 };
    scaledBounds: { min: Vector3; max: Vector3 };
    loadTimeMs: number;
}

// ============================================================================
// TRAIN MODEL LOADER CLASS
// ============================================================================

/**
 * TrainModelLoader - Loads and correctly positions train models
 * 
 * Handles the complex task of importing 3D train models and ensuring
 * they sit correctly on the track rails with proper OO gauge scaling.
 * 
 * @example
 * ```typescript
 * const loader = new TrainModelLoader(scene);
 * 
 * // Load a model that's already OO scale
 * const loco = await loader.loadModel({
 *     modelPath: 'assets/models/class66.glb',
 *     id: 'loco_001',
 *     name: 'Class 66'
 * });
 * 
 * // Load a model that was created at 1:1 scale
 * const coach = await loader.loadModel({
 *     modelPath: 'assets/models/mk3_coach.glb',
 *     id: 'coach_001',
 *     scalePreset: 'REAL_WORLD'  // Will scale down by 1/76.2
 * });
 * 
 * // Fine-tune if still slightly wrong
 * const adjustedLoco = await loader.loadModel({
 *     modelPath: 'assets/models/class66.glb',
 *     id: 'loco_002',
 *     scaleMultiplier: 1.05,    // 5% larger
 *     yOffsetOverride: 0.001    // Raise by 1mm
 * });
 * ```
 */
export class TrainModelLoader {
    // ========================================================================
    // PROPERTIES
    // ========================================================================

    /** Babylon.js scene reference */
    private readonly scene: Scene;

    /** Cache of loaded models by ID */
    private loadedModels: Map<string, LoadedTrainModel> = new Map();

    /** Loading statistics for debugging */
    private lastLoadStats: ModelLoadStats | null = null;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new TrainModelLoader
     * @param scene - The Babylon.js scene to load models into
     */
    constructor(scene: Scene) {
        if (!scene) {
            throw new Error(`${LOG_PREFIX} Scene is required`);
        }

        this.scene = scene;
        console.log(`${LOG_PREFIX} Initialized`);
        console.log(`${LOG_PREFIX} Rail top height: ${TRACK_GEOMETRY.RAIL_TOP_HEIGHT.toFixed(4)}m (${(TRACK_GEOMETRY.RAIL_TOP_HEIGHT * 1000).toFixed(1)}mm)`);
    }

    // ========================================================================
    // PUBLIC METHODS
    // ========================================================================

    /**
     * Load a train model with correct scale and positioning
     * 
     * This is the main entry point for loading train models. It handles:
     * 1. Loading the GLB file
     * 2. Applying the correct scale for OO gauge
     * 3. Calculating the Y offset so wheels sit on rails
     * 4. Creating a parent transform node for easy manipulation
     * 
     * @param config - Configuration options for the model
     * @returns Promise resolving to the loaded model data
     * @throws Error if loading fails
     */
    async loadModel(config: TrainModelConfig): Promise<LoadedTrainModel> {
        const startTime = performance.now();

        console.log(`${LOG_PREFIX} Loading model: ${config.modelPath}`);
        console.log(`${LOG_PREFIX} Config:`, JSON.stringify(config, null, 2));

        try {
            // ================================================================
            // STEP 1: Load the GLB file
            // ================================================================

            const loadResult = await SceneLoader.ImportMeshAsync(
                '',                    // Mesh names (empty = all meshes)
                '',                    // Root URL (empty = use full path)
                config.modelPath,      // Full path to GLB file
                this.scene            // Target scene
            );

            if (!loadResult.meshes || loadResult.meshes.length === 0) {
                throw new Error(`No meshes found in model: ${config.modelPath}`);
            }

            console.log(`${LOG_PREFIX} Loaded ${loadResult.meshes.length} meshes`);

            // ================================================================
            // STEP 2: Get original bounds BEFORE scaling
            // ================================================================

            const originalBounds = this.calculateCombinedBounds(loadResult.meshes);
            console.log(`${LOG_PREFIX} Original bounds:`, {
                min: originalBounds.min.toString(),
                max: originalBounds.max.toString(),
                height: (originalBounds.max.y - originalBounds.min.y).toFixed(4)
            });

            // ================================================================
            // STEP 3: Calculate the scale factor
            // ================================================================

            const scaleFactor = this.calculateScaleFactor(config);
            console.log(`${LOG_PREFIX} Scale factor: ${scaleFactor.toFixed(4)}`);

            // ================================================================
            // STEP 4: Create parent transform node
            // ================================================================

            const rootNode = new TransformNode(`train_${config.id}`, this.scene);
            rootNode.id = config.id;

            // Parent all meshes to the root node
            for (const mesh of loadResult.meshes) {
                // Skip the __root__ mesh if present
                if (mesh.name === '__root__') {
                    mesh.setParent(rootNode);
                } else if (!mesh.parent || mesh.parent.name === '__root__') {
                    mesh.setParent(rootNode);
                }
            }

            // ================================================================
            // STEP 5: Apply scale to the root node
            // ================================================================

            rootNode.scaling = new Vector3(scaleFactor, scaleFactor, scaleFactor);

            // ================================================================
            // STEP 6: Calculate Y offset for rail contact
            // ================================================================

            const yOffset = this.calculateYOffset(
                originalBounds,
                scaleFactor,
                config
            );

            console.log(`${LOG_PREFIX} Y offset: ${yOffset.toFixed(4)}m (${(yOffset * 1000).toFixed(2)}mm)`);

            // Apply Y offset to root node position
            rootNode.position.y = yOffset;

            // ================================================================
            // STEP 7: Calculate final bounds after scaling
            // ================================================================

            const scaledBounds = this.calculateScaledBounds(originalBounds, scaleFactor);

            // ================================================================
            // STEP 8: Prepare result
            // ================================================================

            const result: LoadedTrainModel = {
                rootNode,
                meshes: loadResult.meshes,
                appliedScale: scaleFactor,
                appliedYOffset: yOffset,
                bounds: {
                    min: scaledBounds.min,
                    max: scaledBounds.max,
                    width: scaledBounds.max.x - scaledBounds.min.x,
                    height: scaledBounds.max.y - scaledBounds.min.y,
                    length: scaledBounds.max.z - scaledBounds.min.z
                },
                config
            };

            // Cache the loaded model
            this.loadedModels.set(config.id, result);

            // Store stats
            const loadTime = performance.now() - startTime;
            this.lastLoadStats = {
                meshCount: loadResult.meshes.length,
                vertexCount: this.countVertices(loadResult.meshes),
                originalBounds: { min: originalBounds.min.clone(), max: originalBounds.max.clone() },
                scaledBounds: { min: scaledBounds.min.clone(), max: scaledBounds.max.clone() },
                loadTimeMs: loadTime
            };

            console.log(`${LOG_PREFIX} Model loaded successfully in ${loadTime.toFixed(0)}ms`);
            console.log(`${LOG_PREFIX} Final dimensions: W=${result.bounds.width.toFixed(4)}m, H=${result.bounds.height.toFixed(4)}m, L=${result.bounds.length.toFixed(4)}m`);

            return result;

        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to load model:`, error);
            throw error;
        }
    }

    /**
     * Adjust the scale of an already-loaded model
     * 
     * Use this if the model appears too big or too small after initial loading
     * 
     * @param modelId - ID of the loaded model
     * @param newScaleMultiplier - New scale multiplier (1.0 = no change)
     * @returns True if successful
     */
    adjustScale(modelId: string, newScaleMultiplier: number): boolean {
        const model = this.loadedModels.get(modelId);

        if (!model) {
            console.warn(`${LOG_PREFIX} Model not found: ${modelId}`);
            return false;
        }

        const currentScale = model.appliedScale;
        const baseScale = currentScale / (model.config.scaleMultiplier || 1.0);
        const newScale = baseScale * newScaleMultiplier;

        console.log(`${LOG_PREFIX} Adjusting scale for ${modelId}: ${currentScale.toFixed(4)} -> ${newScale.toFixed(4)}`);

        model.rootNode.scaling = new Vector3(newScale, newScale, newScale);
        model.appliedScale = newScale;
        model.config.scaleMultiplier = newScaleMultiplier;

        // Recalculate Y offset for new scale
        const originalBounds = this.lastLoadStats?.originalBounds;
        if (originalBounds) {
            const newYOffset = this.calculateYOffset(originalBounds, newScale, model.config);
            model.rootNode.position.y = newYOffset;
            model.appliedYOffset = newYOffset;
        }

        return true;
    }

    /**
     * Adjust the Y position of an already-loaded model
     * 
     * Use this for fine-tuning if the model still isn't sitting correctly
     * 
     * @param modelId - ID of the loaded model
     * @param deltaY - Amount to adjust in meters (positive = up)
     * @returns True if successful
     */
    adjustYPosition(modelId: string, deltaY: number): boolean {
        const model = this.loadedModels.get(modelId);

        if (!model) {
            console.warn(`${LOG_PREFIX} Model not found: ${modelId}`);
            return false;
        }

        const currentY = model.rootNode.position.y;
        const newY = currentY + deltaY;

        console.log(`${LOG_PREFIX} Adjusting Y for ${modelId}: ${currentY.toFixed(4)}m -> ${newY.toFixed(4)}m`);

        model.rootNode.position.y = newY;
        model.appliedYOffset = newY;
        model.config.yOffsetOverride = (model.config.yOffsetOverride || 0) + deltaY;

        return true;
    }

    /**
     * Get a loaded model by ID
     * @param modelId - ID of the model
     * @returns The loaded model or undefined
     */
    getModel(modelId: string): LoadedTrainModel | undefined {
        return this.loadedModels.get(modelId);
    }

    /**
     * Dispose of a loaded model
     * @param modelId - ID of the model to dispose
     */
    disposeModel(modelId: string): void {
        const model = this.loadedModels.get(modelId);

        if (model) {
            console.log(`${LOG_PREFIX} Disposing model: ${modelId}`);

            for (const mesh of model.meshes) {
                mesh.dispose();
            }

            model.rootNode.dispose();
            this.loadedModels.delete(modelId);
        }
    }

    /**
     * Dispose all loaded models
     */
    disposeAll(): void {
        console.log(`${LOG_PREFIX} Disposing all models (${this.loadedModels.size})`);

        for (const [id] of this.loadedModels) {
            this.disposeModel(id);
        }
    }

    /**
     * Get the last load statistics (for debugging)
     */
    getLastLoadStats(): ModelLoadStats | null {
        return this.lastLoadStats;
    }

    /**
     * Get the rail top height constant (for external reference)
     */
    getRailTopHeight(): number {
        return TRACK_GEOMETRY.RAIL_TOP_HEIGHT;
    }

    // ========================================================================
    // PRIVATE METHODS - Scale Calculation
    // ========================================================================

    /**
     * Calculate the final scale factor based on configuration
     * @param config - Model configuration
     * @returns The scale factor to apply
     */
    private calculateScaleFactor(config: TrainModelConfig): number {
        // Start with base scale from preset or custom value
        let baseScale: number;

        if (config.customScale !== undefined) {
            // Use custom scale if provided
            baseScale = config.customScale;
            console.log(`${LOG_PREFIX} Using custom scale: ${baseScale}`);
        } else {
            // Use preset scale
            const presetKey = config.scalePreset || 'OO_GAUGE';
            baseScale = MODEL_SCALE_PRESETS[presetKey];
            console.log(`${LOG_PREFIX} Using preset '${presetKey}': ${baseScale}`);
        }

        // Apply multiplier for fine-tuning
        const multiplier = config.scaleMultiplier ?? 1.0;
        const finalScale = baseScale * multiplier;

        if (multiplier !== 1.0) {
            console.log(`${LOG_PREFIX} Applying multiplier ${multiplier}: ${baseScale} -> ${finalScale}`);
        }

        return finalScale;
    }

    // ========================================================================
    // PRIVATE METHODS - Y Offset Calculation
    // ========================================================================

    /**
     * Calculate the Y offset to position the model correctly on the rails
     * 
     * This is the key calculation that ensures the train sits ON the rails,
     * not between them on the sleepers.
     * 
     * The calculation depends on where the model's origin is:
     * - 'bottom-center': Origin at wheel contact point (Y=0 is bottom)
     *   -> Just add rail top height
     * - 'geometric-center': Origin at center of bounding box
     *   -> Need to account for half the model height
     * - 'wheel-axle': Origin at wheel axle center
     *   -> Add rail top height + wheel radius
     * 
     * @param originalBounds - Bounds before scaling
     * @param scaleFactor - Applied scale factor
     * @param config - Model configuration
     * @returns Y offset in meters
     */
    private calculateYOffset(
        originalBounds: { min: Vector3; max: Vector3 },
        scaleFactor: number,
        config: TrainModelConfig
    ): number {
        const railTop = TRACK_GEOMETRY.RAIL_TOP_HEIGHT;
        const modelOrigin = config.modelOrigin || 'bottom-center';

        // Calculate scaled model dimensions
        const scaledMinY = originalBounds.min.y * scaleFactor;
        const scaledMaxY = originalBounds.max.y * scaleFactor;
        const scaledHeight = scaledMaxY - scaledMinY;

        console.log(`${LOG_PREFIX} Calculating Y offset:`);
        console.log(`${LOG_PREFIX}   Rail top: ${railTop.toFixed(4)}m`);
        console.log(`${LOG_PREFIX}   Model origin: ${modelOrigin}`);
        console.log(`${LOG_PREFIX}   Scaled min Y: ${scaledMinY.toFixed(4)}m`);
        console.log(`${LOG_PREFIX}   Scaled max Y: ${scaledMaxY.toFixed(4)}m`);
        console.log(`${LOG_PREFIX}   Scaled height: ${scaledHeight.toFixed(4)}m`);

        let yOffset: number;

        switch (modelOrigin) {
            case 'bottom-center':
                // Model's Y=0 is at the bottom (wheel contact point)
                // We need to raise it so the bottom touches the rail top
                // If the model's min Y is negative (below origin), account for that
                yOffset = railTop - scaledMinY;
                console.log(`${LOG_PREFIX}   bottom-center: railTop(${railTop.toFixed(4)}) - scaledMinY(${scaledMinY.toFixed(4)}) = ${yOffset.toFixed(4)}`);
                break;

            case 'geometric-center':
                // Model's origin is at the geometric center
                // The bottom of the model is at -height/2
                // We need the bottom to be at rail top
                yOffset = railTop + (scaledHeight / 2);
                console.log(`${LOG_PREFIX}   geometric-center: railTop(${railTop.toFixed(4)}) + height/2(${(scaledHeight / 2).toFixed(4)}) = ${yOffset.toFixed(4)}`);
                break;

            case 'wheel-axle':
                // Model's origin is at wheel axle center
                // We need to add wheel radius to get contact point to rail
                const wheelRadius = config.wheelRadius || 0.005; // Default 5mm
                const scaledWheelRadius = wheelRadius; // Assume wheel radius is already scaled
                yOffset = railTop + scaledWheelRadius;
                console.log(`${LOG_PREFIX}   wheel-axle: railTop(${railTop.toFixed(4)}) + wheelRadius(${scaledWheelRadius.toFixed(4)}) = ${yOffset.toFixed(4)}`);
                break;

            case 'custom':
                // Use manual override only
                yOffset = config.yOffsetOverride || railTop;
                console.log(`${LOG_PREFIX}   custom: using yOffsetOverride = ${yOffset.toFixed(4)}`);
                break;

            default:
                yOffset = railTop;
        }

        // Apply manual override if provided (additive)
        if (config.yOffsetOverride !== undefined && modelOrigin !== 'custom') {
            console.log(`${LOG_PREFIX}   Adding manual override: ${config.yOffsetOverride.toFixed(4)}`);
            yOffset += config.yOffsetOverride;
        }

        return yOffset;
    }

    // ========================================================================
    // PRIVATE METHODS - Bounds Calculation
    // ========================================================================

    /**
     * Calculate combined bounding box for all meshes
     * @param meshes - Array of meshes
     * @returns Combined bounds
     */
    private calculateCombinedBounds(meshes: AbstractMesh[]): { min: Vector3; max: Vector3 } {
        let min = new Vector3(Infinity, Infinity, Infinity);
        let max = new Vector3(-Infinity, -Infinity, -Infinity);

        for (const mesh of meshes) {
            // Skip meshes without geometry
            if (!mesh.getBoundingInfo) continue;

            try {
                mesh.computeWorldMatrix(true);
                const boundingInfo = mesh.getBoundingInfo();
                const meshMin = boundingInfo.boundingBox.minimumWorld;
                const meshMax = boundingInfo.boundingBox.maximumWorld;

                min = Vector3.Minimize(min, meshMin);
                max = Vector3.Maximize(max, meshMax);
            } catch (e) {
                // Skip meshes that can't compute bounds
                continue;
            }
        }

        // Handle case where no valid bounds were found
        if (!isFinite(min.x)) {
            min = Vector3.Zero();
            max = Vector3.Zero();
            console.warn(`${LOG_PREFIX} Could not calculate bounds, using zero`);
        }

        return { min, max };
    }

    /**
     * Calculate bounds after applying scale
     * @param originalBounds - Original bounds
     * @param scaleFactor - Scale factor
     * @returns Scaled bounds
     */
    private calculateScaledBounds(
        originalBounds: { min: Vector3; max: Vector3 },
        scaleFactor: number
    ): { min: Vector3; max: Vector3 } {
        return {
            min: originalBounds.min.scale(scaleFactor),
            max: originalBounds.max.scale(scaleFactor)
        };
    }

    /**
     * Count total vertices across all meshes
     * @param meshes - Array of meshes
     * @returns Total vertex count
     */
    private countVertices(meshes: AbstractMesh[]): number {
        let count = 0;

        for (const mesh of meshes) {
            const vertexData = mesh.getVerticesData('position');
            if (vertexData) {
                count += vertexData.length / 3;
            }
        }

        return count;
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Quick utility to calculate what scale factor is needed
 * for a real-world dimension to become an OO scale dimension
 * 
 * @param realWorldMeters - Real world size in meters
 * @param targetOOMeters - Desired OO scale size in meters
 * @returns Required scale factor
 * 
 * @example
 * ```typescript
 * // A real locomotive is 20m long
 * // In OO gauge it should be 20/76.2 = 0.262m (262mm)
 * const scale = calculateRequiredScale(20, 0.262);  // Returns ~0.0131
 * ```
 */
export function calculateRequiredScale(realWorldMeters: number, targetOOMeters: number): number {
    return targetOOMeters / realWorldMeters;
}

/**
 * Convert real-world millimeters to OO gauge meters
 * @param realMM - Real world millimeters
 * @returns OO scale meters
 */
export function realMMToOOMeters(realMM: number): number {
    return (realMM / 1000) / OO_SCALE;
}

/**
 * Convert OO gauge meters to real-world millimeters
 * @param ooMeters - OO scale meters
 * @returns Real world millimeters
 */
export function ooMetersToRealMM(ooMeters: number): number {
    return ooMeters * OO_SCALE * 1000;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { TRACK_GEOMETRY, MODEL_SCALE_PRESETS, OO_SCALE };