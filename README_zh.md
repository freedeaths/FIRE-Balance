# FIRE Balance 财务独立计算器

一个综合性的财务独立和提前退休（FIRE）规划工具，通过交互式可视化和动态计算帮助用户制定现实可行的退休计划。

[English](README.md) | [日本語版](README_ja.md)

## 🎯 项目概述

FIRE Balance 计算器通过将复杂的财务规划过程分解为可管理的阶段，提供了一种科学的 FIRE 规划方法：

1. **数据输入**：收集基础信息和收支预测
2. **交互式规划**：可视化和调整您的财务时间线(避免过多繁琐的输入需求，兼顾灵活调整的可能性)
3. **分析与建议**：获得详细洞察和可执行建议

### 核心功能

- **🔄 投资策略**：可配置的投资组合策略
- **📊 高级可视化**：收入、支出和净资产预测的交互式图表
- **🎲 风险分析**：蒙特卡洛模拟和敏感性分析
- **🔍 历史数据集成**：基于历史净资产数据生成个人基准
- **🌍 多语言支持**：支持中文、英文和日文
- **💡 个性化洞察**：基于您的输入信息给出结论和建议

## 🏗️ 项目结构

本项目使用多种编程语言实现 FIRE 计算器：

- **Python 实现**：基于 Streamlit 的 Web 应用，具有全面的计算引擎
- **React + TypeScript 实现**：使用 Tailwind CSS 的现代 Web 应用
- **Rust WASM 实现**：未在计划中，目前计算不复杂

## 🚀 快速开始

### Python 版本

#### 命令行界面 (CLI)

分析 FIRE 计划的最快方式：

```bash
# 进入 Python 实现目录
cd implementations/python

# 使用默认示例计划运行
python cli/fire_planner.py

# 使用你自己的计划文件
python cli/fire_planner.py /path/to/your/plan.json

# 快速分析（较少的蒙特卡洛模拟次数）
python cli/fire_planner.py --quick-mc

# 将结果保存到 JSON 文件
python cli/fire_planner.py --output results.json
```

**CLI 功能特性：**
- 📊 从 JSON 配置文件加载和分析 FIRE 计划
- 🎲 可定制模拟次数的蒙特卡洛风险分析
- 💾 导出结果到 JSON 格式
- ⚡ 快速执行 - 适合批量分析或自动化

### React + TypeScript 版本

...

## 📖 核心概念

### 财务规划阶段

1. **原始规划**：基于当前收支模式的初始预测
2. **调整后规划**：通过交互式编辑修改后的用户预测
3. **逐年计算**：包含复利回报和再平衡的综合建模

### 风险分析方法

- **蒙特卡洛模拟**：在用户输入的基础上引入随机性和黑天鹅事件，模拟 FIRE 目标的实现概率

## 🎨 用户界面

### 第一阶段：基础数据输入
- 个人信息（年龄、FIRE 目标、当前资产等）
- 基于当前时间预计的收入和支出
- 历史净资产数据上传（可选）
- 投资组合偏好（可选）

### 第二阶段：交互式规划面板
- 实时收支图表可视化
- 拖拽调整曲线
- 可编辑数据表格
- 保存和加载功能

### 第三阶段：结果仪表板
- FIRE 可行性分析
- 净资产轨迹预测
- 年度净收入曲线
- 个性化建议

## 🧮 计算引擎

### 核心功能

- **通胀调整**：所有预测都经过通胀调整
- **投资组合再平衡**：基于策略的自动再平衡
- **复利增长**：投资回报的精确建模
- **净资产/年度净收入分析**：详细分析净资产和年度净收入

## 📊 数据结构

### 计划 JSON（导入/导出）
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

说明：
- `as_of_year` 是回顾/重新加载计划时的年龄计算基准年。
- 安全缓冲会在桥接期（FIRE 年龄→法定退休年龄）按剩余年数动态变化，并可通过 `bridge_discount_rate` 调整贴现（现值换算）的力度。

### 收支项目
```json
{
  "id": "uuid4",
  "name": "软件工程师薪资",
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

## 🌐 国际化

应用支持多语言，配有专门的翻译文件：

- `shared/i18n/en.json` - 英文（默认）
- `shared/i18n/zh-CN.json` - 简体中文
- `shared/i18n/ja.json` - 日文

侧边栏提供语言切换功能，支持持久化用户偏好。

## 🤝 贡献

...

## 📄 许可证

本项目基于 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 🔮 路线图

...

## 📞 支持

...

## 🙏 致谢

...

---

**免责声明**：本工具仅用于教育和规划目的，不构成财务建议。请咨询合格的财务专业人士获取个性化指导。
