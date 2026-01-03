/**
 * TrainPositionHelper.ts - Centralized train positioning utilities
 * 
 * Path: frontend/src/systems/train/TrainPositionHelper.ts
 * 
 * Provides correct positioning of trains on track:
 * - Calculates model bounding box to find bottom (wheels)
 * - Positions model so bottom sits on rail top surface
 * - Optionally auto-scales model to fit OO gauge dimensions
 * - Handles various model origin conventions
 * 
 * CRITICAL HEIGHTS (OO Gauge):
 * - Baseboard surface:  0.950m
 * - Rail top surface:   0.958m (8mm above baseboard)
 * - Model bottom:       Should touch rail top (0.958m)
 * 
 * @module TrainPositionHelper
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';

// ============================================================================
// CONSTANTS - TRACK GEOMETRY (OO GAUGE)
// ============================================================================

/**
 * Critical height constants for OO gauge track
 * All values in meters
 */
export const TRACK_HEIGHTS = {
    /** Baseboard surface height from world origin */
    BASEBOARD_TOP: 0.950,

    /** Ballast layer height (3mm) */
    BALLAST_HEIGHT: 0.003,

    /** Sleeper height above ballast (2mm) */
    SLEEPER_HEIGHT: 0.002,

    /** Rail height above sleepers (3mm) */
    RAIL_HEIGHT: 0.003,

    /** Total offset from baseboard to rail top (8mm) */
    RAIL_TOP_OFFSET: 0.008,

    /** Absolute Y coordinate of rail top surface */
    get RAIL_TOP_Y(): number {
        return this.BASEBOARD_TOP + this.RAIL_TOP_OFFSET;
    },

    /** Track graph nodes are at this Y level (baseboard) */
    TRACK_NODE_Y: 0.950,

    /** Offset needed to raise from track node Y to rail top Y */
    get NODE_TO_RAIL_OFFSET(): number {
        return this.RAIL_TOP_Y - this.TRACK_NODE_Y;
    }
} as const;

/**
 * OO Gauge rolling stock typical dimensions (in meters, at OO scale 1:76.2)
 * Used for auto-scaling reference
 */
export const OO_GAUGE_DIMENSIONS = {
    /** Track gauge (rail spacing) - 16.5mm */
    TRACK_GAUGE: 0.0165,

    /** Typical locomotive length - 200-280mm */
    LOCO_LENGTH_MIN: 0.200,
    LOCO_LENGTH_MAX: 0.280,

    /** Typical coach length - 250-305mm */
    COACH_LENGTH_MIN: 0.250,
    COACH_LENGTH_MAX: 0.305,

    /** Typical wagon length - 100-150mm */
    WAGON_LENGTH_MIN: 0.100,
    WAGON_LENGTH_MAX: 0.150,

    /** Typical body width - 30-35mm */
    BODY_WIDTH: 0.032,

    /** Typical body height (from rail) - 40-50mm */
    BODY_HEIGHT: 0.045,

    /** Wheel diameter - typically 10-14mm for locos */
    WHEEL_DIAMETER_LOCO: 0.012,

    /** Wheel diameter - typically 8-10mm for coaches/wagons */
    WHEEL_DIAMETER_STOCK: 0.009,
} as const;

// ============================================================================
// LOGGING
// ============================================================================

const LOG_PREFIX = '[TrainPositionHelper]';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Model bounding information
 */
export interface ModelBounds {
    /** Minimum corner of bounding box (local space) */
    min: Vector3;

    /** Maximum corner of bounding box (local space) */
    max: Vector3;

    /** Model dimensions */
    width: number;   // X axis
    height: number;  // Y axis
    depth: number;   // Z axis

    /** Center point of bounding box (local space) */
    center: Vector3;

    /** Bottom center point (where wheels should touch track) */
    bottomCenter: Vector3;
}

/**
 * Position calculation result
 */
export interface PositionResult {
    /** World position for the model's transform node */
    position: Vector3;

    /** Y offset applied (for debugging) */
    yOffset: number;

    /** Was the model repositioned? */
    wasAdjusted: boolean;
}

/**
 * Auto-scale calculation result
 */
export interface AutoScaleResult {
    /** Recommended scale factor */
    scaleFactor: number;

    /** Detected rolling stock type */
    detectedType: 'locomotive' | 'coach' | 'wagon' | 'unknown';

    /** Target length used for calculation */
    targetLength: number;

    /** Original model length */
    originalLength: number;

    /** Confidence in the detection (0-1) */
    confidence: number;
}

/**
 * Options for positioning
 */
export interface PositionOptions {
    /** Use custom Y position instead of rail top */
    customY?: number;

    /** Additional Y offset (for fine-tuning) */
    additionalOffset?: number;

    /** Apply auto-scale to fit OO gauge */
    autoScale?: boolean;

    /** Rolling stock type hint for auto-scaling */
    typeHint?: 'locomotive' | 'coach' | 'wagon';
}

// ============================================================================
// TRAIN POSITION HELPER CLASS
// ============================================================================

/**
 * TrainPositionHelper - Utility for correct train positioning on track
 * 
 * Ensures trains are placed at the correct height with their wheels
 * (bottom of model) sitting on the rail top surface.
 * 
 * @example
 * ```typescript
 * const helper = new TrainPositionHelper();
 * 
 * // Position a train model on track
 * const result = helper.positionOnTrack(
 *     trainNode,
 *     trainMeshes,
 *     trackPosition  // X/Z from track, Y will be calculated
 * );
 * 
 * // Auto-scale and position
 * const scaled = helper.autoScaleAndPosition(
 *     trainNode,
 *     trainMeshes,
 *     trackPosition,
 *     { typeHint: 'locomotive' }
 * );
 * ```
 */
export class TrainPositionHelper {

    // ========================================================================
    // MODEL BOUNDS CALCULATION
    // ========================================================================

    /**
     * Calculate the bounding box of a model from its meshes
     * 
     * @param node - Root transform node
     * @param meshes - Array of meshes in the model
     * @returns Model bounds information
     */
    calculateModelBounds(node: TransformNode, meshes: AbstractMesh[]): ModelBounds {
        // Initialize with extreme values
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        // Get current scale to account for it
        const scale = node.scaling.clone();

        // Temporarily reset scale to get unscaled bounds
        node.scaling.setAll(1);

        for (const mesh of meshes) {
            try {
                // Force world matrix update
                mesh.computeWorldMatrix(true);

                const boundingInfo = mesh.getBoundingInfo();
                if (!boundingInfo) continue;

                // Get local bounds (relative to node)
                const boundingBox = boundingInfo.boundingBox;

                // Transform to local space of the root node
                const localMin = boundingBox.minimum;
                const localMax = boundingBox.maximum;

                minX = Math.min(minX, localMin.x);
                maxX = Math.max(maxX, localMax.x);
                minY = Math.min(minY, localMin.y);
                maxY = Math.max(maxY, localMax.y);
                minZ = Math.min(minZ, localMin.z);
                maxZ = Math.max(maxZ, localMax.z);

            } catch (e) {
                console.warn(`${LOG_PREFIX} Could not get bounds for mesh:`, e);
                continue;
            }
        }

        // Restore scale
        node.scaling = scale;

        // Handle case where no valid bounds were found
        if (!isFinite(minX)) {
            console.warn(`${LOG_PREFIX} No valid bounds found, using defaults`);
            return {
                min: Vector3.Zero(),
                max: Vector3.Zero(),
                width: 0,
                height: 0,
                depth: 0,
                center: Vector3.Zero(),
                bottomCenter: Vector3.Zero()
            };
        }

        const min = new Vector3(minX, minY, minZ);
        const max = new Vector3(maxX, maxY, maxZ);

        const width = maxX - minX;
        const height = maxY - minY;
        const depth = maxZ - minZ;

        const center = new Vector3(
            (minX + maxX) / 2,
            (minY + maxY) / 2,
            (minZ + maxZ) / 2
        );

        const bottomCenter = new Vector3(
            (minX + maxX) / 2,
            minY,
            (minZ + maxZ) / 2
        );

        console.log(`${LOG_PREFIX} Model bounds calculated:`);
        console.log(`${LOG_PREFIX}   Min: (${minX.toFixed(4)}, ${minY.toFixed(4)}, ${minZ.toFixed(4)})`);
        console.log(`${LOG_PREFIX}   Max: (${maxX.toFixed(4)}, ${maxY.toFixed(4)}, ${maxZ.toFixed(4)})`);
        console.log(`${LOG_PREFIX}   Size: ${(width * 1000).toFixed(1)}mm × ${(height * 1000).toFixed(1)}mm × ${(depth * 1000).toFixed(1)}mm`);

        return {
            min,
            max,
            width,
            height,
            depth,
            center,
            bottomCenter
        };
    }

    /**
     * Calculate bounds after applying a scale factor
     * 
     * @param bounds - Original bounds
     * @param scale - Scale factor to apply
     * @returns Scaled bounds
     */
    getScaledBounds(bounds: ModelBounds, scale: number): ModelBounds {
        return {
            min: bounds.min.scale(scale),
            max: bounds.max.scale(scale),
            width: bounds.width * scale,
            height: bounds.height * scale,
            depth: bounds.depth * scale,
            center: bounds.center.scale(scale),
            bottomCenter: bounds.bottomCenter.scale(scale)
        };
    }

    // ========================================================================
    // POSITIONING ON TRACK
    // ========================================================================

    /**
     * Position a model so its bottom sits on the rail top surface
     * 
     * @param node - Root transform node of the model
     * @param meshes - Array of meshes in the model
     * @param trackPosition - Position on track (X/Z used, Y recalculated)
     * @param options - Positioning options
     * @returns Position result with applied offset
     */
    positionOnTrack(
        node: TransformNode,
        meshes: AbstractMesh[],
        trackPosition: Vector3,
        options: PositionOptions = {}
    ): PositionResult {
        // Calculate model bounds
        const bounds = this.calculateModelBounds(node, meshes);

        // Get current scale
        const scale = node.scaling.x; // Assuming uniform scale

        // Calculate scaled bounds
        const scaledBounds = this.getScaledBounds(bounds, scale);

        // Target Y for the model's bottom (where wheels touch)
        const targetBottomY = options.customY ?? TRACK_HEIGHTS.RAIL_TOP_Y;

        // The model's local minY (bottom) when scaled
        const scaledMinY = scaledBounds.min.y;

        // Calculate Y offset so bottom touches target
        // newPosition.y + scaledMinY = targetBottomY
        // newPosition.y = targetBottomY - scaledMinY
        let yOffset = targetBottomY - scaledMinY;

        // Apply additional offset if specified
        if (options.additionalOffset) {
            yOffset += options.additionalOffset;
        }

        // Build final position
        const position = new Vector3(
            trackPosition.x,
            yOffset,
            trackPosition.z
        );

        console.log(`${LOG_PREFIX} Positioning on track:`);
        console.log(`${LOG_PREFIX}   Target bottom Y: ${targetBottomY.toFixed(4)}m (rail top)`);
        console.log(`${LOG_PREFIX}   Scaled model minY: ${scaledMinY.toFixed(4)}m`);
        console.log(`${LOG_PREFIX}   Calculated Y offset: ${yOffset.toFixed(4)}m`);
        console.log(`${LOG_PREFIX}   Final position: (${position.x.toFixed(4)}, ${position.y.toFixed(4)}, ${position.z.toFixed(4)})`);

        // Apply position to node
        node.position = position;

        return {
            position,
            yOffset,
            wasAdjusted: true
        };
    }

    /**
     * Quick method to just set the correct Y position on an existing model
     * 
     * @param node - Root transform node
     * @param meshes - Meshes in the model
     */
    snapToRailHeight(node: TransformNode, meshes: AbstractMesh[]): void {
        const currentPos = node.position.clone();
        this.positionOnTrack(node, meshes, currentPos);
    }

    // ========================================================================
    // AUTO-SCALING
    // ========================================================================

    /**
     * Calculate auto-scale factor to fit OO gauge dimensions
     * 
     * @param bounds - Model bounds (unscaled)
     * @param typeHint - Type of rolling stock
     * @returns Auto-scale result
     */
    calculateAutoScale(
        bounds: ModelBounds,
        typeHint?: 'locomotive' | 'coach' | 'wagon'
    ): AutoScaleResult {
        // Determine which dimension is "length" (longest horizontal)
        const length = Math.max(bounds.width, bounds.depth);
        const width = Math.min(bounds.width, bounds.depth);

        // Detect type if not provided
        let detectedType: 'locomotive' | 'coach' | 'wagon' | 'unknown' = typeHint || 'unknown';
        let targetLength: number;
        let confidence = 0.5;

        if (detectedType === 'unknown') {
            // Try to detect based on proportions
            const aspectRatio = length / width;

            if (length > 0.5) {
                // Very long - likely a coach
                detectedType = 'coach';
                confidence = 0.7;
            } else if (length > 0.3) {
                // Medium length - could be locomotive
                detectedType = 'locomotive';
                confidence = 0.6;
            } else {
                // Short - likely wagon
                detectedType = 'wagon';
                confidence = 0.6;
            }
        } else {
            confidence = 0.9; // User provided hint
        }

        // Select target length based on type
        switch (detectedType) {
            case 'locomotive':
                targetLength = (OO_GAUGE_DIMENSIONS.LOCO_LENGTH_MIN + OO_GAUGE_DIMENSIONS.LOCO_LENGTH_MAX) / 2;
                break;
            case 'coach':
                targetLength = (OO_GAUGE_DIMENSIONS.COACH_LENGTH_MIN + OO_GAUGE_DIMENSIONS.COACH_LENGTH_MAX) / 2;
                break;
            case 'wagon':
                targetLength = (OO_GAUGE_DIMENSIONS.WAGON_LENGTH_MIN + OO_GAUGE_DIMENSIONS.WAGON_LENGTH_MAX) / 2;
                break;
            default:
                targetLength = OO_GAUGE_DIMENSIONS.LOCO_LENGTH_MAX; // Default to loco
        }

        // Calculate scale factor
        const scaleFactor = length > 0 ? targetLength / length : 1;

        console.log(`${LOG_PREFIX} Auto-scale calculation:`);
        console.log(`${LOG_PREFIX}   Detected type: ${detectedType} (confidence: ${(confidence * 100).toFixed(0)}%)`);
        console.log(`${LOG_PREFIX}   Original length: ${(length * 1000).toFixed(1)}mm`);
        console.log(`${LOG_PREFIX}   Target length: ${(targetLength * 1000).toFixed(1)}mm`);
        console.log(`${LOG_PREFIX}   Scale factor: ${scaleFactor.toFixed(4)}`);

        return {
            scaleFactor,
            detectedType,
            targetLength,
            originalLength: length,
            confidence
        };
    }

    /**
     * Auto-scale a model to fit OO gauge and position on track
     * 
     * @param node - Root transform node
     * @param meshes - Meshes in the model
     * @param trackPosition - Position on track
     * @param options - Options including type hint
     * @returns Combined result with scale and position info
     */
    autoScaleAndPosition(
        node: TransformNode,
        meshes: AbstractMesh[],
        trackPosition: Vector3,
        options: PositionOptions = {}
    ): { scale: AutoScaleResult; position: PositionResult } {
        // Calculate bounds before any scaling
        const originalScale = node.scaling.x;
        node.scaling.setAll(1);
        const bounds = this.calculateModelBounds(node, meshes);

        // Calculate auto-scale if requested
        let scaleResult: AutoScaleResult;
        let finalScale = originalScale;

        if (options.autoScale !== false) {
            scaleResult = this.calculateAutoScale(bounds, options.typeHint);
            finalScale = scaleResult.scaleFactor;

            // Apply scale
            node.scaling.setAll(finalScale);
            console.log(`${LOG_PREFIX} Applied auto-scale: ${finalScale.toFixed(4)}`);
        } else {
            // Restore original scale
            node.scaling.setAll(originalScale);
            scaleResult = {
                scaleFactor: originalScale,
                detectedType: 'unknown',
                targetLength: 0,
                originalLength: Math.max(bounds.width, bounds.depth),
                confidence: 0
            };
        }

        // Position on track with the new scale
        const positionResult = this.positionOnTrack(node, meshes, trackPosition, options);

        return {
            scale: scaleResult,
            position: positionResult
        };
    }

    // ========================================================================
    // UTILITY METHODS
    // ========================================================================

    /**
     * Get the correct Y position for a model's transform node
     * given its bounds and current scale
     * 
     * @param bounds - Model bounds (unscaled)
     * @param scale - Current scale factor
     * @returns Y position for transform node
     */
    calculateYForRailTop(bounds: ModelBounds, scale: number): number {
        const scaledMinY = bounds.min.y * scale;
        return TRACK_HEIGHTS.RAIL_TOP_Y - scaledMinY;
    }

    /**
     * Check if a model appears to be positioned correctly on track
     * 
     * @param node - Root transform node
     * @param meshes - Meshes in the model
     * @param tolerance - Tolerance in meters (default 2mm)
     * @returns true if bottom is within tolerance of rail top
     */
    isOnTrack(
        node: TransformNode,
        meshes: AbstractMesh[],
        tolerance: number = 0.002
    ): boolean {
        const bounds = this.calculateModelBounds(node, meshes);
        const scale = node.scaling.x;
        const scaledMinY = bounds.min.y * scale;
        const actualBottomY = node.position.y + scaledMinY;

        const diff = Math.abs(actualBottomY - TRACK_HEIGHTS.RAIL_TOP_Y);
        return diff <= tolerance;
    }

    /**
     * Get debug info about current model positioning
     * 
     * @param node - Root transform node
     * @param meshes - Meshes in the model
     * @returns Debug string
     */
    getDebugInfo(node: TransformNode, meshes: AbstractMesh[]): string {
        const bounds = this.calculateModelBounds(node, meshes);
        const scale = node.scaling.x;
        const scaledBounds = this.getScaledBounds(bounds, scale);
        const actualBottomY = node.position.y + scaledBounds.min.y;

        return [
            `=== Train Position Debug ===`,
            `Node position: (${node.position.x.toFixed(4)}, ${node.position.y.toFixed(4)}, ${node.position.z.toFixed(4)})`,
            `Node scale: ${scale.toFixed(4)}`,
            `Unscaled bounds: min.y=${bounds.min.y.toFixed(4)}, max.y=${bounds.max.y.toFixed(4)}`,
            `Scaled bounds: min.y=${scaledBounds.min.y.toFixed(4)}, max.y=${scaledBounds.max.y.toFixed(4)}`,
            `Model dimensions: ${(scaledBounds.width * 1000).toFixed(1)}mm × ${(scaledBounds.height * 1000).toFixed(1)}mm × ${(scaledBounds.depth * 1000).toFixed(1)}mm`,
            `Actual bottom Y: ${actualBottomY.toFixed(4)}m`,
            `Rail top Y: ${TRACK_HEIGHTS.RAIL_TOP_Y.toFixed(4)}m`,
            `Difference: ${((actualBottomY - TRACK_HEIGHTS.RAIL_TOP_Y) * 1000).toFixed(2)}mm`,
            `On track: ${this.isOnTrack(node, meshes) ? 'YES' : 'NO'}`,
            `===========================`
        ].join('\n');
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalTrainPositionHelper: TrainPositionHelper | null = null;

/**
 * Get the global TrainPositionHelper instance
 */
export function getTrainPositionHelper(): TrainPositionHelper {
    if (!globalTrainPositionHelper) {
        globalTrainPositionHelper = new TrainPositionHelper();
    }
    return globalTrainPositionHelper;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick function to position a train model on track
 */
export function positionTrainOnTrack(
    node: TransformNode,
    meshes: AbstractMesh[],
    trackPosition: Vector3,
    options?: PositionOptions
): PositionResult {
    return getTrainPositionHelper().positionOnTrack(node, meshes, trackPosition, options);
}

/**
 * Quick function to snap a model to rail height
 */
export function snapTrainToRails(
    node: TransformNode,
    meshes: AbstractMesh[]
): void {
    getTrainPositionHelper().snapToRailHeight(node, meshes);
}

/**
 * Quick function to auto-scale and position
 */
export function autoScaleAndPositionTrain(
    node: TransformNode,
    meshes: AbstractMesh[],
    trackPosition: Vector3,
    typeHint?: 'locomotive' | 'coach' | 'wagon'
): { scale: AutoScaleResult; position: PositionResult } {
    return getTrainPositionHelper().autoScaleAndPosition(node, meshes, trackPosition, {
        autoScale: true,
        typeHint
    });
}