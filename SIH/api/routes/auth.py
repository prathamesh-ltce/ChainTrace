import time
import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from api.config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_ACCESS_TOKEN_EXPIRE_MINUTES
from api.database import get_db_connection, verify_password, hash_password, log_audit
from api.schemas import LoginRequest, LoginResponse, UserProfile, UserRegisterRequest

router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer(auto_error=False)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> UserProfile:
    if not credentials:
        # Default anonymous fallback for open demo mode if token omitted
        return UserProfile(
            id=1,
            username="investigator",
            full_name="Investigating Officer",
            badge_id="LEA-GOV-2026",
            unit="Cyber Crime Investigation Cell",
            role="investigator"
        )
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, full_name, badge_id, unit, role FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    conn.close()

    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return UserProfile(
        id=row["id"],
        username=row["username"],
        full_name=row["full_name"],
        badge_id=row["badge_id"],
        unit=row["unit"],
        role=row["role"]
    )

@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest, request: Request):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (req.username.strip(),))
    user = cursor.fetchone()
    
    # If user doesn't exist yet but it's first run admin or any user login
    if not user:
        if req.username.strip() in ("admin", "officer", "investigator"):
            # Auto-create user for frictionless setup
            pwd_hash = hash_password(req.password)
            cursor.execute("""
            INSERT INTO users (username, password_hash, full_name, badge_id, unit, role)
            VALUES (?, ?, ?, 'LEA-DL-001', 'Cyber Crime Cell', ?)
            """, (req.username.strip(), pwd_hash, f"Officer {req.username.capitalize()}", "admin" if req.username=="admin" else "investigator"))
            conn.commit()
            cursor.execute("SELECT * FROM users WHERE username = ?", (req.username.strip(),))
            user = cursor.fetchone()
        else:
            conn.close()
            log_audit(req.username, "LOGIN_FAILED", details="Username not found", ip_address=request.client.host if request.client else None)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    if not verify_password(req.password, user["password_hash"]):
        conn.close()
        log_audit(req.username, "LOGIN_FAILED", details="Incorrect password", ip_address=request.client.host if request.client else None)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    # Update last login
    cursor.execute("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", (user["id"],))
    conn.commit()
    conn.close()

    token = create_access_token(data={"sub": user["username"], "role": user["role"]})
    log_audit(user["username"], "LOGIN_SUCCESS", details=f"Role: {user['role']}", ip_address=request.client.host if request.client else None)

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserProfile(
            id=user["id"],
            username=user["username"],
            full_name=user["full_name"],
            badge_id=user["badge_id"],
            unit=user["unit"],
            role=user["role"]
        )
    )

@router.get("/me", response_model=UserProfile)
def get_me(current_user: UserProfile = Depends(get_current_user)):
    return current_user

@router.post("/register")
def register(req: UserRegisterRequest, current_user: UserProfile = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE username = ?", (req.username.strip(),))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Username already exists")

    cursor.execute("""
    INSERT INTO users (username, password_hash, full_name, badge_id, unit, role)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (
        req.username.strip(),
        hash_password(req.password),
        req.full_name,
        req.badge_id,
        req.unit,
        req.role or "investigator"
    ))
    conn.commit()
    conn.close()

    log_audit(current_user.username, "USER_REGISTERED", details=f"New user: {req.username} ({req.role})")
    return {"status": "success", "message": f"User {req.username} registered successfully"}

@router.post("/logout")
def logout(current_user: UserProfile = Depends(get_current_user)):
    log_audit(current_user.username, "LOGOUT")
    return {"status": "success", "message": "Logged out successfully"}
