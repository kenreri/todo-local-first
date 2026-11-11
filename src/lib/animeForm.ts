import type { AnimeRecord } from "../types";

export type AnimeFormState = Pick<
  AnimeRecord,
  | "title"
  | "emoji"
  | "status"
  | "airKind"
  | "scheduleMode"
  | "currentEpisode"
  | "note"
  | "bgmSubjectId"
  | "bgmCoverUrl"
> & {
  totalEpisodes: string;
  watchWeekday: string;
  reminderTime: string;
};

export function animeFormFromRecord(item: AnimeRecord): AnimeFormState {
  return {
    title: item.title,
    emoji: item.emoji,
    status: item.status,
    airKind: item.airKind,
    scheduleMode: item.scheduleMode,
    currentEpisode: item.currentEpisode,
    totalEpisodes: item.totalEpisodes?.toString() ?? "",
    watchWeekday: item.watchWeekday?.toString() ?? "",
    reminderTime: item.reminderTime ?? "",
    note: item.note,
    bgmSubjectId: item.bgmSubjectId,
    bgmCoverUrl: item.bgmCoverUrl,
  };
}

export function animeFormInput(form: AnimeFormState) {
  return {
    ...form,
    totalEpisodes:
      form.totalEpisodes === "" ? null : Number(form.totalEpisodes),
    watchWeekday:
      form.scheduleMode === "weekly" && form.watchWeekday !== ""
        ? Number(form.watchWeekday)
        : null,
    reminderTime:
      form.scheduleMode === "none" ? null : form.reminderTime || null,
  };
}

/** A form owns only fields edited since opening; live progress belongs to the DB. */
export function animeFormPatch(baseline: AnimeFormState, form: AnimeFormState) {
  const before = animeFormInput(baseline);
  const after = animeFormInput(form);
  const patch: Partial<typeof after> = {};
  const copyChanged = <K extends keyof typeof after>(key: K) => {
    if (before[key] !== after[key]) patch[key] = after[key];
  };
  for (const key of [
    "title",
    "emoji",
    "status",
    "airKind",
    "scheduleMode",
    "currentEpisode",
    "totalEpisodes",
    "watchWeekday",
    "reminderTime",
    "note",
    "bgmSubjectId",
    "bgmCoverUrl",
  ] as const)
    copyChanged(key);
  return patch;
}
