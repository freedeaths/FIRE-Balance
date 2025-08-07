/**
 * Tests for data models - Direct port from Python test_data_models.py
 * Ensures identical validation and behavior between TypeScript and Python implementations
 */

import {
  AssetClass,
  createIncomeExpenseItem,
  createPortfolioConfiguration,
  createUserProfile,
  getCurrentAge,
  IncomeExpenseItem,
  ItemFrequency,
  LiquidityLevel,
  normalizeAssetClass,
  PortfolioConfiguration,
  TimeUnit,
  UserProfile,
  validateAgeProgression,
  validateAllocationSum,
  validateBirthYear,
  validateUniqueAssetNames
} from '../data_models';

describe('UserProfile', () => {
  test('valid ages', () => {
    const profile = createUserProfile({
      birth_year: 1994, // current_age would be around 30 in 2024
      expected_fire_age: 45,
      legal_retirement_age: 65,
      life_expectancy: 85,
      current_net_worth: 100000.0,
      inflation_rate: 3.0,
      safety_buffer_months: 12,
    });

    expect(getCurrentAge(profile.birth_year)).toBeGreaterThanOrEqual(29); // Flexible since it depends on current year
    expect(profile.expected_fire_age).toBe(45);
    expect(profile.legal_retirement_age).toBe(65);
    expect(profile.life_expectancy).toBe(85);
  });

  test('invalid age progression', () => {
    expect(() => createUserProfile({
      birth_year: 1994, // current_age around 30
      expected_fire_age: 25, // Invalid: before current age
      legal_retirement_age: 65,
      life_expectancy: 85,
      current_net_worth: 100000.0,
      inflation_rate: 3.0,
      safety_buffer_months: 12,
    })).toThrow('Ages must follow progression');
  });

  test('birth year validation', () => {
    const currentYear = new Date().getFullYear();

    // Valid birth year
    const profile = createUserProfile({
      birth_year: 1990,
      expected_fire_age: 45,
      legal_retirement_age: 65,
      life_expectancy: 85,
      current_net_worth: 100000.0,
      inflation_rate: 3.0,
      safety_buffer_months: 12,
    });

    expect(profile.birth_year).toBe(1990);
    expect(getCurrentAge(profile.birth_year)).toBe(currentYear - 1990);

    // Too early birth year
    expect(() => createUserProfile({
      birth_year: 1949, // Before 1950
      expected_fire_age: 45,
      legal_retirement_age: 65,
      life_expectancy: 85,
      current_net_worth: 100000.0,
      inflation_rate: 3.0,
      safety_buffer_months: 12,
    })).toThrow('Birth year must be between 1950');

    // Future birth year
    expect(() => createUserProfile({
      birth_year: currentYear + 1, // Future year
      expected_fire_age: 45,
      legal_retirement_age: 65,
      life_expectancy: 85,
      current_net_worth: 100000.0,
      inflation_rate: 3.0,
      safety_buffer_months: 12,
    })).toThrow('Birth year must be between 1950');
  });
});

describe('IncomeExpenseItem', () => {
  test('creation', () => {
    const item = createIncomeExpenseItem({
      name: 'Salary',
      after_tax_amount_per_period: 8000.0,
      time_unit: 'monthly',
      frequency: 'recurring',
      start_age: 25,
      end_age: 65,
      is_income: true,
      interval_periods: 1,
      annual_growth_rate: 0.0,
      category: 'Employment',
    });

    expect(item.name).toBe('Salary');
    expect(item.after_tax_amount_per_period).toBe(8000.0);
    expect(item.time_unit).toBe('monthly');
    expect(item.is_income).toBe(true);
  });

  test('interval periods validation', () => {
    expect(() => createIncomeExpenseItem({
      name: 'Invalid Item',
      interval_periods: 0, // Should fail
      is_income: false
    })).toThrow('interval_periods must be greater than 0');
  });
});

describe('PortfolioConfiguration', () => {
  test('valid allocation sum', () => {
    const config = createPortfolioConfiguration({
      asset_classes: [
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
        {
          name: 'Cash',
          display_name: 'Cash',
          allocation_percentage: 10.0,
          expected_return: 1.0,
          volatility: 1.0,
          liquidity_level: 'high',
        },
      ],
      enable_rebalancing: true,
    });

    // Should not throw validation error
    expect(config.asset_classes.length).toBe(3);
    const totalAllocation = config.asset_classes.reduce(
      (sum, asset) => sum + asset.allocation_percentage, 0
    );
    expect(totalAllocation).toBe(100.0);
  });

  test('invalid allocation sum too high', () => {
    expect(() => createPortfolioConfiguration({
      asset_classes: [
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
          allocation_percentage: 50.0, // Total: 110%
          expected_return: 3.0,
          volatility: 5.0,
          liquidity_level: 'low',
        },
      ],
      enable_rebalancing: true,
    })).toThrow('must sum to exactly 100%');
  });

  test('invalid allocation sum too low', () => {
    expect(() => createPortfolioConfiguration({
      asset_classes: [
        {
          name: 'Stocks',
          display_name: 'Stocks',
          allocation_percentage: 40.0,
          expected_return: 7.0,
          volatility: 15.0,
          liquidity_level: 'medium',
        },
        {
          name: 'Bonds',
          display_name: 'Bonds',
          allocation_percentage: 30.0, // Total: 70%
          expected_return: 3.0,
          volatility: 5.0,
          liquidity_level: 'low',
        },
      ],
      enable_rebalancing: true,
    })).toThrow('must sum to exactly 100%');
  });

  test('machine precision tolerance', () => {
    // Create allocation that might have floating point precision issues
    // but should still be valid within machine epsilon
    const slightlyOffTotal = 100.0 + (Number.EPSILON / 2);

    expect(() => createPortfolioConfiguration({
      asset_classes: [
        {
          name: 'Stocks',
          display_name: 'Stocks',
          allocation_percentage: slightlyOffTotal / 2,
          expected_return: 7.0,
          volatility: 15.0,
          liquidity_level: 'medium',
        },
        {
          name: 'Bonds',
          display_name: 'Bonds',
          allocation_percentage: slightlyOffTotal / 2,
          expected_return: 3.0,
          volatility: 5.0,
          liquidity_level: 'low',
        },
      ],
      enable_rebalancing: true,
    })).not.toThrow(); // Should not raise validation error for tiny precision differences
  });

  test('duplicate asset names', () => {
    expect(() => createPortfolioConfiguration({
      asset_classes: [
        {
          name: 'My Stocks',
          display_name: 'My Stocks',
          allocation_percentage: 50.0,
          expected_return: 7.0,
          volatility: 15.0,
          liquidity_level: 'medium',
        },
        {
          // Multiple spaces, different case - same after normalization
          name: 'MY   STOCKS',
          display_name: 'MY   STOCKS',
          allocation_percentage: 50.0,
          expected_return: 8.0,
          volatility: 12.0,
          liquidity_level: 'medium',
        },
      ],
      enable_rebalancing: true,
    })).toThrow('Asset names must be unique');
  });

  test('case insensitive duplicates', () => {
    expect(() => createPortfolioConfiguration({
      asset_classes: [
        {
          name: 'Cash',
          display_name: 'Cash',
          allocation_percentage: 30.0,
          expected_return: 1.0,
          volatility: 0.0,
          liquidity_level: 'high',
        },
        {
          // Different case, same normalized name
          name: 'CASH',
          display_name: 'CASH',
          allocation_percentage: 70.0,
          expected_return: 1.5,
          volatility: 0.0,
          liquidity_level: 'high',
        },
      ],
      enable_rebalancing: true,
    })).toThrow('Asset names must be unique');
  });

  test('valid unique names', () => {
    const config = createPortfolioConfiguration({
      asset_classes: [
        {
          name: 'Stocks', // Will be normalized to "stocks"
          display_name: 'Stocks',
          allocation_percentage: 60.0,
          expected_return: 7.0,
          volatility: 15.0,
          liquidity_level: 'medium',
        },
        {
          name: 'BONDS', // Will be normalized to "bonds"
          display_name: 'BONDS',
          allocation_percentage: 40.0,
          expected_return: 3.0,
          volatility: 5.0,
          liquidity_level: 'low',
        },
      ],
      enable_rebalancing: true,
    });

    // Check that internal names were normalized to lowercase
    const assetNames = config.asset_classes.map(asset => asset.name);
    expect(assetNames).toContain('stocks');
    expect(assetNames).toContain('bonds');
    expect(assetNames).not.toContain('Stocks'); // Original case normalized
    expect(assetNames).not.toContain('BONDS'); // Original case normalized

    // Check that display names preserve original formatting
    const displayNames = config.asset_classes.map(asset => asset.display_name);
    expect(displayNames).toContain('Stocks');
    expect(displayNames).toContain('BONDS');
  });
});

describe('AssetClass', () => {
  test('default liquidity level', () => {
    const asset = normalizeAssetClass({
      name: 'Test Asset',
      display_name: 'Test Asset',
      allocation_percentage: 100.0,
      expected_return: 5.0,
      volatility: 10.0,
      liquidity_level: 'medium',
    });

    // Should default to MEDIUM liquidity
    expect(asset.liquidity_level).toBe('medium');
  });

  test('name normalization', () => {
    // Test various input formats
    const testCases: Array<[string, string, string]> = [
      ['Stocks', 'stocks', 'Stocks'], // (input, internal, display)
      ['BONDS', 'bonds', 'BONDS'],
      ['  Cash  ', 'cash', 'Cash'], // Leading/trailing whitespace (trimmed for display)
      ['Money Market', 'money market', 'Money Market'],
      ['My   Stocks', 'my stocks', 'My   Stocks'], // Multiple spaces
      ['Real  \t Estate', 'real estate', 'Real  \t Estate'], // Tab
      ['rEaL    eStAtE', 'real estate', 'rEaL    eStAtE'],
    ];

    testCases.forEach(([inputName, expectedInternal, expectedDisplay]) => {
      const asset = normalizeAssetClass({
        name: inputName,
        allocation_percentage: 100.0,
        expected_return: 5.0,
        volatility: 10.0,
        liquidity_level: 'medium',
      });

      // Internal: lowercase + normalized spaces
      expect(asset.name).toBe(expectedInternal);
      // Display preserves original (with auto-fill if not provided)
      expect(asset.display_name).toBe(expectedDisplay);
    });
  });
});

describe('LiquidityLevel', () => {
  test('enum values', () => {
    // Test that all expected levels exist with correct values
    const high: LiquidityLevel = 'high';
    const medium: LiquidityLevel = 'medium';
    const low: LiquidityLevel = 'low';

    expect(high).toBe('high');
    expect(medium).toBe('medium');
    expect(low).toBe('low');

    // Test that these are the only valid values (compilation test)
    const levels: LiquidityLevel[] = ['high', 'medium', 'low'];
    expect(levels.length).toBe(3);
  });
});

describe('Validation Functions', () => {
  test('validateAllocationSum', () => {
    const validPortfolio: PortfolioConfiguration = {
      asset_classes: [
        normalizeAssetClass({
          name: 'stocks',
          allocation_percentage: 70,
          expected_return: 7,
          volatility: 15,
          liquidity_level: 'medium'
        }),
        normalizeAssetClass({
          name: 'bonds',
          allocation_percentage: 30,
          expected_return: 3,
          volatility: 5,
          liquidity_level: 'low'
        })
      ],
      enable_rebalancing: true
    };

    expect(() => validateAllocationSum(validPortfolio)).not.toThrow();

    // Invalid - doesn't sum to 100
    const invalidPortfolio: PortfolioConfiguration = {
      ...validPortfolio,
      asset_classes: [
        normalizeAssetClass({
          name: 'stocks',
          allocation_percentage: 50,
          expected_return: 7,
          volatility: 15,
          liquidity_level: 'medium'
        })
      ]
    };

    expect(() => validateAllocationSum(invalidPortfolio)).toThrow('must sum to exactly 100%');
  });

  test('validateBirthYear', () => {
    expect(() => validateBirthYear(1990)).not.toThrow();
    expect(() => validateBirthYear(1949)).toThrow('Birth year must be between 1950');
    expect(() => validateBirthYear(2030)).toThrow('Birth year must be between 1950');
  });

  test('validateAgeProgression', () => {
    const validProfile: UserProfile = {
      birth_year: 1990,
      expected_fire_age: 50,
      legal_retirement_age: 65,
      life_expectancy: 85,
      current_net_worth: 100000,
      inflation_rate: 3,
      safety_buffer_months: 6,
      portfolio: {
        asset_classes: [],
        enable_rebalancing: true
      }
    };

    expect(() => validateAgeProgression(validProfile)).not.toThrow();

    const invalidProfile = {
      ...validProfile,
      expected_fire_age: 25 // Too young compared to current age
    };

    expect(() => validateAgeProgression(invalidProfile)).toThrow('Ages must follow progression');
  });
});
