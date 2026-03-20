/**
 * Excel ↔ UI mapping — single source of truth.
 * - Excel column header = object key = same key used in UI (definitions.ts types).
 * - Order here = column order in Excel files (read/write). UI reads these keys from Dexie.
 * - Keep in sync with: Customer, Payment, CustomerPayment, LedgerAccount, etc. in definitions.ts
 */

/** Per-collection Excel column order. Keys must match UI/type fields so Excel data shows correctly in UI. */
export const EXCEL_COLUMN_ORDER: Record<string, string[]> = {
  // Supplier/Customer entry (Customer type)
  suppliers: [
    'id', 'srNo', 'date', 'term', 'dueDate', 'name', 'so', 'address', 'contact', 'vehicleNo', 'variety',
    'grossWeight', 'teirWeight', 'weight', 'kartaPercentage', 'kartaWeight', 'kartaAmount', 'netWeight',
    'rate', 'labouryRate', 'labouryAmount', 'brokerageRate', 'brokerageAmount', 'kanta', 'amount', 'netAmount',
    'originalNetAmount', 'barcode', 'receiptType', 'paymentType', 'customerId', 'totalPaid', 'totalCd',
    'fatherName', 'parchiName', 'parchiAddress', 'acNo', 'ifscCode', 'bank', 'branch', 'bags', 'companyName',
    'brokerage', 'cd', 'cdRate', 'cdAmount', 'isBrokerageIncluded', 'bagWeightKg', 'bagRate', 'bagAmount',
    'transportationRate', 'transportAmount', 'isGstIncluded', 'hsnCode', 'taxRate', 'gstin',
    'createdAt', 'updatedAt',
  ],
  customers: [
    'id', 'srNo', 'date', 'term', 'dueDate', 'name', 'so', 'address', 'contact', 'vehicleNo', 'variety',
    'grossWeight', 'teirWeight', 'weight', 'kartaPercentage', 'kartaWeight', 'kartaAmount', 'netWeight',
    'rate', 'labouryRate', 'labouryAmount', 'brokerageRate', 'brokerageAmount', 'kanta', 'amount', 'netAmount',
    'originalNetAmount', 'barcode', 'receiptType', 'paymentType', 'customerId', 'totalPaid', 'totalCd',
    'fatherName', 'parchiName', 'bags', 'companyName', 'brokerage', 'cd', 'cdRate', 'cdAmount',
    'isBrokerageIncluded', 'bagWeightKg', 'bagRate', 'bagAmount', 'transportationRate', 'transportAmount',
    'isGstIncluded', 'hsnCode', 'taxRate', 'gstin', 'createdAt', 'updatedAt',
  ],

  // Supplier payments (Payment / SupplierPayment type) — main sheet columns (paidFor in separate sheet)
  payments: [
    'id', 'paymentId', 'customerId', 'date', 'amount', 'drCr', 'advanceAmount', 'type', 'receiptType',
    'paymentMethod', 'supplierId', 'notes', 'cdAmount', 'cdApplied', 'nineRNo', 'sixRDate',
    'parchiNo', 'parchiName', 'checkNo', 'utrNo', 'rtgsAmount', 'supplierName', 'supplierFatherName',
    'supplierAddress', 'bankName', 'bankBranch', 'bankAcNo', 'bankIfsc', 'bankDetails', 'supplierDetails',
    'rtgsSrNo', 'govQuantity', 'govRate', 'govAmount', 'govExtraAmount', 'centerName',
    'expenseTransactionId', 'bankAccountId', 'isDeleted', 'createdAt', 'updatedAt',
  ],
  customerPayments: [
    'id', 'paymentId', 'customerId', 'date', 'amount', 'type', 'paymentMethod', 'notes',
    'cdAmount', 'receiptType', 'rtgsAmount', 'rtgsSrNo', 'incomeTransactionId', 'bankAccountId',
    'isDeleted', 'createdAt', 'updatedAt',
  ],

  /** PaidFor sheet: one row per receipt/entry link. paymentId links to Payments sheet. */
  paidFor: [
    'paymentId', 'srNo', 'amount', 'cdAmount', 'parchiNo', 'sixRDate', 'supplierName', 'supplierFatherName',
    'supplierAddress', 'adjustedOriginal', 'adjustedOutstanding', 'receiptOutstanding', 'extraAmount',
    'type', 'receiptType', 'supplierId', 'utrNo', 'updatedAt',
  ],

  // Ledger
  ledgerAccounts: ['id', 'name', 'address', 'contact', 'createdAt', 'updatedAt'],
  ledgerEntries: ['id', 'accountId', 'date', 'particulars', 'remarks', 'debit', 'credit', 'balance', 'createdAt', 'updatedAt', 'linkGroupId', 'linkStrategy'],
  ledgerCashAccounts: ['id', 'name', 'noteGroups', 'createdAt', 'updatedAt'],

  // Cash & Bank (Bank, BankBranch, BankAccount types)
  banks: ['id', 'name', 'createdAt', 'updatedAt'],
  bankBranches: ['id', 'bankName', 'branchName', 'ifscCode'],
  bankAccounts: ['id', 'accountHolderName', 'bankName', 'branchName', 'accountNumber', 'ifscCode', 'accountType'],
  supplierBankAccounts: ['id', 'accountHolderName', 'bankName', 'branchName', 'accountNumber', 'ifscCode', 'accountType', 'supplierId'],

  // Transactions (expense/income → Transaction type)
  expenses: [
    'id', 'transactionId', 'date', 'type', 'transactionType', 'category', 'subCategory', 'amount', 'payee',
    'description', 'paymentMethod', 'status', 'taxAmount', 'cdAmount', 'expenseType', 'mill', 'expenseNature',
    'projectId', 'loanId', 'bankAccountId', 'isRecurring', 'isDeleted', 'createdAt', 'updatedAt',
  ],
  incomes: [
    'id', 'transactionId', 'date', 'type', 'transactionType', 'category', 'subCategory', 'amount', 'payee',
    'description', 'paymentMethod', 'status', 'taxAmount', 'cdAmount', 'projectId', 'bankAccountId',
    'isRecurring', 'isDeleted', 'createdAt', 'updatedAt',
  ],

  // Reports & HR
  mandiReports: [
    'id', 'voucherNo', 'bookNo', 'purchaseDate', 'sellerName', 'fatherName', 'district', 'tehsil', 'village',
    'khasraNo', 'khasraArea', 'mobile', 'commodity', 'quantityQtl', 'ratePerQtl', 'grossAmount', 'netAmount',
    'mandiFee', 'developmentCess', 'totalCharges', 'paymentAmount', 'paymentDate', 'paymentMode',
    'bankAccount', 'ifsc', 'bankName', 'bankBranch', 'transactionNumber', 'traderReceiptNo', 'traderName',
    'buyerFirm', 'buyerLicense', 'mandiName', 'mandiSiteType', 'mandiSiteName', 'narration', 'createdAt', 'updatedAt',
  ],
  employees: ['id', 'name', 'email', 'phone', 'role', 'createdAt', 'updatedAt'],
  payroll: ['id', 'employeeId', 'period', 'amount', 'createdAt', 'updatedAt'],
  attendance: ['id', 'employeeId', 'date', 'status', 'createdAt', 'updatedAt'],

  // Entry & Projects
  inventoryItems: ['id', 'name', 'variety', 'unit', 'createdAt', 'updatedAt'],
  projects: ['id', 'name', 'description', 'createdAt', 'updatedAt'],

  // Cash & Bank: Loan Management & Fund Transactions
  loans: [
    'id', 'loanId', 'loanName', 'loanType', 'bankLoanType', 'lenderName', 'productName',
    'totalAmount', 'amountPaid', 'remainingAmount', 'interestRate', 'tenureMonths', 'emiAmount',
    'startDate', 'status', 'depositTo', 'nextEmiDueDate', 'isDeleted',
  ],
  fundTransactions: [
    'id', 'transactionId', 'date', 'type', 'source', 'destination', 'amount', 'description',
  ],

  // Settings: Options, Firm details, Categories, Accounts, Manufacturing
  options: ['id', 'type', 'name'],
  settings: ['id', 'firmName', 'firmAddress', 'mandiName', 'licenseNo', 'licenseNo2', 'mandiType', 'registerNo', 'commodity', 'financialYear', 'updatedAt'],
  incomeCategories: ['id', 'name', 'subCategories'],
  expenseCategories: ['id', 'name', 'nature', 'subCategories'],
  accounts: ['id', 'name', 'contact', 'address', 'nature', 'category', 'subCategory', 'updatedAt'],
  manufacturingCosting: ['id', 'buyingRate', 'expense', 'quantity', 'extraCost', 'products', 'costAllocationMethod', 'overallTargetProfit', 'createdAt', 'updatedAt'],
  // Entry: Kanta Parchi, Customer Documents, Inventory Add
  kantaParchi: [
    'id', 'srNo', 'date', 'name', 'contact', 'vehicleNo', 'variety', 'grossWeight', 'teirWeight', 'weight', 'netWeight',
    'rate', 'bags', 'bagWeightKg', 'bagRate', 'bagAmount', 'amount', 'cdRate', 'cdAmount', 'brokerageRate', 'brokerageAmount',
    'isBrokerageIncluded', 'kanta', 'advanceFreight', 'originalNetAmount', 'netAmount', 'paymentType', 'customerId', 'createdAt', 'updatedAt',
  ],
  customerDocuments: [
    'id', 'documentSrNo', 'kantaParchiSrNo', 'documentType', 'date', 'name', 'companyName', 'address', 'contact', 'gstin', 'stateName', 'stateCode',
    'hsnCode', 'taxRate', 'isGstIncluded', 'nineRNo', 'gatePassNo', 'grNo', 'grDate', 'transport',
    'shippingName', 'shippingCompanyName', 'shippingAddress', 'shippingContact', 'shippingGstin', 'shippingStateName', 'shippingStateCode',
    'netWeight', 'rate', 'amount', 'cdAmount', 'brokerageAmount', 'kanta', 'bagAmount', 'advanceFreight', 'taxableAmount', 'cgstAmount', 'sgstAmount', 'totalTaxAmount', 'totalInvoiceValue',
    'createdAt', 'updatedAt',
  ],
  inventoryAddEntries: ['id', 'date', 'variety', 'rate', 'bagsQuantity', 'bagsWeight', 'quantity', 'amount', 'createdAt', 'updatedAt'],
};
