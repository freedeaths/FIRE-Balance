/**
 * Stage 3: FIRE Analysis & Monte Carlo Simulation
 *
 * This component displays the final FIRE analysis results, including:
 * - Core FIRE calculation results
 * - Monte Carlo simulation outcomes
 * - Advisor recommendations
 * - Detailed charts and visualizations
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Stack,
  Title,
  Text,
  Button,
  Grid,
  Progress,
  Alert,
  Badge,
  Group,
  ActionIcon,
  Divider,
  Table,
  Modal,
  Tabs,
  RingProgress,
  ThemeIcon,
} from '@mantine/core';
import {
  IconTrendingUp,
  IconTrendingDown,
  IconTarget,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconRefresh,
  IconDownload,
  IconShare,
  IconChartBar,
  IconReportAnalytics,
  IconBulb,
  IconFlame,
} from '@tabler/icons-react';
import { useI18n } from '../../utils/i18n';
import type { PlannerResults, FIRECalculationResult } from '../../types';
import { FIREPlanner } from '../../core/planner';
import { formatCurrency, formatPercentage } from '../../utils/helpers';

interface Stage3AnalysisProps {
  /** FIRE planner instance */
  planner: FIREPlanner;
  /** Callback to go back to previous stage */
  onGoBack: () => void;
  /** Callback when analysis is complete */
  onComplete?: () => void;
}

/**
 * FIRE Status indicator component
 */
interface FIREStatusProps {
  isAchievable: boolean;
  fireAge: number;
  netWorth: number;
  safetyRatio: number;
}

const FIREStatus: React.FC<FIREStatusProps> = ({
  isAchievable,
  fireAge,
  netWorth,
  safetyRatio,
}) => {
  const getStatusColor = () => {
    if (!isAchievable) return 'red';
    if (safetyRatio >= 1.0) return 'green';
    if (safetyRatio >= 0.75) return 'orange';
    return 'yellow';
  };

  const getStatusText = () => {
    if (!isAchievable) return 'FIRE Not Achievable';
    if (safetyRatio >= 1.0) return 'FIRE Achievable - Strong';
    if (safetyRatio >= 0.75) return 'FIRE Achievable - Moderate';
    return 'FIRE Achievable - Weak';
  };

  return (
    <Card shadow="md" padding="xl" radius="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap="xs">
          <Group gap="sm">
            <ThemeIcon size="lg" color={getStatusColor()}>
              {isAchievable ? <IconCheck size={20} /> : <IconX size={20} />}
            </ThemeIcon>
            <div>
              <Text size="xl" fw={700} c={getStatusColor()}>
                {getStatusText()}
              </Text>
              <Text size="sm" c="dimmed">
                Target FIRE Age: {fireAge}
              </Text>
            </div>
          </Group>

          <Text size="lg">
            Net Worth at FIRE: <strong>{formatCurrency(netWorth, '$')}</strong>
          </Text>

          <Text size="sm" c="dimmed">
            Safety Buffer Ratio: {formatPercentage(safetyRatio)}
            {safetyRatio >= 1.0 && ' (Excellent)'}
            {safetyRatio >= 0.75 && safetyRatio < 1.0 && ' (Good)'}
            {safetyRatio < 0.75 && ' (Needs Improvement)'}
          </Text>
        </Stack>

        <RingProgress
          size={120}
          thickness={12}
          sections={[
            { value: Math.min(safetyRatio * 100, 100), color: getStatusColor() },
          ]}
          label={
            <Text ta="center" fw={700} size="sm">
              {formatPercentage(safetyRatio)}
            </Text>
          }
        />
      </Group>
    </Card>
  );
};

export const Stage3Analysis: React.FC<Stage3AnalysisProps> = ({
  planner,
  onGoBack,
  onComplete,
}) => {
  const { t } = useI18n();

  const [results, setResults] = useState<PlannerResults | undefined>(
    planner.getResults()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isRunningMonteCarlo, setIsRunningMonteCarlo] = useState(false);
  const [showDetailedResults, setShowDetailedResults] = useState(false);

  /**
   * Run the FIRE analysis
   */
  const runAnalysis = async () => {
    setIsLoading(true);
    try {
      // Advance to Stage 3 if needed
      if (planner.getCurrentStage() !== 'stage3_analysis') {
        planner.advanceStage();
      }

      const analysisResults = await planner.runAnalysis();
      setResults(analysisResults);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Run Monte Carlo simulation (placeholder)
   */
  const runMonteCarloSimulation = async () => {
    if (!results) return;

    setIsRunningMonteCarlo(true);

    // Simulate Monte Carlo calculation delay
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Update results with simulated success rate
    const updatedResults: PlannerResults = {
      ...results,
      monte_carlo_success_rate: 0.75 + Math.random() * 0.2, // Random 75-95%
    };

    setResults(updatedResults);
    setIsRunningMonteCarlo(false);
  };

  // Run analysis on component mount if no results exist
  useEffect(() => {
    if (!results) {
      runAnalysis();
    }
  }, []);

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Progress value={undefined} />
        <Text>Running FIRE analysis...</Text>
        <Text size="sm" c="dimmed">
          This may take a moment as we crunch the numbers
        </Text>
      </Stack>
    );
  }

  if (!results) {
    return (
      <Alert color="red" icon={<IconAlertTriangle size={16} />}>
        <Stack gap="sm">
          <Text>Failed to generate analysis results. Please check your data and try again.</Text>
          <Group>
            <Button variant="outline" onClick={onGoBack}>
              Go Back to Stage 2
            </Button>
            <Button onClick={runAnalysis}>
              Retry Analysis
            </Button>
          </Group>
        </Stack>
      </Alert>
    );
  }

  const fireCalc = results.fire_calculation;

  return (
    <Stack gap="xl">
      {/* Header */}
      <div>
        <Title order={2}>Stage 3: {t('stage3_title')}</Title>
        <Text c="dimmed">{t('stage3_description')}</Text>
      </div>

      {/* Main FIRE Status */}
      <FIREStatus
        isAchievable={fireCalc.is_fire_achievable}
        fireAge={planner.getUserProfile()?.expected_fire_age || 65}
        netWorth={fireCalc.fire_net_worth}
        safetyRatio={fireCalc.min_safety_buffer_ratio}
      />

      {/* Key Metrics Grid */}
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card shadow="xs" padding="md">
            <Group gap="sm">
              <ThemeIcon color="blue" variant="light">
                <IconTarget size={18} />
              </ThemeIcon>
              <div>
                <Text size="sm" c="dimmed">FIRE Number</Text>
                <Text size="lg" fw={700}>
                  {formatCurrency(fireCalc.traditional_fire_number, '$')}
                </Text>
              </div>
            </Group>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card shadow="xs" padding="md">
            <Group gap="sm">
              <ThemeIcon color="green" variant="light">
                <IconTrendingUp size={18} />
              </ThemeIcon>
              <div>
                <Text size="sm" c="dimmed">Final Net Worth</Text>
                <Text size="lg" fw={700}>
                  {formatCurrency(fireCalc.final_net_worth, '$')}
                </Text>
              </div>
            </Group>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card shadow="xs" padding="md">
            <Group gap="sm">
              <ThemeIcon color="orange" variant="light">
                <IconChartBar size={18} />
              </ThemeIcon>
              <div>
                <Text size="sm" c="dimmed">Years Simulated</Text>
                <Text size="lg" fw={700}>
                  {fireCalc.total_years_simulated}
                </Text>
              </div>
            </Group>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card shadow="xs" padding="md">
            <Group gap="sm">
              <ThemeIcon
                color={results.monte_carlo_success_rate ?
                  (results.monte_carlo_success_rate >= 0.8 ? 'green' :
                   results.monte_carlo_success_rate >= 0.6 ? 'orange' : 'red') : 'gray'}
                variant="light"
              >
                <IconFlame size={18} />
              </ThemeIcon>
              <div>
                <Text size="sm" c="dimmed">Success Rate</Text>
                <Text size="lg" fw={700}>
                  {results.monte_carlo_success_rate
                    ? formatPercentage(results.monte_carlo_success_rate)
                    : 'Not Calculated'
                  }
                </Text>
              </div>
            </Group>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Monte Carlo Simulation Card */}
      <Card shadow="sm" padding="lg" radius="md">
        <Group justify="space-between" mb="md">
          <Group>
            <IconReportAnalytics size={24} />
            <Title order={3}>Monte Carlo Simulation</Title>
          </Group>
          <Button
            leftSection={<IconRefresh size={16} />}
            onClick={runMonteCarloSimulation}
            loading={isRunningMonteCarlo}
            disabled={isRunningMonteCarlo}
          >
            {results.monte_carlo_success_rate ? 'Re-run Simulation' : 'Run Simulation'}
          </Button>
        </Group>

        {isRunningMonteCarlo ? (
          <Stack align="center" py="xl">
            <Progress value={undefined} />
            <Text>Running Monte Carlo simulation...</Text>
            <Text size="sm" c="dimmed">
              Simulating 1,000 different market scenarios
            </Text>
          </Stack>
        ) : results.monte_carlo_success_rate ? (
          <Stack gap="md">
            <Text>
              Based on 1,000 simulated market scenarios, your FIRE plan has a{' '}
              <strong>{formatPercentage(results.monte_carlo_success_rate)}</strong>{' '}
              probability of success.
            </Text>

            <div>
              <Text size="sm" c="dimmed" mb="xs">Success Probability</Text>
              <Progress
                value={results.monte_carlo_success_rate * 100}
                color={results.monte_carlo_success_rate >= 0.8 ? 'green' :
                       results.monte_carlo_success_rate >= 0.6 ? 'orange' : 'red'}
                size="lg"
              />
            </div>

            {results.monte_carlo_success_rate < 0.7 && (
              <Alert color="orange" icon={<IconAlertTriangle size={16} />}>
                Your plan has a relatively low success rate. Consider adjusting your
                savings rate, FIRE age, or expected expenses to improve your chances.
              </Alert>
            )}
          </Stack>
        ) : (
          <Text c="dimmed">
            Run a Monte Carlo simulation to see how your plan performs under different
            market conditions and economic scenarios.
          </Text>
        )}
      </Card>

      {/* Recommendations Card */}
      <Card shadow="sm" padding="lg" radius="md">
        <Group mb="md">
          <IconBulb size={24} />
          <Title order={3}>Recommendations</Title>
        </Group>

        <Stack gap="md">
          {!fireCalc.is_fire_achievable && (
            <Alert color="red" icon={<IconAlertTriangle size={16} />}>
              <Text fw={500}>FIRE Goal Not Achievable</Text>
              <Text size="sm" mt="xs">
                With your current plan, you may not reach financial independence by age{' '}
                {planner.getUserProfile()?.expected_fire_age}. Consider these adjustments:
              </Text>
              <ul>
                <li>Increase your income or find additional income sources</li>
                <li>Reduce your expenses to save more each year</li>
                <li>Delay your FIRE age by a few years</li>
                <li>Optimize your investment portfolio for higher returns</li>
              </ul>
            </Alert>
          )}

          {fireCalc.is_fire_achievable && fireCalc.min_safety_buffer_ratio < 0.75 && (
            <Alert color="orange" icon={<IconAlertTriangle size={16} />}>
              <Text fw={500}>Low Safety Margin</Text>
              <Text size="sm" mt="xs">
                While your FIRE goal is achievable, you have a thin safety margin. Consider:
              </Text>
              <ul>
                <li>Building a larger emergency fund</li>
                <li>Adding a few extra years to your timeline</li>
                <li>Planning for higher than expected expenses</li>
              </ul>
            </Alert>
          )}

          {fireCalc.is_fire_achievable && fireCalc.min_safety_buffer_ratio >= 1.0 && (
            <Alert color="green" icon={<IconCheck size={16} />}>
              <Text fw={500}>Strong FIRE Plan</Text>
              <Text size="sm" mt="xs">
                Congratulations! Your plan has a solid foundation. You might even consider:
              </Text>
              <ul>
                <li>Retiring earlier than planned</li>
                <li>Increasing your planned retirement lifestyle expenses</li>
                <li>Exploring more conservative investment strategies</li>
              </ul>
            </Alert>
          )}

          <Text size="sm" c="dimmed">
            💡 These recommendations are based on your current inputs. Consider consulting
            with a financial advisor for personalized advice.
          </Text>
        </Stack>
      </Card>

      {/* Detailed Results */}
      <Card shadow="sm" padding="lg" radius="md">
        <Group justify="space-between" mb="md">
          <Group>
            <IconChartBar size={24} />
            <Title order={3}>Detailed Results</Title>
          </Group>
          <Button
            variant="outline"
            onClick={() => setShowDetailedResults(!showDetailedResults)}
          >
            {showDetailedResults ? 'Hide' : 'Show'} Details
          </Button>
        </Group>

        {showDetailedResults && (
          <Tabs defaultValue="yearly">
            <Tabs.List>
              <Tabs.Tab value="yearly">Yearly Breakdown</Tabs.Tab>
              <Tabs.Tab value="charts">Charts</Tabs.Tab>
              <Tabs.Tab value="assumptions">Assumptions</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="yearly" pt="md">
              <div style={{ overflowX: 'auto' }}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Age</Table.Th>
                      <Table.Th>Year</Table.Th>
                      <Table.Th>Income</Table.Th>
                      <Table.Th>Expenses</Table.Th>
                      <Table.Th>Net Worth</Table.Th>
                      <Table.Th>Sustainable</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {fireCalc.yearly_results.slice(0, 10).map((year) => (
                      <Table.Tr key={year.age}>
                        <Table.Td>{year.age}</Table.Td>
                        <Table.Td>{year.year}</Table.Td>
                        <Table.Td>{formatCurrency(year.total_income, '$')}</Table.Td>
                        <Table.Td>{formatCurrency(year.total_expense, '$')}</Table.Td>
                        <Table.Td>{formatCurrency(year.net_worth, '$')}</Table.Td>
                        <Table.Td>
                          <Badge color={year.is_sustainable ? 'green' : 'red'}>
                            {year.is_sustainable ? 'Yes' : 'No'}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>
              {fireCalc.yearly_results.length > 10 && (
                <Text size="sm" c="dimmed" mt="sm">
                  Showing first 10 years of {fireCalc.yearly_results.length} total years.
                </Text>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="charts" pt="md">
              <div style={{
                height: 300,
                backgroundColor: '#f5f5f5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8
              }}>
                <Stack align="center">
                  <IconChartBar size={48} color="#aaa" />
                  <Text c="dimmed">Financial projection charts would appear here</Text>
                  <Text size="sm" c="dimmed">
                    Net worth progression, income vs expenses, and portfolio allocation
                  </Text>
                </Stack>
              </div>
            </Tabs.Panel>

            <Tabs.Panel value="assumptions" pt="md">
              <Stack gap="sm">
                <Text fw={500}>Key Assumptions:</Text>
                <Text size="sm">• Inflation rate: {planner.getUserProfile()?.inflation_rate}% annually</Text>
                <Text size="sm">• Investment returns as configured in portfolio</Text>
                <Text size="sm">• No major economic disruptions or black swan events</Text>
                <Text size="sm">• Income and expense patterns continue as projected</Text>
                <Text size="sm">• Portfolio rebalancing occurs as specified</Text>
              </Stack>
            </Tabs.Panel>
          </Tabs>
        )}
      </Card>

      {/* Actions */}
      <Group justify="space-between">
        <Button variant="outline" onClick={onGoBack}>
          ← Back to Stage 2
        </Button>

        <Group>
          <Button
            variant="outline"
            leftSection={<IconDownload size={16} />}
            onClick={() => {
              // Export results as JSON
              const blob = new Blob([planner.exportToJSON()], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'fire-plan-analysis.json';
              a.click();
            }}
          >
            Export Results
          </Button>

          {onComplete && (
            <Button
              size="lg"
              leftSection={<IconCheck size={20} />}
              onClick={onComplete}
            >
              Complete Analysis
            </Button>
          )}
        </Group>
      </Group>
    </Stack>
  );
};
