"use client";

import { useMemo, useState, useCallback, useEffect } from 'react';
import type { Customer, Payment, ReceiptSettings } from "@/lib/definitions";
import { toTitleCase, formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSupplierPayments } from '@/hooks/use-supplier-payments';
import { useSupplierData } from '@/hooks/use-supplier-data';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Banknote, Scale, FileText, Filter, Calendar as CalendarIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

import { PaymentForm } from '@/components/sales/supplier-payments/payment-form';
import { PaymentHistory } from '@/components/sales/supplier-payments/payment-history';
import { TransactionTable } from '@/components/sales/supplier-payments/transaction-table';
import { PaymentDetailsDialog } from '@/components/sales/supplier-payments/payment-details-dialog';
import { BankSettingsDialog } from '@/components/sales/supplier-payments/bank-settings-dialog';
import { RTGSReceiptDialog } from '@/components/sales/supplier-payments/rtgs-receipt-dialog';
import { DetailsDialog } from "@/components/sales/details-dialog";
import { SupplierEntryEditDialog } from '@/components/sales/supplier-payments/supplier-entry-edit-dialog';
import { usePaymentCombination } from '@/hooks/use-payment-combination';
import { PaymentCombinationGenerator, PaymentCombinationResults } from '@/components/sales/supplier-payments/payment-combination-generator';
import { RtgsForm } from '@/components/sales/supplier-payments/rtgs-form';
import { useSupplierFiltering } from "../supplier-profile/hooks/use-supplier-filtering";
import { useSupplierSummary } from "../supplier-profile/hooks/use-supplier-summary";
import { StatementPreview } from "../supplier-profile/components/statement-preview";
import { PaymentHistoryCompact } from '@/components/sales/supplier-payments/payment-history-compact';

// Import customer data hooks (to be created)
import { getCustomersRealtime, getCustomerPaymentsRealtime } from "@/lib/firestore";
import { useState as useReactState, useEffect as useReactEffect } from "react";

// Helper functions for formatting
const toNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDecimal = (value: number | string | null | undefined) => {
  return toNumber(value).toFixed(2);
};

const formatWeight = (value: number | string | null | undefined) => {
  return `${formatDecimal(value)} kg`;
};

const formatPercentage = (value: number | string | null | undefined) => {
  return `${formatDecimal(value)}%`;
};

const formatRate = (value: number | string | null | undefined) => {
  const numericValue = toNumber(value);
  return `₹${numericValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

interface UnifiedPaymentsClientProps {
  type: 'supplier' | 'customer';
}

export default function UnifiedPaymentsClient({ type }: UnifiedPaymentsClientProps) {
  const { toast } = useToast();
  
  // For supplier payments, use existing hooks
  const supplierHook = type === 'supplier' ? useSupplierPayments() : null;
  const supplierData = type === 'supplier' ? useSupplierData() : null;
  
  // For customer payments, we'll use similar structure but with customer data
  const [customerEntries, setCustomerEntries] = useState<Customer[]>([]);
  const [customerPaymentHistory, setCustomerPaymentHistory] = useState<Payment[]>([]);
  const [isLoadingCustomerData, setIsLoadingCustomerData] = useState(true);
  
  // Load customer data if type is customer
  useEffect(() => {
    if (type === 'customer') {
      setIsLoadingCustomerData(true);
      const unsubCustomers = getCustomersRealtime(
        (data) => setCustomerEntries(data),
        (error) => {
          console.error("Error fetching customers:", error);
          toast({ title: 'Error', description: 'Failed to load customer data.', variant: 'destructive' });
        }
      );
      const unsubPayments = getCustomerPaymentsRealtime(
        (data) => setCustomerPaymentHistory(data as Payment[]),
        (error) => {
          console.error("Error fetching customer payments:", error);
          toast({ title: 'Error', description: 'Failed to load payment data.', variant: 'destructive' });
        }
      );
      setIsLoadingCustomerData(false);
      
      return () => {
        unsubCustomers();
        unsubPayments();
      };
    }
  }, [type, toast]);
  
  // Use supplier hook for supplier, create similar structure for customer
  const hook = type === 'supplier' ? supplierHook : {
    suppliers: customerEntries,
    paymentHistory: customerPaymentHistory,
    // Add other necessary properties from supplier hook
    activeTab: 'process',
    setActiveTab: (tab: string) => {},
    // ... other properties
  };
  
  const { supplierBankAccounts, banks, bankBranches } = supplierData || { supplierBankAccounts: [], banks: [], bankBranches: [] };
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [supplierDataRefreshKey, setSupplierDataRefreshKey] = useState<number>(0);
  const { activeTab, setActiveTab } = hook || { activeTab: 'process', setActiveTab: () => {} };
  const [editEntryDialogOpen, setEditEntryDialogOpen] = useState(false);
  const [selectedEntryForEdit, setSelectedEntryForEdit] = useState<Customer | null>(null);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [activeTransactionTab, setActiveTransactionTab] = useState<string>("all");
  const [filterStartDate, setFilterStartDate] = useState<Date | undefined>(undefined);
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>(undefined);
  const [filterVariety, setFilterVariety] = useState<string>("all");

  const paymentCombination = usePaymentCombination({
    calcTargetAmount: hook?.calcTargetAmount || (() => 0),
    minRate: hook?.minRate || 0,
    maxRate: hook?.maxRate || 0,
  });

  // Use the same supplier summary and filtering as supplier profile
  const { supplierSummaryMap, MILL_OVERVIEW_KEY } = useSupplierSummary(
    hook?.suppliers || [],
    hook?.paymentHistory || [],
    undefined,
    undefined
  );
  
  if (type === 'customer' && isLoadingCustomerData) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // For now, render supplier payments UI structure
  // This will be enhanced to support customer payments
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{type === 'supplier' ? 'Supplier' : 'Customer'} Payments</CardTitle>
          <CardDescription>
            Manage {type === 'supplier' ? 'supplier' : 'customer'} payments and transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {type === 'supplier' ? 'Supplier' : 'Customer'} payments interface will be implemented here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

