
import Dexie, { type Table } from 'dexie';
import type { Customer, Payment, CustomerPayment, Transaction, OptionItem, Bank, BankBranch, BankAccount, RtgsSettings, ReceiptSettings, Project, Loan, FundTransaction, Employee, PayrollEntry, AttendanceEntry, InventoryItem, FormatSettings, Holiday, LedgerAccount, LedgerEntry, MandiReport, SyncTask } from './definitions';
import { getSuppliersRealtime, getPaymentsRealtime, getAllSuppliers, getAllPayments, getAllCustomers, getAllCustomerPayments, getAllIncomes, getAllExpenses, getAllSupplierBankAccounts, getAllBanks, getAllBankBranches, getAllBankAccounts, getAllProjects, getAllLoans, getAllFundTransactions } from './firestore';

export class AppDatabase extends Dexie {
    suppliers!: Table<Customer>;
    customers!: Table<Customer>;
    payments!: Table<Payment>;
    customerPayments!: Table<CustomerPayment>;
    transactions!: Table<Transaction>;
    options!: Table<OptionItem>;
    banks!: Table<Bank>;
    bankBranches!: Table<BankBranch>;
    bankAccounts!: Table<BankAccount>;
    settings!: Table<RtgsSettings | ReceiptSettings | FormatSettings | Holiday>;
    projects!: Table<Project>;
    loans!: Table<Loan>;
    fundTransactions!: Table<FundTransaction>;
    employees!: Table<Employee>;
    payroll!: Table<PayrollEntry>;
    attendance!: Table<AttendanceEntry>;
    inventoryItems!: Table<InventoryItem>;
    ledgerAccounts!: Table<LedgerAccount>;
    ledgerEntries!: Table<LedgerEntry>;
    mandiReports!: Table<MandiReport>;
    syncQueue!: Table<SyncTask>;
    
    constructor() {
        super('bizsuiteDB_v2');
        this.version(1).stores({
            suppliers: '&id, &srNo, name, contact, date, customerId',
            customers: '++id, &srNo, name, contact, date, customerId',
            payments: '++id, paymentId, customerId, date',
            customerPayments: '++id, paymentId, customerId, date',
            transactions: '++id, transactionId, date, category, subCategory, type',
            options: '++id, type, name',
            banks: '&id, name',
            bankBranches: '++id, &ifscCode, bankName, branchName',
            bankAccounts: '++id, &accountNumber',
            settings: '&id',
            projects: '++id, name, startDate',
            loans: '++id, loanId, startDate',
            fundTransactions: '++id, date, type',
            employees: '++id, employeeId, name',
            payroll: '++id, employeeId, payPeriod',
            attendance: '&id, employeeId, date', 
            inventoryItems: '++id, sku, name',
            mandiReports: '&id, voucherNo, sellerName',
        });

        this.version(2).stores({
            suppliers: '&id, &srNo, name, contact, date, customerId',
            customers: '++id, &srNo, name, contact, date, customerId',
            payments: '++id, paymentId, customerId, date',
            customerPayments: '++id, paymentId, customerId, date',
            transactions: '++id, transactionId, date, category, subCategory, type',
            options: '++id, type, name',
            banks: '&id, name',
            bankBranches: '++id, &ifscCode, bankName, branchName',
            bankAccounts: '++id, &accountNumber',
            settings: '&id',
            projects: '++id, name, startDate',
            loans: '++id, loanId, startDate',
            fundTransactions: '++id, date, type',
            employees: '++id, employeeId, name',
            payroll: '++id, employeeId, payPeriod',
            attendance: '&id, employeeId, date', 
            inventoryItems: '++id, sku, name',
            ledgerAccounts: '&id, name',
            ledgerEntries: '&id, accountId, date',
            mandiReports: '&id, voucherNo, sellerName',
        });

        this.version(3).stores({
            suppliers: '&id, &srNo, name, contact, date, customerId',
            customers: '++id, &srNo, name, contact, date, customerId',
            payments: '++id, paymentId, customerId, date',
            customerPayments: '++id, paymentId, customerId, date',
            transactions: '++id, transactionId, date, category, subCategory, type',
            options: '++id, type, name',
            banks: '&id, name',
            bankBranches: '++id, &ifscCode, bankName, branchName',
            bankAccounts: '++id, &accountNumber',
            settings: '&id',
            projects: '++id, name, startDate',
            loans: '++id, loanId, startDate',
            fundTransactions: '++id, date, type',
            employees: '++id, employeeId, name',
            payroll: '++id, employeeId, payPeriod',
            attendance: '&id, employeeId, date', 
            inventoryItems: '++id, sku, name',
            ledgerAccounts: '&id, name',
            ledgerEntries: '&id, accountId, date',
            mandiReports: '&id, voucherNo, sellerName',
            syncQueue: '++id, status, nextRetryAt, dedupeKey, type',
        });
    }
}

// Conditionally create the database instance only on the client-side
let db: AppDatabase;
if (typeof window !== 'undefined') {
  db = new AppDatabase();
}

// Export the db instance. It will be undefined on the server.
export { db };


// --- Synchronization Logic ---
// ✅ UPDATED: Use incremental sync from local-first-sync instead of reading entire collections
export async function syncAllData() {
    if (!db) return;

    console.log("Starting incremental data sync...");

    // ✅ Use incremental sync from local-first-sync manager
    // This will only sync changed documents, not entire collections
    try {
        const { forceSyncFromFirestore } = await import('./local-first-sync');
        await forceSyncFromFirestore();
        console.log("✅ Incremental sync completed - only changed documents synced");
    } catch (error) {
        console.error("Sync Error:", error);
        // Fallback to old method if local-first-sync fails (only for first time)
        console.warn("Falling back to full sync (first time only)...");
        
        // First sync - get all (only once)
        getSuppliersRealtime(async (suppliers) => {
            if (suppliers.length > 0 && db) {
                try {
                    await db.suppliers.bulkPut(suppliers);
                    console.log(`Synced ${suppliers.length} suppliers (first sync).`);
                    // Save last sync time
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('lastSync:suppliers', String(Date.now()));
                    }
                } catch (error: any) {
                    console.error("Sync Error (Suppliers):", error);
                }
            }
        }, (error) => console.error("Sync Error (Suppliers):", error));

        getPaymentsRealtime(async (payments) => {
            if (payments.length > 0 && db) {
                try {
                    await db.payments.bulkPut(payments);
                    console.log(`Synced ${payments.length} payments (first sync).`);
                    // Save last sync time
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('lastSync:payments', String(Date.now()));
                    }
                } catch (error: any) {
                    console.error("Sync Error (Payments):", error);
                }
            }
        }, (error) => console.error("Sync Error (Payments):", error));
    }
}

// Sync collection info type
export interface SyncCollectionInfo {
  collectionName: string;
  displayName: string;
  totalInFirestore: number;
  fetched: number;
  sent: number;
  status: 'pending' | 'syncing' | 'success' | 'error';
  error?: string;
}

// Comprehensive sync function that returns detailed information
export async function syncAllDataWithDetails(
  selectedCollections?: string[],
  onProgress?: (collections: SyncCollectionInfo[]) => void
): Promise<SyncCollectionInfo[]> {
  if (!db) return [];

  const collections: SyncCollectionInfo[] = [];
  
  // Helper to update progress
  const updateProgress = () => {
    if (onProgress) {
      onProgress([...collections]);
    }
  };
  
  // Define all collections to sync
  const allCollectionConfigs = [
    { name: 'suppliers', displayName: 'Suppliers', getAllFn: getAllSuppliers, localTable: () => db.suppliers },
    { name: 'customers', displayName: 'Customers', getAllFn: getAllCustomers, localTable: () => db.customers },
    { name: 'payments', displayName: 'Payments', getAllFn: getAllPayments, localTable: () => db.payments },
    { name: 'customerPayments', displayName: 'Customer Payments', getAllFn: getAllCustomerPayments, localTable: () => db.customerPayments },
    { name: 'supplierBankAccounts', displayName: 'Supplier Bank Accounts', getAllFn: getAllSupplierBankAccounts, localTable: () => db.bankAccounts, isSpecial: true },
    { name: 'banks', displayName: 'Banks', getAllFn: getAllBanks, localTable: () => db.banks },
    { name: 'bankBranches', displayName: 'Bank Branches', getAllFn: getAllBankBranches, localTable: () => db.bankBranches },
    { name: 'bankAccounts', displayName: 'Bank Accounts', getAllFn: getAllBankAccounts, localTable: () => db.bankAccounts },
    { name: 'projects', displayName: 'Projects', getAllFn: getAllProjects, localTable: () => db.projects },
    { name: 'loans', displayName: 'Loans', getAllFn: getAllLoans, localTable: () => db.loans },
    { name: 'fundTransactions', displayName: 'Fund Transactions', getAllFn: getAllFundTransactions, localTable: () => db.fundTransactions },
  ];

  // Filter collections based on selection
  const collectionConfigs = selectedCollections 
    ? allCollectionConfigs.filter(config => selectedCollections.includes(config.name))
    : allCollectionConfigs;

  // Sync each collection
  for (let i = 0; i < collectionConfigs.length; i++) {
    const config = collectionConfigs[i];
    const info: SyncCollectionInfo = {
      collectionName: config.name,
      displayName: config.displayName,
      totalInFirestore: 0,
      fetched: 0,
      sent: 0,
      status: 'syncing',
    };
    collections.push(info);
    updateProgress();

    try {
      info.status = 'syncing';
      info.error = `Fetching data from Firestore...`;
      updateProgress();
      // Get total count in Firestore
      info.error = `Fetching ${config.displayName} from Firestore...`;
      updateProgress();
      const allData = await config.getAllFn();
      info.totalInFirestore = allData.length;
      info.error = `Found ${allData.length} records. Processing...`;
      updateProgress();
      
      // Save to local
      if (allData.length > 0) {
        const localTable = config.localTable();
        if (localTable) {
          // Get existing local data count before sync
          const existingCount = await localTable.count();
          
          // Handle duplicates for collections with unique indexes
          let dataToSync = allData;
          if (config.name === 'bankBranches') {
            // First, clean up existing duplicates in local database
            info.error = `Cleaning up duplicates in ${config.displayName}...`;
            updateProgress();
            try {
              const existingBranches = await localTable.toArray();
              const ifscMap = new Map<string, any[]>();
              
              // Group existing branches by IFSC code
              existingBranches.forEach((branch: any) => {
                const ifscCode = branch.ifscCode?.toUpperCase()?.trim() || '';
                if (ifscCode) {
                  if (!ifscMap.has(ifscCode)) {
                    ifscMap.set(ifscCode, []);
                  }
                  ifscMap.get(ifscCode)!.push(branch);
                }
              });
              
              // Remove duplicate existing records (keep the most recent one)
              for (const [ifscCode, branches] of ifscMap.entries()) {
                if (branches.length > 1) {
                  // Sort by updatedAt/createdAt, keep the most recent
                  branches.sort((a, b) => {
                    const timeA = a.updatedAt || a.createdAt || '';
                    const timeB = b.updatedAt || b.createdAt || '';
                    return timeB.localeCompare(timeA);
                  });
                  
                  // Delete all except the first (most recent)
                  const toDelete = branches.slice(1);
                  const deleteIds = toDelete.map((b: any) => b.id).filter((id: any) => id !== undefined);
                  if (deleteIds.length > 0) {
                    await localTable.bulkDelete(deleteIds);
                    console.warn(`Cleaned up ${deleteIds.length} duplicate bankBranches with IFSC: ${ifscCode}`);
                  }
                }
              }
            } catch (cleanupError) {
              console.warn('Error cleaning up existing duplicates:', cleanupError);
            }
            
            // Remove duplicates from incoming data, keep the most recent one
            info.error = `Removing duplicates from ${config.displayName}...`;
            updateProgress();
            const uniqueMap = new Map<string, any>();
            const itemsWithoutIfsc: any[] = [];
            
            allData.forEach((item: any) => {
              const ifscCode = item.ifscCode?.toUpperCase()?.trim() || '';
              if (ifscCode) {
                const existing = uniqueMap.get(ifscCode);
                if (!existing) {
                  uniqueMap.set(ifscCode, item);
                } else {
                  // Keep the one with more recent updatedAt or createdAt
                  const existingTime = existing.updatedAt || existing.createdAt || '';
                  const currentTime = item.updatedAt || item.createdAt || '';
                  if (currentTime > existingTime) {
                    uniqueMap.set(ifscCode, item);
                  }
                }
              } else {
                // Items without IFSC code - add them separately (they won't conflict with unique index)
                itemsWithoutIfsc.push(item);
              }
            });
            
            dataToSync = [...Array.from(uniqueMap.values()), ...itemsWithoutIfsc];
            if (dataToSync.length < allData.length) {
              console.warn(`Removed ${allData.length - dataToSync.length} duplicate bankBranches from Firestore data based on IFSC code`);
            }
          } else if (config.name === 'bankAccounts' || config.name === 'supplierBankAccounts') {
            // First, clean up existing duplicates in local database
            try {
              const existingAccounts = await localTable.toArray();
              const accountMap = new Map<string, any[]>();
              
              // Group existing accounts by account number
              existingAccounts.forEach((account: any) => {
                const accountNumber = account.accountNumber?.trim() || '';
                if (accountNumber) {
                  if (!accountMap.has(accountNumber)) {
                    accountMap.set(accountNumber, []);
                  }
                  accountMap.get(accountNumber)!.push(account);
                }
              });
              
              // Remove duplicate existing records (keep the most recent one)
              for (const [accountNumber, accounts] of accountMap.entries()) {
                if (accounts.length > 1) {
                  // Sort by updatedAt/createdAt, keep the most recent
                  accounts.sort((a, b) => {
                    const timeA = a.updatedAt || a.createdAt || '';
                    const timeB = b.updatedAt || b.createdAt || '';
                    return timeB.localeCompare(timeA);
                  });
                  
                  // Delete all except the first (most recent)
                  const toDelete = accounts.slice(1);
                  const deleteIds = toDelete.map((a: any) => a.id).filter((id: any) => id !== undefined);
                  if (deleteIds.length > 0) {
                    await localTable.bulkDelete(deleteIds);
                    console.warn(`Cleaned up ${deleteIds.length} duplicate ${config.name} with account number: ${accountNumber}`);
                  }
                }
              }
            } catch (cleanupError) {
              console.warn(`Error cleaning up existing duplicates for ${config.name}:`, cleanupError);
            }
            
            // Remove duplicates from incoming data, keep the most recent one
            const uniqueMap = new Map<string, any>();
            const itemsWithoutAccount: any[] = [];
            
            allData.forEach((item: any) => {
              const accountNumber = item.accountNumber?.trim() || '';
              if (accountNumber) {
                const existing = uniqueMap.get(accountNumber);
                if (!existing) {
                  uniqueMap.set(accountNumber, item);
                } else {
                  // Keep the one with more recent updatedAt or createdAt
                  const existingTime = existing.updatedAt || existing.createdAt || '';
                  const currentTime = item.updatedAt || item.createdAt || '';
                  if (currentTime > existingTime) {
                    uniqueMap.set(accountNumber, item);
                  }
                }
              } else {
                // Items without account number - add them separately
                itemsWithoutAccount.push(item);
              }
            });
            
            dataToSync = [...Array.from(uniqueMap.values()), ...itemsWithoutAccount];
            if (dataToSync.length < allData.length) {
              console.warn(`Removed ${allData.length - dataToSync.length} duplicate ${config.name} from Firestore data based on account number`);
            }
          }
          
          // Use bulkPut to update/insert with error handling
          let actualFetched = dataToSync.length;
          info.error = `Syncing ${dataToSync.length} ${config.displayName} records...`;
          updateProgress();
          try {
            await localTable.bulkPut(dataToSync);
            info.error = undefined;
          } catch (bulkError: any) {
            // If bulkPut fails, try individual puts to identify problematic records
            if (bulkError.name === 'BulkError' || bulkError.failures) {
              console.warn(`BulkPut failed for ${config.name}, trying individual puts...`);
              let successCount = 0;
              let failureCount = 0;
              const failedItems: string[] = [];
              
              for (const item of dataToSync) {
                try {
                  await localTable.put(item);
                  successCount++;
                } catch (itemError: any) {
                  failureCount++;
                  const itemId = item.id || item.ifscCode || item.accountNumber || 'unknown';
                  failedItems.push(itemId);
                  console.warn(`Failed to sync ${config.name} item (${itemId}):`, itemError.message);
                }
              }
              
              actualFetched = successCount;
              
              // Log warning but don't fail the entire sync if some items succeeded
              if (failureCount > 0) {
                const warningMsg = `${failureCount} of ${dataToSync.length} ${config.name} items failed to sync. ${successCount} succeeded. Failed items: ${failedItems.join(', ')}`;
                console.warn(warningMsg);
                // Only throw error if ALL items failed
                if (successCount === 0) {
                  throw new Error(warningMsg);
                } else {
                  // Some succeeded, some failed - log but continue
                  info.error = `${failureCount} items failed (see console for details)`;
                }
              }
            } else {
              throw bulkError;
            }
          }
          
          info.fetched = actualFetched;
          
          // Count pending changes for this collection (data to be sent to Firestore)
          // Check sync queue for pending tasks related to this collection
          if (db) {
            try {
              const allPendingTasks = await db.syncQueue
                .where('status')
                .anyOf(['pending', 'failed'])
                .toArray();
              const pendingTasks = allPendingTasks.filter(task => {
                const taskType = (task as any).type || '';
                return taskType.includes(config.name) || taskType.includes(`:${config.name}`);
              });
              info.sent = pendingTasks.length;
            } catch {
              info.sent = 0;
            }
          } else {
            info.sent = 0;
          }
          
          info.status = 'success';
          info.error = undefined;
          updateProgress();
        } else {
          info.status = 'error';
          info.error = 'Local table not found';
          updateProgress();
        }
      } else {
        // Even if no data, check for pending changes
        if (db) {
          try {
            const allPendingTasks = await db.syncQueue
              .where('status')
              .anyOf(['pending', 'failed'])
              .toArray();
            const pendingTasks = allPendingTasks.filter(task => {
              const taskType = (task as any).type || '';
              return taskType.includes(config.name) || taskType.includes(`:${config.name}`);
            });
            info.sent = pendingTasks.length;
          } catch {
            info.sent = 0;
          }
        }
        info.status = 'success';
      }
    } catch (error: any) {
      info.status = 'error';
      info.error = error.message || 'Unknown error';
      console.error(`Error syncing ${config.name}:`, error);
    }
  }

  // Handle incomes and expenses separately (stored in transactions table)
  const incomeInfo: SyncCollectionInfo = {
    collectionName: 'incomes',
    displayName: 'Incomes',
    totalInFirestore: 0,
    fetched: 0,
    sent: 0,
    status: 'syncing',
  };
  collections.push(incomeInfo);

  try {
    const incomes = await getAllIncomes();
    incomeInfo.totalInFirestore = incomes.length;
    if (incomes.length > 0) {
      const allTransactions = incomes.map(inc => ({ ...inc, type: 'income' } as Transaction));
      await db.transactions.bulkPut(allTransactions);
      incomeInfo.fetched = incomes.length;
    }
    // Check for pending sync tasks
    if (db) {
      try {
        const allPendingTasks = await db.syncQueue
          .where('status')
          .anyOf(['pending', 'failed'])
          .toArray();
        const pendingTasks = allPendingTasks.filter(task => {
          const taskType = (task as any).type || '';
          return taskType.includes('incomes') || taskType.includes('income');
        });
        incomeInfo.sent = pendingTasks.length;
      } catch {
        incomeInfo.sent = 0;
      }
    }
    incomeInfo.status = 'success';
  } catch (error: any) {
    incomeInfo.status = 'error';
    incomeInfo.error = error.message || 'Unknown error';
  }

  const expenseInfo: SyncCollectionInfo = {
    collectionName: 'expenses',
    displayName: 'Expenses',
    totalInFirestore: 0,
    fetched: 0,
    sent: 0,
    status: 'syncing',
  };
  collections.push(expenseInfo);

  try {
    const expenses = await getAllExpenses();
    expenseInfo.totalInFirestore = expenses.length;
    if (expenses.length > 0) {
      const allTransactions = expenses.map(exp => ({ ...exp, type: 'expense' } as Transaction));
      await db.transactions.bulkPut(allTransactions);
      expenseInfo.fetched = expenses.length;
    }
    // Check for pending sync tasks
    if (db) {
      try {
        const allPendingTasks = await db.syncQueue
          .where('status')
          .anyOf(['pending', 'failed'])
          .toArray();
        const pendingTasks = allPendingTasks.filter(task => {
          const taskType = (task as any).type || '';
          return taskType.includes('expenses') || taskType.includes('expense');
        });
        expenseInfo.sent = pendingTasks.length;
      } catch {
        expenseInfo.sent = 0;
      }
    }
    expenseInfo.status = 'success';
  } catch (error: any) {
    expenseInfo.status = 'error';
    expenseInfo.error = error.message || 'Unknown error';
  }

  // Update lastSync times
  if (typeof window !== 'undefined') {
    const now = Date.now();
    collections.forEach(col => {
      if (col.status === 'success') {
        localStorage.setItem(`lastSync:${col.collectionName}`, String(now));
      }
    });
  }

  return collections;
}

// Hard sync: replace local IndexedDB with fresh Firestore data (all collections)
// This clears all lastSync times and forces a full sync from Firestore
export async function hardSyncAllData() {
    if (!db) return;
    
    try {
        console.log('🔄 Starting full sync from Firestore...');
        
        // ✅ Clear all lastSync times to force full sync on next realtime listener update
        if (typeof window !== 'undefined') {
            const syncKeys = [
                'lastSync:suppliers',
                'lastSync:customers',
                'lastSync:payments',
                'lastSync:customerPayments',
                'lastSync:incomes',
                'lastSync:expenses',
                'lastSync:projects',
                'lastSync:loans',
                'lastSync:fundTransactions',
            ];
            syncKeys.forEach(key => localStorage.removeItem(key));
            console.log('✅ Cleared all lastSync timestamps');
        }
        
        // ✅ Fetch all data from Firestore in parallel
        const [
            suppliers,
            customers,
            payments,
            customerPayments,
            incomes,
            expenses
        ] = await Promise.all([
            getAllSuppliers().catch(e => { console.warn('Failed to sync suppliers:', e); return []; }),
            getAllCustomers().catch(e => { console.warn('Failed to sync customers:', e); return []; }),
            getAllPayments().catch(e => { console.warn('Failed to sync payments:', e); return []; }),
            getAllCustomerPayments().catch(e => { console.warn('Failed to sync customerPayments:', e); return []; }),
            getAllIncomes().catch(e => { console.warn('Failed to sync incomes:', e); return []; }),
            getAllExpenses().catch(e => { console.warn('Failed to sync expenses:', e); return []; }),
        ]);
        
        // ✅ Update IndexedDB with fresh data
        await db.transaction('rw', db.suppliers, db.customers, db.payments, db.customerPayments, db.transactions, async () => {
            // Clear existing data
            await db.suppliers.clear();
            await db.customers.clear();
            await db.payments.clear();
            await db.customerPayments.clear();
            
            // Add fresh data
            if (suppliers?.length) {
                await db.suppliers.bulkAdd(suppliers);
                console.log(`✅ Synced ${suppliers.length} suppliers`);
            }
            if (customers?.length) {
                await db.customers.bulkAdd(customers);
                console.log(`✅ Synced ${customers.length} customers`);
            }
            if (payments?.length) {
                await db.payments.bulkAdd(payments);
                console.log(`✅ Synced ${payments.length} payments`);
            }
            if (customerPayments?.length) {
                await db.customerPayments.bulkAdd(customerPayments);
                console.log(`✅ Synced ${customerPayments.length} customer payments`);
            }
            
            // Handle incomes and expenses (stored in transactions table)
            if (incomes?.length || expenses?.length) {
                const allTransactions: Transaction[] = [
                    ...(incomes?.map(inc => ({ ...inc, type: 'income' } as Transaction)) || []),
                    ...(expenses?.map(exp => ({ ...exp, type: 'expense' } as Transaction)) || [])
                ];
                if (allTransactions.length > 0) {
                    // Clear only income/expense transactions
                    const existing = await db.transactions.where('type').anyOf(['income', 'expense']).toArray();
                    if (existing.length > 0) {
                        await db.transactions.bulkDelete(existing.map(t => t.id!));
                    }
                    await db.transactions.bulkAdd(allTransactions);
                    console.log(`✅ Synced ${incomes?.length || 0} incomes and ${expenses?.length || 0} expenses`);
                }
            }
        });
        
        // ✅ Update lastSync times after successful sync
        if (typeof window !== 'undefined') {
            const now = Date.now();
            localStorage.setItem('lastSync:suppliers', String(now));
            localStorage.setItem('lastSync:customers', String(now));
            localStorage.setItem('lastSync:payments', String(now));
            localStorage.setItem('lastSync:customerPayments', String(now));
            localStorage.setItem('lastSync:incomes', String(now));
            localStorage.setItem('lastSync:expenses', String(now));
        }
        
        console.log('✅ Full sync completed successfully');
    } catch (e) {
        console.error('❌ Hard sync failed:', e);
        throw e;
    }
}


// --- Local DB Helper Functions ---
export async function updateSupplierInLocalDB(id: string, data: Partial<Customer>) {
    if (db) {
        await db.suppliers.update(id, data);
    }
}

export async function deletePaymentFromLocalDB(paymentId: string) {
    if (db) {
        await db.payments.delete(paymentId);
    }
}


// Generic function to clear all data from all tables
export async function clearAllLocalData() {
    if (db) {
        await Promise.all(db.tables.map(table => table.clear()));
    }
}
