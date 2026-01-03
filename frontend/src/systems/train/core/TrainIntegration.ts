/**
 * TrainIntegration.ts - Connects model import system to train system
 * 
 * Path: frontend/src/systems/train/TrainIntegration.ts
 * 
 * Provides automatic detection and registration of locomotive models
 * as controllable trains when placed on or near track.
 * 
 * Features:
 * - Keyword-based train detection from model names/metadata
 * - Automatic track edge finding for train placement
 * - Manual registration helpers via window globals
 * - Async scanning for better performance
 * 
 * FIX APPLIED (v1.2.0):
 * - Added proper null checks in findNearestEdge to prevent
 *   "can't access property constructor, start is undefined" error
 * - Graph nodes and their positions are now validated before use
 * - Better error messages when registration fails
 * - SAFETY LIMITS added to prevent browser freeze:
 *   - MAX_CANDIDATES = 50 (limits nodes to process)
 *   - MAX_EDGES_TO_SEARCH = 500 (limits edge search)
 *   - yieldToUI() calls to keep browser responsive
 *   - Try-catch wrappers on all loops
 * 
 * @module TrainIntegration
 * @author Model Railway Workbench
 * @version 1.2.0
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Scene } from '@babylonjs/core/scene';
import type { TrainSystem } from './TrainSystem';
import type { TrackGraph, GraphEdge, GraphNode, CurveDefinition } from '../../track/TrackGraph';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[TrainIntegration]';

/** Maximum distance from track for auto-registration (meters) */
const MAX_TRACK_DISTANCE = 0.1; // 100mm

/** Number of samples per edge for distance calculation */
const SAMPLES_PER_EDGE = 20;

/** Maximum candidates to process (safety limit to prevent freeze) */
const MAX_CANDIDATES = 50;

/** Maximum edges to search (safety limit to prevent freeze) */
const MAX_EDGES_TO_SEARCH = 500;

/** Keywords that indicate a model is a train/locomotive */
const TRAIN_KEYWORDS = [
    // General terms
    'train', 'loco', 'locom', 'locomotive', 'engine',
    // Traction types
    'diesel', 'steam', 'electric', 'hybrid',
    // Rolling stock
    'coach', 'carriage', 'wagon', 'freight', 'tanker', 'hopper', 'boxcar',
    'van', 'brake', 'guard', 'pullman', 'sleeper', 'dining',
    // UK specific
    'hst', 'dmu', 'emu', 'unit', 'shunter', 'class',
    // Company prefixes
    'br_', 'gwr_', 'lner_', 'lms_', 'sr_'
];

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Result of finding nearest edge to a position
 */
interface EdgeFindResult {
    /** The edge that was found */
    edge: GraphEdge;
    /** Parametric position on edge (0-1) */
    t: number;
    /** Distance from search position to edge point */
    distance: number;
    /** World position on the edge */
    position: Vector3;
    /** Forward direction at this point */
    forward: Vector3;
}

/**
 * Callback for when a train is registered
 */
export type TrainRegisteredCallback = (
    trainId: string,
    nodeName: string,
    edgeId: string | null
) => void;

// ============================================================================
// STANDALONE HELPER FUNCTION (for backwards compatibility)
// ============================================================================

/**
 * Create global helper functions for train registration
 * 
 * This is a standalone function that can be called from App.ts
 * to install window-level debugging helpers.
 * 
 * BACKWARDS COMPATIBILITY: This export maintains compatibility with
 * existing App.ts imports that use:
 *   import { createGlobalHelpers } from './TrainIntegration';
 * 
 * @param scene - Babylon scene
 * @param trainSystem - Train system instance
 * @param graph - Track graph
 */
export function createGlobalHelpers(
    scene: Scene,
    trainSystem: TrainSystem,
    graph: TrackGraph
): TrainIntegration {
    const integration = new TrainIntegration(scene, trainSystem, graph);
    console.log(`${LOG_PREFIX} Global helpers created via createGlobalHelpers()`);
    return integration;
}

// ============================================================================
// TRAIN INTEGRATION CLASS
// ============================================================================

/**
 * TrainIntegration - Bridges model import and train control systems
 * 
 * @example
 * ```typescript
 * const integration = new TrainIntegration(scene, trainSystem, trackGraph);
 * 
 * // Auto-detect and register trains
 * const count = await integration.scanAndRegisterAsync();
 * console.log(`Registered ${count} trains`);
 * 
 * // Or use window helpers:
 * // window.scanTrains()
 * // window.registerTrain('my_loco')
 * ```
 */
export class TrainIntegration {
    // ========================================================================
    // PRIVATE STATE
    // ========================================================================

    /** Babylon scene */
    private scene: Scene;

    /** Train system reference */
    private trainSystem: TrainSystem;

    /** Track graph reference */
    private graph: TrackGraph;

    /** Callback for registration events */
    private onRegistered: TrainRegisteredCallback | null = null;

    /** Set of already-registered node names to avoid duplicates */
    private registeredNodes: Set<string> = new Set();

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new TrainIntegration
     * @param scene - Babylon scene
     * @param trainSystem - Train system for registration
     * @param graph - Track graph for edge finding
     */
    constructor(
        scene: Scene,
        trainSystem: TrainSystem,
        graph: TrackGraph
    ) {
        this.scene = scene;
        this.trainSystem = trainSystem;
        this.graph = graph;

        console.log(`${LOG_PREFIX} Created`);

        // Install global helpers
        this.installGlobalHelpers();
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /**
     * Set callback for when trains are registered
     * @param callback - Function to call on registration
     */
    setOnRegistered(callback: TrainRegisteredCallback): void {
        this.onRegistered = callback;
    }

    /**
     * Async scan and register train models in the scene
     * 
     * Scans all model_root nodes and scene nodes for train keywords,
     * then attempts to place them on nearby track.
     * 
     * SAFETY: Limited to MAX_CANDIDATES to prevent browser freeze
     * 
     * @returns Number of trains registered
     */
    async scanAndRegisterAsync(): Promise<number> {
        console.log(`${LOG_PREFIX} Starting async scene scan...`);
        console.log(`${LOG_PREFIX}   Keywords: ${TRAIN_KEYWORDS.length} terms`);
        console.log(`${LOG_PREFIX}   Max track distance: ${MAX_TRACK_DISTANCE * 1000}mm`);

        try {
            // Find candidate nodes with safety limit
            const candidates = this.findTrainCandidates();

            // SAFETY: Limit candidates to prevent runaway loops
            const safeCandidates = candidates.slice(0, MAX_CANDIDATES);

            console.log(`${LOG_PREFIX}   Found ${candidates.length} candidate nodes`);
            if (candidates.length > MAX_CANDIDATES) {
                console.warn(`${LOG_PREFIX}   ⚠ Limited to ${MAX_CANDIDATES} candidates for safety`);
            }

            if (safeCandidates.length === 0) {
                console.log(`${LOG_PREFIX}   No train candidates found`);
                return 0;
            }

            let registered = 0;

            for (const node of safeCandidates) {
                // Skip if already registered
                if (this.registeredNodes.has(node.name)) {
                    console.log(`${LOG_PREFIX}   Skipping ${node.name} - already registered`);
                    continue;
                }

                try {
                    // Yield to prevent UI freeze
                    await this.yieldToUI();

                    const success = await this.registerTrainNode(node);
                    if (success) {
                        registered++;
                        this.registeredNodes.add(node.name);
                    }
                } catch (error) {
                    console.error(`${LOG_PREFIX}   Error registering ${node.name}:`, error);
                }
            }

            console.log(`${LOG_PREFIX} ✓ Registered ${registered} train(s)`);
            return registered;

        } catch (error) {
            console.error(`${LOG_PREFIX} scanAndRegisterAsync failed:`, error);
            return 0;
        }
    }

    /**
     * Yield to the UI to prevent browser freeze
     * @returns Promise that resolves after a microtask
     */
    private yieldToUI(): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    /**
     * Manually register a model as a train
     * @param nodeName - Name or partial name of the node
     * @param edgeId - Optional specific edge to place on
     * @param t - Optional parametric position (0-1)
     * @returns true if registration succeeded
     */
    manualRegister(nodeName: string, edgeId?: string, t?: number): boolean {
        console.log(`${LOG_PREFIX} Manual register: ${nodeName}`);

        // Find the node
        const node = this.findNodeByPartialName(nodeName);
        if (!node) {
            console.error(`${LOG_PREFIX}   Node "${nodeName}" not found`);
            return false;
        }

        // If edge specified, place directly
        if (edgeId) {
            return this.registerOnEdge(node, edgeId, t ?? 0.5);
        }

        // Otherwise try auto-placement
        const position = this.getNodePosition(node);
        const edgeResult = this.findNearestEdge(position, MAX_TRACK_DISTANCE);

        if (edgeResult) {
            return this.registerOnEdge(node, edgeResult.edge.id, edgeResult.t);
        }

        // Register without track placement
        return this.registerOffTrack(node);
    }

    /**
     * Force register any model as a train (even without keywords)
     * @param partialName - Partial name to search for
     * @returns true if found and registered
     */
    forceRegister(partialName: string): boolean {
        const node = this.findNodeByPartialName(partialName);
        if (!node) {
            console.error(`${LOG_PREFIX} Node matching "${partialName}" not found`);
            this.listAvailableNodes();
            return false;
        }

        console.log(`${LOG_PREFIX} Force registering: ${node.name}`);
        return this.registerTrainNodeSync(node);
    }

    /**
     * List all registered trains
     */
    listTrains(): void {
        this.trainSystem.debugListTrains();
    }

    // ========================================================================
    // CANDIDATE FINDING
    // ========================================================================

    /**
     * Find all nodes that might be trains based on keywords
     * 
     * SAFETY: Limited iteration to prevent browser freeze
     * 
     * @returns Array of candidate TransformNodes
     */
    private findTrainCandidates(): TransformNode[] {
        const candidates: TransformNode[] = [];

        try {
            // Check model_root nodes (from ModelSystem imports)
            const modelRoots = this.scene.transformNodes.filter(
                tn => tn.name.startsWith('model_root')
            );
            console.log(`${LOG_PREFIX} Checking ${modelRoots.length} model_root nodes`);

            // SAFETY: Limit model roots to check
            const safeModelRoots = modelRoots.slice(0, MAX_CANDIDATES);

            for (const node of safeModelRoots) {
                try {
                    if (this.isTrainCandidate(node)) {
                        console.log(`${LOG_PREFIX} ✓ Candidate found: "${node.name}"`);

                        // Log the original name if available
                        const originalName = this.getOriginalName(node);
                        if (originalName) {
                            console.log(`${LOG_PREFIX}   originalName: "${originalName}"`);
                        }

                        candidates.push(node);

                        // SAFETY: Stop if we have enough candidates
                        if (candidates.length >= MAX_CANDIDATES) {
                            console.warn(`${LOG_PREFIX} Reached max candidates limit`);
                            return candidates;
                        }
                    }
                } catch (error) {
                    console.warn(`${LOG_PREFIX} Error checking node ${node.name}:`, error);
                }
            }

            // Also check root-level meshes (limited)
            let meshesChecked = 0;
            const maxMeshesToCheck = 100;

            for (const mesh of this.scene.meshes) {
                meshesChecked++;
                if (meshesChecked > maxMeshesToCheck) break;

                try {
                    if (mesh.parent === null && this.isTrainCandidate(mesh)) {
                        // Wrap in TransformNode check
                        if (mesh instanceof TransformNode || mesh instanceof AbstractMesh) {
                            const asTransform = mesh as unknown as TransformNode;
                            if (!candidates.includes(asTransform)) {
                                console.log(`${LOG_PREFIX} ✓ Candidate found (root mesh): "${mesh.name}"`);
                                candidates.push(asTransform);

                                // SAFETY: Stop if we have enough candidates
                                if (candidates.length >= MAX_CANDIDATES) {
                                    return candidates;
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.warn(`${LOG_PREFIX} Error checking mesh:`, error);
                }
            }

        } catch (error) {
            console.error(`${LOG_PREFIX} findTrainCandidates failed:`, error);
        }

        return candidates;
    }

    /**
     * Check if a node is likely a train based on name/metadata
     * 
     * SAFETY: Limited child node checking to prevent freeze
     * 
     * @param node - Node to check
     * @returns true if node matches train keywords
     */
    private isTrainCandidate(node: TransformNode | AbstractMesh): boolean {
        try {
            // Check node name
            const nodeName = node.name?.toLowerCase() || '';

            // Check for keywords in node name
            for (const keyword of TRAIN_KEYWORDS) {
                if (nodeName.includes(keyword.toLowerCase())) {
                    return true;
                }
            }

            // Check metadata originalName
            const originalName = this.getOriginalName(node);
            if (originalName) {
                const lowerOriginal = originalName.toLowerCase();
                for (const keyword of TRAIN_KEYWORDS) {
                    if (lowerOriginal.includes(keyword.toLowerCase())) {
                        return true;
                    }
                }
            }

            // Check child node names (LIMITED to prevent freeze)
            const maxChildrenToCheck = 20;
            let childNodes: TransformNode[] = [];

            try {
                childNodes = node.getChildTransformNodes?.(false) || [];
            } catch (error) {
                // Silently ignore errors getting children
                return false;
            }

            const safeChildNodes = childNodes.slice(0, maxChildrenToCheck);

            for (const child of safeChildNodes) {
                const childName = child.name?.toLowerCase() || '';
                for (const keyword of TRAIN_KEYWORDS) {
                    if (childName.includes(keyword.toLowerCase())) {
                        return true;
                    }
                }
            }

            return false;

        } catch (error) {
            console.warn(`${LOG_PREFIX} isTrainCandidate error:`, error);
            return false;
        }
    }

    /**
     * Get original filename from node metadata
     * @param node - Node to check
     * @returns Original name or null
     */
    private getOriginalName(node: TransformNode | AbstractMesh): string | null {
        // Check node metadata
        if (node.metadata?.originalName) {
            return node.metadata.originalName;
        }

        // Check parent metadata (for child meshes)
        if (node.parent?.metadata?.originalName) {
            return node.parent.metadata.originalName;
        }

        return null;
    }

    // ========================================================================
    // REGISTRATION
    // ========================================================================

    /**
     * Register a node as a train (async version)
     * @param node - TransformNode to register
     * @returns true if registered successfully
     */
    private async registerTrainNode(node: TransformNode): Promise<boolean> {
        const position = this.getNodePosition(node);

        // Find nearest track edge
        const edgeResult = this.findNearestEdge(position, MAX_TRACK_DISTANCE);

        if (edgeResult) {
            console.log(`${LOG_PREFIX}   Found edge ${edgeResult.edge.id} at ${(edgeResult.distance * 1000).toFixed(1)}mm`);
            return this.registerOnEdge(node, edgeResult.edge.id, edgeResult.t);
        } else {
            console.log(`${LOG_PREFIX}   No track within ${MAX_TRACK_DISTANCE * 1000}mm - registering off-track`);
            return this.registerOffTrack(node);
        }
    }

    /**
     * Register a node as a train (sync version)
     * @param node - TransformNode to register
     * @returns true if registered successfully
     */
    private registerTrainNodeSync(node: TransformNode): boolean {
        const position = this.getNodePosition(node);
        const edgeResult = this.findNearestEdge(position, MAX_TRACK_DISTANCE);

        if (edgeResult) {
            return this.registerOnEdge(node, edgeResult.edge.id, edgeResult.t);
        } else {
            return this.registerOffTrack(node);
        }
    }

    /**
     * Register train on a specific edge
     * @param node - Node to register
     * @param edgeId - Edge to place on
     * @param t - Parametric position
     * @returns true if successful
     */
    private registerOnEdge(node: TransformNode, edgeId: string, t: number): boolean {
        try {
            const trainName = this.getTrainName(node);

            const controller = this.trainSystem.registerExistingModel(
                node,
                trainName,
                edgeId,
                t
            );

            if (controller) {
                console.log(`${LOG_PREFIX} ✓ Registered "${trainName}" on edge ${edgeId} at t=${t.toFixed(2)}`);

                if (this.onRegistered) {
                    this.onRegistered(controller.getId(), node.name, edgeId);
                }

                return true;
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error registering on edge:`, error);
        }

        return false;
    }

    /**
     * Register train without track placement
     * @param node - Node to register
     * @returns true if successful
     */
    private registerOffTrack(node: TransformNode): boolean {
        try {
            const trainName = this.getTrainName(node);

            const controller = this.trainSystem.addTrain(node, {
                name: trainName,
                category: 'locomotive'
            });

            if (controller) {
                console.log(`${LOG_PREFIX} ✓ Registered "${trainName}" (off-track)`);
                console.log(`${LOG_PREFIX}   Place on track manually or move near track and re-scan`);

                if (this.onRegistered) {
                    this.onRegistered(controller.getId(), node.name, null);
                }

                return true;
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error registering off-track:`, error);
        }

        return false;
    }

    /**
     * Get a friendly name for the train
     * @param node - Node to name
     * @returns Train name
     */
    private getTrainName(node: TransformNode): string {
        // Try metadata originalName
        const originalName = this.getOriginalName(node);
        if (originalName) {
            // Clean up the filename
            return originalName
                .replace(/\.(glb|gltf)$/i, '')
                .replace(/_/g, ' ')
                .trim();
        }

        // Fall back to node name
        return node.name
            .replace(/^model_root_/, '')
            .replace(/_/g, ' ')
            .trim() || 'Unnamed Train';
    }

    // ========================================================================
    // EDGE FINDING - WITH PROPER NULL CHECKS
    // ========================================================================

    /**
     * Find the nearest track edge to a position
     * 
     * FIX: Added proper null checks for graph nodes and their positions
     * to prevent "can't access property constructor, start is undefined" error.
     * 
     * SAFETY: Limited to MAX_EDGES_TO_SEARCH to prevent browser freeze
     * 
     * @param position - World position to search from
     * @param maxDistance - Maximum search distance
     * @returns Edge find result or null if none found
     */
    private findNearestEdge(position: Vector3, maxDistance: number): EdgeFindResult | null {
        // ====================================================================
        // GUARD: Check if position is valid
        // ====================================================================
        if (!position || position.x === undefined || position.y === undefined || position.z === undefined) {
            console.warn(`${LOG_PREFIX} findNearestEdge: Invalid position provided`);
            return null;
        }

        // ====================================================================
        // GUARD: Check if graph exists and has edges
        // ====================================================================
        if (!this.graph) {
            console.warn(`${LOG_PREFIX} findNearestEdge: No graph available`);
            return null;
        }

        let allEdges: GraphEdge[];
        try {
            allEdges = this.graph.getAllEdges();
        } catch (error) {
            console.error(`${LOG_PREFIX} findNearestEdge: Error getting edges:`, error);
            return null;
        }

        if (!allEdges || allEdges.length === 0) {
            console.log(`${LOG_PREFIX} findNearestEdge: No edges in graph`);
            return null;
        }

        // SAFETY: Limit edges to search
        const edgesToSearch = allEdges.slice(0, MAX_EDGES_TO_SEARCH);
        if (allEdges.length > MAX_EDGES_TO_SEARCH) {
            console.warn(`${LOG_PREFIX} findNearestEdge: Limited to ${MAX_EDGES_TO_SEARCH} edges for safety`);
        }

        let bestResult: EdgeFindResult | null = null;
        let bestDistance = maxDistance;
        let edgesChecked = 0;

        // ====================================================================
        // Search edges for closest point
        // ====================================================================
        for (const edge of edgesToSearch) {
            edgesChecked++;

            // Skip invalid edges
            if (!edge || !edge.fromNodeId || !edge.toNodeId) {
                continue;
            }

            // Get nodes with validation
            let fromNode: GraphNode | undefined;
            let toNode: GraphNode | undefined;

            try {
                fromNode = this.graph.getNode(edge.fromNodeId);
                toNode = this.graph.getNode(edge.toNodeId);
            } catch (error) {
                console.warn(`${LOG_PREFIX} findNearestEdge: Error getting nodes for edge ${edge.id}`);
                continue;
            }

            // ================================================================
            // CRITICAL FIX: Validate nodes and their positions exist
            // This prevents the Vector3.Lerp undefined error
            // ================================================================
            if (!fromNode || !toNode) {
                continue;
            }

            if (!fromNode.pos || !toNode.pos) {
                continue;
            }

            // Additional validation: ensure pos has valid coordinates
            if (fromNode.pos.x === undefined || fromNode.pos.y === undefined || fromNode.pos.z === undefined) {
                continue;
            }

            if (toNode.pos.x === undefined || toNode.pos.y === undefined || toNode.pos.z === undefined) {
                continue;
            }

            // Find closest point on this edge
            try {
                const result = this.findClosestPointOnEdge(edge, fromNode, toNode, position);

                if (result && result.distance < bestDistance) {
                    bestDistance = result.distance;
                    bestResult = result;
                }
            } catch (error) {
                console.warn(`${LOG_PREFIX} findNearestEdge: Error checking edge ${edge.id}:`, error);
                continue;
            }
        }

        console.log(`${LOG_PREFIX} findNearestEdge: Checked ${edgesChecked} edges, best distance: ${bestResult ? (bestResult.distance * 1000).toFixed(1) + 'mm' : 'none found'}`);
        return bestResult;
    }

    /**
     * Find the closest point on a specific edge to a position
     * 
     * @param edge - Edge to search
     * @param fromNode - Start node (pre-validated)
     * @param toNode - End node (pre-validated)
     * @param targetPos - Position to find closest point to
     * @returns Edge find result or null if invalid
     */
    private findClosestPointOnEdge(
        edge: GraphEdge,
        fromNode: GraphNode,
        toNode: GraphNode,
        targetPos: Vector3
    ): EdgeFindResult | null {
        // ====================================================================
        // Double-check node positions (defensive programming)
        // ====================================================================
        if (!fromNode.pos || !toNode.pos) {
            return null;
        }

        try {
            let bestT = 0;
            let bestDistance = Infinity;
            let bestPosition = fromNode.pos.clone();
            let bestForward = toNode.pos.subtract(fromNode.pos);

            // Prevent NaN from zero-length edges
            if (bestForward.length() < 0.0001) {
                console.warn(`${LOG_PREFIX} findClosestPointOnEdge: Zero-length edge ${edge.id}`);
                return null;
            }

            bestForward = bestForward.normalize();

            // Sample points along the edge
            for (let i = 0; i <= SAMPLES_PER_EDGE; i++) {
                const t = i / SAMPLES_PER_EDGE;
                const sample = this.getPositionOnEdge(edge, fromNode, toNode, t);

                // Validate sample result
                if (!sample || !sample.position) {
                    continue;
                }

                const dist = Vector3.Distance(targetPos, sample.position);

                if (dist < bestDistance) {
                    bestDistance = dist;
                    bestT = t;
                    bestPosition = sample.position;
                    bestForward = sample.forward;
                }
            }

            return {
                edge,
                t: bestT,
                distance: bestDistance,
                position: bestPosition,
                forward: bestForward
            };

        } catch (error) {
            console.error(`${LOG_PREFIX} findClosestPointOnEdge error:`, error);
            return null;
        }
    }

    /**
     * Get world position and direction at a point on an edge
     * 
     * @param edge - The edge
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
    ): { position: Vector3; forward: Vector3 } {
        // ====================================================================
        // Validate inputs before any Vector3 operations
        // ====================================================================
        if (!fromNode.pos || !toNode.pos) {
            // Return a safe default - this should never happen if caller validates
            return {
                position: new Vector3(0, 0, 0),
                forward: new Vector3(0, 0, 1)
            };
        }

        if (edge.curve.type === 'straight') {
            return this.getStraightPosition(fromNode.pos, toNode.pos, t);
        } else {
            return this.getArcPosition(fromNode.pos, toNode.pos, edge.curve, t);
        }
    }

    /**
     * Get position on a straight edge
     * 
     * @param start - Start position (validated by caller)
     * @param end - End position (validated by caller)
     * @param t - Parametric position
     * @returns Position and forward direction
     */
    private getStraightPosition(
        start: Vector3,
        end: Vector3,
        t: number
    ): { position: Vector3; forward: Vector3 } {
        // ====================================================================
        // CRITICAL: Vector3.Lerp requires valid Vector3 objects
        // The caller must ensure start and end are valid
        // ====================================================================
        const position = Vector3.Lerp(start, end, t);
        const forward = end.subtract(start);

        // Handle zero-length case
        if (forward.length() < 0.0001) {
            return { position, forward: new Vector3(0, 0, 1) };
        }

        return { position, forward: forward.normalize() };
    }

    /**
     * Get position on a curved edge
     * 
     * @param start - Start position
     * @param end - End position
     * @param curve - Curve definition
     * @param t - Parametric position
     * @returns Position and forward direction
     */
    private getArcPosition(
        start: Vector3,
        end: Vector3,
        curve: CurveDefinition,
        t: number
    ): { position: Vector3; forward: Vector3 } {
        // Fall back to straight if curve data is incomplete
        if (!curve.arcRadiusM || !curve.arcAngleDeg) {
            return this.getStraightPosition(start, end, t);
        }

        const radius = curve.arcRadiusM;
        const angleDeg = curve.arcAngleDeg;
        const direction = curve.arcDirection || 1;

        // Calculate arc center
        const startToEnd = end.subtract(start);

        // Handle zero-length case
        if (startToEnd.length() < 0.0001) {
            return {
                position: start.clone(),
                forward: new Vector3(0, 0, 1)
            };
        }

        const startDir = startToEnd.normalize();

        // Perpendicular direction (left or right based on curve direction)
        const perpendicular = new Vector3(
            -startDir.z * direction,
            0,
            startDir.x * direction
        );

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
            start.y + (end.y - start.y) * t, // Linear height interpolation
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
    }

    // ========================================================================
    // UTILITY METHODS
    // ========================================================================

    /**
     * Get the world position of a node
     * @param node - Node to get position of
     * @returns World position
     */
    private getNodePosition(node: TransformNode): Vector3 {
        if (node.getAbsolutePosition) {
            return node.getAbsolutePosition();
        }
        return node.position.clone();
    }

    /**
     * Find a node by partial name match
     * @param partialName - Partial name to search for
     * @returns Found node or null
     */
    private findNodeByPartialName(partialName: string): TransformNode | null {
        const lowerPartial = partialName.toLowerCase();

        // Check transform nodes
        for (const node of this.scene.transformNodes) {
            if (node.name.toLowerCase().includes(lowerPartial)) {
                return node;
            }
        }

        // Check meshes
        for (const mesh of this.scene.meshes) {
            if (mesh.name.toLowerCase().includes(lowerPartial)) {
                return mesh as unknown as TransformNode;
            }
        }

        return null;
    }

    /**
     * List available nodes for debugging
     */
    private listAvailableNodes(): void {
        console.log(`${LOG_PREFIX} Available model_root nodes:`);
        const modelRoots = this.scene.transformNodes.filter(
            tn => tn.name.startsWith('model_root')
        );

        for (const node of modelRoots) {
            const originalName = this.getOriginalName(node);
            console.log(`${LOG_PREFIX}   - ${node.name}${originalName ? ` (${originalName})` : ''}`);
        }
    }

    // ========================================================================
    // GLOBAL HELPERS
    // ========================================================================

    /**
     * Install window-level helper functions for debugging
     */
    private installGlobalHelpers(): void {
        const self = this;

        // Async scan
        (window as any).scanTrains = async () => {
            return await self.scanAndRegisterAsync();
        };

        // Sync scan (limited)
        (window as any).scanTrainsSync = () => {
            const candidates = self.findTrainCandidates();
            let registered = 0;
            for (const node of candidates) {
                if (self.registerTrainNodeSync(node)) {
                    registered++;
                }
            }
            return registered;
        };

        // Manual register
        (window as any).registerTrain = (nodeName: string, edgeId?: string, t?: number) => {
            return self.manualRegister(nodeName, edgeId, t);
        };

        // Force register
        (window as any).forceRegisterTrain = (partialName: string) => {
            return self.forceRegister(partialName);
        };

        // Find models
        (window as any).findModels = () => {
            self.listAvailableNodes();
        };

        // List trains
        (window as any).listTrains = () => {
            self.listTrains();
        };

        console.log(`${LOG_PREFIX} Global helpers installed:`);
        console.log(`${LOG_PREFIX}   window.registerTrain(nodeName, edgeId?, t?)`);
        console.log(`${LOG_PREFIX}   window.scanTrains() - async scan`);
        console.log(`${LOG_PREFIX}   window.scanTrainsSync() - sync scan (limited)`);
        console.log(`${LOG_PREFIX}   window.findModels() - list model nodes`);
        console.log(`${LOG_PREFIX}   window.forceRegisterTrain(partialName) - force register any model`);
        console.log(`${LOG_PREFIX}   window.listTrains() - show registered trains`);
    }

    // ========================================================================
    // DISPOSAL
    // ========================================================================

    /**
     * Clean up resources
     */
    dispose(): void {
        this.registeredNodes.clear();
        this.onRegistered = null;

        // Remove global helpers
        delete (window as any).scanTrains;
        delete (window as any).scanTrainsSync;
        delete (window as any).registerTrain;
        delete (window as any).forceRegisterTrain;
        delete (window as any).findModels;
        delete (window as any).listTrains;

        console.log(`${LOG_PREFIX} Disposed`);
    }
}