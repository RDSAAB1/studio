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

  const handleSwitchAccount = async () => {
    try {
      await signOut(getFirebaseAuth());
      const auth = getFirebaseAuth();
      const provider = getGoogleProvider();
      await signInWithRedirect(auth, provider);
    } catch {
      router.push("/login");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(getFirebaseAuth());
      router.push("/intro");
    } catch {
      router.push("/intro");
    }
  };

  if (!user) return null;

  const displayName = user.displayName || user.email?.split("@")[0] || "User";
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
            className="h-9 w-9 rounded-full p-0 text-white/90 hover:bg-white/10 hover:text-white border-0 focus:ring-0 focus:ring-offset-0"
          >
            <Avatar className="h-8 w-8 ring-2 ring-white/20">
              <AvatarImage src={user.photoURL || customPhotoUrl || undefined} alt={displayName} />
              <AvatarFallback className="bg-violet-600/80 text-white text-xs font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="min-w-56 rounded-lg border border-violet-900/30 bg-violet-950/95 text-white shadow-[0_18px_50px_rgba(2,6,23,0.35)] backdrop-blur-[20px]"
        >
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-sm">{displayName}</p>
              <p className="text-xs text-white/70 truncate max-w-[200px]">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem
            className="cursor-pointer focus:bg-white/10"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer focus:bg-white/10"
            onClick={() => router.push("/sales?menu=settings&tab=settings-team")}
          >
            <Users2 className="mr-2 h-4 w-4" />
            Team
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer focus:bg-white/10"
            onClick={handleSwitchAccount}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Switch Account
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem
            className="cursor-pointer focus:bg-red-500/20 text-red-200"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
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
