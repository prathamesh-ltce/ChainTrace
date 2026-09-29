import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { downloadFirPdf, downloadJsonReport } from '../utils/firReportGenerator'
import { exportLedgerCsv, exportVaspsCsv, exportExecutiveSummary } from '../utils/exportHelpers'

export default function Header() {
  const {
    currentReport, currentUser, userProfile,
    sidebarCollapsed, setSidebarCollapsed, showToast
  } = useApp()

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
    showToast('Chain-of-Custody ledger exported as CSV', 'success')
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
    <header style={{
      height: '64px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      backgroundColor: '#ffffff',
      borderBottom: '1px solid #e2e8f0',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      {/* Left: Preserved Hamburger Button as requested */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={() => setSidebarCollapsed(v => !v)}
          title="Toggle sidebar"
          style={{
            background: 'none',
            border: 'none',
            color: '#030441',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ width: '22px', height: '22px' }}>
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <span style={{ fontSize: '16px', fontWeight: 700, color: '#030441' }}>
          ChainTrace Platform
        </span>
      </div>

      {/* Right: Officer Profile & Evidence Export */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '13px' }}>
          <div style={{ fontWeight: 700, color: '#030441' }}>
            {userProfile?.full_name || currentUser || 'Investigator'}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            {userProfile?.badge_id || 'LEA-DL-001'}
          </div>
        </div>

        {/* Export Evidence Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowExportMenu(v => !v)}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 700,
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)'
            }}
          >
            <span>Export Evidence ▾</span>
          </button>

          {showExportMenu && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: '100%',
              marginTop: '6px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              padding: '6px',
              width: '230px',
              zIndex: 1000,
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <button onClick={handleExportFirPdf} style={{ padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#0f172a', borderRadius: '6px' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='#f1f5f9'} onMouseOut={e=>e.currentTarget.style.backgroundColor='transparent'}>
                FIR Evidence PDF (Court)
              </button>
              <button onClick={handleExportExecSummary} style={{ padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#0f172a', borderRadius: '6px' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='#f1f5f9'} onMouseOut={e=>e.currentTarget.style.backgroundColor='transparent'}>
                1-Page Executive Brief
              </button>
              <button onClick={handleExportLedgerCsv} style={{ padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#0f172a', borderRadius: '6px' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='#f1f5f9'} onMouseOut={e=>e.currentTarget.style.backgroundColor='transparent'}>
                Chain-of-Custody Ledger (CSV)
              </button>
              <button onClick={handleExportVaspsCsv} style={{ padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#0f172a', borderRadius: '6px' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='#f1f5f9'} onMouseOut={e=>e.currentTarget.style.backgroundColor='transparent'}>
                Target VASPs & Contacts (CSV)
              </button>
              <button onClick={handleExportJson} style={{ padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#0f172a', borderRadius: '6px' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='#f1f5f9'} onMouseOut={e=>e.currentTarget.style.backgroundColor='transparent'}>
                Raw Forensic Case (JSON)
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
