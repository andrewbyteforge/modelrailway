/**
 * SidebarScaleControls.ts - Compact scale controls for sidebar settings
 * 
 * Path: frontend/src/ui/components/SidebarScaleControls.ts
 * 
 * A compact scale control designed to fit in the UIManager sidebar settings.
 * Provides slider, input, and preset buttons in a minimal footprint.
 * 
 * @module SidebarScaleControls
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import type { ScaleManager } from '../../systems/scaling/ScaleManager';
import type { ScaleEvent } from '../../types/scaling.types';

// ============================================================================
// CONSTANTS
// ============================================================================

const LOG_PREFIX = '[SidebarScaleControls]';

/** Minimum scale as percentage */
const MIN_SCALE_PERCENT = 6;

/** Maximum scale as percentage */
const MAX_SCALE_PERCENT = 500;

// ============================================================================
// SIDEBAR SCALE CONTROLS CLASS
// ============================================================================

/**
 * SidebarScaleControls - Compact scale UI for sidebar integration
 */
export class SidebarScaleControls {
    // ========================================================================
    // PROPERTIES
    // ========================================================================

    /** Scale manager reference */
    private scaleManager: ScaleManager | null = null;

    /** Root container element */
    private container: HTMLElement;

    /** Scale slider */
    private slider: HTMLInputElement | null = null;

    /** Scale input field */
    private input: HTMLInputElement | null = null;

    /** Preset buttons container */
    private presetsRow: HTMLElement | null = null;

    /** Reset button */
    private resetBtn: HTMLButtonElement | null = null;

    /** Lock button */
    private lockBtn: HTMLButtonElement | null = null;

    /** No selection message */
    private noSelectionMsg: HTMLElement | null = null;

    /** Controls wrapper (hidden when no selection) */
    private controlsWrapper: HTMLElement | null = null;

    /** Currently selected object ID */
    private selectedObjectId: string | null = null;

    /** Current scale value */
    private currentScale: number = 1.0;

    /** Whether scale is locked */
    private isLocked: boolean = false;

    /** Event listener cleanup */
    private cleanupListener: (() => void) | null = null;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    constructor() {
        this.container = this.createUI();
        console.log(`${LOG_PREFIX} Created`);
    }

    // ========================================================================
    // UI CREATION
    // ========================================================================

    private createUI(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.className = 'sidebar-scale-controls';
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
            <span style="opacity: 0.7;">📐</span>
            <span>Model Scale</span>
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
        this.noSelectionMsg.textContent = 'Select a model to adjust scale';
        wrapper.appendChild(this.noSelectionMsg);

        // Controls wrapper (hidden until selection)
        this.controlsWrapper = document.createElement('div');
        this.controlsWrapper.style.display = 'none';
        wrapper.appendChild(this.controlsWrapper);

        // Slider row
        const sliderRow = document.createElement('div');
        sliderRow.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 10px;
        `;

        this.slider = document.createElement('input');
        this.slider.type = 'range';
        this.slider.min = String(MIN_SCALE_PERCENT);
        this.slider.max = String(MAX_SCALE_PERCENT);
        this.slider.value = '100';
        this.slider.style.cssText = `
            flex: 1;
            height: 4px;
            border-radius: 2px;
            -webkit-appearance: none;
            appearance: none;
            background: linear-gradient(to right, #444 0%, #666 100%);
            outline: none;
            cursor: pointer;
        `;

        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.value = '100%';
        this.input.style.cssText = `
            width: 52px;
            padding: 4px 6px;
            border: 1px solid #555;
            border-radius: 4px;
            background: #333;
            color: #fff;
            font-size: 11px;
            text-align: center;
        `;

        sliderRow.appendChild(this.slider);
        sliderRow.appendChild(this.input);
        this.controlsWrapper.appendChild(sliderRow);

        // Preset buttons row
        this.presetsRow = document.createElement('div');
        this.presetsRow.style.cssText = `
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
            margin-bottom: 10px;
        `;

        const presets = [
            { label: '50%', value: 0.5 },
            { label: '75%', value: 0.75 },
            { label: '100%', value: 1.0 },
            { label: '150%', value: 1.5 },
            { label: '200%', value: 2.0 }
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

        this.controlsWrapper.appendChild(this.presetsRow);

        // Action buttons row
        const actionsRow = document.createElement('div');
        actionsRow.style.cssText = `
            display: flex;
            gap: 6px;
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
        this.controlsWrapper.appendChild(actionsRow);

        // Attach input handlers
        this.attachInputHandlers();

        return wrapper;
    }

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
            this.scaleManager?.removeEventListener(listener);
        };

        console.log(`${LOG_PREFIX} Connected to ScaleManager`);
    }

    // ========================================================================
    // SELECTION HANDLING
    // ========================================================================

    /**
     * Called when a model is selected
     */
    public onObjectSelected(objectId: string, currentScale: number = 1.0, isLocked: boolean = false): void {
        this.selectedObjectId = objectId;
        this.currentScale = currentScale;
        this.isLocked = isLocked;

        // Show controls, hide message
        if (this.noSelectionMsg) this.noSelectionMsg.style.display = 'none';
        if (this.controlsWrapper) this.controlsWrapper.style.display = 'block';

        this.updateDisplay();
        this.updateLockButton();

        console.log(`${LOG_PREFIX} Object selected: ${objectId}`);
    }

    /**
     * Called when selection is cleared
     */
    public onObjectDeselected(): void {
        this.selectedObjectId = null;
        this.currentScale = 1.0;
        this.isLocked = false;

        // Hide controls, show message
        if (this.noSelectionMsg) this.noSelectionMsg.style.display = 'block';
        if (this.controlsWrapper) this.controlsWrapper.style.display = 'none';

        console.log(`${LOG_PREFIX} Object deselected`);
    }

    // ========================================================================
    // SCALE OPERATIONS
    // ========================================================================

    private setScale(scaleFactor: number): void {
        if (!this.scaleManager || !this.selectedObjectId || this.isLocked) return;

        this.currentScale = scaleFactor;
        this.scaleManager.setScale(this.selectedObjectId, scaleFactor);
        this.updateDisplay();
    }

    private resetScale(): void {
        if (!this.scaleManager || !this.selectedObjectId) return;
        this.scaleManager.resetScale(this.selectedObjectId);
    }

    private toggleLock(): void {
        if (!this.scaleManager || !this.selectedObjectId) return;
        this.scaleManager.toggleLock(this.selectedObjectId);
    }

    // ========================================================================
    // DISPLAY UPDATES
    // ========================================================================

    private updateDisplay(): void {
        const percent = Math.round(this.currentScale * 100);

        if (this.slider) {
            this.slider.value = String(Math.max(MIN_SCALE_PERCENT, Math.min(MAX_SCALE_PERCENT, percent)));
            this.slider.disabled = this.isLocked;
        }

        if (this.input) {
            this.input.value = `${percent}%`;
            this.input.disabled = this.isLocked;
        }
    }

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