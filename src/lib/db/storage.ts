/** STO-1: ask the browser not to evict our data. Safe to call more than once. */
export async function persistStorage(): Promise<boolean> {
  try {
    return (
      (await navigator.storage?.persisted?.()) || ((await navigator.storage?.persist?.()) ?? false)
    );
  } catch {
    return false;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function isQuotaError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'QuotaExceededError';
}

/** STO-5: a quota failure explained with the storage used, anything else as is. */
export async function describeWriteError(e: unknown): Promise<string> {
  if (!isQuotaError(e)) return e instanceof Error ? e.message : String(e);
  const usage = (await navigator.storage?.estimate?.().catch(() => undefined))?.usage;
  const used = usage === undefined ? '' : ` (${formatBytes(usage)} used)`;
  return `Storage is full${used}. Delete some episodes to free space.`;
}

/** STO-1, SET-2: usage, quota and whether the data is protected from eviction. */
export async function storageInfo(): Promise<{
  usage?: number;
  quota?: number;
  persisted: boolean;
}> {
  const [estimate, persisted] = await Promise.all([
    navigator.storage?.estimate?.().catch(() => undefined),
    navigator.storage?.persisted?.().catch(() => false),
  ]);
  return { usage: estimate?.usage, quota: estimate?.quota, persisted: persisted ?? false };
}
