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

            # Sustainability metrics should be calculated
            assert isinstance(state.safety_buffer_amount, (int, float))
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
            assert isinstance(state.safety_buffer_amount, (int, float))
            assert state.safety_buffer_amount > 0  # Should be positive
            assert isinstance(state.is_sustainable, bool)

            # Safety buffer should be based on annual expenses and months config
            expected_buffer = state.total_expense * (
                fire_engine.profile.safety_buffer_months / 12.0
            )
            assert abs(state.safety_buffer_amount - expected_buffer) < 0.01

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

        # Compare safety buffers
        for state_6m, state_24m in zip(states_6m, states_24m):
            # 24 month buffer should be 4x larger than 6 month buffer
            expected_ratio = 24.0 / 6.0
            actual_ratio = (
                state_24m.safety_buffer_amount / state_6m.safety_buffer_amount
            )
            assert abs(actual_ratio - expected_ratio) < 0.01


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
            investment_return=Decimal("5000.00"),
            safety_buffer_amount=45000.0,  # 1 year expenses
            is_sustainable=False,
            fire_number=1125000.0,  # 45000 * 25
            fire_progress=0.133,  # 150000 / 1125000
        )

        assert state.age == 35
        assert state.year == 2025
        assert state.total_income == 70000.0
        assert state.total_expense == 45000.0
        assert state.net_cash_flow == 25000.0
        assert state.portfolio_value == Decimal("150000.00")
        assert state.investment_return == Decimal("5000.00")
        assert state.safety_buffer_amount == 45000.0  # 1 year expenses
        assert state.is_sustainable is False
        assert state.fire_number == 1125000.0
        assert state.fire_progress == pytest.approx(0.133, rel=1e-3)
