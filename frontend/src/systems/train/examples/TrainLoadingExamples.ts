/**
 * TrainModelLoader - Usage Examples
 * 
 * Path: frontend/src/systems/train/examples/TrainLoadingExamples.ts
 * 
 * This file demonstrates how to properly load train models so they
 * sit correctly on the rails (not between them on the sleepers).
 * 
 * PROBLEM: Train sits too low, between the rails on the sleepers
 * SOLUTION: Adjust scale AND/OR Y offset
 * 
 * @module TrainLoadingExamples
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Scene } from '@babylonjs/core/scene';
import { TrainModelLoader, TrainModelConfig, MODEL_SCALE_PRESETS } from '../utilities/TrainModelLoader';

// ============================================================================
// EXAMPLE 1: Model Already at OO Scale (Most Common)
// ============================================================================

/**
 * When your GLB model was created at OO gauge scale (1:76.2),
 * you typically just need to ensure the Y offset is correct.
 * 
 * If the train is slightly too low, increase scaleMultiplier
 * or add a positive yOffsetOverride.
 */
async function loadOOScaleModel(scene: Scene): Promise<void> {
    const loader = new TrainModelLoader(scene);

    // Standard OO scale model - uses automatic positioning
    const loco = await loader.loadModel({
        modelPath: 'assets/models/locomotives/class66.glb',
        id: 'loco_class66_001',
        name: 'Class 66 Diesel',
        // scalePreset defaults to 'OO_GAUGE' (scale = 1.0)
        // modelOrigin defaults to 'bottom-center'
    });

    console.log('Loaded Class 66:', {
        scale: loco.appliedScale,
        yOffset: loco.appliedYOffset,
        height: loco.bounds.height
    });
}

// ============================================================================
// EXAMPLE 2: Model Created at 1:1 Real World Scale
// ============================================================================

/**
 * When your GLB model was created at real-world dimensions
 * (e.g., a 20-meter locomotive), you need to scale it down.
 */
async function loadRealWorldModel(scene: Scene): Promise<void> {
    const loader = new TrainModelLoader(scene);

    const loco = await loader.loadModel({
        modelPath: 'assets/models/locomotives/class66_realscale.glb',
        id: 'loco_class66_002',
        name: 'Class 66 (Real Scale)',
        scalePreset: 'REAL_WORLD',  // Scales down by 1/76.2
    });

    console.log('Loaded real-world scale model:', {
        scale: loco.appliedScale,  // Will be ~0.0131
        yOffset: loco.appliedYOffset
    });
}

// ============================================================================
// EXAMPLE 3: Fine-Tuning a Model That's Slightly Wrong
// ============================================================================

/**
 * SCENARIO: Model loads but sits slightly between the rails
 * 
 * DIAGNOSIS:
 * 1. Check console output for model bounds
 * 2. If height looks correct but Y is wrong -> adjust yOffsetOverride
 * 3. If model looks too small overall -> adjust scaleMultiplier
 */
async function fineTuneModel(scene: Scene): Promise<void> {
    const loader = new TrainModelLoader(scene);

    // First attempt - model sits too low
    const attempt1 = await loader.loadModel({
        modelPath: 'assets/models/locomotives/loco.glb',
        id: 'loco_test_001',
        name: 'Test Loco - Attempt 1'
    });

    console.log('Attempt 1 - Check if too low:', {
        yOffset: attempt1.appliedYOffset,
        bounds: attempt1.bounds
    });

    // If the model is too low, try raising it:

    // OPTION A: Add a Y offset (raise by 2mm)
    const attempt2 = await loader.loadModel({
        modelPath: 'assets/models/locomotives/loco.glb',
        id: 'loco_test_002',
        name: 'Test Loco - With Y Offset',
        yOffsetOverride: 0.002  // Raise by 2mm
    });

    // OPTION B: Increase scale slightly (if model is too small)
    const attempt3 = await loader.loadModel({
        modelPath: 'assets/models/locomotives/loco.glb',
        id: 'loco_test_003',
        name: 'Test Loco - Scaled Up',
        scaleMultiplier: 1.1  // 10% larger
    });

    // OPTION C: Both adjustments together
    const attempt4 = await loader.loadModel({
        modelPath: 'assets/models/locomotives/loco.glb',
        id: 'loco_test_004',
        name: 'Test Loco - Combined Adjustment',
        scaleMultiplier: 1.05,    // 5% larger
        yOffsetOverride: 0.001    // Raise by 1mm
    });
}

// ============================================================================
// EXAMPLE 4: Model with Origin at Geometric Center
// ============================================================================

/**
 * Some 3D modeling software exports with the origin at the
 * geometric center of the model, not at the bottom.
 * 
 * This is common with:
 * - Blender (depending on export settings)
 * - SketchUp models
 * - Some free model downloads
 */
async function loadCenteredOriginModel(scene: Scene): Promise<void> {
    const loader = new TrainModelLoader(scene);

    const loco = await loader.loadModel({
        modelPath: 'assets/models/external/blender_loco.glb',
        id: 'loco_blender_001',
        name: 'Blender Loco',
        modelOrigin: 'geometric-center'  // Origin is at center, not bottom
    });

    console.log('Centered origin model:', {
        yOffset: loco.appliedYOffset
    });
}

// ============================================================================
// EXAMPLE 5: Converting from HO Scale (1:87)
// ============================================================================

/**
 * HO scale models (1:87) are slightly smaller than OO (1:76.2).
 * Use the HO_SCALE preset to upscale them correctly.
 */
async function loadHOScaleModel(scene: Scene): Promise<void> {
    const loader = new TrainModelLoader(scene);

    const loco = await loader.loadModel({
        modelPath: 'assets/models/ho/american_diesel.glb',
        id: 'loco_ho_001',
        name: 'HO Scale American Diesel',
        scalePreset: 'HO_SCALE'  // Scales up by 87/76.2 ≈ 1.142
    });

    console.log('HO model scaled to OO:', {
        scale: loco.appliedScale  // Will be ~1.142
    });
}

// ============================================================================
// EXAMPLE 6: Dynamic Adjustment After Loading
// ============================================================================

/**
 * You can adjust scale and Y position after loading
 * for interactive fine-tuning.
 */
async function dynamicAdjustment(scene: Scene): Promise<void> {
    const loader = new TrainModelLoader(scene);

    const loco = await loader.loadModel({
        modelPath: 'assets/models/locomotives/loco.glb',
        id: 'loco_dynamic',
        name: 'Dynamic Loco'
    });

    // Later, if user says "make it bigger"
    loader.adjustScale('loco_dynamic', 1.1);  // 10% larger

    // If user says "raise it up a bit"
    loader.adjustYPosition('loco_dynamic', 0.001);  // Up 1mm

    // If user says "lower it slightly"
    loader.adjustYPosition('loco_dynamic', -0.0005);  // Down 0.5mm
}

// ============================================================================
// EXAMPLE 7: Debugging - Print Full Diagnostics
// ============================================================================

/**
 * For troubleshooting, load with full diagnostics and
 * print all relevant measurements.
 */
async function debugModelLoading(scene: Scene): Promise<void> {
    const loader = new TrainModelLoader(scene);

    console.log('=== TRAIN MODEL DIAGNOSTICS ===');
    console.log(`Rail top height: ${loader.getRailTopHeight()}m (${loader.getRailTopHeight() * 1000}mm)`);

    const loco = await loader.loadModel({
        modelPath: 'assets/models/locomotives/loco.glb',
        id: 'loco_debug',
        name: 'Debug Loco'
    });

    const stats = loader.getLastLoadStats();

    console.log('\n--- Model Info ---');
    console.log(`Mesh count: ${stats?.meshCount}`);
    console.log(`Vertex count: ${stats?.vertexCount}`);
    console.log(`Load time: ${stats?.loadTimeMs?.toFixed(0)}ms`);

    console.log('\n--- Original Bounds (before scaling) ---');
    console.log(`Min: ${stats?.originalBounds.min.toString()}`);
    console.log(`Max: ${stats?.originalBounds.max.toString()}`);

    console.log('\n--- Scaled Bounds ---');
    console.log(`Min: ${stats?.scaledBounds.min.toString()}`);
    console.log(`Max: ${stats?.scaledBounds.max.toString()}`);

    console.log('\n--- Applied Transforms ---');
    console.log(`Scale factor: ${loco.appliedScale}`);
    console.log(`Y offset: ${loco.appliedYOffset}m (${loco.appliedYOffset * 1000}mm)`);

    console.log('\n--- Final Dimensions ---');
    console.log(`Width (X): ${loco.bounds.width.toFixed(4)}m (${(loco.bounds.width * 1000).toFixed(1)}mm)`);
    console.log(`Height (Y): ${loco.bounds.height.toFixed(4)}m (${(loco.bounds.height * 1000).toFixed(1)}mm)`);
    console.log(`Length (Z): ${loco.bounds.length.toFixed(4)}m (${(loco.bounds.length * 1000).toFixed(1)}mm)`);

    console.log('\n--- Expected OO Gauge Dimensions (approximate) ---');
    console.log('Typical British loco:');
    console.log('  Width: 30-35mm (0.030-0.035m)');
    console.log('  Height: 50-55mm (0.050-0.055m)');
    console.log('  Length: 180-280mm (0.180-0.280m)');

    console.log('\n=== END DIAGNOSTICS ===');
}

// ============================================================================
// QUICK REFERENCE: Common Scale Factors
// ============================================================================

/**
 * SCALE FACTOR REFERENCE
 * 
 * If your model appears too SMALL:
 * - Increase scaleMultiplier (e.g., 1.1, 1.2, 1.5)
 * - Or use a higher preset (e.g., HO_SCALE if using HO models)
 * 
 * If your model appears too LARGE:
 * - Decrease scaleMultiplier (e.g., 0.9, 0.8)
 * - Or use scalePreset: 'REAL_WORLD' if model is at 1:1
 * 
 * If your model is the right SIZE but sits too LOW:
 * - Add positive yOffsetOverride (e.g., 0.002 for 2mm up)
 * - Or check if modelOrigin should be 'geometric-center'
 * 
 * If your model sits too HIGH:
 * - Add negative yOffsetOverride (e.g., -0.001 for 1mm down)
 * 
 * PRESETS:
 * - OO_GAUGE: 1.0 (model is already OO scale)
 * - REAL_WORLD: 0.0131 (model is at 1:1 real scale)
 * - HO_SCALE: 1.142 (model is 1:87 HO scale)
 * - N_SCALE_UK: 1.942 (model is 1:148 N scale)
 * - O_GAUGE_UK: 0.571 (model is 1:43.5 O scale)
 */

export {
    loadOOScaleModel,
    loadRealWorldModel,
    fineTuneModel,
    loadCenteredOriginModel,
    loadHOScaleModel,
    dynamicAdjustment,
    debugModelLoading
};