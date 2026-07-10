import { persistedRunStateLockToken } from './PersistedRunStateReader.mjs';
import { commitDurableRunState } from './durable-commit.mjs';
import { currentRunStateLockToken, withRunStateLock } from './lock.mjs';

export async function writePersistedRunStateUpdate(paths, patch, { currentState } = {}) {
  if (currentState !== undefined) {
    const currentLockToken = currentRunStateLockToken(paths);
    if (currentLockToken === undefined || persistedRunStateLockToken(currentState) !== currentLockToken) {
      throw new Error('current persisted run-state snapshot must be read within the active run-state lock scope');
    }
  }
  return withRunStateLock(paths, async () => {
    return commitDurableRunState(paths, patch, { currentState });
  });
}
