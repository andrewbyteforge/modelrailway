/**
 * TrainSystem.ts - Main coordination system for all train operations
 * 
 * Path: frontend/src/systems/train/TrainSystem.ts
 * 
 * High-level system that manages:
 * - All trains in the layout
 * - Train selection and control delegation
 * - Points/switch management
 * - Input handling for train control
 * - UI integration for control panels
 * - Update loop coordination
 * 
 * This is the main entry point for train functionality.
 * 
 * @module TrainSystem
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Observable } from '@babylonjs/core/Misc/observable';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { TrainController, type TrainInfo, type TrainState } from './TrainController';
import { PointsManager, type PointState, type PointData } from './PointsManager';
import { TrainSoundManager } from './TrainSoundManager';
import { TrackEdgeFinder } from './TrackEdgeFinder';
import type { TrackSystem } from '../track/TrackSystem';
import type { TrackGraph } from '../track/TrackGraph';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[TrainSystem]';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Train system configuration
 */
export interface TrainSystemConfig {
    /** Enable train sounds */
    enableSound: boolean;

    /** Enable keyboard controls */
    enableKeyboardControls: boolean;

    /** Enable mouse/pointer controls */
    enablePointerControls: boolean;

    /** Throttle step for keyboard controls */
    throttleStep: number;
}

/**
 * Keyboard control mapping
 */
export interface TrainKeyboardControls {
    /** Increase throttle */
    throttleUp: string[];

    /** Decrease throttle */
    throttleDown: string[];

    /** Toggle direction */
    reverseDirection: string[];

    /** Apply brake */
    brake: string[];

    /** Emergency brake */
    emergencyBrake: string[];

    /** Sound horn */
    horn: string[];

    /** Deselect train */
    deselect: string[];
}

/**
 * Default keyboard controls
 */
const DEFAULT_KEYBOARD_CONTROLS: TrainKeyboardControls = {
    throttleUp: ['ArrowUp', 'w', 'W'],
    throttleDown: ['ArrowDown', 's', 'S'],
    reverseDirection: ['r', 'R'],
    brake: [' '], // Space
    emergencyBrake: ['Escape'],
    horn: ['h', 'H'],
    deselect: ['Escape']
};

// ============================================================================
// TRAIN SYSTEM CLASS
// ============================================================================

/**
 * TrainSystem - Central manager for all train operations
 * 
 * Coordinates multiple trains, handles input, manages selection,
 * and integrates with track and UI systems.
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
    public onPointChanged: Observable<PointData> = new Observable();

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

        // Apply default config
        this.config = {
            enableSound: true,
            enableKeyboardControls: true,
            enablePointerControls: true,
            throttleStep: 0.1,
            ...config
        };

        this.keyboardControls = { ...DEFAULT_KEYBOARD_CONTROLS };

        // Create points manager
        this.pointsManager = new PointsManager(scene, trackSystem);

        // Create global sound manager for UI sounds (points, etc.)
        this.globalSoundManager = new TrainSoundManager(scene);

        console.log(`${LOG_PREFIX} Train system created`);
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the train system
     * Sets up input handlers, scans for existing trains, etc.
     */
    initialize(): void {
        if (this.isInitialized) {
            console.warn(`${LOG_PREFIX} Already initialized`);
            return;
        }

        console.log(`${LOG_PREFIX} Initializing...`);

        // Initialize points manager
        this.pointsManager.initialize();

        // Setup point change listener
        this.pointsManager.onPointChanged.add((event) => {
            // Play sound
            this.globalSoundManager.playPointsSound();

            // Forward to our observable
            const pointData = this.pointsManager.getPointData(event.pieceId);
            if (pointData) {
                this.onPointChanged.notifyObservers(pointData);
            }
        });

        // Setup input handlers
        if (this.config.enableKeyboardControls) {
            this.setupKeyboardControls();
        }

        if (this.config.enablePointerControls) {
            this.setupPointerControls();
        }

        this.isInitialized = true;
        console.log(`${LOG_PREFIX} ✓ Initialized`);

        // Log controls help
        this.logControlsHelp();
    }

    /**
     * Log controls help to console
     */
    private logControlsHelp(): void {
        console.log('');
        console.log('=== Train Controls ===');
        console.log('  Click train → Select for control');
        console.log('  ↑/W → Increase throttle');
        console.log('  ↓/S → Decrease throttle');
        console.log('  R → Toggle direction (forward/reverse)');
        console.log('  Space → Apply brake');
        console.log('  H → Sound horn');
        console.log('  Click points → Toggle switch direction');
        console.log('  Escape → Deselect / Emergency brake');
        console.log('====================');
        console.log('');
    }

    // ========================================================================
    // TRAIN MANAGEMENT
    // ========================================================================

    /**
     * Add a train to the system
     * @param rootNode - Root transform node of the train model
     * @param info - Train identification info
     * @param config - Optional controller configuration
     * @returns The created TrainController
     */
    addTrain(
        rootNode: TransformNode,
        info: Omit<TrainInfo, 'id'> & { id?: string },
        config?: Partial<import('./TrainController').TrainControllerConfig>
    ): TrainController {
        // Generate ID if not provided
        const trainId = info.id || `train_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const fullInfo: TrainInfo = {
            ...info,
            id: trainId,
            category: info.category || 'locomotive'
        };

        // Check for duplicate ID
        if (this.trains.has(trainId)) {
            console.warn(`${LOG_PREFIX} Train with ID ${trainId} already exists`);
            return this.trains.get(trainId)!;
        }

        // Create controller
        const controller = new TrainController(
            this.scene,
            this.graph,
            this.pointsManager,
            rootNode,
            fullInfo,
            {
                enableSound: this.config.enableSound,
                ...config
            }
        );

        // Register train
        this.trains.set(trainId, controller);

        // Setup controller event listeners
        this.setupControllerListeners(controller);

        // Notify observers
        this.onTrainAdded.notifyObservers(controller);

        console.log(`${LOG_PREFIX} Added train: ${fullInfo.name} (${trainId})`);
        return controller;
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

        // Remove from registry
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
     * @returns Array of controllers
     */
    getAllTrains(): TrainController[] {
        return Array.from(this.trains.values());
    }

    /**
     * Get all train states
     * @returns Array of train states
     */
    getAllTrainStates(): TrainState[] {
        return this.getAllTrains().map(t => t.getState());
    }

    /**
     * Setup event listeners for a controller
     * @param controller - The controller
     */
    private setupControllerListeners(controller: TrainController): void {
        // Listen for selection events
        controller.onSelected.add(() => {
            // Deselect previous train
            if (this.selectedTrain && this.selectedTrain !== controller) {
                this.selectedTrain.deselect();
            }
            this.selectedTrain = controller;
            this.onSelectionChanged.notifyObservers(controller);
        });

        controller.onDeselected.add(() => {
            if (this.selectedTrain === controller) {
                this.selectedTrain = null;
                this.onSelectionChanged.notifyObservers(null);
            }
        });
    }

    /**
     * Register an existing model as a train
     * Use this for models that were imported before TrainSystem was ready,
     * or for models imported through other means.
     * 
     * @param rootNode - Root transform node of the model
     * @param name - Train name
     * @param edgeId - Optional edge to place on (if on track)
     * @param t - Optional parametric position on edge
     * @returns The created TrainController
     * 
     * @example
     * ```typescript
     * // Register an existing model
     * const controller = trainSystem.registerExistingModel(
     *     existingModelNode,
     *     'My Locomotive',
     *     'edge_123',  // optional
     *     0.5          // optional
     * );
     * ```
     */
    registerExistingModel(
        rootNode: TransformNode,
        name: string,
        edgeId?: string,
        t?: number
    ): TrainController {
        // Add as train
        const controller = this.addTrain(rootNode, {
            name: name,
            category: 'locomotive'
        });

        // Place on edge if provided
        if (edgeId) {
            controller.placeOnEdge(edgeId, t ?? 0.5, 1);
        }

        console.log(`${LOG_PREFIX} Registered existing model "${name}" as train`);
        return controller;
    }

    /**
     * Debug helper - list all registered trains
     */
    debugListTrains(): void {
        console.log(`${LOG_PREFIX} === Registered Trains ===`);
        if (this.trains.size === 0) {
            console.log(`${LOG_PREFIX}   (no trains registered)`);
            console.log(`${LOG_PREFIX}   Tip: Use trainSystem.addTrain() or trainSystem.registerExistingModel()`);
        } else {
            for (const [id, train] of this.trains) {
                const info = train.getInfo();
                const state = train.getState();
                console.log(`${LOG_PREFIX}   - ${info.name} (${id})`);
                console.log(`${LOG_PREFIX}     Selected: ${state.isSelected}, OnTrack: ${state.isOnTrack}`);
            }
        }
        console.log(`${LOG_PREFIX} =========================`);
    }

    /**
     * Scan scene for meshes that might be trains and register them
     * This is a helper for registering models that were imported before
     * the train system was connected.
     * 
     * Looks for root meshes/transform nodes with names containing train-related keywords.
     * 
     * @param keywords - Keywords to look for in mesh names (default: train-related words)
     * @returns Number of trains registered
     */
    scanAndRegisterTrains(keywords?: string[]): number {
        const searchTerms = keywords || [
            'train', 'loco', 'locomotive', 'engine', 'diesel', 'steam', 'electric',
            'coach', 'carriage', 'wagon', 'freight', 'tanker', 'hopper', 'boxcar',
            'class', 'hst', 'dmu', 'emu', 'shunter'
        ];

        console.log(`${LOG_PREFIX} Scanning scene for train models...`);

        // Create edge finder for track detection
        const edgeFinder = new TrackEdgeFinder(this.graph);

        let registered = 0;
        const rootNodes = this.scene.rootNodes;

        for (const node of rootNodes) {
            // Skip non-TransformNodes
            if (!(node instanceof TransformNode)) continue;

            // Skip if already registered
            let alreadyRegistered = false;
            for (const train of this.trains.values()) {
                if (train.getRootNode() === node) {
                    alreadyRegistered = true;
                    break;
                }
            }
            if (alreadyRegistered) continue;

            // Check if name matches any keyword
            const nodeName = node.name.toLowerCase();
            const isMatch = searchTerms.some(term => nodeName.includes(term.toLowerCase()));

            if (isMatch) {
                // Try to find an edge near this model
                const position = node.getAbsolutePosition ? node.getAbsolutePosition() : node.position;

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

        const key = event.key;

        // Track held keys
        this.heldKeys.add(key);

        // Handle controls for selected train
        if (this.selectedTrain) {
            // Throttle up
            if (this.keyboardControls.throttleUp.includes(key)) {
                event.preventDefault();
                this.selectedTrain.increaseThrottle(this.config.throttleStep);
                return;
            }

            // Throttle down
            if (this.keyboardControls.throttleDown.includes(key)) {
                event.preventDefault();
                this.selectedTrain.decreaseThrottle(this.config.throttleStep);
                return;
            }

            // Toggle direction
            if (this.keyboardControls.reverseDirection.includes(key)) {
                event.preventDefault();
                this.selectedTrain.toggleDirection();
                return;
            }

            // Brake
            if (this.keyboardControls.brake.includes(key)) {
                event.preventDefault();
                this.selectedTrain.applyBrake();
                return;
            }

            // Emergency brake
            if (this.keyboardControls.emergencyBrake.includes(key)) {
                event.preventDefault();
                this.selectedTrain.emergencyBrake();
                return;
            }

            // Horn
            if (this.keyboardControls.horn.includes(key)) {
                event.preventDefault();
                this.selectedTrain.soundHorn();
                return;
            }
        }

        // Deselect (works even without selected train)
        if (this.keyboardControls.deselect.includes(key)) {
            if (this.selectedTrain) {
                event.preventDefault();
                this.deselectTrain();
            }
        }
    }

    /**
     * Handle key up events
     * @param event - Keyboard event
     */
    private handleKeyUp(event: KeyboardEvent): void {
        const key = event.key;
        this.heldKeys.delete(key);

        // Release brake when space is released
        if (this.selectedTrain && this.keyboardControls.brake.includes(key)) {
            this.selectedTrain.releaseBrake();
        }
    }

    // ========================================================================
    // INPUT HANDLING - POINTER
    // ========================================================================

    /**
     * Setup pointer (mouse/touch) controls
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
     * @param pointerInfo - Pointer event info
     */
    private handlePointerDown(pointerInfo: any): void {
        const pickResult = pointerInfo.pickInfo;
        if (!pickResult?.hit || !pickResult.pickedMesh) return;

        const mesh = pickResult.pickedMesh;

        // Check if clicked on a train
        const trainController = this.findTrainFromMesh(mesh);
        if (trainController) {
            trainController.select();
            return;
        }

        // Check if clicked on a point/switch
        const pieceId = this.findTrackPieceFromMesh(mesh);
        if (pieceId && this.pointsManager.isPoint(pieceId)) {
            this.pointsManager.togglePoint(pieceId, true);
            return;
        }
    }

    /**
     * Handle pointer move events (hover)
     * @param pointerInfo - Pointer event info
     */
    private handlePointerMove(pointerInfo: any): void {
        const pickResult = pointerInfo.pickInfo;

        // Clear all hover states first
        for (const train of this.trains.values()) {
            train.setHovered(false);
        }

        if (!pickResult?.hit || !pickResult.pickedMesh) return;

        const mesh = pickResult.pickedMesh;

        // Debug logging (remove once working)
        // console.log(`${LOG_PREFIX} Hover over mesh: ${mesh.name}`);

        // Check if hovering over a train
        const trainController = this.findTrainFromMesh(mesh);
        if (trainController) {
            trainController.setHovered(true);
            // Change cursor to pointer
            this.scene.getEngine().getRenderingCanvas()!.style.cursor = 'pointer';
        } else {
            // Reset cursor
            this.scene.getEngine().getRenderingCanvas()!.style.cursor = 'default';
        }
    }

    /**
     * Find train controller from a mesh
     * @param mesh - Mesh that was picked
     * @returns Controller or null
     */
    private findTrainFromMesh(mesh: AbstractMesh): TrainController | null {
        // Check for direct reference
        if ((mesh as any).__trainController) {
            return (mesh as any).__trainController;
        }

        // Check all trains
        for (const train of this.trains.values()) {
            if (train.containsMesh(mesh)) {
                return train;
            }
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
     * @param pieceId - ID of the switch piece
     * @returns New state or null
     */
    togglePoint(pieceId: string): PointState | null {
        return this.pointsManager.togglePoint(pieceId, true);
    }

    /**
     * Set a point's state
     * @param pieceId - ID of the switch piece
     * @param state - Desired state
     * @returns true if state was changed
     */
    setPointState(pieceId: string, state: PointState): boolean {
        return this.pointsManager.setPointState(pieceId, state, true);
    }

    /**
     * Get all points data
     * @returns Array of point data
     */
    getAllPoints(): PointData[] {
        return this.pointsManager.getAllPoints();
    }

    // ========================================================================
    // UPDATE LOOP
    // ========================================================================

    /**
     * Update all trains - call every frame
     * @param deltaTime - Time since last frame in seconds
     */
    update(deltaTime: number): void {
        // Update all trains
        for (const train of this.trains.values()) {
            train.update(deltaTime);
        }
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Dispose of train system and all resources
     */
    dispose(): void {
        // Remove input handlers
        if (this.keydownHandler) {
            window.removeEventListener('keydown', this.keydownHandler);
        }
        if (this.keyupHandler) {
            window.removeEventListener('keyup', this.keyupHandler);
        }
        if (this.pointerObserver) {
            this.scene.onPointerObservable.remove(this.pointerObserver);
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

        this.selectedTrain = null;
        this.isInitialized = false;

        console.log(`${LOG_PREFIX} Disposed`);
    }
}