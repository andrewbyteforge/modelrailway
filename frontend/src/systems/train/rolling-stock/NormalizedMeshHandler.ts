/**
 * NormalizedMeshHandler.ts - Smart handling for Meshy-style normalized meshes
 * 
 * Path: frontend/src/systems/train/rolling-stock/NormalizedMeshHandler.ts
 * 
 * Solves the problem of AI-generated models (Meshy, etc.) that export with
 * normalized bounds (-1 to 1 range) instead of real-world scale.
 * 
 * Features:
 * - Detect normalized meshes automatically
 * - Scale to target OO gauge dimensions
 * - Position wheels precisely on rail top
 * - Support different rolling stock types
 * 
 * @module NormalizedMeshHandler
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[NormalizedMeshHandler]';

/**
 * OO Gauge target dimensions for different rolling stock types
 * All values in meters at OO scale (1:76.2)
 */
export const OO_TARGET_DIMENSIONS = {
    locomotive: {
        length: 0.230,      // 230mm - typical diesel/electric
        width: 0.032,       // 32mm - body width
        height: 0.050,      // 50mm - from rail to roof
        name: 'Locomotive'
    },
    steam: {
        length: 0.200,      // 200mm - steam locomotive
        width: 0.032,       // 32mm
        height: 0.055,      // 55mm - taller chimney
        name: 'Steam Locomotive'
    },
    coach: {
        length: 0.275,      // 275mm - passenger coach
        width: 0.032,       // 32mm
        height: 0.048,      // 48mm
        name: 'Coach'
    },
    wagon: {
        length: 0.120,      // 120mm - freight wagon
        width: 0.030,       // 30mm
        height: 0.035,      // 35mm
        name: 'Wagon'
    }
} as const;

/** Rolling stock type */
export type RollingStockType = keyof typeof OO_TARGET_DIMENSIONS;

/**
 * Track geometry constants
 */
const TRACK_HEIGHTS = {
    BASEBOARD_TOP: 0.950,       // Baseboard surface
    RAIL_TOP_OFFSET: 0.008,     // 8mm offset to rail top
    get RAIL_TOP_Y(): number {
        return this.BASEBOARD_TOP + this.RAIL_TOP_OFFSET;
    }
} as const;

/**
 * Normalized mesh detection thresholds
 */
const NORMALIZED_DETECTION = {
    /** Min bound expected for normalized mesh */
    MIN_THRESHOLD: -2.5,
    /** Max bound expected for normalized mesh */
    MAX_THRESHOLD: 2.5,
    /** Minimum size to be considered normalized (meters) */
    MIN_SIZE: 0.5,
    /** Maximum size to be considered normalized (meters) */
    MAX_SIZE: 5.0
} as const;

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Mesh bounds information
 */
export interface MeshBounds {
    min: Vector3;
    max: Vector3;
    size: Vector3;
    center: Vector3;
}

/**
 * Detection result for normalized meshes
 */
export interface NormalizedDetectionResult {
    /** Is this mesh normalized? */
    isNormalized: boolean;
    /** Current bounds */
    bounds: MeshBounds;
    /** Confidence score (0-1) */
    confidence: number;
    /** Reason for detection result */
    reason: string;
}

/**
 * Scaling result
 */
export interface ScalingResult {
    /** Applied scale factor */
    scaleFactor: number;
    /** Original dimensions */
    originalDimensions: MeshBounds;
    /** Final dimensions */
    finalDimensions: MeshBounds;
    /** Rolling stock type used */
    stockType: RollingStockType;
    /** Success flag */
    success: boolean;
}

/**
 * Positioning result
 */
export interface PositioningResult {
    /** Final Y position */
    yPosition: number;
    /** Offset applied */
    yOffset: number;
    /** Success flag */
    success: boolean;
}

// ============================================================================
// MESH BOUNDS CALCULATION
// ============================================================================

/**
 * Calculate combined bounding box for multiple meshes
 * 
 * @param meshes - Array of meshes to analyze
 * @returns Bounds information
 */
export function calculateCombinedBounds(meshes: AbstractMesh[]): MeshBounds {
    if (meshes.length === 0) {
        throw new Error('Cannot calculate bounds for empty mesh array');
    }

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const mesh of meshes) {
        // Force bounding box update
        mesh.refreshBoundingInfo();
        const bounds = mesh.getBoundingInfo().boundingBox;

        // Get world-space bounds
        const min = bounds.minimumWorld;
        const max = bounds.maximumWorld;

        minX = Math.min(minX, min.x);
        minY = Math.min(minY, min.y);
        minZ = Math.min(minZ, min.z);

        maxX = Math.max(maxX, max.x);
        maxY = Math.max(maxY, max.y);
        maxZ = Math.max(maxZ, max.z);
    }

    const min = new Vector3(minX, minY, minZ);
    const max = new Vector3(maxX, maxY, maxZ);
    const size = max.subtract(min);
    const center = min.add(max).scale(0.5);

    return { min, max, size, center };
}

// ============================================================================
// NORMALIZED MESH DETECTION
// ============================================================================

/**
 * Detect if meshes appear to be normalized (Meshy-style)
 * 
 * Checks if:
 * 1. Bounds are approximately -1 to 1 (or -2 to 2 with tolerance)
 * 2. Total size is small (< 5 meters)
 * 3. Model doesn't match expected OO gauge dimensions
 * 
 * @param meshes - Meshes to analyze
 * @returns Detection result with confidence score
 */
export function detectNormalizedMesh(meshes: AbstractMesh[]): NormalizedDetectionResult {
    try {
        const bounds = calculateCombinedBounds(meshes);

        console.log(`${LOG_PREFIX} Analyzing mesh bounds:`, {
            min: `(${bounds.min.x.toFixed(3)}, ${bounds.min.y.toFixed(3)}, ${bounds.min.z.toFixed(3)})`,
            max: `(${bounds.max.x.toFixed(3)}, ${bounds.max.y.toFixed(3)}, ${bounds.max.z.toFixed(3)})`,
            size: `(${bounds.size.x.toFixed(3)}, ${bounds.size.y.toFixed(3)}, ${bounds.size.z.toFixed(3)})`
        });

        // ----------------------------------------------------------------
        // Check 1: Are bounds in normalized range (-2.5 to 2.5)?
        // ----------------------------------------------------------------
        const minInRange = bounds.min.x >= NORMALIZED_DETECTION.MIN_THRESHOLD &&
            bounds.min.y >= NORMALIZED_DETECTION.MIN_THRESHOLD &&
            bounds.min.z >= NORMALIZED_DETECTION.MIN_THRESHOLD;

        const maxInRange = bounds.max.x <= NORMALIZED_DETECTION.MAX_THRESHOLD &&
            bounds.max.y <= NORMALIZED_DETECTION.MAX_THRESHOLD &&
            bounds.max.z <= NORMALIZED_DETECTION.MAX_THRESHOLD;

        // ----------------------------------------------------------------
        // Check 2: Is total size reasonable for normalized mesh?
        // ----------------------------------------------------------------
        const maxDimension = Math.max(bounds.size.x, bounds.size.y, bounds.size.z);
        const sizeInRange = maxDimension >= NORMALIZED_DETECTION.MIN_SIZE &&
            maxDimension <= NORMALIZED_DETECTION.MAX_SIZE;

        // ----------------------------------------------------------------
        // Check 3: Does NOT match OO gauge dimensions?
        // ----------------------------------------------------------------
        const isOOGauge = maxDimension >= 0.100 && maxDimension <= 0.350; // 100-350mm

        // ----------------------------------------------------------------
        // Calculate confidence
        // ----------------------------------------------------------------
        let confidence = 0;
        let reasons: string[] = [];

        if (minInRange && maxInRange) {
            confidence += 0.5;
            reasons.push('bounds in normalized range');
        }

        if (sizeInRange && !isOOGauge) {
            confidence += 0.3;
            reasons.push('size suggests normalization');
        }

        if (maxDimension < 3.0) {
            confidence += 0.2;
            reasons.push('compact size');
        }

        const isNormalized = confidence >= 0.6;

        console.log(`${LOG_PREFIX} Detection result: ${isNormalized ? 'NORMALIZED' : 'STANDARD'} (confidence: ${(confidence * 100).toFixed(0)}%)`);
        console.log(`${LOG_PREFIX} Reasons: ${reasons.join(', ')}`);

        return {
            isNormalized,
            bounds,
            confidence,
            reason: reasons.join(', ')
        };

    } catch (error) {
        console.error(`${LOG_PREFIX} Detection failed:`, error);
        return {
            isNormalized: false,
            bounds: {
                min: Vector3.Zero(),
                max: Vector3.One(),
                size: Vector3.One(),
                center: new Vector3(0.5, 0.5, 0.5)
            },
            confidence: 0,
            reason: 'detection error'
        };
    }
}

// ============================================================================
// TARGET-LENGTH SCALING
// ============================================================================

/**
 * Calculate scale factor to achieve target length for rolling stock
 * 
 * Takes the longest dimension of the model and scales it to match
 * the target length for the specified rolling stock type.
 * 
 * @param meshes - Meshes to scale
 * @param stockType - Type of rolling stock
 * @returns Scaling result
 */
export function scaleToTargetLength(
    meshes: AbstractMesh[],
    stockType: RollingStockType = 'locomotive'
): ScalingResult {
    try {
        // Get original bounds
        const originalBounds = calculateCombinedBounds(meshes);
        const targetDimensions = OO_TARGET_DIMENSIONS[stockType];

        // Use longest dimension for scaling reference
        const currentLength = Math.max(
            originalBounds.size.x,
            originalBounds.size.y,
            originalBounds.size.z
        );

        // Calculate scale factor
        const scaleFactor = targetDimensions.length / currentLength;

        console.log(`${LOG_PREFIX} Scaling ${targetDimensions.name}:`);
        console.log(`${LOG_PREFIX}   Current length: ${(currentLength * 1000).toFixed(1)}mm`);
        console.log(`${LOG_PREFIX}   Target length:  ${(targetDimensions.length * 1000).toFixed(1)}mm`);
        console.log(`${LOG_PREFIX}   Scale factor:   ${scaleFactor.toFixed(6)}`);

        // Apply scale to all meshes
        for (const mesh of meshes) {
            const currentScale = mesh.scaling.clone();
            mesh.scaling = currentScale.scale(scaleFactor);
        }

        // Recalculate bounds after scaling
        const finalBounds = calculateCombinedBounds(meshes);

        console.log(`${LOG_PREFIX} ✓ Scaled to ${(finalBounds.size.x * 1000).toFixed(1)}mm x ${(finalBounds.size.y * 1000).toFixed(1)}mm x ${(finalBounds.size.z * 1000).toFixed(1)}mm`);

        return {
            scaleFactor,
            originalDimensions: originalBounds,
            finalDimensions: finalBounds,
            stockType,
            success: true
        };

    } catch (error) {
        console.error(`${LOG_PREFIX} Scaling failed:`, error);
        throw error;
    }
}

// ============================================================================
// RAIL POSITIONING
// ============================================================================

/**
 * Position model so wheels (bottom) sit exactly on rail top
 * 
 * Finds the lowest point of the model (wheels) and adjusts Y position
 * so that point sits at rail top surface height (0.958m).
 * 
 * @param rootNode - Root node to position
 * @param meshes - Child meshes to analyze
 * @returns Positioning result
 */
export function positionOnRailTop(
    rootNode: TransformNode,
    meshes: AbstractMesh[]
): PositioningResult {
    try {
        // Get current bounds
        const bounds = calculateCombinedBounds(meshes);

        // Find lowest point (wheels)
        const bottomY = bounds.min.y;

        // Calculate required offset to place wheels on rail top
        const railTopY = TRACK_HEIGHTS.RAIL_TOP_Y;
        const requiredOffset = railTopY - bottomY;

        // Apply offset
        const currentY = rootNode.position.y;
        const newY = currentY + requiredOffset;
        rootNode.position.y = newY;

        console.log(`${LOG_PREFIX} Positioning on rails:`);
        console.log(`${LOG_PREFIX}   Bottom (wheels): ${(bottomY * 1000).toFixed(1)}mm`);
        console.log(`${LOG_PREFIX}   Rail top:        ${(railTopY * 1000).toFixed(1)}mm`);
        console.log(`${LOG_PREFIX}   Offset applied:  ${(requiredOffset * 1000).toFixed(1)}mm`);
        console.log(`${LOG_PREFIX}   Final Y:         ${(newY * 1000).toFixed(1)}mm`);

        return {
            yPosition: newY,
            yOffset: requiredOffset,
            success: true
        };

    } catch (error) {
        console.error(`${LOG_PREFIX} Positioning failed:`, error);
        throw error;
    }
}

// ============================================================================
// COMPLETE WORKFLOW
// ============================================================================

/**
 * Complete workflow: Detect, scale, and position a normalized mesh
 * 
 * This is the main entry point for handling Meshy-style models.
 * 
 * @param rootNode - Root transform node
 * @param meshes - Child meshes
 * @param stockType - Type of rolling stock
 * @returns Object with all results
 */
export function processNormalizedMesh(
    rootNode: TransformNode,
    meshes: AbstractMesh[],
    stockType: RollingStockType = 'locomotive'
): {
    detection: NormalizedDetectionResult;
    scaling: ScalingResult | null;
    positioning: PositioningResult | null;
    success: boolean;
} {
    console.log(`${LOG_PREFIX} ═══════════════════════════════════════`);
    console.log(`${LOG_PREFIX} Processing normalized mesh workflow`);
    console.log(`${LOG_PREFIX} ═══════════════════════════════════════`);

    // Step 1: Detect
    const detection = detectNormalizedMesh(meshes);

    if (!detection.isNormalized) {
        console.log(`${LOG_PREFIX} ⚠ Model does not appear normalized, skipping workflow`);
        return {
            detection,
            scaling: null,
            positioning: null,
            success: false
        };
    }

    // Step 2: Scale to target length
    console.log(`${LOG_PREFIX} ---`);
    const scaling = scaleToTargetLength(meshes, stockType);

    // Step 3: Position on rail top
    console.log(`${LOG_PREFIX} ---`);
    const positioning = positionOnRailTop(rootNode, meshes);

    console.log(`${LOG_PREFIX} ═══════════════════════════════════════`);
    console.log(`${LOG_PREFIX} ✓ Workflow complete!`);
    console.log(`${LOG_PREFIX} ═══════════════════════════════════════`);

    return {
        detection,
        scaling,
        positioning,
        success: true
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
    LOG_PREFIX,
    TRACK_HEIGHTS,
    NORMALIZED_DETECTION
};