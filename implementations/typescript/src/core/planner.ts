/**
 * FIRE Planner - Three-stage financial independence planning system
 * Direct TypeScript port from Python planner.py
 *
 * Stage 1: Collect user profile and income/expense items
 * Stage 2: Allow user to adjust financial projection table
 * Stage 3: Run calculations and provide recommendations
 */

import Decimal from 'decimal.js';
import type {
  UserProfile,
  IncomeExpenseItem,
  SimulationSettings,
  FIRECalculationResult,
} from './data_models';

import { createSimulationSettings, getCurrentAgeAsOf } from './data_models';

import type {
  PlannerData,
  PlannerResults,
  Override,
  AnnualProjectionRow,
  PlannerStage,
  PlannerConfigV1,
} from './planner_models';

import {
  createPlannerData,
  updatePlannerDataTimestamp,
  createPlannerResults,
  configToPlannerData,
  plannerDataToConfig,
  PlannerStage as Stage,
} from './planner_models';

import { FIREEngine, createEngineInput } from './engine';
import { FIREAdvisor } from './advisor';
import { MonteCarloSimulator } from './monte_carlo';

// =============================================================================
// Main FIRE Planner Class
// =============================================================================

/**
 * Three-stage FIRE planning system
 * Direct TypeScript equivalent of Python's FIREPlanner class
 */
export class FIREPlanner {
  public data: PlannerData;
  private currentLanguage: string;

  constructor(language = 'en') {
    this.data = createPlannerData({ language });
    this.currentLanguage = language;
  }

  // =============================================================================
  // Stage 1: Input Collection
  // =============================================================================

  /**
   * Set user profile
   */
  setUserProfile(profile: UserProfile): void {
    this.data.user_profile = profile;

    // Clean invalid overrides if age range changed
    this._cleanInvalidOverrides();

    this.data = updatePlannerDataTimestamp(this.data);
  }

  /**
   * Add income item and return its ID
   */
  addIncomeItem(item: IncomeExpenseItem): string {
    // Ensure item has ID
    if (!item.id) {
      item.id = this._generateUUID();
    }

    this.data.income_items.push(item);
    this.data = updatePlannerDataTimestamp(this.data);
    return item.id;
  }

  /**
   * Add expense item and return its ID
   */
  addExpenseItem(item: IncomeExpenseItem): string {
    // Ensure item has ID
    if (!item.id) {
      item.id = this._generateUUID();
    }

    this.data.expense_items.push(item);
    this.data = updatePlannerDataTimestamp(this.data);
    return item.id;
  }

  /**
   * Remove income item by ID. Returns true if removed
   */
  removeIncomeItem(itemId: string): boolean {
    const index = this.data.income_items.findIndex(item => item.id === itemId);
    if (index >= 0) {
      this.data.income_items.splice(index, 1);

      // Clean up related overrides
      this._removeOverridesForItem(itemId);

      // If we had a projection, try to regenerate it
      if (this.data.projection_df) {
        try {
          this.data.projection_df = this._generateInitialProjection();
        } catch (error) {
          // If regeneration fails, clear projection
          this.data.projection_df = undefined;
        }
      }

      this.data = updatePlannerDataTimestamp(this.data);
      return true;
    }
    return false;
  }

  /**
   * Remove expense item by ID. Returns true if removed
   */
  removeExpenseItem(itemId: string): boolean {
    const index = this.data.expense_items.findIndex(item => item.id === itemId);
    if (index >= 0) {
      this.data.expense_items.splice(index, 1);

      // Clean up related overrides
      this._removeOverridesForItem(itemId);

      // If we had a projection, try to regenerate it
      if (this.data.projection_df) {
        try {
          this.data.projection_df = this._generateInitialProjection();
        } catch (error) {
          // If regeneration fails, clear projection
          this.data.projection_df = undefined;
        }
      }

      this.data = updatePlannerDataTimestamp(this.data);
      return true;
    }
    return false;
  }

  // =============================================================================
  // Stage 2: Table Adjustment
  // =============================================================================

  /**
   * Get current projection DataFrame with overrides applied
   */
  getProjectionDataFrame(): AnnualProjectionRow[] | undefined {
    if (!this.data.projection_df) {
      return undefined;
    }

    // Return projection with overrides applied for display
    const displayData = [...this.data.projection_df];
    this._applyOverridesToProjection(displayData);
    return displayData;
  }

  /**
   * Add or update override for specific age/item
   */
  addOverride(age: number, itemId: string, value: number | Decimal): void {
    // Remove existing override for same age/item
    this.data.overrides = this.data.overrides.filter(
      o => !(o.age === age && o.item_id === itemId)
    );

    // Add new override
    this.data.overrides.push({
      age,
      item_id: itemId,
      value: new Decimal(value),
    });

    this.data = updatePlannerDataTimestamp(this.data);
  }

  /**
   * Remove override for specific age/item
   */
  removeOverride(age: number, itemId: string): boolean {
    const initialLength = this.data.overrides.length;
    this.data.overrides = this.data.overrides.filter(
      o => !(o.age === age && o.item_id === itemId)
    );

    if (this.data.overrides.length < initialLength) {
      this.data = updatePlannerDataTimestamp(this.data);
      return true;
    }
    return false;
  }

  /**
   * Clear all overrides
   */
  clearAllOverrides(): void {
    this.data.overrides = [];
    this.data = updatePlannerDataTimestamp(this.data);
  }

  // =============================================================================
  // Stage 3: Calculations and Analysis
  // =============================================================================

  /**
   * Get current simulation settings
   */
  getSimulationSettings(): SimulationSettings {
    return this.data.simulation_settings;
  }

  /**
   * Update simulation settings
   */
  setSimulationSettings(settings: Partial<SimulationSettings>): void {
    this.data.simulation_settings = createSimulationSettings({
      ...this.data.simulation_settings,
      ...settings,
    });
    this.data = updatePlannerDataTimestamp(this.data);
  }

  /**
   * Run FIRE calculations and update results
   */
  async runCalculations(
    progressCallback?: (progress: number) => void,
    numSimulations?: number
  ): Promise<PlannerResults> {
    if (!this.data.projection_df) {
      throw new Error('No projection data available for calculation');
    }

    const results = await this._runCalculations(
      progressCallback,
      numSimulations
    );
    this.data.results = results;
    this.data = updatePlannerDataTimestamp(this.data);

    return results;
  }

  // =============================================================================
  // Simplified API (Stage-agnostic)
  // =============================================================================

  /**
   * Generate base projection table without stage constraints
   */
  generateProjectionTable(): AnnualProjectionRow[] {
    // Check if we have required data
    if (
      !this.data.user_profile ||
      this.data.income_items.length === 0 ||
      this.data.expense_items.length === 0
    ) {
      throw new Error(
        'Missing required data: user_profile, income_items, or expense_items'
      );
    }

    // Clean up any invalid overrides
    this._cleanInvalidOverrides();

    // Generate and store base projection
    const projectionData = this._generateInitialProjection();
    this.data.projection_df = projectionData;
    this.data = updatePlannerDataTimestamp(this.data);

    return projectionData;
  }

  /**
   * Apply overrides to projection table without stage constraints
   */
  applyOverridesToTable(
    baseData?: AnnualProjectionRow[],
    overrides?: Override[]
  ): AnnualProjectionRow[] {
    if (!baseData) {
      if (!this.data.projection_df) {
        throw new Error('No base projection data available');
      }
      baseData = this.data.projection_df;
    }

    if (!overrides) {
      overrides = this.data.overrides;
    }

    // Apply overrides to a copy of the data
    const resultData = baseData.map(row => ({ ...row }));

    // Store original overrides temporarily
    const originalOverrides = this.data.overrides;
    this.data.overrides = overrides;
    this._applyOverridesToProjection(resultData);
    this.data.overrides = originalOverrides;

    return resultData;
  }

  /**
   * Calculate FIRE results from projection table without stage constraints
   */
  async calculateFireResults(
    projectionData?: AnnualProjectionRow[],
    progressCallback?: (progress: number) => void,
    numSimulations?: number
  ): Promise<PlannerResults> {
    if (!projectionData) {
      if (!this.data.projection_df) {
        throw new Error('No projection data available for calculation');
      }
      projectionData = this.data.projection_df;
    }

    // Store original projection temporarily
    const originalProjection = this.data.projection_df;
    this.data.projection_df = projectionData;

    const results = await this._runCalculations(
      progressCallback,
      numSimulations
    );

    // Restore original projection
    this.data.projection_df = originalProjection;

    return results;
  }

  // =============================================================================
  // Import/Export
  // =============================================================================

  /**
   * Load configuration from JSON
   */
  loadFromConfig(config: PlannerConfigV1): void {
    this.data = configToPlannerData(config);
    this.currentLanguage = this.data.language;
  }

  /**
   * Export current state to configuration
   */
  exportToConfig(description = ''): PlannerConfigV1 {
    return plannerDataToConfig(this.data, description);
  }

  /**
   * Save configuration to JSON string
   */
  saveToJSON(description = ''): string {
    const config = this.exportToConfig(description);
    return JSON.stringify(config, null, 2);
  }

  /**
   * Load configuration from JSON string
   */
  loadFromJSON(jsonString: string): void {
    try {
      const config = JSON.parse(jsonString) as PlannerConfigV1;
      this.loadFromConfig(config);
    } catch (error) {
      throw new Error(`Failed to parse JSON configuration: ${error}`);
    }
  }

  // =============================================================================
  // Internal Helper Methods
  // =============================================================================

  /**
   * Generate initial financial projection in wide format
   */
  private _generateInitialProjection(): AnnualProjectionRow[] {
    if (!this.data.user_profile) {
      throw new Error('User profile required');
    }

    const profile = this.data.user_profile;
    const currentYear = profile.as_of_year ?? new Date().getFullYear();
    const currentAge = getCurrentAgeAsOf(profile.birth_year, currentYear);

    // Create age range from current age to life expectancy
    const projectionData: AnnualProjectionRow[] = [];

    for (let age = currentAge; age <= profile.life_expectancy; age++) {
      const year = currentYear + (age - currentAge);

      let totalIncome = new Decimal(0);
      let totalExpense = new Decimal(0);

      // Calculate income for this age
      for (const item of this.data.income_items) {
        if (this._isItemActiveAtAge(item, age)) {
          const yearsSinceStart = age - item.start_age;
          const growthRate = new Decimal(item.annual_growth_rate).div(100);
          const growthFactor = new Decimal(1)
            .add(growthRate)
            .pow(yearsSinceStart);

          if (item.frequency === 'one-time') {
            // One-time items only appear at start age
            if (age === item.start_age) {
              const amount = new Decimal(item.after_tax_amount_per_period).mul(
                growthFactor
              );
              totalIncome = totalIncome.add(amount);
            }
          } else {
            // Recurring items with growth
            const amount = new Decimal(item.after_tax_amount_per_period).mul(
              growthFactor
            );
            totalIncome = totalIncome.add(amount);
          }
        }
      }

      // Calculate expenses for this age (with inflation)
      const inflationRate = new Decimal(profile.inflation_rate).div(100);
      for (const item of this.data.expense_items) {
        if (this._isItemActiveAtAge(item, age)) {
          const yearsSinceStart = age - item.start_age;

          if (item.frequency === 'one-time') {
            // One-time expenses only appear at start age
            if (age === item.start_age) {
              // Apply both individual growth rate and inflation
              const itemGrowthRate = new Decimal(item.annual_growth_rate).div(
                100
              );
              const itemGrowthFactor = new Decimal(1)
                .add(itemGrowthRate)
                .pow(yearsSinceStart);
              const inflationFactor = new Decimal(1)
                .add(inflationRate)
                .pow(yearsSinceStart);
              const amount = new Decimal(item.after_tax_amount_per_period)
                .mul(itemGrowthFactor)
                .mul(inflationFactor);
              totalExpense = totalExpense.add(amount);
            }
          } else {
            // Recurring expenses with individual growth + inflation
            const itemGrowthRate = new Decimal(item.annual_growth_rate).div(
              100
            );
            const itemGrowthFactor = new Decimal(1)
              .add(itemGrowthRate)
              .pow(yearsSinceStart);
            const inflationFactor = new Decimal(1)
              .add(inflationRate)
              .pow(yearsSinceStart);
            const amount = new Decimal(item.after_tax_amount_per_period)
              .mul(itemGrowthFactor)
              .mul(inflationFactor);
            totalExpense = totalExpense.add(amount);
          }
        }
      }

      projectionData.push({
        age,
        year,
        total_income: totalIncome,
        total_expense: totalExpense,
      });
    }

    return projectionData;
  }

  /**
   * Check if an income/expense item is active at a given age
   */
  private _isItemActiveAtAge(item: IncomeExpenseItem, age: number): boolean {
    return (
      age >= item.start_age &&
      (item.end_age === undefined || age <= item.end_age)
    );
  }

  /**
   * Apply overrides to projection data
   */
  private _applyOverridesToProjection(
    projectionData: AnnualProjectionRow[]
  ): void {
    for (const override of this.data.overrides) {
      const rowIndex = projectionData.findIndex(
        row => row.age === override.age
      );
      if (rowIndex >= 0) {
        // For now, we'll apply overrides to total_income or total_expense
        // This is a simplification - the Python version has more complex logic
        const row = projectionData[rowIndex];

        // Determine if this is an income or expense item
        const incomeItem = this.data.income_items.find(
          item => item.id === override.item_id
        );
        const expenseItem = this.data.expense_items.find(
          item => item.id === override.item_id
        );

        if (incomeItem) {
          // Find the current contribution of this item and replace it
          const originalContribution = this._calculateItemContributionAtAge(
            incomeItem,
            override.age
          );
          row.total_income = row.total_income
            .sub(originalContribution)
            .add(new Decimal(override.value));
        } else if (expenseItem) {
          // Find the current contribution of this item and replace it
          const originalContribution = this._calculateItemContributionAtAge(
            expenseItem,
            override.age
          );
          row.total_expense = row.total_expense
            .sub(originalContribution)
            .add(new Decimal(override.value));
        }
      }
    }
  }

  /**
   * Calculate an item's contribution at a specific age
   */
  private _calculateItemContributionAtAge(
    item: IncomeExpenseItem,
    age: number
  ): Decimal {
    if (!this._isItemActiveAtAge(item, age)) {
      return new Decimal(0);
    }

    const yearsSinceStart = age - item.start_age;
    const growthRate = new Decimal(item.annual_growth_rate).div(100);
    const growthFactor = new Decimal(1).add(growthRate).pow(yearsSinceStart);

    if (item.frequency === 'one-time') {
      if (age === item.start_age) {
        return new Decimal(item.after_tax_amount_per_period).mul(growthFactor);
      } else {
        return new Decimal(0);
      }
    } else {
      let contribution = new Decimal(item.after_tax_amount_per_period).mul(
        growthFactor
      );

      // Apply inflation for expenses
      if (!item.is_income && this.data.user_profile) {
        const inflationRate = new Decimal(
          this.data.user_profile.inflation_rate
        ).div(100);
        const inflationFactor = new Decimal(1)
          .add(inflationRate)
          .pow(yearsSinceStart);
        contribution = contribution.mul(inflationFactor);
      }

      return contribution;
    }
  }

  /**
   * Run FIRE calculations and generate recommendations
   */
  private async _runCalculations(
    progressCallback?: (progress: number) => void,
    numSimulations?: number
  ): Promise<PlannerResults> {
    if (!this.data.projection_df || !this.data.user_profile) {
      throw new Error('Missing data for calculations');
    }

    // Create a copy of projection and apply overrides for calculation
    const calculationData = [...this.data.projection_df];
    this._applyOverridesToProjection(calculationData);

    // Create engine input - convert AnnualProjectionRow to AnnualFinancialProjection
    const financialProjection = calculationData.map(row => ({
      age: row.age,
      year: row.year,
      total_income: row.total_income,
      total_expense: row.total_expense,
    }));

    const engineInput = createEngineInput(
      this.data.user_profile,
      financialProjection,
      this.data.income_items
    );

    // Run FIRE calculation
    const engine = new FIREEngine(engineInput);
    const fireResult = engine.calculate();

    // Run Monte Carlo simulation with custom or default settings
    let monteCarloSuccessRate: Decimal | undefined = undefined;
    let monteCarloStatusRates:
      | { safe: Decimal; warning: Decimal; danger: Decimal }
      | undefined = undefined;
    let monteCarloYearlyStatusRates:
      | Array<{
          age: number;
          year: number;
          safe: Decimal;
          warning: Decimal;
          danger: Decimal;
        }>
      | undefined = undefined;
    let recommendations: Record<string, any>[] = [];

    try {
      progressCallback?.(0.3); // 30% - Basic calculation done

      // Use custom num_simulations or default from settings
      const simulationSettings = numSimulations
        ? createSimulationSettings({
            ...this.data.simulation_settings,
            num_simulations: numSimulations,
          })
        : this.data.simulation_settings;

      const mcSimulator = new MonteCarloSimulator(engine, simulationSettings);

      // 创建Monte Carlo专属的进度回调
      const mcProgressCallback = progressCallback
        ? (current: number, total: number) => {
            // Monte Carlo 占整体进度的30%-80% (50%的范围)
            const mcProgress = current / total;
            const overallProgress = 0.3 + mcProgress * 0.5;

            // 进度转换：Monte Carlo进度 -> 整体进度

            // 使用setTimeout确保进度更新有时间被UI渲染
            setTimeout(() => {
              progressCallback(overallProgress);
            }, 5);

            // 在某些关键节点添加小延迟，让用户能看到进度
            if (current % Math.max(1, Math.floor(total / 20)) === 0) {
              // 每5%的进度添加一个小延迟
            }
          }
        : undefined;

      const mcResult = await mcSimulator.run_simulation(mcProgressCallback);
      monteCarloSuccessRate = mcResult.success_rate;
      monteCarloStatusRates = mcResult.plan_status_rates;
      monteCarloYearlyStatusRates = mcResult.yearly_status_rates;

      progressCallback?.(0.8); // 80% - Monte Carlo done

      // Generate advisor recommendations
      const advisor = new FIREAdvisor(engineInput);
      const advisorRecommendations = await advisor.get_all_recommendations();
      recommendations = advisorRecommendations.map(rec => ({
        type: rec.type,
        params: rec.params,
        is_achievable: rec.is_achievable,
        monte_carlo_success_rate: rec.monte_carlo_success_rate,
      }));

      progressCallback?.(1.0); // 100% - Complete
    } catch (error) {
      console.warn('Monte Carlo or advisor analysis failed:', error);
      // Continue without Monte Carlo/advisor results
    }

    return createPlannerResults({
      fire_calculation: fireResult,
      monte_carlo_success_rate: monteCarloSuccessRate
        ? monteCarloSuccessRate.toNumber()
        : undefined,
      monte_carlo_status_rates: monteCarloStatusRates,
      monte_carlo_yearly_status_rates: monteCarloYearlyStatusRates,
      recommendations,
      calculation_timestamp: new Date(),
    } as any);
  }

  /**
   * Clean invalid overrides (when age range changes)
   */
  private _cleanInvalidOverrides(): void {
    if (!this.data.user_profile) {
      return;
    }

    const currentAge = getCurrentAgeAsOf(
      this.data.user_profile.birth_year,
      this.data.user_profile.as_of_year ?? new Date().getFullYear()
    );
    const maxAge = this.data.user_profile.life_expectancy;

    // Remove overrides outside valid age range
    this.data.overrides = this.data.overrides.filter(
      override => override.age >= currentAge && override.age <= maxAge
    );

    // Remove overrides for non-existent items
    const allItemIds = new Set([
      ...this.data.income_items.map(item => item.id!),
      ...this.data.expense_items.map(item => item.id!),
    ]);

    this.data.overrides = this.data.overrides.filter(override =>
      allItemIds.has(override.item_id)
    );
  }

  /**
   * Remove overrides for a specific item
   */
  private _removeOverridesForItem(itemId: string): void {
    this.data.overrides = this.data.overrides.filter(
      override => override.item_id !== itemId
    );
  }

  /**
   * Generate a UUID v4 string (simplified implementation)
   */
  private _generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c == 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new FIRE planner instance
 */
export function createPlanner(language = 'en'): FIREPlanner {
  return new FIREPlanner(language);
}

/**
 * Create planner from existing configuration
 */
export function createPlannerFromConfig(config: PlannerConfigV1): FIREPlanner {
  const planner = new FIREPlanner(config.metadata?.language ?? 'en');
  planner.loadFromConfig(config);
  return planner;
}

/**
 * Create planner from JSON string
 */
export function createPlannerFromJSON(jsonString: string): FIREPlanner {
  const config = JSON.parse(jsonString) as PlannerConfigV1;
  return createPlannerFromConfig(config);
}
