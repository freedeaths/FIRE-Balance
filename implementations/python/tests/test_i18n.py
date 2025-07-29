"""Tests for i18n functionality."""

import json
import tempfile
from pathlib import Path

import pytest

from core.i18n import I18nManager, get_i18n, set_language, t


class TestI18nManager:
    """Test suite for I18nManager functionality."""

    def test_initialization_default_language(self) -> None:
        """Test i18n manager initialization with default language."""
        i18n = I18nManager()

        assert i18n.language == "en"
        assert isinstance(i18n.translations, dict)

    def test_initialization_custom_language(self) -> None:
        """Test i18n manager initialization with custom language."""
        i18n = I18nManager(language="zh")

        assert i18n.language == "zh"

    def test_supported_languages(self) -> None:
        """Test getting supported languages."""
        i18n = I18nManager()
        languages = i18n.get_supported_languages()

        assert "en" in languages
        assert "zh" in languages
        assert "ja" in languages

    def test_translation_key_lookup(self) -> None:
        """Test translation key lookup with dot notation."""
        # Create a temporary translation file for testing
        test_translations = {
            "planner": {
                "stages": {"stage1_title": "Profile & Income Setup"},
                "actions": {"save": "Save"},
            },
            "welcome": "Welcome to FIRE Planner",
        }

        # Create temporary directory and file
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            i18n_dir = temp_path / "shared" / "i18n"
            i18n_dir.mkdir(parents=True)

            # Write test translation file
            test_file = i18n_dir / "en.json"
            with open(test_file, "w") as f:
                json.dump(test_translations, f)

            # Mock the translation loading by directly setting translations
            i18n = I18nManager()
            i18n.translations = test_translations

            # Test nested key lookup
            assert i18n.t("planner.stages.stage1_title") == "Profile & Income Setup"
            assert i18n.t("planner.actions.save") == "Save"
            assert i18n.t("welcome") == "Welcome to FIRE Planner"

            # Test non-existent key returns the key itself
            assert i18n.t("non.existent.key") == "non.existent.key"
            assert i18n.t("simple_key") == "simple_key"

    def test_translation_with_variables(self) -> None:
        """Test translation with variable substitution."""
        test_translations = {
            "greeting": "Hello, {name}!",
            "progress": "Step {current} of {total}",
            "invalid_format": "Hello {missing_var}",
        }

        i18n = I18nManager()
        i18n.translations = test_translations

        # Test variable substitution
        assert i18n.t("greeting", name="John") == "Hello, John!"
        assert i18n.t("progress", current=2, total=5) == "Step 2 of 5"

        # Test missing variable - should return original string
        assert i18n.t("invalid_format", name="John") == "Hello {missing_var}"

        # Test no variables provided for string that needs them
        assert i18n.t("greeting") == "Hello, {name}!"

    def test_language_switching(self) -> None:
        """Test switching between languages."""
        i18n = I18nManager()

        # Initial language
        assert i18n.get_current_language() == "en"

        # Switch to Chinese
        i18n.set_language("zh")
        assert i18n.get_current_language() == "zh"

        # Switch to Japanese
        i18n.set_language("ja")
        assert i18n.get_current_language() == "ja"

        # Switch to unsupported language - should still work (might fallback)
        i18n.set_language("fr")
        assert i18n.get_current_language() == "fr"

    def test_fallback_behavior(self) -> None:
        """Test fallback behavior for missing translations."""
        i18n = I18nManager()
        i18n.translations = {}  # Empty translations

        # Should return key when translation is missing
        assert i18n.t("missing.key") == "missing.key"
        assert i18n.t("simple") == "simple"

    def test_global_instance_functions(self) -> None:
        """Test global convenience functions."""
        # Test get_i18n returns same instance
        i18n1 = get_i18n()
        i18n2 = get_i18n()
        assert i18n1 is i18n2  # Should be same instance (singleton)

        # Test global t function
        i18n1.translations = {"test": "Test Value"}
        assert t("test") == "Test Value"
        assert t("missing") == "missing"

        # Test global set_language function
        set_language("zh")
        assert get_i18n().get_current_language() == "zh"

    def test_edge_cases(self) -> None:
        """Test edge cases and error handling."""
        i18n = I18nManager()

        # Test empty key
        assert i18n.t("") == ""

        # Test key with only dots
        assert i18n.t("...") == "..."

        # Test None translations (shouldn't happen but test robustness)
        i18n.translations = {"key": None}
        assert i18n.t("key") == "key"  # Should return key if value is not string

        # Test non-dict intermediate values
        i18n.translations = {"key": "not_dict"}
        assert i18n.t("key.subkey") == "key.subkey"

    def test_real_translation_file_loading(self) -> None:
        """Test loading from actual translation files if they exist."""
        i18n = I18nManager(language="en")

        # If translation file exists, should load successfully
        # This test depends on the actual file structure
        assert isinstance(i18n.translations, dict)

        # Should be able to access planner translations if file exists
        planner_title = i18n.t("planner.stages.stage1_title")

        # If translation exists, should be string, otherwise returns the key
        assert isinstance(planner_title, str)
        assert len(planner_title) > 0


if __name__ == "__main__":
    pytest.main([__file__])
