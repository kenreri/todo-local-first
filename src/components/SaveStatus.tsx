import type { Locale } from "../types";

export function SaveStatus({
  locale,
  saving,
  failed,
  onRetry,
  showSaved = false,
}: {
  locale: Locale;
  saving: boolean;
  failed: boolean;
  onRetry: () => void;
  showSaved?: boolean;
}) {
  const zh = locale === "zh";
  if (!saving && !failed && !showSaved) return null;
  return (
    <div
      role={failed ? "alert" : "status"}
      className={`flex min-w-0 flex-wrap items-center gap-2 text-xs ${failed ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}
    >
      <span className="min-w-0 break-words">
        {failed
          ? zh ? "保存失败，修改仍保留。" : "Save failed. Your changes are kept."
          : saving ? zh ? "保存中…" : "Saving…" : zh ? "已保存" : "Saved"}
      </span>
      {failed ? (
        <button type="button" onClick={onRetry} className="ui-button-secondary min-h-10 px-3 py-2 text-xs">
          {zh ? "重试保存" : "Retry save"}
        </button>
      ) : null}
    </div>
  );
}
