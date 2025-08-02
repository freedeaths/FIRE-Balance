"""Tests for FIRE Advisor functionality."""

import pandas as pd
import pytest

from core.advisor import FIREAdvisor, SimpleRecommendation
from core.data_models import (
    AssetClass,
    IncomeExpenseItem,
    LiquidityLevel,
    PortfolioConfiguration,
    UserProfile,
)
from core.engine import EngineInput


class TestFIREAdvisor:
    """Test suite for FIRE Advisor functionality."""

    def _create_detailed_projection_and_items(
        self, user_profile: UserProfile, annual_projection: pd.DataFrame
    ) -> tuple[pd.DataFrame, list[IncomeExpenseItem], list[IncomeExpenseItem]]:
        """Create detailed projection and income/expense items for testing."""
        # Create sample income and expense items
        income_items = [
            IncomeExpenseItem(
                name="Work Income",
                after_tax_amount_per_period=50000,
                start_age=user_profile.current_age,
                end_age=user_profile.expected_fire_age,
                annual_growth_rate=0.0,
                is_income=True,
                category="Employment",
            )
        ]

        expense_items = [
            IncomeExpenseItem(
                name="Living Expenses",
                after_tax_amount_per_period=30000,
                start_age=user_profile.current_age,
                end_age=user_profile.life_expectancy,
                annual_growth_rate=0.0,
                is_income=False,
                category="Living",
            )
        ]

        # Create detailed projection with individual columns
        detailed_projection = annual_projection[["age", "year"]].copy()
        detailed_projection["Work Income"] = annual_projection["total_income"]
        detailed_projection["Living Expenses"] = annual_projection["total_expense"]

        return detailed_projection, income_items, expense_items

    @pytest.fixture
    def base_user_profile(self) -> UserProfile:
        """Create a base user profile for testing."""
        return UserProfile(
            birth_year=1990,
            expected_fire_age=50,
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=50000,
            inflation_rate=3.0,
            safety_buffer_months=12.0,
            portfolio=PortfolioConfiguration(
                asset_classes=[
                    AssetClass(
                        name="stocks",
                        allocation_percentage=70.0,
                        expected_return=7.0,
                        volatility=15.0,
                        liquidity_level=LiquidityLevel.MEDIUM,
                    ),
                    AssetClass(
                        name="bonds",
                        allocation_percentage=20.0,
                        expected_return=3.0,
                        volatility=5.0,
                        liquidity_level=LiquidityLevel.LOW,
                    ),
                    AssetClass(
                        name="cash",
                        allocation_percentage=10.0,
                        expected_return=1.0,
                        volatility=0.5,
                        liquidity_level=LiquidityLevel.HIGH,
                    ),
                ],
                enable_rebalancing=True,
            ),
        )

    @pytest.fixture
    def achievable_projection(self) -> pd.DataFrame:
        """Create a financial projection that makes FIRE achievable."""
        # High income, low expenses - should be easily achievable
        ages = list(range(34, 86))  # Current age 34 to life expectancy 85
        years = [2024 + (age - 34) for age in ages]

        return pd.DataFrame(
            {
                "age": ages,
                "year": years,
                "total_income": [120000] * 16 + [0] * (len(ages) - 16),  # Work until 50
                "total_expense": [40000] * len(ages),  # Consistent expenses
            }
        )

    @pytest.fixture
    def unachievable_projection(self) -> pd.DataFrame:
        """Create a financial projection that makes FIRE unachievable."""
        # Low income, high expenses - should not be achievable
        ages = list(range(34, 86))
        years = [2024 + (age - 34) for age in ages]

        return pd.DataFrame(
            {
                "age": ages,
                "year": years,
                "total_income": [50000] * 16 + [0] * (len(ages) - 16),  # Work until 50
                "total_expense": [60000] * len(ages),  # Higher than income
            }
        )

    @pytest.fixture
    def marginally_achievable_projection(self) -> pd.DataFrame:
        """Create a projection that's just barely achievable at expected age."""
        ages = list(range(34, 86))
        years = [2024 + (age - 34) for age in ages]

        return pd.DataFrame(
            {
                "age": ages,
                "year": years,
                "total_income": [80000] * 16 + [0] * (len(ages) - 16),
                "total_expense": [50000] * len(ages),
            }
        )

    def test_early_retirement_recommendation(
        self, base_user_profile: UserProfile, achievable_projection: pd.DataFrame
    ) -> None:
        """Test early retirement recommendation for achievable plans."""
        detailed_projection, income_items, expense_items = (
            self._create_detailed_projection_and_items(
                base_user_profile, achievable_projection
            )
        )

        engine_input = EngineInput(
            user_profile=base_user_profile,
            annual_financial_projection=achievable_projection,
            detailed_projection=detailed_projection,
            income_items=income_items,
        )

        advisor = FIREAdvisor(engine_input)
        recommendations = advisor.get_all_recommendations()

        # Should get exactly one recommendation
        assert len(recommendations) == 1
        assert isinstance(recommendations[0], SimpleRecommendation)

        early_rec = recommendations[0]
        assert early_rec.type == "early_retirement"
        assert early_rec.is_achievable is True
        assert early_rec.params["age"] < base_user_profile.expected_fire_age
        assert early_rec.params["years"] > 0
        assert early_rec.monte_carlo_success_rate is not None

    def test_delayed_retirement_recommendation(
        self, base_user_profile: UserProfile, unachievable_projection: pd.DataFrame
    ) -> None:
        """Test delayed retirement recommendation for unachievable plans."""
        detailed_projection, income_items, expense_items = (
            self._create_detailed_projection_and_items(
                base_user_profile, unachievable_projection
            )
        )

        engine_input = EngineInput(
            user_profile=base_user_profile,
            annual_financial_projection=unachievable_projection,
            detailed_projection=detailed_projection,
            income_items=income_items,
        )

        advisor = FIREAdvisor(engine_input)
        recommendations = advisor.get_all_recommendations()

        # Should get multiple recommendations including delayed retirement
        assert len(recommendations) >= 1
        delayed_recs = [
            r
            for r in recommendations
            if r.type in ["delayed_retirement", "delayed_retirement_not_feasible"]
        ]

        if delayed_recs:  # May not always be possible within legal retirement age
            delayed_rec = delayed_recs[0]
            assert delayed_rec.type in [
                "delayed_retirement",
                "delayed_retirement_not_feasible",
            ]
            # Note: delayed retirement may not be achievable if even legal
            # retirement age doesn't work
            if delayed_rec.type == "delayed_retirement":
                assert delayed_rec.params["age"] > base_user_profile.expected_fire_age
                assert delayed_rec.params["years"] > 0

    def test_income_adjustment_recommendation(
        self, base_user_profile: UserProfile, unachievable_projection: pd.DataFrame
    ) -> None:
        """Test income adjustment recommendation for unachievable plans."""
        detailed_projection, income_items, expense_items = (
            self._create_detailed_projection_and_items(
                base_user_profile, unachievable_projection
            )
        )

        engine_input = EngineInput(
            user_profile=base_user_profile,
            annual_financial_projection=unachievable_projection,
            detailed_projection=detailed_projection,
            income_items=income_items,
        )

        advisor = FIREAdvisor(engine_input)
        recommendations = advisor.get_all_recommendations()

        # Should get income adjustment recommendation
        income_recs = [r for r in recommendations if r.type == "increase_income"]

        if income_recs:
            income_rec = income_recs[0]
            assert income_rec.type == "increase_income"
            assert income_rec.is_achievable is True
            assert income_rec.params["percentage"] > 0
            assert income_rec.params["amount"] > 0

    def test_expense_reduction_recommendation(
        self, base_user_profile: UserProfile, unachievable_projection: pd.DataFrame
    ) -> None:
        """Test expense reduction recommendation for unachievable plans."""
        detailed_projection, income_items, expense_items = (
            self._create_detailed_projection_and_items(
                base_user_profile, unachievable_projection
            )
        )

        engine_input = EngineInput(
            user_profile=base_user_profile,
            annual_financial_projection=unachievable_projection,
            detailed_projection=detailed_projection,
            income_items=income_items,
        )

        advisor = FIREAdvisor(engine_input)
        recommendations = advisor.get_all_recommendations()

        # Should get expense reduction recommendation
        expense_recs = [r for r in recommendations if r.type == "reduce_expenses"]

        if expense_recs:
            expense_rec = expense_recs[0]
            assert expense_rec.type == "reduce_expenses"
            assert expense_rec.is_achievable is True
            assert 0 < expense_rec.params["percentage"] < 100
            assert expense_rec.params["amount"] > 0

    def test_no_early_retirement_if_already_optimal(
        self,
        base_user_profile: UserProfile,
    ) -> None:
        """Test that no early retirement recommendation."""
        # Modify profile to have current age very close to expected FIRE age
        profile = base_user_profile.model_copy()
        profile.birth_year = 1974  # Makes current age 50, same as expected FIRE age
        profile.expected_fire_age = 50

        # Adjust projection to match current age
        ages = list(range(50, 86))
        years = [2024 + (age - 50) for age in ages]
        projection = pd.DataFrame(
            {
                "age": ages,
                "year": years,
                "total_income": [0] * len(ages),  # Already retired
                "total_expense": [30000] * len(ages),
            }
        )

        detailed_projection, income_items, expense_items = (
            self._create_detailed_projection_and_items(profile, projection)
        )

        engine_input = EngineInput(
            user_profile=profile,
            annual_financial_projection=projection,
            detailed_projection=detailed_projection,
            income_items=income_items,
        )

        advisor = FIREAdvisor(engine_input)
        recommendations = advisor.get_all_recommendations()

        # Should not get early retirement recommendation if already at retirement age
        early_recs = [r for r in recommendations if r.type == "early_retirement"]
        assert len(early_recs) == 0

    def test_recommendation_data_integrity(
        self, base_user_profile: UserProfile, achievable_projection: pd.DataFrame
    ) -> None:
        """Test that recommendation data is consistent and complete."""
        detailed_projection, income_items, expense_items = (
            self._create_detailed_projection_and_items(
                base_user_profile, achievable_projection
            )
        )

        engine_input = EngineInput(
            user_profile=base_user_profile,
            annual_financial_projection=achievable_projection,
            detailed_projection=detailed_projection,
            income_items=income_items,
        )

        advisor = FIREAdvisor(engine_input)
        recommendations = advisor.get_all_recommendations()

        for rec in recommendations:
            # All recommendations should have required fields
            assert rec.type is not None
            assert rec.params is not None
            assert isinstance(rec.is_achievable, bool)

    def test_binary_search_precision(self, base_user_profile: UserProfile) -> None:
        """Test that binary search algorithms find reasonable solutions."""
        # Create a scenario where we know the rough answer
        ages = list(range(34, 86))
        years = [2024 + (age - 34) for age in ages]

        # Income needs to be doubled to make it work
        projection = pd.DataFrame(
            {
                "age": ages,
                "year": years,
                "total_income": [50000] * 16 + [0] * (len(ages) - 16),
                "total_expense": [40000] * len(ages),
            }
        )

        detailed_projection, income_items, expense_items = (
            self._create_detailed_projection_and_items(base_user_profile, projection)
        )

        engine_input = EngineInput(
            user_profile=base_user_profile,
            annual_financial_projection=projection,
            detailed_projection=detailed_projection,
            income_items=income_items,
        )

        advisor = FIREAdvisor(engine_input)
        recommendations = advisor.get_all_recommendations()

        income_recs = [r for r in recommendations if r.type == "increase_income"]

        if income_recs:
            income_rec = income_recs[0]
            # Should find a reasonable percentage (not too extreme)
            assert 0 < income_rec.params["percentage"] < 400  # 400% = 5x multiplier

            # Additional income should be reasonable
            assert 0 < income_rec.params["amount"] < 200000

    def test_advisor_with_different_age_ranges(
        self, base_user_profile: UserProfile
    ) -> None:
        """Test advisor behavior with different age configurations."""
        # Test with younger person (more time to save)
        young_profile = base_user_profile.model_copy()
        young_profile.birth_year = 2000  # Age 24
        young_profile.expected_fire_age = 40

        ages = list(range(24, 86))
        years = [2024 + (age - 24) for age in ages]
        projection = pd.DataFrame(
            {
                "age": ages,
                "year": years,
                "total_income": [60000] * 16 + [0] * (len(ages) - 16),
                "total_expense": [45000] * len(ages),
            }
        )

        detailed_projection, income_items, expense_items = (
            self._create_detailed_projection_and_items(young_profile, projection)
        )

        engine_input = EngineInput(
            user_profile=young_profile,
            annual_financial_projection=projection,
            detailed_projection=detailed_projection,
            income_items=income_items,
        )

        advisor = FIREAdvisor(engine_input)
        recommendations = advisor.get_all_recommendations()

        # Should get recommendations appropriate for younger person
        assert len(recommendations) >= 1

        # Test with older person (less time to save)
        old_profile = base_user_profile.model_copy()
        old_profile.birth_year = 1970  # Age 54
        old_profile.expected_fire_age = 60

        ages = list(range(54, 86))
        years = [2024 + (age - 54) for age in ages]
        projection = pd.DataFrame(
            {
                "age": ages,
                "year": years,
                "total_income": [80000] * 6 + [0] * (len(ages) - 6),
                "total_expense": [70000] * len(ages),
            }
        )

        detailed_projection, income_items, expense_items = (
            self._create_detailed_projection_and_items(old_profile, projection)
        )

        engine_input = EngineInput(
            user_profile=old_profile,
            annual_financial_projection=projection,
            detailed_projection=detailed_projection,
            income_items=income_items,
        )

        advisor = FIREAdvisor(engine_input)
        recommendations = advisor.get_all_recommendations()

        # Should still get recommendations
        assert len(recommendations) >= 1


if __name__ == "__main__":
    pytest.main([__file__])
