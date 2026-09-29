import asyncio
from fastapi import APIRouter, HTTPException, Depends
from api.schemas import BatchTraceRequest, TraceRequest
from api.services.queue import batch_manager
from api.services.trace_service import trace_manager
from api.routes.auth import get_current_user, UserProfile

router = APIRouter(prefix="/batch", tags=["Batch Tracing"])

async def process_batch_worker(batch_id: str, addresses: list, blockchain: str, max_hops: int, username: str):
    from api.database import get_db_connection
    import json
    
    results = []
    for addr in addresses:
        try:
            req = TraceRequest(
                suspect_address=addr,
                blockchain=blockchain,
                max_hops=max_hops
            )
            c_id = trace_manager.start_trace(req, username=username)
            results.append({"address": addr, "case_id": c_id, "status": "queued"})
        except Exception as e:
            results.append({"address": addr, "error": str(e), "status": "failed"})

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE batch_jobs 
    SET status = 'running', completed_count = ?, results_json = ?
    WHERE batch_id = ?
    """, (len(results), json.dumps(results), batch_id))
    conn.commit()
    conn.close()

@router.post("")
async def submit_batch(req: BatchTraceRequest, current_user: UserProfile = Depends(get_current_user)):
    addrs = [a.strip() for a in req.addresses if a.strip()]
    if not addrs:
        raise HTTPException(status_code=400, detail="At least one wallet address is required")

    batch_id = batch_manager.create_batch(
        addresses=addrs,
        blockchain=req.blockchain or "Auto",
        max_hops=req.max_hops or 10,
        username=current_user.username
    )

    asyncio.create_task(process_batch_worker(
        batch_id=batch_id,
        addresses=addrs,
        blockchain=req.blockchain or "Auto",
        max_hops=req.max_hops or 10,
        username=current_user.username
    ))

    return {
        "batch_id": batch_id,
        "total_queued": len(addrs),
        "status": "queued",
        "message": f"Successfully queued {len(addrs)} suspect wallets for batch processing."
    }

@router.get("")
def list_batches(limit: int = 20):
    return {"batches": batch_manager.list_batches(limit=limit)}

@router.get("/{batch_id}")
def get_batch(batch_id: str):
    res = batch_manager.get_batch(batch_id)
    if not res:
        raise HTTPException(status_code=404, detail="Batch job not found")
    return res
