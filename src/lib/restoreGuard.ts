import Dexie, { type DBCoreTransaction } from "dexie";

const APPLICATION_LOCK = "todo-local-first:application-v1";
let gate: "open" | "replacing" | "sealed" = "open";
const restoreTransactions = new WeakSet<DBCoreTransaction>();

/** Block delayed saves during replacement and until the successful reload. */
export function installRestoreGuard(database: Dexie) {
  database.use({
    stack: "dbcore",
    name: "backup-restore-boundary",
    create: (down) => ({
      ...down,
      table: (name) => {
        const table = down.table(name);
        return {
          ...table,
          mutate: (request) => {
            if (gate !== "open" && !restoreTransactions.has(request.trans)) {
              return Promise.reject(new Error("Backup restore is in progress; reload before saving."));
            }
            return table.mutate(request);
          },
        };
      },
    }),
  });
}

export function allowRestoreTransaction() {
  const transaction = Dexie.currentTransaction;
  if (!transaction) throw new Error("Restore requires a database transaction");
  restoreTransactions.add(transaction.idbtrans);
}

let connected = false;
let restoring = false;
interface TabLease { release: () => void; request: Promise<void>; ready: Promise<void> }
let tabLease: TabLease | null = null;

function locks() {
  return typeof navigator !== "undefined" ? navigator.locks : undefined;
}

function acquireTab() {
  const manager = locks();
  if (!manager || !connected || restoring) return;
  let release: () => void = () => {};
  let acquired: () => void = () => {};
  let failed: (error: unknown) => void = () => {};
  const ready = new Promise<void>((resolve, reject) => { acquired = resolve; failed = reject; });
  const held = new Promise<void>((resolve) => { release = resolve; });
  const request = manager.request(APPLICATION_LOCK, { mode: "shared" }, async () => {
    acquired();
    await held;
  });
  void request.catch(failed);
  tabLease = { release, request, ready };
}

/** Every application page participates; callers wait before opening the database. */
export function connectApplicationTab() {
  connected = true;
  acquireTab();
  return () => {
    connected = false;
    tabLease?.release();
    tabLease = null;
  };
}

export function awaitApplicationTab(): Promise<void> {
  return tabLease?.ready ?? Promise.resolve();
}

export async function retryApplicationTab(): Promise<void> {
  const lease = tabLease;
  if (lease) {
    try { await lease.ready; return; }
    catch { /* Only failed acquisitions need a new request. */ }
  }
  tabLease = null;
  lease?.release();
  await lease?.request.catch(() => {});
  acquireTab();
  await awaitApplicationTab();
}

export class RestoreUnavailableError extends Error {}

/** Fail closed when another participating tab is open; success stays sealed until reload. */
export async function withExclusiveRestore(operation: () => Promise<void>) {
  const manager = locks();
  if (!manager) throw new RestoreUnavailableError("locks-unavailable");
  if (restoring || gate !== "open") throw new RestoreUnavailableError("restore-in-progress");
  restoring = true;
  const lease = tabLease;
  tabLease = null;
  lease?.release();
  let succeeded = false;
  try {
    await lease?.request;
    await manager.request(APPLICATION_LOCK, { mode: "exclusive", ifAvailable: true }, async (lock) => {
      if (!lock) throw new RestoreUnavailableError("other-tabs-open");
      gate = "replacing";
      try {
        await operation();
        gate = "sealed";
        succeeded = true;
      } catch (error) {
        gate = "open";
        throw error;
      }
    });
  } finally {
    if (!succeeded) { restoring = false; acquireTab(); }
  }
}
