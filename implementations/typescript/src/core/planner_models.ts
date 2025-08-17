/**
 * Data models for FIRE Planner system
 * Direct TypeScript port from Python planner_models.py
 *
 * This module contains the core data structures used by the FIRE planner
 * for managing three-stage planning workflow and configuration persistence.
 */

import Decimal from "decimal.js";
import type {
  UserProfile,
  IncomeExpenseItem,
  SimulationSettings,
  FIRECalculationResult,
} from "./data_models";
import { createSimulationSettings } from "./data_models";

// =============================================================================
// Planner Stage Enumeration
// =============================================================================

/**
 * Planner stages enumeration
 * Direct TypeScript equivalent of Python's PlannerStage enum
 */
export enum PlannerStage {
  STAGE1_INPUT = "stage1_input",
  STAGE2_ADJUSTMENT = "stage2_adjustment",
  STAGE3_ANALYSIS = "stage3_analysis",
}

// =============================================================================
// Override Model
// =============================================================================

/**
 * Financial projection override for specific age/item
 * Direct TypeScript equivalent of Python's Override model
 */
export interface Override {
  /** Age for which this override applies (0-150) */
  age: number;

  /** ID of the item being overridden */
  item_id: string;

  /** New value for the item at this age */
  value: Decimal;
}

/**
 * Create an Override with validation
 * Accepts number inputs and converts to Decimal internally
 */
export function createOverride(
  data: Partial<Override> & { value?: number | Decimal },
): Override {
  const override: Override = {
    age: data.age ?? 0,
    item_id: data.item_id ?? "",
    value:
      typeof data.value === "number"
        ? new Decimal(data.value)
        : (data.value ?? new Decimal(0)),
  };

  // Validate age range
  if (override.age < 0 || override.age > 150) {
    throw new Error(
      `Override age must be between 0 and 150, got ${override.age}`,
    );
  }

  // Validate item_id
  if (!override.item_id) {
    throw new Error("Override item_id cannot be empty");
  }

  return override;
}

// =============================================================================
// Planner Results Model
// =============================================================================

/**
 * Results from stage 3 calculations and analysis
 * Direct TypeScript equivalent of Python's PlannerResults model
 */
export interface PlannerResults {
  /** Core FIRE calculation results */
  fire_calculation: FIRECalculationResult;

  /** Monte Carlo simulation success rate (0.0-1.0) */
  monte_carlo_success_rate?: Decimal;

  /** List of advisor recommendations */
  recommendations: Record<string, any>[];

  /** Timestamp when calculation was performed */
  calculation_timestamp: Date;
}

/**
 * Create PlannerResults with validation
 * Accepts number inputs and converts to Decimal internally
 */
export function createPlannerResults(
  data: Partial<PlannerResults> & { monte_carlo_success_rate?: number },
): PlannerResults {
  return {
    fire_calculation: data.fire_calculation!,
    monte_carlo_success_rate:
      typeof data.monte_carlo_success_rate === "number"
        ? new Decimal(data.monte_carlo_success_rate)
        : data.monte_carlo_success_rate,
    recommendations: data.recommendations ?? [],
    calculation_timestamp: data.calculation_timestamp ?? new Date(),
  };
}

// =============================================================================
// Main Planner Data Container
// =============================================================================

/**
 * Main data container for all planner stages
 * Direct TypeScript equivalent of Python's PlannerData model
 *
 * This model manages the complete workflow state across all three planner stages:
 * - Stage 1: User input collection
 * - Stage 2: Financial projection adjustments
 * - Stage 3: Analysis and recommendations
 */
export interface PlannerData {
  // Stage tracking
  /** Current stage of the planning workflow */
  current_stage: PlannerStage;

  // Stage 1: Input collection
  /** User profile with demographics and goals */
  user_profile?: UserProfile;

  /** List of income items (salary, investment returns, etc.) */
  income_items: IncomeExpenseItem[];

  /** List of expense items (living costs, major purchases, etc.) */
  expense_items: IncomeExpenseItem[];

  // Stage 2: Adjustments
  /** Financial projection data as array of annual rows */
  projection_df?: AnnualProjectionRow[];

  /** User overrides for specific ages/items */
  overrides: Override[];

  // Stage 3: Results
  /** Final calculation results and analysis */
  results?: PlannerResults;

  // Metadata
  /** Unique session identifier */
  session_id: string;

  /** When this session was created */
  created_at: Date;

  /** When this session was last updated */
  updated_at: Date;

  /** Language preference (en, zh, ja) */
  language: string;

  // Monte Carlo simulation settings
  /** Settings for risk analysis simulation */
  simulation_settings: SimulationSettings;
}

/**
 * Annual projection row for Stage 2 display
 * Similar to AnnualFinancialProjection but with more detail for UI
 */
export interface AnnualProjectionRow {
  age: number;
  year: number;
  total_income: Decimal;
  total_expense: Decimal;
}

/**
 * Generate a UUID v4 string (simplified implementation)
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Create PlannerData with defaults and validation
 */
export function createPlannerData(
  data: Partial<PlannerData> = {},
): PlannerData {
  const now = new Date();

  return {
    current_stage: data.current_stage ?? PlannerStage.STAGE1_INPUT,
    user_profile: data.user_profile,
    income_items: data.income_items ?? [],
    expense_items: data.expense_items ?? [],
    projection_df: data.projection_df,
    overrides: data.overrides ?? [],
    results: data.results,
    session_id: data.session_id ?? generateUUID(),
    created_at: data.created_at ?? now,
    updated_at: data.updated_at ?? now,
    language: data.language ?? "en",
    simulation_settings:
      data.simulation_settings ?? createSimulationSettings({}),
  };
}

/**
 * Update the updated_at timestamp
 */
export function updatePlannerDataTimestamp(data: PlannerData): PlannerData {
  return {
    ...data,
    updated_at: new Date(),
  };
}

// =============================================================================
// Planner Configuration V1 Format
// =============================================================================

/**
 * Version 1.0 of planner configuration file format - Clean and Simple
 * Direct TypeScript equivalent of Python's PlannerConfigV1 model
 *
 * This is the JSON serialization format used for saving/loading planner sessions
 */
export interface PlannerConfigV1 {
  /** Configuration format version */
  version: string;

  /** Metadata about the configuration */
  metadata: Record<string, any>;

  /** User profile as plain object */
  profile: Record<string, any>;

  /** Income items as plain objects */
  income_items: Record<string, any>[];

  /** Expense items as plain objects */
  expense_items: Record<string, any>[];

  /** Overrides as plain objects */
  overrides: Record<string, any>[];

  /** Monte Carlo simulation settings as plain object */
  simulation_settings: Record<string, any>;
}

/**
 * Create PlannerConfigV1 with defaults
 */
export function createPlannerConfigV1(
  data: Partial<PlannerConfigV1> = {},
): PlannerConfigV1 {
  return {
    version: data.version ?? "1.0",
    metadata: data.metadata ?? {},
    profile: data.profile ?? {},
    income_items: data.income_items ?? [],
    expense_items: data.expense_items ?? [],
    overrides: data.overrides ?? [],
    simulation_settings: data.simulation_settings ?? {},
  };
}

/**
 * Convert PlannerConfigV1 to PlannerData for use in planner
 */
export function configToPlannerData(config: PlannerConfigV1): PlannerData {
  // Convert profile dict to UserProfile model
  const user_profile: UserProfile = {
    birth_year: config.profile.birth_year ?? 1990,
    expected_fire_age: config.profile.expected_fire_age ?? 50,
    legal_retirement_age: config.profile.legal_retirement_age ?? 65,
    life_expectancy: config.profile.life_expectancy ?? 85,
    current_net_worth: new Decimal(config.profile.current_net_worth ?? 0),
    inflation_rate: new Decimal(config.profile.inflation_rate ?? 3.0),
    safety_buffer_months: new Decimal(
      config.profile.safety_buffer_months ?? 12.0,
    ),
    portfolio: config.profile.portfolio ?? {
      asset_classes: [
        {
          name: "stocks",
          display_name: "Stocks",
          allocation_percentage: new Decimal(70.0),
          expected_return: new Decimal(7.0),
          volatility: new Decimal(15.0),
          liquidity_level: "medium" as const,
        },
        {
          name: "bonds",
          display_name: "Bonds",
          allocation_percentage: new Decimal(20.0),
          expected_return: new Decimal(3.0),
          volatility: new Decimal(5.0),
          liquidity_level: "low" as const,
        },
        {
          name: "cash",
          display_name: "Cash",
          allocation_percentage: new Decimal(10.0),
          expected_return: new Decimal(1.0),
          volatility: new Decimal(1.0),
          liquidity_level: "high" as const,
        },
      ],
      enable_rebalancing: true,
    },
  };

  // Convert income/expense items
  const income_items: IncomeExpenseItem[] = config.income_items.map((item) => ({
    id: item.id ?? "",
    name: item.name ?? "",
    after_tax_amount_per_period: new Decimal(
      item.after_tax_amount_per_period ?? 0,
    ),
    time_unit: item.time_unit ?? "annually",
    frequency: item.frequency ?? "recurring",
    interval_periods: item.interval_periods ?? 1,
    start_age: item.start_age ?? 25,
    end_age: item.end_age ?? 65,
    annual_growth_rate: new Decimal(item.annual_growth_rate ?? 0.0),
    is_income: item.is_income ?? true,
    category: item.category ?? "Other",
  }));

  const expense_items: IncomeExpenseItem[] = config.expense_items.map(
    (item) => ({
      id: item.id ?? "",
      name: item.name ?? "",
      after_tax_amount_per_period: new Decimal(
        item.after_tax_amount_per_period ?? 0,
      ),
      time_unit: item.time_unit ?? "annually",
      frequency: item.frequency ?? "recurring",
      interval_periods: item.interval_periods ?? 1,
      start_age: item.start_age ?? 25,
      end_age: item.end_age ?? 85,
      annual_growth_rate: new Decimal(item.annual_growth_rate ?? 0.0),
      is_income: item.is_income ?? false,
      category: item.category ?? "Other",
    }),
  );

  // Convert overrides
  const overrides: Override[] = config.overrides.map((override) =>
    createOverride({
      age: override.age,
      item_id: override.item_id,
      value:
        typeof override.value === "number"
          ? new Decimal(override.value)
          : new Decimal(override.value ?? 0),
    }),
  );

  // Convert simulation settings
  const simulation_settings = createSimulationSettings(
    config.simulation_settings,
  );

  return createPlannerData({
    user_profile,
    income_items,
    expense_items,
    overrides,
    simulation_settings,
    language: config.metadata.language ?? "en",
  });
}

/**
 * Convert PlannerData to PlannerConfigV1 for export
 */
export function plannerDataToConfig(
  plannerData: PlannerData,
  description = "",
): PlannerConfigV1 {
  return createPlannerConfigV1({
    metadata: {
      created_at: plannerData.created_at.toISOString(),
      updated_at: plannerData.updated_at.toISOString(),
      language: plannerData.language,
      description,
    },
    profile: plannerData.user_profile ? { ...plannerData.user_profile } : {},
    income_items: plannerData.income_items.map((item) => ({ ...item })),
    expense_items: plannerData.expense_items.map((item) => ({ ...item })),
    overrides: plannerData.overrides.map((override) => ({ ...override })),
    simulation_settings: { ...plannerData.simulation_settings },
  });
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Validate planner stage transition
 */
export function canTransitionToStage(
  currentStage: PlannerStage,
  targetStage: PlannerStage,
): boolean {
  const stageOrder = [
    PlannerStage.STAGE1_INPUT,
    PlannerStage.STAGE2_ADJUSTMENT,
    PlannerStage.STAGE3_ANALYSIS,
  ];

  const currentIndex = stageOrder.indexOf(currentStage);
  const targetIndex = stageOrder.indexOf(targetStage);

  // Can move forward or stay in same stage
  return targetIndex >= currentIndex;
}

/**
 * Get the next valid stage
 */
export function getNextStage(currentStage: PlannerStage): PlannerStage | null {
  switch (currentStage) {
    case PlannerStage.STAGE1_INPUT:
      return PlannerStage.STAGE2_ADJUSTMENT;
    case PlannerStage.STAGE2_ADJUSTMENT:
      return PlannerStage.STAGE3_ANALYSIS;
    case PlannerStage.STAGE3_ANALYSIS:
      return null; // Final stage
    default:
      return null;
  }
}

/**
 * Check if planner data is ready for specified stage
 */
export function isReadyForStage(
  data: PlannerData,
  stage: PlannerStage,
): boolean {
  switch (stage) {
    case PlannerStage.STAGE1_INPUT:
      return true; // Always can start at stage 1

    case PlannerStage.STAGE2_ADJUSTMENT:
      return (
        data.user_profile !== undefined &&
        data.income_items.length > 0 &&
        data.expense_items.length > 0
      );

    case PlannerStage.STAGE3_ANALYSIS:
      return (
        isReadyForStage(data, PlannerStage.STAGE2_ADJUSTMENT) &&
        data.projection_df !== undefined &&
        data.projection_df.length > 0
      );

    default:
      return false;
  }
}
