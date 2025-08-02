# Common utilities for Streamlit UI.

from typing import Any, Optional


def ensure_unique_name(
    desired_name: str, existing_items: list[Any], item_to_exclude: Optional[Any] = None
) -> str:
    """Ensure a name is unique within a list of items.

    Args:
        desired_name: The desired name
        existing_items: List of items with 'name' attribute
        item_to_exclude: Item to exclude from uniqueness check (for edits)

    Returns:
        A unique name (possibly with suffix)
    """
    existing_names = set()
    for item in existing_items:
        if item != item_to_exclude and hasattr(item, "name"):
            existing_names.add(item.name)

    if desired_name not in existing_names:
        return desired_name

    counter = 1
    while f"{desired_name} ({counter})" in existing_names:
        counter += 1

    return f"{desired_name} ({counter})"
