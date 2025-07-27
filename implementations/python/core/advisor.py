"""FIRE Advisor - Provides optimization suggestions based on calculation results."""

from dataclasses import dataclass
from typing import Optional, Union

from .data_models import FIRECalculationResult, SimulationSettings
from .engine import EngineInput, FIREEngine
from .monte_carlo import MonteCarloSimulator

# Type alias for all recommendation types
AdvisorRecommendationTypes = Union[
    "EarlyRetirementRecommendation",
    "DelayedRetirementRecommendation",
    "IncomeAdjustmentRecommendation",
    "ExpenseReductionRecommendation",
]


@dataclass
class AdvisorRecommendation:
    """Base class for advisor recommendations."""

    recommendation_type: str
    title: str
    description: str
    is_achievable: bool
    fire_calculation_result: Optional[FIRECalculationResult] = None
    monte_carlo_success_rate: Optional[float] = None


@dataclass
class EarlyRetirementRecommendation:
    """Recommendation for earlier retirement age."""

    recommendation_type: str
    title: str
    description: str
    is_achievable: bool
    optimal_fire_age: int
    years_saved: int
    fire_calculation_result: Optional[FIRECalculationResult] = None
    monte_carlo_success_rate: Optional[float] = None


@dataclass
class DelayedRetirementRecommendation:
    """Recommendation for delayed retirement age."""

    recommendation_type: str
    title: str
    description: str
    is_achievable: bool
    required_fire_age: int
    years_delayed: int
    fire_calculation_result: Optional[FIRECalculationResult] = None
    monte_carlo_success_rate: Optional[float] = None


@dataclass
class IncomeAdjustmentRecommendation:
    """Recommendation for income increase."""

    recommendation_type: str
    title: str
    description: str
    is_achievable: bool
    required_income_multiplier: float
    additional_income_needed: float  # Total additional annual income
    fire_calculation_result: Optional[FIRECalculationResult] = None
    monte_carlo_success_rate: Optional[float] = None


@dataclass
class ExpenseReductionRecommendation:
    """Recommendation for expense reduction."""

    recommendation_type: str
    title: str
    description: str
    is_achievable: bool
    required_expense_reduction_rate: float  # Percentage to reduce (0-1)
    annual_savings_needed: float  # Total annual expense reduction
    fire_calculation_result: Optional[FIRECalculationResult] = None
    monte_carlo_success_rate: Optional[float] = None


class FIREAdvisor:
    """FIRE Advisor that provides optimization recommendations."""

    def __init__(self, engine_input: EngineInput):
        """Initialize advisor with engine input."""
        self.engine_input = engine_input
        self.profile = engine_input.user_profile
        self.projection_df = engine_input.annual_financial_projection

    def get_all_recommendations(self) -> list[AdvisorRecommendationTypes]:
        """Get all advisor recommendations based on current FIRE feasibility."""
        # First check if current plan is achievable
        engine = FIREEngine(self.engine_input)
        base_result = engine.calculate()

        recommendations: list[AdvisorRecommendationTypes] = []

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

    def _find_earliest_retirement(self) -> Optional[EarlyRetirementRecommendation]:
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

            # Test this age
            modified_input = EngineInput(
                user_profile=modified_profile,
                annual_financial_projection=self.projection_df,
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
            optimal_input = EngineInput(
                user_profile=optimal_profile,
                annual_financial_projection=self.projection_df,
            )

            engine = FIREEngine(optimal_input)
            optimal_result = engine.calculate()

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

            return EarlyRetirementRecommendation(
                recommendation_type="early_retirement",
                title=f"Early Retirement at Age {earliest_achievable_age}",
                description=(
                    f"Based on your current financial plan, you can retire "
                    f"{years_saved} year(s) earlier at age {earliest_achievable_age} "
                    f"instead of {current_expected_age}."
                ),
                is_achievable=True,
                optimal_fire_age=earliest_achievable_age,
                years_saved=years_saved,
                fire_calculation_result=optimal_result,
                monte_carlo_success_rate=mc_result.success_rate,
            )

        return None

    def _find_required_delayed_retirement(
        self,
    ) -> Optional[DelayedRetirementRecommendation]:
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

            # Test this age
            modified_input = EngineInput(
                user_profile=modified_profile,
                annual_financial_projection=self.projection_df,
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
            required_input = EngineInput(
                user_profile=required_profile,
                annual_financial_projection=self.projection_df,
            )

            engine = FIREEngine(required_input)
            required_result = engine.calculate()

            years_delayed = required_age - current_expected_age

            return DelayedRetirementRecommendation(
                recommendation_type="delayed_retirement",
                title=f"Delayed Retirement to Age {required_age}",
                description=(
                    f"To achieve FIRE with your current financial plan, "
                    f"you need to delay retirement by {years_delayed} year(s) "
                    f"to age {required_age}."
                ),
                is_achievable=True,
                required_fire_age=required_age,
                years_delayed=years_delayed,
                fire_calculation_result=required_result,
            )

        return None

    def _find_required_income_increase(
        self,
    ) -> Optional[IncomeAdjustmentRecommendation]:
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
            final_result = engine.calculate()

            return IncomeAdjustmentRecommendation(
                recommendation_type="income_adjustment",
                title=f"Increase Income by {(optimal_multiplier - 1) * 100:.1f}%",
                description=(
                    f"To achieve FIRE at age {self.profile.expected_fire_age}, "
                    f"you need to increase your income by "
                    f"{(optimal_multiplier - 1) * 100:.1f}% "
                    f"(${additional_income:,.0f} annually)."
                ),
                is_achievable=True,
                required_income_multiplier=optimal_multiplier,
                additional_income_needed=additional_income,
                fire_calculation_result=final_result,
            )

        return None

    def _find_required_expense_reduction(
        self,
    ) -> Optional[ExpenseReductionRecommendation]:
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
            final_result = engine.calculate()

            return ExpenseReductionRecommendation(
                recommendation_type="expense_reduction",
                title=f"Reduce Expenses by {optimal_reduction * 100:.1f}%",
                description=(
                    f"To achieve FIRE at age {self.profile.expected_fire_age}, "
                    f"you need to reduce your expenses by "
                    f"{optimal_reduction * 100:.1f}% "
                    f"(${annual_savings:,.0f} annually)."
                ),
                is_achievable=True,
                required_expense_reduction_rate=optimal_reduction,
                annual_savings_needed=annual_savings,
                fire_calculation_result=final_result,
            )

        return None
