/**
 * Simplified Excel-like table for debugging
 */

import React, { useState, useEffect } from 'react';
import { DataSheetGrid, textColumn, intColumn, floatColumn } from 'react-datasheet-grid';
import { Card, Title, Group, Badge, Text } from '@mantine/core';
import 'react-datasheet-grid/dist/style.css';

interface SimpleTestRow {
  age: number;
  year: number;
  salary: number;
  expenses: number;
}

export const SimpleExcelTable: React.FC = () => {
  // Create test data
  const testData: SimpleTestRow[] = [
    { age: 35, year: 2025, salary: 120000, expenses: 50000 },
    { age: 36, year: 2026, salary: 123600, expenses: 51500 },
    { age: 37, year: 2027, salary: 127272, expenses: 53045 },
  ];

  const [rows, setRows] = useState<SimpleTestRow[]>(testData);

  const columns = [
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
    },
    {
      ...floatColumn,
      title: 'Salary',
      key: 'salary',
      width: 120,
    },
    {
      ...floatColumn,
      title: 'Expenses',
      key: 'expenses',
      width: 120,
    },
  ];

  useEffect(() => {
    console.log('SimpleExcelTable - Test data:', testData);
    console.log('SimpleExcelTable - Columns:', columns);
    console.log('SimpleExcelTable - Rows state:', rows);
  }, []);

  return (
    <Card shadow="sm" padding="lg" radius="md">
      <Group justify="space-between" mb="md">
        <Title order={3}>Simple Test Table</Title>
        <Badge color="blue" variant="light">
          {rows.length} rows × {columns.length} cols
        </Badge>
      </Group>

      <div style={{ height: 400, width: '100%' }}>
        <DataSheetGrid
          value={rows}
          onChange={setRows}
          columns={columns}
          height={350}
          rowHeight={35}
          headerRowHeight={40}
        />
      </div>

      <Text size="sm" mt="md">
        Raw data: {JSON.stringify(rows.slice(0, 2), null, 2)}
      </Text>
    </Card>
  );
};
