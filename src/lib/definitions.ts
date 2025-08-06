

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

export type Expense = {
    id: string;
    date: string;
    category: string;
    amount: number;
    payee: string;
    description?: string;
    paymentMethod: 'Cash' | 'Online' | 'Cheque';
    status: 'Paid' | 'Pending' | 'Cancelled';
    invoiceNumber?: string;
    taxAmount?: number;
};

export type Payment = {
    paymentId: string;
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
    totalGrossWeight: number;
    totalTeirWeight: number;
    totalNetWeight: number;
    totalKartaAmount: number;
    totalLabouryAmount: number;
    totalCdAmount: number;
    averageRate: number;
    totalTransactions: number;
    totalOutstandingTransactions: number;
    allTransactions: Customer[];
    allPayments: Payment[];
    transactionsByVariety?: { [key: string]: number };
}

export type AppOptions = {
    varieties: string[];
    receiptTypes: string[];
    paymentTypes: string[];
}

    

    