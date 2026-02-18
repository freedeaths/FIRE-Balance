# FIRE Balance 数学公式（严格按 TypeScript 实现）

本文档**只**描述 `implementations/typescript/` 里当前实现的数学含义与计算步骤；所有符号、边界条件、取整方式、阈值比较（`>` / `>=`）都以代码为准，不做“常识化”改写。

> 主要对应：
> - Stage 1：输入数据结构与“阶段(phase)→年龄(start_age/end_age)”落地逻辑（`implementations/typescript/src/stores/plannerStore.ts`）
> - Stage 2：年度表格每个单元格的生成（`implementations/typescript/src/utils/projection.ts` + `implementations/typescript/src/components/tables/Stage2FinancialTable.tsx`）
> - Stage 3：确定性引擎与投资组合模拟（`implementations/typescript/src/core/engine.ts`、`implementations/typescript/src/core/portfolio.ts`、`implementations/typescript/src/core/safety_buffer.ts`）
> - Stage 3：Monte Carlo 风险分析与黑天鹅事件（`implementations/typescript/src/core/monte_carlo.ts`、`implementations/typescript/src/core/black_swan_events.ts`）

---

## 0. 记号与数据字段

### 0.1 年龄与年份

Stage 2 表格使用以下关系（见 `Stage2FinancialTable.tsx`）：

设 $\text{birth\_year}=\texttt{user\_profile.birth\_year}$（缺省用 1990），$\text{as\_of\_year}=\texttt{user\_profile.as\_of\_year}$（缺省用当前系统年份），则：

$$
\begin{aligned}
\text{current\_age} &= \text{as\_of\_year} - \text{birth\_year} \\
\text{age} &\in [\text{current\_age},\ \text{life\_expectancy}] \\
\text{year} &= \text{birth\_year} + \text{age}
\end{aligned}
$$

### 0.2 收支条目（IncomeExpenseItem）

对每个条目 `item`（无论收入/支出），Stage 2 会用到：

```text
item.is_income ∈ {true,false}
item.after_tax_amount_per_period  (数值，单位= item.time_unit 的“每期税后金额”)
item.time_unit ∈ {monthly, quarterly, annually}
item.frequency ∈ {recurring, one-time}
item.interval_periods  (正整数；缺省/非法会归一化为 1)
item.start_age
item.end_age (可选；若 undefined 则视为无终止)
item.annual_growth_rate  (百分比，例如 3 表示 3%)
```

### 0.3 通胀率

Stage 2 使用：

$$
\text{inflation\_rate\_pct} =
\begin{cases}
\texttt{user\_profile.inflation\_rate} & \text{若其不为 null/undefined}\\
3.0 & \text{否则}
\end{cases}
$$

### 0.4 Override（Stage 2 编辑单元格）

每个 override 结构为：

```text
override = { age, item_id, value }
```

含义：当表格显示到 `age` 这一行、`item_id` 这一列时，直接用 `value` 覆盖该单元格的“基础计算值”。

---

## 1. Stage 1：phase（阶段）如何落地为年龄区间

Stage 1 中条目允许用 `phase` / `phase_end` 表示年龄段，随后在 store 更新用户资料时会“物化”为 `start_age/end_age`（`implementations/typescript/src/stores/plannerStore.ts` 的 `materializePhaseAgesForItem()`）。

### 1.1 current_age

$$
\text{current\_age}=\text{as\_of\_year}-\text{birth\_year}
$$

### 1.2 phase → start_age / end_age（只对 recurring 生效）

注意：若 `item.frequency === 'one-time'` 且设置了 `phase`，代码会**直接清除** `phase/phase_end`，不会用 phase 推导年龄（避免“一次性”与“阶段范围”混用）。

对 recurring 条目，phase 的端点定义如下（`materializeAgeRangeFromPhase()`）：

$$
\begin{aligned}
\text{start}(1)&=\text{current\_age}, & \text{end}(1)&=\text{expected\_fire\_age} \\
\text{start}(2)&=\text{expected\_fire\_age}+1, & \text{end}(2)&=\text{legal\_retirement\_age} \\
\text{start}(3)&=\text{legal\_retirement\_age}+1, & \text{end}(3)&=
\begin{cases}
\text{expected\_healthy\_age} & \text{若存在且 } \text{legal\_retirement\_age}<\text{expected\_healthy\_age}<\text{life\_expectancy}\\
\text{life\_expectancy} & \text{否则}
\end{cases}\\
\text{start}(4)&=\text{expected\_healthy\_age}+1, & \text{end}(4)&=\text{life\_expectancy}\quad
\text{（仅当 expected\_healthy\_age 满足上式存在条件时定义）}
\end{aligned}
$$

若同时给了 `phase_end`，则使用：

$$
\text{normalized\_end}=\max(\text{phase},\text{phase\_end}),\quad
\text{start\_age}=\text{start}(\text{phase}),\quad
\text{end\_age}=\text{end}(\text{normalized\_end})
$$

最终写回条目：

$$
\text{start\_age}\leftarrow \max\!\bigl(0,\ \lfloor \text{start\_age}\rfloor \bigr),\quad
\text{end\_age}\leftarrow \max\!\bigl(0,\ \lfloor \text{end\_age}\rfloor \bigr)
$$

---

## 2. Stage 2：表格单元格（每个条目、每个年龄）的数学公式

Stage 2 的基础表格（不含 override）由 `computeAnnualItemAmountAtAge()` 计算（`implementations/typescript/src/utils/projection.ts`），并在 `Stage2FinancialTable.tsx` 中对每个年龄、每个条目填入对应列。

### 2.1 是否激活（active）

$$
\text{cell\_value}(\text{age})=
\begin{cases}
0 & \text{若 } \text{age}<\text{start\_age}\\
0 & \text{若 } (\text{end\_age}\ \text{已定义})\land (\text{age}>\text{end\_age})\\
\text{(后续公式)} & \text{否则}
\end{cases}
$$

令：

$$
\text{years\_since\_start}=\text{age}-\text{start\_age}
$$

### 2.2 time_unit → 每期月数

$$
\text{months\_per\_period}(\text{time\_unit})=
\begin{cases}
1 & \texttt{monthly}\\
3 & \texttt{quarterly}\\
12 & \texttt{annually}
\end{cases}
$$

### 2.3 interval_periods 归一化

代码会对 `interval_periods` 做：

$$
\text{interval\_periods}=\max\left(1,\ \left\lfloor \text{Number}(\text{interval\_periods})\right\rfloor\right)
$$

### 2.4 该年龄这一年内发生了几次（periods_this_year）

设：

$$
\text{interval\_months}=\text{interval\_periods}\cdot \text{months\_per\_period}(\text{time\_unit}),\quad
\text{months\_from\_start}=12\cdot \text{years\_since\_start}
$$

#### 2.4.1 one-time

$$
\text{periods\_this\_year}=
\begin{cases}
1 & \text{若 } \text{years\_since\_start}=0\\
0 & \text{否则}
\end{cases}
\qquad(\texttt{frequency}=\texttt{one-time})
$$

#### 2.4.2 recurring

$$
\text{periods\_this\_year}=
\left|\left\{m\in\{0,1,\dots,11\}:\ (\text{months\_from\_start}+m)\bmod \text{interval\_months}=0\right\}\right|
\qquad(\texttt{frequency}=\texttt{recurring})
$$

这代表：从条目开始时刻（start_age 的“第 0 个月”）起，每隔 `interval_months` 个月发生一次；对于当前年龄对应的这一年（12 个月窗口），按上述同余条件统计发生次数。

若 `periods_this_year == 0`，则本年贡献直接为 0。

### 2.5 年增长与通胀（注意：支出是“增长率 + 通胀率”的加和）

令：

$$
\text{growth\_rate}=\frac{\text{annual\_growth\_rate}\ \text{(缺省 0)}}{100},\quad
\text{inflation\_rate}=\frac{\text{inflation\_rate\_pct}\ \text{(缺省 0)}}{100}
$$

$$
\text{total\_growth\_rate}=
\begin{cases}
\text{growth\_rate} & (\texttt{is\_income}=\texttt{true})\\
\text{growth\_rate}+\text{inflation\_rate} & (\texttt{is\_income}=\texttt{false})
\end{cases}
$$

### 2.6 本年“基础年化金额”

$$
\text{base\_annual\_amount}=\text{after\_tax\_amount\_per\_period}\cdot \text{periods\_this\_year}
$$

### 2.7 增长后的本年金额 + 四舍五入

$$
\text{grown\_amount}=\text{base\_annual\_amount}\cdot (1+\text{total\_growth\_rate})^{\text{years\_since\_start}}
$$

$$
\text{cell\_value}=\operatorname{round}(\text{grown\_amount})
$$

其中 $\operatorname{round}$ 对应 JavaScript 的 `Math.round`（按最近整数取整；正数的 $x.5$ 向上取整）。

Stage 2 在 UI 里**默认把支出也显示为正数**（`expenseSign='positive'`），因此该单元格值对支出同样是正数。

---

## 3. Stage 2：Override 机制（编辑后的“最终表”）

在 `Stage2FinancialTable.tsx` 中：

### 3.1 单元格覆盖规则

对每一行 `row(age)`、每一列 `item_id`：

$$
\text{final\_cell\_value}(\text{age},\text{item\_id})=
\begin{cases}
\text{override.value} & \exists\ \text{override}: \text{override.age}=\text{age}\land \text{override.item\_id}=\text{item\_id}\\
\text{base\_cell\_value}(\text{age},\text{item\_id}) & \text{否则}
\end{cases}
$$

多个 override 若同一 `age` 但不同 `item_id`，则分别覆盖对应列；同一 `age+item_id` 只保留一个值（store 侧允许增删改；UI 侧按当前 overrides 列表应用）。

### 3.2 写入 Stage 3 所需的 yearly totals（在 store 中叫 projection_data）

Stage 2 会把最终表按“收入列求和 / 支出列求和”汇总为每年的 `total_income/total_expense`（见 `Stage2FinancialTable.tsx` 的 `useEffect()`）：

$$
\text{total\_income}(\text{age})=\sum_{i\in \text{income\_items}} \text{final\_cell\_value}(\text{age}, i.\text{id})
$$

$$
\text{total\_expense}(\text{age})=\sum_{j\in \text{expense\_items}} \text{final\_cell\_value}(\text{age}, j.\text{id})
$$

并写入：

```text
plannerStore.data.projection_data = [{age, year, total_income, total_expense}, ...]
```

重要：因为 Stage 2 已经把 override “烘焙(bake)”进了最终 totals，Stage 3 计算时会**清空**传入 Core 的 overrides，避免重复应用（见 `implementations/typescript/src/services/fireCalculationService.ts`）。

---

## 4. Stage 3：确定性引擎（FIREEngine）的年化现金流与投资组合演化

Stage 3 计算主入口：`implementations/typescript/src/core/engine.ts`。

### 4.1 年度净现金流

对每一年（每个 `AnnualFinancialProjection`）：

$$
\text{net\_cash\_flow}=\text{total\_income}-\text{total\_expense}
$$

### 4.2 初始投资组合拆分

`implementations/typescript/src/core/portfolio.ts` 的 `PortfolioSimulator` 会在模拟开始前把 `current_net_worth` 按“目标配置比例”拆成各资产初始价值：

$$
\text{target\_ratio}_i=\frac{\text{allocation\_percentage}_i}{100},\quad
\text{asset\_value}_i(0)=\text{current\_net\_worth}\cdot \text{target\_ratio}_i
$$

其中 `i` 遍历 `user_profile.portfolio.asset_classes`（默认资产名会被规范化为小写，例如 `cash/stocks/bonds/savings`）。

### 4.3 每年投资收益（注意：收益按“组合总收益”按比例分配到各资产）

设本年开始时组合总值：

$$
V_0=\sum_i \text{asset\_value}_i
$$

开始时的“实际占比”（`PortfolioState.getAllocation()`）：

$$
w_i=
\begin{cases}
0 & V_0=0\\
\dfrac{\text{asset\_value}_i}{V_0} & V_0>0
\end{cases}
$$

每个资产的期望年化收益率（百分比转小数）：

$$
r_i=\frac{\text{expected\_return}_i}{100}
$$

组合的加权收益率：

$$
R=\sum_i w_i r_i
$$

本年投资收益金额：

$$
\text{investment\_return}=V_0\cdot R
$$

然后按 `w_i` 将该收益“按比例”加回每个资产（注意：这里不是每个资产按自身 r_i 增长，而是把组合总收益按 w_i 分摊）：

$$
\text{asset\_value}_i \leftarrow \text{asset\_value}_i + \text{investment\_return}\cdot w_i
$$

### 4.4 现金流注入/支出（LiquidityAwareFlowStrategy）

该策略使用用户资料里的安全缓冲月数作为现金缓冲月数：

$$
\text{cashBufferMonths}=\texttt{user\_profile.safety\_buffer\_months}
$$

对应实现为 `new LiquidityAwareFlowStrategy(userProfile.safety_buffer_months.toNumber(), portfolioConfig)`（在 `PortfolioSimulator` 构造默认策略时传入）。

#### 4.4.1 净现金流为正：收入如何分配

先计算“现金缓冲需求”：

$$
\text{required\_cash\_buffer}=\text{annual\_expenses}\cdot \frac{\text{cashBufferMonths}}{12}
$$

其中 `annual_expenses` 就是该年的 `total_expense`（年支出）。

策略会把高流动性资产视为名为 `'cash'` 的资产当前值：

$$
\text{current\_cash}=\texttt{portfolio.asset\_values['cash']}\ \ (\text{若不存在则视为 }0)
$$

$$
\text{shortfall}=\max(0,\ \text{required\_cash\_buffer}-\text{current\_cash})
$$

当 `net_cash_flow > 0` 时，令 `income = net_cash_flow`：

$$
\text{allocate\_to\_cash}=\min(\text{income},\text{shortfall}),\quad
\text{remaining\_income}=\text{income}-\text{allocate\_to\_cash}
$$

然后把 `remaining_income` 分配给所有 **非 high 流动性** 且目标占比 > 0 的资产集合 `S`，按“目标占比在 S 内归一化后”的比例分配：

$$
S=\left\{i\mid \text{liquidity\_level}_i\ne \texttt{high}\ \land\ \text{target\_ratio}_i>0\right\},\quad
\Sigma_S=\sum_{i\in S}\text{target\_ratio}_i
$$

$$
\text{allocate}_i=
\begin{cases}
\text{remaining\_income}\cdot \dfrac{\text{target\_ratio}_i}{\Sigma_S} & \Sigma_S>0\\
0 & \Sigma_S=0
\end{cases}
$$

#### 4.4.2 净现金流为负：支出如何从资产中提取

当 `net_cash_flow < 0` 时，令：

$$
\text{expense}=-\text{net\_cash\_flow}\quad(\text{正数})
$$

按流动性层级依次提取：`HIGH → MEDIUM → LOW`。

对每一层 `tier`：

1) 取出该层内当前为正的资产子集 `T`，并计算：

$$
\text{total}_T=\sum_{i\in T}\text{asset\_value}_i,\quad
\text{withdraw\_tier}=\min(\text{needed},\ \text{total}_T)
$$

2) 若有 portfolio config，则在该层内按“expected_return 从低到高”排序，优先卖出低收益资产（`_withdrawByReturnOptimization()`）：

```text
按 expected_return 升序排列资产 i1, i2, ...
remaining = withdraw_tier
对每个资产 ik：
  w_k = min(remaining, asset_value_ik)
  flow_ik = -w_k
  remaining ← remaining - w_k
```

3) 若没有 portfolio config，则在该层内按“当前价值占比”同比例提取（`_withdrawProportionally()`）：

$$
\text{flow}_i=-\text{withdraw\_tier}\cdot \frac{\text{asset\_value}_i}{\text{total}_T}
$$

每层做完后：

$$
\text{needed}\leftarrow \text{needed}-\text{withdraw\_tier}
$$

#### 4.4.3 应用现金流 + 不允许资产为负

对每个资产：

$$
\text{asset\_value}_i\leftarrow \text{asset\_value}_i+\text{flow}_i,\quad
\text{asset\_value}_i\leftarrow \max(0,\ \text{asset\_value}_i)
$$

### 4.5 年度再平衡（Rebalancing）

若 `enable_rebalancing == true`，且存在任意资产满足：

$$
\exists i:\ \left|\text{current\_allocation}_i-\text{target\_ratio}_i\right|>0.05
$$

则触发再平衡。

再平衡交易量为：

$$
V=\sum_i \text{asset\_value}_i,\quad
\text{target\_value}_i=V\cdot \text{target\_ratio}_i,\quad
\text{trade}_i=\text{target\_value}_i-\text{asset\_value}_i,\quad
\text{asset\_value}_i\leftarrow \text{asset\_value}_i+\text{trade}_i
$$

注意：这里执行 trade 后**没有**再次做 `max(0, ...)` 的截断。

### 4.6 YearlyState（Stage 3 详细表格每行）的字段公式

对每一年：

$$
\begin{aligned}
\text{net\_cash\_flow} &= \text{total\_income}-\text{total\_expense}\\
\text{portfolio\_value} &= \sum_i \text{asset\_value}_i\quad(\text{年末})\\
\text{fire\_number} &= 25\cdot \text{total\_expense}\\
\text{fire\_progress} &=
\begin{cases}
\dfrac{\text{portfolio\_value}}{\text{fire\_number}} & \text{fire\_number}>0\\
0 & \text{fire\_number}\le 0
\end{cases}
\end{aligned}
$$

其中 $\text{investment\_return}$ 由上文“每年投资收益”一节给出。

#### 4.6.1 required_safety_buffer_months（桥接期会“变大”的安全缓冲月数）

核心函数：`implementations/typescript/src/core/safety_buffer.ts` 的 `getRequiredSafetyBufferMonths()`。

令：

$$
\text{base\_months}=\text{safety\_buffer\_months}
$$

并给定 $\text{expected\_fire\_age}$、$\text{legal\_retirement\_age}$、$\text{bridge\_discount\_rate\_percent}$。

注意：在 Core `UserProfile` 模型中 `legal_retirement_age` 是必填且有默认值（未提供时默认 65）。为了兼容 UI/导入配置的中间态缺失值，`getRequiredSafetyBufferMonths(...)` 在参数缺失时会使用一个 fallback：

$$
\text{legal\_retirement\_age}\leftarrow \max(65,\ \text{expected\_fire\_age})
$$

因此当其缺失时，桥接期逻辑不会被“直接禁用”，而是按上述 fallback 继续计算。

若满足任一条件：

$$
\text{age}<\text{expected\_fire\_age}\ \ \lor\ \ \text{age}\ge \text{legal\_retirement\_age}
$$

则：

$$
\text{required\_months}=\text{base\_months}
$$

否则（即 expected_fire_age ≤ age < legal_retirement_age），令：

$$
n=\text{legal\_retirement\_age}-\text{age},\quad
r=\frac{\text{bridge\_discount\_rate\_percent}}{100}
$$

当 `r <= 0`：

$$
\text{required\_months}=\text{base\_months}+12n
$$

当 `r > 0`：

$$
\text{annuity\_years}=\frac{1-(1+r)^{-n}}{r},\quad
\text{required\_months}=\text{base\_months}+12\cdot \text{annuity\_years}
$$

#### 4.6.2 safety_threshold（安全阈值金额）

$$
\text{safety\_threshold}=\text{total\_expense}\cdot \frac{\text{required\_months}}{12}
$$

#### 4.6.3 is_sustainable（引擎内的可持续性判断）

在 `FIREEngine.calculate_single_year()` 中：

$$
\text{is\_sustainable} \iff \text{portfolio\_value}\ge \text{safety\_threshold}
$$

### 4.7 net_worth（注意：组合归零后会累计“债务”）

`FIREEngine._calculateYearlyStates()` 会在组合归零后累计未覆盖的现金缺口为“债务”，并让净值为负数：

设 `starting_portfolio_value` 为**本年开始前**的组合总值（第一年为 `current_net_worth`）。

若本年 `portfolio_value > 0`：

$$
\text{net\_worth}=\text{portfolio\_value},\quad \text{cumulative\_debt}\leftarrow 0
$$

否则（portfolio_value <= 0）：

当 $\text{net\_cash\_flow}<0$ 时（本年仍有资金缺口）：

$$
\begin{aligned}
\text{required\_cash} &= \left|\text{net\_cash\_flow}\right|\\
\text{available\_cash} &= \text{starting\_portfolio\_value}+\text{investment\_return}\\
\text{shortfall} &= \text{required\_cash}-\text{available\_cash}\\
\text{cumulative\_debt} &\leftarrow \text{cumulative\_debt}+\max(0,\ \text{shortfall})
\end{aligned}
$$

并令：

$$
\text{net\_worth}=-\text{cumulative\_debt}
$$

然后令：

$$
\text{starting\_portfolio\_value}\leftarrow \text{portfolio\_value}
$$

---

## 5. Stage 3：汇总指标（FIRECalculationResult）

见 `implementations/typescript/src/core/engine.ts` 的 `_createCalculationResult()`。

### 5.1 is_fire_achievable

$$
\text{is\_fire\_achievable} \iff \bigwedge_t \text{yearly\_states}[t].\text{is\_sustainable}
$$

### 5.2 fire_net_worth（在 expected_fire_age 当年的净值）

令：

$$
\text{current\_age}=\text{as\_of\_year}-\text{birth\_year},\quad
\text{index}=\text{expected\_fire\_age}-\text{current\_age}
$$

若 `index` 在 `[0, yearly_states.length)` 内：

$$
\text{fire\_net\_worth}=\text{yearly\_states}[\text{index}].\text{net\_worth}
$$

否则为 0。

### 5.3 min_net_worth_after_fire / final_net_worth

$$
\text{min\_net\_worth\_after\_fire}=\min_{t\ge \text{index}}\ \text{yearly\_states}[t].\text{net\_worth}
$$

$$
\text{final\_net\_worth}=\text{yearly\_states}[\text{last}].\text{net\_worth}
$$

### 5.4 min_safety_buffer_ratio（净值 / 安全阈值 的最小值）

对每年计算：

$$
\text{ratio}_t=\frac{\text{net\_worth}_t}{\text{safety\_threshold}_t}\quad(\text{仅当 } \text{safety\_threshold}_t>0 \text{ 时计入})
$$

$$
\text{min\_safety\_buffer\_ratio}=\min_t\ \text{ratio}_t
$$

### 5.5 traditional_fire_number（参考指标：前 5 年平均支出 × 25）

若模拟年数 ≥ 5：

$$
\text{traditional\_fire\_expenses}=\operatorname{mean}\left(\text{total\_expense}_{t=0..4}\right),\quad
\text{traditional\_fire\_number}=25\cdot \text{traditional\_fire\_expenses}
$$

$$
\text{traditional\_fire\_achieved} \iff \exists t:\ \text{portfolio\_value}_t\ge \text{traditional\_fire\_number}
$$

若年数 < 5，则 `traditional_fire_expenses` 保持为 0，从而 `traditional_fire_number` 为 0。

---

## 6. Stage 3：UI 图表/表格里的“状态”定义（safe/warning/danger）

### 6.0 计划可行性（Stage3Content 的确定性判定）

Stage 3 的“计划可行性”（`Stage3Content.tsx` 里的 `feasibilityStatus`）是对**确定性引擎**输出的逐年状态做聚合：先按每一年计算安全阈值，再将任一年落入 `danger/warning/safe`，最后对全生命周期取“最坏状态”。

对每年 $i$：

$$
\text{required\_months}_i
=
\operatorname{RequiredMonths}\!\left(\text{age}_i;\ \text{expected\_fire\_age},\ \text{legal\_retirement\_age},\ \text{base\_months},\ r\right)
$$

其中 $\operatorname{RequiredMonths}(\cdot)$ 的精确定义为 `getRequiredSafetyBufferMonths(...)` 的分段公式（见上文 4.6.1；它会随 $\text{age}_i$ 变化，并在桥接期使用贴现率 $r=\text{bridge\_discount\_rate\_percent}/100$）。

然后安全阈值金额为：

$$
\text{safety\_threshold}_i=\text{total\_expense}_i\cdot \frac{\text{required\_months}_i}{12},
\quad
\text{required\_months}_i=\operatorname{RequiredMonths}(\text{age}_i;\dots)
$$

逐年状态：

$$
\text{danger}_i:\ \text{net\_worth}_i<0
$$
$$
\text{warning}_i:\ \text{net\_worth}_i\ge 0\ \land\ \text{net\_worth}_i<\text{safety\_threshold}_i
$$
$$
\text{safe}_i:\ \text{net\_worth}_i\ge \text{safety\_threshold}_i
$$

整份计划的确定性可行性状态（优先级：danger > warning > safe）：

$$
\text{feasibilityStatus}=
\begin{cases}
\texttt{danger} & \exists i:\ \text{danger}_i\\
\texttt{warning} & \left(\neg\exists i:\ \text{danger}_i\right)\land \left(\exists i:\ \text{warning}_i\right)\\
\texttt{safe} & \text{否则}
\end{cases}
$$

与之对比：Monte Carlo 的 `plan_status` / `success_rate` 来自**随机扰动后的多次模拟**（见 7.4–7.5），而“风险分布图”展示的是 Monte Carlo 的 `minimum_net_worth` 分位点（见 8）。

### 6.1 详细年度表（Stage3Content.tsx）

在 `YearlyDataTableSection.getRiskStatus()` 中（注意边界是 `<`）：

$$
\text{safety\_threshold}=\text{total\_expense}\cdot \frac{\text{required\_months}}{12},
\quad
\text{required\_months}=\operatorname{RequiredMonths}(\text{age};\dots)
$$

$$
\text{danger}:\ \text{net\_worth}<0
$$
$$
\text{warning}:\ \text{net\_worth}\ge 0\ \land\ \text{net\_worth}<\text{safety\_threshold}
$$
$$
\text{safe}:\ \text{net\_worth}\ge \text{safety\_threshold}
$$

### 6.2 净值轨迹图的分区（NetWorthTrajectoryChart.tsx）

在 `calculateZones()` 中（注意边界是 `>`）：

$$
\text{safe}:\ \text{netWorth}>\text{safetyBuffer}
$$
$$
\text{warning}:\ \text{netWorth}\le \text{safetyBuffer}\ \land\ \text{netWorth}>0
$$
$$
\text{danger}:\ \text{netWorth}\le 0
$$

其中 `safetyBuffer` 就是上文的 `safety_threshold`（同一公式：`total_expense * required_months / 12`）。

图表为了画出更“精确”的色块边界，会在相邻两点之间对交点做线性插值（`findIntersection()`），交点来自两条线段的直线交点并要求落在 `t ∈ [0,1]` 的线段范围内。

---

## 7. Monte Carlo：随机收支扰动、黑天鹅事件、成功率与分布统计

核心实现：`implementations/typescript/src/core/monte_carlo.ts`。

重要：当前 Monte Carlo **不会**对投资组合收益引入资产波动率；资产的 `volatility` 字段在该路径中未参与年收益计算（引擎仍用“期望收益率”的确定性加权结果）。

### 7.1 随机扰动：收入 multiplier（仅工作期）

设模拟年数 `N = base_df.length`，第 `i` 年的年龄为 `age_i`，FIRE 年龄为 `fire_age`。

对每年：

$$
\text{income\_multiplier}[i]=
\begin{cases}
\max(\text{income\_minimum\_factor},\ X), & \text{age}_i<\text{fire\_age},\ X\sim \mathcal N(1,\ \text{income\_base\_volatility})\\
1, & \text{age}_i\ge \text{fire\_age}
\end{cases}
$$

然后：

$$
\text{scenario\_income}_i=\text{base\_income}_i\cdot \text{income\_multiplier}[i]
$$

### 7.2 随机扰动：支出 multiplier（全生命周期）

对每年：

$$
\text{expense\_multiplier}[i]=\max(\text{expense\_minimum\_factor},\ Y),\quad
Y\sim \mathcal N(1,\ \text{expense\_base\_volatility})
$$

$$
\text{scenario\_expense}_i=\text{base\_expense}_i\cdot \text{expense\_multiplier}[i]
$$

### 7.3 黑天鹅事件：触发、持续与恢复因子

黑天鹅事件列表由 `createBlackSwanEvents(user_profile)` 生成（`implementations/typescript/src/core/black_swan_events.ts`），每个事件包含：

```text
annual_probability  (每年触发概率)
duration_years      (持续年数，≥1)
recovery_factor     (0..1，作为“持续期影响系数”，不是逐年递减)
age_range = [min_age, max_age]
income_impact / expense_impact  (可能为负/正的小数，例如 -0.4 表示 -40%)
```

每一年：

1) 对所有事件，若 `age` 在 `age_range` 内且随机数 `< annual_probability`，则事件“触发”。
2) 同一个 `event_id` 若已在 active（上一年触发且仍在持续），本年不会重复触发。
3) 对当年新触发事件：使用 `recovery_multiplier = 1.0` 施加影响。
4) 对持续中的事件（非当年新触发）：使用 `recovery_multiplier = recovery_factor` 施加影响，并把剩余年数减 1。

对当年 `row` 的影响公式（`_apply_event_impact()`）：

$$
\text{impact\_factor\_income}=\max\!\left(0,\ 1+\text{income\_impact}\cdot \text{recovery\_multiplier}\right)
$$

$$
\text{impact\_factor\_expense}=\max\!\left(0,\ 1+\text{expense\_impact}\cdot \text{recovery\_multiplier}\right)
$$

$$
\text{scenario\_income}\leftarrow \text{scenario\_income}\cdot \text{impact\_factor\_income}
,\quad
\text{scenario\_expense}\leftarrow \text{scenario\_expense}\cdot \text{impact\_factor\_expense}
$$

### 7.4 每次模拟的成功定义（safe / warning / danger）

对一次模拟跑完引擎得到的每年 `YearlyState`：

$$
\text{safety\_threshold}_i=\text{total\_expense}_i\cdot \frac{\text{required\_months}_i}{12},
\quad
\text{required\_months}_i=\operatorname{RequiredMonths}(\text{age}_i;\dots)
$$

$$
\text{danger}:\ \text{net\_worth}_i<0
$$
$$
\text{warning}:\ \text{net\_worth}_i\ge 0\ \land\ \text{net\_worth}_i<\text{safety\_threshold}_i
$$
$$
\text{safe}:\ \text{net\_worth}_i\ge \text{safety\_threshold}_i
$$

对整次计划（一次模拟）：

$$
\text{plan\_status}=
\begin{cases}
\texttt{danger} & \exists i:\ \text{danger}_i\\
\texttt{warning} & \left(\neg\exists i:\ \text{danger}_i\right)\land \left(\exists i:\ \text{warning}_i\right)\\
\texttt{safe} & \text{否则}
\end{cases}
$$

$$
\text{is\_successful} \iff \text{plan\_status}=\texttt{safe}
$$

### 7.5 success_rate、plan_status_rates、yearly_status_rates

设总模拟次数 `M = num_simulations`，成功次数 `S`：

$$
\text{success\_rate}=\frac{S}{M}
$$

计划级别状态占比：

$$
\begin{aligned}
\text{plan\_status\_rates.safe} &= \frac{\#\{\text{plan\_status}=\texttt{safe}\}}{M}\\
\text{plan\_status\_rates.warning} &= \frac{\#\{\text{plan\_status}=\texttt{warning}\}}{M}\\
\text{plan\_status\_rates.danger} &= \frac{\#\{\text{plan\_status}=\texttt{danger}\}}{M}
\end{aligned}
$$

逐年状态占比（第 i 年）：

$$
\text{yearly\_status\_rates}[i].x=\frac{\text{x\_count}_i}{M}\quad (x\in\{\texttt{safe},\texttt{warning},\texttt{danger}\})
$$

### 7.6 minimum_net_worth（每次模拟的“全生命周期最小净值”）

对一次模拟的 `yearly_results`：

$$
\text{minimum\_net\_worth}=\min_i(\text{net\_worth}_i)
$$

若 `yearly_results` 为空，则退化为 `final_net_worth`。

### 7.7 统计量：均值 / 中位数 / 分位数 / 标准差

对一个数列 `v[0..M-1]`（例如 final_net_worths 或 minimum_net_worths）：

$$
\operatorname{mean}(v)=\frac{1}{M}\sum_{k=0}^{M-1} v_k
$$

中位数（先排序）：

令 $s_0\le s_1\le \dots\le s_{M-1}$ 为 $v$ 排序后的结果，则：

$$
\operatorname{median}(v)=
\begin{cases}
s_{\frac{M-1}{2}} & M\ \text{为奇数}\\
\dfrac{s_{\frac{M}{2}-1}+s_{\frac{M}{2}}}{2} & M\ \text{为偶数}
\end{cases}
$$

分位数（线性插值，`p` 为 0..100）：

$$
\begin{aligned}
\text{index} &= \frac{p}{100}(M-1)\\
\text{lower} &= \lfloor \text{index}\rfloor,\quad \text{upper}=\lceil \text{index}\rceil\\
\text{weight} &= \text{index}-\text{lower}
\end{aligned}
$$

$$
\operatorname{percentile}(v,p)=
\begin{cases}
s_{\text{lower}} & \text{lower}=\text{upper}\\
s_{\text{lower}}(1-\text{weight})+s_{\text{upper}}\cdot \text{weight} & \text{否则}
\end{cases}
$$

标准差（总体标准差，分母为 M）：

$$
\operatorname{std}(v)=\sqrt{\frac{1}{M}\sum_{k=0}^{M-1}\left(v_k-\operatorname{mean}(v)\right)^2}
$$

### 7.8 resilience_score（0..100）

$$
\text{cv}=
\begin{cases}
1 & \operatorname{mean}(\text{final\_net\_worths})=0\\
\dfrac{\operatorname{std}(\text{final\_net\_worths})}{\left|\operatorname{mean}(\text{final\_net\_worths})\right|} & \text{否则}
\end{cases}
$$

$$
\text{stability\_score}=\max(0,\ 1-\text{cv})
$$

$$
\text{resilience\_score}=\min\!\left(100,\ \max\!\left(0,\ (0.7\cdot \text{success\_rate}+0.3\cdot \text{stability\_score})\cdot 100\right)\right)
$$

### 7.9 recommended_emergency_fund（基于成功率的建议应急金）

先估计年支出（平均值）：

$$
\text{annual\_expenses}=
\begin{cases}
\operatorname{mean}(\text{base\_df.total\_expense}) & \text{若 base\_df 非空}\\
50000 & \text{否则}
\end{cases}
$$

然后按成功率选择月数：

$$
\text{months}=
\begin{cases}
6 & \text{success\_rate}\ge 0.9\\
12 & 0.7\le \text{success\_rate}<0.9\\
18 & \text{success\_rate}<0.7
\end{cases}
$$

$$
\text{recommended\_emergency\_fund}=\text{annual\_expenses}\cdot \frac{\text{months}}{12}
$$

---

## 8. Monte Carlo 结果分布图（UI 的插值曲线说明）

`implementations/typescript/src/components/charts/MonteCarloResultsChart.tsx` 会用“最小净值”的 5/25/50/75/95 分位点，构造一条**用于展示**的连续曲线（不是严格的概率密度估计）。

对 `percentile` 以 5 为步长从 0 到 100：

令 $q\in\{0,5,10,\dots,100\}$ 为图上横轴的 percentile（以 5 为步长），并令 $p_5,p_{25},p_{50},p_{75},p_{95}$ 分别是对应分位点的最小净值，则图中展示用的 $v(q)$ 为分段插值：

$$
v(q)=
\begin{cases}
p_5 & 0\le q\le 5\\
p_5 + \dfrac{q-5}{20}\left(p_{25}-p_5\right) & 5< q\le 25\\
p_{25} + \dfrac{q-25}{25}\left(p_{50}-p_{25}\right) & 25< q\le 50\\
p_{50} + \dfrac{q-50}{25}\left(p_{75}-p_{50}\right) & 50< q\le 75\\
p_{75} + \dfrac{q-75}{20}\left(p_{95}-p_{75}\right) & 75< q\le 95\\
p_{95}\left(1+(q-95)\cdot 0.05\right) & 95< q\le 100
\end{cases}
$$

其中 `p5/p25/p50/p75/p95` 分别对应：

```text
percentile_5_minimum_net_worth
percentile_25_minimum_net_worth
median_minimum_net_worth
percentile_75_minimum_net_worth
percentile_95_minimum_net_worth
```

图中的 `density` 也是固定的启发式常数（用于视觉效果），并非从模拟样本反推得到。

---

## 附录：证明 $(\text{annuity\_years} \le n)$

本附录对应 `getRequiredSafetyBufferMonths(...)` 在 \(r>0\) 时使用的公式：

$$
\text{annuity\_years}=\frac{1-(1+r)^{-n}}{r},
\quad r>0,\ n\ge 1
$$

令：

$$
q=\frac{1}{1+r}
$$

则 $(0<q<1)$。将上式改写为几何级数求和：

$$
\begin{aligned}
\text{annuity\_years}
&=\frac{1-q^n}{(1/q)-1}
=\frac{q(1-q^n)}{1-q}
=\sum_{k=1}^{n} q^k
\end{aligned}
$$

由于对每个 $(k)$ 都有 $(0<q^k\le 1)$，因此：

$$
\text{annuity\_years}=\sum_{k=1}^{n} q^k \le \sum_{k=1}^{n} 1 = n
$$

并且当 $(r>0)$ 时 $(q<1)$，所以实际上有严格不等式 \(\text{annuity\_years}<n\)；只有在极限 $(r\to 0^+)$ 时，$(\text{annuity\_years}\to n)$。
