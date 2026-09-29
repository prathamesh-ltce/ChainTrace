import json
from fastapi import APIRouter, HTTPException, Depends
from api.schemas import SahyogNoticeRequest
from api.services.sahyog import generate_sahyog_notice
from api.database import get_db_connection, log_audit
from api.routes.auth import get_current_user, UserProfile

router = APIRouter(prefix="/sahyog", tags=["SAHYOG Portal"])

@router.post("/notice")
def create_sahyog_notice(req: SahyogNoticeRequest, current_user: UserProfile = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT report_json FROM cases WHERE case_id = ?", (req.case_id,))
    row = cursor.fetchone()
    conn.close()

    report_data = None
    if row and row["report_json"]:
        try:
            report_data = json.loads(row["report_json"])
        except Exception:
            pass

    notice = generate_sahyog_notice(
        case_id=req.case_id,
        officer_name=req.officer_name,
        officer_badge=req.officer_badge,
        police_station=req.police_station,
        fir_number=req.fir_number,
        vasp_name=req.vasp_name,
        vasp_address=req.vasp_address,
        compliance_email=req.compliance_email,
        statutory_section=req.statutory_section or "Section 91 CrPC / Section 94 BNSS 2023",
        report_data=report_data,
        specific_requests=req.specific_requests
    )

    log_audit(
        current_user.username,
        "NOTICE_GENERATED",
        case_id=req.case_id,
        details=f"SAHYOG Notice generated for {req.vasp_name} ({req.vasp_address})"
    )

    return notice
