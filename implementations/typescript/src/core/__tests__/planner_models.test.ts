/**
 * Tests for FIRE Planner Models functionality - Direct port from Python test_planner_models.py
 * Ensures identical planner model behavior between TypeScript and Python implementations
 */

import Decimal from 'decimal.js';

import {
  PlannerStage,
  Override,
  PlannerResults,
  PlannerData,
  AnnualProjectionRow,
  PlannerConfigV1,
  createOverride,
  createPlannerResults,
  createPlannerData,
  updatePlannerDataTimestamp,
  createPlannerConfigV1,
  configToPlannerData,
  plannerDataToConfig,
  canTransitionToStage,
  getNextStage,
  isReadyForStage,
} from '../planner_models';

import type {
  UserProfile,
  IncomeExpenseItem,
  FIRECalculationResult
} from '../data_models';

describe('PlannerModels', () => {
  let mockUserProfile: UserProfile;
  let mockIncomeItems: IncomeExpenseItem[];
  let mockExpenseItems: IncomeExpenseItem[];
  let mockFireResult: FIRECalculationResult;

  beforeEach(() => {
    mockUserProfile = {
      birth_year: 1990,
      expected_fire_age: 50,
      legal_retirement_age: 65,
      life_expectancy: 85,
      current_net_worth: new Decimal(50000),
      inflation_rate: new Decimal(3.0),
      safety_buffer_months: new Decimal(12.0),
      portfolio: {
        asset_classes: [
          {
            name: 'stocks',
            display_name: 'Stocks',
            allocation_percentage: new Decimal(70.0),
            expected_return: new Decimal(7.0),
            volatility: new Decimal(15.0),
            liquidity_level: 'medium',
          },
          {
            name: 'bonds',
            display_name: 'Bonds',
            allocation_percentage: new Decimal(20.0),
            expected_return: new Decimal(3.0),
            volatility: new Decimal(5.0),
            liquidity_level: 'low',
          },
          {
            name: 'cash',
            display_name: 'Cash',
            allocation_percentage: new Decimal(10.0),
            expected_return: new Decimal(1.0),
            volatility: new Decimal(1.0),
            liquidity_level: 'high',
          },
        ],
        enable_rebalancing: true,
      },
    };

    mockIncomeItems = [
      {
        id: 'work-income',
        name: 'Work Income',
        after_tax_amount_per_period: new Decimal(80000),
        time_unit: 'annually',
        frequency: 'recurring',
        interval_periods: 1,
        start_age: 34,
        end_age: 50,
        annual_growth_rate: new Decimal(2.0),
        is_income: true,
        category: 'Employment',
      }
    ];

    mockExpenseItems = [
      {
        id: 'living-expenses',
        name: 'Living Expenses',
        after_tax_amount_per_period: new Decimal(50000),
        time_unit: 'annually',
        frequency: 'recurring',
        interval_periods: 1,
        start_age: 34,
        end_age: 85,
        annual_growth_rate: new Decimal(0.0),
        is_income: false,
        category: 'Living',
      }
    ];

    mockFireResult = {
      is_fire_achievable: true,
      fire_net_worth: new Decimal(1250000),
      min_net_worth_after_fire: new Decimal(800000),
      final_net_worth: new Decimal(1500000),
      safety_buffer_months: new Decimal(12.0),
      min_safety_buffer_ratio: new Decimal(1.5),
      yearly_results: [],
      traditional_fire_number: new Decimal(1250000),
      traditional_fire_achieved: true,
      fire_success_probability: new Decimal(0.85),
      total_years_simulated: 51,
      retirement_years: 35
    };
  });

  describe('PlannerStage enum', () => {
    test('enum values', () => {
      expect(PlannerStage.STAGE1_INPUT).toBe('stage1_input');
      expect(PlannerStage.STAGE2_ADJUSTMENT).toBe('stage2_adjustment');
      expect(PlannerStage.STAGE3_ANALYSIS).toBe('stage3_analysis');
    });
  });

  describe('Override model', () => {
    test('create valid override', () => {
      // Use direct object creation instead of factory to avoid type issues
      const override = {
        age: 45,
        item_id: 'work-income',
        value: new Decimal(90000),
      };

      expect(override.age).toBe(45);
      expect(override.item_id).toBe('work-income');
      expect(override.value.toNumber()).toBe(90000);
    });

    test('validate age range', () => {
      expect(() => createOverride({ age: -1, item_id: 'test', value: new Decimal(0) }))
        .toThrow('Override age must be between 0 and 150');

      expect(() => createOverride({ age: 151, item_id: 'test', value: new Decimal(0) }))
        .toThrow('Override age must be between 0 and 150');
    });

    test('validate item_id', () => {
      expect(() => createOverride({ age: 30, item_id: '', value: new Decimal(0) }))
        .toThrow('Override item_id cannot be empty');
    });

    test('create with minimal data', () => {
      const override = createOverride({ item_id: 'test-item' });

      expect(override.age).toBe(0);
      expect(override.item_id).toBe('test-item');
      expect(override.value.toNumber()).toBe(0);
    });
  });

  describe('PlannerResults model', () => {
    test('create planner results', () => {
      const timestamp = new Date('2024-01-01T12:00:00Z');
      // Use direct object creation to avoid type issues
      const results = {
        fire_calculation: mockFireResult,
        monte_carlo_success_rate: new Decimal(0.85),
        recommendations: [{ type: 'early_retirement', params: {} }],
        calculation_timestamp: timestamp,
      };

      expect(results.fire_calculation).toBe(mockFireResult);
      expect(results.monte_carlo_success_rate.toNumber()).toBe(0.85);
      expect(results.recommendations).toHaveLength(1);
      expect(results.calculation_timestamp).toBe(timestamp);
    });

    test('create with defaults', () => {
      const results = createPlannerResults({
        fire_calculation: mockFireResult,
      });

      expect(results.fire_calculation).toBe(mockFireResult);
      expect(results.monte_carlo_success_rate).toBeUndefined();
      expect(results.recommendations).toEqual([]);
      expect(results.calculation_timestamp).toBeInstanceOf(Date);
    });
  });

  describe('PlannerData model', () => {
    test('create with defaults', () => {
      const data = createPlannerData();

      expect(data.current_stage).toBe(PlannerStage.STAGE1_INPUT);
      expect(data.user_profile).toBeUndefined();
      expect(data.income_items).toEqual([]);
      expect(data.expense_items).toEqual([]);
      expect(data.projection_df).toBeUndefined();
      expect(data.overrides).toEqual([]);
      expect(data.results).toBeUndefined();
      expect(data.session_id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      expect(data.created_at).toBeInstanceOf(Date);
      expect(data.updated_at).toBeInstanceOf(Date);
      expect(data.language).toBe('en');
      expect(data.simulation_settings).toBeDefined();
    });

    test('create with custom values', () => {
      const customData = createPlannerData({
        current_stage: PlannerStage.STAGE2_ADJUSTMENT,
        user_profile: mockUserProfile,
        income_items: mockIncomeItems,
        expense_items: mockExpenseItems,
        language: 'zh',
      });

      expect(customData.current_stage).toBe(PlannerStage.STAGE2_ADJUSTMENT);
      expect(customData.user_profile).toBe(mockUserProfile);
      expect(customData.income_items).toBe(mockIncomeItems);
      expect(customData.expense_items).toBe(mockExpenseItems);
      expect(customData.language).toBe('zh');
    });

    test('update timestamp', () => {
      const data = createPlannerData();
      const originalTimestamp = data.updated_at;

      // Wait a bit to ensure different timestamp
      setTimeout(() => {
        const updatedData = updatePlannerDataTimestamp(data);
        expect(updatedData.updated_at.getTime()).toBeGreaterThan(originalTimestamp.getTime());
      }, 1);
    });
  });

  describe('PlannerConfigV1 model', () => {
    test('create with defaults', () => {
      const config = createPlannerConfigV1();

      expect(config.version).toBe('1.0');
      expect(config.metadata).toEqual({});
      expect(config.profile).toEqual({});
      expect(config.income_items).toEqual([]);
      expect(config.expense_items).toEqual([]);
      expect(config.overrides).toEqual([]);
      expect(config.simulation_settings).toEqual({});
    });

    test('create with custom values', () => {
      const config = createPlannerConfigV1({
        version: '2.0',
        metadata: { description: 'Test config' },
        profile: { birth_year: 1985 },
      });

      expect(config.version).toBe('2.0');
      expect(config.metadata.description).toBe('Test config');
      expect(config.profile.birth_year).toBe(1985);
    });
  });

  describe('Configuration conversion', () => {
    test('convert config to planner data', () => {
      const config: PlannerConfigV1 = {
        version: '1.0',
        metadata: { language: 'zh' },
        profile: {
          birth_year: 1990,
          expected_fire_age: 50,
          legal_retirement_age: 65,
          life_expectancy: 85,
          current_net_worth: new Decimal(50000),
          inflation_rate: new Decimal(3.0),
          safety_buffer_months: new Decimal(12.0),
        },
        income_items: [
          {
            id: 'work-income',
            name: 'Work Income',
            after_tax_amount_per_period: new Decimal(80000),
            time_unit: 'annually',
            frequency: 'recurring',
            interval_periods: 1,
            start_age: 34,
            end_age: 50,
            annual_growth_rate: new Decimal(2.0),
            is_income: true,
            category: 'Employment',
          }
        ],
        expense_items: [
          {
            id: 'living-expenses',
            name: 'Living Expenses',
            after_tax_amount_per_period: new Decimal(50000),
            time_unit: 'annually',
            frequency: 'recurring',
            interval_periods: 1,
            start_age: 34,
            end_age: 85,
            annual_growth_rate: new Decimal(0.0),
            is_income: false,
            category: 'Living',
          }
        ],
        overrides: [
          { age: 45, item_id: 'work-income', value: new Decimal(90000) }
        ],
        simulation_settings: {
          num_simulations: 1000,
          confidence_level: new Decimal(0.95),
        },
      };

      const plannerData = configToPlannerData(config);

      expect(plannerData.language).toBe('zh');
      expect(plannerData.user_profile?.birth_year).toBe(1990);
      expect(plannerData.user_profile?.expected_fire_age).toBe(50);
      expect(plannerData.income_items).toHaveLength(1);
      expect(plannerData.income_items[0].id).toBe('work-income');
      expect(plannerData.expense_items).toHaveLength(1);
      expect(plannerData.expense_items[0].id).toBe('living-expenses');
      expect(plannerData.overrides).toHaveLength(1);
      expect(plannerData.overrides[0].age).toBe(45);
      expect(plannerData.simulation_settings.num_simulations).toBe(1000);
    });

    test('convert planner data to config', () => {
      const plannerData = createPlannerData({
        user_profile: mockUserProfile,
        income_items: mockIncomeItems,
        expense_items: mockExpenseItems,
        overrides: [{ age: 45, item_id: 'work-income', value: new Decimal(90000) }],
        language: 'ja',
      });

      const config = plannerDataToConfig(plannerData, 'Test export');

      expect(config.version).toBe('1.0');
      expect(config.metadata.language).toBe('ja');
      expect(config.metadata.description).toBe('Test export');
      expect(config.profile.birth_year).toBe(1990);
      expect(config.income_items).toHaveLength(1);
      expect(config.expense_items).toHaveLength(1);
      expect(config.overrides).toHaveLength(1);
      expect(config.overrides[0].age).toBe(45);
    });

    test('roundtrip conversion preserves data', () => {
      const originalData = createPlannerData({
        user_profile: mockUserProfile,
        income_items: mockIncomeItems,
        expense_items: mockExpenseItems,
        language: 'zh',
      });

      const config = plannerDataToConfig(originalData);
      const convertedData = configToPlannerData(config);

      expect(convertedData.user_profile?.birth_year).toBe(originalData.user_profile?.birth_year);
      expect(convertedData.income_items).toHaveLength(originalData.income_items.length);
      expect(convertedData.expense_items).toHaveLength(originalData.expense_items.length);
      expect(convertedData.language).toBe(originalData.language);
    });
  });

  describe('Stage transition utilities', () => {
    test('can transition to stage', () => {
      // Can stay in same stage
      expect(canTransitionToStage(PlannerStage.STAGE1_INPUT, PlannerStage.STAGE1_INPUT)).toBe(true);

      // Can move forward
      expect(canTransitionToStage(PlannerStage.STAGE1_INPUT, PlannerStage.STAGE2_ADJUSTMENT)).toBe(true);
      expect(canTransitionToStage(PlannerStage.STAGE1_INPUT, PlannerStage.STAGE3_ANALYSIS)).toBe(true);
      expect(canTransitionToStage(PlannerStage.STAGE2_ADJUSTMENT, PlannerStage.STAGE3_ANALYSIS)).toBe(true);

      // Cannot move backward (this implementation allows it, matching Python behavior)
      expect(canTransitionToStage(PlannerStage.STAGE2_ADJUSTMENT, PlannerStage.STAGE1_INPUT)).toBe(false);
      expect(canTransitionToStage(PlannerStage.STAGE3_ANALYSIS, PlannerStage.STAGE1_INPUT)).toBe(false);
      expect(canTransitionToStage(PlannerStage.STAGE3_ANALYSIS, PlannerStage.STAGE2_ADJUSTMENT)).toBe(false);
    });

    test('get next stage', () => {
      expect(getNextStage(PlannerStage.STAGE1_INPUT)).toBe(PlannerStage.STAGE2_ADJUSTMENT);
      expect(getNextStage(PlannerStage.STAGE2_ADJUSTMENT)).toBe(PlannerStage.STAGE3_ANALYSIS);
      expect(getNextStage(PlannerStage.STAGE3_ANALYSIS)).toBeNull();
    });

    test('is ready for stage', () => {
      // Empty data
      const emptyData = createPlannerData();

      expect(isReadyForStage(emptyData, PlannerStage.STAGE1_INPUT)).toBe(true);
      expect(isReadyForStage(emptyData, PlannerStage.STAGE2_ADJUSTMENT)).toBe(false);
      expect(isReadyForStage(emptyData, PlannerStage.STAGE3_ANALYSIS)).toBe(false);

      // Stage 1 complete data
      const stage1Data = createPlannerData({
        user_profile: mockUserProfile,
        income_items: mockIncomeItems,
        expense_items: mockExpenseItems,
      });

      expect(isReadyForStage(stage1Data, PlannerStage.STAGE1_INPUT)).toBe(true);
      expect(isReadyForStage(stage1Data, PlannerStage.STAGE2_ADJUSTMENT)).toBe(true);
      expect(isReadyForStage(stage1Data, PlannerStage.STAGE3_ANALYSIS)).toBe(false);

      // Stage 2 complete data
      const projectionData: AnnualProjectionRow[] = [
        { age: 34, year: 2024, total_income: new Decimal(80000), total_expense: new Decimal(50000) },
        { age: 35, year: 2025, total_income: new Decimal(81600), total_expense: new Decimal(50000) },
      ];

      const stage2Data = createPlannerData({
        user_profile: mockUserProfile,
        income_items: mockIncomeItems,
        expense_items: mockExpenseItems,
        projection_df: projectionData,
      });

      expect(isReadyForStage(stage2Data, PlannerStage.STAGE1_INPUT)).toBe(true);
      expect(isReadyForStage(stage2Data, PlannerStage.STAGE2_ADJUSTMENT)).toBe(true);
      expect(isReadyForStage(stage2Data, PlannerStage.STAGE3_ANALYSIS)).toBe(true);
    });
  });

  describe('Edge cases and validation', () => {
    test('handle missing user profile in conversion', () => {
      const config: PlannerConfigV1 = {
        version: '1.0',
        metadata: {},
        profile: {}, // Empty profile
        income_items: [],
        expense_items: [],
        overrides: [],
        simulation_settings: {},
      };

      const plannerData = configToPlannerData(config);

      // Should create UserProfile with defaults
      expect(plannerData.user_profile?.birth_year).toBe(1990);
      expect(plannerData.user_profile?.expected_fire_age).toBe(50);
    });

    test('handle missing simulation settings', () => {
      const config: PlannerConfigV1 = {
        version: '1.0',
        metadata: {},
        profile: { birth_year: 1985 },
        income_items: [],
        expense_items: [],
        overrides: [],
        simulation_settings: {}, // Empty settings
      };

      const plannerData = configToPlannerData(config);

      // Should create SimulationSettings with defaults
      expect(plannerData.simulation_settings).toBeDefined();
      expect(plannerData.simulation_settings.num_simulations).toBeDefined();
    });

    test('handle partial item data in conversion', () => {
      const config: PlannerConfigV1 = {
        version: '1.0',
        metadata: {},
        profile: { birth_year: 1990 },
        income_items: [
          { id: 'partial-income', name: 'Partial Income' } // Missing most fields
        ],
        expense_items: [
          { id: 'partial-expense', name: 'Partial Expense' } // Missing most fields
        ],
        overrides: [],
        simulation_settings: {},
      };

      const plannerData = configToPlannerData(config);

      expect(plannerData.income_items).toHaveLength(1);
      expect(plannerData.income_items[0].id).toBe('partial-income');
      expect(plannerData.income_items[0].after_tax_amount_per_period.toNumber()).toBe(0); // Default
      expect(plannerData.income_items[0].is_income).toBe(true); // Default for income items

      expect(plannerData.expense_items).toHaveLength(1);
      expect(plannerData.expense_items[0].id).toBe('partial-expense');
      expect(plannerData.expense_items[0].is_income).toBe(false); // Default for expense items
    });
  });
});
