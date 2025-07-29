"""Tests for FIRE Planner functionality."""

import json
import tempfile
from datetime import datetime
from pathlib import Path

import pytest

from core.data_models import (
    AssetClass,
    IncomeExpenseItem,
    LiquidityLevel,
    PortfolioConfiguration,
    UserProfile,
)
from core.planner import FIREPlanner
from core.planner_models import PlannerStage


class TestFIREPlanner:
    """Test suite for FIRE Planner functionality."""

    @pytest.fixture
    def sample_user_profile(self) -> UserProfile:
        """Create a sample user profile for testing."""
        portfolio = PortfolioConfiguration(
            asset_classes=[
                AssetClass(
                    name="stocks",
                    allocation_percentage=60.0,
                    expected_return=7.0,
                    volatility=15.0,
                    liquidity_level=LiquidityLevel.MEDIUM,
                ),
                AssetClass(
                    name="bonds",
                    allocation_percentage=30.0,
                    expected_return=3.0,
                    volatility=5.0,
                    liquidity_level=LiquidityLevel.LOW,
                ),
                AssetClass(
                    name="cash",
                    allocation_percentage=10.0,
                    expected_return=1.0,
                    volatility=0.5,
                    liquidity_level=LiquidityLevel.HIGH,
                ),
            ],
            enable_rebalancing=True,
        )

        return UserProfile(
            birth_year=1990,
            expected_fire_age=50,
            legal_retirement_age=65,
            life_expectancy=85,
            current_net_worth=100000,
            inflation_rate=3.0,
            safety_buffer_months=12.0,
            portfolio=portfolio,
        )

    @pytest.fixture
    def sample_income_item(self) -> IncomeExpenseItem:
        """Create a sample income item."""
        return IncomeExpenseItem(
            id="salary",
            name="Salary",
            after_tax_amount_per_period=80000,
            frequency="recurring",
            start_age=34,
            end_age=50,
            annual_growth_rate=2.0,
            is_income=True,
        )

    @pytest.fixture
    def sample_expense_item(self) -> IncomeExpenseItem:
        """Create a sample expense item."""
        return IncomeExpenseItem(
            id="living",
            name="Living Expenses",
            after_tax_amount_per_period=50000,
            frequency="recurring",
            start_age=34,
            end_age=85,
            annual_growth_rate=0.0,
            is_income=False,
        )

    def test_planner_initialization(self) -> None:
        """Test planner initialization."""
        planner = FIREPlanner()

        assert planner.current_stage == PlannerStage.STAGE1_INPUT
        assert planner.data.language == "en"
        assert planner.data.user_profile is None
        assert len(planner.data.income_items) == 0
        assert len(planner.data.expense_items) == 0

    def test_stage1_user_profile_setting(
        self, sample_user_profile: UserProfile
    ) -> None:
        """Test setting user profile in stage 1."""
        planner = FIREPlanner()

        planner.set_user_profile(sample_user_profile)

        assert planner.data.user_profile == sample_user_profile
        assert planner.current_stage == PlannerStage.STAGE1_INPUT

    def test_stage1_add_income_items(
        self, sample_user_profile: UserProfile, sample_income_item: IncomeExpenseItem
    ) -> None:
        """Test adding income items in stage 1."""
        planner = FIREPlanner()
        planner.set_user_profile(sample_user_profile)

        item_id = planner.add_income_item(sample_income_item)

        assert len(planner.data.income_items) == 1
        assert planner.data.income_items[0] == sample_income_item
        assert item_id == sample_income_item.id

    def test_stage1_add_expense_items(
        self, sample_user_profile: UserProfile, sample_expense_item: IncomeExpenseItem
    ) -> None:
        """Test adding expense items in stage 1."""
        planner = FIREPlanner()
        planner.set_user_profile(sample_user_profile)

        item_id = planner.add_expense_item(sample_expense_item)

        assert len(planner.data.expense_items) == 1
        assert planner.data.expense_items[0] == sample_expense_item
        assert item_id == sample_expense_item.id

    def test_stage1_remove_items(
        self,
        sample_user_profile: UserProfile,
        sample_income_item: IncomeExpenseItem,
        sample_expense_item: IncomeExpenseItem,
    ) -> None:
        """Test removing items in stage 1."""
        planner = FIREPlanner()
        planner.set_user_profile(sample_user_profile)

        # Add items
        income_id = planner.add_income_item(sample_income_item)
        expense_id = planner.add_expense_item(sample_expense_item)

        # Remove items
        assert planner.remove_income_item(income_id) is True
        assert planner.remove_expense_item(expense_id) is True

        # Verify removal
        assert len(planner.data.income_items) == 0
        assert len(planner.data.expense_items) == 0

        # Test removing non-existent items
        assert planner.remove_income_item("non-existent") is False
        assert planner.remove_expense_item("non-existent") is False

    def test_stage1_to_stage2_transition(
        self,
        sample_user_profile: UserProfile,
        sample_income_item: IncomeExpenseItem,
        sample_expense_item: IncomeExpenseItem,
    ) -> None:
        """Test transition from stage 1 to stage 2."""
        planner = FIREPlanner()
        planner.set_user_profile(sample_user_profile)
        planner.add_income_item(sample_income_item)
        planner.add_expense_item(sample_expense_item)

        # Should be able to proceed
        assert planner.can_proceed_to_stage2() is True

        # Proceed to stage 2
        table = planner.proceed_to_stage2()

        assert planner.current_stage == PlannerStage.STAGE2_ADJUSTMENT
        assert table is not None
        assert len(table) > 0
        assert (
            planner.data.projection_df is not None
            and planner.data.projection_df.equals(table)
        )

    def test_stage1_incomplete_data(self, sample_user_profile: UserProfile) -> None:
        """Test that incomplete data prevents stage 2 transition."""
        planner = FIREPlanner()

        # No profile
        assert planner.can_proceed_to_stage2() is False

        # Profile but no items
        planner.set_user_profile(sample_user_profile)
        assert planner.can_proceed_to_stage2() is False

        # Profile and income but no expense
        income_item = IncomeExpenseItem(
            name="Test Income",
            after_tax_amount_per_period=50000,
            frequency="recurring",
            start_age=30,
            end_age=60,
            annual_growth_rate=0.0,
            is_income=True,
        )
        planner.add_income_item(income_item)
        assert planner.can_proceed_to_stage2() is False

    def test_stage2_table_generation(
        self,
        sample_user_profile: UserProfile,
        sample_income_item: IncomeExpenseItem,
        sample_expense_item: IncomeExpenseItem,
    ) -> None:
        """Test projection table generation in stage 2."""
        planner = FIREPlanner()
        planner.set_user_profile(sample_user_profile)
        planner.add_income_item(sample_income_item)
        planner.add_expense_item(sample_expense_item)

        table = planner.proceed_to_stage2()

        # Verify DataFrame structure for wide format
        assert len(table) > 0
        assert "age" in table.columns
        assert "year" in table.columns

        # Check that we have columns for income and expense items
        assert sample_income_item.name in table.columns
        assert sample_expense_item.name in table.columns

        # Check first few rows for structure
        current_year = datetime.now().year
        current_age = current_year - sample_user_profile.birth_year

        current_age_row = table[table["age"] == current_age]
        assert len(current_age_row) == 1  # Should have exactly one row per age

        # Should have values for items if age is in range
        if current_age >= 34 and current_age <= 50:  # Income item is active
            assert current_age_row[sample_income_item.name].iloc[0] > 0
        if current_age >= 34 and current_age <= 85:  # Expense item is active
            assert current_age_row[sample_expense_item.name].iloc[0] > 0

    def test_stage2_overrides(
        self,
        sample_user_profile: UserProfile,
        sample_income_item: IncomeExpenseItem,
        sample_expense_item: IncomeExpenseItem,
    ) -> None:
        """Test applying overrides in stage 2."""
        planner = FIREPlanner()
        planner.set_user_profile(sample_user_profile)
        planner.add_income_item(sample_income_item)
        planner.add_expense_item(sample_expense_item)

        table = planner.proceed_to_stage2()

        # Find a specific row/column to override
        # Get a test age (use 5th row if available, otherwise first row)
        test_row_idx = 5 if len(table) > 5 else 0
        test_age = table.iloc[test_row_idx]["age"]
        original_amount = table.iloc[test_row_idx][sample_income_item.name]

        # Apply override
        override_value = 100000.0
        planner.apply_override(test_age, sample_income_item.id, override_value)

        # Verify override was applied
        updated_table = planner.get_projection_dataframe()
        assert updated_table is not None
        updated_row = updated_table[updated_table["age"] == test_age]

        assert len(updated_row) == 1
        assert updated_row[sample_income_item.name].iloc[0] == override_value
        assert updated_row[sample_income_item.name].iloc[0] != original_amount

        # Test removing override
        assert planner.remove_override(test_age, sample_income_item.id) is True

        # Verify override was removed
        final_table = planner.get_projection_dataframe()
        assert final_table is not None
        final_row = final_table[final_table["age"] == test_age]

        # Amount should be back to original (approximately, due to calculation)
        assert abs(final_row[sample_income_item.name].iloc[0] - original_amount) < 1.0

    def test_stage2_to_stage3_transition(
        self,
        sample_user_profile: UserProfile,
        sample_income_item: IncomeExpenseItem,
        sample_expense_item: IncomeExpenseItem,
    ) -> None:
        """Test transition from stage 2 to stage 3."""
        planner = FIREPlanner()
        planner.set_user_profile(sample_user_profile)
        planner.add_income_item(sample_income_item)
        planner.add_expense_item(sample_expense_item)

        planner.proceed_to_stage2()

        # Should be able to proceed to stage 3
        assert planner.can_proceed_to_stage3() is True

        # Proceed to stage 3
        results = planner.proceed_to_stage3()

        assert planner.current_stage == PlannerStage.STAGE3_ANALYSIS
        assert results is not None
        assert results.fire_calculation is not None
        assert planner.data.results == results

    def test_stage3_results_access(
        self,
        sample_user_profile: UserProfile,
        sample_income_item: IncomeExpenseItem,
        sample_expense_item: IncomeExpenseItem,
    ) -> None:
        """Test accessing results in stage 3."""
        planner = FIREPlanner()
        planner.set_user_profile(sample_user_profile)
        planner.add_income_item(sample_income_item)
        planner.add_expense_item(sample_expense_item)

        planner.proceed_to_stage2()
        results = planner.proceed_to_stage3()

        # Test getting results
        retrieved_results = planner.get_results()
        assert retrieved_results == results

        # Test recalculation
        recalc_results = planner.run_calculations()
        assert recalc_results is not None
        assert recalc_results.fire_calculation is not None

    def test_export_import_config(
        self,
        sample_user_profile: UserProfile,
        sample_income_item: IncomeExpenseItem,
        sample_expense_item: IncomeExpenseItem,
    ) -> None:
        """Test configuration export and import."""
        planner = FIREPlanner()
        planner.set_user_profile(sample_user_profile)
        planner.add_income_item(sample_income_item)
        planner.add_expense_item(sample_expense_item)

        # Export configuration
        config_data = planner.export_config()

        assert "version" in config_data
        assert config_data["version"] == "1.0"
        assert "metadata" in config_data
        assert "profile" in config_data
        assert "income_items" in config_data
        assert "expense_items" in config_data

        # Test file export/import
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            temp_path = Path(f.name)

        try:
            # Export to file
            planner.export_config_to_file(temp_path)
            assert temp_path.exists()

            # Create new planner and import
            new_planner = FIREPlanner()
            new_planner.import_config_from_file(temp_path)

            # Verify data was imported correctly
            assert new_planner.data.user_profile is not None
            assert (
                new_planner.data.user_profile.birth_year
                == sample_user_profile.birth_year
            )
            assert len(new_planner.data.income_items) == 1
            assert len(new_planner.data.expense_items) == 1
            assert new_planner.data.income_items[0].name == sample_income_item.name
            assert new_planner.data.expense_items[0].name == sample_expense_item.name

        finally:
            temp_path.unlink()  # Clean up

    def test_new_json_format_import_export(
        self,
        sample_user_profile: UserProfile,
        sample_income_item: IncomeExpenseItem,
        sample_expense_item: IncomeExpenseItem,
    ) -> None:
        """Test new V1.0 JSON format import/export."""
        planner = FIREPlanner()
        planner.set_user_profile(sample_user_profile)
        planner.add_income_item(sample_income_item)
        planner.add_expense_item(sample_expense_item)

        # Test export with description
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            temp_path = Path(f.name)

        try:
            # Export to file with description
            planner.export_config_to_file(temp_path, "Test FIRE plan")
            assert temp_path.exists()

            # Verify the exported JSON structure
            with open(temp_path, "r") as f:
                exported_data = json.load(f)

            assert exported_data["version"] == "1.0"
            assert "metadata" in exported_data
            assert "profile" in exported_data
            assert "income_items" in exported_data
            assert "expense_items" in exported_data
            assert "overrides" in exported_data
            assert exported_data["metadata"]["description"] == "Test FIRE plan"

            # Import back
            new_planner = FIREPlanner()
            new_planner.import_config_from_file(temp_path)

            # Verify data was imported correctly
            assert new_planner.data.user_profile is not None
            assert (
                new_planner.data.user_profile.birth_year
                == sample_user_profile.birth_year
            )
            assert len(new_planner.data.income_items) == 1
            assert len(new_planner.data.expense_items) == 1
            assert new_planner.data.income_items[0].name == sample_income_item.name
            assert new_planner.data.expense_items[0].name == sample_expense_item.name

        finally:
            temp_path.unlink()  # Clean up

    def test_override_cleanup_on_item_removal(
        self,
        sample_user_profile: UserProfile,
        sample_income_item: IncomeExpenseItem,
        sample_expense_item: IncomeExpenseItem,
    ) -> None:
        """Test that overrides are cleaned up when items are removed."""
        planner = FIREPlanner()
        planner.set_user_profile(sample_user_profile)
        planner.add_income_item(sample_income_item)
        planner.add_expense_item(sample_expense_item)

        # Move to stage 2 and apply overrides
        table = planner.proceed_to_stage2()
        test_age = table.iloc[0]["age"]

        planner.apply_override(test_age, sample_income_item.id, 90000)
        planner.apply_override(test_age, sample_expense_item.id, 60000)

        assert len(planner.data.overrides) == 2

        # Remove the income item - its overrides should be cleaned up
        removed = planner.remove_income_item(sample_income_item.id)
        assert removed is True
        assert len(planner.data.overrides) == 1

        # The remaining override should be for the expense item
        remaining_override = planner.data.overrides[0]
        assert remaining_override.item_id == sample_expense_item.id
        assert remaining_override.value == 60000

        # The table should no longer have the income item column
        updated_table = planner.get_projection_dataframe()
        assert updated_table is not None
        assert sample_income_item.name not in updated_table.columns
        assert sample_expense_item.name in updated_table.columns

    def test_reset_functionality(
        self,
        sample_user_profile: UserProfile,
        sample_income_item: IncomeExpenseItem,
        sample_expense_item: IncomeExpenseItem,
    ) -> None:
        """Test planner reset functionality."""
        planner = FIREPlanner()
        planner.set_user_profile(sample_user_profile)
        planner.add_income_item(sample_income_item)
        planner.add_expense_item(sample_expense_item)

        # Progress through all stages
        planner.proceed_to_stage2()
        planner.apply_override(40, sample_income_item.id, 90000)
        planner.proceed_to_stage3()

        # Reset to stage 1
        planner.reset_to_stage1()

        assert planner.current_stage == PlannerStage.STAGE1_INPUT
        assert planner.data.projection_df is None
        assert len(planner.data.overrides) == 0
        assert planner.data.results is None

        # But user profile and items should remain
        assert planner.data.user_profile == sample_user_profile
        assert len(planner.data.income_items) == 1
        assert len(planner.data.expense_items) == 1

    def test_language_setting(self) -> None:
        """Test language setting and i18n integration."""
        planner = FIREPlanner(language="zh")

        assert planner.data.language == "zh"
        assert planner.i18n.get_current_language() == "zh"

        # Test language change through import
        planner.data.language = "ja"
        planner.i18n.set_language("ja")

        assert planner.i18n.get_current_language() == "ja"


if __name__ == "__main__":
    pytest.main([__file__])
