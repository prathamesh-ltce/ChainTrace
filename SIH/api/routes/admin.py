import os
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends
from api.database import get_db_connection, log_audit
from api.config import DB_PATH, REPORTS_DIR
from api.routes.auth import get_current_user, UserProfile

router = APIRouter(prefix="/admin", tags=["Admin & Audit"])

@router.get("/audit")
def get_audit_log(limit: int = 100, current_user: UserProfile = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT id, username, action, case_id, details, ip_address, created_at
    FROM audit_log
    ORDER BY id DESC
    LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    return {"audit_logs": [dict(r) for r in rows]}

@router.get("/stats")
def get_system_stats():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) as total_cases FROM cases")
    total_cases = cursor.fetchone()["total_cases"]

    cursor.execute("SELECT COUNT(*) as total_vasps FROM vasp_registry")
    total_vasps = cursor.fetchone()["total_vasps"]

    cursor.execute("SELECT COUNT(*) as total_alerts FROM alerts")
    total_alerts = cursor.fetchone()["total_alerts"]

    cursor.execute("SELECT COUNT(*) as total_users FROM users")
    total_users = cursor.fetchone()["total_users"]

    conn.close()

    db_size_bytes = DB_PATH.stat().st_size if DB_PATH.exists() else 0
    db_size_mb = round(db_size_bytes / (1024 * 1024), 2)

    return {
        "status": "online",
        "engine": "TransactionGraphBackend (C++ Dual-CSR Microsecond BFS) + Python Zero-Key Multi-Chain Fetcher",
        "total_cases": total_cases,
        "total_vasps_indexed": total_vasps,
        "total_alerts": total_alerts,
        "total_users": total_users,
        "database_size_mb": db_size_mb,
        "supported_chains": ["BTC", "ETH", "TRON", "BNB", "MATIC", "SOL"],
        "rpc_nodes": {
            "BTC": "blockstream.info / mempool.space (Public)",
            "ETH": "eth.merkle.io / ethereum-rpc.publicnode.com",
            "TRON": "api.trongrid.io",
            "SOL": "api.mainnet-beta.solana.com"
        }
    }

@router.get("/users")
def list_users(current_user: UserProfile = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, full_name, badge_id, unit, role, created_at, last_login FROM users")
    rows = cursor.fetchall()
    conn.close()
    return {"users": [dict(r) for r in rows]}
