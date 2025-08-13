










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
  otherCharges?: number;
  
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
  checkNo?: string;
  utrNo?: string;
  rtgsAmount?: number;
  payments?: Payment[]; // To track which payments have been applied
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

export type PaidFor = {
    srNo: string;
    amount: number;
    cdApplied: boolean;
}

export type Payment = {
    id: string;
    paymentId: string;
    customerId: string;
    date: string;
    amount: number;
    cdAmount: number;
    cdApplied: boolean;
    type: string;
    receiptType: string;
    notes: string;
    paidFor?: PaidFor[];
    grNo?: string;
    grDate?: string;
    parchiNo?: string;
    utrNo?: string;
    checkNo?: string;
    quantity?: number;
    rate?: number;
    rtgsAmount?: number;
    supplierName?: string;
    supplierFatherName?: string;
    supplierAddress?: string;
    bankName?: string;
    bankBranch?: string;
    bankAcNo?: string;
    bankIfsc?: string;
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
    totalAmount: number;
    totalOriginalAmount: number;
    totalPaid: number;
    totalOutstanding: number;
    totalDeductions?: number;
    paymentHistory: Payment[];
    outstandingEntryIds: string[];
    // New fields for Mill Overview
    totalGrossWeight?: number;
    totalTeirWeight?: number;
    totalFinalWeight?: number;
    totalKartaWeight?: number;
    totalNetWeight?: number;
    totalKartaAmount?: number;
    totalLabouryAmount?: number;
    totalKanta?: number;
    totalOtherCharges?: number;
    totalCdAmount?: number;
    averageRate?: number;
    averageOriginalPrice?: number;
    averageKartaPercentage?: number;
    averageLabouryRate?: number;
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

export type Bank = {
    id: string;
    name: string;
}

export type BankBranch = {
    id: string;
    bankName: string;
    branchName: string;
    ifscCode: string;
};
