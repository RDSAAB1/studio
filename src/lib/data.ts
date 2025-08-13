import type { Customer, Transaction, FundTransaction, BankBranch, Bank } from "./definitions";

export const initialCustomers: Customer[] = [
    {
        id: "1", srNo: 'S00001', date: '2025-07-01', term: '30', dueDate: '2025-07-31', name: 'Rahul Sharma', so: 'Suresh Sharma', address: '123, Gandhi Nagar', contact: '9876543210',
        vehicleNo: 'DL12AB3456', variety: 'Wheat', grossWeight: 1000, teirWeight: 50, weight: 950, kartaPercentage: 1, kartaWeight: 9.5, kartaAmount: 95,
        netWeight: 940.5, rate: 10, labouryRate: 0.5, labouryAmount: 475, kanta: 10, amount: 9405, netAmount: 8920,
        barcode: 'BAR001', receiptType: 'Cash', paymentType: 'Partial', customerId: 'rahul sharma|9876543210'
    },
    {
        id: "2", srNo: 'S00002', date: '2025-07-10', term: '15', dueDate: '2025-07-25', name: 'Priya Singh', so: 'Anil Singh', address: '456, Nehru Colony', contact: '9988776655',
        vehicleNo: 'UP78CD9012', variety: 'Rice', grossWeight: 1500, teirWeight: 70, weight: 1430, kartaPercentage: 0.5, kartaWeight: 7.15, kartaAmount: 71.5,
        netWeight: 1422.85, rate: 12, labouryRate: 0.6, labouryAmount: 858, kanta: 15, amount: 17074.2, netAmount: 16201.2,
        barcode: 'BAR002', receiptType: 'Online', paymentType: 'Full', customerId: 'priya singh|9988776655'
    },
    {
        id: "3", srNo: 'S00003', date: '2025-07-15', term: '0', dueDate: '2025-07-15', name: 'Rahul Sharma', so: 'Suresh Sharma', address: '123, Gandhi Nagar', contact: '9876543210',
        vehicleNo: 'RJ01EF2345', variety: 'Corn', grossWeight: 800, teirWeight: 40, weight: 760, kartaPercentage: 0, kartaWeight: 0, kartaAmount: 0,
        netWeight: 760, rate: 8, labouryRate: 0.4, labouryAmount: 304, kanta: 5, amount: 6080, netAmount: 5771,
        barcode: 'BAR003', receiptType: 'Cash', paymentType: 'Partial', customerId: 'rahul sharma|9876543210'
    },
    {
        id: "4", srNo: 'S00004', date: '2025-07-20', term: '60', dueDate: '2025-09-18', name: 'Amit Kumar', so: 'Rajesh Kumar', address: '789, Patel Chowk', contact: '9123456789',
        vehicleNo: 'HR56GH7890', variety: 'Barley', grossWeight: 1200, teirWeight: 60, weight: 1140, kartaPercentage: 0.8, kartaWeight: 9.12, kartaAmount: 91.2,
        netWeight: 1130.88, rate: 9, labouryRate: 0.45, labouryAmount: 513, kanta: 12, amount: 10177.92, netAmount: 9652.92,
        barcode: 'BAR004', receiptType: 'Online', paymentType: 'Full', customerId: 'amit kumar|9123456789'
    }
];

export const initialTransactions: Transaction[] = [
    { id: '1', date: '2025-07-20', transactionType: 'Expense', category: 'Staff & Administrative Costs', subCategory: 'Salaries', amount: 150000, payee: 'Staff Payroll', description: 'July 2025 Salaries', paymentMethod: 'Online', status: 'Paid', invoiceNumber: 'INV-001', taxAmount: 75, expenseType: 'Business', isRecurring: true, mill: 'Main Mill', expenseNature: 'Permanent' },
    { id: '2', date: '2025-07-19', transactionType: 'Expense', category: 'Production & Operational Costs', subCategory: 'Electricity & Fuel', amount: 4500, payee: 'Electricity Board', description: 'Monthly electricity bill', paymentMethod: 'Online', status: 'Paid', invoiceNumber: 'INV-002', taxAmount: 225, expenseType: 'Business', isRecurring: true, mill: 'Main Mill', expenseNature: 'Seasonal' },
    { id: '3', date: '2025-07-25', transactionType: 'Income', category: 'Sales of Goods', subCategory: 'Rice Sales', amount: 500000, payee: 'Local Distributor', description: 'Bulk rice sale', paymentMethod: 'Online', status: 'Paid', invoiceNumber: 'SALE-001', taxAmount: 25000, isRecurring: false, mill: 'Main Mill' },
    { id: '4', date: '2025-07-18', transactionType: 'Expense', category: 'Repairs & Maintenance', subCategory: 'Annual Maintenance Contracts', amount: 25000, payee: 'Agro Repairs Co.', description: 'Tractor maintenance', paymentMethod: 'Cheque', status: 'Pending', invoiceNumber: 'INV-004', taxAmount: 1250, expenseType: 'Business', isRecurring: false, mill: 'Main Mill', expenseNature: 'Permanent' },
    { id: '5', date: '2025-07-26', transactionType: 'Income', category: 'Service Income', subCategory: 'Milling Services', amount: 5000, payee: 'Local Farmer', description: 'Paddy milling service', paymentMethod: 'Cash', status: 'Paid', invoiceNumber: 'SERV-001', taxAmount: 250, isRecurring: false, mill: 'Service Unit' },
];

export const initialFundTransactions: FundTransaction[] = [
    { id: 'F1', date: '2025-06-01', type: 'CapitalInflow', source: 'OwnerCapital', destination: 'BankAccount', amount: 1000000, description: 'Initial capital from owner' },
    { id: 'F2', date: '2025-06-05', type: 'CapitalInflow', source: 'BankLoan', destination: 'BankAccount', amount: 500000, description: 'Loan from HDFC Bank' },
    { id: 'F3', date: '2025-06-10', type: 'BankWithdrawal', source: 'BankAccount', destination: 'CashInHand', amount: 50000, description: 'Cash for initial setup expenses' },
];


export const appOptionsData = {
    varieties: ['Wheat', 'Rice', 'Corn', 'Barley'],
    receiptTypes: ['Cash', 'Online'],
    paymentTypes: ['Full', 'Partial'],
};

export const bankNames = [
    "SBI - State Bank of India", "PNB - Punjab National Bank", "BoB - Bank of Baroda", "CB - Canara Bank",
    "UBI - Union Bank of India", "BoI - Bank of India", "IB - Indian Bank", "CBI - Central Bank of India",
    "UCO - UCO Bank", "BoM - Bank of Maharashtra", "P&S - Punjab & Sind Bank", "AB - Allahabad Bank",
    "HDFC - HDFC Bank", "ICICI - ICICI Bank", "Axis - Axis Bank", "Kotak - Kotak Mahindra Bank",
    "IndusInd - IndusInd Bank", "Yes - Yes Bank", "IDFC - IDFC First Bank", "Federal - Federal Bank",
    "SIB - South Indian Bank", "RBL - RBL Bank", "APGVB - Andhra Pradesh Grameena Vikas Bank",
    "KGB - Kerala Gramin Bank", "MPGB - Madhya Pradesh Gramin Bank", "BUPGB - Baroda Uttar Pradesh Gramin Bank",
    "UPGB - Uttar Pradesh Gramin Bank", "Saraswat - Saraswat Co-operative Bank",
    "BCCB - Bassein Catholic Co-operative Bank", "Cosmos - Cosmos Cooperative Bank",
    "TJSB - TJSB Sahakari Bank", "Jila - Jila Sahakari Bank", "ARYAVRAT BANK"
];


export const bankBranches: Omit<BankBranch, 'id'>[] = [
    { bankName: "ARYAVRAT BANK", branchName: "BENI RAJAPUR", ifscCode: "BKID0ARYAGB" },
    { bankName: "Axis Bank", branchName: "KHUTAR KHS", ifscCode: "UTIB0002539" },
    { bankName: "Bank of Baroda", branchName: "BANDA", ifscCode: "BARB0BANDAX" },
    { bankName: "Bank of Baroda", branchName: "DHAKAGHANSHYAM", ifscCode: "BARB0DHAKAG" },
    { bankName: "Bank of Baroda", branchName: "MAQSOODAPUR", ifscCode: "BARB0MAQSOO" },
    { bankName: "Bank of Baroda", branchName: "PILIBHIT", ifscCode: "BARB0PILIBH" },
    { bankName: "Bank of Baroda", branchName: "PIPARIA", ifscCode: "BARB0PIPSHA" },
    { bankName: "Baroda Uttar Pradesh Gramin Bank", branchName: "NAVEECHI", ifscCode: "BARB0BUPGBX" },
    { bankName: "Baroda Uttar Pradesh Gramin Bank", branchName: "DHARMAPUR", ifscCode: "BARB0BUPGBX" },
    { bankName: "HDFC Bank", branchName: "BANDA", ifscCode: "HDFC0004846" },
    { bankName: "HDFC Bank", branchName: "Unknown", ifscCode: "HDFC0000283" },
    { bankName: "Indian Bank", branchName: "BANDA", ifscCode: "IDIB000B598" },
    { bankName: "Indian Bank", branchName: "CORPORATE OFFICE", ifscCode: "IPOS0000001" },
    { bankName: "Indian Bank", branchName: "KHANJANPUR", ifscCode: "IDIB000K823" },
    { bankName: "Indian Bank", branchName: "PILIBHIT", ifscCode: "BKID0007024" },
    { bankName: "Jila Sahakari Bank", branchName: "BANDA (ICICI)", ifscCode: "ICIC00SJDCB" },
    { bankName: "Jila Sahakari Bank", branchName: "BANDA (UPCB)", ifscCode: "UPCB00SJDCB" },
    { bankName: "Punjab National Bank", branchName: "BANDA", ifscCode: "PUNB0162210" },
    { bankName: "Punjab National Bank", branchName: "DEVKALI", ifscCode: "PUNB0031210" },
    { bankName: "Punjab National Bank", branchName: "SHAHJAHANPUR", ifscCode: "PUNB0017510" },
    { bankName: "Punjab & Sind Bank", branchName: "DABORA SEWA", ifscCode: "PSIB0000494" },
    { bankName: "Punjab & Sind Bank", branchName: "MAJHIGAWA", ifscCode: "PSIB0000671" },
    { bankName: "Punjab & Sind Bank", branchName: "PIPARIYA", ifscCode: "PSIB0000671" },
    { bankName: "State Bank of India", branchName: "BANDA", ifscCode: "SBIN0002557" },
    { bankName: "State Bank of India", branchName: "BANDA", ifscCode: "SBIN0011186" },
    { bankName: "State Bank of India", branchName: "JARWAL ROAD", ifscCode: "SBIN0010878" },
    { bankName: "Union Bank of India", branchName: "SHAHJAHANPUR", ifscCode: "UBIN0538817" },
];


export const transactionCategories = {
    Income: {
        categories: [
            { name: "Sales of Goods", subCategories: ["Rice Sales", "By-product Sales (husk, bran)"] },
            { name: "Service Income", subCategories: ["Milling Services for Others", "Storage/Warehouse Rental"] },
            { name: "Other Income", subCategories: ["Scrap Sales", "Interest Income"] }
        ]
    },
    Expense: {
        Permanent: {
            categories: [
                { name: "Land & Property Costs", subCategories: ["Mill & Warehouse Rent", "Property Taxes"] },
                { name: "Staff & Administrative Costs", subCategories: ["Salaries", "Employee Benefits"] },
                { name: "Insurance", subCategories: ["Property & Asset Insurance", "Worker's Compensation Insurance", "Liability Insurance"] },
                { name: "Finance & Debt", subCategories: ["Loan Repayments", "Interest Payments", "Bank Fees"] },
                { name: "Utilities & Services", subCategories: ["Fixed Utility Charges", "Accounting & Legal Fees"] },
                { name: "Repairs & Maintenance", subCategories: ["Annual Maintenance Contracts"] }
            ]
        },
        Seasonal: {
            categories: [
                { name: "Raw Material Costs", subCategories: ["Paddy Procurement", "Transportation"] },
                { name: "Labor Costs", subCategories: ["Seasonal Labor Wages", "Overtime Pay"] },
                { name: "Production & Operational Costs", subCategories: ["Electricity & Fuel", "Water Usage", "Consumables", "Packaging Materials"] },
                { name: "Sales & Distribution Costs", subCategories: ["Transportation of Finished Goods", "Commissions", "Marketing & Advertising"] },
                { name: "Regulatory & Quality Control", subCategories: ["Inspection Fees", "Quality Testing"] }
            ]
        }
    }
};
