/**
 * GaugeScaleCalculator.ts - Automatic scaling for rolling stock based on track gauge
 * 
 * Path: frontend/src/systems/scaling/GaugeScaleCalculator.ts
 * 
 * This system automatically calculates the correct scale for rolling stock models
 * by analyzing the model's geometry and matching it to OO gauge track dimensions.
 * 
 * HOW IT WORKS:
 * 1. Analyzes the model's bounding box at "wheel height" (bottom of model)
 * 2. Measures the lateral width at that height (represents wheel/axle spread)
 * 3. Compares to the target track gauge (16.5mm for OO)
 * 4. Calculates scale factor: targetGauge / modelGauge
 * 
 * OO GAUGE SPECIFICATIONS:
 * - Track gauge: 16.5mm between rail inner edges
 * - Scale: 1:76.2
 * - Typical coach length: ~260mm (real: ~20m)
 * - Typical locomotive length: ~200-300mm depending on prototype
 * 
 * @module GaugeScaleCalculator
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';

// ============================================================================
// CONSTANTS - OO GAUGE SPECIFICATIONS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[GaugeScaleCalculator]';

/**
 * OO Gauge track and rolling stock specifications (in meters)
 * These are the TARGET dimensions we want models to match
 */
export const OO_GAUGE_SPECS = {
    // ------------------------------------------------------------------------
    // TRACK DIMENSIONS
    // ------------------------------------------------------------------------

    /** Track gauge - distance between rail inner edges (16.5mm) */
    TRACK_GAUGE_M: 0.0165,

    /** Rail head width (2.5mm typical) */
    RAIL_WIDTH_M: 0.0025,

    /** Rail height above sleeper (3mm) */
    RAIL_HEIGHT_M: 0.003,

    // ------------------------------------------------------------------------
    // WHEEL DIMENSIONS (what we're matching to)
    // ------------------------------------------------------------------------

    /** 
     * Back-to-back wheel spacing (14.5mm for OO)
     * This is the distance between the inside faces of wheels on an axle
     */
    WHEEL_BACK_TO_BACK_M: 0.0145,

    /**
     * Wheel flange width (adds to overall axle width)
     * Total axle width ≈ back-to-back + 2 × flange ≈ 18-19mm
     */
    WHEEL_FLANGE_WIDTH_M: 0.002,

    /**
     * Overall wheel/axle width including flanges (~18.5mm)
     * This is what we expect to measure at the bottom of a correct-scale model
     */
    TARGET_AXLE_WIDTH_M: 0.0185,

    /**
     * Wheel diameter range for OO (typically 10-14mm for coaches, larger for locos)
     */
    WHEEL_DIAMETER_MIN_M: 0.010,
    WHEEL_DIAMETER_MAX_M: 0.020,

    // ------------------------------------------------------------------------
    // ROLLING STOCK TYPICAL DIMENSIONS (for reference/validation)
    // ------------------------------------------------------------------------

    /** Typical coach body width (~30mm / 2.3m real) */
    COACH_WIDTH_M: 0.030,

    /** Typical coach length (~260mm / 20m real) */
    COACH_LENGTH_M: 0.260,

    /** Typical locomotive width (~35mm / 2.7m real) */
    LOCO_WIDTH_M: 0.035,

    /** Typical locomotive length (~200-300mm depending on type) */
    LOCO_LENGTH_MIN_M: 0.200,
    LOCO_LENGTH_MAX_M: 0.350,

    // ------------------------------------------------------------------------
    // SCALE FACTOR
    // ------------------------------------------------------------------------

    /** OO scale ratio (1:76.2) */
    SCALE_RATIO: 76.2,

} as const;

/**
 * Configuration for the gauge calculator
 */
export interface GaugeCalculatorConfig {
    /** Target track gauge in meters (default: OO = 0.0165) */
    targetGaugeM: number;

    /** Target axle/wheel width in meters (default: 0.0185) */
    targetAxleWidthM: number;

    /** Height from bottom to sample for wheel detection (percentage of total height) */
    wheelHeightSamplePercent: number;

    /** Minimum valid scale factor */
    minScale: number;

    /** Maximum valid scale factor */
    maxScale: number;

    /** Whether to log detailed analysis */
    verbose: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_GAUGE_CONFIG: GaugeCalculatorConfig = {
    targetGaugeM: OO_GAUGE_SPECS.TRACK_GAUGE_M,
    targetAxleWidthM: OO_GAUGE_SPECS.TARGET_AXLE_WIDTH_M,
    wheelHeightSamplePercent: 0.15, // Sample bottom 15% of model height
    minScale: 0.1,   // 10% minimum
    maxScale: 10.0,  // 1000% maximum
    verbose: true,
};

/**
 * Result of gauge analysis
 */
export interface GaugeAnalysisResult {
    /** Whether analysis was successful */
    success: boolean;

    /** Calculated scale factor to apply */
    scaleFactor: number;

    /** Measured width at wheel height (in model's original units) */
    measuredWidthM: number;

    /** Target width we're scaling to */
    targetWidthM: number;

    /** Confidence level (0-1) based on measurement quality */
    confidence: number;

    /** Human-readable explanation */
    explanation: string;

    /** Detailed measurements for debugging */
    details: {
        /** Original bounding box dimensions */
        originalBounds: { width: number; height: number; depth: number };
        /** Height at which width was sampled */
        sampleHeightM: number;
        /** Width measured at sample height */
        widthAtSampleM: number;
        /** Estimated model type based on proportions */
        estimatedType: 'locomotive' | 'coach' | 'wagon' | 'unknown';
    };

    /** Any warnings about the analysis */
    warnings: string[];
}

// ============================================================================
// GAUGE SCALE CALCULATOR CLASS
// ============================================================================

/**
 * GaugeScaleCalculator - Automatically calculates correct scale for rolling stock
 * 
 * Analyzes model geometry to determine the appropriate scale factor that will
 * make the model fit OO gauge track correctly.
 * 
 * @example
 * ```typescript
 * const calculator = new GaugeScaleCalculator();
 * 
 * // After loading a model
 * const result = calculator.analyzeAndCalculateScale(modelMeshes);
 * 
 * if (result.success) {
 *     console.log(`Apply scale: ${result.scaleFactor}`);
 *     // Scale the model by result.scaleFactor
 * }
 * ```
 */
export class GaugeScaleCalculator {
    // ========================================================================
    // PROPERTIES
    // ========================================================================

    /** Configuration */
    private config: GaugeCalculatorConfig;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new GaugeScaleCalculator
     * 
     * @param config - Optional configuration overrides
     */
    constructor(config?: Partial<GaugeCalculatorConfig>) {
        this.config = { ...DEFAULT_GAUGE_CONFIG, ...config };

        console.log(`${LOG_PREFIX} Created with target gauge: ${this.config.targetGaugeM * 1000}mm`);
    }

    // ========================================================================
    // MAIN ANALYSIS METHOD
    // ========================================================================

    /**
     * Analyze model meshes and calculate the correct scale factor
     * 
     * This is the main entry point - pass in the meshes from an imported model
     * and get back the scale factor needed to match OO gauge.
     * 
     * @param meshes - Array of meshes from the imported model
     * @param rootNode - Optional root transform node (for getting world transforms)
     * @returns Analysis result with scale factor
     */
    analyzeAndCalculateScale(
        meshes: AbstractMesh[],
        rootNode?: TransformNode
    ): GaugeAnalysisResult {
        const warnings: string[] = [];

        try {
            if (!meshes || meshes.length === 0) {
                return this.createFailureResult('No meshes provided for analysis');
            }

            if (this.config.verbose) {
                console.log(`${LOG_PREFIX} Analyzing ${meshes.length} meshes...`);
            }

            // ------------------------------------------------------------------------
            // STEP 1: Calculate combined bounding box of all meshes
            // ------------------------------------------------------------------------

            const bounds = this.calculateCombinedBounds(meshes);

            if (!bounds) {
                return this.createFailureResult('Could not calculate mesh bounds');
            }

            const width = bounds.max.x - bounds.min.x;
            const height = bounds.max.y - bounds.min.y;
            const depth = bounds.max.z - bounds.min.z;

            if (this.config.verbose) {
                console.log(`${LOG_PREFIX} Model bounds (m): ${width.toFixed(4)} W × ${height.toFixed(4)} H × ${depth.toFixed(4)} D`);
                console.log(`${LOG_PREFIX} Model bounds (mm): ${(width * 1000).toFixed(1)} W × ${(height * 1000).toFixed(1)} H × ${(depth * 1000).toFixed(1)} D`);
            }

            // ------------------------------------------------------------------------
            // STEP 2: Estimate model type based on proportions
            // ------------------------------------------------------------------------

            const estimatedType = this.estimateModelType(width, height, depth);

            if (this.config.verbose) {
                console.log(`${LOG_PREFIX} Estimated type: ${estimatedType}`);
            }

            // ------------------------------------------------------------------------
            // STEP 3: Measure width at wheel height
            // ------------------------------------------------------------------------

            // For rolling stock, the width at the bottom (wheel/bogie level) is what
            // we want to match to the track gauge
            const sampleHeight = bounds.min.y + (height * this.config.wheelHeightSamplePercent);

            // For simple bounding box analysis, we use the overall width
            // A more sophisticated version could slice the mesh at wheel height
            const widthAtWheelHeight = this.measureWidthAtHeight(meshes, sampleHeight, bounds);

            if (this.config.verbose) {
                console.log(`${LOG_PREFIX} Width at wheel height (${(sampleHeight * 1000).toFixed(1)}mm): ${(widthAtWheelHeight * 1000).toFixed(2)}mm`);
            }

            // ------------------------------------------------------------------------
            // STEP 4: Determine what we're measuring
            // ------------------------------------------------------------------------

            // The width at wheel height should represent the wheel/axle spread
            // However, if the model includes body overhang at low height, we need
            // to account for that

            // Heuristic: If width at wheel height is much larger than expected axle
            // width, the model might have body overhang or be at wrong scale

            let effectiveWidth = widthAtWheelHeight;
            let targetWidth = this.config.targetAxleWidthM;

            // Check if width seems like body width rather than axle width
            if (widthAtWheelHeight > OO_GAUGE_SPECS.COACH_WIDTH_M * 0.5) {
                // Width is large - likely measuring body, not wheels
                // Use overall width and target coach body width instead
                warnings.push('Measuring body width rather than wheel width');
                effectiveWidth = width;
                targetWidth = OO_GAUGE_SPECS.COACH_WIDTH_M;

                if (this.config.verbose) {
                    console.log(`${LOG_PREFIX} Large width detected - using body width for scaling`);
                }
            }

            // ------------------------------------------------------------------------
            // STEP 5: Calculate scale factor
            // ------------------------------------------------------------------------

            // Scale factor = target / measured
            // If model is too big, scale < 1; if too small, scale > 1
            let scaleFactor = targetWidth / effectiveWidth;

            if (this.config.verbose) {
                console.log(`${LOG_PREFIX} Raw scale factor: ${scaleFactor.toFixed(4)} (${targetWidth.toFixed(4)} / ${effectiveWidth.toFixed(4)})`);
            }

            // Validate scale factor
            if (scaleFactor < this.config.minScale) {
                warnings.push(`Scale factor ${scaleFactor.toFixed(3)} below minimum ${this.config.minScale}, clamping`);
                scaleFactor = this.config.minScale;
            } else if (scaleFactor > this.config.maxScale) {
                warnings.push(`Scale factor ${scaleFactor.toFixed(3)} above maximum ${this.config.maxScale}, clamping`);
                scaleFactor = this.config.maxScale;
            }

            // ------------------------------------------------------------------------
            // STEP 6: Calculate confidence
            // ------------------------------------------------------------------------

            const confidence = this.calculateConfidence(
                effectiveWidth,
                targetWidth,
                estimatedType,
                warnings.length
            );

            // ------------------------------------------------------------------------
            // STEP 7: Build result
            // ------------------------------------------------------------------------

            const explanation = this.buildExplanation(
                effectiveWidth,
                targetWidth,
                scaleFactor,
                estimatedType,
                confidence
            );

            // Log final result
            console.log(`${LOG_PREFIX} ✓ Scale factor: ${scaleFactor.toFixed(4)} (${(scaleFactor * 100).toFixed(1)}%)`);
            console.log(`${LOG_PREFIX}   Confidence: ${(confidence * 100).toFixed(0)}%`);

            if (warnings.length > 0) {
                console.warn(`${LOG_PREFIX} Warnings:`, warnings);
            }

            return {
                success: true,
                scaleFactor,
                measuredWidthM: effectiveWidth,
                targetWidthM: targetWidth,
                confidence,
                explanation,
                details: {
                    originalBounds: { width, height, depth },
                    sampleHeightM: sampleHeight,
                    widthAtSampleM: widthAtWheelHeight,
                    estimatedType,
                },
                warnings,
            };

        } catch (error) {
            console.error(`${LOG_PREFIX} Analysis failed:`, error);
            return this.createFailureResult(`Analysis error: ${error}`);
        }
    }

    // ========================================================================
    // BOUNDING BOX CALCULATION
    // ========================================================================

    /**
     * Calculate combined bounding box of all meshes
     * 
     * @param meshes - Array of meshes
     * @returns Combined bounds or null if failed
     */
    private calculateCombinedBounds(
        meshes: AbstractMesh[]
    ): { min: Vector3; max: Vector3 } | null {
        try {
            let minX = Infinity, minY = Infinity, minZ = Infinity;
            let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
            let validMeshCount = 0;

            for (const mesh of meshes) {
                // Skip meshes without geometry
                if (!mesh.getBoundingInfo) continue;

                try {
                    // Force bounding info update
                    mesh.computeWorldMatrix(true);
                    const boundingInfo = mesh.getBoundingInfo();

                    if (!boundingInfo || !boundingInfo.boundingBox) continue;

                    const worldMin = boundingInfo.boundingBox.minimumWorld;
                    const worldMax = boundingInfo.boundingBox.maximumWorld;

                    // Skip invalid bounds
                    if (!isFinite(worldMin.x) || !isFinite(worldMax.x)) continue;

                    minX = Math.min(minX, worldMin.x);
                    minY = Math.min(minY, worldMin.y);
                    minZ = Math.min(minZ, worldMin.z);
                    maxX = Math.max(maxX, worldMax.x);
                    maxY = Math.max(maxY, worldMax.y);
                    maxZ = Math.max(maxZ, worldMax.z);

                    validMeshCount++;

                } catch (meshError) {
                    // Skip problematic meshes
                    continue;
                }
            }

            if (validMeshCount === 0 || !isFinite(minX)) {
                console.warn(`${LOG_PREFIX} No valid mesh bounds found`);
                return null;
            }

            return {
                min: new Vector3(minX, minY, minZ),
                max: new Vector3(maxX, maxY, maxZ),
            };

        } catch (error) {
            console.error(`${LOG_PREFIX} Error calculating bounds:`, error);
            return null;
        }
    }

    // ========================================================================
    // WIDTH MEASUREMENT
    // ========================================================================

    /**
     * Measure the model width at a specific height
     * 
     * For a more accurate measurement, this could slice through mesh geometry.
     * For now, we use the bounding box width (which is a good approximation
     * for most rolling stock models).
     * 
     * @param meshes - Array of meshes
     * @param targetHeight - Y height to measure at
     * @param bounds - Pre-calculated bounds
     * @returns Width at the specified height
     */
    private measureWidthAtHeight(
        meshes: AbstractMesh[],
        targetHeight: number,
        bounds: { min: Vector3; max: Vector3 }
    ): number {
        // Simple approach: return bounding box width
        // This assumes the model's width at wheel height is similar to overall width
        // (which is true for most rolling stock - coaches and locos have relatively
        // consistent width from wheels to body)

        const overallWidth = bounds.max.x - bounds.min.x;

        // For a more sophisticated analysis, we could:
        // 1. Ray cast across the model at targetHeight to find actual width
        // 2. Analyze vertex positions to find width at that Y level
        // 3. Look for wheel/bogie meshes specifically

        // For now, the bounding box approach works well enough for OO gauge scaling
        return overallWidth;
    }

    // ========================================================================
    // MODEL TYPE ESTIMATION
    // ========================================================================

    /**
     * Estimate the type of rolling stock based on proportions
     * 
     * @param width - Model width
     * @param height - Model height
     * @param depth - Model depth (length)
     * @returns Estimated type
     */
    private estimateModelType(
        width: number,
        height: number,
        depth: number
    ): 'locomotive' | 'coach' | 'wagon' | 'unknown' {
        // Length is typically along Z (depth)
        const length = Math.max(width, depth);
        const actualWidth = Math.min(width, depth);

        // Aspect ratio: length / width
        const aspectRatio = length / actualWidth;

        // Height ratio: height / width
        const heightRatio = height / actualWidth;

        if (this.config.verbose) {
            console.log(`${LOG_PREFIX} Aspect ratio: ${aspectRatio.toFixed(2)}, Height ratio: ${heightRatio.toFixed(2)}`);
        }

        // Coaches are typically long and narrow (aspect > 6)
        if (aspectRatio > 6) {
            return 'coach';
        }

        // Locomotives are medium length, taller
        if (aspectRatio > 3 && heightRatio > 0.8) {
            return 'locomotive';
        }

        // Wagons are medium length, shorter height
        if (aspectRatio > 2 && aspectRatio < 6) {
            return 'wagon';
        }

        return 'unknown';
    }

    // ========================================================================
    // CONFIDENCE CALCULATION
    // ========================================================================

    /**
     * Calculate confidence level for the scale analysis
     * 
     * @param measuredWidth - What we measured
     * @param targetWidth - What we're targeting
     * @param modelType - Estimated model type
     * @param warningCount - Number of warnings generated
     * @returns Confidence from 0 to 1
     */
    private calculateConfidence(
        measuredWidth: number,
        targetWidth: number,
        modelType: 'locomotive' | 'coach' | 'wagon' | 'unknown',
        warningCount: number
    ): number {
        let confidence = 1.0;

        // Reduce confidence for unknown model type
        if (modelType === 'unknown') {
            confidence -= 0.2;
        }

        // Reduce confidence based on how extreme the scale factor is
        const scaleFactor = targetWidth / measuredWidth;
        if (scaleFactor < 0.5 || scaleFactor > 2.0) {
            confidence -= 0.15;
        }
        if (scaleFactor < 0.2 || scaleFactor > 5.0) {
            confidence -= 0.25;
        }

        // Reduce confidence for each warning
        confidence -= warningCount * 0.1;

        // Clamp to valid range
        return Math.max(0, Math.min(1, confidence));
    }

    // ========================================================================
    // EXPLANATION GENERATION
    // ========================================================================

    /**
     * Build a human-readable explanation of the scaling decision
     */
    private buildExplanation(
        measuredWidth: number,
        targetWidth: number,
        scaleFactor: number,
        modelType: string,
        confidence: number
    ): string {
        const measuredMm = (measuredWidth * 1000).toFixed(2);
        const targetMm = (targetWidth * 1000).toFixed(2);
        const scalePercent = (scaleFactor * 100).toFixed(1);
        const confPercent = (confidence * 100).toFixed(0);

        let explanation = `Model width: ${measuredMm}mm → Target: ${targetMm}mm\n`;
        explanation += `Scale factor: ${scalePercent}% (${scaleFactor.toFixed(4)})\n`;
        explanation += `Detected type: ${modelType}\n`;
        explanation += `Confidence: ${confPercent}%`;

        return explanation;
    }

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

    /**
     * Create a failure result
     */
    private createFailureResult(reason: string): GaugeAnalysisResult {
        console.error(`${LOG_PREFIX} Analysis failed: ${reason}`);

        return {
            success: false,
            scaleFactor: 1.0, // Return 1.0 (no scaling) on failure
            measuredWidthM: 0,
            targetWidthM: this.config.targetAxleWidthM,
            confidence: 0,
            explanation: `Failed: ${reason}`,
            details: {
                originalBounds: { width: 0, height: 0, depth: 0 },
                sampleHeightM: 0,
                widthAtSampleM: 0,
                estimatedType: 'unknown',
            },
            warnings: [reason],
        };
    }

    // ========================================================================
    // UTILITY METHODS
    // ========================================================================

    /**
     * Get OO gauge specifications
     */
    getOOGaugeSpecs(): typeof OO_GAUGE_SPECS {
        return OO_GAUGE_SPECS;
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<GaugeCalculatorConfig>): void {
        this.config = { ...this.config, ...config };
        console.log(`${LOG_PREFIX} Configuration updated`);
    }

    /**
     * Convert real-world dimensions to OO scale
     * 
     * @param realWorldM - Real world dimension in meters
     * @returns OO scale dimension in meters
     */
    realToOOScale(realWorldM: number): number {
        return realWorldM / OO_GAUGE_SPECS.SCALE_RATIO;
    }

    /**
     * Convert OO scale dimensions to real-world
     * 
     * @param ooScaleM - OO scale dimension in meters
     * @returns Real world dimension in meters
     */
    ooToRealScale(ooScaleM: number): number {
        return ooScaleM * OO_GAUGE_SPECS.SCALE_RATIO;
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/** Global gauge calculator instance */
let globalGaugeCalculator: GaugeScaleCalculator | null = null;

/**
 * Get the global GaugeScaleCalculator instance
 */
export function getGlobalGaugeCalculator(): GaugeScaleCalculator {
    if (!globalGaugeCalculator) {
        globalGaugeCalculator = new GaugeScaleCalculator();
    }
    return globalGaugeCalculator;
}

// ============================================================================
// BROWSER CONSOLE UTILITIES
// ============================================================================

/**
 * Register browser console utilities for testing
 */
export function registerGaugeCalculatorConsoleUtils(): void {
    const calc = getGlobalGaugeCalculator();

    // Manual scale calculation helper
    (window as any).calculateOOScale = (widthMm: number) => {
        const widthM = widthMm / 1000;
        const targetM = OO_GAUGE_SPECS.COACH_WIDTH_M;
        const scale = targetM / widthM;
        console.log(`Width ${widthMm}mm → Scale: ${(scale * 100).toFixed(1)}% (${scale.toFixed(4)})`);
        return scale;
    };

    // Real to OO scale converter
    (window as any).realToOO = (realMm: number) => {
        const ooMm = realMm / OO_GAUGE_SPECS.SCALE_RATIO;
        console.log(`Real: ${realMm}mm → OO: ${ooMm.toFixed(2)}mm`);
        return ooMm;
    };

    // OO to real scale converter
    (window as any).ooToReal = (ooMm: number) => {
        const realMm = ooMm * OO_GAUGE_SPECS.SCALE_RATIO;
        console.log(`OO: ${ooMm}mm → Real: ${realMm.toFixed(0)}mm (${(realMm / 1000).toFixed(2)}m)`);
        return realMm;
    };

    // Show OO gauge specs
    (window as any).showOOSpecs = () => {
        console.log('');
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║                    OO GAUGE SPECIFICATIONS                 ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log(`║  Scale ratio: 1:${OO_GAUGE_SPECS.SCALE_RATIO}                                      ║`);
        console.log(`║  Track gauge: ${OO_GAUGE_SPECS.TRACK_GAUGE_M * 1000}mm                                       ║`);
        console.log(`║  Rail height: ${OO_GAUGE_SPECS.RAIL_HEIGHT_M * 1000}mm                                         ║`);
        console.log(`║  Target axle width: ${OO_GAUGE_SPECS.TARGET_AXLE_WIDTH_M * 1000}mm                              ║`);
        console.log(`║  Coach body width: ${OO_GAUGE_SPECS.COACH_WIDTH_M * 1000}mm                                ║`);
        console.log(`║  Coach length: ${OO_GAUGE_SPECS.COACH_LENGTH_M * 1000}mm                                   ║`);
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log('');
        console.log('Console commands:');
        console.log('  calculateOOScale(widthMm) - Calculate scale from model width');
        console.log('  realToOO(realMm)          - Convert real-world to OO scale');
        console.log('  ooToReal(ooMm)            - Convert OO scale to real-world');
        console.log('');
    };

    console.log(`${LOG_PREFIX} Console utilities registered. Type showOOSpecs() for help.`);
}