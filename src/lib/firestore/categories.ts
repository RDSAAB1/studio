import { db } from "../database";
import { type IncomeCategory, type ExpenseCategory } from "@/lib/definitions";

export async function getAllIncomeCategories(): Promise<IncomeCategory[]> {
  try {
    return await db.incomeCategories.toArray();
  } catch (error) {
    console.error("Failed to fetch income categories:", error);
    return [];
  }
}

export async function getAllExpenseCategories(): Promise<ExpenseCategory[]> {
  try {
    return await db.expenseCategories.toArray();
  } catch (error) {
    console.error("Failed to fetch expense categories:", error);
    return [];
  }
}

export async function addCategory(
  collection: "incomeCategories" | "expenseCategories",
  category: { name: string; nature?: string }
): Promise<void> {
  try {
    const table = db[collection];
    const id = category.name.trim().toLowerCase().replace(/\s+/g, '-');
    const newCat = {
      id,
      name: category.name.trim(),
      subCategories: [],
      ...(collection === 'expenseCategories' ? { nature: (category.nature || 'Permanent') as 'Permanent' | 'Seasonal' } : {})
    };
    await table.put(newCat as any);
  } catch (error) {
    console.error(`Failed to add category to ${collection}:`, error);
    throw error;
  }
}

export async function updateCategoryName(
  collection: "incomeCategories" | "expenseCategories",
  id: string,
  newName: string
): Promise<void> {
  try {
    const table = db[collection];
    const existing = await table.get(id);
    if (!existing) throw new Error("Category not found");
    
    await table.put({
      ...existing,
      name: newName.trim()
    });
  } catch (error) {
    console.error(`Failed to update category name in ${collection}:`, error);
    throw error;
  }
}

export async function deleteCategory(
  collection: "incomeCategories" | "expenseCategories",
  id: string
): Promise<void> {
  try {
    const table = db[collection];
    await table.delete(id);
  } catch (error) {
    console.error(`Failed to delete category from ${collection}:`, error);
    throw error;
  }
}

export async function addSubCategory(
  collection: "incomeCategories" | "expenseCategories",
  categoryId: string,
  subCategoryName: string
): Promise<void> {
  try {
    const table = db[collection];
    const cat = await table.get(categoryId);
    if (!cat) throw new Error("Category not found");
    
    const subCategories = Array.isArray(cat.subCategories) ? [...cat.subCategories] : [];
    if (!subCategories.includes(subCategoryName.trim())) {
      subCategories.push(subCategoryName.trim());
      await table.put({
        ...cat,
        subCategories
      });
    }
  } catch (error) {
    console.error(`Failed to add subcategory to ${categoryId} in ${collection}:`, error);
    throw error;
  }
}

export async function deleteSubCategory(
  collection: "incomeCategories" | "expenseCategories",
  categoryId: string,
  subCategoryName: string
): Promise<void> {
  try {
    const table = db[collection];
    const cat = await table.get(categoryId);
    if (!cat) throw new Error("Category not found");
    
    const subCategories = Array.isArray(cat.subCategories) ? [...cat.subCategories] : [];
    const filtered = subCategories.filter(s => s !== subCategoryName);
    
    await table.put({
      ...cat,
      subCategories: filtered
    });
  } catch (error) {
    console.error(`Failed to delete subcategory from ${categoryId} in ${collection}:`, error);
    throw error;
  }
}
