const CHART_COLORS = [
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#14b8a6',
  '#fbbf24',
  '#84cc16',
  '#f97316',
  '#059669',
];

function getPixelRatio() {
  try {
    const deviceInfo = wx.getDeviceInfo();
    return deviceInfo.pixelRatio || 1;
  } catch (e) {
    return 1;
  }
}

const dpr = getPixelRatio();

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawBarChart(ctx, data, width, height, colors, animate = true) {
  if (!data || data.length === 0) return;

  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(...data.map(d => d.value || 0), 1);
  const barWidth = Math.min(40, (chartWidth / data.length) * 0.6);
  const gap = (chartWidth - barWidth * data.length) / (data.length + 1);

  ctx.save();
  ctx.font = '10px -apple-system, sans-serif';
  ctx.fillStyle = '#6b7280';
  ctx.textAlign = 'right';

  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartHeight / 4) * i;
    const value = Math.round(maxValue * (1 - i / 4));
    ctx.fillText(String(value), padding.left - 8, y + 4);

    ctx.beginPath();
    ctx.strokeStyle = '#f3f4f6';
    ctx.setLineDash([4, 4]);
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  data.forEach((item, index) => {
    const x = padding.left + gap + (barWidth + gap) * index;
    const barHeight = (item.value / maxValue) * chartHeight;
    const y = padding.top + chartHeight - barHeight;

    const color = colors[index % colors.length];
    const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, color + 'cc');

    ctx.fillStyle = gradient;
    drawRoundedRect(ctx, x, y, barWidth, barHeight, 4);
    ctx.fill();

    ctx.shadowColor = color + '40';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    drawRoundedRect(ctx, x, y, barWidth, barHeight, 4);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillStyle = '#4b5563';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    const label = item.label || '';
    const displayLabel = label.length > 5 ? label.slice(0, 5) + '...' : label;
    ctx.fillText(displayLabel, x + barWidth / 2, height - padding.bottom + 16);
  });

  ctx.restore();
}

function drawLineChart(ctx, data, width, height, colors, animate = true) {
  if (!data || data.length === 0) return;

  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(...data.map(d => d.value || 0), 1);
  const pointGap = chartWidth / (data.length - 1 || 1);

  ctx.save();
  ctx.font = '10px -apple-system, sans-serif';
  ctx.fillStyle = '#6b7280';
  ctx.textAlign = 'right';

  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartHeight / 4) * i;
    const value = Math.round(maxValue * (1 - i / 4));
    ctx.fillText(String(value), padding.left - 8, y + 4);

    ctx.beginPath();
    ctx.strokeStyle = '#f3f4f6';
    ctx.setLineDash([4, 4]);
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const points = data.map((item, index) => ({
    x: padding.left + pointGap * index,
    y: padding.top + chartHeight - (item.value / maxValue) * chartHeight,
  }));

  const color = colors[0];
  const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
  gradient.addColorStop(0, color + '40');
  gradient.addColorStop(1, color + '05');

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const xc = (points[i - 1].x + points[i].x) / 2;
    const yc = (points[i - 1].y + points[i].y) / 2;
    ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.lineTo(points[points.length - 1].x, padding.top + chartHeight);
  ctx.lineTo(points[0].x, padding.top + chartHeight);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const xc = (points[i - 1].x + points[i].x) / 2;
    const yc = (points[i - 1].y + points[i].y) / 2;
    ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  points.forEach((point, index) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  data.forEach((item, index) => {
    ctx.fillStyle = '#4b5563';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    const label = item.label || '';
    const displayLabel = label.length > 5 ? label.slice(0, 5) + '...' : label;
    ctx.fillText(displayLabel, points[index].x, height - padding.bottom + 16);
  });

  ctx.restore();
}

function drawPieChart(ctx, data, width, height, colors) {
  if (!data || data.length === 0) return;

  const centerX = width / 2;
  const centerY = height / 2 - 10;
  const radius = Math.min(width, height) / 2 - 40;
  const innerRadius = radius * 0.5;

  const total = data.reduce((sum, item) => sum + (item.value || 0), 0) || 1;
  let startAngle = -Math.PI / 2;

  data.forEach((item, index) => {
    const angle = ((item.value || 0) / total) * Math.PI * 2;
    const endAngle = startAngle + angle;
    const color = colors[index % colors.length];

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fill();
    ctx.shadowColor = 'transparent';

    const midAngle = startAngle + angle / 2;
    const labelRadius = radius + 20;
    const labelX = centerX + Math.cos(midAngle) * labelRadius;
    const labelY = centerY + Math.sin(midAngle) * labelRadius;

    ctx.fillStyle = '#4b5563';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = midAngle > Math.PI / 2 && midAngle < Math.PI * 1.5 ? 'right' : 'left';
    const label = item.label || '';
    const displayLabel = label.length > 6 ? label.slice(0, 6) + '...' : label;
    ctx.fillText(`${displayLabel} ${Math.round((item.value / total) * 100)}%`, labelX, labelY);

    startAngle = endAngle;
  });

  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 16px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(total), centerX, centerY + 6);
}

Component({
  properties: {
    canvasId: {
      type: String,
      value: 'chart',
    },
    width: {
      type: Number,
      value: 300,
    },
    height: {
      type: Number,
      value: 200,
    },
    title: {
      type: String,
      value: '',
    },
    type: {
      type: String,
      value: 'bar',
    },
    data: {
      type: Array,
      value: [],
    },
    colors: {
      type: Array,
      value: CHART_COLORS,
    },
    legend: {
      type: Array,
      value: [],
    },
  },

  data: {
    chartWidth: 300,
    chartHeight: 200,
  },

  lifetimes: {
    attached() {
      try {
        const deviceInfo = wx.getDeviceInfo();
        const pixelRatio = deviceInfo.pixelRatio || 1;
        this.setData({
          chartWidth: this.properties.width * pixelRatio,
          chartHeight: this.properties.height * pixelRatio,
        });
      } catch (e) {
        this.setData({
          chartWidth: this.properties.width,
          chartHeight: this.properties.height,
        });
      }
      this.drawChart();
    },
  },

  observers: {
    'data, type, colors': function() {
      this.drawChart();
    },
  },

  methods: {
    drawChart() {
      const { canvasId, type, data, colors, width, height } = this.properties;

      if (!data || data.length === 0) {
        return;
      }

      const query = this.createSelectorQuery();
      query.select(`#${canvasId}`)
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) {
            return;
          }

          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');

          canvas.width = width * dpr;
          canvas.height = height * dpr;
          ctx.scale(dpr, dpr);

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);

          const chartColors = colors.length > 0 ? colors : CHART_COLORS;

          switch (type) {
            case 'bar':
              drawBarChart(ctx, data, width, height, chartColors);
              break;
            case 'line':
              drawLineChart(ctx, data, width, height, chartColors);
              break;
            case 'pie':
              drawPieChart(ctx, data, width, height, chartColors);
              break;
            default:
              drawBarChart(ctx, data, width, height, chartColors);
          }
        });
    },
  },
});
