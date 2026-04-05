import { Skeleton as AntSkeleton, Card, Col, List, Row, Space } from 'antd';
import { ReactNode } from 'react';

/**
 * 基础骨架屏配�?
 */
export interface SkeletonProps {
  /** 是否显示骨架�?*/
  loading?: boolean;
  /** 子组件，加载完成后显�?*/
  children: ReactNode;
  /** 骨架屏行�?*/
  rows?: number;
  /** 是否显示头像 */
  avatar?: boolean;
  /** 是否显示标题 */
  title?: boolean;
  /** 是否显示段落 */
  paragraph?: boolean;
  /** 骨架屏是否处于活跃状�?*/
  active?: boolean;
  /** 自定义骨架屏 */
  customSkeleton?: ReactNode;
  /** 额外的样�?*/
  style?: React.CSSProperties;
}

/**
 * Skeleton 骨架屏组�?
 *
 * 在数据加载时显示占位内容，提升用户体验�?
 *
 * @example
 * ```tsx
 * <Skeleton loading={isLoading} rows={3}>
 *   <div>实际内容</div>
 * </Skeleton>
 * ```
 */
export function Skeleton({
  loading = false,
  children,
  rows = 3,
  avatar = false,
  title = true,
  paragraph = true,
  active = true,
  customSkeleton,
  style,
}: SkeletonProps) {
  if (customSkeleton) {
    return <>{loading ? customSkeleton : children}</>;
  }

  return (
    <AntSkeleton
      loading={loading}
      active={active}
      avatar={avatar}
      title={title}
      paragraph={paragraph ? { rows } : false}
      style={style}
    >
      {children}
    </AntSkeleton>
  );
}

/**
 * CardSkeleton 卡片骨架�?
 *
 * 用于卡片列表加载状态�?
 */
export interface CardSkeletonProps {
  /** 卡片数量 */
  count?: number;
  /** 是否显示头像 */
  avatar?: boolean;
  /** 骨架屏行�?*/
  rows?: number;
  /** 栅格列数 */
  colSpan?: number;
}

export function CardSkeleton({
  count = 3,
  avatar = false,
  rows = 3,
  colSpan = 8,
}: CardSkeletonProps) {
  return (
    <Row gutter={16}>
      {Array.from({ length: count }).map((_, index) => (
        <Col key={index} span={colSpan}>
          <Card>
            <Skeleton loading avatar={avatar} rows={rows}>
              <div style={{ display: 'none' }}>Placeholder</div>
            </Skeleton>
          </Card>
        </Col>
      ))}
    </Row>
  );
}

/**
 * TableSkeleton 表格骨架�?
 *
 * 用于表格加载状态�?
 */
export interface TableSkeletonProps {
  /** 行数 */
  rows?: number;
  /** 列数 */
  columns?: number;
  /** 是否显示标题 */
  title?: boolean;
}

export function TableSkeleton({ rows = 5, columns = 4, title = true }: TableSkeletonProps) {
  return (
    <div style={{ padding: '24px' }}>
      {title && (
        <Skeleton loading rows={1} style={{ marginBottom: '16px' }}>
          <div style={{ display: 'none' }}>Placeholder</div>
        </Skeleton>
      )}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <Row key={rowIndex} gutter={16} style={{ marginBottom: '16px' }}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Col key={colIndex} span={24 / columns}>
              <Skeleton loading rows={1} active>
                <div style={{ display: 'none' }}>Placeholder</div>
              </Skeleton>
            </Col>
          ))}
        </Row>
      ))}
    </div>
  );
}

/**
 * FormSkeleton 表单骨架�?
 *
 * 用于表单加载状态�?
 */
export interface FormSkeletonProps {
  /** 字段数量 */
  fieldCount?: number;
  /** 是否显示标题 */
  title?: boolean;
  /** 是否显示按钮 */
  actions?: boolean;
}

export function FormSkeleton({ fieldCount = 4, title = true, actions = true }: FormSkeletonProps) {
  return (
    <div style={{ padding: '24px' }}>
      {title && (
        <Skeleton loading rows={1} style={{ marginBottom: '24px', width: '200px' }}>
          <div style={{ display: 'none' }}>Placeholder</div>
        </Skeleton>
      )}
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {Array.from({ length: fieldCount }).map((_, index) => (
          <div key={index}>
            <Skeleton loading rows={1} style={{ marginBottom: '8px', width: '100px' }}>
              <div style={{ display: 'none' }}>Label</div>
            </Skeleton>
            <Skeleton loading rows={1} active>
              <div style={{ display: 'none' }}>Input</div>
            </Skeleton>
          </div>
        ))}
        {actions && (
          <Skeleton loading rows={1} style={{ width: '200px' }}>
            <div style={{ display: 'none' }}>Buttons</div>
          </Skeleton>
        )}
      </Space>
    </div>
  );
}

/**
 * ListSkeleton 列表骨架�?
 *
 * 用于列表加载状态�?
 */
export interface ListSkeletonProps {
  /** 列表项数�?*/
  count?: number;
  /** 是否显示头像 */
  avatar?: boolean;
  /** 每项行数 */
  rows?: number;
}

export function ListSkeleton({ count = 5, avatar = true, rows = 2 }: ListSkeletonProps) {
  return (
    <List
      dataSource={Array.from({ length: count })}
      renderItem={() => (
        <List.Item>
          <Skeleton loading avatar={avatar} rows={rows} active>
            <List.Item.Meta
              avatar={<div style={{ display: 'none' }}>Avatar</div>}
              title={<div style={{ display: 'none' }}>Title</div>}
              description={<div style={{ display: 'none' }}>Description</div>}
            />
          </Skeleton>
        </List.Item>
      )}
    />
  );
}

/**
 * DescriptionSkeleton 描述列表骨架�?
 *
 * 用于详情页加载状态�?
 */
export interface DescriptionSkeletonProps {
  /** 项数 */
  count?: number;
  /** 列数 */
  column?: number;
}

export function DescriptionSkeleton({ count = 4, column = 1 }: DescriptionSkeletonProps) {
  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={[16, 16]}>
        {Array.from({ length: count }).map((_, index) => (
          <Col key={index} span={24 / column}>
            <Space size={8}>
              <Skeleton loading rows={1} style={{ width: '80px' }}>
                <div style={{ display: 'none' }}>Label</div>
              </Skeleton>
              <Skeleton loading rows={1} style={{ width: '200px' }}>
                <div style={{ display: 'none' }}>Value</div>
              </Skeleton>
            </Space>
          </Col>
        ))}
      </Row>
    </div>
  );
}

/**
 * StatisticSkeleton 统计数字骨架�?
 *
 * 用于统计卡片加载状态�?
 */
export interface StatisticSkeletonProps {
  /** 卡片数量 */
  count?: number;
}

export function StatisticSkeleton({ count = 4 }: StatisticSkeletonProps) {
  return (
    <Row gutter={16}>
      {Array.from({ length: count }).map((_, index) => (
        <Col key={index} span={6}>
          <Card>
            <Skeleton loading rows={1} style={{ marginBottom: '12px', width: '60px' }}>
              <div style={{ display: 'none' }}>Label</div>
            </Skeleton>
            <Skeleton loading rows={1} style={{ width: '120px' }}>
              <div style={{ display: 'none' }}>Value</div>
            </Skeleton>
          </Card>
        </Col>
      ))}
    </Row>
  );
}

/**
 * ImageSkeleton 图片骨架�?
 *
 * 用于图片加载状态�?
 */
export interface ImageSkeletonProps {
  /** 宽度 */
  width?: number | string;
  /** 高度 */
  height?: number | string;
  /** 是否显示 */
  loading?: boolean;
  /** 子组�?*/
  children?: ReactNode;
}

export function ImageSkeleton({ width = '100%', height = 200, loading = false, children }: ImageSkeletonProps) {
  if (!loading) {
    return <>{children}</>;
  }

  return (
    <div
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-loading 1.5s infinite',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <style>
        {`
          @keyframes skeleton-loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}
      </style>
    </div>
  );
}

export default Skeleton;
