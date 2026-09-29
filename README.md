# ChainTrace — Automated Multi-Hop Blockchain Forensics & VASP Attribution Engine

> **Zero Third-Party API Key Forensic Intelligence for Law Enforcement Agencies (LEAs)**  
> Developed for National Cyber Crime Reporting Portal (NCRP) & Indian LEAs under Bharatiya Nagarik Suraksha Sanhita (BNSS) 2023 / Section 91 CrPC.

---

## 🚀 Repository Structure

`
├── SIH/                  # Python FastAPI Backend & Forensic Engine
│   ├── analyzer/         # Multi-hop Graph Tracer & Risk Engine
│   │   ├── chains/       # EVM, BTC, Solana fetchers (Zero-API RPCs)
│   │   ├── risk_engine.py# FIU-IND & FATF Typology Engine
│   │   └── pdf_generator.py # Court-admissible FIR PDF Generator (ReportLab)
│   ├── api/              # FastAPI Routers & SQLite Models
│   ├── requirements.txt  # Python Dependencies
│   └── sih_forensics.db  # Local SQLite Forensic Database
├── vasp-react/           # Production React Frontend (Vite + Tailwind/Custom CSS)
│   ├── src/              # Dashboard, Trace Graph, Reports, VASP Registry
│   ├── vercel.json       # SPA Rewrite configuration for Vercel
│   └── package.json      # Node.js dependencies
└── run_project.bat       # One-click Windows dev runner
`

---

## 🌐 Cloud Deployment Guide

### 1. Backend Deployment (Render.com)
1. Go to [Render.com](https://render.com) and click **New +** -> **Web Service**.
2. Connect this GitHub repository: https://github.com/prathamesh-ltce/ChainTrace.git.
3. Configure the service settings:
   - **Root Directory**: SIH
   - **Environment**: Python 3
   - **Build Command**: pip install -r requirements.txt
   - **Start Command**: uvicorn api.main:app --host 0.0.0.0 --port 
4. Click **Create Web Service**. Once deployed, copy your service URL (e.g. https://chaintrace-api.onrender.com).

### 2. Frontend Deployment (Vercel)
1. Go to [Vercel.com](https://vercel.com) and click **Add New...** -> **Project**.
2. Import this GitHub repository.
3. Configure project settings:
   - **Root Directory**: asp-react
   - **Framework Preset**: Vite
   - **Environment Variables**:
     - Key: VITE_API_URL
     - Value: https://<YOUR-RENDER-BACKEND-URL>/api (e.g. https://chaintrace-api.onrender.com/api)
4. Click **Deploy**.

---

## 💻 Local Development Setup

### Backend:
`ash
cd SIH
python -m venv .venv
# Windows:
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000
`

### Frontend:
`ash
cd vasp-react
npm install
npm run dev
`

Platform will be running at http://localhost:5173.
