/**
 * EmbeddedScaleControls.ts - Scale controls for sidebar settings integration
 * 
 * Path: frontend/src/ui/components/EmbeddedScaleControls.ts
 * 
 * A compact scale control panel designed to be embedded into the Models sidebar
 * settings section. Provides:
 * - Scale slider (6% to 500%)
 * - Numeric input
 * - Preset buttons
 * - Reset button
 * - Lock toggle
 * 
 * @module EmbeddedScaleControls
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import type { ScaleManager } from '../../systems/scaling/ScaleManager';
import type { ScaleEvent, ScalePreset } from '../../types/scaling.types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[EmbeddedScaleControls]';

/** Minimum scale as percentage */
const MIN_SCALE_PERCENT = 6;

/** Maximum scale as percentage */
const MAX_SCALE_PERCENT = 500;

/** Default presets when no category-specific ones available */
const DEFAULT_PRESETS: ScalePreset[] = [
    { id: 'tiny', name: '10%', scaleFactor: 0.1, icon: '🔍' },
    { id: 'small', name: '50%', scaleFactor: 0.5, icon: '📉' },
    { id: 'normal', name: '100%', scaleFactor: 1.0, icon: '📊' },
    { id: 'large', name: '150%', scaleFactor: 1.5, icon: '📈' },
    { id: 'huge', name: '200%', scaleFactor: 2.0, icon: '🔎' }
];

// ============================================================================
// STYLES
// ============================================================================

const STYLES = {
    container: `
        background: rgba(255, 255, 255, 0.05);
        border-radius: 6px;
        padding: 12px;
        margin-top: 8px;
    `,
    header: `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
    `,
    title: `
        font-weight: 600;
        font-size: 13px;
        color: #e0e0e0;
    `,
    noSelection: `
        color: #888;
        font-size: 12px;
        font-style: italic;
        text-align: center;
        padding: 16px;
    `,
    sliderRow: `
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
    `,
    slider: `
        flex: 1;
        height: 6px;
        border-radius: 3px;
        -webkit-appearance: none;
        appearance: none;
        background: linear-gradient(to right, #444 0%, #666 100%);
        outline: none;
        cursor: pointer;
    `,
    input: `
        width: 60px;
        padding: 4px 8px;
        border: 1px solid #555;
        border-radius: 4px;
        background: #333;
        color: #fff;
        font-size: 12px;
        text-align: center;
    `,
    presetsRow: `
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
        margin-bottom: 10px;
    `,
    presetBtn: `
        padding: 4px 8px;
        font-size: 11px;
        border: 1px solid #555;
        border-radius: 4px;
        background: #333;
        color: #ccc;
        cursor: pointer;
        transition: all 0.15s ease;
    `,
    presetBtnActive: `
        background: #4a7c4a;
        border-color: #5a9c5a;
        color: #fff;
    `,
    actionsRow: `
        display: flex;
        gap: 8px;
    `,
    actionBtn: `
        flex: 1;
        padding: 6px 10px;
        font-size: 12px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
    `,
    resetBtn: `
        background: #555;
        color: #fff;
    `,
    lockBtn: `
        background: #555;
        color: #fff;
    `,
    lockBtnActive: `
        background: #c9a227;
        color: #000;
    `,
    statusText: `
        font-size: 11px;
        color: #888;
        margin-top: 8px;
        text-align: center;
    `
} as const;

// ============================================================================
// EMBEDDED SCALE CONTROLS CLASS
// ============================================================================

/**
 * EmbeddedScaleControls - Compact scale UI for sidebar integration
 * 
 * @example
 * ```typescript
 * const controls = new EmbeddedScaleControls(scaleManager);
 * settingsContainer.appendChild(controls.getElement());
 * ```
 */
export class EmbeddedScaleControls {
    // ========================================================================
    // PROPERTIES
    // ========================================================================

    /** Scale manager reference */
    private scaleManager: ScaleManager;

    /** Root container element */
    private container: HTMLElement | null = null;

    /** Content wrapper (shown when object selected) */
    private contentWrapper: HTMLElement | null = null;

    /** No selection message */
    private noSelectionMsg: HTMLElement | null = null;

    /** Scale slider */
    private slider: HTMLInputElement | null = null;

    /** Scale input field */
    private input: HTMLInputElement | null = null;

    /** Reset button */
    private resetBtn: HTMLButtonElement | null = null;

    /** Lock toggle button */
    private lockBtn: HTMLButtonElement | null = null;

    /** Preset buttons container */
    private presetsContainer: HTMLElement | null = null;

    /** Status text element */
    private statusText: HTMLElement | null = null;

    /** Currently selected object ID */
    private selectedObjectId: string | null = null;

    /** Current scale value */
    private currentScale: number = 1.0;

    /** Whether scale is locked */
    private isLocked: boolean = false;

    /** Event listener cleanup function */
    private cleanupListener: (() => void) | null = null;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create embedded scale controls
     * @param scaleManager - ScaleManager instance to control
     */
    constructor(scaleManager: ScaleManager) {
        this.scaleManager = scaleManager;
        this.createUI();
        this.attachEventListeners();
        console.log(`${LOG_PREFIX} Created`);
    }

    // ========================================================================
    // UI CREATION
    // ========================================================================

    /**
     * Create the UI elements
     */
    private createUI(): void {
        // Main container
        this.container = document.createElement('div');
        this.container.className = 'scale-controls-embedded';
        this.container.style.cssText = STYLES.container;

        // Header
        const header = document.createElement('div');
        header.style.cssText = STYLES.header;
        header.innerHTML = `<span style="${STYLES.title}">📐 Scale</span>`;
        this.container.appendChild(header);

        // No selection message
        this.noSelectionMsg = document.createElement('div');
        this.noSelectionMsg.style.cssText = STYLES.noSelection;
        this.noSelectionMsg.textContent = 'Select a model to adjust scale';
        this.container.appendChild(this.noSelectionMsg);

        // Content wrapper (hidden until selection)
        this.contentWrapper = document.createElement('div');
        this.contentWrapper.style.display = 'none';
        this.container.appendChild(this.contentWrapper);

        // Slider row
        const sliderRow = document.createElement('div');
        sliderRow.style.cssText = STYLES.sliderRow;

        this.slider = document.createElement('input');
        this.slider.type = 'range';
        this.slider.min = String(MIN_SCALE_PERCENT);
        this.slider.max = String(MAX_SCALE_PERCENT);
        this.slider.value = '100';
        this.slider.style.cssText = STYLES.slider;

        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.value = '100%';
        this.input.style.cssText = STYLES.input;

        sliderRow.appendChild(this.slider);
        sliderRow.appendChild(this.input);
        this.contentWrapper.appendChild(sliderRow);

        // Presets row
        this.presetsContainer = document.createElement('div');
        this.presetsContainer.style.cssText = STYLES.presetsRow;
        this.renderPresets(DEFAULT_PRESETS);
        this.contentWrapper.appendChild(this.presetsContainer);

        // Actions row
        const actionsRow = document.createElement('div');
        actionsRow.style.cssText = STYLES.actionsRow;

        this.resetBtn = document.createElement('button');
        this.resetBtn.style.cssText = STYLES.actionBtn + STYLES.resetBtn;
        this.resetBtn.innerHTML = '↺ Reset';
        this.resetBtn.title = 'Reset to original scale';

        this.lockBtn = document.createElement('button');
        this.lockBtn.style.cssText = STYLES.actionBtn + STYLES.lockBtn;
        this.lockBtn.innerHTML = '🔓 Unlocked';
        this.lockBtn.title = 'Toggle scale lock';

        actionsRow.appendChild(this.resetBtn);
        actionsRow.appendChild(this.lockBtn);
        this.contentWrapper.appendChild(actionsRow);

        // Status text
        this.statusText = document.createElement('div');
        this.statusText.style.cssText = STYLES.statusText;
        this.statusText.textContent = 'S + Scroll to scale';
        this.contentWrapper.appendChild(this.statusText);

        // Attach input handlers
        this.attachInputHandlers();
    }

    /**
     * Render preset buttons
     */
    private renderPresets(presets: ScalePreset[]): void {
        if (!this.presetsContainer) return;

        this.presetsContainer.innerHTML = '';

        for (const preset of presets) {
            const btn = document.createElement('button');
            btn.style.cssText = STYLES.presetBtn;
            btn.textContent = preset.name;
            btn.title = preset.description || `Set scale to ${(preset.scaleFactor * 100).toFixed(0)}%`;

            btn.addEventListener('click', () => {
                if (!this.isLocked && this.selectedObjectId) {
                    this.setScale(preset.scaleFactor);
                }
            });

            btn.addEventListener('mouseenter', () => {
                if (!this.isLocked) {
                    btn.style.background = '#4a4a4a';
                    btn.style.color = '#fff';
                }
            });

            btn.addEventListener('mouseleave', () => {
                btn.style.cssText = STYLES.presetBtn;
                this.updatePresetHighlight();
            });

            this.presetsContainer.appendChild(btn);
        }
    }

    /**
     * Update preset button highlighting based on current scale
     */
    private updatePresetHighlight(): void {
        if (!this.presetsContainer) return;

        const buttons = this.presetsContainer.querySelectorAll('button');
        buttons.forEach((btn) => {
            const text = btn.textContent || '';
            const match = text.match(/(\d+)%/);
            if (match) {
                const presetPercent = parseInt(match[1], 10);
                const currentPercent = Math.round(this.currentScale * 100);

                if (Math.abs(presetPercent - currentPercent) < 3) {
                    btn.style.cssText = STYLES.presetBtn + STYLES.presetBtnActive;
                } else {
                    btn.style.cssText = STYLES.presetBtn;
                }
            }
        });
    }

    /**
     * Attach input handlers to slider and input field
     */
    private attachInputHandlers(): void {
        // Slider change
        this.slider?.addEventListener('input', () => {
            if (this.isLocked) return;
            const percent = parseInt(this.slider!.value, 10);
            this.setScale(percent / 100);
        });

        // Input field change
        this.input?.addEventListener('change', () => {
            if (this.isLocked) return;
            const text = this.input!.value.replace('%', '').trim();
            const percent = parseFloat(text);
            if (!isNaN(percent)) {
                const clamped = Math.max(MIN_SCALE_PERCENT, Math.min(MAX_SCALE_PERCENT, percent));
                this.setScale(clamped / 100);
            } else {
                this.updateDisplay();
            }
        });

        this.input?.addEventListener('focus', () => {
            this.input?.select();
        });

        // Reset button
        this.resetBtn?.addEventListener('click', () => {
            if (this.selectedObjectId) {
                this.scaleManager.resetScale(this.selectedObjectId);
            }
        });

        // Lock button
        this.lockBtn?.addEventListener('click', () => {
            if (this.selectedObjectId) {
                this.scaleManager.toggleLock(this.selectedObjectId);
            }
        });
    }

    // ========================================================================
    // EVENT LISTENERS
    // ========================================================================

    /**
     * Attach to ScaleManager events
     */
    private attachEventListeners(): void {
        const listener = (event: ScaleEvent) => {
            switch (event.type) {
                case 'scale-commit':
                case 'scale-preview':
                    if (event.objectId === this.selectedObjectId && event.scale !== undefined) {
                        this.currentScale = event.scale;
                        this.updateDisplay();
                    }
                    break;

                case 'scale-reset':
                    if (event.objectId === this.selectedObjectId) {
                        this.currentScale = 1.0;
                        this.updateDisplay();
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
            this.scaleManager.removeEventListener(listener);
        };
    }

    // ========================================================================
    // DISPLAY UPDATES
    // ========================================================================

    /**
     * Update UI elements to reflect current scale
     */
    private updateDisplay(): void {
        const percent = Math.round(this.currentScale * 100);

        if (this.slider) {
            this.slider.value = String(Math.max(MIN_SCALE_PERCENT, Math.min(MAX_SCALE_PERCENT, percent)));
        }

        if (this.input) {
            this.input.value = `${percent}%`;
        }

        this.updatePresetHighlight();
    }

    /**
     * Update lock button appearance
     */
    private updateLockButton(): void {
        if (!this.lockBtn) return;

        if (this.isLocked) {
            this.lockBtn.innerHTML = '🔒 Locked';
            this.lockBtn.style.cssText = STYLES.actionBtn + STYLES.lockBtnActive;
            if (this.slider) this.slider.disabled = true;
            if (this.input) this.input.disabled = true;
        } else {
            this.lockBtn.innerHTML = '🔓 Unlocked';
            this.lockBtn.style.cssText = STYLES.actionBtn + STYLES.lockBtn;
            if (this.slider) this.slider.disabled = false;
            if (this.input) this.input.disabled = false;
        }
    }

    // ========================================================================
    // SCALE OPERATIONS
    // ========================================================================

    /**
     * Set scale for currently selected object
     */
    private setScale(scaleFactor: number): void {
        if (!this.selectedObjectId || this.isLocked) return;

        this.currentScale = scaleFactor;
        this.scaleManager.setScale(this.selectedObjectId, scaleFactor);
        this.updateDisplay();
    }

    // ========================================================================
    // SELECTION HANDLING
    // ========================================================================

    /**
     * Called when an object is selected
     * @param objectId - ID of selected object
     * @param currentScale - Current scale of the object
     * @param isLocked - Whether scale is locked
     */
    public onObjectSelected(objectId: string, currentScale: number = 1.0, isLocked: boolean = false): void {
        this.selectedObjectId = objectId;
        this.currentScale = currentScale;
        this.isLocked = isLocked;

        // Show content, hide "no selection"
        if (this.noSelectionMsg) this.noSelectionMsg.style.display = 'none';
        if (this.contentWrapper) this.contentWrapper.style.display = 'block';

        this.updateDisplay();
        this.updateLockButton();

        console.log(`${LOG_PREFIX} Object selected: ${objectId} at ${(currentScale * 100).toFixed(1)}%`);
    }

    /**
     * Called when selection is cleared
     */
    public onObjectDeselected(): void {
        this.selectedObjectId = null;
        this.currentScale = 1.0;
        this.isLocked = false;

        // Hide content, show "no selection"
        if (this.noSelectionMsg) this.noSelectionMsg.style.display = 'block';
        if (this.contentWrapper) this.contentWrapper.style.display = 'none';

        console.log(`${LOG_PREFIX} Object deselected`);
    }

    // ========================================================================
    // PUBLIC ACCESSORS
    // ========================================================================

    /**
     * Get the root element for insertion into sidebar
     */
    public getElement(): HTMLElement {
        return this.container!;
    }

    /**
     * Update the available presets (called when category changes)
     */
    public setPresets(presets: ScalePreset[]): void {
        this.renderPresets(presets.length > 0 ? presets : DEFAULT_PRESETS);
    }

    // ========================================================================
    // DISPOSAL
    // ========================================================================

    /**
     * Clean up resources
     */
    public dispose(): void {
        if (this.cleanupListener) {
            this.cleanupListener();
            this.cleanupListener = null;
        }

        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }

        this.container = null;
        this.contentWrapper = null;
        this.noSelectionMsg = null;
        this.slider = null;
        this.input = null;
        this.resetBtn = null;
        this.lockBtn = null;
        this.presetsContainer = null;
        this.statusText = null;

        console.log(`${LOG_PREFIX} Disposed`);
    }
}