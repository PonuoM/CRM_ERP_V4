import { Role } from "@/services/roleApi";

/**
 * Check if the user's role has system access (is_system = 1)
 * @param userRoleName The name of the user's role
 * @param roles List of all available roles
 * @returns true if the role is a system role
 */
export const isSystemCheck = (userRoleName: string, roles: Role[]): boolean => {
    const assignedRole = roles.find((r) => r.name === userRoleName);
    return !!assignedRole?.is_active && !!assignedRole?.is_system;
};
