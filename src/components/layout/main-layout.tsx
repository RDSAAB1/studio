import React from "react";
import { Header } from "./header";
import type { PageLayoutProps } from "@/app/types";


export default function MainLayout({ children, pageMeta }: PageLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header pageMeta={pageMeta} />
      <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-6">
            <h1 className="text-3xl font-bold font-headline text-primary">{pageMeta?.title}</h1>
            {pageMeta?.description && <p className="text-muted-foreground">{pageMeta.description}</p>}
        </div>
        {children}
      </main>
    </div>
  );
}
