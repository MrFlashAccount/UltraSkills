import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, test } from 'bun:test';
import { buildTokenLease, hashLeaseToken } from '../persistence/run-state/lease-authority.mjs';
import { resolveRunPaths } from '../persistence/run-state/paths.mjs';
import { createRunIndexEntry, upsertRunIndexEntry } from '../persistence/run-state/run-index.mjs';
import { withRunStateLock } from '../persistence/run-state/lock.mjs';
import {
  readRunAuthority,
  readRunAuthorityWithLegacyFallback,
  runAuthorityRecord,
  writeRunAuthority,
} from '../persistence/run-state/run-authority.mjs';

const tempDir = mkdtempSync(path.join(tmpdir(), 'run-authority-'));
const runsRoot = path.join(tempDir, 'runs');
const workflowPath = path.join(tempDir, 'workflow.json');
writeFileSync(workflowPath, '{}\n');

afterAll(() => rmSync(tempDir, { recursive: true, force: true }));

function pathsFor(label) {
  return resolveRunPaths({ runId: `run-authority-${process.pid}-${label}`, workflowPath, runsRoot });
}

test('per-run authority persists only token hash authority and canonical binding', async () => {
  const paths = pathsFor('canonical');
  const leaseToken = 'private-run-authority-token';
  const authority = runAuthorityRecord(paths, {
    workflowIdentity: 'authority-workflow',
    claimContext: { harness: 'codex' },
    workerLease: buildTokenLease({ token: leaseToken, leaseMs: 60_000, now: new Date('2026-06-01T10:00:00.000Z') }),
  });

  await assert.rejects(() => writeRunAuthority(paths, authority), /active run-state lock scope/);
  await withRunStateLock(paths, () => writeRunAuthority(paths, authority, { createOnly: true }));

  const storedText = readFileSync(paths.authorityPath, 'utf8');
  const stored = await readRunAuthority(paths);
  assert.equal(stored.runId, paths.runId);
  assert.equal(stored.workflow.path, workflowPath);
  assert.equal(stored.workerLease.tokenHash, hashLeaseToken(leaseToken));
  assert.equal(storedText.includes(leaseToken), false);

  await assert.rejects(
    () => withRunStateLock(paths, () => writeRunAuthority(paths, {
      ...stored,
      workerLease: { ...stored.workerLease, token: leaseToken },
    })),
    /run authority failed schema validation.*additional properties|workerLease.*additional properties/i,
  );
});

test('legacy index authority is readable until the per-run record becomes canonical', async () => {
  const paths = pathsFor('legacy-fallback');
  const leaseToken = 'legacy-authority-token';
  const entry = await createRunIndexEntry(paths, {
    status: 'needs_host_actions',
    workflowPath,
    claimContext: { harness: 'portable' },
    workerLease: buildTokenLease({ token: leaseToken, leaseMs: 60_000, now: new Date('2026-06-01T10:00:00.000Z') }),
  });

  assert.equal(await readRunAuthority(paths), undefined);
  const fallback = await readRunAuthorityWithLegacyFallback(paths);
  assert.equal(fallback.status, 'needs_host_actions');
  assert.equal(fallback.workerLease.tokenHash, hashLeaseToken(leaseToken));

  await withRunStateLock(paths, () => writeRunAuthority(paths, fallback, { createOnly: true }));
  await upsertRunIndexEntry(paths, { status: 'failed', workerLease: null });

  const canonical = await readRunAuthorityWithLegacyFallback(paths);
  assert.equal(canonical.status, entry.status);
  assert.equal(canonical.workerLease.tokenHash, hashLeaseToken(leaseToken));
});

test('per-run authority rejects corrupt records instead of falling back to the index', async () => {
  const paths = pathsFor('corrupt');
  await createRunIndexEntry(paths, { workflowPath, workerLease: null });
  mkdirSync(paths.runnerDir, { recursive: true });
  writeFileSync(paths.authorityPath, '{"schemaVersion":1}\n');

  await assert.rejects(
    () => readRunAuthorityWithLegacyFallback(paths),
    /run authority failed schema validation|cannot parse workflow run authority/,
  );
});

test('per-run authority rejects symlinked storage without reading or overwriting its target', async () => {
  const paths = pathsFor('symlink');
  const outside = path.join(tempDir, 'outside-authority.json');
  writeFileSync(outside, '{"secret":"outside"}\n');
  mkdirSync(paths.runnerDir, { recursive: true });
  symlinkSync(outside, paths.authorityPath, 'file');

  await assert.rejects(() => readRunAuthority(paths), /workflow run authority is unsafe because it is a symlink/);
  assert.equal(readFileSync(outside, 'utf8'), '{"secret":"outside"}\n');
});
