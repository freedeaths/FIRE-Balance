# HTML Report Generator for FIRE Balance Calculator Results
# Generates a comprehensive standalone HTML report with embedded CSS/JS

from typing import Any, Callable, Dict, Optional

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

from core.data_models import UserProfile
from core.planner_models import PlannerResults


def format_currency(amount: float) -> str:
    """Format currency without currency symbol for international use."""
    return f"{amount:,.0f}"


def generate_collapsible_html_report(
    user_profile: UserProfile,
    results: PlannerResults,
    planner: Any,
    t: Callable[..., str],
    chart_df: pd.DataFrame,
    monte_carlo_result: Optional[Any] = None,
    black_swan_enabled: bool = False,
    num_simulations: int = 1000,
) -> str:
    """
    Generate a comprehensive standalone HTML report with all FIRE analysis results.

    Args:
        user_profile: User profile data
        results: FIRE calculation results
        planner: Financial planner instance
        t: Translation function
        chart_df: Chart data DataFrame
        monte_carlo_result: Monte Carlo simulation results (optional)
        black_swan_enabled: Whether black swan events were included
        num_simulations: Number of simulations run

    Returns:
        Complete HTML string with embedded CSS and JavaScript
    """

    # Generate all sections
    user_profile_section = generate_user_profile_section(user_profile, t)
    feasibility_section = generate_feasibility_section(
        results, user_profile, t, chart_df
    )
    recommendations_section = generate_recommendations_section(results, t)
    net_worth_chart_section = generate_net_worth_chart_section(
        chart_df, user_profile, t
    )
    cash_flow_chart_section = generate_cash_flow_chart_section(chart_df, t)
    data_table_section = generate_data_table_section(planner, results, t)
    monte_carlo_section = generate_monte_carlo_section(
        monte_carlo_result, user_profile, t, black_swan_enabled, num_simulations
    )

    # Generate complete HTML with embedded CSS and JS
    html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{t('fire_analysis_report')}</title>
    <style>
        {get_embedded_css()}
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>{t('fire_analysis_report')}</h1>
            <p class="subtitle">{t('comprehensive_financial_analysis')}</p>
            <p class="timestamp">{t('generated_at')}:
                {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        </header>

        {user_profile_section}
        {feasibility_section}
        {recommendations_section}
        {net_worth_chart_section}
        {cash_flow_chart_section}
        {data_table_section}
        {monte_carlo_section}
    </div>

    <script>
        {get_embedded_javascript()}
    </script>
</body>
</html>
    """

    return html_content


def generate_user_profile_section(
    user_profile: UserProfile, t: Callable[..., str]
) -> str:
    """Generate user profile collapsible section."""
    return f"""
    <section class="report-section">
        <div class="section-header" onclick="toggleSection('user-profile')">
            <h2>{t('user_profile')}</h2>
            <span class="toggle-icon">▼</span>
        </div>
        <div id="user-profile" class="section-content">
            <div class="profile-grid">
                <div class="profile-item">
                    <label>{t('current_age')}:</label>
                    <value>{user_profile.current_age}</value>
                </div>
                <div class="profile-item">
                    <label>{t('expected_fire_age')}:</label>
                    <value>{user_profile.expected_fire_age}</value>
                </div>
                <div class="profile-item">
                    <label>{t('legal_retirement_age')}:</label>
                    <value>{user_profile.legal_retirement_age}</value>
                </div>
                <div class="profile-item">
                    <label>{t('current_net_worth')}:</label>
                    <value>{format_currency(user_profile.current_net_worth)}</value>
                </div>
                <div class="profile-item">
                    <label>{t('safety_buffer_months')}:</label>
                    <value>{user_profile.safety_buffer_months} {t('months')}</value>
                </div>
                <div class="profile-item">
                    <label>{t('inflation_rate')}:</label>
                    <value>{user_profile.inflation_rate}%</value>
                </div>
            </div>
        </div>
    </section>
    """


def generate_feasibility_section(
    results: PlannerResults,
    user_profile: UserProfile,
    t: Callable[..., str],
    chart_df: pd.DataFrame,
) -> str:
    """Generate FIRE feasibility analysis section."""

    # Extract key metrics
    if hasattr(results, "fire_calculation") and hasattr(
        results.fire_calculation, "is_fire_achievable"
    ):
        fire_feasible = results.fire_calculation.is_fire_achievable
        fire_age = user_profile.expected_fire_age
        portfolio_at_fire = results.fire_calculation.fire_net_worth
    elif hasattr(results, "is_fire_achievable"):
        fire_feasible = results.is_fire_achievable
        fire_age = user_profile.expected_fire_age
        portfolio_at_fire = getattr(
            results, "fire_net_worth", user_profile.current_net_worth
        )
    else:
        fire_feasible = True
        fire_age = user_profile.expected_fire_age
        portfolio_at_fire = user_profile.current_net_worth

    # Calculate additional metrics from chart data
    additional_metrics = ""
    if not chart_df.empty:
        min_net_worth = chart_df["Net Worth"].min()
        final_net_worth = chart_df["Net Worth"].iloc[-1]
        chart_df_copy = chart_df.copy()
        chart_df_copy["Annual Net Income"] = (
            chart_df_copy["Net Cash Flow"] + chart_df_copy["Investment Return"]
        )
        min_annual_income = chart_df_copy["Annual Net Income"].min()
        negative_net_worth = chart_df_copy[chart_df_copy["Net Worth"] < 0]
        debt_years = len(negative_net_worth)

        additional_metrics = f"""
        <div class="metrics-row">
            <div class="metric-item">
                <label>{t('minimum_net_worth')}:</label>
                <value>{format_currency(min_net_worth)}</value>
            </div>
            <div class="metric-item">
                <label>{t('final_net_worth')}:</label>
                <value>{format_currency(final_net_worth)}</value>
            </div>
            <div class="metric-item">
                <label>{
                    t('negative_net_worth_years') if debt_years > 0
                    else t('minimum_annual_income')
                }:</label>
                <value>{
                    debt_years if debt_years > 0
                    else format_currency(min_annual_income)
                }</value>
            </div>
        </div>
        """

    feasibility_icon = "✅" if fire_feasible else "❌"
    feasibility_status = t("feasible") if fire_feasible else t("needs_adjustment")
    status_class = "success" if fire_feasible else "warning"

    return f"""
    <section class="report-section">
        <div class="section-header" onclick="toggleSection('feasibility')">
            <h2>{t('fire_feasibility_analysis')}</h2>
            <span class="toggle-icon">▼</span>
        </div>
        <div id="feasibility" class="section-content">
            <div class="metrics-row">
                <div class="metric-item">
                    <label>{t('target_fire_age')}:</label>
                    <value>{fire_age} {t('years')}</value>
                </div>
                <div class="metric-item">
                    <label>{t('fire_net_worth')}:</label>
                    <value>{format_currency(portfolio_at_fire)}</value>
                </div>
                <div class="metric-item">
                    <label>{t('plan_feasibility')}:</label>
                    <value class="{status_class}">
                        {feasibility_icon} {feasibility_status}
                    </value>
                </div>
            </div>
            {additional_metrics}
        </div>
    </section>
    """


def generate_recommendations_section(
    results: PlannerResults, t: Callable[..., str]
) -> str:
    """Generate intelligent recommendations section."""

    recommendations_html = ""

    if hasattr(results, "recommendations") and results.recommendations:
        for i, rec_dict in enumerate(results.recommendations, 1):
            try:
                # Use the same recommendation rendering logic as Stage 3
                from ..utils.recommendation_renderer import render_recommendation

                combined_content = render_recommendation(rec_dict, t, i)
                recommendations_html += f"""
                <div class="recommendation-item">
                    {combined_content}
                </div>
                """
            except Exception as e:
                # Fallback for rendering errors
                recommendations_html += f"""
                <div class="recommendation-item">
                    <h4>{t('recommendation')} {i}</h4>
                    <p>Error rendering recommendation: {str(e)}</p>
                </div>
                """
    else:
        # Generic recommendations
        generic_recommendations = [
            t("generic_suggestion_1"),
            t("generic_suggestion_2"),
            t("generic_suggestion_3"),
            t("generic_suggestion_4"),
        ]
        for i, rec in enumerate(generic_recommendations, 1):
            recommendations_html += f"""
            <div class="recommendation-item">
                <h4>{t('recommendation')} {i}</h4>
                <p>{rec}</p>
            </div>
            """

    return f"""
    <section class="report-section">
        <div class="section-header" onclick="toggleSection('recommendations')">
            <h2>{t('intelligent_suggestions')}</h2>
            <span class="toggle-icon">▼</span>
        </div>
        <div id="recommendations" class="section-content">
            {recommendations_html}
        </div>
    </section>
    """


def generate_net_worth_chart_section(
    chart_df: pd.DataFrame, user_profile: UserProfile, t: Callable[..., str]
) -> str:
    """Generate net worth trajectory chart section."""

    if chart_df.empty:
        return f"""
        <section class="report-section">
            <div class="section-header" onclick="toggleSection('net-worth-chart')">
                <h2>{t('net_worth_trajectory_analysis')}</h2>
                <span class="toggle-icon">▼</span>
            </div>
            <div id="net-worth-chart" class="section-content">
                <p class="error">{t('cannot_generate_trajectory_chart')}</p>
            </div>
        </section>
        """

    # Create plotly chart
    chart_html = create_net_worth_plotly_chart(chart_df, user_profile, t)

    return f"""
    <section class="report-section">
        <div class="section-header" onclick="toggleSection('net-worth-chart')">
            <h2>{t('net_worth_trajectory_analysis')}</h2>
            <span class="toggle-icon">▼</span>
        </div>
        <div id="net-worth-chart" class="section-content">
            <p class="chart-description">{t('trajectory_description')}</p>
            {chart_html}
        </div>
    </section>
    """


def generate_cash_flow_chart_section(
    chart_df: pd.DataFrame, t: Callable[..., str]
) -> str:
    """Generate annual cash flow chart section."""

    if chart_df.empty:
        return f"""
        <section class="report-section">
            <div class="section-header" onclick="toggleSection('cash-flow-chart')">
                <h2>{t('annual_cash_flow_analysis')}</h2>
                <span class="toggle-icon">▼</span>
            </div>
            <div id="cash-flow-chart" class="section-content">
                <p class="error">{t('cannot_generate_chart')}</p>
            </div>
        </section>
        """

    # Create cash flow chart
    chart_html = create_cash_flow_plotly_chart(chart_df, t)

    return f"""
    <section class="report-section">
        <div class="section-header" onclick="toggleSection('cash-flow-chart')">
            <h2>{t('annual_cash_flow_analysis')}</h2>
            <span class="toggle-icon">▼</span>
        </div>
        <div id="cash-flow-chart" class="section-content">
            {chart_html}
        </div>
    </section>
    """


def generate_data_table_section(
    planner: Any, results: PlannerResults, t: Callable[..., str]
) -> str:
    """Generate complete data table section."""

    try:
        # Get detailed projection data
        detailed_df = planner.get_projection_with_overrides()

        if detailed_df is None or detailed_df.empty:
            return f"""
            <section class="report-section">
                <div class="section-header" onclick="toggleSection('data-table')">
                    <h2>{t('complete_calculation_data')}</h2>
                    <span class="toggle-icon">▼</span>
                </div>
                <div id="data-table" class="section-content">
                    <p class="error">{t('projection_data_error')}</p>
                </div>
            </section>
            """

        # Create annual summary
        annual_summary = planner._create_annual_summary_from_df(detailed_df)

        # Add engine calculation results if available
        if (
            results
            and hasattr(results, "fire_calculation")
            and hasattr(results.fire_calculation, "yearly_results")
        ):
            yearly_data = results.fire_calculation.yearly_results
            if len(yearly_data) == len(annual_summary):
                annual_summary["portfolio_value"] = [
                    float(y.portfolio_value) for y in yearly_data
                ]
                annual_summary["net_worth"] = [y.net_worth for y in yearly_data]
                annual_summary["investment_return"] = [
                    float(y.investment_return) for y in yearly_data
                ]
                annual_summary["is_sustainable"] = [
                    y.is_sustainable for y in yearly_data
                ]

        # Convert to HTML table
        table_html = annual_summary.to_html(
            classes="data-table",
            index=False,
            escape=False,
            float_format=lambda x: f"{x:,.0f}" if abs(x) >= 1 else f"{x:.3f}",
        )

        return f"""
        <section class="report-section">
            <div class="section-header" onclick="toggleSection('data-table')">
                <h2>{t('complete_calculation_data')}</h2>
                <span class="toggle-icon">▼</span>
            </div>
            <div id="data-table" class="section-content">
                <div class="table-container">
                    {table_html}
                </div>
            </div>
        </section>
        """

    except Exception as e:
        return f"""
        <section class="report-section">
            <div class="section-header" onclick="toggleSection('data-table')">
                <h2>{t('complete_calculation_data')}</h2>
                <span class="toggle-icon">▼</span>
            </div>
            <div id="data-table" class="section-content">
                <p class="error">{t('debug_data_generation_error', error=str(e))}</p>
            </div>
        </section>
        """


def generate_monte_carlo_section(
    monte_carlo_result: Optional[Any],
    user_profile: UserProfile,
    t: Callable[..., str],
    black_swan_enabled: bool = False,
    num_simulations: int = 1000,
) -> str:
    """Generate Monte Carlo analysis section."""

    if monte_carlo_result is None:
        return f"""
        <section class="report-section">
            <div class="section-header" onclick="toggleSection('monte-carlo')">
                <h2>{t('monte_carlo_risk_analysis')}</h2>
                <span class="toggle-icon">▼</span>
            </div>
            <div id="monte-carlo" class="section-content">
                <p class="info">{t('no_monte_carlo_results')}</p>
            </div>
        </section>
        """

    success_rate = monte_carlo_result.success_rate
    mean_minimum = monte_carlo_result.mean_minimum_net_worth
    volatility = (
        monte_carlo_result.standard_deviation_minimum_net_worth / abs(mean_minimum)
        if mean_minimum != 0
        else 0
    )

    # Get percentiles
    percentiles = {
        5: monte_carlo_result.percentile_5_minimum_net_worth,
        25: monte_carlo_result.percentile_25_minimum_net_worth,
        50: monte_carlo_result.median_minimum_net_worth,
        75: monte_carlo_result.percentile_75_minimum_net_worth,
        95: monte_carlo_result.percentile_95_minimum_net_worth,
    }

    # Create percentiles table
    percentiles_table = f"""
    <table class="percentiles-table">
        <thead>
            <tr>
                <th>{t('percentile')}</th>
                <th>{t('minimum_net_worth')}</th>
            </tr>
        </thead>
        <tbody>
    """
    for p, v in percentiles.items():
        percentiles_table += f"<tr><td>{p}%</td><td>{format_currency(v)}</td></tr>"
    percentiles_table += "</tbody></table>"

    # Create percentile chart
    percentile_chart_html = create_percentile_chart(percentiles, t)

    # Risk assessment
    if success_rate >= 0.9:
        risk_assessment = f'<p class="success">{t("excellent_plan")}</p>'
    elif success_rate >= 0.7:
        risk_assessment = f'<p class="info">{t("good_plan")}</p>'
    elif success_rate >= 0.5:
        risk_assessment = f'<p class="warning">{t("moderate_risk")}</p>'
    else:
        risk_assessment = f'<p class="error">{t("high_risk_plan")}</p>'

    # Black swan analysis section
    black_swan_section = ""
    if black_swan_enabled and hasattr(monte_carlo_result, "black_swan_impact_analysis"):
        black_swan_section = generate_black_swan_analysis_html(monte_carlo_result, t)

    return f"""
    <section class="report-section">
        <div class="section-header" onclick="toggleSection('monte-carlo')">
            <h2>{t('monte_carlo_risk_analysis')}</h2>
            <span class="toggle-icon">▼</span>
        </div>
        <div id="monte-carlo" class="section-content">
            <div class="simulation-info">
                <p><strong>{t('simulations_run')}:</strong> {num_simulations:,}</p>
                <p><strong>{t('black_swan_events')}:</strong> {
                    t('enabled') if black_swan_enabled else t('disabled')
                }</p>
            </div>

            <div class="metrics-row">
                <div class="metric-item">
                    <label>{t('success_rate')}:</label>
                    <value class="large">{success_rate:.1%}</value>
                </div>
                <div class="metric-item">
                    <label>{t('minimum_net_worth')}:</label>
                    <value>{format_currency(mean_minimum)}</value>
                </div>
                <div class="metric-item">
                    <label>{t('result_volatility')}:</label>
                    <value>{volatility:.1%}</value>
                </div>
            </div>

            <div class="info-box">
                <p>{
                    t('fire_success_criteria', months=user_profile.safety_buffer_months)
                }</p>
            </div>

            {risk_assessment}

            <div class="chart-and-table">
                <div class="percentiles-container">
                    <h4>{t('result_distribution')}</h4>
                    {percentiles_table}
                </div>
                <div class="chart-container">
                    {percentile_chart_html}
                </div>
            </div>

            {black_swan_section}
        </div>
    </section>
    """


def generate_black_swan_analysis_html(
    monte_carlo_result: Any, t: Callable[..., str]
) -> str:
    """Generate black swan events analysis HTML."""

    if not hasattr(monte_carlo_result, "black_swan_impact_analysis"):
        return ""

    black_swan_analysis = monte_carlo_result.black_swan_impact_analysis

    # Events occurred section
    events_html = ""
    if "most_frequent_events" in black_swan_analysis:
        events = black_swan_analysis["most_frequent_events"]
        if events:
            events_list = ""
            try:
                sorted_events = sorted(events.items(), key=lambda x: x[1], reverse=True)
                for event_id, count in sorted_events:
                    try:
                        event_name = t(event_id)
                    except Exception:
                        event_name = event_id.replace("_", " ").title()
                    occurrence_text = t(
                        "event_occurrence_format", event_name=event_name, count=count
                    )
                    events_list += f"<li>{occurrence_text}</li>"

                events_html = f"""
                <div class="black-swan-events">
                    <h4>{t('black_swan_events_occurred')}</h4>
                    <ul>{events_list}</ul>
                </div>
                """
            except (AttributeError, TypeError):
                events_html = f'<p class="info">{t("events_data_not_available")}</p>'
        else:
            events_html = f'<p class="info">{t("no_black_swan_events")}</p>'

    # Event statistics
    stats_html = ""
    if (
        "total_events_triggered" in black_swan_analysis
        and "avg_events_per_simulation" in black_swan_analysis
    ):
        stats_html = f"""
        <div class="event-statistics">
            <h4>{t('event_statistics')}</h4>
            <div class="metrics-row">
                <div class="metric-item">
                    <label>{t('total_events')}:</label>
                    <value>{black_swan_analysis['total_events_triggered']}</value>
                </div>
                <div class="metric-item">
                    <label>{t('average_per_simulation')}:</label>
                    <value>{black_swan_analysis['avg_events_per_simulation']:.1f}</value>
                </div>
            </div>
        </div>
        """

    return f"""
    <div class="black-swan-analysis">
        <h3>{t('extreme_risk_analysis')}</h3>
        {events_html}
        {stats_html}
        <div class="info-box">
            <p>{t('extreme_scenarios_explanation')}</p>
            <p>{t('risk_management_suggestions')}</p>
        </div>
    </div>
    """


def create_net_worth_plotly_chart(
    chart_df: pd.DataFrame, user_profile: UserProfile, t: Callable[..., str]
) -> str:
    """Create net worth trajectory Plotly chart as HTML div."""

    if chart_df.empty:
        return f'<div class="chart-container"><p>{t("cannot_generate_chart")}</p></div>'

    # Prepare data similar to the original implementation
    chart_df_with_buffer = chart_df.copy()
    base_year = 2024

    safety_buffer_values = []
    for _, row in chart_df.iterrows():
        age = int(row["Age"])
        year = row["Year"]
        annual_expense = row["Total Expense"]

        years_from_base = year - base_year
        inflation_factor = (1 + user_profile.inflation_rate / 100.0) ** years_from_base

        required_months: float = float(user_profile.safety_buffer_months)
        if user_profile.expected_fire_age <= age < user_profile.legal_retirement_age:
            years_until_legal = user_profile.legal_retirement_age - age
            discount_rate = float(user_profile.bridge_discount_rate) / 100.0

            if discount_rate <= 0:
                required_months += years_until_legal * 12
            else:
                annuity_years = (1 - (1 + discount_rate) ** (-years_until_legal)) / (
                    discount_rate
                )
                required_months += annuity_years * 12

        safety_buffer = (required_months / 12.0) * annual_expense * inflation_factor
        safety_buffer_values.append(safety_buffer)

    chart_df_with_buffer["Safety Buffer"] = safety_buffer_values

    # Create Plotly figure
    fig = go.Figure()

    ages = chart_df_with_buffer["Age"].values
    net_worth = chart_df_with_buffer["Net Worth"].values
    safety_buffer = chart_df_with_buffer["Safety Buffer"].values
    cash_flow = chart_df_with_buffer["Net Cash Flow"].values

    # Use the exact same coloring logic as Stage 3
    # Import and use the same intersection calculation functions
    from typing import Dict, List, Optional, Tuple

    import numpy as np

    def find_intersection(
        x1: float, y1a: float, y1b: float, x2: float, y2a: float, y2b: float
    ) -> Optional[Tuple[float, float]]:
        """Find intersection point between two line segments (copied from Stage 3)"""
        if (y1a - y1b) * (y2a - y2b) >= 0:
            return None  # Lines don't cross

        # Linear interpolation to find intersection
        t = (y1b - y1a) / ((y1b - y1a) - (y2b - y2a))
        if 0 <= t <= 1:
            x_intersect = x1 + t * (x2 - x1)
            y_intersect = y1a + t * (y2a - y1a)
            return (x_intersect, y_intersect)
        return None

    def find_continuous_segments_with_intersections(
        ages: np.ndarray, net_worth: np.ndarray, safety_buffer: np.ndarray
    ) -> Dict[str, List[Dict[str, List[float]]]]:
        """Find segments with precise intersection points (from Stage 3)"""
        # Create enhanced arrays with intersection points
        enhanced_ages = []
        enhanced_nw = []
        enhanced_sb = []

        for i in range(len(ages)):
            enhanced_ages.append(ages[i])
            enhanced_nw.append(net_worth[i])
            enhanced_sb.append(safety_buffer[i])

            # Check for intersections with next point
            if i < len(ages) - 1:
                # Check net_worth vs safety_buffer intersection
                intersect = find_intersection(
                    ages[i],
                    net_worth[i],
                    safety_buffer[i],
                    ages[i + 1],
                    net_worth[i + 1],
                    safety_buffer[i + 1],
                )
                if intersect:
                    enhanced_ages.append(intersect[0])
                    enhanced_nw.append(intersect[1])
                    enhanced_sb.append(intersect[1])  # At intersection, nw = sb

                # Check net_worth vs zero intersection
                intersect_zero = find_intersection(
                    ages[i], net_worth[i], 0, ages[i + 1], net_worth[i + 1], 0
                )
                if intersect_zero:
                    enhanced_ages.append(intersect_zero[0])
                    enhanced_nw.append(0)  # At intersection, nw = 0
                    enhanced_sb.append(
                        safety_buffer[i]
                        + (intersect_zero[0] - ages[i])
                        * (safety_buffer[i + 1] - safety_buffer[i])
                        / (ages[i + 1] - ages[i])
                    )

        # Sort by age to maintain order
        sorted_indices = sorted(
            range(len(enhanced_ages)), key=lambda k: enhanced_ages[k]
        )
        enhanced_ages = [enhanced_ages[i] for i in sorted_indices]
        enhanced_nw = [enhanced_nw[i] for i in sorted_indices]
        enhanced_sb = [enhanced_sb[i] for i in sorted_indices]

        # Now find segments using enhanced data
        segments: Dict[str, List[Dict[str, List[float]]]] = {
            "safe": [],
            "warning": [],
            "danger": [],
        }
        current_zone = None
        segment_start = 0

        for i, (age, nw, sb) in enumerate(zip(enhanced_ages, enhanced_nw, enhanced_sb)):
            # Determine current zone with small tolerance for floating point precision
            if nw > sb + 1e-6:
                zone = "safe"
            elif nw > 1e-6:
                zone = "warning"
            else:
                zone = "danger"

            # If zone changes, close previous segment
            if current_zone is not None and zone != current_zone:
                if segment_start < i:
                    segments[current_zone].append(
                        {
                            "ages": enhanced_ages[
                                segment_start : i + 1
                            ],  # Include transition point
                            "net_worth": enhanced_nw[segment_start : i + 1],
                            "safety_buffer": enhanced_sb[segment_start : i + 1],
                        }
                    )
                segment_start = i

            current_zone = zone

        # Close final segment
        if current_zone is not None and segment_start < len(enhanced_ages):
            segments[current_zone].append(
                {
                    "ages": enhanced_ages[segment_start:],
                    "net_worth": enhanced_nw[segment_start:],
                    "safety_buffer": enhanced_sb[segment_start:],
                }
            )

        return segments

    # Apply the same segment calculation as Stage 3
    segments = find_continuous_segments_with_intersections(
        ages, net_worth, safety_buffer
    )

    # Create fills for each segment with intersection points (like Stage 3)
    for zone, zone_segments in segments.items():
        for segment in zone_segments:
            seg_ages = segment["ages"]
            seg_nw = segment["net_worth"]
            seg_sb = segment["safety_buffer"]

            if len(seg_ages) < 2:  # Skip single points
                continue

            if zone == "safe":  # Green: between net worth and safety buffer
                fig.add_trace(
                    go.Scatter(
                        x=list(seg_ages) + list(seg_ages[::-1]),
                        y=list(seg_nw) + list(seg_sb[::-1]),
                        fill="toself",
                        fillcolor="rgba(144, 238, 144, 0.6)",
                        line=dict(color="rgba(255,255,255,0)"),
                        showlegend=False,
                        hoverinfo="skip",
                    )
                )
            elif zone == "warning":  # Yellow: between safety buffer and net worth
                fig.add_trace(
                    go.Scatter(
                        x=list(seg_ages) + list(seg_ages[::-1]),
                        y=list(seg_sb) + list(seg_nw[::-1]),
                        fill="toself",
                        fillcolor="rgba(255, 255, 0, 0.5)",
                        line=dict(color="rgba(255,255,255,0)"),
                        showlegend=False,
                        hoverinfo="skip",
                    )
                )
            elif zone == "danger":  # Red: between 0 and net worth
                zeros = [0] * len(seg_ages)
                fig.add_trace(
                    go.Scatter(
                        x=list(seg_ages) + list(seg_ages[::-1]),
                        y=zeros + list(seg_nw[::-1]),
                        fill="toself",
                        fillcolor="rgba(255, 107, 107, 0.7)",
                        line=dict(color="rgba(255,255,255,0)"),
                        showlegend=False,
                        hoverinfo="skip",
                    )
                )

    # Add safety buffer line
    buffer_line_label = t(
        "safety_buffer_line", months=user_profile.safety_buffer_months
    )
    fig.add_trace(
        go.Scatter(
            x=ages,
            y=safety_buffer,
            mode="lines",
            name=buffer_line_label,
            line=dict(color="green", width=2),
            hovertemplate=(f"<b>{buffer_line_label}:</b> %{{y:,.0f}}<extra></extra>"),
        )
    )

    # Add net worth line
    fig.add_trace(
        go.Scatter(
            x=ages,
            y=net_worth,
            mode="lines",
            name=t("net_worth_line"),
            line=dict(color="darkblue", width=3),
            hovertemplate=f"<b>{t('net_worth_line')}:</b> %{{y:,.0f}}<extra></extra>",
        )
    )

    # Add cash flow line
    fig.add_trace(
        go.Scatter(
            x=ages,
            y=cash_flow,
            mode="lines",
            name=t("annual_cash_flow_line"),
            line=dict(color="purple", width=2),
            hovertemplate=(
                f"<b>{t('annual_cash_flow_line')}:</b> %{{y:,.0f}}<extra></extra>"
            ),
        )
    )

    # Add reference lines
    fig.add_hline(y=0, line_dash="dash", line_color="red", line_width=2)
    fig.add_vline(
        x=user_profile.expected_fire_age,
        line_dash="dash",
        line_color="orange",
        line_width=3,
    )
    fig.add_vline(
        x=user_profile.legal_retirement_age,
        line_dash="dot",
        line_color="purple",
        line_width=2,
    )

    # Update layout
    fig.update_layout(
        title=dict(
            text=t("net_worth_trajectory_chart_title"),
            x=0.5,
            font=dict(size=16),
        ),
        xaxis=dict(
            title=t("chart_age_label"),
            showgrid=True,
            gridwidth=1,
            gridcolor="lightgray",
        ),
        yaxis=dict(
            title=t("chart_net_worth_label"),
            showgrid=True,
            gridwidth=1,
            gridcolor="lightgray",
        ),
        hovermode="x unified",
        legend=dict(orientation="v", yanchor="top", y=0.99, xanchor="left", x=1.02),
        width=900,
        height=500,
    )

    # Convert to HTML with proper Plotly config for standalone
    config = {
        "displayModeBar": True,
        "displaylogo": False,
        "modeBarButtonsToRemove": ["pan2d", "lasso2d"],
    }

    chart_html = fig.to_html(
        full_html=False,
        include_plotlyjs="inline",  # Include JS inline for standalone HTML
        config=config,
    )
    return f'<div class="chart-container">{chart_html}</div>'


def create_cash_flow_plotly_chart(chart_df: pd.DataFrame, t: Callable[..., str]) -> str:
    """Create annual cash flow Plotly chart as HTML div."""

    if chart_df.empty:
        return f'<div class="chart-container"><p>{t("cannot_generate_chart")}</p></div>'

    fig = go.Figure()

    # Add income and expense bars
    fig.add_trace(
        go.Bar(
            x=chart_df["Age"],
            y=chart_df["Total Income"],
            name=t("chart_total_income_label"),
            marker_color="green",
            opacity=0.7,
        )
    )

    fig.add_trace(
        go.Bar(
            x=chart_df["Age"],
            y=-chart_df["Total Expense"],  # Negative for visual clarity
            name=t("chart_total_expense_label"),
            marker_color="red",
            opacity=0.7,
        )
    )

    # Add net cash flow line
    fig.add_trace(
        go.Scatter(
            x=chart_df["Age"],
            y=chart_df["Net Cash Flow"],
            mode="lines+markers",
            name=t("chart_net_cash_flow_label"),
            line=dict(color="blue", width=3),
            marker=dict(size=6),
        )
    )

    # Add reference line at zero
    fig.add_hline(y=0, line_dash="dash", line_color="black", line_width=1)

    fig.update_layout(
        title=t("annual_cash_flow_chart"),
        xaxis_title=t("chart_age_label"),
        yaxis_title=t("chart_amount_label"),
        barmode="relative",
        hovermode="x unified",
        width=900,
        height=500,
    )

    # Convert to HTML with inline Plotly JS
    config = {
        "displayModeBar": True,
        "displaylogo": False,
        "modeBarButtonsToRemove": ["pan2d", "lasso2d"],
    }

    chart_html = fig.to_html(
        full_html=False,
        include_plotlyjs="inline",  # Include JS inline for standalone HTML
        config=config,
    )
    return f'<div class="chart-container">{chart_html}</div>'


def create_percentile_chart(
    percentiles: Dict[int, float], t: Callable[..., str]
) -> str:
    """Create percentile distribution chart."""

    fig = go.Figure(
        data=[
            go.Bar(
                x=[f"{p}%" for p in percentiles.keys()],
                y=list(percentiles.values()),
                marker_color=px.colors.sequential.Viridis[::2],
                text=[f"{v:,.0f}" for v in percentiles.values()],
                textposition="auto",
                hovertemplate=(
                    f"<b>{t('percentile')}:</b> %{{x}}<br>"
                    f"<b>{t('minimum_net_worth')}:</b> %{{y:,.0f}}<extra></extra>"
                ),
            )
        ]
    )

    fig.update_layout(
        title=t("minimum_net_worth_distribution"),
        xaxis_title=t("percentile"),
        yaxis_title=t("minimum_net_worth"),
        height=400,
        showlegend=False,
    )

    # Convert to HTML with inline Plotly JS
    config = {
        "displayModeBar": True,
        "displaylogo": False,
        "modeBarButtonsToRemove": ["pan2d", "lasso2d"],
    }

    chart_html = fig.to_html(
        full_html=False,
        include_plotlyjs="inline",  # Include JS inline for standalone HTML
        config=config,
    )
    return f'<div class="chart-container">{chart_html}</div>'


def get_embedded_css() -> str:
    """Return embedded CSS styles for the HTML report."""
    return """
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
                'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8f9fa;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .header h1 {
            color: #2c3e50;
            font-size: 2.5rem;
            margin-bottom: 10px;
        }

        .subtitle {
            color: #7f8c8d;
            font-size: 1.2rem;
            margin-bottom: 10px;
        }

        .timestamp {
            color: #95a5a6;
            font-size: 0.9rem;
        }

        .report-section {
            background: white;
            margin-bottom: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }

        .section-header {
            background: #3498db;
            color: white;
            padding: 15px 20px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background 0.3s;
        }

        .section-header:hover {
            background: #2980b9;
        }

        .section-header h2 {
            margin: 0;
            font-size: 1.4rem;
        }

        .toggle-icon {
            font-size: 1.2rem;
            transition: transform 0.3s;
        }

        .section-content {
            padding: 20px;
            display: block;
        }

        .section-content.collapsed {
            display: none;
        }

        .profile-grid, .metrics-row {
            display: grid;
            gap: 20px;
            margin-bottom: 20px;
        }

        .profile-grid {
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        }

        .metrics-row {
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        }

        .profile-item, .metric-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 5px;
        }

        .profile-item label, .metric-item label {
            font-weight: 600;
            color: #495057;
        }

        .profile-item value, .metric-item value {
            font-weight: bold;
            color: #212529;
        }

        .success {
            color: #28a745;
        }

        .warning {
            color: #ffc107;
        }

        .error {
            color: #dc3545;
        }

        .info {
            color: #17a2b8;
        }

        .large {
            font-size: 1.5rem;
        }

        .recommendation-item {
            background: #e8f5e8;
            padding: 15px;
            margin-bottom: 15px;
            border-radius: 8px;
            border-left: 4px solid #28a745;
        }

        .recommendation-item h4 {
            color: #155724;
            margin-bottom: 8px;
        }

        .chart-container {
            margin: 20px 0;
            background: white;
            border-radius: 8px;
            padding: 10px;
        }

        .chart-description {
            color: #6c757d;
            margin-bottom: 15px;
            font-style: italic;
        }

        .table-container {
            overflow-x: auto;
            margin: 20px 0;
        }

        .data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.9rem;
        }

        .data-table th,
        .data-table td {
            padding: 8px 12px;
            border: 1px solid #dee2e6;
            text-align: right;
        }

        .data-table th {
            background: #f8f9fa;
            font-weight: 600;
            color: #495057;
        }

        .data-table tbody tr:nth-child(even) {
            background: #f8f9fa;
        }

        .simulation-info {
            background: #e9ecef;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }

        .info-box {
            background: #d1ecf1;
            border: 1px solid #bee5eb;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }

        .chart-and-table {
            display: grid;
            grid-template-columns: 1fr 2fr;
            gap: 20px;
            margin: 20px 0;
        }

        .percentiles-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.9rem;
        }

        .percentiles-table th,
        .percentiles-table td {
            padding: 8px 12px;
            border: 1px solid #dee2e6;
            text-align: right;
        }

        .percentiles-table th {
            background: #f8f9fa;
            font-weight: 600;
        }

        .black-swan-analysis {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #dee2e6;
        }

        .black-swan-events ul {
            list-style-type: disc;
            margin-left: 20px;
            margin-bottom: 20px;
        }

        .black-swan-events li {
            margin-bottom: 5px;
        }

        .event-statistics {
            margin: 20px 0;
        }

        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }

            .header h1 {
                font-size: 2rem;
            }

            .chart-and-table {
                grid-template-columns: 1fr;
            }

            .metrics-row {
                grid-template-columns: 1fr;
            }
        }
    """


def get_embedded_javascript() -> str:
    """Return embedded JavaScript for the HTML report."""
    return """
        function toggleSection(sectionId) {
            const content = document.getElementById(sectionId);
            const header = content.previousElementSibling;
            const icon = header.querySelector('.toggle-icon');

            if (content.style.display === 'none') {
                content.style.display = 'block';
                icon.textContent = '▼';
                icon.style.transform = 'rotate(0deg)';
            } else {
                content.style.display = 'none';
                icon.textContent = '▶';
                icon.style.transform = 'rotate(-90deg)';
            }
        }

        // Initialize all sections as expanded by default
        document.addEventListener('DOMContentLoaded', function() {
            const sections = document.querySelectorAll('.section-content');
            sections.forEach(section => {
                section.style.display = 'block';
            });

            const icons = document.querySelectorAll('.toggle-icon');
            icons.forEach(icon => {
                icon.textContent = '▼';
                icon.style.transform = 'rotate(0deg)';
            });
        });

        // Add smooth transitions
        document.addEventListener('DOMContentLoaded', function() {
            const style = document.createElement('style');
            style.textContent = `
                .section-content {
                    transition: all 0.3s ease-in-out;
                }
            `;
            document.head.appendChild(style);
        });
    """
