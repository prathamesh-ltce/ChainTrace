import json
import os
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import JSONResponse, FileResponse, Response

from api.config import REPORTS_DIR
from api.database import get_db_connection, log_audit
from api.routes.auth import get_current_user, UserProfile

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("")
def list_reports(limit: int = 50, offset: int = 0):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT case_id, suspect_address, blockchain, risk_score, risk_level, 
           max_hops_traced, vasp_targets_count, status, duration_seconds, 
           created_at, completed_at
    FROM cases
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
    """, (limit, offset))
    rows = cursor.fetchall()
    
    cursor.execute("SELECT COUNT(*) as total FROM cases")
    total = cursor.fetchone()["total"]
    conn.close()

    return {
        "total": total,
        "reports": [dict(r) for r in rows]
    }

@router.get("/{case_id}")
def get_report(case_id: str, current_user: UserProfile = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT report_json FROM cases WHERE case_id = ?", (case_id,))
    row = cursor.fetchone()
    conn.close()

    if not row or not row["report_json"]:
        # Fallback to filesystem
        report_file = REPORTS_DIR / f"{case_id}.json"
        if report_file.exists():
            try:
                with open(report_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                log_audit(current_user.username, "REPORT_VIEWED", case_id=case_id)
                return data
            except Exception:
                pass
        raise HTTPException(status_code=404, detail="Report not found")

    log_audit(current_user.username, "REPORT_VIEWED", case_id=case_id)
    return json.loads(row["report_json"])


@router.get("/{case_id}/pdf")
def download_case_pdf(case_id: str, officer: Optional[str] = "Cyber Crime Investigator"):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT report_json FROM cases WHERE case_id = ?", (case_id,))
    row = cursor.fetchone()
    conn.close()

    report_data = None
    if row and row["report_json"]:
        try:
            report_data = json.loads(row["report_json"])
        except Exception:
            pass

    if not report_data:
        report_file = REPORTS_DIR / f"{case_id}.json"
        if report_file.exists():
            try:
                with open(report_file, "r", encoding="utf-8") as f:
                    report_data = json.load(f)
            except Exception:
                pass

    if not report_data:
        raise HTTPException(status_code=404, detail="Report data not found for PDF export")

    from analyzer.pdf_generator import generate_fir_pdf
    pdf_bytes = generate_fir_pdf(report_data, officer_name=officer)
    filename = f"FIR_EVIDENCE_{case_id}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )

@router.post("/pdf")
async def generate_pdf_from_body(payload: dict):
    report_data = payload.get("report") or payload
    officer = payload.get("officer_name") or "Cyber Crime Investigator"
    case_id = report_data.get("case_id") or f"VASP-{Path(report_data.get('suspect_address', 'CASE')).name[:8]}"

    from analyzer.pdf_generator import generate_fir_pdf
    pdf_bytes = generate_fir_pdf(report_data, officer_name=officer)
    filename = f"FIR_EVIDENCE_{case_id}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )

@router.post("/upload")
async def upload_report(file: UploadFile = File(...), current_user: UserProfile = Depends(get_current_user)):
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Only JSON report files are supported")

    content = await file.read()
    try:
        data = json.loads(content.decode("utf-8"))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON format: {e}")

    case_id = data.get("case_id") or f"UPLOAD-{Path(file.filename).stem}"
    data["case_id"] = case_id
    
    # Save to disk
    report_file = REPORTS_DIR / f"{case_id}.json"
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    # Save to DB
    risk = data.get("risk_assessment", {})
    r_score = risk.get("composite_score", risk.get("risk_score", 0))
    r_level = risk.get("risk_level", "LOW")
    suspect = data.get("suspect_wallet") or data.get("suspect_address") or "Uploaded Address"
    chain = data.get("coin") or data.get("blockchain") or "Crypto"
    hops = len(data.get("chain_of_custody_ledger") or [])
    vasp_cnt = len(data.get("vasp_targets") or [])
    duration = data.get("duration_seconds", 0.0)

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT OR REPLACE INTO cases 
        (case_id, suspect_address, blockchain, risk_score, risk_level, max_hops_traced, vasp_targets_count, status, duration_seconds, report_json, created_by, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'complete', ?, ?, ?, CURRENT_TIMESTAMP)
    """, (case_id, suspect, chain, r_score, r_level, hops, vasp_cnt, duration, json.dumps(data, ensure_ascii=False), current_user.username))
    conn.commit()
    conn.close()

    log_audit(current_user.username, "REPORT_UPLOADED", case_id=case_id, details=f"File: {file.filename}")
    return {"status": "success", "case_id": case_id, "message": "Report uploaded and indexed successfully"}

@router.delete("/{case_id}")
def delete_report(case_id: str, current_user: UserProfile = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM cases WHERE case_id = ?", (case_id,))
    cursor.execute("DELETE FROM trace_logs WHERE case_id = ?", (case_id,))
    cursor.execute("DELETE FROM vasp_discoveries WHERE case_id = ?", (case_id,))
    cursor.execute("DELETE FROM alerts WHERE case_id = ?", (case_id,))
    conn.commit()
    conn.close()

    report_file = REPORTS_DIR / f"{case_id}.json"
    if report_file.exists():
        try:
            os.remove(report_file)
        except Exception:
            pass

    log_audit(current_user.username, "REPORT_DELETED", case_id=case_id)
    return {"status": "success", "message": f"Report {case_id} deleted"}

@router.get("/{case_id}/json")
def download_json_report(case_id: str, current_user: UserProfile = Depends(get_current_user)):
    report_file = REPORTS_DIR / f"{case_id}.json"
    if not report_file.exists():
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT report_json FROM cases WHERE case_id = ?", (case_id,))
        row = cursor.fetchone()
        conn.close()
        if row and row["report_json"]:
            log_audit(current_user.username, "REPORT_DOWNLOADED", case_id=case_id, details="JSON")
            return JSONResponse(content=json.loads(row["report_json"]), headers={"Content-Disposition": f"attachment; filename={case_id}.json"})
        raise HTTPException(status_code=404, detail="Report file not found")

    log_audit(current_user.username, "REPORT_DOWNLOADED", case_id=case_id, details="JSON")
    return FileResponse(
        path=str(report_file),
        filename=f"{case_id}.json",
        media_type="application/json"
    )
