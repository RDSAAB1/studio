import React from "react";
import { Header } from "./header";
import type { PageLayoutProps } from "@/app/types";


export default function MainLayout({ children, pageMeta }: PageLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header pageMeta={pageMeta} />
      <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}

    