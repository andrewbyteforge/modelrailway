/**
 * Rolling Stock Positioning System - Index
 * 
 * Path: frontend/src/systems/train/rolling-stock-positioning/index.ts
 * 
 * Central export point for all rolling stock positioning functionality.
 * 
 * @module rolling-stock-positioning
 * @author Model Railway Workbench
 * @version 1.0.0
 */

// ============================================================================
// CORE POSITIONING
// ============================================================================

export {
    RollingStockPositioner,
    OO_GAUGE,
    PLACEMENT_CONFIG,
    type RollingStockInfo,
    type RollingStockCategory,
    type ModelForwardAxis,
    type EdgeDetectionResult,
    type VehiclePlacement,
    type ConsistPlacement,
    type PendingVehicle,
    type PlacementCompleteEvent,
    type PlacementCancelledEvent
} from '../RollingStockPositioner';

// ============================================================================
// MODEL ANALYSIS
// ============================================================================

export {
    ModelAxisDetector,
    getModelAxisDetector,
    detectModelForwardAxis,
    type ForwardAxis,
    type ModelAnalysis
} from '../ModelAxisDetector';

// ============================================================================
// TRACK PATH UTILITIES
// ============================================================================

export {
    TrackPathHelper,
    getTrackPathHelper,
    type TrackPose,
    type TrackPoint,
    type ClosestPointResult,
    type TrackPath
} from '../TrackPathHelper';

// ============================================================================
// INTEGRATION HELPERS
// ============================================================================

export {
    setupRollingStockPositioning,
    interactivePlacement,
    directPlacementAtPosition,
    directPlacementOnEdge,
    handleModelImport,
    createOperableTrain,
    restoreSavedRollingStock,
    debugVisualiseTrackPath,
    debugModelAxisDetection,
    debugListAllEdges,
    detectCategoryFromFilename,
    extractDisplayName
} from '../RollingStockPlacement.integration';