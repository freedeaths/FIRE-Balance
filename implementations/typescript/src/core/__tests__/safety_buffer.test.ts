import Decimal from 'decimal.js';

import { getRequiredSafetyBufferMonths } from '../safety_buffer';

describe('getRequiredSafetyBufferMonths', () => {
  test('returns base months outside bridge window', () => {
    const baseMonths = new Decimal(12);

    expect(
      getRequiredSafetyBufferMonths({
        age: 40,
        expectedFireAge: 47,
        legalRetirementAge: 64,
        baseSafetyBufferMonths: baseMonths,
        bridgeDiscountRatePercent: new Decimal(0),
      }).toNumber()
    ).toBe(12);

    expect(
      getRequiredSafetyBufferMonths({
        age: 64,
        expectedFireAge: 47,
        legalRetirementAge: 64,
        baseSafetyBufferMonths: baseMonths,
        bridgeDiscountRatePercent: new Decimal(0),
      }).toNumber()
    ).toBe(12);

    expect(
      getRequiredSafetyBufferMonths({
        age: 50,
        expectedFireAge: 47,
        legalRetirementAge: null,
        baseSafetyBufferMonths: baseMonths,
        bridgeDiscountRatePercent: new Decimal(0),
      }).toNumber()
    ).toBe(12);
  });

  test('no-discount (0%) equals full remaining years', () => {
    const required = getRequiredSafetyBufferMonths({
      age: 47,
      expectedFireAge: 47,
      legalRetirementAge: 64,
      baseSafetyBufferMonths: new Decimal(12),
      bridgeDiscountRatePercent: new Decimal(0),
    }).toNumber();

    // base 12 + (64-47)*12 = 216
    expect(required).toBe(216);
  });

  test('positive discount reduces requirement vs 0%', () => {
    const baseParams = {
      age: 47,
      expectedFireAge: 47,
      legalRetirementAge: 64,
      baseSafetyBufferMonths: new Decimal(12),
    };

    const req0 = getRequiredSafetyBufferMonths({
      ...baseParams,
      bridgeDiscountRatePercent: new Decimal(0),
    }).toNumber();
    const req1 = getRequiredSafetyBufferMonths({
      ...baseParams,
      bridgeDiscountRatePercent: new Decimal(1),
    }).toNumber();
    const req10 = getRequiredSafetyBufferMonths({
      ...baseParams,
      bridgeDiscountRatePercent: new Decimal(10),
    }).toNumber();

    expect(req1).toBeGreaterThan(12);
    expect(req1).toBeLessThan(req0);

    expect(req10).toBeGreaterThan(12);
    expect(req10).toBeLessThan(req1);
  });
});
