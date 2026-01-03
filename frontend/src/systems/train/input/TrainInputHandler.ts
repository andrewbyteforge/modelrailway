/**
 * TrainInputHandler.ts - Input handling for train control
 * 
 * Path: frontend/src/systems/train/TrainInputHandler.ts
 * 
 * Handles all keyboard and pointer (mouse/touch) input for train
 * selection and control. Uses a delegate pattern to communicate
 * with the main TrainSystem.
 * 
 * Features:
 * - Keyboard controls for throttle, direction, brakes, horn
 * - Pointer controls for train/point selection
 * - Hover state management for visual feedback
 * - Shift+T shortcut for manual train registration
 * 
 * UPDATED: Train selection now uses RIGHT-CLICK for driving controls.
 * - Right-click on train = Select for DRIVING
 * - Left-click on train = Select for properties/outliner
 * - Shift+Click = Allow REPOSITIONING
 * 
 * @module TrainInputHandler
 * @author Model Railway Workbench
 * @version 1.1.0
 */

import { Scene } from '@babylonjs/core/scene';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { TrainController } from '../core/TrainController';
import {
    INPUT_LOG_PREFIX,
    type TrainInputDelegate,
    type TrainInputConfig,
    type TrainKeyboardControls,
    DEFAULT_KEYBOARD_CONTROLS
} from '../core/TrainSystemTypes';

// ============================================================================
// TRAIN INPUT HANDLER CLASS
// ============================================================================

/**
 * TrainInputHandler - Manages keyboard and pointer input for trains
 * 
 * This class is responsible for all user input related to train control.
 * It uses a delegate pattern to communicate actions back to the main
 * TrainSystem, avoiding circular dependencies.
 * 
 * @example
 * ```typescript
 * const inputHandler = new TrainInputHandler(scene, {
 *     getSelectedTrain: () => this.selectedTrain,
 *     deselectTrain: () => this.deselectTrain(),
 *     // ... other delegate methods
 * }, config);
 * 
 * inputHandler.initialize();
 * 
 * // Cleanup
 * inputHandler.dispose();
 * ```
 */
export class TrainInputHandler {
    // ========================================================================
    // PRIVATE STATE
    // ========================================================================

    /** Babylon scene reference */
    private scene: Scene;

    /** Delegate for communicating with TrainSystem */
    private delegate: TrainInputDelegate;

    /** Keyboard controls mapping */
    private keyboardControls: TrainKeyboardControls;

    /** Throttle step for keyboard control */
    private throttleStep: number;

    /** Currently held keys (for key repeat handling) */
    private heldKeys: Set<string> = new Set();

    /** Keyboard event handler reference (for cleanup) */
    private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

    /** Keyboard event handler reference (for cleanup) */
    private keyupHandler: ((e: KeyboardEvent) => void) | null = null;

    /** Pointer observer reference (for cleanup) */
    private pointerObserver: any = null;

    /** Whether the handler has been initialized */
    private isInitialized: boolean = false;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new TrainInputHandler
     * 
     * @param scene - Babylon.js scene
     * @param delegate - Delegate for TrainSystem communication
     * @param config - Input configuration options
     */
    constructor(
        scene: Scene,
        delegate: TrainInputDelegate,
        config?: Partial<TrainInputConfig>
    ) {
        this.scene = scene;
        this.delegate = delegate;

        // Apply configuration with defaults
        this.keyboardControls = config?.keyboardControls ?? { ...DEFAULT_KEYBOARD_CONTROLS };
        this.throttleStep = config?.throttleStep ?? 0.1;

        console.log(`${INPUT_LOG_PREFIX} Input handler created`);
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize input handling
     * 
     * Sets up keyboard and pointer event listeners. Should be called
     * once during TrainSystem initialization.
     * 
     * @param enableKeyboard - Enable keyboard controls
     * @param enablePointer - Enable pointer/mouse controls
     */
    initialize(enableKeyboard: boolean = true, enablePointer: boolean = true): void {
        if (this.isInitialized) {
            console.warn(`${INPUT_LOG_PREFIX} Already initialized`);
            return;
        }

        console.log(`${INPUT_LOG_PREFIX} Initializing...`);

        if (enableKeyboard) {
            this.setupKeyboardControls();
        }

        if (enablePointer) {
            this.setupPointerControls();
        }

        this.isInitialized = true;
        console.log(`${INPUT_LOG_PREFIX} ✓ Initialized`);

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
        console.log('║  Right-click train → Select for DRIVING                    ║');
        console.log('║  Left-click train  → Select for properties/outliner        ║');
        console.log('║  Shift+Click       → Select for REPOSITIONING              ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log('║  When driving (train selected via right-click):            ║');
        console.log('║    ↑ / W          → Increase throttle                      ║');
        console.log('║    ↓ / S          → Decrease throttle                      ║');
        console.log('║    R              → Toggle direction (forward/reverse)     ║');
        console.log('║    Space          → Apply brake (hold)                     ║');
        console.log('║    H              → Sound horn                             ║');
        console.log('║    Escape         → Deselect / Emergency brake             ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log('║  Right-click point → Toggle switch direction               ║');
        console.log('║  Shift+T           → Scan & register trains on track       ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log('');
    }

    // ========================================================================
    // KEYBOARD CONTROLS
    // ========================================================================

    /**
     * Setup keyboard event listeners
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

        console.log(`${INPUT_LOG_PREFIX} Keyboard controls enabled`);
    }

    /**
     * Handle key down events
     * 
     * Processes keyboard input for train control including throttle,
     * direction, brakes, and horn. Also handles Shift+T for manual
     * train registration.
     * 
     * @param event - Keyboard event
     */
    private handleKeyDown(event: KeyboardEvent): void {
        // ----------------------------------------------------------------
        // Ignore if typing in input field
        // ----------------------------------------------------------------
        if (event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLTextAreaElement ||
            event.target instanceof HTMLSelectElement) {
            return;
        }

        const key = event.key;

        // Track held keys
        this.heldKeys.add(key);

        // ----------------------------------------------------------------
        // Handle controls for selected train
        // ----------------------------------------------------------------
        const selectedTrain = this.delegate.getSelectedTrain();

        if (selectedTrain) {
            // Throttle up
            if (this.keyboardControls.throttleUp.includes(key)) {
                event.preventDefault();
                selectedTrain.increaseThrottle(this.throttleStep);
                return;
            }

            // Throttle down
            if (this.keyboardControls.throttleDown.includes(key)) {
                event.preventDefault();
                selectedTrain.decreaseThrottle(this.throttleStep);
                return;
            }

            // Toggle direction
            if (this.keyboardControls.reverseDirection.includes(key)) {
                event.preventDefault();
                selectedTrain.toggleDirection();
                return;
            }

            // Brake
            if (this.keyboardControls.brake.includes(key)) {
                event.preventDefault();
                selectedTrain.applyBrake();
                return;
            }

            // Emergency brake
            if (this.keyboardControls.emergencyBrake.includes(key)) {
                event.preventDefault();
                selectedTrain.emergencyBrake();
                return;
            }

            // Horn
            if (this.keyboardControls.horn.includes(key)) {
                event.preventDefault();
                selectedTrain.soundHorn();
                return;
            }
        }

        // ----------------------------------------------------------------
        // Deselect (works even without selected train)
        // ----------------------------------------------------------------
        if (this.keyboardControls.deselect.includes(key)) {
            if (selectedTrain) {
                event.preventDefault();
                this.delegate.deselectTrain();
            }
        }

        // ----------------------------------------------------------------
        // Shift+T: Manual train registration
        // ----------------------------------------------------------------
        if ((key === 't' || key === 'T') && event.shiftKey) {
            event.preventDefault();
            console.log(`${INPUT_LOG_PREFIX} Shift+T pressed - scanning for trains...`);
            const count = this.delegate.scanAndRegisterTrains();
            console.log(`${INPUT_LOG_PREFIX} Registered ${count} train(s)`);
        }
    }

    /**
     * Handle key up events
     * 
     * @param event - Keyboard event
     */
    private handleKeyUp(event: KeyboardEvent): void {
        const key = event.key;
        this.heldKeys.delete(key);

        // Release brake when space is released
        const selectedTrain = this.delegate.getSelectedTrain();
        if (selectedTrain && this.keyboardControls.brake.includes(key)) {
            selectedTrain.releaseBrake();
        }
    }

    // ========================================================================
    // POINTER CONTROLS
    // ========================================================================

    /**
     * Setup pointer (mouse/touch) event listeners
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

        console.log(`${INPUT_LOG_PREFIX} Pointer controls enabled`);
    }

    /**
     * Handle pointer down events
     * 
     * UPDATED: Now uses RIGHT-CLICK (button 2) for train driving selection.
     * 
     * Controls:
     *   - Right-click on train = Select for DRIVING (shows control panel)
     *   - Shift+Right-click = Allow REPOSITIONING (defer to ModelImportButton)
     *   - Right-click on points/switches = Toggle switch direction
     *   - Right-click on baseboard = Deselect current train
     * 
     * @param pointerInfo - Pointer event info from Babylon.js
     */
    private handlePointerDown(pointerInfo: any): void {
        const pickResult = pointerInfo.pickInfo;
        if (!pickResult?.hit || !pickResult.pickedMesh) return;

        const mesh = pickResult.pickedMesh as AbstractMesh;
        const event = pointerInfo.event as PointerEvent;

        // ================================================================
        // UPDATED: Only respond to RIGHT-CLICK (button 2) for driving
        // Left-click is for general selection (outliner/properties)
        // ================================================================
        if (event?.button !== 2) {
            // Not a right-click - ignore for train driving
            return;
        }

        // ----------------------------------------------------------------
        // Check if right-clicked on a train
        // ----------------------------------------------------------------
        const trainController = this.delegate.findTrainFromMesh(mesh);
        if (trainController) {
            // Check for Shift key - if held, allow repositioning instead of driving
            if (event?.shiftKey) {
                console.log(`${INPUT_LOG_PREFIX} Shift+Right-Click on train "${trainController.getInfo().name}" - deferring to reposition mode`);
                // Don't select - let ModelImportButton handle it for repositioning
                return;
            }

            // Right-click without Shift - select train for DRIVING
            console.log(`${INPUT_LOG_PREFIX} Right-Click: Selecting train "${trainController.getInfo().name}" for driving`);
            trainController.select();

            // Mark event as handled to prevent other systems from processing
            (window as any).__trainSelected = true;
            (window as any).__selectedTrainId = trainController.getInfo().id;

            // Prevent the context menu from appearing
            event.preventDefault();

            // Clear the flag after a short delay (for async handlers)
            setTimeout(() => {
                if ((window as any).__selectedTrainId === trainController.getInfo().id) {
                    // Keep __trainSelected true while train is selected
                }
            }, 100);

            return;
        }

        // ----------------------------------------------------------------
        // Check if right-clicked on a point/switch
        // ----------------------------------------------------------------
        const pieceId = this.delegate.findTrackPieceFromMesh(mesh);
        if (pieceId && this.delegate.isPoint(pieceId)) {
            console.log(`${INPUT_LOG_PREFIX} Right-Click: Toggling point "${pieceId}"`);
            this.delegate.togglePoint(pieceId, true);
            event.preventDefault(); // Prevent context menu
            return;
        }

        // ----------------------------------------------------------------
        // Right-clicked elsewhere - deselect current train (if on baseboard)
        // ----------------------------------------------------------------
        const meshName = mesh.name.toLowerCase();
        if (meshName.includes('baseboard') ||
            meshName.includes('board') ||
            meshName.includes('ground') ||
            meshName.includes('table')) {

            const selectedTrain = this.delegate.getSelectedTrain();
            if (selectedTrain) {
                console.log(`${INPUT_LOG_PREFIX} Right-Click on baseboard - deselecting train`);
                this.delegate.deselectTrain();
                event.preventDefault(); // Prevent context menu
            }
        }
    }

    /**
     * Handle pointer move events (hover)
     * 
     * Updates hover state on trains for visual feedback.
     * 
     * @param pointerInfo - Pointer event info from Babylon.js
     */
    private handlePointerMove(pointerInfo: any): void {
        const pickResult = pointerInfo.pickInfo;

        // Clear all hover states first
        for (const train of this.delegate.getAllTrains()) {
            train.setHover(false);
        }

        if (!pickResult?.hit || !pickResult.pickedMesh) return;

        const mesh = pickResult.pickedMesh as AbstractMesh;

        // Check if hovering over a train
        const trainController = this.delegate.findTrainFromMesh(mesh);
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

    // ========================================================================
    // PUBLIC METHODS
    // ========================================================================

    /**
     * Check if a key is currently held down
     * 
     * @param key - Key to check
     * @returns true if key is held
     */
    isKeyHeld(key: string): boolean {
        return this.heldKeys.has(key);
    }

    /**
     * Clear all held keys
     * 
     * Useful when window loses focus or for resetting state.
     */
    clearHeldKeys(): void {
        this.heldKeys.clear();
    }

    /**
     * Update keyboard controls mapping
     * 
     * @param controls - New control mappings (partial update supported)
     */
    updateKeyboardControls(controls: Partial<TrainKeyboardControls>): void {
        this.keyboardControls = {
            ...this.keyboardControls,
            ...controls
        };
        console.log(`${INPUT_LOG_PREFIX} Keyboard controls updated`);
    }

    // ========================================================================
    // DISPOSAL
    // ========================================================================

    /**
     * Clean up all event listeners
     * 
     * Should be called when the TrainSystem is disposed.
     */
    dispose(): void {
        console.log(`${INPUT_LOG_PREFIX} Disposing...`);

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

        // Clear state
        this.heldKeys.clear();
        this.isInitialized = false;

        console.log(`${INPUT_LOG_PREFIX} ✓ Disposed`);
    }
}