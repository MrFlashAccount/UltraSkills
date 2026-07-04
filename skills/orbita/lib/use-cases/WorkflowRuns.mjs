export function createWorkflowRuns({
  claimWorkflowRunAtRoot,
  heartbeatWorkflowRunAtRoot,
  listWorkflowRunsAtRoot,
  registerWorkflowRunAtRoot,
  summarizeWorkflowRuns,
  publicErrorMessage,
  defaultWorkflowPath,
  resolveAbsoluteWorkflowPath,
  validateWorkflowStartup,
}) {
  function publicApiError(error, options = {}) {
    const rawMessage = String(error?.message ?? error);
    const message = /workflow runs index/.test(rawMessage)
      ? publicErrorMessage(rawMessage, options).replace(/\s+from\s+.*$/, '')
      : publicErrorMessage(rawMessage, options);
    const redacted = new Error(message);
    if (error?.code) redacted.code = error.code;
    return redacted;
  }

  async function publicApiCall(callback, options = {}) {
    try { return await callback(); }
    catch (error) { throw publicApiError(error, options); }
  }

  async function listWorkflowRuns({ runsRoot, now = new Date() } = {}) {
    return publicApiCall(() => listWorkflowRunsAtRoot({ runsRoot, now }), { runsRoot });
  }

  async function registerWorkflowRun({ runId, title, summary, workflowPath, workflowIdentity, status = 'running', taskKey, taskFingerprint, runsRoot, claim = false, owner, harness, sessionId, workerId, leaseMs, now = new Date() } = {}) {
    const startupWorkflowPath = resolveAbsoluteWorkflowPath(workflowPath) ?? defaultWorkflowPath;
    validateWorkflowStartup({ workflowPath: startupWorkflowPath });
    return publicApiCall(() => registerWorkflowRunAtRoot({
      runId,
      title,
      summary,
      workflowPath: startupWorkflowPath,
      workflowIdentity,
      status,
      taskKey,
      taskFingerprint,
      runsRoot,
      claim,
      owner,
      harness,
      sessionId,
      workerId,
      leaseMs,
      now,
    }), { runsRoot });
  }

  async function claimWorkflowRun({ runId, workflowPath, runsRoot, owner, harness, sessionId, workerId, leaseMs, leaseToken, takeover = false, now = new Date() } = {}) {
    return publicApiCall(() => claimWorkflowRunAtRoot({ runId, workflowPath, runsRoot, owner, harness, sessionId, workerId, leaseMs, leaseToken, takeover, now }), { runsRoot });
  }

  async function heartbeatWorkflowRun(options = {}) {
    return publicApiCall(() => heartbeatWorkflowRunAtRoot(options), { runsRoot: options.runsRoot });
  }

  return {
    claimWorkflowRun,
    heartbeatWorkflowRun,
    listWorkflowRuns,
    registerWorkflowRun,
    summarizeWorkflowRuns,
  };
}
