import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { reportsApi } from '../utils/api'
import { downloadFirPdf, downloadJsonReport } from '../utils/firReportGenerator'
import { exportLedgerCsv, exportVaspsCsv, exportExecutiveSummary } from '../utils/exportHelpers'

export default function ReportsPage() {
 const { savedReports, setCurrentReport, setCurrentView, showToast, saveReport } = useApp()
 const [serverReports, setServerReports] = useState([])
 const [loading, setLoading] = useState(false)
 const [uploading, setUploading] = useState(false)

 const fetchServerReports = async () => {
  setLoading(true)
  try {
   const res = await reportsApi.getReports(50)
   setServerReports(res.reports || [])
  } catch (err) {
   console.warn('Could not fetch server reports:', err.message)
  } finally {
   setLoading(false)
  }
 }

 useEffect(() => {
  fetchServerReports()
 }, [])

 const handleLoadFile = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  setUploading(true)
  try {
   // 1. Upload to server
   const srvRes = await reportsApi.uploadReport(file)
   // 2. Read locally
   const text = await file.text()
   const data = JSON.parse(text)
   saveReport(data)
   setCurrentReport(data)
   setCurrentView('trace')
   showToast(`Report ${data.case_id} uploaded and loaded!`, 'success')
   fetchServerReports()
  } catch (err) {
   showToast(err.message || 'Failed to upload report', 'error')
  } finally {
   setUploading(false)
   e.target.value = ''
  }
 }

 const openReport = async (item) => {
  try {
   // If item is a summary row from server without full ledger
   if (!item.chain_of_custody_ledger && item.case_id) {
    showToast('Loading full case investigation...', 'info')
    const full = await reportsApi.getReport(item.case_id)
    setCurrentReport(full)
    saveReport(full)
   } else {
    setCurrentReport(item)
   }
   setCurrentView('trace')
  } catch (err) {
   showToast('Error opening report: ' + err.message, 'error')
  }
 }

 const handleDelete = async (caseId, e) => {
  e.stopPropagation()
  if (!window.confirm(`Are you sure you want to delete case ${caseId}?`)) return
  try {
   await reportsApi.deleteReport(caseId)
   showToast(`Case ${caseId} deleted`, 'info')
   setServerReports(prev => prev.filter(r => r.case_id !== caseId))
  } catch (err) {
   showToast('Failed to delete report: ' + err.message, 'error')
  }
 }

 // Merge unique reports between server and local
 const combined = [...serverReports]
 savedReports.forEach(localR => {
  if (!combined.some(c => c.case_id === localR.case_id)) {
   combined.unshift(localR)
  }
 })

 return (
  <div className="page-container" style={{ padding: '24px 32px' }}>
   <div className="panel">
    <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
     <div>
      <div className="panel-title" style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>
        Forensic Case Reports Library
      </div>
      <div className="panel-sub" style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>
       Historical multi-hop investigation records indexed in SQLite with court-admissible chain of custody
      </div>
     </div>
     <div style={{ display: 'flex', gap: '10px' }}>
      <button onClick={fetchServerReports} className="btn btn-secondary btn-sm" style={{ fontSize: '0.78rem' }}>
        Refresh
      </button>
      <input type="file" id="report-upload" accept=".json" style={{ display: 'none' }} onChange={handleLoadFile} />
      <button
       className="btn btn-primary btn-sm"
       disabled={uploading}
       onClick={() => document.getElementById('report-upload').click()}
       style={{ fontSize: '0.78rem' }}
      >
       {uploading ? 'Uploading...' : ' Upload JSON Report'}
      </button>
     </div>
    </div>

    {loading && combined.length === 0 ? (
     <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-sub)' }}>
      <span className="spinner" /> Loading saved forensic reports...
     </div>
    ) : combined.length === 0 ? (
     <div className="empty-state" style={{ padding: '50px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}></div>
      <p style={{ margin: 0, fontWeight: 600 }}>No investigation reports found.</p>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>Run a wallet trace or upload an existing case JSON file.</span>
     </div>
    ) : (
     <div className="panel-body">
      <div className="reports-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
       {combined.map((r, i) => {
        const rScore = r.risk_assessment?.composite_score ?? r.risk_assessment?.risk_score ?? r.risk_score ?? 0
        const rLevel = r.risk_assessment?.risk_level || r.risk_level || 'LOW'
        const suspect = r.suspect_address || r.suspect_wallet || 'Unknown'
        const chain = r.blockchain || r.coin || 'BTC'
        const hopsCount = r.hops_traced || r.max_hops_traced || (r.chain_of_custody_ledger || []).length
        const vaspCount = r.vasp_targets_count ?? (r.vasp_targets || []).length

        return (
         <div
          key={r.case_id || i}
          className="report-card"
          onClick={() => openReport(r)}
          style={{
           background: 'var(--card-bg, #0f172a)',
           border: '1px solid var(--border, #334155)',
           borderRadius: '10px',
           padding: '16px',
           cursor: 'pointer',
           transition: 'transform 0.15s, border-color 0.15s',
           position: 'relative'
          }}
         >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
           <span style={{ fontWeight: 'bold', fontSize: '0.85rem', fontFamily: 'monospace', color: '#ffffff', fontWeight: 800 }}>
            {r.case_id}
           </span>
           <span className={`risk-pill ${rLevel}`} style={{ fontSize: '0.65rem' }}>
            {rLevel} ({rScore})
           </span>
          </div>

          <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text)', wordBreak: 'break-all', marginBottom: '10px' }}>
           {suspect}
          </div>

          <div style={{ display: 'flex', gap: '8px', fontSize: '0.72rem', color: 'var(--text-sub)', marginBottom: '12px' }}>
           <span style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', fontWeight: 600 }}>
            {chain}
           </span>
           <span>{hopsCount} Hops Traced</span>
           {vaspCount > 0 && (
            <span style={{ color: 'var(--emerald)', fontWeight: 600 }}>
              {vaspCount} VASP(s)
            </span>
           )}
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '10px' }} onClick={e => e.stopPropagation()}>
           <button
            className="btn btn-primary btn-sm"
            style={{ padding: '3px 8px', fontSize: '0.68rem', background: '#059669', border: 'none' }}
            onClick={() => downloadFirPdf(r)}
            title="Download FIR Evidence PDF"
           >
             FIR PDF
           </button>
           <button
            className="btn btn-secondary btn-sm"
            style={{ padding: '3px 8px', fontSize: '0.68rem' }}
            onClick={() => exportExecutiveSummary(r)}
            title="1-Page Briefing"
           >
             Brief
           </button>
           <button
            className="btn btn-secondary btn-sm"
            style={{ padding: '3px 8px', fontSize: '0.68rem' }}
            onClick={() => downloadJsonReport(r)}
            title="Download JSON"
           >
             JSON
           </button>
           <button
            className="btn btn-ghost btn-sm"
            style={{ padding: '3px 8px', fontSize: '0.68rem', color: 'var(--rose)', marginLeft: 'auto' }}
            onClick={(e) => handleDelete(r.case_id, e)}
            title="Delete Case"
           >
            
           </button>
          </div>
         </div>
        )
       })}
      </div>
     </div>
    )}
   </div>
  </div>
 )
}
