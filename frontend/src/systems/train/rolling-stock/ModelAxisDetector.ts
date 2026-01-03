/**
 * ModelAxisDetector.ts - Analyses models to determine forward axis
 * 
 * Path: frontend/src/systems/train/ModelAxisDetector.ts
 * 
 * When importing 3D models from various sources (Blender, 3ds Max, SketchUp,
 * etc.), they can be oriented in many different ways. This utility analyses
 * model geometry to determine which axis represents "forward" for vehicles.
 * 
 * Analysis methods:
 * 1. Bounding box aspect ratio (trains are longer than wide)
 * 2. Mesh naming conventions (looks for "front", "cab", etc.)
 * 3. Vertex distribution (front often has more detail)
 * 4. Model metadata (if available in file)
 * 
 * @module ModelAxisDetector
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[ModelAxisDetector]';

/**
 * Forward axis enumeration
 */
export type ForwardAxis =
    | 'POS_X' | 'NEG_X'
    | 'POS_Y' | 'NEG_Y'
    | 'POS_Z' | 'NEG_Z';

/**
 * Keywords that suggest front/cab end of vehicle
 */
const FRONT_KEYWORDS = [
    'front', 'cab', 'nose', 'head', 'face', 'buffer', 'buffers',
    'headlight', 'headlamp', 'marker', 'coupler_front', 'coupling_front',
    'number_1', 'no1', 'end_1', 'end1'
];

/**
 * Keywords that suggest rear end of vehicle
 */
const REAR_KEYWORDS = [
    'rear', 'back', 'tail', 'end', 'exhaust', 'vent',
    'taillight', 'coupler_rear', 'coupling_rear',
    'number_2', 'no2', 'end_2', 'end2'
];

/**
 * Keywords for locomotive-specific front features
 */
const LOCO_FRONT_KEYWORDS = [
    'pantograph', 'horn', 'siren', 'bell', 'snowplow', 'plough',
    'pilot', 'cowcatcher', 'windscreen', 'windshield', 'window_front',
    'light_front', 'lamp_front'
];

/**
 * Axis aspect ratio threshold - how much longer the model must be
 * in one axis to be considered the primary direction
 */
const ASPECT_RATIO_THRESHOLD = 1.3;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Model analysis result
 */
export interface ModelAnalysis {
    /** Detected forward axis */
    forwardAxis: ForwardAxis;

    /** Confidence in detection (0-1) */
    confidence: number;

    /** Model length along forward axis (metres) */
    lengthM: number;

    /** Model width perpendicular to forward (metres) */
    widthM: number;

    /** Model height (metres) */
    heightM: number;

    /** Analysis methods used */
    methodsUsed: string[];

    /** Detailed reasoning */
    reasoning: string[];
}

/**
 * Bounding box in local space
 */
interface LocalBounds {
    min: Vector3;
    max: Vector3;
    size: Vector3;
    center: Vector3;
}

/**
 * Mesh analysis data
 */
interface MeshAnalysis {
    name: string;
    localCenter: Vector3;
    vertexCount: number;
    suggestsFront: boolean;
    suggestsRear: boolean;
}

// ============================================================================
// MODEL AXIS DETECTOR CLASS
// ============================================================================

/**
 * ModelAxisDetector - Analyses 3D models to determine forward axis
 * 
 * @example
 * ```typescript
 * const detector = new ModelAxisDetector();
 * const result = detector.analyse(modelRootNode);
 * 
 * console.log(`Forward axis: ${result.forwardAxis}`);
 * console.log(`Confidence: ${(result.confidence * 100).toFixed(0)}%`);
 * console.log(`Length: ${(result.lengthM * 1000).toFixed(0)}mm`);
 * ```
 */
export class ModelAxisDetector {

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /**
     * Analyse a model to determine its forward axis
     * 
     * @param rootNode - Root transform node of the model
     * @returns Analysis result with detected forward axis
     */
    analyse(rootNode: TransformNode): ModelAnalysis {
        console.log(`${LOG_PREFIX} Analysing model...`);

        const methodsUsed: string[] = [];
        const reasoning: string[] = [];

        // Get all child meshes
        const meshes = this.getChildMeshes(rootNode);

        if (meshes.length === 0) {
            console.warn(`${LOG_PREFIX} No meshes found in model`);
            return this.createDefaultResult('No meshes found');
        }

        // Step 1: Calculate bounding box
        const bounds = this.calculateBounds(meshes);
        methodsUsed.push('bounding_box');

        console.log(`${LOG_PREFIX} Bounds: ${(bounds.size.x * 1000).toFixed(0)}mm x ${(bounds.size.y * 1000).toFixed(0)}mm x ${(bounds.size.z * 1000).toFixed(0)}mm`);

        // Step 2: Analyse aspect ratios
        const aspectResult = this.analyseAspectRatio(bounds);
        reasoning.push(`Aspect ratio analysis: ${aspectResult.reasoning}`);

        // Step 3: Analyse mesh names
        const meshAnalysis = this.analyseMeshNames(meshes, bounds);
        if (meshAnalysis.hasFrontHints || meshAnalysis.hasRearHints) {
            methodsUsed.push('mesh_names');
            reasoning.push(`Mesh name analysis: ${meshAnalysis.reasoning}`);
        }

        // Step 4: Analyse vertex distribution
        const vertexResult = this.analyseVertexDistribution(meshes, bounds, aspectResult.primaryAxis);
        if (vertexResult.hasAsymmetry) {
            methodsUsed.push('vertex_distribution');
            reasoning.push(`Vertex distribution: ${vertexResult.reasoning}`);
        }

        // Step 5: Combine results
        const finalAxis = this.combineResults(
            aspectResult,
            meshAnalysis,
            vertexResult
        );

        // Calculate confidence
        const confidence = this.calculateConfidence(
            aspectResult,
            meshAnalysis,
            vertexResult
        );

        // Determine dimensions based on forward axis
        const { lengthM, widthM, heightM } = this.getDimensionsForAxis(bounds, finalAxis);

        console.log(`${LOG_PREFIX} Result: ${finalAxis} (confidence: ${(confidence * 100).toFixed(0)}%)`);

        return {
            forwardAxis: finalAxis,
            confidence,
            lengthM,
            widthM,
            heightM,
            methodsUsed,
            reasoning
        };
    }

    /**
     * Quick analysis using only bounding box (faster, less accurate)
     * 
     * @param rootNode - Root transform node
     * @returns Forward axis
     */
    quickAnalyse(rootNode: TransformNode): ForwardAxis {
        const meshes = this.getChildMeshes(rootNode);

        if (meshes.length === 0) {
            return 'NEG_Z'; // Default
        }

        const bounds = this.calculateBounds(meshes);
        const result = this.analyseAspectRatio(bounds);

        return result.suggestedForward;
    }

    // ========================================================================
    // PRIVATE - MESH UTILITIES
    // ========================================================================

    /**
     * Get all child meshes from a root node
     */
    private getChildMeshes(rootNode: TransformNode): AbstractMesh[] {
        const meshes: AbstractMesh[] = [];

        // Check if root is a mesh
        if (rootNode instanceof AbstractMesh) {
            meshes.push(rootNode);
        }

        // Get all descendants
        const descendants = rootNode.getChildMeshes(false);
        meshes.push(...descendants);

        return meshes;
    }

    /**
     * Calculate combined bounding box for all meshes
     */
    private calculateBounds(meshes: AbstractMesh[]): LocalBounds {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        for (const mesh of meshes) {
            try {
                const bounds = mesh.getBoundingInfo();

                // Use minimum/maximum in local space if possible
                const min = bounds.boundingBox.minimum;
                const max = bounds.boundingBox.maximum;

                // Transform to parent space
                const worldMatrix = mesh.getWorldMatrix();
                const minWorld = Vector3.TransformCoordinates(min, worldMatrix);
                const maxWorld = Vector3.TransformCoordinates(max, worldMatrix);

                minX = Math.min(minX, minWorld.x, maxWorld.x);
                maxX = Math.max(maxX, minWorld.x, maxWorld.x);
                minY = Math.min(minY, minWorld.y, maxWorld.y);
                maxY = Math.max(maxY, minWorld.y, maxWorld.y);
                minZ = Math.min(minZ, minWorld.z, maxWorld.z);
                maxZ = Math.max(maxZ, minWorld.z, maxWorld.z);

            } catch (error) {
                // Skip meshes that fail
            }
        }

        const min = new Vector3(minX, minY, minZ);
        const max = new Vector3(maxX, maxY, maxZ);
        const size = max.subtract(min);
        const center = Vector3.Lerp(min, max, 0.5);

        return { min, max, size, center };
    }

    // ========================================================================
    // PRIVATE - ASPECT RATIO ANALYSIS
    // ========================================================================

    /**
     * Analyse bounding box aspect ratios
     */
    private analyseAspectRatio(bounds: LocalBounds): {
        primaryAxis: 'X' | 'Y' | 'Z';
        suggestedForward: ForwardAxis;
        confidence: number;
        reasoning: string;
    } {
        const { size } = bounds;

        // Find longest horizontal axis
        const horizontalX = size.x;
        const horizontalZ = size.z;

        if (horizontalX > horizontalZ * ASPECT_RATIO_THRESHOLD) {
            // X is clearly the long axis
            const ratio = horizontalX / horizontalZ;
            return {
                primaryAxis: 'X',
                suggestedForward: 'NEG_X', // Typically face -X
                confidence: Math.min(ratio / 3, 1), // Higher ratio = more confidence
                reasoning: `X axis ${(ratio).toFixed(1)}x longer than Z`
            };

        } else if (horizontalZ > horizontalX * ASPECT_RATIO_THRESHOLD) {
            // Z is clearly the long axis
            const ratio = horizontalZ / horizontalX;
            return {
                primaryAxis: 'Z',
                suggestedForward: 'NEG_Z', // Typically face -Z
                confidence: Math.min(ratio / 3, 1),
                reasoning: `Z axis ${(ratio).toFixed(1)}x longer than X`
            };

        } else {
            // Similar dimensions - less certain
            return {
                primaryAxis: size.x > size.z ? 'X' : 'Z',
                suggestedForward: size.x > size.z ? 'NEG_X' : 'NEG_Z',
                confidence: 0.3,
                reasoning: 'Similar X/Z dimensions, uncertain orientation'
            };
        }
    }

    // ========================================================================
    // PRIVATE - MESH NAME ANALYSIS
    // ========================================================================

    /**
     * Analyse mesh names for front/rear hints
     */
    private analyseMeshNames(meshes: AbstractMesh[], bounds: LocalBounds): {
        hasFrontHints: boolean;
        hasRearHints: boolean;
        frontPosition: Vector3 | null;
        rearPosition: Vector3 | null;
        reasoning: string;
    } {
        const frontMeshes: MeshAnalysis[] = [];
        const rearMeshes: MeshAnalysis[] = [];

        for (const mesh of meshes) {
            const name = mesh.name.toLowerCase();

            // Check for front keywords
            const isFront = FRONT_KEYWORDS.some(kw => name.includes(kw)) ||
                LOCO_FRONT_KEYWORDS.some(kw => name.includes(kw));

            // Check for rear keywords
            const isRear = REAR_KEYWORDS.some(kw => name.includes(kw));

            if (isFront || isRear) {
                const center = mesh.getBoundingInfo().boundingBox.centerWorld;

                const analysis: MeshAnalysis = {
                    name: mesh.name,
                    localCenter: center,
                    vertexCount: this.getVertexCount(mesh),
                    suggestsFront: isFront,
                    suggestsRear: isRear
                };

                if (isFront) frontMeshes.push(analysis);
                if (isRear) rearMeshes.push(analysis);
            }
        }

        // Calculate average positions
        let frontPosition: Vector3 | null = null;
        let rearPosition: Vector3 | null = null;

        if (frontMeshes.length > 0) {
            frontPosition = this.calculateWeightedCenter(frontMeshes);
        }

        if (rearMeshes.length > 0) {
            rearPosition = this.calculateWeightedCenter(rearMeshes);
        }

        // Build reasoning
        let reasoning = '';
        if (frontMeshes.length > 0) {
            reasoning += `Found ${frontMeshes.length} front-related meshes. `;
        }
        if (rearMeshes.length > 0) {
            reasoning += `Found ${rearMeshes.length} rear-related meshes. `;
        }
        if (reasoning === '') {
            reasoning = 'No front/rear meshes identified by name.';
        }

        return {
            hasFrontHints: frontMeshes.length > 0,
            hasRearHints: rearMeshes.length > 0,
            frontPosition,
            rearPosition,
            reasoning
        };
    }

    /**
     * Get vertex count for a mesh
     */
    private getVertexCount(mesh: AbstractMesh): number {
        if (mesh instanceof Mesh) {
            const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
            return positions ? positions.length / 3 : 0;
        }
        return 0;
    }

    /**
     * Calculate weighted center of mesh analyses
     */
    private calculateWeightedCenter(analyses: MeshAnalysis[]): Vector3 {
        let totalWeight = 0;
        let weightedSum = Vector3.Zero();

        for (const analysis of analyses) {
            const weight = analysis.vertexCount || 1;
            weightedSum.addInPlace(analysis.localCenter.scale(weight));
            totalWeight += weight;
        }

        return weightedSum.scale(1 / totalWeight);
    }

    // ========================================================================
    // PRIVATE - VERTEX DISTRIBUTION ANALYSIS
    // ========================================================================

    /**
     * Analyse vertex distribution along primary axis
     * 
     * Locomotive fronts typically have more geometric detail
     */
    private analyseVertexDistribution(
        meshes: AbstractMesh[],
        bounds: LocalBounds,
        primaryAxis: 'X' | 'Y' | 'Z'
    ): {
        hasAsymmetry: boolean;
        frontEnd: 'positive' | 'negative' | 'unknown';
        asymmetryRatio: number;
        reasoning: string;
    } {
        // Count vertices in each half of the model
        let positiveHalfCount = 0;
        let negativeHalfCount = 0;

        const center = bounds.center;

        for (const mesh of meshes) {
            if (!(mesh instanceof Mesh)) continue;

            try {
                const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
                if (!positions) continue;

                const worldMatrix = mesh.getWorldMatrix();

                for (let i = 0; i < positions.length; i += 3) {
                    const localPos = new Vector3(
                        positions[i],
                        positions[i + 1],
                        positions[i + 2]
                    );

                    const worldPos = Vector3.TransformCoordinates(localPos, worldMatrix);

                    // Compare position along primary axis
                    let axisValue: number;
                    let centerValue: number;

                    switch (primaryAxis) {
                        case 'X':
                            axisValue = worldPos.x;
                            centerValue = center.x;
                            break;
                        case 'Z':
                            axisValue = worldPos.z;
                            centerValue = center.z;
                            break;
                        default:
                            axisValue = worldPos.z;
                            centerValue = center.z;
                    }

                    if (axisValue > centerValue) {
                        positiveHalfCount++;
                    } else {
                        negativeHalfCount++;
                    }
                }

            } catch (error) {
                // Skip meshes that fail
            }
        }

        // Calculate asymmetry
        const total = positiveHalfCount + negativeHalfCount;
        if (total === 0) {
            return {
                hasAsymmetry: false,
                frontEnd: 'unknown',
                asymmetryRatio: 1,
                reasoning: 'No vertices analysed'
            };
        }

        const ratio = positiveHalfCount / negativeHalfCount;
        const asymmetryRatio = Math.max(ratio, 1 / ratio);

        // Asymmetry threshold - front typically has more detail
        const hasAsymmetry = asymmetryRatio > 1.1;

        let frontEnd: 'positive' | 'negative' | 'unknown';
        if (hasAsymmetry) {
            // More vertices = more detail = front
            frontEnd = positiveHalfCount > negativeHalfCount ? 'positive' : 'negative';
        } else {
            frontEnd = 'unknown';
        }

        return {
            hasAsymmetry,
            frontEnd,
            asymmetryRatio,
            reasoning: hasAsymmetry
                ? `${((asymmetryRatio - 1) * 100).toFixed(0)}% more detail in ${frontEnd} half`
                : 'Symmetric vertex distribution'
        };
    }

    // ========================================================================
    // PRIVATE - RESULT COMBINATION
    // ========================================================================

    /**
     * Combine analysis results to determine final forward axis
     */
    private combineResults(
        aspectResult: ReturnType<typeof this.analyseAspectRatio>,
        meshAnalysis: ReturnType<typeof this.analyseMeshNames>,
        vertexResult: ReturnType<typeof this.analyseVertexDistribution>
    ): ForwardAxis {
        const { primaryAxis, suggestedForward } = aspectResult;

        // Start with aspect ratio suggestion
        let forward = suggestedForward;

        // Refine based on mesh names
        if (meshAnalysis.hasFrontHints && meshAnalysis.frontPosition) {
            // Check which end the front meshes are at
            const frontPos = meshAnalysis.frontPosition;

            if (primaryAxis === 'X') {
                // Is front at +X or -X?
                forward = frontPos.x > 0 ? 'POS_X' : 'NEG_X';
            } else if (primaryAxis === 'Z') {
                forward = frontPos.z > 0 ? 'POS_Z' : 'NEG_Z';
            }
        }

        // Refine based on vertex distribution (lower priority)
        if (!meshAnalysis.hasFrontHints && vertexResult.hasAsymmetry) {
            if (primaryAxis === 'X') {
                forward = vertexResult.frontEnd === 'positive' ? 'POS_X' : 'NEG_X';
            } else if (primaryAxis === 'Z') {
                forward = vertexResult.frontEnd === 'positive' ? 'POS_Z' : 'NEG_Z';
            }
        }

        return forward;
    }

    /**
     * Calculate overall confidence score
     */
    private calculateConfidence(
        aspectResult: ReturnType<typeof this.analyseAspectRatio>,
        meshAnalysis: ReturnType<typeof this.analyseMeshNames>,
        vertexResult: ReturnType<typeof this.analyseVertexDistribution>
    ): number {
        let confidence = aspectResult.confidence;

        // Boost confidence if mesh names support result
        if (meshAnalysis.hasFrontHints) {
            confidence = Math.min(confidence + 0.2, 1);
        }

        // Boost slightly for vertex asymmetry
        if (vertexResult.hasAsymmetry) {
            confidence = Math.min(confidence + 0.1, 1);
        }

        return confidence;
    }

    /**
     * Get length/width/height based on forward axis
     */
    private getDimensionsForAxis(
        bounds: LocalBounds,
        forwardAxis: ForwardAxis
    ): { lengthM: number; widthM: number; heightM: number } {
        const { size } = bounds;

        switch (forwardAxis) {
            case 'POS_X':
            case 'NEG_X':
                return {
                    lengthM: size.x,
                    widthM: size.z,
                    heightM: size.y
                };

            case 'POS_Z':
            case 'NEG_Z':
                return {
                    lengthM: size.z,
                    widthM: size.x,
                    heightM: size.y
                };

            default:
                // Y axis forward (unusual)
                return {
                    lengthM: size.y,
                    widthM: Math.max(size.x, size.z),
                    heightM: Math.min(size.x, size.z)
                };
        }
    }

    /**
     * Create default result for failed analysis
     */
    private createDefaultResult(reason: string): ModelAnalysis {
        return {
            forwardAxis: 'NEG_Z',
            confidence: 0.1,
            lengthM: 0.200, // Default 200mm
            widthM: 0.030,
            heightM: 0.040,
            methodsUsed: [],
            reasoning: [reason, 'Using default NEG_Z axis']
        };
    }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/** Global instance for convenience */
let globalDetector: ModelAxisDetector | null = null;

/**
 * Get or create global ModelAxisDetector instance
 */
export function getModelAxisDetector(): ModelAxisDetector {
    if (!globalDetector) {
        globalDetector = new ModelAxisDetector();
    }
    return globalDetector;
}

/**
 * Quick analysis helper function
 * 
 * @param rootNode - Model root node
 * @returns Forward axis
 */
export function detectModelForwardAxis(rootNode: TransformNode): ForwardAxis {
    return getModelAxisDetector().quickAnalyse(rootNode);
}