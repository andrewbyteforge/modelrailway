/**
 * TrackModelPlacer.ts - Handles placing models on track pieces
 * 
 * Path: frontend/src/systems/models/TrackModelPlacer.ts
 * 
 * This system handles the placement of rolling stock models onto track:
 * - Detects track pieces in the scene
 * - Uses TrackGraph for accurate position and direction calculation
 * - Snaps models to track with correct orientation facing along track direction
 * - Provides visual feedback during placement
 * 
 * UPDATED: Now integrates with TrackGraph for accurate track direction
 * - Trains now face the same direction as the track edge (fromNode → toNode)
 * - Falls back to mesh-based calculation if graph not available
 * 
 * Model Forward Axis:
 * - Models are expected to face along positive Z-axis by default
 * - If your model faces a different direction, use setModelForwardAxis()
 * - Console utility: window.setTrainOrientation('NEG_Y') etc.
 * 
 * @module TrackModelPlacer
 * @author Model Railway Workbench
 * @version 2.0.0 - TrackGraph integration for correct orientation
 */

import { Scene } from '@babylonjs/core/scene';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { Ray } from '@babylonjs/core/Culling/ray';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { PickingInfo } from '@babylonjs/core/Collisions/pickingInfo';
import type { TrackGraph, GraphEdge, GraphNode, CurveDefinition } from '../track/TrackGraph';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[TrackModelPlacer]';

/** OO Gauge track specifications */
const OO_GAUGE = {
    /** Track gauge in meters (16.5mm) */
    GAUGE_M: 0.0165,
    /** Rail height in meters (3mm) */
    RAIL_HEIGHT_M: 0.003,
    /** Height above rail for model placement (1mm clearance) */
    MODEL_HEIGHT_OFFSET_M: 0.001,
} as const;

/** Snap configuration */
const SNAP_CONFIG = {
    /** Maximum distance from track centerline for valid placement (meters) */
    MAX_DISTANCE_M: 0.05,
    /** Search radius for finding track meshes */
    SEARCH_RADIUS_M: 0.1,
    /** Number of samples along edge for finding closest point */
    SAMPLES_PER_EDGE: 20,
} as const;

/**
 * Model forward axis configuration
 * 
 * Defines which local axis the model's "front" points along.
 * This is crucial for correct rotation alignment on tracks.
 * 
 * Common conventions:
 * - Blender (default): -Y forward, Z up → use 'NEG_Y'
 * - 3ds Max: Y forward, Z up → use 'POS_Y'
 * - Some exports: X forward → use 'POS_X' or 'NEG_X'
 * - Unity convention: Z forward → use 'POS_Z'
 * 
 * If your train faces sideways on the track, try a different axis.
 */
export type ModelForwardAxis = 'POS_X' | 'NEG_X' | 'POS_Y' | 'NEG_Y' | 'POS_Z' | 'NEG_Z';

/**
 * Rotation offsets for each forward axis convention
 * These are added to the track angle to align the model correctly
 */
const FORWARD_AXIS_OFFSETS: Record<ModelForwardAxis, number> = {
    'POS_Z': 0,                    // Model faces +Z, no offset needed
    'NEG_Z': Math.PI,              // Model faces -Z, rotate 180°
    'POS_X': -Math.PI / 2,         // Model faces +X, rotate -90°
    'NEG_X': Math.PI / 2,          // Model faces -X, rotate +90°
    'POS_Y': 0,                    // Y-forward (unusual), treat as Z
    'NEG_Y': Math.PI,              // -Y forward (Blender default), rotate 180°
};

// ============================================================================
// TYPES
// ============================================================================

/**
 * Information about a track segment at a specific point
 */
interface TrackSegmentInfo {
    /** Position on track centerline */
    position: Vector3;

    /** Forward direction along track (tangent) */
    forward: Vector3;

    /** Right direction (perpendicular to track, horizontal) */
    right: Vector3;

    /** The track mesh that was clicked */
    trackMesh: AbstractMesh;

    /** Distance from click point to centerline */
    distance: number;

    /** Track graph edge ID (if found) */
    edgeId?: string;

    /** Parametric position on edge (0-1) */
    t?: number;
}

/**
 * Result of placement calculation
 */
export interface TrackPlacementResult {
    /** World position for model placement */
    position: Vector3;

    /** Rotation quaternion for model orientation */
    rotation: Quaternion;

    /** Rotation in degrees (for display/debugging) */
    rotationDegrees: number;

    /** Track segment info used for calculation */
    segment: TrackSegmentInfo;

    /** Whether placement is valid (close enough to track) */
    isValid: boolean;
}

/**
 * Callback for placement completion
 */
export type PlacementCallback = (result: TrackPlacementResult | null) => void;

// ============================================================================
// TRACK MODEL PLACER CLASS
// ============================================================================

/**
 * TrackModelPlacer - Handles placing rolling stock on track
 * 
 * Provides methods to:
 * - Find track at a given position
 * - Calculate proper placement position and rotation using TrackGraph
 * - Show preview indicator during placement
 * - Handle different model forward axis conventions
 * 
 * @example
 * ```typescript
 * const placer = new TrackModelPlacer(scene);
 * placer.initialize();
 * placer.setTrackGraph(trackGraph); // Connect to track system
 * 
 * // Start placement mode
 * placer.startPlacement((result) => {
 *     if (result) {
 *         modelSystem.placeModel(entry, {
 *             position: result.position,
 *             rotationDeg: result.rotationDegrees
 *         });
 *     }
 * });
 * ```
 */
export class TrackModelPlacer {
    // ========================================================================
    // PRIVATE PROPERTIES
    // ========================================================================

    /** Babylon.js scene */
    private scene: Scene;

    /** Track graph for accurate position/direction calculation */
    private trackGraph: TrackGraph | null = null;

    /** Whether placement mode is active */
    private isPlacing: boolean = false;

    /** Callback when placement completes */
    private placementCallback: PlacementCallback | null = null;

    /** Preview indicator mesh (shows where train will be placed) */
    private previewIndicator: Mesh | null = null;

    /** Preview indicator material */
    private previewMaterial: StandardMaterial | null = null;

    /** Track highlight material */
    private highlightMaterial: StandardMaterial | null = null;

    /** Original materials of highlighted tracks (for restoration) */
    private originalMaterials: Map<string, any> = new Map();

    /** Currently highlighted track meshes */
    private highlightedTracks: AbstractMesh[] = [];

    /** Bound event handlers (for cleanup) */
    private boundPointerMove: ((evt: PointerEvent) => void) | null = null;
    private boundPointerDown: ((evt: PointerEvent) => void) | null = null;
    private boundKeyDown: ((evt: KeyboardEvent) => void) | null = null;

    /** Canvas element for pointer events */
    private canvas: HTMLCanvasElement | null = null;

    /** Current snap result (updated on pointer move) */
    private currentSnapResult: TrackPlacementResult | null = null;

    /** Message overlay element */
    private messageOverlay: HTMLElement | null = null;

    /** Model forward axis (which direction model faces in local space) */
    // Train is 90° off - model must face along X axis, not Z
    // NEG_X = model faces -X, rotate +90° to align with track
    private modelForwardAxis: ModelForwardAxis = 'NEG_X';

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new TrackModelPlacer
     * @param scene - Babylon.js scene
     */
    constructor(scene: Scene) {
        if (!scene) {
            throw new Error(`${LOG_PREFIX} Scene is required`);
        }
        this.scene = scene;
        console.log(`${LOG_PREFIX} Created`);
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the placer
     * Creates preview indicator and materials
     */
    initialize(): void {
        try {
            console.log(`${LOG_PREFIX} Initializing...`);

            // Get canvas
            this.canvas = this.scene.getEngine().getRenderingCanvas();
            if (!this.canvas) {
                throw new Error('No rendering canvas found');
            }

            // Create preview materials
            this.previewMaterial = new StandardMaterial('trackPlacerPreview', this.scene);
            this.previewMaterial.diffuseColor = new Color3(0, 1, 0);
            this.previewMaterial.emissiveColor = new Color3(0, 0.5, 0);
            this.previewMaterial.alpha = 0.7;

            this.highlightMaterial = new StandardMaterial('trackPlacerHighlight', this.scene);
            this.highlightMaterial.diffuseColor = new Color3(1, 1, 0);
            this.highlightMaterial.emissiveColor = new Color3(0.5, 0.5, 0);
            this.highlightMaterial.alpha = 0.3;

            // Create preview indicator (arrow showing placement direction)
            this.createPreviewIndicator();

            // Try to get TrackGraph from global trackSystem
            this.tryGetTrackGraph();

            console.log(`${LOG_PREFIX} ✓ Initialized`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Initialization failed:`, error);
            throw error;
        }
    }

    /**
     * Try to get TrackGraph from the global trackSystem
     */
    private tryGetTrackGraph(): void {
        try {
            const trackSystem = (window as any).trackSystem;
            if (trackSystem && typeof trackSystem.getGraph === 'function') {
                this.trackGraph = trackSystem.getGraph();
                console.log(`${LOG_PREFIX} ✓ TrackGraph connected`);
            } else {
                console.warn(`${LOG_PREFIX} TrackGraph not available - will use fallback mesh-based orientation`);
            }
        } catch (error) {
            console.warn(`${LOG_PREFIX} Could not get TrackGraph:`, error);
        }
    }

    /**
     * Set the track graph reference
     * @param graph - TrackGraph instance
     */
    setTrackGraph(graph: TrackGraph): void {
        this.trackGraph = graph;
        console.log(`${LOG_PREFIX} TrackGraph set`);
    }

    /**
     * Create the preview indicator mesh
     * A green disc with an arrow showing where and which direction the train will face
     * 
     * This is intentionally NOT track-like to avoid confusion
     */
    private createPreviewIndicator(): void {
        try {
            // Create a disc as the base (clearly not track)
            const disc = MeshBuilder.CreateDisc('previewDisc', {
                radius: 0.03,  // 30mm radius
                tessellation: 32
            }, this.scene);

            // Rotate to be horizontal (disc is created in XY plane)
            disc.rotation.x = Math.PI / 2;

            // Create an arrow cone pointing in +Z direction to show train facing direction
            const arrow = MeshBuilder.CreateCylinder('previewArrow', {
                height: 0.04,        // 40mm long
                diameterTop: 0,      // Point
                diameterBottom: 0.015, // 15mm base
                tessellation: 8
            }, this.scene);

            // Rotate arrow to point along Z axis
            arrow.rotation.x = -Math.PI / 2;
            arrow.position.z = 0.02; // Offset forward

            // Parent arrow to disc
            arrow.parent = disc;

            // Use disc as the preview indicator
            this.previewIndicator = disc as Mesh;

            // Apply material
            if (this.previewMaterial) {
                disc.material = this.previewMaterial;
                arrow.material = this.previewMaterial;
            }

            // Initially hidden
            this.previewIndicator.isVisible = false;
            this.previewIndicator.isPickable = false;

            console.log(`${LOG_PREFIX} ✓ Preview indicator created (disc with arrow)`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to create preview indicator:`, error);
        }
    }

    // ========================================================================
    // MODEL FORWARD AXIS CONFIGURATION
    // ========================================================================

    /**
     * Set which axis the model's "front" faces in local space
     * Use this if your train faces sideways on the track
     * 
     * @param axis - The forward axis
     */
    setModelForwardAxis(axis: ModelForwardAxis): void {
        this.modelForwardAxis = axis;
        console.log(`${LOG_PREFIX} Model forward axis set to: ${axis}`);
        console.log(`${LOG_PREFIX}   Offset: ${(FORWARD_AXIS_OFFSETS[axis] * 180 / Math.PI).toFixed(1)}°`);
    }

    /**
     * Get current model forward axis
     */
    getModelForwardAxis(): ModelForwardAxis {
        return this.modelForwardAxis;
    }

    // ========================================================================
    // TRACK GRAPH INTEGRATION
    // ========================================================================

    /**
     * Find the nearest track edge to a world position
     * Uses TrackGraph for accurate edge detection
     * 
     * @param position - World position to search from
     * @returns Nearest edge info or null
     */
    private findNearestEdge(position: Vector3): {
        edge: GraphEdge;
        t: number;
        position: Vector3;
        forward: Vector3;
        distance: number;
    } | null {
        if (!this.trackGraph) {
            return null;
        }

        try {
            const edges = this.trackGraph.getAllEdges();
            if (edges.length === 0) {
                return null;
            }

            let bestResult: {
                edge: GraphEdge;
                t: number;
                position: Vector3;
                forward: Vector3;
                distance: number;
            } | null = null;

            for (const edge of edges) {
                const fromNode = this.trackGraph.getNode(edge.fromNodeId);
                const toNode = this.trackGraph.getNode(edge.toNodeId);

                if (!fromNode || !toNode || !fromNode.pos || !toNode.pos) {
                    continue;
                }

                // Sample along edge to find closest point
                for (let i = 0; i <= SNAP_CONFIG.SAMPLES_PER_EDGE; i++) {
                    const t = i / SNAP_CONFIG.SAMPLES_PER_EDGE;
                    const sample = this.getPositionOnEdge(edge, fromNode, toNode, t);

                    if (!sample) continue;

                    // Calculate horizontal distance (ignore Y)
                    const dx = position.x - sample.position.x;
                    const dz = position.z - sample.position.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);

                    if (!bestResult || dist < bestResult.distance) {
                        bestResult = {
                            edge,
                            t,
                            position: sample.position,
                            forward: sample.forward,
                            distance: dist
                        };
                    }
                }
            }

            return bestResult;

        } catch (error) {
            console.error(`${LOG_PREFIX} Error finding nearest edge:`, error);
            return null;
        }
    }

    /**
     * Get position and forward direction at a point on an edge
     * 
     * @param edge - The track edge
     * @param fromNode - Start node
     * @param toNode - End node
     * @param t - Parametric position (0-1)
     * @returns Position and forward direction
     */
    private getPositionOnEdge(
        edge: GraphEdge,
        fromNode: GraphNode,
        toNode: GraphNode,
        t: number
    ): { position: Vector3; forward: Vector3 } | null {
        try {
            if (!fromNode.pos || !toNode.pos) {
                return null;
            }

            if (edge.curve.type === 'straight') {
                return this.getStraightPosition(fromNode.pos, toNode.pos, t);
            } else if (edge.curve.type === 'arc') {
                return this.getArcPosition(fromNode.pos, toNode.pos, edge.curve, t);
            } else {
                // Fallback to straight
                return this.getStraightPosition(fromNode.pos, toNode.pos, t);
            }

        } catch (error) {
            console.error(`${LOG_PREFIX} Error getting position on edge:`, error);
            return null;
        }
    }

    /**
     * Get position on a straight edge
     * 
     * @param start - Start position
     * @param end - End position
     * @param t - Parametric position (0-1)
     * @returns Position and forward direction
     */
    private getStraightPosition(
        start: Vector3,
        end: Vector3,
        t: number
    ): { position: Vector3; forward: Vector3 } {
        const position = Vector3.Lerp(start, end, t);

        let forward = end.subtract(start);
        if (forward.length() < 0.0001) {
            forward = new Vector3(0, 0, 1);
        } else {
            forward = forward.normalize();
        }

        // Ensure forward is horizontal
        forward.y = 0;
        if (forward.length() > 0.0001) {
            forward.normalize();
        } else {
            forward = new Vector3(0, 0, 1);
        }

        return { position, forward };
    }

    /**
     * Get position on a curved arc edge
     * 
     * @param start - Start position
     * @param end - End position
     * @param curve - Curve definition
     * @param t - Parametric position (0-1)
     * @returns Position and forward direction
     */
    private getArcPosition(
        start: Vector3,
        end: Vector3,
        curve: CurveDefinition,
        t: number
    ): { position: Vector3; forward: Vector3 } {
        try {
            const radius = curve.arcRadiusM || 0.371;
            const angleDeg = curve.arcAngleDeg || 45;
            const direction = curve.arcDirection || 1;

            // Calculate arc geometry
            const startToEnd = end.subtract(start);
            if (startToEnd.length() < 0.0001) {
                return { position: start.clone(), forward: new Vector3(0, 0, 1) };
            }

            const startDir = startToEnd.normalize();

            // Perpendicular direction (toward arc center)
            const perpendicular = new Vector3(
                -startDir.z * direction,
                0,
                startDir.x * direction
            );

            // Arc center
            const center = start.add(perpendicular.scale(radius));

            // Calculate position on arc
            const startAngle = Math.atan2(
                start.x - center.x,
                start.z - center.z
            );

            const angleRad = (angleDeg * Math.PI / 180) * direction;
            const currentAngle = startAngle + angleRad * t;

            const position = new Vector3(
                center.x + radius * Math.sin(currentAngle),
                start.y + (end.y - start.y) * t,
                center.z + radius * Math.cos(currentAngle)
            );

            // Calculate tangent (forward direction)
            const tangentAngle = currentAngle + (Math.PI / 2) * direction;
            const forward = new Vector3(
                Math.sin(tangentAngle),
                0,
                Math.cos(tangentAngle)
            ).normalize();

            return { position, forward };

        } catch (error) {
            console.error(`${LOG_PREFIX} Error calculating arc position:`, error);
            return this.getStraightPosition(start, end, t);
        }
    }

    // ========================================================================
    // TRACK DETECTION (MESH-BASED FALLBACK)
    // ========================================================================

    /**
     * Find track mesh at pointer position
     * @param pointerX - Screen X coordinate
     * @param pointerY - Screen Y coordinate
     * @returns Pick result or null
     */
    private findTrackAtPointer(pointerX: number, pointerY: number): PickingInfo | null {
        try {
            const pickResult = this.scene.pick(pointerX, pointerY, (mesh) => {
                return this.isTrackMesh(mesh);
            });

            return pickResult?.hit ? pickResult : null;

        } catch (error) {
            console.error(`${LOG_PREFIX} Error finding track at pointer:`, error);
            return null;
        }
    }

    /**
     * Check if a mesh is a track mesh
     * @param mesh - Mesh to check
     * @returns True if this is a track mesh
     */
    private isTrackMesh(mesh: AbstractMesh): boolean {
        const name = mesh.name.toLowerCase();
        return (
            name.includes('rail') ||
            name.includes('track') ||
            name.includes('sleeper') ||
            name.includes('ballast')
        );
    }

    /**
     * Extract track segment information from a pick result
     * Uses TrackGraph if available, falls back to mesh-based calculation
     * 
     * @param pickResult - Babylon.js picking result
     * @returns Track segment info or null
     */
    private getTrackSegmentInfo(pickResult: PickingInfo): TrackSegmentInfo | null {
        try {
            const pickedMesh = pickResult.pickedMesh;
            const hitPoint = pickResult.pickedPoint;

            if (!pickedMesh || !hitPoint) {
                return null;
            }

            console.log(`${LOG_PREFIX} Pick hit mesh: ${pickedMesh.name}`);

            // ================================================================
            // TRY TRACK GRAPH FIRST (most accurate)
            // ================================================================
            if (this.trackGraph) {
                const nearestEdge = this.findNearestEdge(hitPoint);

                if (nearestEdge && nearestEdge.distance < SNAP_CONFIG.MAX_DISTANCE_M) {
                    console.log(`${LOG_PREFIX} Using TrackGraph edge: ${nearestEdge.edge.id}`);
                    console.log(`${LOG_PREFIX}   Position: (${nearestEdge.position.x.toFixed(3)}, ${nearestEdge.position.z.toFixed(3)})`);
                    console.log(`${LOG_PREFIX}   Forward: (${nearestEdge.forward.x.toFixed(3)}, ${nearestEdge.forward.z.toFixed(3)})`);
                    console.log(`${LOG_PREFIX}   t: ${nearestEdge.t.toFixed(2)}, Distance: ${(nearestEdge.distance * 1000).toFixed(1)}mm`);

                    // Calculate right vector
                    const right = Vector3.Cross(Vector3.Up(), nearestEdge.forward).normalize();

                    // Adjust Y position for model height
                    const position = nearestEdge.position.clone();
                    position.y += OO_GAUGE.MODEL_HEIGHT_OFFSET_M;

                    return {
                        position,
                        forward: nearestEdge.forward,
                        right,
                        trackMesh: pickedMesh,
                        distance: nearestEdge.distance,
                        edgeId: nearestEdge.edge.id,
                        t: nearestEdge.t
                    };
                }
            }

            // ================================================================
            // FALLBACK: MESH-BASED CALCULATION
            // ================================================================
            console.log(`${LOG_PREFIX} Using fallback mesh-based orientation`);
            return this.getTrackSegmentInfoFromMesh(pickedMesh, hitPoint);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error getting track segment info:`, error);
            return null;
        }
    }

    /**
     * Get track segment info from mesh (fallback method)
     * 
     * @param mesh - Track mesh
     * @param hitPoint - Point where mesh was clicked
     * @returns Track segment info or null
     */
    private getTrackSegmentInfoFromMesh(mesh: AbstractMesh, hitPoint: Vector3): TrackSegmentInfo | null {
        try {
            // Get the parent transform node to find sibling rails
            const parent = mesh.parent;

            if (parent) {
                // Find left and right rail meshes
                const children = parent.getChildMeshes();
                let leftRail: AbstractMesh | null = null;
                let rightRail: AbstractMesh | null = null;

                for (const child of children) {
                    const childName = child.name.toLowerCase();
                    if (childName.includes('rail_left') || childName.includes('leftrail')) {
                        leftRail = child;
                    } else if (childName.includes('rail_right') || childName.includes('rightrail')) {
                        rightRail = child;
                    }
                }

                if (leftRail && rightRail) {
                    // Calculate centerline from rail positions
                    const leftBounds = leftRail.getBoundingInfo().boundingBox;
                    const rightBounds = rightRail.getBoundingInfo().boundingBox;

                    const leftCenter = leftBounds.centerWorld.clone();
                    const rightCenter = rightBounds.centerWorld.clone();

                    // Track centerline
                    const centerX = (leftCenter.x + rightCenter.x) / 2;
                    const centerY = Math.max(leftCenter.y, rightCenter.y);
                    const centerZ = (leftCenter.z + rightCenter.z) / 2;

                    // Rail vector points from left to right rail
                    const railVector = rightCenter.subtract(leftCenter).normalize();

                    // Track forward is perpendicular to rail vector
                    const forward = new Vector3(-railVector.z, 0, railVector.x).normalize();
                    const right = railVector.clone();

                    // Calculate distance from hit point to centerline
                    const dx = hitPoint.x - centerX;
                    const dz = hitPoint.z - centerZ;
                    const distance = Math.sqrt(dx * dx + dz * dz);

                    const position = new Vector3(
                        centerX,
                        centerY + OO_GAUGE.MODEL_HEIGHT_OFFSET_M,
                        centerZ
                    );

                    console.log(`${LOG_PREFIX} Mesh-based orientation:`);
                    console.log(`${LOG_PREFIX}   Position: (${position.x.toFixed(3)}, ${position.z.toFixed(3)})`);
                    console.log(`${LOG_PREFIX}   Forward: (${forward.x.toFixed(3)}, ${forward.z.toFixed(3)})`);

                    return {
                        position,
                        forward,
                        right,
                        trackMesh: mesh,
                        distance
                    };
                }
            }

            // Ultimate fallback: use mesh orientation directly
            console.log(`${LOG_PREFIX} Using mesh rotation fallback`);

            const meshBounds = mesh.getBoundingInfo().boundingBox;
            const meshCenter = meshBounds.centerWorld.clone();

            const meshRotation = mesh.rotationQuaternion ||
                Quaternion.FromEulerAngles(mesh.rotation.x, mesh.rotation.y, mesh.rotation.z);

            const forward = new Vector3(0, 0, 1);
            forward.rotateByQuaternionToRef(meshRotation, forward);
            forward.y = 0;
            forward.normalize();

            const right = Vector3.Cross(Vector3.Up(), forward).normalize();

            return {
                position: new Vector3(
                    meshCenter.x,
                    meshCenter.y + OO_GAUGE.MODEL_HEIGHT_OFFSET_M,
                    meshCenter.z
                ),
                forward,
                right,
                trackMesh: mesh,
                distance: 0
            };

        } catch (error) {
            console.error(`${LOG_PREFIX} Error getting track segment info from mesh:`, error);
            return null;
        }
    }

    // ========================================================================
    // PLACEMENT CALCULATION
    // ========================================================================

    /**
     * Calculate placement position and rotation from track segment
     * 
     * The train will face ALONG the track direction (from fromNode to toNode
     * when using TrackGraph, or perpendicular to rails when using mesh fallback).
     * 
     * @param segment - Track segment information
     * @returns Placement result with position, rotation, and validity
     */
    private calculatePlacement(segment: TrackSegmentInfo): TrackPlacementResult {
        // Position is on the track centerline
        const position = segment.position.clone();

        // Calculate the angle of the track's forward direction in world space
        // atan2 gives us the angle from +Z axis to the forward vector
        const trackAngle = Math.atan2(segment.forward.x, segment.forward.z);

        // Apply model forward axis offset
        // This compensates for models that don't face +Z in their local space
        const modelOffset = FORWARD_AXIS_OFFSETS[this.modelForwardAxis];

        // Final rotation angle = track angle + model offset
        const finalAngle = trackAngle + modelOffset;

        // Convert to degrees for display/debugging
        const rotationDegrees = (finalAngle * 180 / Math.PI);

        // Create quaternion for Y-axis rotation
        const rotation = Quaternion.FromEulerAngles(0, finalAngle, 0);

        // Check if placement is valid (close enough to track centerline)
        const isValid = segment.distance <= SNAP_CONFIG.MAX_DISTANCE_M;

        console.log(`${LOG_PREFIX} Placement calculated:`);
        console.log(`${LOG_PREFIX}   Track angle: ${(trackAngle * 180 / Math.PI).toFixed(1)}°`);
        console.log(`${LOG_PREFIX}   Model offset: ${(modelOffset * 180 / Math.PI).toFixed(1)}° (${this.modelForwardAxis})`);
        console.log(`${LOG_PREFIX}   Final rotation: ${rotationDegrees.toFixed(1)}°`);
        console.log(`${LOG_PREFIX}   Valid: ${isValid}`);
        if (segment.edgeId) {
            console.log(`${LOG_PREFIX}   Edge: ${segment.edgeId}, t: ${segment.t?.toFixed(2)}`);
        }

        return {
            position,
            rotation,
            rotationDegrees,
            segment,
            isValid
        };
    }

    // ========================================================================
    // PLACEMENT MODE
    // ========================================================================

    /**
     * Check if currently in placement mode
     */
    isInPlacementMode(): boolean {
        return this.isPlacing;
    }

    /**
     * Start track placement mode
     * Shows instructions and waits for user to click on track
     * 
     * @param callback - Called when placement completes (with result or null if cancelled)
     */
    startPlacement(callback: PlacementCallback): void {
        try {
            if (this.isPlacing) {
                console.warn(`${LOG_PREFIX} Already in placement mode`);
                return;
            }

            console.log(`${LOG_PREFIX} Starting placement mode...`);

            // Try to get track graph if not already connected
            if (!this.trackGraph) {
                this.tryGetTrackGraph();
            }

            this.isPlacing = true;
            this.placementCallback = callback;
            this.currentSnapResult = null;

            // Dispatch event so InputManager knows to not intercept clicks
            window.dispatchEvent(new CustomEvent('trackPlacementStart'));

            // Show instruction message
            this.showMessage('Click on a track piece to place the train. Press ESC to cancel.');

            // Setup event handlers
            this.setupPlacementHandlers();

            console.log(`${LOG_PREFIX} ✓ Placement mode active`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to start placement:`, error);
            this.cancelPlacement();
        }
    }

    /**
     * Cancel placement mode without placing
     */
    cancelPlacement(): void {
        console.log(`${LOG_PREFIX} Cancelling placement...`);

        // Call callback with null to indicate cancellation
        if (this.placementCallback) {
            this.placementCallback(null);
        }

        this.endPlacement();
    }

    /**
     * End placement mode (cleanup)
     */
    private endPlacement(): void {
        this.isPlacing = false;
        this.placementCallback = null;
        this.currentSnapResult = null;

        // Dispatch event so InputManager resumes normal operation
        window.dispatchEvent(new CustomEvent('trackPlacementEnd'));

        // Remove event handlers
        this.removePlacementHandlers();

        // Hide preview
        if (this.previewIndicator) {
            this.previewIndicator.isVisible = false;
        }

        // Clear highlights
        this.clearTrackHighlights();

        // Hide message
        this.hideMessage();

        console.log(`${LOG_PREFIX} Placement mode ended`);
    }

    // ========================================================================
    // PLACEMENT EVENT HANDLERS
    // ========================================================================

    /**
     * Setup event handlers for placement mode
     */
    private setupPlacementHandlers(): void {
        if (!this.canvas) return;

        // Pointer move - show preview
        this.boundPointerMove = (evt: PointerEvent) => {
            this.handlePlacementPointerMove(evt);
        };

        // Pointer down - confirm placement
        this.boundPointerDown = (evt: PointerEvent) => {
            this.handlePlacementPointerDown(evt);
        };

        // Key down - cancel on escape
        this.boundKeyDown = (evt: KeyboardEvent) => {
            if (evt.key === 'Escape') {
                this.cancelPlacement();
            }
        };

        // Use capture phase to get events before InputManager
        this.canvas.addEventListener('pointermove', this.boundPointerMove, { capture: true });
        this.canvas.addEventListener('pointerdown', this.boundPointerDown, { capture: true });
        window.addEventListener('keydown', this.boundKeyDown);
    }

    /**
     * Remove event handlers
     */
    private removePlacementHandlers(): void {
        if (this.canvas) {
            if (this.boundPointerMove) {
                this.canvas.removeEventListener('pointermove', this.boundPointerMove, { capture: true });
            }
            if (this.boundPointerDown) {
                this.canvas.removeEventListener('pointerdown', this.boundPointerDown, { capture: true });
            }
        }

        if (this.boundKeyDown) {
            window.removeEventListener('keydown', this.boundKeyDown);
        }

        this.boundPointerMove = null;
        this.boundPointerDown = null;
        this.boundKeyDown = null;
    }

    /**
     * Handle pointer move during placement
     */
    private handlePlacementPointerMove(evt: PointerEvent): void {
        if (!this.isPlacing) return;

        // Find track under pointer
        const pickResult = this.findTrackAtPointer(evt.clientX, evt.clientY);

        if (pickResult) {
            // Get track segment info
            const segment = this.getTrackSegmentInfo(pickResult);

            if (segment) {
                // Calculate placement
                this.currentSnapResult = this.calculatePlacement(segment);

                // Update preview
                this.updatePreview(this.currentSnapResult);

                // Highlight track
                this.highlightTrack(segment.trackMesh);
            } else {
                this.currentSnapResult = null;
                this.hidePreview();
                this.clearTrackHighlights();
            }
        } else {
            this.currentSnapResult = null;
            this.hidePreview();
            this.clearTrackHighlights();
        }
    }

    /**
     * Handle pointer down during placement
     */
    private handlePlacementPointerDown(evt: PointerEvent): void {
        if (!this.isPlacing) return;

        // Only handle left click
        if (evt.button !== 0) return;

        // Stop event propagation so InputManager doesn't get it
        evt.stopPropagation();
        evt.preventDefault();

        if (this.currentSnapResult && this.currentSnapResult.isValid) {
            console.log(`${LOG_PREFIX} Placement confirmed`);

            // Call callback with result
            if (this.placementCallback) {
                this.placementCallback(this.currentSnapResult);
            }

            this.endPlacement();
        } else {
            console.log(`${LOG_PREFIX} Invalid placement location - click closer to track centerline`);
        }
    }

    // ========================================================================
    // PREVIEW AND HIGHLIGHTING
    // ========================================================================

    /**
     * Update preview indicator position and rotation
     */
    private updatePreview(result: TrackPlacementResult): void {
        if (!this.previewIndicator) return;

        this.previewIndicator.position.copyFrom(result.position);
        this.previewIndicator.position.y += 0.01; // Slightly above track

        if (result.rotation) {
            this.previewIndicator.rotationQuaternion = result.rotation.clone();
        }

        // Color based on validity
        if (this.previewMaterial) {
            if (result.isValid) {
                this.previewMaterial.diffuseColor = new Color3(0, 1, 0);
                this.previewMaterial.emissiveColor = new Color3(0, 0.5, 0);
            } else {
                this.previewMaterial.diffuseColor = new Color3(1, 0.5, 0);
                this.previewMaterial.emissiveColor = new Color3(0.5, 0.25, 0);
            }
        }

        this.previewIndicator.isVisible = true;
    }

    /**
     * Hide preview indicator
     */
    private hidePreview(): void {
        if (this.previewIndicator) {
            this.previewIndicator.isVisible = false;
        }
    }

    /**
     * Highlight a track mesh
     */
    private highlightTrack(mesh: AbstractMesh): void {
        // Clear previous highlights
        this.clearTrackHighlights();

        // Find all track meshes in the same piece
        const parent = mesh.parent;
        if (parent) {
            const siblings = parent.getChildMeshes();
            for (const sibling of siblings) {
                if (this.isTrackMesh(sibling)) {
                    // Store original material
                    this.originalMaterials.set(sibling.uniqueId.toString(), sibling.material);

                    // Apply highlight
                    // Note: We could blend materials, but for now just track for potential use
                    this.highlightedTracks.push(sibling);
                }
            }
        }
    }

    /**
     * Clear track highlights
     */
    private clearTrackHighlights(): void {
        for (const mesh of this.highlightedTracks) {
            const originalMaterial = this.originalMaterials.get(mesh.uniqueId.toString());
            if (originalMaterial) {
                mesh.material = originalMaterial;
            }
        }

        this.highlightedTracks = [];
        this.originalMaterials.clear();
    }

    // ========================================================================
    // MESSAGE OVERLAY
    // ========================================================================

    /**
     * Show instruction message
     */
    private showMessage(text: string): void {
        try {
            if (!this.messageOverlay) {
                this.messageOverlay = document.createElement('div');
                this.messageOverlay.id = 'trackPlacerMessage';
                this.messageOverlay.style.cssText = `
                    position: fixed;
                    top: 80px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0, 100, 0, 0.9);
                    color: white;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-family: 'Segoe UI', Arial, sans-serif;
                    font-size: 14px;
                    z-index: 10000;
                    pointer-events: none;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                `;
                document.body.appendChild(this.messageOverlay);
            }

            this.messageOverlay.textContent = text;
            this.messageOverlay.style.display = 'block';

        } catch (error) {
            console.error(`${LOG_PREFIX} Error showing message:`, error);
        }
    }

    /**
     * Hide instruction message
     */
    private hideMessage(): void {
        try {
            if (this.messageOverlay) {
                this.messageOverlay.style.display = 'none';
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error hiding message:`, error);
        }
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Dispose of all resources
     */
    dispose(): void {
        try {
            console.log(`${LOG_PREFIX} Disposing...`);

            // End any active placement
            if (this.isPlacing) {
                this.cancelPlacement();
            }

            // Dispose preview mesh
            if (this.previewIndicator) {
                this.previewIndicator.dispose();
                this.previewIndicator = null;
            }

            // Dispose materials
            if (this.previewMaterial) {
                this.previewMaterial.dispose();
                this.previewMaterial = null;
            }
            if (this.highlightMaterial) {
                this.highlightMaterial.dispose();
                this.highlightMaterial = null;
            }

            // Remove message overlay
            if (this.messageOverlay && this.messageOverlay.parentNode) {
                this.messageOverlay.parentNode.removeChild(this.messageOverlay);
                this.messageOverlay = null;
            }

            // Clear references
            this.trackGraph = null;

            console.log(`${LOG_PREFIX} ✓ Disposed`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error disposing:`, error);
        }
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Register orientation testing utilities on window
 * Call this from browser console if trains are facing wrong way
 * 
 * Usage:
 *   window.setTrainOrientation('NEG_Y')  // For Blender exports
 *   window.setTrainOrientation('POS_X')  // For some CAD exports
 *   window.trainOrientationHelp()        // Show all options
 */
export function registerOrientationTester(placer: TrackModelPlacer): void {
    // Set orientation
    (window as any).setTrainOrientation = (axis: ModelForwardAxis) => {
        console.log(`${LOG_PREFIX} Setting model forward axis: ${axis}`);
        placer.setModelForwardAxis(axis);
        console.log(`${LOG_PREFIX} ✓ Orientation set. Place a train to test.`);
    };

    // Help function
    (window as any).trainOrientationHelp = () => {
        console.log('');
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║               TRAIN ORIENTATION HELP                       ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log('║  If your train faces sideways or backwards on track:       ║');
        console.log('║                                                            ║');
        console.log('║  window.setTrainOrientation("POS_Z")  → Faces +Z (default) ║');
        console.log('║  window.setTrainOrientation("NEG_Z")  → Faces -Z           ║');
        console.log('║  window.setTrainOrientation("POS_X")  → Faces +X           ║');
        console.log('║  window.setTrainOrientation("NEG_X")  → Faces -X           ║');
        console.log('║  window.setTrainOrientation("POS_Y")  → Faces +Y           ║');
        console.log('║  window.setTrainOrientation("NEG_Y")  → Faces -Y (Blender) ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log('║  Common model conventions:                                 ║');
        console.log('║  - Blender default: NEG_Y forward, Z up                    ║');
        console.log('║  - 3ds Max: POS_Y forward, Z up                            ║');
        console.log('║  - Unity/Unreal: POS_Z forward                             ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log('');
    };

    // Get current orientation
    (window as any).getTrainOrientation = () => {
        const axis = placer.getModelForwardAxis();
        console.log(`${LOG_PREFIX} Current model forward axis: ${axis}`);
        return axis;
    };

    console.log(`${LOG_PREFIX} ✓ Orientation utilities registered`);
    console.log(`${LOG_PREFIX}   Use window.trainOrientationHelp() for options`);
}