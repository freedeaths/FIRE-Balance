# Portfolio management and investment strategy module

import logging
import sys
from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Dict, List, Optional

from .data_models import LiquidityLevel, UserProfile

# Set up logger for portfolio calculations
logger = logging.getLogger(__name__)


@dataclass
class PortfolioState:
    """Current state of the investment portfolio

    Note: Validation happens in get_allocation() rather than __init__ because:
    1. Portfolio values change frequently during simulation
    2. Intermediate states may temporarily violate allocation constraints
    3. Only final allocation % need to be valid (not intermediate Decimal values)
    4. This allows for more flexible state management during calculations
    """

    asset_values: Dict[str, Decimal]  # Asset name -> current value

    @property
    def total_value(self) -> Decimal:
        """Calculate total portfolio value from asset values"""
        return sum(self.asset_values.values()) or Decimal("0")

    def get_allocation(self) -> Dict[str, float]:
        """Get current allocation percentages with precision handling"""
        total = self.total_value
        if total == 0:
            return {name: 0.0 for name in self.asset_values.keys()}

        total_float = float(total)
        raw_allocation = {
            name: float(value) / total_float
            for name, value in self.asset_values.items()
        }

        # Check if allocation sums to 1.0 within tolerance
        allocation_sum = sum(raw_allocation.values())
        tolerance = 0.0001  # 0.01% tolerance for PortfolioState (runtime calculations)

        if abs(allocation_sum - 1.0) > tolerance:
            logger.warning(
                f"Portfolio allocation sum deviates from 1.0: {allocation_sum:.6f} "
                f"(difference: {allocation_sum - 1.0:.6f}). Auto-adjusting."
            )

            # More robust adjustment: subtract difference from largest allocation
            if allocation_sum > 0:
                # First try proportional adjustment
                adjustment_factor = 1.0 / allocation_sum
                adjusted_allocation = {
                    name: value * adjustment_factor
                    for name, value in raw_allocation.items()
                }

                # Verify and apply precision correction if needed
                adjusted_sum = sum(adjusted_allocation.values())
                remaining_error = 1.0 - adjusted_sum

                if abs(remaining_error) > sys.float_info.epsilon:
                    # Find largest allocation and adjust it to guarantee exactly 1.0
                    largest_asset = max(
                        adjusted_allocation.items(), key=lambda x: x[1]
                    )[0]
                    adjusted_allocation[largest_asset] += remaining_error

                    final_sum = sum(adjusted_allocation.values())
                    logger.info(
                        f"Allocation sum after precision correction: {final_sum:.10f}"
                    )
                else:
                    logger.info(f"Adjusted allocation sum: {adjusted_sum:.6f}")

                return adjusted_allocation
            else:
                logger.error(
                    "All portfolio values are zero, cannot normalize allocation"
                )
                return raw_allocation

        return raw_allocation


@dataclass
class AssetRandomFactor:
    """Random factor for a specific asset class"""

    name: str
    random_factor: float


@dataclass
class PortfolioRandomFactors:
    """Random factors for Monte Carlo (matches PortfolioConfiguration pattern)"""

    asset_factors: List[AssetRandomFactor]

    def get_factor(self, asset_name: str) -> float:
        """Get random factor for specific asset"""
        for factor in self.asset_factors:
            if factor.name == asset_name:
                return factor.random_factor
        return 0.0  # Default if asset not found

    @classmethod
    def from_dict(cls, factors: Dict[str, float]) -> "PortfolioRandomFactors":
        """Create from dict for convenience

        Args:
            factors: Dict mapping asset name to random factor
                    e.g., {"Stocks": 1.2, "Bonds": -0.8, "Cash": 0.1}
        """
        return cls(
            asset_factors=[
                AssetRandomFactor(name=name, random_factor=factor)
                for name, factor in factors.items()
            ]
        )


class PortfolioCalculator:
    """Investment portfolio calculator: pure calculation logic, stateless"""

    def __init__(self, profile: UserProfile):
        self.profile = profile
        self.portfolio_config = profile.portfolio

    def get_target_allocation(self, age: int) -> Dict[str, float]:
        """Get target allocation based on portfolio configuration

        Args:
            age: User's age (reserved for future dynamic allocation features)

        Returns:
            Dict mapping asset names to allocation percentages (0.0-1.0)
        """
        return {
            asset.name: asset.allocation_percentage / 100.0
            for asset in self.portfolio_config.asset_classes
        }

    def calculate_returns_by_allocation(
        self, allocation: Dict[str, float], portfolio_value: Decimal
    ) -> Decimal:
        """Calculate portfolio return based on given allocation and expected returns

        Args:
            allocation: Actual asset allocation (e.g., {"A": 0.6, "B": 0.3, "C": 0.1})
            portfolio_value: Total portfolio value

        Returns:
            Expected annual return amount
        """
        if portfolio_value <= 0:
            return Decimal("0")

        total_return = Decimal("0")

        for asset in self.portfolio_config.asset_classes:
            actual_allocation = allocation.get(asset.name, 0.0)
            expected_return = (
                asset.expected_return / 100.0
            )  # Convert percentage to decimal
            asset_return = Decimal(str(expected_return * actual_allocation))
            total_return += asset_return

        return portfolio_value * total_return

    def calculate_returns_with_volatility(
        self,
        allocation: Dict[str, float],
        portfolio_value: Decimal,
        random_factors: PortfolioRandomFactors,
    ) -> Decimal:
        """Calculate portfolio return with volatility for Monte Carlo simulation

        Args:
            allocation: Actual asset allocation
            portfolio_value: Total portfolio value
            random_factors: Random factors by asset class (provided by Monte Carlo)
                Each factor typically in range [-3, 3] for normal distribution bounds

        Returns:
            Return amount with volatility applied
        """
        if portfolio_value <= 0:
            return Decimal("0")

        total_return = Decimal("0")

        for asset in self.portfolio_config.asset_classes:
            actual_allocation = allocation.get(asset.name, 0.0)

            # Expected return + volatility adjustment per asset
            expected_return = asset.expected_return / 100.0
            volatility = asset.volatility / 100.0
            asset_random_factor = random_factors.get_factor(asset.name)
            volatility_adjustment = volatility * asset_random_factor
            actual_return = expected_return + volatility_adjustment

            asset_return = Decimal(str(actual_return * actual_allocation))
            total_return += asset_return

        return portfolio_value * total_return

    def should_rebalance(
        self,
        current_allocation: Dict[str, float],
        target_allocation: Dict[str, float],
        threshold: float = 0.05,
    ) -> bool:
        """Determine if portfolio should be rebalanced"""
        if not self.portfolio_config.enable_rebalancing:
            return False

        for asset_name in target_allocation:
            current = current_allocation.get(asset_name, 0.0)
            target = target_allocation[asset_name]
            if abs(current - target) > threshold:
                return True
        return False

    def calculate_rebalancing_trades(
        self, current_portfolio: PortfolioState, target_allocation: Dict[str, float]
    ) -> Dict[str, Decimal]:
        """Calculate trades needed to rebalance portfolio"""
        if current_portfolio.total_value <= 0:
            return {
                asset.name: Decimal("0")
                for asset in self.portfolio_config.asset_classes
            }

        trades = {}
        for asset in self.portfolio_config.asset_classes:
            asset_name = asset.name
            target_value = current_portfolio.total_value * Decimal(
                str(target_allocation.get(asset_name, 0.0))
            )
            current_value = current_portfolio.asset_values.get(asset_name, Decimal("0"))
            trades[asset_name] = target_value - current_value

        return trades


# =============================================================================
# Cash Flow Strategy Pattern
# =============================================================================


class CashFlowStrategy(ABC):
    """Abstract base class for cash flow handling strategies"""

    @abstractmethod
    def handle_income(
        self,
        income: Decimal,
        portfolio: PortfolioState,
        annual_expenses: Decimal,
        target_allocation: Dict[str, float],
    ) -> Dict[str, Decimal]:
        """Handle income allocation

        Args:
            income: Income amount to allocate
            portfolio: Current portfolio state
            annual_expenses: Annual expenses for cash buffer calculation
            target_allocation: Target asset allocation ratios

        Returns:
            Dict of asset name -> amount to add/allocate
        """

    @abstractmethod
    def handle_expense(
        self, expense: Decimal, portfolio: PortfolioState
    ) -> Dict[str, Decimal]:
        """Handle expense withdrawal

        Args:
            expense: Expense amount to withdraw
            portfolio: Current portfolio state

        Returns:
            Dict of asset name -> amount to withdraw (negative values)
        """

    @abstractmethod
    def get_display_name(self) -> str:
        """Get user-friendly strategy name"""


class LiquidityAwareFlowStrategy(CashFlowStrategy):
    """Liquidity-aware cash flow strategy: optimize within liquidity constraints"""

    def __init__(
        self, cash_buffer_months: int = 3, portfolio_config: Optional[Any] = None
    ):
        """
        Args:
            cash_buffer_months: Number of months of expenses to keep as cash buffer
            portfolio_config: PortfolioConfiguration for asset liquidity/return info
        """
        self.cash_buffer_months = cash_buffer_months
        self.portfolio_config = portfolio_config

    def handle_income(
        self,
        income: Decimal,
        portfolio: PortfolioState,
        annual_expenses: Decimal,
        target_allocation: Dict[str, float],
    ) -> Dict[str, Decimal]:
        """Handle income: liquidity-aware allocation with return optimization"""

        # Initialize allocation dict
        allocation = {name: Decimal("0") for name in target_allocation.keys()}

        # Step 1: Ensure HIGH liquidity buffer (emergency fund)
        high_liquidity_buffer = self._ensure_liquidity_buffer(
            income, portfolio, annual_expenses, allocation
        )
        remaining_income = income - high_liquidity_buffer

        # Step 2: Invest remaining by return optimization within target allocation
        if remaining_income > 0:
            self._allocate_by_return_optimization(
                remaining_income, target_allocation, allocation
            )

        return allocation

    def _ensure_liquidity_buffer(
        self,
        income: Decimal,
        portfolio: PortfolioState,
        annual_expenses: Decimal,
        allocation: Dict[str, Decimal],
    ) -> Decimal:
        """Ensure adequate high-liquidity buffer, return amount used"""
        # Calculate required cash buffer
        required_buffer = annual_expenses * Decimal(str(self.cash_buffer_months / 12.0))

        # Find high-liquidity assets (assume "cash" for now - lowercase normalized)
        # TODO: Use actual asset config to identify HIGH liquidity assets
        current_high_liquidity = portfolio.asset_values.get("cash", Decimal("0"))

        buffer_shortfall = max(Decimal("0"), required_buffer - current_high_liquidity)
        if buffer_shortfall > 0:
            buffer_allocation = min(income, buffer_shortfall)
            allocation["cash"] = buffer_allocation
            return buffer_allocation

        return Decimal("0")

    def _allocate_by_return_optimization(
        self,
        remaining_income: Decimal,
        target_allocation: Dict[str, float],
        allocation: Dict[str, Decimal],
    ) -> None:
        """Allocate remaining income by return optimization within target allocation"""
        if not self.portfolio_config:
            # Fallback to simple proportional allocation
            self._allocate_proportionally(
                remaining_income, target_allocation, allocation
            )
            return

        # Get non-HIGH liquidity assets sorted by expected return (descending)
        investment_assets = [
            asset
            for asset in self.portfolio_config.asset_classes
            if asset.liquidity_level != LiquidityLevel.HIGH
            and target_allocation.get(asset.name, 0) > 0
        ]

        # Sort by expected return (highest first) for return maximization
        investment_assets.sort(key=lambda x: x.expected_return, reverse=True)

        # Calculate total investment ratio (excluding HIGH liquidity)
        total_investment_ratio = sum(
            target_allocation.get(asset.name, 0) for asset in investment_assets
        )

        if total_investment_ratio > 0:
            # Allocate proportionally within non-HIGH liquidity assets
            # (Future enhancement: could do greedy allocation to highest return assets)
            for asset in investment_assets:
                target_ratio = target_allocation.get(asset.name, 0)
                if target_ratio > 0:
                    investment_ratio = target_ratio / total_investment_ratio
                    allocation[asset.name] += remaining_income * Decimal(
                        str(investment_ratio)
                    )

    def _allocate_proportionally(
        self,
        remaining_income: Decimal,
        target_allocation: Dict[str, float],
        allocation: Dict[str, Decimal],
    ) -> None:
        """Fallback proportional allocation when no config available"""
        investment_targets = {k: v for k, v in target_allocation.items() if k != "Cash"}
        total_investment_ratio = sum(investment_targets.values())

        if total_investment_ratio > 0:
            for asset_name, target_ratio in investment_targets.items():
                investment_ratio = target_ratio / total_investment_ratio
                allocation[asset_name] += remaining_income * Decimal(
                    str(investment_ratio)
                )

    def handle_expense(
        self, expense: Decimal, portfolio: PortfolioState
    ) -> Dict[str, Decimal]:
        """Handle expense: liquidity-priority withdrawal with return optimization"""

        withdrawal = {name: Decimal("0") for name in portfolio.asset_values.keys()}
        remaining_expense = expense

        # Step 1: Use HIGH liquidity assets first (Cash)
        high_liquidity_used = self._withdraw_from_liquidity_tier(
            "HIGH", remaining_expense, portfolio, withdrawal
        )
        remaining_expense -= high_liquidity_used

        # Step 2: Use MEDIUM liquidity assets if needed (Stocks)
        if remaining_expense > 0:
            medium_liquidity_used = self._withdraw_from_liquidity_tier(
                "MEDIUM", remaining_expense, portfolio, withdrawal
            )
            remaining_expense -= medium_liquidity_used

        # Step 3: Use LOW liquidity assets if still needed (Bonds, Savings)
        if remaining_expense > 0:
            self._withdraw_from_liquidity_tier(
                "LOW", remaining_expense, portfolio, withdrawal
            )

        return withdrawal

    def _withdraw_from_liquidity_tier(
        self,
        tier: str,
        needed_amount: Decimal,
        portfolio: PortfolioState,
        withdrawal: Dict[str, Decimal],
    ) -> Decimal:
        """Withdraw from assets in specific liquidity tier, return amount withdrawn"""
        tier_assets = self._get_assets_by_liquidity_tier(tier, portfolio)

        if not tier_assets:
            return Decimal("0")

        total_tier_value = sum(tier_assets.values())
        if total_tier_value == 0:
            return Decimal("0")

        actual_withdrawal = min(needed_amount, total_tier_value)
        if actual_withdrawal == 0:
            return Decimal("0")
        actual_withdrawal = Decimal(str(actual_withdrawal))

        # Optimize withdrawal: sell lowest return assets first in same liquidity tier
        if self.portfolio_config:
            self._withdraw_by_return_optimization(
                tier_assets, actual_withdrawal, withdrawal
            )
        else:
            # Fallback: withdraw proportionally
            self._withdraw_proportionally(tier_assets, actual_withdrawal, withdrawal)

        return actual_withdrawal

    def _withdraw_by_return_optimization(
        self,
        tier_assets: Dict[str, Decimal],
        withdrawal_amount: Decimal,
        withdrawal: Dict[str, Decimal],
    ) -> None:
        """Withdraw by selling lowest return assets first (tax loss harvesting logic)"""
        # Get asset return info and sort by expected return (ascending-sell 1st lowest)
        asset_returns = []
        if self.portfolio_config is None:
            return
        for asset in self.portfolio_config.asset_classes:
            if asset.name in tier_assets:
                asset_returns.append(
                    (asset.name, asset.expected_return, tier_assets[asset.name])
                )

        asset_returns.sort(key=lambda x: x[1])  # Sort by return (lowest first)

        remaining_withdrawal = withdrawal_amount
        for asset_name, _, asset_value in asset_returns:
            if remaining_withdrawal <= 0:
                break

            asset_withdrawal = min(remaining_withdrawal, asset_value)
            withdrawal[asset_name] = -asset_withdrawal
            remaining_withdrawal -= asset_withdrawal

    def _withdraw_proportionally(
        self,
        tier_assets: Dict[str, Decimal],
        withdrawal_amount: Decimal,
        withdrawal: Dict[str, Decimal],
    ) -> None:
        """Fallback proportional withdrawal"""
        total_tier_value = sum(tier_assets.values())
        for asset_name, asset_value in tier_assets.items():
            if asset_value > 0:
                withdrawal_ratio = asset_value / total_tier_value
                withdrawal[asset_name] = -withdrawal_amount * withdrawal_ratio

    def _get_assets_by_liquidity_tier(
        self, tier: str, portfolio: PortfolioState
    ) -> Dict[str, Decimal]:
        """Get assets belonging to specific liquidity tier"""
        if not self.portfolio_config:
            # Fallback to hardcoded mapping (lowercase normalized)
            tier_mapping = {
                "HIGH": ["cash"],
                "MEDIUM": ["stocks"],
                "LOW": ["bonds", "savings"],
            }
            tier_asset_names = tier_mapping.get(tier, [])
        else:
            # Use actual asset configuration
            target_liquidity = getattr(LiquidityLevel, tier, None)
            if not target_liquidity:
                return {}

            tier_asset_names = [
                asset.name
                for asset in self.portfolio_config.asset_classes
                if asset.liquidity_level == target_liquidity
            ]

        return {
            name: value
            for name, value in portfolio.asset_values.items()
            if name in tier_asset_names and value > 0
        }

    def get_display_name(self) -> str:
        return "liquidity_aware_strategy"


# Keep SimpleFlowStrategy for backward compatibility
class SimpleFlowStrategy(LiquidityAwareFlowStrategy):
    """Backward compatibility alias for LiquidityAwareFlowStrategy"""

    def get_display_name(self) -> str:
        return "simple_conservative_strategy"


# =============================================================================
# Portfolio Simulator
# =============================================================================


@dataclass
class YearlyPortfolioResult:
    """Result of one year portfolio simulation"""

    age: int
    starting_portfolio_value: Decimal
    investment_returns: Decimal
    cash_flows_allocated: Dict[str, Decimal]  # Income/expense allocations
    ending_portfolio_value: Decimal
    ending_allocation: Dict[str, float]
    rebalanced: bool


class PortfolioSimulator:
    """Manages portfolio state evolution over time"""

    def __init__(
        self,
        initial_portfolio: PortfolioState,
        calculator: PortfolioCalculator,
        cash_flow_strategy: Optional[CashFlowStrategy] = None,
    ):
        """
        Args:
            initial_portfolio: Starting portfolio state
            calculator: Portfolio calculator for computations
            cash_flow_strategy: Strategy for handling cash flows
        """
        self.current_portfolio = initial_portfolio
        self.calculator = calculator
        self.strategy = cash_flow_strategy or LiquidityAwareFlowStrategy(
            portfolio_config=calculator.portfolio_config
        )

    def simulate_year(
        self, age: int, net_cash_flow: Decimal, annual_expenses: Decimal
    ) -> YearlyPortfolioResult:
        """Simulate one year of portfolio changes

        Args:
            age: User's age this year
            net_cash_flow: Net cash flow (income - expenses)
            annual_expenses: Total annual expenses (for cash buffer calculation)

        Returns:
            Results of the year's portfolio simulation
        """
        starting_value = self.current_portfolio.total_value
        starting_allocation = self.current_portfolio.get_allocation()

        # Step 1: Calculate investment returns based on current allocation
        investment_returns = self.calculator.calculate_returns_by_allocation(
            starting_allocation, starting_value
        )

        # Step 2: Apply investment returns to portfolio
        self._apply_returns(investment_returns, starting_allocation)

        # Step 3: Handle cash flows
        if net_cash_flow != 0:
            target_allocation = self.calculator.get_target_allocation(age)

            if net_cash_flow > 0:
                # Handle income
                cash_flows = self.strategy.handle_income(
                    net_cash_flow,
                    self.current_portfolio,
                    annual_expenses,
                    target_allocation,
                )
            else:
                # Handle expenses
                cash_flows = self.strategy.handle_expense(
                    abs(net_cash_flow), self.current_portfolio
                )

            self._apply_cash_flows(cash_flows)
        else:
            cash_flows = {}

        # Step 4: Check if rebalancing is needed
        rebalanced = self._maybe_rebalance(age)

        return YearlyPortfolioResult(
            age=age,
            starting_portfolio_value=starting_value,
            investment_returns=investment_returns,
            cash_flows_allocated=cash_flows,
            ending_portfolio_value=self.current_portfolio.total_value,
            ending_allocation=self.current_portfolio.get_allocation(),
            rebalanced=rebalanced,
        )

    def _apply_returns(
        self, total_returns: Decimal, allocation: Dict[str, float]
    ) -> None:
        """Apply investment returns proportionally to assets"""
        for asset_name, current_value in self.current_portfolio.asset_values.items():
            asset_allocation = allocation.get(asset_name, 0.0)
            asset_returns = total_returns * Decimal(str(asset_allocation))
            self.current_portfolio.asset_values[asset_name] = (
                current_value + asset_returns
            )

    def _apply_cash_flows(self, cash_flows: Dict[str, Decimal]) -> None:
        """Apply cash flow changes to portfolio"""
        for asset_name, flow_amount in cash_flows.items():
            if asset_name in self.current_portfolio.asset_values:
                self.current_portfolio.asset_values[asset_name] += flow_amount
            else:
                self.current_portfolio.asset_values[asset_name] = flow_amount

        # Ensure no negative values
        for asset_name in self.current_portfolio.asset_values:
            self.current_portfolio.asset_values[asset_name] = max(
                Decimal("0"), self.current_portfolio.asset_values[asset_name]
            )

    def _maybe_rebalance(self, age: int) -> bool:
        """Check and execute rebalancing if needed"""
        current_allocation = self.current_portfolio.get_allocation()
        target_allocation = self.calculator.get_target_allocation(age)

        if self.calculator.should_rebalance(current_allocation, target_allocation):
            trades = self.calculator.calculate_rebalancing_trades(
                self.current_portfolio, target_allocation
            )
            self._execute_trades(trades)
            return True

        return False

    def _execute_trades(self, trades: Dict[str, Decimal]) -> None:
        """Execute rebalancing trades (no transaction costs now)"""
        for asset_name, trade_amount in trades.items():
            if asset_name in self.current_portfolio.asset_values:
                self.current_portfolio.asset_values[asset_name] += trade_amount
            else:
                self.current_portfolio.asset_values[asset_name] = max(
                    Decimal("0"), trade_amount
                )


# TODO: Future implementation - PortfolioAdvisor
#
# A PortfolioAdvisor class could be implemented to provide allocation suggestions
# to users without affecting actual calculations. This would include:
#
# class PortfolioAdvisor:
#     """Provides portfolio allocation suggestions and recommendations"""
#
#     def get_lifecycle_suggestion(self, age: int) -> Dict[str, float]:
#         """Suggest allocation based on lifecycle investing (100-age rule)"""
#         pass
#
#     def get_target_date_suggestion(self, age: int, retirement_age: int)
#         -> Dict[str, float]:
#         """Suggest allocation based on target-date fund principles"""
#         pass
#
#     def analyze_current_allocation(self, current: Dict[str, float], age: int) -> Dict:
#         """Analyze user's current allocation and provide feedback"""
#         pass
#
# This would be used in the UI layer to help users configure their portfolios,
# while keeping the actual PortfolioManager calculations simple and predictable.

# TODO: Transaction Costs
#
# Transaction costs are currently set to 0 by default as they vary significantly
# across countries and brokers. Future implementation should:
#
# 1. Add optional transaction_cost_rate parameter to PortfolioConfiguration
# 2. Consider costs in rebalancing decisions (cost-benefit analysis)
# 3. Provide UI warning: "Calculations assume 0% transaction costs"
# 4. Allow users to input their specific broker fees
#
# Common transaction costs by region:
# - US: 0-1% (many brokers now 0% for stocks/ETFs)
# - EU: 0.1-0.5%
# - Asia: 0.1-1%
#
# This complexity should be handled in UI layer with appropriate disclaimers.

# TODO: Monte Carlo Integration
#
# The calculate_returns_with_volatility() method requires PortfolioRandomFactors to be
# provided by the Monte Carlo layer. This design ensures:
#
# 1. Monte Carlo controls random number generation (distribution, bounds, seed)
# 2. PortfolioCalculator remains stateless and deterministic
# 3. Each asset class has independent random factors (more realistic)
# 4. Flexibility for different volatility models (normal, t-distribution, etc.)
# 5. Type safety with structured data matching PortfolioConfiguration pattern
#
# The Monte Carlo layer should:
# - Generate random factors for each asset with appropriate distribution
# - Apply bounds (typically [-3, 3] for normal distribution)
# - Handle correlations between assets if needed
# - Use PortfolioRandomFactors.from_dict() for convenience
#
# Example usage:
# random_factors = PortfolioRandomFactors.from_dict({
#     "Stocks": random.gauss(0, 1),
#     "Bonds": random.gauss(0, 1),
#     "Cash": random.gauss(0, 1)
# })
