import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import type { IncomeCategory, ExpenseCategory } from "@/lib/definitions";
import {
  getAllIncomeCategories,
  getAllExpenseCategories,
  addCategory,
  updateCategoryName,
  deleteCategory,
  addSubCategory,
  deleteSubCategory,
} from "@/lib/firestore";

export function useCategoryManager() {
  const { toast } = useToast();
  const [incomeCategories, setIncomeCategories] = useState<IncomeCategory[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);

  const refreshCategories = useCallback(async () => {
    const [incomeCats, expenseCats] = await Promise.all([
      getAllIncomeCategories(),
      getAllExpenseCategories(),
    ]);
    setIncomeCategories(incomeCats);
    setExpenseCategories(expenseCats);
  }, []);

  const handleAddCategory = useCallback(
    async (collection: "incomeCategories" | "expenseCategories", category: { name: string; nature?: string }) => {
      await addCategory(collection, category);
      await refreshCategories();
      toast({ title: "Category added", variant: "success" });
    },
    [refreshCategories, toast]
  );

  const handleUpdateCategoryName = useCallback(
    async (collection: "incomeCategories" | "expenseCategories", id: string, name: string) => {
      await updateCategoryName(collection, id, name);
      await refreshCategories();
      toast({ title: "Category updated", variant: "success" });
    },
    [refreshCategories, toast]
  );

  const handleDeleteCategory = useCallback(
    async (collection: "incomeCategories" | "expenseCategories", id: string) => {
      await deleteCategory(collection, id);
      await refreshCategories();
      toast({ title: "Category deleted", variant: "success" });
    },
    [refreshCategories, toast]
  );

  const handleAddSubCategory = useCallback(
    async (collection: "incomeCategories" | "expenseCategories", categoryId: string, subCategoryName: string) => {
      await addSubCategory(collection, categoryId, subCategoryName);
      await refreshCategories();
      toast({ title: "Subcategory added", variant: "success" });
    },
    [refreshCategories, toast]
  );

  const handleDeleteSubCategory = useCallback(
    async (collection: "incomeCategories" | "expenseCategories", categoryId: string, subCategoryName: string) => {
      await deleteSubCategory(collection, categoryId, subCategoryName);
      await refreshCategories();
      toast({ title: "Subcategory deleted", variant: "success" });
    },
    [refreshCategories, toast]
  );

  return {
    incomeCategories,
    expenseCategories,
    setIncomeCategories,
    setExpenseCategories,
    isCategoryManagerOpen,
    setIsCategoryManagerOpen,
    refreshCategories,
    handleAddCategory,
    handleUpdateCategoryName,
    handleDeleteCategory,
    handleAddSubCategory,
    handleDeleteSubCategory,
  };
}

