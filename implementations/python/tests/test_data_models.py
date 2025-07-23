"""Tests for data models."""

import pytest
from pydantic import ValidationError

from core.data_models import IncomeExpenseItem, ItemFrequency, TimeUnit, UserProfile


def test_user_profile_valid_ages() -> None:
    """Test UserProfile with valid age progression."""
    profile = UserProfile(
        current_age=30,
        expected_fire_age=45,
        legal_retirement_age=65,
        life_expectancy=85,
        current_net_worth=100000.0,
        inflation_rate=3.0,
    )
    assert profile.current_age == 30
    assert profile.expected_fire_age == 45
    assert profile.legal_retirement_age == 65
    assert profile.life_expectancy == 85


def test_user_profile_invalid_age_progression() -> None:
    """Test UserProfile with invalid age progression."""
    with pytest.raises(ValidationError) as exc_info:
        UserProfile(
            current_age=30,
            expected_fire_age=25,  # Invalid: before current age
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=100000.0,
            inflation_rate=3.0,
        )

    error_msg = str(exc_info.value)
    assert "Ages must follow progression" in error_msg


def test_income_expense_item_creation() -> None:
    """Test IncomeExpenseItem creation."""
    item = IncomeExpenseItem(
        name="Salary",
        after_tax_amount_per_period=8000.0,
        time_unit=TimeUnit.MONTHLY,
        frequency=ItemFrequency.RECURRING,
        start_age=25,
        end_age=65,
        is_income=True,
        interval_periods=1,
        annual_growth_rate=0.0,
        category="Employment",
    )

    assert item.name == "Salary"
    assert item.after_tax_amount_per_period == 8000.0
    assert item.time_unit == TimeUnit.MONTHLY
    assert item.is_income is True
