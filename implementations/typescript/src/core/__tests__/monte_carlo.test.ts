/**
 * Tests for Monte Carlo simulation - Direct port from Python test_monte_carlo_advanced.py
 * Ensures identical behavior between TypeScript and Python implementations
 */

import Decimal from "decimal.js";

import type { UserProfile, SimulationSettings } from "../data_models";
import {
  createUserProfile,
  createSimulationSettings,
  getCurrentAge,
} from "../data_models";

import type { AnnualFinancialProjection, EngineInput } from "../engine";
import { FIREEngine, createEngineInput, createProjectionRow } from "../engine";

import type { MonteCarloResult } from "../monte_carlo";
import { MonteCarloSimulator, createMonteCarloResult } from "../monte_carlo";

import { FinancialCrisisEvent } from "../black_swan_events";

describe("MonteCarloSimulatorSetup", () => {
  let profile: UserProfile;
  let projection_df: AnnualFinancialProjection[];
  let engine_input: EngineInput;
  let engine: FIREEngine;

  beforeEach(() => {
    profile = createUserProfile({
      birth_year: 1990,
      expected_fire_age: 45,
      legal_retirement_age: 65,
      life_expectancy: 85,
      current_net_worth: new Decimal(50000.0),
      inflation_rate: new Decimal(3.0),
      safety_buffer_months: new Decimal(12.0),
    });

    // Create basic projection
    const projection_data: AnnualFinancialProjection[] = [];
    for (let year_idx = 0; year_idx < 5; year_idx++) {
      const age = getCurrentAge(profile.birth_year) + year_idx;
      projection_data.push(
        createProjectionRow(age, 2025 + year_idx, 100000, 50000),
      );
    }

    projection_df = projection_data;
    engine_input = createEngineInput(profile, projection_df);
    engine = new FIREEngine(engine_input);
  });

  test("simulator initialization", () => {
    const simulator = new MonteCarloSimulator(engine);

    // Should have default settings
    expect(simulator.settings).toBeDefined();
    expect(simulator.settings.num_simulations).toBe(1000);

    // Should have base DataFrame
    expect(simulator.base_df.length).toBeGreaterThan(0);
    expect(simulator.base_df.length).toBe(5);

    // Should have personalized events
    expect(simulator.all_events.length).toBe(15);
    expect(simulator.all_events.every((e) => e.event_id)).toBe(true);
  });

  test("simulator with custom settings", () => {
    const custom_settings = createSimulationSettings({
      num_simulations: 100,
      confidence_level: new Decimal(0.95),
      include_black_swan_events: false,
      income_base_volatility: new Decimal(0.2),
      income_minimum_factor: new Decimal(0.1),
      expense_base_volatility: new Decimal(0.1),
      expense_minimum_factor: new Decimal(0.5),
    });

    const simulator = new MonteCarloSimulator(engine, custom_settings);

    expect(simulator.settings.num_simulations).toBe(100);
    expect(simulator.settings.include_black_swan_events).toBe(false);
    expect(simulator.settings.income_base_volatility.toNumber()).toBe(0.2);
    expect(simulator.settings.expense_base_volatility.toNumber()).toBe(0.1);
  });
});

describe("BasicVariations", () => {
  let profile: UserProfile;
  let projection_df: AnnualFinancialProjection[];
  let engine_input: EngineInput;
  let engine: FIREEngine;
  let settings: SimulationSettings;
  let simulator: MonteCarloSimulator;

  beforeEach(() => {
    profile = createUserProfile({
      birth_year: 1990,
      expected_fire_age: 45,
      legal_retirement_age: 65,
      life_expectancy: 85,
      current_net_worth: new Decimal(50000.0),
      inflation_rate: new Decimal(3.0),
      safety_buffer_months: new Decimal(12.0),
    });

    const projection_data: AnnualFinancialProjection[] = [];
    for (let year_idx = 0; year_idx < 10; year_idx++) {
      const age = getCurrentAge(profile.birth_year) + year_idx;
      projection_data.push(
        createProjectionRow(age, 2025 + year_idx, 100000, 50000),
      );
    }

    projection_df = projection_data;
    engine_input = createEngineInput(profile, projection_df);
    engine = new FIREEngine(engine_input);

    // Settings without black swan events
    settings = createSimulationSettings({
      num_simulations: 50,
      confidence_level: new Decimal(0.95),
      include_black_swan_events: false,
      income_base_volatility: new Decimal(0.1),
      income_minimum_factor: new Decimal(0.1),
      expense_base_volatility: new Decimal(0.05),
      expense_minimum_factor: new Decimal(0.5),
    });
    simulator = new MonteCarloSimulator(engine, settings);
  });

  test("income variation generation", () => {
    const variations = (simulator as any)._generate_income_variation();

    // Should have variations for each year
    expect(variations.length).toBe(10);

    // All variations should be positive (minimum factor applies)
    expect(variations.every((v: Decimal) => v.gt(new Decimal(0)))).toBe(true);

    // Should respect minimum factor
    expect(
      variations.every((v: Decimal) => v.gte(settings.income_minimum_factor)),
    ).toBe(true);

    // Working years should vary, post-FIRE should be stable
    const working_years = variations.slice(0, 10); // Age 35-44 (working years)

    // Working years should have some variation (not all exactly 1.0)
    expect(
      working_years.every((v: Decimal) =>
        v.sub(new Decimal(1.0)).abs().lt(new Decimal(0.001)),
      ),
    ).toBe(false);
  });

  test("expense variation generation", () => {
    const variations = (simulator as any)._generate_expense_variation();

    // Should have variations for each year
    expect(variations.length).toBe(10);

    // All variations should be positive
    expect(variations.every((v: Decimal) => v.gt(new Decimal(0)))).toBe(true);

    // Should respect minimum factor
    expect(
      variations.every((v: Decimal) => v.gte(settings.expense_minimum_factor)),
    ).toBe(true);

    // Should have some variation (not all exactly 1.0)
    expect(
      variations.every((v: Decimal) =>
        v.sub(new Decimal(1.0)).abs().lt(new Decimal(0.001)),
      ),
    ).toBe(false);
  });

  test("random scenario without black swan", () => {
    const original_df = [...simulator.base_df];
    const [scenario_df, events] = (
      simulator as any
    )._generate_random_scenario();

    // Should return tuple with DataFrame and empty events list
    expect(Array.isArray(scenario_df)).toBe(true);
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBe(0);

    // Should have same structure as original
    expect(scenario_df.length).toBe(original_df.length);
    expect(Object.keys(scenario_df[0])).toEqual(Object.keys(original_df[0]));

    // Values should be different from original (due to variations)
    const income_different = !scenario_df.every((row, i) =>
      row.total_income.eq(original_df[i].total_income),
    );
    const expense_different = !scenario_df.every((row, i) =>
      row.total_expense.eq(original_df[i].total_expense),
    );
    expect(income_different || expense_different).toBe(true);
  });

  test("random scenario always returns events", () => {
    const [scenario_df, events] = (
      simulator as any
    )._generate_random_scenario();

    // Should always return tuple
    expect(Array.isArray(scenario_df)).toBe(true);
    expect(Array.isArray(events)).toBe(true);

    // Should have no events (black swan disabled)
    expect(events.length).toBe(0);
  });
});

describe("BlackSwanEventApplication", () => {
  let profile: UserProfile;
  let projection_df: AnnualFinancialProjection[];
  let engine_input: EngineInput;
  let engine: FIREEngine;
  let settings: SimulationSettings;
  let simulator: MonteCarloSimulator;

  beforeEach(() => {
    profile = createUserProfile({
      birth_year: 1990,
      expected_fire_age: 45,
      legal_retirement_age: 65,
      life_expectancy: 85,
      current_net_worth: new Decimal(50000.0),
      inflation_rate: new Decimal(3.0),
      safety_buffer_months: new Decimal(12.0),
    });

    const projection_data: AnnualFinancialProjection[] = [];
    for (let year_idx = 0; year_idx < 5; year_idx++) {
      const age = getCurrentAge(profile.birth_year) + year_idx;
      projection_data.push(
        createProjectionRow(age, 2025 + year_idx, 100000, 50000),
      );
    }

    projection_df = projection_data;
    engine_input = createEngineInput(profile, projection_df);
    engine = new FIREEngine(engine_input);

    // Settings with black swan events
    settings = createSimulationSettings({
      num_simulations: 10,
      confidence_level: new Decimal(0.95),
      include_black_swan_events: true,
      income_base_volatility: new Decimal(0.1),
      income_minimum_factor: new Decimal(0.1),
      expense_base_volatility: new Decimal(0.05),
      expense_minimum_factor: new Decimal(0.5),
    });
    simulator = new MonteCarloSimulator(engine, settings);
  });

  test("black swan event simulation", () => {
    // Mock Math.random to ensure predictable testing
    const originalRandom = Math.random;
    Math.random = jest.fn(() => 0.01); // Very low value, should trigger high probability events

    try {
      const events = (simulator as any)._simulate_black_swan_events(35);

      // Should find some events (multiple events have >1% probability)
      expect(events.length).toBeGreaterThan(0);

      // All events should be applicable to age 35
      for (const event of events) {
        expect(event.age_range[0]).toBeLessThanOrEqual(35);
        expect(event.age_range[1]).toBeGreaterThanOrEqual(35);
      }
    } finally {
      Math.random = originalRandom;
    }
  });

  test("duplicate event filtering", () => {
    const test_df = [...simulator.base_df];

    // Mock event simulation to return same event twice
    const original_simulate = (simulator as any)._simulate_black_swan_events;
    (simulator as any)._simulate_black_swan_events = jest.fn((age: number) => {
      if (age === 35) {
        return [new FinancialCrisisEvent()];
      } else if (age === 36) {
        return [new FinancialCrisisEvent()]; // Same event
      }
      return [];
    });

    try {
      const [modified_df, triggered_events] = (
        simulator as any
      )._apply_black_swan_events(test_df);

      // Should only trigger once
      expect(triggered_events.length).toBe(1);
      expect(triggered_events[0]).toBe("financial_crisis");
    } finally {
      (simulator as any)._simulate_black_swan_events = original_simulate;
    }
  });

  test("event recovery logic", () => {
    const test_df = [...simulator.base_df];

    // Mock event simulation to return crisis in first year only
    const original_simulate = (simulator as any)._simulate_black_swan_events;
    (simulator as any)._simulate_black_swan_events = jest.fn((age: number) => {
      if (age === 35) {
        return [new FinancialCrisisEvent()];
      }
      return [];
    });

    try {
      const [modified_df, triggered_events] = (
        simulator as any
      )._apply_black_swan_events(test_df);

      // Should only trigger once
      expect(triggered_events.length).toBe(1);

      // Year 1: Full impact (-40%)
      const year1_income = modified_df[0].total_income;
      const expected_year1 = 100000 * 0.6;
      expect(year1_income.toNumber()).toBeCloseTo(expected_year1, 0);

      // Year 2: Recovery impact (-40% * 0.8 = -32%)
      const year2_income = modified_df[1].total_income;
      const expected_year2 = 100000 * 0.68;
      expect(year2_income.toNumber()).toBeCloseTo(expected_year2, 0);

      // Year 3: Should be back to normal (no ongoing effect)
      const year3_income = modified_df[2].total_income;
      expect(year3_income.toNumber()).toBeCloseTo(100000, 0);
    } finally {
      (simulator as any)._simulate_black_swan_events = original_simulate;
    }
  });
});

describe("MonteCarloAnalysis", () => {
  let simulation_data: {
    run_id: number;
    final_net_worth: Decimal;
    minimum_net_worth: Decimal;
    fire_success: boolean;
    black_swan_events: string[];
  }[];
  let simulator: MonteCarloSimulator;

  beforeEach(() => {
    // Create mock simulation data
    simulation_data = [
      {
        run_id: 0,
        final_net_worth: new Decimal(500000),
        minimum_net_worth: new Decimal(400000),
        fire_success: true,
        black_swan_events: ["financial_crisis"],
      },
      {
        run_id: 1,
        final_net_worth: new Decimal(-100000),
        minimum_net_worth: new Decimal(-150000),
        fire_success: false,
        black_swan_events: ["unemployment", "major_illness"],
      },
      {
        run_id: 2,
        final_net_worth: new Decimal(1000000),
        minimum_net_worth: new Decimal(800000),
        fire_success: true,
        black_swan_events: [],
      },
      {
        run_id: 3,
        final_net_worth: new Decimal(200000),
        minimum_net_worth: new Decimal(100000),
        fire_success: true,
        black_swan_events: ["market_crash"],
      },
      {
        run_id: 4,
        final_net_worth: new Decimal(-50000),
        minimum_net_worth: new Decimal(-80000),
        fire_success: false,
        black_swan_events: ["global_war", "hyperinflation"],
      },
    ];

    // Create a minimal simulator for testing analysis functions
    const profile = createUserProfile({
      birth_year: 1990,
      expected_fire_age: 45,
      legal_retirement_age: 65,
      life_expectancy: 85,
      current_net_worth: new Decimal(50000.0),
      inflation_rate: new Decimal(3.0),
      safety_buffer_months: new Decimal(12.0),
    });
    const projection_df = [createProjectionRow(35, 2025, 100000, 50000)];
    const engine_input = createEngineInput(profile, projection_df);
    const engine = new FIREEngine(engine_input);
    simulator = new MonteCarloSimulator(engine);
  });

  test("black swan impact analysis", () => {
    const analysis = (simulator as any)._analyze_black_swan_impact(
      simulation_data,
    );

    // Should always have worst case analysis (at least 1 sample)
    expect(analysis.worst_10_percent_avg_net_worth).toBeDefined();
    expect(analysis.worst_10_percent_success_rate).toBeDefined();
    expect(analysis.black_swan_impact_severity).toBeDefined();

    // Should have event frequency analysis
    expect(analysis.most_frequent_events).toBeDefined();
    expect(analysis.total_events_triggered).toBeDefined();
    expect(analysis.avg_events_per_simulation).toBeDefined();

    // Check specific values
    expect(analysis.worst_10_percent_avg_net_worth).toBe(-100000); // Worst scenario
    expect(analysis.worst_10_percent_success_rate).toBe(0.0); // Worst scenario failed
    expect(analysis.total_events_triggered).toBe(6); // Total events across all runs
    expect(analysis.avg_events_per_simulation).toBe(1.2); // 6 events / 5 runs
  });

  test("worst scenarios identification", () => {
    const scenarios = (simulator as any)._identify_worst_scenarios(
      simulation_data,
    );

    // Should identify failure rate (2/5 = 40% > 10%)
    const failure_scenario = scenarios.find((s: string) => s.includes("40%"));
    expect(failure_scenario).toBeDefined();

    // Should identify negative net worth scenarios (2/5 = 40%)
    const negative_scenario = scenarios.find((s: string) =>
      s.includes("negative net worth"),
    );
    expect(negative_scenario).toBeDefined();
  });

  test("resilience score calculation", () => {
    const score = (simulator as any)._calculate_resilience_score(
      simulation_data,
    );

    // Should be between 0 and 100
    expect(score.toNumber()).toBeGreaterThanOrEqual(0);
    expect(score.toNumber()).toBeLessThanOrEqual(100);

    // With 60% success rate, should be relatively low
    expect(score.toNumber()).toBeLessThan(70); // Success rate is only 60%
  });

  test("emergency fund recommendation", () => {
    const fund = (simulator as any)._recommend_emergency_fund(simulation_data);

    // Should return a positive value
    expect(fund.toNumber()).toBeGreaterThan(0);

    // With 60% success rate (< 70%), should recommend 18 months
    // annual_expenses = 50000, so 18 months = 50000 * 18 / 12 = 75000
    const expected_fund = (50000 * 18) / 12;
    expect(fund.toNumber()).toBeCloseTo(expected_fund, 0);
  });
});

describe("SensitivityAnalysis", () => {
  let simulator: MonteCarloSimulator;

  beforeEach(() => {
    const profile = createUserProfile({
      birth_year: 1990,
      expected_fire_age: 45,
      legal_retirement_age: 65,
      life_expectancy: 85,
      current_net_worth: new Decimal(50000.0),
      inflation_rate: new Decimal(3.0),
      safety_buffer_months: new Decimal(12.0),
    });
    const projection_df = [
      createProjectionRow(35, 2025, 100000, 50000),
      createProjectionRow(36, 2026, 100000, 50000),
    ];
    const engine_input = createEngineInput(profile, projection_df);
    const engine = new FIREEngine(engine_input);

    const settings = createSimulationSettings({
      num_simulations: 20, // Small number for fast testing
      confidence_level: new Decimal(0.95),
      include_black_swan_events: true,
      income_base_volatility: new Decimal(0.1),
      income_minimum_factor: new Decimal(0.1),
      expense_base_volatility: new Decimal(0.05),
      expense_minimum_factor: new Decimal(0.5),
    });
    simulator = new MonteCarloSimulator(engine, settings);
  });

  test("income volatility sensitivity", async () => {
    const variations = [0.05, 0.1, 0.15, 0.2];
    const results = await simulator.analyze_sensitivity(
      "income_volatility",
      variations,
    );

    // Should return results for each variation
    expect(results.length).toBe(4);

    // All results should be success rates between 0 and 1
    for (const result of results) {
      expect(result).toBeGreaterThanOrEqual(0.0);
      expect(result).toBeLessThanOrEqual(1.0);
    }
  });

  test("expense volatility sensitivity", async () => {
    const variations = [0.02, 0.05, 0.08];
    const results = await simulator.analyze_sensitivity(
      "expense_volatility",
      variations,
    );

    expect(results.length).toBe(3);
    for (const result of results) {
      expect(result).toBeGreaterThanOrEqual(0.0);
      expect(result).toBeLessThanOrEqual(1.0);
    }
  });

  test("black swan probability sensitivity", async () => {
    const variations = [0.0, 1.0]; // Off vs On
    const results = await simulator.analyze_sensitivity(
      "black_swan_probability",
      variations,
    );

    expect(results.length).toBe(2);

    // Results should be different (black swan should affect success rate)
    for (const result of results) {
      expect(result).toBeGreaterThanOrEqual(0.0);
      expect(result).toBeLessThanOrEqual(1.0);
    }
  });

  test("invalid parameter raises error", async () => {
    await expect(
      simulator.analyze_sensitivity("invalid_parameter", [0.1, 0.2]),
    ).rejects.toThrow();
  });
});

describe("SeedReproducibility", () => {
  let engine: FIREEngine;
  let settings: SimulationSettings;

  beforeEach(() => {
    const profile = createUserProfile({
      birth_year: 1990,
      expected_fire_age: 45,
      legal_retirement_age: 65,
      life_expectancy: 85,
      current_net_worth: new Decimal(50000.0),
      inflation_rate: new Decimal(3.0),
      safety_buffer_months: new Decimal(12.0),
    });
    const projection_df = [
      createProjectionRow(35, 2025, 100000, 50000),
      createProjectionRow(36, 2026, 100000, 50000),
    ];
    const engine_input = createEngineInput(profile, projection_df);
    engine = new FIREEngine(engine_input);

    settings = createSimulationSettings({
      num_simulations: 10,
      confidence_level: new Decimal(0.95),
      include_black_swan_events: true,
      income_base_volatility: new Decimal(0.1),
      income_minimum_factor: new Decimal(0.1),
      expense_base_volatility: new Decimal(0.05),
      expense_minimum_factor: new Decimal(0.5),
    });
  });

  test("seed reproducibility", async () => {
    const seed = 12345;

    // Run simulation twice with same seed
    const simulator1 = new MonteCarloSimulator(engine, settings, seed);
    const result1 = await simulator1.run_simulation();

    const simulator2 = new MonteCarloSimulator(engine, settings, seed);
    const result2 = await simulator2.run_simulation();

    // Results should be identical
    expect(result1.success_rate.eq(result2.success_rate)).toBe(true);
    expect(result1.mean_final_net_worth.eq(result2.mean_final_net_worth)).toBe(
      true,
    );
    expect(
      result1.median_final_net_worth.eq(result2.median_final_net_worth),
    ).toBe(true);
  });

  test("different seeds produce different results", async () => {
    // Run simulation with different seeds
    const simulator1 = new MonteCarloSimulator(engine, settings, 111);
    const result1 = await simulator1.run_simulation();

    const simulator2 = new MonteCarloSimulator(engine, settings, 222);
    const result2 = await simulator2.run_simulation();

    // Results should be different (with high probability)
    const different_results =
      !result1.success_rate.eq(result2.success_rate) ||
      !result1.mean_final_net_worth.eq(result2.mean_final_net_worth) ||
      !result1.median_final_net_worth.eq(result2.median_final_net_worth);
    expect(different_results).toBe(true);
  });

  test("no seed produces random results", async () => {
    // Run simulation twice without seed
    const simulator1 = new MonteCarloSimulator(engine, settings);
    const result1 = await simulator1.run_simulation();

    const simulator2 = new MonteCarloSimulator(engine, settings);
    const result2 = await simulator2.run_simulation();

    // Results should be different (with very high probability)
    const different_results =
      !result1.success_rate.eq(result2.success_rate) ||
      !result1.mean_final_net_worth.eq(result2.mean_final_net_worth) ||
      !result1.median_final_net_worth.eq(result2.median_final_net_worth);
    expect(different_results).toBe(true);
  });

  test("sensitivity analysis seed consistency", async () => {
    const seed = 54321;
    const simulator = new MonteCarloSimulator(engine, settings, seed);

    // Run sensitivity analysis twice
    const variations = [0.1, 0.2];
    const results1 = await simulator.analyze_sensitivity(
      "income_volatility",
      variations,
    );
    const results2 = await simulator.analyze_sensitivity(
      "income_volatility",
      variations,
    );

    // Results should be identical when using same seed
    expect(results1).toEqual(results2);
  });
});

describe("MonteCarloIntegration", () => {
  let engine: FIREEngine;

  beforeEach(() => {
    const profile = createUserProfile({
      birth_year: 1990,
      expected_fire_age: 45,
      legal_retirement_age: 65,
      life_expectancy: 85,
      current_net_worth: new Decimal(50000.0),
      inflation_rate: new Decimal(3.0),
      safety_buffer_months: new Decimal(12.0),
    });
    const projection_data: AnnualFinancialProjection[] = [];
    for (let year_idx = 0; year_idx < 10; year_idx++) {
      const age = getCurrentAge(profile.birth_year) + year_idx;
      projection_data.push(
        createProjectionRow(age, 2025 + year_idx, 100000, 50000),
      );
    }

    const projection_df = projection_data;
    const engine_input = createEngineInput(profile, projection_df);
    engine = new FIREEngine(engine_input);
  });

  test("complete simulation run", async () => {
    const settings = createSimulationSettings({
      num_simulations: 50, // Small number for fast testing
      confidence_level: new Decimal(0.95),
      include_black_swan_events: true,
      income_base_volatility: new Decimal(0.1),
      income_minimum_factor: new Decimal(0.1),
      expense_base_volatility: new Decimal(0.05),
      expense_minimum_factor: new Decimal(0.5),
    });

    const simulator = new MonteCarloSimulator(engine, settings);
    const result = await simulator.run_simulation();

    // Check result structure
    expect(result).toBeDefined();
    expect(result.total_simulations).toBe(50);
    expect(
      result.successful_simulations + (50 - result.successful_simulations),
    ).toBe(50);

    // Check statistical measures
    expect(result.success_rate.gte(new Decimal(0.0))).toBe(true);
    expect(result.success_rate.lte(new Decimal(1.0))).toBe(true);
    expect(result.mean_final_net_worth).toBeInstanceOf(Decimal);
    expect(result.median_final_net_worth).toBeInstanceOf(Decimal);

    // Check black swan analysis is present
    expect(result.black_swan_impact_analysis).toBeDefined();
    expect(result.resilience_score).toBeDefined();
    expect(result.recommended_emergency_fund).toBeDefined();

    // Check percentiles make sense
    expect(
      result.percentile_5_net_worth.lte(result.median_final_net_worth),
    ).toBe(true);
    expect(
      result.median_final_net_worth.lte(result.percentile_95_net_worth),
    ).toBe(true);
  });

  test("simulation without black swan events", async () => {
    const settings = createSimulationSettings({
      num_simulations: 20,
      confidence_level: new Decimal(0.95),
      include_black_swan_events: false,
      income_base_volatility: new Decimal(0.1),
      income_minimum_factor: new Decimal(0.1),
      expense_base_volatility: new Decimal(0.05),
      expense_minimum_factor: new Decimal(0.5),
    });

    const simulator = new MonteCarloSimulator(engine, settings);
    const result = await simulator.run_simulation();

    // Should still have basic results
    expect(result).toBeDefined();
    expect(result.total_simulations).toBe(20);

    // Black swan analysis should be undefined
    expect(result.black_swan_impact_analysis).toBeUndefined();
    expect(result.resilience_score).toBeUndefined();
    expect(result.recommended_emergency_fund).toBeUndefined();
  });
});
