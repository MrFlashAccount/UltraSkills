function normalize(value) {
  return String(value)
    .toLowerCase()
    .replace(/\.(?:json|toml)$/u, '')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');
}

function includesAllTokens(haystack, needle) {
  const tokens = normalize(needle).split('-').filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((token) => haystack.includes(token));
}

function orderedCatalogEntries(workflows) {
  return [...workflows].sort((left, right) => (
    Number(left.rootOrder ?? 0) - Number(right.rootOrder ?? 0) ||
    String(left.relativePath ?? left.name).localeCompare(String(right.relativePath ?? right.name)) ||
    String(left.workflowRef ?? '').localeCompare(String(right.workflowRef ?? ''))
  ));
}

function scoreWorkflow(workflow, query) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return 0;

  const normalizedName = normalize(workflow.name);
  const normalizedDescription = normalize(workflow.description);
  const normalizedRelativePath = normalize(workflow.relativePath ?? '');

  if (normalizedQuery === normalizedName) return 100;
  if (normalizedQuery === normalizedRelativePath) return 95;
  if (normalizedName.includes(normalizedQuery) || normalizedQuery.includes(normalizedName)) return 80;
  if (includesAllTokens(normalizedName, normalizedQuery)) return 60;
  if (normalizedRelativePath.includes(normalizedQuery)) return 50;
  if (normalizedDescription.includes(normalizedQuery)) return 30;
  if (includesAllTokens(normalizedDescription, normalizedQuery)) return 20;
  return 0;
}

export function resolveWorkflowCatalogEntry(workflows, query) {
  const ordered = orderedCatalogEntries(workflows);
  const exactRef = ordered.filter((workflow) => workflow.workflowRef === query);
  if (exactRef.length > 0) return { status: exactRef.length === 1 ? 'single' : 'multiple', query, candidates: exactRef };

  const normalizedQuery = normalize(query);
  const exactDisplayNames = ordered.filter((workflow) => normalize(workflow.name) === normalizedQuery);
  if (exactDisplayNames.length > 0) {
    return { status: exactDisplayNames.length === 1 ? 'single' : 'multiple', query, candidates: exactDisplayNames };
  }

  const scored = ordered
    .map((workflow) => ({ ...workflow, score: scoreWorkflow(workflow, query) }))
    .filter((workflow) => workflow.score > 0)
    .sort((left, right) => right.score - left.score || Number(left.rootOrder ?? 0) - Number(right.rootOrder ?? 0) || String(left.relativePath ?? left.name).localeCompare(String(right.relativePath ?? right.name)));

  if (scored.length === 0) return { status: 'none', query, candidates: [] };

  const topScore = scored[0].score;
  const candidates = scored.filter((workflow) => workflow.score === topScore).map(({ score: _score, ...workflow }) => workflow);
  return { status: candidates.length === 1 ? 'single' : 'multiple', query, candidates };
}

export const WorkflowCatalogPolicy = { resolve: resolveWorkflowCatalogEntry };
