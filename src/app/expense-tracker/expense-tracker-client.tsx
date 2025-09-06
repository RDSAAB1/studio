
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Transaction, IncomeCategory, ExpenseCategory } from "@/lib/definitions";
import { toTitleCase, cn, formatCurrency } from "@/lib/utils";

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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useForm, Controller } from "react-hook-form";
import { Switch } from "@/components/ui/switch";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryManagerDialog } from "./category-manager-dialog";
import { getIncomeCategories, getExpenseCategories, addCategory, updateCategoryName, deleteCategory, addSubCategory, deleteSubCategory } from "@/lib/firestore";
import { collection, onSnapshot, query, orderBy, doc, getDoc, setDoc, deleteDoc, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase"; 


import { Pen, PlusCircle, Save, Trash, Calendar as CalendarIcon, Tag, User, Wallet, Info, FileText, ArrowUpDown, TrendingUp, Hash, Percent, RefreshCw, Briefcase, UserCircle, FilePlus, List, BarChart, CircleDollarSign, Landmark, Building2, SunMoon, Layers3, FolderTree, ArrowLeftRight, Settings, SlidersHorizontal, Calculator } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { format } from "date-fns"

// Zod Schema
const transactionSchema = z.object({
  id: z.string().optional(),
  date: z.date(),
  transactionType: z.enum(["Income", "Expense"]),
  category: z.string().min(1, "Category is required."),
  subCategory: z.string().min(1, "Sub-category is required."),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0."),
  payee: z.string().min(1, "Payee/Payer is required."),
  paymentMethod: z.string().min(1, "Payment method is required."),
  status: z.string().min(1, "Status is required."),
  description: z.string().optional(),
  invoiceNumber: z.string().optional(),
  taxAmount: z.coerce.number().optional(),
  expenseType: z.enum(["Personal", "Business"]).optional(),
  isRecurring: z.boolean(),
  mill: z.string().optional(), 
  expenseNature: z.enum(["Permanent", "Seasonal"]).optional(),
  isCalculated: z.boolean(),
  quantity: z.coerce.number().optional(),
  rate: z.coerce.number().optional(),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;
type TransactionFormData = Omit<TransactionFormValues, 'date'> & { date: string }; // For Firestore compatibility

const getInitialFormState = (): Omit<Transaction, 'id' | 'date'> & { date: Date } => {
  const staticDate = new Date();
  staticDate.setHours(0, 0, 0, 0);

  return {
    date: staticDate,
    transactionType: 'Expense', // Default to Expense
    category: '',
    subCategory: '',
    amount: 0,
    payee: '',
    description: '',
    paymentMethod: 'Cash',
    status: 'Paid',
    invoiceNumber: '',
    taxAmount: 0,
    expenseType: 'Business',
    isRecurring: false,
    mill: '',
    expenseNature: 'Permanent',
    isCalculated: false,
    quantity: 0,
    rate: 0,
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

const StatCard = ({ title, value, icon, colorClass, description }: { title: string, value: string, icon: React.ReactNode, colorClass?: string, description?: string }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <div className="text-muted-foreground">{icon}</div>
    </CardHeader>
    <CardContent>
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </CardContent>
  </Card>
);

export default function IncomeExpenseClient() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("history");
  const [sortConfig, setSortConfig] = useState<{ key: keyof Transaction; direction: 'ascending' | 'descending' } | null>(null);
  
  const [incomeCategories, setIncomeCategories] = useState<IncomeCategory[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [isCalculated, setIsCalculated] = useState(false);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: getInitialFormState(),
  });

  const selectedTransactionType = form.watch('transactionType');
  const selectedExpenseNature = form.watch('expenseNature');
  const selectedCategory = form.watch('category');
  const quantity = form.watch('quantity');
  const rate = form.watch('rate');

  useEffect(() => {
    if (isCalculated) {
      const calculatedAmount = (quantity || 0) * (rate || 0);
      form.setValue('amount', calculatedAmount);
    }
  }, [quantity, rate, isCalculated, form]);

  const availableCategories = useMemo(() => {
    if (selectedTransactionType === 'Income') {
        return incomeCategories;
    }
    if (selectedTransactionType === 'Expense' && selectedExpenseNature) {
        return expenseCategories.filter(c => c.nature === selectedExpenseNature);
    }
    return [];
  }, [selectedTransactionType, selectedExpenseNature, incomeCategories, expenseCategories]);

  const availableSubCategories = useMemo(() => {
    const categoryObj = availableCategories.find(c => c.name === selectedCategory);
    return categoryObj?.subCategories || [];
  }, [selectedCategory, availableCategories]);

  useEffect(() => {
    const q = query(collection(db, "transactions"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const transactionsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id, ...data,
          date: new Date(data.date) 
        } as Transaction;
      });
      setTransactions(transactionsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching transactions: ", error);
      setLoading(false);
    });

    const unsubIncome = getIncomeCategories(setIncomeCategories, console.error);
    const unsubExpense = getExpenseCategories(setExpenseCategories, console.error);

    return () => {
      unsubscribe();
      unsubIncome();
      unsubExpense();
    };
  }, []);

  useEffect(() => {
    form.setValue('category', '');
    form.setValue('subCategory', '');
  }, [selectedTransactionType, selectedExpenseNature, form]);

  useEffect(() => {
    form.setValue('subCategory', '');
  }, [selectedCategory, form]);

  const handleNew = useCallback(() => {
    setIsEditing(null); 
    form.reset(getInitialFormState());
    setIsAdvanced(false);
    setIsCalculated(false);
    setActiveTab("form");
  }, [form]);

  const handleEdit = (transaction: Transaction) => {
    setIsEditing(transaction.id);
    form.reset({
      ...transaction,
      date: new Date(transaction.date), 
      taxAmount: transaction.taxAmount || 0,
      quantity: transaction.quantity || 0,
      rate: transaction.rate || 0,
      isCalculated: transaction.isCalculated || false,
    });
    setIsAdvanced(!!(transaction.status || transaction.invoiceNumber || transaction.taxAmount || transaction.expenseType || transaction.isRecurring || transaction.mill));
    setIsCalculated(transaction.isCalculated || false);
    setActiveTab("form");
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "transactions", id));
      toast({ title: "Transaction deleted.", variant: "success" });
      if (isEditing === id) {
        setIsEditing(null);
        form.reset(getInitialFormState()); 
      }
    } catch (error) {
      console.error("Error deleting transaction: ", error);
      toast({ title: "Failed to delete transaction.", variant: "destructive" });
    }
  };

  const onSubmit = async (values: TransactionFormValues) => {
    setLoading(true);
    try {
      const transactionData: TransactionFormData = {
        ...values,
        isCalculated,
        date: format(values.date, "yyyy-MM-dd"), 
        payee: toTitleCase(values.payee),
        mill: toTitleCase(values.mill || ''),
      };

      if (isEditing) {
        await setDoc(doc(db, "transactions", isEditing), transactionData, { merge: true });
        toast({ title: "Transaction updated.", variant: "success" });
      } else {
        await addDoc(collection(db, "transactions"), transactionData);
        toast({ title: "Transaction saved.", variant: "success" });
      }
      handleNew();
      setActiveTab("history");
    } catch (error) {
        console.error("Error saving transaction: ", error);
        toast({ title: "Failed to save transaction.", variant: "destructive" });
    } finally {
        setLoading(false);
    }
  };

  const requestSort = (key: keyof Transaction) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedTransactions = useMemo(() => {
    let sortableItems = [...transactions];
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
  }, [transactions, sortConfig]);
  
  const { totalIncome, totalExpense, netProfitLoss, totalTransactions } = useMemo(() => {
    const income = transactions.filter(t => t.transactionType === 'Income').reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions.filter(t => t.transactionType === 'Expense').reduce((sum, t) => sum + t.amount, 0);
    return {
      totalIncome: income,
      totalExpense: expense,
      netProfitLoss: income - expense,
      totalTransactions: transactions.length,
    };
  }, [transactions]);

  return (
    <div className="space-y-6">
      <SectionCard>
          <CardHeader>
              <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary"/>Transactions Overview</CardTitle>
              <CardDescription>A summary of your recorded income and expenses.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Total Income" value={formatCurrency(totalIncome)} icon={<CircleDollarSign />} colorClass="text-green-500"/>
              <StatCard title="Total Expense" value={formatCurrency(totalExpense)} icon={<CircleDollarSign />} colorClass="text-red-500"/>
              <StatCard title="Net Profit/Loss" value={formatCurrency(netProfitLoss)} icon={<BarChart />} colorClass={netProfitLoss >= 0 ? "text-green-500" : "text-red-500"}/>
              <StatCard title="Total Transactions" value={String(totalTransactions)} icon={<Hash />} />
          </CardContent>
      </SectionCard>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="history" className="flex-1 sm:flex-initial"><List className="mr-2 h-4 w-4"/>Transaction History</TabsTrigger>
            <TabsTrigger value="form" className="flex-1 sm:flex-initial"><FilePlus className="mr-2 h-4 w-4"/>{isEditing ? 'Edit Transaction' : 'Add New Transaction'}</TabsTrigger>
          </TabsList>
          <div className="w-full sm:w-auto flex items-center gap-2">
            <Button onClick={() => setIsCategoryManagerOpen(true)} size="sm" variant="outline" className="w-full sm:w-auto"><Settings className="mr-2 h-4 w-4" />Manage Categories</Button>
            {activeTab === 'history' && (
              <Button onClick={handleNew} size="sm" className="w-full sm:w-auto">
                  <PlusCircle className="mr-2 h-4 w-4" /> New Transaction
              </Button>
            )}
          </div>
        </div>
        <TabsContent value="history" className="mt-4">
          <SectionCard>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer" onClick={() => requestSort('date')}>Date <ArrowUpDown className="inline h-3 w-3 ml-1"/> </TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => requestSort('category')}>Category <ArrowUpDown className="inline h-3 w-3 ml-1"/></TableHead>
                      <TableHead>Sub-Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Payee/Payer</TableHead>
                       <TableHead>Mill</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTransactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>{format(new Date(transaction.date), "dd-MMM-yy")}</TableCell>
                        <TableCell><Badge variant={transaction.transactionType === 'Income' ? 'default' : 'destructive'} className={transaction.transactionType === 'Income' ? 'bg-green-500/80' : 'bg-red-500/80'}>{transaction.transactionType}</Badge></TableCell>
                        <TableCell>{transaction.category}</TableCell>
                        <TableCell>{transaction.subCategory}</TableCell>
                        <TableCell className={cn("text-right font-medium", transaction.transactionType === 'Income' ? 'text-green-500' : 'text-red-500')}>{formatCurrency(transaction.amount)}</TableCell>
                        <TableCell>{transaction.payee}</TableCell>
                        <TableCell>{transaction.mill}</TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(transaction)}><Pen className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><Trash className="h-4 w-4 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the transaction for "{toTitleCase(transaction.payee)}".
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(transaction.id)}>Continue</AlertDialogAction>
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
        </TabsContent>
        <TabsContent value="form" className="mt-4">
           <SectionCard>
              <CardContent className="p-6">
                 <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      
                      <Controller name="transactionType" control={form.control} render={({ field }) => (
                          <div className="space-y-2">
                              <Label className="text-xs">Transaction Type</Label>
                              <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                                  <div className="flex items-center space-x-2">
                                      <RadioGroupItem value="Income" id="type-income" />
                                      <Label htmlFor="type-income" className="font-normal text-sm flex items-center gap-2">Income</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                      <RadioGroupItem value="Expense" id="type-expense" />
                                      <Label htmlFor="type-expense" className="font-normal text-sm flex items-center gap-2">Expense</Label>
                                  </div>
                              </RadioGroup>
                          </div>
                      )} />
                      
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

                      <div className="space-y-1">
                          <Label htmlFor="amount" className="text-xs">Amount</Label>
                          <InputWithIcon icon={<Wallet className="h-4 w-4 text-muted-foreground" />}>
                              <Controller name="amount" control={form.control} render={({ field }) => <Input id="amount" type="number" {...field} className="h-9 text-sm pl-10" readOnly={isCalculated}/>} />
                          </InputWithIcon>
                          {form.formState.errors.amount && <p className="text-xs text-destructive mt-1">{form.formState.errors.amount.message}</p>}
                      </div>
                       
                        {selectedTransactionType === 'Expense' && (
                            <Controller name="expenseNature" control={form.control} render={({ field }) => (
                              <div className="space-y-1">
                                <Label className="text-xs">Expense Nature</Label>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="h-9 text-sm">
                                        <div className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Select Nature" /></div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Permanent">Permanent</SelectItem>
                                        <SelectItem value="Seasonal">Seasonal</SelectItem>
                                    </SelectContent>
                                </Select>
                              </div>
                            )} />
                        )}

                        <Controller name="category" control={form.control} render={({ field }) => (
                          <div className="space-y-1">
                            <Label className="text-xs">Category</Label>
                            <Select onValueChange={field.onChange} value={field.value} disabled={availableCategories.length === 0}>
                                <SelectTrigger className="h-9 text-sm">
                                    <div className="flex items-center gap-2"><Tag className="h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Select Category" /></div>
                                </SelectTrigger>
                                <SelectContent>
                                    {availableCategories.map(cat => <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            {form.formState.errors.category && <p className="text-xs text-destructive mt-1">{form.formState.errors.category.message}</p>}
                          </div>
                        )} />

                        <Controller name="subCategory" control={form.control} render={({ field }) => (
                          <div className="space-y-1">
                            <Label className="text-xs">Sub-Category</Label>
                            <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCategory}>
                                <SelectTrigger className="h-9 text-sm">
                                    <div className="flex items-center gap-2"><FolderTree className="h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Select Sub-Category" /></div>
                                </SelectTrigger>
                                <SelectContent>
                                    {availableSubCategories.map(subCat => <SelectItem key={subCat} value={subCat}>{subCat}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            {form.formState.errors.subCategory && <p className="text-xs text-destructive mt-1">{form.formState.errors.subCategory.message}</p>}
                          </div>
                        )} />

                      <div className="space-y-1">
                          <Label htmlFor="payee" className="text-xs">Payee / Payer</Label>
                           <InputWithIcon icon={<User className="h-4 w-4 text-muted-foreground" />}>
                              <Controller name="payee" control={form.control} render={({ field }) => <Input id="payee" {...field} className="h-8 text-sm pl-10" />} />
                          </InputWithIcon>
                          {form.formState.errors.payee && <p className="text-xs text-destructive mt-1">{form.formState.errors.payee.message}</p>}
                      </div>

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

                        <div className="flex items-center space-x-2 pt-6">
                            <Switch id="calculate-toggle" checked={isCalculated} onCheckedChange={setIsCalculated} />
                            <Label htmlFor="calculate-toggle" className="text-sm font-normal flex items-center gap-2"><Calculator className="h-4 w-4"/> Calculate Amount</Label>
                        </div>
                      
                        {isCalculated && (
                            <>
                                <div className="space-y-1">
                                    <Label htmlFor="quantity" className="text-xs">Quantity</Label>
                                    <Controller name="quantity" control={form.control} render={({ field }) => <Input id="quantity" type="number" {...field} className="h-8 text-sm" />} />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="rate" className="text-xs">Rate</Label>
                                    <Controller name="rate" control={form.control} render={({ field }) => <Input id="rate" type="number" {...field} className="h-8 text-sm" />} />
                                </div>
                            </>
                        )}
                        
                        {selectedTransactionType === 'Expense' && (
                            <div className="flex items-center space-x-2 pt-6">
                                <Switch id="advanced-toggle" checked={isAdvanced} onCheckedChange={setIsAdvanced} />
                                <Label htmlFor="advanced-toggle" className="text-sm font-normal flex items-center gap-2"><SlidersHorizontal className="h-4 w-4"/> Advanced Fields</Label>
                            </div>
                        )}

                        {isAdvanced && selectedTransactionType === 'Expense' && (
                            <>
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
                                <div className="space-y-1">
                                    <Label htmlFor="invoiceNumber" className="text-xs">Invoice #</Label>
                                    <InputWithIcon icon={<Hash className="h-4 w-4 text-muted-foreground" />}>
                                        <Controller name="invoiceNumber" control={form.control} render={({ field }) => <Input id="invoiceNumber" {...field} className="h-8 text-sm pl-10" />} />
                                    </InputWithIcon>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="taxAmount" className="text-xs">Tax Amount</Label>
                                    <InputWithIcon icon={<Percent className="h-4 w-4 text-muted-foreground" />}>
                                        <Controller name="taxAmount" control={form.control} render={({ field }) => <Input id="taxAmount" type="number" {...field} className="h-8 text-sm pl-10" />} />
                                    </InputWithIcon>
                                </div>
                                <Controller name="expenseType" control={form.control} render={({ field }) => (
                                    <div className="space-y-2">
                                        <Label className="text-xs">Expense Type</Label>
                                        <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="Business" id="type-business" />
                                                <Label htmlFor="type-business" className="font-normal text-sm flex items-center gap-2"><Briefcase className="h-4 w-4"/> Business</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="Personal" id="type-personal" />
                                                <Label htmlFor="type-personal" className="font-normal text-sm flex items-center gap-2"><UserCircle className="h-4 w-4"/> Personal</Label>
                                            </div>
                                        </RadioGroup>
                                    </div>
                                )} />
                                <div className="space-y-1">
                                    <Label htmlFor="mill" className="text-xs">Mill</Label>
                                    <InputWithIcon icon={<Building2 className="h-4 w-4 text-muted-foreground" />}>
                                        <Controller name="mill" control={form.control} render={({ field }) => <Input id="mill" {...field} className="h-8 text-sm pl-10" />} />
                                    </InputWithIcon>
                                </div>
                                <Controller name="isRecurring" control={form.control} render={({ field }) => (
                                    <div className="flex items-center space-x-2 pt-6">
                                        <Switch id="isRecurring" checked={field.value} onCheckedChange={field.onChange} />
                                        <Label htmlFor="isRecurring" className="text-sm font-normal flex items-center gap-2"><RefreshCw className="h-4 w-4"/> Recurring Transaction</Label>
                                    </div>
                                )} />
                            </>
                        )}
                      

                      <div className="space-y-1 lg:col-span-3">
                          <Label htmlFor="description" className="text-xs">Description</Label>
                          <Controller name="description" control={form.control} render={({ field }) => <Textarea id="description" {...field} className="text-sm" rows={3}/>} />
                      </div>
                    </div>
                    <div className="flex justify-start space-x-4 pt-4">
                      <Button type="submit" size="sm">
                        {isEditing ? <><Pen className="mr-2 h-4 w-4" /> Update Transaction</> : <><Save className="mr-2 h-4 w-4" /> Save Transaction</>}
                      </Button>
                      {isEditing && (
                        <Button type="button" variant="outline" onClick={() => {
                          setIsEditing(null);
                          form.reset(getInitialFormState());
                        }} size="sm">
                          Cancel
                        </Button>
                      )}
                    </div>
                </form>
              </CardContent>
           </SectionCard>
        </TabsContent>
      </Tabs>
      <CategoryManagerDialog
        isOpen={isCategoryManagerOpen}
        onOpenChange={setIsCategoryManagerOpen}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        onAddCategory={addCategory}
        onUpdateCategoryName={updateCategoryName}
        onDeleteCategory={deleteCategory}
        onAddSubCategory={addSubCategory}
        onDeleteSubCategory={deleteSubCategory}
      />
    </div>
  );
}
