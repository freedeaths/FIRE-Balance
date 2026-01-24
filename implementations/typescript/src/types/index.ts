/**
 * Core TypeScript types for FIRE Balance Calculator
 *
 * This file contains all the data models ported from Python's data_models.py
 * to ensure type safety and consistency across the application.
 *
 * Key design principles:
 * - Direct 1:1 mapping with Python Pydantic models
 * - Comprehensive validation logic
 * - Clear documentation for each field
 * - Maintainable and extensible structure
 */

// =============================================================================
// Enums - Core value types that constrain choices
// =============================================================================

/**
 * Frequency type for income/expense items
 * Maps to Python's ItemFrequency enum
 */
export type ItemFrequency = 'recurring' | 'one-time';

/**
 * Time unit for amount input
 * Maps to Python's TimeUnit enum
 */
export type TimeUnit = 'monthly' | 'quarterly' | 'annually';

/**
 * Asset liquidity levels for cash flow optimization
 * Maps to Python's LiquidityLevel enum
 */
export type LiquidityLevel = 'high' | 'medium' | 'low';

// =============================================================================
// Portfolio and Investment Types
// =============================================================================

/**
 * Individual asset class in an investment portfolio
 * Direct TypeScript equivalent of Python's AssetClass model
 */
export interface AssetClass {
  /** Asset class name (normalized to lowercase, e.g., 'stocks', 'bonds') */
  name: string;

  /** Original display name for UI presentation */
  display_name: string;

  /** Allocation percentage (0-100) */
  allocation_percentage: number;

  /** Expected annual return rate (%) - after tax */
  expected_return: number;

  /** Expected volatility/risk (%) - used in Monte Carlo simulations */
  volatility: number;

  /** Asset liquidity level for cash flow optimization */
  liquidity_level: LiquidityLevel;
}

/**
 * Complete investment portfolio configuration
 * Direct TypeScript equivalent of Python's PortfolioConfiguration model
 */
export interface PortfolioConfiguration {
  /** List of asset classes in the portfolio */
  asset_classes: AssetClass[];

  /** Whether to rebalance portfolio annually */
  enable_rebalancing: boolean;

  /** Rebalancing threshold percentage (optional) */
  rebalancing_threshold?: number;

  /** Rebalancing frequency (optional) */
  rebalancing_frequency?: string;

  /** Cash flow strategy (optional) */
  cash_flow_strategy?: string;
}

/**
 * Default portfolio configuration matching Python defaults
 */
export const DEFAULT_PORTFOLIO: PortfolioConfiguration = {
  asset_classes: [
    {
      name: 'stocks',
      display_name: 'Stocks',
      allocation_percentage: 20.0,
      expected_return: 5.0,
      volatility: 15.0,
      liquidity_level: 'medium',
    },
    {
      name: 'bonds',
      display_name: 'Bonds',
      allocation_percentage: 0.0,
      expected_return: 3.0,
      volatility: 5.0,
      liquidity_level: 'low',
    },
    {
      name: 'savings',
      display_name: 'Savings',
      allocation_percentage: 60.0,
      expected_return: 1.0,
      volatility: 5.0,
      liquidity_level: 'low',
    },
    {
      name: 'cash',
      display_name: 'Cash',
      allocation_percentage: 20.0,
      expected_return: 0.0,
      volatility: 1.0,
      liquidity_level: 'high',
    },
  ],
  enable_rebalancing: true,
};

// =============================================================================
// User Profile and Core Configuration
// =============================================================================

/**
 * User profile containing all personal and financial preferences
 * Direct TypeScript equivalent of Python's UserProfile model
 */
export interface UserProfile {
  /** User's birth year */
  birth_year: number;

  /** Base year for age calculations (defaults to current year) */
  as_of_year: number;

  /** User's expected FIRE (Financial Independence, Retire Early) age */
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

  /**
   * Nominal discount rate (%) used to convert remaining bridge-period expenses
   * (from expected FIRE age to legal retirement age) into a present-value requirement.
   */
  bridge_discount_rate: number;

  /** Investment portfolio configuration */
  portfolio: PortfolioConfiguration;
}

/**
 * Default user profile matching Python defaults
 */
export const DEFAULT_USER_PROFILE: Omit<UserProfile, 'birth_year'> = {
  as_of_year: new Date().getFullYear(),
  expected_fire_age: 50,
  legal_retirement_age: 65,
  life_expectancy: 85,
  current_net_worth: 0.0,
  inflation_rate: 3.0,
  safety_buffer_months: 6,
  bridge_discount_rate: 1.0,
  portfolio: DEFAULT_PORTFOLIO,
};

// =============================================================================
// Income and Expense Items
// =============================================================================

/**
 * A single income or expense item in the financial plan
 * Direct TypeScript equivalent of Python's IncomeExpenseItem model
 */
export interface IncomeExpenseItem {
  /** Unique identifier */
  id: string;

  /** Human-readable name */
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

  /** Optional category for grouping */
  category?: string;

  /** Predefined type identifier (optional) */
  predefined_type?: string;
}

// =============================================================================
// Calculation Results and State
// =============================================================================

/**
 * Complete financial state for a single year in FIRE calculation
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
  portfolio_value: number;

  /** True net worth (can be negative, indicating debt) */
  net_worth: number;

  /** Annual return from portfolio */
  investment_return: number;

  // Sustainability metrics
  /** True if net worth can remain above safety buffer through life expectancy */
  is_sustainable: boolean;

  // Traditional FIRE metrics (for reference)
  /** Traditional 4% rule FIRE number (25x annual expenses) */
  fire_number: number;

  /** Portfolio value / fire_number ratio (0-1+) */
  fire_progress: number;
}

/**
 * Complete FIRE calculation result containing all analysis
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

  // Risk analysis (populated by Monte Carlo)
  /** Monte Carlo success probability (0-1) */
  fire_success_probability?: number;

  // Summary statistics
  /** Total years in simulation */
  total_years_simulated: number;

  /** Years from FIRE age to life expectancy */
  retirement_years: number;
}

// =============================================================================
// Monte Carlo Simulation Types
// =============================================================================

/**
 * Settings for Monte Carlo risk analysis simulations
 * Direct TypeScript equivalent of Python's SimulationSettings model
 */
export interface SimulationSettings {
  /** Number of simulations to run */
  num_simulations: number;

  /** Confidence level for results (0.5-0.99) */
  confidence_level: number;

  /** Whether to include black swan events */
  include_black_swan_events: boolean;

  // Base variation parameters for daily fluctuations
  /** Base income volatility (standard deviation, 0-1) */
  income_base_volatility: number;

  /** Minimum income factor (safety net threshold, 0.01-1) */
  income_minimum_factor: number;

  /** Base expense volatility (standard deviation, 0-1) */
  expense_base_volatility: number;

  /** Minimum expense factor (prevents expenses going too low, 0.1-1) */
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

// =============================================================================
// Black Swan Events (Simplified for TypeScript)
// =============================================================================

/**
 * Black swan event definition for Monte Carlo simulations
 * Simplified version of Python's BlackSwanEvent abstract class
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

  /** Display name for UI */
  display_name: string;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Validation error structure for form handling
 */
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Result wrapper for operations that can fail
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Language codes for internationalization
 */
export type LanguageCode = 'en' | 'zh' | 'zh-CN' | 'ja';

/**
 * Annual projection row for stage 2 table
 */
export interface AnnualProjectionRow {
  /** Age during this year */
  age: number;

  /** Calendar year */
  year: number;

  /** Total income for this year */
  total_income: number;

  /** Total expenses for this year */
  total_expense: number;

  /** Allow additional columns for detailed projection */
  [key: string]: any;
}

// =============================================================================
// Planner System Types
// =============================================================================

/**
 * Planner stages enumeration
 */
export enum PlannerStage {
  STAGE1_INPUT = 'stage1_input',
  STAGE2_ADJUSTMENT = 'stage2_adjustment',
  STAGE3_ANALYSIS = 'stage3_analysis',
}

/**
 * Financial projection override for specific age/item
 */
export interface Override {
  /** Age at which to apply the override */
  age: number;

  /** ID of the income/expense item to override */
  item_id: string;

  /** Override value */
  value: number;
}

/**
 * Results from stage 3 calculations and analysis
 */
export interface PlannerResults {
  /** Core FIRE calculation result */
  fire_calculation: FIRECalculationResult;

  /** Monte Carlo success rate (0-1) */
  monte_carlo_success_rate?: number;

  /** Monte Carlo status distribution (0-1) */
  monte_carlo_status_rates?: {
    safe: number;
    warning: number;
    danger: number;
  };

  /** Per-year status distribution (0-1) */
  monte_carlo_yearly_status_rates?: Array<{
    age: number;
    year: number;
    safe: number;
    warning: number;
    danger: number;
  }>;

  /** Advisor recommendations */
  recommendations: any[];

  /** When the calculation was performed */
  calculation_timestamp: string;
}

/**
 * Session data for the planner
 */
export interface PlannerData {
  /** Current stage of the planner */
  current_stage: PlannerStage;

  // Stage 1: Input collection
  /** User profile information */
  user_profile?: UserProfile;

  /** List of income items */
  income_items: IncomeExpenseItem[];

  /** List of expense items */
  expense_items: IncomeExpenseItem[];

  // Stage 2: Adjustments
  /** Annual projection data as DataFrame equivalent */
  projection_data?: AnnualProjectionRow[];

  /** User overrides to the projection */
  overrides: Override[];

  // Stage 3: Results
  /** Final calculation results */
  results?: PlannerResults;

  // Metadata
  /** Unique session identifier */
  session_id: string;

  /** Session creation timestamp */
  created_at: string;

  /** Last update timestamp */
  updated_at: string;

  /** Current language */
  language: LanguageCode;

  /** Monte Carlo simulation settings */
  simulation_settings: SimulationSettings;
}

// =============================================================================
// Engine and Advisor Types
// =============================================================================

/**
 * Input configuration for the FIRE calculation engine
 */
export interface EngineInput {
  /** User profile information */
  user_profile: UserProfile;

  /** Annual financial projection data */
  annual_financial_projection: AnnualProjectionRow[];

  /** Income items for the calculation */
  income_items: IncomeExpenseItem[];

  /** Optional expense items */
  expense_items?: IncomeExpenseItem[];

  /** Optional detailed projection data */
  detailed_projection?: AnnualProjectionRow[];
}

/**
 * Simple recommendation from the FIRE advisor
 */
export interface SimpleRecommendation {
  /** Type of recommendation */
  type:
    | 'early_retirement'
    | 'delayed_retirement'
    | 'delayed_retirement_not_feasible'
    | 'income_adjustment'
    | 'increase_income'
    | 'expense_reduction'
    | 'reduce_expenses';

  /** Parameters specific to this recommendation */
  params: Record<string, any>;

  /** Whether this recommendation is achievable */
  is_achievable: boolean;

  /** Optional Monte Carlo success rate */
  monte_carlo_success_rate?: number;
}

/**
 * Monte Carlo simulation result
 */
export interface MonteCarloResult {
  /** Total number of simulations run */
  total_simulations: number;

  /** Number of successful simulations */
  successful_simulations: number;

  /** Success rate (0-1) */
  success_rate: number;

  /** Mean final net worth across all simulations */
  mean_final_net_worth: number;

  /** Median final net worth */
  median_final_net_worth: number;

  /** 5th percentile net worth */
  percentile_5_net_worth: number;

  /** 95th percentile net worth */
  percentile_95_net_worth: number;

  /** Black swan impact analysis */
  black_swan_impact_analysis?: Record<string, any>;

  /** Resilience score (0-100) */
  resilience_score?: number;

  /** Recommended emergency fund amount */
  recommended_emergency_fund?: number;

  /** List of worst case scenarios */
  worst_case_scenarios?: string[];
}
