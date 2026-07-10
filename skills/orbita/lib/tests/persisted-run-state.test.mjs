import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, test } from 'bun:test';
import { assertPersistedRunState } from '../persistence/run-state/persisted-state-schema.mjs';
import { readPersistedRunState } from '../persistence/run-state/PersistedRunStateReader.mjs';
import { writeJsonAtomic } from '../persistence/run-state/atomic-file.mjs';
import { recoverDurableCommit } from '../persistence/run-state/durable-commit.mjs';
import { resolveRunPaths } from '../persistence/run-state/paths.mjs';
import { writePersistedRunStateUpdate } from '../persistence/run-state/PersistedRunStateWriter.mjs';
import { withRunStateLock } from '../persistence/run-state/lock.mjs';
import { durableFileSignature } from '../persistence/run-state/file-signature.mjs';

const tempDir = mkdtempSync(path.join(tmpdir(), 'persisted-run-state-'));

afterAll(() => rmSync(tempDir, { recursive: true, force: true }));

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function baton(overrides = {}) {
  return {
    cursor: 'prepare',
    status: 'running',
    state: { artifacts: [], results: [] },
    ...overrides,
  };
}

function response(nextBaton = baton()) {
  return {
    status: 'needs_host_actions',
    orchestratorInstruction: 'Execute persisted-state test request.',
    baton: nextBaton,
    requests: [
      {
        id: 'prepare',
        action: 'run_worker',
        stepId: 'prepare',
        loadInstructionsCommand: 'cat runner/instructions/prepare.md',
      },
    ],
  };
}

function setupRunDir(name, initialBaton = baton()) {
  const runId = `persisted-state-test-${process.pid}-${name}`;
  const workflowPath = path.join(tempDir, `${name}-workflow.json`);
  writeJson(workflowPath, { name: name.replace(/_/g, '-'), version: 1, start: 'prepare', done: 'done', steps: { prepare: { name: 'Prepare', kind: 'worker', output: { template: 'output.md' }, next: 'done' }, done: { name: 'Done', kind: 'done' } } });
  const paths = resolveRunPaths({ runId, workflowPath });
  rmSync(paths.runDir, { recursive: true, force: true });
  mkdirSync(paths.runnerDir, { recursive: true });
  mkdirSync(paths.instructionsDir, { recursive: true });
  writeJson(paths.batonPath, initialBaton);
  writeFileSync(paths.historyPath, '');
  return paths;
}

function pendingHistoryAppend({ id, baseExists = true, baseSize, entryText, nextBaton }) {
  const commit = {
    version: 2,
    id,
    createdAt: new Date().toISOString(),
    status: 'pending',
    historyAppend: {
      transactionId: id,
      baseExists,
      baseSize,
      entryText,
      entryHash: createHash('sha256').update(entryText).digest('hex'),
    },
    sideEffects: { baton: nextBaton !== undefined, history: true, currentRequests: false },
  };
  if (nextBaton !== undefined) commit.baton = nextBaton;
  return commit;
}

test('persisted-state reader validates logical aggregate over split files', async () => {
  const paths = setupRunDir('valid_split');
  const persisted = await readPersistedRunState(paths);

  assert.equal(persisted.version, 1);
  assert.equal(persisted.storageTopology, 'split-files-v1');
  assert.equal(persisted.baton.cursor, 'prepare');
  assert.equal(persisted.history.mode, 'embedded-text');
});

test('persisted-state reader can retain only a file reference and byte size for history', async () => {
  const paths = setupRunDir('history_file_ref');
  writeFileSync(paths.historyPath, 'history with unicode: π\n');

  const persisted = await readPersistedRunState(paths, { includeHistoryText: false });

  assert.equal(persisted.history.mode, 'file-ref');
  assert.equal(persisted.history.path, paths.historyPath);
  assert.equal(Object.hasOwn(persisted.history, 'text'), false);
});

test('persisted-state writer reuses and returns a snapshot from the active lock scope', async () => {
  const paths = setupRunDir('reuse_locked_snapshot');
  const nextBaton = baton({ cursor: 'done', status: 'done' });

  const after = await withRunStateLock(paths, async () => {
    const currentState = await readPersistedRunState(paths);
    return writePersistedRunStateUpdate(paths, {
      baton: nextBaton,
      history: { source: 'snapshot-reuse', baton: nextBaton },
    }, { currentState });
  });

  assert.equal(after.baton.cursor, 'done');
  assert.equal(after.baton.status, 'done');
  assert.match(after.history.text, /source: snapshot-reuse/);
  assert.equal(after.commit, undefined);
  assert.equal(Object.isFrozen(after), true);
  assert.equal(Object.isFrozen(after.baton), true);
  assert.equal(Object.isFrozen(after.baton.state), true);
  assert.throws(() => { after.baton.cursor = 'prepare'; }, TypeError);
});

test('persisted-state writer rejects snapshots read outside the active lock scope', async () => {
  const paths = setupRunDir('reject_prelock_snapshot');
  const currentState = await readPersistedRunState(paths);
  const nextBaton = baton({ cursor: 'done', status: 'done' });

  await assert.rejects(
    () => withRunStateLock(paths, () => writePersistedRunStateUpdate(paths, {
      baton: nextBaton,
      history: { source: 'unsafe-snapshot-reuse', baton: nextBaton },
    }, { currentState })),
    /snapshot must be read within the active run-state lock scope/,
  );

  assert.equal(readFileSync(paths.historyPath, 'utf8'), '');
});

test('persisted-state recovery supersedes a stale in-scope snapshot before a new commit', async () => {
  const paths = setupRunDir('pending_supersedes_snapshot');
  const recoveredBaton = baton({ cursor: 'done', status: 'done' });

  const after = await withRunStateLock(paths, async () => {
    const currentState = await readPersistedRunState(paths);
    writeJson(paths.durableCommitPath, {
      version: 1,
      id: 'pending-supersedes-snapshot',
      createdAt: new Date().toISOString(),
      status: 'pending',
      baton: recoveredBaton,
      historyText: 'recovered pending history\n',
      sideEffects: { baton: true, history: true },
    });
    return writePersistedRunStateUpdate(paths, {
      baton: recoveredBaton,
      history: { source: 'after-recovery', baton: recoveredBaton },
    }, { currentState });
  });

  assert.match(after.history.text, /recovered pending history/);
  assert.match(after.history.text, /source: after-recovery/);
  assert.equal(existsSync(paths.durableCommitPath), false);
});

test('persisted-state reused snapshot restores exact target bytes after commit failure', async () => {
  const paths = setupRunDir('snapshot_exact_rollback');
  writeFileSync(paths.batonPath, `${JSON.stringify(baton())}\n`);
  writeFileSync(paths.historyPath, 'history before snapshot rollback\n');
  writeFileSync(paths.currentRequestsPath, `${JSON.stringify([{ id: 'prepare', action: 'run_worker', stepId: 'prepare' }])}\n`);
  const before = {
    baton: readFileSync(paths.batonPath, 'utf8'),
    history: readFileSync(paths.historyPath, 'utf8'),
    currentRequests: readFileSync(paths.currentRequestsPath, 'utf8'),
  };

  process.env.WORKFLOW_RUNNER_FAIL_DURABLE_COMMIT_AFTER = 'history';
  try {
    await assert.rejects(
      () => withRunStateLock(paths, async () => {
        const currentState = await readPersistedRunState(paths, { includeHistoryText: false });
        assert.equal(currentState.history.mode, 'file-ref');
        const nextBaton = baton({ cursor: 'done', status: 'done' });
        await writePersistedRunStateUpdate(paths, {
          baton: nextBaton,
          currentRequests: [],
          history: { source: 'snapshot-exact-rollback', baton: nextBaton },
        }, { currentState });
      }),
      /injected durable commit failure after history/,
    );
  } finally {
    delete process.env.WORKFLOW_RUNNER_FAIL_DURABLE_COMMIT_AFTER;
  }

  assert.equal(readFileSync(paths.batonPath, 'utf8'), before.baton);
  assert.equal(readFileSync(paths.historyPath, 'utf8'), before.history);
  assert.equal(readFileSync(paths.currentRequestsPath, 'utf8'), before.currentRequests);
});

test('persisted-state writer records only a v2 history append in the pending commit', async () => {
  const paths = setupRunDir('v2_pending_append');
  const baseline = `private-baseline-${'x'.repeat(4096)}\n`;
  writeFileSync(paths.historyPath, baseline);
  const nextBaton = baton({ cursor: 'done', status: 'done' });

  process.env.WORKFLOW_RUNNER_FAIL_DURABLE_COMMIT_AFTER = 'pending';
  try {
    await assert.rejects(
      () => withRunStateLock(paths, async () => {
        const currentState = await readPersistedRunState(paths, { includeHistoryText: false });
        await writePersistedRunStateUpdate(paths, {
          baton: nextBaton,
          history: { source: 'v2-pending-format', baton: nextBaton },
        }, { currentState });
      }),
      /injected durable commit failure after pending/,
    );
  } finally {
    delete process.env.WORKFLOW_RUNNER_FAIL_DURABLE_COMMIT_AFTER;
  }

  const pendingText = readFileSync(paths.durableCommitPath, 'utf8');
  const pending = JSON.parse(pendingText);
  assert.equal(pending.version, 2);
  assert.equal(Object.hasOwn(pending, 'historyText'), false);
  assert.equal(pending.historyAppend.transactionId, pending.id);
  assert.equal(pending.historyAppend.baseExists, true);
  assert.equal(pending.historyAppend.baseSize, Buffer.byteLength(baseline));
  assert.equal(pending.historyAppend.entryHash, createHash('sha256').update(pending.historyAppend.entryText).digest('hex'));
  assert.equal(pendingText.includes(baseline.trim()), false);
  assert.equal(readFileSync(paths.historyPath, 'utf8'), baseline);

  assert.equal(await recoverDurableCommit(paths), true);
  assert.equal(await recoverDurableCommit(paths), false);
  const history = readFileSync(paths.historyPath, 'utf8');
  assert.equal(history.startsWith(baseline), true);
  assert.equal(history.split(pending.id).length - 1, 1);
  assert.match(history, /source: v2-pending-format/);
});

test('v2 current requests bind to the post-commit baton file signature without serializing baton again', async () => {
  const paths = setupRunDir('v2_baton_file_signature');
  const nextBaton = baton({ cursor: 'done', status: 'done' });

  const after = await withRunStateLock(paths, async () => {
    const currentState = await readPersistedRunState(paths, { includeHistoryText: false });
    return writePersistedRunStateUpdate(paths, {
      baton: nextBaton,
      currentRequests: [],
      history: { source: 'v2-baton-file-signature', baton: nextBaton },
    }, { currentState });
  });

  const expectedSignature = await durableFileSignature(paths.batonPath);
  const currentRequests = JSON.parse(readFileSync(paths.currentRequestsPath, 'utf8'));
  assert.equal(currentRequests.batonSignature, expectedSignature);
  assert.equal(after.currentRequestsBatonSignature, expectedSignature);
});

test('v2 recovery completes a partial UTF-8 history append and rolls it back on injected failure', async () => {
  const paths = setupRunDir('v2_partial_append');
  const id = 'v2-partial-utf8';
  const base = 'existing history: π\n';
  const entryText = `## transaction\n\n- source: recovery 🚀\n- transaction: ${id}\n\n`;
  const entryBytes = Buffer.from(entryText);
  const splitAt = entryBytes.indexOf(Buffer.from('🚀')) + 2;
  writeFileSync(paths.historyPath, Buffer.concat([Buffer.from(base), entryBytes.subarray(0, splitAt)]));
  writeJson(paths.durableCommitPath, pendingHistoryAppend({
    id,
    baseSize: Buffer.byteLength(base),
    entryText,
  }));

  process.env.WORKFLOW_RUNNER_FAIL_DURABLE_COMMIT_AFTER = 'history';
  try {
    await assert.rejects(() => recoverDurableCommit(paths), /injected durable commit failure after history/);
  } finally {
    delete process.env.WORKFLOW_RUNNER_FAIL_DURABLE_COMMIT_AFTER;
  }

  assert.equal(readFileSync(paths.historyPath, 'utf8'), base);
  assert.equal(await recoverDurableCommit(paths), true);
  assert.equal(readFileSync(paths.historyPath, 'utf8'), `${base}${entryText}`);
});

test('v2 recovery recognizes an already complete history append without duplicating it', async () => {
  const paths = setupRunDir('v2_complete_append');
  const id = 'v2-complete';
  const base = 'existing history\n';
  const entryText = `## transaction\n\n- source: already-complete\n- transaction: ${id}\n\n`;
  writeFileSync(paths.historyPath, `${base}${entryText}`);
  writeJson(paths.durableCommitPath, pendingHistoryAppend({
    id,
    baseSize: Buffer.byteLength(base),
    entryText,
    nextBaton: baton({ cursor: 'done', status: 'done' }),
  }));

  assert.equal(await recoverDurableCommit(paths), true);

  assert.equal(readFileSync(paths.historyPath, 'utf8'), `${base}${entryText}`);
  assert.equal(JSON.parse(readFileSync(paths.batonPath, 'utf8')).cursor, 'done');
});

test('v2 recovery fails closed when history has an unrelated tail', async () => {
  const paths = setupRunDir('v2_unrelated_tail');
  const id = 'v2-unrelated-tail';
  const base = 'existing history\n';
  const unrelatedTail = 'not this transaction';
  const entryText = `## transaction\n\n- source: expected\n- transaction: ${id}\n\n`;
  writeFileSync(paths.historyPath, `${base}${unrelatedTail}`);
  writeJson(paths.durableCommitPath, pendingHistoryAppend({
    id,
    baseSize: Buffer.byteLength(base),
    entryText,
  }));

  await assert.rejects(() => recoverDurableCommit(paths), /history tail does not match pending transaction/);

  assert.equal(readFileSync(paths.historyPath, 'utf8'), `${base}${unrelatedTail}`);
  assert.equal(existsSync(paths.durableCommitPath), true);
});

test('persisted-state reader rejects invalid current durable baton', async () => {
  const paths = setupRunDir('invalid_current');
  writeJson(paths.batonPath, { cursor: 'prepare' });

  await assert.rejects(() => readPersistedRunState(paths), /baton failed schema validation/);
});

test('persisted-state writer rejects invalid next state before durable commit side effects', async () => {
  const paths = setupRunDir('invalid_next');
  await assert.rejects(
    () => writePersistedRunStateUpdate(paths, {
      baton: { cursor: 'prepare' },
      history: { source: 'test', baton: { cursor: 'prepare' } },
    }),
    /next persisted run state|baton failed schema validation/,
  );

  assert.equal(existsSync(paths.durableCommitPath), false);
  assert.equal(readFileSync(paths.historyPath, 'utf8'), '');
});



test('persisted-state writer acquires run-state lock before writing', async () => {
  const paths = setupRunDir('writer_lock');
  writeFileSync(paths.continueLockPath, `${JSON.stringify({ lockId: 'held', pid: process.pid, createdAt: '1970-01-01T00:00:00.000Z', heartbeatAt: new Date().toISOString() })}\n`);

  await assert.rejects(
    () => writePersistedRunStateUpdate(paths, {
      baton: baton({ cursor: 'done', status: 'done' }),
      history: { source: 'test', baton: baton({ cursor: 'done', status: 'done' }) },
    }),
    (error) => {
      assert.match(error.message, /run-state lock contention timed out for runId/);
      assert.match(error.message, new RegExp(paths.runId));
      assert.equal(error.message.includes(paths.runDir), false);
      assert.equal(error.message.includes(paths.continueLockPath), false);
      return true;
    },
  );

  assert.equal(existsSync(paths.durableCommitPath), false);
  assert.equal(readFileSync(paths.historyPath, 'utf8'), '');
  rmSync(paths.continueLockPath, { force: true });
});

test('persisted-state writer recovers existing pending journal before writing a new commit', async () => {
  const paths = setupRunDir('recover_existing_pending_before_write');
  const recoveredBaton = baton({ cursor: 'done', status: 'done' });
  writeJson(paths.durableCommitPath, {
    version: 1,
    id: 'pending-before-writer',
    createdAt: new Date().toISOString(),
    status: 'pending',
    baton: recoveredBaton,
    historyText: 'old pending history\n',
    sideEffects: { baton: true, history: true },
  });

  await writePersistedRunStateUpdate(paths, {
    baton: baton({ cursor: 'done', status: 'done' }),
    history: { source: 'test-new-commit', baton: baton({ cursor: 'done', status: 'done' }) },
  });

  const history = readFileSync(paths.historyPath, 'utf8');
  assert.match(history, /old pending history/);
  assert.match(history, /source: test-new-commit/);
  assert.equal(existsSync(paths.durableCommitPath), false);
});

test('persisted-state commit schema rejects missing id', async () => {
  const paths = setupRunDir('missing_commit_id');
  writeJson(paths.durableCommitPath, {
    version: 1,
    createdAt: new Date().toISOString(),
    status: 'pending',
    sideEffects: { baton: false, history: false },
  });

  await assert.rejects(() => readPersistedRunState(paths), /persisted run-state commit id/);
});

test('persisted-state reader rejects unsupported version and topology metadata', async () => {
  const paths = setupRunDir('invalid_metadata');
  const persisted = await readPersistedRunState(paths);

  assert.throws(() => assertPersistedRunState({ ...persisted, version: 2 }), /unsupported version/);
  assert.throws(() => assertPersistedRunState({ ...persisted, storageTopology: 'old' }), /unsupported storage topology/);
});

test('persisted-state recovery restores targets after injected durable commit failure', async () => {
  const paths = setupRunDir('recover_after_failure');
  const beforeBaton = readFileSync(paths.batonPath, 'utf8');
  process.env.WORKFLOW_RUNNER_FAIL_DURABLE_COMMIT_AFTER = 'history';
  try {
    await assert.rejects(
      () => writePersistedRunStateUpdate(paths, {
        baton: baton({ cursor: 'done', status: 'done' }),
        history: { source: 'test', baton: baton({ cursor: 'done', status: 'done' }) },
      }),
      /injected durable commit failure after history/,
    );
  } finally {
    delete process.env.WORKFLOW_RUNNER_FAIL_DURABLE_COMMIT_AFTER;
  }

  assert.equal(readFileSync(paths.batonPath, 'utf8'), beforeBaton);
  assert.equal(readFileSync(paths.historyPath, 'utf8'), '');
});

test('persisted-state reader rejects symlinked split storage file', async () => {
  const paths = setupRunDir('symlink_split');
  rmSync(paths.historyPath, { force: true });
  const outside = path.join(tempDir, 'outside-history.md');
  writeFileSync(outside, 'outside');
  symlinkSync(outside, paths.historyPath, 'file');

  await assert.rejects(() => readPersistedRunState(paths), /workflow history is unsafe because it is a symlink/);
});

// Keep writeJsonAtomic imported so this test file also verifies the public atomic primitive remains loadable.
assert.equal(typeof writeJsonAtomic, 'function');
