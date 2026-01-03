/**
 * TrainSelectionFix.ts - Click-to-control fix for locomotives
 * 
 * Path: frontend/src/core/TrainSelectionFix.ts
 * 
 * PROBLEM:
 * Locomotives are placed but not registered with TrainSystem,
 * so clicking them doesn't enable train controls.
 * 
 * SOLUTION:
 * This module provides two approaches:
 * 1. Auto-register locomotives when placed (recommended)
 * 2. Click-to-register for locomotives not yet registered
 * 
 * INTEGRATION:
 * Add to App.ts after train system initialization:
 * 
 *   import { TrainSelectionFix } from './TrainSelectionFix';
 *   
 *   // After trainSystem and modelImportButton are initialized:
 *   const trainFix = new TrainSelectionFix(
 *       this.scene,
 *       this.trainSystem,
 *       this.modelSystem,
 *       this.trackSystem.getGraph()
 *   );
 *   trainFix.initialize();
 * 
 * @module TrainSelectionFix
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import type { TrainSystem } from '../systems/train';
import { TrackEdgeFinder } from '../systems/train';
import type { ModelSystem } from '../systems/models/ModelSystem';
import type { TrackGraph } from '../systems/track/TrackGraph';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[TrainSelectionFix]';

/** Keywords that identify rolling stock models */
const ROLLING_STOCK_KEYWORDS = [
    'train', 'loco', 'locomotive', 'engine', 'diesel', 'steam', 'electric',
    'coach', 'carriage', 'wagon', 'freight', 'tanker', 'hopper', 'boxcar',
    'class', 'hst', 'dmu', 'emu', 'shunter', 'tender'
];

// ============================================================================
// TRAIN SELECTION FIX CLASS
// ============================================================================

/**
 * TrainSelectionFix - Enables click-to-control for locomotives
 * 
 * Bridges the gap between ModelSystem (model placement) and
 * TrainSystem (train control) by auto-registering locomotives.
 */
export class TrainSelectionFix {
    // ========================================================================
    // PRIVATE STATE
    // ========================================================================

    /** Babylon scene */
    private scene: Scene;

    /** Train system reference */
    private trainSystem: TrainSystem;

    /** Model system reference */
    private modelSystem: ModelSystem;

    /** Track graph for edge finding */
    private graph: TrackGraph;

    /** Edge finder for track detection */
    private edgeFinder: TrackEdgeFinder;

    /** Pointer observer reference */
    private pointerObserver: any = null;

    /** Map of model IDs to train IDs */
    private modelToTrain: Map<string, string> = new Map();

    /** Is initialized */
    private isInitialized: boolean = false;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create TrainSelectionFix
     * @param scene - Babylon scene
     * @param trainSystem - Train system reference
     * @param modelSystem - Model system reference
     * @param graph - Track graph for edge detection
     */
    constructor(
        scene: Scene,
        trainSystem: TrainSystem,
        modelSystem: ModelSystem,
        graph: TrackGraph
    ) {
        this.scene = scene;
        this.trainSystem = trainSystem;
        this.modelSystem = modelSystem;
        this.graph = graph;
        this.edgeFinder = new TrackEdgeFinder(graph);

        console.log(`${LOG_PREFIX} Created`);
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the fix
     * Sets up click detection and auto-registration
     */
    initialize(): void {
        if (this.isInitialized) {
            console.warn(`${LOG_PREFIX} Already initialized`);
            return;
        }

        console.log(`${LOG_PREFIX} Initializing...`);

        // Setup click detection
        this.setupPointerHandler();

        // Install global helper
        this.installGlobalHelper();

        this.isInitialized = true;

        console.log(`${LOG_PREFIX} ✓ Initialized`);
        console.log(`${LOG_PREFIX}   Click any locomotive to select for control`);
        console.log(`${LOG_PREFIX}   Keyboard: ↑/W throttle up, ↓/S throttle down, R reverse`);
    }

    // ========================================================================
    // POINTER HANDLING
    // ========================================================================

    /**
     * Setup pointer event handling for click-to-register
     */
    private setupPointerHandler(): void {
        this.pointerObserver = this.scene.onPointerObservable.add((pointerInfo) => {
            // Only handle clicks (POINTERDOWN with quick release)
            if (pointerInfo.type !== PointerEventTypes.POINTERDOWN) return;

            const pickResult = pointerInfo.pickInfo;
            if (!pickResult?.hit || !pickResult.pickedMesh) return;

            const mesh = pickResult.pickedMesh;

            // ----------------------------------------------------------------
            // Check if clicked on a model
            // ----------------------------------------------------------------
            const modelNode = this.findModelRootFromMesh(mesh);
            if (!modelNode) return;

            // ----------------------------------------------------------------
            // Check if this is rolling stock
            // ----------------------------------------------------------------
            if (!this.isRollingStock(modelNode)) {
                // Not a train - let normal model selection happen
                return;
            }

            // ----------------------------------------------------------------
            // Check if already registered as a train
            // ----------------------------------------------------------------
            const existingTrainId = this.findTrainByModel(modelNode);
            if (existingTrainId) {
                // Already registered - select it
                console.log(`${LOG_PREFIX} Selecting existing train: ${existingTrainId}`);
                this.trainSystem.selectTrain(existingTrainId);
                return;
            }

            // ----------------------------------------------------------------
            // Register as new train
            // ----------------------------------------------------------------
            console.log(`${LOG_PREFIX} Registering locomotive: ${modelNode.name}`);
            this.registerModelAsTrain(modelNode);
        });

        console.log(`${LOG_PREFIX} Pointer handler registered`);
    }

    // ========================================================================
    // TRAIN REGISTRATION
    // ========================================================================

    /**
     * Register a model as a controllable train
     * @param modelNode - The model's root transform node
     */
    registerModelAsTrain(modelNode: TransformNode): void {
        const name = modelNode.name || 'Locomotive';
        const position = modelNode.getAbsolutePosition();

        console.log(`${LOG_PREFIX} Registering "${name}" at position:`, position);

        // --------------------------------------------------------------------
        // Try to find nearest track edge
        // --------------------------------------------------------------------
        const edgeResult = this.edgeFinder.findNearestEdge(position, {
            maxDistance: 0.5  // 500mm search radius
        });

        // --------------------------------------------------------------------
        // Create train controller
        // --------------------------------------------------------------------
        let trainController;

        if (edgeResult) {
            // Found track - place on it
            console.log(`${LOG_PREFIX}   Found track edge: ${edgeResult.edge.id} at t=${edgeResult.t.toFixed(3)}`);

            trainController = this.trainSystem.addTrain(modelNode, {
                name: name,
                category: 'locomotive'
            });

            // Place on the track edge
            trainController.placeOnEdge(edgeResult.edge.id, edgeResult.t, 1);
        } else {
            // No track nearby - register anyway for control (stationary)
            console.log(`${LOG_PREFIX}   No track nearby - registering as stationary locomotive`);

            trainController = this.trainSystem.addTrain(modelNode, {
                name: name,
                category: 'locomotive'
            });

            // Note: Train won't move without being on track
            console.log(`${LOG_PREFIX}   ⚠ Move locomotive to track for movement`);
        }

        // --------------------------------------------------------------------
        // Store mapping and select
        // --------------------------------------------------------------------
        const trainId = trainController.getInfo().id;
        this.modelToTrain.set(modelNode.id, trainId);

        // Auto-select the new train
        trainController.select();

        console.log(`${LOG_PREFIX} ✓ Registered train: ${trainId}`);
        console.log(`${LOG_PREFIX}   Use ↑/W to accelerate, ↓/S to brake, R to reverse`);
    }

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

    /**
     * Find the root model node from any mesh in the model hierarchy
     * @param mesh - Any mesh in the model
     * @returns Root TransformNode or null
     */
    private findModelRootFromMesh(mesh: AbstractMesh): TransformNode | null {
        let current: any = mesh;

        // Walk up the hierarchy looking for a model root
        while (current) {
            // Check if this is a placed model root
            if (current.name && (
                current.name.startsWith('placed_model_') ||
                current.name.startsWith('model_root_') ||
                current.name.includes('_root')
            )) {
                return current as TransformNode;
            }

            // Check metadata for model info
            if (current.metadata?.isModelRoot || current.metadata?.originalName) {
                return current as TransformNode;
            }

            current = current.parent;
        }

        // If no specific root found, return the mesh's top-level parent
        current = mesh;
        while (current.parent && current.parent !== this.scene) {
            current = current.parent;
        }

        return current as TransformNode;
    }

    /**
     * Check if a node is rolling stock based on name/metadata
     * @param node - Node to check
     * @returns True if rolling stock
     */
    private isRollingStock(node: TransformNode): boolean {
        // Check metadata first
        if (node.metadata) {
            if (node.metadata.category === 'rolling_stock' ||
                node.metadata.category === 'locomotive' ||
                node.metadata.isRollingStock) {
                return true;
            }
        }

        // Check name for keywords
        const nodeName = (node.name || '').toLowerCase();
        const originalName = (node.metadata?.originalName || '').toLowerCase();
        const combinedName = nodeName + ' ' + originalName;

        return ROLLING_STOCK_KEYWORDS.some(keyword =>
            combinedName.includes(keyword.toLowerCase())
        );
    }

    /**
     * Find if a model is already registered as a train
     * @param modelNode - Model node to check
     * @returns Train ID or null
     */
    private findTrainByModel(modelNode: TransformNode): string | null {
        // Check our mapping first
        const mappedId = this.modelToTrain.get(modelNode.id);
        if (mappedId) {
            // Verify train still exists
            if (this.trainSystem.getTrain(mappedId)) {
                return mappedId;
            }
            // Clean up stale mapping
            this.modelToTrain.delete(modelNode.id);
        }

        // Check all trains for matching root node
        const allTrains = this.trainSystem.getAllTrains();
        for (const train of allTrains) {
            const trainRootNode = (train as any).rootNode;
            if (trainRootNode === modelNode) {
                const trainId = train.getInfo().id;
                this.modelToTrain.set(modelNode.id, trainId);
                return trainId;
            }
        }

        return null;
    }

    // ========================================================================
    // GLOBAL HELPERS
    // ========================================================================

    /**
     * Install global helper functions for console use
     */
    private installGlobalHelper(): void {
        const self = this;

        // Register any model by partial name
        (window as any).makeTrainControllable = function (partialName: string) {
            console.log(`${LOG_PREFIX} Searching for model: "${partialName}"`);

            // Find matching nodes
            const matches: TransformNode[] = [];
            for (const node of self.scene.rootNodes) {
                if (node instanceof TransformNode &&
                    node.name.toLowerCase().includes(partialName.toLowerCase())) {
                    matches.push(node);
                }
            }

            if (matches.length === 0) {
                console.log(`${LOG_PREFIX} No models found matching "${partialName}"`);
                console.log(`${LOG_PREFIX} Try: window.listModels() to see available models`);
                return;
            }

            // Register first match
            const model = matches[0];
            console.log(`${LOG_PREFIX} Found: ${model.name}`);
            self.registerModelAsTrain(model);
        };

        // List all models
        (window as any).listModels = function () {
            console.log(`${LOG_PREFIX} === Scene Models ===`);
            let count = 0;
            for (const node of self.scene.rootNodes) {
                if (node instanceof TransformNode &&
                    (node.name.startsWith('placed_model_') ||
                        node.name.startsWith('model_root_'))) {
                    count++;
                    const isRolling = self.isRollingStock(node);
                    const isTrain = self.findTrainByModel(node) !== null;
                    console.log(`${LOG_PREFIX}   ${node.name}`);
                    console.log(`${LOG_PREFIX}     Rolling Stock: ${isRolling}, Registered: ${isTrain}`);
                }
            }
            if (count === 0) {
                console.log(`${LOG_PREFIX}   (no models found)`);
            }
            console.log(`${LOG_PREFIX} =====================`);
        };

        // Quick register by clicking
        (window as any).trainControlHelp = function () {
            console.log('');
            console.log('╔════════════════════════════════════════════════════════════╗');
            console.log('║                   TRAIN CONTROL HELP                       ║');
            console.log('╠════════════════════════════════════════════════════════════╣');
            console.log('║  SELECTING A TRAIN:                                        ║');
            console.log('║    • Click on any locomotive to select it                  ║');
            console.log('║    • It will auto-register if not already a train          ║');
            console.log('║                                                            ║');
            console.log('║  KEYBOARD CONTROLS (when train selected):                  ║');
            console.log('║    ↑ or W     → Increase throttle                          ║');
            console.log('║    ↓ or S     → Decrease throttle                          ║');
            console.log('║    R          → Toggle direction (forward/reverse)         ║');
            console.log('║    Space      → Apply brake (hold)                         ║');
            console.log('║    H          → Sound horn                                 ║');
            console.log('║    Escape     → Deselect / Emergency brake                 ║');
            console.log('║                                                            ║');
            console.log('║  CONSOLE COMMANDS:                                         ║');
            console.log('║    window.makeTrainControllable("locom")                   ║');
            console.log('║    window.listModels()                                     ║');
            console.log('║    window.trainControlHelp()                               ║');
            console.log('╚════════════════════════════════════════════════════════════╝');
            console.log('');
        };

        console.log(`${LOG_PREFIX} Global helpers installed:`);
        console.log(`${LOG_PREFIX}   window.makeTrainControllable("name")  - Register a model`);
        console.log(`${LOG_PREFIX}   window.listModels()                   - List all models`);
        console.log(`${LOG_PREFIX}   window.trainControlHelp()             - Show controls`);
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Dispose of resources
     */
    dispose(): void {
        if (this.pointerObserver) {
            this.scene.onPointerObservable.remove(this.pointerObserver);
            this.pointerObserver = null;
        }

        this.modelToTrain.clear();

        // Remove global helpers
        delete (window as any).makeTrainControllable;
        delete (window as any).listModels;
        delete (window as any).trainControlHelp;

        console.log(`${LOG_PREFIX} Disposed`);
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default TrainSelectionFix;