/**
 * NetWorthTrajectoryChart - 净值轨迹图表
 *
 * 显示用户的净值随时间变化的轨迹，包括：
 * - 净值变化曲线
 * - FIRE 目标线
 * - 关键里程碑标记
 */

import React, { useMemo, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
  ReferenceArea
} from 'recharts';
import { Card, Title, Text, Group, Badge, Stack } from '@mantine/core';
import { IconTrendingUp } from '@tabler/icons-react';
import type { YearlyState } from '../../core';
import { getI18n } from '../../core/i18n';

// =============================================================================
// Types
// =============================================================================

interface NetWorthTrajectoryChartProps {
  /** 年度状态数据 */
  yearlyStates: YearlyState[];
  /** FIRE 目标年龄 */
  targetFireAge: number;
  /** 法定退休年龄 */
  legalRetirementAge?: number;
  /** 当前年龄 */
  currentAge?: number;
  /** 预期寿命 */
  lifeExpectancy?: number;
  /** FIRE目标净值（用于安全缓冲区） */
  fireNetWorth?: number;
  /** 安全缓冲区月数 */
  safetyBufferMonths?: number;
  /** 图表高度 */
  height?: number;
  /** 图表标题 */
  title?: string;
  /** 是否显示收入支出区域 */
  showCashFlowArea?: boolean;
}

interface ChartDataPoint {
  age: number;
  year: number;
  netWorth: number;
  safetyBuffer: number;
  netCashFlow: number;
  isSustainable: boolean;
  fireProgress: number;
}

// 区域定义
interface ZoneDefinition {
  type: 'safe' | 'warning' | 'danger';
  x1: number;  // 起始年龄
  x2: number;  // 结束年龄
  color: string;
}

// =============================================================================
// 辅助函数
// =============================================================================

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatCurrencyCompact = (value: number): string => {
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  } else {
    return `${Math.round(value)}`;
  }
};

const getZoneColor = (type: 'safe' | 'warning' | 'danger'): string => {
  switch (type) {
    case 'safe': return 'rgba(34, 197, 94, 0.3)';
    case 'warning': return 'rgba(255, 193, 7, 0.4)';
    case 'danger': return 'rgba(239, 68, 68, 0.5)';
  }
};

// 线性插值计算交叉点
const findIntersection = (
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number
): number | null => {
  // 计算两条线的交点
  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denominator) < 1e-10) return null; // 平行线

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
  if (t < 0 || t > 1) return null; // 交点不在线段内

  return x1 + t * (x2 - x1);
};

// 计算区域边界 - 使用插值计算精确交点
const calculateZones = (data: ChartDataPoint[]): ZoneDefinition[] => {
  const zones: ZoneDefinition[] = [];

  if (data.length === 0) return zones;

  const getZoneType = (netWorth: number, safetyBuffer: number): 'safe' | 'warning' | 'danger' => {
    if (netWorth > safetyBuffer) return 'safe';
    if (netWorth > 0) return 'warning';
    return 'danger';
  };

  const getZoneColor = (type: 'safe' | 'warning' | 'danger'): string => {
    switch (type) {
      case 'safe': return 'rgba(34, 197, 94, 0.3)';
      case 'warning': return 'rgba(255, 193, 7, 0.4)';
      case 'danger': return 'rgba(239, 68, 68, 0.5)';
    }
  };

  let currentZoneType = getZoneType(data[0].netWorth, data[0].safetyBuffer);
  let currentZoneStart = data[0].age;

  for (let i = 1; i < data.length; i++) {
    const prevPoint = data[i - 1];
    const currentPoint = data[i];
    const zoneType = getZoneType(currentPoint.netWorth, currentPoint.safetyBuffer);

    if (currentZoneType !== zoneType) {
      // 区域变化，计算精确交点
      let exactBoundary = currentPoint.age; // 默认值

      // 1. 检查净值与安全缓冲区的交点 (safe ↔ warning 边界)
      if ((currentZoneType === 'safe' && zoneType !== 'safe') ||
          (currentZoneType !== 'safe' && zoneType === 'safe')) {

        const intersection = findIntersection(
          prevPoint.age, prevPoint.netWorth,        // 净值线点1
          currentPoint.age, currentPoint.netWorth,  // 净值线点2
          prevPoint.age, prevPoint.safetyBuffer,    // 安全缓冲区线点1
          currentPoint.age, currentPoint.safetyBuffer // 安全缓冲区线点2
        );

        if (intersection !== null) {
          exactBoundary = intersection;
          console.log(`Safe/Warning boundary at age ${intersection.toFixed(2)}`);
        }
      }

      // 2. 检查净值与零线的交点 (warning ↔ danger 边界)
      else if ((currentZoneType === 'warning' && zoneType === 'danger') ||
               (currentZoneType === 'danger' && zoneType === 'warning')) {

        const intersection = findIntersection(
          prevPoint.age, prevPoint.netWorth,        // 净值线点1
          currentPoint.age, currentPoint.netWorth,  // 净值线点2
          prevPoint.age, 0,                         // 零线点1
          currentPoint.age, 0                       // 零线点2
        );

        if (intersection !== null) {
          exactBoundary = intersection;
          console.log(`Warning/Danger boundary at age ${intersection.toFixed(2)}`);
        }
      }

      // 结束当前区域
      const newZone = {
        type: currentZoneType,
        x1: currentZoneStart,
        x2: exactBoundary,
        color: getZoneColor(currentZoneType)
      };
      console.log('Adding zone:', newZone);
      zones.push(newZone);

      // 开始新区域
      currentZoneType = zoneType;
      currentZoneStart = exactBoundary;
    }
  }

  // 结束最后一个区域
  const finalZone = {
    type: currentZoneType,
    x1: currentZoneStart,
    x2: data[data.length - 1].age,
    color: getZoneColor(currentZoneType)
  };
  console.log('Adding final zone:', finalZone);
  zones.push(finalZone);

  return zones;
};

// =============================================================================
// 主组件
// =============================================================================

export function NetWorthTrajectoryChart({
  yearlyStates,
  targetFireAge,
  legalRetirementAge,
  currentAge,
  lifeExpectancy,
  fireNetWorth,
  safetyBufferMonths = 6,
  height = 400,
  title,
  showCashFlowArea = false,
}: NetWorthTrajectoryChartProps) {
  const i18n = getI18n();
  const t = (key: string, variables?: Record<string, any>) => i18n.t(key, variables);

  // 检测是否为移动端
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Legend 交互状态：控制哪些线条被隐藏
  const [hiddenSeries, setHiddenSeries] = useState<string[]>([]);

  // Legend 点击处理
  const handleLegendClick = (dataKey: string) => {
    if (hiddenSeries.includes(dataKey)) {
      setHiddenSeries(hiddenSeries.filter(el => el !== dataKey));
    } else {
      setHiddenSeries([...hiddenSeries, dataKey]);
    }
  };

  // 转换数据为图表格式，并计算安全缓冲区
  const chartData = useMemo((): ChartDataPoint[] => {
    const minAge = currentAge || yearlyStates[0]?.age || 25;
    const maxAge = lifeExpectancy || 85;

    return yearlyStates
      .filter(state => state.age >= minAge && state.age <= maxAge)
      .map(state => {
        const netWorth = typeof state.net_worth === 'object' ? state.net_worth.toNumber() : state.net_worth;
        const totalExpense = typeof state.total_expense === 'object' ? state.total_expense.toNumber() : state.total_expense;
        const netCashFlow = typeof state.net_cash_flow === 'object' ? state.net_cash_flow.toNumber() : state.net_cash_flow;

        // 计算安全缓冲区：N个月的年支出（包含通胀调整）
        const safetyBuffer = (totalExpense * safetyBufferMonths) / 12;

        return {
          age: state.age,
          year: state.year,
          netWorth,
          safetyBuffer,
          netCashFlow,
          isSustainable: state.is_sustainable,
          fireProgress: typeof state.fire_progress === 'object' ? state.fire_progress.toNumber() : state.fire_progress,
        };
      });
  }, [yearlyStates, currentAge, lifeExpectancy, safetyBufferMonths]);

  // 计算Y轴动态范围 - 根据可见线条调整
  const yAxisDomain = useMemo(() => {
    if (chartData.length === 0) return ['auto', 'auto'];

    // 根据隐藏的线条确定要包含的数据
    const visibleValues: number[] = [];

    chartData.forEach(d => {
      if (!hiddenSeries.includes('netWorth')) {
        visibleValues.push(d.netWorth);
      }
      if (!hiddenSeries.includes('safetyBuffer')) {
        visibleValues.push(d.safetyBuffer);
      }
      if (!hiddenSeries.includes('netCashFlow')) {
        visibleValues.push(d.netCashFlow);
      }
    });

    // 如果所有线条都被隐藏，使用默认范围
    if (visibleValues.length === 0) {
      return ['auto', 'auto'];
    }

    const minValue = Math.min(...visibleValues);
    const maxValue = Math.max(...visibleValues);
    const range = maxValue - minValue;

    // 上方留出10%空间，下方留出10%空间
    const paddingTop = range * 0.1;
    const paddingBottom = range * 0.1;

    return [minValue - paddingBottom, maxValue + paddingTop];
  }, [chartData, hiddenSeries]);

  // 计算区域定义 - 使用简化的连续扫描方法
  const zones = useMemo(() => {
    if (chartData.length === 0) return [];

    const zones: ZoneDefinition[] = [];

    // 获取区域类型的辅助函数
    const getZoneType = (netWorth: number, safetyBuffer: number): 'safe' | 'warning' | 'danger' => {
      if (netWorth > safetyBuffer) return 'safe';
      if (netWorth > 0) return 'warning';
      return 'danger';
    };

    // 收集所有关键点（数据点 + 交点）
    const allPoints: {age: number, netWorth: number, safetyBuffer: number}[] = [];

    for (let i = 0; i < chartData.length; i++) {
      const current = chartData[i];
      allPoints.push({
        age: current.age,
        netWorth: current.netWorth,
        safetyBuffer: current.safetyBuffer
      });

      // 如果有下一个点，计算交点
      if (i < chartData.length - 1) {
        const next = chartData[i + 1];

        // 检查净值与安全缓冲区的交点
        const nwCrossBuffer = (current.netWorth - current.safetyBuffer) * (next.netWorth - next.safetyBuffer) < 0;
        if (nwCrossBuffer) {
          const intersection = findIntersection(
            current.age, current.netWorth,
            next.age, next.netWorth,
            current.age, current.safetyBuffer,
            next.age, next.safetyBuffer
          );
          if (intersection !== null) {
            // 在交点处，净值等于安全缓冲区
            const bufferValue = current.safetyBuffer +
              (intersection - current.age) * (next.safetyBuffer - current.safetyBuffer) / (next.age - current.age);
            allPoints.push({
              age: intersection,
              netWorth: bufferValue,
              safetyBuffer: bufferValue
            });
          }
        }

        // 检查净值与零线的交点
        const nwCrossZero = current.netWorth * next.netWorth < 0;
        if (nwCrossZero) {
          const intersection = findIntersection(
            current.age, current.netWorth,
            next.age, next.netWorth,
            current.age, 0,
            next.age, 0
          );
          if (intersection !== null) {
            // 在交点处，净值为0
            const bufferValue = current.safetyBuffer +
              (intersection - current.age) * (next.safetyBuffer - current.safetyBuffer) / (next.age - current.age);
            allPoints.push({
              age: intersection,
              netWorth: 0,
              safetyBuffer: bufferValue
            });
          }
        }
      }
    }

    // 按年龄排序所有点
    allPoints.sort((a, b) => a.age - b.age);

    // 创建连续区域 - 根据交点性质正确切换区域类型
    let currentZoneStart = chartData[0].age;
    let currentZoneType = getZoneType(chartData[0].netWorth, chartData[0].safetyBuffer);

    // 遍历原始数据点，在交点处切换区域
    for (let i = 0; i < chartData.length - 1; i++) {
      const current = chartData[i];
      const next = chartData[i + 1];

      // 检查净值与安全缓冲区的交点
      const nwCrossBuffer = (current.netWorth - current.safetyBuffer) * (next.netWorth - next.safetyBuffer) < 0;
      if (nwCrossBuffer) {
        const intersection = findIntersection(
          current.age, current.netWorth,
          next.age, next.netWorth,
          current.age, current.safetyBuffer,
          next.age, next.safetyBuffer
        );
        if (intersection !== null) {
          // 结束当前区域
          zones.push({
            type: currentZoneType,
            x1: currentZoneStart,
            x2: intersection,
            color: getZoneColor(currentZoneType)
          });

          // 开始新区域：Safe ↔ Warning 切换
          currentZoneStart = intersection;
          currentZoneType = currentZoneType === 'safe' ? 'warning' : 'safe';
        }
      }

      // 检查净值与零线的交点
      const nwCrossZero = current.netWorth * next.netWorth < 0;
      if (nwCrossZero) {
        const intersection = findIntersection(
          current.age, current.netWorth,
          next.age, next.netWorth,
          current.age, 0,
          next.age, 0
        );
        if (intersection !== null) {
          // 结束当前区域
          zones.push({
            type: currentZoneType,
            x1: currentZoneStart,
            x2: intersection,
            color: getZoneColor(currentZoneType)
          });

          // 开始新区域：Warning ↔ Danger 切换
          currentZoneStart = intersection;
          currentZoneType = currentZoneType === 'warning' ? 'danger' : 'warning';
        }
      }
    }

    // 添加最后一个区域
    zones.push({
      type: currentZoneType,
      x1: currentZoneStart,
      x2: chartData[chartData.length - 1].age,
      color: getZoneColor(currentZoneType)
    });

    return zones;
  }, [chartData]);

  // 计算关键指标
  const keyMetrics = useMemo(() => {
    if (chartData.length === 0) return null;

    const fireAgeData = chartData.find(d => d.age === targetFireAge);
    const finalData = chartData[chartData.length - 1];
    const peakNetWorth = Math.max(...chartData.map(d => d.netWorth));
    const minNetWorth = Math.min(...chartData.map(d => d.netWorth));

    return {
      fireAgeNetWorth: fireAgeData?.netWorth || 0,
      finalNetWorth: finalData.netWorth,
      peakNetWorth,
      minNetWorth,
      sustainableYears: chartData.filter(d => d.isSustainable).length,
      totalYears: chartData.length,
    };
  }, [chartData, targetFireAge]);

  // 自定义 Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ChartDataPoint;
      return (
        <div style={{
          backgroundColor: 'white',
          padding: '12px',
          border: '1px solid #ccc',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <Text size="sm" fw={600} mb="xs">
            {data.year} ({data.age} {t('years')})
          </Text>
          <Stack gap="xs">
            <div>
              <Text size="xs" c="dimmed">{t('chart_net_worth_label')}</Text>
              <Text size="sm" fw={500} c={data.netWorth >= 0 ? 'green' : 'red'}>
                {formatCurrency(data.netWorth)}
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">{t('safety_buffer_line', { months: safetyBufferMonths })}</Text>
              <Text size="sm">
                {formatCurrency(data.safetyBuffer)}
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">{t('chart_net_cash_flow_label')}</Text>
              <Text size="sm" c={data.netCashFlow >= 0 ? 'green' : 'red'}>
                {formatCurrency(data.netCashFlow)}
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">{t('fire_progress')}</Text>
              <Text size="sm">
                {(data.fireProgress * 100).toFixed(1)}%
              </Text>
            </div>
            <Badge
              size="xs"
              color={data.isSustainable ? 'green' : 'red'}
            >
              {data.isSustainable ? t('feasible') : t('needs_adjustment')}
            </Badge>
          </Stack>
        </div>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <Card withBorder>
        <Text c="dimmed" ta="center" py="xl">
          {t('cannot_generate_trajectory_chart')}
        </Text>
      </Card>
    );
  }

  return (
    <Card withBorder>
      <Stack gap="md">
        {/* 图表标题和关键指标 */}
        <Group justify="space-between" align="flex-start">
          <div>
            <Group mb="xs">
              <IconTrendingUp size={20} color="var(--mantine-primary-color-6)" />
              <Title order={4}>
                {title || t('net_worth_trajectory_chart_title')}
              </Title>
            </Group>
            <Text size="sm" c="dimmed">
              {t('trajectory_description')}
            </Text>
          </div>

          {keyMetrics && (
            <Group gap="lg">
              <div>
                <Text size="xs" c="dimmed">{t('fire_net_worth')}</Text>
                <Text size="sm" fw={600} c={keyMetrics.fireAgeNetWorth >= 0 ? 'green' : 'red'}>
                  {formatCurrency(keyMetrics.fireAgeNetWorth)}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">{t('final_net_worth')}</Text>
                <Text size="sm" fw={600} c={keyMetrics.finalNetWorth >= 0 ? 'green' : 'red'}>
                  {formatCurrency(keyMetrics.finalNetWorth)}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">{t('no_debt_years')}</Text>
                <Text size="sm" fw={600}>
                  {keyMetrics.sustainableYears}/{keyMetrics.totalYears}
                </Text>
              </div>
            </Group>
          )}
        </Group>

        {/* 图表 */}
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="age"
              type="number"
              domain={['dataMin', 'dataMax']}
              ticks={isMobile ?
                // 移动端：每5岁一个刻度
                chartData.filter((_, index) => index % 5 === 0).map(d => d.age) :
                // 桌面端：每1岁一个刻度
                chartData.map(d => d.age)
              }
              stroke="#666"
              fontSize={12}
              tickFormatter={(value) => Math.round(value).toString()}
            />
            <YAxis
              domain={yAxisDomain}  // 使用动态计算的Y轴范围（相对值）
              stroke="#666"
              fontSize={12}
              tickFormatter={formatCurrencyCompact}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              onClick={(props) => handleLegendClick(props.dataKey)}
              wrapperStyle={{ paddingTop: '20px' }}
            />

            {/* 背景区域填充 - 精确插值区域 */}
            {zones.map((zone, index) => (
              <ReferenceArea
                key={`zone-${index}`}
                x1={Math.round(zone.x1 * 1000) / 1000}  // 保留3位小数
                x2={Math.round(zone.x2 * 1000) / 1000}  // 保留3位小数
                fill={zone.color}
                stroke="none"
                fillOpacity={0.8}
              />
            ))}

            {/* 年度现金流线 - 辅助信息，放在最底层 */}
            <Line
              type="monotone"
              dataKey="netCashFlow"
              stroke="#9333ea"
              strokeWidth={1}
              strokeDasharray="5 5"
              dot={false}
              name={t('annual_cash_flow_line')}
              hide={hiddenSeries.includes('netCashFlow')}
              opacity={0.6}
            />

            {/* 安全缓冲区线 */}
            <Line
              type="monotone"
              dataKey="safetyBuffer"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
              name={t('safety_buffer_line', { months: safetyBufferMonths })}
              hide={hiddenSeries.includes('safetyBuffer')}
            />

            {/* 净值曲线 - 主线，最粗最突出 */}
            <Line
              type="monotone"
              dataKey="netWorth"
              stroke="#1e3a8a"
              strokeWidth={4}
              dot={false}
              name={t('net_worth_line')}
              hide={hiddenSeries.includes('netWorth')}
            />

            {/* FIRE 目标年龄参考线 */}
            <ReferenceLine
              x={targetFireAge}
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="8 4"
              label={{
                value: `FIRE ${targetFireAge}`,
                position: 'insideBottomLeft',
                style: { fill: '#f59e0b', fontWeight: 'bold', fontSize: '12px' }
              }}
            />

            {/* 法定退休年龄参考线 */}
            {legalRetirementAge && (
              <ReferenceLine
                x={legalRetirementAge}
                stroke="#6366f1"
                strokeWidth={2}
                strokeDasharray="6 6"
                label={{
                  value: `${t('legal_retirement_age')} ${legalRetirementAge}`,
                  position: 'insideBottomLeft',
                  style: { fill: '#6366f1', fontWeight: 'bold', fontSize: '12px' }
                }}
              />
            )}

            {/* 零线参考 */}
            <ReferenceLine
              y={0}
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* 图例说明 */}
        <Group justify="center" gap="lg">
          <Group gap="xs">
            <div style={{ width: 16, height: 4, backgroundColor: '#1e3a8a' }}></div>
            <Text size="xs" fw={600}>{t('net_worth_line')}</Text>
          </Group>
          <Group gap="xs">
            <div style={{ width: 16, height: 2, backgroundColor: '#22c55e' }}></div>
            <Text size="xs">{t('safety_buffer_line', { months: safetyBufferMonths })}</Text>
          </Group>
          <Group gap="xs">
            <div style={{
              width: 16,
              height: 1,
              backgroundColor: '#9333ea',
              opacity: 0.6,
              backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, #9333ea 2px, #9333ea 4px)'
            }}></div>
            <Text size="xs" c="dimmed">{t('annual_cash_flow_line')}</Text>
          </Group>
          <Group gap="xs">
            <div style={{ width: 16, height: 2, backgroundColor: '#f59e0b', borderStyle: 'dashed' }}></div>
            <Text size="xs">{t('target_fire_age')}</Text>
          </Group>
          {legalRetirementAge && (
            <Group gap="xs">
              <div style={{ width: 16, height: 2, backgroundColor: '#6366f1', borderStyle: 'dashed' }}></div>
              <Text size="xs">{t('legal_retirement_age')}</Text>
            </Group>
          )}
        </Group>
      </Stack>
    </Card>
  );
}

export default NetWorthTrajectoryChart;
