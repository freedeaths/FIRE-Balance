"""Internationalization support for FIRE Planner."""

import json
from pathlib import Path
from typing import Any, Dict, Optional


class I18nManager:
    """Internationalization manager for FIRE Planner."""

    def __init__(self, language: str = "en"):
        """Initialize i18n manager with specified language.

        Args:
            language: Language code (en, zh, ja)
        """
        self.language = language
        self.translations = self._load_translations()

    def _load_translations(self) -> Dict[str, Any]:
        """Load translation data for current language."""
        # Get shared i18n directory path
        current_dir = Path(__file__).parent
        repo_root = current_dir.parent.parent.parent
        i18n_dir = repo_root / "shared" / "i18n"

        translation_file = i18n_dir / f"{self.language}.json"

        if not translation_file.exists():
            # Fallback to English
            translation_file = i18n_dir / "en.json"

        try:
            with open(translation_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, dict) else {}
        except (FileNotFoundError, json.JSONDecodeError):
            # Return empty dict if translation file is missing/invalid
            return {}

    def t(self, key: str, **kwargs: Any) -> str:
        """Translate a key with optional variable substitution.

        Args:
            key: Translation key using dot notation (e.g.,
                'planner.stages.stage1_title')
            **kwargs: Variables for string interpolation

        Returns:
            Translated string with variables substituted

        Example:
            >>> i18n.t('planner.welcome', name='John')
            'Welcome to FIRE Planner, John!'
        """
        # Navigate nested dictionary using dot notation
        keys = key.split(".")
        value: Any = self.translations

        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                # Return key if translation not found
                return key

        # If final value is not a string, return key
        if not isinstance(value, str):
            return key

        # Substitute variables if provided
        if kwargs:
            try:
                return value.format(**kwargs)
            except (KeyError, ValueError):
                # Return original value if substitution fails
                return value

        return value

    def get_supported_languages(self) -> list[str]:
        """Get list of supported language codes."""
        return ["en", "zh", "ja"]

    def set_language(self, language: str) -> None:
        """Change current language and reload translations.

        Args:
            language: New language code
        """
        self.language = language
        self.translations = self._load_translations()

    def get_current_language(self) -> str:
        """Get current language code."""
        return self.language


# Global i18n instance
_i18n_instance: Optional[I18nManager] = None


def get_i18n() -> I18nManager:
    """Get global i18n instance (singleton pattern)."""
    global _i18n_instance
    if _i18n_instance is None:
        _i18n_instance = I18nManager()
    return _i18n_instance


def t(key: str, **kwargs: Any) -> str:
    """Convenience function for translation."""
    return get_i18n().t(key, **kwargs)


def set_language(language: str) -> None:
    """Convenience function to set language globally."""
    get_i18n().set_language(language)
