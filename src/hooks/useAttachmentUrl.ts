import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import { db } from "../db";

/** Observe the bytes themselves so restoring a file with the same ID refreshes it. */
export function useAttachmentUrl(id: string | undefined) {
  const [state, setState] = useState({ url: "", failed: false });
  useEffect(() => {
    let url = "";
    setState({ url: "", failed: false });
    if (!id) return;
    const subscription = liveQuery(() => db.attachmentBlobs.get(id)).subscribe({
      next: (record) => {
        if (url) URL.revokeObjectURL(url);
        url = record ? URL.createObjectURL(record.data) : "";
        setState({ url, failed: !record });
      },
      error: () => setState({ url: "", failed: true }),
    });
    return () => {
      subscription.unsubscribe();
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  return state;
}
