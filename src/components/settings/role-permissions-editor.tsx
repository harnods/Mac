"use client";

import { useState, useTransition } from "react";
import { Trash2, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RoleWithPermissions } from "@/app/actions/permissions";
import type { PERMISSION_MODULES, PERMISSION_LABELS, PermissionKey } from "@/lib/permissions";
import { isSuperRole, roleLabel } from "@/lib/permissions";
import {
  setRolePermissions,
  createRole,
  deleteRole,
} from "@/app/actions/permissions";

type PermissionModules = typeof PERMISSION_MODULES;
type PermissionLabelsType = typeof PERMISSION_LABELS;

type User = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_owner: boolean;
};

type Props = {
  roles: RoleWithPermissions[];
  users: User[];
  permissionModules: PermissionModules;
  permissionLabels: PermissionLabelsType;
};

export function RolePermissionsEditor({ roles: initialRoles, users: initialUsers, permissionModules, permissionLabels }: Props) {
  const [roles, setRoles] = useState<RoleWithPermissions[]>(initialRoles);
  const users = initialUsers;
  const [selectedRoleId, setSelectedRoleId] = useState<string>(initialRoles[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [showNewRole, setShowNewRole] = useState(false);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  const usersWithRole = (roleId: string) => {
    const role = roles.find((r) => r.id === roleId);
    if (!role) return 0;
    return users.filter((u) => u.role === role.name).length;
  };

  const selectedRoleLocked = isSuperRole(selectedRole?.name);

  function handlePermissionToggle(key: PermissionKey) {
    if (!selectedRole || selectedRoleLocked) return;
    const current = selectedRole.permission_keys;
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];

    // Optimistic update
    setRoles((prev) =>
      prev.map((r) => r.id === selectedRoleId ? { ...r, permission_keys: next } : r)
    );

    startTransition(async () => {
      const result = await setRolePermissions(selectedRoleId, next);
      if (!result.ok) {
        setError(result.error);
        // Revert on error
        setRoles((prev) =>
          prev.map((r) => r.id === selectedRoleId ? { ...r, permission_keys: current } : r)
        );
      }
    });
  }

  function handleCreateRole() {
    if (!newRoleName.trim()) return;
    startTransition(async () => {
      const result = await createRole({ name: newRoleName.trim() });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNewRoleName("");
      setShowNewRole(false);
      // Refresh from server via re-render
      window.location.reload();
    });
  }

  function handleDeleteRole(id: string) {
    if (!confirm("Delete this role? This cannot be undone.")) return;
    startTransition(async () => {
      const result = await deleteRole(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRoles((prev) => prev.filter((r) => r.id !== id));
      if (selectedRoleId === id) {
        setSelectedRoleId(roles.find((r) => r.id !== id)?.id ?? "");
      }
    });
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-destructive/10 text-destructive text-sm rounded-md px-4 py-2 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-xs underline ml-4">Dismiss</button>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <div className="flex divide-x min-h-[400px]">
          {/* Left: role list */}
          <div className="w-56 shrink-0 flex flex-col">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <span className="text-sm font-medium">Roles</span>
              <button
                onClick={() => setShowNewRole(true)}
                className="text-muted-foreground hover:text-foreground"
                title="New role"
              >
                <Plus className="size-4" />
              </button>
            </div>

            {showNewRole && (
              <div className="px-3 py-2 border-b bg-muted/40 flex gap-2">
                <input
                  autoFocus
                  className="flex-1 text-sm border rounded px-2 py-1 bg-background min-w-0"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateRole();
                    if (e.key === "Escape") setShowNewRole(false);
                  }}
                />
                <Button size="sm" variant="default" onClick={handleCreateRole} disabled={isPending}>
                  Add
                </Button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRoleId(role.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 flex items-center justify-between gap-2 hover:bg-accent/50 transition-colors text-sm",
                    selectedRoleId === role.id && "bg-accent"
                  )}
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{roleLabel(role.name)}</div>
                    <div className="text-xs text-muted-foreground">
                      {usersWithRole(role.id)} user{usersWithRole(role.id) !== 1 ? "s" : ""}
                    </div>
                  </div>
                  {!role.is_system && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteRole(role.id); }}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      title="Delete role"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Right: permission matrix */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {selectedRole ? (
              <>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">{roleLabel(selectedRole.name)}</h2>
                  {selectedRole.is_system && (
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                      <ShieldCheck className="size-3" />
                      System role
                    </span>
                  )}
                  {selectedRole.description && (
                    <span className="text-sm text-muted-foreground">— {selectedRole.description}</span>
                  )}
                </div>

                {selectedRoleLocked && (
                  <div className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                    The admin role always has full access. Its permissions can&apos;t be changed.
                  </div>
                )}

                {permissionModules.map((mod) => (
                  <div key={mod.module} className="space-y-1">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {mod.label}
                    </div>
                    <div className="space-y-1">
                      {mod.keys.map((key) => {
                        const checked = selectedRole.permission_keys.includes(key);
                        return (
                          <label
                            key={key}
                            className={cn(
                              "flex items-center gap-3 rounded-md px-3 py-2",
                              selectedRoleLocked ? "cursor-default" : "hover:bg-accent/50 cursor-pointer",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={selectedRoleLocked ? true : checked}
                              onChange={() => handlePermissionToggle(key as PermissionKey)}
                              disabled={isPending || selectedRoleLocked}
                              className="rounded"
                            />
                            <span className="text-sm">{permissionLabels[key as PermissionKey]}</span>
                            <span className="text-xs text-muted-foreground font-mono ml-auto">{key}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Select a role to edit permissions.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
