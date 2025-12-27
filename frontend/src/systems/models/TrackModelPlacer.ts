/**
 * TrackModelPlacer.ts - Handles placing models on track pieces
 * 
 * Path: frontend/src/systems/models/TrackModelPlacer.ts
 * 
 * This system handles the placement of rolling stock models onto track:
 * - Detects track pieces in the scene
 * - Calculates positions along track centerlines
 * - Snaps models to track with correct orientation
 * - Provides visual feedback during placement
 * 
 * IMPORTANT: Train models are expected to face along positive X-axis
 * in their local coordinate system. If your model faces a different
 * direction, adjust MODEL_FORWARD_AXIS accordingly.
 * 
 * @module TrackModelPlacer
 * @author Model Railway Workbench
 * @version 1.1.0
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
type ModelForwardAxis = 'POS_X' | 'NEG_X' | 'POS_Y' | 'NEG_Y' | 'POS_Z' | 'NEG_Z';

/**
 * Rotation offset in radians for each forward axis convention
 * These offsets rotate FROM the model's local forward TO the world forward (along track)
 */
const FORWARD_AXIS_OFFSETS: Record<ModelForwardAxis, number> = {
    'POS_X': 0,                    // Model faces +X → no rotation needed
    'NEG_X': Math.PI,              // Model faces -X → rotate 180°
    'POS_Y': -Math.PI / 2,         // Model faces +Y → rotate -90°
    'NEG_Y': Math.PI / 2,          // Model faces -Y → rotate +90°
    'POS_Z': -Math.PI / 2,         // Model faces +Z → rotate -90°
    'NEG_Z': Math.PI / 2,          // Model faces -Z → rotate +90°
};

/**
 * Default model forward axis
 * Change this if most of your models use a different convention
 */
const DEFAULT_MODEL_FORWARD: ModelForwardAxis = 'POS_Z';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Information about a track segment for model placement
 */
export interface TrackSegmentInfo {
    /** Center position on the track */
    position: Vector3;
    /** Forward direction along the track (tangent) */
    forward: Vector3;
    /** Right direction (perpendicular to track, in XZ plane) */
    right: Vector3;
    /** The track mesh that was hit */
    trackMesh: AbstractMesh;
    /** Distance from mouse position to track center */
    distance: number;
}

/**
 * Result of track placement calculation
 */
export interface TrackPlacementResult {
    /** World position for the model (on track centerline) */
    position: Vector3;
    /** Rotation quaternion aligned with track direction */
    rotation: Quaternion;
    /** Y-axis rotation in degrees (for display/serialization) */
    rotationDegrees: number;
    /** The track segment info used for placement */
    segment: TrackSegmentInfo;
    /** Whether placement is valid (within snap distance) */
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
 * - Calculate proper placement position and rotation
 * - Show preview indicator during placement
 * - Handle different model forward axis conventions
 * 
 * @example
 * ```typescript
 * const placer = new TrackModelPlacer(scene);
 * placer.initialize();
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
    private canvas: HTMLCanvasElement;

    /** Current snap result (updated on pointer move) */
    private currentSnapResult: TrackPlacementResult | null = null;

    /** Message overlay element (instructions during placement) */
    private messageOverlay: HTMLDivElement | null = null;

    /** Current model forward axis setting */
    private modelForwardAxis: ModelForwardAxis = DEFAULT_MODEL_FORWARD;

    // ========================================================================
    // CONSTRUCTOR & INITIALIZATION
    // ========================================================================

    /**
     * Create a new TrackModelPlacer
     * @param scene - Babylon.js scene
     */
    constructor(scene: Scene) {
        this.scene = scene;
        this.canvas = scene.getEngine().getRenderingCanvas() as HTMLCanvasElement;
        console.log(`${LOG_PREFIX} Created`);
    }

    /**
     * Initialize the placer
     * Creates preview meshes and materials
     */
    initialize(): void {
        try {
            console.log(`${LOG_PREFIX} Initializing...`);

            // Create preview materials
            this.createPreviewMaterials();

            // Create preview indicator (arrow showing train direction)
            this.createPreviewIndicator();

            console.log(`${LOG_PREFIX} ✓ Initialized successfully`);
            console.log(`${LOG_PREFIX} Model forward axis: ${this.modelForwardAxis}`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Initialization failed:`, error);
            throw error;
        }
    }

    /**
     * Set the model forward axis convention
     * Use this if your models use a different forward direction
     * 
     * @param axis - The axis the model's front points along
     */
    setModelForwardAxis(axis: ModelForwardAxis): void {
        this.modelForwardAxis = axis;
        console.log(`${LOG_PREFIX} Model forward axis set to: ${axis}`);
    }

    /**
     * Get the current model forward axis
     */
    getModelForwardAxis(): ModelForwardAxis {
        return this.modelForwardAxis;
    }

    // ========================================================================
    // MATERIAL CREATION
    // ========================================================================

    /**
     * Create materials for preview and highlighting
     */
    private createPreviewMaterials(): void {
        try {
            // Preview indicator material (cyan/turquoise)
            this.previewMaterial = new StandardMaterial('trackPlacerPreview', this.scene);
            this.previewMaterial.diffuseColor = new Color3(0.0, 0.8, 0.8);
            this.previewMaterial.emissiveColor = new Color3(0.0, 0.4, 0.4);
            this.previewMaterial.alpha = 0.8;
            this.previewMaterial.backFaceCulling = false;

            // Track highlight material (yellow glow)
            this.highlightMaterial = new StandardMaterial('trackHighlight', this.scene);
            this.highlightMaterial.diffuseColor = new Color3(1.0, 0.9, 0.0);
            this.highlightMaterial.emissiveColor = new Color3(0.5, 0.45, 0.0);
            this.highlightMaterial.alpha = 0.7;

            console.log(`${LOG_PREFIX} Preview materials created`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error creating materials:`, error);
        }
    }

    /**
     * Create the preview indicator mesh
     * Shows an arrow indicating train direction on the track
     */
    private createPreviewIndicator(): void {
        try {
            // Create an arrow-like shape to show direction
            // Main body (elongated box representing train direction)
            const body = MeshBuilder.CreateBox('placerPreviewBody', {
                width: 0.02,   // Narrow width (across track)
                height: 0.015, // Height
                depth: 0.08,   // Long depth (along track)
            }, this.scene);

            // Arrow head (cone pointing forward)
            const head = MeshBuilder.CreateCylinder('placerPreviewHead', {
                height: 0.03,
                diameterTop: 0,
                diameterBottom: 0.025,
                tessellation: 8,
            }, this.scene);

            // Position arrow head at front of body
            head.position.z = 0.055; // Front of body
            head.rotation.x = Math.PI / 2; // Point along Z axis

            // Merge into single mesh
            this.previewIndicator = MeshBuilder.CreateBox('placerPreview', {
                width: 0.02,
                height: 0.015,
                depth: 0.08,
            }, this.scene);

            // Dispose temporary meshes
            body.dispose();
            head.dispose();

            // Apply material
            if (this.previewMaterial) {
                this.previewIndicator.material = this.previewMaterial;
            }

            // Initially hidden
            this.previewIndicator.isVisible = false;
            this.previewIndicator.isPickable = false;

            console.log(`${LOG_PREFIX} Preview indicator created`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error creating preview indicator:`, error);
        }
    }

    // ========================================================================
    // TRACK DETECTION
    // ========================================================================

    /**
     * Check if there are any track pieces in the scene
     * @returns True if at least one track mesh exists
     */
    hasTrackPieces(): boolean {
        const trackMeshes = this.findTrackMeshes();
        return trackMeshes.length > 0;
    }

    /**
     * Get default placement on the first available track piece
     * Used for automatic placement of rolling stock
     * 
     * @returns Placement result for center of first track, or null if no track
     */
    getDefaultPlacement(): TrackPlacementResult | null {
        try {
            console.log(`${LOG_PREFIX} Getting default placement...`);

            // Find all track meshes
            const trackMeshes = this.findTrackMeshes();
            if (trackMeshes.length === 0) {
                console.warn(`${LOG_PREFIX} No track meshes found for default placement`);
                return null;
            }

            // Try to find a track piece with proper rail structure
            for (const mesh of trackMeshes) {
                const segment = this.getTrackSegmentInfoFromMesh(mesh);
                if (segment) {
                    const result = this.calculatePlacement(segment);
                    console.log(`${LOG_PREFIX} ✓ Default placement found on: ${mesh.name}`);
                    return result;
                }
            }

            console.warn(`${LOG_PREFIX} Could not calculate default placement from any track mesh`);
            return null;

        } catch (error) {
            console.error(`${LOG_PREFIX} Error getting default placement:`, error);
            return null;
        }
    }

    /**
     * Get track segment info from a mesh (without picking)
     * Used for automatic placement
     * 
     * @param mesh - A track mesh
     * @returns Track segment info or null
     */
    private getTrackSegmentInfoFromMesh(mesh: AbstractMesh): TrackSegmentInfo | null {
        try {
            // Get the parent transform node to find sibling rails
            const parent = mesh.parent;

            if (parent) {
                // Find left and right rail meshes
                const children = parent.getChildMeshes();
                let leftRail: AbstractMesh | null = null;
                let rightRail: AbstractMesh | null = null;

                for (const child of children) {
                    if (child.name.includes('rail_left') || child.name.includes('leftRail')) {
                        leftRail = child;
                    } else if (child.name.includes('rail_right') || child.name.includes('rightRail')) {
                        rightRail = child;
                    }
                }

                if (leftRail && rightRail) {
                    // Calculate centerline from rail positions
                    const leftBounds = leftRail.getBoundingInfo().boundingBox;
                    const rightBounds = rightRail.getBoundingInfo().boundingBox;

                    // Get world centers of rails
                    const leftCenter = leftBounds.centerWorld.clone();
                    const rightCenter = rightBounds.centerWorld.clone();

                    // Track centerline is midpoint between rails
                    const centerX = (leftCenter.x + rightCenter.x) / 2;
                    const centerY = Math.max(leftCenter.y, rightCenter.y);
                    const centerZ = (leftCenter.z + rightCenter.z) / 2;

                    // Rail vector points from left to right rail
                    const railVector = rightCenter.subtract(leftCenter).normalize();

                    // Track forward direction is perpendicular to rail vector (in XZ plane)
                    // Rotate rail vector 90° around Y axis
                    const forward = new Vector3(-railVector.z, 0, railVector.x).normalize();

                    // Right direction (same as rail vector, pointing from center toward right rail)
                    const right = railVector.clone();

                    // Position at centerline with height offset for model
                    const position = new Vector3(
                        centerX,
                        centerY + OO_GAUGE.MODEL_HEIGHT_OFFSET_M,
                        centerZ
                    );

                    return {
                        position: position,
                        forward: forward,
                        right: right,
                        trackMesh: mesh,
                        distance: 0  // Default placement is exactly on centerline
                    };
                }
            }

            // Fallback: use mesh orientation directly
            const meshBounds = mesh.getBoundingInfo().boundingBox;
            const meshCenter = meshBounds.centerWorld.clone();

            // Try to get orientation from mesh rotation
            const meshRotation = mesh.rotationQuaternion ||
                Quaternion.FromEulerAngles(
                    mesh.rotation.x,
                    mesh.rotation.y,
                    mesh.rotation.z
                );

            // Default forward is along Z axis, rotated by mesh rotation
            const forward = new Vector3(0, 0, 1);
            forward.rotateByQuaternionToRef(meshRotation, forward);
            forward.y = 0;
            forward.normalize();

            const right = Vector3.Cross(Vector3.Up(), forward).normalize();

            return {
                position: new Vector3(meshCenter.x, meshCenter.y + OO_GAUGE.MODEL_HEIGHT_OFFSET_M, meshCenter.z),
                forward: forward,
                right: right,
                trackMesh: mesh,
                distance: 0
            };

        } catch (error) {
            console.error(`${LOG_PREFIX} Error getting track segment info from mesh:`, error);
            return null;
        }
    }

    /**
     * Find all track meshes in the scene
     * @returns Array of track meshes
     */
    private findTrackMeshes(): AbstractMesh[] {
        try {
            const trackMeshes: AbstractMesh[] = [];

            for (const mesh of this.scene.meshes) {
                // Track meshes have names like "rail_left_...", "rail_right_...", "sleeper_...", etc.
                // We want the rail meshes for accurate centerline calculation
                if (mesh.name.startsWith('rail_') ||
                    mesh.name.startsWith('track_') ||
                    mesh.name.includes('_rail_') ||
                    mesh.name.includes('Track')) {
                    trackMeshes.push(mesh);
                }
            }

            return trackMeshes;

        } catch (error) {
            console.error(`${LOG_PREFIX} Error finding track meshes:`, error);
            return [];
        }
    }

    /**
     * Find track at a pointer position
     * Uses ray casting to detect track meshes under the pointer
     * 
     * @param pointerX - Pointer X position
     * @param pointerY - Pointer Y position
     * @returns Track segment info or null if no track found
     */
    private findTrackAtPointer(pointerX: number, pointerY: number): TrackSegmentInfo | null {
        try {
            // Create ray from camera through pointer position
            const ray = this.scene.createPickingRay(
                pointerX,
                pointerY,
                null,
                this.scene.activeCamera
            );

            if (!ray) {
                return null;
            }

            // Find track meshes
            const trackMeshes = this.findTrackMeshes();

            if (trackMeshes.length === 0) {
                return null;
            }

            // Pick against track meshes
            const pickResult = this.scene.pickWithRay(ray, (mesh) => {
                return trackMeshes.includes(mesh) && mesh.isPickable;
            });

            if (!pickResult || !pickResult.hit || !pickResult.pickedMesh || !pickResult.pickedPoint) {
                return null;
            }

            // Get track segment info
            return this.getTrackSegmentInfo(pickResult);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error finding track at pointer:`, error);
            return null;
        }
    }

    /**
     * Extract track segment information from a pick result
     * Calculates centerline position and track direction
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

            // Get the parent transform node to find sibling rails
            const parent = pickedMesh.parent;

            if (parent) {
                // Find left and right rail meshes
                const children = parent.getChildMeshes();
                let leftRail: AbstractMesh | null = null;
                let rightRail: AbstractMesh | null = null;

                for (const child of children) {
                    if (child.name.includes('rail_left') || child.name.includes('leftRail')) {
                        leftRail = child;
                    } else if (child.name.includes('rail_right') || child.name.includes('rightRail')) {
                        rightRail = child;
                    }
                }

                if (leftRail && rightRail) {
                    // Calculate centerline from rail positions
                    const leftBounds = leftRail.getBoundingInfo().boundingBox;
                    const rightBounds = rightRail.getBoundingInfo().boundingBox;

                    // Get world centers of rails
                    const leftCenter = leftBounds.centerWorld.clone();
                    const rightCenter = rightBounds.centerWorld.clone();

                    // Track centerline is midpoint between rails
                    const centerX = (leftCenter.x + rightCenter.x) / 2;
                    const centerY = Math.max(leftCenter.y, rightCenter.y);
                    const centerZ = (leftCenter.z + rightCenter.z) / 2;

                    // Rail vector points from left to right rail
                    const railVector = rightCenter.subtract(leftCenter).normalize();

                    // Track forward direction is perpendicular to rail vector (in XZ plane)
                    // Rotate rail vector 90° around Y axis
                    const forward = new Vector3(-railVector.z, 0, railVector.x).normalize();

                    // Right direction (same as rail vector, pointing from center toward right rail)
                    const right = railVector.clone();

                    // Snap hit point to centerline position
                    const snappedPosition = new Vector3(
                        centerX,
                        centerY + OO_GAUGE.MODEL_HEIGHT_OFFSET_M,
                        centerZ
                    );

                    // Calculate distance from pointer to centerline
                    const centerLine = new Vector3(centerX, centerY, centerZ);
                    const toHit = hitPoint.subtract(centerLine);
                    const distance = Math.abs(toHit.x * right.x + toHit.z * right.z);

                    console.log(`${LOG_PREFIX} Track segment calculated:`);
                    console.log(`${LOG_PREFIX}   Position: (${snappedPosition.x.toFixed(3)}, ${snappedPosition.y.toFixed(3)}, ${snappedPosition.z.toFixed(3)})`);
                    console.log(`${LOG_PREFIX}   Forward:  (${forward.x.toFixed(3)}, ${forward.y.toFixed(3)}, ${forward.z.toFixed(3)})`);

                    return {
                        position: snappedPosition,
                        forward: forward,
                        right: right,
                        trackMesh: pickedMesh,
                        distance: distance
                    };
                }
            }

            // Fallback: use mesh orientation directly
            console.log(`${LOG_PREFIX} Using fallback orientation (rails not found separately)`);

            // Try to get orientation from mesh rotation
            const meshRotation = pickedMesh.rotationQuaternion ||
                Quaternion.FromEulerAngles(
                    pickedMesh.rotation.x,
                    pickedMesh.rotation.y,
                    pickedMesh.rotation.z
                );

            // Default forward is along Z axis, rotated by mesh rotation
            const forward = new Vector3(0, 0, 1);
            forward.rotateByQuaternionToRef(meshRotation, forward);
            forward.y = 0;
            forward.normalize();

            const right = Vector3.Cross(Vector3.Up(), forward).normalize();

            return {
                position: hitPoint.clone(),
                forward: forward,
                right: right,
                trackMesh: pickedMesh,
                distance: 0
            };

        } catch (error) {
            console.error(`${LOG_PREFIX} Error getting track segment info:`, error);
            return null;
        }
    }

    // ========================================================================
    // PLACEMENT CALCULATION
    // ========================================================================

    /**
     * Calculate placement position and rotation from track segment
     * 
     * This is the key method that ensures the train faces ALONG the track,
     * not across it. The rotation is calculated based on:
     * 1. The track's forward direction (tangent along the rails)
     * 2. The model's expected forward axis convention
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
        // This rotates the model so its "front" aligns with the track direction
        const finalAngle = trackAngle + modelOffset;

        // Convert to degrees for display/debugging
        const rotationDegrees = (finalAngle * 180 / Math.PI);

        // Create quaternion for Y-axis rotation
        const rotation = Quaternion.FromEulerAngles(0, finalAngle, 0);

        // Check if placement is valid (close enough to track centerline)
        const isValid = segment.distance <= SNAP_CONFIG.MAX_DISTANCE_M;

        console.log(`${LOG_PREFIX} Placement calculated:`);
        console.log(`${LOG_PREFIX}   Track angle: ${(trackAngle * 180 / Math.PI).toFixed(1)}°`);
        console.log(`${LOG_PREFIX}   Model offset: ${(modelOffset * 180 / Math.PI).toFixed(1)}°`);
        console.log(`${LOG_PREFIX}   Final rotation: ${rotationDegrees.toFixed(1)}°`);
        console.log(`${LOG_PREFIX}   Valid: ${isValid}`);

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

            this.isPlacing = true;
            this.placementCallback = callback;
            this.currentSnapResult = null;

            // Show instruction message
            this.showMessage('Click on a track piece to place the train. Press ESC to cancel.');

            // Bind event handlers
            this.boundPointerMove = this.onPointerMove.bind(this);
            this.boundPointerDown = this.onPointerDown.bind(this);
            this.boundKeyDown = this.onKeyDown.bind(this);

            this.canvas.addEventListener('pointermove', this.boundPointerMove);
            this.canvas.addEventListener('pointerdown', this.boundPointerDown);
            window.addEventListener('keydown', this.boundKeyDown);

            // Show preview indicator
            if (this.previewIndicator) {
                this.previewIndicator.isVisible = true;
            }

            console.log(`${LOG_PREFIX} ✓ Placement mode active`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error starting placement:`, error);
            this.cancelPlacement();
        }
    }

    /**
     * Cancel placement mode without completing
     */
    cancelPlacement(): void {
        this.endPlacement(null);
    }

    /**
     * End placement mode
     * @param result - Placement result or null if cancelled
     */
    private endPlacement(result: TrackPlacementResult | null): void {
        try {
            console.log(`${LOG_PREFIX} Ending placement mode...`);

            // Remove event listeners
            if (this.boundPointerMove) {
                this.canvas.removeEventListener('pointermove', this.boundPointerMove);
                this.boundPointerMove = null;
            }
            if (this.boundPointerDown) {
                this.canvas.removeEventListener('pointerdown', this.boundPointerDown);
                this.boundPointerDown = null;
            }
            if (this.boundKeyDown) {
                window.removeEventListener('keydown', this.boundKeyDown);
                this.boundKeyDown = null;
            }

            // Hide preview
            if (this.previewIndicator) {
                this.previewIndicator.isVisible = false;
            }

            // Clear highlight
            this.clearTrackHighlight();

            // Hide message
            this.hideMessage();

            // Call callback
            const callback = this.placementCallback;
            this.placementCallback = null;
            this.isPlacing = false;
            this.currentSnapResult = null;

            if (callback) {
                callback(result);
            }

            console.log(`${LOG_PREFIX} Placement mode ended (${result ? 'completed' : 'cancelled'})`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error ending placement:`, error);
        }
    }

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    /**
     * Handle pointer move during placement
     * Updates preview indicator and track highlighting
     */
    private onPointerMove(evt: PointerEvent): void {
        try {
            const segment = this.findTrackAtPointer(evt.clientX, evt.clientY);

            if (segment) {
                // Calculate placement
                this.currentSnapResult = this.calculatePlacement(segment);

                // Update preview indicator
                if (this.previewIndicator && this.currentSnapResult) {
                    this.previewIndicator.position = this.currentSnapResult.position.clone();
                    this.previewIndicator.rotationQuaternion = this.currentSnapResult.rotation.clone();
                    this.previewIndicator.isVisible = true;

                    // Change color based on validity
                    if (this.previewMaterial) {
                        if (this.currentSnapResult.isValid) {
                            // Green for valid
                            this.previewMaterial.diffuseColor = new Color3(0.0, 0.8, 0.3);
                            this.previewMaterial.emissiveColor = new Color3(0.0, 0.4, 0.15);
                        } else {
                            // Red for invalid (too far from centerline)
                            this.previewMaterial.diffuseColor = new Color3(0.8, 0.2, 0.2);
                            this.previewMaterial.emissiveColor = new Color3(0.4, 0.1, 0.1);
                        }
                    }
                }

                // Highlight track
                this.highlightTrack(segment.trackMesh);

            } else {
                // Not over track
                this.currentSnapResult = null;

                // Hide preview
                if (this.previewIndicator) {
                    this.previewIndicator.isVisible = false;
                }

                // Clear highlight
                this.clearTrackHighlight();
            }

        } catch (error) {
            // Don't spam console on every move
        }
    }

    /**
     * Handle pointer down during placement
     * Completes placement if over valid track position
     */
    private onPointerDown(evt: PointerEvent): void {
        try {
            // Only respond to left click
            if (evt.button !== 0) {
                return;
            }

            if (this.currentSnapResult && this.currentSnapResult.isValid) {
                // Valid placement - complete
                console.log(`${LOG_PREFIX} Placement confirmed at (${this.currentSnapResult.position.x.toFixed(3)}, ${this.currentSnapResult.position.z.toFixed(3)})`);
                this.endPlacement(this.currentSnapResult);
            } else if (this.currentSnapResult) {
                // Over track but too far from centerline
                console.log(`${LOG_PREFIX} Invalid placement - too far from track centerline`);
            } else {
                // Not over any track
                console.log(`${LOG_PREFIX} No track at click position`);
            }

        } catch (error) {
            console.error(`${LOG_PREFIX} Error on pointer down:`, error);
        }
    }

    /**
     * Handle key press during placement
     * ESC cancels placement
     */
    private onKeyDown(evt: KeyboardEvent): void {
        try {
            if (evt.key === 'Escape') {
                console.log(`${LOG_PREFIX} Placement cancelled by user`);
                this.cancelPlacement();
            }

        } catch (error) {
            console.error(`${LOG_PREFIX} Error on key down:`, error);
        }
    }

    // ========================================================================
    // TRACK HIGHLIGHTING
    // ========================================================================

    /**
     * Highlight a track mesh
     * @param mesh - Track mesh to highlight
     */
    private highlightTrack(mesh: AbstractMesh): void {
        try {
            // Skip if already highlighted
            if (this.highlightedTracks.includes(mesh)) {
                return;
            }

            // Clear previous highlight
            this.clearTrackHighlight();

            // Get parent to highlight entire track piece
            const parent = mesh.parent;
            const meshesToHighlight: AbstractMesh[] = [];

            if (parent) {
                meshesToHighlight.push(...parent.getChildMeshes());
            } else {
                meshesToHighlight.push(mesh);
            }

            // Store original materials and apply highlight
            for (const m of meshesToHighlight) {
                this.originalMaterials.set(m.name, m.material);
                // Don't override material, just store reference
            }

            this.highlightedTracks = meshesToHighlight;

        } catch (error) {
            console.error(`${LOG_PREFIX} Error highlighting track:`, error);
        }
    }

    /**
     * Clear track highlighting
     */
    private clearTrackHighlight(): void {
        try {
            // Restore original materials
            for (const mesh of this.highlightedTracks) {
                const original = this.originalMaterials.get(mesh.name);
                if (original !== undefined) {
                    // Material was stored, would restore here if we changed it
                }
            }

            this.highlightedTracks = [];
            this.originalMaterials.clear();

        } catch (error) {
            console.error(`${LOG_PREFIX} Error clearing highlight:`, error);
        }
    }

    // ========================================================================
    // MESSAGE OVERLAY
    // ========================================================================

    /**
     * Show an instruction message overlay
     * @param text - Message text to display
     */
    private showMessage(text: string): void {
        try {
            // Create or update message overlay
            if (!this.messageOverlay) {
                this.messageOverlay = document.createElement('div');
                this.messageOverlay.id = 'trackPlacerMessage';
                this.messageOverlay.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: rgba(0, 0, 0, 0.85);
                    color: white;
                    padding: 20px 30px;
                    border-radius: 10px;
                    font-family: 'Segoe UI', Arial, sans-serif;
                    font-size: 16px;
                    text-align: center;
                    z-index: 10000;
                    pointer-events: none;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                `;
                document.body.appendChild(this.messageOverlay);
            }

            // Add train icon and message
            this.messageOverlay.innerHTML = `
                <div style="font-size: 32px; margin-bottom: 10px;">🚂</div>
                <div>${text}</div>
            `;
            this.messageOverlay.style.display = 'block';

        } catch (error) {
            console.error(`${LOG_PREFIX} Error showing message:`, error);
        }
    }

    /**
     * Hide the message overlay
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

            console.log(`${LOG_PREFIX} ✓ Disposed`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error disposing:`, error);
        }
    }
}

// ============================================================================
// UTILITY FUNCTION FOR TESTING ORIENTATION
// ============================================================================

/**
 * Test different model forward axes to find the correct one
 * Call this from browser console if trains are still facing wrong way
 * 
 * Usage:
 *   window.testTrainOrientation('POS_X');
 *   window.testTrainOrientation('NEG_Y');
 *   etc.
 */
export function registerOrientationTester(placer: TrackModelPlacer): void {
    (window as any).testTrainOrientation = (axis: ModelForwardAxis) => {
        console.log(`[TrackModelPlacer] Testing orientation with forward axis: ${axis}`);
        placer.setModelForwardAxis(axis);
        console.log(`[TrackModelPlacer] Now place a train on the track to test.`);
        console.log(`[TrackModelPlacer] If still wrong, try: POS_X, NEG_X, POS_Y, NEG_Y, POS_Z, NEG_Z`);
    };
}