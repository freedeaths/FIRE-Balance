/**
 * Tests for FIRE calculation engine - Direct port from Python test_engine.py
 * Ensures identical behavior between TypeScript and Python implementations
 */

import Decimal from "decimal.js";

import type { UserProfile, YearlyState } from "../data_models";
import {
  createUserProfile,
  createPortfolioConfiguration,
  getCurrentAge,
} from "../data_models";

import type { EngineInput, AnnualFinancialProjection } from "../engine";
import { FIREEngine, createEngineInput, createProjectionRow } from "../engine";

describe("FIREEngine", () => {
  // Create sample user profile fixture
  const createSampleProfile = (): UserProfile => {
    const portfolio = createPortfolioConfiguration({
      asset_classes: [
        {
          name: "Cash",
          allocation_percentage: new Decimal(10.0),
          expected_return: new Decimal(1.0),
          volatility: new Decimal(1.0),
          liquidity_level: "high",
        },
        {
          name: "Stocks",
          allocation_percentage: new Decimal(60.0),
          expected_return: new Decimal(7.0),
          volatility: new Decimal(15.0),
          liquidity_level: "medium",
        },
        {
          name: "Bonds",
          allocation_percentage: new Decimal(30.0),
          expected_return: new Decimal(3.0),
          volatility: new Decimal(5.0),
          liquidity_level: "low",
        },
      ],
      enable_rebalancing: true,
    });

    return createUserProfile({
      birth_year: 1990, // Around 34 years old in 2024
      expected_fire_age: 50,
      legal_retirement_age: 65,
      life_expectancy: 85,
      current_net_worth: new Decimal(100000.0),
      inflation_rate: new Decimal(3.0),
      safety_buffer_months: new Decimal(12.0), // 1 year safety buffer
      portfolio,
    });
  };

  // Create sample projection fixture
  const createSampleProjection = (): AnnualFinancialProjection[] => {
    const data: AnnualFinancialProjection[] = [];
    const currentYear = 2024;
    const startAge = 34;

    // Create 5 years of projection data
    for (let i = 0; i < 5; i++) {
      const age = startAge + i;
      const year = currentYear + i;

      // Simple progression: income grows, expenses stable
      const totalIncome = 80000.0 + i * 2000; // Growing income
      const totalExpense = 50000.0; // Stable expenses

      data.push(createProjectionRow(age, year, totalIncome, totalExpense));
    }

    return data;
  };

  // Create engine input fixture
  const createSampleEngineInput = (): EngineInput => {
    const userProfile = createSampleProfile();
    const projectionData = createSampleProjection();

    return createEngineInput(userProfile, projectionData);
  };

  let fireEngine: FIREEngine;
  let sampleInput: EngineInput;

  beforeEach(() => {
    sampleInput = createSampleEngineInput();
    fireEngine = new FIREEngine(sampleInput);
  });

  test("engine initialization", () => {
    expect(fireEngine.input).toBeDefined();
    expect(fireEngine.profile).toBeDefined();
    expect(fireEngine.projection_df).toBeDefined();
    expect(fireEngine.portfolio_simulator).toBeDefined();
    // PortfolioSimulator should be self-contained with internal calculator
    expect(fireEngine.portfolio_simulator.calculator).toBeDefined();
  });

  test("initial portfolio creation", () => {
    const portfolioSimulator = fireEngine.portfolio_simulator;
    const initialPortfolio = portfolioSimulator.getCurrentPortfolio();

    // Should have some assets based on user profile
    expect(Object.keys(initialPortfolio.asset_values).length).toBeGreaterThan(
      0,
    );

    // Total value should match current net worth
    const totalValue = Object.values(initialPortfolio.asset_values).reduce(
      (sum, val) => sum.add(val),
      new Decimal(0),
    );
    expect(totalValue.toNumber()).toBeCloseTo(
      fireEngine.profile.current_net_worth.toNumber(),
      6,
    );

    // Test reset functionality
    const originalValue = totalValue;
    portfolioSimulator.resetToInitial();
    const resetValue = Object.values(
      portfolioSimulator.getCurrentPortfolio().asset_values,
    ).reduce((sum, val) => sum.add(val), new Decimal(0));
    expect(resetValue.toNumber()).toBeCloseTo(originalValue.toNumber(), 6);
  });

  test("fire calculation basic", () => {
    const result = fireEngine.calculate();

    // Should return valid result
    expect(result).toBeDefined();
    expect(typeof result.is_fire_achievable).toBe("boolean");
    expect(typeof result.fire_net_worth).toBe("object"); // Decimal object
    expect(result.yearly_results.length).toBe(5); // 5 years of data

    // Each yearly result should have required fields
    for (const yearlyResult of result.yearly_results) {
      expect(yearlyResult.age).toBeGreaterThanOrEqual(34);
      expect(yearlyResult.year).toBeGreaterThanOrEqual(2024);
      expect(yearlyResult.total_income.toNumber()).toBeGreaterThan(0);
      expect(yearlyResult.total_expense.toNumber()).toBeGreaterThan(0);
      expect(typeof yearlyResult.net_cash_flow).toBe("object"); // Decimal object
      // Check investment return is numeric
      expect(typeof yearlyResult.investment_return).toBe("object"); // Decimal object
      expect(yearlyResult.portfolio_value.toNumber()).toBeGreaterThanOrEqual(0);
    }
  });

  test("yearly states calculation", () => {
    const yearlyStates = fireEngine.get_yearly_states();

    expect(yearlyStates.length).toBe(5); // 5 years of data

    for (const state of yearlyStates) {
      expect(state.age).toBeGreaterThanOrEqual(34);
      expect(state.year).toBeGreaterThanOrEqual(2024);

      // Financial metrics should be calculated
      expect(typeof state.net_worth).toBe("object"); // Decimal object
      expect(typeof state.is_sustainable).toBe("boolean");

      // Traditional FIRE metrics (for reference)
      expect(state.fire_number.toNumber()).toBeGreaterThan(0); // 25x expenses
      expect(typeof state.fire_progress).toBe("object"); // Decimal object

      // Portfolio metrics
      expect(state.portfolio_value.toNumber()).toBeGreaterThanOrEqual(0);
      expect(typeof state.investment_return).toBe("object"); // Decimal object
    }
  });

  test("fire number calculation", () => {
    const yearlyStates = fireEngine.get_yearly_states();

    for (const state of yearlyStates) {
      const expectedFireNumber = state.total_expense.toNumber() * 25.0;
      expect(state.fire_number.toNumber()).toBeCloseTo(expectedFireNumber, 6);
    }
  });

  test("fire progress calculation", () => {
    const yearlyStates = fireEngine.get_yearly_states();

    for (const state of yearlyStates) {
      if (state.fire_number.toNumber() > 0) {
        const expectedProgress =
          state.portfolio_value.toNumber() / state.fire_number.toNumber();
        expect(state.fire_progress.toNumber()).toBeCloseTo(expectedProgress, 6);
      } else {
        expect(state.fire_progress.toNumber()).toBe(0.0);
      }
    }
  });

  test("portfolio integration", () => {
    const result = fireEngine.calculate();

    // Portfolio should grow over time with positive cash flow
    const netWorths = result.yearly_results.map((yr) => yr.portfolio_value);

    // With positive cash flow and returns, net worth should generally increase
    const finalNetWorth = netWorths[netWorths.length - 1];
    const initialNetWorth = fireEngine.profile.current_net_worth;

    expect(finalNetWorth.toNumber()).toBeGreaterThan(
      initialNetWorth.toNumber(),
    ); // Should grow with positive cash flows
  });

  test("sustainability logic", () => {
    const yearlyStates = fireEngine.get_yearly_states();

    // Check that each state has sustainability metrics
    for (const state of yearlyStates) {
      expect(typeof state.net_worth).toBe("object"); // Decimal object
      expect(typeof state.is_sustainable).toBe("boolean");

      // Safety buffer should be calculated dynamically
      const expectedBuffer =
        state.total_expense.toNumber() *
        (fireEngine.profile.safety_buffer_months.toNumber() / 12.0);
      // Sustainability should be based on net_worth vs safety buffer
      const expectedSustainable = state.net_worth.toNumber() >= expectedBuffer;
      expect(state.is_sustainable).toBe(expectedSustainable);

      // Traditional FIRE metrics should still exist for reference
      expect(state.fire_number.toNumber()).toBeGreaterThan(0);
      expect(typeof state.fire_progress).toBe("object"); // Decimal object
    }
  });

  test("safety buffer configuration", () => {
    // Test with 6 months buffer
    const profile6m = createUserProfile({
      birth_year: 1990,
      expected_fire_age: 50,
      legal_retirement_age: 65,
      life_expectancy: 85,
      current_net_worth: new Decimal(100000.0),
      inflation_rate: new Decimal(3.0),
      safety_buffer_months: new Decimal(6.0), // 6 months
    });

    const engine6m = new FIREEngine(
      createEngineInput(profile6m, createSampleProjection()),
    );
    const states6m = engine6m.get_yearly_states();

    // Test with 24 months buffer
    const profile24m = createUserProfile({
      birth_year: 1990,
      expected_fire_age: 50,
      legal_retirement_age: 65,
      life_expectancy: 85,
      current_net_worth: new Decimal(100000.0),
      inflation_rate: new Decimal(3.0),
      safety_buffer_months: new Decimal(24.0), // 24 months
    });

    const engine24m = new FIREEngine(
      createEngineInput(profile24m, createSampleProjection()),
    );
    const states24m = engine24m.get_yearly_states();

    // Compare safety buffers (calculated dynamically)
    for (let i = 0; i < Math.min(states6m.length, states24m.length); i++) {
      const state6m = states6m[i];
      const state24m = states24m[i];

      // Calculate safety buffers dynamically
      const buffer6m = state6m.total_expense.toNumber() * (6.0 / 12.0);
      const buffer24m = state24m.total_expense.toNumber() * (24.0 / 12.0);

      // 24 month buffer should be 4x larger than 6 month buffer
      const expectedRatio = 24.0 / 6.0;
      const actualRatio = buffer24m / buffer6m;
      expect(Math.abs(actualRatio - expectedRatio)).toBeLessThan(0.01);

      // Sustainability logic should be different for different buffers
      const sustainable6m = state6m.net_worth.toNumber() >= buffer6m;
      const sustainable24m = state24m.net_worth.toNumber() >= buffer24m;
      expect(state6m.is_sustainable).toBe(sustainable6m);
      expect(state24m.is_sustainable).toBe(sustainable24m);
    }
  });
});

describe("EngineInput", () => {
  test("engine input creation", () => {
    const profile = createUserProfile({
      birth_year: 1990,
      expected_fire_age: 50,
      legal_retirement_age: 65,
      life_expectancy: 85,
      current_net_worth: new Decimal(50000.0),
      inflation_rate: new Decimal(2.5),
      safety_buffer_months: new Decimal(12.0),
    });

    const projectionData: AnnualFinancialProjection[] = [
      createProjectionRow(34, 2024, 60000.0, 40000.0),
      createProjectionRow(35, 2025, 62000.0, 41000.0),
    ];

    const engineInput = createEngineInput(profile, projectionData);

    expect(engineInput.user_profile).toBe(profile);
    expect(engineInput.annual_financial_projection.length).toBe(2);
    expect(engineInput.annual_financial_projection[0].age).toBe(34);
    expect(engineInput.annual_financial_projection[0].year).toBe(2024);
    expect(
      engineInput.annual_financial_projection[0].total_income.toNumber(),
    ).toBe(60000.0);
    expect(
      engineInput.annual_financial_projection[0].total_expense.toNumber(),
    ).toBe(40000.0);
  });
});

describe("YearlyState", () => {
  test("yearly state creation", () => {
    const state: YearlyState = {
      age: 35,
      year: 2025,
      total_income: new Decimal(70000.0),
      total_expense: new Decimal(45000.0),
      net_cash_flow: new Decimal(25000.0),
      portfolio_value: new Decimal(150000.0),
      net_worth: new Decimal(150000.0), // New field: net worth (can be negative)
      investment_return: new Decimal(5000.0),
      is_sustainable: false,
      fire_number: new Decimal(1125000.0), // 45000 * 25
      fire_progress: new Decimal(0.133), // 150000 / 1125000
    };

    // Test field access
    expect(state.age).toBe(35);
    expect(state.year).toBe(2025);
    expect(state.total_income.toNumber()).toBe(70000.0);
    expect(state.total_expense.toNumber()).toBe(45000.0);
    expect(state.net_cash_flow.toNumber()).toBe(25000.0);
    expect(state.portfolio_value.toNumber()).toBe(150000.0);
    expect(state.net_worth.toNumber()).toBe(150000.0); // Test new field
    expect(state.investment_return.toNumber()).toBe(5000.0);
    expect(state.is_sustainable).toBe(false);
    expect(state.fire_number.toNumber()).toBe(1125000.0);
    expect(state.fire_progress.toNumber()).toBeCloseTo(0.133, 3);
  });

  test("net worth negative values", () => {
    // Test state with negative net worth (debt situation)
    const state: YearlyState = {
      age: 70,
      year: 2055,
      total_income: new Decimal(30000.0),
      total_expense: new Decimal(50000.0),
      net_cash_flow: new Decimal(-20000.0),
      portfolio_value: new Decimal(0.0), // Portfolio depleted
      net_worth: new Decimal(-10000.0), // In debt
      investment_return: new Decimal(0.0),
      is_sustainable: false,
      fire_number: new Decimal(1250000.0), // 50000 * 25
      fire_progress: new Decimal(0.0),
    };

    // Test that negative net worth is properly stored and accessible
    expect(state.net_worth.toNumber()).toBe(-10000.0);
    expect(state.net_worth.toNumber()).toBeLessThan(0); // Explicitly test it's negative
    expect(state.portfolio_value.toNumber()).toBe(0.0);
    expect(state.is_sustainable).toBe(false);
    expect(state.net_cash_flow.toNumber()).toBeLessThan(0);
  });

  test("net worth vs portfolio value", () => {
    // Case 1: Portfolio has value, net worth should equal portfolio value
    const statePositive: YearlyState = {
      age: 40,
      year: 2030,
      total_income: new Decimal(80000.0),
      total_expense: new Decimal(60000.0),
      net_cash_flow: new Decimal(20000.0),
      portfolio_value: new Decimal(500000.0),
      net_worth: new Decimal(500000.0),
      investment_return: new Decimal(25000.0),
      is_sustainable: true,
      fire_number: new Decimal(1500000.0),
      fire_progress: new Decimal(0.333),
    };

    expect(statePositive.net_worth.toNumber()).toBe(
      statePositive.portfolio_value.toNumber(),
    );
    expect(statePositive.net_worth.toNumber()).toBeGreaterThan(0);
    expect(statePositive.is_sustainable).toBe(true);

    // Case 2: Portfolio depleted, net worth negative
    const stateNegative: YearlyState = {
      age: 75,
      year: 2065,
      total_income: new Decimal(20000.0),
      total_expense: new Decimal(60000.0),
      net_cash_flow: new Decimal(-40000.0),
      portfolio_value: new Decimal(0.0), // Portfolio depleted
      net_worth: new Decimal(-100000.0), // Accumulated debt
      investment_return: new Decimal(0.0),
      is_sustainable: false,
      fire_number: new Decimal(1500000.0),
      fire_progress: new Decimal(0.0),
    };

    expect(stateNegative.portfolio_value.toNumber()).toBe(0.0);
    expect(stateNegative.net_worth.toNumber()).toBeLessThan(0);
    expect(stateNegative.is_sustainable).toBe(false);
    expect(Math.abs(stateNegative.net_worth.toNumber())).toBeGreaterThan(0); // Has accumulated debt
  });
});
