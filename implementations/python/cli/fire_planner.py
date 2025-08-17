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
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from core.data_models import SimulationSettings
from core.planner import CustomJSONEncoder, FIREPlanner


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
        # Generate projections using new simplified API
        df = planner.generate_projection_table()
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
        results = planner.calculate_fire_results(progress_callback=progress_callback)
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
        for i, rec_dict in enumerate(results.recommendations, 1):
            achievable_status = "✅" if rec_dict.get("is_achievable", True) else "❌"
            rec_type = rec_dict["type"]
            params = rec_dict["params"]

            # Create simple title and description based on type
            if rec_type == "early_retirement":
                title = f"Early Retirement at Age {params['age']}"
                description = (
                    f"You can retire {params['years']} year(s) earlier "
                    f"at age {params['age']}."
                )
            elif rec_type == "delayed_retirement":
                title = f"Delayed Retirement to Age {params['age']}"
                description = (
                    f"Delay retirement by {params['years']} year(s) "
                    f"to age {params['age']}."
                )
            elif rec_type == "delayed_retirement_not_feasible":
                title = "Delayed Retirement Not Feasible"
                description = (
                    f"Even delaying to legal retirement age "
                    f"({params['age']}) would not achieve FIRE."
                )
            elif rec_type == "increase_income":
                title = f"Increase Income by {params['percentage']:.1f}%"
                description = f"Increase income by {params['percentage']:.1f}%."
            elif rec_type == "reduce_expenses":
                title = f"Reduce Expenses by {params['percentage']:.1f}%"
                description = f"Reduce expenses by {params['percentage']:.1f}%."
            else:
                title = f"Unknown recommendation: {rec_type}"
                description = f"Parameters: {params}"

            print(f"{i}. {achievable_status} {title}")
            print(f"   {description}")

            monte_carlo_rate = rec_dict.get("monte_carlo_success_rate")
            if monte_carlo_rate is not None:
                print(f"   Success Rate: {monte_carlo_rate:.1%}")
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


def save_results_to_file(planner: Any, output_path: Path) -> None:
    """Save complete FIRE calculation results to JSON file."""

    results = planner.get_results()
    if results is None:
        print("❌ No calculation results available to save")
        return

    # Get both configuration and results
    config_data = planner.export_config(f"FIRE Results - {datetime.now().isoformat()}")

    # Generate formatted analysis report
    analysis_report = generate_analysis_report(planner, results)

    # Create comprehensive output with results
    output_data = {
        "metadata": {
            "export_timestamp": datetime.now().isoformat(),
            "export_type": "fire_analysis_results",
            "description": (
                "Complete FIRE analysis results including calculations, "
                "projections, and recommendations"
            ),
        },
        "input_configuration": config_data,
        "results": {
            "fire_calculation": {
                "is_fire_achievable": results.fire_calculation.is_fire_achievable,
                "fire_net_worth": results.fire_calculation.fire_net_worth,
                "min_net_worth_after_fire": (
                    results.fire_calculation.min_net_worth_after_fire
                ),
                "final_net_worth": results.fire_calculation.final_net_worth,
                "safety_buffer_months": (results.fire_calculation.safety_buffer_months),
                "min_safety_buffer_ratio": (
                    results.fire_calculation.min_safety_buffer_ratio
                ),
                "retirement_years": results.fire_calculation.retirement_years,
                "total_years_simulated": (
                    results.fire_calculation.total_years_simulated
                ),
                "traditional_fire_number": (
                    results.fire_calculation.traditional_fire_number
                ),
                "traditional_fire_achieved": (
                    results.fire_calculation.traditional_fire_achieved
                ),
                "fire_success_probability": (
                    results.fire_calculation.fire_success_probability
                ),
                "yearly_results": [
                    {
                        "age": state.age,
                        "total_income": float(state.total_income),
                        "total_expense": float(state.total_expense),
                        "investment_return": float(state.investment_return),
                        "net_cash_flow": float(state.net_cash_flow),
                        "portfolio_value": float(state.portfolio_value),
                        "net_worth": float(state.net_worth),
                        "is_sustainable": state.is_sustainable,
                    }
                    for state in results.fire_calculation.yearly_results
                ],
            },
            "monte_carlo_success_rate": results.monte_carlo_success_rate,
            "recommendations": results.recommendations,
            "calculation_timestamp": results.calculation_timestamp.isoformat(),
        },
        "analysis_report": analysis_report,
    }

    # Save to file
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False, cls=CustomJSONEncoder)


def generate_analysis_report(planner: Any, results: Any) -> dict:
    """Generate a structured analysis report similar to CLI output."""
    fire_result = results.fire_calculation
    profile = planner.data.user_profile

    # User profile summary
    user_summary = {
        "current_age": profile.current_age,
        "fire_age": profile.expected_fire_age,
        "life_expectancy": profile.life_expectancy,
        "current_net_worth": format_currency(profile.current_net_worth),
        "inflation_rate": f"{profile.inflation_rate}%",
        "safety_buffer_months": profile.safety_buffer_months,
    }

    # FIRE calculation summary
    fire_summary = {
        "is_achievable": fire_result.is_fire_achievable,
        "achievable_text": "✅ YES" if fire_result.is_fire_achievable else "❌ NO",
        "net_worth_at_fire": format_currency(fire_result.fire_net_worth),
        "min_net_worth_post_fire": format_currency(
            fire_result.min_net_worth_after_fire
        ),
        "final_net_worth": format_currency(fire_result.final_net_worth),
        "safety_buffer_ratio": f"{fire_result.min_safety_buffer_ratio:.2f}",
    }

    # Traditional FIRE metrics
    traditional_metrics = {
        "four_percent_rule_number": format_currency(
            fire_result.traditional_fire_number
        ),
        "four_percent_rule_achieved": fire_result.traditional_fire_achieved,
        "four_percent_rule_text": (
            "✅ YES" if fire_result.traditional_fire_achieved else "❌ NO"
        ),
    }

    # Monte Carlo analysis
    mc_success_rate = results.monte_carlo_success_rate or 0.0
    risk_assessment = (
        "🔴 HIGH RISK"
        if mc_success_rate < 0.7
        else "🟡 MODERATE RISK" if mc_success_rate < 0.9 else "🟢 LOW RISK"
    )

    monte_carlo_summary = {
        "success_rate": f"{mc_success_rate:.2%}",
        "risk_assessment": risk_assessment,
    }

    # Recommendations summary
    recommendations_formatted = []
    if results.recommendations:
        for i, rec_dict in enumerate(results.recommendations, 1):
            rec_type = rec_dict.get("type", "unknown")
            params = rec_dict.get("params", {})

            # Format recommendation based on type
            if rec_type == "early_retirement":
                title = f"Early Retirement at Age {params['age']}"
                description = (
                    f"You can retire {params['years']} year(s) earlier "
                    f"at age {params['age']}."
                )
            elif rec_type == "delayed_retirement":
                title = f"Delayed Retirement to Age {params['age']}"
                description = (
                    f"Delay retirement by {params['years']} year(s) "
                    f"to age {params['age']}."
                )
            elif rec_type == "delayed_retirement_not_feasible":
                title = "Delayed Retirement Not Feasible"
                description = (
                    f"Even delaying to legal retirement age "
                    f"({params['age']}) would not achieve FIRE."
                )
            elif rec_type == "increase_income":
                title = f"Increase Income by {params['percentage']:.1f}%"
                description = f"Increase income by {params['percentage']:.1f}%."
            elif rec_type == "reduce_expenses":
                title = f"Reduce Expenses by {params['percentage']:.1f}%"
                description = f"Reduce expenses by {params['percentage']:.1f}%."
            else:
                title = f"Recommendation {i}"
                description = "Details not available"

            recommendations_formatted.append(
                {
                    "number": i,
                    "type": rec_type,
                    "title": title,
                    "description": description,
                    "is_achievable": rec_dict.get("is_achievable", False),
                    "status": "✅" if rec_dict.get("is_achievable", False) else "❌",
                    "params": params,
                }
            )

    # Key insights
    current_age = profile.current_age
    fire_age = profile.expected_fire_age
    years_to_fire = fire_age - current_age
    retirement_years = fire_result.retirement_years

    key_insights = {
        "years_until_fire": years_to_fire,
        "years_in_retirement": retirement_years,
    }

    # Additional calculations if plan is achievable
    if fire_result.is_fire_achievable and years_to_fire > 0:
        annual_savings_needed = (
            fire_result.fire_net_worth - profile.current_net_worth
        ) / years_to_fire
        key_insights["avg_annual_savings_needed"] = format_currency(
            annual_savings_needed
        )

    return {
        "user_profile": user_summary,
        "fire_calculation": fire_summary,
        "traditional_fire_metrics": traditional_metrics,
        "monte_carlo_analysis": monte_carlo_summary,
        "recommendations": recommendations_formatted,
        "key_insights": key_insights,
        "generation_timestamp": datetime.now().isoformat(),
    }


def main() -> None:
    """Main CLI function."""
    # Add the parent directory to path so we can import our modules
    sys.path.append(str(Path(__file__).parent.parent))

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
            save_results_to_file(planner, output_path)
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
