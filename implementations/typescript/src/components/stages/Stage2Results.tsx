/**
 * Stage 2: Interactive Financial Projection Board
 *
 * This component displays a detailed projection table with each income/expense
 * item as separate columns, allowing users to make item-specific adjustments
 * for each age. Includes Excel-like editing features and interactive charts.
 *
 * Design matches Python Streamlit version with:
 * - Item-specific columns for detailed editing
 * - Excel-style auto-fill capabilities
 * - Interactive chart visualization
 * - Override tracking system
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Stack,
  Title,
  Text,
  Button,
  NumberInput,
  Group,
  Alert,
  Badge,
  ActionIcon,
  Progress,
  Select,
  Tooltip,
} from '@mantine/core';
import {
  IconTable,
  IconAlertCircle,
  IconChartLine,
  IconCalculator,
  IconRefresh,
  IconChartBar,
} from '@tabler/icons-react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import type { IncomeExpenseItem } from '../../types';
import { FIREPlanner } from '../../core/planner';
import { formatCurrency, calculateAge } from '../../utils/helpers';
import { HandsontableExcel } from '../common/HandsontableExcel';
import { HandsontableDemo } from '../common/HandsontableDemo';
import { HandsontableOfficialDemo } from '../common/HandsontableOfficialDemo';

interface Stage2ResultsProps {
  /** FIRE planner instance */
  planner: FIREPlanner;
  /** Callback when stage is completed */
  onStageComplete: () => void;
  /** Callback to go back to previous stage */
  onGoBack: () => void;
}

/**
 * Represents one row of the detailed projection table
 */
interface DetailedProjectionRow {
  age: number;
  year: number;
  [itemId: string]: number; // Dynamic columns for each income/expense item
}

/**
 * Chart view modes
 */

/**
 * Auto-fill pattern types
 */
type AutoFillPattern = 'copy' | 'arithmetic' | 'geometric';

export const Stage2Results: React.FC<Stage2ResultsProps> = ({
  planner,
  onStageComplete,
  onGoBack,
}) => {

  // Get user profile and items
  const userProfile = planner.getUserProfile();
  const incomeItems = planner.getIncomeItems();
  const expenseItems = planner.getExpenseItems();


  // Combine all items for chart processing (memoized to prevent infinite loops)
  const allItems = useMemo(() => [...incomeItems, ...expenseItems], [incomeItems, expenseItems]);

  const [detailedProjection, setDetailedProjection] = useState<DetailedProjectionRow[]>([]);
  const [overrides, setOverrides] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [showChart, setShowChart] = useState(false);
  // Track which items are visible (clicked legend toggles visibility)
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());

  // Handle legend click to toggle item visibility (simple toggle logic)
  const handleLegendClick = (data: any) => {
    const itemName = data.dataKey || data.value;
    const item = allItems.find(item => item.name === itemName);
    if (!item) return;

    setVisibleItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(item.item_id)) {
        newSet.delete(item.item_id);
      } else {
        newSet.add(item.item_id);
      }
      return newSet;
    });
  };

  // Custom legend component that shows all items (visible and hidden)
  const CustomLegend = ({ payload }: any) => {
    return (
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '12px',
        marginTop: '8px'
      }}>
        {allItems.map(item => {
          const isVisible = visibleItems.has(item.item_id);
          const isExpense = expenseItems.some(e => e.item_id === item.item_id);
          return (
            <div
              key={item.item_id}
              onClick={() => handleLegendClick({ dataKey: item.name })}
              style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                opacity: isVisible ? 1 : 0.4,
                transition: 'opacity 0.2s'
              }}
            >
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  backgroundColor: getChartColors()[item.name],
                  marginRight: '6px',
                  borderRadius: '2px'
                }}
              />
              <span style={{
                fontSize: '12px'
              }}>
                {item.name}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // Initialize visible items when allItems are first available
  useEffect(() => {
    if (allItems.length > 0 && visibleItems.size === 0) {
      setVisibleItems(new Set(allItems.map(item => item.item_id)));
    }
  }, [allItems.length, visibleItems.size]); // Depend on both length and current size

  /**
   * Calculate item amount for specific age with proper inflation handling
   */
  const calculateItemAmountForAge = (item: IncomeExpenseItem, age: number, inflationRate: number, yearsFromNow: number): number => {
    // Check if item is active at this age
    if (age < item.start_age || (item.end_age && age > item.end_age)) {
      return 0;
    }

    // Calculate base amount with growth
    const yearsFromStart = age - item.start_age;
    const growthMultiplier = Math.pow(1 + (item.growth_rate || 0) / 100, yearsFromStart);
    let amount = item.after_tax_amount_per_period * growthMultiplier;

    // Apply frequency conversion to get annual amount
    switch (item.frequency) {
      case 'monthly':
        amount *= 12;
        break;
      case 'quarterly':
        amount *= 4;
        break;
      case 'semi_annual':
        amount *= 2;
        break;
      case 'annual':
        // Already annual
        break;
      case 'one_time':
        // Only apply in the start year
        if (age !== item.start_age) {
          amount = 0;
        }
        break;
      default:
        console.warn('Unknown frequency:', item.frequency);
        break;
    }

    // Apply inflation to expenses only (income growth is controlled by growth_rate)
    const isExpense = expenseItems.some(e => e.item_id === item.item_id);
    if (isExpense) {
      const inflationMultiplier = Math.pow(1 + inflationRate / 100, yearsFromNow);
      amount *= inflationMultiplier;
    }

    return Math.round(amount);
  };

  // Simple effect that only runs when essential data changes
  useEffect(() => {
    if (!userProfile || (incomeItems.length === 0 && expenseItems.length === 0)) {
      setDetailedProjection([]);
      return;
    }

    const currentAge = calculateAge(userProfile.birth_year);
    const projectionYears = Math.min(userProfile.life_expectancy - currentAge + 1, 50);
    const projection: DetailedProjectionRow[] = [];

    for (let i = 0; i < projectionYears; i++) {
      const age = currentAge + i;
      const year = new Date().getFullYear() + i;

      const row: DetailedProjectionRow = { age, year };

      // Calculate each item's value for this age
      allItems.forEach(item => {
        const overrideKey = `${age}_${item.item_id}`;

        if (overrides.has(overrideKey)) {
          // Use override value
          row[item.item_id] = overrides.get(overrideKey)!;
        } else {
          // Calculate based on item parameters
          row[item.item_id] = calculateItemAmountForAge(item, age, userProfile.inflation_rate, i);
        }
      });

      projection.push(row);
    }

    setDetailedProjection(projection);
  }, [
    // Only depend on primitive values that actually affect the calculation
    userProfile?.birth_year,
    userProfile?.life_expectancy,
    userProfile?.inflation_rate,
    incomeItems.length,
    expenseItems.length,
    Array.from(overrides.keys()).join(','), // Convert map to stable string
    Array.from(overrides.values()).join(',')
  ]);

  /**
   * Handle cell value override
   */
  const handleCellOverride = (age: number, itemId: string, value: number) => {
    const overrideKey = `${age}_${itemId}`;
    const newOverrides = new Map(overrides);
    newOverrides.set(overrideKey, value);
    setOverrides(newOverrides);

    // Store in planner for persistence
    planner.setOverride(age, itemId, value);
  };

  /**
   * Handle auto-fill pattern application
   */
  const handleAutoFill = (
    startAge: number,
    endAge: number,
    pattern: AutoFillPattern,
    itemId: string,
    startValue: number,
    step?: number
  ) => {
    const newOverrides = new Map(overrides);

    for (let age = startAge; age <= endAge; age++) {
      const overrideKey = `${age}_${itemId}`;
      let value: number;

      switch (pattern) {
        case 'copy':
          value = startValue;
          break;
        case 'arithmetic':
          value = startValue + (step || 0) * (age - startAge);
          break;
        case 'geometric':
          value = startValue * Math.pow(step || 1.05, age - startAge);
          break;
      }

      newOverrides.set(overrideKey, Math.round(value));
      planner.setOverride(age, itemId, Math.round(value));
    }

    setOverrides(newOverrides);
  };

  /**
   * Clear all overrides
   */
  const clearAllOverrides = () => {
    setOverrides(new Map());
    // Clear from planner as well
    if (userProfile) {
      const currentAge = calculateAge(userProfile.birth_year);
      const projectionYears = userProfile.life_expectancy - currentAge + 1;
      const allItems = [...incomeItems, ...expenseItems];

      for (let i = 0; i < projectionYears; i++) {
        const age = currentAge + i;
        allItems.forEach(item => {
          planner.removeOverride(age, item.item_id);
        });
      }
    }
  };

  /**
   * Check if stage is complete
   */
  const isStageComplete = () => {
    return detailedProjection && detailedProjection.length > 0;
  };

  /**
   * Handle continuing to Stage 3
   */
  const handleContinue = () => {
    if (isStageComplete()) {
      onStageComplete();
    }
  };

  /**
   * Refresh projection data
   */
  const handleRefresh = () => {
    setIsLoading(true);
    // Force regeneration by clearing and recreating
    setTimeout(() => {
      setDetailedProjection([]);
      // The useEffect will automatically regenerate
      setIsLoading(false);
    }, 100);
  };


  /**
   * Prepare chart data from detailed projection - matching Python logic exactly
   */
  const chartData = React.useMemo(() => {
    if (!detailedProjection || detailedProjection.length === 0) return [];

    const data = detailedProjection.map(row => {
      const chartDataPoint: any = {
        age: row.age,
        year: row.year,
      };

      // Process all items - ENSURE all items have values for all ages (including 0)
      allItems.forEach(item => {
        const value = row[item.item_id] || 0;
        const isExpense = expenseItems.some(e => e.item_id === item.item_id);

        // Always prepare data with positive for income, negative for expenses
        // Visibility is controlled by which Bar components are rendered
        const absoluteValue = Math.max(value, 0);

        if (isExpense) {
          // Expense items: convert to negative values for stackOffset="sign"
          chartDataPoint[item.name] = -absoluteValue;
        } else {
          // Income items: keep positive values
          chartDataPoint[item.name] = absoluteValue;
        }

        chartDataPoint[`${item.name}_original`] = absoluteValue;
      });

      return chartDataPoint;
    });

    // Debug: Log sample data to understand structure
    if (data.length > 0) {
      console.log('Chart data sample:', data.slice(0, 2));
      console.log('All items:', allItems.map(item => ({ name: item.name, id: item.item_id, isExpense: expenseItems.some(e => e.item_id === item.item_id) })));
      console.log('Income items:', incomeItems.map(item => item.name));
      console.log('Expense items:', expenseItems.map(item => item.name));
    }

    return data;
  }, [detailedProjection, allItems, incomeItems, expenseItems]);


  /**
   * Get chart colors for different items - green tones for income, red/orange for expenses
   */
  const getChartColors = () => {
    const incomeColors = ['#28a745', '#20c997', '#6f42c1', '#17a2b8']; // Green and blue tones
    const expenseColors = ['#dc3545', '#fd7e14', '#e83e8c', '#6c757d']; // Red and orange tones

    const colorMap: { [key: string]: string } = {};

    // Assign colors to income items
    incomeItems.forEach((item, index) => {
      colorMap[item.name] = incomeColors[index % incomeColors.length];
    });

    // Assign colors to expense items
    expenseItems.forEach((item, index) => {
      colorMap[item.name] = expenseColors[index % expenseColors.length];
    });

    return colorMap;
  };

  /**
   * Custom tooltip for the chart
   */
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'white',
          padding: '12px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>
            Age {label}
          </p>
          {payload.map((entry: any, index: number) => {
            const value = entry.value || 0;
            // Check if this is an expense item with original value stored
            const originalKey = `${entry.dataKey}_original`;
            const displayValue = entry.payload[originalKey] || Math.abs(value);
            const isExpense = expenseItems.some(e => e.name === entry.dataKey);

            return (
              <p key={index} style={{
                margin: '4px 0',
                color: entry.color,
                fontSize: '14px'
              }}>
                <span style={{ fontWeight: 'bold' }}>{entry.dataKey}</span> ({isExpense ? 'Expense' : 'Income'}): {formatCurrency(displayValue)}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Progress value={undefined} />
        <Text>Generating detailed financial projection...</Text>
      </Stack>
    );
  }

  if (!userProfile) {
    return (
      <Alert color="red" icon={<IconAlertCircle size={16} />}>
        <Stack gap="sm">
          <Text>User profile is required. Please complete Stage 1 first.</Text>
          <Button variant="outline" onClick={onGoBack}>
            Go Back to Stage 1
          </Button>
        </Stack>
      </Alert>
    );
  }

  if (detailedProjection.length === 0) {
    return (
      <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
        <Stack gap="sm">
          <Text>No projection data available. Please add income and expense items in Stage 1.</Text>
          <Button variant="outline" onClick={onGoBack}>
            Go Back to Stage 1
          </Button>
        </Stack>
      </Alert>
    );
  }

  return (
    <Stack gap="xl">
      {/* Header */}
      <div>
        <Title order={2}>Stage 2: Interactive Financial Planning Board</Title>
        <Text c="dimmed">
          Review and adjust your detailed financial projections. Each income and expense
          item is shown as a separate column that you can edit individually. Use auto-fill
          features for quick adjustments.
        </Text>
      </div>

      {/* Quick Actions Bar */}
      <Group justify="space-between">
        <Group>
          <Button
            leftSection={<IconRefresh size={16} />}
            variant="light"
            size="sm"
            onClick={handleRefresh}
          >
            Recalculate
          </Button>
          {overrides.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              color="gray"
              onClick={clearAllOverrides}
            >
              Clear All Overrides ({overrides.size})
            </Button>
          )}
        </Group>

        <Group>
          <Button
            leftSection={<IconChartBar size={16} />}
            variant={showChart ? 'filled' : 'outline'}
            size="sm"
            onClick={() => setShowChart(!showChart)}
          >
            {showChart ? 'Hide' : 'Show'} Chart
          </Button>
        </Group>
      </Group>

      {/* Basic Info */}
      <Card shadow="xs" padding="md">
        <Group justify="space-between">
          <div>
            <Text size="sm" c="dimmed">Projection Period</Text>
            <Text size="lg" fw={500}>
              {detailedProjection.length} years (Ages {detailedProjection[0]?.age || 'N/A'} - {detailedProjection[detailedProjection.length - 1]?.age || 'N/A'})
            </Text>
          </div>

          <div>
            <Text size="sm" c="dimmed">Items</Text>
            <Text size="lg" fw={500}>
              {incomeItems.length} income + {expenseItems.length} expenses
            </Text>
          </div>

          {overrides.size > 0 && (
            <div>
              <Text size="sm" c="dimmed">Modifications</Text>
              <Text size="lg" fw={500} c="blue">
                {overrides.size} cells modified
              </Text>
            </div>
          )}
        </Group>
      </Card>

      {/* Info Alert */}
      <Alert color="blue" icon={<IconTable size={16} />}>
        <Stack gap="xs">
          <Text fw={500}>💡 Item-by-Item Financial Projection</Text>
          <Text size="sm">
            This table shows each income and expense item separately across all years.
            Click any cell to edit specific values. Use auto-fill for bulk adjustments.
            No summaries or calculations - just your raw item data for precise control.
          </Text>
        </Stack>
      </Alert>

      {/* Official Demo Table for Testing */}
      <HandsontableOfficialDemo />

      {/* Custom Demo Table for Testing */}
      <HandsontableDemo />

      {/* Excel-style Table */}
      <HandsontableExcel
        incomeItems={incomeItems}
        expenseItems={expenseItems}
        data={detailedProjection}
        overrides={overrides}
        onCellChange={handleCellOverride}
        onClearOverrides={clearAllOverrides}
        onRefresh={handleRefresh}
      />

      {/* Interactive Chart */}
      {showChart && (
        <Card shadow="sm" padding="lg" radius="md">
          <Group justify="space-between" mb="md">
            <Group>
              <IconChartLine size={24} />
              <Title order={3}>Financial Projection Chart</Title>
            </Group>

            <Text size="sm" c="dimmed">
              Click legend items to show/hide individual categories
            </Text>
          </Group>

          <div style={{ height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                stackOffset="sign"
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                <XAxis
                  dataKey="age"
                  stroke="#495057"
                  fontSize={12}
                  label={{ value: 'Age', position: 'insideBottomRight', offset: -5 }}
                />
                <YAxis
                  stroke="#495057"
                  fontSize={12}
                  label={{ value: 'Amount', angle: -90, position: 'insideLeft' }}
                  domain={['dataMin - 10000', 'dataMax + 10000']}
                  tickFormatter={(value) => {
                    const absValue = Math.abs(value);
                    const sign = value >= 0 ? '+' : '-';
                    return `${sign}${formatCurrency(absValue)}`;
                  }}
                />
                <RechartsTooltip
                  formatter={(value) => [`${Math.abs(value).toLocaleString()}`, '']}
                />
                <Legend content={<CustomLegend />} />
                <ReferenceLine y={0} stroke="#000000" strokeDasharray="5 5" strokeWidth={2} opacity={0.8} />

                {/* Only render visible items - clicking legend toggles visibility */}
                {allItems
                  .filter(item => visibleItems.has(item.item_id))
                  .map(item => {
                    const isExpense = expenseItems.some(e => e.item_id === item.item_id);
                    return (
                      <Bar
                        key={item.item_id}
                        dataKey={item.name}
                        stackId="stack"
                        fill={getChartColors()[item.name]}
                        stroke={isExpense ? '#dc3545' : '#28a745'}
                        strokeWidth={1}
                        name={item.name}
                      />
                    );
                  })}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Editing Tips */}
      <Alert color="gray" variant="light">
        <Stack gap="xs">
          <Text fw={500}>💡 Pro Tips for Table Editing:</Text>
          <Text size="sm">
            • Click any cell to edit values directly • Use auto-fill for quick pattern application
            • Modified cells are highlighted in blue with a dot indicator
            • All changes are automatically saved and will be used in Stage 3 analysis
          </Text>
        </Stack>
      </Alert>

      {/* Navigation */}
      <Group justify="space-between">
        <Button variant="outline" onClick={onGoBack}>
          ← Back to Stage 1
        </Button>

        <Button
          size="lg"
          leftSection={<IconCalculator size={20} />}
          onClick={handleContinue}
          disabled={!isStageComplete()}
        >
          Continue to FIRE Analysis →
        </Button>
      </Group>
    </Stack>
  );
};
