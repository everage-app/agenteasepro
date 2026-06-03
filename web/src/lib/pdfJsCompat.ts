type CacheMap<K, V> = Map<K, V> & {
  getOrInsert?: (key: K, value: V) => V;
  getOrInsertComputed?: (key: K, callback: (key: K) => V) => V;
};

type CacheWeakMap<K extends object, V> = WeakMap<K, V> & {
  getOrInsert?: (key: K, value: V) => V;
  getOrInsertComputed?: (key: K, callback: (key: K) => V) => V;
};

const defineCacheHelper = <T extends object>(prototype: T, name: string, value: Function) => {
  if (name in prototype) return;
  Object.defineProperty(prototype, name, {
    configurable: true,
    writable: true,
    value,
  });
};

export const installPdfJsCompat = () => {
  defineCacheHelper(Map.prototype, 'getOrInsert', function getOrInsert<K, V>(
    this: CacheMap<K, V>,
    key: K,
    value: V,
  ) {
    if (!this.has(key)) {
      this.set(key, value);
    }
    return this.get(key);
  });

  defineCacheHelper(Map.prototype, 'getOrInsertComputed', function getOrInsertComputed<K, V>(
    this: CacheMap<K, V>,
    key: K,
    callback: (key: K) => V,
  ) {
    if (!this.has(key)) {
      this.set(key, callback(key));
    }
    return this.get(key);
  });

  defineCacheHelper(WeakMap.prototype, 'getOrInsert', function getOrInsert<K extends object, V>(
    this: CacheWeakMap<K, V>,
    key: K,
    value: V,
  ) {
    if (!this.has(key)) {
      this.set(key, value);
    }
    return this.get(key);
  });

  defineCacheHelper(WeakMap.prototype, 'getOrInsertComputed', function getOrInsertComputed<K extends object, V>(
    this: CacheWeakMap<K, V>,
    key: K,
    callback: (key: K) => V,
  ) {
    if (!this.has(key)) {
      this.set(key, callback(key));
    }
    return this.get(key);
  });
};
