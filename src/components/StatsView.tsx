import { useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ui } from "../i18n/messages";
import {
  buildCompletionRate,
  buildCompletionTrend,
  buildFocusMinutes,
  buildTagDistribution,
  buildReviewInsights,
  totalFocusMinutes,
} from "../lib/stats";
import { useTodoStore } from "../store/todoStore";
import { PageHeader } from "./PageHeader";
import { SakuraEmpty } from "./SakuraEmpty";

export function StatsView() {
  const locale = useTodoStore((s) => s.locale);
  const tasks = useTodoStore((s) => s.tasks);
  const pomodoroRecords = useTodoStore((s) => s.pomodoroRecords);
  const t = ui(locale);
  const setView = useTodoStore((s) => s.setView);
  const [days, setDays] = useState<7 | 14 | 30>(14);

  const trend = useMemo(() => buildCompletionTrend(tasks, days), [tasks, days]);
  const rate = useMemo(() => buildCompletionRate(tasks, days), [tasks, days]);
  const tags = useMemo(() => buildTagDistribution(tasks, days), [tasks, days]);
  const focus = useMemo(
    () => buildFocusMinutes(pomodoroRecords, days),
    [pomodoroRecords, days],
  );
  const totalFocus = useMemo(
    () => totalFocusMinutes(pomodoroRecords, days),
    [pomodoroRecords, days],
  );
  const insights = useMemo(() => buildReviewInsights(tasks, pomodoroRecords, days), [tasks, pomodoroRecords, days]);
  const signed = (value: number) => value > 0 ? `+${value}` : String(value);
  const comparison = t.reviewComparison.replace("{tasks}", signed(insights.completionDelta)).replace("{minutes}", signed(insights.focusDelta));

  return (
    <section className="min-w-0 space-y-6">
      <PageHeader
        title={t.navReview}
        description={t.statsSubtitle}
        actions={
          <div className="flex max-w-full overflow-x-auto rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-1">
            {([7, 14, 30] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDays(value)}
                aria-pressed={days === value}
                className={
                  days === value
                    ? "shrink-0 rounded-lg bg-[var(--accent)] px-3 py-1 text-sm text-[var(--on-accent)]"
                    : "shrink-0 rounded-lg px-3 py-1 text-sm text-[var(--muted)] hover:bg-[var(--hover)]"
                }
              >
                {t.lastDays.replace("{n}", String(value))}
              </button>
            ))}
          </div>
        }
      />

      {!insights.hasActivity ? (
        <div className="ui-card p-6">
          <SakuraEmpty title={t.reviewEmpty} description={t.reviewEmptyHint} />
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" className="ui-button-primary px-4 py-2" onClick={() => void setView("pomodoro")}>{t.startFocus}</button>
            <button type="button" className="ui-button-secondary px-4 py-2" onClick={() => void setView("today")}>{t.viewToday}</button>
          </div>
        </div>
      ) : (
      <>
      <div className="ui-card-flat p-4 text-sm text-[var(--muted)]">{comparison}</div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-3">
        <div className="ui-card min-w-0 p-5">
          <div className="text-sm text-[var(--muted)]">{t.reviewCompleted}</div>
          <div className="mt-2 text-3xl font-semibold text-[var(--success)]">{insights.completed}</div>
        </div>
        <div className="ui-card min-w-0 p-5">
          <div className="text-sm text-[var(--muted)]">{t.completionRate}</div>
          <div className="mt-2 text-3xl font-semibold text-[var(--accent)]">
            {rate.rate}%
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            {t.completedOfTotal}: {rate.completed} / {rate.total}
          </div>
        </div>
        <div className="ui-card min-w-0 p-5">
          <div className="text-sm text-[var(--muted)]">{t.totalFocus}</div>
          <div className="mt-2 text-3xl font-semibold text-[var(--ink)]">
            {totalFocus}
            <span className="ml-1 text-base font-medium text-[var(--muted)]">
              {t.minutes}
            </span>
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 2xl:grid-cols-2">
        <ChartCard title={t.completionTrend}>
          <p className="mb-4 text-sm text-[var(--muted)]">{insights.completed > 0 ? t.reviewBestDay.replace("{date}", insights.bestDay.date).replace("{n}", String(insights.bestDay.count)) : t.reviewNoCompletions}</p>
          {insights.completed > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "var(--muted)" }}
                interval={2}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "var(--muted)" }}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  color: "var(--ink)",
                }}
              />
              <Bar
                dataKey="count"
                fill="var(--chart-bar)"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
          ) : null}
        </ChartCard>

        <ChartCard title={t.focusMinutes}>
          <p className="mb-4 text-sm text-[var(--muted)]">{insights.activeFocusDays > 0 ? t.reviewFocusInsight.replace("{days}", String(insights.activeFocusDays)).replace("{minutes}", String(insights.averageFocusMinutes)) : t.reviewNoFocus}</p>
          {insights.activeFocusDays > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={focus}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "var(--muted)" }}
                interval={2}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "var(--muted)" }}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  color: "var(--ink)",
                }}
              />
              <Bar
                dataKey="minutes"
                fill="var(--chart-bar-alt)"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
          ) : null}
        </ChartCard>
      </div>

      <div className="ui-card p-5">
        <div className="mb-3 text-sm font-medium">{t.tagDistribution}</div>
        {tags.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{t.reviewNoTags}</p>
        ) : (
          <ul className="space-y-2">
            {tags.map((item) => (
              <li
                key={item.tag}
                className="flex items-center justify-between text-sm"
              >
                <span>#{item.tag}</span>
                <span className="text-[var(--muted)]">{item.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      </>
      )}
    </section>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="ui-card min-w-0 overflow-hidden p-5">
      <div className="mb-4 text-base font-semibold">{title}</div>
      {children}
    </div>
  );
}
