"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useErpSelection } from "@/contexts/erp-selection-context";
import { useToast } from "@/hooks/use-toast";
import { getFirebaseAuth } from "@/lib/firebase";
import { Loader2, Users2, KeyRound, Copy, Check, Pencil, Trash2 } from "lucide-react";

const ROLES = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
  { value: "owner", label: "Owner" },
] as const;

const MODULE_PERMISSIONS = ["sales", "inventory", "reports", "settings", "projects"] as const;

const PERMISSIONS = [
  { value: "all", label: "Full Access (sabhi collections — read + write)" },
  { value: "sales", label: "Sales" },
  { value: "inventory", label: "Inventory" },
  { value: "reports", label: "Reports" },
  { value: "settings", label: "Settings" },
  { value: "projects", label: "Projects" },
] as const;

type CompanyUser = {
  id: string;
  username: string;
  role: string;
  permissions: string[];
  isAdmin: boolean;
  isOwner: boolean;
  createdAt: string | null;
};

type CompanyUserListProps = {
  refreshTrigger?: number;
};

export function CompanyUserList({ refreshTrigger = 0 }: CompanyUserListProps) {
  const { selection } = useErpSelection();
  const { toast } = useToast();
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ username: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [editingUser, setEditingUser] = useState<CompanyUser | null>(null);
  const [editRole, setEditRole] = useState<"member" | "admin" | "owner">("member");
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [savingAccess, setSavingAccess] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<CompanyUser | null>(null);
  const [deleteTargetUser, setDeleteTargetUser] = useState<CompanyUser | null>(null);
  const [customNewPassword, setCustomNewPassword] = useState("");

  const companyId = selection?.companyId;

  const toggleEditPermission = (perm: string) => {
    if (perm === "all") {
      setEditPermissions((p) => (p.includes("all") ? [] : ["all"]));
      return;
    }
    setEditPermissions((p) => {
      if (p.includes("all")) {
        return MODULE_PERMISSIONS.filter((m) => m !== perm);
      }
      const next = p.includes(perm) ? p.filter((x) => x !== perm) : [...p, perm];
      return next.length === MODULE_PERMISSIONS.length ? ["all"] : next;
    });
  };

  const openEditAccess = (u: CompanyUser) => {
    setEditingUser(u);
    setEditRole((u.role as "member" | "admin" | "owner") || "member");
    setEditPermissions(u.permissions?.length ? [...u.permissions] : []);
  };

  const handleSaveAccess = async () => {
    if (!companyId || !editingUser) return;
    setSavingAccess(true);
    try {
      const auth = getFirebaseAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        toast({ title: "Please login again", variant: "destructive" });
        setSavingAccess(false);
        return;
      }
      const res = await fetch("/api/company-users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          companyId,
          userKey: editingUser.id,
          role: editRole,
          permissions: editPermissions,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Update failed", description: data.error, variant: "destructive" });
        setSavingAccess(false);
        return;
      }
      toast({ title: "Access updated", description: `${editingUser.username} ka access update ho gaya.`, variant: "success" });
      setEditingUser(null);
      void fetchUsers();
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    } finally {
      setSavingAccess(false);
    }
  };

  const fetchUsers = useCallback(async () => {
    if (!companyId) {
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setUsers([]);
        setLoading(false);
        return;
      }
      const res = await fetch(`/api/company-users/list?companyId=${encodeURIComponent(companyId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setUsers([]);
        setLoading(false);
        return;
      }
      const data = await res.json();
      let fetchedUsers: CompanyUser[] = data.users || [];
      const storedRole = typeof window !== "undefined" ? localStorage.getItem("companyUser_role") : null;
      const storedUsername = typeof window !== "undefined" ? localStorage.getItem("companyUser_username") : null;
      if (storedRole === "member" && storedUsername) {
        fetchedUsers = fetchedUsers.filter(u => u.username.toLowerCase() === storedUsername.toLowerCase());
      }
      setUsers(fetchedUsers);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers, refreshTrigger]);

  const handleOpenResetModal = (u: CompanyUser) => {
    setResetTargetUser(u);
    setCustomNewPassword("");
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !resetTargetUser) return;
    if (customNewPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setResetting(resetTargetUser.id);
    try {
      const auth = getFirebaseAuth();
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/company-users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userKey: resetTargetUser.id, companyId, newPassword: customNewPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Reset failed", description: data.error, variant: "destructive" });
        setResetting(null);
        return;
      }
      setResetResult({ username: data.username || resetTargetUser.username, password: data.password || customNewPassword });
      setResetTargetUser(null);
      setCustomNewPassword("");
      toast({ title: "Password updated 🎉", description: "New password has been set successfully.", variant: "success" });
    } catch {
      toast({ title: "Reset failed", variant: "destructive" });
    } finally {
      setResetting(null);
    }
  };

  const copyResetDetails = () => {
    if (!resetResult) return;
    const text = `Username: ${resetResult.username}\nPassword: ${resetResult.password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const confirmDeleteUser = async () => {
    if (!companyId || !deleteTargetUser) return;

    const userKey = deleteTargetUser.id;
    const username = deleteTargetUser.username;
    setResetting(userKey);
    try {
      const auth = getFirebaseAuth();
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/company-users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userKey, companyId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Delete failed", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "User deleted 🗑️", description: `User '${username}' remove ho gaya.`, variant: "success" });
      setDeleteTargetUser(null);
      fetchUsers();
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    } finally {
      setResetting(null);
    }
  };

  if (!companyId) return null;

  const currentRole = typeof window !== "undefined" ? localStorage.getItem("companyUser_role") : null;
  const isCurrentMember = currentRole === "member";

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users2 className="h-5 w-5" />
            Team Users
          </CardTitle>
          <CardDescription>
            List of company users. Edit Access to change role/permissions. Reset Password to generate a new one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No users yet. Add one above.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.username}</TableCell>
                    <TableCell>
                      <span className="capitalize">{u.role}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {u.permissions.includes("all") ? "Full Access (sabhi collections)" : (u.permissions.length ? u.permissions.join(", ") : "—")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {isCurrentMember ? (
                        <span className="text-xs text-muted-foreground italic">No actions allowed</span>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditAccess(u)}
                            disabled={!!u.isOwner}
                            title={u.isOwner ? "Owner ka access edit nahi kar sakte" : "Edit Access"}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit Access
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenResetModal(u)}
                            disabled={!!resetting}
                          >
                            {resetting === u.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <KeyRound className="h-4 w-4 mr-1" />
                            )}
                            Reset Password
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteTargetUser(u)}
                            disabled={!!u.isOwner || !!resetting}
                            title={u.isOwner ? "Owner account delete nahi kar sakte" : "Delete User"}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete User Confirmation Modal */}
      <AlertDialog open={!!deleteTargetUser} onOpenChange={(open) => !open && setDeleteTargetUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User "{deleteTargetUser?.username}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone and will revoke all company access for this user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!resetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDeleteUser}
              disabled={!!resetting}
            >
              {resetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal to input Custom New Password */}
      <Dialog open={!!resetTargetUser} onOpenChange={(open) => !open && setResetTargetUser(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleResetPasswordSubmit}>
            <DialogHeader>
              <DialogTitle>Set New Password — {resetTargetUser?.username}</DialogTitle>
              <DialogDescription>
                Enter a new custom password for this user (minimum 6 characters).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-custom-pass">New Password</Label>
                <Input
                  id="new-custom-pass"
                  type="password"
                  value={customNewPassword}
                  onChange={(e) => setCustomNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 chars)"
                  minLength={6}
                  required
                  disabled={!!resetting}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetTargetUser(null)} disabled={!!resetting}>
                Cancel
              </Button>
              <Button type="submit" disabled={!!resetting}>
                {resetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save New Password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetResult} onOpenChange={(open) => !open && setResetResult(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Password Generated</DialogTitle>
            <DialogDescription>
              Share these credentials with the user. They must use this new password to login.
            </DialogDescription>
          </DialogHeader>
          {resetResult && (
            <div className="space-y-4 rounded-lg border-2 border-green-200 dark:border-green-800 bg-white dark:bg-zinc-900 p-4 shadow-inner">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Username</p>
                <p className="text-xl font-mono font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-4 py-3 rounded border-2 border-zinc-300 dark:border-zinc-600 tracking-wide">
                  {resetResult.username}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">New Password (share with user – save for records)</p>
                <p className="text-xl font-mono font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-4 py-3 rounded border-2 border-zinc-300 dark:border-zinc-600 tracking-wide select-all">
                  {resetResult.password}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={copyResetDetails} className="w-full">
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                Copy
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setResetResult(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Access — {editingUser?.username}</DialogTitle>
            <DialogDescription>
              Role aur permissions change karo. Full Access = sabhi collections read + write.
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Role</Label>
                <div className="flex gap-4 items-center">
                  {ROLES.map((r) => (
                    <label key={r.value} className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="radio"
                        name="edit-user-role-dialog"
                        value={r.value}
                        checked={editRole === r.value}
                        onChange={() => setEditRole(r.value as any)}
                        disabled={savingAccess}
                        className="h-4 w-4 shrink-0 accent-primary cursor-pointer"
                      />
                      <span className="text-sm font-medium">{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="flex flex-wrap gap-4 items-center">
                  {PERMISSIONS.map((p) => (
                    <label key={p.value} className={`flex items-center gap-2 cursor-pointer select-none ${p.value === "all" ? "font-medium" : ""}`}>
                      <input
                        type="checkbox"
                        checked={editPermissions.includes(p.value)}
                        onChange={() => toggleEditPermission(p.value)}
                        disabled={savingAccess}
                        className="h-4 w-4 shrink-0 accent-primary rounded cursor-pointer"
                      />
                      <span className="text-sm font-medium">{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)} disabled={savingAccess}>
              Cancel
            </Button>
            <Button onClick={handleSaveAccess} disabled={savingAccess}>
              {savingAccess ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
