import { useState, useEffect } from 'react'
import { alertsApi } from '../utils/api'
import { useApp } from '../context/AppContext'

export default function AlertsDrawer() {
 const { showAlertsDrawer, setShowAlertsDrawer, refreshAlerts } = useApp()
 const [alerts, setAlerts] = useState([])
 const [loading, setLoading] = useState(false)
 const [filter, setFilter] = useState('ALL')

 const fetchAlerts = async () => {
  setLoading(true)
  try {
   const res = await alertsApi.getAlerts(filter === 'ALL' ? null : filter)
   setAlerts(res.alerts || [])
  } catch (err) {
   console.error('Failed to load alerts:', err)
  } finally {
   setLoading(false)
  }
 }

 useEffect(() => {
  if (showAlertsDrawer) {
   fetchAlerts()
  }
 }, [showAlertsDrawer, filter])

 const handleMarkRead = async (alertId) => {
  try {
   await alertsApi.markRead(alertId)
   setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_read: 1 } : a))
   refreshAlerts()
  } catch (_) {}
 }

 if (!showAlertsDrawer) return null

 return (
  <div style={{
   position: 'fixed', inset: 0, zIndex: 9999,
   display: 'flex', justifyContent: 'flex-end',
   background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)'
  }}>
   <div 
    onClick={() => setShowAlertsDrawer(false)}
    style={{ flex: 1 }}
   />
   <div style={{
    width: '440px', maxWidth: '90vw', height: '100%',
    background: 'var(--card-bg, #0f172a)',
    borderLeft: '1px solid var(--border, #334155)',
    display: 'flex', flexDirection: 'column',
    boxShadow: '-8px 0 30px rgba(0,0,0,0.5)',
    animation: 'slideInRight 0.25s ease-out'
   }}>
    {/* Header */}
    <div style={{
     padding: '16px 20px', borderBottom: '1px solid var(--border)',
     display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    }}>
     <div>
      <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
        Forensic Alerts & Triggers
      </h3>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-sub)' }}>
       Automated AML/CFT Red Flags & Threat Intelligence
      </span>
     </div>
     <button 
      onClick={() => setShowAlertsDrawer(false)}
      style={{
       background: 'none', border: 'none', color: 'var(--text-sub)',
       fontSize: '1.2rem', cursor: 'pointer', padding: '4px'
      }}
     >
      
     </button>
    </div>

    {/* Filter Pills */}
    <div style={{ padding: '10px 20px', display: 'flex', gap: '6px', borderBottom: '1px solid var(--border)' }}>
     {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'INFO'].map(sev => (
      <button
       key={sev}
       onClick={() => setFilter(sev)}
       className={`btn btn-sm ${filter === sev ? 'btn-primary' : 'btn-secondary'}`}
       style={{ fontSize: '0.7rem', padding: '3px 8px' }}
      >
       {sev}
      </button>
     ))}
    </div>

    {/* Alerts List */}
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
     {loading ? (
      <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-sub)' }}>
       <span className="spinner" /> Loading threat alerts...
      </div>
     ) : alerts.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-sub)' }}>
       <div style={{ fontSize: '2rem', marginBottom: '8px' }}></div>
       <p style={{ margin: 0 }}>No active alerts for this filter.</p>
       <span style={{ fontSize: '0.72rem' }}>Threat triggers will appear automatically during investigation traces.</span>
      </div>
     ) : (
      alerts.map(a => {
       const isCrit = a.severity === 'CRITICAL'
       const isHigh = a.severity === 'HIGH'
       const isMed = a.severity === 'MEDIUM'
       const bg = isCrit ? 'hsla(349,90%,62%,0.08)' : isHigh ? 'hsla(32,95%,50%,0.08)' : isMed ? 'hsla(45,95%,50%,0.08)' : 'hsla(217,91%,60%,0.08)'
       const border = isCrit ? 'var(--rose)' : isHigh ? 'var(--amber)' : isMed ? '#eab308' : 'var(--indigo)'

       return (
        <div key={a.id} style={{
         background: bg,
         border: `1px solid ${border}`,
         borderRadius: 'var(--r-md, 8px)',
         padding: '12px 14px',
         marginBottom: '10px',
         opacity: a.is_read ? 0.65 : 1,
         transition: 'all 0.2s'
        }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <span style={{
           fontWeight: 'bold', fontSize: '0.7rem', textTransform: 'uppercase',
           color: border, padding: '2px 6px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px'
          }}>
           {a.severity}
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-sub)' }}>
           {a.created_at ? new Date(a.created_at).toLocaleTimeString() : 'Recent'}
          </span>
         </div>
         <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
          {a.title}
         </div>
         <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', lineHeight: 1.4, marginBottom: '8px' }}>
          {a.message}
         </div>
         {a.entity_address && (
          <div style={{ fontSize: '0.68rem', fontFamily: 'monospace', color: 'var(--text)', background: 'rgba(0,0,0,0.25)', padding: '3px 6px', borderRadius: '4px', wordBreak: 'break-all', marginBottom: '6px' }}>
           Entity: {a.entity_address}
          </div>
         )}
         {!a.is_read && (
          <div style={{ textAlign: 'right' }}>
           <button
            onClick={() => handleMarkRead(a.id)}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.68rem', padding: '2px 8px' }}
           >
             Mark as Read
           </button>
          </div>
         )}
        </div>
       )
      })
     )}
    </div>
   </div>
  </div>
 )
}
