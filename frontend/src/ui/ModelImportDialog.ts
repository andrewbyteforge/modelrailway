/**
 * ModelImportDialog.ts - UI dialog for importing 3D models
 * 
 * Path: frontend/src/ui/ModelImportDialog.ts
 * 
 * Provides a modal dialog for:
 * - Selecting GLB/GLTF files to import
 * - Previewing model dimensions
 * - Configuring scale (real-world dimensions or reference)
 * - Setting category and tags
 * - Saving to library
 * 
 * FIXED: Category card click handlers now work properly (v1.1.0)
 * 
 * @module ModelImportDialog
 * @author Model Railway Workbench
 * @version 1.1.0 - Fixed category selection
 */

import { Scene } from '@babylonjs/core/scene';
import { ModelLibrary, type ModelCategory, type ModelLibraryEntry } from '../systems/models/ModelLibrary';
import { ModelScaleHelper, type ModelDimensions, type ScaleResult } from '../systems/models/ModelScaleHelper';
import { ModelSystem, type ModelLoadResult } from '../systems/models/ModelSystem';
import {
    type ScaleMode,
    type ImportCallback,
    type ImportFormState,
    type RollingStockSubcategory,
    DIALOG_Z_INDEX,
    buildDialogHTML,
    getOverlayStyles,
    getContainerStyles,
    createDefaultFormState,
    detectRollingStock,
    detectRollingStockType,
    attachCategoryHandlers
} from './ModelImportDialogTemplate';

// Re-export types for external use
export type { ImportCallback };

// ============================================================================
// MODEL IMPORT DIALOG CLASS
// ============================================================================

/**
 * ModelImportDialog - Modal dialog for importing 3D models
 * 
 * @example
 * ```typescript
 * const dialog = new ModelImportDialog(scene, modelSystem);
 * dialog.show((entry) => {
 *     if (entry) {
 *         console.log('Imported:', entry.name);
 *     }
 * });
 * ```
 */
export class ModelImportDialog {
    // ========================================================================
    // PRIVATE PROPERTIES
    // ========================================================================

    /** Babylon.js scene */
    private scene: Scene;

    /** Model system reference */
    private modelSystem: ModelSystem;

    /** Model library reference */
    private library: ModelLibrary;

    /** Dialog container element */
    private container: HTMLElement | null = null;

    /** Overlay element */
    private overlay: HTMLElement | null = null;

    /** Currently loaded file data */
    private loadedFileData: {
        dataUrl: string;
        fileName: string;
        fileSize: number;
        loadResult?: ModelLoadResult;
    } | null = null;

    /** Current scale calculation */
    private currentScaleResult: ScaleResult | null = null;

    /** Import callback */
    private onImport: ImportCallback | null = null;

    /** Form state */
    private formState: ImportFormState;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new ModelImportDialog
     * @param scene - Babylon.js scene
     * @param modelSystem - Model system reference
     */
    constructor(scene: Scene, modelSystem: ModelSystem) {
        this.scene = scene;
        this.modelSystem = modelSystem;
        this.library = ModelLibrary.getInstance();
        this.formState = createDefaultFormState();
    }

    // ========================================================================
    // DIALOG LIFECYCLE
    // ========================================================================

    /**
     * Show the import dialog
     * @param callback - Called when import completes or is cancelled
     */
    show(callback: ImportCallback): void {
        this.onImport = callback;
        this.formState = createDefaultFormState(); // Reset form state
        this.createDialog();
    }

    /**
     * Close the dialog
     * @param result - Entry to pass to callback (null if cancelled)
     */
    close(result: ModelLibraryEntry | null = null): void {
        // Clean up loaded model data
        if (this.loadedFileData?.loadResult?.rootNode) {
            this.loadedFileData.loadResult.rootNode.dispose();
        }

        // Remove DOM elements
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }

        // Reset state
        this.loadedFileData = null;
        this.currentScaleResult = null;

        // Call callback
        if (this.onImport) {
            this.onImport(result);
            this.onImport = null;
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
        this.overlay.style.cssText = getOverlayStyles();
        this.overlay.addEventListener('click', () => this.close());
        document.body.appendChild(this.overlay);

        // Create dialog container
        this.container = document.createElement('div');
        this.container.style.cssText = getContainerStyles();
        this.container.addEventListener('click', e => e.stopPropagation());

        // Build dialog content from template
        this.container.innerHTML = buildDialogHTML();

        // Add to DOM
        document.body.appendChild(this.container);

        // Attach event handlers
        this.attachEventHandlers();

        console.log('[ModelImportDialog] Dialog created');
    }

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    /**
     * Attach event handlers to dialog elements
     */
    private attachEventHandlers(): void {
        if (!this.container) return;

        // File drop zone handlers
        this.attachFileDropHandlers();

        // Category card handlers (FIXED - now using proper handler function)
        this.attachCategoryCardHandlers();

        // Scale mode radio button handlers
        this.attachScaleModeHandlers();

        // Scale input handlers
        this.attachScaleInputHandlers();

        // Form input handlers
        this.attachFormInputHandlers();

        // Button handlers
        this.attachButtonHandlers();
    }

    /**
     * Attach file drop zone event handlers
     */
    private attachFileDropHandlers(): void {
        if (!this.container) return;

        const dropZone = this.container.querySelector('#dropZone') as HTMLElement;
        const fileInput = this.container.querySelector('#fileInput') as HTMLInputElement;

        dropZone?.addEventListener('click', () => fileInput?.click());

        dropZone?.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '#4CAF50';
            dropZone.style.background = '#f0fff0';
        });

        dropZone?.addEventListener('dragleave', () => {
            dropZone.style.borderColor = '#ccc';
            dropZone.style.background = '#f9f9f9';
        });

        dropZone?.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '#ccc';
            dropZone.style.background = '#f9f9f9';
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                this.handleFileSelect(files[0]);
            }
        });

        fileInput?.addEventListener('change', () => {
            if (fileInput.files && fileInput.files.length > 0) {
                this.handleFileSelect(fileInput.files[0]);
            }
        });
    }

    /**
     * Attach category card click handlers
     * FIXED: Now properly attaches click handlers to category cards
     */
    private attachCategoryCardHandlers(): void {
        if (!this.container) return;

        // Use the template's handler attachment function
        attachCategoryHandlers(
            this.container,
            // Category change callback
            (category: ModelCategory) => {
                this.formState.category = category;
                this.updateRollingStockWarning();
                this.calculateScale();
                console.log(`[ModelImportDialog] Category changed to: ${category}`);
            },
            // Rolling stock type change callback
            (type: RollingStockSubcategory | null) => {
                this.formState.rollingStockSubcategory = type;
                this.calculateScale();
                if (type) {
                    console.log(`[ModelImportDialog] Rolling stock type: ${type}`);
                }
            }
        );

        console.log('[ModelImportDialog] Category card handlers attached');
    }

    /**
     * Attach scale mode radio button handlers
     */
    private attachScaleModeHandlers(): void {
        if (!this.container) return;

        const scaleModeRadios = this.container.querySelectorAll('input[name="scaleMode"]');
        scaleModeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                this.formState.scaleMode = target.value as ScaleMode;
                this.updateScaleModeUI();
                this.calculateScale();
            });
        });
    }

    /**
     * Attach scale input handlers
     */
    private attachScaleInputHandlers(): void {
        if (!this.container) return;

        const realWorldValue = this.container.querySelector('#realWorldValue') as HTMLInputElement;
        const realWorldAxis = this.container.querySelector('#realWorldAxis') as HTMLSelectElement;
        const referenceKey = this.container.querySelector('#referenceKey') as HTMLSelectElement;
        const directScale = this.container.querySelector('#directScale') as HTMLInputElement;

        realWorldValue?.addEventListener('input', () => {
            this.formState.realWorldValue = parseFloat(realWorldValue.value) || 1;
            this.calculateScale();
        });

        realWorldAxis?.addEventListener('change', () => {
            this.formState.realWorldAxis = realWorldAxis.value as 'height' | 'width' | 'depth';
            this.calculateScale();
        });

        referenceKey?.addEventListener('change', () => {
            this.formState.referenceKey = referenceKey.value;
            this.calculateScale();
        });

        directScale?.addEventListener('input', () => {
            this.formState.directScale = parseFloat(directScale.value) || 1;
            this.calculateScale();
        });
    }

    /**
     * Attach form input handlers
     */
    private attachFormInputHandlers(): void {
        if (!this.container) return;

        const nameInput = this.container.querySelector('#modelName') as HTMLInputElement;
        const tagsInput = this.container.querySelector('#modelTags') as HTMLInputElement;

        nameInput?.addEventListener('input', () => {
            this.formState.name = nameInput.value;
            this.updateImportButton();
        });

        tagsInput?.addEventListener('input', () => {
            this.formState.tags = tagsInput.value
                .split(',')
                .map(t => t.trim())
                .filter(t => t.length > 0);
        });
    }

    /**
     * Attach button handlers
     */
    private attachButtonHandlers(): void {
        if (!this.container) return;

        const cancelBtn = this.container.querySelector('#cancelBtn') as HTMLButtonElement;
        const importBtn = this.container.querySelector('#importBtn') as HTMLButtonElement;

        cancelBtn?.addEventListener('click', () => this.close());
        importBtn?.addEventListener('click', () => this.handleImport());
    }

    // ========================================================================
    // FILE HANDLING
    // ========================================================================

    /**
     * Handle file selection
     * @param file - Selected file
     */
    private async handleFileSelect(file: File): Promise<void> {
        // Validate file type
        const validExtensions = ['.glb', '.gltf'];
        const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

        if (!validExtensions.includes(ext)) {
            alert('Please select a .glb or .gltf file');
            return;
        }

        // Read file as data URL
        const reader = new FileReader();

        reader.onload = async (e) => {
            const dataUrl = e.target?.result as string;

            this.loadedFileData = {
                dataUrl,
                fileName: file.name,
                fileSize: file.size
            };

            // Update file info display
            this.updateFileInfo();

            // Load the model to get dimensions
            await this.loadModelForPreview();
        };

        reader.onerror = () => {
            alert('Error reading file');
        };

        reader.readAsDataURL(file);
    }

    /**
     * Load model to extract dimensions
     */
    private async loadModelForPreview(): Promise<void> {
        if (!this.loadedFileData) return;

        // Show loading state
        const fileInfo = this.container?.querySelector('#fileInfo') as HTMLElement;
        if (fileInfo) {
            fileInfo.innerHTML += '<p style="margin: 8px 0 0 0; color: #666;">Loading model...</p>';
        }

        try {
            // Load the model (method is loadModelFromFile, not loadModel)
            const result = await this.modelSystem.loadModelFromFile(
                this.loadedFileData.dataUrl,
                this.loadedFileData.fileName
            );

            this.loadedFileData.loadResult = result;

            if (result.success && result.dimensions) {
                // Update file info with dimensions
                if (fileInfo) {
                    const dims = result.dimensions;
                    fileInfo.innerHTML = `
                        <div style="display: flex; align-items: flex-start; gap: 10px;">
                            <span style="font-size: 24px;">✅</span>
                            <div>
                                <strong>${this.loadedFileData.fileName}</strong><br>
                                <span style="font-size: 12px; color: #666;">
                                    ${(this.loadedFileData.fileSize / 1024).toFixed(1)} KB
                                </span>
                                <div style="margin-top: 6px; font-size: 12px; color: #333;">
                                    <strong>Original size:</strong> 
                                    ${dims.width.toFixed(3)} × ${dims.height.toFixed(3)} × ${dims.depth.toFixed(3)} units
                                </div>
                            </div>
                        </div>
                    `;
                }

                // Auto-fill name from filename
                const nameInput = this.container?.querySelector('#modelName') as HTMLInputElement;
                if (nameInput && !nameInput.value) {
                    const baseName = this.loadedFileData.fileName.replace(/\.(glb|gltf)$/i, '');
                    nameInput.value = baseName;
                    this.formState.name = baseName;
                }

                // Auto-detect category from filename
                this.autoDetectCategory(this.loadedFileData.fileName);

                // Calculate initial scale
                this.calculateScale();

                // Update import button
                this.updateImportButton();

            } else {
                // Show error
                if (fileInfo) {
                    fileInfo.innerHTML += `
                        <p style="margin: 8px 0 0 0; color: #d32f2f;">
                            ❌ Error loading model: ${result.error || 'Unknown error'}
                        </p>
                    `;
                }
            }
        } catch (error) {
            console.error('[ModelImportDialog] Error loading model:', error);
            if (fileInfo) {
                fileInfo.innerHTML += `
                    <p style="margin: 8px 0 0 0; color: #d32f2f;">
                        ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}
                    </p>
                `;
            }
        }
    }

    // ========================================================================
    // UI UPDATES
    // ========================================================================

    /**
     * Update file info display
     */
    private updateFileInfo(): void {
        if (!this.loadedFileData || !this.container) return;

        const fileInfo = this.container.querySelector('#fileInfo') as HTMLElement;

        if (fileInfo) {
            const sizeKB = (this.loadedFileData.fileSize / 1024).toFixed(1);
            fileInfo.style.display = 'block';
            fileInfo.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 24px;">📄</span>
                    <div>
                        <strong>${this.loadedFileData.fileName}</strong><br>
                        <span style="font-size: 12px; color: #666;">${sizeKB} KB - Loading...</span>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Update rolling stock warning visibility
     */
    private updateRollingStockWarning(): void {
        const warning = this.container?.querySelector('#rollingStockWarning') as HTMLElement;
        const scaleModeSection = this.container?.querySelector('#scaleModeSection') as HTMLElement;

        if (!warning) return;

        if (this.formState.category === 'rolling_stock') {
            warning.style.display = 'block';
            // Hide scale mode options for rolling stock (uses automatic scaling)
            if (scaleModeSection) {
                scaleModeSection.style.opacity = '0.5';
                scaleModeSection.style.pointerEvents = 'none';
            }
        } else {
            warning.style.display = 'none';
            if (scaleModeSection) {
                scaleModeSection.style.opacity = '1';
                scaleModeSection.style.pointerEvents = 'auto';
            }
        }
    }

    /**
     * Auto-detect category from filename and select appropriate card
     * @param fileName - The filename to analyze
     */
    private autoDetectCategory(fileName: string): void {
        if (!this.container) return;

        // Check for rolling stock
        if (detectRollingStock(fileName)) {
            const type = detectRollingStockType(fileName);

            // Map type to subcategory
            let subcategory: RollingStockSubcategory = 'locomotive';
            if (type === 'coach') subcategory = 'coach';
            else if (type === 'wagon' || type === 'container') subcategory = 'wagon';

            // Find and click the appropriate card
            const card = this.container.querySelector(`[data-rolling-stock-type="${subcategory}"]`) as HTMLElement;
            if (card) {
                card.click();
                console.log(`[ModelImportDialog] Auto-detected rolling stock: ${subcategory}`);
            }
        }
    }

    /**
     * Update scale mode UI visibility
     */
    private updateScaleModeUI(): void {
        if (!this.container) return;

        const realWorldOptions = this.container.querySelector('#realWorldOptions') as HTMLElement;
        const referenceOptions = this.container.querySelector('#referenceOptions') as HTMLElement;
        const directOptions = this.container.querySelector('#directOptions') as HTMLElement;
        const asIsOptions = this.container.querySelector('#asIsOptions') as HTMLElement;

        // Hide all
        if (realWorldOptions) realWorldOptions.style.display = 'none';
        if (referenceOptions) referenceOptions.style.display = 'none';
        if (directOptions) directOptions.style.display = 'none';
        if (asIsOptions) asIsOptions.style.display = 'none';

        // Show selected
        switch (this.formState.scaleMode) {
            case 'realWorld':
                if (realWorldOptions) realWorldOptions.style.display = 'grid';
                break;
            case 'reference':
                if (referenceOptions) referenceOptions.style.display = 'block';
                break;
            case 'direct':
                if (directOptions) directOptions.style.display = 'block';
                break;
            case 'asIs':
                if (asIsOptions) asIsOptions.style.display = 'block';
                break;
        }

        // Update radio button styling
        const labels = this.container.querySelectorAll('label:has(input[name="scaleMode"])');
        labels.forEach(label => {
            const input = label.querySelector('input') as HTMLInputElement;
            const labelEl = label as HTMLElement;
            if (input?.checked) {
                labelEl.style.borderColor = '#4CAF50';
                labelEl.style.background = '#f0fff0';
            } else {
                labelEl.style.borderColor = '#ddd';
                labelEl.style.background = 'white';
            }
        });
    }

    // ========================================================================
    // SCALE CALCULATION
    // ========================================================================

    /**
     * Calculate scale based on current settings
     */
    private calculateScale(): void {
        if (!this.loadedFileData?.loadResult?.dimensions) return;

        const dimensions = this.loadedFileData.loadResult.dimensions;

        // ====================================================================
        // ROLLING STOCK SPECIAL HANDLING
        // For rolling stock, always use the specialized rolling stock calculator
        // ====================================================================
        if (this.formState.category === 'rolling_stock') {
            const type = detectRollingStockType(this.loadedFileData.fileName);

            console.log(`[ModelImportDialog] Using rolling stock scale for type: ${type}`);
            this.currentScaleResult = ModelScaleHelper.calculateRollingStockScale(dimensions, type);
            this.updateScalePreview();
            return;
        }

        // ====================================================================
        // STANDARD SCALE MODES (for non-rolling stock)
        // ====================================================================
        switch (this.formState.scaleMode) {
            case 'realWorld':
                switch (this.formState.realWorldAxis) {
                    case 'height':
                        this.currentScaleResult = ModelScaleHelper.calculateScaleFromRealHeight(
                            dimensions, this.formState.realWorldValue
                        );
                        break;
                    case 'width':
                        this.currentScaleResult = ModelScaleHelper.calculateScaleFromRealWidth(
                            dimensions, this.formState.realWorldValue
                        );
                        break;
                    case 'depth':
                        this.currentScaleResult = ModelScaleHelper.calculateScaleFromRealDepth(
                            dimensions, this.formState.realWorldValue
                        );
                        break;
                }
                break;

            case 'reference':
                this.currentScaleResult = ModelScaleHelper.calculateFromReference(
                    dimensions, this.formState.referenceKey, 'height'
                );
                break;

            case 'direct':
                this.currentScaleResult = ModelScaleHelper.calculateDirectScale(
                    dimensions, this.formState.directScale
                );
                break;

            case 'asIs':
                this.currentScaleResult = ModelScaleHelper.calculateDirectScale(dimensions, 1);
                break;
        }

        this.updateScalePreview();
    }

    /**
     * Update scale preview display
     */
    private updateScalePreview(): void {
        const el = this.container?.querySelector('#scalePreview') as HTMLElement;
        if (!el || !this.currentScaleResult) return;

        const result = this.currentScaleResult;

        el.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px; color: #2E7D32;">
                📐 Scale Preview
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
                <div>
                    <strong>Scale Factor:</strong><br>
                    <span style="font-family: monospace; font-size: 14px;">
                        ${result.scaleFactor.toFixed(6)}
                    </span>
                </div>
                <div>
                    <strong>OO Scale Size:</strong><br>
                    <span style="font-family: monospace;">
                        ${(result.resultDimensions.widthM * 1000).toFixed(1)}mm × 
                        ${(result.resultDimensions.heightM * 1000).toFixed(1)}mm × 
                        ${(result.resultDimensions.depthM * 1000).toFixed(1)}mm
                    </span>
                </div>
            </div>
            <div style="margin-top: 8px; font-size: 12px; color: #666;">
                <strong>Real-world equivalent:</strong>
                ${result.realWorldDimensions.widthM.toFixed(2)}m × 
                ${result.realWorldDimensions.heightM.toFixed(2)}m × 
                ${result.realWorldDimensions.depthM.toFixed(2)}m
            </div>
        `;
    }

    /**
     * Update import button state
     */
    private updateImportButton(): void {
        const btn = this.container?.querySelector('#importBtn') as HTMLButtonElement;
        if (!btn) return;

        const canImport = this.loadedFileData?.loadResult?.success &&
            this.formState.name.trim().length > 0;

        btn.disabled = !canImport;
        btn.style.opacity = canImport ? '1' : '0.5';
    }

    // ========================================================================
    // IMPORT HANDLING
    // ========================================================================

    /**
     * Handle import button click
     */
    private async handleImport(): Promise<void> {
        if (!this.loadedFileData?.loadResult?.success || !this.currentScaleResult) {
            return;
        }

        try {
            // Create library entry
            const entry = this.library.addModel({
                name: this.formState.name.trim(),
                description: this.formState.description.trim(),
                category: this.formState.category,
                tags: this.formState.tags,
                filePath: this.loadedFileData.dataUrl,
                originalDimensions: {
                    width: this.loadedFileData.loadResult.dimensions!.width,
                    height: this.loadedFileData.loadResult.dimensions!.height,
                    depth: this.loadedFileData.loadResult.dimensions!.depth,
                    unit: 'unknown'
                },
                scalePresets: [{
                    name: 'Default',
                    scaleFactor: this.currentScaleResult.scaleFactor,
                    realWorldHeightM: this.currentScaleResult.realWorldDimensions.heightM,
                    realWorldWidthM: this.currentScaleResult.realWorldDimensions.widthM,
                    realWorldDepthM: this.currentScaleResult.realWorldDimensions.depthM,
                    isDefault: true
                }],
                activePresetName: 'Default',
                importMetadata: {
                    originalFilename: this.loadedFileData.fileName,
                    fileSizeBytes: this.loadedFileData.fileSize,
                    importedAt: new Date().toISOString(),
                    format: this.loadedFileData.fileName.toLowerCase().endsWith('.gltf') ? 'gltf' : 'glb'
                }
            });

            console.log('[ModelImportDialog] Model imported:', entry.name);
            console.log('[ModelImportDialog]   Category:', this.formState.category);
            console.log('[ModelImportDialog]   Scale:', this.currentScaleResult.scaleFactor);

            // Close with result
            this.close(entry);

        } catch (error) {
            console.error('[ModelImportDialog] Import error:', error);
            alert('Error importing model: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    }
}