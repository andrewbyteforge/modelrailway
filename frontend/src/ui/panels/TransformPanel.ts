/**
 * TransformPanel.ts - UI panel for numeric scale input and presets
 * 
 * Path: frontend/src/ui/panels/TransformPanel.ts
 * 
 * Provides a floating/docked UI panel with:
 * - Numeric scale input (percentage or decimal)
 * - Slider for visual adjustment
 * - Preset quick-select buttons
 * - Current dimensions display
 * - Reset and lock controls
 * 
 * Integrates with ScaleManager for real-time updates.
 * 
 * @module TransformPanel
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { ScaleManager } from '../../systems/scaling/ScaleManager';
import {
    TransformPanelConfig,
    DEFAULT_TRANSFORM_PANEL_CONFIG,
    ScalePreset,
    ObjectScaleInfo
} from '../../types/scaling.types';

import {
    formatScale,
    parseScaleInput,
    formatDimensions
} from '../../utils/scaling/ScaleCalculations';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[TransformPanel]';

/** CSS class prefix */
const CSS_PREFIX = 'scale-panel';

// ============================================================================
// STYLES
// ============================================================================

/**
 * Panel styles (injected into document)
 */
const PANEL_STYLES = `
.${CSS_PREFIX} {
    position: fixed;
    background: linear-gradient(180deg, #2a2a2a 0%, #1e1e1e 100%);
    border: 1px solid #444;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 12px;
    color: #e0e0e0;
    z-index: 1000;
    user-select: none;
    overflow: hidden;
    transition: height 0.2s ease, opacity 0.2s ease;
}

.${CSS_PREFIX}--top-right { top: 20px; right: 20px; }
.${CSS_PREFIX}--top-left { top: 20px; left: 20px; }
.${CSS_PREFIX}--bottom-right { bottom: 20px; right: 20px; }
.${CSS_PREFIX}--bottom-left { bottom: 20px; left: 20px; }

.${CSS_PREFIX}__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: #333;
    border-bottom: 1px solid #444;
    cursor: pointer;
}

.${CSS_PREFIX}__title {
    font-weight: 600;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 6px;
}

.${CSS_PREFIX}__title-icon {
    font-size: 14px;
}

.${CSS_PREFIX}__collapse-btn {
    background: none;
    border: none;
    color: #888;
    cursor: pointer;
    padding: 2px 6px;
    font-size: 10px;
    transition: color 0.2s;
}

.${CSS_PREFIX}__collapse-btn:hover {
    color: #fff;
}

.${CSS_PREFIX}__content {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.${CSS_PREFIX}__content--collapsed {
    display: none;
}

.${CSS_PREFIX}__section {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.${CSS_PREFIX}__section-title {
    font-size: 10px;
    text-transform: uppercase;
    color: #888;
    letter-spacing: 0.5px;
}

.${CSS_PREFIX}__scale-row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.${CSS_PREFIX}__scale-input {
    width: 70px;
    padding: 6px 8px;
    background: #1a1a1a;
    border: 1px solid #444;
    border-radius: 4px;
    color: #fff;
    font-size: 13px;
    font-family: 'Consolas', 'Monaco', monospace;
    text-align: right;
}

.${CSS_PREFIX}__scale-input:focus {
    outline: none;
    border-color: #4a9eff;
}

.${CSS_PREFIX}__scale-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.${CSS_PREFIX}__scale-slider {
    flex: 1;
    height: 4px;
    -webkit-appearance: none;
    background: #333;
    border-radius: 2px;
    cursor: pointer;
}

.${CSS_PREFIX}__scale-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    background: #4a9eff;
    border-radius: 50%;
    cursor: pointer;
    transition: transform 0.1s;
}

.${CSS_PREFIX}__scale-slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
}

.${CSS_PREFIX}__scale-slider:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.${CSS_PREFIX}__presets {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

.${CSS_PREFIX}__preset-btn {
    padding: 5px 10px;
    background: #333;
    border: 1px solid #444;
    border-radius: 4px;
    color: #ccc;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    gap: 4px;
}

.${CSS_PREFIX}__preset-btn:hover {
    background: #444;
    border-color: #555;
    color: #fff;
}

.${CSS_PREFIX}__preset-btn--active {
    background: #4a9eff;
    border-color: #4a9eff;
    color: #fff;
}

.${CSS_PREFIX}__dimensions {
    font-size: 11px;
    color: #888;
    padding: 8px;
    background: #1a1a1a;
    border-radius: 4px;
    font-family: 'Consolas', 'Monaco', monospace;
}

.${CSS_PREFIX}__controls {
    display: flex;
    gap: 6px;
}

.${CSS_PREFIX}__control-btn {
    flex: 1;
    padding: 8px;
    background: #333;
    border: 1px solid #444;
    border-radius: 4px;
    color: #ccc;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
}

.${CSS_PREFIX}__control-btn:hover {
    background: #444;
    color: #fff;
}

.${CSS_PREFIX}__control-btn--active {
    background: #ff6b4a;
    border-color: #ff6b4a;
    color: #fff;
}

.${CSS_PREFIX}__control-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.${CSS_PREFIX}__no-selection {
    text-align: center;
    padding: 20px;
    color: #666;
    font-style: italic;
}

.${CSS_PREFIX}--hidden {
    opacity: 0;
    pointer-events: none;
}
`;

// ============================================================================
// TRANSFORM PANEL CLASS
// ============================================================================

/**
 * TransformPanel - UI panel for scale input and controls
 * 
 * Provides a complete interface for:
 * - Viewing and editing scale values
 * - Applying presets
 * - Viewing current dimensions
 * - Resetting and locking scale
 * 
 * @example
 * ```typescript
 * const panel = new TransformPanel(scaleManager);
 * panel.initialize();
 * panel.show();
 * ```
 */
export class TransformPanel {
    // ========================================================================
    // PROPERTIES
    // ========================================================================

    /** Scale manager reference */
    private scaleManager: ScaleManager;

    /** Panel configuration */
    private config: TransformPanelConfig;

    /** Root container element */
    private container: HTMLElement | null = null;

    /** Content container (collapsible) */
    private contentContainer: HTMLElement | null = null;

    /** Scale input element */
    private scaleInput: HTMLInputElement | null = null;

    /** Scale slider element */
    private sliderInput: HTMLInputElement | null = null;

    /** Dimensions display element */
    private dimensionsDisplay: HTMLElement | null = null;

    /** Preset buttons container */
    private presetsContainer: HTMLElement | null = null;

    /** Reset button */
    private resetBtn: HTMLButtonElement | null = null;

    /** Lock button */
    private lockBtn: HTMLButtonElement | null = null;

    /** No selection message element */
    private noSelectionMsg: HTMLElement | null = null;

    /** Currently displayed object ID */
    private currentObjectId: string | null = null;

    /** Whether panel is collapsed */
    private isCollapsed: boolean = false;

    /** Whether panel is visible */
    private isVisible: boolean = false;

    /** Whether styles have been injected */
    private static stylesInjected: boolean = false;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new TransformPanel
     * 
     * @param scaleManager - ScaleManager instance
     * @param config - Optional configuration
     */
    constructor(scaleManager: ScaleManager, config?: Partial<TransformPanelConfig>) {
        this.scaleManager = scaleManager;
        this.config = { ...DEFAULT_TRANSFORM_PANEL_CONFIG, ...config };
        this.isCollapsed = this.config.startCollapsed;

        console.log(`${LOG_PREFIX} Created`);
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the panel
     */
    initialize(): void {
        try {
            console.log(`${LOG_PREFIX} Initializing...`);

            // Inject styles (once)
            this.injectStyles();

            // Create DOM structure
            this.createDOM();

            // Setup event listeners
            this.setupEvents();

            // Setup scale manager events
            this.setupScaleManagerEvents();

            // Initial state
            this.updateDisplay(null);

            console.log(`${LOG_PREFIX} ✓ Initialized`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Initialization failed:`, error);
            throw error;
        }
    }

    /**
     * Inject CSS styles into document
     */
    private injectStyles(): void {
        if (TransformPanel.stylesInjected) return;

        const style = document.createElement('style');
        style.id = 'transform-panel-styles';
        style.textContent = PANEL_STYLES;
        document.head.appendChild(style);

        TransformPanel.stylesInjected = true;
    }

    /**
     * Create DOM structure
     */
    private createDOM(): void {
        // Create container
        this.container = document.createElement('div');
        this.container.className = `${CSS_PREFIX} ${CSS_PREFIX}--${this.config.position} ${CSS_PREFIX}--hidden`;
        this.container.style.width = `${this.config.width}px`;

        // Create header
        const header = this.createHeader();
        this.container.appendChild(header);

        // Create content
        this.contentContainer = document.createElement('div');
        this.contentContainer.className = `${CSS_PREFIX}__content`;
        if (this.isCollapsed) {
            this.contentContainer.classList.add(`${CSS_PREFIX}__content--collapsed`);
        }
        this.container.appendChild(this.contentContainer);

        // Create no selection message
        this.noSelectionMsg = document.createElement('div');
        this.noSelectionMsg.className = `${CSS_PREFIX}__no-selection`;
        this.noSelectionMsg.textContent = 'Select an object to scale';
        this.contentContainer.appendChild(this.noSelectionMsg);

        // Create scale section
        const scaleSection = this.createScaleSection();
        this.contentContainer.appendChild(scaleSection);

        // Create presets section (if enabled)
        if (this.config.showPresets) {
            const presetsSection = this.createPresetsSection();
            this.contentContainer.appendChild(presetsSection);
        }

        // Create dimensions section (if enabled)
        if (this.config.showDimensions) {
            const dimensionsSection = this.createDimensionsSection();
            this.contentContainer.appendChild(dimensionsSection);
        }

        // Create controls section
        const controlsSection = this.createControlsSection();
        this.contentContainer.appendChild(controlsSection);

        // Append to body
        document.body.appendChild(this.container);
    }

    /**
     * Create header section
     */
    private createHeader(): HTMLElement {
        const header = document.createElement('div');
        header.className = `${CSS_PREFIX}__header`;

        const title = document.createElement('div');
        title.className = `${CSS_PREFIX}__title`;
        title.innerHTML = `<span class="${CSS_PREFIX}__title-icon">📐</span> Scale`;

        if (this.config.collapsible) {
            const collapseBtn = document.createElement('button');
            collapseBtn.className = `${CSS_PREFIX}__collapse-btn`;
            collapseBtn.textContent = this.isCollapsed ? '▼' : '▲';
            collapseBtn.onclick = () => this.toggleCollapse();

            header.appendChild(title);
            header.appendChild(collapseBtn);
            header.onclick = (e) => {
                if (e.target === header || e.target === title) {
                    this.toggleCollapse();
                }
            };
        } else {
            header.appendChild(title);
        }

        return header;
    }

    /**
     * Create scale input section
     */
    private createScaleSection(): HTMLElement {
        const section = document.createElement('div');
        section.className = `${CSS_PREFIX}__section`;

        const title = document.createElement('div');
        title.className = `${CSS_PREFIX}__section-title`;
        title.textContent = 'Scale Factor';
        section.appendChild(title);

        const row = document.createElement('div');
        row.className = `${CSS_PREFIX}__scale-row`;

        // Scale input
        this.scaleInput = document.createElement('input');
        this.scaleInput.type = 'text';
        this.scaleInput.className = `${CSS_PREFIX}__scale-input`;
        this.scaleInput.value = '100%';
        this.scaleInput.disabled = true;

        // Slider
        this.sliderInput = document.createElement('input');
        this.sliderInput.type = 'range';
        this.sliderInput.className = `${CSS_PREFIX}__scale-slider`;
        this.sliderInput.min = '6';
        this.sliderInput.max = '500';
        this.sliderInput.value = '100';
        this.sliderInput.disabled = true;

        row.appendChild(this.scaleInput);
        row.appendChild(this.sliderInput);
        section.appendChild(row);

        return section;
    }

    /**
     * Create presets section
     */
    private createPresetsSection(): HTMLElement {
        const section = document.createElement('div');
        section.className = `${CSS_PREFIX}__section`;

        const title = document.createElement('div');
        title.className = `${CSS_PREFIX}__section-title`;
        title.textContent = 'Quick Presets';
        section.appendChild(title);

        this.presetsContainer = document.createElement('div');
        this.presetsContainer.className = `${CSS_PREFIX}__presets`;
        section.appendChild(this.presetsContainer);

        return section;
    }

    /**
     * Create dimensions display section
     */
    private createDimensionsSection(): HTMLElement {
        const section = document.createElement('div');
        section.className = `${CSS_PREFIX}__section`;

        const title = document.createElement('div');
        title.className = `${CSS_PREFIX}__section-title`;
        title.textContent = 'Current Size';
        section.appendChild(title);

        this.dimensionsDisplay = document.createElement('div');
        this.dimensionsDisplay.className = `${CSS_PREFIX}__dimensions`;
        this.dimensionsDisplay.textContent = '—';
        section.appendChild(this.dimensionsDisplay);

        return section;
    }

    /**
     * Create controls section (reset, lock)
     */
    private createControlsSection(): HTMLElement {
        const section = document.createElement('div');
        section.className = `${CSS_PREFIX}__section`;

        const controls = document.createElement('div');
        controls.className = `${CSS_PREFIX}__controls`;

        // Reset button
        if (this.config.showReset) {
            this.resetBtn = document.createElement('button');
            this.resetBtn.className = `${CSS_PREFIX}__control-btn`;
            this.resetBtn.innerHTML = '↺ Reset';
            this.resetBtn.disabled = true;
            controls.appendChild(this.resetBtn);
        }

        // Lock button
        if (this.config.showLock) {
            this.lockBtn = document.createElement('button');
            this.lockBtn.className = `${CSS_PREFIX}__control-btn`;
            this.lockBtn.innerHTML = '🔓 Unlocked';
            this.lockBtn.disabled = true;
            controls.appendChild(this.lockBtn);
        }

        section.appendChild(controls);
        return section;
    }

    // ========================================================================
    // EVENT SETUP
    // ========================================================================

    /**
     * Setup DOM event listeners
     */
    private setupEvents(): void {
        // Scale input
        if (this.scaleInput) {
            this.scaleInput.addEventListener('change', () => this.onScaleInputChange());
            this.scaleInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.onScaleInputChange();
                    this.scaleInput?.blur();
                }
            });
        }

        // Slider
        if (this.sliderInput) {
            this.sliderInput.addEventListener('input', () => this.onSliderChange());
        }

        // Reset button
        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', () => this.onResetClick());
        }

        // Lock button
        if (this.lockBtn) {
            this.lockBtn.addEventListener('click', () => this.onLockClick());
        }
    }

    /**
     * Setup scale manager event listeners
     */
    private setupScaleManagerEvents(): void {
        this.scaleManager.addEventListener((event) => {
            switch (event.type) {
                case 'scale-start':
                    if (event.objectId) {
                        this.currentObjectId = event.objectId;
                        this.updateDisplay(event.objectId);
                    }
                    break;

                case 'scale-commit':
                case 'scale-preview':
                    if (event.objectId === this.currentObjectId && event.scale !== undefined) {
                        this.updateScaleDisplay(event.scale);
                    }
                    break;

                case 'scale-reset':
                    if (event.objectId === this.currentObjectId && event.scale !== undefined) {
                        this.updateScaleDisplay(event.scale);
                    }
                    break;

                case 'lock-changed':
                    if (event.objectId === this.currentObjectId) {
                        this.updateLockDisplay(event.data?.locked as boolean);
                    }
                    break;
            }
        });
    }

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    /**
     * Handle scale input change
     */
    private onScaleInputChange(): void {
        if (!this.scaleInput || !this.currentObjectId) return;

        const parsed = parseScaleInput(this.scaleInput.value);
        if (parsed !== null) {
            this.scaleManager.setScale(this.currentObjectId, parsed);
        } else {
            // Restore previous value
            const info = this.scaleManager.getScaleInfo(this.currentObjectId);
            if (info) {
                this.scaleInput.value = formatScale(info.currentScale, this.config.showPercentage, this.config.decimalPlaces);
            }
        }
    }

    /**
     * Handle slider change
     */
    private onSliderChange(): void {
        if (!this.sliderInput || !this.currentObjectId) return;

        const percent = parseInt(this.sliderInput.value, 10);
        const scale = percent / 100;
        this.scaleManager.setScale(this.currentObjectId, scale);
    }

    /**
     * Handle reset button click
     */
    private onResetClick(): void {
        if (!this.currentObjectId) return;
        this.scaleManager.resetScale(this.currentObjectId);
    }

    /**
     * Handle lock button click
     */
    private onLockClick(): void {
        if (!this.currentObjectId) return;
        this.scaleManager.toggleLock(this.currentObjectId);
    }

    /**
     * Handle preset button click
     */
    private onPresetClick(preset: ScalePreset): void {
        if (!this.currentObjectId) return;
        this.scaleManager.applyPreset(this.currentObjectId, preset.id);
    }

    // ========================================================================
    // DISPLAY UPDATES
    // ========================================================================

    /**
     * Update entire display for an object
     */
    private updateDisplay(objectId: string | null): void {
        this.currentObjectId = objectId;

        if (!objectId) {
            // No selection
            this.showNoSelection(true);
            this.setControlsEnabled(false);
            return;
        }

        const info = this.scaleManager.getScaleInfo(objectId);
        if (!info) {
            this.showNoSelection(true);
            this.setControlsEnabled(false);
            return;
        }

        // Show controls
        this.showNoSelection(false);
        this.setControlsEnabled(!info.isLocked);

        // Update all displays
        this.updateScaleDisplay(info.currentScale);
        this.updateDimensionsDisplay(info);
        this.updatePresetsDisplay(info);
        this.updateLockDisplay(info.isLocked);

        // Update slider range based on constraints
        if (this.sliderInput) {
            this.sliderInput.min = String(info.constraints.minScale * 100);
            this.sliderInput.max = String(info.constraints.maxScale * 100);
        }
    }

    /**
     * Update scale value display
     */
    private updateScaleDisplay(scale: number): void {
        if (this.scaleInput) {
            this.scaleInput.value = formatScale(
                scale,
                this.config.showPercentage,
                this.config.decimalPlaces
            );
        }

        if (this.sliderInput) {
            this.sliderInput.value = String(scale * 100);
        }
    }

    /**
     * Update dimensions display
     */
    private updateDimensionsDisplay(info: ObjectScaleInfo): void {
        if (!this.dimensionsDisplay) return;

        this.dimensionsDisplay.textContent = formatDimensions(info.currentDimensions);
    }

    /**
     * Update presets display
     */
    private updatePresetsDisplay(info: ObjectScaleInfo): void {
        if (!this.presetsContainer) return;

        // Clear existing
        this.presetsContainer.innerHTML = '';

        // Add preset buttons
        for (const preset of info.presets) {
            const btn = document.createElement('button');
            btn.className = `${CSS_PREFIX}__preset-btn`;
            btn.innerHTML = `${preset.icon || ''} ${preset.name}`;
            btn.title = preset.description || '';

            // Mark as active if current scale matches
            if (Math.abs(info.currentScale - preset.scaleFactor) < 0.01) {
                btn.classList.add(`${CSS_PREFIX}__preset-btn--active`);
            }

            btn.onclick = () => this.onPresetClick(preset);
            this.presetsContainer.appendChild(btn);
        }
    }

    /**
     * Update lock display
     */
    private updateLockDisplay(isLocked: boolean): void {
        if (!this.lockBtn) return;

        if (isLocked) {
            this.lockBtn.innerHTML = '🔒 Locked';
            this.lockBtn.classList.add(`${CSS_PREFIX}__control-btn--active`);
        } else {
            this.lockBtn.innerHTML = '🔓 Unlocked';
            this.lockBtn.classList.remove(`${CSS_PREFIX}__control-btn--active`);
        }

        // Update input states
        this.setControlsEnabled(!isLocked);
    }

    /**
     * Show/hide no selection message
     */
    private showNoSelection(show: boolean): void {
        if (this.noSelectionMsg) {
            this.noSelectionMsg.style.display = show ? 'block' : 'none';
        }

        // Hide other sections when no selection
        const sections = this.contentContainer?.querySelectorAll(`.${CSS_PREFIX}__section`);
        sections?.forEach((section) => {
            (section as HTMLElement).style.display = show ? 'none' : 'flex';
        });
    }

    /**
     * Enable/disable controls
     */
    private setControlsEnabled(enabled: boolean): void {
        if (this.scaleInput) this.scaleInput.disabled = !enabled;
        if (this.sliderInput) this.sliderInput.disabled = !enabled;
        if (this.resetBtn) this.resetBtn.disabled = !enabled;
        // Lock button stays enabled
    }

    // ========================================================================
    // VISIBILITY
    // ========================================================================

    /**
     * Show the panel
     */
    show(): void {
        if (this.container) {
            this.container.classList.remove(`${CSS_PREFIX}--hidden`);
            this.isVisible = true;
        }
    }

    /**
     * Hide the panel
     */
    hide(): void {
        if (this.container) {
            this.container.classList.add(`${CSS_PREFIX}--hidden`);
            this.isVisible = false;
        }
    }

    /**
     * Toggle panel visibility
     */
    toggle(): void {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Check if panel is visible
     */
    getIsVisible(): boolean {
        return this.isVisible;
    }

    /**
     * Toggle collapse state
     */
    toggleCollapse(): void {
        this.isCollapsed = !this.isCollapsed;

        if (this.contentContainer) {
            if (this.isCollapsed) {
                this.contentContainer.classList.add(`${CSS_PREFIX}__content--collapsed`);
            } else {
                this.contentContainer.classList.remove(`${CSS_PREFIX}__content--collapsed`);
            }
        }

        // Update collapse button text
        const btn = this.container?.querySelector(`.${CSS_PREFIX}__collapse-btn`);
        if (btn) {
            btn.textContent = this.isCollapsed ? '▼' : '▲';
        }
    }

    // ========================================================================
    // DISPOSAL
    // ========================================================================

    /**
     * Clean up resources
     */
    dispose(): void {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }

        this.container = null;
        this.contentContainer = null;
        this.scaleInput = null;
        this.sliderInput = null;
        this.dimensionsDisplay = null;
        this.presetsContainer = null;
        this.resetBtn = null;
        this.lockBtn = null;
        this.noSelectionMsg = null;
        this.currentObjectId = null;

        console.log(`${LOG_PREFIX} Disposed`);
    }
}