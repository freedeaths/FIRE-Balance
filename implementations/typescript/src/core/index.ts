/**
 * Core business logic exports for FIRE Balance Calculator
 *
 * This module serves as the main entry point for all core business logic,
 * providing a clean API for UI components to use. It exports the essential
 * classes and functions needed for FIRE calculations.
 *
 * Structure:
 * - Engine: Core FIRE calculation logic
 * - Portfolio: Investment portfolio simulation
 * - Validation: Data validation utilities
 * - Types: All TypeScript type definitions
 */

// Core calculation engine
export { FIREEngine, createEngineInput, validateEngineInput } from './engine';
export type { EngineInput, AnnualProjectionRow } from './engine';

// Portfolio management
export { PortfolioSimulator, LiquidityAwareFlowStrategy } from './portfolio';
export type { PortfolioSimulationResult, CashFlowStrategy } from './portfolio';

// Data validation
export * from '@/utils/validation';

// Type definitions
export * from '@/types';

// FIRE Planner
export { FIREPlanner } from './planner';

// Internationalization
export * from '../utils/i18n';
