

"use client";

import React, { useEffect, type ReactNode } from 'react';

type LayoutProps = { children: ReactNode; params?: Promise<Record<string, string>> };
export default function PublicGroupLayout({ children, params }: LayoutProps) {
  if (params) React.use(params);

  useEffect(() => {
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  return (
    <div className="min-h-screen h-screen w-full overflow-hidden flex">
      {children}
    </div>
  );
}
