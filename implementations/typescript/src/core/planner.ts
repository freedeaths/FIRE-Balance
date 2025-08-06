/**
 * FIRE Planner - Three-stage financial independence planning system
 *
 * This is a direct port of the Python FIREPlanner implementation, providing:
 * - Stage 1: User profile and income/expense data collection
 * - Stage 2: Interactive financial projection with override functionality
 * - Stage 3: Monte Carlo analysis and advisor recommendations
 *
 * The planner maintains session state and coordinates between different
 * calculation engines while providing a clean TypeScript API.
 */

import type {
  UserProfile,
  IncomeExpenseItem,
  PlannerData,
  PlannerStage,
  PlannerResults,
  Override,
  AnnualProjectionRow,
  SimulationSettings,
  LanguageCode,
  FIRECalculationResult,
} from '../types';
import { FIREEngine, createEngineInput } from './engine';
import { generateUUID, getCurrentTimestamp } from '../utils/helpers';

/**
 * Default simulation settings
 */
const DEFAULT_SIMULATION_SETTINGS: SimulationSettings = {
  num_simulations: 1000,
  confidence_level: 0.95,
  include_black_swan_events: true,
  income_base_volatility: 0.1,
  income_minimum_factor: 0.1,
  expense_base_volatility: 0.05,
  expense_minimum_factor: 0.5,
};

/**
 * Three-stage FIRE planning system
 *
 * This class manages the complete FIRE planning workflow:
 * 1. Stage 1: Data collection and validation
 * 2. Stage 2: Projection generation and user adjustments
 * 3. Stage 3: Analysis, simulation, and recommendations
 */
export class FIREPlanner {
  private data: PlannerData;

  /**
   * Create a new FIRE planner instance
   */
  constructor(language: LanguageCode = 'en') {
    const now = getCurrentTimestamp();

    this.data = {
      current_stage: 'stage1_input' as PlannerStage,
      user_profile: undefined,
      income_items: [],
      expense_items: [],
      projection_data: undefined,
      overrides: [],
      results: undefined,
      session_id: generateUUID(),
      created_at: now,
      updated_at: now,
      language,
      simulation_settings: { ...DEFAULT_SIMULATION_SETTINGS },
    };
  }

  // =============================================================================
  // Stage Management
  // =============================================================================

  /**
   * Get current stage
   */
  getCurrentStage(): PlannerStage {
    return this.data.current_stage;
  }

  /**
   * Advance to the next stage if conditions are met
   */
  advanceStage(): boolean {
    switch (this.data.current_stage) {
      case 'stage1_input':
        if (this.isStage1Complete()) {
          this.data.current_stage = 'stage2_adjustment' as PlannerStage;
          this.generateProjection();
          this.updateTimestamp();
          return true;
        }
        return false;

      case 'stage2_adjustment':
        if (this.isStage2Complete()) {
          this.data.current_stage = 'stage3_analysis' as PlannerStage;
          this.updateTimestamp();
          return true;
        }
        return false;

      case 'stage3_analysis':
        // Stage 3 is the final stage
        return false;

      default:
        return false;
    }
  }

  /**
   * Go back to previous stage
   */
  goToPreviousStage(): boolean {
    switch (this.data.current_stage) {
      case 'stage2_adjustment':
        this.data.current_stage = 'stage1_input' as PlannerStage;
        this.updateTimestamp();
        return true;

      case 'stage3_analysis':
        this.data.current_stage = 'stage2_adjustment' as PlannerStage;
        this.updateTimestamp();
        return true;

      default:
        return false;
    }
  }

  // =============================================================================
  // Stage 1: Data Collection
  // =============================================================================

  /**
   * Set user profile
   */
  setUserProfile(profile: UserProfile): void {
    this.data.user_profile = profile;
    this.updateTimestamp();
  }

  /**
   * Get user profile
   */
  getUserProfile(): UserProfile | undefined {
    return this.data.user_profile;
  }

  /**
   * Add income item
   */
  addIncomeItem(item: IncomeExpenseItem): void {
    // Ensure unique ID
    if (!item.item_id) {
      item.item_id = generateUUID();
    }
    this.data.income_items.push(item);
    this.updateTimestamp();
  }

  /**
   * Update income item
   */
  updateIncomeItem(itemId: string, updates: Partial<IncomeExpenseItem>): boolean {
    const index = this.data.income_items.findIndex(item => item.item_id === itemId);
    if (index !== -1) {
      this.data.income_items[index] = { ...this.data.income_items[index], ...updates };
      this.updateTimestamp();
      return true;
    }
    return false;
  }

  /**
   * Remove income item
   */
  removeIncomeItem(itemId: string): boolean {
    const initialLength = this.data.income_items.length;
    this.data.income_items = this.data.income_items.filter(item => item.item_id !== itemId);
    if (this.data.income_items.length < initialLength) {
      this.updateTimestamp();
      return true;
    }
    return false;
  }

  /**
   * Get income items
   */
  getIncomeItems(): IncomeExpenseItem[] {
    return [...this.data.income_items];
  }

  /**
   * Add expense item
   */
  addExpenseItem(item: IncomeExpenseItem): void {
    // Ensure unique ID
    if (!item.item_id) {
      item.item_id = generateUUID();
    }
    this.data.expense_items.push(item);
    this.updateTimestamp();
  }

  /**
   * Update expense item
   */
  updateExpenseItem(itemId: string, updates: Partial<IncomeExpenseItem>): boolean {
    const index = this.data.expense_items.findIndex(item => item.item_id === itemId);
    if (index !== -1) {
      this.data.expense_items[index] = { ...this.data.expense_items[index], ...updates };
      this.updateTimestamp();
      return true;
    }
    return false;
  }

  /**
   * Remove expense item
   */
  removeExpenseItem(itemId: string): boolean {
    const initialLength = this.data.expense_items.length;
    this.data.expense_items = this.data.expense_items.filter(item => item.item_id !== itemId);
    if (this.data.expense_items.length < initialLength) {
      this.updateTimestamp();
      return true;
    }
    return false;
  }

  /**
   * Get expense items
   */
  getExpenseItems(): IncomeExpenseItem[] {
    return [...this.data.expense_items];
  }

  // =============================================================================
  // Stage 2: Projection and Adjustments
  // =============================================================================

  /**
   * Generate annual projection data from income/expense items
   */
  private generateProjection(): void {
    if (!this.data.user_profile) {
      throw new Error('User profile is required to generate projection');
    }

    const profile = this.data.user_profile;
    const currentAge = new Date().getFullYear() - profile.birth_year;
    const projectionYears = profile.expected_fire_age - currentAge + 5; // Extra years for analysis

    const projectionData: AnnualProjectionRow[] = [];

    for (let i = 0; i < projectionYears; i++) {
      const age = currentAge + i;
      const year = new Date().getFullYear() + i;

      // Calculate total income for this year
      let totalIncome = 0;
      for (const item of this.data.income_items) {
        totalIncome += this.calculateItemAmountForAge(item, age);
      }

      // Calculate total expenses for this year (with inflation)
      let totalExpense = 0;
      for (const item of this.data.expense_items) {
        const baseAmount = this.calculateItemAmountForAge(item, age);
        // Apply inflation to expenses
        const inflationMultiplier = Math.pow(1 + profile.inflation_rate / 100, i);
        totalExpense += baseAmount * inflationMultiplier;
      }

      projectionData.push({
        age,
        year,
        total_income: totalIncome,
        total_expense: totalExpense,
      });
    }

    this.data.projection_data = projectionData;
  }

  /**
   * Calculate item amount for specific age (handles age ranges and growth)
   */
  private calculateItemAmountForAge(item: IncomeExpenseItem, age: number): number {
    // Check if item is active at this age
    if (age < item.start_age || (item.end_age && age > item.end_age)) {
      return 0;
    }

    // Calculate amount with growth
    const yearsFromStart = age - item.start_age;
    const growthMultiplier = Math.pow(1 + item.growth_rate / 100, yearsFromStart);

    // Convert to annual amount
    let annualAmount = item.after_tax_amount_per_period * growthMultiplier;

    // Apply frequency conversion
    switch (item.frequency) {
      case 'monthly':
        annualAmount *= 12;
        break;
      case 'quarterly':
        annualAmount *= 4;
        break;
      case 'semi_annual':
        annualAmount *= 2;
        break;
      case 'annual':
        // Already annual
        break;
      case 'one_time':
        // Only apply in the start year
        if (age !== item.start_age) {
          annualAmount = 0;
        }
        break;
    }

    return annualAmount;
  }

  /**
   * Get projection data with applied overrides
   */
  getProjectionData(): AnnualProjectionRow[] | undefined {
    if (!this.data.projection_data) {
      return undefined;
    }

    // Apply overrides
    const data = [...this.data.projection_data];
    for (const override of this.data.overrides) {
      const row = data.find(r => r.age === override.age);
      if (row) {
        // For now, we assume overrides apply to total_expense
        // In a full implementation, we'd track which field the override applies to
        row.total_expense = override.value;
      }
    }

    return data;
  }

  /**
   * Add or update override
   */
  setOverride(age: number, itemId: string, value: number): void {
    // Remove existing override for this age/item
    this.data.overrides = this.data.overrides.filter(
      o => !(o.age === age && o.item_id === itemId)
    );

    // Add new override
    this.data.overrides.push({ age, item_id: itemId, value });
    this.updateTimestamp();
  }

  /**
   * Remove override
   */
  removeOverride(age: number, itemId: string): boolean {
    const initialLength = this.data.overrides.length;
    this.data.overrides = this.data.overrides.filter(
      o => !(o.age === age && o.item_id === itemId)
    );
    if (this.data.overrides.length < initialLength) {
      this.updateTimestamp();
      return true;
    }
    return false;
  }

  // =============================================================================
  // Stage 3: Analysis and Results
  // =============================================================================

  /**
   * Run FIRE calculation with current data
   */
  async runAnalysis(): Promise<PlannerResults> {
    if (!this.data.user_profile) {
      throw new Error('User profile is required for analysis');
    }

    const projectionData = this.getProjectionData();
    if (!projectionData || projectionData.length === 0) {
      throw new Error('Projection data is required for analysis');
    }

    // Create engine input and run calculation
    const engineInput = createEngineInput(this.data.user_profile, projectionData);
    const engine = new FIREEngine(engineInput);
    const fireCalculation = engine.calculate();

    // For now, we'll set Monte Carlo success rate to a placeholder
    // In a full implementation, we'd integrate with the Monte Carlo simulator
    const monteCarloSuccessRate = this.estimateSuccessRate(fireCalculation);

    const results: PlannerResults = {
      fire_calculation: fireCalculation,
      monte_carlo_success_rate: monteCarloSuccessRate,
      recommendations: [], // Advisor recommendations would go here
      calculation_timestamp: getCurrentTimestamp(),
    };

    this.data.results = results;
    this.updateTimestamp();

    return results;
  }

  /**
   * Placeholder for Monte Carlo success rate estimation
   */
  private estimateSuccessRate(calculation: FIRECalculationResult): number {
    // Simple heuristic based on FIRE achievement and safety buffer
    if (!calculation.is_fire_achievable) {
      return 0.1; // Very low probability if basic calculation fails
    }

    // Higher success rate for higher safety buffer ratios
    const successRate = Math.min(0.9, 0.5 + calculation.min_safety_buffer_ratio * 0.4);
    return Math.max(0.1, successRate);
  }

  /**
   * Get current results
   */
  getResults(): PlannerResults | undefined {
    return this.data.results;
  }

  // =============================================================================
  // Validation and State Checking
  // =============================================================================

  /**
   * Check if Stage 1 is complete
   */
  private isStage1Complete(): boolean {
    return (
      this.data.user_profile !== undefined &&
      this.data.income_items.length > 0 &&
      this.data.expense_items.length > 0
    );
  }

  /**
   * Check if Stage 2 is complete
   */
  private isStage2Complete(): boolean {
    return (
      this.data.projection_data !== undefined &&
      this.data.projection_data.length > 0
    );
  }

  // =============================================================================
  // Data Management
  // =============================================================================

  /**
   * Get full planner data (for serialization)
   */
  getData(): PlannerData {
    return { ...this.data };
  }

  /**
   * Load data from serialized state
   */
  loadData(data: PlannerData): void {
    this.data = { ...data };
    this.updateTimestamp();
  }

  /**
   * Update the timestamp
   */
  private updateTimestamp(): void {
    this.data.updated_at = getCurrentTimestamp();
  }

  /**
   * Export data as JSON
   */
  exportToJSON(): string {
    return JSON.stringify(this.data, null, 2);
  }

  /**
   * Import data from JSON
   */
  importFromJSON(json: string): void {
    const data = JSON.parse(json) as PlannerData;
    this.loadData(data);
  }
}
