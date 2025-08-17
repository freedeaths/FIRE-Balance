/**
 * Tests for portfolio management - Direct port from Python test_portfolio_manager.py
 * Ensures identical behavior between TypeScript and Python implementations
 */

import Decimal from "decimal.js";

import type {
  AssetClass,
  LiquidityLevel,
  PortfolioConfiguration,
  UserProfile,
} from "../data_models";
import {
  createPortfolioConfiguration,
  createUserProfile,
} from "../data_models";

import type { AssetRandomFactor } from "../portfolio";
import {
  LiquidityAwareFlowStrategy,
  PortfolioCalculator,
  PortfolioRandomFactors,
  PortfolioState,
  SimpleFlowStrategy,
} from "../portfolio";

describe("PortfolioCalculator", () => {
  // Create sample profile fixture
  const createSampleProfile = (): UserProfile => {
    const portfolio = createPortfolioConfiguration({
      asset_classes: [
        {
          name: "Stocks", // Will normalize to "stocks"
          display_name: "Stocks",
          allocation_percentage: new Decimal(60.0),
          expected_return: new Decimal(7.0),
          volatility: new Decimal(15.0),
          liquidity_level: "medium",
        },
        {
          name: "Bonds", // Will normalize to "bonds"
          display_name: "Bonds",
          allocation_percentage: new Decimal(30.0),
          expected_return: new Decimal(3.0),
          volatility: new Decimal(5.0),
          liquidity_level: "low",
        },
        {
          name: "Cash", // Will normalize to "cash"
          display_name: "Cash",
          allocation_percentage: new Decimal(10.0),
          expected_return: new Decimal(1.0),
          volatility: new Decimal(1.0),
          liquidity_level: "high",
        },
      ],
      enable_rebalancing: true,
    });

    return createUserProfile({
      birth_year: 1994, // current_age around 30 in 2024
      expected_fire_age: 50,
      legal_retirement_age: 65,
      life_expectancy: 85,
      current_net_worth: new Decimal(100000.0),
      inflation_rate: new Decimal(3.0),
      safety_buffer_months: new Decimal(12),
      portfolio,
    });
  };

  let portfolioCalculator: PortfolioCalculator;
  let sampleProfile: UserProfile;

  beforeEach(() => {
    sampleProfile = createSampleProfile();
    portfolioCalculator = new PortfolioCalculator(sampleProfile);
  });

  test("portfolio calculator initialization", () => {
    expect(portfolioCalculator.profile).toBe(sampleProfile);
    expect(portfolioCalculator.portfolio_config).toBe(sampleProfile.portfolio);
  });

  test("get target allocation static", () => {
    const allocationYoung = portfolioCalculator.getTargetAllocation(30);
    const allocationOld = portfolioCalculator.getTargetAllocation(60);

    for (const allocation of [allocationYoung, allocationOld]) {
      expect(allocation["stocks"].toNumber()).toBe(0.6);
      expect(allocation["bonds"].toNumber()).toBe(0.3);
      expect(allocation["cash"].toNumber()).toBe(0.1);

      // Should sum to 1.0
      const sum = Object.values(allocation).reduce(
        (s, v) => s.add(v),
        new Decimal(0),
      );
      expect(sum.sub(1.0).abs().toNumber()).toBeLessThan(0.001);
    }
  });

  test("calculate returns by allocation", () => {
    const portfolioValue = new Decimal(100000);
    const allocation = {
      stocks: new Decimal(0.6),
      bonds: new Decimal(0.3),
      cash: new Decimal(0.1),
    };

    const expectedReturn = portfolioCalculator.calculateReturnsByAllocation(
      allocation,
      portfolioValue,
    );

    // Expected: 60% * 7% + 30% * 3% + 10% * 1% = 4.2% + 0.9% + 0.1% = 5.2%
    const expectedPercentage = 0.052;
    const expectedAmount = portfolioValue.mul(expectedPercentage);

    expect(expectedReturn.sub(expectedAmount).abs().toNumber()).toBeLessThan(
      0.01,
    );
  });

  test("calculate returns by allocation zero value", () => {
    const allocation = {
      stocks: new Decimal(0.6),
      bonds: new Decimal(0.3),
      cash: new Decimal(0.1),
    };
    const result = portfolioCalculator.calculateReturnsByAllocation(
      allocation,
      new Decimal(0),
    );
    expect(result.toNumber()).toBe(0);
  });

  test("calculate returns with volatility", () => {
    const portfolioValue = new Decimal(100000);
    const allocation = {
      stocks: new Decimal(0.6),
      bonds: new Decimal(0.3),
      cash: new Decimal(0.1),
    };

    // Create random factors with +1 std dev for all assets
    const randomFactors: PortfolioRandomFactors = {
      asset_factors: [
        { name: "stocks", random_factor: new Decimal(1.0) },
        { name: "bonds", random_factor: new Decimal(1.0) },
        { name: "cash", random_factor: new Decimal(1.0) },
      ],
    };

    const returnWithVolatility =
      portfolioCalculator.calculateReturnsWithVolatility(
        allocation,
        portfolioValue,
        randomFactors,
      );

    // With +1 std dev, each asset gets its volatility added
    // Stocks: (7% + 15%) * 60% = 13.2%
    // Bonds: (3% + 5%) * 30% = 2.4%
    // Cash: (1% + 1%) * 10% = 0.2%
    // Total: 15.8%
    const expectedReturn = portfolioValue.mul(0.158);

    expect(
      returnWithVolatility.sub(expectedReturn).abs().toNumber(),
    ).toBeLessThan(0.01);
  });

  test("should rebalance within threshold", () => {
    const currentAllocation = {
      stocks: new Decimal(0.58),
      bonds: new Decimal(0.32),
      cash: new Decimal(0.1),
    };
    const targetAllocation = {
      stocks: new Decimal(0.6),
      bonds: new Decimal(0.3),
      cash: new Decimal(0.1),
    };

    // Differences are within 5% threshold
    expect(
      portfolioCalculator.shouldRebalance(currentAllocation, targetAllocation),
    ).toBe(false);
  });

  test("should rebalance outside threshold", () => {
    const currentAllocation = {
      stocks: new Decimal(0.5),
      bonds: new Decimal(0.4),
      cash: new Decimal(0.1),
    };
    const targetAllocation = {
      stocks: new Decimal(0.6),
      bonds: new Decimal(0.3),
      cash: new Decimal(0.1),
    };

    // Stock difference is 10%, which exceeds 5% threshold
    expect(
      portfolioCalculator.shouldRebalance(currentAllocation, targetAllocation),
    ).toBe(true);
  });

  test("should rebalance disabled", () => {
    const profile = createSampleProfile();
    profile.portfolio.enable_rebalancing = false;
    const calculator = new PortfolioCalculator(profile);

    const currentAllocation = {
      stocks: new Decimal(0.5),
      bonds: new Decimal(0.4),
      cash: new Decimal(0.1),
    };
    const targetAllocation = {
      stocks: new Decimal(0.6),
      bonds: new Decimal(0.3),
      cash: new Decimal(0.1),
    };

    // Should not rebalance even with large differences
    expect(
      calculator.shouldRebalance(currentAllocation, targetAllocation),
    ).toBe(false);
  });

  test("calculate rebalancing trades", () => {
    const currentPortfolio = PortfolioState.create({
      stocks: new Decimal(50000), // Currently 50%
      bonds: new Decimal(40000), // Currently 40%
      cash: new Decimal(10000), // Currently 10%
    });

    const targetAllocation = {
      stocks: new Decimal(0.6),
      bonds: new Decimal(0.3),
      cash: new Decimal(0.1),
    };

    const trades = portfolioCalculator.calculateRebalancingTrades(
      currentPortfolio,
      targetAllocation,
    );

    // Expected trades:
    // Stocks: 60000 - 50000 = +10000
    // Bonds: 30000 - 40000 = -10000
    // Cash: 10000 - 10000 = 0
    expect(trades["stocks"].toNumber()).toBe(10000);
    expect(trades["bonds"].toNumber()).toBe(-10000);
    expect(trades["cash"].toNumber()).toBe(0);
  });

  test("portfolio state get allocation", () => {
    const portfolioState = PortfolioState.create({
      stocks: new Decimal(60000),
      bonds: new Decimal(30000),
      cash: new Decimal(10000),
    });

    const allocation = PortfolioState.getAllocation(portfolioState);

    expect(allocation["stocks"].toNumber()).toBe(0.6);
    expect(allocation["bonds"].toNumber()).toBe(0.3);
    expect(allocation["cash"].toNumber()).toBe(0.1);

    // Test total_value property
    expect(PortfolioState.getTotalValue(portfolioState).toNumber()).toBe(
      100000,
    );
  });

  test("portfolio state get allocation zero value", () => {
    const portfolioState = PortfolioState.create({
      Stocks: new Decimal(0),
      Bonds: new Decimal(0),
    });

    const allocation = PortfolioState.getAllocation(portfolioState);

    expect(allocation["Stocks"].toNumber()).toBe(0.0);
    expect(allocation["Bonds"].toNumber()).toBe(0.0);
  });
});

describe("LiquidityAwareFlowStrategy", () => {
  let portfolioConfig: PortfolioConfiguration;
  let strategy: LiquidityAwareFlowStrategy;

  beforeEach(() => {
    portfolioConfig = createPortfolioConfiguration({
      asset_classes: [
        {
          name: "Cash",
          display_name: "Cash",
          allocation_percentage: new Decimal(10.0),
          expected_return: new Decimal(0.5),
          volatility: new Decimal(0.0),
          liquidity_level: "high",
        },
        {
          name: "Stocks",
          display_name: "Stocks",
          allocation_percentage: new Decimal(60.0),
          expected_return: new Decimal(7.0),
          volatility: new Decimal(15.0),
          liquidity_level: "medium",
        },
        {
          name: "Bonds",
          display_name: "Bonds",
          allocation_percentage: new Decimal(30.0),
          expected_return: new Decimal(3.0),
          volatility: new Decimal(5.0),
          liquidity_level: "low",
        },
      ],
      enable_rebalancing: true,
    });
    strategy = new LiquidityAwareFlowStrategy(3, portfolioConfig);
  });

  test("handle income cash buffer priority", () => {
    const portfolio = PortfolioState.create({
      cash: new Decimal(1000), // Low cash
      stocks: new Decimal(50000),
      bonds: new Decimal(20000),
    });

    const annualExpenses = new Decimal(24000); // Need 6000 for 3-month buffer
    const targetAllocation = {
      cash: new Decimal(0.1),
      stocks: new Decimal(0.6),
      bonds: new Decimal(0.3),
    };
    const income = new Decimal(10000);

    const allocation = strategy.handleIncome(
      income,
      portfolio,
      annualExpenses,
      targetAllocation,
    );

    // Should prioritize filling cash buffer (need 5000 more)
    expect(allocation["cash"].toNumber()).toBe(5000);
    // Remaining 5000 should be invested in higher return assets first
    expect(allocation["stocks"].toNumber()).toBeGreaterThan(
      allocation["bonds"].toNumber(),
    ); // Stocks have higher return
  });

  test("handle expense liquidity priority", () => {
    const portfolio = PortfolioState.create({
      cash: new Decimal(2000),
      stocks: new Decimal(50000),
      bonds: new Decimal(30000),
    });

    const expense = new Decimal(5000);
    const withdrawal = strategy.handleExpense(expense, portfolio);

    // Should use all cash first
    expect(withdrawal["cash"].toNumber()).toBe(-2000);
    // Should withdraw from MEDIUM liquidity (Stocks) next
    expect(withdrawal["stocks"].toNumber()).toBeLessThan(0);
    // Should not touch LOW liquidity (Bonds) if not needed
    // (In this case, might still touch bonds due to proportional withdrawal)
  });

  test("handle expense return optimization", () => {
    // Create config with same liquidity but different returns
    const config = createPortfolioConfiguration({
      asset_classes: [
        {
          name: "Stock_A",
          display_name: "Stock_A",
          allocation_percentage: new Decimal(50.0), // Sum must be 100%
          expected_return: new Decimal(8.0), // Higher return
          volatility: new Decimal(15.0),
          liquidity_level: "medium",
        },
        {
          name: "Stock_B",
          display_name: "Stock_B",
          allocation_percentage: new Decimal(50.0), // Sum must be 100%
          expected_return: new Decimal(5.0), // Lower return
          volatility: new Decimal(15.0),
          liquidity_level: "medium",
        },
      ],
      enable_rebalancing: true,
    });

    const testStrategy = new LiquidityAwareFlowStrategy(3, config);

    const portfolio = PortfolioState.create({
      stock_a: new Decimal(50000),
      stock_b: new Decimal(50000),
    });

    const expense = new Decimal(10000);
    const withdrawal = testStrategy.handleExpense(expense, portfolio);

    // Should sell more of Stock_B (lower return) than Stock_A
    // This tests the return optimization logic
    expect(
      Math.abs((withdrawal["stock_b"] || new Decimal(0)).toNumber()),
    ).toBeGreaterThanOrEqual(
      Math.abs((withdrawal["stock_a"] || new Decimal(0)).toNumber()),
    );
  });

  test("liquidity level classification", () => {
    // Test the internal liquidity tier mapping
    const portfolio = PortfolioState.create({
      cash: new Decimal(10000),
      stocks: new Decimal(50000),
      bonds: new Decimal(30000),
    });

    const highAssets = strategy._getAssetsByLiquidityTier("HIGH", portfolio);
    const mediumAssets = strategy._getAssetsByLiquidityTier(
      "MEDIUM",
      portfolio,
    );
    const lowAssets = strategy._getAssetsByLiquidityTier("LOW", portfolio);

    expect("cash" in highAssets).toBe(true);
    expect("stocks" in mediumAssets).toBe(true);
    expect("bonds" in lowAssets).toBe(true);
  });

  test("allocation sum precision correction", () => {
    // Create a portfolio with values that might have floating point precision issues
    const portfolio = PortfolioState.create({
      Asset1: new Decimal(33333.33),
      Asset2: new Decimal(33333.33),
      Asset3: new Decimal(33333.34), // Total: 100000.00
    });

    const allocation = PortfolioState.getAllocation(portfolio);

    // Sum should be exactly 1.0 after precision correction
    const allocationSum = Object.values(allocation).reduce(
      (sum, value) => sum.add(value),
      new Decimal(0),
    );
    expect(allocationSum.sub(1.0).abs().toNumber()).toBeLessThanOrEqual(1e-10);
  });

  test("display names", () => {
    // Test strategy display names return simple identifiers
    const liquidityStrategy = new LiquidityAwareFlowStrategy();
    const simpleStrategy = new SimpleFlowStrategy();

    // Should return simple string identifiers, not formatted strings
    expect(liquidityStrategy.getDisplayName()).toBe("liquidity_aware_strategy");
    expect(simpleStrategy.getDisplayName()).toBe(
      "simple_conservative_strategy",
    );
    expect(liquidityStrategy.getDisplayName()).not.toContain("{"); // No f-string formatting
  });
});

describe("PortfolioRandomFactors", () => {
  test("get factor", () => {
    const factors: PortfolioRandomFactors = {
      asset_factors: [
        { name: "stocks", random_factor: new Decimal(1.2) },
        { name: "bonds", random_factor: new Decimal(-0.8) },
        { name: "cash", random_factor: new Decimal(0.1) },
      ],
    };

    expect(PortfolioRandomFactors.getFactor(factors, "stocks").toNumber()).toBe(
      1.2,
    );
    expect(PortfolioRandomFactors.getFactor(factors, "bonds").toNumber()).toBe(
      -0.8,
    );
    expect(PortfolioRandomFactors.getFactor(factors, "cash").toNumber()).toBe(
      0.1,
    );
    expect(
      PortfolioRandomFactors.getFactor(factors, "nonexistent").toNumber(),
    ).toBe(0.0);
  });

  test("from dict", () => {
    const factorsDict = {
      Stocks: new Decimal(1.2),
      Bonds: new Decimal(-0.8),
      Cash: new Decimal(0.1),
    };

    const factors = PortfolioRandomFactors.fromDict(factorsDict);

    expect(factors.asset_factors).toHaveLength(3);
    expect(PortfolioRandomFactors.getFactor(factors, "Stocks").toNumber()).toBe(
      1.2,
    );
    expect(PortfolioRandomFactors.getFactor(factors, "Bonds").toNumber()).toBe(
      -0.8,
    );
    expect(PortfolioRandomFactors.getFactor(factors, "Cash").toNumber()).toBe(
      0.1,
    );
  });
});

describe("PortfolioState", () => {
  test("create and basic operations", () => {
    const state = PortfolioState.create({
      stocks: new Decimal(60000),
      bonds: new Decimal(30000),
      cash: new Decimal(10000),
    });

    expect(PortfolioState.getTotalValue(state).toNumber()).toBe(100000);

    const allocation = PortfolioState.getAllocation(state);
    expect(allocation["stocks"].toNumber()).toBe(0.6);
    expect(allocation["bonds"].toNumber()).toBe(0.3);
    expect(allocation["cash"].toNumber()).toBe(0.1);
  });

  test("empty portfolio", () => {
    const state = PortfolioState.create({});
    expect(PortfolioState.getTotalValue(state).toNumber()).toBe(0);

    const allocation = PortfolioState.getAllocation(state);
    expect(Object.keys(allocation)).toHaveLength(0);
  });

  test("zero value portfolio", () => {
    const state = PortfolioState.create({
      stocks: new Decimal(0),
      bonds: new Decimal(0),
    });

    expect(PortfolioState.getTotalValue(state).toNumber()).toBe(0);

    const allocation = PortfolioState.getAllocation(state);
    expect(allocation["stocks"].toNumber()).toBe(0.0);
    expect(allocation["bonds"].toNumber()).toBe(0.0);
  });
});
