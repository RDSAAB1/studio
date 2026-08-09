"use client";

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

export function AuthTransitionScreen() {
  const [, forceUpdate] = useState({});
  useEffect(() => {
    const handler = () => forceUpdate({});
    window.addEventListener('jrmd-theme-updated', handler);
    return () => window.removeEventListener('jrmd-theme-updated', handler);
  }, []);

  const themeHeaderBg = "var(--header-bg, var(--header-active-bg, var(--primary-bg-custom, #F5A623)))";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[999999] bg-white"
    >
      {/* Center Simple Spinner with Top Navigation Bar Theme Color */}
      <div className="flex flex-col items-center justify-center gap-3 select-none">
        <div 
          className="w-14 h-14 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center shadow-md"
        >
          <Loader2 
            className="w-7 h-7 animate-spin stroke-[2.5]" 
            style={{ color: themeHeaderBg }}
          />
        </div>
      </div>
    </div>
  );
}
