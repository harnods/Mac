import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { getRolesWithPermissions, getUsersWithRoles } from "@/app/actions/permissions";
import { UsersRoleTable } from "@/components/settings/users-role-table";
import { SettingsRolesTabs } from "@/components/settings/settings-roles-tabs";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const profile = await getCurrentProfile();

  if (!can(profile, P.SETTINGS_ROLES)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Roles &amp; permissions</h1>
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
          Access denied. You do not have permission to manage roles.
        </div>
      </div>
    );
  }

  const [roles, users] = await Promise.all([
    getRolesWithPermissions(),
    getUsersWithRoles(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Roles &amp; permissions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Assign a role to each user. Changes take effect on the user&apos;s next action.
        </p>
      </div>
      <SettingsRolesTabs />
      <UsersRoleTable roles={roles} users={users} currentUserId={profile!.id} />
    </div>
  );
}
