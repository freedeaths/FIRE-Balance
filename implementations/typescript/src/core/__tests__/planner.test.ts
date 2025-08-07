/**
 * Tests for FIRE Planner functionality - Direct port from Python test_planner.py
 * Ensures identical planner behavior between TypeScript and Python implementations
 */

import {
  FIREPlanner,
  createPlanner,
  createPlannerFromConfig,
  createPlannerFromJSON,
} from '../planner';

import type {
  UserProfile,
  IncomeExpenseItem,
  FIRECalculationResult,
} from '../data_models';

import type {
  PlannerConfigV1,
  Override,
  AnnualProjectionRow,
} from '../planner_models';

import { createPlannerConfigV1, PlannerStage } from '../planner_models';

describe('FIREPlanner', () => {
  let sampleUserProfile: UserProfile;
  let sampleIncomeItem: IncomeExpenseItem;
  let sampleExpenseItem: IncomeExpenseItem;

  beforeEach(() => {
    sampleUserProfile = {
      birth_year: 1990,
      expected_fire_age: 50,
      legal_retirement_age: 65,
      life_expectancy: 85,
      current_net_worth: 50000,
      inflation_rate: 3.0,
      safety_buffer_months: 12.0,
      portfolio: {
        asset_classes: [
          {
            name: 'stocks',
            display_name: 'Stocks',
            allocation_percentage: 70.0,
            expected_return: 7.0,
            volatility: 15.0,
            liquidity_level: 'medium',
          },
          {
            name: 'bonds',
            display_name: 'Bonds',
            allocation_percentage: 20.0,
            expected_return: 3.0,
            volatility: 5.0,
            liquidity_level: 'low',
          },
          {
            name: 'cash',
            display_name: 'Cash',
            allocation_percentage: 10.0,
            expected_return: 1.0,
            volatility: 1.0,
            liquidity_level: 'high',
          },
        ],
        enable_rebalancing: true,
      },
    };

    sampleIncomeItem = {
      id: 'work-income',
      name: 'Work Income',
      after_tax_amount_per_period: 80000,
      time_unit: 'annually',
      frequency: 'recurring',
      interval_periods: 1,
      start_age: 34,
      end_age: 50,
      annual_growth_rate: 2.0,
      is_income: true,
      category: 'Employment',
    };

    sampleExpenseItem = {
      id: 'living-expenses',
      name: 'Living Expenses',
      after_tax_amount_per_period: 50000,
      time_unit: 'annually',
      frequency: 'recurring',
      interval_periods: 1,
      start_age: 34,
      end_age: 85,
      annual_growth_rate: 0.0,
      is_income: false,
      category: 'Living',
    };
  });

  describe('Initialization', () => {
    test('create planner with default language', () => {
      const planner = new FIREPlanner();

      expect(planner.data.language).toBe('en');
      expect(planner.data.current_stage).toBe(PlannerStage.STAGE1_INPUT);
      expect(planner.data.income_items).toEqual([]);
      expect(planner.data.expense_items).toEqual([]);
      expect(planner.data.overrides).toEqual([]);
      expect(planner.data.session_id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    });

    test('create planner with custom language', () => {
      const planner = new FIREPlanner('zh');

      expect(planner.data.language).toBe('zh');
    });

    test('create planner using factory function', () => {
      const planner = createPlanner('ja');

      expect(planner).toBeInstanceOf(FIREPlanner);
      expect(planner.data.language).toBe('ja');
    });
  });

  describe('Stage 1: Input Collection', () => {
    test('set user profile', () => {
      const planner = new FIREPlanner();
      planner.setUserProfile(sampleUserProfile);

      expect(planner.data.user_profile).toBe(sampleUserProfile);
      expect(planner.data.updated_at).toBeInstanceOf(Date);
    });

    test('add income item', () => {
      const planner = new FIREPlanner();
      planner.setUserProfile(sampleUserProfile);

      const itemId = planner.addIncomeItem(sampleIncomeItem);

      expect(itemId).toBe('work-income');
      expect(planner.data.income_items).toHaveLength(1);
      expect(planner.data.income_items[0]).toBe(sampleIncomeItem);
    });

    test('add income item without ID', () => {
      const planner = new FIREPlanner();
      planner.setUserProfile(sampleUserProfile);

      const itemWithoutId = { ...sampleIncomeItem };
      delete itemWithoutId.id;

      const itemId = planner.addIncomeItem(itemWithoutId);

      expect(itemId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      expect(planner.data.income_items).toHaveLength(1);
      expect(planner.data.income_items[0].id).toBe(itemId);
    });

    test('add expense item', () => {
      const planner = new FIREPlanner();
      planner.setUserProfile(sampleUserProfile);

      const itemId = planner.addExpenseItem(sampleExpenseItem);

      expect(itemId).toBe('living-expenses');
      expect(planner.data.expense_items).toHaveLength(1);
      expect(planner.data.expense_items[0]).toBe(sampleExpenseItem);
    });

    test('remove income item', () => {
      const planner = new FIREPlanner();
      planner.setUserProfile(sampleUserProfile);
      planner.addIncomeItem(sampleIncomeItem);

      const removed = planner.removeIncomeItem('work-income');

      expect(removed).toBe(true);
      expect(planner.data.income_items).toHaveLength(0);
    });

    test('remove non-existent income item', () => {
      const planner = new FIREPlanner();
      planner.setUserProfile(sampleUserProfile);

      const removed = planner.removeIncomeItem('non-existent');

      expect(removed).toBe(false);
    });

    test('remove expense item', () => {
      const planner = new FIREPlanner();
      planner.setUserProfile(sampleUserProfile);
      planner.addExpenseItem(sampleExpenseItem);

      const removed = planner.removeExpenseItem('living-expenses');

      expect(removed).toBe(true);
      expect(planner.data.expense_items).toHaveLength(0);
    });
  });

  describe('Stage 2: Table Generation and Adjustment', () => {
    test('generate projection table', () => {
      const planner = new FIREPlanner();
      planner.setUserProfile(sampleUserProfile);
      planner.addIncomeItem(sampleIncomeItem);
      planner.addExpenseItem(sampleExpenseItem);

      const projectionData = planner.generateProjectionTable();

      expect(projectionData).toBeDefined();
      expect(projectionData.length).toBeGreaterThan(0);
      expect(projectionData[0]).toHaveProperty('age');
      expect(projectionData[0]).toHaveProperty('year');
      expect(projectionData[0]).toHaveProperty('total_income');
      expect(projectionData[0]).toHaveProperty('total_expense');
      expect(planner.data.projection_df).toBe(projectionData);
    });

    test('generate projection table with missing data', () => {
      const planner = new FIREPlanner();
      planner.setUserProfile(sampleUserProfile);
      // Missing income or expense items

      expect(() => planner.generateProjectionTable()).toThrow(
        'Missing required data: user_profile, income_items, or expense_items'
      );
    });

    test('get projection dataframe', () => {
      const planner = new FIREPlanner();
      planner.setUserProfile(sampleUserProfile);
      planner.addIncomeItem(sampleIncomeItem);
      planner.addExpenseItem(sampleExpenseItem);
      planner.generateProjectionTable();

      const dataframe = planner.getProjectionDataFrame();

      expect(dataframe).toBeDefined();
      expect(dataframe!.length).toBeGreaterThan(0);
    });

    test('get projection dataframe without generation', () => {
      const planner = new FIREPlanner();

      const dataframe = planner.getProjectionDataFrame();

      expect(dataframe).toBeUndefined();
    });

    test('add and remove overrides', () => {
      const planner = new FIREPlanner();
      planner.setUserProfile(sampleUserProfile);
      planner.addIncomeItem(sampleIncomeItem);
      planner.addExpenseItem(sampleExpenseItem);

      // Add override
      planner.addOverride(35, 'work-income', 90000);

      expect(planner.data.overrides).toHaveLength(1);
      expect(planner.data.overrides[0]).toEqual({
        age: 35,
        item_id: 'work-income',
        value: 90000,
      });

      // Remove override
      const removed = planner.removeOverride(35, 'work-income');

      expect(removed).toBe(true);
      expect(planner.data.overrides).toHaveLength(0);
    });

    test('clear all overrides', () => {
      const planner = new FIREPlanner();
      planner.setUserProfile(sampleUserProfile);
      planner.addIncomeItem(sampleIncomeItem);
      planner.addExpenseItem(sampleExpenseItem);

      planner.addOverride(35, 'work-income', 90000);
      planner.addOverride(36, 'living-expenses', 55000);

      planner.clearAllOverrides();

      expect(planner.data.overrides).toHaveLength(0);
    });

    test('apply overrides to table', () => {
      const planner = new FIREPlanner();
      planner.setUserProfile(sampleUserProfile);
      planner.addIncomeItem(sampleIncomeItem);
      planner.addExpenseItem(sampleExpenseItem);

      const baseData = planner.generateProjectionTable();
      planner.addOverride(35, 'work-income', 90000);

      const modifiedData = planner.applyOverridesToTable(baseData);

      expect(modifiedData).not.toBe(baseData); // Should be a copy
      expect(modifiedData.length).toBe(baseData.length);
    });
  });

  describe('Stage 3: Calculations and Analysis', () => {
    test('simulation settings', () => {
      const planner = new FIREPlanner();

      const defaultSettings = planner.getSimulationSettings();
      expect(defaultSettings).toBeDefined();
      expect(defaultSettings.num_simulations).toBeGreaterThan(0);

      planner.setSimulationSettings({ num_simulations: 2000 });

      const updatedSettings = planner.getSimulationSettings();
      expect(updatedSettings.num_simulations).toBe(2000);
    });

    test('run calculations', () => {
      const planner = new FIREPlanner();
      planner.setUserProfile(sampleUserProfile);
      planner.addIncomeItem(sampleIncomeItem);
      planner.addExpenseItem(sampleExpenseItem);
      planner.generateProjectionTable();

      // Use minimal simulations for testing
      planner.setSimulationSettings({ num_simulations: 10 });

      const results = planner.runCalculations();

      expect(results).toBeDefined();
      expect(results.fire_calculation).toBeDefined();
      expect(results.calculation_timestamp).toBeInstanceOf(Date);
      expect(planner.data.results).toBe(results);
    });

    test('run calculations without projection data', () => {
      const planner = new FIREPlanner();

      expect(() => planner.runCalculations()).toThrow(
        'No projection data available for calculation'
      );
    });

    test('calculate fire results with custom projection', () => {
      const planner = new FIREPlanner();
      planner.setUserProfile(sampleUserProfile);
      planner.addIncomeItem(sampleIncomeItem);
      planner.addExpenseItem(sampleExpenseItem);

      const customProjection: AnnualProjectionRow[] = [
        { age: 34, year: 2024, total_income: 80000, total_expense: 50000 },
        { age: 35, year: 2025, total_income: 82000, total_expense: 51000 },
      ];

      planner.setSimulationSettings({ num_simulations: 10 });
      const results = planner.calculateFireResults(customProjection);

      expect(results).toBeDefined();
      expect(results.fire_calculation).toBeDefined();
    });
  });

  describe('Import/Export', () => {
    test('export to config', () => {
      const planner = new FIREPlanner();
      planner.setUserProfile(sampleUserProfile);
      planner.addIncomeItem(sampleIncomeItem);
      planner.addExpenseItem(sampleExpenseItem);

      const config = planner.exportToConfig('Test export');

      expect(config.version).toBe('1.0');
      expect(config.metadata.description).toBe('Test export');
      expect(config.profile.birth_year).toBe(1990);
      expect(config.income_items).toHaveLength(1);
      expect(config.expense_items).toHaveLength(1);
    });

    test('load from config', () => {
      const config: PlannerConfigV1 = {
        version: '1.0',
        metadata: { language: 'zh', description: 'Test config' },
        profile: {
          birth_year: 1985,
          expected_fire_age: 55,
          legal_retirement_age: 65,
          life_expectancy: 90,
          current_net_worth: 100000,
          inflation_rate: 2.5,
          safety_buffer_months: 18.0,
        },
        income_items: [
          {
            id: 'salary',
            name: 'Salary',
            after_tax_amount_per_period: 120000,
            time_unit: 'annually',
            frequency: 'recurring',
            interval_periods: 1,
            start_age: 39,
            end_age: 55,
            annual_growth_rate: 3.0,
            is_income: true,
            category: 'Employment',
          }
        ],
        expense_items: [
          {
            id: 'expenses',
            name: 'Living Expenses',
            after_tax_amount_per_period: 70000,
            time_unit: 'annually',
            frequency: 'recurring',
            interval_periods: 1,
            start_age: 39,
            end_age: 90,
            annual_growth_rate: 0.0,
            is_income: false,
            category: 'Living',
          }
        ],
        overrides: [],
        simulation_settings: { num_simulations: 2000 },
      };

      const planner = new FIREPlanner();
      planner.loadFromConfig(config);

      expect(planner.data.language).toBe('zh');
      expect(planner.data.user_profile?.birth_year).toBe(1985);
      expect(planner.data.income_items).toHaveLength(1);
      expect(planner.data.expense_items).toHaveLength(1);
      expect(planner.data.simulation_settings.num_simulations).toBe(2000);
    });

    test('save to and load from JSON', () => {
      const planner = new FIREPlanner();
      planner.setUserProfile(sampleUserProfile);
      planner.addIncomeItem(sampleIncomeItem);
      planner.addExpenseItem(sampleExpenseItem);

      const jsonString = planner.saveToJSON('Test JSON export');
      expect(jsonString).toContain('"version": "1.0"');
      expect(jsonString).toContain('"birth_year": 1990');

      const newPlanner = new FIREPlanner();
      newPlanner.loadFromJSON(jsonString);

      expect(newPlanner.data.user_profile?.birth_year).toBe(1990);
      expect(newPlanner.data.income_items).toHaveLength(1);
      expect(newPlanner.data.expense_items).toHaveLength(1);
    });

    test('load invalid JSON', () => {
      const planner = new FIREPlanner();

      expect(() => planner.loadFromJSON('invalid json')).toThrow(
        'Failed to parse JSON configuration'
      );
    });
  });

  describe('Factory Functions', () => {
    test('create planner from config', () => {
      const config = createPlannerConfigV1({
        metadata: { language: 'ja' },
        profile: { birth_year: 1988 },
      });

      const planner = createPlannerFromConfig(config);

      expect(planner).toBeInstanceOf(FIREPlanner);
      expect(planner.data.language).toBe('ja');
    });

    test('create planner from JSON', () => {
      const config = {
        version: '1.0',
        metadata: { language: 'zh' },
        profile: { birth_year: 1992 },
        income_items: [],
        expense_items: [],
        overrides: [],
        simulation_settings: {},
      };

      const planner = createPlannerFromJSON(JSON.stringify(config));

      expect(planner).toBeInstanceOf(FIREPlanner);
      expect(planner.data.language).toBe('zh');
    });
  });

  describe('Edge Cases', () => {
    test('item removal clears projection', () => {
      const planner = new FIREPlanner();
      planner.setUserProfile(sampleUserProfile);
      planner.addIncomeItem(sampleIncomeItem);
      planner.addExpenseItem(sampleExpenseItem);
      planner.generateProjectionTable();

      expect(planner.data.projection_df).toBeDefined();

      // Remove income item should clear projection if regeneration fails
      planner.data.user_profile = undefined; // Force regeneration to fail
      planner.removeIncomeItem('work-income');

      // Should have cleared projection due to error
      expect(planner.data.projection_df).toBeUndefined();
    });

    test('override cleanup on profile change', () => {
      const planner = new FIREPlanner();
      planner.setUserProfile(sampleUserProfile);
      planner.addIncomeItem(sampleIncomeItem);
      planner.addExpenseItem(sampleExpenseItem);

      // Add override
      planner.addOverride(35, 'work-income', 90000);

      // Change profile with different age range
      const newProfile = { ...sampleUserProfile, life_expectancy: 30 }; // Invalid range
      planner.setUserProfile(newProfile);

      // Override should be cleaned up due to invalid age range
      expect(planner.data.overrides).toHaveLength(0);
    });

    test('progression callback in calculations', () => {
      const planner = new FIREPlanner();
      planner.setUserProfile(sampleUserProfile);
      planner.addIncomeItem(sampleIncomeItem);
      planner.addExpenseItem(sampleExpenseItem);
      planner.generateProjectionTable();
      planner.setSimulationSettings({ num_simulations: 5 });

      const progressValues: number[] = [];
      const progressCallback = (progress: number) => {
        progressValues.push(progress);
      };

      planner.runCalculations(progressCallback);

      expect(progressValues.length).toBeGreaterThan(0);
      expect(progressValues).toContain(1.0); // Should reach 100%
    });
  });
});
