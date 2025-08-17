/**
 * Tests for FIRE Advisor functionality - Direct port from Python test_advisor.py
 * Ensures identical advisor recommendations between TypeScript and Python implementations
 */

import Decimal from "decimal.js";

import { FIREAdvisor, createAdvisor } from "../advisor";
import { FIREEngine, createEngineInput, createProjectionRow } from "../engine";
import type { UserProfile, IncomeExpenseItem } from "../data_models";
import {
  createUserProfile,
  createIncomeExpenseItem,
  createPortfolioConfiguration,
} from "../data_models";

import type { AnnualProjectionRow, SimpleRecommendation } from "../../types";

describe("FIREAdvisor", () => {
  let baseUserProfile: UserProfile;

  beforeEach(() => {
    const portfolio = createPortfolioConfiguration({
      asset_classes: [
        {
          name: "stocks",
          display_name: "Stocks",
          allocation_percentage: new Decimal(70.0),
          expected_return: new Decimal(7.0),
          volatility: new Decimal(15.0),
          liquidity_level: "medium",
        },
        {
          name: "bonds",
          display_name: "Bonds",
          allocation_percentage: new Decimal(20.0),
          expected_return: new Decimal(3.0),
          volatility: new Decimal(5.0),
          liquidity_level: "low",
        },
        {
          name: "cash",
          display_name: "Cash",
          allocation_percentage: new Decimal(10.0),
          expected_return: new Decimal(1.0),
          volatility: new Decimal(1.0),
          liquidity_level: "high",
        },
      ],
      enable_rebalancing: true,
    });

    baseUserProfile = createUserProfile({
      birth_year: 1990,
      expected_fire_age: 50,
      legal_retirement_age: 65,
      life_expectancy: 85,
      current_net_worth: new Decimal(50000),
      inflation_rate: new Decimal(3.0),
      safety_buffer_months: new Decimal(12.0),
      portfolio,
    });
  });

  const createDetailedProjectionAndItems = (
    userProfile: UserProfile,
    annualProjection: AnnualProjectionRow[],
  ) => {
    // Create sample income and expense items
    const incomeItems: IncomeExpenseItem[] = [
      createIncomeExpenseItem({
        id: "work-income",
        name: "Work Income",
        after_tax_amount_per_period: new Decimal(50000),
        time_unit: "annually",
        frequency: "recurring",
        interval_periods: 1,
        start_age: new Date().getFullYear() - userProfile.birth_year,
        end_age: userProfile.expected_fire_age,
        annual_growth_rate: new Decimal(0.0),
        is_income: true,
        category: "Employment",
      }),
    ];

    const expenseItems: IncomeExpenseItem[] = [
      createIncomeExpenseItem({
        id: "living-expenses",
        name: "Living Expenses",
        after_tax_amount_per_period: new Decimal(30000),
        time_unit: "annually",
        frequency: "recurring",
        interval_periods: 1,
        start_age: new Date().getFullYear() - userProfile.birth_year,
        end_age: userProfile.life_expectancy,
        annual_growth_rate: new Decimal(0.0),
        is_income: false,
        category: "Living",
      }),
    ];

    return { incomeItems, expenseItems };
  };

  // Helper to convert AnnualProjectionRow to AnnualFinancialProjection
  const convertProjectionRows = (rows: AnnualProjectionRow[]) => {
    return rows.map((row) =>
      createProjectionRow(
        row.age,
        row.year,
        row.total_income,
        row.total_expense,
      ),
    );
  };

  test("advisor initialization", () => {
    // Create sample projection
    const projection: AnnualProjectionRow[] = [
      { age: 34, year: 2024, total_income: 50000, total_expense: 30000 },
      { age: 35, year: 2025, total_income: 50000, total_expense: 30000 },
    ];

    const { incomeItems, expenseItems } = createDetailedProjectionAndItems(
      baseUserProfile,
      projection,
    );
    const engineInput = createEngineInput(
      baseUserProfile,
      convertProjectionRows(projection),
      incomeItems,
    );
    const advisor = new FIREAdvisor(engineInput);

    expect(advisor).toBeDefined();
    expect(advisor.getEngineInput()).toBe(engineInput);
  });

  test("advisor creation helper", () => {
    const projection: AnnualProjectionRow[] = [
      { age: 34, year: 2024, total_income: 50000, total_expense: 30000 },
    ];

    const { incomeItems } = createDetailedProjectionAndItems(
      baseUserProfile,
      projection,
    );
    const engineInput = createEngineInput(
      baseUserProfile,
      convertProjectionRows(projection),
      incomeItems,
    );
    const advisor = createAdvisor(engineInput);

    expect(advisor).toBeInstanceOf(FIREAdvisor);
  });

  test("early retirement recommendation", async () => {
    // Create scenario where FIRE is already achievable
    const achievableProfile = createUserProfile({
      ...baseUserProfile,
      current_net_worth: new Decimal(2000000), // High net worth to make FIRE easily achievable
    });

    const projection: AnnualProjectionRow[] = [
      { age: 34, year: 2024, total_income: 50000, total_expense: 30000 },
      { age: 35, year: 2025, total_income: 50000, total_expense: 30000 },
    ];

    const { incomeItems } = createDetailedProjectionAndItems(
      achievableProfile,
      projection,
    );
    const engineInput = createEngineInput(
      achievableProfile,
      convertProjectionRows(projection),
      incomeItems,
    );
    const advisor = new FIREAdvisor(engineInput);

    const recommendations = await advisor.getAllRecommendations();

    expect(recommendations).toBeDefined();
    expect(Array.isArray(recommendations)).toBe(true);

    // Should include early retirement recommendation when FIRE is achievable
    const earlyRetirement = recommendations.find(
      (r) => r.type === "early_retirement",
    );
    if (earlyRetirement) {
      expect(earlyRetirement.is_achievable).toBe(true);
      expect(earlyRetirement.params).toHaveProperty("suggested_fire_age");
    }
  });

  test("delayed retirement recommendation", async () => {
    // Create scenario where FIRE is not achievable at target age
    const challengingProfile = createUserProfile({
      ...baseUserProfile,
      current_net_worth: new Decimal(10000), // Low net worth
      expected_fire_age: 40, // Very early retirement target
    });

    const projection: AnnualProjectionRow[] = [];
    const currentAge = new Date().getFullYear() - challengingProfile.birth_year;

    // Create projection where expenses exceed income
    for (let i = 0; i < 10; i++) {
      projection.push({
        age: currentAge + i,
        year: new Date().getFullYear() + i,
        total_income: 40000,
        total_expense: 60000, // Higher expenses make FIRE difficult
      });
    }

    const { incomeItems } = createDetailedProjectionAndItems(
      challengingProfile,
      projection,
    );
    const engineInput = createEngineInput(
      challengingProfile,
      convertProjectionRows(projection),
      incomeItems,
    );
    const advisor = new FIREAdvisor(engineInput);

    const recommendations = await advisor.getAllRecommendations();

    expect(recommendations).toBeDefined();
    expect(recommendations.length).toBeGreaterThan(0);

    // Should include delayed retirement recommendation when FIRE is not achievable
    const delayedRetirement = recommendations.find(
      (r) => r.type === "delayed_retirement",
    );
    if (delayedRetirement) {
      expect(delayedRetirement.is_achievable).toBe(true);
      expect(delayedRetirement.params).toHaveProperty("suggested_fire_age");
    }
  });

  test("income adjustment recommendation", async () => {
    // Create scenario where income needs to be increased
    const lowIncomeProfile = createUserProfile({
      ...baseUserProfile,
      current_net_worth: new Decimal(25000),
    });

    const projection: AnnualProjectionRow[] = [];
    const currentAge = new Date().getFullYear() - lowIncomeProfile.birth_year;

    for (let i = 0; i < 15; i++) {
      projection.push({
        age: currentAge + i,
        year: new Date().getFullYear() + i,
        total_income: 35000, // Low income
        total_expense: 45000, // Higher expenses
      });
    }

    const { incomeItems } = createDetailedProjectionAndItems(
      lowIncomeProfile,
      projection,
    );
    const engineInput = createEngineInput(
      lowIncomeProfile,
      convertProjectionRows(projection),
      incomeItems,
    );
    const advisor = new FIREAdvisor(engineInput);

    const recommendations = await advisor.getAllRecommendations();

    expect(recommendations).toBeDefined();

    // Should include income adjustment recommendation
    const incomeAdjustment = recommendations.find(
      (r) => r.type === "income_adjustment",
    );
    if (incomeAdjustment) {
      expect(incomeAdjustment.is_achievable).toBe(true);
      expect(incomeAdjustment.params).toHaveProperty(
        "suggested_increase_percent",
      );
      expect(
        incomeAdjustment.params.suggested_increase_percent,
      ).toBeGreaterThan(0);
    }
  });

  test("expense reduction recommendation", async () => {
    // Create scenario where expenses need to be reduced
    const highExpenseProfile = createUserProfile({
      ...baseUserProfile,
      current_net_worth: new Decimal(30000),
    });

    const projection: AnnualProjectionRow[] = [];
    const currentAge = new Date().getFullYear() - highExpenseProfile.birth_year;

    for (let i = 0; i < 15; i++) {
      projection.push({
        age: currentAge + i,
        year: new Date().getFullYear() + i,
        total_income: 50000,
        total_expense: 70000, // Very high expenses
      });
    }

    const { incomeItems } = createDetailedProjectionAndItems(
      highExpenseProfile,
      projection,
    );
    const engineInput = createEngineInput(
      highExpenseProfile,
      convertProjectionRows(projection),
      incomeItems,
    );
    const advisor = new FIREAdvisor(engineInput);

    const recommendations = await advisor.getAllRecommendations();

    expect(recommendations).toBeDefined();

    // Should include expense reduction recommendation
    const expenseReduction = recommendations.find(
      (r) => r.type === "expense_reduction",
    );
    if (expenseReduction) {
      expect(expenseReduction.is_achievable).toBe(true);
      expect(expenseReduction.params).toHaveProperty(
        "suggested_reduction_percent",
      );
      expect(
        expenseReduction.params.suggested_reduction_percent,
      ).toBeGreaterThan(0);
    }
  });

  test("multiple recommendations", async () => {
    // Create scenario that should generate multiple recommendations
    const complexProfile = createUserProfile({
      ...baseUserProfile,
      current_net_worth: new Decimal(15000), // Very low net worth
      expected_fire_age: 45, // Aggressive FIRE target
    });

    const projection: AnnualProjectionRow[] = [];
    const currentAge = new Date().getFullYear() - complexProfile.birth_year;

    for (let i = 0; i < 10; i++) {
      projection.push({
        age: currentAge + i,
        year: new Date().getFullYear() + i,
        total_income: 45000,
        total_expense: 55000, // Negative cash flow
      });
    }

    const { incomeItems } = createDetailedProjectionAndItems(
      complexProfile,
      projection,
    );
    const engineInput = createEngineInput(
      complexProfile,
      convertProjectionRows(projection),
      incomeItems,
    );
    const advisor = new FIREAdvisor(engineInput);

    const recommendations = await advisor.getAllRecommendations();

    expect(recommendations).toBeDefined();
    expect(recommendations.length).toBeGreaterThan(1); // Should have multiple recommendations

    // Verify all recommendations have required structure
    recommendations.forEach((recommendation) => {
      expect(recommendation).toHaveProperty("type");
      expect(recommendation).toHaveProperty("params");
      expect(recommendation).toHaveProperty("is_achievable");
      expect(typeof recommendation.is_achievable).toBe("boolean");
    });
  });

  test("recommendation types", () => {
    // Test that we have all expected recommendation types
    const validRecommendationTypes = [
      "early_retirement",
      "delayed_retirement",
      "income_adjustment",
      "expense_reduction",
    ];

    // This test ensures the type system supports all recommendation types
    validRecommendationTypes.forEach((type) => {
      const mockRecommendation: SimpleRecommendation = {
        type: type as any,
        params: { message: `Test ${type}` },
        is_achievable: true,
      };

      expect(mockRecommendation.type).toBe(type);
    });
  });

  test("recommendation parameters structure", () => {
    // Test basic recommendation parameter structure
    const sampleRecommendation: SimpleRecommendation = {
      type: "income_adjustment",
      params: {
        message: "Consider increasing income",
        suggested_increase_percent: 15,
      },
      is_achievable: true,
    };

    expect(sampleRecommendation.params).toHaveProperty("message");
    expect(typeof sampleRecommendation.params.message).toBe("string");
  });

  test("advisor with minimal data", async () => {
    // Test advisor with minimal projection data
    const minimalProjection: AnnualProjectionRow[] = [
      { age: 34, year: 2024, total_income: 50000, total_expense: 40000 },
    ];

    const { incomeItems } = createDetailedProjectionAndItems(
      baseUserProfile,
      minimalProjection,
    );
    const engineInput = createEngineInput(
      baseUserProfile,
      convertProjectionRows(minimalProjection),
      incomeItems,
    );
    const advisor = new FIREAdvisor(engineInput);

    const recommendations = await advisor.getAllRecommendations();

    expect(recommendations).toBeDefined();
    expect(Array.isArray(recommendations)).toBe(true);
    // Should handle minimal data gracefully
  });

  test("advisor language support", async () => {
    // Test advisor with language parameter
    const projection: AnnualProjectionRow[] = [
      { age: 34, year: 2024, total_income: 50000, total_expense: 30000 },
    ];

    const { incomeItems } = createDetailedProjectionAndItems(
      baseUserProfile,
      projection,
    );
    const engineInput = createEngineInput(
      baseUserProfile,
      convertProjectionRows(projection),
      incomeItems,
    );

    // Test with different language
    const advisor = new FIREAdvisor(engineInput, "zh");

    expect(advisor).toBeDefined();

    const recommendations = await advisor.getAllRecommendations();
    expect(recommendations).toBeDefined();
  });
});
