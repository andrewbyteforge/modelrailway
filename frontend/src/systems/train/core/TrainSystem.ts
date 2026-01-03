/**
 * TrainSystem.ts - Train Management System
 * 
 * Path: frontend/src/systems/train/TrainSystem.ts
 * 
 * Manages all train operations including:
 * - Train registration and lifecycle
 * - Keyboard controls for selected train
 * - Pointer controls for train selection
 * - Physics simulation updates
 * - Points/switch management
 * 
 * UPDATED v2.0.0: Click on train now shows a modal to choose between:
 *   - Lift & Move: Pick up and reposition the train
 *   - Drive: Control the train with keyboard
 * 
 * @module TrainSystem
 * @author Model Railway Workbench
 * @version 2.0.0 - Modal-based train selection
 */

import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { Observable } from '@babylonjs/core/Misc/observable';

import { TrackSystem } from '../../track/TrackSystem';
import { TrackGraph } from '../../track/TrackGraph';
import { TrackEdgeFinder } from '../track/TrackEdgeFinder';
import { TrainController, type TrainInfo } from './TrainController';
import { PointsManager, type PointData, type PointChangeEvent } from '../track/PointsManager';
import { TrainSoundManager } from '../utilities/TrainSoundManager';
import {
    showTrainSelectionModal,
    isTrainSelectionModalOpen,
    type TrainSelectionResult
} from '../../../ui/TrainSelectionModal';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Log prefix for console messages */
const LOG_PREFIX = '[TrainSystem]';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Configuration for TrainSystem
 */
export interface TrainSystemConfig {
    /** Enable sound effects */
    enableSound: boolean;
    /** Enable keyboard controls */
    enableKeyboardControls: boolean;
    /** Enable pointer/mouse controls */
    enablePointerControls: boolean;
    /** Throttle step per key press (0-1) */
    throttleStep: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: TrainSystemConfig = {
    enableSound: true,
    enableKeyboardControls: true,
    enablePointerControls: true,
    throttleStep: 0.1
};

/**
 * Keyboard control mappings
 */
interface TrainKeyboardControls {
    throttleUp: string[];
    throttleDown: string[];
    brake: string[];
    reverse: string[];
    horn: string[];
    emergencyStop: string[];
}

/**
 * Default keyboard controls
 */
const DEFAULT_KEYBOARD_CONTROLS: TrainKeyboardControls = {
    throttleUp: ['w', 'W', 'ArrowUp'],
    throttleDown: ['s', 'S', 'ArrowDown'],
    brake: [' '],               // Space
    reverse: ['r', 'R'],
    horn: ['h', 'H'],
    emergencyStop: ['x', 'X', 'Escape']
};

/**
 * Event data for train reposition request
 */
export interface TrainRepositionRequest {
    /** ID of the train to reposition */
    trainId: string;
    /** Name of the train */
    trainName: string;
    /** The train controller instance */
    controller: TrainController;
}

// ============================================================================
// TRAIN SYSTEM CLASS
// ============================================================================

/**
 * TrainSystem - Manages all train operations
 * 
 * @example
 * ```typescript
 * const trainSystem = new TrainSystem(scene, trackSystem);
 * trainSystem.initialize();
 * 
 * // Add a train
 * const controller = trainSystem.addTrain(mesh, { id: 'loco1', name: 'Class 66' });
 * controller.placeOnEdge(edgeId);
 * 
 * // In render loop:
 * trainSystem.update(deltaTime);
 * ```
 */
export class TrainSystem {
    // ========================================================================
    // PRIVATE STATE
    // ========================================================================

    /** Babylon scene */
    private scene: Scene;

    /** Track system reference */
    private trackSystem: TrackSystem;

    /** Track graph reference */
    private graph: TrackGraph;

    /** Points manager */
    private pointsManager: PointsManager;

    /** Global sound manager for UI sounds */
    private globalSoundManager: TrainSoundManager;

    /** All train controllers */
    private trains: Map<string, TrainController> = new Map();

    /** Currently selected train */
    private selectedTrain: TrainController | null = null;

    /** Configuration */
    private config: TrainSystemConfig;

    /** Keyboard controls mapping */
    private keyboardControls: TrainKeyboardControls;

    /** Keyboard event handler reference (for cleanup) */
    private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
    private keyupHandler: ((e: KeyboardEvent) => void) | null = null;

    /** Currently held keys */
    private heldKeys: Set<string> = new Set();

    /** Pointer observer reference */
    private pointerObserver: any = null;

    /** Is the system initialized */
    private isInitialized: boolean = false;

    // ========================================================================
    // OBSERVABLES
    // ========================================================================

    /** Emitted when a train is added */
    public onTrainAdded: Observable<TrainController> = new Observable();

    /** Emitted when a train is removed */
    public onTrainRemoved: Observable<string> = new Observable();

    /** Emitted when selected train changes */
    public onSelectionChanged: Observable<TrainController | null> = new Observable();

    /** Emitted when a point state changes */
    public onPointChanged: Observable<PointChangeEvent> = new Observable();

    /**
     * Emitted when user wants to reposition a train (from modal)
     * External systems (like ModelImportButton) should subscribe to this
     */
    public onRepositionRequested: Observable<TrainRepositionRequest> = new Observable();

    /**
     * Emitted when user chooses to drive a train (from modal)
     * TrainControlPanel should subscribe to this to show driving controls
     */
    public onDriveModeActivated: Observable<TrainController> = new Observable();

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new TrainSystem
     * @param scene - Babylon scene
     * @param trackSystem - Track system reference
     * @param config - Optional configuration
     */
    constructor(
        scene: Scene,
        trackSystem: TrackSystem,
        config?: Partial<TrainSystemConfig>
    ) {
        this.scene = scene;
        this.trackSystem = trackSystem;
        this.graph = trackSystem.getGraph();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.keyboardControls = { ...DEFAULT_KEYBOARD_CONTROLS };

        // Create points manager
        this.pointsManager = new PointsManager(this.scene, trackSystem);

        // Relay point changes
        this.pointsManager.onPointChanged.add((data) => {
            this.onPointChanged.notifyObservers(data);
        });

        // Create global sound manager (for horn, etc.)
        this.globalSoundManager = new TrainSoundManager(scene);

        console.log(`${LOG_PREFIX} Created`);
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the train system
     * Sets up input handlers and prepares for train management
     */
    initialize(): void {
        if (this.isInitialized) {
            console.warn(`${LOG_PREFIX} Already initialized`);
            return;
        }

        // Setup input handlers
        if (this.config.enableKeyboardControls) {
            this.setupKeyboardControls();
        }

        if (this.config.enablePointerControls) {
            this.setupPointerControls();
        }

        // Subscribe to graph changes for points detection
        this.setupPointsDetection();

        this.isInitialized = true;

        console.log(`${LOG_PREFIX} Initialized`);
        console.log(`${LOG_PREFIX}   Keyboard: ${this.config.enableKeyboardControls ? 'ON' : 'OFF'}`);
        console.log(`${LOG_PREFIX}   Pointer: ${this.config.enablePointerControls ? 'ON' : 'OFF'}`);
        console.log(`${LOG_PREFIX}   Sound: ${this.config.enableSound ? 'ON' : 'OFF'}`);
    }

    /**
     * Dispose of the train system
     * Cleans up all resources and event handlers
     */
    dispose(): void {
        // Remove keyboard handlers
        if (this.keydownHandler) {
            window.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = null;
        }
        if (this.keyupHandler) {
            window.removeEventListener('keyup', this.keyupHandler);
            this.keyupHandler = null;
        }

        // Remove pointer observer
        if (this.pointerObserver) {
            this.scene.onPointerObservable.remove(this.pointerObserver);
            this.pointerObserver = null;
        }

        // Dispose all trains
        for (const train of this.trains.values()) {
            train.dispose();
        }
        this.trains.clear();

        // Dispose points manager
        this.pointsManager.dispose();

        // Dispose sound manager
        this.globalSoundManager.dispose();

        // Clear observables
        this.onTrainAdded.clear();
        this.onTrainRemoved.clear();
        this.onSelectionChanged.clear();
        this.onPointChanged.clear();
        this.onRepositionRequested.clear();

        this.isInitialized = false;

        console.log(`${LOG_PREFIX} Disposed`);
    }

    // ========================================================================
    // UPDATE LOOP
    // ========================================================================

    /**
    * Update all trains (called from render loop)
    * @param deltaTime - Time since last frame in seconds
    */
    update(deltaTime: number): void {
        // Skip if no trains
        if (this.trains.size === 0) return;

        // Update each train
        for (const [id, controller] of this.trains) {
            controller.update(deltaTime);
        }
    }

    // ========================================================================
    // TRAIN MANAGEMENT
    // ========================================================================

    /**
     * Add a train to the system
     * @param rootNode - Root transform node of the train model
     * @param info - Train information
     * @returns The created TrainController
     */
    addTrain(
        rootNode: TransformNode,
        info: Partial<TrainInfo>
    ): TrainController {
        // Generate ID if not provided
        const trainId = info.id || `train-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Check for duplicate
        if (this.trains.has(trainId)) {
            console.warn(`${LOG_PREFIX} Train ${trainId} already exists, removing old one`);
            this.removeTrain(trainId);
        }

        // Build the train info object
        const trainInfo: TrainInfo = {
            id: trainId,
            name: info.name || rootNode.name || 'Unnamed Train',
            category: info.category || 'locomotive',
            libraryEntryId: info.libraryEntryId
        };

        // Create TrainController
        const controller = new TrainController(
            this.scene,
            this.graph,
            this.pointsManager,
            rootNode,
            trainInfo
        );

        // Store reference
        this.trains.set(trainId, controller);

        // Subscribe to selection events
        controller.onSelected.add(() => this.handleTrainSelected(controller));
        controller.onDeselected.add(() => this.handleTrainDeselected(controller));

        // Notify observers
        this.onTrainAdded.notifyObservers(controller);

        console.log(`${LOG_PREFIX} Added train: ${trainId} (${info.name})`);

        return controller;
    }

    /**
     * Register an existing model as a train
     * @param rootNode - The model's root node
     * @param name - Display name for the train
     * @param edgeId - Optional edge ID to place on
     * @param t - Optional position along edge (0-1)
     * @returns TrainController if successful
    /**
     * Register an existing model as a train
     * @param rootNode - The model's root node
     * @param name - Display name for the train
     * @param edgeId - Optional edge ID to place on
     * @param t - Optional position along edge (0-1)
     * @returns TrainController if successful
     */
    registerExistingModel(
        rootNode: TransformNode,
        name: string,
        edgeId?: string,
        t: number = 0.5
    ): TrainController | null {
        try {
            // If no edge specified, try to find one near the model
            let targetEdgeId = edgeId;

            if (!targetEdgeId) {
                const edgeFinder = new TrackEdgeFinder(this.graph);
                const position = rootNode.getAbsolutePosition
                    ? rootNode.getAbsolutePosition()
                    : rootNode.position;

                const result = edgeFinder.findNearestEdge(position, { maxDistance: 0.1 });

                if (result) {
                    targetEdgeId = result.edge.id;
                    console.log(`${LOG_PREFIX} Found nearby edge: ${targetEdgeId}`);
                } else {
                    console.warn(`${LOG_PREFIX} Model "${name}" not near any track`);
                }
            }

            // Create controller
            const controller = this.addTrain(rootNode, {
                name,
                category: 'locomotive'
            });

            // Place on track if we found an edge
            if (targetEdgeId) {
                controller.placeOnEdge(targetEdgeId, t, 1);
                console.log(`${LOG_PREFIX} Placed train on edge: ${targetEdgeId}`);
            }

            return controller;
        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to register model:`, error);
            return null;
        }
    }

    /**
     * Remove a train from the system
     * @param trainId - ID of train to remove
     * @returns true if train was removed
     */
    removeTrain(trainId: string): boolean {
        const controller = this.trains.get(trainId);
        if (!controller) {
            console.warn(`${LOG_PREFIX} Train ${trainId} not found`);
            return false;
        }

        // Deselect if selected
        if (this.selectedTrain === controller) {
            this.deselectTrain();
        }

        // Dispose controller
        controller.dispose();

        // Remove from map
        this.trains.delete(trainId);

        // Notify observers
        this.onTrainRemoved.notifyObservers(trainId);

        console.log(`${LOG_PREFIX} Removed train: ${trainId}`);

        return true;
    }

    /**
     * Get a train controller by ID
     * @param trainId - Train ID
     * @returns Controller or undefined
     */
    getTrain(trainId: string): TrainController | undefined {
        return this.trains.get(trainId);
    }

    /**
     * Get all train controllers
     * @returns Array of all controllers
     */
    getAllTrains(): TrainController[] {
        return Array.from(this.trains.values());
    }

    /**
     * Get count of registered trains
     * @returns Number of trains
     */
    getTrainCount(): number {
        return this.trains.size;
    }

    // ========================================================================
    // AUTOMATIC TRAIN DETECTION
    // ========================================================================

    /**
     * Scan scene for models that look like trains and register them
     * Uses keywords in mesh names to identify potential trains
     * 
     * @returns Number of trains registered
     */
    scanAndRegisterTrains(): number {
        console.log(`${LOG_PREFIX} Scanning for trains...`);

        const keywords = ['train', 'loco', 'engine', 'coach', 'wagon', 'carriage', 'diesel', 'steam', 'class'];
        let registered = 0;

        // Create edge finder
        const edgeFinder = new TrackEdgeFinder(this.graph);

        // Check all root nodes
        for (const node of this.scene.rootNodes) {
            if (node instanceof TransformNode) {
                // Check if already registered
                if ((node as any).__trainController) continue;

                // Check name for keywords
                const name = node.name.toLowerCase();
                const isLikelyTrain = keywords.some(kw => name.includes(kw));

                if (isLikelyTrain) {
                    // Check if on track
                    const position = node.getAbsolutePosition
                        ? node.getAbsolutePosition()
                        : node.position;

                    const edgeResult = edgeFinder.findNearestEdge(position, { maxDistance: 0.1 });

                    if (edgeResult) {
                        const controller = this.addTrain(node, {
                            name: node.name || `Train ${registered + 1}`,
                            category: 'locomotive'
                        });

                        controller.placeOnEdge(edgeResult.edge.id, edgeResult.t, 1);
                        registered++;

                        console.log(`${LOG_PREFIX}   ✓ Registered: ${node.name}`);
                    } else {
                        console.log(`${LOG_PREFIX}   ⚠ Found "${node.name}" but not on track`);
                    }
                }
            }
        }

        if (registered === 0) {
            console.log(`${LOG_PREFIX}   No new trains found to register`);
        } else {
            console.log(`${LOG_PREFIX}   Registered ${registered} train(s)`);
        }

        return registered;
    }

    // ========================================================================
    // SELECTION
    // ========================================================================

    /**
     * Select a train for control
     * @param trainId - ID of train to select
     * @returns true if train was selected
     */
    selectTrain(trainId: string): boolean {
        const controller = this.trains.get(trainId);
        if (!controller) {
            console.warn(`${LOG_PREFIX} Train ${trainId} not found`);
            return false;
        }

        controller.select();
        return true;
    }

    /**
     * Deselect current train
     */
    deselectTrain(): void {
        if (this.selectedTrain) {
            this.selectedTrain.deselect();
            this.selectedTrain = null;

            // Clear window flags
            (window as any).__trainSelected = false;
            (window as any).__selectedTrainId = null;

            // Notify observers
            this.onSelectionChanged.notifyObservers(null);
        }
    }

    /**
     * Get currently selected train
     * @returns Selected controller or null
     */
    getSelectedTrain(): TrainController | null {
        return this.selectedTrain;
    }

    /**
     * Check if any train is selected
     * @returns true if a train is selected
     */
    hasSelectedTrain(): boolean {
        return this.selectedTrain !== null;
    }

    /**
     * Handle train selected event
     */
    private handleTrainSelected(controller: TrainController): void {
        // Deselect previous
        if (this.selectedTrain && this.selectedTrain !== controller) {
            this.selectedTrain.deselect();
        }

        this.selectedTrain = controller;

        // Set window flags for other systems to check
        (window as any).__trainSelected = true;
        (window as any).__selectedTrainId = controller.getId();

        // Notify observers
        this.onSelectionChanged.notifyObservers(controller);
    }

    /**
     * Handle train deselected event
     */
    private handleTrainDeselected(controller: TrainController): void {
        if (this.selectedTrain === controller) {
            this.selectedTrain = null;

            // Clear window flags
            (window as any).__trainSelected = false;
            (window as any).__selectedTrainId = null;

            // Notify observers
            this.onSelectionChanged.notifyObservers(null);
        }
    }

    // ========================================================================
    // PUBLIC TRAIN LOOKUP (for external systems)
    // ========================================================================

    /**
     * Public method to find a train controller from a mesh
     * 
     * Used by external systems (like ModelImportButton) to check
     * if a clicked mesh belongs to a registered train.
     * 
     * @param mesh - Mesh to check
     * @returns TrainController if found, null otherwise
     */
    findTrainByMesh(mesh: AbstractMesh): TrainController | null {
        return this.findTrainFromMesh(mesh);
    }

    /**
     * Check if a mesh belongs to any registered train
     * Simpler boolean version of findTrainByMesh
     * 
     * @param mesh - Mesh to check
     * @returns true if mesh is part of a train
     */
    isTrainMesh(mesh: AbstractMesh): boolean {
        return this.findTrainFromMesh(mesh) !== null;
    }

    // ========================================================================
    // INPUT HANDLING - KEYBOARD
    // ========================================================================

    /**
     * Setup keyboard controls
     */
    private setupKeyboardControls(): void {
        this.keydownHandler = (event: KeyboardEvent) => {
            this.handleKeyDown(event);
        };

        this.keyupHandler = (event: KeyboardEvent) => {
            this.handleKeyUp(event);
        };

        window.addEventListener('keydown', this.keydownHandler);
        window.addEventListener('keyup', this.keyupHandler);

        console.log(`${LOG_PREFIX} Keyboard controls enabled`);
    }

    /**
     * Handle key down events
     * @param event - Keyboard event
     */
    private handleKeyDown(event: KeyboardEvent): void {
        // Ignore if typing in input field
        if (event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLTextAreaElement ||
            event.target instanceof HTMLSelectElement) {
            return;
        }

        // Ignore if train selection modal is open
        if (isTrainSelectionModalOpen()) {
            return;
        }

        const key = event.key;

        // Track held keys
        this.heldKeys.add(key);

        // Handle controls for selected train
        if (this.selectedTrain) {
            // Throttle up
            if (this.keyboardControls.throttleUp.includes(key)) {
                event.preventDefault();
                this.selectedTrain.increaseThrottle(this.config.throttleStep);
            }
            // Throttle down
            else if (this.keyboardControls.throttleDown.includes(key)) {
                event.preventDefault();
                this.selectedTrain.decreaseThrottle(this.config.throttleStep);
            }
            // Brake
            else if (this.keyboardControls.brake.includes(key)) {
                event.preventDefault();
                this.selectedTrain.applyBrake();
            }
            // Reverse
            else if (this.keyboardControls.reverse.includes(key)) {
                event.preventDefault();
                this.selectedTrain.toggleDirection();
            }
            // Horn
            else if (this.keyboardControls.horn.includes(key)) {
                event.preventDefault();
                this.selectedTrain.soundHorn();
            }
            // Emergency stop
            else if (this.keyboardControls.emergencyStop.includes(key)) {
                event.preventDefault();
                this.selectedTrain.emergencyBrake();
            }
        }
    }

    /**
     * Handle key up events
     * @param event - Keyboard event
     */
    private handleKeyUp(event: KeyboardEvent): void {
        this.heldKeys.delete(event.key);

        // Release brake when space is released
        if (this.selectedTrain && this.keyboardControls.brake.includes(event.key)) {
            this.selectedTrain.releaseBrake();
        }
    }

    // ========================================================================
    // INPUT HANDLING - POINTER (with Modal)
    // ========================================================================

    /**
     * Setup pointer controls for train selection
     */
    private setupPointerControls(): void {
        this.pointerObserver = this.scene.onPointerObservable.add((pointerInfo) => {
            switch (pointerInfo.type) {
                case PointerEventTypes.POINTERDOWN:
                    this.handlePointerDown(pointerInfo);
                    break;
                case PointerEventTypes.POINTERMOVE:
                    this.handlePointerMove(pointerInfo);
                    break;
            }
        });

        console.log(`${LOG_PREFIX} Pointer controls enabled`);
    }

    /**
     * Handle pointer down events
     * 
     * UPDATED v2.0.0: Now shows a modal when clicking on a train
     * User can choose to either:
     *   - Lift & Move (reposition the train)
     *   - Drive (select for keyboard control)
     * 
     * UPDATED v2.1.0: Skip modal if train is already selected for driving
     * or if reposition mode was just requested
     * 
     * @param pointerInfo - Pointer event info
     */
    private handlePointerDown(pointerInfo: any): void {
        const pickResult = pointerInfo.pickInfo;
        if (!pickResult?.hit || !pickResult.pickedMesh) return;

        const mesh = pickResult.pickedMesh;
        const event = pointerInfo.event as PointerEvent;

        // Skip if modal is already open
        if (isTrainSelectionModalOpen()) {
            return;
        }

        // ----------------------------------------------------------------
        // Check if clicked on a train
        // ----------------------------------------------------------------
        const trainController = this.findTrainFromMesh(mesh);
        if (trainController) {
            const trainInfo = trainController.getInfo();

            // ----------------------------------------------------------------
            // v2.1.0: Skip modal if train is already selected for driving
            // This allows continuous control without modal interruption
            // ----------------------------------------------------------------
            if (this.selectedTrain === trainController) {
                console.log(`${LOG_PREFIX} Train "${trainInfo.name}" already selected - continuing drive mode`);
                return;
            }

            // ----------------------------------------------------------------
            // v2.1.1: Skip modal if reposition mode is active
            // This allows the drag operation to proceed without interruption
            // Check is simplified to just the flag - ID matching was too strict
            // ----------------------------------------------------------------
            if ((window as any).__trainRepositionRequested) {
                console.log(`${LOG_PREFIX} Reposition mode active - allowing drag for "${trainInfo.name}"`);
                return;
            }

            // ----------------------------------------------------------------
            // v2.1.1: Skip modal if ModelSelectionHandler is in reposition mode
            // This flag is set when user selects "Reposition" from TrainOptionsMenu
            // ----------------------------------------------------------------
            if ((window as any).__modelRepositionMode) {
                console.log(`${LOG_PREFIX} Model reposition mode active - skipping modal for "${trainInfo.name}"`);
                return;
            }

            console.log(`${LOG_PREFIX} Train clicked: "${trainInfo.name}" - showing selection modal`);

            // Mark that we're handling this click (prevent other systems)
            (window as any).__trainClicked = true;
            setTimeout(() => {
                (window as any).__trainClicked = false;
            }, 100);

            // Show the selection modal
            showTrainSelectionModal(
                {
                    trainId: trainInfo.id,
                    trainName: trainInfo.name,
                    screenX: event.clientX,
                    screenY: event.clientY
                },
                (result: TrainSelectionResult) => {
                    this.handleTrainSelectionResult(result, trainController);
                }
            );

            return;
        }

        // ----------------------------------------------------------------
        // Check if clicked on a point/switch
        // ----------------------------------------------------------------
        const pieceId = this.findTrackPieceFromMesh(mesh);
        if (pieceId && this.pointsManager.isPoint(pieceId)) {
            this.pointsManager.togglePoint(pieceId, true);
            return;
        }

        // ----------------------------------------------------------------
        // Clicked elsewhere - deselect current train (if on baseboard)
        // ----------------------------------------------------------------
        const meshName = mesh.name.toLowerCase();
        if (meshName.includes('baseboard') ||
            meshName.includes('board') ||
            meshName.includes('ground') ||
            meshName.includes('table')) {

            if (this.selectedTrain) {
                console.log(`${LOG_PREFIX} Clicked away - deselecting train`);
                this.deselectTrain();
            }
        }
    }

    /**
     * Handle the result from the train selection modal
     * 
     * @param result - The user's selection
     * @param controller - The train controller that was clicked
     */
    private handleTrainSelectionResult(
        result: TrainSelectionResult,
        controller: TrainController
    ): void {
        console.log(`${LOG_PREFIX} Modal result: ${result.action} for "${result.trainName}"`);

        switch (result.action) {
            case 'drive':
                // Select the train for driving
                console.log(`${LOG_PREFIX} Selecting train "${result.trainName}" for driving`);
                controller.select();

                // Set window flags for other systems
                (window as any).__trainSelected = true;
                (window as any).__selectedTrainId = controller.getId();

                // Emit drive mode event so TrainControlPanel shows
                this.onDriveModeActivated.notifyObservers(controller);
                break;

            case 'move':
                // Emit reposition request for external systems to handle
                console.log(`${LOG_PREFIX} Requesting reposition for "${result.trainName}"`);

                // Set a window flag that ModelImportButton can check
                // Keep this flag active longer so user has time to click and drag
                (window as any).__trainRepositionRequested = true;
                (window as any).__trainToReposition = result.trainId;

                // Get the model ID from the controller's root node
                const modelNode = controller.getRootNode();
                const modelId = (modelNode as any).__modelId ||
                    (modelNode as any).metadata?.modelId ||
                    modelNode.name;

                console.log(`${LOG_PREFIX} Model ID for reposition: ${modelId}`);

                // Dispatch custom event for ModelSelectionHandler to enable drag mode
                // This bridges TrainSystem and ModelSelectionHandler without tight coupling
                window.dispatchEvent(new CustomEvent('trainRepositionRequested', {
                    detail: {
                        modelId: modelId,
                        trainId: result.trainId,
                        trainName: result.trainName,
                        node: modelNode
                    }
                }));

                // Notify observers (like ModelImportButton)
                this.onRepositionRequested.notifyObservers({
                    trainId: result.trainId,
                    trainName: result.trainName,
                    controller: controller
                });

                // Clear the flag after 5 seconds (enough time to start dragging)
                // The flag will also be cleared when the user clicks elsewhere
                setTimeout(() => {
                    (window as any).__trainRepositionRequested = false;
                    (window as any).__trainToReposition = null;
                }, 5000);
                break;

            case 'cancel':
                // User cancelled - do nothing
                console.log(`${LOG_PREFIX} Selection cancelled`);
                break;
        }
    }

    /**
     * Handle pointer move events (hover)
     * @param pointerInfo - Pointer event info
     */
    private handlePointerMove(pointerInfo: any): void {
        // Don't update hover states if modal is open
        if (isTrainSelectionModalOpen()) {
            return;
        }

        const pickResult = pointerInfo.pickInfo;

        // Clear all hover states first
        for (const train of this.trains.values()) {
            train.setHover(false);
        }

        if (!pickResult?.hit || !pickResult.pickedMesh) return;

        const mesh = pickResult.pickedMesh;

        // Check if hovering over a train
        const trainController = this.findTrainFromMesh(mesh);
        if (trainController) {
            trainController.setHover(true);
            // Change cursor to pointer
            const canvas = this.scene.getEngine().getRenderingCanvas();
            if (canvas) {
                canvas.style.cursor = 'pointer';
            }
        } else {
            // Reset cursor
            const canvas = this.scene.getEngine().getRenderingCanvas();
            if (canvas) {
                canvas.style.cursor = 'default';
            }
        }
    }

    /**
     * Find train controller from a mesh (private implementation)
     * @param mesh - Mesh that was picked
     * @returns Controller or null
     */
    private findTrainFromMesh(mesh: AbstractMesh): TrainController | null {
        // Check for direct reference
        if ((mesh as any).__trainController) {
            return (mesh as any).__trainController;
        }

        // Check mesh metadata
        if (mesh.metadata?.trainId) {
            const controller = this.trains.get(mesh.metadata.trainId);
            if (controller) return controller;
        }

        // Check all trains
        for (const train of this.trains.values()) {
            if (train.containsMesh(mesh)) {
                return train;
            }
        }

        // Check parent hierarchy for train markers
        let parent = mesh.parent;
        while (parent) {
            if ((parent as any).__trainId) {
                const controller = this.trains.get((parent as any).__trainId);
                if (controller) return controller;
            }
            if (parent.metadata?.trainId) {
                const controller = this.trains.get(parent.metadata.trainId);
                if (controller) return controller;
            }
            parent = parent.parent;
        }

        return null;
    }

    /**
     * Find track piece ID from a mesh
     * @param mesh - Mesh that was picked
     * @returns Piece ID or null
     */
    private findTrackPieceFromMesh(mesh: AbstractMesh): string | null {
        // The track system stores piece ID on meshes
        if ((mesh as any).__trackPieceId) {
            return (mesh as any).__trackPieceId;
        }

        // Check metadata
        if (mesh.metadata?.trackPieceId) {
            return mesh.metadata.trackPieceId;
        }

        return null;
    }

    // ========================================================================
    // POINTS MANAGEMENT
    // ========================================================================

    /**
     * Get the points manager
     * @returns Points manager instance
     */
    getPointsManager(): PointsManager {
        return this.pointsManager;
    }

    /**
     * Toggle a point's state
     * @param pieceId - ID of the point piece
     * @returns true if point was toggled
     */
    togglePoint(pieceId: string): boolean {
        return this.pointsManager.togglePoint(pieceId);
    }

    /**
     * Setup points detection from track graph
     */
    private setupPointsDetection(): void {
        // Initialize points manager - this scans existing track for switches
        this.pointsManager.initialize();

        // Could add observers for graph changes here if needed
    }

    // ========================================================================
    // UTILITY
    // ========================================================================

    /**
     * Get the track graph
     * @returns Track graph instance
     */
    getGraph(): TrackGraph {
        return this.graph;
    }

    /**
     * Get the track system
     * @returns Track system instance
     */
    getTrackSystem(): TrackSystem {
        return this.trackSystem;
    }
}