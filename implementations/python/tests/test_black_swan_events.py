#!/usr/bin/env python3
"""
Test suite for black swan events implementation.
Tests the refactored self-contained black swan event classes.
"""

import unittest

import pandas as pd

from core.black_swan_events import (
    EconomicRecessionEvent,
    EconomicSanctionsEvent,
    EnergyCrisisEvent,
    FinancialCrisisEvent,
    GlobalWarEvent,
    HyperinflationEvent,
    IndustryCollapseEvent,
    InheritanceEvent,
    InvestmentWindfallEvent,
    LongTermCareEvent,
    MajorIllnessEvent,
    MarketCrashEvent,
    RegionalConflictEvent,
    UnemploymentEvent,
    UnexpectedPromotionEvent,
    create_black_swan_events,
)
from core.data_models import UserProfile


class TestBlackSwanEventStructure(unittest.TestCase):
    """Test the basic structure and properties of black swan events."""

    def setUp(self) -> None:
        """Set up test fixtures."""
        self.test_df = pd.DataFrame(
            {"total_income": [100000.0, 100000.0], "total_expense": [50000.0, 50000.0]}
        )

    def test_event_initialization(self) -> None:
        """Test that events can be initialized with correct properties."""
        event = FinancialCrisisEvent(age_range=(25, 65))

        self.assertEqual(event.event_id, "financial_crisis")
        self.assertEqual(event.annual_probability, 0.016)
        self.assertEqual(event.duration_years, 2)
        self.assertEqual(event.recovery_factor, 0.8)
        self.assertEqual(event.age_range, (25, 65))

    def test_event_display_name(self) -> None:
        """Test event display name functionality."""
        event = FinancialCrisisEvent()

        # Test fallback to event_id
        self.assertEqual(event.get_display_name(), "financial_crisis")

        # Test with i18n function
        def mock_i18n(key: str) -> str:
            if key == "events.financial_crisis.name":
                return "Financial Crisis"
            return key

        self.assertEqual(event.get_display_name(mock_i18n), "Financial Crisis")

    def test_all_event_types_can_be_created(self) -> None:
        """Test that all event types can be instantiated."""
        event_classes = [
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
        ]

        for event_class in event_classes:
            event = event_class()  # type: ignore
            self.assertIsInstance(event.event_id, str)
            self.assertGreater(len(event.event_id), 0)
            self.assertGreater(event.annual_probability, 0)
            self.assertGreater(event.duration_years, 0)
            self.assertGreaterEqual(event.recovery_factor, 0)
            self.assertLessEqual(event.recovery_factor, 1)


class TestEventImpactCalculations(unittest.TestCase):
    """Test the impact calculations for different event types."""

    def setUp(self) -> None:
        """Set up test fixtures."""
        self.test_df = pd.DataFrame(
            {"total_income": [100000.0], "total_expense": [50000.0]}
        )

    def test_portfolio_return_events(self) -> None:
        """Test events that affect portfolio returns."""
        # Test financial crisis
        crisis = FinancialCrisisEvent()
        result_df = crisis.apply_impact(self.test_df.copy(), 0, recovery_multiplier=1.0)

        expected_income = 100000 * 0.6  # -40% impact
        self.assertAlmostEqual(
            result_df.iloc[0]["total_income"], expected_income, places=0
        )
        self.assertEqual(result_df.iloc[0]["total_expense"], 50000.0)  # Unchanged

    def test_income_events(self) -> None:
        """Test events that specifically affect income."""
        # Test unemployment
        unemployment = UnemploymentEvent()
        result_df = unemployment.apply_impact(
            self.test_df.copy(), 0, recovery_multiplier=1.0
        )

        # Unemployment: max(0.1, 1 + (-1.0 * 1.0)) = max(0.1, 0) = 0.1
        expected_income = 100000 * 0.1
        self.assertAlmostEqual(
            result_df.iloc[0]["total_income"], expected_income, places=0
        )

        # Test promotion
        result_df = UnexpectedPromotionEvent().apply_impact(
            self.test_df.copy(), 0, recovery_multiplier=1.0
        )

        expected_income = 100000 * 1.3  # +30% impact
        self.assertAlmostEqual(
            result_df.iloc[0]["total_income"], expected_income, places=0
        )

    def test_expense_events(self) -> None:
        """Test events that affect expenses."""
        illness = MajorIllnessEvent()
        result_df = illness.apply_impact(
            self.test_df.copy(), 0, recovery_multiplier=1.0
        )

        expected_expense = 50000 * 2.5  # +150% impact
        self.assertAlmostEqual(
            result_df.iloc[0]["total_expense"], expected_expense, places=0
        )
        self.assertEqual(result_df.iloc[0]["total_income"], 100000.0)  # Unchanged

    def test_mixed_events(self) -> None:
        """Test events that affect both income and expenses."""
        hyperinflation = HyperinflationEvent()
        result_df = hyperinflation.apply_impact(
            self.test_df.copy(), 0, recovery_multiplier=1.0
        )

        expected_income = 100000 * 0.7  # -30% impact
        expected_expense = 50000 * 1.3  # +30% impact

        self.assertAlmostEqual(
            result_df.iloc[0]["total_income"], expected_income, places=0
        )
        self.assertAlmostEqual(
            result_df.iloc[0]["total_expense"], expected_expense, places=0
        )

    def test_inheritance_special_case(self) -> None:
        """Test inheritance event uses addition, not multiplication."""
        inheritance = InheritanceEvent()
        result_df = inheritance.apply_impact(
            self.test_df.copy(), 0, recovery_multiplier=1.0
        )

        # Inheritance adds 2x current income as lump sum
        expected_income = 100000 + (2.0 * 100000)  # Addition, not multiplication
        self.assertAlmostEqual(
            result_df.iloc[0]["total_income"], expected_income, places=0
        )

    def test_recovery_multiplier_effect(self) -> None:
        """Test that recovery_multiplier properly reduces impact."""
        crisis = FinancialCrisisEvent()

        # Full impact
        result_full = crisis.apply_impact(
            self.test_df.copy(), 0, recovery_multiplier=1.0
        )
        full_income = result_full.iloc[0]["total_income"]

        # Recovered impact
        result_recovered = crisis.apply_impact(
            self.test_df.copy(), 0, recovery_multiplier=0.8
        )
        recovered_income = result_recovered.iloc[0]["total_income"]

        # Recovered should be less severe than full impact
        self.assertGreater(recovered_income, full_income)

        # Check specific calculation: 100000 * (1 + (-0.4 * 0.8)) = 100000 * 0.68
        expected_recovered = 100000 * 0.68
        self.assertAlmostEqual(recovered_income, expected_recovered, places=0)


class TestPersonalizedEventCreation(unittest.TestCase):
    """Test the creation of personalized black swan events."""

    def setUp(self) -> None:
        """Set up test fixtures."""
        self.profile = UserProfile(
            birth_year=1990,  # Age 35 in 2025
            expected_fire_age=45,
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=50000.0,
            inflation_rate=3.0,
            safety_buffer_months=12.0,
        )

    def test_create_personalized_events(self) -> None:
        """Test that personalized events are created correctly."""
        events = create_black_swan_events(self.profile)

        # Should create 15 events
        self.assertEqual(len(events), 15)

        # All events should have unique event_ids
        event_ids = [e.event_id for e in events]
        self.assertEqual(len(event_ids), len(set(event_ids)))

        # Check specific event categories are present
        expected_categories = {
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
        }
        actual_categories = set(event_ids)
        self.assertEqual(expected_categories, actual_categories)

    def test_age_range_customization(self) -> None:
        """Test that age ranges are properly customized for user profile."""
        events = create_black_swan_events(self.profile)
        current_age = self.profile.current_age

        # Find career-related events (should be limited to working years)
        unemployment = next(e for e in events if e.event_id == "unemployment")
        unexpected_promotion = next(
            e for e in events if e.event_id == "unexpected_promotion"
        )

        # Career-related events should be limited to current age -> expected FIRE age
        career_start = current_age
        career_end = self.profile.expected_fire_age
        self.assertEqual(unemployment.age_range[0], career_start)
        self.assertEqual(unemployment.age_range[1], career_end)
        self.assertEqual(unexpected_promotion.age_range[0], career_start)
        self.assertEqual(unexpected_promotion.age_range[1], career_end)

        # Long-term care should be limited to retirement period
        long_term_care = next(e for e in events if e.event_id == "long_term_care")
        self.assertEqual(long_term_care.age_range[0], self.profile.legal_retirement_age)
        self.assertEqual(long_term_care.age_range[1], self.profile.life_expectancy)

        # Financial crisis should affect entire adult life
        financial_crisis = next(e for e in events if e.event_id == "financial_crisis")
        working_start = max(22, current_age)
        self.assertEqual(financial_crisis.age_range[0], working_start)
        self.assertEqual(financial_crisis.age_range[1], self.profile.life_expectancy)

    def test_different_user_profiles_create_different_ranges(self) -> None:
        """Test that different profiles create different age ranges."""
        # Young user
        young_profile = UserProfile(
            birth_year=2000,  # Age 25
            expected_fire_age=40,
            legal_retirement_age=67,
            life_expectancy=90,
            current_net_worth=10000.0,
            inflation_rate=3.0,
            safety_buffer_months=12.0,
        )
        young_events = create_black_swan_events(young_profile)

        # Older user
        old_profile = UserProfile(
            birth_year=1970,  # Age 55
            expected_fire_age=60,
            legal_retirement_age=67,
            life_expectancy=85,
            current_net_worth=100000.0,
            inflation_rate=3.0,
            safety_buffer_months=12.0,
        )
        old_events = create_black_swan_events(old_profile)

        # Compare unemployment events
        young_unemployment = next(
            e for e in young_events if e.event_id == "unemployment"
        )
        old_unemployment = next(e for e in old_events if e.event_id == "unemployment")

        # Different age ranges
        self.assertNotEqual(young_unemployment.age_range, old_unemployment.age_range)
        self.assertEqual(young_unemployment.age_range[0], young_profile.current_age)
        self.assertEqual(old_unemployment.age_range[0], old_profile.current_age)


class TestEventUniqueIds(unittest.TestCase):
    """Test that all events have unique, stable IDs for i18n."""

    def test_event_id_uniqueness(self) -> None:
        """Test that all event IDs are unique."""
        profile = UserProfile(
            birth_year=1990,
            expected_fire_age=45,
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=50000.0,
            inflation_rate=3.0,
            safety_buffer_months=12.0,
        )
        events = create_black_swan_events(profile)

        event_ids = [e.event_id for e in events]
        self.assertEqual(
            len(event_ids),
            len(set(event_ids)),
            f"Duplicate event IDs found: {event_ids}",
        )

    def test_event_id_stability(self) -> None:
        """Test that event IDs are stable across multiple creations."""
        profile = UserProfile(
            birth_year=1990,
            expected_fire_age=45,
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=50000.0,
            inflation_rate=3.0,
            safety_buffer_months=12.0,
        )

        events1 = create_black_swan_events(profile)
        events2 = create_black_swan_events(profile)

        ids1 = sorted([e.event_id for e in events1])
        ids2 = sorted([e.event_id for e in events2])

        self.assertEqual(ids1, ids2, "Event IDs should be stable across creations")

    def test_event_id_format(self) -> None:
        """Test that event IDs follow expected naming convention."""
        profile = UserProfile(
            birth_year=1990,
            expected_fire_age=45,
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=50000.0,
            inflation_rate=3.0,
            safety_buffer_months=12.0,
        )
        events = create_black_swan_events(profile)

        for event in events:
            # Should be lowercase with underscores
            self.assertRegex(
                event.event_id,
                r"^[a-z_]+$",
                f"Event ID '{event.event_id}' should be lowercase with underscores",
            )

            # Should not be empty
            self.assertGreater(len(event.event_id), 0)

            # Should not start or end with underscore
            self.assertFalse(event.event_id.startswith("_"))
            self.assertFalse(event.event_id.endswith("_"))


if __name__ == "__main__":
    unittest.main()
