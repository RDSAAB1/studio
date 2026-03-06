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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { useErpSelection } from "@/contexts/erp-selection-context";
import { useToast } from "@/hooks/use-toast";
import { getFirebaseAuth } from "@/lib/firebase";
import { Loader2, Users2, KeyRound, Copy, Check, Pencil } from "lucide-react";

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
        const data = await res.json().catch(() => ({}));
        toast({ title: "Failed to load users", description: data.error, variant: "destructive" });
        setUsers([]);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      toast({ title: "Failed to load users", variant: "destructive" });
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers, refreshTrigger]);

  const handleResetPassword = async (userKey: string) => {
    if (!companyId || !userKey) return;
    setResetting(userKey);
    try {
      const auth = getFirebaseAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        toast({ title: "Please login again", variant: "destructive" });
        setResetting(null);
        return;
      }
      const res = await fetch("/api/company-users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userKey, companyId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Reset failed", description: data.error, variant: "destructive" });
        setResetting(null);
        return;
      }
      setResetResult({ username: data.username || "", password: data.password || "" });
      toast({ title: "Password reset", description: "Share the new password with the user.", variant: "success" });
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

  if (!companyId) return null;

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
                          onClick={() => handleResetPassword(u.id)}
                          disabled={!!resetting}
                        >
                          {resetting === u.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <KeyRound className="h-4 w-4 mr-1" />
                          )}
                          Reset Password
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
                <div className="flex gap-3">
                  {ROLES.map((r) => (
                    <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="edit-role"
                        value={r.value}
                        checked={editRole === r.value}
                        onChange={() => setEditRole(r.value)}
                        disabled={savingAccess}
                        className="rounded-full"
                      />
                      <span className="text-sm">{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="flex flex-wrap gap-3">
                  {PERMISSIONS.map((p) => (
                    <label key={p.value} className={`flex items-center gap-2 cursor-pointer ${p.value === "all" ? "font-medium" : ""}`}>
                      <input
                        type="checkbox"
                        checked={p.value === "all" ? editPermissions.includes("all") : (editPermissions.includes("all") || editPermissions.includes(p.value))}
                        onChange={() => toggleEditPermission(p.value)}
                        disabled={savingAccess}
                        className="rounded"
                      />
                      <span className="text-sm">{p.label}</span>
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
