const fetch = require('node-fetch');

const SECRET_SYNC_TOKEN = "jrmd2026";
const WORKER_URL = "https://jrmd-sync-worker.traderramanduggal.workers.dev";
const companyId = "biz_lnvo9ml47";
const subCompanyId = "sub_r12ygcdvu";
const year = "sea_b2j77ib9e";

async function inspect() {
    const collections = [
        'suppliers', 'customers', 'payments', 'customerPayments', 
        'banks', 'bankBranches', 'bankAccounts', 'supplierBankAccounts', 
        'fundTransactions', 'transactions', 'ledgerEntries', 'ledgerAccounts'
    ];

    console.log(`Inspecting D1 database tables directly...`);
    for (const col of collections) {
        // We will try pulling with X-Year = year
        const headers = {
            'Authorization': `Bearer ${SECRET_SYNC_TOKEN}`,
            'X-Company-Id': companyId,
            'X-Sub-Company-Id': subCompanyId,
            'X-Year': year,
            'Content-Type': 'application/json'
        };

        try {
            const url = `${WORKER_URL}/sync?collection=${col}&since=0`;
            const response = await fetch(url, {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                console.log(`Table ${col}: Status ${response.status}`);
                continue;
            }

            const { results } = await response.json();
            const count = results ? results.length : 0;
            console.log(`Table ${col} with Year ${year}: Found ${count} records.`);
            
            if (count > 0) {
                console.log(`  Sample item:`, results[0].id, results[0].updated_at);
            } else {
                // If 0, let's try with X-Year = COMMON
                const commonHeaders = { ...headers, 'X-Year': 'COMMON' };
                const commonResponse = await fetch(url, {
                    method: 'GET',
                    headers: commonHeaders
                });
                const commonData = await commonResponse.json();
                const commonCount = commonData.results ? commonData.results.length : 0;
                console.log(`  -> Checked with Year COMMON: Found ${commonCount} records.`);
                if (commonCount > 0) {
                    console.log(`  Sample COMMON item:`, commonData.results[0].id, commonData.results[0].updated_at);
                }
            }
        } catch (err) {
            console.error(`Error inspecting table ${col}:`, err.message);
        }
    }
}

inspect();
