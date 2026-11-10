/** Derived image cache, separate from business records and JSON/CSV backups. */
export const ANIME_COVER_CACHE = "todo-anime-covers-v1";
const MAX_ENTRIES = 200;
const MAX_BYTES = 8 * 1024 * 1024;
const inFlight = new Map<string, Promise<Blob | null>>();

export function getAnimeCover(url: string): Promise<Blob | null> {
  if (!/^https?:\/\//.test(url)) return Promise.resolve(null);
  const pending = inFlight.get(url);
  if (pending) return pending;
  const job = loadCover(url).finally(() => inFlight.delete(url));
  inFlight.set(url, job);
  return job;
}

async function loadCover(url: string): Promise<Blob | null> {
  let cache: Cache | undefined;
  try {
    cache = await caches.open(ANIME_COVER_CACHE);
    const saved = await cache.match(url);
    if (saved) {
      const blob = await saved.blob();
      if (blob.size > 0 && blob.type.startsWith("image/")) return blob;
      await cache.delete(url);
    }
  } catch {
    // Private mode / quota / unavailable storage must not prevent rendering.
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith("image/") || blob.size === 0 || blob.size > MAX_BYTES) return null;
    if (cache) {
      try {
        await cache.put(url, new Response(blob, { headers: { "Content-Type": blob.type } }));
        const keys = await cache.keys();
        for (const key of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) await cache.delete(key);
      } catch {
        // A full cache is optional; the downloaded image can still be shown.
      }
    }
    return blob;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
