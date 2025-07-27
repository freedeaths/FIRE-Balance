import sys
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal
from enum import Enum
from typing import Any, Callable, Optional, Tuple

import pandas as pd
from pydantic import BaseModel, Field, model_validator


class ItemFrequency(str, Enum):
    """Enum for income/expense item frequency."""

    RECURRING = "recurring"
    ONE_TIME = "one-time"


class TimeUnit(str, Enum):
    """Time unit for amount input."""

    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUALLY = "annually"


class LiquidityLevel(str, Enum):
    """Asset liquidity level for cash flow strategy optimization."""

    HIGH = "high"  # Cash, checking accounts, money market funds - immediately available
    MEDIUM = (
        "medium"  # Stocks, ETFs - physically liquid but psychologically less frequent
    )
    LOW = "low"  # CDs, bonds - early withdrawal may incur penalties


class AssetClass(BaseModel):
    """Individual asset class in portfolio."""

    name: str = Field(
        ..., description="Asset class name (e.g., 'stocks', 'bonds', 'savings', 'cash')"
    )
    display_name: str = Field(
        default="", description="Original display name for UI (auto-filled if empty)"
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_name(cls, data: Any) -> Any:
        """Normalize asset name for internal consistency"""
        if isinstance(data, dict) and "name" in data:
            original_name = str(data["name"]).strip()
            # Store original for display if display_name not provided
            if not data.get("display_name"):
                data["display_name"] = original_name
            # Normalize: lowercase + collapse multiple spaces to single space
            import re  # noqa: F401 - local import for validation

            normalized_name = re.sub(r"\s+", " ", original_name.lower().strip())
            data["name"] = normalized_name
        return data

    allocation_percentage: float = Field(
        ..., description="Allocation percentage", ge=0.0, le=100.0
    )
    expected_return: float = Field(
        ..., description="Expected annual return rate (%) - after tax"
    )
    volatility: float = Field(
        0.0,
        description=(
            "Expected volatility/risk (%) - ONLY used for Monte Carlo simulations"
        ),
    )
    liquidity_level: LiquidityLevel = Field(
        LiquidityLevel.MEDIUM,
        description="Asset liquidity level for cash flow optimization",
    )


class PortfolioConfiguration(BaseModel):
    """Investment portfolio configuration."""

    asset_classes: list[AssetClass] = Field(
        default_factory=lambda: [
            AssetClass(
                name="Stocks",  # Will be normalized to "stocks"
                display_name="Stocks",
                allocation_percentage=30.0,
                expected_return=5.0,
                volatility=15.0,
                liquidity_level=LiquidityLevel.MEDIUM,
            ),
            AssetClass(
                name="Bonds",  # Will be normalized to "bonds"
                display_name="Bonds",
                allocation_percentage=0.0,
                expected_return=3.0,
                volatility=5.0,
                liquidity_level=LiquidityLevel.LOW,
            ),
            AssetClass(
                name="Savings",  # Will be normalized to "savings"
                display_name="Savings",
                allocation_percentage=60.0,
                expected_return=1.0,
                volatility=5.0,
                liquidity_level=LiquidityLevel.LOW,
            ),
            AssetClass(
                name="Cash",  # Will be normalized to "cash"
                display_name="Cash",
                allocation_percentage=10.0,
                expected_return=0.0,
                volatility=1.0,
                liquidity_level=LiquidityLevel.HIGH,
            ),
        ],
        description="List of asset classes in the portfolio",
    )

    enable_rebalancing: bool = Field(
        True, description="Whether to rebalance portfolio annually"
    )

    @model_validator(mode="after")
    def validate_allocation_sum(self) -> "PortfolioConfiguration":
        """Validate that asset allocations sum to 100% (strict validation)"""
        total = sum(asset.allocation_percentage for asset in self.asset_classes)
        # Use sys.float_info.epsilon for machine precision tolerance
        tolerance = sys.float_info.epsilon

        if abs(total - 100.0) > tolerance:
            raise ValueError(
                f"Asset allocation percentages must sum to exactly 100%, "
                f"got {total}% (difference: {total - 100.0}%)"
            )
        return self

    @model_validator(mode="after")
    def validate_unique_asset_names(self) -> "PortfolioConfiguration":
        """Validate that asset names are unique within portfolio (case-insensitive)"""
        names = [
            asset.name for asset in self.asset_classes
        ]  # Already normalized to lowercase
        if len(names) != len(set(names)):
            duplicates = [name for name in names if names.count(name) > 1]
            unique_duplicates = list(set(duplicates))
            # Show display names in error for better UX
            display_names = [
                asset.display_name
                for asset in self.asset_classes
                if asset.name in unique_duplicates
            ]
            raise ValueError(
                f"Asset names must be unique within portfolio (case-insensitive). "
                f"Duplicate names found: {display_names}"
            )
        return self


class UserProfile(BaseModel):
    """Data model for the user's profile."""

    birth_year: int = Field(..., description="User's birth year")
    expected_fire_age: int = Field(50, description="User's expected FIRE age")
    legal_retirement_age: int = Field(
        65, description="Legal retirement age (when eligible for government pension)"
    )
    life_expectancy: int = Field(85, description="User's life expectancy")
    current_net_worth: float = Field(
        0.0, description="User's current net worth (after-tax value)"
    )
    inflation_rate: float = Field(3.0, description="Expected annual inflation rate (%)")

    # Safety buffer configuration
    safety_buffer_months: float = Field(
        12.0,
        description="Safety buffer in months of annual expenses (default: 12 months)",
    )

    # Investment configuration
    portfolio: PortfolioConfiguration = Field(
        default_factory=lambda: PortfolioConfiguration(enable_rebalancing=True)
    )

    @property
    def current_age(self) -> int:
        """Calculate current age from birth year"""
        from datetime import datetime

        return datetime.now().year - self.birth_year

    # Birth year validation
    @model_validator(mode="after")
    def validate_birth_year(self) -> "UserProfile":
        """Validate birth year is reasonable"""
        from datetime import datetime

        current_year = datetime.now().year
        if self.birth_year < 1950 or self.birth_year > current_year:
            raise ValueError(
                f"Birth year must be between 1950 and {current_year}, "
                f"got {self.birth_year}"
            )
        return self

    # Age validation using chain comparison
    @model_validator(mode="after")
    def validate_age_progression(self) -> "UserProfile":
        """
        Validate ages follow logic: current <= fire <= retirement <= life_expectancy
        """
        current = self.current_age
        fire = self.expected_fire_age
        retirement = self.legal_retirement_age
        life = self.life_expectancy

        if not (current <= fire <= retirement <= life):
            raise ValueError(
                f"Ages must follow progression: current_age({current}) <= "
                f"expected_fire_age({fire}) <= legal_retirement_age({retirement}) <= "
                f"life_expectancy({life})"
            )
        return self


class IncomeExpenseItem(BaseModel):
    """Data model for a single income or expense item."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str

    # Amount and time unit (after-tax values)
    after_tax_amount_per_period: float = Field(
        ..., description="After-tax amount per time period"
    )
    time_unit: TimeUnit = Field(
        TimeUnit.ANNUALLY, description="Time unit for the amount"
    )

    # Frequency control
    frequency: ItemFrequency = Field(
        ItemFrequency.RECURRING, description="Frequency type"
    )
    interval_periods: int = Field(
        1,
        description=(
            "Interval in time_unit periods "
            "(e.g., 6 for every 6 months if time_unit is monthly)"
        ),
        gt=0,
    )

    # Time range
    start_age: int = Field(..., description="The age this item starts")
    end_age: Optional[int] = Field(
        None, description="The age this item ends (for recurring items)"
    )

    # Growth rate (always annualized, after-tax)
    annual_growth_rate: float = Field(
        0.0, description="Annual growth rate (%) - after tax"
    )

    # Additional fields for categorization and validation
    is_income: bool = Field(..., description="True for income, False for expense")
    category: Optional[str] = Field(
        None, description="Category for grouping (e.g., 'Housing', 'Transportation')"
    )


# =============================================================================
# Calculation Results
# =============================================================================


@dataclass
class YearlyState:
    """Complete state for a single year in FIRE calculation."""

    age: int
    year: int

    # Cash flows (from input table)
    total_income: float
    total_expense: float
    net_cash_flow: float  # income - expense

    # Portfolio state
    portfolio_value: Decimal
    investment_return: Decimal  # Annual return from portfolio

    # Sustainability metrics (core logic)
    safety_buffer_amount: float  # Required safety buffer based on annual expenses
    is_sustainable: (
        bool  # True if net worth can remain above safety buffer through life expectancy
    )

    # Traditional FIRE metrics (optional reference)
    fire_number: float  # 25x annual expenses (4% rule) - for reference only
    fire_progress: float  # portfolio_value / fire_number (0-1+) - for reference only


class FIRECalculationResult(BaseModel):
    """Complete FIRE calculation result."""

    # Core sustainability results
    is_fire_achievable: bool = Field(
        ..., description="Whether FIRE is achievable based on net worth sustainability"
    )
    fire_net_worth: float = Field(..., description="Net worth at expected FIRE age")

    # Net worth trajectory analysis
    min_net_worth_after_fire: float = Field(
        ..., description="Minimum net worth during retirement phase"
    )
    final_net_worth: float = Field(
        ..., description="Net worth at end of life expectancy"
    )

    # Safety buffer analysis
    safety_buffer_months: float = Field(
        ..., description="Configured safety buffer in months"
    )
    min_safety_buffer_ratio: float = Field(
        ..., description="Minimum ratio of net worth to safety buffer (worst case)"
    )

    # Detailed yearly results
    yearly_results: list[YearlyState] = Field(
        ..., description="Year-by-year calculation results"
    )

    # Traditional FIRE metrics (for reference)
    traditional_fire_number: float = Field(
        ..., description="Traditional 4% rule FIRE number (25x expenses)"
    )
    traditional_fire_achieved: bool = Field(
        ..., description="Whether traditional 4% FIRE is achieved"
    )

    # Risk analysis (will be populated by Monte Carlo)
    fire_success_probability: Optional[float] = Field(
        None, description="Monte Carlo success probability (0-1)"
    )

    # Summary statistics
    total_years_simulated: int = Field(..., description="Total years in simulation")
    retirement_years: int = Field(
        ..., description="Years from FIRE age to life expectancy"
    )


# =============================================================================
# Simulation and Events
# =============================================================================


@dataclass
class BlackSwanEvent(ABC):
    """Base class for black swan events with self-contained calculation logic."""

    event_id: str  # Unique identifier (e.g., 'financial_crisis')
    annual_probability: float  # Annual occurrence probability (0-1)
    duration_years: int  # Duration of impact in years
    recovery_factor: float  # Recovery factor (0-1, 1 means full recovery)
    age_range: Tuple[int, int] = (18, 100)  # Applicable age range

    @abstractmethod
    def apply_impact(
        self, df: pd.DataFrame, year_idx: int, recovery_multiplier: float = 1.0
    ) -> pd.DataFrame:
        """Apply this event's impact to a specific year.

        Args:
            df: DataFrame to modify
            year_idx: Year index in the DataFrame
            recovery_multiplier: Multiplier for recovery (< 1.0 for ongoing events)

        Returns:
            Modified DataFrame
        """

    def get_display_name(self, i18n_func: Optional[Callable[[str], str]] = None) -> str:
        """Get localized display name for this event.

        Args:
            i18n_func: i18n function, if None returns event_id

        Returns:
            Localized event name or event_id as fallback
        """
        if i18n_func:
            return i18n_func(f"events.{self.event_id}.name")
        return self.event_id


class SimulationSettings(BaseModel):
    """Monte Carlo simulation settings."""

    num_simulations: int = Field(1000, description="Number of simulations to run")
    confidence_level: float = Field(
        0.95, description="Confidence level for results", ge=0.5, le=0.99
    )
    include_black_swan_events: bool = Field(
        True,
        description="Whether to include black swan events (including market crashes)",
    )

    # Base variation parameters (daily fluctuations, excluding major events)
    # Both use normal distribution with mean=1.0 and configurable standard deviation
    income_base_volatility: float = Field(
        0.1, description="Base income volatility (standard deviation)", ge=0.0, le=1.0
    )
    income_minimum_factor: float = Field(
        0.1, description="Minimum income factor (safety net threshold)", ge=0.01, le=1.0
    )

    expense_base_volatility: float = Field(
        0.05, description="Base expense volatility (standard deviation)", ge=0.0, le=1.0
    )
    expense_minimum_factor: float = Field(
        0.5,
        description="Minimum expense factor (prevents expenses going too low)",
        ge=0.1,
        le=1.0,
    )
