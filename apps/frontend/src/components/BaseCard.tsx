import { ProCard, ProCardProps } from '@ant-design/pro-components';
import { ReactNode } from 'react';

export type CardStyleType = 'default' | 'apple' | 'material' | 'elevated';

export type CardVariant = 'outlined' | 'filled' | 'borderless';

export interface BaseCardProps extends Omit<ProCardProps, 'border' | 'ghost'> {
  styleType?: CardStyleType;
  variant?: CardVariant;
  children: ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
  title?: ReactNode;
  subTitle?: ReactNode;
  extra?: ReactNode;
  bordered?: boolean;
  hoverable?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

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
  const cardStyle = {
    ...CARD_STYLES[styleType],
    ...style,
  };

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

export interface StatisticCardProps {
  title: ReactNode;
  value: number | string;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: number;
  icon?: ReactNode;
  loading?: boolean;
  styleType?: CardStyleType;
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
    trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';

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
            {loading ? '...' : value}
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

export interface ActionCardProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
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
            {loading ? '加载中...' : title}
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
