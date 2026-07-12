/** Single process-owned dashboard composition. Request input never controls filesystem paths. */
import { isAbsolute, resolve } from 'node:path';
import { statSync } from 'node:fs';
// @ts-expect-error Durable persistence is legacy MJS; its exported root is runtime-validated below.
import { workflowRunsRoot } from '../../../../persistence/run-state/paths.mjs';
import {
  DashboardReadModel,
  ObserverUnavailableError,
} from '../../../../dashboard/observer/dashboard-read-model.server';
import { RunsRootObserverReader } from '../../../../dashboard/observer/runs-root-observer-reader.server';

export type DashboardServerConfig = {
  runsRoot: string;
  host: string;
  port: number;
  pollMs: number;
  heartbeatMs: number;
  staleMs: number;
  coalesceMs: number;
};

export class DashboardConfigurationError extends Error {}

function boundedInteger(
  name: string,
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value == null || value === '') return fallback;
  if (!/^\d+$/u.test(value)) throw new Error(`${name} must be an integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max)
    throw new Error(`${name} is outside the allowed range`);
  return parsed;
}

export function dashboardServerConfig(
  env: Record<string, string | undefined> = process.env,
): DashboardServerConfig {
  const configuredRoot = env.ORBITA_DASHBOARD_RUNS_ROOT ?? workflowRunsRoot;
  if (env.ORBITA_DASHBOARD_RUNS_ROOT && !isAbsolute(configuredRoot)) {
    throw new DashboardConfigurationError('Dashboard runs root is not configured');
  }
  const runsRoot = resolve(configuredRoot);
  if (!statSync(runsRoot, { throwIfNoEntry: false })?.isDirectory())
    throw new DashboardConfigurationError('Dashboard runs root is not configured');
  const host = env.ORBITA_DASHBOARD_HOST ?? env.NITRO_HOST ?? env.HOST ?? '127.0.0.1';
  if (!/^[A-Za-z0-9.:[\]-]{1,255}$/u.test(host))
    throw new Error('ORBITA_DASHBOARD_HOST is invalid');
  return {
    runsRoot,
    host,
    port: boundedInteger(
      'ORBITA_DASHBOARD_PORT',
      env.ORBITA_DASHBOARD_PORT ?? env.NITRO_PORT ?? env.PORT,
      3000,
      0,
      65_535,
    ),
    pollMs: boundedInteger(
      'ORBITA_DASHBOARD_POLL_MS',
      env.ORBITA_DASHBOARD_POLL_MS,
      2_000,
      250,
      300_000,
    ),
    heartbeatMs: boundedInteger(
      'ORBITA_DASHBOARD_HEARTBEAT_MS',
      env.ORBITA_DASHBOARD_HEARTBEAT_MS,
      15_000,
      1_000,
      120_000,
    ),
    staleMs: boundedInteger(
      'ORBITA_DASHBOARD_STALE_MS',
      env.ORBITA_DASHBOARD_STALE_MS,
      10_000,
      1_000,
      600_000,
    ),
    coalesceMs: boundedInteger(
      'ORBITA_DASHBOARD_COALESCE_MS',
      env.ORBITA_DASHBOARD_COALESCE_MS,
      100,
      10,
      1_000,
    ),
  };
}

export function createDashboardComposition(
  config = dashboardServerConfig(),
  reader: Pick<RunsRootObserverReader, 'listRuns' | 'getRun'> = new RunsRootObserverReader(
    config.runsRoot,
  ),
) {
  const readModel = new DashboardReadModel(reader, {
    runsRoot: config.runsRoot,
    pollMs: config.pollMs,
    staleAfterMs: config.staleMs,
    watchCoalesceMs: config.coalesceMs,
    invalidationCoalesceMs: config.coalesceMs,
  });
  readModel.start();
  return { config, readModel, close: () => readModel.close() };
}

let singleton: ReturnType<typeof createDashboardComposition> | undefined;
let unbindLifecycle: (() => void) | undefined;

type ProcessLifecycle = Pick<NodeJS.Process, 'once' | 'off'>;
type NitroHooks = { hook(name: 'close', callback: () => Promise<void>): (() => void) | void };

/** Bind the process singleton to both Nitro close and Bun's actual termination signals. */
export function bindDashboardLifecycle(
  processLifecycle: ProcessLifecycle = process,
  nitroHooks: NitroHooks | undefined = (globalThis as any).__nitro__?.default?.hooks,
  terminate: (code: number) => void = (code) => process.exit(code),
  closeOperation: () => Promise<void> = closeDashboardComposition,
): () => void {
  const close = async () => {
    await closeOperation();
  };
  const onBeforeExit = () => {
    void close();
  };
  const onSignal = () => {
    void close().finally(() => terminate(0));
  };
  processLifecycle.once('beforeExit', onBeforeExit);
  processLifecycle.once('SIGINT', onSignal);
  processLifecycle.once('SIGTERM', onSignal);
  const removeNitroHook = nitroHooks?.hook('close', close);
  return () => {
    processLifecycle.off('beforeExit', onBeforeExit);
    processLifecycle.off('SIGINT', onSignal);
    processLifecycle.off('SIGTERM', onSignal);
    removeNitroHook?.();
  };
}

export function getDashboardComposition() {
  if (!singleton) {
    singleton = createDashboardComposition();
    unbindLifecycle = bindDashboardLifecycle();
  }
  return singleton;
}

export async function closeDashboardComposition(): Promise<void> {
  const current = singleton;
  singleton = undefined;
  unbindLifecycle?.();
  unbindLifecycle = undefined;
  await current?.close();
}

export function isObserverUnavailable(error: unknown): boolean {
  return error instanceof ObserverUnavailableError;
}

export function isDashboardConfigurationError(error: unknown): boolean {
  return error instanceof DashboardConfigurationError;
}
