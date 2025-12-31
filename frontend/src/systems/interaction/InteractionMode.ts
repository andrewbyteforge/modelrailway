/**
 * InteractionMode.ts - Interaction mode management for Model Railway Workbench
 * 
 * Path: frontend/src/systems/interaction/InteractionMode.ts
 * 
 * Manages the current interaction context to differentiate between:
 * - OPERATE: Control trains (throttle, direction, braking)
 * - EDIT: Move, rotate, scale, and reposition objects
 * 
 * This allows the same click action to have different behaviors depending
 * on what the user intends to do with the selected object.
 * 
 * @module InteractionMode
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Observable } from '@babylonjs/core/Misc/observable';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix for console output */
const LOG_PREFIX = '[InteractionMode]';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Available interaction modes
 * 
 * @description
 * - OPERATE: Used for controlling trains (driving, throttle, horn, etc.)
 * - EDIT: Used for positioning, rotating, scaling objects
 */
export enum InteractionModeType {
    /** Control/drive mode - click trains to drive them */
    OPERATE = 'operate',

    /** Edit/move mode - click objects to reposition them */
    EDIT = 'edit'
}

/**
 * Mode change event payload
 */
export interface ModeChangeEvent {
    /** Previous mode */
    previousMode: InteractionModeType;

    /** New mode */
    newMode: InteractionModeType;

    /** Timestamp of the change */
    timestamp: number;
}

/**
 * Mode configuration options
 */
export interface InteractionModeConfig {
    /** Initial mode on startup */
    initialMode: InteractionModeType;

    /** Keyboard shortcut to toggle mode (default: 'Tab') */
    toggleKey: string;

    /** Enable keyboard toggle */
    enableKeyboardToggle: boolean;

    /** Remember last mode in localStorage */
    persistMode: boolean;
}

/**
 * Mode display information for UI
 */
export interface ModeDisplayInfo {
    /** Mode identifier */
    mode: InteractionModeType;

    /** Display name */
    name: string;

    /** Short description */
    description: string;

    /** Icon/emoji for the mode */
    icon: string;

    /** Cursor style to use in this mode */
    cursor: string;

    /** Keyboard shortcuts active in this mode */
    shortcuts: string[];
}

// ============================================================================
// MODE DISPLAY CONFIGURATION
// ============================================================================

/**
 * Display information for each mode
 */
const MODE_DISPLAY_INFO: Record<InteractionModeType, ModeDisplayInfo> = {
    [InteractionModeType.OPERATE]: {
        mode: InteractionModeType.OPERATE,
        name: 'Operate',
        description: 'Click trains to drive them with keyboard controls',
        icon: '🚂',
        cursor: 'pointer',
        shortcuts: [
            '↑/W: Throttle Up',
            '↓/S: Throttle Down',
            'R: Reverse',
            'Space: Brake',
            'H: Horn',
            'Escape: Deselect'
        ]
    },
    [InteractionModeType.EDIT]: {
        mode: InteractionModeType.EDIT,
        name: 'Edit',
        description: 'Click objects to select, drag to move, use gizmos to transform',
        icon: '✏️',
        cursor: 'default',
        shortcuts: [
            'Click: Select',
            'Drag: Move',
            '[/]: Rotate',
            'Delete: Remove',
            'Escape: Deselect'
        ]
    }
};

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: InteractionModeConfig = {
    initialMode: InteractionModeType.OPERATE,
    toggleKey: 'Tab',
    enableKeyboardToggle: true,
    persistMode: true
};

/** LocalStorage key for persisted mode */
const STORAGE_KEY = 'mrw_interaction_mode';

// ============================================================================
// INTERACTION MODE MANAGER CLASS
// ============================================================================

/**
 * InteractionModeManager - Singleton manager for interaction mode state
 * 
 * Controls the global interaction context for the application.
 * Provides observables for mode changes and methods for querying/setting mode.
 * 
 * @example
 * ```typescript
 * // Get the singleton instance
 * const modeManager = InteractionModeManager.getInstance();
 * 
 * // Initialize with config
 * modeManager.initialize({ enableKeyboardToggle: true });
 * 
 * // Subscribe to mode changes
 * modeManager.onModeChanged.add((event) => {
 *     console.log(`Mode changed from ${event.previousMode} to ${event.newMode}`);
 * });
 * 
 * // Check current mode
 * if (modeManager.isOperateMode()) {
 *     // Handle train driving click
 * }
 * 
 * // Toggle mode
 * modeManager.toggleMode();
 * ```
 */
export class InteractionModeManager {
    // ========================================================================
    // SINGLETON PATTERN
    // ========================================================================

    /** Singleton instance */
    private static instance: InteractionModeManager | null = null;

    /**
     * Get the singleton instance
     * @returns The InteractionModeManager instance
     */
    static getInstance(): InteractionModeManager {
        if (!InteractionModeManager.instance) {
            InteractionModeManager.instance = new InteractionModeManager();
        }
        return InteractionModeManager.instance;
    }

    /**
     * Reset the singleton (primarily for testing)
     */
    static resetInstance(): void {
        if (InteractionModeManager.instance) {
            InteractionModeManager.instance.dispose();
            InteractionModeManager.instance = null;
        }
    }

    // ========================================================================
    // PRIVATE STATE
    // ========================================================================

    /** Current interaction mode */
    private currentMode: InteractionModeType;

    /** Configuration */
    private config: InteractionModeConfig;

    /** Whether manager has been initialized */
    private initialized: boolean = false;

    /** Keyboard event handler (bound for cleanup) */
    private keydownHandler: ((event: KeyboardEvent) => void) | null = null;

    // ========================================================================
    // OBSERVABLES
    // ========================================================================

    /**
     * Observable fired when mode changes
     * @event
     */
    readonly onModeChanged: Observable<ModeChangeEvent>;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Private constructor (use getInstance())
     */
    private constructor() {
        this.config = { ...DEFAULT_CONFIG };
        this.currentMode = this.config.initialMode;
        this.onModeChanged = new Observable<ModeChangeEvent>();

        console.log(`${LOG_PREFIX} Created (not yet initialized)`);
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the interaction mode manager
     * 
     * @param config - Optional configuration overrides
     */
    initialize(config?: Partial<InteractionModeConfig>): void {
        try {
            if (this.initialized) {
                console.warn(`${LOG_PREFIX} Already initialized`);
                return;
            }

            // Apply configuration
            if (config) {
                this.config = { ...this.config, ...config };
            }

            // Load persisted mode if enabled
            if (this.config.persistMode) {
                this.loadPersistedMode();
            } else {
                this.currentMode = this.config.initialMode;
            }

            // Setup keyboard toggle
            if (this.config.enableKeyboardToggle) {
                this.setupKeyboardToggle();
            }

            this.initialized = true;

            console.log(`${LOG_PREFIX} Initialized`);
            console.log(`${LOG_PREFIX}   Current mode: ${this.currentMode}`);
            console.log(`${LOG_PREFIX}   Toggle key: ${this.config.toggleKey}`);
            console.log(`${LOG_PREFIX}   Persist mode: ${this.config.persistMode}`);

            // Log the controls for current mode
            this.logModeControls();

        } catch (error) {
            console.error(`${LOG_PREFIX} Initialization error:`, error);
            throw error;
        }
    }

    /**
     * Load persisted mode from localStorage
     */
    private loadPersistedMode(): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored && Object.values(InteractionModeType).includes(stored as InteractionModeType)) {
                this.currentMode = stored as InteractionModeType;
                console.log(`${LOG_PREFIX} Loaded persisted mode: ${this.currentMode}`);
            } else {
                this.currentMode = this.config.initialMode;
            }
        } catch (error) {
            console.warn(`${LOG_PREFIX} Could not load persisted mode:`, error);
            this.currentMode = this.config.initialMode;
        }
    }

    /**
     * Save current mode to localStorage
     */
    private persistCurrentMode(): void {
        if (!this.config.persistMode) return;

        try {
            localStorage.setItem(STORAGE_KEY, this.currentMode);
        } catch (error) {
            console.warn(`${LOG_PREFIX} Could not persist mode:`, error);
        }
    }

    /**
     * Setup keyboard toggle handler
     */
    private setupKeyboardToggle(): void {
        this.keydownHandler = (event: KeyboardEvent) => {
            this.handleKeyDown(event);
        };

        window.addEventListener('keydown', this.keydownHandler);
        console.log(`${LOG_PREFIX} Keyboard toggle enabled (${this.config.toggleKey})`);
    }

    /**
     * Handle keydown events for mode toggle
     */
    private handleKeyDown(event: KeyboardEvent): void {
        // Ignore if typing in input field
        if (
            event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLTextAreaElement ||
            event.target instanceof HTMLSelectElement
        ) {
            return;
        }

        // Check for toggle key
        if (event.key === this.config.toggleKey) {
            event.preventDefault();
            this.toggleMode();
        }
    }

    /**
     * Log available controls for current mode
     */
    private logModeControls(): void {
        const info = this.getModeDisplayInfo();
        console.log('');
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log(`║  INTERACTION MODE: ${info.icon} ${info.name.toUpperCase().padEnd(36)}║`);
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log(`║  ${info.description.padEnd(56)}║`);
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log('║  Shortcuts:                                                ║');
        for (const shortcut of info.shortcuts) {
            console.log(`║    ${shortcut.padEnd(54)}║`);
        }
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log(`║  Press ${this.config.toggleKey} to switch modes${' '.repeat(38 - this.config.toggleKey.length)}║`);
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log('');
    }

    // ========================================================================
    // MODE GETTERS
    // ========================================================================

    /**
     * Get the current interaction mode
     * @returns Current mode
     */
    getMode(): InteractionModeType {
        return this.currentMode;
    }

    /**
     * Check if currently in Operate mode
     * @returns true if in Operate mode
     */
    isOperateMode(): boolean {
        return this.currentMode === InteractionModeType.OPERATE;
    }

    /**
     * Check if currently in Edit mode
     * @returns true if in Edit mode
     */
    isEditMode(): boolean {
        return this.currentMode === InteractionModeType.EDIT;
    }

    /**
     * Get display information for current mode
     * @returns ModeDisplayInfo for current mode
     */
    getModeDisplayInfo(): ModeDisplayInfo {
        return MODE_DISPLAY_INFO[this.currentMode];
    }

    /**
     * Get display information for a specific mode
     * @param mode - Mode to get info for
     * @returns ModeDisplayInfo
     */
    static getDisplayInfoForMode(mode: InteractionModeType): ModeDisplayInfo {
        return MODE_DISPLAY_INFO[mode];
    }

    /**
     * Get all available modes
     * @returns Array of all mode types
     */
    static getAllModes(): InteractionModeType[] {
        return Object.values(InteractionModeType);
    }

    // ========================================================================
    // MODE SETTERS
    // ========================================================================

    /**
     * Set the interaction mode
     * 
     * @param mode - New mode to set
     * @fires onModeChanged
     */
    setMode(mode: InteractionModeType): void {
        if (mode === this.currentMode) {
            return; // No change
        }

        const previousMode = this.currentMode;
        this.currentMode = mode;

        // Persist if enabled
        this.persistCurrentMode();

        // Create event
        const event: ModeChangeEvent = {
            previousMode,
            newMode: mode,
            timestamp: Date.now()
        };

        // Notify observers
        this.onModeChanged.notifyObservers(event);

        console.log(`${LOG_PREFIX} Mode changed: ${previousMode} → ${mode}`);
        this.logModeControls();
    }

    /**
     * Set to Operate mode
     */
    setOperateMode(): void {
        this.setMode(InteractionModeType.OPERATE);
    }

    /**
     * Set to Edit mode
     */
    setEditMode(): void {
        this.setMode(InteractionModeType.EDIT);
    }

    /**
     * Toggle between modes
     */
    toggleMode(): void {
        const newMode = this.currentMode === InteractionModeType.OPERATE
            ? InteractionModeType.EDIT
            : InteractionModeType.OPERATE;

        this.setMode(newMode);
    }

    // ========================================================================
    // CONFIGURATION
    // ========================================================================

    /**
     * Get current configuration
     * @returns Current config
     */
    getConfig(): Readonly<InteractionModeConfig> {
        return { ...this.config };
    }

    /**
     * Update configuration
     * @param updates - Configuration updates
     */
    updateConfig(updates: Partial<InteractionModeConfig>): void {
        const hadKeyboardToggle = this.config.enableKeyboardToggle;

        this.config = { ...this.config, ...updates };

        // Handle keyboard toggle changes
        if (updates.enableKeyboardToggle !== undefined) {
            if (updates.enableKeyboardToggle && !hadKeyboardToggle) {
                this.setupKeyboardToggle();
            } else if (!updates.enableKeyboardToggle && hadKeyboardToggle) {
                this.removeKeyboardToggle();
            }
        }

        console.log(`${LOG_PREFIX} Configuration updated`);
    }

    /**
     * Remove keyboard toggle handler
     */
    private removeKeyboardToggle(): void {
        if (this.keydownHandler) {
            window.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = null;
            console.log(`${LOG_PREFIX} Keyboard toggle disabled`);
        }
    }

    // ========================================================================
    // DISPOSAL
    // ========================================================================

    /**
     * Clean up resources
     */
    dispose(): void {
        try {
            this.removeKeyboardToggle();
            this.onModeChanged.clear();
            this.initialized = false;

            console.log(`${LOG_PREFIX} Disposed`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error during disposal:`, error);
        }
    }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Get the interaction mode manager singleton
 * @returns InteractionModeManager instance
 */
export function getInteractionModeManager(): InteractionModeManager {
    return InteractionModeManager.getInstance();
}

/**
 * Check if currently in Operate mode
 * @returns true if in Operate mode
 */
export function isOperateMode(): boolean {
    return InteractionModeManager.getInstance().isOperateMode();
}

/**
 * Check if currently in Edit mode
 * @returns true if in Edit mode
 */
export function isEditMode(): boolean {
    return InteractionModeManager.getInstance().isEditMode();
}

/**
 * Toggle the interaction mode
 */
export function toggleInteractionMode(): void {
    InteractionModeManager.getInstance().toggleMode();
}

// ============================================================================
// WINDOW EXPOSURE FOR DEBUGGING
// ============================================================================

// Expose to window for debugging (only in development)
if (typeof window !== 'undefined') {
    (window as any).__interactionMode = {
        getManager: () => InteractionModeManager.getInstance(),
        getMode: () => InteractionModeManager.getInstance().getMode(),
        setOperate: () => InteractionModeManager.getInstance().setOperateMode(),
        setEdit: () => InteractionModeManager.getInstance().setEditMode(),
        toggle: () => InteractionModeManager.getInstance().toggleMode(),
        isOperate: () => isOperateMode(),
        isEdit: () => isEditMode()
    };
}