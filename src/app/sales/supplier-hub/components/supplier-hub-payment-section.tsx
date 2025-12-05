"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CustomerSummary, Payment } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { PaymentForm } from "@/components/sales/supplier-payments/payment-form";
import { TransactionTable } from "@/components/sales/supplier-payments/transaction-table";
import { PaymentHistory } from "@/components/sales/supplier-payments/payment-history";
import { PaymentDetailsDialog } from "@/components/sales/supplier-payments/payment-details-dialog";
import { DetailsDialog } from "@/components/sales/details-dialog";
import { RTGSReceiptDialog } from "@/components/sales/supplier-payments/rtgs-receipt-dialog";
import { PaymentCombinationGenerator, PaymentCombinationResults } from "@/components/sales/supplier-payments/payment-combination-generator";
import { RtgsForm } from "@/components/sales/supplier-payments/rtgs-form";
import { usePaymentCombination } from "@/hooks/use-payment-combination";
import { useSupplierData } from "@/hooks/use-supplier-data";
type SupplierHubPaymentSectionProps = {
  hook: ReturnType<typeof import("@/hooks/use-supplier-payments").useSupplierPayments>;
  selectedSupplierSummary: CustomerSummary | null;
  selectedSupplierKey: string | null;
  onSupplierKeyChange?: (key: string | null) => void;
};

const SupplierHubPaymentSection = ({
  hook,
  selectedSupplierSummary,
  selectedSupplierKey,
  onSupplierKeyChange,
}: SupplierHubPaymentSectionProps) => {
  const {
    activeTab,
    setActiveTab,
    paymentHistory,
    suppliers,
    selectedCustomerKey,
    serialNoSearch,
    handleSerialNoSearch,
    handleSerialNoBlur,
    resetPaymentForm,
    processPayment,
    isProcessing,
    paymentMethod,
    setPaymentMethod,
    calcTargetAmount,
    setCalcTargetAmount,
    minRate,
    setMinRate,
    maxRate,
    setMaxRate,
    selectPaymentAmount,
    detailsSupplierEntry,
    setDetailsSupplierEntry,
    selectedPaymentForDetails,
    setSelectedPaymentForDetails,
    rtgsReceiptData,
    setRtgsReceiptData,
    receiptSettings,
    bankBranches,
    rtgsQuantity,
    rtgsRate,
    rtgsAmount,
    setRtgsQuantity,
    setRtgsRate,
    setRtgsAmount,
    totalOutstandingForSelected,
    selectedEntryIds,
    setSelectedEntryIds,
    setParchiNo,
    parchiNo,
    handleEditPayment,
  } = hook as any;

  const { supplierBankAccounts } = useSupplierData();
  const [rsValue, setRsValue] = useState<number>(0);

  const paymentCombination = usePaymentCombination({
    calcTargetAmount,
    minRate,
    maxRate,
    rsValue: rsValue,
  });

  // Sync Supplier Hub's selectedSupplierKey with payment hook's selectedCustomerKey
  // Only sync when Supplier Hub's key changes (user selection), not when payment hook changes it
  const isSyncingRef = useRef(false);
  const handleCustomerSelectRef = useRef(hook.handleCustomerSelect);
  
  useEffect(() => {
    handleCustomerSelectRef.current = hook.handleCustomerSelect;
  }, [hook.handleCustomerSelect]);

  useEffect(() => {
    if (isSyncingRef.current) {
      isSyncingRef.current = false;
      return;
    }
    if (selectedSupplierKey && selectedSupplierKey !== selectedCustomerKey) {
      handleCustomerSelectRef.current(selectedSupplierKey);
    }
  }, [selectedSupplierKey, selectedCustomerKey]);

  // Reverse sync: When payment ID is filled and supplier profile is selected in payment hook,
  // update Supplier Hub's selectedSupplierKey to keep UI in sync
  const onSupplierKeyChangeRef = useRef(onSupplierKeyChange);
  
  useEffect(() => {
    onSupplierKeyChangeRef.current = onSupplierKeyChange;
  }, [onSupplierKeyChange]);

  useEffect(() => {
    if (selectedCustomerKey && selectedCustomerKey !== selectedSupplierKey && onSupplierKeyChangeRef.current) {
      isSyncingRef.current = true;
      onSupplierKeyChangeRef.current(selectedCustomerKey);
    }
  }, [selectedCustomerKey, selectedSupplierKey]);

  const transactionsForSelectedSupplier = useMemo(() => {
    return selectedSupplierSummary?.allTransactions || [];
  }, [selectedSupplierSummary]);

  // Update parchiNo when entries are selected from table
  // This directly updates parchiNo in the payment form when entries are selected
  useEffect(() => {
    if (!setParchiNo) {
      console.warn('setParchiNo is not available');
      return;
    }
    
    if (selectedEntryIds.size > 0 && transactionsForSelectedSupplier.length > 0) {
      const selectedEntries = transactionsForSelectedSupplier.filter(
        (entry: any) => selectedEntryIds.has(entry.id)
      );
      
      console.log('Selected Entry IDs:', Array.from(selectedEntryIds));
      console.log('Transactions available:', transactionsForSelectedSupplier.length);
      console.log('Selected entries found:', selectedEntries.length);
      
      if (selectedEntries.length > 0) {
        const srNos = selectedEntries.map((e: any) => e.srNo).filter(Boolean).join(', ');
        console.log('Setting parchiNo to:', srNos);
        if (srNos) {
          // Force update parchiNo
          setParchiNo(srNos);
        }
      } else {
        console.warn('No matching entries found. Entry IDs:', Array.from(selectedEntryIds), 'Available IDs:', transactionsForSelectedSupplier.map((e: any) => e.id));
      }
    } else if (selectedEntryIds.size === 0) {
      const hookAny = hook as any;
      const isBeingEdited = hookAny.form?.isBeingEdited || hookAny.isBeingEdited || false;
      if (!isBeingEdited && parchiNo) {
        // Clear parchiNo when no entries selected (only for new payments)
        setParchiNo('');
      }
    }
  }, [selectedEntryIds, transactionsForSelectedSupplier, setParchiNo, hook, parchiNo]);

  const selectedSupplierSrNos = useMemo(() => {
    if (!selectedSupplierSummary?.allTransactions) return [];
    return selectedSupplierSummary.allTransactions
      .map((transaction) => (transaction.srNo || "").toLowerCase())
      .filter(Boolean);
  }, [selectedSupplierSummary]);

  const normalizedSerialFilter = useMemo(() => {
    const raw = serialNoSearch.trim().toLowerCase();
    if (!raw) return "";
    const numericPart = raw.startsWith("s") ? raw.slice(1) : raw;
    if (/^\d+$/.test(numericPart)) {
      return `s${numericPart.padStart(5, "0")}`;
    }
    return raw.startsWith("s") ? raw : `s${raw}`;
  }, [serialNoSearch]);

  const paymentMatchesSelection = useCallback(
    (payment: Payment) => {
      const paidSrNos =
        payment.paidFor?.map((pf) => (pf.srNo || "").toLowerCase()).filter(Boolean) || [];

      const matchesSerial =
        !normalizedSerialFilter || paidSrNos.includes(normalizedSerialFilter);
      const matchesSupplier =
        !selectedSupplierSrNos.length ||
        paidSrNos.some((sr) => selectedSupplierSrNos.includes(sr));

      return matchesSerial && matchesSupplier;
    },
    [normalizedSerialFilter, selectedSupplierSrNos]
  );

  const cashHistoryRows = useMemo(() => {
    return paymentHistory
      .filter((payment: Payment) => (payment.receiptType || "").toLowerCase() === "cash")
      .filter(paymentMatchesSelection);
  }, [paymentHistory, paymentMatchesSelection]);

  const rtgsHistoryRows = useMemo(() => {
    return paymentHistory
      .filter((payment: Payment) => (payment.receiptType || "").toLowerCase() === "rtgs")
      .filter(paymentMatchesSelection);
  }, [paymentHistory, paymentMatchesSelection]);

  const handlePaymentMethodChange = useCallback(
    (method: "Cash" | "Online" | "RTGS") => {
      if (paymentMethod === method) return;
      setPaymentMethod(method);
    },
    [paymentMethod, setPaymentMethod]
  );

  if (!selectedSupplierKey) {
    return (
      <div className="border border-gray-400/50 rounded-lg p-4 bg-muted/20">
        <div className="flex h-48 items-center justify-center text-muted-foreground">
          Select a supplier from the search bar to manage payments.
        </div>
      </div>
    );
  }

  if (hook.loading) {
    return (
      <div className="flex h-48 items-center justify-center space-x-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span>Syncing payment data…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {activeTab === "process" && (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="border border-gray-400/50 rounded-lg p-3 bg-muted/20">
                  <TransactionTable
                    suppliers={transactionsForSelectedSupplier}
                    onShowDetails={setDetailsSupplierEntry}
                    selectedIds={selectedEntryIds}
                    onSelectionChange={setSelectedEntryIds}
                    embed
                  />
                </div>
                <PaymentForm
                  {...hook}
                  paymentMethod={paymentMethod}
                  onPaymentMethodChange={handlePaymentMethodChange}
                  bankBranches={bankBranches}
                />
              </div>
              {paymentMethod === "RTGS" && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="border border-gray-400/50 rounded-lg p-3 bg-muted/20">
                    <RtgsForm
                      {...hook}
                      rtgsQuantity={rtgsQuantity}
                      rtgsRate={rtgsRate}
                      rtgsAmount={rtgsAmount}
                      setRtgsQuantity={setRtgsQuantity}
                      setRtgsRate={setRtgsRate}
                      setRtgsAmount={setRtgsAmount}
                      bankAccounts={supplierBankAccounts}
                    />
                  </div>
                  <div className="border border-gray-400/50 rounded-lg p-3 bg-muted/20 space-y-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          Quantity
                        </label>
                        <Input
                          type="number"
                          value={rtgsQuantity}
                          onChange={(e) => setRtgsQuantity(Number(e.target.value) || 0)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          Rate
                        </label>
                        <Input
                          type="number"
                          value={rtgsRate}
                          onChange={(e) => setRtgsRate(Number(e.target.value) || 0)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          Amount
                        </label>
                        <Input
                          type="number"
                          value={rtgsAmount}
                          onChange={(e) => setRtgsAmount(Number(e.target.value) || 0)}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                    <PaymentCombinationGenerator
                      calcTargetAmount={calcTargetAmount}
                      setCalcTargetAmount={setCalcTargetAmount}
                      minRate={minRate}
                      setMinRate={setMinRate}
                      maxRate={maxRate}
                      setMaxRate={setMaxRate}
                      rsValue={rsValue}
                      setRsValue={setRsValue}
                      selectPaymentAmount={selectPaymentAmount}
                      combination={paymentCombination}
                      showResults={false}
                    />
                  </div>
                </div>
              )}
            </div>
      )}

      {activeTab === "cash" && (
            <div className="space-y-3">
              <PaymentHistory
                payments={cashHistoryRows}
                onShowDetails={setSelectedPaymentForDetails}
                onPrintRtgs={setRtgsReceiptData}
                onEdit={(payment) => {
                  setActiveTab('process');
                  handleEditPayment(payment);
                }}
                onDelete={hook.handleDeletePayment}
                title="Cash Payment History"
                suppliers={suppliers}
              />
            </div>
      )}

      {activeTab === "rtgs" && (
            <div className="space-y-3">
              <PaymentHistory
                payments={rtgsHistoryRows}
                onShowDetails={setSelectedPaymentForDetails}
                onPrintRtgs={setRtgsReceiptData}
                onEdit={(payment) => {
                  setActiveTab('process');
                  handleEditPayment(payment);
                }}
                onDelete={hook.handleDeletePayment}
                title="RTGS Payment History"
                suppliers={suppliers}
              />
            </div>
      )}

      {paymentMethod === "RTGS" && paymentCombination.sortedPaymentOptions.length > 0 && (
        <PaymentCombinationResults
          options={paymentCombination.sortedPaymentOptions}
          requestSort={paymentCombination.requestSort}
          onSelect={selectPaymentAmount}
        />
      )}

      <DetailsDialog
        isOpen={!!detailsSupplierEntry}
        onOpenChange={() => setDetailsSupplierEntry(null)}
        customer={detailsSupplierEntry}
        paymentHistory={paymentHistory}
        entryType="Supplier"
      />

      <PaymentDetailsDialog
        payment={selectedPaymentForDetails}
        suppliers={suppliers}
        onOpenChange={() => setSelectedPaymentForDetails(null)}
        onShowEntryDetails={setDetailsSupplierEntry}
      />

      <RTGSReceiptDialog
        payment={rtgsReceiptData}
        settings={receiptSettings}
        onOpenChange={() => setRtgsReceiptData(null)}
      />
    </div>
  );
};

export default SupplierHubPaymentSection;

