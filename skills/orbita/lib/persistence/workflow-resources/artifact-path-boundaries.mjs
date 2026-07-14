import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  openSync,
  realpathSync,
} from "node:fs";
import { open as openAsync } from "node:fs/promises";
import { isAbsolute, parse, relative, resolve, sep } from "node:path";

function isInsideDirectory(filePath, directory) {
  const rel = relative(directory, filePath);
  return rel.length > 0 && !rel.startsWith("..") && !isAbsolute(rel);
}

function descriptorPath(descriptor, child) {
  const root = existsSync("/proc/self/fd") ? "/proc/self/fd" : "/dev/fd";
  return child === undefined ? `${root}/${descriptor}` : `${root}/${descriptor}/${child}`;
}

function pathSegments(pathname) {
  const absolute = resolve(pathname);
  const root = parse(absolute).root;
  const rest = relative(root, absolute);
  return { root, segments: rest ? rest.split(sep).filter(Boolean) : [] };
}

function openDirectoryChainSync(directory) {
  const { root, segments } = pathSegments(directory);
  const directoryFlags =
    constants.O_RDONLY | (constants.O_DIRECTORY ?? 0) | (constants.O_NOFOLLOW ?? 0);
  let descriptor = openSync(root, directoryFlags);
  try {
    for (const segment of segments) {
      const next = openSync(descriptorPath(descriptor, segment), directoryFlags);
      closeSync(descriptor);
      descriptor = next;
    }
    return descriptor;
  } catch (error) {
    closeSync(descriptor);
    throw error;
  }
}

function openArtifactFileDescriptor(pathname, artifactOutputDir) {
  const expectedDir = resolve(artifactOutputDir);
  const artifactPath = resolve(pathname);
  if (!isInsideDirectory(artifactPath, expectedDir)) {
    const error = new Error("outside artifact output directory");
    error.code = "EBOUNDARY";
    throw error;
  }
  const relativePath = relative(expectedDir, artifactPath);
  const canonicalExpectedDir = realpathSync.native(expectedDir);
  const segments = relativePath.split(sep).filter(Boolean);
  const leaf = segments.pop();
  if (!leaf) {
    const error = new Error("artifact path must name a file");
    error.code = "EBOUNDARY";
    throw error;
  }
  const directoryFlags =
    constants.O_RDONLY | (constants.O_DIRECTORY ?? 0) | (constants.O_NOFOLLOW ?? 0);
  let directoryDescriptor = openDirectoryChainSync(canonicalExpectedDir);
  try {
    const namedDirectory = lstatSync(expectedDir);
    const openedDirectory = fstatSync(directoryDescriptor);
    if (
      !namedDirectory.isDirectory() ||
      namedDirectory.dev !== openedDirectory.dev ||
      namedDirectory.ino !== openedDirectory.ino
    ) {
      const error = new Error("artifact output directory changed or is a symlink");
      error.code = "ELOOP";
      throw error;
    }
    for (const segment of segments) {
      const next = openSync(descriptorPath(directoryDescriptor, segment), directoryFlags);
      closeSync(directoryDescriptor);
      directoryDescriptor = next;
    }
    return openSync(
      descriptorPath(directoryDescriptor, leaf),
      constants.O_RDONLY | constants.O_NONBLOCK | (constants.O_NOFOLLOW ?? 0),
    );
  } finally {
    closeSync(directoryDescriptor);
  }
}

export function artifactPathBoundaryErrors(output, artifactOutputDir) {
  return artifactPathBoundaryInspection(output, artifactOutputDir).errors;
}

function acceptedFileStamp(stat) {
  return {
    device: stat.dev,
    inode: stat.ino,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    ctimeMs: stat.ctimeMs,
  };
}

function inspectRegularFile(pathname, artifactOutputDir) {
  let descriptor;
  try {
    descriptor = openArtifactFileDescriptor(pathname, artifactOutputDir);
    const opened = fstatSync(descriptor);
    if (!opened.isFile()) return { error: "must be an existing regular file" };
    return { acceptedFileStamp: acceptedFileStamp(opened) };
  } catch (error) {
    const code = typeof error?.code === "string" ? error.code : "unreadable";
    if (code === "ELOOP" || code === "ENOTDIR") {
      return {
        error:
          "must not traverse symlinks; artifact output directory must be exact and not a symlink",
      };
    }
    return { error: `must be an existing regular file (${code})` };
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

/**
 * Reopen through the same trusted directory-handle walk used at acceptance.
 * The duplicate FileHandle remains bound to the opened inode even if a parent
 * directory is renamed or swapped immediately afterwards.
 */
export async function openArtifactFileWithinDirectory(pathname, artifactOutputDir) {
  const descriptor = openArtifactFileDescriptor(pathname, artifactOutputDir);
  try {
    return await openAsync(descriptorPath(descriptor), constants.O_RDONLY | constants.O_NONBLOCK);
  } finally {
    closeSync(descriptor);
  }
}

export function artifactPathBoundaryInspection(output, artifactOutputDir) {
  if (
    artifactOutputDir === undefined ||
    !output ||
    typeof output !== "object" ||
    Array.isArray(output) ||
    !Object.hasOwn(output, "artifacts") ||
    !Array.isArray(output.artifacts)
  )
    return { errors: [], acceptedFiles: [] };

  const errors = [];
  const acceptedFiles = [];
  const expectedDir = resolve(artifactOutputDir);
  for (const [index, artifact] of output.artifacts.entries()) {
    if (
      !artifact ||
      typeof artifact !== "object" ||
      Array.isArray(artifact) ||
      typeof artifact.path !== "string" ||
      !isAbsolute(artifact.path)
    )
      continue;
    const artifactPath = resolve(artifact.path);
    if (!isInsideDirectory(artifactPath, expectedDir)) {
      errors.push(
        `/artifacts/${index}/path must be a file under artifact output directory: ${artifactOutputDir}`,
      );
      continue;
    }
    const inspected = inspectRegularFile(artifactPath, expectedDir);
    if (inspected.error) {
      errors.push(`/artifacts/${index}/path ${inspected.error}: ${artifact.path}`);
      continue;
    }
    acceptedFiles.push({ id: artifact.id, acceptedFileStamp: inspected.acceptedFileStamp });
  }
  return { errors, acceptedFiles };
}
