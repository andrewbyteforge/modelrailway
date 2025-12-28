/**
 * SidebarTransformControls.ts - Position and transform controls for placed models
 * 
 * Path: frontend/src/ui/components/SidebarTransformControls.ts
 * 
 * Provides UI sliders for:
 * - X position (left/right)
 * - Y position (height/up-down)
 * - Z position (forward/backward)
 * - Rotation (degrees)
 * 
 * Integrates with the Models sidebar Settings section.
 * 
 * @module SidebarTransformControls
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import type { ModelSystem, PlacedModel } from '../../systems/models/ModelSystem';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[SidebarTransformControls]';

/** CSS class prefix for styling */
const CSS_PREFIX = 'mrw-transform';

/** Default configuration */
const DEFAULT_CONFIG = {
    /** X/Z position range in meters (±0.6m = ±600mm for typical baseboard) */
    positionRangeXZ: 0.6,
    /** Y position range in meters (0 to 0.1m = 0 to 100mm above rail) */
    positionMinY: -0.05,
    positionMaxY: 0.1,
    /** Position step for fine adjustment (1mm) */
    positionStep: 0.001,
    /** Position step for coarse adjustment (5mm) */
    positionStepCoarse: 0.005,
    /** Rotation range in degrees */
    rotationRange: 180,
    /** Rotation step (degrees) */
    rotationStep: 5,
    /** Fine rotation step (degrees) */
    rotationStepFine: 1,
} as const;

/** Theme colors matching existing UI */
const THEME = {
    bg: '#2d3436',
    bgLight: '#3d4447',
    bgLighter: '#4a5558',
    border: '#636e72',
    text: '#dfe6e9',
    textMuted: '#b2bec3',
    accent: '#0984e3',
    accentHover: '#74b9ff',
    success: '#00b894',
    warning: '#fdcb6e',
    sliderTrack: '#636e72',
    sliderThumb: '#0984e3',
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Transform control configuration
 */
export interface TransformControlsConfig {
    /** X/Z position range in meters */
    positionRangeXZ?: number;
    /** Minimum Y position */
    positionMinY?: number;
    /** Maximum Y position */
    positionMaxY?: number;
    /** Position step size */
    positionStep?: number;
    /** Show rotation control */
    showRotation?: boolean;
    /** Show reset button */
    showReset?: boolean;
}

/**
 * Position change callback
 */
export type PositionChangeCallback = (position: Vector3) => void;

/**
 * Rotation change callback
 */
export type RotationChangeCallback = (rotationDeg: number) => void;

// ============================================================================
// SIDEBAR TRANSFORM CONTROLS CLASS
// ============================================================================

/**
 * SidebarTransformControls - UI component for model position/rotation adjustment
 * 
 * @example
 * ```typescript
 * const controls = new SidebarTransformControls();
 * controls.connectToModelSystem(modelSystem);
 * sidebarSettingsContainer.appendChild(controls.getElement());
 * ```
 */
export class SidebarTransformControls {
    // ========================================================================
    // PRIVATE PROPERTIES
    // ========================================================================

    /** Root container element */
    private container: HTMLElement;

    /** Connected model system */
    private modelSystem: ModelSystem | null = null;

    /** Currently tracked model ID */
    private currentModelId: string | null = null;

    /** Configuration */
    private config: Required<TransformControlsConfig>;

    /** Slider elements for direct access */
    private sliders: {
        x: HTMLInputElement | null;
        y: HTMLInputElement | null;
        z: HTMLInputElement | null;
        rotation: HTMLInputElement | null;
    } = { x: null, y: null, z: null, rotation: null };

    /** Value display elements */
    private valueDisplays: {
        x: HTMLElement | null;
        y: HTMLElement | null;
        z: HTMLElement | null;
        rotation: HTMLElement | null;
    } = { x: null, y: null, z: null, rotation: null };

    /** Position change callback */
    private onPositionChange: PositionChangeCallback | null = null;

    /** Rotation change callback */
    private onRotationChange: RotationChangeCallback | null = null;

    /** Whether to suppress update events (for programmatic updates) */
    private suppressEvents = false;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create new transform controls
     * @param config - Optional configuration
     */
    constructor(config: TransformControlsConfig = {}) {
        this.config = {
            positionRangeXZ: config.positionRangeXZ ?? DEFAULT_CONFIG.positionRangeXZ,
            positionMinY: config.positionMinY ?? DEFAULT_CONFIG.positionMinY,
            positionMaxY: config.positionMaxY ?? DEFAULT_CONFIG.positionMaxY,
            positionStep: config.positionStep ?? DEFAULT_CONFIG.positionStep,
            showRotation: config.showRotation ?? true,
            showReset: config.showReset ?? true,
        };

        this.container = this.createContainer();
        this.injectStyles();

        console.log(`${LOG_PREFIX} Created`);
    }

    // ========================================================================
    // STYLE INJECTION
    // ========================================================================

    /**
     * Inject CSS styles for the controls
     */
    private injectStyles(): void {
        const styleId = `${CSS_PREFIX}-styles`;
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* ============================================
               TRANSFORM CONTROLS CONTAINER
               ============================================ */
            .${CSS_PREFIX}-container {
                padding: 12px;
                background: ${THEME.bg};
                border-radius: 6px;
                font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
                font-size: 12px;
                color: ${THEME.text};
            }

            .${CSS_PREFIX}-title {
                font-size: 13px;
                font-weight: 600;
                color: ${THEME.text};
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .${CSS_PREFIX}-title .icon {
                font-size: 14px;
            }

            /* ============================================
               SLIDER ROW
               ============================================ */
            .${CSS_PREFIX}-row {
                display: flex;
                flex-direction: column;
                gap: 4px;
                margin-bottom: 12px;
            }

            .${CSS_PREFIX}-row:last-child {
                margin-bottom: 0;
            }

            .${CSS_PREFIX}-label {
                display: flex;
                align-items: center;
                justify-content: space-between;
                color: ${THEME.textMuted};
                font-size: 11px;
            }

            .${CSS_PREFIX}-label .axis {
                font-weight: 600;
                color: ${THEME.text};
                min-width: 70px;
            }

            .${CSS_PREFIX}-label .value {
                font-family: 'Monaco', 'Consolas', monospace;
                font-size: 11px;
                color: ${THEME.accent};
                background: ${THEME.bgLight};
                padding: 2px 6px;
                border-radius: 3px;
                min-width: 60px;
                text-align: right;
            }

            /* ============================================
               SLIDER INPUT
               ============================================ */
            .${CSS_PREFIX}-slider-wrapper {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .${CSS_PREFIX}-slider {
                -webkit-appearance: none;
                appearance: none;
                flex: 1;
                height: 6px;
                background: ${THEME.sliderTrack};
                border-radius: 3px;
                outline: none;
                cursor: pointer;
            }

            .${CSS_PREFIX}-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 16px;
                height: 16px;
                background: ${THEME.sliderThumb};
                border-radius: 50%;
                cursor: pointer;
                transition: transform 0.1s, box-shadow 0.1s;
            }

            .${CSS_PREFIX}-slider::-webkit-slider-thumb:hover {
                transform: scale(1.1);
                box-shadow: 0 0 8px ${THEME.accent}80;
            }

            .${CSS_PREFIX}-slider::-moz-range-thumb {
                width: 16px;
                height: 16px;
                background: ${THEME.sliderThumb};
                border: none;
                border-radius: 50%;
                cursor: pointer;
            }

            /* Step buttons */
            .${CSS_PREFIX}-step-btn {
                width: 24px;
                height: 24px;
                background: ${THEME.bgLight};
                border: 1px solid ${THEME.border};
                border-radius: 4px;
                color: ${THEME.text};
                font-size: 14px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.15s, border-color 0.15s;
            }

            .${CSS_PREFIX}-step-btn:hover {
                background: ${THEME.bgLighter};
                border-color: ${THEME.accent};
            }

            .${CSS_PREFIX}-step-btn:active {
                background: ${THEME.accent};
            }

            /* ============================================
               RESET BUTTON
               ============================================ */
            .${CSS_PREFIX}-reset-btn {
                width: 100%;
                padding: 8px 12px;
                margin-top: 8px;
                background: ${THEME.bgLight};
                border: 1px solid ${THEME.border};
                border-radius: 4px;
                color: ${THEME.text};
                font-size: 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                transition: background 0.15s, border-color 0.15s;
            }

            .${CSS_PREFIX}-reset-btn:hover {
                background: ${THEME.bgLighter};
                border-color: ${THEME.warning};
            }

            /* ============================================
               NO SELECTION MESSAGE
               ============================================ */
            .${CSS_PREFIX}-no-selection {
                text-align: center;
                padding: 16px;
                color: ${THEME.textMuted};
                font-style: italic;
            }

            /* ============================================
               DISABLED STATE
               ============================================ */
            .${CSS_PREFIX}-container.disabled {
                opacity: 0.5;
                pointer-events: none;
            }
        `;

        document.head.appendChild(style);
    }

    // ========================================================================
    // UI CREATION
    // ========================================================================

    /**
     * Create the main container with all controls
     */
    private createContainer(): HTMLElement {
        const container = document.createElement('div');
        container.className = `${CSS_PREFIX}-container`;

        // Title
        const title = document.createElement('div');
        title.className = `${CSS_PREFIX}-title`;
        title.innerHTML = `<span class="icon">📐</span> Position & Transform`;
        container.appendChild(title);

        // X Position (Left/Right)
        container.appendChild(this.createSliderRow(
            'x',
            'X (Left/Right)',
            -this.config.positionRangeXZ,
            this.config.positionRangeXZ,
            this.config.positionStep,
            0,
            'mm'
        ));

        // Y Position (Height above baseboard)
        container.appendChild(this.createSliderRow(
            'y',
            'Height (↑↓)',
            this.config.positionMinY,
            this.config.positionMaxY,
            this.config.positionStep,
            0.958, // Default to rail top height
            'mm',
            this.config.positionMinY,
            this.config.positionMaxY
        ));

        // Z Position (Forward/Backward)
        container.appendChild(this.createSliderRow(
            'z',
            'Z (Fwd/Back)',
            -this.config.positionRangeXZ,
            this.config.positionRangeXZ,
            this.config.positionStep,
            0,
            'mm'
        ));

        // Rotation (if enabled)
        if (this.config.showRotation) {
            container.appendChild(this.createSliderRow(
                'rotation',
                'Rotation',
                -this.config.positionRangeXZ * 1000, // Dummy range, will be overridden
                this.config.positionRangeXZ * 1000,
                DEFAULT_CONFIG.rotationStep,
                0,
                '°',
                -180,
                180
            ));
        }

        // Reset button (if enabled)
        if (this.config.showReset) {
            const resetBtn = document.createElement('button');
            resetBtn.className = `${CSS_PREFIX}-reset-btn`;
            resetBtn.innerHTML = `<span>↺</span> Reset Position`;
            resetBtn.addEventListener('click', () => this.resetPosition());
            container.appendChild(resetBtn);
        }

        return container;
    }

    /**
     * Create a slider row with label, slider, and step buttons
     */
    private createSliderRow(
        axis: 'x' | 'y' | 'z' | 'rotation',
        label: string,
        min: number,
        max: number,
        step: number,
        defaultValue: number,
        unit: string,
        overrideMin?: number,
        overrideMax?: number
    ): HTMLElement {
        const row = document.createElement('div');
        row.className = `${CSS_PREFIX}-row`;

        // Label with value display
        const labelRow = document.createElement('div');
        labelRow.className = `${CSS_PREFIX}-label`;

        const axisLabel = document.createElement('span');
        axisLabel.className = 'axis';
        axisLabel.textContent = label;
        labelRow.appendChild(axisLabel);

        const valueDisplay = document.createElement('span');
        valueDisplay.className = 'value';
        valueDisplay.textContent = this.formatValue(defaultValue, axis, unit);
        labelRow.appendChild(valueDisplay);
        this.valueDisplays[axis] = valueDisplay;

        row.appendChild(labelRow);

        // Slider wrapper with step buttons
        const sliderWrapper = document.createElement('div');
        sliderWrapper.className = `${CSS_PREFIX}-slider-wrapper`;

        // Minus button
        const minusBtn = document.createElement('button');
        minusBtn.className = `${CSS_PREFIX}-step-btn`;
        minusBtn.textContent = '−';
        minusBtn.title = `Decrease ${label}`;
        minusBtn.addEventListener('click', () => this.stepValue(axis, -step));
        sliderWrapper.appendChild(minusBtn);

        // Slider
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = `${CSS_PREFIX}-slider`;
        slider.min = String(overrideMin ?? min);
        slider.max = String(overrideMax ?? max);
        slider.step = String(step);
        slider.value = String(defaultValue);

        slider.addEventListener('input', () => {
            const value = parseFloat(slider.value);
            this.updateValueDisplay(axis, value, unit);
            if (!this.suppressEvents) {
                this.handleSliderChange(axis, value);
            }
        });

        sliderWrapper.appendChild(slider);
        this.sliders[axis] = slider;

        // Plus button
        const plusBtn = document.createElement('button');
        plusBtn.className = `${CSS_PREFIX}-step-btn`;
        plusBtn.textContent = '+';
        plusBtn.title = `Increase ${label}`;
        plusBtn.addEventListener('click', () => this.stepValue(axis, step));
        sliderWrapper.appendChild(plusBtn);

        row.appendChild(sliderWrapper);

        return row;
    }

    // ========================================================================
    // VALUE HANDLING
    // ========================================================================

    /**
     * Format a value for display
     */
    private formatValue(value: number, axis: string, unit: string): string {
        if (axis === 'rotation') {
            return `${value.toFixed(1)}${unit}`;
        }

        if (axis === 'y') {
            // For Y, show height relative to baseboard (0.95m)
            const BASEBOARD_HEIGHT = 0.95;
            const relativeHeight = (value - BASEBOARD_HEIGHT) * 1000; // Convert to mm above baseboard
            return `${relativeHeight.toFixed(1)}${unit}`;
        }

        // For X/Z, convert meters to millimeters for display
        const mm = value * 1000;
        return `${mm.toFixed(1)}${unit}`;
    }

    /**
     * Update the value display
     */
    private updateValueDisplay(axis: 'x' | 'y' | 'z' | 'rotation', value: number, unit: string): void {
        const display = this.valueDisplays[axis];
        if (display) {
            display.textContent = this.formatValue(value, axis, unit);
        }
    }

    /**
     * Step a value by the given amount
     */
    private stepValue(axis: 'x' | 'y' | 'z' | 'rotation', delta: number): void {
        const slider = this.sliders[axis];
        if (!slider) return;

        const current = parseFloat(slider.value);
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        const newValue = Math.max(min, Math.min(max, current + delta));

        slider.value = String(newValue);
        this.updateValueDisplay(axis, newValue, axis === 'rotation' ? '°' : 'mm');
        this.handleSliderChange(axis, newValue);
    }

    /**
     * Handle slider value change
     */
    private handleSliderChange(axis: 'x' | 'y' | 'z' | 'rotation', value: number): void {
        if (!this.modelSystem || !this.currentModelId) return;

        const model = this.modelSystem.getPlacedModel(this.currentModelId);
        if (!model) return;

        if (axis === 'rotation') {
            // Handle rotation
            this.modelSystem.rotateModel(this.currentModelId, value);
            if (this.onRotationChange) {
                this.onRotationChange(value);
            }
            console.log(`${LOG_PREFIX} Rotation changed: ${value.toFixed(1)}°`);
        } else {
            // Handle position
            const currentPos = model.position.clone();

            switch (axis) {
                case 'x':
                    currentPos.x = value;
                    break;
                case 'y':
                    currentPos.y = value;
                    break;
                case 'z':
                    currentPos.z = value;
                    break;
            }

            this.modelSystem.moveModel(this.currentModelId, currentPos);

            if (this.onPositionChange) {
                this.onPositionChange(currentPos);
            }

            console.log(`${LOG_PREFIX} Position changed: (${currentPos.x.toFixed(3)}, ${currentPos.y.toFixed(3)}, ${currentPos.z.toFixed(3)})`);
        }
    }

    /**
     * Reset position to center/origin
     */
    private resetPosition(): void {
        if (!this.modelSystem || !this.currentModelId) return;

        const model = this.modelSystem.getPlacedModel(this.currentModelId);
        if (!model) return;

        // Reset to center of baseboard, at rail height
        // BASEBOARD_TOP = 0.950, RAIL_TOP_OFFSET = 0.008
        const BASEBOARD_TOP = 0.95;
        const RAIL_TOP_OFFSET = 0.008;
        const railTopY = BASEBOARD_TOP + RAIL_TOP_OFFSET; // 0.958

        const newPos = new Vector3(0, railTopY, 0);

        this.modelSystem.moveModel(this.currentModelId, newPos);
        this.updateFromModel(model);

        console.log(`${LOG_PREFIX} Position reset to center at rail height (Y=${railTopY})`);
    }

    // ========================================================================
    // MODEL SYSTEM CONNECTION
    // ========================================================================

    /**
     * Connect to a ModelSystem instance
     * @param modelSystem - ModelSystem to connect to
     */
    connectToModelSystem(modelSystem: ModelSystem): void {
        this.modelSystem = modelSystem;
        console.log(`${LOG_PREFIX} Connected to ModelSystem`);

        // Setup selection change listener
        // Note: This would need to be called by the external code when selection changes
    }

    /**
     * Update controls when a model is selected
     * @param modelId - Selected model instance ID
     */
    setSelectedModel(modelId: string | null): void {
        this.currentModelId = modelId;

        if (!modelId || !this.modelSystem) {
            this.container.classList.add('disabled');
            return;
        }

        const model = this.modelSystem.getPlacedModel(modelId);
        if (!model) {
            this.container.classList.add('disabled');
            return;
        }

        this.container.classList.remove('disabled');
        this.updateFromModel(model);
    }

    /**
     * Update slider values from a model
     */
    private updateFromModel(model: PlacedModel): void {
        this.suppressEvents = true;

        try {
            // Update position sliders
            if (this.sliders.x) {
                this.sliders.x.value = String(model.position.x);
                this.updateValueDisplay('x', model.position.x, 'mm');
            }

            if (this.sliders.y) {
                this.sliders.y.value = String(model.position.y);
                this.updateValueDisplay('y', model.position.y, 'mm');
            }

            if (this.sliders.z) {
                this.sliders.z.value = String(model.position.z);
                this.updateValueDisplay('z', model.position.z, 'mm');
            }

            // Update rotation slider (need to get rotation from model)
            if (this.sliders.rotation && model.rotation) {
                // Convert quaternion to Y rotation in degrees
                const euler = model.rotation.toEulerAngles();
                const yRotDeg = euler.y * (180 / Math.PI);
                this.sliders.rotation.value = String(yRotDeg);
                this.updateValueDisplay('rotation', yRotDeg, '°');
            }
        } finally {
            this.suppressEvents = false;
        }
    }

    /**
     * Refresh the controls to match current model state
     * Call this after external changes to the model
     */
    refresh(): void {
        if (this.currentModelId && this.modelSystem) {
            const model = this.modelSystem.getPlacedModel(this.currentModelId);
            if (model) {
                this.updateFromModel(model);
            }
        }
    }

    // ========================================================================
    // CALLBACKS
    // ========================================================================

    /**
     * Set callback for position changes
     */
    setOnPositionChange(callback: PositionChangeCallback): void {
        this.onPositionChange = callback;
    }

    /**
     * Set callback for rotation changes
     */
    setOnRotationChange(callback: RotationChangeCallback): void {
        this.onRotationChange = callback;
    }

    // ========================================================================
    // PUBLIC ACCESSORS
    // ========================================================================

    /**
     * Get the root element for adding to DOM
     */
    getElement(): HTMLElement {
        return this.container;
    }

    /**
     * Enable or disable the controls
     */
    setEnabled(enabled: boolean): void {
        if (enabled) {
            this.container.classList.remove('disabled');
        } else {
            this.container.classList.add('disabled');
        }
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.container.remove();
        this.modelSystem = null;
        this.currentModelId = null;
        console.log(`${LOG_PREFIX} Disposed`);
    }
}