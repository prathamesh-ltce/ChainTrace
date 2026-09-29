from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from api.database import get_db_connection, log_audit
from api.schemas import VaspCreateRequest
from api.routes.auth import get_current_user, UserProfile

router = APIRouter(prefix="/vasp", tags=["VASP Registry"])

@router.get("/registry")
def get_vasp_registry(
    search: Optional[str] = None,
    chain: Optional[str] = None,
    vasp_type: Optional[str] = None,
    country: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM vasp_registry WHERE 1=1"
    params = []

    if search:
        s = f"%{search.strip().lower()}%"
        query += " AND (LOWER(vasp_name) LIKE ? OR LOWER(address) LIKE ?)"
        params.extend([s, s])

    if chain and chain.upper() != "ALL":
        query += " AND UPPER(chain) = ?"
        params.append(chain.upper())

    if vasp_type and vasp_type.lower() != "all":
        query += " AND LOWER(vasp_type) = ?"
        params.append(vasp_type.lower())

    if country and country.lower() != "all":
        query += " AND LOWER(country) = ?"
        params.append(country.lower())

    # Count
    count_query = query.replace("SELECT *", "SELECT COUNT(*) as total")
    cursor.execute(count_query, params)
    total = cursor.fetchone()["total"]

    # Paged results
    query += " ORDER BY vasp_name ASC, created_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return {
        "total": total,
        "vasps": [dict(r) for r in rows]
    }

@router.get("/lookup/{address}")
def lookup_vasp(address: str):
    clean_addr = address.strip()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM vasp_registry WHERE LOWER(address) = LOWER(?)", (clean_addr,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return {
            "found": False,
            "address": clean_addr,
            "profile": "[UNHOSTED / INTERMEDIARY WALLET]",
            "vasp_name": None,
            "verified": False
        }

    d = dict(row)
    return {
        "found": True,
        "address": clean_addr,
        "profile": f"[VERIFIED VASP: {d['vasp_name'].upper()} ({d['country']} - {d['vasp_type'].upper()})]",
        "vasp_name": d["vasp_name"],
        "vasp_type": d["vasp_type"],
        "country": d["country"],
        "risk_level": d["risk_level"],
        "chain": d["chain"],
        "compliance_email": d["compliance_email"],
        "verified": bool(d["verified"]),
        "source": d["source"]
    }

@router.post("/add")
def add_vasp(req: VaspCreateRequest, current_user: UserProfile = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        INSERT OR REPLACE INTO vasp_registry 
            (address, vasp_name, vasp_type, country, risk_level, chain, compliance_email, verified, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'MANUAL_ENTRY')
        """, (
            req.address.strip(),
            req.vasp_name.strip(),
            req.vasp_type or "exchange",
            req.country or "India",
            req.risk_level or "low",
            (req.chain or "ETH").upper(),
            req.compliance_email or ""
        ))
        conn.commit()
    finally:
        conn.close()

    log_audit(current_user.username, "VASP_ADDED", details=f"Added {req.vasp_name} ({req.address})")
    return {"status": "success", "message": f"VASP '{req.vasp_name}' registered successfully"}

@router.get("/stats")
def get_vasp_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) as total FROM vasp_registry")
    total = cursor.fetchone()["total"]

    cursor.execute("SELECT chain, COUNT(*) as cnt FROM vasp_registry GROUP BY chain")
    by_chain = {r["chain"]: r["cnt"] for r in cursor.fetchall()}

    cursor.execute("SELECT country, COUNT(*) as cnt FROM vasp_registry GROUP BY country")
    by_country = {r["country"]: r["cnt"] for r in cursor.fetchall()}

    cursor.execute("SELECT vasp_type, COUNT(*) as cnt FROM vasp_registry GROUP BY vasp_type")
    by_type = {r["vasp_type"]: r["cnt"] for r in cursor.fetchall()}

    conn.close()
    return {
        "total_vasps": total,
        "by_chain": by_chain,
        "by_country": by_country,
        "by_type": by_type
    }
