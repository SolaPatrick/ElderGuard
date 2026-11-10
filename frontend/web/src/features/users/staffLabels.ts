import type { Role, StaffMember } from '@elderguard/shared';

/** Role names as the Users & Access designs show them. */
export const ROLE_LABEL: Record<Role, string> = { admin: 'Admin/Head', employee: 'Employee' };

/** "Rooms 101, 102", "All areas" for the Admin/Head, or an em dash when nothing is assigned. */
export function areasLabel(s: StaffMember): string {
  if (s.role === 'admin') return 'All areas';
  return s.areas.map((a) => a.name).join(', ') || '—';
}

export type StatusFilter = '' | 'active' | 'deactivated';

export function filterStaff(
  staff: StaffMember[],
  { search, role, status }: { search: string; role: Role | ''; status: StatusFilter },
): StaffMember[] {
  const q = search.trim().toLowerCase();
  return staff.filter(
    (s) =>
      (role === '' || s.role === role) &&
      (status === '' || s.isActive === (status === 'active')) &&
      (q === '' || [s.fullName, s.username, s.email ?? ''].some((v) => v.toLowerCase().includes(q))),
  );
}
