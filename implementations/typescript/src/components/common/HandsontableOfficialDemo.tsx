/**
 * Official Handsontable demo to test autofill functionality
 */

import React from 'react';
import { HotTable } from '@handsontable/react-wrapper';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/styles/handsontable.css';
import 'handsontable/styles/ht-theme-main.css';
import { Card, Title, Text, Stack } from '@mantine/core';

// register Handsontable's modules
registerAllModules();

export const HandsontableOfficialDemo: React.FC = () => {

  // Simple test data with arithmetic sequence potential
  const data = [
    ['Age', 'Year', 'Salary'],
    [35, 2025, 120000],
    [36, 2026, 121000],
    [37, 2027, ''],
    [38, 2028, ''],
    [39, 2029, ''],
  ];

  return (
    <Card shadow="sm" padding="lg" radius="md">
      <Stack gap="md">
        <Title order={3}>官方 Handsontable Autofill Demo</Title>
        <Text size="sm">
          测试步骤：<br/>
          1. 选择 120000 和 121000 两个单元格（第3列的第2、3行）<br/>
          2. 拖拽右下角填充手柄向下<br/>
          3. 观察是否能生成等差数列：122000, 123000, 124000
        </Text>

        <div style={{ height: 300, width: '100%' }}>
          <HotTable
            themeName="ht-theme-main"
            data={data}
            rowHeaders={true}
            colHeaders={true}
            fillHandle={true} // Enable basic autofill
            height="auto"
            autoWrapRow={true}
            autoWrapCol={true}
            licenseKey="non-commercial-and-evaluation"

            // Add hooks to see what happens
            beforeAutofill={(start: any, end: any, data: any) => {
              console.log('=== Official beforeAutofill ===');
              console.log('Start:', start);
              console.log('End:', end);
              console.log('Data:', data);
              return true; // Allow default behavior
            }}

            afterAutofill={(start: any, end: any, data: any) => {
              console.log('=== Official afterAutofill ===');
              console.log('Start:', start);
              console.log('End:', end);
              console.log('Data:', data);
            }}
          />
        </div>

        <Text size="xs" c="dimmed">
          这是按照官方示例创建的版本，用来测试基本的 autofill 功能
        </Text>
      </Stack>
    </Card>
  );
};
