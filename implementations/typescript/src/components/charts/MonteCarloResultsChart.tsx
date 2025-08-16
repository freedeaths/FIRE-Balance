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
} from 'recharts';
import { getI18n } from '../../core/i18n';

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
  height = 300
}: MonteCarloResultsChartProps): React.JSX.Element {
  const i18n = getI18n();
  const t = (key: string, variables?: Record<string, unknown>): string => i18n.t(key, variables);

  // Determine color based on value
  const getColor = (value: number): string => {
    if (value >= 0) return '#22c55e';        // Green - positive value excellent
    if (value >= -500000) return '#eab308';  // Yellow - low risk
    if (value >= -1000000) return '#f97316'; // Orange - medium risk
    return '#ef4444';                        // Red - high risk
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
      value = results.percentile_5_minimum_net_worth +
        ratio * (results.percentile_25_minimum_net_worth - results.percentile_5_minimum_net_worth);
      density = 0.02;
    } else if (percentile <= 50) {
      // Interpolation between 25% - 50%
      const ratio = (percentile - 25) / 25;
      value = results.percentile_25_minimum_net_worth +
        ratio * (results.median_minimum_net_worth - results.percentile_25_minimum_net_worth);
      density = 0.025; // Higher density around median
    } else if (percentile <= 75) {
      // Interpolation between 50% - 75%
      const ratio = (percentile - 50) / 25;
      value = results.median_minimum_net_worth +
        ratio * (results.percentile_75_minimum_net_worth - results.median_minimum_net_worth);
      density = 0.025;
    } else if (percentile <= 95) {
      // Interpolation between 75% - 95%
      const ratio = (percentile - 75) / 20;
      value = results.percentile_75_minimum_net_worth +
        ratio * (results.percentile_95_minimum_net_worth - results.percentile_75_minimum_net_worth);
      density = 0.02;
    } else {
      // 95% - 100% best case scenarios
      value = results.percentile_95_minimum_net_worth * (1 + (percentile - 95) * 0.05);
      density = 0.05; // Best 5% has high density
    }

    distributionData.push({
      percentile,
      value,
      density,
      label: `${percentile}%`,
      color: getColor(value)
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
      return (
        <div style={{
          backgroundColor: 'white',
          padding: '12px 16px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          border: '1px solid #e0e0e0',
          minWidth: '200px'
        }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
            {t('percentile')}: {data.percentile}%
          </p>
          <p style={{
            margin: 0,
            color: getColor(data.value),
            fontSize: '13px'
          }}>
            {t('minimum_net_worth')}: {formatCurrencyFull(data.value)}
          </p>
          <p style={{ margin: 0, fontSize: '12px', color: '#666', marginTop: '4px' }}>
{t('result_distribution')}: {(data.density * 100).toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: '100%', background: '#fafafa', borderRadius: '8px', padding: '16px' }}>
      <div style={{
        marginBottom: '16px',
        fontWeight: 600,
        fontSize: '16px',
        color: '#374151',
        textAlign: 'center'
      }}>
        {t('minimum_net_worth_distribution')}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={distributionData}
          margin={{
            top: 20,
            right: 20,
            left: 60,
            bottom: 40,
          }}
        >
          <defs>
            <linearGradient id="distributionGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8}/>
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.2}/>
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e5e7eb"
            horizontal={true}
            vertical={false}
          />

          <XAxis
            dataKey="percentile"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 500 }}
            tickFormatter={(value) => `${value}%`}
          />

          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickFormatter={formatCurrency}
            width={55}
          />

          <Tooltip content={<CustomTooltip />} />

          <Area
            type="monotone"
            dataKey="value"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#distributionGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Chart explanation */}
      <div style={{
        marginTop: '12px',
        fontSize: '12px',
        color: '#6b7280',
        textAlign: 'center',
        fontStyle: 'italic'
      }}>
        {t('monte_carlo_chart_explanation')}
      </div>
    </div>
  );
}

export default MonteCarloResultsChart;
