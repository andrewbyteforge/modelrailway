/**
 * InputHandler.ts - User Input Handler
 * 
 * Path: frontend/src/core/InputHandler.ts
 * 
 * Handles all user input including:
 * - Pointer events (click, move) for track placement
 * - Keyboard shortcuts for rotation, deletion, camera
 * - Snap preview during track placement
 * - Selection rotation animation
 * - UI toggle coordination
 * 
 * @module InputHandler
 */

import { Scene } from '@babylonjs/core/scene';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';

import { TrackSystem } from '../systems/track/TrackSystem';
import { BaseboardSystem } from '../systems/baseboard/BaseboardSystem';
import { CameraSystem } from '../systems/camera/CameraSystem';
import { UIManager } from '../ui/UIManager';
import { InputManager } from '../ui/InputManager';
import { TrainSystem } from '../systems/train/TrainSystem';
import { TrainIntegration } from '../systems/train/TrainIntegration';
import { WorldOutliner } from '../systems/outliner/WorldOutliner';
import { OutlinerManager } from './OutlinerManager';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Dependencies required by InputHandler
 */
export interface InputHandlerDependencies {
    /** Babylon.js scene */
    scene: Scene;
    /** HTML canvas element */
    canvas: HTMLCanvasElement;
    /** Track system for placement */
    trackSystem: TrackSystem | null;
    /** Baseboard system for surface detection */
    baseboardSystem: BaseboardSystem | null;
    /** Camera system for mode toggling */
    cameraSystem: CameraSystem | null;
    /** UI manager for toggle states */
    uiManager: UIManager | null;
    /** Input/selection manager */
    inputManager: InputManager | null;
    /** Train system for controls */
    trainSystem: TrainSystem | null;
    /** Train integration for model registration */
    trainIntegration: TrainIntegration | null;
    /** Outliner manager for selection sync */
    outlinerManager: OutlinerManager | null;
    /** Function to get current placement mode */
    getPlacementMode: () => string | null;
    /** Function to set placement mode */
    setPlacementMode: (mode: string | null) => void;
    /** Callback for track placement */
    onTrackPlaced?: (piece: any) => void;
}

/**
 * Callback for test track placement
 */
export type TestTracksCallback = () => void;

// ============================================================================
// INPUT HANDLER CLASS
// ============================================================================

/**
 * Handles all user input for the Model Railway Workbench.
 * 
 * Manages:
 * - Pointer events for track placement and selection
 * - Keyboard shortcuts for rotation, deletion, and controls
 * - Snap preview visualization during placement
 * - Smooth rotation animations
 * 
 * @example
 * ```typescript
 * const inputHandler = new InputHandler(dependencies);
 * inputHandler.initialize();
 * inputHandler.setTestTracksCallback(placeTestTracks);
 * ```
 */
export class InputHandler {
    // ========================================================================
    // DEPENDENCIES
    // ========================================================================

    private scene: Scene;
    private canvas: HTMLCanvasElement;
    private trackSystem: TrackSystem | null;
    private baseboardSystem: BaseboardSystem | null;
    private cameraSystem: CameraSystem | null;
    private uiManager: UIManager | null;
    private inputManager: InputManager | null;
    private trainSystem: TrainSystem | null = null;
    private trainIntegration: TrainIntegration | null;
    private outlinerManager: OutlinerManager | null;
    private getPlacementMode: () => string | null;
    private setPlacementMode: (mode: string | null) => void;
    private onTrackPlaced?: (piece: any) => void;

    // ========================================================================
    // STATE
    // ========================================================================

    /** Track mouse position for click vs drag detection */
    private pointerDownPos: { x: number; y: number } | null = null;

    /** Pixels - movement beyond this is considered a drag, not a click */
    private readonly DRAG_THRESHOLD = 5;

    /** Callback for placing test tracks */
    private testTracksCallback: TestTracksCallback | null = null;

    /** Flag to prevent multiple simultaneous scan operations */
    private isScanning: boolean = false;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Creates a new InputHandler instance.
     * 
     * @param dependencies - Required dependencies for input handling
     */
    constructor(dependencies: InputHandlerDependencies) {
        this.scene = dependencies.scene;
        this.canvas = dependencies.canvas;
        this.trackSystem = dependencies.trackSystem;
        this.baseboardSystem = dependencies.baseboardSystem;
        this.cameraSystem = dependencies.cameraSystem;
        this.uiManager = dependencies.uiManager;
        this.inputManager = dependencies.inputManager;
        this.trainSystem = dependencies.trainSystem;
        this.trainIntegration = dependencies.trainIntegration;
        this.outlinerManager = dependencies.outlinerManager;
        this.getPlacementMode = dependencies.getPlacementMode;
        this.setPlacementMode = dependencies.setPlacementMode;
        this.onTrackPlaced = dependencies.onTrackPlaced;
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize input handling.
     * 
     * Sets up:
     * - Pointer events for track placement
     * - Keyboard shortcuts via Babylon.js observable
     * - Fallback keyboard handler for Delete/Backspace
     * - UI toggle callbacks
     */
    initialize(): void {
        try {
            console.log('[InputHandler] Initializing input handling...');

            // Setup pointer events for track placement
            this.setupPointerEvents();

            // Setup keyboard shortcuts
            this.setupKeyboardShortcuts();

            // Setup UI toggle callbacks
            this.setupUIToggles();

            // Log control instructions
            this.logControlInstructions();

            console.log('[InputHandler] ✓ Input handling initialized');

        } catch (error) {
            console.error('[InputHandler] Initialization error:', error);
            throw error;
        }
    }

    // ========================================================================
    // TEST TRACKS CALLBACK
    // ========================================================================

    /**
     * Set the callback for placing test tracks (T key).
     * 
     * @param callback - Function to call when T is pressed
     */
    setTestTracksCallback(callback: TestTracksCallback): void {
        this.testTracksCallback = callback;
    }

    // ========================================================================
    // UI TOGGLES
    // ========================================================================

    /**
     * Setup UI toggle button callbacks.
     */
    private setupUIToggles(): void {
        if (!this.uiManager || !this.trackSystem) return;

        // Connection Indicators toggle
        this.uiManager.registerToggleCallback('connectionIndicators', (enabled) => {
            if (this.trackSystem) {
                this.trackSystem.setConnectionIndicators(enabled);
            }
        });

        // Auto-Snap toggle
        this.uiManager.registerToggleCallback('autoSnap', (enabled) => {
            if (this.trackSystem) {
                this.trackSystem.setAutoSnap(enabled);
            }
        });

        console.log('[InputHandler] ✓ UI toggle callbacks registered');
    }

    // ========================================================================
    // POINTER EVENTS
    // ========================================================================

    /**
     * Setup pointer event handlers for track placement and interaction.
     */
    private setupPointerEvents(): void {
        try {
            // Track mousedown position for click vs drag detection
            this.canvas.addEventListener('pointerdown', (event: PointerEvent) => {
                if (event.button === 0) { // Left button only
                    this.pointerDownPos = { x: event.clientX, y: event.clientY };
                }
            });

            // On pointerup, check if it was a click or drag
            this.canvas.addEventListener('pointerup', (event: PointerEvent) => {
                if (event.button !== 0 || !this.pointerDownPos) return;

                // Calculate distance moved
                const dx = event.clientX - this.pointerDownPos.x;
                const dy = event.clientY - this.pointerDownPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Clear the stored position
                this.pointerDownPos = null;

                // If moved too much, it was a drag (camera movement), not a click
                if (distance > this.DRAG_THRESHOLD) {
                    return;
                }

                // It was a click - handle track placement
                this.handleCanvasClick(event);
            });

            // Mousemove for snap preview during placement mode
            this.canvas.addEventListener('pointermove', (event: PointerEvent) => {
                this.handlePointerMove(event);
            });

            // Right-click to cancel placement mode
            this.canvas.addEventListener('contextmenu', (event: MouseEvent) => {
                const placementMode = this.getPlacementMode();
                if (placementMode) {
                    event.preventDefault(); // Prevent context menu
                    this.cancelPlacementMode();
                }
            });

            console.log('[InputHandler] ✓ Pointer events configured');

        } catch (error) {
            console.error('[InputHandler] Error setting up pointer events:', error);
        }
    }

    /**
     * Handle pointer move for snap preview during placement mode.
     * 
     * @param event - Pointer move event
     */
    private handlePointerMove(event: PointerEvent): void {
        const placementMode = this.getPlacementMode();

        // Only handle in placement mode
        if (!placementMode || !this.trackSystem || !this.baseboardSystem) {
            return;
        }

        try {
            // Get board intersection point
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            const camera = this.scene.activeCamera;
            if (!camera) return;

            const ray = this.scene.createPickingRay(x, y, null, camera);
            const baseboard = this.baseboardSystem.getBaseboard();
            if (!baseboard) return;

            const intersection = ray.intersectsMesh(baseboard);

            if (intersection.hit && intersection.pickedPoint) {
                const boardY = this.baseboardSystem.getBoardTopY();
                const position = new Vector3(
                    intersection.pickedPoint.x,
                    boardY,
                    intersection.pickedPoint.z
                );

                // Check for snap preview
                const snapPreview = this.trackSystem.getSnapPreview(
                    placementMode,
                    position,
                    Quaternion.Identity()
                );

                if (snapPreview) {
                    // Show snap preview indicator
                    this.trackSystem.showSnapPreview(snapPreview.connectorPos);
                } else {
                    // Hide snap preview
                    this.trackSystem.hideSnapPreview();
                }
            } else {
                // Not over board, hide preview
                this.trackSystem.hideSnapPreview();
            }

        } catch (error) {
            // Don't log errors on every mouse move
        }
    }

    /**
     * Handle canvas click for track placement.
     * Only called for actual clicks (not drags).
     * 
     * @param event - Pointer event
     */
    private handleCanvasClick(event: PointerEvent): void {
        try {
            // Only handle left click
            if (event.button !== 0) return;

            const placementMode = this.getPlacementMode();

            console.log(`[InputHandler] Canvas click at (${event.clientX}, ${event.clientY})`);
            console.log(`[InputHandler] Placement mode: ${placementMode || 'none'}`);

            // If not in placement mode, ignore
            if (!placementMode) {
                console.log('[InputHandler] Not in placement mode, ignoring click');
                return;
            }

            if (!this.trackSystem || !this.baseboardSystem) {
                console.error('[InputHandler] Systems not initialized');
                return;
            }

            // Get the baseboard mesh
            const baseboard = this.baseboardSystem.getBaseboard();
            if (!baseboard) {
                console.error('[InputHandler] No baseboard mesh');
                return;
            }

            // Create picking ray from camera through mouse position
            const camera = this.scene.activeCamera;
            if (!camera) {
                console.error('[InputHandler] No active camera');
                return;
            }

            // Get canvas-relative coordinates  
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            console.log(`[InputHandler] Canvas coords: (${x.toFixed(0)}, ${y.toFixed(0)})`);

            // Create a picking ray from camera through click point
            const ray = this.scene.createPickingRay(x, y, null, camera);

            // Try picking with the ray
            const pickResult = this.scene.pickWithRay(ray);

            console.log(`[InputHandler] Pick result - hit: ${pickResult?.hit}, mesh: ${pickResult?.pickedMesh?.name || 'none'}`);

            if (pickResult?.hit && pickResult.pickedPoint) {
                this.placeTrackAtPoint(pickResult.pickedPoint, placementMode);
            } else {
                // Fallback: Try to intersect with baseboard directly
                const intersection = ray.intersectsMesh(baseboard);
                console.log(`[InputHandler] Direct baseboard intersection: hit=${intersection.hit}`);

                if (intersection.hit && intersection.pickedPoint) {
                    this.placeTrackAtPoint(intersection.pickedPoint, placementMode);
                } else {
                    console.log('[InputHandler] No valid pick point');
                }
            }

        } catch (error) {
            console.error('[InputHandler] Error in handleCanvasClick:', error);
        }
    }

    /**
     * Place track at the specified point.
     * 
     * @param pickedPoint - 3D point where track should be placed
     * @param catalogId - Catalog ID of track to place
     */
    private placeTrackAtPoint(pickedPoint: Vector3, catalogId: string): void {
        if (!this.trackSystem || !this.baseboardSystem) return;

        const boardY = this.baseboardSystem.getBoardTopY();
        const position = new Vector3(
            pickedPoint.x,
            boardY,
            pickedPoint.z
        );

        console.log(`[InputHandler] Placing ${catalogId} at (${position.x.toFixed(3)}, ${position.z.toFixed(3)})`);

        const piece = this.trackSystem.placePiece(
            catalogId,
            position,
            Quaternion.Identity()
        );

        if (piece) {
            console.log(`[InputHandler] ✓ Placed ${piece.catalogEntry.name}`);

            // Notify callback (for outliner registration)
            if (this.onTrackPlaced) {
                this.onTrackPlaced(piece);
            }
        } else {
            console.warn('[InputHandler] Failed to place piece');
        }
    }

    /**
     * Cancel placement mode and re-enable selection.
     */
    cancelPlacementMode(): void {
        this.setPlacementMode(null);

        if (this.uiManager) {
            this.uiManager.clearSelection();
        }
        if (this.inputManager) {
            this.inputManager.clearSelection();
            this.inputManager.setPlacementMode(false);
        }
        if (this.trackSystem) {
            this.trackSystem.hideSnapPreview();
        }

        console.log('[InputHandler] Placement mode cancelled');
    }

    // ========================================================================
    // KEYBOARD SHORTCUTS
    // ========================================================================

    /**
     * Setup keyboard shortcuts via Babylon.js observable and window fallback.
     */
    private setupKeyboardShortcuts(): void {
        try {
            // ================================================================
            // BABYLON.JS KEYBOARD OBSERVABLE
            // Handles most keys but may miss Delete/Backspace in some browsers
            // ================================================================
            this.scene.onKeyboardObservable.add((kbInfo) => {
                // Only handle key down events
                if (kbInfo.type !== 1) return;

                try {
                    const key = kbInfo.event.key;  // Don't lowercase - [ and ] are symbols
                    const shiftKey = kbInfo.event.shiftKey;

                    this.handleKeyDown(key, shiftKey);

                } catch (error) {
                    console.error('[InputHandler] Error handling keyboard:', error);
                }
            });

            // ================================================================
            // FALLBACK: Window event listener for Delete/Backspace
            // Some browsers don't pass these to Babylon's keyboard observable
            // ================================================================
            window.addEventListener('keydown', (event: KeyboardEvent) => {
                // Only handle Delete and Backspace
                if (event.key !== 'Delete' && event.key !== 'Backspace') return;

                // Skip if typing in an input field
                if (event.target instanceof HTMLInputElement ||
                    event.target instanceof HTMLTextAreaElement ||
                    event.target instanceof HTMLSelectElement) {
                    return;
                }

                console.log(`[InputHandler] Delete key detected via window listener: "${event.key}"`);

                // Delete selected track piece
                this.handleDeleteKey(event);
            });

            console.log('[InputHandler] ✓ Keyboard shortcuts configured');

        } catch (error) {
            console.error('[InputHandler] Error setting up keyboard:', error);
        }
    }

    /**
     * Handle key down event.
     * 
     * @param key - Key that was pressed
     * @param shiftKey - Whether Shift was held
     */
    private handleKeyDown(key: string, shiftKey: boolean): void {
        switch (key) {
            // ============================================================
            // CAMERA CONTROLS
            // ============================================================
            case 'v':
            case 'V':
                // Toggle camera mode
                if (this.cameraSystem) {
                    this.cameraSystem.toggleMode();
                }
                break;

            case 'r':
            case 'R':
                // Reset camera (only if no train selected)
                // R is also used for train direction when a train is selected
                if (this.cameraSystem && !this.trainSystem?.getSelectedTrain()) {
                    this.cameraSystem.resetOrbitCamera();
                    console.log('[InputHandler] Camera reset');
                }
                break;

            case 'Home':
                // Reset camera
                if (this.cameraSystem) {
                    this.cameraSystem.resetOrbitCamera();
                    console.log('[InputHandler] Camera reset');
                }
                break;

            // ============================================================
            // ROTATION CONTROLS
            // ============================================================
            case '[':
                // Rotate counter-clockwise (Shift for larger jump)
                if (this.inputManager?.getSelectedPiece()) {
                    const angle = shiftKey ? -22.5 : -5;
                    this.rotateSelectedPiece(angle);
                }
                break;

            case ']':
                // Rotate clockwise (Shift for larger jump)
                if (this.inputManager?.getSelectedPiece()) {
                    const angle = shiftKey ? 22.5 : 5;
                    this.rotateSelectedPiece(angle);
                }
                break;

            // ============================================================
            // TRACK CONTROLS
            // ============================================================
            case 'c':
            case 'C':
                // Clear all track (with Shift to prevent accidents)
                if (shiftKey && this.trackSystem) {
                    this.trackSystem.clear();
                    console.log('[InputHandler] Track cleared');
                }
                break;

            case 's':
            case 'S':
                // Toggle auto-snap (with Shift)
                // Note: S without shift is handled by train system for throttle
                if (shiftKey && this.trackSystem) {
                    this.trackSystem.toggleConnectionIndicators();
                    // Also update UI toggle to stay in sync
                    if (this.uiManager) {
                        const autoSnapEnabled = !this.trackSystem.isAutoSnapEnabled();
                        this.trackSystem.setAutoSnap(autoSnapEnabled);
                        this.uiManager.setToggleState('autoSnap', autoSnapEnabled);
                    }
                }
                break;

            case 'i':
            case 'I':
                // Toggle connection indicators (with Shift)
                if (shiftKey && this.trackSystem) {
                    const enabled = this.trackSystem.toggleConnectionIndicators();
                    // Update UI toggle to stay in sync
                    if (this.uiManager) {
                        this.uiManager.setToggleState('connectionIndicators', enabled);
                    }
                }
                break;

            // ============================================================
            // SELECTION & ESCAPE
            // ============================================================
            case 'Escape':
                this.handleEscapeKey();
                break;

            case 'Delete':
            case 'Backspace':
                // Also handled via window listener as fallback
                this.handleDeleteKeyDirect();
                break;

            // ============================================================
            // TRAIN CONTROLS
            // ============================================================
            // case 't':
            // case 'T':
            //     // Shift+T = Register train models (async - won't freeze)
            //     // T alone = Place test tracks
            //     if (shiftKey) {
            //         this.handleTrainRegistrationAsync();
            //     } else if (this.testTracksCallback) {
            //         this.testTracksCallback();
            //     }
            //     break;
        }
    }

    /**
     * Handle Escape key - deselect trains, track, or cancel placement.
     */
    private handleEscapeKey(): void {
        // First priority: deselect any selected train
        if (this.trainSystem?.getSelectedTrain()) {
            this.trainSystem.deselectTrain();
            console.log('[InputHandler] Train deselected');
        }
        // Second priority: deselect any selected track
        else if (this.inputManager?.getSelectedPiece()) {
            this.inputManager.clearSelection();
            console.log('[InputHandler] Track deselected');
        }
        // Third priority: cancel placement mode
        else if (this.getPlacementMode()) {
            this.cancelPlacementMode();
        }
    }

    /**
     * Handle Delete key via window event listener.
     * 
     * @param event - Keyboard event
     */
    private handleDeleteKey(event: KeyboardEvent): void {
        if (this.inputManager && this.trackSystem) {
            const selected = this.inputManager.getSelectedPiece();
            if (selected) {
                event.preventDefault();
                this.deleteSelectedPiece(selected);
            } else {
                console.log('[InputHandler] Delete pressed but no track selected');
            }
        }
    }

    /**
     * Handle Delete key directly (via Babylon observable).
     */
    private handleDeleteKeyDirect(): void {
        if (this.inputManager && this.trackSystem) {
            const selected = this.inputManager.getSelectedPiece();
            if (selected) {
                this.deleteSelectedPiece(selected);
            } else {
                console.log('[InputHandler] Delete pressed but no track selected');
            }
        }
    }

    /**
     * Delete the selected track piece.
     * 
     * @param selected - Selected piece to delete
     */
    private deleteSelectedPiece(selected: any): void {
        if (!this.trackSystem) return;

        console.log(`[InputHandler] Delete key pressed - removing: ${selected.id}`);

        // Remove from track system (handles meshes, graph, indicators)
        const removed = this.trackSystem.removePiece(selected.id);

        if (removed) {
            // Remove from outliner if present
            if (this.outlinerManager) {
                this.outlinerManager.removeTrackFromOutliner(selected.id);
            }

            // Clear selection
            if (this.inputManager) {
                this.inputManager.clearSelection();
            }

            console.log(`[InputHandler] ✓ Deleted ${selected.id}`);
        } else {
            console.warn(`[InputHandler] Failed to delete ${selected.id}`);
        }
    }

    // ========================================================================
    // TRAIN REGISTRATION (ASYNC - NON-BLOCKING)
    // ========================================================================

    /**
     * Handle train registration via Shift+T (async version)
     * 
     * Uses TrainIntegration.scanAndRegisterAsync() which yields to the
     * UI periodically, preventing browser freeze.
     */
    private async handleTrainRegistrationAsync(): Promise<void> {
        // ====================================================================
        // VALIDATION: Prevent multiple simultaneous scans
        // ====================================================================
        if (this.isScanning) {
            console.log('[InputHandler] Scan already in progress...');
            return;
        }

        // ====================================================================
        // VALIDATION: Check if train integration is available
        // ====================================================================
        if (!this.trainIntegration) {
            console.warn('[InputHandler] Train integration not available');

            // Fallback: try trainSystem.scanAndRegisterTrains with safety limit
            if (this.trainSystem) {
                console.log('[InputHandler] Falling back to limited sync scan...');
                this.handleTrainRegistrationSync();
            }
            return;
        }

        // ====================================================================
        // EXECUTE: Async scan (non-blocking)
        // ====================================================================
        try {
            this.isScanning = true;
            console.log('[InputHandler] Starting async train scan (Shift+T)...');

            const count = await this.trainIntegration.scanAndRegisterAsync({
                autoSelect: true
            });

            if (count === 0) {
                console.log('[InputHandler] No new trains found to register');
                console.log('[InputHandler] Tip: Import a locomotive model and place it on track');
            } else {
                console.log(`[InputHandler] ✓ Registered ${count} train(s)`);
            }

        } catch (error) {
            console.error('[InputHandler] Error during async train registration:', error);
        } finally {
            this.isScanning = false;
        }
    }

    /**
     * Fallback synchronous train registration (with safety limits)
     * 
     * Only used if TrainIntegration is not available.
     * Has strict limits to prevent browser freeze.
     */
    private handleTrainRegistrationSync(): void {
        // ====================================================================
        // VALIDATION: Check if train system is available
        // ====================================================================
        if (!this.trainSystem) {
            console.warn('[InputHandler] Train system not available');
            return;
        }

        // ====================================================================
        // VALIDATION: Check if method exists on train system
        // ====================================================================
        if (typeof this.trainSystem.scanAndRegisterTrains !== 'function') {
            console.error('[InputHandler] scanAndRegisterTrains method not found');
            return;
        }

        // ====================================================================
        // EXECUTE: Sync scan with safety limit
        // ====================================================================
        try {
            console.log('[InputHandler] Starting limited sync scan...');
            console.log('[InputHandler] ⚠ This may cause brief UI freeze');

            // Call with a limited set of keywords to reduce iterations
            const count = this.trainSystem.scanAndRegisterTrains([
                'loco', 'locomotive', 'train', 'class', 'diesel', 'steam'
            ]);

            if (count === 0) {
                console.log('[InputHandler] No new trains found');
            } else {
                console.log(`[InputHandler] ✓ Registered ${count} train(s)`);
            }

        } catch (error) {
            console.error('[InputHandler] Error during sync train registration:', error);
        }
    }

    // ========================================================================
    // ROTATION
    // ========================================================================

    /**
     * Rotate the currently selected track piece with smooth animation.
     * 
     * @param angleDeg - Angle to rotate in degrees (positive = clockwise)
     */
    private rotateSelectedPiece(angleDeg: number): void {
        try {
            if (!this.inputManager || !this.trackSystem) {
                return;
            }

            const selected = this.inputManager.getSelectedPiece();

            if (!selected) {
                return;
            }

            // Get current rotation
            const currentRotation = selected.transform.rotation.clone();

            // Create rotation around Y axis (up)
            const additionalRotation = Quaternion.RotationAxis(
                Vector3.Up(),
                angleDeg * Math.PI / 180
            );

            // Calculate target rotation
            const targetRotation = currentRotation.multiply(additionalRotation);

            // Animate the rotation smoothly
            this.animateRotation(selected.id, currentRotation, targetRotation);

        } catch (error) {
            console.error('[InputHandler] Error rotating piece:', error);
        }
    }

    /**
     * Animate rotation smoothly from current to target.
     * 
     * @param pieceId - ID of piece to rotate
     * @param fromRotation - Starting rotation
     * @param toRotation - Target rotation
     */
    private animateRotation(pieceId: string, fromRotation: Quaternion, toRotation: Quaternion): void {
        const duration = 150; // milliseconds
        const startTime = performance.now();

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Use smooth easing (ease-out)
            const eased = 1 - Math.pow(1 - progress, 3);

            // Interpolate rotation
            const currentRotation = Quaternion.Slerp(fromRotation, toRotation, eased);

            // Apply rotation
            this.trackSystem?.rotatePiece(pieceId, currentRotation);

            // Continue animation if not complete
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    // ========================================================================
    // CONTROL INSTRUCTIONS
    // ========================================================================

    /**
     * Log control instructions to console.
     */
    private logControlInstructions(): void {
        console.log('');
        console.log('=== Controls ===');
        console.log('  Click palette → Select track type');
        console.log('  Click board → Place track (auto-snaps!)');
        console.log('  Click track → Select track');
        console.log('  [ / ] → Rotate selected ±5°');
        console.log('  Shift+[ / ] → Rotate ±22.5°');
        console.log('  Delete → Remove selected');
        console.log('  ESC → Deselect / Cancel placement');
        console.log('  V → Toggle camera mode');
        console.log('  Home → Reset camera');
        console.log('  Shift+S → Toggle auto-snap');
        console.log('  Shift+I → Toggle connection indicators');
        console.log('  Shift+C → Clear all track');
        console.log('  T → Place test tracks');
        console.log('');
        console.log('=== Train Controls ===');
        console.log('  Shift+T → Register train models (async)');
        console.log('  Click train → Select for control');
        console.log('  ↑/W → Increase throttle');
        console.log('  ↓/S → Decrease throttle');
        console.log('  R → Toggle direction (when train selected)');
        console.log('  Space → Brake (hold)');
        console.log('  H → Horn');
        console.log('  Click points → Toggle switch');
        console.log('');
        console.log('=== Model Import ===');
        console.log('  📦 Import Model button → Import GLB/GLTF files');
        console.log('  Rolling stock auto-placed on track');
        console.log('  Imported models appear in World Outliner');
        console.log('  Delete from outliner removes 3D model');
        console.log('  [ / ] → Rotate models too');
        console.log('================');
        console.log('');
        console.log('Connection indicators:');
        console.log('  🟠 Orange = Available connector');
        console.log('  🟢 Green = Connected');
        console.log('  🔵 Blue = Snap preview');
    }

    // ========================================================================
    // DEPENDENCY UPDATES
    // ========================================================================

    /**
     * Update the outliner manager reference.
     * 
     * @param outlinerManager - OutlinerManager instance
     */
    setOutlinerManager(outlinerManager: OutlinerManager): void {
        this.outlinerManager = outlinerManager;
    }

    /**
     * Update the train system reference.
     * 
     * @param trainSystem - TrainSystem instance
     */
    setTrainSystem(trainSystem: TrainSystem): void {
        this.trainSystem = trainSystem;
    }

    /**
     * Update the train integration reference.
     * 
     * @param trainIntegration - TrainIntegration instance
     */
    setTrainIntegration(trainIntegration: TrainIntegration): void {
        this.trainIntegration = trainIntegration;
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Dispose of input handlers.
     * Note: Event listeners on canvas are automatically cleaned up when canvas is removed.
     */
    dispose(): void {
        this.isScanning = false;
        console.log('[InputHandler] Disposed');
    }
}