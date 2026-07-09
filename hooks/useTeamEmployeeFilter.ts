import { useMemo } from 'react';
import { User } from '../types';

import { filterTeamUsers } from '../utils/filterTeamUsers';

export default function useTeamEmployeeFilter(users: User[], selectedTeam: string) {
  const availableTeams = useMemo(() => {
    const validRoles = [3, 6, 7];
    const teams: { id: string; name: string }[] = [];

    const hasAdmin = users.some((u) => Number(u.role_id) === 3);
    if (hasAdmin) {
      teams.push({ id: 'admin_page', name: 'Admin Page' });
    }

    // Find all unique supervisor IDs from all users
    const supervisorIds = new Set(
      users.map((u) => u.supervisorId).filter((id) => id != null)
    );

    // Create a team for each supervisor, BUT ONLY IF the supervisor themselves is in validRoles
    const supTeams: { id: string; name: string }[] = [];
    supervisorIds.forEach((id) => {
      const sup = users.find((u) => Number(u.id) === Number(id));
      if (sup && validRoles.includes(Number(sup.role_id))) {
        supTeams.push({ id: `team_${sup.id}`, name: `ทีม${sup.firstName}` });
      }
    });

    // Sort supervisor teams alphabetically for better UX
    supTeams.sort((a, b) => a.name.localeCompare(b.name));

    return [...teams, ...supTeams];
  }, [users]);

  const filteredUsers = useMemo(() => filterTeamUsers(users, selectedTeam), [users, selectedTeam]);

  return { availableTeams, filteredUsers };
}
