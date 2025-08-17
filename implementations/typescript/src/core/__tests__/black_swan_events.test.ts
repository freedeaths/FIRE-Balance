/**
 * Tests for Black Swan Events - Direct port from Python black swan event tests
 * Ensures identical behavior between TypeScript and Python implementations
 */

import Decimal from "decimal.js";
import {
  FinancialCrisisEvent,
  EconomicRecessionEvent,
  MarketCrashEvent,
  HyperinflationEvent,
  UnemploymentEvent,
  IndustryCollapseEvent,
  UnexpectedPromotionEvent,
  MajorIllnessEvent,
  LongTermCareEvent,
  RegionalConflictEvent,
  GlobalWarEvent,
  EconomicSanctionsEvent,
  EnergyCrisisEvent,
  InheritanceEvent,
  InvestmentWindfallEvent,
  createBlackSwanEvents,
} from "../black_swan_events";

import type { UserProfile } from "../data_models";
import { createUserProfile, getCurrentAge } from "../data_models";

describe("BlackSwanEventImplementations", () => {
  test("FinancialCrisisEvent properties", () => {
    const event = new FinancialCrisisEvent();

    expect(event.event_id).toBe("financial_crisis");
    expect(event.annual_probability.toNumber()).toBe(0.016);
    expect(event.duration_years).toBe(2);
    expect(event.recovery_factor.toNumber()).toBe(0.8);
    expect(event.age_range).toEqual([18, 100]);
    expect(event.income_impact.toNumber()).toBe(-0.4);
    expect(event.expense_impact.toNumber()).toBe(0.0);
  });

  test("EconomicRecessionEvent properties", () => {
    const event = new EconomicRecessionEvent();

    expect(event.event_id).toBe("economic_recession");
    expect(event.annual_probability.toNumber()).toBe(0.024);
    expect(event.duration_years).toBe(1);
    expect(event.recovery_factor.toNumber()).toBe(0.7);
    expect(event.age_range).toEqual([18, 100]);
    expect(event.income_impact.toNumber()).toBe(-0.25);
    expect(event.expense_impact.toNumber()).toBe(0.0);
  });

  test("MarketCrashEvent properties", () => {
    const event = new MarketCrashEvent();

    expect(event.event_id).toBe("market_crash");
    expect(event.annual_probability.toNumber()).toBe(0.012);
    expect(event.duration_years).toBe(1);
    expect(event.recovery_factor.toNumber()).toBe(0.6);
    expect(event.age_range).toEqual([18, 100]);
    expect(event.income_impact.toNumber()).toBe(-0.3);
    expect(event.expense_impact.toNumber()).toBe(0.0);
  });

  test("HyperinflationEvent properties", () => {
    const event = new HyperinflationEvent();

    expect(event.event_id).toBe("hyperinflation");
    expect(event.annual_probability.toNumber()).toBe(0.004);
    expect(event.duration_years).toBe(3);
    expect(event.recovery_factor.toNumber()).toBe(0.9);
    expect(event.age_range).toEqual([18, 100]);
    expect(event.income_impact.toNumber()).toBe(0.0);
    expect(event.expense_impact.toNumber()).toBe(0.5);
  });

  test("UnemploymentEvent properties", () => {
    const event = new UnemploymentEvent();

    expect(event.event_id).toBe("unemployment");
    expect(event.annual_probability.toNumber()).toBe(0.02);
    expect(event.duration_years).toBe(1);
    expect(event.recovery_factor.toNumber()).toBe(0.5);
    expect(event.age_range).toEqual([22, 65]);
    expect(event.income_impact.toNumber()).toBe(-0.8);
    expect(event.expense_impact.toNumber()).toBe(0.0);
  });

  test("IndustryCollapseEvent properties", () => {
    const event = new IndustryCollapseEvent();

    expect(event.event_id).toBe("industry_collapse");
    expect(event.annual_probability.toNumber()).toBe(0.008);
    expect(event.duration_years).toBe(3);
    expect(event.recovery_factor.toNumber()).toBe(0.7);
    expect(event.age_range).toEqual([25, 60]);
    expect(event.income_impact.toNumber()).toBe(-0.4);
    expect(event.expense_impact.toNumber()).toBe(0.0);
  });

  test("UnexpectedPromotionEvent properties", () => {
    const event = new UnexpectedPromotionEvent();

    expect(event.event_id).toBe("unexpected_promotion");
    expect(event.annual_probability.toNumber()).toBe(0.016);
    expect(event.duration_years).toBe(5);
    expect(event.recovery_factor.toNumber()).toBe(1.0);
    expect(event.age_range).toEqual([25, 55]);
    expect(event.income_impact.toNumber()).toBe(0.3);
    expect(event.expense_impact.toNumber()).toBe(0.0);
  });

  test("MajorIllnessEvent properties", () => {
    const event = new MajorIllnessEvent();

    expect(event.event_id).toBe("major_illness");
    expect(event.annual_probability.toNumber()).toBe(0.012);
    expect(event.duration_years).toBe(2);
    expect(event.recovery_factor.toNumber()).toBe(0.8);
    expect(event.age_range).toEqual([35, 100]);
    expect(event.income_impact.toNumber()).toBe(-0.3);
    expect(event.expense_impact.toNumber()).toBe(0.8);
  });

  test("LongTermCareEvent properties", () => {
    const event = new LongTermCareEvent();

    expect(event.event_id).toBe("long_term_care");
    expect(event.annual_probability.toNumber()).toBe(0.008);
    expect(event.duration_years).toBe(5);
    expect(event.recovery_factor.toNumber()).toBe(0.9);
    expect(event.age_range).toEqual([65, 100]);
    expect(event.income_impact.toNumber()).toBe(0.0);
    expect(event.expense_impact.toNumber()).toBe(1.2);
  });

  test("RegionalConflictEvent properties", () => {
    const event = new RegionalConflictEvent();

    expect(event.event_id).toBe("regional_conflict");
    expect(event.annual_probability.toNumber()).toBe(0.006);
    expect(event.duration_years).toBe(2);
    expect(event.recovery_factor.toNumber()).toBe(0.8);
    expect(event.age_range).toEqual([18, 100]);
    expect(event.income_impact.toNumber()).toBe(-0.2);
    expect(event.expense_impact.toNumber()).toBe(0.3);
  });

  test("GlobalWarEvent properties", () => {
    const event = new GlobalWarEvent();

    expect(event.event_id).toBe("global_war");
    expect(event.annual_probability.toNumber()).toBe(0.002);
    expect(event.duration_years).toBe(4);
    expect(event.recovery_factor.toNumber()).toBe(0.7);
    expect(event.age_range).toEqual([18, 100]);
    expect(event.income_impact.toNumber()).toBe(-0.5);
    expect(event.expense_impact.toNumber()).toBe(1.0);
  });

  test("EconomicSanctionsEvent properties", () => {
    const event = new EconomicSanctionsEvent();

    expect(event.event_id).toBe("economic_sanctions");
    expect(event.annual_probability.toNumber()).toBe(0.004);
    expect(event.duration_years).toBe(3);
    expect(event.recovery_factor.toNumber()).toBe(0.8);
    expect(event.age_range).toEqual([18, 100]);
    expect(event.income_impact.toNumber()).toBe(-0.15);
    expect(event.expense_impact.toNumber()).toBe(0.2);
  });

  test("EnergyCrisisEvent properties", () => {
    const event = new EnergyCrisisEvent();

    expect(event.event_id).toBe("energy_crisis");
    expect(event.annual_probability.toNumber()).toBe(0.01);
    expect(event.duration_years).toBe(2);
    expect(event.recovery_factor.toNumber()).toBe(0.9);
    expect(event.age_range).toEqual([18, 100]);
    expect(event.income_impact.toNumber()).toBe(0.0);
    expect(event.expense_impact.toNumber()).toBe(0.4);
  });

  test("InheritanceEvent properties", () => {
    const event = new InheritanceEvent();

    expect(event.event_id).toBe("inheritance");
    expect(event.annual_probability.toNumber()).toBe(0.006);
    expect(event.duration_years).toBe(1);
    expect(event.recovery_factor.toNumber()).toBe(1.0);
    expect(event.age_range).toEqual([30, 80]);
    expect(event.income_impact.toNumber()).toBe(2.0);
    expect(event.expense_impact.toNumber()).toBe(0.0);
  });

  test("InvestmentWindfallEvent properties", () => {
    const event = new InvestmentWindfallEvent();

    expect(event.event_id).toBe("investment_windfall");
    expect(event.annual_probability.toNumber()).toBe(0.004);
    expect(event.duration_years).toBe(1);
    expect(event.recovery_factor.toNumber()).toBe(1.0);
    expect(event.age_range).toEqual([25, 70]);
    expect(event.income_impact.toNumber()).toBe(1.5);
    expect(event.expense_impact.toNumber()).toBe(0.0);
  });
});

describe("CustomAgeRangeEvents", () => {
  test("events accept custom age ranges", () => {
    const customRange: [number, number] = [40, 60];

    const crisis = new FinancialCrisisEvent(customRange);
    expect(crisis.age_range).toEqual([40, 60]);

    const unemployment = new UnemploymentEvent(customRange);
    expect(unemployment.age_range).toEqual([40, 60]);

    const promotion = new UnexpectedPromotionEvent(customRange);
    expect(promotion.age_range).toEqual([40, 60]);
  });
});

describe("CreateBlackSwanEventsFactory", () => {
  let profile: UserProfile;

  beforeEach(() => {
    profile = createUserProfile({
      birth_year: 1990,
      expected_fire_age: 45,
      legal_retirement_age: 65,
      life_expectancy: 85,
      current_net_worth: new Decimal(50000.0),
      inflation_rate: new Decimal(3.0),
      safety_buffer_months: new Decimal(12.0),
    });
  });

  test("creates complete set of personalized events", () => {
    const events = createBlackSwanEvents(profile);

    // Should create exactly 15 events
    expect(events.length).toBe(15);

    // Should have all expected event types
    const event_ids = events.map((e) => e.event_id);
    const expected_ids = [
      "financial_crisis",
      "economic_recession",
      "market_crash",
      "hyperinflation",
      "unemployment",
      "industry_collapse",
      "unexpected_promotion",
      "major_illness",
      "long_term_care",
      "regional_conflict",
      "global_war",
      "economic_sanctions",
      "energy_crisis",
      "inheritance",
      "investment_windfall",
    ];

    for (const expected_id of expected_ids) {
      expect(event_ids).toContain(expected_id);
    }
  });

  test("personalizes age ranges based on user profile", () => {
    const events = createBlackSwanEvents(profile);
    const current_age = getCurrentAge(profile.birth_year);
    const fire_age = profile.expected_fire_age;
    const legal_retirement_age = profile.legal_retirement_age;
    const life_expectancy = profile.life_expectancy;

    // Check unemployment event has personalized working age range
    const unemployment = events.find((e) => e.event_id === "unemployment");
    expect(unemployment?.age_range[0]).toBe(Math.max(22, current_age));
    expect(unemployment?.age_range[1]).toBe(
      Math.min(fire_age, legal_retirement_age),
    );

    // Check major illness starts from appropriate age
    const major_illness = events.find((e) => e.event_id === "major_illness");
    expect(major_illness?.age_range[0]).toBe(Math.max(current_age, 35));
    expect(major_illness?.age_range[1]).toBe(life_expectancy);

    // Check long-term care for retirement period
    const long_term_care = events.find((e) => e.event_id === "long_term_care");
    expect(long_term_care?.age_range[0]).toBe(
      Math.max(current_age, legal_retirement_age),
    );
    expect(long_term_care?.age_range[1]).toBe(life_expectancy);

    // Check inheritance has reasonable age range
    const inheritance = events.find((e) => e.event_id === "inheritance");
    expect(inheritance?.age_range[0]).toBe(Math.max(current_age, 30));
    expect(inheritance?.age_range[1]).toBe(Math.min(life_expectancy, 80));
  });

  test("handles different user profile scenarios", () => {
    // Test older user profile
    const older_profile = createUserProfile({
      birth_year: 1970, // Currently ~55 years old
      expected_fire_age: 60,
      legal_retirement_age: 65,
      life_expectancy: 85,
      current_net_worth: new Decimal(200000.0),
      inflation_rate: new Decimal(3.0),
      safety_buffer_months: new Decimal(12.0),
    });

    const events = createBlackSwanEvents(older_profile);
    const older_current_age = getCurrentAge(older_profile.birth_year);

    // Unemployment should still be applicable for working years
    const unemployment = events.find((e) => e.event_id === "unemployment");
    expect(unemployment?.age_range[0]).toBe(Math.max(22, older_current_age));
    expect(unemployment?.age_range[1]).toBe(60); // FIRE age

    // Major illness should start from current age (already > 35)
    const major_illness = events.find((e) => e.event_id === "major_illness");
    expect(major_illness?.age_range[0]).toBe(older_current_age);
    expect(major_illness?.age_range[1]).toBe(85);
  });

  test("all events have valid properties", () => {
    const events = createBlackSwanEvents(profile);

    for (const event of events) {
      // Event ID should be non-empty string
      expect(typeof event.event_id).toBe("string");
      expect(event.event_id.length).toBeGreaterThan(0);

      // Probability should be between 0 and 1
      expect(event.annual_probability.toNumber()).toBeGreaterThanOrEqual(0);
      expect(event.annual_probability.toNumber()).toBeLessThanOrEqual(1);

      // Duration should be positive
      expect(event.duration_years).toBeGreaterThan(0);

      // Recovery factor should be between 0 and 1 (or exactly 1 for permanent benefits)
      expect(event.recovery_factor.toNumber()).toBeGreaterThan(0);
      expect(event.recovery_factor.toNumber()).toBeLessThanOrEqual(1);

      // Age range should be valid
      expect(event.age_range[0]).toBeLessThanOrEqual(event.age_range[1]);
      expect(event.age_range[0]).toBeGreaterThanOrEqual(0);
      expect(event.age_range[1]).toBeLessThanOrEqual(120);

      // Impact factors should be present if the event implements them
      if ("income_impact" in event) {
        expect((event as any).income_impact).toBeInstanceOf(Decimal);
      }
      if ("expense_impact" in event) {
        expect((event as any).expense_impact).toBeInstanceOf(Decimal);
      }
    }
  });
});

describe("EventCategorization", () => {
  let events: any[];

  beforeEach(() => {
    const profile = createUserProfile({
      birth_year: 1990,
      expected_fire_age: 45,
      legal_retirement_age: 65,
      life_expectancy: 85,
      current_net_worth: new Decimal(50000.0),
      inflation_rate: new Decimal(3.0),
      safety_buffer_months: new Decimal(12.0),
    });
    events = createBlackSwanEvents(profile);
  });

  test("identifies negative income events", () => {
    const negative_income_events = events.filter(
      (e) => "income_impact" in e && e.income_impact.lt(0),
    );

    expect(negative_income_events.length).toBeGreaterThan(5);

    const negative_event_ids = negative_income_events.map((e) => e.event_id);
    expect(negative_event_ids).toContain("financial_crisis");
    expect(negative_event_ids).toContain("unemployment");
    expect(negative_event_ids).toContain("major_illness");
  });

  test("identifies positive income events", () => {
    const positive_income_events = events.filter(
      (e) => "income_impact" in e && e.income_impact.gt(0),
    );

    expect(positive_income_events.length).toBe(3);

    const positive_event_ids = positive_income_events.map((e) => e.event_id);
    expect(positive_event_ids).toContain("unexpected_promotion");
    expect(positive_event_ids).toContain("inheritance");
    expect(positive_event_ids).toContain("investment_windfall");
  });

  test("identifies expense-increasing events", () => {
    const expense_events = events.filter(
      (e) => "expense_impact" in e && e.expense_impact.gt(0),
    );

    expect(expense_events.length).toBeGreaterThan(5);

    const expense_event_ids = expense_events.map((e) => e.event_id);
    expect(expense_event_ids).toContain("hyperinflation");
    expect(expense_event_ids).toContain("major_illness");
    expect(expense_event_ids).toContain("long_term_care");
    expect(expense_event_ids).toContain("energy_crisis");
  });

  test("categorizes events by severity", () => {
    // High severity events (>= 50% impact)
    const high_severity = events.filter(
      (e) =>
        ("income_impact" in e && e.income_impact.abs().gte(0.5)) ||
        ("expense_impact" in e && e.expense_impact.abs().gte(0.5)),
    );

    expect(high_severity.length).toBeGreaterThan(3);

    // Should include global war, unemployment, inheritance, etc.
    const high_severity_ids = high_severity.map((e) => e.event_id);
    expect(high_severity_ids).toContain("global_war");
    expect(high_severity_ids).toContain("unemployment");
    expect(high_severity_ids).toContain("inheritance");
  });
});
