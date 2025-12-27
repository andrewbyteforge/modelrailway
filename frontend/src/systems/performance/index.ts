/**
 * Performance System Index
 * 
 * Path: frontend/src/systems/performance/index.ts
 * 
 * Exports all performance monitoring and display components.
 * 
 * @module Performance
 * @author Model Railway Workbench
 * @version 1.0.0
 */

// ============================================================================
// EXPORTS
// ============================================================================

export { FPSDisplay } from './FPSDisplay';
export type {
    FPSData,
    FPSDisplayConfig,
    FPSUpdateCallback,
    PerformanceState,
} from './FPSDisplay';

export default FPSDisplay;