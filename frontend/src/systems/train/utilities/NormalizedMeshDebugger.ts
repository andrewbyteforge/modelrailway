/**
 * NormalizedMeshDebugger.ts - Debug utilities for normalized mesh workflow
 * 
 * Path: frontend/src/systems/train/utilities/NormalizedMeshDebugger.ts
 * 
 * Console utilities for testing and debugging the normalized mesh workflow.
 * Accessible via window.meshDebug object.
 * 
 * Usage:
 *   window.meshDebug.analyze()         - Analyze selected model
 *   window.meshDebug.scale('locomotive') - Scale selected model
 *   window.meshDebug.position()        - Position selected on rails
 *   window.meshDebug.complete('coach') - Run complete workflow
 * 
 * @module NormalizedMeshDebugger
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import {
    detectNormalizedMesh,
    scaleToTargetLength,
    positionOnRailTop,
    processNormalizedMesh,
    calculateCombinedBounds,
    RollingStockType,
    OO_TARGET_DIMENSIONS
} from '../rolling-stock/NormalizedMeshHandler';

// ============================================================================
// CONSTANTS
// ============================================================================

const LOG_PREFIX = '[MeshDebugger]';

// ============================================================================
// DEBUG UTILITIES
// ============================================================================

/**
 * Mesh debugger class
 */
export class NormalizedMeshDebugger {
    private scene: Scene;
    private selectedNode: TransformNode | null = null;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    // ========================================================================
    // SELECTION HELPERS
    // ========================================================================

    /**
     * Get currently selected model from various sources
     */
    private getSelectedModel(): { node: TransformNode; meshes: AbstractMesh[] } | null {
        // Try to get from global selection system
        const modelSystem = (window as any).modelSystem;
        if (modelSystem?.selectedModel) {
            const model = modelSystem.selectedModel;
            return {
                node: model.rootNode,
                meshes: model.meshes
            };
        }

        // Try manually set selection
        if (this.selectedNode) {
            const meshes = this.selectedNode.getChildMeshes() as AbstractMesh[];
            return {
                node: this.selectedNode,
                meshes
            };
        }

        console.warn(`${LOG_PREFIX} No model selected`);
        console.log(`${LOG_PREFIX} Tip: Click on a model first, or use meshDebug.select(nodeName)`);
        return null;
    }

    /**
     * Manually select a model by name
     * @param nodeName - Name of the root node
     */
    select(nodeName: string): void {
        const node = this.scene.getTransformNodeByName(nodeName);
        if (!node) {
            console.error(`${LOG_PREFIX} Node not found: ${nodeName}`);
            console.log(`${LOG_PREFIX} Available nodes:`);
            this.scene.transformNodes.forEach(n => {
                if (n.name.startsWith('model_root_')) {
                    console.log(`${LOG_PREFIX}   - ${n.name}`);
                }
            });
            return;
        }

        this.selectedNode = node;
        console.log(`${LOG_PREFIX} ✓ Selected: ${nodeName}`);
    }

    /**
     * List all models in the scene
     */
    list(): void {
        console.log(`${LOG_PREFIX} ═══════════════════════════════════════`);
        console.log(`${LOG_PREFIX} Models in scene:`);
        console.log(`${LOG_PREFIX} ═══════════════════════════════════════`);

        const nodes = this.scene.transformNodes.filter(n => n.name.startsWith('model_root_'));

        if (nodes.length === 0) {
            console.log(`${LOG_PREFIX} (no models found)`);
            return;
        }

        nodes.forEach((node, index) => {
            const meshes = node.getChildMeshes() as AbstractMesh[];
            const bounds = calculateCombinedBounds(meshes);
            const maxDim = Math.max(bounds.size.x, bounds.size.y, bounds.size.z);

            console.log(`${LOG_PREFIX} ${index + 1}. ${node.name}`);
            console.log(`${LOG_PREFIX}    Size: ${(maxDim * 1000).toFixed(1)}mm`);
            console.log(`${LOG_PREFIX}    Position: (${node.position.x.toFixed(2)}, ${node.position.y.toFixed(2)}, ${node.position.z.toFixed(2)})`);
        });

        console.log(`${LOG_PREFIX} ═══════════════════════════════════════`);
    }

    // ========================================================================
    // ANALYSIS
    // ========================================================================

    /**
     * Analyze selected model for normalization
     */
    analyze(): void {
        const model = this.getSelectedModel();
        if (!model) return;

        console.log(`${LOG_PREFIX} ═══════════════════════════════════════`);
        console.log(`${LOG_PREFIX} Analyzing: ${model.node.name}`);
        console.log(`${LOG_PREFIX} ═══════════════════════════════════════`);

        const detection = detectNormalizedMesh(model.meshes);

        console.log(`${LOG_PREFIX} Result: ${detection.isNormalized ? 'NORMALIZED ✓' : 'STANDARD'}`);
        console.log(`${LOG_PREFIX} Confidence: ${(detection.confidence * 100).toFixed(0)}%`);
        console.log(`${LOG_PREFIX} Reason: ${detection.reason}`);
        console.log(`${LOG_PREFIX}`);
        console.log(`${LOG_PREFIX} Bounds:`);
        console.log(`${LOG_PREFIX}   Min: (${detection.bounds.min.x.toFixed(3)}, ${detection.bounds.min.y.toFixed(3)}, ${detection.bounds.min.z.toFixed(3)})`);
        console.log(`${LOG_PREFIX}   Max: (${detection.bounds.max.x.toFixed(3)}, ${detection.bounds.max.y.toFixed(3)}, ${detection.bounds.max.z.toFixed(3)})`);
        console.log(`${LOG_PREFIX}   Size: (${detection.bounds.size.x.toFixed(3)}, ${detection.bounds.size.y.toFixed(3)}, ${detection.bounds.size.z.toFixed(3)})`);
        console.log(`${LOG_PREFIX}`);
        console.log(`${LOG_PREFIX} Max dimension: ${(Math.max(...[detection.bounds.size.x, detection.bounds.size.y, detection.bounds.size.z]) * 1000).toFixed(1)}mm`);
        console.log(`${LOG_PREFIX} ═══════════════════════════════════════`);
    }

    // ========================================================================
    // SCALING
    // ========================================================================

    /**
     * Scale selected model to target type
     * @param stockType - Type to scale to
     */
    scale(stockType: RollingStockType = 'locomotive'): void {
        const model = this.getSelectedModel();
        if (!model) return;

        console.log(`${LOG_PREFIX} Scaling to: ${stockType}...`);

        try {
            const result = scaleToTargetLength(model.meshes, stockType);

            console.log(`${LOG_PREFIX} ✓ Scaling complete`);
            console.log(`${LOG_PREFIX}   Scale factor: ${result.scaleFactor.toFixed(6)}`);
            console.log(`${LOG_PREFIX}   Final size: ${(result.finalDimensions.size.x * 1000).toFixed(1)}mm x ${(result.finalDimensions.size.y * 1000).toFixed(1)}mm x ${(result.finalDimensions.size.z * 1000).toFixed(1)}mm`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Scaling failed:`, error);
        }
    }

    // ========================================================================
    // POSITIONING
    // ========================================================================

    /**
     * Position selected model on rail top
     */
    position(): void {
        const model = this.getSelectedModel();
        if (!model) return;

        console.log(`${LOG_PREFIX} Positioning on rails...`);

        try {
            const result = positionOnRailTop(model.node, model.meshes);

            console.log(`${LOG_PREFIX} ✓ Positioning complete`);
            console.log(`${LOG_PREFIX}   Final Y: ${(result.yPosition * 1000).toFixed(1)}mm`);
            console.log(`${LOG_PREFIX}   Offset: ${(result.yOffset * 1000).toFixed(1)}mm`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Positioning failed:`, error);
        }
    }

    // ========================================================================
    // COMPLETE WORKFLOW
    // ========================================================================

    /**
     * Run complete workflow on selected model
     * @param stockType - Type of rolling stock
     */
    complete(stockType: RollingStockType = 'locomotive'): void {
        const model = this.getSelectedModel();
        if (!model) return;

        console.log(`${LOG_PREFIX} Running complete workflow...`);

        try {
            const result = processNormalizedMesh(model.node, model.meshes, stockType);

            if (result.success) {
                console.log(`${LOG_PREFIX} ✓ Workflow complete!`);
                console.log(`${LOG_PREFIX}`);
                console.log(`${LOG_PREFIX} Model is now:`);
                console.log(`${LOG_PREFIX}   - Scaled to ${OO_TARGET_DIMENSIONS[stockType].name}`);
                console.log(`${LOG_PREFIX}   - Positioned on rail top`);
                console.log(`${LOG_PREFIX}   - Ready for placement`);
            } else {
                console.log(`${LOG_PREFIX} ⚠ Model not normalized, workflow skipped`);
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Workflow failed:`, error);
        }
    }

    // ========================================================================
    // REFERENCE INFO
    // ========================================================================

    /**
     * Show OO gauge reference dimensions
     */
    showOOSpecs(): void {
        console.log(`${LOG_PREFIX} ═══════════════════════════════════════`);
        console.log(`${LOG_PREFIX} OO GAUGE REFERENCE DIMENSIONS`);
        console.log(`${LOG_PREFIX} ═══════════════════════════════════════`);
        console.log(`${LOG_PREFIX}`);

        Object.entries(OO_TARGET_DIMENSIONS).forEach(([key, dims]) => {
            console.log(`${LOG_PREFIX} ${dims.name}:`);
            console.log(`${LOG_PREFIX}   Length: ${(dims.length * 1000).toFixed(0)}mm`);
            console.log(`${LOG_PREFIX}   Width:  ${(dims.width * 1000).toFixed(0)}mm`);
            console.log(`${LOG_PREFIX}   Height: ${(dims.height * 1000).toFixed(0)}mm`);
            console.log(`${LOG_PREFIX}`);
        });

        console.log(`${LOG_PREFIX} ═══════════════════════════════════════`);
    }

    /**
     * Show help
     */
    help(): void {
        console.log('');
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║         NORMALIZED MESH DEBUGGER - COMMANDS               ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log('║  meshDebug.list()                → List all models         ║');
        console.log('║  meshDebug.select("node_name")   → Select a model          ║');
        console.log('║  meshDebug.analyze()             → Analyze selected model  ║');
        console.log('║  meshDebug.scale("locomotive")   → Scale to type           ║');
        console.log('║  meshDebug.position()            → Position on rails       ║');
        console.log('║  meshDebug.complete("coach")     → Complete workflow       ║');
        console.log('║  meshDebug.showOOSpecs()         → Show OO dimensions      ║');
        console.log('║  meshDebug.help()                → Show this help          ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log('║  TYPES: "locomotive", "steam", "coach", "wagon"            ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log('');
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize debugger and attach to window
 * @param scene - Babylon.js scene
 */
export function initializeNormalizedMeshDebugger(scene: Scene): void {
    const debugger = new NormalizedMeshDebugger(scene);

    // Attach to window
    (window as any).meshDebug = debugger;

    console.log(`${LOG_PREFIX} Debugger initialized`);
    console.log(`${LOG_PREFIX} Type 'meshDebug.help()' for commands`);
}