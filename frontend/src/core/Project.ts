/**
 * Project.ts - Project configuration and state management
 * 
 * Manages project settings including:
 * - Board dimensions
 * - Table configuration
 * - Camera settings
 * - Scale (OO gauge)
 * 
 * @module Project
 */

import type { Project as ProjectData } from '@shared/types';

/**
 * Project - manages project configuration and settings
 */
export class Project {
    private data: ProjectData | null = null;

    /**
     * Load project from configuration
     * For now, uses default config - later will load from file system
     */
    async load(): Promise<ProjectData> {
        // Default project configuration (matching project.schema.json)
        this.data = {
            schemaVersion: '1.0.0',
            projectId: 'default_project',
            name: 'My Railway',
            units: {
                worldUnit: 'meter',
                lengthUnit: 'meter',
                scale: {
                    standard: 'OO',
                    ratio: 76.2
                }
            },
            board: {
                widthM: 1.2,
                depthM: 0.6,
                thicknessM: 0.025,
                heightFromFloorM: 0.9,
                origin: 'center'
            },
            table: {
                enabled: true,
                style: 'simpleWood',
                legInsetM: 0.05
            },
            camera: {
                defaultMode: 'orbit',
                orbit: {
                    minRadiusM: 1.0,
                    maxRadiusM: 8.0
                },
                walk: {
                    eyeHeightM: 0.16
                }
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        console.log('✓ Project loaded:', this.data.name);
        return this.data;
    }

    /**
     * Get current project data
     */
    getData(): ProjectData {
        if (!this.data) {
            throw new Error('Project not loaded. Call load() first.');
        }
        return this.data;
    }

    /**
     * Get board dimensions in meters
     */
    getBoardDimensions() {
        const board = this.getData().board;
        return {
            width: board.widthM,
            depth: board.depthM,
            thickness: board.thicknessM,
            heightFromFloor: board.heightFromFloorM
        };
    }

    /**
     * Get table configuration
     */
    getTableConfig() {
        return this.getData().table;
    }

    /**
     * Get camera configuration
     */
    getCameraConfig() {
        return this.getData().camera;
    }
}