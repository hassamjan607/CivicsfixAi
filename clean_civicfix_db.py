import sqlite3
import os

def clean_civicfix_db():
    db_path = "civicfix.db"
    if not os.path.exists(db_path):
        print(f"File {db_path} not found.")
        return

    print("[*] Starting civicfix.db dummy data purge...")
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # 1. Delete events and image hashes
    c.execute("DELETE FROM statusevent")
    ev_count = c.rowcount
    print(f"[OK] Cleared statusevent: {ev_count} records removed.")

    c.execute("DELETE FROM imagehash")
    img_count = c.rowcount
    print(f"[OK] Cleared imagehash: {img_count} records removed.")

    # 2. Delete complaints
    c.execute("DELETE FROM complaint")
    comp_count = c.rowcount
    print(f"[OK] Cleared complaint: {comp_count} records removed.")

    # 3. Reset tracking sequence if present
    try:
        c.execute("DELETE FROM tracking_sequence")
        print("[RESET] Reset tracking_sequence counter.")
    except Exception:
        pass

    try:
        c.execute("DELETE FROM sqlite_sequence WHERE name IN ('complaint', 'statusevent', 'imagehash', 'tracking_sequence')")
        print("[RESET] Reset SQLite auto-increment sequences.")
    except Exception:
        pass

    conn.commit()

    # 4. Verify preserved structural tables
    c.execute("SELECT COUNT(*) FROM department")
    dept_cnt = c.fetchone()[0]

    c.execute("SELECT COUNT(*) FROM asset")
    asset_cnt = c.fetchone()[0]

    print("\n[VERIFICATION] Preserved Municipal Reference Records:")
    print(f"   - Departments retained: {dept_cnt}")
    print(f"   - Municipal Infrastructure Assets retained: {asset_cnt}")

    conn.close()
    print("\n[SUCCESS] civicfix.db is now 100% clean and ready for live end-to-end testing!")

if __name__ == "__main__":
    clean_civicfix_db()
