"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  getFirebaseAuth,
  getGoogleProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithRedirect,
} from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  LogIn,
  UserPlus,
  Building2,
  ArrowLeft,
  Mail,
  Lock,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  setErpMode,
  setErpSelectionStorage,
  setActiveTenant,
  setCachedTenants,
  clearLocalDataForContextSwitch,
} from "@/lib/tenancy";
import { createCompanyForNewUser } from "@/lib/create-company";
import { AuthTransitionScreen } from "@/components/auth/auth-transition-screen";
import { electronNavigate } from "@/lib/electron-navigate";

const unifiedLoginSchema = z.object({
  identifier: z
    .string()
    .min(2, "Email ya Username enter karo")
    .refine(
      (val) => {
        if (val.includes("@")) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
        return val.length >= 2;
      },
      { message: "Valid email ya username (min 2 chars)" }
    ),
  password: z.string().min(6, "Password min 6 characters"),
});

const createCompanySchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password min 6 characters"),
  companyName: z.string().min(2, "Company name required"),
});

type UnifiedLoginFormValues = z.infer<typeof unifiedLoginSchema>;
type CreateCompanyFormValues = z.infer<typeof createCompanySchema>;

function FormField({
  label,
  id,
  error,
  rightSlot,
  children,
}: {
  label: React.ReactNode;
  id: string;
  error?: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-slate-400 font-medium text-sm">
          {label}
        </Label>
        {rightSlot}
      </div>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function AuthForm({ showBackLink = false }: { showBackLink?: boolean }) {
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showTransitionScreen, setShowTransitionScreen] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"login" | "create">(
    modeParam === "create" ? "create" : "login"
  );

  useEffect(() => {
    setActiveTab(modeParam === "create" ? "create" : "login");
  }, [modeParam]);

  const loginForm = useForm<UnifiedLoginFormValues>({
    resolver: zodResolver(unifiedLoginSchema),
    defaultValues: { identifier: "", password: "" },
  });
  const createCompanyForm = useForm<CreateCompanyFormValues>({
    resolver: zodResolver(createCompanySchema),
  });

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setShowTransitionScreen(true);
    try {
      const auth = getFirebaseAuth();
      const provider = getGoogleProvider();
      await signInWithRedirect(auth, provider);
    } catch {
      setShowTransitionScreen(false);
      setLoading(false);
      toast({
        title: "Login Failed",
        description: "Could not start the login process.",
        variant: "destructive",
      });
    }
  };

  const onUnifiedLoginSubmit = async (data: UnifiedLoginFormValues) => {
    setLoginError(null);
    setLoading(true);
    setShowTransitionScreen(true);
    const isEmail = data.identifier.includes("@");

    if (isEmail) {
      const auth = getFirebaseAuth();
      try {
        await signInWithEmailAndPassword(auth, data.identifier, data.password);
        toast({ title: "Login Successful", variant: "success" });
        if (typeof window !== "undefined") {
          electronNavigate("/");
        }
      } catch (error: unknown) {
        const err = error as { code?: string };
        let msg = "Invalid email or password.";
        if (
          err.code === "auth/user-not-found" ||
          err.code === "auth/wrong-password" ||
          err.code === "auth/invalid-credential"
        ) {
          msg = "Invalid email or password.";
        }
        setShowTransitionScreen(false);
        setLoginError(msg);
        toast({ title: "Login Failed", description: msg, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    } else {
      try {
        const res = await fetch("/api/company-users/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: data.identifier.trim(),
            password: data.password,
          }),
        });
        const result = await res.json();
        if (!res.ok) {
          setShowTransitionScreen(false);
          const errMsg = result.error || "Invalid username or password";
          setLoginError(errMsg);
          toast({
            title: "Login Failed",
            description: errMsg,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        if (typeof window !== "undefined" && result.customToken) {
          const { signInWithCustomToken } = await import("firebase/auth");
          const { getFirebaseAuth } = await import("@/lib/firebase");
          const { setErpMode, setErpSelectionStorage } = await import("@/lib/tenancy");
          const { doc, getDoc } = await import("firebase/firestore");
          const { firestoreDB } = await import("@/lib/firebase");
          await signInWithCustomToken(getFirebaseAuth(), result.customToken);
          setErpMode(true);
          const companySnap = await getDoc(doc(firestoreDB, "companies", result.companyId));
          const d = companySnap.exists() ? companySnap.data() : {};
          const subCompanies =
            (d.subCompanies as Record<string, { seasons?: Record<string, string> }>) || {};
          const firstSub = Object.entries(subCompanies)[0];
          const subId = firstSub?.[0] || "main";
          const seasons = firstSub?.[1]?.seasons || {};
          const seasonKey = Object.keys(seasons)[0] || String(new Date().getFullYear());
          const hasValidSubSeason = firstSub && Object.keys(seasons).length > 0;
          setErpSelectionStorage({ companyId: result.companyId, subCompanyId: subId, seasonKey });
          toast({ title: "Login Successful", variant: "success" });
          electronNavigate(hasValidSubSeason ? "/" : "/company-setup?login=1");
          return;
        }
        toast({ title: "Login Successful", variant: "success" });
        electronNavigate("/");
      } catch {
        setShowTransitionScreen(false);
        setLoginError("Network error. Please try again.");
        toast({ title: "Login Failed", description: "Network error", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
  };

  const onCreateCompanySubmit = async (data: CreateCompanyFormValues) => {
    setLoading(true);
    setShowTransitionScreen(true);
    const auth = getFirebaseAuth();
    const companyName = data.companyName.trim() || "Company";
    try {
      const userCred = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const userId = userCred.user?.uid;
      if (!userId) throw new Error("User created but no UID");

      // Directly create company + subCompany (MAIN) + season - no reliance on sessionStorage
      const { companyId, subCompanyId, seasonKey } = await createCompanyForNewUser(companyName, userId);

      setErpMode(true);
      setErpSelectionStorage({ companyId, subCompanyId, seasonKey });
      setActiveTenant({ id: "root", storageMode: "root" });
      setCachedTenants([]);

      toast({
        title: "Company Created",
        description: "Your account and company have been created successfully.",
        variant: "success",
      });

      if (typeof window !== "undefined") {
        await clearLocalDataForContextSwitch();
        electronNavigate("/company-setup?new=1");
      }
    } catch (error: unknown) {
      setShowTransitionScreen(false);
      const err = error as { code?: string };
      let msg = "An unexpected error occurred.";
      if (err.code === "auth/email-already-in-use") msg = "This email is already registered.";
      toast({ title: "Signup Failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const showCreateCompany = activeTab === "create";
  const formContentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | "auto">("auto");
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (showTransitionScreen) return;
    if (!formContentRef.current) return;
    const el = formContentRef.current;
    const ro = new ResizeObserver(() => setContentHeight(el.scrollHeight));
    ro.observe(el);
    setContentHeight(el.scrollHeight);
    return () => ro.disconnect();
  }, [activeTab, showTransitionScreen]);

  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    setIsAnimating(true);
    const t = setTimeout(() => setIsAnimating(false), 400);
    return () => clearTimeout(t);
  }, [activeTab]);

  const inputClass =
    "h-12 rounded-xl border border-white/15 bg-white/[0.07] text-white placeholder:text-slate-500 focus:border-violet-400/80 focus:ring-2 focus:ring-violet-500/25 focus:outline-none transition-all duration-300 hover:bg-white/[0.09] hover:border-white/25";

  if (showTransitionScreen) {
    return <AuthTransitionScreen />;
  }

  return (
    <div
      className="relative p-8 rounded-3xl backdrop-blur-2xl border border-white/[0.1] transition-all duration-500 overflow-hidden"
      style={{
        background:
          "linear-gradient(165deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 35%, rgba(99,102,241,0.06) 100%)",
        boxShadow:
          "0 24px 48px -12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
    >
      {showBackLink && (
        <Link href="/intro" className="group inline-flex items-center gap-2 text-slate-400 hover:text-violet-400 hover:gap-3 text-sm mb-6 transition-all duration-300">
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform duration-300 stroke-[1.5]" />
          Back
        </Link>
      )}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-[0_8px_24px_rgba(99,102,241,0.35)]">
          <Building2 className="w-6 h-6 text-white stroke-[1.5]" />
        </div>
        <div>
          <span className="font-bold text-white font-jakarta text-lg">BizSuite</span>
          <span className="text-slate-400 text-sm ml-1.5">DataFlow</span>
          <p className="text-slate-500 text-xs mt-0.5">{showCreateCompany ? "Create company" : "Sign in"}</p>
        </div>
      </div>

      {/* Segmented control - Login | Create Company */}
      <div className="relative flex p-1.5 rounded-2xl bg-slate-900/50 border border-white/[0.06] mb-6">
        <div
          className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-xl bg-gradient-to-r from-violet-500/50 to-indigo-500/50 border border-white/15 transition-all duration-300 ease-out shadow-[0_2px_8px_rgba(99,102,241,0.2)]"
          style={{ left: activeTab === "login" ? "6px" : "calc(50% + 3px)" }}
        />
            <button
          type="button"
          onClick={() => { setActiveTab("login"); setLoginError(null); }}
          className={`relative z-10 flex-1 py-3 rounded-xl text-sm font-semibold transition-colors duration-200 ${
            activeTab === "login" ? "text-white" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Login
        </button>
            <button
          type="button"
          onClick={() => { setActiveTab("create"); setLoginError(null); }}
          className={`relative z-10 flex-1 py-3 rounded-xl text-sm font-semibold transition-colors duration-200 ${
            activeTab === "create" ? "text-white" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Create Company
        </button>
      </div>

      <div
        className="overflow-hidden transition-[height] duration-400 ease-out min-h-[320px]"
        style={{ height: contentHeight === "auto" ? "auto" : `${contentHeight}px` }}
      >
        <div
          ref={formContentRef}
          className={`space-y-5 pt-1 transition-all duration-400 ease-out ${
            isAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
          }`}
        >
      {activeTab === "login" && (
          <form onSubmit={loginForm.handleSubmit(onUnifiedLoginSubmit)} className="space-y-5">
            {loginError && (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm">
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{loginError}</span>
              </div>
            )}
            <FormField
              label="Email or Username"
              id="login-identifier"
              error={loginForm.formState.errors.identifier?.message}
            >
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  id="login-identifier"
                  type="text"
                  placeholder="email@example.com ya username"
                  className={`pl-10 ${inputClass}`}
                  {...loginForm.register("identifier")}
                />
              </div>
            </FormField>
            <FormField
              label="Password"
              id="login-password"
              error={loginForm.formState.errors.password?.message}
              rightSlot={
                <Link href="/forgot-password" className="text-xs text-violet-400 hover:text-violet-300 hover:underline font-medium">
                  Forgot?
                </Link>
              }
            >
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  className={`pl-10 ${inputClass}`}
                  {...loginForm.register("password")}
                />
              </div>
            </FormField>
            <div className="flex gap-3">
              <Button
                type="submit"
                className="flex-1 h-12 rounded-xl font-semibold bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white border-0 shadow-[0_8px_24px_rgba(99,102,241,0.35)] hover:shadow-[0_12px_32px_rgba(99,102,241,0.4)] hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-300"
                disabled={loading}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                Login
              </Button>
              <Button
                variant="outline"
                className="auth-google-btn flex-1 h-12 rounded-xl border border-white/15 bg-slate-800/40 hover:bg-slate-700/50 hover:border-white/25 text-slate-300 transition-all !shadow-none focus-visible:ring-violet-500/50"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <svg className="mr-2 h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google
              </Button>
            </div>
          </form>
      )}

      {activeTab === "create" && (
          <form onSubmit={createCompanyForm.handleSubmit(onCreateCompanySubmit)} className="space-y-5">
            <FormField
              label="Email"
              id="create-email"
              error={createCompanyForm.formState.errors.email?.message}
            >
              <Input
                id="create-email"
                type="email"
                placeholder="you@company.com"
                className={inputClass}
                {...createCompanyForm.register("email")}
              />
            </FormField>
            <FormField
              label="Password"
              id="create-password"
              error={createCompanyForm.formState.errors.password?.message}
            >
              <Input
                id="create-password"
                type="password"
                placeholder="••••••••"
                className={inputClass}
                {...createCompanyForm.register("password")}
              />
            </FormField>
            <FormField
              label="Company Name"
              id="company-name"
              error={createCompanyForm.formState.errors.companyName?.message}
            >
              <Input
                id="company-name"
                placeholder="My Company"
                className={inputClass}
                {...createCompanyForm.register("companyName")}
              />
            </FormField>
            <Button
              type="submit"
              className="w-full h-12 rounded-xl font-semibold bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white border-0 shadow-[0_8px_24px_rgba(99,102,241,0.35)] hover:shadow-[0_12px_32px_rgba(99,102,241,0.4)] hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-300"
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Create Company
            </Button>
          </form>
      )}
        </div>
      </div>
    </div>
  );
}
