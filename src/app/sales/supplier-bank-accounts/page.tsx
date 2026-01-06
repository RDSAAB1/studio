"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  getSupplierBankAccountsRealtime, 
  addSupplierBankAccount, 
  updateSupplierBankAccount, 
  deleteSupplierBankAccount,
  getAllPayments,
  addBank,
  addBankBranch
} from '@/lib/firestore';
import type { BankAccount, Payment } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { useGlobalData } from '@/contexts/global-data-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Trash2, Edit, Download, Save, X, Search } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { CustomDropdown } from '@/components/ui/custom-dropdown';
import { toTitleCase } from '@/lib/utils';
import { useMemo } from 'react';

interface SupplierBankAccountsPageProps {
  embedded?: boolean;
}

const supplierBankAccountSchema = z.object({
  accountHolderName: z.string().min(1, "Account holder name is required"),
  accountNumber: z.string().min(1, "Account number is required"),
  bankName: z.string().min(1, "Bank name is required"),
  ifscCode: z.string().min(1, "IFSC code is required"),
  branchName: z.string().min(1, "Branch name is required"),
});

type SupplierBankAccountFormData = z.infer<typeof supplierBankAccountSchema>;


export default function SupplierBankAccountsPage({ embedded = false }: SupplierBankAccountsPageProps = {}) {
  const { toast } = useToast();
  // Use global data context - NO duplicate listeners
  const globalData = useGlobalData();
  const banks = globalData.banks;
  const bankBranches = globalData.bankBranches;
  // ✅ FIX: Initialize state from globalData immediately to prevent data loss on remount
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(globalData.supplierBankAccounts);
  const [loading, setLoading] = useState(false); // ✅ FIX: Start with false since we have initial data
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedBank, setSelectedBank] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(true); // Always show form by default
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('all'); // 'all', 'name', 'account', 'bank', 'branch', 'ifsc'

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SupplierBankAccountFormData>({
    resolver: zodResolver(supplierBankAccountSchema),
    defaultValues: {
      accountHolderName: '',
      accountNumber: '',
      bankName: '',
      ifscCode: '',
      branchName: '',
    },
  });

  const watchedBankName = watch('bankName');
  const watchedBranchName = watch('branchName');
  const watchedAccountNumber = watch('accountNumber');
  
  // State to track if account exists
  const [existingAccountInfo, setExistingAccountInfo] = useState<BankAccount | null>(null);

  // Bank options for dropdown
  const bankOptions = useMemo(() => {
    if (!Array.isArray(banks)) return [];
    return banks.map((bank: any) => ({
      value: bank.name,
      label: toTitleCase(bank.name)
    }));
  }, [banks]);

  // Branch options filtered by selected bank
  const branchOptions = useMemo(() => {
    if (!watchedBankName || !Array.isArray(bankBranches)) return [];
    const uniqueBranches = new Map<string, { value: string; label: string; ifsc: string }>();
    bankBranches
      .filter((branch: any) => branch.bankName === watchedBankName)
      .forEach((branch: any) => {
        if (!uniqueBranches.has(branch.branchName)) {
          uniqueBranches.set(branch.branchName, { 
            value: branch.branchName, 
            label: toTitleCase(branch.branchName),
            ifsc: branch.ifscCode || ''
          });
        }
      });
    return Array.from(uniqueBranches.values());
  }, [watchedBankName, bankBranches]);

  // ✅ FIX: Sync from globalData to prevent data loss on navigation
  useEffect(() => {
    // Always sync from globalData on mount and when it changes
    setBankAccounts(globalData.supplierBankAccounts);
    setLoading(false);
  }, [globalData.supplierBankAccounts]);
  
  // ✅ OPTIMIZED: Keep realtime listener for updates (non-blocking)
  useEffect(() => {
    const unsubscribe = getSupplierBankAccountsRealtime(
      (accounts) => {
        setBankAccounts(accounts);
      },
      (error) => {
        // Silent fail - data will come from globalData
      }
    );

    return () => unsubscribe();
  }, []); // Removed toast from dependencies to prevent re-subscriptions

  // Reset form when editing account changes
  useEffect(() => {
    if (editingAccount) {
      reset({
        accountHolderName: editingAccount.accountHolderName || '',
        accountNumber: editingAccount.accountNumber || '',
        bankName: editingAccount.bankName || '',
        ifscCode: editingAccount.ifscCode || '',
        branchName: editingAccount.branchName || '',
      });
      setSelectedBank(editingAccount.bankName || '');
      setSelectedBranch(editingAccount.branchName || '');
    } else {
      reset({
        accountHolderName: '',
        accountNumber: '',
        bankName: '',
        ifscCode: '',
        branchName: '',
      });
      setSelectedBank('');
      setSelectedBranch('');
      setExistingAccountInfo(null); // Clear existing account info when adding new
    }
  }, [editingAccount, reset]);

  // Auto-fill IFSC when branch is selected
  useEffect(() => {
    if (watchedBranchName && branchOptions.length > 0) {
      const selectedBranchOption = branchOptions.find(opt => opt.value === watchedBranchName);
      if (selectedBranchOption && selectedBranchOption.ifsc) {
        setValue('ifscCode', selectedBranchOption.ifsc.toUpperCase());
      }
    }
  }, [watchedBranchName, branchOptions, setValue]);

  // Filter bank accounts based on search term and selected filter
  const filteredBankAccounts = useMemo(() => {
    if (!searchTerm.trim()) {
      return bankAccounts;
    }
    
    const searchLower = searchTerm.toLowerCase().trim();
    return bankAccounts.filter((account) => {
      const accountHolderName = (account.accountHolderName || '').toLowerCase();
      const accountNumber = (account.accountNumber || '').toLowerCase();
      const bankName = (account.bankName || '').toLowerCase();
      const branchName = (account.branchName || '').toLowerCase();
      const ifscCode = (account.ifscCode || '').toLowerCase();
      
      // Search in specific field based on filter
      switch (searchFilter) {
        case 'name':
          return accountHolderName.includes(searchLower);
        case 'account':
          return accountNumber.includes(searchLower);
        case 'bank':
          return bankName.includes(searchLower);
        case 'branch':
          return branchName.includes(searchLower);
        case 'ifsc':
          return ifscCode.includes(searchLower);
        case 'all':
        default:
          return (
            accountHolderName.includes(searchLower) ||
            accountNumber.includes(searchLower) ||
            bankName.includes(searchLower) ||
            branchName.includes(searchLower) ||
            ifscCode.includes(searchLower)
          );
      }
    });
  }, [bankAccounts, searchTerm, searchFilter]);

  // Handle account number blur - check if account exists in real-time
  const handleAccountNumberBlur = () => {
    if (!editingAccount && watchedAccountNumber && watchedAccountNumber.trim().length > 0) {
      const accountNumber = watchedAccountNumber.trim();
      const existingAccount = bankAccounts.find(
        (acc) => acc.accountNumber === accountNumber
      );
      
      if (existingAccount) {
        setExistingAccountInfo(existingAccount);
        // Auto-fill all fields with existing account data
        setValue('accountHolderName', existingAccount.accountHolderName || '');
        setValue('bankName', existingAccount.bankName || '');
        setValue('branchName', existingAccount.branchName || '');
        setValue('ifscCode', existingAccount.ifscCode || '');
        setSelectedBank(existingAccount.bankName || '');
        setSelectedBranch(existingAccount.branchName || '');
        
        toast({
          title: "Account Already Exists",
          description: `This account number is already saved. Details have been auto-filled.`,
          variant: "default",
        });
      } else {
        setExistingAccountInfo(null);
      }
    } else {
      setExistingAccountInfo(null);
    }
  };

  const handleBankSelect = (bankName: string | null) => {
    const bank = bankName || '';
    setSelectedBank(bank);
    setValue('bankName', bank);
    // Clear branch and IFSC when bank changes
    setValue('branchName', '');
    setValue('ifscCode', '');
    setSelectedBranch('');
  };

  const handleBranchSelect = (branchName: string | null) => {
    const branch = branchName || '';
    setSelectedBranch(branch);
    setValue('branchName', branch);
    // IFSC will be auto-filled by useEffect
  };

  const handleAddBank = async (newBank: string) => {
    try {
      await addBank(newBank);
      handleBankSelect(newBank);
      toast({
        title: "Success",
        description: "Bank added successfully",
      });
    } catch (error: any) {

      toast({
        title: "Error",
        description: error.message || "Failed to add bank",
        variant: "destructive",
      });
    }
  };

  const handleAddBranch = async (newBranchName: string) => {
    if (!watchedBankName) {
      toast({
        title: "Error",
        description: "Please select a bank first",
        variant: "destructive",
      });
      return;
    }
    // Just set the branch name in the form, don't save to bankBranches yet
    // User will need to fill IFSC manually, and it will be saved when the account is saved
    handleBranchSelect(newBranchName);
    toast({
      title: "Branch Added",
      description: "Please fill IFSC code manually",
    });
  };

  const onSubmit = async (data: SupplierBankAccountFormData) => {
    try {
      const accountData = {
        accountHolderName: toTitleCase(data.accountHolderName),
        accountNumber: data.accountNumber.trim(),
        bankName: toTitleCase(data.bankName),
        ifscCode: data.ifscCode.toUpperCase().trim(),
        branchName: toTitleCase(data.branchName),
        accountType: 'Other' as const,
      };

      // If editing existing account or account exists (from blur check), update it
      if (editingAccount || existingAccountInfo) {
        const accountToUpdate = editingAccount || existingAccountInfo;
        if (accountToUpdate) {
          await updateSupplierBankAccount(accountToUpdate.id, accountData);
          toast({
            title: "Success",
            description: "Supplier bank account updated successfully",
          });
        }
      } else {
        // Check if account number already exists (double check)
        const existingAccount = bankAccounts.find(
          (acc) => acc.accountNumber === accountData.accountNumber
        );
        if (existingAccount) {
          // If found during submit, update it instead of showing error
          await updateSupplierBankAccount(existingAccount.id, accountData);
          toast({
            title: "Success",
            description: "Supplier bank account updated successfully",
          });
        } else {
          await addSupplierBankAccount(accountData);
          toast({
            title: "Success",
            description: "Supplier bank account added successfully",
          });
        }
      }

      // Reset form but keep inline form open
      setExistingAccountInfo(null);
      reset({
        accountHolderName: '',
        accountNumber: '',
        bankName: '',
        ifscCode: '',
        branchName: '',
      });
      setSelectedBank('');
      setSelectedBranch('');
    } catch (error: any) {

      toast({
        title: "Error",
        description: error.message || "Failed to save supplier bank account",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (account: BankAccount) => {
    try {
      await deleteSupplierBankAccount(account.id);
      toast({
        title: "Success",
        description: "Supplier bank account deleted successfully",
      });
    } catch (error: any) {

      toast({
        title: "Error",
        description: error.message || "Failed to delete supplier bank account",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account);
    setShowAddForm(true); // open inline form for edit instead of popup
  };

  const handleAddNew = () => {
    setEditingAccount(null);
    setShowAddForm(true);
    setExistingAccountInfo(null);
    reset({
      accountHolderName: '',
      accountNumber: '',
      bankName: '',
      ifscCode: '',
      branchName: '',
    });
    setSelectedBank('');
    setSelectedBranch('');
  };

  const handleCancelAdd = () => {
    setShowAddForm(false);
    setEditingAccount(null);
    setExistingAccountInfo(null);
    reset({
      accountHolderName: '',
      accountNumber: '',
      bankName: '',
      ifscCode: '',
      branchName: '',
    });
    setSelectedBank('');
    setSelectedBranch('');
  };

  const handleImportFromRTGS = async () => {
    setIsImporting(true);
    try {
      // Get all payments
      const payments = await getAllPayments();
      
      // Filter RTGS payments and extract unique supplier bank accounts
      const rtgsPayments = payments.filter(
        (p: Payment) => p.receiptType?.toLowerCase() === 'rtgs' && (p.bankAcNo || p.bankDetails?.acNo)
      );

      const uniqueAccounts = new Map<string, {
        accountHolderName: string;
        accountNumber: string;
        bankName: string;
        ifscCode: string;
        branchName: string;
      }>();

      rtgsPayments.forEach((payment: Payment) => {
        // Check both bankDetails.acNo and bankAcNo fields
        const accountNumber = (payment.bankDetails?.acNo || payment.bankAcNo || '').trim();
        
        if (accountNumber) {
          // Only add if not already in our supplier bank accounts
          const existsInBankAccounts = bankAccounts.some(
            (acc) => acc.accountNumber === accountNumber
          );

          if (!existsInBankAccounts && !uniqueAccounts.has(accountNumber)) {
            uniqueAccounts.set(accountNumber, {
              accountHolderName: payment.supplierDetails?.name || payment.supplierName || '',
              accountNumber: accountNumber,
              bankName: payment.bankDetails?.bank || payment.bankName || '',
              ifscCode: payment.bankDetails?.ifscCode || payment.bankIfsc || '',
              branchName: payment.bankDetails?.branch || payment.bankBranch || '',
            });
          }
        }
      });

      // Save all unique accounts
      let savedCount = 0;
      let errorCount = 0;

      for (const accountData of uniqueAccounts.values()) {
        try {
          // Check if account number already exists
          const existing = bankAccounts.find(
            (acc) => acc.accountNumber === accountData.accountNumber
          );
          
          if (!existing && accountData.accountNumber) {
            await addSupplierBankAccount({
              accountHolderName: toTitleCase(accountData.accountHolderName || 'Unknown'),
              accountNumber: accountData.accountNumber,
              bankName: toTitleCase(accountData.bankName || ''),
              ifscCode: accountData.ifscCode.toUpperCase() || '',
              branchName: toTitleCase(accountData.branchName || ''),
              accountType: 'Other' as const,
            });
            savedCount++;
          }
        } catch (error: any) {

          errorCount++;
        }
      }

      toast({
        title: "Import Complete",
        description: `Imported ${savedCount} supplier bank account(s). ${errorCount > 0 ? `${errorCount} failed.` : ''}`,
      });
    } catch (error: any) {

      toast({
        title: "Error",
        description: error.message || "Failed to import accounts from RTGS payments",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${embedded ? "h-40" : "h-[60vh]"}`}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const containerClass = embedded ? "space-y-4" : "container mx-auto py-4 space-y-4";
  const tableHeightClass = embedded ? "h-[500px]" : "h-[calc(100vh-250px)]";

  return (
    <div className={containerClass}>
      <Card>
        <CardContent className="space-y-3 pt-2 pb-3">
          {/* Top actions row */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-2">
              <Button
                onClick={handleImportFromRTGS}
                disabled={isImporting}
                variant="outline"
                className="h-8 px-3 text-xs"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-3.5 w-3.5" />
                    Import from RTGS
                  </>
                )}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <CustomDropdown
                options={[
                  { value: 'all', label: 'All Fields' },
                  { value: 'name', label: 'Account Holder Name' },
                  { value: 'account', label: 'Account Number' },
                  { value: 'bank', label: 'Bank Name' },
                  { value: 'branch', label: 'Branch Name' },
                  { value: 'ifsc', label: 'IFSC Code' },
                ]}
                value={searchFilter}
                onChange={(value) => setSearchFilter(value || 'all')}
                placeholder="Filter by"
                inputClassName="h-8 text-xs min-w-[140px]"
              />
              <div className="relative min-w-[250px]">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder={
                    searchFilter === 'all' 
                      ? "Search by name, account, bank, branch, IFSC..."
                      : searchFilter === 'name'
                      ? "Search by account holder name..."
                      : searchFilter === 'account'
                      ? "Search by account number..."
                      : searchFilter === 'bank'
                      ? "Search by bank name..."
                      : searchFilter === 'branch'
                      ? "Search by branch name..."
                      : "Search by IFSC code..."
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Form + Table side by side on large screens */}
          <div className="grid gap-3 lg:grid-cols-[28%_72%] items-start">
            {/* Inline Add/Edit Form - compact, always visible */}
            <div className={showAddForm ? '' : 'hidden'}>
              <Card className="border border-primary/30 shadow-sm">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-sm font-semibold">
                    {editingAccount ? 'Edit Bank Account' : 'Add New Bank Account'}
                  </CardTitle>
        </CardHeader>
                <CardContent className="pt-2 pb-3 px-3">
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="accountHolderName" className="text-xs">
                        Account Holder Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="accountHolderName"
                        {...register('accountHolderName')}
                          placeholder="Holder name"
                          className="h-8 text-xs"
                      />
                      {errors.accountHolderName && (
                          <p className="text-[11px] text-destructive">
                          {errors.accountHolderName.message}
                        </p>
                      )}
                    </div>

                      <div className="space-y-1">
                        <Label htmlFor="accountNumber" className="text-xs">
                        Account Number <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="accountNumber"
                        {...register('accountNumber')}
                          placeholder="Account no."
                          className="h-8 text-xs font-mono"
                        onBlur={handleAccountNumberBlur}
                      />
                      {existingAccountInfo && !editingAccount && (
                          <div className="mt-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] text-blue-700 dark:border-blue-800/50 dark:bg-blue-950/30 dark:text-blue-300">
                            <span className="font-medium">Account exists!</span> Details auto-filled.
                        </div>
                      )}
                      {errors.accountNumber && (
                          <p className="text-[11px] text-destructive">
                          {errors.accountNumber.message}
                        </p>
                      )}
                    </div>

                      <div className="space-y-1">
                        <Label htmlFor="bankName" className="text-xs">
                        Bank Name <span className="text-destructive">*</span>
                      </Label>
                      <CustomDropdown
                        options={bankOptions}
                        value={watchedBankName}
                        onChange={handleBankSelect}
                        onAdd={handleAddBank}
                        placeholder="Select or add bank"
                          inputClassName="h-8 text-xs"
                      />
                      {errors.bankName && (
                          <p className="text-[11px] text-destructive">
                          {errors.bankName.message}
                        </p>
                      )}
                    </div>

                      <div className="space-y-1">
                        <Label htmlFor="branchName" className="text-xs">
                        Branch Name <span className="text-destructive">*</span>
                      </Label>
                      <CustomDropdown
                        options={branchOptions.map(opt => ({ value: opt.value, label: opt.label }))}
                        value={watchedBranchName}
                        onChange={handleBranchSelect}
                        onAdd={handleAddBranch}
                        placeholder="Select or add branch"
                          inputClassName="h-8 text-xs"
                      />
                      {errors.branchName && (
                          <p className="text-[11px] text-destructive">
                          {errors.branchName.message}
                        </p>
                      )}
                    </div>

                      <div className="space-y-1">
                        <Label htmlFor="ifscCode" className="text-xs">
                        IFSC Code <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="ifscCode"
                        {...register('ifscCode')}
                          placeholder="IFSC"
                          className="h-8 text-xs font-mono uppercase"
                        onChange={(e) => {
                          e.target.value = e.target.value.toUpperCase();
                          register('ifscCode').onChange(e);
                        }}
                      />
                      {errors.ifscCode && (
                          <p className="text-[11px] text-destructive">
                          {errors.ifscCode.message}
                        </p>
                      )}
                    </div>
                  </div>

                    <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs"
                      onClick={handleCancelAdd}
                    >
                      Cancel
                    </Button>
                      <Button
                        type="submit"
                        size="sm"
                        className="h-8 px-3 text-xs"
                        disabled={isSubmitting}
                      >
                      {isSubmitting ? (
                        <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          {existingAccountInfo ? 'Updating...' : 'Saving...'}
                        </>
                      ) : (
                        <>
                            <Save className="mr-1.5 h-3.5 w-3.5" />
                            {existingAccountInfo ? 'Update' : 'Save'}
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            </div>

            {/* Accounts Table */}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <ScrollArea className="h-[420px]">
                  <div className="overflow-x-auto">
                    <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                          <TableHead className="text-[11px] font-semibold px-2 w-[18%]">Account Holder Name</TableHead>
                          <TableHead className="text-[11px] font-semibold px-2 w-[15%]">Account Number</TableHead>
                          <TableHead className="text-[11px] font-semibold px-2 w-[25%]">Bank Name</TableHead>
                          <TableHead className="text-[11px] font-semibold px-2 w-[12%]">IFSC Code</TableHead>
                          <TableHead className="text-[11px] font-semibold px-2 w-[18%]">Branch</TableHead>
                          <TableHead className="text-right text-[11px] font-semibold px-2 w-[12%]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                        {filteredBankAccounts.length === 0 ? (
                  <TableRow>
                            <TableCell colSpan={6} className="text-center text-[11px] text-muted-foreground py-4">
                              {searchTerm.trim() 
                                ? `No accounts found matching "${searchTerm}". Try a different search term.`
                                : 'No supplier bank accounts found. Use the form to add one or "Import from RTGS" to import from existing RTGS payments.'}
                    </TableCell>
                  </TableRow>
                ) : (
                          filteredBankAccounts.map((account) => (
                            <TableRow key={account.id} className="h-8">
                              <TableCell className="text-[11px] py-1.5 px-2 truncate">
                        {account.accountHolderName}
                      </TableCell>
                              <TableCell className="text-[11px] font-mono py-1.5 px-2 truncate">
                        {account.accountNumber}
                      </TableCell>
                              <TableCell className="text-[11px] py-1.5 px-2 truncate">{account.bankName}</TableCell>
                              <TableCell className="text-[11px] font-mono py-1.5 px-2 truncate">
                        {account.ifscCode}
                      </TableCell>
                              <TableCell className="text-[11px] py-1.5 px-2 truncate">{account.branchName}</TableCell>
                              <TableCell className="text-right py-1.5 px-2">
                              <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                            onClick={() => handleEdit(account)}
                                  title="Edit"
                          >
                                  <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" title="Delete">
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Supplier Bank Account</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this supplier bank account? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(account)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
                  </div>
          </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

