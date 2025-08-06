
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { initialExpenses } from "@/lib/data";
import type { Expense } from "@/lib/definitions";
import { toTitleCase, cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

import { Pen, PlusCircle, Save, Trash, Calendar as CalendarIcon, Tag, User, Wallet, Info, FileText, ArrowUpDown, TrendingUp, Hash, Percent } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { format } from "date-fns"

const expenseSchema = z.object({
  id: z.string().optional(),
  date: z.date(),
  category: z.string().min(1, "Category is required."),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0."),
  payee: z.string().min(1, "Payee is required."),
  paymentMethod: z.string().min(1, "Payment method is required."),
  status: z.string().min(1, "Status is required."),
  description: z.string().optional(),
  invoiceNumber: z.string().optional(),
  taxAmount: z.coerce.number().optional(),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

const getInitialFormState = (expenses: Expense[]): Expense => {
  const nextId = expenses.length > 0 ? String(Math.max(...expenses.map(e => parseInt(e.id))) + 1) : "1";
  const staticDate = new Date();
  staticDate.setHours(0, 0, 0, 0);

  return {
    id: nextId,
    date: staticDate.toISOString().split('T')[0],
    category: '',
    amount: 0,
    payee: '',
    description: '',
    paymentMethod: 'Cash',
    status: 'Paid',
    invoiceNumber: '',
    taxAmount: 0,
  };
};

const SectionCard = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <Card className={cn("bg-card/60 backdrop-blur-sm border-white/10", className)}>
        {children}
    </Card>
);

const InputWithIcon = ({ icon, children }: { icon: React.ReactNode, children: React.ReactNode }) => (
    <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            {icon}
        </div>
        {children}
    </div>
);

export default function ExpenseTrackerClient() {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Expense, direction: 'ascending' | 'descending' } | null>(null);
  
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: getInitialFormState(expenses),
  });

  const handleNew = useCallback(() => {
    setIsEditing(null);
    form.reset(getInitialFormState(expenses));
  }, [expenses, form]);
  
  useEffect(() => {
    handleNew();
  }, [handleNew]);

  const handleEdit = (expense: Expense) => {
    setIsEditing(expense.id);
    form.reset({
      ...expense,
      date: new Date(expense.date),
      taxAmount: expense.taxAmount || 0,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    toast({ title: "Success", description: "Expense deleted successfully." });
    if (isEditing === id) {
      handleNew();
    }
  };

  const onSubmit = (values: ExpenseFormValues) => {
    const expenseData: Expense = {
      ...values,
      date: format(values.date, "yyyy-MM-dd"),
      payee: toTitleCase(values.payee),
      category: toTitleCase(values.category),
    };
    
    if (isEditing) {
      setExpenses(prev => prev.map(e => e.id === isEditing ? { ...expenseData, id: isEditing } : e));
      toast({ title: "Success", description: "Expense updated successfully." });
    } else {
      const newId = String(Date.now());
      setExpenses(prev => [{ ...expenseData, id: newId }, ...prev]);
      toast({ title: "Success", description: "New expense saved successfully." });
    }
    handleNew();
  };

  const requestSort = (key: keyof Expense) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedExpenses = useMemo(() => {
    let sortableItems = [...expenses];
    if (sortConfig !== null) {
        sortableItems.sort((a, b) => {
            const valA = a[sortConfig.key] || '';
            const valB = b[sortConfig.key] || '';
            if (valA < valB) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (valA > valB) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });
    }
    return sortableItems;
  }, [expenses, sortConfig]);
  
  const totalExpenses = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);
  const totalTax = useMemo(() => expenses.reduce((sum, e) => sum + (e.taxAmount || 0), 0), [expenses]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">{isEditing ? 'Edit Expense' : 'Add New Expense'}</h1>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Controller name="date" control={form.control} render={({ field }) => (
                <div className="space-y-1">
                    <Label className="text-xs">Date</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-9 text-sm", !field.value && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-[51]">
                            <CalendarComponent mode="single" selected={field.value} onSelect={(date) => field.onChange(date || new Date())} initialFocus />
                        </PopoverContent>
                    </Popover>
                </div>
            )} />

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label htmlFor="amount" className="text-xs">Amount</Label>
                    <InputWithIcon icon={<Wallet className="h-4 w-4 text-muted-foreground" />}>
                        <Controller name="amount" control={form.control} render={({ field }) => <Input id="amount" type="number" {...field} className="h-9 text-sm pl-10" />} />
                    </InputWithIcon>
                    {form.formState.errors.amount && <p className="text-xs text-destructive mt-1">{form.formState.errors.amount.message}</p>}
                </div>
                 <div className="space-y-1">
                    <Label htmlFor="category" className="text-xs">Category</Label>
                    <InputWithIcon icon={<Tag className="h-4 w-4 text-muted-foreground" />}>
                        <Controller name="category" control={form.control} render={({ field }) => <Input id="category" {...field} className="h-9 text-sm pl-10" />} />
                    </InputWithIcon>
                    {form.formState.errors.category && <p className="text-xs text-destructive mt-1">{form.formState.errors.category.message}</p>}
                </div>
            </div>

            <div className="space-y-1">
                <Label htmlFor="payee" className="text-xs">Payee</Label>
                 <InputWithIcon icon={<User className="h-4 w-4 text-muted-foreground" />}>
                    <Controller name="payee" control={form.control} render={({ field }) => <Input id="payee" {...field} className="h-9 text-sm pl-10" />} />
                </InputWithIcon>
                {form.formState.errors.payee && <p className="text-xs text-destructive mt-1">{form.formState.errors.payee.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <Controller name="paymentMethod" control={form.control} render={({ field }) => (
                    <div className="space-y-1">
                        <Label className="text-xs">Payment Method</Label>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Cash">Cash</SelectItem>
                                <SelectItem value="Online">Online</SelectItem>
                                <SelectItem value="Cheque">Cheque</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )} />
                <Controller name="status" control={form.control} render={({ field }) => (
                    <div className="space-y-1">
                        <Label className="text-xs">Status</Label>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Paid">Paid</SelectItem>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="Cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )} />
            </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label htmlFor="invoiceNumber" className="text-xs">Invoice #</Label>
                    <InputWithIcon icon={<Hash className="h-4 w-4 text-muted-foreground" />}>
                        <Controller name="invoiceNumber" control={form.control} render={({ field }) => <Input id="invoiceNumber" {...field} className="h-9 text-sm pl-10" />} />
                    </InputWithIcon>
                </div>
                 <div className="space-y-1">
                    <Label htmlFor="taxAmount" className="text-xs">Tax Amount</Label>
                    <InputWithIcon icon={<Percent className="h-4 w-4 text-muted-foreground" />}>
                        <Controller name="taxAmount" control={form.control} render={({ field }) => <Input id="taxAmount" type="number" {...field} className="h-9 text-sm pl-10" />} />
                    </InputWithIcon>
                </div>
            </div>

            <div className="space-y-1">
                <Label htmlFor="description" className="text-xs">Description</Label>
                <Controller name="description" control={form.control} render={({ field }) => <Textarea id="description" {...field} className="text-sm" rows={3}/>} />
            </div>

            <div className="flex justify-start space-x-4 pt-4">
              <Button type="submit" size="sm">
                {isEditing ? <><Pen className="mr-2 h-4 w-4" /> Update Expense</> : <><Save className="mr-2 h-4 w-4" /> Save Expense</>}
              </Button>
              <Button type="button" variant="outline" onClick={handleNew} size="sm">
                <PlusCircle className="mr-2 h-4 w-4" /> New
              </Button>
            </div>
        </form>
      </div>
      <div className="lg:col-span-2 space-y-6">
        <SectionCard>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary"/>Expense Overview</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
                <div>
                    <div className="text-4xl font-bold">₹{totalExpenses.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">Total expenses recorded</p>
                </div>
                 <div>
                    <div className="text-4xl font-bold">₹{totalTax.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">Total tax paid</p>
                </div>
            </CardContent>
        </SectionCard>
        <SectionCard>
          <CardHeader>
            <CardTitle>Expense History</CardTitle>
            <CardDescription>A list of all recorded expenses.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer" onClick={() => requestSort('date')}>Date <ArrowUpDown className="inline h-3 w-3 ml-1"/> </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => requestSort('category')}>Category <ArrowUpDown className="inline h-3 w-3 ml-1"/></TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead className="cursor-pointer text-right" onClick={() => requestSort('amount')}>Amount <ArrowUpDown className="inline h-3 w-3 ml-1"/></TableHead>
                    <TableHead className="cursor-pointer text-right" onClick={() => requestSort('taxAmount')}>Tax <ArrowUpDown className="inline h-3 w-3 ml-1"/></TableHead>
                    <TableHead>Payee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>{format(new Date(expense.date), "dd-MMM-yy")}</TableCell>
                      <TableCell>{expense.category}</TableCell>
                      <TableCell className="font-mono text-xs">{expense.invoiceNumber}</TableCell>
                      <TableCell className="text-right font-medium">₹{expense.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">₹{(expense.taxAmount || 0).toFixed(2)}</TableCell>
                      <TableCell>{expense.payee}</TableCell>
                      <TableCell>
                        <span className={cn("px-2 py-1 text-xs rounded-full", expense.status === 'Paid' ? 'bg-green-500/10 text-green-500' : expense.status === 'Pending' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500')}>
                          {expense.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(expense)}><Pen className="h-4 w-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><Trash className="h-4 w-4 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently delete the expense entry for "{expense.payee}" of ₹{expense.amount}.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(expense.id)}>Continue</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </SectionCard>
      </div>
    </div>
  );
}

    