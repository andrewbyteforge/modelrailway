/**
 * ScaleManager.ts - Central coordinator for the scaling system
 * 
 * Path: frontend/src/systems/scaling/ScaleManager.ts
 * 
 * Coordinates all scaling functionality:
 * - Manages scale gizmo attachment and visibility
 * - Handles hotkey+scroll scaling input
 * - Integrates with constraints and presets
 * - Provides unified API for scale operations
 * - Tracks scale state and history for undo
 * 
 * @module ScaleManager
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { KeyboardInfo } from '@babylonjs/core/Events/keyboardEvents';
import { KeyboardEventTypes } from '@babylonjs/core/Events/keyboardEvents';

import { ScaleGizmo } from './ScaleGizmo';
import { ScaleConstraintsHandler, getGlobalConstraintsHandler } from './ScaleConstraints';
import { ScalePresetsManager, getGlobalPresetsManager } from './ScalePresets';

import {
    ScaleManagerState,
    INITIAL_SCALE_MANAGER_STATE,
    ScalableAssetCategory,
    ScalePivotPoint,
    ScaleHotkeyConfig,
    DEFAULT_HOTKEY_CONFIG,
    ScaleEventListener,
    ScaleEvent,
    ScaleOperationResult,
    ObjectScaleInfo,
    IScalable
} from '../../types/scaling.types';

import {
    calculateScrollScale,
    calculatePivotAdjustedPosition,
    scalesEqual,
    formatScale
} from '../../utils/scaling/ScaleCalculations';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[ScaleManager]';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Registered scalable object with additional manager data
 */
interface RegisteredObject {
    /** The scalable object interface */
    scalable: IScalable;
    /** Transform node for positioning */
    transformNode: TransformNode;
    /** All meshes belonging to this object */
    meshes: AbstractMesh[];
    /** Bounding radius for gizmo sizing */
    boundingRadius: number;
    /** Original scale when first registered */
    originalScale: number;
}

/**
 * Scale operation for undo history
 */
interface ScaleHistoryEntry {
    /** Object ID */
    objectId: string;
    /** Scale before operation */
    beforeScale: number;
    /** Scale after operation */
    afterScale: number;
    /** Timestamp */
    timestamp: number;
}

// ============================================================================
// SCALE MANAGER CLASS
// ============================================================================

/**
 * ScaleManager - Central coordinator for all scaling operations
 * 
 * Provides a unified interface for:
 * - Gizmo-based interactive scaling
 * - Hotkey+scroll scaling
 * - Numeric input scaling
 * - Preset application
 * - Constraint enforcement
 * 
 * @example
 * ```typescript
 * const scaleManager = new ScaleManager(scene);
 * scaleManager.initialize();
 * 
 * // Register an object for scaling
 * scaleManager.registerScalable(scalableObject, transformNode, meshes, radius);
 * 
 * // Select for scaling
 * scaleManager.selectObject('object_id');
 * 
 * // Or scale programmatically
 * scaleManager.setScale('object_id', 1.5);
 * ```
 */
export class ScaleManager {
    // ========================================================================
    // PROPERTIES
    // ========================================================================

    /** Babylon.js scene */
    private scene: Scene;

    /** Scale gizmo instance */
    private gizmo: ScaleGizmo;

    /** Constraints handler */
    private constraints: ScaleConstraintsHandler;

    /** Presets manager */
    private presets: ScalePresetsManager;

    /** Hotkey configuration */
    private hotkeyConfig: ScaleHotkeyConfig;

    /** Current manager state */
    private state: ScaleManagerState;

    /** Registered scalable objects */
    private registeredObjects: Map<string, RegisteredObject> = new Map();

    /** Scale history for undo */
    private history: ScaleHistoryEntry[] = [];

    /** Maximum history entries */
    private maxHistoryEntries: number = 50;

    /** Event listeners */
    private listeners: ScaleEventListener[] = [];

    /** Keyboard observer */
    private keyboardObserver: Observer<KeyboardInfo> | null = null;

    /** Wheel event handler */
    private wheelHandler: ((e: WheelEvent) => void) | null = null;

    /** Whether manager is initialized */
    private initialized: boolean = false;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new ScaleManager
     * 
     * @param scene - Babylon.js scene
     * @param hotkeyConfig - Optional hotkey configuration
     */
    constructor(scene: Scene, hotkeyConfig?: Partial<ScaleHotkeyConfig>) {
        this.scene = scene;
        this.hotkeyConfig = { ...DEFAULT_HOTKEY_CONFIG, ...hotkeyConfig };
        this.state = { ...INITIAL_SCALE_MANAGER_STATE };

        // Get global instances
        this.constraints = getGlobalConstraintsHandler();
        this.presets = getGlobalPresetsManager();

        // Create gizmo (not initialized yet)
        this.gizmo = new ScaleGizmo(scene);

        console.log(`${LOG_PREFIX} Created`);
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the scale manager
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            console.warn(`${LOG_PREFIX} Already initialized`);
            return;
        }

        try {
            console.log(`${LOG_PREFIX} Initializing...`);

            // Initialize presets
            await this.presets.initialize();

            // Initialize gizmo
            this.gizmo.initialize();

            // Setup gizmo event handling
            this.setupGizmoEvents();

            // Setup keyboard events
            this.setupKeyboardEvents();

            // Setup wheel events (for scroll-to-scale)
            this.setupWheelEvents();

            this.initialized = true;

            console.log(`${LOG_PREFIX} ✓ Initialized`);
            this.logControls();

        } catch (error) {
            console.error(`${LOG_PREFIX} Initialization failed:`, error);
            throw error;
        }
    }

    /**
     * Log control instructions
     */
    private logControls(): void {
        console.log('');
        console.log('=== Scale Controls ===');
        console.log(`  Hold '${this.hotkeyConfig.scaleKey.toUpperCase()}' + Scroll → Scale selected object`);
        console.log(`  + Shift                    → Fine adjustment`);
        console.log(`  '${this.hotkeyConfig.resetKey.toUpperCase()}'                      → Reset to original scale`);
        console.log(`  '${this.hotkeyConfig.lockKey.toUpperCase()}'                      → Toggle scale lock`);
        console.log('  Drag gizmo handles         → Interactive scaling');
        console.log('========================');
        console.log('');
    }

    /**
     * Setup gizmo event handling
     */
    private setupGizmoEvents(): void {
        this.gizmo.addEventListener((event) => {
            switch (event.type) {
                case 'scale-preview':
                    this.handleGizmoPreview(event);
                    break;
                case 'scale-commit':
                    this.handleGizmoCommit(event);
                    break;
                case 'scale-cancel':
                    this.handleGizmoCancel(event);
                    break;
            }
        });
    }

    /**
     * Handle gizmo preview events
     */
    private handleGizmoPreview(event: ScaleEvent): void {
        if (!this.state.selectedObjectId || event.scale === undefined) return;

        const registered = this.registeredObjects.get(this.state.selectedObjectId);
        if (!registered) return;

        // Apply preview scale to mesh (visual only)
        this.applyScaleToMeshes(
            registered,
            event.scale,
            registered.scalable.currentScale
        );

        // Update state
        this.state.previewScale = event.scale;
        this.state.gizmoState = 'preview';

        // Emit preview event
        this.emit({
            type: 'scale-preview',
            objectId: this.state.selectedObjectId,
            scale: event.scale,
            previousScale: registered.scalable.currentScale,
            timestamp: Date.now()
        });
    }

    /**
     * Handle gizmo commit events
     */
    private handleGizmoCommit(event: ScaleEvent): void {
        if (!this.state.selectedObjectId || event.scale === undefined) return;

        // Apply constraints
        const registered = this.registeredObjects.get(this.state.selectedObjectId);
        if (!registered) return;

        const result = this.setScaleInternal(
            this.state.selectedObjectId,
            event.scale,
            'gizmo'
        );

        if (result.success) {
            console.log(`${LOG_PREFIX} Gizmo scale committed: ${formatScale(result.finalScale!)}`);
        }

        // Reset preview state
        this.state.previewScale = null;
        this.state.gizmoState = 'idle';
    }

    /**
     * Handle gizmo cancel events
     */
    private handleGizmoCancel(event: ScaleEvent): void {
        if (!this.state.selectedObjectId) return;

        const registered = this.registeredObjects.get(this.state.selectedObjectId);
        if (!registered) return;

        // Restore original scale
        this.applyScaleToMeshes(
            registered,
            registered.scalable.currentScale,
            this.state.previewScale || registered.scalable.currentScale
        );

        // Reset preview state
        this.state.previewScale = null;
        this.state.gizmoState = 'idle';
    }

    // ========================================================================
    // KEYBOARD EVENTS
    // ========================================================================

    /**
     * Setup keyboard event handling
     */
    private setupKeyboardEvents(): void {
        this.keyboardObserver = this.scene.onKeyboardObservable.add((kbInfo) => {
            const key = kbInfo.event.key.toLowerCase();
            const isKeyDown = kbInfo.type === KeyboardEventTypes.KEYDOWN;
            const isKeyUp = kbInfo.type === KeyboardEventTypes.KEYUP;

            // Track scale key state
            if (key === this.hotkeyConfig.scaleKey) {
                if (isKeyDown && !this.state.scaleKeyHeld) {
                    this.state.scaleKeyHeld = true;
                    this.state.scaleModeActive = true;
                    this.emit({
                        type: 'mode-changed',
                        timestamp: Date.now(),
                        data: { active: true }
                    });
                } else if (isKeyUp) {
                    this.state.scaleKeyHeld = false;
                    this.state.scaleModeActive = false;
                    this.emit({
                        type: 'mode-changed',
                        timestamp: Date.now(),
                        data: { active: false }
                    });
                }
            }

            // Track shift state
            if (kbInfo.event.key === 'Shift') {
                this.state.shiftHeld = isKeyDown;

                // Toggle constraint bypass
                if (this.hotkeyConfig.fineModifier === 'shift') {
                    if (isKeyDown) {
                        this.constraints.enableBypass();
                        this.state.constraintsBypassed = true;
                    } else {
                        this.constraints.disableBypass();
                        this.state.constraintsBypassed = false;
                    }
                }
            }

            // Reset key
            if (key === this.hotkeyConfig.resetKey && isKeyDown) {
                this.resetSelectedScale();
            }

            // Lock key
            if (key === this.hotkeyConfig.lockKey && isKeyDown) {
                this.toggleSelectedLock();
            }
        });
    }

    // ========================================================================
    // WHEEL EVENTS (SCROLL-TO-SCALE)
    // ========================================================================

    /**
     * Setup wheel event handling for scroll-to-scale
     */
    private setupWheelEvents(): void {
        const canvas = this.scene.getEngine().getRenderingCanvas();
        if (!canvas) {
            console.warn(`${LOG_PREFIX} No canvas found for wheel events`);
            return;
        }

        this.wheelHandler = (event: WheelEvent) => {
            // Only handle when scale key is held
            if (!this.state.scaleKeyHeld) return;

            // Must have a selected object
            if (!this.state.selectedObjectId) return;

            // Prevent page scroll
            event.preventDefault();

            // Get registered object
            const registered = this.registeredObjects.get(this.state.selectedObjectId);
            if (!registered || registered.scalable.scaleLocked) return;

            // Calculate new scale from scroll
            const newScale = calculateScrollScale(
                registered.scalable.currentScale,
                -event.deltaY, // Invert for natural scroll direction
                this.hotkeyConfig.scrollSensitivity,
                this.state.shiftHeld,
                this.hotkeyConfig.fineMultiplier
            );

            // Apply with constraints
            this.setScaleInternal(this.state.selectedObjectId, newScale, 'hotkey');
        };

        canvas.addEventListener('wheel', this.wheelHandler, { passive: false });
    }

    // ========================================================================
    // OBJECT REGISTRATION
    // ========================================================================

    /**
     * Register an object for scaling
     * 
     * @param scalable - Object implementing IScalable
     * @param transformNode - Transform node for positioning
     * @param meshes - All meshes belonging to this object
     * @param boundingRadius - Bounding radius for gizmo sizing
     */
    registerScalable(
        scalable: IScalable,
        transformNode: TransformNode,
        meshes: AbstractMesh[],
        boundingRadius: number
    ): void {
        if (this.registeredObjects.has(scalable.id)) {
            console.warn(`${LOG_PREFIX} Object already registered: ${scalable.id}`);
            return;
        }

        this.registeredObjects.set(scalable.id, {
            scalable,
            transformNode,
            meshes,
            boundingRadius,
            originalScale: scalable.currentScale
        });

        console.log(`${LOG_PREFIX} Registered scalable: ${scalable.id}`);
    }

    /**
     * Unregister an object from scaling
     * 
     * @param objectId - Object ID
     */
    unregisterScalable(objectId: string): void {
        if (this.state.selectedObjectId === objectId) {
            this.deselectObject();
        }

        this.registeredObjects.delete(objectId);
        console.log(`${LOG_PREFIX} Unregistered scalable: ${objectId}`);
    }

    /**
     * Check if an object is registered
     */
    isRegistered(objectId: string): boolean {
        return this.registeredObjects.has(objectId);
    }

    // ========================================================================
    // SELECTION
    // ========================================================================

    /**
     * Select an object for scaling
     * 
     * @param objectId - Object ID to select
     */
    selectObject(objectId: string): void {
        // Check if object exists
        const registered = this.registeredObjects.get(objectId);
        if (!registered) {
            console.warn(`${LOG_PREFIX} Object not registered: ${objectId}`);
            return;
        }

        // Deselect previous if different
        if (this.state.selectedObjectId && this.state.selectedObjectId !== objectId) {
            this.deselectObject();
        }

        // Update state
        this.state.selectedObjectId = objectId;
        this.state.lastCommittedScale = registered.scalable.currentScale;

        // Attach gizmo
        this.gizmo.attachToObject(
            registered.transformNode,
            registered.boundingRadius,
            registered.scalable.currentScale
        );

        console.log(`${LOG_PREFIX} Selected: ${objectId}`);

        // Emit event
        this.emit({
            type: 'scale-start',
            objectId,
            scale: registered.scalable.currentScale,
            timestamp: Date.now()
        });
    }

    /**
     * Deselect the current object
     */
    deselectObject(): void {
        if (!this.state.selectedObjectId) return;

        const objectId = this.state.selectedObjectId;

        // Detach gizmo
        this.gizmo.detach();

        // Reset state
        this.state.selectedObjectId = null;
        this.state.previewScale = null;
        this.state.lastCommittedScale = null;

        console.log(`${LOG_PREFIX} Deselected: ${objectId}`);
    }

    /**
     * Get currently selected object ID
     */
    getSelectedObjectId(): string | null {
        return this.state.selectedObjectId;
    }

    // ========================================================================
    // SCALE OPERATIONS
    // ========================================================================

    /**
     * Set scale for an object
     * 
     * @param objectId - Object ID
     * @param scale - New scale factor
     * @returns Operation result
     */
    setScale(objectId: string, scale: number): ScaleOperationResult {
        return this.setScaleInternal(objectId, scale, 'api');
    }

    /**
     * Internal scale setting with source tracking
     */
    private setScaleInternal(
        objectId: string,
        scale: number,
        source: 'gizmo' | 'panel' | 'hotkey' | 'preset' | 'api'
    ): ScaleOperationResult {
        const registered = this.registeredObjects.get(objectId);
        if (!registered) {
            return { success: false, error: 'Object not registered' };
        }

        // Check lock
        if (registered.scalable.scaleLocked) {
            return { success: false, error: 'Object scale is locked' };
        }

        // Apply constraints
        const constrained = this.constraints.applyConstraints(
            scale,
            registered.scalable.category
        );

        if (!constrained.success) {
            return constrained;
        }

        const previousScale = registered.scalable.currentScale;
        const finalScale = constrained.finalScale!;

        // Skip if no change
        if (scalesEqual(previousScale, finalScale)) {
            return { success: true, finalScale, wasClamped: false, wasSnapped: false };
        }

        // Apply to meshes
        this.applyScaleToMeshes(registered, finalScale, previousScale);

        // Update scalable state
        registered.scalable.currentScale = finalScale;

        // Update gizmo if this is the selected object
        if (this.state.selectedObjectId === objectId) {
            this.gizmo.updateScale(finalScale);
        }

        // Record history
        this.recordHistory(objectId, previousScale, finalScale);

        // Emit event
        this.emit({
            type: 'scale-commit',
            objectId,
            scale: finalScale,
            previousScale,
            timestamp: Date.now(),
            data: { source }
        });

        return constrained;
    }

    /**
     * Apply scale to mesh transforms
     */
    private applyScaleToMeshes(
        registered: RegisteredObject,
        newScale: number,
        oldScale: number
    ): void {
        // Calculate uniform scale vector
        const scaleVector = new Vector3(newScale, newScale, newScale);

        // Apply to transform node
        registered.transformNode.scaling = scaleVector;

        // If using pivot adjustment, update position
        if (registered.scalable.pivotPoint !== 'center') {
            // Get bounding box for pivot calculation
            let boundingMin = new Vector3(Infinity, Infinity, Infinity);
            let boundingMax = new Vector3(-Infinity, -Infinity, -Infinity);

            for (const mesh of registered.meshes) {
                if (mesh.getBoundingInfo) {
                    const bounds = mesh.getBoundingInfo().boundingBox;
                    boundingMin = Vector3.Minimize(boundingMin, bounds.minimumWorld);
                    boundingMax = Vector3.Maximize(boundingMax, bounds.maximumWorld);
                }
            }

            // Calculate pivot-adjusted position
            // (This keeps the base grounded for buildings, etc.)
            const pivotPosition = new Vector3(
                (boundingMin.x + boundingMax.x) / 2,
                registered.scalable.pivotPoint === 'base-center' ? boundingMin.y : boundingMax.y,
                (boundingMin.z + boundingMax.z) / 2
            );

            const newPosition = calculatePivotAdjustedPosition(
                registered.transformNode.position,
                pivotPosition,
                oldScale,
                newScale
            );

            registered.transformNode.position = newPosition;
        }
    }

    /**
     * Apply a preset to an object
     * 
     * @param objectId - Object ID
     * @param presetId - Preset ID
     * @returns Operation result
     */
    applyPreset(objectId: string, presetId: string): ScaleOperationResult {
        const scale = this.presets.applyPreset(presetId);
        if (scale === undefined) {
            return { success: false, error: 'Preset not found' };
        }

        return this.setScaleInternal(objectId, scale, 'preset');
    }

    /**
     * Reset object to original scale
     * 
     * @param objectId - Object ID
     * @returns Operation result
     */
    resetScale(objectId: string): ScaleOperationResult {
        const registered = this.registeredObjects.get(objectId);
        if (!registered) {
            return { success: false, error: 'Object not registered' };
        }

        return this.setScaleInternal(objectId, registered.originalScale, 'api');
    }

    /**
     * Reset currently selected object's scale
     */
    resetSelectedScale(): void {
        if (this.state.selectedObjectId) {
            const result = this.resetScale(this.state.selectedObjectId);
            if (result.success) {
                this.emit({
                    type: 'scale-reset',
                    objectId: this.state.selectedObjectId,
                    scale: result.finalScale,
                    timestamp: Date.now()
                });
            }
        }
    }

    // ========================================================================
    // LOCK OPERATIONS
    // ========================================================================

    /**
     * Toggle scale lock for an object
     * 
     * @param objectId - Object ID
     */
    toggleLock(objectId: string): boolean {
        const registered = this.registeredObjects.get(objectId);
        if (!registered) return false;

        registered.scalable.scaleLocked = !registered.scalable.scaleLocked;

        this.emit({
            type: 'lock-changed',
            objectId,
            timestamp: Date.now(),
            data: { locked: registered.scalable.scaleLocked }
        });

        console.log(`${LOG_PREFIX} Lock ${registered.scalable.scaleLocked ? 'enabled' : 'disabled'}: ${objectId}`);
        return registered.scalable.scaleLocked;
    }

    /**
     * Toggle lock on currently selected object
     */
    toggleSelectedLock(): void {
        if (this.state.selectedObjectId) {
            this.toggleLock(this.state.selectedObjectId);
        }
    }

    /**
     * Check if an object's scale is locked
     */
    isLocked(objectId: string): boolean {
        const registered = this.registeredObjects.get(objectId);
        return registered?.scalable.scaleLocked ?? false;
    }

    // ========================================================================
    // SCALE INFO
    // ========================================================================

    /**
     * Get complete scale info for an object
     * 
     * @param objectId - Object ID
     * @returns Scale info or null if not found
     */
    getScaleInfo(objectId: string): ObjectScaleInfo | null {
        const registered = this.registeredObjects.get(objectId);
        if (!registered) return null;

        const scalable = registered.scalable;
        const scale = scalable.currentScale;

        // Get dimensions (simplified - would need actual mesh bounds)
        const radius = registered.boundingRadius;
        const baseDimensions = {
            width: radius * 2,
            height: radius * 2,
            depth: radius * 2,
            boundingRadius: radius
        };

        return {
            objectId,
            currentScale: scale,
            originalScale: registered.originalScale,
            currentDimensions: {
                width: baseDimensions.width * scale,
                height: baseDimensions.height * scale,
                depth: baseDimensions.depth * scale,
                boundingRadius: radius * scale
            },
            originalDimensions: baseDimensions,
            category: scalable.category,
            isLocked: scalable.scaleLocked,
            constraints: this.constraints.getEffectiveConstraints(scalable.category),
            presets: this.presets.getPresetsForCategory(scalable.category)
        };
    }

    /**
     * Get current scale for an object
     */
    getCurrentScale(objectId: string): number | null {
        const registered = this.registeredObjects.get(objectId);
        return registered?.scalable.currentScale ?? null;
    }

    // ========================================================================
    // HISTORY / UNDO
    // ========================================================================

    /**
     * Record a scale change in history
     */
    private recordHistory(objectId: string, beforeScale: number, afterScale: number): void {
        this.history.push({
            objectId,
            beforeScale,
            afterScale,
            timestamp: Date.now()
        });

        // Trim old entries
        while (this.history.length > this.maxHistoryEntries) {
            this.history.shift();
        }
    }

    /**
     * Undo the last scale operation
     * 
     * @returns Whether undo was successful
     */
    undo(): boolean {
        const entry = this.history.pop();
        if (!entry) return false;

        const result = this.setScaleInternal(entry.objectId, entry.beforeScale, 'api');
        return result.success;
    }

    /**
     * Clear scale history
     */
    clearHistory(): void {
        this.history = [];
    }

    // ========================================================================
    // EVENTS
    // ========================================================================

    /**
     * Add an event listener
     */
    addEventListener(listener: ScaleEventListener): void {
        this.listeners.push(listener);
    }

    /**
     * Remove an event listener
     */
    removeEventListener(listener: ScaleEventListener): void {
        const index = this.listeners.indexOf(listener);
        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
    }

    /**
     * Emit an event
     */
    private emit(event: ScaleEvent): void {
        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (error) {
                console.error(`${LOG_PREFIX} Error in event listener:`, error);
            }
        }
    }

    // ========================================================================
    // STATE ACCESS
    // ========================================================================

    /**
     * Get current manager state
     */
    getState(): Readonly<ScaleManagerState> {
        return { ...this.state };
    }

    /**
     * Check if scale mode is active (S key held)
     */
    isScaleModeActive(): boolean {
        return this.state.scaleModeActive;
    }

    /**
     * Check if gizmo is currently being dragged
     */
    isDragging(): boolean {
        return this.gizmo.isDragging();
    }

    // ========================================================================
    // DISPOSAL
    // ========================================================================

    /**
     * Clean up all resources
     */
    dispose(): void {
        try {
            // Remove keyboard observer
            if (this.keyboardObserver) {
                this.scene.onKeyboardObservable.remove(this.keyboardObserver);
                this.keyboardObserver = null;
            }

            // Remove wheel handler
            if (this.wheelHandler) {
                const canvas = this.scene.getEngine().getRenderingCanvas();
                if (canvas) {
                    canvas.removeEventListener('wheel', this.wheelHandler);
                }
                this.wheelHandler = null;
            }

            // Dispose gizmo
            this.gizmo.dispose();

            // Clear registered objects
            this.registeredObjects.clear();

            // Clear history
            this.history = [];

            // Clear listeners
            this.listeners = [];

            // Reset state
            this.state = { ...INITIAL_SCALE_MANAGER_STATE };
            this.initialized = false;

            console.log(`${LOG_PREFIX} Disposed`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error during disposal:`, error);
        }
    }
}