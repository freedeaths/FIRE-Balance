/**
 * ImportExportControls - 数据导入导出控制组件
 *
 * 功能：
 * - 导入 JSON 配置文件
 * - 导出当前数据为 JSON
 * - 清空所有数据
 * - 响应式设计：桌面显示图标+文字，移动端只显示文字
 */

import React, { useRef, useEffect, useState } from 'react';
import { Group, Button, ActionIcon, Text } from '@mantine/core';
import { IconDownload, IconUpload, IconTrash } from '@tabler/icons-react';
import { usePlannerStore, usePlannerData } from '../../stores/plannerStore';
import { getI18n } from '../../core/i18n';
import { notifications } from '@mantine/notifications';
import { PlannerStage } from '../../types';
import { ConfirmDialog } from './ConfirmDialog';

export function ImportExportControls() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const plannerStore = usePlannerStore();
  const data = usePlannerData(); // 使用 selector 订阅数据

  // 确认弹窗状态
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // i18n
  const i18n = getI18n();
  const t = (key: string, variables?: Record<string, any>) =>
    i18n.t(key, variables);

  // 处理文件导入
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      notifications.show({
        title: t('import_export.error'),
        message: t('import_export.import_error_invalid_file'),
        color: 'red',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      try {
        let jsonData = JSON.parse(e.target?.result as string);

        // Compatibility: enhanced_fire format (downloads/enhanced_fire/*.json)
        // Shape: { user_profile, incomes, expenses, overrides }
        if (
          jsonData?.user_profile &&
          (Array.isArray(jsonData.incomes) ||
            Array.isArray(jsonData.expenses)) &&
          !jsonData.version
        ) {
          const systemYear = new Date().getFullYear();
          const asOfYear =
            typeof jsonData.user_profile.as_of_year === 'number'
              ? jsonData.user_profile.as_of_year
              : typeof jsonData.user_profile.plan_year === 'number'
                ? jsonData.user_profile.plan_year
                : typeof jsonData.plan_year === 'number'
                  ? jsonData.plan_year
                  : systemYear;
          const currentAge =
            typeof jsonData.user_profile.current_age === 'number'
              ? jsonData.user_profile.current_age
              : 30;

          const birthYear = asOfYear - currentAge;
          const expectedFireAge =
            typeof jsonData.user_profile.expected_fire_age === 'number'
              ? jsonData.user_profile.expected_fire_age
              : 50;

          const inferredLegalRetirementAge = (() => {
            if (
              !Array.isArray(jsonData.incomes) ||
              jsonData.incomes.length === 0
            ) {
              return 65;
            }

            const startAges = jsonData.incomes
              .map((i: any) =>
                typeof i?.start_age === 'number' ? i.start_age : Infinity
              )
              .filter((x: number) => Number.isFinite(x));

            const candidates = startAges.filter(
              (a: number) => a >= Math.max(55, expectedFireAge + 1)
            );

            if (candidates.length > 0) {
              return Math.min(...candidates);
            }

            return 65;
          })();

          const legalRetirementAge =
            typeof jsonData.user_profile.legal_retirement_age === 'number'
              ? jsonData.user_profile.legal_retirement_age
              : Number.isFinite(inferredLegalRetirementAge)
                ? inferredLegalRetirementAge
                : 65;

          const lifeExpectancy =
            typeof jsonData.user_profile.life_expectancy === 'number'
              ? jsonData.user_profile.life_expectancy
              : 85;

          const toPlannerItem = (item: any, isIncome: boolean) => {
            const frequency =
              item?.frequency === 'one-time' ? 'one-time' : 'recurring';

            const startAge =
              typeof item?.start_age === 'number' ? item.start_age : currentAge;

            const endAge =
              frequency === 'recurring'
                ? typeof item?.end_age === 'number'
                  ? item.end_age
                  : lifeExpectancy
                : undefined;

            return {
              id:
                typeof item?.id === 'string' && item.id
                  ? item.id
                  : `${Date.now()}-${Math.random()}`,
              name: typeof item?.name === 'string' ? item.name : '',
              after_tax_amount_per_period:
                typeof item?.amount === 'number' ? item.amount : 0,
              time_unit: 'annually',
              frequency,
              interval_periods: 1,
              start_age: startAge,
              end_age: endAge,
              annual_growth_rate:
                typeof item?.growth_rate === 'number' ? item.growth_rate : 0,
              is_income: isIncome,
              category: isIncome ? 'Income' : 'Expense',
            };
          };

          jsonData = {
            version: '1.0',
            title: jsonData.title || `FIRE Plan - ${new Date().toISOString()}`,
            created_at: jsonData.created_at || new Date().toISOString(),
            user_profile: {
              birth_year: birthYear,
              as_of_year: asOfYear,
              expected_fire_age: expectedFireAge,
              legal_retirement_age: legalRetirementAge,
              life_expectancy: lifeExpectancy,
              current_net_worth:
                typeof jsonData.user_profile.current_net_worth === 'number'
                  ? jsonData.user_profile.current_net_worth
                  : 0,
              inflation_rate:
                typeof jsonData.user_profile.inflation_rate === 'number'
                  ? jsonData.user_profile.inflation_rate
                  : 3.0,
              safety_buffer_months:
                typeof jsonData.user_profile.safety_buffer_months === 'number'
                  ? jsonData.user_profile.safety_buffer_months
                  : 6,
              bridge_discount_rate:
                typeof jsonData.user_profile.bridge_discount_rate === 'number'
                  ? jsonData.user_profile.bridge_discount_rate
                  : 1.0,
              portfolio: {
                asset_classes: [
                  {
                    name: 'stocks',
                    display_name: 'Stocks',
                    allocation_percentage:
                      typeof jsonData.user_profile.stock_allocation === 'number'
                        ? jsonData.user_profile.stock_allocation
                        : 60,
                    expected_return: 7,
                    volatility: 15,
                    liquidity_level: 'medium',
                  },
                  {
                    name: 'bonds',
                    display_name: 'Bonds',
                    allocation_percentage:
                      typeof jsonData.user_profile.bond_allocation === 'number'
                        ? jsonData.user_profile.bond_allocation
                        : 30,
                    expected_return: 3,
                    volatility: 5,
                    liquidity_level: 'low',
                  },
                  {
                    name: 'cash',
                    display_name: 'Cash',
                    allocation_percentage:
                      typeof jsonData.user_profile.cash_allocation === 'number'
                        ? jsonData.user_profile.cash_allocation
                        : 10,
                    expected_return: 1,
                    volatility: 1,
                    liquidity_level: 'high',
                  },
                ],
                enable_rebalancing: true,
                rebalancing_frequency:
                  typeof jsonData.user_profile.rebalance_frequency === 'string'
                    ? jsonData.user_profile.rebalance_frequency
                    : undefined,
              },
            },
            income_items: Array.isArray(jsonData.incomes)
              ? jsonData.incomes.map((i: any) => toPlannerItem(i, true))
              : [],
            expense_items: Array.isArray(jsonData.expenses)
              ? jsonData.expenses.map((i: any) => toPlannerItem(i, false))
              : [],
            overrides: Array.isArray(jsonData.overrides)
              ? jsonData.overrides
              : [],
            simulation_settings: jsonData.simulation_settings,
            language: jsonData.language,
          };
        }

        // Compatibility: Python format uses `profile` field; convert to `user_profile`
        if (jsonData.profile && !jsonData.user_profile) {
          jsonData.user_profile = jsonData.profile;
          delete jsonData.profile;
        }

        // Validate JSON format (basic validation)
        if (
          !jsonData.version ||
          (!jsonData.user_profile && !jsonData.profile) ||
          !jsonData.income_items ||
          !jsonData.expense_items
        ) {
          throw new Error('Invalid JSON format');
        }

        // 导入数据到 store（完全替换现有数据，但保持当前阶段）
        const success = plannerStore.importConfig(jsonData);
        if (!success) {
          throw new Error('Import failed');
        }

        notifications.show({
          title: t('import_export.success'),
          message: t('import_export.import_success'),
          color: 'green',
        });
      } catch (error) {
        console.error('Import error:', error);
        notifications.show({
          title: t('import_export.error'),
          message: t('import_export.import_error_invalid_json'),
          color: 'red',
        });
      }
    };

    reader.readAsText(file);

    // 清空 input 以允许重复导入同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 处理数据导出
  const handleExport = () => {
    try {
      const exportData = plannerStore.exportConfig();
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `fire-plan-${
        new Date().toISOString().split('T')[0]
      }.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      notifications.show({
        title: t('import_export.success'),
        message: t('import_export.export_success'),
        color: 'green',
      });
    } catch (error) {
      console.error('Export error:', error);
      notifications.show({
        title: t('import_export.error'),
        message: t('import_export.export_error'),
        color: 'red',
      });
    }
  };

  // 处理数据清空
  const handleClear = () => {
    setShowConfirmDialog(true);
  };

  // 确认清空数据
  const handleConfirmClear = () => {
    plannerStore.reset();
    // reset() 已经会导航到第一阶段，不需要额外调用 setCurrentStage

    notifications.show({
      title: t('import_export.success'),
      message: t('import_export.clear_success'),
      color: 'blue',
    });
  };

  return (
    <>
      {/* 隐藏的文件输入 */}
      <input
        type='file'
        ref={fileInputRef}
        onChange={handleImport}
        accept='.json'
        style={{ display: 'none' }}
      />

      {/* 响应式按钮组 - 均匀分布 */}
      <Group justify='space-between' gap='md' grow className='w-full'>
        {/* 导入按钮 */}
        <Button
          variant='light'
          size='compact-sm'
          leftSection={<IconUpload size={16} />}
          onClick={() => fileInputRef.current?.click()}
          className='min-w-0'
        >
          {t('import_export.import_data')}
        </Button>

        {/* 导出按钮 */}
        <Button
          variant='light'
          size='compact-sm'
          leftSection={<IconDownload size={16} />}
          onClick={handleExport}
          className='min-w-0'
        >
          {t('import_export.export_data')}
        </Button>

        {/* 清空按钮 */}
        <Button
          variant='light'
          color='red'
          size='compact-sm'
          leftSection={<IconTrash size={16} />}
          onClick={handleClear}
          className='min-w-0'
        >
          {t('import_export.clear_data')}
        </Button>
      </Group>

      {/* 确认弹窗 */}
      <ConfirmDialog
        opened={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handleConfirmClear}
        title={t('import_export.clear_data')}
        message={t('import_export.clear_data_confirm')}
        confirmLabel={t('import_export.clear_data')}
        cancelLabel={t('cancel')}
        confirmColor='red'
        iconType='delete'
      />
    </>
  );
}

export default ImportExportControls;
