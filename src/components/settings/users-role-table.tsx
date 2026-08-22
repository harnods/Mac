"use client";

import { useState, useTransition } from "react";
import { Crown, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RoleWithPermissions, UserWithRole } from "@/app/actions/permissions";
import {
  setUserRole,
  setUserAppAccess,
  revokeUserAccess,
  resetUserPassword,
} from "@/app/actions/permissions";
import { roleLabel, DEFAULT_CREW_PASSWORD } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";

type Props = {
  roles: RoleWithPermissions[];
  users: UserWithRole[];
  currentUserId: string;
};

export function UsersRoleTable({ roles, users: initialUsers, currentUserId }: Props) {
  const [users, setUsers] = useState<UserWithRole[]>(initialUsers);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Reset-password dialog state.
  const [resetTarget, setResetTarget] = useState<UserWithRole | null>(null);
  const [forceChange, setForceChange] = useState(true);
  const [resetDone, setResetDone] = useState(false);

  function openReset(user: UserWithRole) {
    setResetTarget(user);
    setForceChange(true);
    setResetDone(false);
  }

  function handleReset() {
    if (!resetTarget) return;
    const id = resetTarget.id;
    startTransition(async () => {
      const result = await resetUserPassword(id, forceChange);
      if (!result.ok) {
        setError(result.error);
        setResetTarget(null);
        return;
      }
      setResetDone(true);
    });
  }

  function patchUser(userId: string, patch: Partial<UserWithRole>) {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...patch } : u)));
  }

  function handleRoleChange(userId: string, newRole: string) {
    const prev = users.find((u) => u.id === userId)?.role;
    if (prev === newRole) return;
    patchUser(userId, { role: newRole });
    startTransition(async () => {
      const result = await setUserRole(userId, newRole);
      if (!result.ok) {
        setError(result.error);
        patchUser(userId, { role: prev });
      }
    });
  }

  function handleAccessChange(user: UserWithRole, next: { backoffice: boolean; crew: boolean }) {
    const before = { backoffice: user.access_backoffice, crew: user.access_crew };
    // Owner and self always keep back-office access (mirrors the server guard).
    if (user.is_owner || user.id === currentUserId) next.backoffice = true;
    patchUser(user.id, { access_backoffice: next.backoffice, access_crew: next.crew });
    startTransition(async () => {
      const result = await setUserAppAccess(user.id, next);
      if (!result.ok) {
        setError(result.error);
        patchUser(user.id, { access_backoffice: before.backoffice, access_crew: before.crew });
      }
    });
  }

  function handleRevoke(user: UserWithRole) {
    if (!confirm(`Revoke ${user.full_name || user.email}'s access? They will no longer be able to sign in. The employee record is kept.`)) {
      return;
    }
    startTransition(async () => {
      const result = await revokeUserAccess(user.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-destructive/10 text-destructive text-sm rounded-md px-4 py-2 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-xs underline ml-4">Dismiss</button>
        </div>
      )}

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-auto min-w-full text-sm whitespace-nowrap">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-2 font-medium w-[200px]">Name</th>
              <th className="text-left px-4 py-2 font-medium w-[190px]">Email</th>
              <th className="text-left px-4 py-2 font-medium w-[160px]">Last login</th>
              <th className="text-left px-4 py-2 font-medium w-[200px]">App access</th>
              <th className="text-left px-4 py-2 font-medium w-[150px]">Role</th>
              <th className="text-right px-4 py-2 font-medium w-[130px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((user) => {
              const lockBackoffice = user.is_owner || user.id === currentUserId;
              return (
                <tr key={user.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span>{user.full_name ?? "—"}</span>
                      {user.is_owner && (
                        <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                          <Crown className="size-3" />
                          Account owner
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : "Never"}
                  </td>

                  {/* App access */}
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={user.access_backoffice}
                          disabled={isPending || lockBackoffice}
                          onChange={(e) => handleAccessChange(user, { backoffice: e.target.checked, crew: user.access_crew })}
                        />
                        <span>Backoffice</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={user.access_crew}
                          disabled={isPending}
                          onChange={(e) => handleAccessChange(user, { backoffice: user.access_backoffice, crew: e.target.checked })}
                        />
                        <span>Crew app</span>
                      </label>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-4 py-2">
                    {user.is_owner ? (
                      <span className="text-sm text-muted-foreground px-2 py-1 inline-block">{roleLabel(user.role)}</span>
                    ) : (
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        disabled={isPending}
                        className="border rounded px-2 py-1 text-sm bg-background w-full"
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.name}>{roleLabel(r.name)}</option>
                        ))}
                      </select>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!user.is_owner && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openReset(user)}
                          disabled={isPending}
                        >
                          <KeyRound className="size-3.5" />
                          Reset password
                        </Button>
                      )}
                      {!user.is_owner && user.id !== currentUserId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevoke(user)}
                          disabled={isPending}
                          className="text-destructive hover:text-destructive"
                        >
                          Revoke access
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog
        open={resetTarget !== null}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null);
        }}
      >
        <DialogContent>
          {resetDone ? (
            <>
              <DialogHeader>
                <DialogTitle>Password direset</DialogTitle>
                <DialogDescription>
                  Password {resetTarget?.full_name || resetTarget?.email} sekarang{" "}
                  <span className="font-mono font-medium text-foreground">
                    {DEFAULT_CREW_PASSWORD}
                  </span>
                  .
                  {forceChange
                    ? " Mereka akan diminta membuat password baru saat login berikutnya."
                    : " Mereka bisa langsung login dengan password ini."}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => setResetTarget(null)}>Selesai</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Reset password</DialogTitle>
                <DialogDescription>
                  Password {resetTarget?.full_name || resetTarget?.email} akan
                  direset ke{" "}
                  <span className="font-mono font-medium text-foreground">
                    {DEFAULT_CREW_PASSWORD}
                  </span>
                  .
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">
                    Minta ganti password saat login
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {forceChange
                      ? "Crew wajib membuat password sendiri saat login berikutnya."
                      : `Crew tetap login dengan ${DEFAULT_CREW_PASSWORD} sampai mereka menggantinya sendiri.`}
                  </div>
                </div>
                <Switch
                  checked={forceChange}
                  onCheckedChange={setForceChange}
                  disabled={isPending}
                />
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setResetTarget(null)}
                  disabled={isPending}
                >
                  Batal
                </Button>
                <Button onClick={handleReset} disabled={isPending}>
                  {isPending ? "Mereset…" : "Reset password"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
