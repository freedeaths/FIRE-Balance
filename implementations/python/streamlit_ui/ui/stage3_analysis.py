# UI components for Stage 3: Detailed Analysis.

from typing import Any, Callable, Dict, cast

import altair as alt
import pandas as pd
import streamlit as st

from ..utils.recommendation_renderer import render_recommendation


def format_currency(amount: float) -> str:
    """Format currency without currency symbol for international use."""
    return f"{amount:,.0f}"


def render_stage3(t: Callable[..., str]) -> None:
    """Renders the UI for Stage 3: FIRE Analysis & Simulation."""
    st.header(t("stage3_title"))
    st.write(t("stage3_description"))

    # Check if we have required data
    if (
        "final_results" not in st.session_state
        or st.session_state.final_results is None
    ):
        st.warning(t("complete_stage2_first"))
        return

    if "planner" not in st.session_state or st.session_state.planner is None:
        st.warning(t("cannot_get_calculator"))
        return

    planner = st.session_state.planner
    results = st.session_state.final_results

    # Check if language has changed, clear recommendations cache if so
    current_language = st.session_state.get("language", "en")
    if "last_recommendations_language" not in st.session_state:
        st.session_state.last_recommendations_language = current_language
    elif st.session_state.last_recommendations_language != current_language:
        # Language changed, clear cached results to force regeneration
        if hasattr(results, "recommendations"):
            results.recommendations = []  # Clear old recommendations
        st.session_state.last_recommendations_language = current_language

    # Use the user profile directly for analysis
    sim_profile = st.session_state.user_profile

    # Results are already available from the main app calculation
    # No need to run analysis again - just display the results

    # --- Display FIRE Feasibility Results ---
    st.subheader(t("fire_feasibility_analysis"))

    # First, prepare chart data for statistical analysis
    chart_df = pd.DataFrame()
    try:
        # Get actual projection data if available
        yearly_results = None
        if (
            hasattr(results, "fire_calculation")
            and hasattr(results.fire_calculation, "yearly_results")
            and results.fire_calculation.yearly_results
        ):
            yearly_results = results.fire_calculation.yearly_results
        elif hasattr(results, "yearly_results") and results.yearly_results:
            yearly_results = results.yearly_results

        if yearly_results:
            # Convert yearly results to dataframe
            chart_data = []
            for yearly in yearly_results:
                chart_data.append(
                    {
                        "Age": yearly.age,
                        "Year": yearly.age - sim_profile.current_age + 2024,
                        "Net Worth": yearly.net_worth,
                        "Total Income": yearly.total_income,
                        "Total Expense": yearly.total_expense,
                        "Investment Return": float(yearly.investment_return),
                        "Net Cash Flow": yearly.net_cash_flow,
                    }
                )
            chart_df = pd.DataFrame(chart_data)
    except Exception:
        # If chart data preparation fails, continue with empty DataFrame
        pass

    if results:
        # Try to extract key metrics from results
        try:
            if hasattr(results, "fire_calculation") and hasattr(
                results.fire_calculation, "is_fire_achievable"
            ):
                # PlannerResults object from calculate_fire_results()
                fire_feasible = results.fire_calculation.is_fire_achievable
                fire_age = sim_profile.expected_fire_age
                portfolio_at_fire = results.fire_calculation.fire_net_worth
            elif hasattr(results, "is_fire_achievable"):
                # Direct FIRECalculationResult object from engine.calculate()
                fire_feasible = results.is_fire_achievable
                fire_age = sim_profile.expected_fire_age  # Use profile age as target
                portfolio_at_fire = results.fire_net_worth
            else:
                # Fallback calculations
                fire_feasible = True  # Placeholder
                fire_age = sim_profile.expected_fire_age
                portfolio_at_fire = sim_profile.current_net_worth

            # Display basic metrics in two rows
            # Row 1: Key FIRE metrics
            cols1 = st.columns(3)
            cols1[0].metric(
                label=t("target_fire_age"), value=t("fire_age_years", age=fire_age)
            )
            cols1[1].metric(
                label=t("fire_net_worth"), value=format_currency(portfolio_at_fire)
            )

            # Combine feasibility status with Monte Carlo success rate if available
            feasibility_icon = "✅" if fire_feasible else "❌"

            # Check if Monte Carlo success rate is available in results
            monte_carlo_rate = None
            if (
                hasattr(results, "monte_carlo_success_rate")
                and results.monte_carlo_success_rate is not None
            ):
                monte_carlo_rate = results.monte_carlo_success_rate
            elif hasattr(results, "fire_calculation") and hasattr(
                results.fire_calculation, "monte_carlo_success_rate"
            ):
                monte_carlo_rate = results.fire_calculation.monte_carlo_success_rate

            # Format the display value
            if monte_carlo_rate is not None:
                feasibility_display = f"{feasibility_icon} {monte_carlo_rate:.1%}"
            else:
                feasibility_display = (
                    f"{feasibility_icon} "
                    f"{t('feasible') if fire_feasible else t('needs_adjustment')}"
                )

            cols1[2].metric(label=t("plan_feasibility"), value=feasibility_display)

            # Row 2: Statistical metrics from chart data
            if not chart_df.empty:
                min_net_worth = chart_df["Net Worth"].min()
                final_net_worth = chart_df["Net Worth"].iloc[-1]

                # Calculate additional metrics
                chart_df["Annual Net Income"] = (
                    chart_df["Net Cash Flow"] + chart_df["Investment Return"]
                )
                min_annual_income = chart_df["Annual Net Income"].min()
                negative_net_worth = chart_df[chart_df["Net Worth"] < 0]
                debt_years = len(negative_net_worth)

                cols2 = st.columns(3)
                cols2[0].metric(
                    label=t("minimum_net_worth"),
                    value=format_currency(min_net_worth),
                    help=t("minimum_net_worth_help"),
                )
                cols2[1].metric(
                    label=t("final_net_worth"),
                    value=format_currency(final_net_worth),
                    help=t("final_net_worth_help"),
                )
                if debt_years > 0:
                    cols2[2].metric(
                        t("negative_net_worth_years"),
                        t("negative_net_worth_years_value", years=debt_years),
                        help=t("negative_net_worth_years_help"),
                    )
                else:
                    cols2[2].metric(
                        t("minimum_annual_income"),
                        format_currency(min_annual_income),
                        help=t("minimum_annual_income_help"),
                    )

            if fire_feasible:
                st.success(t("congratulations_feasible"))
            else:
                st.warning(t("plan_needs_adjustment"))

        except Exception as e:
            st.error(t("results_display_error", error=str(e)))
    else:
        st.info(t("calculating_fire_feasibility"))

    # --- Net Worth Projection Chart ---
    st.subheader(t("net_worth_trajectory_analysis"))
    st.info(t("trajectory_description"))

    # Use the chart_df already prepared in FIRE Feasibility Analysis section
    try:

        if not chart_df.empty:
            # Safety buffer curve - calculate inflation-adjusted safety buffer
            # for each year
            # Safety buffer = safety_buffer_months * annual expenses
            # (inflation-adjusted)
            safety_buffer_data = []
            base_year = 2024  # Current year as baseline

            for _, row in chart_df.iterrows():
                age = row["Age"]
                year = row["Year"]
                annual_expense = row["Total Expense"]

                # Calculate inflation adjustment from base year
                years_from_base = year - base_year
                inflation_factor = (
                    1 + sim_profile.inflation_rate / 100.0
                ) ** years_from_base

                # Safety buffer = months of expenses (inflation-adjusted)
                safety_buffer_value = (
                    (sim_profile.safety_buffer_months / 12.0)
                    * annual_expense
                    * inflation_factor
                )

                safety_buffer_data.append(
                    {"Age": age, "Safety Buffer": safety_buffer_value}
                )

            safety_buffer_df = pd.DataFrame(safety_buffer_data)

            # Create base chart (keep for reference lines)
            base_chart = alt.Chart(chart_df)

            # First, merge safety buffer data with chart data for comparison
            chart_df_with_buffer = chart_df.merge(
                safety_buffer_df, on="Age", how="left"
            )

            # Create base chart with merged data
            base_chart_with_buffer = alt.Chart(chart_df_with_buffer)

            # Safe area (green) - Net worth above safety buffer
            safe_area = (
                base_chart_with_buffer.transform_filter(
                    alt.datum["Net Worth"] >= alt.datum["Safety Buffer"]
                )
                .mark_area(color="lightgreen", opacity=0.6)
                .encode(
                    x=alt.X("Age:Q", title=t("chart_age_label")),
                    y=alt.Y("Net Worth:Q", title=t("chart_net_worth_label")),
                    y2=alt.Y2("Safety Buffer:Q"),
                    tooltip=[
                        alt.Tooltip("Age:Q", title=t("chart_age_label")),
                        alt.Tooltip("Year:Q", title=t("chart_year_label")),
                        alt.Tooltip(
                            "Net Worth:Q",
                            format=",.0f",
                            title=t("chart_net_worth_label"),
                        ),
                        alt.Tooltip(
                            "Safety Buffer:Q", format=",.0f", title="Safety Buffer"
                        ),
                        alt.Tooltip(
                            "Total Income:Q",
                            format=",.0f",
                            title=t("chart_total_income_label"),
                        ),
                        alt.Tooltip(
                            "Total Expense:Q",
                            format=",.0f",
                            title=t("chart_total_expense_label"),
                        ),
                        alt.Tooltip(
                            "Investment Return:Q",
                            format=",.0f",
                            title=t("chart_investment_return_label"),
                        ),
                    ],
                )
            )

            # Warning area (yellow) - Net worth between 0 and safety buffer
            warning_area = (
                base_chart_with_buffer.transform_filter(
                    (alt.datum["Net Worth"] >= 0)
                    & (alt.datum["Net Worth"] < alt.datum["Safety Buffer"])
                )
                .mark_area(color="yellow", opacity=0.5)
                .encode(
                    x=alt.X("Age:Q", title=t("chart_age_label")),
                    y=alt.Y("Net Worth:Q", title=t("chart_net_worth_label")),
                    y2=alt.value(0),
                    tooltip=[
                        alt.Tooltip("Age:Q", title=t("chart_age_label")),
                        alt.Tooltip("Year:Q", title=t("chart_year_label")),
                        alt.Tooltip(
                            "Net Worth:Q",
                            format=",.0f",
                            title=t("chart_net_worth_label") + " (Below Safety Buffer)",
                        ),
                        alt.Tooltip(
                            "Safety Buffer:Q", format=",.0f", title="Safety Buffer"
                        ),
                        alt.Tooltip(
                            "Total Income:Q",
                            format=",.0f",
                            title=t("chart_total_income_label"),
                        ),
                        alt.Tooltip(
                            "Total Expense:Q",
                            format=",.0f",
                            title=t("chart_total_expense_label"),
                        ),
                    ],
                )
            )

            # Danger area (red) - Negative net worth (debt/funding gap)
            danger_area = (
                base_chart_with_buffer.transform_filter(alt.datum["Net Worth"] < 0)
                .mark_area(color="#ff6b6b", opacity=0.7)
                .encode(
                    x=alt.X("Age:Q", title=t("chart_age_label")),
                    y=alt.Y("Net Worth:Q", title=t("chart_net_worth_label")),
                    y2=alt.value(0),
                    tooltip=[
                        alt.Tooltip("Age:Q", title=t("chart_age_label")),
                        alt.Tooltip("Year:Q", title=t("chart_year_label")),
                        alt.Tooltip(
                            "Net Worth:Q",
                            format=",.0f",
                            title=t("chart_net_worth_label")
                            + " (Negative = Funding Gap)",
                        ),
                        alt.Tooltip(
                            "Total Income:Q",
                            format=",.0f",
                            title=t("chart_total_income_label"),
                        ),
                        alt.Tooltip(
                            "Total Expense:Q",
                            format=",.0f",
                            title=t("chart_total_expense_label"),
                        ),
                        alt.Tooltip(
                            "Net Cash Flow:Q",
                            format=",.0f",
                            title=t("chart_net_cash_flow_label"),
                        ),
                    ],
                )
            )

            # Zero reference line
            zero_line_data = pd.DataFrame({"y": [0]})
            zero_line = (
                alt.Chart(zero_line_data)
                .mark_rule(color="red", strokeDash=[5, 5], strokeWidth=2)
                .encode(y="y:Q")
            )

            # FIRE age vertical line
            fire_age_data = pd.DataFrame({"x": [sim_profile.expected_fire_age]})
            fire_age_line = (
                alt.Chart(fire_age_data)
                .mark_rule(color="orange", strokeDash=[10, 5], strokeWidth=3)
                .encode(
                    x=alt.X("x:Q"),
                    tooltip=alt.value(
                        t("fire_age_line_tooltip", age=sim_profile.expected_fire_age)
                    ),
                )
            )

            # Legal retirement age vertical line
            legal_retirement_data = pd.DataFrame(
                {"x": [sim_profile.legal_retirement_age]}
            )
            legal_retirement_line = (
                alt.Chart(legal_retirement_data)
                .mark_rule(color="purple", strokeDash=[3, 3], strokeWidth=2)
                .encode(
                    x=alt.X("x:Q"),
                    tooltip=alt.value(
                        t(
                            "retirement_age_line_tooltip",
                            age=sim_profile.legal_retirement_age,
                        )
                    ),
                )
            )

            # Create safety buffer line chart
            safety_buffer_line = (
                alt.Chart(safety_buffer_df)
                .mark_line(color="green", strokeDash=[8, 4], strokeWidth=2, opacity=0.8)
                .encode(
                    x=alt.X("Age:Q"),
                    y=alt.Y("Safety Buffer:Q"),
                    tooltip=[
                        alt.Tooltip("Age:Q", title=t("chart_age_label")),
                        alt.Tooltip(
                            "Safety Buffer:Q",
                            format=",.0f",
                            title=(
                                f"Safety Buffer "
                                f"({sim_profile.safety_buffer_months} months)"
                            ),
                        ),
                    ],
                )
            )

            # Main net worth curve line
            net_worth_line = base_chart.mark_line(
                color="darkblue", strokeWidth=3
            ).encode(
                x=alt.X("Age:Q", title=t("chart_age_label")),
                y=alt.Y("Net Worth:Q", title=t("chart_net_worth_label")),
                tooltip=[
                    alt.Tooltip("Age:Q", title=t("chart_age_label")),
                    alt.Tooltip("Year:Q", title=t("chart_year_label")),
                    alt.Tooltip(
                        "Net Worth:Q", format=",.0f", title=t("chart_net_worth_label")
                    ),
                    alt.Tooltip(
                        "Total Income:Q",
                        format=",.0f",
                        title=t("chart_total_income_label"),
                    ),
                    alt.Tooltip(
                        "Total Expense:Q",
                        format=",.0f",
                        title=t("chart_total_expense_label"),
                    ),
                    alt.Tooltip(
                        "Investment Return:Q",
                        format=",.0f",
                        title=t("chart_investment_return_label"),
                    ),
                ],
            )

            # Combine all layers
            combined_chart = (
                (
                    safe_area
                    + warning_area
                    + danger_area
                    + zero_line
                    + fire_age_line
                    + legal_retirement_line
                    + safety_buffer_line
                    + net_worth_line
                )
                .properties(
                    title=t("net_worth_trajectory_chart_title"), width=700, height=450
                )
                .interactive()
            )

            st.altair_chart(combined_chart, use_container_width=True)

        else:
            st.error(t("cannot_generate_trajectory_chart"))

    except Exception as e:
        st.error(t("chart_generation_error", error=str(e)))

    # --- Recommendations Section ---
    st.subheader(t("intelligent_suggestions"))

    # Provide recommendations based on the analysis
    if results:
        try:
            # Display simple recommendations from advisor
            if hasattr(results, "recommendations") and results.recommendations:
                for i, rec_dict in enumerate(results.recommendations, 1):
                    # Use the simplified recommendation renderer
                    try:
                        combined_content = render_recommendation(rec_dict, t, i)
                        st.success(combined_content)
                    except Exception as e:
                        # Fallback for rendering errors
                        st.warning(f"Error rendering recommendation {i}: {str(e)}")
                        st.success(
                            t("recommendation_number", number=i, content=str(rec_dict))
                        )
            else:
                # Fallback to generic recommendations if no specific ones available
                generic_recommendations = [
                    t("generic_suggestion_1"),
                    t("generic_suggestion_2"),
                    t("generic_suggestion_3"),
                    t("generic_suggestion_4"),
                ]
                for i, rec in enumerate(generic_recommendations, 1):
                    st.info(t("recommendation_number", number=i, content=rec))

        except Exception as e:
            st.warning(t("suggestions_generation_problem", error=str(e)))
            # Show generic recommendations as fallback
            fallback_recommendations = [
                t("basic_suggestion_1"),
                t("basic_suggestion_2"),
                t("basic_suggestion_3"),
            ]
            for i, rec in enumerate(fallback_recommendations, 1):
                st.info(t("recommendation_number", number=i, content=rec))

        # Add complete DataFrame for detailed analysis (collapsed by default)
        with st.expander(t("complete_calculation_data"), expanded=False):
            try:
                # Get the planner object from session state
                planner = st.session_state.planner

                # Get detailed projection using new API
                detailed_df = planner.get_projection_with_overrides()

                if detailed_df is None or detailed_df.empty:
                    st.error(t("projection_data_error"))
                    return

                # Create annual summary (same as used by engine)
                if hasattr(planner, "_create_annual_summary_from_df"):
                    annual_summary = planner._create_annual_summary_from_df(detailed_df)

                    # Add engine calculation results if available
                    if (
                        results
                        and hasattr(results, "fire_calculation")
                        and hasattr(results.fire_calculation, "yearly_results")
                    ):
                        yearly_data = results.fire_calculation.yearly_results
                        # Ensure length matches
                        if len(yearly_data) == len(annual_summary):
                            # Add all calculation results for debugging
                            portfolio_values = [
                                float(y.portfolio_value) for y in yearly_data
                            ]

                            annual_summary["portfolio_value"] = portfolio_values
                            annual_summary["net_worth"] = [
                                y.net_worth for y in yearly_data
                            ]
                            annual_summary["investment_return"] = [
                                float(y.investment_return) for y in yearly_data
                            ]
                            # Note: net_cash_flow is the same as net_flow
                            # already in annual_summary
                            # annual_summary['net_cash_flow'] = [
                            #     y.net_cash_flow for y in yearly_data
                            # ]  # Redundant
                            annual_summary["is_sustainable"] = [
                                y.is_sustainable for y in yearly_data
                            ]

                    # Display the complete DataFrame with all calculated columns
                    st.dataframe(annual_summary, use_container_width=True, height=400)

                    # Show summary statistics
                    st.write(t("summary_statistics"))
                    numeric_cols = annual_summary.select_dtypes(
                        include=["number"]
                    ).columns
                    summary_data = []
                    for col in numeric_cols:
                        if (
                            col not in ["age", "year"]
                            and annual_summary[col].notna().any()
                        ):
                            col_sum = annual_summary[col].sum()
                            if abs(col_sum) > 0.01:  # Only show non-zero columns
                                summary_data.append(
                                    {
                                        t("item"): col,
                                        t("total"): f"{col_sum:,.0f}",
                                        t(
                                            "annual_average"
                                        ): f"{col_sum / len(annual_summary):,.0f}",
                                    }
                                )

                    if summary_data:
                        summary_df = pd.DataFrame(summary_data)
                        st.dataframe(summary_df, hide_index=True)
                else:
                    st.error(t("annual_summary_error"))

            except Exception as e:
                st.error(t("debug_data_generation_error", error=str(e)))
                st.exception(e)

    else:
        st.info(t("complete_stage1_stage2_first"))

    # --- Monte Carlo Analysis ---
    st.subheader(t("monte_carlo_risk_analysis"))

    # Use columns with consistent spacing for aligned heights
    col1, col2, col3 = st.columns([2, 1, 1])

    with col1:
        # Add some vertical space to align with other controls
        st.write("")  # Small spacer
        run_monte_carlo = st.button(
            t("run_monte_carlo_simulation"), type="primary", use_container_width=True
        )

    with col2:
        num_simulations = st.number_input(
            t("num_simulations"), value=1000, step=100, help=t("num_simulations_help")
        )

        # Custom validation with our i18n messages
        if num_simulations < 100:
            st.error(t("num_simulations_error_min"))
        elif num_simulations > 10000:
            st.error(t("num_simulations_error_max"))

    with col3:
        # Add label space to align with number input
        st.write("")  # Match the label height from number_input
        enable_black_swan = st.checkbox(
            t("include_extreme_events"), value=True, help=t("extreme_events_help")
        )

    if run_monte_carlo:
        # Validate simulation count before running
        if num_simulations < 100 or num_simulations > 10000:
            st.error(
                t("num_simulations_error_min")
                if num_simulations < 100
                else t("num_simulations_error_max")
            )
        else:
            with st.spinner(f"{t('running_simulations')}"):
                try:
                    # Always run fresh Monte Carlo simulation for interactive experience
                    from core.engine import EngineInput, FIREEngine
                    from core.monte_carlo import MonteCarloSimulator

                    if not results or not hasattr(results, "fire_calculation"):
                        st.error(t("need_fire_results_first"))
                        return

                    # Create engine input from planner data using new API
                    detailed_projection = planner.get_projection_with_overrides()

                    annual_summary = planner._create_annual_summary_from_df(
                        detailed_projection
                    )

                    engine_input = EngineInput(
                        user_profile=sim_profile,
                        annual_financial_projection=annual_summary,
                        detailed_projection=detailed_projection,
                        income_items=planner.data.income_items,
                    )

                    engine = FIREEngine(engine_input)

                    # Set up Monte Carlo settings
                    simulation_settings = planner.get_simulation_settings()
                    simulation_settings.num_simulations = (
                        num_simulations  # Use user-defined number
                    )
                    if enable_black_swan:
                        simulation_settings.include_black_swan_events = True

                    # Create progress bar for Monte Carlo simulation
                    progress_bar = st.progress(0)
                    progress_text = st.empty()

                    def streamlit_progress_callback(current: int, total: int) -> None:
                        """Progress callback for Streamlit progress bar."""
                        percentage = current / total
                        progress_bar.progress(percentage)
                        progress_text.text(
                            f"Monte Carlo Progress: {current}/{total} "
                            f"({percentage:.1%})"
                        )

                    # Run real Monte Carlo simulation
                    simulator = MonteCarloSimulator(
                        engine=engine, settings=simulation_settings
                    )
                    monte_carlo_result = simulator.run_simulation(
                        progress_callback=streamlit_progress_callback
                    )

                    # Clear progress displays
                    progress_bar.empty()
                    progress_text.empty()

                    # Store results in session state to persist across language changes
                    st.session_state.monte_carlo_result = monte_carlo_result
                    st.session_state.monte_carlo_black_swan = enable_black_swan
                    st.session_state.monte_carlo_num_simulations = num_simulations

                    success_rate = monte_carlo_result.success_rate
                    # Extract final net worth values for percentile analysis
                    final_values = [
                        monte_carlo_result.worst_case_final_net_worth,
                        monte_carlo_result.percentile_5_net_worth,
                        monte_carlo_result.median_final_net_worth,
                        monte_carlo_result.mean_final_net_worth,
                        monte_carlo_result.percentile_95_net_worth,
                        monte_carlo_result.best_case_final_net_worth,
                    ]

                    mean_final = monte_carlo_result.mean_final_net_worth

                    # Use Monte Carlo result percentiles
                    percentiles = {
                        5: monte_carlo_result.percentile_5_net_worth,
                        25: monte_carlo_result.percentile_5_net_worth,  # Approximate
                        50: monte_carlo_result.median_final_net_worth,
                        75: monte_carlo_result.percentile_95_net_worth,  # Approximate
                        95: monte_carlo_result.percentile_95_net_worth,
                    }

                    # Display results
                    col1, col2, col3 = st.columns(3)

                    with col1:
                        st.metric(
                            t("success_rate"),
                            f"{success_rate:.1%}",
                            help=t("success_rate_help"),
                        )

                    with col2:
                        st.metric(
                            t("average_final_net_worth"),
                            format_currency(mean_final),
                            help=t("average_final_net_worth_help"),
                        )

                    with col3:
                        volatility = (
                            monte_carlo_result.standard_deviation_final_net_worth
                            / abs(mean_final)
                            if mean_final != 0
                            else 0
                        )
                        st.metric(
                            t("result_volatility"),
                            f"{volatility:.1%}",
                            help=t("result_volatility_help"),
                        )

                    # Outcome Distribution
                    st.subheader(t("result_distribution"))
                    percentiles_df = pd.DataFrame(
                        [
                            {
                                t("percentile"): f"{p}%",
                                t("final_net_worth"): format_currency(v),
                            }
                            for p, v in percentiles.items()
                        ]
                    )

                    col1, col2 = st.columns([1, 2])
                    with col1:
                        st.dataframe(percentiles_df, hide_index=True)

                    with col2:
                        # Create a simple bar chart of percentiles
                        percentiles_chart_data = pd.DataFrame(
                            {
                                "Percentile": list(percentiles.keys()),
                                t("chart_net_worth_label"): list(percentiles.values()),
                            }
                        )

                        net_worth_col = t("chart_net_worth_label")
                        percentile_chart = (
                            alt.Chart(percentiles_chart_data)
                            .mark_bar()
                            .encode(
                                x=alt.X("Percentile:O", title=t("percentile")),
                                y=alt.Y(
                                    f"{net_worth_col}:Q", title=t("final_net_worth")
                                ),
                                color=alt.Color(
                                    f"{net_worth_col}:Q",
                                    scale=alt.Scale(scheme="viridis"),
                                ),
                                tooltip=[
                                    "Percentile",
                                    alt.Tooltip(f"{net_worth_col}:Q", format=",.0f"),
                                ],
                            )
                            .properties(
                                title=t("final_net_worth_distribution"),
                                width=300,
                                height=250,
                            )
                        )

                        st.altair_chart(percentile_chart, use_container_width=True)

                    # Risk assessment
                    if success_rate >= 0.9:
                        st.success(t("excellent_plan"))
                    elif success_rate >= 0.7:
                        st.info(t("good_plan"))
                    elif success_rate >= 0.5:
                        st.warning(t("moderate_risk"))
                    else:
                        st.error(t("high_risk_plan"))

                    # Black Swan Analysis
                    if enable_black_swan:
                        st.subheader(t("extreme_risk_analysis"))

                        # Display occurred black swan events
                        if (
                            hasattr(monte_carlo_result, "black_swan_impact_analysis")
                            and monte_carlo_result.black_swan_impact_analysis
                        ):
                            black_swan_analysis = (
                                monte_carlo_result.black_swan_impact_analysis
                            )

                            # Show all occurred events (not just top 5)
                            if "most_frequent_events" in black_swan_analysis:
                                st.write(f"**{t('black_swan_events_occurred')}:**")
                                events = black_swan_analysis["most_frequent_events"]
                                if events:
                                    try:
                                        # Attempt to treat as dict and get items
                                        events_dict = cast(Dict[str, Any], events)
                                        sorted_events = sorted(
                                            events_dict.items(),
                                            key=lambda x: x[1],
                                            reverse=True,
                                        )
                                        event_list = []
                                        for event_id, count in sorted_events:
                                            # Try to get translation, fallback to
                                            # event_id if not found
                                            try:
                                                event_name = t(event_id)
                                            except Exception:
                                                event_name = event_id.replace(
                                                    "_", " "
                                                ).title()
                                            event_list.append(
                                                t(
                                                    "event_occurrence_format",
                                                    event_name=event_name,
                                                    count=count,
                                                )
                                            )
                                        st.markdown("\n".join(event_list))
                                    except (AttributeError, TypeError):
                                        # events is not a dict, skip this section
                                        st.info("Events data format not supported")
                                else:
                                    st.info(t("no_black_swan_events"))

                            # Show event statistics
                            if (
                                "total_events_triggered" in black_swan_analysis
                                and "avg_events_per_simulation" in black_swan_analysis
                            ):
                                col1, col2 = st.columns(2)
                                with col1:
                                    st.metric(
                                        "Total Events",
                                        black_swan_analysis["total_events_triggered"],
                                    )
                                with col2:
                                    st.metric(
                                        "Average per Simulation",
                                        f"{black_swan_analysis[
                                            'avg_events_per_simulation'
                                        ]:.1f}",
                                    )

                        # Explain the difference between overall and extreme
                        # scenario success rates
                        st.info(t("extreme_scenarios_explanation"))

                        # Calculate extreme scenario success rate (worst 25% scenarios)
                        black_swan_values = [
                            v for v in final_values if v < percentiles[25]
                        ]
                        if black_swan_values:
                            extreme_success = len(
                                [v for v in black_swan_values if v > 0]
                            ) / len(black_swan_values)
                            st.info(
                                t(
                                    "overall_success_vs_extreme",
                                    overall_rate=f"{success_rate:.1%}",
                                    extreme_rate=f"{extreme_success:.1%}",
                                )
                            )

                        st.info(t("risk_management_suggestions"))

                except Exception as e:
                    st.error(t("monte_carlo_simulation_error", error=str(e)))

    # Display stored Monte Carlo results if available (survives language changes)
    elif "monte_carlo_result" in st.session_state:
        monte_carlo_result = st.session_state.monte_carlo_result
        enable_black_swan = st.session_state.get("monte_carlo_black_swan", True)

        success_rate = monte_carlo_result.success_rate
        # Extract final net worth values for percentile analysis
        final_values = [
            monte_carlo_result.worst_case_final_net_worth,
            monte_carlo_result.percentile_5_net_worth,
            monte_carlo_result.median_final_net_worth,
            monte_carlo_result.mean_final_net_worth,
            monte_carlo_result.percentile_95_net_worth,
            monte_carlo_result.best_case_final_net_worth,
        ]

        mean_final = monte_carlo_result.mean_final_net_worth

        # Use Monte Carlo result percentiles
        percentiles = {
            5: monte_carlo_result.percentile_5_net_worth,
            25: monte_carlo_result.percentile_5_net_worth,  # Approximate
            50: monte_carlo_result.median_final_net_worth,
            75: monte_carlo_result.percentile_95_net_worth,  # Approximate
            95: monte_carlo_result.percentile_95_net_worth,
        }

        # Display results
        col1, col2, col3 = st.columns(3)

        with col1:
            st.metric(
                t("success_rate"), f"{success_rate:.1%}", help=t("success_rate_help")
            )

        with col2:
            st.metric(
                t("average_final_net_worth"),
                format_currency(mean_final),
                help=t("average_final_net_worth_help"),
            )

        with col3:
            volatility = (
                monte_carlo_result.standard_deviation_final_net_worth / abs(mean_final)
                if mean_final != 0
                else 0
            )
            st.metric(
                t("result_volatility"),
                f"{volatility:.1%}",
                help=t("result_volatility_help"),
            )

        # Outcome Distribution
        st.subheader(t("result_distribution"))
        percentiles_df = pd.DataFrame(
            [
                {t("percentile"): f"{p}%", t("final_net_worth"): format_currency(v)}
                for p, v in percentiles.items()
            ]
        )

        col1, col2 = st.columns([1, 2])
        with col1:
            st.dataframe(percentiles_df, hide_index=True)

        with col2:
            # Create a simple bar chart of percentiles
            percentiles_chart_data = pd.DataFrame(
                {
                    "Percentile": list(percentiles.keys()),
                    t("chart_net_worth_label"): list(percentiles.values()),
                }
            )

            net_worth_col = t("chart_net_worth_label")
            percentile_chart = (
                alt.Chart(percentiles_chart_data)
                .mark_bar()
                .encode(
                    x=alt.X("Percentile:O", title=t("percentile")),
                    y=alt.Y(f"{net_worth_col}:Q", title=t("final_net_worth")),
                    color=alt.Color(
                        f"{net_worth_col}:Q", scale=alt.Scale(scheme="viridis")
                    ),
                    tooltip=[
                        "Percentile",
                        alt.Tooltip(f"{net_worth_col}:Q", format=",.0f"),
                    ],
                )
                .properties(
                    title=t("final_net_worth_distribution"), width=300, height=200
                )
            )

            st.altair_chart(percentile_chart, use_container_width=True)

        # Risk assessment
        if success_rate >= 0.9:
            st.success(t("excellent_plan"))
        elif success_rate >= 0.7:
            st.info(t("good_plan"))
        elif success_rate >= 0.5:
            st.warning(t("moderate_risk"))
        else:
            st.error(t("high_risk_plan"))

        # Black Swan Analysis
        if enable_black_swan:
            st.subheader(t("extreme_risk_analysis"))

            # Display occurred black swan events
            if (
                hasattr(monte_carlo_result, "black_swan_impact_analysis")
                and monte_carlo_result.black_swan_impact_analysis
            ):
                black_swan_analysis = monte_carlo_result.black_swan_impact_analysis

                # Show all occurred events (not just top 5)
                if "most_frequent_events" in black_swan_analysis:
                    st.write(f"**{t('black_swan_events_occurred')}:**")
                    events = black_swan_analysis["most_frequent_events"]
                    if events:
                        event_list = []
                        # Sort by count (descending) to show most frequent first
                        sorted_events = sorted(
                            events.items(), key=lambda x: x[1], reverse=True
                        )
                        for event_id, count in sorted_events:
                            # Try to get translation, fallback to event_id if not found
                            try:
                                event_name = t(event_id)
                            except Exception:
                                event_name = event_id.replace("_", " ").title()
                            event_list.append(
                                t(
                                    "event_occurrence_format",
                                    event_name=event_name,
                                    count=count,
                                )
                            )
                        st.markdown("\n".join(event_list))
                    else:
                        st.info(t("no_black_swan_events"))

                # Show event statistics
                if (
                    "total_events_triggered" in black_swan_analysis
                    and "avg_events_per_simulation" in black_swan_analysis
                ):
                    col1, col2 = st.columns(2)
                    with col1:
                        st.metric(
                            "Total Events",
                            black_swan_analysis["total_events_triggered"],
                        )
                    with col2:
                        st.metric(
                            "Average per Simulation",
                            f"{black_swan_analysis['avg_events_per_simulation']:.1f}",
                        )

            # Explain the difference between overall and extreme scenario success rates
            st.info(t("extreme_scenarios_explanation"))

            # Calculate extreme scenario success rate (worst 25% scenarios)
            black_swan_values = [v for v in final_values if v < percentiles[25]]
            if black_swan_values:
                extreme_success = len([v for v in black_swan_values if v > 0]) / len(
                    black_swan_values
                )
                st.info(
                    t(
                        "overall_success_vs_extreme",
                        overall_rate=f"{success_rate:.1%}",
                        extreme_rate=f"{extreme_success:.1%}",
                    )
                )

            st.info(t("risk_management_suggestions"))
