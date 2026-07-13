/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'orbita-host-action-plan-stays-pure',
      severity: 'error',
      comment: 'Effective host-action selection is a pure runtime projection over executable entries and baton control state.',
      from: { path: '^skills/orbita/lib/runtime/host-action-plan[.]mjs$' },
      to: {
        path: '^(?:skills/orbita/lib/(?:persistence|entrypoints|entities/Template)/|skills/orbita/lib/runner/runner-command-builder[.]mjs$|(?:node:)?(?:fs|path|url|util)(?:/|$))',
      },
    },
    {
      name: 'orbita-approval-contract-stays-runtime-owned',
      severity: 'error',
      comment: 'Approval selection/rendering owns no Template, output-schema loader, persistence, entrypoint, or Node IO dependency.',
      from: { path: '^skills/orbita/lib/runtime/approval-contract[.]mjs$' },
      to: {
        path: '^(?:skills/orbita/lib/(?:persistence|entrypoints|entities/Template)/|skills/orbita/lib/runtime/output/output-schema-validation[.]mjs$|(?:node:)?(?:fs|path|url|util)(?:/|$))',
      },
    },
    {
      name: 'orbita-entrypoints-not-to-renderers',
      severity: 'error',
      comment: 'All production entrypoints dispatch public runner boundaries and never select runtime renderers directly.',
      from: { path: '^skills/orbita/lib/entrypoints/' },
      to: { path: '^skills/orbita/lib/runtime/(?:render-worker-instructions|approval-contract|host-action-plan)[.]mjs$' },
    },
    {
      name: 'orbita-stop-terminal-owner-not-to-consumer-renderers',
      severity: 'error',
      comment: 'The host response owner projects stop and terminal actions without Template or workflow output-schema loaders.',
      from: { path: '^skills/orbita/lib/runner/host-requests[.]mjs$' },
      to: {
        path: '^(?:skills/orbita/lib/entities/Template/|skills/orbita/lib/runtime/render-worker-instructions[.]mjs$|skills/orbita/lib/(?:runtime/output/output-schema-validation|persistence/workflow-resources/output-schema-loader)[.]mjs$)',
      },
    },
    {
      name: 'orbita-entrypoints-not-to-runtime-internals',
      severity: 'error',
      comment: 'Entrypoints must call use-case APIs instead of reaching into runtime internals.',
      from: { path: '^skills/orbita/lib/entrypoints/' },
      to: { path: '^skills/orbita/lib/use-cases/runtime/' },
    },
    {
      name: 'orbita-cli-not-to-api-entrypoints',
      severity: 'error',
      comment: 'CLI entrypoints and API entrypoints are sibling adapters; CLI must not import API adapters.',
      from: { path: '^skills/orbita/lib/entrypoints/cli/' },
      to: { path: '^skills/orbita/lib/entrypoints/api/' },
    },
    {
      name: 'orbita-no-imports-to-entrypoints',
      severity: 'error',
      comment: 'Entrypoints are outer adapters and must not become reusable library surfaces.',
      from: { pathNot: '^skills/orbita/lib/entrypoints/' },
      to: { path: '^skills/orbita/lib/entrypoints/' },
    },
    {
      name: 'orbita-top-level-use-cases-not-to-persistence',
      severity: 'error',
      comment: 'Top-level use cases must stay IO-free and receive persistence facts through their API boundary.',
      from: { path: '^skills/orbita/lib/use-cases/[A-Z][^/]*[.]mjs$' },
      to: { path: '^skills/orbita/lib/persistence/' },
    },
    {
      name: 'orbita-top-level-use-cases-not-to-catalog-reader',
      severity: 'error',
      comment: 'Top-level use cases must receive catalog facts through entrypoint adapters, not read catalogs directly.',
      from: { path: '^skills/orbita/lib/use-cases/[A-Z][^/]*[.]mjs$' },
      to: { path: '^skills/orbita/lib/workflow-catalog-reader[.]mjs$' },
    },
    {
      name: 'orbita-runtime-helpers-not-to-persistence',
      severity: 'error',
      comment: 'Runtime helpers must stay deterministic and persistence-free.',
      from: { path: '^skills/orbita/lib/use-cases/runtime/' },
      to: { path: '^skills/orbita/lib/persistence/' },
    },
    {
      name: 'orbita-persistence-not-to-use-cases',
      severity: 'error',
      comment: 'Persistence is a detail layer and must not import application use cases.',
      from: { path: '^skills/orbita/lib/persistence/' },
      to: { path: '^skills/orbita/lib/use-cases/' },
    },
    {
      name: 'orbita-run-state-not-to-startup-validation',
      severity: 'error',
      comment: 'Run-state persistence must not own workflow startup validation.',
      from: { path: '^skills/orbita/lib/persistence/run-state/' },
      to: { path: '^skills/orbita/lib/workflow-startup-validation[.]mjs$' },
    },
    {
      name: 'orbita-runner-runtime-not-to-catalog-config',
      severity: 'error',
      comment: 'Runner runtime must use persisted workflow paths and must not rediscover workflow catalogs/config.',
      from: {
        path: '^(?:skills/orbita/lib/use-cases/runtime/|skills/orbita/lib/entrypoints/workflow-runner-command[.]mjs$)',
      },
      to: {
        path: '^(?:skills/orbita/lib/workflow-catalog-reader[.]mjs$|skills/orbita/lib/persistence/config/)',
      },
    },
    {
      name: 'orbita-top-level-use-cases-not-to-node-io',
      severity: 'error',
      comment: 'Top-level use cases must not import filesystem/path core modules directly.',
      from: { path: '^skills/orbita/lib/use-cases/[A-Z][^/]*[.]mjs$' },
      to: {
        dependencyTypes: ['core'],
        path: '^(?:node:)?(?:fs|path)$',
      },
    },
    {
      name: 'orbita-runtime-helpers-not-to-node-io',
      severity: 'error',
      comment: 'Runtime helpers must not import filesystem/path core modules directly.',
      from: { path: '^skills/orbita/lib/use-cases/runtime/' },
      to: {
        dependencyTypes: ['core'],
        path: '^(?:node:)?(?:fs|path)$',
      },
    },
    {
      name: 'orbita-persistence-not-to-baton-schema',
      severity: 'error',
      comment: 'Persistence must not depend on entity-owned Baton schema after schema ownership is separated.',
      from: { path: '^skills/orbita/lib/persistence/' },
      to: { path: '^skills/orbita/lib/entities/Baton/schema/' },
    },
    {
      name: 'orbita-entities-not-to-other-entity-families',
      severity: 'error',
      comment: 'Entity families must be independent; shared behavior belongs outside cross-family imports.',
      from: { path: '^skills/orbita/lib/entities/([^/]+)/' },
      to: {
        path: '^skills/orbita/lib/entities/',
        pathNot: '^skills/orbita/lib/entities/$1/',
      },
    },
    {
      name: 'orbita-use-cases-not-to-other-use-case-families',
      severity: 'error',
      comment: 'Use-case families must not import other use-case families, including deep runtime/internal imports.',
      from: { path: '^skills/orbita/lib/use-cases/([^/.]+)(?:[/.]|$)' },
      to: {
        path: '^skills/orbita/lib/use-cases/',
        pathNot: '^skills/orbita/lib/use-cases/$1(?:[/.]|$)',
      },
    },
    {
      name: 'orbita-dtos-not-to-other-dto-files',
      severity: 'error',
      comment: 'DTO files must not import other DTO files; shared normalization should live outside DTO cross-imports.',
      from: { path: '^skills/orbita/lib/dtos/([^/.]+)(?:[.]mjs$|/)' },
      to: {
        path: '^skills/orbita/lib/dtos/',
        pathNot: '^skills/orbita/lib/dtos/$1(?:[.]mjs$|/)',
      },
    },
    {
      name: 'orbita-dashboard-contracts-are-browser-safe',
      severity: 'error',
      comment: 'Dashboard contracts are the browser-safe schema boundary and must not depend on implementation or Node-only modules.',
      from: { path: '^skills/orbita/lib/dashboard/contracts/' },
      to: {
        path: '^(?:skills/orbita/lib/dashboard/(?:projection|observer|ui)/|skills/orbita/lib/(?:persistence|entrypoints|use-cases|entities)/|(?:node:)?(?:fs|path|http|https|os|util|url|stream|events)(?:/|$))',
      },
    },
    {
      name: 'orbita-dashboard-projection-stays-pure-server-policy',
      severity: 'error',
      comment: 'Projection owns classification and disclosure policy, not IO, transport, observer lifecycle, runner control, or browser rendering.',
      from: { path: '^skills/orbita/lib/dashboard/projection/' },
      to: {
        path: '^(?:skills/orbita/lib/dashboard/(?:observer|ui)/|skills/orbita/lib/(?:persistence|entrypoints|use-cases)/|(?:node:)?(?:fs|path|http|https|os|util|url|stream|events)(?:/|$))',
      },
    },
    {
      name: 'orbita-dashboard-observer-not-to-ui-or-control',
      severity: 'error',
      comment: 'Observer may read durable state but must not depend on UI, entrypoints, runner mutation/control, writers, locks, or lease ownership.',
      from: { path: '^skills/orbita/lib/dashboard/observer/' },
      to: {
        path: '^(?:skills/orbita/lib/dashboard/ui/|skills/orbita/lib/entrypoints/|skills/orbita/lib/use-cases/(?:runtime/)?(?:Continue|Next|WriteOutput|Claim|Heartbeat|Move|Repair|Retry)|skills/orbita/lib/persistence/run-state/(?:PersistedRunStateWriter|lease-authority|lock-metadata|lock)[.]mjs$)',
      },
    },
    {
      name: 'orbita-dashboard-server-composition-is-the-observer-seam',
      severity: 'error',
      comment: 'Dashboard server helpers and transport may reach observer modules only through dashboard-composition.server.ts.',
      from: {
        path: '^skills/orbita/lib/dashboard/ui/src/server/',
        pathNot: '^skills/orbita/lib/dashboard/ui/src/server/dashboard-composition[.]server[.]ts$',
      },
      to: { path: '^skills/orbita/lib/dashboard/observer/' },
    },
    {
      name: 'orbita-dashboard-api-routes-use-server-composition-only',
      severity: 'error',
      comment: 'Versioned Start API routes frame transport and may not reach observer, projection, or persistence directly.',
      from: { path: '^skills/orbita/lib/dashboard/ui/src/routes/api[.]dashboard[.]v1[.]' },
      to: {
        path: '^(?:skills/orbita/lib/dashboard/(?:observer|projection)/|skills/orbita/lib/persistence/)',
      },
    },
    {
      name: 'orbita-dashboard-browser-not-to-server',
      severity: 'error',
      comment: 'Client-reachable dashboard modules may import browser-safe contracts, never server, projection, observer, persistence, runner internals, or entrypoints.',
      from: {
        path: '^skills/orbita/lib/dashboard/ui/src/',
        pathNot: '^skills/orbita/lib/dashboard/ui/src/(?:server/|routes/api[.]dashboard[.]v1[.])',
      },
      to: {
        path: '^(?:skills/orbita/lib/dashboard/(?:observer|projection)/|skills/orbita/lib/dashboard/ui/src/server/|skills/orbita/lib/(?:persistence|entrypoints|use-cases|entities)/|.*[.]server[.](?:ts|tsx)$|(?:node:)?(?:fs|path|http|https|os|util|url|stream|events)(?:/|$))',
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
      dependencyTypes: [
        'npm',
        'npm-dev',
        'npm-optional',
        'npm-peer',
        'npm-bundled',
        'npm-no-pkg',
      ],
    },
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.mjs', '.js', '.json'],
    },
    progress: { type: 'none' },
  },
};
