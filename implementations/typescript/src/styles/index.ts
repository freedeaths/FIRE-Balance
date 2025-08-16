/**
 * Styles Module - 统一的样式系统导出
 *
 * 提供设计系统的所有元素：
 * - 设计令牌 (Design Tokens)
 * - 主题配置 (Theme)
 * - 工具函数 (Utilities)
 */

export * from './design-tokens';
export { theme, getResponsiveValue, getColorShade } from './theme';
export type { CustomTheme } from './theme';
