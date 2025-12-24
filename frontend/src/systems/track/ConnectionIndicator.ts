/**
 * ConnectionIndicator.ts - Visual indicators for track connectors
 * 
 * Path: frontend/src/systems/track/ConnectionIndicator.ts
 * 
 * This system provides visual feedback for track connection points:
 * - Shows spheres at each connector position
 * - Color-coded based on connection state (connected vs unconnected)
 * - Toggle functionality to show/hide indicators
 * - Updates automatically when track is moved
 * - Snap preview for placement feedback
 * - Connection animation for visual confirmation
 * 
 * @module ConnectionIndicator
 * @version 1.2.0
 */

import { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TrackPiece, Connector } from './TrackPiece';

// ============================================================================
// LOGGING PREFIX
// ============================================================================

const LOG_PREFIX = '[ConnectionIndicator]';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Connection state types for visual differentiation
 */
export type ConnectionState = 'connected' | 'unconnected' | 'hovering' | 'snapping';

/**
 * Configuration options for connection indicators
 */
export interface ConnectionIndicatorConfig {
    /** Radius of the indicator sphere in meters */
    indicatorRadius: number;
    /** Height offset above the track surface */
    heightOffset: number;
    /** Color for connected connectors */
    connectedColor: Color3;
    /** Color for unconnected connectors */
    unconnectedColor: Color3;
    /** Color for connectors being hovered over */
    hoverColor: Color3;
    /** Color for connectors that will snap */
    snapColor: Color3;
    /** Opacity/alpha value for indicators (0-1) */
    opacity: number;
}

/**
 * Individual indicator data structure
 */
interface IndicatorData {
    /** The mesh representing the indicator */
    mesh: Mesh;
    /** Reference to the connector this indicator represents */
    connector: Connector;
    /** Reference to the parent track piece */
    pieceId: string;
    /** Connector ID for lookup */
    connectorId: string;
    /** Current connection state */
    state: ConnectionState;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default configuration values for connection indicators
 */
const DEFAULT_CONFIG: ConnectionIndicatorConfig = {
    indicatorRadius: 0.008,                          // 8mm radius (visible but not obtrusive)
    heightOffset: 0.008,                             // 8mm above track surface
    connectedColor: new Color3(0.2, 0.9, 0.2),       // Bright green
    unconnectedColor: new Color3(1.0, 0.5, 0.0),     // Orange
    hoverColor: new Color3(0.3, 0.6, 1.0),           // Light blue
    snapColor: new Color3(0.0, 1.0, 0.5),            // Cyan/bright green
    opacity: 0.9,
};

/**
 * Animation configuration
 */
const ANIMATION_CONFIG = {
    /** Duration of connection animation in milliseconds */
    connectionAnimDuration: 400,
    /** Initial scale for connection animation */
    connectionAnimStartScale: 2.0,
    /** Final scale for connection animation */
    connectionAnimEndScale: 1.0,
    /** Snap preview indicator radius */
    snapPreviewRadius: 0.012,
    /** Snap preview indicator opacity */
    snapPreviewOpacity: 0.7,
} as const;

// ============================================================================
// CONNECTION INDICATOR CLASS
// ============================================================================

/**
 * ConnectionIndicator - Manages visual indicators for track connector points
 * 
 * Provides visual feedback during track building by showing:
 * - Connection points on each track piece
 * - Whether connectors are connected or available
 * - Snap preview during placement mode
 * - Animation when connections are made
 * 
 * @example
 * ```typescript
 * const indicator = new ConnectionIndicator(scene);
 * indicator.initialize();
 * indicator.updateIndicators(trackPieces);
 * indicator.toggle(); // Toggle visibility
 * ```
 */
export class ConnectionIndicator {
    // ========================================================================
    // PRIVATE PROPERTIES
    // ========================================================================

    /** Reference to the Babylon.js scene */
    private scene: Scene;

    /** Configuration settings */
    private config: ConnectionIndicatorConfig;

    /** Map of piece ID to array of indicator data */
    private indicators: Map<string, IndicatorData[]> = new Map();

    /** Shared materials for performance */
    private materials: Map<ConnectionState, StandardMaterial> = new Map();

    /** Whether indicators are currently visible */
    private _isVisible: boolean = true;

    /** Whether the indicator system is enabled */
    private _isEnabled: boolean = true;

    /** Counter for unique mesh naming */
    private meshCounter: number = 0;

    /** Snap preview indicator mesh */
    private snapPreviewMesh: Mesh | null = null;

    /** Material for snap preview */
    private snapPreviewMaterial: StandardMaterial | null = null;

    /** Active connection animations */
    private activeAnimations: Set<number> = new Set();

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new ConnectionIndicator instance
     * 
     * @param scene - The Babylon.js scene to render indicators in
     * @param config - Optional configuration overrides
     * @throws Error if scene is null or undefined
     */
    constructor(scene: Scene, config?: Partial<ConnectionIndicatorConfig>) {
        // Validate scene parameter
        if (!scene) {
            throw new Error(`${LOG_PREFIX} Scene is required`);
        }

        this.scene = scene;

        // Merge provided config with defaults
        this.config = {
            ...DEFAULT_CONFIG,
            ...config
        };

        // Auto-initialize materials
        this.createMaterials();

        console.log(`${LOG_PREFIX} Created`);
    }

    // ========================================================================
    // PUBLIC METHODS - INITIALIZATION
    // ========================================================================

    /**
     * Initialize the connection indicator system
     * Creates shared materials for performance optimization
     */
    initialize(): void {
        try {
            console.log(`${LOG_PREFIX} Initializing...`);

            // Materials are created in constructor, but ensure they exist
            if (this.materials.size === 0) {
                this.createMaterials();
            }

            // Create snap preview mesh (hidden by default)
            this.createSnapPreviewMesh();

            console.log(`${LOG_PREFIX} ✓ Initialized`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to initialize:`, error);
            throw error;
        }
    }

    // ========================================================================
    // PUBLIC METHODS - ENABLE/DISABLE
    // ========================================================================

    /**
     * Enable or disable the indicator system
     * When disabled, all indicators are hidden and not updated
     * 
     * @param enabled - Whether the system should be enabled
     */
    setEnabled(enabled: boolean): void {
        try {
            this._isEnabled = enabled;

            if (enabled) {
                // Re-show indicators if they were visible before
                this.setVisibility(this._isVisible);
            } else {
                // Hide all indicators when disabled
                this.setVisibility(false);
                this.hideSnapPreview();
            }

            console.log(`${LOG_PREFIX} ${enabled ? 'Enabled' : 'Disabled'}`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error setting enabled state:`, error);
        }
    }

    /**
     * Check if the indicator system is enabled
     * 
     * @returns Current enabled state
     */
    isEnabled(): boolean {
        return this._isEnabled;
    }

    // ========================================================================
    // PUBLIC METHODS - VISIBILITY TOGGLE
    // ========================================================================

    /**
     * Toggle the visibility of all connection indicators
     * 
     * @returns The new visibility state
     */
    toggle(): boolean {
        try {
            this._isVisible = !this._isVisible;
            this.setVisibility(this._isVisible);

            console.log(`${LOG_PREFIX} Visibility toggled: ${this._isVisible ? 'VISIBLE' : 'HIDDEN'}`);
            return this._isVisible;
        } catch (error) {
            console.error(`${LOG_PREFIX} Error toggling visibility:`, error);
            return this._isVisible;
        }
    }

    /**
     * Set the visibility of all connection indicators
     * 
     * @param visible - Whether indicators should be visible
     */
    setVisibility(visible: boolean): void {
        try {
            this._isVisible = visible;

            // Don't show if system is disabled
            const actuallyVisible = visible && this._isEnabled;

            // Update all indicator meshes
            for (const indicators of this.indicators.values()) {
                for (const indicator of indicators) {
                    if (indicator.mesh) {
                        indicator.mesh.isVisible = actuallyVisible;
                    }
                }
            }

            console.log(`${LOG_PREFIX} Set visibility: ${visible}`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error setting visibility:`, error);
        }
    }

    /**
     * Show all connection indicators
     */
    show(): void {
        this.setVisibility(true);
    }

    /**
     * Hide all connection indicators
     */
    hide(): void {
        this.setVisibility(false);
    }

    /**
     * Check if indicators are currently visible
     * 
     * @returns Current visibility state
     */
    isVisible(): boolean {
        return this._isVisible && this._isEnabled;
    }

    // ========================================================================
    // PUBLIC METHODS - SNAP PREVIEW
    // ========================================================================

    /**
     * Show the snap preview indicator at a position
     * Used to show where a piece will snap to during placement mode
     * 
     * @param position - World position to show the preview at
     */
    showSnapPreview(position: Vector3): void {
        try {
            if (!this._isEnabled) return;

            // Create snap preview mesh if it doesn't exist
            if (!this.snapPreviewMesh) {
                this.createSnapPreviewMesh();
            }

            if (this.snapPreviewMesh) {
                this.snapPreviewMesh.position = position.add(
                    new Vector3(0, this.config.heightOffset * 1.5, 0)
                );
                this.snapPreviewMesh.isVisible = true;
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error showing snap preview:`, error);
        }
    }

    /**
     * Hide the snap preview indicator
     */
    hideSnapPreview(): void {
        try {
            if (this.snapPreviewMesh) {
                this.snapPreviewMesh.isVisible = false;
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error hiding snap preview:`, error);
        }
    }

    // ========================================================================
    // PUBLIC METHODS - CONNECTION ANIMATION
    // ========================================================================

    /**
     * Play a connection animation at a position
     * Provides visual feedback when a connection is made
     * 
     * @param position - World position where connection occurred
     */
    playConnectionAnimation(position: Vector3): void {
        try {
            if (!this._isEnabled) return;

            // Create a temporary animated sphere
            const animMesh = MeshBuilder.CreateSphere(
                `connection_anim_${this.meshCounter++}`,
                {
                    diameter: this.config.indicatorRadius * 2 * ANIMATION_CONFIG.connectionAnimStartScale,
                    segments: 16
                },
                this.scene
            );

            if (!animMesh) {
                console.warn(`${LOG_PREFIX} Failed to create animation mesh`);
                return;
            }

            // Position the animation mesh
            animMesh.position = position.add(new Vector3(0, this.config.heightOffset, 0));

            // Create a bright material for the animation
            const animMaterial = new StandardMaterial(`connection_anim_mat_${this.meshCounter}`, this.scene);
            animMaterial.diffuseColor = this.config.connectedColor;
            animMaterial.emissiveColor = this.config.connectedColor.scale(0.8);
            animMaterial.alpha = 1.0;
            animMaterial.backFaceCulling = false;
            animMesh.material = animMaterial;

            // Make it visible but not pickable
            animMesh.isPickable = false;
            animMesh.isVisible = true;

            // Animate scale and opacity
            const startTime = performance.now();
            const duration = ANIMATION_CONFIG.connectionAnimDuration;
            const startScale = ANIMATION_CONFIG.connectionAnimStartScale;
            const endScale = ANIMATION_CONFIG.connectionAnimEndScale;

            const animationId = requestAnimationFrame(function animate(currentTime: number) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1.0);

                // Ease-out curve for smooth animation
                const easedProgress = 1 - Math.pow(1 - progress, 3);

                // Interpolate scale (shrinking)
                const currentScale = startScale + (endScale - startScale) * easedProgress;
                animMesh.scaling.setAll(currentScale);

                // Fade out
                animMaterial.alpha = 1.0 - easedProgress;

                if (progress < 1.0) {
                    requestAnimationFrame(animate);
                } else {
                    // Animation complete - clean up
                    animMesh.dispose();
                    animMaterial.dispose();
                }
            });

            // Track active animation for potential cleanup
            this.activeAnimations.add(animationId);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error playing connection animation:`, error);
        }
    }

    // ========================================================================
    // PUBLIC METHODS - INDICATOR MANAGEMENT
    // ========================================================================

    /**
     * Update indicators for all track pieces
     * This is the main method to call after any track changes
     * 
     * @param pieces - Array of all track pieces to show indicators for
     */
    updateIndicators(pieces: TrackPiece[]): void {
        try {
            if (!pieces || !Array.isArray(pieces)) {
                console.warn(`${LOG_PREFIX} updateIndicators: Invalid pieces array`);
                return;
            }

            // Don't update if disabled
            if (!this._isEnabled) return;

            // Build a set of all connected node IDs
            // A node is "connected" if more than one connector references it
            const nodeUsageCount = new Map<string, number>();

            for (const piece of pieces) {
                if (!piece || !piece.connectors) continue;

                for (const connector of piece.connectors) {
                    if (connector.nodeId) {
                        const count = nodeUsageCount.get(connector.nodeId) || 0;
                        nodeUsageCount.set(connector.nodeId, count + 1);
                    }
                }
            }

            // Nodes used by more than one connector are "connected"
            const connectedNodeIds = new Set<string>();
            for (const [nodeId, count] of nodeUsageCount) {
                if (count > 1) {
                    connectedNodeIds.add(nodeId);
                }
            }

            // Track which piece IDs are still in use
            const activePieceIds = new Set<string>();

            // Update or create indicators for each piece
            for (const piece of pieces) {
                if (!piece) continue;

                activePieceIds.add(piece.id);
                this.updatePieceIndicators(piece, connectedNodeIds);
            }

            // Remove indicators for pieces that no longer exist
            const toRemove: string[] = [];
            for (const pieceId of this.indicators.keys()) {
                if (!activePieceIds.has(pieceId)) {
                    toRemove.push(pieceId);
                }
            }

            for (const pieceId of toRemove) {
                this.removePieceIndicators(pieceId);
            }

        } catch (error) {
            console.error(`${LOG_PREFIX} Error updating indicators:`, error);
        }
    }

    /**
     * Add indicators for a single track piece
     * 
     * @param piece - The track piece to add indicators for
     */
    addPieceIndicators(piece: TrackPiece): void {
        try {
            if (!piece) {
                console.warn(`${LOG_PREFIX} addPieceIndicators: Piece is null`);
                return;
            }

            this.updatePieceIndicators(piece, new Set());
        } catch (error) {
            console.error(`${LOG_PREFIX} Error adding indicators for piece ${piece?.id}:`, error);
        }
    }

    /**
     * Remove indicators for a specific piece
     * 
     * @param pieceId - ID of the piece to remove indicators for
     */
    removePieceIndicators(pieceId: string): void {
        try {
            if (!pieceId) {
                console.warn(`${LOG_PREFIX} removePieceIndicators: pieceId is required`);
                return;
            }

            const indicators = this.indicators.get(pieceId);
            if (!indicators) {
                return; // No indicators for this piece
            }

            // Dispose all meshes for this piece
            for (const indicator of indicators) {
                this.disposeIndicator(indicator);
            }

            // Remove from map
            this.indicators.delete(pieceId);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error removing indicators for piece ${pieceId}:`, error);
        }
    }

    /**
     * Update the state of a specific connector indicator
     * 
     * @param pieceId - ID of the piece containing the connector
     * @param connectorId - ID of the connector to update
     * @param state - New connection state
     */
    setConnectorState(pieceId: string, connectorId: string, state: ConnectionState): void {
        try {
            const indicators = this.indicators.get(pieceId);
            if (!indicators) {
                return;
            }

            const indicator = indicators.find(i => i.connectorId === connectorId);
            if (!indicator) {
                return;
            }

            // Update state and material
            indicator.state = state;
            const material = this.materials.get(state);
            if (material && indicator.mesh) {
                indicator.mesh.material = material;
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error setting connector state:`, error);
        }
    }

    /**
     * Highlight connectors that are within snapping range
     * 
     * @param position - The position to check snap candidates from
     * @param snapDistance - The snapping distance threshold
     * @param pieces - All track pieces to check against
     */
    highlightSnapCandidates(position: Vector3, snapDistance: number, pieces: TrackPiece[]): void {
        try {
            if (!position) return;

            // Find and highlight snap candidates
            for (const piece of pieces) {
                if (!piece || !piece.connectors) continue;

                for (const connector of piece.connectors) {
                    if (!connector.worldPos) continue;

                    const distance = Vector3.Distance(position, connector.worldPos);
                    if (distance <= snapDistance) {
                        this.setConnectorState(piece.id, connector.id, 'snapping');
                    }
                }
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error highlighting snap candidates:`, error);
        }
    }

    /**
     * Clear all snap highlighting and restore normal states
     * 
     * @param pieces - All track pieces to reset state for
     */
    clearSnapHighlighting(pieces: TrackPiece[]): void {
        try {
            // Rebuild connected node set
            const nodeUsageCount = new Map<string, number>();

            for (const piece of pieces) {
                if (!piece || !piece.connectors) continue;

                for (const connector of piece.connectors) {
                    if (connector.nodeId) {
                        const count = nodeUsageCount.get(connector.nodeId) || 0;
                        nodeUsageCount.set(connector.nodeId, count + 1);
                    }
                }
            }

            const connectedNodeIds = new Set<string>();
            for (const [nodeId, count] of nodeUsageCount) {
                if (count > 1) {
                    connectedNodeIds.add(nodeId);
                }
            }

            // Reset all indicator states
            for (const piece of pieces) {
                if (!piece || !piece.connectors) continue;

                for (const connector of piece.connectors) {
                    const isConnected = connector.nodeId ? connectedNodeIds.has(connector.nodeId) : false;
                    const state: ConnectionState = isConnected ? 'connected' : 'unconnected';
                    this.setConnectorState(piece.id, connector.id, state);
                }
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error clearing snap highlighting:`, error);
        }
    }

    // ========================================================================
    // PUBLIC METHODS - UTILITY
    // ========================================================================

    /**
     * Get the total number of indicator meshes
     * 
     * @returns Total indicator count
     */
    getIndicatorCount(): number {
        let count = 0;
        for (const indicators of this.indicators.values()) {
            count += indicators.length;
        }
        return count;
    }

    /**
     * Update configuration settings
     * 
     * @param config - Partial configuration to update
     */
    updateConfig(config: Partial<ConnectionIndicatorConfig>): void {
        try {
            this.config = { ...this.config, ...config };

            // Recreate materials if colors changed
            if (config.connectedColor || config.unconnectedColor ||
                config.hoverColor || config.snapColor || config.opacity) {
                this.disposeMaterials();
                this.createMaterials();
            }

            console.log(`${LOG_PREFIX} Configuration updated`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error updating config:`, error);
        }
    }

    /**
     * Clear all indicators
     */
    clear(): void {
        try {
            for (const pieceId of Array.from(this.indicators.keys())) {
                this.removePieceIndicators(pieceId);
            }
            this.indicators.clear();

            // Hide snap preview
            this.hideSnapPreview();

            console.log(`${LOG_PREFIX} All indicators cleared`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error clearing indicators:`, error);
        }
    }

    /**
     * Dispose of the connection indicator system
     * Releases all resources
     */
    dispose(): void {
        try {
            console.log(`${LOG_PREFIX} Disposing...`);

            // Clear all indicators
            this.clear();

            // Dispose snap preview
            if (this.snapPreviewMesh) {
                this.snapPreviewMesh.dispose();
                this.snapPreviewMesh = null;
            }
            if (this.snapPreviewMaterial) {
                this.snapPreviewMaterial.dispose();
                this.snapPreviewMaterial = null;
            }

            // Dispose materials
            this.disposeMaterials();

            // Clear active animations (they'll clean themselves up)
            this.activeAnimations.clear();

            console.log(`${LOG_PREFIX} Disposed`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error disposing:`, error);
        }
    }

    // ========================================================================
    // PRIVATE METHODS - MATERIAL MANAGEMENT
    // ========================================================================

    /**
     * Create shared materials for each connection state
     * Using shared materials improves rendering performance
     */
    private createMaterials(): void {
        try {
            // Connected state material (green)
            const connectedMat = new StandardMaterial('connIndicator_connected', this.scene);
            connectedMat.diffuseColor = this.config.connectedColor;
            connectedMat.emissiveColor = this.config.connectedColor.scale(0.5);
            connectedMat.alpha = this.config.opacity;
            connectedMat.backFaceCulling = false;
            this.materials.set('connected', connectedMat);

            // Unconnected state material (orange)
            const unconnectedMat = new StandardMaterial('connIndicator_unconnected', this.scene);
            unconnectedMat.diffuseColor = this.config.unconnectedColor;
            unconnectedMat.emissiveColor = this.config.unconnectedColor.scale(0.4);
            unconnectedMat.alpha = this.config.opacity;
            unconnectedMat.backFaceCulling = false;
            this.materials.set('unconnected', unconnectedMat);

            // Hover state material (blue)
            const hoverMat = new StandardMaterial('connIndicator_hover', this.scene);
            hoverMat.diffuseColor = this.config.hoverColor;
            hoverMat.emissiveColor = this.config.hoverColor.scale(0.5);
            hoverMat.alpha = this.config.opacity;
            hoverMat.backFaceCulling = false;
            this.materials.set('hovering', hoverMat);

            // Snap state material (cyan)
            const snapMat = new StandardMaterial('connIndicator_snap', this.scene);
            snapMat.diffuseColor = this.config.snapColor;
            snapMat.emissiveColor = this.config.snapColor.scale(0.6);
            snapMat.alpha = this.config.opacity;
            snapMat.backFaceCulling = false;
            this.materials.set('snapping', snapMat);

            console.log(`${LOG_PREFIX} Materials created`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error creating materials:`, error);
            throw error;
        }
    }

    /**
     * Dispose all shared materials
     */
    private disposeMaterials(): void {
        try {
            for (const material of this.materials.values()) {
                material.dispose();
            }
            this.materials.clear();
        } catch (error) {
            console.error(`${LOG_PREFIX} Error disposing materials:`, error);
        }
    }

    // ========================================================================
    // PRIVATE METHODS - SNAP PREVIEW
    // ========================================================================

    /**
     * Create the snap preview mesh
     */
    private createSnapPreviewMesh(): void {
        try {
            // Create material for snap preview
            this.snapPreviewMaterial = new StandardMaterial('connIndicator_snapPreview', this.scene);
            this.snapPreviewMaterial.diffuseColor = this.config.snapColor;
            this.snapPreviewMaterial.emissiveColor = this.config.snapColor.scale(0.7);
            this.snapPreviewMaterial.alpha = ANIMATION_CONFIG.snapPreviewOpacity;
            this.snapPreviewMaterial.backFaceCulling = false;

            // Create the mesh (a slightly larger, pulsing sphere)
            this.snapPreviewMesh = MeshBuilder.CreateSphere(
                'snapPreview',
                {
                    diameter: ANIMATION_CONFIG.snapPreviewRadius * 2,
                    segments: 16
                },
                this.scene
            );

            this.snapPreviewMesh.material = this.snapPreviewMaterial;
            this.snapPreviewMesh.isVisible = false;
            this.snapPreviewMesh.isPickable = false;

            console.log(`${LOG_PREFIX} Snap preview mesh created`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error creating snap preview mesh:`, error);
        }
    }

    // ========================================================================
    // PRIVATE METHODS - INDICATOR CREATION & UPDATE
    // ========================================================================

    /**
     * Update indicators for a single piece
     * Creates new indicators or updates existing ones
     * 
     * @param piece - The track piece to update indicators for
     * @param connectedNodeIds - Set of node IDs that have multiple connections
     */
    private updatePieceIndicators(piece: TrackPiece, connectedNodeIds: Set<string>): void {
        try {
            // Get existing indicators for this piece
            let existingIndicators = this.indicators.get(piece.id);

            // If connector count changed, recreate all indicators
            if (existingIndicators && existingIndicators.length !== piece.connectors.length) {
                this.removePieceIndicators(piece.id);
                existingIndicators = undefined;
            }

            // Create new indicators if needed
            if (!existingIndicators) {
                const newIndicators: IndicatorData[] = [];

                for (const connector of piece.connectors) {
                    const indicator = this.createIndicator(piece.id, connector, connectedNodeIds);
                    if (indicator) {
                        newIndicators.push(indicator);
                    }
                }

                this.indicators.set(piece.id, newIndicators);
            } else {
                // Update existing indicator positions and states
                for (let i = 0; i < existingIndicators.length; i++) {
                    const indicator = existingIndicators[i];
                    const connector = piece.connectors[i];

                    if (indicator && connector) {
                        // Update the connector reference (it may have new worldPos)
                        indicator.connector = connector;

                        // Update position
                        this.updateIndicatorPosition(indicator, connector);

                        // Update state based on connection
                        const isConnected = connector.nodeId ? connectedNodeIds.has(connector.nodeId) : false;
                        const newState: ConnectionState = isConnected ? 'connected' : 'unconnected';

                        if (indicator.state !== newState) {
                            indicator.state = newState;
                            const material = this.materials.get(newState);
                            if (material && indicator.mesh) {
                                indicator.mesh.material = material;
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error updating piece indicators for ${piece.id}:`, error);
        }
    }

    /**
     * Create a single indicator for a connector
     * 
     * @param pieceId - ID of the parent piece
     * @param connector - The connector to create an indicator for
     * @param connectedNodeIds - Set of connected node IDs
     * @returns The created indicator data, or null on failure
     */
    private createIndicator(
        pieceId: string,
        connector: Connector,
        connectedNodeIds: Set<string>
    ): IndicatorData | null {
        try {
            if (!connector.worldPos) {
                console.warn(`${LOG_PREFIX} Connector ${connector.id} has no worldPos`);
                return null;
            }

            // Generate unique mesh name
            const meshName = `connIndicator_${pieceId}_${connector.id}_${this.meshCounter++}`;

            // Create indicator sphere
            const mesh = MeshBuilder.CreateSphere(meshName, {
                diameter: this.config.indicatorRadius * 2,
                segments: 12
            }, this.scene);

            // Position the indicator
            mesh.position = connector.worldPos.add(new Vector3(0, this.config.heightOffset, 0));

            // Determine initial state based on whether this node is shared
            const isConnected = connector.nodeId ? connectedNodeIds.has(connector.nodeId) : false;
            const state: ConnectionState = isConnected ? 'connected' : 'unconnected';

            // Apply material
            const material = this.materials.get(state);
            if (material) {
                mesh.material = material;
            }

            // Set visibility based on current state
            mesh.isVisible = this._isVisible && this._isEnabled;

            // Make indicator non-pickable (don't interfere with track selection)
            mesh.isPickable = false;

            // Create and return indicator data
            const indicatorData: IndicatorData = {
                mesh,
                connector,
                pieceId,
                connectorId: connector.id,
                state
            };

            return indicatorData;
        } catch (error) {
            console.error(`${LOG_PREFIX} Error creating indicator for ${connector.id}:`, error);
            return null;
        }
    }

    /**
     * Update the position of an existing indicator
     * 
     * @param indicator - The indicator to update
     * @param connector - The connector with updated position
     */
    private updateIndicatorPosition(indicator: IndicatorData, connector: Connector): void {
        try {
            if (!connector.worldPos) return;

            // Update sphere position
            if (indicator.mesh) {
                indicator.mesh.position = connector.worldPos.add(
                    new Vector3(0, this.config.heightOffset, 0)
                );
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error updating indicator position:`, error);
        }
    }

    /**
     * Dispose a single indicator
     * 
     * @param indicator - The indicator to dispose
     */
    private disposeIndicator(indicator: IndicatorData): void {
        try {
            if (indicator.mesh) {
                indicator.mesh.dispose();
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error disposing indicator:`, error);
        }
    }
}