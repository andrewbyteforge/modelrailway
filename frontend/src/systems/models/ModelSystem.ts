/**
 * ModelSystem.ts - Core system for loading and managing 3D models
 * 
 * Path: frontend/src/systems/models/ModelSystem.ts
 * 
 * Manages:
 * - Loading GLB/GLTF models via Babylon.js SceneLoader
 * - Model placement on the baseboard
 * - Model selection and manipulation
 * - Scale application and adjustment
 * - Integration with ModelLibrary
 * 
 * v1.2.0 - Refactored to use centralized constants
 * v1.1.0 - Added metadata.originalName for train keyword detection
 * 
 * @module ModelSystem
 * @author Model Railway Workbench
 * @version 1.2.0
 */

import { Scene } from '@babylonjs/core/scene';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { HighlightLayer } from '@babylonjs/core/Layers/highlightLayer';
import '@babylonjs/loaders/glTF';

import { ModelLibrary, type ModelLibraryEntry, type ModelScalePreset } from './ModelLibrary';
import { ModelScaleHelper, type ModelDimensions, type ScaleResult } from './ModelScaleHelper';
import type { Project } from '../../core/Project';

// ============================================================================
// IMPORTS FROM CENTRALIZED CONSTANTS
// ============================================================================

import { TRACK_GEOMETRY } from '../../constants';

// ============================================================================
// RE-EXPORTS FOR BACKWARDS COMPATIBILITY
// ============================================================================

// Re-export TRACK_GEOMETRY so existing imports continue to work
export { TRACK_GEOMETRY };

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[ModelSystem]';

/** Selection highlight color - RED to match track selection */
const SELECTION_COLOR = new Color3(1.0, 0.2, 0.2);

/** Hover highlight color - Light blue */
const HOVER_COLOR = new Color3(0.5, 0.8, 1.0);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * A placed model instance in the scene
 */
export interface PlacedModel {
    /** Unique instance ID */
    id: string;
    /** Reference to library entry */
    libraryId: string;
    /** Root transform node containing all meshes */
    rootNode: TransformNode;
    /** All meshes belonging to this model */
    meshes: AbstractMesh[];
    /** Position on baseboard */
    position: Vector3;
    /** Rotation quaternion */
    rotation: Quaternion;
    /** Applied scale factor */
    scaleFactor: number;
    /** Original dimensions before scaling */
    originalDimensions: ModelDimensions;
    /** Whether model is selected */
    isSelected: boolean;
    /** Active scale preset name */
    scalePresetName: string;
}

/**
 * Model load result
 */
export interface ModelLoadResult {
    success: boolean;
    rootNode?: TransformNode;
    meshes?: AbstractMesh[];
    dimensions?: ModelDimensions;
    error?: string;
}

/**
 * Placement options for a model
 */
export interface PlacementOptions {
    /** Position to place at */
    position: Vector3;
    /** Initial rotation (degrees around Y axis) */
    rotationDeg?: number;
    /** Scale preset to use (by name) */
    scalePreset?: string;
    /** Custom scale factor (overrides preset) */
    customScale?: number;
    /** Snap Y position to rail top height (for rolling stock) */
    snapToRails?: boolean;
}

// ============================================================================
// MODEL SYSTEM CLASS
// ============================================================================

/**
 * ModelSystem - Manages 3D model loading and placement
 * 
 * @example
 * ```typescript
 * const modelSystem = new ModelSystem(scene, project);
 * modelSystem.initialize();
 * 
 * // Load and place a model
 * const entry = library.getModel('model_123');
 * await modelSystem.placeModel(entry, { position: new Vector3(0, 0, 0) });
 * ```
 */
export class ModelSystem {
    // ========================================================================
    // PRIVATE PROPERTIES
    // ========================================================================

    /** Babylon.js scene */
    private scene: Scene;

    /** Project configuration (optional) */
    private project: Project | null;

    /** Model library reference */
    private library: ModelLibrary;

    /** Placed model instances */
    private placedModels: Map<string, PlacedModel> = new Map();

    /** Currently selected model ID */
    private selectedModelId: string | null = null;

    /** Currently hovered model ID */
    private hoveredModelId: string | null = null;

    /** Highlight layer for selection */
    private highlightLayer: HighlightLayer | null = null;

    /** Counter for generating unique IDs */
    private nextInstanceId: number = 1;

    /** Cache of loaded model assets */
    private modelCache: Map<string, { rootNode: TransformNode; meshes: AbstractMesh[] }> = new Map();

    // ========================================================================
    // CONSTRUCTOR & INITIALIZATION
    // ========================================================================

    /**
     * Create a new ModelSystem
     * @param scene - Babylon.js scene
     * @param project - Project configuration (optional)
     */
    constructor(scene: Scene, project?: Project | null) {
        if (!scene) {
            throw new Error(`${LOG_PREFIX} Scene is required`);
        }

        this.scene = scene;
        this.project = project ?? null;
        this.library = ModelLibrary.getInstance();

        console.log(`${LOG_PREFIX} Created`);
    }

    /**
     * Initialize the model system
     */
    initialize(): void {
        try {
            // Create highlight layer for selection feedback
            this.highlightLayer = new HighlightLayer('modelHighlight', this.scene);
            this.highlightLayer.innerGlow = false;
            this.highlightLayer.outerGlow = true;
            this.highlightLayer.blurHorizontalSize = 1;
            this.highlightLayer.blurVerticalSize = 1;

            console.log(`${LOG_PREFIX} Initialized`);
            console.log(`${LOG_PREFIX}   Highlight layer created`);
            console.log(`${LOG_PREFIX}   Rail top Y: ${TRACK_GEOMETRY.RAIL_TOP_Y.toFixed(4)}m`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Initialization error:`, error);
            throw error;
        }
    }

    // ========================================================================
    // MODEL LOADING
    // ========================================================================

    /**
     * Load a model from file (URL or data URL)
     * @param fileUrl - URL or data URL of the GLB/GLTF file
     * @param fileName - Original filename for logging
     * @returns Load result with meshes and dimensions
     */
    async loadModelFromFile(fileUrl: string, fileName: string): Promise<ModelLoadResult> {
        try {
            console.log(`${LOG_PREFIX} Loading model: ${fileName}`);

            // Determine file extension
            const extension = fileName.toLowerCase().endsWith('.gltf') ? '.gltf' : '.glb';

            // Load the model
            const result = await SceneLoader.ImportMeshAsync(
                '',           // Mesh names to import (empty = all)
                '',           // Root URL (empty for data URLs)
                fileUrl,      // File URL or data URL
                this.scene,   // Scene
                null,         // On progress callback
                extension     // Plugin extension hint
            );

            if (!result.meshes || result.meshes.length === 0) {
                return {
                    success: false,
                    error: 'No meshes found in model file'
                };
            }

            console.log(`${LOG_PREFIX}   Loaded ${result.meshes.length} meshes`);

            // Create root transform node
            const rootNode = new TransformNode(`model_root_${Date.now()}`, this.scene);

            // ================================================================
            // CRITICAL FIX: Store original filename for train keyword detection
            // ================================================================
            // TrainIntegration.ts checks metadata.originalName to find keywords
            // like "Locom", "Coach", "Wagon" in the original filename.
            // Without this, GLB internal mesh names (__root__, node0) have no keywords!
            // ================================================================
            rootNode.metadata = {
                originalName: fileName,  // Contains keywords like "Locom", "Coach", etc.
                modelType: 'imported',
                category: 'unknown'
            };
            console.log(`${LOG_PREFIX}   Stored metadata.originalName: "${fileName}"`);
            // ================================================================

            // Parent all meshes to root node
            for (const mesh of result.meshes) {
                if (!mesh.parent || mesh.parent === this.scene) {
                    mesh.parent = rootNode;
                }

                // Make meshes pickable
                mesh.isPickable = true;
            }

            // Calculate dimensions
            const dimensions = ModelScaleHelper.getMeshDimensions(result.meshes);

            console.log(`${LOG_PREFIX}   Dimensions: ${dimensions.width.toFixed(4)} x ${dimensions.height.toFixed(4)} x ${dimensions.depth.toFixed(4)}`);

            // Hide the model initially (will be shown when placed)
            rootNode.setEnabled(false);

            return {
                success: true,
                rootNode,
                meshes: result.meshes,
                dimensions
            };

        } catch (error) {
            console.error(`${LOG_PREFIX} Error loading model:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error loading model'
            };
        }
    }

    /**
     * Load a model from the library by ID
     * @param libraryId - Library entry ID
     * @returns Load result
     */
    async loadModelFromLibrary(libraryId: string): Promise<ModelLoadResult> {
        try {
            const entry = this.library.getModel(libraryId);
            if (!entry) {
                return {
                    success: false,
                    error: `Model not found in library: ${libraryId}`
                };
            }

            // Check cache first
            if (this.modelCache.has(libraryId)) {
                console.log(`${LOG_PREFIX} Using cached model: ${entry.name}`);
                const cached = this.modelCache.get(libraryId)!;

                // Clone the cached model
                const clonedRoot = cached.rootNode.clone(`model_clone_${Date.now()}`, null);
                const clonedMeshes: AbstractMesh[] = [];

                if (clonedRoot) {
                    clonedRoot.getChildMeshes().forEach(mesh => {
                        clonedMeshes.push(mesh);
                    });

                    // ================================================================
                    // Also copy metadata to cloned root for train detection
                    // ================================================================
                    if (cached.rootNode.metadata) {
                        clonedRoot.metadata = { ...cached.rootNode.metadata };
                    }
                }

                return {
                    success: true,
                    rootNode: clonedRoot || undefined,
                    meshes: clonedMeshes,
                    dimensions: entry.originalDimensions as ModelDimensions
                };
            }

            // Load from file
            return await this.loadModelFromFile(entry.filePath, entry.importMetadata.originalFilename);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error loading from library:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    // ========================================================================
    // MODEL PLACEMENT
    // ========================================================================

    /**
     * Place a model in the scene
     * @param libraryEntry - Library entry for the model
     * @param options - Placement options
     * @returns Placed model or null on failure
     */
    async placeModel(
        libraryEntry: ModelLibraryEntry,
        options: PlacementOptions
    ): Promise<PlacedModel | null> {
        try {
            console.log(`${LOG_PREFIX} Placing model: ${libraryEntry.name}`);

            // Load the model
            const loadResult = await this.loadModelFromLibrary(libraryEntry.id);
            if (!loadResult.success || !loadResult.rootNode || !loadResult.meshes) {
                console.error(`${LOG_PREFIX} Failed to load model for placement`);
                return null;
            }

            // Generate instance ID
            const instanceId = `placed_${libraryEntry.id}_${this.nextInstanceId++}`;

            // ================================================================
            // Ensure metadata is set on the root node for train detection
            // ================================================================
            if (!loadResult.rootNode.metadata || !loadResult.rootNode.metadata.originalName) {
                loadResult.rootNode.metadata = {
                    ...loadResult.rootNode.metadata,
                    originalName: libraryEntry.name,
                    modelType: 'placed',
                    category: libraryEntry.category || 'unknown'
                };
                console.log(`${LOG_PREFIX}   Set metadata.originalName: "${libraryEntry.name}"`);
            }
            // ================================================================

            // Determine scale
            let scaleFactor = 1;
            let presetName = 'Default';

            if (options.customScale !== undefined) {
                scaleFactor = options.customScale;
                presetName = 'Custom';
            } else if (options.scalePreset) {
                const preset = libraryEntry.scalePresets.find(p => p.name === options.scalePreset);
                if (preset) {
                    scaleFactor = preset.scaleFactor;
                    presetName = preset.name;
                }
            } else {
                // Use active preset
                const activePreset = this.library.getActivePreset(libraryEntry.id);
                if (activePreset) {
                    scaleFactor = activePreset.scaleFactor;
                    presetName = activePreset.name;
                }
            }

            // ================================================================
            // Calculate position with Y offset for model bottom placement
            // ================================================================
            // The model's bounds tell us where the bottom is relative to origin
            // After scaling, we need to offset Y so the model sits ON the surface
            // not with its center at the surface

            const originalMinY = loadResult.dimensions?.boundsMin?.y ?? 0;
            const scaledMinY = originalMinY * scaleFactor;

            // Target Y for the bottom of the model
            const targetY = options.snapToRails
                ? TRACK_GEOMETRY.RAIL_TOP_Y
                : options.position.y;

            // Adjust position so model bottom is at target Y
            const adjustedPosition = options.position.clone();
            adjustedPosition.y = targetY - scaledMinY;

            // ================================================================
            // Apply transforms to root node
            // ================================================================
            loadResult.rootNode.position = adjustedPosition;
            loadResult.rootNode.scaling = new Vector3(scaleFactor, scaleFactor, scaleFactor);

            // Apply rotation
            const rotationRad = (options.rotationDeg || 0) * Math.PI / 180;
            loadResult.rootNode.rotationQuaternion = Quaternion.FromEulerAngles(0, rotationRad, 0);

            // Make visible
            loadResult.rootNode.setEnabled(true);

            // Store metadata for selection
            for (const mesh of loadResult.meshes) {
                mesh.metadata = {
                    ...mesh.metadata,
                    placedModelId: instanceId
                };
            }

            // Create placed model record
            const placedModel: PlacedModel = {
                id: instanceId,
                libraryId: libraryEntry.id,
                rootNode: loadResult.rootNode,
                meshes: loadResult.meshes,
                position: adjustedPosition.clone(),
                rotation: loadResult.rootNode.rotationQuaternion!.clone(),
                scaleFactor,
                originalDimensions: loadResult.dimensions!,
                isSelected: false,
                scalePresetName: presetName
            };

            // Store in map
            this.placedModels.set(instanceId, placedModel);

            // Mark as used in library
            this.library.markAsUsed(libraryEntry.id);

            console.log(`${LOG_PREFIX} Placed model: ${instanceId}`);
            console.log(`${LOG_PREFIX}   Position: (${adjustedPosition.x.toFixed(3)}, ${adjustedPosition.y.toFixed(3)}, ${adjustedPosition.z.toFixed(3)})`);
            console.log(`${LOG_PREFIX}   Scale: ${scaleFactor.toFixed(4)} (${presetName})`);
            console.log(`${LOG_PREFIX}   Model bottom now at Y: ${targetY.toFixed(4)}m`);

            return placedModel;

        } catch (error) {
            console.error(`${LOG_PREFIX} Error placing model:`, error);
            return null;
        }
    }

    /**
     * Place a model at a position with preview (drag-drop)
     * @param libraryId - Library entry ID
     * @param position - World position
     * @returns Preview model (not finalized)
     */
    async createPreviewModel(libraryId: string): Promise<PlacedModel | null> {
        const entry = this.library.getModel(libraryId);
        if (!entry) return null;

        // Create as preview
        const preview = await this.placeModel(entry, {
            position: Vector3.Zero()
        });

        if (preview) {
            // Make semi-transparent
            for (const mesh of preview.meshes) {
                if (mesh.material) {
                    const mat = mesh.material as StandardMaterial;
                    mat.alpha = 0.6;
                }
            }
        }

        return preview;
    }

    // ========================================================================
    // MODEL MANIPULATION
    // ========================================================================

    /**
     * Move a placed model to a new position (direct move, no offset calculation)
     * 
     * NOTE: This moves the model's ROOT NODE directly. The Y offset was already
     * calculated and applied during placeModel(). Use this for moving models
     * that are already correctly positioned.
     * 
     * @param instanceId - Placed model instance ID
     * @param position - New position for the root node
     */
    moveModel(instanceId: string, position: Vector3): void {
        const model = this.placedModels.get(instanceId);
        if (!model) return;

        // Direct move - no offset calculation
        // The offset was already applied during initial placement
        model.position = position.clone();
        model.rootNode.position = position.clone();
    }

    /**
     * Move a model so its BOTTOM sits at the specified surface position
     * 
     * This recalculates the Y offset to position the model correctly.
     * Use this when you want to place a model on a specific surface height.
     * 
     * @param instanceId - Placed model instance ID
     * @param surfacePosition - Position where the BOTTOM of the model should be
     * @param snapToRails - If true, ignore surfacePosition.y and use rail height
     */
    moveModelToSurface(instanceId: string, surfacePosition: Vector3, snapToRails: boolean = false): void {
        const model = this.placedModels.get(instanceId);
        if (!model) return;

        // Calculate Y offset based on model bounds
        const originalMinY = model.originalDimensions?.boundsMin?.y ?? 0;
        const scaledMinY = originalMinY * model.scaleFactor;

        // Determine target Y for the bottom of the model
        const targetY = snapToRails ? TRACK_GEOMETRY.RAIL_TOP_Y : surfacePosition.y;

        // Calculate root node position
        const adjustedPosition = surfacePosition.clone();
        adjustedPosition.y = targetY - scaledMinY;

        model.position = adjustedPosition.clone();
        model.rootNode.position = adjustedPosition;

        console.log(`${LOG_PREFIX} Moved ${instanceId} to surface Y=${targetY.toFixed(4)}m (root Y=${adjustedPosition.y.toFixed(4)}m)`);
    }

    /**
     * Move rolling stock to a new position, snapped to rails
     * Convenience method that always snaps to rail height
     * @param instanceId - Placed model instance ID
     * @param position - New position (X and Z used, Y is snapped to rails)
     */
    moveRollingStock(instanceId: string, position: Vector3): void {
        this.moveModelToSurface(instanceId, position, true);
    }

    /**
     * Rotate a placed model
     * @param instanceId - Placed model instance ID
     * @param deltaDeg - Rotation delta in degrees (around Y axis)
     */
    rotateModel(instanceId: string, deltaDeg: number): void {
        const model = this.placedModels.get(instanceId);
        if (!model) return;

        const deltaRad = deltaDeg * Math.PI / 180;
        const deltaQuat = Quaternion.FromEulerAngles(0, deltaRad, 0);

        model.rotation = model.rotation.multiply(deltaQuat);
        model.rootNode.rotationQuaternion = model.rotation;

        console.log(`${LOG_PREFIX} Rotated ${instanceId} by ${deltaDeg}°`);
    }

    /**
     * Set rotation of a placed model
     * @param instanceId - Placed model instance ID
     * @param rotationDeg - Absolute rotation in degrees (around Y axis)
     */
    setModelRotation(instanceId: string, rotationDeg: number): void {
        const model = this.placedModels.get(instanceId);
        if (!model) return;

        const rotationRad = rotationDeg * Math.PI / 180;
        model.rotation = Quaternion.FromEulerAngles(0, rotationRad, 0);
        model.rootNode.rotationQuaternion = model.rotation;
    }

    /**
     * Change the scale of a placed model
     * @param instanceId - Placed model instance ID
     * @param scaleFactor - New scale factor
     */
    setModelScale(instanceId: string, scaleFactor: number): void {
        const model = this.placedModels.get(instanceId);
        if (!model) return;

        model.scaleFactor = scaleFactor;
        model.rootNode.scaling = new Vector3(scaleFactor, scaleFactor, scaleFactor);

        console.log(`${LOG_PREFIX} Scaled ${instanceId} to ${scaleFactor.toFixed(4)}`);
    }

    /**
     * Apply a scale preset to a placed model
     * @param instanceId - Placed model instance ID
     * @param presetName - Preset name from library
     */
    applyScalePreset(instanceId: string, presetName: string): void {
        const model = this.placedModels.get(instanceId);
        if (!model) return;

        const entry = this.library.getModel(model.libraryId);
        if (!entry) return;

        const preset = entry.scalePresets.find(p => p.name === presetName);
        if (!preset) return;

        this.setModelScale(instanceId, preset.scaleFactor);
        model.scalePresetName = presetName;
    }

    /**
     * Remove a placed model from the scene
     * @param instanceId - Placed model instance ID
     * @returns True if removed
     */
    removeModel(instanceId: string): boolean {
        const model = this.placedModels.get(instanceId);
        if (!model) return false;

        // Deselect if selected
        if (this.selectedModelId === instanceId) {
            this.deselectModel();
        }

        // Remove highlight
        if (this.highlightLayer) {
            for (const mesh of model.meshes) {
                this.highlightLayer.removeMesh(mesh as Mesh);
            }
        }

        // Dispose meshes and root node
        model.rootNode.dispose();

        // Remove from map
        this.placedModels.delete(instanceId);

        console.log(`${LOG_PREFIX} Removed model: ${instanceId}`);

        return true;
    }

    /**
     * Remove a model from internal tracking WITHOUT disposing scene objects
     * 
     * Used when the WorldOutliner has already disposed the meshes and we just
     * need to clean up our internal Map tracking.
     * 
     * @param instanceId - Placed model instance ID
     * @returns True if removed from tracking
     */
    removeModelFromTracking(instanceId: string): boolean {
        const model = this.placedModels.get(instanceId);
        if (!model) {
            console.log(`${LOG_PREFIX} Model not found in tracking: ${instanceId}`);
            return false;
        }

        // Deselect if selected
        if (this.selectedModelId === instanceId) {
            this.selectedModelId = null;
        }

        // Remove from hovered if applicable
        if (this.hoveredModelId === instanceId) {
            this.hoveredModelId = null;
        }

        // Just remove from map - don't dispose (already done by outliner)
        this.placedModels.delete(instanceId);

        console.log(`${LOG_PREFIX} Removed model from tracking (disposed externally): ${instanceId}`);

        return true;
    }

    // ========================================================================
    // SELECTION
    // ========================================================================

    /**
     * Select a placed model
     * @param instanceId - Placed model instance ID
     */
    selectModel(instanceId: string): void {
        // Deselect current
        if (this.selectedModelId && this.selectedModelId !== instanceId) {
            this.deselectModel();
        }

        const model = this.placedModels.get(instanceId);
        if (!model) return;

        model.isSelected = true;
        this.selectedModelId = instanceId;

        // Add highlight
        if (this.highlightLayer) {
            for (const mesh of model.meshes) {
                if (mesh instanceof Mesh) {
                    this.highlightLayer.addMesh(mesh, SELECTION_COLOR);
                }
            }
        }

        console.log(`${LOG_PREFIX} Selected: ${instanceId}`);
    }

    /**
     * Deselect the currently selected model
     */
    deselectModel(): void {
        if (!this.selectedModelId) return;

        const model = this.placedModels.get(this.selectedModelId);
        if (model) {
            model.isSelected = false;

            // Remove highlight
            if (this.highlightLayer) {
                for (const mesh of model.meshes) {
                    if (mesh instanceof Mesh) {
                        this.highlightLayer.removeMesh(mesh);
                    }
                }
            }
        }

        console.log(`${LOG_PREFIX} Deselected: ${this.selectedModelId}`);
        this.selectedModelId = null;
    }

    /**
     * Get the currently selected model
     * @returns Selected model or null
     */
    getSelectedModel(): PlacedModel | null {
        if (!this.selectedModelId) return null;
        return this.placedModels.get(this.selectedModelId) || null;
    }

    /**
     * Handle hover on a model
     * @param instanceId - Model instance ID or null to clear
     */
    setHoveredModel(instanceId: string | null): void {
        // Clear previous hover
        if (this.hoveredModelId && this.hoveredModelId !== instanceId) {
            const prevModel = this.placedModels.get(this.hoveredModelId);
            if (prevModel && !prevModel.isSelected && this.highlightLayer) {
                for (const mesh of prevModel.meshes) {
                    if (mesh instanceof Mesh) {
                        this.highlightLayer.removeMesh(mesh);
                    }
                }
            }
        }

        this.hoveredModelId = instanceId;

        // Add hover highlight
        if (instanceId) {
            const model = this.placedModels.get(instanceId);
            if (model && !model.isSelected && this.highlightLayer) {
                for (const mesh of model.meshes) {
                    if (mesh instanceof Mesh) {
                        this.highlightLayer.addMesh(mesh, HOVER_COLOR);
                    }
                }
            }
        }
    }

    // ========================================================================
    // QUERIES
    // ========================================================================

    /**
     * Get a placed model by instance ID
     * @param instanceId - Instance ID
     * @returns Placed model or undefined
     */
    getPlacedModel(instanceId: string): PlacedModel | undefined {
        return this.placedModels.get(instanceId);
    }

    /**
     * Get all placed models
     * @returns Array of placed models
     */
    getAllPlacedModels(): PlacedModel[] {
        return Array.from(this.placedModels.values());
    }

    /**
     * Get placed models by library ID
     * @param libraryId - Library entry ID
     * @returns Array of placed instances
     */
    getPlacedModelsByLibraryId(libraryId: string): PlacedModel[] {
        return this.getAllPlacedModels().filter(m => m.libraryId === libraryId);
    }

    /**
     * Find placed model ID from a mesh
     * @param mesh - Mesh to check
     * @returns Instance ID or null
     */
    getPlacedModelIdFromMesh(mesh: AbstractMesh): string | null {
        if (mesh.metadata && mesh.metadata.placedModelId) {
            return mesh.metadata.placedModelId;
        }
        return null;
    }

    /**
     * Get count of placed models
     * @returns Number of placed models
     */
    getPlacedModelCount(): number {
        return this.placedModels.size;
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Remove all placed models
     */
    clearAllModels(): void {
        const ids = Array.from(this.placedModels.keys());
        for (const id of ids) {
            this.removeModel(id);
        }
        console.log(`${LOG_PREFIX} Cleared all models`);
    }

    /**
     * Dispose the model system
     */
    dispose(): void {
        this.clearAllModels();

        if (this.highlightLayer) {
            this.highlightLayer.dispose();
            this.highlightLayer = null;
        }

        this.modelCache.clear();

        console.log(`${LOG_PREFIX} Disposed`);
    }
}