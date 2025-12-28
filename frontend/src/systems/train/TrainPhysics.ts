/**
 * TrainPhysics.ts - Physics simulation for train movement
 * 
 * Path: frontend/src/systems/train/TrainPhysics.ts
 * 
 * Provides realistic-feeling acceleration and deceleration for trains:
 * - DCC-style momentum simulation
 * - Target speed vs actual speed with gradual transitions
 * - Configurable acceleration/deceleration curves
 * - Emergency brake functionality
 * - Speed limits and direction control
 * 
 * The physics model aims for a satisfying "model railway controller" feel -
 * not full physics simulation, but smooth and controllable.
 * 
 * @module TrainPhysics
 * @author Model Railway Workbench
 * @version 1.0.0
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix for consistent log formatting */
const LOG_PREFIX = '[TrainPhysics]';

/**
 * Default physics configuration
 * These values are tuned for OO gauge scale feel
 */
export const DEFAULT_PHYSICS_CONFIG: TrainPhysicsConfig = {
    // Speed limits (in meters per second at OO scale)
    maxSpeedMps: 0.15,              // ~150mm/s max speed (reasonable for shunting)
    minSpeedMps: 0.005,             // 5mm/s - below this we consider stopped

    // Acceleration (meters per second squared)
    accelerationRate: 0.03,          // Time to reach max speed: ~5 seconds
    decelerationRate: 0.04,          // Normal braking - slightly faster than accel
    coastingDeceleration: 0.01,      // Natural slowdown when throttle at zero
    emergencyBrakeRate: 0.15,        // Emergency stop - quick but not instant

    // Momentum simulation
    momentumFactor: 0.85,            // How much momentum affects acceleration (0-1)
    throttleResponseDelay: 0.1,      // Seconds before throttle changes take effect

    // Direction change
    directionChangeThreshold: 0.002, // Must be below this speed to change direction
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Direction of travel
 */
export type TrainDirection = 'forward' | 'reverse' | 'stopped';

/**
 * Brake state
 */
export type BrakeState = 'released' | 'applied' | 'emergency';

/**
 * Physics configuration options
 */
export interface TrainPhysicsConfig {
    /** Maximum speed in meters per second */
    maxSpeedMps: number;

    /** Minimum speed threshold - below this is considered stopped */
    minSpeedMps: number;

    /** Acceleration rate in m/s² */
    accelerationRate: number;

    /** Normal deceleration rate in m/s² */
    decelerationRate: number;

    /** Deceleration when coasting (throttle at 0, no brake) */
    coastingDeceleration: number;

    /** Emergency brake deceleration rate in m/s² */
    emergencyBrakeRate: number;

    /** Momentum factor affecting acceleration smoothing (0-1) */
    momentumFactor: number;

    /** Delay before throttle changes take effect */
    throttleResponseDelay: number;

    /** Speed must be below this to change direction */
    directionChangeThreshold: number;
}

/**
 * Current physics state for debugging/display
 */
export interface TrainPhysicsState {
    /** Current actual speed in m/s */
    currentSpeedMps: number;

    /** Target speed based on throttle */
    targetSpeedMps: number;

    /** Current throttle position (0-1) */
    throttle: number;

    /** Current direction */
    direction: TrainDirection;

    /** Current brake state */
    brakeState: BrakeState;

    /** Is the train currently accelerating */
    isAccelerating: boolean;

    /** Is the train currently decelerating */
    isDecelerating: boolean;

    /** Is the train stopped */
    isStopped: boolean;

    /** Speed as percentage of max (0-100) */
    speedPercent: number;
}

// ============================================================================
// TRAIN PHYSICS CLASS
// ============================================================================

/**
 * TrainPhysics - Simulates realistic train movement physics
 * 
 * Provides a DCC-controller-like experience with momentum and smooth
 * acceleration/deceleration curves. The simulation runs independently
 * of the actual track positioning.
 * 
 * @example
 * ```typescript
 * const physics = new TrainPhysics();
 * physics.setThrottle(0.5);  // 50% throttle
 * physics.setDirection('forward');
 * 
 * // In update loop:
 * const deltaDistance = physics.update(deltaTimeSeconds);
 * // Move train along track by deltaDistance
 * ```
 */
export class TrainPhysics {
    // ========================================================================
    // PRIVATE STATE
    // ========================================================================

    /** Physics configuration */
    private config: TrainPhysicsConfig;

    /** Current actual speed in m/s (always positive) */
    private currentSpeed: number = 0;

    /** Target speed based on throttle (always positive) */
    private targetSpeed: number = 0;

    /** Current throttle position (0-1) */
    private throttle: number = 0;

    /** Buffered throttle (for response delay) */
    private bufferedThrottle: number = 0;

    /** Time since last throttle change */
    private throttleChangeTime: number = 0;

    /** Current direction of travel */
    private direction: TrainDirection = 'stopped';

    /** Requested direction (may differ during speed change) */
    private requestedDirection: TrainDirection = 'stopped';

    /** Current brake state */
    private brakeState: BrakeState = 'released';

    /** Accumulated time for smooth updates */
    private accumulatedTime: number = 0;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new TrainPhysics instance
     * @param config - Optional physics configuration (uses defaults if not provided)
     */
    constructor(config?: Partial<TrainPhysicsConfig>) {
        this.config = { ...DEFAULT_PHYSICS_CONFIG, ...config };
        console.log(`${LOG_PREFIX} Physics initialized with config:`, this.config);
    }

    // ========================================================================
    // PUBLIC CONTROL METHODS
    // ========================================================================

    /**
     * Set the throttle position
     * @param value - Throttle value from 0 (idle) to 1 (full)
     */
    setThrottle(value: number): void {
        // Clamp to valid range
        const clampedValue = Math.max(0, Math.min(1, value));

        if (clampedValue !== this.throttle) {
            this.throttle = clampedValue;
            this.throttleChangeTime = 0;
            console.log(`${LOG_PREFIX} Throttle set to ${(clampedValue * 100).toFixed(0)}%`);
        }
    }

    /**
     * Increase throttle by a step amount
     * @param step - Amount to increase (default 0.1 = 10%)
     */
    increaseThrottle(step: number = 0.1): void {
        this.setThrottle(this.throttle + step);
    }

    /**
     * Decrease throttle by a step amount
     * @param step - Amount to decrease (default 0.1 = 10%)
     */
    decreaseThrottle(step: number = 0.1): void {
        this.setThrottle(this.throttle - step);
    }

    /**
     * Get current throttle position
     * @returns Throttle value (0-1)
     */
    getThrottle(): number {
        return this.throttle;
    }

    /**
     * Set the desired direction of travel
     * Direction change only takes effect when speed is low enough
     * @param dir - Desired direction
     * @returns true if direction was set, false if must slow down first
     */
    setDirection(dir: TrainDirection): boolean {
        this.requestedDirection = dir;

        // Can only change direction when nearly stopped
        if (this.currentSpeed <= this.config.directionChangeThreshold) {
            if (this.direction !== dir) {
                this.direction = dir;
                console.log(`${LOG_PREFIX} Direction changed to: ${dir}`);
            }
            return true;
        } else {
            console.log(`${LOG_PREFIX} Direction change requested (${dir}) - waiting for train to slow`);
            return false;
        }
    }

    /**
     * Toggle direction (forward <-> reverse)
     * Only works when stopped or nearly stopped
     * @returns true if direction was toggled
     */
    toggleDirection(): boolean {
        const newDir = this.direction === 'forward' ? 'reverse' : 'forward';
        return this.setDirection(newDir);
    }

    /**
     * Get current direction
     * @returns Current direction
     */
    getDirection(): TrainDirection {
        return this.direction;
    }

    /**
     * Get requested direction (may differ from current if train is slowing)
     * @returns Requested direction
     */
    getRequestedDirection(): TrainDirection {
        return this.requestedDirection;
    }

    /**
     * Apply normal brakes
     * Sets target speed to zero with normal deceleration
     */
    applyBrake(): void {
        if (this.brakeState !== 'applied') {
            this.brakeState = 'applied';
            this.throttle = 0;
            console.log(`${LOG_PREFIX} Brakes applied`);
        }
    }

    /**
     * Release brakes
     */
    releaseBrake(): void {
        if (this.brakeState !== 'released') {
            this.brakeState = 'released';
            console.log(`${LOG_PREFIX} Brakes released`);
        }
    }

    /**
     * Apply emergency brake
     * Much faster deceleration than normal braking
     */
    emergencyBrake(): void {
        this.brakeState = 'emergency';
        this.throttle = 0;
        console.log(`${LOG_PREFIX} EMERGENCY BRAKE!`);
    }

    /**
     * Get current brake state
     * @returns Current brake state
     */
    getBrakeState(): BrakeState {
        return this.brakeState;
    }

    /**
     * Immediately stop the train (for collisions, derailments, etc.)
     */
    emergencyStop(): void {
        this.currentSpeed = 0;
        this.targetSpeed = 0;
        this.throttle = 0;
        this.brakeState = 'emergency';
        this.direction = 'stopped';
        console.log(`${LOG_PREFIX} Emergency stop - train halted`);
    }

    /**
     * Reset physics state (for repositioning train)
     */
    reset(): void {
        this.currentSpeed = 0;
        this.targetSpeed = 0;
        this.throttle = 0;
        this.bufferedThrottle = 0;
        this.brakeState = 'released';
        this.direction = 'stopped';
        this.requestedDirection = 'stopped';
        this.throttleChangeTime = 0;
        this.accumulatedTime = 0;
        console.log(`${LOG_PREFIX} Physics reset`);
    }

    // ========================================================================
    // UPDATE LOOP
    // ========================================================================

    /**
     * Update physics simulation
     * Call this every frame with the time since last frame
     * 
     * @param deltaTimeSeconds - Time elapsed since last update in seconds
     * @returns Distance to move along track (positive = forward relative to direction)
     */
    update(deltaTimeSeconds: number): number {
        // Cap delta time to prevent huge jumps
        const dt = Math.min(deltaTimeSeconds, 0.1);

        // Update throttle response delay
        this.throttleChangeTime += dt;
        if (this.throttleChangeTime >= this.config.throttleResponseDelay) {
            this.bufferedThrottle = this.throttle;
        } else {
            // Smooth interpolation toward target throttle
            const t = this.throttleChangeTime / this.config.throttleResponseDelay;
            this.bufferedThrottle = this.bufferedThrottle + (this.throttle - this.bufferedThrottle) * t;
        }

        // Calculate target speed from throttle
        this.targetSpeed = this.bufferedThrottle * this.config.maxSpeedMps;

        // Apply braking logic
        if (this.brakeState !== 'released') {
            this.targetSpeed = 0;
        }

        // Calculate acceleration/deceleration
        const speedDiff = this.targetSpeed - this.currentSpeed;
        let acceleration = 0;

        if (Math.abs(speedDiff) > 0.0001) {
            if (speedDiff > 0) {
                // Accelerating
                acceleration = this.config.accelerationRate;
            } else {
                // Decelerating
                if (this.brakeState === 'emergency') {
                    acceleration = -this.config.emergencyBrakeRate;
                } else if (this.brakeState === 'applied') {
                    acceleration = -this.config.decelerationRate;
                } else if (this.throttle < 0.01) {
                    // Coasting (no throttle, no brake)
                    acceleration = -this.config.coastingDeceleration;
                } else {
                    // Reducing throttle
                    acceleration = -this.config.decelerationRate * 0.5;
                }
            }

            // Apply momentum smoothing
            acceleration *= (1 - this.config.momentumFactor * 0.5);
        }

        // Update speed
        this.currentSpeed += acceleration * dt;

        // Clamp speed
        this.currentSpeed = Math.max(0, Math.min(this.currentSpeed, this.config.maxSpeedMps));

        // Check if stopped
        if (this.currentSpeed < this.config.minSpeedMps && this.targetSpeed === 0) {
            this.currentSpeed = 0;

            // Check for pending direction change
            if (this.requestedDirection !== this.direction && this.requestedDirection !== 'stopped') {
                this.direction = this.requestedDirection;
                console.log(`${LOG_PREFIX} Direction now: ${this.direction}`);
            }

            // Release emergency brake once stopped
            if (this.brakeState === 'emergency') {
                this.brakeState = 'released';
            }
        }

        // Update direction state if speed is zero
        if (this.currentSpeed === 0 && this.direction !== 'stopped' && this.throttle === 0) {
            // Keep direction set for quick restart, but mark as functionally stopped
        }

        // Calculate distance traveled
        const distance = this.currentSpeed * dt;

        // Return signed distance based on direction
        if (this.direction === 'reverse') {
            return -distance;
        }
        return distance;
    }

    // ========================================================================
    // STATE QUERIES
    // ========================================================================

    /**
     * Get current speed in meters per second
     * @returns Current speed (always positive)
     */
    getCurrentSpeedMps(): number {
        return this.currentSpeed;
    }

    /**
     * Get current speed as percentage of max
     * @returns Speed percentage (0-100)
     */
    getSpeedPercent(): number {
        return (this.currentSpeed / this.config.maxSpeedMps) * 100;
    }

    /**
     * Check if train is stopped
     * @returns true if speed is below minimum threshold
     */
    isStopped(): boolean {
        return this.currentSpeed < this.config.minSpeedMps;
    }

    /**
     * Check if train is accelerating
     * @returns true if currently accelerating
     */
    isAccelerating(): boolean {
        return this.currentSpeed < this.targetSpeed && !this.isStopped();
    }

    /**
     * Check if train is decelerating
     * @returns true if currently decelerating
     */
    isDecelerating(): boolean {
        return this.currentSpeed > this.targetSpeed;
    }

    /**
     * Get complete physics state for debugging/display
     * @returns Current physics state
     */
    getState(): TrainPhysicsState {
        return {
            currentSpeedMps: this.currentSpeed,
            targetSpeedMps: this.targetSpeed,
            throttle: this.throttle,
            direction: this.direction,
            brakeState: this.brakeState,
            isAccelerating: this.isAccelerating(),
            isDecelerating: this.isDecelerating(),
            isStopped: this.isStopped(),
            speedPercent: this.getSpeedPercent()
        };
    }

    /**
     * Get physics configuration
     * @returns Current configuration
     */
    getConfig(): TrainPhysicsConfig {
        return { ...this.config };
    }

    /**
     * Update physics configuration
     * @param updates - Partial config updates
     */
    updateConfig(updates: Partial<TrainPhysicsConfig>): void {
        this.config = { ...this.config, ...updates };
        console.log(`${LOG_PREFIX} Config updated:`, updates);
    }
}