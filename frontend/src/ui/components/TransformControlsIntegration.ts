/**
 * TransformControlsIntegration.ts - Integration guide for SidebarTransformControls
 * 
 * Path: frontend/src/ui/components/TransformControlsIntegration.ts
 * 
 * This file contains the code snippets that need to be added to:
 * 1. UIManager.ts - addScaleControls() and addTransformControls() methods
 * 2. ModelImportButton.ts - getModelSystem() method
 * 3. App.ts - Initialization and selection sync
 * 
 * @module TransformControlsIntegration
 * @author Model Railway Workbench
 * @version 1.0.0
 */

// ============================================================================
// CODE TO ADD TO: UIManager.ts
// ============================================================================

/*
Add these properties to the UIManager class (after existing properties):

    // Container for scale/transform controls
    private settingsContentContainer: HTMLElement | null = null;

Add these methods to UIManager class:

    /**
     * Add scale controls element to the Settings section
     * @param element - The scale controls HTML element
     */
addScaleControls(element: HTMLElement): void {
    const settingsSection = this.accordionSections.get('settings');
    if(settingsSection && settingsSection.content) {
    // Add a divider
    const divider = document.createElement('div');
    divider.style.cssText = `
                height: 1px;
                background: rgba(255,255,255,0.1);
                margin: 12px 0;
            `;
    settingsSection.content.appendChild(divider);

    // Add the scale controls
    settingsSection.content.appendChild(element);

    // Update max-height to accommodate new content
    settingsSection.content.style.maxHeight = '1000px';

    console.log('[UIManager] Scale controls added to Settings section');
} else {
    console.warn('[UIManager] Settings section not found, cannot add scale controls');
}
    }

/**
 * Add transform controls element to the Settings section
 * @param element - The transform controls HTML element
 */
addTransformControls(element: HTMLElement): void {
    const settingsSection = this.accordionSections.get('settings');
    if(settingsSection && settingsSection.content) {
    // Add a divider
    const divider = document.createElement('div');
    divider.style.cssText = `
                height: 1px;
                background: rgba(255,255,255,0.1);
                margin: 12px 0;
            `;
    settingsSection.content.appendChild(divider);

    // Add the transform controls
    settingsSection.content.appendChild(element);

    // Update max-height to accommodate new content
    settingsSection.content.style.maxHeight = '1500px';

    console.log('[UIManager] Transform controls added to Settings section');
} else {
    console.warn('[UIManager] Settings section not found, cannot add transform controls');
}
    }
*/

// ============================================================================
// CODE TO ADD TO: ModelImportButton.ts
// ============================================================================

/*
Add this method to the ModelImportButton class:

    /**
     * Get the ModelSystem instance for external access
     * Used by transform controls to manipulate models
     * @returns ModelSystem instance or null
     */
getModelSystem(): ModelSystem | null {
    return this.modelSystem;
}

/**
 * Get scale controls element for adding to sidebar
 * @returns HTMLElement or null
 */
getScaleControlsElement(): HTMLElement | null {
    // Create scale controls container if not exists
    if (!this.scaleControlsElement) {
        this.scaleControlsElement = this.createScaleControls();
    }
    return this.scaleControlsElement;
}

    // Add this property:
    private scaleControlsElement: HTMLElement | null = null;

    // Add this method to create basic scale controls:
    private createScaleControls(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
            padding: 12px;
            background: #2d3436;
            border-radius: 6px;
        `;

    container.innerHTML = `
            <div style="font-size: 13px; font-weight: 600; color: #dfe6e9; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                <span>📏</span> Model Scale
            </div>
            <div style="color: #b2bec3; font-size: 11px;">
                Select a model to adjust its scale
            </div>
        `;

    return container;
}
*/

// ============================================================================
// UPDATED CODE FOR: App.ts (around line 253-310)
// ============================================================================

/*
Replace the existing transform controls initialization with:

            // ================================================================
            // INITIALIZE TRANSFORM CONTROLS (Position sliders)
            // ================================================================
            this.transformControls = new SidebarTransformControls({
                positionRangeXZ: 0.6,  // ±600mm range for X/Z
                positionMinY: 0.9,     // Minimum Y (below baseboard)
                positionMaxY: 1.1,     // Maximum Y (above baseboard)
                showRotation: true,
                showReset: true
            });

            // Connect to model system for direct manipulation
            if (this.modelImportButton) {
                const modelSystem = this.modelImportButton.getModelSystem();
                if (modelSystem) {
                    this.transformControls.connectToModelSystem(modelSystem);
                    console.log('[App] ✓ Transform controls connected to ModelSystem');
                }
            }

            // Add transform controls to sidebar settings
            if (this.uiManager) {
                const transformElement = this.transformControls.getElement();
                this.uiManager.addTransformControls(transformElement);
                console.log('[App] ✓ Transform controls added to sidebar');
            }

            // ================================================================
            // SYNC MODEL SELECTION TO TRANSFORM CONTROLS
            // ================================================================
            // Poll for selection changes (since ModelSystem doesn't have events)
            let lastSelectedModelId: string | null = null;
            
            this.scene.onBeforeRenderObservable.add(() => {
                if (!this.modelImportButton || !this.transformControls) return;
                
                const modelSystem = this.modelImportButton.getModelSystem();
                if (!modelSystem) return;
                
                const selected = modelSystem.getSelectedModel();
                const selectedId = selected?.id ?? null;
                
                // Only update if selection actually changed
                if (selectedId !== lastSelectedModelId) {
                    lastSelectedModelId = selectedId;
                    this.transformControls.setSelectedModel(selectedId);
                    
                    if (selectedId) {
                        console.log(`[App] Transform controls now tracking: ${selectedId}`);
                    }
                }
            });
*/

// ============================================================================
// EXPORTS (for reference only - don't actually export from this file)
// ============================================================================

export { };