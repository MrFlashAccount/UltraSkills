/** Concrete bounded reads over durable runs. Board reads open workflow bytes only to recover a missing legacy identity. */
import { createHash } from "node:crypto";
import { constants, existsSync } from "node:fs";
import { open } from "node:fs/promises";
// @ts-expect-error Durable persistence is legacy MJS; runtime schemas remain authoritative.
import { readRunsIndex, runsIndexPathsForRoot } from "../../persistence/run-state/run-index.mjs";
// @ts-expect-error Durable persistence is legacy MJS; runtime schemas remain authoritative.
import { resolveRunPaths } from "../../persistence/run-state/paths.mjs";
// @ts-expect-error Durable persistence is legacy MJS; runtime schemas remain authoritative.
import { readPersistedRunState } from "../../persistence/run-state/PersistedRunStateReader.mjs";
// @ts-expect-error Durable persistence is legacy MJS; runtime schemas remain authoritative.
import * as runAuthority from "../../persistence/run-state/run-authority.mjs";
// @ts-expect-error Workflow document reader is legacy MJS and read-only.
import { parseWorkflowDocument } from "../../persistence/workflow-resources/workflow-document-reader.mjs";
import type {
  ActivityPageDTO,
  ArtifactPageDTO,
  LogsPageDTO,
  RunLightDetailDTO,
  RunSummaryDTO,
  TraversalPageDTO,
  WorkflowPageDTO,
} from "../contracts/browser";
import { projectArtifactPage } from "../projection/project-artifacts";
import {
  artifactProducerBelongsToStep,
  parseManagedHistoryEntries,
  projectActivityPage,
  projectLogsPage,
  projectTraversalPage,
} from "../projection/project-history";
import { projectRunLightDetail, projectRunSummary } from "../projection/project-run";
import { projectWorkflowPage } from "../projection/project-workflow";
import {
  probeArtifactEntry,
  verifiedArtifactHandle,
  type VerifiedArtifactHandle,
} from "./artifact-content-reader.server";
import {
  historySnapshotIdentity,
  readBoundedHistoryPage,
  type HistorySnapshot,
} from "./bounded-history-reader.server";
import { locatorSecretForRunsRoot, OpaqueLocatorCodec } from "./opaque-locator.server";

const { mergeRunAuthorityIntoIndexEntry, readRunAuthority, runAuthorityFromIndexEntry } =
  runAuthority;
const RUN_READ_CONCURRENCY = 16;
const LAZY_IO_CONCURRENCY = 8;
const WORKFLOW_FILE_MAX_BYTES = 8_388_608;

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

function artifactIdentity(entry: any): object {
  return {
    artifactId: entry?.artifact?.id,
    producerStepId: entry?.producerStepId,
  };
}

function snapshotFromIdentity(identity: string): HistorySnapshot {
  const parts = identity.split(":").map(Number);
  if (parts.length !== 3 || parts.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error("stale_locator");
  }
  return { device: parts[0]!, inode: parts[1]!, snapshotSize: parts[2]! };
}

export class RunsRootObserverReader {
  private readonly locators: OpaqueLocatorCodec;
  private readonly workflowIdentityLookups = new Map<string, Promise<string | undefined>>();

  constructor(
    readonly runsRoot: string,
    private readonly now: () => Date = () => new Date(),
    locators?: OpaqueLocatorCodec,
  ) {
    this.locators = locators ?? new OpaqueLocatorCodec(locatorSecretForRunsRoot(runsRoot));
  }

  private async readIndex(signal?: AbortSignal): Promise<any> {
    signal?.throwIfAborted();
    return readRunsIndex(runsIndexPathsForRoot(this.runsRoot));
  }

  private async indexedRun(runId: string, signal?: AbortSignal): Promise<any | undefined> {
    const index = await this.readIndex(signal);
    return index.runs?.[runId];
  }

  private async loadEntry(
    entry: any,
    signal?: AbortSignal,
  ): Promise<{ degraded?: boolean; paths?: any; persistedState?: any; run: any }> {
    try {
      signal?.throwIfAborted();
      const lookupPaths = resolveRunPaths({
        runId: entry.runId,
        runsRoot: this.runsRoot,
        workflowPath: entry.workflow?.path,
      });
      const authority =
        (await readRunAuthority(lookupPaths)) ?? runAuthorityFromIndexEntry(lookupPaths, entry);
      let run = mergeRunAuthorityIntoIndexEntry(entry, authority);
      if (typeof run.workflow?.identity !== "string" && typeof run.workflow?.path === "string") {
        const identity = await this.workflowIdentityFromDocument(run);
        signal?.throwIfAborted();
        if (identity) {
          run = { ...run, workflow: { ...run.workflow, identity } };
        }
      }
      const paths = resolveRunPaths({
        runId: run.runId,
        runsRoot: this.runsRoot,
        workflowPath: run.workflow?.path,
      });
      if (!existsSync(paths.batonPath)) {
        return { paths, run };
      }
      const persistedState = await readPersistedRunState(paths, { includeHistoryText: false });
      signal?.throwIfAborted();
      return { paths, persistedState, run };
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      return { degraded: true, run: entry };
    }
  }

  private artifactRef(runId: string, entry: any): string {
    return this.locators.ref("artifact", { runId, ...artifactIdentity(entry) });
  }

  private workflowIdentityFromDocument(run: any): Promise<string | undefined> {
    const workflowPath = run.workflow.path as string;
    const cached = this.workflowIdentityLookups.get(workflowPath);
    if (cached) {
      return cached;
    }
    const lookup = this.workflowDocument({ run })
      .then((workflow) =>
        typeof workflow?.name === "string" && workflow.name.length > 0 ? workflow.name : undefined,
      )
      .catch(() => undefined);
    this.workflowIdentityLookups.set(workflowPath, lookup);
    return lookup;
  }

  private async workflowDocument(entry: any, signal?: AbortSignal): Promise<any> {
    const workflowPath = entry.run?.workflow?.path;
    if (typeof workflowPath !== "string") {
      throw new Error("not_found");
    }
    signal?.throwIfAborted();
    const handle = await open(
      workflowPath,
      constants.O_RDONLY | constants.O_NONBLOCK | (constants.O_NOFOLLOW ?? 0),
    );
    try {
      const before = await handle.stat();
      if (!before.isFile() || before.size > WORKFLOW_FILE_MAX_BYTES) {
        throw new Error("content_unavailable");
      }
      const content = Buffer.alloc(before.size);
      const { bytesRead } = await handle.read(content, 0, content.length, 0);
      const after = await handle.stat();
      if (
        bytesRead !== before.size ||
        before.dev !== after.dev ||
        before.ino !== after.ino ||
        before.size !== after.size ||
        before.mtimeMs !== after.mtimeMs ||
        before.ctimeMs !== after.ctimeMs
      ) {
        throw new Error("stale_locator");
      }
      return parseWorkflowDocument(content.toString("utf8"), workflowPath, "workflow");
    } finally {
      await handle.close();
    }
  }

  async listRuns(signal?: AbortSignal): Promise<Array<RunSummaryDTO>> {
    const index = await this.readIndex(signal);
    const entries = Object.values(index.runs ?? {}).sort(sortRuns);
    return mapWithConcurrency(entries, RUN_READ_CONCURRENCY, async (entry) =>
      projectRunSummary(await this.loadEntry(entry, signal), { now: this.now() }),
    );
  }

  async getRunLight(runId: string, signal?: AbortSignal): Promise<RunLightDetailDTO | undefined> {
    const indexed = await this.indexedRun(runId, signal);
    if (!indexed) {
      return undefined;
    }
    const entry = await this.loadEntry(indexed, signal);
    return projectRunLightDetail(entry, { now: this.now() });
  }

  async getWorkflowPage(
    runId: string,
    cursor?: string,
    signal?: AbortSignal,
  ): Promise<WorkflowPageDTO | undefined> {
    const indexed = await this.indexedRun(runId, signal);
    if (!indexed) {
      return undefined;
    }
    const entry = await this.loadEntry(indexed, signal);
    const workflowPath = entry.run?.workflow?.path;
    if (typeof workflowPath !== "string") {
      throw new Error("not_found");
    }
    signal?.throwIfAborted();
    const handle = await open(
      workflowPath,
      constants.O_RDONLY | constants.O_NONBLOCK | (constants.O_NOFOLLOW ?? 0),
    );
    let content: Buffer;
    try {
      const before = await handle.stat();
      if (!before.isFile() || before.size > WORKFLOW_FILE_MAX_BYTES) {
        throw new Error("content_unavailable");
      }
      content = Buffer.alloc(before.size);
      const { bytesRead } = await handle.read(content, 0, content.length, 0);
      const after = await handle.stat();
      if (
        bytesRead !== before.size ||
        before.dev !== after.dev ||
        before.ino !== after.ino ||
        before.size !== after.size ||
        before.mtimeMs !== after.mtimeMs ||
        before.ctimeMs !== after.ctimeMs
      ) {
        throw new Error("stale_locator");
      }
    } finally {
      await handle.close();
    }
    signal?.throwIfAborted();
    const fingerprint = createHash("sha256").update(content).digest("base64url");
    const parsedCursor = cursor
      ? this.locators.parseCursor(cursor, { resource: "workflow", runId })
      : undefined;
    const offset = parsedCursor?.offset ?? 0;
    if (parsedCursor && parsedCursor.identity !== fingerprint) {
      throw new Error("stale_locator");
    }
    const workflow = parseWorkflowDocument(content.toString("utf8"), workflowPath, "workflow");
    const total = Object.keys(workflow?.steps ?? {}).length;
    const nextOffset = offset + 200;
    return projectWorkflowPage({
      fingerprint,
      ...(nextOffset < total
        ? {
            nextCursor: this.locators.cursor({
              identity: fingerprint,
              offset: nextOffset,
              resource: "workflow",
              runId,
            }),
          }
        : {}),
      offset,
      runId,
      workflow,
    });
  }

  private async historyPage(
    entry: any,
    runId: string,
    resource: "traversal" | "activity" | "logs",
    cursor?: string,
    signal?: AbortSignal,
    scope?: string,
  ) {
    if (!entry.paths) {
      throw new Error("not_found");
    }
    let snapshot: HistorySnapshot | undefined;
    let before: number | undefined;
    if (cursor) {
      const parsed = this.locators.parseCursor(cursor, {
        resource,
        runId,
        ...(scope ? { scope } : {}),
      });
      snapshot = snapshotFromIdentity(parsed.identity);
      before = parsed.offset;
    }
    const page = await readBoundedHistoryPage(entry.paths.historyPath, {
      ...(before === undefined ? {} : { before }),
      ...(signal === undefined ? {} : { signal }),
      ...(snapshot === undefined ? {} : { snapshot }),
      // One transition entry can contain the owner event plus at most 16 bounded
      // fanout/shard request facts. Eleven whole entries therefore stay below
      // the 200-event Activity contract without splitting or dropping facts.
      maxEntries: resource === "traversal" ? 100 : resource === "activity" ? 11 : 200,
    });
    const nextCursor =
      page.nextOffset === undefined
        ? undefined
        : this.locators.cursor({
            identity: historySnapshotIdentity(page.snapshot),
            offset: page.nextOffset,
            resource,
            runId,
            ...(scope ? { scope } : {}),
          });
    return {
      entries: parseManagedHistoryEntries(page.text),
      nextCursor,
      truncated: page.truncated,
    };
  }

  async getTraversalPage(
    runId: string,
    cursor?: string,
    signal?: AbortSignal,
  ): Promise<TraversalPageDTO | undefined> {
    const indexed = await this.indexedRun(runId, signal);
    if (!indexed) {
      return undefined;
    }
    const entry = await this.loadEntry(indexed, signal);
    const historyPages: Array<Awaited<ReturnType<RunsRootObserverReader["historyPage"]>>> = [];
    let historyCursor = cursor;
    for (let pageIndex = 0; pageIndex < 128; pageIndex += 1) {
      const page = await this.historyPage(entry, runId, "traversal", historyCursor, signal);
      historyPages.push(page);
      if (!page.nextCursor) {
        break;
      }
      historyCursor = page.nextCursor;
    }
    const entries = historyPages.toReversed().flatMap((page) => page.entries);
    const currentStepId =
      typeof entry.persistedState?.baton?.cursor === "string"
        ? entry.persistedState.baton.cursor
        : undefined;
    return projectTraversalPage({
      complete: historyPages.at(-1)?.nextCursor === undefined,
      ...(currentStepId ? { currentStepId } : {}),
      entries,
      runId,
      truncated: historyPages.at(-1)?.nextCursor !== undefined,
      workflowDocument: await this.workflowDocument(entry, signal),
    });
  }

  async getActivityPage(
    runId: string,
    stepId: string,
    cursor?: string,
    signal?: AbortSignal,
  ): Promise<ActivityPageDTO | undefined> {
    const indexed = await this.indexedRun(runId, signal);
    if (!indexed) {
      return undefined;
    }
    const entry = await this.loadEntry(indexed, signal);
    const workflowDocument = await this.workflowDocument(entry, signal);
    let historyCursor = cursor;
    for (let pageIndex = 0; pageIndex < 128; pageIndex += 1) {
      const page = await this.historyPage(entry, runId, "activity", historyCursor, signal, stepId);
      const projected = projectActivityPage({
        complete: page.nextCursor === undefined,
        entries: page.entries,
        ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
        runId,
        stepId,
        truncated: page.truncated,
        workflowDocument,
      });
      if (projected.items.length > 0 || !page.nextCursor) {
        return projected;
      }
      historyCursor = page.nextCursor;
    }
    throw new Error("content_unavailable");
  }

  async getLogsPage(
    runId: string,
    stepId: string,
    cursor?: string,
    signal?: AbortSignal,
  ): Promise<LogsPageDTO | undefined> {
    const indexed = await this.indexedRun(runId, signal);
    if (!indexed) {
      return undefined;
    }
    const entry = await this.loadEntry(indexed, signal);
    const workflowDocument = await this.workflowDocument(entry, signal);
    let historyCursor = cursor;
    for (let pageIndex = 0; pageIndex < 128; pageIndex += 1) {
      const page = await this.historyPage(entry, runId, "logs", historyCursor, signal, stepId);
      const projected = projectLogsPage({
        complete: page.nextCursor === undefined,
        entries: page.entries,
        ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
        runId,
        stepId,
        truncated: page.truncated,
        workflowDocument,
      });
      if (projected.entries.length > 0 || !page.nextCursor) {
        return projected;
      }
      historyCursor = page.nextCursor;
    }
    throw new Error("content_unavailable");
  }

  async getArtifactPage(
    runId: string,
    stepId: string,
    cursor?: string,
    signal?: AbortSignal,
  ): Promise<ArtifactPageDTO | undefined> {
    const indexed = await this.indexedRun(runId, signal);
    if (!indexed) {
      return undefined;
    }
    const entry = await this.loadEntry(indexed, signal);
    if (!entry.paths) {
      throw new Error("not_found");
    }
    const all = Array.isArray(entry.persistedState?.baton?.state?.artifacts)
      ? entry.persistedState.baton.state.artifacts
      : [];
    const workflowDocument = await this.workflowDocument(entry, signal);
    const scoped = all.filter((artifact: any) =>
      artifactProducerBelongsToStep(workflowDocument, artifact?.producerStepId, stepId),
    );
    const scopeKey = `workflow_step:${stepId}`;
    const identity = createHash("sha256")
      .update(JSON.stringify(scoped.map(artifactIdentity)))
      .digest("base64url");
    const parsedCursor = cursor
      ? this.locators.parseCursor(cursor, {
          resource: "artifacts",
          runId,
          scope: scopeKey,
        })
      : undefined;
    const offset = parsedCursor?.offset ?? 0;
    if (parsedCursor && parsedCursor.identity !== identity) {
      throw new Error("stale_locator");
    }
    const selected = scoped.slice(offset, offset + 100);
    const files = new Map<string, { contentType: string; size: number }>();
    await mapWithConcurrency(selected, LAZY_IO_CONCURRENCY, async (artifact: any) => {
      signal?.throwIfAborted();
      const ref = this.artifactRef(runId, artifact);
      files.set(
        ref,
        await probeArtifactEntry(entry.paths, artifact, signal).catch((error) => {
          if (signal?.aborted) {
            throw error;
          }
          return { contentType: "application/octet-stream", size: 0 };
        }),
      );
    });
    signal?.throwIfAborted();
    const nextOffset = offset + selected.length;
    return projectArtifactPage({
      artifacts: selected,
      complete: nextOffset >= scoped.length,
      files,
      encodeArtifactRef: (artifact) => this.artifactRef(runId, artifact),
      ...(nextOffset < scoped.length
        ? {
            nextCursor: this.locators.cursor({
              identity,
              offset: nextOffset,
              resource: "artifacts",
              runId,
              scope: scopeKey,
            }),
          }
        : {}),
      runAggregateCount: all.length,
      runId,
      stepId,
    });
  }

  async getArtifactHandle(
    runId: string,
    artifactRef: string,
    signal?: AbortSignal,
  ): Promise<VerifiedArtifactHandle | undefined> {
    const indexed = await this.indexedRun(runId, signal);
    if (!indexed) {
      return undefined;
    }
    const entry = await this.loadEntry(indexed, signal);
    if (!entry.paths) {
      return undefined;
    }
    const artifacts = Array.isArray(entry.persistedState?.baton?.state?.artifacts)
      ? entry.persistedState.baton.state.artifacts
      : [];
    const identity = this.locators.resolveRef(artifactRef, { kind: "artifact", runId });
    let artifact: any;
    for (let index = 0; index < Math.min(artifacts.length, 100_000); index += 1) {
      if (index % 256 === 0) {
        signal?.throwIfAborted();
      }
      const candidate = artifacts[index];
      if (
        JSON.stringify(artifactIdentity(candidate)) ===
        JSON.stringify({
          artifactId: identity.artifactId,
          producerStepId: identity.producerStepId,
        })
      ) {
        artifact = candidate;
        break;
      }
    }
    if (!artifact) {
      return undefined;
    }
    return verifiedArtifactHandle(entry.paths, artifact, signal);
  }
}
