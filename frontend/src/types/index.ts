/**
 * Types Index
 * 
 * Path: frontend/src/types/index.ts
 * 
 * Re-exports all type definitions for easy importing.
 * 
 * @example
 * ```typescript
 * import { 
 *     RollingStockCategory, 
 *     AssetCategory,
 *     ModelDimensions 
 * } from '../types';
 * ```
 * 
 * @module Types
 * @version 1.0.0
 */

// ============================================================================
// RAILWAY TYPES (Core unified types)
// ============================================================================

// Type exports from railway.types
export type {
    RollingStockCategory,
    SceneryCategory,
    AssetCategory,
    OutlinerNodeType,
    DefaultOutlinerCategory,
    ScalingMode,
    ScalePivotPoint,
    ModelDimensions,
    ScalePreset,
    CategoryPresets,
    ScaleConstraints,
    AssetScalingConfig,
    AssetMetadata,
    Transform3D,
    ScaleResult,
} from './railway.types';

// Value exports from railway.types
export {
    ROLLING_STOCK_LABELS,
    ROLLING_STOCK_ICONS,
    SCENERY_LABELS,
    SCENERY_ICONS,
    ASSET_CATEGORY_LABELS,
    ASSET_CATEGORY_ICONS,
    NODE_TYPE_TO_CATEGORY,
    NODE_TYPE_ICONS,
    OUTLINER_CATEGORY_ICONS,
    SCALING_MODE_LABELS,
    SCALING_MODE_DESCRIPTIONS,
    createModelDimensions,
    DEFAULT_SCALE_CONSTRAINTS,
    DEFAULT_CATEGORY_PRESETS,
    IDENTITY_TRANSFORM,
    MODEL_CATEGORY_MAP,
    getAssetCategory,
    getOutlinerNodeType,
    isRollingStockCategory,
    isValidRollingStockCategory,
    isValidAssetCategory,
    isValidScalingMode,
} from './railway.types';

// ============================================================================
// ASSET LIBRARY TYPES
// ============================================================================

// Type exports from assetLibrary.types
export type {
    AssetLibrary,
    AssetImportOptions,
    AssetImportResult,
    AssetStorageConfig,
    AssetDisplayItem,
    AssetLibraryFilter,
    AssetLibraryStats,
    AssetScalingMode,
    AssetSelectionCallback,
    AssetRemovalCallback,
} from './assetLibrary.types';

// Value exports from assetLibrary.types
export {
    DEFAULT_ASSET_LIBRARY,
    DEFAULT_STORAGE_CONFIG,
    ROLLING_STOCK_CATEGORY_LABELS,
    ROLLING_STOCK_CATEGORY_ICONS,
} from './assetLibrary.types';

// ============================================================================
// OUTLINER TYPES
// ============================================================================

// Type exports from outliner.types
export type {
    OutlinerNodeData,
    OutlinerState,
    OutlinerTransform,
    OutlinerEventType,
    OutlinerEventBase,
    NodeCreatedEvent,
    NodeDeletedEvent,
    NodeRenamedEvent,
    NodeMovedEvent,
    NodeVisibilityChangedEvent,
    NodeLockChangedEvent,
    NodeExpandedChangedEvent,
    NodeSelectedEvent,
    NodeDeselectedEvent,
    SelectionChangedEvent,
    NodeDuplicatedEvent,
    HierarchyChangedEvent,
    OutlinerEvent,
    OutlinerEventListener,
    OutlinerUIConfig,
    DefaultCategory,
} from './outliner.types';

// Value exports from outliner.types
export {
    DEFAULT_OUTLINER_STATE,
    DEFAULT_OUTLINER_TRANSFORM,
    DEFAULT_OUTLINER_UI_CONFIG,
    createOutlinerNode,
    getNodeIcon,
    getCategoryIcon,
    getNodeTypeForCategory,
    CATEGORY_ICONS,
    MODEL_CATEGORY_TO_NODE_TYPE,
} from './outliner.types';

// ============================================================================
// SCALING TYPES
// ============================================================================

// Type exports from scaling.types
export type {
    GizmoInteractionState,
    ScaleGizmoConfig,
    IScalable,
    TransformPanelConfig,
    ScaleHotkeyConfig,
    ScaleManagerState,
    ScaleEventType,
    ScaleEvent,
    ScaleEventListener,
    ScaleOperationResult,
    ObjectScaleInfo,
    ScalableAssetCategory,
    ObjectDimensions,
} from './scaling.types';

// Value exports from scaling.types
export {
    DEFAULT_GIZMO_CONFIG,
    DEFAULT_TRANSFORM_PANEL_CONFIG,
    DEFAULT_HOTKEY_CONFIG,
    INITIAL_SCALE_MANAGER_STATE,
    applyScaleConstraints,
    getConstraintsForCategory,
    getPresetsForCategory,
    findPresetById,
    getDefaultPreset,
    scaleDimensions,
} from './scaling.types';