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
 * @module TrackModelPlacer
 * @author Model Railway Workbench
 * @version 1.0.0
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
    /** Track gauge in meters */
    GAUGE_M: 0.0165,
    /** Rail height in meters */
    RAIL_HEIGHT_M: 0.003,
    /** Height above rail for model placement */
    MODEL_HEIGHT_OFFSET_M: 0.001,
} as const;

/** Snap configuration */
const SNAP_CONFIG = {
    /** Maximum distance from track centerline for valid placement (meters) */
    MAX_DISTANCE_M: 0.05,
    /** Search radius for finding track meshes */
    SEARCH_RADIUS_M: 0.1,
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Information about a track segment for model placement
 */
export interface TrackSegmentInfo {
    /** Center position on the track */
    position: Vector3;
    /** Forward direction along the track */
    forward: Vector3;
    /** Right direction (perpendicular to track) */
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
    /** World position for the model */
    position: Vector3;
    /** Rotation quaternion aligned with track */
    rotation: Quaternion;
    /** Y-axis rotation in degrees */
    rotationDegrees: number;
    /** The track segment info */
    segment: TrackSegmentInfo;
    /** Whether placement is valid */
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

    /** Preview indicator mesh */
    private previewIndicator: Mesh | null = null;

    /** Preview indicator material */
    private previewMaterial: StandardMaterial | null = null;

    /** Track highlight material */
    private highlightMaterial: StandardMaterial | null = null;

    /** Original materials of highlighted tracks */
    private originalMaterials: Map<string, any> = new Map();

    /** Currently highlighted track meshes */
    private highlightedTracks: AbstractMesh[] = [];

    /** Bound event handlers */
    private boundPointerMove: ((evt: PointerEvent) => void) | null = null;
    private boundPointerDown: ((evt: PointerEvent) => void) | null = null;
    private boundKeyDown: ((evt: KeyboardEvent) => void) | null = null;

    /** Canvas element */
    private canvas: HTMLCanvasElement;

    /** Current snap result */
    private currentSnapResult: TrackPlacementResult | null = null;

    /** Message overlay element */
    private messageOverlay: HTMLDivElement | null = null;

    // ========================================================================
    // CONSTRUCTOR & INITIALIZATION
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
        this.canvas = scene.getEngine().getRenderingCanvas() as HTMLCanvasElement;

        console.log(`${LOG_PREFIX} Created`);
    }

    /**
     * Initialize the placer
     */
    initialize(): void {
        console.log(`${LOG_PREFIX} Initializing...`);

        // Create materials
        this.createMaterials();

        // Create preview indicator
        this.createPreviewIndicator();

        console.log(`${LOG_PREFIX} ✓ Initialized`);
    }

    // ========================================================================
    // MATERIAL CREATION
    // ========================================================================

    /**
     * Create materials for preview and highlighting
     */
    private createMaterials(): void {
        // Preview indicator material (green glow)
        this.previewMaterial = new StandardMaterial('trackPlacerPreview', this.scene);
        this.previewMaterial.diffuseColor = new Color3(0.2, 1.0, 0.2);
        this.previewMaterial.emissiveColor = new Color3(0.1, 0.5, 0.1);
        this.previewMaterial.alpha = 0.8;

        // Track highlight material
        this.highlightMaterial = new StandardMaterial('trackPlacerHighlight', this.scene);
        this.highlightMaterial.diffuseColor = new Color3(0.3, 0.7, 1.0);
        this.highlightMaterial.emissiveColor = new Color3(0.1, 0.3, 0.5);
        this.highlightMaterial.alpha = 0.5;
    }

    /**
     * Create the preview indicator mesh
     */
    private createPreviewIndicator(): void {
        // Create a cylinder to indicate placement position and direction
        this.previewIndicator = MeshBuilder.CreateCylinder('trackPlacerIndicator', {
            height: 0.01,
            diameter: 0.03,
            tessellation: 16
        }, this.scene);

        this.previewIndicator.material = this.previewMaterial;
        this.previewIndicator.isPickable = false;
        this.previewIndicator.setEnabled(false);

        // Create direction arrow
        const arrow = MeshBuilder.CreateCylinder('trackPlacerArrow', {
            height: 0.04,
            diameterTop: 0,
            diameterBottom: 0.015,
            tessellation: 8
        }, this.scene);
        arrow.material = this.previewMaterial;
        arrow.rotation.x = Math.PI / 2;
        arrow.position.z = 0.03;
        arrow.parent = this.previewIndicator;
        arrow.isPickable = false;
    }

    // ========================================================================
    // PLACEMENT MODE
    // ========================================================================

    /**
     * Start track placement mode
     * @param callback - Called when placement completes (with result or null if cancelled)
     */
    startPlacement(callback: PlacementCallback): void {
        if (this.isPlacing) {
            console.warn(`${LOG_PREFIX} Already in placement mode`);
            return;
        }

        console.log(`${LOG_PREFIX} Starting track placement mode`);
        this.isPlacing = true;
        this.placementCallback = callback;

        // Notify other systems that placement mode is starting
        // This allows InputManager to disable its handlers
        window.dispatchEvent(new CustomEvent('trackPlacementStart'));

        // Show preview indicator
        if (this.previewIndicator) {
            this.previewIndicator.setEnabled(true);
        }

        // Highlight all track pieces
        this.highlightAllTracks();

        // Show message overlay
        this.showMessage('Click on a track piece to place the rolling stock. Press ESC to cancel.');

        // Attach event handlers
        this.attachEventHandlers();
    }

    /**
     * Cancel placement mode
     */
    cancelPlacement(): void {
        if (!this.isPlacing) return;

        console.log(`${LOG_PREFIX} Placement cancelled`);
        this.endPlacement(null);
    }

    /**
     * End placement mode
     * @param result - Placement result or null if cancelled
     */
    private endPlacement(result: TrackPlacementResult | null): void {
        this.isPlacing = false;

        // Hide preview indicator
        if (this.previewIndicator) {
            this.previewIndicator.setEnabled(false);
        }

        // Remove track highlights
        this.unhighlightAllTracks();

        // Hide message
        this.hideMessage();

        // Detach event handlers
        this.detachEventHandlers();

        // Notify other systems that placement mode is ending
        window.dispatchEvent(new CustomEvent('trackPlacementEnd'));

        // Call callback
        if (this.placementCallback) {
            this.placementCallback(result);
            this.placementCallback = null;
        }
    }

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    /**
     * Attach event handlers for placement mode
     * Uses capture phase to intercept events before other handlers
     */
    private attachEventHandlers(): void {
        this.boundPointerMove = this.onPointerMove.bind(this);
        this.boundPointerDown = this.onPointerDown.bind(this);
        this.boundKeyDown = this.onKeyDown.bind(this);

        // Use capture phase to intercept events before InputManager
        this.canvas.addEventListener('pointermove', this.boundPointerMove, { capture: true });
        this.canvas.addEventListener('pointerdown', this.boundPointerDown, { capture: true });
        window.addEventListener('keydown', this.boundKeyDown);
    }

    /**
     * Detach event handlers
     */
    private detachEventHandlers(): void {
        if (this.boundPointerMove) {
            this.canvas.removeEventListener('pointermove', this.boundPointerMove, { capture: true });
            this.boundPointerMove = null;
        }
        if (this.boundPointerDown) {
            this.canvas.removeEventListener('pointerdown', this.boundPointerDown, { capture: true });
            this.boundPointerDown = null;
        }
        if (this.boundKeyDown) {
            window.removeEventListener('keydown', this.boundKeyDown);
            this.boundKeyDown = null;
        }
    }

    /**
     * Handle pointer move during placement
     */
    private onPointerMove(evt: PointerEvent): void {
        if (!this.isPlacing) return;

        // Pick track at pointer position
        const pickResult = this.scene.pick(evt.clientX, evt.clientY, (mesh) => {
            return this.isTrackMesh(mesh);
        });

        if (pickResult?.hit && pickResult.pickedPoint) {
            // Find track segment info
            const segment = this.getTrackSegmentAt(pickResult);

            if (segment) {
                // Calculate placement
                this.currentSnapResult = this.calculatePlacement(segment);

                // Update preview indicator
                this.updatePreviewIndicator(this.currentSnapResult);
            } else {
                this.currentSnapResult = null;
                this.hidePreviewIndicator();
            }
        } else {
            this.currentSnapResult = null;
            this.hidePreviewIndicator();
        }
    }

    /**
     * Handle pointer down during placement
     */
    private onPointerDown(evt: PointerEvent): void {
        if (!this.isPlacing) return;
        if (evt.button !== 0) return; // Left click only

        // Prevent other handlers from processing this click
        evt.preventDefault();
        evt.stopPropagation();

        console.log(`${LOG_PREFIX} Click detected, currentSnapResult:`, this.currentSnapResult?.isValid);

        if (this.currentSnapResult && this.currentSnapResult.isValid) {
            console.log(`${LOG_PREFIX} Placing at track position`);
            this.endPlacement(this.currentSnapResult);
        } else {
            console.log(`${LOG_PREFIX} No valid snap position - click ignored`);
        }
    }

    /**
     * Handle key down during placement
     */
    private onKeyDown(evt: KeyboardEvent): void {
        if (!this.isPlacing) return;

        if (evt.key === 'Escape') {
            evt.preventDefault();
            this.cancelPlacement();
        }
    }

    // ========================================================================
    // TRACK DETECTION
    // ========================================================================

    /**
     * Check if a mesh is a track mesh
     * 
     * Track meshes follow naming patterns like:
     * - "rail_L_piece_0_edge_0"
     * - "rail_R_piece_1_edge_1"  
     * - "sleeper_piece_1_edge_1_5"
     * - "ballast_piece_0_edge_0"
     */
    private isTrackMesh(mesh: AbstractMesh): boolean {
        if (!mesh || !mesh.name) return false;

        const name = mesh.name.toLowerCase();

        // Track meshes contain "piece_" and a component identifier
        return name.includes('piece_') && (
            name.includes('rail') ||
            name.includes('sleeper') ||
            name.includes('ballast') ||
            name.includes('track')
        );
    }

    /**
     * Get all track meshes in the scene
     */
    private getAllTrackMeshes(): AbstractMesh[] {
        const trackMeshes = this.scene.meshes.filter(mesh => this.isTrackMesh(mesh));
        console.log(`${LOG_PREFIX} getAllTrackMeshes found ${trackMeshes.length} mesh(es)`);
        return trackMeshes;
    }

    /**
     * Extract piece ID from track mesh name
     * 
     * Handles naming patterns like:
     * - "rail_L_piece_0_edge_0" -> "piece_0"
     * - "sleeper_piece_1_edge_1_5" -> "piece_1"
     * - "ballast_piece_2_edge_0" -> "piece_2"
     */
    private getPieceIdFromMesh(mesh: AbstractMesh): string | null {
        if (!mesh.name) return null;

        // Pattern: find "piece_X" anywhere in the string
        const match = mesh.name.match(/(piece_\d+)/);
        if (match) {
            return match[1];
        }

        console.warn(`${LOG_PREFIX} Could not extract piece ID from mesh: ${mesh.name}`);
        return null;
    }

    /**
     * Get track segment information at a pick result
     */
    private getTrackSegmentAt(pickResult: PickingInfo): TrackSegmentInfo | null {
        if (!pickResult.hit || !pickResult.pickedPoint || !pickResult.pickedMesh) {
            return null;
        }

        const pickedMesh = pickResult.pickedMesh;
        const hitPoint = pickResult.pickedPoint;

        // Get piece ID to find all meshes of this piece
        const pieceId = this.getPieceIdFromMesh(pickedMesh);
        if (!pieceId) {
            console.warn(`${LOG_PREFIX} Could not extract piece ID from picked mesh: ${pickedMesh.name}`);
            return null;
        }

        console.log(`${LOG_PREFIX} Hit piece: ${pieceId} at (${hitPoint.x.toFixed(3)}, ${hitPoint.z.toFixed(3)})`);

        // Find rail meshes for this piece to determine centerline
        // Pattern: "rail_L_piece_X_edge_Y" and "rail_R_piece_X_edge_Y"
        const railMeshes = this.scene.meshes.filter(mesh => {
            return mesh.name.includes(pieceId) && mesh.name.includes('rail');
        });

        console.log(`${LOG_PREFIX} Found ${railMeshes.length} rail mesh(es) for ${pieceId}`);

        if (railMeshes.length < 2) {
            // Fallback: use the picked point directly
            console.log(`${LOG_PREFIX} Using fallback position (not enough rails found)`);
            return {
                position: hitPoint.clone(),
                forward: new Vector3(1, 0, 0), // Default forward
                right: new Vector3(0, 0, 1),
                trackMesh: pickedMesh,
                distance: 0
            };
        }

        // Calculate centerline between rails
        // Rails are named rail_L (left) and rail_R (right)
        const leftRail = railMeshes.find(m => m.name.includes('rail_L'));
        const rightRail = railMeshes.find(m => m.name.includes('rail_R'));

        if (leftRail && rightRail) {
            // Get bounding box centers
            const leftCenter = leftRail.getBoundingInfo().boundingBox.centerWorld;
            const rightCenter = rightRail.getBoundingInfo().boundingBox.centerWorld;

            // Track centerline is midway between rails
            const centerX = (leftCenter.x + rightCenter.x) / 2;
            const centerZ = (leftCenter.z + rightCenter.z) / 2;

            // Calculate track direction from rail orientation
            // Use the hit point's X/Z but snap to centerline Y
            const centerY = (leftCenter.y + rightCenter.y) / 2 + OO_GAUGE.RAIL_HEIGHT_M;

            // Estimate forward direction from rail positions
            // This is approximate - ideally we'd get this from the track piece data
            const railVector = rightCenter.subtract(leftCenter).normalize();
            const forward = new Vector3(-railVector.z, 0, railVector.x).normalize();
            const right = railVector.clone();

            // Snap hit point to centerline
            const snappedPosition = new Vector3(
                hitPoint.x,
                centerY + OO_GAUGE.MODEL_HEIGHT_OFFSET_M,
                hitPoint.z
            );

            // Calculate distance from centerline
            const centerLine = new Vector3(centerX, centerY, centerZ);
            const toHit = hitPoint.subtract(centerLine);
            const distance = Math.abs(toHit.x * right.x + toHit.z * right.z);

            console.log(`${LOG_PREFIX} Track segment: pos=(${snappedPosition.x.toFixed(3)}, ${snappedPosition.z.toFixed(3)}), fwd=(${forward.x.toFixed(2)}, ${forward.z.toFixed(2)})`);

            return {
                position: snappedPosition,
                forward: forward,
                right: right,
                trackMesh: pickedMesh,
                distance: distance
            };
        }

        // Fallback
        console.log(`${LOG_PREFIX} Using fallback (left/right rails not found)`);
        return {
            position: hitPoint.clone(),
            forward: new Vector3(1, 0, 0),
            right: new Vector3(0, 0, 1),
            trackMesh: pickedMesh,
            distance: 0
        };
    }

    // ========================================================================
    // PLACEMENT CALCULATION
    // ========================================================================

    /**
     * Calculate placement position and rotation from track segment
     */
    private calculatePlacement(segment: TrackSegmentInfo): TrackPlacementResult {
        // Position is on the track centerline
        const position = segment.position.clone();

        // Calculate rotation to align with track direction
        // The model should face along the track's forward direction
        const angle = Math.atan2(segment.forward.x, segment.forward.z);
        const rotationDegrees = (angle * 180 / Math.PI);

        // Create quaternion from Y-axis rotation
        const rotation = Quaternion.FromEulerAngles(0, angle, 0);

        // Check if placement is valid (close enough to track center)
        const isValid = segment.distance < SNAP_CONFIG.MAX_DISTANCE_M;

        return {
            position,
            rotation,
            rotationDegrees,
            segment,
            isValid
        };
    }

    // ========================================================================
    // VISUAL FEEDBACK
    // ========================================================================

    /**
     * Update preview indicator position and rotation
     */
    private updatePreviewIndicator(result: TrackPlacementResult): void {
        if (!this.previewIndicator) return;

        this.previewIndicator.setEnabled(true);
        this.previewIndicator.position = result.position.clone();
        this.previewIndicator.position.y += 0.005; // Slightly above track
        this.previewIndicator.rotationQuaternion = result.rotation.clone();

        // Change color based on validity
        if (this.previewMaterial) {
            if (result.isValid) {
                this.previewMaterial.diffuseColor = new Color3(0.2, 1.0, 0.2);
                this.previewMaterial.emissiveColor = new Color3(0.1, 0.5, 0.1);
            } else {
                this.previewMaterial.diffuseColor = new Color3(1.0, 0.3, 0.2);
                this.previewMaterial.emissiveColor = new Color3(0.5, 0.1, 0.1);
            }
        }
    }

    /**
     * Hide the preview indicator
     */
    private hidePreviewIndicator(): void {
        if (this.previewIndicator) {
            this.previewIndicator.setEnabled(false);
        }
    }

    /**
     * Highlight all track pieces
     */
    private highlightAllTracks(): void {
        const trackMeshes = this.getAllTrackMeshes();

        // Group by piece ID
        const pieceIds = new Set<string>();
        trackMeshes.forEach(mesh => {
            const pieceId = this.getPieceIdFromMesh(mesh);
            if (pieceId) pieceIds.add(pieceId);
        });

        console.log(`${LOG_PREFIX} Found ${pieceIds.size} track piece(s) to highlight`);

        // Highlight ballast meshes for each piece (they're most visible)
        pieceIds.forEach(pieceId => {
            // Find ballast mesh for this piece
            // Pattern: "ballast_piece_X_edge_Y"
            const ballastMesh = this.scene.meshes.find(
                mesh => mesh.name.includes('ballast') && mesh.name.includes(pieceId)
            );

            if (ballastMesh && ballastMesh.material) {
                console.log(`${LOG_PREFIX} Highlighting ballast: ${ballastMesh.name}`);

                // Store original material
                this.originalMaterials.set(ballastMesh.name, ballastMesh.material);

                // Create highlight material copy
                const highlightMat = new StandardMaterial(`${ballastMesh.name}_highlight`, this.scene);
                highlightMat.diffuseColor = new Color3(0.4, 0.6, 0.8);
                highlightMat.emissiveColor = new Color3(0.1, 0.2, 0.3);
                highlightMat.alpha = 0.9;

                ballastMesh.material = highlightMat;
                this.highlightedTracks.push(ballastMesh);
            } else {
                console.warn(`${LOG_PREFIX} No ballast mesh found for ${pieceId}`);
            }
        });
    }

    /**
     * Remove highlights from all tracks
     */
    private unhighlightAllTracks(): void {
        this.highlightedTracks.forEach(mesh => {
            const originalMaterial = this.originalMaterials.get(mesh.name);
            if (originalMaterial) {
                // Dispose temporary highlight material
                if (mesh.material && mesh.material !== originalMaterial) {
                    mesh.material.dispose();
                }
                mesh.material = originalMaterial;
            }
        });

        this.highlightedTracks = [];
        this.originalMaterials.clear();
    }

    /**
     * Show message overlay
     */
    private showMessage(text: string): void {
        if (this.messageOverlay) {
            this.hideMessage();
        }

        this.messageOverlay = document.createElement('div');
        this.messageOverlay.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            background: rgba(0, 0, 0, 0.85);
            color: white;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 14px;
            border-radius: 8px;
            z-index: 2000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            gap: 12px;
        `;

        this.messageOverlay.innerHTML = `
            <span style="font-size: 20px;">🚂</span>
            <span>${text}</span>
        `;

        document.body.appendChild(this.messageOverlay);
    }

    /**
     * Hide message overlay
     */
    private hideMessage(): void {
        if (this.messageOverlay) {
            this.messageOverlay.remove();
            this.messageOverlay = null;
        }
    }

    // ========================================================================
    // PUBLIC METHODS
    // ========================================================================

    /**
     * Check if currently in placement mode
     */
    isInPlacementMode(): boolean {
        return this.isPlacing;
    }

    /**
     * Check if there are any track pieces in the scene
     */
    hasTrackPieces(): boolean {
        return this.getAllTrackMeshes().length > 0;
    }

    /**
     * Get count of track pieces
     */
    getTrackPieceCount(): number {
        const meshes = this.getAllTrackMeshes();
        const pieceIds = new Set<string>();
        meshes.forEach(mesh => {
            const pieceId = this.getPieceIdFromMesh(mesh);
            if (pieceId) pieceIds.add(pieceId);
        });
        return pieceIds.size;
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Dispose of resources
     */
    dispose(): void {
        console.log(`${LOG_PREFIX} Disposing...`);

        // End any active placement
        if (this.isPlacing) {
            this.endPlacement(null);
        }

        // Dispose preview indicator
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

        console.log(`${LOG_PREFIX} Disposed`);
    }
}