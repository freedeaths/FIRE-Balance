# FIRE Balance Calculator

A comprehensive financial independence and early retirement (FIRE) planning tool that helps users create realistic, data-driven retirement plans through interactive visualization and dynamic calculations.

[中文说明](README_zh.md) | [日本語版](README_ja.md)

## 🎯 Overview

FIRE Balance Calculator provides a scientific approach to FIRE planning by breaking down the complex process into manageable stages:

1. **Data Input**: Collect basic information and income/expense projections
2. **Interactive Planning**: Visualize and adjust your financial timeline (avoiding excessive input complexity while maintaining flexibility)
3. **Analysis & Recommendations**: Get detailed insights and actionable advice

### Key Features

- **🔄 Investment Strategy**: Configurable portfolio strategies
- **📊 Advanced Visualization**: Interactive charts for income, expenses, and net worth projections
- **🎲 Risk Analysis**: Monte Carlo simulations and sensitivity analysis
- **🔍 Historical Data Integration**: Personal baseline generation from historical net worth data
- **🌍 Multi-language Support**: English, Chinese, and Japanese
- **💡 Personalized Insights**: Conclusions and recommendations based on your input

## 🏗️ Project Structure

This project implements the FIRE calculator in multiple programming languages:

- **Python Implementation**: Streamlit-based web application with comprehensive calculation engine
- **React + TypeScript Implementation**: Modern web application with Tailwind CSS
- **Rust WASM Implementation**: Not currently planned, calculations are not complex enough

## 🚀 Quick Start

### Python Version

#### Command Line Interface (CLI)

The quickest way to analyze FIRE plans:

```bash
# Navigate to Python implementation
cd implementations/python

# Run with default example plan
python cli/fire_planner.py

# Run with your own plan
python cli/fire_planner.py /path/to/your/plan.json

# Quick analysis with fewer Monte Carlo simulations
python cli/fire_planner.py --quick-mc

# Save results to JSON file
python cli/fire_planner.py --output results.json
```

**CLI Features:**
- 📊 Load and analyze FIRE plans from JSON configuration files
- 🎲 Monte Carlo risk analysis with customizable simulation counts
- 💾 Export results to JSON format
- ⚡ Fast execution - perfect for batch analysis or automation

### React + TypeScript Version

...

## 📖 Core Concepts

### Financial Planning Stages

1. **Original Planning**: Initial projections based on current income/expense patterns
2. **Adjusted Planning**: User-modified projections through interactive editing
3. **Year-by-Year Calculation**: Comprehensive modeling with compound returns and rebalancing

### Risk Analysis Methods

- **Monte Carlo Simulation**: Introduces randomness and black swan events based on user input to simulate FIRE goal achievement probability

## 🎨 User Interface

### Stage 1: Basic Data Input
- Personal information (age, FIRE target, current assets, etc.)
- Projected income and expenses based on current time
- Historical net worth data upload (optional)
- Investment portfolio preferences (optional)

### Stage 2: Interactive Planning Board
- Real-time income/expense chart visualization
- Drag-and-drop curve adjustments
- Editable data tables
- Save and load functionality

### Stage 3: Results Dashboard
- FIRE feasibility analysis
- Net worth trajectory projections
- Annual net income curves
- Personalized recommendations

## 🧮 Calculation Engine

### Core Features

- **Inflation Adjustment**: All projections adjusted for inflation
- **Portfolio Rebalancing**: Automatic rebalancing based on strategy
- **Compound Growth**: Accurate modeling of investment returns
- **Net Worth/Annual Net Income Analysis**: Detailed analysis of net worth and annual net income

## 📊 Data Structures

### Plan JSON (export/import)
```json
{
  "version": "1.0",
  "title": "FIRE Plan - 2026-01-23T06:25:04.196Z",
  "created_at": "2026-01-23T06:25:04.196Z",
  "user_profile": {
    "birth_year": 1985,
    "as_of_year": 2026,
    "expected_fire_age": 49,
    "legal_retirement_age": 65,
    "life_expectancy": 95,
    "current_net_worth": 3500000,
    "inflation_rate": 3,
    "safety_buffer_months": 6,
    "bridge_discount_rate": 1,
    "portfolio": {
      "asset_classes": [
        { "name": "stocks", "allocation_percentage": 20, "expected_return": 7, "volatility": 15, "liquidity_level": "medium" },
        { "name": "bonds", "allocation_percentage": 0, "expected_return": 3, "volatility": 5, "liquidity_level": "low" },
        { "name": "savings", "allocation_percentage": 0, "expected_return": 1, "volatility": 5, "liquidity_level": "low" },
        { "name": "cash", "allocation_percentage": 80, "expected_return": 1, "volatility": 1, "liquidity_level": "high" }
      ],
      "enable_rebalancing": true
    }
  },
  "income_items": [],
  "expense_items": [],
  "overrides": []
}
```

Notes:
- `as_of_year` is the base year for age calculations when reviewing/reloading plans.
- Safety buffer requirement can ramp during the bridge period (FIRE age → legal retirement age) and is controlled by `bridge_discount_rate`.

### Income/Expense Items
```json
{
  "id": "uuid4",
  "name": "Software Engineer Salary",
  "after_tax_amount_per_period": 80000,
  "time_unit": "annually",
  "frequency": "recurring",
  "interval_periods": 1,
  "start_age": 25,
  "end_age": 50,
  "annual_growth_rate": 5,
  "is_income": true,
  "category": "Income"
}
```

## 🌐 Internationalization

The application supports multiple languages with dedicated translation files:

- `shared/i18n/en.json` - English (default)
- `shared/i18n/zh-CN.json` - Simplified Chinese
- `shared/i18n/ja.json` - Japanese

Language switching is available in the sidebar with persistent user preferences.

## 🤝 Contributing

...

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔮 Roadmap

...

## 📞 Support

...

## 🙏 Acknowledgments

...

---

**Disclaimer**: This tool is for educational and planning purposes only. It does not constitute financial advice. Please consult with qualified financial professionals for personalized guidance.
