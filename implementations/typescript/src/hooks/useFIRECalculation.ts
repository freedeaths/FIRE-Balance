/**
 * useFIRECalculation Hook
 *
 * 专门处理FIRE计算的自定义Hook
 * - Stage2→Stage3时自动触发计算
 * - 管理计算状态和进度
 * - 提供计算结果
 */

import { useState, useEffect } from "react";
import { usePlannerStore } from "../stores/plannerStore";
import { FIRECalculationService } from "../services/fireCalculationService";
import { PlannerStage } from "../types";
import type { PlannerResults } from "../types";

export interface FIRECalculationState {
  isCalculating: boolean;
  progress: number;
  error: string | null;
  results: PlannerResults | null;
}

export function useFIRECalculation(
  currentStage: PlannerStage,
): FIRECalculationState & {
  runCalculation: () => Promise<void>;
  hasResults: boolean;
} {
  const [calculationState, setCalculationState] =
    useState<FIRECalculationState>({
      isCalculating: false,
      progress: 0,
      error: null,
      results: null,
    });

  const plannerResults = usePlannerStore((state) => state.data.results);

  // 只要二进三就计算
  useEffect(() => {
    if (currentStage === PlannerStage.STAGE3_ANALYSIS) {
      // 获取全局的 stage 变化信息
      const transition = (window as any).__fireStageTransition; // eslint-disable-line @typescript-eslint/no-explicit-any
      const prevStage = transition?.from;

      // 只要是从 Stage2 进入 Stage3 就计算
      if (prevStage === PlannerStage.STAGE2_ADJUSTMENT) {
        setCalculationState((prev) => ({
          ...prev,
          isCalculating: true,
          progress: 0,
          error: null,
        }));

        setTimeout(() => {
          runCalculation();
        }, 100);
      }
    }
  }, [currentStage]);

  // 单独处理 plannerResults 的显示 - 当有结果且在 Stage3 时显示
  useEffect(() => {
    if (
      currentStage === PlannerStage.STAGE3_ANALYSIS &&
      plannerResults?.fire_calculation
    ) {
      setCalculationState((prev) => ({
        ...prev,
        results: plannerResults,
        error: null,
      }));
    }
  }, [plannerResults, currentStage]);

  const runCalculation = async (): Promise<void> => {
    setCalculationState((prev) => ({
      ...prev,
      isCalculating: true,
      progress: 0,
      error: null,
    }));

    try {
      const results = await FIRECalculationService.runCalculationsForStage3(
        (progress) => {
          setCalculationState((prev) => ({
            ...prev,
            progress,
          }));
        },
      );

      // 计算完成

      setCalculationState((prev) => ({
        ...prev,
        isCalculating: false,
        progress: 100,
        results,
        error: null,
      }));
    } catch (error) {
      console.error("FIRE计算失败:", error);
      setCalculationState((prev) => ({
        ...prev,
        isCalculating: false,
        progress: 0,
        results: null,
        error: error instanceof Error ? error.message : "计算失败",
      }));
    }
  };

  return {
    ...calculationState,
    runCalculation,
    hasResults: !!calculationState.results || !!plannerResults,
  };
}
