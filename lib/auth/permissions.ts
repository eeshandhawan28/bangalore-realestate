import type { OrgRole } from "./middleware";

// Wildcard '*' means all permissions
const ROLE_PERMISSIONS: Record<OrgRole, string[]> = {
  owner: ["*"],
  manager: [
    "projects:read", "projects:create", "projects:update", "projects:delete",
    "tasks:read", "tasks:create", "tasks:update", "tasks:delete",
    "contacts:read", "contacts:create", "contacts:update", "contacts:delete",
    "deals:read", "deals:create", "deals:update", "deals:delete",
    "documents:read", "documents:upload", "documents:update", "documents:delete",
    "templates:read", "templates:create", "templates:update",
    "budget:read", "budget:create", "budget:approve",
    "workflows:read", "workflows:create", "workflows:update",
    "members:invite", "members:read",
    "settings:read",
  ],
  field_worker: [
    "projects:read",
    "tasks:read", "tasks:update_own",
    "contacts:read",
    "documents:read", "documents:upload",
    "budget:read",
  ],
  contractor: [
    "projects:read_assigned",
    "tasks:read_assigned", "tasks:update_own",
    "documents:read_assigned", "documents:upload",
  ],
  investor: [
    "projects:read",
    "budget:read",
    "deals:read",
    "documents:read",
  ],
};

/**
 * Check if a role has a specific permission.
 * Supports exact match and wildcard prefix (e.g. "projects:*" matches "projects:read").
 */
export function hasPermission(role: OrgRole, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role] ?? [];
  if (perms.includes("*")) return true;

  // Exact match
  if (perms.includes(permission)) return true;

  // Wildcard prefix: "projects:*" grants any "projects:X"
  const [resource] = permission.split(":");
  return perms.includes(`${resource}:*`);
}

/**
 * Returns true if role can perform any action on a resource.
 */
export function canAccessResource(role: OrgRole, resource: string): boolean {
  const perms = ROLE_PERMISSIONS[role] ?? [];
  if (perms.includes("*")) return true;
  return perms.some((p) => p.startsWith(`${resource}:`));
}

/**
 * Throws an error string if the role doesn't have the required permission.
 * Use at the top of API route handlers.
 */
export function assertPermission(role: OrgRole, permission: string): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`FORBIDDEN: Role '${role}' cannot perform '${permission}'`);
  }
}

export { ROLE_PERMISSIONS };
