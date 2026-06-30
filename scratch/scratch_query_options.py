import sqlite3
import json

db_path = 'C:\\Users\\Raman Duggal\\OneDrive\\BIZSUITE\\season\\2\\jrmd.sqlite'

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    print("Database opened successfully.")
    
    # List all tables in the database to be sure
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print("Tables in DB:", [t[0] for t in tables])
    
    # Query options table
    cursor.execute("SELECT id, data FROM options;")
    options = cursor.fetchall()
    print(f"Total options: {len(options)}")
    
    for opt_id, data in options:
        try:
            parsed = json.loads(data)
            print(f"ID: {opt_id} | Name: {parsed.get('name')} | Type: {parsed.get('type')}")
        except Exception as e:
            print(f"ID: {opt_id} | Raw Data: {data} | Error: {e}")
            
    print("\nTesting dynamic query via SQL:")
    # We will simulate: json_extract(data, '$.' || 'type') = 'varieties'
    # Note: sqlite3 in Python supports json_extract natively in newer Python versions
    try:
        cursor.execute("SELECT id, data FROM options WHERE json_extract(data, '$.type') = 'varieties';")
        rows = cursor.fetchall()
        print(f"json_extract(data, '$.type') = 'varieties' returned {len(rows)} rows.")
        for r in rows:
            print(r)
    except Exception as e:
        print("json_extract query failed:", e)

    conn.close()
except Exception as e:
    print("Error:", e)
