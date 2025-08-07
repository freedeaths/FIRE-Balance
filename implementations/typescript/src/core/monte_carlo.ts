/**
 * Monte Carlo simulation for FIRE calculation risk analysis
 * Direct TypeScript port from Python monte_carlo.py
 *
 * This module provides statistical analysis of FIRE plans using Monte Carlo simulation,
 * including black swan events and sensitivity analysis.
 */

import type {
  BlackSwanEvent,
  SimulationSettings,
  UserProfile
} from './data_models';
import {
  createSimulationSettings,
  getCurrentAge
} from './data_models';
import type {
  AnnualFinancialProjection,
  EngineInput
} from './engine';
import {
  FIREEngine,
  createEngineInput
} from './engine';
import { createBlackSwanEvents } from './black_swan_events';

// =============================================================================
// Monte Carlo Result Data Structure
// =============================================================================

/**
 * Results from Monte Carlo simulation
 * Direct TypeScript equivalent of Python's MonteCarloResult dataclass
 */
export interface MonteCarloResult {
  success_rate: number;  // Probability of FIRE success (0-1)
  total_simulations: number;
  successful_simulations: number;

  // Statistical analysis
  mean_final_net_worth: number;
  median_final_net_worth: number;
  percentile_5_net_worth: number;  // Worst 5% scenario
  percentile_95_net_worth: number;  // Best 5% scenario

  // Risk metrics - final net worth
  worst_case_final_net_worth: number;
  best_case_final_net_worth: number;
  standard_deviation_final_net_worth: number;

  // Risk metrics - minimum net worth (most sensitive indicator)
  mean_minimum_net_worth: number;
  median_minimum_net_worth: number;
  percentile_5_minimum_net_worth: number;  // Worst 5% scenario for minimum
  percentile_25_minimum_net_worth: number;  // 25th percentile for minimum
  percentile_75_minimum_net_worth: number;  // 75th percentile for minimum
  percentile_95_minimum_net_worth: number;  // Best 5% scenario for minimum
  worst_case_minimum_net_worth: number;
  best_case_minimum_net_worth: number;
  standard_deviation_minimum_net_worth: number;

  // Black swan analysis results
  black_swan_impact_analysis?: Record<string, any>;
  worst_case_scenarios?: string[];
  resilience_score?: number;  // (0-100)
  recommended_emergency_fund?: number;
}

// =============================================================================
// Monte Carlo Simulator - Main Class
// =============================================================================

/**
 * Monte Carlo simulator for FIRE calculation risk analysis
 * Direct TypeScript equivalent of Python's MonteCarloSimulator class
 */
export class MonteCarloSimulator {
  public readonly engine: FIREEngine;
  public readonly settings: SimulationSettings;
  public readonly base_df: AnnualFinancialProjection[];
  public readonly seed: number | null;
  public readonly all_events: BlackSwanEvent[];
  private _rng_state: number;

  constructor(
    engine: FIREEngine,
    settings?: SimulationSettings,
    seed?: number | null
  ) {
    this.engine = engine;
    this.settings = settings || createSimulationSettings({
      num_simulations: 1000,
      confidence_level: 0.95,
      include_black_swan_events: true,
      income_base_volatility: 0.1,
      income_minimum_factor: 0.1,
      expense_base_volatility: 0.05,
      expense_minimum_factor: 0.5,
    });
    this.base_df = [...engine.projection_df];
    this.seed = seed || null;
    this._rng_state = seed || Date.now();

    // Create personalized black swan events based on user profile
    this.all_events = createBlackSwanEvents(engine.profile);
  }

  /**
   * Seeded random number generator using Linear Congruential Generator (LCG)
   * Equivalent to resetting random.seed() and np.random.seed() in Python
   */
  private _reset_rng_state(): void {
    if (this.seed !== null) {
      this._rng_state = this.seed;
    }
  }

  /**
   * Generate seeded random number [0,1)
   * Uses LCG algorithm for deterministic results when seed is provided
   */
  private _seeded_random(): number {
    if (this.seed === null) {
      return Math.random();
    }

    // LCG parameters (same as used in many C libraries)
    const a = 1664525;
    const c = 1013904223;
    const m = Math.pow(2, 32);

    this._rng_state = (a * this._rng_state + c) % m;
    return this._rng_state / m;
  }

  /**
   * Run complete Monte Carlo simulation
   */
  run_simulation(progress_callback?: (current: number, total: number) => void): MonteCarloResult {
    // Reset random seed for reproducible results (equivalent to Python's behavior)
    this._reset_rng_state();
    const final_net_worths: number[] = [];
    const minimum_net_worths: number[] = [];
    let successful_runs = 0;
    const simulation_data: Array<{
      run_id: number;
      final_net_worth: number;
      minimum_net_worth: number;
      fire_success: boolean;
      black_swan_events: string[];
    }> = [];

    for (let run_id = 0; run_id < this.settings.num_simulations; run_id++) {
      // Report progress if callback provided
      if (progress_callback && (run_id % Math.max(1, Math.floor(this.settings.num_simulations / 100)) === 0)) {
        progress_callback(run_id, this.settings.num_simulations);
      }

      // Generate random scenario with black swan events
      const [scenario_df, black_swan_events] = this._generate_random_scenario();

      // Create temporary engine with random scenario
      const temp_input = createEngineInput(
        this.engine.profile,
        scenario_df
      );
      const temp_engine = new FIREEngine(temp_input);

      // Run calculation
      const result = temp_engine.calculate();

      // Collect results
      final_net_worths.push(result.final_net_worth);

      // Calculate minimum net worth across entire lifetime
      let minimum_net_worth = result.final_net_worth; // fallback
      if (result.yearly_results.length > 0) {
        minimum_net_worth = Math.min(...result.yearly_results.map(state => state.net_worth));
      }
      minimum_net_worths.push(minimum_net_worth);
      const is_successful = result.is_fire_achievable;
      if (is_successful) {
        successful_runs++;
      }

      // Store simulation data for black swan analysis
      simulation_data.push({
        run_id,
        final_net_worth: result.final_net_worth,
        minimum_net_worth,
        fire_success: is_successful,
        black_swan_events,
      });
    }

    // Report final progress
    if (progress_callback) {
      progress_callback(this.settings.num_simulations, this.settings.num_simulations);
    }

    // Calculate basic statistics
    const final_net_worths_array = final_net_worths;
    const minimum_net_worths_array = minimum_net_worths;

    // Black swan analysis
    let black_swan_analysis: Record<string, any> | undefined;
    let worst_scenarios: string[] | undefined;
    let resilience_score: number | undefined;
    let emergency_fund: number | undefined;

    if (this.settings.include_black_swan_events && simulation_data.length > 0) {
      black_swan_analysis = this._analyze_black_swan_impact(simulation_data);
      worst_scenarios = this._identify_worst_scenarios(simulation_data);
      resilience_score = this._calculate_resilience_score(simulation_data);
      emergency_fund = this._recommend_emergency_fund(simulation_data);
    }

    return {
      success_rate: successful_runs / this.settings.num_simulations,
      total_simulations: this.settings.num_simulations,
      successful_simulations: successful_runs,
      mean_final_net_worth: this._mean(final_net_worths_array),
      median_final_net_worth: this._median(final_net_worths_array),
      percentile_5_net_worth: this._percentile(final_net_worths_array, 5),
      percentile_95_net_worth: this._percentile(final_net_worths_array, 95),
      worst_case_final_net_worth: Math.min(...final_net_worths_array),
      best_case_final_net_worth: Math.max(...final_net_worths_array),
      standard_deviation_final_net_worth: this._std(final_net_worths_array),
      // Minimum net worth statistics (most sensitive risk indicator)
      mean_minimum_net_worth: this._mean(minimum_net_worths_array),
      median_minimum_net_worth: this._median(minimum_net_worths_array),
      percentile_5_minimum_net_worth: this._percentile(minimum_net_worths_array, 5),
      percentile_25_minimum_net_worth: this._percentile(minimum_net_worths_array, 25),
      percentile_75_minimum_net_worth: this._percentile(minimum_net_worths_array, 75),
      percentile_95_minimum_net_worth: this._percentile(minimum_net_worths_array, 95),
      worst_case_minimum_net_worth: Math.min(...minimum_net_worths_array),
      best_case_minimum_net_worth: Math.max(...minimum_net_worths_array),
      standard_deviation_minimum_net_worth: this._std(minimum_net_worths_array),
      black_swan_impact_analysis: black_swan_analysis,
      worst_case_scenarios: worst_scenarios,
      resilience_score,
      recommended_emergency_fund: emergency_fund,
    };
  }

  /**
   * Generate a random scenario by applying variations to base data
   */
  private _generate_random_scenario(): [AnnualFinancialProjection[], string[]] {
    const scenario_df = this.base_df.map(row => ({ ...row }));

    // Apply basic income/expense variations
    const income_multiplier = this._generate_income_variation();
    scenario_df.forEach((row, i) => {
      row.total_income *= income_multiplier[i];
    });

    const expense_multiplier = this._generate_expense_variation();
    scenario_df.forEach((row, i) => {
      row.total_expense *= expense_multiplier[i];
    });

    // Apply black swan events based on user settings
    if (this.settings.include_black_swan_events) {
      return this._apply_black_swan_events(scenario_df);
    } else {
      return [scenario_df, []];
    }
  }

  /**
   * Generate random income variations
   */
  private _generate_income_variation(): number[] {
    const num_years = this.base_df.length;
    const variations = new Array(num_years).fill(1);

    const current_age = getCurrentAge(this.engine.profile.birth_year);
    const fire_age = this.engine.profile.expected_fire_age;

    for (let i = 0; i < num_years; i++) {
      const age = current_age + i;

      // Only apply income volatility during working years (before FIRE)
      if (age < fire_age) {
        // Base economic uncertainty with configurable volatility
        const base_variation = this._normal_random(1.0, this.settings.income_base_volatility);

        // Apply minimum factor safety net
        variations[i] = Math.max(this.settings.income_minimum_factor, base_variation);
      } else {
        // Post-FIRE: income is stable (pensions, fixed returns)
        variations[i] = 1.0;
      }
    }

    return variations;
  }

  /**
   * Generate random expense variations
   */
  private _generate_expense_variation(): number[] {
    const num_years = this.base_df.length;
    const variations = new Array(num_years).fill(1);

    // Apply expense volatility throughout entire life
    for (let i = 0; i < num_years; i++) {
      // Base expense volatility using normal distribution (consistent with income)
      const base_variation = this._normal_random(1.0, this.settings.expense_base_volatility);

      // Apply minimum factor safety net (consistent with income)
      variations[i] = Math.max(this.settings.expense_minimum_factor, base_variation);
    }

    return variations;
  }

  /**
   * Apply black swan events to the scenario
   */
  private _apply_black_swan_events(df: AnnualFinancialProjection[]): [AnnualFinancialProjection[], string[]] {
    const modified_df = df.map(row => ({ ...row }));
    const triggered_event_ids: string[] = [];
    const active_events: Record<string, [BlackSwanEvent, number]> = {};

    const num_years = df.length;
    for (let year_idx = 0; year_idx < num_years; year_idx++) {
      const current_age = getCurrentAge(this.engine.profile.birth_year) + year_idx;

      // Simulate new black swan events for this year
      const new_events = this._simulate_black_swan_events(current_age);

      // Filter out events that are already active (avoid duplicate events)
      const actually_triggered_events = new_events.filter(event => !(event.event_id in active_events));

      for (const event of actually_triggered_events) {
        triggered_event_ids.push(event.event_id);
        if (event.duration_years > 1) {
          active_events[event.event_id] = [event, event.duration_years - 1];
        }
      }

      // Apply new events (first year impact, full strength)
      for (const event of actually_triggered_events) {
        this._apply_event_impact(modified_df, year_idx, event, 1.0);
      }

      // Apply ongoing events with diminishing impact (events from previous years)
      const newly_active_event_ids = new Set(actually_triggered_events.map(e => e.event_id));
      for (const [event_id, [original_event, years_remaining]] of Object.entries(active_events)) {
        // Skip events that were just triggered this year
        if (newly_active_event_ids.has(event_id)) {
          continue;
        }

        // Calculate recovery multiplier based on recovery_factor
        const recovery_multiplier = original_event.recovery_factor;
        this._apply_event_impact(modified_df, year_idx, original_event, recovery_multiplier);

        // Update remaining years
        active_events[event_id] = [original_event, years_remaining - 1];
        if (active_events[event_id][1] <= 0) {
          delete active_events[event_id];
        }
      }
    }

    return [modified_df, triggered_event_ids];
  }

  /**
   * Apply black swan event impact to a specific year
   */
  private _apply_event_impact(
    df: AnnualFinancialProjection[],
    year_idx: number,
    event: BlackSwanEvent,
    recovery_multiplier: number
  ): void {
    if (year_idx < 0 || year_idx >= df.length) {
      return;
    }

    const row = df[year_idx];

    // Apply income impact if event has income_impact property
    if ('income_impact' in event && (event as any).income_impact !== 0) {
      const impact_factor = 1 + ((event as any).income_impact * recovery_multiplier);
      row.total_income *= Math.max(0, impact_factor);
    }

    // Apply expense impact if event has expense_impact property
    if ('expense_impact' in event && (event as any).expense_impact !== 0) {
      const impact_factor = 1 + ((event as any).expense_impact * recovery_multiplier);
      row.total_expense *= Math.max(0, impact_factor);
    }
  }

  /**
   * Simulate black swan events for a given age
   */
  private _simulate_black_swan_events(age: number): BlackSwanEvent[] {
    const triggered_events: BlackSwanEvent[] = [];

    for (const event of this.all_events) {
      // Check age range - this is where age filtering should happen
      if (event.age_range[0] <= age && age <= event.age_range[1]) {
        // Random check against probability
        if (this._seeded_random() < event.annual_probability) {
          triggered_events.push(event);
        }
      }
    }

    return triggered_events;
  }

  /**
   * Analyze sensitivity to a specific parameter
   */
  analyze_sensitivity(parameter: string, variations: number[]): number[] {
    const results: number[] = [];

    for (const variation of variations) {
      // Create modified settings based on parameter
      let modified_settings: SimulationSettings;

      if (parameter === "income_volatility") {
        modified_settings = createSimulationSettings({
          num_simulations: Math.floor(this.settings.num_simulations / 4), // Faster for sensitivity analysis
          confidence_level: this.settings.confidence_level,
          include_black_swan_events: this.settings.include_black_swan_events,
          income_base_volatility: variation,
          income_minimum_factor: this.settings.income_minimum_factor,
          expense_base_volatility: this.settings.expense_base_volatility,
          expense_minimum_factor: this.settings.expense_minimum_factor,
        });
      } else if (parameter === "expense_volatility") {
        modified_settings = createSimulationSettings({
          num_simulations: Math.floor(this.settings.num_simulations / 4),
          confidence_level: this.settings.confidence_level,
          include_black_swan_events: this.settings.include_black_swan_events,
          income_base_volatility: this.settings.income_base_volatility,
          income_minimum_factor: this.settings.income_minimum_factor,
          expense_base_volatility: variation,
          expense_minimum_factor: this.settings.expense_minimum_factor,
        });
      } else if (parameter === "black_swan_probability") {
        modified_settings = createSimulationSettings({
          num_simulations: Math.floor(this.settings.num_simulations / 4),
          confidence_level: this.settings.confidence_level,
          include_black_swan_events: variation > 0.5, // Treat as boolean threshold
          income_base_volatility: this.settings.income_base_volatility,
          income_minimum_factor: this.settings.income_minimum_factor,
          expense_base_volatility: this.settings.expense_base_volatility,
          expense_minimum_factor: this.settings.expense_minimum_factor,
        });
      } else {
        throw new Error(
          `Unknown parameter: ${parameter}. ` +
          `Supported: 'income_volatility', 'expense_volatility', 'black_swan_probability'`
        );
      }

      // Run simulation with modified parameter (use same seed for consistency)
      const temp_simulator = new MonteCarloSimulator(this.engine, modified_settings, this.seed);
      const result = temp_simulator.run_simulation();
      results.push(result.success_rate);
    }

    return results;
  }

  /**
   * Analyze black swan impact on success rate
   */
  private _analyze_black_swan_impact(simulation_data: Array<{
    run_id: number;
    final_net_worth: number;
    minimum_net_worth: number;
    fire_success: boolean;
    black_swan_events: string[];
  }>): Record<string, any> {
    const impact_analysis: Record<string, any> = {};

    // Find worst 10% scenarios (at least 1 scenario)
    const worst_count = Math.max(1, Math.floor(simulation_data.length / 10));
    const worst_10_percent = simulation_data
      .slice()
      .sort((a, b) => a.final_net_worth - b.final_net_worth)
      .slice(0, worst_count);

    if (worst_10_percent.length > 0) {
      const avg_worst_net_worth = this._mean(worst_10_percent.map(r => r.final_net_worth));
      const success_rate_worst = worst_10_percent.filter(r => r.fire_success).length / worst_10_percent.length;

      impact_analysis.worst_10_percent_avg_net_worth = avg_worst_net_worth;
      impact_analysis.worst_10_percent_success_rate = success_rate_worst;
      impact_analysis.black_swan_impact_severity = Math.max(0, 1.0 - success_rate_worst);
    }

    // Analyze event frequency
    const all_events = simulation_data.flatMap(sim => sim.black_swan_events);

    if (all_events.length > 0) {
      const event_counts: Record<string, number> = {};
      for (const event of all_events) {
        event_counts[event] = (event_counts[event] || 0) + 1;
      }

      // Sort by frequency
      const most_frequent = Object.entries(event_counts)
        .sort(([, a], [, b]) => b - a)
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

      impact_analysis.most_frequent_events = most_frequent;
      impact_analysis.total_events_triggered = all_events.length;
      impact_analysis.avg_events_per_simulation = all_events.length / simulation_data.length;
    }

    return impact_analysis;
  }

  /**
   * Identify worst-case scenarios
   */
  private _identify_worst_scenarios(simulation_data: Array<{
    run_id: number;
    final_net_worth: number;
    minimum_net_worth: number;
    fire_success: boolean;
    black_swan_events: string[];
  }>): string[] {
    const scenarios: string[] = [];

    // Analyze failure rate
    const failed_runs = simulation_data.filter(r => !r.fire_success);
    // If failure rate > 10%
    if (failed_runs.length > simulation_data.length * 0.1) {
      const failure_rate = failed_runs.length / simulation_data.length;
      scenarios.push(
        `Approximately ${Math.round(failure_rate * 100)}% of simulations show FIRE plan failure`
      );

      // Analyze worst failures
      const worst_failures = failed_runs
        .slice()
        .sort((a, b) => a.final_net_worth - b.final_net_worth)
        .slice(0, Math.max(1, Math.floor(failed_runs.length / 10)));
      if (worst_failures.length > 0) {
        const avg_worst = this._mean(worst_failures.map(r => r.final_net_worth));
        scenarios.push(`Worst case average final net worth: $${Math.round(avg_worst).toLocaleString()}`);
      }
    }

    // Analyze negative net worth scenarios
    const negative_net_worth = simulation_data.filter(r => r.final_net_worth < 0);
    if (negative_net_worth.length > 0) {
      const negative_rate = negative_net_worth.length / simulation_data.length;
      scenarios.push(`${(negative_rate * 100).toFixed(1)}% of scenarios end with negative net worth`);
    }

    return scenarios;
  }

  /**
   * Calculate resilience score (0-100)
   */
  private _calculate_resilience_score(simulation_data: Array<{
    run_id: number;
    final_net_worth: number;
    minimum_net_worth: number;
    fire_success: boolean;
    black_swan_events: string[];
  }>): number {
    const success_rate = simulation_data.filter(r => r.fire_success).length / simulation_data.length;

    // Consider success rate and result stability
    const final_net_worths = simulation_data.map(r => r.final_net_worth);
    const mean_net_worth = this._mean(final_net_worths);

    let cv: number;
    if (mean_net_worth === 0) {
      cv = 1; // Maximum volatility
    } else {
      cv = this._std(final_net_worths) / Math.abs(mean_net_worth);
    }

    // Calculate combined score
    const stability_score = Math.max(0, 1 - cv); // Lower coefficient of variation = higher stability
    const resilience = (success_rate * 0.7 + stability_score * 0.3) * 100;

    return Math.min(100, Math.max(0, resilience));
  }

  /**
   * Recommend emergency fund based on risk analysis
   */
  private _recommend_emergency_fund(simulation_data: Array<{
    run_id: number;
    final_net_worth: number;
    minimum_net_worth: number;
    fire_success: boolean;
    black_swan_events: string[];
  }>): number {
    // Estimate user's annual expenses from engine data
    let annual_expenses: number;

    if (this.base_df.length > 0) {
      annual_expenses = this._mean(this.base_df.map(row => row.total_expense));
    } else {
      annual_expenses = 50000.0; // Default fallback
    }

    // Adjust based on success rate
    const success_rate = simulation_data.filter(r => r.fire_success).length / simulation_data.length;

    let emergency_months: number;
    if (success_rate >= 0.9) {
      emergency_months = 6; // High success rate, 6 months expenses
    } else if (success_rate >= 0.7) {
      emergency_months = 12; // Medium success rate, 1 year expenses
    } else {
      emergency_months = 18; // Low success rate, 1.5 years expenses
    }

    return annual_expenses * emergency_months / 12;
  }

  // =============================================================================
  // Statistical Helper Functions
  // =============================================================================

  private _mean(values: number[]): number {
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }

  private _median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  private _percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;
    return lower === upper ? sorted[lower] : sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  private _std(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = this._mean(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private _normal_random(mean: number, std: number): number {
    // Box-Muller transform for normal distribution
    let u = 0, v = 0;
    while (u === 0) u = this._seeded_random(); // Converting [0,1) to (0,1)
    while (v === 0) v = this._seeded_random();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + std * z;
  }
}

// =============================================================================
// Factory Functions for Convenience
// =============================================================================

/**
 * Create MonteCarloResult from basic parameters
 */
export function createMonteCarloResult(data: Partial<MonteCarloResult>): MonteCarloResult {
  return {
    success_rate: data.success_rate || 0,
    total_simulations: data.total_simulations || 0,
    successful_simulations: data.successful_simulations || 0,
    mean_final_net_worth: data.mean_final_net_worth || 0,
    median_final_net_worth: data.median_final_net_worth || 0,
    percentile_5_net_worth: data.percentile_5_net_worth || 0,
    percentile_95_net_worth: data.percentile_95_net_worth || 0,
    worst_case_final_net_worth: data.worst_case_final_net_worth || 0,
    best_case_final_net_worth: data.best_case_final_net_worth || 0,
    standard_deviation_final_net_worth: data.standard_deviation_final_net_worth || 0,
    mean_minimum_net_worth: data.mean_minimum_net_worth || 0,
    median_minimum_net_worth: data.median_minimum_net_worth || 0,
    percentile_5_minimum_net_worth: data.percentile_5_minimum_net_worth || 0,
    percentile_25_minimum_net_worth: data.percentile_25_minimum_net_worth || 0,
    percentile_75_minimum_net_worth: data.percentile_75_minimum_net_worth || 0,
    percentile_95_minimum_net_worth: data.percentile_95_minimum_net_worth || 0,
    worst_case_minimum_net_worth: data.worst_case_minimum_net_worth || 0,
    best_case_minimum_net_worth: data.best_case_minimum_net_worth || 0,
    standard_deviation_minimum_net_worth: data.standard_deviation_minimum_net_worth || 0,
    black_swan_impact_analysis: data.black_swan_impact_analysis,
    worst_case_scenarios: data.worst_case_scenarios,
    resilience_score: data.resilience_score,
    recommended_emergency_fund: data.recommended_emergency_fund,
  };
}
