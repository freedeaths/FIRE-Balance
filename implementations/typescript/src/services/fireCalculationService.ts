/**
 * FIRECalculationService - FIRE计算服务
 *
 * 职责：
 * - 处理Stage2→Stage3的FIRE计算
 * - 管理Monte Carlo进度
 * - 数据类型转换 (UI ↔ Core)
 * - 与plannerStore交互
 */

import { Decimal } from 'decimal.js';
import { FIREPlanner } from '../core/planner';
import { usePlannerStore } from '../stores/plannerStore';
import type {
  PlannerResults as CorePlannerResults,
  PlannerData as CorePlannerData
} from '../core/planner_models';
import type { PlannerResults as UIPlannerResults } from '../types';

// =============================================================================
// 类型转换函数
// =============================================================================

/**
 * 将 Core PlannerResults (Decimal) 转换为 UI PlannerResults (number)
 */
function convertCoreResultsToUI(coreResults: CorePlannerResults): UIPlannerResults {
  return {
    fire_calculation: {
      is_fire_achievable: coreResults.fire_calculation.is_fire_achievable,
      fire_net_worth: coreResults.fire_calculation.fire_net_worth.toNumber(),
      min_net_worth_after_fire: coreResults.fire_calculation.min_net_worth_after_fire.toNumber(),
      final_net_worth: coreResults.fire_calculation.final_net_worth.toNumber(),
      safety_buffer_months: coreResults.fire_calculation.safety_buffer_months.toNumber(),
      min_safety_buffer_ratio: coreResults.fire_calculation.min_safety_buffer_ratio.toNumber(),
      retirement_years: coreResults.fire_calculation.retirement_years,
      total_years_simulated: coreResults.fire_calculation.total_years_simulated,
      traditional_fire_number: coreResults.fire_calculation.traditional_fire_number.toNumber(),
      traditional_fire_achieved: coreResults.fire_calculation.traditional_fire_achieved,
      fire_success_probability: coreResults.fire_calculation.fire_success_probability?.toNumber() || 0,
      yearly_results: coreResults.fire_calculation.yearly_results.map(state => ({
        age: state.age,
        year: state.year,
        total_income: state.total_income.toNumber(),
        total_expense: state.total_expense.toNumber(),
        investment_return: state.investment_return.toNumber(),
        net_cash_flow: state.net_cash_flow.toNumber(),
        portfolio_value: state.portfolio_value.toNumber(),
        net_worth: state.net_worth.toNumber(),
        is_sustainable: state.is_sustainable,
        fire_number: state.fire_number.toNumber(),
        fire_progress: state.fire_progress.toNumber(),
      }))
    },
    monte_carlo_success_rate: coreResults.monte_carlo_success_rate?.toNumber(),
    recommendations: coreResults.recommendations,
    calculation_timestamp: coreResults.calculation_timestamp.toISOString()
  };
}

// =============================================================================
// FIRE计算服务
// =============================================================================

export interface FIRECalculationProgressCallback {
  (progress: number): void;
}

export class FIRECalculationService {

  /**
   * 运行Stage3的FIRE计算（包含Monte Carlo）
   */
  static async runCalculationsForStage3(
    progressCallback?: FIRECalculationProgressCallback
  ): Promise<UIPlannerResults> {

    const plannerData = usePlannerStore.getState().data;

    if (!plannerData.user_profile) {
      throw new Error('User profile is missing');
    }

    // 基本数据验证
    if (!plannerData.user_profile) {
      throw new Error('User profile is missing');
    }
    if (!plannerData.simulation_settings) {
      throw new Error('Simulation settings are missing');
    }
    if (!plannerData.income_items || plannerData.income_items.length === 0) {
      throw new Error('Income items are missing');
    }
    if (!plannerData.expense_items || plannerData.expense_items.length === 0) {
      throw new Error('Expense items are missing');
    }

    // 创建 FIREPlanner 实例
    const planner = new FIREPlanner();

    // 转换数据类型：从 UI types (number) 到 Core types (Decimal)
    // 添加详细的错误捕获来定位问题
    let convertedData: CorePlannerData;

    try {

      // 转换 simulation_settings
      const convertedSimulationSettings = {
        ...plannerData.simulation_settings,
        num_simulations: plannerData.simulation_settings.num_simulations ?? 1000,
        confidence_level: new Decimal(plannerData.simulation_settings.confidence_level ?? 0.95),
        income_base_volatility: new Decimal(plannerData.simulation_settings.income_base_volatility ?? 0.1),
        income_minimum_factor: new Decimal(plannerData.simulation_settings.income_minimum_factor ?? 0.5),
        expense_base_volatility: new Decimal(plannerData.simulation_settings.expense_base_volatility ?? 0.05),
        expense_minimum_factor: new Decimal(plannerData.simulation_settings.expense_minimum_factor ?? 0.8)
      };

      // 转换 income_items
      const convertedIncomeItems = plannerData.income_items.map((item) => {
        return {
          ...item,
          after_tax_amount_per_period: new Decimal(item.after_tax_amount_per_period ?? 0),
          annual_growth_rate: new Decimal(item.annual_growth_rate ?? 0)
        };
      });

      // 转换 expense_items
      const convertedExpenseItems = plannerData.expense_items.map((item) => {
        return {
          ...item,
          after_tax_amount_per_period: new Decimal(item.after_tax_amount_per_period ?? 0),
          annual_growth_rate: new Decimal(item.annual_growth_rate ?? 0)
        };
      });

      // 转换 overrides
      const convertedOverrides = plannerData.overrides.map((override) => {
        return {
          ...override,
          value: new Decimal(override.value ?? 0)
        };
      });

      // 转换 user_profile
      const convertedAssetClasses = plannerData.user_profile.portfolio.asset_classes.map((asset) => {
        return {
          ...asset,
          allocation_percentage: new Decimal(asset.allocation_percentage ?? 0),
          expected_return: new Decimal(asset.expected_return ?? 0),
          volatility: new Decimal(asset.volatility ?? 0)
        };
      });

      const convertedUserProfile = {
        ...plannerData.user_profile,
        current_net_worth: new Decimal(plannerData.user_profile.current_net_worth ?? 0),
        inflation_rate: new Decimal(plannerData.user_profile.inflation_rate ?? 0.03),
        safety_buffer_months: new Decimal(plannerData.user_profile.safety_buffer_months ?? 6),
        portfolio: {
          ...plannerData.user_profile.portfolio,
          asset_classes: convertedAssetClasses
        }
      };

      // 转换 projection_data (如果存在)
      let convertedProjectionData = undefined;
      if (plannerData.projection_data) {
        convertedProjectionData = plannerData.projection_data.map((row) => {
          return {
            ...row,
            total_income: new Decimal(row.total_income ?? 0),
            total_expense: new Decimal(row.total_expense ?? 0)
          };
        });
      }

      convertedData = {
        current_stage: plannerData.current_stage,
        session_id: plannerData.session_id,
        created_at: new Date(plannerData.created_at),
        updated_at: new Date(plannerData.updated_at),
        language: plannerData.language,
        simulation_settings: convertedSimulationSettings,
        income_items: convertedIncomeItems,
        expense_items: convertedExpenseItems,
        overrides: convertedOverrides,
        user_profile: convertedUserProfile,
        projection_df: convertedProjectionData
      };


    } catch (error) {
      console.error('❌ 数据转换失败:', error);
      throw new Error(`数据转换失败: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 设置转换后的数据
    planner.data = convertedData;

    // 进度回调函数，带延迟以确保UI能看到进度变化
    const internalProgressCallback = (progress: number): void => {
      if (progressCallback) {
        const roundedProgress = Math.round(progress * 100);
        progressCallback(roundedProgress);

        // 对于重要的进度节点添加小延迟，让用户能看到进度变化
        if (roundedProgress === 30 || roundedProgress === 80) {
          // 使用setTimeout确保UI有时间更新
          setTimeout(() => {}, 50);
        }
      }
    };

    // 运行完整计算（包含 Monte Carlo 模拟）
    const coreResults = await planner.runCalculations(internalProgressCallback);

    // 转换结果类型
    const uiResults = convertCoreResultsToUI(coreResults);

    // 保存到 store
    usePlannerStore.getState().updateResults(uiResults);

    return uiResults;
  }
}
