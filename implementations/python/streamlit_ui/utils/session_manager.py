# Session state management utilities for Streamlit UI.

from typing import Any, Dict

import streamlit as st


def get_session_data_as_dict() -> Dict[str, Any]:
    """Convert session state to PlannerConfigV1 format dictionary."""
    from datetime import datetime

    # Generate PlannerConfigV1 format
    data: Dict[str, Any] = {
        "version": "1.0",
        "metadata": {
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "language": st.session_state.get("lang", "en"),
            "description": "FIRE plan exported from Streamlit UI",
        },
    }

    # Convert user_profile to profile
    if "user_profile" in st.session_state:
        data["profile"] = st.session_state.user_profile.model_dump()

    # Convert incomes to income_items
    if "incomes" in st.session_state:
        data["income_items"] = [item.model_dump() for item in st.session_state.incomes]
    else:
        data["income_items"] = []

    # Convert expenses to expense_items
    if "expenses" in st.session_state:
        data["expense_items"] = [
            item.model_dump() for item in st.session_state.expenses
        ]
    else:
        data["expense_items"] = []

    # Convert overrides to array format
    if "overrides" in st.session_state and st.session_state.overrides:
        # If overrides is a dict, convert to PlannerConfigV1 array format
        if isinstance(st.session_state.overrides, dict):
            overrides_list: list[dict[str, Any]] = []
            for key, value in st.session_state.overrides.items():
                # key is a tuple (age, item_id)
                if isinstance(key, tuple) and len(key) == 2:
                    age, item_id = key
                    overrides_list.append(
                        {"age": age, "item_id": item_id, "value": value}
                    )
            data["overrides"] = overrides_list
        else:
            data["overrides"] = st.session_state.overrides
    else:
        data["overrides"] = []

    # Add empty simulation_settings for completeness
    data["simulation_settings"] = {}

    return data


def load_session_data_from_dict(data: Dict[str, Any]) -> None:
    """Load session state from PlannerConfigV1 format dictionary."""
    from core.data_models import IncomeExpenseItem, UserProfile

    # Expect PlannerConfigV1 format only
    if "profile" in data:
        st.session_state.user_profile = UserProfile(**data["profile"])

    if "income_items" in data:
        st.session_state.incomes = [
            IncomeExpenseItem(**item) for item in data["income_items"]
        ]

    if "expense_items" in data:
        st.session_state.expenses = [
            IncomeExpenseItem(**item) for item in data["expense_items"]
        ]

    if "overrides" in data:
        # Convert PlannerConfigV1 array format to UI dict format
        if isinstance(data["overrides"], list):
            # Convert from array format: [{"age": 45, "item_id": "id", "value": 1000}]
            # To dict format: {(45, "id"): 1000}
            overrides_dict = {}
            for override in data["overrides"]:
                if "age" in override and "item_id" in override and "value" in override:
                    key = (override["age"], override["item_id"])
                    overrides_dict[key] = override["value"]
            st.session_state.overrides = overrides_dict
        else:
            # Legacy dict format, use as-is
            st.session_state.overrides = data["overrides"]

    # Extract language from metadata
    if "metadata" in data and "language" in data["metadata"]:
        st.session_state.lang = data["metadata"]["language"]
