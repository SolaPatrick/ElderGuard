import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { AppProviders } from '../app/AppProviders';
import { createQueryClient } from '../app/queryClient';
import { routes } from '../app/routes';
import { tokenStorage } from '../auth/tokenStorage';

/** Signs in as a sample user without going through the login screen. */
export function signInAs(userId: 'u-teresa' | 'u-joel') {
  tokenStorage.set(`mock-token:${userId}`, false);
}

/** Renders the whole app (real routes, real providers, fake API) at a URL. */
export function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = createQueryClient();
  const user = userEvent.setup();
  const utils = render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...utils, router, user, queryClient };
}
