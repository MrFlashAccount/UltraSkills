import { readRunsIndex, runsIndexPathsForRoot } from '../../persistence/run-state/run-index.mjs';
import { resolveRunPaths, workflowRunsRoot } from '../../persistence/run-state/paths.mjs';
import { readPersistedRunState } from '../../persistence/run-state/PersistedRunStateReader.mjs';
import { mergeRunAuthorityIntoIndexEntry, readRunAuthority, runAuthorityFromIndexEntry } from '../../persistence/run-state/run-authority.mjs';
import { projectDashboardRun } from '../projection/safe-dashboard-projection.mjs';

const RUN_READ_CONCURRENCY = 16;

async function mapWithConcurrency(values, limit, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, () => worker()));
  return results;
}

function sortByUpdatedAtDesc(left, right) {
  return String(right.updatedAt ?? '').localeCompare(String(left.updatedAt ?? '')) || left.runId.localeCompare(right.runId);
}

function degradedFromError(error) {
  return {
    reason: 'read_failed',
    message: error?.message ? String(error.message).replace(/\s+from\s+.*$/, '') : 'run state could not be read',
  };
}

export class RunsRootObserverReader {
  constructor({ runsRoot = workflowRunsRoot, now = () => new Date() } = {}) {
    this.runsRoot = runsRoot;
    this.now = now;
  }

  async readIndex() {
    return readRunsIndex(runsIndexPathsForRoot(this.runsRoot));
  }

  async readRunEntry(entry, { includeDetail = false } = {}) {
    try {
      const lookupPaths = resolveRunPaths({
        runId: entry.runId,
        workflowPath: entry.workflow?.path,
        runsRoot: this.runsRoot,
      });
      const authority = await readRunAuthority(lookupPaths) ?? runAuthorityFromIndexEntry(lookupPaths, entry);
      const run = mergeRunAuthorityIntoIndexEntry(entry, authority);
      const paths = resolveRunPaths({
        runId: run.runId,
        workflowPath: run.workflow?.path,
        runsRoot: this.runsRoot,
      });
      const persistedState = await readPersistedRunState(paths);
      return projectDashboardRun({ run, persistedState }, { now: this.now(), includeDetail });
    } catch (error) {
      return projectDashboardRun({
        run: entry,
        degraded: degradedFromError(error),
      }, { now: this.now(), includeDetail });
    }
  }

  async listRuns() {
    const index = await this.readIndex();
    const entries = Object.values(index.runs).sort(sortByUpdatedAtDesc);
    return mapWithConcurrency(entries, RUN_READ_CONCURRENCY, (entry) => this.readRunEntry(entry));
  }

  async getRun(runId) {
    const index = await this.readIndex();
    const entry = index.runs[runId];
    if (!entry) return undefined;
    return this.readRunEntry(entry, { includeDetail: true });
  }
}
