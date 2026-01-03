/**
 * TrainOptionsMenu.ts
 * 
 * Popup menu that appears when a rolling stock model is selected.
 * Provides options to:
 * - Enable Drive Mode (registers with TrainSystem for driving controls)
 * - Reposition Mode (allows moving/scaling the model)
 * 
 * @module ui/TrainOptionsMenu
 */

// ============================================================================
// IMPORTS
// ============================================================================

import type { Scene } from '@babylonjs/core/scene';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix for console output */
const LOG_PREFIX = '[TrainOptionsMenu]';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Configuration for TrainOptionsMenu
 */
export interface TrainOptionsMenuConfig {
    /** Babylon.js scene reference */
    scene: Scene;
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
                // Update title
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
     */
    public hide(): void {
        try {
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
     */
    public dispose(): void {
        try {
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
                padding: 12px 14px;
                margin: 4px 0;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 6px;
                color: white;
                cursor: pointer;
                transition: all 0.2s ease;
                text-align: left;
            }

            .train-option-btn:hover {
                background: rgba(74, 158, 255, 0.2);
                border-color: #4a9eff;
                transform: translateX(4px);
            }

            .train-option-btn:active {
                transform: translateX(2px);
            }

            .train-option-icon {
                font-size: 24px;
                margin-right: 12px;
                width: 32px;
                text-align: center;
            }

            .train-option-text {
                flex: 1;
            }

            .train-option-label {
                font-size: 14px;
                font-weight: 500;
                margin-bottom: 2px;
            }

            .train-option-desc {
                font-size: 11px;
                color: rgba(255, 255, 255, 0.6);
            }

            .train-options-footer {
                padding: 8px 12px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                background: rgba(0, 0, 0, 0.2);
            }

            .train-options-hint {
                color: rgba(255, 255, 255, 0.5);
                font-size: 10px;
                text-align: center;
            }

            /* Drive mode button special styling */
            .train-option-btn.drive-mode {
                background: rgba(46, 204, 113, 0.1);
                border-color: rgba(46, 204, 113, 0.3);
            }

            .train-option-btn.drive-mode:hover {
                background: rgba(46, 204, 113, 0.25);
                border-color: #2ecc71;
            }

            /* Reposition mode button */
            .train-option-btn.reposition-mode {
                background: rgba(241, 196, 15, 0.1);
                border-color: rgba(241, 196, 15, 0.3);
            }

            .train-option-btn.reposition-mode:hover {
                background: rgba(241, 196, 15, 0.25);
                border-color: #f1c40f;
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
     */
    private handleOutsideClick(event: MouseEvent): void {
        if (!this.isVisible || !this.container) return;

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