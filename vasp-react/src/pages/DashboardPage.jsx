import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { adminApi, reportsApi } from '../utils/api'

const QUICK_ACTIONS = [
 { id: 'trace', title: 'Trace Suspect Wallet', icon: 'map', color: 'blue' },
 { id: 'batch', title: 'Batch Multi-Case Queue', icon: 'layers', color: 'green' },
 { id: 'vasp', title: 'VASP Directory & Attribution', icon: 'building', color: 'amber' },
 { id: 'reports', title: 'Investigation Case Reports', icon: 'file', color: 'blue' },
]

const ICONS = {
 map: (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
   <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
  </svg>
 ),
 layers: (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
   <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
  </svg>
 ),
 building: (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
   <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
 ),
 file: (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
   <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
 ),
 shield: (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
   <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
 ),
 globe: (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
   <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
 ),
 activity: (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
   <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
 )
}

export default function DashboardPage() {
 const { currentUser, userProfile, setCurrentView, setCurrentReport } = useApp()
 const [stats, setStats] = useState(null)
 const [recentCases, setRecentCases] = useState([])
 const [loading, setLoading] = useState(false)

 useEffect(() => {
  async function loadDashboardData() {
   setLoading(true)
   try {
    const [statsData, reportsData] = await Promise.all([
     adminApi.getStats(),
     reportsApi.getReports(6)
    ])
    setStats(statsData)
    setRecentCases(reportsData.reports || [])
   } catch (err) {
    console.warn('Dashboard fetch notice:', err.message)
   } finally {
    setLoading(false)
   }
  }
  loadDashboardData()
 }, [])

 const openReport = async (r) => {
  try {
   const full = await reportsApi.getReport(r.case_id)
   setCurrentReport(full)
   setCurrentView('trace')
  } catch (_) {
   setCurrentReport(r)
   setCurrentView('trace')
  }
 }

 return (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
   {/* Welcome Heading */}
   <div>
    <h1 className="welcome-heading" style={{ margin: '0 0 4px 0', fontSize: '1.6rem', fontWeight: 800 }}>
     Welcome, <span style={{ color: '#ffffff', fontWeight: 800 }}>{userProfile?.full_name || currentUser || 'Senior Cyber Investigator'}</span>
    </h1>
    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
     {userProfile?.unit || 'Cyber Crime Cell, Delhi Police'} • Badge: {userProfile?.badge_id || 'LEA-DL-9842'}
    </div>
   </div>

      {/* Centered Number of Cases Hero Display */}
   <div
    style={{
     background: 'var(--bg-panel)',
     border: '1px solid var(--border-subtle)',
     borderRadius: 'var(--r-lg)',
     padding: '26px 20px',
     display: 'flex',
     alignItems: 'center',
     justifyContent: 'center',
     textAlign: 'center',
     width: '100%'
    }}
   >
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, justifyContent: 'center' }}>
     <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#ffffff', lineHeight: 1 }}>
      {stats?.total_cases ?? recentCases.length}
     </span>
     <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}>
      Number of Cases
     </span>
    </div>
   </div>

   {/* 4 Action Buttons in 2 Clean Lines spanning 100% full width (No sub-text slop) */}
   <div>
    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10, letterSpacing: '-0.01em' }}>
     Operational Forensics Actions
    </div>

    <div style={{
     display: 'grid',
     gridTemplateColumns: '1fr 1fr',
     gap: 12,
     width: '100%'
    }}>
     {QUICK_ACTIONS.map(a => (
      <button
       key={a.id}
       onClick={() => setCurrentView(a.id)}
       style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-lg)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.2s ease',
        width: '100%'
       }}
       onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--border-hover, #475569)'
        e.currentTarget.style.background = 'var(--bg-card)'
        e.currentTarget.style.transform = 'translateY(-1px)'
       }}
       onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-subtle)'
        e.currentTarget.style.background = 'var(--bg-panel)'
        e.currentTarget.style.transform = 'translateY(0)'
       }}
      >
       <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
         className={`action-card-icon ${a.color}`}
         style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--r-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
         }}
        >
         {ICONS[a.icon]}
        </div>
        <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
         {a.title}
        </span>
       </div>
       <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem', transition: 'transform 0.2s ease' }}>
        →
       </span>
      </button>
     ))}
    </div>
   </div>

   {/* Recent Investigations Table */}
   <div className="panel" style={{ width: '100%' }}>
    <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px' }}>
     <div>
      <div className="panel-title" style={{ fontSize: '0.92rem', fontWeight: 800 }}>Recent Case Investigations</div>
      <div className="panel-sub" style={{ fontSize: '0.74rem' }}>
       {stats?.total_cases || recentCases.length} cases indexed in forensic database
      </div>
     </div>
     {recentCases.length > 0 && (
      <button className="btn btn-ghost btn-sm" onClick={() => setCurrentView('reports')} style={{ fontSize: '0.74rem' }}>
       View All Reports →
      </button>
     )}
    </div>

    {recentCases.length === 0 ? (
     <div className="empty-state" style={{ padding: '36px 20px', textAlign: 'center' }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 40, height: 40, opacity: 0.35, marginBottom: 10 }}>
       <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
       No investigations yet. Click <strong>Trace Suspect Wallet</strong> above to begin your first analysis.
      </p>
     </div>
    ) : (
     <div className="panel-body" style={{ padding: 0 }}>
      <div className="table-wrap">
       <table className="data-table">
        <thead>
         <tr>
          <th>Case Reference</th>
          <th>Suspect Wallet</th>
          <th>Chain</th>
          <th>Risk Level</th>
          <th>Terminal Targets</th>
          <th></th>
         </tr>
        </thead>
        <tbody>
         {recentCases.slice(0, 6).map((r, i) => (
          <tr key={i}>
           <td><span className="mono" style={{ color: '#ffffff', fontWeight: 800, letterSpacing: '0.02em' }}>{r.case_id}</span></td>
           <td><span className="addr">{r.suspect_address}</span></td>
           <td><span className="mono">{r.blockchain}</span></td>
           <td><span className={"risk-pill " + (r.risk_level || 'LOW')}>{r.risk_level || 'LOW'} ({r.risk_score || 0})</span></td>
           <td>{r.vasp_targets_count ? `${r.vasp_targets_count} VASP(s)` : '-'}</td>
           <td>
            <button className="btn btn-ghost btn-sm" onClick={() => openReport(r)}>
             Open Case
            </button>
           </td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>
     </div>
    )}
   </div>
  </div>
 )
}
