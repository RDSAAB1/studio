"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { FlyingPlanes } from "./flying-planes";

const darkBg =
  "radial-gradient(ellipse 80% 50% at 20% 40%, rgba(67, 56, 202, 0.25) 0%, transparent 50%), radial-gradient(ellipse 60% 80% at 80% 60%, rgba(139, 92, 246, 0.2) 0%, transparent 50%), radial-gradient(ellipse 50% 50% at 50% 50%, rgba(99, 102, 241, 0.12) 0%, transparent 70%), linear-gradient(180deg, #0f172a 0%, #1e1b4b 40%, #0f172a 100%)";

export function AuthTransitionScreen() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[9999]"
      style={{ background: darkBg }}
    >
      <FlyingPlanes />
      {/* Animated grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(139, 92, 246, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          animation: "auth-grid-pulse 3s ease-in-out infinite",
        }}
      />
      {/* Center pulse */}
      <div className="relative z-10 flex flex-col items-center gap-4">
         <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-[0_0_40px_rgba(0,0,0,0.2)]">
           <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
         </div>
      </div>
    </div>
  );
}
