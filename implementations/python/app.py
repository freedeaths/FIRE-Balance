#!/usr/bin/env python3
"""
FIRE Balance Calculator - Streamlit Web App

Main Streamlit application for the FIRE Balance Calculator.
This provides a three-stage interface for financial independence planning.

For Streamlit Community Cloud deployment, run from repository root:
streamlit run implementations/python/streamlit_app.py
"""

import json
from datetime import datetime
from typing import Optional

import streamlit as st

from core.data_models import IncomeExpenseItem, UserProfile
from core.i18n import I18nManager
from core.planner import FIREPlanner
from streamlit_ui.ui.stage1_input import render_stage1
from streamlit_ui.ui.stage2_results import render_stage2
from streamlit_ui.ui.stage3_analysis import render_stage3
from streamlit_ui.utils.locale_detection import initialize_language_with_detection
from streamlit_ui.utils.session_manager import (
    get_session_data_as_dict,
    load_session_data_from_dict,
)


def render_top_bar_minimal(i18n: I18nManager) -> None:
    """Minimal top bar with only title and language selection."""
    # First row: Title only (centered)
    st.markdown(
        f"<h1 style='text-align: center; margin: 0;'>{i18n.t('app_title')}</h1>",
        unsafe_allow_html=True,
    )
    caption_text = i18n.t("app_caption")
    caption_html = (
        f"<p style='text-align: center; color: gray; margin: 0 0 20px 0;'>"
        f"{caption_text}</p>"
    )
    st.markdown(caption_html, unsafe_allow_html=True)

    # Second row: Only language selection
    lang_col, empty_col = st.columns([1, 1])

    with lang_col:
        # Use original selectbox approach for language
        lang_options = {"EN": "en", "中文": "zh-CN", "日本語": "ja"}
        selected_lang_display = st.selectbox(
            label=i18n.t("language"),
            options=list(lang_options.keys()),
            index=list(lang_options.values()).index(st.session_state.lang),
            key="top_lang_select_minimal",
        )
        selected_lang_code = lang_options[selected_lang_display]
        if selected_lang_code != st.session_state.lang:
            st.session_state.lang = selected_lang_code
            st.rerun()

    with empty_col:
        st.write("")  # Empty column for now

    st.markdown("---")  # Separator after top bar


def render_navigation_controls(i18n: I18nManager) -> None:
    """Render navigation controls at the bottom of the page."""
    current_stage: int = st.session_state.stage
    has_validation_errors = st.session_state.get("has_validation_errors", False)

    # Simple navigation: can only go to adjacent stages (difference of 1) and no errors
    def can_navigate_to(target_stage: int) -> bool:
        if target_stage == current_stage:
            return True  # Always allow staying on current stage
        if has_validation_errors:
            return False  # Block navigation if there are errors
        if target_stage == 3:
            # Can go to Stage 3 if we have basic data (user_profile and items)
            # The planner will be created automatically in Stage 2/3 if needed
            has_basic_data = (
                st.session_state.get("user_profile") is not None
                and st.session_state.get("incomes")
                and st.session_state.get("expenses")
            )
            if not has_basic_data:
                return False
        return bool(abs(target_stage - current_stage) <= 1)

    st.markdown("---")
    st.subheader(f"📍 {i18n.t('navigation')}")

    # Use the original direct navigation button logic (like the original sidebar)
    col1, col2, col3 = st.columns(3)

    with col1:
        # Stage 1 button
        if st.button(
            f"{i18n.t('nav_stage1')}",
            use_container_width=True,
            type="primary" if current_stage == 1 else "secondary",
            disabled=not can_navigate_to(1),
            key="bottom_nav_stage1",
        ):
            # Clear all cached data when returning to Stage 1
            if current_stage != 1:
                st.session_state.pop("planner", None)
                st.session_state.pop("final_results", None)
            st.session_state.stage = 1
            st.rerun()

    with col2:
        # Stage 2 button
        if st.button(
            f"{i18n.t('nav_stage2')}",
            use_container_width=True,
            type="primary" if current_stage == 2 else "secondary",
            disabled=not can_navigate_to(2),
            key="bottom_nav_stage2",
        ):
            # Validate Stage 1 before proceeding if coming from Stage 1
            if current_stage == 1:
                from streamlit_ui.ui.stage1_input import validate_stage1_for_progression

                is_valid, errors = validate_stage1_for_progression(i18n.t)

                if not is_valid:
                    st.error("❌ " + i18n.t("data_validation_errors"))
                    for error in errors:
                        st.error(f"• {error}")
                    return  # Block navigation

            # Clear results cache when navigating away from Stage 3
            if current_stage == 3:
                st.session_state.pop("final_results", None)
            st.session_state.stage = 2
            st.rerun()

    with col3:
        # Stage 3 button
        if st.button(
            f"{i18n.t('nav_stage3')}",
            use_container_width=True,
            type="primary" if current_stage == 3 else "secondary",
            disabled=not can_navigate_to(3),
            key="bottom_nav_stage3",
        ):
            st.session_state.stage = 3
            st.rerun()


def render_save_button(i18n: I18nManager) -> None:
    """Render save button at the bottom of the page."""
    st.markdown("---")

    has_validation_errors = st.session_state.get("has_validation_errors", False)
    if st.session_state.get("user_profile") and not has_validation_errors:
        session_data = get_session_data_as_dict()
        st.download_button(
            label="💾 " + i18n.t("save_plan_label"),
            data=json.dumps(session_data, indent=4),
            file_name="fire_plan.json",
            mime="application/json",
            use_container_width=True,
        )
    else:
        help_text = (
            i18n.t("fix_errors_before_save")
            if has_validation_errors
            else i18n.t("complete_stage1_first")
        )
        st.button(
            label="💾 " + i18n.t("save_plan_label"),
            disabled=True,
            help=help_text,
            use_container_width=True,
        )


def main() -> None:
    """Main function to run the Streamlit app."""
    st.set_page_config(layout="wide", page_title="FireBalance")

    # Initialize session state (only runs once per session)
    if "stage" not in st.session_state:
        # Initialize all session state at once
        current_year = datetime.now().year
        st.session_state.stage = 1
        # Auto-detect language based on user's location
        st.session_state.lang = initialize_language_with_detection()
        st.session_state.user_profile = UserProfile(
            birth_year=current_year - 35,  # Default: 35 years old
            expected_fire_age=55,
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=100000.0,
            inflation_rate=2.0,
            safety_buffer_months=6.0,
        )
        st.session_state.overrides = {}

        profile = st.session_state.user_profile
        # Initialize with smart default values based on profile
        st.session_state.incomes = [
            IncomeExpenseItem(
                name="Salary",
                after_tax_amount_per_period=120000,
                start_age=profile.current_age,
                end_age=profile.expected_fire_age,
                annual_growth_rate=0.0,
                is_income=True,
            ),
            IncomeExpenseItem(
                name="Social Security Pension",
                after_tax_amount_per_period=120000,
                start_age=profile.legal_retirement_age,
                end_age=profile.life_expectancy,
                annual_growth_rate=2.0,
                is_income=True,
            ),
        ]

        st.session_state.expenses = [
            IncomeExpenseItem(
                name="Daily Expenses",
                after_tax_amount_per_period=120000,
                start_age=profile.current_age,
                end_age=profile.life_expectancy,
                annual_growth_rate=1.0,
                is_income=False,
            )
        ]

    # Language Selection and Translator
    i18n = I18nManager(st.session_state.lang)

    # Top bar with title, language selection and file upload (two rows)
    # First row: Title only (centered)
    st.markdown(
        f"<h1 style='text-align: center; margin: 0;'>{i18n.t('app_title')}</h1>",
        unsafe_allow_html=True,
    )
    caption_text = i18n.t("app_caption")
    caption_html = (
        f"<p style='text-align: center; color: gray; margin: 0 0 20px 0;'>"
        f"{caption_text}</p>"
    )
    st.markdown(caption_html, unsafe_allow_html=True)

    # Second row: Language selection and file upload
    lang_col, import_col = st.columns([1, 1])

    with lang_col:
        # Language toggle - show 2 alternative languages when in one language
        current_lang = st.session_state.lang

        # Define language options
        lang_options = {
            "en": {
                "display": "EN",
                "alternatives": [("中文", "zh-CN"), ("日本語", "ja")],
            },
            "zh-CN": {
                "display": "中文",
                "alternatives": [("EN", "en"), ("日本語", "ja")],
            },
            "ja": {
                "display": "日本語",
                "alternatives": [("EN", "en"), ("中文", "zh-CN")],
            },
        }

        # Show 2 alternative language buttons (not current language)
        alternatives = lang_options[current_lang]["alternatives"]
        btn_col1, btn_col2 = st.columns(2)

        with btn_col1:
            alt_display1, alt_code1 = alternatives[0]
            if st.button(
                alt_display1, key=f"lang_btn_{alt_code1}", use_container_width=True
            ):
                st.session_state.lang = alt_code1
                st.rerun()

        with btn_col2:
            alt_display2, alt_code2 = alternatives[1]
            if st.button(
                alt_display2, key=f"lang_btn_{alt_code2}", use_container_width=True
            ):
                st.session_state.lang = alt_code2
                st.rerun()

    with import_col:
        # File upload functionality
        uploaded_file = st.file_uploader(
            i18n.t("load_plan_label"), type=["json"], key="top_file_upload"
        )

        if uploaded_file is not None:
            file_content = uploaded_file.getvalue()
            file_hash = hash(file_content)

            # Check if this is a new file or same file re-uploaded
            if st.session_state.get("last_file_hash") != file_hash:
                try:
                    uploaded_file.seek(0)  # Reset file pointer
                    data = json.load(uploaded_file)

                    # Store current stage to preserve it after loading
                    saved_stage = st.session_state.get("stage", 1)

                    load_session_data_from_dict(data)

                    # Restore the stage (allow loading in any stage)
                    st.session_state.stage = saved_stage

                    # Clear cached data to force recalculation
                    if saved_stage == 2:
                        if "planner" in st.session_state:
                            del st.session_state["planner"]
                    elif saved_stage == 3:
                        if "planner" in st.session_state:
                            del st.session_state["planner"]

                    # Clear any cached results to force refresh
                    if "base_results" in st.session_state:
                        del st.session_state["base_results"]
                    if "final_results" in st.session_state:
                        del st.session_state["final_results"]

                    # Store file hash and success flag
                    st.session_state["last_file_hash"] = file_hash
                    st.session_state["file_loaded"] = True
                    st.success("📂 " + i18n.t("plan_loaded_success"))
                    st.rerun()
                except (json.JSONDecodeError, KeyError) as e:
                    st.error(i18n.t("plan_loaded_error", error=e))

    st.markdown("---")  # Separator after top bar

    # Main content based on stage
    if st.session_state.stage == 1:
        # Render stage 1 UI with only real-time portfolio validation
        has_portfolio_error = render_stage1(i18n.t)

        # Set validation flag based on real-time validation results (portfolio only)
        # Other validations are handled lazily when user tries to navigate
        st.session_state.has_validation_errors = has_portfolio_error

    elif st.session_state.stage == 2:
        # Ensure we have a planner with latest data
        if st.session_state.get("user_profile") and st.session_state.get("incomes"):
            # Create or recreate planner if it doesn't exist
            if st.session_state.get("planner") is None:
                with st.spinner(i18n.t("generating_plan")):
                    planner = FIREPlanner()
                    planner.set_user_profile(st.session_state.user_profile)
                    for item in st.session_state.incomes:
                        planner.add_income_item(item)
                    for item in st.session_state.expenses:
                        planner.add_expense_item(item)
                    # Generate projections using new simplified API
                    planner.generate_projection_table()
                    st.session_state.planner = planner
        else:
            st.warning(i18n.t("stage2_warning_no_data"))
            st.info(i18n.t("stage2_info_how_to_generate"))
            return

        render_stage2(i18n.t)

    elif st.session_state.stage == 3:
        # Ensure we have a planner with latest data for Stage 3
        if st.session_state.get("user_profile") and st.session_state.get("incomes"):
            # Create planner if it doesn't exist (same logic as Stage 2)
            if st.session_state.get("planner") is None:
                with st.spinner(i18n.t("generating_plan")):
                    planner = FIREPlanner()
                    planner.set_user_profile(st.session_state.user_profile)
                    for item in st.session_state.incomes:
                        planner.add_income_item(item)
                    for item in st.session_state.expenses:
                        planner.add_expense_item(item)
                    # Generate projections using new simplified API
                    planner.generate_projection_table()
                    st.session_state.planner = planner
        else:
            st.warning(i18n.t("stage2_warning_no_data"))
            st.info(i18n.t("stage2_info_how_to_generate"))
            return

        # Generate final results when entering Stage 3 using new API
        if st.session_state.get("final_results") is None:
            current_planner: Optional[FIREPlanner] = st.session_state.get("planner")
            if current_planner is not None:
                with st.spinner(i18n.t("calculating_fire_feasibility")):
                    # Create progress bar for Stage 3 calculations
                    progress_bar = st.progress(0)
                    progress_text = st.empty()

                    def stage3_progress_callback(current: int, total: int) -> None:
                        """Progress callback for Stage 3 calculations."""
                        if total > 0:
                            percentage = current / total
                            progress_bar.progress(percentage)
                            progress_text.text(
                                f"Monte Carlo Simulation: {current}/{total} "
                                f"({percentage:.1%})"
                            )

                    # Calculate final results using new simplified API with progress
                    results = current_planner.calculate_fire_results(
                        progress_callback=stage3_progress_callback
                    )
                    st.session_state.final_results = results

                    # Clear progress displays
                    progress_bar.empty()
                    progress_text.empty()
            else:
                st.warning(i18n.t("cannot_get_calculator"))
                return

        render_stage3(i18n.t)
    else:
        st.error(i18n.t("error_invalid_stage"))

    # Bottom navigation only
    render_navigation_controls(i18n)
    render_save_button(i18n)


if __name__ == "__main__":
    main()
