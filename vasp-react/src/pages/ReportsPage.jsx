import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { reportsApi } from '../utils/api'
import { downloadFirPdf, downloadJsonReport } from '../utils/firReportGenerator'
import { exportExecutiveSummary } from '../utils/exportHelpers'

export default function ReportsPage() {
  const { savedReports, setCurrentReport, setCurrentView, showToast, saveReport } = useApp()
  const [serverReports, setServerReports] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Filters & Search
  const [search, setSearch] = useState('')
  const [networkFilter, setNetworkFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState('table') // 'table' or 'grid'

  // Pagination & Indexing
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const fetchServerReports = async () => {
    setLoading(true)
    try {
      const res = await reportsApi.getReports(100)
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
      const srvRes = await reportsApi.uploadReport(file)
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
  const combined = useMemo(() => {
    const list = [...serverReports]
    savedReports.forEach(localR => {
      if (!list.some(c => c.case_id === localR.case_id)) {
        list.unshift(localR)
      }
    })
    return list
  }, [serverReports, savedReports])

  // Filtered reports
  const filtered = useMemo(() => {
    return combined.filter(r => {
      const q = search.trim().toLowerCase()
      const suspect = (r.suspect_address || r.suspect_wallet || '').toLowerCase()
      const caseId = (r.case_id || '').toLowerCase()
      const chain = (r.blockchain || r.coin || '').toUpperCase()
      const rScore = r.risk_assessment?.composite_score ?? r.risk_assessment?.risk_score ?? r.risk_score ?? 0
      const rLevel = (r.risk_assessment?.risk_level || r.risk_level || 'LOW').toUpperCase()

      // Search match
      if (q && !caseId.includes(q) && !suspect.includes(q)) {
        return false
      }

      // Network filter
      if (networkFilter !== 'all' && chain !== networkFilter) {
        return false
      }

      // Status / Risk filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'CRITICAL' && rLevel !== 'CRITICAL') return false
        if (statusFilter === 'HIGH' && rLevel !== 'HIGH') return false
        if (statusFilter === 'MEDIUM' && rLevel !== 'MEDIUM') return false
        if (statusFilter === 'LOW' && rLevel !== 'LOW') return false
      }

      return true
    })
  }, [combined, search, networkFilter, statusFilter])

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const paginatedReports = filtered.slice(startIndex, startIndex + pageSize)

  const truncate = (str, len = 14) => {
    if (!str) return 'Unknown'
    if (str.length <= len) return str
    return `${str.slice(0, 8)}...${str.slice(-6)}`
  }

  const formatDate = (val) => {
    if (!val) return 'Recent'
    try {
      const d = new Date(val)
      if (isNaN(d.getTime())) return 'Recent'
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
      return 'Recent'
    }
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1440px', margin: '0 auto', color: '#030441' }}>
      
      {/* 1. Header Section matching Investigations.png */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#030441', margin: 0, letterSpacing: '-0.02em' }}>
            Investigations
          </h1>
          <div style={{ fontSize: '15px', color: '#64748b', fontWeight: 600, marginTop: '4px' }}>
            {filtered.length} total cases
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => setCurrentView('trace')}
            style={{
              backgroundColor: '#38bdf8',
              color: '#030441',
              border: 'none',
              borderRadius: '10px',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(56, 189, 248, 0.35)',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#7dd3fc'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#38bdf8'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Investigation
          </button>

          <button
            onClick={fetchServerReports}
            title="Refresh case list"
            style={{
              backgroundColor: '#ffffff',
              color: '#030441',
              border: '1.5px solid #030441',
              borderRadius: '10px',
              padding: '11px 18px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Refresh
          </button>

          <input type="file" id="report-upload-file" accept=".json" style={{ display: 'none' }} onChange={handleLoadFile} />
          <button
            disabled={uploading}
            onClick={() => document.getElementById('report-upload-file').click()}
            style={{
              backgroundColor: '#030441',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '12px 20px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {uploading ? 'Uploading...' : 'Upload JSON Report'}
          </button>
        </div>
      </div>

      {/* 2. Filter & Input Section matching Investigations.png */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1.5px solid #030441',
        borderRadius: '16px',
        padding: '24px 28px',
        boxShadow: '0 4px 16px rgba(3, 4, 65, 0.05)',
        marginBottom: '24px'
      }}>
        {/* Search input (full width) */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 700,
            color: '#64748b',
            marginBottom: '8px'
          }}>
            Search(Case ID or wallet address)
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="e.g. CASE_0xEe2Ee2... or bc1q9wnz... or TxHash"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              style={{
                width: '100%',
                backgroundColor: '#ffffff',
                border: '1.5px solid #030441',
                borderRadius: '10px',
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#030441',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 2 Columns: Blockchain Network & Status */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 700,
              color: '#64748b',
              marginBottom: '8px'
            }}>
              Blockchain Network
            </label>
            <select
              value={networkFilter}
              onChange={(e) => { setNetworkFilter(e.target.value); setCurrentPage(1); }}
              style={{
                width: '100%',
                backgroundColor: '#ffffff',
                border: '1.5px solid #030441',
                borderRadius: '10px',
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#030441',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Networks</option>
              <option value="BTC">Bitcoin (BTC)</option>
              <option value="ETH">Ethereum (ETH)</option>
              <option value="SOL">Solana (SOL)</option>
              <option value="TRON">Tron (TRX)</option>
              <option value="BNB">Binance Smart Chain (BNB)</option>
              <option value="MATIC">Polygon (MATIC)</option>
            </select>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 700,
              color: '#64748b',
              marginBottom: '8px'
            }}>
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              style={{
                width: '100%',
                backgroundColor: '#ffffff',
                border: '1.5px solid #030441',
                borderRadius: '10px',
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#030441',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Statuses / Risk Levels</option>
              <option value="CRITICAL">Critical Risk (Composite Score 80+)</option>
              <option value="HIGH">High Risk (Threat Score 60-79)</option>
              <option value="MEDIUM">Medium Risk (Score 40-59)</option>
              <option value="LOW">Low Risk (Score &lt; 40)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Indexing, Pagination Controls & View Switcher Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>
          Showing <span style={{ color: '#030441' }}>{filtered.length === 0 ? 0 : startIndex + 1}</span>–<span style={{ color: '#030441' }}>{Math.min(startIndex + pageSize, filtered.length)}</span> of <span style={{ color: '#030441' }}>{filtered.length}</span> indexed cases
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* View Toggle */}
          <div style={{
            display: 'flex',
            backgroundColor: '#ffffff',
            border: '1.5px solid #030441',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <button
              onClick={() => setViewMode('table')}
              style={{
                border: 'none',
                padding: '6px 14px',
                backgroundColor: viewMode === 'table' ? '#030441' : 'transparent',
                color: viewMode === 'table' ? '#ffffff' : '#64748b',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Table View
            </button>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                border: 'none',
                padding: '6px 14px',
                backgroundColor: viewMode === 'grid' ? '#030441' : 'transparent',
                color: viewMode === 'grid' ? '#ffffff' : '#64748b',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Cards View
            </button>
          </div>

          {/* Page size dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
            <span>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              style={{
                backgroundColor: '#ffffff',
                border: '1.5px solid #cbd5e1',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#030441'
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Results List: Table View (default matching Investigations.png) OR Cards View */}
      {loading && filtered.length === 0 ? (
        <div style={{
          backgroundColor: '#ffffff',
          border: '1.5px solid #030441',
          borderRadius: '16px',
          padding: '60px 24px',
          textAlign: 'center',
          color: '#64748b'
        }}>
          Loading forensic case records...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          backgroundColor: '#ffffff',
          border: '1.5px solid #030441',
          borderRadius: '16px',
          padding: '60px 24px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#030441', marginBottom: '6px' }}>
            No matching investigation reports found
          </div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            Try adjusting your search criteria or launch a New Investigation trace.
          </div>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW MATCHING Investigations.png */
        <div style={{
          backgroundColor: '#ffffff',
          border: '1.5px solid #030441',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(3, 4, 65, 0.05)',
          marginBottom: '24px'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1.5px solid #030441' }}>
                <th style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 800, color: '#030441', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Case ID</th>
                <th style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 800, color: '#030441', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Suspect Wallet</th>
                <th style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 800, color: '#030441', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Network</th>
                <th style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 800, color: '#030441', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                <th style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 800, color: '#030441', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Top VASP</th>
                <th style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 800, color: '#030441', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Score</th>
                <th style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 800, color: '#030441', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Created</th>
                <th style={{ padding: '14px 18px', fontSize: '11px', fontWeight: 800, color: '#030441', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedReports.map((r, i) => {
                const rScore = r.risk_assessment?.composite_score ?? r.risk_assessment?.risk_score ?? r.risk_score ?? 0
                const rLevel = (r.risk_assessment?.risk_level || r.risk_level || 'LOW').toUpperCase()
                const suspect = r.suspect_address || r.suspect_wallet || 'Unknown'
                const chain = (r.blockchain || r.coin || 'BTC').toUpperCase()
                const topVasp = r.vasp_targets?.[0]?.vasp_name || (r.vasp_targets_count > 0 ? `${r.vasp_targets_count} VASP(s)` : 'Unhosted')

                return (
                  <tr
                    key={r.case_id || i}
                    onClick={() => openReport(r)}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                  >
                    <td style={{ padding: '14px 18px', fontFamily: 'monospace', fontWeight: 800, fontSize: '13px', color: '#030441' }}>
                      {r.case_id}
                    </td>

                    <td style={{ padding: '14px 18px', fontFamily: 'monospace', fontSize: '12px', color: '#0284c7', fontWeight: 600 }}>
                      <span title={suspect}>{truncate(suspect, 16)}</span>
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        padding: '4px 8px',
                        backgroundColor: '#f1f5f9',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 800,
                        color: '#030441',
                        border: '1px solid #e2e8f0'
                      }}>
                        {chain}
                      </span>
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 800,
                        letterSpacing: '0.03em',
                        backgroundColor: rLevel === 'CRITICAL' ? '#fef2f2' : rLevel === 'HIGH' ? '#fff7ed' : rLevel === 'MEDIUM' ? '#fefce8' : '#f0fdf4',
                        color: rLevel === 'CRITICAL' ? '#dc2626' : rLevel === 'HIGH' ? '#ea580c' : rLevel === 'MEDIUM' ? '#b45309' : '#16a34a',
                        border: `1px solid ${rLevel === 'CRITICAL' ? '#fecaca' : rLevel === 'HIGH' ? '#fed7aa' : rLevel === 'MEDIUM' ? '#fef08a' : '#bbf7d0'}`
                      }}>
                        {rLevel}
                      </span>
                    </td>

                    <td style={{ padding: '14px 18px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                      {topVasp}
                    </td>

                    <td style={{ padding: '14px 18px', fontFamily: 'monospace', fontSize: '13px', fontWeight: 800, color: '#030441' }}>
                      {rScore}/100
                    </td>

                    <td style={{ padding: '14px 18px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                      {formatDate(r.created_at || r.timestamp)}
                    </td>

                    <td style={{ padding: '14px 18px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          onClick={() => downloadFirPdf(r)}
                          style={{
                            backgroundColor: '#059669',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                          title="Download Court FIR Evidence PDF"
                        >
                          FIR PDF
                        </button>
                        <button
                          onClick={() => openReport(r)}
                          style={{
                            backgroundColor: '#ffffff',
                            color: '#030441',
                            border: '1.5px solid #030441',
                            borderRadius: '6px',
                            padding: '5px 10px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                          title="View Case Trail & Dossier"
                        >
                          View
                        </button>
                        <button
                          onClick={() => downloadJsonReport(r)}
                          style={{
                            backgroundColor: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '5px 8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                          title="Download Raw JSON"
                        >
                          JSON
                        </button>
                        <button
                          onClick={(e) => handleDelete(r.case_id, e)}
                          style={{
                            backgroundColor: 'transparent',
                            color: '#dc2626',
                            border: 'none',
                            padding: '4px 6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 700
                          }}
                          title="Delete Case Record"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* CARDS VIEW (Clean White Cards) */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '20px',
          marginBottom: '24px'
        }}>
          {paginatedReports.map((r, i) => {
            const rScore = r.risk_assessment?.composite_score ?? r.risk_assessment?.risk_score ?? r.risk_score ?? 0
            const rLevel = (r.risk_assessment?.risk_level || r.risk_level || 'LOW').toUpperCase()
            const suspect = r.suspect_address || r.suspect_wallet || 'Unknown'
            const chain = (r.blockchain || r.coin || 'BTC').toUpperCase()
            const hopsCount = r.hops_traced || r.max_hops_traced || (r.chain_of_custody_ledger || []).length
            const vaspCount = r.vasp_targets_count ?? (r.vasp_targets || []).length

            return (
              <div
                key={r.case_id || i}
                onClick={() => openReport(r)}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #030441',
                  borderRadius: '16px',
                  padding: '20px 22px',
                  boxShadow: '0 4px 16px rgba(3, 4, 65, 0.05)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 8px 24px rgba(3, 4, 65, 0.1)'}
                onMouseOut={(e) => e.currentTarget.style.boxShadow = '0 4px 16px rgba(3, 4, 65, 0.05)'}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '13px', color: '#030441' }}>
                      {r.case_id}
                    </span>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: 800,
                      backgroundColor: rLevel === 'CRITICAL' ? '#fef2f2' : rLevel === 'HIGH' ? '#fff7ed' : '#f0fdf4',
                      color: rLevel === 'CRITICAL' ? '#dc2626' : rLevel === 'HIGH' ? '#ea580c' : '#16a34a',
                      border: `1px solid ${rLevel === 'CRITICAL' ? '#fecaca' : rLevel === 'HIGH' ? '#fed7aa' : '#bbf7d0'}`
                    }}>
                      {rLevel} ({rScore})
                    </span>
                  </div>

                  <div style={{
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    color: '#0284c7',
                    fontWeight: 600,
                    backgroundColor: '#f8fafc',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    wordBreak: 'break-all',
                    marginBottom: '12px'
                  }}>
                    {suspect}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
                    <span style={{ padding: '2px 8px', backgroundColor: '#f1f5f9', borderRadius: '4px', fontWeight: 800, color: '#030441' }}>
                      {chain}
                    </span>
                    <span>{hopsCount} Hops Traced</span>
                    {vaspCount > 0 && (
                      <span style={{ color: '#059669', fontWeight: 700 }}>
                        • {vaspCount} VASP(s)
                      </span>
                    )}
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  gap: '8px',
                  borderTop: '1px solid #f1f5f9',
                  paddingTop: '14px',
                  alignItems: 'center'
                }} onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => downloadFirPdf(r)}
                    style={{
                      flex: 1,
                      backgroundColor: '#059669',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    FIR PDF
                  </button>
                  <button
                    onClick={() => exportExecutiveSummary(r)}
                    style={{
                      backgroundColor: '#ffffff',
                      color: '#030441',
                      border: '1.5px solid #030441',
                      borderRadius: '6px',
                      padding: '7px 12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Brief
                  </button>
                  <button
                    onClick={() => downloadJsonReport(r)}
                    style={{
                      backgroundColor: '#f1f5f9',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '7px 10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    JSON
                  </button>
                  <button
                    onClick={(e) => handleDelete(r.case_id, e)}
                    style={{
                      backgroundColor: 'transparent',
                      color: '#dc2626',
                      border: 'none',
                      padding: '6px 8px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 700
                    }}
                    title="Delete Case"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 5. Pagination Bar matching LEA Portal standard */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
          marginTop: '20px',
          marginBottom: '40px'
        }}>
          <button
            disabled={safePage === 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1.5px solid #030441',
              backgroundColor: '#ffffff',
              color: safePage === 1 ? '#94a3b8' : '#030441',
              fontWeight: 700,
              fontSize: '12px',
              cursor: safePage === 1 ? 'not-allowed' : 'pointer',
              opacity: safePage === 1 ? 0.5 : 1
            }}
          >
            ← Previous
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
            const isCur = p === safePage
            return (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  border: isCur ? 'none' : '1.5px solid #cbd5e1',
                  backgroundColor: isCur ? '#030441' : '#ffffff',
                  color: isCur ? '#ffffff' : '#030441',
                  fontWeight: 800,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                {p}
              </button>
            )
          })}

          <button
            disabled={safePage === totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1.5px solid #030441',
              backgroundColor: '#ffffff',
              color: safePage === totalPages ? '#94a3b8' : '#030441',
              fontWeight: 700,
              fontSize: '12px',
              cursor: safePage === totalPages ? 'not-allowed' : 'pointer',
              opacity: safePage === totalPages ? 0.5 : 1
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
