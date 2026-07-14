/** Framework-neutral HTTP v2 read handlers. Routes only validate/dispatch; projection and filesystem work stay behind the read model. */
import { Readable } from "node:stream";
import {
  ActivityPageSchema,
  ArtifactPageSchema,
  InvalidationEventSchema,
  LogsPageSchema,
  PublicErrorSchema,
  RunLightDetailSchema,
  SnapshotEnvelopeSchema,
  StepIdSchema,
  TraversalPageSchema,
  WorkflowPageSchema,
} from "../../../../dashboard/contracts/browser";
import {
  getDashboardComposition,
  isDashboardConfigurationError,
  isObserverUnavailable,
} from "./dashboard-composition.server";

type Composition = ReturnType<typeof getDashboardComposition>;
type ErrorCode =
  | "not_found"
  | "method_not_allowed"
  | "observer_unavailable"
  | "invalid_request"
  | "stale_locator"
  | "range_not_satisfiable"
  | "content_unavailable";

const JSON_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "referrer-policy": "no-referrer",
};

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), { headers: { ...JSON_HEADERS, ...headers }, status });
}

function publicError(code: ErrorCode, message: string, status: number): Response {
  return json(PublicErrorSchema.parse({ error: { code, message } }), status);
}

function configuredHost(config: Composition["config"]): string {
  return config.host.includes(":") && !config.host.startsWith("[")
    ? `[${config.host}]`
    : config.host.toLowerCase();
}

function hasAllowedAuthority(request: Request, config: Composition["config"]): boolean {
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return false;
  }
  const host = configuredHost(config);
  const expected =
    config.port === 0 ? undefined : `${host}${config.port === 80 ? "" : `:${config.port}`}`;
  const authority = (request.headers.get("host") ?? url.host).toLowerCase();
  if (authority !== url.host.toLowerCase()) {
    return false;
  }
  if (
    expected
      ? authority !== expected
      : url.hostname.replaceAll(/^\[|\]$/gu, "").toLowerCase() !==
        host.replaceAll(/^\[|\]$/gu, "").toLowerCase()
  ) {
    return false;
  }
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") {
    return origin !== "null";
  }
  try {
    const parsed = new URL(origin);
    return (
      ["http:", "https:"].includes(parsed.protocol) &&
      parsed.origin.toLowerCase() === url.origin.toLowerCase()
    );
  } catch {
    return false;
  }
}

function hasPrivateFetchMetadata(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  const destination = request.headers.get("sec-fetch-dest");
  const mode = request.headers.get("sec-fetch-mode");
  if (site !== "same-origin") {
    return false;
  }
  if (destination !== "empty") {
    return false;
  }
  if (!mode || !["cors", "same-origin"].includes(mode)) {
    return false;
  }
  return true;
}

function hasPreviewFetchMetadata(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  const destination = request.headers.get("sec-fetch-dest");
  const mode = request.headers.get("sec-fetch-mode");
  if (site !== "same-origin") {
    return false;
  }
  return (
    (destination === "iframe" && mode === "navigate") ||
    (destination === "empty" && !!mode && ["cors", "same-origin"].includes(mode))
  );
}

function authorityError(): Response {
  return publicError("invalid_request", "Request authority is not allowed", 403);
}

function runId(raw: string): string | undefined {
  try {
    const decoded = decodeURIComponent(raw);
    return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u.test(decoded) ? decoded : undefined;
  } catch {
    return undefined;
  }
}

function locator(value: string | null, required = false): string | undefined {
  if (!value) {
    return required ? undefined : undefined;
  }
  return value.length <= 512 && /^[A-Za-z0-9_-]+$/u.test(value) ? value : undefined;
}

function hasOnlyQueryKeys(request: Request, allowed: ReadonlySet<string>): boolean {
  const params = new URL(request.url).searchParams;
  return (
    [...params.keys()].every((key) => allowed.has(key)) &&
    [...allowed].every((key) => params.getAll(key).length <= 1)
  );
}

function requestContext(
  request: Request,
  provided?: Composition,
  preview = false,
): Composition | Response {
  if (request.method !== "GET") {
    return publicError("method_not_allowed", "Only GET is allowed", 405);
  }
  let composition: Composition;
  try {
    composition = provided ?? getDashboardComposition();
  } catch (error) {
    return isDashboardConfigurationError(error)
      ? publicError("invalid_request", "Dashboard runs root is not configured", 503)
      : publicError("observer_unavailable", "Dashboard data is temporarily unavailable", 503);
  }
  if (
    !hasAllowedAuthority(request, composition.config) ||
    !(preview ? hasPreviewFetchMetadata(request) : hasPrivateFetchMetadata(request))
  ) {
    return authorityError();
  }
  return composition;
}

function mapReadError(error: unknown): Response {
  if (isDashboardConfigurationError(error)) {
    return publicError("invalid_request", "Dashboard runs root is not configured", 503);
  }
  if (isObserverUnavailable(error)) {
    return publicError("observer_unavailable", "Dashboard data is temporarily unavailable", 503);
  }
  if ((error as Error)?.message === "stale_locator") {
    return publicError("stale_locator", "Resource locator is stale", 409);
  }
  if ((error as Error)?.message === "content_unavailable") {
    return publicError("content_unavailable", "Artifact content is unavailable", 409);
  }
  if ((error as Error)?.message === "not_found") {
    return publicError("not_found", "Resource not found", 404);
  }
  return publicError("observer_unavailable", "Dashboard data is temporarily unavailable", 503);
}

function boundedJson(value: unknown, maxBytes: number): Response {
  const body = JSON.stringify(value);
  if (Buffer.byteLength(body, "utf8") > maxBytes) {
    return publicError("observer_unavailable", "Dashboard data is temporarily unavailable", 503);
  }
  return new Response(body, { headers: JSON_HEADERS });
}

function isResponse(value: Response | Composition): value is Response {
  return "headers" in value && "status" in value;
}

export async function handleSnapshotRequest(
  request: Request,
  provided?: Composition,
): Promise<Response> {
  if (!hasOnlyQueryKeys(request, new Set())) {
    return publicError("invalid_request", "Invalid request", 400);
  }
  const context = requestContext(request, provided);
  if (isResponse(context)) {
    return context;
  }
  try {
    const snapshot = SnapshotEnvelopeSchema.parse(await context.readModel.ensureSnapshot());
    const tag = `"dashboard-v2-s${snapshot.snapshotVersion}-o${snapshot.freshness.observerRevision}"`;
    if (request.headers.get("if-none-match") === tag) {
      return new Response(null, {
        status: 304,
        headers: { "cache-control": "no-store", etag: tag },
      });
    }
    const response = boundedJson(snapshot, 1_572_864);
    response.headers.set("etag", tag);
    return response;
  } catch (error) {
    return mapReadError(error);
  }
}

export async function handleLightDetailRequest(
  request: Request,
  rawRunId: string,
  provided?: Composition,
): Promise<Response> {
  if (!hasOnlyQueryKeys(request, new Set())) {
    return publicError("invalid_request", "Invalid request", 400);
  }
  const context = requestContext(request, provided);
  if (isResponse(context)) {
    return context;
  }
  const id = runId(rawRunId);
  if (!id) {
    return publicError("invalid_request", "Invalid request", 400);
  }
  try {
    const detail = await context.readModel.getLightDetail(id, request.signal);
    return detail
      ? boundedJson(RunLightDetailSchema.parse(detail), 65_536)
      : publicError("not_found", "Run not found", 404);
  } catch (error) {
    return mapReadError(error);
  }
}

async function pageRequest(
  request: Request,
  rawRunId: string,
  provided: Composition | undefined,
  kind: "workflow" | "traversal" | "activity" | "logs" | "artifacts",
): Promise<Response> {
  const context = requestContext(request, provided);
  if (isResponse(context)) {
    return context;
  }
  const id = runId(rawRunId);
  if (!id) {
    return publicError("invalid_request", "Invalid request", 400);
  }
  const url = new URL(request.url);
  const allowedKeys = new Set([
    "cursor",
    ...(["activity", "logs", "artifacts"].includes(kind) ? ["stepId"] : []),
  ]);
  if (
    [...url.searchParams.keys()].some((key) => !allowedKeys.has(key)) ||
    [...allowedKeys].some((key) => url.searchParams.getAll(key).length > 1)
  ) {
    return publicError("invalid_request", "Invalid request", 400);
  }
  const rawCursor = url.searchParams.get("cursor");
  const cursor = rawCursor === null ? undefined : locator(rawCursor, true);
  if (rawCursor !== null && !cursor) {
    return publicError("invalid_request", "Invalid request", 400);
  }
  const rawStepId = url.searchParams.get("stepId");
  const workflowStepId = rawStepId === null ? undefined : StepIdSchema.safeParse(rawStepId).data;
  if (rawStepId !== null && !workflowStepId) {
    return publicError("invalid_request", "Invalid request", 400);
  }
  if (["activity", "logs", "artifacts"].includes(kind) && !workflowStepId) {
    return publicError("invalid_request", "Invalid request", 400);
  }
  try {
    const value =
      kind === "workflow"
        ? await context.readModel.getWorkflowPage(id, cursor, request.signal)
        : kind === "traversal"
          ? await context.readModel.getTraversalPage(id, cursor, request.signal)
          : kind === "activity"
            ? await context.readModel.getActivityPage(id, workflowStepId!, cursor, request.signal)
            : kind === "logs"
              ? await context.readModel.getLogsPage(id, workflowStepId!, cursor, request.signal)
              : await context.readModel.getArtifactPage(
                  id,
                  workflowStepId!,
                  cursor,
                  request.signal,
                );
    if (!value) {
      return publicError("not_found", "Run not found", 404);
    }
    const schema =
      kind === "workflow"
        ? WorkflowPageSchema
        : kind === "traversal"
          ? TraversalPageSchema
          : kind === "activity"
            ? ActivityPageSchema
            : kind === "logs"
              ? LogsPageSchema
              : ArtifactPageSchema;
    return boundedJson(schema.parse(value), kind === "workflow" ? 262_144 : 65_536);
  } catch (error) {
    return mapReadError(error);
  }
}

export const handleWorkflowRequest = (request: Request, run: string, composition?: Composition) =>
  pageRequest(request, run, composition, "workflow");
export const handleTraversalRequest = (request: Request, run: string, composition?: Composition) =>
  pageRequest(request, run, composition, "traversal");
export const handleActivityRequest = (request: Request, run: string, composition?: Composition) =>
  pageRequest(request, run, composition, "activity");
export const handleLogsRequest = (request: Request, run: string, composition?: Composition) =>
  pageRequest(request, run, composition, "logs");
export const handleArtifactsRequest = (request: Request, run: string, composition?: Composition) =>
  pageRequest(request, run, composition, "artifacts");

function rangeFor(
  value: string | null,
  size: number,
): { end: number; start: number } | undefined | false {
  if (!value) {
    return undefined;
  }
  if (value.includes(",")) {
    return false;
  }
  const match = /^bytes=(\d*)-(\d*)$/u.exec(value);
  if (!match || (!match[1] && !match[2])) {
    return false;
  }
  let start: number;
  let end: number;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) {
      return false;
    }
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }
  return Number.isSafeInteger(start) &&
    Number.isSafeInteger(end) &&
    start >= 0 &&
    start <= end &&
    end < size
    ? { start, end }
    : false;
}

export async function handleArtifactContentRequest(
  request: Request,
  rawRunId: string,
  rawArtifactRef: string,
  provided?: Composition,
): Promise<Response> {
  const mode = new URL(request.url).searchParams.get("mode");
  const contentUrl = new URL(request.url);
  if (
    [...contentUrl.searchParams.keys()].some((key) => key !== "mode") ||
    contentUrl.searchParams.getAll("mode").length !== 1
  ) {
    return publicError("invalid_request", "Invalid request", 400);
  }
  const context = requestContext(request, provided, mode === "preview");
  if (isResponse(context)) {
    return context;
  }
  const id = runId(rawRunId);
  const artifactRef = locator(rawArtifactRef, true);
  if (!id || !artifactRef || !["preview", "download"].includes(mode ?? "")) {
    return publicError("invalid_request", "Invalid request", 400);
  }
  try {
    const artifact = await context.readModel.getArtifactHandle(id, artifactRef, request.signal);
    if (!artifact) {
      return publicError("not_found", "Resource not found", 404);
    }
    if (artifact.size > artifact.contentLimit) {
      await artifact.close();
      return publicError("content_unavailable", "Artifact content is unavailable", 413);
    }
    if (mode === "preview" && !artifact.previewEligible) {
      await artifact.close();
      return publicError("content_unavailable", "Artifact content is unavailable", 409);
    }
    const allowRange =
      mode === "download" ||
      artifact.effectiveContentType === "application/pdf" ||
      artifact.effectiveContentType.startsWith("audio/") ||
      artifact.effectiveContentType.startsWith("video/");
    const range = rangeFor(request.headers.get("range"), artifact.size);
    if (range === false || (range && !allowRange)) {
      await artifact.close();
      const response = publicError(
        "range_not_satisfiable",
        "Requested range is not satisfiable",
        416,
      );
      response.headers.set("content-range", `bytes */${artifact.size}`);
      return response;
    }
    const filename =
      artifact.filename.replaceAll(/[^A-Za-z0-9._-]/gu, "_").slice(0, 160) || "artifact";
    const headers = new Headers({
      "accept-ranges": allowRange ? "bytes" : "none",
      "cache-control": "no-store",
      "content-disposition": `${mode === "download" ? "attachment" : "inline"}; filename="${filename}"`,
      "content-length": String(range ? range.end - range.start + 1 : artifact.size),
      "content-type": artifact.effectiveContentType,
      "cross-origin-resource-policy": "same-origin",
      etag: artifact.stampTag,
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    });
    if (range) {
      headers.set("content-range", `bytes ${range.start}-${range.end}/${artifact.size}`);
    }
    if (["text/html", "image/svg+xml"].includes(artifact.effectiveContentType)) {
      headers.set(
        "content-security-policy",
        "sandbox allow-scripts; default-src 'none'; img-src data: blob: https: http:; media-src data: blob: https: http:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src https: http:",
      );
    }
    const nodeStream = artifact.createReadStream(range || undefined);
    nodeStream.once("end", () => void artifact.close());
    nodeStream.once("error", () => void artifact.close());
    request.signal.addEventListener(
      "abort",
      () => {
        (nodeStream as any).destroy?.();
        void artifact.close();
      },
      { once: true },
    );
    return new Response(Readable.toWeb(nodeStream as any) as unknown as ReadableStream, {
      headers,
      status: range ? 206 : 200,
    });
  } catch (error) {
    return mapReadError(error);
  }
}

export function handleEventsRequest(request: Request, provided?: Composition): Response {
  if (!hasOnlyQueryKeys(request, new Set())) {
    return publicError("invalid_request", "Invalid request", 400);
  }
  const context = requestContext(request, provided);
  if (isResponse(context)) {
    return context;
  }
  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      if (heartbeat) {
        clearInterval(heartbeat);
      }
      unsubscribe();
    },
    start(controller) {
      let closed = false;
      const close = () => {
        if (closed) {
          return;
        }
        closed = true;
        if (heartbeat) {
          clearInterval(heartbeat);
        }
        unsubscribe();
        try {
          controller.close();
        } catch {
          // The consumer may have already closed the stream.
        }
      };
      unsubscribe = context.readModel.subscribe((event) => {
        if (!closed) {
          const value = InvalidationEventSchema.parse(event);
          controller.enqueue(
            encoder.encode(
              `id: ${value.changeId}\nevent: invalidation\ndata: ${JSON.stringify(value)}\n\n`,
            ),
          );
        }
      });
      heartbeat = setInterval(() => {
        if (!closed) {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        }
      }, context.config.heartbeatMs);
      heartbeat.unref?.();
      request.signal.addEventListener("abort", close, { once: true });
      controller.enqueue(encoder.encode(": connected\n\n"));
    },
  });
  return new Response(stream, {
    headers: {
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
      "x-accel-buffering": "no",
    },
  });
}
