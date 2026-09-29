import { useState } from 'react'
import { sahyogApi } from '../utils/api'
import { useApp } from '../context/AppContext'

export default function SahyogNoticeModal({ vaspTarget, report, onClose }) {
 const { userProfile, showToast } = useApp()

 const [officerName, setOfficerName] = useState(userProfile?.full_name || 'Inspector R. Sharma')
 const [officerBadge, setOfficerBadge] = useState(userProfile?.badge_id || 'LEA-DL-9842')
 const [policeStation, setPoliceStation] = useState(userProfile?.unit || 'Cyber Crime Police Station, Special Cell')
 const [firNumber, setFirNumber] = useState(`FIR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`)
 const [statutorySection, setStatutorySection] = useState('Section 91 CrPC / Section 94 BNSS 2023')
 const [loading, setLoading] = useState(false)
 const [noticeResult, setNoticeResult] = useState(null)

 const handleGenerate = async (e) => {
  e.preventDefault()
  setLoading(true)
  try {
   const payload = {
    case_id: report?.case_id || 'CASE-CURRENT',
    officer_name: officerName,
    officer_badge: officerBadge,
    police_station: policeStation,
    fir_number: firNumber,
    vasp_name: vaspTarget?.vasp_name || 'Exchange Desk',
    vasp_address: vaspTarget?.address || '',
    compliance_email: vaspTarget?.compliance_email || '',
    statutory_section: statutorySection
   }
   const res = await sahyogApi.createNotice(payload)
   setNoticeResult(res)
   showToast('SAHYOG Statutory Notice generated successfully!', 'success')
  } catch (err) {
   showToast(err.message || 'Failed to generate notice', 'error')
  } finally {
   setLoading(false)
  }
 }

 const handlePrint = () => {
  if (!noticeResult?.html_document) return
  const printWin = window.open('', '_blank')
  if (printWin) {
   printWin.document.write(noticeResult.html_document)
   printWin.document.close()
   setTimeout(() => printWin.print(), 350)
  }
 }

 return (
  <div style={{
   position: 'fixed', inset: 0, zIndex: 10000,
   background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
   display: 'flex', alignItems: 'center', justifyContent: 'center',
   padding: '20px'
  }}>
   <div style={{
    background: 'var(--card-bg, #0f172a)',
    border: '1px solid var(--border, #334155)',
    borderRadius: 'var(--r-lg, 12px)',
    width: '780px', maxWidth: '100%', maxHeight: '90vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
    overflow: 'hidden'
   }}>
    {/* Header */}
    <div style={{
     padding: '16px 24px', borderBottom: '1px solid var(--border)',
     display: 'flex', justifyContent: 'space-between', alignItems: 'center',
     background: 'rgba(255,255,255,0.02)'
    }}>
     <div>
      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
        SAHYOG Portal - Statutory Notice Generator
      </h3>
      <span style={{ fontSize: '0.74rem', color: '#f1f5f9', fontWeight: 600 }}>
       Requisition under {statutorySection} to {vaspTarget?.vasp_name}
      </span>
     </div>
     <button
      onClick={onClose}
      title="Close (Esc)"
      style={{
       width: 32,
       height: 32,
       minWidth: 32,
       borderRadius: '8px',
       border: '1px solid rgba(255, 255, 255, 0.2)',
       background: 'rgba(255, 255, 255, 0.08)',
       color: '#ffffff',
       display: 'flex',
       alignItems: 'center',
       justifyContent: 'center',
       cursor: 'pointer',
       transition: 'all 0.15s ease'
      }}
      onMouseEnter={e => {
       e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)'
       e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.6)'
      }}
      onMouseLeave={e => {
       e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
       e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
      }}
     >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
       <line x1="18" y1="6" x2="6" y2="18"></line>
       <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
     </button>
    </div>

    {/* Content */}
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
     {!noticeResult ? (
      <form onSubmit={handleGenerate}>
       <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div className="field-group">
         <label className="field-label">Target VASP / Exchange</label>
         <input type="text" value={vaspTarget?.vasp_name || ''} disabled />
        </div>
        <div className="field-group">
         <label className="field-label">Target Exchange Address</label>
         <input type="text" value={vaspTarget?.address || ''} disabled style={{ fontFamily: 'monospace', fontSize: '0.78rem' }} />
        </div>
       </div>

       <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div className="field-group">
         <label className="field-label">Investigating Officer Name</label>
         <input
          type="text"
          value={officerName}
          onChange={e => setOfficerName(e.target.value)}
          required
         />
        </div>
        <div className="field-group">
         <label className="field-label">Badge ID / Service Number</label>
         <input
          type="text"
          value={officerBadge}
          onChange={e => setOfficerBadge(e.target.value)}
          required
         />
        </div>
       </div>

       <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div className="field-group">
         <label className="field-label">Police Station / LEA Unit</label>
         <input
          type="text"
          value={policeStation}
          onChange={e => setPoliceStation(e.target.value)}
          required
         />
        </div>
        <div className="field-group">
         <label className="field-label">FIR / Case Crime Number</label>
         <input
          type="text"
          value={firNumber}
          onChange={e => setFirNumber(e.target.value)}
          required
         />
        </div>
       </div>

       <div className="field-group" style={{ marginBottom: '16px' }}>
        <label className="field-label">Statutory Legal Authority</label>
        <select
         value={statutorySection}
         onChange={e => setStatutorySection(e.target.value)}
         style={{
          width: '100%', padding: '9px 12px', background: 'var(--bg)',
          color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)'
         }}
        >
         <option value="Section 91 CrPC / Section 94 BNSS 2023">Section 91 CrPC / Section 94 BNSS 2023 (Production of Documents/KYC)</option>
         <option value="Section 102 CrPC / Section 106 BNSS 2023">Section 102 CrPC / Section 106 BNSS 2023 (Immediate Asset Freeze)</option>
         <option value="Section 51A UAPA / PMLA Section 3">Section 51A UAPA / PMLA Section 3 (Terrorism Financing / Money Laundering)</option>
        </select>
       </div>

       <div style={{
        background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)',
        borderRadius: '8px', padding: '12px 16px', fontSize: '0.78rem', color: '#f8fafc',
        marginBottom: '20px'
       }}>
        <strong style={{ color: 'var(--indigo-light)' }}>ℹ Mandatory SAHYOG Portal Provisions Included:</strong>
        <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
         <li>Immediate debit freeze on beneficial account</li>
         <li>Complete KYC records (Govt Photo ID, Aadhaar, PAN, Passport)</li>
         <li>Associated bank account & P2P trade transaction logs</li>
         <li>Login IPv4/IPv6 address logs with timestamps</li>
        </ul>
       </div>

       <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button type="button" onClick={onClose} className="btn btn-secondary">
         Cancel
        </button>
        <button type="submit" disabled={loading} className="btn btn-primary">
         {loading ? 'Generating...' : 'Generate SAHYOG Requisition Notice'}
        </button>
       </div>
      </form>
     ) : (
      <div>
       <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', background: 'rgba(16,185,129,0.1)', border: '1px solid var(--emerald)',
        borderRadius: '8px', marginBottom: '16px'
       }}>
        <div>
         <div style={{ fontWeight: 'bold', color: '#34d399', fontSize: '0.92rem' }}> Notice Generated: {noticeResult.notice_ref}</div>
         <div style={{ fontSize: '0.78rem', color: '#ffffff', fontWeight: 600, marginTop: '2px' }}>
          Addressed to Nodal Compliance Desk of {noticeResult.vasp_name} ({noticeResult.compliance_email || 'Portal'})
         </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
         <button onClick={handlePrint} className="btn btn-primary btn-sm">
           Print / Save as PDF
         </button>
         <button onClick={() => setNoticeResult(null)} className="btn btn-secondary btn-sm">
           Edit Fields
         </button>
        </div>
       </div>

       <div style={{
        background: '#ffffff', color: '#111827', padding: '20px', borderRadius: '8px',
        maxHeight: '400px', overflowY: 'auto', border: '1px solid #cbd5e1', fontSize: '12px',
        fontFamily: 'serif'
       }}>
        <div dangerouslySetInnerHTML={{ __html: noticeResult.html_document }} />
       </div>
      </div>
     )}
    </div>
   </div>
  </div>
 )
}
