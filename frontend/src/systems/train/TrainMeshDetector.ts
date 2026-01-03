/**
 * TrainMeshDetector.ts - Utility to detect if meshes belong to trains
 * 
 * Path: frontend/src/systems/train/TrainMeshDetector.ts
 * 
 * Provides a centralized way for different systems to check if a mesh
 * is part of a registered train. This allows the ModelImportButton
 * and other systems to defer handling to TrainSystem when appropriate.
 * 
 * UPDATED v2.0.0: Simplified for modal-based train selection
 *   - No more Shift+click vs regular click distinction
 *   - Modal handles the choice between move/drive
 * 
 * @module TrainMeshDetector
 * @author Model Railway Workbench
 * @version 2.0.0 - Modal-based selection support
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
 * @returns TrainSystem or null if not registered
 */
export function getTrainSystem(): TrainSystem | null {
    return globalTrainSystem;
}

// ============================================================================
// DETECTION FUNCTIONS
// ============================================================================

/**
 * Check if a mesh belongs to a registered train
 * 
 * @param mesh - Mesh to check
 * @returns true if mesh is part of a train
 * 
 * @example
 * ```typescript
 * const pickResult = scene.pick(x, y);
 * if (pickResult?.pickedMesh && isTrainMesh(pickResult.pickedMesh)) {
 *     // This is a train - TrainSystem will handle it
 *     return;
 * }
 * ```
 */
export function isTrainMesh(mesh: AbstractMesh): boolean {
    if (!globalTrainSystem) {
        return false;
    }

    return globalTrainSystem.isTrainMesh(mesh);
}

/**
 * Get the train ID from a mesh if it belongs to a train
 * 
 * @param mesh - Mesh to check
 * @returns Train ID string or null
 */
export function getTrainIdFromMesh(mesh: AbstractMesh): string | null {
    if (!globalTrainSystem) {
        return null;
    }

    const controller = globalTrainSystem.findTrainByMesh(mesh);
    return controller ? controller.getId() : null;
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Result of train click behavior check
 * 
 * UPDATED v2.0.0: Simplified for modal-based approach
 *   - shouldDefer: If true, the click should be handled by TrainSystem
 *     (which will show the modal for user to choose action)
 */
export interface TrainClickBehavior {
    /** Whether the clicked mesh is part of a train */
    isTrain: boolean;

    /** 
     * Whether to defer to TrainSystem 
     * If true, don't process this click - TrainSystem will show modal
     */
    shouldDefer: boolean;

    /** Train ID if it's a train */
    trainId: string | null;

    /** Train name if it's a train */
    trainName: string | null;
}

/**
 * Analyze click behavior for a mesh
 * 
 * UPDATED v2.0.0: Simplified - always defer train clicks to TrainSystem
 * The TrainSystem will show a modal for the user to choose between
 * moving or driving the train.
 * 
 * @param mesh - Mesh that was clicked
 * @param event - Pointer/mouse event (optional, no longer used for modifier detection)
 * @returns Click behavior analysis
 * 
 * @example
 * ```typescript
 * const behavior = getTrainClickBehavior(pickedMesh, event);
 * if (behavior.isTrain && behavior.shouldDefer) {
 *     // TrainSystem will handle this (show modal)
 *     return;
 * }
 * // Not a train - handle normally
 * ```
 */
export function getTrainClickBehavior(
    mesh: AbstractMesh,
    event?: PointerEvent | MouseEvent
): TrainClickBehavior {
    const result: TrainClickBehavior = {
        isTrain: false,
        shouldDefer: false,
        trainId: null,
        trainName: null
    };

    if (!mesh) return result;

    // Check if this mesh belongs to a train
    if (!globalTrainSystem) {
        return result;
    }

    const controller = globalTrainSystem.findTrainByMesh(mesh);

    if (!controller) {
        return result;
    }

    // This is a train mesh
    result.isTrain = true;
    result.trainId = controller.getId();
    result.trainName = controller.getInfo().name;

    // Always defer to TrainSystem - it will show the modal
    // The user chooses between move/drive in the modal
    result.shouldDefer = true;

    return result;
}

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * @deprecated Use getTrainClickBehavior instead
 * 
 * Legacy properties for backwards compatibility:
 *   - shouldDrive: Now always false (user picks in modal)
 *   - shouldReposition: Now always false (user picks in modal)
 */
export interface LegacyTrainClickBehavior extends TrainClickBehavior {
    /** @deprecated Use modal instead */
    shouldDrive: boolean;
    /** @deprecated Use modal instead */
    shouldReposition: boolean;
}

/**
 * Get legacy-compatible click behavior
 * @deprecated Use getTrainClickBehavior directly
 */
export function getLegacyTrainClickBehavior(
    mesh: AbstractMesh,
    event?: PointerEvent | MouseEvent
): LegacyTrainClickBehavior {
    const behavior = getTrainClickBehavior(mesh, event);

    return {
        ...behavior,
        // These are always false now - modal handles the choice
        shouldDrive: false,
        shouldReposition: false
    };
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