import { readRunsIndex, runsIndexPathsForRoot } from '../../persistence/run-state/run-index.mjs';
import { resolveRunPaths, workflowRunsRoot } from '../../persistence/run-state/paths.mjs';
import { readPersistedRunState } from '../../persistence/run-state/PersistedRunStateReader.mjs';
import { mergeRunAuthorityIntoIndexEntry, readRunAuthority, runAuthorityFromIndexEntry } from '../../persistence/run-state/run-authority.mjs';
import { projectDashboardRun } from '../projection/safe-dashboard-projection.mjs';
import { publicErrorMessage } from '../../public-error.mjs';

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
  return String(right.updatedAt ?? '').localeCompare(String(left.updatedAt ?? '')) || String(left.runId).localeCompare(String(right.runId));
}

function degradedFromError(_error, runsRoot) {
  return {
    reason: 'read_failed',
    message: publicErrorMessage('run state could not be read', { runsRoot }),
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
        degraded: degradedFromError(error, this.runsRoot),
      }, { now: this.now(), includeDetail });
    }
  }

  async listRuns() {
    const index = await this.readIndex();
    const runs = await mapWithConcurrency(Object.values(index.runs), RUN_READ_CONCURRENCY, (entry) => this.readRunEntry(entry));
    return runs.sort(sortByUpdatedAtDesc);
  }

  async getRun(runId) {
    const index = await this.readIndex();
    const entry = index.runs[runId];
    if (!entry) return undefined;
    return this.readRunEntry(entry, { includeDetail: true });
  }
}
