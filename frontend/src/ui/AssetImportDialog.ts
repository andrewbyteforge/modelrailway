/**
 * AssetImportDialog.ts - Modal dialog for importing rolling stock assets
 * 
 * Path: frontend/src/ui/AssetImportDialog.ts
 * 
 * Provides:
 * - File selection with drag-and-drop support
 * - Category selection (required)
 * - Asset naming
 * - Scaling options
 * - Preview information
 * 
 * @module AssetImportDialog
 * @version 1.0.0
 */

import type {
    RollingStockCategory,
    AssetImportOptions,
    AssetScalingMode
} from '@shared/types/assetLibrary.types';
import {
    ROLLING_STOCK_CATEGORY_LABELS,
    ROLLING_STOCK_CATEGORY_ICONS
} from '@shared/types/assetLibrary.types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Callback when import is confirmed
 */
export type ImportConfirmCallback = (options: AssetImportOptions) => void;

/**
 * Callback when dialog is cancelled
 */
export type ImportCancelCallback = () => void;

// ============================================================================
// DIALOG STYLES
// ============================================================================

const DIALOG_STYLES = {
    OVERLAY: `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        backdrop-filter: blur(2px);
    `,
    DIALOG: `
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        max-width: 500px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `,
    HEADER: `
        background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
        color: white;
        padding: 16px 20px;
        border-radius: 12px 12px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `,
    TITLE: `
        margin: 0;
        font-size: 18px;
        font-weight: 600;
    `,
    CLOSE_BTN: `
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        font-size: 20px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
        transition: background 0.2s;
    `,
    BODY: `
        padding: 20px;
    `,
    SECTION: `
        margin-bottom: 20px;
    `,
    LABEL: `
        display: block;
        margin-bottom: 8px;
        font-weight: 600;
        color: #333;
        font-size: 14px;
    `,
    REQUIRED: `
        color: #e53935;
        margin-left: 4px;
    `,
    DROP_ZONE: `
        border: 2px dashed #ccc;
        border-radius: 8px;
        padding: 30px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;
        background: #fafafa;
    `,
    DROP_ZONE_ACTIVE: `
        border-color: #2196F3;
        background: #e3f2fd;
    `,
    DROP_ZONE_HAS_FILE: `
        border-color: #4CAF50;
        background: #e8f5e9;
    `,
    INPUT: `
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
        transition: border-color 0.2s;
        box-sizing: border-box;
    `,
    SELECT: `
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
        background: white;
        cursor: pointer;
    `,
    CATEGORY_OPTIONS: `
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
    `,
    CATEGORY_OPTION: `
        border: 2px solid #ddd;
        border-radius: 8px;
        padding: 12px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;
        background: white;
    `,
    CATEGORY_OPTION_SELECTED: `
        border-color: #2196F3;
        background: #e3f2fd;
    `,
    FOOTER: `
        padding: 16px 20px;
        background: #f5f5f5;
        border-radius: 0 0 12px 12px;
        display: flex;
        justify-content: flex-end;
        gap: 10px;
    `,
    BTN: `
        padding: 10px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
    `,
    BTN_CANCEL: `
        background: #e0e0e0;
        color: #333;
    `,
    BTN_IMPORT: `
        background: #2196F3;
        color: white;
    `,
    BTN_DISABLED: `
        opacity: 0.5;
        cursor: not-allowed;
    `,
    FILE_INFO: `
        margin-top: 10px;
        padding: 10px;
        background: #f5f5f5;
        border-radius: 6px;
        font-size: 13px;
        color: #666;
    `,
    SCALING_OPTIONS: `
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
    `,
    SCALING_OPTION: `
        border: 2px solid #ddd;
        border-radius: 6px;
        padding: 10px;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 13px;
    `,
    SCALING_INPUT_GROUP: `
        margin-top: 10px;
    `,
    ERROR: `
        color: #e53935;
        font-size: 13px;
        margin-top: 5px;
    `
} as const;

// ============================================================================
// ASSET IMPORT DIALOG CLASS
// ============================================================================

/**
 * AssetImportDialog - Modal dialog for importing rolling stock assets
 * 
 * @example
 * ```typescript
 * const dialog = new AssetImportDialog();
 * dialog.show(
 *     (options) => {
 *         console.log('Import:', options);
 *     },
 *     () => {
 *         console.log('Cancelled');
 *     }
 * );
 * ```
 */
export class AssetImportDialog {
    // ========================================================================
    // PRIVATE MEMBERS
    // ========================================================================

    /** Overlay element */
    private overlay: HTMLDivElement | null = null;

    /** Selected file */
    private selectedFile: File | null = null;

    /** Selected category */
    private selectedCategory: RollingStockCategory | null = null;

    /** Asset name */
    private assetName: string = '';

    /** Selected scaling mode */
    private scalingMode: AssetScalingMode = 'reference';

    /** Reference length in mm */
    private referenceLengthMm: number = 230;

    /** Direct scale factor */
    private scaleFactor: number = 1.0;

    /** Confirm callback */
    private onConfirm: ImportConfirmCallback | null = null;

    /** Cancel callback */
    private onCancel: ImportCancelCallback | null = null;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    constructor() {
        console.log('[AssetImportDialog] Created');
    }

    // ========================================================================
    // PUBLIC METHODS
    // ========================================================================

    /**
     * Show the import dialog
     * 
     * @param onConfirm - Callback when import is confirmed
     * @param onCancel - Callback when dialog is cancelled
     */
    public show(onConfirm: ImportConfirmCallback, onCancel?: ImportCancelCallback): void {
        console.log('[AssetImportDialog] Showing dialog');

        this.onConfirm = onConfirm;
        this.onCancel = onCancel || null;

        // Reset state
        this.selectedFile = null;
        this.selectedCategory = null;
        this.assetName = '';
        this.scalingMode = 'reference';
        this.referenceLengthMm = 230;
        this.scaleFactor = 1.0;

        this.createDialog();
    }

    /**
     * Hide the import dialog
     */
    public hide(): void {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }

    // ========================================================================
    // DIALOG CREATION
    // ========================================================================

    /**
     * Create the dialog DOM structure
     */
    private createDialog(): void {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.style.cssText = DIALOG_STYLES.OVERLAY;

        // Create dialog container
        const dialog = document.createElement('div');
        dialog.style.cssText = DIALOG_STYLES.DIALOG;

        // Header
        const header = this.createHeader();
        dialog.appendChild(header);

        // Body
        const body = this.createBody();
        dialog.appendChild(body);

        // Footer
        const footer = this.createFooter();
        dialog.appendChild(footer);

        // Prevent clicks on dialog from closing it
        dialog.addEventListener('click', (e) => e.stopPropagation());

        // Close on overlay click
        this.overlay.addEventListener('click', () => this.handleCancel());

        this.overlay.appendChild(dialog);
        document.body.appendChild(this.overlay);

        // Focus first input
        const firstInput = dialog.querySelector('input');
        if (firstInput) {
            firstInput.focus();
        }
    }

    /**
     * Create dialog header
     */
    private createHeader(): HTMLElement {
        const header = document.createElement('div');
        header.style.cssText = DIALOG_STYLES.HEADER;

        const title = document.createElement('h2');
        title.style.cssText = DIALOG_STYLES.TITLE;
        title.textContent = '🚂 Import Rolling Stock';

        const closeBtn = document.createElement('button');
        closeBtn.style.cssText = DIALOG_STYLES.CLOSE_BTN;
        closeBtn.innerHTML = '×';
        closeBtn.title = 'Close';
        closeBtn.onclick = () => this.handleCancel();
        closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(255,255,255,0.3)';
        closeBtn.onmouseout = () => closeBtn.style.background = 'rgba(255,255,255,0.2)';

        header.appendChild(title);
        header.appendChild(closeBtn);

        return header;
    }

    /**
     * Create dialog body
     */
    private createBody(): HTMLElement {
        const body = document.createElement('div');
        body.style.cssText = DIALOG_STYLES.BODY;

        // File selection section
        body.appendChild(this.createFileSection());

        // Category selection section
        body.appendChild(this.createCategorySection());

        // Name section
        body.appendChild(this.createNameSection());

        // Scaling section
        body.appendChild(this.createScalingSection());

        return body;
    }

    /**
     * Create file selection section
     */
    private createFileSection(): HTMLElement {
        const section = document.createElement('div');
        section.style.cssText = DIALOG_STYLES.SECTION;

        const label = document.createElement('label');
        label.style.cssText = DIALOG_STYLES.LABEL;
        label.innerHTML = '📁 Select File<span style="' + DIALOG_STYLES.REQUIRED + '">*</span>';

        const dropZone = document.createElement('div');
        dropZone.id = 'import-drop-zone';
        dropZone.style.cssText = DIALOG_STYLES.DROP_ZONE;
        dropZone.innerHTML = `
            <div style="font-size: 32px; margin-bottom: 10px;">📦</div>
            <div style="font-weight: 500; margin-bottom: 5px;">Drop GLB/GLTF file here</div>
            <div style="color: #888; font-size: 13px;">or click to browse</div>
        `;

        // Hidden file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.glb,.gltf';
        fileInput.style.display = 'none';
        fileInput.id = 'import-file-input';

        // Click to select
        dropZone.onclick = () => fileInput.click();

        // File input change
        fileInput.onchange = () => {
            if (fileInput.files && fileInput.files.length > 0) {
                this.handleFileSelected(fileInput.files[0], dropZone);
            }
        };

        // Drag and drop events
        dropZone.ondragover = (e) => {
            e.preventDefault();
            dropZone.style.cssText = DIALOG_STYLES.DROP_ZONE + DIALOG_STYLES.DROP_ZONE_ACTIVE;
        };

        dropZone.ondragleave = () => {
            dropZone.style.cssText = DIALOG_STYLES.DROP_ZONE +
                (this.selectedFile ? DIALOG_STYLES.DROP_ZONE_HAS_FILE : '');
        };

        dropZone.ondrop = (e) => {
            e.preventDefault();
            if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                this.handleFileSelected(e.dataTransfer.files[0], dropZone);
            }
        };

        section.appendChild(label);
        section.appendChild(dropZone);
        section.appendChild(fileInput);

        // File info container
        const fileInfo = document.createElement('div');
        fileInfo.id = 'import-file-info';
        fileInfo.style.cssText = DIALOG_STYLES.FILE_INFO;
        fileInfo.style.display = 'none';
        section.appendChild(fileInfo);

        return section;
    }

    /**
     * Handle file selection
     */
    private handleFileSelected(file: File, dropZone: HTMLElement): void {
        const validExtensions = ['.glb', '.gltf'];
        const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

        if (!validExtensions.includes(extension)) {
            this.showError('Invalid file type. Please select a GLB or GLTF file.');
            return;
        }

        this.selectedFile = file;
        this.assetName = this.cleanFilename(file.name);

        // Update drop zone
        dropZone.style.cssText = DIALOG_STYLES.DROP_ZONE + DIALOG_STYLES.DROP_ZONE_HAS_FILE;
        dropZone.innerHTML = `
            <div style="font-size: 32px; margin-bottom: 10px;">✅</div>
            <div style="font-weight: 500; margin-bottom: 5px;">${file.name}</div>
            <div style="color: #4CAF50; font-size: 13px;">Click to change file</div>
        `;

        // Update file info
        const fileInfo = document.getElementById('import-file-info');
        if (fileInfo) {
            fileInfo.style.display = 'block';
            fileInfo.innerHTML = `
                <strong>File:</strong> ${file.name}<br>
                <strong>Size:</strong> ${this.formatFileSize(file.size)}<br>
                <strong>Type:</strong> ${extension.toUpperCase().slice(1)} Model
            `;
        }

        // Update name input
        const nameInput = document.getElementById('import-name-input') as HTMLInputElement;
        if (nameInput) {
            nameInput.value = this.assetName;
        }

        this.updateImportButton();
    }

    /**
     * Create category selection section
     */
    private createCategorySection(): HTMLElement {
        const section = document.createElement('div');
        section.style.cssText = DIALOG_STYLES.SECTION;

        const label = document.createElement('label');
        label.style.cssText = DIALOG_STYLES.LABEL;
        label.innerHTML = '🏷️ Category<span style="' + DIALOG_STYLES.REQUIRED + '">*</span>';

        const options = document.createElement('div');
        options.style.cssText = DIALOG_STYLES.CATEGORY_OPTIONS;

        const categories: RollingStockCategory[] = ['trains', 'carriages', 'freight'];

        categories.forEach(category => {
            const option = document.createElement('div');
            option.style.cssText = DIALOG_STYLES.CATEGORY_OPTION;
            option.setAttribute('data-category', category);
            option.innerHTML = `
                <div style="font-size: 24px; margin-bottom: 5px;">${ROLLING_STOCK_CATEGORY_ICONS[category]}</div>
                <div style="font-size: 12px; font-weight: 500;">${ROLLING_STOCK_CATEGORY_LABELS[category]}</div>
            `;

            option.onclick = () => this.selectCategory(category, options);

            option.onmouseover = () => {
                if (this.selectedCategory !== category) {
                    option.style.background = '#f5f5f5';
                }
            };

            option.onmouseout = () => {
                if (this.selectedCategory !== category) {
                    option.style.background = 'white';
                }
            };

            options.appendChild(option);
        });

        section.appendChild(label);
        section.appendChild(options);

        return section;
    }

    /**
     * Handle category selection
     */
    private selectCategory(category: RollingStockCategory, container: HTMLElement): void {
        this.selectedCategory = category;

        // Update visual state
        const options = container.querySelectorAll('[data-category]');
        options.forEach(opt => {
            const optCategory = opt.getAttribute('data-category');
            if (optCategory === category) {
                (opt as HTMLElement).style.cssText = DIALOG_STYLES.CATEGORY_OPTION + DIALOG_STYLES.CATEGORY_OPTION_SELECTED;
            } else {
                (opt as HTMLElement).style.cssText = DIALOG_STYLES.CATEGORY_OPTION;
            }
        });

        this.updateImportButton();
    }

    /**
     * Create name input section
     */
    private createNameSection(): HTMLElement {
        const section = document.createElement('div');
        section.style.cssText = DIALOG_STYLES.SECTION;

        const label = document.createElement('label');
        label.style.cssText = DIALOG_STYLES.LABEL;
        label.innerHTML = '✏️ Display Name';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'import-name-input';
        input.style.cssText = DIALOG_STYLES.INPUT;
        input.placeholder = 'Enter a name for this asset...';
        input.value = this.assetName;

        input.oninput = () => {
            this.assetName = input.value.trim();
        };

        input.onfocus = () => input.style.borderColor = '#2196F3';
        input.onblur = () => input.style.borderColor = '#ddd';

        section.appendChild(label);
        section.appendChild(input);

        return section;
    }

    /**
     * Create scaling options section
     */
    private createScalingSection(): HTMLElement {
        const section = document.createElement('div');
        section.style.cssText = DIALOG_STYLES.SECTION;

        const label = document.createElement('label');
        label.style.cssText = DIALOG_STYLES.LABEL;
        label.innerHTML = '📐 Scaling Mode';

        const options = document.createElement('div');
        options.style.cssText = DIALOG_STYLES.SCALING_OPTIONS;

        const scalingModes: { mode: AssetScalingMode; label: string; desc: string }[] = [
            { mode: 'reference', label: 'Reference Length', desc: 'Specify real length in mm' },
            { mode: 'real-world', label: 'Real-World Size', desc: 'Model is 1:1 scale' },
            { mode: 'direct-scale', label: 'Direct Scale', desc: 'Apply custom scale factor' },
            { mode: 'as-is', label: 'As-Is', desc: 'Use model unchanged' }
        ];

        scalingModes.forEach(({ mode, label: modeLabel, desc }) => {
            const option = document.createElement('div');
            option.style.cssText = DIALOG_STYLES.SCALING_OPTION +
                (this.scalingMode === mode ? 'border-color: #2196F3; background: #e3f2fd;' : '');
            option.setAttribute('data-scaling-mode', mode);
            option.innerHTML = `
                <div style="font-weight: 500; font-size: 13px;">${modeLabel}</div>
                <div style="color: #888; font-size: 11px;">${desc}</div>
            `;

            option.onclick = () => this.selectScalingMode(mode, options);

            options.appendChild(option);
        });

        section.appendChild(label);
        section.appendChild(options);

        // Additional input for reference length
        const referenceInput = document.createElement('div');
        referenceInput.id = 'scaling-reference-input';
        referenceInput.style.cssText = DIALOG_STYLES.SCALING_INPUT_GROUP;
        referenceInput.innerHTML = `
            <label style="${DIALOG_STYLES.LABEL}; font-size: 13px;">Reference Length (mm)</label>
            <input type="number" id="reference-length-input"
                   style="${DIALOG_STYLES.INPUT}"
                   value="${this.referenceLengthMm}"
                   min="1" max="1000" step="1"
                   placeholder="e.g., 230 for OO gauge loco">
            <div style="color: #888; font-size: 11px; margin-top: 5px;">
                Typical OO gauge loco: 200-250mm
            </div>
        `;

        const refInput = referenceInput.querySelector('#reference-length-input') as HTMLInputElement;
        refInput.oninput = () => {
            this.referenceLengthMm = parseFloat(refInput.value) || 230;
        };

        section.appendChild(referenceInput);

        // Direct scale input (hidden by default)
        const scaleInput = document.createElement('div');
        scaleInput.id = 'scaling-direct-input';
        scaleInput.style.cssText = DIALOG_STYLES.SCALING_INPUT_GROUP;
        scaleInput.style.display = 'none';
        scaleInput.innerHTML = `
            <label style="${DIALOG_STYLES.LABEL}; font-size: 13px;">Scale Factor</label>
            <input type="number" id="scale-factor-input"
                   style="${DIALOG_STYLES.INPUT}"
                   value="${this.scaleFactor}"
                   min="0.001" max="100" step="0.001">
        `;

        const scaleFactorInput = scaleInput.querySelector('#scale-factor-input') as HTMLInputElement;
        scaleFactorInput.oninput = () => {
            this.scaleFactor = parseFloat(scaleFactorInput.value) || 1.0;
        };

        section.appendChild(scaleInput);

        return section;
    }

    /**
     * Handle scaling mode selection
     */
    private selectScalingMode(mode: AssetScalingMode, container: HTMLElement): void {
        this.scalingMode = mode;

        // Update visual state
        const options = container.querySelectorAll('[data-scaling-mode]');
        options.forEach(opt => {
            const optMode = opt.getAttribute('data-scaling-mode');
            if (optMode === mode) {
                (opt as HTMLElement).style.cssText = DIALOG_STYLES.SCALING_OPTION + 'border-color: #2196F3; background: #e3f2fd;';
            } else {
                (opt as HTMLElement).style.cssText = DIALOG_STYLES.SCALING_OPTION;
            }
        });

        // Show/hide additional inputs
        const referenceInput = document.getElementById('scaling-reference-input');
        const directInput = document.getElementById('scaling-direct-input');

        if (referenceInput) {
            referenceInput.style.display = mode === 'reference' ? 'block' : 'none';
        }
        if (directInput) {
            directInput.style.display = mode === 'direct-scale' ? 'block' : 'none';
        }
    }

    /**
     * Create dialog footer
     */
    private createFooter(): HTMLElement {
        const footer = document.createElement('div');
        footer.style.cssText = DIALOG_STYLES.FOOTER;

        const cancelBtn = document.createElement('button');
        cancelBtn.style.cssText = DIALOG_STYLES.BTN + DIALOG_STYLES.BTN_CANCEL;
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => this.handleCancel();

        cancelBtn.onmouseover = () => cancelBtn.style.background = '#bdbdbd';
        cancelBtn.onmouseout = () => cancelBtn.style.background = '#e0e0e0';

        const importBtn = document.createElement('button');
        importBtn.id = 'import-confirm-btn';
        importBtn.style.cssText = DIALOG_STYLES.BTN + DIALOG_STYLES.BTN_IMPORT + DIALOG_STYLES.BTN_DISABLED;
        importBtn.textContent = 'Import Asset';
        importBtn.disabled = true;
        importBtn.onclick = () => this.handleConfirm();

        footer.appendChild(cancelBtn);
        footer.appendChild(importBtn);

        return footer;
    }

    /**
     * Update import button enabled state
     */
    private updateImportButton(): void {
        const btn = document.getElementById('import-confirm-btn') as HTMLButtonElement;
        if (btn) {
            const isValid = this.selectedFile !== null && this.selectedCategory !== null;
            btn.disabled = !isValid;
            btn.style.cssText = DIALOG_STYLES.BTN + DIALOG_STYLES.BTN_IMPORT +
                (isValid ? '' : DIALOG_STYLES.BTN_DISABLED);

            if (isValid) {
                btn.onmouseover = () => btn.style.background = '#1976D2';
                btn.onmouseout = () => btn.style.background = '#2196F3';
            }
        }
    }

    /**
     * Handle import confirmation
     */
    private handleConfirm(): void {
        if (!this.selectedFile || !this.selectedCategory) {
            return;
        }

        const options: AssetImportOptions = {
            file: this.selectedFile,
            category: this.selectedCategory,
            name: this.assetName || undefined,
            scaling: {
                mode: this.scalingMode,
                referenceLengthMm: this.scalingMode === 'reference' ? this.referenceLengthMm : undefined,
                scaleFactor: this.scalingMode === 'direct-scale' ? this.scaleFactor : undefined
            }
        };

        console.log('[AssetImportDialog] Confirming import:', options);

        this.hide();

        if (this.onConfirm) {
            this.onConfirm(options);
        }
    }

    /**
     * Handle dialog cancel
     */
    private handleCancel(): void {
        console.log('[AssetImportDialog] Cancelled');
        this.hide();

        if (this.onCancel) {
            this.onCancel();
        }
    }

    // ========================================================================
    // UTILITY METHODS
    // ========================================================================

    /**
     * Clean filename to use as display name
     */
    private cleanFilename(filename: string): string {
        const withoutExt = filename.replace(/\.[^/.]+$/, '');
        const cleaned = withoutExt.replace(/[_-]/g, ' ');
        return cleaned.replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * Format file size for display
     */
    private formatFileSize(bytes: number): string {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    /**
     * Show error message
     */
    private showError(message: string): void {
        // Find or create error container
        let errorDiv = document.getElementById('import-error');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'import-error';
            errorDiv.style.cssText = DIALOG_STYLES.ERROR;

            const dropZone = document.getElementById('import-drop-zone');
            if (dropZone && dropZone.parentElement) {
                dropZone.parentElement.appendChild(errorDiv);
            }
        }

        errorDiv.textContent = message;
        errorDiv.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
}