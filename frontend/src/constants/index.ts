/**
 * Railway Constants - Unified constants for Model Railway Workbench
 * 
 * Path: frontend/src/constants/index.ts
 * 
 * This file consolidates all railway-related constants that were previously
 * duplicated across multiple files. Import from here to ensure consistency.
 * 
 * PREVIOUSLY DUPLICATED IN:
 * - ModelScaleHelper.ts (OO_GAUGE)
 * - TrackModelPlacer.ts (OO_GAUGE - different values!)
 * - ModelSystem.ts (TRACK_GEOMETRY)
 * - RollingStockPlacer.ts (RAIL_HEIGHT)
 * - ModelScaleDebug.ts (RAIL_TOP_HEIGHT)
 * - TrainSystem.ts (TRAIN_KEYWORDS, PARTIAL_TRAIN_KEYWORDS)
 * - TrainIntegration.ts (ROLLING_STOCK_KEYWORDS, PARTIAL_KEYWORDS)
 * 
 * @module constants
 * @author Model Railway Workbench
 * @version 1.0.0
 */

// ============================================================================
// OO GAUGE SCALE CONSTANTS
// ============================================================================

/**
 * OO Gauge standard values
 * 
 * OO gauge is the most popular model railway scale in the UK.
 * Scale ratio is 1:76.2 (4mm = 1 foot)
 * 
 * @example
 * ```typescript
 * import { OO_GAUGE } from '../constants';
 * 
 * // Convert real-world 17.5m locomotive to OO scale
 * const ooLength = OO_GAUGE.realToScale(17.5); // ~0.230m (230mm)
 * ```
 */
export const OO_GAUGE = {
    // ========================================================================
    // SCALE RATIO
    // ========================================================================

    /** Scale ratio - divide real-world measurements by this to get OO scale */
    SCALE_RATIO: 76.2,

    /** Scale ratio as fraction (1:76.2) */
    SCALE_FRACTION: 1 / 76.2,

    // ========================================================================
    // TRACK GAUGE
    // ========================================================================

    /** Track gauge in meters (16.5mm) - distance between rail inner edges */
    TRACK_GAUGE_M: 0.0165,

    /** Track gauge in millimeters */
    TRACK_GAUGE_MM: 16.5,

    // ========================================================================
    // RAIL DIMENSIONS
    // ========================================================================

    /** Rail height above sleeper surface in meters (3mm) */
    RAIL_HEIGHT_M: 0.003,

    /** Rail head width in meters (~2mm for OO) */
    RAIL_HEAD_WIDTH_M: 0.002,

    // ========================================================================
    // CONVERSION FUNCTIONS
    // ========================================================================

    /**
     * Convert real-world meters to OO scale meters
     * @param realMeters - Real-world measurement in meters
     * @returns OO scale measurement in meters
     * 
     * @example
     * OO_GAUGE.realToScale(17.5) // 17.5m loco → 0.230m (230mm)
     */
    realToScale: (realMeters: number): number => realMeters / 76.2,

    /**
     * Convert OO scale meters to real-world meters
     * @param scaleMeters - OO scale measurement in meters
     * @returns Real-world measurement in meters
     * 
     * @example
     * OO_GAUGE.scaleToReal(0.230) // 230mm model → 17.5m real
     */
    scaleToReal: (scaleMeters: number): number => scaleMeters * 76.2,

    /**
     * Convert millimeters to meters
     * @param mm - Measurement in millimeters
     * @returns Measurement in meters
     */
    mmToM: (mm: number): number => mm / 1000,

    /**
     * Convert meters to millimeters
     * @param m - Measurement in meters
     * @returns Measurement in millimeters
     */
    mToMm: (m: number): number => m * 1000,

} as const;


// ============================================================================
// TRACK GEOMETRY CONSTANTS
// ============================================================================

/**
 * Track geometry constants for the 3D scene
 * 
 * These define the physical layout heights in the Babylon.js scene.
 * All values are in meters (Babylon.js default unit).
 * 
 * Layer stack from bottom to top:
 * 1. Baseboard surface (Y = 0.950m)
 * 2. Ballast (3mm)
 * 3. Sleepers (2mm) 
 * 4. Rails (3mm)
 * 5. Rail top surface (Y = 0.958m)
 * 
 * @example
 * ```typescript
 * import { TRACK_GEOMETRY } from '../constants';
 * 
 * // Position a train on the rails
 * train.position.y = TRACK_GEOMETRY.RAIL_TOP_Y;
 * ```
 */
export const TRACK_GEOMETRY = {
    // ========================================================================
    // VERTICAL POSITIONS (Y-axis in scene)
    // ========================================================================

    /** Baseboard surface Y coordinate in scene */
    BASEBOARD_TOP_Y: 0.950,

    // ========================================================================
    // LAYER HEIGHTS (thickness of each layer)
    // ========================================================================

    /** Ballast layer height above baseboard (3mm) */
    BALLAST_HEIGHT_M: 0.003,

    /** Sleeper height above ballast (2mm) */
    SLEEPER_HEIGHT_M: 0.002,

    /** Rail height above sleepers (3mm) */
    RAIL_HEIGHT_M: 0.003,

    // ========================================================================
    // COMPUTED OFFSETS
    // ========================================================================

    /** Total offset from baseboard surface to rail top (8mm) */
    RAIL_TOP_OFFSET_M: 0.008,

    /** Offset from baseboard to sleeper top (5mm) */
    SLEEPER_TOP_OFFSET_M: 0.005,

    /** Offset from baseboard to ballast top (3mm) */
    BALLAST_TOP_OFFSET_M: 0.003,

    // ========================================================================
    // ABSOLUTE Y COORDINATES
    // ========================================================================

    /**
     * Absolute Y coordinate of rail top surface
     * This is where train wheels should sit
     */
    get RAIL_TOP_Y(): number {
        return this.BASEBOARD_TOP_Y + this.RAIL_TOP_OFFSET_M;
    },

    /**
     * Absolute Y coordinate of sleeper top surface
     */
    get SLEEPER_TOP_Y(): number {
        return this.BASEBOARD_TOP_Y + this.SLEEPER_TOP_OFFSET_M;
    },

    /**
     * Absolute Y coordinate of ballast top surface
     */
    get BALLAST_TOP_Y(): number {
        return this.BASEBOARD_TOP_Y + this.BALLAST_TOP_OFFSET_M;
    },

    // ========================================================================
    // TRACK PIECE DIMENSIONS
    // ========================================================================

    /** Standard sleeper spacing in meters (~26mm for OO) */
    SLEEPER_SPACING_M: 0.026,

    /** Sleeper length in meters (~38mm for OO) */
    SLEEPER_LENGTH_M: 0.038,

    /** Sleeper width in meters (~8mm for OO) */
    SLEEPER_WIDTH_M: 0.008,

} as const;


// ============================================================================
// ROLLING STOCK KEYWORDS
// ============================================================================

/**
 * Keywords used to identify rolling stock models
 * 
 * These are checked against model filenames and mesh names to automatically
 * detect trains for registration with the train control system.
 * 
 * Includes British railway terminology (OO gauge focus).
 * 
 * @example
 * ```typescript
 * import { ROLLING_STOCK_KEYWORDS } from '../constants';
 * 
 * const isRollingStock = ROLLING_STOCK_KEYWORDS.some(kw => 
 *     filename.toLowerCase().includes(kw)
 * );
 * ```
 */
export const ROLLING_STOCK_KEYWORDS = [
    // ========================================================================
    // LOCOMOTIVES - General
    // ========================================================================
    'train',
    'loco',
    'locomotive',
    'engine',
    'diesel',
    'steam',
    'electric',
    'shunter',
    'railcar',
    'tender',

    // ========================================================================
    // LOCOMOTIVES - UK Multiple Units
    // ========================================================================
    'hst',          // High Speed Train (InterCity 125)
    'dmu',          // Diesel Multiple Unit
    'emu',          // Electric Multiple Unit
    'class',        // Often precedes class number (Class 66, etc.)

    // ========================================================================
    // LOCOMOTIVES - UK Tank Engines
    // ========================================================================
    'pannier',      // GWR pannier tanks
    'tank',         // Tank engines (no tender)
    'saddle',       // Saddle tank

    // ========================================================================
    // LOCOMOTIVES - Famous UK Classes
    // ========================================================================
    'deltic',       // Class 55 Deltic
    'warship',      // Class 42/43 Warship
    'western',      // Class 52 Western
    'hymek',        // Class 35 Hymek
    'peak',         // Class 44/45/46 Peak
    'britannia',    // BR Standard Class 7
    'merchant',     // Merchant Navy class
    'castle',       // GWR Castle class
    'king',         // GWR King class
    'a4',           // LNER A4 (Mallard etc.)
    'a3',           // LNER A3 (Flying Scotsman etc.)

    // ========================================================================
    // PASSENGER COACHES
    // ========================================================================
    'coach',
    'carriage',
    'passenger',
    'buffet',
    'restaurant',
    'sleeper',
    'pullman',

    // ========================================================================
    // PASSENGER COACHES - UK Mark Series
    // ========================================================================
    'mk1',          // BR Mark 1
    'mk2',          // BR Mark 2
    'mk3',          // BR Mark 3
    'mk4',          // BR Mark 4

    // ========================================================================
    // FREIGHT WAGONS - General
    // ========================================================================
    'wagon',
    'freight',
    'goods',
    'tanker',
    'hopper',
    'boxcar',
    'van',
    'open',
    'flatbed',

    // ========================================================================
    // FREIGHT WAGONS - UK Specific Types
    // ========================================================================
    'coal',         // Coal wagons
    'mineral',      // Mineral wagons  
    'plank',        // Plank wagons
    'lowmac',       // Low machinery wagon
    'conflat',      // Container flat
    'bolster',      // Bolster wagon
    'brake',        // Brake van

    // ========================================================================
    // GUARD'S/BRAKE VANS
    // ========================================================================
    'guards',
    'brake-van',
    'brakevan',
    'caboose',      // US terminology

    // ========================================================================
    // COMPONENTS/PARTS
    // ========================================================================
    'bogie',
    'chassis',
    'coupling',

] as const;

/** Type for rolling stock keywords */
export type RollingStockKeyword = typeof ROLLING_STOCK_KEYWORDS[number];


/**
 * Partial keywords for catching truncated model names
 * 
 * GLB/GLTF importers often truncate filenames. These partial matches
 * help catch names like "Locom" for "Locomotive".
 * 
 * Keep these short (4-6 chars) to catch truncations but not too short
 * to avoid false positives.
 */
export const PARTIAL_KEYWORDS = [
    'loco',         // Locomotive, Locom
    'engin',        // Engine, Engines
    'coach',        // Coach, Coaching
    'wagon',        // Wagon, Wagons
    'freigh',       // Freight
    'tank',         // Tanker, Tank
    'hopp',         // Hopper
    'train',        // Train, Trains
    'diesel',       // Diesel
    'steam',        // Steamer, Steam
    'electr',       // Electric, Electro
    'carriag',      // Carriage
    'passeng',      // Passenger
    'railc',        // Railcar
    'tend',         // Tender
    'shunt',        // Shunter
] as const;


// ============================================================================
// ROLLING STOCK TARGET DIMENSIONS
// ============================================================================

/**
 * Target dimensions for OO gauge rolling stock
 * 
 * These are the DESIRED final dimensions after scaling imported models.
 * Used by the scale helper to calculate correct scale factors.
 * 
 * All dimensions in meters (scene units).
 * 
 * @example
 * ```typescript
 * import { OO_ROLLING_STOCK_TARGETS } from '../constants';
 * 
 * const target = OO_ROLLING_STOCK_TARGETS.locomotive;
 * const scaleFactor = target.lengthM / modelLength;
 * ```
 */
export const OO_ROLLING_STOCK_TARGETS = {
    /** Diesel/electric locomotive - typically 200-280mm */
    locomotive: {
        lengthM: 0.230,     // 230mm - mid-range locomotive
        heightM: 0.050,     // 50mm
        widthM: 0.032,      // 32mm
        description: 'Standard diesel/electric locomotive',
        realWorldLengthM: 17.5,  // ~17.5m prototype
    },

    /** Steam locomotive - typically 180-240mm */
    steam_locomotive: {
        lengthM: 0.200,     // 200mm
        heightM: 0.045,     // 45mm (to chimney top)
        widthM: 0.028,      // 28mm
        description: 'Steam locomotive',
        realWorldLengthM: 15.0,  // ~15m prototype
    },

    /** Large steam locomotive with tender */
    steam_with_tender: {
        lengthM: 0.280,     // 280mm (loco + tender)
        heightM: 0.048,     // 48mm
        widthM: 0.030,      // 30mm
        description: 'Large steam locomotive with tender',
        realWorldLengthM: 21.0,
    },

    /** Passenger coach - typically 260-305mm */
    coach: {
        lengthM: 0.275,     // 275mm - Mk3 coach
        heightM: 0.045,     // 45mm
        widthM: 0.030,      // 30mm
        description: 'Passenger coach/carriage',
        realWorldLengthM: 23.0,  // Mk3 = 23m
    },

    /** Short passenger coach (Mk1 etc) */
    coach_short: {
        lengthM: 0.250,     // 250mm
        heightM: 0.043,     // 43mm
        widthM: 0.029,      // 29mm
        description: 'Short passenger coach (Mk1/Mk2)',
        realWorldLengthM: 19.0,
    },

    /** Freight wagon - typically 100-150mm */
    wagon: {
        lengthM: 0.120,     // 120mm
        heightM: 0.040,     // 40mm
        widthM: 0.028,      // 28mm
        description: 'Standard freight wagon',
        realWorldLengthM: 9.0,
    },

    /** Long freight wagon */
    wagon_long: {
        lengthM: 0.160,     // 160mm
        heightM: 0.042,     // 42mm
        widthM: 0.030,      // 30mm
        description: 'Long freight wagon',
        realWorldLengthM: 12.0,
    },

    /** Tank wagon */
    tanker: {
        lengthM: 0.130,     // 130mm
        heightM: 0.045,     // 45mm (taller due to tank)
        widthM: 0.030,      // 30mm
        description: 'Tank wagon',
        realWorldLengthM: 10.0,
    },

    /** Container/intermodal - 20ft container scaled */
    container: {
        lengthM: 0.080,     // 80mm
        heightM: 0.034,     // 34mm
        widthM: 0.032,      // 32mm
        description: '20ft shipping container',
        realWorldLengthM: 6.1,  // 20ft = 6.1m
    },

    /** 40ft container */
    container_40ft: {
        lengthM: 0.160,     // 160mm
        heightM: 0.034,     // 34mm
        widthM: 0.032,      // 32mm
        description: '40ft shipping container',
        realWorldLengthM: 12.2,  // 40ft = 12.2m
    },

    /** Brake van / Guard's van */
    brake_van: {
        lengthM: 0.100,     // 100mm
        heightM: 0.042,     // 42mm
        widthM: 0.028,      // 28mm
        description: "Brake van / Guard's van",
        realWorldLengthM: 7.5,
    },

} as const;

/** Rolling stock type identifier */
export type RollingStockType = keyof typeof OO_ROLLING_STOCK_TARGETS;


// ============================================================================
// REAL-WORLD REFERENCE DIMENSIONS
// ============================================================================

/**
 * Reference dimensions for real-world objects
 * 
 * Used when the user knows what a model represents and wants to
 * calculate the correct scale factor based on real-world size.
 * 
 * All values in meters (real-world).
 */
export const REFERENCE_DIMENSIONS = {
    // ========================================================================
    // RAILWAY ROLLING STOCK
    // ========================================================================
    'loco_diesel': { realM: 17.5, description: 'Diesel locomotive (~17.5m)' },
    'loco_electric': { realM: 19.0, description: 'Electric locomotive (~19m)' },
    'loco_steam': { realM: 15.0, description: 'Steam locomotive (~15m)' },
    'loco_steam_large': { realM: 21.0, description: 'Large steam loco + tender (~21m)' },

    'coach_mk1': { realM: 19.0, description: 'BR Mk1 coach (19m)' },
    'coach_mk2': { realM: 20.0, description: 'BR Mk2 coach (20m)' },
    'coach_mk3': { realM: 23.0, description: 'BR Mk3 coach (23m)' },
    'coach_mk4': { realM: 23.0, description: 'BR Mk4 coach (23m)' },
    'coach_standard': { realM: 21.0, description: 'Standard coach (~21m)' },

    'wagon_standard': { realM: 9.0, description: 'Standard freight wagon (~9m)' },
    'wagon_long': { realM: 12.0, description: 'Long freight wagon (~12m)' },
    'wagon_tank': { realM: 10.0, description: 'Tank wagon (~10m)' },

    // ========================================================================
    // SCENERY - PEOPLE & VEHICLES
    // ========================================================================
    'figure_adult': { realM: 1.75, description: 'Adult figure (1.75m)' },
    'figure_child': { realM: 1.2, description: 'Child figure (1.2m)' },

    'car_small': { realM: 4.0, description: 'Small car (~4m)' },
    'car_medium': { realM: 4.5, description: 'Medium car (~4.5m)' },
    'car_large': { realM: 5.0, description: 'Large car/SUV (~5m)' },
    'van_small': { realM: 5.0, description: 'Small van (~5m)' },
    'van_large': { realM: 6.0, description: 'Large van (~6m)' },
    'bus_single': { realM: 12.0, description: 'Single-deck bus (~12m)' },
    'bus_double': { realM: 10.5, description: 'Double-deck bus (~10.5m)' },
    'lorry_small': { realM: 8.0, description: 'Small lorry (~8m)' },
    'lorry_large': { realM: 12.0, description: 'Large lorry (~12m)' },

    // ========================================================================
    // SCENERY - NATURE
    // ========================================================================
    'tree_small': { realM: 5.0, description: 'Small tree (~5m)' },
    'tree_medium': { realM: 10.0, description: 'Medium tree (~10m)' },
    'tree_large': { realM: 15.0, description: 'Large tree (~15m)' },
    'tree_xlarge': { realM: 20.0, description: 'Very large tree (~20m)' },
    'bush': { realM: 1.5, description: 'Bush/shrub (~1.5m)' },
    'hedge': { realM: 2.0, description: 'Hedge (~2m)' },

    // ========================================================================
    // SCENERY - BUILDINGS
    // ========================================================================
    'building_house': { realM: 8.0, description: 'House height (~8m)' },
    'building_bungalow': { realM: 5.0, description: 'Bungalow height (~5m)' },
    'building_shop': { realM: 10.0, description: 'Shop/retail (~10m)' },
    'building_station': { realM: 6.0, description: 'Station building (~6m)' },
    'building_factory': { realM: 12.0, description: 'Factory building (~12m)' },
    'building_warehouse': { realM: 8.0, description: 'Warehouse (~8m)' },
    'door_standard': { realM: 2.1, description: 'Standard door (2.1m)' },
    'window_standard': { realM: 1.2, description: 'Standard window (1.2m)' },

    // ========================================================================
    // RAILWAY INFRASTRUCTURE
    // ========================================================================
    'platform': { realM: 0.9, description: 'Platform height (0.9m)' },
    'platform_canopy': { realM: 4.0, description: 'Platform canopy height (~4m)' },
    'signal_post': { realM: 4.0, description: 'Signal post (~4m)' },
    'signal_gantry': { realM: 6.0, description: 'Signal gantry (~6m)' },
    'lamp_post': { realM: 5.0, description: 'Street lamp (~5m)' },
    'lamp_platform': { realM: 3.5, description: 'Platform lamp (~3.5m)' },
    'fence_panel': { realM: 1.8, description: 'Fence panel height (1.8m)' },
    'wall_garden': { realM: 2.0, description: 'Garden wall (~2m)' },
    'footbridge': { realM: 5.5, description: 'Footbridge clearance (~5.5m)' },
    'overbridge': { realM: 5.5, description: 'Road overbridge clearance (~5.5m)' },

} as const;

/** Reference dimension key */
export type ReferenceDimensionKey = keyof typeof REFERENCE_DIMENSIONS;


// ============================================================================
// HORNBY TRACK PIECE DIMENSIONS
// ============================================================================

/**
 * Hornby OO gauge track piece specifications
 * 
 * Standard Hornby track dimensions for planning layouts.
 * All dimensions in meters.
 */
export const HORNBY_TRACK = {
    // ========================================================================
    // STRAIGHT TRACKS
    // ========================================================================

    /** Standard straight (168mm) */
    STRAIGHT_STANDARD_M: 0.168,

    /** Double straight (335mm) */
    STRAIGHT_DOUBLE_M: 0.335,

    /** Half straight (84mm) */
    STRAIGHT_HALF_M: 0.084,

    /** Quarter straight (42mm) */
    STRAIGHT_QUARTER_M: 0.042,

    // ========================================================================
    // CURVED TRACKS - RADII
    // ========================================================================

    /** First radius curve (371mm) - tightest standard curve */
    RADIUS_R1_M: 0.371,

    /** Second radius curve (438mm) */
    RADIUS_R2_M: 0.438,

    /** Third radius curve (505mm) */
    RADIUS_R3_M: 0.505,

    /** Fourth radius curve (572mm) */
    RADIUS_R4_M: 0.572,

    // ========================================================================
    // CURVED TRACKS - ANGLES
    // ========================================================================

    /** Standard curve angle (22.5°) - 16 make a circle */
    CURVE_ANGLE_DEG: 22.5,

    /** Half curve angle (11.25°) */
    CURVE_HALF_ANGLE_DEG: 11.25,

    // ========================================================================
    // POINTS/SWITCHES
    // ========================================================================

    /** Standard point length (~168mm) */
    POINT_LENGTH_M: 0.168,

    /** Point diverging angle (~22.5°) */
    POINT_ANGLE_DEG: 22.5,

} as const;


// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a name contains rolling stock keywords
 * 
 * @param name - Name to check (filename, mesh name, etc.)
 * @returns true if name suggests rolling stock
 * 
 * @example
 * ```typescript
 * import { isRollingStockName } from '../constants';
 * 
 * if (isRollingStockName(model.name)) {
 *     // Register with train system
 * }
 * ```
 */
export function isRollingStockName(name: string): boolean {
    const lower = name.toLowerCase();

    // Check full keywords
    const fullMatch = ROLLING_STOCK_KEYWORDS.some(keyword =>
        lower.includes(keyword)
    );
    if (fullMatch) return true;

    // Check partial keywords (for truncated names)
    const partialMatch = PARTIAL_KEYWORDS.some(partial =>
        lower.includes(partial)
    );

    return partialMatch;
}


/**
 * Detect rolling stock category from name
 * 
 * @param name - Name to analyze
 * @returns Detected category
 */
export function detectRollingStockCategory(
    name: string
): 'locomotive' | 'coach' | 'wagon' | 'other' {
    const lower = name.toLowerCase();

    // Locomotive keywords
    const locoKeywords = [
        'loco', 'locomotive', 'engine', 'diesel', 'steam', 'electric',
        'class', 'hst', 'dmu', 'emu', 'shunter', 'pannier', 'tank',
        'deltic', 'warship', 'western', 'hymek', 'peak', 'britannia',
        'merchant', 'castle', 'king', 'a4', 'a3', 'railcar'
    ];

    if (locoKeywords.some(k => lower.includes(k))) {
        return 'locomotive';
    }

    // Coach keywords
    const coachKeywords = [
        'coach', 'carriage', 'passenger', 'buffet', 'restaurant',
        'mk1', 'mk2', 'mk3', 'mk4', 'pullman', 'sleeper'
    ];

    if (coachKeywords.some(k => lower.includes(k))) {
        return 'coach';
    }

    // Wagon keywords
    const wagonKeywords = [
        'wagon', 'freight', 'goods', 'tanker', 'hopper', 'boxcar', 'van',
        'coal', 'mineral', 'plank', 'lowmac', 'conflat', 'flatbed',
        'guards', 'brake-van', 'brakevan', 'caboose', 'bolster'
    ];

    if (wagonKeywords.some(k => lower.includes(k))) {
        return 'wagon';
    }

    return 'other';
}


/**
 * Get target dimensions for a rolling stock type
 * 
 * @param type - Rolling stock type
 * @returns Target dimensions or undefined
 */
export function getRollingStockTarget(
    type: RollingStockType
): typeof OO_ROLLING_STOCK_TARGETS[RollingStockType] | undefined {
    return OO_ROLLING_STOCK_TARGETS[type];
}


/**
 * Get reference dimension for a known object type
 * 
 * @param key - Reference dimension key
 * @returns Reference dimension or undefined
 */
export function getReferenceDimension(
    key: ReferenceDimensionKey
): typeof REFERENCE_DIMENSIONS[ReferenceDimensionKey] | undefined {
    return REFERENCE_DIMENSIONS[key];
}


/**
 * Calculate scale factor to achieve target OO scale size
 * 
 * @param modelSizeM - Current model size in meters
 * @param realWorldSizeM - Real-world size this should represent
 * @returns Scale factor to apply
 * 
 * @example
 * ```typescript
 * // Model is 2m in file, should represent 17.5m locomotive
 * const scale = calculateScaleFactor(2.0, 17.5);
 * // scale ≈ 0.115 (results in 230mm OO scale model)
 * ```
 */
export function calculateScaleFactor(
    modelSizeM: number,
    realWorldSizeM: number
): number {
    if (modelSizeM <= 0) return 1;

    // Target OO scale size
    const targetSizeM = OO_GAUGE.realToScale(realWorldSizeM);

    // Scale factor = target / current
    return targetSizeM / modelSizeM;
}


// ============================================================================
// TYPE EXPORTS FOR CONVENIENCE
// ============================================================================

export type {
    RollingStockKeyword,
    RollingStockType,
    ReferenceDimensionKey,
};