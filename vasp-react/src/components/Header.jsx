import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { downloadFirPdf, downloadJsonReport } from '../utils/firReportGenerator'
import { exportLedgerCsv, exportVaspsCsv, exportExecutiveSummary } from '../utils/exportHelpers'

const PAGE_TITLES = {
 dashboard: ['Dashboard', 'Welcome back - your investigation hub'],
 trace: ['Wallet Trace & Fund Flow Analysis', 'Multi-hop blockchain tracing with real-time VASP attribution'],
 batch: ['Batch Multi-Case Queue', 'High-throughput case queueing for mass investigation triage'],
 reports: ['Case Reports Library', 'Load and inspect previously generated investigation reports'],
 graph: ['Fund Flow Graph Visualization', 'Interactive network graph showing fund movement across wallets'],
 vasp: ['VASP Registry & Attribution Directory', 'Known centralized exchanges, custodial wallets, and relayers'],
 intel: ['Threat Intelligence Registry', 'FIU-IND / FATF compliant typology database with statutory AML/CFT classification'],
 settings: ['Console Administration & Audit Log', 'System health, Section 65B compliance logs, and LEA personnel'],
}

export default function Header() {
 const {
  currentView, currentReport, currentUser, userProfile,
  setSidebarCollapsed, showToast
 } = useApp()

 const [title] = PAGE_TITLES[currentView] || ['Forensic Console', '']
 const [showExportMenu, setShowExportMenu] = useState(false)

 const handleExportFirPdf = () => {
  setShowExportMenu(false)
  if (!currentReport) {
   showToast('Please run or select an investigation trace first', 'warn')
   return
  }
  const ok = downloadFirPdf(currentReport, userProfile?.full_name || currentUser || 'Cyber Crime Officer')
  if (ok) showToast('Generated court-admissible FIR evidence PDF', 'success')
 }

 const handleExportExecSummary = () => {
  setShowExportMenu(false)
  if (!currentReport) {
   showToast('Please run or select an investigation trace first', 'warn')
   return
  }
  exportExecutiveSummary(currentReport)
  showToast('Executive summary document opened for printing', 'success')
 }

 const handleExportJson = () => {
  setShowExportMenu(false)
  if (!currentReport) {
   showToast('No active report to export', 'warn')
   return
  }
  downloadJsonReport(currentReport)
  showToast('Raw Case JSON exported', 'success')
 }

 const handleExportLedgerCsv = () => {
  setShowExportMenu(false)
  if (!currentReport) {
   showToast('No active report to export', 'warn')
   return
  }
  exportLedgerCsv(currentReport)
  showToast('Chain-of-custody ledger exported as CSV', 'success')
 }

 const handleExportVaspsCsv = () => {
  setShowExportMenu(false)
  if (!currentReport) {
   showToast('No active report to export', 'warn')
   return
  }
  exportVaspsCsv(currentReport)
  showToast('Target VASPs exported as CSV', 'success')
 }

 return (
  <header className="top-header">
   <button
    className="btn-icon"
    onClick={() => setSidebarCollapsed(v => !v)}
    title="Toggle sidebar"
    style={{ display: 'flex' }}
   >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
     <path d="M3 12h18M3 6h18M3 18h18"/>
    </svg>
   </button>

   <div className="header-breadcrumb">
    <h1>{title}</h1>
   </div>

   <div className="header-actions">
    {/* Agent Profile & Role */}
    <div className="header-stat">
     <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span className="stat-val" style={{ background: 'var(--grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
       {currentUser || 'Investigator'}
      </span>
      <span style={{
       fontSize: '0.62rem', padding: '1px 5px', borderRadius: '4px',
       background: userProfile?.role === 'admin' ? 'rgba(244,63,94,0.15)' : 'rgba(99,102,241,0.15)',
       color: userProfile?.role === 'admin' ? 'var(--rose)' : 'var(--indigo-light)',
       fontWeight: 'bold', textTransform: 'uppercase'
      }}>
       {userProfile?.role || 'INVESTIGATOR'}
      </span>
     </div>
     <span className="stat-lbl">{userProfile?.badge_id || 'LEA-DL-001'}</span>
    </div>

    {/* Export Dropdown Menu */}
    <div style={{ position: 'relative' }}>
     <button
      className="btn btn-primary btn-sm"
      onClick={() => setShowExportMenu(v => !v)}
      style={{
       padding: '6px 12px',
       fontSize: '0.72rem',
       fontWeight: 700,
       background: 'linear-gradient(135deg, #059669, #0284c7)',
       border: 'none',
       boxShadow: '0 2px 8px rgba(5, 150, 105, 0.35)',
       display: 'flex',
       alignItems: 'center',
       gap: 6
      }}
     >
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
       <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
       <polyline points="7 10 12 15 17 10"/>
       <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span>Export Evidence ▾</span>
     </button>

     {showExportMenu && (
      <div style={{
       position: 'absolute', right: 0, top: '100%', marginTop: '6px',
       background: 'var(--card-bg, #0f172a)', border: '1px solid var(--border, #334155)',
       borderRadius: '8px', padding: '6px', width: '230px', zIndex: 1000,
       boxShadow: '0 10px 25px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '4px'
      }}>
       <button onClick={handleExportFirPdf} className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.75rem' }}>
         FIR Evidence PDF (Court)
       </button>
       <button onClick={handleExportExecSummary} className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.75rem' }}>
         1-Page Executive Brief
       </button>
       <button onClick={handleExportLedgerCsv} className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.75rem' }}>
         Chain-of-Custody Ledger (CSV)
       </button>
       <button onClick={handleExportVaspsCsv} className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.75rem' }}>
         Target VASPs & Contacts (CSV)
       </button>
       <button onClick={handleExportJson} className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.75rem' }}>
         Raw Forensic Case (JSON)
       </button>
      </div>
     )}
    </div>
   </div>
  </header>
 )
}
