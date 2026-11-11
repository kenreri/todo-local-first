import { useViewNavigation } from "../hooks/useViewNavigation";
import { SaveStatus } from "./SaveStatus";
import { useLocalMinute } from "../hooks/useLocalDate";
import { Bell, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ui } from "../i18n/messages";
import { isAnimeReminderDue } from "../lib/anime";
import { todayKey } from "../lib/dates";
import { useTodoStore } from "../store/todoStore";

export function AnimeReminder() {
  const locale = useTodoStore((state) => state.locale);
  const anime = useTodoStore((state) => state.anime);
  const navigation = useViewNavigation();
  const t = ui(locale);
  const clock = useLocalMinute();
  const [dismissed, setDismissed] = useState(false);
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");

  useEffect(() => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  const date = todayKey(new Date(clock));
  const time = new Date(clock).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const dueAnime = useMemo(
    () => anime.filter((item) => isAnimeReminderDue(item, date, time)),
    [anime, date, time],
  );

  useEffect(() => {
    if (permission !== "granted") return;
    for (const item of dueAnime) {
      const key = `todo-anime-notified:${date}:${item.id}`;
      if (sessionStorage.getItem(key)) continue;
      try {
        new Notification(`${item.emoji} ${t.animeReminderTitle}`, {
          body:
            locale === "zh"
              ? `${item.title} \u770b\u5230\u7b2c ${item.currentEpisode} \u96c6\uff0c\u4eca\u5929\u7ee7\u7eed\u770b\u5427\u3002`
              : `Continue ${item.title} from episode ${item.currentEpisode}.`,
        });
        sessionStorage.setItem(key, "1");
      } catch {
        // Embedded webviews may not expose browser notifications.
      }
    }
  }, [date, dueAnime, locale, permission, t.animeReminderTitle]);

  useEffect(() => setDismissed(false), [date]);

  if (dismissed || dueAnime.length === 0) return null;

  return (
    <aside className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--accent-soft)] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button
            type="button"
            className="inline-flex items-center gap-2 font-medium text-[var(--accent)] hover:underline"
            disabled={navigation.saving} onClick={() => void navigation.navigate("anime")}
          >
            <Bell className="size-4" /> {t.animeToday}
          </button>
          <ul className="mt-2 space-y-1 text-sm text-[var(--ink)]">
            {dueAnime.map((item) => (
              <li key={item.id}>
                {item.emoji} {item.title}
                <span className="ml-2 text-[var(--muted)]">
                  {item.reminderTime}
                </span>
              </li>
            ))}
          </ul>
          {permission === "default" ? (
            <button
              type="button"
              className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm text-[var(--ink)]"
              onClick={async () => {
                const next = await Notification.requestPermission();
                setPermission(next);
              }}
            >
              {t.animeEnableNotifications}
            </button>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={t.dueReminderDismiss}
          className="rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--hover)]"
          onClick={() => setDismissed(true)}
        >
          <X className="size-4" />
        </button>
      </div>
      <SaveStatus locale={locale} {...navigation} onRetry={() => void navigation.retry()} />
    </aside>
  );
}
