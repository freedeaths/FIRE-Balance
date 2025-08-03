"""FIRE Advisor - Provides optimization suggestions based on calculation results."""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import pandas as pd

from .data_models import SimulationSettings
from .engine import EngineInput, FIREEngine
from .monte_carlo import MonteCarloSimulator


@dataclass
class SimpleRecommendation:
    """Simple recommendation with type and parameters for UI rendering."""

    type: str
    params: Dict[str, Any]
    is_achievable: bool = True
    monte_carlo_success_rate: Optional[float] = None


class FIREAdvisor:
    """FIRE Advisor that provides structured optimization recommendations.

    This advisor generates language-agnostic structured data that can be
    dynamically rendered in any language by the UI layer.
    """

    def __init__(self, engine_input: EngineInput, language: Optional[str] = None):
        """Initialize advisor with engine input.

        Args:
            engine_input: Engine input with user profile and projections
            language: Deprecated parameter, kept for backward compatibility
        """
        self.engine_input = engine_input
        self.profile = engine_input.user_profile
        self.projection_df = engine_input.annual_financial_projection
        self.detailed_projection_df = engine_input.detailed_projection
        self.income_items = engine_input.income_items

    def get_all_recommendations(self) -> List[SimpleRecommendation]:
        """Get all advisor recommendations based on current FIRE feasibility.

        Returns:
            List of SimpleRecommendation objects with type and parameters
        """
        # First check if current plan is achievable
        engine = FIREEngine(self.engine_input)
        base_result = engine.calculate()

        recommendations: List[SimpleRecommendation] = []

        if base_result.is_fire_achievable:
            # Plan is achievable - find earliest possible retirement
            early_rec = self._find_earliest_retirement()
            if early_rec:
                recommendations.append(early_rec)
        else:
            # Plan not achievable - provide multiple solutions
            delayed_rec = self._find_required_delayed_retirement()
            income_rec = self._find_required_income_increase()
            expense_rec = self._find_required_expense_reduction()

            for rec in [delayed_rec, income_rec, expense_rec]:
                if rec:
                    recommendations.append(rec)

        return recommendations

    def _find_earliest_retirement(self) -> Optional[SimpleRecommendation]:
        """Find the earliest possible retirement age."""
        current_expected_age = self.profile.expected_fire_age
        current_age = self.profile.current_age

        # Start from one year earlier and work backwards
        test_age = current_expected_age - 1
        earliest_achievable_age = current_expected_age

        while test_age >= current_age:
            # Create modified profile with earlier FIRE age
            modified_profile = self.profile.model_copy()
            modified_profile.expected_fire_age = test_age

            # Create modified projection with truncated work income
            modified_detailed_projection = self._truncate_work_income_to_age(test_age)
            modified_annual_projection = self._create_annual_summary_from_detailed_df(
                modified_detailed_projection
            )

            # Test this age
            modified_input = EngineInput(
                user_profile=modified_profile,
                annual_financial_projection=modified_annual_projection,
                detailed_projection=modified_detailed_projection,
                income_items=self.income_items,
            )

            engine = FIREEngine(modified_input)
            result = engine.calculate()

            if result.is_fire_achievable:
                earliest_achievable_age = test_age
                test_age -= 1
            else:
                break

        if earliest_achievable_age < current_expected_age:
            # Get calculation results for the optimal age
            optimal_profile = self.profile.model_copy()
            optimal_profile.expected_fire_age = earliest_achievable_age

            # Create projection with truncated income for optimal age
            optimal_detailed_projection = self._truncate_work_income_to_age(
                earliest_achievable_age
            )
            optimal_annual_projection = self._create_annual_summary_from_detailed_df(
                optimal_detailed_projection
            )
            optimal_input = EngineInput(
                user_profile=optimal_profile,
                annual_financial_projection=optimal_annual_projection,
                detailed_projection=optimal_detailed_projection,
                income_items=self.income_items,
            )

            engine = FIREEngine(optimal_input)
            engine.calculate()

            # Run Monte Carlo for this optimal age
            optimal_engine = FIREEngine(optimal_input)
            mc_simulator = MonteCarloSimulator(
                optimal_engine,
                SimulationSettings(
                    num_simulations=1000,
                    confidence_level=0.95,
                    include_black_swan_events=True,
                    income_base_volatility=0.1,
                    income_minimum_factor=0.1,
                    expense_base_volatility=0.05,
                    expense_minimum_factor=0.5,
                ),
            )
            mc_result = mc_simulator.run_simulation()

            years_saved = current_expected_age - earliest_achievable_age

            return SimpleRecommendation(
                type="early_retirement",
                params={"age": earliest_achievable_age, "years": years_saved},
                is_achievable=True,
                monte_carlo_success_rate=mc_result.success_rate,
            )

        return None

    def _find_required_delayed_retirement(
        self,
    ) -> Optional[SimpleRecommendation]:
        """Find the minimum age required for FIRE to be achievable."""
        current_expected_age = self.profile.expected_fire_age
        legal_retirement_age = self.profile.legal_retirement_age

        # Start from one year later and work forward
        test_age = current_expected_age + 1
        required_age = None

        while test_age <= legal_retirement_age:
            # Create modified profile with later FIRE age
            modified_profile = self.profile.model_copy()
            modified_profile.expected_fire_age = test_age

            # Create modified detailed projection with extended work income
            modified_detailed_projection = self._extend_work_income_to_age(test_age)

            # Convert to annual summary for engine
            modified_annual_projection = self._create_annual_summary_from_detailed_df(
                modified_detailed_projection
            )

            # Test this age
            modified_input = EngineInput(
                user_profile=modified_profile,
                annual_financial_projection=modified_annual_projection,
                detailed_projection=modified_detailed_projection,
                income_items=self.income_items,
            )

            engine = FIREEngine(modified_input)
            result = engine.calculate()

            if result.is_fire_achievable:
                required_age = test_age
                break

            test_age += 1

        if required_age:
            # Get calculation results for the required age
            required_profile = self.profile.model_copy()
            required_profile.expected_fire_age = required_age
            required_detailed_projection = self._extend_work_income_to_age(required_age)
            required_annual_projection = self._create_annual_summary_from_detailed_df(
                required_detailed_projection
            )
            required_input = EngineInput(
                user_profile=required_profile,
                annual_financial_projection=required_annual_projection,
                detailed_projection=required_detailed_projection,
                income_items=self.income_items,
            )

            engine = FIREEngine(required_input)
            engine.calculate()

            years_delayed = required_age - current_expected_age

            return SimpleRecommendation(
                type="delayed_retirement",
                params={"age": required_age, "years": years_delayed},
                is_achievable=True,
            )

        # If no feasible age found within legal retirement age, return unfeasible
        # recommendation
        # Test the maximum possible delay (to legal retirement age)
        max_delay_age = legal_retirement_age
        max_delay_profile = self.profile.model_copy()
        max_delay_profile.expected_fire_age = max_delay_age

        max_delay_detailed_projection = self._extend_work_income_to_age(max_delay_age)
        max_delay_annual_projection = self._create_annual_summary_from_detailed_df(
            max_delay_detailed_projection
        )

        max_delay_input = EngineInput(
            user_profile=max_delay_profile,
            annual_financial_projection=max_delay_annual_projection,
            detailed_projection=max_delay_detailed_projection,
            income_items=self.income_items,
        )

        engine = FIREEngine(max_delay_input)
        engine.calculate()

        years_delayed = max_delay_age - current_expected_age

        return SimpleRecommendation(
            type="delayed_retirement_not_feasible",
            params={"age": max_delay_age},
            is_achievable=False,
        )

    def _find_required_income_increase(
        self,
    ) -> Optional[SimpleRecommendation]:
        """Find required income multiplier to achieve FIRE at expected age."""
        # Binary search for the minimum income multiplier
        low, high = 1.0, 5.0  # Search between 1x and 5x income
        epsilon = 0.01  # Precision for binary search

        optimal_multiplier = None

        while high - low > epsilon:
            mid = (low + high) / 2

            # Create modified projection with increased income
            modified_df = self.projection_df.copy()
            modified_df["total_income"] *= mid

            modified_input = EngineInput(
                user_profile=self.profile, annual_financial_projection=modified_df
            )

            engine = FIREEngine(modified_input)
            result = engine.calculate()

            if result.is_fire_achievable:
                optimal_multiplier = mid
                high = mid
            else:
                low = mid

        if optimal_multiplier:
            # Calculate additional income needed
            original_income = self.projection_df["total_income"].iloc[0]
            additional_income = original_income * (optimal_multiplier - 1.0)

            # Get final calculation result
            final_df = self.projection_df.copy()
            final_df["total_income"] *= optimal_multiplier
            final_input = EngineInput(
                user_profile=self.profile, annual_financial_projection=final_df
            )

            engine = FIREEngine(final_input)
            engine.calculate()

            return SimpleRecommendation(
                type="increase_income",
                params={
                    "fire_age": self.profile.expected_fire_age,
                    "percentage": (optimal_multiplier - 1) * 100,
                    "amount": additional_income,
                },
                is_achievable=True,
            )

        return None

    def _find_required_expense_reduction(
        self,
    ) -> Optional[SimpleRecommendation]:
        """Find required expense reduction to achieve FIRE at expected age."""
        # Binary search for the minimum expense reduction
        low, high = 0.0, 0.8  # Search between 0% and 80% reduction
        epsilon = 0.001  # Precision for binary search

        optimal_reduction = None

        while high - low > epsilon:
            mid = (low + high) / 2
            reduction_factor = 1.0 - mid  # Convert reduction rate to multiplier

            # Create modified projection with reduced expenses
            modified_df = self.projection_df.copy()
            modified_df["total_expense"] *= reduction_factor

            modified_input = EngineInput(
                user_profile=self.profile, annual_financial_projection=modified_df
            )

            engine = FIREEngine(modified_input)
            result = engine.calculate()

            if result.is_fire_achievable:
                optimal_reduction = mid
                high = mid
            else:
                low = mid

        if optimal_reduction:
            # Calculate annual savings needed
            original_expense = self.projection_df["total_expense"].iloc[0]
            annual_savings = original_expense * optimal_reduction

            # Get final calculation result
            final_df = self.projection_df.copy()
            final_df["total_expense"] *= 1.0 - optimal_reduction
            final_input = EngineInput(
                user_profile=self.profile, annual_financial_projection=final_df
            )

            engine = FIREEngine(final_input)
            engine.calculate()

            return SimpleRecommendation(
                type="reduce_expenses",
                params={
                    "fire_age": self.profile.expected_fire_age,
                    "percentage": optimal_reduction * 100,
                    "amount": annual_savings,
                },
                is_achievable=True,
            )

        return None

    def _extend_work_income_to_age(self, target_fire_age: int) -> pd.DataFrame:
        """Create modified detailed projection with extended work income.

        This method identifies work income items (typically those that end at or before
        current expected_fire_age) and extends them to the new target age.

        Args:
            target_fire_age: New target FIRE age to extend work income to

        Returns:
            Modified detailed projection DataFrame with extended work income
        """
        if self.detailed_projection_df is None or not self.income_items:
            raise ValueError("Detailed projection data required for income extension")

        extended_projection = self.detailed_projection_df.copy()
        current_fire_age = self.profile.expected_fire_age

        # If target age is not later than current, return unchanged
        if target_fire_age <= current_fire_age:
            return extended_projection

        # Find income items that end at current FIRE age (work income)
        work_income_items = [
            item
            for item in self.income_items
            if item.end_age and item.end_age == current_fire_age
        ]

        if not work_income_items:
            # No work income to extend
            return extended_projection

        # For each work income item, extend it to target age
        for item in work_income_items:
            # Calculate the growth pattern for extending this income
            for age in range(item.end_age + 1, target_fire_age + 1):
                age_mask = extended_projection["age"] == age
                if age_mask.any():
                    row_idx = extended_projection[age_mask].index[0]

                    # Calculate extended income value with proper growth
                    years_since_start = age - item.start_age
                    growth_factor = (
                        1 + item.annual_growth_rate / 100
                    ) ** years_since_start
                    extended_income = item.after_tax_amount_per_period * growth_factor

                    extended_projection.loc[row_idx, item.name] = extended_income

        return extended_projection

    def _create_annual_summary_from_detailed_df(
        self, detailed_df: pd.DataFrame
    ) -> pd.DataFrame:
        """Create annual summary from detailed projection DataFrame.

        This converts the wide format detailed projection (with individual
        income/expense columns) to the summary format expected by FIREEngine.
        """
        if not self.income_items:
            raise ValueError("Income items required for summary creation")

        # Get income column names
        income_cols = [item.name for item in self.income_items]

        # Get expense columns (all columns except 'age', 'year', and income columns)
        all_cols = set(detailed_df.columns)
        system_cols = {"age", "year"}
        income_cols_set = set(income_cols)
        expense_cols = list(all_cols - system_cols - income_cols_set)

        # Calculate totals
        result_df = detailed_df[["age", "year"]].copy()
        result_df["total_income"] = detailed_df[income_cols].sum(axis=1)
        result_df["total_expense"] = (
            detailed_df[expense_cols].sum(axis=1) if expense_cols else 0.0
        )
        result_df["net_flow"] = result_df["total_income"] - result_df["total_expense"]

        return result_df

    def _truncate_work_income_to_age(self, target_fire_age: int) -> pd.DataFrame:
        """Create modified detailed projection with truncated work income.

        This method identifies work income items (typically those that end at or after
        current expected_fire_age) and truncates them at the new target age.

        Args:
            target_fire_age: New target FIRE age to truncate work income at

        Returns:
            Modified detailed projection DataFrame with work income truncated at
            target age
        """
        if self.detailed_projection_df is None or not self.income_items:
            raise ValueError("Detailed projection data required for income truncation")

        truncated_projection = self.detailed_projection_df.copy()
        current_fire_age = self.profile.expected_fire_age

        # If target age is not earlier than current, return unchanged
        if target_fire_age >= current_fire_age:
            return truncated_projection

        # Find income items that end at current FIRE age (work income)
        work_income_items = [
            item
            for item in self.income_items
            if item.end_age and item.end_age == current_fire_age
        ]

        if not work_income_items:
            # No work income to truncate
            return truncated_projection

        # For each work income item, truncate it at target retirement age
        for item in work_income_items:
            # Set income to 0 for ages after target retirement age
            for age in range(target_fire_age + 1, item.end_age + 1):
                age_mask = truncated_projection["age"] == age
                if age_mask.any():
                    truncated_projection.loc[age_mask, item.name] = 0

        return truncated_projection
