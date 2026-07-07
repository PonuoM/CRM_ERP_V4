import { User } from '../types';

export function filterTeamUsers(users: User[], selectedTeam: string): User[] {
  const validRoles = [3, 6, 7];
  let result = users.filter((u) => validRoles.includes(Number(u.role_id)));

  if (selectedTeam === 'admin_page') {
    result = result.filter((u) => Number(u.role_id) === 3);
  } else if (selectedTeam.startsWith('team_')) {
    const supId = selectedTeam.replace('team_', '');
    result = result.filter(
      (u) =>
        Number(u.supervisorId) === Number(supId) ||
        Number(u.id) === Number(supId)
    );
  }

  // Sort employees alphabetically for better UX
  result.sort((a, b) => a.firstName.localeCompare(b.firstName));

  return result;
}
