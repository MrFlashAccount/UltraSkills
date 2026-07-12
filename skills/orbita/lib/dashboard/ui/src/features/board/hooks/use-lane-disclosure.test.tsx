import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useLaneDisclosure } from './use-lane-disclosure';

describe('useLaneDisclosure', () => {
  it('reveals a first live attention arrival and then preserves the user choice', () => {
    const { result, rerender } = renderHook(({ count }) => useLaneDisclosure(true, count, false), {
      initialProps: { count: 0 },
    });
    expect(result.current.expanded).toBe(false);
    rerender({ count: 1 });
    expect(result.current.expanded).toBe(true);
    act(() => result.current.setExpanded(false));
    rerender({ count: 0 });
    rerender({ count: 1 });
    expect(result.current.expanded).toBe(false);
  });
});
