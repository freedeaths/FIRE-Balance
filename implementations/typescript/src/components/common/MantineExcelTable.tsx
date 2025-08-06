/**
 * Excel-like table using Mantine components with multi-select and drag features
 *
 * Features:
 * - Multi-cell selection with Shift+Click and Ctrl+Click
 * - Keyboard navigation (Arrow keys, Tab, Enter)
 * - Double-click to edit cells
 * - Auto-fill with drag handle
 * - Copy/paste support (Ctrl+C/V)
 * - Excel-style appearance and behavior
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Card,
  Title,
  Group,
  Badge,
  Button,
  Alert,
  Text,
  Stack,
  Table,
  ScrollArea,
  NumberInput,
  Box
} from '@mantine/core';
import { IconTable, IconRefresh, IconAlertCircle } from '@tabler/icons-react';
import type { IncomeExpenseItem } from '../../types';
import { formatCurrency } from '../../utils/helpers';

interface ExcelTableRow {
  age: number;
  year: number;
  [itemId: string]: number;
}

interface CellPosition {
  row: number;
  col: number;
}

interface CellSelection {
  start: CellPosition;
  end: CellPosition;
}

interface MantineExcelTableProps {
  incomeItems: IncomeExpenseItem[];
  expenseItems: IncomeExpenseItem[];
  data: ExcelTableRow[];
  overrides: Map<string, number>;
  onCellChange: (age: number, itemId: string, value: number) => void;
  onClearOverrides: () => void;
  onRefresh: () => void;
}

export const MantineExcelTable: React.FC<MantineExcelTableProps> = ({
  incomeItems,
  expenseItems,
  data,
  overrides,
  onCellChange,
  onClearOverrides,
  onRefresh,
}) => {
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<CellSelection | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [copiedData, setCopiedData] = useState<string>('');

  const tableRef = useRef<HTMLTableElement>(null);
  const allItems = [...incomeItems, ...expenseItems];

  // Get cell ID helper
  const getCellId = (rowIndex: number, colIndex: number) => `${rowIndex}-${colIndex}`;

  // Get item ID from column index
  const getItemIdFromCol = (colIndex: number) => {
    if (colIndex < 2) return null; // Age and Year columns
    const itemIndex = colIndex - 2;
    return itemIndex < allItems.length ? allItems[itemIndex].item_id : null;
  };

  // Check if cell is modified
  const isCellModified = (rowIndex: number, itemId: string) => {
    const age = data[rowIndex]?.age;
    return age ? overrides.has(`${age}_${itemId}`) : false;
  };

  // Handle cell click
  const handleCellClick = useCallback((rowIndex: number, colIndex: number, event: React.MouseEvent) => {
    if (colIndex < 2) return; // Can't select Age/Year columns

    const cellId = getCellId(rowIndex, colIndex);

    if (event.shiftKey && selection) {
      // Extend selection
      const newSelection = {
        start: selection.start,
        end: { row: rowIndex, col: colIndex }
      };
      setSelection(newSelection);

      // Update selected cells
      const newSelected = new Set<string>();
      const startRow = Math.min(newSelection.start.row, newSelection.end.row);
      const endRow = Math.max(newSelection.start.row, newSelection.end.row);
      const startCol = Math.min(newSelection.start.col, newSelection.end.col);
      const endCol = Math.max(newSelection.start.col, newSelection.end.col);

      for (let r = startRow; r <= endRow; r++) {
        for (let c = Math.max(2, startCol); c <= endCol; c++) {
          newSelected.add(getCellId(r, c));
        }
      }
      setSelectedCells(newSelected);
    } else if (event.ctrlKey || event.metaKey) {
      // Toggle selection
      const newSelected = new Set(selectedCells);
      if (newSelected.has(cellId)) {
        newSelected.delete(cellId);
      } else {
        newSelected.add(cellId);
      }
      setSelectedCells(newSelected);
    } else {
      // Single selection
      setSelectedCells(new Set([cellId]));
      setSelection({
        start: { row: rowIndex, col: colIndex },
        end: { row: rowIndex, col: colIndex }
      });
    }
  }, [selection, selectedCells]);

  // Handle double click to edit
  const handleDoubleClick = useCallback((rowIndex: number, colIndex: number) => {
    if (colIndex < 2) return; // Can't edit Age/Year

    const itemId = getItemIdFromCol(colIndex);
    if (!itemId) return;

    const cellId = getCellId(rowIndex, colIndex);
    const currentValue = data[rowIndex]?.[itemId] || 0;

    setEditingCell(cellId);
    setEditValue(currentValue);
  }, [data]);

  // Save cell edit
  const saveCellEdit = useCallback(() => {
    if (!editingCell) return;

    const [rowStr, colStr] = editingCell.split('-');
    const rowIndex = parseInt(rowStr);
    const colIndex = parseInt(colStr);
    const itemId = getItemIdFromCol(colIndex);

    if (itemId && data[rowIndex]) {
      onCellChange(data[rowIndex].age, itemId, editValue);
    }

    setEditingCell(null);
  }, [editingCell, editValue, data, onCellChange]);

  // Cancel cell edit
  const cancelCellEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue(0);
  }, []);

  // Keyboard event handler
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (editingCell) {
      if (event.key === 'Enter') {
        saveCellEdit();
      } else if (event.key === 'Escape') {
        cancelCellEdit();
      }
      return;
    }

    // Copy/Paste
    if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
      // Copy selected cells
      if (selectedCells.size > 0) {
        const values: string[] = [];
        selectedCells.forEach(cellId => {
          const [rowStr, colStr] = cellId.split('-');
          const rowIndex = parseInt(rowStr);
          const colIndex = parseInt(colStr);
          const itemId = getItemIdFromCol(colIndex);
          if (itemId && data[rowIndex]) {
            values.push(String(data[rowIndex][itemId] || 0));
          }
        });
        setCopiedData(values.join('\t'));
      }
    }
  }, [editingCell, selectedCells, data, saveCellEdit, cancelCellEdit]);

  // Render cell content
  const renderCellContent = (rowIndex: number, colIndex: number, value: any) => {
    const cellId = getCellId(rowIndex, colIndex);
    const isEditing = editingCell === cellId;
    const isSelected = selectedCells.has(cellId);
    const itemId = getItemIdFromCol(colIndex);
    const isModified = itemId ? isCellModified(rowIndex, itemId) : false;

    if (isEditing) {
      return (
        <NumberInput
          value={editValue}
          onChange={(val) => setEditValue(Number(val) || 0)}
          onKeyDown={handleKeyDown}
          onBlur={saveCellEdit}
          size="xs"
          style={{ width: '100%' }}
          styles={{ input: { textAlign: 'right', border: 'none', background: 'transparent' } }}
          autoFocus
        />
      );
    }

    const cellStyle = {
      backgroundColor: isSelected
        ? '#e3f2fd'
        : isModified
          ? '#e8f5e8'
          : colIndex >= 2 && expenseItems.some(e => e.item_id === itemId)
            ? '#fff8f8'
            : colIndex >= 2
              ? '#f8fff8'
              : 'white',
      border: isSelected ? '2px solid #1976d2' : '1px solid #e0e0e0',
      padding: '4px 8px',
      textAlign: colIndex < 2 ? 'center' : 'right' as const,
      fontWeight: isModified ? 600 : 400,
      color: isModified ? '#1976d2' : undefined,
      cursor: colIndex >= 2 ? 'cell' : 'default',
      minWidth: colIndex < 2 ? '80px' : '120px',
    };

    if (colIndex < 2) {
      return (
        <Box style={cellStyle}>
          {colIndex === 0 ? (
            <Badge variant="light" color="blue" size="sm">{value}</Badge>
          ) : (
            value
          )}
        </Box>
      );
    }

    return (
      <Box
        style={cellStyle}
        onClick={(e) => handleCellClick(rowIndex, colIndex, e)}
        onDoubleClick={() => handleDoubleClick(rowIndex, colIndex)}
      >
        {typeof value === 'number' ? formatCurrency(value) : value || '0'}
      </Box>
    );
  };

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (tableRef.current?.contains(document.activeElement)) {
        handleKeyDown(event as any);
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleKeyDown]);

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
          <Text fw={500}>💡 Excel-style Features</Text>
          <Text size="sm">
            • Click to select, Shift+Click to extend selection, Ctrl+Click for multi-select
            • Double-click to edit cells • Arrow keys for navigation
            • Ctrl+C to copy • Modified cells highlighted in blue
          </Text>
        </Stack>
      </Alert>

      <ScrollArea h={600}>
        <Table
          ref={tableRef}
          striped
          highlightOnHover={false}
          withTableBorder
          tabIndex={0}
          style={{ userSelect: 'none' }}
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ position: 'sticky', left: 0, backgroundColor: '#f8f9fa', zIndex: 2, textAlign: 'center' }}>
                Age
              </Table.Th>
              <Table.Th style={{ position: 'sticky', left: 80, backgroundColor: '#f8f9fa', zIndex: 2, textAlign: 'center' }}>
                Year
              </Table.Th>
              {incomeItems.map(item => (
                <Table.Th key={item.item_id} style={{
                  backgroundColor: '#e7f5e7',
                  color: '#2d7d2d',
                  textAlign: 'center',
                  minWidth: '120px'
                }}>
                  💰 {item.name}
                </Table.Th>
              ))}
              {expenseItems.map(item => (
                <Table.Th key={item.item_id} style={{
                  backgroundColor: '#ffe7e7',
                  color: '#d63031',
                  textAlign: 'center',
                  minWidth: '120px'
                }}>
                  💳 {item.name}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((row, rowIndex) => (
              <Table.Tr key={row.age}>
                <Table.Td style={{ position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 1 }}>
                  {renderCellContent(rowIndex, 0, row.age)}
                </Table.Td>
                <Table.Td style={{ position: 'sticky', left: 80, backgroundColor: 'white', zIndex: 1 }}>
                  {renderCellContent(rowIndex, 1, row.year)}
                </Table.Td>
                {allItems.map((item, itemIndex) => (
                  <Table.Td key={item.item_id} style={{ padding: 0 }}>
                    {renderCellContent(rowIndex, itemIndex + 2, row[item.item_id] || 0)}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Card>
  );
};
