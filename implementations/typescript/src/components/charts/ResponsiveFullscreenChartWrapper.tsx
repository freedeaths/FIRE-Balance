/**
 * Responsive Fullscreen Chart Wrapper
 *
 * 为图表组件提供移动端响应式缩放和全屏横屏功能
 *
 * Features:
 * - 移动端等比缩放（保持桌面端长宽比）
 * - 点击全屏横屏显示
 * - 通用包装器，适配任何图表组件
 * - 优雅的浏览器兼容性处理
 */

import React, { useRef, useEffect, useState, useCallback, createContext, useContext } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { ActionIcon, Tooltip } from '@mantine/core';
import { IconMaximize, IconMinimize } from '@tabler/icons-react';
import { getI18n } from '../../core/i18n';

// =============================================================================
// Types & Context
// =============================================================================

// 移动端显示上下文
interface MobileDisplayContextType {
  isMobile: boolean;
  isMobilePortrait: boolean;
  isFullscreen: boolean;
}

const MobileDisplayContext = createContext<MobileDisplayContextType>({
  isMobile: false,
  isMobilePortrait: false,
  isFullscreen: false,
});

export const useMobileDisplay = () => useContext(MobileDisplayContext);

interface ResponsiveFullscreenChartWrapperProps {
  /** 被包装的图表组件 */
  children: React.ReactNode | ((props: { height: number }) => React.ReactNode);
  /** 目标长宽比（默认2:1，移动端友好） */
  targetAspectRatio?: number;
  /** 是否启用全屏功能 */
  enableFullscreen?: boolean;
  /** 是否启用移动端缩放 */
  enableMobileScaling?: boolean;
  /** 移动端最小缩放比例 */
  minMobileScale?: number;
  /** 图表容器的基础高度（用于计算缩放） */
  baseHeight?: number;
  /** 图表类型，用于调整压缩策略 */
  chartType?: 'line' | 'bar' | 'area' | 'composed';
  /** 自定义CSS类名 */
  className?: string;
  /** 全屏时的容器样式 */
  fullscreenContainerStyle?: React.CSSProperties;
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 检查浏览器是否支持全屏API
 */
const checkFullscreenSupport = (): boolean => {
  return !!(
    document.documentElement.requestFullscreen ||
    (document.documentElement as any).webkitRequestFullscreen ||
    (document.documentElement as any).mozRequestFullScreen ||
    (document.documentElement as any).msRequestFullscreen
  );
};

/**
 * 进入全屏模式
 */
const enterFullscreen = (element: HTMLElement): Promise<void> => {
  if (element.requestFullscreen) {
    return element.requestFullscreen();
  } else if ((element as any).webkitRequestFullscreen) {
    return (element as any).webkitRequestFullscreen();
  } else if ((element as any).mozRequestFullScreen) {
    return (element as any).mozRequestFullScreen();
  } else if ((element as any).msRequestFullscreen) {
    return (element as any).msRequestFullscreen();
  }
  return Promise.reject(new Error('Fullscreen API not supported'));
};

/**
 * 退出全屏模式
 */
const exitFullscreen = (): Promise<void> => {
  if (document.exitFullscreen) {
    return document.exitFullscreen();
  } else if ((document as any).webkitExitFullscreen) {
    return (document as any).webkitExitFullscreen();
  } else if ((document as any).mozCancelFullScreen) {
    return (document as any).mozCancelFullScreen();
  } else if ((document as any).msExitFullscreen) {
    return (document as any).msExitFullscreen();
  }
  return Promise.reject(new Error('Fullscreen API not supported'));
};

/**
 * 锁定屏幕方向为横屏
 */
const lockOrientation = async (orientation: 'landscape' | 'portrait' = 'landscape'): Promise<void> => {
  if (screen.orientation && screen.orientation.lock) {
    try {
      await screen.orientation.lock(orientation);
    } catch (error) {
      console.warn('Screen orientation lock not supported or failed:', error);
    }
  }
};

/**
 * 解锁屏幕方向
 */
const unlockOrientation = (): void => {
  if (screen.orientation && screen.orientation.unlock) {
    try {
      screen.orientation.unlock();
    } catch (error) {
      console.warn('Screen orientation unlock failed:', error);
    }
  }
};

// =============================================================================
// 主组件
// =============================================================================

export function ResponsiveFullscreenChartWrapper({
  children,
  targetAspectRatio = 3.0, // 3:1 比例，更扁的图表
  enableFullscreen = true,
  enableMobileScaling = true,
  minMobileScale = 0.4, // 默认允许更小的缩放
  baseHeight = 400,
  chartType = 'line', // 默认为线图
  className = '',
  fullscreenContainerStyle = {},
}: ResponsiveFullscreenChartWrapperProps): React.JSX.Element {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  // State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileScale, setMobileScale] = useState(1);
  const [isFullscreenSupported, setIsFullscreenSupported] = useState(false);

  // Hooks - 双重移动端检测，确保准确性
  const mantineIsMobile = useMediaQuery('(max-width: 768px)', true, { getInitialValueInEffect: false });
  const [nativeIsMobile, setNativeIsMobile] = useState(() => window.innerWidth <= 768);
  const isMobile = mantineIsMobile || nativeIsMobile;

  // 检测是否为移动端竖屏模式（需要简化显示）
  const [isPortrait, setIsPortrait] = useState(() => window.innerHeight > window.innerWidth);
  const isMobilePortrait = isMobile && isPortrait && !isFullscreen;
  const i18n = getI18n();
  const t = useCallback((key: string, variables?: Record<string, unknown>): string => {
    // 提供默认值以防翻译键不存在
    const defaultValues: Record<string, string> = {
      'enter_fullscreen': 'Enter Fullscreen',
      'exit_fullscreen': 'Exit Fullscreen',
      'tap_fullscreen_for_better_view': 'Tap fullscreen for better view',
      'scaled_for_mobile': 'Scaled for mobile'
    };

    const translation = i18n.t(key, variables);
    return translation === key ? (defaultValues[key] || key) : translation;
  }, [i18n]);

  // 根据图表类型调整压缩策略
  const getChartTypeScale = useCallback((baseScale: number): number => {
    switch (chartType) {
      case 'bar':
        // 柱状图需要更多高度，避免柱子重叠
        return Math.max(baseScale * 1.8, 0.7); // 最小保持70%高度
      case 'composed':
        // 复合图(净值轨迹图)可以压缩更多
        return Math.max(baseScale, 0.3); // 允许压缩到30%
      case 'area':
        // 面积图(Monte Carlo分布图)保持更多高度，避免过扁
        return Math.max(baseScale * 1.5, 0.65); // 最小保持65%高度
      case 'line':
      default:
        // 线图可以压缩较多
        return Math.max(baseScale, 0.4); // 允许压缩到40%
    }
  }, [chartType]);

  // 计算移动端目标高度 - 让图表变"扁"但不压缩文字
  const calculateMobileScale = useCallback(() => {
    if (!enableMobileScaling || !isMobile || !containerRef.current) {
      setMobileScale(1);
      return;
    }

    const containerWidth = containerRef.current.offsetWidth;
    // 目标：让图表变扁，所以目标高度 = 容器宽度 ÷ 目标宽高比
    const targetHeight = containerWidth / targetAspectRatio;
    const actualHeight = baseHeight;

    // 计算基础缩放比例
    const baseScale = targetHeight / actualHeight;
    // 根据图表类型调整最终缩放比例
    const calculatedScale = getChartTypeScale(baseScale);
    setMobileScale(calculatedScale);
  }, [enableMobileScaling, isMobile, targetAspectRatio, baseHeight, chartType, getChartTypeScale, mantineIsMobile, nativeIsMobile]);

  // 全屏状态变化处理
  const handleFullscreenChange = useCallback(() => {
    const isCurrentlyFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );

    setIsFullscreen(isCurrentlyFullscreen);

    if (!isCurrentlyFullscreen) {
      // 退出全屏时解锁方向
      unlockOrientation();
    }
  }, []);

  // 进入/退出全屏
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current || !enableFullscreen) return;

    try {
      if (isFullscreen) {
        await exitFullscreen();
      } else {
        await enterFullscreen(containerRef.current);
        // 进入全屏后尝试锁定横屏
        if (isMobile) {
          await lockOrientation('landscape');
        }
      }
    } catch (error) {
      console.warn('Fullscreen toggle failed:', error);
    }
  }, [isFullscreen, enableFullscreen, isMobile]);

  // 初始化和监听器设置
  useEffect(() => {
    // 检查全屏API支持
    setIsFullscreenSupported(checkFullscreenSupport());

    // 计算初始缩放
    calculateMobileScale();

    // 动态添加全屏样式
    const styleId = 'responsive-fullscreen-chart-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .responsive-chart-container:fullscreen {
          width: 100vw !important;
          height: 100vh !important;
          background: #ffffff !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .responsive-chart-container:fullscreen .chart-content {
          max-width: none !important;
          max-height: none !important;
        }

        /* WebKit 全屏样式 */
        .responsive-chart-container:-webkit-full-screen {
          width: 100vw !important;
          height: 100vh !important;
          background: #ffffff !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .responsive-chart-container:-webkit-full-screen .chart-content {
          max-width: none !important;
          max-height: none !important;
        }

        /* Mozilla 全屏样式 */
        .responsive-chart-container:-moz-full-screen {
          width: 100vw !important;
          height: 100vh !important;
          background: #ffffff !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .responsive-chart-container:-moz-full-screen .chart-content {
          max-width: none !important;
          max-height: none !important;
        }

        /* MS 全屏样式 */
        .responsive-chart-container:-ms-fullscreen {
          width: 100vw !important;
          height: 100vh !important;
          background: #ffffff !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .responsive-chart-container:-ms-fullscreen .chart-content {
          max-width: none !important;
          max-height: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    // 监听全屏状态变化
    const events = [
      'fullscreenchange',
      'webkitfullscreenchange',
      'mozfullscreenchange',
      'MSFullscreenChange'
    ];

    events.forEach(event => {
      document.addEventListener(event, handleFullscreenChange);
    });

    // 监听窗口大小变化
    const handleResize = () => {
      // 更新原生移动端检测
      setNativeIsMobile(window.innerWidth <= 768);
      // 更新横竖屏状态
      setIsPortrait(window.innerHeight > window.innerWidth);
      // 防抖处理
      setTimeout(calculateMobileScale, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleFullscreenChange);
      });
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [calculateMobileScale, handleFullscreenChange]);

  // 响应移动端变化重新计算缩放
  useEffect(() => {
    calculateMobileScale();
  }, [calculateMobileScale, isMobile]);

  // 计算实际使用的图表高度
  const actualChartHeight = (!isFullscreen && isMobile && enableMobileScaling)
    ? baseHeight * mobileScale
    : baseHeight;

  // 样式计算
  const containerStyles: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
    // 移动端使用实际图表高度，桌面端使用基础高度
    height: `${(!isFullscreen && isMobile && enableMobileScaling) ? actualChartHeight : baseHeight}px`,
  };

  const chartStyles: React.CSSProperties = {
    transformOrigin: 'top center',
    transition: 'transform 0.3s ease',
    width: '100%',
    height: `${(!isFullscreen && isMobile && enableMobileScaling) ? actualChartHeight : baseHeight}px`,
    ...(isFullscreen && isMobile && {
      transform: 'rotate(90deg)',
      transformOrigin: 'center center',
      width: '100vh',
      height: '100vw',
    }),
  };

  // 全屏模式样式
  const fullscreenStyles: React.CSSProperties = {
    ...fullscreenContainerStyle,
    ...(isFullscreen && {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ffffff',
    }),
  };

  return (
    <MobileDisplayContext.Provider value={{
      isMobile,
      isMobilePortrait,
      isFullscreen
    }}>
      <div
        ref={containerRef}
        className={`responsive-chart-container ${className}`}
        style={{
          ...containerStyles,
          ...fullscreenStyles,
        }}
      >
        {/* 全屏按钮 */}
        {enableFullscreen && isFullscreenSupported && (
          <Tooltip
            label={isFullscreen ? t('exit_fullscreen') : t('enter_fullscreen')}
            position="top-end"
          >
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={toggleFullscreen}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                zIndex: 1000,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(4px)',
              }}
            >
              {isFullscreen ? (
                <IconMinimize size={16} />
              ) : (
                <IconMaximize size={16} />
              )}
            </ActionIcon>
          </Tooltip>
        )}

        {/* 图表内容 */}
        <div
          ref={chartRef}
          className="chart-content"
          style={chartStyles}
        >
          {typeof children === 'function' ? children({ height: actualChartHeight }) : children}
        </div>


      </div>
    </MobileDisplayContext.Provider>
  );
}

export default ResponsiveFullscreenChartWrapper;
