import { afterAll, describe, expect, test } from "bun:test";
import { appendFile, mkdir, mkdtemp, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  classifyEffectiveMime,
  probeArtifactEntry,
  verifiedArtifactHandle,
} from "./artifact-content-reader.server";

const roots: Array<string> = [];
afterAll(async () => Promise.all(roots.map((root) => rm(root, { force: true, recursive: true }))));

function stamp(value: Awaited<ReturnType<typeof stat>>) {
  return {
    device: value.dev,
    inode: value.ino,
    size: value.size,
    mtimeMs: value.mtimeMs,
    ctimeMs: value.ctimeMs,
  };
}

async function artifactFixture(bytes: string, contentType = "text/html") {
  const runDir = await mkdtemp(join(tmpdir(), "orbita-artifact-content-"));
  roots.push(runDir);
  const directory = join(
    runDir,
    "implementation",
    "occurrences",
    "1",
    "requests",
    "implementation",
    "artifacts",
  );
  await mkdir(directory, { recursive: true });
  const pathname = join(directory, "artifact.html");
  await writeFile(pathname, bytes);
  const accepted = await stat(pathname);
  return {
    entry: {
      producerStepId: "implementation",
      producerOccurrence: 1,
      producerRequestId: "implementation",
      acceptedFileStamp: stamp(accepted),
      artifact: { id: "artifact", content_type: contentType, path: pathname },
    },
    pathname,
    paths: { runDir },
  };
}

describe("canonical artifact content authority", () => {
  test("performs structural MIME classification instead of trusting declarations", () => {
    expect(classifyEffectiveMime(Buffer.from("not json"), "application/json", true)).toBe(
      "application/octet-stream",
    );
    expect(classifyEffectiveMime(Buffer.from('{"ok":true}'), "application/json", true)).toBe(
      "application/json",
    );
    expect(classifyEffectiveMime(Buffer.from("%PDF-1.7"), "text/plain", true)).toBe(
      "application/pdf",
    );
  });

  test("reopens the canonical accepted file and rejects replacement before streaming", async () => {
    const fixture = await artifactFixture("<!doctype html><title>safe</title>");
    expect(await probeArtifactEntry(fixture.paths, fixture.entry)).toBe("text/html");
    const handle = await verifiedArtifactHandle(fixture.paths, fixture.entry);
    expect(handle.previewEligible).toBe(true);
    await handle.close();

    const replacement = `${fixture.pathname}.replacement`;
    await writeFile(replacement, "<!doctype html><title>evil</title>");
    await rename(replacement, fixture.pathname);
    await expect(probeArtifactEntry(fixture.paths, fixture.entry)).rejects.toThrow(
      "content_unavailable",
    );
  });

  test("validates bounded JSON structure beyond the MIME probe window", async () => {
    const fixture = await artifactFixture(
      JSON.stringify({ payload: "x".repeat(16_384) }),
      "application/json",
    );
    expect(await probeArtifactEntry(fixture.paths, fixture.entry)).toBe("application/json");
  });

  test("rejects an intermediate parent replaced by a symlink", async () => {
    const fixture = await artifactFixture("<!doctype html><title>safe</title>");
    const ownerDirectory = join(fixture.paths.runDir, "implementation");
    const originalDirectory = `${ownerDirectory}.accepted`;
    const attackerDirectory = `${ownerDirectory}.attacker`;
    await rename(ownerDirectory, originalDirectory);
    await mkdir(attackerDirectory, { recursive: true });
    await symlink(attackerDirectory, ownerDirectory, "dir");

    await expect(probeArtifactEntry(fixture.paths, fixture.entry)).rejects.toThrow(
      "content_unavailable",
    );
  });

  test("streams only the immutable accepted snapshot after same-inode append", async () => {
    const original = "<!doctype html><title>safe</title>";
    const fixture = await artifactFixture(original);
    const verified = await verifiedArtifactHandle(fixture.paths, fixture.entry);
    await appendFile(fixture.pathname, "<script>changed()</script>");

    const chunks: Array<Buffer> = [];
    for await (const chunk of verified.createReadStream()) {
      chunks.push(Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).toString("utf8")).toBe(original);
    await verified.close();
  });
});
