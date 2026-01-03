/**
 * TrainSelectionModal.ts - Train Action Selection Modal
 * 
 * Path: frontend/src/ui/TrainSelectionModal.ts
 * 
 * Displays a modal popup when a train is clicked, allowing the user to choose:
 *   - Option 1: Lift & Move - Pick up and reposition the train
 *   - Option 2: Drive - Control the train with keyboard (WASD, etc.)
 * 
 * Features:
 *   - Keyboard shortcuts (1 for move, 2 for drive, Escape to cancel)
 *   - Click-away to dismiss
 *   - Positioned near the click location
 *   - Themed to match application UI
 * 
 * @module TrainSelectionModal
 * @author Model Railway Workbench
 * @version 1.0.0
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** Log prefix for console messages */
const LOG_PREFIX = '[TrainSelectionModal]';

/** Z-index for modal overlay */
const MODAL_Z_INDEX = 15000;

/** Modal width in pixels */
const MODAL_WIDTH = 280;

/** Animation duration in milliseconds */
const ANIMATION_DURATION = 150;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Available actions when selecting a train
 */
export type TrainAction = 'move' | 'drive' | 'cancel';

/**
 * Result of the train selection modal
 */
export interface TrainSelectionResult {
    /** The action chosen by the user */
    action: TrainAction;
    /** ID of the train that was clicked */
    trainId: string;
    /** Name of the train */
    trainName: string;
}

/**
 * Options for showing the modal
 */
export interface TrainSelectionOptions {
    /** ID of the train */
    trainId: string;
    /** Display name of the train */
    trainName: string;
    /** Screen X position for modal placement */
    screenX: number;
    /** Screen Y position for modal placement */
    screenY: number;
}

/**
 * Callback for modal result
 */
export type TrainSelectionCallback = (result: TrainSelectionResult) => void;

// ============================================================================
// STYLES
// ============================================================================

/**
 * Get CSS styles for the overlay backdrop
 * @returns CSS string
 */
function getOverlayStyles(): string {
    return `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.4);
        z-index: ${MODAL_Z_INDEX - 1};
        animation: fadeIn ${ANIMATION_DURATION}ms ease-out;
    `;
}

/**
 * Get CSS styles for the modal container
 * @param x - Screen X position
 * @param y - Screen Y position
 * @returns CSS string
 */
function getModalStyles(x: number, y: number): string {
    // Adjust position to keep modal on screen
    const adjustedX = Math.min(x, window.innerWidth - MODAL_WIDTH - 20);
    const adjustedY = Math.min(y, window.innerHeight - 250);

    return `
        position: fixed;
        left: ${Math.max(20, adjustedX)}px;
        top: ${Math.max(20, adjustedY)}px;
        width: ${MODAL_WIDTH}px;
        background: #2a2a2a;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3);
        z-index: ${MODAL_Z_INDEX};
        overflow: hidden;
        animation: slideIn ${ANIMATION_DURATION}ms ease-out;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
}

/**
 * Get CSS styles for action buttons
 * @param isPrimary - Whether this is the primary action
 * @returns CSS string
 */
function getButtonStyles(isPrimary: boolean): string {
    const baseColor = isPrimary ? '#4CAF50' : '#2196F3';
    const hoverColor = isPrimary ? '#45a049' : '#1976D2';

    return `
        display: flex;
        align-items: center;
        width: 100%;
        padding: 14px 16px;
        border: none;
        background: transparent;
        color: #fff;
        font-size: 14px;
        cursor: pointer;
        transition: background 0.15s, transform 0.1s;
        text-align: left;
        gap: 12px;
    `;
}

/**
 * Inject keyframe animations into document
 */
function injectAnimations(): void {
    const styleId = 'train-selection-modal-animations';

    // Only inject once
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideIn {
            from { 
                opacity: 0; 
                transform: scale(0.95) translateY(-10px); 
            }
            to { 
                opacity: 1; 
                transform: scale(1) translateY(0); 
            }
        }
        
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        
        .train-action-btn:hover {
            background: rgba(255, 255, 255, 0.1) !important;
        }
        
        .train-action-btn:active {
            transform: scale(0.98);
        }
        
        .train-action-btn .shortcut-key {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 22px;
            height: 22px;
            background: rgba(255, 255, 255, 0.15);
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            margin-left: auto;
        }
    `;

    document.head.appendChild(style);
}

// ============================================================================
// MODAL HTML BUILDER
// ============================================================================

/**
 * Build the modal HTML content
 * @param trainName - Name of the train to display
 * @returns HTML string
 */
function buildModalHTML(trainName: string): string {
    // Truncate long train names
    const displayName = trainName.length > 25
        ? trainName.substring(0, 22) + '...'
        : trainName;

    return `
        <!-- Header -->
        <div style="
            padding: 16px;
            background: linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%);
            border-bottom: 1px solid #444;
        ">
            <div style="
                display: flex;
                align-items: center;
                gap: 10px;
            ">
                <span style="font-size: 24px;">🚂</span>
                <div>
                    <div style="
                        font-size: 11px;
                        color: #888;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        margin-bottom: 2px;
                    ">Select Action</div>
                    <div style="
                        font-size: 14px;
                        font-weight: 600;
                        color: #fff;
                    ">${displayName}</div>
                </div>
            </div>
        </div>
        
        <!-- Actions -->
        <div style="padding: 8px 0;">
            <!-- Move Button -->
            <button id="train-action-move" class="train-action-btn" style="${getButtonStyles(false)}">
                <span style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    background: rgba(33, 150, 243, 0.2);
                    border-radius: 8px;
                    font-size: 18px;
                ">✋</span>
                <div style="flex: 1;">
                    <div style="font-weight: 500;">Lift & Move</div>
                    <div style="font-size: 11px; color: #888; margin-top: 2px;">
                        Pick up and reposition
                    </div>
                </div>
                <span class="shortcut-key">1</span>
            </button>
            
            <!-- Divider -->
            <div style="
                height: 1px;
                background: #444;
                margin: 4px 16px;
            "></div>
            
            <!-- Drive Button -->
            <button id="train-action-drive" class="train-action-btn" style="${getButtonStyles(true)}">
                <span style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    background: rgba(76, 175, 80, 0.2);
                    border-radius: 8px;
                    font-size: 18px;
                ">🎮</span>
                <div style="flex: 1;">
                    <div style="font-weight: 500;">Drive</div>
                    <div style="font-size: 11px; color: #888; margin-top: 2px;">
                        Control with WASD keys
                    </div>
                </div>
                <span class="shortcut-key">2</span>
            </button>
        </div>
        
        <!-- Footer hint -->
        <div style="
            padding: 10px 16px;
            background: #222;
            border-top: 1px solid #333;
            font-size: 11px;
            color: #666;
            text-align: center;
        ">
            Press <kbd style="
                background: #333;
                padding: 2px 6px;
                border-radius: 3px;
                margin: 0 2px;
            ">ESC</kbd> or click outside to cancel
        </div>
    `;
}

// ============================================================================
// TRAIN SELECTION MODAL CLASS
// ============================================================================

/**
 * TrainSelectionModal - Modal for choosing train action
 * 
 * Singleton pattern - only one modal can be active at a time.
 * 
 * @example
 * ```typescript
 * const modal = TrainSelectionModal.getInstance();
 * modal.show({
 *     trainId: 'train-001',
 *     trainName: 'Class 66 Diesel',
 *     screenX: event.clientX,
 *     screenY: event.clientY
 * }, (result) => {
 *     if (result.action === 'drive') {
 *         trainSystem.selectForDriving(result.trainId);
 *     } else if (result.action === 'move') {
 *         trainSystem.enableRepositioning(result.trainId);
 *     }
 * });
 * ```
 */
export class TrainSelectionModal {
    // ========================================================================
    // SINGLETON
    // ========================================================================

    /** Singleton instance */
    private static instance: TrainSelectionModal | null = null;

    /**
     * Get the singleton instance
     * @returns TrainSelectionModal instance
     */
    public static getInstance(): TrainSelectionModal {
        if (!TrainSelectionModal.instance) {
            TrainSelectionModal.instance = new TrainSelectionModal();
        }
        return TrainSelectionModal.instance;
    }

    // ========================================================================
    // PRIVATE PROPERTIES
    // ========================================================================

    /** Overlay element */
    private overlay: HTMLDivElement | null = null;

    /** Modal container element */
    private modal: HTMLDivElement | null = null;

    /** Current options */
    private currentOptions: TrainSelectionOptions | null = null;

    /** Current callback */
    private currentCallback: TrainSelectionCallback | null = null;

    /** Bound keyboard handler */
    private boundKeyHandler: ((e: KeyboardEvent) => void) | null = null;

    /** Whether modal is currently visible */
    private isVisible: boolean = false;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Private constructor for singleton pattern
     */
    private constructor() {
        // Inject animations on first instantiation
        injectAnimations();

        console.log(`${LOG_PREFIX} Initialized`);
    }

    // ========================================================================
    // PUBLIC METHODS
    // ========================================================================

    /**
     * Show the train selection modal
     * 
     * @param options - Options including train info and position
     * @param callback - Called when user makes a selection
     */
    public show(options: TrainSelectionOptions, callback: TrainSelectionCallback): void {
        try {
            // Close any existing modal first
            if (this.isVisible) {
                this.close('cancel', false);
            }

            this.currentOptions = options;
            this.currentCallback = callback;

            // Create modal elements
            this.createModal(options);

            // Setup event handlers
            this.setupEventHandlers();

            this.isVisible = true;

            console.log(`${LOG_PREFIX} Showing modal for train: ${options.trainName}`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to show modal:`, error);

            // Cleanup on error
            this.cleanup();

            // Return cancel result
            if (callback) {
                callback({
                    action: 'cancel',
                    trainId: options.trainId,
                    trainName: options.trainName
                });
            }
        }
    }

    /**
     * Check if the modal is currently visible
     * @returns True if modal is showing
     */
    public isOpen(): boolean {
        return this.isVisible;
    }

    /**
     * Force close the modal (for external use)
     */
    public forceClose(): void {
        if (this.isVisible) {
            this.close('cancel', true);
        }
    }

    // ========================================================================
    // PRIVATE METHODS - MODAL CREATION
    // ========================================================================

    /**
     * Create the modal DOM elements
     * @param options - Modal options
     */
    private createModal(options: TrainSelectionOptions): void {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.style.cssText = getOverlayStyles();
        this.overlay.addEventListener('click', (e) => {
            // Only close if clicking directly on overlay (not modal)
            if (e.target === this.overlay) {
                this.close('cancel', true);
            }
        });

        // Create modal container
        this.modal = document.createElement('div');
        this.modal.style.cssText = getModalStyles(options.screenX, options.screenY);
        this.modal.innerHTML = buildModalHTML(options.trainName);

        // Prevent clicks on modal from closing
        this.modal.addEventListener('click', (e) => e.stopPropagation());

        // Attach button handlers
        this.attachButtonHandlers();

        // Add to DOM
        document.body.appendChild(this.overlay);
        document.body.appendChild(this.modal);
    }

    /**
     * Attach click handlers to action buttons
     */
    private attachButtonHandlers(): void {
        if (!this.modal) return;

        // Move button
        const moveBtn = this.modal.querySelector('#train-action-move') as HTMLButtonElement;
        if (moveBtn) {
            moveBtn.addEventListener('click', () => this.close('move', true));

            // Add hover effect
            moveBtn.addEventListener('mouseenter', () => {
                moveBtn.style.background = 'rgba(33, 150, 243, 0.15)';
            });
            moveBtn.addEventListener('mouseleave', () => {
                moveBtn.style.background = 'transparent';
            });
        }

        // Drive button
        const driveBtn = this.modal.querySelector('#train-action-drive') as HTMLButtonElement;
        if (driveBtn) {
            driveBtn.addEventListener('click', () => this.close('drive', true));

            // Add hover effect
            driveBtn.addEventListener('mouseenter', () => {
                driveBtn.style.background = 'rgba(76, 175, 80, 0.15)';
            });
            driveBtn.addEventListener('mouseleave', () => {
                driveBtn.style.background = 'transparent';
            });
        }
    }

    // ========================================================================
    // PRIVATE METHODS - EVENT HANDLING
    // ========================================================================

    /**
     * Setup keyboard event handlers
     */
    private setupEventHandlers(): void {
        // Keyboard handler for shortcuts
        this.boundKeyHandler = (e: KeyboardEvent) => {
            // Prevent handling if typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            switch (e.key) {
                case '1':
                    e.preventDefault();
                    this.close('move', true);
                    break;

                case '2':
                    e.preventDefault();
                    this.close('drive', true);
                    break;

                case 'Escape':
                    e.preventDefault();
                    this.close('cancel', true);
                    break;
            }
        };

        window.addEventListener('keydown', this.boundKeyHandler);
    }

    /**
     * Remove event handlers
     */
    private removeEventHandlers(): void {
        if (this.boundKeyHandler) {
            window.removeEventListener('keydown', this.boundKeyHandler);
            this.boundKeyHandler = null;
        }
    }

    // ========================================================================
    // PRIVATE METHODS - CLOSING
    // ========================================================================

    /**
     * Close the modal with a specific action
     * 
     * @param action - The action to return
     * @param animate - Whether to animate the close
     */
    private close(action: TrainAction, animate: boolean): void {
        if (!this.isVisible) return;

        const options = this.currentOptions;
        const callback = this.currentCallback;

        console.log(`${LOG_PREFIX} Closing with action: ${action}`);

        if (animate) {
            // Animate out
            this.animateClose(() => {
                this.cleanup();
                this.invokeCallback(action, options, callback);
            });
        } else {
            // Immediate close
            this.cleanup();
            this.invokeCallback(action, options, callback);
        }
    }

    /**
     * Animate the modal closing
     * @param onComplete - Called when animation completes
     */
    private animateClose(onComplete: () => void): void {
        if (this.overlay) {
            this.overlay.style.animation = `fadeOut ${ANIMATION_DURATION}ms ease-out forwards`;
        }
        if (this.modal) {
            this.modal.style.animation = `fadeOut ${ANIMATION_DURATION}ms ease-out forwards`;
        }

        setTimeout(onComplete, ANIMATION_DURATION);
    }

    /**
     * Cleanup modal elements and state
     */
    private cleanup(): void {
        // Remove event handlers
        this.removeEventHandlers();

        // Remove DOM elements
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        if (this.modal && this.modal.parentNode) {
            this.modal.parentNode.removeChild(this.modal);
        }

        // Clear references
        this.overlay = null;
        this.modal = null;
        this.currentOptions = null;
        this.currentCallback = null;
        this.isVisible = false;
    }

    /**
     * Invoke the callback with the result
     * 
     * @param action - The action chosen
     * @param options - Original options (may be null)
     * @param callback - Callback to invoke (may be null)
     */
    private invokeCallback(
        action: TrainAction,
        options: TrainSelectionOptions | null,
        callback: TrainSelectionCallback | null
    ): void {
        if (!callback || !options) return;

        try {
            callback({
                action,
                trainId: options.trainId,
                trainName: options.trainName
            });
        } catch (error) {
            console.error(`${LOG_PREFIX} Error in callback:`, error);
        }
    }
}

// ============================================================================
// CONVENIENCE FUNCTION
// ============================================================================

/**
 * Show the train selection modal (convenience function)
 * 
 * @param options - Modal options
 * @param callback - Result callback
 * 
 * @example
 * ```typescript
 * import { showTrainSelectionModal } from './TrainSelectionModal';
 * 
 * showTrainSelectionModal({
 *     trainId: 'train-001',
 *     trainName: 'BR Class 47',
 *     screenX: 500,
 *     screenY: 300
 * }, (result) => {
 *     console.log('User chose:', result.action);
 * });
 * ```
 */
export function showTrainSelectionModal(
    options: TrainSelectionOptions,
    callback: TrainSelectionCallback
): void {
    TrainSelectionModal.getInstance().show(options, callback);
}

/**
 * Check if the train selection modal is currently open
 * @returns True if modal is showing
 */
export function isTrainSelectionModalOpen(): boolean {
    return TrainSelectionModal.getInstance().isOpen();
}

/**
 * Force close the train selection modal
 */
export function closeTrainSelectionModal(): void {
    TrainSelectionModal.getInstance().forceClose();
}