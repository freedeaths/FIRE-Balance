/**
 * Tests for portfolio management - Direct port from Python test_portfolio_manager.py
 * Ensures identical behavior between TypeScript and Python implementations
 */

import {
  AssetClass,
  LiquidityLevel,
  PortfolioConfiguration,
  UserProfile,
  createPortfolioConfiguration,
  createUserProfile,
} from '../data_models';

import {
  AssetRandomFactor,
  LiquidityAwareFlowStrategy,
  PortfolioCalculator,
  PortfolioRandomFactors,
  PortfolioState,
  SimpleFlowStrategy,
} from '../portfolio';

describe('PortfolioCalculator', () => {
  // Create sample profile fixture
  const createSampleProfile = (): UserProfile => {
    const portfolio = createPortfolioConfiguration({
      asset_classes: [
        {
          name: 'Stocks', // Will normalize to "stocks"
          display_name: 'Stocks',
          allocation_percentage: 60.0,
          expected_return: 7.0,
          volatility: 15.0,
          liquidity_level: 'medium',
        },
        {
          name: 'Bonds', // Will normalize to "bonds"
          display_name: 'Bonds',
          allocation_percentage: 30.0,
          expected_return: 3.0,
          volatility: 5.0,
          liquidity_level: 'low',
        },
        {
          name: 'Cash', // Will normalize to "cash"
          display_name: 'Cash',
          allocation_percentage: 10.0,
          expected_return: 1.0,
          volatility: 1.0,
          liquidity_level: 'high',
        },
      ],
      enable_rebalancing: true,
    });

    return createUserProfile({
      birth_year: 1994, // current_age around 30 in 2024
      expected_fire_age: 50,
      legal_retirement_age: 65,
      life_expectancy: 85,
      current_net_worth: 100000.0,
      inflation_rate: 3.0,
      safety_buffer_months: 12,
      portfolio,
    });
  };

  let portfolioCalculator: PortfolioCalculator;
  let sampleProfile: UserProfile;

  beforeEach(() => {
    sampleProfile = createSampleProfile();
    portfolioCalculator = new PortfolioCalculator(sampleProfile);
  });

  test('portfolio calculator initialization', () => {
    expect(portfolioCalculator.profile).toBe(sampleProfile);
    expect(portfolioCalculator.portfolio_config).toBe(sampleProfile.portfolio);
  });

  test('get target allocation static', () => {
    const allocationYoung = portfolioCalculator.getTargetAllocation(30);
    const allocationOld = portfolioCalculator.getTargetAllocation(60);

    for (const allocation of [allocationYoung, allocationOld]) {
      expect(allocation['stocks']).toBe(0.6);
      expect(allocation['bonds']).toBe(0.3);
      expect(allocation['cash']).toBe(0.1);

      // Should sum to 1.0
      const sum = Object.values(allocation).reduce((s, v) => s + v, 0);
      expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
    }
  });

  test('calculate returns by allocation', () => {
    const portfolioValue = 100000;
    const allocation = { stocks: 0.6, bonds: 0.3, cash: 0.1 };

    const expectedReturn = portfolioCalculator.calculateReturnsByAllocation(
      allocation,
      portfolioValue
    );

    // Expected: 60% * 7% + 30% * 3% + 10% * 1% = 4.2% + 0.9% + 0.1% = 5.2%
    const expectedPercentage = 0.052;
    const expectedAmount = portfolioValue * expectedPercentage;

    expect(Math.abs(expectedReturn - expectedAmount)).toBeLessThan(0.01);
  });

  test('calculate returns by allocation zero value', () => {
    const allocation = { stocks: 0.6, bonds: 0.3, cash: 0.1 };
    const result = portfolioCalculator.calculateReturnsByAllocation(allocation, 0);
    expect(result).toBe(0);
  });

  test('calculate returns with volatility', () => {
    const portfolioValue = 100000;
    const allocation = { stocks: 0.6, bonds: 0.3, cash: 0.1 };

    // Create random factors with +1 std dev for all assets
    const randomFactors: PortfolioRandomFactors = {
      asset_factors: [
        { name: 'stocks', random_factor: 1.0 },
        { name: 'bonds', random_factor: 1.0 },
        { name: 'cash', random_factor: 1.0 },
      ],
    };

    const returnWithVolatility = portfolioCalculator.calculateReturnsWithVolatility(
      allocation,
      portfolioValue,
      randomFactors
    );

    // With +1 std dev, each asset gets its volatility added
    // Stocks: (7% + 15%) * 60% = 13.2%
    // Bonds: (3% + 5%) * 30% = 2.4%
    // Cash: (1% + 1%) * 10% = 0.2%
    // Total: 15.8%
    const expectedReturn = portfolioValue * 0.158;

    expect(Math.abs(returnWithVolatility - expectedReturn)).toBeLessThan(0.01);
  });

  test('should rebalance within threshold', () => {
    const currentAllocation = { stocks: 0.58, bonds: 0.32, cash: 0.1 };
    const targetAllocation = { stocks: 0.6, bonds: 0.3, cash: 0.1 };

    // Differences are within 5% threshold
    expect(
      portfolioCalculator.shouldRebalance(currentAllocation, targetAllocation)
    ).toBe(false);
  });

  test('should rebalance outside threshold', () => {
    const currentAllocation = { stocks: 0.5, bonds: 0.4, cash: 0.1 };
    const targetAllocation = { stocks: 0.6, bonds: 0.3, cash: 0.1 };

    // Stock difference is 10%, which exceeds 5% threshold
    expect(
      portfolioCalculator.shouldRebalance(currentAllocation, targetAllocation)
    ).toBe(true);
  });

  test('should rebalance disabled', () => {
    const profile = createSampleProfile();
    profile.portfolio.enable_rebalancing = false;
    const calculator = new PortfolioCalculator(profile);

    const currentAllocation = { stocks: 0.5, bonds: 0.4, cash: 0.1 };
    const targetAllocation = { stocks: 0.6, bonds: 0.3, cash: 0.1 };

    // Should not rebalance even with large differences
    expect(calculator.shouldRebalance(currentAllocation, targetAllocation)).toBe(false);
  });

  test('calculate rebalancing trades', () => {
    const currentPortfolio = PortfolioState.create({
      stocks: 50000, // Currently 50%
      bonds: 40000, // Currently 40%
      cash: 10000, // Currently 10%
    });

    const targetAllocation = { stocks: 0.6, bonds: 0.3, cash: 0.1 };

    const trades = portfolioCalculator.calculateRebalancingTrades(
      currentPortfolio,
      targetAllocation
    );

    // Expected trades:
    // Stocks: 60000 - 50000 = +10000
    // Bonds: 30000 - 40000 = -10000
    // Cash: 10000 - 10000 = 0
    expect(trades['stocks']).toBe(10000);
    expect(trades['bonds']).toBe(-10000);
    expect(trades['cash']).toBe(0);
  });

  test('portfolio state get allocation', () => {
    const portfolioState = PortfolioState.create({
      stocks: 60000,
      bonds: 30000,
      cash: 10000,
    });

    const allocation = PortfolioState.getAllocation(portfolioState);

    expect(allocation['stocks']).toBe(0.6);
    expect(allocation['bonds']).toBe(0.3);
    expect(allocation['cash']).toBe(0.1);

    // Test total_value property
    expect(PortfolioState.getTotalValue(portfolioState)).toBe(100000);
  });

  test('portfolio state get allocation zero value', () => {
    const portfolioState = PortfolioState.create({
      Stocks: 0,
      Bonds: 0,
    });

    const allocation = PortfolioState.getAllocation(portfolioState);

    expect(allocation['Stocks']).toBe(0.0);
    expect(allocation['Bonds']).toBe(0.0);
  });
});

describe('LiquidityAwareFlowStrategy', () => {
  let portfolioConfig: PortfolioConfiguration;
  let strategy: LiquidityAwareFlowStrategy;

  beforeEach(() => {
    portfolioConfig = createPortfolioConfiguration({
      asset_classes: [
        {
          name: 'Cash',
          display_name: 'Cash',
          allocation_percentage: 10.0,
          expected_return: 0.5,
          volatility: 0.0,
          liquidity_level: 'high',
        },
        {
          name: 'Stocks',
          display_name: 'Stocks',
          allocation_percentage: 60.0,
          expected_return: 7.0,
          volatility: 15.0,
          liquidity_level: 'medium',
        },
        {
          name: 'Bonds',
          display_name: 'Bonds',
          allocation_percentage: 30.0,
          expected_return: 3.0,
          volatility: 5.0,
          liquidity_level: 'low',
        },
      ],
      enable_rebalancing: true,
    });
    strategy = new LiquidityAwareFlowStrategy(3, portfolioConfig);
  });

  test('handle income cash buffer priority', () => {
    const portfolio = PortfolioState.create({
      cash: 1000, // Low cash
      stocks: 50000,
      bonds: 20000,
    });

    const annualExpenses = 24000; // Need 6000 for 3-month buffer
    const targetAllocation = { cash: 0.1, stocks: 0.6, bonds: 0.3 };
    const income = 10000;

    const allocation = strategy.handleIncome(income, portfolio, annualExpenses, targetAllocation);

    // Should prioritize filling cash buffer (need 5000 more)
    expect(allocation['cash']).toBe(5000);
    // Remaining 5000 should be invested in higher return assets first
    expect(allocation['stocks']).toBeGreaterThan(allocation['bonds']); // Stocks have higher return
  });

  test('handle expense liquidity priority', () => {
    const portfolio = PortfolioState.create({
      cash: 2000,
      stocks: 50000,
      bonds: 30000,
    });

    const expense = 5000;
    const withdrawal = strategy.handleExpense(expense, portfolio);

    // Should use all cash first
    expect(withdrawal['cash']).toBe(-2000);
    // Should withdraw from MEDIUM liquidity (Stocks) next
    expect(withdrawal['stocks']).toBeLessThan(0);
    // Should not touch LOW liquidity (Bonds) if not needed
    // (In this case, might still touch bonds due to proportional withdrawal)
  });

  test('handle expense return optimization', () => {
    // Create config with same liquidity but different returns
    const config = createPortfolioConfiguration({
      asset_classes: [
        {
          name: 'Stock_A',
          display_name: 'Stock_A',
          allocation_percentage: 50.0, // Sum must be 100%
          expected_return: 8.0, // Higher return
          volatility: 15.0,
          liquidity_level: 'medium',
        },
        {
          name: 'Stock_B',
          display_name: 'Stock_B',
          allocation_percentage: 50.0, // Sum must be 100%
          expected_return: 5.0, // Lower return
          volatility: 15.0,
          liquidity_level: 'medium',
        },
      ],
      enable_rebalancing: true,
    });

    const testStrategy = new LiquidityAwareFlowStrategy(3, config);

    const portfolio = PortfolioState.create({
      stock_a: 50000,
      stock_b: 50000,
    });

    const expense = 10000;
    const withdrawal = testStrategy.handleExpense(expense, portfolio);

    // Should sell more of Stock_B (lower return) than Stock_A
    // This tests the return optimization logic
    expect(Math.abs(withdrawal['stock_b'] || 0)).toBeGreaterThanOrEqual(
      Math.abs(withdrawal['stock_a'] || 0)
    );
  });

  test('liquidity level classification', () => {
    // Test the internal liquidity tier mapping
    const portfolio = PortfolioState.create({
      cash: 10000,
      stocks: 50000,
      bonds: 30000,
    });

    const highAssets = strategy._getAssetsByLiquidityTier('HIGH', portfolio);
    const mediumAssets = strategy._getAssetsByLiquidityTier('MEDIUM', portfolio);
    const lowAssets = strategy._getAssetsByLiquidityTier('LOW', portfolio);

    expect('cash' in highAssets).toBe(true);
    expect('stocks' in mediumAssets).toBe(true);
    expect('bonds' in lowAssets).toBe(true);
  });

  test('allocation sum precision correction', () => {
    // Create a portfolio with values that might have floating point precision issues
    const portfolio = PortfolioState.create({
      Asset1: 33333.33,
      Asset2: 33333.33,
      Asset3: 33333.34, // Total: 100000.00
    });

    const allocation = PortfolioState.getAllocation(portfolio);

    // Sum should be exactly 1.0 after precision correction
    const allocationSum = Object.values(allocation).reduce((sum, value) => sum + value, 0);
    expect(Math.abs(allocationSum - 1.0)).toBeLessThanOrEqual(1e-10);
  });

  test('display names', () => {
    // Test strategy display names return simple identifiers
    const liquidityStrategy = new LiquidityAwareFlowStrategy();
    const simpleStrategy = new SimpleFlowStrategy();

    // Should return simple string identifiers, not formatted strings
    expect(liquidityStrategy.getDisplayName()).toBe('liquidity_aware_strategy');
    expect(simpleStrategy.getDisplayName()).toBe('simple_conservative_strategy');
    expect(liquidityStrategy.getDisplayName()).not.toContain('{'); // No f-string formatting
  });
});

describe('PortfolioRandomFactors', () => {
  test('get factor', () => {
    const factors: PortfolioRandomFactors = {
      asset_factors: [
        { name: 'stocks', random_factor: 1.2 },
        { name: 'bonds', random_factor: -0.8 },
        { name: 'cash', random_factor: 0.1 },
      ],
    };

    expect(PortfolioRandomFactors.getFactor(factors, 'stocks')).toBe(1.2);
    expect(PortfolioRandomFactors.getFactor(factors, 'bonds')).toBe(-0.8);
    expect(PortfolioRandomFactors.getFactor(factors, 'cash')).toBe(0.1);
    expect(PortfolioRandomFactors.getFactor(factors, 'nonexistent')).toBe(0.0);
  });

  test('from dict', () => {
    const factorsDict = {
      Stocks: 1.2,
      Bonds: -0.8,
      Cash: 0.1,
    };

    const factors = PortfolioRandomFactors.fromDict(factorsDict);

    expect(factors.asset_factors).toHaveLength(3);
    expect(PortfolioRandomFactors.getFactor(factors, 'Stocks')).toBe(1.2);
    expect(PortfolioRandomFactors.getFactor(factors, 'Bonds')).toBe(-0.8);
    expect(PortfolioRandomFactors.getFactor(factors, 'Cash')).toBe(0.1);
  });
});

describe('PortfolioState', () => {
  test('create and basic operations', () => {
    const state = PortfolioState.create({
      stocks: 60000,
      bonds: 30000,
      cash: 10000,
    });

    expect(PortfolioState.getTotalValue(state)).toBe(100000);

    const allocation = PortfolioState.getAllocation(state);
    expect(allocation['stocks']).toBe(0.6);
    expect(allocation['bonds']).toBe(0.3);
    expect(allocation['cash']).toBe(0.1);
  });

  test('empty portfolio', () => {
    const state = PortfolioState.create({});
    expect(PortfolioState.getTotalValue(state)).toBe(0);

    const allocation = PortfolioState.getAllocation(state);
    expect(Object.keys(allocation)).toHaveLength(0);
  });

  test('zero value portfolio', () => {
    const state = PortfolioState.create({
      stocks: 0,
      bonds: 0,
    });

    expect(PortfolioState.getTotalValue(state)).toBe(0);

    const allocation = PortfolioState.getAllocation(state);
    expect(allocation['stocks']).toBe(0.0);
    expect(allocation['bonds']).toBe(0.0);
  });
});
