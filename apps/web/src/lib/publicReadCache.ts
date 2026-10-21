/** Reuse anonymous catalog data, never account data or operation quotes. */
export class PublicReadCache {
  private entries = new Map<string, { until: number; promise: Promise<unknown>; data?: unknown }>();
  constructor(private now = () => Date.now(), private ttl = 20_000) {}
  private allowed(path: string) { return path === "/cases" || path === "/games/upgrade-targets"; }
  peek<T>(path: string): T | undefined {
    const entry = this.entries.get(path);
    return entry && entry.until > this.now() ? entry.data as T | undefined : undefined;
  }
  get<T>(path: string, read: () => Promise<T>): Promise<T> {
    if (!this.allowed(path)) return read();
    const cached = this.entries.get(path);
    if (cached && cached.until > this.now()) return cached.promise as Promise<T>;
    const entry: { until: number; promise: Promise<unknown>; data?: T } = { until: this.now() + this.ttl, promise: Promise.resolve() };
    entry.promise = read().then(data => { entry.data = data; return data; }).catch(error => {
      if (this.entries.get(path) === entry) this.entries.delete(path);
      throw error;
    });
    this.entries.set(path, entry);
    return entry.promise as Promise<T>;
  }
}
