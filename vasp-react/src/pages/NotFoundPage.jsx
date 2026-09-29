import React from 'react'
import { useApp } from '../context/AppContext'

export default function NotFoundPage() {
 const { setCurrentView } = useApp()

 return (
  <div style={{
   display: 'flex',
   flexDirection: 'column',
   alignItems: 'center',
   justifyContent: 'center',
   minHeight: '65vh',
   textAlign: 'center',
   padding: '40px 20px'
  }}>
   <div style={{
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20
   }}>
    <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" style={{ width: 40, height: 40 }}>
     <circle cx="12" cy="12" r="10" />
     <line x1="12" y1="8" x2="12" y2="12" />
     <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
   </div>

   <h1 style={{ fontSize: '2.5rem', fontWeight: 900, margin: '0 0 8px 0', letterSpacing: '-0.02em', color: '#ffffff' }}>
    404 - Forensic Dossier Not Found
   </h1>
   <p style={{ color: 'var(--text-secondary)', maxWidth: 480, fontSize: '0.95rem', margin: '0 0 24px 0', lineHeight: 1.6 }}>
    The requested forensic route or case entity does not exist or has been archived. Check the URL reference or return to the operational console.
   </p>

   <div style={{ display: 'flex', gap: 12 }}>
    <button
     className="btn btn-primary"
     onClick={() => setCurrentView('dashboard')}
     style={{ padding: '10px 20px', fontWeight: 700 }}
    >
     Return to Dashboard
    </button>
    <button
     className="btn btn-secondary"
     onClick={() => setCurrentView('trace')}
     style={{ padding: '10px 20px', fontWeight: 700 }}
    >
     Trace Suspect Wallet
    </button>
   </div>
  </div>
 )
}
