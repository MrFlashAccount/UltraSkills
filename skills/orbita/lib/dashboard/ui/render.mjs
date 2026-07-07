import { renderBoard, renderDrawer, renderStatusBanner, renderTopbar } from './components.mjs';
import { escapeAttribute, escapeHtml } from './html.mjs';
import { normalizeRuns, relativeTimeLabel } from './normalizers.mjs';
import { createDashboardViewModel } from './selectors.mjs';

export { normalizeRuns } from './normalizers.mjs';

export function renderDashboardShell(snapshot = {}, options = {}) {
  const title = escapeHtml(options.title ?? 'Orbita Dashboard');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <link rel="stylesheet" href="${escapeAttribute(options.stylesHref ?? '/dashboard/style.css')}">
</head>
<body>
${renderDashboard(snapshot)}
  <script type="module" src="${escapeAttribute(options.clientSrc ?? '/dashboard/client.js')}"></script>
</body>
</html>`;
}

export function renderDashboard(snapshot = {}) {
  const viewModel = createDashboardViewModel({
    ...snapshot,
    runs: normalizeRuns(snapshot.runs),
    freshness: snapshot.freshnessLabel ?? relativeTimeLabel(snapshot.generatedAt),
  });

  return `<main class="orbita-dashboard" data-read-only="true">
  ${renderTopbar(viewModel)}
  ${renderStatusBanner(viewModel)}
  <section class="board-shell" aria-label="Runs board">
    ${renderBoard(viewModel)}
    ${renderDrawer(viewModel.selectedRun)}
  </section>
</main>`;
}
