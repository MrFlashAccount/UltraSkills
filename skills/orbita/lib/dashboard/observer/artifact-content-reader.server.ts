/** Canonical artifact reopen, stamp revalidation, MIME probing, and verified-handle streaming. */
import { closeSync, constants, fstatSync, lstatSync, openSync, realpathSync } from "node:fs";
import { open as openAsync, type FileHandle } from "node:fs/promises";
import { isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { artifactContentLimit, artifactPreviewState } from "../projection/project-artifacts";

export type VerifiedArtifactHandle = {
  close(): Promise<void>;
  contentLimit: number;
  createReadStream(range?: { end: number; start: number }): NodeJS.ReadableStream;
  declaredContentType: string;
  effectiveContentType: string;
  filename: string;
  mimeMismatch: boolean;
  previewEligible: boolean;
  size: number;
  stampTag: string;
};

function descriptorPath(descriptor: number, child?: string): string {
  const root = "/proc/self/fd";
  return child === undefined ? `${root}/${descriptor}` : `${root}/${descriptor}/${child}`;
}

function openDirectoryChain(directory: string): number {
  const absolute = resolve(directory);
  const root = parse(absolute).root;
  const segments = relative(root, absolute).split(sep).filter(Boolean);
  const flags = constants.O_RDONLY | (constants.O_DIRECTORY ?? 0) | (constants.O_NOFOLLOW ?? 0);
  let descriptor = openSync(root, flags);
  try {
    for (const segment of segments) {
      const next = openSync(descriptorPath(descriptor, segment), flags);
      closeSync(descriptor);
      descriptor = next;
    }
    return descriptor;
  } catch (error) {
    closeSync(descriptor);
    throw error;
  }
}

async function openArtifactFileWithinDirectory(
  pathname: string,
  artifactOutputDir: string,
): Promise<FileHandle> {
  const expectedDir = resolve(artifactOutputDir);
  const rel = relative(expectedDir, resolve(pathname));
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error("content_unavailable");
  }
  const segments = rel.split(sep).filter(Boolean);
  const leaf = segments.pop();
  if (!leaf) {
    throw new Error("content_unavailable");
  }
  const canonicalExpectedDir = realpathSync.native(expectedDir);
  const directoryFlags =
    constants.O_RDONLY | (constants.O_DIRECTORY ?? 0) | (constants.O_NOFOLLOW ?? 0);
  let directoryDescriptor = openDirectoryChain(canonicalExpectedDir);
  try {
    const namedDirectory = lstatSync(expectedDir);
    const openedDirectory = fstatSync(directoryDescriptor);
    if (
      !namedDirectory.isDirectory() ||
      namedDirectory.dev !== openedDirectory.dev ||
      namedDirectory.ino !== openedDirectory.ino
    ) {
      throw new Error("content_unavailable");
    }
    for (const segment of segments) {
      const next = openSync(descriptorPath(directoryDescriptor, segment), directoryFlags);
      closeSync(directoryDescriptor);
      directoryDescriptor = next;
    }
    const descriptor = openSync(
      descriptorPath(directoryDescriptor, leaf),
      constants.O_RDONLY | constants.O_NONBLOCK | (constants.O_NOFOLLOW ?? 0),
    );
    try {
      return await openAsync(descriptorPath(descriptor), constants.O_RDONLY | constants.O_NONBLOCK);
    } finally {
      closeSync(descriptor);
    }
  } catch {
    throw new Error("content_unavailable");
  } finally {
    closeSync(directoryDescriptor);
  }
}

function statMatches(left: any, right: any): boolean {
  return (
    left.dev === right?.dev &&
    left.ino === right?.ino &&
    left.size === right?.size &&
    left.mtimeMs === right?.mtimeMs &&
    left.ctimeMs === right?.ctimeMs
  );
}

function artifactOutputDirectory(paths: any, entry: any, pathname: string): string {
  const runDir = resolve(paths.runDir);
  const rel = relative(runDir, resolve(pathname));
  const segments = rel.split(sep).filter(Boolean);
  const requestId = segments[0];
  const producerStepId = entry?.producerStepId;
  if (
    rel.startsWith("..") ||
    isAbsolute(rel) ||
    segments.length < 3 ||
    segments[1] !== "artifacts" ||
    typeof requestId !== "string" ||
    !/^[A-Za-z_][A-Za-z0-9_-]*$/u.test(requestId) ||
    typeof producerStepId !== "string" ||
    (requestId !== producerStepId && !requestId.endsWith(`__${producerStepId}`))
  ) {
    throw new Error("content_unavailable");
  }
  return join(runDir, requestId, "artifacts");
}

function looksText(buffer: Buffer): boolean {
  return !buffer.includes(0) && !buffer.toString("utf8").includes("�");
}

export function classifyEffectiveMime(buffer: Buffer, declared: string, complete = false): string {
  const normalizedDeclared = declared.toLowerCase();
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return "image/png";
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer
      .subarray(0, 6)
      .toString("ascii")
      .match(/^GIF8[79]a$/u)
  ) {
    return "image/gif";
  }
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WAVE"
  ) {
    return "audio/wav";
  }
  if (buffer.subarray(0, 4).toString("ascii") === "OggS") {
    return normalizedDeclared.startsWith("video/") ? normalizedDeclared : "audio/ogg";
  }
  if (buffer.subarray(0, 3).toString("ascii") === "ID3") {
    return "audio/mpeg";
  }
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    return normalizedDeclared.startsWith("audio/") ? normalizedDeclared : "video/mp4";
  }
  const text = buffer.toString("utf8").trimStart().slice(0, 1024).toLowerCase();
  if (looksText(buffer) && /^(?:<\?xml[^>]*>\s*)?<svg(?:\s|>)/u.test(text)) {
    return "image/svg+xml";
  }
  if (
    looksText(buffer) &&
    (/^<!doctype html(?:\s|>)/u.test(text) || /^<html(?:\s|>)/u.test(text))
  ) {
    return "text/html";
  }
  if (looksText(buffer) && normalizedDeclared === "application/json") {
    if (!complete) {
      return "application/octet-stream";
    }
    try {
      JSON.parse(buffer.toString("utf8"));
      return "application/json";
    } catch {
      return "application/octet-stream";
    }
  }
  if (
    looksText(buffer) &&
    (normalizedDeclared.startsWith("text/") || normalizedDeclared === "image/svg+xml")
  ) {
    return normalizedDeclared;
  }
  return "application/octet-stream";
}

async function openVerifiedArtifact(
  paths: any,
  entry: any,
  signal?: AbortSignal,
): Promise<{ effectiveContentType: string; handle: FileHandle; stat: any }> {
  signal?.throwIfAborted();
  const pathname = entry?.artifact?.path;
  if (typeof pathname !== "string" || !isAbsolute(pathname)) {
    throw new Error("content_unavailable");
  }
  const expectedDir = artifactOutputDirectory(paths, entry, pathname);
  let handle: FileHandle;
  try {
    handle = await openArtifactFileWithinDirectory(pathname, expectedDir);
  } catch {
    throw new Error("content_unavailable");
  }
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) {
      throw new Error("content_unavailable");
    }
    const probe = Buffer.alloc(Math.min(8192, stat.size));
    const { bytesRead } = await handle.read(probe, 0, probe.length, 0);
    signal?.throwIfAborted();
    let effectiveContentType = classifyEffectiveMime(
      probe.subarray(0, bytesRead),
      entry.artifact.content_type,
      stat.size <= 8192,
    );
    if (entry.artifact.content_type.toLowerCase() === "application/json") {
      if (stat.size <= 1_048_576 && stat.size > probe.length) {
        const completeJson = Buffer.alloc(stat.size);
        const { bytesRead: jsonBytesRead } = await handle.read(
          completeJson,
          0,
          completeJson.length,
          0,
        );
        signal?.throwIfAborted();
        if (jsonBytesRead !== stat.size) {
          throw new Error("content_unavailable");
        }
        effectiveContentType = classifyEffectiveMime(
          completeJson,
          entry.artifact.content_type,
          true,
        );
      } else if (
        stat.size > 1_048_576 &&
        looksText(probe.subarray(0, bytesRead)) &&
        /^(?:\{|\[)/u.test(probe.subarray(0, bytesRead).toString("utf8").trimStart())
      ) {
        effectiveContentType = "application/json";
      }
    }
    const restat = await handle.stat();
    if (!statMatches(restat, stat)) {
      throw new Error("content_unavailable");
    }
    return { effectiveContentType, handle, stat };
  } catch (error) {
    await handle.close();
    throw error;
  }
}

export async function probeArtifactEntry(
  paths: any,
  entry: any,
  signal?: AbortSignal,
): Promise<{ contentType: string; size: number }> {
  const opened = await openVerifiedArtifact(paths, entry, signal);
  await opened.handle.close();
  return { contentType: opened.effectiveContentType, size: opened.stat.size };
}

export async function verifiedArtifactHandle(
  paths: any,
  entry: any,
  signal?: AbortSignal,
): Promise<VerifiedArtifactHandle> {
  const opened = await openVerifiedArtifact(paths, entry, signal);
  const pathname = entry.artifact.path as string;
  const declaredContentType = entry.artifact.content_type.toLowerCase();
  const mimeMismatch = declaredContentType !== opened.effectiveContentType.toLowerCase();
  try {
    if (opened.stat.size > 67_108_864) {
      throw new Error("content_unavailable");
    }
    const snapshot = Buffer.alloc(opened.stat.size);
    let offset = 0;
    while (offset < snapshot.length) {
      signal?.throwIfAborted();
      const length = Math.min(65_536, snapshot.length - offset);
      const { bytesRead } = await opened.handle.read(snapshot, offset, length, offset);
      if (bytesRead <= 0) {
        throw new Error("content_unavailable");
      }
      offset += bytesRead;
    }
    const restat = await opened.handle.stat();
    if (!statMatches(restat, opened.stat)) {
      throw new Error("content_unavailable");
    }
    await opened.handle.close();
    return {
      close: async () => {},
      contentLimit: artifactContentLimit(opened.effectiveContentType) || 67_108_864,
      createReadStream: (range) => {
        const start = range?.start ?? 0;
        const end = range?.end ?? snapshot.length - 1;
        return Readable.from([snapshot.subarray(start, end + 1)]);
      },
      declaredContentType,
      effectiveContentType: opened.effectiveContentType,
      filename: pathname.split(/[\\/]/u).at(-1) ?? "artifact",
      mimeMismatch,
      previewEligible:
        artifactPreviewState(declaredContentType, opened.effectiveContentType, opened.stat.size) ===
        "previewable",
      size: opened.stat.size,
      stampTag: `"${opened.stat.dev.toString(16)}-${opened.stat.ino.toString(16)}-${opened.stat.size.toString(16)}-${Math.trunc(opened.stat.mtimeMs).toString(16)}"`,
    };
  } catch (error) {
    await opened.handle.close().catch(() => {});
    throw error;
  }
}
