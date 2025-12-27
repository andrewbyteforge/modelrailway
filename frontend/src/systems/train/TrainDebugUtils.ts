/**
 * TrainDebugUtils.ts - Console utilities for debugging train model positioning
 * 
 * Path: frontend/src/systems/train/TrainDebugUtils.ts
 * 
 * Provides easy-to-use functions that can be called from the browser
 * console to diagnose and fix train positioning issues.
 * 
 * Usage from browser console:
 *   window.trainDebug.diagnose('loco_001')
 *   window.trainDebug.raiseModel('loco_001', 2)  // Raise by 2mm
 *   window.trainDebug.scaleModel('loco_001', 1.1) // Scale up 10%
 * 
 * @module TrainDebugUtils
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TrainModelLoader, TRACK_GEOMETRY } from './TrainModelLoader';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Debug utilities interface exposed to window
 */
export interface TrainDebugAPI {
    /** Diagnose a specific model's positioning */
    diagnose: (modelId: string) => void;

    /** Raise or lower a model by specified millimeters */
    raiseModel: (modelId: string, millimeters: number) => void;

    /** Scale a model by multiplier */
    scaleModel: (modelId: string, multiplier: number) => void;

    /** Show rail height reference line */
    showRailHeightGuide: () => void;

    /** Hide rail height reference line */
    hideRailHeightGuide: () => void;

    /** Print track geometry constants */
    printTrackGeometry: () => void;

    /** List all loaded train models */
    listModels: () => void;
}

// ============================================================================
// DEBUG UTILITIES CLASS
// ============================================================================

/**
 * TrainDebugUtils - Debugging utilities for train models
 * 
 * Exposes helpful functions to window.trainDebug for console access.
 */
export class TrainDebugUtils {
    // ========================================================================
    // PROPERTIES
    // ========================================================================

    private readonly scene: Scene;
    private readonly loader: TrainModelLoader;
    private railHeightGuide: AbstractMesh | null = null;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create debug utilities and expose to window
     * @param scene - The Babylon.js scene
     * @param loader - The TrainModelLoader instance
     */
    constructor(scene: Scene, loader: TrainModelLoader) {
        this.scene = scene;
        this.loader = loader;

        // Expose API to window for console access
        this.exposeToWindow();

        console.log('[TrainDebugUtils] Ready! Use window.trainDebug for commands.');
        console.log('[TrainDebugUtils] Try: trainDebug.printTrackGeometry()');
    }

    // ========================================================================
    // PRIVATE METHODS
    // ========================================================================

    /**
     * Expose debug API to window object
     */
    private exposeToWindow(): void {
        const api: TrainDebugAPI = {
            diagnose: this.diagnose.bind(this),
            raiseModel: this.raiseModel.bind(this),
            scaleModel: this.scaleModel.bind(this),
            showRailHeightGuide: this.showRailHeightGuide.bind(this),
            hideRailHeightGuide: this.hideRailHeightGuide.bind(this),
            printTrackGeometry: this.printTrackGeometry.bind(this),
            listModels: this.listModels.bind(this)
        };

        (window as any).trainDebug = api;
    }

    // ========================================================================
    // PUBLIC METHODS - Exposed to Console
    // ========================================================================

    /**
     * Diagnose a model's positioning
     * @param modelId - ID of the model to diagnose
     */
    diagnose(modelId: string): void {
        const model = this.loader.getModel(modelId);

        if (!model) {
            console.error(`Model not found: ${modelId}`);
            console.log('Available models:');
            this.listModels();
            return;
        }

        const railTop = TRACK_GEOMETRY.RAIL_TOP_HEIGHT;
        const currentY = model.rootNode.position.y;
        const bottomY = currentY - (model.bounds.height / 2); // Approximate bottom

        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║               TRAIN MODEL DIAGNOSTIC REPORT                  ║');
        console.log('╠══════════════════════════════════════════════════════════════╣');
        console.log(`║ Model ID:     ${modelId}`);
        console.log(`║ Model Name:   ${model.config.name || 'N/A'}`);
        console.log('╠══════════════════════════════════════════════════════════════╣');
        console.log('║ POSITIONING                                                  ║');
        console.log(`║   Rail top height:    ${(railTop * 1000).toFixed(2)}mm (${railTop.toFixed(5)}m)`);
        console.log(`║   Model Y position:   ${(currentY * 1000).toFixed(2)}mm (${currentY.toFixed(5)}m)`);
        console.log(`║   Applied Y offset:   ${(model.appliedYOffset * 1000).toFixed(2)}mm`);
        console.log('╠══════════════════════════════════════════════════════════════╣');
        console.log('║ SCALING                                                      ║');
        console.log(`║   Applied scale:      ${model.appliedScale.toFixed(4)}`);
        console.log(`║   Scale preset:       ${model.config.scalePreset || 'OO_GAUGE'}`);
        console.log(`║   Scale multiplier:   ${model.config.scaleMultiplier || 1.0}`);
        console.log('╠══════════════════════════════════════════════════════════════╣');
        console.log('║ DIMENSIONS (after scaling)                                   ║');
        console.log(`║   Width (X):          ${(model.bounds.width * 1000).toFixed(1)}mm`);
        console.log(`║   Height (Y):         ${(model.bounds.height * 1000).toFixed(1)}mm`);
        console.log(`║   Length (Z):         ${(model.bounds.length * 1000).toFixed(1)}mm`);
        console.log('╠══════════════════════════════════════════════════════════════╣');
        console.log('║ DIAGNOSIS                                                    ║');

        const yDiff = currentY - railTop;
        if (Math.abs(yDiff) < 0.0005) {
            console.log('║   ✓ Model appears to be positioned correctly on rails       ║');
        } else if (yDiff < 0) {
            console.log(`║   ⚠ Model may be ${(-yDiff * 1000).toFixed(1)}mm TOO LOW                          ║`);
            console.log(`║   → Try: trainDebug.raiseModel('${modelId}', ${(-yDiff * 1000).toFixed(1)})`);
        } else {
            console.log(`║   ⚠ Model may be ${(yDiff * 1000).toFixed(1)}mm TOO HIGH                         ║`);
            console.log(`║   → Try: trainDebug.raiseModel('${modelId}', ${(-yDiff * 1000).toFixed(1)})`);
        }

        console.log('╚══════════════════════════════════════════════════════════════╝');
    }

    /**
     * Raise or lower a model
     * @param modelId - ID of the model
     * @param millimeters - Amount in mm (positive = up, negative = down)
     */
    raiseModel(modelId: string, millimeters: number): void {
        const meters = millimeters / 1000;
        const success = this.loader.adjustYPosition(modelId, meters);

        if (success) {
            const model = this.loader.getModel(modelId);
            console.log(`✓ Moved model ${millimeters >= 0 ? 'up' : 'down'} by ${Math.abs(millimeters)}mm`);
            console.log(`  New Y position: ${(model!.rootNode.position.y * 1000).toFixed(2)}mm`);
        } else {
            console.error(`Failed to adjust model: ${modelId}`);
        }
    }

    /**
     * Scale a model
     * @param modelId - ID of the model
     * @param multiplier - Scale multiplier (1.0 = no change, 1.1 = 10% larger)
     */
    scaleModel(modelId: string, multiplier: number): void {
        const success = this.loader.adjustScale(modelId, multiplier);

        if (success) {
            const model = this.loader.getModel(modelId);
            console.log(`✓ Applied scale multiplier: ${multiplier}`);
            console.log(`  New scale: ${model!.appliedScale.toFixed(4)}`);
            console.log(`  New Y position: ${(model!.rootNode.position.y * 1000).toFixed(2)}mm`);
        } else {
            console.error(`Failed to scale model: ${modelId}`);
        }
    }

    /**
     * Show a visual reference line at rail height
     */
    showRailHeightGuide(): void {
        if (this.railHeightGuide) {
            this.railHeightGuide.isVisible = true;
            console.log('Rail height guide shown');
            return;
        }

        const railTop = TRACK_GEOMETRY.RAIL_TOP_HEIGHT;

        // Create a thin plane at rail height
        this.railHeightGuide = MeshBuilder.CreateGround('railHeightGuide', {
            width: 1,
            height: 1
        }, this.scene);

        this.railHeightGuide.position.y = railTop;

        // Semi-transparent red material
        const material = new StandardMaterial('railHeightGuideMat', this.scene);
        material.diffuseColor = new Color3(1, 0, 0);
        material.alpha = 0.3;
        material.backFaceCulling = false;
        this.railHeightGuide.material = material;

        console.log(`✓ Rail height guide shown at Y = ${(railTop * 1000).toFixed(2)}mm`);
        console.log('  (Red transparent plane = rail top surface)');
    }

    /**
     * Hide the rail height guide
     */
    hideRailHeightGuide(): void {
        if (this.railHeightGuide) {
            this.railHeightGuide.isVisible = false;
            console.log('Rail height guide hidden');
        }
    }

    /**
     * Print track geometry constants
     */
    printTrackGeometry(): void {
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║               TRACK GEOMETRY CONSTANTS                       ║');
        console.log('╠══════════════════════════════════════════════════════════════╣');
        console.log(`║ Ballast height:       ${(TRACK_GEOMETRY.BALLAST_HEIGHT * 1000).toFixed(1)}mm`);
        console.log(`║ Sleeper height:       ${(TRACK_GEOMETRY.SLEEPER_HEIGHT * 1000).toFixed(1)}mm`);
        console.log(`║ Rail height:          ${(TRACK_GEOMETRY.RAIL_HEIGHT * 1000).toFixed(1)}mm`);
        console.log('╠══════════════════════════════════════════════════════════════╣');
        console.log(`║ RAIL TOP (wheel contact): ${(TRACK_GEOMETRY.RAIL_TOP_HEIGHT * 1000).toFixed(1)}mm (${TRACK_GEOMETRY.RAIL_TOP_HEIGHT.toFixed(4)}m)`);
        console.log('╠══════════════════════════════════════════════════════════════╣');
        console.log(`║ Track gauge:          ${(TRACK_GEOMETRY.GAUGE * 1000).toFixed(1)}mm (OO gauge standard)`);
        console.log('╚══════════════════════════════════════════════════════════════╝');
    }

    /**
     * List all loaded train models
     */
    listModels(): void {
        console.log('Loaded train models:');

        // Get all train transform nodes
        const trainNodes = this.scene.transformNodes.filter(
            node => node.id && node.name.startsWith('train_')
        );

        if (trainNodes.length === 0) {
            console.log('  (no models loaded)');
            return;
        }

        for (const node of trainNodes) {
            const model = this.loader.getModel(node.id);
            if (model) {
                console.log(`  - ${node.id}: ${model.config.name || 'unnamed'}`);
                console.log(`      Y: ${(node.position.y * 1000).toFixed(1)}mm, Scale: ${model.appliedScale.toFixed(3)}`);
            } else {
                console.log(`  - ${node.id}: (not in loader cache)`);
            }
        }
    }

    /**
     * Dispose of debug utilities
     */
    dispose(): void {
        if (this.railHeightGuide) {
            this.railHeightGuide.dispose();
            this.railHeightGuide = null;
        }

        delete (window as any).trainDebug;
        console.log('[TrainDebugUtils] Disposed');
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { TrainDebugUtils };