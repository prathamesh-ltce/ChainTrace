import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.config import CORS_ORIGINS
from api.database import init_db
from api.routes import auth, trace, reports, vasp, alerts, batch, admin, sahyog

app = FastAPI(
    title="SIH VASP Attribution & Forensic Engine API",
    description="High-Performance Multi-Hop Blockchain Forensic Platform for Indian Law Enforcement Agencies (LEAs). Zero Third-Party API Keys.",
    version="2.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local dev convenience
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Timing & Logging Middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = f"{process_time:.4f}s"
        return response
    except Exception as e:
        process_time = time.time() - start_time
        return JSONResponse(
            status_code=500,
            content={"detail": str(e), "error": "Internal Forensic Server Error"}
        )

# Startup hook to initialize DB tables & sync
@app.on_event("startup")
def on_startup():
    print("[*] Initializing Forensic SQLite Database & VASP Registry...")
    init_db()
    print("[+] Database Initialized & Synced.")

# Include sub-routers with /api prefix
app.include_router(auth.router, prefix="/api")
app.include_router(trace.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(vasp.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
app.include_router(batch.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(sahyog.router, prefix="/api")

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "SIH VASP Forensic Engine API",
        "timestamp": time.time(),
        "graph_backend": "TransactionGraphBackend (C++ CSR Graph + Microsecond BFS)",
        "api_version": "2.0.0"
    }

@app.get("/")
def root():
    return {
        "platform": "SIH VASP Attribution Engine",
        "version": "2.0.0",
        "docs_url": "/docs",
        "health_check": "/api/health"
    }
