/**
 * Black Swan Events for Monte Carlo simulation
 * Direct TypeScript port from Python black_swan_events.py
 *
 * This module provides concrete implementations of black swan events
 * that can be applied to financial projections for risk analysis.
 */

import Decimal from 'decimal.js';
import type { BlackSwanEvent, UserProfile } from './data_models';
import { getCurrentAge } from './data_models';

// =============================================================================
// Concrete Black Swan Event Implementations
// =============================================================================

/**
 * Major financial crisis affecting portfolio returns
 * Direct port of Python's FinancialCrisisEvent
 */
export class FinancialCrisisEvent implements BlackSwanEvent {
  event_id = 'financial_crisis';
  annual_probability = new Decimal(0.016);  // 1.6% annual probability
  duration_years = 2;
  recovery_factor = new Decimal(0.8);
  age_range: [number, number];

  // Impact factors for income/expense
  income_impact = new Decimal(-0.4);  // -40% income impact
  expense_impact = new Decimal(0.0);  // No expense impact

  constructor(age_range: [number, number] = [18, 100]) {
    this.age_range = age_range;
  }
}

/**
 * Economic recession with moderate portfolio impact
 * Direct port of Python's EconomicRecessionEvent
 */
export class EconomicRecessionEvent implements BlackSwanEvent {
  event_id = 'economic_recession';
  annual_probability = new Decimal(0.024);  // 2.4% annual probability
  duration_years = 1;
  recovery_factor = new Decimal(0.7);
  age_range: [number, number];

  income_impact = new Decimal(-0.25);  // -25% income impact
  expense_impact = new Decimal(0.0);

  constructor(age_range: [number, number] = [18, 100]) {
    this.age_range = age_range;
  }
}

/**
 * Market crash with significant portfolio impact
 * Direct port of Python's MarketCrashEvent
 */
export class MarketCrashEvent implements BlackSwanEvent {
  event_id = 'market_crash';
  annual_probability = new Decimal(0.012);  // 1.2% annual probability
  duration_years = 1;
  recovery_factor = new Decimal(0.6);
  age_range: [number, number];

  income_impact = new Decimal(-0.3);  // -30% income impact
  expense_impact = new Decimal(0.0);

  constructor(age_range: [number, number] = [18, 100]) {
    this.age_range = age_range;
  }
}

/**
 * Hyperinflation event with expense impact
 * Direct port of Python's HyperinflationEvent
 */
export class HyperinflationEvent implements BlackSwanEvent {
  event_id = 'hyperinflation';
  annual_probability = new Decimal(0.004);  // 0.4% annual probability
  duration_years = 3;
  recovery_factor = new Decimal(0.9);
  age_range: [number, number];

  income_impact = new Decimal(0.0);
  expense_impact = new Decimal(0.5);  // +50% expense impact

  constructor(age_range: [number, number] = [18, 100]) {
    this.age_range = age_range;
  }
}

/**
 * Unemployment event during working years
 * Direct port of Python's UnemploymentEvent
 */
export class UnemploymentEvent implements BlackSwanEvent {
  event_id = 'unemployment';
  annual_probability = new Decimal(0.02);  // 2% annual probability
  duration_years = 1;
  recovery_factor = new Decimal(0.5);
  age_range: [number, number];

  income_impact = new Decimal(-0.8);  // -80% income impact (severe)
  expense_impact = new Decimal(0.0);

  constructor(age_range: [number, number] = [22, 65]) {
    this.age_range = age_range;
  }
}

/**
 * Industry collapse affecting career
 * Direct port of Python's IndustryCollapseEvent
 */
export class IndustryCollapseEvent implements BlackSwanEvent {
  event_id = 'industry_collapse';
  annual_probability = new Decimal(0.008);  // 0.8% annual probability
  duration_years = 3;
  recovery_factor = new Decimal(0.7);
  age_range: [number, number];

  income_impact = new Decimal(-0.4);  // -40% income impact
  expense_impact = new Decimal(0.0);

  constructor(age_range: [number, number] = [25, 60]) {
    this.age_range = age_range;
  }
}

/**
 * Unexpected promotion with income boost
 * Direct port of Python's UnexpectedPromotionEvent
 */
export class UnexpectedPromotionEvent implements BlackSwanEvent {
  event_id = 'unexpected_promotion';
  annual_probability = new Decimal(0.016);  // 1.6% annual probability
  duration_years = 5;
  recovery_factor = new Decimal(1.0);  // Permanent benefit
  age_range: [number, number];

  income_impact = new Decimal(0.3);  // +30% income boost
  expense_impact = new Decimal(0.0);

  constructor(age_range: [number, number] = [25, 55]) {
    this.age_range = age_range;
  }
}

/**
 * Major illness with medical expenses
 * Direct port of Python's MajorIllnessEvent
 */
export class MajorIllnessEvent implements BlackSwanEvent {
  event_id = 'major_illness';
  annual_probability = new Decimal(0.012);  // 1.2% annual probability
  duration_years = 2;
  recovery_factor = new Decimal(0.8);
  age_range: [number, number];

  income_impact = new Decimal(-0.3);  // -30% income impact
  expense_impact = new Decimal(0.8);  // +80% expense impact

  constructor(age_range: [number, number] = [35, 100]) {
    this.age_range = age_range;
  }
}

/**
 * Long-term care expenses
 * Direct port of Python's LongTermCareEvent
 */
export class LongTermCareEvent implements BlackSwanEvent {
  event_id = 'long_term_care';
  annual_probability = new Decimal(0.008);  // 0.8% annual probability
  duration_years = 5;
  recovery_factor = new Decimal(0.9);
  age_range: [number, number];

  income_impact = new Decimal(0.0);
  expense_impact = new Decimal(1.2);  // +120% expense impact

  constructor(age_range: [number, number] = [65, 100]) {
    this.age_range = age_range;
  }
}

/**
 * Regional conflict affecting economy
 * Direct port of Python's RegionalConflictEvent
 */
export class RegionalConflictEvent implements BlackSwanEvent {
  event_id = 'regional_conflict';
  annual_probability = new Decimal(0.006);  // 0.6% annual probability
  duration_years = 2;
  recovery_factor = new Decimal(0.8);
  age_range: [number, number];

  income_impact = new Decimal(-0.2);  // -20% income impact
  expense_impact = new Decimal(0.3);  // +30% expense impact

  constructor(age_range: [number, number] = [18, 100]) {
    this.age_range = age_range;
  }
}

/**
 * Global war with severe economic impact
 * Direct port of Python's GlobalWarEvent
 */
export class GlobalWarEvent implements BlackSwanEvent {
  event_id = 'global_war';
  annual_probability = new Decimal(0.002);  // 0.2% annual probability
  duration_years = 4;
  recovery_factor = new Decimal(0.7);
  age_range: [number, number];

  income_impact = new Decimal(-0.5);  // -50% income impact
  expense_impact = new Decimal(1.0);  // +100% expense impact

  constructor(age_range: [number, number] = [18, 100]) {
    this.age_range = age_range;
  }
}

/**
 * Economic sanctions affecting market
 * Direct port of Python's EconomicSanctionsEvent
 */
export class EconomicSanctionsEvent implements BlackSwanEvent {
  event_id = 'economic_sanctions';
  annual_probability = new Decimal(0.004);  // 0.4% annual probability
  duration_years = 3;
  recovery_factor = new Decimal(0.8);
  age_range: [number, number];

  income_impact = new Decimal(-0.15);  // -15% income impact
  expense_impact = new Decimal(0.2);  // +20% expense impact

  constructor(age_range: [number, number] = [18, 100]) {
    this.age_range = age_range;
  }
}

/**
 * Energy crisis affecting costs
 * Direct port of Python's EnergyCrisisEvent
 */
export class EnergyCrisisEvent implements BlackSwanEvent {
  event_id = 'energy_crisis';
  annual_probability = new Decimal(0.01);  // 1% annual probability
  duration_years = 2;
  recovery_factor = new Decimal(0.9);
  age_range: [number, number];

  income_impact = new Decimal(0.0);
  expense_impact = new Decimal(0.4);  // +40% expense impact

  constructor(age_range: [number, number] = [18, 100]) {
    this.age_range = age_range;
  }
}

/**
 * Inheritance windfall
 * Direct port of Python's InheritanceEvent
 */
export class InheritanceEvent implements BlackSwanEvent {
  event_id = 'inheritance';
  annual_probability = new Decimal(0.006);  // 0.6% annual probability
  duration_years = 1;
  recovery_factor = new Decimal(1.0);  // One-time benefit
  age_range: [number, number];

  income_impact = new Decimal(2.0);  // +200% income boost (one-time)
  expense_impact = new Decimal(0.0);

  constructor(age_range: [number, number] = [30, 80]) {
    this.age_range = age_range;
  }
}

/**
 * Investment windfall
 * Direct port of Python's InvestmentWindfallEvent
 */
export class InvestmentWindfallEvent implements BlackSwanEvent {
  event_id = 'investment_windfall';
  annual_probability = new Decimal(0.004);  // 0.4% annual probability
  duration_years = 1;
  recovery_factor = new Decimal(1.0);  // One-time benefit
  age_range: [number, number];

  income_impact = new Decimal(1.5);  // +150% income boost (one-time)
  expense_impact = new Decimal(0.0);

  constructor(age_range: [number, number] = [25, 70]) {
    this.age_range = age_range;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create personalized black swan events based on user profile
 * Direct port of Python's create_black_swan_events function
 */
export function createBlackSwanEvents(user_profile: UserProfile): BlackSwanEvent[] {
  const current_age = getCurrentAge(user_profile.birth_year);
  const fire_age = user_profile.expected_fire_age;
  const legal_retirement_age = user_profile.legal_retirement_age;
  const life_expectancy = user_profile.life_expectancy;

  // Define working period and retirement period
  const working_start = Math.max(22, current_age);  // Start from current age or 22
  const working_end = Math.min(fire_age, legal_retirement_age);  // End at FIRE or legal retirement
  const retirement_end = life_expectancy;

  return [
    // Economic and financial crisis events
    new FinancialCrisisEvent([18, 100]),
    new EconomicRecessionEvent([18, 100]),
    new MarketCrashEvent([18, 100]),
    new HyperinflationEvent([18, 100]),

    // Career and employment events
    new UnemploymentEvent([working_start, working_end]),
    new IndustryCollapseEvent([working_start, Math.min(working_end + 5, 65)]),
    new UnexpectedPromotionEvent([working_start, Math.min(working_end, 55)]),

    // Health and care events
    new MajorIllnessEvent([Math.max(current_age, 35), life_expectancy]),
    new LongTermCareEvent([Math.max(current_age, legal_retirement_age), life_expectancy]),

    // Geopolitical events
    new RegionalConflictEvent([18, 100]),
    new GlobalWarEvent([18, 100]),
    new EconomicSanctionsEvent([18, 100]),
    new EnergyCrisisEvent([18, 100]),

    // Positive events
    new InheritanceEvent([Math.max(current_age, 30), Math.min(life_expectancy, 80)]),
    new InvestmentWindfallEvent([Math.max(current_age, 25), Math.min(life_expectancy, 70)]),
  ];
}
