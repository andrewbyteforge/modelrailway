/**
 * TrainController.ts - High-level train control and state management
 * 
 * Path: frontend/src/systems/train/TrainController.ts
 * 
 * Combines physics simulation and path following into a complete
 * train controller:
 * - Manages train model (mesh) reference
 * - Updates position and rotation each frame
 * - Handles selection and highlighting
 * - Provides unified control interface
 * - Coordinates with sound system
 * 
 * Each train on the layout has its own TrainController instance.
 * 
 * @module TrainController
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Scene } from '@babylonjs/core/scene';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Observable } from '@babylonjs/core/Misc/observable';
import { TrainPhysics, type TrainPhysicsState, type TrainDirection, type BrakeState } from './TrainPhysics';
import { TrainPathFollower, type TrackPosition, type WorldPose, type MovementResult } from './TrainPathFollower';
import { TrainSoundManager } from './TrainSoundManager';
import type { TrackGraph } from '../track/TrackGraph';
import type { PointsManager } from './PointsManager';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[TrainController]';

/** Selection glow color */
const SELECTION_COLOR = new Color3(0.2, 0.8, 0.2); // Green glow

/** Hover glow color */
const HOVER_COLOR = new Color3(0.5, 0.5, 1.0); // Blue glow

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Train identification and metadata
 */
export interface TrainInfo {
    /** Unique train ID */
    id: string;

    /** Display name */
    name: string;

    /** Category (locomotive, coach, wagon, etc.) */
    category: string;

    /** Model library entry ID (if from library) */
    libraryEntryId?: string;
}

/**
 * Complete train state for UI display
 */
export interface TrainState {
    /** Train info */
    info: TrainInfo;

    /** Physics state */
    physics: TrainPhysicsState;

    /** Is this train currently selected for control */
    isSelected: boolean;

    /** Is the train hovering (mouse over) */
    isHovered: boolean;

    /** Is the train on track */
    isOnTrack: boolean;

    /** Current edge ID (if on track) */
    currentEdgeId: string | null;

    /** World position */
    position: Vector3;
}

/**
 * Configuration options for TrainController
 */
export interface TrainControllerConfig {
    /** Physics configuration overrides */
    physicsConfig?: Partial<import('./TrainPhysics').TrainPhysicsConfig>;

    /** Enable sound effects */
    enableSound: boolean;

    /** Y offset for model positioning */
    modelYOffset: number;
}

/**
 * Events emitted by train controller
 */
export interface TrainEvents {
    /** Train was selected */
    selected: { trainId: string };

    /** Train was deselected */
    deselected: { trainId: string };

    /** Train reached a dead end */
    deadEnd: { trainId: string; nodeId: string };

    /** Train started moving */
    started: { trainId: string };

    /** Train stopped */
    stopped: { trainId: string };

    /** Horn was sounded */
    horn: { trainId: string };
}

// ============================================================================
// TRAIN CONTROLLER CLASS
// ============================================================================

/**
 * TrainController - Controls a single train
 * 
 * Manages all aspects of a train's operation:
 * - Physics simulation
 * - Track following
 * - Visual updates
 * - Sound effects
 * - Selection state
 * 
 * @example
 * ```typescript
 * const controller = new TrainController(
 *     scene, graph, pointsManager,
 *     trainMesh, { id: 'train1', name: 'Class 66', category: 'locomotive' }
 * );
 * controller.placeOnEdge(edgeId);
 * controller.setThrottle(0.5);
 * controller.setDirection('forward');
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

        // Collect all meshes from the model
        this.collectMeshes();

        // Setup materials
        this.setupMaterials();

        // Make meshes pickable
        this.setupPickable();

        console.log(`${LOG_PREFIX} Created controller for ${info.name} (${info.id})`);
    }

    /**
     * Collect all meshes from the root node
     */
    private collectMeshes(): void {
        if (this.rootNode instanceof Mesh) {
            this.meshes.push(this.rootNode);
        }

        const descendants = this.rootNode.getDescendants(false);
        for (const node of descendants) {
            if (node instanceof AbstractMesh) {
                this.meshes.push(node);
            }
        }

        // Store original materials
        for (const mesh of this.meshes) {
            this.originalMaterials.set(mesh, mesh.material);
        }
    }

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
        }

        return success;
    }

    // ========================================================================
    // CONTROL INTERFACE
    // ========================================================================

    /**
     * Set throttle position
     * @param value - 0 to 1
     */
    setThrottle(value: number): void {
        const wasStopped = this.physics.isStopped();
        this.physics.setThrottle(value);

        // Emit started event if we were stopped and now have throttle
        if (wasStopped && value > 0 && this.physics.getDirection() !== 'stopped') {
            this.onStarted.notifyObservers({ trainId: this.info.id });
        }
    }

    /**
     * Increase throttle by step
     * @param step - Amount to increase (default 0.1)
     */
    increaseThrottle(step: number = 0.1): void {
        this.physics.increaseThrottle(step);
    }

    /**
     * Decrease throttle by step
     * @param step - Amount to decrease (default 0.1)
     */
    decreaseThrottle(step: number = 0.1): void {
        this.physics.decreaseThrottle(step);
    }

    /**
     * Set direction of travel
     * @param dir - 'forward' or 'reverse'
     * @returns true if direction was set immediately
     */
    setDirection(dir: TrainDirection): boolean {
        return this.physics.setDirection(dir);
    }

    /**
     * Toggle direction
     * @returns true if toggled
     */
    toggleDirection(): boolean {
        return this.physics.toggleDirection();
    }

    /**
     * Apply brakes
     */
    applyBrake(): void {
        this.physics.applyBrake();
    }

    /**
     * Release brakes
     */
    releaseBrake(): void {
        this.physics.releaseBrake();
    }

    /**
     * Emergency brake
     */
    emergencyBrake(): void {
        this.physics.emergencyBrake();
    }

    /**
     * Sound the horn
     * @param duration - Horn duration in seconds (default 0.5)
     */
    soundHorn(duration: number = 0.5): void {
        this.soundManager?.playHorn(duration);
        this.onHorn.notifyObservers({ trainId: this.info.id });
        console.log(`${LOG_PREFIX} ${this.info.name}: TOOT!`);
    }

    // ========================================================================
    // UPDATE LOOP
    // ========================================================================

    /**
     * Update train state - call every frame
     * @param deltaTime - Time since last frame in seconds
     */
    update(deltaTime: number): void {
        // Update physics to get distance to move
        const distance = this.physics.update(deltaTime);

        // Check for stopped event
        const wasStopped = this.physics.isStopped();

        // Move along track if we have distance to cover
        if (Math.abs(distance) > 0.00001 && this.pathFollower.isOnTrack()) {
            const result = this.pathFollower.move(distance);

            // Check for dead end
            if (result.reachedDeadEnd) {
                console.log(`${LOG_PREFIX} ${this.info.name} reached dead end`);
                this.physics.emergencyStop();

                const trackPos = this.pathFollower.getTrackPosition();
                this.onDeadEnd.notifyObservers({
                    trainId: this.info.id,
                    nodeId: trackPos?.edgeId || 'unknown'
                });
            }

            // Update visual position
            this.updateModelTransform();
        }

        // Check for stopped event
        if (!wasStopped && this.physics.isStopped()) {
            this.onStopped.notifyObservers({ trainId: this.info.id });
        }

        // Update sound based on speed
        if (this.soundManager) {
            this.soundManager.updateMovementSound(this.physics.getSpeedPercent());
        }
    }

    /**
     * Update model transform from path follower pose
     */
    private updateModelTransform(): void {
        const pose = this.pathFollower.getWorldPose();
        if (!pose) return;

        this.rootNode.position.copyFrom(pose.position);

        if (this.rootNode.rotationQuaternion) {
            this.rootNode.rotationQuaternion.copyFrom(pose.rotation);
        } else {
            this.rootNode.rotationQuaternion = pose.rotation.clone();
        }
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

        console.log(`${LOG_PREFIX} ${this.info.name} selected`);
    }

    /**
     * Deselect this train
     */
    deselect(): void {
        if (!this.isSelected) return;

        this.isSelected = false;
        this.removeHighlight();
        this.onDeselected.notifyObservers({ trainId: this.info.id });

        console.log(`${LOG_PREFIX} ${this.info.name} deselected`);
    }

    /**
     * Toggle selection state
     */
    toggleSelection(): void {
        if (this.isSelected) {
            this.deselect();
        } else {
            this.select();
        }
    }

    /**
     * Set hover state
     * @param hovering - Is mouse hovering
     */
    setHovered(hovering: boolean): void {
        if (this.isHovered === hovering) return;

        this.isHovered = hovering;

        if (hovering && !this.isSelected) {
            this.applyHoverHighlight();
        } else if (!hovering && !this.isSelected) {
            this.removeHighlight();
        }
    }

    /**
     * Apply selection highlight to meshes
     */
    private applySelectionHighlight(): void {
        // For now, simple emissive boost
        for (const mesh of this.meshes) {
            const material = mesh.material as StandardMaterial;
            if (material && 'emissiveColor' in material) {
                material.emissiveColor = SELECTION_COLOR;
            }
        }
    }

    /**
     * Apply hover highlight to meshes
     */
    private applyHoverHighlight(): void {
        for (const mesh of this.meshes) {
            const material = mesh.material as StandardMaterial;
            if (material && 'emissiveColor' in material) {
                material.emissiveColor = HOVER_COLOR;
            }
        }
    }

    /**
     * Remove all highlighting
     */
    private removeHighlight(): void {
        for (const mesh of this.meshes) {
            const material = mesh.material as StandardMaterial;
            if (material && 'emissiveColor' in material) {
                material.emissiveColor = Color3.Black();
            }
        }
    }

    // ========================================================================
    // STATE QUERIES
    // ========================================================================

    /**
     * Get train ID
     * @returns Train ID
     */
    getId(): string {
        return this.info.id;
    }

    /**
     * Get train info
     * @returns Train info
     */
    getInfo(): TrainInfo {
        return { ...this.info };
    }

    /**
     * Check if train is selected
     * @returns true if selected
     */
    getIsSelected(): boolean {
        return this.isSelected;
    }

    /**
     * Get complete train state
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