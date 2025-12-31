/**
 * RollingStockPlacement.integration.ts - Integration guide for rolling stock positioning
 * 
 * Path: frontend/src/systems/train/RollingStockPlacement.integration.ts
 * 
 * This file demonstrates how to integrate the rolling stock positioning system
 * with your existing application. It provides:
 * 
 * 1. Setup and initialisation examples
 * 2. Different placement workflows
 * 3. Event handling patterns
 * 4. Debugging utilities
 * 
 * This is NOT meant to be run directly - it's a reference implementation
 * showing best practices for integration.
 * 
 * @module RollingStockPlacement.integration
 * @author Model Railway Workbench
 * @version 1.0.0
 */

// ============================================================================
// IMPORTS
// ============================================================================

import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import {
    RollingStockPositioner,
    type RollingStockInfo,
    type VehiclePlacement,
    type PlacementCompleteEvent,
    OO_GAUGE
} from './RollingStockPositioner';
import { ModelAxisDetector, detectModelForwardAxis } from './ModelAxisDetector';
import { TrackPathHelper, getTrackPathHelper } from './TrackPathHelper';
import type { TrackGraph } from '../track/TrackGraph';
import type { TrainSystem } from './TrainSystem';
import type { TrainController } from './TrainController';

// ============================================================================
// SECTION 1: BASIC SETUP
// ============================================================================

/**
 * Example: Setting up the rolling stock positioning system
 * 
 * This should be called during application initialisation, after
 * the track system and train system are ready.
 */
function setupRollingStockPositioning(
    scene: Scene,
    trackGraph: TrackGraph,
    trainSystem: TrainSystem
): RollingStockPositioner {

    console.log('[Integration] Setting up rolling stock positioning system');

    // Create the positioner
    const positioner = new RollingStockPositioner(scene, trackGraph, trainSystem);

    // Set up event listeners
    positioner.onPlacementComplete.add((event: PlacementCompleteEvent) => {
        console.log(`[Integration] Placement complete: ${event.info.name}`);
        console.log(`[Integration]   Edge: ${event.placement.edgeId}`);
        console.log(`[Integration]   Position: t=${event.placement.t.toFixed(3)}`);

        // Here you would update your UI, save state, etc.
        updateWorldOutliner(event.controller);
        saveLayoutState();
    });

    positioner.onPlacementCancelled.add((event) => {
        console.log(`[Integration] Placement cancelled: ${event.reason}`);

        // Clean up any pending UI state
        hideLoadingIndicator();
    });

    positioner.onPreviewUpdate.add((placement: VehiclePlacement | null) => {
        // Update UI to show valid/invalid placement
        if (placement?.isValid) {
            showPlacementValid();
        } else {
            showPlacementInvalid();
        }
    });

    console.log('[Integration] Rolling stock positioning system ready');

    return positioner;
}

// Placeholder functions for UI updates
function updateWorldOutliner(controller: TrainController): void { /* Update UI */ }
function saveLayoutState(): void { /* Save state */ }
function hideLoadingIndicator(): void { /* Hide loading */ }
function showPlacementValid(): void { /* Show valid */ }
function showPlacementInvalid(): void { /* Show invalid */ }

// ============================================================================
// SECTION 2: PLACEMENT WORKFLOWS
// ============================================================================

/**
 * Workflow 1: Interactive Click-to-Place
 * 
 * This is the recommended workflow for user-initiated placement.
 * The model follows the mouse cursor and snaps to track.
 */
async function interactivePlacement(
    positioner: RollingStockPositioner,
    importedModel: TransformNode,
    modelName: string
): Promise<TrainController | null> {

    console.log('[Integration] Starting interactive placement workflow');

    return new Promise((resolve) => {
        // Define the rolling stock info
        const info: RollingStockInfo = {
            id: `vehicle_${Date.now()}`,
            name: modelName,
            category: 'locomotive', // or 'coach', 'wagon', etc.
            // forwardAxis is auto-detected if not specified
        };

        // Listen for completion (one-time)
        const observer = positioner.onPlacementComplete.add((event) => {
            positioner.onPlacementComplete.remove(observer);
            resolve(event.controller);
        });

        // Listen for cancellation
        const cancelObserver = positioner.onPlacementCancelled.add(() => {
            positioner.onPlacementCancelled.remove(cancelObserver);
            resolve(null);
        });

        // Start placement mode
        positioner.startPlacement(importedModel, info);
    });
}

/**
 * Workflow 2: Direct Placement at Position
 * 
 * Use this when you know where the model should go, such as
 * when loading a saved layout or programmatic placement.
 */
function directPlacementAtPosition(
    positioner: RollingStockPositioner,
    model: TransformNode,
    worldPosition: Vector3,
    name: string
): TrainController | null {

    console.log(`[Integration] Direct placement at (${worldPosition.x.toFixed(3)}, ${worldPosition.z.toFixed(3)})`);

    const info: RollingStockInfo = {
        id: `vehicle_${Date.now()}`,
        name: name,
        category: 'locomotive'
    };

    // Place directly - no user interaction needed
    const controller = positioner.placeOnTrack(model, worldPosition, info);

    if (controller) {
        console.log(`[Integration] Successfully placed ${name}`);
    } else {
        console.warn(`[Integration] Failed to place ${name} - no track nearby`);
    }

    return controller;
}

/**
 * Workflow 3: Direct Placement on Specific Edge
 * 
 * Most precise placement method - specify exactly which track edge
 * and position along it.
 */
function directPlacementOnEdge(
    positioner: RollingStockPositioner,
    model: TransformNode,
    edgeId: string,
    t: number,
    name: string,
    facingDirection: 1 | -1 = 1
): TrainController | null {

    console.log(`[Integration] Placing on edge ${edgeId} at t=${t.toFixed(3)}`);

    const info: RollingStockInfo = {
        id: `vehicle_${Date.now()}`,
        name: name,
        category: 'locomotive'
    };

    return positioner.placeOnEdge(model, edgeId, t, info, facingDirection);
}

// ============================================================================
// SECTION 3: MODEL IMPORT INTEGRATION
// ============================================================================

/**
 * Example: Integrating with model import
 * 
 * Call this after a model is imported via GLB/GLTF loader.
 */
async function handleModelImport(
    scene: Scene,
    positioner: RollingStockPositioner,
    rootNode: TransformNode,
    originalFilename: string
): Promise<TrainController | null> {

    console.log(`[Integration] Handling import of ${originalFilename}`);

    // Step 1: Determine category from filename
    const category = detectCategoryFromFilename(originalFilename);

    // Step 2: Detect model forward axis
    const detector = new ModelAxisDetector();
    const analysis = detector.analyse(rootNode);

    console.log(`[Integration] Model analysis:`);
    console.log(`[Integration]   Forward axis: ${analysis.forwardAxis}`);
    console.log(`[Integration]   Confidence: ${(analysis.confidence * 100).toFixed(0)}%`);
    console.log(`[Integration]   Length: ${(analysis.lengthM * 1000).toFixed(0)}mm`);

    // Step 3: Create info with detected values
    const info: RollingStockInfo = {
        id: `vehicle_${Date.now()}`,
        name: extractDisplayName(originalFilename),
        category: category,
        forwardAxis: analysis.forwardAxis,
        lengthM: analysis.lengthM
    };

    // Step 4: Handle based on category
    if (category === 'locomotive' || category === 'coach' || category === 'wagon') {
        // Rolling stock requires track placement
        console.log(`[Integration] Starting track placement for ${info.name}`);
        return interactivePlacement(positioner, rootNode, info.name);

    } else {
        // Non-rolling-stock can be placed freely
        console.log(`[Integration] ${info.name} is scenery - free placement`);
        return null;
    }
}

/**
 * Detect rolling stock category from filename keywords
 */
function detectCategoryFromFilename(filename: string): RollingStockInfo['category'] {
    const lower = filename.toLowerCase();

    // Locomotive keywords
    const locoKeywords = [
        'loco', 'locomotive', 'engine', 'diesel', 'steam', 'electric',
        'class', 'hst', 'dmu', 'emu', 'shunter', 'freight_loco'
    ];

    // Coach keywords
    const coachKeywords = [
        'coach', 'carriage', 'passenger', 'mk1', 'mk2', 'mk3', 'mk4',
        'pullman', 'sleeper', 'restaurant', 'buffet'
    ];

    // Wagon keywords
    const wagonKeywords = [
        'wagon', 'freight', 'tanker', 'hopper', 'boxcar', 'van',
        'flatbed', 'container', 'coal', 'timber', 'cement'
    ];

    if (locoKeywords.some(kw => lower.includes(kw))) {
        return 'locomotive';
    }
    if (coachKeywords.some(kw => lower.includes(kw))) {
        return 'coach';
    }
    if (wagonKeywords.some(kw => lower.includes(kw))) {
        return 'wagon';
    }

    // Default to locomotive for unknown
    return 'locomotive';
}

/**
 * Extract a clean display name from filename
 */
function extractDisplayName(filename: string): string {
    // Remove extension
    let name = filename.replace(/\.(glb|gltf|fbx|obj)$/i, '');

    // Replace underscores/hyphens with spaces
    name = name.replace(/[-_]/g, ' ');

    // Title case
    name = name.replace(/\b\w/g, c => c.toUpperCase());

    return name;
}

// ============================================================================
// SECTION 4: TRAIN SYSTEM INTEGRATION
// ============================================================================

/**
 * Example: Complete flow from import to operable train
 */
async function createOperableTrain(
    scene: Scene,
    positioner: RollingStockPositioner,
    trainSystem: any, // TrainSystem
    importedModel: TransformNode,
    info: RollingStockInfo
): Promise<void> {

    console.log(`[Integration] Creating operable train: ${info.name}`);

    // Step 1: Place on track (interactive)
    const controller = await interactivePlacement(positioner, importedModel, info.name);

    if (!controller) {
        console.warn('[Integration] Placement was cancelled');
        return;
    }

    // Step 2: Configure train properties
    console.log('[Integration] Configuring train controller');

    // Set DCC address if provided
    if (info.dccAddress !== undefined) {
        // controller.setDCCAddress(info.dccAddress);
    }

    // Step 3: Select the train for control
    controller.select();

    // Step 4: Enable sound if available
    // controller.enableSound();

    // Step 5: Update UI
    console.log(`[Integration] Train ${info.name} is ready for operation`);

    // Show train control panel
    // showTrainControlPanel(controller);
}

// ============================================================================
// SECTION 5: LOADING SAVED LAYOUTS
// ============================================================================

/**
 * Data structure for saved rolling stock
 */
interface SavedRollingStock {
    id: string;
    name: string;
    category: RollingStockInfo['category'];
    forwardAxis: string;
    lengthM: number;
    edgeId: string;
    t: number;
    direction: 1 | -1;
    libraryEntryId?: string;
}

/**
 * Restore rolling stock from saved layout data
 */
async function restoreSavedRollingStock(
    positioner: RollingStockPositioner,
    savedData: SavedRollingStock[],
    modelLoader: (id: string) => Promise<TransformNode | null>
): Promise<TrainController[]> {

    console.log(`[Integration] Restoring ${savedData.length} saved vehicles`);

    const controllers: TrainController[] = [];

    for (const saved of savedData) {
        try {
            // Load the model from library
            const model = await modelLoader(saved.libraryEntryId || saved.id);

            if (!model) {
                console.warn(`[Integration] Could not load model for ${saved.name}`);
                continue;
            }

            // Create info from saved data
            const info: RollingStockInfo = {
                id: saved.id,
                name: saved.name,
                category: saved.category,
                forwardAxis: saved.forwardAxis as any,
                lengthM: saved.lengthM,
                libraryEntryId: saved.libraryEntryId
            };

            // Place directly on saved edge/position
            const controller = positioner.placeOnEdge(
                model,
                saved.edgeId,
                saved.t,
                info,
                saved.direction
            );

            if (controller) {
                controllers.push(controller);
                console.log(`[Integration] Restored ${saved.name}`);
            }

        } catch (error) {
            console.error(`[Integration] Error restoring ${saved.name}:`, error);
        }
    }

    console.log(`[Integration] Restored ${controllers.length}/${savedData.length} vehicles`);

    return controllers;
}

// ============================================================================
// SECTION 6: DEBUGGING UTILITIES
// ============================================================================

/**
 * Debug helper: Visualise track path
 */
function debugVisualiseTrackPath(
    scene: Scene,
    trackGraph: TrackGraph,
    edgeId: string
): void {
    const helper = getTrackPathHelper(trackGraph);

    // Sample poses along the edge
    const poses = helper.samplePosesOnEdge(edgeId, 20);

    console.log(`[Debug] Track path for edge ${edgeId}:`);

    for (let i = 0; i < poses.length; i++) {
        const pose = poses[i];
        const t = i / (poses.length - 1);

        console.log(`[Debug]   t=${t.toFixed(2)}: pos=(${pose.position.x.toFixed(3)}, ${pose.position.z.toFixed(3)}) dir=(${pose.forward.x.toFixed(2)}, ${pose.forward.z.toFixed(2)})`);
    }
}

/**
 * Debug helper: Test model axis detection
 */
function debugModelAxisDetection(rootNode: TransformNode): void {
    const detector = new ModelAxisDetector();
    const result = detector.analyse(rootNode);

    console.log('[Debug] Model Axis Detection Results:');
    console.log(`[Debug]   Forward axis: ${result.forwardAxis}`);
    console.log(`[Debug]   Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    console.log(`[Debug]   Dimensions: ${(result.lengthM * 1000).toFixed(0)}mm x ${(result.widthM * 1000).toFixed(0)}mm x ${(result.heightM * 1000).toFixed(0)}mm`);
    console.log('[Debug]   Methods used:', result.methodsUsed.join(', '));
    console.log('[Debug]   Reasoning:');
    for (const reason of result.reasoning) {
        console.log(`[Debug]     - ${reason}`);
    }
}

/**
 * Debug helper: Log all track edges
 */
function debugListAllEdges(trackGraph: TrackGraph): void {
    const edges = trackGraph.getAllEdges();

    console.log(`[Debug] Track Graph: ${edges.length} edges`);

    for (const edge of edges) {
        const fromNode = trackGraph.getNode(edge.fromNodeId);
        const toNode = trackGraph.getNode(edge.toNodeId);

        console.log(`[Debug] Edge ${edge.id}:`);
        console.log(`[Debug]   Type: ${edge.curve.type}`);
        console.log(`[Debug]   Length: ${(edge.lengthM * 1000).toFixed(1)}mm`);
        console.log(`[Debug]   From: (${fromNode?.pos.x.toFixed(3)}, ${fromNode?.pos.z.toFixed(3)})`);
        console.log(`[Debug]   To: (${toNode?.pos.x.toFixed(3)}, ${toNode?.pos.z.toFixed(3)})`);

        if (edge.curve.type === 'arc') {
            console.log(`[Debug]   Radius: ${((edge.curve.arcRadiusM || 0) * 1000).toFixed(0)}mm`);
            console.log(`[Debug]   Angle: ${edge.curve.arcAngleDeg}°`);
            console.log(`[Debug]   Direction: ${edge.curve.arcDirection === 1 ? 'left' : 'right'}`);
        }
    }
}

/**
 * Debug helper: Test placement at position
 */
function debugTestPlacement(
    positioner: RollingStockPositioner,
    worldPosition: Vector3
): void {
    console.log(`[Debug] Testing placement at (${worldPosition.x.toFixed(3)}, ${worldPosition.y.toFixed(3)}, ${worldPosition.z.toFixed(3)})`);

    // This would need access to positioner internals, but demonstrates the concept
    console.log('[Debug]   (Use positioner.findNearestEdge internally to test)');
}

// ============================================================================
// SECTION 7: HEIGHT REFERENCE
// ============================================================================

/**
 * OO Gauge Height Reference
 * 
 * Understanding the vertical positioning is critical for correct placement.
 * 
 * Height Stack (from floor up):
 * - World origin: Y = 0
 * - Baseboard legs: variable
 * - Baseboard top surface: Y = 0.950m (BaseboardSystem.BOARD_HEIGHT)
 * - Ballast bottom: Y = 0.950m
 * - Ballast top / Sleeper bottom: Y = 0.953m (+3mm)
 * - Sleeper top: Y = 0.955m (+5mm from baseboard)
 * - Rail top: Y = 0.958m (+8mm from baseboard)
 * - Wheel flange depth: ~1mm below rail top
 * - Model bottom (wheel contact): Y = 0.957m
 * 
 * When placing models:
 * - Use OO_GAUGE.RAIL_TOP_Y (0.958m) for the rail surface
 * - Use OO_GAUGE.MODEL_BOTTOM_Y (0.957m) for model placement
 * - This accounts for wheel flange sitting in the rail groove
 */

console.log('[Integration] OO Gauge Height Reference:');
console.log(`[Integration]   Baseboard top: ${OO_GAUGE.BASEBOARD_TOP_M}m`);
console.log(`[Integration]   Rail top: ${OO_GAUGE.RAIL_TOP_Y}m`);
console.log(`[Integration]   Model bottom: ${OO_GAUGE.MODEL_BOTTOM_Y}m`);
console.log(`[Integration]   Track gauge: ${OO_GAUGE.GAUGE_M * 1000}mm`);

// ============================================================================
// EXPORTS
// ============================================================================

export {
    setupRollingStockPositioning,
    interactivePlacement,
    directPlacementAtPosition,
    directPlacementOnEdge,
    handleModelImport,
    createOperableTrain,
    restoreSavedRollingStock,
    debugVisualiseTrackPath,
    debugModelAxisDetection,
    debugListAllEdges,
    debugTestPlacement,
    detectCategoryFromFilename,
    extractDisplayName
};