import { useApp } from '../context/AppContext'

const NAV_ITEMS = [
 {
  id: 'dashboard',
  label: 'Dashboard',
  badge: null,
  icon: (
   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
   </svg>
  )
 },
 {
  id: 'trace',
  label: 'Trace Wallet',
  badge: 'LIVE',
  icon: (
   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
   </svg>
  )
 },
 {
  id: 'batch',
  label: 'Batch Tracing',
  badge: 'NEW',
  icon: (
   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
   </svg>
  )
 },
 {
  id: 'graph',
  label: 'Flow Graph',
  badge: null,
  icon: (
   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/>
   </svg>
  )
 },
 {
  id: 'reports',
  label: 'Case Reports',
  badge: null,
  icon: (
   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
   </svg>
  )
 },
 {
  id: 'vasp',
  label: 'VASP Registry',
  badge: null,
  icon: (
   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
   </svg>
  )
 },
 {
  id: 'intel',
  label: 'Threat Intel',
  badge: null,
  icon: (
   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
   </svg>
  )
 },
 {
  id: 'settings',
  label: 'Settings & Audit',
  badge: null,
  icon: (
   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
   </svg>
  )
 },
]

export default function Sidebar() {
 const { currentView, setCurrentView, sidebarCollapsed, setSidebarCollapsed, currentUser, logout } = useApp()

 return (
  <aside className={"sidebar" + (sidebarCollapsed ? " collapsed" : "")}>
   <div className="sidebar-logo">
    <div style={{
     width: 32, height: 32, borderRadius: 8,
     background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
     display: 'flex', alignItems: 'center', justifyContent: 'center',
     fontWeight: 'bold', fontSize: '1rem', color: '#fff', marginRight: 10
    }}>
     
    </div>
    <div className="logo-text">
     <span className="logo-name">ChainTrace</span>
     <span className="logo-sub">v2.0 Forensic</span>
    </div>
   </div>

   <nav className="sidebar-nav">
    <div className="nav-section">Navigation</div>
    {NAV_ITEMS.map(item => (
     <button
      key={item.id}
      className={"nav-item" + (currentView === item.id ? " active" : "")}
      onClick={() => setCurrentView(item.id)}
      title={sidebarCollapsed ? item.label : undefined}
     >
      {item.icon}
      <span className="nav-label">{item.label}</span>
      {item.badge && <span className={`nav-badge ${item.badge === 'LIVE' ? 'live' : ''}`}>{item.badge}</span>}
     </button>
    ))}

    <div className="nav-section" style={{ marginTop: 16 }}>Supported Chains</div>
    <div className="chain-pills">
     {['btc','eth','trx','bnb','matic','sol'].map(c => (
      <span key={c} className={"chain-pill " + c}>{c.toUpperCase()}</span>
     ))}
    </div>
   </nav>

   <div className="sidebar-footer">
    <div className="engine-status">
     <div className="status-dot" />
     <span>C++ CSR BFS Online</span>
    </div>
    <div className="fiu-badge">FIU-IND / FATF Compliant</div>
    {currentUser && (
     <button
      className="btn btn-ghost btn-sm"
      style={{ width: '100%', marginTop: 4, justifyContent: 'flex-start' }}
      onClick={logout}
     >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}>
       <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
      </svg>
      <span className="nav-label">Sign Out</span>
     </button>
    )}
   </div>

   <button
    className="sidebar-toggle-btn"
    onClick={() => setSidebarCollapsed(v => !v)}
    title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
   >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
     {sidebarCollapsed
      ? <path d="M9 18l6-6-6-6"/>
      : <path d="M15 18l-6-6 6-6"/>
     }
    </svg>
   </button>
  </aside>
 )
}
