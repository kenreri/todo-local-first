import { useState } from "react";
import { Plus } from "lucide-react";
import { ui } from "../i18n/messages";
import { useTodoStore } from "../store/todoStore";

export function QuickCapture() {
  const locale = useTodoStore((state) => state.locale);
  const captureTask = useTodoStore((state) => state.captureTask);
  const openInbox = useTodoStore((state) => state.openInbox);
  const t = ui(locale);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"saved" | "error" | null>(null);
  return (
    <div className="space-y-2">
      <form className="flex gap-2" onSubmit={(event) => {
        event.preventDefault();
        if (!draft.trim() || saving) return;
        setSaving(true);
        setStatus(null);
        void captureTask(draft).then(() => {
          setDraft("");
          setStatus("saved");
        }).catch(() => setStatus("error")).finally(() => setSaving(false));
      }}>
        <input onKeyDown={(event) => {
          if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault();
        }} value={draft} onChange={(event) => { setDraft(event.target.value); setStatus(null); }}
          placeholder={t.capturePlaceholder} aria-label={t.quickCapture} disabled={saving} data-shortcut="create"
          className="ui-input min-w-0 flex-1 px-3 py-2.5" />
        <button type="submit" aria-label={t.quickCapture} disabled={saving || !draft.trim()}
          className="ui-button-primary inline-flex items-center gap-2 px-4 py-2.5 disabled:opacity-50">
          <Plus className="size-4" /><span className="hidden sm:inline">{t.quickCapture}</span>
        </button>
      </form>
      {status ? <p role={status === "error" ? "alert" : "status"} className={`text-xs ${status === "error" ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
        {status === "error" ? t.taskSaveFailed : t.savedToInbox}
        {status === "saved" ? <button type="button" className="ml-2 min-h-10 text-[var(--accent)]" onClick={() => void openInbox()}>{t.openInbox}</button> : null}
      </p> : null}
    </div>
  );
}
