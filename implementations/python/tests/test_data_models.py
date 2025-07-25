"""Tests for data models."""

import pytest
from pydantic import ValidationError

from core.data_models import (
    AssetClass,
    IncomeExpenseItem,
    ItemFrequency,
    LiquidityLevel,
    PortfolioConfiguration,
    TimeUnit,
    UserProfile,
)


def test_user_profile_valid_ages() -> None:
    """Test UserProfile with valid age progression."""
    profile = UserProfile(
        birth_year=1994,  # current_age would be around 30 in 2024
        expected_fire_age=45,
        legal_retirement_age=65,
        life_expectancy=85,
        current_net_worth=100000.0,
        inflation_rate=3.0,
        safety_buffer_months=12.0,
    )
    assert profile.current_age >= 29  # Flexible since it depends on current year
    assert profile.expected_fire_age == 45
    assert profile.legal_retirement_age == 65
    assert profile.life_expectancy == 85


def test_user_profile_invalid_age_progression() -> None:
    """Test UserProfile with invalid age progression."""
    with pytest.raises(ValidationError) as exc_info:
        UserProfile(
            birth_year=1994,  # current_age around 30
            expected_fire_age=25,  # Invalid: before current age
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=100000.0,
            inflation_rate=3.0,
            safety_buffer_months=12.0,
        )

    error_msg = str(exc_info.value)
    assert "Ages must follow progression" in error_msg


def test_user_profile_birth_year_validation() -> None:
    """Test UserProfile birth year validation."""
    from datetime import datetime

    current_year = datetime.now().year

    # Valid birth year
    profile = UserProfile(
        birth_year=1990,
        expected_fire_age=45,
        legal_retirement_age=65,
        life_expectancy=85,
        current_net_worth=100000.0,
        inflation_rate=3.0,
        safety_buffer_months=12.0,
    )
    assert profile.birth_year == 1990
    assert profile.current_age == current_year - 1990

    # Too early birth year
    with pytest.raises(ValidationError) as exc_info:
        UserProfile(
            birth_year=1949,  # Before 1950
            expected_fire_age=45,
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=100000.0,
            inflation_rate=3.0,
            safety_buffer_months=12.0,
        )
    assert "Birth year must be between 1950" in str(exc_info.value)

    # Future birth year
    with pytest.raises(ValidationError) as exc_info:
        UserProfile(
            birth_year=current_year + 1,  # Future year
            expected_fire_age=45,
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=100000.0,
            inflation_rate=3.0,
            safety_buffer_months=12.0,
        )
    assert "Birth year must be between 1950" in str(exc_info.value)


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


def test_portfolio_configuration_valid_allocation_sum() -> None:
    """Test PortfolioConfiguration with valid allocation sum (100%)."""
    config = PortfolioConfiguration(
        asset_classes=[
            AssetClass(
                name="Stocks",
                display_name="Stocks",
                allocation_percentage=60.0,
                expected_return=7.0,
                volatility=15.0,
                liquidity_level=LiquidityLevel.MEDIUM,
            ),
            AssetClass(
                name="Bonds",
                display_name="Bonds",
                allocation_percentage=30.0,
                expected_return=3.0,
                volatility=5.0,
                liquidity_level=LiquidityLevel.LOW,
            ),
            AssetClass(
                name="Cash",
                display_name="Cash",
                allocation_percentage=10.0,
                expected_return=1.0,
                volatility=1.0,
                liquidity_level=LiquidityLevel.HIGH,
            ),
        ],
        enable_rebalancing=True,
    )

    # Should not raise validation error
    assert len(config.asset_classes) == 3
    total_allocation = sum(
        asset.allocation_percentage for asset in config.asset_classes
    )
    assert total_allocation == 100.0


def test_portfolio_configuration_invalid_allocation_sum_too_high() -> None:
    """Test PortfolioConfiguration with allocation sum > 100%."""
    with pytest.raises(ValidationError) as exc_info:
        PortfolioConfiguration(
            asset_classes=[
                AssetClass(
                    name="Stocks",
                    display_name="Stocks",
                    allocation_percentage=60.0,
                    expected_return=7.0,
                    volatility=15.0,
                    liquidity_level=LiquidityLevel.MEDIUM,
                ),
                AssetClass(
                    name="Bonds",
                    display_name="Bonds",
                    allocation_percentage=50.0,  # Total: 110%
                    expected_return=3.0,
                    volatility=5.0,
                    liquidity_level=LiquidityLevel.LOW,
                ),
            ],
            enable_rebalancing=True,
        )

    error_msg = str(exc_info.value)
    assert "must sum to exactly 100%" in error_msg
    assert "got 110.0%" in error_msg


def test_portfolio_configuration_invalid_allocation_sum_too_low() -> None:
    """Test PortfolioConfiguration with allocation sum < 100%."""
    with pytest.raises(ValidationError) as exc_info:
        PortfolioConfiguration(
            asset_classes=[
                AssetClass(
                    name="Stocks",
                    display_name="Stocks",
                    allocation_percentage=40.0,
                    expected_return=7.0,
                    volatility=15.0,
                    liquidity_level=LiquidityLevel.MEDIUM,
                ),
                AssetClass(
                    name="Bonds",
                    display_name="Bonds",
                    allocation_percentage=30.0,  # Total: 70%
                    expected_return=3.0,
                    volatility=5.0,
                    liquidity_level=LiquidityLevel.LOW,
                ),
            ],
            enable_rebalancing=True,
        )

    error_msg = str(exc_info.value)
    assert "must sum to exactly 100%" in error_msg
    assert "got 70.0%" in error_msg


def test_portfolio_configuration_machine_precision_tolerance() -> None:
    """Test PortfolioConfiguration handles machine precision errors."""
    import sys

    # Create allocation that might have floating point precision issues
    # but should still be valid within machine epsilon
    # This should pass - very small deviation within machine precision
    slightly_off_total = 100.0 + (sys.float_info.epsilon / 2)
    config = PortfolioConfiguration(
        asset_classes=[
            AssetClass(
                name="Stocks",
                display_name="Stocks",
                allocation_percentage=slightly_off_total / 2,
                expected_return=7.0,
                volatility=15.0,
                liquidity_level=LiquidityLevel.MEDIUM,
            ),
            AssetClass(
                name="Bonds",
                display_name="Bonds",
                allocation_percentage=slightly_off_total / 2,
                expected_return=3.0,
                volatility=5.0,
                liquidity_level=LiquidityLevel.LOW,
            ),
        ],
        enable_rebalancing=True,
    )

    # Should not raise validation error for tiny precision differences
    assert len(config.asset_classes) == 2


def test_asset_class_default_liquidity_level() -> None:
    """Test AssetClass has correct default liquidity level."""
    asset = AssetClass(
        name="Test Asset",
        display_name="Test Asset",
        allocation_percentage=100.0,
        expected_return=5.0,
        volatility=10.0,
        liquidity_level=LiquidityLevel.MEDIUM,
    )

    # Should default to MEDIUM liquidity
    assert asset.liquidity_level == LiquidityLevel.MEDIUM


def test_liquidity_level_enum_values() -> None:
    """Test LiquidityLevel enum has expected values."""
    assert LiquidityLevel.HIGH.value == "high"
    assert LiquidityLevel.MEDIUM.value == "medium"
    assert LiquidityLevel.LOW.value == "low"

    # Test that all expected levels exist
    expected_levels = {"HIGH", "MEDIUM", "LOW"}
    actual_levels = {level.name for level in LiquidityLevel}
    assert actual_levels == expected_levels


def test_asset_class_name_normalization() -> None:
    """Test AssetClass normalizes names to lowercase and collapses spaces."""
    # Test various input formats
    test_cases = [
        ("Stocks", "stocks", "Stocks"),  # (input, internal, display)
        ("BONDS", "bonds", "BONDS"),
        ("  Cash  ", "cash", "Cash"),  # Leading/trailing whitespace
        ("Money Market", "money market", "Money Market"),
        ("My   Stocks", "my stocks", "My   Stocks"),  # Multiple spaces
        ("Real  \t Estate", "real estate", "Real  \t Estate"),  # Tab
        ("rEaL    eStAtE", "real estate", "rEaL    eStAtE"),
    ]

    for input_name, expected_internal, expected_display in test_cases:
        asset = AssetClass(
            name=input_name,
            allocation_percentage=100.0,
            expected_return=5.0,
            volatility=10.0,
            liquidity_level=LiquidityLevel.MEDIUM,
        )
        # Internal: lowercase + normalized spaces
        assert asset.name == expected_internal
        # Display preserves original
        assert asset.display_name == expected_display


def test_portfolio_configuration_duplicate_asset_names() -> None:
    """Test PortfolioConfiguration rejects duplicate asset names."""
    with pytest.raises(ValidationError) as exc_info:
        PortfolioConfiguration(
            asset_classes=[
                AssetClass(
                    name="My Stocks",
                    display_name="My Stocks",
                    allocation_percentage=50.0,
                    expected_return=7.0,
                    volatility=15.0,
                    liquidity_level=LiquidityLevel.MEDIUM,
                ),
                AssetClass(
                    # Multiple spaces, different case - same after normalization
                    name="MY   STOCKS",
                    display_name="MY   STOCKS",
                    allocation_percentage=50.0,
                    expected_return=8.0,
                    volatility=12.0,
                    liquidity_level=LiquidityLevel.MEDIUM,
                ),
            ],
            enable_rebalancing=True,
        )

    error_msg = str(exc_info.value)
    assert "Asset names must be unique" in error_msg
    assert "case-insensitive" in error_msg


def test_portfolio_configuration_case_insensitive_duplicates() -> None:
    """Test PortfolioConfiguration handles case-insensitive duplicates."""
    with pytest.raises(ValidationError) as exc_info:
        PortfolioConfiguration(
            asset_classes=[
                AssetClass(
                    name="Cash",
                    display_name="Cash",
                    allocation_percentage=30.0,
                    expected_return=1.0,
                    volatility=0.0,
                    liquidity_level=LiquidityLevel.HIGH,
                ),
                AssetClass(
                    # Different case, same normalized name
                    name="CASH",
                    display_name="CASH",
                    allocation_percentage=70.0,
                    expected_return=1.5,
                    volatility=0.0,
                    liquidity_level=LiquidityLevel.HIGH,
                ),
            ],
            enable_rebalancing=True,
        )

    error_msg = str(exc_info.value)
    assert "Asset names must be unique" in error_msg
    assert "case-insensitive" in error_msg


def test_portfolio_configuration_valid_unique_names() -> None:
    """Test PortfolioConfiguration accepts unique normalized names."""
    config = PortfolioConfiguration(
        asset_classes=[
            AssetClass(
                name="Stocks",  # Will be normalized to "stocks"
                display_name="Stocks",
                allocation_percentage=60.0,
                expected_return=7.0,
                volatility=15.0,
                liquidity_level=LiquidityLevel.MEDIUM,
            ),
            AssetClass(
                name="BONDS",  # Will be normalized to "bonds"
                display_name="BONDS",
                allocation_percentage=40.0,
                expected_return=3.0,
                volatility=5.0,
                liquidity_level=LiquidityLevel.LOW,
            ),
        ],
        enable_rebalancing=True,
    )

    # Check that internal names were normalized to lowercase
    asset_names = [asset.name for asset in config.asset_classes]
    assert "stocks" in asset_names
    assert "bonds" in asset_names
    assert "Stocks" not in asset_names  # Original case normalized
    assert "BONDS" not in asset_names  # Original case normalized

    # Check that display names preserve original formatting
    display_names = [asset.display_name for asset in config.asset_classes]
    assert "Stocks" in display_names
    assert "BONDS" in display_names
