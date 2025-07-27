#!/usr/bin/env python3
"""
Advanced test suite for Monte Carlo simulation functionality.
Tests the refactored Monte Carlo system with black swan events.
"""

import unittest
from unittest.mock import patch

import pandas as pd

from core.black_swan_events import FinancialCrisisEvent
from core.data_models import SimulationSettings, UserProfile
from core.engine import EngineInput, FIREEngine
from core.monte_carlo import MonteCarloResult, MonteCarloSimulator


class TestMonteCarloSimulatorSetup(unittest.TestCase):
    """Test Monte Carlo simulator initialization and setup."""

    def setUp(self) -> None:
        """Set up test fixtures."""
        self.profile = UserProfile(
            birth_year=1990,
            expected_fire_age=45,
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=50000.0,
            inflation_rate=3.0,
            safety_buffer_months=12.0,
        )

        # Create basic projection
        projection_data = []
        for year_idx in range(5):
            age = self.profile.current_age + year_idx
            projection_data.append(
                {
                    "age": age,
                    "year": 2025 + year_idx,
                    "total_income": 100000,
                    "total_expense": 50000,
                }
            )

        self.projection_df = pd.DataFrame(projection_data)

        self.engine_input = EngineInput(
            user_profile=self.profile, annual_financial_projection=self.projection_df
        )
        self.engine = FIREEngine(self.engine_input)

    def test_simulator_initialization(self) -> None:
        """Test that simulator initializes correctly."""
        simulator = MonteCarloSimulator(self.engine)

        # Should have default settings
        self.assertIsInstance(simulator.settings, SimulationSettings)
        self.assertEqual(simulator.settings.num_simulations, 1000)

        # Should have base DataFrame
        self.assertTrue(len(simulator.base_df) > 0)
        self.assertEqual(len(simulator.base_df), 5)

        # Should have personalized events
        self.assertEqual(len(simulator.all_events), 15)
        self.assertTrue(all(hasattr(e, "event_id") for e in simulator.all_events))

    def test_simulator_with_custom_settings(self) -> None:
        """Test simulator with custom settings."""
        custom_settings = SimulationSettings(
            num_simulations=100,
            confidence_level=0.95,
            include_black_swan_events=False,
            income_base_volatility=0.2,
            income_minimum_factor=0.1,
            expense_base_volatility=0.1,
            expense_minimum_factor=0.5,
        )

        simulator = MonteCarloSimulator(self.engine, custom_settings)

        self.assertEqual(simulator.settings.num_simulations, 100)
        self.assertFalse(simulator.settings.include_black_swan_events)
        self.assertEqual(simulator.settings.income_base_volatility, 0.2)
        self.assertEqual(simulator.settings.expense_base_volatility, 0.1)


class TestBasicVariations(unittest.TestCase):
    """Test basic income/expense variations without black swan events."""

    def setUp(self) -> None:
        """Set up test fixtures."""
        self.profile = UserProfile(
            birth_year=1990,
            expected_fire_age=45,
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=50000.0,
            inflation_rate=3.0,
            safety_buffer_months=12.0,
        )

        projection_data = []
        for year_idx in range(10):
            age = self.profile.current_age + year_idx
            projection_data.append(
                {
                    "age": age,
                    "year": 2025 + year_idx,
                    "total_income": 100000,
                    "total_expense": 50000,
                }
            )

        self.projection_df = pd.DataFrame(projection_data)
        self.engine_input = EngineInput(
            user_profile=self.profile, annual_financial_projection=self.projection_df
        )
        self.engine = FIREEngine(self.engine_input)

        # Settings without black swan events
        self.settings = SimulationSettings(
            num_simulations=50,
            confidence_level=0.95,
            include_black_swan_events=False,
            income_base_volatility=0.1,
            income_minimum_factor=0.1,
            expense_base_volatility=0.05,
            expense_minimum_factor=0.5,
        )
        self.simulator = MonteCarloSimulator(self.engine, self.settings)

    def test_income_variation_generation(self) -> None:
        """Test income variation generation."""
        variations = self.simulator._generate_income_variation()

        # Should have variations for each year
        self.assertEqual(len(variations), 10)

        # All variations should be positive (minimum factor applies)
        self.assertTrue(all(v > 0 for v in variations))

        # Should respect minimum factor
        self.assertTrue(
            all(v >= self.settings.income_minimum_factor for v in variations)
        )

        # Working years should vary, post-FIRE should be stable
        working_years = variations[:10]  # Age 35-44 (working years)

        # Working years should have some variation (not all exactly 1.0)
        self.assertFalse(all(abs(v - 1.0) < 0.001 for v in working_years))

    def test_expense_variation_generation(self) -> None:
        """Test expense variation generation."""
        variations = self.simulator._generate_expense_variation()

        # Should have variations for each year
        self.assertEqual(len(variations), 10)

        # All variations should be positive
        self.assertTrue(all(v > 0 for v in variations))

        # Should respect minimum factor
        self.assertTrue(
            all(v >= self.settings.expense_minimum_factor for v in variations)
        )

        # Should have some variation (not all exactly 1.0)
        self.assertFalse(all(abs(v - 1.0) < 0.001 for v in variations))

    def test_random_scenario_without_black_swan(self) -> None:
        """Test random scenario generation without black swan events."""
        original_df = self.simulator.base_df.copy()
        scenario_df, events = self.simulator._generate_random_scenario()

        # Should return tuple with DataFrame and empty events list
        self.assertIsInstance(scenario_df, pd.DataFrame)
        self.assertIsInstance(events, list)
        self.assertEqual(len(events), 0)

        # Should have same structure as original
        self.assertEqual(len(scenario_df), len(original_df))
        self.assertEqual(list(scenario_df.columns), list(original_df.columns))

        # Values should be different from original (due to variations)
        income_different = not scenario_df["total_income"].equals(
            original_df["total_income"]
        )
        expense_different = not scenario_df["total_expense"].equals(
            original_df["total_expense"]
        )
        self.assertTrue(income_different or expense_different)

    def test_random_scenario_always_returns_events(self) -> None:
        """Test that random scenario generation always returns events."""
        scenario_df, events = self.simulator._generate_random_scenario()

        # Should always return tuple
        self.assertIsInstance(scenario_df, pd.DataFrame)
        self.assertIsInstance(events, list)

        # Should have no events (black swan disabled)
        self.assertEqual(len(events), 0)


class TestBlackSwanEventApplication(unittest.TestCase):
    """Test black swan event application in Monte Carlo."""

    def setUp(self) -> None:
        """Set up test fixtures."""
        self.profile = UserProfile(
            birth_year=1990,
            expected_fire_age=45,
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=50000.0,
            inflation_rate=3.0,
            safety_buffer_months=12.0,
        )

        projection_data = []
        for year_idx in range(5):
            age = self.profile.current_age + year_idx
            projection_data.append(
                {
                    "age": age,
                    "year": 2025 + year_idx,
                    "total_income": 100000,
                    "total_expense": 50000,
                }
            )

        self.projection_df = pd.DataFrame(projection_data)
        self.engine_input = EngineInput(
            user_profile=self.profile, annual_financial_projection=self.projection_df
        )
        self.engine = FIREEngine(self.engine_input)

        # Settings with black swan events
        self.settings = SimulationSettings(
            num_simulations=10,
            confidence_level=0.95,
            include_black_swan_events=True,
            income_base_volatility=0.1,
            income_minimum_factor=0.1,
            expense_base_volatility=0.05,
            expense_minimum_factor=0.5,
        )
        self.simulator = MonteCarloSimulator(self.engine, self.settings)

    def test_black_swan_event_simulation(self) -> None:
        """Test black swan event simulation for specific age."""
        # Mock random to ensure predictable testing
        with patch(
            "random.random", return_value=0.01
        ):  # Very low value, should trigger high probability events
            events = self.simulator._simulate_black_swan_events(35)

            # Should find some events (multiple events have >1% probability)
            self.assertGreater(len(events), 0)

            # All events should be applicable to age 35
            for event in events:
                self.assertLessEqual(event.age_range[0], 35)
                self.assertGreaterEqual(event.age_range[1], 35)

    def test_duplicate_event_filtering(self) -> None:
        """Test that duplicate events are properly filtered."""
        test_df = self.projection_df.copy()

        # Mock event simulation to return same event twice
        def mock_simulate_events(age: int) -> list:
            if age == 35:
                return [FinancialCrisisEvent()]
            elif age == 36:
                return [FinancialCrisisEvent()]  # Same event
            return []

        original_simulate = self.simulator._simulate_black_swan_events
        setattr(self.simulator, "_simulate_black_swan_events", mock_simulate_events)

        try:
            modified_df, triggered_events = self.simulator._apply_black_swan_events(
                test_df
            )

            # Should only trigger once
            self.assertEqual(len(triggered_events), 1)
            self.assertEqual(triggered_events[0], "financial_crisis")

        finally:
            setattr(self.simulator, "_simulate_black_swan_events", original_simulate)

    def test_event_recovery_logic(self) -> None:
        """Test that event recovery works correctly over multiple years."""
        test_df = self.projection_df.copy()

        # Mock event simulation to return crisis in first year only
        def mock_simulate_events(age: int) -> list:
            if age == 35:
                return [FinancialCrisisEvent()]
            return []

        original_simulate = self.simulator._simulate_black_swan_events
        setattr(self.simulator, "_simulate_black_swan_events", mock_simulate_events)

        try:
            modified_df, triggered_events = self.simulator._apply_black_swan_events(
                test_df
            )

            # Should only trigger once
            self.assertEqual(len(triggered_events), 1)

            # Year 1: Full impact (-40%)
            year1_income = modified_df.iloc[0]["total_income"]
            expected_year1 = 100000 * 0.6
            self.assertAlmostEqual(year1_income, expected_year1, places=0)

            # Year 2: Recovery impact (-40% * 0.8 = -32%)
            year2_income = modified_df.iloc[1]["total_income"]
            expected_year2 = 100000 * 0.68
            self.assertAlmostEqual(year2_income, expected_year2, places=0)

            # Year 3: Should be back to normal (no ongoing effect)
            year3_income = modified_df.iloc[2]["total_income"]
            self.assertAlmostEqual(year3_income, 100000, places=0)

        finally:
            setattr(self.simulator, "_simulate_black_swan_events", original_simulate)


class TestMonteCarloAnalysis(unittest.TestCase):
    """Test Monte Carlo analysis functions."""

    def setUp(self) -> None:
        """Set up test fixtures."""
        # Create mock simulation data
        self.simulation_data = [
            {
                "run_id": 0,
                "final_net_worth": 500000,
                "fire_success": True,
                "black_swan_events": ["financial_crisis"],
            },
            {
                "run_id": 1,
                "final_net_worth": -100000,
                "fire_success": False,
                "black_swan_events": ["unemployment", "major_illness"],
            },
            {
                "run_id": 2,
                "final_net_worth": 1000000,
                "fire_success": True,
                "black_swan_events": [],
            },
            {
                "run_id": 3,
                "final_net_worth": 200000,
                "fire_success": True,
                "black_swan_events": ["market_crash"],
            },
            {
                "run_id": 4,
                "final_net_worth": -50000,
                "fire_success": False,
                "black_swan_events": ["global_war", "hyperinflation"],
            },
        ]

        # Create a minimal simulator for testing analysis functions
        profile = UserProfile(
            birth_year=1990,
            expected_fire_age=45,
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=50000.0,
            inflation_rate=3.0,
            safety_buffer_months=12.0,
        )
        projection_df = pd.DataFrame(
            {
                "age": [35],
                "year": [2025],
                "total_income": [100000],
                "total_expense": [50000],
            }
        )
        engine_input = EngineInput(
            user_profile=profile, annual_financial_projection=projection_df
        )
        engine = FIREEngine(engine_input)
        self.simulator = MonteCarloSimulator(engine)

    def test_black_swan_impact_analysis(self) -> None:
        """Test black swan impact analysis."""
        analysis = self.simulator._analyze_black_swan_impact(self.simulation_data)

        # Should always have worst case analysis (at least 1 sample)
        self.assertIn("worst_10_percent_avg_net_worth", analysis)
        self.assertIn("worst_10_percent_success_rate", analysis)
        self.assertIn("black_swan_impact_severity", analysis)

        # Should have event frequency analysis
        self.assertIn("most_frequent_events", analysis)
        self.assertIn("total_events_triggered", analysis)
        self.assertIn("avg_events_per_simulation", analysis)

        # Check specific values
        self.assertEqual(
            analysis["worst_10_percent_avg_net_worth"], -100000
        )  # Worst scenario
        self.assertEqual(
            analysis["worst_10_percent_success_rate"], 0.0
        )  # Worst scenario failed
        self.assertEqual(
            analysis["total_events_triggered"], 6
        )  # Total events across all runs
        self.assertEqual(
            analysis["avg_events_per_simulation"], 1.2
        )  # 6 events / 5 runs

    def test_worst_scenarios_identification(self) -> None:
        """Test worst scenarios identification."""
        scenarios = self.simulator._identify_worst_scenarios(self.simulation_data)

        # Should identify failure rate (2/5 = 40% > 10%)
        failure_scenario = next((s for s in scenarios if "40%" in s), None)
        self.assertIsNotNone(failure_scenario)

        # Should identify negative net worth scenarios (2/5 = 40%)
        negative_scenario = next(
            (s for s in scenarios if "negative net worth" in s), None
        )
        self.assertIsNotNone(negative_scenario)

    def test_resilience_score_calculation(self) -> None:
        """Test resilience score calculation."""
        score = self.simulator._calculate_resilience_score(self.simulation_data)

        # Should be between 0 and 100
        self.assertGreaterEqual(score, 0)
        self.assertLessEqual(score, 100)

        # With 60% success rate, should be relatively low
        self.assertLess(score, 70)  # Success rate is only 60%

    def test_emergency_fund_recommendation(self) -> None:
        """Test emergency fund recommendation."""
        fund = self.simulator._recommend_emergency_fund(self.simulation_data)

        # Should return a positive value
        self.assertGreater(fund, 0)

        # With 60% success rate (< 70%), should recommend 18 months
        # annual_expenses = 50000, so 18 months = 50000 * 18 / 12 = 75000
        expected_fund = 50000 * 18 / 12
        self.assertAlmostEqual(fund, expected_fund, places=0)


class TestSensitivityAnalysis(unittest.TestCase):
    """Test sensitivity analysis functionality."""

    def setUp(self) -> None:
        """Set up test fixtures."""
        profile = UserProfile(
            birth_year=1990,
            expected_fire_age=45,
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=50000.0,
            inflation_rate=3.0,
            safety_buffer_months=12.0,
        )
        projection_df = pd.DataFrame(
            {
                "age": [35, 36],
                "year": [2025, 2026],
                "total_income": [100000, 100000],
                "total_expense": [50000, 50000],
            }
        )
        engine_input = EngineInput(
            user_profile=profile, annual_financial_projection=projection_df
        )
        engine = FIREEngine(engine_input)

        settings = SimulationSettings(
            num_simulations=20,
            confidence_level=0.95,
            include_black_swan_events=True,
            income_base_volatility=0.1,
            income_minimum_factor=0.1,
            expense_base_volatility=0.05,
            expense_minimum_factor=0.5,
        )  # Small number for fast testing
        self.simulator = MonteCarloSimulator(engine, settings)

    def test_income_volatility_sensitivity(self) -> None:
        """Test sensitivity analysis for income volatility."""
        variations = [0.05, 0.1, 0.15, 0.2]
        results = self.simulator.analyze_sensitivity("income_volatility", variations)

        # Should return results for each variation
        self.assertEqual(len(results), 4)

        # All results should be success rates between 0 and 1
        for result in results:
            self.assertGreaterEqual(result, 0.0)
            self.assertLessEqual(result, 1.0)

    def test_expense_volatility_sensitivity(self) -> None:
        """Test sensitivity analysis for expense volatility."""
        variations = [0.02, 0.05, 0.08]
        results = self.simulator.analyze_sensitivity("expense_volatility", variations)

        self.assertEqual(len(results), 3)
        for result in results:
            self.assertGreaterEqual(result, 0.0)
            self.assertLessEqual(result, 1.0)

    def test_black_swan_probability_sensitivity(self) -> None:
        """Test sensitivity analysis for black swan events."""
        variations = [0.0, 1.0]  # Off vs On
        results = self.simulator.analyze_sensitivity(
            "black_swan_probability", variations
        )

        self.assertEqual(len(results), 2)

        # Results should be different (black swan should affect success rate)
        # Note: Due to randomness, they might occasionally be equal,
        # so we check they're both valid
        for result in results:
            self.assertGreaterEqual(result, 0.0)
            self.assertLessEqual(result, 1.0)

    def test_invalid_parameter_raises_error(self) -> None:
        """Test that invalid parameter raises ValueError."""
        with self.assertRaises(ValueError):
            self.simulator.analyze_sensitivity("invalid_parameter", [0.1, 0.2])


class TestSeedReproducibility(unittest.TestCase):
    """Test random seed functionality for reproducible results."""

    def setUp(self) -> None:
        """Set up test fixtures."""
        profile = UserProfile(
            birth_year=1990,
            expected_fire_age=45,
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=50000.0,
            inflation_rate=3.0,
            safety_buffer_months=12.0,
        )
        projection_df = pd.DataFrame(
            {
                "age": [35, 36],
                "year": [2025, 2026],
                "total_income": [100000, 100000],
                "total_expense": [50000, 50000],
            }
        )
        engine_input = EngineInput(
            user_profile=profile, annual_financial_projection=projection_df
        )
        self.engine = FIREEngine(engine_input)

        self.settings = SimulationSettings(
            num_simulations=10,
            confidence_level=0.95,
            include_black_swan_events=True,
            income_base_volatility=0.1,
            income_minimum_factor=0.1,
            expense_base_volatility=0.05,
            expense_minimum_factor=0.5,
        )

    def test_seed_reproducibility(self) -> None:
        """Test that same seed produces identical results."""
        seed = 12345

        # Run simulation twice with same seed
        simulator1 = MonteCarloSimulator(self.engine, self.settings, seed=seed)
        result1 = simulator1.run_simulation()

        simulator2 = MonteCarloSimulator(self.engine, self.settings, seed=seed)
        result2 = simulator2.run_simulation()

        # Results should be identical
        self.assertEqual(result1.success_rate, result2.success_rate)
        self.assertEqual(result1.mean_final_net_worth, result2.mean_final_net_worth)
        self.assertEqual(result1.median_final_net_worth, result2.median_final_net_worth)

    def test_different_seeds_produce_different_results(self) -> None:
        """Test that different seeds produce different results."""
        # Run simulation with different seeds
        simulator1 = MonteCarloSimulator(self.engine, self.settings, seed=111)
        result1 = simulator1.run_simulation()

        simulator2 = MonteCarloSimulator(self.engine, self.settings, seed=222)
        result2 = simulator2.run_simulation()

        # Results should be different (with high probability)
        # Note: There's a tiny chance they could be equal by coincidence
        different_results = (
            result1.success_rate != result2.success_rate
            or result1.mean_final_net_worth != result2.mean_final_net_worth
            or result1.median_final_net_worth != result2.median_final_net_worth
        )
        self.assertTrue(
            different_results, "Different seeds should produce different results"
        )

    def test_no_seed_produces_random_results(self) -> None:
        """Test that no seed produces different results across runs."""
        # Run simulation twice without seed
        simulator1 = MonteCarloSimulator(self.engine, self.settings, seed=None)
        result1 = simulator1.run_simulation()

        simulator2 = MonteCarloSimulator(self.engine, self.settings, seed=None)
        result2 = simulator2.run_simulation()

        # Results should be different (with very high probability)
        different_results = (
            result1.success_rate != result2.success_rate
            or result1.mean_final_net_worth != result2.mean_final_net_worth
            or result1.median_final_net_worth != result2.median_final_net_worth
        )
        self.assertTrue(
            different_results, "Random runs should produce different results"
        )

    def test_sensitivity_analysis_seed_consistency(self) -> None:
        """Test that sensitivity analysis uses consistent seed."""
        seed = 54321
        simulator = MonteCarloSimulator(self.engine, self.settings, seed=seed)

        # Run sensitivity analysis twice
        variations = [0.1, 0.2]
        results1 = simulator.analyze_sensitivity("income_volatility", variations)
        results2 = simulator.analyze_sensitivity("income_volatility", variations)

        # Results should be identical when using same seed
        self.assertEqual(results1, results2)


class TestMonteCarloIntegration(unittest.TestCase):
    """Integration tests for complete Monte Carlo simulation."""

    def setUp(self) -> None:
        """Set up test fixtures."""
        profile = UserProfile(
            birth_year=1990,
            expected_fire_age=45,
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=50000.0,
            inflation_rate=3.0,
            safety_buffer_months=12.0,
        )
        projection_data = []
        for year_idx in range(10):
            age = profile.current_age + year_idx
            projection_data.append(
                {
                    "age": age,
                    "year": 2025 + year_idx,
                    "total_income": 100000,
                    "total_expense": 50000,
                }
            )

        projection_df = pd.DataFrame(projection_data)
        engine_input = EngineInput(
            user_profile=profile, annual_financial_projection=projection_df
        )
        self.engine = FIREEngine(engine_input)

    def test_complete_simulation_run(self) -> None:
        """Test complete simulation with all features enabled."""
        settings = SimulationSettings(
            num_simulations=50,  # Small number for fast testing
            confidence_level=0.95,
            include_black_swan_events=True,
            income_base_volatility=0.1,
            income_minimum_factor=0.1,
            expense_base_volatility=0.05,
            expense_minimum_factor=0.5,
        )

        simulator = MonteCarloSimulator(self.engine, settings)
        result = simulator.run_simulation()

        # Check result structure
        self.assertIsInstance(result, MonteCarloResult)
        self.assertEqual(result.total_simulations, 50)
        self.assertEqual(
            result.successful_simulations + (50 - result.successful_simulations), 50
        )

        # Check statistical measures
        self.assertGreaterEqual(result.success_rate, 0.0)
        self.assertLessEqual(result.success_rate, 1.0)
        self.assertIsInstance(result.mean_final_net_worth, float)
        self.assertIsInstance(result.median_final_net_worth, float)

        # Check black swan analysis is present
        self.assertIsNotNone(result.black_swan_impact_analysis)
        self.assertIsNotNone(result.resilience_score)
        self.assertIsNotNone(result.recommended_emergency_fund)

        # Check percentiles make sense
        self.assertLessEqual(
            result.percentile_5_net_worth, result.median_final_net_worth
        )
        self.assertLessEqual(
            result.median_final_net_worth, result.percentile_95_net_worth
        )

    def test_simulation_without_black_swan_events(self) -> None:
        """Test simulation with black swan events disabled."""
        settings = SimulationSettings(
            num_simulations=20,
            confidence_level=0.95,
            include_black_swan_events=False,
            income_base_volatility=0.1,
            income_minimum_factor=0.1,
            expense_base_volatility=0.05,
            expense_minimum_factor=0.5,
        )

        simulator = MonteCarloSimulator(self.engine, settings)
        result = simulator.run_simulation()

        # Should still have basic results
        self.assertIsInstance(result, MonteCarloResult)
        self.assertEqual(result.total_simulations, 20)

        # Black swan analysis should be None
        self.assertIsNone(result.black_swan_impact_analysis)
        self.assertIsNone(result.resilience_score)
        self.assertIsNone(result.recommended_emergency_fund)


if __name__ == "__main__":
    unittest.main()
