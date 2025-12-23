/**
 * SnapHelper.ts - Snapping and validation logic for track placement
 * 
 * Handles:
 * - Finding nearby connectors for snapping
 * - Validating connections (position + angle)
 * - Computing snap transforms
 */

import { Vector3, Quaternion } from '@babylonjs/core/Maths/math';
import type { Connector } from './TrackPiece';
import type { TrackPiece } from './TrackPiece';

export interface SnapCandidate {
    existingPiece: TrackPiece;
    existingConnector: Connector;
    distance: number;
    angleDifference: number;
}

export interface SnapResult {
    position: Vector3;
    rotation: Quaternion;
    targetConnector: Connector;
    targetPiece: TrackPiece;
}

/**
 * SnapHelper - utilities for track piece snapping
 */
export class SnapHelper {
    // Snapping thresholds
    static readonly SNAP_DISTANCE_M = 0.05;  // 5cm snap range
    static readonly SNAP_ANGLE_DEG = 15;     // 15° angle tolerance

    /**
     * Find connectors near a position that could snap
     */
    static findNearbyConnectors(
        position: Vector3,
        allPieces: TrackPiece[],
        excludePiece?: TrackPiece
    ): SnapCandidate[] {
        try {
            if (!position) {
                console.error('[SnapHelper] findNearbyConnectors: position is null/undefined');
                return [];
            }

            if (!allPieces || !Array.isArray(allPieces)) {
                console.error('[SnapHelper] findNearbyConnectors: allPieces is not an array');
                return [];
            }

            const candidates: SnapCandidate[] = [];

            for (const piece of allPieces) {
                if (piece === excludePiece) continue;

                if (!piece) {
                    console.warn('[SnapHelper] Encountered null piece in allPieces array');
                    continue;
                }

                // Check all unconnected connectors on this piece
                const unconnected = piece.getUnconnectedConnectors();

                for (const connector of unconnected) {
                    if (!connector) {
                        console.warn(`[SnapHelper] Null connector on piece ${piece.id}`);
                        continue;
                    }

                    if (!connector.worldPos) {
                        console.warn(`[SnapHelper] Connector ${connector.id} on piece ${piece.id} has no worldPos`);
                        continue;
                    }

                    try {
                        const distance = Vector3.Distance(position, connector.worldPos);

                        if (distance <= this.SNAP_DISTANCE_M) {
                            candidates.push({
                                existingPiece: piece,
                                existingConnector: connector,
                                distance,
                                angleDifference: 0 // Will be computed when needed
                            });
                        }
                    } catch (error) {
                        console.error(`[SnapHelper] Error calculating distance for connector ${connector.id}:`, error);
                    }
                }
            }

            // Sort by distance (closest first)
            candidates.sort((a, b) => a.distance - b.distance);

            if (candidates.length > 0) {
                console.log(`[SnapHelper] Found ${candidates.length} snap candidates within ${this.SNAP_DISTANCE_M}m`);
            }

            return candidates;
        } catch (error) {
            console.error('[SnapHelper] Unexpected error in findNearbyConnectors:', error);
            return [];
        }
    }

    /**
     * Compute the snap transform to connect two connectors
     * 
     * The new piece's connector should align with the target connector:
     * - Positions match
     * - Forward directions are opposite (180° apart)
     */
    static computeSnapTransform(
        newPieceConnector: Connector,
        targetConnector: Connector
    ): { position: Vector3; rotation: Quaternion } | null {
        try {
            if (!newPieceConnector) {
                console.error('[SnapHelper] computeSnapTransform: newPieceConnector is null');
                return null;
            }

            if (!targetConnector) {
                console.error('[SnapHelper] computeSnapTransform: targetConnector is null');
                return null;
            }

            if (!targetConnector.worldPos || !targetConnector.worldForward) {
                console.warn('[SnapHelper] Target connector missing world transform');
                return null;
            }

            if (!newPieceConnector.localPos || !newPieceConnector.localForward) {
                console.warn('[SnapHelper] New connector missing local transform');
                return null;
            }

            // The target connector's forward direction
            const targetForward = targetConnector.worldForward;

            // The new connector should face the opposite direction
            const desiredForward = targetForward.scale(-1);

            // Compute rotation to align the new connector's forward with desired forward
            const currentForward = newPieceConnector.localForward;
            const rotation = this.computeRotationBetweenVectors(currentForward, desiredForward);

            if (!rotation) {
                console.error('[SnapHelper] Failed to compute rotation between vectors');
                return null;
            }

            // Compute position offset
            // After rotation, where will the connector be relative to piece origin?
            const rotatedConnectorPos = this.rotateVector(newPieceConnector.localPos, rotation);

            // Position the piece so the rotated connector lands at the target
            const position = targetConnector.worldPos.subtract(rotatedConnectorPos);

            console.log(`[SnapHelper] Computed snap transform: pos=(${position.x.toFixed(3)}, ${position.z.toFixed(3)})`);

            return { position, rotation };
        } catch (error) {
            console.error('[SnapHelper] Error in computeSnapTransform:', error);
            return null;
        }
    }

    /**
     * Validate if two connectors can connect
     */
    static validateConnection(
        connector1: Connector,
        connector2: Connector
    ): { valid: boolean; reason?: string } {
        try {
            if (!connector1 || !connector2) {
                return { valid: false, reason: 'One or both connectors are null' };
            }

            if (!connector1.worldPos || !connector1.worldForward) {
                return { valid: false, reason: 'Connector 1 has no world transform' };
            }

            if (!connector2.worldPos || !connector2.worldForward) {
                return { valid: false, reason: 'Connector 2 has no world transform' };
            }

            // Check distance
            const distance = Vector3.Distance(connector1.worldPos, connector2.worldPos);
            if (distance > this.SNAP_DISTANCE_M) {
                console.log(`[SnapHelper] Connection rejected: distance ${distance.toFixed(3)}m > ${this.SNAP_DISTANCE_M}m`);
                return { valid: false, reason: `Distance too large: ${distance.toFixed(3)}m` };
            }

            // Check angle (should be opposite directions, ~180°)
            const dot = Vector3.Dot(connector1.worldForward, connector2.worldForward);
            const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;

            // Should be close to 180° (opposite directions)
            const angleDiff = Math.abs(180 - angle);
            if (angleDiff > this.SNAP_ANGLE_DEG) {
                console.log(`[SnapHelper] Connection rejected: angle diff ${angleDiff.toFixed(1)}° > ${this.SNAP_ANGLE_DEG}°`);
                return { valid: false, reason: `Angle mismatch: ${angleDiff.toFixed(1)}°` };
            }

            console.log(`[SnapHelper] Connection valid: distance=${distance.toFixed(3)}m, angle=${angleDiff.toFixed(1)}°`);
            return { valid: true };
        } catch (error) {
            console.error('[SnapHelper] Error in validateConnection:', error);
            return { valid: false, reason: 'Validation error: ' + error };
        }
    }

    /**
     * Compute rotation quaternion to rotate from one vector to another
     */
    private static computeRotationBetweenVectors(from: Vector3, to: Vector3): Quaternion | null {
        try {
            if (!from || !to) {
                console.error('[SnapHelper] computeRotationBetweenVectors: null vector');
                return null;
            }

            const fromNorm = from.normalize();
            const toNorm = to.normalize();

            const dot = Vector3.Dot(fromNorm, toNorm);

            // Vectors are already aligned
            if (dot > 0.9999) {
                return Quaternion.Identity();
            }

            // Vectors are opposite
            if (dot < -0.9999) {
                // Find a perpendicular axis
                let axis = Vector3.Cross(Vector3.Up(), fromNorm);
                if (axis.lengthSquared() < 0.01) {
                    axis = Vector3.Cross(Vector3.Right(), fromNorm);
                }
                axis.normalize();
                return Quaternion.RotationAxis(axis, Math.PI);
            }

            // General case
            const axis = Vector3.Cross(fromNorm, toNorm);
            axis.normalize();
            const angle = Math.acos(dot);

            return Quaternion.RotationAxis(axis, angle);
        } catch (error) {
            console.error('[SnapHelper] Error in computeRotationBetweenVectors:', error);
            return null;
        }
    }

    /**
     * Rotate a vector by a quaternion
     */
    private static rotateVector(vector: Vector3, rotation: Quaternion): Vector3 {
        try {
            if (!vector || !rotation) {
                console.error('[SnapHelper] rotateVector: null input');
                return Vector3.Zero();
            }

            const result = new Vector3();
            vector.rotateByQuaternionToRef(rotation, result);
            return result;
        } catch (error) {
            console.error('[SnapHelper] Error in rotateVector:', error);
            return Vector3.Zero();
        }
    }

    /**
     * Check if a position is within board bounds
     */
    static isPositionInBounds(
        position: Vector3,
        boardWidth: number,
        boardDepth: number
    ): boolean {
        try {
            if (!position) {
                console.error('[SnapHelper] isPositionInBounds: position is null');
                return false;
            }

            if (boardWidth <= 0 || boardDepth <= 0) {
                console.error(`[SnapHelper] Invalid board dimensions: ${boardWidth}x${boardDepth}`);
                return false;
            }

            const halfWidth = boardWidth / 2;
            const halfDepth = boardDepth / 2;

            const inBounds = Math.abs(position.x) <= halfWidth && Math.abs(position.z) <= halfDepth;

            if (!inBounds) {
                console.log(`[SnapHelper] Position (${position.x.toFixed(2)}, ${position.z.toFixed(2)}) is out of bounds`);
            }

            return inBounds;
        } catch (error) {
            console.error('[SnapHelper] Error in isPositionInBounds:', error);
            return false;
        }
    }

    /**
     * Get the closest snap candidate (if any)
     */
    static getBestSnapCandidate(
        position: Vector3,
        allPieces: TrackPiece[],
        excludePiece?: TrackPiece
    ): SnapCandidate | null {
        try {
            const candidates = this.findNearbyConnectors(position, allPieces, excludePiece);

            if (candidates.length === 0) {
                return null;
            }

            const best = candidates[0];
            console.log(`[SnapHelper] Best snap candidate: piece ${best.existingPiece.id}, connector ${best.existingConnector.id}, distance ${best.distance.toFixed(3)}m`);

            return best;
        } catch (error) {
            console.error('[SnapHelper] Error in getBestSnapCandidate:', error);
            return null;
        }
    }
}