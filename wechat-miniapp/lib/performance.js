const config = require('./config');

class PerformanceMonitor {
  constructor() {
    this.metrics = {};
    this.maxMetrics = 100;
  }

  startTimer(name) {
    if (!this.metrics[name]) {
      this.metrics[name] = {
        startTime: Date.now(),
        records: []
      };
    } else {
      this.metrics[name].startTime = Date.now();
    }
  }

  endTimer(name) {
    if (!this.metrics[name]) return null;

    const duration = Date.now() - this.metrics[name].startTime;
    this.metrics[name].records.push({
      duration,
      timestamp: Date.now()
    });

    if (this.metrics[name].records.length > this.maxMetrics) {
      this.metrics[name].records.shift();
    }

    return duration;
  }

  recordPageLoad(pageName, duration) {
    if (!this.metrics[pageName]) {
      this.metrics[pageName] = { records: [] };
    }
    this.metrics[pageName].records.push({
      type: 'pageLoad',
      duration,
      timestamp: Date.now()
    });

    if (this.metrics[pageName].records.length > this.maxMetrics) {
      this.metrics[pageName].records.shift();
    }
  }

  recordApiRequest(apiName, duration, success) {
    if (!this.metrics[apiName]) {
      this.metrics[apiName] = { records: [] };
    }
    this.metrics[apiName].records.push({
      type: 'apiRequest',
      duration,
      success,
      timestamp: Date.now()
    });

    if (this.metrics[apiName].records.length > this.maxMetrics) {
      this.metrics[apiName].records.shift();
    }
  }

  getMetrics(name) {
    return this.metrics[name] || null;
  }

  getAllMetrics() {
    return this.metrics;
  }

  clearMetrics() {
    this.metrics = {};
  }

  async report() {
    try {
      await wx.request({
        url: `${config.apiBaseUrl}/performance/report`,
        method: 'POST',
        data: this.metrics
      });
      this.clearMetrics();
    } catch (error) {
      console.error('Performance report failed:', error);
    }
  }
}

module.exports = new PerformanceMonitor();
