import { create } from "zustand";
import type { WorkspaceKind } from "../types";

export interface CaptureDraft {
  body: string;
  kind: WorkspaceKind | "want" | "need";
  files: File[];
  dueDate: string;
  scheduledDate: string;
  busy: boolean;
}

export const EMPTY_CAPTURE: CaptureDraft = {
  body: "",
  kind: "inbox",
  files: [],
  dueDate: "",
  scheduledDate: "",
  busy: false,
};

// Files remain in memory until Capture is pressed; navigating away preserves the draft.
export const useCaptureDraftStore = create<CaptureDraft>(() => ({
  ...EMPTY_CAPTURE,
}));
