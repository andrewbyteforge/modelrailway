/**
 * TrackCatalog.ts - Defines available track piece types
 * 
 * Each catalog entry defines:
 * - Physical dimensions
 * - Connector positions and orientations
 * - Curve parameters (for curved pieces)
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';

export interface ConnectorTemplate {
    id: string;
    localPos: Vector3;
    localForward: Vector3; // Direction the track exits this connector
}

export interface TrackCatalogEntry {
    id: string;
    name: string;
    type: 'straight' | 'curve' | 'switch';
    lengthM: number;
    connectorTemplates: ConnectorTemplate[];

    // For curves
    curveRadiusM?: number;
    curveAngleDeg?: number;

    // For switches
    switchType?: 'left' | 'right' | 'wye';
}

/**
 * Track catalog - standard OO scale pieces (based on common 168mm gauge)
 */
export class TrackCatalog {
    private static entries: Map<string, TrackCatalogEntry> = new Map();

    /**
     * Initialize catalog with standard track pieces
     */
    static initialize(): void {
        this.entries.clear();

        // Straight pieces
        this.addEntry({
            id: 'track.straight_168mm',
            name: 'Straight 168mm',
            type: 'straight',
            lengthM: 0.168,
            connectorTemplates: [
                {
                    id: 'A',
                    localPos: new Vector3(-0.084, 0, 0),
                    localForward: new Vector3(-1, 0, 0)
                },
                {
                    id: 'B',
                    localPos: new Vector3(0.084, 0, 0),
                    localForward: new Vector3(1, 0, 0)
                }
            ]
        });

        this.addEntry({
            id: 'track.straight_84mm',
            name: 'Straight 84mm (Half)',
            type: 'straight',
            lengthM: 0.084,
            connectorTemplates: [
                {
                    id: 'A',
                    localPos: new Vector3(-0.042, 0, 0),
                    localForward: new Vector3(-1, 0, 0)
                },
                {
                    id: 'B',
                    localPos: new Vector3(0.042, 0, 0),
                    localForward: new Vector3(1, 0, 0)
                }
            ]
        });

        // Curved pieces (R=168mm, 90 degrees)
        this.addEntry({
            id: 'track.curve_r168_90deg',
            name: 'Curve R168mm 90°',
            type: 'curve',
            lengthM: 0.264, // Arc length
            curveRadiusM: 0.168,
            curveAngleDeg: 90,
            connectorTemplates: [
                {
                    id: 'A',
                    localPos: new Vector3(-0.168, 0, 0),
                    localForward: new Vector3(-1, 0, 0)
                },
                {
                    id: 'B',
                    localPos: new Vector3(0, 0, 0.168),
                    localForward: new Vector3(0, 0, 1)
                }
            ]
        });

        // 45-degree curve
        this.addEntry({
            id: 'track.curve_r168_45deg',
            name: 'Curve R168mm 45°',
            type: 'curve',
            lengthM: 0.132,
            curveRadiusM: 0.168,
            curveAngleDeg: 45,
            connectorTemplates: [
                {
                    id: 'A',
                    localPos: new Vector3(-0.119, 0, 0),
                    localForward: new Vector3(-1, 0, 0)
                },
                {
                    id: 'B',
                    localPos: new Vector3(-0.119, 0, 0.119),
                    localForward: new Vector3(0.707, 0, 0.707) // 45 degrees
                }
            ]
        });

        // Left-hand switch
        this.addEntry({
            id: 'track.switch_left_168mm_r168',
            name: 'Switch Left 168mm',
            type: 'switch',
            lengthM: 0.168,
            switchType: 'left',
            curveRadiusM: 0.168,
            curveAngleDeg: 15, // Gentle divergence
            connectorTemplates: [
                {
                    id: 'COMMON',
                    localPos: new Vector3(-0.084, 0, 0),
                    localForward: new Vector3(-1, 0, 0)
                },
                {
                    id: 'STRAIGHT', // Route A
                    localPos: new Vector3(0.084, 0, 0),
                    localForward: new Vector3(1, 0, 0)
                },
                {
                    id: 'DIVERGING', // Route B
                    localPos: new Vector3(0.084, 0, 0.044),
                    localForward: new Vector3(0.966, 0, 0.259) // ~15 degrees
                }
            ]
        });

        // Right-hand switch
        this.addEntry({
            id: 'track.switch_right_168mm_r168',
            name: 'Switch Right 168mm',
            type: 'switch',
            lengthM: 0.168,
            switchType: 'right',
            curveRadiusM: 0.168,
            curveAngleDeg: 15,
            connectorTemplates: [
                {
                    id: 'COMMON',
                    localPos: new Vector3(-0.084, 0, 0),
                    localForward: new Vector3(-1, 0, 0)
                },
                {
                    id: 'STRAIGHT',
                    localPos: new Vector3(0.084, 0, 0),
                    localForward: new Vector3(1, 0, 0)
                },
                {
                    id: 'DIVERGING',
                    localPos: new Vector3(0.084, 0, -0.044),
                    localForward: new Vector3(0.966, 0, -0.259)
                }
            ]
        });

        console.log(`✓ Track catalog initialized: ${this.entries.size} piece types`);
    }

    /**
     * Add entry to catalog
     */
    private static addEntry(entry: TrackCatalogEntry): void {
        this.entries.set(entry.id, entry);
    }

    /**
     * Get all catalog entries
     */
    static getAll(): TrackCatalogEntry[] {
        return Array.from(this.entries.values());
    }

    /**
     * Get entry by ID
     */
    static get(id: string): TrackCatalogEntry | undefined {
        return this.entries.get(id);
    }

    /**
     * Get entries by type
     */
    static getByType(type: 'straight' | 'curve' | 'switch'): TrackCatalogEntry[] {
        return this.getAll().filter(entry => entry.type === type);
    }
}