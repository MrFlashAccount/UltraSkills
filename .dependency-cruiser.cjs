/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
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
      extensions: ['.mjs', '.js', '.json'],
    },
    progress: { type: 'none' },
  },
};
