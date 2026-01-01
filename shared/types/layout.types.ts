/**
 * layout.types.ts - Layout file schema type definitions
 * 
 * Path: shared/types/layout.types.ts
 * 
 * Defines the complete structure for saved layout files (.mrlayout).
 * This schema captures all data needed to reconstruct a layout:
 * - Project metadata
 * - Baseboard configuration
 * - Track pieces and connections
 * - Rolling stock placements
 * - Scenery items
 * - Imported model references
 * - Camera state
 * - World Outliner hierarchy
 * 
 * File format: JSON with .mrlayout extension
 * Schema version: 1.0.0
 * 
 * @module LayoutTypes
 * @author Model Railway Workbench
 * @version 1.0.0
 */

// ============================================================================
// SCHEMA VERSION & METADATA
// ============================================================================

/**
 * Current layout schema version
 * Increment when making breaking changes to the format
 */
export const LAYOUT_SCHEMA_VERSION = '1.0.0';

/**
 * Layout file extension
 */
export const LAYOUT_FILE_EXTENSION = '.mrlayout';

/**
 * Layout file MIME type for file dialogs
 */
export const LAYOUT_MIME_TYPE = 'application/json';

// ============================================================================
// COMMON TYPES
// ============================================================================

/**
 * 3D vector for positions and directions
 */
export interface SerializedVector3 {
    x: number;
    y: number;
    z: number;
}

/**
 * Quaternion for rotations
 */
export interface SerializedQuaternion {
    x: number;
    y: number;
    z: number;
    w: number;
}

/**
 * Complete transform data
 */
export interface SerializedTransform {
    position: SerializedVector3;
    rotation: SerializedQuaternion;
    scale?: SerializedVector3;
}

// ============================================================================
// PROJECT METADATA
// ============================================================================

/**
 * Saved project configuration
 */
export interface SerializedProjectConfig {
    /** Project unique identifier */
    projectId: string;
    /** User-friendly project name */
    name: string;
    /** Project description */
    description?: string;
    /** Scale standard (e.g., 'OO', 'HO', 'N') */
    scaleStandard: string;
    /** Scale ratio (e.g., 76.2 for OO) */
    scaleRatio: number;
    /** Creation timestamp (ISO 8601) */
    createdAt: string;
    /** Last modified timestamp (ISO 8601) */
    modifiedAt: string;
    /** Application version that created this file */
    appVersion: string;
}

// ============================================================================
// BASEBOARD DATA
// ============================================================================

/**
 * Saved baseboard configuration
 */
export interface SerializedBaseboard {
    /** Board width in meters */
    widthM: number;
    /** Board depth in meters */
    depthM: number;
    /** Board thickness in meters */
    thicknessM: number;
    /** Height from floor in meters */
    heightFromFloorM: number;
    /** Origin position mode */
    origin: 'center' | 'corner';
    /** Table configuration */
    table?: {
        enabled: boolean;
        style: string;
        legInsetM: number;
    };
}

// ============================================================================
// TRACK DATA
// ============================================================================

/**
 * Saved connector state
 */
export interface SerializedConnector {
    /** Connector identifier (e.g., 'A', 'B', 'COMMON') */
    id: string;
    /** Associated graph node ID (for connection tracking) */
    nodeId?: string;
}

/**
 * Saved track piece
 */
export interface SerializedTrackPiece {
    /** Unique piece identifier */
    id: string;
    /** Reference to track catalog ID (e.g., 'R1', 'ST-100', 'R-H-Y') */
    catalogId: string;
    /** World transform */
    transform: SerializedTransform;
    /** Connector states */
    connectors: SerializedConnector[];
    /** Switch state (for turnouts) */
    switchState?: 'A' | 'B';
    /** Generated edge IDs in track graph */
    generatedEdgeIds: string[];
}

/**
 * Track graph node
 */
export interface SerializedGraphNode {
    /** Node identifier */
    id: string;
    /** World position */
    position: SerializedVector3;
}

/**
 * Track graph edge (segment between nodes)
 */
export interface SerializedGraphEdge {
    /** Edge identifier */
    id: string;
    /** Start node ID */
    startNodeId: string;
    /** End node ID */
    endNodeId: string;
    /** Length in meters */
    lengthM: number;
    /** Curve definition */
    curve: {
        type: 'straight' | 'arc';
        radiusM?: number;
        angleDeg?: number;
        arcCenter?: SerializedVector3;
    };
    /** Associated track piece ID */
    pieceId: string;
}

/**
 * Complete track layout data
 */
export interface SerializedTrackLayout {
    /** All placed track pieces */
    pieces: SerializedTrackPiece[];
    /** Track graph nodes */
    graphNodes: SerializedGraphNode[];
    /** Track graph edges */
    graphEdges: SerializedGraphEdge[];
    /** Next piece ID counter (for generating unique IDs) */
    nextPieceId: number;
}

// ============================================================================
// ROLLING STOCK DATA
// ============================================================================

/**
 * Saved rolling stock placement
 */
export interface SerializedRollingStock {
    /** Unique placement identifier */
    id: string;
    /** Reference to asset library entry ID */
    assetId: string;
    /** Display name */
    name: string;
    /** Rolling stock category */
    category: string;
    /** World transform */
    transform: SerializedTransform;
    /** Applied scale factor */
    scaleFactor: number;
    /** Track placement data (if on track) */
    trackPlacement?: {
        /** Track piece ID this is placed on */
        trackPieceId: string;
        /** Position along track edge (0-1) */
        trackPosition: number;
        /** Direction along track (1 or -1) */
        trackDirection: number;
    };
    /** Scale adapter state */
    scaleState?: {
        pivotPoint: string;
        customPivotOffset?: SerializedVector3;
        scaleLocked: boolean;
    };
}

// ============================================================================
// SCENERY DATA
// ============================================================================

/**
 * Saved scenery item placement
 */
export interface SerializedScenery {
    /** Unique placement identifier */
    id: string;
    /** Reference to asset library entry ID (if from library) */
    assetId?: string;
    /** Reference to catalog entry ID (if from built-in catalog) */
    catalogId?: string;
    /** Display name */
    name: string;
    /** World transform */
    transform: SerializedTransform;
    /** Applied scale factor */
    scaleFactor: number;
}

// ============================================================================
// IMPORTED MODELS / ASSET LIBRARY
// ============================================================================

/**
 * Embedded model data for portable layouts
 * Models can be embedded as data URLs or referenced by path
 */
export interface SerializedAssetReference {
    /** Asset library entry ID */
    id: string;
    /** Asset display name */
    name: string;
    /** Asset category */
    category: string;
    /** Original filename */
    originalFilename: string;
    /** File format (glb/gltf) */
    format: 'glb' | 'gltf';
    /** 
     * Model data source - either:
     * - Relative path to model file (if models folder included)
     * - Data URL (base64 encoded, for portable layouts)
     */
    source: string;
    /** Whether source is a data URL */
    isEmbedded: boolean;
    /** Original dimensions in model units */
    originalDimensions: {
        width: number;
        height: number;
        depth: number;
    };
    /** Default scale preset */
    defaultScaleFactor: number;
    /** Tags for searching */
    tags: string[];
}

// ============================================================================
// CAMERA STATE
// ============================================================================

/**
 * Saved camera configuration
 */
export interface SerializedCameraState {
    /** Camera mode */
    mode: 'orbit' | 'walk' | 'topDown';
    /** Camera position */
    position: SerializedVector3;
    /** Camera target/look-at point */
    target: SerializedVector3;
    /** Camera up vector */
    up?: SerializedVector3;
    /** Field of view (degrees) */
    fov?: number;
    /** Orbit-specific: current radius */
    orbitRadius?: number;
    /** Orbit-specific: alpha angle (horizontal) */
    orbitAlpha?: number;
    /** Orbit-specific: beta angle (vertical) */
    orbitBeta?: number;
}

// ============================================================================
// WORLD OUTLINER STATE
// ============================================================================

/**
 * Outliner node data for hierarchy reconstruction
 */
export interface SerializedOutlinerNode {
    /** Node identifier */
    id: string;
    /** Display name */
    name: string;
    /** Node type (folder, track, rollingStock, scenery, etc.) */
    type: string;
    /** Parent node ID (null for root items) */
    parentId: string | null;
    /** Associated scene object ID (if applicable) */
    sceneObjectId: string | null;
    /** Is node expanded in UI */
    isExpanded: boolean;
    /** Is node visible */
    isVisible: boolean;
    /** Is node locked */
    isLocked: boolean;
    /** Additional metadata */
    metadata: Record<string, unknown>;
}

/**
 * Complete outliner hierarchy state
 */
export interface SerializedOutlinerState {
    /** All nodes in hierarchy */
    nodes: SerializedOutlinerNode[];
    /** Currently selected node IDs */
    selectedIds: string[];
    /** Schema version */
    schemaVersion: string;
}

// ============================================================================
// APPLICATION SETTINGS
// ============================================================================

/**
 * Saved application settings (layout-specific)
 */
export interface SerializedSettings {
    /** Auto-snap enabled */
    autoSnap: boolean;
    /** Connection indicators visible */
    showConnections: boolean;
    /** Grid visible */
    showGrid: boolean;
    /** Grid size in meters */
    gridSizeM: number;
    /** Snap-to-grid enabled */
    snapToGrid: boolean;
}

// ============================================================================
// COMPLETE LAYOUT FILE STRUCTURE
// ============================================================================

/**
 * Complete layout file structure
 * 
 * This is the root object saved to .mrlayout files.
 * All data needed to fully reconstruct a layout is contained here.
 * 
 * @example
 * ```typescript
 * const layout: LayoutFile = {
 *     schemaVersion: '1.0.0',
 *     project: { ... },
 *     baseboard: { ... },
 *     track: { ... },
 *     rollingStock: [ ... ],
 *     scenery: [ ... ],
 *     assets: [ ... ],
 *     camera: { ... },
 *     outliner: { ... },
 *     settings: { ... }
 * };
 * ```
 */
export interface LayoutFile {
    // ========================================================================
    // VERSION & METADATA
    // ========================================================================

    /** Schema version for migration support */
    schemaVersion: string;

    /** Project metadata */
    project: SerializedProjectConfig;

    // ========================================================================
    // SCENE DATA
    // ========================================================================

    /** Baseboard configuration */
    baseboard: SerializedBaseboard;

    /** Track layout data */
    track: SerializedTrackLayout;

    /** Placed rolling stock */
    rollingStock: SerializedRollingStock[];

    /** Placed scenery items */
    scenery: SerializedScenery[];

    // ========================================================================
    // ASSET REFERENCES
    // ========================================================================

    /** 
     * Asset references for imported models
     * Only includes assets that are actually used in this layout
     */
    assets: SerializedAssetReference[];

    // ========================================================================
    // UI STATE
    // ========================================================================

    /** Camera state to restore view */
    camera: SerializedCameraState;

    /** World Outliner hierarchy */
    outliner: SerializedOutlinerState;

    /** Layout-specific settings */
    settings: SerializedSettings;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Result of layout file validation
 */
export interface LayoutValidationResult {
    /** Whether the file is valid */
    isValid: boolean;
    /** Validation errors (if any) */
    errors: string[];
    /** Validation warnings (non-fatal issues) */
    warnings: string[];
    /** Detected schema version */
    detectedVersion?: string;
    /** Whether migration is needed */
    needsMigration: boolean;
    /** Target version after migration */
    targetVersion?: string;
}

/**
 * Result of layout load operation
 */
export interface LayoutLoadResult {
    /** Whether load succeeded */
    success: boolean;
    /** Loaded layout data (if successful) */
    layout?: LayoutFile;
    /** Error message (if failed) */
    error?: string;
    /** File path that was loaded */
    filePath: string;
    /** Any warnings during load */
    warnings: string[];
}

/**
 * Result of layout save operation
 */
export interface LayoutSaveResult {
    /** Whether save succeeded */
    success: boolean;
    /** Error message (if failed) */
    error?: string;
    /** File path that was saved */
    filePath: string;
    /** File size in bytes */
    fileSizeBytes?: number;
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create an empty layout file with defaults
 * @param projectName - Name for the project
 * @returns Empty layout file structure
 */
export function createEmptyLayout(projectName: string = 'Untitled Layout'): LayoutFile {
    const now = new Date().toISOString();

    return {
        schemaVersion: LAYOUT_SCHEMA_VERSION,

        project: {
            projectId: generateUniqueId('project'),
            name: projectName,
            scaleStandard: 'OO',
            scaleRatio: 76.2,
            createdAt: now,
            modifiedAt: now,
            appVersion: '1.0.0'
        },

        baseboard: {
            widthM: 1.2,
            depthM: 0.6,
            thicknessM: 0.025,
            heightFromFloorM: 0.9,
            origin: 'center',
            table: {
                enabled: true,
                style: 'simpleWood',
                legInsetM: 0.05
            }
        },

        track: {
            pieces: [],
            graphNodes: [],
            graphEdges: [],
            nextPieceId: 1
        },

        rollingStock: [],

        scenery: [],

        assets: [],

        camera: {
            mode: 'orbit',
            position: { x: 0, y: 1.5, z: 2 },
            target: { x: 0, y: 0, z: 0 },
            fov: 45
        },

        outliner: {
            nodes: [],
            selectedIds: [],
            schemaVersion: '1.0.0'
        },

        settings: {
            autoSnap: true,
            showConnections: true,
            showGrid: true,
            gridSizeM: 0.01,
            snapToGrid: false
        }
    };
}

/**
 * Generate a unique identifier
 * @param prefix - Prefix for the ID
 * @returns Unique identifier string
 */
function generateUniqueId(prefix: string = 'id'): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}`;
}