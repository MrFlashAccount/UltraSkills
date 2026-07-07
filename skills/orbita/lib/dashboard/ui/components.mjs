import { dashboardCopy, dashboardLanes, fallbackLaneId } from './constants.mjs';
import { escapeAttribute, escapeHtml } from './html.mjs';
import { relativeTimeLabel, shortRunId } from './normalizers.mjs';
import { laneRenderLimit, runsForLane } from './selectors.mjs';

const runnerControlPattern = /\b(next|continue|write-output|bind-agent|retry|rerun|repair|move|drag|drop)\b/i;

export function renderTopbar(viewModel) {
  const rootLabel = viewModel.rootLabel || dashboardCopy.emptyRoot;
  return `<header class="topbar" aria-label="Dashboard status">
    <div>
      <p class="eyebrow">Orbita runs</p>
      <h1>Read-only workflow board</h1>
    </div>
    <div class="topbar__meta">
      <span class="source-pill" title="${escapeAttribute(rootLabel)}">${escapeHtml(rootLabel)}</span>
      <label class="search-label">
        <span>Search</span>
        <input type="search" name="q" autocomplete="off" placeholder="Filter runs" value="${escapeAttribute(viewModel.searchQuery)}">
      </label>
      <span class="freshness" aria-live="polite">${escapeHtml(viewModel.freshness)}</span>
      <span class="run-count">${viewModel.runs.length} runs</span>
    </div>
  </header>`;
}

export function renderStatusBanner(viewModel) {
  if (viewModel.readError) {
    return `<section class="status-banner status-banner--error" role="status" aria-live="polite">
      <strong>Dashboard read degraded</strong>
      <span>${escapeHtml(viewModel.readError)}</span>
    </section>`;
  }
  if (viewModel.isLoading) {
    return `<section class="status-banner" role="status" aria-live="polite">
      <strong>Loading board snapshot</strong>
      <span>Waiting for read-only dashboard data.</span>
    </section>`;
  }
  if (viewModel.runs.length === 0 && viewModel.searchQuery) {
    return `<section class="status-banner" role="status">
      <strong>No runs found</strong>
      <span>Clear the filter to return to the full board.</span>
    </section>`;
  }
  return '';
}

export function renderBoard(viewModel) {
  return `<div class="board" data-lane-count="${dashboardLanes.length}" data-render-limit="${laneRenderLimit}">
${dashboardLanes.map((lane) => renderLane(lane, viewModel)).join('\n')}
    </div>`;
}

export function renderDrawer(run) {
  if (!run) {
    return `<aside class="drawer drawer--empty" aria-label="Run details">
      <p>${escapeHtml(dashboardCopy.drawerEmpty)}</p>
    </aside>`;
  }

  return `<aside class="drawer" aria-label="Run details" data-run-id="${escapeAttribute(run.id)}" tabindex="-1">
    <header class="drawer__header">
      <p class="eyebrow">Run details</p>
      <h2>${escapeHtml(run.title)}</h2>
      <p class="drawer__summary">${escapeHtml(run.summary ?? run.promptSummary ?? '')}</p>
    </header>
    <dl class="drawer__facts">
      <div><dt>Run id</dt><dd><code>${escapeHtml(run.id)}</code></dd></div>
      <div><dt>Workflow</dt><dd>${escapeHtml(run.workflowName)}</dd></div>
      <div><dt>Current status</dt><dd>${escapeHtml(run.statusLabel)}</dd></div>
      <div><dt>Current step</dt><dd><code>${escapeHtml(run.stepId)}</code></dd></div>
    </dl>
    ${renderCursorChips(run.cursorBranches, 'drawer')}
    ${renderMiniMap(run.miniMap, run.cursorBranches, run.miniMapProvenance)}
    ${renderArtifacts(run.artifacts)}
    ${renderHistory(run.historyExcerpt)}
    ${renderDiagnostics(run.diagnostics)}
  </aside>`;
}

function renderLane(lane, viewModel) {
  const laneRuns = runsForLane(viewModel.runs, lane.id, viewModel.selectedRunId);
  return `      <section class="lane lane--${lane.tone}" aria-labelledby="lane-${lane.id}">
        <header class="lane__header">
          <h2 id="lane-${lane.id}">${escapeHtml(lane.label)}</h2>
          <span class="lane__count">${viewModel.counts.get(lane.id) ?? 0}</span>
        </header>
        <div class="lane__cards">
${renderLaneCards(lane, laneRuns, viewModel)}
        </div>
      </section>`;
}

function renderLaneCards(lane, laneRuns, viewModel) {
  if (viewModel.isLoading) return renderLaneSkeleton();
  if (laneRuns.all.length === 0) return renderEmptyLane(lane);
  return `${laneRuns.visible.map((run) => renderRunCard(run, run.id === viewModel.selectedRunId)).join('\n')}
${laneRuns.clipped > 0 ? renderLargeListNotice(laneRuns.clipped) : ''}`;
}

function renderRunCard(run, selected) {
  const selectedAttribute = selected ? ' aria-current="true"' : '';
  return `          <article class="run-card${selected ? ' run-card--selected' : ''}" tabindex="0" data-run-id="${escapeAttribute(run.id)}"${selectedAttribute}>
            <div class="run-card__topline">
              <span class="status-chip status-chip--${escapeAttribute(run.laneId)}">${escapeHtml(run.statusLabel)}</span>
              <time datetime="${escapeAttribute(run.updatedAt ?? '')}">${escapeHtml(run.updatedAge ?? relativeTimeLabel(run.updatedAt))}</time>
            </div>
            <h3>${escapeHtml(run.title)}</h3>
            <dl class="run-card__meta">
              <div><dt>Run</dt><dd title="${escapeAttribute(run.id)}"><code>${escapeHtml(shortRunId(run.id))}</code></dd></div>
              <div><dt>Workflow</dt><dd title="${escapeAttribute(run.workflowName)}">${escapeHtml(run.workflowName)}</dd></div>
              <div><dt>Step</dt><dd title="${escapeAttribute(run.stepId)}"><code>${escapeHtml(run.stepId)}</code></dd></div>
            </dl>
            ${renderCursorChips(run.cursorBranches, 'card')}
          </article>`;
}

function renderLaneSkeleton() {
  return `          <div class="run-card run-card--skeleton" aria-hidden="true"></div>
          <div class="run-card run-card--skeleton" aria-hidden="true"></div>`;
}

function renderLargeListNotice(clipped) {
  return `          <p class="lane__bounded">Showing a bounded set of ${laneRenderLimit} runs with the selected run pinned when needed; ${clipped} more match the current filter.</p>`;
}

function renderEmptyLane(lane) {
  const message = lane.id === fallbackLaneId ? 'No degraded reads' : dashboardCopy.emptyResults;
  return `          <p class="lane__empty">${escapeHtml(message)}</p>`;
}

function renderCursorChips(cursorBranches, scope) {
  if (cursorBranches.length === 0) return '';
  return `<div class="cursor-chips cursor-chips--${scope}" aria-label="Active cursor branches">
${cursorBranches.map((branch) => `              <span class="cursor-chip"><code>${escapeHtml(branch)}</code></span>`).join('\n')}
            </div>`;
}

function renderMiniMap(steps, cursorBranches, provenance) {
  if (steps.length === 0) return '';
  const active = new Set(cursorBranches);
  return `<section class="drawer-section mini-map" data-secondary-surface="mini-map" aria-label="${dashboardCopy.minimapLabel}">
      <h3>Workflow mini-map</h3>
      <ol>
${steps.map((step) => renderMiniMapStep(step, active)).join('\n')}
      </ol>
      ${provenance ? `<p class="mini-map__provenance">${escapeHtml(provenance)}</p>` : ''}
    </section>`;
}

function renderMiniMapStep(step, active) {
  const id = String(step.id ?? step.stepId ?? '');
  const state = active.has(id) ? 'active' : step.state || 'pending';
  return `        <li class="mini-map__step mini-map__step--${escapeAttribute(state)}"><code>${escapeHtml(id)}</code><span>${escapeHtml(state)}</span></li>`;
}

function renderArtifacts(artifacts) {
  if (artifacts.length === 0) return '';
  return `<section class="drawer-section" aria-label="Artifacts">
      <h3>Artifacts</h3>
      <ul class="artifact-list">
${artifacts.map((artifact) => `        <li><code>${escapeHtml(artifact.id ?? artifact.name ?? 'artifact')}</code><span>${escapeHtml(artifact.summary ?? artifact.contentType ?? '')}</span></li>`).join('\n')}
      </ul>
    </section>`;
}

function renderHistory(historyExcerpt) {
  if (historyExcerpt.length === 0) return '';
  return `<section class="drawer-section" aria-label="Bounded history excerpt">
      <h3>Bounded history excerpt</h3>
      <ol class="history-list">
${historyExcerpt.slice(0, 6).map((entry) => `        <li><time datetime="${escapeAttribute(entry.at ?? '')}">${escapeHtml(entry.age ?? entry.at ?? '')}</time><span>${escapeHtml(redactControlText(entry.summary ?? ''))}</span></li>`).join('\n')}
      </ol>
    </section>`;
}

function renderDiagnostics(diagnostics) {
  if (diagnostics.length === 0) return '';
  return `<section class="drawer-section diagnostics" aria-label="Degraded diagnostics">
      <h3>Degraded diagnostics</h3>
      <ul>
${diagnostics.map((diagnostic) => `        <li><strong>${escapeHtml(diagnostic.severity ?? 'info')}</strong><span>${escapeHtml(diagnostic.message ?? diagnostic.summary ?? '')}</span></li>`).join('\n')}
      </ul>
    </section>`;
}

function redactControlText(value) {
  return String(value).replace(runnerControlPattern, 'control action');
}
