
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
  brokerageRate: number;
  brokerageAmount: number;
  brokerageAddSubtract?: boolean;
  kanta: number;
  amount: number;
  netAmount: number | string;
  originalNetAmount: number;
  barcode: string;
  receiptType: string;
  paymentType: string;
  customerId: string;
  forceUnique?: boolean;
  totalPaid?: number; // Total amount paid towards this entry
  totalCd?: number;   // Total CD applied to this entry
  
  // Fields from RTGS form
  fatherName?: string;
  parchiName?: string;
  parchiAddress?: string;
  acNo?: string;
  ifscCode?: string;
  bank?: string;
  branch?: string;
  nineRNo?: string;
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
  cd?: number;
  cdRate?: number;
  cdAmount?: number;
  isBrokerageIncluded?: boolean;
  bagWeightKg?: number;
  bagRate?: number;
  bagAmount?: number;
  bagWeightDeductionAmount?: number; // Bag Weight (QTL) × Rate deduction from amount
  transportationRate?: number; // Transportation rate per QTL
  transportAmount?: number; // Transport Amount = Transportation Rate × Final Weight
  isGstIncluded?: boolean;
  hsnCode?: string;
  taxRate?: number;
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
  advancePaymentMethod?: string;
  advancePaymentAccountId?: string;
  advanceExpenseId?: string;
  gatePassNo?: string;
  grNo?: string;
  grDate?: string;
  transport?: string;
  isDeleted?: boolean; // For soft delete
  
  // RICE BRAN specific fields
  baseReport?: number; // Base report for rate calculation
  collectedReport?: number; // Collected report for rate calculation
  riceBranGst?: number; // GST amount to add to calculated rate
  calculatedRate?: number; // Final calculated rate for RICE BRAN entries
};

export type Supplier = Customer;

export interface ManufacturingCostingData {
    id: string;
    buyingRate: number;
    expense: number;
    quantity: number;
    extraCost?: number; // Extra cost for waste products (products that cannot be sold)
    products: Array<{
        id: string;
        name: string;
        percentage: number;
        sellingPrice?: number;
        soldPercentage?: number;
        targetProfit?: number;
    }>;
    costAllocationMethod?: 'percentage' | 'value';
    overallTargetProfit?: number;
    createdAt?: string;
    updatedAt?: string;
}

// Kanta Parchi - Separate collection for weight/calculation entries
export type KantaParchi = {
  id: string; // Firestore unique ID
  srNo: string; // Human-readable sequential ID (e.g., KP0001)
  date: string;
  name: string;
  contact: string;
  vehicleNo: string;
  variety: string;
  grossWeight: number;
  teirWeight: number;
  weight: number;
  netWeight: number;
  rate: number;
  bags: number;
  bagWeightKg: number;
  bagRate: number;
  bagAmount: number;
  amount: number;
  cdRate: number; // CD percentage
  cdAmount: number; // Calculated CD amount
  brokerageRate: number; // Brokerage rate per quintal
  brokerageAmount: number; // Calculated brokerage amount
  isBrokerageIncluded: boolean;
  kanta: number;
  advanceFreight: number;
  originalNetAmount: number;
  netAmount: number;
  paymentType: string;
  customerId: string;
  createdAt?: string;
  updatedAt?: string;
};

// Customer Document - Separate collection for tax invoice/bill of supply/chalan
export type CustomerDocument = {
  id: string; // Firestore unique ID
  documentSrNo: string; // Document serial number (e.g., DOC0001)
  kantaParchiSrNo: string; // Reference to Kanta Parchi srNo (read-only reference)
  documentType: 'tax-invoice' | 'bill-of-supply' | 'challan';
  date: string;
  
  // Customer details (copied from Kanta Parchi for reference, read-only)
  name: string;
  companyName?: string;
  address: string;
  contact: string;
  gstin?: string;
  stateName?: string;
  stateCode?: string;
  
  // Document creation fields
  hsnCode: string;
  taxRate: number;
  isGstIncluded: boolean;
  nineRNo?: string;
  gatePassNo?: string;
  grNo?: string;
  grDate?: string;
  transport?: string;
  
  // Shipping details
  shippingName?: string;
  shippingCompanyName?: string;
  shippingAddress?: string;
  shippingContact?: string;
  shippingGstin?: string;
  shippingStateName?: string;
  shippingStateCode?: string;
  
  // Calculated amounts (from Kanta Parchi reference)
  netWeight: number;
  rate: number;
  amount: number;
  cdAmount: number;
  brokerageAmount: number;
  kanta: number;
  bagAmount: number;
  advanceFreight: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  totalTaxAmount: number;
  totalInvoiceValue: number;
  
  createdAt?: string;
  updatedAt?: string;
};

export type Transaction = {
  id: string; // Firestore unique ID
  transactionId: string; // Human-readable ID (e.g., IN00001, EX00001)
  date: string;
  type?: 'Income' | 'Expense';
  transactionType: 'Income' | 'Expense';
  category: string;
  subCategory: string;
  amount: number;
  payee: string;
  description?: string;
  paymentMethod: 'Cash' | 'Online' | 'Cheque' | 'RTGS' | 'Other';
  status: 'Paid' | 'Pending' | 'Cancelled';
  taxAmount?: number;
  cdAmount?: number;
  expenseType?: 'Personal' | 'Business';
  mill?: string;
  expenseNature?: 'Permanent' | 'Seasonal';
  projectId?: string; 
  loanId?: string; 
  bankAccountId?: string;
  isRecurring?: boolean;
  isDeleted?: boolean;
  createdAt?: string; // ISO timestamp for sorting/ordering
  updatedAt?: string;
};

export type Income = Omit<Transaction, 'transactionType'> & { transactionType: 'Income' };
export type Expense = Omit<Transaction, 'transactionType'> & { transactionType: 'Expense' };

export type Account = {
  id: string;
  name: string;
  contact?: string;
  address?: string;
  nature?: 'Permanent' | 'Seasonal';
  category?: string;
  subCategory?: string;
  updatedAt?: string;
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
    id: string; // Firestore unique ID
    transactionId?: string; // Human-readable ID (e.g., AT0001)
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
    cdAmount?: number; // CD amount allocated to this specific entry
    parchiNo?: string; // Parchi No (SR#) of the payment (for tracking extra amount reference)
    receiptOutstanding?: number; // Current receipt outstanding before payment
    extraAmount?: number; // Extra amount allocated to this specific entry (Gov. Bonus etc)
    adjustedOriginal?: number;
    adjustedOutstanding?: number;
    
    // Additional fields for extended tracking
    paymentId?: string;
    receiptType?: string;
    sixRDate?: string;
    supplierId?: string;
    supplierName?: string;
    supplierContact?: string;
    supplierFatherName?: string;
    supplierAddress?: string;
    type?: string;
    updatedAt?: unknown;
    utrNo?: string;
};

export type SupplierPayment = {
    id: string; // Firestore unique ID
    paymentId: string; // Human-readable ID (e.g., SP00001)
    customerId: string; 
    date: string;
    amount: number;
    drCr?: 'Debit' | 'Credit';
    advanceAmount?: number;
    createdAt?: unknown;
    updatedAt?: unknown;
    cdAmount?: number;
    cdApplied?: boolean;
    type: string; 
    receiptType: string; 
    paymentMethod?: string;
    supplierId?: string;
    notes?: string;
    paidFor?: PaidFor[];
    nineRNo?: string;
    sixRDate?: string;
    parchiNo?: string;
    parchiName?: string;
    checkNo?: string;
    utrNo?: string;
    sixRNo?: string;
    quantity?: number;
    rate?: number;
    rtgsAmount?: number;
    supplierName?: string;
    supplierFatherName?: string;
    supplierAddress?: string;
    rtgsFor?: string;
    bankName?: string;
    bankBranch?: string;
    bankAcNo?: string;
    bankIfsc?: string;
    bankDetails?: { bank?: string; branch?: string; ifscCode?: string; acNo?: string };
    supplierDetails?: { name?: string; fatherName?: string; address?: string; contact?: string; [key: string]: unknown };
    rtgsSrNo?: string; 
    // Gov. payment specific fields
    govQuantity?: number;
    govRate?: number;
    govAmount?: number;
    govExtraAmount?: number;
    centerName?: string;
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
    createdAt?: unknown;
    updatedAt?: unknown;
    type: 'Full' | 'Partial';
    paymentMethod: 'Cash' | 'Online';
    notes?: string;
    paidFor?: PaidFor[];
    cdAmount?: number;
    receiptType?: string;
    rtgsAmount?: number;
    rtgsSrNo?: string;
    incomeTransactionId?: string;
    bankAccountId?: string;
    isDeleted?: boolean;
};

export type Payment = SupplierPayment;

export type MandiReport = {
    id: string;
    voucherNo: string;
    bookNo?: string;
    purchaseDate?: string;
    sellerName: string;
    fatherName?: string;
    district?: string;
    tehsil?: string;
    village?: string;
    khasraNo?: string;
    khasraArea?: string;
    mobile?: string;
    commodity?: string;
    quantityQtl?: number;
    ratePerQtl?: number;
    grossAmount?: number;
    netAmount?: number;
    mandiFee?: number;
    developmentCess?: number;
    totalCharges?: number;
    paymentAmount?: number;
    paymentDate?: string;
    paymentMode?: string;
    bankAccount?: string;
    ifsc?: string;
    bankName?: string;
    bankBranch?: string;
    transactionNumber?: string;
    traderReceiptNo?: string;
    traderName?: string;
    buyerFirm?: string;
    buyerLicense?: string;
    mandiName?: string;
    mandiSiteType?: string;
    mandiSiteName?: string;
    narration?: string;
    createdAt?: string;
    updatedAt?: string;
};

export type CustomerSummary = {
    name: string;
    contact: string;
    so?: string;
    address?: string;
    companyName?: string;
    acNo?: string;
    ifscCode?: string;
    bank?: string;
    branch?: string;
    totalAmount: number;
    totalOriginalAmount: number;
    totalPaid: number;
    totalCashPaid: number;
    totalRtgsPaid: number;
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
    minRate: number;
    maxRate: number;
    averageOriginalPrice: number;
    averageKartaPercentage: number;
    averageLabouryRate: number;
    totalTransactions: number;
    totalOutstandingTransactions: number;
    allTransactions: Customer[];
    allPayments: (SupplierPayment | CustomerPayment)[];
    transactionsByVariety: { [key: string]: number };
    totalBrokerage?: number;
    totalCd?: number;
    totalGovExtraAmount?: number; // Total Gov Extra Amount
    totalBaseOriginalAmount?: number; // Base Original Amount (without Extra)
}

export type OptionItem = {
    id: string;
    name: string;
    type?: string;
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
    id: string;
    sku: string;
    name: string;
    description?: string;
    quantity: number;
    unit?: string;
    costPrice?: number;
    sellingPrice?: number;
    supplierId?: string;
    category?: string;
    createdAt?: string;
    updatedAt?: string;
};

export type LedgerAccount = {
  id: string;
  name: string;
  address?: string;
  contact?: string;
  createdAt: string;
  updatedAt: string;
};

export type LedgerEntry = {
  id: string;
  accountId: string;
  date: string;
  particulars: string;
  remarks?: string;
  debit: number;
  credit: number;
  balance: number;
  createdAt: string;
  updatedAt: string;
  linkGroupId?: string;
  linkStrategy?: "mirror" | "same";
};

export type LedgerAccountInput = Omit<LedgerAccount, "id" | "createdAt" | "updatedAt">;
export type LedgerEntryInput = Omit<LedgerEntry, "id" | "createdAt" | "updatedAt" | "balance"> & {
  balance?: number;
};

export type LedgerCashAccount = {
  id: string;
  name: string;
  noteGroups: Record<string, number[]>;
  createdAt: string;
  updatedAt: string;
};

export type LedgerCashAccountInput = Omit<LedgerCashAccount, "id" | "createdAt" | "updatedAt">;

export type PurchaseOrder = {
  id: string;
  supplierId: string;
  orderDate: string;
  deliveryDate: string;
  status: 'Pending' | 'Received' | 'Cancelled';
  items: { itemId: string; quantity: number; unitPrice: number }[];
  totalAmount: number;
};

export type SyncTaskStatus = "pending" | "processing" | "failed";

export type SyncTask<TPayload = unknown> = {
  id?: number;
  type: string;
  payload: TPayload;
  attempts: number;
  status: SyncTaskStatus;
  createdAt: string;
  lastTriedAt?: string;
  lastError?: string;
  nextRetryAt?: number;
  dedupeKey?: string;
};

export type MandiHeaderSettings = {
  firmName: string;
  firmAddress: string;
  mandiName: string;
  licenseNo: string;
  licenseNo2: string;
  mandiType: string;
  registerNo: string;
  commodity: string;
  financialYear: string;
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
    type?: string;
    bankName?: string;
    accountNo?: string;
    branchName?: string;
    ifscCode?: string;
    bankHeaderLine1?: string;
    bankHeaderLine2?: string;
    bankHeaderLine3?: string;
};

export type RtgsSettings = ReceiptSettings;

export type ConsolidatedReceiptData = {
    customer: Customer;
    receipts: Customer[];
    totalAmount: number;
    totalWeight: number;
    totalNetWeight: number;
    totalKartaAmount: number;
    totalLabAmount: number;
    totalNetAmount: number;
    receiptCount: number;
};

export type DocumentType = 'tax-invoice' | 'bill-of-supply' | 'challan' | 'receipt' | 'rtgs-receipt';

export type Project = {
    id: string;
    name: string;
    description?: string;
    status: 'Open' | 'InProgress' | 'Completed' | 'OnHold';
    startDate: string;
    endDate?: string;
    totalCost?: number;
    totalBilled?: number;
    createdAt?: string;
    updatedAt?: string;
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


export type Holiday = {
    id: string;
    date: string;
    name: string;
}
    
