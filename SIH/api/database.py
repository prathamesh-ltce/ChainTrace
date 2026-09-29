import sqlite3
import json
import csv
import os
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any
from api.config import DB_PATH, VASP_CSV_PATH, REPORTS_DIR

def get_db_connection():
    """Returns a SQLite connection with row factory enabled."""
    conn = sqlite3.connect(str(DB_PATH), timeout=20.0)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password: str) -> str:
    """Hash password with sha256 + salt."""
    salt = "sih_2026_salt_leas"
    return hashlib.sha256((salt + password).encode("utf-8")).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against hashed."""
    return hash_password(plain_password) == hashed_password

def init_db():
    """Initializes tables, default users, loads VASP registry and migrates existing reports."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        badge_id TEXT,
        unit TEXT,
        role TEXT DEFAULT 'investigator',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
    )
    """)

    # 2. Cases Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS cases (
        case_id TEXT PRIMARY KEY,
        suspect_address TEXT NOT NULL,
        blockchain TEXT NOT NULL,
        risk_score INTEGER DEFAULT 0,
        risk_level TEXT DEFAULT 'LOW',
        max_hops_traced INTEGER DEFAULT 0,
        vasp_targets_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        duration_seconds REAL DEFAULT 0.0,
        report_json TEXT,
        created_by TEXT DEFAULT 'system',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
    )
    """)

    # 3. Trace Logs Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS trace_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id TEXT,
        hop INTEGER,
        from_address TEXT,
        to_address TEXT,
        amount REAL,
        currency TEXT,
        timestamp INTEGER,
        tx_hash TEXT,
        profile TEXT,
        acc_score REAL,
        paes_score REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE
    )
    """)

    # 4. VASP Discoveries Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS vasp_discoveries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id TEXT,
        hop INTEGER,
        address TEXT,
        vasp_name TEXT,
        jurisdiction TEXT,
        compliance_email TEXT,
        acc_score REAL,
        paes_score REAL,
        statutory_notice TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE
    )
    """)

    # 5. VASP Registry Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS vasp_registry (
        address TEXT PRIMARY KEY,
        vasp_name TEXT NOT NULL,
        vasp_type TEXT DEFAULT 'exchange',
        country TEXT DEFAULT 'India',
        risk_level TEXT DEFAULT 'low',
        chain TEXT DEFAULT 'ETH',
        address_type TEXT DEFAULT 'hot_wallet',
        verified INTEGER DEFAULT 1,
        source TEXT DEFAULT 'MANUAL',
        compliance_email TEXT DEFAULT '',
        compliance_portal TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 6. Alerts Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id TEXT,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        entity_address TEXT,
        entity_name TEXT,
        is_read INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 7. Audit Log Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        action TEXT NOT NULL,
        case_id TEXT,
        details TEXT,
        ip_address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 8. Batch Jobs Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS batch_jobs (
        batch_id TEXT PRIMARY KEY,
        status TEXT DEFAULT 'pending',
        total_count INTEGER DEFAULT 0,
        completed_count INTEGER DEFAULT 0,
        addresses_json TEXT,
        results_json TEXT,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
    )
    """)

    conn.commit()

    # Pre-populate default users if empty
    cursor.execute("SELECT COUNT(*) as cnt FROM users")
    if cursor.fetchone()["cnt"] == 0:
        cursor.execute("""
        INSERT INTO users (username, password_hash, full_name, badge_id, unit, role)
        VALUES 
            (?, ?, 'Senior Cyber Investigator', 'LEA-DL-9842', 'Cyber Crime Cell, Delhi Police', 'admin'),
            (?, ?, 'Inspector R. Sharma', 'LEA-MH-4511', 'Economic Offences Wing, Mumbai', 'investigator'),
            (?, ?, 'Sub-Inspector A. Verma', 'LEA-KA-7721', 'CID Cyber Crime, Karnataka', 'investigator')
        """, (
            "admin", hash_password("sih2026"),
            "officer_sharma", hash_password("sih2026"),
            "investigator_verma", hash_password("sih2026")
        ))
        conn.commit()

    # Populate VASP Registry from CSV
    if VASP_CSV_PATH.exists():
        try:
            with open(VASP_CSV_PATH, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    addr = row.get("address", "").strip()
                    if not addr:
                        continue
                    v_name = row.get("vasp_name", "").strip()
                    # Assign standard compliance email based on vasp_name
                    c_email = f"compliance@{v_name.lower().replace(' ', '')}.com"
                    if "wazirx" in v_name.lower():
                        c_email = "nodal@wazirx.com"
                    elif "coindcx" in v_name.lower():
                        c_email = "compliance@coindcx.com"
                    elif "coinswitch" in v_name.lower():
                        c_email = "legal@coinswitch.co"
                    elif "binance" in v_name.lower():
                        c_email = "case-response@binance.com"

                    cursor.execute("""
                    INSERT OR IGNORE INTO vasp_registry 
                        (address, vasp_name, vasp_type, country, risk_level, chain, address_type, verified, source, compliance_email)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        addr,
                        v_name,
                        row.get("vasp_type", "exchange"),
                        row.get("country", "India"),
                        row.get("risk_level", "low"),
                        row.get("chain", "ETH").upper(),
                        row.get("address_type", "hot_wallet"),
                        1 if str(row.get("verified", "")).lower() in ("true", "1") else 0,
                        row.get("source", "FIU_IND_REGISTRY"),
                        c_email
                    ))
            conn.commit()
        except Exception as e:
            print(f"[!] Warning syncing VASP CSV to DB: {e}")

    # Migrate existing reports from reports/ directory
    if REPORTS_DIR.exists():
        try:
            for p in REPORTS_DIR.glob("*.json"):
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    c_id = data.get("case_id") or p.stem
                    cursor.execute("SELECT case_id FROM cases WHERE case_id = ?", (c_id,))
                    if not cursor.fetchone():
                        risk = data.get("risk_assessment", {})
                        r_score = risk.get("composite_score", risk.get("risk_score", 0))
                        r_level = risk.get("risk_level", "LOW")
                        suspect = data.get("suspect_wallet", data.get("suspect_address", "Unknown"))
                        chain = data.get("coin", data.get("blockchain", "BTC"))
                        hops = data.get("hops_traced", len(data.get("chain_of_custody_ledger", [])))
                        v_count = len(data.get("vasp_targets", []))
                        dur = data.get("duration_seconds", 0.0)

                        cursor.execute("""
                        INSERT INTO cases 
                            (case_id, suspect_address, blockchain, risk_score, risk_level, max_hops_traced, vasp_targets_count, status, duration_seconds, report_json, created_at, completed_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, 'complete', ?, ?, ?, ?)
                        """, (
                            c_id, suspect, chain, r_score, r_level, hops, v_count, dur,
                            json.dumps(data, ensure_ascii=False),
                            data.get("generated_at", datetime.now(timezone.utc).isoformat()),
                            data.get("generated_at", datetime.now(timezone.utc).isoformat())
                        ))
                except Exception:
                    pass
            conn.commit()
        except Exception as e:
            print(f"[!] Warning migrating existing reports: {e}")

    conn.close()

def log_audit(username: str, action: str, case_id: Optional[str] = None, details: Optional[str] = None, ip_address: Optional[str] = None):
    """Appends an event to the immutable audit log."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO audit_log (username, action, case_id, details, ip_address)
        VALUES (?, ?, ?, ?, ?)
        """, (username, action, case_id, details, ip_address or "127.0.0.1"))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[!] Audit log error: {e}")

def create_alert(case_id: str, severity: str, title: str, message: str, entity_address: Optional[str] = None, entity_name: Optional[str] = None):
    """Inserts a high/critical forensic alert."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO alerts (case_id, severity, title, message, entity_address, entity_name)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (case_id, severity, title, message, entity_address, entity_name))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[!] Create alert error: {e}")
