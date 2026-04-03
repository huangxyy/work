import type { ECharts, EChartsOption } from 'echarts';
import { memo, useEffect, useRef } from 'react';
import { ECHARTS_THEME } from '../theme/charts';

type ChartPanelProps = {
  option: EChartsOption;
  height?: number;
  className?: string;
  theme?: 'light' | 'dark';
};

export const ChartPanel = memo(({ option, height = 260, className, theme = 'light' }: ChartPanelProps) => {
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

      instance = echarts.init(containerRef.current, theme === 'dark' ? 'dark' : undefined);
      instanceRef.current = instance;
      
      instance.setOption({
        ...ECHARTS_THEME,
        ...optionRef.current,
      }, true);

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
  }, [theme]);

  useEffect(() => {
    optionRef.current = option;
    if (!instanceRef.current) {
      return;
    }
    instanceRef.current.setOption({
      ...ECHARTS_THEME,
      ...option,
    }, true);
    requestAnimationFrame(() => instanceRef.current?.resize());
  }, [option, theme]);

  const classes = className ? `chart-panel ${className}` : 'chart-panel';

  return <div ref={containerRef} className={classes} style={{ width: '100%', height, overflow: 'hidden' }} />;
});
