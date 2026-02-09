import type { EChartsOption } from 'echarts';
import * as echarts from 'echarts';
import { useEffect, useRef } from 'react';

type ChartPanelProps = {
  option: EChartsOption;
  height?: number;
  className?: string;
};

export const ChartPanel = ({ option, height = 260, className }: ChartPanelProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }
    const instance = echarts.init(containerRef.current);
    instanceRef.current = instance;
    const handleResize = () => instance.resize();
    window.addEventListener('resize', handleResize);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => instance.resize());
      observer.observe(containerRef.current);
    }
    return () => {
      window.removeEventListener('resize', handleResize);
      observer?.disconnect();
      instance.dispose();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!instanceRef.current) {
      return;
    }
    instanceRef.current.setOption(option, true);
    requestAnimationFrame(() => instanceRef.current?.resize());
  }, [option]);

  const classes = className ? `chart-panel ${className}` : 'chart-panel';

  return <div ref={containerRef} className={classes} style={{ width: '100%', height, overflow: 'hidden' }} />;
};
