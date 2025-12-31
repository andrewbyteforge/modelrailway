/**
 * TrainController.ts - Individual train controller
 * 
 * Path: frontend/src/systems/train/TrainController.ts
 * 
 * Manages a single train:
 * - Physics simulation (acceleration, braking, momentum)
 * - Path following along track graph
 * - Sound effects
 * - User interaction (selection, hovering)
 * 
 * @module TrainController
 * @author Model Railway Workbench
 * @version 1.1.0 - Fixed mesh collection for varied node types
 */

import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Observable } from '@babylonjs/core/Misc/observable';

import { TrainPhysics, type TrainPhysicsState, type TrainPhysicsConfig } from './TrainPhysics';
import { TrainPathFollower } from './TrainPathFollower';
import { TrainSoundManager } from './TrainSoundManager';
import type { TrackGraph } from '../track/TrackGraph';
import type { PointsManager } from './PointsManager';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[TrainController]';

/** Selection highlight color */
const SELECTION_COLOR = new Color3(0.2, 0.6, 1.0); // Blue

/** Hover highlight color */
const HOVER_COLOR = new Color3(0.8, 0.8, 0.2); // Yellow

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Train identification information
 */
export interface TrainInfo {
    /** Unique identifier */
    id: string;

    /** Display name */
    name: string;

    /** Category (locomotive, coach, wagon, etc.) */
    category: string;

    /** Optional library entry ID */
    libraryEntryId?: string;
}

/**
 * Train controller configuration
 */
export interface TrainControllerConfig {
    /** Enable sound effects */
    enableSound: boolean;

    /** Y offset for model positioning */
    modelYOffset: number;

    /** Physics configuration */
    physicsConfig?: Partial<TrainPhysicsConfig>;
}

/**
 * Train state snapshot
 */
export interface TrainState {
    /** Train info */
    info: TrainInfo;

    /** Physics state */
    physics: TrainPhysicsState;

    /** Is selected for control */
    isSelected: boolean;

    /** Is mouse hovering */
    isHovered: boolean;

    /** Is on track */
    isOnTrack: boolean;

    /** Current edge ID (if on track) */
    currentEdgeId: string | null;

    /** Current world position */
    position: Vector3;
}

// ============================================================================
// TRAIN CONTROLLER CLASS
// ============================================================================

/**
 * TrainController - Controls a single train
 * 
 * Manages physics, path following, and user interaction for one train.
 * 
 * @example
 * ```typescript
 * const controller = new TrainController(scene, graph, points, mesh, info);
 * controller.placeOnEdge('edge_0', 0.5);
 * 
 * // In render loop:
 * controller.update(deltaTime);
 * ```
 */
export class TrainController {
    // ========================================================================
    // PRIVATE STATE
    // ========================================================================

    /** Babylon scene */
    private scene: Scene;

    /** Train information */
    private info: TrainInfo;

    /** Configuration */
    private config: TrainControllerConfig;

    /** Physics simulation */
    private physics: TrainPhysics;

    /** Path following */
    private pathFollower: TrainPathFollower;

    /** Sound manager (optional) */
    private soundManager: TrainSoundManager | null = null;

    /** Root mesh/transform for the train model */
    private rootNode: TransformNode;

    /** All meshes that make up this train */
    private meshes: AbstractMesh[] = [];

    /** Original materials for restoration after highlight */
    private originalMaterials: Map<AbstractMesh, any> = new Map();

    /** Is this train selected for control */
    private isSelected: boolean = false;

    /** Is mouse hovering over this train */
    private isHovered: boolean = false;

    /** Selection glow material */
    private glowMaterial: StandardMaterial | null = null;

    // ========================================================================
    // OBSERVABLES
    // ========================================================================

    /** Emitted when train is selected */
    public onSelected: Observable<{ trainId: string }> = new Observable();

    /** Emitted when train is deselected */
    public onDeselected: Observable<{ trainId: string }> = new Observable();

    /** Emitted when train reaches dead end */
    public onDeadEnd: Observable<{ trainId: string; nodeId: string }> = new Observable();

    /** Emitted when train starts moving */
    public onStarted: Observable<{ trainId: string }> = new Observable();

    /** Emitted when train stops */
    public onStopped: Observable<{ trainId: string }> = new Observable();

    /** Emitted when horn sounds */
    public onHorn: Observable<{ trainId: string }> = new Observable();

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new TrainController
     * @param scene - Babylon scene
     * @param graph - Track graph
     * @param pointsManager - Points manager for route decisions
     * @param rootNode - Root transform/mesh of the train model
     * @param info - Train identification info
     * @param config - Optional configuration
     */
    constructor(
        scene: Scene,
        graph: TrackGraph,
        pointsManager: PointsManager,
        rootNode: TransformNode,
        info: TrainInfo,
        config?: Partial<TrainControllerConfig>
    ) {
        this.scene = scene;
        this.info = info;
        this.rootNode = rootNode;

        // Apply default config
        this.config = {
            enableSound: true,
            modelYOffset: 0,
            ...config
        };

        // Initialize physics
        this.physics = new TrainPhysics(config?.physicsConfig);

        // Initialize path follower
        this.pathFollower = new TrainPathFollower(graph, pointsManager, {
            heightOffset: this.config.modelYOffset
        });

        // Initialize sound manager if enabled
        if (this.config.enableSound) {
            this.soundManager = new TrainSoundManager(scene);
        }

        // Collect all meshes from the model (with robust handling)
        this.collectMeshes();

        // Setup materials
        this.setupMaterials();

        // Make meshes pickable
        this.setupPickable();

        console.log(`${LOG_PREFIX} Created controller for ${info.name} (${info.id})`);
        console.log(`${LOG_PREFIX}   Collected ${this.meshes.length} meshes`);
    }

    // ========================================================================
    // MESH COLLECTION
    // ========================================================================

    /**
     * Collect all meshes from the root node
     * Handles various node types robustly
     */
    private collectMeshes(): void {
        this.meshes = [];

        // Add root node if it's a mesh
        if (this.rootNode instanceof AbstractMesh) {
            this.meshes.push(this.rootNode);
        }

        // Try different methods to get descendants
        try {
            // Method 1: Use getDescendants if available
            if (typeof this.rootNode.getDescendants === 'function') {
                const descendants = this.rootNode.getDescendants(false);
                for (const node of descendants) {
                    if (node instanceof AbstractMesh) {
                        this.meshes.push(node);
                    }
                }
            }
            // Method 2: Use getChildMeshes if available (more direct)
            else if (typeof (this.rootNode as any).getChildMeshes === 'function') {
                const childMeshes = (this.rootNode as any).getChildMeshes(false);
                for (const mesh of childMeshes) {
                    if (mesh instanceof AbstractMesh && !this.meshes.includes(mesh)) {
                        this.meshes.push(mesh);
                    }
                }
            }
            // Method 3: Manual traversal using getChildren
            else if (typeof this.rootNode.getChildren === 'function') {
                this.traverseAndCollectMeshes(this.rootNode);
            }
            // Method 4: Last resort - check _children directly
            else if ((this.rootNode as any)._children) {
                this.traverseChildrenArray((this.rootNode as any)._children);
            }
        } catch (error) {
            console.warn(`${LOG_PREFIX} Error collecting meshes:`, error);
            // If all else fails, at least we have the root if it was a mesh
        }

        // Store original materials for highlight restoration
        for (const mesh of this.meshes) {
            this.originalMaterials.set(mesh, mesh.material);
        }

        // Log warning if no meshes found
        if (this.meshes.length === 0) {
            console.warn(`${LOG_PREFIX} No meshes found for ${this.info.name}`);
            console.warn(`${LOG_PREFIX}   Root node type: ${this.rootNode.constructor.name}`);
        }
    }

    /**
     * Recursively traverse and collect meshes using getChildren
     */
    private traverseAndCollectMeshes(node: TransformNode): void {
        try {
            const children = node.getChildren();
            for (const child of children) {
                if (child instanceof AbstractMesh) {
                    if (!this.meshes.includes(child)) {
                        this.meshes.push(child);
                    }
                }
                if (child instanceof TransformNode) {
                    this.traverseAndCollectMeshes(child);
                }
            }
        } catch (error) {
            // Silently continue if getChildren fails
        }
    }

    /**
     * Traverse a direct children array
     */
    private traverseChildrenArray(children: any[]): void {
        for (const child of children) {
            if (child instanceof AbstractMesh) {
                if (!this.meshes.includes(child)) {
                    this.meshes.push(child);
                }
            }
            if (child && child._children) {
                this.traverseChildrenArray(child._children);
            }
        }
    }

    // ========================================================================
    // SETUP
    // ========================================================================

    /**
     * Setup highlight materials
     */
    private setupMaterials(): void {
        // Create glow material for selection
        this.glowMaterial = new StandardMaterial(`${this.info.id}_glow`, this.scene);
        this.glowMaterial.emissiveColor = SELECTION_COLOR;
        this.glowMaterial.alpha = 0.5;
    }

    /**
     * Make meshes pickable for interaction
     */
    private setupPickable(): void {
        for (const mesh of this.meshes) {
            mesh.isPickable = true;
            // Store reference to controller on mesh for easy lookup
            (mesh as any).__trainController = this;
        }
    }

    // ========================================================================
    // PLACEMENT
    // ========================================================================

    /**
     * Place train on a specific track edge
     * @param edgeId - Edge to place on
     * @param t - Parametric position (0-1), default 0.5 (middle)
     * @param direction - Initial direction (1 = toward toNode)
     * @returns true if placement successful
     */
    placeOnEdge(edgeId: string, t: number = 0.5, direction: 1 | -1 = 1): boolean {
        const success = this.pathFollower.placeOnEdge(edgeId, t, direction);

        if (success) {
            // Set initial direction in physics
            this.physics.setDirection('forward');

            // Update visual position
            this.updateModelTransform();

            console.log(`${LOG_PREFIX} ${this.info.name} placed on edge ${edgeId}`);
        }

        return success;
    }

    /**
     * Place train at a node
     * @param nodeId - Node to place at
     * @param preferredEdgeId - Preferred edge to start on
     * @returns true if placement successful
     */
    placeAtNode(nodeId: string, preferredEdgeId?: string): boolean {
        const success = this.pathFollower.placeAtNode(nodeId, preferredEdgeId);

        if (success) {
            this.physics.setDirection('forward');
            this.updateModelTransform();
            console.log(`${LOG_PREFIX} ${this.info.name} placed at node ${nodeId}`);
        }

        return success;
    }

    // ========================================================================
    // UPDATE LOOP
    // ========================================================================

    /**
     * Update train simulation
     * @param deltaTime - Time since last update (seconds)
     */
    update(deltaTime: number): void {
        // Update physics
        this.physics.update(deltaTime);

        // Get current speed
        const speedMps = this.physics.getCurrentSpeed();

        // Move along track if we have speed
        if (speedMps > 0 && this.pathFollower.isOnTrack()) {
            const result = this.pathFollower.advance(speedMps * deltaTime);

            // Check for dead end
            if (result.hitDeadEnd) {
                this.physics.emergencyBrake();
                this.onDeadEnd.notifyObservers({
                    trainId: this.info.id,
                    nodeId: result.deadEndNodeId || 'unknown'
                });
            }
        }

        // Update model visual position
        this.updateModelTransform();

        // Update sound based on speed
        this.soundManager?.updateEngineSound(speedMps);
    }

    /**
     * Update the model's visual transform from path follower
     */
    private updateModelTransform(): void {
        const pose = this.pathFollower.getWorldPose();
        if (!pose || !this.rootNode) return;

        // Update position
        this.rootNode.position.copyFrom(pose.position);

        // Update rotation
        this.rootNode.rotationQuaternion = pose.rotation;
    }

    // ========================================================================
    // CONTROLS
    // ========================================================================

    /**
     * Set throttle level
     * @param level - Throttle 0-1
     */
    setThrottle(level: number): void {
        this.physics.setThrottle(level);

        // Check for start
        if (level > 0 && this.physics.getCurrentSpeed() === 0) {
            this.onStarted.notifyObservers({ trainId: this.info.id });
        }
    }

    /**
     * Increase throttle
     * @param amount - Amount to increase (default 0.1)
     */
    increaseThrottle(amount: number = 0.1): void {
        this.physics.increaseThrottle(amount);
    }

    /**
     * Decrease throttle
     * @param amount - Amount to decrease (default 0.1)
     */
    decreaseThrottle(amount: number = 0.1): void {
        this.physics.decreaseThrottle(amount);
    }

    /**
     * Apply brake
     * @param strength - Brake strength 0-1
     */
    brake(strength: number = 1.0): void {
        this.physics.applyBrake(strength);
    }

    /**
     * Release brake
     */
    releaseBrake(): void {
        this.physics.releaseBrake();
    }

    /**
     * Emergency brake - immediate stop
     */
    emergencyBrake(): void {
        this.physics.emergencyBrake();
        this.onStopped.notifyObservers({ trainId: this.info.id });
    }

    /**
     * Toggle direction (forward/reverse)
     */
    toggleDirection(): void {
        // Only allow direction change when nearly stopped
        if (this.physics.canChangeDirection()) {
            this.physics.toggleDirection();
            this.pathFollower.reverseDirection();
            console.log(`${LOG_PREFIX} ${this.info.name} direction: ${this.physics.getDirection()}`);
        }
    }

    /**
     * Set direction
     * @param direction - 'forward' or 'reverse'
     */
    setDirection(direction: 'forward' | 'reverse'): void {
        if (this.physics.canChangeDirection()) {
            const current = this.physics.getDirection();
            if (current !== direction) {
                this.physics.setDirection(direction);
                this.pathFollower.reverseDirection();
            }
        }
    }

    /**
     * Sound horn
     */
    soundHorn(): void {
        this.soundManager?.soundHorn();
        this.onHorn.notifyObservers({ trainId: this.info.id });
    }

    // ========================================================================
    // SELECTION
    // ========================================================================

    /**
     * Select this train for control
     */
    select(): void {
        if (this.isSelected) return;

        this.isSelected = true;
        this.applySelectionHighlight();
        this.onSelected.notifyObservers({ trainId: this.info.id });
        console.log(`${LOG_PREFIX} Selected: ${this.info.name}`);
    }

    /**
     * Deselect this train
     */
    deselect(): void {
        if (!this.isSelected) return;

        this.isSelected = false;
        this.removeHighlight();
        this.onDeselected.notifyObservers({ trainId: this.info.id });
        console.log(`${LOG_PREFIX} Deselected: ${this.info.name}`);
    }

    /**
     * Set hover state
     * @param hovering - Whether mouse is hovering
     */
    setHover(hovering: boolean): void {
        if (this.isHovered === hovering) return;

        this.isHovered = hovering;

        // Only apply hover highlight if not selected
        if (!this.isSelected) {
            if (hovering) {
                this.applyHoverHighlight();
            } else {
                this.removeHighlight();
            }
        }
    }

    /**
     * Apply selection highlight
     */
    private applySelectionHighlight(): void {
        for (const mesh of this.meshes) {
            if (mesh.material && 'emissiveColor' in mesh.material) {
                (mesh.material as any).emissiveColor = SELECTION_COLOR;
            }
        }
    }

    /**
     * Apply hover highlight
     */
    private applyHoverHighlight(): void {
        for (const mesh of this.meshes) {
            if (mesh.material && 'emissiveColor' in mesh.material) {
                (mesh.material as any).emissiveColor = HOVER_COLOR;
            }
        }
    }

    /**
     * Remove highlight
     */
    private removeHighlight(): void {
        for (const mesh of this.meshes) {
            if (mesh.material && 'emissiveColor' in mesh.material) {
                (mesh.material as any).emissiveColor = Color3.Black();
            }
        }
    }

    // ========================================================================
    // GETTERS
    // ========================================================================

    /**
     * Get train info
     * @returns Train info
     */
    getInfo(): TrainInfo {
        return { ...this.info };
    }

    /**
     * Get train state snapshot
     * @returns Current state
     */
    getState(): TrainState {
        const trackPos = this.pathFollower.getTrackPosition();

        return {
            info: { ...this.info },
            physics: this.physics.getState(),
            isSelected: this.isSelected,
            isHovered: this.isHovered,
            isOnTrack: this.pathFollower.isOnTrack(),
            currentEdgeId: trackPos?.edgeId || null,
            position: this.rootNode.position.clone()
        };
    }

    /**
     * Get physics state
     * @returns Physics state
     */
    getPhysicsState(): TrainPhysicsState {
        return this.physics.getState();
    }

    /**
     * Get root transform node
     * @returns Root node
     */
    getRootNode(): TransformNode {
        return this.rootNode;
    }

    /**
     * Get all meshes
     * @returns Array of meshes
     */
    getMeshes(): AbstractMesh[] {
        return [...this.meshes];
    }

    /**
     * Check if a mesh belongs to this train
     * @param mesh - Mesh to check
     * @returns true if mesh is part of this train
     */
    containsMesh(mesh: AbstractMesh): boolean {
        return this.meshes.includes(mesh) || mesh === this.rootNode;
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Dispose of controller and resources
     */
    dispose(): void {
        // Clear observables
        this.onSelected.clear();
        this.onDeselected.clear();
        this.onDeadEnd.clear();
        this.onStarted.clear();
        this.onStopped.clear();
        this.onHorn.clear();

        // Dispose sound manager
        this.soundManager?.dispose();

        // Dispose glow material
        this.glowMaterial?.dispose();

        // Clear mesh references
        for (const mesh of this.meshes) {
            (mesh as any).__trainController = undefined;
        }
        this.meshes = [];
        this.originalMaterials.clear();

        console.log(`${LOG_PREFIX} ${this.info.name} disposed`);
    }
}