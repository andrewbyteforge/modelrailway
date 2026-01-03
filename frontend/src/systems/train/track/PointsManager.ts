/**
 * PointsManager.ts - Manages railway points/switch states
 * 
 * Path: frontend/src/systems/train/PointsManager.ts
 * 
 * Handles the state of all railway points (switches/turnouts):
 * - Tracks which route is set for each point
 * - Provides route selection for train path finding
 * - Supports click-to-toggle interaction
 * - Visual feedback for point states
 * - Animation coordination (future)
 * 
 * In railway terminology:
 * - "Points" or "Turnout" = UK term for track switch
 * - "Normal" = Points set for the straight/main route
 * - "Reverse" = Points set for the diverging route
 * 
 * @module PointsManager
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Scene } from '@babylonjs/core/scene';
import { Observable } from '@babylonjs/core/Misc/observable';
import type { TrackPiece } from '../../track/TrackPiece';
import type { TrackSystem } from '../../track/TrackSystem';
import type { GraphEdge } from '../../track/TrackGraph';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[PointsManager]';

/** Animation duration for point blade movement in seconds */
const POINT_ANIMATION_DURATION = 0.25;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * State of a railway point
 */
export type PointState = 'normal' | 'reverse';

/**
 * Point route definition
 * Maps point state to the edge that should be used
 */
export interface PointRoutes {
    /** Edge ID for normal (straight/main) route */
    normalEdgeId: string;

    /** Edge ID for reverse (diverging) route */
    reverseEdgeId: string;

    /** Common connector node ID (the entry point) */
    commonNodeId: string;
}

/**
 * Complete point data
 */
export interface PointData {
    /** Track piece ID that contains this point */
    pieceId: string;

    /** Current state */
    state: PointState;

    /** Route definitions */
    routes: PointRoutes;

    /** Is the point currently animating */
    isAnimating: boolean;

    /** Animation progress (0-1) */
    animationProgress: number;

    /** Human-readable label */
    label: string;
}

/**
 * Event data for point state changes
 */
export interface PointChangeEvent {
    /** Piece ID */
    pieceId: string;

    /** Previous state */
    previousState: PointState;

    /** New state */
    newState: PointState;

    /** Was this a user-initiated change */
    userInitiated: boolean;
}

// ============================================================================
// POINTS MANAGER CLASS
// ============================================================================

/**
 * PointsManager - Controls railway point/switch states
 * 
 * Maintains the state of all points in the layout and provides
 * route selection for train path finding.
 * 
 * @example
 * ```typescript
 * const pointsManager = new PointsManager(scene, trackSystem);
 * pointsManager.initialize();
 * 
 * // Toggle a point
 * pointsManager.togglePoint(pieceId);
 * 
 * // Get route for path finding
 * const edgeId = pointsManager.getRouteForPiece(pieceId, fromEdge, nodeId);
 * ```
 */
export class PointsManager {
    // ========================================================================
    // PRIVATE STATE
    // ========================================================================

    /** Babylon scene reference */
    private scene: Scene;

    /** Track system reference */
    private trackSystem: TrackSystem;

    /** Map of piece ID to point data */
    private points: Map<string, PointData> = new Map();

    /** Observable for point state changes */
    public onPointChanged: Observable<PointChangeEvent> = new Observable();

    /** Point labels counter for auto-labeling */
    private labelCounter: number = 1;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new PointsManager
     * @param scene - Babylon scene
     * @param trackSystem - Track system reference
     */
    constructor(scene: Scene, trackSystem: TrackSystem) {
        this.scene = scene;
        this.trackSystem = trackSystem;

        console.log(`${LOG_PREFIX} Points manager created`);
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the points manager
     * Scans existing track for points and registers them
     */
    initialize(): void {
        console.log(`${LOG_PREFIX} Initializing...`);

        // Scan all existing track pieces for switches
        this.scanForPoints();

        // Setup event listeners for new track pieces
        this.setupTrackListeners();

        console.log(`${LOG_PREFIX} ✓ Initialized with ${this.points.size} points`);
    }

    /**
     * Scan all track pieces for switches/points
     */
    private scanForPoints(): void {
        const allPieces = this.trackSystem.getAllPieces();

        for (const piece of allPieces) {
            if (this.isPieceAPoint(piece)) {
                this.registerPoint(piece);
            }
        }
    }

    /**
     * Setup listeners for track system events
     */
    private setupTrackListeners(): void {
        // Listen for new pieces being added
        // The TrackSystem would need to expose an observable for this
        // For now, we'll provide a manual registration method
    }

    /**
     * Check if a track piece is a point/switch
     * @param piece - Track piece to check
     * @returns true if piece is a switch
     */
    private isPieceAPoint(piece: TrackPiece): boolean {
        const type = piece.catalogEntry.type;
        return type === 'switch' || type === 'curved_switch';
    }

    // ========================================================================
    // POINT REGISTRATION
    // ========================================================================

    /**
     * Register a track piece as a point
     * Called when a switch piece is placed
     * @param piece - The switch track piece
     */
    registerPoint(piece: TrackPiece): void {
        if (this.points.has(piece.id)) {
            console.log(`${LOG_PREFIX} Point ${piece.id} already registered`);
            return;
        }

        // Determine route edges based on piece type
        const routes = this.determineRoutes(piece);
        if (!routes) {
            console.error(`${LOG_PREFIX} Could not determine routes for point ${piece.id}`);
            return;
        }

        const pointData: PointData = {
            pieceId: piece.id,
            state: 'normal',
            routes,
            isAnimating: false,
            animationProgress: 0,
            label: `P${this.labelCounter++}`
        };

        this.points.set(piece.id, pointData);
        console.log(`${LOG_PREFIX} Registered point ${pointData.label} (${piece.id})`);
    }

    /**
     * Unregister a point when its track piece is removed
     * @param pieceId - ID of the piece being removed
     */
    unregisterPoint(pieceId: string): void {
        if (this.points.has(pieceId)) {
            const point = this.points.get(pieceId)!;
            this.points.delete(pieceId);
            console.log(`${LOG_PREFIX} Unregistered point ${point.label} (${pieceId})`);
        }
    }

    /**
     * Determine the routes for a switch piece
     * @param piece - The switch track piece
     * @returns Route definitions or null
     */
    private determineRoutes(piece: TrackPiece): PointRoutes | null {
        const catalog = piece.catalogEntry;
        const graph = this.trackSystem.getGraph();
        const edges = piece.generatedEdgeIds;

        if (edges.length < 2) {
            console.warn(`${LOG_PREFIX} Switch ${piece.id} has insufficient edges`);
            return null;
        }

        // Find common connector
        let commonConnector;
        if (catalog.type === 'switch') {
            commonConnector = piece.getConnector('COMMON');
        } else if (catalog.type === 'curved_switch') {
            commonConnector = piece.getConnector('COMMON');
        }

        if (!commonConnector?.nodeId) {
            console.warn(`${LOG_PREFIX} Switch ${piece.id} missing common connector`);
            return null;
        }

        // Get the edges from this piece
        const pieceEdges = edges.map(id => graph.getEdge(id)).filter(e => e !== undefined) as GraphEdge[];

        // For standard switch: first edge is straight, second is diverging
        // For curved switch: first is inner route, second is outer route
        let normalEdge: GraphEdge | undefined;
        let reverseEdge: GraphEdge | undefined;

        if (catalog.type === 'switch') {
            // Standard switch - straight route is "normal"
            normalEdge = pieceEdges.find(e => {
                // Straight edge typically has 'straight' curve type
                return e.curve.type === 'straight';
            });
            reverseEdge = pieceEdges.find(e => e !== normalEdge);
        } else if (catalog.type === 'curved_switch') {
            // Curved switch - outer (larger angle) is typically "normal"
            // Inner (smaller angle) is "reverse"
            // For now, use order from edges array
            normalEdge = pieceEdges[1]; // Outer route
            reverseEdge = pieceEdges[0]; // Inner route
        }

        if (!normalEdge || !reverseEdge) {
            console.warn(`${LOG_PREFIX} Could not identify routes for ${piece.id}`);
            // Fallback to first two edges
            normalEdge = pieceEdges[0];
            reverseEdge = pieceEdges[1];
        }

        return {
            normalEdgeId: normalEdge.id,
            reverseEdgeId: reverseEdge.id,
            commonNodeId: commonConnector.nodeId
        };
    }

    // ========================================================================
    // POINT CONTROL
    // ========================================================================

    /**
     * Set the state of a point
     * @param pieceId - ID of the switch piece
     * @param state - Desired state
     * @param userInitiated - Was this triggered by user interaction
     * @returns true if state was changed
     */
    setPointState(pieceId: string, state: PointState, userInitiated: boolean = false): boolean {
        const point = this.points.get(pieceId);
        if (!point) {
            console.warn(`${LOG_PREFIX} Point ${pieceId} not found`);
            return false;
        }

        if (point.state === state) {
            return false; // No change needed
        }

        const previousState = point.state;
        point.state = state;

        // Trigger animation
        this.animatePoint(point);

        // Notify observers
        this.onPointChanged.notifyObservers({
            pieceId,
            previousState,
            newState: state,
            userInitiated
        });

        console.log(`${LOG_PREFIX} Point ${point.label} set to ${state}`);
        return true;
    }

    /**
     * Toggle a point between normal and reverse
     * @param pieceId - ID of the switch piece
     * @param userInitiated - Was this triggered by user interaction
     * @returns New state or null if point not found
     */
    togglePoint(pieceId: string, userInitiated: boolean = true): PointState | null {
        const point = this.points.get(pieceId);
        if (!point) {
            console.warn(`${LOG_PREFIX} Point ${pieceId} not found`);
            return null;
        }

        const newState: PointState = point.state === 'normal' ? 'reverse' : 'normal';
        this.setPointState(pieceId, newState, userInitiated);
        return newState;
    }

    /**
     * Get the current state of a point
     * @param pieceId - ID of the switch piece
     * @returns Current state or null if not found
     */
    getPointState(pieceId: string): PointState | null {
        const point = this.points.get(pieceId);
        return point ? point.state : null;
    }

    /**
     * Get complete data for a point
     * @param pieceId - ID of the switch piece
     * @returns Point data or null
     */
    getPointData(pieceId: string): PointData | null {
        const point = this.points.get(pieceId);
        return point ? { ...point } : null;
    }

    /**
     * Get all registered points
     * @returns Array of point data
     */
    getAllPoints(): PointData[] {
        return Array.from(this.points.values()).map(p => ({ ...p }));
    }

    // ========================================================================
    // ROUTE SELECTION (for TrainPathFollower)
    // ========================================================================

    /**
     * Get the route (edge) to take when a train passes through a point
     * 
     * @param pieceId - ID of the switch piece
     * @param fromEdgeId - Edge the train is coming from
     * @param nodeId - Node being passed through
     * @returns Edge ID to take, or null if not applicable
     */
    getRouteForPiece(pieceId: string, fromEdgeId: string, nodeId: string): string | null {
        const point = this.points.get(pieceId);
        if (!point) {
            return null; // Not a registered point
        }

        // Check if this is the common node (entry point of the switch)
        if (nodeId !== point.routes.commonNodeId) {
            // Train is entering from diverging/straight end
            // In this case, they must take the only available route back to common
            // Return whichever edge we're not on
            if (fromEdgeId === point.routes.normalEdgeId) {
                return null; // Continue to common node
            } else if (fromEdgeId === point.routes.reverseEdgeId) {
                return null; // Continue to common node
            }
            return null;
        }

        // Train is at common node, needs to choose route
        if (point.state === 'normal') {
            return point.routes.normalEdgeId;
        } else {
            return point.routes.reverseEdgeId;
        }
    }

    /**
     * Check if a piece ID is a registered point
     * @param pieceId - Piece ID to check
     * @returns true if registered as a point
     */
    isPoint(pieceId: string): boolean {
        return this.points.has(pieceId);
    }

    // ========================================================================
    // ANIMATION
    // ========================================================================

    /**
     * Animate point blade movement
     * @param point - Point to animate
     */
    private animatePoint(point: PointData): void {
        if (point.isAnimating) {
            // Already animating - skip
            return;
        }

        point.isAnimating = true;
        point.animationProgress = 0;

        const startTime = performance.now();
        const duration = POINT_ANIMATION_DURATION * 1000; // Convert to ms

        const animate = () => {
            const elapsed = performance.now() - startTime;
            point.animationProgress = Math.min(1, elapsed / duration);

            // Update visual representation
            this.updatePointVisual(point);

            if (point.animationProgress < 1) {
                requestAnimationFrame(animate);
            } else {
                point.isAnimating = false;
                point.animationProgress = 1;
            }
        };

        requestAnimationFrame(animate);
    }

    /**
     * Update visual representation of a point
     * This would update meshes, colors, etc.
     * @param point - Point to update
     */
    private updatePointVisual(point: PointData): void {
        // TODO: Implement visual updates
        // This could involve:
        // - Animating blade mesh position
        // - Changing indicator colors
        // - Playing sound effect at completion

        // For now, just log the progress
        if (point.animationProgress === 1) {
            console.log(`${LOG_PREFIX} Point ${point.label} animation complete`);
        }
    }

    // ========================================================================
    // CLICK INTERACTION
    // ========================================================================

    /**
     * Handle a click on a track piece
     * If it's a point, toggle it
     * @param pieceId - Clicked piece ID
     * @returns true if a point was toggled
     */
    handlePieceClick(pieceId: string): boolean {
        if (this.points.has(pieceId)) {
            this.togglePoint(pieceId, true);
            return true;
        }
        return false;
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Clean up all resources
     */
    dispose(): void {
        this.points.clear();
        this.onPointChanged.clear();
        console.log(`${LOG_PREFIX} Disposed`);
    }
}