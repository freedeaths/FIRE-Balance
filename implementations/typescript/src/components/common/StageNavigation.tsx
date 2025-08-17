/**
 * StageNavigation - 阶段导航按钮
 *
 * 轻量级导航组件，只负责：
 * - 前进/后退按钮
 * - 重新开始功能
 * - 响应式设计
 * - 即时验证状态（颜色表达）
 * - 懒验证消息（点击时显示）
 *
 * 不包含复杂的业务逻辑！
 */

import { useState, useMemo, useCallback } from "react";
import { Group, Button, Badge, Text, Stack, Box, Alert } from "@mantine/core";
import {
  IconArrowRight,
  IconArrowLeft,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { usePlannerStore } from "../../stores/plannerStore";
import { getI18n } from "../../core/i18n";
import { PlannerStage } from "../../types";
import { ConfirmDialog } from "./ConfirmDialog";

interface StageNavigationProps {
  currentStage: PlannerStage;
}

export function StageNavigation({
  currentStage,
}: StageNavigationProps): React.JSX.Element {
  // Store hooks
  const plannerStore = usePlannerStore();
  const isTransitioning = plannerStore.isTransitioning;

  // Local state for lazy validation messages
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  // 确认弹窗状态
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // i18n
  const i18n = getI18n();
  const t = useCallback(
    (key: string, variables?: Record<string, unknown>): string =>
      i18n.t(key, variables),
    [i18n],
  );

  // 验证第一阶段数据完整性
  const validateStage1 = useMemo(() => {
    const data = plannerStore.data;
    const errors: string[] = [];

    // 检查用户档案
    if (!data.user_profile) {
      errors.push(t("validation.user_profile_missing"));
    } else {
      const profile = data.user_profile;
      if (!profile.birth_year) errors.push(t("validation.birth_year_required"));
      if (!profile.expected_fire_age)
        errors.push(t("validation.fire_age_required"));
      if (!profile.legal_retirement_age)
        errors.push(t("validation.retirement_age_required"));
      if (!profile.life_expectancy)
        errors.push(t("validation.life_expectancy_required"));
      if (profile.current_net_worth === undefined)
        errors.push(t("validation.net_worth_required"));
      if (
        profile.inflation_rate === undefined ||
        profile.inflation_rate === null
      )
        errors.push(t("validation.inflation_rate_required"));
      if (!profile.safety_buffer_months)
        errors.push(t("validation.safety_buffer_required"));
    }

    // 检查投资组合配置
    if (!data.user_profile?.portfolio?.asset_classes?.length) {
      errors.push(t("validation.portfolio_required"));
    } else {
      const totalAllocation = data.user_profile.portfolio.asset_classes.reduce(
        (sum, asset) => sum + (asset.allocation_percentage || 0),
        0,
      );
      if (Math.abs(totalAllocation - 100) > 0.01) {
        errors.push(t("validation.portfolio_allocation_invalid"));
      }
    }

    // 检查收支项目 - 至少各有一项
    if (!data.income_items?.length) {
      errors.push(t("validation.income_items_required"));
    }
    if (!data.expense_items?.length) {
      errors.push(t("validation.expense_items_required"));
    }

    // 检查收支项目的年龄范围
    if (data.user_profile) {
      const currentYear = new Date().getFullYear();
      const currentAge = currentYear - data.user_profile.birth_year;
      const lifeExpectancy = data.user_profile.life_expectancy;

      // 验证收入项目
      data.income_items?.forEach((item, index) => {
        if (item.start_age < currentAge) {
          errors.push(
            t("validation.income_start_age_too_early", {
              index: index + 1,
              startAge: item.start_age,
              currentAge,
            }),
          );
        }
        if (item.frequency === "recurring" && item.end_age) {
          if (item.end_age > lifeExpectancy) {
            errors.push(
              t("validation.income_end_age_too_late", {
                index: index + 1,
                endAge: item.end_age,
                lifeExpectancy,
              }),
            );
          }
          if (item.start_age >= item.end_age) {
            errors.push(
              t("validation.income_age_range_invalid", {
                index: index + 1,
                startAge: item.start_age,
                endAge: item.end_age,
              }),
            );
          }
        }
      });

      // 验证支出项目
      data.expense_items?.forEach((item, index) => {
        if (item.start_age < currentAge) {
          errors.push(
            t("validation.expense_start_age_too_early", {
              index: index + 1,
              startAge: item.start_age,
              currentAge,
            }),
          );
        }
        if (item.frequency === "recurring" && item.end_age) {
          if (item.end_age > lifeExpectancy) {
            errors.push(
              t("validation.expense_end_age_too_late", {
                index: index + 1,
                endAge: item.end_age,
                lifeExpectancy,
              }),
            );
          }
          if (item.start_age >= item.end_age) {
            errors.push(
              t("validation.expense_age_range_invalid", {
                index: index + 1,
                startAge: item.start_age,
                endAge: item.end_age,
              }),
            );
          }
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [plannerStore.data, t]);

  // 阶段配置
  const stageConfig = {
    [PlannerStage.STAGE1_INPUT]: {
      canGoBack: false,
      canGoForward: true,
      backLabel: "",
      forwardLabel: t("ui.continue_to_stage2"),
      stageNumber: 1,
      nextStageNumber: 2,
      validation: validateStage1, // 原有验证逻辑 - 恢复
    },
    [PlannerStage.STAGE2_ADJUSTMENT]: {
      canGoBack: true,
      canGoForward: true,
      backLabel: t("ui.back_to_stage1"),
      forwardLabel: t("ui.continue_to_analysis"),
      stageNumber: 2,
      nextStageNumber: 3,
      validation: { isValid: true, errors: [] }, // Stage 2 validation can be added later
    },
    [PlannerStage.STAGE3_ANALYSIS]: {
      canGoBack: true,
      canGoForward: false,
      backLabel: t("ui.back_to_projections"),
      forwardLabel: "",
      stageNumber: 3,
      nextStageNumber: null,
      validation: { isValid: true, errors: [] },
    },
  };

  const config = stageConfig[currentStage];

  // 导航处理
  const handleNext = useCallback((): void => {
    if (!config.canGoForward || isTransitioning) return;

    // 懒验证：点击时检查验证状态
    if (!config.validation.isValid) {
      setShowValidationErrors(true);
      return;
    }

    plannerStore.setTransitioning(true);
    try {
      plannerStore.setStageProgress(currentStage, true);
      plannerStore.advanceStage();
      setShowValidationErrors(false); // 成功后清除验证消息
    } finally {
      plannerStore.setTransitioning(false);
    }
  }, [
    config.canGoForward,
    config.validation.isValid,
    isTransitioning,
    plannerStore,
    currentStage,
  ]);

  const handleBack = useCallback((): void => {
    if (!config.canGoBack || isTransitioning) return;
    setShowValidationErrors(false); // 返回时清除验证消息
    plannerStore.goToPreviousStage();
  }, [config.canGoBack, isTransitioning, plannerStore]);

  const handleRestart = useCallback((): void => {
    if (isTransitioning) return;
    setShowConfirmDialog(true);
  }, [isTransitioning]);

  // 确认重新开始
  const handleConfirmRestart = useCallback((): void => {
    setShowValidationErrors(false); // 重新开始时清除验证消息

    // 使用与ImportExportControls相同的逻辑
    plannerStore.reset();

    // 显示成功通知（如果需要）
    // notifications.show({
    //   title: t('import_export.success'),
    //   message: t('import_export.clear_success'),
    //   color: 'blue',
    // });
  }, [plannerStore]);

  // 获取按钮颜色和变体（即时验证状态表达）
  const getButtonProps = (): { color: string; variant: string } => {
    if (!config.canGoForward) return { color: "blue", variant: "filled" };

    if (config.validation.isValid) {
      return { color: "green", variant: "filled" }; // 验证通过：绿色
    } else {
      return { color: "orange", variant: "outline" }; // 验证未通过：橙色轮廓
    }
  };

  // 获取内容区域样式（即时验证状态表达）
  const getContentStyle = (): React.CSSProperties => {
    if (!config.canGoForward) return {};

    if (config.validation.isValid) {
      return {
        backgroundColor: "#f0f9f0",
        borderRadius: "8px",
        padding: "16px",
        border: "2px solid #28a745",
      }; // 验证通过：淡绿色背景
    } else {
      return {
        backgroundColor: "#fff8f0",
        borderRadius: "8px",
        padding: "16px",
        border: "2px solid #fd7e14",
      }; // 验证未通过：淡橙色背景
    }
  };

  const buttonProps = getButtonProps();
  const contentStyle = getContentStyle();

  return (
    <div>
      {/* 验证错误消息（懒验证） */}
      {showValidationErrors && !config.validation.isValid && (
        <Alert
          icon={<IconAlertTriangle size={16} />}
          color="orange"
          mb="md"
          onClose={() => setShowValidationErrors(false)}
          withCloseButton
        >
          <Text size="sm" fw={500} mb="xs">
            {t("validation.please_fix_following_issues")}
          </Text>
          <Stack gap="xs">
            {config.validation.errors.map((error, index) => (
              <Text key={index} size="xs">
                • {error}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}

      {/* 大屏导航 */}
      <Box visibleFrom="sm" style={contentStyle}>
        <Group justify="space-between" align="center">
          <div>
            {config.canGoBack && (
              <Button
                variant="subtle"
                leftSection={<IconArrowLeft size={16} />}
                onClick={handleBack}
                disabled={isTransitioning}
              >
                {config.backLabel}
              </Button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* 状态文字：只有验证通过时显示 */}
            {config.canGoForward && config.validation.isValid && (
              <Text size="sm" c="green" fw={500}>
                ✅ {t("ui.ready_to_continue")}
              </Text>
            )}

            {config.canGoForward && (
              <Button
                size="lg"
                {...buttonProps}
                rightSection={<IconArrowRight size={20} />}
                onClick={handleNext}
                loading={isTransitioning}
                disabled={isTransitioning}
              >
                {config.forwardLabel}
              </Button>
            )}

            {currentStage === PlannerStage.STAGE3_ANALYSIS && (
              <Button
                variant="outline"
                color="red"
                onClick={handleRestart}
                disabled={isTransitioning}
              >
                {t("ui.start_new_plan")}
              </Button>
            )}
          </div>
        </Group>
      </Box>

      {/* 小屏导航 */}
      <Box hiddenFrom="sm" style={contentStyle}>
        <Stack gap="md">
          {/* 阶段信息 */}
          <Group justify="center" gap="xs">
            <Badge variant="filled" color="blue" size="sm">
              {t("stage")} {config.stageNumber}
            </Badge>

            {config.canGoForward && config.validation.isValid && (
              <Text size="sm" c="green" fw={500}>
                ✅ {t("ui.ready_to_continue")}
              </Text>
            )}
            {config.nextStageNumber && (
              <>
                <IconArrowRight size={12} color="var(--mantine-color-dimmed)" />
                <Badge variant="outline" color="gray" size="sm">
                  {t("stage")} {config.nextStageNumber}
                </Badge>
              </>
            )}
          </Group>

          {/* 操作按钮 */}
          <Group justify="space-between" align="center">
            <div>
              {config.canGoBack && (
                <Button
                  variant="outline"
                  size="sm"
                  leftSection={<IconArrowLeft size={16} />}
                  onClick={handleBack}
                  disabled={isTransitioning}
                >
                  {t("previous")}
                </Button>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {config.canGoForward && (
                <Button
                  size="sm"
                  {...buttonProps}
                  rightSection={<IconArrowRight size={16} />}
                  onClick={handleNext}
                  loading={isTransitioning}
                  disabled={isTransitioning}
                >
                  {t("next")}
                </Button>
              )}

              {currentStage === PlannerStage.STAGE3_ANALYSIS && (
                <Button
                  variant="outline"
                  color="red"
                  size="sm"
                  onClick={handleRestart}
                  disabled={isTransitioning}
                >
                  {t("ui.new_plan")}
                </Button>
              )}
            </div>
          </Group>
        </Stack>
      </Box>

      {/* 确认弹窗 */}
      <ConfirmDialog
        opened={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handleConfirmRestart}
        title={t("import_export.clear_data")}
        message={t("import_export.clear_data_confirm")}
        confirmLabel={t("import_export.clear_data")}
        cancelLabel={t("cancel")}
        confirmColor="red"
        iconType="delete"
      />
    </div>
  );
}

export default StageNavigation;
