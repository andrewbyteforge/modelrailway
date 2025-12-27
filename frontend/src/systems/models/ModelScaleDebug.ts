/**
 * ModelScaleDebug.ts - Console utilities for debugging and adjusting model scales
 * 
 * Path: frontend/src/systems/models/ModelScaleDebug.ts
 * 
 * Provides console commands for:
 * - Viewing current model scale
 * - Recalculating scale for rolling stock
 * - Manually adjusting scale
 * - Debugging dimension issues
 * 
 * Usage in browser console:
 *   window.modelDebug.fixTrainScale()      // Fix selected train to correct OO scale
 *   window.modelDebug.setScale(0.12)       // Set specific scale factor
 *   window.modelDebug.showInfo()           // Show current model info
 * 
 * @module ModelScaleDebug
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import type { Scene } from '@babylonjs/core/scene';
import type { ModelSystem, PlacedModel } from './ModelSystem';
import { ModelScaleHelper, OO_ROLLING_STOCK_TARGETS, type RollingStockType } from './ModelScaleHelper';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

// ============================================================================
// CONSTANTS
// ============================================================================

const LOG_PREFIX = '[ModelScaleDebug]';

// ============================================================================
// DEBUG INTERFACE
// ============================================================================

/**
 * Console debug interface for model scaling
 */
export interface ModelDebugInterface {
    /** Show info about selected model */
    showInfo: () => void;

    /** Fix train scale to correct OO gauge */
    fixTrainScale: (type?: RollingStockType) => void;

    /** Set a specific scale factor */
    setScale: (scaleFactor: number) => void;

    /** Adjust scale by percentage */
    adjustScale: (percent: number) => void;

    /** Move model to rail height */
    fixHeight: () => void;

    /** Show available commands */
    help: () => void;
}

// ============================================================================
// SETUP FUNCTION
// ============================================================================

/**
 * Setup console debug utilities for model scaling
 * 
 * @param scene - Babylon.js scene
 * @param modelSystem - ModelSystem instance
 */
export function setupModelScaleDebug(
    scene: Scene,
    modelSystem: ModelSystem
): void {
    console.log(`${LOG_PREFIX} Setting up console debug utilities...`);

    // Track geometry constants
    const RAIL_TOP_HEIGHT = 0.008; // 8mm above baseboard

    /**
     * Get the currently selected model
     */
    function getSelectedModel(): PlacedModel | null {
        const model = modelSystem.getSelectedModel();
        if (!model) {
            console.warn(`${LOG_PREFIX} No model selected. Click on a model first.`);
            return null;
        }
        return model;
    }

    /**
     * Show info about selected model
     */
    function showInfo(): void {
        const model = getSelectedModel();
        if (!model) return;

        const dims = model.originalDimensions;
        const scale = model.scaleFactor;

        console.log(`${LOG_PREFIX} ═══════════════════════════════════════`);
        console.log(`${LOG_PREFIX} MODEL INFO: ${model.id}`);
        console.log(`${LOG_PREFIX} ═══════════════════════════════════════`);
        console.log(`${LOG_PREFIX} Library ID: ${model.libraryId}`);
        console.log(`${LOG_PREFIX} Current Scale: ${scale.toFixed(6)}`);
        console.log(`${LOG_PREFIX} Scale Preset: ${model.scalePresetName}`);
        console.log(`${LOG_PREFIX} ───────────────────────────────────────`);
        console.log(`${LOG_PREFIX} Original Dimensions (model units):`);
        console.log(`${LOG_PREFIX}   Width:  ${dims.width.toFixed(4)}m`);
        console.log(`${LOG_PREFIX}   Height: ${dims.height.toFixed(4)}m`);
        console.log(`${LOG_PREFIX}   Depth:  ${dims.depth.toFixed(4)}m`);
        console.log(`${LOG_PREFIX}   Max:    ${dims.maxDimension.toFixed(4)}m`);
        console.log(`${LOG_PREFIX} ───────────────────────────────────────`);
        console.log(`${LOG_PREFIX} Scaled Dimensions (current):`);
        console.log(`${LOG_PREFIX}   Width:  ${(dims.width * scale * 1000).toFixed(1)}mm`);
        console.log(`${LOG_PREFIX}   Height: ${(dims.height * scale * 1000).toFixed(1)}mm`);
        console.log(`${LOG_PREFIX}   Depth:  ${(dims.depth * scale * 1000).toFixed(1)}mm`);
        console.log(`${LOG_PREFIX}   Length: ${(dims.maxDimension * scale * 1000).toFixed(1)}mm`);
        console.log(`${LOG_PREFIX} ───────────────────────────────────────`);
        console.log(`${LOG_PREFIX} Position: (${model.position.x.toFixed(3)}, ${model.position.y.toFixed(3)}, ${model.position.z.toFixed(3)})`);
        console.log(`${LOG_PREFIX} ═══════════════════════════════════════`);

        // Show expected OO scale
        console.log(`${LOG_PREFIX} Expected OO gauge locomotive: 200-280mm`);
        console.log(`${LOG_PREFIX} Expected OO gauge coach: 260-305mm`);
        console.log(`${LOG_PREFIX} Expected OO gauge wagon: 100-150mm`);
    }

    /**
     * Fix train scale to correct OO gauge
     */
    function fixTrainScale(type: RollingStockType = 'locomotive'): void {
        const model = getSelectedModel();
        if (!model) return;

        const dims = model.originalDimensions;
        const targets = OO_ROLLING_STOCK_TARGETS[type];

        if (!targets) {
            console.error(`${LOG_PREFIX} Unknown type: ${type}. Use: locomotive, steam_locomotive, coach, wagon, container`);
            return;
        }

        // Calculate correct scale: target length / model length
        const modelLength = dims.maxDimension;
        const targetLength = targets.lengthM;
        const newScale = targetLength / modelLength;

        console.log(`${LOG_PREFIX} ═══════════════════════════════════════`);
        console.log(`${LOG_PREFIX} FIXING TRAIN SCALE`);
        console.log(`${LOG_PREFIX} ═══════════════════════════════════════`);
        console.log(`${LOG_PREFIX} Type: ${type} (${targets.description})`);
        console.log(`${LOG_PREFIX} Model length: ${modelLength.toFixed(4)}m`);
        console.log(`${LOG_PREFIX} Target length: ${targetLength.toFixed(4)}m (${(targetLength * 1000).toFixed(0)}mm)`);
        console.log(`${LOG_PREFIX} Old scale: ${model.scaleFactor.toFixed(6)}`);
        console.log(`${LOG_PREFIX} New scale: ${newScale.toFixed(6)}`);
        console.log(`${LOG_PREFIX} ───────────────────────────────────────`);

        // Apply new scale
        modelSystem.setModelScale(model.id, newScale);

        // Also fix Y position to sit on rails
        fixHeightInternal(model, newScale);

        // Show result
        const resultLength = modelLength * newScale * 1000;
        console.log(`${LOG_PREFIX} Result length: ${resultLength.toFixed(1)}mm ✓`);
        console.log(`${LOG_PREFIX} ═══════════════════════════════════════`);
    }

    /**
     * Set a specific scale factor
     */
    function setScale(scaleFactor: number): void {
        const model = getSelectedModel();
        if (!model) return;

        if (scaleFactor <= 0 || scaleFactor > 10) {
            console.error(`${LOG_PREFIX} Invalid scale factor: ${scaleFactor}. Use 0.001 to 10.0`);
            return;
        }

        const oldScale = model.scaleFactor;
        modelSystem.setModelScale(model.id, scaleFactor);

        console.log(`${LOG_PREFIX} Scale changed: ${oldScale.toFixed(6)} → ${scaleFactor.toFixed(6)}`);

        const resultLength = model.originalDimensions.maxDimension * scaleFactor * 1000;
        console.log(`${LOG_PREFIX} Result length: ${resultLength.toFixed(1)}mm`);
    }

    /**
     * Adjust scale by percentage
     */
    function adjustScale(percent: number): void {
        const model = getSelectedModel();
        if (!model) return;

        const multiplier = 1 + (percent / 100);
        const newScale = model.scaleFactor * multiplier;

        modelSystem.setModelScale(model.id, newScale);

        console.log(`${LOG_PREFIX} Scale adjusted by ${percent}%: ${model.scaleFactor.toFixed(6)} → ${newScale.toFixed(6)}`);
    }

    /**
     * Fix model height to sit on rails (internal helper)
     */
    function fixHeightInternal(model: PlacedModel, scale: number): void {
        const dims = model.originalDimensions;

        // Calculate scaled min Y (bottom of model)
        const scaledMinY = (dims.center.y - dims.height / 2) * scale;

        // Position so bottom touches rail top
        const newY = RAIL_TOP_HEIGHT - scaledMinY;

        // Update position
        const newPos = model.position.clone();
        newPos.y = newY;
        modelSystem.moveModel(model.id, newPos);

        console.log(`${LOG_PREFIX} Y position adjusted: ${newY.toFixed(4)}m (rail top: ${RAIL_TOP_HEIGHT}m)`);
    }

    /**
     * Fix model height to sit on rails
     */
    function fixHeight(): void {
        const model = getSelectedModel();
        if (!model) return;

        fixHeightInternal(model, model.scaleFactor);
    }

    /**
     * Show help
     */
    function showHelp(): void {
        console.log(`
${LOG_PREFIX} ═══════════════════════════════════════════════════════════
${LOG_PREFIX} MODEL SCALE DEBUG COMMANDS
${LOG_PREFIX} ═══════════════════════════════════════════════════════════

  window.modelDebug.showInfo()
    → Show dimensions and scale of selected model

  window.modelDebug.fixTrainScale()
    → Fix scale to OO locomotive size (230mm)

  window.modelDebug.fixTrainScale('steam_locomotive')
    → Fix to steam loco size (200mm)

  window.modelDebug.fixTrainScale('coach')
    → Fix to coach size (275mm)

  window.modelDebug.fixTrainScale('wagon')
    → Fix to wagon size (120mm)

  window.modelDebug.setScale(0.12)
    → Set specific scale factor

  window.modelDebug.adjustScale(10)
    → Increase scale by 10%

  window.modelDebug.adjustScale(-5)
    → Decrease scale by 5%

  window.modelDebug.fixHeight()
    → Position model on rail top (8mm)

${LOG_PREFIX} ═══════════════════════════════════════════════════════════
        `);
    }

    // Create debug interface
    const debugInterface: ModelDebugInterface = {
        showInfo,
        fixTrainScale,
        setScale,
        adjustScale,
        fixHeight,
        help: showHelp
    };

    // Expose to window
    (window as any).modelDebug = debugInterface;

    console.log(`${LOG_PREFIX} ✓ Debug utilities available at window.modelDebug`);
    console.log(`${LOG_PREFIX}   Type window.modelDebug.help() for commands`);
}

// ============================================================================
// EXPORTS
// ============================================================================

export { setupModelScaleDebug };