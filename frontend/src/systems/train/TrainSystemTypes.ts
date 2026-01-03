/**
 * TrainSystemTypes.ts - Type definitions for the Train System
 * 
 * Path: frontend/src/systems/train/TrainSystemTypes.ts
 * 
 * Contains all interfaces, type definitions, and constants used by
 * the train system components. Centralizes type information to avoid
 * circular dependencies and improve maintainability.
 * 
 * @module TrainSystemTypes
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import type { TrainController } from './TrainController';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix for train system components */
export const LOG_PREFIX = '[TrainSystem]';

/** Logging prefix for input handler */
export const INPUT_LOG_PREFIX = '[TrainInput]';

// ============================================================================
// CONFIGURATION INTERFACES
// ============================================================================

/**
 * Train system configuration options
 * 
 * Controls the overall behavior of the train system including
 * sound, input handling, and control sensitivity.
 */
export interface TrainSystemConfig {
    /** Enable train sounds (engine, horn, etc.) */
    enableSound: boolean;

    /** Enable keyboard controls for train driving */
    enableKeyboardControls: boolean;

    /** Enable mouse/pointer controls for selection */
    enablePointerControls: boolean;

    /** Throttle increment/decrement step (0.0 - 1.0) */
    throttleStep: number;
}

/**
 * Default train system configuration
 */
export const DEFAULT_TRAIN_CONFIG: TrainSystemConfig = {
    enableSound: true,
    enableKeyboardControls: true,
    enablePointerControls: true,
    throttleStep: 0.1
};

// ============================================================================
// KEYBOARD CONTROL INTERFACES
// ============================================================================

/**
 * Keyboard control mapping for train operation
 * 
 * Maps keyboard keys to train control actions.
 * Each action can have multiple keys assigned.
 */
export interface TrainKeyboardControls {
    /** Keys to increase throttle */
    throttleUp: string[];

    /** Keys to decrease throttle */
    throttleDown: string[];

    /** Keys to toggle direction (forward/reverse) */
    reverseDirection: string[];

    /** Keys to apply service brake (hold) */
    brake: string[];

    /** Keys for emergency brake */
    emergencyBrake: string[];

    /** Keys to sound the horn */
    horn: string[];

    /** Keys to deselect the current train */
    deselect: string[];
}

/**
 * Default keyboard control mappings
 * 
 * Arrow keys and WASD for throttle, with common shortcuts
 * for other operations.
 */
export const DEFAULT_KEYBOARD_CONTROLS: TrainKeyboardControls = {
    throttleUp: ['ArrowUp', 'w', 'W'],
    throttleDown: ['ArrowDown', 's', 'S'],
    reverseDirection: ['r', 'R'],
    brake: [' '],           // Space bar
    emergencyBrake: ['Escape'],
    horn: ['h', 'H'],
    deselect: ['Escape']
};

// ============================================================================
// INPUT HANDLER INTERFACES
// ============================================================================

/**
 * Delegate interface for input handler to communicate with TrainSystem
 * 
 * The input handler uses these callbacks to trigger actions in the
 * main TrainSystem without needing a direct reference.
 */
export interface TrainInputDelegate {
    /** Get the currently selected train controller */
    getSelectedTrain(): TrainController | null;

    /** Deselect the current train */
    deselectTrain(): void;

    /** Find a train controller from a mesh */
    findTrainFromMesh(mesh: any): TrainController | null;

    /** Find track piece ID from a mesh */
    findTrackPieceFromMesh(mesh: any): string | null;

    /** Check if a piece is a point/switch */
    isPoint(pieceId: string): boolean;

    /** Toggle a point's state */
    togglePoint(pieceId: string, playSound: boolean): void;

    /** Scan and register trains in scene */
    scanAndRegisterTrains(): number;

    /** Get all registered trains for hover state management */
    getAllTrains(): TrainController[];
}

/**
 * Configuration for the input handler
 */
export interface TrainInputConfig {
    /** Keyboard controls mapping */
    keyboardControls: TrainKeyboardControls;

    /** Throttle step for keyboard control */
    throttleStep: number;
}

// ============================================================================
// POINTER EVENT RESULT TYPES
// ============================================================================

/**
 * Result of processing a pointer down event
 */
export interface PointerDownResult {
    /** Whether the event was handled */
    handled: boolean;

    /** Type of object that was clicked */
    clickedType: 'train' | 'point' | 'baseboard' | 'other' | 'none';

    /** ID of the clicked object (train ID or piece ID) */
    objectId?: string;

    /** Whether Shift was held during click */
    shiftHeld: boolean;
}

// ============================================================================
// TRAIN REGISTRATION TYPES
// ============================================================================

/**
 * Keywords used to identify train-like models in the scene
 */
export const TRAIN_KEYWORDS: string[] = [
    'train', 'loco', 'locomotive', 'engine',
    'coach', 'carriage', 'wagon', 'freight',
    'diesel', 'steam', 'electric', 'class',
    'dmu', 'emu', 'hst', 'shunter', 'tender'
];

/**
 * Maximum search distance for placing trains on track (in meters)
 */
export const MAX_TRAIN_TRACK_DISTANCE = 0.2;

/**
 * Maximum number of edges to search when finding nearest track
 */
export const MAX_EDGE_SEARCH_ITERATIONS = 1000;

/**
 * Maximum number of scene nodes to check when scanning for trains
 */
export const MAX_SCAN_NODES = 500;