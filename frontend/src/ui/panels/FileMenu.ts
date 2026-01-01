/**
 * FileMenu.ts - File operations dropdown menu
 * 
 * Path: frontend/src/ui/panels/FileMenu.ts
 * 
 * Provides a dropdown menu for file operations:
 * - New Layout
 * - Open Layout
 * - Save / Save As
 * - Recent Files submenu
 * - Export options
 * 
 * @module FileMenu
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import type { LayoutManager, RecentFile } from '../../core/persistence';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[FileMenu]';

// ============================================================================
// THEME
// ============================================================================

const THEME = {
    // Colors
    bgDark: '#1e272e',
    bgMedium: '#2d3436',
    bgLight: '#636e72',
    bgHover: 'rgba(52, 152, 219, 0.2)',
    bgActive: 'rgba(52, 152, 219, 0.3)',
    textLight: '#ffffff',
    textMuted: '#b2bec3',
    borderColor: '#3d4852',
    accentColor: '#3498db',

    // Dimensions
    menuWidth: '280px',
    itemHeight: '36px',
    padding: '8px 16px',

    // Transitions
    transition: '0.15s ease',

    // Shadows
    shadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
} as const;

// ============================================================================
// FILE MENU CLASS
// ============================================================================

/**
 * FileMenu - Dropdown menu for file operations
 * 
 * @example
 * ```typescript
 * const fileMenu = new FileMenu(layoutManager);
 * fileMenu.mount(document.body);
 * ```
 */
export class FileMenu {
    // ========================================================================
    // PRIVATE PROPERTIES
    // ========================================================================

    /** Layout manager reference */
    private layoutManager: LayoutManager;

    /** Root container element */
    private container: HTMLElement | null = null;

    /** Menu button element */
    private menuButton: HTMLElement | null = null;

    /** Dropdown panel element */
    private dropdown: HTMLElement | null = null;

    /** Is dropdown open */
    private isOpen: boolean = false;

    /** Recent files submenu */
    private recentFilesSubmenu: HTMLElement | null = null;

    /** Status message callback */
    private onStatusMessage?: (message: string) => void;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a FileMenu
     * @param layoutManager - Layout manager instance
     */
    constructor(layoutManager: LayoutManager) {
        this.layoutManager = layoutManager;
        console.log(`${LOG_PREFIX} FileMenu created`);
    }

    // ========================================================================
    // PUBLIC METHODS
    // ========================================================================

    /**
     * Mount the file menu to a parent element
     * @param parent - Parent element to mount to
     */
    mount(parent: HTMLElement): void {
        this.createUI();

        if (this.container) {
            parent.appendChild(this.container);
            this.setupEventListeners();
        }

        console.log(`${LOG_PREFIX} FileMenu mounted`);
    }

    /**
     * Set status message callback
     * @param callback - Callback function
     */
    setStatusCallback(callback: (message: string) => void): void {
        this.onStatusMessage = callback;
    }

    /**
     * Update the dirty indicator on the menu button
     */
    updateDirtyIndicator(): void {
        if (!this.menuButton) return;

        const indicator = this.menuButton.querySelector('.dirty-indicator') as HTMLElement;
        if (indicator) {
            indicator.style.display = this.layoutManager.getIsDirty() ? 'block' : 'none';
        }
    }

    /**
     * Dispose of the file menu
     */
    dispose(): void {
        this.close();
        this.container?.remove();
        this.container = null;
        console.log(`${LOG_PREFIX} FileMenu disposed`);
    }

    // ========================================================================
    // UI CREATION
    // ========================================================================

    /**
     * Create the UI elements
     */
    private createUI(): void {
        // Create container
        this.container = document.createElement('div');
        this.container.id = 'file-menu-container';
        this.container.style.cssText = `
            position: fixed;
            top: 12px;
            left: 12px;
            z-index: 1000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        // Create menu button
        this.menuButton = this.createMenuButton();
        this.container.appendChild(this.menuButton);

        // Create dropdown panel
        this.dropdown = this.createDropdown();
        this.container.appendChild(this.dropdown);
    }

    /**
     * Create the menu button
     */
    private createMenuButton(): HTMLElement {
        const button = document.createElement('button');
        button.id = 'file-menu-button';
        button.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: ${THEME.bgDark};
            border: 1px solid ${THEME.borderColor};
            border-radius: 6px;
            color: ${THEME.textLight};
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all ${THEME.transition};
            box-shadow: ${THEME.shadow};
        `;

        button.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span>File</span>
            <span class="dirty-indicator" style="
                display: none;
                width: 8px;
                height: 8px;
                background: #e74c3c;
                border-radius: 50%;
            "></span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
        `;

        // Hover effects
        button.onmouseenter = () => {
            button.style.background = THEME.bgMedium;
            button.style.borderColor = THEME.accentColor;
        };
        button.onmouseleave = () => {
            if (!this.isOpen) {
                button.style.background = THEME.bgDark;
                button.style.borderColor = THEME.borderColor;
            }
        };

        // Click handler
        button.onclick = () => this.toggle();

        return button;
    }

    /**
     * Create the dropdown panel
     */
    private createDropdown(): HTMLElement {
        const dropdown = document.createElement('div');
        dropdown.id = 'file-menu-dropdown';
        dropdown.style.cssText = `
            position: absolute;
            top: calc(100% + 4px);
            left: 0;
            width: ${THEME.menuWidth};
            background: ${THEME.bgDark};
            border: 1px solid ${THEME.borderColor};
            border-radius: 8px;
            box-shadow: ${THEME.shadow};
            display: none;
            overflow: hidden;
        `;

        // Menu items
        const items = this.createMenuItems();
        items.forEach(item => dropdown.appendChild(item));

        return dropdown;
    }

    /**
     * Create menu items
     */
    private createMenuItems(): HTMLElement[] {
        const items: HTMLElement[] = [];

        // New Layout
        items.push(this.createMenuItem({
            icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <line x1="9" y1="15" x2="15" y2="15"></line>
            </svg>`,
            label: 'New Layout',
            shortcut: 'Ctrl+N',
            action: () => this.handleNew()
        }));

        // Open
        items.push(this.createMenuItem({
            icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>`,
            label: 'Open Layout...',
            shortcut: 'Ctrl+O',
            action: () => this.handleOpen()
        }));

        // Separator
        items.push(this.createSeparator());

        // Save
        items.push(this.createMenuItem({
            icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
            </svg>`,
            label: 'Save',
            shortcut: 'Ctrl+S',
            action: () => this.handleSave()
        }));

        // Save As
        items.push(this.createMenuItem({
            icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
            </svg>`,
            label: 'Save As...',
            shortcut: 'Ctrl+Shift+S',
            action: () => this.handleSaveAs()
        }));

        // Separator
        items.push(this.createSeparator());

        // Recent Files submenu
        const recentItem = this.createSubmenuItem({
            icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg>`,
            label: 'Recent Files'
        });
        items.push(recentItem);

        return items;
    }

    /**
     * Create a menu item
     */
    private createMenuItem(config: {
        icon: string;
        label: string;
        shortcut?: string;
        action: () => void;
        disabled?: boolean;
    }): HTMLElement {
        const item = document.createElement('div');
        item.className = 'file-menu-item';
        item.style.cssText = `
            display: flex;
            align-items: center;
            padding: ${THEME.padding};
            cursor: ${config.disabled ? 'default' : 'pointer'};
            transition: background ${THEME.transition};
            opacity: ${config.disabled ? '0.5' : '1'};
        `;

        item.innerHTML = `
            <span style="display: flex; align-items: center; color: ${THEME.textMuted}; margin-right: 12px;">
                ${config.icon}
            </span>
            <span style="flex: 1; color: ${THEME.textLight}; font-size: 13px;">
                ${config.label}
            </span>
            ${config.shortcut ? `
                <span style="color: ${THEME.textMuted}; font-size: 12px; font-family: monospace;">
                    ${config.shortcut}
                </span>
            ` : ''}
        `;

        if (!config.disabled) {
            item.onmouseenter = () => {
                item.style.background = THEME.bgHover;
            };
            item.onmouseleave = () => {
                item.style.background = 'transparent';
            };
            item.onclick = () => {
                config.action();
                this.close();
            };
        }

        return item;
    }

    /**
     * Create a separator
     */
    private createSeparator(): HTMLElement {
        const sep = document.createElement('div');
        sep.style.cssText = `
            height: 1px;
            background: ${THEME.borderColor};
            margin: 4px 0;
        `;
        return sep;
    }

    /**
     * Create a submenu item (recent files)
     */
    private createSubmenuItem(config: {
        icon: string;
        label: string;
    }): HTMLElement {
        const item = document.createElement('div');
        item.className = 'file-menu-submenu';
        item.style.cssText = `
            position: relative;
        `;

        const trigger = document.createElement('div');
        trigger.style.cssText = `
            display: flex;
            align-items: center;
            padding: ${THEME.padding};
            cursor: pointer;
            transition: background ${THEME.transition};
        `;

        trigger.innerHTML = `
            <span style="display: flex; align-items: center; color: ${THEME.textMuted}; margin-right: 12px;">
                ${config.icon}
            </span>
            <span style="flex: 1; color: ${THEME.textLight}; font-size: 13px;">
                ${config.label}
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${THEME.textMuted}" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
        `;

        // Create submenu panel
        this.recentFilesSubmenu = document.createElement('div');
        this.recentFilesSubmenu.style.cssText = `
            position: absolute;
            left: 100%;
            top: 0;
            width: 300px;
            max-height: 400px;
            overflow-y: auto;
            background: ${THEME.bgDark};
            border: 1px solid ${THEME.borderColor};
            border-radius: 8px;
            box-shadow: ${THEME.shadow};
            display: none;
        `;

        // Show submenu on hover
        item.onmouseenter = () => {
            trigger.style.background = THEME.bgHover;
            this.updateRecentFilesSubmenu();
            if (this.recentFilesSubmenu) {
                this.recentFilesSubmenu.style.display = 'block';
            }
        };

        item.onmouseleave = () => {
            trigger.style.background = 'transparent';
            if (this.recentFilesSubmenu) {
                this.recentFilesSubmenu.style.display = 'none';
            }
        };

        item.appendChild(trigger);
        item.appendChild(this.recentFilesSubmenu);

        return item;
    }

    /**
     * Update recent files submenu content
     */
    private updateRecentFilesSubmenu(): void {
        if (!this.recentFilesSubmenu) return;

        const recentFiles = this.layoutManager.getRecentFiles();

        if (recentFiles.length === 0) {
            this.recentFilesSubmenu.innerHTML = `
                <div style="padding: ${THEME.padding}; color: ${THEME.textMuted}; font-size: 13px; font-style: italic;">
                    No recent files
                </div>
            `;
            return;
        }

        this.recentFilesSubmenu.innerHTML = '';

        recentFiles.forEach(file => {
            const item = document.createElement('div');
            item.style.cssText = `
                display: flex;
                flex-direction: column;
                padding: 8px 16px;
                cursor: pointer;
                transition: background ${THEME.transition};
            `;

            item.innerHTML = `
                <span style="color: ${THEME.textLight}; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${file.name}
                </span>
                <span style="color: ${THEME.textMuted}; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${file.path}
                </span>
            `;

            item.onmouseenter = () => {
                item.style.background = THEME.bgHover;
            };
            item.onmouseleave = () => {
                item.style.background = 'transparent';
            };
            item.onclick = () => {
                this.handleOpenRecent(file);
                this.close();
            };

            this.recentFilesSubmenu.appendChild(item);
        });
    }

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    /**
     * Setup event listeners
     */
    private setupEventListeners(): void {
        // Close on click outside
        document.addEventListener('click', (e) => {
            if (this.isOpen && this.container && !this.container.contains(e.target as Node)) {
                this.close();
            }
        });

        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (this.isOpen && e.key === 'Escape') {
                this.close();
            }
        });

        // Listen for dirty state changes
        this.layoutManager.addEventListener('dirty-changed', () => {
            this.updateDirtyIndicator();
        });
    }

    /**
     * Toggle dropdown
     */
    private toggle(): void {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * Open dropdown
     */
    private open(): void {
        if (!this.dropdown || !this.menuButton) return;

        this.isOpen = true;
        this.dropdown.style.display = 'block';
        this.menuButton.style.background = THEME.bgMedium;
        this.menuButton.style.borderColor = THEME.accentColor;
    }

    /**
     * Close dropdown
     */
    private close(): void {
        if (!this.dropdown || !this.menuButton) return;

        this.isOpen = false;
        this.dropdown.style.display = 'none';
        this.menuButton.style.background = THEME.bgDark;
        this.menuButton.style.borderColor = THEME.borderColor;

        // Also hide submenu
        if (this.recentFilesSubmenu) {
            this.recentFilesSubmenu.style.display = 'none';
        }
    }

    // ========================================================================
    // ACTION HANDLERS
    // ========================================================================

    /**
     * Handle New Layout action
     */
    private async handleNew(): Promise<void> {
        console.log(`${LOG_PREFIX} New Layout requested`);
        this.onStatusMessage?.('Creating new layout...');

        const success = await this.layoutManager.newLayout();

        if (success) {
            this.onStatusMessage?.('New layout created');
        }
    }

    /**
     * Handle Open action
     */
    private async handleOpen(): Promise<void> {
        console.log(`${LOG_PREFIX} Open Layout requested`);
        this.onStatusMessage?.('Opening layout...');

        const result = await this.layoutManager.open((stage, progress, message) => {
            this.onStatusMessage?.(`Loading: ${message}`);
        });

        if (result.success) {
            this.onStatusMessage?.(`Loaded: ${result.layout?.project.name}`);
        } else if (result.error !== 'Load cancelled by user') {
            this.onStatusMessage?.(`Error: ${result.error}`);
        }
    }

    /**
     * Handle Open Recent action
     */
    private async handleOpenRecent(file: RecentFile): Promise<void> {
        console.log(`${LOG_PREFIX} Open Recent requested: ${file.name}`);
        this.onStatusMessage?.(`Opening ${file.name}...`);

        const result = await this.layoutManager.loadRecent(file, (stage, progress, message) => {
            this.onStatusMessage?.(`Loading: ${message}`);
        });

        if (result.success) {
            this.onStatusMessage?.(`Loaded: ${file.name}`);
        } else {
            this.onStatusMessage?.(`Error: ${result.error}`);
        }
    }

    /**
     * Handle Save action
     */
    private async handleSave(): Promise<void> {
        console.log(`${LOG_PREFIX} Save requested`);
        this.onStatusMessage?.('Saving...');

        const result = await this.layoutManager.save();

        if (result.success) {
            this.onStatusMessage?.('Layout saved');
        } else if (result.error !== 'Save cancelled by user') {
            this.onStatusMessage?.(`Save error: ${result.error}`);
        }
    }

    /**
     * Handle Save As action
     */
    private async handleSaveAs(): Promise<void> {
        console.log(`${LOG_PREFIX} Save As requested`);
        this.onStatusMessage?.('Saving...');

        const result = await this.layoutManager.saveAs();

        if (result.success) {
            this.onStatusMessage?.(`Saved: ${this.layoutManager.getCurrentLayoutName()}`);
        } else if (result.error !== 'Save cancelled by user') {
            this.onStatusMessage?.(`Save error: ${result.error}`);
        }
    }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a FileMenu instance
 * @param layoutManager - Layout manager
 * @returns FileMenu instance
 */
export function createFileMenu(layoutManager: LayoutManager): FileMenu {
    return new FileMenu(layoutManager);
}