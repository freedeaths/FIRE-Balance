"""Monte Carlo simulation for FIRE calculation risk analysis."""

import random
import statistics
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from .black_swan_events import create_black_swan_events
from .data_models import BlackSwanEvent, SimulationSettings
from .engine import EngineInput, FIREEngine


@dataclass
class MonteCarloResult:
    """Results from Monte Carlo simulation."""

    success_rate: float  # Probability of FIRE success (0-1)
    total_simulations: int
    successful_simulations: int

    # Statistical analysis
    mean_final_net_worth: float
    median_final_net_worth: float
    percentile_5_net_worth: float  # Worst 5% scenario
    percentile_95_net_worth: float  # Best 5% scenario

    # Risk metrics - final net worth
    worst_case_final_net_worth: float
    best_case_final_net_worth: float
    standard_deviation_final_net_worth: float

    # Risk metrics - minimum net worth (most sensitive indicator)
    mean_minimum_net_worth: float
    median_minimum_net_worth: float
    percentile_5_minimum_net_worth: float  # Worst 5% scenario for minimum
    percentile_25_minimum_net_worth: float  # 25th percentile for minimum
    percentile_75_minimum_net_worth: float  # 75th percentile for minimum
    percentile_95_minimum_net_worth: float  # Best 5% scenario for minimum
    worst_case_minimum_net_worth: float
    best_case_minimum_net_worth: float
    standard_deviation_minimum_net_worth: float

    # Black swan analysis results
    black_swan_impact_analysis: Optional[Dict[str, float]] = None
    worst_case_scenarios: Optional[List[str]] = None
    resilience_score: Optional[float] = None  # (0-100)
    recommended_emergency_fund: Optional[float] = None


class MonteCarloSimulator:
    """Monte Carlo simulator for FIRE calculation risk analysis."""

    def __init__(
        self,
        engine: FIREEngine,
        settings: Optional[SimulationSettings] = None,
        seed: Optional[int] = None,
    ):
        """Initialize Monte Carlo simulator.

        Args:
            engine: FIRE calculation engine
            settings: Simulation settings (uses defaults if None)
            seed: Random seed for reproducible results (None for random)
        """
        self.engine = engine
        self.settings = settings or SimulationSettings(
            num_simulations=1000,
            confidence_level=0.95,
            include_black_swan_events=True,
            income_base_volatility=0.1,
            income_minimum_factor=0.1,
            expense_base_volatility=0.05,
            expense_minimum_factor=0.5,
        )
        self.base_df = engine.projection_df.copy()
        self.seed = seed

        # Set random seed if provided
        if seed is not None:
            random.seed(seed)
            np.random.seed(seed)

        # Create personalized black swan events based on user profile
        self.all_events = create_black_swan_events(engine.profile)

    def run_simulation(
        self, progress_callback: Optional[Callable[[int, int], None]] = None
    ) -> MonteCarloResult:
        """Run complete Monte Carlo simulation.

        Args:
            progress_callback: Optional callback function
                (current_simulation, total_simulations)

        Returns:
            MonteCarloResult with statistical analysis and black swan analysis
        """
        # Reset random seed for reproducible results
        if self.seed is not None:
            random.seed(self.seed)
            np.random.seed(self.seed)

        final_net_worths: List[float] = []
        minimum_net_worths: List[float] = []
        successful_runs = 0
        simulation_data = []  # Store detailed data for black swan analysis

        for run_id in range(self.settings.num_simulations):
            # Report progress if callback provided
            if progress_callback and (
                run_id % max(1, self.settings.num_simulations // 100) == 0
            ):
                progress_callback(run_id, self.settings.num_simulations)

            # Generate random scenario with black swan events
            scenario_df, black_swan_events = self._generate_random_scenario()

            # Create temporary engine with random scenario
            temp_input = EngineInput(
                user_profile=self.engine.profile,
                annual_financial_projection=scenario_df,
            )
            temp_engine = FIREEngine(temp_input)

            # Run calculation
            result = temp_engine.calculate()

            # Collect results
            final_net_worths.append(result.final_net_worth)

            # Calculate minimum net worth across entire lifetime
            minimum_net_worth = result.final_net_worth  # fallback
            if result.yearly_results:
                minimum_net_worth = min(
                    state.net_worth for state in result.yearly_results
                )
            minimum_net_worths.append(minimum_net_worth)
            is_successful = result.is_fire_achievable
            if is_successful:
                successful_runs += 1

            # Store simulation data for black swan analysis
            simulation_data.append(
                {
                    "run_id": run_id,
                    "final_net_worth": result.final_net_worth,
                    "minimum_net_worth": minimum_net_worth,
                    "fire_success": is_successful,
                    "black_swan_events": black_swan_events,
                }
            )

        # Report final progress
        if progress_callback:
            progress_callback(
                self.settings.num_simulations, self.settings.num_simulations
            )

        # Calculate basic statistics
        final_net_worths_array = np.array(final_net_worths)
        minimum_net_worths_array = np.array(minimum_net_worths)

        # Black swan analysis
        black_swan_analysis = None
        worst_scenarios = None
        resilience_score = None
        emergency_fund = None

        if self.settings.include_black_swan_events and simulation_data:
            black_swan_analysis = self._analyze_black_swan_impact(simulation_data)
            worst_scenarios = self._identify_worst_scenarios(simulation_data)
            resilience_score = self._calculate_resilience_score(simulation_data)
            emergency_fund = self._recommend_emergency_fund(simulation_data)

        return MonteCarloResult(
            success_rate=successful_runs / self.settings.num_simulations,
            total_simulations=self.settings.num_simulations,
            successful_simulations=successful_runs,
            mean_final_net_worth=float(np.mean(final_net_worths_array)),
            median_final_net_worth=float(np.median(final_net_worths_array)),
            percentile_5_net_worth=float(np.percentile(final_net_worths_array, 5)),
            percentile_95_net_worth=float(np.percentile(final_net_worths_array, 95)),
            worst_case_final_net_worth=float(np.min(final_net_worths_array)),
            best_case_final_net_worth=float(np.max(final_net_worths_array)),
            standard_deviation_final_net_worth=float(np.std(final_net_worths_array)),
            # Minimum net worth statistics (most sensitive risk indicator)
            mean_minimum_net_worth=float(np.mean(minimum_net_worths_array)),
            median_minimum_net_worth=float(np.median(minimum_net_worths_array)),
            percentile_5_minimum_net_worth=float(
                np.percentile(minimum_net_worths_array, 5)
            ),
            percentile_25_minimum_net_worth=float(
                np.percentile(minimum_net_worths_array, 25)
            ),
            percentile_75_minimum_net_worth=float(
                np.percentile(minimum_net_worths_array, 75)
            ),
            percentile_95_minimum_net_worth=float(
                np.percentile(minimum_net_worths_array, 95)
            ),
            worst_case_minimum_net_worth=float(np.min(minimum_net_worths_array)),
            best_case_minimum_net_worth=float(np.max(minimum_net_worths_array)),
            standard_deviation_minimum_net_worth=float(
                np.std(minimum_net_worths_array)
            ),
            black_swan_impact_analysis=black_swan_analysis,
            worst_case_scenarios=worst_scenarios,
            resilience_score=resilience_score,
            recommended_emergency_fund=emergency_fund,
        )

    def _generate_random_scenario(self) -> Tuple[pd.DataFrame, List[str]]:
        """Generate a random scenario by applying variations to base data.

        Returns:
            Tuple of (Modified DataFrame, List of triggered event names)
        """
        scenario_df = self.base_df.copy()

        # Apply basic income/expense variations
        income_multiplier = self._generate_income_variation()
        scenario_df["total_income"] *= income_multiplier

        expense_multiplier = self._generate_expense_variation()
        scenario_df["total_expense"] *= expense_multiplier

        # Apply black swan events based on user settings
        if self.settings.include_black_swan_events:
            scenario_df, events = self._apply_black_swan_events(scenario_df)
            return scenario_df, events
        else:
            return scenario_df, []

    def _generate_income_variation(self) -> np.ndarray:
        """Generate random income variations.

        Models basic economic uncertainty and volatility during working years only.
        After FIRE age, income is typically more stable (pensions, fixed investments).
        Major events are handled by Black Swan Events system.

        Returns:
            Array of multipliers for each year's income
        """
        num_years = len(self.base_df)
        variations = np.ones(num_years)
        fire_age = self.engine.profile.expected_fire_age

        for i in range(num_years):
            if "age" in self.base_df.columns:
                age = int(self.base_df.iloc[i]["age"])
            else:
                age = self.engine.profile.current_age + i

            # Only apply income volatility during working years (before FIRE)
            if age < fire_age:
                # Base economic uncertainty with configurable volatility
                base_variation = np.random.normal(
                    1.0, self.settings.income_base_volatility
                )

                # Apply minimum factor safety net
                variations[i] = max(self.settings.income_minimum_factor, base_variation)
            else:
                # Post-FIRE: income is stable (pensions, fixed returns)
                variations[i] = 1.0

        return variations

    def _generate_expense_variation(self) -> np.ndarray:
        """Generate random expense variations.

        Models basic lifestyle inflation and cost increases throughout entire life.
        Expenses continue to vary during both working years and retirement.
        Major expense events are handled by Black Swan Events system.

        Returns:
            Array of multipliers for each year's expenses
        """
        num_years = len(self.base_df)
        variations = np.ones(num_years)

        # Apply expense volatility throughout entire life
        # (current_age to life_expectancy)
        for i in range(num_years):
            # Base expense volatility using normal distribution (consistent with income)
            base_variation = np.random.normal(
                1.0, self.settings.expense_base_volatility
            )

            # Apply minimum factor safety net (consistent with income)
            variations[i] = max(self.settings.expense_minimum_factor, base_variation)

        return variations

    def _apply_black_swan_events(
        self, df: pd.DataFrame
    ) -> Tuple[pd.DataFrame, List[str]]:
        """Apply black swan events to the scenario.

        Args:
            df: Base scenario DataFrame

        Returns:
            Tuple of (Modified DataFrame, List of triggered event_ids)
        """
        modified_df = df.copy()
        triggered_event_ids = []
        active_events = (
            {}
        )  # Track ongoing events {event_id: (event_object, years_remaining)}

        num_years = len(df)
        for year_idx in range(num_years):
            current_age = (
                int(modified_df.iloc[year_idx]["age"])
                if "age" in modified_df.columns
                else self.engine.profile.current_age + year_idx
            )

            # Simulate new black swan events for this year
            new_events = self._simulate_black_swan_events(current_age)

            # Filter out events that are already active (avoid duplicate events)
            actually_triggered_events = []
            for event in new_events:
                if event.event_id not in active_events:
                    actually_triggered_events.append(event)
                    triggered_event_ids.append(event.event_id)
                    if event.duration_years > 1:
                        active_events[event.event_id] = (
                            event,
                            event.duration_years - 1,
                        )
                # else: ignore the duplicate event (same type already in progress)

            # Apply new events (first year impact, full strength)
            for event in actually_triggered_events:
                modified_df = event.apply_impact(
                    modified_df, year_idx, recovery_multiplier=1.0
                )

            # Apply ongoing events with diminishing impact (events from previous years)
            newly_active_event_ids = {e.event_id for e in actually_triggered_events}
            for event_id, (original_event, years_remaining) in list(
                active_events.items()
            ):
                # Skip events that were just triggered this year
                # (avoid double application)
                if event_id in newly_active_event_ids:
                    continue

                # Calculate recovery multiplier based on recovery_factor
                recovery_multiplier = original_event.recovery_factor
                modified_df = original_event.apply_impact(
                    modified_df, year_idx, recovery_multiplier
                )

                # Update remaining years
                active_events[event_id] = (original_event, years_remaining - 1)
                if active_events[event_id][1] <= 0:
                    del active_events[event_id]

        return modified_df, triggered_event_ids

    def _simulate_black_swan_events(self, age: int) -> List[BlackSwanEvent]:
        """Simulate black swan events for a given age.

        Args:
            age: Current age

        Returns:
            List of triggered black swan events
        """
        triggered_events = []

        for event in self.all_events:
            # Check age range - this is where age filtering should happen
            if event.age_range[0] <= age <= event.age_range[1]:
                # Random check against probability
                if random.random() < event.annual_probability:
                    triggered_events.append(event)

        return triggered_events

    def analyze_sensitivity(
        self, parameter: str, variations: List[float]
    ) -> List[float]:
        """Analyze sensitivity to a specific parameter.

        Args:
            parameter: Parameter to vary ('income_volatility',
                'expense_volatility', 'black_swan_probability')
            variations: List of standard deviation values to test

        Returns:
            List of success rates for each variation
        """
        results = []

        for variation in variations:
            # Create modified settings based on parameter
            if parameter == "income_volatility":
                modified_settings = SimulationSettings(
                    num_simulations=self.settings.num_simulations
                    // 4,  # Faster for sensitivity analysis
                    confidence_level=self.settings.confidence_level,
                    include_black_swan_events=self.settings.include_black_swan_events,
                    income_base_volatility=variation,
                    income_minimum_factor=self.settings.income_minimum_factor,
                    expense_base_volatility=self.settings.expense_base_volatility,
                    expense_minimum_factor=self.settings.expense_minimum_factor,
                )
            elif parameter == "expense_volatility":
                # Vary expense volatility (standard deviation)
                modified_settings = SimulationSettings(
                    num_simulations=self.settings.num_simulations // 4,
                    confidence_level=self.settings.confidence_level,
                    include_black_swan_events=self.settings.include_black_swan_events,
                    income_base_volatility=self.settings.income_base_volatility,
                    income_minimum_factor=self.settings.income_minimum_factor,
                    expense_base_volatility=variation,
                    expense_minimum_factor=self.settings.expense_minimum_factor,
                )
            elif parameter == "black_swan_probability":
                # Toggle black swan events on/off
                modified_settings = SimulationSettings(
                    num_simulations=self.settings.num_simulations // 4,
                    confidence_level=self.settings.confidence_level,
                    include_black_swan_events=variation
                    > 0.5,  # Treat as boolean threshold
                    income_base_volatility=self.settings.income_base_volatility,
                    income_minimum_factor=self.settings.income_minimum_factor,
                    expense_base_volatility=self.settings.expense_base_volatility,
                    expense_minimum_factor=self.settings.expense_minimum_factor,
                )
            else:
                raise ValueError(
                    f"Unknown parameter: {parameter}. "
                    f"Supported: 'income_volatility', 'expense_volatility', "
                    f"'black_swan_probability'"
                )

            # Run simulation with modified parameter (use same seed for consistency)
            temp_simulator = MonteCarloSimulator(
                self.engine, modified_settings, self.seed
            )
            result = temp_simulator.run_simulation()
            results.append(result.success_rate)

        return results

    def _analyze_black_swan_impact(
        self, simulation_data: List[Dict]
    ) -> Dict[str, float]:
        """Analyze black swan impact on success rate."""
        impact_analysis = {}

        # Find worst 10% scenarios (at least 1 scenario)
        worst_count = max(1, len(simulation_data) // 10)
        worst_10_percent = sorted(simulation_data, key=lambda x: x["final_net_worth"])[
            :worst_count
        ]

        if worst_10_percent:
            avg_worst_net_worth = statistics.mean(
                [r["final_net_worth"] for r in worst_10_percent]
            )
            success_rate_worst = sum(
                1 for r in worst_10_percent if r["fire_success"]
            ) / len(worst_10_percent)

            impact_analysis["worst_10_percent_avg_net_worth"] = avg_worst_net_worth
            impact_analysis["worst_10_percent_success_rate"] = success_rate_worst
            impact_analysis["black_swan_impact_severity"] = max(
                0, 1.0 - success_rate_worst
            )

        # Analyze event frequency
        all_events = []
        for sim in simulation_data:
            all_events.extend(sim["black_swan_events"])

        if all_events:
            from collections import Counter

            event_counts = Counter(all_events)
            impact_analysis["most_frequent_events"] = dict(event_counts.most_common())
            impact_analysis["total_events_triggered"] = len(all_events)
            impact_analysis["avg_events_per_simulation"] = len(all_events) / len(
                simulation_data
            )

        return impact_analysis

    def _identify_worst_scenarios(self, simulation_data: List[Dict]) -> List[str]:
        """Identify worst-case scenarios."""
        scenarios = []

        # Analyze failure rate
        failed_runs = [r for r in simulation_data if not r["fire_success"]]
        # If failure rate > 10%
        if len(failed_runs) > len(simulation_data) * 0.1:
            failure_rate = len(failed_runs) / len(simulation_data)
            scenarios.append(
                f"Approximately {failure_rate:.0%} of simulations show "
                f"FIRE plan failure"
            )

            # Analyze worst failures
            worst_failures = sorted(failed_runs, key=lambda x: x["final_net_worth"])[
                : max(1, len(failed_runs) // 10)
            ]
            if worst_failures:
                avg_worst = statistics.mean(
                    [r["final_net_worth"] for r in worst_failures]
                )
                scenarios.append(
                    f"Worst case average final net worth: ${avg_worst:,.0f}"
                )

        # Analyze negative net worth scenarios
        negative_net_worth = [r for r in simulation_data if r["final_net_worth"] < 0]
        if negative_net_worth:
            negative_rate = len(negative_net_worth) / len(simulation_data)
            scenarios.append(
                f"{negative_rate:.1%} of scenarios end with negative net worth"
            )

        return scenarios

    def _calculate_resilience_score(self, simulation_data: List[Dict]) -> float:
        """Calculate resilience score (0-100)."""
        success_rate = len([r for r in simulation_data if r["fire_success"]]) / len(
            simulation_data
        )

        # Consider success rate and result stability
        final_net_worths = [r["final_net_worth"] for r in simulation_data]
        mean_net_worth = statistics.mean(final_net_worths)

        if mean_net_worth == 0:
            cv = 1  # Maximum volatility
        else:
            cv = statistics.stdev(final_net_worths) / abs(mean_net_worth)

        # Calculate combined score
        stability_score = max(
            0, 1 - cv
        )  # Lower coefficient of variation = higher stability
        resilience = (success_rate * 0.7 + stability_score * 0.3) * 100

        return min(100, max(0, resilience))

    def _recommend_emergency_fund(self, simulation_data: List[Dict]) -> float:
        """Recommend emergency fund based on risk analysis."""
        # Estimate user's annual expenses from engine data
        if hasattr(self.engine, "profile") and hasattr(
            self.engine.profile, "annual_expenses"
        ):
            annual_expenses = self.engine.profile.annual_expenses
        else:
            # Fallback: estimate from base DataFrame if available
            if "total_expense" in self.base_df.columns:
                annual_expenses = float(self.base_df["total_expense"].mean())
            else:
                annual_expenses = 50000.0  # Default fallback

        # Adjust based on success rate
        success_rate = len([r for r in simulation_data if r["fire_success"]]) / len(
            simulation_data
        )

        if success_rate >= 0.9:
            emergency_months = 6  # High success rate, 6 months expenses
        elif success_rate >= 0.7:
            emergency_months = 12  # Medium success rate, 1 year expenses
        else:
            emergency_months = 18  # Low success rate, 1.5 years expenses

        return float(annual_expenses * emergency_months / 12)
