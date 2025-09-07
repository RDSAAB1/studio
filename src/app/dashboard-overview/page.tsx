
import DashboardOverviewClient from "./dashboard-overview-client";
import type { PageProps } from '@/app/types';
import { Tremor, Card, Text, Metric } from "@tremor/react";

export default function DashboardOverviewPage({ params, searchParams }: PageProps) {
  return <DashboardOverviewClient />;
}
