/**
 * BaseboardSystem.ts - Manages baseboard and table
 * 
 * Creates and manages the visual representation of:
 * - The baseboard (layout surface)
 * - The supporting table
 * 
 * @module BaseboardSystem
 */

import { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Project } from '../../core/Project';

/**
 * BaseboardSystem - creates and manages the baseboard and table meshes
 */
export class BaseboardSystem {
    private scene: Scene;
    private project: Project;
    private baseboard: Mesh | null = null;
    private table: Mesh | null = null;
    private tableLegs: Mesh[] = [];

    constructor(scene: Scene, project: Project) {
        if (!scene) {
            throw new Error('[BaseboardSystem] Scene is required');
        }
        if (!project) {
            throw new Error('[BaseboardSystem] Project is required');
        }
        this.scene = scene;
        this.project = project;
        console.log('✓ Baseboard system initialized');
    }

    /**
     * Initialize the baseboard and table
     */
    initialize(): void {
        try {
            this.createBaseboard();
            this.createTable();
        } catch (error) {
            console.error('[BaseboardSystem] Failed to initialize:', error);
            throw error;
        }
    }

    /**
     * Create the baseboard mesh
     */
    private createBaseboard(): void {
        try {
            const boardWidth = 1.2;
            const boardDepth = 0.6;
            const boardThickness = 0.025;
            const tableHeight = 0.9;

            console.log(`  Board: ${boardWidth}m × ${boardDepth}m × ${boardThickness}m at height ${tableHeight}m`);

            // Create baseboard mesh
            this.baseboard = MeshBuilder.CreateBox('baseboard', {
                width: boardWidth,
                height: boardThickness,
                depth: boardDepth,
                updatable: false
            }, this.scene);

            if (!this.baseboard) {
                throw new Error('[BaseboardSystem] Failed to create baseboard mesh');
            }

            // Position at table height
            const boardY = tableHeight + boardThickness / 2;
            this.baseboard.position = new Vector3(0, boardY, 0);

            // CRITICAL: Make baseboard pickable and compute bounding info
            this.baseboard.isPickable = true;
            this.baseboard.checkCollisions = true;

            // Force bounding info refresh
            this.baseboard.refreshBoundingInfo();
            this.baseboard.computeWorldMatrix(true);

            // Create material
            const material = new StandardMaterial('baseboardMat', this.scene);
            material.diffuseColor = new Color3(0.6, 0.4, 0.3);
            material.specularColor = new Color3(0.05, 0.05, 0.05);
            material.roughness = 0.9;
            this.baseboard.material = material;

            // Log bounding info for debugging
            const boundingInfo = this.baseboard.getBoundingInfo();
            const min = boundingInfo.boundingBox.minimumWorld;
            const max = boundingInfo.boundingBox.maximumWorld;
            console.log(`  Baseboard bounds: min(${min.x.toFixed(2)}, ${min.y.toFixed(2)}, ${min.z.toFixed(2)}) max(${max.x.toFixed(2)}, ${max.y.toFixed(2)}, ${max.z.toFixed(2)})`);
            console.log(`  Baseboard created and marked as pickable`);

        } catch (error) {
            console.error('[BaseboardSystem] Error creating baseboard:', error);
            throw error;
        }
    }

    /**
     * Create the table mesh
     */
    private createTable(): void {
        try {
            const boardWidth = 1.2;
            const boardDepth = 0.6;
            const tableHeight = 0.9;

            console.log(`  Table: simpleWood style with 4 legs`);
            this.createSimpleWoodTable(boardWidth, boardDepth, tableHeight);
        } catch (error) {
            console.error('[BaseboardSystem] Error creating table:', error);
            throw error;
        }
    }

    /**
     * Create a simple wood table
     */
    private createSimpleWoodTable(boardWidth: number, boardDepth: number, tableHeight: number): void {
        try {
            const tableThickness = 0.04;
            const legWidth = 0.08;
            const legInset = 0.1;

            // Create table top
            this.table = MeshBuilder.CreateBox('tableTop', {
                width: boardWidth + 0.1,
                height: tableThickness,
                depth: boardDepth + 0.1,
                updatable: false
            }, this.scene);

            if (!this.table) {
                throw new Error('[BaseboardSystem] Failed to create table mesh');
            }

            // Position table
            const tableY = tableHeight - tableThickness / 2;
            this.table.position = new Vector3(0, tableY, 0);
            this.table.isPickable = true;
            this.table.refreshBoundingInfo();
            this.table.computeWorldMatrix(true);

            // Create table material
            const tableMat = new StandardMaterial('tableMat', this.scene);
            tableMat.diffuseColor = new Color3(0.5, 0.35, 0.25);
            tableMat.specularColor = new Color3(0.1, 0.1, 0.1);
            tableMat.roughness = 0.85;
            this.table.material = tableMat;

            // Create legs at corners
            const legPositions = [
                new Vector3(-boardWidth / 2 + legInset, tableHeight / 2, -boardDepth / 2 + legInset),
                new Vector3(boardWidth / 2 - legInset, tableHeight / 2, -boardDepth / 2 + legInset),
                new Vector3(-boardWidth / 2 + legInset, tableHeight / 2, boardDepth / 2 - legInset),
                new Vector3(boardWidth / 2 - legInset, tableHeight / 2, boardDepth / 2 - legInset)
            ];

            legPositions.forEach((pos, index) => {
                const leg = MeshBuilder.CreateBox(`tableLeg${index}`, {
                    width: legWidth,
                    height: tableHeight,
                    depth: legWidth,
                    updatable: false
                }, this.scene);

                if (!leg) {
                    console.warn(`[BaseboardSystem] Failed to create table leg ${index}`);
                    return;
                }

                leg.position = pos;
                leg.isPickable = true;
                leg.refreshBoundingInfo();
                leg.computeWorldMatrix(true);
                leg.material = tableMat;
                this.tableLegs.push(leg);
            });

        } catch (error) {
            console.error('[BaseboardSystem] Error creating simple wood table:', error);
            throw error;
        }
    }

    /**
     * Get the Y coordinate of the board top surface
     */
    getBoardTopY(): number {
        return 0.9 + 0.025; // tableHeight + boardThickness
    }

    /**
     * Get the baseboard mesh
     */
    getBaseboard(): Mesh | null {
        return this.baseboard;
    }

    /**
     * Get the table mesh
     */
    getTable(): Mesh | null {
        return this.table;
    }

    /**
     * Check if a position is within the board bounds
     */
    isPositionOnBoard(position: Vector3): boolean {
        const halfWidth = 0.6;  // 1.2 / 2
        const halfDepth = 0.3;  // 0.6 / 2

        return Math.abs(position.x) <= halfWidth &&
            Math.abs(position.z) <= halfDepth;
    }

    /**
     * Dispose all meshes
     */
    dispose(): void {
        try {
            if (this.baseboard) {
                this.baseboard.dispose();
                this.baseboard = null;
            }

            if (this.table) {
                this.table.dispose();
                this.table = null;
            }

            this.tableLegs.forEach(leg => {
                try {
                    leg.dispose();
                } catch (error) {
                    console.error('[BaseboardSystem] Error disposing leg:', error);
                }
            });
            this.tableLegs = [];

            console.log('[BaseboardSystem] Disposed');
        } catch (error) {
            console.error('[BaseboardSystem] Error disposing:', error);
        }
    }
}