import type { IncomeExpenseItem } from '../types';

type ExpenseSign = 'positive' | 'negative';

const normalizePositiveInt = (value: unknown, fallback = 1): number => {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(1, Math.floor(num));
};

const countOccurrencesInYearByMonthInterval = (
  yearsSinceStart: number,
  intervalMonths: number
): number => {
  const monthsFromStart = yearsSinceStart * 12;
  let count = 0;
  for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
    if ((monthsFromStart + monthIndex) % intervalMonths === 0) {
      count++;
    }
  }
  return count;
};

const getTimeUnitMonths = (
  timeUnit: IncomeExpenseItem['time_unit']
): number => {
  if (timeUnit === 'monthly') return 1;
  if (timeUnit === 'quarterly') return 3;
  return 12;
};

/**
 * Compute the (rounded) annual total contribution for an item at a specific age.
 *
 * - Respects `frequency`, `time_unit`, and `interval_periods`.
 * - Applies `annual_growth_rate` for both income and expense items.
 * - Applies `inflationRatePct` additionally for expense items.
 */
export const computeAnnualItemAmountAtAge = (
  item: IncomeExpenseItem,
  age: number,
  inflationRatePct: number,
  expenseSign: ExpenseSign = 'positive'
): number => {
  if (age < item.start_age) return 0;
  if (item.end_age !== undefined && age > item.end_age) return 0;

  const yearsSinceStart = age - item.start_age;
  const intervalPeriods = normalizePositiveInt(item.interval_periods, 1);

  let periodsThisYear = 0;
  if (item.frequency === 'one-time') {
    periodsThisYear = yearsSinceStart === 0 ? 1 : 0;
  } else {
    const intervalMonths = intervalPeriods * getTimeUnitMonths(item.time_unit);
    periodsThisYear = countOccurrencesInYearByMonthInterval(
      yearsSinceStart,
      intervalMonths
    );
  }

  if (periodsThisYear === 0) return 0;

  const growthRate = (item.annual_growth_rate || 0) / 100;
  const inflationRate = (inflationRatePct || 0) / 100;
  const totalGrowthRate = item.is_income
    ? growthRate
    : growthRate + inflationRate;

  const baseAnnualAmount =
    (item.after_tax_amount_per_period || 0) * periodsThisYear;
  const grownAmount =
    baseAnnualAmount * Math.pow(1 + totalGrowthRate, yearsSinceStart);

  const rounded = Math.round(grownAmount);
  if (!item.is_income && expenseSign === 'negative') {
    return -Math.abs(rounded);
  }
  return rounded;
};
