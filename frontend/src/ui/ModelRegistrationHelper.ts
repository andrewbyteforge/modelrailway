/**
 * ModelRegistrationHelper.ts - Handles model registration with various systems
 * 
 * Path: frontend/src/ui/ModelRegistrationHelper.ts
 * 
 * This module manages registration of placed models with:
 * - ScaleManager for scaling operations
 * - TrainSystem for driving controls (rolling stock only)
 * - WorldOutliner for hierarchy display
 * 
 * Also handles:
 * - Automatic gauge scaling for rolling stock
 * - Model height offset management
 * - Model deletion with cleanup
 * - Scale notification display
 * 
 * @module ModelRegistrationHelper
 * @author Model Railway Workbench
 * @version 1.0.0
 */

// ============================================================================
// IMPORTS
// ============================================================================

import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { PlacedModel } from '../systems/models/ModelSystem';
import type { ModelSystem } from '../systems/models/ModelSystem';
import type { ModelLibraryEntry, ModelCategory } from '../systems/models/ModelLibrary';
import type { ScaleManager } from '../systems/scaling/ScaleManager';
import { ScalableModelAdapter } from '../systems/scaling/ScalableModelAdapter';
import type { SidebarScaleControls } from './components/SidebarScaleControls';
import type { WorldOutliner } from '../systems/outliner/WorldOutliner';
import type { OutlinerNodeType } from '../types/outliner.types';
import type { ScalableAssetCategory } from '../types/scaling.types';
import {
    GaugeScaleCalculator,
    getGlobalGaugeCalculator
} from '../systems/scaling/GaugeScaleCalculator';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix for this module */
const LOG_PREFIX = '[ModelRegistrationHelper]';

/** 
 * Surface heights for consistent model placement
 * These match the BaseboardSystem constants
 */
const SURFACE_HEIGHTS = {
    /** Top surface of baseboard */
    BASEBOARD_TOP: 0.95,
    /** Rail top height (above baseboard) */
    RAIL_TOP: 0.97
} as const;

/** Map ModelCategory to ScalableAssetCategory */
const CATEGORY_MAP: Record<string, ScalableAssetCategory> = {
    'locomotive': 'rolling-stock',
    'coach': 'rolling-stock',
    'wagon': 'rolling-stock',
    'rolling_stock': 'rolling-stock',
    'building': 'building',
    'scenery': 'scenery',
    'figure': 'figure',
    'vehicle': 'vehicle',
    'accessory': 'accessory',
    'other': 'other'
};

/** Categories that are considered rolling stock */
const ROLLING_STOCK_CATEGORIES = [
    'rolling_stock',
    'locomotive',
    'coach',
    'wagon',
    'carriage',
    'multiple_unit',
    'dmu',
    'emu'
];

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Configuration for the ModelRegistrationHelper
 */
export interface ModelRegistrationHelperConfig {
    /** Babylon.js scene reference */
    scene: Scene;

    /** Model system for model operations */
    modelSystem: ModelSystem;

    /** Scale manager for scaling operations */
    scaleManager: ScaleManager | null;

    /** Sidebar scale controls for UI updates */
    sidebarScaleControls: SidebarScaleControls | null;

    /** World outliner for hierarchy display */
    worldOutliner: WorldOutliner | null;
}

/**
 * Result of model registration
 */
export interface RegistrationResult {
    /** Whether registration was successful */
    success: boolean;

    /** Error message if failed */
    error?: string;
}

// ============================================================================
// MODEL REGISTRATION HELPER CLASS
// ============================================================================

/**
 * ModelRegistrationHelper - Manages model registration with various systems
 * 
 * @example
 * ```typescript
 * const helper = new ModelRegistrationHelper({
 *     scene,
 *     modelSystem,
 *     scaleManager,
 *     sidebarScaleControls,
 *     worldOutliner
 * });
 * 
 * helper.registerModel(placedModel, libraryEntry);
 * ```
 */
export class ModelRegistrationHelper {
    // ========================================================================
    // CORE PROPERTIES
    // ========================================================================

    /** Configuration object */
    private config: ModelRegistrationHelperConfig;

    /** Map of model IDs to their scalable adapters */
    private scalableAdapters: Map<string, ScalableModelAdapter> = new Map();

    /** Height offsets for each model (for lifting above baseboard) */
    private modelHeightOffsets: Map<string, number> = new Map();

    /** Gauge calculator for automatic rolling stock scaling */
    private gaugeCalculator: GaugeScaleCalculator;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new ModelRegistrationHelper
     * @param config - Configuration options
     */
    constructor(config: ModelRegistrationHelperConfig) {
        if (!config.scene) {
            throw new Error(`${LOG_PREFIX} Scene is required`);
        }
        if (!config.modelSystem) {
            throw new Error(`${LOG_PREFIX} ModelSystem is required`);
        }

        this.config = config;
        this.gaugeCalculator = getGlobalGaugeCalculator();

        console.log(`${LOG_PREFIX} Created`);
    }

    // ========================================================================
    // MODEL REGISTRATION
    // ========================================================================

    /**
     * Register a placed model with all systems
     * 
     * @param placedModel - The placed model from ModelSystem
     * @param entry - Library entry with model metadata
     */
    registerModel(placedModel: PlacedModel, entry: ModelLibraryEntry): void {
        try {
            console.log(`${LOG_PREFIX} Registering model: ${entry.name}`);

            // ----------------------------------------------------------------
            // Register with scaling system
            // ----------------------------------------------------------------
            this.registerModelForScaling(placedModel, entry.category);

            // ----------------------------------------------------------------
            // Register with WorldOutliner
            // ----------------------------------------------------------------
            this.registerModelWithOutliner(placedModel, entry);

            // ----------------------------------------------------------------
            // Register with TrainSystem (rolling stock only)
            // ----------------------------------------------------------------
            this.registerWithTrainSystem(placedModel, entry);

            console.log(`${LOG_PREFIX} ✓ Model registration complete: ${entry.name}`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Model registration failed:`, error);
        }
    }

    // ========================================================================
    // SCALING SYSTEM REGISTRATION
    // ========================================================================

    /**
     * Register a placed model with the scaling system
     * Creates a ScalableModelAdapter and registers with ScaleManager
     * 
     * For rolling stock, automatically calculates and applies gauge-correct scaling
     * 
     * @param placedModel - The placed model from ModelSystem
     * @param category - Model category for scale constraints
     */
    registerModelForScaling(placedModel: PlacedModel, category: string): void {
        try {
            if (!this.config.scaleManager) {
                console.warn(`${LOG_PREFIX} ScaleManager not available for scaling registration`);
                return;
            }

            // Map category to scalable asset category
            const assetCategory = CATEGORY_MAP[category] || 'other';

            // Create adapter for the model with correct constructor parameters
            const adapter = new ScalableModelAdapter(
                placedModel,
                category as ModelCategory
            );

            // Store adapter reference
            this.scalableAdapters.set(placedModel.id, adapter);

            // Calculate bounding radius from meshes for gizmo sizing
            const boundingRadius = this.calculateBoundingRadius(placedModel.meshes);

            // Register with scale manager
            this.config.scaleManager.registerScalable(
                adapter,
                placedModel.rootNode,
                placedModel.meshes,
                boundingRadius
            );

            console.log(`${LOG_PREFIX} ✓ Registered for scaling: ${placedModel.id} (${assetCategory}, radius: ${boundingRadius.toFixed(2)})`);

            // ================================================================
            // AUTO GAUGE SCALING FOR ROLLING STOCK
            // ================================================================
            const isRollingStock = this.isRollingStockCategory(category);

            if (isRollingStock) {
                this.applyAutoGaugeScale(placedModel, adapter);
            }

        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to register for scaling:`, error);
        }
    }

    /**
     * Check if a category is rolling stock (needs gauge scaling)
     * 
     * @param category - Model category string
     * @returns True if this is rolling stock
     */
    private isRollingStockCategory(category: string): boolean {
        return ROLLING_STOCK_CATEGORIES.includes(category.toLowerCase());
    }

    /**
     * Apply automatic gauge-based scaling to rolling stock
     * 
     * Analyzes the model geometry and calculates the correct scale factor
     * to make it fit OO gauge track properly.
     * 
     * @param placedModel - The placed model
     * @param adapter - The scalable adapter for the model
     */
    private applyAutoGaugeScale(placedModel: PlacedModel, adapter: ScalableModelAdapter): void {
        try {
            console.log(`${LOG_PREFIX} 🚂 Auto gauge scaling for: ${placedModel.id}`);

            // Analyze the model and calculate correct scale
            const analysis = this.gaugeCalculator.analyzeAndCalculateScale(
                placedModel.meshes,
                placedModel.rootNode
            );

            if (!analysis.success) {
                console.warn(`${LOG_PREFIX} Gauge analysis failed: ${analysis.explanation}`);
                console.warn(`${LOG_PREFIX} Using default scale (1.0)`);
                return;
            }

            // Log the analysis results
            console.log(`${LOG_PREFIX} Gauge Analysis Results:`);
            console.log(`${LOG_PREFIX}   Measured width: ${(analysis.measuredWidthM * 1000).toFixed(2)}mm`);
            console.log(`${LOG_PREFIX}   Target width: ${(analysis.targetWidthM * 1000).toFixed(2)}mm`);
            console.log(`${LOG_PREFIX}   Scale factor: ${(analysis.scaleFactor * 100).toFixed(1)}% (${analysis.scaleFactor.toFixed(4)})`);
            console.log(`${LOG_PREFIX}   Confidence: ${(analysis.confidence * 100).toFixed(0)}%`);
            console.log(`${LOG_PREFIX}   Type: ${analysis.details.estimatedType}`);

            if (analysis.warnings.length > 0) {
                console.warn(`${LOG_PREFIX}   Warnings:`, analysis.warnings);
            }

            // Apply the calculated scale
            if (this.config.scaleManager && analysis.scaleFactor !== 1.0) {
                const result = this.config.scaleManager.setScale(placedModel.id, analysis.scaleFactor);

                if (result.success) {
                    console.log(`${LOG_PREFIX} ✓ Auto gauge scale applied: ${(analysis.scaleFactor * 100).toFixed(1)}%`);

                    // Show user feedback
                    this.showScaleNotification(
                        placedModel.id,
                        analysis.scaleFactor,
                        analysis.confidence,
                        analysis.details.estimatedType
                    );
                } else {
                    console.error(`${LOG_PREFIX} Failed to apply gauge scale:`, result.error);
                }
            }

        } catch (error) {
            console.error(`${LOG_PREFIX} Error in auto gauge scaling:`, error);
        }
    }

    /**
     * Calculate bounding radius from an array of meshes
     * Used for scale gizmo sizing
     * 
     * @param meshes - Array of meshes to calculate bounds from
     * @returns Bounding radius (half of largest dimension)
     */
    private calculateBoundingRadius(meshes: AbstractMesh[]): number {
        if (!meshes || meshes.length === 0) {
            return 1.0; // Default fallback
        }

        try {
            let minX = Infinity, minY = Infinity, minZ = Infinity;
            let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

            for (const mesh of meshes) {
                if (mesh.getBoundingInfo) {
                    const bounds = mesh.getBoundingInfo().boundingBox;
                    minX = Math.min(minX, bounds.minimumWorld.x);
                    minY = Math.min(minY, bounds.minimumWorld.y);
                    minZ = Math.min(minZ, bounds.minimumWorld.z);
                    maxX = Math.max(maxX, bounds.maximumWorld.x);
                    maxY = Math.max(maxY, bounds.maximumWorld.y);
                    maxZ = Math.max(maxZ, bounds.maximumWorld.z);
                }
            }

            // Calculate dimensions
            const width = maxX - minX;
            const height = maxY - minY;
            const depth = maxZ - minZ;

            // Return half of the largest dimension as radius
            const maxDimension = Math.max(width, height, depth);
            return Math.max(maxDimension / 2, 0.1); // Minimum 0.1

        } catch (error) {
            console.warn(`${LOG_PREFIX} Error calculating bounding radius:`, error);
            return 1.0; // Fallback
        }
    }

    // ========================================================================
    // WORLD OUTLINER REGISTRATION
    // ========================================================================

    /**
     * Register a placed model with the WorldOutliner
     * Creates an outliner node for the model in the appropriate category folder
     * 
     * @param placedModel - The placed model from ModelSystem
     * @param entry - Library entry with model metadata
     */
    registerModelWithOutliner(placedModel: PlacedModel, entry: ModelLibraryEntry): void {
        try {
            if (!this.config.worldOutliner) {
                console.warn(`${LOG_PREFIX} WorldOutliner not available for registration`);
                return;
            }

            // Determine outliner node type based on category
            let nodeType: OutlinerNodeType = 'model';
            if (entry.category === 'rolling_stock') {
                nodeType = 'rolling_stock';
            } else if (['scenery', 'buildings', 'vegetation', 'infrastructure'].includes(entry.category)) {
                nodeType = 'scenery';
            }

            // Create outliner node
            this.config.worldOutliner.createItem(
                entry.name,
                nodeType,
                placedModel.id,  // Scene object ID for bidirectional sync
                {
                    libraryId: entry.id,
                    category: entry.category
                }
            );

            console.log(`${LOG_PREFIX} ✓ Registered with outliner: ${entry.name} (${nodeType})`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to register with outliner:`, error);
        }
    }

    // ========================================================================
    // TRAIN SYSTEM REGISTRATION
    // ========================================================================

    /**
     * Register a placed rolling stock model with the TrainSystem
     * This enables driving controls (throttle, direction, brake, horn)
     * 
     * @param placedModel - The placed model instance
     * @param entry - Library entry with model info
     */
    registerWithTrainSystem(placedModel: PlacedModel, entry: ModelLibraryEntry): void {
        // Only register rolling stock
        if (entry.category !== 'rolling_stock') {
            return;
        }

        // Use a small delay to ensure the model is fully in the scene
        setTimeout(() => {
            try {
                // Get the global trainSystem reference (set by App.ts)
                const trainSystem = (window as any).trainSystem;

                if (!trainSystem) {
                    console.warn(`${LOG_PREFIX} TrainSystem not available - train won't be driveable`);
                    console.warn(`${LOG_PREFIX}   Tip: Use Shift+T to manually register trains`);
                    return;
                }

                console.log(`${LOG_PREFIX} 🚂 Registering with TrainSystem...`);

                // ============================================================
                // IMPORTANT: Use addTrain() instead of registerExistingModel()
                // registerExistingModel() would reposition the train, overwriting
                // the rotation we carefully calculated from the track direction.
                // addTrain() just registers for driving controls without moving.
                // ============================================================
                const controller = trainSystem.addTrain(
                    placedModel.rootNode,
                    {
                        name: entry.name,
                        category: 'locomotive'
                    }
                );

                if (controller) {
                    console.log(`${LOG_PREFIX} ✓ Registered as driveable train`);
                    console.log(`${LOG_PREFIX}   Click to select, use Arrow keys/WASD to drive`);
                } else {
                    console.warn(`${LOG_PREFIX} TrainSystem returned no controller`);
                    console.log(`${LOG_PREFIX}   Tip: Use Shift+T to manually register trains`);
                }

            } catch (error) {
                console.warn(`${LOG_PREFIX} Train registration failed:`, error);
                console.log(`${LOG_PREFIX}   Tip: Use Shift+T to manually register trains`);
            }
        }, 100);
    }

    // ========================================================================
    // MODEL HEIGHT OFFSET
    // ========================================================================

    /**
     * Get the height offset for a model
     * @param modelId - Model ID
     * @returns Height offset in mm
     */
    getModelHeightOffset(modelId: string): number {
        return this.modelHeightOffsets.get(modelId) || 0;
    }

    /**
     * Set the height offset for a model
     * @param modelId - Model ID
     * @param heightOffset - Height offset in mm
     */
    setModelHeightOffset(modelId: string, heightOffset: number): void {
        this.modelHeightOffsets.set(modelId, heightOffset);

        // Apply to the model
        const model = this.config.modelSystem.getPlacedModel(modelId);
        if (model) {
            const baseY = SURFACE_HEIGHTS.BASEBOARD_TOP;
            const newY = baseY + (heightOffset / 1000); // Convert mm to meters
            this.config.modelSystem.moveModel(
                modelId,
                new Vector3(model.position.x, newY, model.position.z)
            );
        }
    }

    // ========================================================================
    // MODEL DELETION
    // ========================================================================

    /**
     * Delete a model and clean up all associated resources
     * @param modelId - ID of model to delete
     */
    deleteModel(modelId: string): void {
        console.log(`${LOG_PREFIX} Deleting model: ${modelId}`);

        // ----------------------------------------------------------------
        // Remove from ScaleManager
        // ----------------------------------------------------------------
        if (this.config.scaleManager) {
            this.config.scaleManager.deselectObject();
            this.config.scaleManager.unregisterObject(modelId);
        }

        // ----------------------------------------------------------------
        // Remove adapter
        // ----------------------------------------------------------------
        this.scalableAdapters.delete(modelId);

        // ----------------------------------------------------------------
        // Remove height offset
        // ----------------------------------------------------------------
        this.modelHeightOffsets.delete(modelId);

        // ----------------------------------------------------------------
        // Remove from outliner
        // ----------------------------------------------------------------
        if (this.config.worldOutliner) {
            this.config.worldOutliner.removeNode(modelId);
        }

        // ----------------------------------------------------------------
        // Remove from model system
        // ----------------------------------------------------------------
        this.config.modelSystem.removeModel(modelId);

        // ----------------------------------------------------------------
        // Notify SidebarScaleControls
        // ----------------------------------------------------------------
        this.config.sidebarScaleControls?.onObjectDeselected();

        console.log(`${LOG_PREFIX} ✓ Model deleted: ${modelId}`);
    }

    // ========================================================================
    // SCALE NOTIFICATION
    // ========================================================================

    /**
     * Show a brief notification about the auto-applied scale
     * 
     * @param modelId - ID of the scaled model
     * @param scaleFactor - Applied scale factor
     * @param confidence - Confidence of the calculation
     * @param modelType - Detected model type
     */
    private showScaleNotification(
        modelId: string,
        scaleFactor: number,
        confidence: number,
        modelType: string
    ): void {
        try {
            // Create notification element
            const notification = document.createElement('div');
            notification.id = 'gaugeScaleNotification';
            notification.style.cssText = `
                position: fixed;
                bottom: 80px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 100, 0, 0.9);
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                font-family: 'Segoe UI', Arial, sans-serif;
                font-size: 14px;
                z-index: 10000;
                pointer-events: none;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.2);
                transition: opacity 0.3s ease;
            `;

            const scalePercent = (scaleFactor * 100).toFixed(1);
            const confPercent = (confidence * 100).toFixed(0);

            notification.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 20px;">🚂</span>
                    <div>
                        <div style="font-weight: bold;">Auto-scaled to ${scalePercent}%</div>
                        <div style="font-size: 12px; opacity: 0.8;">
                            ${modelType} • ${confPercent}% confidence • Use S+Scroll to adjust
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(notification);

            // Fade out and remove after 4 seconds
            setTimeout(() => {
                notification.style.opacity = '0';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, 4000);

        } catch (error) {
            console.warn(`${LOG_PREFIX} Could not show scale notification:`, error);
        }
    }

    // ========================================================================
    // PUBLIC ACCESSORS
    // ========================================================================

    /**
     * Check if a model has a scalable adapter
     * @param modelId - Model ID
     * @returns True if adapter exists
     */
    hasScalableAdapter(modelId: string): boolean {
        return this.scalableAdapters.has(modelId);
    }

    /**
     * Get scalable adapter info for a model
     * @param modelId - Model ID
     * @returns Adapter info or null
     */
    getScalableAdapterInfo(modelId: string): { currentScale: number; scaleLocked: boolean } | null {
        const adapter = this.scalableAdapters.get(modelId);
        if (!adapter) return null;

        return {
            currentScale: adapter.currentScale,
            scaleLocked: adapter.scaleLocked
        };
    }

    /**
     * Get a scalable adapter by model ID
     * @param modelId - Model ID
     * @returns Scalable adapter or undefined
     */
    getScalableAdapter(modelId: string): ScalableModelAdapter | undefined {
        return this.scalableAdapters.get(modelId);
    }

    /**
     * Update the world outliner reference
     * @param outliner - New world outliner
     */
    setWorldOutliner(outliner: WorldOutliner): void {
        this.config.worldOutliner = outliner;
        console.log(`${LOG_PREFIX} WorldOutliner connected`);
    }

    // ========================================================================
    // DISPOSAL
    // ========================================================================

    /**
     * Clean up all resources
     */
    dispose(): void {
        console.log(`${LOG_PREFIX} Disposing...`);

        // Clear all adapters
        this.scalableAdapters.clear();

        // Clear height offsets
        this.modelHeightOffsets.clear();

        console.log(`${LOG_PREFIX} ✓ Disposed`);
    }
}