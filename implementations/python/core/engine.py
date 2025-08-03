"""FIRE calculation engine with portfolio management integration."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Any, List, Optional

import pandas as pd

from .data_models import FIRECalculationResult, UserProfile, YearlyState
from .portfolio_manager import (
    LiquidityAwareFlowStrategy,
    PortfolioSimulator,
)


@dataclass
class EngineInput:
    """Input data for FIRE calculation engine."""

    user_profile: UserProfile
    annual_financial_projection: pd.DataFrame
    # DataFrame columns: ['age', 'year', 'total_income', 'total_expense']
    # IMPORTANT: All values in DataFrame are FINAL computed values:
    # - total_income: Base income + individual growth_rate applied over years
    # - total_expense: Base expense + individual growth_rate + inflation_rate applied
    # - Overrides from Stage 2 are applied to these final computed values
    # - Engine should use the values directly WITHOUT additional growth/inflation
    # - This design keeps Engine simple and pushes complexity to Planner layer

    # Optional detailed projection for advisor use
    detailed_projection: pd.DataFrame = None
    # DataFrame with individual income/expense item columns plus 'age' and 'year'
    # This allows advisor to manipulate specific income streams (e.g., work income)
    income_items: Optional[List[Any]] = (
        None  # List of IncomeExpenseItem objects for income identification
    )
    # Note: expense_items removed as current expense logic only uses aggregated totals


class FIREEngine:
    """Core FIRE calculation engine with portfolio management integration."""

    def __init__(self, engine_input: EngineInput):
        """Initialize engine with input data."""
        self.input = engine_input
        self.profile = engine_input.user_profile
        self.projection_df = engine_input.annual_financial_projection

        # Set up portfolio simulator
        cash_flow_strategy = LiquidityAwareFlowStrategy()
        self.portfolio_simulator = PortfolioSimulator(
            user_profile=self.profile,
            cash_flow_strategy=cash_flow_strategy,
        )

    def calculate(self) -> FIRECalculationResult:
        """Run complete FIRE calculation and return results."""
        # Get yearly states using the core calculation logic
        yearly_states = self._calculate_yearly_states()

        # Create and return complete calculation result
        return self._create_calculation_result(yearly_states)

    def get_yearly_states(self) -> List[YearlyState]:
        """Get detailed yearly states for advanced analysis."""
        # Re-run calculation to get fresh states
        return self._calculate_yearly_states()

    def calculate_single_year(
        self, age: int, year: int, total_income: float, total_expense: float
    ) -> YearlyState:
        """Calculate state for a single year with pre-computed income/expense values."""
        net_cash_flow = total_income - total_expense

        # Simulate portfolio for this year
        portfolio_result = self.portfolio_simulator.simulate_year(
            age=age,
            net_cash_flow=Decimal(str(net_cash_flow)),
            annual_expenses=Decimal(str(total_expense)),
        )

        # Calculate financial metrics
        portfolio_value = portfolio_result.ending_portfolio_value

        # Calculate sustainability metrics
        safety_buffer_amount = total_expense * (
            self.profile.safety_buffer_months / 12.0
        )
        fire_number = total_expense * 25.0
        fire_progress = float(portfolio_value) / fire_number if fire_number > 0 else 0.0
        is_sustainable = (
            portfolio_value >= safety_buffer_amount
        )  # portfolio_value is net_worth here

        return YearlyState(
            age=age,
            year=year,
            total_income=total_income,
            total_expense=total_expense,
            net_cash_flow=net_cash_flow,
            portfolio_value=portfolio_value,
            net_worth=float(portfolio_value),  # portfolio_value is net_worth here
            investment_return=portfolio_result.investment_returns,
            is_sustainable=is_sustainable,
            fire_number=fire_number,
            fire_progress=fire_progress,
        )

    def _calculate_yearly_states(self) -> List[YearlyState]:
        """Calculate all yearly states using atomic single-year calculations."""
        yearly_states: List[YearlyState] = []
        cumulative_debt = 0.0  # Track accumulated debt when portfolio is depleted

        # Reset portfolio simulator to initial state
        self.portfolio_simulator.reset_to_initial()

        # Process each year atomically - DataFrame already has final computed values
        for _, row in self.projection_df.iterrows():
            yearly_state = self.calculate_single_year(
                age=int(row["age"]),
                year=int(row["year"]),
                total_income=float(row["total_income"]),
                total_expense=float(row["total_expense"]),
            )

            # Calculate true net worth with cumulative debt tracking
            portfolio_value = float(yearly_state.portfolio_value)

            if portfolio_value > 0:
                # Portfolio has value - net worth is portfolio value
                yearly_state.net_worth = portfolio_value
                cumulative_debt = 0.0  # Reset debt when portfolio recovers
            else:
                # Portfolio is depleted - accumulate debt
                cumulative_debt += (
                    abs(yearly_state.net_cash_flow)
                    if yearly_state.net_cash_flow < 0
                    else 0
                )
                yearly_state.net_worth = (
                    -cumulative_debt
                )  # Negative net worth indicates debt

            yearly_states.append(yearly_state)

        return yearly_states

    def _create_calculation_result(
        self, yearly_states: List[YearlyState]
    ) -> FIRECalculationResult:
        """Create FIRECalculationResult from yearly states and results."""
        # FIRE is achievable if ALL years are sustainable
        is_fire_achievable = (
            all(state.is_sustainable for state in yearly_states)
            if yearly_states
            else False
        )

        # Get net worth at expected FIRE age
        fire_net_worth = 0.0
        expected_fire_year_index = (
            self.profile.expected_fire_age - self.profile.current_age
        )
        if expected_fire_year_index >= 0 and expected_fire_year_index < len(
            yearly_states
        ):
            fire_state = yearly_states[expected_fire_year_index]
            fire_net_worth = fire_state.net_worth
        # Minimum net worth from expected FIRE age onwards
        min_net_worth_after_fire = 0.0
        if expected_fire_year_index >= 0 and expected_fire_year_index < len(
            yearly_states
        ):
            post_fire_states = yearly_states[expected_fire_year_index:]
            if post_fire_states:
                min_net_worth_after_fire = min(s.net_worth for s in post_fire_states)
            else:
                min_net_worth_after_fire = fire_net_worth

        final_net_worth = yearly_states[-1].net_worth if yearly_states else 0.0

        # Safety buffer analysis - calculate dynamically
        safety_buffer_ratios = []
        for s in yearly_states:
            safety_buffer_amount = s.total_expense * (
                self.profile.safety_buffer_months / 12.0
            )
            if safety_buffer_amount > 0:
                ratio = (
                    s.net_worth / safety_buffer_amount
                )  # Use net_worth instead of portfolio_value
                safety_buffer_ratios.append(ratio)

        min_safety_buffer_ratio = (
            min(safety_buffer_ratios) if safety_buffer_ratios else 0.0
        )

        # Traditional FIRE metrics for reference
        traditional_fire_expenses = (
            sum(s.total_expense for s in yearly_states[:5]) / 5
            if len(yearly_states) >= 5
            else 0
        )
        traditional_fire_number = traditional_fire_expenses * 25
        traditional_fire_achieved = any(
            float(s.portfolio_value) >= traditional_fire_number for s in yearly_states
        )

        return FIRECalculationResult(
            is_fire_achievable=is_fire_achievable,
            fire_net_worth=fire_net_worth,
            min_net_worth_after_fire=min_net_worth_after_fire,
            final_net_worth=final_net_worth,
            safety_buffer_months=self.profile.safety_buffer_months,
            min_safety_buffer_ratio=min_safety_buffer_ratio,
            yearly_results=yearly_states,
            traditional_fire_number=traditional_fire_number,
            traditional_fire_achieved=traditional_fire_achieved,
            fire_success_probability=None,  # Will be set by Monte Carlo
            total_years_simulated=len(yearly_states),
            retirement_years=(
                len(yearly_states) - expected_fire_year_index
                if expected_fire_year_index >= 0
                else 0
            ),
        )
