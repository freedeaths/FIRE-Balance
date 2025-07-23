import uuid
from dataclasses import dataclass
from enum import Enum
from typing import Optional

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


class AssetClass(BaseModel):
    """Individual asset class in portfolio."""

    name: str = Field(
        ..., description="Asset class name (e.g., 'Stocks', 'Bonds', 'Savings', 'Cash')"
    )
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


class PortfolioConfiguration(BaseModel):
    """Investment portfolio configuration."""

    asset_classes: list[AssetClass] = Field(
        default_factory=lambda: [
            AssetClass(
                name="Stocks",
                allocation_percentage=30.0,
                expected_return=5.0,
                volatility=15.0,
            ),
            AssetClass(
                name="Bonds",
                allocation_percentage=0.0,
                expected_return=3.0,
                volatility=5.0,
            ),
            AssetClass(
                name="Savings",
                allocation_percentage=60.0,
                expected_return=1.0,
                volatility=5.0,
            ),
            AssetClass(
                name="Cash",
                allocation_percentage=10.0,
                expected_return=0.0,
                volatility=1.0,
            ),
        ],
        description="List of asset classes in the portfolio",
    )

    enable_rebalancing: bool = Field(
        True, description="Whether to rebalance portfolio annually"
    )


class UserProfile(BaseModel):
    """Data model for the user's profile."""

    current_age: int = Field(30, description="User's current age")
    expected_fire_age: int = Field(50, description="User's expected FIRE age")
    legal_retirement_age: int = Field(
        65, description="Legal retirement age (when eligible for government pension)"
    )
    life_expectancy: int = Field(85, description="User's life expectancy")
    current_net_worth: float = Field(
        0.0, description="User's current net worth (after-tax value)"
    )
    inflation_rate: float = Field(3.0, description="Expected annual inflation rate (%)")

    # Investment configuration
    portfolio: PortfolioConfiguration = Field(
        default_factory=lambda: PortfolioConfiguration(enable_rebalancing=True)
    )

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
class YearlyCalculation:
    """Single year calculation result (all values after-tax)."""

    age: int
    year: int
    total_after_tax_income: float
    total_after_tax_expenses: float
    net_cash_flow: float  # after-tax income - after-tax expenses
    investment_return: float  # Annual investment return (after capital gains tax)
    net_worth: float  # Total net worth at end of year


class FIRECalculationResult(BaseModel):
    """Complete FIRE calculation result."""

    is_fire_achievable: bool
    fire_net_worth: float = Field(
        ..., description="Net worth when FIRE target is achieved"
    )
    yearly_results: list[YearlyCalculation]
    fire_success_probability: Optional[float] = Field(
        None, description="Monte Carlo success probability (0-1)"
    )


# =============================================================================
# Simulation and Events
# =============================================================================


@dataclass
class BlackSwanEvent:
    """Black swan event definition (from existing demo)."""

    name: str
    probability: float  # Annual occurrence probability (0-1)
    impact_type: str  # 'market', 'income', 'expense', 'mixed'
    severity: float  # Impact magnitude (-1 to 5, negative for adverse effects)
    duration_years: int  # Duration of impact in years
    recovery_factor: float  # Recovery factor (0-1, 1 means full recovery)
    age_range: tuple[int, int] = (18, 100)  # Applicable age range


class SimulationSettings(BaseModel):
    """Monte Carlo simulation settings."""

    num_simulations: int = Field(1000, description="Number of simulations to run")
    confidence_level: float = Field(
        0.95, description="Confidence level for results", ge=0.5, le=0.99
    )
    include_market_crashes: bool = Field(
        True, description="Whether to include market crash events"
    )
    crash_probability: float = Field(
        0.1, description="Annual market crash probability", ge=0.0, le=1.0
    )
    crash_severity: float = Field(
        -0.3, description="Market crash loss magnitude", ge=-1.0, le=0.0
    )
    include_black_swan_events: bool = Field(
        True, description="Whether to include black swan events"
    )
    custom_black_swan_events: list[BlackSwanEvent] = Field(
        default_factory=list, description="Custom black swan events"
    )
