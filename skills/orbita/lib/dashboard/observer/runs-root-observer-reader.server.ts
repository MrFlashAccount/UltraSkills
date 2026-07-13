/** Bounded, read-only adapter over durable run state. Whole-index failures propagate. */
import { existsSync } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import { sep } from "node:path";
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
import {
  projectRunActivity,
  projectRunDetail,
  projectRunOutputs,
  projectRunSummary,
} from "../projection/project-run";
import type {
  RunActivityPageDTO,
  RunDetailDTO,
  RunOutputsDTO,
  RunSummaryDTO,
} from "../contracts/browser";

const { mergeRunAuthorityIntoIndexEntry, readRunAuthority, runAuthorityFromIndexEntry } =
  runAuthority;

const RUN_READ_CONCURRENCY = 16;
const ARTIFACT_CONTENT_LIMITS = {
  "image/gif": 12 * 1024 * 1024,
  "image/jpeg": 12 * 1024 * 1024,
  "image/png": 12 * 1024 * 1024,
  "image/webp": 12 * 1024 * 1024,
  "text/markdown": 512 * 1024,
} as const;

export type RunArtifactContent = {
  bytes: Uint8Array;
  contentType: keyof typeof ARTIFACT_CONTENT_LIMITS;
};

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
    options: { includeHistoryText?: boolean } = {},
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
      let run = mergeRunAuthorityIntoIndexEntry(entry, authority);
      const paths = resolveRunPaths({
        runId: run.runId,
        runsRoot: this.runsRoot,
        workflowPath: run.workflow?.path,
      });
      const workflowDocument = this.workflowDocument(run.workflow?.path) as any;
      const workflowIdentity = run.workflow?.identity ?? workflowDocument?.name;
      if (workflowIdentity) {
        run = { ...run, workflow: { ...run.workflow, identity: workflowIdentity } };
      }
      if (!existsSync(paths.batonPath)) {
        return { run, workflowDocument };
      }
      const persistedState = await readPersistedRunState(paths, {
        includeHistoryText: options.includeHistoryText ?? false,
      });
      signal?.throwIfAborted();
      return { persistedState, run, workflowDocument };
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

  async getRunActivity(
    runId: string,
    options: { cursor?: number; limit?: number; stepId?: string } = {},
    signal?: AbortSignal,
  ): Promise<RunActivityPageDTO | undefined> {
    const index = await this.readIndex(signal);
    const entry = index.runs?.[runId];
    if (!entry) {
      return undefined;
    }
    return projectRunActivity(
      await this.loadEntry(entry, signal, { includeHistoryText: true }),
      options,
    );
  }

  async getRunOutputs(
    runId: string,
    options: { stepId?: string } = {},
    signal?: AbortSignal,
  ): Promise<RunOutputsDTO | undefined> {
    const index = await this.readIndex(signal);
    const entry = index.runs?.[runId];
    if (!entry) {
      return undefined;
    }
    return projectRunOutputs(await this.loadEntry(entry, signal), options);
  }

  async getRunArtifact(
    runId: string,
    options: { artifactId: string; stepId: string },
    signal?: AbortSignal,
  ): Promise<RunArtifactContent | undefined> {
    const index = await this.readIndex(signal);
    const entry = index.runs?.[runId];
    if (!entry) {
      return undefined;
    }
    const loaded = await this.loadEntry(entry, signal);
    const artifacts = loaded.persistedState?.baton?.state?.artifacts;
    if (!Array.isArray(artifacts)) {
      return undefined;
    }
    const match = artifacts.find((candidate: any) => {
      const artifact = candidate?.artifact ?? candidate;
      return artifact?.id === options.artifactId && candidate?.producerStepId === options.stepId;
    });
    const artifact = match?.artifact ?? match;
    const contentType = artifact?.content_type as keyof typeof ARTIFACT_CONTENT_LIMITS;
    if (
      typeof artifact?.path !== "string" ||
      !Object.hasOwn(ARTIFACT_CONTENT_LIMITS, contentType)
    ) {
      return undefined;
    }
    const paths = resolveRunPaths({
      runId: loaded.run.runId,
      runsRoot: this.runsRoot,
      workflowPath: loaded.run.workflow?.path,
    });
    const [realRunDir, realArtifactPath] = await Promise.all([
      realpath(paths.runDir),
      realpath(artifact.path),
    ]);
    if (!realArtifactPath.startsWith(`${realRunDir}${sep}`)) {
      return undefined;
    }
    const artifactStat = await stat(realArtifactPath);
    if (!artifactStat.isFile() || artifactStat.size > ARTIFACT_CONTENT_LIMITS[contentType]) {
      return undefined;
    }
    signal?.throwIfAborted();
    return { bytes: await readFile(realArtifactPath), contentType };
  }
}
