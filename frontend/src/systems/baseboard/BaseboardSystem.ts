/**
 * BaseboardSystem.ts - Manages the baseboard and table rendering
 * 
 * Path: frontend/src/systems/baseboard/BaseboardSystem.ts
 * 
 * Creates and manages:
 * - The model railway baseboard (working surface)
 * - The supporting table structure
 * - Bounds checking for track placement
 * 
 * Key dimensions (in metres):
 * - Table height: 0.9m (90cm)
 * - Board dimensions: 1.2m x 0.6m (4ft x 2ft)
 * - Board thickness: 0.05m (50mm)
 * 
 * @module BaseboardSystem
 * @author Model Railway Workbench
 * @version 1.1.0
 */

import { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

// ============================================================================
// CONSTANTS - Board and Table Dimensions
// ============================================================================

/**
 * Physical dimensions for the baseboard and table (all in metres)
 * These can be made configurable in future versions
 */
const DIMENSIONS = {
    // Table dimensions
    TABLE_HEIGHT: 0.9,          // 90cm table height (standard workbench)

    // Board dimensions (OO gauge starter layout size)
    BOARD_WIDTH: 1.2,           // 120cm (4ft) width
    BOARD_DEPTH: 0.6,           // 60cm (2ft) depth
    BOARD_THICKNESS: 0.05,      // 50mm thick baseboard (plywood/MDF typical)

    // Table leg dimensions
    LEG_WIDTH: 0.05,            // 50mm square legs
    LEG_INSET: 0.05,            // 50mm inset from board edges

    // Table top (frame beneath board)
    TABLE_TOP_THICKNESS: 0.025, // 25mm thick table frame
} as const;

/**
 * Logging prefix for consistent console output
 */
const LOG_PREFIX = '[BaseboardSystem]';

// ============================================================================
// CLASS DEFINITION
// ============================================================================

/**
 * Manages the baseboard and table visualisation
 * 
 * The baseboard is the working surface where track is laid.
 * The table provides visual context and grounding for the scene.
 */
export class BaseboardSystem {

    // ========================================================================
    // PRIVATE PROPERTIES
    // ========================================================================

    /** Reference to the Babylon.js scene */
    private readonly scene: Scene;

    /** The baseboard mesh (working surface) */
    private baseboard: Mesh | null = null;

    /** The table top mesh */
    private table: Mesh | null = null;

    /** Array of table leg meshes */
    private tableLegs: Mesh[] = [];

    /** Cached board top Y coordinate for efficient access */
    private boardTopY: number;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new BaseboardSystem
     * @param scene - The Babylon.js scene to add meshes to
     */
    constructor(scene: Scene) {
        console.log(`${LOG_PREFIX} Initializing...`);

        if (!scene) {
            throw new Error(`${LOG_PREFIX} Scene is required`);
        }

        this.scene = scene;

        // Pre-calculate the board top Y coordinate
        // Board centre is at TABLE_HEIGHT + BOARD_THICKNESS/2
        // Board top is at centre + BOARD_THICKNESS/2
        // Therefore: top = TABLE_HEIGHT + BOARD_THICKNESS
        this.boardTopY = DIMENSIONS.TABLE_HEIGHT + DIMENSIONS.BOARD_THICKNESS;

        console.log(`${LOG_PREFIX} Board top Y calculated: ${this.boardTopY.toFixed(4)}m`);
    }

    // ========================================================================
    // PUBLIC METHODS - Initialization
    // ========================================================================

    /**
     * Initialize and create all baseboard and table geometry
     * @throws Error if mesh creation fails
     */
    public async initialize(): Promise<void> {
        console.log(`${LOG_PREFIX} Creating baseboard and table...`);

        try {
            // Create the baseboard (track working surface)
            this.createBaseboard();

            // Create the supporting table
            this.createTable();

            console.log(`${LOG_PREFIX} ✓ Initialization complete`);
            console.log(`${LOG_PREFIX}   Board: ${DIMENSIONS.BOARD_WIDTH}m x ${DIMENSIONS.BOARD_DEPTH}m x ${DIMENSIONS.BOARD_THICKNESS}m`);
            console.log(`${LOG_PREFIX}   Board top surface Y: ${this.boardTopY.toFixed(4)}m`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Initialization failed:`, error);
            throw error;
        }
    }

    // ========================================================================
    // PUBLIC METHODS - Accessors
    // ========================================================================

    /**
     * Get the Y coordinate of the board top surface
     * 
     * This is the correct height at which track should be placed.
     * Track pieces sit ON TOP of the baseboard, not inside it.
     * 
     * Calculation:
     * - Board mesh centre is at: TABLE_HEIGHT + BOARD_THICKNESS/2
     * - Board top surface is at: centre + BOARD_THICKNESS/2
     * - Therefore: top = TABLE_HEIGHT + BOARD_THICKNESS
     * 
     * @returns Y coordinate in metres of the baseboard top surface
     */
    public getBoardTopY(): number {
        return this.boardTopY;
    }

    /**
     * Get the baseboard mesh for picking/interaction
     * @returns The baseboard mesh or null if not created
     */
    public getBaseboard(): Mesh | null {
        return this.baseboard;
    }

    /**
     * Get the table mesh
     * @returns The table mesh or null if not created
     */
    public getTable(): Mesh | null {
        return this.table;
    }

    /**
     * Get the board dimensions
     * @returns Object containing width and depth in metres
     */
    public getBoardDimensions(): { width: number; depth: number; thickness: number } {
        return {
            width: DIMENSIONS.BOARD_WIDTH,
            depth: DIMENSIONS.BOARD_DEPTH,
            thickness: DIMENSIONS.BOARD_THICKNESS
        };
    }

    // ========================================================================
    // PUBLIC METHODS - Bounds Checking
    // ========================================================================

    /**
     * Check if a world position is within the board bounds
     * @param position - World position to check (Y component is ignored)
     * @returns True if the position is on the board surface
     */
    public isPositionOnBoard(position: Vector3): boolean {
        if (!position) {
            console.warn(`${LOG_PREFIX} isPositionOnBoard: null position provided`);
            return false;
        }

        const halfWidth = DIMENSIONS.BOARD_WIDTH / 2;
        const halfDepth = DIMENSIONS.BOARD_DEPTH / 2;

        return (
            Math.abs(position.x) <= halfWidth &&
            Math.abs(position.z) <= halfDepth
        );
    }

    /**
     * Clamp a position to be within board bounds
     * @param position - Position to clamp (modified in place)
     * @returns The clamped position
     */
    public clampToBoard(position: Vector3): Vector3 {
        const halfWidth = DIMENSIONS.BOARD_WIDTH / 2;
        const halfDepth = DIMENSIONS.BOARD_DEPTH / 2;

        position.x = Math.max(-halfWidth, Math.min(halfWidth, position.x));
        position.z = Math.max(-halfDepth, Math.min(halfDepth, position.z));

        return position;
    }

    // ========================================================================
    // PUBLIC METHODS - Cleanup
    // ========================================================================

    /**
     * Dispose all meshes and clean up resources
     */
    public dispose(): void {
        console.log(`${LOG_PREFIX} Disposing...`);

        try {
            // Dispose baseboard
            if (this.baseboard) {
                this.baseboard.dispose();
                this.baseboard = null;
            }

            // Dispose table top
            if (this.table) {
                this.table.dispose();
                this.table = null;
            }

            // Dispose all table legs
            for (const leg of this.tableLegs) {
                try {
                    leg.dispose();
                } catch (error) {
                    console.warn(`${LOG_PREFIX} Error disposing leg:`, error);
                }
            }
            this.tableLegs = [];

            console.log(`${LOG_PREFIX} ✓ Disposed`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Disposal error:`, error);
        }
    }

    // ========================================================================
    // PRIVATE METHODS - Mesh Creation
    // ========================================================================

    /**
     * Create the baseboard mesh (working surface for track)
     */
    private createBaseboard(): void {
        console.log(`${LOG_PREFIX} Creating baseboard...`);

        try {
            // Create the baseboard box
            this.baseboard = MeshBuilder.CreateBox('baseboard', {
                width: DIMENSIONS.BOARD_WIDTH,
                height: DIMENSIONS.BOARD_THICKNESS,
                depth: DIMENSIONS.BOARD_DEPTH,
                updatable: false
            }, this.scene);

            if (!this.baseboard) {
                throw new Error('Failed to create baseboard mesh');
            }

            // Position the baseboard
            // Box meshes are positioned by their centre, so:
            // Centre Y = TABLE_HEIGHT + BOARD_THICKNESS/2
            const boardCentreY = DIMENSIONS.TABLE_HEIGHT + DIMENSIONS.BOARD_THICKNESS / 2;
            this.baseboard.position = new Vector3(0, boardCentreY, 0);

            // Enable picking for track placement raycasts
            this.baseboard.isPickable = true;
            this.baseboard.checkCollisions = true;

            // Force bounding info calculation
            this.baseboard.refreshBoundingInfo();
            this.baseboard.computeWorldMatrix(true);

            // Create and apply material (MDF/plywood appearance)
            const material = new StandardMaterial('baseboardMat', this.scene);
            material.diffuseColor = new Color3(0.6, 0.4, 0.3);   // Warm brown (MDF)
            material.specularColor = new Color3(0.05, 0.05, 0.05); // Low specular
            material.roughness = 0.9;  // Very matte finish
            this.baseboard.material = material;

            // Log bounding info for debugging
            const boundingInfo = this.baseboard.getBoundingInfo();
            const min = boundingInfo.boundingBox.minimumWorld;
            const max = boundingInfo.boundingBox.maximumWorld;

            console.log(`${LOG_PREFIX}   Baseboard centre: Y=${boardCentreY.toFixed(4)}m`);
            console.log(`${LOG_PREFIX}   Baseboard bounds: Y from ${min.y.toFixed(4)} to ${max.y.toFixed(4)}m`);
            console.log(`${LOG_PREFIX}   Baseboard marked as pickable`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error creating baseboard:`, error);
            throw error;
        }
    }

    /**
     * Create the table structure (legs and frame)
     */
    private createTable(): void {
        console.log(`${LOG_PREFIX} Creating table...`);

        try {
            this.createSimpleWoodTable();

        } catch (error) {
            console.error(`${LOG_PREFIX} Error creating table:`, error);
            throw error;
        }
    }

    /**
     * Create a simple wooden table with four legs
     */
    private createSimpleWoodTable(): void {
        console.log(`${LOG_PREFIX}   Creating simple wood table with 4 legs...`);

        try {
            // Create table material (darker wood)
            const tableMat = new StandardMaterial('tableMat', this.scene);
            tableMat.diffuseColor = new Color3(0.4, 0.25, 0.15);  // Dark wood
            tableMat.specularColor = new Color3(0.1, 0.1, 0.1);
            tableMat.roughness = 0.8;

            // Calculate leg positions (inset from board corners)
            const halfWidth = DIMENSIONS.BOARD_WIDTH / 2 - DIMENSIONS.LEG_INSET;
            const halfDepth = DIMENSIONS.BOARD_DEPTH / 2 - DIMENSIONS.LEG_INSET;
            const legHeight = DIMENSIONS.TABLE_HEIGHT;
            const legY = legHeight / 2;  // Leg centre

            const legPositions: Vector3[] = [
                new Vector3(-halfWidth, legY, -halfDepth),  // Front-left
                new Vector3(halfWidth, legY, -halfDepth),   // Front-right
                new Vector3(-halfWidth, legY, halfDepth),   // Back-left
                new Vector3(halfWidth, legY, halfDepth)     // Back-right
            ];

            // Create each leg
            legPositions.forEach((pos, index) => {
                const leg = MeshBuilder.CreateBox(`tableLeg_${index}`, {
                    width: DIMENSIONS.LEG_WIDTH,
                    height: legHeight,
                    depth: DIMENSIONS.LEG_WIDTH,
                    updatable: false
                }, this.scene);

                if (!leg) {
                    console.warn(`${LOG_PREFIX} Failed to create table leg ${index}`);
                    return;
                }

                leg.position = pos;
                leg.isPickable = true;
                leg.refreshBoundingInfo();
                leg.computeWorldMatrix(true);
                leg.material = tableMat;

                this.tableLegs.push(leg);
            });

            // Create a frame/apron beneath the board (optional visual enhancement)
            const frameY = DIMENSIONS.TABLE_HEIGHT - DIMENSIONS.TABLE_TOP_THICKNESS / 2;

            this.table = MeshBuilder.CreateBox('tableFrame', {
                width: DIMENSIONS.BOARD_WIDTH - 0.02,  // Slightly smaller than board
                height: DIMENSIONS.TABLE_TOP_THICKNESS,
                depth: DIMENSIONS.BOARD_DEPTH - 0.02,
                updatable: false
            }, this.scene);

            if (this.table) {
                this.table.position = new Vector3(0, frameY, 0);
                this.table.material = tableMat;
                this.table.isPickable = true;
            }

            console.log(`${LOG_PREFIX}   Table created with ${this.tableLegs.length} legs`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error creating simple wood table:`, error);
            throw error;
        }
    }
}