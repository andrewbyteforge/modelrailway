/**
 * ScalableModelAdapter.ts - Adapter to make PlacedModel work with scaling system
 * 
 * Path: frontend/src/systems/scaling/ScalableModelAdapter.ts
 * 
 * This adapter wraps the existing PlacedModel type from ModelSystem
 * to implement the IScalable interface required by the scaling system.
 * 
 * This allows seamless integration without modifying the original
 * PlacedModel structure.
 * 
 * @module ScalableModelAdapter
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

import type { PlacedModel } from '../models/ModelSystem';
import type { ModelCategory } from '../models/ModelLibrary';
import type {
    IScalable,
    ScalableAssetCategory,
    ScalePivotPoint
} from '../../types/scaling.types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[ScalableModelAdapter]';

/**
 * Map ModelCategory to ScalableAssetCategory
 */
const CATEGORY_MAP: Record<ModelCategory, ScalableAssetCategory> = {
    'locomotive': 'rolling-stock',
    'coach': 'rolling-stock',
    'wagon': 'rolling-stock',
    'building': 'building',
    'scenery': 'scenery',
    'infrastructure': 'infrastructure',
    'figure': 'scenery',
    'vehicle': 'scenery',
    'other': 'custom'
};

/**
 * Default pivot points per model category
 */
const PIVOT_MAP: Record<ModelCategory, ScalePivotPoint> = {
    'locomotive': 'center',
    'coach': 'center',
    'wagon': 'center',
    'building': 'base-center',
    'scenery': 'base-center',
    'infrastructure': 'base-center',
    'figure': 'base-center',
    'vehicle': 'center',
    'other': 'base-center'
};

// ============================================================================
// SCALABLE MODEL ADAPTER CLASS
// ============================================================================

/**
 * ScalableModelAdapter - Makes PlacedModel implement IScalable
 * 
 * Wraps an existing PlacedModel to provide the IScalable interface
 * without modifying the original class.
 * 
 * @example
 * ```typescript
 * const placed = await modelSystem.placeModel(entry, options);
 * const scalable = new ScalableModelAdapter(placed, 'building');
 * scaleManager.registerScalable(
 *     scalable,
 *     placed.rootNode,
 *     placed.meshes,
 *     scalable.getBoundingRadius()
 * );
 * ```
 */
export class ScalableModelAdapter implements IScalable {
    // ========================================================================
    // PROPERTIES (IScalable interface)
    // ========================================================================

    /** Unique identifier (from PlacedModel) */
    public readonly id: string;

    /** Asset category for scaling behaviour */
    public readonly category: ScalableAssetCategory;

    /** Current scale factor */
    public currentScale: number;

    /** Original scale when first placed */
    public readonly originalScale: number;

    /** Pivot point for scaling */
    public pivotPoint: ScalePivotPoint;

    /** Custom pivot offset (if pivotPoint is 'custom') */
    public customPivotOffset?: { x: number; y: number; z: number };

    /** Whether scaling is locked */
    public scaleLocked: boolean = false;

    // ========================================================================
    // INTERNAL PROPERTIES
    // ========================================================================

    /** Reference to wrapped PlacedModel */
    private placedModel: PlacedModel;

    /** Model category from library */
    private modelCategory: ModelCategory;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new ScalableModelAdapter
     * 
     * @param placedModel - The PlacedModel to wrap
     * @param modelCategory - Category from the model library
     */
    constructor(placedModel: PlacedModel, modelCategory: ModelCategory) {
        this.placedModel = placedModel;
        this.modelCategory = modelCategory;

        // Map to IScalable properties
        this.id = placedModel.id;
        this.category = CATEGORY_MAP[modelCategory] || 'custom';
        this.currentScale = placedModel.scaleFactor;
        this.originalScale = placedModel.scaleFactor;
        this.pivotPoint = PIVOT_MAP[modelCategory] || 'base-center';

        console.log(`${LOG_PREFIX} Created adapter for '${this.id}' (${this.category})`);
    }

    // ========================================================================
    // ACCESSOR METHODS
    // ========================================================================

    /**
     * Get the wrapped PlacedModel
     */
    getPlacedModel(): PlacedModel {
        return this.placedModel;
    }

    /**
     * Get the transform node
     */
    getTransformNode(): TransformNode {
        return this.placedModel.rootNode;
    }

    /**
     * Get all meshes
     */
    getMeshes(): AbstractMesh[] {
        return this.placedModel.meshes;
    }

    /**
     * Get bounding radius
     */
    getBoundingRadius(): number {
        // Use original dimensions to calculate radius
        const dims = this.placedModel.originalDimensions;
        if (dims) {
            const diagonal = Math.sqrt(
                dims.width ** 2 +
                dims.height ** 2 +
                dims.depth ** 2
            );
            return diagonal / 2;
        }

        // Fallback: calculate from meshes
        let maxRadius = 0;
        for (const mesh of this.placedModel.meshes) {
            if (mesh.getBoundingInfo) {
                const sphere = mesh.getBoundingInfo().boundingSphere;
                if (sphere.radius > maxRadius) {
                    maxRadius = sphere.radius;
                }
            }
        }

        return maxRadius || 0.1;
    }

    /**
     * Get current world position
     */
    getPosition(): Vector3 {
        return this.placedModel.position.clone();
    }

    /**
     * Get current dimensions (after scaling)
     */
    getCurrentDimensions(): { width: number; height: number; depth: number } {
        const original = this.placedModel.originalDimensions;
        return {
            width: original.width * this.currentScale,
            height: original.height * this.currentScale,
            depth: original.depth * this.currentScale
        };
    }

    /**
     * Get original dimensions (before scaling)
     */
    getOriginalDimensions(): { width: number; height: number; depth: number } {
        return { ...this.placedModel.originalDimensions };
    }

    // ========================================================================
    // SCALE OPERATIONS
    // ========================================================================

    /**
     * Update the scale factor
     * This also updates the underlying PlacedModel
     * 
     * @param scale - New scale factor
     */
    setScale(scale: number): void {
        this.currentScale = scale;
        // Note: The actual mesh scaling is handled by ScaleManager
        // This just updates the internal state
    }

    /**
     * Reset to original scale
     */
    resetScale(): void {
        this.currentScale = this.originalScale;
    }

    /**
     * Toggle scale lock
     */
    toggleLock(): boolean {
        this.scaleLocked = !this.scaleLocked;
        return this.scaleLocked;
    }

    // ========================================================================
    // PIVOT OPERATIONS
    // ========================================================================

    /**
     * Set the pivot point mode
     * 
     * @param pivot - Pivot point type
     */
    setPivotPoint(pivot: ScalePivotPoint): void {
        this.pivotPoint = pivot;
    }

    /**
     * Set custom pivot offset
     * 
     * @param offset - Offset from object origin
     */
    setCustomPivot(offset: { x: number; y: number; z: number }): void {
        this.pivotPoint = 'custom';
        this.customPivotOffset = offset;
    }

    /**
     * Get pivot position in world space
     */
    getPivotWorldPosition(): Vector3 {
        const position = this.placedModel.position;
        const dims = this.getCurrentDimensions();

        switch (this.pivotPoint) {
            case 'center':
                return position.clone();

            case 'base-center':
                return new Vector3(
                    position.x,
                    position.y - dims.height / 2,
                    position.z
                );

            case 'top-center':
                return new Vector3(
                    position.x,
                    position.y + dims.height / 2,
                    position.z
                );

            case 'custom':
                if (this.customPivotOffset) {
                    return new Vector3(
                        position.x + this.customPivotOffset.x,
                        position.y + this.customPivotOffset.y,
                        position.z + this.customPivotOffset.z
                    );
                }
                return position.clone();

            default:
                return position.clone();
        }
    }

    // ========================================================================
    // SERIALIZATION
    // ========================================================================

    /**
     * Export scale state for saving
     */
    exportScaleState(): ScaleState {
        return {
            id: this.id,
            currentScale: this.currentScale,
            originalScale: this.originalScale,
            pivotPoint: this.pivotPoint,
            customPivotOffset: this.customPivotOffset,
            scaleLocked: this.scaleLocked
        };
    }

    /**
     * Import scale state from saved data
     */
    importScaleState(state: Partial<ScaleState>): void {
        if (state.currentScale !== undefined) {
            this.currentScale = state.currentScale;
        }
        if (state.pivotPoint !== undefined) {
            this.pivotPoint = state.pivotPoint;
        }
        if (state.customPivotOffset !== undefined) {
            this.customPivotOffset = state.customPivotOffset;
        }
        if (state.scaleLocked !== undefined) {
            this.scaleLocked = state.scaleLocked;
        }
    }
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Serializable scale state
 */
export interface ScaleState {
    id: string;
    currentScale: number;
    originalScale: number;
    pivotPoint: ScalePivotPoint;
    customPivotOffset?: { x: number; y: number; z: number };
    scaleLocked: boolean;
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a ScalableModelAdapter from a PlacedModel
 * 
 * @param placedModel - The placed model
 * @param modelCategory - Category from library
 * @returns New adapter instance
 */
export function createScalableAdapter(
    placedModel: PlacedModel,
    modelCategory: ModelCategory
): ScalableModelAdapter {
    return new ScalableModelAdapter(placedModel, modelCategory);
}

/**
 * Create adapters for multiple models
 * 
 * @param models - Array of [PlacedModel, ModelCategory] tuples
 * @returns Array of adapters
 */
export function createScalableAdapters(
    models: Array<[PlacedModel, ModelCategory]>
): ScalableModelAdapter[] {
    return models.map(([model, category]) => createScalableAdapter(model, category));
}