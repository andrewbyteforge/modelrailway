/**
 * TrainSystemIntegration.ts - Example integration with main App
 * 
 * Path: frontend/src/systems/train/examples/TrainSystemIntegration.ts
 * 
 * This file demonstrates how to integrate the train system into
 * the main application. It's not meant to be used directly - rather,
 * copy the relevant parts into your App.ts.
 * 
 * @module TrainSystemIntegration
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';

// Import train system
import { TrainSystem } from '../TrainSystem';
import { TrainControlPanel } from '../../ui/TrainControlPanel';
import type { TrackSystem } from '../../track/TrackSystem';

// ============================================================================
// INTEGRATION STEPS
// ============================================================================

/**
 * Step 1: Add properties to your App class
 * 
 * In your App.ts class, add these properties:
 */
interface AppTrainProperties {
    /** Train system instance */
    trainSystem: TrainSystem | null;

    /** Train control panel UI */
    trainControlPanel: TrainControlPanel | null;
}

/**
 * Step 2: Initialize train system in App.initialize()
 * 
 * After your track system is initialized, add this:
 */
function initializeTrainSystem(
    scene: Scene,
    trackSystem: TrackSystem
): { trainSystem: TrainSystem; controlPanel: TrainControlPanel } {
    // Create train system
    const trainSystem = new TrainSystem(scene, trackSystem, {
        enableSound: true,
        enableKeyboardControls: true,
        enablePointerControls: true,
        throttleStep: 0.1
    });

    // Initialize it
    trainSystem.initialize();

    // Create control panel UI
    const controlPanel = new TrainControlPanel(trainSystem);
    controlPanel.initialize();

    return { trainSystem, controlPanel };
}

/**
 * Step 3: Update train system in render loop
 * 
 * In your render loop (where scene.render() is called), add:
 */
function updateTrainSystem(
    trainSystem: TrainSystem | null,
    deltaTime: number
): void {
    if (trainSystem) {
        trainSystem.update(deltaTime);
    }
}

/**
 * Step 4: Add train when rolling stock is placed
 * 
 * In your model import callback (after placing a rolling stock model):
 */
async function addTrainFromModel(
    trainSystem: TrainSystem,
    modelRootNode: TransformNode,
    modelName: string,
    trackEdgeId: string // The edge the model was placed on
): Promise<void> {
    // Create train controller
    const controller = trainSystem.addTrain(
        modelRootNode,
        {
            name: modelName,
            category: 'locomotive'
        }
    );

    // Place on track
    controller.placeOnEdge(trackEdgeId, 0.5, 1);

    // Optionally auto-select it
    controller.select();

    console.log(`Train "${modelName}" added and placed on track`);
}

/**
 * Step 5: Dispose on cleanup
 * 
 * In your App.dispose() method:
 */
function disposeTrainSystem(
    trainSystem: TrainSystem | null,
    controlPanel: TrainControlPanel | null
): void {
    controlPanel?.dispose();
    trainSystem?.dispose();
}

// ============================================================================
// FULL APP.TS INTEGRATION EXAMPLE
// ============================================================================

/**
 * Here's a complete example of what your App.ts might look like
 * with the train system integrated:
 * 
 * ```typescript
 * // In App.ts
 * 
 * import { TrainSystem } from './systems/train';
 * import { TrainControlPanel } from './ui/TrainControlPanel';
 * 
 * export class App {
 *     private scene: Scene;
 *     private trackSystem: TrackSystem;
 *     
 *     // Train system properties
 *     private trainSystem: TrainSystem | null = null;
 *     private trainControlPanel: TrainControlPanel | null = null;
 *     
 *     async initialize(): Promise<void> {
 *         // ... your existing initialization code ...
 *         
 *         // Initialize track system
 *         this.trackSystem = new TrackSystem(this.scene);
 *         this.trackSystem.initialize();
 *         
 *         // Initialize train system (after track system)
 *         this.trainSystem = new TrainSystem(this.scene, this.trackSystem, {
 *             enableSound: true,
 *             enableKeyboardControls: true,
 *             enablePointerControls: true
 *         });
 *         this.trainSystem.initialize();
 *         
 *         // Initialize train control panel
 *         this.trainControlPanel = new TrainControlPanel(this.trainSystem);
 *         this.trainControlPanel.initialize();
 *         
 *         // ... rest of initialization ...
 *         
 *         // Setup render loop with train updates
 *         let lastTime = performance.now();
 *         this.engine.runRenderLoop(() => {
 *             const currentTime = performance.now();
 *             const deltaTime = (currentTime - lastTime) / 1000;
 *             lastTime = currentTime;
 *             
 *             // Update train system
 *             this.trainSystem?.update(deltaTime);
 *             
 *             // Render scene
 *             this.scene.render();
 *         });
 *     }
 *     
 *     // Method to add a train when importing rolling stock
 *     addTrainFromImport(rootNode: TransformNode, name: string, edgeId: string): void {
 *         if (!this.trainSystem) return;
 *         
 *         const controller = this.trainSystem.addTrain(rootNode, {
 *             name: name,
 *             category: 'locomotive'
 *         });
 *         
 *         controller.placeOnEdge(edgeId, 0.5, 1);
 *         controller.select();
 *     }
 *     
 *     dispose(): void {
 *         this.trainControlPanel?.dispose();
 *         this.trainSystem?.dispose();
 *         // ... other cleanup ...
 *     }
 * }
 * ```
 */

// ============================================================================
// POINTS INTEGRATION
// ============================================================================

/**
 * Points (switches) are automatically detected from the track system.
 * 
 * When a user clicks on a point/switch track piece, it will toggle
 * automatically. The train system handles this via pointer events.
 * 
 * If you need to manually control points:
 * 
 * ```typescript
 * // Get points manager
 * const pointsManager = trainSystem.getPointsManager();
 * 
 * // Toggle a point
 * const newState = trainSystem.togglePoint('piece_123');
 * 
 * // Set specific state
 * trainSystem.setPointState('piece_123', 'reverse');
 * 
 * // Get all points
 * const allPoints = trainSystem.getAllPoints();
 * 
 * // Listen for point changes
 * trainSystem.onPointChanged.add((pointData) => {
 *     console.log(`Point ${pointData.label} is now ${pointData.state}`);
 * });
 * ```
 */

// ============================================================================
// TRACK MODEL PLACER INTEGRATION
// ============================================================================

/**
 * When using TrackModelPlacer for rolling stock, you'll need to
 * coordinate with the train system. Here's how:
 * 
 * In TrackModelPlacer.ts, after successfully placing the model:
 * 
 * ```typescript
 * // After placing the model on track...
 * 
 * // Get the edge ID the model was placed on
 * const edgeId = placementInfo.edgeId;
 * 
 * // Get the parametric position
 * const t = placementInfo.t;
 * 
 * // Notify train system (via callback or event)
 * if (this.onTrainPlaced) {
 *     this.onTrainPlaced(rootNode, edgeId, t);
 * }
 * ```
 * 
 * Then in your main App, handle this callback:
 * 
 * ```typescript
 * trackModelPlacer.onTrainPlaced = (rootNode, edgeId, t) => {
 *     const controller = this.trainSystem.addTrain(rootNode, {
 *         name: 'New Train',
 *         category: 'locomotive'
 *     });
 *     controller.placeOnEdge(edgeId, t, 1);
 * };
 * ```
 */

// ============================================================================
// KEYBOARD CONTROLS REFERENCE
// ============================================================================

/**
 * Default keyboard controls (when a train is selected):
 * 
 * ↑ or W     - Increase throttle
 * ↓ or S     - Decrease throttle
 * R          - Toggle direction (forward/reverse)
 * Space      - Apply brake (hold)
 * H          - Sound horn
 * Escape     - Deselect train / Emergency brake
 * 
 * Click on train     - Select for control
 * Click on points    - Toggle switch direction
 */

export {
    initializeTrainSystem,
    updateTrainSystem,
    addTrainFromModel,
    disposeTrainSystem
};