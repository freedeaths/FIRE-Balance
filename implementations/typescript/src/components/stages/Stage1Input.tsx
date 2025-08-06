/**
 * Stage 1: Basic Data Input
 *
 * This component handles user profile collection and income/expense item management.
 * It provides forms for entering personal financial information and building the
 * foundation for FIRE analysis.
 */

import React, { useState } from 'react';
import {
  Card,
  Stack,
  Title,
  Text,
  NumberInput,
  Select,
  Grid,
  Button,
  Group,
  Alert,
  ActionIcon,
  Table,
  Modal,
  TextInput,
  Divider,
  Badge,
} from '@mantine/core';
import {
  IconPlus,
  IconTrash,
  IconEdit,
  IconAlertCircle,
  IconUser,
  IconCoin,
  IconReceipt,
  IconChartLine,
} from '@tabler/icons-react';
import { useI18n } from '../../utils/i18n';
import type {
  UserProfile,
  IncomeExpenseItem,
  ItemFrequency,
  TimeUnit,
} from '../../types';
import { FIREPlanner } from '../../core/planner';
import { formatCurrency, calculateAge, generateUUID } from '../../utils/helpers';

interface Stage1InputProps {
  /** FIRE planner instance */
  planner: FIREPlanner;
  /** Callback when stage is completed */
  onStageComplete: () => void;
}

/**
 * Default user profile values matching Python version
 */
const DEFAULT_USER_PROFILE: UserProfile = {
  birth_year: new Date().getFullYear() - 35,
  expected_fire_age: 55,
  legal_retirement_age: 65,
  life_expectancy: 85,
  current_net_worth: 100000,
  inflation_rate: 3.0,
  safety_buffer_months: 6.0,
  portfolio: {
    asset_classes: [
      {
        name: 'stocks',
        display_name: 'Stocks',
        allocation_percentage: 20,
        expected_return: 5.0,
        volatility: 15.0,
        liquidity_level: 'high',
      },
      {
        name: 'bonds',
        display_name: 'Bonds',
        allocation_percentage: 0,
        expected_return: 3.0,
        volatility: 5.0,
        liquidity_level: 'medium',
      },
      {
        name: 'savings',
        display_name: 'Savings',
        allocation_percentage: 60,
        expected_return: 1.0,
        volatility: 5.0,
        liquidity_level: 'high',
      },
      {
        name: 'cash',
        display_name: 'Cash',
        allocation_percentage: 20,
        expected_return: 0.0,
        volatility: 1.0,
        liquidity_level: 'high',
      },
    ],
    enable_rebalancing: true,
    rebalancing_threshold: 5.0,
    rebalancing_frequency: 'annual',
    cash_flow_strategy: 'liquidity_aware',
  },
};

/**
 * Default income items matching Python version
 */
const DEFAULT_INCOME_ITEMS: IncomeExpenseItem[] = [
  {
    item_id: generateUUID(),
    name: 'Salary',
    description: 'Primary employment income',
    after_tax_amount_per_period: 120000,
    time_unit: 'year',
    frequency: 'annual',
    interval_in_time_unit: 1,
    start_age: 35,
    end_age: 55,
    growth_rate: 0.0,
  },
  {
    item_id: generateUUID(),
    name: 'Social Security Pension',
    description: 'Government retirement pension',
    after_tax_amount_per_period: 120000,
    time_unit: 'year',
    frequency: 'annual',
    interval_in_time_unit: 1,
    start_age: 65,
    end_age: 85,
    growth_rate: 2.0,
  },
];

/**
 * Default expense items matching Python version
 */
const DEFAULT_EXPENSE_ITEMS: IncomeExpenseItem[] = [
  {
    item_id: generateUUID(),
    name: 'Daily Expenses',
    description: 'Regular living expenses',
    after_tax_amount_per_period: 120000,
    time_unit: 'year',
    frequency: 'annual',
    interval_in_time_unit: 1,
    start_age: 35,
    end_age: 85,
    growth_rate: 1.0,
  },
];

/**
 * Default income/expense item
 */
const createDefaultItem = (isIncome: boolean): IncomeExpenseItem => ({
  item_id: generateUUID(),
  name: '',
  description: '',
  after_tax_amount_per_period: 0,
  time_unit: 'year',
  frequency: 'monthly',
  interval_in_time_unit: 1,
  start_age: calculateAge(DEFAULT_USER_PROFILE.birth_year),
  end_age: undefined,
  growth_rate: isIncome ? 3.0 : 0.0,
});

export const Stage1Input: React.FC<Stage1InputProps> = ({ planner, onStageComplete }) => {
  const { t } = useI18n();

  // Initialize with default data if planner is empty
  const initializeDefaultData = () => {
    const currentProfile = planner.getUserProfile();
    const currentIncome = planner.getIncomeItems();
    const currentExpenses = planner.getExpenseItems();

    if (!currentProfile) {
      planner.setUserProfile(DEFAULT_USER_PROFILE);
    }

    if (currentIncome.length === 0) {
      DEFAULT_INCOME_ITEMS.forEach(item => planner.addIncomeItem(item));
    }

    if (currentExpenses.length === 0) {
      DEFAULT_EXPENSE_ITEMS.forEach(item => planner.addExpenseItem(item));
    }
  };

  // Initialize default data on first render
  React.useEffect(() => {
    initializeDefaultData();
  }, []);

  // Get current data from planner
  const [userProfile, setUserProfile] = useState<UserProfile>(
    planner.getUserProfile() || DEFAULT_USER_PROFILE
  );
  const [incomeItems, setIncomeItems] = useState<IncomeExpenseItem[]>(
    planner.getIncomeItems()
  );
  const [expenseItems, setExpenseItems] = useState<IncomeExpenseItem[]>(
    planner.getExpenseItems()
  );

  // Update local state when planner data changes
  React.useEffect(() => {
    setUserProfile(planner.getUserProfile() || DEFAULT_USER_PROFILE);
    setIncomeItems(planner.getIncomeItems());
    setExpenseItems(planner.getExpenseItems());
  }, [planner]);

  // Modal state
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IncomeExpenseItem | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Form state
  const [currentItem, setCurrentItem] = useState<IncomeExpenseItem>(createDefaultItem(true));

  /**
   * Update user profile
   */
  const updateProfile = (field: keyof UserProfile, value: any) => {
    const updated = { ...userProfile, [field]: value };
    setUserProfile(updated);
    planner.setUserProfile(updated);
  };

  /**
   * Open income item modal
   */
  const openIncomeModal = (item?: IncomeExpenseItem) => {
    if (item) {
      setCurrentItem({ ...item });
      setEditingItem(item);
      setIsEditMode(true);
    } else {
      setCurrentItem(createDefaultItem(true));
      setEditingItem(null);
      setIsEditMode(false);
    }
    setIsIncomeModalOpen(true);
  };

  /**
   * Open expense item modal
   */
  const openExpenseModal = (item?: IncomeExpenseItem) => {
    if (item) {
      setCurrentItem({ ...item });
      setEditingItem(item);
      setIsEditMode(true);
    } else {
      setCurrentItem(createDefaultItem(false));
      setEditingItem(null);
      setIsEditMode(false);
    }
    setIsExpenseModalOpen(true);
  };

  /**
   * Save income item
   */
  const saveIncomeItem = () => {
    if (isEditMode && editingItem) {
      planner.updateIncomeItem(editingItem.item_id, currentItem);
      setIncomeItems(planner.getIncomeItems());
    } else {
      planner.addIncomeItem(currentItem);
      setIncomeItems(planner.getIncomeItems());
    }
    setIsIncomeModalOpen(false);
  };

  /**
   * Save expense item
   */
  const saveExpenseItem = () => {
    if (isEditMode && editingItem) {
      planner.updateExpenseItem(editingItem.item_id, currentItem);
      setExpenseItems(planner.getExpenseItems());
    } else {
      planner.addExpenseItem(currentItem);
      setExpenseItems(planner.getExpenseItems());
    }
    setIsExpenseModalOpen(false);
  };

  /**
   * Delete income item
   */
  const deleteIncomeItem = (itemId: string) => {
    planner.removeIncomeItem(itemId);
    setIncomeItems(planner.getIncomeItems());
  };

  /**
   * Delete expense item
   */
  const deleteExpenseItem = (itemId: string) => {
    planner.removeExpenseItem(itemId);
    setExpenseItems(planner.getExpenseItems());
  };

  /**
   * Check if stage is complete
   */
  const isStageComplete = () => {
    return incomeItems.length > 0 && expenseItems.length > 0;
  };

  /**
   * Handle stage completion
   */
  const handleStageComplete = () => {
    if (isStageComplete()) {
      onStageComplete();
    }
  };

  const currentAge = calculateAge(userProfile.birth_year);
  const yearsToFIRE = Math.max(0, userProfile.expected_fire_age - currentAge);

  return (
    <Stack gap="xl">
      {/* Header */}
      <div>
        <Title order={2}>Stage 1: {t('stage1_title')}</Title>
        <Text c="dimmed">{t('stage1_description')}</Text>
      </div>

      {/* User Profile Section */}
      <Card shadow="sm" padding="lg" radius="md">
        <Group mb="md">
          <IconUser size={24} />
          <Title order={3}>User Information</Title>
        </Group>

        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <NumberInput
              label="Birth Year"
              value={userProfile.birth_year}
              onChange={(value) => updateProfile('birth_year', Number(value) || 1990)}
              min={1950}
              max={new Date().getFullYear()}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <NumberInput
              label="Target FIRE Age"
              value={userProfile.expected_fire_age}
              onChange={(value) => updateProfile('expected_fire_age', Number(value) || 55)}
              min={18}
              max={100}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <NumberInput
              label="Legal Retirement Age"
              value={userProfile.legal_retirement_age}
              onChange={(value) => updateProfile('legal_retirement_age', Number(value) || 65)}
              min={50}
              max={100}
              description="Official retirement age for pension benefits"
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <NumberInput
              label="Life Expectancy"
              value={userProfile.life_expectancy}
              onChange={(value) => updateProfile('life_expectancy', Number(value) || 85)}
              min={60}
              max={120}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
            <NumberInput
              label="Current Net Worth"
              value={userProfile.current_net_worth}
              onChange={(value) => updateProfile('current_net_worth', Number(value) || 0)}
              min={0}
              thousandSeparator=","
              leftSection="$"
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
            <NumberInput
              label="Inflation Rate"
              value={userProfile.inflation_rate}
              onChange={(value) => updateProfile('inflation_rate', Number(value) || 3)}
              min={0}
              max={20}
              step={0.1}
              decimalScale={1}
              rightSection="%"
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
            <NumberInput
              label="Safety Buffer (months)"
              value={userProfile.safety_buffer_months}
              onChange={(value) => updateProfile('safety_buffer_months', Number(value) || 6)}
              min={0}
              max={60}
              step={0.5}
              decimalScale={1}
              description="Emergency fund duration"
            />
          </Grid.Col>
        </Grid>

        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <Text size="sm" c="dimmed">
            Current Age: <strong>{currentAge}</strong> |
            Years to FIRE: <strong>{yearsToFIRE}</strong>
          </Text>
        </div>
      </Card>

      {/* Income Items Section */}
      <Card shadow="sm" padding="lg" radius="md">
        <Group justify="space-between" mb="md">
          <Group>
            <IconCoin size={24} />
            <Title order={3}>Income Items</Title>
          </Group>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => openIncomeModal()}
          >
            Add Income
          </Button>
        </Group>

        {incomeItems.length === 0 ? (
          <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
            No income items added. Please add at least one income source.
          </Alert>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Amount</Table.Th>
                <Table.Th>Frequency</Table.Th>
                <Table.Th>Age Range</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {incomeItems.map((item) => (
                <Table.Tr key={item.item_id}>
                  <Table.Td>{item.name}</Table.Td>
                  <Table.Td>{formatCurrency(item.after_tax_amount_per_period, '$')}</Table.Td>
                  <Table.Td>{item.frequency}</Table.Td>
                  <Table.Td>{item.start_age} - {item.end_age || '∞'}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="subtle"
                        onClick={() => openIncomeModal(item)}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => deleteIncomeItem(item.item_id)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Expense Items Section */}
      <Card shadow="sm" padding="lg" radius="md">
        <Group justify="space-between" mb="md">
          <Group>
            <IconReceipt size={24} />
            <Title order={3}>Expense Items</Title>
          </Group>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => openExpenseModal()}
          >
            Add Expense
          </Button>
        </Group>

        {expenseItems.length === 0 ? (
          <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
            No expense items added. Please add at least one expense category.
          </Alert>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Amount</Table.Th>
                <Table.Th>Frequency</Table.Th>
                <Table.Th>Age Range</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {expenseItems.map((item) => (
                <Table.Tr key={item.item_id}>
                  <Table.Td>{item.name}</Table.Td>
                  <Table.Td>{formatCurrency(item.after_tax_amount_per_period, '$')}</Table.Td>
                  <Table.Td>{item.frequency}</Table.Td>
                  <Table.Td>{item.start_age} - {item.end_age || '∞'}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="subtle"
                        onClick={() => openExpenseModal(item)}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => deleteExpenseItem(item.item_id)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Investment Portfolio Section */}
      <Card shadow="sm" padding="lg" radius="md">
        <Group mb="md">
          <IconChartLine size={24} />
          <Title order={3}>Investment Portfolio Settings</Title>
        </Group>

        <Text size="sm" c="dimmed" mb="md">
          Configure your investment allocation and risk preferences:
        </Text>

        {/* Portfolio Validation Alert */}
        {Math.abs(userProfile.portfolio.asset_classes.reduce((sum, asset) => sum + asset.allocation_percentage, 0) - 100) > 0.01 && (
          <Alert color="yellow" icon={<IconAlertCircle size={16} />} mb="md">
            Portfolio allocation must total 100%. Current total: {userProfile.portfolio.asset_classes.reduce((sum, asset) => sum + asset.allocation_percentage, 0).toFixed(1)}%
          </Alert>
        )}

        <div className="space-y-4">
          {userProfile.portfolio.asset_classes.map((asset, index) => (
            <div key={asset.name} className="p-4 border border-gray-200 rounded-lg">
              <Grid align="end">
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Text fw={500} mb="xs">{asset.display_name}</Text>
                </Grid.Col>

                <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
                  <NumberInput
                    label="Allocation (%)"
                    value={asset.allocation_percentage}
                    onChange={(value) => {
                      const newProfile = { ...userProfile };
                      newProfile.portfolio.asset_classes[index].allocation_percentage = Number(value) || 0;
                      updateProfile('portfolio', newProfile.portfolio);
                    }}
                    min={0}
                    max={100}
                    step={0.1}
                    decimalScale={1}
                    size="sm"
                  />
                </Grid.Col>

                <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
                  <NumberInput
                    label="Expected Return (%)"
                    value={asset.expected_return}
                    onChange={(value) => {
                      const newProfile = { ...userProfile };
                      newProfile.portfolio.asset_classes[index].expected_return = Number(value) || 0;
                      updateProfile('portfolio', newProfile.portfolio);
                    }}
                    min={-10}
                    max={30}
                    step={0.1}
                    decimalScale={1}
                    size="sm"
                  />
                </Grid.Col>

                <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
                  <NumberInput
                    label="Volatility (%)"
                    value={asset.volatility}
                    onChange={(value) => {
                      const newProfile = { ...userProfile };
                      newProfile.portfolio.asset_classes[index].volatility = Number(value) || 0;
                      updateProfile('portfolio', newProfile.portfolio);
                    }}
                    min={0}
                    max={100}
                    step={0.1}
                    decimalScale={1}
                    size="sm"
                  />
                </Grid.Col>

                <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
                  <Select
                    label="Liquidity"
                    value={asset.liquidity_level}
                    onChange={(value) => {
                      const newProfile = { ...userProfile };
                      newProfile.portfolio.asset_classes[index].liquidity_level = value as 'high' | 'medium' | 'low';
                      updateProfile('portfolio', newProfile.portfolio);
                    }}
                    data={[
                      { value: 'high', label: 'High' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'low', label: 'Low' },
                    ]}
                    size="sm"
                  />
                </Grid.Col>
              </Grid>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-green-50 rounded-lg">
          <Group justify="space-between">
            <div>
              <Text fw={500} c="green">
                ✓ Allocation Total: {userProfile.portfolio.asset_classes.reduce((sum, asset) => sum + asset.allocation_percentage, 0).toFixed(1)}%
              </Text>
              <Text size="sm" c="dimmed">
                Weighted Average Expected Return: {(userProfile.portfolio.asset_classes.reduce((sum, asset) => sum + (asset.allocation_percentage * asset.expected_return), 0) / 100).toFixed(2)}%
              </Text>
            </div>
            <Badge
              color={userProfile.portfolio.enable_rebalancing ? 'green' : 'gray'}
              variant="light"
            >
              Rebalancing: {userProfile.portfolio.enable_rebalancing ? 'Enabled' : 'Disabled'}
            </Badge>
          </Group>
        </div>
      </Card>

      {/* Continue Button */}
      <div className="text-center">
        <Button
          size="lg"
          onClick={handleStageComplete}
          disabled={!isStageComplete()}
        >
          Continue to Stage 2
        </Button>
        {!isStageComplete() && (
          <Text size="sm" c="dimmed" mt="xs">
            Please add at least one income and one expense item to continue.
          </Text>
        )}
      </div>

      {/* Income Item Modal */}
      <Modal
        opened={isIncomeModalOpen}
        onClose={() => setIsIncomeModalOpen(false)}
        title={isEditMode ? "Edit Income Item" : "Add Income Item"}
        size="lg"
      >
        <Stack>
          <TextInput
            label="Name"
            value={currentItem.name}
            onChange={(e) => setCurrentItem({ ...currentItem, name: e.target.value })}
            placeholder="e.g., Salary, Bonus, Freelancing"
          />

          <TextInput
            label="Description"
            value={currentItem.description}
            onChange={(e) => setCurrentItem({ ...currentItem, description: e.target.value })}
            placeholder="Optional description"
          />

          <NumberInput
            label="Amount ($)"
            value={currentItem.after_tax_amount_per_period}
            onChange={(value) => setCurrentItem({
              ...currentItem,
              after_tax_amount_per_period: Number(value) || 0
            })}
            min={0}
            thousandSeparator=","
          />

          <Select
            label="Frequency"
            value={currentItem.frequency}
            onChange={(value) => setCurrentItem({
              ...currentItem,
              frequency: value as ItemFrequency
            })}
            data={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'quarterly', label: 'Quarterly' },
              { value: 'semi_annual', label: 'Semi-Annual' },
              { value: 'annual', label: 'Annual' },
              { value: 'one_time', label: 'One-Time' },
            ]}
          />

          <Grid>
            <Grid.Col span={6}>
              <NumberInput
                label="Start Age"
                value={currentItem.start_age}
                onChange={(value) => setCurrentItem({
                  ...currentItem,
                  start_age: Number(value) || 18
                })}
                min={0}
                max={100}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <NumberInput
                label="End Age (Optional)"
                value={currentItem.end_age || ''}
                onChange={(value) => setCurrentItem({
                  ...currentItem,
                  end_age: value ? Number(value) : undefined
                })}
                min={0}
                max={120}
                placeholder="Leave empty for lifetime"
              />
            </Grid.Col>
          </Grid>

          <NumberInput
            label="Annual Growth Rate (%)"
            value={currentItem.growth_rate}
            onChange={(value) => setCurrentItem({
              ...currentItem,
              growth_rate: Number(value) || 0
            })}
            min={-10}
            max={20}
            step={0.1}
            decimalScale={1}
          />

          <Group justify="flex-end" mt="md">
            <Button
              variant="outline"
              onClick={() => setIsIncomeModalOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={saveIncomeItem}>
              {isEditMode ? 'Update' : 'Add'} Income
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Expense Item Modal */}
      <Modal
        opened={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        title={isEditMode ? "Edit Expense Item" : "Add Expense Item"}
        size="lg"
      >
        <Stack>
          <TextInput
            label="Name"
            value={currentItem.name}
            onChange={(e) => setCurrentItem({ ...currentItem, name: e.target.value })}
            placeholder="e.g., Housing, Food, Transportation"
          />

          <TextInput
            label="Description"
            value={currentItem.description}
            onChange={(e) => setCurrentItem({ ...currentItem, description: e.target.value })}
            placeholder="Optional description"
          />

          <NumberInput
            label="Amount ($)"
            value={currentItem.after_tax_amount_per_period}
            onChange={(value) => setCurrentItem({
              ...currentItem,
              after_tax_amount_per_period: Number(value) || 0
            })}
            min={0}
            thousandSeparator=","
          />

          <Select
            label="Frequency"
            value={currentItem.frequency}
            onChange={(value) => setCurrentItem({
              ...currentItem,
              frequency: value as ItemFrequency
            })}
            data={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'quarterly', label: 'Quarterly' },
              { value: 'semi_annual', label: 'Semi-Annual' },
              { value: 'annual', label: 'Annual' },
              { value: 'one_time', label: 'One-Time' },
            ]}
          />

          <Grid>
            <Grid.Col span={6}>
              <NumberInput
                label="Start Age"
                value={currentItem.start_age}
                onChange={(value) => setCurrentItem({
                  ...currentItem,
                  start_age: Number(value) || 18
                })}
                min={0}
                max={100}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <NumberInput
                label="End Age (Optional)"
                value={currentItem.end_age || ''}
                onChange={(value) => setCurrentItem({
                  ...currentItem,
                  end_age: value ? Number(value) : undefined
                })}
                min={0}
                max={120}
                placeholder="Leave empty for lifetime"
              />
            </Grid.Col>
          </Grid>

          <NumberInput
            label="Annual Growth Rate (%)"
            value={currentItem.growth_rate}
            onChange={(value) => setCurrentItem({
              ...currentItem,
              growth_rate: Number(value) || 0
            })}
            min={-10}
            max={20}
            step={0.1}
            decimalScale={1}
          />

          <Group justify="flex-end" mt="md">
            <Button
              variant="outline"
              onClick={() => setIsExpenseModalOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={saveExpenseItem}>
              {isEditMode ? 'Update' : 'Add'} Expense
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};
