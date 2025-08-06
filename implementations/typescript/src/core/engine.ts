/**
 * FIRE calculation engine with portfolio management integration
 *
 * This module contains the core business logic for FIRE (Financial Independence,
 * Retire Early) calculations. It's a direct port of the Python engine.py to ensure
 * identical calculation results across platforms.
 *
 * Key responsibilities:
 * - Process annual financial projections
 * - Integrate with portfolio management
 * - Calculate sustainability metrics
 * - Track net worth progression over time
 *
 * Design principles:
 * - Function-to-function equivalence with Python version
 * - Immutable data flow for predictable results
 * - Type-safe interfaces for error prevention
 * - Clear separation of concerns
 */

import type {
  UserProfile,
  FIRECalculationResult,
  YearlyState,
  IncomeExpenseItem,
} from '../types';
import { PortfolioSimulator, LiquidityAwareFlowStrategy } from './portfolio';

// =============================================================================
// Input Types and Interfaces
// =============================================================================

/**
 * Annual financial projection data for a single year
 * Represents pre-calculated income/expense values
 */
export interface AnnualProjectionRow {
  /** User's age in this year */
  age: number;

  /** Calendar year */
  year: number;

  /** Total income for the year (final computed value) */
  total_income: number;

  /** Total expenses for the year (final computed value) */
  total_expense: number;
}

/**
 * Input data for FIRE calculation engine
 * Direct TypeScript equivalent of Python's EngineInput
 */
export interface EngineInput {
  /** User profile with personal and financial preferences */
  user_profile: UserProfile;

  /**
   * Annual financial projection data
   * IMPORTANT: All values are FINAL computed values:
   * - total_income: Base income + individual growth_rate applied over years
   * - total_expense: Base expense + individual growth_rate + inflation_rate applied
   * - Overrides from Stage 2 are applied to these final computed values
   * - Engine uses these values directly WITHOUT additional growth/inflation
   */
  annual_financial_projection: AnnualProjectionRow[];

  /** Optional detailed projection for advisor use */
  detailed_projection?: Record<string, unknown>[];

  /** List of income items for advisor analysis */
  income_items?: IncomeExpenseItem[];
}

// =============================================================================
// Core FIRE Engine Class
// =============================================================================

/**
 * Core FIRE calculation engine with portfolio management integration
 * Direct TypeScript port of Python's FIREEngine class
 */
export class FIREEngine {
  private readonly input: EngineInput;
  private readonly profile: UserProfile;
  private readonly projectionData: AnnualProjectionRow[];
  private readonly portfolioSimulator: PortfolioSimulator;

  /**
   * Initialize engine with input data
   *
   * @param engineInput - Complete input data for FIRE calculations
   */
  constructor(engineInput: EngineInput) {
    this.input = engineInput;
    this.profile = engineInput.user_profile;
    this.projectionData = engineInput.annual_financial_projection;

    // Set up portfolio simulator with liquidity-aware cash flow strategy
    const cashFlowStrategy = new LiquidityAwareFlowStrategy();
    this.portfolioSimulator = new PortfolioSimulator(
      this.profile,
      cashFlowStrategy
    );
  }

  /**
   * Run complete FIRE calculation and return results
   * Main entry point for FIRE analysis
   *
   * @returns Complete FIRE calculation result
   */
  calculate(): FIRECalculationResult {
    // Calculate yearly states using the core calculation logic
    const yearlyStates = this.calculateYearlyStates();

    // Create and return complete calculation result
    return this.createCalculationResult(yearlyStates);
  }

  /**
   * Get detailed yearly states for advanced analysis
   * Useful for debugging and detailed financial planning
   *
   * @returns Array of yearly financial states
   */
  getYearlyStates(): YearlyState[] {
    // Re-run calculation to get fresh states
    return this.calculateYearlyStates();
  }

  /**
   * Calculate state for a single year with pre-computed income/expense values
   * Core atomic calculation unit - mirrors Python's calculate_single_year exactly
   *
   * @param age - User's age in this year
   * @param year - Calendar year
   * @param totalIncome - Pre-computed total income for the year
   * @param totalExpense - Pre-computed total expenses for the year
   * @returns Complete yearly state
   */
  calculateSingleYear(
    age: number,
    year: number,
    totalIncome: number,
    totalExpense: number
  ): YearlyState {
    const netCashFlow = totalIncome - totalExpense;

    // Simulate portfolio for this year
    const portfolioResult = this.portfolioSimulator.simulateYear(
      age,
      netCashFlow,
      totalExpense
    );

    // Extract portfolio metrics
    const portfolioValue = portfolioResult.endingPortfolioValue;
    const investmentReturn = portfolioResult.investmentReturns;

    // Calculate sustainability metrics
    const safetyBufferAmount = totalExpense * (this.profile.safety_buffer_months / 12.0);
    const fireNumber = totalExpense * 25.0; // Traditional 4% rule
    const fireProgress = fireNumber > 0 ? portfolioValue / fireNumber : 0.0;

    // Sustainability is based on portfolio value being above safety buffer
    const isSustainable = portfolioValue >= safetyBufferAmount;

    return {
      age,
      year,
      total_income: totalIncome,
      total_expense: totalExpense,
      net_cash_flow: netCashFlow,
      portfolio_value: portfolioValue,
      net_worth: portfolioValue, // Will be adjusted in calculateYearlyStates for debt tracking
      investment_return: investmentReturn,
      is_sustainable: isSustainable,
      fire_number: fireNumber,
      fire_progress: fireProgress,
    };
  }

  /**
   * Calculate all yearly states using atomic single-year calculations
   * Handles debt accumulation when portfolio is depleted
   * Direct port of Python's _calculate_yearly_states method
   *
   * @returns Array of all yearly states with proper debt tracking
   */
  private calculateYearlyStates(): YearlyState[] {
    const yearlyStates: YearlyState[] = [];
    let cumulativeDebt = 0.0; // Track accumulated debt when portfolio is depleted

    // Reset portfolio simulator to initial state
    this.portfolioSimulator.resetToInitial();

    // Process each year atomically - projection data already has final computed values
    for (const row of this.projectionData) {
      const yearlyState = this.calculateSingleYear(
        row.age,
        row.year,
        row.total_income,
        row.total_expense
      );

      // Calculate true net worth with cumulative debt tracking
      const portfolioValue = yearlyState.portfolio_value;

      if (portfolioValue > 0) {
        // Portfolio has value - net worth is portfolio value
        yearlyState.net_worth = portfolioValue;
        cumulativeDebt = 0.0; // Reset debt when portfolio recovers
      } else {
        // Portfolio is depleted - accumulate debt
        if (yearlyState.net_cash_flow < 0) {
          cumulativeDebt += Math.abs(yearlyState.net_cash_flow);
        }
        yearlyState.net_worth = -cumulativeDebt; // Negative net worth indicates debt
      }

      yearlyStates.push(yearlyState);
    }

    return yearlyStates;
  }

  /**
   * Create FIRECalculationResult from yearly states
   * Analyzes yearly states to determine overall FIRE feasibility and metrics
   * Direct port of Python's _create_calculation_result method
   *
   * @param yearlyStates - Array of calculated yearly states
   * @returns Complete FIRE calculation result
   */
  private createCalculationResult(yearlyStates: YearlyState[]): FIRECalculationResult {
    // FIRE is achievable if ALL years are sustainable
    const isFIREAchievable = yearlyStates.length > 0
      ? yearlyStates.every(state => state.is_sustainable)
      : false;

    // Get net worth at expected FIRE age
    let fireNetWorth = 0.0;
    const currentAge = this.getCurrentAge();
    const expectedFireYearIndex = this.profile.expected_fire_age - currentAge;

    if (expectedFireYearIndex >= 0 && expectedFireYearIndex < yearlyStates.length) {
      const fireState = yearlyStates[expectedFireYearIndex];
      fireNetWorth = fireState.net_worth;
    }

    // Minimum net worth from expected FIRE age onwards
    let minNetWorthAfterFire = 0.0;
    if (expectedFireYearIndex >= 0 && expectedFireYearIndex < yearlyStates.length) {
      const postFireStates = yearlyStates.slice(expectedFireYearIndex);
      if (postFireStates.length > 0) {
        minNetWorthAfterFire = Math.min(...postFireStates.map(s => s.net_worth));
      } else {
        minNetWorthAfterFire = fireNetWorth;
      }
    }

    // Final net worth at life expectancy
    const finalNetWorth = yearlyStates.length > 0
      ? yearlyStates[yearlyStates.length - 1].net_worth
      : 0.0;

    // Safety buffer analysis - calculate dynamically for each year
    const safetyBufferRatios: number[] = [];
    for (const state of yearlyStates) {
      const safetyBufferAmount = state.total_expense * (this.profile.safety_buffer_months / 12.0);
      if (safetyBufferAmount > 0) {
        const ratio = state.net_worth / safetyBufferAmount;
        safetyBufferRatios.push(ratio);
      }
    }

    const minSafetyBufferRatio = safetyBufferRatios.length > 0
      ? Math.min(...safetyBufferRatios)
      : 0.0;

    // Traditional FIRE metrics for reference
    const traditionalFireExpenses = yearlyStates.length > 0
      ? yearlyStates[Math.min(expectedFireYearIndex, yearlyStates.length - 1)].total_expense
      : 0.0;
    const traditionalFireNumber = traditionalFireExpenses * 25.0;
    const traditionalFireAchieved = fireNetWorth >= traditionalFireNumber;

    // Calculate summary statistics
    const totalYearsSimulated = yearlyStates.length;
    const retirementYears = Math.max(0, this.profile.life_expectancy - this.profile.expected_fire_age);

    return {
      is_fire_achievable: isFIREAchievable,
      fire_net_worth: fireNetWorth,
      min_net_worth_after_fire: minNetWorthAfterFire,
      final_net_worth: finalNetWorth,
      safety_buffer_months: this.profile.safety_buffer_months,
      min_safety_buffer_ratio: minSafetyBufferRatio,
      yearly_results: yearlyStates,
      traditional_fire_number: traditionalFireNumber,
      traditional_fire_achieved: traditionalFireAchieved,
      fire_success_probability: undefined, // Will be populated by Monte Carlo
      total_years_simulated: totalYearsSimulated,
      retirement_years: retirementYears,
    };
  }

  /**
   * Get current age from birth year
   * Helper method for age calculations
   *
   * @returns Current age
   */
  private getCurrentAge(): number {
    const currentYear = new Date().getFullYear();
    return currentYear - this.profile.birth_year;
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Create engine input from user profile and projection data
 * Convenience function for creating properly typed engine input
 *
 * @param userProfile - User profile configuration
 * @param projectionData - Annual financial projection data
 * @param incomeItems - Optional income items for advisor analysis
 * @returns Properly typed engine input
 */
export const createEngineInput = (
  userProfile: UserProfile,
  projectionData: AnnualProjectionRow[],
  incomeItems?: IncomeExpenseItem[]
): EngineInput => {
  return {
    user_profile: userProfile,
    annual_financial_projection: projectionData,
    income_items: incomeItems,
  };
};

/**
 * Validate engine input data
 * Ensures input data is consistent and complete
 *
 * @param input - Engine input to validate
 * @returns Array of validation error messages
 */
export const validateEngineInput = (input: EngineInput): string[] => {
  const errors: string[] = [];

  // Check projection data exists and is non-empty
  if (!input.annual_financial_projection || input.annual_financial_projection.length === 0) {
    errors.push('Annual financial projection data is required');
  }

  // Check projection data is properly structured
  if (input.annual_financial_projection) {
    for (let i = 0; i < input.annual_financial_projection.length; i++) {
      const row = input.annual_financial_projection[i];
      if (!row.age || !row.year || row.total_income === undefined || row.total_expense === undefined) {
        errors.push(`Projection row ${i} is missing required fields`);
      }
    }
  }

  // Check user profile exists
  if (!input.user_profile) {
    errors.push('User profile is required');
  }

  return errors;
};
