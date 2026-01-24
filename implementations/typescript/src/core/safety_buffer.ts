import Decimal from 'decimal.js';

export interface RequiredSafetyBufferMonthsParams {
  age: number;
  expectedFireAge: number;
  legalRetirementAge?: number | null;
  baseSafetyBufferMonths: Decimal.Value;
  bridgeDiscountRatePercent: Decimal.Value;
}

export function getRequiredSafetyBufferMonths(
  params: RequiredSafetyBufferMonthsParams
): Decimal {
  const baseMonths = new Decimal(params.baseSafetyBufferMonths);
  const legalRetirementAge = params.legalRetirementAge;

  if (
    legalRetirementAge == null ||
    params.age < params.expectedFireAge ||
    params.age >= legalRetirementAge
  ) {
    return baseMonths;
  }

  const yearsUntilLegal = legalRetirementAge - params.age;
  if (yearsUntilLegal <= 0) return baseMonths;

  const discountRate = new Decimal(params.bridgeDiscountRatePercent).div(100);
  if (discountRate.lte(0)) {
    return baseMonths.add(new Decimal(yearsUntilLegal).mul(12));
  }

  const one = new Decimal(1);
  const annuityYears = one
    .sub(one.add(discountRate).pow(-yearsUntilLegal))
    .div(discountRate);
  return baseMonths.add(annuityYears.mul(12));
}
