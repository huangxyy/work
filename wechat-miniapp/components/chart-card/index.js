Component({
  properties: {
    canvasId: {
      type: String,
      value: 'chart'
    },
    width: {
      type: Number,
      value: 650
    },
    height: {
      type: Number,
      value: 300
    },
    title: {
      type: String,
      value: ''
    },
    type: {
      type: String,
      value: 'line' // line | bar
    },
    data: {
      type: Array,
      value: []
    },
    legend: {
      type: Array,
      value: []
    },
    colors: {
      type: Array,
      value: ['#0891b2', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
    }
  },

  observers: {
    'data': function(newData) {
      if (newData && newData.length > 0) {
        this.drawChart();
      }
    }
  },

  methods: {
    async drawChart() {
      const { type, data, colors, canvasId, width, height } = this.properties;

      try {
        const query = this.createSelectorQuery();
        const res = await new Promise((resolve, reject) => {
          query.select(`#${canvasId}`)
            .fields({ node: true, size: true })
            .exec((result) => {
              if (result && result[0]) {
                resolve(result[0]);
              } else {
                reject(new Error('Canvas not found'));
              }
            });
        });

        const canvas = res.node;
        const ctx = canvas.getContext('2d');

        const systemInfo = wx.getWindowInfo();
        const dpr = systemInfo.pixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, width, height);

        if (!data || data.length === 0) return;

        const padding = { top: 20, right: 20, bottom: 40, left: 50 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        const values = data.map(item => item.value);
        const maxValue = Math.max(...values) || 100;
        const minValue = Math.min(...values) || 0;
        const range = maxValue - minValue || 1;

        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;

        const gridCount = 5;
        for (let i = 0; i <= gridCount; i++) {
          const y = padding.top + (chartHeight / gridCount) * i;
          ctx.beginPath();
          ctx.moveTo(padding.left, y);
          ctx.lineTo(padding.left + chartWidth, y);
          ctx.stroke();

          const value = maxValue - (range / gridCount) * i;
          ctx.fillStyle = '#9ca3af';
          ctx.font = '20px sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(Math.round(value), padding.left - 10, y + 6);
        }

        if (type === 'line') {
          this.drawLineChart(ctx, data, padding, chartWidth, chartHeight, minValue, range, colors[0]);
        } else if (type === 'bar') {
          this.drawBarChart(ctx, data, padding, chartWidth, chartHeight, minValue, range, colors);
        }

        const step = chartWidth / (data.length - 1 || 1);
        data.forEach((item, index) => {
          let x;
          if (type === 'line') {
            x = padding.left + step * index;
          } else {
            x = padding.left + (chartWidth / data.length) * index + (chartWidth / data.length / 2);
          }

          ctx.fillStyle = '#6b7280';
          ctx.font = '20px sans-serif';
          ctx.textAlign = 'center';

          let label = item.label;
          if (label.length > 6) {
            label = label.substring(0, 6) + '..';
          }
          ctx.fillText(label, x, height - 10);
        });
      } catch (error) {
        console.error('绘制图表失败:', error);
      }
    },

    drawLineChart(ctx, data, padding, chartWidth, chartHeight, minValue, range, color) {
      const step = chartWidth / (data.length - 1 || 1);

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;

      data.forEach((item, index) => {
        const x = padding.left + step * index;
        const y = padding.top + chartHeight - ((item.value - minValue) / range) * chartHeight;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      data.forEach((item, index) => {
        const x = padding.left + step * index;
        const y = padding.top + chartHeight - ((item.value - minValue) / range) * chartHeight;

        ctx.beginPath();
        ctx.fillStyle = '#ffffff';
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fill();

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.stroke();
      });

      data.forEach((item, index) => {
        const x = padding.left + step * index;
        const y = padding.top + chartHeight - ((item.value - minValue) / range) * chartHeight;

        ctx.fillStyle = color;
        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(item.value, x, y - 15);
      });
    },

    drawBarChart(ctx, data, padding, chartWidth, chartHeight, minValue, range, colors) {
      const barWidth = (chartWidth / data.length) * 0.6;
      const gap = (chartWidth / data.length) * 0.4;

      data.forEach((item, index) => {
        const x = padding.left + (chartWidth / data.length) * index + gap / 2;
        const barHeight = ((item.value - minValue) / range) * chartHeight;
        const y = padding.top + chartHeight - barHeight;

        const color = colors[index % colors.length];
        ctx.fillStyle = color;
        ctx.fillRect(x, y, barWidth, barHeight);

        ctx.fillStyle = '#333';
        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(item.value, x + barWidth / 2, y - 8);
      });
    }
  }
});
