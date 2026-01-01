/**
 * Persistence Module - Index
 * 
 * Path: frontend/src/core/persistence/index.ts
 * 
 * Re-exports all persistence-related classes and types for clean imports.
 * 
 * @module Persistence
 * @author Model Railway Workbench
 * @version 1.0.0
 * 
 * @example
 * ```typescript
 * import { 
 *     LayoutManager, 
 *     createLayoutManager,
 *     LayoutSerializer,
 *     LayoutDeserializer 
 * } from './core/persistence';
 * ```
 */

// ============================================================================
// SERIALIZATION
// ============================================================================

export {
    LayoutSerializer,
    createLayoutSerializer
} from './LayoutSerializer';

// ============================================================================
// DESERIALIZATION
// ============================================================================

export {
    LayoutDeserializer,
    createLayoutDeserializer
} from './LayoutDeserializer';

export type {
    DeserializationResult,
    DeserializationProgressCallback
} from './LayoutDeserializer';

// ============================================================================
// LAYOUT MANAGER
// ============================================================================

export {
    LayoutManager,
    createLayoutManager
} from './LayoutManager';

export type {
    RecentFile,
    LayoutManagerEventType,
    LayoutManagerEvent,
    LayoutManagerEventListener
} from './LayoutManager';

// ============================================================================
// RE-EXPORT SHARED TYPES
// ============================================================================

export type {
    // Schema types
    LayoutFile,
    SerializedVector3,
    SerializedQuaternion,
    SerializedTransform,
    SerializedProjectConfig,
    SerializedBaseboard,
    SerializedTrackLayout,
    SerializedTrackPiece,
    SerializedConnector,
    SerializedGraphNode,
    SerializedGraphEdge,
    SerializedRollingStock,
    SerializedScenery,
    SerializedAssetReference,
    SerializedCameraState,
    SerializedOutlinerNode,
    SerializedOutlinerState,
    SerializedSettings,

    // Result types
    LayoutValidationResult,
    LayoutLoadResult,
    LayoutSaveResult
} from '../../../../shared/types/layout.types';

export {
    LAYOUT_SCHEMA_VERSION,
    LAYOUT_FILE_EXTENSION,
    LAYOUT_MIME_TYPE,
    createEmptyLayout
} from '../../../../shared/types/layout.types';

// ============================================================================
// INTEGRATION HELPER
// ============================================================================

export {
    PersistenceIntegration,
    createPersistenceIntegration
} from './PersistenceIntegration';