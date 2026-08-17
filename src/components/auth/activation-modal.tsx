"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Copy, Check, RefreshCw, Cloud, ShieldCheck, PhoneCall } from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

interface ActivationModalProps {
  isOpen?: boolean;
  userEmail?: string;
  companyName?: string;
  onCodeVerified?: (subscriptionData: any) => void;
  onSuccess?: () => void;
  onClose?: () => void;
}

type PlanType = "trial" | "monthly" | "yearly" | "lifetime";

const PLANS: { id: PlanType; title: string; duration: string; price: string; days: number; digits: number }[] = [
  { id: "trial", title: "Free Trial", duration: "1 Month", price: "₹0", days: 30, digits: 6 },
  { id: "monthly", title: "Monthly", duration: "30 Days", price: "₹500", days: 30, digits: 5 },
  { id: "yearly", title: "Yearly", duration: "1 Year", price: "₹5,000", days: 365, digits: 7 },
  { id: "lifetime", title: "Lifetime", duration: "Unlimited", price: "₹40,000", days: 36500, digits: 9 },
];

export function ActivationModal({
  isOpen = true,
  userEmail = "",
  companyName = "",
  onCodeVerified,
  onSuccess,
  onClose,
}: ActivationModalProps) {
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("monthly");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted || typeof window === "undefined" || !document.body) return null;

  const upiId = "50487@ybl";
  const whatsappNumber = "+917880555498";

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    toast({ title: "UPI ID Copied", description: `${upiId} copied to clipboard!` });
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleSubscribeClick = async () => {
    const email = userEmail || localStorage.getItem("lastUserEmail") || "rdsaab1@gmail.com";
    const comp = companyName || "My Company";
    const plan = PLANS.find((p) => p.id === selectedPlan);

    // 1. Generate code client-side (extension style)
    let generatedCode = "";
    if (selectedPlan === "trial") generatedCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit
    else if (selectedPlan === "yearly") generatedCode = Math.floor(1000000 + Math.random() * 9000000).toString(); // 7 digit
    else if (selectedPlan === "lifetime") generatedCode = Math.floor(100000000 + Math.random() * 900000000).toString(); // 9 digit
    else generatedCode = Math.floor(10000 + Math.random() * 90000).toString(); // 5 digit (monthly)

    setSubmittingRequest(true);
    try {
      // 2. Store in Firestore verification_codes collection via API
      const res = await fetch("/api/auth/send-subscription-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          companyName: comp,
          planId: selectedPlan,
          code: generatedCode,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send request");
      }

      // 3. Show Success Toast (Server API route /api/auth/send-subscription-request dispatches clean email to rdsaab1@gmail.com)
      toast({
        title: "Subscription Request Sent! 📧",
        description: `Company '${comp}' ke liye activation request rdsaab1@gmail.com par email kar di gayi hai. Email inbox me code check karke yahan fill karein.`,
        variant: "success",
      });

      // 3. Show Success Toast
      toast({
        title: "Subscription Request Sent! 📧",
        description: `Company '${comp}' ke liye activation request rdsaab1@gmail.com par email kar di gayi hai. Email inbox me code check karke yahan fill karein.`,
        variant: "success",
      });
    } catch (err: any) {
      toast({ title: "Request Error", description: err.message || "Failed to send subscription request", variant: "destructive" });
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleAdminTestingMode = async () => {
    setLoading(true);
    try {
      const subInfo = {
        subscription_verified: true,
        subscription_expiry: Date.now() + 1 * 24 * 60 * 60 * 1000,
        subscription_duration: "admin_testing",
        plan_label: "Admin Testing Mode (1 Day)",
      };
      if (onCodeVerified) {
        onCodeVerified(subInfo);
      } else {
        const email = userEmail || "admin@testing.com";
        await fetch("/api/subscription/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: email,
            ...subInfo,
          }),
        });
        toast({ title: "Admin Mode Activated", description: "1-Day Admin Testing Access Granted!", variant: "success" });
        onSuccess?.();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to set admin mode", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    const cleanCode = code.trim();
    if (!cleanCode) {
      toast({ title: "Enter Code", description: "Verification or Activation Code enter karein.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const email = userEmail || localStorage.getItem("lastUserEmail") || "user@emandi.com";
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: cleanCode }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Invalid or expired code.");
      }

      toast({
        title: "Code Verified 🎉",
        description: data.message || "Aapka activation code successfully verify ho gaya!",
        variant: "success",
      });

      if (onCodeVerified) {
        onCodeVerified(data.subscription);
      } else {
        onSuccess?.();
      }
    } catch (err: any) {
      toast({ title: "Activation Failed", description: err.message || "Invalid activation code", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreSubscription = async () => {
    const email = userEmail || localStorage.getItem("lastUserEmail") || "";
    if (!email) {
      toast({ title: "Email Not Found", description: "Pehle login karein taaki subscription restore ho sake.", variant: "destructive" });
      return;
    }

    setRestoring(true);
    try {
      const res = await fetch(`/api/subscription/get?username=${encodeURIComponent(email)}`);
      const data = await res.json();

      if (!res.ok || !data.success || !data.data?.subscription_verified) {
        throw new Error("No active subscription found for this account.");
      }

      const expiry = data.data.subscription_expiry;
      if (expiry && expiry < Date.now()) {
        throw new Error("Aapka Cloud Subscription expire ho chuka hai.");
      }

      toast({
        title: "Subscription Restored Cloud ☁️",
        description: `Active subscription restored! Valid till ${new Date(expiry).toLocaleDateString()}.`,
        variant: "success",
      });

      onSuccess?.();
    } catch (err: any) {
      toast({ title: "Restore Failed", description: err.message || "Could not restore subscription.", variant: "destructive" });
    } finally {
      setRestoring(false);
    }
  };

  const handleLogout = async () => {
    try {
      const auth = getFirebaseAuth();
      await signOut(auth);
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    } catch (err) {
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-2xl animate-in fade-in duration-300 overflow-y-auto">
      <div 
        className="relative w-full max-w-3xl my-auto rounded-3xl p-7 border border-amber-500/35 text-slate-100 font-sans overflow-hidden transition-all duration-300"
        style={{
          background: "radial-gradient(ellipse 90% 70% at 50% -20%, rgba(245, 158, 11, 0.28) 0%, transparent 70%), linear-gradient(165deg, #2a1f16 0%, #1c140d 45%, #120c07 100%)",
          boxShadow: "0 30px 90px -15px rgba(224, 144, 37, 0.35), inset 0 1px 0 rgba(255,255,255,0.12)"
        }}
      >
        {/* Close Button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/5 hover:bg-amber-500/20 text-amber-300 hover:text-white transition-all border border-white/10 z-20"
            title="Close"
          >
            ✕
          </button>
        )}

        {/* Ambient Glow Orbs */}
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-yellow-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-6 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-[0_8px_24px_rgba(245,158,11,0.4)] border border-amber-300/30">
              <Cloud className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight font-jakarta">Activation Required</h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-[10px] font-extrabold text-amber-300 uppercase tracking-wider">
                  Pro License
                </span>
              </div>
              <p className="text-xs text-slate-300/80 mt-0.5">Activate your license subscription to unlock full features</p>
            </div>
          </div>
        </div>

        {/* 2-Column Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start relative z-10">
          
          {/* LEFT COLUMN (7 cols): Plans & Payment Details */}
          <div className="md:col-span-7 space-y-4">
            
            {/* Select Plan */}
            <div className="space-y-2.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-amber-400/90 block">
                1. Select Subscription Plan
              </label>
              <div className="grid grid-cols-2 gap-3">
                {PLANS.map((plan) => {
                  const isSelected = selectedPlan === plan.id;
                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`cursor-pointer p-3.5 rounded-2xl border transition-all duration-300 flex flex-col justify-between h-22 relative overflow-hidden ${
                        isSelected
                          ? "border-amber-400 bg-amber-500/20 shadow-[0_8px_24px_rgba(245,158,11,0.3)] scale-[1.02]"
                          : "border-white/[0.08] bg-white/[0.04] hover:border-amber-500/30 hover:bg-white/[0.07]"
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-bl from-amber-400 to-amber-500 rounded-bl-xl flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-slate-950 stroke-[3]" />
                        </div>
                      )}
                      <div>
                        <span className="font-bold text-xs text-white block">{plan.title}</span>
                        <span className="text-[10px] font-semibold text-amber-300/90">{plan.duration}</span>
                      </div>
                      {/* Price hidden for now as requested */}
                      {/* <div className="text-base font-black text-amber-300 tracking-tight">
                        {plan.price}
                      </div> */}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Subscribe Action Button */}
            <Button
              type="button"
              onClick={handleSubscribeClick}
              disabled={submittingRequest}
              className="w-full h-11 rounded-2xl font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white border-0 shadow-[0_8px_24px_rgba(245,158,11,0.35)] text-xs flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 active:scale-[0.99]"
            >
              {submittingRequest ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Sending Request...</span>
                </>
              ) : (
                <>
                  <Cloud className="w-4 h-4 text-white" />
                  <span>Request Subscription Code</span>
                </>
              )}
            </Button>

            {/* Payment Details Card */}
            <div className="p-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] space-y-2 text-xs text-slate-300">
              <div className="font-bold text-amber-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-jakarta">💳 Payment Details:</span>
                <span className="text-[11px] font-mono font-semibold text-amber-200/90">rdsaab1@gmail.com</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-white/[0.05]">
                <span>Send payment via UPI:</span>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold font-mono text-xs bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-xl border border-amber-400/30">
                    {upiId}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-amber-500/20 text-amber-300 hover:text-white transition-all border border-white/10"
                    title="Copy UPI"
                  >
                    {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN (5 cols): Verification & Actions */}
          <div className="md:col-span-5 space-y-4">
            
            {/* Enter Verification Code Form */}
            <div className="p-4 rounded-2xl border border-amber-500/25 bg-white/[0.04] space-y-3.5 shadow-inner">
              <label className="text-xs font-bold text-amber-300 block font-jakarta">
                2. Enter Verification Code
              </label>
              <Input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="000000"
                className="activation-input text-center font-mono"
              />
              <Button
                type="button"
                onClick={handleVerifyCode}
                disabled={loading}
                className="w-full h-11 rounded-xl font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white border-0 shadow-[0_8px_20px_rgba(245,158,11,0.3)] text-xs transition-all transform hover:-translate-y-0.5 active:scale-[0.99]"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Verify & Activate"}
              </Button>
            </div>

            {/* Restore Subscription */}
            <Button
              type="button"
              onClick={handleRestoreSubscription}
              disabled={restoring}
              className="w-full h-10 rounded-xl font-semibold bg-white/[0.05] hover:bg-amber-500/15 text-amber-300 border border-white/10 hover:border-amber-500/30 text-xs flex items-center justify-center gap-2 transition-all"
            >
              {restoring ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Restore from Cloud</span>
                </>
              )}
            </Button>

            {/* Switch Account */}
            <div className="text-center text-[11px] text-slate-400 pt-1">
              Need to switch account?{" "}
              <button
                type="button"
                onClick={handleLogout}
                className="font-bold text-amber-400 hover:text-amber-300 hover:underline"
              >
                Log out
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>,
    document.body
  );
}
