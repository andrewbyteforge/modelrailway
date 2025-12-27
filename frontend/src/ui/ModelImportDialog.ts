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
 * @module ModelImportDialog
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Scene } from '@babylonjs/core/scene';
import { ModelLibrary, type ModelCategory, type ModelLibraryEntry, type ModelScalePreset } from '../systems/models/ModelLibrary';
import { ModelScaleHelper, REFERENCE_DIMENSIONS, OO_GAUGE, type ModelDimensions, type ScaleResult } from '../systems/models/ModelScaleHelper';
import { ModelSystem, type ModelLoadResult } from '../systems/models/ModelSystem';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Dialog z-index */
const DIALOG_Z_INDEX = 2000;

/** Category options */
const CATEGORIES: { value: ModelCategory; label: string }[] = [
    { value: 'buildings', label: '🏠 Buildings' },
    { value: 'rolling_stock', label: '🚃 Rolling Stock' },
    { value: 'scenery', label: '🌳 Scenery' },
    { value: 'infrastructure', label: '🌉 Infrastructure' },
    { value: 'vehicles', label: '🚗 Vehicles' },
    { value: 'figures', label: '👤 Figures' },
    { value: 'accessories', label: '🪑 Accessories' },
    { value: 'custom', label: '📦 Custom' }
];

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Scaling mode for import
 */
type ScaleMode = 'realWorld' | 'reference' | 'direct' | 'asIs';

/**
 * Import result callback
 */
export type ImportCallback = (entry: ModelLibraryEntry | null) => void;

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

    // Form state
    private formState = {
        name: '',
        description: '',
        category: 'custom' as ModelCategory,
        tags: [] as string[],
        scaleMode: 'realWorld' as ScaleMode,
        realWorldValue: 10,
        realWorldAxis: 'height' as 'height' | 'width' | 'depth',
        referenceKey: 'figure',
        directScale: 1
    };

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
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: ${DIALOG_Z_INDEX - 1};
        `;
        this.overlay.addEventListener('click', () => this.close());
        document.body.appendChild(this.overlay);

        // Create dialog container
        this.container = document.createElement('div');
        this.container.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 600px;
            max-width: 90vw;
            max-height: 90vh;
            overflow-y: auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            z-index: ${DIALOG_Z_INDEX};
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;
        this.container.addEventListener('click', e => e.stopPropagation());

        // Build dialog content
        this.container.innerHTML = this.buildDialogHTML();

        // Add to DOM
        document.body.appendChild(this.container);

        // Attach event handlers
        this.attachEventHandlers();
    }

    /**
     * Build the dialog HTML content
     */
    private buildDialogHTML(): string {
        return `
            <!-- Header -->
            <div style="
                padding: 20px;
                background: linear-gradient(135deg, #2c3e50, #3498db);
                border-radius: 12px 12px 0 0;
                color: white;
            ">
                <h2 style="margin: 0; font-size: 20px; display: flex; align-items: center; gap: 10px;">
                    📦 Import 3D Model
                </h2>
                <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 13px;">
                    Import GLB/GLTF models and configure them for OO gauge scale (1:76.2)
                </p>
            </div>
            
            <!-- Content -->
            <div style="padding: 20px;">
                
                <!-- File Selection -->
                <div class="section" style="margin-bottom: 20px;">
                    <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #333;">
                        1. Select Model File
                    </h3>
                    <div style="
                        border: 2px dashed #ccc;
                        border-radius: 8px;
                        padding: 30px;
                        text-align: center;
                        background: #f9f9f9;
                        cursor: pointer;
                        transition: all 0.2s;
                    " id="dropZone">
                        <input type="file" 
                               id="fileInput" 
                               accept=".glb,.gltf" 
                               style="display: none;">
                        <div id="dropZoneContent">
                            <div style="font-size: 40px; margin-bottom: 10px;">📁</div>
                            <p style="margin: 0; color: #666;">
                                <strong>Click to browse</strong> or drag & drop<br>
                                <span style="font-size: 12px; color: #999;">
                                    Supports .glb and .gltf files
                                </span>
                            </p>
                        </div>
                    </div>
                    <div id="fileInfo" style="display: none; margin-top: 10px; padding: 12px; background: #e8f5e9; border-radius: 6px;">
                        <!-- File info will be inserted here -->
                    </div>
                </div>
                
                <!-- Model Details (shown after file selected) -->
                <div id="modelDetailsSection" style="display: none;">
                    
                    <!-- Basic Info -->
                    <div class="section" style="margin-bottom: 20px;">
                        <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #333;">
                            2. Model Details
                        </h3>
                        <div style="display: grid; gap: 12px;">
                            <div>
                                <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">
                                    Name *
                                </label>
                                <input type="text" 
                                       id="modelName" 
                                       placeholder="e.g., Victorian Station Building"
                                       style="
                                           width: 100%;
                                           padding: 10px;
                                           border: 1px solid #ddd;
                                           border-radius: 6px;
                                           font-size: 14px;
                                           box-sizing: border-box;
                                       ">
                            </div>
                            <div>
                                <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">
                                    Description
                                </label>
                                <textarea id="modelDescription" 
                                          rows="2"
                                          placeholder="Optional description..."
                                          style="
                                              width: 100%;
                                              padding: 10px;
                                              border: 1px solid #ddd;
                                              border-radius: 6px;
                                              font-size: 14px;
                                              resize: vertical;
                                              box-sizing: border-box;
                                          "></textarea>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                <div>
                                    <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">
                                        Category *
                                    </label>
                                    <select id="modelCategory" style="
                                        width: 100%;
                                        padding: 10px;
                                        border: 1px solid #ddd;
                                        border-radius: 6px;
                                        font-size: 14px;
                                        background: white;
                                    ">
                                        ${CATEGORIES.map(c =>
            `<option value="${c.value}">${c.label}</option>`
        ).join('')}
                                    </select>
                                </div>
                                <div>
                                    <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">
                                        Tags (comma separated)
                                    </label>
                                    <input type="text" 
                                           id="modelTags" 
                                           placeholder="e.g., station, brick, victorian"
                                           style="
                                               width: 100%;
                                               padding: 10px;
                                               border: 1px solid #ddd;
                                               border-radius: 6px;
                                               font-size: 14px;
                                               box-sizing: border-box;
                                           ">
                                </div>
                            </div>
                            
                            <!-- Rolling Stock Warning -->
                            <div id="rollingStockWarning" style="
                                display: none;
                                margin-top: 12px;
                                padding: 12px 16px;
                                background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
                                border: 1px solid #ffb74d;
                                border-radius: 8px;
                                border-left: 4px solid #ff9800;
                            ">
                                <div style="display: flex; align-items: flex-start; gap: 12px;">
                                    <span style="font-size: 24px;">🚂</span>
                                    <div>
                                        <strong style="display: block; color: #e65100; margin-bottom: 4px;">
                                            Rolling Stock - Track Placement Required
                                        </strong>
                                        <p style="margin: 0; font-size: 13px; color: #5d4037; line-height: 1.4;">
                                            After import, you will need to click on a track piece to place this model.
                                            Rolling stock must be placed on track.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Scale Configuration -->
                    <div class="section" style="margin-bottom: 20px;">
                        <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #333;">
                            3. Scale Configuration
                            <span style="font-weight: normal; color: #888; font-size: 12px;">
                                (OO Gauge: 1:${OO_GAUGE.SCALE_RATIO})
                            </span>
                        </h3>
                        
                        <!-- Original Dimensions Display -->
                        <div id="originalDimensions" style="
                            background: #f5f5f5;
                            padding: 12px;
                            border-radius: 6px;
                            margin-bottom: 12px;
                            font-size: 13px;
                        ">
                            <!-- Will be filled dynamically -->
                        </div>
                        
                        <!-- Scale Mode Selection -->
                        <div style="margin-bottom: 12px;">
                            <label style="display: block; font-size: 12px; color: #666; margin-bottom: 8px;">
                                How do you want to scale this model?
                            </label>
                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                                <label style="
                                    display: flex;
                                    align-items: center;
                                    gap: 8px;
                                    padding: 10px;
                                    border: 2px solid #ddd;
                                    border-radius: 6px;
                                    cursor: pointer;
                                    transition: all 0.2s;
                                ">
                                    <input type="radio" name="scaleMode" value="realWorld" checked>
                                    <span>
                                        <strong style="display: block; font-size: 13px;">Real-World Size</strong>
                                        <small style="color: #888;">Specify actual dimensions</small>
                                    </span>
                                </label>
                                <label style="
                                    display: flex;
                                    align-items: center;
                                    gap: 8px;
                                    padding: 10px;
                                    border: 2px solid #ddd;
                                    border-radius: 6px;
                                    cursor: pointer;
                                    transition: all 0.2s;
                                ">
                                    <input type="radio" name="scaleMode" value="reference">
                                    <span>
                                        <strong style="display: block; font-size: 13px;">Reference Size</strong>
                                        <small style="color: #888;">Use standard references</small>
                                    </span>
                                </label>
                                <label style="
                                    display: flex;
                                    align-items: center;
                                    gap: 8px;
                                    padding: 10px;
                                    border: 2px solid #ddd;
                                    border-radius: 6px;
                                    cursor: pointer;
                                    transition: all 0.2s;
                                ">
                                    <input type="radio" name="scaleMode" value="direct">
                                    <span>
                                        <strong style="display: block; font-size: 13px;">Direct Scale</strong>
                                        <small style="color: #888;">Enter scale factor</small>
                                    </span>
                                </label>
                                <label style="
                                    display: flex;
                                    align-items: center;
                                    gap: 8px;
                                    padding: 10px;
                                    border: 2px solid #ddd;
                                    border-radius: 6px;
                                    cursor: pointer;
                                    transition: all 0.2s;
                                ">
                                    <input type="radio" name="scaleMode" value="asIs">
                                    <span>
                                        <strong style="display: block; font-size: 13px;">Use As-Is</strong>
                                        <small style="color: #888;">No scaling (1:1)</small>
                                    </span>
                                </label>
                            </div>
                        </div>
                        
                        <!-- Scale Mode Options -->
                        <div id="scaleModeOptions">
                            <!-- Real-World Options -->
                            <div id="realWorldOptions" style="
                                display: grid;
                                grid-template-columns: 1fr 1fr;
                                gap: 12px;
                                padding: 12px;
                                background: #f0f7ff;
                                border-radius: 6px;
                            ">
                                <div>
                                    <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">
                                        Real-World Dimension (meters)
                                    </label>
                                    <input type="number" 
                                           id="realWorldValue" 
                                           value="10" 
                                           min="0.1" 
                                           step="0.1"
                                           style="
                                               width: 100%;
                                               padding: 10px;
                                               border: 1px solid #ddd;
                                               border-radius: 6px;
                                               font-size: 14px;
                                               box-sizing: border-box;
                                           ">
                                </div>
                                <div>
                                    <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">
                                        Apply To
                                    </label>
                                    <select id="realWorldAxis" style="
                                        width: 100%;
                                        padding: 10px;
                                        border: 1px solid #ddd;
                                        border-radius: 6px;
                                        font-size: 14px;
                                        background: white;
                                    ">
                                        <option value="height">Height (Y axis)</option>
                                        <option value="width">Width (X axis)</option>
                                        <option value="depth">Depth (Z axis)</option>
                                    </select>
                                </div>
                            </div>
                            
                            <!-- Reference Options (hidden by default) -->
                            <div id="referenceOptions" style="display: none; padding: 12px; background: #f0fff0; border-radius: 6px;">
                                <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">
                                    Reference Type
                                </label>
                                <select id="referenceKey" style="
                                    width: 100%;
                                    padding: 10px;
                                    border: 1px solid #ddd;
                                    border-radius: 6px;
                                    font-size: 14px;
                                    background: white;
                                ">
                                    ${Object.entries(REFERENCE_DIMENSIONS).map(([key, ref]) =>
            `<option value="${key}">${ref.description}</option>`
        ).join('')}
                                </select>
                                <p style="margin: 8px 0 0 0; font-size: 12px; color: #666;">
                                    The model's height will match this reference size in OO scale.
                                </p>
                            </div>
                            
                            <!-- Direct Scale Options (hidden by default) -->
                            <div id="directOptions" style="display: none; padding: 12px; background: #fff5f0; border-radius: 6px;">
                                <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">
                                    Scale Factor
                                </label>
                                <input type="number" 
                                       id="directScale" 
                                       value="1" 
                                       min="0.0001" 
                                       step="0.001"
                                       style="
                                           width: 100%;
                                           padding: 10px;
                                           border: 1px solid #ddd;
                                           border-radius: 6px;
                                           font-size: 14px;
                                           box-sizing: border-box;
                                       ">
                                <p style="margin: 8px 0 0 0; font-size: 12px; color: #666;">
                                    Multiply model dimensions by this factor. 
                                    For OO scale from real-world meters: ${(1 / OO_GAUGE.SCALE_RATIO).toFixed(6)}
                                </p>
                            </div>
                            
                            <!-- As-Is Notice (hidden by default) -->
                            <div id="asIsOptions" style="display: none; padding: 12px; background: #f5f5f5; border-radius: 6px;">
                                <p style="margin: 0; font-size: 13px; color: #666;">
                                    ⚠️ The model will be used without any scaling. 
                                    Make sure the model is already in the correct OO scale.
                                </p>
                            </div>
                        </div>
                        
                        <!-- Scale Preview -->
                        <div id="scalePreview" style="
                            margin-top: 12px;
                            padding: 12px;
                            background: #e8f5e9;
                            border-radius: 6px;
                            border-left: 4px solid #4CAF50;
                        ">
                            <!-- Scale preview will be inserted here -->
                        </div>
                    </div>
                    
                </div>
                
            </div>
            
            <!-- Footer -->
            <div style="
                padding: 16px 20px;
                background: #f5f5f5;
                border-top: 1px solid #ddd;
                border-radius: 0 0 12px 12px;
                display: flex;
                justify-content: flex-end;
                gap: 12px;
            ">
                <button id="cancelBtn" style="
                    padding: 10px 20px;
                    border: 1px solid #ccc;
                    border-radius: 6px;
                    background: white;
                    color: #666;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s;
                ">
                    Cancel
                </button>
                <button id="importBtn" style="
                    padding: 10px 24px;
                    border: none;
                    border-radius: 6px;
                    background: #4CAF50;
                    color: white;
                    font-size: 14px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.2s;
                    opacity: 0.5;
                " disabled>
                    Import Model
                </button>
            </div>
        `;
    }

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    /**
     * Attach event handlers to dialog elements
     */
    private attachEventHandlers(): void {
        if (!this.container) return;

        // File drop zone
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

        // Scale mode radio buttons
        const scaleModeRadios = this.container.querySelectorAll('input[name="scaleMode"]');
        scaleModeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                this.formState.scaleMode = target.value as ScaleMode;
                this.updateScaleModeUI();
                this.calculateScale();
            });
        });

        // Scale input handlers
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

        // Form inputs
        const nameInput = this.container.querySelector('#modelName') as HTMLInputElement;
        const descInput = this.container.querySelector('#modelDescription') as HTMLTextAreaElement;
        const categorySelect = this.container.querySelector('#modelCategory') as HTMLSelectElement;
        const tagsInput = this.container.querySelector('#modelTags') as HTMLInputElement;

        nameInput?.addEventListener('input', () => {
            this.formState.name = nameInput.value;
            this.updateImportButton();
        });

        descInput?.addEventListener('input', () => {
            this.formState.description = descInput.value;
        });

        categorySelect?.addEventListener('change', () => {
            this.formState.category = categorySelect.value as ModelCategory;
            this.updateRollingStockWarning();
            // Recalculate scale when category changes (rolling stock uses different calculation)
            this.calculateScale();
        });

        tagsInput?.addEventListener('input', () => {
            this.formState.tags = tagsInput.value
                .split(',')
                .map(t => t.trim())
                .filter(t => t.length > 0);
        });

        // Buttons
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

        // Load the model
        const result = await this.modelSystem.loadModelFromFile(
            this.loadedFileData.dataUrl,
            this.loadedFileData.fileName
        );

        this.loadedFileData.loadResult = result;

        if (result.success && result.dimensions) {
            // Show model details section
            const detailsSection = this.container?.querySelector('#modelDetailsSection') as HTMLElement;
            if (detailsSection) {
                detailsSection.style.display = 'block';
            }

            // Update original dimensions display
            this.updateOriginalDimensions(result.dimensions);

            // Set default name from filename
            const nameInput = this.container?.querySelector('#modelName') as HTMLInputElement;
            if (nameInput && !nameInput.value) {
                const baseName = this.loadedFileData.fileName.replace(/\.(glb|gltf)$/i, '');
                nameInput.value = baseName;
                this.formState.name = baseName;
            }

            // Auto-detect category from filename (especially rolling stock)
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
    }

    // ========================================================================
    // UI UPDATES
    // ========================================================================

    /**
     * Update rolling stock warning visibility
     */
    private updateRollingStockWarning(): void {
        const warning = this.container?.querySelector('#rollingStockWarning') as HTMLElement;
        if (!warning) return;

        if (this.formState.category === 'rolling_stock') {
            warning.style.display = 'block';
        } else {
            warning.style.display = 'none';
        }
    }

    /**
     * Auto-detect if model is rolling stock from filename
     * @param fileName - The file name to check
     * @returns True if likely rolling stock
     */
    private detectRollingStock(fileName: string): boolean {
        const lowerName = fileName.toLowerCase();

        // Keywords that indicate rolling stock
        const rollingStockKeywords = [
            'train', 'loco', 'locomotive', 'engine',
            'coach', 'carriage', 'passenger',
            'wagon', 'freight', 'goods', 'tanker', 'hopper',
            'caboose', 'brake', 'van',
            'tender', 'boxcar', 'flatcar', 'gondola',
            'pullman', 'sleeper', 'dining',
            'hst', 'dmu', 'emu', 'unit',
            'class_', 'br_', 'gwr_', 'lner_', 'lms_', 'sr_'
        ];

        return rollingStockKeywords.some(keyword => lowerName.includes(keyword));
    }

    /**
     * Auto-set category based on filename
     * @param fileName - The file name to analyze
     */
    private autoDetectCategory(fileName: string): void {
        const categorySelect = this.container?.querySelector('#modelCategory') as HTMLSelectElement;
        if (!categorySelect) return;

        // Check for rolling stock first (most important for track placement)
        if (this.detectRollingStock(fileName)) {
            categorySelect.value = 'rolling_stock';
            this.formState.category = 'rolling_stock';
            console.log('[ModelImportDialog] Auto-detected rolling stock from filename');
        }
        // Could add more auto-detection here for other categories

        // Update the warning display
        this.updateRollingStockWarning();
    }

    /**
     * Update file info display
     */
    private updateFileInfo(): void {
        if (!this.loadedFileData || !this.container) return;

        const fileInfo = this.container.querySelector('#fileInfo') as HTMLElement;
        const dropZoneContent = this.container.querySelector('#dropZoneContent') as HTMLElement;

        if (fileInfo) {
            const sizeKB = (this.loadedFileData.fileSize / 1024).toFixed(1);
            fileInfo.style.display = 'block';
            fileInfo.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 24px;">✅</span>
                    <div>
                        <strong>${this.loadedFileData.fileName}</strong><br>
                        <span style="font-size: 12px; color: #666;">${sizeKB} KB</span>
                    </div>
                </div>
            `;
        }

        if (dropZoneContent) {
            dropZoneContent.innerHTML = `
                <div style="font-size: 40px; margin-bottom: 10px;">📦</div>
                <p style="margin: 0; color: #4CAF50;">
                    <strong>Model loaded!</strong><br>
                    <span style="font-size: 12px; color: #888;">
                        Click to select a different file
                    </span>
                </p>
            `;
        }
    }

    /**
     * Update original dimensions display
     * @param dimensions - Model dimensions
     */
    private updateOriginalDimensions(dimensions: ModelDimensions): void {
        const el = this.container?.querySelector('#originalDimensions') as HTMLElement;
        if (!el) return;

        el.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span><strong>Original Model Dimensions:</strong></span>
                <span style="font-family: monospace;">
                    ${ModelScaleHelper.formatDimension(dimensions.width)} × 
                    ${ModelScaleHelper.formatDimension(dimensions.height)} × 
                    ${ModelScaleHelper.formatDimension(dimensions.depth)}
                </span>
            </div>
            <div style="margin-top: 6px; font-size: 12px; color: #666;">
                (Width × Height × Depth)
            </div>
        `;
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

    /**
     * Calculate scale based on current settings
     */
    private calculateScale(): void {
        if (!this.loadedFileData?.loadResult?.dimensions) return;

        const dimensions = this.loadedFileData.loadResult.dimensions;

        // ====================================================================
        // ROLLING STOCK SPECIAL HANDLING
        // For rolling stock, always use the specialized rolling stock calculator
        // which scales based on target OO gauge lengths (230mm for locomotives, etc.)
        // ====================================================================
        if (this.formState.category === 'rolling_stock') {
            // Detect rolling stock type from filename
            const fileName = this.loadedFileData?.fileName?.toLowerCase() || '';
            let rollingStockType: 'locomotive' | 'steam_locomotive' | 'coach' | 'wagon' | 'container' = 'locomotive';

            if (fileName.includes('coach') || fileName.includes('carriage') || fileName.includes('passenger')) {
                rollingStockType = 'coach';
            } else if (fileName.includes('wagon') || fileName.includes('freight') || fileName.includes('goods') ||
                fileName.includes('tanker') || fileName.includes('hopper')) {
                rollingStockType = 'wagon';
            } else if (fileName.includes('steam')) {
                rollingStockType = 'steam_locomotive';
            } else if (fileName.includes('container')) {
                rollingStockType = 'container';
            }

            console.log(`[ModelImportDialog] Using rolling stock scale for type: ${rollingStockType}`);
            this.currentScaleResult = ModelScaleHelper.calculateRollingStockScale(dimensions, rollingStockType);
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
                this.currentScaleResult = ModelScaleHelper.calculateScaleFromReference(
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
                filePath: this.loadedFileData.dataUrl, // Store data URL for now
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

            // Close with result
            this.close(entry);

        } catch (error) {
            console.error('[ModelImportDialog] Import error:', error);
            alert('Error importing model: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    }
}