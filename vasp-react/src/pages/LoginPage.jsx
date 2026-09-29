import { useState } from 'react'
import { useApp } from '../context/AppContext'

export default function LoginPage() {
 const { login } = useApp()
 const [username, setUsername] = useState('admin')
 const [password, setPassword] = useState('sih2026')
 const [loading, setLoading] = useState(false)
 const [error, setError] = useState('')

 const handleSubmit = async (e) => {
  e.preventDefault()
  if (!username.trim() || !password.trim()) {
   setError('Please enter both username and password.')
   return
  }
  setLoading(true)
  setError('')
  try {
   await login(username.trim(), password)
  } catch (err) {
   setError(err.message || 'Authentication failed. Please verify credentials.')
  } finally {
   setLoading(false)
  }
 }

 const fillQuick = (u, p) => {
  setUsername(u)
  setPassword(p)
 }

 return (
  <div className="login-page">
   <div className="login-bg">
    <div className="login-bg-dots" />
   </div>
   <div className="login-container">
    <div className="login-left">
     <div className="login-left-logo">
      <div style={{
       width: 44, height: 44, borderRadius: 10,
       background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
       display: 'flex', alignItems: 'center', justifyContent: 'center',
       fontWeight: 'bold', fontSize: '1.2rem', color: '#fff',
       boxShadow: '0 4px 15px rgba(99,102,241,0.35)'
      }}>
       
      </div>
      <div>
       <div className="login-brand">SIH VASP Attribution Engine</div>
       <div className="login-brand-sub">Government Law Enforcement Platform</div>
      </div>
     </div>
     <h2>Trace <em>Suspected</em><br/>Wallets</h2>
     <p>Multi-hop forward fund flow traversal. High-precision Virtual Asset Service Provider (VASP) attribution. Statutory Section 91 CrPC / Section 94 BNSS Notice generation without third-party API keys.</p>
     <div className="login-tags">
      <span className="login-tag">Multi-Chain Zero-Key</span>
      <span className="login-tag">FIU-IND Red Flags</span>
      <span className="login-tag">FATF Typologies</span>
      <span className="login-tag">C++ Dual-CSR Engine</span>
      <span className="login-tag">SAHYOG Portal Ready</span>
      <span className="login-tag">Court Evidence Admissible</span>
     </div>
    </div>
    <div className="login-right">
     <h3>Law Enforcement Sign In</h3>
     <p>Access your Investigation Dashboard. Authorized LEA personnel only.</p>
     <form className="login-form" onSubmit={handleSubmit}>
      <div className="field-group">
       <label className="field-label">Username / Investigator ID</label>
       <input
        type="text"
        placeholder="Enter officer username"
        value={username}
        onChange={e => setUsername(e.target.value)}
        autoComplete="username"
       />
      </div>
      <div className="field-group">
       <label className="field-label">Password</label>
       <input
        type="password"
        placeholder="Enter password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        autoComplete="current-password"
       />
      </div>
      {error && (
       <div style={{ color: 'var(--rose)', fontSize: '0.75rem', padding: '8px 12px', background: 'hsla(349,90%,62%,0.08)', borderRadius: 'var(--r-sm)', border: '1px solid hsla(349,90%,62%,0.2)' }}>
        {error}
       </div>
      )}
      <button
       type="submit"
       className="btn btn-primary btn-lg w-full"
       disabled={loading}
       style={{ justifyContent: 'center', marginTop: '4px' }}
      >
       {loading ? (
        <>
         <span className="spinner" style={{ borderTopColor: 'white' }} />
         Authenticating...
        </>
       ) : (
        <>
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/>
         </svg>
         Sign In to Forensic Console
        </>
       )}
      </button>

      <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
       <div style={{ fontSize: '0.72rem', color: 'var(--text-sub)', marginBottom: '8px' }}>
        Quick Demo Credentials:
       </div>
       <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
         type="button"
         onClick={() => fillQuick('admin', 'sih2026')}
         className="btn btn-secondary btn-sm"
         style={{ fontSize: '0.72rem', padding: '4px 8px' }}
        >
         Admin (admin / sih2026)
        </button>
        <button
         type="button"
         onClick={() => fillQuick('officer_sharma', 'sih2026')}
         className="btn btn-secondary btn-sm"
         style={{ fontSize: '0.72rem', padding: '4px 8px' }}
        >
         Officer Sharma
        </button>
       </div>
      </div>
     </form>
     <div className="login-footer">
      All investigative actions are logged under Section 65B Indian Evidence Act.<br/>
      <span>MHA SAHYOG Gateway | FIU-IND Reporting Standard</span>
     </div>
    </div>
   </div>
  </div>
 )
}
