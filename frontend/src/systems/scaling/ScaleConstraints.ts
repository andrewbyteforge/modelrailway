/**
 * ScaleConstraints.ts - Scale validation, clamping, and snapping utilities
 * 
 * Path: frontend/src/systems/scaling/ScaleConstraints.ts
 * 
 * Provides constraint enforcement for scaling operations:
 * - Min/max clamping
 * - Snap-to-increment
 * - Bypass mode handling
 * - Category-specific defaults
 * 
 * @module ScaleConstraints
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import {
    ScaleConstraints,
    ScalableAssetCategory,
    DEFAULT_SCALE_CONSTRAINTS,
    ScaleOperationResult
} from '../../types/scaling.types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix for console output */
const LOG_PREFIX = '[ScaleConstraints]';

/** Epsilon for floating point comparisons */
const EPSILON = 0.0001;

// ============================================================================
// SCALE CONSTRAINTS HANDLER CLASS
// ============================================================================

/**
 * ScaleConstraintsHandler - Manages scale validation and enforcement
 * 
 * Handles:
 * - Applying min/max constraints
 * - Snap-to-increment functionality
 * - Constraint bypass with modifier keys
 * - Per-category constraint management
 * 
 * @example
 * ```typescript
 * const handler = new ScaleConstraintsHandler();
 * const result = handler.applyConstraints(2.5, 'building');
 * console.log(result.finalScale); // Clamped/snapped value
 * ```
 */
export class ScaleConstraintsHandler {
    // ========================================================================
    // PROPERTIES
    // ========================================================================

    /** Custom constraints per category (overrides defaults) */
    private customConstraints: Map<ScalableAssetCategory, Partial<ScaleConstraints>> = new Map();

    /** Whether bypass mode is currently active */
    private bypassActive: boolean = false;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new ScaleConstraintsHandler
     */
    constructor() {
        console.log(`${LOG_PREFIX} Created`);
    }

    // ========================================================================
    // CONSTRAINT APPLICATION
    // ========================================================================

    /**
     * Apply constraints to a scale value
     * 
     * @param inputScale - Raw scale value to constrain
     * @param category - Asset category for constraint lookup
     * @param forcedConstraints - Optional override constraints
     * @returns Result with final scale and metadata
     */
    applyConstraints(
        inputScale: number,
        category: ScalableAssetCategory,
        forcedConstraints?: Partial<ScaleConstraints>
    ): ScaleOperationResult {
        try {
            // Get effective constraints for this category
            const constraints = this.getEffectiveConstraints(category, forcedConstraints);

            // Track modifications
            let finalScale = inputScale;
            let wasClamped = false;
            let wasSnapped = false;

            // ----------------------------------------------------------------
            // STEP 1: Apply snapping (if enabled and not bypassed)
            // ----------------------------------------------------------------
            if (constraints.snapEnabled && !this.bypassActive && constraints.snapIncrement > 0) {
                const snappedScale = this.snapToIncrement(inputScale, constraints.snapIncrement);
                if (Math.abs(snappedScale - inputScale) > EPSILON) {
                    finalScale = snappedScale;
                    wasSnapped = true;
                }
            }

            // ----------------------------------------------------------------
            // STEP 2: Apply min/max clamping (unless bypassed)
            // ----------------------------------------------------------------
            if (!this.bypassActive || !constraints.allowBypass) {
                const clampedScale = this.clampToRange(
                    finalScale,
                    constraints.minScale,
                    constraints.maxScale
                );

                if (Math.abs(clampedScale - finalScale) > EPSILON) {
                    finalScale = clampedScale;
                    wasClamped = true;
                }
            }

            // ----------------------------------------------------------------
            // STEP 3: Final validation
            // ----------------------------------------------------------------
            if (!this.isValidScale(finalScale)) {
                console.warn(`${LOG_PREFIX} Invalid scale value: ${finalScale}`);
                return {
                    success: false,
                    error: `Invalid scale value: ${finalScale}`
                };
            }

            return {
                success: true,
                finalScale,
                wasClamped,
                wasSnapped
            };

        } catch (error) {
            console.error(`${LOG_PREFIX} Error applying constraints:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Check if a scale value would be valid for a category
     * 
     * @param scale - Scale value to check
     * @param category - Asset category
     * @returns Whether the scale is within valid range
     */
    isScaleValid(scale: number, category: ScalableAssetCategory): boolean {
        const constraints = this.getEffectiveConstraints(category);
        return scale >= constraints.minScale && scale <= constraints.maxScale;
    }

    /**
     * Get the nearest valid scale for an invalid input
     * 
     * @param scale - Potentially invalid scale
     * @param category - Asset category
     * @returns Nearest valid scale value
     */
    getNearestValidScale(scale: number, category: ScalableAssetCategory): number {
        const constraints = this.getEffectiveConstraints(category);
        return this.clampToRange(scale, constraints.minScale, constraints.maxScale);
    }

    // ========================================================================
    // SNAPPING
    // ========================================================================

    /**
     * Snap a scale value to the nearest increment
     * 
     * @param scale - Input scale
     * @param increment - Snap increment (e.g., 0.05 for 5%)
     * @returns Snapped scale value
     */
    snapToIncrement(scale: number, increment: number): number {
        if (increment <= 0) return scale;

        // Round to nearest increment
        const snapped = Math.round(scale / increment) * increment;

        // Ensure we don't snap to zero
        if (snapped < increment) {
            return increment;
        }

        return snapped;
    }

    /**
     * Get the snap increment for a category
     * 
     * @param category - Asset category
     * @returns Snap increment value
     */
    getSnapIncrement(category: ScalableAssetCategory): number {
        return this.getEffectiveConstraints(category).snapIncrement;
    }

    /**
     * Check if snapping is enabled for a category
     * 
     * @param category - Asset category
     * @returns Whether snapping is enabled
     */
    isSnappingEnabled(category: ScalableAssetCategory): boolean {
        return this.getEffectiveConstraints(category).snapEnabled;
    }

    // ========================================================================
    // CLAMPING
    // ========================================================================

    /**
     * Clamp a value to a range
     * 
     * @param value - Value to clamp
     * @param min - Minimum value
     * @param max - Maximum value
     * @returns Clamped value
     */
    clampToRange(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Get min/max range for a category
     * 
     * @param category - Asset category
     * @returns Object with min and max scale
     */
    getScaleRange(category: ScalableAssetCategory): { min: number; max: number } {
        const constraints = this.getEffectiveConstraints(category);
        return {
            min: constraints.minScale,
            max: constraints.maxScale
        };
    }

    // ========================================================================
    // BYPASS MODE
    // ========================================================================

    /**
     * Enable constraint bypass mode
     * Allows scale values outside normal limits
     */
    enableBypass(): void {
        if (!this.bypassActive) {
            this.bypassActive = true;
            console.log(`${LOG_PREFIX} Bypass mode enabled`);
        }
    }

    /**
     * Disable constraint bypass mode
     */
    disableBypass(): void {
        if (this.bypassActive) {
            this.bypassActive = false;
            console.log(`${LOG_PREFIX} Bypass mode disabled`);
        }
    }

    /**
     * Check if bypass mode is active
     */
    isBypassActive(): boolean {
        return this.bypassActive;
    }

    /**
     * Toggle bypass mode
     * 
     * @returns New bypass state
     */
    toggleBypass(): boolean {
        this.bypassActive = !this.bypassActive;
        console.log(`${LOG_PREFIX} Bypass mode ${this.bypassActive ? 'enabled' : 'disabled'}`);
        return this.bypassActive;
    }

    // ========================================================================
    // CONSTRAINT MANAGEMENT
    // ========================================================================

    /**
     * Get effective constraints for a category
     * Merges defaults with custom overrides
     * 
     * @param category - Asset category
     * @param forcedOverrides - Additional forced overrides
     * @returns Complete constraints object
     */
    getEffectiveConstraints(
        category: ScalableAssetCategory,
        forcedOverrides?: Partial<ScaleConstraints>
    ): ScaleConstraints {
        // Start with defaults
        const defaults = DEFAULT_SCALE_CONSTRAINTS[category];

        // Apply custom overrides for this category
        const customOverrides = this.customConstraints.get(category) || {};

        // Merge all together
        return {
            ...defaults,
            ...customOverrides,
            ...forcedOverrides
        };
    }

    /**
     * Set custom constraints for a category
     * 
     * @param category - Asset category
     * @param constraints - Partial constraints to override
     */
    setCustomConstraints(
        category: ScalableAssetCategory,
        constraints: Partial<ScaleConstraints>
    ): void {
        // Validate constraints before storing
        if (constraints.minScale !== undefined && constraints.maxScale !== undefined) {
            if (constraints.minScale > constraints.maxScale) {
                console.error(`${LOG_PREFIX} Invalid constraints: minScale > maxScale`);
                return;
            }
        }

        if (constraints.snapIncrement !== undefined && constraints.snapIncrement < 0) {
            console.error(`${LOG_PREFIX} Invalid constraints: negative snapIncrement`);
            return;
        }

        this.customConstraints.set(category, constraints);
        console.log(`${LOG_PREFIX} Set custom constraints for '${category}':`, constraints);
    }

    /**
     * Clear custom constraints for a category
     * 
     * @param category - Asset category
     */
    clearCustomConstraints(category: ScalableAssetCategory): void {
        this.customConstraints.delete(category);
        console.log(`${LOG_PREFIX} Cleared custom constraints for '${category}'`);
    }

    /**
     * Clear all custom constraints
     */
    clearAllCustomConstraints(): void {
        this.customConstraints.clear();
        console.log(`${LOG_PREFIX} Cleared all custom constraints`);
    }

    /**
     * Get default constraints for a category (without custom overrides)
     * 
     * @param category - Asset category
     * @returns Default constraints
     */
    getDefaultConstraints(category: ScalableAssetCategory): ScaleConstraints {
        return { ...DEFAULT_SCALE_CONSTRAINTS[category] };
    }

    // ========================================================================
    // VALIDATION HELPERS
    // ========================================================================

    /**
     * Check if a scale value is valid (finite positive number)
     * 
     * @param scale - Scale value to validate
     * @returns Whether scale is valid
     */
    isValidScale(scale: number): boolean {
        return (
            typeof scale === 'number' &&
            Number.isFinite(scale) &&
            scale > 0
        );
    }

    /**
     * Check if a category allows scaling
     * 
     * @param category - Asset category
     * @returns Whether scaling is allowed
     */
    canScale(category: ScalableAssetCategory): boolean {
        const constraints = this.getEffectiveConstraints(category);
        // Category can be scaled if min !== max
        return constraints.minScale !== constraints.maxScale;
    }

    // ========================================================================
    // PERCENTAGE HELPERS
    // ========================================================================

    /**
     * Convert scale factor to percentage string
     * 
     * @param scale - Scale factor (1.0 = 100%)
     * @param decimals - Decimal places
     * @returns Percentage string (e.g., "150%")
     */
    scaleToPercentage(scale: number, decimals: number = 1): string {
        return `${(scale * 100).toFixed(decimals)}%`;
    }

    /**
     * Convert percentage to scale factor
     * 
     * @param percentage - Percentage value (100 = 1.0)
     * @returns Scale factor
     */
    percentageToScale(percentage: number): number {
        return percentage / 100;
    }

    /**
     * Get scale change as percentage
     * 
     * @param oldScale - Previous scale
     * @param newScale - New scale
     * @returns Change percentage (e.g., +50 for 1.0 -> 1.5)
     */
    getScaleChangePercent(oldScale: number, newScale: number): number {
        if (oldScale === 0) return 0;
        return ((newScale - oldScale) / oldScale) * 100;
    }

    // ========================================================================
    // DISPOSAL
    // ========================================================================

    /**
     * Clean up resources
     */
    dispose(): void {
        this.customConstraints.clear();
        this.bypassActive = false;
        console.log(`${LOG_PREFIX} Disposed`);
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/** Global constraints handler instance */
let globalConstraintsHandler: ScaleConstraintsHandler | null = null;

/**
 * Get the global constraints handler instance
 * 
 * @returns Global ScaleConstraintsHandler
 */
export function getGlobalConstraintsHandler(): ScaleConstraintsHandler {
    if (!globalConstraintsHandler) {
        globalConstraintsHandler = new ScaleConstraintsHandler();
    }
    return globalConstraintsHandler;
}

/**
 * Reset the global constraints handler
 * Primarily for testing
 */
export function resetGlobalConstraintsHandler(): void {
    if (globalConstraintsHandler) {
        globalConstraintsHandler.dispose();
        globalConstraintsHandler = null;
    }
}