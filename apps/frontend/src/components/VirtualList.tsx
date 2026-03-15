import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Spin } from 'antd';
import { SoftEmpty } from './SoftEmpty';

/**
 * VirtualList Props
 *
 * @template T - 数据项类型
 */
export interface VirtualListProps<T> {
  /** 数据源 */
  data: T[];
  /** 渲染每一项的函数 */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** 估算的项目高度 (px)，用于计算虚拟滚动位置 */
  estimatedItemHeight?: number;
  /** 容器高度 (px) */
  height?: number | string;
  /** 是否正在加载 */
  loading?: boolean;
  /** 加载更多回调 */
  onLoadMore?: () => void;
  /** 是否还有更多数据 */
  hasMore?: boolean;
  /** 列表的唯一标识，用于保存滚动位置 */
  listKey?: string;
  /** 空状态描述 */
  emptyDescription?: string;
  /** 自定义空状态 */
  customEmpty?: React.ReactNode;
  /** 额外的 CSS 类名 */
  className?: string;
  /** 额外的样式 */
  style?: React.CSSProperties;
}

/**
 * 计算可见范围
 */
function calculateVisibleRange(
  scrollTop: number,
  containerHeight: number,
  itemHeight: number,
  totalItems: number,
  overscan: number = 3,
): { startIndex: number; endIndex: number; offsetY: number } {
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const endIndex = Math.min(totalItems, startIndex + visibleCount + overscan * 2);
  const offsetY = startIndex * itemHeight;

  return { startIndex, endIndex, offsetY };
}

/**
 * VirtualList 虚拟滚动列表组件
 *
 * 用于高效渲染大量数据的列表组件，只渲染可见区域的项目。
 *
 * @example
 * ```tsx
 * <VirtualList
 *   data={items}
 *   renderItem={(item) => <div>{item.name}</div>}
 *   estimatedItemHeight={60}
 *   height={500}
 *   loading={loading}
 *   hasMore={hasMore}
 *   onLoadMore={loadMore}
 * />
 * ```
 */
export function VirtualList<T>({
  data,
  renderItem,
  estimatedItemHeight = 60,
  height = '100%',
  loading = false,
  onLoadMore,
  hasMore = true,
  listKey,
  emptyDescription,
  customEmpty,
  className = '',
  style,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);

  // 更新容器高度
  useEffect(() => {
    if (containerRef.current) {
      const updateHeight = () => {
        setContainerHeight(containerRef.current?.offsetHeight || 400);
      };
      updateHeight();
      const resizeObserver = new ResizeObserver(updateHeight);
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  // 计算可见范围
  const { startIndex, endIndex, offsetY } = useMemo(() => {
    return calculateVisibleRange(scrollTop, containerHeight, estimatedItemHeight, data.length);
  }, [scrollTop, containerHeight, estimatedItemHeight, data.length]);

  // 可见数据
  const visibleData = useMemo(() => {
    return data.slice(startIndex, endIndex);
  }, [data, startIndex, endIndex]);

  // 总高度
  const totalHeight = useMemo(() => {
    return data.length * estimatedItemHeight;
  }, [data.length, estimatedItemHeight]);

  // 滚动事件处理
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement;
      const newScrollTop = target.scrollTop;
      setScrollTop(newScrollTop);

      // 保存滚动位置
      if (listKey) {
        sessionStorage.setItem(
          `virtual-scroll-${listKey}`,
          JSON.stringify({ scrollTop: newScrollTop, timestamp: Date.now() }),
        );
      }

      // 触发加载更多
      const scrollHeight = target.scrollHeight;
      const clientHeight = target.clientHeight;
      if (
        onLoadMore &&
        hasMore &&
        !loading &&
        scrollHeight - newScrollTop - clientHeight < estimatedItemHeight * 3
      ) {
        onLoadMore();
      }
    },
    [onLoadMore, hasMore, loading, estimatedItemHeight, listKey],
  );

  // 恢复滚动位置
  useEffect(() => {
    if (listKey && containerRef.current) {
      try {
        const saved = sessionStorage.getItem(`virtual-scroll-${listKey}`);
        if (saved) {
          const { scrollTop: savedScrollTop, timestamp } = JSON.parse(saved);
          // 只恢复 30 分钟内的滚动位置
          if (Date.now() - timestamp < 30 * 60 * 1000) {
            containerRef.current.scrollTop = savedScrollTop;
          }
        }
      } catch {
        // 忽略解析错误
      }
    }
  }, [listKey]);

  // 空状态
  if (!loading && data.length === 0) {
    return customEmpty || <SoftEmpty description={emptyDescription} />;
  }

  return (
    <div
      ref={containerRef}
      className={`virtual-list-container ${className}`}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        overflow: 'auto',
        position: 'relative',
        ...style,
      }}
      onScroll={handleScroll}
    >
      {/* 占位容器 */}
      <div
        style={{
          height: totalHeight,
          position: 'relative',
        }}
      >
        {/* 可见项目 */}
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleData.map((item, index) => (
            <div
              key={(item as { id?: string })?.id || startIndex + index}
              style={{
                height: estimatedItemHeight,
              }}
            >
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>

      {/* 加载更多指示器 */}
      {hasMore && loading && (
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <Spin size="small" />
        </div>
      )}

      {/* 没有更多数据提示 */}
      {!hasMore && data.length > 0 && (
        <div style={{ padding: '16px', textAlign: 'center', color: '#999', fontSize: '12px' }}>
          已加载全部数据
        </div>
      )}
    </div>
  );
}

/**
 * FixedSizeVirtualList 固定项目大小的虚拟列表
 *
 * 当所有项目高度固定时使用，性能更好。
 */
export interface FixedSizeVirtualListProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight: number;
  height?: number | string;
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  listKey?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function FixedSizeVirtualList<T>({
  data,
  renderItem,
  itemHeight,
  height = 400,
  loading = false,
  onLoadMore,
  hasMore = true,
  listKey,
  className = '',
  style,
}: FixedSizeVirtualListProps<T>) {
  return (
    <VirtualList
      data={data}
      renderItem={renderItem}
      estimatedItemHeight={itemHeight}
      height={height}
      loading={loading}
      onLoadMore={onLoadMore}
      hasMore={hasMore}
      listKey={listKey}
      className={className}
      style={style}
    />
  );
}

export default VirtualList;
