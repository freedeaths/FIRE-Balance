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
  const t = (key: string, variables?: Record<string, any>) => i18n.t(key, variables);


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
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string);

        // 验证 JSON 格式（简单验证）
        if (!jsonData.version || (!jsonData.profile && !jsonData.user_profile) || !jsonData.income_items || !jsonData.expense_items) {
          throw new Error('Invalid JSON format');
        }

        // 兼容性处理：Python 格式使用 profile 字段，需要转换为 user_profile
        if (jsonData.profile && !jsonData.user_profile) {
          jsonData.user_profile = jsonData.profile;
          delete jsonData.profile;
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
      link.download = `fire-plan-${new Date().toISOString().split('T')[0]}.json`;
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
        type="file"
        ref={fileInputRef}
        onChange={handleImport}
        accept=".json"
        style={{ display: 'none' }}
      />

      {/* 响应式按钮组 - 均匀分布 */}
      <Group justify="space-between" gap="md" grow className="w-full">
        {/* 导入按钮 */}
        <Button
          variant="light"
          size="compact-sm"
          leftSection={<IconUpload size={16} />}
          onClick={() => fileInputRef.current?.click()}
          className="min-w-0"
        >
          {t('import_export.import_data')}
        </Button>

        {/* 导出按钮 */}
        <Button
          variant="light"
          size="compact-sm"
          leftSection={<IconDownload size={16} />}
          onClick={handleExport}
          className="min-w-0"
        >
          {t('import_export.export_data')}
        </Button>

        {/* 清空按钮 */}
        <Button
          variant="light"
          color="red"
          size="compact-sm"
          leftSection={<IconTrash size={16} />}
          onClick={handleClear}
          className="min-w-0"
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
        confirmColor="red"
        iconType="delete"
      />
    </>
  );
}

export default ImportExportControls;
