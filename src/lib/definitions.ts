

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
  sixRNo?: string;
  sixRDate?: string;
  parchiNo?: string;
  checkNo?: string;
  utrNo?: string;
  rtgsAmount?: number;
  payments?: Payment[]; // To track which payments have been applied

  // New fields for Customer Entry
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

  // New field
  otherCharges?: number;
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
    recurringFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    nextDueDate?: string;
    mill?: string;
    expenseNature?: 'Permanent' | 'Seasonal';
    isCalculated?: boolean;
    quantity?: number;
    rate?: number;
    projectId?: string; // Link to a project
    loanId?: string; // Link to a loan
};

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
    supplierName?: string;
    supplierSo?: string;
    supplierContact?: string;
    bankName?: string;
    bankBranch?: string;
    bankAcNo?: string;
    bankIfsc?: string;
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
    rtgsSrNo?: string; // New field for RTGS serial number
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
    totalDeductions: number;
    paymentHistory: Payment[];
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
    allPayments: Payment[];
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
    id: string; // Composite key: `${date}-${employeeId}`
    date: string; // Format: 'YYYY-MM-DD'
    employeeId: string;
    status: 'Present' | 'Absent' | 'Leave' | 'Half-day';
    checkIn?: string; // e.g., '09:00 AM'
    checkOut?: string; // e.g., '05:00 PM'
    notes?: string;
};

export type Campaign = {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
};

export type RtgsSettings = {
    companyName: string;
    companyAddress1: string;
    companyAddress2: string;
    bankName: string;
    ifscCode: string;
    branchName: string;
    accountNo: string;
    contactNo: string;
    gmail: string;
    type: string;
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
    address1: string;
    address2: string;
    contactNo: string;
    email: string;
    fields: ReceiptFieldSettings;
};

// New type for consolidated receipt data
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

// Project Management Types
export type Project = {
    id: string;
    name: string;
    description?: string;
    status: 'Open' | 'InProgress' | 'Completed' | 'OnHold';
    startDate: string;
    endDate?: string;
    totalCost?: number; // Optional: Total estimated or actual cost of the project
    totalBilled?: number; // Optional: Total amount billed or expensed against the project
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
    loanName: string;
    loanType: 'Product' | 'Bank' | 'Outsider';
    bankLoanType?: 'Fixed' | 'Limit' | 'Overdraft' | 'CashCredit';
    lenderName?: string; // For Bank or Outsider
    productName?: string; // For Product loan
    totalAmount: number; // Total cost for Product, Limit for Bank, Principal for Outsider
    amountPaid: number; // DP for Product, amount repaid for others
    remainingAmount: number;
    interestRate: number; // Annual for Bank, Monthly for Outsider
    tenureMonths: number;
    emiAmount: number; // Only for Product loan
    startDate: string;
    status?: 'Active' | 'Paid';
    paymentMethod: 'Bank' | 'Cash';
    nextEmiDueDate?: string;
}
