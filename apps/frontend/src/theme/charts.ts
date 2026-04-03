export const CHART_COLORS = {
  primary: ['#f59e0b', '#fb923c'],
  secondary: ['#10b981', '#059669'],
  accent: ['#ef4444', '#f97316'],
  teal: ['#14b8a6', '#0d9488'],
  neutral: ['#94a3b8', '#64748b'],
  amber: ['#fbbf24', '#f59e0b'],
  lime: ['#84cc16', '#65a30d'],
};

export const CHART_PALETTE = [
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#14b8a6',
  '#fbbf24',
  '#84cc16',
  '#f97316',
  '#059669',
];

export const CHART_GRADIENTS = {
  orange: ['#fbbf24', '#f59e0b'],
  green: ['#34d399', '#10b981'],
  red: ['#fb7185', '#ef4444'],
  teal: ['#2dd4bf', '#14b8a6'],
  amber: ['#fcd34d', '#fbbf24'],
};

export const createGradient = (ctx: CanvasRenderingContext2D, colors: string[], y0: number, y1: number) => {
  const gradient = ctx.createLinearGradient(0, y0, 0, y1);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);
  return gradient;
};

export const ECHARTS_THEME = {
  color: CHART_PALETTE,
  backgroundColor: 'transparent',
  textStyle: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  title: {
    textStyle: {
      color: '#1f2937',
      fontWeight: 600,
    },
  },
  legend: {
    textStyle: {
      color: '#4b5563',
    },
  },
  tooltip: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderColor: '#e5e7eb',
    borderWidth: 1,
    textStyle: {
      color: '#1f2937',
    },
    extraCssText: 'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); border-radius: 8px;',
  },
  categoryAxis: {
    axisLine: {
      lineStyle: {
        color: '#e5e7eb',
      },
    },
    axisTick: {
      lineStyle: {
        color: '#e5e7eb',
      },
    },
    axisLabel: {
      color: '#6b7280',
    },
    splitLine: {
      lineStyle: {
        color: '#f3f4f6',
      },
    },
  },
  valueAxis: {
    axisLine: {
      lineStyle: {
        color: '#e5e7eb',
      },
    },
    axisTick: {
      lineStyle: {
        color: '#e5e7eb',
      },
    },
    axisLabel: {
      color: '#6b7280',
    },
    splitLine: {
      lineStyle: {
        color: '#f3f4f6',
        type: 'dashed',
      },
    },
  },
};

export const createBarSeries = (data: number[], colorIndex = 0) => {
  const color = CHART_PALETTE[colorIndex % CHART_PALETTE.length];
  return {
    type: 'bar' as const,
    data,
    itemStyle: {
      color,
      borderRadius: [6, 6, 0, 0],
    },
    emphasis: {
      itemStyle: {
        shadowBlur: 10,
        shadowColor: 'rgba(0, 0, 0, 0.15)',
      },
    },
    animationDuration: 800,
    animationEasing: 'cubicOut' as const,
  };
};

export const createLineSeries = (data: number[], colorIndex = 0, name?: string) => {
  const color = CHART_PALETTE[colorIndex % CHART_PALETTE.length];
  return {
    name,
    type: 'line' as const,
    data,
    smooth: true,
    symbol: 'circle',
    symbolSize: 8,
    lineStyle: {
      width: 3,
      color,
    },
    itemStyle: {
      color,
      borderWidth: 2,
      borderColor: '#fff',
    },
    areaStyle: {
      color: {
        type: 'linear',
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color: `${color}40` },
          { offset: 1, color: `${color}05` },
        ],
      },
    },
    emphasis: {
      focus: 'series' as const,
      itemStyle: {
        shadowBlur: 10,
        shadowColor: color,
      },
    },
    animationDuration: 1000,
    animationEasing: 'cubicOut' as const,
  };
};

export const createPieSeries = (data: Array<{ name: string; value: number }>) => {
  return {
    type: 'pie' as const,
    data,
    radius: ['40%', '70%'],
    itemStyle: {
      borderRadius: 8,
      borderColor: '#fff',
      borderWidth: 2,
    },
    label: {
      show: true,
      color: '#4b5563',
    },
    emphasis: {
      itemStyle: {
        shadowBlur: 20,
        shadowColor: 'rgba(0, 0, 0, 0.15)',
      },
    },
    animationType: 'scale' as const,
    animationDuration: 800,
    animationEasing: 'cubicOut' as const,
  };
};

export const getDefaultGrid = () => ({
  left: 24,
  right: 24,
  top: 40,
  bottom: 32,
  containLabel: true,
});

export const getDefaultTooltip = () => ({
  trigger: 'axis' as const,
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  borderColor: '#e5e7eb',
  borderWidth: 1,
  textStyle: {
    color: '#1f2937',
  },
  extraCssText: 'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); border-radius: 8px;',
});
