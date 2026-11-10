/**
 * Bangumi API helpers (https://github.com/bangumi/api).
 * Network calls must degrade: timeout / failure returns null, never throws
 * into Dexie / store writes.
 */

const BGM_SEARCH_URL = "https://api.bgm.tv/v0/search/subjects";
const BGM_SUBJECT_URL = (id: number) =>
  `https://api.bgm.tv/v0/subjects/${id}`;
const REQUEST_TIMEOUT_MS = 10_000;

export interface BangumiSubjectInfo {
  subjectId: number;
  title: string;
  name: string;
  nameCn: string;
  date: string | null;
  coverUrl: string | null;
  totalEpisodes: number | null;
  score: number | null;
}

export function parseBangumiCover(images: unknown): string | null {
  if (!images || typeof images !== "object") return null;
  const record = images as Record<string, unknown>;
  for (const key of ["large", "common", "medium", "small"] as const) {
    const url = record[key];
    if (typeof url === "string" && /^https?:\/\//.test(url)) return url;
  }
  return null;
}

export function parseBangumiEpisodes(subject: unknown): number | null {
  if (!subject || typeof subject !== "object") return null;
  const record = subject as Record<string, unknown>;
  // Subject detail: total_episodes often includes SP/OVA; eps is main episode count.
  const fromEps = positiveEpisodeCount(record.eps);
  if (fromEps != null) return fromEps;
  return positiveEpisodeCount(record.total_episodes);
}

function positiveEpisodeCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.floor(value);
}

export function parseBangumiTitle(subject: unknown): string {
  if (!subject || typeof subject !== "object") return "";
  const record = subject as Record<string, unknown>;
  const nameCn =
    typeof record.name_cn === "string" ? record.name_cn.trim() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";
  return nameCn || name;
}

export function parseBangumiSubject(raw: unknown): BangumiSubjectInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const id = record.id;
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) return null;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const nameCn =
    typeof record.name_cn === "string" ? record.name_cn.trim() : "";
  const title = nameCn || name;
  if (!title) return null;
  const date = typeof record.date === "string" && record.date.trim()
    ? record.date.trim()
    : null;
  const rating =
    record.rating && typeof record.rating === "object"
      ? (record.rating as Record<string, unknown>).score
      : undefined;
  const score =
    typeof rating === "number" && Number.isFinite(rating) ? rating : null;
  return {
    subjectId: id,
    title,
    name,
    nameCn,
    date,
    coverUrl: parseBangumiCover(record.images),
    totalEpisodes: parseBangumiEpisodes(record),
    score,
  };
}

function mergeAbortSignal(external?: AbortSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  external?.addEventListener("abort", onAbort);
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      external?.removeEventListener("abort", onAbort);
    },
  };
}

async function fetchBangumiJson(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<unknown | null> {
  const { signal: merged, cleanup } = mergeAbortSignal(signal);
  try {
    const response = await fetch(url, { ...init, signal: merged });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    cleanup();
  }
}

export async function searchSubjects(
  keyword: string,
  signal?: AbortSignal,
): Promise<BangumiSubjectInfo[] | null> {
  const trimmed = keyword.trim();
  if (!trimmed) return [];
  const json = await fetchBangumiJson(
    BGM_SEARCH_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        keyword: trimmed,
        filter: { type: [2] },
        limit: 8,
      }),
    },
    signal,
  );
  if (json == null) return null;
  const data =
    json && typeof json === "object" && Array.isArray((json as { data?: unknown }).data)
      ? (json as { data: unknown[] }).data
      : [];
  return data
    .map(parseBangumiSubject)
    .filter((item): item is BangumiSubjectInfo => item != null);
}

export async function getSubject(
  id: number,
  signal?: AbortSignal,
): Promise<BangumiSubjectInfo | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const json = await fetchBangumiJson(
    BGM_SUBJECT_URL(id),
    { method: "GET", headers: { Accept: "application/json" } },
    signal,
  );
  if (json == null) return null;
  return parseBangumiSubject(json);
}
