import { useEffect, useRef, useState } from "react";
import { Headphones, Pause, Paperclip } from "lucide-react";
import { db } from "../db";
import { useWorkspace } from "../hooks/useWorkspace";
import { useAttachmentUrl } from "../hooks/useAttachmentUrl";
import { captureWorkspaceItem } from "../lib/workspace";
import { useTodoStore } from "../store/todoStore";
import { workspaceError } from "../lib/workspace";
import { usePendingPatch } from "../hooks/usePendingPatch";
import { SaveStatus } from "./SaveStatus";

const MUSIC_KEY = "workspace-focus-music";

/** Stays mounted across views so music can accompany work in other tools. */
export function FocusAmbience({ visible }: { visible: boolean }) {
  const locale = useTodoStore((state) => state.locale);
  const zh = locale === "zh";
  const mascotEnabled = useTodoStore((state) => state.mascotEnabled);
  const setMascotEnabled = useTodoStore((state) => state.setMascotEnabled);
  const setView = useTodoStore((state) => state.setView);
  const companion = usePendingPatch<{ enabled: boolean }>(async ({ enabled }) => {
    if (enabled !== undefined) await setMascotEnabled(enabled);
  });
  const navigation = usePendingPatch<{ focus: boolean }>(async () => { await setView("pomodoro"); });
  const { attachments } = useWorkspace();
  const [selected, setSelected] = useState(() => {
    try {
      return localStorage.getItem(MUSIC_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const tracks = attachments.filter(
    (file) =>
      file.mime.startsWith("audio/") ||
      /\.(mp3|m4a|ogg|wav|flac)$/i.test(file.name),
  );
  const track = tracks.find((file) => file.id === selected);
  const trackId = track?.id;
  const { url: src, failed: fileFailed } = useAttachmentUrl(trackId);
  useEffect(() => {
    try {
      localStorage.setItem(MUSIC_KEY, selected);
    } catch {
      /* Optional preference. */
    }
  }, [selected]);
  useEffect(() => {
    setPlaying(false);
  }, [src]);
  return (
    <>
      <section
        hidden={!visible}
        aria-label={zh ? "音乐与陪伴" : "Music and company"}
        className="ui-card p-5"
      >
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Headphones className="size-5 text-[var(--accent)]" />
          {zh ? "音乐与陪伴" : "Music and company"}
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {zh
            ? "放一首自己的音乐。切换页面后，音乐也会陪着你。"
            : "Bring your own music. Playback continues when you switch views."}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            aria-label={zh ? "专注音乐" : "Focus music"}
            className="ui-input min-w-0 max-w-full flex-1 px-3 py-2"
            value={trackId ?? ""}
            onChange={(event) => {
              setSelected(event.target.value);
              setError("");
            }}
          >
            <option value="">
              {zh ? "选择已收集的音频" : "Choose a saved track"}
            </option>
            {tracks.map((file) => (
              <option key={file.id} value={file.id}>
                {file.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            className="ui-button-secondary inline-flex min-h-10 items-center gap-2 px-3"
            onClick={() => input.current?.click()}
          >
            <Paperclip className="size-4" />
            {busy
              ? zh
                ? "保存中…"
                : "Saving…"
              : zh
                ? "添加本地音乐"
                : "Add local music"}
          </button>
        </div>
        <input
          ref={input}
          type="file"
          accept="audio/*,.mp3,.m4a,.ogg,.wav,.flac"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = "";
            if (!file || busy) return;
            setBusy(true);
            setError("");
            void captureWorkspaceItem({
              body: file.name,
              kind: "resource",
              files: [file],
            })
              .then(async (id) => {
                const attachment = await db.attachments
                  .where("itemId")
                  .equals(id)
                  .first();
                if (attachment) setSelected(attachment.id);
              })
              .catch((err) => setError(workspaceError(err, zh)))
              .finally(() => setBusy(false));
          }}
        />
        <audio
          ref={audio}
          src={src || undefined}
          controls
          loop
          className="mt-4 w-full"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() => {
            if (src)
              setError(
                zh
                  ? "浏览器无法播放这个音频，请换一个文件。"
                  : "This audio format could not be played. Try another file.",
              );
          }}
        />
        <label className="mt-4 flex min-h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={companion.patch.enabled ?? mascotEnabled}
            onChange={(event) => void companion.submit({ enabled: event.target.checked })}
          />
          {zh ? "让鲸鱼伙伴陪着我" : "Keep the whale companion nearby"}
        </label>
        <SaveStatus locale={locale} saving={companion.saving} failed={companion.failed} onRetry={() => void companion.retry()} />
        {fileFailed ? (
          <p role="alert" className="mt-2 text-sm text-[var(--danger)]">
            {zh
              ? "无法读取音乐文件，请重新选择。"
              : "Could not load this track. Please select again."}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}
      </section>
      {playing && !visible ? (
        <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--nav-bg)] p-2 shadow-[var(--shadow-floating)] lg:bottom-4">
          <button
            type="button"
            onClick={() => void navigation.submit({ focus: true })}
            className="flex min-h-10 min-w-0 items-center gap-2 px-2 text-sm"
          >
            <Headphones className="size-4 shrink-0" />
            <span className="max-w-48 truncate">{track?.name}</span>
          </button>
          <button
            type="button"
            aria-label={zh ? "暂停音乐" : "Pause music"}
            className="grid size-10 place-items-center"
            onClick={() => audio.current?.pause()}
          >
            <Pause className="size-4" />
          </button>
          <SaveStatus locale={locale} saving={navigation.saving} failed={navigation.failed} onRetry={() => void navigation.retry()} />
        </div>
      ) : null}
    </>
  );
}
