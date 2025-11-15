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
import { useSupplierData } from '@/hooks/use-supplier-data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Trash2, Edit, Download, Save, X } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { CustomDropdown } from '@/components/ui/custom-dropdown';
import { toTitleCase } from '@/lib/utils';
import { useMemo } from 'react';

const supplierBankAccountSchema = z.object({
  accountHolderName: z.string().min(1, "Account holder name is required"),
  accountNumber: z.string().min(1, "Account number is required"),
  bankName: z.string().min(1, "Bank name is required"),
  ifscCode: z.string().min(1, "IFSC code is required"),
  branchName: z.string().min(1, "Branch name is required"),
});

type SupplierBankAccountFormData = z.infer<typeof supplierBankAccountSchema>;


export default function SupplierBankAccountsPage() {
  const { toast } = useToast();
  const { banks, bankBranches } = useSupplierData();
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedBank, setSelectedBank] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);

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

  // Load supplier bank accounts from separate collection
  useEffect(() => {
    const unsubscribe = getSupplierBankAccountsRealtime(
      (accounts) => {
        setBankAccounts(accounts);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading supplier bank accounts:', error);
        toast({
          title: "Error",
          description: "Failed to load supplier bank accounts",
          variant: "destructive",
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [toast]);

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
      console.error('Error adding bank:', error);
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

      // Don't close form - keep it open for next entry
      // Only close dialog if editing (not for inline form)
      if (editingAccount && !showAddForm) {
        setIsDialogOpen(false);
        setEditingAccount(null);
      }
      
      // Reset form but keep it open
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
      console.error('Error saving supplier bank account:', error);
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
      console.error('Error deleting supplier bank account:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete supplier bank account",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account);
    setShowAddForm(false);
    setIsDialogOpen(true);
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
          console.error('Error importing account:', accountData.accountNumber, error);
          errorCount++;
        }
      }

      toast({
        title: "Import Complete",
        description: `Imported ${savedCount} supplier bank account(s). ${errorCount > 0 ? `${errorCount} failed.` : ''}`,
      });
    } catch (error: any) {
      console.error('Error importing from RTGS:', error);
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
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Supplier/Customer Bank Accounts</CardTitle>
              <CardDescription>
                Manage bank accounts for suppliers and customers. These accounts are used in RTGS payments.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleImportFromRTGS}
                disabled={isImporting}
                variant="outline"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Import from RTGS
                  </>
                )}
              </Button>
              <Button onClick={handleAddNew}>
                <Plus className="mr-2 h-4 w-4" />
                Add Account
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Inline Add Form */}
          {showAddForm && (
            <Card className="mb-6 border-2 border-primary/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Add New Supplier Bank Account</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelAdd}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="accountHolderName">
                        Account Holder Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="accountHolderName"
                        {...register('accountHolderName')}
                        placeholder="Enter account holder name"
                      />
                      {errors.accountHolderName && (
                        <p className="text-sm text-destructive">
                          {errors.accountHolderName.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="accountNumber">
                        Account Number <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="accountNumber"
                        {...register('accountNumber')}
                        placeholder="Enter account number"
                        className="font-mono"
                        onBlur={handleAccountNumberBlur}
                      />
                      {existingAccountInfo && !editingAccount && (
                        <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-md">
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            <span className="font-medium">Account exists!</span> Details have been auto-filled.
                          </p>
                        </div>
                      )}
                      {errors.accountNumber && (
                        <p className="text-sm text-destructive">
                          {errors.accountNumber.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bankName">
                        Bank Name <span className="text-destructive">*</span>
                      </Label>
                      <CustomDropdown
                        options={bankOptions}
                        value={watchedBankName}
                        onChange={handleBankSelect}
                        onAdd={handleAddBank}
                        placeholder="Select or add bank"
                      />
                      {errors.bankName && (
                        <p className="text-sm text-destructive">
                          {errors.bankName.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="branchName">
                        Branch Name <span className="text-destructive">*</span>
                      </Label>
                      <CustomDropdown
                        options={branchOptions.map(opt => ({ value: opt.value, label: opt.label }))}
                        value={watchedBranchName}
                        onChange={handleBranchSelect}
                        onAdd={handleAddBranch}
                        placeholder="Select or add branch"
                      />
                      {errors.branchName && (
                        <p className="text-sm text-destructive">
                          {errors.branchName.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ifscCode">
                        IFSC Code <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="ifscCode"
                        {...register('ifscCode')}
                        placeholder="Auto-filled or enter IFSC code"
                        className="font-mono uppercase"
                        onChange={(e) => {
                          e.target.value = e.target.value.toUpperCase();
                          register('ifscCode').onChange(e);
                        }}
                      />
                      {errors.ifscCode && (
                        <p className="text-sm text-destructive">
                          {errors.ifscCode.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancelAdd}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {existingAccountInfo ? 'Updating...' : 'Saving...'}
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          {existingAccountInfo ? 'Update Account' : 'Save Account'}
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <ScrollArea className="h-[calc(100vh-300px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Holder Name</TableHead>
                  <TableHead>Account Number</TableHead>
                  <TableHead>Bank Name</TableHead>
                  <TableHead>IFSC Code</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bankAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No supplier bank accounts found. Click "Add Account" to add one or "Import from RTGS" to import from existing RTGS payments.
                    </TableCell>
                  </TableRow>
                ) : (
                  bankAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">
                        {account.accountHolderName}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {account.accountNumber}
                      </TableCell>
                      <TableCell>{account.bankName}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {account.ifscCode}
                      </TableCell>
                      <TableCell>{account.branchName}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(account)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4 text-destructive" />
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
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? 'Edit Supplier Bank Account' : 'Add Supplier Bank Account'}
            </DialogTitle>
            <DialogDescription>
              Enter the supplier/customer bank account details below.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accountHolderName">
                  Account Holder Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="accountHolderName"
                  {...register('accountHolderName')}
                  placeholder="Enter account holder name"
                />
                {errors.accountHolderName && (
                  <p className="text-sm text-destructive">
                    {errors.accountHolderName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountNumber">
                  Account Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="accountNumber"
                  {...register('accountNumber')}
                  placeholder="Enter account number"
                  className="font-mono"
                  onBlur={handleAccountNumberBlur}
                />
                {existingAccountInfo && !editingAccount && (
                  <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-md">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <span className="font-medium">Account exists!</span> Details have been auto-filled.
                    </p>
                  </div>
                )}
                {errors.accountNumber && (
                  <p className="text-sm text-destructive">
                    {errors.accountNumber.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bankName">
                  Bank Name <span className="text-destructive">*</span>
                </Label>
                <CustomDropdown
                  options={bankOptions}
                  value={watchedBankName}
                  onChange={handleBankSelect}
                  onAdd={handleAddBank}
                  placeholder="Select or add bank"
                />
                {errors.bankName && (
                  <p className="text-sm text-destructive">
                    {errors.bankName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="branchName">
                  Branch Name <span className="text-destructive">*</span>
                </Label>
                <CustomDropdown
                  options={branchOptions.map(opt => ({ value: opt.value, label: opt.label }))}
                  value={watchedBranchName}
                  onChange={handleBranchSelect}
                  onAdd={handleAddBranch}
                  placeholder="Select or add branch"
                />
                {errors.branchName && (
                  <p className="text-sm text-destructive">
                    {errors.branchName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ifscCode">
                  IFSC Code <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ifscCode"
                  {...register('ifscCode')}
                  placeholder="Auto-filled or enter IFSC code"
                  className="font-mono uppercase"
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase();
                    register('ifscCode').onChange(e);
                  }}
                />
                {errors.ifscCode && (
                  <p className="text-sm text-destructive">
                    {errors.ifscCode.message}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setEditingAccount(null);
                  reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {editingAccount || existingAccountInfo ? 'Updating...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {editingAccount || existingAccountInfo ? 'Update' : 'Save'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

