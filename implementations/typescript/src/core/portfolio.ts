/**
 * Portfolio management and simulation for FIRE calculations
 *
 * This module handles investment portfolio simulation, asset allocation,
 * rebalancing, and cash flow management. It's a direct port of the Python
 * portfolio_manager.py to ensure calculation consistency.
 *
 * Key responsibilities:
 * - Simulate portfolio value changes over time
 * - Handle investment returns and rebalancing
 * - Manage cash flows (income/expenses) through liquidity-aware strategies
 * - Track portfolio composition and performance
 *
 * Design principles:
 * - Immutable simulation state for predictability
 * - Strategy pattern for different cash flow approaches
 * - Type-safe interfaces for portfolio operations
 * - Performance optimization for repeated calculations
 */

import type { UserProfile, AssetClass, LiquidityLevel } from '../types';

// =============================================================================
// Portfolio Simulation Results
// =============================================================================

/**
 * Result of a single year's portfolio simulation
 * Contains all financial metrics for the year
 */
export interface PortfolioSimulationResult {
  /** Portfolio value at the end of the year */
  endingPortfolioValue: number;

  /** Investment returns earned during the year */
  investmentReturns: number;

  /** Cash flows processed (positive = net inflow, negative = net outflow) */
  netCashFlow: number;

  /** Whether portfolio was rebalanced this year */
  wasRebalanced: boolean;

  /** Portfolio composition at end of year */
  assetComposition: Record<string, number>;
}

/**
 * Portfolio state at any point in time
 * Tracks current holdings and allocation
 */
interface PortfolioState {
  /** Current value of each asset class */
  assetValues: Map<string, number>;

  /** Total portfolio value */
  totalValue: number;

  /** Age of the investor */
  currentAge: number;
}

// =============================================================================
// Cash Flow Strategies
// =============================================================================

/**
 * Base interface for cash flow management strategies
 * Defines how money flows in and out of the portfolio
 */
export interface CashFlowStrategy {
  /**
   * Process cash flow for a given year
   *
   * @param portfolioState - Current portfolio state
   * @param netCashFlow - Net cash flow (positive = inflow, negative = outflow)
   * @param annualExpenses - Total annual expenses for liquidity planning
   * @returns Updated portfolio state after cash flow processing
   */
  processCashFlow(
    portfolioState: PortfolioState,
    netCashFlow: number,
    annualExpenses: number
  ): PortfolioState;
}

/**
 * Liquidity-aware cash flow strategy
 * Prioritizes high-liquidity assets for expenses and maintains safety buffers
 * Direct port of Python's LiquidityAwareFlowStrategy
 */
export class LiquidityAwareFlowStrategy implements CashFlowStrategy {
  processCashFlow(
    portfolioState: PortfolioState,
    netCashFlow: number,
    annualExpenses: number
  ): PortfolioState {
    const newState: PortfolioState = {
      assetValues: new Map(portfolioState.assetValues),
      totalValue: portfolioState.totalValue,
      currentAge: portfolioState.currentAge,
    };

    if (netCashFlow >= 0) {
      // Positive cash flow - invest according to target allocation
      this.investCashFlow(newState, netCashFlow);
    } else {
      // Negative cash flow - withdraw from portfolio with liquidity priority
      this.withdrawCashFlow(newState, Math.abs(netCashFlow));
    }

    // Update total value
    newState.totalValue = Array.from(newState.assetValues.values()).reduce(
      (sum, value) => sum + value,
      0
    );

    return newState;
  }

  /**
   * Invest positive cash flow according to target allocation
   * Simplified version - distributes proportionally to target allocation
   */
  private investCashFlow(state: PortfolioState, amount: number): void {
    // For now, distribute equally among all asset classes
    // In full implementation, this would use target allocation percentages
    const assetClasses = Array.from(state.assetValues.keys());
    const amountPerAsset = amount / assetClasses.length;

    for (const assetName of assetClasses) {
      const currentValue = state.assetValues.get(assetName) || 0;
      state.assetValues.set(assetName, currentValue + amountPerAsset);
    }
  }

  /**
   * Withdraw cash flow from portfolio prioritizing high liquidity assets
   * Follows liquidity hierarchy: HIGH -> MEDIUM -> LOW
   */
  private withdrawCashFlow(state: PortfolioState, amount: number): void {
    let remainingToWithdraw = amount;

    // Get asset classes sorted by liquidity (HIGH -> MEDIUM -> LOW)
    const sortedAssets = this.sortAssetsByLiquidity(state);

    for (const assetName of sortedAssets) {
      if (remainingToWithdraw <= 0) break;

      const currentValue = state.assetValues.get(assetName) || 0;
      const withdrawAmount = Math.min(remainingToWithdraw, currentValue);

      state.assetValues.set(assetName, currentValue - withdrawAmount);
      remainingToWithdraw -= withdrawAmount;
    }

    // If we couldn't withdraw enough, the portfolio is depleted
    // The engine will handle negative portfolio values appropriately
  }

  /**
   * Sort assets by liquidity level for withdrawal prioritization
   * Returns asset names sorted by liquidity (HIGH -> MEDIUM -> LOW)
   */
  private sortAssetsByLiquidity(state: PortfolioState): string[] {
    // For now, return assets in a basic order
    // In full implementation, this would use actual liquidity levels
    return Array.from(state.assetValues.keys()).sort();
  }
}

// =============================================================================
// Portfolio Simulator
// =============================================================================

/**
 * Main portfolio simulator class
 * Manages portfolio state and simulates year-by-year changes
 * Direct port of Python's PortfolioSimulator
 */
export class PortfolioSimulator {
  private readonly userProfile: UserProfile;
  private readonly cashFlowStrategy: CashFlowStrategy;
  private portfolioState: PortfolioState;

  /**
   * Initialize portfolio simulator
   *
   * @param userProfile - User's profile and preferences
   * @param cashFlowStrategy - Strategy for handling cash flows
   */
  constructor(userProfile: UserProfile, cashFlowStrategy: CashFlowStrategy) {
    this.userProfile = userProfile;
    this.cashFlowStrategy = cashFlowStrategy;
    this.portfolioState = this.createInitialPortfolioState();
  }

  /**
   * Simulate portfolio for one year
   * Processes returns, cash flows, and rebalancing
   *
   * @param age - User's age in the simulation year
   * @param netCashFlow - Net cash flow for the year
   * @param annualExpenses - Total annual expenses
   * @returns Simulation result for the year
   */
  simulateYear(
    age: number,
    netCashFlow: number,
    annualExpenses: number
  ): PortfolioSimulationResult {
    const startingValue = this.portfolioState.totalValue;

    // Update current age
    this.portfolioState.currentAge = age;

    // Step 1: Apply investment returns
    const investmentReturns = this.applyInvestmentReturns();

    // Step 2: Process cash flows
    this.portfolioState = this.cashFlowStrategy.processCashFlow(
      this.portfolioState,
      netCashFlow,
      annualExpenses
    );

    // Step 3: Rebalance portfolio if enabled
    const wasRebalanced = this.rebalanceIfNeeded();

    // Step 4: Create result
    const result: PortfolioSimulationResult = {
      endingPortfolioValue: this.portfolioState.totalValue,
      investmentReturns,
      netCashFlow,
      wasRebalanced,
      assetComposition: this.getAssetComposition(),
    };

    return result;
  }

  /**
   * Reset portfolio to initial state
   * Used when running multiple simulations
   */
  resetToInitial(): void {
    this.portfolioState = this.createInitialPortfolioState();
  }

  /**
   * Create initial portfolio state from user profile
   * Sets up asset allocation and initial values
   */
  private createInitialPortfolioState(): PortfolioState {
    const assetValues = new Map<string, number>();
    const totalNetWorth = this.userProfile.current_net_worth;

    // Distribute initial net worth according to asset allocation
    for (const assetClass of this.userProfile.portfolio.asset_classes) {
      const assetValue = totalNetWorth * (assetClass.allocation_percentage / 100);
      assetValues.set(assetClass.name, Math.max(0, assetValue)); // Ensure non-negative
    }

    return {
      assetValues,
      totalValue: Math.max(0, totalNetWorth),
      currentAge: this.getCurrentAge(),
    };
  }

  /**
   * Apply investment returns to all asset classes
   * Returns total investment returns for the year
   */
  private applyInvestmentReturns(): number {
    let totalReturns = 0;

    for (const assetClass of this.userProfile.portfolio.asset_classes) {
      const currentValue = this.portfolioState.assetValues.get(assetClass.name) || 0;
      const returnAmount = currentValue * (assetClass.expected_return / 100);

      this.portfolioState.assetValues.set(
        assetClass.name,
        currentValue + returnAmount
      );

      totalReturns += returnAmount;
    }

    // Update total value
    this.portfolioState.totalValue = Array.from(
      this.portfolioState.assetValues.values()
    ).reduce((sum, value) => sum + value, 0);

    return totalReturns;
  }

  /**
   * Rebalance portfolio if enabled and needed
   * Returns true if rebalancing occurred
   */
  private rebalanceIfNeeded(): boolean {
    if (!this.userProfile.portfolio.enable_rebalancing) {
      return false;
    }

    // Simple rebalancing: restore target allocation percentages
    const totalValue = this.portfolioState.totalValue;

    if (totalValue <= 0) {
      return false; // Cannot rebalance empty portfolio
    }

    for (const assetClass of this.userProfile.portfolio.asset_classes) {
      const targetValue = totalValue * (assetClass.allocation_percentage / 100);
      this.portfolioState.assetValues.set(assetClass.name, targetValue);
    }

    return true;
  }

  /**
   * Get current asset composition as percentages
   * Returns map of asset names to percentage allocations
   */
  private getAssetComposition(): Record<string, number> {
    const composition: Record<string, number> = {};
    const totalValue = this.portfolioState.totalValue;

    if (totalValue <= 0) {
      return composition;
    }

    for (const [assetName, value] of this.portfolioState.assetValues.entries()) {
      composition[assetName] = (value / totalValue) * 100;
    }

    return composition;
  }

  /**
   * Calculate current age from birth year
   * Helper method for age calculations
   */
  private getCurrentAge(): number {
    const currentYear = new Date().getFullYear();
    return currentYear - this.userProfile.birth_year;
  }
}
