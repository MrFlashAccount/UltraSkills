import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeDetail } from '@/test/fixtures';
import { AppProviders } from '@/app/AppProviders';
import { RunDetailSurface } from './RunDetailSurface';

const renderDetail = (component: React.ReactNode) => render(<AppProviders>{component}</AppProviders>);

describe('RunDetailSurface', () => {
  it('renders bounded detail facts and restores through explicit close', () => {
    const close = vi.fn();
    renderDetail(<RunDetailSurface selectedId="run-1" visibleInResults detail={makeDetail()} isLoading={false} isError={false} onClose={close} onReturnFocus={() => {}} />);
    expect(screen.getByRole('complementary', { name: 'Run details' })).toHaveTextContent('A bounded public summary');
    expect(screen.getByText('ui-design-proposal')).toBeVisible();
    expect(screen.getByRole('list', { name: '2 workflow steps' })).toHaveTextContent('implementation');
    expect(screen.getByText('implementation').closest('li')).toHaveAttribute('aria-current', 'step');
    fireEvent.click(screen.getByRole('button', { name: 'Close details' }));
    expect(close).toHaveBeenCalledOnce();
  });

  it('preserves a missing selection instead of selecting a neighbor', () => {
    renderDetail(<RunDetailSurface selectedId="run-1" visibleInResults={false} isLoading={false} isError={false} onClose={() => {}} onReturnFocus={() => {}} />);
    expect(screen.getByText('This run is no longer in the current results')).toBeVisible();
  });

  it('returns Shift+Tab from the wide complementary close target to the selected card', () => {
    const returnFocus = vi.fn();
    renderDetail(<RunDetailSurface selectedId="run-1" visibleInResults detail={makeDetail()} isLoading={false} isError={false} onClose={() => {}} onReturnFocus={returnFocus} />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Close details' }), { key: 'Tab', shiftKey: true });
    expect(returnFocus).toHaveBeenCalledOnce();
  });
});
