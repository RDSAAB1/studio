import type { Customer, Expense } from "./definitions";

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

export const initialExpenses: Expense[] = [
    { id: '1', date: '2025-07-20', category: 'Operational', subCategory: 'Salaries', amount: 150000, payee: 'Staff Payroll', description: 'July 2025 Salaries', paymentMethod: 'Online', status: 'Paid', invoiceNumber: 'INV-001', taxAmount: 75, expenseType: 'Business', isRecurring: true, mill: 'Main Mill', expenseNature: 'Permanent' },
    { id: '2', date: '2025-07-19', category: 'Utilities', subCategory: 'Electricity', amount: 4500, payee: 'Electricity Board', description: 'Monthly electricity bill', paymentMethod: 'Online', status: 'Paid', invoiceNumber: 'INV-002', taxAmount: 225, expenseType: 'Business', isRecurring: true, mill: 'Main Mill', expenseNature: 'Permanent' },
    { id: '3', date: '2025-07-18', category: 'Transportation', subCategory: 'Fuel', amount: 850, payee: 'Indian Oil', description: 'Diesel for generator', paymentMethod: 'Cash', status: 'Paid', invoiceNumber: 'INV-003', taxAmount: 42.5, expenseType: 'Business', isRecurring: false, mill: 'Sales Office', expenseNature: 'Seasonal' },
    { id: '4', date: '2025-07-18', category: 'Maintenance', subCategory: 'Machinery Repair', amount: 25000, payee: 'Agro Repairs Co.', description: 'Tractor maintenance', paymentMethod: 'Cheque', status: 'Pending', invoiceNumber: 'INV-004', taxAmount: 1250, expenseType: 'Business', isRecurring: false, mill: 'Main Mill', expenseNature: 'Seasonal' },
    { id: '5', date: '2025-07-15', category: 'Operational', subCategory: 'Office Supplies', amount: 2500, payee: 'Local Stationary', description: 'A4 paper and pens', paymentMethod: 'Cash', status: 'Paid', invoiceNumber: 'INV-005', taxAmount: 125, expenseType: 'Business', isRecurring: false, mill: 'Warehouse', expenseNature: 'Permanent' }
];

export const appOptionsData = {
    varieties: ['Wheat', 'Rice', 'Corn', 'Barley'],
    receiptTypes: ['Cash', 'Online'],
    paymentTypes: ['Full', 'Partial']
};

export const expenseCategories = {
    Permanent: {
        categories: [
            {
                name: "Operational",
                subCategories: ["Salaries", "Rent", "Office Supplies", "Insurance"]
            },
            {
                name: "Utilities",
                subCategories: ["Electricity", "Water", "Internet", "Phone"]
            },
            {
                name: "Administrative",
                subCategories: ["Legal Fees", "Accounting Fees", "Bank Charges"]
            }
        ]
    },
    Seasonal: {
        categories: [
            {
                name: "Raw Material",
                subCategories: ["Paddy Purchase", "Wheat Purchase", "Other Grains"]
            },
            {
                name: "Maintenance",
                subCategories: ["Machinery Repair", "Vehicle Repair", "Building Repair"]
            },
            {
                name: "Transportation",
                subCategories: ["Truck Rental", "Fuel", "Logistics"]
            },
            {
                name: "Labour",
                subCategories: ["Harvesting Labor", "Loading/Unloading", "Processing Labor"]
            }
        ]
    }
}
