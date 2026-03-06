"use client";

import React, { useState, useRef, useEffect } from "react";
import type { User } from "firebase/auth";
import { updateProfile } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { saveProfilePhoto, getProfilePhotoUrl } from "@/lib/profile-photo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type EditProfileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  onPhotoSaved?: (photoUrl: string) => void;
};

export function EditProfileDialog({
  open,
  onOpenChange,
  user,
  onPhotoSaved,
}: EditProfileDialogProps) {
  const [displayName, setDisplayName] = useState(user.displayName || "");
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [customPhotoUrl, setCustomPhotoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!user.photoURL && user.uid) {
      getProfilePhotoUrl(user.uid, user.photoURL).then(setCustomPhotoUrl);
    } else {
      setCustomPhotoUrl(null);
    }
  }, [user.uid, user.photoURL]);

  useEffect(() => {
    if (open) {
      setDisplayName(user.displayName || "");
      setPhotoFile(null);
      setPhotoPreview(null);
    }
  }, [open, user.displayName]); // Reset when dialog opens; user.displayName only for initial sync

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const auth = getFirebaseAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setSaving(false);
        return;
      }

      const updates: { displayName?: string; photoURL?: string } = {};
      const newName = displayName.trim();
      if (newName !== (user.displayName || "")) {
        updates.displayName = newName || undefined;
      }

      if (photoFile) {
        try {
          const savedUrl = await saveProfilePhoto(currentUser.uid, photoFile);
          onPhotoSaved?.(savedUrl);
        } catch (uploadErr) {
          toast({
            title: "Photo upload failed",
            description: (uploadErr instanceof Error ? uploadErr.message : "Please try again."),
            variant: "destructive",
          });
        }
      }

      if (Object.keys(updates).length > 0) {
        await updateProfile(currentUser, updates);
      }

      onOpenChange(false); // Close first to avoid auth-state re-render conflicts
      toast({ title: "Profile updated", variant: "success" });
    } catch (err) {
      toast({
        title: "Failed to update profile",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const initials = (displayName || user.email?.split("@")[0] || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const currentPhoto = photoPreview || user.photoURL || customPhotoUrl || undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex flex-col items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative group"
            >
              <Avatar className="h-24 w-24 ring-2 ring-violet-500/30">
                <AvatarImage src={currentPhoto} alt="" />
                <AvatarFallback className="bg-violet-600/80 text-white text-2xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-8 w-8 text-white" />
              </div>
            </button>
            <p className="text-xs text-muted-foreground">
              Click to change profile picture
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
