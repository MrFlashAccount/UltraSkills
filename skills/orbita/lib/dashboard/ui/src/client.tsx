import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { getRouter } from './router';

const rootElement = document.getElementById('orbita-dashboard-root');

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <RouterProvider router={getRouter()} />
    </StrictMode>,
  );
}
