import { liveQuery } from "dexie";
import { useCallback, useEffect, useState } from "react";
import { db } from "../db";
import type { AttachmentRecord, WorkspaceItem } from "../types";
import { reconcileRecords } from "../lib/reconcileRecords";

export function useWorkspace() {
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<{
    items: WorkspaceItem[];
    attachments: AttachmentRecord[];
    loading: boolean;
    failed: boolean;
  }>({ items: [], attachments: [], loading: true, failed: false });
  const retry = useCallback(() => {
    setSnapshot(previous => ({ ...previous, loading: true, failed: false }));
    setAttempt(previous => previous + 1);
  }, []);
  useEffect(() => {
    let active = true;
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
      next: next => {
        if (!active) return;
        setSnapshot(previous => ({
          ...next,
          items: reconcileRecords(previous.items, next.items),
          attachments: reconcileRecords(previous.attachments, next.attachments),
        }));
      },
      error: () => {
        if (!active) return;
        setSnapshot((previous) => ({
          ...previous,
          loading: false,
          failed: true,
        }));
      },
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [attempt]);
  return { ...snapshot, retry };
}
