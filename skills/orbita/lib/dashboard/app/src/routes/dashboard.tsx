import { createFileRoute } from '@tanstack/react-router';
import { DashboardApp } from '../../../ui/DashboardApp';

export const Route = createFileRoute('/dashboard')({
  component: DashboardApp,
});
