/**
 * NotificationSystem.ts - Simple popup notifications
 * 
 * Path: frontend/src/ui/NotificationSystem.ts
 * 
 * Provides simple, non-blocking notifications for user feedback.
 * Used to show messages like "Click on track to place locomotive".
 * 
 * @module NotificationSystem
 * @author Model Railway Workbench
 * @version 1.0.0
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default duration for notifications (ms) */
const DEFAULT_DURATION = 5000;

/** Animation duration (ms) */
const ANIMATION_DURATION = 300;

/** Z-index for notifications */
const Z_INDEX = 10000;

// ============================================================================
// TYPES
// ============================================================================

/** Notification types */
export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'action';

/** Notification options */
export interface NotificationOptions {
    /** Duration in milliseconds (0 = persistent until dismissed) */
    duration?: number;
    /** Notification type for styling */
    type?: NotificationType;
    /** Show dismiss button */
    dismissible?: boolean;
    /** Action button text (optional) */
    actionText?: string;
    /** Action button callback */
    onAction?: () => void;
    /** Called when notification is dismissed */
    onDismiss?: () => void;
}

// ============================================================================
// STYLES
// ============================================================================

const NOTIFICATION_STYLES = `
.mrw-notification-container {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: ${Z_INDEX};
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    pointer-events: none;
}

.mrw-notification {
    background: #333;
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 500px;
    pointer-events: auto;
    animation: mrw-slide-in ${ANIMATION_DURATION}ms ease-out;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
}

.mrw-notification.mrw-fade-out {
    animation: mrw-slide-out ${ANIMATION_DURATION}ms ease-in forwards;
}

.mrw-notification.info {
    background: #2196F3;
}

.mrw-notification.success {
    background: #4CAF50;
}

.mrw-notification.warning {
    background: #FF9800;
    color: #000;
}

.mrw-notification.error {
    background: #f44336;
}

.mrw-notification.action {
    background: #673AB7;
}

.mrw-notification-icon {
    font-size: 20px;
    flex-shrink: 0;
}

.mrw-notification-message {
    flex: 1;
    line-height: 1.4;
}

.mrw-notification-action {
    background: rgba(255,255,255,0.2);
    border: none;
    color: inherit;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    font-size: 13px;
    transition: background 0.2s;
}

.mrw-notification-action:hover {
    background: rgba(255,255,255,0.3);
}

.mrw-notification-dismiss {
    background: none;
    border: none;
    color: inherit;
    opacity: 0.7;
    cursor: pointer;
    padding: 4px;
    font-size: 18px;
    line-height: 1;
}

.mrw-notification-dismiss:hover {
    opacity: 1;
}

@keyframes mrw-slide-in {
    from {
        opacity: 0;
        transform: translateY(-20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes mrw-slide-out {
    from {
        opacity: 1;
        transform: translateY(0);
    }
    to {
        opacity: 0;
        transform: translateY(-20px);
    }
}
`;

// ============================================================================
// NOTIFICATION SYSTEM CLASS
// ============================================================================

/**
 * NotificationSystem - Simple popup notifications
 * 
 * @example
 * ```typescript
 * const notifications = NotificationSystem.getInstance();
 * 
 * // Simple message
 * notifications.show('Model imported successfully!', { type: 'success' });
 * 
 * // Action notification
 * notifications.show('Click on track to place locomotive', {
 *     type: 'action',
 *     duration: 0,  // Persistent
 *     actionText: 'Cancel',
 *     onAction: () => cancelPlacement()
 * });
 * ```
 */
export class NotificationSystem {
    // ========================================================================
    // SINGLETON
    // ========================================================================

    private static instance: NotificationSystem | null = null;

    /**
     * Get the singleton instance
     */
    static getInstance(): NotificationSystem {
        if (!NotificationSystem.instance) {
            NotificationSystem.instance = new NotificationSystem();
        }
        return NotificationSystem.instance;
    }

    // ========================================================================
    // PRIVATE STATE
    // ========================================================================

    /** Container element */
    private container: HTMLElement | null = null;

    /** Active notifications */
    private notifications: Map<string, HTMLElement> = new Map();

    /** Counter for unique IDs */
    private idCounter = 0;

    /** Styles injected */
    private stylesInjected = false;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    private constructor() {
        this.initialize();
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the notification system
     */
    private initialize(): void {
        // Inject styles
        if (!this.stylesInjected) {
            const style = document.createElement('style');
            style.textContent = NOTIFICATION_STYLES;
            document.head.appendChild(style);
            this.stylesInjected = true;
        }

        // Create container
        this.container = document.createElement('div');
        this.container.className = 'mrw-notification-container';
        document.body.appendChild(this.container);
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /**
     * Show a notification
     * @param message - Message to display
     * @param options - Notification options
     * @returns Notification ID (can be used to dismiss)
     */
    show(message: string, options: NotificationOptions = {}): string {
        const {
            duration = DEFAULT_DURATION,
            type = 'info',
            dismissible = true,
            actionText,
            onAction,
            onDismiss
        } = options;

        const id = `notification-${++this.idCounter}`;

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `mrw-notification ${type}`;
        notification.id = id;

        // Icon based on type
        const icons: Record<NotificationType, string> = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            action: '🚂'
        };

        // Build HTML
        let html = `
            <span class="mrw-notification-icon">${icons[type]}</span>
            <span class="mrw-notification-message">${message}</span>
        `;

        if (actionText) {
            html += `<button class="mrw-notification-action">${actionText}</button>`;
        }

        if (dismissible) {
            html += `<button class="mrw-notification-dismiss">×</button>`;
        }

        notification.innerHTML = html;

        // Event handlers
        if (actionText && onAction) {
            const actionBtn = notification.querySelector('.mrw-notification-action');
            actionBtn?.addEventListener('click', () => {
                onAction();
                this.dismiss(id);
            });
        }

        if (dismissible) {
            const dismissBtn = notification.querySelector('.mrw-notification-dismiss');
            dismissBtn?.addEventListener('click', () => {
                this.dismiss(id);
                onDismiss?.();
            });
        }

        // Add to container
        this.container?.appendChild(notification);
        this.notifications.set(id, notification);

        // Auto-dismiss after duration (if not 0)
        if (duration > 0) {
            setTimeout(() => {
                this.dismiss(id);
                onDismiss?.();
            }, duration);
        }

        return id;
    }

    /**
     * Dismiss a notification
     * @param id - Notification ID
     */
    dismiss(id: string): void {
        const notification = this.notifications.get(id);
        if (!notification) return;

        // Animate out
        notification.classList.add('mrw-fade-out');

        // Remove after animation
        setTimeout(() => {
            notification.remove();
            this.notifications.delete(id);
        }, ANIMATION_DURATION);
    }

    /**
     * Dismiss all notifications
     */
    dismissAll(): void {
        for (const id of this.notifications.keys()) {
            this.dismiss(id);
        }
    }

    // ========================================================================
    // CONVENIENCE METHODS
    // ========================================================================

    /**
     * Show an info notification
     */
    info(message: string, duration = DEFAULT_DURATION): string {
        return this.show(message, { type: 'info', duration });
    }

    /**
     * Show a success notification
     */
    success(message: string, duration = DEFAULT_DURATION): string {
        return this.show(message, { type: 'success', duration });
    }

    /**
     * Show a warning notification
     */
    warning(message: string, duration = DEFAULT_DURATION): string {
        return this.show(message, { type: 'warning', duration });
    }

    /**
     * Show an error notification
     */
    error(message: string, duration = DEFAULT_DURATION): string {
        return this.show(message, { type: 'error', duration });
    }

    /**
     * Show a placement instruction (persistent until cancelled)
     * @param message - Instruction message
     * @param onCancel - Called when user cancels
     * @returns Notification ID
     */
    showPlacementInstruction(message: string, onCancel: () => void): string {
        return this.show(message, {
            type: 'action',
            duration: 0,
            dismissible: true,
            actionText: 'Cancel',
            onAction: onCancel,
            onDismiss: onCancel
        });
    }
}

// ============================================================================
// CONVENIENCE EXPORT
// ============================================================================

/**
 * Quick access to notification system
 */
export const notify = {
    show: (message: string, options?: NotificationOptions) =>
        NotificationSystem.getInstance().show(message, options),
    info: (message: string, duration?: number) =>
        NotificationSystem.getInstance().info(message, duration),
    success: (message: string, duration?: number) =>
        NotificationSystem.getInstance().success(message, duration),
    warning: (message: string, duration?: number) =>
        NotificationSystem.getInstance().warning(message, duration),
    error: (message: string, duration?: number) =>
        NotificationSystem.getInstance().error(message, duration),
    dismiss: (id: string) =>
        NotificationSystem.getInstance().dismiss(id),
    dismissAll: () =>
        NotificationSystem.getInstance().dismissAll(),
    placement: (message: string, onCancel: () => void) =>
        NotificationSystem.getInstance().showPlacementInstruction(message, onCancel)
};