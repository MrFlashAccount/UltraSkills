import { useQuery } from '@tanstack/react-query';
import { RunDetailSchema } from '@dashboard-contracts';

async function fetchRunDetail(runId: string) {
  const response = await fetch(`/api/dashboard/v1/runs/${encodeURIComponent(runId)}`, {
    headers: { Accept: 'application/json' },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('detail_unavailable');
  return RunDetailSchema.parse(await response.json());
}

export function useRunDetailQuery(runId?: string) {
  return useQuery({
    queryKey: ['dashboard', 'run-detail', runId],
    queryFn: () => fetchRunDetail(runId!),
    enabled: typeof window !== 'undefined' && Boolean(runId),
    retry: 1,
  });
}
