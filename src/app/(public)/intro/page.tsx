"use client";

import React from "react";
import Link from "next/link";
import {
  Building2,
  BarChart3,
  Zap,
  Shield,
  Users,
  LogIn,
  UserPlus,
} from "lucide-react";
import { FlyingPlanes } from "@/components/auth/flying-planes";
import { Button } from "@/components/ui/button";

const features = [
  { icon: BarChart3, title: "Sales & Reports", desc: "Real-time analytics" },
  { icon: Zap, title: "Fast Sync", desc: "Instant across devices" },
  { icon: Shield, title: "Secure", desc: "Encryption & backup" },
  { icon: Users, title: "Team Access", desc: "Role-based access" },
];

const darkBg =
  "radial-gradient(ellipse 80% 50% at 20% 40%, rgba(67, 56, 202, 0.25) 0%, transparent 50%), radial-gradient(ellipse 60% 80% at 80% 60%, rgba(139, 92, 246, 0.2) 0%, transparent 50%), radial-gradient(ellipse 50% 50% at 50% 50%, rgba(99, 102, 241, 0.12) 0%, transparent 70%), linear-gradient(180deg, #0f172a 0%, #1e1b4b 40%, #0f172a 100%)";

export default function IntroPage() {
  return (
    <div
      className="auth-page h-screen w-full overflow-hidden flex flex-col lg:flex-row relative z-0"
      style={{ background: darkBg }}
    >
      <FlyingPlanes />

      {/* Left: Headline + features */}
      <div className="lg:w-1/2 w-full flex flex-col justify-center px-6 lg:px-12 xl:px-16 py-8 relative shrink-0 z-10">
        <div className="w-full max-w-2xl">
          <div
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6 auth-slide-up opacity-0"
            style={{ animationFillMode: "forwards" }}
          >
            <Zap className="w-4 h-4 text-violet-400 stroke-[1.5]" />
            <span className="text-sm font-medium text-slate-300">
              All-in-one Business Platform
            </span>
          </div>
          <div
            className="flex items-center gap-4 mb-6 auth-slide-up opacity-0"
            style={{ animationFillMode: "forwards", animationDelay: "0.1s" }}
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-[0_20px_50px_rgba(99,102,241,0.35)] auth-float">
              <Building2 className="w-7 h-7 text-white stroke-[1.5]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight font-jakarta">
                BizSuite
              </h1>
              <p className="text-violet-300/90 font-medium text-sm">DataFlow</p>
            </div>
          </div>
          <h2
            className="text-2xl lg:text-3xl xl:text-4xl font-bold text-white leading-[1.15] mb-3 font-jakarta auth-slide-up opacity-0"
            style={{ animationFillMode: "forwards", animationDelay: "0.2s" }}
          >
            Business ko digital banao —{" "}
            <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
              ek hi jagah
            </span>
          </h2>
          <p
            className="text-slate-400 text-base leading-relaxed max-w-xl mb-6 auth-slide-up opacity-0"
            style={{ animationFillMode: "forwards", animationDelay: "0.3s" }}
          >
            Sales, payments, inventory, reports — sab kuch ek platform par.
            Simple, fast, secure.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="group p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-violet-500/20 transition-all duration-300 auth-slide-up opacity-0"
                style={{
                  animationFillMode: "forwards",
                  animationDelay: `${0.35 + i * 0.06}s`,
                }}
              >
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center mb-2 group-hover:bg-violet-500/20 transition-colors">
                  <f.icon className="w-5 h-5 text-violet-400 stroke-[1.5]" />
                </div>
                <h3 className="font-semibold text-white text-sm font-jakarta">
                  {f.title}
                </h3>
                <p className="text-slate-500 text-xs mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Login and Create options */}
      <div className="lg:w-1/2 w-full flex items-center justify-center px-6 lg:px-12 xl:px-16 py-8 shrink-0 z-10">
        <div className="w-full max-w-md auth-scale-in opacity-0 space-y-4" style={{ animationFillMode: "forwards" }}>
          <div
            className="relative p-8 rounded-3xl backdrop-blur-2xl border border-white/[0.1]"
            style={{
              background:
                "linear-gradient(165deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 35%, rgba(99,102,241,0.06) 100%)",
              boxShadow:
                "0 24px 48px -12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-[0_8px_24px_rgba(99,102,241,0.35)]">
                <Building2 className="w-6 h-6 text-white stroke-[1.5]" />
              </div>
              <div>
                <span className="font-bold text-white font-jakarta text-lg">BizSuite</span>
                <span className="text-slate-400 text-sm ml-1.5">DataFlow</span>
                <p className="text-slate-500 text-xs mt-0.5">Shuru karein</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm mb-6 text-center">
              BizSuite use karne ke liye "Get Started" par click karein.
              Aap wahi se Login kar sakte hain ya Nayi Company bana sakte hain.
            </p>
            <div className="space-y-4">
              <Link href="/login" className="block">
                <Button
                  className="w-full h-16 rounded-2xl font-bold bg-gradient-to-r from-violet-500 via-indigo-600 to-purple-600 hover:from-violet-600 hover:via-indigo-700 hover:to-purple-700 text-white border-0 shadow-[0_12px_32px_rgba(99,102,241,0.35)] hover:shadow-[0_16px_40px_rgba(99,102,241,0.45)] hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 text-lg flex flex-col items-center justify-center gap-0.5"
                  size="lg"
                >
                  <span className="flex items-center gap-2.5">
                    <Zap className="h-6 w-6 fill-white/20" />
                    Get Started
                  </span>
                  <span className="text-[11px] font-normal text-white/70 uppercase tracking-widest">
                    Login / Create Company
                  </span>
                </Button>
              </Link>
              <div className="flex items-center justify-center gap-2 pt-2">
                <div className="h-px w-8 bg-white/10" />
                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter">
                  Everything in one place
                </span>
                <div className="h-px w-8 bg-white/10" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
