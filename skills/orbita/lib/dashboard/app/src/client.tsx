import { StrictMode, startTransition } from 'react';
import { StartClient } from '@tanstack/react-start/client';
import { hydrateRoot } from 'react-dom/client';

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  );
});
