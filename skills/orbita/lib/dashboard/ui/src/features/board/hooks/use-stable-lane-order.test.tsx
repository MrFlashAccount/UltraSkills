import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeRun } from '@/test/fixtures';
import { useStableLaneOrder } from './use-stable-lane-order';

describe('useStableLaneOrder', () => {
  it('retains same-lane order and places new runs at the head', () => {
    const initial = [makeRun(1), makeRun(2)];
    const { result, rerender } = renderHook(({ runs }) => useStableLaneOrder(runs, 0), { initialProps: { runs: initial } });
    expect(result.current.map((run) => run.runId)).toEqual(['run-1', 'run-2']);
    act(() => rerender({ runs: [...initial, makeRun(3)] }));
    expect(result.current.map((run) => run.runId)).toEqual(['run-3', 'run-1', 'run-2']);
  });

  it('creates a new ordinal on lane reclassification', () => {
    const initial = [makeRun(1, 'needs_help'), makeRun(2, 'needs_help')];
    const { result, rerender } = renderHook(({ runs }) => useStableLaneOrder(runs, 0), { initialProps: { runs: initial } });
    act(() => rerender({ runs: [{ ...initial[1], laneId: 'done' as const }, initial[0]] }));
    expect(result.current[0].runId).toBe('run-2');
  });
});
