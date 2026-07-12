import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RunCard } from './RunCard';
import { SnapshotError, EmptyRoot, NoMatches } from './states/BoardStates';
import { makeRun } from '@/test/fixtures';

const roving = {
  current: { current: undefined },
  focusRun: vi.fn(),
  onCardKeyDown: vi.fn(),
  registerCard: vi.fn(),
  registerVirtualTarget: vi.fn(),
  registerLaneHeader: vi.fn(),
};

describe('board UI contracts', () => {
  it('renders one bounded selection target with approved anatomy', () => {
    const onSelect = vi.fn();
    render(
      <RunCard
        run={makeRun()}
        selected={false}
        onSelect={onSelect}
        roving={roving}
        ensureVisible={() => {}}
      />,
    );
    const card = screen.getByRole('button', { name: /Run 1 needs attention/ });
    expect(card).toHaveTextContent('Approval needed');
    expect(card).toHaveTextContent('dev-harness');
    expect(card).toHaveTextContent('step-1');
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledWith('run-1', card);
  });

  it('labels unsupported cursors without inventing branches', () => {
    render(
      <RunCard
        run={{ ...makeRun(), cursor: { kind: 'unsupported' } }}
        selected
        roving={roving}
        ensureVisible={() => {}}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText('Unsupported cursor')).toBeVisible();
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps failed, unconfigured, and filtered-empty states distinct', () => {
    const { rerender } = render(<SnapshotError onRetry={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load runs');
    rerender(<EmptyRoot onRetry={() => {}} />);
    expect(screen.getByText('Runs root is not configured')).toBeVisible();
    rerender(<NoMatches onClear={() => {}} />);
    expect(screen.getByText('No runs match these filters')).toBeVisible();
  });
});
