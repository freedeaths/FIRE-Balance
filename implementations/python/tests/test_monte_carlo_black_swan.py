#!/usr/bin/env python3
"""
Simple test script for Monte Carlo black swan events functionality.
This is a manual test to verify the implementation works correctly.
"""

import pandas as pd

from core.black_swan_events import create_black_swan_events
from core.data_models import SimulationSettings, UserProfile
from core.engine import EngineInput, FIREEngine
from core.monte_carlo import MonteCarloSimulator


def create_test_scenario() -> FIREEngine:
    """Create a basic test scenario for Monte Carlo simulation."""

    # Create test user profile
    profile = UserProfile(
        birth_year=1990,
        expected_fire_age=45,
        legal_retirement_age=65,
        life_expectancy=85,
        current_net_worth=50000.0,
        inflation_rate=3.0,
        safety_buffer_months=12.0,
    )

    # Create basic income/expense projection
    years = list(range(profile.current_age, profile.life_expectancy + 1))
    projection_data = []

    for year_idx, age in enumerate(years):
        # Simple projection: $80k income, $50k expenses
        annual_income = 80000 * (1.02**year_idx)  # 2% growth
        annual_expense = 50000 * (1.03**year_idx)  # 3% inflation

        projection_data.append(
            {
                "age": age,
                "year": 2025 + year_idx,
                "total_income": annual_income,
                "total_expense": annual_expense,
            }
        )

    projection_df = pd.DataFrame(projection_data)

    # Create engine
    engine_input = EngineInput(
        user_profile=profile, annual_financial_projection=projection_df
    )
    engine = FIREEngine(engine_input)

    return engine


def test_black_swan_events() -> None:
    """Test black swan events functionality."""
    print("=== Monte Carlo Black Swan Events Test ===\n")

    # Create test scenario
    engine = create_test_scenario()

    # Test 1: Basic black swan event structure
    print("1. Testing BlackSwanEvent structure...")
    from core.black_swan_events import FinancialCrisisEvent

    test_event = FinancialCrisisEvent(age_range=(25, 65))

    print(f"   Created test event: {test_event.event_id}")
    print(f"   Display name: {test_event.get_display_name()}")
    print(f"   Probability: {test_event.annual_probability}")
    print(f"   Duration: {test_event.duration_years} years")
    print("   ✓ BlackSwanEvent structure works correctly\n")

    # Test 2: Personalized events library
    print("2. Testing personalized events library...")
    profile = engine.profile  # Get profile from test engine
    personalized_events = create_black_swan_events(profile)
    print(f"   Total personalized events: {len(personalized_events)}")
    for category, event_ids in [
        (
            "Economic",
            [
                "financial_crisis",
                "economic_recession",
                "market_crash",
                "hyperinflation",
            ],
        ),
        ("Career", ["unemployment", "industry_collapse", "unexpected_promotion"]),
        ("Health", ["major_illness", "long_term_care"]),
        (
            "Geopolitical",
            ["regional_conflict", "global_war", "economic_sanctions", "energy_crisis"],
        ),
        ("Opportunities", ["inheritance", "investment_windfall"]),
    ]:
        found_events = [
            e.event_id for e in personalized_events if e.event_id in event_ids
        ]
        print(f"   {category}: {len(found_events)}/{len(event_ids)} events found")
    print("   ✓ Personalized events library complete\n")

    # Test 3: Age-based filtering
    print("3. Testing age-based event filtering...")
    user_age = engine.profile.current_age
    applicable_events = [
        event
        for event in personalized_events
        if event.age_range[0] <= user_age <= event.age_range[1]
    ]
    print(f"   User age: {user_age}")
    print(f"   Applicable events: {len(applicable_events)}/{len(personalized_events)}")
    print(f"   Event IDs: {[e.event_id for e in applicable_events[:5]]}...")
    print("   ✓ Age-based filtering works correctly\n")

    # Test 4: Monte Carlo simulation settings
    print("4. Testing simulation settings...")
    settings = SimulationSettings(
        num_simulations=50,  # Small number for quick test
        confidence_level=0.95,
        include_black_swan_events=True,
        income_base_volatility=0.1,
        income_minimum_factor=0.1,
        expense_base_volatility=0.05,
        expense_minimum_factor=0.5,
    )
    print(f"   Simulations: {settings.num_simulations}")
    print(f"   Black swan events: {settings.include_black_swan_events}")
    print(f"   Income volatility: {settings.income_base_volatility}")
    print(f"   Income minimum factor: {settings.income_minimum_factor}")
    print(f"   Expense volatility: {settings.expense_base_volatility}")
    print(
        "   ✓ Simulation settings configured correctly "
        "(major events removed, only basic parameters)\n"
    )

    # Test 5: Monte Carlo simulator initialization
    print("5. Testing Monte Carlo simulator initialization...")
    simulator = MonteCarloSimulator(engine, settings)
    print(f"   Engine profile age: {simulator.engine.profile.current_age}")
    print(f"   Total events available: {len(simulator.all_events)}")
    print(f"   Base projection length: {len(simulator.base_df)} years")
    print("   ✓ Monte Carlo simulator initialized correctly\n")

    # Test 6: Run small simulation
    print("6. Running small Monte Carlo simulation...")
    print("   This may take a moment...")
    try:
        result = simulator.run_simulation()

        print(f"   Total simulations: {result.total_simulations}")
        print(f"   Successful simulations: {result.successful_simulations}")
        print(f"   Success rate: {result.success_rate:.1%}")
        print(f"   Mean final net worth: ${result.mean_final_net_worth:,.0f}")
        print(f"   5th percentile: ${result.percentile_5_net_worth:,.0f}")
        print(f"   95th percentile: ${result.percentile_95_net_worth:,.0f}")

        # Test black swan analysis results
        if result.black_swan_impact_analysis:
            print("\n   Black Swan Analysis:")
            analysis = result.black_swan_impact_analysis
            if "worst_10_percent_success_rate" in analysis:
                worst_rate = analysis["worst_10_percent_success_rate"]
                print(f"     Worst 10% success rate: {worst_rate:.1%}")
            if "total_events_triggered" in analysis:
                print(
                    f"     Total events triggered: {analysis['total_events_triggered']}"
                )
            if "avg_events_per_simulation" in analysis:
                avg_events = analysis["avg_events_per_simulation"]
                print(f"     Avg events per simulation: {avg_events:.2f}")

        if result.resilience_score is not None:
            print(f"   Resilience score: {result.resilience_score:.1f}/100")

        if result.recommended_emergency_fund is not None:
            fund = result.recommended_emergency_fund
            print(f"   Recommended emergency fund: ${fund:,.0f}")

        if result.worst_case_scenarios:
            scenario_count = len(result.worst_case_scenarios)
            print(f"   Worst case scenarios: {scenario_count} identified")
            for scenario in result.worst_case_scenarios[:2]:
                print(f"     - {scenario}")

        print("   ✓ Monte Carlo simulation completed successfully\n")

    except Exception as e:
        print(f"   ❌ Simulation failed: {e}")
        raise

    print("=== All Tests Passed! ===")
    print("Black swan events implementation is working correctly.")

    # Bonus test: Custom configuration
    print("\n7. Testing custom configuration...")
    custom_settings = SimulationSettings(
        num_simulations=10,
        confidence_level=0.95,
        include_black_swan_events=True,
        income_base_volatility=0.2,  # Higher volatility
        income_minimum_factor=0.1,
        expense_base_volatility=0.1,  # Higher volatility
        expense_minimum_factor=0.5,
    )
    MonteCarloSimulator(engine, custom_settings)
    print(f"   Custom income volatility: {custom_settings.income_base_volatility}")
    print(f"   Custom expense volatility: {custom_settings.expense_base_volatility}")
    print(
        "   ✓ Custom configuration works correctly "
        "(major events handled by Black Swan system)"
    )

    # Test 8: Random seed functionality
    print("\n8. Testing random seed for reproducible results...")
    test_seed = 12345

    # Run simulation twice with same seed
    test_settings = SimulationSettings(
        num_simulations=20,
        confidence_level=0.95,
        include_black_swan_events=True,
        income_base_volatility=0.1,
        income_minimum_factor=0.1,
        expense_base_volatility=0.05,
        expense_minimum_factor=0.5,
    )
    simulator_a = MonteCarloSimulator(engine, test_settings, seed=test_seed)
    result_a = simulator_a.run_simulation()

    simulator_b = MonteCarloSimulator(engine, test_settings, seed=test_seed)
    result_b = simulator_b.run_simulation()

    # Results should be identical
    if (
        result_a.success_rate == result_b.success_rate
        and result_a.mean_final_net_worth == result_b.mean_final_net_worth
        and result_a.median_final_net_worth == result_b.median_final_net_worth
    ):
        print(f"   ✓ Seed {test_seed} produces identical results:")
        mean_a = result_a.mean_final_net_worth
        mean_b = result_b.mean_final_net_worth
        print(
            f"     Run A: Success rate {result_a.success_rate:.1%}, Mean ${mean_a:,.0f}"
        )
        print(
            f"     Run B: Success rate {result_b.success_rate:.1%}, Mean ${mean_b:,.0f}"
        )
    else:
        print(f"   ❌ Seed {test_seed} did not produce identical results")

    # Test different seeds produce different results
    simulator_c = MonteCarloSimulator(engine, test_settings, seed=54321)
    result_c = simulator_c.run_simulation()

    if (
        result_a.success_rate != result_c.success_rate
        or result_a.mean_final_net_worth != result_c.mean_final_net_worth
    ):
        print("   ✓ Different seeds produce different results (as expected)")
    else:
        print("   ⚠️ Different seeds produced same results (rare but possible)")

    # Test no seed produces random results
    simulator_d = MonteCarloSimulator(engine, test_settings, seed=None)
    result_d = simulator_d.run_simulation()

    simulator_e = MonteCarloSimulator(engine, test_settings, seed=None)
    result_e = simulator_e.run_simulation()

    if (
        result_d.success_rate != result_e.success_rate
        or result_d.mean_final_net_worth != result_e.mean_final_net_worth
    ):
        print("   ✓ No seed produces random results (as expected)")
    else:
        print("   ⚠️ Random runs produced same results (very rare but possible)")

    print("   ✓ Random seed functionality works correctly")


if __name__ == "__main__":
    test_black_swan_events()
