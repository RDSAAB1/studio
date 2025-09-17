

export type Customer = {
  id: string; // Firestore unique ID
  srNo: string; // Human-readable sequential ID
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
  
  // Fields from RTGS form
  fatherName?: string;
  parchiName?: string;
  parchiAddress?: string;
  acNo?: string;
  ifscCode?: string;
  bank?: string;
  branch?: string;
  sixRNo?: string;
  sixRDate?: string;
  parchiNo?: string;
  checkNo?: string;
  utrNo?: string;
  rtgsAmount?: number;
  payments?: Payment[];

  // Fields for Customer Entry
  bags?: number;
  companyName?: string;
  brokerage?: number;
  brokerageRate?: number;
  cd?: number;
  cdRate?: number;
  isBrokerageIncluded?: boolean;
  bagWeightKg?: number;
  bagRate?: number;
  bagAmount?: number;
  isGstIncluded?: boolean;
  gstin?: string;
  
  // Shipping details
  shippingName?: string;
  shippingCompanyName?: string;
  shippingAddress?: string;
  shippingContact?: string;
  shippingGstin?: string;
  stateName?: string;
  stateCode?: string;
  shippingStateName?: string;
  shippingStateCode?: string;

  // New field
  otherCharges?: number;
  advanceFreight?: number;
  gatePassNo?: string;
  grNo?: string;
  grDate?: string;
  transport?: string;
  isDeleted?: boolean; // For soft delete
};

export type Transaction = {
  id: string; // Firestore unique ID
  transactionId: string; // Human-readable ID (e.g., IM00001, ES00001)
  date: string;
  transactionType: 'Income' | 'Expense';
  category: string;
  subCategory: string;
  amount: number;
  payee: string;
  description?: string;
  paymentMethod: 'Cash' | 'Online' | 'Cheque' | 'RTGS';
  status: 'Paid' | 'Pending' | 'Cancelled';
  invoiceNumber?: string;
  taxAmount?: number;
  expenseType?: 'Personal' | 'Business';
  isRecurring: boolean;
  recurringFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  nextDueDate?: string;
  mill?: string;
  expenseNature?: 'Permanent' | 'Seasonal';
  isCalculated?: boolean;
  quantity?: number;
  rate?: number;
  projectId?: string; 
  loanId?: string; 
  bankAccountId?: string;
  isDeleted?: boolean;
};

export type Income = Omit<Transaction, 'transactionType'> & { transactionType: 'Income' };
export type Expense = Omit<Transaction, 'transactionType'> & { transactionType: 'Expense' };


export type IncomeCategory = {
    id: string;
    name: string;
    subCategories: string[];
}
export type ExpenseCategory = {
    id: string;
    name: string;
    nature: 'Permanent' | 'Seasonal';
    subCategories: string[];
}

export type FundTransaction = {
    id: string; // Firestore unique ID
    transactionId: string; // Human-readable ID (e.g., AT0001)
    date: string;
    type: 'CapitalInflow' | 'BankWithdrawal' | 'BankDeposit' | 'CashTransfer';
    source: 'OwnerCapital' | 'BankLoan' | 'ExternalLoan' | 'BankAccount' | 'CashInHand' | 'CashAtHome' | string;
    destination: 'BankAccount' | 'CashInHand' | 'CashAtHome' | string;
    amount: number;
    description?: string;
}

export type PaidFor = {
    srNo: string;
    amount: number;
    cdApplied?: boolean;
    supplierName?: string;
    supplierSo?: string;
    supplierContact?: string;
    bankName?: string;
    bankBranch?: string;
    bankAcNo?: string;
    bankIfsc?: string;
}

export type SupplierPayment = {
    id: string; // Firestore unique ID
    paymentId: string; // Human-readable ID (e.g., SP00001)
    customerId: string; 
    date: string;
    amount: number;
    cdAmount?: number;
    cdApplied?: boolean;
    type: string; 
    receiptType: string; 
    notes?: string;
    paidFor?: PaidFor[];
    sixRNo?: string;
    sixRDate?: string;
    parchiNo?: string;
    checkNo?: string;
    utrNo?: string;
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
    rtgsFor?: 'Supplier' | 'Outsider';
    rtgsSrNo?: string; 
    expenseTransactionId?: string;
    bankAccountId?: string; 
    isDeleted?: boolean;
}

export type CustomerPayment = {
    id: string; // Firestore unique ID
    paymentId: string; // Human-readable ID (e.g., CP00001)
    customerId: string;
    date: string;
    amount: number;
    type: 'Full' | 'Partial';
    paymentMethod: 'Cash' | 'Online';
    notes?: string;
    paidFor?: { srNo: string; amount: number }[];
    incomeTransactionId?: string;
    bankAccountId?: string;
    isDeleted?: boolean;
};

export type Payment = SupplierPayment;

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
    totalDeductions: number;
    paymentHistory: (SupplierPayment | CustomerPayment)[];
    outstandingEntryIds: string[];
    // New fields for Mill Overview
    totalGrossWeight: number;
    totalTeirWeight: number;
    totalFinalWeight: number;
    totalKartaWeight: number;
    totalNetWeight: number;
    totalKartaAmount: number;
    totalLabouryAmount: number;
    totalKanta: number;
    totalOtherCharges: number;
    totalCdAmount: number;
    averageRate: number;
    averageOriginalPrice: number;
    averageKartaPercentage: number;
    averageLabouryRate: number;
    totalTransactions: number;
    totalOutstandingTransactions: number;
    allTransactions: Customer[];
    allPayments: (SupplierPayment | CustomerPayment)[];
    transactionsByVariety: { [key: string]: number };
}

export type OptionItem = {
    id: string;
    name: string;
};

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

export type BankAccount = {
    id: string;
    accountHolderName: string;
    bankName: string;
    branchName?: string;
    accountNumber: string;
    ifscCode: string;
    accountType?: 'Savings' | 'Current' | 'Loan' | 'Limit' | 'Other';
};

export type Order = {
  id: string;
  customerName: string;
  orderDate: string;
  totalAmount: number;
};

export type InventoryItem = {
    id?: string;
    name: string;
    sku: string;
    stock: number;
    unit: string;
    purchasePrice: number;
    sellingPrice: number;
    createdAt?: string;
    isDeleted?: boolean;
};

export type PurchaseOrder = {
  id: string;
  supplierId: string;
  orderDate: string;
  deliveryDate: string;
  status: 'Pending' | 'Received' | 'Cancelled';
  items: { itemId: string; quantity: number; unitPrice: number }[];
  totalAmount: number;
};

export type Employee = {
    id: string;
    employeeId: string;
    name: string;
    position: string;
    contact: string;
    baseSalary: number;
    monthlyLeaveAllowance: number;
    isDeleted?: boolean;
};

export type PayrollEntry = {
    id: string;
    employeeId: string;
    payPeriod: string; // e.g., "2024-07"
    amount: number;
    createdAt?: Date;
    updatedAt?: Date;
};

export type AttendanceEntry = {
    id: string; 
    date: string; 
    employeeId: string;
    status: 'Present' | 'Absent' | 'Leave' | 'Half-day';
};

export type Campaign = {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
};

export type ReceiptFieldSettings = {
    date: boolean;
    name: boolean;
    contact: boolean;
    address: boolean;
    vehicleNo: boolean;
    term: boolean;
    rate: boolean;
    grossWeight: boolean;
    teirWeight: boolean;
    weight: boolean;
    amount: boolean;
    dueDate: boolean;
    kartaWeight: boolean;
    netAmount: boolean;
    srNo: boolean;
    variety: boolean;
    netWeight: boolean;
};

export type ReceiptSettings = {
    companyName: string;
    companyAddress1: string;
    companyAddress2: string;
    companyGstin?: string;
    panNo?: string;
    companyStateName?: string;
    companyStateCode?: string;
    contactNo: string;
    gmail: string;
    fields: ReceiptFieldSettings;
    defaultBankAccountId?: string;
    defaultBank?: BankAccount;
    bankHeaderLine1?: string;
    bankHeaderLine2?: string;
    bankHeaderLine3?: string;
};

export type RtgsSettings = ReceiptSettings;

export type ConsolidatedReceiptData = {
    supplier: {
        name: string;
        so: string;
        address: string;
        contact: string;
    };
    entries: Customer[];
    totalAmount: number;
    date: string;
};

export type DocumentType = 'tax-invoice' | 'bill-of-supply' | 'challan';

export type Project = {
    id: string;
    name: string;
    description?: string;
    status: 'Open' | 'InProgress' | 'Completed' | 'OnHold';
    startDate: string;
    endDate?: string;
    totalCost?: number;
    totalBilled?: number;
};

export type Task = {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status: 'Open' | 'InProgress' | 'Completed';
  assignedTo?: string;
  dueDate?: string;
};

export type Loan = {
    id: string;
    loanId: string; // Human-readable ID
    loanName: string;
    loanType: 'Product' | 'Bank' | 'Outsider' | 'OwnerCapital';
    bankLoanType?: 'Fixed' | 'Limit' | 'Overdraft' | 'CashCredit';
    lenderName?: string; 
    productName?: string; 
    totalAmount: number; 
    amountPaid: number; 
    remainingAmount: number;
    interestRate: number; 
    tenureMonths: number;
    emiAmount: number;
    startDate: string;
    status?: 'Active' | 'Paid';
    depositTo: 'BankAccount' | 'CashInHand' | 'CashAtHome' | string;
    nextEmiDueDate?: string;
    isDeleted?: boolean;
}

export type SerialNumberFormat = {
    prefix: string;
    padding: number;
};

export type FormatSettings = {
    [key: string]: SerialNumberFormat;
};


    

    
