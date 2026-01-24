"""Tests for FIRE calculation engine."""

import pandas as pd
import pytest

from core.data_models import UserProfile
from core.engine import EngineInput, FIREEngine, YearlyState


class TestFIREEngine:
    """Test suite for FIRE calculation engine."""

    @pytest.fixture
    def sample_user_profile(self) -> UserProfile:
        """Create a sample user profile for testing."""
        return UserProfile(
            birth_year=1990,  # Around 34 years old in 2024
            expected_fire_age=50,
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=100000.0,
            inflation_rate=3.0,
            safety_buffer_months=12.0,  # 1 year safety buffer
        )

    @pytest.fixture
    def sample_projection_df(self) -> pd.DataFrame:
        """Create a sample annual financial projection."""
        data = []
        current_year = 2024
        start_age = 34

        # Create 5 years of projection data
        for i in range(5):
            age = start_age + i
            year = current_year + i

            # Simple progression: income grows, expenses stable
            total_income = 80000.0 + (i * 2000)  # Growing income
            total_expense = 50000.0  # Stable expenses

            data.append(
                {
                    "age": age,
                    "year": year,
                    "total_income": total_income,
                    "total_expense": total_expense,
                }
            )

        return pd.DataFrame(data)

    @pytest.fixture
    def engine_input(
        self, sample_user_profile: UserProfile, sample_projection_df: pd.DataFrame
    ) -> EngineInput:
        """Create engine input from fixtures."""
        return EngineInput(
            user_profile=sample_user_profile,
            annual_financial_projection=sample_projection_df,
        )

    @pytest.fixture
    def fire_engine(self, engine_input: EngineInput) -> FIREEngine:
        """Create FIRE engine instance."""
        return FIREEngine(engine_input)

    def test_engine_initialization(self, fire_engine: FIREEngine) -> None:
        """Test engine initializes correctly."""
        assert fire_engine.input is not None
        assert fire_engine.profile is not None
        assert fire_engine.projection_df is not None
        assert fire_engine.portfolio_simulator is not None
        # PortfolioSimulator should be self-contained with internal calculator
        assert hasattr(fire_engine.portfolio_simulator, "calculator")
        assert fire_engine.portfolio_simulator.calculator is not None

    def test_initial_portfolio_creation(self, fire_engine: FIREEngine) -> None:
        """Test initial portfolio state creation via PortfolioSimulator."""
        portfolio_simulator = fire_engine.portfolio_simulator
        initial_portfolio = portfolio_simulator.current_portfolio

        # Should have some assets based on user profile
        assert len(initial_portfolio.asset_values) > 0

        # Total value should match current net worth
        assert float(initial_portfolio.total_value) == pytest.approx(
            fire_engine.profile.current_net_worth, rel=1e-6
        )

        # Test reset functionality
        original_value = initial_portfolio.total_value
        portfolio_simulator.reset_to_initial()
        assert float(
            portfolio_simulator.current_portfolio.total_value
        ) == pytest.approx(float(original_value), rel=1e-6)

    def test_fire_calculation_basic(self, fire_engine: FIREEngine) -> None:
        """Test basic FIRE calculation functionality."""
        result = fire_engine.calculate()

        # Should return valid result
        assert result is not None
        assert isinstance(result.is_fire_achievable, bool)
        assert isinstance(result.fire_net_worth, float)
        assert len(result.yearly_results) == 5  # 5 years of data

        # Each yearly result should have required fields
        for yearly_result in result.yearly_results:
            assert yearly_result.age >= 34
            assert yearly_result.year >= 2024
            assert yearly_result.total_income > 0
            assert yearly_result.total_expense > 0
            assert isinstance(yearly_result.net_cash_flow, float)
            # Check investment return is numeric (Decimal or float/int)
            assert hasattr(yearly_result.investment_return, "__float__")
            assert float(yearly_result.portfolio_value) >= 0

    def test_yearly_states_calculation(self, fire_engine: FIREEngine) -> None:
        """Test yearly states calculation provides detailed information."""
        yearly_states = fire_engine.get_yearly_states()

        assert len(yearly_states) == 5  # 5 years of data

        for state in yearly_states:
            assert isinstance(state, YearlyState)
            assert state.age >= 34
            assert state.year >= 2024

            # Financial metrics should be calculated
            assert isinstance(state.net_worth, float)
            assert isinstance(state.is_sustainable, bool)

            # Traditional FIRE metrics (for reference)
            assert state.fire_number > 0  # 25x expenses
            assert isinstance(state.fire_progress, float)

            # Portfolio metrics
            assert state.portfolio_value >= 0
            assert hasattr(state.investment_return, "__float__")

    def test_fire_number_calculation(self, fire_engine: FIREEngine) -> None:
        """Test FIRE number calculation follows 4% rule."""
        yearly_states = fire_engine.get_yearly_states()

        for state in yearly_states:
            expected_fire_number = state.total_expense * 25.0
            assert state.fire_number == pytest.approx(expected_fire_number, rel=1e-6)

    def test_fire_progress_calculation(self, fire_engine: FIREEngine) -> None:
        """Test FIRE progress calculation."""
        yearly_states = fire_engine.get_yearly_states()

        for state in yearly_states:
            if state.fire_number > 0:
                expected_progress = float(state.portfolio_value) / state.fire_number
                assert state.fire_progress == pytest.approx(expected_progress, rel=1e-6)
            else:
                assert state.fire_progress == 0.0

    def test_portfolio_integration(self, fire_engine: FIREEngine) -> None:
        """Test integration with portfolio manager."""
        result = fire_engine.calculate()

        # Portfolio should grow over time with positive cash flow
        net_worths = [float(yr.portfolio_value) for yr in result.yearly_results]

        # With positive cash flow and returns, net worth should generally increase
        # (allowing for some volatility)
        final_net_worth = net_worths[-1]
        initial_net_worth = fire_engine.profile.current_net_worth

        assert (
            final_net_worth > initial_net_worth
        )  # Should grow with positive cash flows

    def test_sustainability_logic(self, fire_engine: FIREEngine) -> None:
        """Test new sustainability-based FIRE logic."""
        yearly_states = fire_engine.get_yearly_states()

        # Check that each state has sustainability metrics
        for state in yearly_states:
            assert isinstance(state.net_worth, float)
            assert isinstance(state.is_sustainable, bool)

            # Safety buffer should be calculated dynamically
            expected_buffer = state.total_expense * (
                fire_engine.profile.safety_buffer_months / 12.0
            )
            # Sustainability should be based on net_worth vs safety buffer
            expected_sustainable = state.net_worth >= expected_buffer
            assert state.is_sustainable == expected_sustainable

            # Traditional FIRE metrics should still exist for reference
            assert state.fire_number > 0
            assert isinstance(state.fire_progress, float)

    def test_safety_buffer_configuration(
        self, sample_projection_df: pd.DataFrame
    ) -> None:
        """Test different safety buffer configurations."""
        # Test with 6 months buffer
        profile_6m = UserProfile(
            birth_year=1990,
            expected_fire_age=50,
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=100000.0,
            inflation_rate=3.0,
            safety_buffer_months=6.0,  # 6 months
        )

        engine_6m = FIREEngine(
            EngineInput(
                user_profile=profile_6m,
                annual_financial_projection=sample_projection_df,
            )
        )
        states_6m = engine_6m.get_yearly_states()

        # Test with 24 months buffer
        profile_24m = UserProfile(
            birth_year=1990,
            expected_fire_age=50,
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=100000.0,
            inflation_rate=3.0,
            safety_buffer_months=24.0,  # 24 months
        )

        engine_24m = FIREEngine(
            EngineInput(
                user_profile=profile_24m,
                annual_financial_projection=sample_projection_df,
            )
        )
        states_24m = engine_24m.get_yearly_states()

        # Compare safety buffers (calculated dynamically)
        for state_6m, state_24m in zip(states_6m, states_24m):
            # Calculate safety buffers dynamically
            buffer_6m = state_6m.total_expense * (6.0 / 12.0)
            buffer_24m = state_24m.total_expense * (24.0 / 12.0)

            # 24 month buffer should be 4x larger than 6 month buffer
            expected_ratio = 24.0 / 6.0
            actual_ratio = buffer_24m / buffer_6m
            assert abs(actual_ratio - expected_ratio) < 0.01

            # Sustainability logic should be different for different buffers
            sustainable_6m = state_6m.net_worth >= buffer_6m
            sustainable_24m = state_24m.net_worth >= buffer_24m
            assert state_6m.is_sustainable == sustainable_6m
            assert state_24m.is_sustainable == sustainable_24m

    def test_depletion_safety_buffer_ramps_to_legal_retirement(self) -> None:
        """Test that safety buffer requirement ramps during depletion stage."""
        from core.data_models import AssetClass, LiquidityLevel, PortfolioConfiguration

        profile = UserProfile(
            birth_year=1990,
            expected_fire_age=50,
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=200000.0,
            inflation_rate=0.0,
            safety_buffer_months=12,
            portfolio=PortfolioConfiguration(
                asset_classes=[
                    AssetClass(
                        name="Cash",
                        allocation_percentage=100.0,
                        expected_return=0.0,
                        volatility=0.0,
                        liquidity_level=LiquidityLevel.HIGH,
                    )
                ],
                enable_rebalancing=False,
            ),
        )

        df = pd.DataFrame(
            {
                "age": [60, 64, 65],
                "year": [2050, 2054, 2055],
                "total_income": [100000.0, 100000.0, 100000.0],
                "total_expense": [100000.0, 100000.0, 100000.0],
            }
        )

        engine = FIREEngine(
            EngineInput(user_profile=profile, annual_financial_projection=df)
        )
        states = engine.get_yearly_states()
        states_by_age = {s.age: s for s in states}

        assert states_by_age[60].is_sustainable is False
        assert states_by_age[64].is_sustainable is True
        assert states_by_age[65].is_sustainable is True

    def test_depletion_net_worth_tracks_unfunded_shortfall(self) -> None:
        """Net worth should reflect only the unfunded shortfall.

        This is the shortfall after consuming remaining portfolio value.
        """
        from core.data_models import AssetClass, LiquidityLevel, PortfolioConfiguration

        profile = UserProfile(
            birth_year=1990,
            expected_fire_age=50,
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=500.0,
            inflation_rate=0.0,
            safety_buffer_months=0,
            bridge_discount_rate=0.0,
            portfolio=PortfolioConfiguration(
                asset_classes=[
                    AssetClass(
                        name="Cash",
                        allocation_percentage=100.0,
                        expected_return=0.0,
                        volatility=0.0,
                        liquidity_level=LiquidityLevel.HIGH,
                    )
                ],
                enable_rebalancing=False,
            ),
        )

        df = pd.DataFrame(
            {
                "age": [60],
                "year": [2050],
                "total_income": [0.0],
                "total_expense": [600.0],  # shortfall = 600 - 500 = 100
            }
        )

        engine = FIREEngine(
            EngineInput(user_profile=profile, annual_financial_projection=df)
        )
        states = engine.get_yearly_states()
        assert len(states) == 1
        assert float(states[0].portfolio_value) == 0.0
        assert states[0].net_worth == pytest.approx(-100.0, rel=1e-9)


class TestEngineInput:
    """Test engine input validation and creation."""

    def test_engine_input_creation(self) -> None:
        """Test engine input can be created with valid data."""
        profile = UserProfile(
            birth_year=1990,
            expected_fire_age=50,
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=50000.0,
            inflation_rate=2.5,
            safety_buffer_months=12.0,
        )

        df = pd.DataFrame(
            {
                "age": [34, 35],
                "year": [2024, 2025],
                "total_income": [60000.0, 62000.0],
                "total_expense": [40000.0, 41000.0],
            }
        )

        engine_input = EngineInput(
            user_profile=profile,
            annual_financial_projection=df,
        )

        assert engine_input.user_profile == profile
        assert len(engine_input.annual_financial_projection) == 2
        assert list(engine_input.annual_financial_projection.columns) == [
            "age",
            "year",
            "total_income",
            "total_expense",
        ]


class TestYearlyState:
    """Test yearly state data structure."""

    def test_yearly_state_creation(self) -> None:
        """Test yearly state can be created with all required fields."""
        from decimal import Decimal

        state = YearlyState(
            age=35,
            year=2025,
            total_income=70000.0,
            total_expense=45000.0,
            net_cash_flow=25000.0,
            portfolio_value=Decimal("150000.00"),
            net_worth=150000.0,  # New field: net worth (can be negative)
            investment_return=Decimal("5000.00"),
            is_sustainable=False,
            fire_number=1125000.0,  # 45000 * 25
            fire_progress=0.133,  # 150000 / 1125000
        )

        # Test field access
        assert state.age == 35
        assert state.year == 2025
        assert state.total_income == 70000.0
        assert state.total_expense == 45000.0
        assert state.net_cash_flow == 25000.0
        assert state.portfolio_value == Decimal("150000.00")
        assert state.net_worth == 150000.0  # Test new field
        assert state.investment_return == Decimal("5000.00")
        assert state.is_sustainable is False
        assert state.fire_number == 1125000.0
        assert state.fire_progress == pytest.approx(0.133, rel=1e-3)

    def test_net_worth_negative_values(self) -> None:
        """Test that net_worth can handle negative values (debt)."""
        from decimal import Decimal

        # Test state with negative net worth (debt situation)
        state = YearlyState(
            age=70,
            year=2055,
            total_income=30000.0,
            total_expense=50000.0,
            net_cash_flow=-20000.0,
            portfolio_value=Decimal("0.00"),  # Portfolio depleted
            net_worth=-10000.0,  # In debt
            investment_return=Decimal("0.00"),
            is_sustainable=False,
            fire_number=1250000.0,  # 50000 * 25
            fire_progress=0.0,
        )

        # Test that negative net worth is properly stored and accessible
        assert state.net_worth == -10000.0
        assert state.net_worth < 0  # Explicitly test it's negative
        assert state.portfolio_value == Decimal("0.00")
        assert state.is_sustainable is False
        assert state.net_cash_flow < 0

    def test_net_worth_vs_portfolio_value(self) -> None:
        """Test the distinction between net_worth and portfolio_value."""
        from decimal import Decimal

        # Case 1: Portfolio has value, net worth should equal portfolio value
        state_positive = YearlyState(
            age=40,
            year=2030,
            total_income=80000.0,
            total_expense=60000.0,
            net_cash_flow=20000.0,
            portfolio_value=Decimal("500000.00"),
            net_worth=500000.0,
            investment_return=Decimal("25000.00"),
            is_sustainable=True,
            fire_number=1500000.0,
            fire_progress=0.333,
        )

        assert state_positive.net_worth == float(state_positive.portfolio_value)
        assert state_positive.net_worth > 0
        assert state_positive.is_sustainable is True

        # Case 2: Portfolio depleted, net worth negative
        state_negative = YearlyState(
            age=75,
            year=2065,
            total_income=20000.0,
            total_expense=60000.0,
            net_cash_flow=-40000.0,
            portfolio_value=Decimal("0.00"),  # Portfolio depleted
            net_worth=-100000.0,  # Accumulated debt
            investment_return=Decimal("0.00"),
            is_sustainable=False,
            fire_number=1500000.0,
            fire_progress=0.0,
        )

        assert state_negative.portfolio_value == Decimal("0.00")
        assert state_negative.net_worth < 0
        assert state_negative.is_sustainable is False
        assert abs(state_negative.net_worth) > 0  # Has accumulated debt


class TestOneTimeItems:
    """Test one-time income and expense items calculation."""

    def test_one_time_expense_appears_only_once(self) -> None:
        """Test that one-time expenses appear only in specified year."""
        from datetime import datetime

        from core.data_models import IncomeExpenseItem, ItemFrequency, TimeUnit
        from core.planner import FIREPlanner

        # Create user profile (birth_year 1984 = age 41 in 2025)
        profile = UserProfile(
            birth_year=datetime.now().year - 41,
            expected_fire_age=50,
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=100000.0,
            inflation_rate=3.0,
            safety_buffer_months=12.0,
        )

        # Create recurring expense
        recurring_expense = IncomeExpenseItem(
            name="Living Expenses",
            after_tax_amount_per_period=50000,
            time_unit=TimeUnit.ANNUALLY,
            frequency=ItemFrequency.RECURRING,
            start_age=41,  # Start from current age
            end_age=85,
            annual_growth_rate=0.0,
            is_income=False,
        )

        # Create one-time expense at age 45
        one_time_expense = IncomeExpenseItem(
            name="House Down Payment",
            after_tax_amount_per_period=200000,
            time_unit=TimeUnit.ANNUALLY,
            frequency=ItemFrequency.ONE_TIME,
            start_age=45,
            end_age=None,  # Should be None for one-time
            annual_growth_rate=0.0,
            is_income=False,
        )

        # Create basic income to avoid negative cash flows
        income = IncomeExpenseItem(
            name="Salary",
            after_tax_amount_per_period=80000,
            time_unit=TimeUnit.ANNUALLY,
            frequency=ItemFrequency.RECURRING,
            start_age=41,  # Start from current age
            end_age=50,
            annual_growth_rate=0.0,
            is_income=True,
        )

        # Create planner and generate projection
        planner = FIREPlanner()
        planner.set_user_profile(profile)
        planner.add_income_item(income)
        planner.add_expense_item(recurring_expense)
        planner.add_expense_item(one_time_expense)
        projection_df = planner.generate_projection_table()

        # Check that one-time expense appears only at age 45
        # In the wide format, each item has its own column
        recurring_col = "Living Expenses"
        onetime_col = "House Down Payment"

        # Verify recurring expense appears at all ages
        age_41_recurring = projection_df[projection_df["age"] == 41][
            recurring_col
        ].iloc[0]
        age_44_recurring = projection_df[projection_df["age"] == 44][
            recurring_col
        ].iloc[0]
        age_45_recurring = projection_df[projection_df["age"] == 45][
            recurring_col
        ].iloc[0]
        age_46_recurring = projection_df[projection_df["age"] == 46][
            recurring_col
        ].iloc[0]

        # Recurring expense grows with inflation (3% annually)
        # Age 41: base amount (50000)
        assert age_41_recurring == pytest.approx(50000, rel=1e-6)

        # Age 44: 3 years of 3% inflation = 50000 * (1.03^3) = 54636.35
        expected_44 = 50000 * (1.03**3)
        assert age_44_recurring == pytest.approx(expected_44, rel=1e-6)

        # Age 45: 4 years of 3% inflation
        expected_45 = 50000 * (1.03**4)
        assert age_45_recurring == pytest.approx(expected_45, rel=1e-6)

        # Age 46: 5 years of 3% inflation
        expected_46 = 50000 * (1.03**5)
        assert age_46_recurring == pytest.approx(expected_46, rel=1e-6)

        # Check one-time expense - should only appear at age 45
        age_41_onetime = projection_df[projection_df["age"] == 41][onetime_col].iloc[0]
        age_44_onetime = projection_df[projection_df["age"] == 44][onetime_col].iloc[0]
        age_45_onetime = projection_df[projection_df["age"] == 45][onetime_col].iloc[0]
        age_46_onetime = projection_df[projection_df["age"] == 46][onetime_col].iloc[0]

        # One-time expense should be 0 everywhere except age 45
        assert age_41_onetime == pytest.approx(0.0, rel=1e-6)
        assert age_44_onetime == pytest.approx(0.0, rel=1e-6)
        assert age_45_onetime == pytest.approx(200000, rel=1e-6)  # Should appear here
        assert age_46_onetime == pytest.approx(0.0, rel=1e-6)

        # Verify no other ages have the one-time expense
        other_ages = projection_df[
            (projection_df["age"] != 45)
            & (projection_df["age"] >= 41)
            & (projection_df["age"] <= 50)
        ]
        for _, row in other_ages.iterrows():
            assert row[onetime_col] == pytest.approx(0.0, rel=1e-6), (
                f"Age {row['age']} should not have one-time expense, "
                f"but got {row[onetime_col]}"
            )

    def test_multiple_one_time_expenses(self) -> None:
        """Test multiple one-time expenses at different ages."""
        from datetime import datetime

        from core.data_models import IncomeExpenseItem, ItemFrequency, TimeUnit
        from core.planner import FIREPlanner

        profile = UserProfile(
            birth_year=datetime.now().year - 41,
            expected_fire_age=50,
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=100000.0,
            inflation_rate=3.0,
            safety_buffer_months=12.0,
        )

        # Create one-time expenses at different ages (matching saved.json)
        one_time_41 = IncomeExpenseItem(
            name="One-time at 41",
            after_tax_amount_per_period=300000,
            time_unit=TimeUnit.ANNUALLY,
            frequency=ItemFrequency.ONE_TIME,
            start_age=41,
            end_age=None,
            annual_growth_rate=0.0,
            is_income=False,
        )

        one_time_50 = IncomeExpenseItem(
            name="One-time at 50",
            after_tax_amount_per_period=300000,
            time_unit=TimeUnit.ANNUALLY,
            frequency=ItemFrequency.ONE_TIME,
            start_age=50,
            end_age=None,
            annual_growth_rate=0.0,
            is_income=False,
        )

        # Create recurring expense
        recurring = IncomeExpenseItem(
            name="Daily Expenses",
            after_tax_amount_per_period=600000,
            time_unit=TimeUnit.ANNUALLY,
            frequency=ItemFrequency.RECURRING,
            start_age=41,  # Start from current age
            end_age=85,
            annual_growth_rate=1.0,
            is_income=False,
        )

        # Create income
        income = IncomeExpenseItem(
            name="Salary",
            after_tax_amount_per_period=800000,
            time_unit=TimeUnit.ANNUALLY,
            frequency=ItemFrequency.RECURRING,
            start_age=41,  # Start from current age
            end_age=50,
            annual_growth_rate=0.0,
            is_income=True,
        )

        planner = FIREPlanner()
        planner.set_user_profile(profile)
        planner.add_income_item(income)
        planner.add_expense_item(recurring)
        planner.add_expense_item(one_time_41)
        planner.add_expense_item(one_time_50)
        projection_df = planner.generate_projection_table()

        # Check specific ages using column names
        recurring_col = "Daily Expenses"
        onetime_41_col = "One-time at 41"
        onetime_50_col = "One-time at 50"

        # Age 41: only recurring (600000), no inflation yet since it's start year
        age_41_recurring = projection_df[projection_df["age"] == 41][
            recurring_col
        ].iloc[0]
        age_41_onetime_41 = projection_df[projection_df["age"] == 41][
            onetime_41_col
        ].iloc[0]
        age_41_onetime_50 = projection_df[projection_df["age"] == 41][
            onetime_50_col
        ].iloc[0]

        # Age 41: recurring (600000) + one-time at 41 (300000)
        assert age_41_recurring == pytest.approx(600000, rel=1e-6)
        assert age_41_onetime_41 == pytest.approx(
            300000, rel=1e-6
        )  # One-time appears here
        assert age_41_onetime_50 == pytest.approx(0.0, rel=1e-6)

        # Age 42: only recurring (no one-time expenses)
        age_42_recurring = projection_df[projection_df["age"] == 42][
            recurring_col
        ].iloc[0]
        age_42_onetime_41 = projection_df[projection_df["age"] == 42][
            onetime_41_col
        ].iloc[0]
        age_42_onetime_50 = projection_df[projection_df["age"] == 42][
            onetime_50_col
        ].iloc[0]

        # After 1 year from start age 41: inflation and growth compound
        expected_age_42_recurring = 600000 * (1.03**1) * (1.01**1)
        assert age_42_recurring == pytest.approx(expected_age_42_recurring, rel=1e-6)
        assert age_42_onetime_41 == pytest.approx(0.0, rel=1e-6)
        assert age_42_onetime_50 == pytest.approx(0.0, rel=1e-6)

        # Age 50: recurring + one-time expense at 50
        age_50_recurring = projection_df[projection_df["age"] == 50][
            recurring_col
        ].iloc[0]
        age_50_onetime_41 = projection_df[projection_df["age"] == 50][
            onetime_41_col
        ].iloc[0]
        age_50_onetime_50 = projection_df[projection_df["age"] == 50][
            onetime_50_col
        ].iloc[0]

        # After 9 years from start age 41
        expected_age_50_recurring = 600000 * (1.03**9) * (1.01**9)
        assert age_50_recurring == pytest.approx(expected_age_50_recurring, rel=1e-6)
        assert age_50_onetime_41 == pytest.approx(0.0, rel=1e-6)
        assert age_50_onetime_50 == pytest.approx(300000, rel=1e-6)  # One-time appears

        # Age 51: only recurring
        age_51_recurring = projection_df[projection_df["age"] == 51][
            recurring_col
        ].iloc[0]
        age_51_onetime_41 = projection_df[projection_df["age"] == 51][
            onetime_41_col
        ].iloc[0]
        age_51_onetime_50 = projection_df[projection_df["age"] == 51][
            onetime_50_col
        ].iloc[0]

        expected_age_51_recurring = 600000 * (1.03**10) * (1.01**10)
        assert age_51_recurring == pytest.approx(expected_age_51_recurring, rel=1e-6)
        assert age_51_onetime_41 == pytest.approx(0.0, rel=1e-6)
        assert age_51_onetime_50 == pytest.approx(0.0, rel=1e-6)
