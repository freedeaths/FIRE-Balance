/**
 * Stage1Content - 第一阶段纯内容组件
 *
 * 只负责：
 * - 用户档案输入 (User Profile)
 * - 投资组合配置 (Portfolio Configuration)
 * - 收支项目管理 (Income & Expense Items)
 *
 * 不负责：
 * - 导航按钮（由StageContainer处理）
 * - 阶段切换逻辑
 * - 进度指示
 */

import React, { useState } from 'react';
import type { JSX } from 'react';
import {
  Container,
  Card,
  Title,
  Text,
  Grid,
  Stack,
  Group,
  Alert,
} from '@mantine/core';
import {
  IconUser,
  IconChartPie,
  IconWallet,
  IconInfoCircle,
  IconAlertTriangle,
  IconCircleCheck,
  IconCircleX,
} from '@tabler/icons-react';
import { usePlannerStore } from '../../stores/plannerStore';
import { useAppStore } from '../../stores/appStore';
import { FormField } from '../forms/FormField';
import { IncomeExpenseForm } from '../forms/IncomeExpenseForm';
import { getI18n } from '../../core/i18n';
import type { UserProfile } from '../../types';
import { DEFAULT_PORTFOLIO } from '../../types';

export function Stage1Content() {
  // Store hooks
  const plannerStore = usePlannerStore();
  const { currentLanguage } = useAppStore();

  // Local state
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  // i18n
  const i18n = getI18n();
  const t = (key: string, variables?: Record<string, any>) =>
    i18n.t(key, variables);

  // Get data from store
  const userProfile = plannerStore.data.user_profile || ({} as UserProfile);
  const incomeItems = plannerStore.data.income_items || [];
  const expenseItems = plannerStore.data.expense_items || [];

  // Profile字段验证函数
  const validateProfileField = (
    field: keyof UserProfile,
    value: number,
    currentProfile: UserProfile
  ): string | null => {
    const systemYear = new Date().getFullYear();
    const asOfYear = currentProfile.as_of_year || systemYear;

    switch (field) {
      case 'birth_year': {
        if (value < 1900) {
          return t('validation.birth_year_too_old_min', { birthYear: value });
        }
        if (value > asOfYear) {
          return t('validation.birth_year_future', {
            birthYear: value,
            currentYear: asOfYear,
          });
        }
        // 检查年龄范围
        const age = asOfYear - value;
        if (age < 18) {
          return t('validation.birth_year_too_recent', {
            birthYear: value,
            currentAge: age,
          });
        }
        if (age > 100) {
          return t('validation.birth_year_too_old_max', {
            birthYear: value,
            currentAge: age,
          });
        }
        break;
      }

      case 'as_of_year': {
        if (value < 1950) {
          return t('validation.as_of_year_too_old', { year: value });
        }
        if (value > systemYear) {
          return t('validation.as_of_year_future', {
            year: value,
            currentYear: systemYear,
          });
        }
        if (currentProfile.birth_year) {
          const age = value - currentProfile.birth_year;
          if (age < 18) {
            return t('validation.as_of_year_inconsistent', {
              year: value,
              birthYear: currentProfile.birth_year,
            });
          }
        }
        break;
      }

      case 'expected_fire_age': {
        if (currentProfile.birth_year) {
          const currentAge = asOfYear - currentProfile.birth_year;
          if (value < currentAge) {
            return t('validation.fire_age_too_small', {
              fireAge: value,
              currentAge,
            });
          }
        }
        if (
          currentProfile.legal_retirement_age &&
          value >= currentProfile.legal_retirement_age
        ) {
          return t('validation.fire_age_too_large', {
            fireAge: value,
            retirementAge: currentProfile.legal_retirement_age,
          });
        }
        break;
      }

      case 'legal_retirement_age': {
        if (
          currentProfile.expected_fire_age &&
          value <= currentProfile.expected_fire_age
        ) {
          return t('validation.legal_retirement_age_too_small', {
            retirementAge: value,
            fireAge: currentProfile.expected_fire_age,
          });
        }
        if (
          currentProfile.life_expectancy &&
          value >= currentProfile.life_expectancy
        ) {
          return t('validation.legal_retirement_age_too_large', {
            retirementAge: value,
            lifeExpectancy: currentProfile.life_expectancy,
          });
        }
        break;
      }

      case 'life_expectancy': {
        if (
          currentProfile.legal_retirement_age &&
          value <= currentProfile.legal_retirement_age
        ) {
          return t('validation.life_expectancy_too_small', {
            lifeExpectancy: value,
            retirementAge: currentProfile.legal_retirement_age,
          });
        }
        if (currentProfile.birth_year) {
          const currentAge = asOfYear - currentProfile.birth_year;
          if (value - currentAge < 10) {
            return t('validation.life_span_too_short', {
              lifeExpectancy: value,
              currentAge,
            });
          }
        }
        break;
      }

      default:
        return null;
    }

    return null;
  };

  // 字段更新处理
  const handleFieldChange = (field: keyof UserProfile, value: number): void => {
    const currentProfile = userProfile;
    const updatedProfile = { ...currentProfile, [field]: value };

    plannerStore.updateUserProfile({ [field]: value });

    // 实时验证当前字段
    const error = validateProfileField(field, value, updatedProfile);

    setValidationErrors(prev => {
      const result: Record<string, string> = {};

      // 添加现有错误，除了当前字段
      Object.keys(prev).forEach(key => {
        if (key !== field) {
          result[key] = prev[key];
        }
      });

      // 添加当前字段的错误（如果有）
      if (error) {
        result[field] = error;
      }

      // 当更新某个字段时，重新验证相关字段
      if (field === 'birth_year') {
        // 重新验证FIRE年龄和预期寿命
        if (updatedProfile.expected_fire_age) {
          const fireError = validateProfileField(
            'expected_fire_age',
            updatedProfile.expected_fire_age,
            updatedProfile
          );
          if (fireError) {
            result.expected_fire_age = fireError;
          } else {
            delete result.expected_fire_age;
          }
        }
        if (updatedProfile.as_of_year) {
          const asOfError = validateProfileField(
            'as_of_year',
            updatedProfile.as_of_year,
            updatedProfile
          );
          if (asOfError) {
            result.as_of_year = asOfError;
          } else {
            delete result.as_of_year;
          }
        }
        if (updatedProfile.life_expectancy) {
          const lifeError = validateProfileField(
            'life_expectancy',
            updatedProfile.life_expectancy,
            updatedProfile
          );
          if (lifeError) {
            result.life_expectancy = lifeError;
          } else {
            delete result.life_expectancy;
          }
        }
      }

      if (field === 'expected_fire_age') {
        // 重新验证法定退休年龄
        if (updatedProfile.legal_retirement_age) {
          const retirementError = validateProfileField(
            'legal_retirement_age',
            updatedProfile.legal_retirement_age,
            updatedProfile
          );
          if (retirementError) {
            result.legal_retirement_age = retirementError;
          } else {
            delete result.legal_retirement_age;
          }
        }
      }

      if (field === 'legal_retirement_age') {
        // 重新验证FIRE年龄和预期寿命
        if (updatedProfile.expected_fire_age) {
          const fireError = validateProfileField(
            'expected_fire_age',
            updatedProfile.expected_fire_age,
            updatedProfile
          );
          if (fireError) {
            result.expected_fire_age = fireError;
          } else {
            delete result.expected_fire_age;
          }
        }
        if (updatedProfile.life_expectancy) {
          const lifeError = validateProfileField(
            'life_expectancy',
            updatedProfile.life_expectancy,
            updatedProfile
          );
          if (lifeError) {
            result.life_expectancy = lifeError;
          } else {
            delete result.life_expectancy;
          }
        }
      }

      if (field === 'life_expectancy') {
        // 重新验证法定退休年龄
        if (updatedProfile.legal_retirement_age) {
          const retirementError = validateProfileField(
            'legal_retirement_age',
            updatedProfile.legal_retirement_age,
            updatedProfile
          );
          if (retirementError) {
            result.legal_retirement_age = retirementError;
          } else {
            delete result.legal_retirement_age;
          }
        }
      }

      if (field === 'as_of_year') {
        // 重新验证birth_year与FIRE年龄等与当前年龄相关的字段
        if (updatedProfile.birth_year) {
          const birthError = validateProfileField(
            'birth_year',
            updatedProfile.birth_year,
            updatedProfile
          );
          if (birthError) {
            result.birth_year = birthError;
          } else {
            delete result.birth_year;
          }
        }
        if (updatedProfile.expected_fire_age) {
          const fireError = validateProfileField(
            'expected_fire_age',
            updatedProfile.expected_fire_age,
            updatedProfile
          );
          if (fireError) {
            result.expected_fire_age = fireError;
          } else {
            delete result.expected_fire_age;
          }
        }
        if (updatedProfile.life_expectancy) {
          const lifeError = validateProfileField(
            'life_expectancy',
            updatedProfile.life_expectancy,
            updatedProfile
          );
          if (lifeError) {
            result.life_expectancy = lifeError;
          } else {
            delete result.life_expectancy;
          }
        }
      }

      return result;
    });
  };

  // =============================================================================
  // 渲染组件
  // =============================================================================

  const renderUserProfile = (): JSX.Element => (
    <Card shadow='sm' padding='lg' radius='md'>
      <Group mb='md'>
        <IconUser size={24} color='var(--mantine-primary-color-6)' />
        <Title order={4}>{t('user_profile')}</Title>
      </Group>

      <Grid>
        {/*
          第一行：年龄相关的字段
          响应式布局：
          - 📱 移动端 (0-767px): span=6 (50%宽度，一行2个字段)
          - 💻 桌面端 (768px+): span=3/2 (一行5个字段)
        */}
        <Grid.Col span={{ base: 6, md: 3 }}>
          <FormField
            type='number'
            name='birth_year'
            label={t('birth_year')}
            value={userProfile.birth_year}
            placeholder='1990'
            min={1900}
            max={userProfile.as_of_year || new Date().getFullYear()}
            precision={0}
            error={validationErrors.birth_year}
            data-error={!!validationErrors.birth_year}
            onChange={value => handleFieldChange('birth_year', value)}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 6, md: 3 }}>
          <FormField
            type='number'
            name='as_of_year'
            label={t('as_of_year')}
            description={t('as_of_year_help')}
            value={userProfile.as_of_year || new Date().getFullYear()}
            placeholder={new Date().getFullYear().toString()}
            min={1950}
            max={new Date().getFullYear()}
            precision={0}
            error={validationErrors.as_of_year}
            data-error={!!validationErrors.as_of_year}
            onChange={value => handleFieldChange('as_of_year', value)}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 6, md: 2 }}>
          <FormField
            type='number'
            name='expected_fire_age'
            label={t('expected_fire_age')}
            value={userProfile.expected_fire_age}
            placeholder='50'
            min={20}
            max={100}
            precision={0}
            error={validationErrors.expected_fire_age}
            data-error={!!validationErrors.expected_fire_age}
            onChange={value => handleFieldChange('expected_fire_age', value)}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 6, md: 2 }}>
          <FormField
            type='number'
            name='legal_retirement_age'
            label={t('legal_retirement_age')}
            value={userProfile.legal_retirement_age}
            placeholder='65'
            min={50}
            max={80}
            precision={0}
            error={validationErrors.legal_retirement_age}
            data-error={!!validationErrors.legal_retirement_age}
            onChange={value => handleFieldChange('legal_retirement_age', value)}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 6, md: 2 }}>
          <FormField
            type='number'
            name='life_expectancy'
            label={t('life_expectancy')}
            value={userProfile.life_expectancy}
            placeholder='80'
            min={60}
            max={120}
            precision={0}
            error={validationErrors.life_expectancy}
            data-error={!!validationErrors.life_expectancy}
            onChange={value => handleFieldChange('life_expectancy', value)}
          />
        </Grid.Col>

        {/*
          第二行：其他三个字段
          响应式布局：
          - 📱 移动端 (0-767px): span=6 (50%宽度，一行2个字段)
          - 💻 桌面端 (768px+): span=3 (25%宽度，一行4个字段)
        */}
        <Grid.Col span={{ base: 6, md: 3 }}>
          <FormField
            type='currency'
            name='current_net_worth'
            label={t('current_net_worth')}
            value={userProfile.current_net_worth}
            placeholder='100000'
            min={0}
            onChange={value => handleFieldChange('current_net_worth', value)}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 6, md: 3 }}>
          <FormField
            type='percentage'
            name='inflation_rate'
            label={t('inflation_rate')}
            value={userProfile.inflation_rate}
            placeholder='0.0'
            min={0}
            max={20}
            precision={2}
            error={validationErrors.inflation_rate}
            data-error={!!validationErrors.inflation_rate}
            onChange={value => handleFieldChange('inflation_rate', value)}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 6, md: 3 }}>
          <FormField
            type='number'
            name='safety_buffer_months'
            label={t('safety_buffer_months')}
            description={t('safety_buffer_months_help')}
            value={userProfile.safety_buffer_months}
            placeholder='6'
            min={0}
            max={60}
            precision={0}
            error={validationErrors.safety_buffer_months}
            data-error={!!validationErrors.safety_buffer_months}
            onChange={value => handleFieldChange('safety_buffer_months', value)}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 6, md: 3 }}>
          <FormField
            type='percentage'
            name='bridge_discount_rate'
            label={t('bridge_discount_rate')}
            description={t('bridge_discount_rate_help')}
            value={userProfile.bridge_discount_rate}
            placeholder='1.0'
            min={0}
            max={20}
            precision={2}
            onChange={value => handleFieldChange('bridge_discount_rate', value)}
          />
        </Grid.Col>
      </Grid>
    </Card>
  );

  const renderPortfolioConfig = (): JSX.Element => {
    // 获取用户实际输入的portfolio，避免显示默认值
    const userPortfolio = plannerStore.data.user_profile?.portfolio;
    // 只在用户有实际输入时使用用户数据，否则使用空结构但保持DEFAULT_PORTFOLIO的结构用于渲染
    const portfolio = userPortfolio || {
      ...DEFAULT_PORTFOLIO,
      asset_classes: DEFAULT_PORTFOLIO.asset_classes.map(asset => ({
        ...asset,
        allocation_percentage: undefined as unknown as number, // 使用undefined让FormField显示placeholder
        expected_return: undefined as unknown as number, // 使用undefined让FormField显示placeholder
      })),
    };

    // 计算加权平均期望收益率
    const calculateWeightedReturn = (): number => {
      if (!portfolio.asset_classes.length) return 0;

      const totalAllocation = portfolio.asset_classes.reduce(
        (sum, asset) => sum + (asset.allocation_percentage || 0),
        0
      );

      if (totalAllocation === 0) return 0;

      const weightedSum = portfolio.asset_classes.reduce(
        (sum, asset) =>
          sum +
          (asset.allocation_percentage || 0) * (asset.expected_return || 0),
        0
      );

      return weightedSum / totalAllocation;
    };

    // 更新资产配置
    const updateAssetClass = (
      index: number,
      field: keyof (typeof portfolio.asset_classes)[0],
      value: number
    ): void => {
      const updatedAssets = [...portfolio.asset_classes];
      updatedAssets[index] = { ...updatedAssets[index], [field]: value };

      plannerStore.updateUserProfile({
        portfolio: {
          ...portfolio,
          asset_classes: updatedAssets,
          enable_rebalancing: portfolio.enable_rebalancing || false,
        },
      });
    };

    // 计算总配置百分比
    const totalAllocation = portfolio.asset_classes.reduce(
      (sum, asset) => sum + (asset.allocation_percentage || 0),
      0
    );

    const isValidTotal = Math.abs(totalAllocation - 100) < 0.01;
    const weightedReturn = calculateWeightedReturn();
    const inflationRate =
      userProfile.inflation_rate ?? DEFAULT_USER_PROFILE.inflation_rate;
    const hasAnyReturnValue = portfolio.asset_classes.some(
      asset =>
        asset.expected_return !== undefined && asset.expected_return !== null
    );
    const shouldWarnBelowInflation =
      totalAllocation > 0 &&
      hasAnyReturnValue &&
      Number.isFinite(inflationRate) &&
      weightedReturn + 1e-9 < inflationRate;

    return (
      <Card shadow='sm' padding='lg' radius='md'>
        <Group mb='md'>
          <IconChartPie size={24} color='var(--mantine-primary-color-6)' />
          <Title order={4}>{t('investment_portfolio_settings')}</Title>
        </Group>

        <Text size='sm' c='dimmed' mb='md'>
          {t('portfolio_configure_description')}
        </Text>

        <Alert icon={<IconInfoCircle size={16} />} color='blue' mb='md'>
          <Text size='xs'>{t('portfolio_allocation_notice')}</Text>
        </Alert>

        {/* 简单的表格布局 - 桌面端一行两个，移动端保持三列 */}
        <Grid>
          {/* 表头 */}
          <Grid.Col span={12}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr 1fr',
                gap: '16px',
                marginBottom: '8px',
                fontWeight: 600,
                fontSize: '14px',
                color: 'var(--mantine-color-dimmed)',
                paddingLeft: '12px',
              }}
            >
              <div
                style={{
                  textAlign: 'right',
                  paddingRight: '8px',
                  minWidth: '80px',
                }}
              >
                {t('asset_class')}
              </div>
              <div style={{ textAlign: 'center' }}>
                {t('allocation_percentage')}
              </div>
              <div style={{ textAlign: 'center' }}>{t('expected_return')}</div>
            </div>
          </Grid.Col>

          {/* 资产配置行 */}
          {portfolio.asset_classes.map((asset, index) => (
            <Grid.Col key={asset.name} span={12}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr 1fr',
                  gap: '16px',
                  alignItems: 'center',
                  padding: '12px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '6px',
                }}
              >
                <Text
                  size='sm'
                  fw={500}
                  c='dimmed'
                  style={{
                    minWidth: '80px',
                    textAlign: 'right',
                    paddingRight: '8px',
                  }}
                >
                  {t(asset.name.toLowerCase())}
                </Text>

                <FormField
                  type='percentage'
                  name={`allocation_${index}`}
                  value={asset.allocation_percentage}
                  placeholder={
                    DEFAULT_PORTFOLIO.asset_classes
                      .find(defaultAsset => defaultAsset.name === asset.name)
                      ?.allocation_percentage?.toString() || '0.00'
                  }
                  onChange={value =>
                    updateAssetClass(index, 'allocation_percentage', value)
                  }
                  label=''
                />

                <FormField
                  type='percentage'
                  name={`return_${index}`}
                  value={asset.expected_return}
                  placeholder={
                    DEFAULT_PORTFOLIO.asset_classes
                      .find(defaultAsset => defaultAsset.name === asset.name)
                      ?.expected_return?.toString() || '0.00'
                  }
                  onChange={value =>
                    updateAssetClass(index, 'expected_return', value)
                  }
                  label=''
                />
              </div>
            </Grid.Col>
          ))}
        </Grid>

        <Alert
          icon={
            isValidTotal ? (
              <IconCircleCheck size={20} />
            ) : (
              <IconCircleX size={20} />
            )
          }
          color={isValidTotal ? 'green' : 'red'}
          variant='light'
          mt='md'
        >
          <Group justify='space-between' align='center' gap='sm' wrap='wrap'>
            <Text size='sm' fw={600}>
              {t('allocation_total', { total: totalAllocation.toFixed(1) })}
            </Text>

            <Group gap='sm'>
              <Text size='sm' c='dimmed'>
                {t('portfolio_expected_return')}:
              </Text>
              <Text size='lg' fw={700}>
                {weightedReturn.toFixed(2)}%
              </Text>
            </Group>
          </Group>
        </Alert>

        {shouldWarnBelowInflation && (
          <Alert
            icon={<IconAlertTriangle size={20} />}
            color='yellow'
            variant='light'
            mt='sm'
          >
            <Text size='sm'>
              {t('portfolio_return_below_inflation_warning', {
                portfolioReturn: weightedReturn.toFixed(2),
                inflationRate: inflationRate.toFixed(2),
              })}
            </Text>
          </Alert>
        )}
      </Card>
    );
  };

  const renderIncomeExpense = (): JSX.Element => (
    <Card shadow='sm' padding='lg' radius='md'>
      <Group mb='md'>
        <IconWallet size={24} color='var(--mantine-primary-color-6)' />
        <Title order={4}>{t('income_expense_items')}</Title>
      </Group>

      <Stack gap='lg'>
        {/* 收入项目 */}
        <div>
          <IncomeExpenseForm
            type='income'
            title={t('income_items_header')}
            showTemplates
          />
          {validationErrors.income_items && (
            <Text c='red' size='sm' mt='xs'>
              {validationErrors.income_items}
            </Text>
          )}
        </div>

        {/* 分割线 */}
        <div
          style={{
            height: '1px',
            backgroundColor: 'var(--mantine-color-gray-3)',
            margin: '16px 0',
          }}
        />

        {/* 支出项目 */}
        <div>
          <IncomeExpenseForm
            type='expense'
            title={t('expense_items_header')}
            showTemplates
          />
          {validationErrors.expense_items && (
            <Text c='red' size='sm' mt='xs'>
              {validationErrors.expense_items}
            </Text>
          )}
        </div>
      </Stack>
    </Card>
  );

  // =============================================================================
  // 主渲染
  // =============================================================================

  return (
    <Container size='xl' py='md'>
      <Stack gap='xl'>
        {/* 用户档案卡片 */}
        {renderUserProfile()}

        {/* 投资组合配置卡片 */}
        {renderPortfolioConfig()}

        {/* 收支项目卡片 */}
        {renderIncomeExpense()}
      </Stack>
    </Container>
  );
}

export default Stage1Content;
