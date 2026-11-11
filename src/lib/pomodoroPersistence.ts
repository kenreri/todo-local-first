import { db } from "../db";
import type { PomodoroRecord } from "../types";

/** The session UUID is also the append-only record key, including after a reload. */
export function persistPomodoroSession(record: PomodoroRecord): Promise<boolean> {
  return db.transaction("rw", db.pomodoroRecords, async () => {
    if (await db.pomodoroRecords.get(record.id)) return false;
    await db.pomodoroRecords.put(record);
    return true;
  });
}
