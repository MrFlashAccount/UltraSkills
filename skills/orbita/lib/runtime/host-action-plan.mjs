/** Pure effective-host-action projection over neutral executable entries. */
export const RESOLVE_NON_BLOCKING_STOP_ACTION = 'resolve_non_blocking_stop';

export function projectHostAction(entry, baton) {
  const stop = baton?.nonBlockingStops?.[entry.id];
  if (stop && !stop.resolution) {
    return {
      entry,
      action: RESOLVE_NON_BLOCKING_STOP_ACTION,
      stop,
    };
  }
  return {
    entry,
    action: entry.action,
    ...(stop?.resolution ? { stop } : {}),
  };
}

export function projectHostActions(entries = [], baton) {
  return entries.map((entry) => projectHostAction(entry, baton));
}
