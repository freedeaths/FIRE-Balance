/**
 * Mantine Theme Configuration - Mantine 主题配置
 *
 * 基于设计令牌配置 Mantine UI 库的主题系统：
 * - 品牌色彩集成
 * - 组件样式定制
 * - 响应式断点
 * - 全局样式设置
 */

import { createTheme } from "@mantine/core";
import {
  colors,
  typography,
  spacing,
  borderRadius,
  boxShadow,
  breakpoints,
} from "./design-tokens";

// =============================================================================
// Custom Color Tuples for Mantine
// =============================================================================

const primaryColors = [
  colors.primary[50],
  colors.primary[100],
  colors.primary[200],
  colors.primary[300],
  colors.primary[400],
  colors.primary[500],
  colors.primary[600],
  colors.primary[700],
  colors.primary[800],
  colors.primary[900],
] as const;

const successColors = [
  colors.success[50],
  colors.success[100],
  colors.success[200],
  colors.success[300],
  colors.success[400],
  colors.success[500],
  colors.success[600],
  colors.success[700],
  colors.success[800],
  colors.success[900],
] as const;

const warningColors = [
  colors.warning[50],
  colors.warning[100],
  colors.warning[200],
  colors.warning[300],
  colors.warning[400],
  colors.warning[500],
  colors.warning[600],
  colors.warning[700],
  colors.warning[800],
  colors.warning[900],
] as const;

const errorColors = [
  colors.error[50],
  colors.error[100],
  colors.error[200],
  colors.error[300],
  colors.error[400],
  colors.error[500],
  colors.error[600],
  colors.error[700],
  colors.error[800],
  colors.error[900],
] as const;

// =============================================================================
// Main Theme Configuration
// =============================================================================

export const theme = createTheme({
  // =============================================================================
  // Color System
  // =============================================================================
  colors: {
    primary: primaryColors,
    success: successColors,
    warning: warningColors,
    error: errorColors,
    // Use Mantine's built-in colors for other needs
  },

  primaryColor: "primary",
  primaryShade: { light: 6, dark: 4 },

  // =============================================================================
  // Typography
  // =============================================================================
  fontFamily: typography.fontFamily.sans.join(", "),
  fontFamilyMonospace: typography.fontFamily.mono.join(", "),

  fontSizes: {
    xs: typography.fontSize.xs,
    sm: typography.fontSize.sm,
    md: typography.fontSize.base,
    lg: typography.fontSize.lg,
    xl: typography.fontSize.xl,
  },

  lineHeights: {
    xs: typography.lineHeight.tight,
    sm: typography.lineHeight.snug,
    md: typography.lineHeight.normal,
    lg: typography.lineHeight.relaxed,
    xl: typography.lineHeight.loose,
  },

  // =============================================================================
  // Spacing
  // =============================================================================
  spacing: {
    xs: spacing[2], // 8px
    sm: spacing[3], // 12px
    md: spacing[4], // 16px
    lg: spacing[6], // 24px
    xl: spacing[8], // 32px
  },

  // =============================================================================
  // Border Radius
  // =============================================================================
  radius: {
    xs: borderRadius.sm,
    sm: borderRadius.default,
    md: borderRadius.md,
    lg: borderRadius.lg,
    xl: borderRadius.xl,
  },

  // =============================================================================
  // Shadows
  // =============================================================================
  shadows: {
    xs: boxShadow.sm,
    sm: boxShadow.default,
    md: boxShadow.md,
    lg: boxShadow.lg,
    xl: boxShadow.xl,
  },

  // =============================================================================
  // Breakpoints
  // =============================================================================
  breakpoints: {
    xs: breakpoints.xs,
    sm: breakpoints.sm,
    md: breakpoints.md,
    lg: breakpoints.lg,
    xl: breakpoints.xl,
  },

  // =============================================================================
  // Component Customization
  // =============================================================================
  components: {
    Button: {
      defaultProps: {
        radius: "md",
      },
      styles: (theme) => ({
        root: {
          fontWeight: typography.fontWeight.medium,
          transition: `all ${theme.other?.transitionDuration || "200ms"} ${theme.other?.transitionEasing || "ease-in-out"}`,

          "&:hover": {
            transform: "translateY(-1px)",
            boxShadow: theme.shadows.md,
          },

          "&:active": {
            transform: "translateY(0)",
          },
        },
      }),
    },

    Card: {
      defaultProps: {
        shadow: "sm",
        radius: "lg",
        padding: "lg",
      },
      styles: (theme) => ({
        root: {
          transition: `box-shadow ${theme.other?.transitionDuration || "200ms"} ${theme.other?.transitionEasing || "ease-in-out"}`,

          "&:hover": {
            boxShadow: theme.shadows.md,
          },
        },
      }),
    },

    TextInput: {
      defaultProps: {
        radius: "md",
        size: "sm",
      },
      styles: (theme) => ({
        input: {
          transition: `border-color ${theme.other?.transitionDuration || "200ms"} ${theme.other?.transitionEasing || "ease-in-out"}`,

          "&:focus": {
            borderColor: theme.colors.primary[5],
            boxShadow: `0 0 0 3px ${theme.colors.primary[1]}`,
          },
        },
      }),
    },

    NumberInput: {
      defaultProps: {
        radius: "md",
        size: "sm",
      },
      styles: (theme) => ({
        input: {
          transition: `border-color ${theme.other?.transitionDuration || "200ms"} ${theme.other?.transitionEasing || "ease-in-out"}`,

          "&:focus": {
            borderColor: theme.colors.primary[5],
            boxShadow: `0 0 0 3px ${theme.colors.primary[1]}`,
          },
        },
      }),
    },

    Select: {
      defaultProps: {
        radius: "md",
        size: "sm",
      },
      styles: (theme) => ({
        input: {
          transition: `border-color ${theme.other?.transitionDuration || "200ms"} ${theme.other?.transitionEasing || "ease-in-out"}`,

          "&:focus": {
            borderColor: theme.colors.primary[5],
            boxShadow: `0 0 0 3px ${theme.colors.primary[1]}`,
          },
        },
      }),
    },

    Table: {
      styles: (theme) => ({
        root: {
          borderRadius: theme.radius.lg,
          overflow: "hidden",
        },

        thead: {
          backgroundColor: theme.colors.gray[0],

          "& th": {
            borderBottom: `2px solid ${theme.colors.gray[2]}`,
            fontWeight: typography.fontWeight.semibold,
            fontSize: typography.fontSize.sm,
            padding: `${spacing[3]} ${spacing[4]}`,
          },
        },

        tbody: {
          "& tr": {
            transition: `background-color ${theme.other?.transitionDuration || "200ms"} ${theme.other?.transitionEasing || "ease-in-out"}`,

            "&:hover": {
              backgroundColor: theme.colors.gray[0],
            },
          },

          "& td": {
            padding: `${spacing[3]} ${spacing[4]}`,
            borderBottom: `1px solid ${theme.colors.gray[1]}`,
          },
        },
      }),
    },

    Modal: {
      defaultProps: {
        radius: "lg",
        shadow: "xl",
        centered: true,
      },
      styles: (theme) => ({
        content: {
          maxHeight: "90vh",
          overflowY: "auto",
        },
      }),
    },

    AppShell: {
      styles: (theme) => ({
        header: {
          borderBottom: `1px solid ${theme.colors.gray[2]}`,
          backdropFilter: "blur(10px)",
          backgroundColor: `${theme.white}f0`, // 94% opacity
        },

        navbar: {
          borderRight: `1px solid ${theme.colors.gray[2]}`,
        },

        footer: {
          borderTop: `1px solid ${theme.colors.gray[2]}`,
        },
      }),
    },
  },

  // =============================================================================
  // Other Custom Properties
  // =============================================================================
  other: {
    // Custom properties that can be used in component styles
    transitionDuration: "200ms",
    transitionEasing: "cubic-bezier(0.4, 0, 0.2, 1)",

    // Financial chart colors
    chartColors: colors.financial,

    // Status colors
    statusColors: {
      success: colors.success[500],
      warning: colors.warning[500],
      error: colors.error[500],
      info: colors.primary[500],
    },
  },

  // NOTE: globalStyles is not supported in Mantine v7, removed to fix build errors
  /*
  globalStyles: (theme) => ({
    // Reset and base styles
    '*, *::before, *::after': {
      boxSizing: 'border-box',
    },

    body: {
      fontFamily: theme.fontFamily,
      color: theme.colors.gray[8],
      lineHeight: theme.lineHeights?.md || typography.lineHeight.normal,
      fontSize: theme.fontSizes?.md || typography.fontSize.base,
      backgroundColor: theme.colors.gray[0],
    },

    // Scrollbar styling
    '::-webkit-scrollbar': {
      width: '8px',
      height: '8px',
    },

    '::-webkit-scrollbar-track': {
      background: theme.colors.gray[1],
      borderRadius: borderRadius.full,
    },

    '::-webkit-scrollbar-thumb': {
      background: theme.colors.gray[4],
      borderRadius: borderRadius.full,

      '&:hover': {
        background: theme.colors.gray[5],
      },
    },

    // Focus styles
    ':focus-visible': {
      outline: `2px solid ${theme.colors.primary[5]}`,
      outlineOffset: '2px',
    },

    // Selection styles
    '::selection': {
      backgroundColor: theme.colors.primary[1],
      color: theme.colors.primary[8],
    },

    // Animation utilities
    '.animate-pulse': {
      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    },

    '@keyframes pulse': {
      '0%, 100%': {
        opacity: 1,
      },
      '50%': {
        opacity: 0.5,
      },
    },

    '.animate-bounce': {
      animation: 'bounce 1s infinite',
    },

    '@keyframes bounce': {
      '0%, 100%': {
        transform: 'translateY(-25%)',
        animationTimingFunction: 'cubic-bezier(0.8, 0, 1, 1)',
      },
      '50%': {
        transform: 'translateY(0)',
        animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)',
      },
    },

    // Utility classes for financial data
    '.text-portfolio': {
      color: colors.financial.portfolio,
    },

    '.text-income': {
      color: colors.financial.income,
    },

    '.text-expenses': {
      color: colors.financial.expenses,
    },

    '.text-positive': {
      color: colors.success[600],
    },

    '.text-negative': {
      color: colors.error[600],
    },
  */
});

// =============================================================================
// Type Exports
// =============================================================================

export type CustomTheme = typeof theme;

// =============================================================================
// Theme Utilities
// =============================================================================

export const getResponsiveValue = <T>(
  values: {
    xs?: T;
    sm?: T;
    md?: T;
    lg?: T;
    xl?: T;
  },
  defaultValue: T,
): T => {
  // This would be used for responsive values, but Mantine handles this internally
  return values.md || defaultValue;
};

export const getColorShade = (color: string, shade = 5): string => {
  // Helper to get specific color shades
  return theme.colors[color as keyof typeof theme.colors]?.[shade] || color;
};
