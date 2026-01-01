/**
 * ScaleConstraints.ts - Scale validation and clamping utilities
 * 
 * Path: frontend/src/systems/scaling/ScaleConstraints.ts
 * 
 * Provides constraint enforcement for scaling operations:
 * - Min/max clamping (0.25% to 100%)
 * - Category-specific limits
 * - Bypass mode handling
 * 
 * NOTE: Snapping is DISABLED to allow precise percentage control.
 * You can type 13% and get exactly 13%, not snapped to 15%.
 * 
 * SCALE RANGE: 0.25% to 100%
 * - MIN_SCALE = 0.0025 (0.25%)
 * - MAX_SCALE = 1.0 (100%)
 * 
 * @module ScaleConstraints
 * @author Model Railway Workbench
 * @version 2.2.0 - Disabled snapping for precise control
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
// GLOBAL SCALE LIMITS (0.25% to 100%)
// ============================================================================

/**
 * Global scale limits applied to all categories
 * User requested: 0.25% to 100%
 */
export const GLOBAL_SCALE_LIMITS = {
    /** Absolute minimum scale (0.25% = 0.0025) */
    MIN_SCALE: 0.0025,

    /** Absolute maximum scale (100% = 1.0) */
    MAX_SCALE: 1.0,

    /** Minimum as percentage */
    MIN_PERCENT: 0.25,

    /** Maximum as percentage */
    MAX_PERCENT: 100,
} as const;

// ============================================================================
// SCALE STEP CONFIGURATION (25% INCREMENTS)
// ============================================================================

/**
 * Step sizes for scale adjustments
 * 
 * v2.1.0 - Updated to 25% increments per user request
 * 
 * Scale changes work as follows:
 * - Normal scroll: 1.0 → 1.25 → 1.50 → 1.75 → 2.0 (25% increments)
 * - Fine scroll (Shift held): 5% increments
 */
export const SCALE_STEP_CONFIG = {
    /** Fine adjustment step (5% = 0.05) - used with Shift key */
    FINE_STEP: 0.05,

    /** Normal adjustment step (25% = 0.25) */
    NORMAL_STEP: 0.25,

    /** Coarse adjustment step (25% = 0.25) */
    COARSE_STEP: 0.25,

    /** 
     * Scroll wheel adjustment - percentage change per notch
     * Value of 25 means 25% change per scroll notch
     * e.g., 1.0 → 1.25 → 1.50 → 1.75
     */
    SCROLL_MULTIPLIER: 25,

    /** 
     * Fine scroll multiplier (with Shift held)
     * Value of 5 means 5% change per scroll notch when Shift is held
     * e.g., 1.0 → 1.05 → 1.10 → 1.15
     */
    FINE_SCROLL_MULTIPLIER: 5,
} as const;

// ============================================================================
// SCALE CONSTRAINTS HANDLER CLASS
// ============================================================================

/**
 * ScaleConstraintsHandler - Manages scale validation and enforcement
 * 
 * Handles:
 * - Applying min/max constraints (0.25% to 100%)
 * - Snap-to-increment functionality
 * - Constraint bypass with modifier keys
 * - Per-category constraint management
 * 
 * @example
 * ```typescript
 * const handler = new ScaleConstraintsHandler();
 * const result = handler.applyConstraints(2.5, 'building');
 * console.log(result.finalScale); // Clamped to 1.0 (100%)
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
        console.log(`${LOG_PREFIX} Scale range: ${GLOBAL_SCALE_LIMITS.MIN_PERCENT}% - ${GLOBAL_SCALE_LIMITS.MAX_PERCENT}%`);
        console.log(`${LOG_PREFIX} Snapping: DISABLED (allows precise percentage control)`);
    }

    // ========================================================================
    // CONSTRAINT APPLICATION
    // ========================================================================

    /**
     * Apply constraints to a scale value
     * 
     * Enforces the global 0.25% - 100% range regardless of category
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
            // STEP 1: Snapping DISABLED for precise percentage control
            // ----------------------------------------------------------------
            // Snapping was causing values like 13% to jump to 15%
            // Users need fine control over exact percentages
            // Snapping can be re-enabled per-category if needed via:
            //   constraints.setCustomConstraints(category, { snapEnabled: true, snapIncrement: 0.05 })

            // DISABLED: Snapping logic
            // if (constraints.snapEnabled && !this.bypassActive && constraints.snapIncrement > 0) {
            //     const snappedScale = this.snapToIncrement(inputScale, constraints.snapIncrement);
            //     if (Math.abs(snappedScale - inputScale) > EPSILON) {
            //         finalScale = snappedScale;
            //         wasSnapped = true;
            //     }
            // }

            // ----------------------------------------------------------------
            // STEP 2: Apply GLOBAL min/max clamping (0.25% - 100%)
            // Always enforce global limits, even with bypass
            // ----------------------------------------------------------------
            const globalClamped = this.clampToGlobalLimits(finalScale);
            if (Math.abs(globalClamped - finalScale) > EPSILON) {
                finalScale = globalClamped;
                wasClamped = true;
            }

            // ----------------------------------------------------------------
            // STEP 3: Apply category-specific clamping (if not bypassed)
            // Only if category limits are MORE restrictive than global
            // ----------------------------------------------------------------
            if (!this.bypassActive || !constraints.allowBypass) {
                const categoryClamped = this.clampToRange(
                    finalScale,
                    Math.max(constraints.minScale, GLOBAL_SCALE_LIMITS.MIN_SCALE),
                    Math.min(constraints.maxScale, GLOBAL_SCALE_LIMITS.MAX_SCALE)
                );

                if (Math.abs(categoryClamped - finalScale) > EPSILON) {
                    finalScale = categoryClamped;
                    wasClamped = true;
                }
            }

            // ----------------------------------------------------------------
            // STEP 4: Final validation
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
     * Clamp a value to global scale limits (0.25% - 100%)
     * 
     * @param scale - Scale value to clamp
     * @returns Clamped value within global limits
     */
    clampToGlobalLimits(scale: number): number {
        return Math.max(
            GLOBAL_SCALE_LIMITS.MIN_SCALE,
            Math.min(GLOBAL_SCALE_LIMITS.MAX_SCALE, scale)
        );
    }

    /**
     * Check if a scale value would be valid for a category
     * 
     * @param scale - Scale value to check
     * @param category - Asset category
     * @returns Whether the scale is within valid range
     */
    wouldBeValid(scale: number, category: ScalableAssetCategory): boolean {
        const constraints = this.getEffectiveConstraints(category);
        return (
            scale >= Math.max(constraints.minScale, GLOBAL_SCALE_LIMITS.MIN_SCALE) &&
            scale <= Math.min(constraints.maxScale, GLOBAL_SCALE_LIMITS.MAX_SCALE)
        );
    }

    // ========================================================================
    // GLOBAL RANGE ACCESS
    // ========================================================================

    /**
     * Get the global scale range
     * 
     * @returns Object with min/max scale values and percentages
     */
    getGlobalRange(): { min: number; max: number; minPercent: number; maxPercent: number } {
        return {
            min: GLOBAL_SCALE_LIMITS.MIN_SCALE,
            max: GLOBAL_SCALE_LIMITS.MAX_SCALE,
            minPercent: GLOBAL_SCALE_LIMITS.MIN_PERCENT,
            maxPercent: GLOBAL_SCALE_LIMITS.MAX_PERCENT
        };
    }

    // ========================================================================
    // SNAPPING
    // ========================================================================

    /**
     * Snap a scale value to the nearest increment
     * 
     * @param scale - Input scale
     * @param increment - Snap increment (e.g., 0.25 for 25%)
     * @returns Snapped scale value
     */
    snapToIncrement(scale: number, increment: number): number {
        if (increment <= 0) return scale;

        // Round to nearest increment
        const snapped = Math.round(scale / increment) * increment;

        // Ensure we don't snap below minimum
        if (snapped < GLOBAL_SCALE_LIMITS.MIN_SCALE) {
            return GLOBAL_SCALE_LIMITS.MIN_SCALE;
        }

        return snapped;
    }

    /**
     * Snap scale to 25% increments (0.25, 0.50, 0.75, 1.00)
     * 
     * @param scale - Input scale
     * @returns Snapped scale value
     */
    snapTo25Percent(scale: number): number {
        return this.snapToIncrement(scale, SCALE_STEP_CONFIG.NORMAL_STEP);
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
     * Get the valid range for a category (respecting global limits)
     * 
     * @param category - Asset category
     * @returns Object with min and max scale values
     */
    getValidRange(category: ScalableAssetCategory): { min: number; max: number } {
        const constraints = this.getEffectiveConstraints(category);
        return {
            min: Math.max(constraints.minScale, GLOBAL_SCALE_LIMITS.MIN_SCALE),
            max: Math.min(constraints.maxScale, GLOBAL_SCALE_LIMITS.MAX_SCALE)
        };
    }

    // ========================================================================
    // BYPASS MODE
    // ========================================================================

    /**
     * Enable constraint bypass mode
     * Allows scaling beyond category limits (but not global limits)
     */
    enableBypass(): void {
        this.bypassActive = true;
        console.log(`${LOG_PREFIX} Bypass enabled`);
    }

    /**
     * Disable constraint bypass mode
     */
    disableBypass(): void {
        this.bypassActive = false;
        console.log(`${LOG_PREFIX} Bypass disabled`);
    }

    /**
     * Check if bypass mode is active
     */
    isBypassActive(): boolean {
        return this.bypassActive;
    }

    // ========================================================================
    // CONSTRAINT MANAGEMENT
    // ========================================================================

    /**
     * Get effective constraints for a category
     * Merges defaults with any custom overrides
     * 
     * @param category - Asset category
     * @param forcedConstraints - Optional override constraints
     * @returns Effective constraints
     */
    getEffectiveConstraints(
        category: ScalableAssetCategory,
        forcedConstraints?: Partial<ScaleConstraints>
    ): ScaleConstraints {
        // Start with defaults
        const defaults = { ...DEFAULT_SCALE_CONSTRAINTS[category] };

        // Enforce global limits on defaults
        defaults.minScale = Math.max(defaults.minScale, GLOBAL_SCALE_LIMITS.MIN_SCALE);
        defaults.maxScale = Math.min(defaults.maxScale, GLOBAL_SCALE_LIMITS.MAX_SCALE);

        // Apply custom constraints if set
        const custom = this.customConstraints.get(category);
        if (custom) {
            Object.assign(defaults, custom);
        }

        // Apply forced constraints if provided
        if (forcedConstraints) {
            Object.assign(defaults, forcedConstraints);
        }

        // Always enforce global limits on final result
        defaults.minScale = Math.max(defaults.minScale, GLOBAL_SCALE_LIMITS.MIN_SCALE);
        defaults.maxScale = Math.min(defaults.maxScale, GLOBAL_SCALE_LIMITS.MAX_SCALE);

        return defaults;
    }

    /**
     * Set custom constraints for a category
     * 
     * @param category - Asset category
     * @param constraints - Constraints to apply (merged with defaults)
     */
    setCustomConstraints(category: ScalableAssetCategory, constraints: Partial<ScaleConstraints>): void {
        // Validate constraints respect global limits
        if (constraints.minScale !== undefined) {
            constraints.minScale = Math.max(constraints.minScale, GLOBAL_SCALE_LIMITS.MIN_SCALE);
        }

        if (constraints.maxScale !== undefined) {
            constraints.maxScale = Math.min(constraints.maxScale, GLOBAL_SCALE_LIMITS.MAX_SCALE);
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
        const defaults = { ...DEFAULT_SCALE_CONSTRAINTS[category] };

        // Enforce global limits
        defaults.minScale = Math.max(defaults.minScale, GLOBAL_SCALE_LIMITS.MIN_SCALE);
        defaults.maxScale = Math.min(defaults.maxScale, GLOBAL_SCALE_LIMITS.MAX_SCALE);

        return defaults;
    }

    // ========================================================================
    // VALIDATION HELPERS
    // ========================================================================

    /**
     * Check if a scale value is valid (finite positive number within global range)
     * 
     * @param scale - Scale value to validate
     * @returns Whether scale is valid
     */
    isValidScale(scale: number): boolean {
        return (
            typeof scale === 'number' &&
            Number.isFinite(scale) &&
            scale >= GLOBAL_SCALE_LIMITS.MIN_SCALE &&
            scale <= GLOBAL_SCALE_LIMITS.MAX_SCALE
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
     * @returns Percentage string (e.g., "50%")
     */
    scaleToPercentage(scale: number, decimals: number = 1): string {
        const percent = scale * 100;
        if (percent < 1) {
            return `${percent.toFixed(2)}%`;
        } else if (percent < 10) {
            return `${percent.toFixed(decimals)}%`;
        } else {
            return `${percent.toFixed(0)}%`;
        }
    }

    /**
     * Convert percentage to scale factor (clamped to global limits)
     * 
     * @param percentage - Percentage value (100 = 1.0)
     * @returns Scale factor
     */
    percentageToScale(percentage: number): number {
        const scale = percentage / 100;
        return this.clampToGlobalLimits(scale);
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

    /**
     * Get adaptive step size based on current scale
     * 
     * v2.1.0 - Now uses 25% steps for normal, 5% for fine
     * 
     * @param currentScale - Current scale value
     * @param fine - Whether to use fine adjustment
     * @returns Appropriate step size
     */
    getAdaptiveStep(currentScale: number, fine: boolean = false): number {
        // Fine mode always uses 5% steps
        if (fine) {
            return SCALE_STEP_CONFIG.FINE_STEP; // 0.05 (5%)
        }

        // Normal mode uses 25% steps
        return SCALE_STEP_CONFIG.NORMAL_STEP; // 0.25 (25%)
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

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Clamp a scale value to global limits (0.25% - 100%)
 * 
 * @param scale - Scale value to clamp
 * @returns Clamped value
 */
export function clampScaleToGlobalLimits(scale: number): number {
    return Math.max(
        GLOBAL_SCALE_LIMITS.MIN_SCALE,
        Math.min(GLOBAL_SCALE_LIMITS.MAX_SCALE, scale)
    );
}

/**
 * Format scale as percentage string
 * 
 * @param scale - Scale factor
 * @returns Percentage string
 */
export function formatScalePercent(scale: number): string {
    const percent = scale * 100;
    if (percent < 1) {
        return `${percent.toFixed(2)}%`;
    } else if (percent < 10) {
        return `${percent.toFixed(1)}%`;
    } else {
        return `${percent.toFixed(0)}%`;
    }
}

/**
 * Convert percentage to scale factor
 * 
 * @param percent - Percentage value
 * @returns Scale factor (clamped to global limits)
 */
export function percentToScale(percent: number): number {
    return clampScaleToGlobalLimits(percent / 100);
}