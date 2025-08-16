"""Simple recommendation renderer using i18n keys."""

from typing import Any, Callable, Dict


def render_recommendation(
    rec_dict: Dict[str, Any], t: Callable[..., str], rec_number: int
) -> str:
    """Render a recommendation dict using i18n keys.

    Args:
        rec_dict: Dict with 'type', 'params', 'is_achievable', etc.
        t: Translation function
        rec_number: Recommendation number for display

    Returns:
        Formatted content string
    """
    achievable_status = "✅" if rec_dict.get("is_achievable", True) else "❌"
    rec_type = rec_dict["type"]
    params = rec_dict["params"]

    # Map recommendation types to i18n keys and render with parameters
    if rec_type == "early_retirement":
        age = params["age"]
        years = params["years"]
        title = f"Early Retirement at Age {age}"
        description = (
            f"Based on your current financial plan, you can retire "
            f"{years} year(s) earlier at age {age}."
        )

    elif rec_type == "delayed_retirement":
        title = t("delayed_retirement_title", age=params["age"])
        description = t(
            "delayed_retirement_description", years=params["years"], age=params["age"]
        )

    elif rec_type == "delayed_retirement_not_feasible":
        title = t("delayed_retirement_not_feasible_title")
        description = t(
            "delayed_retirement_not_feasible_description", age=params["age"]
        )

    elif rec_type == "increase_income":
        title = t("increase_income_title", percentage=params["percentage"])
        description = t(
            "increase_income_description",
            fireAge=params["fire_age"],
            percentage=params["percentage"],
        )

    elif rec_type == "reduce_expenses":
        title = t("reduce_expenses_title", percentage=params["percentage"])
        description = t(
            "reduce_expenses_description",
            fireAge=params["fire_age"],
            percentage=params["percentage"],
        )
    else:
        # Fallback for unknown recommendation types
        title = f"Unknown Recommendation Type: {rec_type}"
        description = f"Parameters: {params}"

    # Combine title and description in one content block
    combined_content = (
        f"{achievable_status} **"
        f"{t('recommendation_number', number=rec_number, content=title)}**"
    )
    combined_content += f"\n\n{description}"

    # Add Monte Carlo success rate if available
    monte_carlo_rate = rec_dict.get("monte_carlo_success_rate")
    if monte_carlo_rate is not None:
        combined_content += f"\n\n{t('success_rate')}: {monte_carlo_rate:.1%}"

    return combined_content
