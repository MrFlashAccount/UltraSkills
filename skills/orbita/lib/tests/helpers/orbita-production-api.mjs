import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { applyWorkflowOutput } from '../../use-cases/ApplyWorkflowOutput.mjs';
import { validateRunnerAcceptedOutput } from '../../use-cases/WorkflowRunnerOutputValidation.mjs';
import { validateWorkflow } from '../../use-cases/ValidateWorkflow.mjs';
import { createValidateWorkflowFile } from '../../use-cases/ValidateWorkflowFile.mjs';
import { createWorkflowRunnerCommand } from '../../use-cases/WorkflowRunnerCommand.mjs';
import { createWorkflowRuns } from '../../use-cases/WorkflowRuns.mjs';
import { acceptedOutputHistoryDetails, orchestratorDebugHistoryDetails, publicFailureHistoryDetails, transitionHistoryDetails } from '../../runner/history-projection.mjs';
import { pointerMoveHistoryDetails, projectPointerTransitions, resolvePointerMove } from '../../runner/pointer-transition-projection.mjs';
import { renderAppliedResponse } from '../../use-cases/ContinueRun.mjs';
import { runNext } from '../../use-cases/RunNext.mjs';
import { resolveStartupUserPrompt, startupUserPromptTarget } from '../../runtime/user-prompt.mjs';
import { loadWorkflowRuntime } from '../../persistence/workflow-resources/runtime-reader.mjs';
import { readWorkflowDocument } from '../../persistence/workflow-resources/workflow-document-reader.mjs';
import { artifactPathBoundaryInspection } from '../../persistence/workflow-resources/artifact-path-boundaries.mjs';
import { writePersistedRunStateUpdate } from '../../persistence/run-state/PersistedRunStateWriter.mjs';
import { toHostResponse, workerBindingKeyForStep } from '../../runner/host-requests.mjs';
import { renderCurrentRequestInstructions } from '../../runner/current-request-instructions.mjs';
import { assertRunnerHostResponseSchema } from '../../persistence/run-state/schema/runner-host-response-schema.mjs';
import { assertSafeStepId, reportStopCommandForStep, resolveStopCommandForStep, writeOutputCommandForStep } from '../../runner/runner-command-builder.mjs';
import { readText } from '../../persistence/run-state/atomic-file.mjs';
import { assertFreshTokenAuthority, assertMatchingTokenAuthority, buildTokenLease, renewTokenLease } from '../../persistence/run-state/lease-authority.mjs';
import { appendHistoryOnce, recoverDurableCommit } from '../../persistence/run-state/durable-commit.mjs';
import { readPersistedRunState } from '../../persistence/run-state/PersistedRunStateReader.mjs';
import { artifactOutputDirForOccurrence, defaultWorkflowPath, ensureRunDirectories, ensureRunFiles, initialRunBaton, migrateLegacyWorkflowRunsRootIfNeeded, pathExists, resolveRunPaths } from '../../persistence/run-state/paths.mjs';
import { createRunIndexEntry, upsertRunIndexEntry } from '../../persistence/run-state/run-index.mjs';
import { readRunAuthorityWithLegacyFallback, runAuthorityFromIndexEntry, writeRunAuthority } from '../../persistence/run-state/run-authority.mjs';
import { durableFileSignature } from '../../persistence/run-state/file-signature.mjs';
import { withRunStateLock } from '../../persistence/run-state/lock.mjs';
import { claimWorkflowRunAtRoot, deleteWorkflowRunAtRoot, heartbeatWorkflowRunAtRoot, listWorkflowRunsAtRoot, registerWorkflowRunAtRoot, summarizeWorkflowRuns as summarizeWorkflowRunsAtRoot } from '../../persistence/run-state/workflow-runs.mjs';
import { publicErrorMessage } from '../../public-error.mjs';
import { assertAbsoluteWorkflowPath, resolveAbsoluteWorkflowPath } from '../../workflow-path-boundary.mjs';
import { publicNonBlockingStopDetails, publicStopResolutionDetails } from '../../runtime/non-blocking-stop.mjs';
import { read, readAllowedRoles, readOutputSchemas } from '../../persistence/workflow-resources/workflow-file-reader.mjs';
import { defaultRepositoryRootForWorkflow } from '../../persistence/workflow-resources/resource-resolver.mjs';
import { createWorkflowStartupValidator } from '../../workflow-startup-validation.mjs';

export const validateWorkflowFile = createValidateWorkflowFile({
  readWorkflow: read,
  readOutputSchemas,
  readAllowedRoles,
  defaultRepositoryRootForWorkflow,
  validateWorkflow,
});

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
  artifactPathBoundaryInspection,
  artifactOutputDirForOccurrence,
  writePersistedRunStateUpdate,
  toHostResponse,
  renderCurrentRequestInstructions,
  assertRunnerHostResponseSchema,
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
  ensureRunDirectories,
  ensureRunFiles,
  initialRunBaton,
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

const workflowRuns = createWorkflowRuns({
  claimWorkflowRunAtRoot,
  deleteWorkflowRunAtRoot,
  heartbeatWorkflowRunAtRoot,
  listWorkflowRunsAtRoot,
  registerWorkflowRunAtRoot,
  summarizeWorkflowRuns: summarizeWorkflowRunsAtRoot,
  publicErrorMessage,
  defaultWorkflowPath,
  resolveAbsoluteWorkflowPath,
  validateWorkflowStartup,
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

export const {
  claimWorkflowRun,
  deleteWorkflowRun,
  heartbeatWorkflowRun,
  listWorkflowRuns,
  registerWorkflowRun,
  summarizeWorkflowRuns,
} = workflowRuns;
