class CacheManager {
  constructor() {
    this.cachePrefix = 'teacher_cache_';
    this.defaultExpire = 5 * 60 * 1000;
  }

  set(key, data, expire = this.defaultExpire) {
    const cacheData = {
      data,
      timestamp: Date.now(),
      expire
    };
    try {
      wx.setStorageSync(this.cachePrefix + key, cacheData);
      return true;
    } catch (error) {
      console.error('Cache set failed:', error);
      return false;
    }
  }

  get(key) {
    try {
      const cacheData = wx.getStorageSync(this.cachePrefix + key);
      if (!cacheData) return null;

      if (Date.now() - cacheData.timestamp > cacheData.expire) {
        this.remove(key);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.error('Cache get failed:', error);
      return null;
    }
  }

  remove(key) {
    try {
      wx.removeStorageSync(this.cachePrefix + key);
      return true;
    } catch (error) {
      console.error('Cache remove failed:', error);
      return false;
    }
  }

  clear() {
    try {
      const res = wx.getStorageInfoSync();
      res.keys.forEach(key => {
        if (key.startsWith(this.cachePrefix)) {
          wx.removeStorageSync(key);
        }
      });
      return true;
    } catch (error) {
      console.error('Cache clear failed:', error);
      return false;
    }
  }

  getCacheSize() {
    try {
      const res = wx.getStorageInfoSync();
      const cacheKeys = res.keys.filter(key => key.startsWith(this.cachePrefix));
      return cacheKeys.length;
    } catch (error) {
      console.error('Get cache size failed:', error);
      return 0;
    }
  }
}

module.exports = new CacheManager();
