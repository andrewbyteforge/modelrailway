/**
 * Train Options Menu
 * 
 * Path: frontend/src/ui/TrainOptionsMenu.ts
 * 
 * Popup menu for rolling stock selection that shows:
 * - Drive Mode: Enables WASD/throttle controls for the train
 * - Reposition Mode: Enables drag/scale/rotate controls for moving the train
 * 
 * This menu appears when a user clicks on a rolling stock model (locomotive,
 * coach, wagon) and allows them to choose how to interact with it.
 * 
 * @module TrainOptionsMenu
 * @author Model Railway Workbench
 * @version 1.1.0 - Fixed click outside detection timing
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix for console output */
const LOG_PREFIX = '[TrainOptionsMenu]';

/**
 * Delay in milliseconds before click-outside detection is enabled
 * after the menu is shown. This prevents the same click that opens
 * the menu from immediately closing it.
 */
const CLICK_OUTSIDE_DELAY_MS = 50;

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Configuration for the train options menu
 */
export interface TrainOptionsMenuConfig {
    /** Callback when Drive mode is selected */
    onDriveMode?: (modelId: string) => void;
    /** Callback when Reposition mode is selected */
    onRepositionMode?: (modelId: string) => void;
    /** Callback when menu is closed */
    onClose?: () => void;
}

/**
 * Menu option definition
 */
interface MenuOption {
    id: string;
    label: string;
    icon: string;
    description: string;
    action: () => void;
}

// ============================================================================
// CLASS DEFINITION
// ============================================================================

/**
 * TrainOptionsMenu - Popup menu for rolling stock selection
 * 
 * Shows options when a train/rolling stock model is clicked:
 * - Drive Mode: Enables WASD/throttle controls
 * - Reposition Mode: Enables drag/scale/rotate controls
 * 
 * FIX NOTE (v1.1.0): Added delayed click-outside detection to prevent
 * the menu from immediately closing when opened. The same click event
 * that opens the menu was triggering the "click outside" handler because
 * click events bubble up to the document after the menu is shown.
 */
export class TrainOptionsMenu {
    // ------------------------------------------------------------------------
    // PRIVATE PROPERTIES
    // ------------------------------------------------------------------------

    /** Configuration */
    private config: TrainOptionsMenuConfig;

    /** Container element */
    private container: HTMLDivElement | null = null;

    /** Currently selected model ID */
    private currentModelId: string | null = null;

    /** Currently selected model name */
    private currentModelName: string = '';

    /** Whether menu is currently visible */
    private isVisible: boolean = false;

    /**
     * Flag to temporarily ignore click-outside events.
     * Set to true when menu is shown, then false after a short delay.
     * This prevents the opening click from immediately closing the menu.
     */
    private ignoreNextOutsideClick: boolean = false;

    /**
     * Timeout ID for the click-outside delay
     * Used to clear the timeout if menu is hidden before delay expires
     */
    private clickOutsideDelayTimeout: ReturnType<typeof setTimeout> | null = null;

    // ------------------------------------------------------------------------
    // CONSTRUCTOR
    // ------------------------------------------------------------------------

    /**
     * Create a new TrainOptionsMenu
     * @param config - Menu configuration
     */
    constructor(config: TrainOptionsMenuConfig) {
        this.config = config;

        try {
            this.createContainer();
            console.log(`${LOG_PREFIX} Created`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to create menu:`, error);
        }
    }

    // ------------------------------------------------------------------------
    // PUBLIC METHODS
    // ------------------------------------------------------------------------

    /**
     * Show the menu for a specific model
     * 
     * Sets a temporary flag to ignore click-outside events for a short
     * period after showing. This prevents the click that opened the menu
     * from immediately closing it.
     * 
     * @param modelId - ID of the selected model
     * @param modelName - Display name of the model
     * @param screenX - Screen X position to show menu
     * @param screenY - Screen Y position to show menu
     */
    public show(modelId: string, modelName: string, screenX: number, screenY: number): void {
        try {
            console.log(`${LOG_PREFIX} Showing menu for: ${modelName} (${modelId})`);
            console.log(`${LOG_PREFIX}   Position: (${screenX}, ${screenY})`);

            this.currentModelId = modelId;
            this.currentModelName = modelName;

            if (!this.container) {
                console.error(`${LOG_PREFIX} Container not created`);
                this.createContainer();
            }

            if (this.container) {
                // ============================================================
                // FIX: Set flag to ignore the opening click
                // ============================================================
                // The click event that triggered show() will bubble up to the
                // document and trigger handleOutsideClick(). By setting this
                // flag and clearing it after a short delay, we ensure that
                // opening click is ignored.
                this.ignoreNextOutsideClick = true;

                // Clear any existing timeout
                if (this.clickOutsideDelayTimeout) {
                    clearTimeout(this.clickOutsideDelayTimeout);
                }

                // Re-enable click-outside detection after a short delay
                this.clickOutsideDelayTimeout = setTimeout(() => {
                    this.ignoreNextOutsideClick = false;
                    this.clickOutsideDelayTimeout = null;
                    console.log(`${LOG_PREFIX} Click-outside detection enabled`);
                }, CLICK_OUTSIDE_DELAY_MS);

                // ============================================================
                // Update title
                // ============================================================
                const title = this.container.querySelector('.train-options-title');
                if (title) {
                    title.textContent = modelName || 'Rolling Stock';
                }

                // Position menu near click
                this.positionMenu(screenX, screenY);

                // Show menu
                this.container.style.display = 'block';
                this.isVisible = true;

                console.log(`${LOG_PREFIX} ✓ Menu displayed`);
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error showing menu:`, error);
        }
    }

    /**
     * Hide the menu
     * 
     * Also clears any pending click-outside delay timeout.
     */
    public hide(): void {
        try {
            // Clear the click-outside delay timeout if pending
            if (this.clickOutsideDelayTimeout) {
                clearTimeout(this.clickOutsideDelayTimeout);
                this.clickOutsideDelayTimeout = null;
            }
            this.ignoreNextOutsideClick = false;

            if (this.container) {
                this.container.style.display = 'none';
                this.isVisible = false;
                console.log(`${LOG_PREFIX} Menu hidden`);
            }

            this.currentModelId = null;
            this.currentModelName = '';

            // Call close callback
            if (this.config.onClose) {
                this.config.onClose();
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error hiding menu:`, error);
        }
    }

    /**
     * Check if menu is currently visible
     */
    public getIsVisible(): boolean {
        return this.isVisible;
    }

    /**
     * Get currently selected model ID
     */
    public getCurrentModelId(): string | null {
        return this.currentModelId;
    }

    /**
     * Dispose of the menu
     * 
     * Removes DOM elements and clears all timeouts.
     */
    public dispose(): void {
        try {
            // Clear any pending timeouts
            if (this.clickOutsideDelayTimeout) {
                clearTimeout(this.clickOutsideDelayTimeout);
                this.clickOutsideDelayTimeout = null;
            }

            if (this.container && this.container.parentNode) {
                this.container.parentNode.removeChild(this.container);
            }
            this.container = null;
            this.isVisible = false;
            console.log(`${LOG_PREFIX} Disposed`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error disposing:`, error);
        }
    }

    // ------------------------------------------------------------------------
    // PRIVATE METHODS - UI CREATION
    // ------------------------------------------------------------------------

    /**
     * Create the menu container element
     */
    private createContainer(): void {
        try {
            // Remove existing container if present
            const existing = document.getElementById('train-options-menu');
            if (existing) {
                existing.remove();
            }

            // Create container
            this.container = document.createElement('div');
            this.container.id = 'train-options-menu';
            this.container.className = 'train-options-menu';

            // Apply styles
            this.applyStyles();

            // Create content
            this.container.innerHTML = this.createMenuHTML();

            // Add to document
            document.body.appendChild(this.container);

            // Attach event handlers
            this.attachEventHandlers();

            // Initially hidden
            this.container.style.display = 'none';

            console.log(`${LOG_PREFIX} Container created`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error creating container:`, error);
        }
    }

    /**
     * Apply CSS styles for the menu
     */
    private applyStyles(): void {
        // Check if styles already exist
        if (document.getElementById('train-options-menu-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'train-options-menu-styles';
        style.textContent = `
            .train-options-menu {
                position: fixed;
                z-index: 10000;
                background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
                border: 1px solid #4a9eff;
                border-radius: 8px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(74, 158, 255, 0.2);
                min-width: 220px;
                font-family: 'Segoe UI', Arial, sans-serif;
                overflow: hidden;
            }

            .train-options-header {
                background: linear-gradient(90deg, #4a9eff 0%, #2d7dd2 100%);
                padding: 12px 16px;
                border-bottom: 1px solid #4a9eff;
            }

            .train-options-title {
                color: white;
                font-size: 14px;
                font-weight: 600;
                margin: 0;
                text-overflow: ellipsis;
                overflow: hidden;
                white-space: nowrap;
            }

            .train-options-subtitle {
                color: rgba(255, 255, 255, 0.7);
                font-size: 11px;
                margin-top: 2px;
            }

            .train-options-body {
                padding: 8px;
            }

            .train-option-btn {
                display: flex;
                align-items: center;
                width: 100%;
                padding: 10px 12px;
                margin-bottom: 4px;
                background: transparent;
                border: 1px solid transparent;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s ease;
                text-align: left;
            }

            .train-option-btn:last-child {
                margin-bottom: 0;
            }

            .train-option-btn:hover {
                background: rgba(74, 158, 255, 0.15);
                border-color: rgba(74, 158, 255, 0.3);
            }

            .train-option-icon {
                font-size: 20px;
                margin-right: 12px;
                width: 28px;
                text-align: center;
            }

            .train-option-text {
                flex: 1;
            }

            .train-option-label {
                color: white;
                font-size: 13px;
                font-weight: 500;
            }

            .train-option-desc {
                color: rgba(255, 255, 255, 0.5);
                font-size: 11px;
                margin-top: 2px;
            }

            .train-options-footer {
                padding: 8px 16px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                background: rgba(0, 0, 0, 0.2);
            }

            .train-options-hint {
                color: rgba(255, 255, 255, 0.4);
                font-size: 10px;
                text-align: center;
            }

            /* Drive mode button accent */
            .train-option-btn.drive-mode:hover {
                background: rgba(76, 175, 80, 0.2);
                border-color: rgba(76, 175, 80, 0.4);
            }

            /* Reposition mode button accent */
            .train-option-btn.reposition-mode:hover {
                background: rgba(241, 196, 15, 0.15);
                border-color: rgba(241, 196, 15, 0.3);
            }
        `;

        document.head.appendChild(style);
        console.log(`${LOG_PREFIX} Styles applied`);
    }

    /**
     * Create the menu HTML content
     */
    private createMenuHTML(): string {
        return `
            <div class="train-options-header">
                <div class="train-options-title">Rolling Stock</div>
                <div class="train-options-subtitle">Select an action</div>
            </div>
            <div class="train-options-body">
                <button class="train-option-btn drive-mode" data-action="drive">
                    <span class="train-option-icon">🚂</span>
                    <div class="train-option-text">
                        <div class="train-option-label">Drive Mode</div>
                        <div class="train-option-desc">Control with WASD/Arrow keys</div>
                    </div>
                </button>
                <button class="train-option-btn reposition-mode" data-action="reposition">
                    <span class="train-option-icon">✥</span>
                    <div class="train-option-text">
                        <div class="train-option-label">Reposition Mode</div>
                        <div class="train-option-desc">Move, rotate, and scale</div>
                    </div>
                </button>
            </div>
            <div class="train-options-footer">
                <div class="train-options-hint">Click outside or press ESC to close</div>
            </div>
        `;
    }

    /**
     * Attach event handlers to menu elements
     */
    private attachEventHandlers(): void {
        if (!this.container) return;

        try {
            // Drive mode button
            const driveBtn = this.container.querySelector('[data-action="drive"]');
            if (driveBtn) {
                driveBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleDriveMode();
                });
                console.log(`${LOG_PREFIX} Drive button handler attached`);
            }

            // Reposition mode button
            const repositionBtn = this.container.querySelector('[data-action="reposition"]');
            if (repositionBtn) {
                repositionBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleRepositionMode();
                });
                console.log(`${LOG_PREFIX} Reposition button handler attached`);
            }

            // Click outside to close
            document.addEventListener('click', this.handleOutsideClick.bind(this));

            // ESC to close
            document.addEventListener('keydown', this.handleKeyDown.bind(this));

            console.log(`${LOG_PREFIX} Event handlers attached`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error attaching event handlers:`, error);
        }
    }

    // ------------------------------------------------------------------------
    // PRIVATE METHODS - POSITIONING
    // ------------------------------------------------------------------------

    /**
     * Position the menu near the click point
     * @param screenX - Screen X coordinate
     * @param screenY - Screen Y coordinate
     */
    private positionMenu(screenX: number, screenY: number): void {
        if (!this.container) return;

        try {
            const menuWidth = 220;
            const menuHeight = 200;
            const padding = 10;

            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Calculate position, keeping menu in viewport
            let left = screenX + padding;
            let top = screenY + padding;

            // Adjust if would go off right edge
            if (left + menuWidth > viewportWidth - padding) {
                left = screenX - menuWidth - padding;
            }

            // Adjust if would go off bottom edge
            if (top + menuHeight > viewportHeight - padding) {
                top = screenY - menuHeight - padding;
            }

            // Ensure not off left or top edge
            left = Math.max(padding, left);
            top = Math.max(padding, top);

            this.container.style.left = `${left}px`;
            this.container.style.top = `${top}px`;

            console.log(`${LOG_PREFIX} Positioned at (${left}, ${top})`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error positioning menu:`, error);
        }
    }

    // ------------------------------------------------------------------------
    // PRIVATE METHODS - EVENT HANDLERS
    // ------------------------------------------------------------------------

    /**
     * Handle Drive mode selection
     */
    private handleDriveMode(): void {
        console.log(`${LOG_PREFIX} Drive mode selected for: ${this.currentModelId}`);

        if (this.currentModelId && this.config.onDriveMode) {
            try {
                this.config.onDriveMode(this.currentModelId);
                console.log(`${LOG_PREFIX} ✓ Drive mode callback executed`);
            } catch (error) {
                console.error(`${LOG_PREFIX} Error in drive mode callback:`, error);
            }
        }

        this.hide();
    }

    /**
     * Handle Reposition mode selection
     */
    private handleRepositionMode(): void {
        console.log(`${LOG_PREFIX} Reposition mode selected for: ${this.currentModelId}`);

        if (this.currentModelId && this.config.onRepositionMode) {
            try {
                this.config.onRepositionMode(this.currentModelId);
                console.log(`${LOG_PREFIX} ✓ Reposition mode callback executed`);
            } catch (error) {
                console.error(`${LOG_PREFIX} Error in reposition mode callback:`, error);
            }
        }

        this.hide();
    }

    /**
     * Handle click outside menu
     * 
     * FIX (v1.1.0): Now checks the ignoreNextOutsideClick flag before
     * closing. This flag is set when the menu is shown and cleared after
     * a short delay, preventing the opening click from closing the menu.
     */
    private handleOutsideClick(event: MouseEvent): void {
        if (!this.isVisible || !this.container) return;

        // ====================================================================
        // FIX: Check if we should ignore this click
        // ====================================================================
        // If the menu was just shown, ignore this click event because it's
        // likely the same click that triggered show(). The flag is cleared
        // after a short delay in show().
        if (this.ignoreNextOutsideClick) {
            console.log(`${LOG_PREFIX} Ignoring click (menu just opened)`);
            return;
        }

        try {
            const target = event.target as HTMLElement;
            if (!this.container.contains(target)) {
                console.log(`${LOG_PREFIX} Click outside - closing menu`);
                this.hide();
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error handling outside click:`, error);
        }
    }

    /**
     * Handle keyboard events
     */
    private handleKeyDown(event: KeyboardEvent): void {
        if (!this.isVisible) return;

        try {
            if (event.key === 'Escape') {
                console.log(`${LOG_PREFIX} ESC pressed - closing menu`);
                this.hide();
                event.preventDefault();
                event.stopPropagation();
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error handling keydown:`, error);
        }
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default TrainOptionsMenu;