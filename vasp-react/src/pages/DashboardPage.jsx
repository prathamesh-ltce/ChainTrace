import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { adminApi, reportsApi } from '../utils/api'

const QUICK_ACTIONS = [
  { id: 'trace',   title: 'Trace Suspect Wallet',         icon: 'map',      color: '#38bdf8' },
  { id: 'batch',   title: 'Batch Multi-Case Queue',       icon: 'layers',   color: '#10b981' },
  { id: 'vasp',    title: 'VASP Directory & Attribution', icon: 'building', color: '#f59e0b' },
  { id: 'reports', title: 'Investigation Case Reports',   icon: 'file',     color: '#6366f1' },
]

const ICONS = {
  map: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
    </svg>
  ),
  layers: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
      <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  building: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
      <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  file: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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

  const officerName = (userProfile?.full_name || currentUser || 'OFFICER1').toUpperCase()
  const badgeId = userProfile?.badge_id || 'LEA-DEMO-01'
  const unitName = userProfile?.unit || 'Cyber Crime Investigation Desk'
  const totalCasesCount = stats?.total_cases ?? (recentCases.length || 43)

  return (
    <div style={{
      maxWidth: '1280px',
      margin: '0 auto',
      padding: '28px 32px 48px',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      color: '#030441',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    }}>
      {/* Officer Welcome Header (Replaces Dashboard & Good Morning as requested) */}
      <div>
        <h1 style={{
          fontSize: '32px',
          fontWeight: 800,
          color: '#030441',
          margin: '0 0 6px 0',
          letterSpacing: '-0.02em',
          lineHeight: 1.2
        }}>
          Welcome, {officerName}
        </h1>
        <p style={{
          fontSize: '14px',
          color: '#64748b',
          margin: 0,
          fontWeight: 500
        }}>
          {unitName} - Badge: {badgeId}
        </p>
      </div>

      {/* Centered Number of Cases Hero Card (Exact layout from uploaded image) */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1.5px solid #030441',
        borderRadius: '16px',
        padding: '32px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        boxShadow: '0 4px 16px rgba(3, 4, 65, 0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', justifyContent: 'center' }}>
          <span style={{ fontSize: '48px', fontWeight: 900, color: '#030441', lineHeight: 1 }}>
            {totalCasesCount}
          </span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: '#030441', letterSpacing: '-0.01em' }}>
            Number of Cases
          </span>
        </div>
      </div>

      {/* Operational Forensics Actions (2x2 Grid from uploaded image) */}
      <div>
        <div style={{
          fontSize: '16px',
          fontWeight: 800,
          color: '#030441',
          marginBottom: '12px',
          letterSpacing: '-0.01em'
        }}>
          Operational Forensics Actions
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '14px'
        }}>
          {QUICK_ACTIONS.map(a => (
            <button
              key={a.id}
              onClick={() => setCurrentView(a.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px',
                backgroundColor: '#ffffff',
                border: '1.5px solid #030441',
                borderRadius: '14px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.18s ease',
                boxShadow: '0 2px 8px rgba(3, 4, 65, 0.04)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#f8fafc'
                e.currentTarget.style.borderColor = '#38bdf8'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff'
                e.currentTarget.style.borderColor = '#030441'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: '#f1f5f9',
                  color: a.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {ICONS[a.icon]}
                </div>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#030441' }}>
                  {a.title}
                </span>
              </div>
              <span style={{ color: '#64748b', fontSize: '18px', fontWeight: 600 }}>
                →
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Case Investigations Table (Matching uploaded image layout) */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1.5px solid #030441',
        padding: '24px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: '0 4px 16px rgba(3, 4, 65, 0.05)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '14px'
        }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#030441' }}>
              Recent Case Investigations
            </div>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
              {totalCasesCount} cases indexed in forensic database
            </div>
          </div>
          <button
            onClick={() => setCurrentView('reports')}
            style={{
              background: 'none',
              border: 'none',
              color: '#0284c7',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              padding: 0
            }}
            onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
            onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
          >
            View All Reports →
          </button>
        </div>

        {recentCases.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
            No investigations yet. Click <strong>Trace Suspect Wallet</strong> above to begin your first analysis.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
              textAlign: 'left'
            }}>
              <thead>
                <tr style={{ color: '#64748b', borderBottom: '1.5px solid #e2e8f0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>CASE REFERENCE</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>SUSPECT WALLET</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>CHAIN</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>RISK LEVEL</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>TERMINAL TARGETS</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700, textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {recentCases.slice(0, 6).map((r, i) => (
                  <tr
                    key={r.case_id || i}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      color: '#0f172a'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '14px 14px', fontWeight: 700, color: '#030441' }}>
                      {r.case_id}
                    </td>
                    <td style={{ padding: '14px 14px', fontFamily: 'monospace', color: '#334155' }}>
                      {r.suspect_address && r.suspect_address.length > 20
                        ? `${r.suspect_address.substring(0, 8)}...${r.suspect_address.substring(r.suspect_address.length - 6)}`
                        : (r.suspect_address || '-')}
                    </td>
                    <td style={{ padding: '14px 14px', fontWeight: 600, color: '#475569' }}>
                      {r.blockchain || 'ETH'}
                    </td>
                    <td style={{ padding: '14px 14px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '3px 9px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: r.risk_level === 'CRITICAL' ? '#fef2f2' : r.risk_level === 'HIGH' ? '#fff7ed' : '#eff6ff',
                        color: r.risk_level === 'CRITICAL' ? '#dc2626' : r.risk_level === 'HIGH' ? '#ea580c' : '#0284c7',
                        border: `1px solid ${r.risk_level === 'CRITICAL' ? '#fecaca' : r.risk_level === 'HIGH' ? '#fed7aa' : '#bfdbfe'}`
                      }}>
                        {r.risk_level || 'LOW'} ({r.risk_score || 0}%)
                      </span>
                    </td>
                    <td style={{ padding: '14px 14px', fontWeight: 600, color: '#030441' }}>
                      {r.top_vasp || (r.vasp_targets_count ? `${r.vasp_targets_count} VASP(s)` : '-')}
                    </td>
                    <td style={{ padding: '14px 14px', textAlign: 'right' }}>
                      <button
                        onClick={() => openReport(r)}
                        style={{
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '6px 14px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#030441',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.backgroundColor = '#38bdf8'
                          e.currentTarget.style.color = '#ffffff'
                          e.currentTarget.style.borderColor = '#38bdf8'
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.backgroundColor = '#f1f5f9'
                          e.currentTarget.style.color = '#030441'
                          e.currentTarget.style.borderColor = '#cbd5e1'
                        }}
                      >
                        Open Case →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
