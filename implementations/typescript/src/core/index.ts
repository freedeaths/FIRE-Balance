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
export { FIREEngine, createEngineInput, createProjectionRow } from "./engine";
export type {
  EngineInput,
  AnnualFinancialProjection,
  DetailedProjection,
} from "./engine";

// Portfolio management
export {
  PortfolioSimulator,
  LiquidityAwareFlowStrategy,
  SimpleFlowStrategy,
  PortfolioCalculator,
} from "./portfolio";
export type {
  CashFlowStrategy,
  YearlyPortfolioResult,
  PortfolioState,
  AssetRandomFactor,
  PortfolioRandomFactors,
} from "./portfolio";

// Data validation
export * from "../utils/validation";

// Type definitions
export * from "../types";

// FIRE Planner
export { FIREPlanner } from "./planner";

// FIRE Advisor
export {
  FIREAdvisor,
  createAdvisor,
  createSimpleRecommendation,
} from "./advisor";
export type { SimpleRecommendation } from "./advisor";

// Internationalization
export {
  I18nManager,
  getI18n,
  t,
  setLanguage,
  getCurrentLanguage,
  getSupportedLanguages,
  createI18nManager,
  BrowserI18nManager,
} from "./i18n";

// Monte Carlo simulation
export { MonteCarloSimulator, createMonteCarloResult } from "./monte_carlo";
export type { MonteCarloResult } from "./monte_carlo";

// Black Swan Events
export {
  FinancialCrisisEvent,
  EconomicRecessionEvent,
  MarketCrashEvent,
  HyperinflationEvent,
  UnemploymentEvent,
  IndustryCollapseEvent,
  UnexpectedPromotionEvent,
  MajorIllnessEvent,
  LongTermCareEvent,
  RegionalConflictEvent,
  GlobalWarEvent,
  EconomicSanctionsEvent,
  EnergyCrisisEvent,
  InheritanceEvent,
  InvestmentWindfallEvent,
  createBlackSwanEvents,
} from "./black_swan_events";
