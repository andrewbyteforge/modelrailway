/**
 * TrainSystem.ts - Central manager for all train operations
 * 
 * Path: frontend/src/systems/train/TrainSystem.ts
 * 
 * Coordinates multiple trains, handles input, manages selection,
 * and integrates with track and UI systems.
 * 
 * UPDATED: Train selection now differentiates between:
 *   - Click = Select for DRIVING (keyboard controls active)
 *   - Shift+Click = Allow REPOSITIONING (handled by ModelImportButton)
 * 
 * @module TrainSystem
 * @author Model Railway Workbench
 * @version 1.1.0 - Added train selection mode differentiation
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
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║                    TRAIN CONTROLS                          ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log('║  Click train      → Select for DRIVING                     ║');
        console.log('║  Shift+Click      → Select for REPOSITIONING               ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log('║  When driving (train selected):                            ║');
        console.log('║    ↑ / W          → Increase throttle                      ║');
        console.log('║    ↓ / S          → Decrease throttle                      ║');
        console.log('║    R              → Toggle direction (forward/reverse)     ║');
        console.log('║    Space          → Apply brake (hold)                     ║');
        console.log('║    H              → Sound horn                             ║');
        console.log('║    Escape         → Deselect / Emergency brake             ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log('║  Click points     → Toggle switch direction                ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
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

        // Check for duplicate
        if (this.trains.has(trainId)) {
            console.warn(`${LOG_PREFIX} Train ${trainId} already exists, returning existing`);
            return this.trains.get(trainId)!;
        }

        // Create full info
        const fullInfo: TrainInfo = {
            id: trainId,
            name: info.name,
            category: info.category,
            libraryEntryId: info.libraryEntryId
        };

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

        // Subscribe to controller events
        controller.onSelected.add(() => {
            this.handleTrainSelected(controller);
        });

        controller.onDeselected.add(() => {
            this.handleTrainDeselected(controller);
        });

        // Store controller
        this.trains.set(trainId, controller);

        // Mark root node as train root for detection
        (rootNode as any).__isTrainRoot = true;
        (rootNode as any).__trainId = trainId;
        if (!rootNode.metadata) rootNode.metadata = {};
        rootNode.metadata.isTrainRoot = true;
        rootNode.metadata.trainId = trainId;

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
                    const position = node.getAbsolutePosition ?
                        node.getAbsolutePosition() : node.position;

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
     * if a clicked mesh belongs to a registered train. This allows
     * other click handlers to defer to TrainSystem when appropriate.
     * 
     * @param mesh - Mesh to check
     * @returns TrainController if found, null otherwise
     * 
     * @example
     * ```typescript
     * // In ModelImportButton or other click handler:
     * const trainController = trainSystem.findTrainByMesh(clickedMesh);
     * if (trainController) {
     *     // This is a train - let TrainSystem handle it
     *     return;
     * }
     * ```
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
     * 
     * UPDATED: Now checks for Shift key to differentiate between:
     *   - Regular click = Select for DRIVING
     *   - Shift+Click = Allow REPOSITIONING (defer to ModelImportButton)
     * 
     * @param pointerInfo - Pointer event info
     */
    private handlePointerDown(pointerInfo: any): void {
        const pickResult = pointerInfo.pickInfo;
        if (!pickResult?.hit || !pickResult.pickedMesh) return;

        const mesh = pickResult.pickedMesh;
        const event = pointerInfo.event as PointerEvent;

        // ----------------------------------------------------------------
        // Check if clicked on a train
        // ----------------------------------------------------------------
        const trainController = this.findTrainFromMesh(mesh);
        if (trainController) {
            // Check for Shift key - if held, allow repositioning instead of driving
            if (event?.shiftKey) {
                console.log(`${LOG_PREFIX} Shift+Click on train "${trainController.getInfo().name}" - deferring to reposition mode`);
                // Don't select - let ModelImportButton handle it for repositioning
                return;
            }

            // Regular click - select train for DRIVING
            console.log(`${LOG_PREFIX} Selecting train "${trainController.getInfo().name}" for driving`);
            trainController.select();

            // The selection handler will update selectedTrain and notify observers

            // Mark event as handled to prevent other systems from processing
            // Set a flag that other systems can check
            (window as any).__trainSelected = true;
            (window as any).__selectedTrainId = trainController.getId();

            // Clear the flag after a short delay (for async handlers that run after us)
            setTimeout(() => {
                // Only clear if still the same train (prevents race condition)
                if ((window as any).__selectedTrainId === trainController.getId()) {
                    // Keep __trainSelected true while train is selected
                    // It will be cleared when train is deselected
                }
            }, 100);

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

        // Check if hovering over a train
        const trainController = this.findTrainFromMesh(mesh);
        if (trainController) {
            trainController.setHovered(true);
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
     * @returns New state or undefined if not a point
     */
    togglePoint(pieceId: string): PointState | undefined {
        if (!this.pointsManager.isPoint(pieceId)) {
            return undefined;
        }

        this.pointsManager.togglePoint(pieceId, true);
        return this.pointsManager.getPointState(pieceId);
    }

    // ========================================================================
    // UPDATE LOOP
    // ========================================================================

    /**
     * Update all trains
     * Call this from the render loop
     * 
     * @param deltaTime - Time since last update in seconds
     */
    update(deltaTime: number): void {
        // Update all train controllers
        for (const train of this.trains.values()) {
            train.update(deltaTime);
        }
    }

    // ========================================================================
    // DISPOSAL
    // ========================================================================

    /**
     * Clean up resources
     */
    dispose(): void {
        console.log(`${LOG_PREFIX} Disposing...`);

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

        // Clear selection
        this.selectedTrain = null;
        (window as any).__trainSelected = false;
        (window as any).__selectedTrainId = null;

        // Clear observables
        this.onTrainAdded.clear();
        this.onTrainRemoved.clear();
        this.onSelectionChanged.clear();
        this.onPointChanged.clear();

        // Dispose points manager
        this.pointsManager.dispose();

        this.isInitialized = false;

        console.log(`${LOG_PREFIX} ✓ Disposed`);
    }
}