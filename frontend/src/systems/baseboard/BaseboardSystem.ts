/**
 * BaseboardSystem.ts - Manages baseboard and table
 */

import { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Project } from '../../core/Project';

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

    initialize(): void {
        try {
            this.createBaseboard();
            this.createTable();
        } catch (error) {
            console.error('[BaseboardSystem] Failed to initialize:', error);
            throw error;
        }
    }

    private createBaseboard(): void {
        try {
            const boardWidth = 1.2;
            const boardDepth = 0.6;
            const boardThickness = 0.025;
            const tableHeight = 0.9;

            console.log(`  Board: ${boardWidth}m × ${boardDepth}m × ${boardThickness}m at height ${tableHeight}m`);

            this.baseboard = MeshBuilder.CreateBox('baseboard', {
                width: boardWidth,
                height: boardThickness,
                depth: boardDepth
            }, this.scene);

            if (!this.baseboard) {
                throw new Error('[BaseboardSystem] Failed to create baseboard mesh');
            }

            const boardY = tableHeight + boardThickness / 2;
            this.baseboard.position = new Vector3(0, boardY, 0);

            // CRITICAL: Make baseboard pickable FIRST
            this.baseboard.isPickable = true;
            this.baseboard.checkCollisions = false; // Don't need collision checking

            // Then apply material
            const material = new StandardMaterial('baseboardMat', this.scene);
            material.diffuseColor = new Color3(0.6, 0.4, 0.3);
            material.specularColor = new Color3(0.05, 0.05, 0.05);
            material.roughness = 0.9;
            this.baseboard.material = material;

            console.log('  Baseboard created and marked as pickable');

        } catch (error) {
            console.error('[BaseboardSystem] Error creating baseboard:', error);
            throw error;
        }
    }

    

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

    private createSimpleWoodTable(boardWidth: number, boardDepth: number, tableHeight: number): void {
        try {
            const tableThickness = 0.04;
            const legWidth = 0.08;
            const legInset = 0.1;

            this.table = MeshBuilder.CreateBox('tableTop', {
                width: boardWidth + 0.1,
                height: tableThickness,
                depth: boardDepth + 0.1
            }, this.scene);

            if (!this.table) {
                throw new Error('[BaseboardSystem] Failed to create table mesh');
            }

            const tableY = tableHeight - tableThickness / 2;
            this.table.position = new Vector3(0, tableY, 0);
            this.table.isPickable = true;

            const tableMat = new StandardMaterial('tableMat', this.scene);
            tableMat.diffuseColor = new Color3(0.5, 0.35, 0.25);
            tableMat.specularColor = new Color3(0.1, 0.1, 0.1);
            tableMat.roughness = 0.85;
            this.table.material = tableMat;

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
                    depth: legWidth
                }, this.scene);

                if (!leg) {
                    console.warn(`[BaseboardSystem] Failed to create table leg ${index}`);
                    return;
                }

                leg.position = pos;
                leg.isPickable = true; // ← Make sure this exists
                leg.material = tableMat;
                this.tableLegs.push(leg);
            });

        } catch (error) {
            console.error('[BaseboardSystem] Error creating simple wood table:', error);
            throw error;
        }
    }

    getBoardTopY(): number {
        return 0.9 + 0.025;
    }

    getBaseboard(): Mesh | null {
        return this.baseboard;
    }

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
            console.error('[App] Error disposing:', error);
        }
    }
}