/**
 * ModelScaleHelper.ts - Scale calculation utilities for OO gauge models
 * 
 * Path: frontend/src/systems/models/ModelScaleHelper.ts
 * 
 * Provides utilities for calculating proper scale factors when importing
 * 3D models into the OO gauge (1:76.2 scale) model railway environment.
 * 
 * IMPORTANT SCALE CALCULATION:
 * - Rolling stock (trains) should be scaled based on TARGET LENGTH
 * - A typical OO locomotive is 200-280mm long
 * - A model that is 1.904m in the file should become ~230mm (0.230m)
 * - Scale = targetLength / modelLength = 0.230 / 1.904 = 0.1208
 * 
 * @module ModelScaleHelper
 * @author Model Railway Workbench
 * @version 2.1.0 - Refactored to use centralized constants
 */

import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

// ============================================================================
// IMPORTS FROM CENTRALIZED CONSTANTS
// ============================================================================

import {
    OO_GAUGE,
    OO_ROLLING_STOCK_TARGETS,
    REFERENCE_DIMENSIONS,
    type RollingStockType,
    type ReferenceDimensionKey
} from '../../constants';

// ============================================================================
// RE-EXPORTS FOR BACKWARDS COMPATIBILITY
// ============================================================================

// Re-export constants so existing imports continue to work
export { OO_GAUGE, OO_ROLLING_STOCK_TARGETS, REFERENCE_DIMENSIONS };
export type { RollingStockType };

// ============================================================================
// LOCAL CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[ModelScaleHelper]';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Extracted model dimensions
 */
export interface ModelDimensions {
    /** Width (X axis) in model units */
    width: number;
    /** Height (Y axis) in model units */
    height: number;
    /** Depth (Z axis) in model units */
    depth: number;
    /** Maximum dimension (longest axis) */
    maxDimension: number;
    /** Minimum dimension (shortest axis) */
    minDimension: number;
    /** Center point of bounding box */
    center: Vector3;
    /** Minimum bounds (bottom-left-back corner) */
    boundsMin: Vector3;
    /** Maximum bounds (top-right-front corner) */
    boundsMax: Vector3;
}

/**
 * Scale calculation result
 */
export interface ScaleResult {
    /** Calculated scale factor */
    scaleFactor: number;
    /** Resulting dimensions after scaling (in meters) - OO scale size */
    resultDimensions: {
        widthM: number;
        heightM: number;
        depthM: number;
    };
    /** Real-world equivalent dimensions (what this would be in full scale) */
    realWorldDimensions: {
        widthM: number;
        heightM: number;
        depthM: number;
    };
    /** Description of scaling method used */
    description: string;
    /** Confidence level of scale calculation */
    confidence: 'high' | 'medium' | 'low';
}

/**
 * Scaling mode for model import
 */
export type ScalingMode =
    | 'rolling_stock'      // Use rolling stock targets
    | 'real_world'         // 1:1 model scaled to OO
    | 'reference'          // Use reference dimension
    | 'direct'             // Direct scale factor
    | 'auto';              // Auto-detect

// ============================================================================
// MODEL SCALE HELPER CLASS
// ============================================================================

/**
 * ModelScaleHelper - Utilities for calculating model scales
 * 
 * @example
 * ```typescript
 * // Get dimensions from meshes
 * const dims = ModelScaleHelper.getMeshDimensions(meshes);
 * 
 * // Calculate scale for a locomotive
 * const result = ModelScaleHelper.calculateRollingStockScale(dims, 'locomotive');
 * console.log(result.scaleFactor); // e.g., 0.1208
 * 
 * // Auto-detect best scale
 * const autoResult = ModelScaleHelper.autoDetectScale(dims, true);
 * ```
 */
export class ModelScaleHelper {

    // ========================================================================
    // DIMENSION EXTRACTION
    // ========================================================================

    /**
     * Extract dimensions from an array of meshes
     * @param meshes - Array of meshes to measure
     * @returns Calculated dimensions
     */
    static getMeshDimensions(meshes: AbstractMesh[]): ModelDimensions {
        if (!meshes || meshes.length === 0) {
            console.warn(`${LOG_PREFIX} No meshes provided for dimension calculation`);
            return {
                width: 0,
                height: 0,
                depth: 0,
                maxDimension: 0,
                minDimension: 0,
                center: Vector3.Zero(),
                boundsMin: Vector3.Zero(),
                boundsMax: Vector3.Zero()
            };
        }

        // Initialize with extreme values
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        // Process each mesh
        for (const mesh of meshes) {
            try {
                // Ensure world matrix is computed
                mesh.computeWorldMatrix(true);

                // Get bounding info
                const boundingInfo = mesh.getBoundingInfo();
                if (!boundingInfo) continue;

                const boundingBox = boundingInfo.boundingBox;
                const min = boundingBox.minimumWorld;
                const max = boundingBox.maximumWorld;

                // Expand bounds
                minX = Math.min(minX, min.x);
                maxX = Math.max(maxX, max.x);
                minY = Math.min(minY, min.y);
                maxY = Math.max(maxY, max.y);
                minZ = Math.min(minZ, min.z);
                maxZ = Math.max(maxZ, max.z);

            } catch (error) {
                console.warn(`${LOG_PREFIX} Error processing mesh bounds:`, error);
            }
        }

        // Handle case where no valid bounds were found
        if (!isFinite(minX)) {
            console.warn(`${LOG_PREFIX} Could not calculate valid bounds`);
            return {
                width: 0,
                height: 0,
                depth: 0,
                maxDimension: 0,
                minDimension: 0,
                center: Vector3.Zero(),
                boundsMin: Vector3.Zero(),
                boundsMax: Vector3.Zero()
            };
        }

        // Calculate dimensions
        const width = maxX - minX;
        const height = maxY - minY;
        const depth = maxZ - minZ;

        const dimensions: ModelDimensions = {
            width,
            height,
            depth,
            maxDimension: Math.max(width, height, depth),
            minDimension: Math.min(width, height, depth),
            center: new Vector3(
                (minX + maxX) / 2,
                (minY + maxY) / 2,
                (minZ + maxZ) / 2
            ),
            boundsMin: new Vector3(minX, minY, minZ),
            boundsMax: new Vector3(maxX, maxY, maxZ)
        };

        console.log(`${LOG_PREFIX} Extracted dimensions:`, {
            width: width.toFixed(4),
            height: height.toFixed(4),
            depth: depth.toFixed(4),
            maxDimension: dimensions.maxDimension.toFixed(4),
            boundsMinY: minY.toFixed(4),
            boundsMaxY: maxY.toFixed(4)
        });

        return dimensions;
    }

    /**
     * Alternative method name for compatibility
     */
    static extractDimensions(meshes: AbstractMesh[]): ModelDimensions {
        return this.getMeshDimensions(meshes);
    }

    // ========================================================================
    // ROLLING STOCK SCALE CALCULATION (PRIMARY METHOD FOR TRAINS)
    // ========================================================================

    /**
     * Calculate scale factor for rolling stock (trains)
     * 
     * This is the PRIMARY method for scaling train models.
     * It scales the model's longest dimension to match the target OO gauge length.
     * 
     * IMPORTANT: This uses LENGTH-BASED scaling, not gauge-based.
     * 
     * @param dimensions - Model dimensions
     * @param type - Type of rolling stock
     * @param customTargetLengthM - Optional custom target length in meters
     * @returns Scale result
     * 
     * @example
     * ```typescript
     * // Model is 1.904m long in file
     * // Target locomotive length is 0.230m (230mm)
     * // Scale = 0.230 / 1.904 = 0.1208
     * const result = ModelScaleHelper.calculateRollingStockScale(dims, 'locomotive');
     * ```
     */
    static calculateRollingStockScale(
        dimensions: ModelDimensions,
        type: RollingStockType = 'locomotive',
        customTargetLengthM?: number
    ): ScaleResult {
        // Get target dimensions for this type
        const targets = OO_ROLLING_STOCK_TARGETS[type];
        const targetLengthM = customTargetLengthM ?? targets.lengthM;

        // Use the longest dimension as the model's "length"
        // Most train models have length as their longest dimension
        const modelLength = dimensions.maxDimension;

        if (modelLength <= 0) {
            console.warn(`${LOG_PREFIX} Invalid model length: ${modelLength}`);
            return {
                scaleFactor: 1,
                resultDimensions: {
                    widthM: dimensions.width,
                    heightM: dimensions.height,
                    depthM: dimensions.depth
                },
                realWorldDimensions: {
                    widthM: dimensions.width * OO_GAUGE.SCALE_RATIO,
                    heightM: dimensions.height * OO_GAUGE.SCALE_RATIO,
                    depthM: dimensions.depth * OO_GAUGE.SCALE_RATIO
                },
                description: 'No scaling (invalid dimensions)',
                confidence: 'low'
            };
        }

        // Calculate scale factor: target / model
        const scaleFactor = targetLengthM / modelLength;

        // Calculate resulting dimensions
        const resultDimensions = {
            widthM: dimensions.width * scaleFactor,
            heightM: dimensions.height * scaleFactor,
            depthM: dimensions.depth * scaleFactor
        };

        // Calculate real-world equivalent (what this would be full-scale)
        const realWorldDimensions = {
            widthM: resultDimensions.widthM * OO_GAUGE.SCALE_RATIO,
            heightM: resultDimensions.heightM * OO_GAUGE.SCALE_RATIO,
            depthM: resultDimensions.depthM * OO_GAUGE.SCALE_RATIO
        };

        console.log(`${LOG_PREFIX} Rolling stock scale calculation:`);
        console.log(`${LOG_PREFIX}   Type: ${type} (${targets.description})`);
        console.log(`${LOG_PREFIX}   Model length (max dimension): ${modelLength.toFixed(4)}m`);
        console.log(`${LOG_PREFIX}   Target length: ${targetLengthM.toFixed(4)}m (${(targetLengthM * 1000).toFixed(1)}mm)`);
        console.log(`${LOG_PREFIX}   Scale factor: ${scaleFactor.toFixed(6)}`);
        console.log(`${LOG_PREFIX}   Result: ${(resultDimensions.widthM * 1000).toFixed(1)}mm x ${(resultDimensions.heightM * 1000).toFixed(1)}mm x ${(resultDimensions.depthM * 1000).toFixed(1)}mm`);

        return {
            scaleFactor,
            resultDimensions,
            realWorldDimensions,
            description: `${type}: ${(targetLengthM * 1000).toFixed(0)}mm target`,
            confidence: 'high'
        };
    }

    // ========================================================================
    // REAL-WORLD SCALE CALCULATION (FOR 1:1 MODELS)
    // ========================================================================

    /**
     * Calculate scale for a model created at 1:1 real-world scale
     * 
     * If you have a model that represents a real 20m locomotive at 1:1 scale,
     * this will calculate the scale needed to convert it to OO gauge.
     * 
     * @param dimensions - Model dimensions (assumed to be in real-world meters)
     * @returns Scale result
     */
    static calculateFromRealWorldScale(dimensions: ModelDimensions): ScaleResult {
        // For 1:1 models, simply divide by OO scale ratio
        const scaleFactor = 1 / OO_GAUGE.SCALE_RATIO;

        const resultDimensions = {
            widthM: dimensions.width * scaleFactor,
            heightM: dimensions.height * scaleFactor,
            depthM: dimensions.depth * scaleFactor
        };

        // Real-world dimensions are the original dimensions (since input is 1:1)
        const realWorldDimensions = {
            widthM: dimensions.width,
            heightM: dimensions.height,
            depthM: dimensions.depth
        };

        console.log(`${LOG_PREFIX} Real-world scale calculation:`);
        console.log(`${LOG_PREFIX}   Input dimensions: ${dimensions.width.toFixed(2)}m x ${dimensions.height.toFixed(2)}m x ${dimensions.depth.toFixed(2)}m`);
        console.log(`${LOG_PREFIX}   Scale factor: 1/${OO_GAUGE.SCALE_RATIO} = ${scaleFactor.toFixed(6)}`);
        console.log(`${LOG_PREFIX}   Result: ${(resultDimensions.widthM * 1000).toFixed(1)}mm x ${(resultDimensions.heightM * 1000).toFixed(1)}mm x ${(resultDimensions.depthM * 1000).toFixed(1)}mm`);

        return {
            scaleFactor,
            resultDimensions,
            realWorldDimensions,
            description: `1:${OO_GAUGE.SCALE_RATIO} scale conversion`,
            confidence: 'high'
        };
    }

    // ========================================================================
    // REFERENCE-BASED SCALE CALCULATION
    // ========================================================================

    /**
     * Calculate scale using a known reference dimension
     * 
     * @param dimensions - Model dimensions
     * @param referenceKey - Key from REFERENCE_DIMENSIONS
     * @param useMaxDimension - Whether to use max dimension (true) or user-specified axis
     * @returns Scale result
     */
    static calculateFromReference(
        dimensions: ModelDimensions,
        referenceKey: ReferenceDimensionKey | string,
        useMaxDimension: boolean | string = true
    ): ScaleResult {
        const reference = REFERENCE_DIMENSIONS[referenceKey as ReferenceDimensionKey];
        if (!reference) {
            console.warn(`${LOG_PREFIX} Unknown reference: ${referenceKey}`);
            return {
                scaleFactor: 1,
                resultDimensions: {
                    widthM: dimensions.width,
                    heightM: dimensions.height,
                    depthM: dimensions.depth
                },
                realWorldDimensions: {
                    widthM: dimensions.width * OO_GAUGE.SCALE_RATIO,
                    heightM: dimensions.height * OO_GAUGE.SCALE_RATIO,
                    depthM: dimensions.depth * OO_GAUGE.SCALE_RATIO
                },
                description: 'Unknown reference',
                confidence: 'low'
            };
        }

        // Determine which axis to use
        const useMax = useMaxDimension === true || useMaxDimension === 'max';
        const useHeight = useMaxDimension === 'height' || useMaxDimension === false;

        // The model dimension represents the real-world size
        const modelDimension = useMax ? dimensions.maxDimension :
            useHeight ? dimensions.height : dimensions.maxDimension;

        // Target OO scale size
        const targetSizeM = OO_GAUGE.realToScale(reference.realM);

        // Scale factor
        const scaleFactor = targetSizeM / modelDimension;

        const resultDimensions = {
            widthM: dimensions.width * scaleFactor,
            heightM: dimensions.height * scaleFactor,
            depthM: dimensions.depth * scaleFactor
        };

        const realWorldDimensions = {
            widthM: resultDimensions.widthM * OO_GAUGE.SCALE_RATIO,
            heightM: resultDimensions.heightM * OO_GAUGE.SCALE_RATIO,
            depthM: resultDimensions.depthM * OO_GAUGE.SCALE_RATIO
        };

        console.log(`${LOG_PREFIX} Reference-based scale calculation:`);
        console.log(`${LOG_PREFIX}   Reference: ${reference.description}`);
        console.log(`${LOG_PREFIX}   Real-world size: ${reference.realM}m`);
        console.log(`${LOG_PREFIX}   OO scale target: ${(targetSizeM * 1000).toFixed(1)}mm`);
        console.log(`${LOG_PREFIX}   Scale factor: ${scaleFactor.toFixed(6)}`);

        return {
            scaleFactor,
            resultDimensions,
            realWorldDimensions,
            description: `Reference: ${reference.description}`,
            confidence: 'medium'
        };
    }

    // ========================================================================
    // AUTO-DETECTION
    // ========================================================================

    /**
     * Auto-detect the best scale based on model dimensions
     * 
     * Uses heuristics to determine if the model is:
     * - Already OO scale
     * - Real-world 1:1 scale
     * - Some other scale that needs adjustment
     * 
     * @param dimensions - Model dimensions
     * @param isRollingStock - Hint that this is rolling stock
     * @returns Scale result with confidence level
     */
    static autoDetectScale(
        dimensions: ModelDimensions,
        isRollingStock: boolean = false
    ): ScaleResult {
        const maxDim = dimensions.maxDimension;

        console.log(`${LOG_PREFIX} Auto-detecting scale...`);
        console.log(`${LOG_PREFIX}   Max dimension: ${maxDim.toFixed(4)}m (${(maxDim * 1000).toFixed(1)}mm)`);
        console.log(`${LOG_PREFIX}   Is rolling stock: ${isRollingStock}`);

        // ----------------------------------------------------------------
        // Case 1: Rolling stock detection
        // ----------------------------------------------------------------
        if (isRollingStock) {
            // Determine type based on size
            let type: RollingStockType = 'locomotive';

            if (maxDim > 15) {
                // Very large - likely real-world scale coach
                type = 'coach';
            } else if (maxDim > 10) {
                // Large - likely real-world scale locomotive
                type = 'locomotive';
            } else if (maxDim > 5) {
                // Medium - could be wagon at real scale
                type = 'wagon';
            } else if (maxDim > 0.5) {
                // Could be a small OO model or needs scaling
                type = 'locomotive';
            } else if (maxDim > 0.1) {
                // Already approximately OO scale
                return {
                    scaleFactor: 1,
                    resultDimensions: {
                        widthM: dimensions.width,
                        heightM: dimensions.height,
                        depthM: dimensions.depth
                    },
                    realWorldDimensions: {
                        widthM: dimensions.width * OO_GAUGE.SCALE_RATIO,
                        heightM: dimensions.height * OO_GAUGE.SCALE_RATIO,
                        depthM: dimensions.depth * OO_GAUGE.SCALE_RATIO
                    },
                    description: 'Already OO scale (no adjustment)',
                    confidence: 'medium'
                };
            }

            return this.calculateRollingStockScale(dimensions, type);
        }

        // ----------------------------------------------------------------
        // Case 2: Scenery/buildings - use heuristics
        // ----------------------------------------------------------------

        // Check if already at OO scale (reasonable for scenery)
        // OO scale buildings typically 0.05m to 0.3m
        if (maxDim >= 0.02 && maxDim <= 0.5) {
            console.log(`${LOG_PREFIX}   Appears to already be OO scale`);
            return {
                scaleFactor: 1,
                resultDimensions: {
                    widthM: dimensions.width,
                    heightM: dimensions.height,
                    depthM: dimensions.depth
                },
                realWorldDimensions: {
                    widthM: dimensions.width * OO_GAUGE.SCALE_RATIO,
                    heightM: dimensions.height * OO_GAUGE.SCALE_RATIO,
                    depthM: dimensions.depth * OO_GAUGE.SCALE_RATIO
                },
                description: 'Already OO scale (scenery/building)',
                confidence: 'medium'
            };
        }

        // Very large model - assume real-world scale
        if (maxDim > 1.0) {
            console.log(`${LOG_PREFIX}   Large model - assuming real-world scale`);
            return this.calculateFromRealWorldScale(dimensions);
        }

        // Very small model - might need scaling up (unusual)
        if (maxDim < 0.01) {
            console.log(`${LOG_PREFIX}   Very small model - may need scaling up`);
            // Scale to reasonable OO size (e.g., a small accessory at 50mm)
            const targetSize = 0.05;
            const scaleFactor = targetSize / maxDim;

            return {
                scaleFactor,
                resultDimensions: {
                    widthM: dimensions.width * scaleFactor,
                    heightM: dimensions.height * scaleFactor,
                    depthM: dimensions.depth * scaleFactor
                },
                realWorldDimensions: {
                    widthM: dimensions.width * scaleFactor * OO_GAUGE.SCALE_RATIO,
                    heightM: dimensions.height * scaleFactor * OO_GAUGE.SCALE_RATIO,
                    depthM: dimensions.depth * scaleFactor * OO_GAUGE.SCALE_RATIO
                },
                description: 'Scaled up from very small',
                confidence: 'low'
            };
        }

        // Default: no scaling
        console.log(`${LOG_PREFIX}   Using default scale (1.0)`);
        return {
            scaleFactor: 1,
            resultDimensions: {
                widthM: dimensions.width,
                heightM: dimensions.height,
                depthM: dimensions.depth
            },
            realWorldDimensions: {
                widthM: dimensions.width * OO_GAUGE.SCALE_RATIO,
                heightM: dimensions.height * OO_GAUGE.SCALE_RATIO,
                depthM: dimensions.depth * OO_GAUGE.SCALE_RATIO
            },
            description: 'Default scale (no adjustment)',
            confidence: 'low'
        };
    }

    // ========================================================================
    // REAL-WORLD DIMENSION BASED SCALING
    // ========================================================================

    /**
     * Calculate scale based on known real-world height
     * 
     * @param dimensions - Model dimensions
     * @param realWorldHeightM - Real-world height in meters
     * @returns Scale result
     */
    static calculateScaleFromRealHeight(
        dimensions: ModelDimensions,
        realWorldHeightM: number
    ): ScaleResult {
        // Target OO scale height
        const targetHeightM = OO_GAUGE.realToScale(realWorldHeightM);

        // Scale factor: target / model
        const scaleFactor = targetHeightM / dimensions.height;

        const resultDimensions = {
            widthM: dimensions.width * scaleFactor,
            heightM: dimensions.height * scaleFactor,
            depthM: dimensions.depth * scaleFactor
        };

        const realWorldDimensions = {
            widthM: resultDimensions.widthM * OO_GAUGE.SCALE_RATIO,
            heightM: resultDimensions.heightM * OO_GAUGE.SCALE_RATIO,
            depthM: resultDimensions.depthM * OO_GAUGE.SCALE_RATIO
        };

        console.log(`${LOG_PREFIX} Scale from real-world height:`);
        console.log(`${LOG_PREFIX}   Real-world height: ${realWorldHeightM}m`);
        console.log(`${LOG_PREFIX}   Target OO height: ${(targetHeightM * 1000).toFixed(1)}mm`);
        console.log(`${LOG_PREFIX}   Scale factor: ${scaleFactor.toFixed(6)}`);

        return {
            scaleFactor,
            resultDimensions,
            realWorldDimensions,
            description: `Real-world height: ${realWorldHeightM}m`,
            confidence: 'high'
        };
    }

    /**
     * Calculate scale based on known real-world width
     * 
     * @param dimensions - Model dimensions
     * @param realWorldWidthM - Real-world width in meters
     * @returns Scale result
     */
    static calculateScaleFromRealWidth(
        dimensions: ModelDimensions,
        realWorldWidthM: number
    ): ScaleResult {
        // Target OO scale width
        const targetWidthM = OO_GAUGE.realToScale(realWorldWidthM);

        // Scale factor: target / model
        const scaleFactor = targetWidthM / dimensions.width;

        const resultDimensions = {
            widthM: dimensions.width * scaleFactor,
            heightM: dimensions.height * scaleFactor,
            depthM: dimensions.depth * scaleFactor
        };

        const realWorldDimensions = {
            widthM: resultDimensions.widthM * OO_GAUGE.SCALE_RATIO,
            heightM: resultDimensions.heightM * OO_GAUGE.SCALE_RATIO,
            depthM: resultDimensions.depthM * OO_GAUGE.SCALE_RATIO
        };

        console.log(`${LOG_PREFIX} Scale from real-world width:`);
        console.log(`${LOG_PREFIX}   Real-world width: ${realWorldWidthM}m`);
        console.log(`${LOG_PREFIX}   Target OO width: ${(targetWidthM * 1000).toFixed(1)}mm`);
        console.log(`${LOG_PREFIX}   Scale factor: ${scaleFactor.toFixed(6)}`);

        return {
            scaleFactor,
            resultDimensions,
            realWorldDimensions,
            description: `Real-world width: ${realWorldWidthM}m`,
            confidence: 'high'
        };
    }

    /**
     * Calculate scale based on known real-world depth
     * 
     * @param dimensions - Model dimensions
     * @param realWorldDepthM - Real-world depth in meters
     * @returns Scale result
     */
    static calculateScaleFromRealDepth(
        dimensions: ModelDimensions,
        realWorldDepthM: number
    ): ScaleResult {
        // Target OO scale depth
        const targetDepthM = OO_GAUGE.realToScale(realWorldDepthM);

        // Scale factor: target / model
        const scaleFactor = targetDepthM / dimensions.depth;

        const resultDimensions = {
            widthM: dimensions.width * scaleFactor,
            heightM: dimensions.height * scaleFactor,
            depthM: dimensions.depth * scaleFactor
        };

        const realWorldDimensions = {
            widthM: resultDimensions.widthM * OO_GAUGE.SCALE_RATIO,
            heightM: resultDimensions.heightM * OO_GAUGE.SCALE_RATIO,
            depthM: resultDimensions.depthM * OO_GAUGE.SCALE_RATIO
        };

        console.log(`${LOG_PREFIX} Scale from real-world depth:`);
        console.log(`${LOG_PREFIX}   Real-world depth: ${realWorldDepthM}m`);
        console.log(`${LOG_PREFIX}   Target OO depth: ${(targetDepthM * 1000).toFixed(1)}mm`);
        console.log(`${LOG_PREFIX}   Scale factor: ${scaleFactor.toFixed(6)}`);

        return {
            scaleFactor,
            resultDimensions,
            realWorldDimensions,
            description: `Real-world depth: ${realWorldDepthM}m`,
            confidence: 'high'
        };
    }

    /**
     * Calculate scale using a direct scale factor
     * 
     * @param dimensions - Model dimensions
     * @param scaleFactor - Direct scale factor to apply
     * @returns Scale result
     */
    static calculateDirectScale(
        dimensions: ModelDimensions,
        scaleFactor: number
    ): ScaleResult {
        const resultDimensions = {
            widthM: dimensions.width * scaleFactor,
            heightM: dimensions.height * scaleFactor,
            depthM: dimensions.depth * scaleFactor
        };

        const realWorldDimensions = {
            widthM: resultDimensions.widthM * OO_GAUGE.SCALE_RATIO,
            heightM: resultDimensions.heightM * OO_GAUGE.SCALE_RATIO,
            depthM: resultDimensions.depthM * OO_GAUGE.SCALE_RATIO
        };

        console.log(`${LOG_PREFIX} Direct scale:`);
        console.log(`${LOG_PREFIX}   Scale factor: ${scaleFactor.toFixed(6)}`);
        console.log(`${LOG_PREFIX}   Result: ${(resultDimensions.widthM * 1000).toFixed(1)}mm x ${(resultDimensions.heightM * 1000).toFixed(1)}mm x ${(resultDimensions.depthM * 1000).toFixed(1)}mm`);

        return {
            scaleFactor,
            resultDimensions,
            realWorldDimensions,
            description: `Direct scale: ${scaleFactor.toFixed(4)}`,
            confidence: scaleFactor === 1 ? 'medium' : 'high'
        };
    }

    // ========================================================================
    // UTILITY METHODS
    // ========================================================================

    /**
     * Calculate scale to fit within a maximum dimension
     * @param dimensions - Model dimensions
     * @param maxSizeM - Maximum allowed size in meters
     * @returns Scale factor
     */
    static calculateFitScale(dimensions: ModelDimensions, maxSizeM: number): number {
        if (dimensions.maxDimension <= 0) return 1;
        if (dimensions.maxDimension <= maxSizeM) return 1;
        return maxSizeM / dimensions.maxDimension;
    }

    /**
     * Format a dimension for display
     * @param meters - Dimension in meters
     * @returns Formatted string with appropriate units
     */
    static formatDimension(meters: number): string {
        if (meters < 0.001) {
            // Micrometers
            return `${(meters * 1000000).toFixed(1)}µm`;
        } else if (meters < 0.01) {
            // Millimeters with decimal
            return `${(meters * 1000).toFixed(2)}mm`;
        } else if (meters < 1) {
            // Millimeters
            return `${(meters * 1000).toFixed(1)}mm`;
        } else {
            // Meters
            return `${meters.toFixed(3)}m`;
        }
    }

    /**
     * Get list of available reference dimension keys
     */
    static getAvailableReferences(): Array<{ key: string; description: string }> {
        return Object.entries(REFERENCE_DIMENSIONS).map(([key, value]) => ({
            key,
            description: value.description
        }));
    }

    /**
     * Get list of rolling stock types
     */
    static getRollingStockTypes(): Array<{ type: RollingStockType; description: string; lengthMM: number }> {
        return Object.entries(OO_ROLLING_STOCK_TARGETS).map(([type, value]) => ({
            type: type as RollingStockType,
            description: value.description,
            lengthMM: value.lengthM * 1000
        }));
    }
}

// ============================================================================
// END OF FILE
// ============================================================================