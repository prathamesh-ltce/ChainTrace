from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class TraceRequest(BaseModel):
    suspect_address: str = Field(..., description="Target cryptocurrency wallet address")
    blockchain: Optional[str] = Field("Auto", description="Coin type (BTC, ETH, TRON, SOL, or Auto)")
    max_hops: Optional[int] = Field(15, ge=1, le=50, description="Maximum traversal depth")
    date_range: Optional[str] = Field(None, description="Date filter (YYYY-MM-DD or range)")
    tx_hash: Optional[str] = Field(None, description="Specific TxHash to trace from")
    amount: Optional[float] = Field(None, description="Specific crime amount to filter")

class TraceResponse(BaseModel):
    case_id: str
    status: str
    message: str

class LoginRequest(BaseModel):
    username: str
    password: str

class UserProfile(BaseModel):
    id: int
    username: str
    full_name: Optional[str]
    badge_id: Optional[str]
    unit: Optional[str]
    role: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfile

class UserRegisterRequest(BaseModel):
    username: str
    password: str
    full_name: str
    badge_id: str
    unit: str
    role: Optional[str] = "investigator"

class VaspCreateRequest(BaseModel):
    address: str
    vasp_name: str
    vasp_type: Optional[str] = "exchange"
    country: Optional[str] = "India"
    risk_level: Optional[str] = "low"
    chain: Optional[str] = "ETH"
    compliance_email: Optional[str] = ""

class SahyogNoticeRequest(BaseModel):
    case_id: str
    officer_name: str
    officer_badge: str
    police_station: str
    fir_number: str
    fir_date: Optional[str] = None
    vasp_name: str
    vasp_address: str
    compliance_email: Optional[str] = None
    statutory_section: Optional[str] = "Section 91 CrPC / Section 94 BNSS 2023"
    specific_requests: Optional[List[str]] = None

class BatchTraceRequest(BaseModel):
    addresses: List[str]
    blockchain: Optional[str] = "Auto"
    max_hops: Optional[int] = 10
