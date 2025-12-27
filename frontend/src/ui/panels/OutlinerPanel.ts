/**
 * OutlinerPanel.ts - UI component for the World Outliner tree view
 * 
 * Path: frontend/src/ui/panels/OutlinerPanel.ts
 * 
 * Renders an interactive tree view of the scene hierarchy with support for:
 * - Expandable/collapsible folders
 * - Selection (single and multi)
 * - Drag and drop reordering
 * - Inline renaming
 * - Context menus
 * - Visibility and lock toggles
 * 
 * @module OutlinerPanel
 */

import { WorldOutliner, OutlinerNode } from '../../systems/outliner';
import type {
    OutlinerNodeType,
    OutlinerUIConfig
} from '../../types/outliner.types';
import {
    NODE_TYPE_ICONS,
    DEFAULT_OUTLINER_UI_CONFIG
} from '../../types/outliner.types';

// ============================================================================
// CONSTANTS & STYLES
// ============================================================================

/** Color scheme for the outliner panel */
const OUTLINER_COLORS = {
    // Panel
    PANEL_BG: 'rgba(30, 30, 30, 0.98)',
    PANEL_BORDER: '#444',

    // Header
    HEADER_BG: '#2a2a2a',
    HEADER_TEXT: '#fff',

    // Rows
    ROW_BG: 'transparent',
    ROW_HOVER: 'rgba(255, 255, 255, 0.08)',
    ROW_SELECTED: 'rgba(66, 133, 244, 0.3)',
    ROW_SELECTED_BORDER: '#4285f4',

    // Text
    TEXT_PRIMARY: '#e0e0e0',
    TEXT_SECONDARY: '#888',
    TEXT_DISABLED: '#555',

    // Icons
    ICON_DEFAULT: '#888',
    ICON_HOVER: '#fff',

    // Buttons
    BUTTON_BG: '#444',
    BUTTON_HOVER: '#555',
    BUTTON_TEXT: '#fff',

    // Drag indicator
    DROP_INDICATOR: '#4285f4',
} as const;

/** CSS class prefix */
const CSS_PREFIX = 'outliner';

// ============================================================================
// OUTLINER PANEL CLASS
// ============================================================================

/**
 * OutlinerPanel - Renders the World Outliner UI
 * 
 * @example
 * ```typescript
 * const panel = new OutlinerPanel(outliner);
 * panel.initialize();
 * 
 * // Add to container
 * container.appendChild(panel.getElement());
 * ```
 */
export class OutlinerPanel {
    // ========================================================================
    // PROPERTIES
    // ========================================================================

    /** Reference to the WorldOutliner system */
    private outliner: WorldOutliner;

    /** UI configuration */
    private config: OutlinerUIConfig;

    /** Root container element */
    private container: HTMLElement | null = null;

    /** Content area for tree nodes */
    private treeContainer: HTMLElement | null = null;

    /** Search input element */
    private searchInput: HTMLInputElement | null = null;

    /** Map of node IDs to their row elements */
    private rowElements: Map<string, HTMLElement> = new Map();

    /** Currently dragged node ID */
    private draggedNodeId: string | null = null;

    /** Drop target node ID */
    private dropTargetId: string | null = null;

    /** Node being renamed */
    private renamingNodeId: string | null = null;

    /** Search filter text */
    private searchFilter: string = '';

    /** Callback when selection changes in 3D view */
    private onSelectionChange: ((nodeIds: string[]) => void) | null = null;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new OutlinerPanel
     * @param outliner - WorldOutliner instance
     * @param config - Optional UI configuration
     */
    constructor(
        outliner: WorldOutliner,
        config: Partial<OutlinerUIConfig> = {}
    ) {
        this.outliner = outliner;
        this.config = { ...DEFAULT_OUTLINER_UI_CONFIG, ...config };

        console.log('[OutlinerPanel] Created');
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the panel and create DOM elements
     */
    initialize(): void {
        try {
            console.log('[OutlinerPanel] Initializing...');

            // Create main container
            this.createContainer();

            // Setup event listeners
            this.setupOutlinerEvents();

            // Initial render
            this.render();

            console.log('[OutlinerPanel] ✓ Initialized');
        } catch (error) {
            console.error('[OutlinerPanel] Initialization error:', error);
            throw error;
        }
    }

    /**
     * Create the main container element
     */
    private createContainer(): void {
        // Main container
        this.container = document.createElement('div');
        this.container.className = `${CSS_PREFIX}-panel`;
        this.container.style.cssText = `
            display: flex;
            flex-direction: column;
            height: 100%;
            min-height: 200px;
            background: ${OUTLINER_COLORS.PANEL_BG};
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 12px;
            color: ${OUTLINER_COLORS.TEXT_PRIMARY};
            user-select: none;
        `;

        // Header
        const header = this.createHeader();
        this.container.appendChild(header);

        // Toolbar
        const toolbar = this.createToolbar();
        this.container.appendChild(toolbar);

        // Tree container (scrollable)
        this.treeContainer = document.createElement('div');
        this.treeContainer.className = `${CSS_PREFIX}-tree`;
        this.treeContainer.style.cssText = `
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 4px 0;
        `;

        // Click on empty space to deselect
        this.treeContainer.addEventListener('click', (e) => {
            // Only deselect if clicking directly on the container, not a child
            if (e.target === this.treeContainer) {
                this.outliner.clearSelection();
            }
        });

        this.container.appendChild(this.treeContainer);
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
            justify-content: space-between;
            padding: 8px 12px;
            background: ${OUTLINER_COLORS.HEADER_BG};
            border-bottom: 1px solid ${OUTLINER_COLORS.PANEL_BORDER};
        `;

        // Title
        const title = document.createElement('span');
        title.textContent = '🌍 World Outliner';
        title.style.cssText = `
            font-weight: 600;
            font-size: 13px;
            color: ${OUTLINER_COLORS.HEADER_TEXT};
        `;
        header.appendChild(title);

        // Stats badge
        const stats = document.createElement('span');
        stats.id = `${CSS_PREFIX}-stats`;
        stats.style.cssText = `
            font-size: 10px;
            color: ${OUTLINER_COLORS.TEXT_SECONDARY};
            padding: 2px 6px;
            background: rgba(255,255,255,0.1);
            border-radius: 10px;
        `;
        stats.textContent = '0 items';
        header.appendChild(stats);

        return header;
    }

    /**
     * Create the toolbar with search and action buttons
     * @returns Toolbar element
     */
    private createToolbar(): HTMLElement {
        const toolbar = document.createElement('div');
        toolbar.className = `${CSS_PREFIX}-toolbar`;
        toolbar.style.cssText = `
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 6px 8px;
            border-bottom: 1px solid ${OUTLINER_COLORS.PANEL_BORDER};
            background: rgba(0,0,0,0.2);
        `;

        // Search input
        this.searchInput = document.createElement('input');
        this.searchInput.type = 'text';
        this.searchInput.placeholder = '🔍 Search...';
        this.searchInput.style.cssText = `
            flex: 1;
            padding: 4px 8px;
            border: 1px solid ${OUTLINER_COLORS.PANEL_BORDER};
            border-radius: 4px;
            background: rgba(0,0,0,0.3);
            color: ${OUTLINER_COLORS.TEXT_PRIMARY};
            font-size: 11px;
            outline: none;
        `;
        this.searchInput.addEventListener('input', () => {
            this.searchFilter = this.searchInput!.value.toLowerCase();
            this.render();
        });
        toolbar.appendChild(this.searchInput);

        // Add folder button
        const addFolderBtn = this.createToolbarButton('📁+', 'New Folder', () => {
            this.createNewFolder();
        });
        toolbar.appendChild(addFolderBtn);

        // Expand all button
        const expandAllBtn = this.createToolbarButton('⊞', 'Expand All', () => {
            this.outliner.expandAll();
            this.render();
        });
        toolbar.appendChild(expandAllBtn);

        // Collapse all button
        const collapseAllBtn = this.createToolbarButton('⊟', 'Collapse All', () => {
            this.outliner.collapseAll();
            this.render();
        });
        toolbar.appendChild(collapseAllBtn);

        return toolbar;
    }

    /**
     * Create a toolbar button
     * @param icon - Button icon/text
     * @param tooltip - Tooltip text
     * @param onClick - Click handler
     * @returns Button element
     */
    private createToolbarButton(
        icon: string,
        tooltip: string,
        onClick: () => void
    ): HTMLButtonElement {
        const button = document.createElement('button');
        button.textContent = icon;
        button.title = tooltip;
        button.style.cssText = `
            padding: 4px 8px;
            border: 1px solid ${OUTLINER_COLORS.PANEL_BORDER};
            border-radius: 4px;
            background: ${OUTLINER_COLORS.BUTTON_BG};
            color: ${OUTLINER_COLORS.BUTTON_TEXT};
            cursor: pointer;
            font-size: 12px;
            transition: background 0.15s;
        `;

        button.addEventListener('mouseenter', () => {
            button.style.background = OUTLINER_COLORS.BUTTON_HOVER;
        });
        button.addEventListener('mouseleave', () => {
            button.style.background = OUTLINER_COLORS.BUTTON_BG;
        });
        button.addEventListener('click', onClick);

        return button;
    }

    // ========================================================================
    // EVENT SETUP
    // ========================================================================

    /**
     * Setup listeners for WorldOutliner events
     */
    private setupOutlinerEvents(): void {
        // Re-render on hierarchy changes
        this.outliner.events.on('hierarchy:changed', () => this.render());
        this.outliner.events.on('node:created', () => this.render());
        this.outliner.events.on('node:deleted', () => this.render());
        this.outliner.events.on('node:moved', () => this.render());
        this.outliner.events.on('node:renamed', () => this.render());

        // Update individual rows
        this.outliner.events.on('node:visibility_changed', (e) => {
            this.updateRowVisibility(e.nodeId);
        });
        this.outliner.events.on('node:lock_changed', (e) => {
            this.updateRowLock(e.nodeId);
        });
        this.outliner.events.on('node:expanded_changed', () => this.render());

        // Selection changes
        this.outliner.events.on('selection:changed', () => {
            this.updateSelectionHighlight();
        });
    }

    // ========================================================================
    // RENDERING
    // ========================================================================

    /**
     * Render the entire tree
     */
    render(): void {
        if (!this.treeContainer) return;

        // Clear existing content
        this.treeContainer.innerHTML = '';
        this.rowElements.clear();

        // Render root nodes
        const rootNodes = this.outliner.getRootNodes();
        for (const node of rootNodes) {
            if (this.shouldShowNode(node)) {
                this.renderNode(node, 0);
            }
        }

        // Update stats
        this.updateStats();
    }

    /**
     * Check if a node should be shown (based on search filter)
     * @param node - Node to check
     * @returns True if should show
     */
    private shouldShowNode(node: OutlinerNode): boolean {
        if (!this.searchFilter) return true;

        // Check this node
        if (node.name.toLowerCase().includes(this.searchFilter)) {
            return true;
        }

        // Check descendants (show parent if any child matches)
        const descendants = this.outliner.getDescendantIds(node.id);
        for (const descId of descendants) {
            const descNode = this.outliner.getNode(descId);
            if (descNode?.name.toLowerCase().includes(this.searchFilter)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Render a single node and its children
     * @param node - Node to render
     * @param depth - Nesting depth
     */
    private renderNode(node: OutlinerNode, depth: number): void {
        if (!this.treeContainer) return;

        // Create row element
        const row = this.createNodeRow(node, depth);
        this.treeContainer.appendChild(row);
        this.rowElements.set(node.id, row);

        // Render children if expanded
        if (node.isFolder && node.expanded) {
            const children = this.outliner.getChildren(node.id);
            for (const child of children) {
                if (this.shouldShowNode(child)) {
                    this.renderNode(child, depth + 1);
                }
            }
        }
    }

    /**
     * Create a row element for a node
     * @param node - Node data
     * @param depth - Nesting depth
     * @returns Row element
     */
    private createNodeRow(node: OutlinerNode, depth: number): HTMLElement {
        const row = document.createElement('div');
        row.className = `${CSS_PREFIX}-row`;
        row.dataset.nodeId = node.id;
        row.style.cssText = `
            display: flex;
            align-items: center;
            height: ${this.config.rowHeight}px;
            padding: 0 8px;
            padding-left: ${8 + depth * this.config.indentSize}px;
            cursor: pointer;
            transition: background 0.1s;
            border-left: 2px solid transparent;
        `;

        // Selection highlight
        if (this.outliner.isSelected(node.id)) {
            row.style.background = OUTLINER_COLORS.ROW_SELECTED;
            row.style.borderLeftColor = OUTLINER_COLORS.ROW_SELECTED_BORDER;
        }

        // Hover effect
        row.addEventListener('mouseenter', () => {
            if (!this.outliner.isSelected(node.id)) {
                row.style.background = OUTLINER_COLORS.ROW_HOVER;
            }
        });
        row.addEventListener('mouseleave', () => {
            if (!this.outliner.isSelected(node.id)) {
                row.style.background = 'transparent';
            }
        });

        // Expand/collapse arrow (for folders)
        if (node.isFolder) {
            const arrow = document.createElement('span');
            arrow.className = `${CSS_PREFIX}-arrow`;
            arrow.textContent = node.expanded ? '▼' : '▶';
            arrow.style.cssText = `
                width: 16px;
                font-size: 8px;
                color: ${OUTLINER_COLORS.ICON_DEFAULT};
                cursor: pointer;
                text-align: center;
            `;
            arrow.addEventListener('click', (e) => {
                e.stopPropagation();
                this.outliner.toggleExpanded(node.id);
            });
            row.appendChild(arrow);
        } else {
            // Spacer for non-folders
            const spacer = document.createElement('span');
            spacer.style.width = '16px';
            row.appendChild(spacer);
        }

        // Icon
        if (this.config.showIcons) {
            const icon = document.createElement('span');
            icon.className = `${CSS_PREFIX}-icon`;
            icon.textContent = NODE_TYPE_ICONS[node.type];
            icon.style.cssText = `
                margin-right: 6px;
                font-size: 14px;
            `;
            row.appendChild(icon);
        }

        // Name
        const name = document.createElement('span');
        name.className = `${CSS_PREFIX}-name`;
        name.textContent = node.name;
        name.style.cssText = `
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: ${node.visible ? OUTLINER_COLORS.TEXT_PRIMARY : OUTLINER_COLORS.TEXT_DISABLED};
            font-style: ${node.locked ? 'italic' : 'normal'};
        `;

        // Double click to rename
        if (this.config.enableInlineRename) {
            name.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.startRename(node.id);
            });
        }
        row.appendChild(name);

        // Action buttons container
        const actions = document.createElement('div');
        actions.className = `${CSS_PREFIX}-actions`;
        actions.style.cssText = `
            display: flex;
            gap: 2px;
            opacity: 0;
            transition: opacity 0.15s;
        `;

        row.addEventListener('mouseenter', () => {
            actions.style.opacity = '1';
        });
        row.addEventListener('mouseleave', () => {
            actions.style.opacity = '0';
        });

        // Visibility toggle
        const visibilityBtn = this.createActionButton(
            node.visible ? '👁️' : '👁️‍🗨️',
            'Toggle Visibility',
            () => this.outliner.toggleVisibility(node.id)
        );
        if (!node.visible) {
            visibilityBtn.style.opacity = '0.5';
        }
        actions.appendChild(visibilityBtn);

        // Lock toggle
        const lockBtn = this.createActionButton(
            node.locked ? '🔒' : '🔓',
            'Toggle Lock',
            () => this.outliner.toggleLocked(node.id)
        );
        actions.appendChild(lockBtn);

        // Delete button (only for non-default categories)
        if (!node.metadata.isDefaultCategory) {
            const deleteBtn = this.createActionButton(
                '🗑️',
                'Delete',
                () => {
                    if (confirm(`Delete "${node.name}"?`)) {
                        this.outliner.deleteNode(node.id);
                    }
                }
            );
            actions.appendChild(deleteBtn);
        }

        row.appendChild(actions);

        // Click to select
        row.addEventListener('click', (e) => {
            const additive = e.ctrlKey || e.metaKey || e.shiftKey;
            this.outliner.select(node.id, additive);

            // Notify external listeners
            if (this.onSelectionChange) {
                this.onSelectionChange(this.outliner.getSelectedIds());
            }
        });

        // Drag and drop
        if (this.config.enableDragDrop) {
            this.setupDragDrop(row, node);
        }

        // Context menu
        row.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(node, e.clientX, e.clientY);
        });

        return row;
    }

    /**
     * Create an action button
     * @param icon - Button icon
     * @param tooltip - Tooltip text
     * @param onClick - Click handler
     * @returns Button element
     */
    private createActionButton(
        icon: string,
        tooltip: string,
        onClick: () => void
    ): HTMLButtonElement {
        const button = document.createElement('button');
        button.textContent = icon;
        button.title = tooltip;
        button.style.cssText = `
            width: 20px;
            height: 20px;
            padding: 0;
            border: none;
            background: transparent;
            cursor: pointer;
            font-size: 12px;
            border-radius: 3px;
            transition: background 0.1s;
        `;

        button.addEventListener('mouseenter', () => {
            button.style.background = 'rgba(255,255,255,0.1)';
        });
        button.addEventListener('mouseleave', () => {
            button.style.background = 'transparent';
        });
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            onClick();
        });

        return button;
    }

    // ========================================================================
    // DRAG AND DROP
    // ========================================================================

    /**
     * Setup drag and drop for a row
     * @param row - Row element
     * @param node - Node data
     */
    private setupDragDrop(row: HTMLElement, node: OutlinerNode): void {
        // Don't allow dragging default category folders
        if (node.metadata.isDefaultCategory) return;

        row.draggable = true;

        row.addEventListener('dragstart', (e) => {
            this.draggedNodeId = node.id;
            row.style.opacity = '0.5';
            e.dataTransfer!.effectAllowed = 'move';
            e.dataTransfer!.setData('text/plain', node.id);
        });

        row.addEventListener('dragend', () => {
            this.draggedNodeId = null;
            row.style.opacity = '1';
            this.clearDropIndicators();
        });

        row.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!this.draggedNodeId || this.draggedNodeId === node.id) return;

            // Don't allow dropping onto itself or descendants
            const descendants = this.outliner.getDescendantIds(this.draggedNodeId);
            if (descendants.includes(node.id)) return;

            e.dataTransfer!.dropEffect = 'move';
            this.showDropIndicator(row, node.id);
        });

        row.addEventListener('dragleave', () => {
            this.clearDropIndicator(row);
        });

        row.addEventListener('drop', (e) => {
            e.preventDefault();
            if (!this.draggedNodeId || this.draggedNodeId === node.id) return;

            // Move the dragged node into this folder (or as sibling)
            const targetParentId = node.isFolder ? node.id : node.parentId;
            this.outliner.moveNode(this.draggedNodeId, targetParentId);

            this.clearDropIndicators();
            this.draggedNodeId = null;
        });
    }

    /**
     * Show drop indicator on a row
     * @param row - Target row
     * @param nodeId - Target node ID
     */
    private showDropIndicator(row: HTMLElement, nodeId: string): void {
        this.clearDropIndicators();
        this.dropTargetId = nodeId;
        row.style.borderBottom = `2px solid ${OUTLINER_COLORS.DROP_INDICATOR}`;
    }

    /**
     * Clear drop indicator from a row
     * @param row - Row element
     */
    private clearDropIndicator(row: HTMLElement): void {
        row.style.borderBottom = 'none';
    }

    /**
     * Clear all drop indicators
     */
    private clearDropIndicators(): void {
        this.rowElements.forEach(row => {
            row.style.borderBottom = 'none';
        });
        this.dropTargetId = null;
    }

    // ========================================================================
    // INLINE RENAME
    // ========================================================================

    /**
     * Start inline rename for a node
     * @param nodeId - Node ID to rename
     */
    private startRename(nodeId: string): void {
        const node = this.outliner.getNode(nodeId);
        if (!node || node.locked || node.metadata.isDefaultCategory) return;

        const row = this.rowElements.get(nodeId);
        if (!row) return;

        const nameSpan = row.querySelector(`.${CSS_PREFIX}-name`) as HTMLElement;
        if (!nameSpan) return;

        this.renamingNodeId = nodeId;

        // Create input
        const input = document.createElement('input');
        input.type = 'text';
        input.value = node.name;
        input.style.cssText = `
            flex: 1;
            padding: 2px 4px;
            border: 1px solid ${OUTLINER_COLORS.ROW_SELECTED_BORDER};
            border-radius: 2px;
            background: rgba(0,0,0,0.5);
            color: ${OUTLINER_COLORS.TEXT_PRIMARY};
            font-size: 12px;
            outline: none;
        `;

        // Handle completion
        const finishRename = () => {
            const newName = input.value.trim();
            if (newName && newName !== node.name) {
                this.outliner.renameNode(nodeId, newName);
            }
            this.renamingNodeId = null;
            this.render();
        };

        input.addEventListener('blur', finishRename);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                finishRename();
            } else if (e.key === 'Escape') {
                this.renamingNodeId = null;
                this.render();
            }
        });

        // Replace name span with input
        nameSpan.replaceWith(input);
        input.focus();
        input.select();
    }

    // ========================================================================
    // CONTEXT MENU
    // ========================================================================

    /**
     * Show context menu for a node
     * @param node - Node that was right-clicked
     * @param x - Mouse X position
     * @param y - Mouse Y position
     */
    private showContextMenu(node: OutlinerNode, x: number, y: number): void {
        // Remove existing menu
        const existingMenu = document.getElementById(`${CSS_PREFIX}-context-menu`);
        if (existingMenu) {
            existingMenu.remove();
        }

        // Create menu
        const menu = document.createElement('div');
        menu.id = `${CSS_PREFIX}-context-menu`;
        menu.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            min-width: 150px;
            background: ${OUTLINER_COLORS.PANEL_BG};
            border: 1px solid ${OUTLINER_COLORS.PANEL_BORDER};
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            padding: 4px 0;
            z-index: 10000;
        `;

        // Menu items
        const items: Array<{ label: string; action: () => void; disabled?: boolean }> = [];

        // Rename
        items.push({
            label: '✏️ Rename',
            action: () => this.startRename(node.id),
            disabled: node.locked || Boolean(node.metadata.isDefaultCategory),
        });

        // Duplicate
        items.push({
            label: '📋 Duplicate',
            action: () => this.outliner.duplicate(node.id),
            disabled: node.metadata.isDefaultCategory as boolean,
        });

        // Separator
        items.push({ label: '---', action: () => { } });

        // New folder (if this is a folder)
        if (node.isFolder) {
            items.push({
                label: '📁 New Folder Here',
                action: () => this.createNewFolder(node.id),
            });
        }

        // Toggle visibility
        items.push({
            label: node.visible ? '👁️‍🗨️ Hide' : '👁️ Show',
            action: () => this.outliner.toggleVisibility(node.id),
        });

        // Toggle lock
        items.push({
            label: node.locked ? '🔓 Unlock' : '🔒 Lock',
            action: () => this.outliner.toggleLocked(node.id),
        });

        // Separator
        items.push({ label: '---', action: () => { } });

        // Delete
        items.push({
            label: '🗑️ Delete',
            action: () => {
                if (confirm(`Delete "${node.name}"?`)) {
                    this.outliner.deleteNode(node.id);
                }
            },
            disabled: Boolean(node.metadata.isDefaultCategory),
        });

        // Add items to menu
        for (const item of items) {
            if (item.label === '---') {
                const separator = document.createElement('div');
                separator.style.cssText = `
                    height: 1px;
                    background: ${OUTLINER_COLORS.PANEL_BORDER};
                    margin: 4px 8px;
                `;
                menu.appendChild(separator);
            } else {
                const menuItem = document.createElement('div');
                menuItem.textContent = item.label;
                menuItem.style.cssText = `
                    padding: 6px 12px;
                    cursor: ${item.disabled ? 'default' : 'pointer'};
                    color: ${item.disabled ? OUTLINER_COLORS.TEXT_DISABLED : OUTLINER_COLORS.TEXT_PRIMARY};
                    transition: background 0.1s;
                `;

                if (!item.disabled) {
                    menuItem.addEventListener('mouseenter', () => {
                        menuItem.style.background = OUTLINER_COLORS.ROW_HOVER;
                    });
                    menuItem.addEventListener('mouseleave', () => {
                        menuItem.style.background = 'transparent';
                    });
                    menuItem.addEventListener('click', () => {
                        item.action();
                        menu.remove();
                    });
                }

                menu.appendChild(menuItem);
            }
        }

        // Add to document
        document.body.appendChild(menu);

        // Close on click outside
        const closeMenu = (e: MouseEvent) => {
            if (!menu.contains(e.target as Node)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 0);
    }

    // ========================================================================
    // ACTIONS
    // ========================================================================

    /**
     * Create a new folder
     * @param parentId - Optional parent folder ID
     */
    private createNewFolder(parentId?: string): void {
        const name = prompt('Folder name:', 'New Folder');
        if (name) {
            const folderId = this.outliner.createFolder(name, parentId);
            this.outliner.select(folderId);
            this.render();
        }
    }

    // ========================================================================
    // UPDATE METHODS
    // ========================================================================

    /**
     * Update selection highlight on all rows
     */
    private updateSelectionHighlight(): void {
        const selectedIds = this.outliner.getSelectedIds();

        this.rowElements.forEach((row, nodeId) => {
            const isSelected = selectedIds.includes(nodeId);
            row.style.background = isSelected
                ? OUTLINER_COLORS.ROW_SELECTED
                : 'transparent';
            row.style.borderLeftColor = isSelected
                ? OUTLINER_COLORS.ROW_SELECTED_BORDER
                : 'transparent';
        });
    }

    /**
     * Update visibility indicator for a row
     * @param nodeId - Node ID
     */
    private updateRowVisibility(nodeId: string): void {
        const row = this.rowElements.get(nodeId);
        const node = this.outliner.getNode(nodeId);
        if (!row || !node) return;

        const nameSpan = row.querySelector(`.${CSS_PREFIX}-name`) as HTMLElement;
        if (nameSpan) {
            nameSpan.style.color = node.visible
                ? OUTLINER_COLORS.TEXT_PRIMARY
                : OUTLINER_COLORS.TEXT_DISABLED;
        }
    }

    /**
     * Update lock indicator for a row
     * @param nodeId - Node ID
     */
    private updateRowLock(nodeId: string): void {
        const row = this.rowElements.get(nodeId);
        const node = this.outliner.getNode(nodeId);
        if (!row || !node) return;

        const nameSpan = row.querySelector(`.${CSS_PREFIX}-name`) as HTMLElement;
        if (nameSpan) {
            nameSpan.style.fontStyle = node.locked ? 'italic' : 'normal';
        }
    }

    /**
     * Update stats display
     */
    private updateStats(): void {
        const statsEl = document.getElementById(`${CSS_PREFIX}-stats`);
        if (!statsEl) return;

        const stats = this.outliner.getStats();
        statsEl.textContent = `${stats.items} items`;
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
     * Set callback for selection changes
     * @param callback - Selection change callback
     */
    setSelectionCallback(callback: (nodeIds: string[]) => void): void {
        this.onSelectionChange = callback;
    }

    /**
     * Select a node by scene object ID
     * @param sceneObjectId - Scene object ID
     */
    selectBySceneObjectId(sceneObjectId: string): void {
        const node = this.outliner.findBySceneObjectId(sceneObjectId);
        if (node) {
            this.outliner.select(node.id);
        }
    }

    /**
     * Dispose of the panel
     */
    dispose(): void {
        if (this.container?.parentElement) {
            this.container.remove();
        }
        this.rowElements.clear();
        this.container = null;
        this.treeContainer = null;
        this.searchInput = null;

        console.log('[OutlinerPanel] Disposed');
    }
}