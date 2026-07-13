/** Bounded, read-only adapter over durable run state. Whole-index failures propagate. */
import { existsSync } from "node:fs";
// @ts-expect-error Durable persistence is legacy MJS; runtime schemas remain authoritative.
import { readRunsIndex, runsIndexPathsForRoot } from "../../persistence/run-state/run-index.mjs";
// @ts-expect-error Durable persistence is legacy MJS; runtime schemas remain authoritative.
import { resolveRunPaths } from "../../persistence/run-state/paths.mjs";
// @ts-expect-error Durable persistence is legacy MJS; runtime schemas remain authoritative.
import { readPersistedRunState } from "../../persistence/run-state/PersistedRunStateReader.mjs";
// @ts-expect-error Durable persistence is legacy MJS; runtime schemas remain authoritative.
import * as runAuthority from "../../persistence/run-state/run-authority.mjs";
// @ts-expect-error Workflow document reader is legacy MJS and read-only.
import { readWorkflowDocument } from "../../persistence/workflow-resources/workflow-document-reader.mjs";
import { projectRunDetail, projectRunSummary } from "../projection/project-run";
import type { RunDetailDTO, RunSummaryDTO } from "../contracts/browser";

const { mergeRunAuthorityIntoIndexEntry, readRunAuthority, runAuthorityFromIndexEntry } =
  runAuthority;

const RUN_READ_CONCURRENCY = 16;

async function mapWithConcurrency<T, R>(
  values: Array<T>,
  limit: number,
  mapper: (value: T) => Promise<R>,
): Promise<Array<R>> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await mapper(values[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
}

function sortRuns(left: any, right: any): number {
  return (
    String(right.updatedAt ?? "").localeCompare(String(left.updatedAt ?? "")) ||
    String(left.runId).localeCompare(String(right.runId))
  );
}

export class RunsRootObserverReader {
  private readonly workflowCache = new Map<string, unknown>();

  constructor(
    readonly runsRoot: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async readIndex(signal?: AbortSignal): Promise<any> {
    signal?.throwIfAborted();
    return readRunsIndex(runsIndexPathsForRoot(this.runsRoot));
  }

  private workflowDocument(workflowPath: unknown): unknown {
    if (typeof workflowPath !== "string" || !workflowPath) {
      return undefined;
    }
    if (!this.workflowCache.has(workflowPath)) {
      this.workflowCache.set(workflowPath, readWorkflowDocument(workflowPath, "workflow"));
    }
    return this.workflowCache.get(workflowPath);
  }

  private async loadEntry(
    entry: any,
    signal?: AbortSignal,
  ): Promise<{ degraded?: boolean; persistedState?: any; run: any; workflowDocument?: any }> {
    try {
      signal?.throwIfAborted();
      const lookupPaths = resolveRunPaths({
        runId: entry.runId,
        runsRoot: this.runsRoot,
        workflowPath: entry.workflow?.path,
      });
      const authority =
        (await readRunAuthority(lookupPaths)) ?? runAuthorityFromIndexEntry(lookupPaths, entry);
      signal?.throwIfAborted();
      const run = mergeRunAuthorityIntoIndexEntry(entry, authority);
      const paths = resolveRunPaths({
        runId: run.runId,
        runsRoot: this.runsRoot,
        workflowPath: run.workflow?.path,
      });
      if (!existsSync(paths.batonPath)) {
        return { run, workflowDocument: this.workflowDocument(run.workflow?.path) };
      }
      const persistedState = await readPersistedRunState(paths);
      signal?.throwIfAborted();
      return { persistedState, run, workflowDocument: this.workflowDocument(run.workflow?.path) };
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      return { degraded: true, run: entry };
    }
  }

  async listRuns(signal?: AbortSignal): Promise<Array<RunSummaryDTO>> {
    const index = await this.readIndex(signal);
    const entries = Object.values(index.runs ?? {}).sort(sortRuns);
    return mapWithConcurrency(entries, RUN_READ_CONCURRENCY, async (entry) =>
      projectRunSummary(await this.loadEntry(entry, signal), { now: this.now() }),
    );
  }

  async getRun(runId: string, signal?: AbortSignal): Promise<RunDetailDTO | undefined> {
    const index = await this.readIndex(signal);
    const entry = index.runs?.[runId];
    if (!entry) {
      return undefined;
    }
    return projectRunDetail(await this.loadEntry(entry, signal), { now: this.now() });
  }
}
