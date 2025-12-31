/**
 * UIManagerStyles.ts - Theme tokens, types, and CSS style injection
 * 
 * Path: frontend/src/ui/UIManagerStyles.ts
 * 
 * Contains:
 * - Type definitions for the UI system
 * - Design tokens (theme constants)
 * - CSS style injection for the sidebar UI
 * 
 * Separated from UIManager.ts for better maintainability and reusability.
 * 
 * @module UIManagerStyles
 * @author Model Railway Workbench
 * @version 2.2.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Callback when track piece is selected */
export type TrackSelectionCallback = (catalogId: string) => void;

/** Callback for toggle state changes */
export type ToggleCallback = (enabled: boolean) => void;

/** Callback for import button */
export type ImportCallback = () => void;

/** Accordion section state */
export interface AccordionSection {
    header: HTMLElement;
    content: HTMLElement;
    isExpanded: boolean;
}

// ============================================================================
// DESIGN TOKENS
// ============================================================================

/**
 * Theme configuration object containing all design tokens
 * Used consistently throughout the UI for visual coherence
 */
export const THEME = {
    // ------------------------------------------------------------------------
    // Core colors
    // ------------------------------------------------------------------------
    primary: '#2c3e50',
    primaryLight: '#34495e',
    primaryDark: '#1a252f',
    accent: '#3498db',
    accentHover: '#2980b9',
    success: '#27ae60',
    warning: '#f39c12',

    // ------------------------------------------------------------------------
    // Background colors
    // ------------------------------------------------------------------------
    bgDark: '#1e272e',
    bgMedium: '#2d3436',
    bgLight: '#636e72',
    bgLighter: '#b2bec3',
    bgWhite: '#ffffff',
    bgOffWhite: '#f8f9fa',
    bgHover: '#dfe6e9',

    // ------------------------------------------------------------------------
    // Text colors
    // ------------------------------------------------------------------------
    textLight: '#ffffff',
    textMuted: '#b2bec3',
    textDark: '#2d3436',
    textMedium: '#636e72',

    // ------------------------------------------------------------------------
    // Borders
    // ------------------------------------------------------------------------
    borderLight: '#dfe6e9',
    borderMedium: '#b2bec3',
    borderDark: '#636e72',

    // ------------------------------------------------------------------------
    // Shadows
    // ------------------------------------------------------------------------
    shadowSm: '0 2px 4px rgba(0,0,0,0.1)',
    shadowMd: '0 4px 12px rgba(0,0,0,0.15)',
    shadowLg: '0 8px 24px rgba(0,0,0,0.2)',
    shadowXl: '0 12px 48px rgba(0,0,0,0.3)',

    // ------------------------------------------------------------------------
    // Transitions
    // ------------------------------------------------------------------------
    transitionFast: '0.15s ease',
    transitionMedium: '0.25s ease',
    transitionSlow: '0.35s ease',

    // ------------------------------------------------------------------------
    // Sizing
    // ------------------------------------------------------------------------
    sidebarWidth: '320px',
    sidebarCollapsedWidth: '0px',
    toggleButtonWidth: '32px',
    toggleButtonHeight: '80px',
    borderRadius: '8px',
    borderRadiusLg: '12px',
} as const;

// ============================================================================
// STYLE INJECTION
// ============================================================================

/**
 * Injects the CSS styles for the UIManager sidebar into the document head.
 * Uses a unique ID to prevent duplicate style injection.
 * 
 * @example
 * ```typescript
 * injectUIManagerStyles();
 * ```
 */
export function injectUIManagerStyles(): void {
    const styleId = 'uimanager-styles-v2';

    // Prevent duplicate injection
    if (document.getElementById(styleId)) {
        return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = generateStylesheet();
    document.head.appendChild(style);

    console.log('[UIManagerStyles] ✓ Styles injected');
}

/**
 * Generates the complete CSS stylesheet for the UIManager
 * 
 * @returns Complete CSS string for the sidebar UI
 */
function generateStylesheet(): string {
    return `
        /* ============================================
           SIDEBAR BASE
           ============================================ */
        .mrw-sidebar {
            position: fixed;
            top: 0;
            right: 0;
            width: ${THEME.sidebarWidth};
            height: 100vh;
            background: linear-gradient(180deg, ${THEME.bgDark} 0%, ${THEME.primaryDark} 100%);
            box-shadow: ${THEME.shadowXl};
            z-index: 1000;
            display: flex;
            flex-direction: column;
            transform: translateX(0);
            transition: transform ${THEME.transitionMedium};
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        
        .mrw-sidebar.collapsed {
            transform: translateX(100%);
        }
        
        /* ============================================
           TOGGLE BUTTON - Text Label Style
           ============================================ */
        .mrw-toggle-btn {
            position: fixed;
            top: 50%;
            right: ${THEME.sidebarWidth};
            transform: translateY(-50%);
            width: ${THEME.toggleButtonWidth};
            height: ${THEME.toggleButtonHeight};
            background: ${THEME.primary};
            border: none;
            border-radius: ${THEME.borderRadius} 0 0 ${THEME.borderRadius};
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: ${THEME.shadowMd};
            transition: all ${THEME.transitionMedium};
            z-index: 1001;
            padding: 8px 4px;
        }
        
        .mrw-toggle-btn:hover {
            background: ${THEME.primaryLight};
            width: 38px;
        }
        
        .mrw-toggle-btn.sidebar-collapsed {
            right: 0;
        }
        
        .mrw-toggle-btn .toggle-label {
            writing-mode: vertical-rl;
            text-orientation: mixed;
            transform: rotate(180deg);
            font-size: 12px;
            font-weight: 600;
            color: ${THEME.textLight};
            letter-spacing: 1px;
            text-transform: uppercase;
        }
        
        /* ============================================
           OVERLAY
           ============================================ */
        .mrw-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.3);
            opacity: 0;
            visibility: hidden;
            transition: all ${THEME.transitionMedium};
            z-index: 999;
        }
        
        .mrw-overlay.visible {
            opacity: 1;
            visibility: visible;
        }
        
        /* ============================================
           HEADER
           ============================================ */
        .mrw-header {
            padding: 20px;
            background: linear-gradient(135deg, ${THEME.primary} 0%, ${THEME.primaryDark} 100%);
            border-bottom: 1px solid rgba(255,255,255,0.1);
            flex-shrink: 0;
        }
        
        .mrw-header-title {
            display: flex;
            align-items: center;
            gap: 12px;
            color: ${THEME.textLight};
            font-size: 18px;
            font-weight: 600;
            margin: 0;
        }
        
        .mrw-header-title .icon {
            font-size: 24px;
        }
        
        .mrw-header-subtitle {
            color: ${THEME.textMuted};
            font-size: 12px;
            margin-top: 4px;
            margin-left: 36px;
        }
        
        /* ============================================
           SCROLLABLE CONTENT
           ============================================ */
        .mrw-content {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
        }
        
        .mrw-content::-webkit-scrollbar {
            width: 6px;
        }
        
        .mrw-content::-webkit-scrollbar-track {
            background: transparent;
        }
        
        .mrw-content::-webkit-scrollbar-thumb {
            background: ${THEME.bgLight};
            border-radius: 3px;
        }
        
        .mrw-content::-webkit-scrollbar-thumb:hover {
            background: ${THEME.bgLighter};
        }
        
        /* ============================================
           SECTIONS
           ============================================ */
        .mrw-section {
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        
        .mrw-section-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 20px;
            background: rgba(0,0,0,0.2);
            cursor: pointer;
            transition: background ${THEME.transitionFast};
        }
        
        .mrw-section-header:hover {
            background: rgba(0,0,0,0.3);
        }
        
        .mrw-section-title {
            display: flex;
            align-items: center;
            gap: 10px;
            color: ${THEME.textLight};
            font-weight: 600;
            font-size: 13px;
        }
        
        .mrw-section-title .icon {
            font-size: 16px;
            opacity: 0.8;
        }
        
        .mrw-section-arrow {
            color: ${THEME.textMuted};
            font-size: 10px;
            transition: transform ${THEME.transitionFast};
        }
        
        .mrw-section-arrow.collapsed {
            transform: rotate(-90deg);
        }
        
        .mrw-section-content {
            padding: 0 20px;
            overflow: hidden;
            transition: max-height ${THEME.transitionMedium}, padding ${THEME.transitionMedium};
        }
        
        .mrw-section-content.collapsed {
            max-height: 0 !important;
            padding-top: 0;
            padding-bottom: 0;
        }
        
        .mrw-section-content.expanded {
            padding: 16px 20px;
        }
        
        /* ============================================
           IMPORT SECTION
           ============================================ */
        .mrw-import-section {
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        
        .mrw-import-btn {
            width: 100%;
            padding: 12px 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            background: linear-gradient(135deg, ${THEME.success} 0%, #219a52 100%);
            border: none;
            border-radius: ${THEME.borderRadius};
            color: white;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all ${THEME.transitionFast};
            box-shadow: 0 2px 8px rgba(39, 174, 96, 0.3);
        }
        
        .mrw-import-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(39, 174, 96, 0.4);
        }
        
        .mrw-import-btn:active {
            transform: translateY(0);
        }
        
        .mrw-import-btn .icon {
            font-size: 18px;
        }
        
        /* ============================================
           TRACK BUTTONS
           ============================================ */
        .mrw-track-btn {
            width: 100%;
            padding: 10px 12px;
            display: flex;
            align-items: center;
            gap: 12px;
            background: rgba(255,255,255,0.05);
            border: 1px solid transparent;
            border-radius: 6px;
            color: ${THEME.textLight};
            font-size: 13px;
            cursor: pointer;
            transition: all ${THEME.transitionFast};
            margin-bottom: 6px;
            text-align: left;
        }
        
        .mrw-track-btn:last-child {
            margin-bottom: 0;
        }
        
        .mrw-track-btn:hover {
            background: rgba(255,255,255,0.1);
            border-color: rgba(255,255,255,0.1);
        }
        
        .mrw-track-btn.selected {
            background: rgba(52, 152, 219, 0.3);
            border-color: ${THEME.accent};
        }
        
        .mrw-track-btn .track-icon {
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0,0,0,0.3);
            border-radius: 6px;
            font-size: 16px;
        }
        
        .mrw-track-btn .track-info {
            flex: 1;
            min-width: 0;
        }
        
        .mrw-track-btn .track-name {
            font-weight: 500;
            margin-bottom: 2px;
        }
        
        .mrw-track-btn .track-id {
            font-size: 10px;
            color: ${THEME.textMuted};
            font-family: 'Monaco', 'Consolas', monospace;
        }
        
        /* ============================================
           TOGGLE SWITCHES
           ============================================ */
        .mrw-toggle-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        
        .mrw-toggle-row:last-child {
            border-bottom: none;
        }
        
        .mrw-toggle-label {
            display: flex;
            align-items: center;
            gap: 8px;
            color: ${THEME.textLight};
            font-size: 13px;
        }
        
        .mrw-toggle-label .icon {
            font-size: 14px;
            opacity: 0.7;
        }
        
        .mrw-toggle-switch {
            position: relative;
            width: 44px;
            height: 24px;
            background: ${THEME.bgLight};
            border: none;
            border-radius: 12px;
            cursor: pointer;
            transition: background ${THEME.transitionFast};
            padding: 0;
        }
        
        .mrw-toggle-switch:hover {
            background: ${THEME.bgLighter};
        }
        
        .mrw-toggle-switch.active {
            background: ${THEME.success};
        }
        
        .mrw-toggle-switch .knob {
            position: absolute;
            top: 3px;
            left: 3px;
            width: 18px;
            height: 18px;
            background: white;
            border-radius: 50%;
            transition: transform ${THEME.transitionFast};
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
        
        .mrw-toggle-switch.active .knob {
            transform: translateX(20px);
        }
        
        /* ============================================
           KEYBOARD SHORTCUTS
           ============================================ */
        .mrw-shortcut-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        
        .mrw-shortcut-row:last-child {
            border-bottom: none;
        }
        
        .mrw-shortcut-key {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .mrw-shortcut-key kbd {
            display: inline-block;
            padding: 3px 6px;
            background: ${THEME.bgMedium};
            border: 1px solid ${THEME.bgLight};
            border-radius: 4px;
            font-size: 11px;
            color: ${THEME.textLight};
            box-shadow: 0 2px 0 rgba(0,0,0,0.2);
        }
        
        .mrw-shortcut-desc {
            color: ${THEME.textMuted};
            font-size: 12px;
        }
        
        /* ============================================
           FOOTER
           ============================================ */
        .mrw-footer {
            padding: 16px 20px;
            background: rgba(0,0,0,0.3);
            border-top: 1px solid rgba(255,255,255,0.05);
            flex-shrink: 0;
        }
        
        .mrw-mode-indicator {
            display: flex;
            align-items: center;
            gap: 10px;
            color: ${THEME.textLight};
            font-size: 13px;
        }
        
        .mrw-mode-indicator .icon {
            font-size: 18px;
        }
        
        .mrw-mode-indicator .mode-text {
            font-weight: 600;
        }
        
        .mrw-mode-indicator .mode-hint {
            font-size: 11px;
            color: ${THEME.textMuted};
            margin-top: 2px;
        }
        
        /* ============================================
           RESPONSIVE
           ============================================ */
        @media (max-width: 768px) {
            .mrw-sidebar {
                width: 100%;
            }
            
            .mrw-toggle-btn {
                right: 0;
            }
            
            .mrw-toggle-btn:not(.sidebar-collapsed) {
                right: calc(100% - ${THEME.toggleButtonWidth});
            }
        }
    `;
}

// ============================================================================
// KEYBOARD SHORTCUTS DATA
// ============================================================================

/**
 * Keyboard shortcuts data for the shortcuts section
 */
export const KEYBOARD_SHORTCUTS = [
    { keys: ['[', ']'], desc: 'Rotate ±5°' },
    { keys: ['Shift', '[', ']'], desc: 'Rotate ±22.5°' },
    { keys: ['S', 'Scroll'], desc: 'Scale model' },
    { keys: ['H', 'Scroll'], desc: 'Adjust height' },
    { keys: ['PgUp', 'PgDn'], desc: 'Height ±5mm' },
    { keys: ['R'], desc: 'Reset scale' },
    { keys: ['L'], desc: 'Lock scale' },
    { keys: ['T'], desc: 'Toggle switch' },
    { keys: ['Del'], desc: 'Delete selected' },
    { keys: ['Esc'], desc: 'Cancel / Deselect' },
    { keys: ['V'], desc: 'Toggle camera mode' },
    { keys: ['Home'], desc: 'Reset camera' },
    { keys: ['Shift', 'S'], desc: 'Toggle auto-snap' },
    { keys: ['Shift', 'I'], desc: 'Toggle indicators' },
    { keys: ['Shift', 'C'], desc: 'Clear all track' },
] as const;

/**
 * Mode icons for the footer mode indicator
 */
export const MODE_ICONS: Record<string, string> = {
    select: '🖱️',
    place: '📍',
    move: '✋',
    rotate: '🔄',
    delete: '🗑️'
};