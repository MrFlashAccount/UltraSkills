import type { ReactNode } from 'react';
import { Outlet, createRootRoute } from '@tanstack/react-router';
import '../components/dashboard.module.css';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
