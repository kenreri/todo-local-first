import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import { db } from "../db";
import type { AttachmentRecord, WorkspaceItem } from "../types";

export function useWorkspace() {
  const [snapshot, setSnapshot] = useState<{
    items: WorkspaceItem[];
    attachments: AttachmentRecord[];
    loading: boolean;
    failed: boolean;
  }>({ items: [], attachments: [], loading: true, failed: false });
  useEffect(() => {
    const subscription = liveQuery(async () => {
      const [items, attachments] = await Promise.all([
        db.workspaceItems.toArray(),
        db.attachments.toArray(),
      ]);
      return {
        items: items
          .filter((item) => item.deletedAt == null)
          .sort((a, b) => b.updatedAt - a.updatedAt),
        attachments: attachments.filter((file) => file.deletedAt == null),
        loading: false,
        failed: false,
      };
    }).subscribe({
      next: setSnapshot,
      error: () =>
        setSnapshot((previous) => ({
          ...previous,
          loading: false,
          failed: true,
        })),
    });
    return () => subscription.unsubscribe();
  }, []);
  return snapshot;
}
