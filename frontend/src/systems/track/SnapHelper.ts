/**
 * SnapHelper.ts - Snapping and validation logic for track placement
 * 
 * Handles:
 * - Finding nearby connectors for snapping
 * - Validating connections (position + angle)
 * - Computing snap transforms
 * - Board bounds checking
 * 
 * @module SnapHelper
 */

import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector';
import type { Connector, TrackPiece } from './TrackPiece';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * A potential snap target
 */
export interface SnapCandidate {
    /** The existing piece to snap to */
    existingPiece: TrackPiece;
    /** The connector on the existing piece */
    existingConnector: Connector;
    /** Distance from query position to connector */
    distance: number;
    /** Angle difference (for validation) */
    angleDifference: number;
}

/**
 * Result of a snap computation
 */
export interface SnapResult {
    /** Position for the new piece */
    position: Vector3;
    /** Rotation for the new piece */
    rotation: Quaternion;
    /** The target connector being snapped to */
    targetConnector: Connector;
    /** The piece being snapped to */
    targetPiece: TrackPiece;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Snapping thresholds
 */
const SNAP_CONFIG = {
    /** Maximum distance for snap detection (meters) */
    SNAP_DISTANCE_M: 0.05,
    /** Maximum angle tolerance for connection (degrees) */
    SNAP_ANGLE_DEG: 15,
    /** Tolerance for position matching (meters) */
    POSITION_TOLERANCE_M: 0.002,
} as const;

// ============================================================================
// SNAP HELPER CLASS
// ============================================================================

/**
 * SnapHelper - Utilities for track piece snapping
 * 
 * Provides static methods for detecting and computing snap connections
 * between track pieces.
 * 
 * @example
 * ```typescript
 * const candidates = SnapHelper.findNearbyConnectors(position, pieces);
 * if (candidates.length > 0) {
 *     const snapTransform = SnapHelper.computeSnapTransform(newConnector, candidates[0].existingConnector);
 * }
 * ```
 */
export class SnapHelper {
    // Export constants for external access
    static readonly SNAP_DISTANCE_M = SNAP_CONFIG.SNAP_DISTANCE_M;
    static readonly SNAP_ANGLE_DEG = SNAP_CONFIG.SNAP_ANGLE_DEG;

    // ========================================================================
    // SNAP DETECTION
    // ========================================================================

    /**
     * Find connectors near a position that could snap
     * @param position - World position to search from
     * @param allPieces - All placed track pieces
     * @param excludePiece - Optional piece to exclude from search
     * @returns Array of snap candidates, sorted by distance
     */
    static findNearbyConnectors(
        position: Vector3,
        allPieces: TrackPiece[],
        excludePiece?: TrackPiece
    ): SnapCandidate[] {
        const candidates: SnapCandidate[] = [];

        if (!position || !allPieces) {
            console.error('[SnapHelper] Invalid inputs to findNearbyConnectors');
            return candidates;
        }

        for (const piece of allPieces) {
            // Skip excluded piece
            if (piece === excludePiece) continue;
            if (!piece?.connectors) continue;

            // Check ALL connectors (not just unconnected - the validation handles that)
            // A connector is "available" if it's not already connected to another piece
            for (const connector of piece.connectors) {
                if (!connector?.worldPos) continue;

                // Skip if this connector is already connected to another piece
                if (this.isConnectorConnectedToOtherPiece(connector, allPieces, piece)) {
                    continue;
                }

                try {
                    const distance = Vector3.Distance(position, connector.worldPos);

                    if (distance <= SNAP_CONFIG.SNAP_DISTANCE_M) {
                        candidates.push({
                            existingPiece: piece,
                            existingConnector: connector,
                            distance,
                            angleDifference: 0 // Computed during validation
                        });
                    }
                } catch (error) {
                    console.error('[SnapHelper] Error checking connector distance:', error);
                }
            }
        }

        // Sort by distance (closest first)
        candidates.sort((a, b) => a.distance - b.distance);

        return candidates;
    }

    /**
     * Check if a connector is already connected to another piece
     * (shares a nodeId with another piece's connector)
     */
    private static isConnectorConnectedToOtherPiece(
        connector: Connector,
        allPieces: TrackPiece[],
        ownerPiece: TrackPiece
    ): boolean {
        if (!connector.nodeId) return false;

        for (const piece of allPieces) {
            if (piece === ownerPiece) continue;

            for (const otherConnector of piece.connectors) {
                if (otherConnector.nodeId === connector.nodeId) {
                    return true; // Already connected to another piece
                }
            }
        }

        return false;
    }

    /**
     * Get the best (closest) snap candidate
     * @param position - Position to snap from
     * @param allPieces - All placed pieces
     * @param excludePiece - Optional piece to exclude
     * @returns Best candidate or null
     */
    static getBestSnapCandidate(
        position: Vector3,
        allPieces: TrackPiece[],
        excludePiece?: TrackPiece
    ): SnapCandidate | null {
        const candidates = this.findNearbyConnectors(position, allPieces, excludePiece);
        return candidates.length > 0 ? candidates[0] : null;
    }

    // ========================================================================
    // SNAP COMPUTATION
    // ========================================================================

    /**
     * Compute the transform to snap a new piece's connector to a target
     * 
     * The new piece's connector should align with the target connector:
     * - Positions match exactly
     * - Forward directions are opposite (180° apart)
     * 
     * @param newPieceConnector - Connector on the new piece
     * @param targetConnector - Connector to snap to
     * @returns Snap transform or null if computation fails
     */
    static computeSnapTransform(
        newPieceConnector: Connector,
        targetConnector: Connector
    ): { position: Vector3; rotation: Quaternion } | null {
        try {
            if (!newPieceConnector || !targetConnector) {
                console.error('[SnapHelper] Invalid connectors for snap computation');
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

            // The new connector should face opposite to the target
            const desiredForward = targetConnector.worldForward.scale(-1);

            // Compute rotation to align new connector's forward with desired
            const currentForward = newPieceConnector.localForward;
            const rotation = this.computeRotationBetweenVectors(currentForward, desiredForward);

            if (!rotation) {
                console.error('[SnapHelper] Failed to compute rotation');
                return null;
            }

            // Compute position: target position minus rotated connector offset
            const rotatedOffset = this.rotateVector(newPieceConnector.localPos, rotation);
            const position = targetConnector.worldPos.subtract(rotatedOffset);

            return { position, rotation };

        } catch (error) {
            console.error('[SnapHelper] Error computing snap transform:', error);
            return null;
        }
    }

    // ========================================================================
    // VALIDATION
    // ========================================================================

    /**
     * Validate if two connectors can connect
     * @param connector1 - First connector
     * @param connector2 - Second connector
     * @returns Validation result with reason if invalid
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
            if (distance > SNAP_CONFIG.SNAP_DISTANCE_M) {
                return {
                    valid: false,
                    reason: `Distance too large: ${distance.toFixed(3)}m`
                };
            }

            // Check angle (should be opposite directions, ~180°)
            const dot = Vector3.Dot(
                connector1.worldForward,
                connector2.worldForward
            );
            const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
            const angleDiff = Math.abs(180 - angle);

            if (angleDiff > SNAP_CONFIG.SNAP_ANGLE_DEG) {
                return {
                    valid: false,
                    reason: `Angle mismatch: ${angleDiff.toFixed(1)}°`
                };
            }

            return { valid: true };

        } catch (error) {
            console.error('[SnapHelper] Error validating connection:', error);
            return { valid: false, reason: 'Validation error' };
        }
    }

    // ========================================================================
    // BOUNDS CHECKING
    // ========================================================================

    /**
     * Check if a position is within board bounds
     * @param position - World position to check
     * @param boardWidth - Board width in meters
     * @param boardDepth - Board depth in meters
     * @returns True if position is within bounds
     */
    static isPositionInBounds(
        position: Vector3,
        boardWidth: number,
        boardDepth: number
    ): boolean {
        if (!position) {
            console.error('[SnapHelper] Position is null');
            return false;
        }

        if (boardWidth <= 0 || boardDepth <= 0) {
            console.error('[SnapHelper] Invalid board dimensions');
            return false;
        }

        const halfWidth = boardWidth / 2;
        const halfDepth = boardDepth / 2;

        return (
            Math.abs(position.x) <= halfWidth &&
            Math.abs(position.z) <= halfDepth
        );
    }

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

    /**
     * Compute rotation quaternion from one vector to another
     * @param from - Starting direction
     * @param to - Target direction
     * @returns Rotation quaternion
     */
    private static computeRotationBetweenVectors(
        from: Vector3,
        to: Vector3
    ): Quaternion | null {
        try {
            const fromNorm = from.normalize();
            const toNorm = to.normalize();
            const dot = Vector3.Dot(fromNorm, toNorm);

            // Already aligned
            if (dot > 0.9999) {
                return Quaternion.Identity();
            }

            // Opposite directions
            if (dot < -0.9999) {
                // Find perpendicular axis
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
            console.error('[SnapHelper] Error computing rotation:', error);
            return null;
        }
    }

    /**
     * Rotate a vector by a quaternion
     * @param vector - Vector to rotate
     * @param rotation - Rotation to apply
     * @returns Rotated vector
     */
    private static rotateVector(vector: Vector3, rotation: Quaternion): Vector3 {
        const result = new Vector3();
        vector.rotateByQuaternionToRef(rotation, result);
        return result;
    }
}