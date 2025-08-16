/**
 * FormField - 统一的表单字段组件
 *
 * 提供一致的表单字段样式和验证：
 * - 标准化的标签和错误显示
 * - 内置验证支持
 * - 多种字段类型支持
 * - 响应式设计适配
 */

import React from 'react';
import {
  TextInput,
  NumberInput,
  Select,
  Checkbox,
  Textarea,
  Text,
  Group,
  Stack,
  InputLabel,
  InputError,
  InputDescription,
} from '@mantine/core';
import type { ReactNode } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface FormFieldProps {
  /** 字段类型 */
  type: 'text' | 'number' | 'select' | 'checkbox' | 'textarea' | 'date' | 'currency' | 'percentage';
  /** 字段标识符 */
  name: string;
  /** 字段标签 */
  label?: string;
  /** 字段值 */
  value?: any;
  /** 占位符文本 */
  placeholder?: string;
  /** 描述文本 */
  description?: string;
  /** 错误信息 */
  error?: string;
  /** 是否必填 */
  required?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** Select 类型的选项 */
  options?: Array<{ value: string; label: string }>;
  /** 最小值（数字类型） */
  min?: number;
  /** 最大值（数字类型） */
  max?: number;
  /** 小数位数（数字类型） */
  precision?: number;
  /** 是否只读 */
  readonly?: boolean;
  /** 自定义前缀 */
  leftSection?: ReactNode;
  /** 自定义后缀 */
  rightSection?: ReactNode;
  /** 货币符号（currency 类型，可选） */
  currencySymbol?: string;
  /** 值变化回调 */
  onChange?: (value: any) => void;
  /** 失焦回调 */
  onBlur?: () => void;
  /** 获得焦点回调 */
  onFocus?: () => void;
}

// =============================================================================
// 主组件
// =============================================================================

export function FormField({
  type,
  name,
  label,
  value,
  placeholder,
  description,
  error,
  required = false,
  disabled = false,
  options = [],
  min,
  max,
  precision = 2,
  readonly = false,
  leftSection,
  rightSection,
  currencySymbol,
  onChange,
  onBlur,
  onFocus,
}: FormFieldProps) {

  // =============================================================================
  // 渲染不同类型的字段
  // =============================================================================

  const renderField = () => {
    const commonProps = {
      name,
      value: value || '',
      placeholder,
      disabled,
      readOnly: readonly,
      onBlur,
      onFocus,
      leftSection,
      rightSection,
    };

    switch (type) {
      case 'text':
        return (
          <TextInput
            {...commonProps}
            onChange={(event) => onChange?.(event.target.value)}
          />
        );

      case 'number':
        return (
          <TextInput
            {...commonProps}
            value={value !== undefined ? value.toString() : ''}
            type="number"
            inputMode="numeric" // 移动端优化
            onChange={(event) => {
              const stringValue = event.target.value;

              // 允许空值和正在输入的状态
              if (stringValue === '') {
                onChange?.(undefined);
                return;
              }

              // 对于整数字段，只允许整数
              const numericValue = precision === 0 ? parseInt(stringValue) : parseFloat(stringValue);

              if (!isNaN(numericValue)) {
                onChange?.(numericValue);
              }
            }}
          />
        );

      case 'currency':
        return (
          <TextInput
            {...commonProps}
            value={value !== undefined ? value.toString() : ''}
            type="number"
            inputMode="decimal" // 移动端优化，支持小数
            leftSection={currencySymbol ? <span style={{ color: 'var(--mantine-color-dimmed)' }}>{currencySymbol}</span> : undefined}
            onChange={(event) => {
              const stringValue = event.target.value;

              // 允许空值和正在输入的状态
              if (stringValue === '') {
                onChange?.(undefined);
                return;
              }

              const numericValue = parseFloat(stringValue);

              if (!isNaN(numericValue)) {
                onChange?.(numericValue);
              }
            }}
          />
        );

      case 'percentage':
        return (
          <TextInput
            {...commonProps}
            value={value !== undefined ? value.toString() : ''}
            type="number"
            step={precision !== undefined && precision > 0 ? Math.pow(10, -precision) : 'any'}
            inputMode="decimal" // 移动端优化，支持小数
            rightSection={<span style={{ color: 'var(--mantine-color-dimmed)' }}>%</span>}
            onChange={(event) => {
              const stringValue = event.target.value;

              // 允许空值 - 让用户可以清空输入框
              if (stringValue === '') {
                onChange?.(undefined);
                return;
              }

              // 允许部分输入状态（如单独的"-", ".", "0."等）
              // 只在输入是有效数字时才更新
              const numericValue = parseFloat(stringValue);

              if (!isNaN(numericValue)) {
                onChange?.(numericValue);
              }
              // 不处理无效输入，让用户继续输入
            }}
          />
        );

      case 'select':
        return (
          <Select
            {...commonProps}
            data={options}
            onChange={(val) => onChange?.(val)}
          />
        );

      case 'checkbox':
        return (
          <Checkbox
            name={name}
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(event) => onChange?.(event.target.checked)}
          />
        );

      case 'textarea':
        return (
          <Textarea
            {...commonProps}
            rows={4}
            onChange={(event) => onChange?.(event.target.value)}
          />
        );

      case 'date':
        return (
          <TextInput
            {...commonProps}
            type="date"
            value={value ? new Date(value).toISOString().split('T')[0] : ''}
            onChange={(event) => onChange?.(event.target.value)}
          />
        );

      default:
        return (
          <TextInput
            {...commonProps}
            onChange={(event) => onChange?.(event.target.value)}
          />
        );
    }
  };

  // =============================================================================
  // 主渲染
  // =============================================================================

  // Checkbox 类型需要特殊布局
  if (type === 'checkbox') {
    return (
      <Stack gap="xs">
        <Group gap="sm">
          {renderField()}
          {label && (
            <Text size="sm" fw={required ? 500 : 400}>
              {label}
              {required && <Text component="span" c="red" ml={4}>*</Text>}
            </Text>
          )}
        </Group>

        {description && (
          <InputDescription>{description}</InputDescription>
        )}

        {error && (
          <InputError>{error}</InputError>
        )}
      </Stack>
    );
  }

  // 其他类型的标准布局
  return (
    <Stack gap="xs">
      {label && (
        <InputLabel required={required} size="xs">
          {label}
        </InputLabel>
      )}

      {renderField()}

      {description && (
        <InputDescription>{description}</InputDescription>
      )}

      {error && (
        <InputError>{error}</InputError>
      )}
    </Stack>
  );
}

export default FormField;
