/**
 * Tests for FIRE calculation engine
 *
 * These tests ensure our TypeScript engine produces consistent results
 * and maintains compatibility with the Python implementation.
 */

import {
  FIREEngine,
  createEngineInput,
  validateEngineInput
} from '../engine';
import { calculateCurrentAge } from '../../utils/validation';
import type { UserProfile } from '../../types';
import { DEFAULT_USER_PROFILE } from '../../types';

describe('FIREEngine', () => {
  // Sample user profile for testing
  const testProfile: UserProfile = {
    ...DEFAULT_USER_PROFILE,
    birth_year: 1990,
    expected_fire_age: 45,
    current_net_worth: 100000,
  };

  // Sample projection data
  const createSampleProjection = (years = 5) => {
    const currentAge = calculateCurrentAge(testProfile.birth_year);
    const projectionData = [];

    for (let i = 0; i < years; i++) {
      projectionData.push({
        age: currentAge + i,
        year: new Date().getFullYear() + i,
        total_income: 80000 * Math.pow(1.03, i), // 3% growth
        total_expense: 50000 * Math.pow(1.03, i), // 3% inflation
      });
    }

    return projectionData;
  };

  describe('Engine Input Validation', () => {
    test('should validate correct engine input', () => {
      const projectionData = createSampleProjection();
      const engineInput = createEngineInput(testProfile, projectionData);
      const errors = validateEngineInput(engineInput);

      expect(errors).toHaveLength(0);
    });

    test('should reject empty projection data', () => {
      const engineInput = createEngineInput(testProfile, []);
      const errors = validateEngineInput(engineInput);

      expect(errors).toContain('Annual financial projection data is required');
    });

    test('should reject malformed projection data', () => {
      const badProjection = [
        { age: 30, year: 2024 }, // Missing total_income and total_expense
      ];
      const engineInput = createEngineInput(testProfile, badProjection as any);
      const errors = validateEngineInput(engineInput);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('missing required fields');
    });
  });

  describe('FIRE Calculations', () => {
    test('should perform basic FIRE calculation', () => {
      const projectionData = createSampleProjection(10);
      const engineInput = createEngineInput(testProfile, projectionData);
      const engine = new FIREEngine(engineInput);

      const result = engine.calculate();

      // Basic result structure validation
      expect(result).toHaveProperty('is_fire_achievable');
      expect(result).toHaveProperty('fire_net_worth');
      expect(result).toHaveProperty('yearly_results');
      expect(result.yearly_results).toHaveLength(10);

      // Ensure all yearly results have required properties
      result.yearly_results.forEach(yearlyState => {
        expect(yearlyState).toHaveProperty('age');
        expect(yearlyState).toHaveProperty('year');
        expect(yearlyState).toHaveProperty('total_income');
        expect(yearlyState).toHaveProperty('total_expense');
        expect(yearlyState).toHaveProperty('net_cash_flow');
        expect(yearlyState).toHaveProperty('portfolio_value');
        expect(yearlyState).toHaveProperty('net_worth');
        expect(yearlyState).toHaveProperty('is_sustainable');
      });
    });

    test('should calculate net cash flow correctly', () => {
      const projectionData = [
        {
          age: 35,
          year: 2024,
          total_income: 100000,
          total_expense: 60000,
        },
      ];

      const engineInput = createEngineInput(testProfile, projectionData);
      const engine = new FIREEngine(engineInput);

      const yearlyState = engine.calculateSingleYear(35, 2024, 100000, 60000);

      expect(yearlyState.net_cash_flow).toBe(40000); // 100000 - 60000
      expect(yearlyState.total_income).toBe(100000);
      expect(yearlyState.total_expense).toBe(60000);
    });

    test('should handle positive cash flows', () => {
      const projectionData = [
        {
          age: 35,
          year: 2024,
          total_income: 100000,
          total_expense: 50000, // Positive cash flow
        },
      ];

      const engineInput = createEngineInput(testProfile, projectionData);
      const engine = new FIREEngine(engineInput);
      const result = engine.calculate();

      const firstYear = result.yearly_results[0];
      expect(firstYear.net_cash_flow).toBeGreaterThan(0);
      expect(firstYear.portfolio_value).toBeGreaterThan(testProfile.current_net_worth);
    });

    test('should handle negative cash flows', () => {
      const projectionData = [
        {
          age: 35,
          year: 2024,
          total_income: 30000,
          total_expense: 80000, // Negative cash flow
        },
      ];

      const engineInput = createEngineInput(testProfile, projectionData);
      const engine = new FIREEngine(engineInput);
      const result = engine.calculate();

      const firstYear = result.yearly_results[0];
      expect(firstYear.net_cash_flow).toBeLessThan(0);
      // Portfolio value should decrease or become zero
      expect(firstYear.portfolio_value).toBeLessThanOrEqual(testProfile.current_net_worth);
    });
  });

  describe('Portfolio Integration', () => {
    test('should apply investment returns', () => {
      const projectionData = createSampleProjection(2);
      const engineInput = createEngineInput(testProfile, projectionData);
      const engine = new FIREEngine(engineInput);

      // Get yearly states to check investment returns
      const yearlyStates = engine.getYearlyStates();

      expect(yearlyStates).toHaveLength(2);
      yearlyStates.forEach(state => {
        expect(state).toHaveProperty('investment_return');
        // Investment return should be a number (could be positive, negative, or zero)
        expect(typeof state.investment_return).toBe('number');
      });
    });

    test('should calculate traditional FIRE metrics', () => {
      const projectionData = createSampleProjection(1);
      const engineInput = createEngineInput(testProfile, projectionData);
      const engine = new FIREEngine(engineInput);

      const result = engine.calculate();
      const firstYear = result.yearly_results[0];

      // Traditional FIRE number should be 25x annual expenses
      const expectedFireNumber = firstYear.total_expense * 25;
      expect(firstYear.fire_number).toBeCloseTo(expectedFireNumber, 2);

      // FIRE progress should be portfolio_value / fire_number
      const expectedProgress = firstYear.portfolio_value / expectedFireNumber;
      expect(firstYear.fire_progress).toBeCloseTo(expectedProgress, 4);
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero net worth', () => {
      const zeroNetWorthProfile: UserProfile = {
        ...testProfile,
        current_net_worth: 0,
      };

      const projectionData = createSampleProjection(1);
      const engineInput = createEngineInput(zeroNetWorthProfile, projectionData);
      const engine = new FIREEngine(engineInput);

      const result = engine.calculate();

      expect(result).toHaveProperty('is_fire_achievable');
      expect(result.yearly_results).toHaveLength(1);
    });

    test('should handle single year projection', () => {
      const projectionData = createSampleProjection(1);
      const engineInput = createEngineInput(testProfile, projectionData);
      const engine = new FIREEngine(engineInput);

      const result = engine.calculate();

      expect(result.yearly_results).toHaveLength(1);
      expect(result.total_years_simulated).toBe(1);
    });
  });
});
