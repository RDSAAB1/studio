"use client";

import React, { Suspense } from "react";
import {
  Building2,
  BarChart3,
  Zap,
  Shield,
  Users,
  Loader2,
} from "lucide-react";
import { FlyingPlanes } from "@/components/auth/flying-planes";
import { AuthForm } from "@/components/auth/auth-form";

const features = [
  { icon: BarChart3, title: "Sales & Reports", desc: "Real-time analytics" },
  { icon: Zap, title: "Fast Sync", desc: "Instant across devices" },
  { icon: Shield, title: "Secure", desc: "Encryption & backup" },
  { icon: Users, title: "Team Access", desc: "Role-based access" },
];

const darkBg =
  "radial-gradient(ellipse 80% 50% at 20% 40%, rgba(67, 56, 202, 0.25) 0%, transparent 50%), radial-gradient(ellipse 60% 80% at 80% 60%, rgba(139, 92, 246, 0.2) 0%, transparent 50%), radial-gradient(ellipse 50% 50% at 50% 50%, rgba(99, 102, 241, 0.12) 0%, transparent 70%), linear-gradient(180deg, #0f172a 0%, #1e1b4b 40%, #0f172a 100%)";

function AuthPageContent() {
  return (
    <div
      className="auth-page h-screen w-full overflow-hidden flex flex-col lg:flex-row relative"
      style={{ background: darkBg }}
    >
      <FlyingPlanes />

      {/* Left: Software details - 50% */}
      <div className="lg:w-1/2 w-full flex flex-col justify-center px-6 lg:px-12 xl:px-16 py-8 relative shrink-0 z-10">
        <div className="relative z-10 w-full max-w-2xl">
          <div className="flex items-center gap-4 mb-8 auth-slide-up opacity-0" style={{ animationFillMode: "forwards" }}>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-[0_20px_50px_rgba(99,102,241,0.35)] auth-float">
              <Building2 className="w-7 h-7 text-white stroke-[1.5]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight font-jakarta">BizSuite</h1>
              <p className="text-violet-300/90 font-medium text-sm">DataFlow</p>
            </div>
          </div>
          <h2 className="text-2xl lg:text-3xl xl:text-4xl font-bold text-white leading-tight mb-3 font-jakarta auth-slide-up auth-delay-1 opacity-0" style={{ animationFillMode: "forwards" }}>
            <span className="auth-text-glow inline-block">Welcome back</span>
          </h2>
          <p className="text-slate-400 text-base mb-6 auth-slide-up auth-delay-2 opacity-0" style={{ animationFillMode: "forwards" }}>
            Email ya Username + Password se login karo. Owner, Admin ya Team member — sab ek hi jagah.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {features.map((f, i) => (
              <div key={f.title} className="group p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-violet-500/20 transition-all duration-300 auth-slide-up opacity-0" style={{ animationFillMode: "forwards", animationDelay: `${0.3 + i * 0.08}s` }}>
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center mb-2 group-hover:bg-violet-500/20 transition-colors">
                  <f.icon className="w-5 h-5 text-violet-400 stroke-[1.5]" />
                </div>
                <h3 className="font-semibold text-white text-sm font-jakarta">{f.title}</h3>
                <p className="text-slate-500 text-xs mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="lg:w-1/2 w-full flex items-center justify-center px-6 lg:px-12 xl:px-16 py-8 shrink-0 z-10">
        <div className="w-full max-w-xl auth-scale-in opacity-0" style={{ animationFillMode: "forwards" }}>
          <Suspense fallback={<div className="h-64 rounded-3xl bg-white/5 animate-pulse" />}>
            <AuthForm showBackLink={true} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center"
          style={{
            background:
              "linear-gradient(180deg, #0f172a 0%, #1e1b4b 40%, #0f172a 100%)",
          }}
        >
          <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
        </div>
      }
    >
      <AuthPageContent />
    </Suspense>
  );
}
