/**
 * Main App component for FIRE Balance Calculator
 *
 * This is the root component that orchestrates the three-stage FIRE planning system:
 * - Stage 1: User profile and income/expense data collection
 * - Stage 2: Interactive financial projection with adjustments
 * - Stage 3: Monte Carlo analysis and advisor recommendations
 *
 * The app manages the planner state and navigation between stages while providing
 * a comprehensive FIRE planning experience.
 */

import React, { useState, useEffect } from 'react';
import {
  AppShell,
  Container,
  Title,
  Text,
  Group,
  Stack,
  Select,
  Badge,
  Stepper,
  Progress,
  Card,
} from '@mantine/core';
import { IconFlame, IconLanguage, IconUser, IconTable, IconReportAnalytics } from '@tabler/icons-react';
import { useI18n } from './utils/i18n';
import { FIREPlanner } from './core/planner';
import { PlannerStage, type LanguageCode } from './types';

// Stage Components
import { Stage1Input } from './components/stages/Stage1Input';
import { Stage2Results } from './components/stages/Stage2Results';
import { Stage3Analysis } from './components/stages/Stage3Analysis';

/**
 * Main Application Component
 * Manages the three-stage FIRE planning workflow
 */
const App: React.FC = () => {
  // i18n hooks for translation and language switching
  const { currentLanguage, changeLanguage, t, isLoaded } = useI18n();

  // Core application state
  const [planner] = useState(() => new FIREPlanner(currentLanguage));
  const [currentStage, setCurrentStage] = useState<PlannerStage>(planner.getCurrentStage());
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Update planner when language changes
  useEffect(() => {
    const plannerData = planner.getData();
    plannerData.language = currentLanguage;
    planner.loadData(plannerData);
  }, [currentLanguage, planner]);

  /**
   * Handle language change
   */
  const handleLanguageChange = async (lang: string | null): Promise<void> => {
    if (lang && ['en', 'zh-CN', 'ja'].includes(lang)) {
      await changeLanguage(lang as LanguageCode);
    }
  };

  /**
   * Handle stage completion and progression
   */
  const handleStageComplete = async (stage: PlannerStage): Promise<void> => {
    setIsTransitioning(true);

    try {
      const success = planner.advanceStage();
      if (success) {
        setCurrentStage(planner.getCurrentStage());
      }
    } finally {
      setIsTransitioning(false);
    }
  };

  /**
   * Handle going back to previous stage
   */
  const handleGoBack = (): void => {
    const success = planner.goToPreviousStage();
    if (success) {
      setCurrentStage(planner.getCurrentStage());
    }
  };

  /**
   * Get active step number for stepper
   */
  const getActiveStep = (): number => {
    switch (currentStage) {
      case 'stage1_input':
        return 0;
      case 'stage2_adjustment':
        return 1;
      case 'stage3_analysis':
        return 2;
      default:
        return 0;
    }
  };

  /**
   * Render the current stage component
   */
  const renderCurrentStage = (): React.ReactNode => {
    if (isTransitioning) {
      return (
        <Stack align="center" py="xl">
          <Progress value={undefined} />
          <Text>Transitioning between stages...</Text>
        </Stack>
      );
    }

    switch (currentStage) {
      case 'stage1_input':
        return (
          <Stage1Input
            planner={planner}
            onStageComplete={() => handleStageComplete(currentStage)}
          />
        );

      case 'stage2_adjustment':
        return (
          <Stage2Results
            planner={planner}
            onStageComplete={() => handleStageComplete(currentStage)}
            onGoBack={handleGoBack}
          />
        );

      case 'stage3_analysis':
        return (
          <Stage3Analysis
            planner={planner}
            onGoBack={handleGoBack}
            onComplete={() => {
              // Analysis complete - could trigger export or reset
              console.log('FIRE analysis complete!');
            }}
          />
        );

      default:
        return <Text>Unknown stage</Text>;
    }
  };

  // Show loading state while i18n loads
  if (!isLoaded) {
    return (
      <Container size="sm" className="py-8">
        <Stack align="center">
          <div className="spinner" />
          <Text>Loading translations...</Text>
        </Stack>
      </Container>
    );
  }

  return (
    <AppShell
      header={{ height: 70 }}
      navbar={{ width: 0, breakpoint: 'sm' }}
      padding="md"
    >
      <AppShell.Header>
        <Container fluid className="h-full">
          <div className="flex items-center justify-between h-full px-4">
            <Group>
              <IconFlame size={32} color="var(--color-fire-orange)" />
              <Title order={3}>FIRE Balance Calculator</Title>
            </Group>

            <Group>
              <Select
                data={[
                  { value: 'en', label: 'English' },
                  { value: 'zh-CN', label: '中文' },
                  { value: 'ja', label: '日本語' },
                ]}
                value={currentLanguage}
                onChange={handleLanguageChange}
                leftSection={<IconLanguage size={16} />}
                size="sm"
                w={120}
              />
              <Badge color="orange" variant="light">
                v0.2.0-dev
              </Badge>
            </Group>
          </div>
        </Container>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="xl" className="py-6">
          <Stack gap="xl">
            {/* Header */}
            <div className="text-center">
              <Title order={1} className="mb-4">
                🔥 Three-Stage FIRE Planning System
              </Title>
              <Text size="lg" c="dimmed" className="mb-6">
                Complete Financial Independence Planning Workflow
              </Text>
            </div>

            {/* Progress Stepper */}
            <Card shadow="sm" padding="lg" radius="md">
              <Stepper
                active={getActiveStep()}
                breakpoint="sm"
                size="sm"
              >
                <Stepper.Step
                  label="Data Input"
                  description="Profile & Income/Expenses"
                  icon={<IconUser size={18} />}
                />
                <Stepper.Step
                  label="Projection Review"
                  description="Annual Financial Projection"
                  icon={<IconTable size={18} />}
                />
                <Stepper.Step
                  label="Analysis & Results"
                  description="FIRE Analysis & Recommendations"
                  icon={<IconReportAnalytics size={18} />}
                />
              </Stepper>
            </Card>

            {/* Current Stage Content */}
            <div>
              {renderCurrentStage()}
            </div>

            {/* Footer Info */}
            <Card shadow="xs" padding="md" radius="md" style={{ backgroundColor: '#f8f9fa' }}>
              <Text size="sm" c="dimmed" ta="center">
                💡 This TypeScript implementation mirrors the Python version's three-stage workflow.
                All calculations use identical algorithms to ensure consistent results across platforms.
              </Text>
            </Card>
          </Stack>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
};

export default App;
