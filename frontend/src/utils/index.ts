/**
 * Scaling Utilities - Index
 * 
 * Path: frontend/src/utils/scaling/index.ts
 * 
 * Re-exports all scaling utility functions for easy importing.
 * 
 * Usage:
 * ```typescript
 * import { calculateScrollScale, formatScale, lerpScale } from '../utils/scaling';
 * ```
 * 
 * @module ScalingUtils
 * @author Model Railway Workbench
 * @version 1.0.0
 */

// ============================================================================
// ALL EXPORTS FROM SCALE CALCULATIONS
// ============================================================================

export {
    // Constants
    OO_SCALE_RATIO,
    MM_PER_METRE,

    // Scale factor calculations
    calculateScaleFromLengths,
    calculateOOScaleFromRealWorld,
    calculateRealWorldFromOO,
    combineScaleFactors,
    calculateRelativeScale,

    // Dimension calculations
    scaleUniformDimensions,
    calculateBoundingRadius,
    calculateVolume,
    linearToVolumeScale,
    volumeToLinearScale,

    // Pivot point calculations
    calculatePivotAdjustedPosition,
    calculatePivotPosition,
    calculateLocalPivotOffset,

    // Interpolation
    lerpScale,
    smoothStepScale,
    expLerpScale,

    // Scroll-to-scale
    calculateScrollScale,
    calculateDragScale,

    // Comparison utilities
    scalesEqual,
    isOriginalScale,

    // Formatting
    formatScale,
    parseScaleInput,
    formatDimension,
    formatDimensions,

    // Gizmo sizing
    calculateAutoScaleGizmoSize,
    calculateHandleOffset
} from './ScaleCalculations';