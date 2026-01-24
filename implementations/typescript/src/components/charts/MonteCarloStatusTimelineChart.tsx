/**
 * MonteCarloStatusTimelineChart
 * Shows per-year status distribution (safe/warning/danger) across Monte Carlo runs.
 */

import React, { useMemo } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getI18n } from '../../core/i18n';
import { ResponsiveFullscreenChartWrapper } from './ResponsiveFullscreenChartWrapper';

export interface MonteCarloYearlyStatusRatesRow {
  age: number;
  year: number;
  safe: number; // 0..1
  warning: number; // 0..1
  danger: number; // 0..1
}

interface MonteCarloStatusTimelineChartProps {
  data: MonteCarloYearlyStatusRatesRow[];
  height?: number;
}

export function MonteCarloStatusTimelineChart({
  data,
  height = 260,
}: MonteCarloStatusTimelineChartProps): React.JSX.Element {
  const i18n = getI18n();
  const t = (key: string, variables?: Record<string, unknown>): string =>
    i18n.t(key, variables);

  const isMobile = useMediaQuery('(max-width: 768px)');
  const isPortrait = useMediaQuery('(orientation: portrait)');
  const isMobilePortrait = Boolean(isMobile && isPortrait);

  const chartData = useMemo(() => {
    return data.map(d => ({
      age: d.age,
      year: d.year,
      safePct: d.safe * 100,
      warningPct: d.warning * 100,
      dangerPct: d.danger * 100,
    }));
  }, [data]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const p = payload[0]?.payload;
    return (
      <div
        style={{
          backgroundColor: 'white',
          padding: '10px 12px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          border: '1px solid #e0e0e0',
          minWidth: '220px',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>
          {t('age')}: {p.age} · {t('year')}: {p.year}
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.5 }}>
          <div style={{ color: '#16a34a' }}>
            🟢 {t('feasible')}: {p.safePct.toFixed(1)}%
          </div>
          <div style={{ color: '#ca8a04' }}>
            🟡 {t('risky')}: {p.warningPct.toFixed(1)}%
          </div>
          <div style={{ color: '#dc2626' }}>
            🔴 {t('needs_adjustment')}: {p.dangerPct.toFixed(1)}%
          </div>
        </div>
      </div>
    );
  };

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
        {t('monte_carlo_status_timeline_title')}
      </div>

      <ResponsiveFullscreenChartWrapper
        targetAspectRatio={2.6}
        baseHeight={height}
        chartType='area'
        enableFullscreen={true}
        enableMobileScaling={true}
        minMobileScale={0.6}
      >
        {({ height: adjustedHeight }) => (
          <ChartContent
            adjustedHeight={adjustedHeight}
            chartData={chartData}
            t={t}
            CustomTooltip={CustomTooltip}
            isMobilePortrait={isMobilePortrait}
          />
        )}
      </ResponsiveFullscreenChartWrapper>

      {!isMobilePortrait && (
        <div
          style={{
            marginTop: '10px',
            fontSize: '12px',
            color: '#6b7280',
            textAlign: 'center',
          }}
        >
          {t('monte_carlo_status_timeline_help')}
        </div>
      )}
    </div>
  );
}

function ChartContent({
  adjustedHeight,
  chartData,
  t,
  CustomTooltip,
  isMobilePortrait,
}: {
  adjustedHeight: number;
  chartData: any[];
  t: (key: string, variables?: Record<string, unknown>) => string;
  CustomTooltip: React.ComponentType<any>;
  isMobilePortrait: boolean;
}) {
  const xTicks = useMemo(() => {
    if (!chartData.length) return undefined;
    const minAge = chartData[0].age as number;
    const maxAge = chartData[chartData.length - 1].age as number;
    const maxTicks = isMobilePortrait ? 6 : 10;
    const span = Math.max(1, maxAge - minAge);
    const step = Math.max(1, Math.round(span / Math.max(1, maxTicks - 1)));

    const ticks: number[] = [];
    for (let age = minAge; age <= maxAge; age += step) {
      ticks.push(age);
    }
    if (ticks[ticks.length - 1] !== maxAge) ticks.push(maxAge);
    return ticks;
  }, [chartData, isMobilePortrait]);

  return (
    <ResponsiveContainer width='100%' height={adjustedHeight}>
      <AreaChart
        data={chartData}
        margin={
          isMobilePortrait
            ? { top: 10, right: 6, left: 6, bottom: 28 }
            : { top: 10, right: 18, left: 10, bottom: 32 }
        }
      >
        <CartesianGrid strokeDasharray='3 3' stroke='#e5e7eb' />

        <XAxis
          dataKey='age'
          type='number'
          domain={['dataMin', 'dataMax']}
          tick={{ fontSize: isMobilePortrait ? 10 : 12, fill: '#374151' }}
          tickFormatter={value => String(Math.round(value))}
          height={28}
          ticks={xTicks}
          interval={0}
          tickMargin={6}
          label={{
            value: t('age'),
            position: 'insideBottomRight',
            offset: -18,
            style: {
              fill: '#6b7280',
              fontSize: isMobilePortrait ? 10 : 12,
            },
          }}
        />

        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: isMobilePortrait ? 10 : 12, fill: '#6b7280' }}
          tickFormatter={value => `${Math.round(value)}%`}
          width={isMobilePortrait ? 34 : 44}
          ticks={[0, 25, 50, 75, 100]}
          allowDecimals={false}
        />

        <Tooltip content={<CustomTooltip />} />

        <Area
          type='monotone'
          dataKey='dangerPct'
          name='🔴'
          stackId='1'
          stroke='none'
          fill='#ef4444'
          fillOpacity={0.7}
        />
        <Area
          type='monotone'
          dataKey='warningPct'
          name='🟡'
          stackId='1'
          stroke='none'
          fill='#eab308'
          fillOpacity={0.7}
        />
        <Area
          type='monotone'
          dataKey='safePct'
          name='🟢'
          stackId='1'
          stroke='none'
          fill='#22c55e'
          fillOpacity={0.7}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default MonteCarloStatusTimelineChart;
