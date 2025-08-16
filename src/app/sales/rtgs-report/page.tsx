import RtgsReportClient from "./rtgs-report-client";
import type { PageProps } from '@/app/types';

export default function RtgsReportPage({ params, searchParams }: PageProps) {
  return (
    <RtgsReportClient />
  );
}
