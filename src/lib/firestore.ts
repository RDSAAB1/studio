
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
import type { Customer, FundTransaction, Payment, Transaction, PaidFor, Bank, BankBranch, RtgsSettings, OptionItem, ReceiptSettings, ReceiptFieldSettings, IncomeCategory, ExpenseCategory, AttendanceEntry, Project, Loan, BankAccount, CustomerPayment, FormatSettings, Income, Expense, Holiday } from "@/lib/definitions";
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
    const newAccount = { ...accountData, id: docRef.id };
    await setDoc(docRef, newAccount);
    return newAccount as BankAccount;
}

export async function updateBankAccount(id: string, accountData: Partial<BankAccount>): Promise<void> {
    const docRef = doc(bankAccountsCollection, id);
    await updateDoc(docRef, accountData);
}

export async function deleteBankAccount(id: string): Promise<void> {
    const docRef = doc(bankAccountsCollection, id);
    await deleteDoc(docRef);
}


// --- Supplier Functions ---
export async function addSupplier(supplierData: Omit<Customer, 'id'>): Promise<Customer> {
    const docRef = doc(suppliersCollection, supplierData.srNo);
    const newSupplier = { ...supplierData, id: docRef.id };
    await setDoc(docRef, newSupplier);
    return newSupplier;
}

export async function updateSupplier(id: string, supplierData: Partial<Omit<Customer, 'id'>>): Promise<boolean> {
  if (!id) {
    console.error("updateSupplier requires a valid ID.");
    return false;
  }
  const docRef = doc(suppliersCollection, id);
  await updateDoc(docRef, supplierData);
  return true;
}

export async function deleteSupplier(id: string): Promise<void> {
  if (!id) {
    console.error("deleteSupplier requires a valid ID.");
    return;
  }
  const docRef = doc(suppliersCollection, id);
  await deleteDoc(docRef);
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
    const newCustomer = { ...customerData, id: docRef.id };
    await setDoc(docRef, newCustomer);
    return newCustomer;
}

export async function updateCustomer(id: string, customerData: Partial<Omit<Customer, 'id'>>): Promise<boolean> {
    if (!id) {
        console.error("updateCustomer requires a valid ID.");
        return false;
    }
    const docRef = doc(customersCollection, id);
    await updateDoc(docRef, customerData);
    return true;
}

export async function deleteCustomer(id: string): Promise<void> {
    if (!id) {
      console.error("deleteCustomer requires a valid ID.");
      return;
    }
    const docRef = doc(customersCollection, id);
    await deleteDoc(docRef);
}

// --- Inventory Item Functions ---
export async function addInventoryItem(item: any) {
  const docRef = await addDoc(inventoryItemsCollection, item);
  return { id: docRef.id, ...item };
}
export async function updateInventoryItem(id: string, item: any) {
  const docRef = doc(inventoryItemsCollection, id);
  await updateDoc(docRef, item);
}
export async function deleteInventoryItem(id: string) {
  const docRef = doc(inventoryItemsCollection, id);
  await deleteDoc(docRef);
}


// --- Payment Functions ---
export async function deletePaymentsForSrNo(srNo: string): Promise<void> {
  if (!srNo) return;
  const paymentsQuery = query(supplierPaymentsCollection, where("paidFor", "array-contains", { srNo: srNo }));
  const snapshot = await getDocs(paymentsQuery);
  const batch = writeBatch(firestoreDB);
  snapshot.forEach(doc => {
      batch.delete(doc.ref);
  });
  await batch.commit();
}

export async function deleteAllPayments(): Promise<void> {
    const snapshot = await getDocs(supplierPaymentsCollection);
    const batch = writeBatch(firestoreDB);
    snapshot.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
}

export async function deleteCustomerPaymentsForSrNo(srNo: string): Promise<void> {
  if (!srNo) return;
  const paymentsQuery = query(customerPaymentsCollection, where("paidFor", "array-contains", { srNo: srNo }));
  const snapshot = await getDocs(paymentsQuery);
  const batch = writeBatch(firestoreDB);
  snapshot.forEach(doc => {
      batch.delete(doc.ref);
  });
  await batch.commit();
}


// --- Fund Transaction Functions ---
export async function addFundTransaction(transactionData: Omit<FundTransaction, 'id' | 'transactionId' | 'date'>): Promise<FundTransaction> {
  const dataWithDate = {
    ...transactionData,
    date: new Date().toISOString(),
  };
  const docRef = await addDoc(fundTransactionsCollection, dataWithDate);
  return { id: docRef.id, transactionId: '', ...dataWithDate };
}

export async function updateFundTransaction(id: string, data: Partial<FundTransaction>): Promise<void> {
    const docRef = doc(fundTransactionsCollection, id);
    await updateDoc(docRef, data);
}

export async function deleteFundTransaction(id: string): Promise<void> {
    const docRef = doc(fundTransactionsCollection, id);
    await deleteDoc(docRef);
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
    const q = query(
        attendanceCollection, 
        where('employeeId', '==', employeeId),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceEntry));
}

export async function setAttendance(entry: AttendanceEntry): Promise<void> {
    const docRef = doc(attendanceCollection, entry.id);
    await setDoc(docRef, entry, { merge: true });
}

// --- Project Functions ---
export async function addProject(projectData: Omit<Project, 'id'>): Promise<Project> {
    const docRef = await addDoc(projectsCollection, projectData);
    return { id: docRef.id, ...projectData };
}

export async function updateProject(id: string, projectData: Partial<Project>): Promise<void> {
    await updateDoc(doc(projectsCollection, id), projectData);
}

export async function deleteProject(id: string): Promise<void> {
    await deleteDoc(doc(projectsCollection, id));
}


// --- Loan Functions ---
export async function addLoan(loanData: Omit<Loan, 'id'>): Promise<Loan> {
    const docRef = await addDoc(loansCollection, loanData);
    const newLoan = { id: docRef.id, ...loanData };

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
    await updateDoc(doc(loansCollection, id), loanData);
}

export async function deleteLoan(id: string): Promise<void> {
    await deleteDoc(doc(loansCollection, id));
}


// --- Customer Payment Functions ---

export async function addCustomerPayment(paymentData: Omit<CustomerPayment, 'id'>): Promise<CustomerPayment> {
    const docRef = doc(customerPaymentsCollection, paymentData.paymentId);
    const newPayment = { ...paymentData, id: docRef.id };
    await setDoc(docRef, newPayment);
    return newPayment;
}

export async function deletePayment(id: string): Promise<void> {
    const docRef = doc(supplierPaymentsCollection, id);
    await deleteDoc(docRef);
}

export async function deleteCustomerPayment(id: string): Promise<void> {
    const docRef = doc(customerPaymentsCollection, id);
    await deleteDoc(docRef);
}


// --- Income and Expense specific functions ---
export async function addIncome(incomeData: Omit<Income, 'id'>): Promise<Income> {
    const docRef = await addDoc(incomesCollection, incomeData);
    return { id: docRef.id, ...incomeData };
}

export async function addExpense(expenseData: Omit<Expense, 'id'>): Promise<Expense> {
    const docRef = await addDoc(expensesCollection, expenseData);
    return { id: docRef.id, ...expenseData };
}

export async function updateIncome(id: string, incomeData: Partial<Omit<Income, 'id'>>): Promise<void> {
    await updateDoc(doc(incomesCollection, id), incomeData);
}

export async function updateExpense(id: string, expenseData: Partial<Omit<Expense, 'id'>>): Promise<void> {
    await updateDoc(doc(expensesCollection, id), expenseData);
}

export async function deleteIncome(id: string): Promise<void> {
    await deleteDoc(doc(incomesCollection, id));
}

export async function deleteExpense(id: string): Promise<void> {
    await deleteDoc(doc(expensesCollection, id));
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
  const allDocs = await getDocs(suppliersCollection);
  const batch = writeBatch(firestoreDB);
  allDocs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
}


// --- Employee Functions ---
export async function addEmployee(employeeData: Partial<Omit<Employee, 'id'>>) {
    const docRef = doc(employeesCollection, employeeData.employeeId);
    await setDoc(docRef, employeeData, { merge: true });
}

export async function updateEmployee(id: string, employeeData: Partial<Employee>) {
    await updateDoc(doc(employeesCollection, id), employeeData);
}

export async function deleteEmployee(id: string) {
    await deleteDoc(doc(employeesCollection, id));
}

// --- Payroll Functions ---
export async function addPayrollEntry(entryData: Omit<PayrollEntry, 'id'>) {
    const docRef = await addDoc(payrollCollection, entryData);
    return { id: docRef.id, ...entryData };
}

export async function updatePayrollEntry(id: string, entryData: Partial<PayrollEntry>) {
    await updateDoc(doc(payrollCollection, id), entryData);
}

export async function deletePayrollEntry(id: string) {
    await deleteDoc(doc(payrollCollection, id));
}

// --- Holiday Functions ---
export async function getHolidays(): Promise<Holiday[]> {
    const querySnapshot = await getDocs(collection(firestoreDB, "holidays"));
    return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Holiday));
}

export async function addHoliday(date: string, name: string): Promise<void> {
    const docRef = doc(firestoreDB, "holidays", date);
    await setDoc(docRef, { date, name });
}

export async function deleteHoliday(id: string): Promise<void> {
    const docRef = doc(firestoreDB, "holidays", id);
    await deleteDoc(docRef);
}

// --- Daily Payment Limit ---
export async function getDailyPaymentLimit(): Promise<number> {
    const docRef = doc(settingsCollection, "companyDetails");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data().dailyPaymentLimit) {
        return docSnap.data().dailyPaymentLimit;
    }
    return 800000; // Default limit
}

// =================================================================
// --- Realtime Data Fetching Functions using onSnapshot ---
// =================================================================

export function getSuppliersRealtime(callback: (data: Customer[]) => void, onError: (error: Error) => void) {
    const q = query(suppliersCollection, orderBy("srNo", "desc"));
    return onSnapshot(q, (snapshot) => {
        const suppliers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
        callback(suppliers);
    }, onError);
}

export function getCustomersRealtime(callback: (data: Customer[]) => void, onError: (error: Error) => void) {
    const q = query(customersCollection, orderBy("srNo", "desc"));
    return onSnapshot(q, (snapshot) => {
        const customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
        callback(customers);
    }, onError);
}

export function getPaymentsRealtime(callback: (data: Payment[]) => void, onError: (error: Error) => void) {
    const q = query(supplierPaymentsCollection, orderBy("date", "desc"));
    return onSnapshot(q, (snapshot) => {
        const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
        callback(payments);
    }, onError);
}

export function getCustomerPaymentsRealtime(callback: (data: CustomerPayment[]) => void, onError: (error: Error) => void) {
    const q = query(customerPaymentsCollection, orderBy("date", "desc"));
    return onSnapshot(q, (snapshot) => {
        const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerPayment));
        callback(payments);
    }, onError);
}

export function getLoansRealtime(callback: (data: Loan[]) => void, onError: (error: Error) => void) {
    const q = query(loansCollection, orderBy("startDate", "desc"));
    return onSnapshot(q, (snapshot) => {
        const loans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan));
        callback(loans);
    }, onError);
}

export function getFundTransactionsRealtime(callback: (data: FundTransaction[]) => void, onError: (error: Error) => void) {
    const q = query(fundTransactionsCollection, orderBy("date", "desc"));
    return onSnapshot(q, (snapshot) => {
        const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FundTransaction));
        callback(transactions);
    }, onError);
}

export function getIncomeRealtime(callback: (data: Income[]) => void, onError: (error: Error) => void) {
    const q = query(incomesCollection, orderBy("date", "desc"));
    return onSnapshot(q, (snapshot) => {
        const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Income));
        callback(transactions);
    }, onError);
}
export function getExpensesRealtime(callback: (data: Expense[]) => void, onError: (error: Error) => void) {
    const q = query(expensesCollection, orderBy("date", "desc"));
    return onSnapshot(q, (snapshot) => {
        const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
        callback(transactions);
    }, onError);
}

export function getIncomeAndExpensesRealtime(callback: (data: Transaction[]) => void, onError: (error: Error) => void) {
    let incomeData: Income[] = [];
    let expenseData: Expense[] = [];
    let incomeDone = false;
    let expenseDone = false;

    const mergeAndCallback = () => {
        if (incomeDone && expenseDone) {
            const all = [...incomeData, ...expenseData].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            callback(all);
        }
    }

    const unsubIncomes = onSnapshot(query(incomesCollection, orderBy("date", "desc")), (snapshot) => {
        incomeData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Income));
        incomeDone = true;
        mergeAndCallback();
    }, onError);

    const unsubExpenses = onSnapshot(query(expensesCollection, orderBy("date", "desc")), (snapshot) => {
        expenseData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
        expenseDone = true;
        mergeAndCallback();
    }, onError);
    
    return () => {
        unsubIncomes();
        unsubExpenses();
    }
}

export function getBankAccountsRealtime(callback: (data: BankAccount[]) => void, onError: (error: Error) => void) {
    return onSnapshot(bankAccountsCollection, (snapshot) => {
        const accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankAccount));
        callback(accounts);
    }, onError);
}

export function getBanksRealtime(callback: (data: Bank[]) => void, onError: (error: Error) => void) {
    return onSnapshot(banksCollection, (snapshot) => {
        const banks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bank));
        callback(banks);
    }, onError);
}

export function getBankBranchesRealtime(callback: (data: BankBranch[]) => void, onError: (error: Error) => void) {
    return onSnapshot(bankBranchesCollection, (snapshot) => {
        const branches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankBranch));
        callback(branches);
    }, onError);
}

export function getProjectsRealtime(callback: (data: Project[]) => void, onError: (error: Error) => void) {
    return onSnapshot(query(projectsCollection, orderBy("startDate", "desc")), (snapshot) => {
        const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
        callback(projects);
    }, onError);
}

export function getEmployeesRealtime(callback: (data: Employee[]) => void, onError: (error: Error) => void) {
    return onSnapshot(query(employeesCollection, orderBy("employeeId")), (snapshot) => {
        const employees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
        callback(employees);
    }, onError);
}

export function getPayrollRealtime(callback: (data: PayrollEntry[]) => void, onError: (error: Error) => void) {
    return onSnapshot(query(payrollCollection, orderBy("payPeriod", "desc")), (snapshot) => {
        const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayrollEntry));
        callback(entries);
    }, onError);
}

export function getInventoryItemsRealtime(callback: (data: InventoryItem[]) => void, onError: (error: Error) => void) {
    return onSnapshot(query(inventoryItemsCollection, orderBy("name")), (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
        callback(items);
    }, onError);
}

export async function initialDataSync() {
    // This function can be used to pre-fetch data if needed, but with realtime listeners,
    // it's less critical. It can be useful for warming up the cache on app start.
    console.log("Initial data sync would happen here if it were still implemented.");
}
