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
from .data_models import IncomeExpenseItem, SimulationSettings, UserProfile
from .engine import EngineInput, FIREEngine
from .i18n import get_i18n
from .monte_carlo import MonteCarloSimulator
from .planner_models import (
    Override,
    PlannerConfigV1,
    PlannerData,
    PlannerResults,
    PlannerStage,
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

    @property
    def current_stage(self) -> PlannerStage:
        """Get current planner stage."""
        return self.data.current_stage

    # ===================
    # Stage 1: Input Collection
    # ===================

    def set_user_profile(self, profile: UserProfile) -> None:
        """Set user profile (only in stage 1)."""
        if self.data.current_stage != PlannerStage.STAGE1_INPUT:
            raise ValueError("Can only set profile in stage 1")

        self.data.user_profile = profile

        # Update predefined items to sync with new profile
        self._sync_predefined_items_with_profile()

        # Clean invalid overrides if age range changed
        self._clean_invalid_overrides()

        self.data.update_timestamp()

    def add_income_item(self, item: IncomeExpenseItem) -> str:
        """Add income item and return its ID (only in stage 1)."""
        if self.data.current_stage != PlannerStage.STAGE1_INPUT:
            raise ValueError("Can only add income items in stage 1")

        # Ensure item has ID
        if not item.id:
            item.id = str(uuid4())

        self.data.income_items.append(item)
        self.data.update_timestamp()
        return item.id

    def add_expense_item(self, item: IncomeExpenseItem) -> str:
        """Add expense item and return its ID (only in stage 1)."""
        if self.data.current_stage != PlannerStage.STAGE1_INPUT:
            raise ValueError("Can only add expense items in stage 1")

        # Ensure item has ID
        if not item.id:
            item.id = str(uuid4())

        self.data.expense_items.append(item)
        self.data.update_timestamp()
        return item.id

    def remove_income_item(self, item_id: str) -> bool:
        """Remove income item by ID. Returns True if removed."""
        # Allow removal in stage 1 or 2 for backward compatibility
        if self.data.current_stage not in [
            PlannerStage.STAGE1_INPUT,
            PlannerStage.STAGE2_ADJUSTMENT,
        ]:
            raise ValueError("Can only remove income items in stage 1 or 2")

        for i, item in enumerate(self.data.income_items):
            if item.id == item_id:
                del self.data.income_items[i]

                # Clean up related overrides
                self._remove_overrides_for_item(item_id)

                # If in stage 2, regenerate projection DataFrame
                if self.data.current_stage == PlannerStage.STAGE2_ADJUSTMENT:
                    self.data.projection_df = self._generate_initial_projection()

                self.data.update_timestamp()
                return True
        return False

    def remove_expense_item(self, item_id: str) -> bool:
        """Remove expense item by ID. Returns True if removed."""
        # Allow removal in stage 1 or 2 for backward compatibility
        if self.data.current_stage not in [
            PlannerStage.STAGE1_INPUT,
            PlannerStage.STAGE2_ADJUSTMENT,
        ]:
            raise ValueError("Can only remove expense items in stage 1 or 2")

        for i, item in enumerate(self.data.expense_items):
            if item.id == item_id:
                del self.data.expense_items[i]

                # Clean up related overrides
                self._remove_overrides_for_item(item_id)

                # If in stage 2, regenerate projection DataFrame
                if self.data.current_stage == PlannerStage.STAGE2_ADJUSTMENT:
                    self.data.projection_df = self._generate_initial_projection()

                self.data.update_timestamp()
                return True
        return False

    def can_proceed_to_stage2(self) -> bool:
        """Check if all required data is present for stage 2."""
        return (
            self.data.user_profile is not None
            and len(self.data.income_items) > 0
            and len(self.data.expense_items) > 0
        )

    def proceed_to_stage2(self) -> pd.DataFrame:
        """Generate projection table and move to stage 2 (only from stage 1)."""
        if self.data.current_stage != PlannerStage.STAGE1_INPUT:
            raise ValueError("Can only proceed to stage 2 from stage 1")

        if not self.can_proceed_to_stage2():
            raise ValueError("Missing required data for stage 2")

        # Clean up any invalid overrides from previous stage 1 edits
        self._clean_invalid_overrides()

        # Generate base projection DataFrame WITHOUT overrides
        # Overrides will be applied visually in UI, but base df stays clean
        self.data.projection_df = self._generate_initial_projection()

        self.data.current_stage = PlannerStage.STAGE2_ADJUSTMENT
        self.data.update_timestamp()

        return self.data.projection_df

    # ===================
    # Stage 2: Table Adjustment
    # ===================

    def get_projection_dataframe(self) -> Optional[pd.DataFrame]:
        """Get current projection DataFrame with overrides applied (for stage 2)."""
        if self.data.current_stage != PlannerStage.STAGE2_ADJUSTMENT:
            return None

        if self.data.projection_df is None:
            return None

        # Return DataFrame with overrides applied for backward compatibility
        display_df = self.data.projection_df.copy()
        self._apply_overrides_to_df(display_df)
        return display_df

    def get_base_projection_dataframe(self) -> Optional[pd.DataFrame]:
        """Get base projection DataFrame WITHOUT overrides applied."""
        if self.data.current_stage != PlannerStage.STAGE2_ADJUSTMENT:
            return None
        return self.data.projection_df

    def apply_override(self, age: int, item_id: str, value: float) -> None:
        """Apply override to specific age and item (only in stage 2)."""
        if self.data.current_stage != PlannerStage.STAGE2_ADJUSTMENT:
            raise ValueError("Can only apply overrides in stage 2")

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
        """Remove override for specific age and item (only in stage 2)."""
        if self.data.current_stage != PlannerStage.STAGE2_ADJUSTMENT:
            raise ValueError("Can only remove overrides in stage 2")

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

    def can_proceed_to_stage3(self) -> bool:
        """Check if ready for stage 3 calculations."""
        return (
            self.data.current_stage == PlannerStage.STAGE2_ADJUSTMENT
            and self.data.projection_df is not None
        )

    def proceed_to_stage3(
        self, progress_callback: Optional[Any] = None
    ) -> PlannerResults:
        """Run calculations and move to stage 3 (only from stage 2)."""
        if self.data.current_stage != PlannerStage.STAGE2_ADJUSTMENT:
            raise ValueError("Can only proceed to stage 3 from stage 2")

        if not self.can_proceed_to_stage3():
            raise ValueError("Missing projection data for stage 3")

        # Run all calculations
        results = self._run_calculations(progress_callback)

        self.data.results = results
        self.data.current_stage = PlannerStage.STAGE3_ANALYSIS
        self.data.update_timestamp()

        return results

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

    def reset_to_stage1(self) -> None:
        """Reset planner to stage 1 (keep profile and items, clear results)."""
        self.data.current_stage = PlannerStage.STAGE1_INPUT
        self.data.projection_df = None
        self.data.overrides.clear()
        self.data.results = None
        self.data.update_timestamp()

    # ===================
    # Stage Navigation Methods
    # ===================

    def back_to_stage1(self) -> None:
        """Go back to stage 1 from stage 2, clearing projection df but
        preserving overrides."""
        if self.data.current_stage != PlannerStage.STAGE2_ADJUSTMENT:
            raise ValueError("Can only go back to stage 1 from stage 2")

        # Clear projection df - will be regenerated when proceeding to stage 2 again
        self.data.projection_df = None

        self.data.current_stage = PlannerStage.STAGE1_INPUT
        self.data.results = None  # Clear results when going back
        self.data.update_timestamp()

    def back_to_stage2(self) -> pd.DataFrame:
        """Go back to stage 2 from stage 3, preserving projection and overrides."""
        if self.data.current_stage != PlannerStage.STAGE3_ANALYSIS:
            raise ValueError("Can only go back to stage 2 from stage 3")

        if self.data.projection_df is None:
            raise ValueError("No projection data available")

        self.data.current_stage = PlannerStage.STAGE2_ADJUSTMENT
        self.data.results = None  # Clear results when going back
        self.data.update_timestamp()

        # Return projection with overrides applied (for display)
        return self.get_projection_dataframe()

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
            # Get effective age range (supports predefined items)
            effective_start_age, effective_end_age = item.get_effective_age_range(
                profile
            )

            column_values: List[float] = []
            for age in ages:
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
            # Get effective age range (supports predefined items)
            effective_start_age, effective_end_age = item.get_effective_age_range(
                profile
            )

            expense_column_values: List[float] = []
            for age in ages:
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

    def _sync_predefined_items_with_profile(self) -> None:
        """Sync all predefined items with current profile."""
        if not self.data.user_profile:
            return

        # Update all predefined income items
        for item in self.data.income_items:
            if item.is_predefined_item():
                item.sync_with_profile(self.data.user_profile)

        # Update all predefined expense items
        for item in self.data.expense_items:
            if item.is_predefined_item():
                item.sync_with_profile(self.data.user_profile)

    def create_predefined_income_item(
        self,
        predefined_type: str,
        amount: float,
        growth_rate: float = 0.0,
        name: Optional[str] = None,
    ) -> str:
        """Create a predefined income item.

        Args:
            predefined_type: Type of predefined item (e.g., 'primary_work_income')
            amount: After-tax amount per year
            growth_rate: Annual growth rate as percentage
            name: Optional custom name (uses default if not provided)

        Returns:
            ID of the created item
        """
        # Define default names and categories
        defaults = {
            "primary_work_income": {
                "name": "Primary Work Income",
                "category": "Employment",
            },
            "government_pension": {"name": "Government Pension", "category": "Pension"},
        }

        if predefined_type not in defaults:
            raise ValueError(f"Invalid predefined income type: {predefined_type}")

        if not self.data.user_profile:
            raise ValueError(
                "User profile must be set before creating predefined items"
            )

        # Create temporary item to get age range
        temp_item = IncomeExpenseItem(
            name=name or defaults[predefined_type]["name"],
            after_tax_amount_per_period=amount,
            start_age=0,  # Will be overwritten
            end_age=0,  # Will be overwritten
            annual_growth_rate=growth_rate,
            is_income=True,
            category=defaults[predefined_type]["category"],
            predefined_type=predefined_type,
        )

        # Get the correct age range
        start_age, end_age = temp_item.get_effective_age_range(self.data.user_profile)
        temp_item.start_age = start_age
        temp_item.end_age = end_age

        return self.add_income_item(temp_item)

    def create_predefined_expense_item(
        self,
        predefined_type: str,
        amount: float,
        growth_rate: float = 0.0,
        name: Optional[str] = None,
    ) -> str:
        """Create a predefined expense item.

        Args:
            predefined_type: Type of predefined item (e.g., 'basic_living_expenses')
            amount: After-tax amount per year
            growth_rate: Annual growth rate as percentage
            name: Optional custom name (uses default if not provided)

        Returns:
            ID of the created item
        """
        # Define default names and categories
        defaults = {
            "basic_living_expenses": {
                "name": "Basic Living Expenses",
                "category": "Living",
            },
        }

        if predefined_type not in defaults:
            raise ValueError(f"Invalid predefined expense type: {predefined_type}")

        if not self.data.user_profile:
            raise ValueError(
                "User profile must be set before creating predefined items"
            )

        # Create temporary item to get age range
        temp_item = IncomeExpenseItem(
            name=name or defaults[predefined_type]["name"],
            after_tax_amount_per_period=amount,
            start_age=0,  # Will be overwritten
            end_age=0,  # Will be overwritten
            annual_growth_rate=growth_rate,
            is_income=False,
            category=defaults[predefined_type]["category"],
            predefined_type=predefined_type,
        )

        # Get the correct age range
        start_age, end_age = temp_item.get_effective_age_range(self.data.user_profile)
        temp_item.start_age = start_age
        temp_item.end_age = end_age

        return self.add_expense_item(temp_item)

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

        # Get recommendations
        recommendations = []
        try:
            advisor = FIREAdvisor(engine_input)
            recommendations = advisor.get_all_recommendations()
        except Exception:
            # Recommendations are optional, don't fail if they error
            pass

        return PlannerResults(
            fire_calculation=fire_result,
            monte_carlo_success_rate=monte_carlo_success_rate,
            recommendations=recommendations,
        )
