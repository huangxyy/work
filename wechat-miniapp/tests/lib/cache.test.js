const cache = require('../../lib/cache');

describe('CacheManager', () => {
  beforeEach(() => {
    cache.clear();
  });

  test('should set and get cache', () => {
    const data = { id: 1, name: 'test' };
    cache.set('test_key', data);
    const result = cache.get('test_key');
    expect(result).toEqual(data);
  });

  test('should return null for non-existent cache', () => {
    const result = cache.get('non_existent_key');
    expect(result).toBeNull();
  });

  test('should return null for expired cache', (done) => {
    const data = { id: 1, name: 'test' };
    cache.set('test_key', data, 100);
    
    setTimeout(() => {
      const result = cache.get('test_key');
      expect(result).toBeNull();
      done();
    }, 150);
  });

  test('should remove cache', () => {
    const data = { id: 1, name: 'test' };
    cache.set('test_key', data);
    cache.remove('test_key');
    const result = cache.get('test_key');
    expect(result).toBeNull();
  });

  test('should clear all cache', () => {
    cache.set('key1', { id: 1 });
    cache.set('key2', { id: 2 });
    cache.clear();
    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key2')).toBeNull();
  });

  test('should get cache size', () => {
    cache.set('key1', { id: 1 });
    cache.set('key2', { id: 2 });
    const size = cache.getCacheSize();
    expect(size).toBe(2);
  });

  test('should handle complex data types', () => {
    const data = {
      id: 1,
      name: 'test',
      items: [1, 2, 3],
      nested: { a: 'b' }
    };
    cache.set('complex_key', data);
    const result = cache.get('complex_key');
    expect(result).toEqual(data);
  });
});
