import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { applyWorkflowOutput } from '../use-cases/ApplyWorkflowOutput.mjs';
import { validateRunnerAcceptedOutput } from '../use-cases/WorkflowRunnerOutputValidation.mjs';
import { acceptedOutputHistoryDetails, orchestratorDebugHistoryDetails, publicFailureHistoryDetails, transitionHistoryDetails } from '../runner/history-projection.mjs';
import { pointerMoveHistoryDetails, projectPointerTransitions, resolvePointerMove } from '../runner/pointer-transition-projection.mjs';
import { renderAppliedResponse } from '../use-cases/ContinueRun.mjs';
import { runNext } from '../use-cases/RunNext.mjs';
import { createWorkflowRunnerCommand } from '../use-cases/WorkflowRunnerCommand.mjs';
import { resolveStartupUserPrompt, startupUserPromptTarget } from '../runtime/user-prompt.mjs';
import { loadWorkflowRuntime } from '../persistence/workflow-resources/runtime-reader.mjs';
import { readWorkflowDocument } from '../persistence/workflow-resources/workflow-document-reader.mjs';
import { artifactPathBoundaryErrors } from '../persistence/workflow-resources/artifact-path-boundaries.mjs';
import { writePersistedRunStateUpdate } from '../persistence/run-state/PersistedRunStateWriter.mjs';
import { toHostResponse, workerBindingKeyForStep } from '../runner/host-requests.mjs';
import { assertSafeStepId, reportStopCommandForStep, resolveStopCommandForStep, writeOutputCommandForStep } from '../runner/runner-command-builder.mjs';
import { readText } from '../persistence/run-state/atomic-file.mjs';
import { assertFreshTokenAuthority, assertMatchingTokenAuthority, buildTokenLease, renewTokenLease } from '../persistence/run-state/lease-authority.mjs';
import { appendHistoryOnce, recoverDurableCommit } from '../persistence/run-state/durable-commit.mjs';
import { readPersistedRunState } from '../persistence/run-state/PersistedRunStateReader.mjs';
import { ensureRunFiles, migrateLegacyWorkflowRunsRootIfNeeded, pathExists, resolveRunPaths } from '../persistence/run-state/paths.mjs';
import { createRunIndexEntry, upsertRunIndexEntry } from '../persistence/run-state/run-index.mjs';
import { readRunAuthorityWithLegacyFallback, runAuthorityFromIndexEntry, writeRunAuthority } from '../persistence/run-state/run-authority.mjs';
import { durableFileSignature } from '../persistence/run-state/file-signature.mjs';
import { withRunStateLock } from '../persistence/run-state/lock.mjs';
import { publicErrorMessage } from '../public-error.mjs';
import { assertAbsoluteWorkflowPath } from '../workflow-path-boundary.mjs';
import { createWorkflowStartupValidator } from '../workflow-startup-validation.mjs';
import { validateWorkflowFile } from './validate-workflow-file.mjs';
import { publicNonBlockingStopDetails, publicStopResolutionDetails } from '../runtime/non-blocking-stop.mjs';

const validateWorkflowStartup = createWorkflowStartupValidator({
  validateWorkflowFile,
  publicErrorMessage,
});

const workflowRunnerCommand = createWorkflowRunnerCommand({
  readFile,
  join,
  resolve,
  applyWorkflowOutput,
  validateRunnerAcceptedOutput,
  acceptedOutputHistoryDetails,
  orchestratorDebugHistoryDetails,
  publicFailureHistoryDetails,
  transitionHistoryDetails,
  pointerMoveHistoryDetails,
  projectPointerTransitions,
  resolvePointerMove,
  renderAppliedResponse,
  runNext,
  resolveStartupUserPrompt,
  startupUserPromptTarget,
  loadWorkflowRuntime,
  readWorkflowDocument,
  artifactPathBoundaryErrors,
  writePersistedRunStateUpdate,
  toHostResponse,
  workerBindingKeyForStep,
  assertSafeStepId,
  writeOutputCommandForStep,
  reportStopCommandForStep,
  resolveStopCommandForStep,
  readText,
  assertFreshTokenAuthority,
  assertMatchingTokenAuthority,
  buildTokenLease,
  renewTokenLease,
  appendHistoryOnce,
  recoverDurableCommit,
  readPersistedRunState,
  ensureRunFiles,
  migrateLegacyWorkflowRunsRootIfNeeded,
  pathExists,
  resolveRunPaths,
  createRunIndexEntry,
  upsertRunIndexEntry,
  readRunAuthorityWithLegacyFallback,
  runAuthorityFromIndexEntry,
  writeRunAuthority,
  durableFileSignature,
  withRunStateLock,
  publicErrorMessage,
  assertAbsoluteWorkflowPath,
  validateWorkflowStartup,
  publicNonBlockingStopDetails,
  publicStopResolutionDetails,
});

export const {
  continueRun,
  listPointerTransitions,
  loadInstructions,
  movePointer,
  next,
  reportStop,
  resolveStop,
  writeOutput,
} = workflowRunnerCommand;
