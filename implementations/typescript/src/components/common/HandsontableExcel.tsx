/**
 * Professional Excel-like table using Handsontable
 *
 * Features:
 * - Full Excel-style multi-select (mouse drag, Shift+Click, Ctrl+Click)
 * - Advanced autofill with multiple patterns (copy, series, custom)
 * - Copy/paste from Excel/Google Sheets
 * - Keyboard navigation (arrows, Tab, Enter, F2 to edit)
 * - Context menu with Excel-style options
 * - Cell formatting and validation
 * - Undo/redo support
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { HotTable } from '@handsontable/react';
import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.css';
import {
  Card,
  Title,
  Group,
  Badge,
  Button,
  Alert,
  Text,
  Stack,
} from '@mantine/core';
import { IconTable, IconRefresh } from '@tabler/icons-react';
import type { IncomeExpenseItem } from '../../types';
import { formatCurrency } from '../../utils/helpers';

interface ExcelTableRow {
  age: number;
  year: number;
  [itemId: string]: number;
}

interface HandsontableExcelProps {
  incomeItems: IncomeExpenseItem[];
  expenseItems: IncomeExpenseItem[];
  data: ExcelTableRow[];
  overrides: Map<string, number>;
  onCellChange: (age: number, itemId: string, value: number) => void;
  onClearOverrides: () => void;
  onRefresh: () => void;
  // 添加计算原始值的函数
  calculateOriginalValue?: (age: number, itemId: string) => number;
}

export const HandsontableExcel: React.FC<HandsontableExcelProps> = ({
  incomeItems,
  expenseItems,
  data,
  overrides,
  onCellChange,
  onClearOverrides,
  onRefresh,
  calculateOriginalValue,
}) => {
  const hotRef = useRef<HotTable>(null);
  const allItems = [...incomeItems, ...expenseItems];

  // Convert data to Handsontable format (memoized to prevent infinite updates)
  const tableData = React.useMemo(() => {
    if (!data || data.length === 0) return [];

    const rows: (string | number)[][] = data.map(row => [
      row.age,
      row.year,
      ...allItems.map(item => row[item.item_id] || 0)
    ]);

    return rows;
  }, [data, allItems]);

  // Column definitions (memoized to prevent recreation)
  const columns = React.useMemo(() => [
    // Age column (read-only)
    {
      type: 'numeric',
      width: 80,
      readOnly: true,
      className: 'htCenter htMiddle',
      renderer: (instance: any, td: HTMLElement, row: number, col: number, prop: any, value: any) => {
        td.innerHTML = `<span style="
          display: inline-block;
          padding: 4px 8px;
          background: #e3f2fd;
          border-radius: 12px;
          color: #1976d2;
          font-weight: 600;
          font-size: 12px;
        ">${value}</span>`;
        td.style.textAlign = 'center';
        td.style.backgroundColor = '#f8f9fa';
        return td;
      }
    },
    // Year column (read-only)
    {
      type: 'numeric',
      width: 80,
      readOnly: true,
      className: 'htCenter htMiddle',
      renderer: (instance: any, td: HTMLElement, row: number, col: number, prop: any, value: any) => {
        td.innerHTML = String(value);
        td.style.textAlign = 'center';
        td.style.backgroundColor = '#f8f9fa';
        td.style.fontWeight = '600';
        return td;
      }
    },
    // Dynamic columns for income/expense items
    ...allItems.map((item, index) => {
      const isExpense = expenseItems.some(e => e.item_id === item.item_id);
      return {
        type: 'numeric',
        width: 140,
        numericFormat: {
          pattern: '$0,0.00',
        },
        className: 'htRight htMiddle',
        renderer: (instance: any, td: HTMLElement, row: number, col: number, prop: any, value: any) => {
          const cellValue = Number(value) || 0;
          // Get age from the instance data instead of tableData to avoid circular dependency
          const age = instance.getDataAtCell(row, 0);
          const isModified = age ? overrides.has(`${age}_${item.item_id}`) : false;

          td.innerHTML = formatCurrency(cellValue);
          td.style.textAlign = 'right';
          td.style.padding = '6px 10px';

          if (isModified) {
            td.style.backgroundColor = '#e3f2fd';
            td.style.fontWeight = '600';
            td.style.color = '#1976d2';
            td.style.borderLeft = '3px solid #1976d2';
          } else {
            td.style.backgroundColor = isExpense ? '#fff8f8' : '#f8fff8';
            td.style.fontWeight = '400';
            td.style.color = '#333';
            td.style.borderLeft = 'none';
          }

          return td;
        }
      };
    })
  ], [allItems, expenseItems, overrides]);

  // Column headers (memoized)
  const colHeaders = React.useMemo(() => [
    'Age',
    'Year',
    ...incomeItems.map(item => `💰 ${item.name}`),
    ...expenseItems.map(item => `💳 ${item.name}`)
  ], [incomeItems, expenseItems]);

  // Handle cell changes (memoized) - 这里处理override逻辑
  const handleAfterChange = useCallback((changes: any, source: string) => {
    console.log('AfterChange triggered:', { changes, source });

    if (!changes || source === 'loadData') return;

    changes.forEach(([row, col, oldValue, newValue]: [number, number, any, any]) => {
      console.log(`Cell change: [${row}, ${col}] ${oldValue} → ${newValue} (source: ${source})`);

      // Skip Age and Year columns
      if (col < 2) return;

      const itemIndex = col - 2;
      if (itemIndex >= allItems.length) return;

      const item = allItems[itemIndex];
      const age = tableData[row]?.[0];

      if (typeof age === 'number' && typeof newValue === 'number') {
        // 简化逻辑：只要值发生变化就保存override
        // autofill或手动编辑都会触发这里，都应该保存为override
        console.log(`Saving as override: age=${age}, item=${item.item_id}, value=${newValue}`);
        onCellChange(age, item.item_id, newValue);
      }
    });
  }, [allItems, tableData, onCellChange, calculateOriginalValue]);

  // Context menu configuration
  const contextMenu = {
    items: {
      'row_above': { name: 'Insert row above' },
      'row_below': { name: 'Insert row below' },
      'hsep1': '---------',
      'copy': { name: 'Copy' },
      'cut': { name: 'Cut' },
      'paste': { name: 'Paste' },
      'hsep2': '---------',
      'undo': { name: 'Undo' },
      'redo': { name: 'Redo' },
      'hsep3': '---------',
      'autofill': {
        name: 'Fill cells',
        submenu: {
          items: [
            {
              key: 'autofill:copy',
              name: 'Copy values down',
              callback: () => {
                const hot = hotRef.current?.hotInstance;
                if (hot) {
                  const selected = hot.getSelected();
                  if (selected && selected.length > 0) {
                    const [row1, col1, row2, col2] = selected[0];
                    // Copy the first row's values down to all selected rows
                    for (let row = row1 + 1; row <= row2; row++) {
                      for (let col = col1; col <= col2; col++) {
                        if (col >= 2) { // Skip Age/Year columns
                          const sourceValue = hot.getDataAtCell(row1, col);
                          hot.setDataAtCell(row, col, sourceValue);
                        }
                      }
                    }
                  }
                }
              }
            },
            {
              key: 'autofill:series',
              name: 'Smart series (detect pattern)',
              callback: () => {
                const hot = hotRef.current?.hotInstance;
                if (hot) {
                  const selected = hot.getSelected();
                  if (selected && selected.length > 0) {
                    const [row1, col1, row2, col2] = selected[0];

                    for (let col = col1; col <= col2; col++) {
                      if (col >= 2) { // Skip Age/Year columns
                        // Get first two values to detect pattern
                        const val1 = hot.getDataAtCell(row1, col) || 0;
                        const val2 = hot.getDataAtCell(row1 + 1, col);

                        if (typeof val2 === 'number' && row1 + 1 <= row2) {
                          // Use detected increment
                          const increment = val2 - val1;
                          let currentValue = val2;

                          for (let row = row1 + 2; row <= row2; row++) {
                            currentValue += increment;
                            hot.setDataAtCell(row, col, currentValue);
                          }
                        } else {
                          // Default to $2000 increment if no pattern
                          let currentValue = val1;
                          for (let row = row1 + 1; row <= row2; row++) {
                            currentValue += 2000;
                            hot.setDataAtCell(row, col, currentValue);
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            {
              key: 'autofill:growth',
              name: 'Growth pattern (3% annual)',
              callback: () => {
                const hot = hotRef.current?.hotInstance;
                if (hot) {
                  const selected = hot.getSelected();
                  if (selected && selected.length > 0) {
                    const [row1, col1, row2, col2] = selected[0];
                    // Create growth series
                    for (let row = row1; row <= row2; row++) {
                      for (let col = col1; col <= col2; col++) {
                        if (col >= 2) { // Skip Age/Year columns
                          const baseValue = hot.getDataAtCell(row1, col) || 0;
                          const years = row - row1;
                          hot.setDataAtCell(row, col, Math.round(baseValue * Math.pow(1.03, years)));
                        }
                      }
                    }
                  }
                }
              }
            }
          ]
        }
      }
    }
  };

  return (
    <Card shadow="sm" padding="lg" radius="md">
      <Group justify="space-between" mb="md">
        <Group>
          <IconTable size={24} />
          <Title order={3}>Professional Excel Table (Handsontable)</Title>
        </Group>
        <Group>
          <Badge color="blue" variant="light">
            {allItems.length} items × {data.length} years
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
          <Text fw={500}>🚀 Professional Excel Features</Text>
          <Text size="sm">
            • **Multi-select**: Drag to select, Shift+Click to extend, Ctrl+Click for multi-select
            • **Smart Fill Methods**:
              - **Drag fill handle** (small square at bottom-right) for intelligent fill
              - **Right-click → Fill cells** for advanced patterns
            • **Pattern Detection**: Select 2+ cells with different values, drag to auto-detect arithmetic series
            • **Copy/Paste**: Ctrl+C/V works with Excel/Google Sheets
            • **Navigation**: Arrow keys, Tab, Enter, F2 to edit, Escape to cancel
          </Text>
        </Stack>
      </Alert>

      <div style={{ height: 600, width: '100%' }}>
        <HotTable
          ref={hotRef}
          data={tableData}
          columns={columns}
          colHeaders={colHeaders}
          width="100%"
          height={560}
          licenseKey="non-commercial-and-evaluation"

          // Selection and navigation
          selectionMode="range"
          outsideClickDeselects={false}

          // Editing
          enterBeginsEditing={true}
          enterMoves={{row: 1, col: 0}}
          tabMoves={{row: 0, col: 1}}

          // Copy/paste
          copyPaste={true}

          // First try basic fillHandle to see if it works
          fillHandle={{
            direction: 'vertical',
            autoInsertRow: false
          }}

          // Use modifyAutofillRange hook to customize the fill behavior
          modifyAutofillRange={(start: any, end: any, data: any) => {
            console.log('modifyAutofillRange hook triggered');
            console.log('Start:', start, 'End:', end);
            console.log('Original data array:', data);

            if (!start || !end || !data || data.length === 0) {
              console.log('Invalid parameters, using default behavior');
              return data;
            }

            const startRow = start.row;
            const startCol = start.col;
            const endRow = end.row;
            const endCol = end.col;

            // Only apply custom logic for financial columns (col >= 2)
            if (startCol < 2) {
              console.log('Age/Year columns detected, using default behavior');
              return data;
            }

            console.log(`Fill area: rows ${startRow}-${endRow}, cols ${startCol}-${endCol}`);

            // Check if we have enough data to detect arithmetic pattern
            if (data.length >= 2 && data[0] && data[1]) {
              const val1 = parseFloat(data[0][0]); // First selected value
              const val2 = parseFloat(data[1][0]); // Second selected value

              if (!isNaN(val1) && !isNaN(val2)) {
                const step = val2 - val1;
                console.log(`Arithmetic pattern detected: ${val1}, ${val2}, step = ${step}`);

                // Create arithmetic sequence for the entire fill area
                const totalRows = endRow - startRow + 1;
                const result = [];

                for (let r = 0; r < totalRows; r++) {
                  const row = [];
                  for (let c = 0; c < (endCol - startCol + 1); c++) {
                    const newValue = val1 + step * r;
                    row.push(Math.round(newValue));
                  }
                  result.push(row);
                }

                console.log('Generated arithmetic sequence:', result);
                return result;
              }
            }

            // Single cell or non-numeric data: use default copy behavior
            console.log('Using default copy behavior');
            return data;
          }}

          // Context menu
          contextMenu={contextMenu}

          // Undo/redo
          undo={true}

          // Styling
          className="custom-excel-table"

          // Events
          afterChange={handleAfterChange}

          // Performance
          renderAllRows={false}
          viewportRowRenderingOffset={10}
        />
      </div>

      <Alert color="green" variant="light" mt="md">
        <Stack gap="xs">
          <Text fw={500}>💡 How to Create Patterns:</Text>
          <Text size="sm">
            **Method 1 - Drag Fill Handle**: Select cells → drag the small square at bottom-right corner
            <br />
            **Method 2 - Right-click Menu**: Select range → right-click → "Fill cells" → choose pattern
            <br />
            **For Arithmetic Series**: Enter first 2 values (e.g., 120000, 121000) → select both → drag down
            <br />
            **For Copy**: Select value → drag down (copies same value)
            <br />
            **For Growth**: Right-click → "Growth pattern" (3% compound annual growth)
          </Text>
        </Stack>
      </Alert>
    </Card>
  );
};
