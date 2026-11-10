import { describe, expect, it } from "vitest";
import { reconcileRecords } from "./reconcileRecords";

describe("reconciling database records", () => {
  it("keeps a collection stable for an equal cloned snapshot including nested fields", () => {
    const records = [
      { id: "a", tags: ["work"], rule: { days: [1, 3], end: null } },
    ];
    expect(reconcileRecords(records, structuredClone(records))).toBe(records);
  });

  it("preserves incoming order and membership while reusing matching records", () => {
    const a = { id: "a", value: 1 };
    const b = { id: "b", value: 2 };
    const current = [a, b];
    const reordered = reconcileRecords(current, [{ ...b }, { ...a }]);
    expect(reordered).toEqual([b, a]);
    expect(reordered[0]).toBe(b);
    expect(reordered[1]).toBe(a);
    const changed = reconcileRecords(current, [
      { ...b },
      { id: "c", value: 3 },
    ]);
    expect(changed.map((item) => item.id)).toEqual(["b", "c"]);
    expect(changed[0]).toBe(b);
    expect(current).toEqual([a, b]);
    expect(reconcileRecords(current, [])).toEqual([]);
  });
});
