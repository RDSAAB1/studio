
"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle, Trash2, Pen } from 'lucide-react';
import { toTitleCase } from '@/lib/utils';
import type { IncomeCategory, ExpenseCategory } from '@/lib/definitions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CategoryManagerDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  incomeCategories: IncomeCategory[];
  expenseCategories: ExpenseCategory[];
  onAddCategory: (collection: 'incomeCategories' | 'expenseCategories', category: { name: string, nature?: string }) => Promise<void>;
  onUpdateCategoryName: (collection: 'incomeCategories' | 'expenseCategories', id: string, name: string) => Promise<void>;
  onDeleteCategory: (collection: 'incomeCategories' | 'expenseCategories', id: string) => Promise<void>;
  onAddSubCategory: (collection: 'incomeCategories' | 'expenseCategories', categoryId: string, subCategoryName: string) => Promise<void>;
  onDeleteSubCategory: (collection: 'incomeCategories' | 'expenseCategories', categoryId: string, subCategoryName: string) => Promise<void>;
}

const CategoryList = ({ title, categories, collectionName, onAddCategory, onUpdateCategoryName, onDeleteCategory, onAddSubCategory, onDeleteSubCategory, nature }: any) => {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubCategory, setNewSubCategory] = useState<{ [key: string]: string }>({});

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    const categoryData: { name: string, nature?: string } = { name: toTitleCase(newCategoryName) };
    if (nature) categoryData.nature = nature;
    onAddCategory(collectionName, categoryData).then(() => setNewCategoryName(''));
  };

  const handleAddSubCategory = (categoryId: string) => {
    const subCategoryName = newSubCategory[categoryId]?.trim();
    if (!subCategoryName) return;
    onAddSubCategory(collectionName, categoryId, toTitleCase(subCategoryName)).then(() => setNewSubCategory(prev => ({...prev, [categoryId]: ''})));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Manage {title.toLowerCase()} categories and sub-categories.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="New Category Name" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
          <Button onClick={handleAddCategory}><PlusCircle className="mr-2 h-4 w-4"/>Add Category</Button>
        </div>
        <ScrollArea className="h-72 p-2 border rounded-md">
          {categories.map((cat: any) => (
            <div key={cat.id} className="mb-4 p-3 rounded-lg bg-muted/50">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">{toTitleCase(cat.name)}</span>
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-4 w-4 text-destructive"/></Button></AlertDialogTrigger>
                  <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete "{cat.name}"?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone and will delete all sub-categories.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onDeleteCategory(collectionName, cat.id)}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                </AlertDialog>
              </div>
              <ul className="list-disc list-inside pl-4 text-sm space-y-1">
                {cat.subCategories?.map((sub: string) => (
                    <li key={sub} className="flex justify-between items-center group">
                        <span>{toTitleCase(sub)}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 invisible group-hover:visible" onClick={() => onDeleteSubCategory(collectionName, cat.id, sub)}><Trash2 className="h-3 w-3 text-destructive"/></Button>
                    </li>
                ))}
              </ul>
               <div className="flex gap-2 mt-2">
                    <Input 
                      placeholder="New Sub-Category" 
                      value={newSubCategory[cat.id] || ''} 
                      onChange={e => setNewSubCategory(prev => ({ ...prev, [cat.id]: e.target.value }))} 
                      className="h-8 text-sm"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddSubCategory(cat.id)}
                    />
                    <Button size="sm" onClick={() => handleAddSubCategory(cat.id)}>Add Sub</Button>
                </div>
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export const CategoryManagerDialog = ({ isOpen, onOpenChange, incomeCategories, expenseCategories, ...props }: CategoryManagerDialogProps) => {
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Category Management</DialogTitle>
                    <DialogDescription>Add, edit, or remove categories and sub-categories for income and expenses.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-grow pr-6 -mr-6">
                    <Tabs defaultValue="expense" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="expense">Expense</TabsTrigger>
                            <TabsTrigger value="income">Income</TabsTrigger>
                        </TabsList>
                        <TabsContent value="expense" className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <CategoryList title="Permanent Expenses" categories={expenseCategories.filter(c => c.nature === 'Permanent')} collectionName="expenseCategories" {...props} nature="Permanent" />
                            <CategoryList title="Seasonal Expenses" categories={expenseCategories.filter(c => c.nature === 'Seasonal')} collectionName="expenseCategories" {...props} nature="Seasonal" />
                            <CategoryList title="Interest & Loan Payments" categories={expenseCategories.filter(c => c.name === 'Interest & Loan Payments')} collectionName="expenseCategories" {...props} nature="Permanent" />
                        </TabsContent>
                        <TabsContent value="income" className="mt-4">
                            <CategoryList title="Income" categories={incomeCategories} collectionName="incomeCategories" {...props} />
                        </TabsContent>
                    </Tabs>
                </ScrollArea>
                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
