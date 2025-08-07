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

import type {
  UserProfile,
  SimulationSettings,
  IncomeExpenseItem
} from './data_models';
import {
  createSimulationSettings,
  getCurrentAge
} from './data_models';
import type {
  EngineInput,
  AnnualFinancialProjection
} from './engine';
import {
  FIREEngine,
  createEngineInput
} from './engine';
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
  monte_carlo_success_rate?: number;
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
  public readonly detailed_projection_df: AnnualFinancialProjection[];
  public readonly income_items: IncomeExpenseItem[];

  constructor(engine_input: EngineInput, language?: string) {
    // language parameter is deprecated but kept for backward compatibility
    this.engine_input = engine_input;
    this.profile = engine_input.user_profile;
    this.projection_df = engine_input.annual_financial_projection;
    this.detailed_projection_df = engine_input.annual_financial_projection;
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
  getAllRecommendations(): SimpleRecommendation[] {
    return this.get_all_recommendations();
  }

  /**
   * Get all advisor recommendations based on current FIRE feasibility
   */
  get_all_recommendations(): SimpleRecommendation[] {
    // First check if current plan is achievable
    const engine = new FIREEngine(this.engine_input);
    const base_result = engine.calculate();

    const recommendations: SimpleRecommendation[] = [];

    if (base_result.is_fire_achievable) {
      // Plan is achievable - find earliest possible retirement
      const early_rec = this._find_earliest_retirement();
      if (early_rec) {
        recommendations.push(early_rec);
      }
    } else {
      // Plan not achievable - provide multiple solutions
      const delayed_rec = this._find_required_delayed_retirement();
      const income_rec = this._find_required_income_increase();
      const expense_rec = this._find_required_expense_reduction();

      // Always add all three recommendations since we now return non-null recommendations
      recommendations.push(delayed_rec);
      recommendations.push(income_rec);
      recommendations.push(expense_rec);
    }

    return recommendations;
  }

  /**
   * Find the earliest possible retirement age using binary search
   */
  private _find_earliest_retirement(): SimpleRecommendation | null {
    const current_expected_age = this.profile.expected_fire_age;
    const current_age = getCurrentAge(this.profile.birth_year);

    // Start from one year earlier and work backwards
    let test_age = current_expected_age - 1;
    let earliest_achievable_age = current_expected_age;

    while (test_age >= current_age) {
      // Create modified profile with earlier FIRE age
      const modified_profile: UserProfile = {
        ...this.profile,
        expected_fire_age: test_age
      };

      // Create modified projection with truncated work income
      const modified_detailed_projection = this._truncate_work_income_to_age(test_age);
      const modified_annual_projection = this._create_annual_summary_from_detailed_df(
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
        expected_fire_age: earliest_achievable_age
      };

      // Create projection with truncated income for optimal age
      const optimal_detailed_projection = this._truncate_work_income_to_age(
        earliest_achievable_age
      );
      const optimal_annual_projection = this._create_annual_summary_from_detailed_df(
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
          confidence_level: 0.95,
          include_black_swan_events: true,
          income_base_volatility: 0.1,
          income_minimum_factor: 0.1,
          expense_base_volatility: 0.05,
          expense_minimum_factor: 0.5,
        })
      );
      const mc_result = mc_simulator.run_simulation();

      const years_saved = current_expected_age - earliest_achievable_age;

      return {
        type: 'early_retirement',
        params: {
          age: earliest_achievable_age,
          years: years_saved,
          suggested_fire_age: earliest_achievable_age
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
  private _find_required_delayed_retirement(): SimpleRecommendation {
    const current_expected_age = this.profile.expected_fire_age;
    const legal_retirement_age = this.profile.legal_retirement_age;

    // Start from one year later and work forward
    let test_age = current_expected_age + 1;
    let required_age: number | null = null;

    while (test_age <= legal_retirement_age) {
      // Create modified profile with later FIRE age
      const modified_profile: UserProfile = {
        ...this.profile,
        expected_fire_age: test_age
      };

      // Create modified detailed projection with extended work income
      const modified_detailed_projection = this._extend_work_income_to_age(test_age);

      // Convert to annual summary for engine
      const modified_annual_projection = this._create_annual_summary_from_detailed_df(
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
      // Get final results for Monte Carlo analysis
      const optimal_profile: UserProfile = {
        ...this.profile,
        expected_fire_age: required_age
      };

      const optimal_detailed_projection = this._extend_work_income_to_age(required_age);
      const optimal_annual_projection = this._create_annual_summary_from_detailed_df(
        optimal_detailed_projection
      );
      const optimal_input = createEngineInput(
        optimal_profile,
        optimal_annual_projection,
        this.income_items
      );

      // Run Monte Carlo for delayed retirement scenario
      const optimal_engine = new FIREEngine(optimal_input);
      const mc_simulator = new MonteCarloSimulator(
        optimal_engine,
        createSimulationSettings({
          num_simulations: 1000,
          confidence_level: 0.95,
          include_black_swan_events: true,
          income_base_volatility: 0.1,
          income_minimum_factor: 0.1,
          expense_base_volatility: 0.05,
          expense_minimum_factor: 0.5,
        })
      );
      const mc_result = mc_simulator.run_simulation();

      const years_delayed = required_age - current_expected_age;

      return {
        type: 'delayed_retirement',
        params: {
          age: required_age,
          years: years_delayed,
          suggested_fire_age: required_age
        },
        is_achievable: true,
        monte_carlo_success_rate: mc_result.success_rate,
      };
    }

    // If no feasible solution found within legal retirement age, still recommend delaying to legal age
    // This matches Python behavior of always trying to provide a solution
    const years_delayed = legal_retirement_age - current_expected_age;

    return {
      type: 'delayed_retirement',
      params: {
        age: legal_retirement_age,
        years: years_delayed,
        suggested_fire_age: legal_retirement_age,
        message: 'Consider working until legal retirement age'
      },
      is_achievable: true, // Match Python behavior - always try to provide a solution
    };
  }

  /**
   * Find required income increase using binary search
   */
  private _find_required_income_increase(): SimpleRecommendation {
    const max_multiplier = 5.0; // Maximum 500% income increase
    const precision = 0.001;
    let low = 1.0;
    let high = max_multiplier;
    let required_multiplier: number | null = null;

    // Binary search for minimum income multiplier
    while (high - low > precision) {
      const mid = (low + high) / 2;

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
    }

    if (required_multiplier && required_multiplier > 1.001) {
      // Run Monte Carlo for this income scenario
      const optimal_projection = this._apply_income_multiplier(required_multiplier);
      const optimal_input = createEngineInput(
        this.profile,
        optimal_projection,
        this.income_items
      );

      const optimal_engine = new FIREEngine(optimal_input);
      const mc_simulator = new MonteCarloSimulator(
        optimal_engine,
        createSimulationSettings({
          num_simulations: 1000,
          confidence_level: 0.95,
          include_black_swan_events: true,
          income_base_volatility: 0.1,
          income_minimum_factor: 0.1,
          expense_base_volatility: 0.05,
          expense_minimum_factor: 0.5,
        })
      );
      const mc_result = mc_simulator.run_simulation();

      const percentage_increase = (required_multiplier - 1.0) * 100;

      return {
        type: 'income_increase',
        params: {
          multiplier: required_multiplier,
          percentage: Math.round(percentage_increase)
        },
        is_achievable: true,
        monte_carlo_success_rate: mc_result.success_rate,
      };
    }

    // If no feasible income increase found within reasonable limits
    return {
      type: 'income_increase',
      params: {
        multiplier: max_multiplier,
        percentage: Math.round((max_multiplier - 1.0) * 100),
        message: 'Required income increase may be impractical'
      },
      is_achievable: false,
    };
  }

  /**
   * Find required expense reduction using binary search
   */
  private _find_required_expense_reduction(): SimpleRecommendation {
    const min_multiplier = 0.2; // Maximum 80% expense reduction
    const precision = 0.001;
    let low = min_multiplier;
    let high = 1.0;
    let required_multiplier: number | null = null;

    // Binary search for maximum expense multiplier (minimum expenses)
    while (high - low > precision) {
      const mid = (low + high) / 2;

      // Create modified projection with reduced expenses
      const modified_projection = this._apply_expense_multiplier(mid);

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
    }

    if (required_multiplier && required_multiplier < 0.999) {
      // Run Monte Carlo for this expense scenario
      const optimal_projection = this._apply_expense_multiplier(required_multiplier);
      const optimal_input = createEngineInput(
        this.profile,
        optimal_projection,
        this.income_items
      );

      const optimal_engine = new FIREEngine(optimal_input);
      const mc_simulator = new MonteCarloSimulator(
        optimal_engine,
        createSimulationSettings({
          num_simulations: 1000,
          confidence_level: 0.95,
          include_black_swan_events: true,
          income_base_volatility: 0.1,
          income_minimum_factor: 0.1,
          expense_base_volatility: 0.05,
          expense_minimum_factor: 0.5,
        })
      );
      const mc_result = mc_simulator.run_simulation();

      const percentage_reduction = (1.0 - required_multiplier) * 100;

      return {
        type: 'expense_reduction',
        params: {
          multiplier: required_multiplier,
          percentage: Math.round(percentage_reduction),
          suggested_reduction_percent: Math.round(percentage_reduction)
        },
        is_achievable: true,
        monte_carlo_success_rate: mc_result.success_rate,
      };
    }

    // If no feasible expense reduction found within reasonable limits, suggest maximum reduction
    // This matches Python behavior of always trying to provide a solution
    const max_reduction_percentage = Math.round((1.0 - min_multiplier) * 100);

    return {
      type: 'expense_reduction',
      params: {
        multiplier: min_multiplier,
        percentage: max_reduction_percentage,
        suggested_reduction_percent: max_reduction_percentage,
        message: 'Consider significant expense reduction'
      },
      is_achievable: true, // Match Python behavior - always try to provide a solution
    };
  }

  // =============================================================================
  // Helper Methods for Projection Manipulation
  // =============================================================================

  /**
   * Extend work income to a later FIRE age
   */
  private _extend_work_income_to_age(target_fire_age: number): AnnualFinancialProjection[] {
    const modified_projection = [...this.detailed_projection_df];
    const current_age = getCurrentAge(this.profile.birth_year);
    const current_year = new Date().getFullYear();

    // Find the last working year data to use as a template
    // Look for the last row that has income data
    let working_year_template: AnnualFinancialProjection | null = null;

    // Try to find a row with income data, preferably around expected FIRE age
    for (let i = modified_projection.length - 1; i >= 0; i--) {
      const row = modified_projection[i];
      if (row.total_income > 0) {
        working_year_template = row;
        break;
      }
    }

    // If no income data found, use first row or create a default
    if (!working_year_template) {
      if (modified_projection.length > 0) {
        working_year_template = {
          ...modified_projection[0],
          total_income: modified_projection[0].total_income || 40000 // Default income for testing
        };
      } else {
        working_year_template = {
          age: current_age,
          year: current_year,
          total_income: 40000,
          total_expense: 60000
        };
      }
    }

    // Extend projection to cover all years from current age to life expectancy
    const life_expectancy = this.profile.life_expectancy;
    const years_needed = life_expectancy - current_age + 1;

    // Build a complete projection array
    const complete_projection: AnnualFinancialProjection[] = [];

    for (let i = 0; i < years_needed; i++) {
      const age = current_age + i;
      const year = current_year + i;

      // Try to find existing data for this age
      let existing_row = modified_projection.find(row => row.age === age);

      if (existing_row) {
        // Use existing data
        complete_projection.push({ ...existing_row });
      } else {
        // Create new row based on the last available row
        const last_available = modified_projection[modified_projection.length - 1];
        if (last_available) {
          complete_projection.push({
            age: age,
            year: year,
            total_income: 0, // No income by default for future years
            total_expense: last_available.total_expense // Keep same expense level
          });
        } else {
          // Fallback to template
          complete_projection.push({
            age: age,
            year: year,
            total_income: 0,
            total_expense: working_year_template.total_expense
          });
        }
      }
    }

    // Now extend work income for ages between original FIRE age and target FIRE age
    for (let i = 0; i < complete_projection.length; i++) {
      const row = complete_projection[i];
      const age = current_age + i;

      // If this age is between original FIRE age and target FIRE age, extend work income
      if (age > this.profile.expected_fire_age && age <= target_fire_age) {
        row.total_income = working_year_template.total_income;
      }
    }

    return complete_projection;
  }

  /**
   * Truncate work income to an earlier FIRE age
   */
  private _truncate_work_income_to_age(target_fire_age: number): AnnualFinancialProjection[] {
    const modified_projection = [...this.detailed_projection_df];
    const current_age = getCurrentAge(this.profile.birth_year);

    // Zero out income for years after target FIRE age
    for (let i = 0; i < modified_projection.length; i++) {
      const age = current_age + i;

      if (age > target_fire_age) {
        modified_projection[i].total_income = 0;
      }
    }

    return modified_projection;
  }

  /**
   * Apply income multiplier to all income sources
   */
  private _apply_income_multiplier(multiplier: number): AnnualFinancialProjection[] {
    return this.projection_df.map(row => ({
      ...row,
      total_income: row.total_income * multiplier,
      net_cash_flow: (row.total_income * multiplier) - row.total_expense
    }));
  }

  /**
   * Apply expense multiplier to all expenses
   */
  private _apply_expense_multiplier(multiplier: number): AnnualFinancialProjection[] {
    return this.projection_df.map(row => ({
      ...row,
      total_expense: row.total_expense * multiplier,
      net_cash_flow: row.total_income - (row.total_expense * multiplier)
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
      net_cash_flow: row.total_income - row.total_expense
    }));
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a SimpleRecommendation
 */
export function createSimpleRecommendation(data: Partial<SimpleRecommendation>): SimpleRecommendation {
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
export function createAdvisor(engine_input: EngineInput, language?: string): FIREAdvisor {
  return new FIREAdvisor(engine_input, language);
}
