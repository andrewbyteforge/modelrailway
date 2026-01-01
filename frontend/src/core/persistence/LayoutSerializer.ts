/**
 * LayoutSerializer.ts - Serializes layout data from scene systems
 * 
 * Path: frontend/src/core/persistence/LayoutSerializer.ts
 * 
 * Collects data from all scene systems and converts to serializable format:
 * - Track pieces from TrackSystem
 * - Rolling stock from PlacedItemManager
 * - Scenery from PlacedItemManager
 * - World Outliner hierarchy
 * - Camera state
 * - Asset references from ModelLibrary
 * 
 * @module LayoutSerializer
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Scene } from '@babylonjs/core/scene';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';

import type {
    LayoutFile,
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
    SerializedOutlinerState,
    SerializedOutlinerNode,
    SerializedSettings,
    SerializedVector3,
    SerializedQuaternion,
    SerializedTransform,
    LAYOUT_SCHEMA_VERSION
} from '../../../../shared/types/layout.types';

import type { TrackSystem } from '../../systems/track/TrackSystem';
import type { TrackPiece, Connector } from '../../systems/track/TrackPiece';
import type { TrackGraph, GraphNode, GraphEdge } from '../../systems/track/TrackGraph';
import type { WorldOutliner } from '../../systems/outliner/WorldOutliner';
import type { ModelLibrary, ModelLibraryEntry } from '../../systems/models/ModelLibrary';
import type { PlacedItemManager } from '../../systems/assets/PlacedItemManager';
import type { Project } from '../Project';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[LayoutSerializer]';

/** Current application version */
const APP_VERSION = '1.0.0';

// ============================================================================
// LAYOUT SERIALIZER CLASS
// ============================================================================

/**
 * LayoutSerializer - Converts runtime scene data to serializable format
 * 
 * Collects data from all subsystems and produces a LayoutFile object
 * that can be saved to disk as JSON.
 * 
 * @example
 * ```typescript
 * const serializer = new LayoutSerializer(scene);
 * serializer.setTrackSystem(trackSystem);
 * serializer.setWorldOutliner(worldOutliner);
 * 
 * const layoutData = serializer.serialize('My Layout');
 * const json = JSON.stringify(layoutData, null, 2);
 * ```
 */
export class LayoutSerializer {
    // ========================================================================
    // PRIVATE PROPERTIES
    // ========================================================================

    /** Babylon.js scene reference */
    private scene: Scene;

    /** Project configuration */
    private project: Project | null = null;

    /** Track system reference */
    private trackSystem: TrackSystem | null = null;

    /** World Outliner reference */
    private worldOutliner: WorldOutliner | null = null;

    /** Model library reference */
    private modelLibrary: ModelLibrary | null = null;

    /** Placed item manager reference */
    private placedItemManager: PlacedItemManager | null = null;

    /** Set of asset IDs used in this layout */
    private usedAssetIds: Set<string> = new Set();

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new LayoutSerializer
     * @param scene - Babylon.js scene to serialize
     */
    constructor(scene: Scene) {
        this.scene = scene;
        console.log(`${LOG_PREFIX} LayoutSerializer created`);
    }

    // ========================================================================
    // SYSTEM SETTERS
    // ========================================================================

    /**
     * Set the project reference
     * @param project - Project instance
     */
    setProject(project: Project): void {
        this.project = project;
    }

    /**
     * Set the track system reference
     * @param trackSystem - TrackSystem instance
     */
    setTrackSystem(trackSystem: TrackSystem): void {
        this.trackSystem = trackSystem;
    }

    /**
     * Set the World Outliner reference
     * @param outliner - WorldOutliner instance
     */
    setWorldOutliner(outliner: WorldOutliner): void {
        this.worldOutliner = outliner;
    }

    /**
     * Set the model library reference
     * @param library - ModelLibrary instance
     */
    setModelLibrary(library: ModelLibrary): void {
        this.modelLibrary = library;
    }

    /**
     * Set the placed item manager reference
     * @param manager - PlacedItemManager instance
     */
    setPlacedItemManager(manager: PlacedItemManager): void {
        this.placedItemManager = manager;
    }

    // ========================================================================
    // MAIN SERIALIZATION
    // ========================================================================

    /**
     * Serialize the complete layout to a LayoutFile object
     * @param layoutName - Name for the layout
     * @param description - Optional description
     * @returns Complete serialized layout data
     */
    serialize(layoutName: string, description?: string): LayoutFile {
        console.log(`${LOG_PREFIX} Starting serialization for: ${layoutName}`);

        try {
            // Reset used assets tracking
            this.usedAssetIds.clear();

            // Collect all data
            const project = this.serializeProject(layoutName, description);
            const baseboard = this.serializeBaseboard();
            const track = this.serializeTrackLayout();
            const rollingStock = this.serializeRollingStock();
            const scenery = this.serializeScenery();
            const assets = this.serializeUsedAssets();
            const camera = this.serializeCameraState();
            const outliner = this.serializeOutlinerState();
            const settings = this.serializeSettings();

            // Build the complete layout file
            const layout: LayoutFile = {
                schemaVersion: '1.0.0', // Use the constant value
                project,
                baseboard,
                track,
                rollingStock,
                scenery,
                assets,
                camera,
                outliner,
                settings
            };

            console.log(`${LOG_PREFIX} Serialization complete:`, {
                trackPieces: track.pieces.length,
                graphNodes: track.graphNodes.length,
                graphEdges: track.graphEdges.length,
                rollingStock: rollingStock.length,
                scenery: scenery.length,
                assets: assets.length
            });

            return layout;

        } catch (error) {
            console.error(`${LOG_PREFIX} Serialization error:`, error);
            throw new Error(`Failed to serialize layout: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // ========================================================================
    // PROJECT SERIALIZATION
    // ========================================================================

    /**
     * Serialize project configuration
     */
    private serializeProject(name: string, description?: string): SerializedProjectConfig {
        const now = new Date().toISOString();

        // Get project data if available
        let projectData: any = null;
        try {
            projectData = this.project?.getData();
        } catch {
            // Project not loaded, use defaults
        }

        return {
            projectId: projectData?.projectId || this.generateId('project'),
            name: name,
            description: description,
            scaleStandard: projectData?.units?.scale?.standard || 'OO',
            scaleRatio: projectData?.units?.scale?.ratio || 76.2,
            createdAt: projectData?.createdAt || now,
            modifiedAt: now,
            appVersion: APP_VERSION
        };
    }

    // ========================================================================
    // BASEBOARD SERIALIZATION
    // ========================================================================

    /**
     * Serialize baseboard configuration
     */
    private serializeBaseboard(): SerializedBaseboard {
        // Get board data from project if available
        let boardData: any = null;
        try {
            boardData = this.project?.getBoardDimensions();
        } catch {
            // Use defaults
        }

        let tableConfig: any = null;
        try {
            tableConfig = this.project?.getTableConfig();
        } catch {
            // Use defaults
        }

        return {
            widthM: boardData?.width || 1.2,
            depthM: boardData?.depth || 0.6,
            thicknessM: boardData?.thickness || 0.025,
            heightFromFloorM: boardData?.heightFromFloor || 0.9,
            origin: 'center',
            table: tableConfig ? {
                enabled: tableConfig.enabled ?? true,
                style: tableConfig.style || 'simpleWood',
                legInsetM: tableConfig.legInsetM || 0.05
            } : undefined
        };
    }

    // ========================================================================
    // TRACK SERIALIZATION
    // ========================================================================

    /**
     * Serialize the complete track layout
     */
    private serializeTrackLayout(): SerializedTrackLayout {
        if (!this.trackSystem) {
            console.warn(`${LOG_PREFIX} TrackSystem not set, returning empty track layout`);
            return {
                pieces: [],
                graphNodes: [],
                graphEdges: [],
                nextPieceId: 1
            };
        }

        try {
            // Get all pieces from track system
            const pieces = this.trackSystem.getAllPieces();

            console.log(`${LOG_PREFIX} Serializing ${pieces.length} track pieces:`,
                pieces.map(p => ({ id: p.id, catalogId: p.catalogId }))
            );

            const serializedPieces = pieces.map(piece => this.serializeTrackPiece(piece));

            // Get graph data
            const graph = this.trackSystem.getGraph();
            const graphNodes = this.serializeGraphNodes(graph);
            const graphEdges = this.serializeGraphEdges(graph);

            // Get next piece ID counter
            const nextPieceId = this.trackSystem.getNextPieceId?.() ||
                Math.max(...pieces.map(p => parseInt(p.id.split('_')[1]) || 0), 0) + 1;

            return {
                pieces: serializedPieces,
                graphNodes,
                graphEdges,
                nextPieceId
            };

        } catch (error) {
            console.error(`${LOG_PREFIX} Error serializing track layout:`, error);
            return {
                pieces: [],
                graphNodes: [],
                graphEdges: [],
                nextPieceId: 1
            };
        }
    }

    /**
     * Serialize a single track piece
     */
    private serializeTrackPiece(piece: TrackPiece): SerializedTrackPiece {
        return {
            id: piece.id,
            catalogId: piece.catalogId,
            transform: this.serializeTransform(
                piece.transform.position,
                piece.transform.rotation
            ),
            connectors: piece.connectors.map(c => this.serializeConnector(c)),
            switchState: piece.isSwitch ? piece.switchState : undefined,
            generatedEdgeIds: [...piece.generatedEdgeIds]
        };
    }

    /**
     * Serialize a connector
     */
    private serializeConnector(connector: Connector): SerializedConnector {
        return {
            id: connector.id,
            nodeId: connector.nodeId
        };
    }

    /**
     * Serialize all graph nodes
     */
    private serializeGraphNodes(graph: TrackGraph): SerializedGraphNode[] {
        try {
            const nodes = graph.getAllNodes();
            return nodes.map(node => ({
                id: node.id,
                position: this.serializeVector3(node.pos)
            }));
        } catch (error) {
            console.error(`${LOG_PREFIX} Error serializing graph nodes:`, error);
            return [];
        }
    }

    /**
     * Serialize all graph edges
     */
    private serializeGraphEdges(graph: TrackGraph): SerializedGraphEdge[] {
        try {
            const edges = graph.getAllEdges();
            return edges.map(edge => ({
                id: edge.id,
                startNodeId: edge.from,
                endNodeId: edge.to,
                lengthM: edge.length,
                curve: {
                    type: edge.curve?.type || 'straight',
                    radiusM: edge.curve?.radiusM,
                    angleDeg: edge.curve?.angleDeg,
                    arcCenter: edge.curve?.arcCenter ?
                        this.serializeVector3(edge.curve.arcCenter) : undefined
                },
                pieceId: edge.pieceId
            }));
        } catch (error) {
            console.error(`${LOG_PREFIX} Error serializing graph edges:`, error);
            return [];
        }
    }

    // ========================================================================
    // ROLLING STOCK SERIALIZATION
    // ========================================================================

    /**
     * Serialize all placed rolling stock
     */
    private serializeRollingStock(): SerializedRollingStock[] {
        if (!this.placedItemManager) {
            console.warn(`${LOG_PREFIX} PlacedItemManager not set, returning empty rolling stock`);
            return [];
        }

        try {
            const items = this.placedItemManager.getItemsByType('rollingStock');
            const serialized: SerializedRollingStock[] = [];

            for (const item of items) {
                // Track used asset IDs
                if (item.assetId) {
                    this.usedAssetIds.add(item.assetId);
                }

                // Find the mesh in scene for transform data
                const mesh = this.findMeshByName(item.meshName || '');

                serialized.push({
                    id: item.id,
                    assetId: item.assetId || '',
                    name: item.name,
                    category: item.category || 'trains',
                    transform: mesh ? this.serializeMeshTransform(mesh) : {
                        position: this.serializeVector3Obj(item.position || { x: 0, y: 0, z: 0 }),
                        rotation: { x: 0, y: 0, z: 0, w: 1 }
                    },
                    scaleFactor: item.scale || 1,
                    trackPlacement: item.trackPieceId ? {
                        trackPieceId: item.trackPieceId,
                        trackPosition: item.trackPosition || 0.5,
                        trackDirection: item.trackDirection || 1
                    } : undefined,
                    scaleState: item.scaleState
                });
            }

            return serialized;

        } catch (error) {
            console.error(`${LOG_PREFIX} Error serializing rolling stock:`, error);
            return [];
        }
    }

    // ========================================================================
    // SCENERY SERIALIZATION
    // ========================================================================

    /**
     * Serialize all placed scenery
     */
    private serializeScenery(): SerializedScenery[] {
        if (!this.placedItemManager) {
            return [];
        }

        try {
            const items = this.placedItemManager.getItemsByType('scenery');
            const serialized: SerializedScenery[] = [];

            for (const item of items) {
                // Track used asset IDs
                if (item.assetId) {
                    this.usedAssetIds.add(item.assetId);
                }

                const mesh = this.findMeshByName(item.meshName || '');

                serialized.push({
                    id: item.id,
                    assetId: item.assetId,
                    catalogId: item.catalogId,
                    name: item.name,
                    transform: mesh ? this.serializeMeshTransform(mesh) : {
                        position: this.serializeVector3Obj(item.position || { x: 0, y: 0, z: 0 }),
                        rotation: { x: 0, y: 0, z: 0, w: 1 }
                    },
                    scaleFactor: item.scale || 1
                });
            }

            return serialized;

        } catch (error) {
            console.error(`${LOG_PREFIX} Error serializing scenery:`, error);
            return [];
        }
    }

    // ========================================================================
    // ASSET SERIALIZATION
    // ========================================================================

    /**
     * Serialize references to used assets
     * Only includes assets that are actually used in this layout
     */
    private serializeUsedAssets(): SerializedAssetReference[] {
        if (!this.modelLibrary || this.usedAssetIds.size === 0) {
            return [];
        }

        try {
            const assets: SerializedAssetReference[] = [];

            for (const assetId of this.usedAssetIds) {
                const entry = this.modelLibrary.getModel(assetId);
                if (entry) {
                    assets.push({
                        id: entry.id,
                        name: entry.name,
                        category: entry.category,
                        originalFilename: entry.importMetadata.originalFilename,
                        format: entry.importMetadata.format,
                        source: entry.filePath,
                        isEmbedded: entry.filePath.startsWith('data:'),
                        originalDimensions: {
                            width: entry.originalDimensions.width,
                            height: entry.originalDimensions.height,
                            depth: entry.originalDimensions.depth
                        },
                        defaultScaleFactor: entry.scalePresets.find(p => p.isDefault)?.scaleFactor || 1,
                        tags: [...entry.tags]
                    });
                }
            }

            return assets;

        } catch (error) {
            console.error(`${LOG_PREFIX} Error serializing assets:`, error);
            return [];
        }
    }

    // ========================================================================
    // CAMERA SERIALIZATION
    // ========================================================================

    /**
     * Serialize current camera state
     */
    private serializeCameraState(): SerializedCameraState {
        try {
            const camera = this.scene.activeCamera;

            if (!camera) {
                return this.getDefaultCameraState();
            }

            // Handle ArcRotateCamera (orbit camera)
            if (camera instanceof ArcRotateCamera) {
                return {
                    mode: 'orbit',
                    position: this.serializeVector3(camera.position),
                    target: this.serializeVector3(camera.target),
                    fov: camera.fov * (180 / Math.PI), // Convert to degrees
                    orbitRadius: camera.radius,
                    orbitAlpha: camera.alpha,
                    orbitBeta: camera.beta
                };
            }

            // Generic camera fallback
            return {
                mode: 'orbit',
                position: this.serializeVector3(camera.position),
                target: camera.getTarget ?
                    this.serializeVector3(camera.getTarget()) :
                    { x: 0, y: 0, z: 0 },
                fov: 45
            };

        } catch (error) {
            console.error(`${LOG_PREFIX} Error serializing camera:`, error);
            return this.getDefaultCameraState();
        }
    }

    /**
     * Get default camera state
     */
    private getDefaultCameraState(): SerializedCameraState {
        return {
            mode: 'orbit',
            position: { x: 0, y: 1.5, z: 2 },
            target: { x: 0, y: 0, z: 0 },
            fov: 45
        };
    }

    // ========================================================================
    // OUTLINER SERIALIZATION
    // ========================================================================

    /**
     * Serialize World Outliner state
     */
    private serializeOutlinerState(): SerializedOutlinerState {
        if (!this.worldOutliner) {
            return {
                nodes: [],
                selectedIds: [],
                schemaVersion: '1.0.0'
            };
        }

        try {
            // Use the outliner's built-in export
            const exportedState = this.worldOutliner.exportState();

            return {
                nodes: exportedState.nodes || [],
                selectedIds: exportedState.selectedIds || [],
                schemaVersion: exportedState.schemaVersion || '1.0.0'
            };

        } catch (error) {
            console.error(`${LOG_PREFIX} Error serializing outliner:`, error);
            return {
                nodes: [],
                selectedIds: [],
                schemaVersion: '1.0.0'
            };
        }
    }

    // ========================================================================
    // SETTINGS SERIALIZATION
    // ========================================================================

    /**
     * Serialize layout-specific settings
     */
    private serializeSettings(): SerializedSettings {
        // Default settings - extend as needed
        return {
            autoSnap: true,
            showConnections: true,
            showGrid: true,
            gridSizeM: 0.01,
            snapToGrid: false
        };
    }

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

    /**
     * Serialize a Vector3 to plain object
     */
    private serializeVector3(vec: Vector3): SerializedVector3 {
        return {
            x: vec.x,
            y: vec.y,
            z: vec.z
        };
    }

    /**
     * Serialize a vector-like object to SerializedVector3
     */
    private serializeVector3Obj(obj: { x: number; y: number; z: number }): SerializedVector3 {
        return {
            x: obj.x,
            y: obj.y,
            z: obj.z
        };
    }

    /**
     * Serialize a Quaternion to plain object
     */
    private serializeQuaternion(quat: Quaternion): SerializedQuaternion {
        return {
            x: quat.x,
            y: quat.y,
            z: quat.z,
            w: quat.w
        };
    }

    /**
     * Serialize a transform (position + rotation)
     */
    private serializeTransform(position: Vector3, rotation: Quaternion): SerializedTransform {
        return {
            position: this.serializeVector3(position),
            rotation: this.serializeQuaternion(rotation)
        };
    }

    /**
     * Serialize transform from a mesh
     */
    private serializeMeshTransform(mesh: any): SerializedTransform {
        const position = mesh.position || new Vector3(0, 0, 0);
        const rotation = mesh.rotationQuaternion ||
            Quaternion.FromEulerAngles(
                mesh.rotation?.x || 0,
                mesh.rotation?.y || 0,
                mesh.rotation?.z || 0
            );

        return {
            position: this.serializeVector3(position),
            rotation: this.serializeQuaternion(rotation),
            scale: mesh.scaling ? this.serializeVector3(mesh.scaling) : undefined
        };
    }

    /**
     * Find a mesh by name in the scene
     */
    private findMeshByName(name: string): any {
        if (!name) return null;
        return this.scene.getMeshByName(name);
    }

    /**
     * Generate a unique identifier
     */
    private generateId(prefix: string = 'id'): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `${prefix}_${timestamp}_${random}`;
    }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new LayoutSerializer instance
 * @param scene - Babylon.js scene
 * @returns LayoutSerializer instance
 */
export function createLayoutSerializer(scene: Scene): LayoutSerializer {
    return new LayoutSerializer(scene);
}