/**
 * 主题配置
 *
 * 统一管理 Material Design 和 Apple 设计系统的主题变量。
 */

/**
 * 设计系统类型
 */
export type DesignSystem = 'material' | 'apple';

/**
 * 颜色模式
 */
export type ColorMode = 'light' | 'dark';

/**
 * Material Design 主题配色
 */
export const materialColors = {
  // 主色
  primary: '#1976d2',
  primaryLight: '#42a5f5',
  primaryDark: '#1565c0',

  // 次要色
  secondary: '#9c27b0',
  secondaryLight: '#ba68c8',
  secondaryDark: '#7b1fa2',

  // 功能色
  error: '#d32f2f',
  warning: '#ed6c02',
  success: '#2e7d32',
  info: '#0288d1',

  // 中性色
  background: '#ffffff',
  surface: '#f5f5f5',
  surfaceVariant: '#e0e0e0',

  // 文字色
  text: 'rgba(0, 0, 0, 0.87)',
  textSecondary: 'rgba(0, 0, 0, 0.6)',
  textDisabled: 'rgba(0, 0, 0, 0.38)',

  // 分割线
  divider: 'rgba(0, 0, 0, 0.12)',
};

/**
 * Apple 设计系统配色
 */
export const appleColors = {
  // 主色（系统蓝色）
  primary: '#007AFF',
  primaryLight: '#5AC8FA',
  primaryDark: '#0051D5',

  // 次要色
  secondary: '#5856D6',
  secondaryLight: '#A29BFE',
  secondaryDark: '#3D3B93',

  // 功能色
  error: '#FF3B30',
  warning: '#FF9500',
  success: '#34C759',
  info: '#5AC8FA',

  // 中性色（灰度系统）
  background: '#FFFFFF',
  surface: '#F2F2F7',
  surfaceVariant: '#E5E5EA',

  // 文字色
  text: '#000000',
  textSecondary: '#3C3C43',
  textTertiary: '#3C3C4399',
  textQuaternary: '#3C3C432E',

  // 分割线
  divider: 'rgba(60, 60, 67, 0.36)',
  opaqueSeparator: 'rgba(60, 60, 67, 0.29)',
};

/**
 * 深色模式配色
 */
export const darkColors = {
  background: '#000000',
  surface: '#1C1C1E',
  surfaceVariant: '#2C2C2E',

  // 文字色
  text: '#FFFFFF',
  textSecondary: '#EBEBF5',
  textTertiary: '#EBEBF599',

  // 分割线
  divider: 'rgba(84, 84, 88, 0.65)',
};

/**
 * 间距系统（8px 基准）
 */
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
};

/**
 * 圆角系统
 */
export const borderRadius = {
  // Material Design
  material: {
    none: '0',
    sm: '4px',
    md: '8px',
    lg: '16px',
    xl: '24px',
    full: '9999px',
  },

  // Apple 设计系统
  apple: {
    none: '0',
    sm: '6px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    full: '9999px',
  },
};

/**
 * 阴影系统
 */
export const shadows = {
  // Material Design 阴影
  material: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.15)',
  },

  // Apple 设计系统阴影
  apple: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.06)',
    md: '0 2px 8px rgba(0, 0, 0, 0.08)',
    lg: '0 4px 16px rgba(0, 0, 0, 0.1)',
    xl: '0 8px 24px rgba(0, 0, 0, 0.12)',
  },
};

/**
 * 字体系统
 */
export const typography = {
  // 字体家族
  fontFamily: {
    // Apple 设计系统（San Francisco 替代）
    apple: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    // Material Design（Roboto）
    material: '"Roboto", "Helvetica Neue", Helvetica, Arial, sans-serif',
    // 代码字体
    mono: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace',
  },

  // 字体大小
  fontSize: {
    xs: '11px',
    sm: '12px',
    base: '14px',
    md: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px',
    '4xl': '36px',
  },

  // 字重
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  // 行高
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
};

/**
 * 过渡动画
 */
export const transitions = {
  // Material Design（更快的动画）
  material: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // Apple 设计系统（更流畅的动画）
  apple: {
    fast: '200ms cubic-bezier(0.25, 0.1, 0.25, 1)',
    normal: '350ms cubic-bezier(0.25, 0.1, 0.25, 1)',
    slow: '500ms cubic-bezier(0.25, 0.1, 0.25, 1)',
  },
};

/**
 * 主题配置接口
 */
export interface ThemeConfig {
  /** 设计系统 */
  system: DesignSystem;
  /** 颜色模式 */
  mode: ColorMode;
  /** 主色 */
  primaryColor?: string;
}

/**
 * 获取主题配置
 */
export function getTheme(config: ThemeConfig = { system: 'apple', mode: 'light' }) {
  const { system, mode, primaryColor } = config;

  // 选择基础颜色
  const baseColors = system === 'material' ? materialColors : appleColors;

  // 应用深色模式
  const colors = mode === 'dark' ? { ...baseColors, ...darkColors } : baseColors;

  // 应用自定义主色
  if (primaryColor) {
    colors.primary = primaryColor;
  }

  return {
    system,
    mode,

    // 颜色
    colors,

    // 间距
    spacing,

    // 圆角
    borderRadius: borderRadius[system],

    // 阴影
    shadow: shadows[system],

    // 字体
    typography: {
      ...typography,
      fontFamily: typography.fontFamily[system],
    },

    // 过渡
    transitions: transitions[system],

    // 组件样式
    components: {
      // 按钮
      button: {
        primary: {
          backgroundColor: colors.primary,
          color: '#ffffff',
          borderRadius: borderRadius[system].md,
        },
        default: {
          backgroundColor: mode === 'dark' ? colors.surfaceVariant : colors.surface,
          color: colors.text,
          borderRadius: borderRadius[system].md,
        },
      },

      // 卡片
      card: {
        backgroundColor: colors.background,
        borderRadius: borderRadius[system].lg,
        boxShadow: shadows[system].sm,
        border: system === 'apple' ? `1px solid ${colors.divider}` : 'none',
      },

      // 输入框
      input: {
        backgroundColor: mode === 'dark' ? colors.surfaceVariant : colors.surface,
        borderRadius: borderRadius[system].md,
        border: system === 'apple' ? `1px solid ${colors.divider}` : 'none',
        borderBottom: system === 'material' ? `2px solid ${colors.primary}` : 'none',
      },

      // 标签
      tag: {
        backgroundColor: system === 'apple' ? colors.surface : colors.primaryLight,
        color: system === 'apple' ? colors.text : '#ffffff',
        borderRadius: system === 'apple' ? borderRadius.apple.full : borderRadius.material.sm,
      },
    },
  };
}

/**
 * 生成 CSS 变量
 */
export function generateCssVars(config: ThemeConfig = { system: 'apple', mode: 'light' }) {
  const theme = getTheme(config);

  return {
    // 颜色
    '--color-primary': theme.colors.primary,
    '--color-secondary': theme.colors.secondary,
    '--color-error': theme.colors.error,
    '--color-warning': theme.colors.warning,
    '--color-success': theme.colors.success,
    '--color-info': theme.colors.info,
    '--color-background': theme.colors.background,
    '--color-surface': theme.colors.surface,
    '--color-text': theme.colors.text,
    '--color-text-secondary': theme.colors.textSecondary,
    '--color-divider': theme.colors.divider,

    // 间距
    '--spacing-xs': theme.spacing.xs,
    '--spacing-sm': theme.spacing.sm,
    '--spacing-md': theme.spacing.md,
    '--spacing-lg': theme.spacing.lg,
    '--spacing-xl': theme.spacing.xl,

    // 圆角
    '--radius-sm': theme.borderRadius.sm,
    '--radius-md': theme.borderRadius.md,
    '--radius-lg': theme.borderRadius.lg,
    '--radius-full': theme.borderRadius.full,

    // 阴影
    '--shadow-sm': theme.shadow.sm,
    '--shadow-md': theme.shadow.md,
    '--shadow-lg': theme.shadow.lg,

    // 过渡
    '--transition-fast': theme.transitions.fast,
    '--transition-normal': theme.transitions.normal,
    '--transition-slow': theme.transitions.slow,
  } as Record<string, string>;
}

/**
 * 应用主题到根元素
 */
export function applyTheme(config: ThemeConfig = { system: 'apple', mode: 'light' }) {
  const cssVars = generateCssVars(config);

  Object.entries(cssVars).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });

  // 设置设计系统类名
  document.documentElement.setAttribute('data-system', config.system);
  document.documentElement.setAttribute('data-mode', config.mode);
}

/**
 * 默认导出
 */
export default {
  getTheme,
  generateCssVars,
  applyTheme,
  materialColors,
  appleColors,
  spacing,
  borderRadius,
  shadows,
  typography,
  transitions,
};
