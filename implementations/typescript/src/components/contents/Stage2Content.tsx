/**
 * Stage2Content - 第二阶段内容组件
 *
 * 专门用于 Stage2 的财务投影表格和图表展示
 */

import React from "react";
import {
  Container,
  Card,
  Title,
  Text,
  Stack,
  Group,
  Divider,
} from "@mantine/core";
import { IconChartLine } from "@tabler/icons-react";
import { getI18n } from "../../core/i18n";
import Stage2FinancialTable from "../tables/Stage2FinancialTable";
import IncomeExpenseBreakdownChart from "../charts/IncomeExpenseBreakdownChart";

export function Stage2Content(): React.JSX.Element {
  const i18n = getI18n();
  const t = (key: string, variables?: Record<string, unknown>): string =>
    i18n.t(key, variables);

  return (
    <Container size="xl" py="md">
      <Stack gap="xl">
        <div>
          <Title order={2} mb="sm">
            {t("stage2_title")}
          </Title>
          <Text c="dimmed" mb="md">
            {t("stage2_description")}
          </Text>
        </div>

        <Stage2FinancialTable
          title={t("financial_planning_table")}
          showInstructions={true}
        />

        <Divider />

        <Card withBorder>
          <Group mb="md">
            <IconChartLine size={24} color="var(--mantine-primary-color-6)" />
            <Title order={4}>{t("financial_projections_chart")}</Title>
            <Text size="sm" c="dimmed">
              ({t("chart_based_on_modified_data")})
            </Text>
          </Group>
          <IncomeExpenseBreakdownChart height={350} title="" />
        </Card>
      </Stack>
    </Container>
  );
}

export default Stage2Content;
