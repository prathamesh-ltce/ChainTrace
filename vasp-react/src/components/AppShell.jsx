import { useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { analytics } from '../utils/analytics'
import Sidebar from './Sidebar'
import Header from './Header'
import ToastContainer from './ToastContainer'
import AlertsDrawer from './AlertsDrawer'
import CookieBanner from './CookieBanner'
import DashboardPage from '../pages/DashboardPage'
import TracePage from '../pages/TracePage'
import BatchPage from '../pages/BatchPage'
import ReportsPage from '../pages/ReportsPage'
import GraphPage from '../pages/GraphPage'
import VaspRegistryPage from '../pages/VaspRegistryPage'
import IntelPage from '../pages/IntelPage'
import SettingsPage from '../pages/SettingsPage'
import PrivacyPolicyPage from '../pages/PrivacyPolicyPage'
import TermsPage from '../pages/TermsPage'
import NotFoundPage from '../pages/NotFoundPage'

const VIEWS = {
  dashboard: <DashboardPage />,
  trace:     <TracePage />,
  batch:     <BatchPage />,
  reports:   <ReportsPage />,
  graph:     <GraphPage />,
  vasp:      <VaspRegistryPage />,
  intel:     <IntelPage />,
  settings:  <SettingsPage />,
  privacy:   <PrivacyPolicyPage />,
  terms:     <TermsPage />,
  notfound:  <NotFoundPage />,
}

export default function AppShell() {
  const { currentView, sidebarCollapsed, setCurrentView } = useApp()

  useEffect(() => {
    analytics.trackPageView(currentView)
  }, [currentView])

  const ActiveComponent = VIEWS[currentView] || <NotFoundPage />

  return (
    <div 
      className="app-shell"
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: '#f8fafc'
      }}
    >
      <Sidebar />
      <div 
        className={"main-area" + (sidebarCollapsed ? " collapsed" : "")}
        style={{
          marginLeft: sidebarCollapsed ? '72px' : '260px',
          flex: 1,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#f8fafc',
          transition: 'margin-left 0.2s ease'
        }}
      >
        <Header />
        <main 
          className="page-content" 
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#f8fafc',
            color: '#030441',
            minHeight: 'calc(100vh - 64px)',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ flex: 1 }}>
            {ActiveComponent}
          </div>
          
          {/* Official White Theme Footer */}
          <footer style={{
            marginTop: 40,
            padding: '16px 32px 20px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            fontSize: '0.8rem',
            color: '#64748b'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <img 
                src="/Ministry-of-Home-Affairs2-dark.png" 
                alt="Ministry of Home Affairs"
                style={{ height: '38px', width: 'auto', objectFit: 'contain' }}
                onError={(e) => { e.currentTarget.src = '/mha-logo-dark.png'; }}
              />
              <span style={{ fontSize: '13px', color: '#334155' }}>
                Website content managed by <strong>Ministry of Home Affairs, Govt. of India.</strong>
              </span>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <button
                onClick={() => setCurrentView('privacy')}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = '#0284c7'}
                onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
              >
                Privacy Policy
              </button>
              <span>•</span>
              <button
                onClick={() => setCurrentView('terms')}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = '#0284c7'}
                onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
              >
                Terms of Protocol
              </button>
              <span>•</span>
              <button
                onClick={() => setCurrentView('settings')}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = '#0284c7'}
                onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
              >
                Security Architecture
              </button>
            </div>
          </footer>
        </main>
      </div>
      <AlertsDrawer />
      <CookieBanner />
      <ToastContainer />
    </div>
  )
}
