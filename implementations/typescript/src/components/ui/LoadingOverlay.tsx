/**
 * LoadingOverlay - Full-screen loading overlay
 *
 * Used to display progress during Monte Carlo calculations
 * Overlays on top of main content, centered on screen
 */

import React from 'react';
import {
  Overlay,
  Center,
  Card,
  Stack,
  Title,
  Text,
  Progress,
  Modal,
} from '@mantine/core';
import { IconLoader } from '@tabler/icons-react';
import { getI18n } from '../../core/i18n';

interface LoadingOverlayProps {
  /** Whether to show the overlay */
  visible: boolean;
  /** Loading progress (0-100) */
  progress: number;
  /** Title text */
  title?: string;
  /** Description text */
  description?: string;
}

export function LoadingOverlay({
  visible,
  progress,
  title,
  description,
}: LoadingOverlayProps): React.JSX.Element {
  const i18n = getI18n();
  const t = (key: string, variables?: Record<string, unknown>): string =>
    i18n.t(key, variables);

  const getProgressText = (progress: number): string => {
    if (progress < 30) return `🔄 ${t('calculating_fire_feasibility')}`;
    if (progress < 70) return `📊 ${t('run_monte_carlo_simulation')}`;
    if (progress < 100) return `🎯 ${t('stage3.recommendations.title')}`;
    return `✅ ${t('stage3.completion.title')}`;
  };

  const getProgressColor = (progress: number): string => {
    if (progress < 30) return 'blue';
    if (progress < 70) return 'orange';
    return 'green';
  };

  return (
    <Modal
      opened={visible}
      onClose={() => {}} // Cannot be closed, must wait for calculation to complete
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      centered
      size='md'
      padding='xl'
      overlayProps={{
        backgroundOpacity: 0.7,
        blur: 3,
      }}
    >
      <Stack gap='lg' align='center'>
        {/* Spinning icon */}
        <div className='loading-spinner'>
          <IconLoader size={64} color='var(--mantine-primary-color-6)' />
        </div>

        {/* Title */}
        <Title order={3} ta='center'>
          {title || t('calculating_fire_feasibility')}
        </Title>

        {/* Progress description */}
        <Text size='lg' c='dimmed' ta='center'>
          {description || getProgressText(progress)} {progress}%
        </Text>

        {/* Progress bar */}
        <Progress
          value={progress}
          w='100%'
          size='xl'
          animated
          color={getProgressColor(progress)}
          style={{
            height: '16px',
            minWidth: '300px',
          }}
        />

        {/* Help text */}
        <Text size='sm' c='dimmed' ta='center'>
          {t('running_simulations')}
        </Text>
      </Stack>
    </Modal>
  );
}

export default LoadingOverlay;
