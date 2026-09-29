import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
REPORTS_DIR = BASE_DIR / "reports"
DATA_DIR = BASE_DIR / "analyzer" / "data"
VASP_CSV_PATH = DATA_DIR / "vasp_addresses.csv"
DB_PATH = BASE_DIR / "sih_forensics.db"

# Ensure directories exist
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Security & JWT
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "sih-vasp-forensic-secret-key-2026-secure-token")
JWT_ALGORITHM = "HS256"
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# CORS
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "*"
]

# Engine Defaults
DEFAULT_MAX_HOPS = 15
MAX_CONCURRENT_TRACES = 3
RPC_TIMEOUT_SECONDS = 30
