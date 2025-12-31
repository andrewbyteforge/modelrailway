/**
 * TrainMeshDetector.ts - Utility to detect if meshes belong to trains
 * 
 * Path: frontend/src/systems/train/TrainMeshDetector.ts
 * 
 * Provides a centralized way for different systems to check if a mesh
 * is part of a registered train. This allows the ModelImportButton
 * and other systems to defer handling to TrainSystem when appropriate.
 * 
 * @module TrainMeshDetector
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { TrainSystem } from './TrainSystem';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[TrainMeshDetector]';

// ============================================================================
// GLOBAL REFERENCE
// ============================================================================

/**
 * Global reference to the active TrainSystem
 * Set by App.ts when TrainSystem is initialized
 */
let globalTrainSystem: TrainSystem | null = null;

// ============================================================================
// REGISTRATION FUNCTIONS
// ============================================================================

/**
 * Register the TrainSystem for mesh detection
 * Call this from App.ts after creating the TrainSystem
 * 
 * @param trainSystem - The active TrainSystem instance
 */
export function registerTrainSystem(trainSystem: TrainSystem): void {
    globalTrainSystem = trainSystem;
    console.log(`${LOG_PREFIX} TrainSystem registered for mesh detection`);
}

/**
 * Unregister the TrainSystem
 * Call this when disposing the TrainSystem
 */
export function unregisterTrainSystem(): void {
    globalTrainSystem = null;
    console.log(`${LOG_PREFIX} TrainSystem unregistered`);
}

/**
 * Get the registered TrainSystem
 * @returns TrainSystem or null
 */
export function getRegisteredTrainSystem(): TrainSystem | null {
    return globalTrainSystem;
}

// ============================================================================
// DETECTION FUNCTIONS
// ============================================================================

/**
 * Check if a mesh belongs to a registered train
 * 
 * @param mesh - The mesh to check
 * @returns true if the mesh is part of a train
 */
export function isTrainMesh(mesh: AbstractMesh | null | undefined): boolean {
    if (!mesh) return false;

    // Method 1: Check for direct controller reference (fast path)
    if ((mesh as any).__trainController) {
        return true;
    }

    // Method 2: Check mesh metadata
    if (mesh.metadata?.isTrainMesh || mesh.metadata?.trainId) {
        return true;
    }

    // Method 3: Ask TrainSystem to check all registered trains
    if (globalTrainSystem) {
        const trainController = globalTrainSystem.findTrainByMesh(mesh);
        if (trainController) {
            return true;
        }
    }

    // Method 4: Check parent hierarchy for train markers
    let parent = mesh.parent;
    while (parent) {
        if ((parent as any).__isTrainRoot || (parent as any).metadata?.isTrainRoot) {
            return true;
        }
        parent = parent.parent;
    }

    return false;
}

/**
 * Get the train ID for a mesh (if it's part of a train)
 * 
 * @param mesh - The mesh to check
 * @returns Train ID or null
 */
export function getTrainIdFromMesh(mesh: AbstractMesh | null | undefined): string | null {
    if (!mesh) return null;

    // Method 1: Direct controller reference
    const controller = (mesh as any).__trainController;
    if (controller) {
        return controller.getId();
    }

    // Method 2: Metadata
    if (mesh.metadata?.trainId) {
        return mesh.metadata.trainId;
    }

    // Method 3: Ask TrainSystem
    if (globalTrainSystem) {
        const trainController = globalTrainSystem.findTrainByMesh(mesh);
        if (trainController) {
            return trainController.getId();
        }
    }

    // Method 4: Check parent hierarchy
    let parent = mesh.parent;
    while (parent) {
        if ((parent as any).__trainId) {
            return (parent as any).__trainId;
        }
        if (parent.metadata?.trainId) {
            return parent.metadata.trainId;
        }
        parent = parent.parent;
    }

    return null;
}

/**
 * Check if we should handle this mesh as a train for driving
 * Takes into account modifier keys
 * 
 * @param mesh - The mesh clicked
 * @param event - The pointer event (to check modifier keys)
 * @returns Object with handling recommendation
 */
export function getTrainClickBehavior(
    mesh: AbstractMesh | null | undefined,
    event?: PointerEvent | MouseEvent
): TrainClickBehavior {
    const result: TrainClickBehavior = {
        isTrain: false,
        shouldDrive: false,
        shouldReposition: false,
        trainId: null
    };

    if (!mesh) return result;

    const trainId = getTrainIdFromMesh(mesh);
    if (!trainId) return result;

    result.isTrain = true;
    result.trainId = trainId;

    // Check modifier keys
    const shiftHeld = event?.shiftKey ?? false;
    const ctrlHeld = event?.ctrlKey ?? false;
    const altHeld = event?.altKey ?? false;

    // Shift+Click = Reposition mode
    // Regular Click = Drive mode
    if (shiftHeld) {
        result.shouldReposition = true;
        result.shouldDrive = false;
    } else {
        result.shouldDrive = true;
        result.shouldReposition = false;
    }

    return result;
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Result of train click behavior check
 */
export interface TrainClickBehavior {
    /** Whether the clicked mesh is part of a train */
    isTrain: boolean;

    /** Whether we should activate driving controls */
    shouldDrive: boolean;

    /** Whether we should allow repositioning */
    shouldReposition: boolean;

    /** Train ID if it's a train */
    trainId: string | null;
}

// ============================================================================
// WINDOW EXPOSURE FOR DEBUGGING
// ============================================================================

if (typeof window !== 'undefined') {
    (window as any).__trainMeshDetector = {
        isTrainMesh,
        getTrainIdFromMesh,
        getTrainClickBehavior,
        getTrainSystem: () => globalTrainSystem
    };
}