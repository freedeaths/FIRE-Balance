#!/usr/bin/env python3
"""Test cases for delayed retirement recommendations in FIRE advisor."""

from datetime import datetime

import pandas as pd
import pytest

from core.advisor import DelayedRetirementRecommendation, FIREAdvisor
from core.data_models import (
    AssetClass,
    IncomeExpenseItem,
    PortfolioConfiguration,
    UserProfile,
)
from core.engine import EngineInput


class TestDelayedRetirementRecommendation:
    """Test delayed retirement recommendation logic."""

    def _create_detailed_projection_and_items(
        self, user_profile: UserProfile, annual_projection: pd.DataFrame
    ) -> tuple[pd.DataFrame, list[IncomeExpenseItem], list[IncomeExpenseItem]]:
        """Create detailed projection and income/expense items for testing."""
        from core.data_models import IncomeExpenseItem

        # Create sample income and expense items
        income_items = [
            IncomeExpenseItem(
                name="Work Income",
                after_tax_amount_per_period=30000,  # Match the low income in projection
                start_age=user_profile.current_age,
                end_age=user_profile.expected_fire_age,
                annual_growth_rate=0.0,
                is_income=True,
                category="Employment",
            )
        ]

        # Create detailed projection with individual columns
        detailed_projection = annual_projection[["age", "year"]].copy()
        detailed_projection["Work Income"] = annual_projection["total_income"]

        return detailed_projection, income_items, []

    @pytest.fixture
    def base_profile(self) -> UserProfile:
        """Create a base user profile for testing."""
        return UserProfile(
            birth_year=1990,
            expected_fire_age=50,
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=100000,
            inflation_rate=3.0,
            safety_buffer_months=12.0,
            portfolio=PortfolioConfiguration(
                asset_classes=[
                    AssetClass(
                        name="stocks",
                        display_name="Stocks",
                        allocation_percentage=60.0,
                        expected_return=7.0,
                        volatility=15.0,
                    ),
                    AssetClass(
                        name="bonds",
                        display_name="Bonds",
                        allocation_percentage=30.0,
                        expected_return=3.0,
                        volatility=5.0,
                    ),
                    AssetClass(
                        name="cash",
                        display_name="Cash",
                        allocation_percentage=10.0,
                        expected_return=1.0,
                        volatility=0.5,
                    ),
                ]
            ),
        )

    @pytest.fixture
    def insufficient_projection(self) -> pd.DataFrame:
        """Create a projection that cannot achieve FIRE at expected age."""
        current_year = datetime.now().year
        ages = list(range(35, 86))
        years = [current_year + (age - 35) for age in ages]

        data = []
        for age, year in zip(ages, years):
            # Work income until age 50, pension from 65
            if 35 <= age <= 50:
                income = 30000  # Very low income to ensure FIRE not achievable
            elif age >= 65:
                income = 15000  # Low pension
            else:
                income = 0

            # High living expenses throughout life
            expense = 55000  # Higher than income to ensure negative savings

            data.append(
                {
                    "age": age,
                    "year": year,
                    "total_income": income,
                    "total_expense": expense,
                    "net_flow": income - expense,
                    "portfolio_value": None,
                }
            )

        return pd.DataFrame(data)

    def test_delayed_retirement_extends_income(
        self, base_profile: UserProfile, insufficient_projection: pd.DataFrame
    ) -> None:
        """Test that delayed retirement extends income properly."""
        # Create engine input
        detailed_projection, income_items, expense_items = (
            self._create_detailed_projection_and_items(
                base_profile, insufficient_projection
            )
        )

        engine_input = EngineInput(
            user_profile=base_profile,
            annual_financial_projection=insufficient_projection,
            detailed_projection=detailed_projection,
            income_items=income_items,
        )

        # Create advisor
        advisor = FIREAdvisor(engine_input)

        # Test the income extension method directly
        extended_projection = advisor._extend_work_income_to_age(55)

        # Check that income is extended from 51 to 55
        for age in range(51, 56):
            age_row = extended_projection[extended_projection["age"] == age]
            assert len(age_row) == 1
            # Should have the same income as age 50 (30000)
            assert age_row["Work Income"].iloc[0] == 30000

        # Check that pension income at 65+ is not affected
        # (This test doesn't verify pension income since it's not set up in
        # income_items)

    def test_find_delayed_retirement_recommendation(
        self, base_profile: UserProfile, insufficient_projection: pd.DataFrame
    ) -> None:
        """Test finding delayed retirement recommendation."""
        # Create engine input
        detailed_projection, income_items, expense_items = (
            self._create_detailed_projection_and_items(
                base_profile, insufficient_projection
            )
        )

        engine_input = EngineInput(
            user_profile=base_profile,
            annual_financial_projection=insufficient_projection,
            detailed_projection=detailed_projection,
            income_items=income_items,
        )

        # Create advisor
        advisor = FIREAdvisor(engine_input)

        # Get delayed retirement recommendation
        delayed_rec = advisor._find_required_delayed_retirement()

        # Should find a delayed retirement recommendation (but may not be achievable)
        assert delayed_rec is not None
        assert isinstance(delayed_rec, DelayedRetirementRecommendation)
        # With low income (60k) and high expenses (40k), even delaying to
        # legal retirement may not work
        assert delayed_rec.required_fire_age > base_profile.expected_fire_age
        assert delayed_rec.years_delayed > 0
        if delayed_rec.is_achievable:
            assert "delay retirement" in delayed_rec.description.lower()
        else:
            assert "not feasible" in delayed_rec.description.lower()

    def test_all_recommendations_include_delayed_retirement(
        self, base_profile: UserProfile, insufficient_projection: pd.DataFrame
    ) -> None:
        """Test that get_all_recommendations includes delayed retirement
        when plan is not achievable."""
        # Create engine input
        detailed_projection, income_items, expense_items = (
            self._create_detailed_projection_and_items(
                base_profile, insufficient_projection
            )
        )

        engine_input = EngineInput(
            user_profile=base_profile,
            annual_financial_projection=insufficient_projection,
            detailed_projection=detailed_projection,
            income_items=income_items,
        )

        # Create advisor
        advisor = FIREAdvisor(engine_input)

        # Get all recommendations
        recommendations = advisor.get_all_recommendations()

        # Should have 3 recommendations (delayed retirement, income increase,
        # expense reduction)
        assert len(recommendations) == 3

        # Find delayed retirement recommendation
        delayed_recs = [
            rec
            for rec in recommendations
            if rec.recommendation_type == "delayed_retirement"
        ]
        assert len(delayed_recs) == 1

        delayed_rec = delayed_recs[0]
        assert isinstance(delayed_rec, DelayedRetirementRecommendation)
        # Note: delayed retirement may not be achievable with insufficient
        # income scenario
        # The recommendation will still be provided but marked as not
        # achievable

    def test_no_delayed_retirement_when_achievable(
        self, base_profile: UserProfile
    ) -> None:
        """Test that no delayed retirement is suggested when plan is already
        achievable."""
        # Create a projection that can achieve FIRE
        current_year = datetime.now().year
        ages = list(range(35, 86))
        years = [current_year + (age - 35) for age in ages]

        data = []
        for age, year in zip(ages, years):
            # High income until 50, pension from 65
            if 35 <= age <= 50:
                income = 200000  # High income
            elif age >= 65:
                income = 30000  # Pension
            else:
                income = 0

            expense = 50000  # Reasonable expenses

            data.append(
                {
                    "age": age,
                    "year": year,
                    "total_income": income,
                    "total_expense": expense,
                    "net_flow": income - expense,
                    "portfolio_value": None,
                }
            )

        achievable_projection = pd.DataFrame(data)

        # Create engine input
        detailed_projection, income_items, expense_items = (
            self._create_detailed_projection_and_items(
                base_profile, achievable_projection
            )
        )

        engine_input = EngineInput(
            user_profile=base_profile,
            annual_financial_projection=achievable_projection,
            detailed_projection=detailed_projection,
            income_items=income_items,
        )

        # Create advisor
        advisor = FIREAdvisor(engine_input)

        # Get all recommendations
        recommendations = advisor.get_all_recommendations()

        # Should not include delayed retirement (since plan is achievable)
        delayed_recs = [
            rec
            for rec in recommendations
            if rec.recommendation_type == "delayed_retirement"
        ]
        assert len(delayed_recs) == 0

        # Should have early retirement recommendation instead
        early_recs = [
            rec
            for rec in recommendations
            if rec.recommendation_type == "early_retirement"
        ]
        assert len(early_recs) == 1


if __name__ == "__main__":
    pytest.main([__file__])
