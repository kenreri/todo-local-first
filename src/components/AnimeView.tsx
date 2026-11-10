import { ChevronDown, Edit3, Plus, Play, Search, Trash2, X } from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { ui } from "../i18n/messages";
import { DEFAULT_ANIME_EMOJI, animeProgress } from "../lib/anime";
import {
  getSubject,
  searchSubjects,
  type BangumiSubjectInfo,
} from "../lib/bangumi";
import { useTodoStore } from "../store/todoStore";
import type {
  AnimeAirKind,
  AnimeRecord,
  AnimeScheduleMode,
  AnimeStatus,
} from "../types";
import { useAnimeCover } from "../hooks/useAnimeCover";
import { PageHeader } from "./PageHeader";
import { SakuraEmpty } from "./SakuraEmpty";

/** 海报头渐变：全部引用 support token，按条目稳定散列取一款 */
const POSTER_GRADIENTS: string[] = [
  "linear-gradient(135deg, var(--support-pink), var(--support-lilac))",
  "linear-gradient(135deg, var(--support-lilac), var(--support-sky))",
  "linear-gradient(135deg, var(--support-sky), var(--support-mint))",
  "linear-gradient(135deg, var(--support-pink), var(--support-sky))",
];

function posterGradient(id: string): CSSProperties {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return { background: POSTER_GRADIENTS[hash % POSTER_GRADIENTS.length] };
}

type AnimeFilter = "all" | AnimeStatus;

interface AnimeFormState {
  title: string;
  emoji: string;
  status: AnimeStatus;
  airKind: AnimeAirKind;
  scheduleMode: AnimeScheduleMode;
  currentEpisode: number;
  totalEpisodes: string;
  watchWeekday: string;
  reminderTime: string;
  note: string;
  bgmSubjectId: number | null;
  bgmCoverUrl: string | null;
}

const emptyForm: AnimeFormState = {
  title: "",
  emoji: DEFAULT_ANIME_EMOJI,
  status: "planned",
  airKind: "finished",
  scheduleMode: "none",
  currentEpisode: 0,
  totalEpisodes: "",
  watchWeekday: "",
  reminderTime: "",
  note: "",
  bgmSubjectId: null,
  bgmCoverUrl: null,
};

function BangumiPoster({
  id,
  emoji,
  coverUrl,
  children,
}: {
  id: string;
  emoji: string;
  coverUrl: string | null;
  children?: ReactNode;
}) {
  const cachedCover = useAnimeCover(coverUrl);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [cachedCover]);
  const showImage = Boolean(cachedCover) && !broken;

  return (
    <div
      className="relative overflow-hidden bg-[var(--surface)]"
      style={showImage ? undefined : posterGradient(id)}
    >
      {showImage ? (
        <img
          src={cachedCover ?? ""}
          alt=""
          className="block h-auto w-full"
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="grid aspect-[3/4] place-items-center">
          <span className="text-4xl drop-shadow-sm" aria-hidden="true">
            {emoji}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}

function scheduleLabel(
  item: AnimeRecord,
  locale: "zh" | "en",
  t: ReturnType<typeof ui>,
) {
  if (item.scheduleMode === "none") return t.animeScheduleNone;
  if (item.scheduleMode === "daily") {
    return item.reminderTime
      ? `${t.animeScheduleDaily} \u00b7 ${item.reminderTime}`
      : t.animeScheduleDaily;
  }
  if (item.watchWeekday == null) return t.animeScheduleWeekly;
  return `${locale === "zh" ? "\u5468" : ""}${t.weekdayShort[item.watchWeekday]} \u00b7 ${item.reminderTime ?? t.habitNoReminder}`;
}

export function AnimeView() {
  const locale = useTodoStore((state) => state.locale);
  const anime = useTodoStore((state) => state.anime);
  const createAnime = useTodoStore((state) => state.createAnime);
  const updateAnime = useTodoStore((state) => state.updateAnime);
  const incrementEpisode = useTodoStore((state) => state.incrementAnimeEpisode);
  const deleteAnime = useTodoStore((state) => state.deleteAnime);
  const t = ui(locale);
  const [filter, setFilter] = useState<AnimeFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AnimeFormState>(emptyForm);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >(() => ("Notification" in window ? Notification.permission : "unsupported"));

  const visibleAnime = useMemo(
    () =>
      filter === "all" ? anime : anime.filter((item) => item.status === filter),
    [anime, filter],
  );

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setFormOpen(true);
  };

  const openEdit = (item: AnimeRecord) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      emoji: item.emoji,
      status: item.status,
      airKind: item.airKind === "finished" ? "finished" : "ongoing",
      scheduleMode:
        item.scheduleMode === "weekly" || item.scheduleMode === "daily"
          ? item.scheduleMode
          : "none",
      currentEpisode: item.currentEpisode,
      totalEpisodes: item.totalEpisodes?.toString() ?? "",
      watchWeekday: item.watchWeekday?.toString() ?? "",
      reminderTime: item.reminderTime ?? "",
      note: item.note,
      bgmSubjectId: item.bgmSubjectId,
      bgmCoverUrl: item.bgmCoverUrl,
    });
    setFormOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    const scheduleMode = form.scheduleMode;
    const payload = {
      title: form.title,
      emoji: form.emoji,
      status: form.status,
      airKind: form.airKind,
      scheduleMode,
      currentEpisode: form.currentEpisode,
      totalEpisodes:
        form.totalEpisodes === "" ? null : Number(form.totalEpisodes),
      watchWeekday:
        scheduleMode === "weekly" && form.watchWeekday !== ""
          ? Number(form.watchWeekday)
          : null,
      reminderTime: scheduleMode === "none" ? null : form.reminderTime || null,
      note: form.note,
      bgmSubjectId: form.bgmSubjectId,
      bgmCoverUrl: form.bgmCoverUrl,
    };
    if (editingId) await updateAnime(editingId, payload);
    else await createAnime(payload);
    closeForm();
  };

  const statusLabels: Record<AnimeStatus, string> = {
    planned: t.animePlanned,
    watching: t.animeWatching,
    completed: t.animeCompleted,
    paused: t.animePaused,
  };
  const airKindLabels: Record<AnimeAirKind, string> = {
    ongoing: t.animeAirOngoing,
    finished: t.animeAirFinished,
  };
  const filters: AnimeFilter[] = [
    "all",
    "planned",
    "watching",
    "completed",
    "paused",
  ];

  return (
    <section className="space-y-6">
      <PageHeader
        title={t.animeTitle}
        description={t.animeSubtitle}
        actions={
          <>
          {notificationPermission === "default" ? (
            <button
              type="button"
              className="ui-button-secondary px-4 py-2 text-sm"
              onClick={async () => {
                const next = await Notification.requestPermission();
                setNotificationPermission(next);
              }}
            >
              {t.animeEnableNotifications}
            </button>
          ) : null}
          <button
            type="button"
            className="ui-button-primary inline-flex items-center gap-2 px-4 py-2"
            onClick={openCreate}
          >
            <Plus className="size-4" /> {t.animeAdd}
          </button>
          </>
        }
      />

      {notificationPermission === "denied" ? (
        <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
          {t.habitReminderDenied}
        </p>
      ) : null}

      {formOpen ? (
        <AnimeForm
          form={form}
          editingId={editingId}
          locale={locale}
          onChange={setForm}
          onCancel={closeForm}
          onSubmit={submit}
        />
      ) : null}

      <div className="flex flex-wrap gap-1.5 rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-1.5">
        {filters.map((item) => (
          <button
            key={item}
            type="button"
            className={
              filter === item
                ? "rounded-[var(--radius-small)] bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--on-accent)]"
                : "rounded-[var(--radius-small)] px-3 py-1.5 text-sm font-medium text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"
            }
            onClick={() => setFilter(item)}
          >
            {item === "all" ? t.filterAll : statusLabels[item]}
            <span className="ml-1.5 opacity-70">
              {item === "all"
                ? anime.length
                : anime.filter((entry) => entry.status === item).length}
            </span>
          </button>
        ))}
      </div>

      {visibleAnime.length === 0 ? (
        <div className="ui-card">
          <SakuraEmpty title={t.animeEmpty} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visibleAnime.map((item) => {
            const progress = animeProgress(item);
            return (
              <article
                key={item.id}
                className="ui-card flex w-full flex-col overflow-hidden"
              >
                <BangumiPoster
                  id={item.id}
                  emoji={item.emoji}
                  coverUrl={item.bgmCoverUrl}
                >
                </BangumiPoster>

                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div className="flex items-start gap-1">
                    <h3 className="line-clamp-2 min-w-0 flex-1 text-base font-semibold leading-snug text-[var(--ink)]">
                      {item.title}
                    </h3>

                  </div>
                  <p className="text-sm text-[var(--ink)]">{item.status === "completed" ? t.animeCompleted : t.nextEpisode.replace("{n}", String(item.currentEpisode + 1))}</p>
                  <details><summary className="min-h-10 cursor-pointer py-2 text-xs text-[var(--muted)]">{t.taskMore}</summary><div className="space-y-2">
                    <div className="flex shrink-0">
                      <button
                        type="button"
                        aria-label={t.animeEdit}
                        className="rounded-[var(--radius-small)] p-1.5 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"
                        onClick={() => openEdit(item)}
                      >
                        <Edit3 className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={deletePendingId === item.id ? t.confirmDeleteAction : t.animeDelete}
                        className="rounded-[var(--radius-small)] p-1.5 text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                        onClick={() => {
                          if (deletePendingId === item.id) { void deleteAnime(item.id); setDeletePendingId(null); }
                          else setDeletePendingId(item.id);
                        }}
                      >
                        {deletePendingId === item.id ? t.confirmDeleteAction : <Trash2 className="size-4" />}
                      </button>
                      {deletePendingId === item.id ? <button type="button" className="ui-button-secondary px-2 py-2 text-xs" onClick={() => setDeletePendingId(null)}>{t.cancel}</button> : null}
                    </div>
                  <p className="text-xs text-[var(--muted)]">{airKindLabels[item.airKind]}</p>
                  <select
                    aria-label={t.animeStatus}
                    className="w-full rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-input)] px-2.5 py-1.5 text-sm text-[var(--ink)]"
                    value={item.status}
                    onChange={(event) =>
                      void updateAnime(item.id, {
                        status: event.target.value as AnimeStatus,
                      })
                    }
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm tabular-nums text-[var(--ink)]">
                    {item.totalEpisodes
                      ? t.animeEpisodeProgress
                          .replace("{current}", String(item.currentEpisode))
                          .replace("{total}", String(item.totalEpisodes))
                      : t.animeEpisodeUnknown.replace(
                          "{current}",
                          String(item.currentEpisode),
                        )}
                  </p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--chip)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
                      style={{ width: `${progress ?? 0}%` }}
                    />
                  </div>
                  {item.scheduleMode !== "none" ? (
                    <p className="truncate text-xs text-[var(--muted)]">
                      {scheduleLabel(item, locale, t)}
                    </p>
                  ) : null}
                  </div></details>
                  <button
                    type="button"
                    className="ui-button-primary mt-auto inline-flex w-full items-center justify-center gap-1.5 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      item.status === "completed" ||
                      (item.totalEpisodes != null &&
                        item.currentEpisode >= item.totalEpisodes)
                    }
                    onClick={() => void incrementEpisode(item.id)}
                  >
                    <Play className="size-4" /> {t.animeWatchedOne}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function AnimeForm({
  form,
  editingId,
  locale,
  onChange,
  onCancel,
  onSubmit,
}: {
  form: AnimeFormState;
  editingId: string | null;
  locale: "zh" | "en";
  onChange: (next: AnimeFormState) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const t = ui(locale);
  const [customOpen, setCustomOpen] = useState(editingId != null);
  const showDetails = customOpen;
  const showWeekday = form.scheduleMode === "weekly";
  const showTime =
    form.scheduleMode === "weekly" || form.scheduleMode === "daily";

  return (
    <form
      className="ui-card p-5 md:p-6"
      onSubmit={onSubmit}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-[var(--ink)]">
          {editingId ? t.animeEdit : t.animeAdd}
        </h3>
        <button
          type="button"
          aria-label={t.cancel}
          className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--hover)]"
          onClick={onCancel}
        >
          <X className="size-4" />
        </button>
      </div>

      <p className="mt-2 text-sm text-[var(--muted)]">{t.animeBgmFirstHint}</p>

      <BangumiBindField
        form={form}
        editingId={editingId}
        locale={locale}
        autoFocusSearch={editingId == null}
        onChange={onChange}
        onNoResult={() => setCustomOpen(true)}
      />

      <button
        type="button"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]"
        onClick={() => setCustomOpen((open) => !open)}
      >
        <ChevronDown
          className={`size-4 transition-transform ${showDetails ? "rotate-180" : ""}`}
        />
        {showDetails ? t.animeCustomHide : t.animeCustomToggle}
      </button>

      {showDetails ? (
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1.5 text-sm text-[var(--muted)] lg:col-span-2">
          {t.animeName}
          <input
            required
            className="rounded-xl border border-[var(--line)] px-3 py-2 text-[var(--ink)]"
            placeholder={t.animeNamePlaceholder}
            value={form.title}
            onChange={(event) =>
              onChange({ ...form, title: event.target.value })
            }
          />
        </label>
        <label className="grid gap-1.5 text-sm text-[var(--muted)]">
          {t.habitEmoji}
          <input
            className="rounded-xl border border-[var(--line)] px-3 py-2 text-[var(--ink)]"
            value={form.emoji}
            onChange={(event) =>
              onChange({ ...form, emoji: event.target.value })
            }
          />
        </label>
        <label className="grid gap-1.5 text-sm text-[var(--muted)]">
          {t.animeStatus}
          <select
            className="rounded-xl border border-[var(--line)] px-3 py-2"
            value={form.status}
            onChange={(event) =>
              onChange({ ...form, status: event.target.value as AnimeStatus })
            }
          >
            <option value="planned">{t.animePlanned}</option>
            <option value="watching">{t.animeWatching}</option>
            <option value="completed">{t.animeCompleted}</option>
            <option value="paused">{t.animePaused}</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm text-[var(--muted)]">
          {t.animeAirKind}
          <select
            className="rounded-xl border border-[var(--line)] px-3 py-2"
            value={form.airKind}
            onChange={(event) =>
              onChange({
                ...form,
                airKind: event.target.value as AnimeAirKind,
              })
            }
          >
            <option value="finished">{t.animeAirFinished}</option>
            <option value="ongoing">{t.animeAirOngoing}</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm text-[var(--muted)]">
          {t.animeSchedule}
          <select
            className="rounded-xl border border-[var(--line)] px-3 py-2"
            value={form.scheduleMode}
            onChange={(event) =>
              onChange({
                ...form,
                scheduleMode: event.target.value as AnimeScheduleMode,
              })
            }
          >
            <option value="none">{t.animeScheduleNone}</option>
            <option value="weekly">{t.animeScheduleWeekly}</option>
            <option value="daily">{t.animeScheduleDaily}</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm text-[var(--muted)]">
          {t.animeCurrentEpisode}
          <input
            type="number"
            min="0"
            className="rounded-xl border border-[var(--line)] px-3 py-2 text-[var(--ink)]"
            value={form.currentEpisode}
            onChange={(event) =>
              onChange({ ...form, currentEpisode: Number(event.target.value) })
            }
          />
        </label>
        <label className="grid gap-1.5 text-sm text-[var(--muted)]">
          {t.animeTotalEpisodes}
          <input
            type="number"
            min="1"
            className="rounded-xl border border-[var(--line)] px-3 py-2 text-[var(--ink)]"
            value={form.totalEpisodes}
            onChange={(event) =>
              onChange({ ...form, totalEpisodes: event.target.value })
            }
          />
        </label>
        {showWeekday ? (
          <label className="grid gap-1.5 text-sm text-[var(--muted)]">
            {t.animeWatchDay}
            <select
              className="rounded-xl border border-[var(--line)] px-3 py-2"
              value={form.watchWeekday}
              onChange={(event) =>
                onChange({ ...form, watchWeekday: event.target.value })
              }
            >
              <option value="" />
              {t.weekdayShort.map((label, day) => (
                <option key={day} value={day}>
                  {locale === "zh" ? `\u5468${label}` : label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {showTime ? (
          <label className="grid gap-1.5 text-sm text-[var(--muted)]">
            {t.animeWatchTime}
            <input
              type="time"
              className="rounded-xl border border-[var(--line)] px-3 py-2 text-[var(--ink)]"
              value={form.reminderTime}
              onChange={(event) =>
                onChange({ ...form, reminderTime: event.target.value })
              }
            />
          </label>
        ) : null}
        <label className="grid gap-1.5 text-sm text-[var(--muted)] md:col-span-2 lg:col-span-4">
          {t.animeNote}
          <textarea
            rows={3}
            className="rounded-xl border border-[var(--line)] px-3 py-2 text-[var(--ink)]"
            placeholder={t.animeNotePlaceholder}
            value={form.note}
            onChange={(event) =>
              onChange({ ...form, note: event.target.value })
            }
          />
        </label>
      </div>
      ) : null}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          className="rounded-xl border border-[var(--line)] px-4 py-2 text-[var(--ink)]"
          onClick={onCancel}
        >
          {t.cancel}
        </button>
        <button
          type="submit"
          className="ui-button-primary px-4 py-2 disabled:opacity-50"
          disabled={!form.title.trim()}
        >
          {t.animeSave}
        </button>
      </div>
    </form>
  );
}

function BangumiBindField({
  form,
  editingId,
  locale,
  autoFocusSearch = false,
  onChange,
  onNoResult,
}: {
  form: AnimeFormState;
  editingId: string | null;
  locale: "zh" | "en";
  autoFocusSearch?: boolean;
  onChange: (next: AnimeFormState) => void;
  onNoResult?: () => void;
}) {
  const t = ui(locale);
  const linkAnimeBgm = useTodoStore((state) => state.linkAnimeBgm);
  const updateAnime = useTodoStore((state) => state.updateAnime);
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<BangumiSubjectInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [fetchingDetail, setFetchingDetail] = useState(false);
  const linkedCover = useAnimeCover(form.bgmCoverUrl);
  const [error, setError] = useState<"none" | "error" | "empty">("none");

  const runSearch = async () => {
    const query = keyword.trim() || form.title.trim();
    if (!query) return;
    setSearching(true);
    setError("none");
    setResults([]);
    const controller = new AbortController();
    const items = await searchSubjects(query, controller.signal);
    setSearching(false);
    if (items == null) {
      setError("error");
      onNoResult?.();
      return;
    }
    if (items.length === 0) {
      setError("empty");
      onNoResult?.();
      return;
    }
    setResults(items);
  };

  const bind = async (info: BangumiSubjectInfo) => {
    setFetchingDetail(true);
    const detail = (await getSubject(info.subjectId)) ?? info;
    setFetchingDetail(false);
    const episodes = detail.totalEpisodes ?? info.totalEpisodes;
    onChange({
      ...form,
      title: detail.title.trim() || info.title.trim() || form.title,
      totalEpisodes: episodes != null ? String(episodes) : form.totalEpisodes,
      bgmSubjectId: detail.subjectId,
      bgmCoverUrl: detail.coverUrl ?? info.coverUrl,
    });
    if (editingId) {
      await linkAnimeBgm(editingId, {
        subjectId: detail.subjectId,
        title: detail.title,
        coverUrl: detail.coverUrl ?? info.coverUrl,
        totalEpisodes: episodes,
      });
    }
    setResults([]);
    setError("none");
  };

  const unlink = async () => {
    onChange({ ...form, bgmSubjectId: null, bgmCoverUrl: null });
    if (editingId) {
      await updateAnime(editingId, {
        bgmSubjectId: null,
        bgmCoverUrl: null,
      });
    }
  };

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-sm font-medium text-[var(--ink)]">{t.animeBindBgm}</p>
      {form.bgmSubjectId != null ? (
        <div className="flex flex-wrap items-center gap-3">
          {linkedCover ? (
            <img
              src={linkedCover ?? ""}
              alt=""
              className="h-12 w-12 rounded-lg object-cover"
              referrerPolicy="no-referrer"
            />
          ) : null}
          <p className="min-w-0 flex-1 text-sm text-[var(--ink)]">
            {t.animeBgmLinked}
            <span className="ml-2 text-[var(--muted)]">{form.title}</span>
            {form.totalEpisodes ? (
              <span className="ml-2 text-[var(--muted)]">
                {t.animeBgmEpisodes.replace("{n}", form.totalEpisodes)}
              </span>
            ) : null}
          </p>
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"
            onClick={() => void unlink()}
          >
            {t.animeBgmUnlink}
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <input
          autoFocus={autoFocusSearch}
          className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--ink)]"
          placeholder={t.animeBgmSearchPlaceholder}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void runSearch();
            }
          }}
        />
        <button
          type="button"
          className="ui-button-secondary inline-flex items-center gap-2 px-3 py-2 text-sm"
          disabled={searching || fetchingDetail}
          onClick={() => void runSearch()}
        >
          <Search className="size-4" /> {t.animeBgmSearch}
        </button>
      </div>
      {searching ? (
        <p className="text-sm text-[var(--muted)]">{t.animeBgmSearching}</p>
      ) : null}
      {fetchingDetail ? (
        <p className="text-sm text-[var(--muted)]">{t.animeBgmFetching}</p>
      ) : null}
      {error === "error" ? (
        <p className="text-sm text-[var(--muted)]">{t.animeBgmError}</p>
      ) : null}
      {error === "empty" ? (
        <p className="text-sm text-[var(--muted)]">{t.animeBgmNoResultCustom}</p>
      ) : null}
      {results.length > 0 ? (
        <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-xl border border-[var(--line)]">
          {results.map((item) => (
            <li key={item.subjectId}>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--hover)]"
                disabled={fetchingDetail}
                onClick={() => void bind(item)}
              >
                {item.coverUrl ? (
                  <img
                    src={item.coverUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                ) : (
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[var(--chip)] text-lg">
                    {DEFAULT_ANIME_EMOJI}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[var(--ink)]">
                    {item.nameCn || item.title}
                  </span>
                  {item.name && item.name !== item.nameCn ? (
                    <span className="block truncate text-xs text-[var(--muted)]">
                      {item.name}
                    </span>
                  ) : null}
                  <span className="block text-xs text-[var(--muted)]">
                    {[
                      item.date,
                      item.totalEpisodes != null
                        ? t.animeBgmEpisodes.replace(
                            "{n}",
                            String(item.totalEpisodes),
                          )
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" \u00b7 ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
