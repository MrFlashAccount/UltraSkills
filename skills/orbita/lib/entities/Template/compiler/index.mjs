import { finalOutputReminder, outputContractSection, readOutputSchema, readOutputTemplate } from './sections/output-contract.mjs';
import { interpolatePromptExpressions } from './sections/prompt-interpolation.mjs';
import { normalizePromptText } from '../../../runtime/prompt-text.mjs';
import { section, trimStable } from './utils.mjs';
import { assertNoUnsupportedPlaceholders, defaultPrompt, readInputTemplate } from './sections/template.mjs';

function firstNonEmptyString(candidates) {
  const value = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0);
  return value?.trim() ?? '';
}

function workflowInstruction({ workflow }) {
  return firstNonEmptyString([workflow?.instruction, workflow?.instructions]);
}

function requiredReadsBlock(items = []) {
  if (items.length === 0) return '';
  const lines = [
    'Read these files before acting, in order:',
    '',
  ];
  items.forEach((item, index) => {
    const suffix = item.contentType ? ` (${item.contentType})` : '';
    lines.push(`${index + 1}. ${item.label}${suffix}: \`${item.path}\``);
  });
  lines.push('', 'Do not proceed until all required reads are complete.');
  return lines.join('\n');
}

function approvalAttachmentsBlock(items = []) {
  if (items.length === 0) return '';
  const lines = [
    'Attach these files to the user-facing approval request without opening or reading their contents:',
    '',
  ];
  items.forEach((item, index) => {
    const suffix = item.contentType ? ` (${item.contentType})` : '';
    lines.push(`${index + 1}. ${item.label}${suffix}: \`${item.path}\``);
  });
  lines.push(
    '',
    'Attachments are not required reads. Open one only after an explicit user content question.',
    'In Codex/Codex Desktop, render each as an absolute Markdown file link. Never substitute a summary, plain path, or inline body; if links are unavailable, state the gap and affected path.',
  );
  return lines.join('\n');
}

function requiredReadsForRender(items, { followUp = false } = {}) {
  if (followUp !== true) return items;
  return items.filter((item) => item?.source !== 'role-material');
}

function nonBlockingStopBlock({ baton, stepId }) {
  const stop = baton?.nonBlockingStops?.[stepId];
  if (!stop || typeof stop !== 'object' || Array.isArray(stop)) return '';

  const lines = stop.resolution && typeof stop.resolution === 'object' && !Array.isArray(stop.resolution)
    ? [
        'This same workflow request previously reported a non-blocking stop. The orchestrator has resolved it. Continue from the stopped point; do not restart or repeat completed work unless needed.',
      ]
    : [
        'The previous output for this same workflow step reported a non-blocking stop. Wait for orchestrator resolution before continuing; do not restart or switch workflow steps.',
      ];
  lines.push(
    '',
    `Summary: ${stop.summary}`,
    `Needed: ${stop.needed}`,
    `Source step: ${stop.source_step_id ?? stepId}`,
  );
  if (Array.isArray(stop.evidence) && stop.evidence.length > 0) {
    lines.push('', 'Evidence:');
    for (const item of stop.evidence) lines.push(`- ${item}`);
  }
  if (stop.risk) lines.push('', `Risk: ${stop.risk}`);
  if (stop.resolution && typeof stop.resolution === 'object' && !Array.isArray(stop.resolution)) {
    lines.push(
      '',
      'Resolution:',
      `- Summary: ${stop.resolution.summary}`,
      `- Decision: ${stop.resolution.decision}`,
    );
    if (Array.isArray(stop.resolution.evidence) && stop.resolution.evidence.length > 0) {
      lines.push('- Evidence:');
      for (const item of stop.resolution.evidence) lines.push(`  - ${item}`);
    }
    if (stop.resolution.risk) lines.push(`- Risk: ${stop.resolution.risk}`);
  }
  return lines.join('\n');
}

function assembleFixedPrompt({ promptLayer, templatePath, workflowInstructionBlock, requiredReads, approvalAttachments, nonBlockingStop, inlinePrompt, outputContract, userPrompt, finalReminder }) {
  assertNoUnsupportedPlaceholders(promptLayer, templatePath);
  const parts = [trimStable(promptLayer)];

  if (workflowInstructionBlock) parts.push(section('Workflow instruction', workflowInstructionBlock).trimEnd());
  if (requiredReads) parts.push(section('Required reads', requiredReads).trimEnd());
  if (approvalAttachments) parts.push(section('Approval attachments', approvalAttachments).trimEnd());
  if (nonBlockingStop) parts.push(section('Non-blocking stop', nonBlockingStop).trimEnd());
  if (outputContract) parts.push(outputContract.trimEnd());
  if (inlinePrompt) parts.push(section('Workflow step prompt', inlinePrompt.trim()));
  if (typeof userPrompt === 'string' && userPrompt.trim().length > 0) parts.push(section('User prompt', userPrompt));
  if (finalReminder) parts.push(finalReminder.trimEnd());

  return `${parts.filter(Boolean).join('\n\n')}\n`;
}

export function renderWorkflowPrompt({ workflow, baton, stepId, step, resources, promptInput = { value: {}, keys: [] }, shard, requiredReads = [], approvalAttachments = [], roleMetadataPaths = [], includeDiagnostics = false, userPrompt, userPromptInjected = false, followUp = false } = {}) {
  const input = step.input ?? {};
  const inputTemplate = readInputTemplate({ input, resources });
  const outputTemplate = readOutputTemplate({ step, resources });
  const outputSchema = readOutputSchema({ workflow, step, resources });
  const outputContract = outputContractSection(outputTemplate.content, outputTemplate.metadataPath, outputSchema.content, outputSchema.metadataPath, outputSchema.schema, {
    schemaDefinitions: resources?.schemaDefinitions,
    validatingWriterCommand: resources?.validatingWriterCommand,
    reportStopCommand: resources?.reportStopCommand,
    artifactOutputDir: resources?.artifactOutputDir,
    debugSummaryPath: resources?.debugSummaryPath,
    compactFollowUp: followUp === true,
  });
  const workflowInstructionBlock = workflowInstruction({ workflow });
  const finalReminder = finalOutputReminder(outputContract);

  const usesDefaultPrompt = inputTemplate.content === undefined;
  const promptLayer = usesDefaultPrompt ? defaultPrompt({ step, input }) : inputTemplate.content;
  const requiredReadsSection = requiredReadsBlock(requiredReadsForRender(requiredReads, { followUp }));
  const approvalAttachmentsSection = approvalAttachmentsBlock(approvalAttachments);
  const prompt = assembleFixedPrompt({
    promptLayer,
    templatePath: inputTemplate.metadataPath,
    workflowInstructionBlock,
    requiredReads: requiredReadsSection,
    approvalAttachments: approvalAttachmentsSection,
    nonBlockingStop: nonBlockingStopBlock({ baton, stepId }),
    inlinePrompt: interpolatePromptExpressions(normalizePromptText(input.prompt), { input: promptInput.value, ...(shard ? { shard } : {}) }),
    outputContract,
    userPrompt: ['worker', 'fanout', 'shard'].includes(step.kind) && userPromptInjected !== true ? userPrompt : undefined,
    finalReminder,
  });
  const diagnostics = usesDefaultPrompt
    ? [
        {
          severity: 'info',
          code: 'default_prompt_used',
          message: 'No input.template declared; assembled deterministic default prompt.',
        },
      ]
    : [];

  const metadata = {};
  if (input.template) metadata.inputTemplate = input.template;
  if (step.output?.template) metadata.outputTemplate = step.output.template;
  if (step.output?.schema) metadata.outputSchema = step.output.schema;
  if (roleMetadataPaths.length > 0) metadata.roleMaterial = roleMetadataPaths;

  const compiledPrompt = { prompt };
  if (Object.keys(metadata).length > 0) compiledPrompt.metadata = metadata;
  if (includeDiagnostics && diagnostics.length > 0) compiledPrompt.diagnostics = diagnostics;
  return compiledPrompt;
}
