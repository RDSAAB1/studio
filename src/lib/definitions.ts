

export type Customer = {
  id: string;
  srNo: string;
  date: string;
  term: string;
  dueDate: string;
  name: string;
  so: string;
  address: string;
  contact: string;
  vehicleNo: string;
  variety: string;
  grossWeight: number;
  teirWeight: number;
  weight: number;
  kartaPercentage: number;
  kartaWeight: number;
  kartaAmount: number;
  netWeight: number;
  rate: number;
  labouryRate: number;
  labouryAmount: number;
  kanta: number;
  amount: number;
  netAmount: number | string;
  originalNetAmount: number;
  barcode: string;
  receiptType: string;
  paymentType: string;
  customerId: string;
  searchValue?: string;
  
  // Fields from RTGS form
  fatherName?: string;
  parchiName?: string;
  parchiAddress?: string;
  acNo?: string;
  ifscCode?: string;
  bank?: string;
  branch?: string;
  grNo?: string;
  grDate?: string;
  parchiNo?: string;
  parchiDate?: string;
  checkNo?: string;
  utrNo?: string;
  rtgsAmount?: number;
};

export type Transaction = {
    id: string;
    date: string;
    transactionType: 'Income' | 'Expense';
    category: string;
    subCategory: string;
    amount: number;
    payee: string;
    description?: string;
    paymentMethod: 'Cash' | 'Online' | 'Cheque';
    status: 'Paid' | 'Pending' | 'Cancelled';
    invoiceNumber?: string;
    taxAmount?: number;
    expenseType?: 'Personal' | 'Business';
    isRecurring: boolean;
    mill?: string;
    expenseNature?: 'Permanent' | 'Seasonal';
};

export type FundTransaction = {
    id: string;
    date: string;
    type: 'CapitalInflow' | 'BankWithdrawal' | 'BankDeposit';
    source: 'OwnerCapital' | 'BankLoan' | 'ExternalLoan' | 'BankAccount' | 'CashInHand';
    destination: 'BankAccount' | 'CashInHand';
    amount: number;
    description?: string;
}

export type Payment = {
    paymentId: string;
    customerId: string;
    date: string;
    amount: number;
    cdAmount: number;
    type: string;
    receiptType: string;
    notes: string;
}

export type CustomerSummary = {
    name: string;
    contact: string;
    so?: string;
    address?: string;
    acNo?: string;
    ifscCode?: string;
    bank?: string;
    branch?: string;
    totalOutstanding: number;
    totalAmount: number;
    totalPaid: number;
    paymentHistory: Payment[];
    outstandingEntryIds: string[];
    // New fields for Mill Overview
    totalGrossWeight?: number;
    totalTeirWeight?: number;
    totalNetWeight?: number;
    totalKartaAmount?: number;
    totalLabouryAmount?: number;
    totalCdAmount?: number;
    averageRate?: number;
    totalTransactions?: number;
    totalOutstandingTransactions?: number;
    allTransactions?: Customer[];
    allPayments?: Payment[];
    transactionsByVariety?: { [key: string]: number };
}

export type AppOptions = {
    varieties: string[];
    receiptTypes: string[];
    paymentTypes: string[];
}
