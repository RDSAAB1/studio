"use client";

import React, { useState } from "react";
import Link from "next/link";
import { navigateTo } from "@/lib/electron-navigate";
import { useRouter } from "next/navigation";
import {
  getFirebaseAuth,
  createUserWithEmailAndPassword,
} from "@/lib/firebase";
import {
  setLocalFolderPath,
  loadFromFolderToDexie,
  initFolderWatcher,
  createCompanyStructure,
} from "@/lib/local-folder-storage";
import {
  setErpMode,
  setErpSelectionStorage,
  setActiveTenant,
  setCachedTenants,
} from "@/lib/tenancy";
import { clearLocalDataForContextSwitch } from "@/lib/tenancy";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2,
  FolderOpen,
  Mail,
  Lock,
  Layers,
  FileText,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const createCompanySchema = z.object({
  email: z.string().email("Valid email dalo"),
  password: z.string().min(6, "Password min 6 characters"),
  companyName: z.string().min(2, "Company name required"),
  subCompanyName: z.string().min(1, "Sub company name required"),
  seasonName: z.string().min(1, "Season name required"),
});

type CreateCompanyFormValues = z.infer<typeof createCompanySchema>;

const darkBg =
  "radial-gradient(ellipse 80% 50% at 20% 40%, rgba(67, 56, 202, 0.25) 0%, transparent 50%), radial-gradient(ellipse 60% 80% at 80% 60%, rgba(139, 92, 246, 0.2) 0%, transparent 50%), radial-gradient(ellipse 50% 50% at 50% 50%, rgba(99, 102, 241, 0.12) 0%, transparent 70%), linear-gradient(180deg, #0f172a 0%, #1e1b4b 40%, #0f172a 100%)";

export default function CreateCompanyPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [folderPath, setFolderPath] = useState<string | null>(null);

  const form = useForm<CreateCompanyFormValues>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: {
      email: "",
      password: "",
      companyName: "",
      subCompanyName: "Main Branch",
      seasonName: `${new Date().getFullYear()} A`,
    },
  });

  const handleSelectFolder = async () => {
    const electron = typeof window !== "undefined"
      ? (window as unknown as { electron?: { selectFolder: () => Promise<string | null> } }).electron
      : undefined;
    if (!electron?.selectFolder) {
      toast({
        title: "Electron required",
        description: "Local folder mode works only in Electron. Run: npm run electron:dev",
        variant: "destructive",
      });
      return;
    }
    const path = await electron.selectFolder();
    if (path) setFolderPath(path);
  };

  const onSubmit = async (data: CreateCompanyFormValues) => {
    if (!folderPath) {
      toast({
        title: "Folder select karein",
        description: "Pehle data folder select karo.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      const userCred = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const userId = userCred.user?.uid;
      if (!userId) throw new Error("User created but no UID");

      const res = await createCompanyStructure(
        folderPath,
        data.companyName.trim(),
        data.subCompanyName.trim(),
        data.seasonName.trim()
      );
      if (!res.success) throw new Error(res.error);

      setLocalFolderPath(folderPath);
      if (typeof window !== "undefined") {
        localStorage.setItem("bizsuite:localUseHierarchical", "1");
      }

      const loadRes = await loadFromFolderToDexie(folderPath);
      if (!loadRes.success) {
        toast({
          title: "Data load warning",
          description: loadRes.error || "Folder structure created, data load failed.",
          variant: "default",
        });
      }
      initFolderWatcher();

      const { getLocalErpSelection } = await import("@/lib/local-mode-structure");
      const selection = getLocalErpSelection() ?? {
        companyId: "company",
        subCompanyId: "main",
        seasonKey: "default",
      };

      setErpMode(true);
      setErpSelectionStorage(selection);
      setActiveTenant({ id: "root", storageMode: "root" });
      setCachedTenants([]);
      await clearLocalDataForContextSwitch();

      toast({
        title: "Company Created",
        description: "Aapki company aur account ready hai. Dashboard par redirect ho rahe hain.",
        variant: "success",
      });

      if (typeof window !== "undefined") {
        navigateTo("/");
      }
    } catch (error: unknown) {
      const err = error as { code?: string };
      let msg = "An unexpected error occurred.";
      if (err.code === "auth/email-already-in-use") msg = "Ye email pehle se registered hai.";
      toast({ title: "Failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "h-12 rounded-xl border border-white/15 bg-white/[0.07] text-white placeholder:text-slate-500 focus:border-violet-400/80 focus:ring-2 focus:ring-violet-500/25 focus:outline-none transition-all duration-300";

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center p-6 relative"
      style={{ background: darkBg }}
    >
      <div className="w-full max-w-md">
        <Link
          href="/intro"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-violet-400 text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div
          className="p-8 rounded-3xl backdrop-blur-2xl border border-white/[0.1]"
          style={{
            background:
              "linear-gradient(165deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 35%, rgba(99,102,241,0.06) 100%)",
            boxShadow:
              "0 24px 48px -12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-bold text-white text-lg">Create Company</span>
              <p className="text-slate-500 text-xs mt-0.5">
                Folder select karo, company details bharo. Electron app required (npm run electron:dev).
              </p>
            </div>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label className="text-slate-400 text-sm">Data Folder</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12 rounded-xl border-white/15 bg-slate-800/40 text-slate-300 hover:bg-slate-700/50"
                  onClick={handleSelectFolder}
                  disabled={loading}
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  {folderPath ? "Change Folder" : "Select Folder"}
                </Button>
              </div>
              {folderPath && (
                <p className="text-xs text-emerald-400 mt-1 truncate font-mono" title={folderPath}>
                  {folderPath}
                </p>
              )}
            </div>

            <div>
              <Label className="text-slate-400 text-sm">Company Name</Label>
              <div className="relative mt-1">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="e.g. ABC Traders"
                  className={`pl-10 ${inputClass}`}
                  {...form.register("companyName")}
                />
              </div>
              {form.formState.errors.companyName && (
                <p className="text-xs text-red-400 mt-1">{form.formState.errors.companyName.message}</p>
              )}
            </div>

            <div>
              <Label className="text-slate-400 text-sm">Email (Gmail)</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  type="email"
                  placeholder="you@company.com"
                  className={`pl-10 ${inputClass}`}
                  {...form.register("email")}
                />
              </div>
              {form.formState.errors.email && (
                <p className="text-xs text-red-400 mt-1">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <Label className="text-slate-400 text-sm">Password</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  className={`pl-10 ${inputClass}`}
                  {...form.register("password")}
                />
              </div>
              {form.formState.errors.password && (
                <p className="text-xs text-red-400 mt-1">{form.formState.errors.password.message}</p>
              )}
            </div>

            <div>
              <Label className="text-slate-400 text-sm">Sub Company</Label>
              <div className="relative mt-1">
                <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="e.g. Main Branch, Delhi Branch"
                  className={`pl-10 ${inputClass}`}
                  {...form.register("subCompanyName")}
                />
              </div>
              {form.formState.errors.subCompanyName && (
                <p className="text-xs text-red-400 mt-1">{form.formState.errors.subCompanyName.message}</p>
              )}
            </div>

            <div>
              <Label className="text-slate-400 text-sm">Season</Label>
              <div className="relative mt-1">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="e.g. 2024-25, 2025 A"
                  className={`pl-10 ${inputClass}`}
                  {...form.register("seasonName")}
                />
              </div>
              {form.formState.errors.seasonName && (
                <p className="text-xs text-red-400 mt-1">{form.formState.errors.seasonName.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-xl font-semibold bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white"
              disabled={loading || !folderPath}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Building2 className="mr-2 h-4 w-4" />
              )}
              Create Company
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
