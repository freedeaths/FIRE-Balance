/**
 * Simple Handsontable demo to test autofill functionality
 */

import React, { useRef } from 'react';
import { HotTable } from '@handsontable/react';
import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.css';
import { Card, Title, Text, Stack } from '@mantine/core';

export const HandsontableDemo: React.FC = () => {
  const hotRef = useRef<HotTable>(null);

  // Simple test data
  const testData = [
    [35, 2025, 120000],
    [36, 2026, 121000],
    [37, 2027, 0],
    [38, 2028, 0],
    [39, 2029, 0],
  ];

  const columns = [
    { type: 'numeric', width: 80, readOnly: true }, // Age
    { type: 'numeric', width: 80, readOnly: true }, // Year
    { type: 'numeric', width: 120 }, // Salary - editable
  ];

  const colHeaders = ['Age', 'Year', 'Salary'];

  return (
    <Card shadow="sm" padding="lg" radius="md">
      <Stack gap="md">
        <Title order={3}>Handsontable Autofill Demo</Title>
        <Text size="sm">
          测试步骤：<br/>
          1. 选择 120000 和 121000 两个单元格<br/>
          2. 拖拽右下角填充手柄向下<br/>
          3. 应该看到等差数列：122000, 123000, 124000
        </Text>

        <div style={{ height: 300, width: '100%' }}>
          <HotTable
            ref={hotRef}
            data={testData}
            columns={columns}
            colHeaders={colHeaders}
            width="100%"
            height={250}
            licenseKey="non-commercial-and-evaluation"

            // Basic settings
            selectionMode="range"

            // Enable fill handle
            fillHandle={{
              direction: 'vertical',
              autoInsertRow: false
            }}

            // Try a different approach - intercept and manually apply changes
            beforeAutofill={(start: any, end: any, data: any) => {
              console.log('=== beforeAutofill ===');
              console.log('Start type:', typeof start, start);
              console.log('End type:', typeof end, end);
              console.log('Data type:', typeof data, data);

              try {
                // Parse the parameters correctly
                let startRow, startCol, endRow, endCol;

                // Start seems to be an array of arrays
                if (Array.isArray(start) && start.length > 0 && Array.isArray(start[0])) {
                  startRow = start[0][0];
                  startCol = start[0][1];
                  console.log('Parsed start:', startRow, startCol);
                }

                // End is a CellRange object
                if (end && end.from && end.to) {
                  endRow = end.to.row;
                  endCol = end.to.col;
                  console.log('Parsed end:', endRow, endCol);
                }

                // Check if this is salary column (col 2)
                if (startCol === 2 && typeof startRow === 'number' && typeof endRow === 'number') {
                  console.log('Processing salary column autofill');

                  // Get current values from the table
                  const hot = hotRef.current?.hotInstance;
                  if (hot) {
                    const val1 = hot.getDataAtCell(startRow, startCol);
                    const val2 = hot.getDataAtCell(startRow + 1, startCol);

                    console.log('Current values:', val1, val2);

                    if (typeof val1 === 'number' && typeof val2 === 'number') {
                      const step = val2 - val1;
                      console.log('Arithmetic pattern detected, step:', step);

                      // Block default autofill and do it manually
                      setTimeout(() => {
                        console.log('Manually applying arithmetic sequence');
                        for (let row = startRow; row <= endRow; row++) {
                          const newValue = val1 + step * (row - startRow);
                          hot.setDataAtCell(row, startCol, Math.round(newValue));
                          console.log(`Set [${row}, ${startCol}] = ${Math.round(newValue)}`);
                        }
                      }, 0);

                      // Block default behavior
                      return false;
                    }
                  }
                }
              } catch (error) {
                console.error('Error in beforeAutofill:', error);
              }

              // Allow default behavior for other cases
              return true;
            }}

            afterAutofill={(start: any, end: any, data: any) => {
              console.log('=== afterAutofill ===');
              console.log('Start:', start);
              console.log('End:', end);
              console.log('Data:', data);
            }}

            afterChange={(changes: any, source: string) => {
              console.log('=== afterChange ===');
              console.log('Changes:', changes);
              console.log('Source:', source);
            }}
          />
        </div>

        <Text size="xs" c="dimmed">
          打开浏览器控制台查看详细日志
        </Text>
      </Stack>
    </Card>
  );
};
