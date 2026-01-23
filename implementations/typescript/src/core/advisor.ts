/**
 * FIRE Advisor - Provides optimization suggestions based on calculation results
 * Direct TypeScript port from Python advisor.py
 *
 * This module analyzes FIRE plans and provides structured recommendations for:
 * - Early retirement opportunities
 * - Delayed retirement solutions
 * - Income increase requirements
 * - Expense reduction strategies
 */

import { Decimal } from 'decimal.js';
import type {
  UserProfile,
  SimulationSettings,
  IncomeExpenseItem,
} from './data_models';
import { createSimulationSettings, getCurrentAgeAsOf } from './data_models';
import type {
  EngineInput,
  AnnualFinancialProjection,
  DetailedProjection,
} from './engine';
import { FIREEngine, createEngineInput } from './engine';
import { MonteCarloSimulator } from './monte_carlo';

// =============================================================================
// Data Models
// =============================================================================

/**
 * Simple recommendation with type and parameters for UI rendering
 * Direct TypeScript equivalent of Python's SimpleRecommendation dataclass
 */
export interface SimpleRecommendation {
  /** Recommendation type (early_retirement, delayed_retirement, etc.) */
  type: string;

  /** Parameters for UI rendering */
  params: Record<string, any>;

  /** Whether this recommendation makes FIRE achievable */
  is_achievable: boolean;

  /** Monte Carlo success rate for this recommendation */
  monte_carlo_success_rate?: Decimal;
}

// =============================================================================
// FIRE Advisor - Main Class
// =============================================================================

/**
 * FIRE Advisor that provides structured optimization recommendations
 * Direct TypeScript equivalent of Python's FIREAdvisor class
 *
 * This advisor generates language-agnostic structured data that can be
 * dynamically rendered in any language by the UI layer.
 */
export class FIREAdvisor {
  public readonly engine_input: EngineInput;
  public readonly profile: UserProfile;
  public readonly projection_df: AnnualFinancialProjection[];
  public readonly detailed_projection_df:
    | AnnualFinancialProjection[]
    | DetailedProjection[];
  public readonly income_items: IncomeExpenseItem[];

  constructor(engine_input: EngineInput, language?: string) {
    // language parameter is deprecated but kept for backward compatibility
    this.engine_input = engine_input;
    this.profile = engine_input.user_profile;
    this.projection_df = engine_input.annual_financial_projection;
    this.detailed_projection_df = [...engine_input.annual_financial_projection]; // Create a copy
    this.income_items = engine_input.income_items || [];
  }

  /**
   * Get engine input - compatibility method for tests
   */
  getEngineInput(): EngineInput {
    return this.engine_input;
  }

  /**
   * Get all advisor recommendations - compatibility method for tests
   * Delegates to the Python-style method name
   */
  async getAllRecommendations(): Promise<SimpleRecommendation[]> {
    return await this.get_all_recommendations();
  }

  /**
   * Get all advisor recommendations based on current FIRE feasibility
   */
  async get_all_recommendations(): Promise<SimpleRecommendation[]> {
    // First check if current plan is achievable
    const engine = new FIREEngine(this.engine_input);
    const base_result = engine.calculate();

    const recommendations: SimpleRecommendation[] = [];

    if (base_result.is_fire_achievable) {
      // Plan is achievable - find earliest possible retirement
      const early_rec = await this._find_earliest_retirement();
      if (early_rec) {
        recommendations.push(early_rec);
      }
    } else {
      // Plan not achievable - provide multiple solutions
      const delayed_rec = this._find_required_delayed_retirement();
      const income_rec = this._find_required_income_increase();
      const expense_rec = this._find_required_expense_reduction();

      // Filter out null recommendations (matching Python behavior)
      for (const rec of [delayed_rec, income_rec, expense_rec]) {
        if (rec) {
          recommendations.push(rec);
        }
      }
    }

    return recommendations;
  }

  /**
   * Find the earliest possible retirement age using binary search
   */
  private async _find_earliest_retirement(): Promise<SimpleRecommendation | null> {
    const current_expected_age = this.profile.expected_fire_age;
    const current_age = getCurrentAgeAsOf(
      this.profile.birth_year,
      this.profile.as_of_year ?? new Date().getFullYear()
    );

    // Start from one year earlier and work backwards
    let test_age = current_expected_age - 1;
    let earliest_achievable_age = current_expected_age;

    while (test_age >= current_age) {
      // Create modified profile with earlier FIRE age
      const modified_profile: UserProfile = {
        ...this.profile,
        expected_fire_age: test_age,
      };

      // Create modified projection with truncated work income
      const modified_detailed_projection =
        this._truncate_work_income_to_age(test_age);
      const modified_annual_projection =
        this._create_annual_summary_from_detailed_df(
          modified_detailed_projection
        );

      // Test this age
      const modified_input = createEngineInput(
        modified_profile,
        modified_annual_projection,
        this.income_items
      );

      const engine = new FIREEngine(modified_input);
      const result = engine.calculate();

      if (result.is_fire_achievable) {
        earliest_achievable_age = test_age;
        test_age -= 1;
      } else {
        break;
      }
    }

    if (earliest_achievable_age < current_expected_age) {
      // Get calculation results for the optimal age
      const optimal_profile: UserProfile = {
        ...this.profile,
        expected_fire_age: earliest_achievable_age,
      };

      // Create projection with truncated income for optimal age
      const optimal_detailed_projection = this._truncate_work_income_to_age(
        earliest_achievable_age
      );
      const optimal_annual_projection =
        this._create_annual_summary_from_detailed_df(
          optimal_detailed_projection
        );
      const optimal_input = createEngineInput(
        optimal_profile,
        optimal_annual_projection,
        this.income_items
      );

      const engine = new FIREEngine(optimal_input);
      engine.calculate();

      // Run Monte Carlo for this optimal age
      const optimal_engine = new FIREEngine(optimal_input);
      const mc_simulator = new MonteCarloSimulator(
        optimal_engine,
        createSimulationSettings({
          num_simulations: 1000,
          confidence_level: new Decimal(0.95),
          include_black_swan_events: true,
          income_base_volatility: new Decimal(0.1),
          income_minimum_factor: new Decimal(0.1),
          expense_base_volatility: new Decimal(0.05),
          expense_minimum_factor: new Decimal(0.5),
        })
      );
      const mc_result = await mc_simulator.run_simulation();

      const years_saved = current_expected_age - earliest_achievable_age;

      return {
        type: 'early_retirement',
        params: {
          age: earliest_achievable_age,
          years: years_saved,
          suggested_fire_age: earliest_achievable_age,
        },
        is_achievable: true,
        monte_carlo_success_rate: mc_result.success_rate,
      };
    }

    return null;
  }

  /**
   * Find the minimum age required for FIRE to be achievable
   */
  private _find_required_delayed_retirement(): SimpleRecommendation | null {
    const current_expected_age = this.profile.expected_fire_age;
    const legal_retirement_age = this.profile.legal_retirement_age;

    // Start from one year later and work forward
    let test_age = current_expected_age + 1;
    let required_age: number | null = null;

    while (test_age <= legal_retirement_age) {
      // Create modified profile with later FIRE age
      const modified_profile: UserProfile = {
        ...this.profile,
        expected_fire_age: test_age,
      };

      // Create modified detailed projection with extended work income
      const modified_detailed_projection =
        this._extend_work_income_to_age(test_age);

      // Convert to annual summary for engine
      const modified_annual_projection =
        this._create_annual_summary_from_detailed_df(
          modified_detailed_projection
        );

      // Test this age
      const modified_input = createEngineInput(
        modified_profile,
        modified_annual_projection,
        this.income_items
      );

      const engine = new FIREEngine(modified_input);
      const result = engine.calculate();

      if (result.is_fire_achievable) {
        required_age = test_age;
        break;
      }

      test_age += 1;
    }

    if (required_age) {
      const years_delayed = required_age - current_expected_age;

      return {
        type: 'delayed_retirement',
        params: {
          age: required_age,
          years: years_delayed,
        },
        is_achievable: true,
        monte_carlo_success_rate: undefined, // Match Python's null
      };
    }

    // If no feasible solution found within legal retirement age, still recommend delaying to legal age
    // This matches Python behavior of always trying to provide a solution
    const years_delayed = legal_retirement_age - current_expected_age;

    return {
      type: 'delayed_retirement_not_feasible',
      params: {
        age: legal_retirement_age,
      },
      is_achievable: false,
      monte_carlo_success_rate: undefined,
    };
  }

  /**
   * Find required income increase using binary search
   */
  private _find_required_income_increase(): SimpleRecommendation | null {
    const max_multiplier = new Decimal(5.0); // Maximum 500% income increase
    const precision = new Decimal(0.01); // Match Python's epsilon = 0.01
    let low = new Decimal(1.0);
    let high = max_multiplier;
    let required_multiplier: Decimal | null = null;

    let iteration = 0;
    // Binary search for minimum income multiplier
    while (high.sub(low).gt(precision)) {
      const mid = low.add(high).div(2);
      iteration++;

      // Create modified projection with increased income
      const modified_projection = this._apply_income_multiplier(mid);

      // Test this multiplier
      const modified_input = createEngineInput(
        this.profile,
        modified_projection,
        this.income_items
      );

      const engine = new FIREEngine(modified_input);
      const result = engine.calculate();

      if (result.is_fire_achievable) {
        required_multiplier = mid;
        high = mid;
      } else {
        low = mid;
      }

      if (iteration > 20) {
        break; // Prevent infinite loop
      }
    }

    if (required_multiplier && required_multiplier.gt(new Decimal(1.001))) {
      // Calculate additional income needed (matching Python logic)
      const original_income =
        this.projection_df[0]?.total_income || new Decimal(0);
      const additional_income = original_income.mul(
        required_multiplier.sub(new Decimal(1.0))
      );

      return {
        type: 'increase_income',
        params: {
          fire_age: this.profile.expected_fire_age,
          percentage: required_multiplier.sub(1).mul(100).toNumber(),
          amount: additional_income.toNumber(),
        },
        is_achievable: true,
        monte_carlo_success_rate: undefined, // Match Python's null behavior
      };
    }

    // If no feasible income increase found within reasonable limits, return null like Python
    return null;
  }

  /**
   * Find required expense reduction using binary search
   */
  private _find_required_expense_reduction(): SimpleRecommendation | null {
    // Binary search for the minimum expense reduction (matching Python logic)
    let low = new Decimal(0.0); // 0% reduction
    let high = new Decimal(0.8); // 80% reduction
    const epsilon = new Decimal(0.001); // Precision for binary search
    let optimal_reduction: Decimal | null = null;

    while (high.sub(low).gt(epsilon)) {
      const mid = low.add(high).div(2);
      const reduction_factor = new Decimal(1.0).sub(mid); // Convert reduction rate to multiplier

      // Create modified projection with reduced expenses
      const modified_projection =
        this._apply_expense_multiplier(reduction_factor);

      // Test this reduction
      const modified_input = createEngineInput(
        this.profile,
        modified_projection,
        this.income_items
      );

      const engine = new FIREEngine(modified_input);
      const result = engine.calculate();

      if (result.is_fire_achievable) {
        optimal_reduction = mid;
        high = mid;
      } else {
        low = mid;
      }
    }

    if (optimal_reduction && optimal_reduction.gt(new Decimal(0.001))) {
      // Calculate annual savings needed (matching Python logic)
      // Find first non-zero expense or use average if all are problematic
      let original_expense = new Decimal(0);

      // Try to find first non-zero expense
      for (const row of this.projection_df) {
        if (row.total_expense && row.total_expense.gt(0)) {
          original_expense = row.total_expense;
          break;
        }
      }

      // If still zero, calculate average expense from all non-zero rows
      if (original_expense.eq(0)) {
        const nonZeroExpenses = this.projection_df
          .map(row => row.total_expense)
          .filter(exp => exp && exp.gt(0));

        if (nonZeroExpenses.length > 0) {
          const sum = nonZeroExpenses.reduce(
            (acc, exp) => acc.add(exp),
            new Decimal(0)
          );
          original_expense = sum.div(nonZeroExpenses.length);
        }
      }

      const annual_savings = original_expense.mul(optimal_reduction);

      return {
        type: 'reduce_expenses',
        params: {
          fire_age: this.profile.expected_fire_age,
          percentage: optimal_reduction.mul(100).toNumber(),
          amount: annual_savings.toNumber(),
        },
        is_achievable: true,
        monte_carlo_success_rate: undefined, // Match Python's null behavior
      };
    }

    // If no feasible expense reduction found within reasonable limits, return null like Python
    return null;
  }

  // =============================================================================
  // Helper Methods for Projection Manipulation
  // =============================================================================

  /**
   * Extend work income to a later FIRE age
   * Direct TypeScript port of Python's _extend_work_income_to_age logic
   */
  private _extend_work_income_to_age(
    target_fire_age: number
  ): AnnualFinancialProjection[] {
    if (!this.income_items || this.income_items.length === 0) {
      throw new Error('Income items required for income extension');
    }

    // Create deep copy to avoid modifying original data
    const extended_projection = this.detailed_projection_df.map(row => ({
      ...row,
    }));
    const current_fire_age = this.profile.expected_fire_age;

    // If target age is not later than current, return unchanged
    if (target_fire_age <= current_fire_age) {
      return extended_projection;
    }

    // Find income items that end at current FIRE age (work income)
    const work_income_items = this.income_items.filter(
      item => item.end_age && item.end_age === current_fire_age
    );

    if (work_income_items.length === 0) {
      // No work income to extend
      return extended_projection;
    }

    // For each work income item, extend it to target age
    for (const item of work_income_items) {
      // Calculate the growth pattern for extending this income
      for (let age = item.end_age + 1; age <= target_fire_age; age++) {
        // Find the row for this age
        const row_index = extended_projection.findIndex(row => row.age === age);

        if (row_index !== -1) {
          // Calculate extended income value with proper growth
          const years_since_start = new Decimal(age - item.start_age);
          const growth_rate_decimal = new Decimal(item.annual_growth_rate).div(
            100
          );
          const growth_factor = new Decimal(1)
            .add(growth_rate_decimal)
            .pow(years_since_start);
          const extended_income =
            item.after_tax_amount_per_period.mul(growth_factor);

          // Set this income directly (not cumulative, since this age shouldn't have work income yet)
          extended_projection[row_index].total_income = extended_income;
        }
      }
    }

    return extended_projection;
  }

  /**
   * Truncate work income to an earlier FIRE age
   */
  private _truncate_work_income_to_age(
    target_fire_age: number
  ): AnnualFinancialProjection[] {
    // Create deep copy to avoid modifying original data
    const modified_projection = this.detailed_projection_df.map(row => ({
      ...row,
    }));
    const current_age = getCurrentAgeAsOf(
      this.profile.birth_year,
      this.profile.as_of_year ?? new Date().getFullYear()
    );

    // Zero out income for years after target FIRE age
    for (let i = 0; i < modified_projection.length; i++) {
      const age = current_age + i;

      if (age > target_fire_age) {
        modified_projection[i].total_income = new Decimal(0);
      }
    }

    return modified_projection;
  }

  /**
   * Apply income multiplier to all income sources
   */
  private _apply_income_multiplier(
    multiplier: Decimal
  ): AnnualFinancialProjection[] {
    return this.projection_df.map(row => ({
      ...row,
      total_income: row.total_income.mul(multiplier),
      net_cash_flow: row.total_income.mul(multiplier).sub(row.total_expense),
    }));
  }

  /**
   * Apply expense multiplier to all expenses
   */
  private _apply_expense_multiplier(
    multiplier: Decimal
  ): AnnualFinancialProjection[] {
    return this.projection_df.map(row => ({
      ...row,
      total_expense: row.total_expense.mul(multiplier),
      net_cash_flow: row.total_income.sub(row.total_expense.mul(multiplier)),
    }));
  }

  /**
   * Create annual summary from detailed DataFrame
   * Handles the case where detailed projection might be the same as annual
   */
  private _create_annual_summary_from_detailed_df(
    detailed_df: AnnualFinancialProjection[]
  ): AnnualFinancialProjection[] {
    // For TypeScript implementation, we assume detailed_df is already in the right format
    // In Python this involves complex pandas grouping, but our data is already annual
    return detailed_df.map(row => ({
      ...row,
      net_cash_flow: row.total_income.sub(row.total_expense),
    }));
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a SimpleRecommendation
 */
export function createSimpleRecommendation(
  data: Partial<SimpleRecommendation>
): SimpleRecommendation {
  return {
    type: data.type || '',
    params: data.params || {},
    is_achievable: data.is_achievable ?? true,
    monte_carlo_success_rate: data.monte_carlo_success_rate,
  };
}

/**
 * Create advisor instance - compatibility function for tests
 */
export function createAdvisor(
  engine_input: EngineInput,
  language?: string
): FIREAdvisor {
  return new FIREAdvisor(engine_input, language);
}
