import type { ECharts, EChartsOption } from 'echarts';
import { useEffect, useRef } from 'react';

type ChartPanelProps = {
  option: EChartsOption;
  height?: number;
  className?: string;
};

export const ChartPanel = ({ option, height = 260, className }: ChartPanelProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<ECharts | null>(null);
  const optionRef = useRef(option);

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | null = null;
    let handleResize: (() => void) | null = null;
    let instance: ECharts | null = null;

    const initChart = async () => {
      if (!containerRef.current) {
        return;
      }

      const echarts = await import('echarts');

      if (disposed || !containerRef.current) {
        return;
      }

      instance = echarts.init(containerRef.current);
      instanceRef.current = instance;
      instance.setOption(optionRef.current, true);

      handleResize = () => instance?.resize();
      window.addEventListener('resize', handleResize);

      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => instance?.resize());
        observer.observe(containerRef.current);
      }

      requestAnimationFrame(() => instance?.resize());
    };

    void initChart();

    return () => {
      disposed = true;
      if (handleResize) {
        window.removeEventListener('resize', handleResize);
      }
      observer?.disconnect();
      instance?.dispose();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    optionRef.current = option;
    if (!instanceRef.current) {
      return;
    }
    instanceRef.current.setOption(option, true);
    requestAnimationFrame(() => instanceRef.current?.resize());
  }, [option]);

  const classes = className ? `chart-panel ${className}` : 'chart-panel';

  return <div ref={containerRef} className={classes} style={{ width: '100%', height, overflow: 'hidden' }} />;
};
