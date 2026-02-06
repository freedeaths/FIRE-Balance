/**
 * IncomeExpenseBreakdownChart - 收支分解图表
 *
 * 基于 Recharts BarChartStackedBySign 示例
 * 显示各项收入（正值，向上堆叠）和支出（负值，向下堆叠）的详细分解
 * 用于 Stage 2 财务投影可视化
 */

import React, { useMemo, useCallback, useEffect } from 'react';
import { getI18n } from '../../core/i18n';
import { usePlannerStore } from '../../stores/plannerStore';
import { useAppStore } from '../../stores/appStore';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import {
  ResponsiveFullscreenChartWrapper,
  useMobileDisplay,
} from './ResponsiveFullscreenChartWrapper';
import { computeAnnualItemAmountAtAge } from '../../utils/projection';
// 移除 Override 导入，因为我们不再在这里处理override

// =============================================================================
// Types
// =============================================================================

export interface IncomeExpenseBreakdownData {
  age: number;
  year: number;
  [itemId: string]: number; // 每个收支项目的值（收入为正，支出为负）
}

export interface IncomeExpenseBreakdownChartProps {
  /** 图表高度 */
  height?: number;
  /** 图表标题 */
  title?: string;
}

// =============================================================================
// 工具函数
// =============================================================================

const formatCurrency = (value: number): string => {
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return `${value.toLocaleString()}`;
};

// =============================================================================
// 主组件
// =============================================================================

// 移除数据合并逻辑，现在直接接收最终数据

const IncomeExpenseBreakdownChart = React.memo(
  function IncomeExpenseBreakdownChart({
    height = 400,
    title = '',
  }: IncomeExpenseBreakdownChartProps) {
    // Store hooks - 使用选择器避免整个对象依赖
    const userProfile = usePlannerStore(state => state.data.user_profile);
    const incomeItems = usePlannerStore(state => state.data.income_items);
    const expenseItems = usePlannerStore(state => state.data.expense_items);
    const overrides = usePlannerStore(state => state.data.overrides);
    const currentLanguage = useAppStore(state => state.currentLanguage);

    // i18n
    const i18n = getI18n();
    const t = useCallback(
      (key: string, variables?: Record<string, any>) => i18n.t(key, variables),
      [i18n]
    );

    // 生成基础投影数据（不含 override）
    const baseProjectionData = useMemo((): IncomeExpenseBreakdownData[] => {
      if (!userProfile || !incomeItems || !expenseItems) return [];

      const birthYear = userProfile.birth_year || 1990;
      const asOfYear = userProfile.as_of_year || new Date().getFullYear();
      const currentAge = asOfYear - birthYear;
      const fireAge = userProfile.expected_fire_age || 50;
      const startAge = Math.max(currentAge, 25);
      const endAge = Math.max(fireAge + 10, 70);

      let inflationRatePct = userProfile.inflation_rate;
      if (inflationRatePct === undefined || inflationRatePct === null) {
        inflationRatePct = 3.0;
      }

      const data: IncomeExpenseBreakdownData[] = [];
      const allItems = [...incomeItems, ...expenseItems];

      for (let age = startAge; age <= endAge; age++) {
        const year = birthYear + age;
        const row: IncomeExpenseBreakdownData = { age, year };

        allItems.forEach(item => {
          row[item.id] = computeAnnualItemAmountAtAge(
            item,
            age,
            inflationRatePct,
            'negative'
          );
        });

        data.push(row);
      }

      return data;
    }, [userProfile, incomeItems, expenseItems]);

    // 应用 overrides 生成最终显示数据
    const finalProjectionData = useMemo((): IncomeExpenseBreakdownData[] => {
      if (overrides.length === 0) return baseProjectionData;

      return baseProjectionData.map(row => {
        const finalRow = { ...row };

        // 应用该年龄的所有 override
        overrides.forEach(override => {
          if (override.age === row.age) {
            // 检查项目类型，确保override值保持正确的正负符号
            const isIncomeItem = incomeItems.some(
              inc => inc.id === override.item_id
            );

            if (isIncomeItem) {
              // 收入项目：确保为正数
              finalRow[override.item_id] = Math.abs(override.value);
            } else {
              // 支出项目：确保为负数
              finalRow[override.item_id] = -Math.abs(override.value);
            }
          }
        });

        return finalRow;
      });
    }, [baseProjectionData, overrides]);

    // 使用最终数据
    const data = finalProjectionData;

    const allItems = [...incomeItems, ...expenseItems];

    // Legend交互状态：控制哪些数据系列被隐藏（参考代码模式）
    const [hiddenSeries, setHiddenSeries] = React.useState<string[]>([]);

    // 生成唯一显示名称，处理重名问题
    const generateUniqueDisplayNames = () => {
      const nameCount = new Map<string, number>();
      const uniqueNames = new Map<string, string>();

      // 计算每个名称的出现次数
      allItems.forEach(item => {
        const count = nameCount.get(item.name) || 0;
        nameCount.set(item.name, count + 1);
      });

      // 为重名项目生成唯一显示名称
      const nameIndex = new Map<string, number>();
      allItems.forEach(item => {
        const totalCount = nameCount.get(item.name) || 1;

        if (totalCount > 1) {
          const currentIndex = (nameIndex.get(item.name) || 0) + 1;
          nameIndex.set(item.name, currentIndex);
          uniqueNames.set(item.id, `${item.name}_${currentIndex}`);
        } else {
          uniqueNames.set(item.id, item.name);
        }
      });

      return uniqueNames;
    };

    const uniqueNames = generateUniqueDisplayNames();

    // 估算 legend 需要的高度：项目多时不滚动，改为增高图表范围
    const [windowWidth, setWindowWidth] = React.useState(() =>
      typeof window !== 'undefined' ? window.innerWidth : 1200
    );

    useEffect(() => {
      const handleResize = () => setWindowWidth(window.innerWidth);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    const legendHeight = useMemo(() => {
      if (windowWidth <= 768) return 0;
      // +2 for Σ total_income / Σ total_expense lines
      const legendItemCount = allItems.length + 2;
      // Rough estimate: each legend item takes ~170px including spacing
      const itemsPerRow = Math.max(1, Math.floor((windowWidth - 120) / 170));
      const rows = Math.max(1, Math.ceil(legendItemCount / itemsPerRow));
      // Row height ~18px + padding
      return rows * 18 + 18;
    }, [allItems.length, windowWidth]);

    // 自定义 Tooltip - 显示所有非零项目
    const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        const row = payload[0]?.payload;

        const entries = payload
          .map((entry: any) => {
            const value = typeof entry.value === 'number' ? entry.value : 0;
            const itemId = String(entry.dataKey);
            return {
              itemId,
              displayName: uniqueNames.get(itemId) || itemId,
              value,
              absValue: Math.abs(value),
              isIncome: value >= 0,
            };
          })
          .filter(e => e.absValue >= 0.01);

        const incomeTotal = entries
          .filter(e => e.isIncome)
          .reduce((sum, e) => sum + e.absValue, 0);
        const expenseTotal = entries
          .filter(e => !e.isIncome)
          .reduce((sum, e) => sum + e.absValue, 0);
        const netTotal = incomeTotal - expenseTotal;

        const topK = 6;
        const buildTopWithOthers = (
          list: typeof entries,
          isIncome: boolean
        ) => {
          const sorted = list
            .filter(e => e.isIncome === isIncome)
            .sort((a, b) => b.absValue - a.absValue);
          const top = sorted.slice(0, topK);
          const rest = sorted.slice(topK);
          const othersSum = rest.reduce((sum, e) => sum + e.absValue, 0);
          return othersSum > 0.01
            ? [
                ...top,
                {
                  itemId: isIncome ? '__other_income__' : '__other_expense__',
                  displayName: t('chart_other_label'),
                  value: isIncome ? othersSum : -othersSum,
                  absValue: othersSum,
                  isIncome,
                },
              ]
            : top;
        };

        const incomeTop = buildTopWithOthers(entries, true);
        const expenseTop = buildTopWithOthers(entries, false);

        return (
          <div
            style={{
              backgroundColor: 'white',
              padding: '12px',
              border: '1px solid #ccc',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              maxWidth: '360px',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '8px' }}>
              {t('chart_age_label')} {label} ({row?.year})
            </div>

            <div style={{ fontSize: '13px', marginBottom: '8px' }}>
              <div style={{ color: '#16a34a' }}>
                {t('chart_total_income_label')}: {formatCurrency(incomeTotal)}
              </div>
              <div style={{ color: '#dc2626' }}>
                {t('chart_total_expense_label')}: {formatCurrency(expenseTotal)}
              </div>
              <div style={{ color: netTotal >= 0 ? '#16a34a' : '#dc2626' }}>
                {t('chart_net_cash_flow_label')}:{' '}
                {netTotal >= 0
                  ? formatCurrency(netTotal)
                  : `-${formatCurrency(-netTotal)}`}
              </div>
            </div>

            <div
              style={{
                maxHeight: '220px',
                overflowY: 'auto',
                paddingRight: '4px',
              }}
            >
              {incomeTop.length > 0 && (
                <div style={{ marginBottom: '6px' }}>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#14532d',
                      marginBottom: '4px',
                    }}
                  >
                    {t('chart_income_breakdown_label')}
                  </div>
                  {incomeTop.map(e => (
                    <div
                      key={e.itemId}
                      style={{
                        fontSize: '13px',
                        color: '#16a34a',
                        marginBottom: '3px',
                      }}
                    >
                      📈 {e.displayName}: {formatCurrency(e.absValue)}
                    </div>
                  ))}
                </div>
              )}

              {expenseTop.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#7f1d1d',
                      marginBottom: '4px',
                    }}
                  >
                    {t('chart_expense_breakdown_label')}
                  </div>
                  {expenseTop.map(e => (
                    <div
                      key={e.itemId}
                      style={{
                        fontSize: '13px',
                        color: '#dc2626',
                        marginBottom: '3px',
                      }}
                    >
                      📉 {e.displayName}: {formatCurrency(e.absValue)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      }
      return null;
    };

    // 生成颜色映射：收入用绿色系，支出用红色系，色差更大
    const incomeColors = [
      '#15803d', // 深绿
      '#16a34a', // 中绿
      '#22c55e', // 亮绿
      '#4ade80', // 浅亮绿
      '#10b981', // 青绿
      '#059669', // 深青绿
    ];
    const expenseColors = [
      '#b91c1c', // 深红
      '#dc2626', // 中红
      '#ef4444', // 亮红
      '#f87171', // 浅亮红
      '#e11d48', // 玫红
      '#be123c', // 深玫红
    ];

    const colorMap: Record<string, string> = {};

    // 为收入项目分配绿色系
    incomeItems.forEach((item, index) => {
      colorMap[item.id] = incomeColors[index % incomeColors.length];
    });

    // 为支出项目分配红色系
    expenseItems.forEach((item, index) => {
      colorMap[item.id] = expenseColors[index % expenseColors.length];
    });

    // Legend点击处理（参考代码模式）
    const handleLegendClick = (dataKey: string) => {
      if (hiddenSeries.includes(dataKey)) {
        setHiddenSeries(hiddenSeries.filter(el => el !== dataKey));
      } else {
        setHiddenSeries(prev => [...prev, dataKey]);
      }
    };

    return (
      <ResponsiveFullscreenChartWrapper
        targetAspectRatio={2.5} // 柱状图不宜过扁
        baseHeight={height + legendHeight}
        chartType='bar'
        enableFullscreen={true}
        enableMobileScaling={true}
      >
        {({ height: adjustedHeight }) => (
          <ChartContent
            adjustedHeight={adjustedHeight}
            title={title}
            legendHeight={legendHeight}
          />
        )}
      </ResponsiveFullscreenChartWrapper>
    );
  }
);

// 图表内容子组件 - 使用 mobile display context
const ChartContent = React.memo(function ChartContent({
  adjustedHeight,
  title,
  legendHeight,
}: {
  adjustedHeight: number;
  title?: string;
  legendHeight: number;
}) {
  const { isMobilePortrait } = useMobileDisplay();

  // Store hooks - 使用选择器避免整个对象依赖
  const userProfile = usePlannerStore(state => state.data.user_profile);
  const incomeItems = usePlannerStore(state => state.data.income_items);
  const expenseItems = usePlannerStore(state => state.data.expense_items);
  const overrides = usePlannerStore(state => state.data.overrides);
  const currentLanguage = useAppStore(state => state.currentLanguage);

  // i18n
  const i18n = getI18n();
  const t = useCallback(
    (key: string, variables?: Record<string, any>) => i18n.t(key, variables),
    [i18n]
  );

  // 生成基础投影数据（不含 override）
  const baseProjectionData = useMemo((): IncomeExpenseBreakdownData[] => {
    if (!userProfile || !incomeItems || !expenseItems) return [];

    const birthYear = userProfile.birth_year || 1990;
    const asOfYear = userProfile.as_of_year || new Date().getFullYear();
    const currentAge = asOfYear - birthYear;
    const fireAge = userProfile.expected_fire_age || 50;
    const startAge = Math.max(currentAge, 25);
    const endAge = Math.max(fireAge + 10, 70);

    let rawInflationRate = userProfile.inflation_rate;
    if (rawInflationRate === undefined || rawInflationRate === null) {
      rawInflationRate = 3.0;
    }
    const inflationRate = rawInflationRate / 100;

    const data: IncomeExpenseBreakdownData[] = [];
    const allItems = [...incomeItems, ...expenseItems];

    for (let age = startAge; age <= endAge; age++) {
      const year = birthYear + age;
      const row: IncomeExpenseBreakdownData = { age, year };

      allItems.forEach(item => {
        if (age >= item.start_age && age <= (item.end_age || 999)) {
          const yearsFromStart = age - item.start_age;
          let baseAmount = item.after_tax_amount_per_period;

          if (item.frequency === 'recurring') {
            if (item.time_unit === 'monthly') {
              baseAmount = baseAmount * 12;
            }
          } else if (item.frequency === 'one-time') {
            if (yearsFromStart !== 0) {
              row[item.id] = 0;
              return;
            }
          }

          const isIncomeItem = incomeItems.some(inc => inc.id === item.id);
          let currentAmount: number;

          if (isIncomeItem) {
            const itemGrowthRate = (item.annual_growth_rate || 0) / 100;
            currentAmount =
              baseAmount * Math.pow(1 + itemGrowthRate, yearsFromStart);
          } else {
            const itemGrowthRate = (item.annual_growth_rate || 0) / 100;
            const totalGrowthRate = inflationRate + itemGrowthRate;
            currentAmount =
              baseAmount * Math.pow(1 + totalGrowthRate, yearsFromStart);
          }

          // 支出项目设为负值，收入项目保持正值
          row[item.id] = isIncomeItem
            ? Math.round(currentAmount)
            : -Math.round(currentAmount);
        } else {
          row[item.id] = 0;
        }
      });

      data.push(row);
    }

    return data;
  }, [userProfile, incomeItems, expenseItems]);

  // 应用 overrides 生成最终显示数据
  const finalProjectionData = useMemo((): IncomeExpenseBreakdownData[] => {
    if (overrides.length === 0) return baseProjectionData;

    return baseProjectionData.map(row => {
      const finalRow = { ...row };

      // 应用该年龄的所有 override
      overrides.forEach(override => {
        if (override.age === row.age) {
          // 检查项目类型，确保override值保持正确的正负符号
          const isIncomeItem = incomeItems.some(
            inc => inc.id === override.item_id
          );

          if (isIncomeItem) {
            // 收入项目：确保为正数
            finalRow[override.item_id] = Math.abs(override.value);
          } else {
            // 支出项目：确保为负数
            finalRow[override.item_id] = -Math.abs(override.value);
          }
        }
      });

      return finalRow;
    });
  }, [baseProjectionData, overrides, incomeItems]);

  const allItems = [...incomeItems, ...expenseItems];

  // 使用最终数据，并补充每年的总收入/总支出（用于 sum line）
  const data = useMemo(() => {
    const itemIds = new Set(allItems.map(item => item.id));
    return finalProjectionData.map(row => {
      let totalIncome = 0;
      let totalExpense = 0; // keep negative

      for (const itemId of itemIds) {
        const v = row[itemId] ?? 0;
        if (typeof v !== 'number') continue;
        if (v >= 0) totalIncome += v;
        else totalExpense += v;
      }

      return {
        ...row,
        total_income: totalIncome,
        total_expense: totalExpense,
      };
    });
  }, [finalProjectionData, allItems]);

  // Legend交互状态：控制哪些数据系列被隐藏（参考代码模式）
  const [hiddenSeries, setHiddenSeries] = React.useState<string[]>([]);

  // 生成唯一显示名称，处理重名问题
  const generateUniqueDisplayNames = () => {
    const nameCount = new Map<string, number>();
    const uniqueNames = new Map<string, string>();

    // 计算每个名称的出现次数
    allItems.forEach(item => {
      const count = nameCount.get(item.name) || 0;
      nameCount.set(item.name, count + 1);
    });

    // 为重名项目生成唯一显示名称
    const nameIndex = new Map<string, number>();
    allItems.forEach(item => {
      const totalCount = nameCount.get(item.name) || 1;

      if (totalCount > 1) {
        const currentIndex = (nameIndex.get(item.name) || 0) + 1;
        nameIndex.set(item.name, currentIndex);
        uniqueNames.set(item.id, `${item.name}_${currentIndex}`);
      } else {
        uniqueNames.set(item.id, item.name);
      }
    });

    return uniqueNames;
  };

  const uniqueNames = generateUniqueDisplayNames();

  // 自定义 Tooltip - 先显示 sum，再显示细分（Top N + Others，字号更小）
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const row = payload[0]?.payload;
      const itemIds = new Set(allItems.map(item => item.id));

      const entries = payload
        .map((entry: any) => {
          const itemId = String(entry.dataKey);
          if (!itemIds.has(itemId)) return null;
          const value = typeof entry.value === 'number' ? entry.value : 0;
          return {
            itemId,
            displayName: uniqueNames.get(itemId) || itemId,
            value,
            absValue: Math.abs(value),
            isIncome: value >= 0,
          };
        })
        .filter((e: any) => e && e.absValue >= 0.01);

      const incomeTotal =
        typeof row?.total_income === 'number'
          ? row.total_income
          : entries
              .filter(e => e.isIncome)
              .reduce((sum, e) => sum + e.absValue, 0);
      const expenseTotalAbs =
        typeof row?.total_expense === 'number'
          ? Math.abs(row.total_expense)
          : entries
              .filter(e => !e.isIncome)
              .reduce((sum, e) => sum + e.absValue, 0);
      const netTotal = incomeTotal - expenseTotalAbs;

      const topK = 6;
      const buildTopWithOthers = (list: typeof entries, isIncome: boolean) => {
        const sorted = list
          .filter(e => e.isIncome === isIncome)
          .sort((a, b) => b.absValue - a.absValue);
        const top = sorted.slice(0, topK);
        const rest = sorted.slice(topK);
        const othersSum = rest.reduce((sum, e) => sum + e.absValue, 0);
        return othersSum > 0.01
          ? [
              ...top,
              {
                itemId: isIncome ? '__other_income__' : '__other_expense__',
                displayName: t('chart_other_label'),
                value: isIncome ? othersSum : -othersSum,
                absValue: othersSum,
                isIncome,
              },
            ]
          : top;
      };

      const incomeTop = buildTopWithOthers(entries, true);
      const expenseTop = buildTopWithOthers(entries, false);

      return (
        <div
          style={{
            backgroundColor: 'white',
            padding: '12px',
            border: '1px solid #ccc',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            maxWidth: '360px',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: 12 }}>
            {t('chart_age_label')} {label} ({row?.year})
          </div>

          <div style={{ fontSize: 12, marginBottom: '8px' }}>
            <div style={{ color: '#16a34a', fontWeight: 600 }}>
              Σ {t('chart_total_income_label')}: {formatCurrency(incomeTotal)}
            </div>
            <div style={{ color: '#dc2626', fontWeight: 600 }}>
              Σ {t('chart_total_expense_label')}:{' '}
              {formatCurrency(expenseTotalAbs)}
            </div>
            <div style={{ color: netTotal >= 0 ? '#16a34a' : '#dc2626' }}>
              {t('chart_net_cash_flow_label')}:{' '}
              {netTotal >= 0
                ? formatCurrency(netTotal)
                : `-${formatCurrency(-netTotal)}`}
            </div>
          </div>

          <div
            style={{
              maxHeight: '220px',
              overflowY: 'auto',
              paddingRight: '4px',
            }}
          >
            {incomeTop.length > 0 && (
              <div style={{ marginBottom: '6px' }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#14532d',
                    marginBottom: '4px',
                  }}
                >
                  {t('chart_income_breakdown_label')}
                </div>
                {incomeTop.map(e => (
                  <div
                    key={e.itemId}
                    style={{
                      fontSize: 11,
                      color: '#16a34a',
                      marginBottom: '3px',
                    }}
                  >
                    📈 {e.displayName}: {formatCurrency(e.absValue)}
                  </div>
                ))}
              </div>
            )}

            {expenseTop.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#7f1d1d',
                    marginBottom: '4px',
                  }}
                >
                  {t('chart_expense_breakdown_label')}
                </div>
                {expenseTop.map(e => (
                  <div
                    key={e.itemId}
                    style={{
                      fontSize: 11,
                      color: '#dc2626',
                      marginBottom: '3px',
                    }}
                  >
                    📉 {e.displayName}: {formatCurrency(e.absValue)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // 生成颜色映射：收入用绿色系，支出用红色系，色差更大
  const incomeColors = [
    '#15803d', // 深绿
    '#16a34a', // 中绿
    '#22c55e', // 亮绿
    '#4ade80', // 浅亮绿
    '#10b981', // 青绿
    '#059669', // 深青绿
  ];
  const expenseColors = [
    '#b91c1c', // 深红
    '#dc2626', // 中红
    '#ef4444', // 亮红
    '#f87171', // 浅亮红
    '#e11d48', // 玫红
    '#be123c', // 深玫红
  ];

  const colorMap: Record<string, string> = {};

  // 为收入项目分配绿色系
  incomeItems.forEach((item, index) => {
    colorMap[item.id] = incomeColors[index % incomeColors.length];
  });

  // 为支出项目分配红色系
  expenseItems.forEach((item, index) => {
    colorMap[item.id] = expenseColors[index % expenseColors.length];
  });

  // Legend点击处理（参考代码模式）
  const handleLegendClick = (dataKey: string) => {
    if (hiddenSeries.includes(dataKey)) {
      setHiddenSeries(hiddenSeries.filter(el => el !== dataKey));
    } else {
      setHiddenSeries(prev => [...prev, dataKey]);
    }
  };

  return (
    <div>
      {title && (
        <h4
          style={{
            margin: '0 0 16px 0',
            fontSize: '18px',
            fontWeight: 600,
            color: '#374151',
          }}
        >
          {title}
        </h4>
      )}

      <ResponsiveContainer width='100%' height={adjustedHeight}>
        <ComposedChart
          data={data}
          stackOffset='sign'
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: Math.max(60, legendHeight + 20),
          }}
        >
          <CartesianGrid strokeDasharray='3 3' opacity={0.3} />
          <XAxis
            dataKey='age'
            fontSize={12}
            label={{
              value: t('chart_age_label'),
              position: 'insideBottom',
              offset: -10,
              style: { textAnchor: 'middle' },
            }}
          />
          <YAxis
            fontSize={12}
            tickFormatter={formatCurrency}
            label={{
              value: t('chart_amount_label'),
              angle: -90,
              position: 'insideLeft',
              style: { textAnchor: 'middle' },
            }}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Legend - 移动端竖屏时隐藏或简化 */}
          {!isMobilePortrait && (
            <Legend
              height={legendHeight}
              iconType='circle'
              wrapperStyle={{
                paddingTop: '20px',
                fontSize: 11,
              }}
              onClick={props => handleLegendClick(String(props.dataKey))}
              formatter={value => {
                if (value === 'total_income') {
                  const isHidden = hiddenSeries.includes(value);
                  return (
                    <span
                      style={{
                        opacity: isHidden ? 0.3 : 1,
                        textDecoration: isHidden ? 'line-through' : 'none',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      Σ {t('chart_total_income_label')}
                    </span>
                  );
                }
                if (value === 'total_expense') {
                  const isHidden = hiddenSeries.includes(value);
                  return (
                    <span
                      style={{
                        opacity: isHidden ? 0.3 : 1,
                        textDecoration: isHidden ? 'line-through' : 'none',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      Σ {t('chart_total_expense_label')}
                    </span>
                  );
                }
                const item = allItems.find(item => item.id === value);
                if (item) {
                  const isIncome = incomeItems.some(inc => inc.id === value);
                  const displayName = uniqueNames.get(item.id) || item.name;
                  const isHidden = hiddenSeries.includes(value);
                  return (
                    <span
                      style={{
                        opacity: isHidden ? 0.3 : 1,
                        textDecoration: isHidden ? 'line-through' : 'none',
                        fontSize: 11,
                      }}
                    >
                      {isIncome ? '📈' : '📉'} {displayName}
                    </span>
                  );
                }
                return value;
              }}
            />
          )}

          {/* 零线参考 */}
          <ReferenceLine y={0} stroke='#374151' strokeWidth={1} />

          {/* Sum lines */}
          <Line
            hide={hiddenSeries.includes('total_income')}
            type='monotone'
            dataKey='total_income'
            stroke='#16a34a'
            strokeWidth={2}
            dot={false}
            name='total_income'
            isAnimationActive={false}
          />
          <Line
            hide={hiddenSeries.includes('total_expense')}
            type='monotone'
            dataKey='total_expense'
            stroke='#dc2626'
            strokeWidth={2}
            dot={false}
            name='total_expense'
            isAnimationActive={false}
          />

          {/* 为每个收支项目生成Bar，使用hide属性控制显示（参考代码模式） */}
          {allItems.map(item => (
            <Bar
              key={item.id}
              hide={hiddenSeries.includes(item.id)}
              dataKey={item.id}
              fill={colorMap[item.id]}
              stackId='stack'
              name={uniqueNames.get(item.id) || item.name}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>

      {/* 图例说明 - 移动端竖屏时隐藏 */}
      {!isMobilePortrait && (
        <div
          style={{
            marginTop: '12px',
            fontSize: '12px',
            color: '#6b7280',
            textAlign: 'center',
          }}
        >
          {t('chart_legend_explanation')}
        </div>
      )}
    </div>
  );
});

export { IncomeExpenseBreakdownChart };
export default IncomeExpenseBreakdownChart;
