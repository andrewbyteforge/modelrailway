/**
 * PointsIndicator.ts - Visual indicators for railway point states
 * 
 * Path: frontend/src/systems/train/PointsIndicator.ts
 * 
 * Provides visual feedback for point/switch states:
 * - Color-coded arrows showing current route
 * - Animated transition when points change
 * - Click highlighting for interaction feedback
 * - Optional labels for identification
 * 
 * Integrates with PointsManager to reflect current states.
 * 
 * @module PointsIndicator
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { PointsManager, type PointData, type PointState } from './PointsManager';
import type { TrackSystem } from '../track/TrackSystem';
import type { TrackPiece } from '../track/TrackPiece';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[PointsIndicator]';

/** Indicator visual parameters */
const INDICATOR_CONFIG = {
    /** Height above track surface */
    HEIGHT_OFFSET: 0.015,

    /** Arrow length */
    ARROW_LENGTH: 0.020,

    /** Arrow width */
    ARROW_WIDTH: 0.008,

    /** Arrow thickness */
    ARROW_THICKNESS: 0.003,

    /** Label offset above arrow */
    LABEL_OFFSET: 0.025
};

/** Colors for point states */
const POINT_COLORS = {
    /** Normal (straight) route - green */
    NORMAL: new Color3(0.2, 0.8, 0.2),

    /** Reverse (diverging) route - amber/yellow */
    REVERSE: new Color3(1.0, 0.7, 0.0),

    /** Animating/transitioning - red */
    ANIMATING: new Color3(1.0, 0.3, 0.3),

    /** Hover highlight */
    HOVER: new Color3(0.5, 0.8, 1.0)
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Visual data for a single point indicator
 */
interface IndicatorVisual {
    /** Parent transform node */
    root: TransformNode;

    /** Arrow mesh for normal route */
    normalArrow: Mesh;

    /** Arrow mesh for diverging route */
    divergingArrow: Mesh;

    /** Piece ID this indicator is for */
    pieceId: string;

    /** Current displayed state */
    displayedState: PointState;

    /** Is currently hovered */
    isHovered: boolean;
}

/**
 * Configuration for points indicator system
 */
export interface PointsIndicatorConfig {
    /** Show indicators by default */
    showByDefault: boolean;

    /** Show point labels */
    showLabels: boolean;

    /** Arrow scale multiplier */
    arrowScale: number;
}

// ============================================================================
// POINTS INDICATOR CLASS
// ============================================================================

/**
 * PointsIndicator - Visual representation of railway point states
 * 
 * Creates arrow indicators at each point showing which route is set.
 * Arrows are color-coded and animate when points change.
 * 
 * @example
 * ```typescript
 * const indicator = new PointsIndicator(scene, trackSystem, pointsManager);
 * indicator.initialize();
 * 
 * // Toggle visibility
 * indicator.setVisible(false);
 * ```
 */
export class PointsIndicator {
    // ========================================================================
    // PRIVATE STATE
    // ========================================================================

    /** Babylon scene */
    private scene: Scene;

    /** Track system reference */
    private trackSystem: TrackSystem;

    /** Points manager reference */
    private pointsManager: PointsManager;

    /** Configuration */
    private config: PointsIndicatorConfig;

    /** Map of piece ID to visual data */
    private visuals: Map<string, IndicatorVisual> = new Map();

    /** Shared materials */
    private materials: {
        normal: StandardMaterial;
        reverse: StandardMaterial;
        animating: StandardMaterial;
        hover: StandardMaterial;
        inactive: StandardMaterial;
    } | null = null;

    /** Are indicators currently visible */
    private isVisible: boolean = true;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new PointsIndicator system
     * @param scene - Babylon scene
     * @param trackSystem - Track system reference
     * @param pointsManager - Points manager reference
     * @param config - Optional configuration
     */
    constructor(
        scene: Scene,
        trackSystem: TrackSystem,
        pointsManager: PointsManager,
        config?: Partial<PointsIndicatorConfig>
    ) {
        this.scene = scene;
        this.trackSystem = trackSystem;
        this.pointsManager = pointsManager;

        this.config = {
            showByDefault: true,
            showLabels: false,
            arrowScale: 1.0,
            ...config
        };

        console.log(`${LOG_PREFIX} Points indicator created`);
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the indicator system
     */
    initialize(): void {
        console.log(`${LOG_PREFIX} Initializing...`);

        // Create shared materials
        this.createMaterials();

        // Create indicators for existing points
        this.createAllIndicators();

        // Listen for point changes
        this.setupListeners();

        // Set initial visibility
        this.isVisible = this.config.showByDefault;
        this.updateAllVisibility();

        console.log(`${LOG_PREFIX} ✓ Initialized with ${this.visuals.size} indicators`);
    }

    /**
     * Create shared materials for indicators
     */
    private createMaterials(): void {
        // Normal state material (green)
        const normalMat = new StandardMaterial('pointIndicator_normal', this.scene);
        normalMat.diffuseColor = POINT_COLORS.NORMAL;
        normalMat.emissiveColor = POINT_COLORS.NORMAL.scale(0.5);
        normalMat.specularColor = Color3.White();

        // Reverse state material (amber)
        const reverseMat = new StandardMaterial('pointIndicator_reverse', this.scene);
        reverseMat.diffuseColor = POINT_COLORS.REVERSE;
        reverseMat.emissiveColor = POINT_COLORS.REVERSE.scale(0.5);
        reverseMat.specularColor = Color3.White();

        // Animating material (red)
        const animatingMat = new StandardMaterial('pointIndicator_animating', this.scene);
        animatingMat.diffuseColor = POINT_COLORS.ANIMATING;
        animatingMat.emissiveColor = POINT_COLORS.ANIMATING.scale(0.5);
        animatingMat.specularColor = Color3.White();

        // Hover material (blue)
        const hoverMat = new StandardMaterial('pointIndicator_hover', this.scene);
        hoverMat.diffuseColor = POINT_COLORS.HOVER;
        hoverMat.emissiveColor = POINT_COLORS.HOVER.scale(0.5);
        hoverMat.specularColor = Color3.White();

        // Inactive material (grey)
        const inactiveMat = new StandardMaterial('pointIndicator_inactive', this.scene);
        inactiveMat.diffuseColor = new Color3(0.3, 0.3, 0.3);
        inactiveMat.emissiveColor = Color3.Black();
        inactiveMat.alpha = 0.5;

        this.materials = {
            normal: normalMat,
            reverse: reverseMat,
            animating: animatingMat,
            hover: hoverMat,
            inactive: inactiveMat
        };
    }

    /**
     * Create indicators for all registered points
     */
    private createAllIndicators(): void {
        const allPoints = this.pointsManager.getAllPoints();

        for (const point of allPoints) {
            this.createIndicatorForPoint(point);
        }
    }

    /**
     * Setup event listeners
     */
    private setupListeners(): void {
        // Listen for point state changes
        this.pointsManager.onPointChanged.add((event) => {
            this.updateIndicatorState(event.pieceId);
        });
    }

    // ========================================================================
    // INDICATOR CREATION
    // ========================================================================

    /**
     * Create indicator visuals for a point
     * @param point - Point data
     */
    private createIndicatorForPoint(point: PointData): void {
        if (this.visuals.has(point.pieceId)) {
            return; // Already exists
        }

        // Get the track piece to find position
        const piece = this.trackSystem.getPiece(point.pieceId);
        if (!piece) {
            console.warn(`${LOG_PREFIX} Cannot create indicator - piece ${point.pieceId} not found`);
            return;
        }

        // Get common connector position (the entry point of the switch)
        const commonConnector = piece.getConnector('COMMON');
        if (!commonConnector?.worldPos) {
            console.warn(`${LOG_PREFIX} Cannot find common connector for ${point.pieceId}`);
            return;
        }

        // Create parent transform
        const root = new TransformNode(`pointIndicator_${point.pieceId}`, this.scene);
        root.position = commonConnector.worldPos.clone();
        root.position.y += INDICATOR_CONFIG.HEIGHT_OFFSET;

        // Rotate to face along the track
        if (commonConnector.worldForward) {
            const angle = Math.atan2(commonConnector.worldForward.x, commonConnector.worldForward.z);
            root.rotation.y = angle;
        }

        // Create arrows
        const normalArrow = this.createArrowMesh(
            `pointArrow_normal_${point.pieceId}`,
            0 // Straight ahead
        );
        normalArrow.parent = root;

        // Determine diverging angle based on switch type
        const divergeAngle = this.getDivergingAngle(piece);
        const divergingArrow = this.createArrowMesh(
            `pointArrow_diverging_${point.pieceId}`,
            divergeAngle
        );
        divergingArrow.parent = root;

        // Store visual data
        const visual: IndicatorVisual = {
            root,
            normalArrow,
            divergingArrow,
            pieceId: point.pieceId,
            displayedState: point.state,
            isHovered: false
        };

        this.visuals.set(point.pieceId, visual);

        // Apply initial state
        this.updateIndicatorMaterials(visual, point.state, false);
    }

    /**
     * Create an arrow mesh
     * @param name - Mesh name
     * @param angle - Rotation angle in radians
     * @returns Arrow mesh
     */
    private createArrowMesh(name: string, angle: number): Mesh {
        const scale = this.config.arrowScale;
        const length = INDICATOR_CONFIG.ARROW_LENGTH * scale;
        const width = INDICATOR_CONFIG.ARROW_WIDTH * scale;
        const thickness = INDICATOR_CONFIG.ARROW_THICKNESS * scale;

        // Create arrow shape using a box with tapered front
        // For simplicity, use a box - could be replaced with custom geometry
        const arrow = MeshBuilder.CreateBox(name, {
            width: width,
            height: thickness,
            depth: length
        }, this.scene);

        // Position so base is at origin
        arrow.position.z = length / 2;

        // Apply rotation for diverging route
        if (angle !== 0) {
            arrow.rotation.y = angle;
        }

        // Make pickable for interaction
        arrow.isPickable = true;

        return arrow;
    }

    /**
     * Get the diverging angle for a switch piece
     * @param piece - Track piece
     * @returns Angle in radians
     */
    private getDivergingAngle(piece: TrackPiece): number {
        const catalog = piece.catalogEntry;
        const angleDeg = catalog.curveAngleDeg || 22.5;
        const direction = catalog.curveDirection || 1;

        // Convert to radians and apply direction
        return (angleDeg * Math.PI / 180) * direction;
    }

    // ========================================================================
    // STATE UPDATES
    // ========================================================================

    /**
     * Update indicator state for a point
     * @param pieceId - Piece ID
     */
    private updateIndicatorState(pieceId: string): void {
        const visual = this.visuals.get(pieceId);
        if (!visual) return;

        const point = this.pointsManager.getPointData(pieceId);
        if (!point) return;

        // Update materials with animation state
        this.updateIndicatorMaterials(visual, point.state, point.isAnimating);
        visual.displayedState = point.state;
    }

    /**
     * Update materials for an indicator based on state
     * @param visual - Visual data
     * @param state - Current point state
     * @param isAnimating - Is the point currently animating
     */
    private updateIndicatorMaterials(
        visual: IndicatorVisual,
        state: PointState,
        isAnimating: boolean
    ): void {
        if (!this.materials) return;

        if (isAnimating) {
            // Both arrows show animating color
            visual.normalArrow.material = this.materials.animating;
            visual.divergingArrow.material = this.materials.animating;
        } else if (state === 'normal') {
            // Normal route is active (green), diverging is inactive
            visual.normalArrow.material = this.materials.normal;
            visual.divergingArrow.material = this.materials.inactive;
        } else {
            // Diverging route is active (amber), normal is inactive
            visual.normalArrow.material = this.materials.reverse;
            visual.divergingArrow.material = this.materials.inactive;
        }
    }

    /**
     * Set hover state for an indicator
     * @param pieceId - Piece ID
     * @param isHovered - Is being hovered
     */
    setHovered(pieceId: string, isHovered: boolean): void {
        const visual = this.visuals.get(pieceId);
        if (!visual || visual.isHovered === isHovered) return;

        visual.isHovered = isHovered;

        if (isHovered && this.materials) {
            // Apply hover highlight to active arrow
            const point = this.pointsManager.getPointData(pieceId);
            if (point) {
                if (point.state === 'normal') {
                    visual.normalArrow.material = this.materials.hover;
                } else {
                    visual.divergingArrow.material = this.materials.hover;
                }
            }
        } else {
            // Restore normal materials
            this.updateIndicatorState(pieceId);
        }
    }

    // ========================================================================
    // VISIBILITY CONTROL
    // ========================================================================

    /**
     * Set visibility of all indicators
     * @param visible - Should indicators be visible
     */
    setVisible(visible: boolean): void {
        if (this.isVisible === visible) return;

        this.isVisible = visible;
        this.updateAllVisibility();

        console.log(`${LOG_PREFIX} Indicators ${visible ? 'shown' : 'hidden'}`);
    }

    /**
     * Toggle visibility
     * @returns New visibility state
     */
    toggleVisibility(): boolean {
        this.setVisible(!this.isVisible);
        return this.isVisible;
    }

    /**
     * Get current visibility state
     * @returns true if visible
     */
    getVisible(): boolean {
        return this.isVisible;
    }

    /**
     * Update visibility of all indicator meshes
     */
    private updateAllVisibility(): void {
        for (const visual of this.visuals.values()) {
            visual.root.setEnabled(this.isVisible);
        }
    }

    // ========================================================================
    // INDICATOR MANAGEMENT
    // ========================================================================

    /**
     * Add indicator for a new point
     * @param pieceId - Piece ID
     */
    addIndicator(pieceId: string): void {
        const point = this.pointsManager.getPointData(pieceId);
        if (point) {
            this.createIndicatorForPoint(point);

            // Apply current visibility
            const visual = this.visuals.get(pieceId);
            if (visual) {
                visual.root.setEnabled(this.isVisible);
            }
        }
    }

    /**
     * Remove indicator for a point
     * @param pieceId - Piece ID
     */
    removeIndicator(pieceId: string): void {
        const visual = this.visuals.get(pieceId);
        if (!visual) return;

        // Dispose meshes
        visual.normalArrow.dispose();
        visual.divergingArrow.dispose();
        visual.root.dispose();

        this.visuals.delete(pieceId);
    }

    /**
     * Refresh all indicators (recreate from current points)
     */
    refresh(): void {
        // Remove all existing
        for (const pieceId of this.visuals.keys()) {
            this.removeIndicator(pieceId);
        }

        // Recreate
        this.createAllIndicators();
        this.updateAllVisibility();
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Dispose of all resources
     */
    dispose(): void {
        // Dispose all visuals
        for (const pieceId of this.visuals.keys()) {
            this.removeIndicator(pieceId);
        }
        this.visuals.clear();

        // Dispose materials
        if (this.materials) {
            this.materials.normal.dispose();
            this.materials.reverse.dispose();
            this.materials.animating.dispose();
            this.materials.hover.dispose();
            this.materials.inactive.dispose();
        }

        console.log(`${LOG_PREFIX} Disposed`);
    }
}