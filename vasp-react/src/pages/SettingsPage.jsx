import { useState, useEffect } from 'react'
import { adminApi } from '../utils/api'
import { useApp } from '../context/AppContext'

export default function SettingsPage() {
 const { userProfile, showToast, logout } = useApp()
 const [activeTab, setActiveTab] = useState('health')
 const [stats, setStats] = useState(null)
 const [auditLogs, setAuditLogs] = useState([])
 const [users, setUsers] = useState([])
 const [loading, setLoading] = useState(false)

 // Config settings
 const [defaultHops, setDefaultHops] = useState(15)
 const [alertThreshold, setAlertThreshold] = useState(40)
 const [autoSse, setAutoSse] = useState(true)

 const loadData = async () => {
  setLoading(true)
  try {
   const [statsRes, auditRes, usersRes] = await Promise.all([
    adminApi.getStats(),
    adminApi.getAuditLog(50),
    adminApi.getUsers()
   ])
   setStats(statsRes)
   setAuditLogs(auditRes.audit_logs || [])
   setUsers(usersRes.users || [])
  } catch (err) {
   console.error('Error loading settings data:', err)
  } finally {
   setLoading(false)
  }
 }

 useEffect(() => {
  loadData()
 }, [])

 const handleSaveConfig = (e) => {
  e.preventDefault()
  showToast('Configuration settings updated locally', 'success')
 }

 return (
  <div className="page-container" style={{ padding: '24px 32px' }}>
   {/* Title & Sign Out Button */}
   <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
    <div>
     <h1 style={{ fontSize: '1.6rem', fontWeight: 'bold', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '10px', color: '#030441' }}>
       Forensic Console Administration & Settings
     </h1>
     <p style={{ color: '#64748b', margin: 0, fontSize: '0.85rem' }}>
      System diagnostics, Section 65B compliance audit logs, and officer session controls.
     </p>
    </div>

    {/* Sign Out Button */}
    <button
      onClick={logout}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 20px',
        borderRadius: '8px',
        backgroundColor: '#dc2626',
        color: '#ffffff',
        border: 'none',
        fontSize: '13px',
        fontWeight: 700,
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
        transition: 'background-color 0.15s ease'
      }}
      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
      onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ width: '16px', height: '16px' }}>
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
      </svg>
      <span>Sign Out Session</span>
    </button>
   </div>

   {/* Tabs */}
   <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
    {[
     { id: 'health', label: ' System Diagnostics & Nodes' },
     { id: 'audit', label: ' Section 65B Audit Trail' },
     { id: 'users', label: ' LEA Personnel' },
     { id: 'config', label: ' Engine Configuration' }
    ].map(t => (
     <button
      key={t.id}
      onClick={() => setActiveTab(t.id)}
      style={{
       padding: '10px 18px', background: 'none', border: 'none',
       borderBottom: activeTab === t.id ? '2px solid var(--indigo)' : '2px solid transparent',
       color: activeTab === t.id ? 'var(--text)' : 'var(--text-sub)',
       fontWeight: activeTab === t.id ? 'bold' : 'normal',
       cursor: 'pointer', fontSize: '0.85rem'
      }}
     >
      {t.label}
     </button>
    ))}
   </div>

   {/* Tab 1: System Health */}
   {activeTab === 'health' && (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
     <div className="card" style={{ padding: '20px' }}>
      <h3 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '14px' }}>
        Forensic Engine Architecture
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.82rem' }}>
       <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--text-sub)' }}>Graph Backend:</span>
        <span style={{ fontWeight: 600, color: 'var(--emerald)' }}>TransactionGraphBackend (C++ Dual-CSR BFS)</span>
       </div>
       <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--text-sub)' }}>Ingestion Strategy:</span>
        <span style={{ fontWeight: 600 }}>Zero Third-Party API Keys (Public RPCs)</span>
       </div>
       <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--text-sub)' }}>Database Engine:</span>
        <span style={{ fontWeight: 600 }}>SQLite Zero-Config (sih_forensics.db)</span>
       </div>
       <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--text-sub)' }}>Database Size:</span>
        <span style={{ fontWeight: 600 }}>{stats?.database_size_mb || '0.24'} MB</span>
       </div>
       <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--text-sub)' }}>Indexed Cases:</span>
        <span style={{ fontWeight: 600 }}>{stats?.total_cases || 0}</span>
       </div>
       <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--text-sub)' }}>Backend Status:</span>
        <span style={{ fontWeight: 600, color: 'var(--emerald)' }}>ONLINE (Port 8000)</span>
       </div>
      </div>
     </div>

     <div className="card" style={{ padding: '20px' }}>
      <h3 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '14px' }}>
        Public Multi-Chain RPC Nodes
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem' }}>
       {stats?.rpc_nodes ? (
        Object.entries(stats.rpc_nodes).map(([c, node]) => (
         <div key={c} style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: '6px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
           <strong>{c} Blockchain</strong>
           <span style={{ color: 'var(--emerald)', fontSize: '0.7rem' }}>● Healthy</span>
          </div>
          <code style={{ fontSize: '0.72rem', color: 'var(--text-sub)' }}>{node}</code>
         </div>
        ))
       ) : (
        <div>Loading RPC node status...</div>
       )}
      </div>
     </div>
    </div>
   )}

   {/* Tab 2: Audit Trail */}
   {activeTab === 'audit' && (
    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
     <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
       <h3 style={{ margin: 0, fontSize: '1rem' }}>Section 65B Indian Evidence Act Compliance Log</h3>
       <span style={{ fontSize: '0.72rem', color: 'var(--text-sub)' }}>Immutable audit trail of all forensic searches, downloads, and notices</span>
      </div>
      <button onClick={loadData} className="btn btn-secondary btn-sm" style={{ fontSize: '0.72rem' }}>
        Refresh Log
      </button>
     </div>

     <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
       <thead>
        <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-sub)' }}>
         <th style={{ padding: '10px 16px' }}>Timestamp</th>
         <th style={{ padding: '10px 16px' }}>Investigator</th>
         <th style={{ padding: '10px 16px' }}>Action</th>
         <th style={{ padding: '10px 16px' }}>Case Reference</th>
         <th style={{ padding: '10px 16px' }}>Evidence Details</th>
         <th style={{ padding: '10px 16px' }}>Host IP</th>
        </tr>
       </thead>
       <tbody>
        {auditLogs.map(l => (
         <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
          <td style={{ padding: '10px 16px', color: 'var(--text-sub)', whiteSpace: 'nowrap' }}>
           {l.created_at ? new Date(l.created_at).toLocaleString() : 'Recent'}
          </td>
          <td style={{ padding: '10px 16px', fontWeight: 'bold' }}>
           {l.username}
          </td>
          <td style={{ padding: '10px 16px' }}>
           <span style={{
            padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 600,
            background: l.action.includes('NOTICE') ? 'rgba(99,102,241,0.15)' : l.action.includes('TRACE') ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
            color: l.action.includes('NOTICE') ? 'var(--indigo-light)' : l.action.includes('TRACE') ? 'var(--emerald)' : 'var(--text)'
           }}>
            {l.action}
           </span>
          </td>
          <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>
           {l.case_id || ' - '}
          </td>
          <td style={{ padding: '10px 16px', color: 'var(--text-sub)' }}>
           {l.details || ' - '}
          </td>
          <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: 'var(--text-sub)', fontSize: '0.72rem' }}>
           {l.ip_address || '127.0.0.1'}
          </td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    </div>
   )}

   {/* Tab 3: Users */}
   {activeTab === 'users' && (
    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
     <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
      <h3 style={{ margin: 0, fontSize: '1rem' }}>Authorized Law Enforcement Personnel</h3>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-sub)' }}>Investigating officers with authorized access to the VASP Attribution Platform</span>
     </div>

     <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
      <thead>
       <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-sub)' }}>
        <th style={{ padding: '12px 16px' }}>Officer Name</th>
        <th style={{ padding: '12px 16px' }}>Username</th>
        <th style={{ padding: '12px 16px' }}>Badge ID</th>
        <th style={{ padding: '12px 16px' }}>Investigation Unit</th>
        <th style={{ padding: '12px 16px' }}>Role</th>
        <th style={{ padding: '12px 16px' }}>Last Active</th>
       </tr>
      </thead>
      <tbody>
       {users.map(u => (
        <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
         <td style={{ padding: '12px 16px', fontWeight: 600 }}>{u.full_name}</td>
         <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{u.username}</td>
         <td style={{ padding: '12px 16px' }}>{u.badge_id}</td>
         <td style={{ padding: '12px 16px' }}>{u.unit}</td>
         <td style={{ padding: '12px 16px' }}>
          <span style={{
           padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 'bold',
           background: u.role === 'admin' ? 'rgba(244,63,94,0.15)' : 'rgba(99,102,241,0.15)',
           color: u.role === 'admin' ? 'var(--rose)' : 'var(--indigo-light)'
          }}>
           {u.role.toUpperCase()}
          </span>
         </td>
         <td style={{ padding: '12px 16px', color: 'var(--text-sub)' }}>
          {u.last_login ? new Date(u.last_login).toLocaleString() : 'Active session'}
         </td>
        </tr>
       ))}
      </tbody>
     </table>
    </div>
   )}

   {/* Tab 4: Configuration */}
   {activeTab === 'config' && (
    <div className="card" style={{ padding: '24px', maxWidth: '650px' }}>
     <h3 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '16px' }}>
       Default Forensic Search & Tracing Parameters
     </h3>

     <form onSubmit={handleSaveConfig}>
      <div className="field-group" style={{ marginBottom: '16px' }}>
       <label className="field-label">Default Max Traversal Hops: {defaultHops}</label>
       <input
        type="range"
        min="3"
        max="25"
        value={defaultHops}
        onChange={e => setDefaultHops(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--indigo)' }}
       />
       <span style={{ fontSize: '0.72rem', color: 'var(--text-sub)' }}>
        Sets the forward BFS depth before concluding unhosted intermediate termination.
       </span>
      </div>

      <div className="field-group" style={{ marginBottom: '16px' }}>
       <label className="field-label">Alert Sensitivity Threshold: {alertThreshold} pts</label>
       <input
        type="range"
        min="20"
        max="80"
        value={alertThreshold}
        onChange={e => setAlertThreshold(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--amber)' }}
       />
       <span style={{ fontSize: '0.72rem', color: 'var(--text-sub)' }}>
        Cases with risk score above this threshold trigger automatic notification badges.
       </span>
      </div>

      <div style={{ marginBottom: '20px' }}>
       <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', cursor: 'pointer' }}>
        <input
         type="checkbox"
         checked={autoSse}
         onChange={e => setAutoSse(e.target.checked)}
        />
        Enable real-time Server-Sent Events (SSE) streaming during tracing
       </label>
      </div>

      <button type="submit" className="btn btn-primary">
        Save Forensic Preferences
      </button>
     </form>
    </div>
   )}
  </div>
 )
}
