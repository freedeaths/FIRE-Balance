# UI components for Stage 1: Basic Data Input.

from typing import Callable, List

import streamlit as st

from core.data_models import IncomeExpenseItem, ItemFrequency
from streamlit_ui.utils.common import ensure_unique_name


def validate_stage1_for_progression(t: Callable[..., str]) -> tuple[bool, List[str]]:
    """Validate Stage 1 data when user tries to progress to next stage.

    Returns:
        (is_valid, error_messages): Tuple of validation result and error list
    """
    profile = st.session_state.user_profile
    errors = []

    from datetime import datetime

    current_year = datetime.now().year

    # Age progression logic validation
    calculated_age = current_year - profile.birth_year

    # Birth year validation
    if profile.birth_year > current_year:
        errors.append(
            t(
                "birth_year_future",
                birthYear=profile.birth_year,
                currentYear=current_year,
            )
        )
    elif calculated_age < 18:
        errors.append(
            t(
                "birth_year_too_recent",
                birthYear=profile.birth_year,
                currentAge=calculated_age,
            )
        )
    elif calculated_age > 100:
        errors.append(
            t(
                "birth_year_too_old",
                birthYear=profile.birth_year,
                currentAge=calculated_age,
            )
        )

    # Age progression validation
    if profile.expected_fire_age < profile.current_age:
        errors.append(
            t(
                "fire_age_too_small",
                fireAge=profile.expected_fire_age,
                currentAge=profile.current_age,
            )
        )

    if profile.legal_retirement_age < profile.expected_fire_age:
        errors.append(
            t(
                "legal_retirement_age_invalid",
                retirementAge=profile.legal_retirement_age,
                fireAge=profile.expected_fire_age,
            )
        )

    if profile.life_expectancy < profile.legal_retirement_age:
        errors.append(
            t(
                "life_expectancy_too_small",
                lifeExpectancy=profile.life_expectancy,
                retirementAge=profile.legal_retirement_age,
            )
        )

    if profile.life_expectancy - profile.current_age < 10:
        errors.append(
            t(
                "life_span_too_short",
                lifeExpectancy=profile.life_expectancy,
                currentAge=profile.current_age,
            )
        )

    # Portfolio allocation validation is kept real-time, not included in lazy validation

    # Income/expense items age validation
    all_items = st.session_state.incomes + st.session_state.expenses

    for item in all_items:
        item_type = t("income_item") if item.is_income else t("expense_item")

        # Start age validation
        if item.start_age < profile.current_age:
            errors.append(
                t(
                    "item_start_age_too_small",
                    itemType=item_type,
                    itemName=item.name,
                    startAge=item.start_age,
                    currentAge=profile.current_age,
                )
            )
        elif item.start_age > profile.life_expectancy:
            errors.append(
                t(
                    "item_start_age_too_large",
                    itemType=item_type,
                    itemName=item.name,
                    startAge=item.start_age,
                    lifeExpectancy=profile.life_expectancy,
                )
            )

        # End age validation (for recurring items)
        if item.frequency == ItemFrequency.RECURRING and item.end_age:
            if item.end_age > profile.life_expectancy:
                errors.append(
                    t(
                        "item_end_age_too_large",
                        itemType=item_type,
                        itemName=item.name,
                        endAge=item.end_age,
                        lifeExpectancy=profile.life_expectancy,
                    )
                )
            elif item.end_age < item.start_age:
                errors.append(t("age_range_invalid") + f" ({item.name})")

    return len(errors) == 0, errors


def render_stage1(t: Callable[..., str]) -> bool:
    """Renders the UI for Stage 1: Basic Input."""
    st.header(t("stage1_title"))
    st.write(t("stage1_description"))

    # Add current economic conditions note
    st.info(t("economic_conditions_note"))

    # Initialize validation state - only for portfolio allocation (real-time)
    has_portfolio_error = False

    profile = st.session_state.user_profile
    with st.expander(t("user_information_header"), expanded=True):

        # Row 1: Birth Year, FIRE Age, Legal Retirement Age, Life Expectancy
        cols1 = st.columns(4)

        # Column 1: Birth year with inline validation
        with cols1[0]:
            birth_year_key = "profile_birth_year"
            if birth_year_key not in st.session_state:
                st.session_state[birth_year_key] = int(profile.birth_year)

            st.number_input(t("birth_year"), key=birth_year_key, step=1, format="%d")

            new_birth_year = st.session_state[birth_year_key]
            if new_birth_year != profile.birth_year:
                profile.birth_year = new_birth_year

            # Birth year validation moved to lazy validation (on Next click)

        # Column 2: Expected FIRE age
        with cols1[1]:
            fire_age_key = "profile_expected_fire_age"
            if fire_age_key not in st.session_state:
                st.session_state[fire_age_key] = int(profile.expected_fire_age)

            st.number_input(
                t("expected_fire_age"), key=fire_age_key, step=1, format="%d"
            )

            new_fire_age = st.session_state[fire_age_key]
            if new_fire_age != profile.expected_fire_age:
                profile.expected_fire_age = new_fire_age

            # FIRE age validation moved to lazy validation (on Next click)

        # Column 3: Legal retirement age
        with cols1[2]:
            retirement_age_key = "profile_legal_retirement_age"
            if retirement_age_key not in st.session_state:
                st.session_state[retirement_age_key] = int(profile.legal_retirement_age)

            st.number_input(
                t("legal_retirement_age"),
                key=retirement_age_key,
                step=1,
                format="%d",
                help=t("legal_retirement_age_help"),
            )

            new_retirement_age = st.session_state[retirement_age_key]
            if new_retirement_age != profile.legal_retirement_age:
                profile.legal_retirement_age = new_retirement_age

            # Legal retirement age validation moved to lazy validation (on Next click)

        # Column 4: Life expectancy
        with cols1[3]:
            life_expectancy_key = "profile_life_expectancy"
            if life_expectancy_key not in st.session_state:
                st.session_state[life_expectancy_key] = int(profile.life_expectancy)

            st.number_input(
                t("life_expectancy"), key=life_expectancy_key, step=1, format="%d"
            )

            new_life_expectancy = st.session_state[life_expectancy_key]
            if new_life_expectancy != profile.life_expectancy:
                profile.life_expectancy = new_life_expectancy

            # Life expectancy validation moved to lazy validation (on Next click)

        # Row 2: Current Net Worth, Inflation Rate, Safety Buffer Months
        cols2 = st.columns(3)

        # Column 1: Current net worth
        with cols2[0]:
            net_worth_key = "profile_current_net_worth"
            if net_worth_key not in st.session_state:
                st.session_state[net_worth_key] = int(profile.current_net_worth)

            st.number_input(
                t("current_net_worth"), step=1000, format="%d", key=net_worth_key
            )

            new_net_worth = st.session_state[net_worth_key]
            if new_net_worth != profile.current_net_worth:
                profile.current_net_worth = new_net_worth

        # Column 2: Inflation rate
        with cols2[1]:
            inflation_key = "profile_inflation_rate"
            if inflation_key not in st.session_state:
                st.session_state[inflation_key] = profile.inflation_rate

            st.number_input(t("inflation_rate"), step=0.5, key=inflation_key)

            new_inflation = st.session_state[inflation_key]
            if new_inflation != profile.inflation_rate:
                profile.inflation_rate = new_inflation

        # Column 3: Safety buffer months
        with cols2[2]:
            safety_buffer_key = "profile_safety_buffer_months"
            if safety_buffer_key not in st.session_state:
                st.session_state[safety_buffer_key] = int(profile.safety_buffer_months)

            st.number_input(
                t("safety_buffer_months"),
                key=safety_buffer_key,
                step=1,
                format="%d",
                help=t("safety_buffer_months_help"),
            )

            new_safety_buffer = st.session_state[safety_buffer_key]
            if new_safety_buffer != profile.safety_buffer_months:
                profile.safety_buffer_months = new_safety_buffer

    # --- Investment Portfolio Settings ---
    with st.expander(t("investment_portfolio_settings"), expanded=True):
        st.write(t("portfolio_configure_description"))
        st.info(t("portfolio_allocation_notice"))

        # Create editable portfolio configuration with more compact layout
        portfolio_changed = False
        total_allocation = 0.0

        # Header row
        header_cols = st.columns([2.5, 1, 1])
        header_cols[0].markdown(f"**{t('asset_class')}**")
        header_cols[1].markdown(f"**{t('allocation_percentage')}**")
        header_cols[2].markdown(f"**{t('expected_return')}**")

        for i, asset in enumerate(profile.portfolio.asset_classes):
            cols = st.columns([2.5, 1, 1])

            # Asset name with help text (read-only, more compact)
            cols[0].text_input(
                t("asset_class"),  # Hidden label for accessibility
                value=f"{asset.display_name}",
                disabled=True,
                key=f"asset_name_{i}",
                help=t(
                    "liquidity_volatility",
                    liquidity=asset.liquidity_level.value,
                    volatility=asset.volatility,
                ),
                label_visibility="collapsed",
            )

            # Allocation percentage (editable) - use session_state pattern
            allocation_key = f"asset_allocation_{i}"
            if allocation_key not in st.session_state:
                st.session_state[allocation_key] = float(asset.allocation_percentage)

            new_allocation = cols[1].number_input(
                t("allocation_percentage"),  # Hidden label for accessibility
                step=1.0,
                key=allocation_key,
                label_visibility="collapsed",
            )

            if new_allocation != asset.allocation_percentage:
                asset.allocation_percentage = new_allocation
                portfolio_changed = True

            # Expected return (editable) - use session_state pattern
            return_key = f"asset_return_{i}"
            if return_key not in st.session_state:
                st.session_state[return_key] = float(asset.expected_return)

            new_return = cols[2].number_input(
                t("expected_return"),  # Hidden label for accessibility
                step=0.1,
                key=return_key,
                label_visibility="collapsed",
            )

            if new_return != asset.expected_return:
                asset.expected_return = new_return
                portfolio_changed = True

            total_allocation += new_allocation

        # Compact summary row
        summary_cols = st.columns([1, 1])

        # Keep allocation sum validation in real-time (as per issue requirement)
        with summary_cols[0]:
            if (
                abs(total_allocation - 100.0) > 0.01
            ):  # Allow small rounding tolerance for UI
                allocation_error = (
                    t("allocation_total", total=total_allocation)
                    + " "
                    + t("allocation_required")
                )
                st.error(f"⚠️ {allocation_error}")
                has_portfolio_error = True
            else:
                st.success(t("allocation_balanced", total=total_allocation))

        # Show portfolio expected return
        with summary_cols[1]:
            weighted_return = sum(
                (asset.allocation_percentage / 100.0) * asset.expected_return
                for asset in profile.portfolio.asset_classes
            )
            st.metric(
                t("weighted_average_return"),
                f"{weighted_return:.2f}%",
                help=t("weighted_average_return_help"),
            )

        # Clear planner if portfolio changed to force recalculation
        if portfolio_changed:
            if "planner" in st.session_state:
                del st.session_state.planner

    # --- Item Editor --- #
    def render_item_editor(
        item_list: List[IncomeExpenseItem], item_type: str, t: Callable[..., str]
    ) -> None:

        # Add CSS to make inputs more compact
        st.markdown(
            """
        <style>
        .stNumberInput > div > div > input {
            min-width: 60px !important;
        }
        .stTextInput > div > div > input {
            min-width: 100px !important;
        }
        .stSelectbox > div > div > div {
            min-width: 80px !important;
        }
        </style>
        """,
            unsafe_allow_html=True,
        )

        for i, item in enumerate(item_list):
            key_prefix = f"{item_type}_{item.id}"
            cols = st.columns([2.5, 1.5, 1, 1, 1, 1, 0.5])

            new_name = cols[0].text_input(
                t("item_name"), value=item.name, key=f"{key_prefix}_name"
            )
            if new_name != item.name:
                all_items = st.session_state.incomes + st.session_state.expenses
                item.name = ensure_unique_name(
                    new_name, all_items, item_to_exclude=item
                )
                # Clear cached data when item names change to force regeneration
                if "planner" in st.session_state:
                    del st.session_state.planner

            # Amount - use session_state pattern
            amount_key = f"{key_prefix}_amount"
            if amount_key not in st.session_state:
                st.session_state[amount_key] = int(item.after_tax_amount_per_period)

            cols[1].number_input(
                t("item_amount"), step=1000, format="%d", key=amount_key
            )

            new_amount = st.session_state[amount_key]
            if new_amount != item.after_tax_amount_per_period:
                item.after_tax_amount_per_period = new_amount
                if "planner" in st.session_state:
                    del st.session_state.planner

            freq_options = [f.value for f in ItemFrequency]
            old_frequency = item.frequency
            selected_freq = cols[2].selectbox(
                t("item_frequency"),
                options=freq_options,
                index=freq_options.index(item.frequency),
                format_func=lambda x: t(x),
                key=f"{key_prefix}_freq",
            )
            item.frequency = ItemFrequency(selected_freq)
            if old_frequency != item.frequency:
                if "planner" in st.session_state:
                    del st.session_state.planner
                # Force rerun when frequency changes to update column
                # visibility immediately
                st.rerun()

            # 列3：起始年龄
            start_age_key = f"{key_prefix}_start_age"
            if start_age_key not in st.session_state:
                st.session_state[start_age_key] = int(item.start_age)

            cols[3].number_input(
                t("item_start_age"), key=start_age_key, step=1, format="%d"
            )

            new_start_age = st.session_state[start_age_key]
            if new_start_age != item.start_age:
                item.start_age = new_start_age
                st.session_state["_validation_needs_refresh"] = True
                if "planner" in st.session_state:
                    del st.session_state.planner

            # Start age validation moved to lazy validation (on Next click)

            # 列4：结束年龄（仅recurring）
            if item.frequency == ItemFrequency.RECURRING:
                end_age_key = f"{key_prefix}_end_age"
                end_age_val = item.end_age if item.end_age else item.start_age + 1

                if end_age_key not in st.session_state:
                    st.session_state[end_age_key] = int(end_age_val)

                cols[4].number_input(
                    t("item_end_age"), key=end_age_key, step=1, format="%d"
                )

                new_end_age = st.session_state[end_age_key]
                if new_end_age != item.end_age:
                    item.end_age = new_end_age
                    st.session_state["_validation_needs_refresh"] = True
                    if "planner" in st.session_state:
                        del st.session_state.planner

                # End age validation moved to lazy validation (on Next click)
            else:
                item.end_age = None
                cols[4].empty()

            # 列5：增长率（仅recurring）
            if item.frequency == ItemFrequency.RECURRING:
                # Growth rate - use session_state pattern
                growth_key = f"{key_prefix}_growth"
                if growth_key not in st.session_state:
                    st.session_state[growth_key] = item.annual_growth_rate

                cols[5].number_input(t("item_growth_rate"), step=0.1, key=growth_key)

                new_growth_rate = st.session_state[growth_key]
                if new_growth_rate != item.annual_growth_rate:
                    item.annual_growth_rate = new_growth_rate
                    if "planner" in st.session_state:
                        del st.session_state.planner
            else:
                item.annual_growth_rate = 0.0
                cols[5].empty()

            # 列6：删除按钮
            if cols[6].button("🗑️", key=f"{key_prefix}_delete"):
                item_list.pop(i)
                st.rerun()

    # --- Income & Expense Sections --- #
    with st.expander(t("income_items_header"), expanded=True):
        render_item_editor(st.session_state.incomes, "income", t)
        if st.button(t("add_income_item")):
            all_items = st.session_state.incomes + st.session_state.expenses
            new_name = ensure_unique_name(t("new_income"), all_items)
            st.session_state.incomes.append(
                IncomeExpenseItem(
                    name=new_name,
                    after_tax_amount_per_period=0,
                    start_age=st.session_state.user_profile.current_age,
                    end_age=st.session_state.user_profile.life_expectancy,
                    annual_growth_rate=0.0,
                    frequency=ItemFrequency.RECURRING,
                    is_income=True,
                )
            )
            st.rerun()

    with st.expander(t("expense_items_header"), expanded=True):
        render_item_editor(st.session_state.expenses, "expense", t)
        if st.button(t("add_expense_item")):
            all_items = st.session_state.incomes + st.session_state.expenses
            new_name = ensure_unique_name(t("new_expense"), all_items)
            st.session_state.expenses.append(
                IncomeExpenseItem(
                    name=new_name,
                    after_tax_amount_per_period=0,
                    start_age=st.session_state.user_profile.current_age,
                    end_age=st.session_state.user_profile.life_expectancy,
                    annual_growth_rate=0.0,
                    frequency=ItemFrequency.RECURRING,
                    is_income=False,
                )
            )
            st.rerun()

    # Only return portfolio error state (real-time validation)
    # Other validations are now handled by validate_stage1_for_progression
    return has_portfolio_error
