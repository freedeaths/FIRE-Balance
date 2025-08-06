/**
 * Validation utilities for FIRE Balance Calculator
 *
 * This module provides validation functions that mirror the Pydantic validation
 * logic from the Python implementation. It ensures data integrity and provides
 * meaningful error messages for user feedback.
 *
 * Key features:
 * - Type-safe validation functions
 * - Consistent error messaging
 * - Reusable validation logic
 * - Performance-optimized for UI responsiveness
 */

import type {
  UserProfile,
  PortfolioConfiguration,
  AssetClass,
  IncomeExpenseItem,
  ValidationError,
} from '../types';

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get current year for age calculations
 */
const getCurrentYear = (): number => new Date().getFullYear();

/**
 * Calculate current age from birth year
 */
export const calculateCurrentAge = (birthYear: number): number => {
  return getCurrentYear() - birthYear;
};

/**
 * Normalize asset name (matches Python logic)
 * Converts to lowercase and collapses multiple spaces to single space
 */
export const normalizeAssetName = (name: string): string => {
  return name.trim().toLowerCase().replace(/\\s+/g, ' ');
};

// =============================================================================
// Asset Class Validation
// =============================================================================

/**
 * Validate a single asset class
 * Mirrors Python's AssetClass validation logic
 */
export const validateAssetClass = (asset: AssetClass): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Name validation
  if (!asset.name || asset.name.trim().length === 0) {
    errors.push({
      field: 'name',
      message: 'Asset name is required',
      code: 'REQUIRED',
    });
  }

  // Allocation percentage validation
  if (asset.allocation_percentage < 0 || asset.allocation_percentage > 100) {
    errors.push({
      field: 'allocation_percentage',
      message: 'Allocation percentage must be between 0% and 100%',
      code: 'OUT_OF_RANGE',
    });
  }

  // Expected return validation (reasonable bounds)
  if (asset.expected_return < -50 || asset.expected_return > 100) {
    errors.push({
      field: 'expected_return',
      message: 'Expected return must be between -50% and 100%',
      code: 'OUT_OF_RANGE',
    });
  }

  // Volatility validation
  if (asset.volatility < 0 || asset.volatility > 200) {
    errors.push({
      field: 'volatility',
      message: 'Volatility must be between 0% and 200%',
      code: 'OUT_OF_RANGE',
    });
  }

  return errors;
};

/**
 * Create a validated asset class with normalized name
 * Mirrors Python's AssetClass.normalize_name validator
 */
export const createAssetClass = (data: Partial<AssetClass>): AssetClass => {
  const originalName = data.name?.trim() || '';
  const normalizedName = normalizeAssetName(originalName);
  const displayName = data.display_name || originalName;

  return {
    name: normalizedName,
    display_name: displayName,
    allocation_percentage: data.allocation_percentage || 0,
    expected_return: data.expected_return || 0,
    volatility: data.volatility || 0,
    liquidity_level: data.liquidity_level || 'medium',
  } as AssetClass;
};

// =============================================================================
// Portfolio Configuration Validation
// =============================================================================

/**
 * Validate portfolio configuration
 * Mirrors Python's PortfolioConfiguration validation logic
 */
export const validatePortfolio = (
  portfolio: PortfolioConfiguration
): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Validate individual assets
  portfolio.asset_classes.forEach((asset, index) => {
    const assetErrors = validateAssetClass(asset);
    assetErrors.forEach(error => {
      errors.push({
        ...error,
        field: `asset_classes.${index}.${error.field}`,
      });
    });
  });

  // Validate allocation sum (mirrors Python's strict validation)
  const totalAllocation = portfolio.asset_classes.reduce(
    (sum, asset) => sum + asset.allocation_percentage,
    0
  );

  const tolerance = Number.EPSILON; // Machine precision tolerance
  if (Math.abs(totalAllocation - 100.0) > tolerance) {
    errors.push({
      field: 'asset_classes',
      message: `Asset allocation percentages must sum to exactly 100%, got ${totalAllocation.toFixed(6)}% (difference: ${(totalAllocation - 100.0).toFixed(6)}%)`,
      code: 'INVALID_SUM',
    });
  }

  // Validate unique asset names (case-insensitive)
  const normalizedNames = portfolio.asset_classes.map(asset => asset.name);
  const uniqueNames = new Set(normalizedNames);

  if (normalizedNames.length !== uniqueNames.size) {
    const duplicates = normalizedNames.filter((name, index) =>
      normalizedNames.indexOf(name) !== index
    );
    const uniqueDuplicates = [...new Set(duplicates)];
    const displayNames = portfolio.asset_classes
      .filter(asset => uniqueDuplicates.includes(asset.name))
      .map(asset => asset.display_name);

    errors.push({
      field: 'asset_classes',
      message: `Asset names must be unique within portfolio (case-insensitive). Duplicate names found: ${displayNames.join(', ')}`,
      code: 'DUPLICATE_NAMES',
    });
  }

  return errors;
};

// =============================================================================
// User Profile Validation
// =============================================================================

/**
 * Validate birth year
 * Mirrors Python's UserProfile.validate_birth_year
 */
export const validateBirthYear = (birthYear: number): ValidationError[] => {
  const errors: ValidationError[] = [];
  const currentYear = getCurrentYear();

  if (birthYear < 1950 || birthYear > currentYear) {
    errors.push({
      field: 'birth_year',
      message: `Birth year must be between 1950 and ${currentYear}, got ${birthYear}`,
      code: 'OUT_OF_RANGE',
    });
  }

  return errors;
};

/**
 * Validate age progression logic
 * Mirrors Python's UserProfile.validate_age_progression
 */
export const validateAgeProgression = (profile: UserProfile): ValidationError[] => {
  const errors: ValidationError[] = [];

  const currentAge = calculateCurrentAge(profile.birth_year);
  const fireAge = profile.expected_fire_age;
  const retirementAge = profile.legal_retirement_age;
  const lifeExpectancy = profile.life_expectancy;

  // Check the age progression: current <= fire <= retirement <= life_expectancy
  if (!(currentAge <= fireAge && fireAge <= retirementAge && retirementAge <= lifeExpectancy)) {
    errors.push({
      field: 'age_progression',
      message: `Ages must follow progression: current_age(${currentAge}) <= expected_fire_age(${fireAge}) <= legal_retirement_age(${retirementAge}) <= life_expectancy(${lifeExpectancy})`,
      code: 'INVALID_PROGRESSION',
    });
  }

  return errors;
};

/**
 * Comprehensive user profile validation
 * Combines all individual validation functions
 */
export const validateUserProfile = (profile: UserProfile): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Birth year validation
  errors.push(...validateBirthYear(profile.birth_year));

  // Age progression validation (only if birth year is valid)
  if (errors.length === 0) {
    errors.push(...validateAgeProgression(profile));
  }

  // Portfolio validation
  errors.push(...validatePortfolio(profile.portfolio));

  // Safety buffer validation
  if (profile.safety_buffer_months < 0 || profile.safety_buffer_months > 120) {
    errors.push({
      field: 'safety_buffer_months',
      message: 'Safety buffer must be between 0 and 120 months',
      code: 'OUT_OF_RANGE',
    });
  }

  // Inflation rate validation
  if (profile.inflation_rate < -10 || profile.inflation_rate > 50) {
    errors.push({
      field: 'inflation_rate',
      message: 'Inflation rate must be between -10% and 50%',
      code: 'OUT_OF_RANGE',
    });
  }

  return errors;
};

// =============================================================================
// Income/Expense Item Validation
// =============================================================================

/**
 * Validate income/expense item against user profile
 * Provides contextual validation based on user's age constraints
 */
export const validateIncomeExpenseItem = (
  item: IncomeExpenseItem,
  userProfile: UserProfile
): ValidationError[] => {
  const errors: ValidationError[] = [];
  const currentAge = calculateCurrentAge(userProfile.birth_year);

  // Name validation
  if (!item.name || item.name.trim().length === 0) {
    errors.push({
      field: 'name',
      message: 'Item name is required',
      code: 'REQUIRED',
    });
  }

  // Amount validation
  if (item.after_tax_amount_per_period < 0) {
    errors.push({
      field: 'after_tax_amount_per_period',
      message: 'Amount must be non-negative',
      code: 'NEGATIVE_VALUE',
    });
  }

  // Start age validation
  if (item.start_age < currentAge) {
    errors.push({
      field: 'start_age',
      message: `${item.is_income ? 'Income' : 'Expense'} item '${item.name}': Start age (${item.start_age}) cannot be less than current age (${currentAge})`,
      code: 'START_AGE_TOO_SMALL',
    });
  }

  if (item.start_age > userProfile.life_expectancy) {
    errors.push({
      field: 'start_age',
      message: `${item.is_income ? 'Income' : 'Expense'} item '${item.name}': Start age (${item.start_age}) cannot be greater than life expectancy (${userProfile.life_expectancy})`,
      code: 'START_AGE_TOO_LARGE',
    });
  }

  // End age validation (for recurring items)
  if (item.end_age !== null) {
    if (item.end_age > userProfile.life_expectancy) {
      errors.push({
        field: 'end_age',
        message: `${item.is_income ? 'Income' : 'Expense'} item '${item.name}': End age (${item.end_age}) cannot be greater than life expectancy (${userProfile.life_expectancy})`,
        code: 'END_AGE_TOO_LARGE',
      });
    }

    if (item.end_age <= item.start_age) {
      errors.push({
        field: 'end_age',
        message: 'End age must be greater than start age',
        code: 'INVALID_AGE_RANGE',
      });
    }
  }

  // Interval periods validation
  if (item.interval_periods <= 0) {
    errors.push({
      field: 'interval_periods',
      message: 'Interval periods must be greater than 0',
      code: 'NON_POSITIVE',
    });
  }

  // Growth rate validation (reasonable bounds)
  if (item.annual_growth_rate < -50 || item.annual_growth_rate > 100) {
    errors.push({
      field: 'annual_growth_rate',
      message: 'Annual growth rate must be between -50% and 100%',
      code: 'OUT_OF_RANGE',
    });
  }

  return errors;
};

// =============================================================================
// Validation Result Helpers
// =============================================================================

/**
 * Check if validation errors exist
 */
export const hasValidationErrors = (errors: ValidationError[]): boolean => {
  return errors.length > 0;
};

/**
 * Get validation errors by field
 */
export const getErrorsByField = (
  errors: ValidationError[],
  field: string
): ValidationError[] => {
  return errors.filter(error => error.field === field);
};

/**
 * Get first error message for a field
 */
export const getFieldErrorMessage = (
  errors: ValidationError[],
  field: string
): string | null => {
  const fieldErrors = getErrorsByField(errors, field);
  return fieldErrors.length > 0 ? fieldErrors[0].message : null;
};

/**
 * Format validation errors for display
 */
export const formatValidationErrors = (errors: ValidationError[]): string => {
  if (errors.length === 0) return '';

  return errors.map(error => `${error.field}: ${error.message}`).join('\\n');
};
