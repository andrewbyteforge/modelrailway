/**
 * TrackCatalog.ts - Defines available track piece types
 * 
 * Based on Hornby OO Gauge track specifications:
 * - Track gauge: 16.5mm (OO/HO standard)
 * - R1 (1st radius): 371mm
 * - R2 (2nd radius): 438mm
 * - R3 (3rd radius): 505mm
 * - R4 (4th radius): 572mm
 * - Standard curve angle: 22.5° (8 pieces = full circle)
 * - Double curve angle: 45° (4 pieces = half circle)
 * - Standard straight: 168mm
 * 
 * Each catalog entry defines:
 * - Physical dimensions (in meters for Babylon.js)
 * - Connector positions and orientations
 * - Curve parameters (radius, angle, direction)
 * 
 * @module TrackCatalog
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Connector template defining a connection point on a track piece
 */
export interface ConnectorTemplate {
    /** Unique identifier for this connector (e.g., 'A', 'B', 'COMMON') */
    id: string;
    /** Position relative to piece center (meters) */
    localPos: Vector3;
    /** Direction the track exits this connector (unit vector) */
    localForward: Vector3;
}

/**
 * Complete track piece definition from the catalog
 */
export interface TrackCatalogEntry {
    /** Unique catalog identifier (e.g., 'track.straight_168mm') */
    id: string;
    /** Human-readable name */
    name: string;
    /** Piece type classification */
    type: 'straight' | 'curve' | 'switch' | 'crossing' | 'curved_switch';
    /** Track length in meters (arc length for curves) */
    lengthM: number;
    /** Connection points on this piece */
    connectorTemplates: ConnectorTemplate[];

    // Curve-specific properties
    /** Curve radius in meters (for curves and switch diverging routes) */
    curveRadiusM?: number;
    /** Curve angle in degrees */
    curveAngleDeg?: number;
    /** Curve direction: 1 = left (counter-clockwise), -1 = right (clockwise) */
    curveDirection?: 1 | -1;

    // Switch-specific properties
    /** Switch type */
    switchType?: 'left' | 'right' | 'wye';

    // Curved switch additional properties
    /** Inner route angle for curved switches */
    innerAngleDeg?: number;
    /** Outer route angle for curved switches */
    outerAngleDeg?: number;

    // Crossing-specific properties
    /** Crossing angle in degrees */
    crossingAngleDeg?: number;
}

// ============================================================================
// HORNBY OO GAUGE CONSTANTS
// ============================================================================

/**
 * Hornby OO Gauge track specifications (converted to meters)
 */
const HORNBY = {
    // Track gauge (distance between rails)
    GAUGE_MM: 16.5,
    GAUGE_M: 0.0165,

    // Curve radii (to track centerline)
    R1_MM: 371,
    R1_M: 0.371,
    R2_MM: 438,
    R2_M: 0.438,
    R3_MM: 505,
    R3_M: 0.505,
    R4_MM: 572,
    R4_M: 0.572,

    // Express point radius (large radius for high-speed turnouts)
    EXPRESS_RADIUS_MM: 852,
    EXPRESS_RADIUS_M: 0.852,

    // Standard angles
    STANDARD_CURVE_DEG: 22.5,   // 8 pieces = 180°, 16 = full circle
    DOUBLE_CURVE_DEG: 45,       // 4 pieces = 180°
    QUAD_CURVE_DEG: 90,         // 2 pieces = 180°
    HALF_CURVE_DEG: 11.25,      // Half of standard curve

    // Curved point angles (R8075/R8076)
    CURVED_POINT_INNER_DEG: 22.5,   // Inner route angle
    CURVED_POINT_OUTER_DEG: 33.75,  // Outer route angle

    // Straight lengths
    STRAIGHT_FULL_MM: 168,
    STRAIGHT_FULL_M: 0.168,
    STRAIGHT_HALF_MM: 84,
    STRAIGHT_HALF_M: 0.084,
    STRAIGHT_QUARTER_MM: 42,
    STRAIGHT_QUARTER_M: 0.042,

    // Express point length (R8077/R8078)
    EXPRESS_POINT_LENGTH_MM: 245,
    EXPRESS_POINT_LENGTH_M: 0.245,
    EXPRESS_DIVERGE_ANGLE_DEG: 11.25,

    // Switch specifications
    SWITCH_LENGTH_MM: 168,
    SWITCH_LENGTH_M: 0.168,
    SWITCH_DIVERGE_ANGLE_DEG: 22.5,  // Standard Hornby point divergence

    // Diamond crossing (R614/R615)
    DIAMOND_LENGTH_MM: 168,
    DIAMOND_LENGTH_M: 0.168,
    DIAMOND_CROSS_ANGLE_DEG: 22.5,
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate arc length given radius and angle
 * @param radiusM - Radius in meters
 * @param angleDeg - Angle in degrees
 * @returns Arc length in meters
 */
function calculateArcLength(radiusM: number, angleDeg: number): number {
    return radiusM * (angleDeg * Math.PI / 180);
}

/**
 * Calculate end position of a curve given start position, radius, and angle
 * Assumes curve starts tangent to X axis, curving in XZ plane
 * @param radiusM - Curve radius in meters
 * @param angleDeg - Curve angle in degrees
 * @param direction - 1 for left (CCW), -1 for right (CW)
 * @returns End position relative to start
 */
function calculateCurveEndPosition(
    radiusM: number,
    angleDeg: number,
    direction: 1 | -1
): Vector3 {
    const angleRad = angleDeg * Math.PI / 180;

    // For a curve starting at origin, tangent to +X axis:
    // Center is at (0, 0, direction * radius)
    // End point is at center + radius * (sin(angle), 0, -direction * cos(angle) + direction)

    const x = radiusM * Math.sin(angleRad);
    const z = direction * radiusM * (1 - Math.cos(angleRad));

    return new Vector3(x, 0, z);
}

/**
 * Calculate exit direction after a curve
 * @param angleDeg - Curve angle in degrees
 * @param direction - 1 for left (CCW), -1 for right (CW)
 * @returns Unit vector of exit direction
 */
function calculateCurveExitDirection(angleDeg: number, direction: 1 | -1): Vector3 {
    const angleRad = angleDeg * Math.PI / 180;

    // Exit direction is rotated by the curve angle
    const x = Math.cos(angleRad);
    const z = direction * Math.sin(angleRad);

    return new Vector3(x, 0, z);
}

// ============================================================================
// TRACK CATALOG CLASS
// ============================================================================

/**
 * TrackCatalog - Static registry of all available track piece types
 * 
 * Based on Hornby OO gauge specifications for accurate model railway simulation.
 * All dimensions are in meters for direct use with Babylon.js.
 * 
 * @example
 * ```typescript
 * TrackCatalog.initialize();
 * const piece = TrackCatalog.get('track.curve_r1_22.5deg');
 * console.log(piece.curveRadiusM); // 0.371
 * ```
 */
export class TrackCatalog {
    /** Internal storage for catalog entries */
    private static entries: Map<string, TrackCatalogEntry> = new Map();

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize catalog with standard Hornby OO gauge track pieces
     * Must be called before using any other catalog methods
     */
    static initialize(): void {
        this.entries.clear();

        // Add all track types
        this.initializeStraightTracks();
        this.initializeR1Curves();
        this.initializeR2Curves();
        this.initializeR4Curves();
        this.initializeSwitches();
        this.initializeExpressPoints();
        this.initializeCurvedPoints();
        this.initializeCrossings();

        console.log(`✓ Track catalog initialized: ${this.entries.size} piece types`);
        console.log(`  Hornby OO Gauge: R1=${HORNBY.R1_MM}mm, R2=${HORNBY.R2_MM}mm, R4=${HORNBY.R4_MM}mm`);
    }

    // ========================================================================
    // STRAIGHT TRACKS
    // ========================================================================

    /**
     * Initialize straight track pieces
     */
    private static initializeStraightTracks(): void {
        // Full straight (168mm) - R600
        this.addEntry({
            id: 'track.straight_168mm',
            name: 'Straight 168mm (R600)',
            type: 'straight',
            lengthM: HORNBY.STRAIGHT_FULL_M,
            connectorTemplates: [
                {
                    id: 'A',
                    localPos: new Vector3(-HORNBY.STRAIGHT_FULL_M / 2, 0, 0),
                    localForward: new Vector3(-1, 0, 0)
                },
                {
                    id: 'B',
                    localPos: new Vector3(HORNBY.STRAIGHT_FULL_M / 2, 0, 0),
                    localForward: new Vector3(1, 0, 0)
                }
            ]
        });

        // Half straight (84mm) - R601
        this.addEntry({
            id: 'track.straight_84mm',
            name: 'Straight 84mm (R601)',
            type: 'straight',
            lengthM: HORNBY.STRAIGHT_HALF_M,
            connectorTemplates: [
                {
                    id: 'A',
                    localPos: new Vector3(-HORNBY.STRAIGHT_HALF_M / 2, 0, 0),
                    localForward: new Vector3(-1, 0, 0)
                },
                {
                    id: 'B',
                    localPos: new Vector3(HORNBY.STRAIGHT_HALF_M / 2, 0, 0),
                    localForward: new Vector3(1, 0, 0)
                }
            ]
        });

        // Quarter straight (42mm) - R610
        this.addEntry({
            id: 'track.straight_42mm',
            name: 'Straight 42mm (R610)',
            type: 'straight',
            lengthM: HORNBY.STRAIGHT_QUARTER_M,
            connectorTemplates: [
                {
                    id: 'A',
                    localPos: new Vector3(-HORNBY.STRAIGHT_QUARTER_M / 2, 0, 0),
                    localForward: new Vector3(-1, 0, 0)
                },
                {
                    id: 'B',
                    localPos: new Vector3(HORNBY.STRAIGHT_QUARTER_M / 2, 0, 0),
                    localForward: new Vector3(1, 0, 0)
                }
            ]
        });
    }

    // ========================================================================
    // R1 (1ST RADIUS) CURVES - 371mm
    // ========================================================================

    /**
     * Initialize R1 (1st radius) curve pieces
     */
    private static initializeR1Curves(): void {
        const radius = HORNBY.R1_M;

        // R1 Standard curve 22.5° - R606 (left)
        this.addR1Curve('track.curve_r1_22.5deg_left', 'Curve R1 22.5° Left (R606)',
            HORNBY.STANDARD_CURVE_DEG, 1);

        // R1 Standard curve 22.5° - right
        this.addR1Curve('track.curve_r1_22.5deg_right', 'Curve R1 22.5° Right',
            HORNBY.STANDARD_CURVE_DEG, -1);

        // R1 Double curve 45° - R605 (left) - THE PIECE IN THE IMAGE
        this.addR1Curve('track.curve_r1_45deg_left', 'Curve R1 45° Left (R605)',
            HORNBY.DOUBLE_CURVE_DEG, 1);

        // R1 Double curve 45° - right
        this.addR1Curve('track.curve_r1_45deg_right', 'Curve R1 45° Right',
            HORNBY.DOUBLE_CURVE_DEG, -1);

        // R1 Quad curve 90° (left)
        this.addR1Curve('track.curve_r1_90deg_left', 'Curve R1 90° Left',
            HORNBY.QUAD_CURVE_DEG, 1);

        // R1 Quad curve 90° (right)
        this.addR1Curve('track.curve_r1_90deg_right', 'Curve R1 90° Right',
            HORNBY.QUAD_CURVE_DEG, -1);
    }

    /**
     * Helper to add an R1 curve entry
     */
    private static addR1Curve(
        id: string,
        name: string,
        angleDeg: number,
        direction: 1 | -1
    ): void {
        const radius = HORNBY.R1_M;
        const arcLength = calculateArcLength(radius, angleDeg);
        const endPos = calculateCurveEndPosition(radius, angleDeg, direction);
        const exitDir = calculateCurveExitDirection(angleDeg, direction);

        this.addEntry({
            id,
            name,
            type: 'curve',
            lengthM: arcLength,
            curveRadiusM: radius,
            curveAngleDeg: angleDeg,
            curveDirection: direction,
            connectorTemplates: [
                {
                    id: 'A',
                    localPos: new Vector3(0, 0, 0),
                    localForward: new Vector3(-1, 0, 0)  // Entry faces backward
                },
                {
                    id: 'B',
                    localPos: endPos,
                    localForward: exitDir  // Exit faces forward along curve
                }
            ]
        });
    }

    // ========================================================================
    // R2 (2ND RADIUS) CURVES - 438mm
    // ========================================================================

    /**
     * Initialize R2 (2nd radius) curve pieces
     */
    private static initializeR2Curves(): void {
        // R2 Standard curve 22.5° - R606 (left)
        this.addR2Curve('track.curve_r2_22.5deg_left', 'Curve R2 22.5° Left (R606)',
            HORNBY.STANDARD_CURVE_DEG, 1);

        // R2 Standard curve 22.5° - right
        this.addR2Curve('track.curve_r2_22.5deg_right', 'Curve R2 22.5° Right',
            HORNBY.STANDARD_CURVE_DEG, -1);

        // R2 Double curve 45° (left) - R607
        this.addR2Curve('track.curve_r2_45deg_left', 'Curve R2 45° Left (R607)',
            HORNBY.DOUBLE_CURVE_DEG, 1);

        // R2 Double curve 45° (right)
        this.addR2Curve('track.curve_r2_45deg_right', 'Curve R2 45° Right',
            HORNBY.DOUBLE_CURVE_DEG, -1);
    }

    /**
     * Helper to add an R2 curve entry
     */
    private static addR2Curve(
        id: string,
        name: string,
        angleDeg: number,
        direction: 1 | -1
    ): void {
        const radius = HORNBY.R2_M;
        const arcLength = calculateArcLength(radius, angleDeg);
        const endPos = calculateCurveEndPosition(radius, angleDeg, direction);
        const exitDir = calculateCurveExitDirection(angleDeg, direction);

        this.addEntry({
            id,
            name,
            type: 'curve',
            lengthM: arcLength,
            curveRadiusM: radius,
            curveAngleDeg: angleDeg,
            curveDirection: direction,
            connectorTemplates: [
                {
                    id: 'A',
                    localPos: new Vector3(0, 0, 0),
                    localForward: new Vector3(-1, 0, 0)
                },
                {
                    id: 'B',
                    localPos: endPos,
                    localForward: exitDir
                }
            ]
        });
    }

    // ========================================================================
    // SWITCHES (POINTS/TURNOUTS)
    // ========================================================================

    /**
     * Initialize switch/point pieces
     */
    private static initializeSwitches(): void {
        const switchLength = HORNBY.SWITCH_LENGTH_M;
        const divergeAngle = HORNBY.SWITCH_DIVERGE_ANGLE_DEG;
        const divergeRadius = HORNBY.R1_M;  // Hornby points use R1 radius

        // Calculate diverging route end position
        const divergeEndPos = calculateCurveEndPosition(divergeRadius, divergeAngle, 1);
        const divergeExitDir = calculateCurveExitDirection(divergeAngle, 1);

        // Left-hand switch (R8072)
        this.addEntry({
            id: 'track.switch_left',
            name: 'Switch Left (R8072)',
            type: 'switch',
            lengthM: switchLength,
            switchType: 'left',
            curveRadiusM: divergeRadius,
            curveAngleDeg: divergeAngle,
            curveDirection: 1,
            connectorTemplates: [
                {
                    id: 'COMMON',
                    localPos: new Vector3(-switchLength / 2, 0, 0),
                    localForward: new Vector3(-1, 0, 0)
                },
                {
                    id: 'STRAIGHT',
                    localPos: new Vector3(switchLength / 2, 0, 0),
                    localForward: new Vector3(1, 0, 0)
                },
                {
                    id: 'DIVERGING',
                    localPos: new Vector3(
                        -switchLength / 2 + divergeEndPos.x,
                        0,
                        divergeEndPos.z
                    ),
                    localForward: divergeExitDir
                }
            ]
        });

        // Right-hand switch (R8073)
        const divergeEndPosRight = calculateCurveEndPosition(divergeRadius, divergeAngle, -1);
        const divergeExitDirRight = calculateCurveExitDirection(divergeAngle, -1);

        this.addEntry({
            id: 'track.switch_right',
            name: 'Switch Right (R8073)',
            type: 'switch',
            lengthM: switchLength,
            switchType: 'right',
            curveRadiusM: divergeRadius,
            curveAngleDeg: divergeAngle,
            curveDirection: -1,
            connectorTemplates: [
                {
                    id: 'COMMON',
                    localPos: new Vector3(-switchLength / 2, 0, 0),
                    localForward: new Vector3(-1, 0, 0)
                },
                {
                    id: 'STRAIGHT',
                    localPos: new Vector3(switchLength / 2, 0, 0),
                    localForward: new Vector3(1, 0, 0)
                },
                {
                    id: 'DIVERGING',
                    localPos: new Vector3(
                        -switchLength / 2 + divergeEndPosRight.x,
                        0,
                        divergeEndPosRight.z
                    ),
                    localForward: divergeExitDirRight
                }
            ]
        });
    }

    // ========================================================================
    // R4 (4TH RADIUS) CURVES - 572mm
    // ========================================================================

    /**
     * Initialize R4 (4th radius) curve pieces - R8261/R8262
     */
    private static initializeR4Curves(): void {
        // R4 Standard curve 22.5° - R8261 (left)
        this.addR4Curve('track.curve_r4_22.5deg_left', 'Curve R4 22.5° Left (R8261)',
            HORNBY.STANDARD_CURVE_DEG, 1);

        // R4 Standard curve 22.5° (right)
        this.addR4Curve('track.curve_r4_22.5deg_right', 'Curve R4 22.5° Right',
            HORNBY.STANDARD_CURVE_DEG, -1);

        // R4 Double curve 45° (left) - R8262
        this.addR4Curve('track.curve_r4_45deg_left', 'Curve R4 45° Left (R8262)',
            HORNBY.DOUBLE_CURVE_DEG, 1);

        // R4 Double curve 45° (right)
        this.addR4Curve('track.curve_r4_45deg_right', 'Curve R4 45° Right',
            HORNBY.DOUBLE_CURVE_DEG, -1);
    }

    /**
     * Helper to add an R4 curve entry
     */
    private static addR4Curve(
        id: string,
        name: string,
        angleDeg: number,
        direction: 1 | -1
    ): void {
        const radius = HORNBY.R4_M;
        const arcLength = calculateArcLength(radius, angleDeg);
        const endPos = calculateCurveEndPosition(radius, angleDeg, direction);
        const exitDir = calculateCurveExitDirection(angleDeg, direction);

        this.addEntry({
            id,
            name,
            type: 'curve',
            lengthM: arcLength,
            curveRadiusM: radius,
            curveAngleDeg: angleDeg,
            curveDirection: direction,
            connectorTemplates: [
                {
                    id: 'A',
                    localPos: new Vector3(0, 0, 0),
                    localForward: new Vector3(-1, 0, 0)
                },
                {
                    id: 'B',
                    localPos: endPos,
                    localForward: exitDir
                }
            ]
        });
    }

    // ========================================================================
    // EXPRESS POINTS - R8077/R8078 (Long radius, shallow angle)
    // ========================================================================

    /**
     * Initialize express point pieces - large radius for high-speed turnouts
     */
    private static initializeExpressPoints(): void {
        const pointLength = HORNBY.EXPRESS_POINT_LENGTH_M;
        const divergeAngle = HORNBY.EXPRESS_DIVERGE_ANGLE_DEG;
        const divergeRadius = HORNBY.EXPRESS_RADIUS_M;

        // Calculate diverging route end position
        const divergeEndPos = calculateCurveEndPosition(divergeRadius, divergeAngle, 1);
        const divergeExitDir = calculateCurveExitDirection(divergeAngle, 1);

        // Left-hand express point (R8077)
        this.addEntry({
            id: 'track.express_point_left',
            name: 'Express Point Left (R8077)',
            type: 'switch',
            lengthM: pointLength,
            switchType: 'left',
            curveRadiusM: divergeRadius,
            curveAngleDeg: divergeAngle,
            curveDirection: 1,
            connectorTemplates: [
                {
                    id: 'COMMON',
                    localPos: new Vector3(-pointLength / 2, 0, 0),
                    localForward: new Vector3(-1, 0, 0)
                },
                {
                    id: 'STRAIGHT',
                    localPos: new Vector3(pointLength / 2, 0, 0),
                    localForward: new Vector3(1, 0, 0)
                },
                {
                    id: 'DIVERGING',
                    localPos: new Vector3(
                        -pointLength / 2 + divergeEndPos.x,
                        0,
                        divergeEndPos.z
                    ),
                    localForward: divergeExitDir
                }
            ]
        });

        // Right-hand express point (R8078)
        const divergeEndPosRight = calculateCurveEndPosition(divergeRadius, divergeAngle, -1);
        const divergeExitDirRight = calculateCurveExitDirection(divergeAngle, -1);

        this.addEntry({
            id: 'track.express_point_right',
            name: 'Express Point Right (R8078)',
            type: 'switch',
            lengthM: pointLength,
            switchType: 'right',
            curveRadiusM: divergeRadius,
            curveAngleDeg: divergeAngle,
            curveDirection: -1,
            connectorTemplates: [
                {
                    id: 'COMMON',
                    localPos: new Vector3(-pointLength / 2, 0, 0),
                    localForward: new Vector3(-1, 0, 0)
                },
                {
                    id: 'STRAIGHT',
                    localPos: new Vector3(pointLength / 2, 0, 0),
                    localForward: new Vector3(1, 0, 0)
                },
                {
                    id: 'DIVERGING',
                    localPos: new Vector3(
                        -pointLength / 2 + divergeEndPosRight.x,
                        0,
                        divergeEndPosRight.z
                    ),
                    localForward: divergeExitDirRight
                }
            ]
        });
    }

    // ========================================================================
    // CURVED POINTS - R8075/R8076 (Both routes are curved)
    // ========================================================================

    /**
     * Initialize curved point pieces - both routes follow curves
     * R8075 (RH) and R8076 (LH) - 438mm radius, inner 22.5°, outer 33.75°
     */
    private static initializeCurvedPoints(): void {
        const radius = HORNBY.R2_M;  // 438mm - same as R2 curves
        const innerAngle = HORNBY.CURVED_POINT_INNER_DEG;   // 22.5°
        const outerAngle = HORNBY.CURVED_POINT_OUTER_DEG;   // 33.75°

        // Right-hand curved point (R8075) - curves right
        // Inner route: 22.5° right curve
        // Outer route: 33.75° right curve
        const innerEndPosR = calculateCurveEndPosition(radius, innerAngle, -1);
        const innerExitDirR = calculateCurveExitDirection(innerAngle, -1);
        const outerEndPosR = calculateCurveEndPosition(radius, outerAngle, -1);
        const outerExitDirR = calculateCurveExitDirection(outerAngle, -1);

        // Calculate arc length for the piece (use outer as reference)
        const arcLength = calculateArcLength(radius, outerAngle);

        this.addEntry({
            id: 'track.curved_point_right',
            name: 'Curved Point Right (R8075)',
            type: 'curved_switch',
            lengthM: arcLength,
            switchType: 'right',
            curveRadiusM: radius,
            curveAngleDeg: outerAngle,
            curveDirection: -1,
            innerAngleDeg: innerAngle,
            outerAngleDeg: outerAngle,
            connectorTemplates: [
                {
                    id: 'COMMON',
                    localPos: new Vector3(0, 0, 0),
                    localForward: new Vector3(-1, 0, 0)
                },
                {
                    id: 'INNER',  // 22.5° route (tighter turn)
                    localPos: innerEndPosR,
                    localForward: innerExitDirR
                },
                {
                    id: 'OUTER',  // 33.75° route (wider turn)
                    localPos: outerEndPosR,
                    localForward: outerExitDirR
                }
            ]
        });

        // Left-hand curved point (R8076) - curves left
        const innerEndPosL = calculateCurveEndPosition(radius, innerAngle, 1);
        const innerExitDirL = calculateCurveExitDirection(innerAngle, 1);
        const outerEndPosL = calculateCurveEndPosition(radius, outerAngle, 1);
        const outerExitDirL = calculateCurveExitDirection(outerAngle, 1);

        this.addEntry({
            id: 'track.curved_point_left',
            name: 'Curved Point Left (R8076)',
            type: 'curved_switch',
            lengthM: arcLength,
            switchType: 'left',
            curveRadiusM: radius,
            curveAngleDeg: outerAngle,
            curveDirection: 1,
            innerAngleDeg: innerAngle,
            outerAngleDeg: outerAngle,
            connectorTemplates: [
                {
                    id: 'COMMON',
                    localPos: new Vector3(0, 0, 0),
                    localForward: new Vector3(-1, 0, 0)
                },
                {
                    id: 'INNER',  // 22.5° route
                    localPos: innerEndPosL,
                    localForward: innerExitDirL
                },
                {
                    id: 'OUTER',  // 33.75° route
                    localPos: outerEndPosL,
                    localForward: outerExitDirL
                }
            ]
        });
    }

    // ========================================================================
    // DIAMOND CROSSINGS - R614/R615
    // ========================================================================

    /**
     * Initialize diamond crossing pieces
     * Allows two tracks to cross at 22.5° angle
     */
    private static initializeCrossings(): void {
        const crossingLength = HORNBY.DIAMOND_LENGTH_M;
        const crossAngle = HORNBY.DIAMOND_CROSS_ANGLE_DEG;
        const crossAngleRad = crossAngle * Math.PI / 180;

        // Calculate crossing dimensions
        // The crossing is roughly 168mm x 181mm at 22.5°
        const halfLength = crossingLength / 2;

        // Calculate the angled track endpoints
        // Main track runs along X axis
        // Crossing track runs at 22.5° angle
        const crossEndX = halfLength * Math.cos(crossAngleRad);
        const crossEndZ = halfLength * Math.sin(crossAngleRad);

        // Left-hand diamond crossing (R614)
        // Track A: straight through
        // Track B: crosses at 22.5° going left
        this.addEntry({
            id: 'track.diamond_crossing_left',
            name: 'Diamond Crossing LH (R614)',
            type: 'crossing',
            lengthM: crossingLength,
            crossingAngleDeg: crossAngle,
            connectorTemplates: [
                // Main track (straight through)
                {
                    id: 'A1',
                    localPos: new Vector3(-halfLength, 0, 0),
                    localForward: new Vector3(-1, 0, 0)
                },
                {
                    id: 'A2',
                    localPos: new Vector3(halfLength, 0, 0),
                    localForward: new Vector3(1, 0, 0)
                },
                // Crossing track (at 22.5° angle, going left)
                {
                    id: 'B1',
                    localPos: new Vector3(-crossEndX, 0, -crossEndZ),
                    localForward: new Vector3(-Math.cos(crossAngleRad), 0, -Math.sin(crossAngleRad))
                },
                {
                    id: 'B2',
                    localPos: new Vector3(crossEndX, 0, crossEndZ),
                    localForward: new Vector3(Math.cos(crossAngleRad), 0, Math.sin(crossAngleRad))
                }
            ]
        });

        // Right-hand diamond crossing (R615)
        // Track A: straight through
        // Track B: crosses at 22.5° going right
        this.addEntry({
            id: 'track.diamond_crossing_right',
            name: 'Diamond Crossing RH (R615)',
            type: 'crossing',
            lengthM: crossingLength,
            crossingAngleDeg: crossAngle,
            connectorTemplates: [
                // Main track (straight through)
                {
                    id: 'A1',
                    localPos: new Vector3(-halfLength, 0, 0),
                    localForward: new Vector3(-1, 0, 0)
                },
                {
                    id: 'A2',
                    localPos: new Vector3(halfLength, 0, 0),
                    localForward: new Vector3(1, 0, 0)
                },
                // Crossing track (at 22.5° angle, going right)
                {
                    id: 'B1',
                    localPos: new Vector3(-crossEndX, 0, crossEndZ),
                    localForward: new Vector3(-Math.cos(crossAngleRad), 0, Math.sin(crossAngleRad))
                },
                {
                    id: 'B2',
                    localPos: new Vector3(crossEndX, 0, -crossEndZ),
                    localForward: new Vector3(Math.cos(crossAngleRad), 0, -Math.sin(crossAngleRad))
                }
            ]
        });
    }

    // ========================================================================
    // CATALOG MANAGEMENT
    // ========================================================================

    /**
     * Add entry to catalog (internal use)
     */
    private static addEntry(entry: TrackCatalogEntry): void {
        this.entries.set(entry.id, entry);
    }

    /**
     * Get all catalog entries
     * @returns Array of all track piece definitions
     */
    static getAll(): TrackCatalogEntry[] {
        return Array.from(this.entries.values());
    }

    /**
     * Get entry by ID
     * @param id - Catalog ID to look up
     * @returns Track piece definition or undefined if not found
     */
    static get(id: string): TrackCatalogEntry | undefined {
        return this.entries.get(id);
    }

    /**
     * Get entries filtered by type
     * @param type - Type to filter by
     * @returns Array of matching track piece definitions
     */
    static getByType(type: 'straight' | 'curve' | 'switch' | 'crossing' | 'curved_switch'): TrackCatalogEntry[] {
        return this.getAll().filter(entry => entry.type === type);
    }

    /**
     * Get all switch-like entries (regular switches, curved switches, etc.)
     * @returns Array of all switch/point definitions
     */
    static getAllSwitches(): TrackCatalogEntry[] {
        return this.getAll().filter(entry =>
            entry.type === 'switch' || entry.type === 'curved_switch'
        );
    }

    /**
     * Get Hornby constants for external use
     * @returns Object containing Hornby OO gauge specifications
     */
    static getHornbySpecs(): typeof HORNBY {
        return { ...HORNBY };
    }
}