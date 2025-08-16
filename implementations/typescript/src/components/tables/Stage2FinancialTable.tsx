/**
 * Stage2FinancialTable - 二阶段专用财务表格组件
 *
 * 职责：
 * - 直接读取 plannerData（userProfile + incomeItems + expenseItems + overrides）
 * - 显示 base + overrides 的最终数据
 * - 处理用户编辑：autofill、edit cell
 * - 管理 override CRUD：add/update/remove
 * - 视觉反馈：橙色边框标识 override cells
 * - 撤销功能：删除 override，恢复到 base 值
 */

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Card,
  Title,
  Text,
  Stack,
  Group,
  Alert,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconTable, IconInfoCircle } from '@tabler/icons-react';
import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.min.css';
import { usePlannerStore } from '../../stores/plannerStore';
import { useAppStore } from '../../stores/appStore';
import { getI18n } from '../../core/i18n';
// 移除未使用的导入
// import type { IncomeExpenseItem } from '../../types';

// =============================================================================
// Types
// =============================================================================

interface Stage2ProjectionRow {
  year: number;
  age: number;
  [itemId: string]: number; // 每个收支项目的值
}

interface Stage2FinancialTableProps {
  /** 表格标题 */
  title?: string;
  /** 是否显示使用说明 */
  showInstructions?: boolean;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

// =============================================================================
// 主组件
// =============================================================================

export function Stage2FinancialTable({
  title = '财务规划表',
  showInstructions = false,
  style,
}: Stage2FinancialTableProps) {

  const hotRef = useRef<HTMLDivElement>(null);
  const hotInstance = useRef<Handsontable | null>(null);

  // 响应式设计 - 检测移动端
  const isMobile = useMediaQuery('(max-width: 768px)');

  // 统一的渲染调度器，避免多个setTimeout冲突
  const renderSchedulerRef = useRef<NodeJS.Timeout | null>(null);

  const scheduleRender = useCallback((preserveScroll: boolean = true, delay: number = 10) => {
    // 清除之前的渲染调度，避免冲突
    if (renderSchedulerRef.current) {
      clearTimeout(renderSchedulerRef.current);
    }

    renderSchedulerRef.current = setTimeout(() => {
      if (!hotInstance.current) return;

      if (preserveScroll) {
        renderWithScrollPosition();
      } else {
        hotInstance.current.render();
      }

      renderSchedulerRef.current = null;
    }, delay);
  }, []);

  // 保持滚动位置的重新渲染函数
  const renderWithScrollPosition = useCallback(() => {
    if (!hotInstance.current) return;

    try {
      // 尝试获取滚动容器，使用更安全的路径
      const scrollHolder = hotInstance.current.view?.wt?.wtTable?.holder ||
                          hotInstance.current.rootElement?.querySelector('.wtHolder') ||
                          hotInstance.current.rootElement;

      if (!scrollHolder) {
        // 如果找不到滚动容器，直接渲染
        hotInstance.current.render();
        return;
      }

      // 保存当前滚动位置
      const scrollTop = scrollHolder.scrollTop || 0;
      const scrollLeft = scrollHolder.scrollLeft || 0;

      // 重新渲染
      hotInstance.current.render();

      // 恢复滚动位置
      setTimeout(() => {
        if (scrollHolder) {
          scrollHolder.scrollTop = scrollTop;
          scrollHolder.scrollLeft = scrollLeft;
        }
      }, 0);
    } catch (error) {
      // 如果出错，至少保证渲染能执行
      console.warn('Failed to preserve scroll position:', error);
      hotInstance.current.render();
    }
  }, []);

  // i18n
  const currentLanguage = useAppStore(state => state.currentLanguage);
  const i18n = getI18n();
  const t = useCallback((key: string, variables?: Record<string, unknown>) => i18n.t(key, variables), [i18n]);

  // 使用正确的选择器避免无限循环
  const userProfile = usePlannerStore(state => state.data.user_profile);
  const incomeItems = usePlannerStore(state => state.data.income_items);
  const expenseItems = usePlannerStore(state => state.data.expense_items);
  const overrides = usePlannerStore(state => state.data.overrides);

  // 窗口宽度状态，用于响应式计算
  const [windowWidth, setWindowWidth] = React.useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 智能响应式列宽计算
  const columnWidths = useMemo(() => {
    const totalColumns = (incomeItems?.length || 0) + (expenseItems?.length || 0);

    if (isMobile) {
      // 移动端：更紧凑的自适应列宽
      const availableWidth = windowWidth - 32; // 减少 padding 让出更多空间

      // 计算最优列宽分布，优先紧凑性
      if (totalColumns <= 2) {
        // 列数少时，适度空间
        const firstColumnWidth = Math.min(100, availableWidth * 0.28);
        const dataColumnWidth = Math.max(75, (availableWidth - firstColumnWidth) / totalColumns);
        return [firstColumnWidth, ...Array(totalColumns).fill(dataColumnWidth)];
      } else if (totalColumns <= 4) {
        // 中等列数，紧凑布局
        const firstColumnWidth = Math.min(85, availableWidth * 0.22);
        const dataColumnWidth = Math.max(65, (availableWidth - firstColumnWidth) / totalColumns);
        return [firstColumnWidth, ...Array(totalColumns).fill(dataColumnWidth)];
      } else {
        // 列数多时，极致压缩布局
        const firstColumnWidth = Math.min(75, availableWidth * 0.18);
        const dataColumnWidth = Math.max(55, (availableWidth - firstColumnWidth) / totalColumns);
        return [firstColumnWidth, ...Array(totalColumns).fill(dataColumnWidth)];
      }
    } else {
      // 桌面端：根据列数智能调整
      if (totalColumns <= 4) {
        return [200, ...Array(totalColumns).fill(140)]; // 宽松布局
      } else if (totalColumns <= 8) {
        return [180, ...Array(totalColumns).fill(120)]; // 标准布局
      } else {
        return [160, ...Array(totalColumns).fill(100)]; // 紧凑布局
      }
    }
  }, [incomeItems, expenseItems, isMobile, windowWidth]);

  const addOverride = usePlannerStore(state => state.addOverride);
  const updateOverride = usePlannerStore(state => state.updateOverride);
  const removeOverride = usePlannerStore(state => state.removeOverride);
  const updateProjectionData = usePlannerStore(state => state.updateProjectionData);

  // 检测数值序列类型
  const detectSequenceType = useCallback((values: number[]): 'copy' | 'arithmetic' | 'geometric' | 'mixed' => {
    if (values.length === 1) return 'copy';
    if (values.length === 2) return 'arithmetic';

    // 检测等差数列
    const diff = values[1] - values[0];
    let isArithmetic = true;
    for (let i = 2; i < values.length; i++) {
      if (Math.abs((values[i] - values[i-1]) - diff) > 0.01) {
        isArithmetic = false;
        break;
      }
    }
    if (isArithmetic) return 'arithmetic';

    // 检测等比数列（用乘法验证）
    if (values[0] !== 0 && values[1] !== 0) {
      const ratio = values[1] / values[0];
      let isGeometric = true;
      for (let i = 2; i < values.length; i++) {
        if (values[i-1] === 0 || Math.abs(values[i] - values[i-1] * ratio) > 0.01) {
          isGeometric = false;
          break;
        }
      }
      if (isGeometric && Math.abs(ratio - 1) > 0.01) return 'geometric';
    }

    return 'mixed';
  }, []);

  // 生成自动填充值
  const generateAutofillValues = useCallback((selectedValues: number[], targetLength: number): number[] => {
    const sequenceType = detectSequenceType(selectedValues);
    const result: number[] = [...selectedValues];

    switch (sequenceType) {
      case 'copy':
        const copyValue = selectedValues[0];
        for (let i = selectedValues.length; i < targetLength; i++) {
          result.push(copyValue);
        }
        break;

      case 'arithmetic':
        const diff = selectedValues[1] - selectedValues[0];
        let lastValue = selectedValues[selectedValues.length - 1];
        for (let i = selectedValues.length; i < targetLength; i++) {
          lastValue += diff;
          result.push(lastValue);
        }
        break;

      case 'geometric':
        const ratio = selectedValues[1] / selectedValues[0];
        let lastGeoValue = selectedValues[selectedValues.length - 1];
        for (let i = selectedValues.length; i < targetLength; i++) {
          lastGeoValue *= ratio;
          result.push(lastGeoValue);
        }
        break;

      case 'mixed':
        const lastTwo = selectedValues.slice(-2);
        const mixedDiff = lastTwo[1] - lastTwo[0];
        let lastMixedValue = selectedValues[selectedValues.length - 1];
        for (let i = selectedValues.length; i < targetLength; i++) {
          lastMixedValue += mixedDiff;
          result.push(lastMixedValue);
        }
        break;
    }

    return result;
  }, [detectSequenceType]);

  // 判断列是否可编辑
  const isColumnEditable = useCallback((col: number): boolean => {
    if (col < 1) return false; // 第0列是年份，不可编辑
    return true; // 其他列都可以编辑
  }, []);

  // 生成基础投影数据（不含 override）
  const baseProjectionData = useMemo((): Stage2ProjectionRow[] => {
    if (!userProfile || !incomeItems || !expenseItems) return [];

    const birthYear = userProfile.birth_year || 1990;
    const currentYear = new Date().getFullYear();
    const currentAge = currentYear - birthYear;
    const startAge = currentAge;
    const endAge = userProfile.life_expectancy || 85;

    let rawInflationRate = userProfile.inflation_rate;
    if (rawInflationRate === undefined || rawInflationRate === null) {
      rawInflationRate = 3.0;
    }
    const inflationRate = rawInflationRate / 100;

    const data: Stage2ProjectionRow[] = [];
    const allItems = [...incomeItems, ...expenseItems];

    for (let age = startAge; age <= endAge; age++) {
      const year = birthYear + age;
      const row: Stage2ProjectionRow = { year, age };

      allItems.forEach(item => {
        if (age >= item.start_age && age <= (item.end_age || 999)) {
          const yearsFromStart = age - item.start_age;
          let baseAmount = item.after_tax_amount_per_period;

          if (item.frequency === 'recurring') {
            if (item.time_unit === 'monthly') {
              baseAmount = baseAmount * 12;
            }
          } else if (item.frequency === 'one-time') {
            if (yearsFromStart !== 0) {
              row[item.id as string] = 0;
              return;
            }
          }

          const isIncomeItem = incomeItems.some((inc: any) => inc.id === item.id);
          let currentAmount: number;

          if (isIncomeItem) {
            const itemGrowthRate = (item.annual_growth_rate || 0) / 100;
            currentAmount = baseAmount * Math.pow(1 + itemGrowthRate, yearsFromStart);
          } else {
            const itemGrowthRate = (item.annual_growth_rate || 0) / 100;
            const totalGrowthRate = inflationRate + itemGrowthRate;
            currentAmount = baseAmount * Math.pow(1 + totalGrowthRate, yearsFromStart);
          }

          row[item.id as string] = Math.round(currentAmount);
        } else {
          row[item.id as string] = 0;
        }
      });

      data.push(row);
    }

    return data;
  }, [userProfile, incomeItems, expenseItems]);

  // 应用 overrides 生成最终显示数据
  const finalProjectionData = useMemo((): Stage2ProjectionRow[] => {
    if (overrides.length === 0) return baseProjectionData;

    return baseProjectionData.map(row => {
      const finalRow = { ...row };

      // 应用该年龄的所有 override
      overrides.forEach(override => {
        if (override.age === row.age) {
          finalRow[override.item_id] = override.value;
        }
      });

      return finalRow;
    });
  }, [baseProjectionData, overrides]);

  // 计算并保存聚合投影数据到 plannerStore（供 Stage3 使用）
  useEffect(() => {
    if (finalProjectionData.length === 0 || !incomeItems || !expenseItems) return;

    const aggregatedProjectionData = finalProjectionData.map(row => {
      let totalIncome = 0;
      let totalExpense = 0;

      // 计算该行的总收入
      incomeItems.forEach(item => {
        const value = row[item.id as string];
        if (typeof value === 'number') {
          totalIncome += value;
        }
      });

      // 计算该行的总支出
      expenseItems.forEach(item => {
        const value = row[item.id as string];
        if (typeof value === 'number') {
          totalExpense += value;
        }
      });

      return {
        age: row.age,
        year: row.year,
        total_income: totalIncome,
        total_expense: totalExpense,
      };
    });

    // 保存到 plannerStore
    updateProjectionData(aggregatedProjectionData);
  }, [finalProjectionData, incomeItems, expenseItems, updateProjectionData]);

  // 生成表格数据格式
  const tableData = useMemo(() => {
    if (finalProjectionData.length === 0) return [];

    const allItems = [...incomeItems, ...expenseItems];
    const tableData = [];

    // 表头
    const headers = [t('table.headers.year_age')];
    incomeItems.forEach((item: any) => {
      headers.push(`💰 ${item.name}`);
    });
    expenseItems.forEach((item: any) => {
      headers.push(`💸 ${item.name}`);
    });
    tableData.push(headers);

    // 数据行
    finalProjectionData.forEach(rowData => {
      const row = [t('table.row.year_age_format', { year: rowData.year, age: rowData.age })];
      allItems.forEach((item: any) => {
        row.push(rowData[item.id as string] || 0);
      });
      tableData.push(row);
    });

    return tableData;
  }, [finalProjectionData, incomeItems, expenseItems, t, currentLanguage]);

  // 生成基础表格数据（用于撤销对比）
  const baseTableData = useMemo(() => {
    if (baseProjectionData.length === 0) return [];

    const allItems = [...incomeItems, ...expenseItems];
    const tableData = [];

    // 表头
    const headers = [t('table.headers.year_age')];
    incomeItems.forEach(item => {
      headers.push(`💰 ${item.name}`);
    });
    expenseItems.forEach(item => {
      headers.push(`💸 ${item.name}`);
    });
    tableData.push(headers);

    // 数据行
    baseProjectionData.forEach(rowData => {
      const row = [t('table.row.year_age_format', { year: rowData.year, age: rowData.age })];
      allItems.forEach((item: any) => {
        row.push(rowData[item.id as string] || 0);
      });
      tableData.push(row);
    });

    return tableData;
  }, [baseProjectionData, incomeItems, expenseItems, t, currentLanguage]);

  // 工具函数：根据列索引获取项目ID
  const getItemIdFromColumn = useCallback((col: number): string | null => {
    if (col < 1) return null; // 第0列是年份

    const allItems = [...(incomeItems || []), ...(expenseItems || [])];
    const itemIndex = col - 1;

    return allItems[itemIndex]?.id || null;
  }, [incomeItems, expenseItems]);

  // 工具函数：检查单元格是否被 override
  const isCellOverridden = useCallback((row: number, col: number): boolean => {
    if (row === 0 || col < 1) return false; // 跳过表头和年份列

    // 使用 baseProjectionData 保持与 handleUndoOverride 一致
    const age = baseProjectionData[row - 1]?.age;
    const itemId = getItemIdFromColumn(col);

    if (!age || !itemId) return false;

    // 动态获取最新的 overrides 状态，避免依赖闭包
    const currentOverrides = usePlannerStore.getState().data.overrides || [];
    return currentOverrides.some(override =>
      override.age === age && override.item_id === itemId
    );
  }, [baseProjectionData, getItemIdFromColumn]);

  // 处理撤销 override
  const handleUndoOverride = useCallback((row: number, col: number) => {
    // 使用 baseProjectionData 获取正确的年龄信息
    const age = baseProjectionData[row - 1]?.age;
    const itemId = getItemIdFromColumn(col);
    const originalValue = baseTableData[row]?.[col];


    if (age && itemId && originalValue !== undefined) {
      // 恢复到原始值
      hotInstance.current?.setDataAtCell(row, col, originalValue);

      // 删除 override - 动态获取最新的 overrides 状态
      const currentOverrides = usePlannerStore.getState().data.overrides || [];
      const existingIndex = currentOverrides.findIndex(
        override => override.age === age && override.item_id === itemId
      );
      if (existingIndex >= 0) {
        removeOverride(existingIndex);
      }

      // 重新渲染以更新样式，保持滚动位置
      // 使用合适延迟，确保 setDataAtCell 完成
      scheduleRender(true, 30);
    }
  }, [baseProjectionData, getItemIdFromColumn, baseTableData, removeOverride, scheduleRender]);

  // 创建 Handsontable
  useEffect(() => {
    if (!hotRef.current || tableData.length === 0) return;


    hotInstance.current = new Handsontable(hotRef.current, {
      licenseKey: 'non-commercial-and-evaluation',
      data: tableData,
      colWidths: columnWidths,
      rowHeights: 35,
      rowHeaders: false,
      colHeaders: false,
      fixedRowsTop: 1, // 冻结首行作为表头
      contextMenu: {
        items: {
          'undo_override': {
            name: t('table.context_menu.undo_override'),
            callback: () => {
              const selection = hotInstance.current?.getSelected();
              if (selection) {
                const [row, col] = selection[0];
                if (isCellOverridden(row, col)) {
                  handleUndoOverride(row, col);
                }
              }
            }
          }
        }
      },
      manualColumnResize: !isMobile, // 移动端禁用手动调整列宽，保持响应式设计

      // 填充手柄
      fillHandle: {
        autoInsertRow: false,
      },

      // 列配置
      columns: [
        { type: 'text', readOnly: true, className: 'htCenter htMiddle' }, // 年份列
        ...Array(incomeItems.length + expenseItems.length).fill({
          type: 'numeric',
          numericFormat: { pattern: '0,0' },
          className: 'htRight',
          readOnly: false
        })
      ],

      // 单元格渲染
      cells: (row: number, col: number) => {
        const cellProperties: any = {};

        if (row === 0) {
          // 表头
          cellProperties.className = 'htCenter htMiddle';
          cellProperties.renderer = function(_instance: any, td: HTMLElement) {
            Handsontable.renderers.TextRenderer.apply(this, arguments as any);
            td.style.backgroundColor = '#f8f9fa';
            td.style.fontWeight = 'bold';
            td.style.color = '#495057';
            td.style.borderBottom = '2px solid #dee2e6';
          };
          cellProperties.readOnly = true;
        } else if (col === 0) {
          // 年份列
          cellProperties.className = 'htCenter htMiddle';
          cellProperties.renderer = function(_instance: any, td: HTMLElement) {
            Handsontable.renderers.TextRenderer.apply(this, arguments as any);
            td.style.backgroundColor = '#f8f9fa';
            td.style.fontWeight = 'bold';
            td.style.color = '#495057';
            td.style.borderRight = '2px solid #dee2e6';
          };
          cellProperties.readOnly = true;
        } else {
          // 数据列
          cellProperties.renderer = function(_instance: any, td: HTMLElement, row: number, col: number, _prop: any, value: any) {
            Handsontable.renderers.NumericRenderer.apply(this, arguments as any);

            const isOverridden = isCellOverridden(row, col);
            const itemId = getItemIdFromColumn(col);
            const isIncomeItem = itemId && incomeItems.some(item => item.id === itemId);

            // 背景色
            let baseColor = '';
            if (isIncomeItem) {
              baseColor = '#e8f5e8'; // 收入 - 绿色系
            } else {
              baseColor = '#ffeaea'; // 支出 - 红色系
            }
            td.style.backgroundColor = baseColor;

            // Override 橙色边框
            if (isOverridden) {
              td.style.border = '3px solid #ff9f40';
              td.style.boxSizing = 'border-box';

              // 添加 tooltip
              const originalValue = baseTableData[row]?.[col];
              if (originalValue !== undefined) {
                td.title = t('table.override.tooltip_full', { value, originalValue });
              }
            } else {
              td.style.border = '';
              td.title = '';
            }

            // 负数红色
            if (typeof value === 'number' && value < 0) {
              td.style.color = '#dc3545';
            }
          };
        }

        return cellProperties;
      },

      // 数据变更前处理 - 处理自动填充
      beforeChange: (changes: any[], source: string) => {
        if (!changes) return;

        // 处理自动填充
        if (source === 'Autofill.fill') {
          // 获取选择的范围
          const selection = hotInstance.current?.getSelected();
          if (!selection) return;

          const [startRow, startCol, endRow, endCol] = selection[0];

          // 只允许编辑可编辑列
          const validChanges = changes.filter(change => {
            const [row, col] = change;
            return row > 0 && isColumnEditable(col);
          });

          if (validChanges.length === 0) {
            changes.length = 0;
            return;
          }

          // 获取源数据
          const selectedData: number[] = [];
          for (let row = startRow; row <= endRow; row++) {
            const cellValue = hotInstance.current?.getDataAtCell(row, startCol);
            if (typeof cellValue === 'number') {
              selectedData.push(cellValue);
            }
          }

          if (selectedData.length === 0) {
            changes.length = 0;
            return;
          }

          // 生成自动填充数据
          const fillLength = validChanges.length + selectedData.length;
          const autofillValues = generateAutofillValues(selectedData, fillLength);

          // 应用自动填充的值
          validChanges.forEach((change, index) => {
            const targetIndex = selectedData.length + index;
            if (targetIndex < autofillValues.length) {
              change[3] = autofillValues[targetIndex];
            }
          });

          return;
        }

        // 处理常规编辑
        changes.forEach(change => {
          const [row, col, oldValue, newValue] = change;

          // 表头行和不可编辑列不允许编辑
          if (row === 0 || !isColumnEditable(col)) {
            change[3] = oldValue;
            return;
          }

          // 数值验证和格式化
          if (typeof newValue === 'string' && newValue.trim() !== '') {
            const numValue = parseFloat(newValue.replace(/,/g, ''));
            if (!isNaN(numValue)) {
              change[3] = numValue;
            }
          }
        });

        return true;
      },

      // 处理数据变更
      afterChange: (changes: any[] | null, source: string) => {
        if (!changes || source === 'loadData') return;

        changes.forEach(([row, col, , newValue]) => {
          if (row > 0 && col > 0) { // 跳过表头和年份列
            const age = finalProjectionData[row - 1]?.age;
            const itemId = getItemIdFromColumn(col);
            const originalValue = baseTableData[row]?.[col];

            if (age && itemId && originalValue !== undefined) {
              if (newValue !== originalValue) {
                // 添加或更新 override - 动态获取最新状态
                const currentOverrides = usePlannerStore.getState().data.overrides || [];
                const existingIndex = currentOverrides.findIndex(
                  override => override.age === age && override.item_id === itemId
                );

                if (existingIndex >= 0) {
                  updateOverride(existingIndex, { age, item_id: itemId, value: newValue });
                } else {
                  addOverride({ age, item_id: itemId, value: newValue });
                }
              } else {
                // 值等于原始值，删除 override - 动态获取最新状态
                const currentOverrides2 = usePlannerStore.getState().data.overrides || [];
                const existingIndex2 = currentOverrides2.findIndex(
                  override => override.age === age && override.item_id === itemId
                );
                if (existingIndex2 >= 0) {
                  removeOverride(existingIndex2);
                }
              }
            }
          }
        });

        // 调度渲染以更新样式（override橙色框），保持滚动位置
        // 使用较长延迟，确保 Handsontable 内部处理完成
        scheduleRender(true, 50);
      },

      // Delete/Backspace 键撤销 (支持MacBook和Windows)
      beforeKeyDown: (event: KeyboardEvent) => {
        // MacBook: Backspace键 或 fn+Delete键
        // Windows/Linux: Delete键
        if ((event.key === 'Delete' || event.key === 'Backspace') && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const selection = hotInstance.current?.getSelected();
          if (selection) {
            const [row, col] = selection[0];
            if (isCellOverridden(row, col)) {
              event.preventDefault();
              handleUndoOverride(row, col);
              return false;
            }
          }
        }
        return true;
      }
    });

    return () => {
      // 清除待执行的渲染调度
      if (renderSchedulerRef.current) {
        clearTimeout(renderSchedulerRef.current);
        renderSchedulerRef.current = null;
      }

      if (hotInstance.current) {
        hotInstance.current.destroy();
        hotInstance.current = null;
      }
    };
  }, [currentLanguage, t, incomeItems, expenseItems, isColumnEditable, generateAutofillValues, isCellOverridden, handleUndoOverride, getItemIdFromColumn, addOverride, updateOverride, removeOverride, scheduleRender]); // 包含所有必要的函数依赖

  // 仅数据变化时更新表格内容，不重新创建
  useEffect(() => {
    if (!hotInstance.current || tableData.length === 0) return;

    // 更新表格数据，保持滚动位置
    hotInstance.current.loadData(tableData);

    // 重新渲染以应用样式（包括 override 橙色框），保持滚动位置
    scheduleRender(true, 15); // 稍微延长时间，确保 loadData 完成
  }, [tableData, scheduleRender]); // 依赖缓存的数据

  // 响应式列宽变化时更新表格列宽
  useEffect(() => {
    if (!hotInstance.current) return;

    // 更新列宽设置
    hotInstance.current.updateSettings({
      colWidths: columnWidths,
      manualColumnResize: !isMobile, // 同时更新手动调整列宽的设置
    });

    // 重新渲染以应用新的列宽
    scheduleRender(true, 10);
  }, [columnWidths, isMobile, scheduleRender]);

  // Override 变化时单独触发样式更新
  useEffect(() => {
    if (!hotInstance.current) return;

    // 只更新样式，不更新数据
    scheduleRender(true, 5); // 使用较短延迟，优先处理样式更新
  }, [overrides, scheduleRender]);

  return (
    <Card shadow="sm" padding="lg" radius="md" style={style}>
      <Stack gap="md">
        <Group mb="md">
          <IconTable size={24} color="var(--mantine-primary-color-6)" />
          <Title order={4}>{title}</Title>
        </Group>

        {showInstructions && (
          <Alert icon={<IconInfoCircle size={16} />} color="blue" mb="md">
            <Stack gap="xs">
              <Text size="sm" fw={600}>{t('table.instructions.title', { title })}</Text>
              <Text size="xs">{t('table.instructions.data_structure')}</Text>
              <Text size="xs">{t('table.instructions.editable_columns')}</Text>
              <Text size="xs">{t('table.instructions.autofill')}</Text>
              <Text size="xs">{t('table.instructions.edit')}</Text>
              <Text size="xs">{t('table.instructions.override_feature')}</Text>
              <Text size="xs">{t('table.instructions.undo_override')}</Text>
            </Stack>
          </Alert>
        )}

        <div
          ref={hotRef}
          style={{
            width: '100%',
            height: '400px',
            overflow: 'hidden',
            border: '1px solid var(--mantine-color-gray-3)',
            borderRadius: '8px'
          }}
        />

        {/* Debug: 显示 override 记录 */}
        {/* <div style={{ marginTop: '16px' }}>
          <Text size="sm" fw={600} mb="xs">
            🔧 当前Override记录 ({(overrides || []).length} 项):
          </Text>
          <div style={{
            backgroundColor: '#f8f9fa',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #dee2e6',
            maxHeight: '200px',
            overflow: 'auto'
          }}>
            <Text component="pre" size="xs" style={{
              margin: 0,
              fontFamily: 'Monaco, Consolas, monospace'
            }}>
              {JSON.stringify({ overrides }, null, 2)}
            </Text>
          </div>
          {(overrides || []).length === 0 && (
            <Text size="xs" c="dimmed" fs="italic" mt="xs">
              暂无override记录。编辑表格数值后会自动生成。
            </Text>
          )}
        </div> */}
      </Stack>
    </Card>
  );
}

export default Stage2FinancialTable;
