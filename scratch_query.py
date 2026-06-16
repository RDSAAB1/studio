import sqlite3
import json

try:
    conn = sqlite3.connect('C:\\Users\\Raman Duggal\\OneDrive\\BIZSUITE\\season\\2\\jrmd.sqlite')
    cursor = conn.cursor()
    print("Database opened successfully.")
    
    # Get tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cursor.fetchall()]
    print("Tables:", tables)
    
    for t in ['customer_payments', 'payments', 'transactions']:
        if t in tables:
            try:
                cursor.execute(f"SELECT id, data FROM {t}")
                rows = cursor.fetchall()
                print(f"Checking table {t}, found {len(rows)} rows...")
                for row_id, data_str in rows:
                    data = json.loads(data_str)
                    if data.get('id') == 'L00433' or data.get('paymentId') == 'L00433':
                        print(f"FOUND in {t}:", json.dumps(data, indent=2))
            except Exception as e:
                print(f"Error checking table {t}: {e}")
                
except Exception as e:
    print("Error:", e)
