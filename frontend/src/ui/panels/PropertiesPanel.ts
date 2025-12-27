/**
 * PropertiesPanel.ts - Properties and settings panel for the World Outliner
 * 
 * Path: frontend/src/ui/panels/PropertiesPanel.ts
 * 
 * Displays configurable properties and performance monitoring options.
 * Features include:
 * - FPS display toggle with real-time monitoring
 * - Performance state indicators
 * - Expandable sections for organization
 * - Integration with FPSDisplay system
 * 
 * @module PropertiesPanel
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { FPSDisplay, FPSData, PerformanceState } from '../../systems/performance/FPSDisplay';

// ============================================================================
// CONSTANTS & STYLES
// ============================================================================

/** Logging prefix for consistent console output */
const LOG_PREFIX = '[PropertiesPanel]';

/** Color scheme for the properties panel - matching UIManager theme */
const PANEL_COLORS = {
    // Backgrounds
    PANEL_BG: '#1e272e',
    SECTION_BG: '#2a2a2a',
    SECTION_HEADER_BG: '#2c3e50',

    // Text
    TEXT_PRIMARY: '#e0e0e0',
    TEXT_SECONDARY: '#b2bec3',
    TEXT_MUTED: '#888',
    TEXT_LABEL: '#95a5a6',

    // Borders
    BORDER: '#333',
    BORDER_LIGHT: 'rgba(255, 255, 255, 0.1)',

    // Accents
    ACCENT: '#27ae60',
    ACCENT_HOVER: '#2ecc71',

    // Toggle states
    TOGGLE_ON: '#27ae60',
    TOGGLE_OFF: '#555',
    TOGGLE_KNOB: '#ffffff',

    // FPS states
    FPS_GOOD: '#27ae60',
    FPS_WARNING: '#f39c12',
    FPS_CRITICAL: '#e74c3c',
} as const;

/** CSS class prefix */
const CSS_PREFIX = 'properties-panel';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Configuration options for PropertiesPanel
 */
export interface PropertiesPanelConfig {
    /** Initial FPS display state */
    fpsEnabled?: boolean;
    /** Initial FPS overlay state */
    fpsOverlayEnabled?: boolean;
    /** Show performance section */
    showPerformanceSection?: boolean;
    /** Show display section */
    showDisplaySection?: boolean;
}

/**
 * Section visibility state
 */
interface SectionState {
    performance: boolean;
    display: boolean;
}

// ============================================================================
// PROPERTIES PANEL CLASS
// ============================================================================

/**
 * PropertiesPanel - Configurable settings panel
 * 
 * @example
 * ```typescript
 * const panel = new PropertiesPanel(fpsDisplay);
 * panel.initialize();
 * 
 * // Add to container
 * container.appendChild(panel.getElement());
 * ```
 */
export class PropertiesPanel {
    // ========================================================================
    // PRIVATE PROPERTIES
    // ========================================================================

    /** Reference to the FPS display system */
    private fpsDisplay: FPSDisplay | null;

    /** Configuration options */
    private config: Required<PropertiesPanelConfig>;

    /** Main container element */
    private container: HTMLElement | null = null;

    /** FPS value display element */
    private fpsValueElement: HTMLElement | null = null;

    /** FPS state indicator element */
    private fpsStateElement: HTMLElement | null = null;

    /** FPS toggle switch element */
    private fpsToggle: HTMLInputElement | null = null;

    /** FPS overlay toggle switch element */
    private fpsOverlayToggle: HTMLInputElement | null = null;

    /** Section collapse states */
    private sectionStates: SectionState = {
        performance: true,
        display: true,
    };

    /** Whether the panel has been initialized */
    private _initialized: boolean = false;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new PropertiesPanel
     * 
     * @param fpsDisplay - Optional FPSDisplay instance for performance monitoring
     * @param config - Optional configuration overrides
     */
    constructor(
        fpsDisplay: FPSDisplay | null = null,
        config: PropertiesPanelConfig = {}
    ) {
        this.fpsDisplay = fpsDisplay;

        // Merge configuration with defaults
        this.config = {
            fpsEnabled: config.fpsEnabled ?? false,
            fpsOverlayEnabled: config.fpsOverlayEnabled ?? false,
            showPerformanceSection: config.showPerformanceSection ?? true,
            showDisplaySection: config.showDisplaySection ?? true,
        };

        console.log(`${LOG_PREFIX} Created`);
    }

    // ========================================================================
    // INITIALIZATION & CLEANUP
    // ========================================================================

    /**
     * Initialize the panel and create DOM elements
     */
    initialize(): void {
        if (this._initialized) {
            console.warn(`${LOG_PREFIX} Already initialized`);
            return;
        }

        try {
            console.log(`${LOG_PREFIX} Initializing...`);

            // Create main container
            this.createContainer();

            // Setup FPS display callbacks if available
            if (this.fpsDisplay) {
                this.setupFPSCallbacks();
            }

            // Apply initial config
            this.applyInitialConfig();

            this._initialized = true;
            console.log(`${LOG_PREFIX} ✓ Initialized successfully`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Initialization failed:`, error);
            throw error;
        }
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        console.log(`${LOG_PREFIX} Disposing...`);

        // Remove container from DOM
        if (this.container) {
            this.container.remove();
            this.container = null;
        }

        // Clear references
        this.fpsValueElement = null;
        this.fpsStateElement = null;
        this.fpsToggle = null;
        this.fpsOverlayToggle = null;

        this._initialized = false;
        console.log(`${LOG_PREFIX} ✓ Disposed`);
    }

    // ========================================================================
    // CONTAINER CREATION
    // ========================================================================

    /**
     * Create the main container and all sections
     */
    private createContainer(): void {
        // Create container
        const container = document.createElement('div');
        container.className = `${CSS_PREFIX}`;
        container.style.cssText = `
            display: flex;
            flex-direction: column;
            background: ${PANEL_COLORS.PANEL_BG};
            color: ${PANEL_COLORS.TEXT_PRIMARY};
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            overflow-y: auto;
            height: 100%;
        `;

        // Create header
        const header = this.createHeader();
        container.appendChild(header);

        // Create content area
        const content = document.createElement('div');
        content.className = `${CSS_PREFIX}-content`;
        content.style.cssText = `
            display: flex;
            flex-direction: column;
            padding: 8px;
            gap: 8px;
        `;

        // Add performance section
        if (this.config.showPerformanceSection) {
            const perfSection = this.createPerformanceSection();
            content.appendChild(perfSection);
        }

        // Add display section
        if (this.config.showDisplaySection) {
            const displaySection = this.createDisplaySection();
            content.appendChild(displaySection);
        }

        container.appendChild(content);
        this.container = container;
    }

    /**
     * Create the panel header
     * @returns Header element
     */
    private createHeader(): HTMLElement {
        const header = document.createElement('div');
        header.className = `${CSS_PREFIX}-header`;
        header.style.cssText = `
            display: flex;
            align-items: center;
            padding: 10px 12px;
            background: ${PANEL_COLORS.SECTION_HEADER_BG};
            border-bottom: 1px solid ${PANEL_COLORS.BORDER};
            gap: 8px;
        `;

        // Icon
        const icon = document.createElement('span');
        icon.textContent = '⚙️';
        icon.style.fontSize = '14px';
        header.appendChild(icon);

        // Title
        const title = document.createElement('span');
        title.textContent = 'Properties';
        title.style.cssText = `
            font-weight: 600;
            font-size: 13px;
            color: ${PANEL_COLORS.TEXT_PRIMARY};
        `;
        header.appendChild(title);

        return header;
    }

    // ========================================================================
    // SECTION CREATION
    // ========================================================================

    /**
     * Create a collapsible section container
     * @param title - Section title
     * @param icon - Section icon
     * @param sectionKey - Key for tracking collapse state
     * @returns Section container element
     */
    private createSection(
        title: string,
        icon: string,
        sectionKey: keyof SectionState
    ): HTMLElement {
        const section = document.createElement('div');
        section.className = `${CSS_PREFIX}-section`;
        section.style.cssText = `
            background: ${PANEL_COLORS.SECTION_BG};
            border-radius: 6px;
            border: 1px solid ${PANEL_COLORS.BORDER};
            overflow: hidden;
        `;

        // Section header (clickable)
        const header = document.createElement('div');
        header.className = `${CSS_PREFIX}-section-header`;
        header.style.cssText = `
            display: flex;
            align-items: center;
            padding: 10px 12px;
            cursor: pointer;
            user-select: none;
            transition: background 0.15s;
            gap: 8px;
        `;

        // Collapse arrow
        const arrow = document.createElement('span');
        arrow.className = `${CSS_PREFIX}-section-arrow`;
        arrow.textContent = '▼';
        arrow.style.cssText = `
            font-size: 10px;
            color: ${PANEL_COLORS.TEXT_MUTED};
            transition: transform 0.2s;
        `;
        header.appendChild(arrow);

        // Icon
        const iconSpan = document.createElement('span');
        iconSpan.textContent = icon;
        iconSpan.style.fontSize = '13px';
        header.appendChild(iconSpan);

        // Title
        const titleSpan = document.createElement('span');
        titleSpan.textContent = title;
        titleSpan.style.cssText = `
            flex: 1;
            font-weight: 500;
            color: ${PANEL_COLORS.TEXT_PRIMARY};
        `;
        header.appendChild(titleSpan);

        // Section content
        const content = document.createElement('div');
        content.className = `${CSS_PREFIX}-section-content`;
        content.style.cssText = `
            padding: 12px;
            border-top: 1px solid ${PANEL_COLORS.BORDER};
            display: flex;
            flex-direction: column;
            gap: 12px;
        `;

        // Toggle collapse on header click
        header.addEventListener('click', () => {
            this.sectionStates[sectionKey] = !this.sectionStates[sectionKey];
            const isExpanded = this.sectionStates[sectionKey];

            content.style.display = isExpanded ? 'flex' : 'none';
            arrow.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';
        });

        // Hover effect
        header.addEventListener('mouseenter', () => {
            header.style.background = 'rgba(255, 255, 255, 0.05)';
        });
        header.addEventListener('mouseleave', () => {
            header.style.background = 'transparent';
        });

        section.appendChild(header);
        section.appendChild(content);

        // Store content reference in section for adding items
        (section as any)._content = content;

        return section;
    }

    /**
     * Create the Performance monitoring section
     * @returns Performance section element
     */
    private createPerformanceSection(): HTMLElement {
        const section = this.createSection('Performance', '📊', 'performance');
        const content = (section as any)._content as HTMLElement;

        // FPS Display row with toggle
        const fpsRow = this.createToggleRow(
            'Show FPS',
            'Display real-time frame rate',
            this.config.fpsEnabled,
            (enabled) => this.handleFPSToggle(enabled)
        );
        this.fpsToggle = fpsRow.querySelector('input') as HTMLInputElement;
        content.appendChild(fpsRow);

        // FPS Overlay toggle
        const overlayRow = this.createToggleRow(
            'FPS Overlay',
            'Show FPS counter on screen',
            this.config.fpsOverlayEnabled,
            (enabled) => this.handleOverlayToggle(enabled)
        );
        this.fpsOverlayToggle = overlayRow.querySelector('input') as HTMLInputElement;
        content.appendChild(overlayRow);

        // FPS value display
        const fpsDisplay = this.createFPSDisplay();
        content.appendChild(fpsDisplay);

        return section;
    }

    /**
     * Create the Display settings section
     * @returns Display section element
     */
    private createDisplaySection(): HTMLElement {
        const section = this.createSection('Display', '🖥️', 'display');
        const content = (section as any)._content as HTMLElement;

        // Placeholder for future display settings
        const placeholder = document.createElement('div');
        placeholder.style.cssText = `
            color: ${PANEL_COLORS.TEXT_MUTED};
            font-size: 12px;
            font-style: italic;
            text-align: center;
            padding: 8px;
        `;
        placeholder.textContent = 'Additional display settings coming soon...';
        content.appendChild(placeholder);

        return section;
    }

    // ========================================================================
    // ROW CREATION HELPERS
    // ========================================================================

    /**
     * Create a toggle switch row
     * @param label - Row label
     * @param description - Row description
     * @param initialState - Initial toggle state
     * @param onChange - Callback when toggle changes
     * @returns Toggle row element
     */
    private createToggleRow(
        label: string,
        description: string,
        initialState: boolean,
        onChange: (enabled: boolean) => void
    ): HTMLElement {
        const row = document.createElement('div');
        row.className = `${CSS_PREFIX}-row`;
        row.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 0;
        `;

        // Label container
        const labelContainer = document.createElement('div');
        labelContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 2px;
            flex: 1;
        `;

        // Label text
        const labelText = document.createElement('span');
        labelText.textContent = label;
        labelText.style.cssText = `
            color: ${PANEL_COLORS.TEXT_PRIMARY};
            font-size: 13px;
        `;
        labelContainer.appendChild(labelText);

        // Description
        const descText = document.createElement('span');
        descText.textContent = description;
        descText.style.cssText = `
            color: ${PANEL_COLORS.TEXT_MUTED};
            font-size: 11px;
        `;
        labelContainer.appendChild(descText);

        row.appendChild(labelContainer);

        // Toggle switch
        const toggle = this.createToggleSwitch(initialState, onChange);
        row.appendChild(toggle);

        return row;
    }

    /**
     * Create a toggle switch element
     * @param initialState - Initial checked state
     * @param onChange - Callback when state changes
     * @returns Toggle switch container
     */
    private createToggleSwitch(
        initialState: boolean,
        onChange: (enabled: boolean) => void
    ): HTMLElement {
        const container = document.createElement('label');
        container.className = `${CSS_PREFIX}-toggle`;
        container.style.cssText = `
            position: relative;
            display: inline-block;
            width: 40px;
            height: 22px;
            cursor: pointer;
            flex-shrink: 0;
        `;

        // Hidden checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = initialState;
        checkbox.style.cssText = `
            opacity: 0;
            width: 0;
            height: 0;
            position: absolute;
        `;

        // Slider track
        const slider = document.createElement('span');
        slider.className = `${CSS_PREFIX}-toggle-slider`;
        slider.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: ${initialState ? PANEL_COLORS.TOGGLE_ON : PANEL_COLORS.TOGGLE_OFF};
            border-radius: 22px;
            transition: background 0.2s;
        `;

        // Slider knob
        const knob = document.createElement('span');
        knob.className = `${CSS_PREFIX}-toggle-knob`;
        knob.style.cssText = `
            position: absolute;
            height: 18px;
            width: 18px;
            left: ${initialState ? '20px' : '2px'};
            bottom: 2px;
            background: ${PANEL_COLORS.TOGGLE_KNOB};
            border-radius: 50%;
            transition: left 0.2s;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        `;
        slider.appendChild(knob);

        // Handle change
        checkbox.addEventListener('change', () => {
            const isChecked = checkbox.checked;

            // Update visual state
            slider.style.background = isChecked ? PANEL_COLORS.TOGGLE_ON : PANEL_COLORS.TOGGLE_OFF;
            knob.style.left = isChecked ? '20px' : '2px';

            // Trigger callback
            onChange(isChecked);
        });

        container.appendChild(checkbox);
        container.appendChild(slider);

        return container;
    }

    /**
     * Create the FPS value display element
     * @returns FPS display container
     */
    private createFPSDisplay(): HTMLElement {
        const container = document.createElement('div');
        container.className = `${CSS_PREFIX}-fps-display`;
        container.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 6px;
            margin-top: 4px;
        `;

        // FPS value
        const valueContainer = document.createElement('div');
        valueContainer.style.cssText = `
            display: flex;
            align-items: baseline;
            gap: 4px;
        `;

        const fpsValue = document.createElement('span');
        fpsValue.className = `${CSS_PREFIX}-fps-value`;
        fpsValue.textContent = '--';
        fpsValue.style.cssText = `
            font-size: 24px;
            font-weight: 700;
            font-family: 'Consolas', 'Monaco', monospace;
            color: ${PANEL_COLORS.TEXT_PRIMARY};
        `;
        this.fpsValueElement = fpsValue;
        valueContainer.appendChild(fpsValue);

        const fpsLabel = document.createElement('span');
        fpsLabel.textContent = 'FPS';
        fpsLabel.style.cssText = `
            font-size: 12px;
            color: ${PANEL_COLORS.TEXT_MUTED};
            font-weight: 500;
        `;
        valueContainer.appendChild(fpsLabel);

        container.appendChild(valueContainer);

        // State indicator
        const stateIndicator = document.createElement('div');
        stateIndicator.className = `${CSS_PREFIX}-fps-state`;
        stateIndicator.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 12px;
            background: rgba(0, 0, 0, 0.3);
        `;

        const stateDot = document.createElement('span');
        stateDot.className = `${CSS_PREFIX}-fps-state-dot`;
        stateDot.style.cssText = `
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: ${PANEL_COLORS.TEXT_MUTED};
        `;
        stateIndicator.appendChild(stateDot);

        const stateText = document.createElement('span');
        stateText.className = `${CSS_PREFIX}-fps-state-text`;
        stateText.textContent = 'Idle';
        stateText.style.cssText = `
            font-size: 11px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: ${PANEL_COLORS.TEXT_MUTED};
        `;
        stateIndicator.appendChild(stateText);

        this.fpsStateElement = stateIndicator;
        container.appendChild(stateIndicator);

        return container;
    }

    // ========================================================================
    // FPS INTEGRATION
    // ========================================================================

    /**
     * Setup callbacks for FPS display updates
     */
    private setupFPSCallbacks(): void {
        if (!this.fpsDisplay) {
            console.warn(`${LOG_PREFIX} No FPS display available for callbacks`);
            return;
        }

        console.log(`${LOG_PREFIX} Setting up FPS callbacks...`);

        this.fpsDisplay.onUpdate((data) => {
            console.log(`${LOG_PREFIX} FPS update received:`, data.smoothed.toFixed(1), data.state);
            this.updateFPSDisplay(data);
        });

        console.log(`${LOG_PREFIX} ✓ FPS callbacks registered`);
    }

    /**
     * Apply initial configuration settings
     */
    private applyInitialConfig(): void {
        // Apply initial FPS toggle state
        if (this.config.fpsEnabled && this.fpsDisplay) {
            this.fpsDisplay.enable();
        }

        // Apply initial overlay state
        if (this.config.fpsOverlayEnabled && this.fpsDisplay) {
            this.fpsDisplay.showOverlay();
        }
    }

    /**
     * Handle FPS toggle change
     * @param enabled - New enabled state
     */
    private handleFPSToggle(enabled: boolean): void {
        console.log(`${LOG_PREFIX} FPS display toggled: ${enabled}`);

        if (!this.fpsDisplay) {
            console.error(`${LOG_PREFIX} FPS display not available - cannot toggle`);
            return;
        }

        console.log(`${LOG_PREFIX} FPS display initialized:`, this.fpsDisplay.initialized);

        if (enabled) {
            console.log(`${LOG_PREFIX} Enabling FPS display...`);
            this.fpsDisplay.enable();
            console.log(`${LOG_PREFIX} FPS display enabled:`, this.fpsDisplay.enabled);
        } else {
            console.log(`${LOG_PREFIX} Disabling FPS display...`);
            this.fpsDisplay.disable();
            // Reset display
            this.resetFPSDisplay();
        }
    }

    /**
     * Handle overlay toggle change
     * @param enabled - New enabled state
     */
    private handleOverlayToggle(enabled: boolean): void {
        console.log(`${LOG_PREFIX} FPS overlay toggled: ${enabled}`);

        if (!this.fpsDisplay) {
            console.warn(`${LOG_PREFIX} FPS display not available`);
            return;
        }

        if (enabled) {
            this.fpsDisplay.showOverlay();
        } else {
            this.fpsDisplay.hideOverlay();
        }
    }

    /**
     * Update the FPS display with new data
     * @param data - FPS data snapshot
     */
    private updateFPSDisplay(data: FPSData): void {
        // Only skip if explicitly disabled
        if (!data.enabled) {
            console.log(`${LOG_PREFIX} FPS update skipped - disabled`);
            return;
        }

        // Update FPS value
        if (this.fpsValueElement) {
            const fpsText = data.smoothed > 0 ? data.smoothed.toFixed(0) : '--';
            this.fpsValueElement.textContent = fpsText;
            this.fpsValueElement.style.color = this.getStateColor(data.state);
        }

        // Update state indicator
        if (this.fpsStateElement) {
            const dot = this.fpsStateElement.querySelector(`.${CSS_PREFIX}-fps-state-dot`) as HTMLElement;
            const text = this.fpsStateElement.querySelector(`.${CSS_PREFIX}-fps-state-text`) as HTMLElement;

            if (dot) {
                dot.style.background = this.getStateColor(data.state);
            }
            if (text) {
                text.textContent = this.getStateLabel(data.state);
                text.style.color = this.getStateColor(data.state);
            }
        }
    }

    /**
     * Reset the FPS display to idle state
     */
    private resetFPSDisplay(): void {
        if (this.fpsValueElement) {
            this.fpsValueElement.textContent = '--';
            this.fpsValueElement.style.color = PANEL_COLORS.TEXT_PRIMARY;
        }

        if (this.fpsStateElement) {
            const dot = this.fpsStateElement.querySelector(`.${CSS_PREFIX}-fps-state-dot`) as HTMLElement;
            const text = this.fpsStateElement.querySelector(`.${CSS_PREFIX}-fps-state-text`) as HTMLElement;

            if (dot) {
                dot.style.background = PANEL_COLORS.TEXT_MUTED;
            }
            if (text) {
                text.textContent = 'Idle';
                text.style.color = PANEL_COLORS.TEXT_MUTED;
            }
        }
    }

    /**
     * Get color for performance state
     * @param state - Performance state
     * @returns Color hex string
     */
    private getStateColor(state: PerformanceState): string {
        switch (state) {
            case 'good':
                return PANEL_COLORS.FPS_GOOD;
            case 'warning':
                return PANEL_COLORS.FPS_WARNING;
            case 'critical':
                return PANEL_COLORS.FPS_CRITICAL;
            default:
                return PANEL_COLORS.TEXT_PRIMARY;
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
                return 'Smooth';
            case 'warning':
                return 'Degraded';
            case 'critical':
                return 'Low';
            default:
                return 'Unknown';
        }
    }

    // ========================================================================
    // PUBLIC METHODS
    // ========================================================================

    /**
     * Get the container element
     * @returns Container element or null
     */
    getElement(): HTMLElement | null {
        return this.container;
    }

    /**
     * Set the FPS display instance
     * @param fpsDisplay - FPSDisplay instance
     */
    setFPSDisplay(fpsDisplay: FPSDisplay): void {
        this.fpsDisplay = fpsDisplay;
        this.setupFPSCallbacks();
    }

    /**
     * Programmatically set FPS toggle state
     * @param enabled - Desired state
     */
    setFPSEnabled(enabled: boolean): void {
        if (this.fpsToggle) {
            this.fpsToggle.checked = enabled;
            this.fpsToggle.dispatchEvent(new Event('change'));
        }
    }

    /**
     * Programmatically set overlay toggle state
     * @param enabled - Desired state
     */
    setOverlayEnabled(enabled: boolean): void {
        if (this.fpsOverlayToggle) {
            this.fpsOverlayToggle.checked = enabled;
            this.fpsOverlayToggle.dispatchEvent(new Event('change'));
        }
    }

    /**
     * Get whether the panel is initialized
     */
    get initialized(): boolean {
        return this._initialized;
    }
}

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default PropertiesPanel;