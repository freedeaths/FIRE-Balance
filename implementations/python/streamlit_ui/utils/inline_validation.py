"""
Inline validation utilities that mimic Streamlit's native validation style
but support i18n and complex business logic validation.
"""

from typing import Any, Callable, Optional

import streamlit as st


def show_inline_error(message: str, container: Any = None) -> None:
    """
    Display an inline error message that mimics Streamlit's native validation style.

    Args:
        message: Error message to display
        container: Streamlit container to display in (optional)
    """
    if container is None:
        container = st

    container.markdown(
        f"""
        <div style="
            background-color: #FFF2CC;
            border: 1px solid #FFB366;
            border-radius: 4px;
            padding: 6px 12px;
            margin-top: 4px;
            margin-bottom: 8px;
            font-size: 14px;
            color: #8B4513;
            display: flex;
            align-items: center;
        ">
            <span style="
                background-color: #FF8C00;
                color: white;
                border-radius: 3px;
                padding: 2px 6px;
                font-weight: bold;
                font-size: 12px;
                margin-right: 8px;
            ">!</span>
            {message}
        </div>
        """,
        unsafe_allow_html=True,
    )


def show_inline_success(message: str, container: Any = None) -> None:
    """
    Display an inline success message similar to error style but green.

    Args:
        message: Success message to display
        container: Streamlit container to display in (optional)
    """
    if container is None:
        container = st

    container.markdown(
        f"""
        <div style="
            background-color: #E8F5E8;
            border: 1px solid #4CAF50;
            border-radius: 4px;
            padding: 6px 12px;
            margin-top: 4px;
            margin-bottom: 8px;
            font-size: 14px;
            color: #2E7D32;
            display: flex;
            align-items: center;
        ">
            <span style="
                background-color: #4CAF50;
                color: white;
                border-radius: 3px;
                padding: 2px 6px;
                font-weight: bold;
                font-size: 12px;
                margin-right: 8px;
            ">✓</span>
            {message}
        </div>
        """,
        unsafe_allow_html=True,
    )


def validate_field_inline(
    value: Any,
    field_name: str,
    validation_func: Callable[[Any], bool],
    error_message: str,
    container: Any = None,
) -> bool:
    """
    Validate a field and show inline error if validation fails.

    Args:
        value: Value to validate
        field_name: Name of the field being validated
        validation_func: Function that returns True if valid, False if invalid
        error_message: Message to show if validation fails
        container: Container to show error in

    Returns:
        True if valid, False if invalid
    """
    try:
        if not validation_func(value):
            show_inline_error(error_message, container)
            return False
        return True
    except Exception:
        show_inline_error(error_message, container)
        return False


def validate_start_age_inline(
    start_age: int,
    current_age: int,
    life_expectancy: int,
    container: Any = None,
    t: Optional[Callable[..., str]] = None,
) -> bool:
    """
    Validate start age with inline error display.

    Args:
        start_age: Start age value
        current_age: User's current age
        life_expectancy: User's life expectancy
        container: Container to show errors in
        t: Translation function

    Returns:
        True if valid, False if has errors
    """
    if t is None:
        # Fallback to English messages if no translation function provided
        def t(key: str, **kwargs: Any) -> str:
            messages = {
                "item_start_age_too_small": (
                    f"Start age ({kwargs.get('startAge')}) cannot be less than "
                    f"current age ({kwargs.get('currentAge')})"
                ),
                "item_start_age_too_large": (
                    f"Start age ({kwargs.get('startAge')}) cannot be greater "
                    f"than life expectancy ({kwargs.get('lifeExpectancy')})"
                ),
            }
            return messages.get(key, key)

    has_errors = False

    # Check: start_age >= current_age
    if start_age < current_age:
        show_inline_error(
            t("item_start_age_too_small", startAge=start_age, currentAge=current_age),
            container,
        )
        has_errors = True

    # Check: start_age <= life_expectancy
    if start_age > life_expectancy:
        show_inline_error(
            t(
                "item_start_age_too_large",
                startAge=start_age,
                lifeExpectancy=life_expectancy,
            ),
            container,
        )
        has_errors = True

    return not has_errors


def validate_end_age_inline(
    start_age: int,
    end_age: int,
    life_expectancy: int,
    container: Any = None,
    t: Optional[Callable[..., str]] = None,
) -> bool:
    """
    Validate end age with inline error display.

    Args:
        start_age: Start age value
        end_age: End age value
        life_expectancy: User's life expectancy
        container: Container to show errors in
        t: Translation function

    Returns:
        True if valid, False if has errors
    """
    if t is None:
        # Fallback to English messages if no translation function provided
        def t(key: str, **kwargs: Any) -> str:
            messages = {
                "item_end_age_too_large": (
                    f"End age ({kwargs.get('endAge')}) cannot be greater than "
                    f"life expectancy ({kwargs.get('lifeExpectancy')})"
                ),
                "age_range_invalid": "End age must be greater than start age",
            }
            return messages.get(key, key)

    has_errors = False

    # Check: end_age <= life_expectancy
    if end_age > life_expectancy:
        show_inline_error(
            t("item_end_age_too_large", endAge=end_age, lifeExpectancy=life_expectancy),
            container,
        )
        has_errors = True

    # Check: end_age > start_age
    if end_age < start_age:
        show_inline_error(t("age_range_invalid"), container)
        has_errors = True

    return not has_errors
