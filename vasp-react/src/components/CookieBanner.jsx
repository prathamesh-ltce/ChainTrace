import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'

export default function CookieBanner() {
 const { setCurrentView } = useApp()
 const [visible, setVisible] = useState(false)

 useEffect(() => {
  const consent = localStorage.getItem('chaintrace_cookie_consent')
  if (!consent) {
   const timer = setTimeout(() => setVisible(true), 1200)
   return () => clearTimeout(timer)
  }
 }, [])

 const accept = () => {
  localStorage.setItem('chaintrace_cookie_consent', 'accepted')
  setVisible(false)
 }

 if (!visible) return null

 return (
  <div
   style={{
    position: 'fixed',
    bottom: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'calc(100% - 40px)',
    maxWidth: 780,
    background: '#0f172a',
    
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-lg)',
    padding: '16px 20px',
    boxShadow: '0 20px 40px -10px rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    zIndex: 9999,
    animation: 'slideUp 0.3s ease-out'
   }}
  >
   <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
     <svg viewBox="0 0 24 24" fill="none" stroke="var(--indigo-light)" strokeWidth="2" style={{ width: 20, height: 20 }}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
     </svg>
    </div>
    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
     <strong style={{ color: 'var(--text-primary)' }}>Data Governance & Security Notice:</strong>{' '}
     We utilize encrypted local session storage strictly for forensic authentication and chain-of-custody audit compliance. No third-party profiling cookies are active.
    </div>
   </div>
   <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
    <button
     className="btn btn-ghost btn-sm"
     onClick={() => { setVisible(false); setCurrentView('privacy') }}
     style={{ fontSize: '0.74rem' }}
    >
     Privacy Policy
    </button>
    <button
     className="btn btn-primary btn-sm"
     onClick={accept}
     style={{ fontSize: '0.74rem', padding: '6px 14px' }}
    >
     Acknowledge & Continue
    </button>
   </div>
  </div>
 )
}
