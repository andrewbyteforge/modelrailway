/**
 * ScaleGizmo.ts - UE5-style 3D scale gizmo with drag handles
 * 
 * Path: frontend/src/systems/scaling/ScaleGizmo.ts
 * 
 * Provides visual 3D handles for uniform scaling:
 * - Corner cube handles for drag-to-scale
 * - Central reference indicator
 * - Visual feedback (hover, active states)
 * - Real-time scale preview during drag
 * - Auto-sizing based on camera distance
 * 
 * @module ScaleGizmo
 * @author Model Railway Workbench
 * @version 1.1.0 - Updated to use centralized camera control helper
 */

import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { PointerInfo } from '@babylonjs/core/Events/pointerEvents';

import {
    ScaleGizmoConfig,
    DEFAULT_GIZMO_CONFIG,
    GizmoInteractionState,
    ScaleEventListener,
    ScaleEvent
} from '../../types/scaling.types';

import {
    calculateDragScale,
    calculateAutoScaleGizmoSize,
    calculateHandleOffset
} from '../../utils/scaling/ScaleCalculations';

// Import centralized camera control helper
import { setCameraControlsEnabled } from '../../utils/CameraControlHelper';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[ScaleGizmo]';

/** Number of corner handles */
const NUM_HANDLES = 8;

/** Render layer for gizmo (high priority) */
const GIZMO_RENDER_PRIORITY = 100;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Individual handle data
 */
interface HandleData {
    /** Handle mesh */
    mesh: Mesh;
    /** Handle index (0-7) */
    index: number;
    /** Local position offset */
    localOffset: Vector3;
    /** Whether this handle is currently hovered */
    isHovered: boolean;
}

/**
 * Drag state data
 */
interface DragState {
    /** Whether currently dragging */
    isDragging: boolean;
    /** Handle being dragged */
    activeHandle: HandleData | null;
    /** Screen position where drag started */
    startScreenPos: Vector3;
    /** Scale when drag started */
    startScale: number;
    /** Current preview scale */
    previewScale: number;
}

// ============================================================================
// SCALE GIZMO CLASS
// ============================================================================

/**
 * ScaleGizmo - 3D visual handles for uniform scaling
 * 
 * Creates a set of corner handles around a target object that can be
 * dragged to scale the object uniformly. Provides visual feedback
 * through colour changes and real-time preview.
 * 
 * @example
 * ```typescript
 * const gizmo = new ScaleGizmo(scene);
 * gizmo.attachToObject(targetNode, boundingRadius, currentScale);
 * 
 * gizmo.addEventListener((event) => {
 *     if (event.type === 'scale-commit') {
 *         applyScale(event.scale);
 *     }
 * });
 * ```
 */
export class ScaleGizmo {
    // ========================================================================
    // PROPERTIES
    // ========================================================================

    /** Babylon.js scene */
    private scene: Scene;

    /** Gizmo configuration */
    private config: ScaleGizmoConfig;

    /** Root transform node for all gizmo elements */
    private rootNode: TransformNode | null = null;

    /** Array of handle data */
    private handles: HandleData[] = [];

    /** Central indicator mesh */
    private centerIndicator: Mesh | null = null;

    /** Materials for different states */
    private materials: {
        idle: StandardMaterial;
        hover: StandardMaterial;
        active: StandardMaterial;
        center: StandardMaterial;
    } | null = null;

    /** Currently attached target */
    private attachedTarget: TransformNode | null = null;

    /** Target's bounding radius */
    private targetRadius: number = 0;

    /** Current interaction state */
    private state: GizmoInteractionState = 'idle';

    /** Drag state */
    private dragState: DragState = {
        isDragging: false,
        activeHandle: null,
        startScreenPos: Vector3.Zero(),
        startScale: 1.0,
        previewScale: 1.0
    };

    /** Current scale value */
    private currentScale: number = 1.0;

    /** Event listeners */
    private listeners: ScaleEventListener[] = [];

    /** Pointer observer for interaction */
    private pointerObserver: Observer<PointerInfo> | null = null;

    /** Render observer for auto-sizing */
    private renderObserver: Observer<Scene> | null = null;

    /** Whether gizmo is visible */
    private _visible: boolean = false;

    /** Whether gizmo is enabled */
    private _enabled: boolean = true;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new ScaleGizmo
     * 
     * @param scene - Babylon.js scene
     * @param config - Optional configuration
     */
    constructor(scene: Scene, config: Partial<ScaleGizmoConfig> = {}) {
        this.scene = scene;
        this.config = { ...DEFAULT_GIZMO_CONFIG, ...config };

        console.log(`${LOG_PREFIX} Created`);
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the gizmo
     * Creates meshes and sets up event handling
     */
    initialize(): void {
        try {
            console.log(`${LOG_PREFIX} Initializing...`);

            // Create materials
            this.createMaterials();

            // Create root node
            this.rootNode = new TransformNode('scale_gizmo_root', this.scene);

            // Create handles
            this.createHandles();

            // Create center indicator
            this.createCenterIndicator();

            // Setup pointer events
            this.setupPointerEvents();

            // Setup auto-sizing (if enabled)
            if (this.config.autoScale) {
                this.setupAutoSizing();
            }

            // Start hidden
            this.setVisible(false);

            console.log(`${LOG_PREFIX} ✓ Initialized with ${this.handles.length} handles`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Initialization failed:`, error);
            throw error;
        }
    }

    /**
     * Create materials for different states
     */
    private createMaterials(): void {
        // Idle state material (yellow)
        const idleMat = new StandardMaterial('gizmo_mat_idle', this.scene);
        idleMat.diffuseColor = new Color3(
            this.config.idleColor.r,
            this.config.idleColor.g,
            this.config.idleColor.b
        );
        idleMat.emissiveColor = idleMat.diffuseColor.scale(0.3);
        idleMat.alpha = this.config.opacity;
        idleMat.backFaceCulling = false;

        // Hover state material (bright yellow)
        const hoverMat = new StandardMaterial('gizmo_mat_hover', this.scene);
        hoverMat.diffuseColor = new Color3(
            this.config.hoverColor.r,
            this.config.hoverColor.g,
            this.config.hoverColor.b
        );
        hoverMat.emissiveColor = hoverMat.diffuseColor.scale(0.5);
        hoverMat.alpha = this.config.opacity;
        hoverMat.backFaceCulling = false;

        // Active state material (orange)
        const activeMat = new StandardMaterial('gizmo_mat_active', this.scene);
        activeMat.diffuseColor = new Color3(
            this.config.activeColor.r,
            this.config.activeColor.g,
            this.config.activeColor.b
        );
        activeMat.emissiveColor = activeMat.diffuseColor.scale(0.5);
        activeMat.alpha = this.config.opacity;
        activeMat.backFaceCulling = false;

        // Center indicator material (semi-transparent white)
        const centerMat = new StandardMaterial('gizmo_mat_center', this.scene);
        centerMat.diffuseColor = new Color3(1, 1, 1);
        centerMat.alpha = 0.3;
        centerMat.backFaceCulling = false;

        this.materials = {
            idle: idleMat,
            hover: hoverMat,
            active: activeMat,
            center: centerMat
        };
    }

    /**
     * Create the 8 corner handles
     */
    private createHandles(): void {
        if (!this.rootNode || !this.materials) return;

        // Corner positions (normalized -1 to 1)
        const corners = [
            new Vector3(-1, -1, -1),
            new Vector3(1, -1, -1),
            new Vector3(-1, 1, -1),
            new Vector3(1, 1, -1),
            new Vector3(-1, -1, 1),
            new Vector3(1, -1, 1),
            new Vector3(-1, 1, 1),
            new Vector3(1, 1, 1)
        ];

        for (let i = 0; i < corners.length; i++) {
            // Create cube handle
            const handle = MeshBuilder.CreateBox(
                `scale_handle_${i}`,
                { size: this.config.handleSize },
                this.scene
            );

            // Setup handle properties
            handle.material = this.materials.idle;
            handle.parent = this.rootNode;
            handle.isPickable = true;
            handle.renderingGroupId = GIZMO_RENDER_PRIORITY;

            // Store metadata for identification
            handle.metadata = {
                isScaleGizmoHandle: true,
                handleIndex: i
            };

            // Store handle data
            this.handles.push({
                mesh: handle,
                index: i,
                localOffset: corners[i],
                isHovered: false
            });
        }
    }

    /**
     * Create center indicator sphere
     */
    private createCenterIndicator(): void {
        if (!this.rootNode || !this.materials) return;

        this.centerIndicator = MeshBuilder.CreateSphere(
            'scale_center_indicator',
            { diameter: this.config.handleSize * 0.5 },
            this.scene
        );

        this.centerIndicator.material = this.materials.center;
        this.centerIndicator.parent = this.rootNode;
        this.centerIndicator.isPickable = false;
        this.centerIndicator.renderingGroupId = GIZMO_RENDER_PRIORITY;
    }

    // ========================================================================
    // ATTACHMENT
    // ========================================================================

    /**
     * Attach gizmo to a target object
     * 
     * @param target - Transform node to attach to
     * @param boundingRadius - Object's bounding radius
     * @param currentScale - Object's current scale
     */
    attachToObject(
        target: TransformNode,
        boundingRadius: number,
        currentScale: number
    ): void {
        try {
            this.attachedTarget = target;
            this.targetRadius = boundingRadius;
            this.currentScale = currentScale;

            // Position gizmo at target
            this.updatePosition();

            // Update handle positions based on bounding size
            this.updateHandlePositions();

            // Show gizmo
            this.setVisible(true);

            console.log(`${LOG_PREFIX} Attached to ${target.name}`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error attaching to object:`, error);
        }
    }

    /**
     * Detach gizmo from current target
     */
    detach(): void {
        if (!this.attachedTarget) return;

        // Cancel any active drag
        this.cancelDrag();

        // Hide gizmo
        this.setVisible(false);

        // Clear reference
        const targetName = this.attachedTarget.name;
        this.attachedTarget = null;

        console.log(`${LOG_PREFIX} Detached from ${targetName}`);
    }

    /**
     * Update gizmo position to match target
     */
    updatePosition(): void {
        if (!this.rootNode || !this.attachedTarget) return;

        this.rootNode.position = this.attachedTarget.position.clone();
    }

    /**
     * Update handle positions based on target size
     */
    private updateHandlePositions(): void {
        if (!this.handles.length) return;

        // Calculate handle offset based on bounding radius
        const offset = calculateHandleOffset(
            this.targetRadius * this.currentScale,
            1.0 + this.config.handleOffset
        );

        for (const handle of this.handles) {
            handle.mesh.position = handle.localOffset.scale(offset);
        }
    }

    /**
     * Update the current scale value
     * Call this when scale changes externally
     * 
     * @param newScale - New scale value
     */
    updateScale(newScale: number): void {
        this.currentScale = newScale;
        this.updateHandlePositions();
    }

    // ========================================================================
    // POINTER EVENTS
    // ========================================================================

    /**
     * Setup pointer event handling
     */
    private setupPointerEvents(): void {
        this.pointerObserver = this.scene.onPointerObservable.add((pointerInfo) => {
            if (!this._enabled || !this._visible) return;

            switch (pointerInfo.type) {
                case PointerEventTypes.POINTERMOVE:
                    this.onPointerMove(pointerInfo);
                    break;
                case PointerEventTypes.POINTERDOWN:
                    this.onPointerDown(pointerInfo);
                    break;
                case PointerEventTypes.POINTERUP:
                    this.onPointerUp(pointerInfo);
                    break;
            }
        });
    }

    /**
     * Handle pointer move
     */
    private onPointerMove(pointerInfo: PointerInfo): void {
        if (this.dragState.isDragging) {
            // Update drag
            this.updateDrag(pointerInfo);
        } else {
            // Update hover state
            this.updateHover(pointerInfo);
        }
    }

    /**
     * Handle pointer down
     */
    private onPointerDown(pointerInfo: PointerInfo): void {
        // Only handle left click
        if (pointerInfo.event.button !== 0) return;

        // Check if we clicked a handle
        const handle = this.getPickedHandle(pointerInfo);
        if (handle) {
            this.startDrag(handle, pointerInfo);
        }
    }

    /**
     * Handle pointer up
     */
    private onPointerUp(pointerInfo: PointerInfo): void {
        if (this.dragState.isDragging) {
            this.endDrag();
        }
    }

    /**
     * Get the handle under the pointer (if any)
     */
    private getPickedHandle(pointerInfo: PointerInfo): HandleData | null {
        const pickResult = pointerInfo.pickInfo;
        if (!pickResult?.hit || !pickResult.pickedMesh) return null;

        const metadata = pickResult.pickedMesh.metadata;
        if (metadata?.isScaleGizmoHandle) {
            return this.handles[metadata.handleIndex] || null;
        }

        return null;
    }

    /**
     * Update hover state based on pointer position
     */
    private updateHover(pointerInfo: PointerInfo): void {
        if (!this.materials) return;

        const hoveredHandle = this.getPickedHandle(pointerInfo);

        for (const handle of this.handles) {
            const wasHovered = handle.isHovered;
            handle.isHovered = (handle === hoveredHandle);

            if (handle.isHovered !== wasHovered) {
                handle.mesh.material = handle.isHovered
                    ? this.materials.hover
                    : this.materials.idle;
            }
        }

        // Update state
        this.state = hoveredHandle ? 'hovering' : 'idle';

        // Update cursor
        if (this.scene.getEngine().getRenderingCanvas()) {
            const canvas = this.scene.getEngine().getRenderingCanvas()!;
            canvas.style.cursor = hoveredHandle ? 'nwse-resize' : 'default';
        }

        // Emit hover event
        if (hoveredHandle && this.state === 'hovering') {
            this.emit({
                type: 'gizmo-hover',
                timestamp: Date.now()
            });
        }
    }

    // ========================================================================
    // DRAGGING
    // ========================================================================

    /**
     * Start a drag operation
     */
    private startDrag(handle: HandleData, pointerInfo: PointerInfo): void {
        if (!this.materials) return;

        this.dragState = {
            isDragging: true,
            activeHandle: handle,
            startScreenPos: new Vector3(
                pointerInfo.event.clientX,
                pointerInfo.event.clientY,
                0
            ),
            startScale: this.currentScale,
            previewScale: this.currentScale
        };

        // Update visual state
        handle.mesh.material = this.materials.active;
        this.state = 'dragging';

        // Disable camera controls during drag (uses centralized helper)
        setCameraControlsEnabled(this.scene, false);

        // Emit event
        this.emit({
            type: 'gizmo-drag-start',
            scale: this.currentScale,
            timestamp: Date.now()
        });

        console.log(`${LOG_PREFIX} Started drag from scale ${this.currentScale}`);
    }

    /**
     * Update during drag
     */
    private updateDrag(pointerInfo: PointerInfo): void {
        if (!this.dragState.isDragging) return;

        // Calculate drag distance
        const currentScreenPos = new Vector3(
            pointerInfo.event.clientX,
            pointerInfo.event.clientY,
            0
        );

        // Use horizontal + vertical drag combined for uniform scale
        const deltaX = currentScreenPos.x - this.dragState.startScreenPos.x;
        const deltaY = -(currentScreenPos.y - this.dragState.startScreenPos.y); // Invert Y
        const dragDistance = deltaX + deltaY; // Combined for diagonal feel

        // Calculate new scale
        const newScale = calculateDragScale(
            this.dragState.startScale,
            dragDistance,
            200 // pixels per doubling
        );

        // Store preview
        this.dragState.previewScale = newScale;
        this.state = 'preview';

        // Emit preview event
        this.emit({
            type: 'scale-preview',
            scale: newScale,
            previousScale: this.currentScale,
            timestamp: Date.now()
        });
    }

    /**
     * End drag operation
     */
    private endDrag(): void {
        if (!this.dragState.isDragging || !this.materials) return;

        const finalScale = this.dragState.previewScale;
        const handle = this.dragState.activeHandle;

        // Reset handle visual
        if (handle) {
            handle.mesh.material = this.materials.idle;
            handle.isHovered = false;
        }

        // Re-enable camera controls (uses centralized helper - preserves button config)
        setCameraControlsEnabled(this.scene, true);

        // Reset cursor
        if (this.scene.getEngine().getRenderingCanvas()) {
            const canvas = this.scene.getEngine().getRenderingCanvas()!;
            canvas.style.cursor = 'default';
        }

        // Emit commit event
        this.emit({
            type: 'scale-commit',
            scale: finalScale,
            previousScale: this.dragState.startScale,
            timestamp: Date.now()
        });

        // Update current scale
        this.currentScale = finalScale;
        this.updateHandlePositions();

        // Emit drag end
        this.emit({
            type: 'gizmo-drag-end',
            scale: finalScale,
            timestamp: Date.now()
        });

        // Reset drag state
        this.dragState = {
            isDragging: false,
            activeHandle: null,
            startScreenPos: Vector3.Zero(),
            startScale: 1.0,
            previewScale: 1.0
        };

        this.state = 'idle';

        console.log(`${LOG_PREFIX} Ended drag at scale ${finalScale}`);
    }

    /**
     * Cancel current drag operation
     */
    cancelDrag(): void {
        if (!this.dragState.isDragging) return;

        const handle = this.dragState.activeHandle;
        if (handle && this.materials) {
            handle.mesh.material = this.materials.idle;
            handle.isHovered = false;
        }

        // Re-enable camera controls (uses centralized helper - preserves button config)
        setCameraControlsEnabled(this.scene, true);

        // Emit cancel event
        this.emit({
            type: 'scale-cancel',
            scale: this.dragState.startScale,
            timestamp: Date.now()
        });

        // Reset
        this.dragState = {
            isDragging: false,
            activeHandle: null,
            startScreenPos: Vector3.Zero(),
            startScale: 1.0,
            previewScale: 1.0
        };

        this.state = 'idle';

        console.log(`${LOG_PREFIX} Cancelled drag`);
    }

    // ========================================================================
    // AUTO-SIZING
    // ========================================================================

    /**
     * Setup auto-sizing based on camera distance
     */
    private setupAutoSizing(): void {
        this.renderObserver = this.scene.onBeforeRenderObservable.add(() => {
            if (!this._visible || !this.attachedTarget) return;

            this.updateAutoSize();
        });
    }

    /**
     * Update handle sizes based on camera distance
     */
    private updateAutoSize(): void {
        const camera = this.scene.activeCamera;
        if (!camera || !this.rootNode) return;

        // Calculate distance to gizmo
        const cameraPos = camera.position;
        const gizmoPos = this.rootNode.position;
        const distance = Vector3.Distance(cameraPos, gizmoPos);

        // Calculate auto-scaled handle size
        const newHandleSize = calculateAutoScaleGizmoSize(
            distance,
            this.config.handleSize,
            this.config.minVisibleSize,
            this.config.maxVisibleSize
        );

        // Update handle scales
        for (const handle of this.handles) {
            handle.mesh.scaling.setAll(newHandleSize / this.config.handleSize);
        }

        // Update center indicator
        if (this.centerIndicator) {
            this.centerIndicator.scaling.setAll(newHandleSize / this.config.handleSize);
        }
    }

    // ========================================================================
    // VISIBILITY & STATE
    // ========================================================================

    /**
     * Set gizmo visibility
     */
    setVisible(visible: boolean): void {
        this._visible = visible;

        if (this.rootNode) {
            this.rootNode.setEnabled(visible);
        }
    }

    /**
     * Get current visibility
     */
    isVisible(): boolean {
        return this._visible;
    }

    /**
     * Set gizmo enabled state
     */
    setEnabled(enabled: boolean): void {
        this._enabled = enabled;

        if (!enabled && this.dragState.isDragging) {
            this.cancelDrag();
        }
    }

    /**
     * Get enabled state
     */
    isEnabled(): boolean {
        return this._enabled;
    }

    /**
     * Get current interaction state
     */
    getState(): GizmoInteractionState {
        return this.state;
    }

    /**
     * Check if currently dragging
     */
    isDragging(): boolean {
        return this.dragState.isDragging;
    }

    /**
     * Get preview scale during drag
     */
    getPreviewScale(): number | null {
        return this.dragState.isDragging ? this.dragState.previewScale : null;
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
    // DISPOSAL
    // ========================================================================

    /**
     * Clean up all resources
     */
    dispose(): void {
        try {
            // Remove observers
            if (this.pointerObserver) {
                this.scene.onPointerObservable.remove(this.pointerObserver);
                this.pointerObserver = null;
            }

            if (this.renderObserver) {
                this.scene.onBeforeRenderObservable.remove(this.renderObserver);
                this.renderObserver = null;
            }

            // Dispose handles
            for (const handle of this.handles) {
                handle.mesh.dispose();
            }
            this.handles = [];

            // Dispose center indicator
            if (this.centerIndicator) {
                this.centerIndicator.dispose();
                this.centerIndicator = null;
            }

            // Dispose materials
            if (this.materials) {
                this.materials.idle.dispose();
                this.materials.hover.dispose();
                this.materials.active.dispose();
                this.materials.center.dispose();
                this.materials = null;
            }

            // Dispose root node
            if (this.rootNode) {
                this.rootNode.dispose();
                this.rootNode = null;
            }

            // Clear references
            this.attachedTarget = null;
            this.listeners = [];

            console.log(`${LOG_PREFIX} Disposed`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error during disposal:`, error);
        }
    }
}