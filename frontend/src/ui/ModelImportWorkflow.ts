/**
 * ModelImportWorkflow.ts - Smart import workflow for rolling stock
 * 
 * Path: frontend/src/ui/ModelImportWorkflow.ts
 * 
 * Coordinates the complete import workflow for Meshy-style normalized models:
 * 1. Detect if model is normalized
 * 2. Show rolling stock type selector if needed
 * 3. Auto-scale to OO gauge dimensions
 * 4. Position wheels on rail top
 * 5. Register with TrainSystem for driver controls
 * 
 * @module ModelImportWorkflow
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import {
    detectNormalizedMesh,
    processNormalizedMesh,
    RollingStockType,
    OO_TARGET_DIMENSIONS
} from '../systems/train/rolling-stock/NormalizedMeshHandler';

// ============================================================================
// CONSTANTS
// ============================================================================

const LOG_PREFIX = '[ModelImportWorkflow]';

/**
 * Keywords that indicate a model is rolling stock
 */
const ROLLING_STOCK_KEYWORDS = [
    'train', 'loco', 'locomotive', 'engine',
    'diesel', 'steam', 'electric',
    'coach', 'carriage', 'wagon', 'freight',
    'class', 'hst', 'dmu', 'emu'
];

// ============================================================================
// TYPE DETECTION
// ============================================================================

/**
 * Guess rolling stock type from model name
 * 
 * @param modelName - Name of the model
 * @returns Best guess for stock type
 */
export function guessStockType(modelName: string): RollingStockType {
    const name = modelName.toLowerCase();

    // Check for specific types
    if (name.includes('coach') || name.includes('carriage') || name.includes('passenger')) {
        return 'coach';
    }

    if (name.includes('wagon') || name.includes('freight') || name.includes('tanker') ||
        name.includes('hopper') || name.includes('box')) {
        return 'wagon';
    }

    if (name.includes('steam') || name.includes('tank')) {
        return 'steam';
    }

    // Default to locomotive
    return 'locomotive';
}

/**
 * Check if model name suggests it's rolling stock
 * 
 * @param modelName - Name of the model
 * @returns True if appears to be rolling stock
 */
export function isRollingStock(modelName: string): boolean {
    const name = modelName.toLowerCase();
    return ROLLING_STOCK_KEYWORDS.some(keyword => name.includes(keyword));
}

// ============================================================================
// WORKFLOW DIALOGS
// ============================================================================

/**
 * Show rolling stock type selector dialog
 * 
 * Returns a promise that resolves with the selected type,
 * or null if cancelled.
 * 
 * @param modelName - Name of the imported model
 * @returns Promise<RollingStockType | null>
 */
export function showStockTypeSelector(modelName: string): Promise<RollingStockType | null> {
    return new Promise((resolve) => {
        const suggestedType = guessStockType(modelName);

        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.id = 'stock-type-selector-overlay';
        Object.assign(overlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '10000'
        });

        // Create dialog
        const dialog = document.createElement('div');
        Object.assign(dialog.style, {
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '500px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
        });

        dialog.innerHTML = `
            <h2 style="margin: 0 0 10px 0; font-size: 20px; color: #333;">
                🚂 What type of rolling stock is this?
            </h2>
            <p style="margin: 0 0 20px 0; color: #666; font-size: 14px;">
                Model: <strong>${modelName}</strong>
            </p>
            <p style="margin: 0 0 20px 0; color: #666; font-size: 13px;">
                We'll automatically scale it to the correct OO gauge size:
            </p>

            <div id="stock-type-options" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
                <!-- Options will be inserted here -->
            </div>

            <button id="cancel-stock-type" style="
                width: 100%;
                padding: 10px;
                font-size: 13px;
                background: #ccc;
                border: none;
                border-radius: 6px;
                cursor: pointer;
            ">
                Cancel
            </button>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // Create option buttons
        const optionsContainer = dialog.querySelector('#stock-type-options')!;

        const types: Array<{ key: RollingStockType; emoji: string }> = [
            { key: 'locomotive', emoji: '🚆' },
            { key: 'steam', emoji: '🚂' },
            { key: 'coach', emoji: '🚃' },
            { key: 'wagon', emoji: '📦' }
        ];

        types.forEach(({ key, emoji }) => {
            const dims = OO_TARGET_DIMENSIONS[key];
            const button = document.createElement('button');

            const isSuggested = key === suggestedType;

            Object.assign(button.style, {
                padding: '15px',
                fontSize: '14px',
                background: isSuggested ? 'linear-gradient(135deg, #4CAF50, #45a049)' : '#f0f0f0',
                color: isSuggested ? 'white' : '#333',
                border: isSuggested ? '2px solid #45a049' : '2px solid transparent',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s'
            });

            button.innerHTML = `
                <div style="font-size: 24px; margin-bottom: 5px;">${emoji}</div>
                <div style="font-weight: bold; margin-bottom: 3px;">
                    ${dims.name}
                    ${isSuggested ? '<span style="font-size: 11px; opacity: 0.9;"> ✓ Suggested</span>' : ''}
                </div>
                <div style="font-size: 11px; opacity: ${isSuggested ? '0.9' : '0.7'};">
                    ${(dims.length * 1000).toFixed(0)}mm long
                </div>
            `;

            button.addEventListener('mouseenter', () => {
                if (!isSuggested) {
                    button.style.background = '#e0e0e0';
                }
            });

            button.addEventListener('mouseleave', () => {
                if (!isSuggested) {
                    button.style.background = '#f0f0f0';
                }
            });

            button.addEventListener('click', () => {
                document.body.removeChild(overlay);
                resolve(key);
            });

            optionsContainer.appendChild(button);
        });

        // Cancel button
        const cancelButton = dialog.querySelector('#cancel-stock-type') as HTMLButtonElement;
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(null);
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
                resolve(null);
            }
        });
    });
}

// ============================================================================
// COMPLETE WORKFLOW
// ============================================================================

/**
 * Execute complete import workflow for a model
 * 
 * Steps:
 * 1. Check if model is normalized
 * 2. If normalized AND rolling stock → show type selector
 * 3. Scale and position according to type
 * 4. Return success/failure
 * 
 * @param rootNode - Model root node
 * @param meshes - Model meshes
 * @param modelName - Model name/filename
 * @returns Promise<boolean> - Success flag
 */
export async function executeImportWorkflow(
    rootNode: TransformNode,
    meshes: AbstractMesh[],
    modelName: string
): Promise<{
    success: boolean;
    stockType?: RollingStockType;
    message?: string;
}> {
    console.log(`${LOG_PREFIX} ═══════════════════════════════════════`);
    console.log(`${LOG_PREFIX} Starting import workflow for: ${modelName}`);
    console.log(`${LOG_PREFIX} ═══════════════════════════════════════`);

    try {
        // --------------------------------------------------------------------
        // Step 1: Detect if normalized
        // --------------------------------------------------------------------
        const detection = detectNormalizedMesh(meshes);

        if (!detection.isNormalized) {
            console.log(`${LOG_PREFIX} ✓ Standard model, no special processing needed`);
            return {
                success: true,
                message: 'Standard model imported'
            };
        }

        console.log(`${LOG_PREFIX} ⚠ Normalized mesh detected (confidence: ${(detection.confidence * 100).toFixed(0)}%)`);

        // --------------------------------------------------------------------
        // Step 2: Check if rolling stock
        // --------------------------------------------------------------------
        const isRollingStockModel = isRollingStock(modelName);

        if (!isRollingStockModel) {
            console.log(`${LOG_PREFIX} ℹ Not rolling stock, applying default scaling`);
            // For non-rolling stock, just scale to reasonable size (1m max dimension)
            const scaleFactor = 1.0 / Math.max(detection.bounds.size.x, detection.bounds.size.y, detection.bounds.size.z);
            meshes.forEach(m => m.scaling = m.scaling.scale(scaleFactor));
            return {
                success: true,
                message: 'Normalized mesh scaled to 1m'
            };
        }

        // --------------------------------------------------------------------
        // Step 3: Show type selector for rolling stock
        // --------------------------------------------------------------------
        console.log(`${LOG_PREFIX} 🚂 Rolling stock detected, showing type selector...`);

        const selectedType = await showStockTypeSelector(modelName);

        if (!selectedType) {
            console.log(`${LOG_PREFIX} ✗ User cancelled type selection`);
            return {
                success: false,
                message: 'Import cancelled'
            };
        }

        console.log(`${LOG_PREFIX} ✓ User selected: ${selectedType}`);

        // --------------------------------------------------------------------
        // Step 4: Process with selected type
        // --------------------------------------------------------------------
        const result = processNormalizedMesh(rootNode, meshes, selectedType);

        if (!result.success) {
            throw new Error('Processing workflow failed');
        }

        console.log(`${LOG_PREFIX} ═══════════════════════════════════════`);
        console.log(`${LOG_PREFIX} ✓ Import workflow complete!`);
        console.log(`${LOG_PREFIX} ═══════════════════════════════════════`);

        return {
            success: true,
            stockType: selectedType,
            message: `${OO_TARGET_DIMENSIONS[selectedType].name} ready to place`
        };

    } catch (error) {
        console.error(`${LOG_PREFIX} Workflow failed:`, error);
        return {
            success: false,
            message: `Import failed: ${error}`
        };
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
    LOG_PREFIX,
    ROLLING_STOCK_KEYWORDS
};