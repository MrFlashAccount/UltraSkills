import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function DetailLoading() { return <div className="detail-state" aria-busy="true"><Skeleton /><Skeleton /></div>; }
export function DetailError() { return <div className="detail-state" role="alert"><h3>Run details unavailable</h3><p>The board remains available. Close details or try this run again later.</p></div>; }
export function MissingSelection({ onBack }: Readonly<{ onBack: () => void }>) { return <div className="detail-state"><h3>This run is no longer in the current results</h3><p>The selection was preserved. No neighboring run was selected.</p><Button onClick={onBack}>Back to board</Button></div>; }
