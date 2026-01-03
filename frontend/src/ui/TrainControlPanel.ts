/**
 * TrainControlPanel.ts - Floating UI panel for train control
 * 
 * Path: frontend/src/ui/TrainControlPanel.ts
 * 
 * Provides a DCC-controller-style interface:
 * - Track status banner (ON TRACK / NOT ON TRACK)
 * - Throttle slider (0-100%)
 * - Direction toggle (Forward/Reverse)
 * - Brake button
 * - Emergency stop
 * - Horn button
 * - Speed display
 * 
 * The panel appears when a train is selected and hides when deselected.
 * Positioned on the LEFT side of the screen (after the sidebar).
 * 
 * @module TrainControlPanel
 * @author Model Railway Workbench
 * @version 1.2.0
 */

import type { TrainSystem, TrainController, TrainPhysicsState, TrainDirection } from '../systems/train';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[TrainControlPanel]';

/** Panel CSS class prefix */
const CSS_PREFIX = 'train-control';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Panel configuration options
 */
export interface TrainControlPanelConfig {
    /** Position from left edge (after sidebar) */
    leftOffset: number;

    /** Initial position from top edge */
    topOffset: number;

    /** Panel width */
    width: number;

    /** Enable sound buttons */
    enableSound: boolean;

    /** Update interval for display (ms) */
    updateInterval: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: TrainControlPanelConfig = {
    leftOffset: 280,      // After the left sidebar
    topOffset: 80,        // Below the top toolbar
    width: 260,
    enableSound: true,
    updateInterval: 100
};

// ============================================================================
// TRAIN CONTROL PANEL CLASS
// ============================================================================

/**
 * TrainControlPanel - Floating control interface for trains
 * 
 * Creates a DOM-based UI panel that appears when a train is selected.
 * Provides throttle control, direction, braking, and status display.
 * Positioned on the LEFT side of the screen.
 * 
 * @example
 * ```typescript
 * const panel = new TrainControlPanel(trainSystem);
 * panel.initialize();
 * 
 * // Panel auto-shows/hides based on train selection
 * ```
 */
export class TrainControlPanel {
    // ========================================================================
    // PRIVATE STATE
    // ========================================================================

    /** Train system reference */
    private trainSystem: TrainSystem;

    /** Configuration */
    private config: TrainControlPanelConfig;

    /** Main container element */
    private container: HTMLDivElement | null = null;

    /** Currently displayed train controller */
    private currentTrain: TrainController | null = null;

    /** Update interval handle */
    private updateIntervalId: number | null = null;

    /** Style element for CSS */
    private styleElement: HTMLStyleElement | null = null;

    // ========================================================================
    // UI ELEMENT REFERENCES
    // ========================================================================

    private trainNameLabel: HTMLElement | null = null;
    private speedDisplay: HTMLElement | null = null;
    private throttleSlider: HTMLInputElement | null = null;
    private throttleValue: HTMLElement | null = null;
    private directionBtn: HTMLButtonElement | null = null;
    private brakeBtn: HTMLButtonElement | null = null;
    private emergencyBtn: HTMLButtonElement | null = null;
    private hornBtn: HTMLButtonElement | null = null;
    private statusIndicator: HTMLElement | null = null;
    private statusText: HTMLElement | null = null;
    private trackStatusBanner: HTMLElement | null = null;

    /** Is panel initialized */
    private isInitialized: boolean = false;

    /** Is panel visible */
    private isVisible: boolean = false;

    /** Keyboard handler for ESC to close */
    private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new TrainControlPanel
     * @param trainSystem - Train system to control
     * @param config - Optional configuration
     */
    constructor(
        trainSystem: TrainSystem,
        config?: Partial<TrainControlPanelConfig>
    ) {
        this.trainSystem = trainSystem;
        this.config = { ...DEFAULT_CONFIG, ...config };

        console.log(`${LOG_PREFIX} Panel created`);
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the control panel
     * Creates DOM elements and sets up event listeners
     */
    initialize(): void {
        if (this.isInitialized) {
            console.warn(`${LOG_PREFIX} Already initialized`);
            return;
        }

        // Inject styles
        this.injectStyles();

        // Create DOM structure
        this.createDOM();

        // Setup event listeners
        this.setupEventListeners();

        // Subscribe to drive mode activation (when user explicitly chooses to drive)
        this.trainSystem.onDriveModeActivated.add((train) => {
            this.showForDriving(train);
        });

        // Subscribe to train deselection (to hide panel when train is deselected)
        this.trainSystem.onSelectionChanged.add((train) => {
            this.handleSelectionChanged(train);
        });

        // Start update loop
        this.startUpdateLoop();

        this.isInitialized = true;
        console.log(`${LOG_PREFIX} ✓ Initialized (LEFT side, ${this.config.leftOffset}px from left)`);
    }

    // ========================================================================
    // STYLES
    // ========================================================================

    /**
     * Inject CSS styles for the panel
     */
    private injectStyles(): void {
        this.styleElement = document.createElement('style');
        this.styleElement.textContent = `
            /* ================================================
               TRAIN CONTROL PANEL STYLES
               Positioned on LEFT side of screen
               ================================================ */
            
            .${CSS_PREFIX}-panel {
                position: fixed;
                left: ${this.config.leftOffset}px;
                top: ${this.config.topOffset}px;
                width: ${this.config.width}px;
                background: linear-gradient(145deg, #2a2a2a 0%, #1a1a1a 100%);
                border: 2px solid #444;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5),
                            inset 0 1px 0 rgba(255, 255, 255, 0.1);
                font-family: 'Segoe UI', system-ui, sans-serif;
                color: #e0e0e0;
                z-index: 1000;
                opacity: 0;
                transform: translateX(-20px);
                transition: opacity 0.3s ease, transform 0.3s ease;
                pointer-events: none;
                user-select: none;
                overflow: hidden;
            }
            
            .${CSS_PREFIX}-panel.visible {
                opacity: 1;
                transform: translateX(0);
                pointer-events: auto;
            }
            
            /* ================================================
               TRACK STATUS BANNER - CRITICAL VISIBILITY
               ================================================ */
            .${CSS_PREFIX}-track-status {
                padding: 10px 16px;
                text-align: center;
                font-weight: 700;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 1px;
                transition: all 0.3s ease;
            }
            
            .${CSS_PREFIX}-track-status.on-track {
                background: linear-gradient(90deg, #166534 0%, #15803d 50%, #166534 100%);
                color: #4ade80;
                border-bottom: 2px solid #22c55e;
            }
            
            .${CSS_PREFIX}-track-status.off-track {
                background: linear-gradient(90deg, #7f1d1d 0%, #991b1b 50%, #7f1d1d 100%);
                color: #fca5a5;
                border-bottom: 2px solid #ef4444;
                animation: pulse-warning 1.5s ease-in-out infinite;
            }
            
            @keyframes pulse-warning {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
            
            /* ================================================
               HEADER
               ================================================ */
            .${CSS_PREFIX}-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                background: rgba(0, 0, 0, 0.3);
                border-bottom: 1px solid #333;
            }

            .${CSS_PREFIX}-header-left {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .${CSS_PREFIX}-title {
                font-size: 14px;
                font-weight: 600;
                color: #4ade80;
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            .${CSS_PREFIX}-train-name {
                font-size: 11px;
                color: #888;
                max-width: 160px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .${CSS_PREFIX}-close-btn {
                width: 28px;
                height: 28px;
                border: none;
                background: rgba(255, 255, 255, 0.1);
                color: #888;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                transition: all 0.15s ease;
            }

            .${CSS_PREFIX}-close-btn:hover {
                background: rgba(239, 68, 68, 0.3);
                color: #f87171;
            }
            
            /* ================================================
               BODY
               ================================================ */
            .${CSS_PREFIX}-body {
                padding: 16px;
            }
            
            /* ================================================
               SPEED DISPLAY
               ================================================ */
            .${CSS_PREFIX}-speed-section {
                text-align: center;
                margin-bottom: 16px;
                padding: 16px;
                background: rgba(0, 0, 0, 0.5);
                border-radius: 8px;
                border: 1px solid #333;
            }
            
            .${CSS_PREFIX}-speed-value {
                font-size: 48px;
                font-weight: 700;
                font-family: 'Consolas', 'Monaco', monospace;
                color: #4ade80;
                text-shadow: 0 0 20px rgba(74, 222, 128, 0.5);
                line-height: 1;
            }
            
            .${CSS_PREFIX}-speed-value.moving {
                color: #fbbf24;
                text-shadow: 0 0 20px rgba(251, 191, 36, 0.5);
            }
            
            .${CSS_PREFIX}-speed-value.fast {
                color: #f87171;
                text-shadow: 0 0 20px rgba(248, 113, 113, 0.5);
            }
            
            .${CSS_PREFIX}-speed-unit {
                font-size: 11px;
                color: #666;
                margin-top: 4px;
                text-transform: uppercase;
                letter-spacing: 2px;
            }
            
            /* ================================================
               THROTTLE SECTION
               ================================================ */
            .${CSS_PREFIX}-throttle-section {
                margin-bottom: 16px;
            }
            
            .${CSS_PREFIX}-throttle-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }
            
            .${CSS_PREFIX}-label {
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: #888;
            }
            
            .${CSS_PREFIX}-throttle-value {
                font-size: 14px;
                font-weight: 600;
                color: #fbbf24;
                font-family: 'Consolas', 'Monaco', monospace;
            }
            
            /* Custom Slider */
            .${CSS_PREFIX}-slider {
                -webkit-appearance: none;
                appearance: none;
                width: 100%;
                height: 12px;
                background: linear-gradient(90deg, #1a1a1a 0%, #333 100%);
                border-radius: 6px;
                outline: none;
                cursor: pointer;
                border: 1px solid #444;
            }
            
            .${CSS_PREFIX}-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 24px;
                height: 24px;
                background: linear-gradient(145deg, #4ade80 0%, #22c55e 100%);
                border-radius: 50%;
                cursor: pointer;
                box-shadow: 0 2px 8px rgba(74, 222, 128, 0.4);
                transition: transform 0.15s ease;
                border: 2px solid #86efac;
            }
            
            .${CSS_PREFIX}-slider::-webkit-slider-thumb:hover {
                transform: scale(1.15);
            }
            
            .${CSS_PREFIX}-slider::-moz-range-thumb {
                width: 24px;
                height: 24px;
                background: linear-gradient(145deg, #4ade80 0%, #22c55e 100%);
                border-radius: 50%;
                cursor: pointer;
                border: 2px solid #86efac;
                box-shadow: 0 2px 8px rgba(74, 222, 128, 0.4);
            }
            
            /* ================================================
               CONTROL BUTTONS
               ================================================ */
            .${CSS_PREFIX}-controls {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
                margin-bottom: 12px;
            }
            
            .${CSS_PREFIX}-btn {
                padding: 12px;
                border: 1px solid #444;
                border-radius: 8px;
                background: linear-gradient(145deg, #333 0%, #222 100%);
                color: #e0e0e0;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                cursor: pointer;
                transition: all 0.15s ease;
            }
            
            .${CSS_PREFIX}-btn:hover {
                background: linear-gradient(145deg, #444 0%, #333 100%);
                border-color: #555;
                transform: translateY(-1px);
            }
            
            .${CSS_PREFIX}-btn:active {
                transform: scale(0.98) translateY(0);
            }
            
            .${CSS_PREFIX}-btn.direction {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
            }
            
            .${CSS_PREFIX}-btn.direction .arrow {
                font-size: 16px;
            }
            
            .${CSS_PREFIX}-btn.direction.forward {
                border-color: #4ade80;
                color: #4ade80;
                background: linear-gradient(145deg, #1a3a1a 0%, #0f2a0f 100%);
            }
            
            .${CSS_PREFIX}-btn.direction.reverse {
                border-color: #60a5fa;
                color: #60a5fa;
                background: linear-gradient(145deg, #1a2a3a 0%, #0f1a2a 100%);
            }
            
            .${CSS_PREFIX}-btn.brake {
                border-color: #f59e0b;
                color: #f59e0b;
            }
            
            .${CSS_PREFIX}-btn.brake:hover {
                background: rgba(245, 158, 11, 0.2);
            }
            
            .${CSS_PREFIX}-btn.brake.active {
                background: rgba(245, 158, 11, 0.3);
                box-shadow: 0 0 12px rgba(245, 158, 11, 0.3);
            }
            
            /* ================================================
               EMERGENCY BUTTON
               ================================================ */
            .${CSS_PREFIX}-emergency {
                width: 100%;
                padding: 14px;
                background: linear-gradient(145deg, #dc2626 0%, #991b1b 100%);
                border: 2px solid #ef4444;
                border-radius: 8px;
                color: white;
                font-size: 13px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 1px;
                cursor: pointer;
                transition: all 0.15s ease;
                margin-bottom: 10px;
            }
            
            .${CSS_PREFIX}-emergency:hover {
                background: linear-gradient(145deg, #ef4444 0%, #dc2626 100%);
                box-shadow: 0 0 20px rgba(239, 68, 68, 0.4);
                transform: translateY(-1px);
            }
            
            .${CSS_PREFIX}-emergency:active {
                transform: scale(0.98);
            }
            
            /* ================================================
               HORN BUTTON
               ================================================ */
            .${CSS_PREFIX}-horn {
                width: 100%;
                padding: 12px;
                background: linear-gradient(145deg, #6366f1 0%, #4f46e5 100%);
                border: 1px solid #818cf8;
                border-radius: 8px;
                color: white;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.15s ease;
            }
            
            .${CSS_PREFIX}-horn:hover {
                background: linear-gradient(145deg, #818cf8 0%, #6366f1 100%);
                transform: translateY(-1px);
            }
            
            .${CSS_PREFIX}-horn:active {
                transform: scale(0.98);
            }
            
            /* ================================================
               STATUS INDICATOR
               ================================================ */
            .${CSS_PREFIX}-status {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 10px;
                background: rgba(0, 0, 0, 0.3);
                border-top: 1px solid #333;
                font-size: 11px;
                color: #888;
            }
            
            .${CSS_PREFIX}-status-dot {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: #22c55e;
                box-shadow: 0 0 10px rgba(34, 197, 94, 0.6);
                animation: pulse-dot 2s ease-in-out infinite;
            }
            
            @keyframes pulse-dot {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.2); opacity: 0.8; }
            }
            
            .${CSS_PREFIX}-status-dot.stopped {
                background: #666;
                box-shadow: none;
                animation: none;
            }
            
            .${CSS_PREFIX}-status-dot.braking {
                background: #f59e0b;
                box-shadow: 0 0 10px rgba(245, 158, 11, 0.6);
            }
            
            /* ================================================
               KEYBOARD HINTS
               ================================================ */
            .${CSS_PREFIX}-hints {
                padding: 10px 16px;
                background: rgba(0, 0, 0, 0.2);
                border-top: 1px solid #333;
                font-size: 10px;
                color: #555;
                text-align: center;
                line-height: 1.6;
            }
            
            .${CSS_PREFIX}-hint-key {
                display: inline-block;
                padding: 2px 6px;
                background: #333;
                border: 1px solid #444;
                border-radius: 3px;
                margin: 0 2px;
                font-family: 'Consolas', monospace;
                color: #888;
            }
        `;
        document.head.appendChild(this.styleElement);
    }

    // ========================================================================
    // DOM CREATION
    // ========================================================================

    /**
     * Create the panel DOM structure
     */
    private createDOM(): void {
        // Main container
        this.container = document.createElement('div');
        this.container.className = `${CSS_PREFIX}-panel`;

        // ====================================================================
        // TRACK STATUS BANNER (Top - most visible)
        // ====================================================================
        this.trackStatusBanner = document.createElement('div');
        this.trackStatusBanner.className = `${CSS_PREFIX}-track-status off-track`;
        this.trackStatusBanner.innerHTML = '⚠️ NOT ON TRACK';

        // ====================================================================
        // HEADER
        // ====================================================================
        const header = document.createElement('div');
        header.className = `${CSS_PREFIX}-header`;

        const headerLeft = document.createElement('div');
        headerLeft.className = `${CSS_PREFIX}-header-left`;

        const title = document.createElement('div');
        title.className = `${CSS_PREFIX}-title`;
        title.textContent = '🚂 Train Control';

        this.trainNameLabel = document.createElement('div');
        this.trainNameLabel.className = `${CSS_PREFIX}-train-name`;
        this.trainNameLabel.textContent = 'No train';

        headerLeft.appendChild(title);
        headerLeft.appendChild(this.trainNameLabel);

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = `${CSS_PREFIX}-close-btn`;
        closeBtn.innerHTML = '×';
        closeBtn.title = 'Close (ESC)';
        closeBtn.addEventListener('click', () => {
            this.hide();
        });

        header.appendChild(headerLeft);
        header.appendChild(closeBtn);

        // ====================================================================
        // BODY
        // ====================================================================
        const body = document.createElement('div');
        body.className = `${CSS_PREFIX}-body`;

        // --------------------------------------------------------------------
        // Speed Display
        // --------------------------------------------------------------------
        const speedSection = document.createElement('div');
        speedSection.className = `${CSS_PREFIX}-speed-section`;

        this.speedDisplay = document.createElement('div');
        this.speedDisplay.className = `${CSS_PREFIX}-speed-value`;
        this.speedDisplay.textContent = '0';

        const speedUnit = document.createElement('div');
        speedUnit.className = `${CSS_PREFIX}-speed-unit`;
        speedUnit.textContent = '% Speed';

        speedSection.appendChild(this.speedDisplay);
        speedSection.appendChild(speedUnit);

        // --------------------------------------------------------------------
        // Throttle Section
        // --------------------------------------------------------------------
        const throttleSection = document.createElement('div');
        throttleSection.className = `${CSS_PREFIX}-throttle-section`;

        const throttleHeader = document.createElement('div');
        throttleHeader.className = `${CSS_PREFIX}-throttle-header`;

        const throttleLabel = document.createElement('span');
        throttleLabel.className = `${CSS_PREFIX}-label`;
        throttleLabel.textContent = 'Throttle';

        this.throttleValue = document.createElement('span');
        this.throttleValue.className = `${CSS_PREFIX}-throttle-value`;
        this.throttleValue.textContent = '0%';

        throttleHeader.appendChild(throttleLabel);
        throttleHeader.appendChild(this.throttleValue);

        this.throttleSlider = document.createElement('input');
        this.throttleSlider.type = 'range';
        this.throttleSlider.min = '0';
        this.throttleSlider.max = '100';
        this.throttleSlider.value = '0';
        this.throttleSlider.className = `${CSS_PREFIX}-slider`;

        throttleSection.appendChild(throttleHeader);
        throttleSection.appendChild(this.throttleSlider);

        // --------------------------------------------------------------------
        // Control Buttons Grid
        // --------------------------------------------------------------------
        const controls = document.createElement('div');
        controls.className = `${CSS_PREFIX}-controls`;

        this.directionBtn = document.createElement('button');
        this.directionBtn.className = `${CSS_PREFIX}-btn direction forward`;
        this.directionBtn.innerHTML = '<span class="arrow">▲</span> FWD';

        this.brakeBtn = document.createElement('button');
        this.brakeBtn.className = `${CSS_PREFIX}-btn brake`;
        this.brakeBtn.textContent = '🛑 Brake';

        controls.appendChild(this.directionBtn);
        controls.appendChild(this.brakeBtn);

        // --------------------------------------------------------------------
        // Emergency Button
        // --------------------------------------------------------------------
        this.emergencyBtn = document.createElement('button');
        this.emergencyBtn.className = `${CSS_PREFIX}-emergency`;
        this.emergencyBtn.textContent = '⚠️ EMERGENCY STOP';

        // --------------------------------------------------------------------
        // Horn Button
        // --------------------------------------------------------------------
        this.hornBtn = document.createElement('button');
        this.hornBtn.className = `${CSS_PREFIX}-horn`;
        this.hornBtn.textContent = '📯 Horn (H)';

        // ====================================================================
        // STATUS BAR
        // ====================================================================
        const status = document.createElement('div');
        status.className = `${CSS_PREFIX}-status`;

        this.statusIndicator = document.createElement('div');
        this.statusIndicator.className = `${CSS_PREFIX}-status-dot stopped`;

        this.statusText = document.createElement('span');
        this.statusText.textContent = 'Stopped';

        status.appendChild(this.statusIndicator);
        status.appendChild(this.statusText);

        // ====================================================================
        // KEYBOARD HINTS
        // ====================================================================
        const hints = document.createElement('div');
        hints.className = `${CSS_PREFIX}-hints`;
        hints.innerHTML = `
            <span class="${CSS_PREFIX}-hint-key">↑/W</span> Faster
            <span class="${CSS_PREFIX}-hint-key">↓/S</span> Slower
            <span class="${CSS_PREFIX}-hint-key">R</span> Reverse
            <span class="${CSS_PREFIX}-hint-key">Space</span> Brake
        `;

        // ====================================================================
        // ASSEMBLE
        // ====================================================================
        body.appendChild(speedSection);
        body.appendChild(throttleSection);
        body.appendChild(controls);
        body.appendChild(this.emergencyBtn);
        body.appendChild(this.hornBtn);

        this.container.appendChild(this.trackStatusBanner);
        this.container.appendChild(header);
        this.container.appendChild(body);
        this.container.appendChild(status);
        this.container.appendChild(hints);

        document.body.appendChild(this.container);
    }

    // ========================================================================
    // EVENT LISTENERS
    // ========================================================================

    /**
     * Setup UI event listeners
     */
    private setupEventListeners(): void {
        if (!this.container) return;

        // Throttle slider
        this.throttleSlider?.addEventListener('input', (e) => {
            const value = parseInt((e.target as HTMLInputElement).value, 10);
            this.handleThrottleChange(value);
        });

        // Direction button
        this.directionBtn?.addEventListener('click', () => {
            this.handleDirectionToggle();
        });

        // Brake button (hold to brake)
        this.brakeBtn?.addEventListener('mousedown', () => {
            this.handleBrakeStart();
        });

        this.brakeBtn?.addEventListener('mouseup', () => {
            this.handleBrakeEnd();
        });

        this.brakeBtn?.addEventListener('mouseleave', () => {
            this.handleBrakeEnd();
        });

        // Emergency button
        this.emergencyBtn?.addEventListener('click', () => {
            this.handleEmergencyStop();
        });

        // Horn button
        this.hornBtn?.addEventListener('click', () => {
            this.handleHorn();
        });

        // Prevent click events from reaching the canvas
        this.container.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });

        this.container.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
        });

        this.container.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Keyboard handler for ESC to close panel
        this.keydownHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && this.isVisible) {
                e.preventDefault();
                this.hide();
            }
        };
        window.addEventListener('keydown', this.keydownHandler);
    }

    // ========================================================================
    // CONTROL HANDLERS
    // ========================================================================

    /**
     * Handle throttle slider change
     * @param value - Throttle value (0-100)
     */
    private handleThrottleChange(value: number): void {
        if (!this.currentTrain) return;

        const throttle = value / 100;
        this.currentTrain.setThrottle(throttle);

        if (this.throttleValue) {
            this.throttleValue.textContent = `${value}%`;
        }
    }

    /**
     * Handle direction toggle
     */
    private handleDirectionToggle(): void {
        if (!this.currentTrain) return;
        this.currentTrain.toggleDirection();
    }

    /**
     * Handle brake press start
     */
    private handleBrakeStart(): void {
        if (!this.currentTrain) return;
        this.currentTrain.applyBrake();
        this.brakeBtn?.classList.add('active');
    }

    /**
     * Handle brake release
     */
    private handleBrakeEnd(): void {
        if (!this.currentTrain) return;
        this.currentTrain.releaseBrake();
        this.brakeBtn?.classList.remove('active');
    }

    /**
     * Handle emergency stop
     */
    private handleEmergencyStop(): void {
        if (!this.currentTrain) return;
        this.currentTrain.emergencyBrake();

        // Reset throttle slider
        if (this.throttleSlider) {
            this.throttleSlider.value = '0';
        }
        if (this.throttleValue) {
            this.throttleValue.textContent = '0%';
        }
    }

    /**
     * Handle horn button
     */
    private handleHorn(): void {
        if (!this.currentTrain) return;
        this.currentTrain.soundHorn();
    }

    // ========================================================================
    // SELECTION HANDLING
    // ========================================================================

    /**
     * Handle train selection change
     * Note: Panel no longer auto-shows on selection - use showForDriving() instead
     * @param train - Selected train or null
     */
    private handleSelectionChanged(train: TrainController | null): void {
        // If deselected while panel is visible, hide it
        if (!train && this.isVisible) {
            this.hide();
        }

        // Update current train reference but don't auto-show
        // Panel will only show when explicitly called via showForDriving()
        if (train && this.isVisible) {
            // If already showing, update to new train
            this.currentTrain = train;
            this.updateTrainInfo(train);
        }
    }

    /**
     * Show the control panel for driving a specific train
     * Call this when user explicitly chooses to drive (e.g., from selection modal)
     * @param train - The train controller to drive
     */
    public showForDriving(train: TrainController): void {
        this.currentTrain = train;
        this.updateTrainInfo(train);
        this.show();
        console.log(`${LOG_PREFIX} Showing controls for driving: ${train.getInfo().name}`);
    }

    /**
     * Update train info display
     * @param train - Train controller
     */
    private updateTrainInfo(train: TrainController): void {
        const info = train.getInfo();

        if (this.trainNameLabel) {
            this.trainNameLabel.textContent = info.name;
        }

        // Sync throttle slider with current state
        const state = train.getPhysicsState();
        if (this.throttleSlider) {
            this.throttleSlider.value = String(Math.round(state.throttle * 100));
        }
        if (this.throttleValue) {
            this.throttleValue.textContent = `${Math.round(state.throttle * 100)}%`;
        }
    }

    // ========================================================================
    // UPDATE LOOP
    // ========================================================================

    /**
     * Start the display update loop
     */
    private startUpdateLoop(): void {
        this.updateIntervalId = window.setInterval(() => {
            this.updateDisplay();
        }, this.config.updateInterval);
    }

    /**
     * Update the display with current train state
     */
    private updateDisplay(): void {
        if (!this.currentTrain || !this.isVisible) return;

        const trainState = this.currentTrain.getState();
        const physics = this.currentTrain.getPhysicsState();

        // ================================================================
        // UPDATE TRACK STATUS BANNER (most important!)
        // ================================================================
        if (this.trackStatusBanner) {
            if (trainState.isOnTrack) {
                this.trackStatusBanner.className = `${CSS_PREFIX}-track-status on-track`;
                this.trackStatusBanner.innerHTML = '✓ ON TRACK - READY';
            } else {
                this.trackStatusBanner.className = `${CSS_PREFIX}-track-status off-track`;
                this.trackStatusBanner.innerHTML = '⚠️ NOT ON TRACK';
            }
        }

        // ================================================================
        // UPDATE SPEED DISPLAY
        // ================================================================
        if (this.speedDisplay) {
            const speedPercent = Math.round(physics.speedPercent);
            this.speedDisplay.textContent = String(speedPercent);

            // Color coding based on speed
            this.speedDisplay.classList.remove('moving', 'fast');
            if (speedPercent >= 70) {
                this.speedDisplay.classList.add('fast');
            } else if (speedPercent > 0) {
                this.speedDisplay.classList.add('moving');
            }
        }

        // ================================================================
        // UPDATE DIRECTION BUTTON
        // ================================================================
        this.updateDirectionButton(physics.direction);

        // ================================================================
        // UPDATE STATUS INDICATOR
        // ================================================================
        this.updateStatusIndicator(physics);
    }

    /**
     * Update direction button state
     * @param direction - Current direction
     */
    private updateDirectionButton(direction: TrainDirection): void {
        if (!this.directionBtn) return;

        this.directionBtn.classList.remove('forward', 'reverse');

        if (direction === 'forward') {
            this.directionBtn.classList.add('forward');
            this.directionBtn.innerHTML = '<span class="arrow">▲</span> FWD';
        } else if (direction === 'reverse') {
            this.directionBtn.classList.add('reverse');
            this.directionBtn.innerHTML = '<span class="arrow">▼</span> REV';
        } else {
            this.directionBtn.innerHTML = '<span class="arrow">◆</span> STOP';
        }
    }

    /**
     * Update status indicator
     * @param state - Physics state
     */
    private updateStatusIndicator(state: TrainPhysicsState): void {
        if (!this.statusIndicator || !this.statusText) return;

        this.statusIndicator.classList.remove('stopped', 'braking');

        if (state.brakeState === 'applied' || state.brakeState === 'emergency') {
            this.statusIndicator.classList.add('braking');
            this.statusText.textContent = state.brakeState === 'emergency' ? 'EMERGENCY' : 'Braking';
        } else if (state.isStopped) {
            this.statusIndicator.classList.add('stopped');
            this.statusText.textContent = 'Stopped';
        } else if (state.isAccelerating) {
            this.statusText.textContent = 'Accelerating';
        } else if (state.isDecelerating) {
            this.statusText.textContent = 'Coasting';
        } else {
            this.statusText.textContent = 'Running';
        }
    }

    // ========================================================================
    // VISIBILITY
    // ========================================================================

    /**
     * Show the control panel
     */
    show(): void {
        if (this.container && !this.isVisible) {
            this.container.classList.add('visible');
            this.isVisible = true;
        }
    }

    /**
     * Hide the control panel
     */
    hide(): void {
        if (this.container && this.isVisible) {
            this.container.classList.remove('visible');
            this.isVisible = false;
        }
    }

    /**
     * Check if panel is visible
     * @returns true if visible
     */
    getIsVisible(): boolean {
        return this.isVisible;
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Dispose of the control panel
     */
    dispose(): void {
        // Stop update loop
        if (this.updateIntervalId !== null) {
            clearInterval(this.updateIntervalId);
            this.updateIntervalId = null;
        }

        // Remove DOM elements
        if (this.container) {
            this.container.remove();
            this.container = null;
        }

        // Remove styles
        if (this.styleElement) {
            this.styleElement.remove();
            this.styleElement = null;
        }

        // Remove keyboard handler
        if (this.keydownHandler) {
            window.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = null;
        }

        // Clear references
        this.currentTrain = null;
        this.isInitialized = false;
        this.isVisible = false;

        console.log(`${LOG_PREFIX} Disposed`);
    }
}