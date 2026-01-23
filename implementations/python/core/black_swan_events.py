"""Concrete black swan event implementations with self-contained calculation logic.
Manually make all annual_probability *= 0.2."""

from dataclasses import dataclass
from typing import TYPE_CHECKING, Tuple

import pandas as pd

from .data_models import BlackSwanEvent

if TYPE_CHECKING:
    from .data_models import UserProfile

# =============================================================================
# Economic and Financial Crisis Events
# =============================================================================


@dataclass
class FinancialCrisisEvent(BlackSwanEvent):
    """Major financial crisis affecting portfolio returns."""

    def __init__(self, age_range: Tuple[int, int] = (18, 100)):
        super().__init__(
            event_id="financial_crisis",
            annual_probability=0.016,
            duration_years=2,
            recovery_factor=0.8,
            age_range=age_range,
        )

    def apply_impact(
        self, df: pd.DataFrame, year_idx: int, recovery_multiplier: float = 1.0
    ) -> pd.DataFrame:
        """Apply financial crisis impact: -40% portfolio return with recovery."""
        modified_df = df.copy()
        impact_multiplier = 1 + (-0.4 * recovery_multiplier)
        modified_df.iloc[
            year_idx, modified_df.columns.get_loc("total_income")
        ] *= impact_multiplier
        return modified_df


@dataclass
class EconomicRecessionEvent(BlackSwanEvent):
    """Economic recession with moderate portfolio impact."""

    def __init__(self, age_range: Tuple[int, int] = (18, 100)):
        super().__init__(
            event_id="economic_recession",
            annual_probability=0.03,
            duration_years=1,
            recovery_factor=0.9,
            age_range=age_range,
        )

    def apply_impact(
        self, df: pd.DataFrame, year_idx: int, recovery_multiplier: float = 1.0
    ) -> pd.DataFrame:
        """Apply recession impact: -25% portfolio return."""
        modified_df = df.copy()
        impact_multiplier = 1 + (-0.25 * recovery_multiplier)
        modified_df.iloc[
            year_idx, modified_df.columns.get_loc("total_income")
        ] *= impact_multiplier
        return modified_df


@dataclass
class MarketCrashEvent(BlackSwanEvent):
    """Stock market crash with sharp portfolio decline."""

    def __init__(self, age_range: Tuple[int, int] = (18, 100)):
        super().__init__(
            event_id="market_crash",
            annual_probability=0.02,
            duration_years=1,
            recovery_factor=0.9,
            age_range=age_range,
        )

    def apply_impact(
        self, df: pd.DataFrame, year_idx: int, recovery_multiplier: float = 1.0
    ) -> pd.DataFrame:
        """Apply market crash impact: -30% portfolio return."""
        modified_df = df.copy()
        impact_multiplier = 1 + (-0.3 * recovery_multiplier)
        modified_df.iloc[
            year_idx, modified_df.columns.get_loc("total_income")
        ] *= impact_multiplier
        return modified_df


@dataclass
class HyperinflationEvent(BlackSwanEvent):
    """Hyperinflation affecting both returns and expenses."""

    def __init__(self, age_range: Tuple[int, int] = (18, 100)):
        super().__init__(
            event_id="hyperinflation",
            annual_probability=0.01,
            duration_years=3,
            recovery_factor=0.7,
            age_range=age_range,
        )

    def apply_impact(
        self, df: pd.DataFrame, year_idx: int, recovery_multiplier: float = 1.0
    ) -> pd.DataFrame:
        """Apply hyperinflation: reduced real returns and increased expenses."""
        modified_df = df.copy()

        # Reduced real returns (negative impact on income)
        income_impact = 1 + (-0.3 * recovery_multiplier)
        modified_df.iloc[
            year_idx, modified_df.columns.get_loc("total_income")
        ] *= income_impact

        # Increased expenses
        expense_impact = 1 + (0.3 * recovery_multiplier)
        modified_df.iloc[
            year_idx, modified_df.columns.get_loc("total_expense")
        ] *= expense_impact

        return modified_df


# =============================================================================
# Career and Employment Events
# =============================================================================


@dataclass
class UnemploymentEvent(BlackSwanEvent):
    """Job loss with severe income impact."""

    def __init__(self, age_range: Tuple[int, int] = (22, 65)):
        super().__init__(
            event_id="unemployment",
            annual_probability=0.006,
            duration_years=2,
            recovery_factor=0.4,
            age_range=age_range,
        )

    def apply_impact(
        self, df: pd.DataFrame, year_idx: int, recovery_multiplier: float = 1.0
    ) -> pd.DataFrame:
        """Apply unemployment: major income loss with minimum safety net."""
        modified_df = df.copy()
        # -100% income initially, but with 10% minimum (unemployment benefits, etc.)
        income_multiplier = max(0.1, 1 + (-1.0 * recovery_multiplier))
        modified_df.iloc[
            year_idx, modified_df.columns.get_loc("total_income")
        ] *= income_multiplier
        return modified_df


@dataclass
class IndustryCollapseEvent(BlackSwanEvent):
    """Industry-wide collapse affecting career prospects."""

    def __init__(self, age_range: Tuple[int, int] = (22, 65)):
        super().__init__(
            event_id="industry_collapse",
            annual_probability=0.002,
            duration_years=3,
            recovery_factor=0.6,
            age_range=age_range,
        )

    def apply_impact(
        self, df: pd.DataFrame, year_idx: int, recovery_multiplier: float = 1.0
    ) -> pd.DataFrame:
        """Apply industry collapse: -70% income impact."""
        modified_df = df.copy()
        income_multiplier = max(0.1, 1 + (-0.7 * recovery_multiplier))
        modified_df.iloc[
            year_idx, modified_df.columns.get_loc("total_income")
        ] *= income_multiplier
        return modified_df


@dataclass
class UnexpectedPromotionEvent(BlackSwanEvent):
    """Unexpected career advancement with income boost."""

    def __init__(self, age_range: Tuple[int, int] = (25, 60)):
        super().__init__(
            event_id="unexpected_promotion",
            annual_probability=0.004,
            duration_years=5,
            recovery_factor=1.0,
            age_range=age_range,
        )

    def apply_impact(
        self, df: pd.DataFrame, year_idx: int, recovery_multiplier: float = 1.0
    ) -> pd.DataFrame:
        """Apply promotion: +30% income boost."""
        modified_df = df.copy()
        income_multiplier = 1 + (0.3 * recovery_multiplier)
        modified_df.iloc[
            year_idx, modified_df.columns.get_loc("total_income")
        ] *= income_multiplier
        return modified_df


# =============================================================================
# Health and Medical Events
# =============================================================================


@dataclass
class MajorIllnessEvent(BlackSwanEvent):
    """Major medical expenses from serious illness."""

    def __init__(self, age_range: Tuple[int, int] = (18, 100)):
        super().__init__(
            event_id="major_illness",
            annual_probability=0.004,
            duration_years=2,
            recovery_factor=0.9,
            age_range=age_range,
        )

    def apply_impact(
        self, df: pd.DataFrame, year_idx: int, recovery_multiplier: float = 1.0
    ) -> pd.DataFrame:
        """Apply major illness: +150% expense increase."""
        modified_df = df.copy()
        expense_multiplier = 1 + (1.5 * recovery_multiplier)
        modified_df.iloc[
            year_idx, modified_df.columns.get_loc("total_expense")
        ] *= expense_multiplier
        return modified_df


@dataclass
class LongTermCareEvent(BlackSwanEvent):
    """Long-term care needs in retirement."""

    def __init__(self, age_range: Tuple[int, int] = (65, 100)):
        super().__init__(
            event_id="long_term_care",
            annual_probability=0.001,
            duration_years=10,
            recovery_factor=0.5,
            age_range=age_range,
        )

    def apply_impact(
        self, df: pd.DataFrame, year_idx: int, recovery_multiplier: float = 1.0
    ) -> pd.DataFrame:
        """Apply long-term care: +120% expense increase."""
        modified_df = df.copy()
        expense_multiplier = 1 + (1.2 * recovery_multiplier)
        modified_df.iloc[
            year_idx, modified_df.columns.get_loc("total_expense")
        ] *= expense_multiplier
        return modified_df


# =============================================================================
# Geopolitical and Global Events
# =============================================================================


@dataclass
class RegionalConflictEvent(BlackSwanEvent):
    """Regional conflict with moderate economic impact."""

    def __init__(self, age_range: Tuple[int, int] = (18, 100)):
        super().__init__(
            event_id="regional_conflict",
            annual_probability=0.006,
            duration_years=2,
            recovery_factor=0.9,
            age_range=age_range,
        )

    def apply_impact(
        self, df: pd.DataFrame, year_idx: int, recovery_multiplier: float = 1.0
    ) -> pd.DataFrame:
        """Apply regional conflict: moderate market decline and cost increases."""
        modified_df = df.copy()

        # Portfolio impact
        income_impact = 1 + (-0.2 * recovery_multiplier)
        modified_df.iloc[
            year_idx, modified_df.columns.get_loc("total_income")
        ] *= income_impact

        # Cost increases
        expense_impact = 1 + (0.1 * recovery_multiplier)  # Moderate expense increase
        modified_df.iloc[
            year_idx, modified_df.columns.get_loc("total_expense")
        ] *= expense_impact

        return modified_df


@dataclass
class GlobalWarEvent(BlackSwanEvent):
    """Global war with severe economic disruption."""

    def __init__(self, age_range: Tuple[int, int] = (18, 100)):
        super().__init__(
            event_id="global_war",
            annual_probability=0.0016,
            duration_years=4,
            recovery_factor=0.7,
            age_range=age_range,
        )

    def apply_impact(
        self, df: pd.DataFrame, year_idx: int, recovery_multiplier: float = 1.0
    ) -> pd.DataFrame:
        """Apply global war: severe economic disruption."""
        modified_df = df.copy()

        # Major economic disruption
        income_impact = 1 + (-0.6 * recovery_multiplier)
        modified_df.iloc[
            year_idx, modified_df.columns.get_loc("total_income")
        ] *= income_impact

        # Major cost increases
        expense_impact = 1 + (0.4 * recovery_multiplier)  # 40% expense increase
        modified_df.iloc[
            year_idx, modified_df.columns.get_loc("total_expense")
        ] *= expense_impact

        return modified_df


@dataclass
class EconomicSanctionsEvent(BlackSwanEvent):
    """Economic sanctions affecting portfolio returns."""

    def __init__(self, age_range: Tuple[int, int] = (18, 100)):
        super().__init__(
            event_id="economic_sanctions",
            annual_probability=0.004,
            duration_years=3,
            recovery_factor=0.8,
            age_range=age_range,
        )

    def apply_impact(
        self, df: pd.DataFrame, year_idx: int, recovery_multiplier: float = 1.0
    ) -> pd.DataFrame:
        """Apply economic sanctions: -30% portfolio impact."""
        modified_df = df.copy()
        impact_multiplier = 1 + (-0.3 * recovery_multiplier)
        modified_df.iloc[
            year_idx, modified_df.columns.get_loc("total_income")
        ] *= impact_multiplier
        return modified_df


@dataclass
class EnergyCrisisEvent(BlackSwanEvent):
    """Energy crisis affecting costs and some portfolio returns."""

    def __init__(self, age_range: Tuple[int, int] = (18, 100)):
        super().__init__(
            event_id="energy_crisis",
            annual_probability=0.008,
            duration_years=2,
            recovery_factor=0.85,
            age_range=age_range,
        )

    def apply_impact(
        self, df: pd.DataFrame, year_idx: int, recovery_multiplier: float = 1.0
    ) -> pd.DataFrame:
        """Apply energy crisis: moderate portfolio impact and energy cost increases."""
        modified_df = df.copy()

        # Portfolio impact
        income_impact = 1 + (-0.25 * recovery_multiplier)
        modified_df.iloc[
            year_idx, modified_df.columns.get_loc("total_income")
        ] *= income_impact

        # Energy cost increases
        expense_impact = 1 + (0.25 * recovery_multiplier)
        modified_df.iloc[
            year_idx, modified_df.columns.get_loc("total_expense")
        ] *= expense_impact

        return modified_df


# =============================================================================
# Opportunity Events
# =============================================================================


@dataclass
class InheritanceEvent(BlackSwanEvent):
    """Unexpected inheritance (special absolute amount handling)."""

    def __init__(self, age_range: Tuple[int, int] = (30, 70)):
        super().__init__(
            event_id="inheritance",
            annual_probability=0.0016,
            duration_years=1,
            recovery_factor=1.0,
            age_range=age_range,
        )

    def apply_impact(
        self, df: pd.DataFrame, year_idx: int, recovery_multiplier: float = 1.0
    ) -> pd.DataFrame:
        """Apply inheritance: lump sum addition (2x current income)."""
        modified_df = df.copy()
        current_income = modified_df.iloc[year_idx]["total_income"]

        # Special case: absolute amount addition (not multiplication)
        inheritance_amount = 2.0 * current_income * recovery_multiplier
        modified_df.iloc[
            year_idx, modified_df.columns.get_loc("total_income")
        ] += inheritance_amount

        return modified_df


@dataclass
class InvestmentWindfallEvent(BlackSwanEvent):
    """Unexpected investment windfall."""

    def __init__(self, age_range: Tuple[int, int] = (22, 65)):
        super().__init__(
            event_id="investment_windfall",
            annual_probability=0.0002,
            duration_years=1,
            recovery_factor=1.0,
            age_range=age_range,
        )

    def apply_impact(
        self, df: pd.DataFrame, year_idx: int, recovery_multiplier: float = 1.0
    ) -> pd.DataFrame:
        """Apply investment windfall: +300% portfolio return."""
        modified_df = df.copy()
        impact_multiplier = 1 + (3.0 * recovery_multiplier)
        modified_df.iloc[
            year_idx, modified_df.columns.get_loc("total_income")
        ] *= impact_multiplier
        return modified_df


# =============================================================================
# Event Factory
# =============================================================================


def create_black_swan_events(user_profile: "UserProfile") -> list[BlackSwanEvent]:
    """Create personalized black swan events based on user profile.

    Args:
        user_profile: User profile with age and retirement information

    Returns:
        List of black swan events with age ranges tailored to the user
    """
    current_age = user_profile.current_age
    fire_age = user_profile.expected_fire_age
    legal_retirement_age = user_profile.legal_retirement_age
    life_expectancy = user_profile.life_expectancy

    # Define working period and retirement period
    working_start = max(22, current_age)  # Start from current age or 22
    working_end = min(fire_age, legal_retirement_age)  # End at FIRE or legal retirement
    retirement_end = life_expectancy
    career_start = current_age
    career_end = fire_age

    return [
        # Economic and financial crisis events
        FinancialCrisisEvent(age_range=(working_start, retirement_end)),
        EconomicRecessionEvent(age_range=(working_start, retirement_end)),
        MarketCrashEvent(age_range=(working_start, retirement_end)),
        HyperinflationEvent(age_range=(working_start, retirement_end)),
        # Career and employment events
        UnemploymentEvent(age_range=(career_start, career_end)),
        IndustryCollapseEvent(age_range=(working_start, working_end)),
        UnexpectedPromotionEvent(age_range=(career_start, career_end)),
        # Health and medical events
        MajorIllnessEvent(age_range=(working_start, life_expectancy)),
        LongTermCareEvent(age_range=(legal_retirement_age, life_expectancy)),
        # Geopolitical and global events
        RegionalConflictEvent(age_range=(current_age, retirement_end)),
        GlobalWarEvent(age_range=(current_age, retirement_end)),
        EconomicSanctionsEvent(age_range=(working_start, retirement_end)),
        EnergyCrisisEvent(age_range=(current_age, retirement_end)),
        # Opportunity events
        InheritanceEvent(age_range=(max(30, current_age), min(70, retirement_end))),
        InvestmentWindfallEvent(age_range=(working_start, working_end)),
    ]
