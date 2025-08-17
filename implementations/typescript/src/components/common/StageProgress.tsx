/**
 * StageProgress - 三阶段状态指示器
 *
 * 显示当前用户在三阶段流程中的进度
 *
 * TODO: 响应式优化疑问
 * 当前使用 useMediaQuery 实现移动端只显示图标，但理论上应该用 Tailwind 解决。
 * 尝试过的方法失败了：
 * - `<span className="hidden md:inline">{text}</span>` - 可能被 Mantine 内部样式覆盖
 * - 需要研究 Mantine Stepper 的实际 DOM 结构和 CSS 类名
 * - 或者使用 Tailwind 的任意值选择器: `[&_.mantine-Stepper-stepLabel]:hidden md:[&_.mantine-Stepper-stepLabel]:block`
 *
 * 当前方案可以工作，但不是最优雅的 Tailwind 方式。
 */

import React from "react";
import { Stepper } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconUser, IconTable, IconReportAnalytics } from "@tabler/icons-react";
import { getI18n } from "../../core/i18n";
import { PlannerStage } from "../../types";

interface StageProgressProps {
  currentStage: PlannerStage;
}

export function StageProgress({ currentStage }: StageProgressProps) {
  // i18n
  const i18n = getI18n();
  const t = (key: string, variables?: Record<string, any>) =>
    i18n.t(key, variables);

  // 检测是否为桌面端 (TODO: 应该用 Tailwind 的 hidden md:block 替代，但需要解决 Mantine 样式覆盖问题)
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Get active step number
  const getActiveStep = (): number => {
    switch (currentStage) {
      case PlannerStage.STAGE1_INPUT:
        return 0;
      case PlannerStage.STAGE2_ADJUSTMENT:
        return 1;
      case PlannerStage.STAGE3_ANALYSIS:
        return 2;
      default:
        return 0;
    }
  };

  return (
    <Stepper active={getActiveStep()} size="sm">
      <Stepper.Step
        label={isDesktop ? t("stage1_title") : undefined}
        description={isDesktop ? t("stage1_description") : undefined}
        icon={<IconUser size={18} />}
      />
      <Stepper.Step
        label={isDesktop ? t("stage2_title") : undefined}
        description={isDesktop ? t("stage2_description") : undefined}
        icon={<IconTable size={18} />}
      />
      <Stepper.Step
        label={isDesktop ? t("stage3_title") : undefined}
        description={isDesktop ? t("stage3_description") : undefined}
        icon={<IconReportAnalytics size={18} />}
      />
    </Stepper>
  );
}

export default StageProgress;
