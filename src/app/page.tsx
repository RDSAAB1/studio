
"use client";
import DashboardOverviewPage from "./dashboard-overview/page";

export default function Home() {
  // The redirection and auth logic is now handled entirely by the AppLayout component.
  // This page simply renders the main dashboard content.
  return (
    <DashboardOverviewPage />
  );
}
