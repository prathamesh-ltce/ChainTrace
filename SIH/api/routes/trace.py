import asyncio
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse

from api.schemas import TraceRequest, TraceResponse
from api.services.trace_service import trace_manager
from api.routes.auth import get_current_user, UserProfile

router = APIRouter(prefix="/trace", tags=["Tracing"])

@router.post("", response_model=TraceResponse)
async def start_wallet_trace(req: TraceRequest, current_user: UserProfile = Depends(get_current_user)):
    addr = req.suspect_address.strip()
    if not addr:
        raise HTTPException(status_code=400, detail="Suspect wallet address is mandatory")

    case_id = trace_manager.start_trace(req, username=current_user.username)
    return TraceResponse(
        case_id=case_id,
        status="tracing",
        message="Multi-hop attribution trace initiated successfully."
    )

@router.get("/{case_id}/status")
def get_trace_status(case_id: str):
    job = trace_manager.get_job(case_id)
    if not job:
        raise HTTPException(status_code=404, detail="Case not found")
    return {
        "case_id": case_id,
        "status": job.get("status"),
        "progress": job.get("progress", 0),
        "current_step": job.get("current_step", ""),
        "hops_found": job.get("hops_found", 0),
        "vasps_found": job.get("vasps_found", 0),
        "error": job.get("error")
    }

@router.get("/{case_id}/result")
def get_trace_result(case_id: str):
    job = trace_manager.get_job(case_id)
    if not job:
        raise HTTPException(status_code=404, detail="Case not found")
    
    result = job.get("result")
    if not result:
        if job.get("status") == "tracing":
            raise HTTPException(status_code=202, detail="Trace is still running")
        elif job.get("status") == "error":
            raise HTTPException(status_code=500, detail=job.get("error", "Trace failed"))
        else:
            raise HTTPException(status_code=404, detail="Trace result not available")
    return result

@router.post("/{case_id}/cancel")
def cancel_trace(case_id: str, current_user: UserProfile = Depends(get_current_user)):
    trace_manager.cancel_job(case_id)
    return {"status": "success", "message": f"Case {case_id} cancelled"}

@router.get("/{case_id}/stream")
async def stream_trace_progress(case_id: str, request: Request):
    """
    Server-Sent Events (SSE) endpoint for real-time trace progress streaming.
    Yields events: progress, hop_found, vasp_detected, complete, error.
    """
    queue = trace_manager.get_subscriber_queue(case_id)

    async def event_generator():
        try:
            # Yield initial status
            job = trace_manager.get_job(case_id)
            if job:
                yield f"event: progress\ndata: {{\"percent\": {job.get('progress', 10)}, \"message\": \"{job.get('current_step', 'Tracing...')}\"}}\n\n"
                if job.get("status") == "complete" and job.get("result"):
                    yield f"event: complete\ndata: {{\"case_id\": \"{case_id}\"}}\n\n"
                    return

            while True:
                # Check client disconnect
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=1.0)
                    yield msg
                    if "event: complete" in msg or "event: error" in msg:
                        break
                except asyncio.TimeoutError:
                    # Keep-alive heartbeat
                    yield ": ping\n\n"
        finally:
            trace_manager.remove_subscriber_queue(case_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
