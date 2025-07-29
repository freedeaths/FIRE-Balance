"""Data models for FIRE Planner system."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

import pandas as pd
from pydantic import BaseModel, Field

from .data_models import IncomeExpenseItem, SimulationSettings, UserProfile
from .engine import FIRECalculationResult


class PlannerStage(Enum):
    """Planner stages enumeration."""

    STAGE1_INPUT = "stage1_input"
    STAGE2_ADJUSTMENT = "stage2_adjustment"
    STAGE3_ANALYSIS = "stage3_analysis"


class Override(BaseModel):
    """Financial projection override for specific age/item."""

    age: int = Field(..., ge=0, le=150)
    item_id: str
    value: float

    class Config:
        json_encoders = {UUID: str}


# Removed AdjustableTable and AdjustableTableRow - using DataFrame directly


class PlannerResults(BaseModel):
    """Results from stage 3 calculations and analysis."""

    fire_calculation: FIRECalculationResult
    monte_carlo_success_rate: Optional[float] = None
    recommendations: List[Any] = Field(default_factory=list)
    calculation_timestamp: datetime = Field(default_factory=datetime.now)

    class Config:
        arbitrary_types_allowed = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class PlannerData(BaseModel):
    """Main data container for all planner stages."""

    # Stage tracking
    current_stage: PlannerStage = PlannerStage.STAGE1_INPUT

    # Stage 1: Input collection
    user_profile: Optional[UserProfile] = None
    income_items: List[IncomeExpenseItem] = Field(default_factory=list)
    expense_items: List[IncomeExpenseItem] = Field(default_factory=list)

    # Stage 2: Adjustments (using DataFrame directly)
    projection_df: Optional[pd.DataFrame] = None
    overrides: List[Override] = Field(default_factory=list)

    # Stage 3: Results
    results: Optional[PlannerResults] = None

    # Metadata
    session_id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    language: str = "en"

    # Monte Carlo simulation settings
    simulation_settings: SimulationSettings = Field(default_factory=SimulationSettings)

    class Config:
        arbitrary_types_allowed = True
        json_encoders = {
            UUID: str,
            datetime: lambda v: v.isoformat(),
            PlannerStage: lambda v: v.value,
        }

    def update_timestamp(self) -> None:
        """Update the updated_at timestamp."""
        self.updated_at = datetime.now()


class PlannerConfigV1(BaseModel):
    """Version 1.0 of planner configuration file format - Clean and Simple."""

    version: str = "1.0"

    # Metadata
    metadata: Dict[str, Any] = Field(default_factory=dict)

    # User profile and configuration
    profile: Dict[str, Any]

    # Income/expense items
    income_items: List[Dict[str, Any]]
    expense_items: List[Dict[str, Any]]

    # Overrides
    overrides: List[Dict[str, Any]] = Field(default_factory=list)

    # Monte Carlo simulation settings
    simulation_settings: Dict[str, Any] = Field(default_factory=dict)

    def to_planner_data(self) -> PlannerData:
        """Convert to PlannerData for use in planner."""
        # Convert profile dict to UserProfile model
        user_profile = UserProfile(**self.profile)

        # Convert income/expense items (no conversion needed - direct mapping)
        income_items = [IncomeExpenseItem(**item) for item in self.income_items]
        expense_items = [IncomeExpenseItem(**item) for item in self.expense_items]

        # Convert overrides
        overrides = [Override(**override) for override in self.overrides]

        # Convert simulation settings
        simulation_settings = (
            SimulationSettings(**self.simulation_settings)
            if self.simulation_settings
            else SimulationSettings()
        )

        return PlannerData(
            user_profile=user_profile,
            income_items=income_items,
            expense_items=expense_items,
            overrides=overrides,
            simulation_settings=simulation_settings,
            language=self.metadata.get("language", "en"),
        )

    @classmethod
    def from_planner_data(
        cls, planner_data: PlannerData, description: str = ""
    ) -> PlannerConfigV1:
        """Create from PlannerData for export."""
        return cls(
            metadata={
                "created_at": planner_data.created_at.isoformat(),
                "updated_at": planner_data.updated_at.isoformat(),
                "language": planner_data.language,
                "description": description,
            },
            profile=(
                planner_data.user_profile.model_dump()
                if planner_data.user_profile
                else {}
            ),
            income_items=[item.model_dump() for item in planner_data.income_items],
            expense_items=[item.model_dump() for item in planner_data.expense_items],
            overrides=[override.model_dump() for override in planner_data.overrides],
            simulation_settings=planner_data.simulation_settings.model_dump(),
        )
