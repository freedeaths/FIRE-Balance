from decimal import Decimal

import pytest

from core.data_models import (
    AssetClass,
    LiquidityLevel,
    PortfolioConfiguration,
    UserProfile,
)
from core.portfolio_manager import (
    AssetRandomFactor,
    LiquidityAwareFlowStrategy,
    PortfolioCalculator,
    PortfolioRandomFactors,
    PortfolioState,
    SimpleFlowStrategy,
)


class TestPortfolioCalculator:
    """Test cases for PortfolioCalculator"""

    @pytest.fixture
    def sample_profile(self) -> UserProfile:
        """Create a sample user profile for testing"""
        portfolio = PortfolioConfiguration(
            asset_classes=[
                AssetClass(
                    name="Stocks",  # Will normalize to "stocks"
                    display_name="Stocks",
                    allocation_percentage=60.0,
                    expected_return=7.0,
                    volatility=15.0,
                    liquidity_level=LiquidityLevel.MEDIUM,
                ),
                AssetClass(
                    name="Bonds",  # Will normalize to "bonds"
                    display_name="Bonds",
                    allocation_percentage=30.0,
                    expected_return=3.0,
                    volatility=5.0,
                    liquidity_level=LiquidityLevel.LOW,
                ),
                AssetClass(
                    name="Cash",  # Will normalize to "cash"
                    display_name="Cash",
                    allocation_percentage=10.0,
                    expected_return=1.0,
                    volatility=1.0,
                    liquidity_level=LiquidityLevel.HIGH,
                ),
            ],
            enable_rebalancing=True,
        )

        return UserProfile(
            birth_year=1994,  # current_age around 30 in 2024
            expected_fire_age=50,
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=100000.0,
            inflation_rate=3.0,
            portfolio=portfolio,
        )

    @pytest.fixture
    def portfolio_calculator(self, sample_profile: UserProfile) -> PortfolioCalculator:
        """Create a portfolio calculator instance"""
        return PortfolioCalculator(sample_profile)

    def test_portfolio_calculator_initialization(
        self, portfolio_calculator: PortfolioCalculator, sample_profile: UserProfile
    ) -> None:
        """Test portfolio calculator initialization"""
        assert portfolio_calculator.profile == sample_profile
        assert portfolio_calculator.portfolio_config == sample_profile.portfolio

    def test_get_target_allocation_static(
        self, portfolio_calculator: PortfolioCalculator
    ) -> None:
        """Test target allocation returns configured allocations (static)"""
        allocation_young = portfolio_calculator.get_target_allocation(30)
        allocation_old = portfolio_calculator.get_target_allocation(60)

        for allocation in [allocation_young, allocation_old]:
            assert allocation["stocks"] == 0.6
            assert allocation["bonds"] == 0.3
            assert allocation["cash"] == 0.1

            # Should sum to 1.0
            assert abs(sum(allocation.values()) - 1.0) < 0.001

    def test_calculate_returns_by_allocation(
        self, portfolio_calculator: PortfolioCalculator
    ) -> None:
        """Test portfolio return calculation by allocation"""
        portfolio_value = Decimal("100000")
        allocation = {"stocks": 0.6, "bonds": 0.3, "cash": 0.1}

        expected_return = portfolio_calculator.calculate_returns_by_allocation(
            allocation, portfolio_value
        )

        # Expected: 60% * 7% + 30% * 3% + 10% * 1% = 4.2% + 0.9% + 0.1% = 5.2%
        expected_percentage = Decimal("0.052")
        expected_amount = portfolio_value * expected_percentage

        assert abs(expected_return - expected_amount) < Decimal("0.01")

    def test_calculate_returns_by_allocation_zero_value(
        self, portfolio_calculator: PortfolioCalculator
    ) -> None:
        """Test portfolio return calculation with zero value"""
        allocation = {"stocks": 0.6, "bonds": 0.3, "cash": 0.1}
        result = portfolio_calculator.calculate_returns_by_allocation(
            allocation, Decimal("0")
        )
        assert result == Decimal("0")

    def test_calculate_returns_with_volatility(
        self, portfolio_calculator: PortfolioCalculator
    ) -> None:
        """Test portfolio return calculation with volatility"""
        portfolio_value = Decimal("100000")
        allocation = {"stocks": 0.6, "bonds": 0.3, "cash": 0.1}

        # Create random factors with +1 std dev for all assets
        random_factors = PortfolioRandomFactors(
            asset_factors=[
                AssetRandomFactor(name="stocks", random_factor=1.0),
                AssetRandomFactor(name="bonds", random_factor=1.0),
                AssetRandomFactor(name="cash", random_factor=1.0),
            ]
        )

        return_with_volatility = portfolio_calculator.calculate_returns_with_volatility(
            allocation, portfolio_value, random_factors
        )

        # With +1 std dev, each asset gets its volatility added
        # Stocks: (7% + 15%) * 60% = 13.2%
        # Bonds: (3% + 5%) * 30% = 2.4%
        # Cash: (1% + 1%) * 10% = 0.2%
        # Total: 15.8%
        expected_return = portfolio_value * Decimal("0.158")

        assert abs(return_with_volatility - expected_return) < Decimal("0.01")

    def test_should_rebalance_within_threshold(
        self, portfolio_calculator: PortfolioCalculator
    ) -> None:
        """Test rebalancing decision when within threshold"""
        current_allocation = {"stocks": 0.58, "bonds": 0.32, "cash": 0.10}
        target_allocation = {"stocks": 0.60, "bonds": 0.30, "cash": 0.10}

        # Differences are within 5% threshold
        assert not portfolio_calculator.should_rebalance(
            current_allocation, target_allocation
        )

    def test_should_rebalance_outside_threshold(
        self, portfolio_calculator: PortfolioCalculator
    ) -> None:
        """Test rebalancing decision when outside threshold"""
        current_allocation = {"stocks": 0.50, "bonds": 0.40, "cash": 0.10}
        target_allocation = {"stocks": 0.60, "bonds": 0.30, "cash": 0.10}

        # Stock difference is 10%, which exceeds 5% threshold
        assert portfolio_calculator.should_rebalance(
            current_allocation, target_allocation
        )

    def test_should_rebalance_disabled(self, sample_profile: UserProfile) -> None:
        """Test rebalancing when disabled in configuration"""
        sample_profile.portfolio.enable_rebalancing = False
        calculator = PortfolioCalculator(sample_profile)

        current_allocation = {"stocks": 0.50, "bonds": 0.40, "cash": 0.10}
        target_allocation = {"stocks": 0.60, "bonds": 0.30, "cash": 0.10}

        # Should not rebalance even with large differences
        assert not calculator.should_rebalance(current_allocation, target_allocation)

    def test_calculate_rebalancing_trades(
        self, portfolio_calculator: PortfolioCalculator
    ) -> None:
        """Test rebalancing trades calculation"""
        current_portfolio = PortfolioState(
            asset_values={
                "stocks": Decimal("50000"),  # Currently 50%
                "bonds": Decimal("40000"),  # Currently 40%
                "cash": Decimal("10000"),  # Currently 10%
            }
        )

        target_allocation = {"stocks": 0.60, "bonds": 0.30, "cash": 0.10}

        trades = portfolio_calculator.calculate_rebalancing_trades(
            current_portfolio, target_allocation
        )

        # Expected trades:
        # Stocks: 60000 - 50000 = +10000
        # Bonds: 30000 - 40000 = -10000
        # Cash: 10000 - 10000 = 0
        assert trades["stocks"] == Decimal("10000")
        assert trades["bonds"] == Decimal("-10000")
        assert trades["cash"] == Decimal("0")

    def test_portfolio_state_get_allocation(self) -> None:
        """Test PortfolioState allocation calculation"""
        portfolio_state = PortfolioState(
            asset_values={
                "stocks": Decimal("60000"),
                "bonds": Decimal("30000"),
                "cash": Decimal("10000"),
            }
        )

        allocation = portfolio_state.get_allocation()

        assert allocation["stocks"] == 0.6
        assert allocation["bonds"] == 0.3
        assert allocation["cash"] == 0.1

        # Test total_value property
        assert portfolio_state.total_value == Decimal("100000")

    def test_portfolio_state_get_allocation_zero_value(self) -> None:
        """Test PortfolioState allocation with zero total value"""
        portfolio_state = PortfolioState(
            asset_values={"Stocks": Decimal("0"), "Bonds": Decimal("0")}
        )

        allocation = portfolio_state.get_allocation()

        assert allocation["Stocks"] == 0.0
        assert allocation["Bonds"] == 0.0


class TestLiquidityAwareFlowStrategy:
    """Test cases for liquidity-aware cash flow strategy"""

    def setup_method(self) -> None:
        """Set up test fixtures"""
        self.portfolio_config = PortfolioConfiguration(
            asset_classes=[
                AssetClass(
                    name="Cash",
                    display_name="Cash",
                    allocation_percentage=10.0,
                    expected_return=0.5,
                    volatility=0.0,
                    liquidity_level=LiquidityLevel.HIGH,
                ),
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
            ],
            enable_rebalancing=True,
        )
        self.strategy = LiquidityAwareFlowStrategy(
            cash_buffer_months=3, portfolio_config=self.portfolio_config
        )

    def test_handle_income_cash_buffer_priority(self) -> None:
        """Test that cash buffer is filled first before investing"""
        portfolio = PortfolioState(
            asset_values={
                "cash": Decimal("1000"),  # Low cash
                "stocks": Decimal("50000"),
                "bonds": Decimal("20000"),
            }
        )

        annual_expenses = Decimal("24000")  # Need 6000 for 3-month buffer
        target_allocation = {"cash": 0.1, "stocks": 0.6, "bonds": 0.3}
        income = Decimal("10000")

        allocation = self.strategy.handle_income(
            income, portfolio, annual_expenses, target_allocation
        )

        # Should prioritize filling cash buffer (need 5000 more)
        assert allocation["cash"] == Decimal("5000")
        # Remaining 5000 should be invested in higher return assets first
        assert allocation["stocks"] > allocation["bonds"]  # Stocks have higher return

    def test_handle_expense_liquidity_priority(self) -> None:
        """Test that expenses are withdrawn in liquidity priority order"""
        portfolio = PortfolioState(
            asset_values={
                "cash": Decimal("2000"),
                "stocks": Decimal("50000"),
                "bonds": Decimal("30000"),
            }
        )

        expense = Decimal("5000")
        withdrawal = self.strategy.handle_expense(expense, portfolio)

        # Should use all cash first
        assert withdrawal["cash"] == -Decimal("2000")
        # Should withdraw from MEDIUM liquidity (Stocks) next
        assert withdrawal["stocks"] < 0
        # Should not touch LOW liquidity (Bonds) if not needed
        # (In this case, might still touch bonds due to proportional withdrawal)

    def test_handle_expense_return_optimization(self) -> None:
        """Test that within same liquidity tier, lower return assets are sold first"""
        # Create config with same liquidity but different returns
        config = PortfolioConfiguration(
            asset_classes=[
                AssetClass(
                    name="Stock_A",
                    display_name="Stock_A",
                    allocation_percentage=50.0,  # Sum must be 100%
                    expected_return=8.0,  # Higher return
                    volatility=15.0,
                    liquidity_level=LiquidityLevel.MEDIUM,
                ),
                AssetClass(
                    name="Stock_B",
                    display_name="Stock_B",
                    allocation_percentage=50.0,  # Sum must be 100%
                    expected_return=5.0,  # Lower return
                    volatility=15.0,
                    liquidity_level=LiquidityLevel.MEDIUM,
                ),
            ],
            enable_rebalancing=True,
        )

        strategy = LiquidityAwareFlowStrategy(
            cash_buffer_months=3, portfolio_config=config
        )

        portfolio = PortfolioState(
            asset_values={
                "Stock_A": Decimal("50000"),
                "Stock_B": Decimal("50000"),
            }
        )

        expense = Decimal("10000")
        withdrawal = strategy.handle_expense(expense, portfolio)

        # Should sell more of Stock_B (lower return) than Stock_A
        # This tests the return optimization logic
        assert abs(withdrawal["Stock_B"]) >= abs(withdrawal["Stock_A"])

    def test_liquidity_level_classification(self) -> None:
        """Test that assets are correctly classified by liquidity level"""
        # Test the internal liquidity tier mapping
        portfolio = PortfolioState(
            asset_values={
                "cash": Decimal("10000"),
                "stocks": Decimal("50000"),
                "bonds": Decimal("30000"),
            }
        )

        high_assets = self.strategy._get_assets_by_liquidity_tier("HIGH", portfolio)
        medium_assets = self.strategy._get_assets_by_liquidity_tier("MEDIUM", portfolio)
        low_assets = self.strategy._get_assets_by_liquidity_tier("LOW", portfolio)

        assert "cash" in high_assets
        assert "stocks" in medium_assets
        assert "bonds" in low_assets

    def test_allocation_sum_precision_correction(self) -> None:
        """Test precision correction in PortfolioState.get_allocation()"""
        # Create a portfolio with values that might have floating point precision issues
        portfolio = PortfolioState(
            asset_values={
                "Asset1": Decimal("33333.33"),
                "Asset2": Decimal("33333.33"),
                "Asset3": Decimal("33333.34"),  # Total: 100000.00
            }
        )

        allocation = portfolio.get_allocation()

        # Sum should be exactly 1.0 after precision correction
        allocation_sum = sum(allocation.values())
        assert abs(allocation_sum - 1.0) <= 1e-10

    def test_display_names(self) -> None:
        """Test strategy display names return simple identifiers"""
        liquidity_strategy = LiquidityAwareFlowStrategy()
        simple_strategy = SimpleFlowStrategy()

        # Should return simple string identifiers, not formatted strings
        assert liquidity_strategy.get_display_name() == "liquidity_aware_strategy"
        assert simple_strategy.get_display_name() == "simple_conservative_strategy"
        assert (
            "{" not in liquidity_strategy.get_display_name()
        )  # No f-string formatting


if __name__ == "__main__":
    pytest.main([__file__])
