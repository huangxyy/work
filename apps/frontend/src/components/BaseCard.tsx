import { ProCard, ProCardProps } from '@ant-design/pro-components';
import { ReactNode } from 'react';

/**
 * 卡片样式类型
 */
export type CardStyleType = 'default' | 'apple' | 'material' | 'elevated';

/**
 * 卡片变体
 */
export type CardVariant = 'outlined' | 'filled' | 'borderless';

/**
 * BaseCard Props
 */
export interface BaseCardProps extends Omit<ProCardProps, 'border' | 'ghost'> {
  /** 卡片样式类型 */
  styleType?: CardStyleType;
  /** 卡片变体 */
  variant?: CardVariant;
  /** 子组�?*/
  children: ReactNode;
  /** 是否可折�?*/
  collapsible?: boolean;
  /** 默认是否折叠 */
  defaultCollapsed?: boolean;
  /** 折叠回调 */
  onCollapse?: (collapsed: boolean) => void;
  /** 卡片标题 */
  title?: ReactNode;
  /** 卡片副标�?*/
  subTitle?: ReactNode;
  /** 额外操作�?*/
  extra?: ReactNode;
  /** 是否显示边框 */
  bordered?: boolean;
  /** 悬停效果 */
  hoverable?: boolean;
  /** 自定义类�?*/
  className?: string;
  /** 自定义样�?*/
  style?: React.CSSProperties;
}

/**
 * 卡片样式配置
 */
const CARD_STYLES: Record<CardStyleType, React.CSSProperties> = {
  default: {
    borderRadius: '8px',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
  },
  apple: {
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
    backgroundColor: '#ffffff',
    border: '1px solid rgba(0, 0, 0, 0.06)',
  },
  material: {
    borderRadius: '4px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  },
  elevated: {
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
  },
};

/**
 * BaseCard 基础卡片组件
 *
 * 提供统一的卡片样式和交互，支持多种风格�?
 *
 * @example
 * ```tsx
 * <BaseCard title="标题" styleType="apple">
 *   <p>卡片内容</p>
 * </BaseCard>
 * ```
 */
export function BaseCard({
  styleType = 'default',
  variant = 'outlined',
  children,
  collapsible = false,
  defaultCollapsed = false,
  onCollapse,
  title,
  subTitle,
  extra,
  bordered = true,
  hoverable = false,
  className = '',
  style,
  ...restProps
}: BaseCardProps) {
  // 计算合并后的样式
  const cardStyle = {
    ...CARD_STYLES[styleType],
    ...style,
  };

  // 根据变体调整样式
  const getProCardProps = (): Partial<ProCardProps> => {
    const baseProps: Partial<ProCardProps> = {
      bordered: variant !== 'borderless' && bordered,
      headerBordered: variant === 'outlined',
    };

    switch (variant) {
      case 'filled':
        return {
          ...baseProps,
          bordered: false,
        };
      case 'borderless':
        return {
          ...baseProps,
          bordered: false,
          ghost: true,
        };
      default:
        return baseProps;
    }
  };

  // 根据 styleType 添加类名
  const cardClassName = [
    'base-card',
    `base-card--${styleType}`,
    `base-card--${variant}`,
    hoverable ? 'base-card--hoverable' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <ProCard
      title={title}
      subTitle={subTitle}
      extra={extra}
      collapsible={collapsible}
      defaultCollapsed={defaultCollapsed}
      onCollapse={onCollapse}
      className={cardClassName}
      style={cardStyle}
      hoverable={hoverable}
      {...getProCardProps()}
      {...restProps}
    >
      {children}
    </ProCard>
  );
}

/**
 * StatisticCard 统计卡片组件
 *
 * 用于显示关键指标数据�?
 */
export interface StatisticCardProps {
  /** 标题 */
  title: ReactNode;
  /** 数�?*/
  value: number | string;
  /** 单位 */
  unit?: string;
  /** 趋势（up/down/neutral�?*/
  trend?: 'up' | 'down' | 'neutral';
  /** 趋势�?*/
  trendValue?: number;
  /** 图标 */
  icon?: ReactNode;
  /** 加载�?*/
  loading?: boolean;
  /** 样式类型 */
  styleType?: CardStyleType;
  /** 点击事件 */
  onClick?: () => void;
}

export function StatisticCard({
  title,
  value,
  unit = '',
  trend,
  trendValue,
  icon,
  loading = false,
  styleType = 'apple',
  onClick,
}: StatisticCardProps) {
  const trendColor =
    trend === 'up' ? '#52c41a' : trend === 'down' ? '#ff4d4f' : '#8c8c8c';
  const trendIcon =
    trend === 'up' ? '�? : trend === 'down' ? '�? : '�?;

  return (
    <BaseCard
      styleType={styleType}
      hoverable={!!onClick}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {icon && (
          <div
            style={{
              fontSize: '32px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {icon}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: '14px',
              color: '#8c8c8c',
              marginBottom: '4px',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: '28px',
              fontWeight: 600,
              color: '#262626',
            }}
          >
            {loading ? '�? : value}
            <span
              style={{
                fontSize: '14px',
                fontWeight: 400,
                color: '#8c8c8c',
                marginLeft: '4px',
              }}
            >
              {unit}
            </span>
          </div>
          {trend && trendValue !== undefined && (
            <div
              style={{
                fontSize: '12px',
                color: trendColor,
                marginTop: '4px',
              }}
            >
              {trendIcon} {Math.abs(trendValue)}%
            </div>
          )}
        </div>
      </div>
    </BaseCard>
  );
}

/**
 * ActionCard 操作卡片组件
 *
 * 用于显示可点击的操作项�?
 */
export interface ActionCardProps {
  /** 标题 */
  title: ReactNode;
  /** 描述 */
  description?: ReactNode;
  /** 图标 */
  icon?: ReactNode;
  /** 点击事件 */
  onClick: () => void;
  /** 禁用状�?*/
  disabled?: boolean;
  /** 加载�?*/
  loading?: boolean;
  /** 样式类型 */
  styleType?: CardStyleType;
}

export function ActionCard({
  title,
  description,
  icon,
  onClick,
  disabled = false,
  loading = false,
  styleType = 'apple',
}: ActionCardProps) {
  return (
    <BaseCard
      styleType={styleType}
      hoverable={!disabled && !loading}
      onClick={!disabled && !loading ? onClick : undefined}
      style={{
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {icon && <div style={{ fontSize: '24px' }}>{icon}</div>}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: '16px',
              fontWeight: 500,
              color: '#262626',
              marginBottom: description ? '4px' : 0,
            }}
          >
            {loading ? '加载�?..' : title}
          </div>
          {description && !loading && (
            <div
              style={{
                fontSize: '14px',
                color: '#8c8c8c',
              }}
            >
              {description}
            </div>
          )}
        </div>
      </div>
    </BaseCard>
  );
}

export default BaseCard;
