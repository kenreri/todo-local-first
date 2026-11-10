import { create } from "zustand";
import type { WorkspaceItem, WorkspaceKind } from "../types";

export type WorkspaceScope = "recent" | "inbox" | "all" | "archived";
export type EditorValues = Pick<
  WorkspaceItem,
  "title" | "body" | "kind" | "intention"
>;
export interface WorkspaceDraft {
  original: EditorValues;
  values: EditorValues;
}

export function editorValues(item: WorkspaceItem): EditorValues {
  return {
    title: item.title,
    body: item.body,
    kind: item.kind,
    intention: item.intention,
  };
}

export function draftPatch(draft: WorkspaceDraft): Partial<EditorValues> {
  const patch: Partial<EditorValues> = {};
  if (draft.values.title !== draft.original.title)
    patch.title = draft.values.title;
  if (draft.values.body !== draft.original.body) patch.body = draft.values.body;
  if (draft.values.kind !== draft.original.kind) patch.kind = draft.values.kind;
  if (draft.values.intention !== draft.original.intention)
    patch.intention = draft.values.intention;
  return patch;
}

// Session-only view state and drafts survive navigation without changing saved records.
export const useWorkspaceUiStore = create<{
  scope: WorkspaceScope;
  kind: "all" | WorkspaceKind;
  intention: "all" | "want" | "need";
  search: string;
  limit: number;
  editingId: string | null;
  scrollTop: number;
  drafts: Record<string, WorkspaceDraft>;
}>(() => ({
  scope: "recent",
  kind: "all",
  intention: "all",
  search: "",
  limit: 30,
  editingId: null,
  scrollTop: 0,
  drafts: {},
}));

export function setWorkspaceDraft(id: string, draft: WorkspaceDraft | null) {
  useWorkspaceUiStore.setState((state) => {
    const drafts = { ...state.drafts };
    if (draft) drafts[id] = draft;
    else delete drafts[id];
    return { drafts };
  });
}
