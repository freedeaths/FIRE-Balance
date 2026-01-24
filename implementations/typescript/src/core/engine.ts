/**
 * FIRE calculation engine with portfolio management integration
 * Direct TypeScript port from Python engine.py
 *
 * This module contains the core FIRE calculation logic that processes yearly
 * financial data and integrates with the portfolio management system.
 */

import Decimal from 'decimal.js';
import type {
  FIRECalculationResult,
  UserProfile,
  YearlyState,
} from './data_models';
import { getCurrentAgeAsOf } from './data_models';
import { getRequiredSafetyBufferMonths } from './safety_buffer';
import { LiquidityAwareFlowStrategy, PortfolioSimulator } from './portfolio';

// =============================================================================
// Engine Input Data Structure
// =============================================================================

/**
 * Input data for FIRE calculation engine
 * Direct TypeScript equivalent of Python's EngineInput dataclass
 */
export interface EngineInput {
  user_profile: UserProfile;
  annual_financial_projection: AnnualFinancialProjection[];
  // DataFrame columns: ['age', 'year', 'total_income', 'total_expense']
  // IMPORTANT: All values in DataFrame are FINAL computed values:
  // - total_income: Base income + individual growth_rate applied over years
  // - total_expense: Base expense + individual growth_rate + inflation_rate applied
  // - Overrides from Stage 2 are applied to these final computed values
  // - Engine should use the values directly WITHOUT additional growth/inflation
  // - This design keeps Engine simple and pushes complexity to Planner layer

  // Optional detailed projection for advisor use
  detailed_projection?: DetailedProjection[];
  // DataFrame with individual income/expense item columns plus 'age' and 'year'
  // This allows advisor to manipulate specific income streams (e.g., work income)
  income_items?: any[] | null; // List of IncomeExpenseItem objects for income identification
  // Note: expense_items removed as current expense logic only uses aggregated totals
}

/**
 * Annual financial projection row
 * Direct equivalent to Python DataFrame row
 */
export interface AnnualFinancialProjection {
  age: number;
  year: number;
  total_income: Decimal;
  total_expense: Decimal;
}

/**
 * Detailed projection for advisor use
 * Contains individual income/expense item columns
 */
export interface DetailedProjection {
  age: number;
  year: number;
  [key: string]: number | Decimal; // Individual income/expense columns (mixed for backward compatibility)
}

// =============================================================================
// FIRE Engine - Core Calculation Logic
// =============================================================================

/**
 * Core FIRE calculation engine with portfolio management integration
 * Direct TypeScript equivalent of Python's FIREEngine class
 */
export class FIREEngine {
  public readonly input: EngineInput;
  public readonly profile: UserProfile;
  public readonly projection_df: AnnualFinancialProjection[];
  public readonly portfolio_simulator: PortfolioSimulator;

  constructor(engineInput: EngineInput) {
    this.input = engineInput;
    this.profile = engineInput.user_profile;
    this.projection_df = engineInput.annual_financial_projection;

    // Set up portfolio simulator
    const cashFlowStrategy = new LiquidityAwareFlowStrategy();
    this.portfolio_simulator = new PortfolioSimulator(
      this.profile,
      cashFlowStrategy
    );
  }

  /**
   * Run complete FIRE calculation and return results
   */
  calculate(): FIRECalculationResult {
    // Get yearly states using the core calculation logic
    const yearlyStates = this._calculateYearlyStates();

    // Create and return complete calculation result
    return this._createCalculationResult(yearlyStates);
  }

  /**
   * Get detailed yearly states for advanced analysis
   */
  get_yearly_states(): YearlyState[] {
    // Re-run calculation to get fresh states
    return this._calculateYearlyStates();
  }

  private _getRequiredSafetyBufferMonths(age: number): Decimal {
    return getRequiredSafetyBufferMonths({
      age,
      expectedFireAge: this.profile.expected_fire_age,
      legalRetirementAge: this.profile.legal_retirement_age,
      baseSafetyBufferMonths: this.profile.safety_buffer_months,
      bridgeDiscountRatePercent: this.profile.bridge_discount_rate,
    });
  }

  /**
   * Calculate state for a single year with pre-computed income/expense values
   */
  calculate_single_year(
    age: number,
    year: number,
    total_income: Decimal,
    total_expense: Decimal
  ): YearlyState {
    const net_cash_flow = total_income.sub(total_expense);

    // Simulate portfolio for this year
    const portfolio_result = this.portfolio_simulator.simulate_year(
      age,
      net_cash_flow,
      total_expense
    );

    // Calculate financial metrics
    const portfolio_value = portfolio_result.ending_portfolio_value;

    // Calculate sustainability metrics
    const required_safety_buffer_months =
      this._getRequiredSafetyBufferMonths(age);
    const twelve_decimal = new Decimal(12.0);
    const twenty_five_decimal = new Decimal(25.0);
    const zero_decimal = new Decimal(0.0);

    const safety_buffer_amount = total_expense.mul(
      required_safety_buffer_months.div(twelve_decimal)
    );
    const fire_number = total_expense.mul(twenty_five_decimal);
    const fire_progress = fire_number.gt(zero_decimal)
      ? portfolio_value.div(fire_number)
      : zero_decimal;
    const is_sustainable = portfolio_value.gte(safety_buffer_amount); // portfolio_value is net_worth here

    return {
      age,
      year,
      total_income,
      total_expense,
      net_cash_flow,
      portfolio_value,
      net_worth: portfolio_value, // portfolio_value is net_worth here
      investment_return: portfolio_result.investment_returns,
      is_sustainable,
      fire_number,
      fire_progress,
    };
  }

  /**
   * Calculate all yearly states using atomic single-year calculations
   */
  private _calculateYearlyStates(): YearlyState[] {
    const yearly_states: YearlyState[] = [];
    let cumulative_debt = new Decimal(0.0); // Track accumulated debt when portfolio is depleted
    let starting_portfolio_value = new Decimal(this.profile.current_net_worth);
    const zero_decimal = new Decimal(0);

    // Reset portfolio simulator to initial state
    this.portfolio_simulator.reset_to_initial();

    // Process each year atomically - DataFrame already has final computed values
    for (const row of this.projection_df) {
      const yearly_state = this.calculate_single_year(
        row.age,
        row.year,
        row.total_income,
        row.total_expense
      );

      // Calculate true net worth with cumulative debt tracking
      const portfolio_value = yearly_state.portfolio_value;

      if (portfolio_value.gt(zero_decimal)) {
        // Portfolio has value - net worth is portfolio value
        yearly_state.net_worth = portfolio_value;
        cumulative_debt = new Decimal(0.0); // Reset debt when portfolio recovers
      } else {
        // Portfolio is depleted - accumulate ONLY the unfunded shortfall.
        if (yearly_state.net_cash_flow.lt(zero_decimal)) {
          const required_cash = yearly_state.net_cash_flow.abs();
          const available_cash = starting_portfolio_value.add(
            yearly_state.investment_return
          );
          const shortfall = required_cash.sub(available_cash);
          if (shortfall.gt(zero_decimal)) {
            cumulative_debt = cumulative_debt.add(shortfall);
          }
        }
        yearly_state.net_worth = cumulative_debt.neg(); // Negative net worth indicates debt
      }

      yearly_states.push(yearly_state);
      starting_portfolio_value = portfolio_value;
    }

    return yearly_states;
  }

  /**
   * Create FIRECalculationResult from yearly states and results
   */
  private _createCalculationResult(
    yearly_states: YearlyState[]
  ): FIRECalculationResult {
    // FIRE is achievable if ALL years are sustainable
    const is_fire_achievable =
      yearly_states.length > 0
        ? yearly_states.every(state => state.is_sustainable)
        : false;

    // Get net worth at expected FIRE age
    let fire_net_worth = new Decimal(0.0);
    const expected_fire_year_index =
      this.profile.expected_fire_age -
      getCurrentAgeAsOf(this.profile.birth_year, this.profile.as_of_year);
    if (
      expected_fire_year_index >= 0 &&
      expected_fire_year_index < yearly_states.length
    ) {
      const fire_state = yearly_states[expected_fire_year_index];
      fire_net_worth = fire_state.net_worth;
    }

    // Minimum net worth from expected FIRE age onwards
    let min_net_worth_after_fire = new Decimal(0.0);
    if (
      expected_fire_year_index >= 0 &&
      expected_fire_year_index < yearly_states.length
    ) {
      const post_fire_states = yearly_states.slice(expected_fire_year_index);
      if (post_fire_states.length > 0) {
        // Find minimum net worth using Decimal comparison
        min_net_worth_after_fire = post_fire_states.reduce(
          (min, state) => (state.net_worth.lt(min) ? state.net_worth : min),
          post_fire_states[0].net_worth
        );
      } else {
        min_net_worth_after_fire = fire_net_worth;
      }
    }

    const final_net_worth =
      yearly_states.length > 0
        ? yearly_states[yearly_states.length - 1].net_worth
        : new Decimal(0.0);

    // Safety buffer analysis - calculate dynamically
    const safety_buffer_ratios: Decimal[] = [];
    const twelve_decimal = new Decimal(12.0);
    const zero_decimal = new Decimal(0);

    for (const s of yearly_states) {
      const safety_buffer_amount = s.total_expense.mul(
        this._getRequiredSafetyBufferMonths(s.age).div(twelve_decimal)
      );
      if (safety_buffer_amount.gt(zero_decimal)) {
        const ratio = s.net_worth.div(safety_buffer_amount); // Use net_worth instead of portfolio_value
        safety_buffer_ratios.push(ratio);
      }
    }

    const min_safety_buffer_ratio =
      safety_buffer_ratios.length > 0
        ? safety_buffer_ratios.reduce(
            (min, ratio) => (ratio.lt(min) ? ratio : min),
            safety_buffer_ratios[0]
          )
        : new Decimal(0.0);

    // Traditional FIRE metrics for reference
    const five_decimal = new Decimal(5);
    const twenty_five_decimal = new Decimal(25);

    let traditional_fire_expenses = new Decimal(0);
    if (yearly_states.length >= 5) {
      const first_five_expenses = yearly_states.slice(0, 5);
      const sum = first_five_expenses.reduce(
        (sum, s) => sum.add(s.total_expense),
        new Decimal(0)
      );
      traditional_fire_expenses = sum.div(five_decimal);
    }

    const traditional_fire_number =
      traditional_fire_expenses.mul(twenty_five_decimal);
    const traditional_fire_achieved = yearly_states.some(s =>
      s.portfolio_value.gte(traditional_fire_number)
    );

    return {
      is_fire_achievable,
      fire_net_worth,
      min_net_worth_after_fire,
      final_net_worth,
      safety_buffer_months: this.profile.safety_buffer_months,
      min_safety_buffer_ratio,
      yearly_results: yearly_states,
      traditional_fire_number,
      traditional_fire_achieved,
      fire_success_probability: null, // Will be set by Monte Carlo
      total_years_simulated: yearly_states.length,
      retirement_years:
        expected_fire_year_index >= 0
          ? yearly_states.length - expected_fire_year_index
          : 0,
    };
  }
}

// =============================================================================
// Factory Functions for Convenience
// =============================================================================

/**
 * Create EngineInput from basic parameters
 */
export function createEngineInput(
  user_profile: UserProfile,
  projection_data: AnnualFinancialProjection[],
  income_items?: any[]
): EngineInput {
  return {
    user_profile,
    annual_financial_projection: projection_data,
    income_items: income_items || null,
  };
}

/**
 * Create AnnualFinancialProjection row
 */
export function createProjectionRow(
  age: number,
  year: number,
  total_income: number,
  total_expense: number
): AnnualFinancialProjection {
  return {
    age,
    year,
    total_income: new Decimal(total_income),
    total_expense: new Decimal(total_expense),
  };
}
