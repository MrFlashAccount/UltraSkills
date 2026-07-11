export function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  if (value instanceof Map) {
    for (const [key, entry] of value) {
      deepFreeze(key, seen);
      deepFreeze(entry, seen);
    }
  } else if (value instanceof Set) {
    for (const entry of value) deepFreeze(entry, seen);
  } else {
    for (const entry of Object.values(value)) deepFreeze(entry, seen);
  }
  return Object.freeze(value);
}

export function ownedSnapshot(value) {
  return deepFreeze(structuredClone(value));
}
