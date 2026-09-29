import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from api.database import get_db_connection, log_audit

class BatchQueueManager:
    def __init__(self):
        self.running_batches: Dict[str, asyncio.Task] = {}

    def create_batch(self, addresses: List[str], blockchain: str, max_hops: int, username: str) -> str:
        batch_id = f"BATCH-{uuid.uuid4().hex[:8].upper()}"
        clean_addrs = [a.strip() for a in addresses if a.strip()]
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO batch_jobs (batch_id, status, total_count, completed_count, addresses_json, results_json, created_by)
        VALUES (?, 'queued', ?, 0, ?, '[]', ?)
        """, (batch_id, len(clean_addrs), json.dumps(clean_addrs), username))
        conn.commit()
        conn.close()

        log_audit(username, "BATCH_TRACE_SUBMITTED", case_id=batch_id, details=f"Queued {len(clean_addrs)} wallets")
        return batch_id

    def get_batch(self, batch_id: str) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM batch_jobs WHERE batch_id = ?", (batch_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        res = dict(row)
        try:
            res["addresses"] = json.loads(res.get("addresses_json") or "[]")
            res["results"] = json.loads(res.get("results_json") or "[]")
        except Exception:
            res["addresses"] = []
            res["results"] = []
        return res

    def list_batches(self, limit: int = 20) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM batch_jobs ORDER BY created_at DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        conn.close()
        out = []
        for r in rows:
            d = dict(r)
            try:
                d["addresses"] = json.loads(d.get("addresses_json") or "[]")
                d["results"] = json.loads(d.get("results_json") or "[]")
            except Exception:
                d["addresses"] = []
                d["results"] = []
            out.append(d)
        return out

batch_manager = BatchQueueManager()
