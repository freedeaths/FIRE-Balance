/**
 * Monte Carlo Results Distribution Chart
 * Displays minimum net worth distribution from Monte Carlo simulation results
 * Strictly corresponds to Python version implementation
 */

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { getI18n } from '../../core/i18n';
import {
  ResponsiveFullscreenChartWrapper,
  useMobileDisplay,
} from './ResponsiveFullscreenChartWrapper';

interface MonteCarloResultsChartProps {
  results: {
    percentile_5_minimum_net_worth: number;
    percentile_25_minimum_net_worth: number;
    median_minimum_net_worth: number;
    percentile_75_minimum_net_worth: number;
    percentile_95_minimum_net_worth: number;
  };
  height?: number;
}

export function MonteCarloResultsChart({
  results,
  height = 300,
}: MonteCarloResultsChartProps): React.JSX.Element {
  const i18n = getI18n();
  const t = (key: string, variables?: Record<string, unknown>): string =>
    i18n.t(key, variables);

  // Determine color based on value
  const getColor = (value: number): string => {
    if (value >= 0) return '#22c55e'; // Green - positive value excellent
    if (value >= -500000) return '#eab308'; // Yellow - low risk
    if (value >= -1000000) return '#f97316'; // Orange - medium risk
    return '#ef4444'; // Red - high risk
  };

  // Create distribution data points - build continuous distribution curve
  const distributionData = [];

  // Create data points for each percentile to form smooth distribution
  for (let percentile = 0; percentile <= 100; percentile += 5) {
    let value: number;
    let density = 0.02; // Default density

    // Calculate net worth value based on percentile interpolation
    if (percentile <= 5) {
      value = results.percentile_5_minimum_net_worth;
      density = 0.05; // Worst 5% has high density
    } else if (percentile <= 25) {
      // Linear interpolation between 5% - 25%
      const ratio = (percentile - 5) / 20;
      value =
        results.percentile_5_minimum_net_worth +
        ratio *
          (results.percentile_25_minimum_net_worth -
            results.percentile_5_minimum_net_worth);
      density = 0.02;
    } else if (percentile <= 50) {
      // Interpolation between 25% - 50%
      const ratio = (percentile - 25) / 25;
      value =
        results.percentile_25_minimum_net_worth +
        ratio *
          (results.median_minimum_net_worth -
            results.percentile_25_minimum_net_worth);
      density = 0.025; // Higher density around median
    } else if (percentile <= 75) {
      // Interpolation between 50% - 75%
      const ratio = (percentile - 50) / 25;
      value =
        results.median_minimum_net_worth +
        ratio *
          (results.percentile_75_minimum_net_worth -
            results.median_minimum_net_worth);
      density = 0.025;
    } else if (percentile <= 95) {
      // Interpolation between 75% - 95%
      const ratio = (percentile - 75) / 20;
      value =
        results.percentile_75_minimum_net_worth +
        ratio *
          (results.percentile_95_minimum_net_worth -
            results.percentile_75_minimum_net_worth);
      density = 0.02;
    } else {
      // 95% - 100% best case scenarios
      value =
        results.percentile_95_minimum_net_worth *
        (1 + (percentile - 95) * 0.05);
      density = 0.05; // Best 5% has high density
    }

    distributionData.push({
      percentile,
      value,
      density,
      label: `${percentile}%`,
      color: getColor(value),
    });
  }

  // Format number display
  const formatCurrency = (value: number): string => {
    if (Math.abs(value) >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (Math.abs(value) >= 1000) {
      return `${Math.round(value / 1000)}K`;
    } else {
      return Math.round(value).toString();
    }
  };

  const formatCurrencyFull = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Custom Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const riskLevel =
        data.value >= 0
          ? t('low_risk')
          : data.value >= -500000
            ? t('moderate_risk')
            : data.value >= -1000000
              ? t('high_risk')
              : t('very_high_risk');

      return (
        <div
          style={{
            backgroundColor: 'white',
            padding: '12px 16px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            border: '1px solid #e0e0e0',
            minWidth: '220px',
          }}
        >
          <p
            style={{
              margin: 0,
              fontWeight: 600,
              fontSize: '14px',
              marginBottom: '8px',
            }}
          >
            {t('simulation_outcome')} - {data.percentile}% {t('percentile')}
          </p>
          <p
            style={{
              margin: 0,
              color: getColor(data.value),
              fontSize: '13px',
              fontWeight: 500,
              marginBottom: '4px',
            }}
          >
            {t('minimum_net_worth')}: {formatCurrencyFull(data.value)}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '11px',
              color: getColor(data.value),
              fontWeight: 500,
            }}
          >
            {t('risk_level')}: {riskLevel}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '11px',
              color: '#666',
              marginTop: '6px',
            }}
          >
            {data.percentile}% {t('of_simulations_worse_than_this')}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveFullscreenChartWrapper
      targetAspectRatio={2.2} // 减少宽高比，让图表不那么扁
      baseHeight={height}
      chartType='area'
      enableFullscreen={true}
      enableMobileScaling={true}
      minMobileScale={0.6} // 提高最小缩放比例，保持更多高度
    >
      {({ height: adjustedHeight }) => (
        <ChartContent
          adjustedHeight={adjustedHeight}
          distributionData={distributionData}
          formatCurrency={formatCurrency}
          CustomTooltip={CustomTooltip}
          t={t}
        />
      )}
    </ResponsiveFullscreenChartWrapper>
  );
}

// Chart content component that can use mobile display context
function ChartContent({
  adjustedHeight,
  distributionData,
  formatCurrency,
  CustomTooltip,
  t,
}: {
  adjustedHeight: number;
  distributionData: any[];
  formatCurrency: (value: number) => string;
  CustomTooltip: React.ComponentType<any>;
  t: (key: string, variables?: Record<string, unknown>) => string;
}) {
  const { isMobilePortrait } = useMobileDisplay();

  // 计算更合理的Y轴范围
  const values = distributionData.map(d => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue;
  const padding = range * 0.15; // 上下各留15%的空间，避免过于紧凑
  const yAxisDomain = [
    Math.floor((minValue - padding) / 100000) * 100000, // 向下取整到10万
    Math.ceil((maxValue + padding) / 100000) * 100000, // 向上取整到10万
  ];

  return (
    <div
      style={{
        width: '100%',
        background: '#fafafa',
        borderRadius: '8px',
        padding: isMobilePortrait ? '8px' : '16px',
      }}
    >
      <div
        style={{
          marginBottom: isMobilePortrait ? '8px' : '16px',
          fontWeight: 600,
          fontSize: isMobilePortrait ? '14px' : '16px',
          color: '#374151',
          textAlign: 'center',
        }}
      >
        {t('minimum_net_worth_distribution')}
      </div>

      <ResponsiveContainer width='100%' height={adjustedHeight}>
        <AreaChart
          data={distributionData}
          margin={
            isMobilePortrait
              ? {
                  top: 15,
                  right: 5,
                  left: 25,
                  bottom: 35, // 增加更多底部空间给X轴标签
                }
              : {
                  top: 20,
                  right: 20,
                  left: 40,
                  bottom: 45, // 确保X轴标签有足够空间
                }
          }
        >
          <defs>
            <linearGradient
              id='distributionGradient'
              x1='0'
              y1='0'
              x2='0'
              y2='1'
            >
              <stop offset='0%' stopColor='#3b82f6' stopOpacity={0.8} />
              <stop offset='100%' stopColor='#3b82f6' stopOpacity={0.2} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray='3 3'
            stroke='#e5e7eb'
            horizontal={true}
            vertical={false}
          />

          <XAxis
            dataKey='percentile'
            axisLine={true}
            tickLine={true}
            tick={{
              fontSize: isMobilePortrait ? 10 : 12,
              fill: '#374151',
              fontWeight: 500,
              textAnchor: 'middle', // 确保文字居中对齐
            }}
            tickFormatter={value => `${value}%`}
            domain={['dataMin', 'dataMax']} // 使用数据驱动的范围
            type='number'
            allowDataOverflow={false}
            scale='linear'
            ticks={
              isMobilePortrait ? [5, 25, 50, 75, 95] : [0, 25, 50, 75, 100]
            }
            height={35}
            interval={0}
          />

          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: isMobilePortrait ? 8 : 10, fill: '#6b7280' }}
            tickFormatter={formatCurrency}
            width={isMobilePortrait ? 30 : 45} // 进一步优化Y轴宽度
            domain={yAxisDomain} // 使用计算出的合理Y轴范围
            tickCount={isMobilePortrait ? 4 : 5} // 移动端显示更少的Y轴刻度
          />

          <Tooltip content={<CustomTooltip />} />

          {/* 关键百分位参考线 - 移动端简化 */}
          {!isMobilePortrait && (
            <>
              <ReferenceLine
                x={5}
                stroke='#ef4444'
                strokeDasharray='3 3'
                strokeWidth={1}
                label={{
                  value: '5%',
                  position: 'top',
                  fontSize: 10,
                  fill: '#ef4444',
                }}
              />
              <ReferenceLine
                x={25}
                stroke='#f97316'
                strokeDasharray='3 3'
                strokeWidth={1}
                label={{
                  value: '25%',
                  position: 'top',
                  fontSize: 10,
                  fill: '#f97316',
                }}
              />
            </>
          )}

          <ReferenceLine
            x={50}
            stroke='#3b82f6'
            strokeDasharray='5 5'
            strokeWidth={2}
            label={
              !isMobilePortrait
                ? {
                    value: '50%',
                    position: 'top',
                    fontSize: 11,
                    fill: '#3b82f6',
                    fontWeight: 'bold',
                  }
                : undefined
            }
          />

          {!isMobilePortrait && (
            <>
              <ReferenceLine
                x={75}
                stroke='#10b981'
                strokeDasharray='3 3'
                strokeWidth={1}
                label={{
                  value: '75%',
                  position: 'top',
                  fontSize: 10,
                  fill: '#10b981',
                }}
              />
              <ReferenceLine
                x={95}
                stroke='#22c55e'
                strokeDasharray='3 3'
                strokeWidth={1}
                label={{
                  value: '95%',
                  position: 'top',
                  fontSize: 10,
                  fill: '#22c55e',
                }}
              />
            </>
          )}

          {/* 零线参考 */}
          <ReferenceLine
            y={0}
            stroke='#6b7280'
            strokeWidth={1}
            strokeDasharray='2 2'
          />

          <Area
            type='monotone'
            dataKey='value'
            stroke='#3b82f6'
            strokeWidth={2}
            fill='url(#distributionGradient)'
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Chart explanation - 移动端简化 */}
      {!isMobilePortrait && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#f8fafc',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              color: '#374151',
              textAlign: 'center',
              marginBottom: '8px',
              fontWeight: 500,
            }}
          >
            {t('chart_interpretation')}
          </div>
          <div
            style={{
              fontSize: '11px',
              color: '#6b7280',
              lineHeight: '1.4',
            }}
          >
            • {t('chart_x_axis_explanation')}
            <br />• {t('chart_y_axis_explanation')}
            <br />• {t('chart_reference_lines_explanation')}
            <br />• {t('chart_risk_color_explanation')}
          </div>
        </div>
      )}
    </div>
  );
}

export default MonteCarloResultsChart;
