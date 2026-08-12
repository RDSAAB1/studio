import os
import sqlite3
import json

def inspect():
    db_path = "C:\\Users\\Raman Duggal\\OneDrive\\BIZSUITE\\season\\2\\jrmd.sqlite"
    if not os.path.exists(db_path):
        print(f"Could not find SQLite DB at: {db_path}")
        return

    print(f"Reading local database via Python at: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    tables = [
        'suppliers', 'customers', 'payments', 'customerPayments', 
        'banks', 'bankBranches', 'bankAccounts', 'supplierBankAccounts', 
        'fundTransactions', 'transactions', 'ledgerEntries', 'ledgerAccounts',
        '_sync_meta', '_sync_log'
    ]

    for t in tables:
        try:
            cursor.execute(f"SELECT count(*) FROM {t}")
            count = cursor.fetchone()[0]
            print(f"Local Table {t}: Found {count} rows.")
            
            if count > 0:
                # Get column names
                cursor.execute(f"PRAGMA table_info({t})")
                columns = [c[1] for c in cursor.fetchall()]
                
                query_cols = ["id"]
                if "_company_id" in columns:
                    query_cols.append("_company_id")
                if "_sub_company_id" in columns:
                    query_cols.append("_sub_company_id")
                if "_year" in columns:
                    query_cols.append("_year")
                
                query = f"SELECT {', '.join(query_cols)} FROM {t} LIMIT 3"
                cursor.execute(query)
                samples = cursor.fetchall()
                print(f"  Samples (cols: {query_cols}): {samples}")
        except Exception as e:
            print(f"Local Table {t}: Error - {str(e)}")

    conn.close()

if __name__ == "__main__":
    inspect()
