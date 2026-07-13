/** Framework-neutral HTTP handlers used by the three TanStack Start GET routes. */
import {
  InvalidationEventSchema,
  PublicErrorSchema,
  RUN_ACTIVITY_PAGE_MAX_UTF8_BYTES,
  RUN_DETAIL_MAX_UTF8_BYTES,
  RUN_OUTPUTS_MAX_UTF8_BYTES,
  RunActivityPageSchema,
  RunDetailSchema,
  RunOutputsSchema,
  SnapshotEnvelopeSchema,
} from "../../../../dashboard/contracts/browser";
import {
  getDashboardComposition,
  isDashboardConfigurationError,
  isObserverUnavailable,
} from "./dashboard-composition.server";

type Composition = ReturnType<typeof getDashboardComposition>;

const JSON_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
};

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), { headers: { ...JSON_HEADERS, ...headers }, status });
}

function publicError(
  code: "not_found" | "method_not_allowed" | "observer_unavailable" | "invalid_request",
  message: string,
  status: number,
): Response {
  return json(PublicErrorSchema.parse({ error: { code, message } }), status);
}

function etag(snapshot: {
  freshness: { observerRevision: string };
  snapshotVersion: string;
}): string {
  return `"dashboard-v1-s${snapshot.snapshotVersion}-o${snapshot.freshness.observerRevision}"`;
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
  const expectedAuthority =
    config.port === 0 ? undefined : `${host}${config.port === 80 ? "" : `:${config.port}`}`;
  const requestAuthority = (request.headers.get("host") ?? url.host).toLowerCase();
  if (requestAuthority !== url.host.toLowerCase()) {
    return false;
  }
  if (
    expectedAuthority
      ? requestAuthority !== expectedAuthority
      : url.hostname.replaceAll(/^\[|\]$/gu, "").toLowerCase() !==
        host.replaceAll(/^\[|\]$/gu, "").toLowerCase()
  ) {
    return false;
  }
  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }
  try {
    const parsed = new URL(origin);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.origin.toLowerCase() === url.origin.toLowerCase()
    );
  } catch {
    return false;
  }
}

function authorityError(): Response {
  return publicError("invalid_request", "Request authority is not allowed", 403);
}

export async function handleSnapshotRequest(
  request: Request,
  providedComposition?: Composition,
): Promise<Response> {
  if (request.method !== "GET") {
    return publicError("method_not_allowed", "Only GET is allowed", 405);
  }
  try {
    const composition = providedComposition ?? getDashboardComposition();
    if (!hasAllowedAuthority(request, composition.config)) {
      return authorityError();
    }
    const snapshot = SnapshotEnvelopeSchema.parse(await composition.readModel.ensureSnapshot());
    const tag = etag(snapshot);
    if (request.headers.get("if-none-match") === tag) {
      return new Response(null, {
        status: 304,
        headers: { etag: tag, "cache-control": "no-store" },
      });
    }
    const body = JSON.stringify(snapshot);
    if (new TextEncoder().encode(body).byteLength > 1.5 * 1024 * 1024) {
      return publicError("observer_unavailable", "Dashboard data is temporarily unavailable", 503);
    }
    return new Response(body, { headers: { ...JSON_HEADERS, etag: tag }, status: 200 });
  } catch (error) {
    if (isDashboardConfigurationError(error)) {
      return publicError("invalid_request", "Dashboard runs root is not configured", 503);
    }
    if (isObserverUnavailable(error)) {
      return publicError("observer_unavailable", "Dashboard data is temporarily unavailable", 503);
    }
    return publicError("observer_unavailable", "Dashboard data is temporarily unavailable", 503);
  }
}

export async function handleDetailRequest(
  request: Request,
  rawRunId: string,
  providedComposition?: Composition,
): Promise<Response> {
  if (request.method !== "GET") {
    return publicError("method_not_allowed", "Only GET is allowed", 405);
  }
  let runId: string;
  try {
    runId = decodeURIComponent(rawRunId);
  } catch {
    return publicError("invalid_request", "Invalid run id", 400);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u.test(runId)) {
    return publicError("invalid_request", "Invalid run id", 400);
  }
  try {
    const composition = providedComposition ?? getDashboardComposition();
    if (!hasAllowedAuthority(request, composition.config)) {
      return authorityError();
    }
    const snapshot = await composition.readModel.ensureSnapshot();
    const tag = `"dashboard-v1-detail-s${snapshot.snapshotVersion}-o${snapshot.freshness.observerRevision}-${runId}"`;
    if (request.headers.get("if-none-match") === tag) {
      return new Response(null, {
        headers: { etag: tag, "cache-control": "no-store" },
        status: 304,
      });
    }
    const detail = await composition.readModel.getDetail(runId);
    if (!detail) {
      return publicError("not_found", "Run not found", 404);
    }
    const validated = RunDetailSchema.parse(detail);
    const body = JSON.stringify(validated);
    if (new TextEncoder().encode(body).byteLength > RUN_DETAIL_MAX_UTF8_BYTES) {
      return publicError("observer_unavailable", "Run detail is temporarily unavailable", 503);
    }
    return new Response(body, { headers: { ...JSON_HEADERS, etag: tag }, status: 200 });
  } catch (error) {
    if (isDashboardConfigurationError(error)) {
      return publicError("invalid_request", "Dashboard runs root is not configured", 503);
    }
    return publicError("observer_unavailable", "Run detail is temporarily unavailable", 503);
  }
}

function requestStepId(
  request: Request,
): { ok: true; stepId?: string } | { ok: false; response: Response } {
  const stepId = new URL(request.url).searchParams.get("step") ?? undefined;
  if (stepId && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u.test(stepId)) {
    return { ok: false, response: publicError("invalid_request", "Invalid step id", 400) };
  }
  return { ok: true, ...(stepId ? { stepId } : {}) };
}

export async function handleActivityRequest(
  request: Request,
  rawRunId: string,
  providedComposition?: Composition,
): Promise<Response> {
  if (request.method !== "GET") {
    return publicError("method_not_allowed", "Only GET is allowed", 405);
  }
  let runId: string;
  try {
    runId = decodeURIComponent(rawRunId);
  } catch {
    return publicError("invalid_request", "Invalid run id", 400);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u.test(runId)) {
    return publicError("invalid_request", "Invalid run id", 400);
  }
  const stepRequest = requestStepId(request);
  if (!stepRequest.ok) {
    return stepRequest.response;
  }
  const rawCursor = new URL(request.url).searchParams.get("cursor") ?? "0";
  if (!/^\d{1,9}$/u.test(rawCursor)) {
    return publicError("invalid_request", "Invalid activity cursor", 400);
  }
  try {
    const composition = providedComposition ?? getDashboardComposition();
    if (!hasAllowedAuthority(request, composition.config)) {
      return authorityError();
    }
    const activity = await composition.readModel.getActivity(runId, {
      cursor: Number(rawCursor),
      limit: 20,
      ...(stepRequest.stepId ? { stepId: stepRequest.stepId } : {}),
    });
    if (!activity) {
      return publicError("not_found", "Run not found", 404);
    }
    const body = JSON.stringify(RunActivityPageSchema.parse(activity));
    if (new TextEncoder().encode(body).byteLength > RUN_ACTIVITY_PAGE_MAX_UTF8_BYTES) {
      return publicError("observer_unavailable", "Run detail is temporarily unavailable", 503);
    }
    return new Response(body, { headers: JSON_HEADERS });
  } catch {
    return publicError("observer_unavailable", "Run detail is temporarily unavailable", 503);
  }
}

export async function handleOutputsRequest(
  request: Request,
  rawRunId: string,
  providedComposition?: Composition,
): Promise<Response> {
  if (request.method !== "GET") {
    return publicError("method_not_allowed", "Only GET is allowed", 405);
  }
  let runId: string;
  try {
    runId = decodeURIComponent(rawRunId);
  } catch {
    return publicError("invalid_request", "Invalid run id", 400);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u.test(runId)) {
    return publicError("invalid_request", "Invalid run id", 400);
  }
  const stepRequest = requestStepId(request);
  if (!stepRequest.ok) {
    return stepRequest.response;
  }
  try {
    const composition = providedComposition ?? getDashboardComposition();
    if (!hasAllowedAuthority(request, composition.config)) {
      return authorityError();
    }
    const outputs = await composition.readModel.getOutputs(
      runId,
      stepRequest.stepId ? { stepId: stepRequest.stepId } : {},
    );
    if (!outputs) {
      return publicError("not_found", "Run not found", 404);
    }
    const body = JSON.stringify(RunOutputsSchema.parse(outputs));
    if (new TextEncoder().encode(body).byteLength > RUN_OUTPUTS_MAX_UTF8_BYTES) {
      return publicError("observer_unavailable", "Run detail is temporarily unavailable", 503);
    }
    return new Response(body, { headers: JSON_HEADERS });
  } catch {
    return publicError("observer_unavailable", "Run detail is temporarily unavailable", 503);
  }
}

export async function handleArtifactRequest(
  request: Request,
  rawRunId: string,
  rawArtifactId: string,
  providedComposition?: Composition,
): Promise<Response> {
  if (request.method !== "GET") {
    return publicError("method_not_allowed", "Only GET is allowed", 405);
  }
  let runId: string;
  let artifactId: string;
  try {
    runId = decodeURIComponent(rawRunId);
    artifactId = decodeURIComponent(rawArtifactId);
  } catch {
    return publicError("invalid_request", "Invalid run id", 400);
  }
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u.test(runId) ||
    !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u.test(artifactId)
  ) {
    return publicError("invalid_request", "Invalid run id", 400);
  }
  const stepRequest = requestStepId(request);
  if (!stepRequest.ok) {
    return stepRequest.response;
  }
  if (!stepRequest.stepId) {
    return publicError("invalid_request", "Invalid step id", 400);
  }
  try {
    const composition = providedComposition ?? getDashboardComposition();
    if (!hasAllowedAuthority(request, composition.config)) {
      return authorityError();
    }
    const artifact = await composition.readModel.getArtifact(runId, {
      artifactId,
      stepId: stepRequest.stepId,
    });
    if (!artifact) {
      return publicError("not_found", "Run not found", 404);
    }
    return new Response(artifact.bytes as BodyInit, {
      headers: {
        "cache-control": "private, no-store",
        "content-disposition": "inline",
        "content-type": artifact.contentType,
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return publicError("observer_unavailable", "Run detail is temporarily unavailable", 503);
  }
}

export function handleEventsRequest(request: Request, providedComposition?: Composition): Response {
  if (request.method !== "GET") {
    return publicError("method_not_allowed", "Only GET is allowed", 405);
  }
  let composition: Composition;
  try {
    composition = providedComposition ?? getDashboardComposition();
  } catch (error) {
    return isDashboardConfigurationError(error)
      ? publicError("invalid_request", "Dashboard runs root is not configured", 503)
      : publicError("observer_unavailable", "Dashboard data is temporarily unavailable", 503);
  }
  if (!hasAllowedAuthority(request, composition.config)) {
    return authorityError();
  }
  const { config, readModel } = composition;
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
          // The stream may already be closed by the client abort path.
        }
      };
      unsubscribe = readModel.subscribe((event) => {
        if (closed) {
          return;
        }
        const invalidation = InvalidationEventSchema.parse(event);
        controller.enqueue(
          encoder.encode(
            `id: ${invalidation.changeId}\nevent: invalidation\ndata: ${JSON.stringify(invalidation)}\n\n`,
          ),
        );
      });
      heartbeat = setInterval(() => {
        if (!closed) {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        }
      }, config.heartbeatMs);
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
