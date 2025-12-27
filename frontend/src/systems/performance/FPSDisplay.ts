/**
 * FPSDisplay.ts - Real-time frame rate monitoring and display system
 * 
 * Path: frontend/src/systems/performance/FPSDisplay.ts
 * 
 * Provides real-time FPS (frames per second) monitoring for the Babylon.js
 * rendering engine. Features include:
 * - Accurate FPS calculation using engine metrics
 * - Smoothed averaging to prevent jittery display
 * - Optional on-screen overlay display
 * - Performance state classification (good/warning/critical)
 * - Event callbacks for UI integration
 * 
 * @module FPSDisplay
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Scene } from '@babylonjs/core/scene';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Observer } from '@babylonjs/core/Misc/observable';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

/** Logging prefix for consistent console output */
const LOG_PREFIX = '[FPSDisplay]';

/** FPS thresholds for performance classification */
const FPS_THRESHOLDS = {
    /** Below this is considered critical/poor performance */
    CRITICAL: 20,
    /** Below this is considered warning/degraded performance */
    WARNING: 40,
    /** At or above this is considered good performance */
    GOOD: 55,
} as const;

/** Default configuration values */
const DEFAULT_CONFIG = {
    /** Update interval in milliseconds */
    updateIntervalMs: 250,
    /** Number of samples for smoothed averaging */
    smoothingSamples: 10,
    /** Whether to show the on-screen overlay by default */
    showOverlay: false,
    /** Overlay position from top edge */
    overlayTopOffset: '10px',
    /** Overlay position from right edge */
    overlayRightOffset: '10px',
} as const;

/** Color scheme for FPS display states */
const FPS_COLORS = {
    /** Good performance (green) */
    GOOD: '#27ae60',
    /** Warning performance (yellow/orange) */
    WARNING: '#f39c12',
    /** Critical performance (red) */
    CRITICAL: '#e74c3c',
    /** Background color for overlay */
    BACKGROUND: 'rgba(0, 0, 0, 0.75)',
    /** Text color */
    TEXT: '#ffffff',
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Performance state classification
 */
export type PerformanceState = 'good' | 'warning' | 'critical';

/**
 * FPS data snapshot
 */
export interface FPSData {
    /** Current instantaneous FPS */
    current: number;
    /** Smoothed/averaged FPS */
    smoothed: number;
    /** Minimum FPS recorded this session */
    min: number;
    /** Maximum FPS recorded this session */
    max: number;
    /** Current performance state */
    state: PerformanceState;
    /** Whether FPS display is enabled */
    enabled: boolean;
}

/**
 * Configuration options for FPSDisplay
 */
export interface FPSDisplayConfig {
    /** Update interval in milliseconds */
    updateIntervalMs?: number;
    /** Number of samples for smoothed averaging */
    smoothingSamples?: number;
    /** Whether to show overlay initially */
    showOverlay?: boolean;
    /** Overlay position from top edge */
    overlayTopOffset?: string;
    /** Overlay position from right edge */
    overlayRightOffset?: string;
}

/**
 * Callback type for FPS updates
 */
export type FPSUpdateCallback = (data: FPSData) => void;

// ============================================================================
// FPS DISPLAY CLASS
// ============================================================================

/**
 * FPSDisplay - Real-time frame rate monitoring system
 * 
 * @example
 * ```typescript
 * // Create and initialize
 * const fpsDisplay = new FPSDisplay(scene);
 * fpsDisplay.initialize();
 * 
 * // Enable display
 * fpsDisplay.enable();
 * 
 * // Subscribe to updates for UI
 * fpsDisplay.onUpdate((data) => {
 *     console.log(`FPS: ${data.smoothed.toFixed(1)}`);
 * });
 * 
 * // Toggle on-screen overlay
 * fpsDisplay.toggleOverlay();
 * ```
 */
export class FPSDisplay {
    // ========================================================================
    // PRIVATE PROPERTIES
    // ========================================================================

    /** Reference to the Babylon.js scene */
    private scene: Scene;

    /** Reference to the Babylon.js engine */
    private engine: Engine;

    /** Configuration settings */
    private config: Required<FPSDisplayConfig>;

    /** Whether the FPS monitoring is enabled */
    private _enabled: boolean = false;

    /** Whether the system has been initialized */
    private _initialized: boolean = false;

    /** Observer for render loop */
    private renderObserver: Observer<Scene> | null = null;

    /** Recent FPS samples for smoothing */
    private fpsSamples: number[] = [];

    /** Minimum FPS recorded */
    private _minFps: number = Infinity;

    /** Maximum FPS recorded */
    private _maxFps: number = 0;

    /** Last update timestamp */
    private lastUpdateTime: number = 0;

    /** On-screen overlay element */
    private overlayElement: HTMLDivElement | null = null;

    /** Whether overlay is currently visible */
    private _overlayVisible: boolean = false;

    /** Update callbacks */
    private updateCallbacks: Set<FPSUpdateCallback> = new Set();

    /** Current FPS data cache */
    private currentData: FPSData = {
        current: 0,
        smoothed: 0,
        min: Infinity,
        max: 0,
        state: 'good',
        enabled: false,
    };

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new FPSDisplay instance
     * 
     * @param scene - Babylon.js scene to monitor
     * @param config - Optional configuration overrides
     * @throws Error if scene is null or undefined
     */
    constructor(scene: Scene, config: FPSDisplayConfig = {}) {
        // Validate scene
        if (!scene) {
            const error = new Error(`${LOG_PREFIX} Scene is required`);
            console.error(error.message);
            throw error;
        }

        // Get engine from scene
        const engine = scene.getEngine();
        if (!engine) {
            const error = new Error(`${LOG_PREFIX} Could not get engine from scene`);
            console.error(error.message);
            throw error;
        }

        this.scene = scene;
        this.engine = engine;

        // Merge configuration with defaults
        this.config = {
            updateIntervalMs: config.updateIntervalMs ?? DEFAULT_CONFIG.updateIntervalMs,
            smoothingSamples: config.smoothingSamples ?? DEFAULT_CONFIG.smoothingSamples,
            showOverlay: config.showOverlay ?? DEFAULT_CONFIG.showOverlay,
            overlayTopOffset: config.overlayTopOffset ?? DEFAULT_CONFIG.overlayTopOffset,
            overlayRightOffset: config.overlayRightOffset ?? DEFAULT_CONFIG.overlayRightOffset,
        };

        console.log(`${LOG_PREFIX} Created with config:`, this.config);
    }

    // ========================================================================
    // INITIALIZATION & CLEANUP
    // ========================================================================

    /**
     * Initialize the FPS display system
     * Creates the overlay element and sets up monitoring
     */
    initialize(): void {
        if (this._initialized) {
            console.warn(`${LOG_PREFIX} Already initialized`);
            return;
        }

        try {
            console.log(`${LOG_PREFIX} Initializing...`);

            // Create overlay element (hidden by default)
            this.createOverlayElement();

            // Mark as initialized
            this._initialized = true;

            // Show overlay if configured
            if (this.config.showOverlay) {
                this.showOverlay();
            }

            console.log(`${LOG_PREFIX} ✓ Initialized successfully`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Initialization failed:`, error);
            throw error;
        }
    }

    /**
     * Clean up resources and stop monitoring
     */
    dispose(): void {
        console.log(`${LOG_PREFIX} Disposing...`);

        // Disable monitoring (clears both observer and interval)
        this.disable();

        // Remove overlay
        if (this.overlayElement) {
            this.overlayElement.remove();
            this.overlayElement = null;
        }

        // Clear callbacks
        this.updateCallbacks.clear();

        // Reset state
        this._initialized = false;
        this._overlayVisible = false;

        console.log(`${LOG_PREFIX} ✓ Disposed`);
    }

    // ========================================================================
    // OVERLAY ELEMENT CREATION
    // ========================================================================

    /**
     * Create the on-screen FPS overlay element
     */
    private createOverlayElement(): void {
        // Remove existing overlay if present
        if (this.overlayElement) {
            this.overlayElement.remove();
        }

        // Create container
        const overlay = document.createElement('div');
        overlay.id = 'fps-display-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: ${this.config.overlayTopOffset};
            right: ${this.config.overlayRightOffset};
            background: ${FPS_COLORS.BACKGROUND};
            color: ${FPS_COLORS.TEXT};
            padding: 8px 14px;
            border-radius: 6px;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 13px;
            font-weight: 600;
            z-index: 10000;
            pointer-events: none;
            user-select: none;
            display: none;
            min-width: 90px;
            text-align: center;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(4px);
        `;

        // Create FPS text
        const fpsText = document.createElement('div');
        fpsText.className = 'fps-value';
        fpsText.style.cssText = `
            font-size: 16px;
            line-height: 1.2;
            letter-spacing: 0.5px;
        `;
        fpsText.textContent = '-- FPS';
        overlay.appendChild(fpsText);

        // Create state indicator
        const stateIndicator = document.createElement('div');
        stateIndicator.className = 'fps-state';
        stateIndicator.style.cssText = `
            font-size: 10px;
            margin-top: 4px;
            opacity: 0.8;
            text-transform: uppercase;
            letter-spacing: 1px;
        `;
        stateIndicator.textContent = 'READY';
        overlay.appendChild(stateIndicator);

        // Add to document
        document.body.appendChild(overlay);
        this.overlayElement = overlay;

        console.log(`${LOG_PREFIX} Overlay element created`);
    }

    /**
     * Update the overlay display with current FPS data
     */
    private updateOverlayDisplay(): void {
        if (!this.overlayElement || !this._overlayVisible) return;

        const fpsValueEl = this.overlayElement.querySelector('.fps-value') as HTMLElement;
        const stateEl = this.overlayElement.querySelector('.fps-state') as HTMLElement;

        if (fpsValueEl) {
            fpsValueEl.textContent = `${this.currentData.smoothed.toFixed(0)} FPS`;
            fpsValueEl.style.color = this.getStateColor(this.currentData.state);
        }

        if (stateEl) {
            stateEl.textContent = this.getStateLabel(this.currentData.state);
            stateEl.style.color = this.getStateColor(this.currentData.state);
        }
    }

    // ========================================================================
    // MONITORING CONTROL
    // ========================================================================

    /**
     * Enable FPS monitoring
     */
    enable(): void {
        if (this._enabled) {
            console.warn(`${LOG_PREFIX} Already enabled`);
            return;
        }

        if (!this._initialized) {
            console.warn(`${LOG_PREFIX} Not initialized - call initialize() first`);
            return;
        }

        try {
            console.log(`${LOG_PREFIX} Enabling FPS monitoring...`);
            console.log(`${LOG_PREFIX} Engine FPS method available:`, typeof this.engine.getFps);
            console.log(`${LOG_PREFIX} Current engine FPS:`, this.engine.getFps());

            // Reset statistics
            this.resetStats();

            // Start render loop observer
            this.startMonitoring();

            this._enabled = true;
            this.currentData.enabled = true;

            console.log(`${LOG_PREFIX} ✓ FPS monitoring enabled`);
            console.log(`${LOG_PREFIX} Registered callbacks:`, this.updateCallbacks.size);
        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to enable:`, error);
        }
    }

    /**
     * Disable FPS monitoring
     */
    disable(): void {
        if (!this._enabled) {
            return;
        }

        console.log(`${LOG_PREFIX} Disabling FPS monitoring...`);

        // Stop render loop observer
        this.stopMonitoring();

        this._enabled = false;
        this.currentData.enabled = false;

        // Update overlay to show disabled state
        if (this.overlayElement && this._overlayVisible) {
            const fpsValueEl = this.overlayElement.querySelector('.fps-value') as HTMLElement;
            const stateEl = this.overlayElement.querySelector('.fps-state') as HTMLElement;

            if (fpsValueEl) {
                fpsValueEl.textContent = '-- FPS';
                fpsValueEl.style.color = FPS_COLORS.TEXT;
            }
            if (stateEl) {
                stateEl.textContent = 'DISABLED';
                stateEl.style.color = FPS_COLORS.TEXT;
            }
        }

        console.log(`${LOG_PREFIX} ✓ FPS monitoring disabled`);
    }

    /**
     * Toggle FPS monitoring on/off
     * @returns New enabled state
     */
    toggle(): boolean {
        if (this._enabled) {
            this.disable();
        } else {
            this.enable();
        }
        return this._enabled;
    }

    // ========================================================================
    // OVERLAY VISIBILITY
    // ========================================================================

    /**
     * Show the on-screen overlay
     */
    showOverlay(): void {
        if (!this.overlayElement) {
            console.warn(`${LOG_PREFIX} Overlay not created`);
            return;
        }

        this.overlayElement.style.display = 'block';
        this._overlayVisible = true;

        console.log(`${LOG_PREFIX} Overlay shown`);
    }

    /**
     * Hide the on-screen overlay
     */
    hideOverlay(): void {
        if (!this.overlayElement) {
            return;
        }

        this.overlayElement.style.display = 'none';
        this._overlayVisible = false;

        console.log(`${LOG_PREFIX} Overlay hidden`);
    }

    /**
     * Toggle overlay visibility
     * @returns New visibility state
     */
    toggleOverlay(): boolean {
        if (this._overlayVisible) {
            this.hideOverlay();
        } else {
            this.showOverlay();
        }
        return this._overlayVisible;
    }

    // ========================================================================
    // MONITORING INTERNALS
    // ========================================================================

    /** Interval ID for fallback timer-based updates */
    private updateIntervalId: number | null = null;

    /**
     * Start the render loop monitoring
     * Uses both render observer and interval timer for reliability
     */
    private startMonitoring(): void {
        // Remove any existing observers/timers
        this.stopMonitoring();

        console.log(`${LOG_PREFIX} Starting monitoring...`);

        // Primary: Add observer to render loop
        this.renderObserver = this.scene.onAfterRenderObservable.add(() => {
            this.updateFPS();
        });

        // Fallback: Also use interval timer in case render loop doesn't trigger observer
        // This ensures FPS updates even if there are issues with the observable
        this.updateIntervalId = window.setInterval(() => {
            this.updateFPS();
        }, this.config.updateIntervalMs);

        // Force an immediate update
        this.updateFPS(true);

        console.log(`${LOG_PREFIX} ✓ Monitoring started`);
    }

    /**
     * Stop the render loop monitoring
     */
    private stopMonitoring(): void {
        // Remove render observer
        if (this.renderObserver) {
            this.scene.onAfterRenderObservable.remove(this.renderObserver);
            this.renderObserver = null;
        }

        // Clear interval timer
        if (this.updateIntervalId !== null) {
            window.clearInterval(this.updateIntervalId);
            this.updateIntervalId = null;
        }

        console.log(`${LOG_PREFIX} Monitoring stopped`);
    }

    /**
     * Update FPS calculations (called each frame or by interval)
     * @param force - If true, skip the time check and update immediately
     */
    private updateFPS(force: boolean = false): void {
        const now = performance.now();

        // Check if enough time has passed since last update (unless forced)
        if (!force && now - this.lastUpdateTime < this.config.updateIntervalMs) {
            return;
        }

        this.lastUpdateTime = now;

        // Get current FPS from engine
        const currentFps = this.engine.getFps();

        // Skip if FPS is 0 or invalid (engine not yet rendering)
        if (currentFps <= 0 && this.fpsSamples.length === 0) {
            console.log(`${LOG_PREFIX} Waiting for valid FPS data...`);
            return;
        }

        // Add to samples for smoothing (only add valid values)
        if (currentFps > 0) {
            this.fpsSamples.push(currentFps);
        }

        // Keep only the configured number of samples
        while (this.fpsSamples.length > this.config.smoothingSamples) {
            this.fpsSamples.shift();
        }

        // Calculate smoothed FPS
        const smoothedFps = this.calculateSmoothedFPS();

        // Update min/max
        if (smoothedFps < this._minFps && smoothedFps > 0) {
            this._minFps = smoothedFps;
        }
        if (smoothedFps > this._maxFps) {
            this._maxFps = smoothedFps;
        }

        // Determine performance state
        const state = this.classifyPerformance(smoothedFps);

        // Update current data
        this.currentData = {
            current: currentFps,
            smoothed: smoothedFps,
            min: this._minFps === Infinity ? 0 : this._minFps,
            max: this._maxFps,
            state,
            enabled: this._enabled,
        };

        // Update overlay display
        this.updateOverlayDisplay();

        // Notify callbacks
        this.notifyCallbacks();
    }

    /**
     * Calculate smoothed FPS from samples
     * @returns Smoothed FPS value
     */
    private calculateSmoothedFPS(): number {
        if (this.fpsSamples.length === 0) {
            return 0;
        }

        const sum = this.fpsSamples.reduce((acc, val) => acc + val, 0);
        return sum / this.fpsSamples.length;
    }

    /**
     * Classify performance state based on FPS
     * @param fps - Current FPS value
     * @returns Performance state
     */
    private classifyPerformance(fps: number): PerformanceState {
        if (fps < FPS_THRESHOLDS.CRITICAL) {
            return 'critical';
        } else if (fps < FPS_THRESHOLDS.WARNING) {
            return 'warning';
        }
        return 'good';
    }

    /**
     * Get color for performance state
     * @param state - Performance state
     * @returns Color hex string
     */
    private getStateColor(state: PerformanceState): string {
        switch (state) {
            case 'good':
                return FPS_COLORS.GOOD;
            case 'warning':
                return FPS_COLORS.WARNING;
            case 'critical':
                return FPS_COLORS.CRITICAL;
            default:
                return FPS_COLORS.TEXT;
        }
    }

    /**
     * Get label for performance state
     * @param state - Performance state
     * @returns State label string
     */
    private getStateLabel(state: PerformanceState): string {
        switch (state) {
            case 'good':
                return 'SMOOTH';
            case 'warning':
                return 'DEGRADED';
            case 'critical':
                return 'LOW';
            default:
                return 'UNKNOWN';
        }
    }

    /**
     * Reset FPS statistics
     */
    private resetStats(): void {
        this.fpsSamples = [];
        this._minFps = Infinity;
        this._maxFps = 0;
        this.lastUpdateTime = 0;
    }

    // ========================================================================
    // CALLBACK MANAGEMENT
    // ========================================================================

    /**
     * Register a callback for FPS updates
     * @param callback - Function to call on FPS update
     */
    onUpdate(callback: FPSUpdateCallback): void {
        this.updateCallbacks.add(callback);
    }

    /**
     * Remove a registered callback
     * @param callback - Function to remove
     */
    offUpdate(callback: FPSUpdateCallback): void {
        this.updateCallbacks.delete(callback);
    }

    /**
     * Notify all registered callbacks
     */
    private notifyCallbacks(): void {
        for (const callback of this.updateCallbacks) {
            try {
                callback(this.currentData);
            } catch (error) {
                console.error(`${LOG_PREFIX} Callback error:`, error);
            }
        }
    }

    // ========================================================================
    // PUBLIC GETTERS
    // ========================================================================

    /**
     * Get whether FPS monitoring is enabled
     */
    get enabled(): boolean {
        return this._enabled;
    }

    /**
     * Get whether the system is initialized
     */
    get initialized(): boolean {
        return this._initialized;
    }

    /**
     * Get whether overlay is visible
     */
    get overlayVisible(): boolean {
        return this._overlayVisible;
    }

    /**
     * Get current FPS data snapshot
     */
    get data(): FPSData {
        return { ...this.currentData };
    }

    /**
     * Get current smoothed FPS value
     */
    get fps(): number {
        return this.currentData.smoothed;
    }

    /**
     * Get current performance state
     */
    get state(): PerformanceState {
        return this.currentData.state;
    }
}

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default FPSDisplay;