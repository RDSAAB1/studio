"use client";

import dynamic from 'next/dynamic';

const DynamicExpenseTrackerClient = dynamic(() => import('./expense-tracker-client'), {
  ssr: false,
});

export default DynamicExpenseTrackerClient;