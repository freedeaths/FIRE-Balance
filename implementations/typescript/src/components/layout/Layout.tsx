/**
 * Layout - 应用主布局组件
 *
 * 统一的应用布局，包含：
 * - Header (标题 + 语言选择)
 * - 三阶段状态指示器
 * - 主内容容器 (根据当前状态渲染对应阶段)
 * - 底部导航按钮
 */

import React from 'react';
import { Container, Group, Title, Menu, ActionIcon } from '@mantine/core';
import { IconFlame, IconLanguage, IconBook } from '@tabler/icons-react';
import { useAppStore } from '../../stores/appStore';
import { usePlannerStore } from '../../stores/plannerStore';
import { getI18n } from '../../core/i18n';
import { PlannerStage } from '../../types';
import { getLanguageDetectionInfo } from '../../utils/languageDetection';

// Import stage content components
import { Stage1Content } from '../contents/Stage1Content';
import { Stage2Content } from '../contents/Stage2Content';
import { Stage3Content } from '../contents/Stage3Content';

// Import shared components
import { StageProgress } from '../common/StageProgress';
import { StageNavigation } from '../common/StageNavigation';
import { ImportExportControls } from '../common/ImportExportControls';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { OfflineIndicator } from '../common/OfflineIndicator';

// 简化的标题组件 - 用 Tailwind 处理样式，按最长语言(中文)设计
const SimpleTitle = ({ t }: { t: any }) => {
  return (
    <Title
      order={3}
      className='
        text-lg md:text-xl lg:text-2xl
        leading-tight
        max-w-md lg:max-w-lg
        break-words
        m-0
        transition-all duration-200
      '
    >
      {t('app_title')}
    </Title>
  );
};

export function Layout() {
  // Store hooks
  const { currentLanguage, setLanguage } = useAppStore();
  const currentStage = usePlannerStore(state => state.currentStage);
  const syncPlannerLanguage = usePlannerStore(state => state.syncLanguage);

  // 全局跟踪上一次的 stage，避免组件卸载导致的状态丢失
  const prevStageRef = React.useRef<PlannerStage | undefined>(undefined);

  // 全局 stage 变化跟踪
  React.useEffect(() => {
    const prevStage = prevStageRef.current;

    // 在 window 对象上存储 stage 变化信息，供 useFIRECalculation 使用
    (window as any).__fireStageTransition = {
      from: prevStage,
      to: currentStage,
      timestamp: Date.now(),
    };

    prevStageRef.current = currentStage;
  }, [currentStage]);

  React.useEffect(() => {
    syncPlannerLanguage(currentLanguage);
  }, [currentLanguage, syncPlannerLanguage]);

  // i18n - 直接使用当前语言确保同步
  const t = (key: string, variables?: Record<string, any>) => {
    const i18n = getI18n();
    // 确保使用当前store中的语言
    i18n.setLanguage(currentLanguage as any);
    return i18n.t(key, variables);
  };

  // Handle language change
  const handleLanguageChange = (value: string | null) => {
    if (value && ['en', 'zh-CN', 'ja'].includes(value)) {
      setLanguage(value as any);
    }
  };

  // Render current stage content
  const renderStageContent = () => {
    switch (currentStage) {
      case PlannerStage.STAGE1_INPUT:
        return <Stage1Content />;
      case PlannerStage.STAGE2_ADJUSTMENT:
        return <Stage2Content />;
      case PlannerStage.STAGE3_ANALYSIS:
        return <Stage3Content />;
      default:
        return <div>Unknown stage</div>;
    }
  };

  return (
    <div
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      {/* Header */}
      <header
        style={{
          backgroundColor: 'white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <Container size='xl' py='md'>
          {/* 第一行：标题和语言选择器 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              minHeight: '48px', // 确保最小高度，防止抖动
            }}
          >
            <Group gap='sm' style={{ flex: '1', minWidth: 0 }}>
              {' '}
              {/* flex: 1 让左侧占据可用空间，minWidth: 0 允许收缩 */}
              <IconFlame size={32} color='var(--mantine-primary-color-6)' />
              <div className='min-w-0 flex-1'>
                {' '}
                {/* 允许标题区域收缩 */}
                <SimpleTitle t={t} />
                <div className='text-sm text-gray-500'>{t('app_subtitle')}</div>
              </div>
            </Group>

            <div
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {/* 使用指南链接 */}
              <Menu shadow='md' width={160} position='bottom-end'>
                <Menu.Target>
                  <ActionIcon
                    variant='subtle'
                    size='lg'
                    aria-label='User Guide'
                    className='hover:bg-gray-100 transition-colors'
                  >
                    <IconBook size={20} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    component='a'
                    href='./usage_en.html'
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    📖 English Guide
                  </Menu.Item>
                  <Menu.Item
                    component='a'
                    href='./usage_cn.html'
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    📖 中文指南
                  </Menu.Item>
                  <Menu.Item
                    component='a'
                    href='./usage_ja.html'
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    📖 日本語ガイド
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>

              {/* 语言选择器 */}
              <Menu shadow='md' width={120} position='bottom-end'>
                <Menu.Target>
                  <ActionIcon
                    variant='subtle'
                    size='lg'
                    aria-label='Switch language'
                    className='hover:bg-gray-100 transition-colors'
                  >
                    <IconLanguage size={20} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    onClick={() => handleLanguageChange('en')}
                    className={currentLanguage === 'en' ? 'bg-blue-50' : ''}
                  >
                    🇺🇸 English
                  </Menu.Item>
                  <Menu.Item
                    onClick={() => handleLanguageChange('zh-CN')}
                    className={
                      String(currentLanguage) === 'zh-CN' ? 'bg-blue-50' : ''
                    }
                  >
                    🇨🇳 中文
                  </Menu.Item>
                  <Menu.Item
                    onClick={() => handleLanguageChange('ja')}
                    className={currentLanguage === 'ja' ? 'bg-blue-50' : ''}
                  >
                    🇯🇵 日本語
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </div>
          </div>

          {/* 第二行：PWA安装按钮 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: '8px',
            }}
          >
            <PWAInstallButton />
          </div>
        </Container>
      </header>

      {/* 三阶段状态指示器 */}
      <div
        style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb' }}
      >
        <Container size='xl' py='lg'>
          <StageProgress currentStage={currentStage} />

          {/* 数据管理工具栏 */}
          <div style={{ marginTop: '12px' }}>
            <ImportExportControls />
          </div>
        </Container>
      </div>

      {/* 主内容区域 */}
      <main style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        <Container size='xl' py='xl'>
          {renderStageContent()}
        </Container>
      </main>

      {/* 底部导航 */}
      <div style={{ backgroundColor: 'white' }}>
        <Container size='xl' py='md'>
          <StageNavigation currentStage={currentStage} />
        </Container>
      </div>

      {/* Footer with GitHub link and copyright */}
      <footer
        style={{ backgroundColor: '#f8fafc', borderTop: '1px solid #e5e7eb' }}
      >
        <Container size='xl' py='sm'>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '16px',
              fontSize: '0.875rem',
              color: '#6b7280',
            }}
          >
            <a
              href='https://github.com/freedeaths/FIRE-Balance'
              target='_blank'
              rel='noopener noreferrer'
              style={{
                color: '#6b7280',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              className='hover:text-blue-600 transition-colors'
            >
              <svg
                width='16'
                height='16'
                fill='currentColor'
                viewBox='0 0 16 16'
              >
                <path d='M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z' />
              </svg>
              GitHub
            </a>
            <span>•</span>
            <span>© 2025 FIRE Balance</span>
          </div>
        </Container>
      </footer>

      {/* PWA 离线指示器 */}
      <OfflineIndicator />
    </div>
  );
}

export default Layout;
