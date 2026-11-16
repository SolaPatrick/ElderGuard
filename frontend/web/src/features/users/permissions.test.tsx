import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { matchRoutes } from 'react-router';
import { routes } from '../../app/routes';
import { NAV_ITEMS } from '../../layout/navigation';
import { closeAlertPopup, renderApp, signInAs } from '../../test/renderApp';
import { PERMISSIONS } from './permissions';

/** The roles a route guard lets in, or null when any signed-in user may open the page. */
function guardedRoles(path: string): string[] | null {
  const matches = matchRoutes(routes, path) ?? [];
  for (const m of matches) {
    const el = m.route.element;
    if (isValidElement<{ roles?: string[] }>(el) && el.props.roles) return el.props.roles;
  }
  return null;
}

describe('Roles & permissions (USR-09)', () => {
  it('matches the route guards and the sidebar, so the page shows the real rules', () => {
    for (const p of PERMISSIONS) {
      const employeeCanOpen = p.access.employee.view !== 'none';
      const guard = guardedRoles(p.path);
      expect({ module: p.module, open: guard === null || guard.includes('employee') }).toEqual({
        module: p.module,
        open: employeeCanOpen,
      });
      expect(p.access.admin.view).toBe('all');
      const nav = NAV_ITEMS.find((n) => n.to === p.path);
      if (nav)
        expect({ module: p.module, inNav: nav.roles.includes('employee') }).toEqual({
          module: p.module,
          inNav: employeeCanOpen,
        });
    }
  });

  it('keeps resident editing for the Admin/Head, as the routes do', () => {
    expect(guardedRoles('/residents/new')).toEqual(['admin']);
    expect(guardedRoles('/residents/res-1/edit')).toEqual(['admin']);
    const residents = PERMISSIONS.find((p) => p.module === 'Residents')!;
    expect(residents.access.employee).toMatchObject({ create: 'none', edit: 'none', delete: 'none' });
  });

  it('shows the matrix for each role', async () => {
    signInAs('u-teresa');
    const { user } = renderApp('/users');
    await closeAlertPopup(user);
    await user.click(await screen.findByRole('link', { name: 'Roles & permissions' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Roles & permissions' })).toBeInTheDocument();

    const employee = screen.getByRole('table', { name: 'Permissions for Employee' });
    const rooms = within(employee).getByRole('row', { name: /Rooms & areas/ });
    expect(within(rooms).getAllByText('No')).toHaveLength(4);
    const alerts = within(employee).getByRole('row', { name: /^Alerts/ });
    expect(within(alerts).getAllByText('Assigned areas')).toHaveLength(3);

    await user.click(screen.getByRole('tab', { name: 'Admin/Head' }));
    const admin = screen.getByRole('table', { name: 'Permissions for Admin/Head' });
    const adminRooms = within(admin).getByRole('row', { name: /Rooms & areas/ });
    expect(within(adminRooms).getAllByText('Yes')).toHaveLength(4);
  });

  it('is closed to employees', async () => {
    signInAs('u-joel');
    renderApp('/users/permissions');
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
  });
});
