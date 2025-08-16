/**
 * Stage3Content - Stage 3 Analysis and Results Display
 *
 * Lightweight content component focused on results display:
 * - FIRE feasibility analysis and key metrics
 * - Monte Carlo risk analysis results
 * - Smart optimization recommendations
 * - Detailed data display
 *
 * Calculation logic handled by useFIRECalculation hook
 */

import React, { useCallback, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import {
  Container,
  Card,
  Title,
  Text,
  Stack,
  Group,
  Alert,
  Table,
  Button,
  Divider,
  Checkbox,
  Slider,
  Collapse,
  Badge,
} from '@mantine/core';
import {
  IconCheck,
  IconAlertCircle,
  IconTrendingUp,
  IconChartBar,
  IconRocket,
  IconRefresh,
  IconChevronDown,
  IconChevronUp,
} from '@tabler/icons-react';
import { usePlannerStore } from '../../stores/plannerStore';
import { getI18n } from '../../core/i18n';
import { useFIRECalculation } from '../../hooks/useFIRECalculation';
import { LoadingOverlay } from '../ui/LoadingOverlay';
import { NetWorthTrajectoryChart } from '../charts/NetWorthTrajectoryChart';
import { MonteCarloResultsChart } from '../charts/MonteCarloResultsChart';
import { MonteCarloSimulator } from '../../core/monte_carlo';
import { FIREEngine, createEngineInput } from '../../core/engine';
import { createSimulationSettings } from '../../core/data_models';
import Decimal from 'decimal.js';

// =============================================================================
// Helper Functions
// =============================================================================

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatPercentage = (rate: number): string => {
  return `${(rate * 100).toFixed(1)}%`;
};


// =============================================================================
// Main Component
// =============================================================================

export function Stage3Content(): React.JSX.Element {
  // Store hooks
  const plannerStore = usePlannerStore();
  const currentStage = usePlannerStore(state => state.currentStage);

  // FIRE计算hook - 传递真实的 currentStage 来检测 stage 变化
  const {
    isCalculating,
    progress,
    error,
    results,
    hasResults
  } = useFIRECalculation(currentStage);

  // Monte Carlo 交互式状态
  const [monteCarloSettings, setMonteCarloSettings] = useState({
    numSimulations: 1000,
    includeBlackSwan: true,
  });
  const [monteCarloResult, setMonteCarloResult] = useState<{
    success_rate: number;
    mean_minimum_net_worth: number;
    percentile_5_minimum_net_worth: number;
    percentile_25_minimum_net_worth: number;
    median_minimum_net_worth: number;
    percentile_75_minimum_net_worth: number;
    percentile_95_minimum_net_worth: number;
    standard_deviation_minimum_net_worth: number;
    black_swan_impact_analysis?: {
      most_frequent_events: Record<string, number>;
      total_events_triggered: number;
      avg_events_per_simulation: number;
    } | null;
  } | null>(null);
  const [isRunningMonteCarlo, setIsRunningMonteCarlo] = useState(false);
  const [monteCarloProgress, setMonteCarloProgress] = useState(0);

  // i18n
  const i18n = getI18n();
  const t = useCallback((key: string, variables?: Record<string, unknown>): string => i18n.t(key, variables), [i18n]);

  // 移动端检测
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Monte Carlo 运行函数 - 使用现有的TypeScript核心模块
  const runInteractiveMonteCarlo = useCallback(async () => {
    if (monteCarloSettings.numSimulations < 100 || monteCarloSettings.numSimulations > 10000) {
      // TODO: 显示错误提示
      return;
    }

    // 必须有FIRE计算结果才能运行Monte Carlo
    if (!results?.fire_calculation?.yearly_results || results.fire_calculation.yearly_results.length === 0) {
      console.error('No FIRE calculation results available for Monte Carlo simulation');
      return;
    }

    setIsRunningMonteCarlo(true);
    setMonteCarloProgress(0);

    try {
      // 使用现有的TypeScript核心模块运行Monte Carlo
      const userProfile = plannerStore.data.user_profile;
      if (!userProfile) {
        throw new Error('No user profile available');
      }

      // 转换yearly_results为AnnualFinancialProjection格式
      const annualProjection = results.fire_calculation.yearly_results.map(year => ({
        age: year.age,
        year: year.year || year.age - (userProfile.birth_year ? new Date().getFullYear() - userProfile.birth_year : 40) + new Date().getFullYear(),
        total_income: new Decimal(typeof year.total_income === 'string' ? year.total_income : year.total_income.toString()),
        total_expense: new Decimal(typeof year.total_expense === 'string' ? year.total_expense : year.total_expense.toString()),
        net_cash_flow: new Decimal(typeof year.net_cash_flow === 'string' ? year.net_cash_flow : year.net_cash_flow.toString()),
        investment_return: new Decimal(typeof year.investment_return === 'string' ? year.investment_return : year.investment_return.toString()),
        portfolio_value: new Decimal(typeof year.portfolio_value === 'string' ? year.portfolio_value : year.portfolio_value.toString()),
        net_worth: new Decimal(typeof year.net_worth === 'string' ? year.net_worth : year.net_worth.toString()),
        is_sustainable: year.is_sustainable || true
      }));

      // 准备完整的UserProfile对象，确保portfolio配置完整
      const completeUserProfile = {
        ...userProfile,
        current_net_worth: new Decimal(userProfile.current_net_worth || 0),
        inflation_rate: new Decimal(userProfile.inflation_rate || 3),
        safety_buffer_months: new Decimal(userProfile.safety_buffer_months || 12),
        portfolio: userProfile.portfolio ? {
          asset_classes: userProfile.portfolio.asset_classes.map(asset => ({
            name: asset.name,
            display_name: asset.display_name,
            allocation_percentage: new Decimal(asset.allocation_percentage),
            expected_return: new Decimal(asset.expected_return),
            volatility: new Decimal(asset.volatility),
            liquidity_level: asset.liquidity_level
          })),
          enable_rebalancing: userProfile.portfolio.enable_rebalancing
        } : {
          // 默认投资组合配置
          asset_classes: [
            {
              name: 'stocks',
              display_name: 'Stocks',
              allocation_percentage: new Decimal(60),
              expected_return: new Decimal(7),
              volatility: new Decimal(15),
              liquidity_level: 'medium' as const
            },
            {
              name: 'bonds',
              display_name: 'Bonds',
              allocation_percentage: new Decimal(30),
              expected_return: new Decimal(3),
              volatility: new Decimal(5),
              liquidity_level: 'low' as const
            },
            {
              name: 'cash',
              display_name: 'Cash',
              allocation_percentage: new Decimal(10),
              expected_return: new Decimal(0.5),
              volatility: new Decimal(1),
              liquidity_level: 'high' as const
            }
          ],
          enable_rebalancing: true
        }
      };

      // 创建Engine输入 - 使用正确的函数签名
      const engineInput = createEngineInput(
        completeUserProfile,
        annualProjection,
        plannerStore.data.income_items || []
      );

      // 创建FIRE引擎
      const engine = new FIREEngine(engineInput);

      // 创建Monte Carlo设置
      const simulationSettings = createSimulationSettings({
        num_simulations: monteCarloSettings.numSimulations,
        confidence_level: new Decimal(0.95),
        include_black_swan_events: monteCarloSettings.includeBlackSwan,
        income_base_volatility: new Decimal(0.1),
        income_minimum_factor: new Decimal(0.1),
        expense_base_volatility: new Decimal(0.05),
        expense_minimum_factor: new Decimal(0.5)
      });

      // 创建Monte Carlo模拟器
      const simulator = new MonteCarloSimulator(engine, simulationSettings);

      // 运行模拟
      const monteCarloResult = await simulator.run_simulation((current: number, total: number) => {
        const progress = (current / total) * 100;
        setMonteCarloProgress(Math.min(95, progress));
      });

      setMonteCarloProgress(100);

      // 转换结果格式
      const result = {
        success_rate: monteCarloResult.success_rate.toNumber(),
        mean_minimum_net_worth: monteCarloResult.mean_minimum_net_worth?.toNumber() || 0,
        percentile_5_minimum_net_worth: monteCarloResult.percentile_5_minimum_net_worth?.toNumber() || 0,
        percentile_25_minimum_net_worth: monteCarloResult.percentile_25_minimum_net_worth?.toNumber() || 0,
        median_minimum_net_worth: monteCarloResult.median_minimum_net_worth?.toNumber() || 0,
        percentile_75_minimum_net_worth: monteCarloResult.percentile_75_minimum_net_worth?.toNumber() || 0,
        percentile_95_minimum_net_worth: monteCarloResult.percentile_95_minimum_net_worth?.toNumber() || 0,
        standard_deviation_minimum_net_worth: monteCarloResult.standard_deviation_minimum_net_worth?.toNumber() || 0,
        black_swan_impact_analysis: monteCarloResult.black_swan_impact_analysis ? {
          most_frequent_events: monteCarloResult.black_swan_impact_analysis.most_frequent_events || {},
          total_events_triggered: monteCarloResult.black_swan_impact_analysis.total_events_triggered || 0,
          avg_events_per_simulation: monteCarloResult.black_swan_impact_analysis.avg_events_per_simulation || 0
        } : null
      };

      // 短暂延迟显示完成状态
      await new Promise(resolve => setTimeout(resolve, 500));

      setMonteCarloResult(result);
    } catch (error) {
      console.error('Monte Carlo simulation error:', error);
    } finally {
      setIsRunningMonteCarlo(false);
      // 不要重置进度，让用户看到100%完成状态
    }
  }, [monteCarloSettings, results, plannerStore.data.user_profile, plannerStore.data.income_items]);

  // 准备主要内容，无论是否在计算


  // 准备数据，即使没有结果也要显示界面结构
  const fireCalculation = results?.fire_calculation;
  const yearlyStates = fireCalculation?.yearly_results || [];
  const monteCarloSuccessRate = results?.monte_carlo_success_rate;
  const recommendations = results?.recommendations || [];

  return (
    <>
      {/* FIRE 计算进度覆盖层 */}
      <LoadingOverlay
        visible={isCalculating}
        progress={progress}
        title={t('calculating_fire_feasibility')}
      />

      {/* Monte Carlo 计算进度覆盖层 */}
      <LoadingOverlay
        visible={isRunningMonteCarlo}
        progress={monteCarloProgress}
        title={t('run_monte_carlo_simulation')}
        description={`${t('running_simulations')} (${monteCarloSettings.numSimulations.toLocaleString()} ${t('simulations_word')})`}
      />

      <Container size="xl" py="md">
        <Stack gap="xl">

          {/* 如果有错误，优先显示错误 */}
          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" title={t('stage3.calculation_error_title')}>
              {t('stage3.calculation_error_message')}: {error}
            </Alert>
          )}

          {/* 如果没有计算结果，显示提示 */}
          {!hasResults && !results && !isCalculating && (
            <Alert icon={<IconAlertCircle size={16} />} color="orange" title={t('stage3.missing_results_title')}>
              {t('stage3.missing_results_message')}
            </Alert>
          )}

          {/* 有结果时显示主要内容 */}
          {(hasResults || results) && fireCalculation && (
            <>
        {/* 页面标题 */}
        <div>
          <Title order={2} mb="sm">
            {t('stage3.title')}
          </Title>
          <Text c="dimmed" mb="md">
            {t('stage3.description')}
          </Text>
        </div>

        {/* FIRE 可行性分析 */}
        <Card withBorder>
          <Group mb="md">
            <IconRocket size={24} color="var(--mantine-primary-color-6)" />
            <Title order={3}>{t('stage3.fire_feasibility.title')}</Title>
          </Group>

          {/* 关键指标 - 响应式布局 */}
          {isMobile ? (
            /* 移动端：垂直布局 */
            <Stack gap="md" mb="md">
              <div>
                <Text size="sm" c="dimmed">{t('stage3.fire_feasibility.target_age')}</Text>
                <Text size="xl" fw={700}>
                  {plannerStore.data.user_profile?.expected_fire_age} {t('stage3.fire_feasibility.years_old')}
                </Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">{t('stage3.fire_feasibility.fire_net_worth')}</Text>
                <Text size="xl" fw={700}>
                  {formatCurrency(fireCalculation.fire_net_worth)}
                </Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">{t('stage3.fire_feasibility.feasibility')}</Text>
                <Text
                  size="xl"
                  fw={700}
                  c={fireCalculation.is_fire_achievable ? "green" : "red"}
                >
                  {/* 按照 Python 版本显示 Monte Carlo 成功率或简单 bool */}
                  {monteCarloSuccessRate !== undefined ? (
                    <>
                      {fireCalculation.is_fire_achievable ? "✅" : "❌"} {formatPercentage(monteCarloSuccessRate)}
                    </>
                  ) : (
                    <>
                      {fireCalculation.is_fire_achievable ? (
                        <>✅ {t('stage3.fire_feasibility.achievable')}</>
                      ) : (
                        <>❌ {t('stage3.fire_feasibility.needs_adjustment')}</>
                      )}
                    </>
                  )}
                </Text>
              </div>
            </Stack>
          ) : (
            /* 桌面端：水平布局 */
            <Group grow mb="md">
              <div>
                <Text size="sm" c="dimmed">{t('stage3.fire_feasibility.target_age')}</Text>
                <Text size="xl" fw={700}>
                  {plannerStore.data.user_profile?.expected_fire_age} {t('stage3.fire_feasibility.years_old')}
                </Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">{t('stage3.fire_feasibility.fire_net_worth')}</Text>
                <Text size="xl" fw={700}>
                  {formatCurrency(fireCalculation.fire_net_worth)}
                </Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">{t('stage3.fire_feasibility.feasibility')}</Text>
                <Text
                  size="xl"
                  fw={700}
                  c={fireCalculation.is_fire_achievable ? "green" : "red"}
                >
                  {/* 按照 Python 版本显示 Monte Carlo 成功率或简单 bool */}
                  {monteCarloSuccessRate !== undefined ? (
                    <>
                      {fireCalculation.is_fire_achievable ? "✅" : "❌"} {formatPercentage(monteCarloSuccessRate)}
                    </>
                  ) : (
                    <>
                      {fireCalculation.is_fire_achievable ? (
                        <>✅ {t('stage3.fire_feasibility.achievable')}</>
                      ) : (
                        <>❌ {t('stage3.fire_feasibility.needs_adjustment')}</>
                      )}
                    </>
                  )}
                </Text>
              </div>
            </Group>
          )}

          {/* 结果说明 */}
          {fireCalculation.is_fire_achievable ? (
            <Alert color="green" icon={<IconCheck size={16} />} mb="md">
              {t('stage3.fire_feasibility.success_message')}
            </Alert>
          ) : (
            <Alert color="orange" icon={<IconAlertCircle size={16} />} mb="md">
              {t('stage3.fire_feasibility.adjustment_needed')}
            </Alert>
          )}

          <Divider mb="md" />

          {/* 净值轨迹图表 */}
          <NetWorthTrajectoryChart
            yearlyStates={yearlyStates}
            targetFireAge={plannerStore.data.user_profile?.expected_fire_age || 65}
            legalRetirementAge={plannerStore.data.user_profile?.legal_retirement_age || 65}
            currentAge={plannerStore.data.user_profile ?
              new Date().getFullYear() - plannerStore.data.user_profile.birth_year : 30}
            lifeExpectancy={plannerStore.data.user_profile?.life_expectancy || 85}
            fireNetWorth={fireCalculation.fire_net_worth}
            safetyBufferMonths={plannerStore.data.user_profile?.safety_buffer_months || 6}
            height={400}
            showCashFlowArea={true}
          />
        </Card>

        {/* 完整计算数据表格 - 可折叠 */}
        <Card withBorder>
          <Group mb="md">
            <IconChartBar size={24} color="var(--mantine-primary-color-6)" />
            <Title order={3}>{t('complete_calculation_data')}</Title>
          </Group>

          <Text c="dimmed" mb="md">
            {t('complete_calculation_data_description')}
          </Text>

          <YearlyDataTableSection
            data={yearlyStates}
            safetyBufferMonths={plannerStore.data.user_profile?.safety_buffer_months || 6}
            t={t}
          />
        </Card>

        {/* 智能优化建议 */}
        <Card withBorder>
          <Group mb="md">
            <IconTrendingUp size={24} color="var(--mantine-primary-color-6)" />
            <Title order={3}>{t('stage3.recommendations.title')}</Title>
          </Group>

          {recommendations.length > 0 ? (
            <Stack gap="md">
              {recommendations.map((rec, index) => {
                const achievableStatus = rec.is_achievable ? "✅" : "❌";
                let title = '';
                let description = '';

                // Map recommendation types to i18n keys and render with parameters
                switch (rec.type) {
                  case 'early_retirement':
                    title = t('early_retirement_title', rec.params);
                    description = t('early_retirement_description', rec.params);
                    break;
                  case 'delayed_retirement':
                    title = t('delayed_retirement_title', rec.params);
                    description = t('delayed_retirement_description', rec.params);
                    break;
                  case 'delayed_retirement_not_feasible':
                    title = t('delayed_retirement_not_feasible_title');
                    description = t('delayed_retirement_not_feasible_description', rec.params);
                    break;
                  case 'increase_income':
                    title = t('increase_income_title', { percentage: rec.params.percentage?.toFixed(1) });
                    description = t('increase_income_description', {
                      fireAge: rec.params.fire_age,
                      percentage: rec.params.percentage?.toFixed(1)
                    });
                    break;
                  case 'reduce_expenses':
                    title = t('reduce_expenses_title', { percentage: rec.params.percentage?.toFixed(1) });
                    description = t('reduce_expenses_description', {
                      fireAge: rec.params.fire_age,
                      percentage: rec.params.percentage?.toFixed(1)
                    });
                    break;
                  default:
                    title = `Unknown Recommendation Type: ${rec.type}`;
                    description = `Parameters: ${JSON.stringify(rec.params)}`;
                    break;
                }

                // Combine title and description in one content block (matching Python format)
                let combinedContent = `${achievableStatus} **${t('recommendation_number', { number: index + 1, content: title })}**`;
                combinedContent += `\n\n${description}`;

                // Add Monte Carlo success rate if available
                if (rec.monte_carlo_success_rate !== undefined) {
                  combinedContent += `\n\n${t('success_rate')}: ${formatPercentage(rec.monte_carlo_success_rate)}`;
                }

                return (
                  <div
                    key={index}
                    style={{
                      padding: '12px',
                      backgroundColor: rec.is_achievable ? 'var(--mantine-color-green-1)' : 'var(--mantine-color-orange-1)',
                      borderRadius: '8px'
                    }}
                  >
                    <Text
                      fw={500}
                      c={rec.is_achievable ? "green" : "orange"}
                      style={{ whiteSpace: 'pre-line' }}
                    >
                      {combinedContent}
                    </Text>
                  </div>
                );
              })}
            </Stack>
          ) : (
            <Text c="dimmed">{t('stage3.recommendations.no_recommendations')}</Text>
          )}
        </Card>

        {/* Monte Carlo 风险分析 - 交互式 */}
        <Card withBorder>
          <Group mb="md">
            <IconChartBar size={24} color="var(--mantine-primary-color-6)" />
            <Title order={3}>{t('stage3.monte_carlo.title')}</Title>
          </Group>

          <Text c="dimmed" mb="md">
            {t('stage3.monte_carlo.description')}
          </Text>

          {/* Monte Carlo 控制面板 - 响应式布局 */}
          {isMobile ? (
            /* 移动端垂直布局 */
            <Stack gap="md" mb="lg">
              {/* 运行按钮 */}
              <Button
                size="md"
                leftSection={<IconRefresh size={16} />}
                loading={isRunningMonteCarlo}
                disabled={isRunningMonteCarlo || isCalculating}
                onClick={runInteractiveMonteCarlo}
                fullWidth
              >
                {t('run_monte_carlo_simulation')}
              </Button>

              {/* 模拟次数滑块 */}
              <div>
                <Text size="sm" c="dimmed" mb="xs">
                  {t('num_simulations')}: {monteCarloSettings.numSimulations.toLocaleString()}
                </Text>
                <Slider
                  value={monteCarloSettings.numSimulations}
                  onChange={(value) => setMonteCarloSettings(prev => ({
                    ...prev,
                    numSimulations: value
                  }))}
                  min={100}
                  max={10000}
                  step={100}
                  marks={[
                    { value: 100, label: '100' },
                    { value: 1000, label: '1K' },
                    { value: 5000, label: '5K' },
                    { value: 10000, label: '10K' }
                  ]}
                  size="md"
                />
              </div>

              {/* 黑天鹅事件复选框 */}
              <Group justify="space-between" align="center">
                <Text size="sm" c="dimmed">{t('include_extreme_events')}</Text>
                <Checkbox
                  checked={monteCarloSettings.includeBlackSwan}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setMonteCarloSettings(prev => ({
                      ...prev,
                      includeBlackSwan: event.target.checked
                    }));
                  }}
                  size="md"
                />
              </Group>
            </Stack>
          ) : (
            /* 桌面端水平布局 */
            <Group mb="lg" align="center" wrap="nowrap">
              {/* 运行按钮 */}
              <Button
                size="md"
                leftSection={<IconRefresh size={16} />}
                loading={isRunningMonteCarlo}
                disabled={isRunningMonteCarlo || isCalculating}
                onClick={runInteractiveMonteCarlo}
                style={{ minWidth: '180px', flexShrink: 0 }}
              >
                {t('run_monte_carlo_simulation')}
              </Button>

              {/* 模拟次数滑块 */}
              <div style={{ flex: 1, minWidth: '200px' }}>
                <Text size="sm" c="dimmed" mb="xs">
                  {t('num_simulations')}: {monteCarloSettings.numSimulations.toLocaleString()}
                </Text>
                <Slider
                  value={monteCarloSettings.numSimulations}
                  onChange={(value) => setMonteCarloSettings(prev => ({
                    ...prev,
                    numSimulations: value
                  }))}
                  min={100}
                  max={10000}
                  step={100}
                  marks={[
                    { value: 100, label: '100' },
                    { value: 1000, label: '1K' },
                    { value: 5000, label: '5K' },
                    { value: 10000, label: '10K' }
                  ]}
                  size="md"
                />
              </div>

              {/* 黑天鹅事件复选框 */}
              <Group gap="sm" align="center" style={{ flexShrink: 0 }}>
                <Text size="sm" c="dimmed">{t('include_extreme_events')}</Text>
                <Checkbox
                  checked={monteCarloSettings.includeBlackSwan}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setMonteCarloSettings(prev => ({
                      ...prev,
                      includeBlackSwan: event.target.checked
                    }));
                  }}
                  size="md"
                />
              </Group>
            </Group>
          )}

          {/* 无结果时的提示 */}
          {!monteCarloResult && (
            <Alert icon={<IconAlertCircle size={16} />} color="orange" mb="md">
              {t('monte_carlo_instruction')}
            </Alert>
          )}

          {/* Monte Carlo 结果显示 */}
          {monteCarloResult && (
            <Stack gap="lg">
              {/* 关键指标 */}
              <Group grow>
                <div>
                  <Text size="sm" c="dimmed">{t('success_rate')}</Text>
                  <Text size="xl" fw={700} c={monteCarloResult.success_rate >= 0.7 ? 'green' : monteCarloResult.success_rate >= 0.5 ? 'orange' : 'red'}>
                    {(monteCarloResult.success_rate * 100).toFixed(1)}%
                  </Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed">{t('minimum_net_worth')}</Text>
                  <Text size="xl" fw={700} c={monteCarloResult.mean_minimum_net_worth >= 0 ? 'green' : 'red'}>
                    {formatCurrency(monteCarloResult.mean_minimum_net_worth)}
                  </Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed">{t('result_volatility')}</Text>
                  <Text size="xl" fw={700}>
                    {(monteCarloResult.standard_deviation_minimum_net_worth / Math.abs(monteCarloResult.mean_minimum_net_worth) * 100).toFixed(1)}%
                  </Text>
                </div>
              </Group>

              {/* FIRE 成功标准说明 */}
              <Alert icon={<IconAlertCircle size={16} />} color="blue">
                {t('fire_success_criteria', { months: plannerStore.data.user_profile?.safety_buffer_months || 6 })}
              </Alert>

              {/* 结果分布 */}
              <div>
                <Title order={5} mb="md">{t('result_distribution')}</Title>
                {isMobile ? (
                  /* 移动端垂直布局 */
                  <Stack gap="lg">
                    {/* 分布数据表 */}
                    <div>
                      <Table striped>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>{t('percentile')}</Table.Th>
                            <Table.Th>{t('minimum_net_worth')}</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          <Table.Tr>
                            <Table.Td>5%</Table.Td>
                            <Table.Td>{formatCurrency(monteCarloResult.percentile_5_minimum_net_worth)}</Table.Td>
                          </Table.Tr>
                          <Table.Tr>
                            <Table.Td>25%</Table.Td>
                            <Table.Td>{formatCurrency(monteCarloResult.percentile_25_minimum_net_worth)}</Table.Td>
                          </Table.Tr>
                          <Table.Tr>
                            <Table.Td>50%</Table.Td>
                            <Table.Td>{formatCurrency(monteCarloResult.median_minimum_net_worth)}</Table.Td>
                          </Table.Tr>
                          <Table.Tr>
                            <Table.Td>75%</Table.Td>
                            <Table.Td>{formatCurrency(monteCarloResult.percentile_75_minimum_net_worth)}</Table.Td>
                          </Table.Tr>
                          <Table.Tr>
                            <Table.Td>95%</Table.Td>
                            <Table.Td>{formatCurrency(monteCarloResult.percentile_95_minimum_net_worth)}</Table.Td>
                          </Table.Tr>
                        </Table.Tbody>
                      </Table>
                    </div>

                    {/* 分布图表 */}
                    <div>
                      <MonteCarloResultsChart
                        results={monteCarloResult}
                        height={250}
                      />
                    </div>
                  </Stack>
                ) : (
                  /* 桌面端水平布局 */
                  <Group>
                    <div style={{ flex: 1 }}>
                      <Table striped>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>{t('percentile')}</Table.Th>
                            <Table.Th>{t('minimum_net_worth')}</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          <Table.Tr>
                            <Table.Td>5%</Table.Td>
                            <Table.Td>{formatCurrency(monteCarloResult.percentile_5_minimum_net_worth)}</Table.Td>
                          </Table.Tr>
                          <Table.Tr>
                            <Table.Td>25%</Table.Td>
                            <Table.Td>{formatCurrency(monteCarloResult.percentile_25_minimum_net_worth)}</Table.Td>
                          </Table.Tr>
                          <Table.Tr>
                            <Table.Td>50%</Table.Td>
                            <Table.Td>{formatCurrency(monteCarloResult.median_minimum_net_worth)}</Table.Td>
                          </Table.Tr>
                          <Table.Tr>
                            <Table.Td>75%</Table.Td>
                            <Table.Td>{formatCurrency(monteCarloResult.percentile_75_minimum_net_worth)}</Table.Td>
                          </Table.Tr>
                          <Table.Tr>
                            <Table.Td>95%</Table.Td>
                            <Table.Td>{formatCurrency(monteCarloResult.percentile_95_minimum_net_worth)}</Table.Td>
                          </Table.Tr>
                        </Table.Tbody>
                      </Table>
                    </div>

                    {/* 分布图表 */}
                    <div style={{ flex: 1, marginLeft: '20px' }}>
                      <MonteCarloResultsChart
                        results={monteCarloResult}
                        height={250}
                      />
                    </div>
                  </Group>
                )}
              </div>

              {/* 风险评估 */}
              <div>
                {monteCarloResult.success_rate >= 0.9 ? (
                  <Alert color="green" icon={<IconCheck size={16} />}>
                    {t('excellent_plan')}
                  </Alert>
                ) : monteCarloResult.success_rate >= 0.7 ? (
                  <Alert color="blue" icon={<IconCheck size={16} />}>
                    {t('good_plan')}
                  </Alert>
                ) : monteCarloResult.success_rate >= 0.5 ? (
                  <Alert color="orange" icon={<IconAlertCircle size={16} />}>
                    {t('moderate_risk')}
                  </Alert>
                ) : (
                  <Alert color="red" icon={<IconAlertCircle size={16} />}>
                    {t('high_risk_plan')}
                  </Alert>
                )}
              </div>

              {/* 风险管理建议 */}
              <Card withBorder p="md" bg="blue.0">
                <Title order={5} mb="md">{t('risk_management_suggestions').split('：')[0]}</Title>
                <div style={{ whiteSpace: 'pre-line' }}>
                  <Text size="sm">
                    {t('risk_management_suggestions').split('：')[1]}
                  </Text>
                </div>
                <Divider my="md" />
                <Text size="xs" c="dimmed">
                  {t('extreme_scenarios_explanation')}
                </Text>
                <Text size="xs" c="dimmed" mt="xs">
                  {t('overall_success_vs_extreme', {
                    overall_rate: `${(monteCarloResult.success_rate * 100).toFixed(1)}%`,
                    extreme_rate: '0.0%'
                  })}
                </Text>
              </Card>

              {/* 黑天鹅事件分析 */}
              {monteCarloSettings.includeBlackSwan && monteCarloResult.black_swan_impact_analysis && (
                <div>
                  <Title order={5} mb="md">{t('extreme_risk_analysis')}</Title>

                  {/* 事件统计 */}
                  <Group grow mb="md">
                    <div>
                      <Text size="sm" c="dimmed">{t('total_events')}</Text>
                      <Text size="lg" fw={600}>
                        {monteCarloResult.black_swan_impact_analysis.total_events_triggered?.toLocaleString() || 'N/A'}
                      </Text>
                    </div>
                    <div>
                      <Text size="sm" c="dimmed">{t('average_per_simulation')}</Text>
                      <Text size="lg" fw={600}>
                        {monteCarloResult.black_swan_impact_analysis.avg_events_per_simulation?.toFixed(1) || 'N/A'}
                      </Text>
                    </div>
                  </Group>

                  {/* 事件列表 */}
                  {monteCarloResult.black_swan_impact_analysis.most_frequent_events && (
                    <div>
                      <Text size="sm" c="dimmed" mb="xs">{t('black_swan_events_occurred')}:</Text>
                      <Text size="sm" style={{ lineHeight: 1.6 }}>
                        {Object.entries(monteCarloResult.black_swan_impact_analysis.most_frequent_events)
                          .sort(([,a], [,b]) => (b as number) - (a as number))
                          .map(([eventKey, count], index, array) => (
                            <span key={eventKey}>
                              {t('event_occurrence_format', {
                                event_name: t(eventKey) || eventKey.replace('_', ' '),
                                count: String(count)
                              })}
                              {index < array.length - 1 ? ' • ' : ''}
                            </span>
                          ))
                        }
                      </Text>
                    </div>
                  )}

                  <Alert color="blue" mt="md">
                    {t('extreme_scenarios_explanation')}
                  </Alert>
                </div>
              )}
            </Stack>
          )}
        </Card>


        </>
          )}
        </Stack>
      </Container>
    </>
  );
}

// =============================================================================
// YearlyDataTableSection Component
// =============================================================================

interface YearlyDataTableSectionProps {
  data: any[];
  safetyBufferMonths: number;
  t: (key: string, variables?: Record<string, any>) => string;
}

function YearlyDataTableSection({ data, safetyBufferMonths, t }: YearlyDataTableSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 计算每年的风险状态 (safe/warning/danger)
  const getRiskStatus = (netWorth: number, totalExpense: number): 'safe' | 'warning' | 'danger' => {
    const safetyBuffer = (totalExpense * safetyBufferMonths) / 12;
    if (netWorth > safetyBuffer) return 'safe';
    if (netWorth > 0) return 'warning';
    return 'danger';
  };

  const getStatusBadge = (status: 'safe' | 'warning' | 'danger') => {
    const configs = {
      safe: { color: 'green', text: t('feasible') },
      warning: { color: 'yellow', text: t('risky') },
      danger: { color: 'red', text: t('needs_adjustment') }
    };
    const config = configs[status];
    return <Badge color={config.color} size="sm">{config.text}</Badge>;
  };

  return (
    <div>
      <Button
        variant="light"
        leftSection={isExpanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
        onClick={() => setIsExpanded(!isExpanded)}
        mb="md"
      >
        {isExpanded ? t('hide_detailed_data') : t('show_detailed_data')}
      </Button>

      <Collapse in={isExpanded}>
        <div style={{
          overflowX: 'auto',
          overflowY: 'auto',
          maxHeight: '60vh', // 限制表格最大高度，启用垂直滚动
          border: '1px solid var(--mantine-color-gray-3)',
          borderRadius: '4px'
        }}>
          <Table striped highlightOnHover>
            <Table.Thead style={{
              position: 'sticky',
              top: 0,
              backgroundColor: 'var(--mantine-color-gray-0)',
              zIndex: 10,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <Table.Tr>
                <Table.Th style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>{t('age')}</Table.Th>
                <Table.Th style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>{t('year')}</Table.Th>
                <Table.Th style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>{t('total_income')}</Table.Th>
                <Table.Th style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>{t('total_expense')}</Table.Th>
                <Table.Th style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>{t('net_cash_flow')}</Table.Th>
                <Table.Th style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>{t('investment_return')}</Table.Th>
                <Table.Th style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>{t('portfolio_value')}</Table.Th>
                <Table.Th style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>{t('net_worth')}</Table.Th>
                <Table.Th style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>{t('status')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.map((yearlyState, index) => {
                const netWorth = typeof yearlyState.net_worth === 'object'
                  ? yearlyState.net_worth.toNumber()
                  : yearlyState.net_worth;
                const totalIncome = typeof yearlyState.total_income === 'object'
                  ? yearlyState.total_income.toNumber()
                  : yearlyState.total_income;
                const totalExpense = typeof yearlyState.total_expense === 'object'
                  ? yearlyState.total_expense.toNumber()
                  : yearlyState.total_expense;
                const netCashFlow = typeof yearlyState.net_cash_flow === 'object'
                  ? yearlyState.net_cash_flow.toNumber()
                  : yearlyState.net_cash_flow;
                const investmentReturn = typeof yearlyState.investment_return === 'object'
                  ? yearlyState.investment_return.toNumber()
                  : yearlyState.investment_return;
                const portfolioValue = typeof yearlyState.portfolio_value === 'object'
                  ? yearlyState.portfolio_value.toNumber()
                  : yearlyState.portfolio_value;

                const riskStatus = getRiskStatus(netWorth, totalExpense);

                return (
                  <Table.Tr key={index}>
                    <Table.Td>{yearlyState.age}</Table.Td>
                    <Table.Td>{yearlyState.year}</Table.Td>
                    <Table.Td>{formatCurrency(totalIncome)}</Table.Td>
                    <Table.Td>{formatCurrency(totalExpense)}</Table.Td>
                    <Table.Td style={{ color: netCashFlow >= 0 ? 'green' : 'red' }}>
                      {formatCurrency(netCashFlow)}
                    </Table.Td>
                    <Table.Td>{formatCurrency(investmentReturn)}</Table.Td>
                    <Table.Td>{formatCurrency(portfolioValue)}</Table.Td>
                    <Table.Td style={{ color: netWorth >= 0 ? 'green' : 'red' }}>
                      {formatCurrency(netWorth)}
                    </Table.Td>
                    <Table.Td>
                      {getStatusBadge(riskStatus)}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </div>
      </Collapse>
    </div>
  );
}

export default Stage3Content;
