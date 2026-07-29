/**
 * Runner-owned approval contract and projection.
 *
 * Approval workflow documents select bounded state; this module validates the
 * closed decision vocabulary and renders that selected state without Template,
 * persistence, schema-loader, filesystem, or command-builder dependencies.
 */
import { WorkflowRuntimeError } from '../errors.mjs';
import { parsePathExpression } from './expression.mjs';
import { readPath } from '../entities/Step/expressions/index.mjs';

export const APPROVAL_VALUES = Object.freeze(['approved', 'rejected']);
export const APPROVAL_FEEDBACK_MAX_LENGTH = 4000;

const VERDICT_FIELD_KEYS = Object.freeze([
  'severity',
  'title',
  'summary',
  'message',
  'finding',
  'issue',
  'reason',
  'location',
  'file',
  'path',
  'line',
  'impact',
  'required_fix',
  'next_action',
  'suggestion',
  'requirement_id',
]);

function approvalValidationError(message) {
  throw new WorkflowRuntimeError(`approval output failed schema validation: ${message}`);
}

export function validateApprovalDecision(output) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    approvalValidationError('/ must be object');
  }
  const keys = Object.keys(output);
  for (const key of keys) {
    if (!['approval', 'feedback'].includes(key)) approvalValidationError(`/${key} is not allowed`);
  }
  if (!Object.hasOwn(output, 'approval')) approvalValidationError('/approval is required');
  if (!APPROVAL_VALUES.includes(output.approval)) {
    approvalValidationError('/approval must be equal to one of the allowed values: approved, rejected');
  }
  if (Object.hasOwn(output, 'feedback')) {
    if (typeof output.feedback !== 'string') approvalValidationError('/feedback must be string');
    if (output.feedback.trim().length === 0) approvalValidationError('/feedback must be non-blank');
    if (output.feedback.length > APPROVAL_FEEDBACK_MAX_LENGTH) {
      approvalValidationError(`/feedback must NOT have more than ${APPROVAL_FEEDBACK_MAX_LENGTH} characters`);
    }
  }
  return structuredClone(output);
}

function boundedText(value, maximum) {
  const text = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  if (text.length <= maximum) return text;
  return `${text.slice(0, Math.max(0, maximum - 1)).trimEnd()}…`;
}

function approvalSelector(source, field) {
  let expression;
  try {
    expression = parsePathExpression(source, { allowedRoots: ['input'] });
  } catch (error) {
    throw new WorkflowRuntimeError(`approval projection failed: ${field} ${error.message}`);
  }
  return expression;
}

function selectApprovalValue(baton, source, field) {
  const expression = approvalSelector(source, field);
  return {
    expression,
    value: readPath({ input: baton?.state ?? {} }, expression),
  };
}

function artifactIdentity(producerStepId, artifact) {
  return `${producerStepId}\u0000${artifact?.id ?? ''}\u0000${artifact?.path ?? ''}`;
}

function safeLinkLabel(value) {
  return boundedText(value, 160).replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]');
}

function safeLinkTarget(value) {
  return String(value).replaceAll('<', '%3C').replaceAll('>', '%3E').replaceAll('\n', '').replaceAll('\r', '');
}

function selectedArtifacts({ baton, selectors = [], resources }) {
  const artifacts = [];
  const seen = new Set();
  for (const [index, source] of selectors.entries()) {
    const { expression, value } = selectApprovalValue(baton, source, `input.artifacts[${index}]`);
    if (!Array.isArray(value)) {
      throw new WorkflowRuntimeError(`approval projection failed: input.artifacts[${index}] selector ${source} must resolve to an array`);
    }
    const producerStepId = expression.path[0];
    for (const artifact of value) {
      if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
        throw new WorkflowRuntimeError(`approval projection failed: input.artifacts[${index}] contains invalid artifact metadata`);
      }
      if (typeof artifact.id !== 'string' || artifact.id.length === 0 || typeof artifact.path !== 'string' || artifact.path.length === 0) {
        throw new WorkflowRuntimeError(`approval projection failed: input.artifacts[${index}] contains artifact metadata without id/path`);
      }
      const identity = artifactIdentity(producerStepId, artifact);
      if (seen.has(identity)) continue;
      seen.add(identity);
      if (typeof resources?.resolveExistingRunArtifactPath !== 'function') {
        throw new WorkflowRuntimeError('approval projection failed: artifact path boundary resolver is unavailable');
      }
      artifacts.push({
        id: artifact.id,
        contentType: artifact.content_type,
        path: resources.resolveExistingRunArtifactPath(artifact.path),
      });
    }
  }
  return artifacts;
}

function conciseFinding(value) {
  if (typeof value === 'string') return boundedText(value, 220);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return boundedText(value, 220);
  const parts = [];
  for (const key of VERDICT_FIELD_KEYS) {
    if (!Object.hasOwn(value, key)) continue;
    const selected = value[key];
    if (selected === undefined || selected === null || selected === '') continue;
    const rendered = Array.isArray(selected)
      ? selected.filter((item) => typeof item === 'string').join('; ')
      : (typeof selected === 'object' ? '' : String(selected));
    if (rendered) parts.push(`${key.replaceAll('_', ' ')}: ${boundedText(rendered, 140)}`);
  }
  return boundedText(parts.join(' | ') || 'Actionable finding recorded by the critic.', 260);
}

function selectedVerdict({ baton, verdict }) {
  if (!verdict) return undefined;
  const condition = selectApprovalValue(baton, verdict.include_when.selector, 'input.verdict.include_when.selector').value;
  if (condition !== verdict.include_when.equals) return undefined;
  const outcome = selectApprovalValue(baton, verdict.outcome, 'input.verdict.outcome').value;
  const summary = selectApprovalValue(baton, verdict.summary, 'input.verdict.summary').value;
  const findings = selectApprovalValue(baton, verdict.findings, 'input.verdict.findings').value;
  if (typeof outcome !== 'string' || outcome.trim().length === 0) {
    throw new WorkflowRuntimeError('approval projection failed: verdict outcome must resolve to a non-empty string');
  }
  if (!Array.isArray(summary) && typeof summary !== 'string') {
    throw new WorkflowRuntimeError('approval projection failed: verdict summary must resolve to a string or array of strings');
  }
  if (!Array.isArray(findings)) {
    throw new WorkflowRuntimeError('approval projection failed: verdict findings must resolve to an array');
  }
  const summaryText = Array.isArray(summary) ? summary.filter((item) => typeof item === 'string').join('; ') : summary;
  return {
    outcome: boundedText(outcome, 80),
    summary: boundedText(summaryText, 420),
    findings: findings.slice(0, 5).map(conciseFinding).filter(Boolean),
  };
}

function resolvedStopSection(nonBlockingStop) {
  if (!nonBlockingStop?.resolution) return '';
  const lines = [
    '## Resolved recovery context',
    '',
    `- Stop: ${boundedText(nonBlockingStop.summary, 240)}`,
    `- Resolution: ${boundedText(nonBlockingStop.resolution.summary, 240)}`,
    `- Decision: ${boundedText(nonBlockingStop.resolution.decision ?? nonBlockingStop.resolution.answer, 320)}`,
  ];
  return lines.join('\n');
}

export function renderApprovalInstructions({
  baton,
  stepId,
  step,
  resources,
  writeOutputCommand,
  continueCommand,
  nonBlockingStop,
} = {}) {
  if (step?.kind !== 'approval') throw new WorkflowRuntimeError(`approval projection failed: workflow step '${stepId}' is not an approval`);
  if (typeof writeOutputCommand !== 'string' || writeOutputCommand.length === 0) {
    throw new WorkflowRuntimeError(`approval projection failed: missing validating writer for workflow step '${stepId}'`);
  }
  if (typeof continueCommand !== 'string' || continueCommand.length === 0) {
    throw new WorkflowRuntimeError(`approval projection failed: missing continue command for workflow step '${stepId}'`);
  }

  const summary = selectApprovalValue(baton, step.input.summary, 'input.summary').value;
  if (typeof summary !== 'string' || summary.trim().length === 0) {
    throw new WorkflowRuntimeError('approval projection failed: input.summary must resolve to a non-empty string');
  }
  const artifacts = selectedArtifacts({ baton, selectors: step.input.artifacts, resources });
  const verdict = selectedVerdict({ baton, verdict: step.input.verdict });
  const artifactLines = artifacts.length === 0
    ? ['- None.']
    : artifacts.map((artifact) => `- [${safeLinkLabel(artifact.id)}](<${safeLinkTarget(artifact.path)}>)${artifact.contentType ? ` — ${boundedText(artifact.contentType, 80)}` : ''}`);
  const verdictLines = verdict
    ? [
        '## Current critic verdict',
        '',
        `- Outcome: ${verdict.outcome}`,
        `- Summary: ${verdict.summary || 'No concise summary provided.'}`,
        ...(verdict.findings.length > 0
          ? ['- Remaining reviewer findings (user discretion):', ...verdict.findings.map((finding) => `  - ${finding}`)]
          : ['- Findings: none.']),
      ]
    : [];
  const recovery = resolvedStopSection(nonBlockingStop);

  return [
    `# Approval — ${boundedText(step.name ?? stepId, 160)}`,
    '',
    '## Current summary',
    '',
    boundedText(summary, 800),
    '',
    '## Approval attachments',
    '',
    ...artifactLines,
    ...(verdictLines.length > 0 ? ['', ...verdictLines] : []),
    ...(recovery ? ['', recovery] : []),
    '',
    '## Decision required',
    '',
    'Present the current summary and every approval attachment as the normal approval gate. Reviewer findings are context, not a separate blocker. If any remain, call them out and state that the user may approve as-is or reject with feedback requesting changes. Ask the user for an explicit decision. Submit exactly `{ "approval": "approved" }` or `{ "approval": "rejected", "feedback": "..." }`. Feedback is optional, but when present it must be non-blank and at most 4000 characters.',
    '',
    'Write the normalized decision with:',
    '',
    writeOutputCommand,
    '',
    'After the decision is accepted and every current request has completed, run this command once:',
    '',
    continueCommand,
  ].join('\n');
}
