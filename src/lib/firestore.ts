
import { db, addToSyncQueue } from "./database";
import { liveQuery, type Observable } from 'dexie';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  getDoc,
  where,
  onSnapshot,
  limit,
  setDoc,
  writeBatch,
  runTransaction,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { firestoreDB } from "./firebase"; // Renamed to avoid conflict
import type { Customer, FundTransaction, Payment, Transaction, PaidFor, Bank, BankBranch, RtgsSettings, OptionItem, ReceiptSettings, ReceiptFieldSettings, IncomeCategory, ExpenseCategory, AttendanceEntry, Project, Loan, BankAccount, CustomerPayment, FormatSettings, Income, Expense } from "@/lib/definitions";
import { toTitleCase, generateReadableId } from "./utils";

const suppliersCollection = collection(firestoreDB, "suppliers");
const customersCollection = collection(firestoreDB, "customers");
const supplierPaymentsCollection = collection(firestoreDB, "payments");
const customerPaymentsCollection = collection(firestoreDB, "customer_payments");
const incomesCollection = collection(firestoreDB, "incomes");
const expensesCollection = collection(firestoreDB, "expenses");
const loansCollection = collection(firestoreDB, "loans");
const fundTransactionsCollection = collection(firestoreDB, "fund_transactions");
const banksCollection = collection(firestoreDB, "banks");
const bankBranchesCollection = collection(firestoreDB, "bankBranches");
const bankAccountsCollection = collection(firestoreDB, "bankAccounts");
const settingsCollection = collection(firestoreDB, "settings");
const optionsCollection = collection(firestoreDB, "options");
const usersCollection = collection(firestoreDB, "users");
const attendanceCollection = collection(firestoreDB, "attendance");
const projectsCollection = collection(firestoreDB, "projects");
const employeesCollection = collection(firestoreDB, "employees");
const payrollCollection = collection(firestoreDB, 'payroll');
const inventoryItemsCollection = collection(firestoreDB, 'inventoryItems');


// --- User Refresh Token Functions ---
export async function saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const userDocRef = doc(firestoreDB, "users", userId);
    await setDoc(userDocRef, { refreshToken: refreshToken }, { merge: true });
}

export async function getRefreshToken(userId: string): Promise<string | null> {
    const userDocRef = doc(firestoreDB, "users", userId);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists() && docSnap.data().refreshToken) {
        return docSnap.data().refreshToken;
    }
    return null;
}


// --- Dynamic Options Functions ---

export function getOptionsRealtime(collectionName: string, callback: (options: OptionItem[]) => void, onError: (error: Error) => void): () => void {
    const docRef = doc(optionsCollection, collectionName);
    return onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            const options = data.items.map((name: string, index: number) => ({ id: `${name}-${index}`, name }));
            callback(options);
        } else {
            callback([]);
        }
    }, onError);
}

export async function addOption(collectionName: string, optionData: { name: string }): Promise<void> {
    const docRef = doc(optionsCollection, collectionName);
    await setDoc(docRef, {
        items: arrayUnion(toTitleCase(optionData.name))
    }, { merge: true });
}


export async function updateOption(collectionName: string, id: string, optionData: Partial<{ name: string }>): Promise<void> {
    console.warn("Updating option names is not directly supported via this function. Please implement rename logic carefully.");
}

export async function deleteOption(collectionName: string, id: string, name: string): Promise<void> {
    const docRef = doc(optionsCollection, collectionName);
    await updateDoc(docRef, {
        items: arrayRemove(name)
    });
}


// --- Company & RTGS Settings Functions ---

export async function getCompanySettings(userId: string): Promise<{ email: string; appPassword: string } | null> {
    if (!userId) return null;
    const docRef = doc(firestoreDB, "users", userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        return {
            email: data.email,
            appPassword: data.appPassword
        };
    }
    return null;
}

export async function saveCompanySettings(userId: string, settings: { email: string; appPassword: string }): Promise<void> {
    const userDocRef = doc(firestoreDB, "users", userId);
    await setDoc(userDocRef, settings, { merge: true });
}

export async function deleteCompanySettings(userId: string): Promise<void> {
    const userDocRef = doc(firestoreDB, "users", userId);
    await updateDoc(userDocRef, {
        appPassword: '' 
    });
}


export async function getRtgsSettings(): Promise<RtgsSettings> {
    const docRef = doc(settingsCollection, "companyDetails");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data() as RtgsSettings;
        if (data.defaultBankAccountId) {
            const bankDoc = await getDoc(doc(bankAccountsCollection, data.defaultBankAccountId));
            if (bankDoc.exists()) {
                data.defaultBank = bankDoc.data() as BankAccount;
            }
        }
        return data;
    }
    return {
        companyName: "BizSuite DataFlow",
        companyAddress1: "123 Business Rd",
        companyAddress2: "Suite 100, BizCity",
        contactNo: "9876543210",
        gmail: "contact@bizsuite.com",
    } as RtgsSettings;
}

export async function updateRtgsSettings(settings: Partial<RtgsSettings>): Promise<void> {
    const docRef = doc(settingsCollection, "companyDetails");
    await setDoc(docRef, settings, { merge: true });
}

const defaultReceiptFields: ReceiptFieldSettings = {
    date: true,
    name: true,
    contact: true,
    address: true,
    vehicleNo: true,
    term: true,
    rate: true,
    grossWeight: true,
    teirWeight: true,
    weight: true,
    amount: true,
    dueDate: true,
    kartaWeight: true,
    netAmount: true,
    srNo: true,
    variety: true,
    netWeight: true,
};


// --- Receipt Settings Functions ---
export async function getReceiptSettings(): Promise<ReceiptSettings | null> {
    const docRef = doc(settingsCollection, "companyDetails"); // Use companyDetails as the source
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data() as Partial<ReceiptSettings>;
        if (data.defaultBankAccountId) {
            const bankDoc = await getDoc(doc(bankAccountsCollection, data.defaultBankAccountId));
            if (bankDoc.exists()) {
                data.defaultBank = bankDoc.data() as BankAccount;
            }
        }
        return {
            companyName: data.companyName || "JAGDAMBE RICE MILL",
            companyAddress1: data.companyAddress1 || "Devkali Road, Banda, Shajahanpur",
            companyAddress2: data.companyAddress2 || "Near Devkali, Uttar Pradesh",
            contactNo: data.contactNo || "9555130735",
            gmail: data.gmail || "JRMDofficial@gmail.com",
            fields: { ...defaultReceiptFields, ...(data.fields || {}) },
            defaultBankAccountId: data.defaultBankAccountId,
            defaultBank: data.defaultBank,
            companyGstin: data.companyGstin,
            companyStateName: data.companyStateName,
            companyStateCode: data.companyStateCode,
            panNo: data.panNo
        };
    }
    return {
        companyName: "JAGDAMBE RICE MILL",
        companyAddress1: "Devkali Road, Banda, Shajahanpur",
        companyAddress2: "Near Devkali, Uttar Pradesh",
        contactNo: "9555130735",
        gmail: "JRMDofficial@gmail.com",
        fields: defaultReceiptFields,
    };
}

export async function updateReceiptSettings(settings: Partial<ReceiptSettings>): Promise<void> {
    const docRef = doc(settingsCollection, "companyDetails");
    await setDoc(docRef, settings, { merge: true });
}

// --- Bank & Branch Functions ---
export async function addBank(bankName: string): Promise<Bank> {
  const docRef = doc(firestoreDB, 'banks', bankName);
  await setDoc(docRef, { name: bankName });
  return { id: docRef.id, name: bankName };
}

export async function deleteBank(id: string): Promise<void> {
    const docRef = doc(firestoreDB, "banks", id);
    await deleteDoc(docRef);
}

export async function addBankBranch(branchData: Omit<BankBranch, 'id'>): Promise<BankBranch> {
    const docRef = doc(firestoreDB, 'bankBranches', branchData.ifscCode);
    await setDoc(docRef, branchData);
    return { id: docRef.id, ...branchData };
}

export async function updateBankBranch(id: string, branchData: Partial<BankBranch>): Promise<void> {
    const docRef = doc(firestoreDB, "bankBranches", id);
    await updateDoc(docRef, branchData);
}

export async function deleteBankBranch(id: string): Promise<void> {
    const docRef = doc(firestoreDB, "bankBranches", id);
    await deleteDoc(docRef);
}


// --- Bank Account Functions ---
export async function addBankAccount(accountData: Partial<Omit<BankAccount, 'id'>>): Promise<BankAccount> {
    const docRef = doc(bankAccountsCollection, accountData.accountNumber);
    const newAccountData = { ...accountData, id: docRef.id, collection: 'bankAccounts' };
    await db.mainDataStore.put(newAccountData);
    await addToSyncQueue({ action: 'create', payload: { collection: 'bankAccounts', data: newAccountData } });
    return newAccountData as BankAccount;
}

export async function updateBankAccount(id: string, accountData: Partial<BankAccount>): Promise<void> {
    await db.mainDataStore.update(id, accountData);
    await addToSyncQueue({ action: 'update', payload: { collection: 'bankAccounts', id, changes: accountData } });
}

export async function deleteBankAccount(id: string): Promise<void> {
    await db.mainDataStore.delete(id);
    await addToSyncQueue({ action: 'delete', payload: { collection: 'bankAccounts', id } });
}


// --- Supplier Functions ---
export async function addSupplier(supplierData: Omit<Customer, 'id'>): Promise<Customer> {
    const docRef = doc(suppliersCollection, supplierData.srNo);
    const newSupplier = { ...supplierData, id: docRef.id, collection: 'suppliers' };

    await db.mainDataStore.put(newSupplier);
    await addToSyncQueue({ action: 'create', payload: { collection: 'suppliers', data: newSupplier } });

    return newSupplier;
}

export async function updateSupplier(id: string, supplierData: Partial<Omit<Customer, 'id'>>): Promise<boolean> {
  if (!id) {
    console.error("updateSupplier requires a valid ID.");
    return false;
  }
  
  await db.mainDataStore.update(id, supplierData);
  await addToSyncQueue({ action: 'update', payload: { collection: 'suppliers', id, changes: supplierData } });

  return true;
}

export async function deleteSupplier(id: string): Promise<void> {
  if (!id) {
    console.error("deleteSupplier requires a valid ID.");
    return;
  }
  await db.mainDataStore.delete(id);
  await addToSyncQueue({ action: 'delete', payload: { collection: 'suppliers', id } });
}

export async function deleteMultipleSuppliers(srNos: string[]): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const paymentsBatch = writeBatch(firestoreDB);

    for (const srNo of srNos) {
        const supplierDocRef = doc(suppliersCollection, srNo);
        batch.delete(supplierDocRef);
        const paymentsQuery = query(supplierPaymentsCollection, where("paidFor", "array-contains", { srNo }));
        const paymentsSnapshot = await getDocs(paymentsQuery);
        
        paymentsSnapshot.forEach(paymentDoc => {
            const payment = paymentDoc.data() as Payment;
            if (payment.paidFor && payment.paidFor.length === 1 && payment.paidFor[0].srNo === srNo) {
                paymentsBatch.delete(paymentDoc.ref);
            } else {
                const updatedPaidFor = payment.paidFor?.filter(pf => pf.srNo !== srNo);
                const amountToDeduct = payment.paidFor?.find(pf => pf.srNo === srNo)?.amount || 0;
                paymentsBatch.update(paymentDoc.ref, { 
                    paidFor: updatedPaidFor,
                    amount: payment.amount - amountToDeduct
                });
            }
        });
    }
    await batch.commit();
    await paymentsBatch.commit();
}


// --- Customer Functions ---
export async function addCustomer(customerData: Omit<Customer, 'id'>): Promise<Customer> {
    const docRef = doc(customersCollection, customerData.srNo);
    const newCustomer = { ...customerData, id: docRef.id, collection: 'customers' };
    
    await db.mainDataStore.put(newCustomer);
    await addToSyncQueue({ action: 'create', payload: { collection: 'customers', data: newCustomer } });

    return newCustomer;
}

export async function updateCustomer(id: string, customerData: Partial<Omit<Customer, 'id'>>): Promise<boolean> {
    if (!id) {
        console.error("updateCustomer requires a valid ID.");
        return false;
    }
    await db.mainDataStore.update(id, customerData);
    await addToSyncQueue({ action: 'update', payload: { collection: 'customers', id, changes: customerData } });
    return true;
}

export async function deleteCustomer(id: string): Promise<void> {
    if (!id) {
      console.error("deleteCustomer requires a valid ID.");
      return;
    }
    await db.mainDataStore.delete(id);
    await addToSyncQueue({ action: 'delete', payload: { collection: 'customers', id } });
}

// --- Inventory Item Functions ---
export async function addInventoryItem(item: any) {
  const newId = doc(inventoryItemsCollection).id;
  const newItem = { ...item, id: newId, collection: 'inventoryItems' };
  
  await db.mainDataStore.put(newItem);
  await addToSyncQueue({ action: 'create', payload: { collection: 'inventoryItems', data: newItem } });
  
  return newItem;
}
export async function updateInventoryItem(id: string, item: any) {
  await db.mainDataStore.update(id, item);
  await addToSyncQueue({ action: 'update', payload: { collection: 'inventoryItems', id, changes: item } });
}
export async function deleteInventoryItem(id: string) {
  await db.mainDataStore.delete(id);
  await addToSyncQueue({ action: 'delete', payload: { collection: 'inventoryItems', id } });
}


// --- Payment Functions ---
export async function deletePaymentsForSrNo(srNo: string): Promise<void> {
  if (!srNo) return;
  const paymentsToDelete = await db.syncQueueStore
    .where('payload.collection').equals('payments')
    .and(item => item.payload.data?.paidFor?.some((pf: any) => pf.srNo === srNo))
    .toArray();
    
  for (const payment of paymentsToDelete) {
      if (payment.id) await db.syncQueueStore.delete(payment.id);
  }
  await addToSyncQueue({ action: 'delete', payload: { collection: 'payments', id: srNo, changes: { bySrNo: true } }});
}

export async function deleteAllPayments(): Promise<void> {
    const allPayments = await db.mainDataStore.where('collection').equals('payments').toArray();
    for (const payment of allPayments) {
        await db.mainDataStore.delete(payment.id);
    }
    await addToSyncQueue({ action: 'delete', payload: { collection: 'payments', changes: { all: true } }});
}

export async function deleteCustomerPaymentsForSrNo(srNo: string): Promise<void> {
  if (!srNo) return;
  const paymentsToDelete = await db.syncQueueStore
    .where('payload.collection').equals('customer_payments')
    .and(item => item.payload.data?.paidFor?.some((pf: any) => pf.srNo === srNo))
    .toArray();
    
  for (const payment of paymentsToDelete) {
      if (payment.id) await db.syncQueueStore.delete(payment.id);
  }
  await addToSyncQueue({ action: 'delete', payload: { collection: 'customer_payments', id: srNo, changes: { bySrNo: true } }});
}


// --- Fund Transaction Functions ---
export async function addFundTransaction(transactionData: Omit<FundTransaction, 'id' | 'transactionId' | 'date'>): Promise<FundTransaction> {
  const dataWithDate = {
    ...transactionData,
    date: new Date().toISOString(),
  };
  const docRef = await addDoc(fundTransactionsCollection, dataWithDate);
  const newTransaction = { id: docRef.id, transactionId: '', ...dataWithDate, collection: 'fund_transactions' };
  await db.mainDataStore.put(newTransaction);
  await addToSyncQueue({ action: 'create', payload: { collection: 'fund_transactions', data: newTransaction } });
  return newTransaction;
}

export async function updateFundTransaction(id: string, data: Partial<FundTransaction>): Promise<void> {
    await db.mainDataStore.update(id, data);
    await addToSyncQueue({ action: 'update', payload: { collection: 'fund_transactions', id, changes: data } });
}

export async function deleteFundTransaction(id: string): Promise<void> {
    await db.mainDataStore.delete(id);
    await addToSyncQueue({ action: 'delete', payload: { collection: 'fund_transactions', id } });
}


// --- Income/Expense Category Functions ---

export function getIncomeCategories(callback: (data: IncomeCategory[]) => void, onError: (error: Error) => void) {
    const q = query(collection(firestoreDB, "incomeCategories"), orderBy("name"));
    return onSnapshot(q, (snapshot) => {
        const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IncomeCategory));
        callback(categories);
    }, onError);
}

export function getExpenseCategories(callback: (data: ExpenseCategory[]) => void, onError: (error: Error) => void) {
    const q = query(collection(firestoreDB, "expenseCategories"), orderBy("name"));
    return onSnapshot(q, (snapshot) => {
        const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExpenseCategory));
        callback(categories);
    }, onError);
}

export async function addCategory(collectionName: "incomeCategories" | "expenseCategories", category: { name: string; nature?: string }) {
    await addDoc(collection(firestoreDB, collectionName), { ...category, subCategories: [] });
}

export async function updateCategoryName(collectionName: "incomeCategories" | "expenseCategories", id: string, name: string) {
    await updateDoc(doc(firestoreDB, collectionName, id), { name });
}

export async function deleteCategory(collectionName: "incomeCategories" | "expenseCategories", id: string) {
    await deleteDoc(doc(firestoreDB, collectionName, id));
}

export async function addSubCategory(collectionName: "incomeCategories" | "expenseCategories", categoryId: string, subCategoryName: string) {
    await updateDoc(doc(firestoreDB, collectionName, categoryId), {
        subCategories: arrayUnion(subCategoryName)
    });
}

export async function deleteSubCategory(collectionName: "incomeCategories" | "expenseCategories", categoryId: string, subCategoryName: string) {
    await updateDoc(doc(firestoreDB, collectionName, categoryId), {
        subCategories: arrayRemove(subCategoryName)
    });
}

// --- Attendance Functions ---

export async function getAttendanceForPeriod(employeeId: string, startDate: string, endDate: string): Promise<AttendanceEntry[]> {
    return db.mainDataStore
        .where('collection').equals('attendance')
        .and(record => record.employeeId === employeeId && record.date >= startDate && record.date <= endDate)
        .toArray();
}

export async function setAttendance(entry: AttendanceEntry): Promise<void> {
    const newEntry = { ...entry, collection: 'attendance' };
    await db.mainDataStore.put(newEntry);
    await addToSyncQueue({ action: 'create', payload: { collection: 'attendance', data: newEntry }});
}

// --- Project Functions ---
export async function addProject(projectData: Omit<Project, 'id'>): Promise<Project> {
    const docRef = doc(collection(firestoreDB, 'projects'));
    const newProject = { id: docRef.id, ...projectData, collection: 'projects' };
    await db.mainDataStore.put(newProject);
    await addToSyncQueue({ action: 'create', payload: { collection: 'projects', data: newProject } });
    return newProject;
}

export async function updateProject(id: string, projectData: Partial<Project>): Promise<void> {
    await db.mainDataStore.update(id, projectData);
    await addToSyncQueue({ action: 'update', payload: { collection: 'projects', id, changes: projectData } });
}

export async function deleteProject(id: string): Promise<void> {
    await db.mainDataStore.delete(id);
    await addToSyncQueue({ action: 'delete', payload: { collection: 'projects', id } });
}


// --- Loan Functions ---
export async function addLoan(loanData: Omit<Loan, 'id'>): Promise<Loan> {
    const docRef = doc(loansCollection);
    const newLoan = { id: docRef.id, ...loanData, collection: 'loans' };
    
    await db.mainDataStore.put(newLoan);
    await addToSyncQueue({ action: 'create', payload: { collection: 'loans', data: newLoan } });

    if ((loanData.loanType === 'Bank' || loanData.loanType === 'Outsider') && loanData.totalAmount > 0) {
        await addFundTransaction({
            type: 'CapitalInflow',
            source: loanData.loanType === 'Bank' ? 'BankLoan' : 'ExternalLoan',
            destination: loanData.depositTo,
            amount: loanData.totalAmount,
            description: `Capital inflow from ${loanData.loanName}`
        });
    }
    
    return newLoan;
}

export async function updateLoan(id: string, loanData: Partial<Loan>): Promise<void> {
    await db.mainDataStore.update(id, loanData);
    await addToSyncQueue({ action: 'update', payload: { collection: 'loans', id, changes: loanData } });
}

export async function deleteLoan(id: string): Promise<void> {
    await db.mainDataStore.delete(id);
    await addToSyncQueue({ action: 'delete', payload: { collection: 'loans', id } });
}


// --- Customer Payment Functions ---

export async function addCustomerPayment(paymentData: Omit<CustomerPayment, 'id'>): Promise<CustomerPayment> {
    const docRef = doc(customerPaymentsCollection, paymentData.paymentId);
    const newPayment = { ...paymentData, id: docRef.id, collection: 'customer_payments' };
    await db.mainDataStore.put(newPayment);
    await addToSyncQueue({ action: 'create', payload: { collection: 'customer_payments', data: newPayment } });
    return newPayment;
}

export async function deletePayment(id: string): Promise<void> {
    await db.mainDataStore.delete(id);
    await addToSyncQueue({ action: 'delete', payload: { collection: 'payments', id } });
}

export async function deleteCustomerPayment(id: string): Promise<void> {
    await db.mainDataStore.delete(id);
    await addToSyncQueue({ action: 'delete', payload: { collection: 'customer_payments', id } });
}


// --- Income and Expense specific functions ---
export async function addIncome(incomeData: Omit<Income, 'id'>): Promise<Income> {
    const docRef = doc(incomesCollection);
    const newIncome = { id: docRef.id, ...incomeData, collection: 'incomes' };
    await db.mainDataStore.put(newIncome);
    await addToSyncQueue({ action: 'create', payload: { collection: 'incomes', data: newIncome } });
    return newIncome;
}

export async function addExpense(expenseData: Omit<Expense, 'id'>): Promise<Expense> {
    const docRef = doc(expensesCollection);
    const newExpense = { id: docRef.id, ...expenseData, collection: 'expenses' };
    await db.mainDataStore.put(newExpense);
    await addToSyncQueue({ action: 'create', payload: { collection: 'expenses', data: newExpense } });
    return newExpense;
}

export async function updateIncome(id: string, incomeData: Partial<Omit<Income, 'id'>>): Promise<void> {
    await db.mainDataStore.update(id, incomeData);
    await addToSyncQueue({ action: 'update', payload: { collection: 'incomes', id, changes: incomeData } });
}

export async function updateExpense(id: string, expenseData: Partial<Omit<Expense, 'id'>>): Promise<void> {
    await db.mainDataStore.update(id, expenseData);
    await addToSyncQueue({ action: 'update', payload: { collection: 'expenses', id, changes: expenseData } });
}

export async function deleteIncome(id: string): Promise<void> {
    await db.mainDataStore.delete(id);
    await addToSyncQueue({ action: 'delete', payload: { collection: 'incomes', id } });
}

export async function deleteExpense(id: string): Promise<void> {
    await db.mainDataStore.delete(id);
    await addToSyncQueue({ action: 'delete', payload: { collection: 'expenses', id } });
}

// --- Format Settings Functions ---
export async function getFormatSettings(): Promise<FormatSettings> {
    const docRef = doc(settingsCollection, "formats");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data() as FormatSettings;
    }
    // Return a default if it doesn't exist
    return {
        income: { prefix: 'IM', padding: 5 },
        expense: { prefix: 'ES', padding: 5 },
        loan: { prefix: 'LN', padding: 4 },
        fundTransaction: { prefix: 'AT', padding: 4 },
        supplier: { prefix: 'S', padding: 5 },
        customer: { prefix: 'C', padding: 5 },
        supplierPayment: { prefix: 'SP', padding: 5 },
        customerPayment: { prefix: 'CP', padding: 5 },
    };
}

export async function saveFormatSettings(settings: FormatSettings): Promise<void> {
    const docRef = doc(settingsCollection, "formats");
    await setDoc(docRef, settings, { merge: true });
}

export async function addTransaction(transactionData: Omit<Transaction, 'id'|'transactionId'>) {
    const { transactionType } = transactionData;
    const collectionRef = transactionType === 'Income' ? incomesCollection : expensesCollection;
    return addDoc(collectionRef, transactionData);
}
    
// --- Batch Deletion for All Suppliers ---
export async function deleteAllSuppliers(): Promise<void> {
  const allSuppliers = await db.mainDataStore.where('collection').equals('suppliers').toArray();
  const idsToDelete = allSuppliers.map(s => s.id);
  await db.mainDataStore.bulkDelete(idsToDelete);
  await addToSyncQueue({ action: 'delete', payload: { collection: 'suppliers', changes: { all: true } }});
}


// --- Employee Functions ---
export async function addEmployee(employeeData: Partial<Omit<Employee, 'id'>>) {
    const docRef = doc(employeesCollection, employeeData.employeeId);
    const newEmployee = { ...employeeData, id: docRef.id, collection: 'employees' };
    await db.mainDataStore.put(newEmployee);
    await addToSyncQueue({ action: 'create', payload: { collection: 'employees', data: newEmployee } });
    return newEmployee;
}

export async function updateEmployee(id: string, employeeData: Partial<Employee>) {
    await db.mainDataStore.update(id, employeeData);
    await addToSyncQueue({ action: 'update', payload: { collection: 'employees', id, changes: employeeData } });
}

export async function deleteEmployee(id: string) {
    await db.mainDataStore.delete(id);
    await addToSyncQueue({ action: 'delete', payload: { collection: 'employees', id } });
}

// --- Payroll Functions ---
export async function addPayrollEntry(entryData: Omit<PayrollEntry, 'id'>) {
    const docRef = doc(payrollCollection);
    const newEntry = { ...entryData, id: docRef.id, collection: 'payroll' };
    await db.mainDataStore.put(newEntry);
    await addToSyncQueue({ action: 'create', payload: { collection: 'payroll', data: newEntry } });
    return newEntry;
}

export async function updatePayrollEntry(id: string, entryData: Partial<PayrollEntry>) {
    await db.mainDataStore.update(id, entryData);
    await addToSyncQueue({ action: 'update', payload: { collection: 'payroll', id, changes: entryData } });
}

export async function deletePayrollEntry(id: string) {
    await db.mainDataStore.delete(id);
    await addToSyncQueue({ action: 'delete', payload: { collection: 'payroll', id } });
}

    
