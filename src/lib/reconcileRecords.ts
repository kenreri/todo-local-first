/** Database rows contain plain objects, arrays and primitive values. */
function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (
    left === null ||
    right === null ||
    typeof left !== "object" ||
    typeof right !== "object"
  )
    return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => sameValue(value, right[index]))
    );
  }
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && sameValue(a[key], b[key]))
  );
}

/** Retain references without hiding changes that share an id or timestamp. */
export function reconcileRecords<T extends { id: string }>(
  current: T[],
  incoming: T[],
): T[] {
  const byId = new Map(current.map((record) => [record.id, record]));
  const next = incoming.map((record) => {
    const previous = byId.get(record.id);
    return previous && sameValue(previous, record) ? previous : record;
  });
  return next.length === current.length &&
    next.every((record, index) => record === current[index])
    ? current
    : next;
}
