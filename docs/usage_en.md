# FIRE Balance User Guide

**Other Languages**: [中文](./usage_cn.md) | [日本語](./usage_ja.md)

## Overview

FIRE Balance is a comprehensive Financial Independence and Retire Early (FIRE) planning tool that helps you develop and optimize your personal financial plan through a three-stage interactive analysis.

## Core Concepts

### FIRE (Financial Independence, Retire Early)
**Financial Independence, Retire Early** is a financial strategy that involves accumulating sufficient assets to achieve passive income that covers living expenses, thereby gaining financial freedom and the option to retire early. The core principle is to build a sustainable investment portfolio whose annual returns can support your lifestyle without requiring continued work income.

### Net Worth
Net Worth = Total Assets - Total Liabilities, which is the core indicator for measuring financial health. This includes:
- **Assets**: Cash, investments, real estate, vehicles, and other valuable items
- **Liabilities**: Mortgages, credit card debt, student loans, and other debts
- The goal of a FIRE plan is to grow net worth to a level that can generate sufficient passive income

### Three-Stage System

#### Stage 1: Basic Input
- **Personal Information**: Current age, target FIRE age, legal retirement age, life expectancy
- **Investment Portfolio Settings**: Asset allocation percentages (stocks, bonds, cash, etc.) and expected returns
- **Income/Expense Items**: Detailed income and expense items including start age, end age, growth rates, etc.

#### Stage 2: Planning Adjustments
- **Financial Projection Table**: View and adjust annual financial forecasts
- **Excel-style Editing**: Support direct editing of table values and drag-to-fill batch modifications, but Streamlit's drag functionality only supports copy mode, not arithmetic progression or adaptive modes
- **Personalized Adjustments**: Precise adjustments for specific years

#### Stage 3: Results Analysis
- **Feasibility Analysis**: Evaluate the success probability of your FIRE plan
- **Trajectory Charts**: Visualization of net worth and cash flow changes over time
- **Monte Carlo Simulation**: Risk analysis considering random factors
- **Intelligent Recommendations**: Optimization suggestions based on analysis results

### Investment Rebalancing
The system **enables investment rebalancing by default**, dynamically adjusting asset allocation based on your age:
- **Young Period**: Higher stock allocation, pursuing long-term growth
- **Approaching Retirement**: Gradually increase bond and cash allocation, reducing volatility
- **After Retirement**: Maintain relatively conservative allocation, ensuring fund safety

### Liquidity Management
The system distinguishes different liquidity levels of assets:
- **High Liquidity**: Cash, money market funds - for daily consumption
- **Medium Liquidity**: Bonds, tradeable securities - balancing returns and flexibility
- **Low Liquidity**: Real estate, term deposits - long-term holding, difficult to liquidate

When consuming, the system prioritizes high-liquidity assets, ensuring you always have sufficient liquid funds to meet living needs.

## Advanced Usage Tips

### 1. Flexible Inflation Setting Strategy
**Recommended Method**: Set the global inflation rate to 0%, then set individual growth rates for each expense item

**Advantages**:
- **More Precise Control**: Growth rates for different expense categories often vary significantly
- **Reality Reflection**: Medical costs might grow 5% annually, while some fixed expenses might grow 2%
- **Flexible Adjustment**: You can adjust growth expectations for specific items at any time

**Operation Steps**:
1. Set "Inflation Rate" to 0% in Stage 1
2. Set realistic "Growth Rate" for each expense item
3. For example: Living expenses 3%, medical insurance 5%, home maintenance 2%

### 2. Mortgage Consumption Modeling Tips
Mortgages are complex financial items involving down payments and long-term repayments. Recommended modeling approach:

**Stage 1 Setup**:
- Add expense item: "Annual Mortgage Payment"
- Amount: $20,000/year
- Duration: 20 years
- Growth rate: 0% (fixed payment)

**Stage 2 Adjustment**:
- Find the home purchase year (e.g., first year)
- Change that year's mortgage expense from $20,000 to $200,000
- This simulates: $200,000 down payment + subsequent 19 years of $20,000 annual payments

**Why This Design**:
- Down payment is a one-time large expense
- Annual payments are continuous fixed expenses
- Two-step setup better reflects actual home buying process

### 3. Monte Carlo Simulation Understanding
Even without checking "Black Swan Events", Monte Carlo simulation is still **not deterministic**:

**Normal Distribution Fluctuation**:
- Income items will have positive and negative fluctuations (e.g., year-end bonus variations)
- Expense items also fluctuate (unexpected medical expenses, etc.)
- Investment returns have market volatility

**Recommended Understanding**:
- **70%+ Success Rate**: Plan is relatively safe
- **50-70% Success Rate**: Requires caution, consider adjustments
- **Below 50% Success Rate**: High risk, recommend replanning

### 4. Efficient Editing Tips for Stage 2
**Excel-style Drag Functionality**:
- Select a numerical cell
- Drag the small square at the bottom-right corner
- Can quickly copy values to multiple years

**Batch Adjustment Strategy**:
- First set values for benchmark years
- Use dragging to copy to related years
- Then fine-tune individual special years

**Common Application Scenarios**:
- Batch setting of zero income after retirement
- Phased adjustments for children's education expenses
- Setting medical costs that increase with age

## Workflow Recommendations

### First-time Use
1. **Stage 1**: Carefully set personal basic information and main income/expense items
2. **Stage 2**: Review projection results, focus on key years
3. **Stage 3**: Run Monte Carlo analysis to assess risk
4. Return to Stage 1 to adjust parameters based on results, iterate repeatedly

### Regular Updates
- **Annual Review**: Update actual income and expense data
- **Goal Adjustment**: Adjust FIRE goals based on life changes
- **Market Adaptation**: Adjust investment expectations based on market conditions

### Scenario Analysis
- **Conservative Scenario**: Lower investment return expectations, increase safety margins
- **Optimistic Scenario**: Moderately increase income growth expectations
- **Stress Testing**: Enable black swan events, test extreme situations

## Frequently Asked Questions

### Q: How to handle irregular large expenses?
A: Set as one-time expense items in Stage 1, or directly adjust specific years' expenses in Stage 2.

### Q: How should investment portfolios be configured?
A: This depends on your risk tolerance and age. Young people can allocate more to stocks (60-80%), while those approaching retirement should consider increasing bond allocation.

### Q: What if the FIRE age is not feasible?
A: Stage 3 will provide intelligent recommendations including: delaying retirement age, increasing income, reducing expenses, and other options.

### Q: How to interpret Monte Carlo results?
A: Focus on the success rate percentage and net worth in worst-case scenarios. If the worst case can still maintain basic living, the plan is relatively safe.

## Technical Support

If you encounter problems during use, please check:
- [GitHub Issues](https://github.com/freedeaths/FIRE-Balance/issues)
- [Project Documentation](https://github.com/freedeaths/FIRE-Balance)

---

**Other Languages**: [中文](./usage_cn.md) | [日本語](./usage_ja.md)
