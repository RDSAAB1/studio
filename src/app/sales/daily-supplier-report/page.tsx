
import DailySupplierReportClient from "./daily-supplier-report-client";
import type { PageProps } from '@/app/types';

export default function DailySupplierReportPage({ params, searchParams }: PageProps) {
  return (
    <DailySupplierReportClient />
  );
}
