import { useViewNavigation } from "../hooks/useViewNavigation";
import { SaveStatus } from "./SaveStatus";
import { useEffect, useRef, useState } from "react";
import { Check, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { ui } from "../i18n/messages";
import { cn } from "../lib/cn";
import { useTodoStore } from "../store/todoStore";
import { useSaveFeedback } from "../hooks/useSaveFeedback";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const rootRef = useRef<HTMLElement>(null);
  const locale = useTodoStore((state) => state.locale);
  const lists = useTodoStore((state) => state.lists);
  const view = useTodoStore((state) => state.view);
  const selectedListId = useTodoStore((state) => state.selectedListId);
  const selectList = useTodoStore((state) => state.selectList);
  const navigation = useViewNavigation();
  const createList = useTodoStore((state) => state.createList);
  const renameList = useTodoStore((state) => state.renameList);
  const deleteList = useTodoStore((state) => state.deleteList);
  const t = ui(locale);
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const { run, saving, failed } = useSaveFeedback();
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const saveName = async () => {
    if (!editing?.name.trim()) return;
    const submitted = editing;
    if (await run(() => renameList(submitted.id, submitted.name))) {
      setEditing((current) =>
        current?.id === submitted.id && current.name === submitted.name ? null : current,
      );
    }
  };

  const saveNewList = async () => {
    if (!draft.trim()) return;
    const submitted = draft;
    if (await run(() => createList(submitted))) {
      if (draftRef.current === submitted) {
        setDraft("");
        setCreating(false);
      }
    }
  };

  useEffect(() => {
    if (!openMenuId) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenMenuId(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenuId(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenuId]);

  const openList = (id: string) => navigation.navigate("list", () => {
    selectList(id);
    setOpenMenuId(null);
    onNavigate?.();
  });

  return (
    <section ref={rootRef} aria-busy={saving || navigation.saving} className="mt-1 ml-3 border-l border-[var(--line)] pl-2">
      <SaveStatus locale={locale} {...navigation} onRetry={() => void navigation.retry()} />
      <ul className="space-y-0.5">
        {lists.map((list) => {
          const selected = view === "list" && selectedListId === list.id;
          return (
            <li key={list.id}>
              {editing?.id === list.id ? (
                <form
                  className="flex items-center gap-1"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveName();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault();
                  }}
                >
                  <input
                    autoFocus
                    aria-label={t.renameList}
                    value={editing.name}
                    onChange={(event) =>
                      setEditing({ id: list.id, name: event.target.value })
                    }
                    className="min-w-0 flex-1 rounded-lg border border-[var(--accent)] bg-[var(--surface-input)] px-2 py-1.5 text-sm outline-none"
                  />
                  <button
                    type="submit"
                    disabled={saving || navigation.saving || !editing.name.trim()}
                    aria-label={t.save}
                    className="rounded-lg p-1.5 text-[var(--accent)]"
                  >
                    <Check className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={saving || navigation.saving}
                    aria-label={t.cancel}
                    onClick={() => setEditing(null)}
                    className="rounded-lg p-1.5 text-[var(--muted)]"
                  >
                    <X className="size-3.5" />
                  </button>
                </form>
              ) : (
                <div className="group relative flex items-center gap-0.5">
                  <button
                    type="button"
                    disabled={saving || navigation.saving}
                    onClick={() => void openList(list.id)}
                    className={cn(
                      "flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-small)] px-2.5 py-1.5 text-left text-sm transition",
                      selected
                        ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                        : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]",
                    )}
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ background: list.color }}
                    />
                    <span className="flex-1 truncate">{list.name}</span>
                  </button>
                  <button
                    type="button"
                    disabled={saving || navigation.saving}
                    aria-label={t.listActions}
                    title={t.listActions}
                    aria-expanded={openMenuId === list.id}
                    onClick={() =>
                      setOpenMenuId((current) =>
                        current === list.id ? null : list.id,
                      )
                    }
                    className={cn(
                      "rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[var(--hover)] hover:text-[var(--ink)] focus:opacity-100",
                      openMenuId === list.id
                        ? "opacity-100"
                        : "opacity-100 lg:opacity-0 lg:group-hover:opacity-100",
                    )}
                  >
                    <MoreHorizontal className="size-3.5" />
                  </button>
                  {openMenuId === list.id ? (
                    <div
                      role="menu"
                      className="absolute top-full right-0 z-20 mt-1 w-32 space-y-1 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--bg-elevated)] p-1.5 shadow-[var(--shadow-floating)]"
                    >
                      <button
                        type="button"
                        disabled={saving || navigation.saving}
                        role="menuitem"
                        onClick={() => {
                          setEditing({ id: list.id, name: list.name });
                          setOpenMenuId(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-[var(--ink)] hover:bg-[var(--hover)]"
                      >
                        <Pencil className="size-3.5" />
                        {t.renameList}
                      </button>
                      <button
                        type="button"
                        disabled={saving || navigation.saving}
                        role="menuitem"
                        onClick={() => {
                          if (window.confirm(t.confirmDeleteList)) {
                            void run(() => deleteList(list.id)).then((saved) => {
                              if (saved) setOpenMenuId(null);
                            });
                          }
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                      >
                        <Trash2 className="size-3.5" />
                        {t.deleteList}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {creating ? (
        <form
          className="mt-2 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            void saveNewList();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault();
          }}
        >
          <input
            autoFocus
            aria-label={t.newList}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t.listNamePlaceholder}
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-input)] px-2.5 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          <div className="flex gap-1.5">
            <button
              type="submit"
              disabled={saving || navigation.saving || !draft.trim()}
              className="flex-1 rounded-lg bg-[var(--accent)] px-2 py-1.5 text-sm text-[var(--on-accent)]"
            >
              {t.save}
            </button>
            <button
              type="button"
              disabled={saving || navigation.saving}
              onClick={() => {
                setCreating(false);
                setDraft("");
              }}
              className="rounded-lg px-2 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--hover)]"
            >
              {t.cancel}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          disabled={saving || navigation.saving}
          onClick={() => setCreating(true)}
          className="mt-1 inline-flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-sm text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"
        >
          <Plus className="size-3.5" />
          {t.newList}
        </button>
      )}
      {saving ? <p role="status" className="mt-2 text-xs text-[var(--muted)]">{t.taskSaving}</p> : null}
      {failed ? <p role="alert" className="mt-2 text-xs text-[var(--danger)]">{t.taskSaveFailed}</p> : null}
    </section>
  );
}
