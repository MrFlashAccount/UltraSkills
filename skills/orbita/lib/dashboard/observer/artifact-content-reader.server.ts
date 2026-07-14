/** Canonical artifact reopen, stamp revalidation, MIME probing, and verified-handle streaming. */
import { type FileHandle } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { Readable } from "node:stream";
// @ts-expect-error Durable path policy is legacy MJS.
import { artifactOutputDirForOccurrence } from "../../persistence/run-state/paths.mjs";
// @ts-expect-error Durable path policy is legacy MJS.
import { openArtifactFileWithinDirectory } from "../../persistence/workflow-resources/artifact-path-boundaries.mjs";
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

function stampMatches(stat: any, stamp: any): boolean {
  return (
    stat.dev === stamp?.device &&
    stat.ino === stamp?.inode &&
    stat.size === stamp?.size &&
    stat.mtimeMs === stamp?.mtimeMs &&
    stat.ctimeMs === stamp?.ctimeMs
  );
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
  const expectedDir = artifactOutputDirForOccurrence(paths, {
    occurrence: entry.producerOccurrence,
    ownerStepId: entry.producerStepId,
    producerRequestId: entry.producerRequestId,
  });
  let handle: FileHandle;
  try {
    handle = await openArtifactFileWithinDirectory(pathname, expectedDir);
  } catch {
    throw new Error("content_unavailable");
  }
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || !stampMatches(stat, entry.acceptedFileStamp)) {
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
    if (!stampMatches(restat, entry.acceptedFileStamp)) {
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
): Promise<string> {
  const opened = await openVerifiedArtifact(paths, entry, signal);
  await opened.handle.close();
  return opened.effectiveContentType;
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
    if (!stampMatches(restat, entry.acceptedFileStamp)) {
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
      stampTag: `"${entry.acceptedFileStamp.device.toString(16)}-${entry.acceptedFileStamp.inode.toString(16)}-${entry.acceptedFileStamp.size.toString(16)}-${Math.trunc(entry.acceptedFileStamp.mtimeMs).toString(16)}"`,
    };
  } catch (error) {
    await opened.handle.close().catch(() => {});
    throw error;
  }
}
