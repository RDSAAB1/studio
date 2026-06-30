"use client";

import React, { memo, useState, useEffect } from "react";
import { Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { Loader2, Save, Box, Wallet, Users, Percent, PlusCircle, Settings, ExternalLink } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { BankAccount } from "@/lib/definitions";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type TransactionFormValues = {
  id?: string;
  transactionId?: string;
  date: Date;
  transactionType: "Income" | "Expense";
  category?: string;
  subCategory?: string;
  amount: number;
  payee: string;
  paymentMethod: string;
  bankAccountId?: string;
  status: string;
  description?: string;
  expenseNature?: string;
  loanId?: string;
  isInternal?: boolean;
  entryType: string;
  variety?: string;
  quantity?: number;
  rate?: number;
  openingBalance?: number;
  openingBalanceType?: "Dr" | "Cr";
};

interface TransactionFormProps {
  form: UseFormReturn<TransactionFormValues>;
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  handleNew: () => void;
  handleTransactionIdBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  isSubmitting: boolean;
  editingTransaction: { id: string } | null;
  setLastAmountSource: (source: 'income' | 'expense' | null) => void;
  bankAccounts: BankAccount[];
  uniqueVarieties: string[];
  accountOptions: { label: string; value: string }[];
  onManageVarieties?: () => void;
  errors: any;
  isStockManagement?: boolean;
}

const TAB_GROUPS_STANDARD = {
  cash: ['Income', 'Expense'],
  udhar: ['Lend', 'Borrow', 'Lend Return', 'Borrow Return'],
  interest: ['Receivable', 'Payable'],
  adjust: ['Salary', 'Laboury', 'Transport', 'Brokerage', 'Capital', 'Liabilities', 'Building', 'Machinery', 'Miscellaneous', 'Opening Dr', 'Opening Cr', 'Adj Dr', 'Adj Cr'],
};

const TAB_GROUPS_STOCK = {
  stock: ['Buy', 'Sale', 'Loss', 'Use', 'Extra Receive'],
};

export const TransactionForm = memo(function TransactionForm({
  form,
  onSubmit,
  handleNew,
  handleTransactionIdBlur,
  isSubmitting,
  editingTransaction,
  setLastAmountSource,
  bankAccounts,
  uniqueVarieties,
  accountOptions,
  onManageVarieties,
  errors,
  isStockManagement = false,
}: TransactionFormProps) {
  const TAB_GROUPS = isStockManagement ? TAB_GROUPS_STOCK : TAB_GROUPS_STANDARD;
  const { control, register, watch, setValue } = form;
  const currentEntryType = watch('entryType');
  const isInternal = watch('isInternal');
  const [activeTab, setActiveTab] = useState<string>(isStockManagement ? "stock" : "cash");

  useEffect(() => {
    if (currentEntryType) {
      const tab = Object.entries(TAB_GROUPS).find(([_, types]) => types.includes(currentEntryType))?.[0];
      if (tab && tab !== activeTab) setActiveTab(tab);
    }
  }, [currentEntryType, activeTab]);

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    const firstType = TAB_GROUPS[newTab as keyof typeof TAB_GROUPS][0];
    if (firstType !== currentEntryType) {
      setValue('entryType', firstType);
      
      // Clear fields based on the new tab
      if (newTab !== 'stock') {
        setValue('variety', '');
        setValue('quantity', 0);
        setValue('rate', 0);
      }

      const isInternalType = ['Salary', 'Laboury', 'Transport', 'Brokerage', 'Capital', 'Liabilities', 'Building', 'Machinery', 'Miscellaneous', 'Buy', 'Sale', 'Loss', 'Use', 'Extra Receive', 'Interest Received', 'Interest Paid', 'Opening Dr', 'Opening Cr'].includes(firstType);
      setValue('isInternal', isInternalType);
      if (isInternalType) {
        setValue('paymentMethod', 'Other');
        setValue('bankAccountId', undefined);
      } else if (watch('paymentMethod') === 'Other') {
        setValue('paymentMethod', 'Cash');
      }
    }
  };

  const filteredOptions = React.useMemo(() => {
    const allOptions = [
      { value: 'Income', label: 'INCOME' },
      { value: 'Expense', label: 'EXPENSE' },
      { value: 'Buy', label: 'BUY' },
      { value: 'Sale', label: 'SALE' },
      { value: 'Lend', label: 'LEND' },
      { value: 'Lend Return', label: 'LEND RET' },
      { value: 'Borrow', label: 'BORROW' },
      { value: 'Borrow Return', label: 'BORROW RET' },
      { value: 'Receivable', label: 'RECEIVABLE' },
      { value: 'Payable', label: 'PAYABLE' },
      { value: 'Loss', label: 'LOSS' },
      { value: 'Use', label: 'USE' },
      { value: 'Extra Receive', label: 'EXTRA' },
      { value: 'Salary', label: 'SALARY' },
      { value: 'Laboury', label: 'LABOUR' },
      { value: 'Transport', label: 'TRNSPRT' },
      { value: 'Brokerage', label: 'BROKER' },
      { value: 'Capital', label: 'CAPITAL' },
      { value: 'Liabilities', label: 'LIABILTY' },
      { value: 'Building', label: 'BUILDING' },
      { value: 'Machinery', label: 'MACHINE' },
      { value: 'Miscellaneous', label: 'MISC' },
      { value: 'Opening Dr', label: 'OPEN DR' },
      { value: 'Opening Cr', label: 'OPEN CR' }
    ];
    return allOptions.filter(opt => TAB_GROUPS[activeTab as keyof typeof TAB_GROUPS].includes(opt.value));
  }, [activeTab]);

  const showStockFields = isStockManagement && ['Buy', 'Sale', 'Loss', 'Use', 'Extra Receive'].includes(currentEntryType);

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" {...register('payee')} />
      
      {!watch('payee') && (
        <div className="bg-rose-50 border-2 border-rose-200 p-2 rounded-lg text-center animate-pulse">
          <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">⚠️ Select Account from Top Search</p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full mb-1">
        <TabsList className={cn("grid w-full h-8 bg-slate-100 p-1 rounded-md", isStockManagement ? "grid-cols-1" : "grid-cols-4")}>
          {isStockManagement ? (
            <TabsTrigger value="stock" className="text-[9px] font-black data-[state=active]:bg-violet-600 data-[state=active]:text-white transition-all"><Box className="w-3 h-3 mr-0.5 sm:mr-1" /> STOCK MANAGEMENT</TabsTrigger>
          ) : (
            <>
              <TabsTrigger value="cash" className="text-[9px] font-black data-[state=active]:bg-emerald-600 data-[state=active]:text-white transition-all"><Wallet className="w-3 h-3 mr-0.5 sm:mr-1" /> CASH</TabsTrigger>
              <TabsTrigger value="udhar" className="text-[9px] font-black data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all"><Users className="w-3 h-3 mr-0.5 sm:mr-1" /> UDHAR</TabsTrigger>
              <TabsTrigger value="interest" className="text-[9px] font-black data-[state=active]:bg-amber-600 data-[state=active]:text-white transition-all"><Percent className="w-3 h-3 mr-0.5 sm:mr-1" /> INTEREST</TabsTrigger>
              <TabsTrigger value="adjust" className="text-[9px] font-black data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all"><Settings className="w-3 h-3 mr-0.5 sm:mr-1" /> ADJ</TabsTrigger>
            </>
          )}
        </TabsList>
      </Tabs>

      <Controller
        name="entryType"
        control={control}
        render={({ field }) => (
          <div className="flex flex-wrap gap-1.5 py-0.5">
            {filteredOptions.map((opt) => {
              const isActive = field.value === opt.value;
              const getColors = () => {
                if (['Income', 'Sale', 'Lend Return', 'Borrow', 'Receivable', 'Extra Receive'].includes(opt.value))
            return isActive ? "bg-emerald-600 text-white border-emerald-600" : "text-emerald-700 border-emerald-200 hover:bg-emerald-50";
          if (['Expense', 'Buy', 'Borrow Return', 'Lend', 'Payable', 'Loss', 'Use'].includes(opt.value))
            return isActive ? "bg-rose-600 text-white border-rose-600" : "text-rose-700 border-rose-200 hover:bg-rose-50";
                if (['Salary', 'Laboury', 'Transport', 'Brokerage', 'Capital', 'Liabilities', 'Building', 'Machinery', 'Miscellaneous', 'Opening Dr', 'Opening Cr'].includes(opt.value))
                  return isActive ? "bg-purple-600 text-white border-purple-600" : "text-purple-700 border-purple-200 hover:bg-purple-50";
                return isActive ? "bg-indigo-600 text-white border-indigo-600" : "text-indigo-700 border-indigo-100 hover:bg-indigo-50";
              };
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    field.onChange(opt.value);
                    const isInt = ['Salary', 'Laboury', 'Transport', 'Brokerage', 'Capital', 'Liabilities', 'Building', 'Machinery', 'Miscellaneous', 'Buy', 'Sale', 'Loss', 'Use', 'Extra Receive', 'Receivable', 'Payable', 'Opening Dr', 'Opening Cr'].includes(opt.value);
                    setValue('isInternal', isInt);
                    if (isInt) { setValue('paymentMethod', 'Other'); setValue('bankAccountId', undefined); }
                    else if (watch('paymentMethod') === 'Other') setValue('paymentMethod', 'Cash');
                  }}
                  className={cn("px-2 py-0.5 text-[9px] font-black rounded border-2 transition-all uppercase tracking-tight", getColors(), isActive && "scale-105 shadow-sm")}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}
      />

      <div className="space-y-1">
        <div className="grid grid-cols-2 gap-1.5">
          <div className="space-y-0.5">
            <Label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest">ID</Label>
            <Input {...register("transactionId")} onBlur={handleTransactionIdBlur} className="h-7 text-[10px] font-black bg-white border-slate-200" />
            {errors?.transactionId && <p className="text-[8px] font-bold text-rose-500 uppercase">{errors.transactionId.message}</p>}
          </div>
          <div className="space-y-0.5">
            <Label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest">Date</Label>
            <Controller name="date" control={control} render={({ field }) => <SmartDatePicker value={field.value} onChange={field.onChange} className="h-7 text-[10px] font-bold w-full bg-white border-slate-200" />} />
            {errors?.date && <p className="text-[8px] font-bold text-rose-500 uppercase">{errors.date.message}</p>}
          </div>
        </div>

        {showStockFields && (
          <div className="grid grid-cols-12 gap-1.5 bg-slate-50 p-1.5 rounded border border-slate-100">
            {['Buy', 'Sale'].includes(currentEntryType) && (
              <div className="col-span-12 mb-1">
                {currentEntryType === 'Buy' ? (
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full h-7 text-[10px] font-bold border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-800"
                    onClick={() => {
                      document.getElementById('trigger-supplier-purchase')?.click();
                    }}
                  >
                    <ExternalLink className="w-3 h-3 mr-1.5" />
                    Open Advanced Purchase Form (Karta/Bags/Brokerage)
                  </Button>
                ) : (
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full h-7 text-[10px] font-bold border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800"
                    onClick={() => {
                      document.getElementById('trigger-customer-sale')?.click();
                    }}
                  >
                    <ExternalLink className="w-3 h-3 mr-1.5" />
                    Open Advanced Sale Form (Karta/Bags/Brokerage)
                  </Button>
                )}
              </div>
            )}
            <div className="col-span-6">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">Variety</Label>
                {onManageVarieties && (
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="icon" 
                    onClick={onManageVarieties} 
                    className="h-4 w-4 shrink-0"
                    tabIndex={-1}
                  >
                    <Settings className="h-2.5 w-2.5 text-slate-400"/>
                  </Button>
                )}
              </div>
              <div className="h-7 bg-white border border-slate-200 rounded">
                <Controller
                  name="variety"
                  control={control}
                  render={({ field }) => (
                    <CustomDropdown
                      options={uniqueVarieties.map(v => ({ value: v, label: v }))}
                      value={field.value || null}
                      onChange={(val) => field.onChange(val || '')}
                      onAdd={(val) => field.onChange(val)}
                      inputClassName="h-full w-full bg-transparent border-0 text-[10px] font-bold px-2"
                    />
                  )}
                />
              </div>
              {errors?.variety && <p className="text-[8px] font-bold text-rose-500 uppercase">{errors.variety.message}</p>}
            </div>
            <div className="col-span-3">
              <Label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-0.5 block">Qty</Label>
              <Input {...register('quantity')} type="number" step="any" className="h-7 text-[10px] font-bold px-1.5" />
              {errors?.quantity && <p className="text-[8px] font-bold text-rose-500 uppercase">{errors.quantity.message}</p>}
            </div>
            <div className="col-span-3">
              <Label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-0.5 block">Rate</Label>
              <Input {...register('rate')} type="number" step="any" className="h-7 text-[10px] font-bold px-1.5" />
              {errors?.rate && <p className="text-[8px] font-bold text-rose-500 uppercase">{errors.rate.message}</p>}
            </div>
          </div>
        )}
 
        <div className="grid grid-cols-1 gap-1.5">
          <div className="space-y-0.5">
            <Label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest">Amount (₹)</Label>
            <Input 
              {...register('amount', { onChange: (e) => setLastAmountSource(['Income', 'Sale', 'Borrow', 'Lend Return', 'Interest Received', 'Extra Receive', 'Credit Adjust'].includes(watch('entryType')) ? 'income' : 'expense') })} 
              type="number" 
              step="0.01" 
              className="h-8 text-sm font-black border-violet-200 bg-white text-violet-950 rounded" 
            />
            {errors?.amount && <p className="text-[8px] font-bold text-rose-500 uppercase">{errors.amount.message}</p>}
          </div>

          {/* Opening Balance Section */}
          

          {/* Payment Via */}
          {!isInternal && (
            <div className="space-y-0.5">
              <Label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest">Payment Via</Label>
              <div className="h-8 bg-white border border-slate-200 rounded">
                <CustomDropdown
                  options={[{ value: 'Cash', label: 'Cash' }, ...bankAccounts.map(acc => ({ value: acc.id, label: `${acc.accountHolderName || acc.bankName} (${acc.accountNumber?.slice(-4) || '....'})` }))]}
                  value={watch('paymentMethod') === 'Cash' ? 'Cash' : (watch('bankAccountId') || null)}
                  onChange={(val) => {
                    if (val === 'Cash') { setValue('paymentMethod', 'Cash'); setValue('bankAccountId', undefined); }
                    else { const acc = bankAccounts.find(a => a.id === (val || undefined)); setValue('paymentMethod', acc?.bankName || ''); setValue('bankAccountId', val || undefined); }
                  }}
                  inputClassName="h-full w-full bg-transparent border-0 text-[10px] font-bold px-2"
                />
              </div>
              {errors?.paymentMethod && <p className="text-[8px] font-bold text-rose-500 uppercase">{errors.paymentMethod.message}</p>}
            </div>
          )}
        </div>

        <div className="space-y-0.5">
          <Label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest">Remarks</Label>
          <Input {...register('description')} placeholder="Notes..." className="h-7 text-[10px] font-medium bg-white border-slate-200" />
        </div>
      </div>

      <div className="flex gap-1.5 pt-1.5 border-t border-slate-100">
        <Button 
          type="submit" 
          disabled={isSubmitting} 
          className="flex-[2] bg-violet-700 hover:bg-violet-800 text-white font-black text-[10px] h-8 rounded uppercase tracking-widest"
        >
          {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1.5" />}
          {editingTransaction ? 'Update' : 'Save'}
        </Button>
        <Button 
          type="button" 
          variant="outline" 
          onClick={handleNew} 
          className="flex-1 bg-white hover:bg-slate-50 text-slate-700 font-black text-[10px] h-8 rounded border-slate-200 uppercase tracking-widest"
        >
          <PlusCircle className="h-3 w-3 mr-1.5 text-violet-600" /> New
        </Button>
      </div>
    </form>
  );
});
