/**
 * SidebarScaleControls.ts - Compact scale and height controls for sidebar settings
 * 
 * Path: frontend/src/ui/components/SidebarScaleControls.ts
 * 
 * A compact control panel designed to fit in the UIManager sidebar settings.
 * Provides:
 * - Scale: slider, input, and preset buttons (0.25% - 100%)
 * - Height: slider for Y-position adjustment (lift/lower models)
 * 
 * SCALE RANGE: 0.25% to 100%
 * - MIN_SCALE_PERCENT = 0.25
 * - MAX_SCALE_PERCENT = 100
 * 
 * @module SidebarScaleControls
 * @author Model Railway Workbench
 * @version 3.0.0 - Updated scale range to 0.25%-100%
 */

import type { ScaleManager } from '../../systems/scaling/ScaleManager';
import type { ScaleEvent } from '../../types/scaling.types';
import { GLOBAL_SCALE_LIMITS } from '../../systems/scaling/ScaleConstraints';

// ============================================================================
// CONSTANTS
// ============================================================================

const LOG_PREFIX = '[SidebarScaleControls]';

/** Minimum scale as percentage (0.25%) */
const MIN_SCALE_PERCENT = GLOBAL_SCALE_LIMITS.MIN_PERCENT;

/** Maximum scale as percentage (100%) */
const MAX_SCALE_PERCENT = GLOBAL_SCALE_LIMITS.MAX_PERCENT;

/** Minimum scale as factor (0.0025) */
const MIN_SCALE_FACTOR = GLOBAL_SCALE_LIMITS.MIN_SCALE;

/** Maximum scale as factor (1.0) */
const MAX_SCALE_FACTOR = GLOBAL_SCALE_LIMITS.MAX_SCALE;

/** Minimum height offset in mm (can go below table surface) */
const MIN_HEIGHT_MM = -50;

/** Maximum height offset in mm */
const MAX_HEIGHT_MM = 200;

/** Height step for keyboard shortcuts in mm */
const HEIGHT_STEP_MM = 5;

/** Fine height step (with Shift) in mm */
const HEIGHT_FINE_STEP_MM = 1;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Callback for height changes */
export type HeightChangeCallback = (objectId: string, heightOffset: number) => void;

// ============================================================================
// SIDEBAR SCALE CONTROLS CLASS
// ============================================================================

/**
 * SidebarScaleControls - Compact scale & height UI for sidebar integration
 * 
 * Scale range: 0.25% to 100%
 */
export class SidebarScaleControls {
    // ========================================================================
    // PROPERTIES
    // ========================================================================

    /** Scale manager reference */
    private scaleManager: ScaleManager | null = null;

    /** Root container element */
    private container: HTMLElement;

    // Scale controls
    private scaleSlider: HTMLInputElement | null = null;
    private scaleInput: HTMLInputElement | null = null;
    private presetsRow: HTMLElement | null = null;
    private resetBtn: HTMLButtonElement | null = null;
    private lockBtn: HTMLButtonElement | null = null;

    // Height controls
    private heightSlider: HTMLInputElement | null = null;
    private heightInput: HTMLInputElement | null = null;
    private heightResetBtn: HTMLButtonElement | null = null;
    private snapToTableBtn: HTMLButtonElement | null = null;

    /** No selection message */
    private noSelectionMsg: HTMLElement | null = null;

    /** Controls wrapper (hidden when no selection) */
    private controlsWrapper: HTMLElement | null = null;

    /** Currently selected object ID */
    private selectedObjectId: string | null = null;

    /** Current scale value (0.0025 to 1.0) */
    private currentScale: number = 1.0;

    /** Current height offset in meters */
    private currentHeightOffset: number = 0;

    /** Whether scale is locked */
    private isLocked: boolean = false;

    /** Event listener cleanup */
    private cleanupListener: (() => void) | null = null;

    /** Callback for height changes */
    private onHeightChange: HeightChangeCallback | null = null;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    constructor() {
        this.container = this.createUI();
        console.log(`${LOG_PREFIX} Created`);
        console.log(`${LOG_PREFIX} Scale range: ${MIN_SCALE_PERCENT}% - ${MAX_SCALE_PERCENT}%`);
    }

    // ========================================================================
    // UI CREATION
    // ========================================================================

    private createUI(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.className = 'sidebar-transform-controls';
        wrapper.style.cssText = `
            padding: 12px 0;
            border-top: 1px solid rgba(255,255,255,0.1);
            margin-top: 8px;
        `;

        // Header row with icon
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 10px;
            color: #e0e0e0;
            font-size: 13px;
        `;
        header.innerHTML = `
            <span style="opacity: 0.7;">🔧</span>
            <span>Model Transform</span>
        `;
        wrapper.appendChild(header);

        // No selection message
        this.noSelectionMsg = document.createElement('div');
        this.noSelectionMsg.style.cssText = `
            color: #888;
            font-size: 11px;
            font-style: italic;
            padding: 8px 0;
        `;
        this.noSelectionMsg.textContent = 'Select a model to adjust';
        wrapper.appendChild(this.noSelectionMsg);

        // Controls wrapper (hidden until selection)
        this.controlsWrapper = document.createElement('div');
        this.controlsWrapper.style.display = 'none';
        wrapper.appendChild(this.controlsWrapper);

        // ================================================================
        // SCALE SECTION
        // ================================================================
        this.createScaleSection();

        // ================================================================
        // HEIGHT SECTION
        // ================================================================
        this.createHeightSection();

        // ================================================================
        // KEYBOARD HINTS
        // ================================================================
        const hints = document.createElement('div');
        hints.style.cssText = `
            margin-top: 12px;
            padding-top: 8px;
            border-top: 1px solid rgba(255,255,255,0.05);
            font-size: 10px;
            color: #666;
        `;
        hints.innerHTML = `
            <div style="margin-bottom: 4px;"><kbd style="background:#333;padding:2px 4px;border-radius:2px;font-size:9px;">S</kbd> + Scroll = Scale</div>
            <div style="margin-bottom: 4px;"><kbd style="background:#333;padding:2px 4px;border-radius:2px;font-size:9px;">H</kbd> + Scroll = Height</div>
            <div><kbd style="background:#333;padding:2px 4px;border-radius:2px;font-size:9px;">PgUp</kbd>/<kbd style="background:#333;padding:2px 4px;border-radius:2px;font-size:9px;">PgDn</kbd> = Height ±5mm</div>
        `;
        this.controlsWrapper.appendChild(hints);

        return wrapper;
    }

    /**
     * Create the scale controls section
     * Uses a non-linear slider for better control at small values
     */
    private createScaleSection(): void {
        // Scale label with range info
        const scaleLabel = document.createElement('div');
        scaleLabel.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 6px;
            margin-bottom: 6px;
            color: #aaa;
            font-size: 11px;
        `;
        scaleLabel.innerHTML = `
            <span><span style="margin-right: 4px;">📐</span>Scale</span>
            <span style="font-size: 9px; color: #666;">${MIN_SCALE_PERCENT}% - ${MAX_SCALE_PERCENT}%</span>
        `;
        this.controlsWrapper!.appendChild(scaleLabel);

        // Slider row
        const sliderRow = document.createElement('div');
        sliderRow.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        `;

        // Create slider - uses 0-100 range internally, mapped non-linearly to scale
        this.scaleSlider = document.createElement('input');
        this.scaleSlider.type = 'range';
        this.scaleSlider.min = '0';
        this.scaleSlider.max = '100';
        this.scaleSlider.step = '0.1';
        this.scaleSlider.value = '100'; // 100% by default
        this.scaleSlider.style.cssText = `
            flex: 1;
            height: 4px;
            border-radius: 2px;
            -webkit-appearance: none;
            appearance: none;
            background: linear-gradient(to right, #444 0%, #666 100%);
            outline: none;
            cursor: pointer;
        `;

        // Scale input field
        this.scaleInput = document.createElement('input');
        this.scaleInput.type = 'text';
        this.scaleInput.value = '100%';
        this.scaleInput.style.cssText = `
            width: 52px;
            padding: 4px 6px;
            border: 1px solid #555;
            border-radius: 4px;
            background: #333;
            color: #fff;
            font-size: 11px;
            text-align: center;
        `;

        sliderRow.appendChild(this.scaleSlider);
        sliderRow.appendChild(this.scaleInput);
        this.controlsWrapper!.appendChild(sliderRow);

        // Preset buttons row - updated for 0.25% - 100% range
        this.presetsRow = document.createElement('div');
        this.presetsRow.style.cssText = `
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
            margin-bottom: 8px;
        `;

        // Presets appropriate for 0.25% - 100% range
        const presets = [
            { label: '1%', value: 0.01 },
            { label: '5%', value: 0.05 },
            { label: '10%', value: 0.10 },
            { label: '25%', value: 0.25 },
            { label: '50%', value: 0.50 },
            { label: '100%', value: 1.0 }
        ];

        presets.forEach(preset => {
            const btn = document.createElement('button');
            btn.textContent = preset.label;
            btn.style.cssText = `
                padding: 3px 8px;
                font-size: 10px;
                border: 1px solid #555;
                border-radius: 3px;
                background: #333;
                color: #ccc;
                cursor: pointer;
                transition: all 0.15s ease;
            `;
            btn.addEventListener('click', () => this.setScale(preset.value));
            btn.addEventListener('mouseenter', () => {
                if (!this.isLocked) {
                    btn.style.background = '#444';
                    btn.style.color = '#fff';
                }
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = '#333';
                btn.style.color = '#ccc';
            });
            this.presetsRow!.appendChild(btn);
        });

        this.controlsWrapper!.appendChild(this.presetsRow);

        // Action buttons row
        const actionsRow = document.createElement('div');
        actionsRow.style.cssText = `
            display: flex;
            gap: 6px;
            margin-bottom: 12px;
        `;

        this.resetBtn = document.createElement('button');
        this.resetBtn.innerHTML = '↺ Reset';
        this.resetBtn.style.cssText = `
            flex: 1;
            padding: 5px 8px;
            font-size: 11px;
            border: none;
            border-radius: 4px;
            background: #555;
            color: #fff;
            cursor: pointer;
            transition: all 0.15s ease;
        `;
        this.resetBtn.addEventListener('click', () => this.resetScale());
        this.resetBtn.addEventListener('mouseenter', () => {
            this.resetBtn!.style.background = '#666';
        });
        this.resetBtn.addEventListener('mouseleave', () => {
            this.resetBtn!.style.background = '#555';
        });

        this.lockBtn = document.createElement('button');
        this.lockBtn.innerHTML = '🔓';
        this.lockBtn.title = 'Lock/unlock scale';
        this.lockBtn.style.cssText = `
            padding: 5px 10px;
            font-size: 12px;
            border: none;
            border-radius: 4px;
            background: #555;
            color: #fff;
            cursor: pointer;
            transition: all 0.15s ease;
        `;
        this.lockBtn.addEventListener('click', () => this.toggleLock());

        actionsRow.appendChild(this.resetBtn);
        actionsRow.appendChild(this.lockBtn);
        this.controlsWrapper!.appendChild(actionsRow);

        // Attach scale input handlers
        this.attachScaleInputHandlers();
    }

    /**
     * Create the height controls section
     */
    private createHeightSection(): void {
        // Height label
        const heightLabel = document.createElement('div');
        heightLabel.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 6px;
            color: #aaa;
            font-size: 11px;
        `;
        heightLabel.innerHTML = `<span>↕️</span><span>Height Offset</span>`;
        this.controlsWrapper!.appendChild(heightLabel);

        // Height slider row
        const heightRow = document.createElement('div');
        heightRow.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        `;

        this.heightSlider = document.createElement('input');
        this.heightSlider.type = 'range';
        this.heightSlider.min = String(MIN_HEIGHT_MM);
        this.heightSlider.max = String(MAX_HEIGHT_MM);
        this.heightSlider.value = '0';
        this.heightSlider.style.cssText = `
            flex: 1;
            height: 4px;
            border-radius: 2px;
            -webkit-appearance: none;
            appearance: none;
            background: linear-gradient(to right, #444 0%, #666 100%);
            outline: none;
            cursor: pointer;
        `;

        this.heightInput = document.createElement('input');
        this.heightInput.type = 'text';
        this.heightInput.value = '0mm';
        this.heightInput.style.cssText = `
            width: 52px;
            padding: 4px 6px;
            border: 1px solid #555;
            border-radius: 4px;
            background: #333;
            color: #fff;
            font-size: 11px;
            text-align: center;
        `;

        heightRow.appendChild(this.heightSlider);
        heightRow.appendChild(this.heightInput);
        this.controlsWrapper!.appendChild(heightRow);

        // Height action buttons
        const heightActionsRow = document.createElement('div');
        heightActionsRow.style.cssText = `
            display: flex;
            gap: 6px;
        `;

        this.snapToTableBtn = document.createElement('button');
        this.snapToTableBtn.innerHTML = '⬇ Snap to Table';
        this.snapToTableBtn.title = 'Place model directly on table surface';
        this.snapToTableBtn.style.cssText = `
            flex: 1;
            padding: 5px 8px;
            font-size: 11px;
            border: none;
            border-radius: 4px;
            background: #2d6a4f;
            color: #fff;
            cursor: pointer;
            transition: all 0.15s ease;
        `;
        this.snapToTableBtn.addEventListener('click', () => this.snapToTable());
        this.snapToTableBtn.addEventListener('mouseenter', () => {
            this.snapToTableBtn!.style.background = '#40916c';
        });
        this.snapToTableBtn.addEventListener('mouseleave', () => {
            this.snapToTableBtn!.style.background = '#2d6a4f';
        });

        this.heightResetBtn = document.createElement('button');
        this.heightResetBtn.innerHTML = '↺';
        this.heightResetBtn.title = 'Reset height to default';
        this.heightResetBtn.style.cssText = `
            padding: 5px 10px;
            font-size: 12px;
            border: none;
            border-radius: 4px;
            background: #555;
            color: #fff;
            cursor: pointer;
            transition: all 0.15s ease;
        `;
        this.heightResetBtn.addEventListener('click', () => this.resetHeight());
        this.heightResetBtn.addEventListener('mouseenter', () => {
            this.heightResetBtn!.style.background = '#666';
        });
        this.heightResetBtn.addEventListener('mouseleave', () => {
            this.heightResetBtn!.style.background = '#555';
        });

        heightActionsRow.appendChild(this.snapToTableBtn);
        heightActionsRow.appendChild(this.heightResetBtn);
        this.controlsWrapper!.appendChild(heightActionsRow);

        // Attach height input handlers
        this.attachHeightInputHandlers();
    }

    // ========================================================================
    // SCALE SLIDER MAPPING (Non-linear for better small value control)
    // ========================================================================

    /**
     * Convert slider position (0-100) to scale factor (0.0025-1.0)
     * Uses a power curve for better control at small values
     */
    private sliderToScale(sliderValue: number): number {
        // Map 0-100 slider to 0.0025-1.0 scale using power curve
        const normalized = sliderValue / 100; // 0 to 1

        // Power curve gives more precision at low end
        // scale = minScale + (maxScale - minScale) * normalized^2
        const scale = MIN_SCALE_FACTOR + (MAX_SCALE_FACTOR - MIN_SCALE_FACTOR) * Math.pow(normalized, 2);

        return Math.max(MIN_SCALE_FACTOR, Math.min(MAX_SCALE_FACTOR, scale));
    }

    /**
     * Convert scale factor (0.0025-1.0) to slider position (0-100)
     */
    private scaleToSlider(scale: number): number {
        // Inverse of power curve
        const normalized = Math.sqrt((scale - MIN_SCALE_FACTOR) / (MAX_SCALE_FACTOR - MIN_SCALE_FACTOR));
        return Math.max(0, Math.min(100, normalized * 100));
    }

    // ========================================================================
    // INPUT HANDLERS
    // ========================================================================

    /**
     * Attach event handlers for scale inputs
     */
    private attachScaleInputHandlers(): void {
        // Slider change - uses non-linear mapping
        this.scaleSlider?.addEventListener('input', () => {
            if (this.isLocked) return;
            const sliderValue = parseFloat(this.scaleSlider!.value);
            const scaleFactor = this.sliderToScale(sliderValue);
            this.setScale(scaleFactor);
        });

        // Input field change - direct percentage input
        this.scaleInput?.addEventListener('change', () => {
            if (this.isLocked) return;
            const text = this.scaleInput!.value.replace('%', '').trim();
            const percent = parseFloat(text);
            if (!isNaN(percent)) {
                // Clamp to valid range
                const clamped = Math.max(MIN_SCALE_PERCENT, Math.min(MAX_SCALE_PERCENT, percent));
                const scaleFactor = clamped / 100;
                this.setScale(scaleFactor);
            } else {
                // Invalid input - restore display
                this.updateScaleDisplay();
            }
        });

        this.scaleInput?.addEventListener('focus', () => {
            this.scaleInput?.select();
        });
    }

    /**
     * Attach event handlers for height inputs
     */
    private attachHeightInputHandlers(): void {
        // Slider change
        this.heightSlider?.addEventListener('input', () => {
            const mm = parseInt(this.heightSlider!.value, 10);
            this.setHeightOffset(mm / 1000); // Convert mm to meters
        });

        // Input field change
        this.heightInput?.addEventListener('change', () => {
            const text = this.heightInput!.value.replace('mm', '').trim();
            const mm = parseFloat(text);
            if (!isNaN(mm)) {
                const clamped = Math.max(MIN_HEIGHT_MM, Math.min(MAX_HEIGHT_MM, mm));
                this.setHeightOffset(clamped / 1000); // Convert mm to meters
            } else {
                this.updateHeightDisplay();
            }
        });

        this.heightInput?.addEventListener('focus', () => {
            this.heightInput?.select();
        });
    }

    // ========================================================================
    // SCALE MANAGER CONNECTION
    // ========================================================================

    /**
     * Connect to a ScaleManager instance
     */
    public setScaleManager(scaleManager: ScaleManager): void {
        // Remove previous listener if any
        if (this.cleanupListener) {
            this.cleanupListener();
        }

        this.scaleManager = scaleManager;

        // Listen to scale events
        const listener = (event: ScaleEvent) => {
            switch (event.type) {
                case 'scale-commit':
                case 'scale-preview':
                    if (event.objectId === this.selectedObjectId && event.scale !== undefined) {
                        this.currentScale = event.scale;
                        this.updateScaleDisplay();
                    }
                    break;

                case 'scale-reset':
                    if (event.objectId === this.selectedObjectId) {
                        this.currentScale = 1.0;
                        this.updateScaleDisplay();
                    }
                    break;

                case 'lock-changed':
                    if (event.objectId === this.selectedObjectId) {
                        this.isLocked = event.data?.locked as boolean || false;
                        this.updateLockButton();
                    }
                    break;
            }
        };

        this.scaleManager.addEventListener(listener);
        this.cleanupListener = () => {
            this.scaleManager?.removeEventListener(listener);
        };

        console.log(`${LOG_PREFIX} Connected to ScaleManager`);
    }

    /**
     * Set callback for height changes
     */
    public setHeightChangeCallback(callback: HeightChangeCallback): void {
        this.onHeightChange = callback;
    }

    // ========================================================================
    // SELECTION HANDLING
    // ========================================================================

    /**
     * Called when a model is selected
     */
    public onObjectSelected(
        objectId: string,
        currentScale: number = 1.0,
        isLocked: boolean = false,
        heightOffset: number = 0
    ): void {
        this.selectedObjectId = objectId;
        this.currentScale = currentScale;
        this.isLocked = isLocked;
        this.currentHeightOffset = heightOffset;

        // Show controls, hide message
        if (this.noSelectionMsg) this.noSelectionMsg.style.display = 'none';
        if (this.controlsWrapper) this.controlsWrapper.style.display = 'block';

        this.updateScaleDisplay();
        this.updateHeightDisplay();
        this.updateLockButton();

        console.log(`${LOG_PREFIX} Object selected: ${objectId} (scale: ${(currentScale * 100).toFixed(1)}%)`);
    }

    /**
     * Called when selection is cleared
     */
    public onObjectDeselected(): void {
        this.selectedObjectId = null;
        this.currentScale = 1.0;
        this.currentHeightOffset = 0;
        this.isLocked = false;

        // Hide controls, show message
        if (this.noSelectionMsg) this.noSelectionMsg.style.display = 'block';
        if (this.controlsWrapper) this.controlsWrapper.style.display = 'none';

        console.log(`${LOG_PREFIX} Object deselected`);
    }

    // ========================================================================
    // SCALE OPERATIONS
    // ========================================================================

    /**
     * Set the scale factor (0.0025 to 1.0)
     */
    private setScale(scaleFactor: number): void {
        if (!this.scaleManager || !this.selectedObjectId || this.isLocked) return;

        // Clamp to valid range
        const clamped = Math.max(MIN_SCALE_FACTOR, Math.min(MAX_SCALE_FACTOR, scaleFactor));

        this.currentScale = clamped;
        this.scaleManager.setScale(this.selectedObjectId, clamped);
        this.updateScaleDisplay();
    }

    /**
     * Reset scale to 100%
     */
    private resetScale(): void {
        if (!this.scaleManager || !this.selectedObjectId) return;
        this.scaleManager.resetScale(this.selectedObjectId);
    }

    /**
     * Toggle scale lock
     */
    private toggleLock(): void {
        if (!this.scaleManager || !this.selectedObjectId) return;
        this.scaleManager.toggleLock(this.selectedObjectId);
    }

    // ========================================================================
    // HEIGHT OPERATIONS
    // ========================================================================

    /**
     * Set height offset in meters
     */
    private setHeightOffset(heightMeters: number): void {
        if (!this.selectedObjectId) return;

        this.currentHeightOffset = heightMeters;
        this.updateHeightDisplay();

        // Notify callback
        if (this.onHeightChange) {
            this.onHeightChange(this.selectedObjectId, heightMeters);
        }
    }

    /**
     * Reset height to 0
     */
    private resetHeight(): void {
        this.setHeightOffset(0);
    }

    /**
     * Snap model to table surface
     */
    private snapToTable(): void {
        this.setHeightOffset(0);
    }

    /**
     * Adjust height by delta (called from keyboard handler)
     * @param deltaMM - Height change in millimeters (positive = up)
     */
    public adjustHeight(deltaMM: number): void {
        if (!this.selectedObjectId) return;

        const currentMM = this.currentHeightOffset * 1000;
        const newMM = Math.max(MIN_HEIGHT_MM, Math.min(MAX_HEIGHT_MM, currentMM + deltaMM));
        this.setHeightOffset(newMM / 1000);
    }

    /**
     * Update height from external source
     */
    public updateHeight(heightMeters: number): void {
        this.currentHeightOffset = heightMeters;
        this.updateHeightDisplay();
    }

    // ========================================================================
    // DISPLAY UPDATES
    // ========================================================================

    /**
     * Update scale display elements
     */
    private updateScaleDisplay(): void {
        const percent = this.currentScale * 100;

        // Update slider using non-linear mapping
        if (this.scaleSlider) {
            this.scaleSlider.value = String(this.scaleToSlider(this.currentScale));
            this.scaleSlider.disabled = this.isLocked;
        }

        // Update input field with percentage
        if (this.scaleInput) {
            // Format based on value
            if (percent < 1) {
                this.scaleInput.value = `${percent.toFixed(2)}%`;
            } else if (percent < 10) {
                this.scaleInput.value = `${percent.toFixed(1)}%`;
            } else {
                this.scaleInput.value = `${percent.toFixed(0)}%`;
            }
            this.scaleInput.disabled = this.isLocked;
        }
    }

    /**
     * Update height display elements
     */
    private updateHeightDisplay(): void {
        const mm = Math.round(this.currentHeightOffset * 1000);

        if (this.heightSlider) {
            this.heightSlider.value = String(Math.max(MIN_HEIGHT_MM, Math.min(MAX_HEIGHT_MM, mm)));
        }

        if (this.heightInput) {
            this.heightInput.value = `${mm}mm`;
        }
    }

    /**
     * Update lock button appearance
     */
    private updateLockButton(): void {
        if (!this.lockBtn) return;

        if (this.isLocked) {
            this.lockBtn.innerHTML = '🔒';
            this.lockBtn.style.background = '#c9a227';
            this.lockBtn.style.color = '#000';
        } else {
            this.lockBtn.innerHTML = '🔓';
            this.lockBtn.style.background = '#555';
            this.lockBtn.style.color = '#fff';
        }
    }

    // ========================================================================
    // PUBLIC ACCESSORS
    // ========================================================================

    /**
     * Get the root element for insertion into sidebar
     */
    public getElement(): HTMLElement {
        return this.container;
    }

    /**
     * Get the currently selected object ID
     */
    public getSelectedObjectId(): string | null {
        return this.selectedObjectId;
    }

    /**
     * Get the current scale factor
     */
    public getCurrentScale(): number {
        return this.currentScale;
    }

    /**
     * Get the current scale as percentage
     */
    public getCurrentScalePercent(): number {
        return this.currentScale * 100;
    }

    // ========================================================================
    // DISPOSAL
    // ========================================================================

    public dispose(): void {
        if (this.cleanupListener) {
            this.cleanupListener();
            this.cleanupListener = null;
        }

        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }

        console.log(`${LOG_PREFIX} Disposed`);
    }
}