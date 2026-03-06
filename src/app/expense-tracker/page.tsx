
"use client";

import React, { use } from "react";
import DynamicExpenseTrackerClient from './dynamic-expense-tracker';

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };
export default function ExpenseTrackerPage(props: PageProps) {
  if (props.searchParams) use(props.searchParams);
  return (
    <DynamicExpenseTrackerClient />
  );
}
