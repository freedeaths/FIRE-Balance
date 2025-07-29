#!/usr/bin/env python3
"""
FIRE Planner CLI

Calculate FIRE (Financial Independence, Retire Early) projections with Monte
Carlo analysis.

Usage:
    python fire_planner.py [path_to_json_file]

If no file is provided, it will use example_fire_plan_predefined.json
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


def print_header(title: str, width: int = 80) -> None:
    """Print a formatted header."""
    print("\n" + "=" * width)
    print(f"{title:^{width}}")
    print("=" * width)


def print_section(title: str, width: int = 60) -> None:
    """Print a formatted section header."""
    print(f"\n{'-' * width}")
    print(f"{title}")
    print(f"{'-' * width}")


def progress_callback(current: int, total: int) -> None:
    """Progress callback for Monte Carlo simulation."""
    if current % max(1, total // 20) == 0:  # Show progress every 5%
        percentage = (current / total) * 100
        print(f"    Monte Carlo Progress: {current}/{total} ({percentage:.1f}%)")


def format_currency(amount: float) -> str:
    """Format currency for display."""
    return f"${amount:,.0f}"


def show_plan_summary(planner: Any, json_file: Path) -> bool:
    """Show loaded FIRE plan summary."""
    print_header("FIRE PLAN SUMMARY")

    print(f"📁 Loaded plan from: {json_file}")

    try:
        planner.import_config_from_file(json_file)
        print("✅ Successfully loaded configuration")
    except Exception as e:
        print(f"❌ Error loading configuration: {e}")
        return False

    profile = planner.data.user_profile
    if profile:
        print_section("User Profile")
        print(
            f"Current Age: {profile.current_age} → "
            f"FIRE Age: {profile.expected_fire_age} (Life: {profile.life_expectancy})"
        )
        print(f"Current Net Worth: {format_currency(profile.current_net_worth)}")
        print(
            f"Inflation Rate: {profile.inflation_rate}% | "
            f"Safety Buffer: {profile.safety_buffer_months} months"
        )

    print_section("Income & Expense Summary")
    print(f"Income Items: {len(planner.data.income_items)}")
    print(f"Expense Items: {len(planner.data.expense_items)}")
    if planner.data.overrides:
        print(f"Overrides Applied: {len(planner.data.overrides)}")

    return True


def run_calculations(planner: Any) -> bool:
    """Run FIRE calculations and generate projections."""
    print("🔄 Setting up financial projections...")

    try:
        # Generate projections (equivalent to Stage 2)
        df = planner.proceed_to_stage2()
        print(f"✅ Generated projection table with {len(df)} years of data")
    except Exception as e:
        print(f"❌ Error generating projection: {e}")
        return False

    return True


def run_analysis(planner: Any) -> bool:
    """Run FIRE analysis and show results."""
    print_header("FIRE ANALYSIS RESULTS")

    print("⚙️ Running FIRE calculations...")

    # Show simulation settings
    settings = planner.get_simulation_settings()
    print_section("Monte Carlo Simulation Settings")
    print(f"Number of Simulations: {settings.num_simulations}")
    print(f"Confidence Level: {settings.confidence_level}")
    print(f"Include Black Swan Events: {settings.include_black_swan_events}")
    print(f"Income Volatility: {settings.income_base_volatility}")
    print(f"Expense Volatility: {settings.expense_base_volatility}")

    try:
        results = planner.proceed_to_stage3(progress_callback)
        print("\n✅ Calculations completed successfully")
    except Exception as e:
        print(f"❌ Error during calculations: {e}")
        return False

    print_section("FIRE Calculation Results")
    fire_result = results.fire_calculation

    print(f"🎯 FIRE Achievable: {'YES' if fire_result.is_fire_achievable else 'NO'}")
    print(f"💰 Net Worth at FIRE Age: {format_currency(fire_result.fire_net_worth)}")
    print(
        f"📉 Minimum Net Worth (Post-FIRE): "
        f"{format_currency(fire_result.min_net_worth_after_fire)}"
    )
    print(f"💵 Final Net Worth: {format_currency(fire_result.final_net_worth)}")
    print(f"🛡️ Safety Buffer (months): {fire_result.safety_buffer_months}")
    print(f"📊 Min Safety Buffer Ratio: {fire_result.min_safety_buffer_ratio:.2f}")

    print_section("Traditional FIRE Metrics")
    print(
        f"4% Rule FIRE Number: {format_currency(fire_result.traditional_fire_number)}"
    )
    print(
        f"4% Rule Achieved: {'YES' if fire_result.traditional_fire_achieved else 'NO'}"
    )

    print_section("Monte Carlo Risk Analysis")
    if results.monte_carlo_success_rate is not None:
        success_rate = results.monte_carlo_success_rate
        print(f"🎲 Success Rate: {success_rate:.2%}")

        if success_rate >= 0.9:
            risk_level = "🟢 LOW RISK"
        elif success_rate >= 0.7:
            risk_level = "🟡 MEDIUM RISK"
        else:
            risk_level = "🔴 HIGH RISK"

        print(f"📈 Risk Assessment: {risk_level}")
    else:
        print("⚠️ Monte Carlo simulation not available")

    print_section("Recommendations")
    if results.recommendations:
        for i, rec in enumerate(results.recommendations, 1):
            achievable_status = "✅" if rec.is_achievable else "❌"
            print(f"{i}. {achievable_status} {rec.title}")
            print(f"   {rec.description}")
            if (
                hasattr(rec, "monte_carlo_success_rate")
                and rec.monte_carlo_success_rate
            ):
                print(f"   Success Rate: {rec.monte_carlo_success_rate:.1%}")
    else:
        print("No specific recommendations available")

    # Additional analysis
    print_section("Key Insights")
    current_age = planner.data.user_profile.current_age
    fire_age = planner.data.user_profile.expected_fire_age
    years_to_fire = fire_age - current_age
    retirement_years = fire_result.retirement_years

    print(f"⏰ Years until FIRE: {years_to_fire}")
    print(f"🏖️ Years in retirement: {retirement_years}")

    if fire_result.is_fire_achievable:
        annual_savings_needed = (
            fire_result.fire_net_worth - planner.data.user_profile.current_net_worth
        ) / years_to_fire
        print(
            f"💸 Average annual savings needed: {format_currency(annual_savings_needed)}"
        )

    print("\n✅ Stage 3 Complete: Analysis finished")
    return True


def main() -> None:
    """Main CLI function."""
    # Add the parent directory to path so we can import our modules
    sys.path.append(str(Path(__file__).parent.parent))

    from core.data_models import SimulationSettings
    from core.planner import FIREPlanner

    parser = argparse.ArgumentParser(
        description="FIRE Planner - Calculate Financial Independence projections",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Example usage:
    python fire_planner.py
    python fire_planner.py /path/to/my_plan.json
    python fire_planner.py --quick-mc --output results.json
        """,
    )

    parser.add_argument(
        "json_file",
        nargs="?",
        help="Path to FIRE plan JSON file (default: example_fire_plan_predefined.json)",
    )

    parser.add_argument(
        "--quick-mc",
        action="store_true",
        help="Run quick Monte Carlo analysis with fewer simulations",
    )

    parser.add_argument(
        "--output",
        "-o",
        help="Save results to JSON file",
    )

    args = parser.parse_args()

    # Determine JSON file path
    if args.json_file:
        json_file = Path(args.json_file)
    else:
        json_file = Path(__file__).parent.parent / "example_fire_plan_predefined.json"

    if not json_file.exists():
        print(f"❌ Error: File not found: {json_file}")
        sys.exit(1)

    print_header("🔥 FIRE PLANNER 🔥")
    print(f"Calculating FIRE projections from: {json_file.name}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Initialize planner
    planner = FIREPlanner(language="en")

    if args.quick_mc:
        # Set quick simulation settings
        quick_settings = SimulationSettings(
            num_simulations=200, confidence_level=0.95, include_black_swan_events=True
        )
        planner.set_simulation_settings(quick_settings)

    try:
        # Load plan and show summary
        if not show_plan_summary(planner, json_file):
            sys.exit(1)

        # Run calculations
        if not run_calculations(planner):
            sys.exit(1)

        # Run analysis and show results
        if not run_analysis(planner):
            sys.exit(1)

        # Save results if requested
        if args.output:
            output_path = Path(args.output)
            planner.export_config_to_file(
                output_path, f"FIRE Analysis Results - {datetime.now().isoformat()}"
            )
            print(f"\n💾 Results saved to: {output_path}")

        print_header("✅ ANALYSIS COMPLETE")
        print("FIRE calculations completed successfully!")

    except KeyboardInterrupt:
        print("\n\n⏹️ Analysis interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
