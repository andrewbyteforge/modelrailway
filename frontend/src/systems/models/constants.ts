/**
 * constants.ts - Centralized OO gauge constants
 * Path: frontend/src/systems/models/constants.ts
 */

export const OO_GAUGE = {
    /** Scale ratio 1:76.2 */
    SCALE_RATIO: 76.2,

    /** Track gauge (16.5mm) */
    TRACK_GAUGE_M: 0.0165,
    TRACK_GAUGE_MM: 16.5,

    /** Rail height above sleepers (3mm) */
    RAIL_HEIGHT_M: 0.003,

    /** Convert real-world to OO scale */
    realToScale: (realMeters: number): number => realMeters / 76.2,

    /** Convert OO scale to real-world */
    scaleToReal: (scaleMeters: number): number => scaleMeters * 76.2
} as const;

export const TRACK_GEOMETRY = {
    /** Baseboard surface Y coordinate */
    BASEBOARD_TOP_Y: 0.950,

    /** Ballast height (3mm) */
    BALLAST_HEIGHT_M: 0.003,

    /** Sleeper height (2mm) */
    SLEEPER_HEIGHT_M: 0.002,

    /** Rail height (3mm) */
    RAIL_HEIGHT_M: 0.003,

    /** Total offset from baseboard to rail top (8mm) */
    RAIL_TOP_OFFSET_M: 0.008,

    /** Absolute Y of rail top surface */
    get RAIL_TOP_Y(): number {
        return this.BASEBOARD_TOP_Y + this.RAIL_TOP_OFFSET_M;
    }
} as const;