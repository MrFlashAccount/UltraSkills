const validatedPersistedBatons = new WeakSet();

export function markValidatedPersistedBaton(baton) {
  if (baton && typeof baton === 'object') validatedPersistedBatons.add(baton);
  return baton;
}

export function isValidatedPersistedBaton(baton) {
  return baton && typeof baton === 'object' && validatedPersistedBatons.has(baton);
}
