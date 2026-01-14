import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { UseFormSetValue } from "react-hook-form";
import { toTitleCase } from "@/lib/utils";
import type { Account } from "@/lib/definitions";
import {
  getAccountsRealtime,
  addAccount,
  updateAccount,
  deleteAccount,
  updateExpensePayee,
  updateIncomePayee,
  deleteExpensesForPayee,
  deleteIncomesForPayee,
} from "@/lib/firestore";

interface AccountFormData {
  name: string;
  contact: string;
  address: string;
  nature: "" | "Permanent" | "Seasonal";
  category: string;
  subCategory: string;
}

interface UseAccountManagerProps {
  setValue: UseFormSetValue<any>;
  setIsSubmitting: (value: boolean) => void;
  onAccountSelect?: (accountName: string) => void;
  handleAutoFill?: (payeeName: string) => void;
}

export function useAccountManager({
  setValue,
  setIsSubmitting,
  onAccountSelect,
  handleAutoFill,
}: UseAccountManagerProps) {
  const { toast } = useToast();
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isEditAccountOpen, setIsEditAccountOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [newAccount, setNewAccount] = useState<AccountFormData>({
    name: "",
    contact: "",
    address: "",
    nature: "",
    category: "",
    subCategory: "",
  });
  const [editAccount, setEditAccount] = useState<AccountFormData>({
    name: "",
    contact: "",
    address: "",
    nature: "",
    category: "",
    subCategory: "",
  });
  const [accounts, setAccounts] = useState<Map<string, Account>>(new Map());
  const prevSelectedAccountRef = useRef<string | null>(null);
  const prevAccountsRef = useRef<Map<string, Account>>(new Map());
  const isUpdatingRef = useRef(false);

  // Load accounts from Firestore
  useEffect(() => {
    const unsubscribe = getAccountsRealtime(
      (accountList) => {
        const mappedAccounts = new Map<string, Account>();
        accountList.forEach((account) => {
          if (account?.name) {
            const normalizedName = toTitleCase(account.name.trim());
            mappedAccounts.set(normalizedName, account);
          }
        });
        setAccounts(mappedAccounts);
      },
      () => {
        // Error handled silently
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Sync selected account to form fields
  useEffect(() => {
    // Prevent infinite loops
    if (isUpdatingRef.current) return;
    
    // Check if selectedAccount actually changed
    const selectedAccountChanged = selectedAccount !== prevSelectedAccountRef.current;
    
    // Check if accounts Map actually changed (compare size and keys)
    const accountsChanged = accounts.size !== prevAccountsRef.current.size ||
      Array.from(accounts.keys()).some(key => !prevAccountsRef.current.has(key)) ||
      Array.from(prevAccountsRef.current.keys()).some(key => !accounts.has(key));
    
    // Only update if something actually changed
    if (!selectedAccountChanged && !accountsChanged) {
      return;
    }
    
    isUpdatingRef.current = true;
    
    if (selectedAccount) {
      const account = accounts.get(selectedAccount);
      if (account) {
        if (account.contact) setValue("description", account.contact, { shouldValidate: false });
        if (account.nature) setValue("expenseNature", account.nature, { shouldValidate: false });
        if (account.category) setValue("category", account.category, { shouldValidate: false });
        if (account.subCategory) setValue("subCategory", account.subCategory, { shouldValidate: false });
      }
      setValue("payee", selectedAccount, { shouldValidate: true });
      
      // Call callbacks only if selectedAccount actually changed
      if (selectedAccountChanged) {
        if (handleAutoFill) {
          handleAutoFill(selectedAccount);
        }
        if (onAccountSelect) {
          onAccountSelect(selectedAccount);
        }
      }
    } else if (selectedAccountChanged) {
      // Only clear if selectedAccount actually changed to null
      setValue("payee", "", { shouldValidate: true });
    }
    
    // Update refs
    prevSelectedAccountRef.current = selectedAccount;
    prevAccountsRef.current = new Map(accounts);
    
    // Reset flag after state updates
    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 0);
  }, [selectedAccount, accounts, setValue]); // Removed onAccountSelect and handleAutoFill from dependencies

  const handleAddAccount = useCallback(() => {
    setNewAccount({
      name: "",
      contact: "",
      address: "",
      nature: "",
      category: "",
      subCategory: "",
    });
    setIsAddAccountOpen(true);
  }, []);

  const handleSaveNewAccount = useCallback(async () => {
    if (!newAccount.name.trim()) {
      toast({ title: "Error", description: "Please enter an account name", variant: "destructive" });
      return;
    }
    try {
      setIsSubmitting(true);
      const accountData: Account = {
        name: newAccount.name.trim(),
        contact: (newAccount.contact?.trim() || "").length > 0 ? newAccount.contact.trim() : undefined,
        address: (newAccount.address?.trim() || "").length > 0 ? newAccount.address.trim() : undefined,
        nature: newAccount.nature || undefined,
        category: (newAccount.category?.trim() || "").length > 0 ? newAccount.category.trim() : undefined,
        subCategory: (newAccount.subCategory?.trim() || "").length > 0 ? newAccount.subCategory.trim() : undefined,
      };
      await addAccount(accountData);

      const normalized = toTitleCase(newAccount.name.trim());
      setSelectedAccount(normalized);
      setValue("payee", normalized, { shouldValidate: true });
      setIsAddAccountOpen(false);
      setNewAccount({ name: "", contact: "", address: "", nature: "", category: "", subCategory: "" });
      toast({ title: "Success", description: `Account "${normalized}" added successfully.` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to add account", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }, [newAccount, setValue, toast, setIsSubmitting]);

  const handleEditAccount = useCallback(() => {
    if (!selectedAccount) return;
    const account = accounts.get(selectedAccount);
    if (account) {
      setEditAccount({
        name: account.name || "",
        contact: account.contact || "",
        address: account.address || "",
        nature: (account.nature as "Permanent" | "Seasonal" | "") || "",
        category: account.category || "",
        subCategory: account.subCategory || "",
      });
    } else {
      setEditAccount({
        name: selectedAccount,
        contact: "",
        address: "",
        nature: "",
        category: "",
        subCategory: "",
      });
    }
    setIsEditAccountOpen(true);
  }, [selectedAccount, accounts]);

  const handleSaveEditAccount = useCallback(async () => {
    if (!selectedAccount || !editAccount.name.trim()) {
      toast({ title: "Error", description: "Please enter an account name", variant: "destructive" });
      return;
    }
    const oldName = selectedAccount;
    const newName = toTitleCase(editAccount.name.trim());

    try {
      setIsSubmitting(true);
      const accountData: Account = {
        name: newName,
        contact: editAccount.contact.trim() || undefined,
        address: editAccount.address.trim() || undefined,
        nature: editAccount.nature || undefined,
        category: editAccount.category.trim() || undefined,
        subCategory: editAccount.subCategory.trim() || undefined,
      };

      // Update account in accounts collection
      await updateAccount(accountData, oldName);

      // If name changed, update all transactions
      if (oldName !== newName) {
        await Promise.all([updateExpensePayee(oldName, newName), updateIncomePayee(oldName, newName)]);
        setSelectedAccount(newName);
        setValue("payee", newName, { shouldValidate: true });
      }

      setIsEditAccountOpen(false);
      toast({ title: "Success", description: `Account "${oldName}" updated successfully.` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update account", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedAccount, editAccount, setValue, toast, setIsSubmitting]);

  const handleDeleteAccount = useCallback(async () => {
    if (!selectedAccount) return;

    try {
      setIsSubmitting(true);
      // Delete account from accounts collection
      await deleteAccount(selectedAccount);
      // Delete all transactions for this payee
      await Promise.all([deleteExpensesForPayee(selectedAccount), deleteIncomesForPayee(selectedAccount)]);

      setSelectedAccount(null);
      setValue("payee", "", { shouldValidate: true });
      setIsDeleteAccountOpen(false);
      toast({
        title: "Success",
        description: `Account "${selectedAccount}" and all its transactions have been deleted`,
      });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete account", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedAccount, setValue, toast, setIsSubmitting]);

  return {
    selectedAccount,
    setSelectedAccount,
    isAddAccountOpen,
    setIsAddAccountOpen,
    isEditAccountOpen,
    setIsEditAccountOpen,
    isDeleteAccountOpen,
    setIsDeleteAccountOpen,
    newAccount,
    setNewAccount,
    editAccount,
    setEditAccount,
    accounts,
    handleAddAccount,
    handleSaveNewAccount,
    handleEditAccount,
    handleSaveEditAccount,
    handleDeleteAccount,
  };
}

