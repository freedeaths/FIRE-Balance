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

### Python Version (Streamlit)

...

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

### User Profile
```json
{
  "gender": "male",
  "current_age": 30,
  "target_fire_age": 50,
  "current_assets": 100000,
  "portfolio": {...},
  "historical_data": [...]
}
```

### Income/Expense Items
```json
{
  "id": "uuid4",
  "name": "Software Engineer Salary",
  "type": "recurring",
  "amount": 80000,
  "start_age": 25,
  "end_age": 50,
  "growth_rate": 0.05
}
```

## 🌐 Internationalization

The application supports multiple languages with dedicated translation files:

- `i18n/en.json` - English (default)
- `i18n/zh-CN.json` - Simplified Chinese
- `i18n/ja.json` - Japanese

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
