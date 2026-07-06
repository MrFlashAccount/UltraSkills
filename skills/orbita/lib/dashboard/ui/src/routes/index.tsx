import { createFileRoute } from '@tanstack/react-router';
import { DashboardApp } from '../components/DashboardApp';
import { fetchDashboardRuns } from '../api/dashboardClient';

export const Route = createFileRoute('/')({
  loader: () => fetchDashboardRuns(),
  component: DashboardRoute,
});

function DashboardRoute() {
  const initialSnapshot = Route.useLoaderData();
  return <DashboardApp initialSnapshot={initialSnapshot} />;
}
