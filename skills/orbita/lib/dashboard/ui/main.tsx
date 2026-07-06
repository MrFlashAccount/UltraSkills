import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './Dashboard.module.css';

const root = document.getElementById('orbita-dashboard-root');

if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
