export type DrawerFocusIntent = string | null;

export function focusIntentForRunSelection(runId: string): DrawerFocusIntent {
  return runId;
}

export function clearDrawerFocusIntent(): DrawerFocusIntent {
  return null;
}

export function shouldFocusDrawerControl({
  runId,
  focusIntent,
}: {
  runId: string | null;
  focusIntent: DrawerFocusIntent;
}): boolean {
  return runId !== null && focusIntent === runId;
}
