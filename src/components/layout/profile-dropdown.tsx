"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getFirebaseAuth, getGoogleProvider } from "@/lib/firebase";
import { onAuthStateChanged, signOut, signInWithRedirect } from "firebase/auth";
import type { User } from "firebase/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, RefreshCw, Pencil, Users2 } from "lucide-react";
import { EditProfileDialog } from "./edit-profile-dialog";
import { getProfilePhotoUrl } from "@/lib/profile-photo";
import { electronNavigate } from "@/lib/electron-navigate";

export function ProfileDropdown() {
  const [user, setUser] = useState<User | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [customPhotoUrl, setCustomPhotoUrl] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setCustomPhotoUrl(null);
      return;
    }
    if (user.photoURL) {
      setCustomPhotoUrl(null);
      return;
    }
    getProfilePhotoUrl(user.uid, user.photoURL).then((url) =>
      setCustomPhotoUrl(url)
    );
  }, [user?.uid, user?.photoURL]);

  const clearTenancyStorage = async () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("erpSelection");
    localStorage.removeItem("activeTenant");
    localStorage.removeItem("tenantList");
    localStorage.removeItem("erpMode");
    localStorage.removeItem("pendingCompanyName");
    localStorage.removeItem("lastUserId");
    try {
      const { clearLocalDataForContextSwitch } = await import("@/lib/tenancy");
      await clearLocalDataForContextSwitch();
    } catch (e) {}
  };

  const handleSwitchAccount = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("companyUser_username");
      localStorage.removeItem("companyUser_role");
    }
    await clearTenancyStorage().catch(() => {});
    try {
      const m = await import("@/lib/database").catch(() => null);
      if (m?.clearAllLocalData) {
        await m.clearAllLocalData().catch(() => {});
      }
    } catch {}
    await signOut(getFirebaseAuth()).catch(() => {});
    if (typeof window !== "undefined") {
      window.location.href = "/intro";
    }
  };

  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("companyUser_username");
      localStorage.removeItem("companyUser_role");
    }
    await clearTenancyStorage().catch(() => {});
    try {
      const m = await import("@/lib/database").catch(() => null);
      if (m?.clearAllLocalData) {
        await m.clearAllLocalData().catch(() => {});
      }
    } catch {}
    await signOut(getFirebaseAuth()).catch(() => {});
    if (typeof window !== "undefined") {
      window.location.href = "/intro";
    }
  };

  const memberUsername = typeof window !== "undefined" ? localStorage.getItem("companyUser_username") : null;
  const memberRole = typeof window !== "undefined" ? localStorage.getItem("companyUser_role") : null;

  // Show dropdown if Firebase user is logged in OR if a company member is logged in via localStorage
  if (!user && !memberUsername) return null;

  const displayName = memberUsername || user?.displayName || (user?.email && !user.email.endsWith("@local.app") ? user.email.split("@")[0] : null) || "Logged-in User";
  const emailDisplay = memberRole ? `Role: ${memberRole.toUpperCase()}` : (user?.email && !user.email.endsWith("@local.app") ? user.email : "Active Account");
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 lg:h-9 lg:w-9 rounded-full p-0 text-white/90 hover:bg-white/15 hover:text-white border-0 focus:ring-0 focus:ring-offset-0"
          >
            <Avatar className="h-7 w-7 lg:h-8 lg:w-8 border-0 ring-0 shadow-none transition-all overflow-hidden">
              <AvatarImage src={user?.photoURL || customPhotoUrl || undefined} alt={displayName} />
              <AvatarFallback 
                className="bg-transparent text-xs font-black border-0"
                style={{ 
                  backgroundColor: "var(--profile-avatar-bg, var(--primary))", 
                  color: "var(--header-text-color, #020617)" 
                }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="min-w-56 rounded-lg border border-slate-200 bg-white text-slate-900 shadow-[0_18px_50px_rgba(0,0,0,0.15)]"
        >
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1">
              <p className="font-bold text-sm text-slate-900">{displayName}</p>
              <p className="text-xs text-slate-500 truncate max-w-[200px]">
                {emailDisplay}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-slate-100" />
          <DropdownMenuItem
            className="cursor-pointer focus:bg-slate-50 focus:text-slate-900"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="mr-2 h-4 w-4 text-slate-500" />
            Edit Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer focus:bg-slate-50 focus:text-slate-900"
            onClick={() => electronNavigate("/settings?tab=team", router, { method: "push" })}
          >
            <Users2 className="mr-2 h-4 w-4 text-slate-500" />
            Team
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer focus:bg-slate-50 focus:text-slate-900"
            onClick={handleSwitchAccount}
          >
            <RefreshCw className="mr-2 h-4 w-4 text-slate-500" />
            Switch Account
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-slate-100" />
          <DropdownMenuItem
            className="cursor-pointer focus:bg-red-50 text-red-600 focus:text-red-700"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4 text-red-500" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditProfileDialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open && user?.uid && !user.photoURL) {
            getProfilePhotoUrl(user.uid, user.photoURL).then(setCustomPhotoUrl);
          }
        }}
        onPhotoSaved={(url) => setCustomPhotoUrl(url)}
        user={user}
      />
    </>
  );
}
