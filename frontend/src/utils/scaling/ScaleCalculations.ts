/**
 * ScaleCalculations.ts - Mathematical utilities for scaling operations
 * 
 * Path: frontend/src/utils/scaling/ScaleCalculations.ts
 * 
 * Provides pure mathematical functions for:
 * - Scale factor calculations
 * - Dimension conversions
 * - Pivot point adjustments
 * - Interpolation and easing
 * 
 * All functions are stateless and can be used independently.
 * 
 * @module ScaleCalculations
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';

// ============================================================================
// CONSTANTS
// ============================================================================

/** OO gauge scale ratio (1:76.2) */
export const OO_SCALE_RATIO = 76.2;

/** Millimetres per metre */
export const MM_PER_METRE = 1000;

/** Epsilon for floating point comparisons */
const EPSILON = 0.00001;

// ============================================================================
// SCALE FACTOR CALCULATIONS
// ============================================================================

/**
 * Calculate scale factor from two lengths
 * 
 * @param targetLength - Desired length
 * @param currentLength - Current length
 * @returns Scale factor to transform current to target
 */
export function calculateScaleFromLengths(
    targetLength: number,
    currentLength: number
): number {
    if (currentLength <= 0) {
        console.warn('[ScaleCalculations] Invalid current length');
        return 1.0;
    }
    return targetLength / currentLength;
}

/**
 * Calculate scale factor for OO gauge from real-world dimensions
 * 
 * @param realWorldMm - Real world dimension in millimetres
 * @returns Scale factor for OO gauge
 */
export function calculateOOScaleFromRealWorld(realWorldMm: number): number {
    // Convert mm to metres, then apply 1:76.2 scale
    const realWorldMetres = realWorldMm / MM_PER_METRE;
    return realWorldMetres / OO_SCALE_RATIO;
}

/**
 * Calculate real-world size from OO gauge model size
 * 
 * @param modelSizeMetres - Model size in metres
 * @returns Real-world equivalent in millimetres
 */
export function calculateRealWorldFromOO(modelSizeMetres: number): number {
    return modelSizeMetres * OO_SCALE_RATIO * MM_PER_METRE;
}

/**
 * Calculate the combined scale factor from multiple scale operations
 * 
 * @param scales - Array of scale factors
 * @returns Combined scale factor
 */
export function combineScaleFactors(...scales: number[]): number {
    return scales.reduce((acc, scale) => acc * scale, 1.0);
}

/**
 * Calculate relative scale change
 * 
 * @param fromScale - Original scale
 * @param toScale - New scale
 * @returns Relative multiplier (toScale / fromScale)
 */
export function calculateRelativeScale(fromScale: number, toScale: number): number {
    if (fromScale <= 0) {
        console.warn('[ScaleCalculations] Invalid fromScale');
        return 1.0;
    }
    return toScale / fromScale;
}

// ============================================================================
// DIMENSION CALCULATIONS
// ============================================================================

/**
 * Calculate scaled dimensions
 * 
 * @param dimensions - Original dimensions { width, height, depth }
 * @param scale - Scale factor
 * @returns Scaled dimensions
 */
export function scaleUniformDimensions(
    dimensions: { width: number; height: number; depth: number },
    scale: number
): { width: number; height: number; depth: number } {
    return {
        width: dimensions.width * scale,
        height: dimensions.height * scale,
        depth: dimensions.depth * scale
    };
}

/**
 * Calculate bounding sphere radius from dimensions
 * 
 * @param dimensions - Object dimensions
 * @returns Bounding sphere radius
 */
export function calculateBoundingRadius(
    dimensions: { width: number; height: number; depth: number }
): number {
    // Radius of bounding sphere = half the diagonal
    const diagonal = Math.sqrt(
        dimensions.width ** 2 +
        dimensions.height ** 2 +
        dimensions.depth ** 2
    );
    return diagonal / 2;
}

/**
 * Calculate volume from dimensions
 * 
 * @param dimensions - Object dimensions
 * @returns Volume in cubic units
 */
export function calculateVolume(
    dimensions: { width: number; height: number; depth: number }
): number {
    return dimensions.width * dimensions.height * dimensions.depth;
}

/**
 * Calculate how volume changes with scale
 * Volume scales with the cube of the linear scale factor
 * 
 * @param linearScale - Linear scale factor
 * @returns Volume scale factor
 */
export function linearToVolumeScale(linearScale: number): number {
    return linearScale ** 3;
}

/**
 * Calculate linear scale from volume scale
 * 
 * @param volumeScale - Volume scale factor
 * @returns Linear scale factor
 */
export function volumeToLinearScale(volumeScale: number): number {
    return Math.cbrt(volumeScale);
}

// ============================================================================
// PIVOT POINT CALCULATIONS
// ============================================================================

/**
 * Calculate position adjustment needed when scaling around a pivot point
 * 
 * When scaling an object around a non-centre pivot, the object's position
 * must be adjusted to keep the pivot stationary.
 * 
 * @param objectPosition - Current object position
 * @param pivotPosition - World position of the pivot point
 * @param oldScale - Previous scale factor
 * @param newScale - New scale factor
 * @returns New position to maintain pivot
 */
export function calculatePivotAdjustedPosition(
    objectPosition: Vector3,
    pivotPosition: Vector3,
    oldScale: number,
    newScale: number
): Vector3 {
    // Vector from pivot to object position
    const pivotToObject = objectPosition.subtract(pivotPosition);

    // Scale ratio
    const scaleRatio = newScale / oldScale;

    // New vector from pivot to object
    const newPivotToObject = pivotToObject.scale(scaleRatio);

    // New object position
    return pivotPosition.add(newPivotToObject);
}

/**
 * Calculate pivot point position for different pivot modes
 * 
 * @param objectPosition - Object's current position
 * @param boundingBox - Object's bounding box { min, max }
 * @param pivotMode - Type of pivot ('center' | 'base-center' | 'top-center')
 * @param objectScale - Current object scale
 * @returns World position of the pivot point
 */
export function calculatePivotPosition(
    objectPosition: Vector3,
    boundingBox: { min: Vector3; max: Vector3 },
    pivotMode: 'center' | 'base-center' | 'top-center'
): Vector3 {
    // Calculate bounding box centre
    const centre = boundingBox.min.add(boundingBox.max).scale(0.5);

    switch (pivotMode) {
        case 'center':
            return centre.clone();

        case 'base-center':
            // Use centre X/Z, but min Y (base)
            return new Vector3(centre.x, boundingBox.min.y, centre.z);

        case 'top-center':
            // Use centre X/Z, but max Y (top)
            return new Vector3(centre.x, boundingBox.max.y, centre.z);

        default:
            return centre.clone();
    }
}

/**
 * Calculate offset from object origin to pivot point in local space
 * 
 * @param dimensions - Object dimensions
 * @param pivotMode - Type of pivot
 * @returns Offset vector from origin to pivot
 */
export function calculateLocalPivotOffset(
    dimensions: { width: number; height: number; depth: number },
    pivotMode: 'center' | 'base-center' | 'top-center'
): Vector3 {
    switch (pivotMode) {
        case 'center':
            return Vector3.Zero();

        case 'base-center':
            // Assuming origin is at centre, base is at -height/2
            return new Vector3(0, -dimensions.height / 2, 0);

        case 'top-center':
            // Top is at +height/2
            return new Vector3(0, dimensions.height / 2, 0);

        default:
            return Vector3.Zero();
    }
}

// ============================================================================
// INTERPOLATION
// ============================================================================

/**
 * Linear interpolation between two scale values
 * 
 * @param startScale - Starting scale
 * @param endScale - Target scale
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated scale
 */
export function lerpScale(startScale: number, endScale: number, t: number): number {
    // Clamp t to [0, 1]
    const clampedT = Math.max(0, Math.min(1, t));
    return startScale + (endScale - startScale) * clampedT;
}

/**
 * Smooth step interpolation (ease in-out)
 * 
 * @param startScale - Starting scale
 * @param endScale - Target scale
 * @param t - Interpolation factor (0-1)
 * @returns Smoothly interpolated scale
 */
export function smoothStepScale(startScale: number, endScale: number, t: number): number {
    // Clamp t to [0, 1]
    const clampedT = Math.max(0, Math.min(1, t));
    // Smooth step formula: 3t² - 2t³
    const smoothT = clampedT * clampedT * (3 - 2 * clampedT);
    return startScale + (endScale - startScale) * smoothT;
}

/**
 * Exponential interpolation (better for scale which is multiplicative)
 * 
 * @param startScale - Starting scale
 * @param endScale - Target scale
 * @param t - Interpolation factor (0-1)
 * @returns Exponentially interpolated scale
 */
export function expLerpScale(startScale: number, endScale: number, t: number): number {
    if (startScale <= 0 || endScale <= 0) {
        console.warn('[ScaleCalculations] expLerp requires positive scales');
        return lerpScale(startScale, endScale, t);
    }

    // Clamp t to [0, 1]
    const clampedT = Math.max(0, Math.min(1, t));

    // Interpolate in log space
    const logStart = Math.log(startScale);
    const logEnd = Math.log(endScale);
    const logResult = logStart + (logEnd - logStart) * clampedT;

    return Math.exp(logResult);
}

// ============================================================================
// SCROLL-TO-SCALE CALCULATIONS
// ============================================================================

/**
 * Calculate new scale from scroll delta
 * 
 * @param currentScale - Current scale factor
 * @param scrollDelta - Scroll wheel delta (positive = scroll up)
 * @param sensitivity - Percentage change per scroll notch (e.g., 5 = 5%)
 * @param fine - Whether fine mode is active (reduces sensitivity)
 * @param fineMultiplier - Multiplier for fine mode (e.g., 0.2)
 * @returns New scale factor
 */
export function calculateScrollScale(
    currentScale: number,
    scrollDelta: number,
    sensitivity: number,
    fine: boolean = false,
    fineMultiplier: number = 0.2
): number {
    // Normalize scroll delta (-1, 0, or +1)
    const direction = Math.sign(scrollDelta);
    if (direction === 0) return currentScale;

    // Calculate percentage change
    let changePercent = sensitivity;
    if (fine) {
        changePercent *= fineMultiplier;
    }

    // Convert to multiplier
    // Scroll up = increase scale, scroll down = decrease
    const multiplier = 1 + (direction * changePercent / 100);

    return currentScale * multiplier;
}

/**
 * Calculate scale from drag distance
 * 
 * @param startScale - Scale when drag started
 * @param dragDistance - Drag distance in pixels
 * @param pixelsPerDoubling - Pixels to drag to double the scale
 * @returns New scale factor
 */
export function calculateDragScale(
    startScale: number,
    dragDistance: number,
    pixelsPerDoubling: number = 200
): number {
    // Use exponential scaling for intuitive drag behaviour
    // Dragging 'pixelsPerDoubling' pixels doubles the scale
    const exponent = dragDistance / pixelsPerDoubling;
    return startScale * Math.pow(2, exponent);
}

// ============================================================================
// COMPARISON UTILITIES
// ============================================================================

/**
 * Check if two scales are approximately equal
 * 
 * @param a - First scale
 * @param b - Second scale
 * @param epsilon - Tolerance (default: 0.00001)
 * @returns Whether scales are approximately equal
 */
export function scalesEqual(a: number, b: number, epsilon: number = EPSILON): boolean {
    return Math.abs(a - b) < epsilon;
}

/**
 * Check if a scale is approximately 1.0 (original size)
 * 
 * @param scale - Scale to check
 * @param epsilon - Tolerance
 * @returns Whether scale is approximately 1.0
 */
export function isOriginalScale(scale: number, epsilon: number = EPSILON): boolean {
    return scalesEqual(scale, 1.0, epsilon);
}

/**
 * Format scale for display
 * 
 * @param scale - Scale factor
 * @param asPercentage - Display as percentage
 * @param decimals - Decimal places
 * @returns Formatted string
 */
export function formatScale(
    scale: number,
    asPercentage: boolean = true,
    decimals: number = 1
): string {
    if (asPercentage) {
        return `${(scale * 100).toFixed(decimals)}%`;
    }
    return scale.toFixed(decimals + 2);
}

/**
 * Parse scale from string input
 * Handles both decimal (1.5) and percentage (150%) formats
 * 
 * @param input - String input
 * @returns Parsed scale factor or null if invalid
 */
export function parseScaleInput(input: string): number | null {
    const trimmed = input.trim();

    // Check for percentage format
    if (trimmed.endsWith('%')) {
        const percent = parseFloat(trimmed.slice(0, -1));
        if (!isNaN(percent) && percent > 0) {
            return percent / 100;
        }
        return null;
    }

    // Try decimal format
    const decimal = parseFloat(trimmed);
    if (!isNaN(decimal) && decimal > 0) {
        return decimal;
    }

    return null;
}

// ============================================================================
// DIMENSION DISPLAY HELPERS
// ============================================================================

/**
 * Format dimension with appropriate unit
 * 
 * @param metres - Dimension in metres
 * @returns Formatted string with unit
 */
export function formatDimension(metres: number): string {
    if (metres >= 1) {
        return `${metres.toFixed(2)}m`;
    }
    if (metres >= 0.01) {
        return `${(metres * 100).toFixed(1)}cm`;
    }
    return `${(metres * 1000).toFixed(1)}mm`;
}

/**
 * Format dimensions as WxHxD string
 * 
 * @param dimensions - Object dimensions in metres
 * @returns Formatted string like "10cm × 5cm × 8cm"
 */
export function formatDimensions(
    dimensions: { width: number; height: number; depth: number }
): string {
    return `${formatDimension(dimensions.width)} × ${formatDimension(dimensions.height)} × ${formatDimension(dimensions.depth)}`;
}

// ============================================================================
// GIZMO SIZE CALCULATIONS
// ============================================================================

/**
 * Calculate gizmo size based on camera distance
 * Keeps gizmo visually consistent regardless of zoom
 * 
 * @param cameraDistance - Distance from camera to object
 * @param baseSizeMetres - Base gizmo size in metres
 * @param minSize - Minimum gizmo size
 * @param maxSize - Maximum gizmo size
 * @returns Adjusted gizmo size
 */
export function calculateAutoScaleGizmoSize(
    cameraDistance: number,
    baseSizeMetres: number,
    minSize: number,
    maxSize: number
): number {
    // Scale gizmo proportionally to camera distance
    // This keeps it visually consistent on screen
    const scaledSize = baseSizeMetres * (cameraDistance / 1.0); // 1m reference distance

    // Clamp to min/max
    return Math.max(minSize, Math.min(maxSize, scaledSize));
}

/**
 * Calculate handle offset based on object bounds
 * 
 * @param boundingRadius - Object's bounding sphere radius
 * @param offsetMultiplier - How far outside bounds to place handles (e.g., 1.2 = 20% outside)
 * @returns Offset distance for handles
 */
export function calculateHandleOffset(
    boundingRadius: number,
    offsetMultiplier: number = 1.2
): number {
    return boundingRadius * offsetMultiplier;
}