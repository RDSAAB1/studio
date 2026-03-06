"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useErpSelection } from "@/contexts/erp-selection-context";
import { useToast } from "@/hooks/use-toast";
import { getFirebaseAuth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getCompanyMemberRole } from "@/lib/tenancy";
import { Loader2, UserPlus, Copy, Check, Info } from "lucide-react";
import { CompanyUserList } from "./company-user-list";
import { ChangePasswordCard } from "./change-password-card";

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

type CreatedUser = {
  userId: string;
  username: string;
  password: string;
};

export function AddCompanyUserCard() {
  const { selection } = useErpSelection();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"member" | "admin" | "owner">("member");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [createdUser, setCreatedUser] = useState<CreatedUser | null>(null);
  const [copied, setCopied] = useState(false);
  const [listRefresh, setListRefresh] = useState(0);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [isCompanyUser, setIsCompanyUser] = useState(false);

  const companyId = selection?.companyId;

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setIsCompanyUser(!!u?.uid?.startsWith("cu_"));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!companyId) {
      setUserRole(null);
      setRoleLoading(false);
      return;
    }
    setRoleLoading(true);
    getCompanyMemberRole(companyId)
      .then((r) => setUserRole(r || null))
      .catch(() => setUserRole(null))
      .finally(() => setRoleLoading(false));
  }, [companyId]);

  const togglePermission = (perm: string) => {
    if (perm === "all") {
      setPermissions((p) => (p.includes("all") ? [] : ["all"]));
      return;
    }
    setPermissions((p) => {
      if (p.includes("all")) {
        return MODULE_PERMISSIONS.filter((m) => m !== perm);
      }
      const next = p.includes(perm) ? p.filter((x) => x !== perm) : [...p, perm];
      return next.length === MODULE_PERMISSIONS.length ? ["all"] : next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !username.trim() || !password) {
      toast({ title: "Fill username and password", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setLoading(true);
    setCreatedUser(null);
    try {
      const auth = getFirebaseAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        toast({ title: "Please login again", variant: "destructive" });
        setLoading(false);
        return;
      }
      const res = await fetch("/api/company-users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          companyId,
          username: username.trim(),
          password,
          role,
          permissions,
        }),
      });
      let data: {
        error?: string;
        userId?: string;
        username?: string;
        password?: string;
      } = {};
      try {
        data = await res.json();
      } catch {
        toast({
          title: "Request failed",
          description: res.status === 500 ? "Firebase Admin may not be configured. Add FIREBASE_ADMIN_* to .env.local" : `Server error (${res.status})`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      if (!res.ok) {
        toast({
          title: "Failed to create user",
          description: data.error || `Error ${res.status}`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      setCreatedUser({
        userId: data.userId || "",
        username: data.username || username.trim(),
        password: data.password || password,
      });
      setUsername("");
      setPassword("");
      setPermissions([]);
      setListRefresh((r) => r + 1);
      toast({
        title: "User created successfully",
        description: "Credentials saved in companyUsers. Check the popup for username and password.",
        variant: "success",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network or unexpected error";
      toast({
        title: "Failed to create user",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyDetails = () => {
    if (!createdUser) return;
    const lines = [
      `User ID: ${createdUser.userId}`,
      `Username: ${createdUser.username}`,
      `Password: ${createdUser.password}`,
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  if (!companyId) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add Company User
            </CardTitle>
            <CardDescription>
              Select a company first (from the header dropdown) to add users.
            </CardDescription>
          </CardHeader>
        </Card>
        <ChangePasswordCard isCompanyUser={isCompanyUser} />
      </div>
    );
  }

  if (roleLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (userRole === "member") {
    return (
      <div className="space-y-6">
        <Card className="access-restricted-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-semibold text-primary">
              <Info className="h-5 w-5 text-primary" />
              Access Restricted
            </CardTitle>
            <p className="text-primary/90 dark:text-primary text-base leading-relaxed mt-2">
              You are a member. Only owner and admin can create users and view the user list. Contact your company owner or admin if you need these permissions.
            </p>
          </CardHeader>
        </Card>
        <ChangePasswordCard isCompanyUser={isCompanyUser} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Add Company User
        </CardTitle>
        <CardDescription>
          Create username and password. User logs in with Username + Password only (no email, no company code).
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="add-user-username">Username</Label>
            <Input
              id="add-user-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. rahul, sales1"
              minLength={2}
              required
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">No @ or email needed. Letters and numbers only.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-user-password">Password</Label>
            <Input
              id="add-user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              minLength={6}
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <div className="flex gap-3">
              {ROLES.map((r) => (
                <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={role === r.value}
                    onChange={() => setRole(r.value)}
                    disabled={loading}
                    className="rounded-full"
                  />
                  <span className="text-sm">{r.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Permissions</Label>
            <p className="text-xs text-muted-foreground">Full Access = member pura data dekh, read aur write kar sakta hai. Warna sirf selected modules.</p>
            <div className="flex flex-wrap gap-3">
              {PERMISSIONS.map((p) => (
                <label key={p.value} className={`flex items-center gap-2 cursor-pointer ${p.value === "all" ? "font-medium" : ""}`}>
                  <input
                    type="checkbox"
                    checked={p.value === "all" ? permissions.includes("all") : (permissions.includes("all") || permissions.includes(p.value))}
                    onChange={() => togglePermission(p.value)}
                    disabled={loading}
                    className="rounded"
                  />
                  <span className="text-sm">{p.label}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create User
          </Button>
        </CardFooter>
      </form>

      <Dialog open={!!createdUser} onOpenChange={(open) => !open && setCreatedUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-green-600 dark:text-green-500">User Created Successfully</DialogTitle>
            <DialogDescription>
              Share these credentials with the user. They login at Intro → Company User Login with Username + Password only.
            </DialogDescription>
          </DialogHeader>
          {createdUser && (
            <div className="space-y-4 rounded-lg border-2 border-green-200 dark:border-green-800 bg-white dark:bg-zinc-900 p-4 shadow-inner">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Username</p>
                <p className="text-xl font-mono font-bold break-all text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-4 py-3 rounded border-2 border-zinc-300 dark:border-zinc-600 tracking-wide">
                  {createdUser.username}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Password (save & share with user – won&apos;t be shown again)</p>
                <p className="text-xl font-mono font-bold break-all text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-4 py-3 rounded border-2 border-zinc-300 dark:border-zinc-600 tracking-wide select-all">
                  {createdUser.password}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={copyDetails} className="w-full">
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                Copy all details
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCreatedUser(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Card>
    <CompanyUserList refreshTrigger={listRefresh} />
    <ChangePasswordCard isCompanyUser={isCompanyUser} />
    </div>
  );
}
