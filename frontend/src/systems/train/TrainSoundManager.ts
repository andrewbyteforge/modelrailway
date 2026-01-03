/**
 * TrainSoundManager.ts - Audio management for train sounds
 * 
 * Path: frontend/src/systems/train/TrainSoundManager.ts
 * 
 * Handles all audio for train operations:
 * - Horn/whistle sounds
 * - Movement/wheel sounds
 * - Points clicking (when changed)
 * - Coupling/uncoupling sounds
 * 
 * Uses Web Audio API for low-latency, controllable audio.
 * Generates sounds procedurally when audio files aren't available,
 * with support for loading custom audio files.
 * 
 * @module TrainSoundManager
 * @author Model Railway Workbench
 * @version 1.0.0
 */

import { Scene } from '@babylonjs/core/scene';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Logging prefix */
const LOG_PREFIX = '[TrainSoundManager]';

/** Default volume levels */
const DEFAULT_VOLUMES = {
    horn: 0.3,
    movement: 0.15,
    points: 0.2,
    coupling: 0.25
};

/** Horn frequencies for two-tone horn (Hz) */
const HORN_FREQUENCIES = {
    low: 277.18,   // C#4
    high: 349.23   // F4
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Sound categories
 */
export type SoundCategory = 'horn' | 'movement' | 'points' | 'coupling';

/**
 * Sound configuration
 */
export interface SoundConfig {
    /** Master volume (0-1) */
    masterVolume: number;

    /** Per-category volumes */
    categoryVolumes: Record<SoundCategory, number>;

    /** Is sound enabled */
    enabled: boolean;
}

// ============================================================================
// TRAIN SOUND MANAGER CLASS
// ============================================================================

/**
 * TrainSoundManager - Manages train audio effects
 * 
 * Provides procedurally generated sounds for model railway operations.
 * Uses Web Audio API for precise control over timing and synthesis.
 * 
 * @example
 * ```typescript
 * const soundManager = new TrainSoundManager(scene);
 * soundManager.playHorn(0.5);  // Short toot
 * soundManager.updateMovementSound(75);  // 75% speed
 * ```
 */
export class TrainSoundManager {
    // ========================================================================
    // PRIVATE STATE
    // ========================================================================

    /** Babylon scene reference */
    private scene: Scene;

    /** Web Audio context */
    private audioContext: AudioContext | null = null;

    /** Master gain node */
    private masterGain: GainNode | null = null;

    /** Category gain nodes */
    private categoryGains: Map<SoundCategory, GainNode> = new Map();

    /** Configuration */
    private config: SoundConfig;

    /** Currently playing movement sound oscillator */
    private movementOscillator: OscillatorNode | null = null;

    /** Movement sound gain for fading */
    private movementGain: GainNode | null = null;

    /** Is movement sound currently active */
    private isMovementPlaying: boolean = false;

    /** Last speed value for movement sound */
    private lastSpeedPercent: number = 0;

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * Create a new TrainSoundManager
     * @param scene - Babylon scene (for lifecycle management)
     */
    constructor(scene: Scene) {
        this.scene = scene;

        // Default configuration
        this.config = {
            masterVolume: 0.5,
            categoryVolumes: { ...DEFAULT_VOLUMES },
            enabled: true
        };

        // Initialize audio on first user interaction (browser requirement)
        this.setupAudioContext();

        console.log(`${LOG_PREFIX} Sound manager created`);
    }

    // ========================================================================
    // AUDIO SETUP
    // ========================================================================

    /**
     * Setup the Web Audio context
     * Must be called after user interaction due to browser autoplay policies
     */
    private setupAudioContext(): void {
        // Create audio context lazily on first use
        if (this.audioContext) return;

        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

            // Create master gain
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = this.config.masterVolume;
            this.masterGain.connect(this.audioContext.destination);

            // Create category gain nodes
            for (const category of ['horn', 'movement', 'points', 'coupling'] as SoundCategory[]) {
                const gain = this.audioContext.createGain();
                gain.gain.value = this.config.categoryVolumes[category];
                gain.connect(this.masterGain);
                this.categoryGains.set(category, gain);
            }

            console.log(`${LOG_PREFIX} Audio context initialized`);
        } catch (error) {
            console.warn(`${LOG_PREFIX} Failed to create audio context:`, error);
        }
    }

    /**
     * Ensure audio context is ready (may need to resume after user interaction)
     */
    private async ensureAudioReady(): Promise<boolean> {
        if (!this.audioContext) {
            this.setupAudioContext();
        }

        if (!this.audioContext) {
            return false;
        }

        if (this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
            } catch (error) {
                console.warn(`${LOG_PREFIX} Failed to resume audio context`);
                return false;
            }
        }

        return true;
    }

    // ========================================================================
    // HORN SOUNDS
    // ========================================================================

    /**
     * Play the train horn
     * Generates a two-tone horn sound (classic diesel horn)
     * @param duration - Duration in seconds (default 0.5)
     */
    async playHorn(duration: number = 0.5): Promise<void> {
        if (!this.config.enabled) return;
        if (!await this.ensureAudioReady()) return;
        if (!this.audioContext) return;

        const ctx = this.audioContext;
        const hornGain = this.categoryGains.get('horn');
        if (!hornGain) return;

        const now = ctx.currentTime;

        // Create oscillators for two-tone horn
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();

        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';

        osc1.frequency.value = HORN_FREQUENCIES.low;
        osc2.frequency.value = HORN_FREQUENCIES.high;

        // Create envelope for natural attack/decay
        const envelope = ctx.createGain();
        envelope.gain.setValueAtTime(0, now);
        envelope.gain.linearRampToValueAtTime(1, now + 0.05); // Attack
        envelope.gain.setValueAtTime(1, now + duration - 0.1); // Sustain
        envelope.gain.linearRampToValueAtTime(0, now + duration); // Release

        // Connect oscillators through envelope
        const mixer = ctx.createGain();
        mixer.gain.value = 0.5; // Mix the two tones

        osc1.connect(mixer);
        osc2.connect(mixer);
        mixer.connect(envelope);
        envelope.connect(hornGain);

        // Add slight vibrato for realism
        const vibrato = ctx.createOscillator();
        const vibratoGain = ctx.createGain();
        vibrato.frequency.value = 5; // 5Hz vibrato
        vibratoGain.gain.value = 3; // ±3Hz frequency variation
        vibrato.connect(vibratoGain);
        vibratoGain.connect(osc1.frequency);
        vibratoGain.connect(osc2.frequency);

        // Start and stop
        osc1.start(now);
        osc2.start(now);
        vibrato.start(now);

        osc1.stop(now + duration);
        osc2.stop(now + duration);
        vibrato.stop(now + duration);

        console.log(`${LOG_PREFIX} Horn: TOOT! (${duration}s)`);
    }

    /**
     * Play a short horn toot
     */
    async playShortHorn(): Promise<void> {
        await this.playHorn(0.3);
    }

    /**
     * Play a long horn blast
     */
    async playLongHorn(): Promise<void> {
        await this.playHorn(1.5);
    }

    // ========================================================================
    // MOVEMENT SOUNDS
    // ========================================================================

    /**
     * Update movement sound based on current speed
     * Creates a rhythmic clicking sound that speeds up with the train
     * @param speedPercent - Current speed as percentage (0-100)
     */
    updateMovementSound(speedPercent: number): void {
        if (!this.config.enabled) return;

        this.lastSpeedPercent = speedPercent;

        // Stop sound if speed is very low
        if (speedPercent < 5) {
            this.stopMovementSound();
            return;
        }

        // Start or update movement sound
        if (!this.isMovementPlaying) {
            this.startMovementSound();
        }

        // Update frequency based on speed
        this.updateMovementFrequency(speedPercent);
    }

    /**
     * Update engine sound based on speed (alias for updateMovementSound)
     * @param speedPercent - Current speed as percentage (0-100)
     */
    updateEngineSound(speedPercent: number): void {
        this.updateMovementSound(speedPercent);
    }

    /**
     * Start the movement sound generator
     */
    private async startMovementSound(): Promise<void> {
        if (!await this.ensureAudioReady()) return;
        if (!this.audioContext) return;
        if (this.isMovementPlaying) return;

        const ctx = this.audioContext;
        const movementGainNode = this.categoryGains.get('movement');
        if (!movementGainNode) return;

        // Create a rhythmic "clickety-clack" using filtered noise
        // We'll use a low-frequency oscillator to gate white noise

        // Create noise source (approximated with oscillators)
        this.movementOscillator = ctx.createOscillator();
        this.movementOscillator.type = 'square';

        // Low frequency for wheel clicks
        const baseFreq = 2 + (this.lastSpeedPercent / 100) * 15; // 2-17 Hz
        this.movementOscillator.frequency.value = baseFreq;

        // Create gain for volume control
        this.movementGain = ctx.createGain();
        this.movementGain.gain.value = 0.3;

        // Add a filter for more realistic sound
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 200;
        filter.Q.value = 1;

        // Connect: oscillator -> filter -> gain -> category gain
        this.movementOscillator.connect(filter);
        filter.connect(this.movementGain);
        this.movementGain.connect(movementGainNode);

        this.movementOscillator.start();
        this.isMovementPlaying = true;

        console.log(`${LOG_PREFIX} Movement sound started`);
    }

    /**
     * Update movement sound frequency based on speed
     * @param speedPercent - Speed percentage
     */
    private updateMovementFrequency(speedPercent: number): void {
        if (!this.movementOscillator) return;

        // Map speed to frequency (wheel click rate)
        // At low speed: slow clicks, at high speed: fast clicks
        const freq = 2 + (speedPercent / 100) * 15; // 2-17 Hz

        this.movementOscillator.frequency.setTargetAtTime(
            freq,
            this.audioContext?.currentTime || 0,
            0.1 // Smooth transition
        );

        // Also adjust volume slightly with speed
        if (this.movementGain) {
            const volume = 0.2 + (speedPercent / 100) * 0.3; // 0.2-0.5
            this.movementGain.gain.setTargetAtTime(
                volume,
                this.audioContext?.currentTime || 0,
                0.1
            );
        }
    }

    /**
     * Stop the movement sound
     */
    private stopMovementSound(): void {
        if (!this.isMovementPlaying) return;

        if (this.movementOscillator) {
            try {
                this.movementOscillator.stop();
            } catch (e) {
                // Already stopped
            }
            this.movementOscillator = null;
        }

        this.movementGain = null;
        this.isMovementPlaying = false;
    }

    // ========================================================================
    // POINT/SWITCH SOUNDS
    // ========================================================================

    /**
     * Play the points changing sound
     * A mechanical "clunk" as points switch
     */
    async playPointsSound(): Promise<void> {
        if (!this.config.enabled) return;
        if (!await this.ensureAudioReady()) return;
        if (!this.audioContext) return;

        const ctx = this.audioContext;
        const pointsGain = this.categoryGains.get('points');
        if (!pointsGain) return;

        const now = ctx.currentTime;

        // Create a short "clunk" sound using filtered noise burst
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 80; // Low frequency thump

        // Quick envelope
        const envelope = ctx.createGain();
        envelope.gain.setValueAtTime(1, now);
        envelope.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        // Filter for more realistic sound
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 300;

        osc.connect(filter);
        filter.connect(envelope);
        envelope.connect(pointsGain);

        osc.start(now);
        osc.stop(now + 0.15);

        console.log(`${LOG_PREFIX} Points: CLUNK!`);
    }

    // ========================================================================
    // COUPLING SOUNDS
    // ========================================================================

    /**
     * Play coupling sound (buffers meeting)
     */
    async playCouplingSound(): Promise<void> {
        if (!this.config.enabled) return;
        if (!await this.ensureAudioReady()) return;
        if (!this.audioContext) return;

        const ctx = this.audioContext;
        const couplingGain = this.categoryGains.get('coupling');
        if (!couplingGain) return;

        const now = ctx.currentTime;

        // Metallic clash sound
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();

        osc1.type = 'triangle';
        osc2.type = 'square';

        osc1.frequency.value = 150;
        osc2.frequency.value = 200;

        // Sharp attack, quick decay
        const envelope = ctx.createGain();
        envelope.gain.setValueAtTime(0.8, now);
        envelope.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        const mixer = ctx.createGain();
        mixer.gain.value = 0.5;

        osc1.connect(mixer);
        osc2.connect(mixer);
        mixer.connect(envelope);
        envelope.connect(couplingGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.3);
        osc2.stop(now + 0.3);

        console.log(`${LOG_PREFIX} Coupling: CLANG!`);
    }

    /**
     * Play uncoupling sound (chains releasing)
     */
    async playUncouplingSound(): Promise<void> {
        if (!this.config.enabled) return;
        if (!await this.ensureAudioReady()) return;
        if (!this.audioContext) return;

        const ctx = this.audioContext;
        const couplingGain = this.categoryGains.get('coupling');
        if (!couplingGain) return;

        const now = ctx.currentTime;

        // Chain rattle sound (descending frequency)
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.4);

        const envelope = ctx.createGain();
        envelope.gain.setValueAtTime(0.3, now);
        envelope.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 300;
        filter.Q.value = 2;

        osc.connect(filter);
        filter.connect(envelope);
        envelope.connect(couplingGain);

        osc.start(now);
        osc.stop(now + 0.4);

        console.log(`${LOG_PREFIX} Uncoupling: CLATTER!`);
    }

    // ========================================================================
    // CONFIGURATION
    // ========================================================================

    /**
     * Set master volume
     * @param volume - Volume level (0-1)
     */
    setMasterVolume(volume: number): void {
        this.config.masterVolume = Math.max(0, Math.min(1, volume));

        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(
                this.config.masterVolume,
                this.audioContext?.currentTime || 0,
                0.05
            );
        }
    }

    /**
     * Set category volume
     * @param category - Sound category
     * @param volume - Volume level (0-1)
     */
    setCategoryVolume(category: SoundCategory, volume: number): void {
        this.config.categoryVolumes[category] = Math.max(0, Math.min(1, volume));

        const gain = this.categoryGains.get(category);
        if (gain) {
            gain.gain.setTargetAtTime(
                this.config.categoryVolumes[category],
                this.audioContext?.currentTime || 0,
                0.05
            );
        }
    }

    /**
     * Enable or disable sound
     * @param enabled - Enable sound
     */
    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;

        if (!enabled) {
            this.stopMovementSound();
        }

        console.log(`${LOG_PREFIX} Sound ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Check if sound is enabled
     * @returns true if enabled
     */
    isEnabled(): boolean {
        return this.config.enabled;
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Dispose of sound manager resources
     */
    dispose(): void {
        this.stopMovementSound();

        if (this.audioContext) {
            this.audioContext.close().catch(() => {
                // Ignore close errors
            });
        }

        this.categoryGains.clear();
        this.masterGain = null;
        this.audioContext = null;

        console.log(`${LOG_PREFIX} Disposed`);
    }
}