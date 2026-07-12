import type { QueryClient } from '@tanstack/react-query';
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { AppProviders } from '@/app/AppProviders';
import appCss from '@/styles/app.css?url';

type RouterContext = { queryClient: QueryClient };

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Orbita runs' },
      { name: 'description', content: 'Read-only Orbita run observer' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
  errorComponent: () => <main className="fatal-state"><h1>Dashboard unavailable</h1><p>Reload the page to try again.</p></main>,
});

function RootComponent() {
  return <RootDocument><AppProviders><Outlet /></AppProviders></RootDocument>;
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><head><HeadContent /></head><body>{children}<Scripts /></body></html>;
}
