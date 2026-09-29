from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from api.services.alerts import get_alerts, mark_alert_read, get_unread_alerts_count
from api.routes.auth import get_current_user, UserProfile

router = APIRouter(prefix="/alerts", tags=["Alerts"])

@router.get("")
def list_alerts(severity: Optional[str] = None, limit: int = 50):
    alerts = get_alerts(limit=limit, severity=severity)
    unread = get_unread_alerts_count()
    return {
        "unread_count": unread,
        "total": len(alerts),
        "alerts": alerts
    }

@router.post("/{alert_id}/read")
def read_alert(alert_id: int):
    mark_alert_read(alert_id)
    return {"status": "success", "alert_id": alert_id}

@router.get("/unread-count")
def unread_count():
    return {"unread_count": get_unread_alerts_count()}
