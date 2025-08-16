/**
 * useFIRECalculation Hook
 *
 * 专门处理FIRE计算的自定义Hook
 * - Stage2→Stage3时自动触发计算
 * - 管理计算状态和进度
 * - 提供计算结果
 */

import { useState, useEffect } from 'react';
import { usePlannerStore } from '../stores/plannerStore';
import { FIRECalculationService } from '../services/fireCalculationService';
import { PlannerStage } from '../types';
import type { PlannerResults } from '../types';

export interface FIRECalculationState {
  isCalculating: boolean;
  progress: number;
  error: string | null;
  results: PlannerResults | null;
}

export function useFIRECalculation(currentStage: PlannerStage) {
  const [calculationState, setCalculationState] = useState<FIRECalculationState>({
    isCalculating: false,
    progress: 0,
    error: null,
    results: null
  });

  const plannerResults = usePlannerStore(state => state.results);
  const plannerData = usePlannerStore(state => state.data);

  // Stage3进入时自动触发计算
  useEffect(() => {
    if (currentStage === PlannerStage.STAGE3_ANALYSIS) {
      // 检查是否需要重新计算
      const needsCalculation = !plannerResults ||
        !plannerResults.calculation_timestamp;

      if (needsCalculation) {
        // 立即显示进度条
        setCalculationState(prev => ({
          ...prev,
          isCalculating: true,
          progress: 0,
          error: null
        }));

        // 稍微延迟一下再开始计算，确保UI更新
        setTimeout(() => {
          runCalculation();
        }, 100);
      } else {
        // 使用已有结果
        setCalculationState(prev => ({
          ...prev,
          results: plannerResults,
          error: null
        }));
      }
    }
  }, [currentStage]); // 只依赖 currentStage，避免无限循环

  const runCalculation = async () => {
    setCalculationState(prev => ({
      ...prev,
      isCalculating: true,
      progress: 0,
      error: null
    }));

    try {
      const results = await FIRECalculationService.runCalculationsForStage3(
        (progress) => {
          setCalculationState(prev => ({
            ...prev,
            progress
          }));
        }
      );

      setCalculationState(prev => ({
        ...prev,
        isCalculating: false,
        progress: 100,
        results,
        error: null
      }));

    } catch (error) {
      console.error('FIRE计算失败:', error);
      setCalculationState(prev => ({
        ...prev,
        isCalculating: false,
        progress: 0,
        results: null,
        error: error instanceof Error ? error.message : '计算失败'
      }));
    }
  };

  return {
    ...calculationState,
    runCalculation,
    hasResults: !!calculationState.results || !!plannerResults
  };
}
