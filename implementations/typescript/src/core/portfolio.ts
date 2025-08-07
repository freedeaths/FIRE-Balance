/**
 * Portfolio management and investment strategy module
 * Direct TypeScript port from Python portfolio_manager.py
 *
 * This file contains all portfolio calculation and simulation logic with exact
 * 1:1 mapping to Python implementation for algorithm consistency.
 */

import type { UserProfile, LiquidityLevel, AssetClass, PortfolioConfiguration } from './data_models';
import { getCurrentAge } from './data_models';

// Set up logger for portfolio calculations (console-based for browser)
const logger = {
  warning: (msg: string) => console.warn(`[Portfolio] ${msg}`),
  info: (msg: string) => console.info(`[Portfolio] ${msg}`),
  error: (msg: string) => console.error(`[Portfolio] ${msg}`)
};

// =============================================================================
// Core Portfolio State and Data Structures
// =============================================================================

/**
 * Current state of the investment portfolio
 * Direct TypeScript equivalent of Python's PortfolioState dataclass
 */
export interface PortfolioState {
  /** Asset name -> current value */
  asset_values: Record<string, number>;
}

/**
 * Portfolio state operations
 * Note: Validation happens in get_allocation() rather than constructor because:
 * 1. Portfolio values change frequently during simulation
 * 2. Intermediate states may temporarily violate allocation constraints
 * 3. Only final allocation % need to be valid (not intermediate values)
 * 4. This allows for more flexible state management during calculations
 */
export namespace PortfolioState {
  /**
   * Calculate total portfolio value from asset values
   */
  export function getTotalValue(state: PortfolioState): number {
    return Object.values(state.asset_values).reduce((sum, value) => sum + value, 0) || 0;
  }

  /**
   * Get current allocation percentages with precision handling
   * Direct port of Python's get_allocation() method
   */
  export function getAllocation(state: PortfolioState): Record<string, number> {
    const total = getTotalValue(state);
    if (total === 0) {
      const result: Record<string, number> = {};
      Object.keys(state.asset_values).forEach(name => {
        result[name] = 0.0;
      });
      return result;
    }

    const rawAllocation: Record<string, number> = {};
    Object.entries(state.asset_values).forEach(([name, value]) => {
      rawAllocation[name] = value / total;
    });

    // Check if allocation sums to 1.0 within tolerance
    const allocationSum = Object.values(rawAllocation).reduce((sum, value) => sum + value, 0);
    const tolerance = 0.0001; // 0.01% tolerance for PortfolioState (runtime calculations)

    if (Math.abs(allocationSum - 1.0) > tolerance) {
      logger.warning(
        `Portfolio allocation sum deviates from 1.0: ${allocationSum.toFixed(6)} ` +
        `(difference: ${(allocationSum - 1.0).toFixed(6)}). Auto-adjusting.`
      );

      // More robust adjustment: subtract difference from largest allocation
      if (allocationSum > 0) {
        // First try proportional adjustment
        const adjustmentFactor = 1.0 / allocationSum;
        const adjustedAllocation: Record<string, number> = {};
        Object.entries(rawAllocation).forEach(([name, value]) => {
          adjustedAllocation[name] = value * adjustmentFactor;
        });

        // Verify and apply precision correction if needed
        const adjustedSum = Object.values(adjustedAllocation).reduce((sum, value) => sum + value, 0);
        const remainingError = 1.0 - adjustedSum;

        if (Math.abs(remainingError) > Number.EPSILON) {
          // Find largest allocation and adjust it to guarantee exactly 1.0
          const largestAsset = Object.entries(adjustedAllocation)
            .reduce((max, [name, value]) => value > max[1] ? [name, value] : max, ['', 0])[0];
          adjustedAllocation[largestAsset] += remainingError;

          const finalSum = Object.values(adjustedAllocation).reduce((sum, value) => sum + value, 0);
          logger.info(`Allocation sum after precision correction: ${finalSum.toFixed(10)}`);
        } else {
          logger.info(`Adjusted allocation sum: ${adjustedSum.toFixed(6)}`);
        }

        return adjustedAllocation;
      } else {
        logger.error('All portfolio values are zero, cannot normalize allocation');
        return rawAllocation;
      }
    }

    return rawAllocation;
  }

  /**
   * Create a new PortfolioState
   */
  export function create(assetValues: Record<string, number>): PortfolioState {
    return { asset_values: { ...assetValues } };
  }
}

/**
 * Random factor for a specific asset class
 * Direct TypeScript equivalent of Python's AssetRandomFactor dataclass
 */
export interface AssetRandomFactor {
  name: string;
  random_factor: number;
}

/**
 * Random factors for Monte Carlo (matches PortfolioConfiguration pattern)
 * Direct TypeScript equivalent of Python's PortfolioRandomFactors dataclass
 */
export interface PortfolioRandomFactors {
  asset_factors: AssetRandomFactor[];
}

/**
 * Portfolio random factors operations
 */
export namespace PortfolioRandomFactors {
  /**
   * Get random factor for specific asset
   */
  export function getFactor(factors: PortfolioRandomFactors, assetName: string): number {
    const factor = factors.asset_factors.find(f => f.name === assetName);
    return factor?.random_factor ?? 0.0; // Default if asset not found
  }

  /**
   * Create from dict for convenience
   *
   * @param factors Dict mapping asset name to random factor
   *                e.g., {"Stocks": 1.2, "Bonds": -0.8, "Cash": 0.1}
   */
  export function fromDict(factors: Record<string, number>): PortfolioRandomFactors {
    return {
      asset_factors: Object.entries(factors).map(([name, factor]) => ({
        name,
        random_factor: factor
      }))
    };
  }
}

// =============================================================================
// Portfolio Calculator - Core Calculation Logic
// =============================================================================

/**
 * Investment portfolio calculator: pure calculation logic, stateless
 * Direct TypeScript equivalent of Python's PortfolioCalculator class
 */
export class PortfolioCalculator {
  public readonly profile: UserProfile;
  public readonly portfolio_config: PortfolioConfiguration;

  constructor(profile: UserProfile) {
    this.profile = profile;
    this.portfolio_config = profile.portfolio;
  }

  /**
   * Get target allocation based on portfolio configuration
   *
   * @param age User's age (reserved for future dynamic allocation features)
   * @returns Dict mapping asset names to allocation percentages (0.0-1.0)
   */
  getTargetAllocation(age: number): Record<string, number> {
    const result: Record<string, number> = {};
    this.portfolio_config.asset_classes.forEach(asset => {
      result[asset.name] = asset.allocation_percentage / 100.0;
    });
    return result;
  }

  /**
   * Calculate portfolio return based on given allocation and expected returns
   *
   * @param allocation Actual asset allocation (e.g., {"A": 0.6, "B": 0.3, "C": 0.1})
   * @param portfolioValue Total portfolio value
   * @returns Expected annual return amount
   */
  calculateReturnsByAllocation(
    allocation: Record<string, number>,
    portfolioValue: number
  ): number {
    if (portfolioValue <= 0) {
      return 0;
    }

    let totalReturn = 0;

    this.portfolio_config.asset_classes.forEach(asset => {
      const actualAllocation = allocation[asset.name] || 0.0;
      const expectedReturn = asset.expected_return / 100.0; // Convert percentage to decimal
      const assetReturn = expectedReturn * actualAllocation;
      totalReturn += assetReturn;
    });

    return portfolioValue * totalReturn;
  }

  /**
   * Calculate portfolio return with volatility for Monte Carlo simulation
   *
   * @param allocation Actual asset allocation
   * @param portfolioValue Total portfolio value
   * @param randomFactors Random factors by asset class (provided by Monte Carlo)
   *                      Each factor typically in range [-3, 3] for normal distribution bounds
   * @returns Return amount with volatility applied
   */
  calculateReturnsWithVolatility(
    allocation: Record<string, number>,
    portfolioValue: number,
    randomFactors: PortfolioRandomFactors
  ): number {
    if (portfolioValue <= 0) {
      return 0;
    }

    let totalReturn = 0;

    this.portfolio_config.asset_classes.forEach(asset => {
      const actualAllocation = allocation[asset.name] || 0.0;

      // Expected return + volatility adjustment per asset
      const expectedReturn = asset.expected_return / 100.0;
      const volatility = asset.volatility / 100.0;
      const assetRandomFactor = PortfolioRandomFactors.getFactor(randomFactors, asset.name);
      const volatilityAdjustment = volatility * assetRandomFactor;
      const actualReturn = expectedReturn + volatilityAdjustment;

      const assetReturn = actualReturn * actualAllocation;
      totalReturn += assetReturn;
    });

    return portfolioValue * totalReturn;
  }

  /**
   * Determine if portfolio should be rebalanced
   */
  shouldRebalance(
    currentAllocation: Record<string, number>,
    targetAllocation: Record<string, number>,
    threshold: number = 0.05
  ): boolean {
    if (!this.portfolio_config.enable_rebalancing) {
      return false;
    }

    for (const assetName in targetAllocation) {
      const current = currentAllocation[assetName] || 0.0;
      const target = targetAllocation[assetName];
      if (Math.abs(current - target) > threshold) {
        return true;
      }
    }
    return false;
  }

  /**
   * Calculate trades needed to rebalance portfolio
   */
  calculateRebalancingTrades(
    currentPortfolio: PortfolioState,
    targetAllocation: Record<string, number>
  ): Record<string, number> {
    const totalValue = PortfolioState.getTotalValue(currentPortfolio);
    if (totalValue <= 0) {
      const result: Record<string, number> = {};
      this.portfolio_config.asset_classes.forEach(asset => {
        result[asset.name] = 0;
      });
      return result;
    }

    const trades: Record<string, number> = {};
    this.portfolio_config.asset_classes.forEach(asset => {
      const assetName = asset.name;
      const targetValue = totalValue * (targetAllocation[assetName] || 0.0);
      const currentValue = currentPortfolio.asset_values[assetName] || 0;
      trades[assetName] = targetValue - currentValue;
    });

    return trades;
  }
}

// =============================================================================
// Cash Flow Strategy Pattern
// =============================================================================

/**
 * Abstract base class for cash flow handling strategies
 * Direct TypeScript equivalent of Python's CashFlowStrategy ABC
 */
export interface CashFlowStrategy {
  /**
   * Handle income allocation
   *
   * @param income Income amount to allocate
   * @param portfolio Current portfolio state
   * @param annualExpenses Annual expenses for cash buffer calculation
   * @param targetAllocation Target asset allocation ratios
   * @returns Dict of asset name -> amount to add/allocate
   */
  handleIncome(
    income: number,
    portfolio: PortfolioState,
    annualExpenses: number,
    targetAllocation: Record<string, number>
  ): Record<string, number>;

  /**
   * Handle expense withdrawal
   *
   * @param expense Expense amount to withdraw
   * @param portfolio Current portfolio state
   * @returns Dict of asset name -> amount to withdraw (negative values)
   */
  handleExpense(expense: number, portfolio: PortfolioState): Record<string, number>;

  /**
   * Get user-friendly strategy name
   */
  getDisplayName(): string;
}

/**
 * Liquidity-aware cash flow strategy: optimize within liquidity constraints
 * Direct TypeScript equivalent of Python's LiquidityAwareFlowStrategy class
 */
export class LiquidityAwareFlowStrategy implements CashFlowStrategy {
  private readonly cashBufferMonths: number;
  private readonly portfolioConfig: PortfolioConfiguration | null;

  constructor(
    cashBufferMonths: number = 3,
    portfolioConfig: PortfolioConfiguration | null = null
  ) {
    this.cashBufferMonths = cashBufferMonths;
    this.portfolioConfig = portfolioConfig;
  }

  /**
   * Handle income: liquidity-aware allocation with return optimization
   */
  handleIncome(
    income: number,
    portfolio: PortfolioState,
    annualExpenses: number,
    targetAllocation: Record<string, number>
  ): Record<string, number> {
    // Initialize allocation dict
    const allocation: Record<string, number> = {};
    Object.keys(targetAllocation).forEach(name => {
      allocation[name] = 0;
    });

    // Step 1: Ensure HIGH liquidity buffer (emergency fund)
    const highLiquidityBuffer = this._ensureLiquidityBuffer(
      income, portfolio, annualExpenses, allocation
    );
    const remainingIncome = income - highLiquidityBuffer;

    // Step 2: Invest remaining by return optimization within target allocation
    if (remainingIncome > 0) {
      this._allocateByReturnOptimization(
        remainingIncome, targetAllocation, allocation
      );
    }

    return allocation;
  }

  /**
   * Ensure adequate high-liquidity buffer, return amount used
   */
  private _ensureLiquidityBuffer(
    income: number,
    portfolio: PortfolioState,
    annualExpenses: number,
    allocation: Record<string, number>
  ): number {
    // Calculate required cash buffer
    const requiredBuffer = annualExpenses * (this.cashBufferMonths / 12.0);

    // Find high-liquidity assets (assume "cash" for now - lowercase normalized)
    // TODO: Use actual asset config to identify HIGH liquidity assets
    const currentHighLiquidity = portfolio.asset_values['cash'] || 0;

    const bufferShortfall = Math.max(0, requiredBuffer - currentHighLiquidity);
    if (bufferShortfall > 0) {
      const bufferAllocation = Math.min(income, bufferShortfall);
      allocation['cash'] = bufferAllocation;
      return bufferAllocation;
    }

    return 0;
  }

  /**
   * Allocate remaining income by return optimization within target allocation
   */
  private _allocateByReturnOptimization(
    remainingIncome: number,
    targetAllocation: Record<string, number>,
    allocation: Record<string, number>
  ): void {
    if (!this.portfolioConfig) {
      // Fallback to simple proportional allocation
      this._allocateProportionally(remainingIncome, targetAllocation, allocation);
      return;
    }

    // Get non-HIGH liquidity assets sorted by expected return (descending)
    const investmentAssets = this.portfolioConfig.asset_classes
      .filter(asset =>
        asset.liquidity_level !== 'high' &&
        (targetAllocation[asset.name] || 0) > 0
      );

    // Sort by expected return (highest first) for return maximization
    investmentAssets.sort((a, b) => b.expected_return - a.expected_return);

    // Calculate total investment ratio (excluding HIGH liquidity)
    const totalInvestmentRatio = investmentAssets
      .reduce((sum, asset) => sum + (targetAllocation[asset.name] || 0), 0);

    if (totalInvestmentRatio > 0) {
      // Allocate proportionally within non-HIGH liquidity assets
      // (Future enhancement: could do greedy allocation to highest return assets)
      investmentAssets.forEach(asset => {
        const targetRatio = targetAllocation[asset.name] || 0;
        if (targetRatio > 0) {
          const investmentRatio = targetRatio / totalInvestmentRatio;
          allocation[asset.name] += remainingIncome * investmentRatio;
        }
      });
    }
  }

  /**
   * Fallback proportional allocation when no config available
   */
  private _allocateProportionally(
    remainingIncome: number,
    targetAllocation: Record<string, number>,
    allocation: Record<string, number>
  ): void {
    const investmentTargets: Record<string, number> = {};
    Object.entries(targetAllocation).forEach(([k, v]) => {
      if (k !== 'Cash') {
        investmentTargets[k] = v;
      }
    });

    const totalInvestmentRatio = Object.values(investmentTargets)
      .reduce((sum, value) => sum + value, 0);

    if (totalInvestmentRatio > 0) {
      Object.entries(investmentTargets).forEach(([assetName, targetRatio]) => {
        const investmentRatio = targetRatio / totalInvestmentRatio;
        allocation[assetName] += remainingIncome * investmentRatio;
      });
    }
  }

  /**
   * Handle expense: liquidity-priority withdrawal with return optimization
   */
  handleExpense(expense: number, portfolio: PortfolioState): Record<string, number> {
    const withdrawal: Record<string, number> = {};
    Object.keys(portfolio.asset_values).forEach(name => {
      withdrawal[name] = 0;
    });
    let remainingExpense = expense;

    // Step 1: Use HIGH liquidity assets first (Cash)
    const highLiquidityUsed = this._withdrawFromLiquidityTier(
      'HIGH', remainingExpense, portfolio, withdrawal
    );
    remainingExpense -= highLiquidityUsed;

    // Step 2: Use MEDIUM liquidity assets if needed (Stocks)
    if (remainingExpense > 0) {
      const mediumLiquidityUsed = this._withdrawFromLiquidityTier(
        'MEDIUM', remainingExpense, portfolio, withdrawal
      );
      remainingExpense -= mediumLiquidityUsed;
    }

    // Step 3: Use LOW liquidity assets if still needed (Bonds, Savings)
    if (remainingExpense > 0) {
      this._withdrawFromLiquidityTier(
        'LOW', remainingExpense, portfolio, withdrawal
      );
    }

    return withdrawal;
  }

  /**
   * Withdraw from assets in specific liquidity tier, return amount withdrawn
   */
  private _withdrawFromLiquidityTier(
    tier: string,
    neededAmount: number,
    portfolio: PortfolioState,
    withdrawal: Record<string, number>
  ): number {
    const tierAssets = this._getAssetsByLiquidityTier(tier, portfolio);

    if (Object.keys(tierAssets).length === 0) {
      return 0;
    }

    const totalTierValue = Object.values(tierAssets).reduce((sum, value) => sum + value, 0);
    if (totalTierValue === 0) {
      return 0;
    }

    const actualWithdrawal = Math.min(neededAmount, totalTierValue);
    if (actualWithdrawal === 0) {
      return 0;
    }

    // Optimize withdrawal: sell lowest return assets first in same liquidity tier
    if (this.portfolioConfig) {
      this._withdrawByReturnOptimization(tierAssets, actualWithdrawal, withdrawal);
    } else {
      // Fallback: withdraw proportionally
      this._withdrawProportionally(tierAssets, actualWithdrawal, withdrawal);
    }

    return actualWithdrawal;
  }

  /**
   * Withdraw by selling lowest return assets first (tax loss harvesting logic)
   */
  private _withdrawByReturnOptimization(
    tierAssets: Record<string, number>,
    withdrawalAmount: number,
    withdrawal: Record<string, number>
  ): void {
    // Get asset return info and sort by expected return (ascending-sell lowest first)
    const assetReturns: Array<[string, number, number]> = [];
    if (!this.portfolioConfig) {
      return;
    }

    this.portfolioConfig.asset_classes.forEach(asset => {
      if (tierAssets[asset.name] !== undefined) {
        assetReturns.push([asset.name, asset.expected_return, tierAssets[asset.name]]);
      }
    });

    assetReturns.sort((a, b) => a[1] - b[1]); // Sort by return (lowest first)

    let remainingWithdrawal = withdrawalAmount;
    assetReturns.forEach(([assetName, , assetValue]) => {
      if (remainingWithdrawal <= 0) {
        return;
      }

      const assetWithdrawal = Math.min(remainingWithdrawal, assetValue);
      withdrawal[assetName] = -assetWithdrawal;
      remainingWithdrawal -= assetWithdrawal;
    });
  }

  /**
   * Fallback proportional withdrawal
   */
  private _withdrawProportionally(
    tierAssets: Record<string, number>,
    withdrawalAmount: number,
    withdrawal: Record<string, number>
  ): void {
    const totalTierValue = Object.values(tierAssets).reduce((sum, value) => sum + value, 0);
    Object.entries(tierAssets).forEach(([assetName, assetValue]) => {
      if (assetValue > 0) {
        const withdrawalRatio = assetValue / totalTierValue;
        withdrawal[assetName] = -withdrawalAmount * withdrawalRatio;
      }
    });
  }

  /**
   * Get assets belonging to specific liquidity tier
   * Made public for testing (marked with underscore to indicate internal use)
   */
  _getAssetsByLiquidityTier(tier: string, portfolio: PortfolioState): Record<string, number> {
    let tierAssetNames: string[];

    if (!this.portfolioConfig) {
      // Fallback to hardcoded mapping (lowercase normalized)
      const tierMapping: Record<string, string[]> = {
        'HIGH': ['cash'],
        'MEDIUM': ['stocks'],
        'LOW': ['bonds', 'savings']
      };
      tierAssetNames = tierMapping[tier] || [];
    } else {
      // Use actual asset configuration
      const targetLiquidity = tier.toLowerCase() as LiquidityLevel;
      tierAssetNames = this.portfolioConfig.asset_classes
        .filter(asset => asset.liquidity_level === targetLiquidity)
        .map(asset => asset.name);
    }

    const result: Record<string, number> = {};
    Object.entries(portfolio.asset_values).forEach(([name, value]) => {
      if (tierAssetNames.includes(name) && value > 0) {
        result[name] = value;
      }
    });

    return result;
  }

  getDisplayName(): string {
    return 'liquidity_aware_strategy';
  }
}

/**
 * Backward compatibility alias for LiquidityAwareFlowStrategy
 * Direct TypeScript equivalent of Python's SimpleFlowStrategy class
 */
export class SimpleFlowStrategy extends LiquidityAwareFlowStrategy {
  override getDisplayName(): string {
    return 'simple_conservative_strategy';
  }
}

// =============================================================================
// Portfolio Simulator
// =============================================================================

/**
 * Result of one year portfolio simulation
 * Direct TypeScript equivalent of Python's YearlyPortfolioResult dataclass
 */
export interface YearlyPortfolioResult {
  age: number;
  starting_portfolio_value: number;
  investment_returns: number;
  cash_flows_allocated: Record<string, number>; // Income/expense allocations
  ending_portfolio_value: number;
  ending_allocation: Record<string, number>;
  rebalanced: boolean;
}

/**
 * Manages portfolio state evolution over time
 * Direct TypeScript equivalent of Python's PortfolioSimulator class
 */
export class PortfolioSimulator {
  public readonly calculator: PortfolioCalculator;
  private currentPortfolio: PortfolioState;
  private readonly _initialPortfolio: PortfolioState;
  private readonly strategy: CashFlowStrategy;

  constructor(
    userProfile: UserProfile,
    cashFlowStrategy: CashFlowStrategy | null = null
  ) {
    this.calculator = new PortfolioCalculator(userProfile);
    this.currentPortfolio = this._createInitialPortfolio(userProfile);
    // Store initial state for resets
    this._initialPortfolio = PortfolioState.create(this.currentPortfolio.asset_values);
    this.strategy = cashFlowStrategy || new LiquidityAwareFlowStrategy(
      3, this.calculator.portfolio_config
    );
  }

  /**
   * Create initial portfolio state from user profile
   */
  private _createInitialPortfolio(userProfile: UserProfile): PortfolioState {
    // Get target allocation for current age
    const currentAge = getCurrentAge(userProfile.birth_year);
    const targetAllocation = this.calculator.getTargetAllocation(currentAge);

    // Distribute initial net worth according to target allocation
    const initialValue = userProfile.current_net_worth;
    const assetValues: Record<string, number> = {};

    userProfile.portfolio.asset_classes.forEach(assetClass => {
      const allocationPct = targetAllocation[assetClass.name] || 0.0;
      const assetValue = initialValue * allocationPct;
      assetValues[assetClass.name] = assetValue;
    });

    return PortfolioState.create(assetValues);
  }

  /**
   * Reset portfolio to initial state
   */
  resetToInitial(): void {
    this.currentPortfolio = PortfolioState.create(this._initialPortfolio.asset_values);
  }

  /**
   * Simulate one year of portfolio changes
   *
   * @param age User's age this year
   * @param netCashFlow Net cash flow (income - expenses)
   * @param annualExpenses Total annual expenses (for cash buffer calculation)
   * @returns Results of the year's portfolio simulation
   */
  simulateYear(
    age: number,
    netCashFlow: number,
    annualExpenses: number
  ): YearlyPortfolioResult {
    const startingValue = PortfolioState.getTotalValue(this.currentPortfolio);
    const startingAllocation = PortfolioState.getAllocation(this.currentPortfolio);

    // Step 1: Calculate investment returns based on current allocation
    const investmentReturns = this.calculator.calculateReturnsByAllocation(
      startingAllocation, startingValue
    );

    // Step 2: Apply investment returns to portfolio
    this._applyReturns(investmentReturns, startingAllocation);

    // Step 3: Handle cash flows
    let cashFlows: Record<string, number> = {};
    if (netCashFlow !== 0) {
      const targetAllocation = this.calculator.getTargetAllocation(age);

      if (netCashFlow > 0) {
        // Handle income
        cashFlows = this.strategy.handleIncome(
          netCashFlow,
          this.currentPortfolio,
          annualExpenses,
          targetAllocation
        );
      } else {
        // Handle expenses
        cashFlows = this.strategy.handleExpense(
          Math.abs(netCashFlow), this.currentPortfolio
        );
      }

      this._applyCashFlows(cashFlows);
    }

    // Step 4: Check if rebalancing is needed
    const rebalanced = this._maybeRebalance(age);

    return {
      age,
      starting_portfolio_value: startingValue,
      investment_returns: investmentReturns,
      cash_flows_allocated: cashFlows,
      ending_portfolio_value: PortfolioState.getTotalValue(this.currentPortfolio),
      ending_allocation: PortfolioState.getAllocation(this.currentPortfolio),
      rebalanced
    };
  }

  /**
   * Apply investment returns proportionally to assets
   */
  private _applyReturns(totalReturns: number, allocation: Record<string, number>): void {
    Object.entries(this.currentPortfolio.asset_values).forEach(([assetName, currentValue]) => {
      const assetAllocation = allocation[assetName] || 0.0;
      const assetReturns = totalReturns * assetAllocation;
      this.currentPortfolio.asset_values[assetName] = currentValue + assetReturns;
    });
  }

  /**
   * Apply cash flow changes to portfolio
   */
  private _applyCashFlows(cashFlows: Record<string, number>): void {
    Object.entries(cashFlows).forEach(([assetName, flowAmount]) => {
      if (this.currentPortfolio.asset_values[assetName] !== undefined) {
        this.currentPortfolio.asset_values[assetName] += flowAmount;
      } else {
        this.currentPortfolio.asset_values[assetName] = flowAmount;
      }
    });

    // Ensure no negative values
    Object.keys(this.currentPortfolio.asset_values).forEach(assetName => {
      this.currentPortfolio.asset_values[assetName] = Math.max(
        0, this.currentPortfolio.asset_values[assetName]
      );
    });
  }

  /**
   * Check and execute rebalancing if needed
   */
  private _maybeRebalance(age: number): boolean {
    const currentAllocation = PortfolioState.getAllocation(this.currentPortfolio);
    const targetAllocation = this.calculator.getTargetAllocation(age);

    if (this.calculator.shouldRebalance(currentAllocation, targetAllocation)) {
      const trades = this.calculator.calculateRebalancingTrades(
        this.currentPortfolio, targetAllocation
      );
      this._executeTrades(trades);
      return true;
    }

    return false;
  }

  /**
   * Execute rebalancing trades (no transaction costs for now)
   */
  private _executeTrades(trades: Record<string, number>): void {
    Object.entries(trades).forEach(([assetName, tradeAmount]) => {
      if (this.currentPortfolio.asset_values[assetName] !== undefined) {
        this.currentPortfolio.asset_values[assetName] += tradeAmount;
      } else {
        this.currentPortfolio.asset_values[assetName] = Math.max(0, tradeAmount);
      }
    });
  }

  /**
   * Get current portfolio state (for testing/inspection)
   */
  getCurrentPortfolio(): PortfolioState {
    return this.currentPortfolio;
  }

  // Python-style method aliases for engine compatibility
  reset_to_initial(): void {
    return this.resetToInitial();
  }

  simulate_year(age: number, net_cash_flow: number, annual_expenses: number): YearlyPortfolioResult {
    return this.simulateYear(age, net_cash_flow, annual_expenses);
  }
}

// TODO: Future implementation - PortfolioAdvisor
//
// A PortfolioAdvisor class could be implemented to provide allocation suggestions
// to users without affecting actual calculations. This would include:
//
// class PortfolioAdvisor {
//   /**Provides portfolio allocation suggestions and recommendations*/
//
//   getLifecycleSuggestion(age: number): Record<string, number> {
//     /**Suggest allocation based on lifecycle investing (100-age rule)*/
//   }
//
//   getTargetDateSuggestion(age: number, retirementAge: number): Record<string, number> {
//     /**Suggest allocation based on target-date fund principles*/
//   }
//
//   analyzeCurrentAllocation(current: Record<string, number>, age: number): Record<string, any> {
//     /**Analyze user's current allocation and provide feedback*/
//   }
// }
//
// This would be used in the UI layer to help users configure their portfolios,
// while keeping the actual PortfolioManager calculations simple and predictable.

// TODO: Transaction Costs
//
// Transaction costs are currently set to 0 by default as they vary significantly
// across countries and brokers. Future implementation should:
//
// 1. Add optional transaction_cost_rate parameter to PortfolioConfiguration
// 2. Consider costs in rebalancing decisions (cost-benefit analysis)
// 3. Provide UI warning: "Calculations assume 0% transaction costs"
// 4. Allow users to input their specific broker fees
//
// Common transaction costs by region:
// - US: 0-1% (many brokers now 0% for stocks/ETFs)
// - EU: 0.1-0.5%
// - Asia: 0.1-1%
//
// This complexity should be handled in UI layer with appropriate disclaimers.

// TODO: Monte Carlo Integration
//
// The calculateReturnsWithVolatility() method requires PortfolioRandomFactors to be
// provided by the Monte Carlo layer. This design ensures:
//
// 1. Monte Carlo controls random number generation (distribution, bounds, seed)
// 2. PortfolioCalculator remains stateless and deterministic
// 3. Each asset class has independent random factors (more realistic)
// 4. Flexibility for different volatility models (normal, t-distribution, etc.)
// 5. Type safety with structured data matching PortfolioConfiguration pattern
//
// The Monte Carlo layer should:
// - Generate random factors for each asset with appropriate distribution
// - Apply bounds (typically [-3, 3] for normal distribution)
// - Handle correlations between assets if needed
// - Use PortfolioRandomFactors.fromDict() for convenience
//
// Example usage:
// const randomFactors = PortfolioRandomFactors.fromDict({
//   "Stocks": Math.random() * 2 - 1, // Simple example
//   "Bonds": Math.random() * 2 - 1,
//   "Cash": Math.random() * 2 - 1
// });
