# UI components for Stage 2: Interactive Planning Board.

from typing import Any, Callable

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st


def apply_overrides(
    base_df: pd.DataFrame, overrides: dict[Any, Any], id_to_name_map: dict[str, str]
) -> pd.DataFrame:
    """Applies stored overrides to a base DataFrame."""
    df = base_df.copy()
    for (age, item_id), value in overrides.items():
        if item_id in id_to_name_map:
            col_name = id_to_name_map[item_id]
            if age in df.index and col_name in df.columns:
                df.loc[age, col_name] = value
    return df


def render_stage2(t: Callable[..., str]) -> None:
    """Renders the UI for Stage 2: Interactive Planning Board."""
    st.header(t("stage2_title"))
    st.write(t("stage2_description"))

    # Add current economic conditions note
    st.info(t("economic_conditions_note"))

    if (
        "user_profile" not in st.session_state
        or not st.session_state.incomes
        or not st.session_state.expenses
    ):
        st.warning(t("stage2_warning_no_data"))
        st.info(t("stage2_info_how_to_generate"))
        return

    # Check if we have a planner from the main app
    if "planner" not in st.session_state or st.session_state.planner is None:
        st.warning(t("stage2_warning_no_data"))
        st.info(t("stage2_info_how_to_generate"))
        return

    planner = st.session_state.planner

    # Get projection data from planner using new API
    try:
        # Use new API to get projection with overrides
        base_df = planner.get_projection_with_overrides()

        # Convert to expected format (age as index)
        if "age" in base_df.columns:
            base_df = base_df.set_index("age")
        elif base_df.index.name != "age":
            # If no age column, assume index is already age
            pass

    except Exception as e:
        st.error(f"Error getting projection data: {str(e)}")
        return

    if "overrides" not in st.session_state:
        st.session_state.overrides = {}

    # --- Data Preparation ---

    # Add a refresh button to manually trigger recalculation
    col1, col2 = st.columns([3, 1])
    with col2:
        if st.button(t("recalculate"), help=t("recalculate_help")):
            # Clear cached data to force recalculation
            if "base_results" in st.session_state:
                try:
                    # Regenerate projection using new API
                    planner = st.session_state.planner
                    planner.generate_projection_table()
                    st.session_state.planner = planner
                except Exception as e:
                    st.error(f"Error recalculating: {str(e)}")
            # Only rerun if we're still in stage 2
            if st.session_state.get("stage", 1) == 2:
                st.rerun()

    overrides = st.session_state.overrides

    # Sync session state overrides to planner
    # Clear existing overrides first, then apply session state overrides
    try:
        planner.clear_overrides()
        for (age, item_id), value in overrides.items():
            planner.add_override(age=age, item_id=item_id, value=value)
    except Exception:
        # Silently handle override application errors
        pass

    all_items = st.session_state.incomes + st.session_state.expenses
    name_to_id_map = {item.name: item.id for item in all_items}

    # Get current projection with all overrides applied
    display_df = planner.get_projection_with_overrides()

    if "age" in display_df.columns:
        display_df = display_df.set_index("age")

    # --- Editable Data Grid ---
    st.subheader(t("financial_planning_table"))
    st.info(t("table_edit_notice"))

    # Show navigation hint if we have overrides
    if len(overrides) > 0:
        ages_with_overrides = sorted(set(age for age, _ in overrides.keys()))
        if len(ages_with_overrides) > 3:
            # Show a summary of ages with modifications
            age_range = f"{min(ages_with_overrides)}-{max(ages_with_overrides)}"
            st.info(
                f"📝 {len(overrides)} modifications across ages {age_range}. "
                f"Use Ctrl+F to search for specific ages."
            )

    # Add a buffer column to ensure drag handles are visible
    # Create a copy of display_df with an extra empty column for drag handle space
    display_df_with_buffer = display_df.copy()
    buffer_col_name = "　"  # Use a thin space character as column name
    display_df_with_buffer[buffer_col_name] = ""  # Empty buffer column

    # Configure column settings
    num_cols = len(display_df.columns)  # Original column count (without buffer)
    column_config = {}

    if num_cols > 0:
        # Use consistent width for data columns
        base_width = max(100, 900 // num_cols)  # Slightly wider base

        for col_name in display_df.columns:
            column_config[col_name] = st.column_config.NumberColumn(
                width=base_width, format="%.0f"
            )

        # Configure buffer column - extremely narrow, just for drag handles
        column_config[buffer_col_name] = st.column_config.TextColumn(
            width=1,  # Minimal width - just enough for drag handles
            disabled=True,  # Make it non-editable
            help="拖拽区域",  # Helper text
        )

    # Edit the dataframe with buffer column
    edited_df_with_buffer = st.data_editor(
        display_df_with_buffer,
        use_container_width=True,
        key="projection_editor",
        height=400,
        column_config=column_config,
        hide_index=False,
    )

    # Remove buffer column from edited result for processing
    edited_df = (
        edited_df_with_buffer.drop(columns=[buffer_col_name])
        if buffer_col_name in edited_df_with_buffer.columns
        else edited_df_with_buffer
    )

    # Process any changes from the data editor
    # Compare with the current display_df to detect what user actually changed
    diff_mask = edited_df.ne(display_df) & edited_df.notna()

    # Track if we have any changes to apply
    changes_detected = False
    last_edited_age = None

    for col_name in diff_mask.columns:
        for age in diff_mask.index:
            if diff_mask.loc[age, col_name]:
                new_value = edited_df.loc[age, col_name]
                item_id = name_to_id_map.get(col_name)
                if item_id:
                    # Store override
                    st.session_state.overrides[(age, item_id)] = new_value
                    changes_detected = True
                    last_edited_age = age  # Track the last edited age

    # Apply all overrides to planner and force refresh if changes detected
    if changes_detected:
        try:
            # Clear and re-apply all overrides
            planner.clear_overrides()
            for (age, item_id), value in st.session_state.overrides.items():
                planner.add_override(age=age, item_id=item_id, value=value)

            # Store the last edited age in session state for auto-scroll
            if last_edited_age is not None:
                st.session_state["last_edited_age"] = last_edited_age

            # Force a complete refresh to ensure UI shows the updated data
            # Only rerun if we're still in stage 2 to prevent navigation interference
            if st.session_state.get("stage", 1) == 2:
                st.rerun()

        except Exception as e:
            st.error(t("apply_changes_error", error=str(e)))

    # Show persistent status of recent changes (if any)
    current_override_count = len(overrides)
    last_edited_info = ""
    if "last_edited_age" in st.session_state:
        last_age = st.session_state["last_edited_age"]
        last_edited_info = f" (Last edited: Age {last_age})"
        # Clear the last edited age after showing the hint
        del st.session_state["last_edited_age"]

    if current_override_count > 0:
        st.info(
            t("custom_modifications_made", count=current_override_count)
            + last_edited_info
        )

    # --- Financial Projections Chart ---
    st.subheader(t("financial_projections_chart"))

    income_cols = [item.name for item in st.session_state.incomes]
    expense_cols = [item.name for item in st.session_state.expenses]

    # Create a long-form dataframe for charting
    chart_df = edited_df.reset_index()

    # Handle both 'age' and 'index' column names based on actual DataFrame structure
    # From debug info: display_df has 'age' column, so after set_index('age')
    # and reset_index(),
    # the age data becomes the index, then reset_index() creates an 'age' column
    if "age" in chart_df.columns:
        chart_df = chart_df.rename(columns={"age": "Age"})
    elif "index" in chart_df.columns:
        chart_df = chart_df.rename(columns={"index": "Age"})
    else:
        # Fallback: if neither exists, something is wrong with our logic
        st.error(
            f"Error: Cannot find age data. Available columns: {list(chart_df.columns)}"
        )
        return

    chart_data = chart_df.melt(
        id_vars="Age",
        value_vars=income_cols + expense_cols,
        var_name="Category",
        value_name="Amount",
    )

    # Add a 'Type' column for coloring and negative values for expenses
    def get_item_type(category: str) -> str:
        return t("income") if category in income_cols else t("expense")

    chart_data["Type"] = chart_data["Category"].apply(get_item_type)

    def get_signed_amount(row: pd.Series) -> float:
        return (
            float(row["Amount"])
            if row["Type"] == t("income")
            else -float(row["Amount"])
        )

    chart_data["SignedAmount"] = chart_data.apply(get_signed_amount, axis=1)

    # Filter out NaN and infinite values to prevent chart warnings
    chart_data = chart_data.dropna(subset=["SignedAmount"])
    chart_data = chart_data[
        chart_data["SignedAmount"]
        .replace([float("inf"), float("-inf")], float("nan"))
        .notna()
    ]

    # Create interactive Plotly chart with stacked/individual view toggle
    # Define consistent color scheme
    all_categories = income_cols + expense_cols
    colors = px.colors.qualitative.Plotly + px.colors.qualitative.Set3
    color_map = {cat: colors[i % len(colors)] for i, cat in enumerate(all_categories)}

    # UI controls for chart interaction
    col1, col2 = st.columns([1, 3])

    with col1:
        view_mode = st.selectbox(
            t("chart_view_mode"),
            ["stacked", "individual"],
            format_func=lambda x: (
                t("stacked_view") if x == "stacked" else t("individual_view")
            ),
            help=t("chart_view_mode_help"),
        )

    with col2:
        if view_mode == "individual":
            selected_category = st.selectbox(
                t("select_category"), all_categories, help=t("select_category_help")
            )

    # Create Plotly figure
    fig = go.Figure()

    if view_mode == "stacked":
        # Stacked bar chart - all items stack together
        ages = sorted(chart_data["Age"].unique())

        # Add each category as a separate trace for stacking
        for category in all_categories:
            cat_data = chart_data[chart_data["Category"] == category]

            # Create age-value mapping
            age_values = {}
            for _, row in cat_data.iterrows():
                age_values[row["Age"]] = row["SignedAmount"]

            # Create full series with zeros for missing ages
            y_values = [age_values.get(age, 0) for age in ages]

            fig.add_trace(
                go.Bar(
                    x=ages,
                    y=y_values,
                    name=category,
                    marker_color=color_map[category],
                    hovertemplate=f"<b>{category}</b><br>"
                    + "Age: %{x}<br>"
                    + "Amount: %{y:,.0f}<br>"
                    + "<extra></extra>",
                )
            )

    else:  # individual view
        # Single category bar chart from zero
        cat_data = chart_data[chart_data["Category"] == selected_category]

        fig.add_trace(
            go.Bar(
                x=cat_data["Age"],
                y=cat_data["SignedAmount"],
                name=selected_category,
                marker_color=color_map[selected_category],
                base=0,  # Force from zero
                hovertemplate=f"<b>{selected_category}</b><br>"
                + "Age: %{x}<br>"
                + "Amount: %{y:,.0f}<br>"
                + "<extra></extra>",
            )
        )

    # Add zero reference line
    fig.add_hline(y=0, line_dash="dash", line_color="red", line_width=2, opacity=0.7)

    # Update layout
    fig.update_layout(
        title=dict(
            text=t("financial_projections_chart_title"), x=0.5, font=dict(size=16)
        ),
        xaxis=dict(
            title=t("chart_age_label"),
            type="category",
            showgrid=True,
            gridwidth=1,
            gridcolor="lightgray",
        ),
        yaxis=dict(
            title=t("chart_amount_label"),
            showgrid=True,
            gridwidth=1,
            gridcolor="lightgray",
        ),
        height=400,
        hovermode="x unified" if view_mode == "stacked" else "closest",
        legend=dict(
            orientation="v",
            yanchor="top",
            y=1,
            xanchor="left",
            x=1.02,
            title=t("chart_category_label"),
        ),
        margin=dict(r=150),
        barmode="relative" if view_mode == "stacked" else "group",
    )

    # Display the chart
    st.plotly_chart(fig, use_container_width=True)

    # Always show the editing tip at the bottom
    st.info(t("table_edit_tip"))
