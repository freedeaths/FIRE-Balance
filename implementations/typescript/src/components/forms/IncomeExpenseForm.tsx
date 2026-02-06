/**
 * IncomeExpenseForm - 收支项目表单组件
 *
 * 用于添加和编辑收入/支出项目：
 * - 收入支出项目的增删改查
 * - 表单验证和错误处理
 * - 预定义模板支持
 * - 与Stage2的Handsontable集成
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Title,
  Grid,
  Button,
  Group,
  Stack,
  Text,
  Divider,
  Modal,
  Badge,
  ActionIcon,
  Menu,
  Alert,
  Table,
  ScrollArea,
  Box,
} from '@mantine/core';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconTemplate,
  IconCopy,
  IconInfoCircle,
} from '@tabler/icons-react';
import { v4 as uuidv4 } from 'uuid';
import { FormField } from './FormField';
import { usePlannerStore } from '../../stores/plannerStore';
import { useAppStore } from '../../stores/appStore';
import { getI18n } from '../../core/i18n';
import { formatCurrency } from '../../utils/helpers';
import type { UIIncomeExpenseItem, UIItemFrequency } from '../../types/ui';
import { convertUIToCore, convertCoreToUI } from '../../types/ui';

// =============================================================================
// Types
// =============================================================================

export interface IncomeExpenseFormProps {
  /** 表单类型 */
  type: 'income' | 'expense';
  /** 表单标题 */
  title?: string;
  /** 是否显示预定义模板 */
  showTemplates?: boolean;
  /** 自定义模板列表 */
  templates?: UIIncomeExpenseItem[];
}

// =============================================================================
// 预定义模板
// =============================================================================

const DEFAULT_INCOME_TEMPLATES: Partial<UIIncomeExpenseItem>[] = [
  {
    name: 'Salary',
    frequency: 'annual',
    growth_rate: 3,
    start_age: 25, // 会被动态替换为当前年龄
    end_age: 65, // 会被动态替换为期望FIRE年龄
  },
  {
    name: 'Pension',
    frequency: 'annual',
    growth_rate: 0,
    start_age: 65, // 会被动态替换为法定退休年龄
    end_age: 85, // 会被动态替换为预期寿命
  },
  {
    name: 'Retirement Fund Withdrawal',
    frequency: 'one_time',
    growth_rate: 0,
    start_age: 65, // 会被动态替换为法定退休年龄
    end_age: 65, // 一次性事件，结束年龄等于开始年龄
  },
];

const DEFAULT_EXPENSE_TEMPLATES: Partial<UIIncomeExpenseItem>[] = [
  {
    name: 'Living Expenses',
    frequency: 'annual',
    growth_rate: 0, // Inflation handled separately
    start_age: 25, // 会被动态替换为当前年龄
    end_age: 85, // 会被动态替换为预期寿命
  },
  {
    name: 'Home Purchase',
    frequency: 'one_time',
    growth_rate: 0,
    start_age: 35, // 会被动态替换为合理的年龄
    end_age: 35, // 一次性事件，结束年龄等于开始年龄
  },
];

// =============================================================================
// 主组件
// =============================================================================

export function IncomeExpenseForm({
  type,
  title,
  showTemplates = true,
  templates,
}: IncomeExpenseFormProps) {
  const ALLOWED_MONTHLY_INTERVAL_PERIODS = [1, 2, 3, 4, 6] as const;
  const allowedMonthlyIntervalSet = useMemo(
    () => new Set<number>(ALLOWED_MONTHLY_INTERVAL_PERIODS),
    []
  );

  // Store hooks
  const plannerStore = usePlannerStore();
  const { currentLanguage } = useAppStore();

  // Local state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UIIncomeExpenseItem | null>(
    null
  );
  const [formData, setFormData] = useState<Partial<UIIncomeExpenseItem>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // i18n
  const i18n = getI18n();
  const t = (key: string, variables?: Record<string, any>) =>
    i18n.t(key, variables);

  const formatAmount = (amount: number): string => {
    // Stage 1: 不展示任何货币符号（默认按本国货币理解）
    // 使用当前语言作为 locale，保证千分位风格更符合用户习惯
    try {
      return amount.toLocaleString(currentLanguage, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    } catch {
      // Fallback: en-US separators
      return formatCurrency(amount);
    }
  };

  // Get items from store and convert to UI format
  const coreItems =
    type === 'income'
      ? plannerStore.data.income_items
      : plannerStore.data.expense_items;
  const items = coreItems.map(convertCoreToUI);

  const addItem = (uiItem: UIIncomeExpenseItem) => {
    const coreItem = convertUIToCore(uiItem, type === 'income');
    if (type === 'income') {
      plannerStore.addIncomeItem(coreItem);
    } else {
      plannerStore.addExpenseItem(coreItem);
    }
  };

  const updateItem = (id: string, uiItem: UIIncomeExpenseItem) => {
    const coreItem = convertUIToCore(uiItem, type === 'income');
    if (type === 'income') {
      plannerStore.updateIncomeItem(id, coreItem);
    } else {
      plannerStore.updateExpenseItem(id, coreItem);
    }
  };

  const removeItem =
    type === 'income'
      ? plannerStore.removeIncomeItem
      : plannerStore.removeExpenseItem;

  // Get templates
  const availableTemplates =
    templates ||
    (type === 'income' ? DEFAULT_INCOME_TEMPLATES : DEFAULT_EXPENSE_TEMPLATES);

  // =============================================================================
  // Form validation
  // =============================================================================

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = t('validation.required');
    }

    if (
      !formData.after_tax_amount_per_period ||
      formData.after_tax_amount_per_period <= 0
    ) {
      newErrors.after_tax_amount_per_period = t('validation.must_be_positive');
    }

    if (formData.growth_rate === undefined) {
      newErrors.growth_rate = t('validation.required');
    }

    if (!formData.frequency) {
      newErrors.frequency = t('validation.required');
    }

    if (formData.frequency !== 'one_time') {
      const interval = formData.interval_periods;
      if (interval === undefined || interval === null) {
        newErrors.interval_periods = t('validation.required');
      } else if (!Number.isFinite(interval) || interval <= 0) {
        newErrors.interval_periods = t('validation.must_be_positive');
      } else if (Math.floor(interval) !== interval) {
        newErrors.interval_periods = t('validation.must_be_integer');
      } else if (
        formData.frequency === 'monthly' &&
        !allowedMonthlyIntervalSet.has(interval)
      ) {
        newErrors.interval_periods = t('validation.invalid_monthly_interval');
      }
    }

    if (!formData.start_age || formData.start_age < 0) {
      newErrors.start_age = t('validation.invalid_age');
    }

    // 一次性事件不需要验证结束年龄
    if (formData.frequency !== 'one_time') {
      if (!formData.end_age || formData.end_age < 0) {
        newErrors.end_age = t('validation.invalid_age');
      }

      if (
        formData.start_age &&
        formData.end_age &&
        formData.start_age >= formData.end_age
      ) {
        newErrors.end_age = t('validation.end_age_must_be_greater');
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // =============================================================================
  // Event handlers
  // =============================================================================

  const handleAddNew = () => {
    setEditingItem(null);
    setFormData({
      frequency: 'annual', // 保留频率默认值，因为这是必选项
      interval_periods: 1,
    });
    setErrors({});
    setModalOpen(true);
  };

  const handleEdit = (item: UIIncomeExpenseItem) => {
    setEditingItem(item);
    setFormData(item);
    setErrors({});
    setModalOpen(true);
  };

  const handleDelete = (item: UIIncomeExpenseItem) => {
    removeItem(item.id);
  };

  const handleSave = () => {
    if (!validateForm()) return;

    const normalizeIntervalPeriods = (): number => {
      const raw = formData.interval_periods;
      const normalized =
        raw === undefined || raw === null ? 1 : Math.max(1, Math.floor(raw));

      if (formData.frequency === 'monthly') {
        return allowedMonthlyIntervalSet.has(normalized) ? normalized : 1;
      }

      return normalized;
    };

    const completeItem: UIIncomeExpenseItem = {
      id: editingItem?.id || uuidv4(),
      name: formData.name!,
      after_tax_amount_per_period: formData.after_tax_amount_per_period!,
      frequency: formData.frequency!,
      interval_periods:
        formData.frequency === 'one_time' ? 1 : normalizeIntervalPeriods(),
      growth_rate: formData.growth_rate!,
      start_age: formData.start_age!,
      end_age: formData.end_age!,
      tags: formData.tags || [],
    };

    if (editingItem) {
      updateItem(editingItem.id, completeItem);
    } else {
      addItem(completeItem);
    }

    setModalOpen(false);
    setFormData({});
    setErrors({});
  };

  const handleUseTemplate = (template: Partial<UIIncomeExpenseItem>) => {
    // 获取当前年龄和用户档案
    const currentAge = getCurrentAge();
    if (currentAge === null) {
      return;
    }

    const userProfile = plannerStore.data.user_profile;
    const fireAge = userProfile?.expected_fire_age || 65;
    const retirementAge = userProfile?.legal_retirement_age || 65;
    const lifeExpectancy = userProfile?.life_expectancy || 85;

    let dynamicStartAge = template.start_age || currentAge;
    let dynamicEndAge = template.end_age || lifeExpectancy;

    // 根据模板类型动态调整年龄
    if (template.name === 'Salary') {
      dynamicStartAge = currentAge;
      dynamicEndAge = fireAge;
    } else if (template.name === 'Pension') {
      dynamicStartAge = retirementAge;
      dynamicEndAge = lifeExpectancy;
    } else if (template.name === 'Retirement Fund Withdrawal') {
      dynamicStartAge = retirementAge;
      dynamicEndAge = retirementAge; // 一次性事件
    } else if (template.name === 'Living Expenses') {
      dynamicStartAge = currentAge;
      dynamicEndAge = lifeExpectancy;
    } else if (template.name === 'Home Purchase') {
      dynamicStartAge = Math.max(currentAge + 5, 30); // 当前年龄+5年 或 30岁，取较大值
      dynamicEndAge = dynamicStartAge; // 一次性事件
    }

    setEditingItem(null);
    setFormData({
      ...template,
      id: uuidv4(),
      interval_periods: template.interval_periods ?? 1,
      start_age: dynamicStartAge,
      end_age: dynamicEndAge,
    });
    setErrors({});
    setModalOpen(true);
  };

  // 获取当前年龄
  const getCurrentAge = (): number | null => {
    const birthYear = plannerStore.data.user_profile?.birth_year;
    if (!birthYear) return null;
    const asOfYear =
      plannerStore.data.user_profile?.as_of_year || new Date().getFullYear();
    return asOfYear - birthYear;
  };

  // 检查是否可以使用模板（用户是否已填写出生年份）
  const canUseTemplates = getCurrentAge() !== null;

  const handleFieldChange = (field: keyof UIIncomeExpenseItem, value: any) => {
    setFormData(prev => {
      if (field !== 'frequency') {
        return { ...prev, [field]: value };
      }

      const nextFrequency = value as UIItemFrequency | undefined;

      if (nextFrequency === 'one_time') {
        return { ...prev, frequency: nextFrequency, interval_periods: 1 };
      }

      if (nextFrequency === 'monthly') {
        const rawInterval = prev.interval_periods;
        const normalizedInterval =
          typeof rawInterval === 'number'
            ? Math.max(1, Math.floor(rawInterval))
            : 1;
        const nextInterval = allowedMonthlyIntervalSet.has(normalizedInterval)
          ? normalizedInterval
          : 1;
        return {
          ...prev,
          frequency: nextFrequency,
          interval_periods: nextInterval,
        };
      }

      const rawInterval = prev.interval_periods;
      const normalizedInterval =
        typeof rawInterval === 'number'
          ? Math.max(1, Math.floor(rawInterval))
          : 1;
      return {
        ...prev,
        frequency: nextFrequency,
        interval_periods: normalizedInterval,
      };
    });

    // Clear error when user starts typing
    if (errors[field as string]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // =============================================================================
  // 渲染移动端友好的项目列表
  // =============================================================================

  const renderMobileItemList = () => {
    if (items.length === 0) {
      return null;
    }

    return (
      <Stack gap='sm'>
        {items.map((item, index) => (
          <Card key={item.id} padding='sm' radius='md' withBorder>
            <Group justify='space-between' align='flex-start'>
              <Stack gap='xs' style={{ flex: 1 }}>
                <Group gap='xs' wrap='nowrap'>
                  <Text fw={500} size='sm' truncate>
                    {item.name}
                  </Text>
                  <Badge size='xs' variant='light'>
                    {t(item.frequency)}
                  </Badge>
                </Group>

                <Group gap='md' wrap='wrap'>
                  <Text size='xs' c='dimmed'>
                    {formatAmount(item.after_tax_amount_per_period || 0)}/
                    {item.frequency === 'annual' ? 'year' : 'month'}
                  </Text>

                  <Text size='xs' c='dimmed'>
                    {item.growth_rate}% growth
                  </Text>

                  <Text size='xs' c='dimmed'>
                    Age {item.start_age} - {item.end_age}
                  </Text>

                  {item.frequency !== 'one_time' && (
                    <Text size='xs' c='dimmed'>
                      {t('item_interval')}: {item.interval_periods}{' '}
                      {item.frequency === 'annual'
                        ? t('interval_years')
                        : t('interval_months')}
                    </Text>
                  )}
                </Group>
              </Stack>

              <Group gap='xs'>
                <ActionIcon
                  size='sm'
                  variant='subtle'
                  onClick={() => handleEdit(item)}
                >
                  <IconEdit size={14} />
                </ActionIcon>
                <ActionIcon
                  size='sm'
                  variant='subtle'
                  color='red'
                  onClick={() => handleDelete(item)}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>
            </Group>
          </Card>
        ))}
      </Stack>
    );
  };

  // =============================================================================
  // 渲染
  // =============================================================================

  return (
    <Card>
      <Group justify='space-between' mb='md'>
        <Title order={3}>{title || t(`${type}_items_header`)}</Title>

        <Button
          leftSection={<IconPlus size={16} />}
          onClick={handleAddNew}
          size='sm'
        >
          {t(`add_${type}_item`)}
        </Button>
      </Group>

      {/* 大屏：只显示表格行 */}
      <Box visibleFrom='md'>
        {items.length > 0 && (
          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>{t('item_name')}</Table.Th>
                  <Table.Th>{t('item_amount')}</Table.Th>
                  <Table.Th>{t('item_frequency')}</Table.Th>
                  <Table.Th>{t('item_interval')}</Table.Th>
                  <Table.Th>{t('item_growth_rate')}</Table.Th>
                  <Table.Th>{t('item_start_age')}</Table.Th>
                  <Table.Th>{t('item_end_age')}</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((item, index) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>{index + 1}</Table.Td>
                    <Table.Td>
                      <Text fw={500}>{item.name}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text>
                        {formatAmount(item.after_tax_amount_per_period || 0)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size='sm' variant='light'>
                        {t(item.frequency)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text>
                        {item.frequency === 'one_time'
                          ? '-'
                          : `${item.interval_periods} ${
                              item.frequency === 'annual'
                                ? t('interval_years')
                                : t('interval_months')
                            }`}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text>{item.growth_rate}%</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text>{item.start_age}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text>{item.end_age}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap='xs'>
                        <ActionIcon
                          size='sm'
                          variant='subtle'
                          onClick={() => handleEdit(item)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          size='sm'
                          variant='subtle'
                          color='red'
                          onClick={() => handleDelete(item)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Box>

      {/* 小屏：只显示卡片形式 */}
      <Box hiddenFrom='md'>{renderMobileItemList()}</Box>

      {/* Edit/Add Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingItem ? `${t('edit')} ${type} item` : t(`add_${type}_item`)
        }
        size='lg'
      >
        <Stack gap='md'>
          <Grid>
            <Grid.Col span={12}>
              <FormField
                type='text'
                name='name'
                label={t('item_name')}
                value={formData.name}
                placeholder={`Enter ${type} name`}
                required
                error={errors.name}
                onChange={value => handleFieldChange('name', value)}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6 }}>
              <FormField
                type='currency'
                name='after_tax_amount_per_period'
                label={t('item_amount')}
                value={formData.after_tax_amount_per_period}
                min={0}
                required
                error={errors.after_tax_amount_per_period}
                onChange={value =>
                  handleFieldChange('after_tax_amount_per_period', value)
                }
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6 }}>
              <FormField
                type='select'
                name='frequency'
                label={t('item_frequency')}
                value={formData.frequency}
                options={[
                  { value: 'monthly', label: t('monthly') },
                  { value: 'annual', label: t('annual') },
                  { value: 'one_time', label: t('one_time') },
                ]}
                required
                error={errors.frequency}
                onChange={value => handleFieldChange('frequency', value)}
              />
            </Grid.Col>

            {formData.frequency !== 'one_time' && (
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <FormField
                  type={formData.frequency === 'monthly' ? 'select' : 'number'}
                  name='interval_periods'
                  label={`${t('item_interval')} (${
                    formData.frequency === 'annual'
                      ? t('interval_years')
                      : t('interval_months')
                  })`}
                  value={
                    formData.frequency === 'monthly'
                      ? formData.interval_periods?.toString()
                      : formData.interval_periods
                  }
                  options={
                    formData.frequency === 'monthly'
                      ? ALLOWED_MONTHLY_INTERVAL_PERIODS.map(v => ({
                          value: v.toString(),
                          label: v.toString(),
                        }))
                      : undefined
                  }
                  min={formData.frequency === 'monthly' ? undefined : 1}
                  precision={formData.frequency === 'monthly' ? undefined : 0}
                  required
                  error={errors.interval_periods}
                  onChange={value =>
                    handleFieldChange(
                      'interval_periods',
                      formData.frequency === 'monthly'
                        ? value
                          ? Number(value)
                          : undefined
                        : value
                    )
                  }
                />
              </Grid.Col>
            )}

            <Grid.Col span={{ base: 12, sm: 6 }}>
              <FormField
                type='percentage'
                name='growth_rate'
                label={t('item_growth_rate')}
                value={formData.growth_rate}
                min={-10}
                max={50}
                precision={1}
                required
                error={errors.growth_rate}
                onChange={value => handleFieldChange('growth_rate', value)}
              />
            </Grid.Col>

            {/* 年龄字段：一次性显示单个年龄，其他显示起止年龄 */}
            {formData.frequency === 'one_time' ? (
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <FormField
                  type='number'
                  name='start_age'
                  label={t('event_age')}
                  value={formData.start_age}
                  min={0}
                  max={100}
                  precision={0}
                  required
                  error={errors.start_age}
                  onChange={value => {
                    handleFieldChange('start_age', value);
                    // 一次性事件的结束年龄等于开始年龄
                    handleFieldChange('end_age', value);
                  }}
                />
              </Grid.Col>
            ) : (
              <>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <FormField
                    type='number'
                    name='start_age'
                    label={t('item_start_age')}
                    value={formData.start_age}
                    min={0}
                    max={100}
                    precision={0}
                    required
                    error={errors.start_age}
                    onChange={value => handleFieldChange('start_age', value)}
                  />
                </Grid.Col>

                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <FormField
                    type='number'
                    name='end_age'
                    label={t('item_end_age')}
                    value={formData.end_age}
                    min={0}
                    max={120}
                    precision={0}
                    required
                    error={errors.end_age}
                    onChange={value => handleFieldChange('end_age', value)}
                  />
                </Grid.Col>
              </>
            )}
          </Grid>

          <Group justify='space-between' mt='md'>
            {/* 左下角：模板选择器 */}
            {showTemplates && !editingItem && (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
              >
                {canUseTemplates ? (
                  <Menu>
                    <Menu.Target>
                      <Button
                        variant='subtle'
                        leftSection={<IconTemplate size={16} />}
                        size='sm'
                      >
                        {t('templates')}
                      </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                      {availableTemplates.map((template, index) => (
                        <Menu.Item
                          key={index}
                          leftSection={<IconCopy size={16} />}
                          onClick={() => handleUseTemplate(template)}
                        >
                          {(() => {
                            const templateKey =
                              template.name
                                ?.toLowerCase()
                                .replace('education (kids)', 'education_kids')
                                .replace(/\s+/g, '_') || 'unknown';
                            return t(templateKey);
                          })()}
                        </Menu.Item>
                      ))}
                    </Menu.Dropdown>
                  </Menu>
                ) : (
                  <>
                    <Button
                      variant='subtle'
                      leftSection={<IconTemplate size={16} />}
                      size='sm'
                      disabled
                      style={{ opacity: 0.5 }}
                    >
                      {t('templates')}
                    </Button>
                    <Text
                      size='xs'
                      c='orange'
                      style={{ whiteSpace: 'nowrap', lineHeight: 1.3 }}
                    >
                      💡 {t('ui.templates_need_birth_year')}
                    </Text>
                  </>
                )}
              </div>
            )}

            {/* 占位符 - 编辑模式时显示 */}
            {(editingItem || !showTemplates) && <div />}

            {/* 右下角：取消和确认按钮 */}
            <Group>
              <Button variant='subtle' onClick={() => setModalOpen(false)}>
                {t('cancel')}
              </Button>
              <Button onClick={handleSave}>
                {editingItem ? t('update') : t('add')}
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>
    </Card>
  );
}

export default IncomeExpenseForm;
