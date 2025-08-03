"""Test cases for advisor consistency bug fix.

This module contains tests to ensure the FIRE advisor gives consistent
recommendations across different scenarios, specifically addressing the
bug where early retirement suggestions were unrealistically optimistic
due to using incorrect income projections.
"""

from typing import List, Tuple

import pytest

from core.advisor import FIREAdvisor
from core.data_models import IncomeExpenseItem, ItemFrequency, TimeUnit, UserProfile
from core.engine import EngineInput
from core.planner import FIREPlanner


class TestAdvisorConsistency:
    """Test cases for advisor consistency across different scenarios."""

    @pytest.fixture
    def base_profile(self) -> UserProfile:
        """Create base user profile for testing."""
        return UserProfile(
            birth_year=1995,  # Age 29 in 2024
            expected_fire_age=55,
            legal_retirement_age=65,
            current_net_worth=0,
            inflation_rate=3.0,
            safety_buffer_months=6,
        )

    @pytest.fixture
    def income_items_default(self) -> List[IncomeExpenseItem]:
        """Income items with salary ending at default retirement age (55)."""
        return [
            IncomeExpenseItem(
                name="Salary",
                after_tax_amount_per_period=120000,
                time_unit=TimeUnit.ANNUALLY,
                frequency=ItemFrequency.RECURRING,
                start_age=29,
                end_age=55,  # Original target retirement age
                annual_growth_rate=2.0,
                is_income=True,
            )
        ]

    @pytest.fixture
    def income_items_early(self) -> List[IncomeExpenseItem]:
        """Income items with salary ending at early retirement age (35)."""
        return [
            IncomeExpenseItem(
                name="Salary",
                after_tax_amount_per_period=120000,
                time_unit=TimeUnit.ANNUALLY,
                frequency=ItemFrequency.RECURRING,
                start_age=29,
                end_age=35,  # Early target retirement age
                annual_growth_rate=2.0,
                is_income=True,
            )
        ]

    @pytest.fixture
    def expense_items(self) -> List[IncomeExpenseItem]:
        """Low expense items to ensure high savings rate for testing."""
        return [
            IncomeExpenseItem(
                name="Living Expenses",
                after_tax_amount_per_period=10000,  # Deliberately low for testing
                time_unit=TimeUnit.ANNUALLY,
                frequency=ItemFrequency.RECURRING,
                start_age=29,
                end_age=100,
                annual_growth_rate=0.0,
                is_income=False,
            )
        ]

    def create_planner_and_advisor(
        self,
        profile: UserProfile,
        income_items: List[IncomeExpenseItem],
        expense_items: List[IncomeExpenseItem],
    ) -> Tuple[FIREPlanner, FIREAdvisor, EngineInput]:
        """Helper method to create planner and advisor with given items."""
        planner = FIREPlanner()
        planner.set_user_profile(profile)

        for item in income_items:
            planner.add_income_item(item)
        for item in expense_items:
            planner.add_expense_item(item)

        planner.generate_projection_table()

        # Get projection data
        detailed_df = planner.get_projection_with_overrides()
        annual_df = planner._create_annual_summary_from_df(detailed_df)

        # Create advisor
        engine_input = EngineInput(
            user_profile=profile,
            annual_financial_projection=annual_df,
            detailed_projection=detailed_df,
            income_items=income_items,
        )

        advisor = FIREAdvisor(engine_input)

        return planner, advisor, engine_input

    def test_advisor_consistency_bug_fix(
        self,
        base_profile: UserProfile,
        income_items_default: List[IncomeExpenseItem],
        income_items_early: List[IncomeExpenseItem],
        expense_items: List[IncomeExpenseItem],
    ) -> None:
        """Test that advisor gives consistent recommendations across scenarios.

        This test addresses the bug where the advisor would suggest unrealistic
        early retirement ages when testing with the default scenario, but give
        realistic suggestions when the user manually sets the same target age.

        The bug was caused by the advisor using original income projections
        (where salary continues to original retirement age) when testing early
        retirement scenarios, instead of properly truncating income streams.
        """
        # Scenario 1: Default target age 55, salary ends at 55
        profile1 = base_profile.model_copy()
        profile1.expected_fire_age = 55

        planner1, advisor1, _ = self.create_planner_and_advisor(
            profile1, income_items_default, expense_items
        )

        recommendations1 = advisor1.get_all_recommendations()

        # Scenario 2: Target age 35, salary ends at 35
        profile2 = base_profile.model_copy()
        profile2.expected_fire_age = 35

        planner2, advisor2, _ = self.create_planner_and_advisor(
            profile2, income_items_early, expense_items
        )

        recommendations2 = advisor2.get_all_recommendations()

        # Both scenarios should suggest similar optimal retirement ages
        # because the financial constraints are essentially the same

        # Extract early retirement recommendation from scenario 1
        early_retirement_rec = None
        for rec in recommendations1:
            if rec.type == "early_retirement":
                early_retirement_rec = rec
                break

        # Extract delayed retirement recommendation from scenario 2
        delayed_retirement_rec = None
        for rec in recommendations2:
            if rec.type == "delayed_retirement":
                delayed_retirement_rec = rec
                break

        # Verify we have the expected recommendation types
        assert (
            early_retirement_rec is not None
        ), "Should suggest early retirement for scenario 1"
        assert (
            delayed_retirement_rec is not None
        ), "Should suggest delayed retirement for scenario 2"

        # Extract suggested ages
        suggested_age_1 = early_retirement_rec.params["age"]
        suggested_age_2 = delayed_retirement_rec.params["age"]

        # The suggestions should be very close (within 1-2 years)
        # This verifies that the advisor is now using consistent logic
        age_difference = abs(suggested_age_1 - suggested_age_2)
        assert age_difference <= 2, (
            f"Advisor suggestions are inconsistent: scenario 1 suggests age "
            f"{suggested_age_1}, scenario 2 suggests age {suggested_age_2}. "
            f"Difference: {age_difference} years"
        )

        # Additional verification: suggested ages should be reasonable
        # (not too early like the bug where it suggested age 29)
        msg1 = f"Suggested retirement age {suggested_age_1} is unrealistically early"
        assert suggested_age_1 >= 35, msg1
        msg2 = f"Suggested retirement age {suggested_age_2} is unrealistically early"
        assert suggested_age_2 >= 35, msg2

        # Success rates should also be reasonable (not 99%+ which was unrealistic)
        if (
            hasattr(early_retirement_rec, "monte_carlo_success_rate")
            and early_retirement_rec.monte_carlo_success_rate
        ):
            success_rate = early_retirement_rec.monte_carlo_success_rate
            assert (
                success_rate < 0.95
            ), f"Success rate {success_rate:.1%} seems unrealistically high"

    def test_income_truncation_logic(
        self,
        base_profile: UserProfile,
        income_items_default: List[IncomeExpenseItem],
        expense_items: List[IncomeExpenseItem],
    ) -> None:
        """Test that income is properly truncated when testing early retirement."""
        profile = base_profile.model_copy()
        profile.expected_fire_age = 55

        _, advisor, _ = self.create_planner_and_advisor(
            profile, income_items_default, expense_items
        )

        # Test the internal truncation method
        original_projection = advisor.detailed_projection_df
        truncated_projection = advisor._truncate_work_income_to_age(35)

        # Verify that income is truncated after age 35
        salary_at_35 = truncated_projection[truncated_projection["age"] == 35][
            "Salary"
        ].iloc[0]
        salary_at_36 = truncated_projection[truncated_projection["age"] == 36][
            "Salary"
        ].iloc[0]

        assert salary_at_35 > 0, "Salary should be non-zero at retirement age"
        assert salary_at_36 == 0, "Salary should be zero after retirement age"

        # Verify original projection is unchanged
        original_salary_at_36 = original_projection[original_projection["age"] == 36][
            "Salary"
        ].iloc[0]
        assert original_salary_at_36 > 0, "Original projection should be unchanged"

    def test_edge_case_current_age_retirement(
        self,
        base_profile: UserProfile,
        income_items_default: List[IncomeExpenseItem],
        expense_items: List[IncomeExpenseItem],
    ) -> None:
        """Test edge case where target retirement age equals current age."""
        profile = base_profile.model_copy()
        profile.expected_fire_age = 29  # Same as current age

        planner, advisor, _ = self.create_planner_and_advisor(
            profile, income_items_default, expense_items
        )

        # Should not crash and should provide reasonable recommendations
        recommendations = advisor.get_all_recommendations()
        assert isinstance(
            recommendations, list
        ), "Should return a list of recommendations"

        # If early retirement is not feasible, should suggest alternatives
        if recommendations:
            # Verify that any age-based recommendations are reasonable
            for rec in recommendations:
                if "age" in rec.params:
                    suggested_age = rec.params["age"]
                    error_msg = (
                        f"Suggested age {suggested_age} cannot be earlier than "
                        f"current age {profile.current_age}"
                    )
                    assert suggested_age >= profile.current_age, error_msg

    def test_no_work_income_scenario(
        self, base_profile: UserProfile, expense_items: List[IncomeExpenseItem]
    ) -> None:
        """Test scenario with no work income (e.g., already retired)."""
        # Create scenario with only passive income
        passive_income_items = [
            IncomeExpenseItem(
                name="Investment Income",
                after_tax_amount_per_period=50000,
                time_unit=TimeUnit.ANNUALLY,
                frequency=ItemFrequency.RECURRING,
                start_age=29,
                end_age=100,  # Continues indefinitely
                annual_growth_rate=0.0,
                is_income=True,
            )
        ]

        profile = base_profile.model_copy()
        profile.expected_fire_age = 35

        planner, advisor, _ = self.create_planner_and_advisor(
            profile, passive_income_items, expense_items
        )

        # Should not crash when no work income to truncate
        recommendations = advisor.get_all_recommendations()
        assert isinstance(
            recommendations, list
        ), "Should handle no work income scenario gracefully"
