declare module 'localforage' {
  interface LocalForageConfig {
    driver?: string | string[];
    name?: string;
    version?: number;
    storeName?: string;
    description?: string;
    size?: number;
  }

  interface LocalForage {
    config(options: LocalForageConfig): void;
    getItem<T>(key: string): Promise<T | null>;
    setItem<T>(key: string, value: T): Promise<T>;
    removeItem(key: string): Promise<void>;
  }

  const localforage: LocalForage;
  export default localforage;
}
