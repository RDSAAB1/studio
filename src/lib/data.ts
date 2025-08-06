import type { Customer, Transaction, FundTransaction } from "./definitions";

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
    paymentTypes: ['Full', 'Partial']
};

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
