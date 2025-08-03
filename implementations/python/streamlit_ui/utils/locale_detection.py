"""
Locale detection utilities for automatic language initialization.
"""

import logging
from typing import Optional

import requests
import streamlit as st


def detect_user_timezone() -> Optional[str]:
    """
    Detect user's timezone using Streamlit's browser info.
    This requires user interaction, so it's not perfect for initialization.
    """
    try:
        # Streamlit doesn't provide direct timezone access
        # Would require JavaScript injection which is complex
        return None
    except Exception:
        return None


def detect_user_language_from_browser() -> Optional[str]:
    """
    Try to detect user's preferred language from browser headers.
    Note: Streamlit doesn't expose request headers directly.
    """
    try:
        # Streamlit doesn't provide access to HTTP request headers
        # This would require custom middleware or session info
        return None
    except Exception:
        return None


def get_country_from_ip() -> Optional[str]:
    """
    Get country code from user's IP address using a free service.
    Note: This may not work in all deployment scenarios.
    """
    try:
        # Use a free IP geolocation service
        response = requests.get("https://ipapi.co/json/", timeout=2)
        if response.status_code == 200:
            data = response.json()
            country_code = data.get("country_code", "")
            return str(country_code).upper() if country_code else None
    except Exception as e:
        logging.warning(f"Failed to get country from IP: {e}")
    return None


def map_country_to_language(country_code: str) -> str:
    """
    Map country code to preferred language.
    """
    country_language_map = {
        "CN": "zh-CN",  # China -> Chinese
        "TW": "zh-CN",  # Taiwan -> Chinese
        "HK": "zh-CN",  # Hong Kong -> Chinese
        "JP": "ja",  # Japan -> Japanese
        "US": "en",  # United States -> English
        "GB": "en",  # United Kingdom -> English
        "AU": "en",  # Australia -> English
        "CA": "en",  # Canada -> English (could be French too)
        "SG": "en",  # Singapore -> English
        # Add more mappings as needed
    }

    return country_language_map.get(country_code, "en")


def auto_detect_language() -> str:
    """
    Attempt to automatically detect user's preferred language.
    Falls back to English if detection fails.

    Returns:
        Language code ('en', 'zh', 'ja')
    """
    # Try to get country from IP
    country = get_country_from_ip()
    if country:
        language = map_country_to_language(country)
        logging.info(f"Detected country: {country}, mapped to language: {language}")
        return language

    # Fallback to English
    return "en"


def initialize_language_with_detection() -> str:
    """
    Initialize language with auto-detection, but allow user override.

    Returns:
        Selected language code
    """
    # Check if user has already selected a language
    if "lang" in st.session_state:
        return str(st.session_state.lang)

    # Try auto-detection only on first visit
    if "auto_detected_lang" not in st.session_state:
        detected_lang = auto_detect_language()
        st.session_state.auto_detected_lang = detected_lang
        st.session_state.lang = detected_lang

        # Show a notification about auto-detection (optional)
        if detected_lang != "en":
            st.info(
                f"🌍 Language auto-detected: {detected_lang} based on your "
                f"location. You can change it in the sidebar."
            )
        else:
            st.info(f"🌍 Auto-detected language: {detected_lang} (default: English)")

    return str(st.session_state.lang)
