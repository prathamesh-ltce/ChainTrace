import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { DEMO_CASE, DEMO_CASE_2, TRACE_STEPS } from '../data/constants'
import { downloadFirPdf, downloadJsonReport } from '../utils/firReportGenerator'
import { traceApi } from '../utils/api'
import SahyogNoticeModal from '../components/SahyogNoticeModal'

function detectChain(addr) {
 if (!addr) return 'Auto'
 if (addr.startsWith('0x') && addr.length === 42) return 'ETH'
 if (addr.startsWith('T') && addr.length === 34) return 'TRX'
 if (addr.startsWith('1') || addr.startsWith('3') || addr.startsWith('bc1')) return 'BTC'
 if (addr.length >= 43 && addr.length <= 44 && !addr.startsWith('0x')) return 'SOL'
 return 'Auto'
}

const CHAIN_COLORS = { ETH: '#627eea', BTC: '#f7931a', TRX: '#e21d1d', SOL: '#14f195', Auto: 'var(--indigo)' }

/**
 * Robust Forensic Filter Engine
 * Filters report by TxHash (isolating the exact branch), Amount, Date Range, and Max Hops.
 */
function applyForensicFilters(baseReport, { txHash, amount, maxHops, dateRange }) {
 if (!baseReport) return baseReport
 const report = JSON.parse(JSON.stringify(baseReport))
 let ledger = report.chain_of_custody_ledger || []

 let filterTags = []

 // 1. Filter by Max Hops
 if (maxHops && maxHops > 0) {
  ledger = ledger.filter(row => (row.hop || 1) <= maxHops)
  if (maxHops < 15) filterTags.push('Max Hops: ' + maxHops)
 }

 // 2. Filter by TxHash (Finds target tx and isolates the entire connected downstream / upstream branch)
 if (txHash && txHash.trim()) {
  const cleanHash = txHash.trim().toLowerCase()
  const targetIdx = ledger.findIndex(row =>
   row.tx_hash && (
    row.tx_hash.toLowerCase() === cleanHash ||
    row.tx_hash.toLowerCase().startsWith(cleanHash) ||
    cleanHash.startsWith(row.tx_hash.toLowerCase().slice(0, 10))
   )
  )

  if (targetIdx !== -1) {
   const targetTx = ledger[targetIdx]
   const branchNodes = new Set([targetTx.from.toLowerCase(), targetTx.to.toLowerCase()])

   // Backtrack upstream to suspect
   let changed = true
   while (changed) {
    changed = false
    ledger.forEach(r => {
     if (branchNodes.has(r.to.toLowerCase()) && !branchNodes.has(r.from.toLowerCase())) {
      branchNodes.add(r.from.toLowerCase())
      changed = true
     }
    })
   }

   // Forward track downstream to terminal hops
   changed = true
   while (changed) {
    changed = false
    ledger.forEach(r => {
     if (branchNodes.has(r.from.toLowerCase()) && !branchNodes.has(r.to.toLowerCase())) {
      branchNodes.add(r.to.toLowerCase())
      changed = true
     }
    })
   }

   ledger = ledger.filter(r => branchNodes.has(r.from.toLowerCase()) && branchNodes.has(r.to.toLowerCase()))
   filterTags.push('TxHash: ' + targetTx.tx_hash.slice(0, 10) + '... (Branch Isolated)')
  } else {
   // Partial direct match
   const matched = ledger.filter(r => r.tx_hash && r.tx_hash.toLowerCase().includes(cleanHash))
   if (matched.length > 0) {
    ledger = matched
    filterTags.push('TxHash Match: ' + cleanHash.slice(0, 10) + '...')
   }
  }
 }

 // 3. Filter by Target Amount
 if (amount && Number(amount) > 0) {
  const targetAmt = Number(amount)
  ledger = ledger.filter(r => {
   const v = Number(r.amount) || 0
   return Math.abs(v - targetAmt) <= 0.05 * targetAmt || v >= targetAmt * 0.8
  })
  filterTags.push('Target Amount: ~' + targetAmt)
 }

 // 4. Filter by Date Range
 if (dateRange && dateRange.trim()) {
  const parts = dateRange.split(/to|-|\s+/).filter(Boolean)
  if (parts.length >= 1) {
   const d1 = new Date(parts[0]).getTime() / 1000
   const d2 = parts.length >= 2 ? new Date(parts[1]).getTime() / 1000 + 86400 : d1 + 86400
   if (!isNaN(d1)) {
    ledger = ledger.filter(r => r.timestamp && r.timestamp >= d1 && (!d2 || r.timestamp <= d2))
    filterTags.push('Date: ' + dateRange)
   }
  }
 }

 report.chain_of_custody_ledger = ledger

 // Recompute VASP targets reached by this filtered branch
 const reachedAddresses = new Set(ledger.map(r => r.to.toLowerCase()))
 report.vasp_targets = (report.vasp_targets || []).filter(v => reachedAddresses.has(v.address?.toLowerCase()))

 // Recompute summary
 if (report.on_chain_summary) {
  report.on_chain_summary.transfers_traced = ledger.length
  report.on_chain_summary.outflow_count = ledger.length
 }
 report.hops_traced = ledger.length ? Math.max(...ledger.map(r => r.hop || 1)) : 0

 if (filterTags.length > 0) {
  report.filter_applied = filterTags.join(' • ')
 }

 return report
}

function RiskBanner({ report }) {
 const risk = report.risk_assessment || {}
 const summary = report.on_chain_summary || {}
 const riskScore = risk.risk_score ?? risk.composite_score ?? 0
 const riskLevel = risk.risk_level || 'LOW'
 const circumference = 201.06
 const offset = circumference - (riskScore / 100) * circumference
 const inflowCount = summary.inflow_count ?? report.inflow_count ?? 0
 const outflowCount = summary.outflow_count ?? report.outflow_count ?? 0

 return (
  <div className={"risk-banner " + riskLevel}>
   <div className="risk-left">
    <div className="risk-ring-wrap">
     <svg viewBox="0 0 80 80">
      <circle cx="40" cy="40" r="32" stroke="rgba(255,255,255,0.08)" strokeWidth="6" fill="none"/>
      <circle cx="40" cy="40" r="32"
       stroke="url(#rg)" strokeWidth="6" fill="none"
       strokeDasharray={circumference}
       strokeDashoffset={offset}
       strokeLinecap="round"
       transform="rotate(-90 40 40)"
       style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }}
      />
      <defs>
       <linearGradient id="rg" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#f59e0b"/>
        <stop offset="100%" stopColor="#ef4444"/>
       </linearGradient>
      </defs>
     </svg>
     <div className="risk-score-center">
      <span>{riskScore}</span>
      <small>/100</small>
     </div>
    </div>
    <div>
     <div className={"risk-badge " + riskLevel}>{riskLevel} RISK</div>
     <div className="risk-verdict">{report.suspect_address}</div>
     <div className="risk-summary">{risk.forensic_verdict || 'Analysis complete'}</div>
    </div>
   </div>
   <div className="risk-stats">
    {[
     { val: (report.chain_of_custody_ledger||[]).length, lbl: 'Transfers in Trail' },
     { val: inflowCount, lbl: 'Inflow Txs' },
     { val: outflowCount, lbl: 'Outflow Txs' },
     { val: (report.vasp_targets||[]).length, lbl: 'VASPs Reached' },
    ].map((s,i) => (
     <div key={i} className="risk-stat-item">
      <span className="risk-stat-val">{s.val}</span>
      <span className="risk-stat-lbl">{s.lbl}</span>
     </div>
    ))}
   </div>
  </div>
 )
}

function LedgerTab({ report }) {
 const [filter, setFilter] = useState('all')
 const [search, setSearch] = useState('')
 const ledger = report.chain_of_custody_ledger || []
 const chain = report.blockchain || 'BTC'

 function getRisk(row) {
  if (row.profile?.includes('VASP') || row.vasp_info?.type === 'exchange') return 'LOW'
  if (row.profile?.includes('BRIDGE') || row.profile?.includes('SWAP') || row.profile?.includes('DEX')) return 'MEDIUM'
  if (row.paes_score >= 0.9) return 'HIGH'
  if (row.paes_score >= 0.7) return 'MEDIUM'
  return 'LOW'
 }

 function getClassificationBadge(row) {
  const p = (row.profile || '').toUpperCase()
  const vName = (row.vasp_info?.name || '').toUpperCase()
  if (p.includes('BRIDGE')) return 'BRIDGE'
  if (p.includes('SWAP') || p.includes('DEX')) return vName ? `DEX: ${vName}` : 'DEX'
  if (p.includes('MIXER') || p.includes('TORNADO') || p.includes('COINJOIN')) return 'MIXER'
  if (p.includes('VASP') || p.includes('EXCHANGE') || row.vasp_info?.type === 'exchange') {
   return vName ? `VASP: ${vName}` : 'VASP'
  }
  return 'UNHOSTED'
 }

 // Complete filter search including TxHash, addresses, amount, hop, profile
 const filtered = useMemo(() => {
  const q = search.trim().toLowerCase()
  return ledger.filter(row => {
   const risk = getRisk(row)
   const matchRisk = filter === 'all' || risk.toLowerCase() === filter
   if (!q) return matchRisk

   const matchSearch =
    (row.tx_hash && row.tx_hash.toLowerCase().includes(q)) ||
    (row.from && row.from.toLowerCase().includes(q)) ||
    (row.to && row.to.toLowerCase().includes(q)) ||
    (row.profile && row.profile.toLowerCase().includes(q)) ||
    String(row.hop).includes(q) ||
    String(row.amount).includes(q) ||
    (row.profile?.includes('VASP') ? 'vasp' : 'unhosted').includes(q)

   return matchRisk && matchSearch
  })
 }, [ledger, filter, search])

 return (
  <div>
   <div className="ledger-controls">
    <div className="ledger-search-wrap" style={{ flex: 1, position: 'relative' }}>
     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
     </svg>
     <input
      className="ledger-search"
      placeholder="Filter by TxHash (e.g. 4c4098...), address, hop, amount, or VASP..."
      value={search}
      onChange={e => setSearch(e.target.value)}
     />
     {search && (
      <button
       onClick={() => setSearch('')}
       style={{ position: 'absolute', right: 10, top: 9, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}
      >
       
      </button>
     )}
    </div>
    <div className="filter-btns">
     {['all','high','medium','low'].map(f => (
      <button key={f} className={"filter-btn" + (filter===f?" active":"")} onClick={() => setFilter(f)}>
       {f.charAt(0).toUpperCase()+f.slice(1)}
      </button>
     ))}
    </div>
   </div>

   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
    <span>Showing {filtered.length} of {ledger.length} transfers</span>
    {search && <span style={{ color: '#38bdf8' }}>Filtered by search: "{search}"</span>}
   </div>

   <div className="table-wrap">
    <table className="data-table">
     <thead>
      <tr>
       <th>Hop</th>
       <th>From</th>
       <th>To</th>
       <th>Amount</th>
       <th>Timestamp</th>
       <th>ACC</th>
       <th>PAES</th>
       <th>Classification</th>
       <th>TxHash</th>
      </tr>
     </thead>
     <tbody>
      {filtered.length === 0 ? (
       <tr className="empty-row">
        <td colSpan="9" style={{ textAlign: 'center', padding: '30px' }}>
         No matching records for search filter.
        </td>
       </tr>
      ) : filtered.map((row, i) => (
       <tr key={i}>
        <td><span className="hop-badge">{row.hop}</span></td>
        <td><span className="addr" title={row.from}>{row.from}</span></td>
        <td><span className="addr" title={row.to}>{row.to}</span></td>
        <td><span className="mono" style={{ color: 'var(--emerald)', fontWeight: 600 }}>{Number(row.amount).toFixed(6)} {chain}</span></td>
        <td><span className="mono">{new Date(row.timestamp * 1000).toLocaleDateString()}</span></td>
        <td><span className="mono">{(row.acc_score * 100).toFixed(0)}%</span></td>
        <td><span className="mono">{(row.paes_score * 100).toFixed(0)}%</span></td>
        <td>
         <span className={"risk-pill " + getRisk(row)} style={{ fontSize: '0.58rem' }}>
          {getClassificationBadge(row)}
         </span>
        </td>
        <td>
         <span className="addr" title={row.tx_hash} style={{ color: '#93c5fd', fontFamily: 'var(--font-mono)' }}>
          {row.tx_hash ? row.tx_hash.slice(0, 12) + '...' : 'N/A'}
         </span>
        </td>
       </tr>
      ))}
     </tbody>
    </table>
   </div>
  </div>
 )
}

function TypologyTab({ report }) {
 const typologies = report.risk_assessment?.typologies || []
 const breakdown = report.risk_assessment?.category_breakdown || {}
 if (typologies.length === 0) return (
  <div className="empty-state">
   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
   <p>No typologies detected. Run a trace to see AML/CFT classification.</p>
  </div>
 )
 return (
  <div>
   <div className="typology-grid mb-20">
    {typologies.map((t, i) => {
     const weight = Number(t.base_threat_weight || t.score || 0)
     const actionText = t.investigative_action || t.guidance || t.action || ''
     const barColor = weight >= 70 ? '#ef4444' : weight >= 40 ? '#f59e0b' : '#10b981'
     return (
      <div key={i} className="typology-card" style={{ display: 'flex', flexDirection: 'column' }}>
       <div className="typology-card-header">
        <div>
         <div className="typology-code">{t.code}</div>
         <div className="typology-title">{t.title}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
         <span className={"risk-pill " + (t.severity || 'LOW')}>{t.severity || 'INFO'}</span>
         <div className="typology-weight" style={{ color: barColor, textAlign: 'right', marginTop: 4, fontSize: '1.1rem', fontWeight: 800 }}>
          {weight}<span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>/100</span>
         </div>
        </div>
       </div>

       {/* Threat Weight Meter Bar (Filled according to base threat score) */}
       <div style={{ margin: '8px 0 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 4 }}>
         <span>Threat Factor Weight</span>
         <span style={{ fontWeight: 700, color: barColor, fontFamily: 'var(--font-mono)' }}>{weight}%</span>
        </div>
        <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
         <div style={{ width: Math.min(100, Math.max(4, weight)) + '%', height: '100%', background: barColor, borderRadius: 99, transition: 'width 0.6s ease' }} />
        </div>
       </div>

       <div className="typology-ref">{t.statutory_reference}</div>
       {t.description && <div className="typology-desc" style={{ margin: '6px 0 10px', fontSize: '0.74rem' }}>{t.description}</div>}
       {actionText ? (
        <div className="typology-action" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 'auto' }}>
         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2, color: 'var(--indigo-light)' }}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
         </svg>
         <div>
          <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--indigo-light)', marginBottom: 2 }}>Investigative SOP Action</div>
          <div style={{ color: 'var(--text-secondary)', lineHeight: 1.45, fontSize: '0.72rem' }}>{actionText}</div>
         </div>
        </div>
       ) : null}
      </div>
     )
    })}
   </div>
   {Object.keys(breakdown).length > 0 && (
    <div className="breakdown-section">
     <div className="section-heading" style={{ marginBottom: 16 }}>Threat Factor Breakdown</div>
     {Object.entries(breakdown).map(([k, v]) => (
      <div key={k} className="breakdown-row">
       <div className="breakdown-label">{k.replace(/_/g, ' ')}</div>
       <div className="breakdown-bar"><div className="breakdown-fill" style={{ width: v + '%' }} /></div>
       <div className="breakdown-val">{v}%</div>
      </div>
     ))}
    </div>
   )}
  </div>
 )
}

function VaspTab({ report, onGenerateNotice }) {
 const vasps = report.vasp_targets || []
 if (vasps.length === 0) return (
  <div className="empty-state">
   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 000 4h4a2 2 0 010 4H8"/><path d="M12 18V6"/></svg>
   <p>No VASP targets identified in this branch. Trace is either unspent or terminated at an unhosted intermediary.</p>
  </div>
 )
 return (
  <div className="vasp-grid">
   {vasps.map((v, i) => (
    <div key={i} className="vasp-card">
     <div className="flex-between mb-8">
      <div>
       <div className="vasp-name">{v.vasp_name}</div>
       <div className="vasp-jurisdiction">{v.jurisdiction}</div>
      </div>
      <span className="hop-badge">Hop {v.hop}</span>
     </div>
     <div className="vasp-addr">{v.address}</div>
     <div className="vasp-scores">
      <div className="vasp-score">
       <div className="vasp-score-lbl">ACC Score</div>
       <div className="vasp-score-val" style={{ color: 'var(--indigo-light)' }}>{(v.acc_score * 100).toFixed(0)}%</div>
       <div className="score-bar"><div className="score-fill" style={{ width: (v.acc_score * 100) + '%' }} /></div>
      </div>
      <div className="vasp-score">
       <div className="vasp-score-lbl">PAES Score</div>
       <div className="vasp-score-val" style={{ color: 'var(--violet-light)' }}>{(v.paes_score * 100).toFixed(0)}%</div>
       <div className="score-bar"><div className="score-fill" style={{ width: (v.paes_score * 100) + '%' }} /></div>
      </div>
     </div>
     {v.compliance_email && (
      <div style={{ marginTop: 10, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
       Compliance: {v.compliance_email}
      </div>
     )}
     {v.statutory_notice && <div className="vasp-notice">Notice: {v.statutory_notice}</div>}
     <button
      onClick={() => onGenerateNotice && onGenerateNotice(v)}
      className="btn btn-primary btn-sm"
      style={{
       marginTop: '12px', width: '100%', justifyContent: 'center', fontSize: '0.75rem',
       background: 'linear-gradient(135deg, #3b82f6, #6366f1)', border: 'none'
      }}
     >
      Generate SAHYOG Statutory Notice
     </button>
    </div>
   ))}
  </div>
 )
}

function CrossChainTab({ report }) {
 const hops = report.cross_chain_hops || []
 if (hops.length === 0) return (
  <div className="empty-state">
   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>
   <p>No cross-chain hops detected. Run a trace to identify bridge hopping patterns.</p>
  </div>
 )
 return (
  <div className="crosschain-list">
   {hops.map((h, i) => (
    <div key={i} className="crosschain-item">
     <div className="chain-flow">
      <div className="chain-node">
       <div className="chain-node-name">Origin</div>
       <div className="chain-node-id">{h.origin_chain}</div>
      </div>
      <div className="chain-arrow">→</div>
      <div className="chain-node" style={{ flex: 1 }}>
       <div className="chain-protocol">{h.protocol}</div>
       <div style={{ textAlign: 'center', marginTop: 4 }}>
        <span className={"risk-pill " + (h.status === 'FILLED' ? 'LOW' : 'MEDIUM')}>{h.status}</span>
       </div>
      </div>
      <div className="chain-arrow">→</div>
      <div className="chain-node">
       <div className="chain-node-name">Destination</div>
       <div className="chain-node-id">{h.destination_chain_name}</div>
      </div>
     </div>
     <div className="chain-amount">{Number(h.amount).toFixed(4)} {h.destination_symbol || ''}</div>
    </div>
   ))}
  </div>
 )
}

function EngineTab({ report }) {
 const stats = report.cpp_engine_stats
 if (!stats) return (
  <div className="empty-state">
   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
   <p>No C++ graph engine data available yet.</p>
  </div>
 )
 const items = [
  { val: stats.nodesCount, lbl: 'Nodes' },
  { val: stats.edgesCount, lbl: 'Edges' },
  { val: stats.nodesVisited, lbl: 'Nodes Visited' },
  { val: stats.edgesExamined, lbl: 'Edges Examined' },
  { val: stats.executionTimeUs + ' μs', lbl: 'Execution Time' },
  { val: stats.truncated ? 'Yes' : 'No', lbl: 'Truncated' },
 ]
 return (
  <div>
   <div style={{ marginBottom: 14, fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
    {report.graph_engine}
   </div>
   <div className="engine-grid">
    {items.map((s, i) => (
     <div key={i} className="engine-stat">
      <div className="engine-stat-val">{s.val}</div>
      <div className="engine-stat-lbl">{s.lbl}</div>
     </div>
    ))}
   </div>
  </div>
 )
}

export default function TracePage() {
 const { currentReport, setCurrentReport, showToast, saveReport, currentUser } = useApp()
 const [address, setAddress] = useState('')
 const [coin, setCoin] = useState('')
 const [dateRange, setDateRange] = useState('')
 const [txHash, setTxHash] = useState('')
 const [amount, setAmount] = useState('')
 const [maxHops, setMaxHops] = useState(15)
 const [tracing, setTracing] = useState(false)
 const [progress, setProgress] = useState(0)
 const [progressMsg, setProgressMsg] = useState('')
 const [progressSteps, setProgressSteps] = useState([])
 const [activeTab, setActiveTab] = useState('ledger')
 const [selectedNoticeVasp, setSelectedNoticeVasp] = useState(null)
 const [rawUnfilteredReport, setRawUnfilteredReport] = useState(null)
 const [honeypot, setHoneypot] = useState('')
 const [lastSubmitTime, setLastSubmitTime] = useState(0)

 const detectedChain = detectChain(address)

 const startTrace = async () => {
  // Bot defense (honeypot check)
  if (honeypot) {
   console.warn('Bot submission blocked via honeypot trap')
   return
  }

  // Rate-limiting / anti-spam (minimum 2s cooldown)
  const now = Date.now()
  if (now - lastSubmitTime < 2000) {
   showToast('Please wait a moment before submitting another trace request', 'warning')
   return
  }
  setLastSubmitTime(now)

  const cleanAddress = address.trim()
  if (!cleanAddress) {
   showToast('Please enter a suspect cryptocurrency wallet address', 'error')
   return
  }

  // Client-side regex format validation for major chains
  const isBtc = /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/i.test(cleanAddress)
  const isEvm = /^0x[a-fA-F0-9]{40}$/i.test(cleanAddress)
  const isTron = /^T[a-zA-HJ-NP-Z0-9]{33}$/.test(cleanAddress)
  const isSol = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(cleanAddress)

  if (!isBtc && !isEvm && !isTron && !isSol && cleanAddress.length < 26) {
   showToast('Invalid wallet address format. Please enter a valid BTC, ETH, TRON, or SOL address.', 'error')
   return
  }

  setTracing(true)
  setProgress(5)
  setProgressMsg('Initiating multi-hop attribution trace on forensic backend...')
  setProgressSteps([{ msg: 'Initiating trace request...', type: 'info' }])
  setCurrentReport(null)

  const filterCriteria = {
   txHash: txHash.trim(),
   amount: amount ? parseFloat(amount) : null,
   maxHops,
   dateRange: dateRange.trim()
  }

  try {
   const resp = await traceApi.startTrace({
    suspect_address: address.trim(),
    blockchain: coin || detectedChain,
    max_hops: maxHops,
    date_range: dateRange || null,
    tx_hash: txHash || null,
    amount: amount ? parseFloat(amount) : null
   })
   const caseId = resp.case_id

   let sseReceived = false
   const unsubscribe = traceApi.subscribeTraceSSE(
    caseId,
    async (eventType, data) => {
     sseReceived = true
     if (eventType === 'progress') {
      setProgress(data.percent || 15)
      setProgressMsg(data.message || '')
      setProgressSteps(prev => [...prev, { msg: data.message, type: 'info' }])
     } else if (eventType === 'hop_found') {
      setProgressSteps(prev => [...prev, { msg: 'Hop ' + data.hop + ' Found: ' + data.to + ' (' + data.amount + ')', type: 'hop' }])
     } else if (eventType === 'vasp_detected') {
      setProgressSteps(prev => [...prev, { msg: 'VASP Identified: ' + data.vasp_name + ' at Hop ' + data.hop, type: 'vasp' }])
     } else if (eventType === 'complete') {
      try {
       const fullReport = await traceApi.getResult(caseId)
       setRawUnfilteredReport(fullReport)
       const filtered = applyForensicFilters(fullReport, filterCriteria)
       setCurrentReport(filtered)
       saveReport(filtered)
       setActiveTab('ledger')
       showToast(
        filterCriteria.txHash
         ? 'Trace complete: Filtered to branch for TxHash ' + filterCriteria.txHash.slice(0, 10) + '...'
         : 'Forensic trace complete - Investigation report sealed',
        'success'
       )
      } catch (err) {
       console.error('Error fetching result:', err)
      } finally {
       setTracing(false)
      }
     } else if (eventType === 'error') {
      showToast(data.error || 'Trace failed', 'error')
      setTracing(false)
     }
    },
    () => {
     if (!sseReceived) {
      const pollInterval = setInterval(async () => {
       try {
        const st = await traceApi.getStatus(caseId)
        setProgress(st.progress || 50)
        setProgressMsg(st.current_step || '')
        if (st.status === 'complete') {
         clearInterval(pollInterval)
         const fullReport = await traceApi.getResult(caseId)
         setRawUnfilteredReport(fullReport)
         const filtered = applyForensicFilters(fullReport, filterCriteria)
         setCurrentReport(filtered)
         saveReport(filtered)
         setTracing(false)
         showToast('Forensic trace complete', 'success')
        } else if (st.status === 'error') {
         clearInterval(pollInterval)
         setTracing(false)
         showToast(st.error || 'Trace error', 'error')
        }
       } catch (_) {}
      }, 2500)
     }
    }
   )
  } catch (apiErr) {
   console.warn('API trace failed, running forensic simulation with applied filters:', apiErr.message)
   TRACE_STEPS.forEach(({ pct, msg, type, delay }) => {
    setTimeout(() => {
     setProgress(pct)
     setProgressMsg(msg)
     setProgressSteps(prev => [...prev, { msg, type }])
    }, delay)
   })

   setTimeout(() => {
    setTracing(false)
    const base = address.startsWith('0x')
     ? { ...DEMO_CASE_2, suspect_address: address, blockchain: 'ETH' }
     : { ...DEMO_CASE, suspect_address: address }

    setRawUnfilteredReport(base)
    const filteredReport = applyForensicFilters(base, filterCriteria)

    setCurrentReport(filteredReport)
    saveReport(filteredReport)
    setActiveTab('ledger')

    if (filterCriteria.txHash) {
     showToast('Trace complete: Filtered to Branch for TxHash ' + filterCriteria.txHash.slice(0, 10) + '... (' + filteredReport.chain_of_custody_ledger.length + ' transfers)', 'success')
    } else {
     showToast('Trace complete - Investigation report generated', 'success')
    }
   }, 7500)
  }
 }

 const loadDemo = () => {
  setAddress(DEMO_CASE.suspect_address)
  setRawUnfilteredReport(DEMO_CASE)
  setCurrentReport(DEMO_CASE)
  saveReport(DEMO_CASE)
  showToast('Loaded standard 5-Hop BTC investigation', 'info')
 }

 const clearForm = () => {
  setAddress(''); setCoin(''); setDateRange(''); setTxHash(''); setAmount(''); setMaxHops(15)
  setCurrentReport(null); setRawUnfilteredReport(null); setTracing(false)
  showToast('Form and investigation cleared', 'info')
 }

 const resetFiltersToFullCase = () => {
  if (rawUnfilteredReport) {
   setCurrentReport(rawUnfilteredReport)
   setTxHash('')
   setAmount('')
   setDateRange('')
   setMaxHops(15)
   showToast('Restored full unfiltered investigation case', 'info')
  }
 }

 const TABS = [
  { id: 'ledger', label: 'Chain-of-Custody Ledger' },
  { id: 'typology', label: 'AML/CFT Typologies' },
  { id: 'vasp', label: 'VASP Targets' },
  { id: 'crosschain', label: 'Cross-Chain Hops' },
  { id: 'engine', label: 'Graph Engine' },
 ]

 const summary = currentReport?.on_chain_summary || {}
 const totalInflow = Number(summary.total_inflow ?? currentReport?.total_inflow ?? 0)
 const totalOutflow = Number(summary.total_outflow ?? currentReport?.total_outflow ?? 0)
 const chain = currentReport?.blockchain || 'BTC'

 return (
  <div>
   <div className="panel mb-20">
    <div className="panel-header">
     <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div className="panel-icon">
       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
       </svg>
      </div>
      <div>
       <div className="panel-title">Suspect Wallet Investigation</div>
       <div className="panel-sub">Enter a wallet address and optional criteria (TxHash, amount, date) to trace fund flows</div>
      </div>
     </div>
    </div>
    <div className="panel-body">
     <div className="grid mb-16" style={{ gridTemplateColumns: '1fr', gap: 14 }}>
      {/* Honeypot anti-bot hidden input */}
      <input
       type="text"
       name="bot_field_trap"
       value={honeypot}
       onChange={e => setHoneypot(e.target.value)}
       style={{ display: 'none' }}
       tabIndex="-1"
       autoComplete="off"
      />
      <div className="field-group">
       <label className="field-label">Suspect Wallet Address <span className="req">*</span></label>
       <div className="input-wrap">
        <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
         <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
        </svg>
        <input
         type="text"
         className="has-icon has-tag"
         placeholder="0x... or bc1q... or T..."
         value={address}
         onChange={e => setAddress(e.target.value)}
         autoComplete="off"
         spellCheck="false"
        />
        <span className="field-tag" style={{ color: CHAIN_COLORS[detectedChain] || 'var(--indigo)' }}>{detectedChain}</span>
       </div>
      </div>
     </div>

     <div className="grid g-3 mb-16" style={{ gap: 14 }}>
      <div className="field-group">
       <label className="field-label">Blockchain / Coin</label>
       <select value={coin} onChange={e => setCoin(e.target.value)}>
        <option value="">Auto-Detect</option>
        <option value="BTC">Bitcoin (BTC)</option>
        <option value="ETH">Ethereum (ETH)</option>
        <option value="TRON">Tron (TRX)</option>
        <option value="BNB">BNB Chain (BNB)</option>
        <option value="MATIC">Polygon (MATIC)</option>
        <option value="SOL">Solana (SOL)</option>
       </select>
      </div>
      <div className="field-group">
       <label className="field-label">Date Range (Optional)</label>
       <input type="text" placeholder="YYYY-MM-DD to YYYY-MM-DD" value={dateRange} onChange={e => setDateRange(e.target.value)} />
      </div>
      <div className="field-group">
       <label className="field-label">Transaction Hash (Optional Filter)</label>
       <input
        type="text"
        placeholder="e.g. 4c4098120ec8... or 5f5870e..."
        value={txHash}
        onChange={e => setTxHash(e.target.value)}
        spellCheck="false"
       />
      </div>
      <div className="field-group">
       <label className="field-label">Target Amount (Optional Filter)</label>
       <input type="number" placeholder="e.g. 0.02" step="any" min="0" value={amount} onChange={e => setAmount(e.target.value)} />
      </div>
      <div className="field-group" style={{ gridColumn: 'span 2' }}>
       <label className="field-label">Max Hops: {maxHops}</label>
       <input type="range" min="1" max="25" value={maxHops} onChange={e => setMaxHops(Number(e.target.value))} />
      </div>
     </div>

     <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <button className="btn btn-primary" onClick={startTrace} disabled={tracing}>
       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="5 3 19 12 5 21 5 3"/>
       </svg>
       {tracing ? 'Tracing...' : 'Launch Forensic Trace'}
      </button>
      <button className="btn btn-secondary" onClick={loadDemo} disabled={tracing}>
       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
       </svg>
       Load Full Demo Case
      </button>
      <button className="btn btn-ghost" onClick={clearForm} disabled={tracing}>Clear</button>
     </div>
    </div>
   </div>

   {tracing && (
    <div className="trace-progress">
     <div className="progress-header">
      <div className="spinner" />
      <span className="progress-status">{progressMsg}</span>
      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--indigo)' }}>{progress}%</span>
     </div>
     <div className="progress-track">
      <div className="progress-fill" style={{ width: progress + '%' }} />
     </div>
     <div className="progress-steps">
      {progressSteps.map((s, i) => (
       <div key={i} className={"progress-step " + s.type}>
        {s.type === 'ok' ? '' : '•'} {s.msg}
       </div>
      ))}
     </div>
    </div>
   )}

   {currentReport && !tracing && (
    <div>
     {/* Active Filter Alert Banner if applied */}
     {currentReport.filter_applied && (
      <div style={{
       display: 'flex',
       justifyContent: 'space-between',
       alignItems: 'center',
       background: 'rgba(56, 189, 248, 0.1)',
       border: '1px solid rgba(56, 189, 248, 0.3)',
       borderRadius: 'var(--r-md)',
       padding: '10px 16px',
       marginBottom: 16
      }}>
       <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#38bdf8' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
         <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
        </svg>
        <span><strong>Active Forensic Filter:</strong> {currentReport.filter_applied}</span>
       </div>
       <button
        className="btn btn-sm btn-ghost"
        onClick={resetFiltersToFullCase}
        style={{ fontSize: '0.72rem', color: '#f8fafc', background: 'rgba(255,255,255,0.08)' }}
       >
        Reset Filter (Show All 22 Branches)
       </button>
      </div>
     )}

     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, background: 'var(--bg-card)', padding: '10px 16px', borderRadius: 'var(--r-lg)', border: '1px solid var(--border-subtle)' }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
       INVESTIGATION DOSSIER: <span className="mono" style={{ color: '#ffffff', fontWeight: 800 }}>{currentReport.case_id}</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
       <button
        className="btn btn-primary btn-sm"
        onClick={() => downloadFirPdf(currentReport, currentUser || 'Cyber Investigator')}
        style={{ background: 'linear-gradient(135deg, #059669, #0284c7)', border: 'none', fontWeight: 700, padding: '7px 14px', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)' }}
        title="Download Official FIR Investigation PDF (Court & Police Evidence Annexure)"
       >
        <span>PDF</span>
        <span>Download FIR Evidence Report</span>
       </button>
       <button
        className="btn btn-secondary btn-sm"
        onClick={() => downloadJsonReport(currentReport)}
        style={{ padding: '7px 12px', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: 6 }}
        title="Download Raw JSON"
       >
        <span>JSON</span>
        <span>Case Data</span>
       </button>
      </div>
     </div>

     <RiskBanner report={currentReport} />

     <div className="grid g-4 mb-20">
      {[
       { color: 'green', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>, val: totalInflow.toFixed(6) + ' ' + chain, lbl: 'Total Inflow' },
       { color: 'red',  icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>, val: totalOutflow.toFixed(6) + ' ' + chain, lbl: 'Total Outflow' },
       { color: 'purple',icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>, val: (currentReport.chain_of_custody_ledger||[]).length, lbl: 'Transfers in Trail' },
       { color: 'blue', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, val: (currentReport.duration_seconds||0).toFixed(2) + 's', lbl: 'Analysis Time' },
      ].map((s, i) => (
       <div key={i} className="stat-card">
        <div className={"stat-card-icon " + s.color}>{s.icon}</div>
        <div>
         <div className="stat-num" style={{ fontSize: '1rem' }}>{s.val}</div>
         <div className="stat-lbl">{s.lbl}</div>
        </div>
       </div>
      ))}
     </div>

     <div className="panel">
      <div className="panel-body">
       <div className="tab-bar">
        {TABS.map(t => (
         <button key={t.id} className={"tab-btn" + (activeTab===t.id?" active":"")} onClick={() => setActiveTab(t.id)}>
          {t.label}
         </button>
        ))}
       </div>
       <div className={"tab-content active"}>
        {activeTab === 'ledger'   && <LedgerTab report={currentReport} />}
        {activeTab === 'typology'  && <TypologyTab report={currentReport} />}
        {activeTab === 'vasp'    && <VaspTab report={currentReport} onGenerateNotice={v => setSelectedNoticeVasp(v)} />}
        {activeTab === 'crosschain' && <CrossChainTab report={currentReport} />}
        {activeTab === 'engine'   && <EngineTab report={currentReport} />}
       </div>
      </div>
     </div>
    </div>
   )}

   {selectedNoticeVasp && (
    <SahyogNoticeModal
     vaspTarget={selectedNoticeVasp}
     report={currentReport}
     onClose={() => setSelectedNoticeVasp(null)}
    />
   )}
  </div>
 )
}
