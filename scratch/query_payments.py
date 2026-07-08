import sqlite3
import json

try:
    db_path = r'C:\Users\Raman Duggal\OneDrive\BIZSUITE\season\2\jrmd.sqlite'
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id, data FROM payments")
    rows = cursor.fetchall()
    print(f"Total payments row count: {len(rows)}")
    for row in rows:
        data = json.loads(row[1])
        ac = data.get('bankAcNo', '')
        amt = data.get('amount', 0)
        rtgs_amt = data.get('rtgsAmount', 0)
        if ac == '32501169461' or amt == 230510 or rtgs_amt == 230510:
            print("FOUND PAYMENT:", json.dumps(data, indent=2))
except Exception as e:
    print("ERROR:", e)
