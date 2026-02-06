/**
 * UI-friendly types for form components
 *
 * These are simplified versions of the core data models
 * specifically designed for UI components and form handling.
 */

// Simplified frequency type for UI
export type UIItemFrequency = 'annual' | 'monthly' | 'one_time';

// UI-friendly income/expense item for forms
export interface UIIncomeExpenseItem {
  id: string;
  name: string;
  after_tax_amount_per_period: number;
  frequency: UIItemFrequency;
  /**
   * Repeat interval in frequency unit periods.
   * - `annual`: every N years
   * - `monthly`: every N months
   */
  interval_periods: number;
  growth_rate: number;
  /** Optional Stage-1 phase (age band). */
  phase?: 1 | 2 | 3 | 4;
  /** Optional Stage-1 continuous phase end (>= phase). */
  phase_end?: 1 | 2 | 3 | 4;
  start_age: number;
  end_age: number;
  tags?: string[];
}

import type { IncomeExpenseItem, ItemFrequency, TimeUnit } from './index';

// Conversion utilities
export function convertUIToCore(
  item: UIIncomeExpenseItem,
  isIncome: boolean
): IncomeExpenseItem {
  // Map UI frequency to core format
  let time_unit: TimeUnit;
  let frequency: ItemFrequency;
  let interval_periods: number;

  if (item.frequency === 'annual') {
    time_unit = 'annually';
    frequency = 'recurring';
    interval_periods = item.interval_periods ?? 1;
  } else if (item.frequency === 'monthly') {
    time_unit = 'monthly';
    frequency = 'recurring';
    interval_periods = item.interval_periods ?? 1;
  } else {
    // one_time
    time_unit = 'annually';
    frequency = 'one-time';
    interval_periods = 1;
  }

  return {
    id: item.id,
    name: item.name,
    after_tax_amount_per_period: item.after_tax_amount_per_period,
    time_unit,
    frequency,
    interval_periods: Math.max(1, Math.floor(interval_periods)),
    phase: item.phase,
    phase_end: item.phase_end,
    start_age: item.start_age,
    end_age: item.end_age,
    annual_growth_rate: item.growth_rate,
    is_income: isIncome,
    category: undefined,
    predefined_type: undefined,
  };
}

export function convertCoreToUI(item: IncomeExpenseItem): UIIncomeExpenseItem {
  // Map core format to UI frequency
  let frequency: UIItemFrequency;

  if (item.frequency === 'one-time') {
    frequency = 'one_time';
  } else if (item.time_unit === 'annually') {
    frequency = 'annual';
  } else {
    frequency = 'monthly'; // default to monthly for other time units
  }

  return {
    id: item.id,
    name: item.name,
    after_tax_amount_per_period: item.after_tax_amount_per_period,
    frequency,
    interval_periods: Math.max(1, Math.floor(item.interval_periods ?? 1)),
    growth_rate: item.annual_growth_rate,
    start_age: item.start_age,
    end_age:
      item.frequency === 'one-time' ? item.start_age : (item.end_age ?? 100),
    phase: item.phase,
    phase_end: item.phase_end,
    tags: [],
  };
}
