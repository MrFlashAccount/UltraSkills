import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function durableFileSignature(pathname) {
  const stats = await stat(pathname);
  return `${resolve(pathname)}:${stats.dev}:${stats.ino}:${stats.mtimeMs}:${stats.ctimeMs}:${stats.size}`;
}
