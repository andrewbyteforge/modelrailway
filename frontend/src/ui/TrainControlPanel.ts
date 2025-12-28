/**
 * TrainControlPanel.ts - UI panel for controlling trains
 * 
 * Path: frontend/src/ui/TrainControlPanel.ts
 * 
 * A floating control panel that appears when a train is selected:
 * - Throttle slider/display
 * - Direction indicator and toggle
 * - Brake button
 * - Horn button
 * - Speed display
 * - Train name display
 * 
 * Designed to look like a simplified DCC controller.
 * 
 * @module TrainControlPanel
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { TrainSystem } from '../systems/train/TrainSystem';
import type { TrainController } from '../systems/train/TrainController';
import type { TrainState } from '../systems/train/TrainController';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[TrainControlPanel]';

/** Panel dimensions */
const PANEL_WIDTH = 200;
const PANEL_HEIGHT = 320;

// ============================================================================
// TRAIN CONTROL PANEL CLASS
// ============================================================================

/**
 * TrainControlPanel - Floating UI for train control
 * 
 * Displays when a train is selected and provides interactive controls.
 * 
 * @example
 * ```typescript
 * const panel = new TrainControlPanel(trainSystem);
 * panel.initialize();
 * ```
 */
export class TrainControlPanel {
    // ========================================================================
    // PRIVATE STATE
    // ========================================================================

    /** Train system reference */
    private trainSystem: TrainSystem;

    /** Main container element */
    private container: HTMLElement | null = null;

    /** Throttle slider element */
    private throttleSlider: HTMLInputElement | null = null;

    /** Speed display element */
    private speedDisplay: HTMLElement | null = null;

    /** Direction indicator element */
    private directionDisplay: HTMLElement | null = null;

    /** Train name display */
    private nameDisplay: HTMLElement | null = null;

    /** Brake button */
    private brakeButton: HTMLButtonElement | null = null;

    /** Currently displayed train */
    private currentTrain: TrainController | null = null;

    /** Update interval ID */
    private updateInterval: number | null = null;

    /** Is panel visible */
    private isVisible: boolean = false;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new TrainControlPanel
     * @param trainSystem - Train system reference
     */
    constructor(trainSystem: TrainSystem) {
        this.trainSystem = trainSystem;
        console.log(`${LOG_PREFIX} Control panel created`);
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the control panel
     * Creates DOM elements and sets up event listeners
     */
    initialize(): void {
        this.createPanelDOM();
        this.setupSystemListeners();

        // Start hidden
        this.hide();

        console.log(`${LOG_PREFIX} ✓ Initialized`);
    }

    /**
     * Create the panel DOM structure
     */
    private createPanelDOM(): void {
        // Main container
        this.container = document.createElement('div');
        this.container.id = 'train-control-panel';
        this.container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: ${PANEL_WIDTH}px;
            background: linear-gradient(145deg, #2a2a2a, #1a1a1a);
            border: 2px solid #444;
            border-radius: 12px;
            padding: 16px;
            font-family: 'Segoe UI', Arial, sans-serif;
            color: #fff;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            z-index: 1000;
            user-select: none;
        `;

        // Build panel content
        this.container.innerHTML = `
            <!-- Header -->
            <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid #444;
            ">
                <span style="font-size: 18px;">🚂</span>
                <span id="train-name" style="
                    font-weight: 600;
                    font-size: 14px;
                    color: #4CAF50;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    max-width: 140px;
                ">No Train Selected</span>
            </div>
            
            <!-- Speed Display -->
            <div style="
                text-align: center;
                margin-bottom: 16px;
            ">
                <div id="speed-display" style="
                    font-size: 48px;
                    font-weight: 700;
                    font-family: 'Courier New', monospace;
                    color: #4CAF50;
                    text-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
                ">0</div>
                <div style="
                    font-size: 11px;
                    color: #888;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                ">% Throttle</div>
            </div>
            
            <!-- Direction Indicator -->
            <div style="
                display: flex;
                justify-content: center;
                gap: 8px;
                margin-bottom: 16px;
            ">
                <button id="dir-reverse" style="
                    padding: 8px 16px;
                    background: #333;
                    border: 1px solid #555;
                    border-radius: 4px;
                    color: #888;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.2s;
                ">◀ REV</button>
                <div id="direction-display" style="
                    padding: 8px 12px;
                    background: #333;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #888;
                    min-width: 50px;
                    text-align: center;
                ">STOP</div>
                <button id="dir-forward" style="
                    padding: 8px 16px;
                    background: #333;
                    border: 1px solid #555;
                    border-radius: 4px;
                    color: #888;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.2s;
                ">FWD ▶</button>
            </div>
            
            <!-- Throttle Slider -->
            <div style="margin-bottom: 16px;">
                <label style="
                    display: block;
                    font-size: 11px;
                    color: #888;
                    margin-bottom: 4px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                ">Throttle</label>
                <input type="range" id="throttle-slider" min="0" max="100" value="0" style="
                    width: 100%;
                    height: 8px;
                    border-radius: 4px;
                    background: #333;
                    outline: none;
                    cursor: pointer;
                    accent-color: #4CAF50;
                ">
            </div>
            
            <!-- Control Buttons -->
            <div style="
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
                margin-bottom: 12px;
            ">
                <button id="brake-btn" style="
                    padding: 12px;
                    background: linear-gradient(145deg, #d32f2f, #b71c1c);
                    border: none;
                    border-radius: 6px;
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 13px;
                    transition: all 0.2s;
                    box-shadow: 0 2px 8px rgba(211, 47, 47, 0.3);
                ">🛑 BRAKE</button>
                <button id="horn-btn" style="
                    padding: 12px;
                    background: linear-gradient(145deg, #FFC107, #FF9800);
                    border: none;
                    border-radius: 6px;
                    color: #333;
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 13px;
                    transition: all 0.2s;
                    box-shadow: 0 2px 8px rgba(255, 193, 7, 0.3);
                ">📯 HORN</button>
            </div>
            
            <!-- Status Bar -->
            <div style="
                font-size: 10px;
                color: #666;
                text-align: center;
                padding-top: 8px;
                border-top: 1px solid #333;
            ">
                <span>↑↓ Throttle</span> · 
                <span>R Direction</span> · 
                <span>Space Brake</span> · 
                <span>H Horn</span>
            </div>
        `;

        // Add to document
        document.body.appendChild(this.container);

        // Get references to interactive elements
        this.nameDisplay = this.container.querySelector('#train-name');
        this.speedDisplay = this.container.querySelector('#speed-display');
        this.directionDisplay = this.container.querySelector('#direction-display');
        this.throttleSlider = this.container.querySelector('#throttle-slider');
        this.brakeButton = this.container.querySelector('#brake-btn');

        // Setup button handlers
        this.setupButtonHandlers();
    }

    /**
     * Setup button click handlers
     */
    private setupButtonHandlers(): void {
        if (!this.container) return;

        // Throttle slider
        this.throttleSlider?.addEventListener('input', (e) => {
            const value = parseInt((e.target as HTMLInputElement).value) / 100;
            if (this.currentTrain) {
                this.currentTrain.setThrottle(value);
            }
        });

        // Direction buttons
        const fwdBtn = this.container.querySelector('#dir-forward') as HTMLButtonElement;
        const revBtn = this.container.querySelector('#dir-reverse') as HTMLButtonElement;

        fwdBtn?.addEventListener('click', () => {
            if (this.currentTrain) {
                this.currentTrain.setDirection('forward');
            }
        });

        revBtn?.addEventListener('click', () => {
            if (this.currentTrain) {
                this.currentTrain.setDirection('reverse');
            }
        });

        // Brake button
        const brakeBtn = this.container.querySelector('#brake-btn') as HTMLButtonElement;
        brakeBtn?.addEventListener('mousedown', () => {
            if (this.currentTrain) {
                this.currentTrain.applyBrake();
                brakeBtn.style.transform = 'scale(0.95)';
            }
        });
        brakeBtn?.addEventListener('mouseup', () => {
            if (this.currentTrain) {
                this.currentTrain.releaseBrake();
                brakeBtn.style.transform = 'scale(1)';
            }
        });
        brakeBtn?.addEventListener('mouseleave', () => {
            if (this.currentTrain) {
                this.currentTrain.releaseBrake();
                brakeBtn.style.transform = 'scale(1)';
            }
        });

        // Horn button
        const hornBtn = this.container.querySelector('#horn-btn') as HTMLButtonElement;
        hornBtn?.addEventListener('click', () => {
            if (this.currentTrain) {
                this.currentTrain.soundHorn();
            }
        });
    }

    /**
     * Setup listeners for train system events
     */
    private setupSystemListeners(): void {
        // Listen for selection changes
        this.trainSystem.onSelectionChanged.add((train) => {
            if (train) {
                this.showForTrain(train);
            } else {
                this.hide();
            }
        });
    }

    // ========================================================================
    // DISPLAY CONTROL
    // ========================================================================

    /**
     * Show panel for a specific train
     * @param train - Train controller to display
     */
    showForTrain(train: TrainController): void {
        this.currentTrain = train;
        this.isVisible = true;

        if (this.container) {
            this.container.style.display = 'block';
        }

        // Update train name
        if (this.nameDisplay) {
            this.nameDisplay.textContent = train.getInfo().name;
        }

        // Start update loop
        this.startUpdateLoop();

        // Initial update
        this.updateDisplay();
    }

    /**
     * Hide the panel
     */
    hide(): void {
        this.currentTrain = null;
        this.isVisible = false;

        if (this.container) {
            this.container.style.display = 'none';
        }

        // Stop update loop
        this.stopUpdateLoop();
    }

    /**
     * Start the display update loop
     */
    private startUpdateLoop(): void {
        if (this.updateInterval) return;

        this.updateInterval = window.setInterval(() => {
            this.updateDisplay();
        }, 50); // 20 FPS update
    }

    /**
     * Stop the display update loop
     */
    private stopUpdateLoop(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * Update the display with current train state
     */
    private updateDisplay(): void {
        if (!this.currentTrain || !this.isVisible) return;

        const state = this.currentTrain.getState();
        const physics = state.physics;

        // Update speed display
        if (this.speedDisplay) {
            const speedPercent = Math.round(physics.throttle * 100);
            this.speedDisplay.textContent = speedPercent.toString();

            // Color based on speed
            if (speedPercent > 75) {
                this.speedDisplay.style.color = '#f44336'; // Red
            } else if (speedPercent > 50) {
                this.speedDisplay.style.color = '#FFC107'; // Yellow
            } else {
                this.speedDisplay.style.color = '#4CAF50'; // Green
            }
        }

        // Update throttle slider (if not being dragged)
        if (this.throttleSlider && document.activeElement !== this.throttleSlider) {
            this.throttleSlider.value = Math.round(physics.throttle * 100).toString();
        }

        // Update direction display
        if (this.directionDisplay) {
            let dirText = 'STOP';
            let dirColor = '#888';

            if (physics.direction === 'forward') {
                dirText = 'FWD';
                dirColor = '#4CAF50';
            } else if (physics.direction === 'reverse') {
                dirText = 'REV';
                dirColor = '#2196F3';
            }

            if (physics.brakeState !== 'released') {
                dirText = 'BRAKE';
                dirColor = '#f44336';
            }

            this.directionDisplay.textContent = dirText;
            this.directionDisplay.style.color = dirColor;
        }

        // Update direction buttons
        const fwdBtn = this.container?.querySelector('#dir-forward') as HTMLButtonElement;
        const revBtn = this.container?.querySelector('#dir-reverse') as HTMLButtonElement;

        if (fwdBtn) {
            if (physics.direction === 'forward') {
                fwdBtn.style.background = '#4CAF50';
                fwdBtn.style.color = '#fff';
            } else {
                fwdBtn.style.background = '#333';
                fwdBtn.style.color = '#888';
            }
        }

        if (revBtn) {
            if (physics.direction === 'reverse') {
                revBtn.style.background = '#2196F3';
                revBtn.style.color = '#fff';
            } else {
                revBtn.style.background = '#333';
                revBtn.style.color = '#888';
            }
        }
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Dispose of the control panel
     */
    dispose(): void {
        this.stopUpdateLoop();

        if (this.container) {
            this.container.remove();
            this.container = null;
        }

        this.currentTrain = null;

        console.log(`${LOG_PREFIX} Disposed`);
    }
}