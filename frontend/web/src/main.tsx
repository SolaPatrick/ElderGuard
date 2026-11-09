import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { AppProviders } from './app/AppProviders';
import { routes } from './app/routes';
import { USE_MOCKS } from './api/config';

async function startFakeApi() {
  if (!USE_MOCKS) return;
  const { worker } = await import('./mocks/browser');
  await worker.start({ quiet: true, onUnhandledFrame: 'bypass' });
}

const router = createBrowserRouter(routes);

void startFakeApi().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  );
});
