"use client";

import React, { memo } from "react";
import { Controller, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { Loader2, Save, RefreshCw } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { BankAccount, Project } from "@/lib/definitions";

type TransactionFormValues = {
  id?: string;
  transactionId?: string;
  date: Date;
  transactionType: "Income" | "Expense";
  category?: string;
  subCategory?: string;
  amount: number;
  incomeAmount?: number;
  expenseAmount?: number;
  payee: string;
  paymentMethod: string;
  bankAccountId?: string;
  status: string;
  description?: string;
  taxAmount?: number;
  cdAmount?: number;
  expenseType?: "Personal" | "Business";
  mill?: string;
  expenseNature?: string;
  projectId?: string;
  loanId?: string;
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
  projects: Project[];
  selectedTransactionType: "Income" | "Expense";
  errors: UseFormReturn<TransactionFormValues>["formState"]["errors"];
}

export const TransactionForm = memo(function TransactionForm({
  form,
  onSubmit,
  handleNew,
  handleTransactionIdBlur,
  isSubmitting,
  editingTransaction,
  setLastAmountSource,
  bankAccounts,
  projects,
  selectedTransactionType,
  errors,
}: TransactionFormProps) {
  const { control, register, watch, setValue } = form;

  return (
    <form onSubmit={onSubmit} className="space-y-0.5">
      <input type="hidden" {...register('payee')} />

      <Controller
        name="date"
        control={control}
        render={({ field }) => {
          const dateId = `date-${field.name}`;
          return (
            <div className="space-y-0.5">
              <Label htmlFor={dateId} className="text-[10px] font-semibold text-slate-600">Date</Label>
              <div className="h-7 bg-white border border-slate-200/80 rounded-lg focus-within:ring-2 focus-within:ring-violet-500/30 focus-within:border-violet-300">
                <SmartDatePicker
                  id={dateId}
                  value={field.value}
                  onChange={(val) => field.onChange(val instanceof Date ? val : (val ? new Date(val) : new Date()))}
                  placeholder="Pick a date"
                  inputClassName="h-full w-full bg-transparent border-0 text-[11px] text-slate-900 placeholder:text-slate-400 focus-visible:ring-0 px-2.5"
                  returnDate={true}
                />
              </div>
            </div>
          );
        }}
      />

      <div className="space-y-0.5">
        <Label htmlFor="transactionId" className="text-[10px] font-semibold text-slate-600">
          Transaction ID
        </Label>
        <Input
          id="transactionId"
          {...register("transactionId")}
          onBlur={handleTransactionIdBlur}
          className="h-7 bg-white/80 border-slate-200/80 text-[11px] text-slate-900 placeholder:text-slate-400 focus-visible:ring-violet-500/30 focus-visible:border-violet-300 px-2.5 backdrop-blur-[14px]"
        />
      </div>

      <Controller
        name="incomeAmount"
        control={control}
        render={({ field }) => {
          const incomeAmountId = `incomeAmount-${field.name}`;
          return (
            <div className="space-y-0.5">
              <Label htmlFor={incomeAmountId} className="text-[10px] font-semibold text-slate-600">Credit (Income)</Label>
              <Input
                id={incomeAmountId}
                type="number"
                step="0.01"
                value={field.value === undefined || field.value === null || Number(field.value) === 0 ? '' : field.value}
                onChange={(e) => {
                  setLastAmountSource('income');
                  const value = e.target.value;
                  field.onChange(value === '' ? '' : Number(value));
                }}
                className="h-7 bg-white/80 border-slate-200/80 text-[11px] text-slate-900 placeholder:text-slate-400 focus-visible:ring-violet-500/30 focus-visible:border-violet-300 px-2.5 backdrop-blur-[14px]"
                placeholder="0.00"
              />
            </div>
          );
        }}
      />

      <Controller
        name="expenseAmount"
        control={control}
        render={({ field }) => {
          const expenseAmountId = `expenseAmount-${field.name}`;
          return (
            <div className="space-y-0.5">
              <Label htmlFor={expenseAmountId} className="text-[10px] font-semibold text-slate-600">Debit (Expense)</Label>
              <Input
                id={expenseAmountId}
                type="number"
                step="0.01"
                value={field.value === undefined || field.value === null || Number(field.value) === 0 ? '' : field.value}
                onChange={(e) => {
                  setLastAmountSource('expense');
                  const value = e.target.value;
                  field.onChange(value === '' ? '' : Number(value));
                }}
                className="h-7 bg-white/80 border-slate-200/80 text-[11px] text-slate-900 placeholder:text-slate-400 focus-visible:ring-violet-500/30 focus-visible:border-violet-300 px-2.5 backdrop-blur-[14px]"
                placeholder="0.00"
              />
            </div>
          );
        }}
      />

      <Controller
        name="paymentMethod"
        control={control}
        render={({ field }) => {
          const paymentMethodId = `paymentMethod-${field.name}`;
          return (
            <div className="space-y-0.5">
              <Label htmlFor={paymentMethodId} className="text-[10px] font-semibold text-slate-600">Payment Method</Label>
              <div className="h-7 bg-white/80 border border-slate-200/80 rounded-lg focus-within:ring-2 focus-within:ring-violet-500/30 focus-within:border-violet-300 backdrop-blur-[14px]">
                <CustomDropdown
                  id={paymentMethodId}
                  options={[
                    { value: 'Cash', label: 'Cash' },
                    ...bankAccounts.map((acc) => ({
                      value: acc.id,
                      label: `${acc.bankName} (...${acc.accountNumber.slice(-4)})`,
                    })),
                  ]}
                  value={field.value === 'Cash' ? 'Cash' : (bankAccounts.find((acc) => acc.id === watch('bankAccountId'))?.id ?? null)}
                  onChange={(value) => {
                    if (value === 'Cash') {
                      setValue('paymentMethod', 'Cash');
                      setValue('bankAccountId', undefined);
                    } else {
                      if (!value) {
                        setValue('paymentMethod', 'Cash');
                        setValue('bankAccountId', undefined);
                        field.onChange('Cash');
                        return;
                      }
                      const account = bankAccounts.find((acc) => acc.id === value);
                      setValue('paymentMethod', account?.bankName || '');
                      setValue('bankAccountId', value);
                    }
                    field.onChange(value ?? 'Cash');
                  }}
                  placeholder="Select"
                  inputClassName="h-full w-full bg-transparent border-0 text-[11px] text-slate-900 placeholder:text-slate-400 focus-visible:ring-0 px-2.5"
                  iconClassName="text-slate-500 ml-2"
                />
              </div>
            </div>
          );
        }}
      />

      <div className="space-y-0.5">
        <Label htmlFor="description" className="text-[10px] font-semibold text-slate-600">Description</Label>
        <Controller 
          name="description" 
          control={control} 
          render={({ field }) => (
            <Input 
              id="description" 
              placeholder="Brief description..." 
              className="h-7 bg-white/80 border-slate-200/80 text-[11px] text-slate-900 placeholder:text-slate-400 focus-visible:ring-violet-500/30 focus-visible:border-violet-300 px-2.5 backdrop-blur-[14px]" 
              {...field} 
            />
          )} 
        />
      </div>

      {errors.amount && (
        <div className="text-xs text-rose-400">
          {errors.amount.message}
        </div>
      )}

      <input type="hidden" {...register('amount', { valueAsNumber: true })} />

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2 w-full">
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleNew}
            className="flex-1 h-7 text-[11px] font-semibold"
          >
            <RefreshCw className="mr-2 h-3 w-3" />New
          </Button>
          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="flex-1 h-7 text-[11px] font-semibold"
          >
            {isSubmitting ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
            {editingTransaction ? 'Update' : 'Save'}
          </Button>
        </div>
      </div>
    </form>
  );
});
