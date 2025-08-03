"""FIRE Planner - Three-stage financial independence planning system."""

from __future__ import annotations

import json
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
from uuid import UUID, uuid4

import pandas as pd

from .advisor import FIREAdvisor
from .data_models import (
    IncomeExpenseItem,
    ItemFrequency,
    SimulationSettings,
    UserProfile,
)
from .engine import EngineInput, FIREEngine
from .i18n import get_i18n
from .monte_carlo import MonteCarloSimulator
from .planner_models import (
    Override,
    PlannerConfigV1,
    PlannerData,
    PlannerResults,
)


class CustomJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder for planner data types."""

    def default(self, obj: Any) -> Any:
        if isinstance(obj, Enum):
            return obj.value
        elif isinstance(obj, UUID):
            return str(obj)
        elif isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


class FIREPlanner:
    """Three-stage FIRE planning system.

    Stage 1: Collect user profile and income/expense items
    Stage 2: Allow user to adjust financial projection table
    Stage 3: Run calculations and provide recommendations
    """

    def __init__(self, language: str = "en"):
        """Initialize FIRE planner with specified language."""
        self.data = PlannerData(language=language)
        self.i18n = get_i18n()
        self.i18n.set_language(language)

    # ===================
    # Stage 1: Input Collection
    # ===================

    def set_user_profile(self, profile: UserProfile) -> None:
        """Set user profile."""
        self.data.user_profile = profile

        # Clean invalid overrides if age range changed
        self._clean_invalid_overrides()

        self.data.update_timestamp()

    def add_income_item(self, item: IncomeExpenseItem) -> str:
        """Add income item and return its ID."""
        # Ensure item has ID
        if not item.id:
            item.id = str(uuid4())

        self.data.income_items.append(item)
        self.data.update_timestamp()
        return item.id

    def add_expense_item(self, item: IncomeExpenseItem) -> str:
        """Add expense item and return its ID."""
        # Ensure item has ID
        if not item.id:
            item.id = str(uuid4())

        self.data.expense_items.append(item)
        self.data.update_timestamp()
        return item.id

    def remove_income_item(self, item_id: str) -> bool:
        """Remove income item by ID. Returns True if removed."""
        for i, item in enumerate(self.data.income_items):
            if item.id == item_id:
                del self.data.income_items[i]

                # Clean up related overrides
                self._remove_overrides_for_item(item_id)

                # If we had a projection, try to regenerate it
                if self.data.projection_df is not None:
                    try:
                        self.data.projection_df = self._generate_initial_projection()
                    except Exception:
                        # If regeneration fails, clear projection
                        self.data.projection_df = None

                self.data.update_timestamp()
                return True
        return False

    def remove_expense_item(self, item_id: str) -> bool:
        """Remove expense item by ID. Returns True if removed."""
        for i, item in enumerate(self.data.expense_items):
            if item.id == item_id:
                del self.data.expense_items[i]

                # Clean up related overrides
                self._remove_overrides_for_item(item_id)

                # If we had a projection, try to regenerate it
                if self.data.projection_df is not None:
                    try:
                        self.data.projection_df = self._generate_initial_projection()
                    except Exception:
                        # If regeneration fails, clear projection
                        self.data.projection_df = None

                self.data.update_timestamp()
                return True
        return False

    # ===================
    # Stage 2: Table Adjustment
    # ===================

    def get_projection_dataframe(self) -> Optional[pd.DataFrame]:
        """Get current projection DataFrame with overrides applied."""
        if self.data.projection_df is None:
            return None

        # Return DataFrame with overrides applied for backward compatibility
        display_df = self.data.projection_df.copy()
        self._apply_overrides_to_df(display_df)
        return display_df

    def get_base_projection_dataframe(self) -> Optional[pd.DataFrame]:
        """Get base projection DataFrame WITHOUT overrides applied."""
        return self.data.projection_df

    def apply_override(self, age: int, item_id: str, value: float) -> None:
        """Apply override to specific age and item."""
        if self.data.projection_df is None:
            raise ValueError("No projection DataFrame available")

        # Create or update override
        override = Override(age=age, item_id=item_id, value=value)

        # Remove existing override for same age/item
        self.data.overrides = [
            o
            for o in self.data.overrides
            if not (o.age == age and o.item_id == item_id)
        ]

        # Add new override
        self.data.overrides.append(override)
        self.data.update_timestamp()

    def remove_override(self, age: int, item_id: str) -> bool:
        """Remove override for specific age and item."""
        initial_count = len(self.data.overrides)
        self.data.overrides = [
            o
            for o in self.data.overrides
            if not (o.age == age and o.item_id == item_id)
        ]

        if len(self.data.overrides) < initial_count:
            self.data.update_timestamp()
            return True
        return False

    # ===================
    # Stage 3: Analysis & Recommendations
    # ===================

    def get_results(self) -> Optional[PlannerResults]:
        """Get calculation results from stage 3."""
        return self.data.results

    def set_simulation_settings(self, settings: SimulationSettings) -> None:
        """Set Monte Carlo simulation settings."""
        self.data.simulation_settings = settings
        self.data.update_timestamp()

    def get_simulation_settings(self) -> SimulationSettings:
        """Get current Monte Carlo simulation settings."""
        return self.data.simulation_settings

    def run_calculations(
        self,
        progress_callback: Optional[Any] = None,
        num_simulations: Optional[int] = None,
    ) -> PlannerResults:
        """Run FIRE calculations and update results.

        Args:
            progress_callback: Optional progress callback function
            num_simulations: Optional number of simulations
                (overrides settings for this run only)
        """
        if self.data.projection_df is None:
            raise ValueError("No projection data available for calculation")

        results = self._run_calculations(progress_callback, num_simulations)
        self.data.results = results
        self.data.update_timestamp()

        return results

    # ===================
    # 🚀 New Simplified API (Stage-agnostic)
    # ===================

    def generate_projection_table(self) -> pd.DataFrame:
        """Generate base projection table without stage constraints.

        This is the new simplified API that replaces proceed_to_stage2().

        Returns:
            DataFrame: Base projection table without overrides applied
        """
        # Check if we have required data
        if (
            self.data.user_profile is None
            or len(self.data.income_items) == 0
            or len(self.data.expense_items) == 0
        ):
            raise ValueError(
                "Missing required data: user_profile, income_items, or expense_items"
            )

        # Clean up any invalid overrides
        self._clean_invalid_overrides()

        # Generate and store base projection DataFrame
        projection_df = self._generate_initial_projection()
        self.data.projection_df = projection_df
        self.data.update_timestamp()

        return projection_df

    def apply_overrides_to_table(
        self,
        base_df: Optional[pd.DataFrame] = None,
        overrides: Optional[List[Override]] = None,
    ) -> pd.DataFrame:
        """Apply overrides to projection table without stage constraints.

        This is the new simplified API that allows flexible override application.

        Args:
            base_df: Base DataFrame to apply overrides to. If None, uses stored
                projection_df
            overrides: List of overrides to apply. If None, uses stored overrides

        Returns:
            DataFrame: Projection table with overrides applied
        """
        if base_df is None:
            if self.data.projection_df is None:
                raise ValueError("No base projection DataFrame available")
            base_df = self.data.projection_df

        if overrides is None:
            overrides = self.data.overrides

        # Apply overrides to a copy of the DataFrame
        result_df = base_df.copy()

        # Store the overrides temporarily and apply them using existing method
        original_overrides = self.data.overrides
        self.data.overrides = overrides
        self._apply_overrides_to_df(result_df)
        self.data.overrides = original_overrides

        return result_df

    def calculate_fire_results(
        self,
        projection_df: Optional[pd.DataFrame] = None,
        progress_callback: Optional[Any] = None,
        num_simulations: Optional[int] = None,
    ) -> PlannerResults:
        """Calculate FIRE results from projection table without stage constraints.

        This is the new simplified API that replaces proceed_to_stage3().

        Args:
            projection_df: DataFrame to use for calculations. If None, uses stored
                projection_df
            progress_callback: Optional progress callback function
            num_simulations: Optional number of simulations override

        Returns:
            PlannerResults: Complete FIRE calculation results
        """
        if projection_df is None:
            if self.data.projection_df is None:
                raise ValueError("No projection DataFrame available for calculation")
            projection_df = self.data.projection_df

        # Store the DataFrame we're calculating from
        self.data.projection_df = projection_df

        # Run calculations using the existing internal method
        results = self._run_calculations(progress_callback, num_simulations)

        # Store results and update timestamp
        self.data.results = results
        self.data.update_timestamp()

        return results

    def add_override(self, age: int, item_id: str, value: float) -> None:
        """Add or update an override without stage constraints.

        Args:
            age: Age for the override
            item_id: Item ID to override
            value: New value
        """
        # Remove existing override for same age/item if exists
        self.data.overrides = [
            o
            for o in self.data.overrides
            if not (o.age == age and o.item_id == item_id)
        ]

        # Add new override
        override = Override(age=age, item_id=item_id, value=value)
        self.data.overrides.append(override)
        self.data.update_timestamp()

    def get_projection_with_overrides(self) -> Optional[pd.DataFrame]:
        """Get projection table with all current overrides applied.

        Returns:
            DataFrame: Projection table with overrides, or None if no base
                projection exists
        """
        if self.data.projection_df is None:
            return None

        return self.apply_overrides_to_table()

    def clear_overrides(self) -> None:
        """Clear all overrides."""
        self.data.overrides = []
        self.data.update_timestamp()

    # ===================
    # Import/Export Functions
    # ===================

    def export_config(self, description: str = "") -> Dict[str, Any]:
        """Export current configuration as JSON-serializable dict."""
        config = PlannerConfigV1.from_planner_data(self.data, description)
        return config.model_dump()

    def export_config_to_file(self, file_path: Path, description: str = "") -> None:
        """Export configuration to JSON file."""
        config_data = self.export_config(description)

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(
                config_data, f, indent=2, ensure_ascii=False, cls=CustomJSONEncoder
            )

    def import_config_from_file(self, file_path: Path) -> None:
        """Import configuration from JSON file."""
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Import new V1.0 format
        config = PlannerConfigV1(**data)
        self.data = config.to_planner_data()

        # Update i18n language
        self.i18n.set_language(self.data.language)

    # ===================
    # Internal Helper Methods
    # ===================

    def _generate_initial_projection(self) -> pd.DataFrame:
        """Generate initial financial projection DataFrame in wide format."""
        if not self.data.user_profile:
            raise ValueError("User profile required")

        profile = self.data.user_profile
        current_year = datetime.now().year
        current_age = profile.current_age

        # Create age range from current age to life expectancy
        ages = list(range(current_age, profile.life_expectancy + 1))
        years = [current_year + (age - current_age) for age in ages]

        # Start with age and year columns
        data: Dict[str, Union[List[int], List[float]]] = {"age": ages, "year": years}

        # Add columns for each income item
        for item in self.data.income_items:
            # Use item's actual age range (no more predefined logic)
            effective_start_age, effective_end_age = item.start_age, item.end_age

            column_values: List[float] = []
            for age in ages:
                if item.frequency == ItemFrequency.ONE_TIME:
                    # One-time items only appear at start_age
                    if age == effective_start_age:
                        column_values.append(item.after_tax_amount_per_period)
                    else:
                        column_values.append(0.0)
                else:
                    # Recurring items appear in age range with growth
                    if effective_start_age <= age <= (effective_end_age or 999):
                        years_since_start = age - effective_start_age
                        growth_factor = (
                            1 + item.annual_growth_rate / 100
                        ) ** years_since_start
                        amount = item.after_tax_amount_per_period * growth_factor
                        column_values.append(amount)
                    else:
                        column_values.append(0.0)
            data[item.name] = column_values

        # Add columns for each expense item (with inflation)
        inflation_rate = profile.inflation_rate / 100
        for item in self.data.expense_items:
            # Use item's actual age range (no more predefined logic)
            effective_start_age, effective_end_age = item.start_age, item.end_age

            expense_column_values: List[float] = []
            for age in ages:
                if item.frequency == ItemFrequency.ONE_TIME:
                    # One-time items only appear at start_age (no inflation applied
                    # to one-time items)
                    if age == effective_start_age:
                        expense_column_values.append(item.after_tax_amount_per_period)
                    else:
                        expense_column_values.append(0.0)
                else:
                    # Recurring items appear in age range with inflation and growth
                    if effective_start_age <= age <= (effective_end_age or 999):
                        years_since_start = age - effective_start_age
                        inflation_factor = (1 + inflation_rate) ** years_since_start
                        growth_factor = (
                            1 + item.annual_growth_rate / 100
                        ) ** years_since_start
                        amount = (
                            item.after_tax_amount_per_period
                            * inflation_factor
                            * growth_factor
                        )
                        expense_column_values.append(amount)
                    else:
                        expense_column_values.append(0.0)
            data[item.name] = expense_column_values

        return pd.DataFrame(data)

    def _clean_invalid_overrides(self) -> None:
        """Clean up overrides that are no longer valid due to item/age changes."""
        if not self.data.overrides:
            return

        # Get valid item IDs
        valid_item_ids = {
            item.id for item in self.data.income_items + self.data.expense_items
        }

        # Get valid age range
        if self.data.user_profile:
            valid_ages = set(
                range(
                    self.data.user_profile.current_age,
                    self.data.user_profile.life_expectancy + 1,
                )
            )
        else:
            valid_ages = set()

        # Filter out invalid overrides
        valid_overrides = []
        for override in self.data.overrides:
            # Keep override if item exists and age is valid
            if override.item_id in valid_item_ids and override.age in valid_ages:
                valid_overrides.append(override)

        self.data.overrides = valid_overrides

    def _remove_overrides_for_item(self, item_id: str) -> None:
        """Remove all overrides for a specific item."""
        self.data.overrides = [
            override for override in self.data.overrides if override.item_id != item_id
        ]

    def _apply_overrides_to_df(self, df: pd.DataFrame) -> None:
        """Apply overrides to a DataFrame in place."""
        if not self.data.overrides:
            return

        # Create item_id to name mapping
        item_id_to_name = {}
        for item in self.data.income_items + self.data.expense_items:
            item_id_to_name[item.id] = item.name

        # Apply overrides directly to specific cells
        for override in self.data.overrides:
            if override.item_id not in item_id_to_name:
                continue  # Skip invalid item_id

            column_name = item_id_to_name[override.item_id]
            if column_name not in df.columns:
                continue  # Skip if column doesn't exist

            age_mask = df["age"] == override.age
            df.loc[age_mask, column_name] = override.value

    def _create_annual_summary_from_df(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create annual summary from wide format projection DataFrame."""
        # Get income and expense column names
        income_cols = [item.name for item in self.data.income_items]
        expense_cols = [item.name for item in self.data.expense_items]

        # Calculate total income and expense
        result_df = df[["age", "year"]].copy()
        result_df["total_income"] = df[income_cols].sum(axis=1) if income_cols else 0.0
        result_df["total_expense"] = (
            df[expense_cols].sum(axis=1) if expense_cols else 0.0
        )

        # Calculate net flow
        result_df["net_flow"] = result_df["total_income"] - result_df["total_expense"]

        # Add portfolio_value placeholder
        result_df["portfolio_value"] = None

        return result_df

    def _run_calculations(
        self,
        progress_callback: Optional[Any] = None,
        num_simulations: Optional[int] = None,
    ) -> PlannerResults:
        """Run FIRE calculations and generate recommendations."""
        if self.data.projection_df is None or not self.data.user_profile:
            raise ValueError("Missing data for calculations")

        # Create a copy of projection df and apply overrides for calculation
        calculation_df = self.data.projection_df.copy()
        self._apply_overrides_to_df(calculation_df)

        # Convert detailed projection to annual summary for engine
        annual_summary = self._create_annual_summary_from_df(calculation_df)

        # Create engine input with detailed projection for advisor
        engine_input = EngineInput(
            user_profile=self.data.user_profile,
            annual_financial_projection=annual_summary,
            detailed_projection=calculation_df,
            income_items=self.data.income_items,
        )

        # Run FIRE calculation
        engine = FIREEngine(engine_input)
        fire_result = engine.calculate()

        # Run Monte Carlo simulation with custom or default settings
        monte_carlo_success_rate = None
        try:
            # Use custom simulation count if provided, otherwise use stored settings
            if num_simulations is not None:
                # Create temporary settings with custom simulation count
                temp_settings = SimulationSettings(
                    num_simulations=num_simulations,
                    confidence_level=self.data.simulation_settings.confidence_level,
                    include_black_swan_events=(
                        self.data.simulation_settings.include_black_swan_events
                    ),
                    income_base_volatility=(
                        self.data.simulation_settings.income_base_volatility
                    ),
                    income_minimum_factor=(
                        self.data.simulation_settings.income_minimum_factor
                    ),
                    expense_base_volatility=(
                        self.data.simulation_settings.expense_base_volatility
                    ),
                    expense_minimum_factor=(
                        self.data.simulation_settings.expense_minimum_factor
                    ),
                )
                simulator = MonteCarloSimulator(engine=engine, settings=temp_settings)
            else:
                # Use stored settings
                simulator = MonteCarloSimulator(
                    engine=engine, settings=self.data.simulation_settings
                )

            monte_carlo_result = simulator.run_simulation(progress_callback)
            monte_carlo_success_rate = monte_carlo_result.success_rate
        except Exception:
            # Monte Carlo is optional, don't fail if it errors
            pass

        # Get simple recommendations
        recommendations = []
        try:
            advisor = FIREAdvisor(engine_input)
            raw_recommendations = advisor.get_all_recommendations()
            # Convert SimpleRecommendation objects to dicts for storage
            recommendations = [
                {
                    "type": rec.type,
                    "params": rec.params,
                    "is_achievable": rec.is_achievable,
                    "monte_carlo_success_rate": rec.monte_carlo_success_rate,
                }
                for rec in raw_recommendations
            ]
        except Exception:
            # Recommendations are optional, don't fail if they error
            pass

        return PlannerResults(
            fire_calculation=fire_result,
            monte_carlo_success_rate=monte_carlo_success_rate,
            recommendations=recommendations,
        )
