"use client";

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  getBankAccountsRealtime, 
  addBankAccount, 
  updateBankAccount, 
  deleteBankAccount,
  getAllPayments 
} from '@/lib/firestore';
import type { BankAccount, Payment } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Trash2, Edit, Download, Save, X } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { toTitleCase } from '@/lib/utils';

const bankAccountSchema = z.object({
  accountHolderName: z.string().min(1, "Account holder name is required"),
  accountNumber: z.string().min(1, "Account number is required"),
  bankName: z.string().min(1, "Bank name is required"),
  ifscCode: z.string().min(1, "IFSC code is required"),
  branchName: z.string().min(1, "Branch name is required"),
});

type BankAccountFormData = z.infer<typeof bankAccountSchema>;

export default function BankAccountsPage() {
  const { toast } = useToast();
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BankAccountFormData>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: {
      accountHolderName: '',
      accountNumber: '',
      bankName: '',
      ifscCode: '',
      branchName: '',
    },
  });

  // Load bank accounts
  useEffect(() => {
    const unsubscribe = getBankAccountsRealtime(
      (accounts) => {
        setBankAccounts(accounts);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading bank accounts:', error);
        toast({
          title: "Error",
          description: "Failed to load bank accounts",
          variant: "destructive",
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
    // Removed toast from dependencies - it's stable from useToast hook
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    } else {
      reset({
        accountHolderName: '',
        accountNumber: '',
        bankName: '',
        ifscCode: '',
        branchName: '',
      });
    }
  }, [editingAccount, reset]);

  const onSubmit = async (data: BankAccountFormData) => {
    try {
      const accountData = {
        accountHolderName: toTitleCase(data.accountHolderName),
        accountNumber: data.accountNumber.trim(),
        bankName: toTitleCase(data.bankName),
        ifscCode: data.ifscCode.toUpperCase().trim(),
        branchName: toTitleCase(data.branchName),
      };

      if (editingAccount) {
        await updateBankAccount(editingAccount.id, accountData);
        toast({
          title: "Success",
          description: "Bank account updated successfully",
        });
      } else {
        // Check if account number already exists
        const existingAccount = bankAccounts.find(
          (acc) => acc.accountNumber === accountData.accountNumber
        );
        if (existingAccount) {
          toast({
            title: "Error",
            description: "Account number already exists",
            variant: "destructive",
          });
          return;
        }

        await addBankAccount(accountData);
        toast({
          title: "Success",
          description: "Bank account added successfully",
        });
      }

      setIsDialogOpen(false);
      setEditingAccount(null);
      reset();
    } catch (error: any) {
      console.error('Error saving bank account:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save bank account",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (account: BankAccount) => {
    try {
      await deleteBankAccount(account.id);
      toast({
        title: "Success",
        description: "Bank account deleted successfully",
      });
    } catch (error: any) {
      console.error('Error deleting bank account:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete bank account",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account);
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditingAccount(null);
    setIsDialogOpen(true);
  };

  const handleImportFromRTGS = async () => {
    setIsImporting(true);
    try {
      // Get all payments
      const payments = await getAllPayments();
      
      // Filter RTGS payments and extract unique bank accounts
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
          // Only add if not already in our bank accounts
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
            await addBankAccount({
              accountHolderName: toTitleCase(accountData.accountHolderName || 'Unknown'),
              accountNumber: accountData.accountNumber,
              bankName: toTitleCase(accountData.bankName || ''),
              ifscCode: accountData.ifscCode.toUpperCase() || '',
              branchName: toTitleCase(accountData.branchName || ''),
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
        description: `Imported ${savedCount} bank account(s). ${errorCount > 0 ? `${errorCount} failed.` : ''}`,
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
              <CardTitle>Bank Accounts Management</CardTitle>
              <CardDescription>
                Manage bank accounts with account holder name, account number, bank, IFSC, and branch
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
                      No bank accounts found. Click "Add Account" to add one.
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
                                <AlertDialogTitle>Delete Bank Account</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this bank account? This action cannot be undone.
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
              {editingAccount ? 'Edit Bank Account' : 'Add Bank Account'}
            </DialogTitle>
            <DialogDescription>
              Enter the bank account details below.
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
                />
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
                <Input
                  id="bankName"
                  {...register('bankName')}
                  placeholder="Enter bank name"
                />
                {errors.bankName && (
                  <p className="text-sm text-destructive">
                    {errors.bankName.message}
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
                  placeholder="Enter IFSC code"
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

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="branchName">
                  Branch Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="branchName"
                  {...register('branchName')}
                  placeholder="Enter branch name"
                />
                {errors.branchName && (
                  <p className="text-sm text-destructive">
                    {errors.branchName.message}
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
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {editingAccount ? 'Update' : 'Save'}
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

