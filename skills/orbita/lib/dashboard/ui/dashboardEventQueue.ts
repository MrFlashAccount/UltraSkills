import type { DashboardRun } from './dashboardTypes';

type TimerHandle = ReturnType<typeof setTimeout>;

type RunUpdateQueueOptions = {
  loadRun: (runId: string) => Promise<DashboardRun>;
  applyRuns: (runs: DashboardRun[]) => void;
  onError: (error: unknown, runIds: string[]) => void;
  delayMs?: number;
  setTimer?: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
};

export function createRunUpdateQueue({
  loadRun,
  applyRuns,
  onError,
  delayMs = 50,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}: RunUpdateQueueOptions) {
  const pendingRunIds = new Set<string>();
  let timer: TimerHandle | null = null;

  async function flush() {
    const runIds = [...pendingRunIds];
    pendingRunIds.clear();
    timer = null;
    if (runIds.length === 0) return;
    try {
      applyRuns(await Promise.all(runIds.map((runId) => loadRun(runId))));
    } catch (error) {
      onError(error, runIds);
    }
  }

  function enqueue(runId: string) {
    pendingRunIds.add(runId);
    if (timer !== null) return;
    timer = setTimer(() => {
      void flush();
    }, delayMs);
  }

  function dispose() {
    if (timer !== null) clearTimer(timer);
    timer = null;
    pendingRunIds.clear();
  }

  return { enqueue, flush, dispose };
}
