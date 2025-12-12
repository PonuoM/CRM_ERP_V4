// Role Management API Functions
import { apiFetch } from './api';

export interface Role {
    id: number;
    code: string;
    name: string;
    description?: string;
    is_active: boolean;
    is_system: boolean;
    created_at: string;
    updated_at: string;
}

export interface UserPermissionOverride {
    id: number;
    user_id: number;
    permission_key: string;
    permission_value: { view?: boolean; use?: boolean };
    notes?: string;
    created_by?: number;
    created_at: string;
    updated_at: string;
}

// ==================== Roles CRUD ====================

// List all roles
export async function listRoles(includeInactive = false): Promise<{ roles: Role[] }> {
    const qs = new URLSearchParams();
    if (includeInactive) qs.set('includeInactive', 'true');
    return apiFetch(`roles${qs.toString() ? `?${qs}` : ''}`);
}

// Get single role
export async function getRole(id: number): Promise<{ role: Role }> {
    return apiFetch(`roles/${id}`);
}

// Create new role
export async function createRole(payload: {
    code: string;
    name: string;
    description?: string;
    isActive?: boolean;
}): Promise<{ id: number; message: string }> {
    return apiFetch(`roles`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

// Update role
export async function updateRole(
    id: number,
    payload: Partial<{
        name: string;
        description?: string;
        isActive: boolean;
    }>,
): Promise<{ message: string }> {
    return apiFetch(`roles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
}

// Delete role
export async function deleteRole(id: number): Promise<{ message: string }> {
    return apiFetch(`roles/${id}`, {
        method: 'DELETE',
    });
}

// ==================== Role Permissions ====================

// Get role permissions
export async function getRolePermissionsById(roleId: number): Promise<{ permissions: any }> {
    return apiFetch(`roles/${roleId}/permissions`);
}

// Update role permissions
export async function updateRolePermissionsById(
    roleId: number,
    permissions: any,
): Promise<{ message: string }> {
    return apiFetch(`roles/${roleId}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions }),
    });
}

// ==================== User Permission Overrides ====================

// Get effective permissions for user (Role + Overrides merged)
export async function getUserEffectivePermissions(userId: number): Promise<{
    permissions: any;
    menu_order?: string[];
    roleCode: string | null;
}> {
    return apiFetch(`user_permissions/${userId}/effective`);
}

// Get user permission overrides only
export async function getUserPermissionOverrides(userId: number): Promise<{
    overrides: UserPermissionOverride[];
}> {
    return apiFetch(`user_permissions/${userId}/overrides`);
}

// Add/Update user permission override
export async function setUserPermissionOverride(
    userId: number,
    permissionKey: string,
    permissionValue: { view?: boolean; use?: boolean },
    notes?: string,
): Promise<{ message: string }> {
    return apiFetch(`user_permissions/${userId}/overrides`, {
        method: 'POST',
        body: JSON.stringify({
            permission_key: permissionKey,
            permission_value: permissionValue,
            notes,
        }),
    });
}

// Delete user permission override
export async function deleteUserPermissionOverride(
    userId: number,
    permissionKey: string,
): Promise<{ message: string }> {
    const qs = new URLSearchParams({ key: permissionKey });
    return apiFetch(`user_permissions/${userId}/overrides?${qs}`, {
        method: 'DELETE',
    });
}
