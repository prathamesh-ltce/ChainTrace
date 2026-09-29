import React from 'react'
import { useApp } from '../context/AppContext'

export default function TermsPage() {
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
     <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>Terms of Service & Operational Protocols</h1>
     <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 4 }}>
      Statutory framework for forensic blockchain evidence acquisition and VASP notices.
     </p>
    </div>
    <span className="risk-pill HIGH" style={{ fontSize: '0.72rem' }}>RESTRICTED ACCESS</span>
   </div>

   <div className="panel" style={{ padding: 24, lineHeight: 1.7, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
    <h3 style={{ color: 'var(--text-primary)', marginTop: 0 }}>1. Authorized Personnel Only</h3>
    <p>
     Access to this platform is restricted to commissioned officers of Police Departments, CBI, ED, NIA, FIU-IND, and accredited cyber crime cells. Unauthorized access or misuse is punishable under Sections 43 and 66 of the Information Technology Act 2000.
    </p>

    <h3 style={{ color: 'var(--text-primary)' }}>2. Evidentiary Use & Section 91 CrPC / Section 94 BNSS</h3>
    <p>
     Notices generated via this system must only be served to designated Nodal Officers of registered Virtual Asset Service Providers (VASPs). The Attribution Certainty Confidence (ACC) score and Path Proximity (PAES) metric should be interpreted in conjunction with independent forensic verification.
    </p>

    <h3 style={{ color: 'var(--text-primary)' }}>3. Integrity of Audit Trails</h3>
    <p>
     All operations performed within this console are permanently recorded in the cryptographic audit log (sih_forensics.db). Tampering, altering, or circumventing audit logging is strictly prohibited and subject to departmental disciplinary proceedings.
    </p>

    <h3 style={{ color: 'var(--text-primary)' }}>4. Liability Disclaimer</h3>
    <p>
     Blockchain analytics reports reflect heuristic clustering and on-chain graph analysis at the exact block height inspected. Centralized exchanges reserve ultimate confirmation of customer identity (KYC) under statutory preservation requests.
    </p>

    <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 12 }}>
     <button className="btn btn-primary btn-sm" onClick={() => setCurrentView('dashboard')}>
      Accept Terms & Return
     </button>
     <button className="btn btn-secondary btn-sm" onClick={() => setCurrentView('privacy')}>
      Read Privacy Policy
     </button>
    </div>
   </div>
  </div>
 )
}
