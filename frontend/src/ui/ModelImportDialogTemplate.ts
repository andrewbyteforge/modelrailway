/**
 * ModelImportDialogTemplate.ts - HTML template and utilities for ModelImportDialog
 * 
 * Path: frontend/src/ui/ModelImportDialogTemplate.ts
 * 
 * Contains:
 * - HTML template generation for the import dialog
 * - Style constants
 * - Form state management
 * - Rolling stock detection utilities
 * 
 * FIXED: Category card click handlers now work properly
 * 
 * @module ModelImportDialogTemplate
 * @author Model Railway Workbench
 * @version 1.1.0 - Fixed category selection
 */

import type { ModelCategory } from '../systems/models/ModelLibrary';
import { REFERENCE_DIMENSIONS } from '../systems/models/ModelScaleHelper';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Dialog z-index to ensure it appears above other UI elements */
export const DIALOG_Z_INDEX = 2000;

/** 
 * Rolling stock subcategories for more precise scaling 
 */
export type RollingStockSubcategory = 'locomotive' | 'coach' | 'wagon' | 'multiple_unit';

/**
 * Category card definitions for Rolling Stock
 */
const ROLLING_STOCK_CARDS: { value: RollingStockSubcategory; label: string; icon: string }[] = [
    { value: 'locomotive', label: 'Locomotive', icon: '🚂' },
    { value: 'coach', label: 'Coach / Carriage', icon: '🚃' },
    { value: 'wagon', label: 'Wagon / Freight', icon: '📦' },
    { value: 'multiple_unit', label: 'Multiple Unit', icon: '🚈' }
];

/**
 * Category card definitions for General models
 */
const GENERAL_CARDS: { value: ModelCategory; label: string; icon: string }[] = [
    { value: 'buildings', label: 'Buildings', icon: '🏠' },
    { value: 'scenery', label: 'Scenery', icon: '🌳' },
    { value: 'infrastructure', label: 'Infrastructure', icon: '🌉' },
    { value: 'vehicles', label: 'Road Vehicles', icon: '🚗' },
    { value: 'figures', label: 'Figures', icon: '👤' },
    { value: 'accessories', label: 'Accessories', icon: '🪑' },
    { value: 'custom', label: 'Custom', icon: '📦' }
];

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Scaling mode for import
 */
export type ScaleMode = 'realWorld' | 'reference' | 'direct' | 'asIs';

/**
 * Import result callback
 */
export type ImportCallback = (entry: any | null) => void;

/**
 * Form state for the import dialog
 */
export interface ImportFormState {
    name: string;
    description: string;
    category: ModelCategory;
    rollingStockSubcategory: RollingStockSubcategory | null;
    tags: string[];
    scaleMode: ScaleMode;
    realWorldValue: number;
    realWorldAxis: 'height' | 'width' | 'depth';
    referenceKey: string;
    directScale: number;
}

// ============================================================================
// STYLE FUNCTIONS
// ============================================================================

/**
 * Get overlay styles for the modal backdrop
 * @returns CSS string for overlay
 */
export function getOverlayStyles(): string {
    return `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: ${DIALOG_Z_INDEX - 1};
    `;
}

/**
 * Get container styles for the dialog
 * @returns CSS string for container
 */
export function getContainerStyles(): string {
    return `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 580px;
        max-width: 90vw;
        max-height: 90vh;
        overflow-y: auto;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        z-index: ${DIALOG_Z_INDEX};
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;
}

// ============================================================================
// FORM STATE FACTORY
// ============================================================================

/**
 * Create default form state
 * @returns Default ImportFormState
 */
export function createDefaultFormState(): ImportFormState {
    return {
        name: '',
        description: '',
        category: 'custom',
        rollingStockSubcategory: null,
        tags: [],
        scaleMode: 'realWorld',
        realWorldValue: 10,
        realWorldAxis: 'height',
        referenceKey: 'figure',
        directScale: 1
    };
}

// ============================================================================
// ROLLING STOCK DETECTION
// ============================================================================

/**
 * Detect if a filename indicates rolling stock
 * @param fileName - The filename to check
 * @returns True if likely rolling stock
 */
export function detectRollingStock(fileName: string): boolean {
    const lowerName = fileName.toLowerCase();

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
 * Detect the type of rolling stock from filename
 * @param fileName - The filename to analyze
 * @returns Rolling stock type for scaling
 */
export function detectRollingStockType(fileName: string): 'locomotive' | 'steam_locomotive' | 'coach' | 'wagon' | 'container' {
    const lowerName = fileName.toLowerCase();

    if (lowerName.includes('coach') || lowerName.includes('carriage') || lowerName.includes('passenger')) {
        return 'coach';
    } else if (lowerName.includes('wagon') || lowerName.includes('freight') || lowerName.includes('goods') ||
        lowerName.includes('tanker') || lowerName.includes('hopper')) {
        return 'wagon';
    } else if (lowerName.includes('steam')) {
        return 'steam_locomotive';
    } else if (lowerName.includes('container')) {
        return 'container';
    }

    return 'locomotive';
}

// ============================================================================
// HTML TEMPLATE BUILDER
// ============================================================================

/**
 * Build category card HTML
 * @param value - Category value
 * @param label - Display label
 * @param icon - Emoji icon
 * @param isRollingStock - Whether this is a rolling stock subcategory
 * @returns HTML string for category card
 */
function buildCategoryCard(value: string, label: string, icon: string, isRollingStock: boolean): string {
    const dataAttr = isRollingStock ? 'data-rolling-stock-type' : 'data-category';
    return `
        <div class="category-card" ${dataAttr}="${value}" style="
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 12px 8px;
            border: 2px solid #ddd;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            background: white;
            min-width: 80px;
        ">
            <span style="font-size: 24px; margin-bottom: 4px;">${icon}</span>
            <span style="font-size: 11px; text-align: center; color: #333;">${label}</span>
        </div>
    `;
}

/**
 * Build reference options HTML
 * @returns HTML string for reference dropdown options
 */
function buildReferenceOptions(): string {
    const refs = REFERENCE_DIMENSIONS;
    let options = '';

    // Check if refs exists and has entries
    if (refs && typeof refs === 'object') {
        for (const [key, ref] of Object.entries(refs)) {
            if (ref && typeof ref === 'object' && 'name' in ref && 'realHeight' in ref && 'ooHeight' in ref) {
                const realHeight = typeof ref.realHeight === 'number' ? ref.realHeight.toFixed(1) : '?';
                const ooHeight = typeof ref.ooHeight === 'number' ? (ref.ooHeight * 1000).toFixed(0) : '?';
                options += `<option value="${key}">${ref.name} (${realHeight}m real → ${ooHeight}mm OO)</option>`;
            }
        }
    }

    // Fallback if no valid references found
    if (!options) {
        options = `
            <option value="figure">Standing Figure (1.75m real → 23mm OO)</option>
            <option value="door">Standard Door (2.1m real → 28mm OO)</option>
            <option value="car">Family Car (1.5m real → 20mm OO)</option>
            <option value="lorry">Lorry/Truck (3.5m real → 46mm OO)</option>
            <option value="house">Two-Storey House (8m real → 105mm OO)</option>
        `;
    }

    return options;
}

/**
 * Build the complete dialog HTML
 * @returns Complete HTML string for the dialog
 */
export function buildDialogHTML(): string {
    // Build rolling stock cards
    const rollingStockCards = ROLLING_STOCK_CARDS
        .map(c => buildCategoryCard(c.value, c.label, c.icon, true))
        .join('');

    // Build general cards
    const generalCards = GENERAL_CARDS
        .map(c => buildCategoryCard(c.value, c.label, c.icon, false))
        .join('');

    // Build reference options
    const referenceOptions = buildReferenceOptions();

    return `
        <!-- ================================================================ -->
        <!-- HEADER -->
        <!-- ================================================================ -->
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
        
        <!-- ================================================================ -->
        <!-- CONTENT -->
        <!-- ================================================================ -->
        <div style="padding: 20px;">
            
            <!-- ============================================================ -->
            <!-- SECTION 1: FILE SELECTION -->
            <!-- ============================================================ -->
            <div class="section" style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #333;">
                    1. Select Model File
                </h3>
                <div id="dropZone" style="
                    border: 2px dashed #ccc;
                    border-radius: 8px;
                    padding: 30px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: #f9f9f9;
                ">
                    <div id="dropZoneContent">
                        <span style="font-size: 40px; display: block; margin-bottom: 10px;">📁</span>
                        <p style="margin: 0; color: #666;">
                            <strong>Drop GLB/GLTF file here</strong><br>
                            <small>or click to browse</small>
                        </p>
                    </div>
                </div>
                <input type="file" id="fileInput" accept=".glb,.gltf" style="display: none;">
                <div id="fileInfo" style="display: none; margin-top: 12px; padding: 12px; background: #e8f5e9; border-radius: 6px;"></div>
            </div>
            
            <!-- ============================================================ -->
            <!-- SECTION 2: MODEL DETAILS -->
            <!-- ============================================================ -->
            <div class="section" style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #333;">
                    2. Model Details
                </h3>
                
                <!-- Model Name -->
                <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">
                        Model Name *
                    </label>
                    <input type="text" 
                           id="modelName" 
                           placeholder="Enter a name for this model"
                           style="
                               width: 100%;
                               padding: 10px;
                               border: 1px solid #ddd;
                               border-radius: 6px;
                               font-size: 14px;
                               box-sizing: border-box;
                           ">
                </div>
                
                <!-- Category Selection -->
                <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 12px; color: #666; margin-bottom: 8px;">
                        Category *
                    </label>
                    
                    <!-- Rolling Stock Section -->
                    <div style="margin-bottom: 12px;">
                        <div style="font-size: 11px; color: #2E7D32; font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
                            🚂 ROLLING STOCK <span style="font-weight: normal; color: #666;">(placed on track)</span>
                        </div>
                        <div id="rollingStockCards" style="
                            display: flex;
                            gap: 8px;
                            flex-wrap: wrap;
                        ">
                            ${rollingStockCards}
                        </div>
                    </div>
                    
                    <!-- General Section -->
                    <div>
                        <div style="font-size: 11px; color: #1565C0; font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
                            🏠 GENERAL <span style="font-weight: normal; color: #666;">(placed on baseboard)</span>
                        </div>
                        <div id="generalCards" style="
                            display: flex;
                            gap: 8px;
                            flex-wrap: wrap;
                        ">
                            ${generalCards}
                        </div>
                    </div>
                    
                    <!-- Hidden input to store selected category -->
                    <input type="hidden" id="selectedCategory" value="custom">
                    <input type="hidden" id="selectedRollingStockType" value="">
                </div>
                
                <!-- Tags -->
                <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">
                        Tags (comma-separated)
                    </label>
                    <input type="text" 
                           id="modelTags" 
                           placeholder="e.g., BR, Class 66, diesel, freight"
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
            
            <!-- ============================================================ -->
            <!-- SECTION 3: SCALE CONFIGURATION -->
            <!-- ============================================================ -->
            <div class="section" style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #333;">
                    3. Scale Configuration
                </h3>
                
                <!-- Rolling Stock Warning -->
                <div id="rollingStockWarning" style="
                    display: none;
                    padding: 10px;
                    background: #e3f2fd;
                    border: 1px solid #1976D2;
                    border-radius: 6px;
                    margin-bottom: 12px;
                    font-size: 12px;
                    color: #1565C0;
                ">
                    🚂 <strong>Rolling Stock Mode:</strong> Scale will be automatically calculated 
                    based on typical OO gauge dimensions for the selected type.
                </div>
                
                <!-- Scale Mode Selector (hidden for rolling stock) -->
                <div id="scaleModeSection">
                    <label style="display: block; font-size: 12px; color: #666; margin-bottom: 8px;">
                        How do you want to scale this model?
                    </label>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 12px;">
                        <!-- Real-World Size -->
                        <label style="
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            padding: 10px;
                            border: 2px solid #4CAF50;
                            border-radius: 6px;
                            cursor: pointer;
                            background: #f0fff0;
                        ">
                            <input type="radio" name="scaleMode" value="realWorld" checked>
                            <span>
                                <strong style="display: block; font-size: 13px;">Real-World Size</strong>
                                <small style="color: #888;">Enter actual dimensions</small>
                            </span>
                        </label>
                        
                        <!-- Reference Object -->
                        <label style="
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            padding: 10px;
                            border: 2px solid #ddd;
                            border-radius: 6px;
                            cursor: pointer;
                            background: white;
                        ">
                            <input type="radio" name="scaleMode" value="reference">
                            <span>
                                <strong style="display: block; font-size: 13px;">Reference Object</strong>
                                <small style="color: #888;">Match to known size</small>
                            </span>
                        </label>
                        
                        <!-- Direct Scale -->
                        <label style="
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            padding: 10px;
                            border: 2px solid #ddd;
                            border-radius: 6px;
                            cursor: pointer;
                            background: white;
                        ">
                            <input type="radio" name="scaleMode" value="direct">
                            <span>
                                <strong style="display: block; font-size: 13px;">Direct Scale</strong>
                                <small style="color: #888;">Apply scale factor</small>
                            </span>
                        </label>
                        
                        <!-- Use As-Is -->
                        <label style="
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            padding: 10px;
                            border: 2px solid #ddd;
                            border-radius: 6px;
                            cursor: pointer;
                            background: white;
                        ">
                            <input type="radio" name="scaleMode" value="asIs">
                            <span>
                                <strong style="display: block; font-size: 13px;">Use As-Is</strong>
                                <small style="color: #888;">Already OO scale</small>
                            </span>
                        </label>
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
                                    <option value="height" selected>Height (Y)</option>
                                    <option value="width">Width (X)</option>
                                    <option value="depth">Depth (Z)</option>
                                </select>
                            </div>
                        </div>
                        
                        <!-- Reference Options -->
                        <div id="referenceOptions" style="display: none; padding: 12px; background: #fff8e1; border-radius: 6px;">
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
                                ${referenceOptions}
                            </select>
                            <p style="margin: 8px 0 0 0; font-size: 11px; color: #666;">
                                The model's height will match this reference size in OO scale.
                            </p>
                        </div>
                        
                        <!-- Direct Scale Options -->
                        <div id="directOptions" style="display: none; padding: 12px; background: #f3e5f5; border-radius: 6px;">
                            <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">
                                Scale Factor
                            </label>
                            <input type="number" 
                                   id="directScale" 
                                   value="1" 
                                   min="0.001" 
                                   step="0.1"
                                   style="
                                       width: 100%;
                                       padding: 10px;
                                       border: 1px solid #ddd;
                                       border-radius: 6px;
                                       font-size: 14px;
                                       box-sizing: border-box;
                                   ">
                            <p style="margin: 8px 0 0 0; font-size: 11px; color: #666;">
                                1.0 = original size, 0.5 = half size, 2.0 = double size
                            </p>
                        </div>
                        
                        <!-- As-Is Options -->
                        <div id="asIsOptions" style="display: none; padding: 12px; background: #e8f5e9; border-radius: 6px;">
                            <p style="margin: 0; font-size: 12px; color: #2E7D32;">
                                ✓ Model will be used at its original size (assumed to already be OO scale).
                            </p>
                        </div>
                    </div>
                </div>
                
                <!-- Scale Preview -->
                <div id="scalePreview" style="
                    margin-top: 12px;
                    padding: 12px;
                    background: #f5f5f5;
                    border-radius: 6px;
                    font-size: 13px;
                    color: #666;
                ">
                    <em>Load a model to see scale preview...</em>
                </div>
            </div>
        </div>
        
        <!-- ================================================================ -->
        <!-- FOOTER / BUTTONS -->
        <!-- ================================================================ -->
        <div style="
            padding: 16px 20px;
            background: #f5f5f5;
            border-top: 1px solid #e0e0e0;
            border-radius: 0 0 12px 12px;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
        ">
            <button id="cancelBtn" style="
                padding: 10px 24px;
                border: 1px solid #ddd;
                border-radius: 6px;
                background: white;
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

// ============================================================================
// CATEGORY SELECTION HELPER
// ============================================================================

/**
 * Attach category card click handlers
 * This should be called AFTER the dialog HTML is added to the DOM
 * 
 * @param container - The dialog container element
 * @param onCategoryChange - Callback when category changes
 * @param onRollingStockTypeChange - Callback when rolling stock type changes
 */
export function attachCategoryHandlers(
    container: HTMLElement,
    onCategoryChange: (category: ModelCategory) => void,
    onRollingStockTypeChange: (type: RollingStockSubcategory | null) => void
): void {
    // Get all category cards
    const allCards = container.querySelectorAll('.category-card');

    // Helper to deselect all cards
    const deselectAll = () => {
        allCards.forEach(card => {
            const cardEl = card as HTMLElement;
            cardEl.style.borderColor = '#ddd';
            cardEl.style.background = 'white';
        });
    };

    // Helper to select a card
    const selectCard = (card: HTMLElement) => {
        deselectAll();
        card.style.borderColor = '#4CAF50';
        card.style.background = '#e8f5e9';
    };

    // Attach click handlers to rolling stock cards
    const rollingStockCards = container.querySelectorAll('[data-rolling-stock-type]');
    rollingStockCards.forEach(card => {
        const cardEl = card as HTMLElement;

        // Add hover effects
        cardEl.addEventListener('mouseenter', () => {
            if (cardEl.style.borderColor !== 'rgb(76, 175, 80)') {
                cardEl.style.borderColor = '#aaa';
                cardEl.style.background = '#f5f5f5';
            }
        });

        cardEl.addEventListener('mouseleave', () => {
            if (cardEl.style.borderColor !== 'rgb(76, 175, 80)') {
                cardEl.style.borderColor = '#ddd';
                cardEl.style.background = 'white';
            }
        });

        // Click handler
        cardEl.addEventListener('click', () => {
            const type = cardEl.getAttribute('data-rolling-stock-type') as RollingStockSubcategory;
            selectCard(cardEl);

            // Update hidden inputs
            const categoryInput = container.querySelector('#selectedCategory') as HTMLInputElement;
            const typeInput = container.querySelector('#selectedRollingStockType') as HTMLInputElement;
            if (categoryInput) categoryInput.value = 'rolling_stock';
            if (typeInput) typeInput.value = type;

            // Call callbacks
            onCategoryChange('rolling_stock');
            onRollingStockTypeChange(type);

            console.log(`[ModelImportDialogTemplate] Selected rolling stock: ${type}`);
        });
    });

    // Attach click handlers to general cards
    const generalCards = container.querySelectorAll('[data-category]');
    generalCards.forEach(card => {
        const cardEl = card as HTMLElement;

        // Add hover effects
        cardEl.addEventListener('mouseenter', () => {
            if (cardEl.style.borderColor !== 'rgb(76, 175, 80)') {
                cardEl.style.borderColor = '#aaa';
                cardEl.style.background = '#f5f5f5';
            }
        });

        cardEl.addEventListener('mouseleave', () => {
            if (cardEl.style.borderColor !== 'rgb(76, 175, 80)') {
                cardEl.style.borderColor = '#ddd';
                cardEl.style.background = 'white';
            }
        });

        // Click handler
        cardEl.addEventListener('click', () => {
            const category = cardEl.getAttribute('data-category') as ModelCategory;
            selectCard(cardEl);

            // Update hidden inputs
            const categoryInput = container.querySelector('#selectedCategory') as HTMLInputElement;
            const typeInput = container.querySelector('#selectedRollingStockType') as HTMLInputElement;
            if (categoryInput) categoryInput.value = category;
            if (typeInput) typeInput.value = '';

            // Call callbacks
            onCategoryChange(category);
            onRollingStockTypeChange(null);

            console.log(`[ModelImportDialogTemplate] Selected category: ${category}`);
        });
    });

    // Select "Custom" by default
    const customCard = container.querySelector('[data-category="custom"]') as HTMLElement;
    if (customCard) {
        selectCard(customCard);
    }

    console.log(`[ModelImportDialogTemplate] Attached handlers to ${allCards.length} category cards`);
}