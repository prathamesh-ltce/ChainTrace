import React from 'react'
import { useApp } from '../context/AppContext'

export default function PrivacyPolicyPage() {
 const { setCurrentView } = useApp()

 return (
  <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, padding: '10px 0 40px' }}>
   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div>
     <button
      onClick={() => setCurrentView('dashboard')}
      className="btn btn-ghost btn-sm"
      style={{ marginBottom: 12, paddingLeft: 0, color: 'var(--indigo-light)' }}
     >
      ← Back to Dashboard
     </button>
     <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>Privacy & Data Governance Policy</h1>
     <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 4 }}>
      Compliance with Digital Personal Data Protection Act (DPDP Act 2023) & Information Technology Act 2000.
     </p>
    </div>
    <span className="risk-pill LOW" style={{ fontSize: '0.72rem' }}>OFFICIAL LEA USE</span>
   </div>

   <div className="panel" style={{ padding: 24, lineHeight: 1.7, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
    <h3 style={{ color: 'var(--text-primary)', marginTop: 0 }}>1. Scope and Lawful Basis</h3>
    <p>
     ChainTrace Forensics operates strictly as an investigatory intelligence tool for authorized Law Enforcement Agencies (LEAs), Financial Intelligence Units (FIU-IND), and statutory regulatory bodies. All blockchain ingestion activities are conducted under lawful statutory powers pursuant to Section 91 CrPC / Section 94 BNSS 2023.
    </p>

    <h3 style={{ color: 'var(--text-primary)' }}>2. Public Ledger Ingestion</h3>
    <p>
     Our decentralized node pool accesses only public, immutable blockchain ledgers (Bitcoin, Ethereum, Tron, BNB Chain, Polygon, Solana). The platform does not collect, decrypt, or intercept private cryptographic keys or confidential communications.
    </p>

    <h3 style={{ color: 'var(--text-primary)' }}>3. Auditor Accountability & Chain of Custody</h3>
    <p>
     Every wallet search, export, and generated dossier is immutably timestamped with the investigating officer's badge ID, IP address, and authorization warrant reference to guarantee Section 65B Indian Evidence Act admissibility in court proceedings.
    </p>

    <h3 style={{ color: 'var(--text-primary)' }}>4. Zero Third-Party Tracker Architecture</h3>
    <p>
     The ChainTrace frontend does not utilize commercial advertising cookies, cross-site trackers, or third-party behavioral profiling scripts. Session tokens are strictly stored in local volatile storage and invalidated upon session termination.
    </p>

    <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 12 }}>
     <button className="btn btn-primary btn-sm" onClick={() => setCurrentView('dashboard')}>
      Acknowledge & Return to Console
     </button>
     <button className="btn btn-secondary btn-sm" onClick={() => setCurrentView('terms')}>
      View Terms & Conditions
     </button>
    </div>
   </div>
  </div>
 )
}
