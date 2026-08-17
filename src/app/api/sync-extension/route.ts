import { NextResponse } from 'next/server';

const WORKER_URL = "https://jrmd-sync-worker.traderramanduggal.workers.dev/sync";
const SYNC_TOKEN = "Bearer jrmd2026";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || 'root';
    const subCompanyId = searchParams.get('subCompanyId') || 'main';
    const year = searchParams.get('year') || 'default';
    const username = searchParams.get('username') || 'unknown';

    const headers = {
      'Authorization': SYNC_TOKEN,
      'Content-Type': 'application/json',
      'X-Company-Id': companyId,
      'X-Sub-Company-Id': subCompanyId,
      'X-Year': year,
      'X-User-Id': username
    };

    const allBankAccounts: any[] = [];
    const allMandiReports: any[] = [];

    // 1. Fetch supplierBankAccounts from Cloud D1
    try {
      const bankRes = await fetch(`${WORKER_URL}?collection=supplierBankAccounts&since=0`, {
        method: 'GET',
        headers: { ...headers, 'X-Year': 'COMMON' },
        signal: AbortSignal.timeout(10000)
      });
      if (bankRes.ok) {
        const json = await bankRes.json();
        const results = json.results || [];
        results.forEach((row: any) => {
          if (row && row.data) {
            try {
              const parsed = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
              allBankAccounts.push({ id: row.id, ...parsed });
            } catch (e) {
              allBankAccounts.push({ id: row.id });
            }
          }
        });
      }
    } catch (e) {}

    // 2. Fetch mandiReports from Cloud D1
    try {
      const mandiRes = await fetch(`${WORKER_URL}?collection=mandiReports&since=0`, {
        method: 'GET',
        headers: headers,
        signal: AbortSignal.timeout(10000)
      });
      if (mandiRes.ok) {
        const json = await mandiRes.json();
        const results = json.results || [];
        results.forEach((row: any) => {
          if (row && row.data) {
            try {
              const parsed = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
              allMandiReports.push({ id: row.id, ...parsed });
            } catch (e) {
              allMandiReports.push({ id: row.id });
            }
          }
        });
      }
    } catch (e) {}

    // De-duplicate bank accounts
    const uniqueAccounts = Array.from(
      new Map(
        allBankAccounts
          .filter(acc => acc && (acc.accountNumber || acc.accountHolderName))
          .map(acc => [acc.accountNumber || acc.id, acc])
      ).values()
    );

    // De-duplicate 6R reports
    const uniqueReports = Array.from(
      new Map(
        allMandiReports
          .filter(rep => rep && (rep.prapatraNumber || rep.id || rep.srNo))
          .map(rep => [rep.prapatraNumber || rep.id || rep.srNo, rep])
      ).values()
    );

    return NextResponse.json({
      success: true,
      bankAccounts: uniqueAccounts,
      mandiReports: uniqueReports
    });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("[sync-extension D1 GET] error:", e);
    return NextResponse.json({
      success: false,
      error: e.message || 'Internal server error',
      bankAccounts: [],
      mandiReports: []
    }, { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, companyId, subCompanyId, year, username, prapatraNumber, records } = body;

    const headers = {
      'Authorization': SYNC_TOKEN,
      'Content-Type': 'application/json',
      'X-Company-Id': companyId || 'root',
      'X-Sub-Company-Id': subCompanyId || 'main',
      'X-Year': year || 'default',
      'X-User-Id': username || 'unknown'
    };

    if (action === 'clear_all_6r') {
      // DELETE request to Cloud D1 Worker for collection=mandiReports
      await fetch(`${WORKER_URL}?collection=mandiReports`, {
        method: 'DELETE',
        headers,
        signal: AbortSignal.timeout(10000)
      }).catch(() => {});
      return NextResponse.json({ success: true, message: 'Cleared all 6R records from Cloud D1' });
    }

    if (action === 'delete_single_6r' && prapatraNumber) {
      // POST single delete change to Cloud D1 Worker
      await fetch(WORKER_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          collection: 'mandiReports',
          changes: [{ id: String(prapatraNumber), operation: 'delete' }]
        }),
        signal: AbortSignal.timeout(10000)
      }).catch(() => {});
      return NextResponse.json({ success: true, message: `Deleted 6R record ${prapatraNumber} from Cloud D1` });
    }

    if (action === 'push_6r' && Array.isArray(records) && records.length > 0) {
      // Push bulk 6R records to Cloud D1 Worker
      const changes = records.map((r: any) => ({
        id: String(r.prapatraNumber || r.id || (Date.now() + Math.random())),
        operation: 'upsert',
        data: r,
        updated_at: Date.now()
      }));

      await fetch(WORKER_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          collection: 'mandiReports',
          changes
        }),
        signal: AbortSignal.timeout(10000)
      }).catch(() => {});
      return NextResponse.json({ success: true, message: `Pushed ${changes.length} 6R records to Cloud D1` });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("[sync-extension D1 POST] error:", e);
    return NextResponse.json({ success: false, error: e.message || 'Internal server error' }, { status: 200 });
  }
}
