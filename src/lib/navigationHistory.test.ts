import { afterEach, describe, expect, it, vi } from "vitest";
import { startNavigationHistory, type NavigationSnapshot } from "./navigationHistory";
function harness() {
  vi.useFakeTimers();
  let snapshot: NavigationSnapshot = {view:"list", selectedListId:null, selectedTaskId:null, search:"", filter:"all"};
  const entries: unknown[] = [null];
  let index = 0;
  const events = new EventTarget();
  let subscriber: (() => void) | undefined;
  const history = {
    get state() {return entries[index]},
    replaceState: vi.fn((state: unknown) => {entries[index]=structuredClone(state)}),
    pushState: vi.fn((state: unknown) => {entries.splice(index+1); entries.push(structuredClone(state)); index++;}),
    go: vi.fn((delta: number) => {
      if(index+delta<0 || index+delta>=entries.length) return;
      index+=delta;
      const event = new Event("popstate");
      Object.defineProperty(event,"state", {value:entries[index]});
      events.dispatchEvent(event);
    }),
  };
  const apply=vi.fn((next: NavigationSnapshot) => {snapshot=next;subscriber?.()});
  const mount=()=>startNavigationHistory({history, events:events as unknown as Window,
    getSnapshot:()=>snapshot, apply,
    subscribe:listener=>{subscriber=listener;return ()=>{subscriber=undefined}},
  });
  const change=(patch:Partial<NavigationSnapshot>, settle=true)=>{
    snapshot={...snapshot,...patch};subscriber?.();if(settle)vi.advanceTimersByTime(60);
  };
  return {history, entries, mount, change, get:()=>snapshot, apply};
}
afterEach(()=>vi.useRealTimers());
describe("internal page history",()=>{
  it("goes back and forward between pages without adding entries on restore",()=>{
    const h=harness();h.mount();h.change({view:"calendar"});h.change({view:"anime"});
    const length=h.entries.length;
    h.history.go(-1);expect(h.get().view).toBe("calendar");
    h.history.go(-1);expect(h.get().view).toBe("list");
    h.history.go(1);expect(h.get().view).toBe("calendar");
    h.history.go(1);expect(h.get().view).toBe("anime");
    expect(h.entries.length).toBe(length);
  });
  it("restores a chosen list, filters and details",()=>{
    const h=harness();h.mount();h.change({selectedListId:"study",search:"python",filter:"active"});
    h.change({selectedTaskId:"task"});h.change({view:"today", selectedTaskId:null});
    h.history.go(-1);
    expect(h.get()).toMatchObject({view:"list",selectedListId:"study",selectedTaskId:"task",search:"python",filter:"active"});
  });
  it("merges scope and view changes from the same navigation",()=>{
    const h=harness();h.mount();h.change({selectedListId:"inbox"},false);h.change({view:"today"});
    expect(h.entries.length).toBe(3);
  });
  it("updates search in place and ignores unchanged data notifications",()=>{
    const h=harness();h.mount();h.change({search:"a"});h.change({search:"ab"});h.change({});
    expect(h.entries.length).toBe(2);
    h.change({view:"calendar"});h.history.go(-1);expect(h.get().search).toBe("ab");
  });
  it("stays at the first app page and keeps forward history available",()=>{
    const h=harness();h.mount();h.change({view:"calendar"});h.history.go(-1);h.history.go(-1);
    expect(h.get().view).toBe("list");expect(h.entries.length).toBe(3);
    h.history.go(1);expect(h.get().view).toBe("calendar");
  });
  it("starts a new branch after going back",()=>{
    const h=harness();h.mount();h.change({view:"calendar"});h.change({view:"anime"});
    h.history.go(-1);h.change({view:"stats"});h.history.go(1);expect(h.get().view).toBe("stats");
  });
  it("restores the same history entry on reload/remount without duplicate entries",()=>{
    const h=harness();const stop=h.mount();h.change({view:"calendar"});stop();
    h.change({view:"today"});h.mount();expect(h.get().view).toBe("calendar");expect(h.entries.length).toBe(3);
  });
  it("unsubscribes and flushes a pending page on cleanup",()=>{
    const h=harness();const stop=h.mount();h.change({view:"calendar"},false);stop();
    expect(h.entries.length).toBe(3);h.change({view:"stats"});expect(h.entries.length).toBe(3);
  });
});
