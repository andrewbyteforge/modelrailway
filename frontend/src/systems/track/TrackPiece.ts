/**
 * TrackPiece.ts - Represents a placed track piece in the layout
 * 
 * Each piece has:
 * - A catalog type
 * - World transform (position + rotation)
 * - Connectors (with world positions)
 * - Associated graph nodes and edges
 */

import { Vector3, Quaternion, Matrix } from '@babylonjs/core/Maths/math';
import type { TrackCatalogEntry } from './TrackCatalog';

export interface Connector {
    id: string;
    localPos: Vector3;
    localForward: Vector3;
    worldPos?: Vector3;      // Computed from transform
    worldForward?: Vector3;  // Computed from transform
    nodeId?: string;         // Associated graph node
}

export interface Transform {
    position: Vector3;
    rotation: Quaternion;
}

/**
 * TrackPiece - a placed instance of a catalog entry
 */
export class TrackPiece {
    id: string;
    catalogId: string;
    catalogEntry: TrackCatalogEntry;
    transform: Transform;
    connectors: Connector[];
    generatedEdgeIds: string[] = [];

    // Switch-specific
    isSwitch: boolean;
    switchState?: 'A' | 'B'; // For switches, which route is active

    constructor(
        id: string,
        catalogEntry: TrackCatalogEntry,
        position: Vector3,
        rotation: Quaternion
    ) {
        this.id = id;
        this.catalogId = catalogEntry.id;
        this.catalogEntry = catalogEntry;
        this.transform = { position, rotation };
        this.isSwitch = catalogEntry.type === 'switch';

        if (this.isSwitch) {
            this.switchState = 'A'; // Default to straight route
        }

        // Create connectors from catalog templates
        this.connectors = catalogEntry.connectorTemplates.map(template => ({
            id: template.id,
            localPos: template.localPos.clone(),
            localForward: template.localForward.clone()
        }));

        this.updateWorldTransforms();
    }

    /**
     * Update world positions and directions of all connectors
     */
    updateWorldTransforms(): void {
        const matrix = Matrix.Compose(
            Vector3.One(),
            this.transform.rotation,
            this.transform.position
        );

        this.connectors.forEach(connector => {
            // Transform local position to world space
            connector.worldPos = Vector3.TransformCoordinates(connector.localPos, matrix);

            // Transform local forward to world space (direction only, no translation)
            connector.worldForward = Vector3.TransformNormal(connector.localForward, matrix);
            connector.worldForward.normalize();
        });
    }

    /**
     * Get a connector by ID
     */
    getConnector(id: string): Connector | undefined {
        return this.connectors.find(c => c.id === id);
    }

    /**
     * Get all connectors that don't have an associated node (unconnected)
     */
    getUnconnectedConnectors(): Connector[] {
        return this.connectors.filter(c => !c.nodeId);
    }

    /**
     * Set the position and update transforms
     */
    setPosition(position: Vector3): void {
        this.transform.position = position.clone();
        this.updateWorldTransforms();
    }

    /**
     * Set the rotation and update transforms
     */
    setRotation(rotation: Quaternion): void {
        this.transform.rotation = rotation.clone();
        this.updateWorldTransforms();
    }

    /**
     * Toggle switch state (for switches only)
     */
    toggleSwitch(): void {
        if (!this.isSwitch) return;
        this.switchState = this.switchState === 'A' ? 'B' : 'A';
    }

    /**
     * Set switch state explicitly
     */
    setSwitchState(state: 'A' | 'B'): void {
        if (!this.isSwitch) return;
        this.switchState = state;
    }

    /**
     * Get the active output connector for a switch based on state
     */
    getActiveSwitchOutput(): Connector | undefined {
        if (!this.isSwitch) return undefined;

        // For switches: COMMON is input, STRAIGHT/DIVERGING are outputs
        const straightConnector = this.getConnector('STRAIGHT');
        const divergingConnector = this.getConnector('DIVERGING');

        return this.switchState === 'A' ? straightConnector : divergingConnector;
    }

    /**
     * Export to JSON format (for saving)
     */
    toJSON() {
        return {
            id: this.id,
            catalogId: this.catalogId,
            transform: {
                pos: {
                    x: this.transform.position.x,
                    y: this.transform.position.y,
                    z: this.transform.position.z
                },
                rot: {
                    x: this.transform.rotation.x,
                    y: this.transform.rotation.y,
                    z: this.transform.rotation.z,
                    w: this.transform.rotation.w
                }
            },
            connectors: this.connectors.map(c => ({
                id: c.id,
                localPos: { x: c.localPos.x, y: c.localPos.y, z: c.localPos.z },
                localForward: { x: c.localForward.x, y: c.localForward.y, z: c.localForward.z },
                nodeId: c.nodeId
            })),
            generatedEdgeIds: this.generatedEdgeIds,
            isSwitch: this.isSwitch,
            switchState: this.switchState
        };
    }
}