"use client";

import React from "react";
import { Controller, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedSwitch } from "@/components/ui/segmented-switch";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { InputWithIcon } from "./input-with-icon";
import { FileText, Percent, Landmark, Loader2, Save, RefreshCw } from "lucide-react";
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
  isRecurring: boolean;
  recurringFrequency?: "daily" | "weekly" | "monthly" | "yearly";
  nextDueDate?: Date;
  mill?: string;
  expenseNature?: string;
  isCalculated: boolean;
  quantity?: number;
  rate?: number;
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
  isAdvanced: boolean;
  setIsAdvanced: (value: boolean) => void;
  isCalculated: boolean;
  setIsCalculated: (value: boolean) => void;
  isRecurring: boolean;
  setIsRecurring: (value: boolean) => void;
  setLastAmountSource: (source: 'income' | 'expense' | null) => void;
  bankAccounts: BankAccount[];
  projects: Project[];
  selectedTransactionType: "Income" | "Expense";
  errors: UseFormReturn<TransactionFormValues>["formState"]["errors"];
}

export const TransactionForm = ({
  form,
  onSubmit,
  handleNew,
  handleTransactionIdBlur,
  isSubmitting,
  editingTransaction,
  isAdvanced,
  setIsAdvanced,
  isCalculated,
  setIsCalculated,
  isRecurring,
  setIsRecurring,
  setLastAmountSource,
  bankAccounts,
  projects,
  selectedTransactionType,
  errors,
}: TransactionFormProps) => {
  const { control, register, watch, setValue } = form;

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" {...register('payee')} />

      <div className="grid grid-cols-2 gap-2">
        <Controller
          name="date"
          control={control}
          render={({ field }) => {
            const dateId = `date-${field.name}`;
            return (
              <div className="space-y-0.5">
                <Label htmlFor={dateId} className="text-xs">Date</Label>
                <SmartDatePicker
                  id={dateId}
                  value={field.value}
                  onChange={(val) => field.onChange(val instanceof Date ? val : (val ? new Date(val) : new Date()))}
                  placeholder="Pick a date"
                  inputClassName="h-7 text-xs"
                  returnDate={true}
                />
              </div>
            );
          }}
        />

        <div className="space-y-0.5">
          <Label htmlFor="transactionId" className="text-xs">
            Transaction ID
          </Label>
          <InputWithIcon icon={<FileText className="h-3 w-3 text-muted-foreground" />}>
            <Input
              id="transactionId"
              {...register("transactionId")}
              onBlur={handleTransactionIdBlur}
              className="h-7 text-xs pl-8"
            />
          </InputWithIcon>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Controller
          name="incomeAmount"
          control={control}
          render={({ field }) => {
            const incomeAmountId = `incomeAmount-${field.name}`;
            return (
              <div className="space-y-0.5">
                <Label htmlFor={incomeAmountId} className="text-xs text-emerald-700">Credit Amount (Income)</Label>
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
                  className="h-7 text-xs border-emerald-200 focus-visible:ring-emerald-500"
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
                <Label htmlFor={expenseAmountId} className="text-xs text-rose-700">Debit Amount (Expense)</Label>
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
                  className="h-7 text-xs border-rose-200 focus-visible:ring-rose-500"
                  placeholder="0.00"
                />
              </div>
            );
          }}
        />
      </div>

      <Controller
        name="paymentMethod"
        control={control}
        render={({ field }) => {
          const paymentMethodId = `paymentMethod-${field.name}`;
          return (
            <div className="space-y-0.5">
              <Label htmlFor={paymentMethodId} className="text-xs">Payment Method</Label>
              <CustomDropdown
                id={paymentMethodId}
                options={[
                  { value: 'Cash', label: 'Cash' },
                  ...bankAccounts.map((acc) => ({
                    value: acc.id,
                    label: `${acc.bankName} (...${acc.accountNumber.slice(-4)})`,
                  })),
                ]}
                value={field.value === 'Cash' ? 'Cash' : bankAccounts.find((acc) => acc.id === watch('bankAccountId'))?.id}
                onChange={(value) => {
                  if (value === 'Cash') {
                    setValue('paymentMethod', 'Cash');
                    setValue('bankAccountId', undefined);
                  } else {
                    const account = bankAccounts.find((acc) => acc.id === value);
                    setValue('paymentMethod', account?.bankName || '');
                    setValue('bankAccountId', value);
                  }
                  field.onChange(value);
                }}
                placeholder="Select Payment Method"
                inputClassName="h-7 text-xs"
              />
            </div>
          );
        }}
      />

      <div className="space-y-0.5">
        <Label htmlFor="description" className="text-xs">Description</Label>
        <Controller name="description" control={control} render={({ field }) => <Input id="description" placeholder="Brief description of the transaction..." className="h-7 text-xs" {...field} />} />
      </div>

      {errors.amount && (
        <div className="text-xs text-destructive">
          {errors.amount.message}
        </div>
      )}

      <input type="hidden" {...register('amount', { valueAsNumber: true })} />

      {isAdvanced && (
        <div className="border-t pt-2 mt-2">
          <h3 className="text-xs font-semibold mb-1">Advanced Options</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <Label htmlFor="status" className="text-xs">Status</Label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <CustomDropdown
                    options={[
                      { value: "Paid", label: "Paid" },
                      { value: "Pending", label: "Pending" },
                      { value: "Overdue", label: "Overdue" }
                    ]}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select Status"
                    inputClassName="h-7 text-xs"
                  />
                )}
              />
            </div>

            <div className="space-y-0.5">
              <Label htmlFor="taxAmount" className="text-xs">Tax Amount</Label>
              <Controller
                name="taxAmount"
                control={control}
                render={({ field }) => (
                  <InputWithIcon icon={<Percent className="h-3 w-3 text-muted-foreground" />}>
                    <Input id="taxAmount" type="number" {...field} className="h-7 text-xs pl-8" />
                  </InputWithIcon>
                )}
              />
            </div>

            <div className="space-y-0.5">
              <Label htmlFor="cdAmount" className="text-xs">CD Amount</Label>
              <Controller
                name="cdAmount"
                control={control}
                render={({ field }) => (
                  <InputWithIcon icon={<Percent className="h-3 w-3 text-muted-foreground" />}>
                    <Input id="cdAmount" type="number" {...field} className="h-7 text-xs pl-8" />
                  </InputWithIcon>
                )}
              />
            </div>

            {selectedTransactionType === 'Expense' && (
              <Controller
                name="expenseType"
                control={control}
                render={({ field }) => {
                  const expenseTypeId = `expenseType-${field.name}`;
                  return (
                    <div className="space-y-0.5">
                      <Label htmlFor={expenseTypeId} className="text-xs">Expense Type</Label>
                      <CustomDropdown
                        id={expenseTypeId}
                        options={[
                          { value: "Personal", label: "Personal" },
                          { value: "Business", label: "Business" }
                        ]}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select Expense Type"
                        inputClassName="h-7 text-xs"
                      />
                    </div>
                  );
                }}
              />
            )}

            <div className="space-y-0.5">
              <Label htmlFor="mill" className="text-xs">Mill</Label>
              <Controller
                name="mill"
                control={control}
                render={({ field }) => (
                  <InputWithIcon icon={<Landmark className="h-3 w-3 text-muted-foreground" />}>
                    <Input id="mill" {...field} className="h-7 text-xs pl-8" />
                  </InputWithIcon>
                )}
              />
            </div>
            
            <div className="space-y-0.5">
              <Label htmlFor="projectId" className="text-xs">Project</Label>
              <Controller
                name="projectId"
                control={control}
                render={({ field }) => (
                  <CustomDropdown
                    id="projectId"
                    options={[
                      { value: 'none', label: 'None' },
                      ...projects.map(project => ({ value: project.id, label: project.name }))
                    ]}
                    value={field.value || 'none'}
                    onChange={field.onChange}
                    placeholder="Select Project"
                    inputClassName="h-7 text-xs"
                  />
                )}
              />
            </div>
          </div>
        </div>
      )}

      {isCalculated && (
        <div className="border-t pt-2 mt-2">
          <h3 className="text-xs font-semibold mb-1">Calculation</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <Label htmlFor="quantity" className="text-xs">Quantity</Label>
              <Controller name="quantity" control={control} render={({ field }) => <Input id="quantity" type="number" {...field} className="h-7 text-xs" />} />
            </div>

            <div className="space-y-0.5">
              <Label htmlFor="expense-rate" className="text-xs">Rate</Label>
              <Controller name="rate" control={control} render={({ field }) => <Input id="expense-rate" type="number" {...field} className="h-7 text-xs" />} />
            </div>
          </div>
        </div>
      )}

      {isRecurring && (
        <div className="border-t pt-2 mt-2">
          <h3 className="text-xs font-semibold mb-1">Recurring Details</h3>
          <div className="grid grid-cols-2 gap-2">
            <Controller name="recurringFrequency" control={control} render={({ field }) => {
              const frequencyId = `recurringFrequency-${field.name}`;
              return (
                <div className="space-y-0.5">
                  <Label htmlFor={frequencyId} className="text-xs">Frequency</Label>
                  <CustomDropdown
                    id={frequencyId}
                    options={[
                      { value: "daily", label: "Daily" },
                      { value: "weekly", label: "Weekly" },
                      { value: "monthly", label: "Monthly" },
                      { value: "yearly", label: "Yearly" }
                    ]}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select Frequency"
                    inputClassName="h-7 text-xs"
                  />
                </div>
              );
            }} />

            <Controller name="nextDueDate" control={control} render={({ field }) => {
              const nextDueDateId = `nextDueDate-${field.name}`;
              return (
                <div className="space-y-0.5">
                  <Label htmlFor={nextDueDateId} className="text-xs">Next Due Date</Label>
                  <SmartDatePicker
                    id={nextDueDateId}
                    value={field.value}
                    onChange={(val) => field.onChange(val instanceof Date ? val : (val ? new Date(val) : new Date()))}
                    placeholder="Pick a date"
                    inputClassName="h-7 text-xs"
                    returnDate={true}
                  />
                </div>
              );
            }} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SegmentedSwitch 
            id="isAdvanced" 
            checked={isAdvanced} 
            onCheckedChange={setIsAdvanced}
            leftLabel="Off"
            rightLabel="On"
            className="w-32"
          />
          <Label htmlFor="isAdvanced" className="text-sm font-medium leading-none">
            Advanced
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <SegmentedSwitch 
            id="isCalculated" 
            checked={isCalculated} 
            onCheckedChange={setIsCalculated}
            leftLabel="Off"
            rightLabel="On"
            className="w-32"
          />
          <Label htmlFor="isCalculated" className="text-sm font-medium leading-none">
            Calculate
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <SegmentedSwitch 
            id="isRecurring" 
            checked={isRecurring} 
            onCheckedChange={setIsRecurring}
            leftLabel="Off"
            rightLabel="On"
            className="w-32"
          />
          <Label htmlFor="isRecurring" className="text-sm font-medium leading-none">
            Recurring
          </Label>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Button type="button" variant="ghost" onClick={handleNew}><RefreshCw className="mr-2 h-4 w-4" />New</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {editingTransaction ? 'Update' : 'Save'}
          </Button>
        </div>
      </div>
    </form>
  );
};

