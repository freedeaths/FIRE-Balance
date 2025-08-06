/**
 * Excel-like table component using react-datasheet-grid
 *
 * Features:
 * - Multi-cell selection with drag/keyboard
 * - Copy/paste from Excel
 * - Full keyboard navigation
 * - Auto-fill with drag handle
 * - Cell editing with proper validation
 * - Override tracking and persistence
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  DataSheetGrid,
  checkboxColumn,
  textColumn,
  keyColumn,
  intColumn,
  floatColumn,
} from 'react-datasheet-grid';
import { Card, Title, Group, Badge, Button, Alert, Text, Stack } from '@mantine/core';
import { IconTable, IconRefresh, IconAlertCircle } from '@tabler/icons-react';
import type { IncomeExpenseItem } from '../../types';
import { formatCurrency } from '../../utils/helpers';

// Import the CSS for proper styling
import 'react-datasheet-grid/dist/style.css';

interface ExcelTableRow {
  age: number;
  year: number;
  [itemId: string]: number; // Dynamic columns for each income/expense item
}

interface ExcelTableProps {
  /** Income items */
  incomeItems: IncomeExpenseItem[];
  /** Expense items */
  expenseItems: IncomeExpenseItem[];
  /** Projection data */
  data: ExcelTableRow[];
  /** Override values */
  overrides: Map<string, number>;
  /** Callback when cell value changes */
  onCellChange: (age: number, itemId: string, value: number) => void;
  /** Callback to clear all overrides */
  onClearOverrides: () => void;
  /** Callback to refresh data */
  onRefresh: () => void;
}


export const ExcelTable: React.FC<ExcelTableProps> = ({
  incomeItems,
  expenseItems,
  data,
  overrides,
  onCellChange,
  onClearOverrides,
  onRefresh,
}) => {
  const [rows, setRows] = useState<ExcelTableRow[]>(data);
  const allItems = useMemo(() => [...incomeItems, ...expenseItems], [incomeItems, expenseItems]);

  // Update rows when data changes
  React.useEffect(() => {
    if (data && data.length > 0) {
      console.log('ExcelTable received data sample:', data.slice(0, 2));
      console.log('All items:', allItems.map(item => ({ name: item.name, id: item.item_id })));
      console.log('Data keys in first row:', Object.keys(data[0]));

      // Ensure all data values are properly structured
      const processedRows = data.map(row => {
        const processedRow = { ...row };
        // Ensure all numeric values are properly converted
        allItems.forEach(item => {
          if (processedRow[item.item_id] === undefined) {
            processedRow[item.item_id] = 0;
          } else {
            processedRow[item.item_id] = Number(processedRow[item.item_id]) || 0;
          }
        });
        return processedRow;
      });

      console.log('Processed rows sample:', processedRows.slice(0, 2));
      setRows(processedRows);
    } else {
      setRows([]);
    }
  }, [data, allItems]);

  // Check if a cell is modified (has override)
  const isModified = useCallback((rowIndex: number, itemId: string) => {
    if (rowIndex >= rows.length) return false;
    const age = rows[rowIndex].age;
    return overrides.has(`${age}_${itemId}`);
  }, [rows, overrides]);

  // Define columns dynamically based on items
  const columns = useMemo(() => {
    const baseColumns = [
      {
        ...intColumn,
        title: 'Age',
        key: 'age',
        disabled: true,
        width: 80,
      },
      {
        ...intColumn,
        title: 'Year',
        key: 'year',
        disabled: true,
        width: 80,
      }
    ];

    // Add income columns with proper currency formatting
    const incomeColumns = incomeItems.map(item => ({
      ...floatColumn,
      title: `💰 ${item.name}`,
      key: item.item_id,
      width: 140,
      formatValue: ({ value }: { value: number }) => formatCurrency(value || 0),
    }));

    // Add expense columns with proper currency formatting
    const expenseColumns = expenseItems.map(item => ({
      ...floatColumn,
      title: `💳 ${item.name}`,
      key: item.item_id,
      width: 140,
      formatValue: ({ value }: { value: number }) => formatCurrency(value || 0),
    }));

    console.log('Generated columns:', [...baseColumns, ...incomeColumns, ...expenseColumns].map(col => ({ title: col.title, key: col.key })));

    return [...baseColumns, ...incomeColumns, ...expenseColumns];
  }, [incomeItems, expenseItems]);

  // Handle row changes
  const handleChange = useCallback((newRows: ExcelTableRow[]) => {
    // Find what changed and trigger callbacks
    newRows.forEach((newRow, index) => {
      const oldRow = rows[index];
      if (!oldRow) return;

      allItems.forEach(item => {
        // Use the item_id as the property key since that's how we structure the data
        const oldValue = oldRow[item.item_id] || 0;
        const newValue = newRow[item.item_id] || 0;

        if (oldValue !== newValue && typeof newValue === 'number') {
          onCellChange(newRow.age, item.item_id, newValue);
        }
      });
    });

    setRows(newRows);
  }, [rows, allItems, onCellChange]);

  // Custom context menu could be added here
  const contextMenuItems = useMemo(() => [], []);

  return (
    <Card shadow="sm" padding="lg" radius="md">
      <Group justify="space-between" mb="md">
        <Group>
          <IconTable size={24} />
          <Title order={3}>Excel-style Financial Projection Table</Title>
        </Group>
        <Group>
          <Badge color="blue" variant="light">
            {allItems.length} items × {data.length} years
          </Badge>
          <Badge color="gray" variant="light">
            Rows: {rows.length}, Cols: {columns.length}
          </Badge>
          <Button
            leftSection={<IconRefresh size={16} />}
            variant="light"
            size="sm"
            onClick={onRefresh}
          >
            Refresh
          </Button>
          {overrides.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              color="gray"
              onClick={onClearOverrides}
            >
              Clear Overrides ({overrides.size})
            </Button>
          )}
        </Group>
      </Group>

      <Alert color="blue" icon={<IconTable size={16} />} mb="md">
        <Stack gap="xs">
          <Text fw={500}>💡 Excel-style Table Features</Text>
          <Text size="sm">
            • Multi-cell selection with mouse drag or Shift+Click
            • Copy/paste from Excel or Google Sheets
            • Full keyboard navigation (arrows, Tab, Enter)
            • Auto-fill by dragging selection handle
            • Double-click or F2 to edit cells
            • Modified cells highlighted in blue
          </Text>
        </Stack>
      </Alert>

      <div style={{ height: 600, width: '100%' }}>
        {rows.length > 0 ? (
          <DataSheetGrid
            value={rows}
            onChange={handleChange}
            columns={columns}
            height={560}
            rowHeight={35}
            headerRowHeight={40}
            addRowsComponent={false} // Don't allow adding rows
            disableExpandSelection={false}
            lockRows={true} // Lock row structure
            contextMenuComponent={contextMenuItems.length > 0 ? undefined : false}
          />
        ) : (
          <div style={{ height: 560, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Text c="dimmed">No data available. Loading...</Text>
          </div>
        )}
      </div>

      <Alert color="gray" variant="light" mt="md">
        <Stack gap="xs">
          <Text fw={500}>💡 Keyboard Shortcuts:</Text>
          <Text size="sm">
            • Arrow keys: Navigate • Tab/Shift+Tab: Move right/left
            • Enter/Shift+Enter: Move down/up • F2 or double-click: Edit
            • Ctrl+C/V: Copy/paste • Escape: Cancel editing
            • Shift+Click or drag: Multi-select • Ctrl+A: Select all
          </Text>
        </Stack>
      </Alert>
    </Card>
  );
};
