/**
 * ArcMath.ts - Geometric calculations for circular arcs
 * 
 * All the mathematics for working with curved track pieces.
 * Based on real OO gauge (1:76.2) Hornby specifications.
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';

export interface ArcDefinition {
    center: Vector3;
    radius: number;
    startAngle: number;  // radians
    endAngle: number;    // radians
    clockwise: boolean;
}

/**
 * ArcMath - utilities for arc geometry calculations
 */
export class ArcMath {
    /**
     * Calculate arc center from two points with tangent vectors
     * 
     * Given:
     * - start point and tangent direction
     * - end point and tangent direction  
     * - arc radius
     * 
     * Returns: Arc center position and angles
     */
    static calculateArcCenter(
        start: Vector3,
        startTangent: Vector3,
        end: Vector3,
        endTangent: Vector3,
        radius: number
    ): ArcDefinition | null {
        try {
            // Arc center is perpendicular to tangent at distance = radius
            // Two possible centers (left or right of tangent)
            // Use tangent vectors to determine which one

            // Get perpendiculars (rotate tangent 90° around Y axis)
            const startPerp1 = new Vector3(-startTangent.z, 0, startTangent.x); // Left
            const startPerp2 = new Vector3(startTangent.z, 0, -startTangent.x); // Right

            // Two candidate centers
            const center1 = start.add(startPerp1.scale(radius));
            const center2 = start.add(startPerp2.scale(radius));

            // Check which center is correct:
            // The end point should be at distance = radius from center
            const dist1 = Vector3.Distance(center1, end);
            const dist2 = Vector3.Distance(center2, end);

            const tolerance = 0.001; // 1mm tolerance
            let center: Vector3;
            let clockwise: boolean;

            if (Math.abs(dist1 - radius) < tolerance) {
                center = center1;
                clockwise = false; // Left turn
            } else if (Math.abs(dist2 - radius) < tolerance) {
                center = center2;
                clockwise = true; // Right turn
            } else {
                console.error('[ArcMath] Cannot find valid arc center');
                console.error(`  Start: (${start.x.toFixed(3)}, ${start.z.toFixed(3)})`);
                console.error(`  End: (${end.x.toFixed(3)}, ${end.z.toFixed(3)})`);
                console.error(`  Radius: ${radius.toFixed(3)}`);
                console.error(`  Dist1: ${dist1.toFixed(3)}, Dist2: ${dist2.toFixed(3)}`);
                return null;
            }

            // Calculate angles
            const startAngle = Math.atan2(start.z - center.z, start.x - center.x);
            const endAngle = Math.atan2(end.z - center.z, end.x - center.x);

            console.log(`[ArcMath] Arc center: (${center.x.toFixed(3)}, ${center.z.toFixed(3)})`);
            console.log(`  Radius: ${radius.toFixed(3)}m, Clockwise: ${clockwise}`);

            return {
                center,
                radius,
                startAngle,
                endAngle,
                clockwise
            };

        } catch (error) {
            console.error('[ArcMath] Error calculating arc center:', error);
            return null;
        }
    }

    /**
     * Generate points along a circular arc
     */
    static generateArcPoints(
        arc: ArcDefinition,
        numPoints: number
    ): Vector3[] {
        try {
            const points: Vector3[] = [];

            // Calculate total angle (handle wrapping)
            let totalAngle = arc.endAngle - arc.startAngle;

            if (arc.clockwise) {
                // Clockwise: if end < start, we've wrapped around
                if (totalAngle > 0) {
                    totalAngle -= 2 * Math.PI;
                }
            } else {
                // Counter-clockwise: if end < start, we've wrapped around
                if (totalAngle < 0) {
                    totalAngle += 2 * Math.PI;
                }
            }

            // Generate points
            for (let i = 0; i <= numPoints; i++) {
                const t = i / numPoints;
                const angle = arc.startAngle + totalAngle * t;

                const point = new Vector3(
                    arc.center.x + arc.radius * Math.cos(angle),
                    arc.center.y,
                    arc.center.z + arc.radius * Math.sin(angle)
                );

                points.push(point);
            }

            return points;

        } catch (error) {
            console.error('[ArcMath] Error generating arc points:', error);
            return [];
        }
    }

    /**
     * Calculate tangent direction at a point on the arc
     */
    static getTangentAtAngle(
        arc: ArcDefinition,
        angle: number
    ): Vector3 {
        // Tangent is perpendicular to radius
        // For counter-clockwise: tangent = (-sin(θ), 0, cos(θ))
        // For clockwise: tangent = (sin(θ), 0, -cos(θ))

        if (arc.clockwise) {
            return new Vector3(
                Math.sin(angle),
                0,
                -Math.cos(angle)
            ).normalize();
        } else {
            return new Vector3(
                -Math.sin(angle),
                0,
                Math.cos(angle)
            ).normalize();
        }
    }

    /**
     * Calculate arc length
     */
    static calculateArcLength(radius: number, angleDeg: number): number {
        const angleRad = angleDeg * Math.PI / 180;
        return radius * Math.abs(angleRad);
    }

    /**
     * Get perpendicular direction (90° rotation in XZ plane)
     */
    static getPerpendicular(direction: Vector3, leftSide: boolean = true): Vector3 {
        if (leftSide) {
            return new Vector3(-direction.z, 0, direction.x).normalize();
        } else {
            return new Vector3(direction.z, 0, -direction.x).normalize();
        }
    }
}