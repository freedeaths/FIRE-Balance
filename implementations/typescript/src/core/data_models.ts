/**
 * FIRE Balance Calculator Data Models - Direct port from Python data_models.py
 *
 * This file contains all the data models with exact 1:1 mapping to Python Pydantic models.
 * All validation logic, defaults, and behaviors are preserved.
 */

import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// Enums - Direct mapping from Python
// =============================================================================

/**
 * Enum for income/expense item frequency
 * Direct mapping from Python ItemFrequency
 */
export type ItemFrequency = 'recurring' | 'one-time';

/**
 * Time unit for amount input
 * Direct mapping from Python TimeUnit
 */
export type TimeUnit = 'monthly' | 'quarterly' | 'annually';

/**
 * Asset liquidity level for cash flow strategy optimization
 * Direct mapping from Python LiquidityLevel
 */
export type LiquidityLevel = 'high' | 'medium' | 'low';

// =============================================================================
// Asset and Portfolio Classes - Direct mapping from Python
// =============================================================================

/**
 * Individual asset class in portfolio
 * Direct TypeScript equivalent of Python's AssetClass model
 */
export interface AssetClass {
  /** Asset class name (normalized to lowercase, e.g., 'stocks', 'bonds') */
  name: string;

  /** Original display name for UI (auto-filled if empty) */
  display_name: string;

  /** Allocation percentage (0-100) */
  allocation_percentage: number;

  /** Expected annual return rate (%) - after tax */
  expected_return: number;

  /** Expected volatility/risk (%) - ONLY used for Monte Carlo simulations */
  volatility: number;

  /** Asset liquidity level for cash flow optimization */
  liquidity_level: LiquidityLevel;
}

/**
 * Normalize asset name for internal consistency
 * Direct port of Python's normalize_name validator
 */
export function normalizeAssetClass(data: Partial<AssetClass>): AssetClass {
  if (data.name) {
    const originalName = String(data.name).trim();
    // Store original for display if display_name not provided
    if (!data.display_name) {
      data.display_name = originalName;
    }
    // Normalize: lowercase + collapse multiple spaces to single space
    const normalizedName = originalName.toLowerCase().trim().replace(/\s+/g, ' ');
    data.name = normalizedName;
  }

  return {
    name: data.name || '',
    display_name: data.display_name || '',
    allocation_percentage: data.allocation_percentage || 0,
    expected_return: data.expected_return || 0,
    volatility: data.volatility || 0,
    liquidity_level: data.liquidity_level || 'medium'
  };
}

/**
 * Investment portfolio configuration
 * Direct TypeScript equivalent of Python's PortfolioConfiguration model
 */
export interface PortfolioConfiguration {
  /** List of asset classes in the portfolio */
  asset_classes: AssetClass[];

  /** Whether to rebalance portfolio annually */
  enable_rebalancing: boolean;
}

/**
 * Default portfolio configuration matching Python exactly
 * Direct mapping from Python's default_factory
 */
export const DEFAULT_PORTFOLIO: PortfolioConfiguration = {
  asset_classes: [
    {
      name: 'stocks',  // Will be normalized to "stocks"
      display_name: 'Stocks',
      allocation_percentage: 20.0,
      expected_return: 5.0,
      volatility: 15.0,
      liquidity_level: 'medium',
    },
    {
      name: 'bonds',  // Will be normalized to "bonds"
      display_name: 'Bonds',
      allocation_percentage: 0.0,
      expected_return: 3.0,
      volatility: 5.0,
      liquidity_level: 'low',
    },
    {
      name: 'savings',  // Will be normalized to "savings"
      display_name: 'Savings',
      allocation_percentage: 60.0,
      expected_return: 1.0,
      volatility: 5.0,
      liquidity_level: 'low',
    },
    {
      name: 'cash',  // Will be normalized to "cash"
      display_name: 'Cash',
      allocation_percentage: 20.0,
      expected_return: 0.0,
      volatility: 1.0,
      liquidity_level: 'high',
    },
  ],
  enable_rebalancing: true,
};

/**
 * Validate that asset allocations sum to 100% (strict validation)
 * Direct port of Python's validate_allocation_sum
 */
export function validateAllocationSum(portfolio: PortfolioConfiguration): void {
  const total = portfolio.asset_classes.reduce((sum, asset) => sum + asset.allocation_percentage, 0);
  // Use Number.EPSILON for machine precision tolerance
  const tolerance = Number.EPSILON;

  if (Math.abs(total - 100.0) > tolerance) {
    throw new Error(
      `Asset allocation percentages must sum to exactly 100%, ` +
      `got ${total}% (difference: ${total - 100.0}%)`
    );
  }
}

/**
 * Validate that asset names are unique within portfolio (case-insensitive)
 * Direct port of Python's validate_unique_asset_names
 */
export function validateUniqueAssetNames(portfolio: PortfolioConfiguration): void {
  const names = portfolio.asset_classes.map(asset => asset.name); // Already normalized to lowercase
  if (names.length !== new Set(names).size) {
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    const uniqueDuplicates = [...new Set(duplicates)];
    // Show display names in error for better UX
    const displayNames = portfolio.asset_classes
      .filter(asset => uniqueDuplicates.includes(asset.name))
      .map(asset => asset.display_name);
    throw new Error(
      `Asset names must be unique within portfolio (case-insensitive). ` +
      `Duplicate names found: ${displayNames.join(', ')}`
    );
  }
}

/**
 * Create and validate a portfolio configuration
 * Combines normalization and validation like Python Pydantic
 */
export function createPortfolioConfiguration(data: {
  asset_classes?: Partial<AssetClass>[];
  enable_rebalancing?: boolean;
}): PortfolioConfiguration {
  // Normalize all asset classes
  const normalizedAssets = (data.asset_classes || DEFAULT_PORTFOLIO.asset_classes)
    .map(normalizeAssetClass);

  const portfolio: PortfolioConfiguration = {
    asset_classes: normalizedAssets,
    enable_rebalancing: data.enable_rebalancing ?? true
  };

  // Run validations
  validateAllocationSum(portfolio);
  validateUniqueAssetNames(portfolio);

  return portfolio;
}

// =============================================================================
// User Profile - Direct mapping from Python
// =============================================================================

/**
 * Data model for the user's profile
 * Direct TypeScript equivalent of Python's UserProfile model
 */
export interface UserProfile {
  /** User's birth year */
  birth_year: number;

  /** User's expected FIRE age */
  expected_fire_age: number;

  /** Legal retirement age (when eligible for government pension) */
  legal_retirement_age: number;

  /** User's life expectancy */
  life_expectancy: number;

  /** User's current net worth (after-tax value) */
  current_net_worth: number;

  /** Expected annual inflation rate (%) */
  inflation_rate: number;

  /** Safety buffer in months of annual expenses (default: 6 months) */
  safety_buffer_months: number;

  /** Investment portfolio configuration */
  portfolio: PortfolioConfiguration;
}

/**
 * Calculate current age from birth year
 * Direct port of Python's current_age property
 */
export function getCurrentAge(birthYear: number): number {
  return new Date().getFullYear() - birthYear;
}

/**
 * Validate birth year is reasonable
 * Direct port of Python's validate_birth_year
 */
export function validateBirthYear(birthYear: number): void {
  const currentYear = new Date().getFullYear();
  if (birthYear < 1950 || birthYear > currentYear) {
    throw new Error(
      `Birth year must be between 1950 and ${currentYear}, got ${birthYear}`
    );
  }
}

/**
 * Validate ages follow logic: current <= fire <= retirement <= life_expectancy
 * Direct port of Python's validate_age_progression
 */
export function validateAgeProgression(profile: UserProfile): void {
  const current = getCurrentAge(profile.birth_year);
  const fire = profile.expected_fire_age;
  const retirement = profile.legal_retirement_age;
  const life = profile.life_expectancy;

  if (!(current <= fire && fire <= retirement && retirement <= life)) {
    throw new Error(
      `Ages must follow progression: current_age(${current}) <= ` +
      `expected_fire_age(${fire}) <= legal_retirement_age(${retirement}) <= ` +
      `life_expectancy(${life})`
    );
  }
}

/**
 * Create and validate a user profile
 * Combines validation like Python Pydantic
 */
export function createUserProfile(data: Partial<UserProfile>): UserProfile {
  const profile: UserProfile = {
    birth_year: data.birth_year || 1990,
    expected_fire_age: data.expected_fire_age || 50,
    legal_retirement_age: data.legal_retirement_age || 65,
    life_expectancy: data.life_expectancy || 85,
    current_net_worth: data.current_net_worth || 0.0,
    inflation_rate: data.inflation_rate || 3.0,
    safety_buffer_months: data.safety_buffer_months || 6,
    portfolio: data.portfolio || createPortfolioConfiguration({})
  };

  // Run validations
  validateBirthYear(profile.birth_year);
  validateAgeProgression(profile);

  return profile;
}

// =============================================================================
// Income/Expense Items - Direct mapping from Python
// =============================================================================

/**
 * Data model for a single income or expense item
 * Direct TypeScript equivalent of Python's IncomeExpenseItem model
 */
export interface IncomeExpenseItem {
  /** Unique identifier */
  id: string;

  /** Item name */
  name: string;

  /** After-tax amount per time period */
  after_tax_amount_per_period: number;

  /** Time unit for the amount */
  time_unit: TimeUnit;

  /** Frequency type */
  frequency: ItemFrequency;

  /** Interval in time_unit periods */
  interval_periods: number;

  /** The age this item starts */
  start_age: number;

  /** The age this item ends (for recurring items) */
  end_age?: number;

  /** Annual growth rate (%) - after tax */
  annual_growth_rate: number;

  /** True for income, False for expense */
  is_income: boolean;

  /** Category for grouping */
  category?: string;
}

/**
 * Create an income/expense item with validation
 * Mimics Python's default behavior and validation
 */
export function createIncomeExpenseItem(data: Partial<IncomeExpenseItem>): IncomeExpenseItem {
  const item: IncomeExpenseItem = {
    id: data.id || uuidv4(),
    name: data.name || '',
    after_tax_amount_per_period: data.after_tax_amount_per_period || 0,
    time_unit: data.time_unit || 'annually',
    frequency: data.frequency || 'recurring',
    interval_periods: data.interval_periods ?? 1,
    start_age: data.start_age || 0,
    end_age: data.end_age,
    annual_growth_rate: data.annual_growth_rate || 0.0,
    is_income: data.is_income || false,
    category: data.category
  };

  // Validate interval_periods > 0 (matches Python's gt=0 constraint)
  if (item.interval_periods <= 0) {
    throw new Error('interval_periods must be greater than 0');
  }

  return item;
}

// =============================================================================
// Calculation Results - Direct mapping from Python
// =============================================================================

/**
 * Complete state for a single year in FIRE calculation
 * Direct TypeScript equivalent of Python's YearlyState dataclass
 */
export interface YearlyState {
  /** User's age in this year */
  age: number;

  /** Calendar year */
  year: number;

  // Cash flows (from input table)
  /** Total income for the year */
  total_income: number;

  /** Total expenses for the year */
  total_expense: number;

  /** Net cash flow (income - expense) */
  net_cash_flow: number;

  // Financial state
  /** Investment portfolio value (always >= 0) */
  portfolio_value: number; // Using number instead of Decimal for simplicity

  /** True net worth (can be negative, indicating debt) */
  net_worth: number;

  /** Annual return from portfolio */
  investment_return: number; // Using number instead of Decimal for simplicity

  // Sustainability metrics (core logic)
  /** True if net worth can remain above safety buffer through life expectancy */
  is_sustainable: boolean;

  // Traditional FIRE metrics (optional reference)
  /** Traditional 4% rule FIRE number (25x annual expenses) - for reference only */
  fire_number: number;

  /** Portfolio value / fire_number (0-1+) - for reference only */
  fire_progress: number;
}

/**
 * Complete FIRE calculation result
 * Direct TypeScript equivalent of Python's FIRECalculationResult model
 */
export interface FIRECalculationResult {
  // Core sustainability results
  /** Whether FIRE is achievable based on net worth sustainability */
  is_fire_achievable: boolean;

  /** Net worth at expected FIRE age */
  fire_net_worth: number;

  // Net worth trajectory analysis
  /** Minimum net worth during retirement phase */
  min_net_worth_after_fire: number;

  /** Net worth at end of life expectancy */
  final_net_worth: number;

  // Safety buffer analysis
  /** Configured safety buffer in months */
  safety_buffer_months: number;

  /** Minimum ratio of net worth to safety buffer (worst case) */
  min_safety_buffer_ratio: number;

  // Detailed yearly results
  /** Year-by-year calculation results */
  yearly_results: YearlyState[];

  // Traditional FIRE metrics (for reference)
  /** Traditional 4% rule FIRE number (25x expenses) */
  traditional_fire_number: number;

  /** Whether traditional 4% FIRE is achieved */
  traditional_fire_achieved: boolean;

  // Risk analysis (will be populated by Monte Carlo)
  /** Monte Carlo success probability (0-1) */
  fire_success_probability?: number;

  // Summary statistics
  /** Total years in simulation */
  total_years_simulated: number;

  /** Years from FIRE age to life expectancy */
  retirement_years: number;
}

// =============================================================================
// Simulation and Events - Direct mapping from Python
// =============================================================================

/**
 * Base interface for black swan events
 * TypeScript equivalent of Python's BlackSwanEvent abstract class
 */
export interface BlackSwanEvent {
  /** Unique identifier (e.g., 'financial_crisis') */
  event_id: string;

  /** Annual occurrence probability (0-1) */
  annual_probability: number;

  /** Duration of impact in years */
  duration_years: number;

  /** Recovery factor (0-1, 1 means full recovery) */
  recovery_factor: number;

  /** Applicable age range */
  age_range: [number, number];
}

/**
 * Monte Carlo simulation settings
 * Direct TypeScript equivalent of Python's SimulationSettings model
 */
export interface SimulationSettings {
  /** Number of simulations to run */
  num_simulations: number;

  /** Confidence level for results (0.5-0.99) */
  confidence_level: number;

  /** Whether to include black swan events (including market crashes) */
  include_black_swan_events: boolean;

  // Base variation parameters (daily fluctuations, excluding major events)
  /** Base income volatility (standard deviation) */
  income_base_volatility: number;

  /** Minimum income factor (safety net threshold) */
  income_minimum_factor: number;

  /** Base expense volatility (standard deviation) */
  expense_base_volatility: number;

  /** Minimum expense factor (prevents expenses going too low) */
  expense_minimum_factor: number;
}

/**
 * Default simulation settings matching Python defaults
 */
export const DEFAULT_SIMULATION_SETTINGS: SimulationSettings = {
  num_simulations: 1000,
  confidence_level: 0.95,
  include_black_swan_events: true,
  income_base_volatility: 0.1,
  income_minimum_factor: 0.1,
  expense_base_volatility: 0.05,
  expense_minimum_factor: 0.5,
};

/**
 * Create and validate simulation settings
 * Mimics Python Pydantic validation behavior
 */
export function createSimulationSettings(data: Partial<SimulationSettings>): SimulationSettings {
  const settings: SimulationSettings = {
    num_simulations: data.num_simulations ?? DEFAULT_SIMULATION_SETTINGS.num_simulations,
    confidence_level: data.confidence_level ?? DEFAULT_SIMULATION_SETTINGS.confidence_level,
    include_black_swan_events: data.include_black_swan_events ?? DEFAULT_SIMULATION_SETTINGS.include_black_swan_events,
    income_base_volatility: data.income_base_volatility ?? DEFAULT_SIMULATION_SETTINGS.income_base_volatility,
    income_minimum_factor: data.income_minimum_factor ?? DEFAULT_SIMULATION_SETTINGS.income_minimum_factor,
    expense_base_volatility: data.expense_base_volatility ?? DEFAULT_SIMULATION_SETTINGS.expense_base_volatility,
    expense_minimum_factor: data.expense_minimum_factor ?? DEFAULT_SIMULATION_SETTINGS.expense_minimum_factor,
  };

  // Validate confidence_level range (matches Python ge=0.5, le=0.99)
  if (settings.confidence_level < 0.5 || settings.confidence_level > 0.99) {
    throw new Error(`confidence_level must be between 0.5 and 0.99, got ${settings.confidence_level}`);
  }

  // Validate volatility ranges (matches Python ge=0.0, le=1.0)
  if (settings.income_base_volatility < 0.0 || settings.income_base_volatility > 1.0) {
    throw new Error(`income_base_volatility must be between 0.0 and 1.0, got ${settings.income_base_volatility}`);
  }
  if (settings.expense_base_volatility < 0.0 || settings.expense_base_volatility > 1.0) {
    throw new Error(`expense_base_volatility must be between 0.0 and 1.0, got ${settings.expense_base_volatility}`);
  }

  // Validate minimum factors (matches Python ge=0.01, le=1.0 for income, ge=0.1, le=1.0 for expense)
  if (settings.income_minimum_factor < 0.01 || settings.income_minimum_factor > 1.0) {
    throw new Error(`income_minimum_factor must be between 0.01 and 1.0, got ${settings.income_minimum_factor}`);
  }
  if (settings.expense_minimum_factor < 0.1 || settings.expense_minimum_factor > 1.0) {
    throw new Error(`expense_minimum_factor must be between 0.1 and 1.0, got ${settings.expense_minimum_factor}`);
  }

  return settings;
}
