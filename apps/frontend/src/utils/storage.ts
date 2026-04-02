/**
 * 本地存储工具
 *
 * 封装 localStorage 和 sessionStorage 操作，提供类型安全的存储 API。
 */

import type { AuthUser } from '../api/client';

/**
 * 存储类型
 */
export type StorageType = 'localStorage' | 'sessionStorage';

/**
 * 存储项配置
 */
interface StorageItemConfig<T> {
  /** 存储键 */
  key: string;
  /** 默认值 */
  defaultValue: T;
  /** 是否序列化（默认 JSON） */
  serialize?: boolean;
  /** 存储类型 */
  storageType?: StorageType;
}

/**
 * 获取存储对象
 */
function getStorage(storageType: StorageType = 'localStorage'): Storage {
  if (typeof window === 'undefined') {
    // SSR 环境返回模拟存储
    return {
      length: 0,
      clear: () => {},
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      key: () => null,
    } as unknown as Storage;
  }

  return storageType === 'localStorage' ? window.localStorage : window.sessionStorage;
}

/**
 * 反序列化值
 */
function deserialize<T>(value: string | null): T | null {
  if (value === null) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return value as unknown as T;
  }
}

/**
 * 创建存储项 Hook
 *
 * @param config 存储项配置
 * @returns 存储操作方法
 *
 * @example
 * ```ts
 * const authStorage = createStorageItem<string>({
 *   key: 'auth_token',
 *   defaultValue: '',
 * });
 *
 * // 设置值
 * authStorage.set('token-value');
 *
 * // 获取值
 * const token = authStorage.get();
 *
 * // 删除值
 * authStorage.remove();
 * ```
 */
export function createStorageItem<T>(config: StorageItemConfig<T>) {
  const {
    key,
    defaultValue,
    serialize = true,
    storageType = 'localStorage',
  } = config;

  const storage = getStorage(storageType);

  return {
    /**
     * 获取存储值
     */
    get(): T {
      const value = storage.getItem(key);
      if (value === null) {
        return defaultValue;
      }

      if (serialize) {
        return deserialize<T>(value) ?? defaultValue;
      }

      return value as unknown as T;
    },

    /**
     * 设置存储值
     */
    set(value: T): void {
      const serialized = serialize ? JSON.stringify(value) : (value as string);
      storage.setItem(key, serialized);
    },

    /**
     * 删除存储值
     */
    remove(): void {
      storage.removeItem(key);
    },

    /**
     * 检查存储值是否存在
     */
    has(): boolean {
      return storage.getItem(key) !== null;
    },

    /**
     * 监听存储变化（仅在同一窗口的其他标签页有效）
     */
    onChange(callback: (newValue: T, oldValue: T) => void): () => void {
      const handler = (e: StorageEvent) => {
        if (e.key === key && e.newValue !== e.oldValue) {
          const newValue = deserialize<T>(e.newValue) ?? defaultValue;
          const oldValue = deserialize<T>(e.oldValue) ?? defaultValue;
          callback(newValue, oldValue);
        }
      };

      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    },
  };
}

/**
 * 存储工具类
 */
export class StorageItem<T = unknown> {
  constructor(
    private key: string,
    private defaultValue: T,
    private options: {
      serialize?: boolean;
      storageType?: StorageType;
    } = {},
  ) {}

  /**
   * 获取存储值
   */
  get(): T {
    return createStorageItem({
      key: this.key,
      defaultValue: this.defaultValue,
      ...this.options,
    }).get();
  }

  /**
   * 设置存储值
   */
  set(value: T): void {
    createStorageItem({
      key: this.key,
      defaultValue: this.defaultValue,
      ...this.options,
    }).set(value);
  }

  /**
   * 删除存储值
   */
  remove(): void {
    createStorageItem({
      key: this.key,
      defaultValue: this.defaultValue,
      ...this.options,
    }).remove();
  }

  /**
   * 检查存储值是否存在
   */
  has(): boolean {
    return createStorageItem({
      key: this.key,
      defaultValue: this.defaultValue,
      ...this.options,
    }).has();
  }
}

/**
 * 预定义的存储项
 */

// 认证相关
export const authTokenStorage = createStorageItem<string>({
  key: 'auth_token',
  defaultValue: '',
});

export const authUserStorage = createStorageItem<{
  id: string;
  account: string;
  name: string;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
  email?: string | null;
  phone?: string | null;
}>({
  key: 'auth_user',
  defaultValue: null as AuthUser | null,
});

// 用户偏好
export const themeStorage = createStorageItem<'light' | 'dark' | 'auto'>({
  key: 'theme',
  defaultValue: 'auto',
});

export const languageStorage = createStorageItem<'zh' | 'en'>({
  key: 'language',
  defaultValue: 'zh',
});

export const sidebarCollapsedStorage = createStorageItem<boolean>({
  key: 'sidebar_collapsed',
  defaultValue: false,
});

// 页面状态
export const pageStateStorage = new StorageItem<Record<string, unknown>>('page_state', {}, {
  storageType: 'sessionStorage',
});

/**
 * 存储工具函数
 */

/**
 * 批量获取存储值
 */
export function getBatch<T extends Record<string, unknown>>(
  items: Array<{ key: string; defaultValue: T[keyof T] }>,
): Partial<T> {
  const result: Partial<T> = {};

  items.forEach(({ key, defaultValue }) => {
    result[key as keyof T] = createStorageItem({
      key,
      defaultValue,
    }).get();
  });

  return result;
}

/**
 * 批量设置存储值
 */
export function setBatch<T extends Record<string, unknown>>(
  items: Array<{ key: string; value: T[keyof T] }>,
): void {
  items.forEach(({ key, value }) => {
    createStorageItem({
      key,
      defaultValue: null as unknown as T[keyof T],
    }).set(value);
  });
}

/**
 * 清除所有存储（慎用）
 */
export function clearAll(storageType: StorageType = 'localStorage'): void {
  const storage = getStorage(storageType);
  storage.clear();
}

/**
 * 清除指定前缀的存储
 */
export function clearByPrefix(
  prefix: string,
  storageType: StorageType = 'localStorage',
): void {
  const storage = getStorage(storageType);

  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && key.startsWith(prefix)) {
      storage.removeItem(key);
    }
  }
}

/**
 * 获取存储大小（字节）
 */
export function getStorageSize(storageType: StorageType = 'localStorage'): number {
  const storage = getStorage(storageType);
  let size = 0;

  for (const key in storage) {
    if (Object.prototype.hasOwnProperty.call(storage, key)) {
      size += (storage[key] as string).length + key.length;
    }
  }

  return size;
}

/**
 * 导出所有存储数据（用于调试）
 */
export function exportStorage(storageType: StorageType = 'localStorage'): Record<string, string> {
  const storage = getStorage(storageType);
  const result: Record<string, string> = {};

  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key) {
      result[key] = storage.getItem(key) || '';
    }
  }

  return result;
}

export default {
  createStorageItem,
  StorageItem,
  authTokenStorage,
  authUserStorage,
  themeStorage,
  languageStorage,
  sidebarCollapsedStorage,
  pageStateStorage,
  getBatch,
  setBatch,
  clearAll,
  clearByPrefix,
  getStorageSize,
  exportStorage,
};
