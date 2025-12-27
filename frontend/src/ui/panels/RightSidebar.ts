/**
 * RightSidebar.ts - Right-side panel container with World Outliner
 * 
 * Path: frontend/src/ui/panels/RightSidebar.ts
 * 
 * Container panel positioned on the right side of the screen,
 * hosting the World Outliner at the top and additional panels below.
 * Features a slide-out toggle tab for opening/closing.
 * 
 * @module RightSidebar
 * @author Model Railway Workbench
 * @version 2.0.0
 */

import { WorldOutliner } from '../../systems/outliner/WorldOutliner';
import { OutlinerPanel } from './OutlinerPanel';

// ============================================================================
// CONSTANTS & STYLES
// ============================================================================

/** Color scheme for the sidebar - matching UIManager theme */
const SIDEBAR_COLORS = {
    // Core colors
    PRIMARY: '#2c3e50',
    PRIMARY_LIGHT: '#34495e',
    PRIMARY_DARK: '#1a252f',
    ACCENT: '#27ae60',
    ACCENT_HOVER: '#2ecc71',

    // Background colors
    BACKGROUND: 'linear-gradient(180deg, #1e272e 0%, #1a252f 100%)',
    HEADER_BG: '#2a2a2a',
    HEADER_TEXT: '#fff',

    // Borders
    BORDER: '#333',
    BORDER_LIGHT: 'rgba(255,255,255,0.1)',

    // Misc
    RESIZE_HANDLE: '#555',
    RESIZE_HANDLE_HOVER: '#4285f4',
    TEXT_MUTED: '#b2bec3',
    TEXT_LIGHT: '#ffffff',

    // Shadows
    SHADOW_XL: '0 12px 48px rgba(0,0,0,0.3)',
} as const;

/** Default sidebar configuration */
const DEFAULT_CONFIG = {
    width: 280,
    minWidth: 200,
    maxWidth: 500,
    defaultCollapsed: true, // Start closed as requested
    animationDuration: 250,
    toggleButtonSize: 48,
    toggleButtonHeight: 80,
} as const;

// ============================================================================
// RIGHT SIDEBAR CLASS
// ============================================================================

/**
 * RightSidebar - Collapsible right-side panel container
 * 
 * Contains:
 * - World Outliner (top section)
 * - Future: Properties panel, Inspector, etc.
 * 
 * Features:
 * - External toggle tab (positioned above models sidebar tab)
 * - Collapsible with smooth animation
 * - Resizable width
 * - Persistent state
 * 
 * @example
 * ```typescript
 * const sidebar = new RightSidebar(outliner);
 * sidebar.initialize();
 * document.body.appendChild(sidebar.getElement());
 * ```
 */
export class RightSidebar {
    // ========================================================================
    // PROPERTIES
    // ========================================================================

    /** WorldOutliner system reference */
    private outliner: WorldOutliner;

    /** OutlinerPanel instance */
    private outlinerPanel: OutlinerPanel | null = null;

    /** Main container element */
    private container: HTMLElement | null = null;

    /** Toggle button element (external tab) */
    private toggleButton: HTMLElement | null = null;

    /** Content wrapper (for collapse animation) */
    private contentWrapper: HTMLElement | null = null;

    /** Resize handle element */
    private resizeHandle: HTMLElement | null = null;

    /** Current width in pixels */
    private currentWidth: number = DEFAULT_CONFIG.width;

    /** Whether the sidebar is collapsed */
    private isCollapsed: boolean = DEFAULT_CONFIG.defaultCollapsed;

    /** Whether currently resizing */
    private isResizing: boolean = false;

    /** Callback when sidebar is toggled */
    private onToggleCallback: ((collapsed: boolean) => void) | null = null;

    /** Callback when selection changes */
    private onSelectionCallback: ((nodeIds: string[]) => void) | null = null;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new RightSidebar
     * @param outliner - WorldOutliner instance
     */
    constructor(outliner: WorldOutliner) {
        this.outliner = outliner;
        console.log('[RightSidebar] Created');
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the sidebar and its contents
     */
    initialize(): void {
        try {
            console.log('[RightSidebar] Initializing...');

            // Inject styles for the toggle button
            this.injectStyles();

            // Create container
            this.createContainer();

            // Create toggle button (external tab)
            this.createToggleButton();

            // Create outliner panel
            this.createOutlinerPanel();

            // Create placeholder for future panels
            this.createPlaceholderSection();

            // Setup resize functionality
            this.setupResize();

            // Load saved state
            this.loadState();

            console.log('[RightSidebar] ✓ Initialized');
        } catch (error) {
            console.error('[RightSidebar] Initialization error:', error);
            throw error;
        }
    }

    // ========================================================================
    // STYLE INJECTION
    // ========================================================================

    /**
     * Inject CSS styles for the toggle button and animations
     */
    private injectStyles(): void {
        const styleId = 'right-sidebar-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* ============================================
               OUTLINER TOGGLE BUTTON
               ============================================ */
            .outliner-toggle-btn {
                position: fixed;
                top: calc(50% - 100px);
                right: ${DEFAULT_CONFIG.width}px;
                transform: translateY(-50%);
                width: 32px;
                height: ${DEFAULT_CONFIG.toggleButtonHeight}px;
                background: ${SIDEBAR_COLORS.PRIMARY};
                border: none;
                border-radius: 8px 0 0 8px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: -4px 0 12px rgba(0,0,0,0.2);
                transition: all 0.25s ease;
                z-index: 1001;
                padding: 8px 4px;
            }
            
            .outliner-toggle-btn:hover {
                background: ${SIDEBAR_COLORS.PRIMARY_LIGHT};
                width: 38px;
            }
            
            .outliner-toggle-btn.sidebar-collapsed {
                right: 0;
            }

            .outliner-toggle-btn .toggle-label {
                writing-mode: vertical-rl;
                text-orientation: mixed;
                transform: rotate(180deg);
                font-size: 12px;
                font-weight: 600;
                color: ${SIDEBAR_COLORS.TEXT_LIGHT};
                letter-spacing: 1px;
                text-transform: uppercase;
            }

            /* ============================================
               OUTLINER SIDEBAR
               ============================================ */
            .outliner-sidebar {
                position: fixed;
                top: 0;
                right: 0;
                width: ${DEFAULT_CONFIG.width}px;
                height: 100vh;
                background: ${SIDEBAR_COLORS.BACKGROUND};
                border-left: 2px solid ${SIDEBAR_COLORS.BORDER};
                box-shadow: ${SIDEBAR_COLORS.SHADOW_XL};
                display: flex;
                flex-direction: column;
                z-index: 1000;
                transform: translateX(0);
                transition: transform ${DEFAULT_CONFIG.animationDuration}ms ease;
                font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
            }
            
            .outliner-sidebar.collapsed {
                transform: translateX(100%);
            }

            /* ============================================
               RESIZE HANDLE
               ============================================ */
            .outliner-resize-handle {
                position: absolute;
                left: -4px;
                top: 0;
                width: 8px;
                height: 100%;
                cursor: ew-resize;
                background: transparent;
                transition: background 0.15s;
                z-index: 1001;
            }

            .outliner-resize-handle:hover {
                background: ${SIDEBAR_COLORS.RESIZE_HANDLE_HOVER};
            }

            /* ============================================
               SCROLLBAR STYLING
               ============================================ */
            .outliner-sidebar ::-webkit-scrollbar {
                width: 6px;
            }
            
            .outliner-sidebar ::-webkit-scrollbar-track {
                background: transparent;
            }
            
            .outliner-sidebar ::-webkit-scrollbar-thumb {
                background: #636e72;
                border-radius: 3px;
            }
            
            .outliner-sidebar ::-webkit-scrollbar-thumb:hover {
                background: #b2bec3;
            }
        `;
        document.head.appendChild(style);
    }

    // ========================================================================
    // DOM CREATION
    // ========================================================================

    /**
     * Create the main container element
     */
    private createContainer(): void {
        // Main container
        this.container = document.createElement('div');
        this.container.id = 'right-sidebar';
        this.container.className = 'outliner-sidebar';

        // Apply initial collapsed state
        if (this.isCollapsed) {
            this.container.classList.add('collapsed');
        }

        // Resize handle
        this.resizeHandle = document.createElement('div');
        this.resizeHandle.className = 'outliner-resize-handle';
        this.container.appendChild(this.resizeHandle);

        // Header
        const header = this.createHeader();
        this.container.appendChild(header);

        // Content wrapper
        this.contentWrapper = document.createElement('div');
        this.contentWrapper.className = 'sidebar-content';
        this.contentWrapper.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        `;
        this.container.appendChild(this.contentWrapper);
    }

    /**
     * Create the external toggle button (tab)
     */
    private createToggleButton(): void {
        this.toggleButton = document.createElement('button');
        this.toggleButton.className = 'outliner-toggle-btn';
        this.toggleButton.title = 'Toggle Outliner';

        // Apply initial collapsed state
        if (this.isCollapsed) {
            this.toggleButton.classList.add('sidebar-collapsed');
        }

        // Simple text label only
        this.toggleButton.innerHTML = `
            <span class="toggle-label">Outliner</span>
        `;

        // Click handler
        this.toggleButton.addEventListener('click', () => this.toggle());

        // Add to document body (outside the sidebar)
        document.body.appendChild(this.toggleButton);
    }

    /**
     * Create the sidebar header
     * @returns Header element
     */
    private createHeader(): HTMLElement {
        const header = document.createElement('div');
        header.className = 'sidebar-header';
        header.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 12px 16px;
            background: linear-gradient(135deg, ${SIDEBAR_COLORS.PRIMARY} 0%, ${SIDEBAR_COLORS.PRIMARY_DARK} 100%);
            border-bottom: 1px solid ${SIDEBAR_COLORS.BORDER_LIGHT};
            min-height: 44px;
        `;

        // Title with icon
        const title = document.createElement('div');
        title.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 14px;
            font-weight: 600;
            color: ${SIDEBAR_COLORS.TEXT_LIGHT};
        `;
        title.innerHTML = `
            <span style="font-size: 18px;">🌍</span>
            <span>World Outliner</span>
        `;
        header.appendChild(title);

        return header;
    }

    /**
     * Create the World Outliner panel
     */
    private createOutlinerPanel(): void {
        if (!this.contentWrapper) return;

        // Outliner container (takes most of the space)
        const outlinerContainer = document.createElement('div');
        outlinerContainer.style.cssText = `
            flex: 2;
            min-height: 200px;
            display: flex;
            flex-direction: column;
            border-bottom: 1px solid ${SIDEBAR_COLORS.BORDER};
        `;

        // Create outliner panel
        this.outlinerPanel = new OutlinerPanel(this.outliner);
        this.outlinerPanel.initialize();

        // Add outliner element
        const outlinerElement = this.outlinerPanel.getElement();
        if (outlinerElement) {
            outlinerContainer.appendChild(outlinerElement);
        }

        // Setup selection callback
        this.outlinerPanel.setSelectionCallback((nodeIds) => {
            if (this.onSelectionCallback) {
                this.onSelectionCallback(nodeIds);
            }
        });

        this.contentWrapper.appendChild(outlinerContainer);
    }

    /**
     * Create placeholder section for future panels
     */
    private createPlaceholderSection(): void {
        if (!this.contentWrapper) return;

        // Properties section placeholder
        const propertiesSection = document.createElement('div');
        propertiesSection.style.cssText = `
            flex: 1;
            min-height: 100px;
            padding: 16px;
            color: ${SIDEBAR_COLORS.TEXT_MUTED};
            font-size: 12px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            background: rgba(0,0,0,0.1);
        `;

        const icon = document.createElement('div');
        icon.textContent = '⚙️';
        icon.style.cssText = `
            font-size: 28px;
            margin-bottom: 10px;
            opacity: 0.4;
        `;
        propertiesSection.appendChild(icon);

        const text = document.createElement('div');
        text.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 4px;">Properties Panel</div>
            <div style="font-size: 11px; opacity: 0.7;">Select an item to view properties</div>
        `;
        propertiesSection.appendChild(text);

        this.contentWrapper.appendChild(propertiesSection);
    }

    // ========================================================================
    // RESIZE FUNCTIONALITY
    // ========================================================================

    /**
     * Setup resize handle functionality
     */
    private setupResize(): void {
        if (!this.resizeHandle) return;

        let startX: number;
        let startWidth: number;

        const onMouseDown = (e: MouseEvent) => {
            e.preventDefault();
            this.isResizing = true;
            startX = e.clientX;
            startWidth = this.currentWidth;
            this.resizeHandle!.style.background = SIDEBAR_COLORS.RESIZE_HANDLE_HOVER;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!this.isResizing) return;

            const delta = startX - e.clientX;
            const newWidth = Math.max(
                DEFAULT_CONFIG.minWidth,
                Math.min(DEFAULT_CONFIG.maxWidth, startWidth + delta)
            );

            this.setWidth(newWidth);
        };

        const onMouseUp = () => {
            this.isResizing = false;
            this.resizeHandle!.style.background = 'transparent';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            this.saveState();
        };

        this.resizeHandle.addEventListener('mousedown', onMouseDown);
    }

    /**
     * Set the sidebar width
     * @param width - New width in pixels
     */
    private setWidth(width: number): void {
        this.currentWidth = width;

        // Update sidebar width
        if (this.container) {
            this.container.style.width = `${width}px`;
        }

        // Update toggle button position (when not collapsed)
        if (this.toggleButton && !this.isCollapsed) {
            this.toggleButton.style.right = `${width}px`;
        }
    }

    // ========================================================================
    // COLLAPSE / EXPAND
    // ========================================================================

    /**
     * Toggle collapsed state
     */
    toggle(): void {
        if (this.isCollapsed) {
            this.expand();
        } else {
            this.collapse();
        }
    }

    /**
     * Collapse the sidebar
     */
    collapse(): void {
        if (this.isCollapsed) return;

        this.isCollapsed = true;

        // Animate sidebar out
        if (this.container) {
            this.container.classList.add('collapsed');
        }

        // Move toggle button to edge
        if (this.toggleButton) {
            this.toggleButton.classList.add('sidebar-collapsed');
            this.toggleButton.style.right = '0';
        }

        this.saveState();

        if (this.onToggleCallback) {
            this.onToggleCallback(true);
        }

        console.log('[RightSidebar] Collapsed');
    }

    /**
     * Expand the sidebar
     */
    expand(): void {
        if (!this.isCollapsed) return;

        this.isCollapsed = false;

        // Animate sidebar in
        if (this.container) {
            this.container.classList.remove('collapsed');
        }

        // Move toggle button with sidebar
        if (this.toggleButton) {
            this.toggleButton.classList.remove('sidebar-collapsed');
            this.toggleButton.style.right = `${this.currentWidth}px`;
        }

        this.saveState();

        if (this.onToggleCallback) {
            this.onToggleCallback(false);
        }

        console.log('[RightSidebar] Expanded');
    }

    // ========================================================================
    // STATE PERSISTENCE
    // ========================================================================

    /**
     * Save sidebar state to localStorage
     */
    private saveState(): void {
        try {
            const state = {
                width: this.currentWidth,
                collapsed: this.isCollapsed,
            };
            localStorage.setItem('outlinerSidebarState', JSON.stringify(state));
        } catch (error) {
            console.warn('[RightSidebar] Could not save state:', error);
        }
    }

    /**
     * Load sidebar state from localStorage
     */
    private loadState(): void {
        try {
            const savedState = localStorage.getItem('outlinerSidebarState');
            if (savedState) {
                const state = JSON.parse(savedState);

                // Apply saved width
                if (typeof state.width === 'number') {
                    this.setWidth(state.width);
                }

                // Apply saved collapsed state
                if (typeof state.collapsed === 'boolean') {
                    this.isCollapsed = state.collapsed;

                    if (this.isCollapsed) {
                        // Apply collapsed state without animation on initial load
                        if (this.container) {
                            this.container.style.transition = 'none';
                            this.container.classList.add('collapsed');

                            // Re-enable transition after a frame
                            requestAnimationFrame(() => {
                                if (this.container) {
                                    this.container.style.transition = '';
                                }
                            });
                        }

                        if (this.toggleButton) {
                            this.toggleButton.style.transition = 'none';
                            this.toggleButton.classList.add('sidebar-collapsed');
                            this.toggleButton.style.right = '0';

                            requestAnimationFrame(() => {
                                if (this.toggleButton) {
                                    this.toggleButton.style.transition = '';
                                }
                            });
                        }
                    } else {
                        // Ensure expanded state
                        if (this.toggleButton) {
                            this.toggleButton.style.right = `${this.currentWidth}px`;
                        }
                    }
                }

                console.log('[RightSidebar] Loaded saved state:', state);
            } else {
                // No saved state - apply default collapsed state
                if (this.isCollapsed) {
                    if (this.container) {
                        this.container.style.transition = 'none';
                        this.container.classList.add('collapsed');

                        requestAnimationFrame(() => {
                            if (this.container) {
                                this.container.style.transition = '';
                            }
                        });
                    }

                    if (this.toggleButton) {
                        this.toggleButton.style.transition = 'none';
                        this.toggleButton.classList.add('sidebar-collapsed');
                        this.toggleButton.style.right = '0';

                        requestAnimationFrame(() => {
                            if (this.toggleButton) {
                                this.toggleButton.style.transition = '';
                            }
                        });
                    }
                }
            }
        } catch (error) {
            console.warn('[RightSidebar] Could not load state:', error);
        }
    }

    // ========================================================================
    // PUBLIC METHODS
    // ========================================================================

    /**
     * Get the root element
     * @returns Container element
     */
    getElement(): HTMLElement | null {
        return this.container;
    }

    /**
     * Get the outliner panel
     * @returns OutlinerPanel instance
     */
    getOutlinerPanel(): OutlinerPanel | null {
        return this.outlinerPanel;
    }

    /**
     * Set callback for toggle events
     * @param callback - Toggle callback
     */
    setToggleCallback(callback: (collapsed: boolean) => void): void {
        this.onToggleCallback = callback;
    }

    /**
     * Set callback for selection changes
     * @param callback - Selection callback
     */
    setSelectionCallback(callback: (nodeIds: string[]) => void): void {
        this.onSelectionCallback = callback;

        // Also set on outliner panel
        if (this.outlinerPanel) {
            this.outlinerPanel.setSelectionCallback(callback);
        }
    }

    /**
     * Get current width
     * @returns Width in pixels
     */
    getWidth(): number {
        return this.isCollapsed ? 0 : this.currentWidth;
    }

    /**
     * Check if collapsed
     * @returns True if collapsed
     */
    getIsCollapsed(): boolean {
        return this.isCollapsed;
    }

    /**
     * Programmatically open the sidebar
     */
    open(): void {
        this.expand();
    }

    /**
     * Programmatically close the sidebar
     */
    close(): void {
        this.collapse();
    }

    /**
     * Dispose of the sidebar and its contents
     */
    dispose(): void {
        // Dispose outliner panel
        if (this.outlinerPanel) {
            this.outlinerPanel.dispose();
            this.outlinerPanel = null;
        }

        // Remove toggle button from body
        if (this.toggleButton?.parentElement) {
            this.toggleButton.remove();
        }

        // Remove sidebar container
        if (this.container?.parentElement) {
            this.container.remove();
        }

        // Remove injected styles
        const styleEl = document.getElementById('right-sidebar-styles');
        if (styleEl) {
            styleEl.remove();
        }

        this.container = null;
        this.toggleButton = null;
        this.contentWrapper = null;
        this.resizeHandle = null;

        console.log('[RightSidebar] Disposed');
    }
}