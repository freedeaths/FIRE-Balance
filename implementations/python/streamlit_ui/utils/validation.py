"""
Validation utilities for FIRE planner Streamlit UI.

This module provides real-time validation for user inputs, especially
ensuring consistency between UserProfile and IncomeExpenseItem data.
"""

from typing import List, Tuple

from core.data_models import IncomeExpenseItem, UserProfile
from core.i18n import I18nManager


def validate_items_against_profile(
    profile: UserProfile,
    income_items: List[IncomeExpenseItem],
    expense_items: List[IncomeExpenseItem],
) -> List[str]:
    """Validate all income/expense items against user profile constraints.

    Checks:
    1. start_age <= end_age for each item
    2. start_age >= profile.current_age for each item
    3. end_age <= profile.life_expectancy for each item

    Args:
        profile: User profile with age constraints
        income_items: List of income items to validate
        expense_items: List of expense items to validate

    Returns:
        List of error messages. Empty list means no errors.
    """
    errors = []

    i18n = I18nManager()
    for items, item_type in [
        (income_items, i18n.t("income_item")),
        (expense_items, i18n.t("expense_item")),
    ]:
        for i, item in enumerate(items):
            f"{item_type}项 '{item.name}'"

            # Check: start_age <= end_age (if end_age exists)
            if item.end_age and item.start_age > item.end_age:
                errors.append(
                    i18n.t(
                        "item_start_age_too_large",
                        itemType=item_type,
                        itemName=item.name,
                        startAge=item.start_age,
                        lifeExpectancy=item.end_age,
                    )
                )

            # Check: start_age >= current_age
            if item.start_age < profile.current_age:
                errors.append(
                    i18n.t(
                        "item_start_age_too_small",
                        itemType=item_type,
                        itemName=item.name,
                        startAge=item.start_age,
                        currentAge=profile.current_age,
                    )
                )

            # Check: end_age <= life_expectancy (if end_age exists)
            if item.end_age and item.end_age > profile.life_expectancy:
                errors.append(
                    i18n.t(
                        "item_end_age_too_large",
                        itemType=item_type,
                        itemName=item.name,
                        endAge=item.end_age,
                        lifeExpectancy=profile.life_expectancy,
                    )
                )

            # Check: start_age <= life_expectancy (basic sanity)
            if item.start_age > profile.life_expectancy:
                errors.append(
                    i18n.t(
                        "item_start_age_too_large",
                        itemType=item_type,
                        itemName=item.name,
                        startAge=item.start_age,
                        lifeExpectancy=profile.life_expectancy,
                    )
                )

    return errors


def validate_profile_age_progression(profile: UserProfile) -> List[str]:
    """Validate UserProfile age progression logic.

    Checks that ages follow logical progression:
    current_age <= expected_fire_age <= legal_retirement_age <= life_expectancy

    Args:
        profile: UserProfile to validate

    Returns:
        List of error messages. Empty list means no errors.
    """
    errors = []
    i18n = I18nManager()

    current = profile.current_age
    fire = profile.expected_fire_age
    retirement = profile.legal_retirement_age
    life = profile.life_expectancy

    # Check age progression chain
    if current > fire:
        errors.append(i18n.t("fire_age_too_small", fireAge=fire, currentAge=current))

    if fire > retirement:
        errors.append(
            i18n.t(
                "legal_retirement_age_invalid", retirementAge=retirement, fireAge=fire
            )
        )

    if retirement > life:
        errors.append(
            i18n.t(
                "life_expectancy_too_small",
                lifeExpectancy=life,
                retirementAge=retirement,
            )
        )

    # Additional reasonable bounds
    if life - current < 10:
        errors.append(
            i18n.t("life_span_too_short", lifeExpectancy=life, currentAge=current)
        )

    return errors


def get_all_validation_errors(
    profile: UserProfile,
    income_items: List[IncomeExpenseItem],
    expense_items: List[IncomeExpenseItem],
) -> Tuple[List[str], bool]:
    """Get all validation errors for profile and items.

    Args:
        profile: User profile to validate
        income_items: Income items to validate
        expense_items: Expense items to validate

    Returns:
        Tuple of (error_list, has_errors)
    """
    all_errors = []

    # Validate profile first
    profile_errors = validate_profile_age_progression(profile)
    all_errors.extend(profile_errors)

    # Only validate items if profile is valid (avoids cascade errors)
    if not profile_errors:
        item_errors = validate_items_against_profile(
            profile, income_items, expense_items
        )
        all_errors.extend(item_errors)

    return all_errors, len(all_errors) > 0


def suggest_auto_fix(
    profile: UserProfile,
    income_items: List[IncomeExpenseItem],
    expense_items: List[IncomeExpenseItem],
) -> List[str]:
    """Suggest automatic fixes for common validation issues.

    Args:
        profile: User profile
        income_items: Income items
        expense_items: Expense items

    Returns:
        List of suggested fixes in human-readable format
    """
    suggestions: list[str] = []
    i18n = I18nManager()
    errors, _ = get_all_validation_errors(profile, income_items, expense_items)

    if not errors:
        return suggestions

    # Analyze common patterns and suggest fixes
    for error in errors:
        if "start age" in error.lower() and "current age" in error.lower():
            suggestions.append(i18n.t("suggestion_adjust_start_age"))
        elif "end age" in error.lower() and "life expectancy" in error.lower():
            suggestions.append(i18n.t("suggestion_adjust_end_age"))
        elif "fire" in error.lower() and "current age" in error.lower():
            suggestions.append(i18n.t("suggestion_adjust_fire_age"))

    # Remove duplicates
    suggestions = list(set(suggestions))

    return suggestions
