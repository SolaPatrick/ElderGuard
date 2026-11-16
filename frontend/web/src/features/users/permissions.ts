import type { Role } from '@elderguard/shared';

/** What a role may do with one kind of action. `null` = the app has no such action for that module. */
export type Access = 'all' | 'assigned' | 'none' | null;

export const ACTIONS = ['view', 'create', 'edit', 'delete', 'export'] as const;
export type Action = (typeof ACTIONS)[number];

export const ACTION_LABEL: Record<Action, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  export: 'Export',
};

export interface ModulePermissions {
  module: string;
  /** The page that opens the module, used by the tests to check the matrix against the real route guards. */
  path: string;
  /** What each action means here, shown under the module name. */
  note: string;
  access: Record<Role, Record<Action, Access>>;
}

const row = (view: Access, create: Access, edit: Access, del: Access, exp: Access) => ({
  view,
  create,
  edit,
  delete: del,
  export: exp,
});

/**
 * USR-09: the rules the app and both servers enforce today, written down. Nothing here is
 * configurable yet: the mock and Den's FastAPI server both hard-code them (admin-only routes
 * answer 403 to employees). Keep this in step with app/routes.tsx and the servers.
 */
export const PERMISSIONS: ModulePermissions[] = [
  {
    module: 'Dashboard',
    path: '/',
    note: 'Alert counts and the latest alerts.',
    access: { admin: row('all', null, null, null, null), employee: row('assigned', null, null, null, null) },
  },
  {
    module: 'Live monitoring',
    path: '/monitoring',
    note: 'Camera feeds.',
    access: { admin: row('all', null, null, null, null), employee: row('assigned', null, null, null, null) },
  },
  {
    module: 'Alerts',
    path: '/alerts',
    note: 'Create = send an SOS. Edit = acknowledge, classify, resolve and add notes.',
    access: {
      admin: row('all', 'all', 'all', 'none', null),
      employee: row('assigned', 'assigned', 'assigned', 'none', null),
    },
  },
  {
    module: 'Incidents',
    path: '/incidents',
    note: 'The history of every fall alert and SOS. Export = CSV.',
    access: {
      admin: row('all', null, null, 'none', 'all'),
      employee: row('assigned', null, null, 'none', 'assigned'),
    },
  },
  {
    module: 'Residents',
    path: '/residents',
    note: 'Delete = move out (archive).',
    access: {
      admin: row('all', 'all', 'all', 'all', null),
      employee: row('assigned', 'none', 'none', 'none', null),
    },
  },
  {
    module: 'Rooms & areas',
    path: '/rooms',
    note: 'The rooms and areas cameras and residents belong to.',
    access: {
      admin: row('all', 'all', 'all', 'all', null),
      employee: row('none', 'none', 'none', 'none', null),
    },
  },
  {
    module: 'Cameras & devices',
    path: '/cameras',
    note: 'Camera setup and device health. Employees still watch feeds in Live monitoring.',
    access: {
      admin: row('all', 'all', 'all', 'all', null),
      employee: row('none', 'none', 'none', 'none', null),
    },
  },
  {
    module: 'Users & access',
    path: '/users',
    note: 'Staff accounts. Delete = deactivate.',
    access: {
      admin: row('all', 'all', 'all', 'all', null),
      employee: row('none', 'none', 'none', 'none', null),
    },
  },
  {
    module: 'Reports',
    path: '/reports',
    note: 'Export = print, PDF or CSV.',
    access: {
      admin: row('all', 'all', null, null, 'all'),
      employee: row('none', 'none', null, null, 'none'),
    },
  },
  {
    module: 'Activity log',
    path: '/activity',
    note: 'Export = CSV.',
    access: { admin: row('all', null, null, null, 'all'), employee: row('none', null, null, null, 'none') },
  },
  {
    module: 'Settings',
    path: '/settings',
    note: 'Facility, detection, notification and security settings.',
    access: { admin: row('all', null, 'all', null, null), employee: row('none', null, 'none', null, null) },
  },
];
